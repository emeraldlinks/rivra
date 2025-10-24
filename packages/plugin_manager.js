    import fs from "fs";
    import path from "path";
    import { pathToFileURL } from "url";

    /**
     * Dynamically registers Fastify plugins.
     * - Global plugins: directly under /plugins
     * - Prefixed plugins: inside subfolders or matching *.pg.ts/js (e.g., auth.pg.ts → /auth)
     */
    export default async function registerPlugins(app, dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
        const prefix = "/" + entry.name.toLowerCase();
        await loadDirPlugins(app, fullPath, prefix);
        continue;
        }

        if (/\.(ts|js)$/.test(entry.name)) {
        await loadSinglePlugin(app, fullPath);
        }
    }
    }

    async function loadDirPlugins(app, dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
        await loadDirPlugins(app, fullPath, prefix + "/" + entry.name.toLowerCase());
        continue;
        }

        if (!/\.(ts|js)$/.test(entry.name)) continue;

        await loadSinglePlugin(app, fullPath, prefix);
    }
    }

    async function loadSinglePlugin(app, filePath, prefix = "") {
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

    if (!prefix && /\.pg\.(ts|js)$/.test(fileName)) {
      const name = fileName.split(".pg.")[0];
      prefix = "/" + name.toLowerCase();
    }

    if (prefix) {
      await app.register(handler, { prefix });
    } else {
      await app.register(handler);
    }

    console.log(`✅ Registered ${prefix ? "prefixed" : "global"} plugin: ${fileName}${prefix ? ` → ${prefix}` : ""}`);
  } catch (err) {
    console.error(`❌ Failed to register plugin "${fileName}":`, err);
  }
}
