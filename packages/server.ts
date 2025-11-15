/**
 * ---------------------------------------------------------------
 * RIVRA DEVELOPMENT SERVER
 * ---------------------------------------------------------------
 * This server runs Vite in middleware mode during development
 * so that frontend routes are served through Fastify.
 *
 * That means all Fastify plugins, hooks, and middlewares
 * apply to both backend and frontend requests.
 *
 * In production, static files are served from /dist
 * and API routes are auto-loaded from /api.
 * ---------------------------------------------------------------
 */

import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyMiddie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { createServer as createViteServer, ViteDevServer } from "vite";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import registerPlugins from "./plugin_manager.js";
import getPort from "get-port";

// Pick an available port for Vite HMR (hot reload)
const vite_port = await getPort({
  port: [24678, 24679, 23678, 24658, 23178, 23000, 2178, 22278],
});

const isProd = process.env.NODE_ENV === "production";

// Resolve paths relative to current file
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const distServerDir = path.join(distDir, "server");

// Dynamic directories based on environment
const apiDir = isProd ? path.join(distServerDir, "api") : path.join(projectRoot, "api");
const pluginDir = isProd ? path.join(distServerDir, "plugins") : path.join(projectRoot, "plugins");

/**
 * ---------------------------------------------------------------
 * AUTO-REGISTER API ROUTES
 * ---------------------------------------------------------------
 * Automatically loads all JS/TS files inside /api
 * and registers them as Fastify routes.
 *
 * Supports:
 * - Nested directories
 * - Dynamic routes like [id].ts → /:id
 * - index.ts → root route
 * ---------------------------------------------------------------
 */
async function registerApiRoutes(app: FastifyInstance, dir: string, prefix = ""): Promise<void> {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    // Recurse into subdirectories
    if (stat.isDirectory()) {
      await registerApiRoutes(app, fullPath, `${prefix}/${file}`);
      continue;
    }

    // Skip non-JS/TS files
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

    // Convert filenames to route paths
    let routePath = prefix + "/" + file.replace(/\.(ts|js)$/, "");
    if (file.startsWith("index.")) routePath = prefix || "/";
    routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1"); // dynamic route params

    // Import the route module
    const moduleUrl = pathToFileURL(fullPath).href + `?t=${Date.now()}`;
    const mod = await import(moduleUrl);
    const handler = mod.default || Object.values(mod)[0];

    // Register the route if a valid handler is exported
    if (typeof handler === "function") {
      app.register(async (f: FastifyInstance) => await handler(f), {
        prefix: `/api${routePath}`,
      });
      console.log(`Loaded route: /api${routePath}`);
    }
  }
}

/**
 * ---------------------------------------------------------------
 * START SERVER
 * ---------------------------------------------------------------
 * Creates and runs the Fastify + Vite dev server.
 * ---------------------------------------------------------------
 */
export async function StartServer(p0: { dev: boolean; }): Promise<FastifyInstance> {
  const app = Fastify({
    routerOptions: { ignoreTrailingSlash: true },
  });

  // Allow Fastify middlewares and custom plugins
  await app.register(fastifyMiddie);

  // Register all user-defined plugins from /plugins directory
  await registerPlugins(app, pluginDir);

  // Load API routes automatically
  await registerApiRoutes(app, apiDir);

  if (!isProd) {
    /**
     * ---------------------------------------------------------------
     * DEVELOPMENT MODE
     * ---------------------------------------------------------------
     * Runs Vite as middleware.
     * All requests (including frontend ones like "/")
     * pass through Fastify first — so plugins and hooks apply.
     * ---------------------------------------------------------------
     */
    const vite: ViteDevServer = await createViteServer({
      root: projectRoot,
      server: { middlewareMode: true, hmr: { port: vite_port } },
    });

    // Global request hook (runs before routes)
    app.addHook("onRequest", async (req, reply) => {
      console.log("Incoming:", req.url);
    });

    // Catch-all route for frontend requests
    app.all("/*", async (req: FastifyRequest, reply: FastifyReply) => {
      const url = req.url || "/";

      // Let /api routes be handled by Fastify
      if (url.startsWith("/api")) return reply.callNotFound();

      // Forward everything else to Vite (frontend)
      await new Promise<void>((resolve, reject) => {
        vite.middlewares(req.raw, reply.raw, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  } else {
    /**
     * ---------------------------------------------------------------
     * PRODUCTION MODE
     * ---------------------------------------------------------------
     * Serves prebuilt static files from /dist.
     * Plugins still apply since Fastify serves everything.
     * ---------------------------------------------------------------
     */
    await app.register(fastifyStatic, {
      root: distDir,
      prefix: "/",
      index: ["index.html"],
      wildcard: false,
    });

    // Frontend fallback route (after /api)
    app.get("/*", async (req, reply) => {
      if (req.url.startsWith("/api")) return reply.callNotFound();
      const html = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");
      reply.type("text/html").send(html);
    });
  }

  /**
   * ---------------------------------------------------------------
   * SERVER STARTUP
   * ---------------------------------------------------------------
   * Automatically finds an available port and starts listening.
   * ---------------------------------------------------------------
   */
  const port = await getPort({ port: [3000, 3001, 3002, 4000] });

  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    console.log(`Rivra ${isProd ? "Production" : "Development"} running on ${address}`);
  });

  return app;
}

export default StartServer;
