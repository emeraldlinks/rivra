// ripple_ssr_helper.js
import { pathToFileURL } from "url";
import fs from "fs";
import path from "path";

/**
 * Render a ripple component to HTML string and wrap it with data attributes:
 *  - data-_rivra_id = export name (component name)
 *  - data-_rivra_mod = module URL the client can import
 *
 * In dev: uses vite.ssrLoadModule(modulePath)
 * In prod: uses dynamic import of built server entry (moduleUrl should be a file:// URL)
 *
 * @param {import('vite').ViteDevServer|null} viteDevServer - vite dev server (null in prod)
 * @param {string} moduleFsPath - absolute path to .ripple file in src (fs path)
 * @param {string} exportName - the named export (e.g., "App" or "UU")
 * @param {object} props - props to pass to the component render
 * @returns {Promise<string>} - html string (wrapped)
 */
export async function renderComponentWithMarkers(viteDevServer, moduleFsPath, exportName, props = {}) {
  // moduleUrl used by server-side import and sent to client for dynamic import
  // In dev we can use Vite's module path (path relative to root) so client can import same path via bare /src/...
  // In prod we map to dist/client/<something>.js (your build should emit correct client files).
  let mod;
  if (viteDevServer) {
    // dev: use vite SSR loader so ESM imports work with vite
    const moduleId = pathToFileURL(moduleFsPath).href + `?t=${Date.now()}`;
    mod = await viteDevServer.ssrLoadModule(moduleId);
  } else {
    // prod: server built files live under dist/server (entry points)
    // we import via file://
    mod = await import(pathToFileURL(moduleFsPath).href);
  }

  // Resolve component: named export first, then default fallback
  const comp = mod[exportName] ?? mod.default ?? Object.values(mod)[0];
  if (!comp) throw new Error(`Component ${exportName} not found in ${moduleFsPath}`);

  // Call server render. Assume your ripple/server exposes render() that accepts a component or App object.
  // If your ripple/server requires a different shape adapt this call. Here I call render(comp, { props })
  // render() should return { head, body, css } or at least a html string. We assume a simple renderToString for components.
  // If you have a top-level render(App) that returns {body} use that.

  // Try a few possible render shapes:
  let renderedHtml = "";

  // If component is a function that returns HTML string
  if (typeof comp === "function") {
    try {
      // some Ripple components in your setup use a render function; try calling comp(props)
      const out = comp(props);
      if (typeof out === "string") {
        renderedHtml = out;
      } else if (out && typeof out.then === "function") {
        renderedHtml = await out;
      } else if (out && out.body) {
        renderedHtml = out.body;
      } else {
        // fallback: JSON stringify
        renderedHtml = String(out);
      }
    } catch (err) {
      // If your ripple has server.render utility, use it instead:
      if (typeof globalThis.__RIPPLE_RENDER === "function") {
        const r = await globalThis.__RIPPLE_RENDER(comp, props);
        renderedHtml = r.body ?? String(r);
      } else {
        // rethrow if cannot render
        throw err;
      }
    }
  } else if (comp && comp.render) {
    // If comp is descriptor with render method
    const r = await comp.render(props);
    renderedHtml = r.body ?? r.html ?? String(r);
  } else {
    throw new Error("Unknown component shape for server render.");
  }

  // Build module import path for the client.
  // In dev, the client can import using the path relative to project root (e.g. /src/...).
  // We'll prefer to expose a url path the client can import:
  let clientModuleUrl;
  if (viteDevServer) {
    // turn fs path into /src/... by making it relative to project root
    // vite serves files under root with /src/...
    const projectRoot = viteDevServer.config.root || process.cwd();
    clientModuleUrl = "/" + path.relative(projectRoot, moduleFsPath).replace(/\\/g, "/");
    // add quick cache-buster
    clientModuleUrl += `?t=${Date.now()}`;
  } else {
    // prod: the client bundle location depends on your build output.
    // A safe option: map to a predictable route your server exposes, e.g., /_rivra_modules/relativePath.js
    // You need to implement a static route that serves the built client modules.
    const projectRoot = process.cwd();
    clientModuleUrl = "/_rivra_modules/" + path.relative(projectRoot, moduleFsPath).replace(/\\/g, "/") + ".js";
    // append cache buster if you want
  }

  // Wrap server HTML inside container with markers
  // Also include a small JSON props payload for hydration: data-_rivra_props
  const propsJson = JSON.stringify(props === undefined ? null : props).replace(/</g, "\\u003c");
  const wrapped = `<div data-_rivra_id="${exportName}" data-_rivra_mod="${clientModuleUrl}" data-_rivra_props='${propsJson}'>${renderedHtml}</div>`;

  return wrapped;
}
