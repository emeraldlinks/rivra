import type { FastifyInstance } from "fastify";
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
 * Dynamically registers Fastify plugins, middleware, and route-specific logic.
 *
 * Features:
 * - Global middleware: /plugins/middleware/
 * - Route middleware: *.md.ts/js → route-specific middleware
 * - Prefixed plugins: *.pg.ts/js → /name prefix
 * - Folder-based plugins: auto-prefixed by folder name
 * - Order control: export const order = <number>
 */
export default async function registerPlugins(app: FastifyInstance, dir: string) {
  if (!fs.existsSync(dir)) return;

  const pluginTasks: PluginTask[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // 1. Load global middleware first
  const middlewareDir = path.join(dir, "middleware");
  if (fs.existsSync(middlewareDir) && fs.statSync(middlewareDir).isDirectory()) {
    console.log("Loading global middleware...");
    await collectPlugins(pluginTasks, middlewareDir, undefined, true);
  }

  // 2. Collect other plugins
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === "middleware") continue;

    if (entry.isDirectory()) {
      const prefix = "/" + entry.name.toLowerCase();
      await collectPlugins(pluginTasks, fullPath, prefix);
      continue;
    }

    if (/\.(ts|js)$/.test(entry.name)) {
      await collectSinglePlugin(pluginTasks, fullPath);
    }
  }

  // 3. Sort by order
  pluginTasks.sort((a, b) => a.order - b.order);

  // 4. Register plugins and route-specific middleware
  for (const task of pluginTasks) {
    if ((task.isMiddleware && task.route) || task.prefix) {
      // Scoped registration: route-specific middleware or pg plugin
      const scopedPrefix = task.route || task.prefix;
      await app.register(async (instance) => {
        if (task.isMiddleware) {
          instance.addHook("preHandler", task.handler);
        } else {
          await instance.register(task.handler);
        }
      }, { prefix: scopedPrefix });

      console.log(`${task.isMiddleware ? "Route middleware" : "Scoped plugin"} registered: ${task.fileName} → ${scopedPrefix}`);
    } else {
      // Global registration
      await app.register(task.handler);
      console.log(`Plugin registered: ${task.fileName}`);
    }
  }
}

async function collectPlugins(tasks: PluginTask[], dir: string, prefix?: string, isMiddleware = false) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectPlugins(tasks, fullPath, prefix ? prefix + "/" + entry.name.toLowerCase() : undefined, isMiddleware);
      continue;
    }

    if (!/\.(ts|js)$/.test(entry.name)) continue;

    await collectSinglePlugin(tasks, fullPath, prefix, isMiddleware);
  }
}

async function collectSinglePlugin(tasks: PluginTask[], filePath: string, prefix?: string, isMiddleware = false) {
  const fileName = path.basename(filePath);

  try {
    const moduleUrl = pathToFileURL(filePath).href;
    const mod = await import(moduleUrl);

    const handler = mod.default || mod.plugin || Object.values(mod).find((v) => typeof v === "function");
    if (typeof handler !== "function") return;

    let route: string | undefined;

    // Route-specific middleware detection
    if (/\.md\.(ts|js)$/.test(fileName)) {
      route = "/" + fileName.split(".md.")[0].toLowerCase();
      isMiddleware = true;
    }

    // Prefixed plugin detection
    if (!prefix && /\.pg\.(ts|js)$/.test(fileName)) {
      const name = fileName.split(".pg.")[0];
      prefix = "/" + name.toLowerCase();
    }

    const order = typeof mod.order === "number" ? mod.order : 10;

    let wrappedHandler = handler;
    if (!handler[Symbol.for("skipFastifyPluginWrap")]) {
      wrappedHandler = fp(handler, { name: fileName.replace(/\.(ts|js)$/, ""), fastify: ">=4" });
    }
    console.log(route)
    tasks.push({ handler: wrappedHandler, prefix, order, isMiddleware, fileName, route });
  } catch (err) {
    console.error(`Failed to load plugin "${fileName}":`, err);
  }
}
