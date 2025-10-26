import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyMiddie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { createServer as createViteServer, ViteDevServer } from "vite";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import registerPlugins from "./plugin_manager.js";
import { render } from "ripple/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();

const apiDir = path.join(projectRoot, "api");
const pluginDir = path.join(projectRoot, "plugins");
const srcPath = path.join(projectRoot, "src");
const RippleAppPath = path.join(srcPath, "App.ripple");
const distDir = path.join(projectRoot, "dist");
const distServerDir = path.join(distDir, "server");

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
  const isProd = process.env.NODE_ENV === "production";

  await app.register(fastifyMiddie);
  await registerPlugins(app, pluginDir);
  await registerApiRoutes(app, apiDir);

  if (!isProd) {
    // --------------------- DEVELOPMENT MODE ---------------------
    const vite: ViteDevServer = await createViteServer({
      root: projectRoot,
      server: { middlewareMode: true, hmr: { port: 24678 } },
    });

    app.use((req, res, next) => {
      if (req.url?.startsWith("/api")) return next();
      vite.middlewares(req, res, next);
    });

    app.get("/*", async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        let template = fs.readFileSync(path.resolve(projectRoot, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.url || "/", template);

        const { App } = await vite.ssrLoadModule(RippleAppPath);
        const { head, body, css } = await render(App);
        const cssTags = css.size > 0 ? `<style data-ripple-ssr>${[...css].join("\n")}</style>` : "";

        const html = template
          .replace("<!--ssr-head-->", head + cssTags)
          .replace("<!--ssr-body-->", body);

        reply.type("text/html").send(html);
      } catch (err) {
        console.error("SSR Error:", err);
        reply.status(500).send((err as Error).stack || String(err));
      }
    });
 } else {
  // --------------------- PRODUCTION MODE ---------------------
  const clientRoot = distDir;

  // Serve static files, but after APIs have been registered
  await app.register(fastifyStatic, {
    root: clientRoot,
    prefix: "/",
    index: ["index.html"],
    wildcard: false,
  });

  // Fallback SSR route for non-API requests
  app.get("/*", async (req: FastifyRequest, reply: FastifyReply) => {
    // ✅ Don't let SSR handle API routes or real files
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


  const port = Number(process.env.PORT) || 3000;
  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    console.log(`Rivra ${isProd ? "Production" : "Development + SSR"} server running on ${address}`);
  });

  return app;
}

export default StartServer;
