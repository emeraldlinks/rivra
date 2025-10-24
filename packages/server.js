import Fastify from "fastify";
import fastifyMiddie from "@fastify/middie";
import { createServer as createViteServer } from "vite";
import { pathToFileURL, fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import registerPlugins from "./plugin_manager.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, "api");
const pluginDir = path.join(projectRoot, "plugins")

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

export async function StartServer() {
  const app = Fastify({routerOptions: {
    ignoreTrailingSlash: true
  }});
  await app.register(fastifyMiddie);

  await registerPlugins(app, pluginDir)
  await registerApiRoutes(app, apiDir);

  const vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true, hmr: { port: 24678 } },
  });

  app.use((req, res, next) => {
    if (req.url?.startsWith("/api")) return next();
    vite.middlewares(req, res, next);
  });

  app.get("/*", async (req, reply) => {
    if (req.url.startsWith("/api")) return reply.callNotFound();
    const html = await vite.transformIndexHtml(req.url, "index.html");
    reply.type("text/html").send(html);
  });

  const port = 3000;
  app.listen({ port }, (err, address) => {
    if (err) throw err;
    console.log(`🚀 Rivra Full-Stack Dev running on ${address}`);
    console.log(app.printRoutes());
  });

  return app;
}

export default StartServer;
