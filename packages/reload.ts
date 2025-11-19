// reload.ts
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const root = process.cwd();
const apiDir = path.join(root, "api");
const pluginDir = path.join(root, "plugins");

// ✅ Export so server.ts can use it in the proxy route
export const apiHandlers = new Map<
  string,
  (req: FastifyRequest, reply: FastifyReply) => any
>();

const pluginHandlers = new Map<string, (req: any, res: any) => any>();

async function freshImport(file: string): Promise<any> {
  const url = pathToFileURL(file).href + `?v=${Date.now()}`;
  return import(url);
}

/**
 * Normalize a route path for consistent lookup
 */
function normalizeApiPath(rawPath: string): string {
  let p = rawPath.replace(/\/+/g, "/"); // collapse multiple slashes
  if (p.endsWith("/") && p !== "/") {
    p = p.slice(0, -1); // remove trailing slash (Fastify ignores them)
  }
  return p || "/";
}

/**
 * Reload all API handlers
 */
export async function reloadApi(app: FastifyInstance) {
  async function walk(dir: string, prefix = "") {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const full = path.join(dir, item.name);

      if (item.isDirectory()) {
        await walk(full, prefix + "/" + item.name);
        continue;
      }

      if (!/\.(ts|js)$/.test(item.name)) continue;

      // Build route path
      let route = prefix + "/" + item.name.replace(/\.(ts|js)$/, "");
      
      // Handle index files: /users/index.ts → /users
      if (item.name.startsWith("index.")) {
        route = prefix || "";
      }

      // Convert [id].ts → :id
      route = route.replace(/\[([^\]]+)\]/g, ":$1");

      // Final API path: /api + route
      let apiPath = "/api" + (route || "");
      apiPath = normalizeApiPath(apiPath);

      // Clear old handler
      apiHandlers.delete(apiPath);

      try {
        const mod = await freshImport(full);
        const handler =
          mod.default ||
          Object.values(mod).find((x) => typeof x === "function");

        if (typeof handler === "function") {
          apiHandlers.set(apiPath, handler);
        } else {
          throw new Error("No valid handler function exported");
        }
      } catch (err) {
        console.error(`[HMR] API load failed: ${apiPath}`, err);
        apiHandlers.set(
          apiPath,
          async (_req: FastifyRequest, reply: FastifyReply) => {
            reply.code(500).send({ error: "Handler failed to load" });
          }
        );
      }
    }
  }

  await walk(apiDir);
}

/**
 * Reload all plugin handlers
 */
export async function reloadPlugins() {
  async function walk(dir: string) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const full = path.join(dir, item.name);

      if (item.isDirectory()) {
        await walk(full);
        continue;
      }

      if (!/\.(ts|js)$/.test(item.name)) continue;

      try {
        const mod = await freshImport(full);
        const handler =
          mod.default ||
          Object.values(mod).find((x) => typeof x === "function");

        if (typeof handler === "function") {
          pluginHandlers.set(full, handler);
        }
      } catch (err) {
        console.error("[HMR] plugin load failed:", full, err);
      }
    }
  }

  await walk(pluginDir);
}

/**
 * Run all plugin handlers for a request
 */
export async function runPluginHandlers(req: any, res: any) {
  for (const fn of pluginHandlers.values()) {
    await fn(req, res);
  }
}

/**
 * Watch API and plugin directories for changes
 */
export function watchProject(app: FastifyInstance) {
  // Initial load
  reloadApi(app).catch(console.error);
  reloadPlugins().catch(console.error);

  // Throttled reload for API changes
  let apiTimer: NodeJS.Timeout;
  if (fs.existsSync(apiDir)) {
    fs.watch(apiDir, { recursive: true }, (_event, filename) => {
      if (filename && /\.(ts|js)$/.test(filename)) {
        clearTimeout(apiTimer);
        apiTimer = setTimeout(() => {
          console.log(`[HMR] API changed: ${filename}`);
          reloadApi(app).catch(console.error);
        }, 100);
      }
    });
  }

  // Throttled reload for plugin changes
  let pluginTimer: NodeJS.Timeout;
  if (fs.existsSync(pluginDir)) {
    fs.watch(pluginDir, { recursive: true }, (_event, filename) => {
      if (filename && /\.(ts|js)$/.test(filename)) {
        clearTimeout(pluginTimer);
        pluginTimer = setTimeout(() => {
          console.log(`[HMR] plugin changed: ${filename}`);
          reloadPlugins().catch(console.error);
        }, 100);
      }
    });
  }
}