import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import fp from "fastify-plugin";

interface PluginTask {
  handler: any;
  prefix?: string;
  order: number;
  isMiddleware: boolean;
  fileName: string;
  route?: string;
}

/**
 * Dynamically loads and registers Fastify plugins and middleware.
 *
 * Supported structures:
 * - Global middleware: /plugins/middleware/*.ts
 * - Route middleware: filename.md.ts → specific to one route (e.g., users.md.ts → /api/users)
 * - Scoped plugins: filename.pg.ts → prefixed plugin (e.g., users.pg.ts → /api/users)
 * - Directory-based prefixes: each subfolder under /plugins becomes an API prefix
 * - Execution order: controlled by `export const order = <number>` (default is 10)
 *
 * Middleware design:
 * - Global middleware (inside /middleware) run for every route.
 * - Route-specific middleware (.md.ts) only run for their target route.
 * - Middleware receive `(req, res, app)` arguments.
 *
 * Plugin design:
 * - Plugins receive `(app)` and are automatically wrapped with `fastify-plugin`
 *   unless they explicitly define `Symbol.for("skipFastifyPluginWrap")`.
 *
 * @param app Fastify application instance
 * @param dir Base directory containing plugin and middleware files
 */
export default async function registerPlugins(app: FastifyInstance, dir: string) {
  if (!fs.existsSync(dir)) return;

  const pluginTasks: PluginTask[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Load global middleware first
  const middlewareDir = path.join(dir, "middleware");
  if (fs.existsSync(middlewareDir) && fs.statSync(middlewareDir).isDirectory()) {
    console.log("Loading global middleware...");
    await collectPlugins(pluginTasks, middlewareDir, undefined, true);
  }

  // Collect plugins and subdirectories recursively
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === "middleware") continue;

    if (entry.isDirectory()) {
      const prefix = "/api/" + entry.name.toLowerCase();
      await collectPlugins(pluginTasks, fullPath, prefix);
      continue;
    }

    if (/\.(ts|js)$/.test(entry.name)) {
      await collectSinglePlugin(pluginTasks, fullPath);
    }
  }

  // Sort all tasks based on the `order` property
  pluginTasks.sort((a, b) => a.order - b.order);

  // Register each plugin or middleware
  for (const task of pluginTasks) {
    if (task.isMiddleware && task.route) {
      // Route-specific middleware (filename.md.ts)
      const route = "/api" + task.route;
      app.addHook("preHandler", async (req, res) => {
        const path = req.raw.url?.replace(/\/$/, "");
        if (path === route) {
          await task.handler(req, res, app);
        }
      });
      console.log(`Route middleware registered: ${task.fileName} → ${route}`);
    } else if (task.isMiddleware && !task.route) {
      // Global middleware (inside /middleware)
      app.addHook("preHandler", async (req, res) => {
        await task.handler(req, res, app);
      });
      console.log(`Middleware registered: ${task.fileName}`);
    } else if (task.prefix) {
      // Scoped plugin (filename.pg.ts or folder plugin)
      let basePrefix = "";
      const apiMatch = dir.match(/\/api(\/[a-zA-Z0-9_-]+)?/);
      if (apiMatch) basePrefix = apiMatch[0];
      const fullPrefix = basePrefix ? basePrefix + task.prefix : task.prefix;
      await app.register(task.handler, { prefix: fullPrefix });
    } else {
      // Global plugin (no prefix)
      await app.register(task.handler);
      console.log(`Plugin registered: ${task.fileName}`);
    }
  }
}

/**
 * Recursively collects plugins and middleware from a directory.
 *
 * Each subfolder automatically adds its name as a prefix,
 * and any `.md.ts` files are recognized as route-specific middleware.
 *
 * @param tasks Array to accumulate plugin or middleware tasks
 * @param dir Directory path to scan
 * @param prefix Optional prefix for plugin routes
 * @param isMiddleware Whether to treat all files in this directory as middleware
 */
async function collectPlugins(
  tasks: PluginTask[],
  dir: string,
  prefix?: string,
  isMiddleware = false
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectPlugins(
        tasks,
        fullPath,
        prefix ? prefix + "/" + entry.name.toLowerCase() : undefined,
        isMiddleware
      );
      continue;
    }

    if (!/\.(ts|js)$/.test(entry.name)) continue;
    await collectSinglePlugin(tasks, fullPath, prefix, isMiddleware);
  }
}

/**
 * Loads a single plugin or middleware file and determines its type.
 *
 * File naming rules:
 * - *.md.ts → route-specific middleware
 * - *.pg.ts → prefixed plugin (scoped to /api/<name>)
 * - any other .ts/.js file → treated as a regular plugin
 *
 * Middleware are not wrapped with `fastify-plugin`, while
 * all regular plugins are wrapped unless they specify otherwise.
 *
 * @param tasks Array to store collected tasks
 * @param filePath Path to the plugin or middleware file
 * @param prefix Optional prefix (used for directory-based plugins)
 * @param isMiddleware Whether this file should be treated as middleware
 */
async function collectSinglePlugin(
  tasks: PluginTask[],
  filePath: string,
  prefix?: string,
  isMiddleware = false
) {
  const fileName = path.basename(filePath);

  try {
    const moduleUrl = pathToFileURL(filePath).href;
    const mod = await import(moduleUrl);

    const handler =
      mod.default ||
      mod.plugin ||
      Object.values(mod).find((v) => typeof v === "function");

    if (typeof handler !== "function") return;

    let route: string | undefined;

    // Route-specific middleware (*.md.ts → /route)
    if (/\.md\.(ts|js)$/.test(fileName)) {
      route = "/" + fileName.split(".md.")[0].toLowerCase();
      isMiddleware = true;
    }

    // Scoped plugin (*.pg.ts → /prefix)
    if (!prefix && /\.pg\.(ts|js)$/.test(fileName)) {
      const name = fileName.split(".pg.")[0];
      prefix = "/api/" + name.toLowerCase();
    }

    const order = typeof mod.order === "number" ? mod.order : 10;

    let wrappedHandler: any;

    if (isMiddleware) {
      // Middleware: only req, reply
      wrappedHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        await handler(req, reply);
      };
    } else {
      // Plugin: inject app
     wrappedHandler = fp(async function (app: FastifyInstance) {

  if (prefix) {
    // Scoped plugin: only trigger under its prefix
    app.addHook("preHandler", async (req, reply) => {
      // Match only routes under the prefix
      if (req.url.startsWith(prefix!)) {
        await handler(req, reply, app);
      }
    });
  } else {
    // Global plugin
    app.addHook("preHandler", async (req, reply) => {
      await handler(req, reply, app);
    });
  }
}, {
  name: fileName.replace(/\.(ts|js)$/, ""),
  fastify: ">=4",
});


    }

    tasks.push({
      handler: wrappedHandler,
      prefix,
      order,
      isMiddleware,
      fileName,
      route,
    });
  } catch (err) {
    console.error(`Failed to load plugin "${fileName}":`, err);
  }
}
