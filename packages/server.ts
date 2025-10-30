import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyMiddie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { createServer as createViteServer, ViteDevServer } from "vite";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import registerPlugins from "./plugin_manager.js";
import { render } from "ripple/server";
import getPort from "get-port";

const vite_port = await getPort({ port: [24678, 24679, 23678, 24658, 23178, 23000, 2178, 22278] });
const isProd = process.env.NODE_ENV === "production";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const distServerDir = path.join(distDir, "server");
const apiDir = isProd ? path.join(distServerDir, "api") : path.join(projectRoot, "api");
const pluginDir = isProd ? path.join(distServerDir, "plugins") : path.join(projectRoot, "plugins");
const srcPath = path.join(projectRoot, "src");
const RippleAppPath = path.join(srcPath, "App.ripple");

// --------------------- API ROUTES ---------------------
async function registerApiRoutes(app: FastifyInstance, dir: string, prefix = ""): Promise<void> {
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
      app.register(async (f: FastifyInstance) => await handler(f), {
        prefix: `/api${routePath}`,
      });
      console.log(`Loaded route: /api${routePath}`);
    }
  }
}

// --------------------- START SERVER ---------------------
export async function StartServer(): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({ routerOptions: { ignoreTrailingSlash: true } });

  await app.register(fastifyMiddie);
  await registerPlugins(app, pluginDir);
  await registerApiRoutes(app, apiDir);

  if (!isProd) {
    // --------------------- DEVELOPMENT MODE ---------------------
    const vite: ViteDevServer = await createViteServer({
      root: projectRoot,
      server: { middlewareMode: true, hmr: { port: vite_port } },
    });

    // Serve frontend routes through Fastify (so hooks still work)
    app.get("/*", async (req: FastifyRequest, reply: FastifyReply) => {
      const url = req.url || "/";

      if (url.startsWith("/api") || /\.[a-zA-Z0-9]+$/.test(url)) {
        return reply.callNotFound(); // Let Fastify handle real files or APIs
      }

      try {
        let template = fs.readFileSync(path.resolve(projectRoot, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);

        const { App } = await vite.ssrLoadModule(RippleAppPath);
        const { head, body, css } = await render(App);
        const cssTags = css.size > 0 ? `<style data-ripple-ssr>${[...css].join("\n")}</style>` : "";

        const html = template
          .replace("<!--ssr-head-->", head + cssTags)
          .replace("<!--ssr-body-->", body);

        reply.type("text/html").send(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        console.error("SSR Error:", err);
        reply.status(500).send((err as Error).stack || String(err));
      }
    });

    // Attach vite.middlewares but wrapped so hooks still run
    app.addHook("onRequest", async (req, reply) => {
      // Let vite handle transform/static requests internally (like /@vite or /src)
      if (!req.url.startsWith("/api")) {
        await new Promise<void>((resolve) => vite.middlewares(req.raw, reply.raw, resolve));
      }
    });
  } else {
    // --------------------- PRODUCTION MODE ---------------------
    const clientRoot = distDir;

    await app.register(fastifyStatic, {
      root: clientRoot,
      prefix: "/",
      index: ["index.html"],
      wildcard: false,
    });

    app.get("/*", async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.url.startsWith("/api") || /\.[a-zA-Z0-9]+$/.test(req.url || "")) {
        return reply.callNotFound();
      }

      try {
        const template = fs.readFileSync(path.join(clientRoot, "index.html"), "utf-8");
        const entryServer = path.join(distServerDir, "server.js");
        const { App } = await import(pathToFileURL(entryServer).href);

        const { head, body, css } = await render(App);
        const cssTags = css.size > 0 ? `<style data-ripple-ssr>${[...css].join("\n")}</style>` : "";

        const html = template
          .replace("<!--ssr-head-->", head + cssTags)
          .replace("<!--ssr-body-->", body);

        reply.type("text/html").send(html);
      } catch (err) {
        console.error("SSR (Prod) Error:", err);
        reply.status(500).send((err as Error).stack || String(err));
      }
    });
  }

  // --------------------- SERVER START ---------------------
  let port = 3000;
  if (isProd && process.env.PORT) {
    port = Number(process.env.PORT);
  } else {
    port = await getPort({ port: [3000, 3001, 3002, 4000, 4001] });
  }

  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    console.log(`Rivra ${isProd ? "Production" : "Development + SSR"} running on ${address}`);
  });

  return app;
}

export default StartServer;
