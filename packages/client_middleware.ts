import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

interface ClientMiddlewareTask {
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  route?: string;
  fileName: string;
  order: number;
}

/**
 * Load and register frontend (client) middleware.
 * 
 * Structures:
 * - Global middleware: /client_middleware/*.ts → runs for all non-API routes
 * - Route-specific middleware: filename.cm.ts → runs only for /<filename>
 *
 * Execution order is controlled by `export const order = <number>` (default 10)
 */
export default async function registerClientMiddleware(
  app: FastifyInstance,
  dir: string
) {
  if (!fs.existsSync(dir)) return;

  const tasks: ClientMiddlewareTask[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!/\.(ts|js)$/.test(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const moduleUrl = pathToFileURL(fullPath).href;
    try {
      const mod = await import(moduleUrl);
      const handler =
        mod.default || Object.values(mod).find((v) => typeof v === "function");
      if (typeof handler !== "function") continue;

      let route: string | undefined;
      if (/\.cm\.(ts|js)$/.test(entry.name)) {
        route = "/" + entry.name.split(".cm.")[0].toLowerCase();
      }

      const order = typeof mod.order === "number" ? mod.order : 10;

      tasks.push({ handler, route, fileName: entry.name, order });
    } catch (err) {
      console.error(`Failed to load client middleware "${entry.name}":`, err);
    }
  }

  // Sort by order
  tasks.sort((a, b) => a.order - b.order);

  // Register middleware
  app.addHook("preHandler", async (req, reply) => {
    if (req.url?.startsWith("/api") || /\.[a-zA-Z0-9]+$/.test(req.url)) return;

    for (const task of tasks) {
      if (!task.route || task.route === req.url.replace(/\/$/, "")) {
        await task.handler(req, reply);
      }
    }
  });

  console.log(`Loaded ${tasks.length} client middleware(s) from ${dir}`);
}
