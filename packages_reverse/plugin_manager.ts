import type { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
// import fp from "fastify-plugin";

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
export default async function registerPlugins(
  app: FastifyInstance,
  dir: string
) {
  if (!fs.existsSync(dir)) return;

  // All collected tasks (plugins + middleware)
  const pluginTasks: {
    handler: any;
    prefix?: string;
    order: number;
    isMiddleware: boolean;
    fileName: string;
  }[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // 🔹 1. Load global middleware first (if any)
  const middlewareDir = path.join(dir, "middleware");
  if (
    fs.existsSync(middlewareDir) &&
    fs.statSync(middlewareDir).isDirectory()
  ) {
    console.log("⚙️ Loading global middleware...");
    await collectPlugins(pluginTasks, middlewareDir, undefined, true);
  }

  // 🔹 2. Collect all other plugins and route middleware
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === "middleware") continue; // Skip global middleware dir

    if (entry.isDirectory()) {
      const prefix = "/" + entry.name.toLowerCase();
      await collectPlugins(pluginTasks, fullPath, prefix);
      continue;
    }

    if (/\.(ts|js)$/.test(entry.name)) {
      await collectSinglePlugin(pluginTasks, fullPath);
    }
  }

  // 🔹 3. Sort by `order` and register in sequence
  pluginTasks.sort((a, b) => a.order - b.order);

  for (const task of pluginTasks) {
    if (task.prefix) {
      await app.register(task.handler, { prefix: task.prefix });
    } else {
      await app.register(task.handler);
    }

    console.log(
      `${task.isMiddleware ? "🧩 Middleware" : "✅ Plugin"} registered: ${
        task.fileName
      }${task.prefix ? ` → ${task.prefix}` : ""} (order: ${task.order})`
    );
  }
}

/** Recursively collect plugins for ordered registration */
async function collectPlugins(
  tasks: any[],
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

/** Collect a single plugin or middleware */
async function collectSinglePlugin(
  tasks: any[],
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

    if (typeof handler !== "function") {
      console.warn(`⚠️ Skipped ${fileName}: no valid export.`);
      return;
    }

    // Detect prefix patterns
    if (!prefix && /\.pg\.(ts|js)$/.test(fileName)) {
      const name = fileName.split(".pg.")[0];
      prefix = "/" + name.toLowerCase();
    }

    // Detect route-specific middleware
    if (/\.md\.(ts|js)$/.test(fileName)) {
      const name = fileName.split(".md.")[0];
      prefix = prefix || "/" + name.toLowerCase();
      isMiddleware = true;
    }

    // Determine execution order (default = 10)
    const order = typeof mod.order === "number" ? mod.order : 10;

    // Add to registration queue
    let wrappedHandler = handler;
   if (typeof handler === "function" && !handler[Symbol.for('skipFastifyPluginWrap')]) {
  try {
    const fp = (await import("fastify-plugin")).default;
    wrappedHandler = fp(handler, {
      name: fileName.replace(/\.(ts|js)$/, ""),
      fastify: ">=4",
    });
  } catch (e) {
    console.warn(`⚠️ Failed to wrap ${fileName} with fastify-plugin:`, e);
  }
}


    // Add to registration queue
    tasks.push({
      handler: wrappedHandler,
      prefix,
      order,
      isMiddleware,
      fileName,
    });
  } catch (err) {
    console.error(`❌ Failed to load plugin "${fileName}":`, err);
  }
}
