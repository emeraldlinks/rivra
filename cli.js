#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = process.argv.slice(2);

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  if (args[0] !== "init") {
    console.log("❌ Unknown command. Use `ripple-tools-full init`");
    process.exit(1);
  }

  console.log("⚡ Initializing Ripple Tools Full...");

  // ---------------------------------------------
  // STEP 1 — Run ripple-file-router init automatically
  // ---------------------------------------------
  try {
    console.log("📦 Running `npx ripple-file-router init`...");
    execSync("npx ripple-file-router init", { stdio: "inherit" });
    console.log("✅ ripple-file-router initialized successfully!");
  } catch (err) {
    console.error("❌ Failed to run ripple-file-router init:", err.message);
    process.exit(1);
  }

  // ---------------------------------------------
  // STEP 2 — Continue full-stack setup
  // ---------------------------------------------
  const projectDir = process.cwd();
  const srcDir = path.join(projectDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  const fullStack = await askQuestion("Enable full-stack mode (Fastify + Vite)? (y/n): ");
  if (fullStack.toLowerCase() !== "y") {
    console.log("✅ Ripple project initialized (frontend only).");
    process.exit(0);
  }

  console.log("⚙️ Setting up full-stack mode...");

  const indexPath = path.join(projectDir, "index.ts");
  const serverDir = path.join(projectDir, "api");
  const apiPath = path.join(serverDir, "index.ts");
  fs.mkdirSync(serverDir, { recursive: true });

  // index.ts — Full-stack Dev Server
  const indexContent = `import Fastify from "fastify";
import fastifyMiddie from "@fastify/middie";
import { createServer as createViteServer } from "vite";
import { pathToFileURL, fileURLToPath } from "url";
import fs from "fs";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, "api");

async function registerApiRoutes(app, dir, prefix = "") {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await registerApiRoutes(app, fullPath, \`\${prefix}/\${file}\`);
      continue;
    }

    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

    let routePath = prefix + "/" + file.replace(/\\.(ts|js)$/, "");
    if (file.startsWith("index.")) routePath = prefix || "/";
    routePath = routePath.replace(/\\[([^\\]]+)\\]/g, ":$1");

    const moduleUrl = pathToFileURL(fullPath).href + \`?t=\${Date.now()}\`;
    const mod = await import(moduleUrl);
    const handler = mod.default || Object.values(mod)[0];

    if (typeof handler === "function") {
      app.register(async (fastify) => await handler(fastify), { prefix: \`/api\${routePath}\` });
      console.log(\`✅ Loaded route: /api\${routePath}\`);
    }
  }
}

async function start() {
  const app = Fastify({ ignoreTrailingSlash: true });
  await app.register(fastifyMiddie);

  await registerApiRoutes(app, apiDir);

  const vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true, hmr: { port: 24678 } },
  });

  app.use((req, res, next) => {
    if (req.url.startsWith("/api")) return next();
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
    console.log(\`🚀 Ripple Full-Stack Dev running on \${address}\`);
    console.log(app.printRoutes());
  });
}

start();`;

  fs.writeFileSync(indexPath, indexContent);
  console.log("✅ index.ts created");

  // api/index.ts
  const apiContent = `export default async function registerApi(app) {
  app.get("/", async () => ({ message: "Hello from Ripple full-stack!" }));
}`;
  fs.writeFileSync(apiPath, apiContent);
  console.log("✅ api/index.ts created");

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      moduleResolution: "node",
      jsx: "preserve",
      jsxImportSource: "ripple",
      noEmit: true,
      isolatedModules: true,
      types: ["node"],
      allowImportingTsExtensions: true,
    },
  };
  fs.writeFileSync(path.join(projectDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  console.log("✅ tsconfig.json created");

  // tsconfig.build.json
  const tsBuild = {
    extends: "./tsconfig.json",
    include: ["index.ts", "api/**/*.ts"],
    exclude: ["node_modules", "dist", "src/**/*.ripple", "src/pages"],
    compilerOptions: { noEmit: false, outDir: "dist/server" },
  };
  fs.writeFileSync(path.join(projectDir, "tsconfig.build.json"), JSON.stringify(tsBuild, null, 2));
  console.log("✅ tsconfig.build.json created");

  // Update package.json scripts
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.start = "vite";
  pkg.scripts.dev = "ts-node --esm index.ts";
  pkg.scripts.build = "vite build && tsc -p tsconfig.build.json";
  pkg.scripts.serve = "vite preview";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log("✅ package.json updated");

  // Install dependencies
  console.log("📦 Installing dependencies...");
  execSync("npm install fastify @fastify/middie ripple-file-router get-port vite ts-node -D", { stdio: "inherit" });
  console.log("✅ Dependencies installed");

  console.log("🎉 Ripple Tools Full initialized successfully (Full-stack mode)!");
}

main();
