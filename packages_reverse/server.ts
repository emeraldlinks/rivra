import Fastify from "fastify";
import fastifyMiddie from "@fastify/middie";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";
import type { FastifyInstance } from "fastify";
import registerPlugins from "./plugin_manager.js";
import { render } from "ripple/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, "api");
const pluginDir = path.join(projectRoot, "plugins");
const srcPath = path.join(projectRoot, "src");
const RippleAppPath = path.join(srcPath, "App.ripple");

// --------------------- API ROUTES ---------------------
async function registerApiRoutes(app: FastifyInstance, dir: string, prefix = "") {
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
      app.register(async (fastify: FastifyInstance) => await handler(fastify), { prefix: `/api${routePath}` });
      console.log(`✅ Loaded route: /api${routePath}`);
    }
  }
}

// --------------------- START SERVER ---------------------
export async function StartServer() {
  const app = Fastify({ routerOptions: { ignoreTrailingSlash: true }});

  await app.register(fastifyMiddie);
  await registerPlugins(app, pluginDir);
  await registerApiRoutes(app, apiDir);

  const vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true, hmr: { port: 24678 } },
  });

  // Vite middleware for dev
  app.use((req, res, next) => {
    if (req.url?.startsWith("/api")) return next();
    vite.middlewares(req, res, next);
  });

  // SSR handler
  app.get("/*", async (req, reply) => {
    try {
      if (req.url.startsWith("/api")) return reply.callNotFound();

      // Load and transform index.html
      let template = fs.readFileSync(path.resolve(projectRoot, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(req.url, template);

      // SSR Ripple App
      const { App } = await vite.ssrLoadModule(RippleAppPath);
      const { head, body, css } = await render(App);

      // Inline CSS from the Set
      const cssTags = css.size > 0 ? `<style data-ripple-ssr>${[...css].join("\n")}</style>` : "";

      // Inject head + body
      const html = template
        .replace("<!--ssr-head-->", head + cssTags)
        .replace("<!--ssr-body-->", body);

      reply.type("text/html").send(html);
    } catch (err: any) {
      console.error("SSR Error:", err);
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
