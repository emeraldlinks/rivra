import Fastify from "fastify";
import fastifyMiddie from "@fastify/middie";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";
import registerPlugins from "./plugin_manager.js";
import { render, executeServerFunction } from "ripple/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, "api");
const pluginDir = path.join(projectRoot, "plugins");
const srcPath = path.join(projectRoot, "src");
const RippleAppPath = path.join(srcPath, "App.ripple");

const rpc_modules = new Map();

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// --------------------- API ROUTES ---------------------
async function registerApiRoutes(app, dir, prefix = "") {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await registerApiRoutes(app, fullPath, `${prefix}/${file}`);
      continue;
    }
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

    let routePath = prefix + "/" + file.replace(/\.(ts|js)$/, "");
    if (file.startsWith("index.")) routePath = prefix || "/";
    routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

    const moduleUrl = pathToFileURL(fullPath).href + `?t=${Date.now()}`;
    const mod = await import(moduleUrl);
    const handler = mod.default || Object.values(mod)[0];

    if (typeof handler === "function") {
      app.register(async (fastify) => await handler(fastify), {
        prefix: `/api${routePath}`,
      });
      console.log(`✅ Loaded route: /api${routePath}`);
    }
  }
}

// --------------------- START SERVER ---------------------
export async function StartServer() {
  const app = Fastify({ routerOptions: { ignoreTrailingSlash: true } });

  await app.register(fastifyMiddie);
  await registerPlugins(app, pluginDir);
  await registerApiRoutes(app, apiDir);

  const vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true, hmr: { port: 24678 } },
    appType: "custom",
  });

  // Vite dev middleware
  app.use((req, res, next) => {
    if (req.url?.startsWith("/api")) return next();
    vite.middlewares(req, res, next);
  });

  // SSR + RPC handler
  app.all("/*", async (req, reply) => {
    try {
      if (req.url.startsWith("/api")) return reply.callNotFound();

      // Handle Ripple RPC
      if (req.url.startsWith("/_$_ripple_rpc_$_/")) {
        const hash = req.url.slice("/_$_ripple_rpc_$_/".length);
        const module_info = rpc_modules.get(hash);
        if (!module_info) throw new Error("RPC module not found");
        const [file_path, func_name] = module_info;
        const { _$_server_$_: server } = await vite.ssrLoadModule(file_path);
        const rpc_args = await getRequestBody(req);
        const result = await executeServerFunction(server[func_name], rpc_args);
        reply.type("application/json").send(result);
        return;
      }

      // SSR rendering
      let template = fs.readFileSync(path.resolve(projectRoot, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(req.url, template);

      let  getCssForHashes;
      const previous_rpc = rpc_modules;
      try {
        globalThis.rpc_modules = new Map(rpc_modules);
        ({ get_css_for_hashes: getCssForHashes } = await vite.ssrLoadModule("ripple/server"));
      } finally {
        globalThis.rpc_modules = previous_rpc;
      }

      const { App } = await vite.ssrLoadModule(RippleAppPath);
      const { head, body, css } = await render(App);

      let cssTags = "";
      if (css.size > 0 && getCssForHashes) {
        const cssContent = getCssForHashes(css);
        if (cssContent) cssTags = `<style data-ripple-ssr>${cssContent}</style>`;
      }

      const html = template
        .replace("<!--ssr-head-->", head + cssTags)
        .replace("<!--ssr-body-->", body);

      reply.type("text/html").send(html);
    } catch (err) {
      console.error("SSR/RPC Error:", err);
      reply.status(500).send(err.stack || String(err));
    }
  });

  const port = 3000;
  app.listen({ port }, (err, address) => {
    if (err) throw err;
    console.log(`🚀 Rivra Full-Stack Dev + SSR running on ${address}`);
    console.log(app.printRoutes());
  });

  return app;
}

export default StartServer;
