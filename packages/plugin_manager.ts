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
  isFastifyPlugin: boolean;
  fileName: string;
  route?: string;
}

/**
 * Dynamically loads and registers Fastify plugins and middleware.
 */
export default async function registerPlugins(
  app: FastifyInstance,
  dir: string
) {
  if (!fs.existsSync(dir)) return;

  const pluginTasks: PluginTask[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Load global middleware first
  const middlewareDir = path.join(dir, "middleware");
  if (
    fs.existsSync(middlewareDir) &&
    fs.statSync(middlewareDir).isDirectory()
  ) {
    console.log("Loading global middleware...");
    await collectPlugins(pluginTasks, middlewareDir, undefined, true);
  }

  // Collect normal plugins and subdirectories
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

  // Sort by order
  pluginTasks.sort((a, b) => a.order - b.order);

  // Register each plugin properly
  for (const task of pluginTasks) {
    // When registering middleware in plugin manager:
    if (task.isMiddleware) {
      if (task.route) {
        // Route-specific middleware
        const route = "/api" + task.route;
        app.addHook("preHandler", async (req, res) => {
          const path = req.raw.url?.replace(/\/$/, "");
          if (path === route) await task.handler(req, res); // <- call like old
        });
        console.log(`Route middleware registered: ${task.fileName} → ${route}`);
      } else {
        // Global middleware
        app.addHook("preHandler", async (req, res) => {
          await task.handler(req, res); // <- call exactly like old
        });
        console.log(`Middleware registered: ${task.fileName}`);
      }
    } else if (task.isMiddleware && !task.route) {
      app.addHook("preHandler", async (req, res) => {
        await task.handler(req, res, app);
      });
      console.log(`Middleware registered: ${task.fileName}`);
    } else if (task.isFastifyPlugin) {
      // Real Fastify plugin (e.g. cookie, CORS)
      await app.register(task.handler, { prefix: task.prefix });
      console.log(`Fastify plugin registered: ${task.fileName}`);
    } else if (task.prefix) {
      // Scoped logic plugin
      await app.register(task.handler, { prefix: task.prefix });
      console.log(`Scoped plugin registered: ${task.fileName}`);
    } else {
      // Global logic plugin
      await app.register(task.handler);
      console.log(`Global plugin registered: ${task.fileName}`);
    }
  }
}

/** Recursively collect plugin files */
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

/** Detect plugin/middleware type */
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
    let isFastifyPlugin = false;

    // Route middleware (*.md.ts)
    if (/\.md\.(ts|js)$/.test(fileName)) {
      route = "/" + fileName.split(".md.")[0].toLowerCase();
      isMiddleware = true;
    }

    // Scoped plugin (*.pg.ts)
    if (!prefix && /\.pg\.(ts|js)$/.test(fileName)) {
      const name = fileName.split(".pg.")[0];
      prefix = "/api/" + name.toLowerCase();
    }

    const order = typeof mod.order === "number" ? mod.order : 10;

    let wrappedHandler: any;

    if (isMiddleware) {
      // Simple middleware
      wrappedHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        await handler(req, reply);
      };
    } else {
      // Distinguish between app plugins and fastify-native plugins
      const argCount = handler.length;
      if (argCount === 1) {
        // Fastify-style plugin: (app)
        isFastifyPlugin = true;
        wrappedHandler = fp(handler, {
          name: fileName.replace(/\.(ts|js)$/, ""),
          fastify: ">=4",
        });
      } else {
        // Logic plugin: (req, res, app)
        wrappedHandler = fp(async function (app: FastifyInstance) {
          app.addHook("preHandler", async (req, reply) => {
            await handler(req, reply, app);
          });
        });
      }
    }

    tasks.push({
      handler: wrappedHandler,
      prefix,
      order,
      isMiddleware,
      isFastifyPlugin,
      fileName,
      route,
    });
  } catch (err) {
    console.error(`Failed to load plugin "${fileName}":`, err);
  }
}
