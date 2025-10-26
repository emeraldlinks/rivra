#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = process.argv.slice(2);

/** Prompt user input */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

/** Recursively copy files/directories */
function copyRecursive(src: string, dest: string) {
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

/** CREATE COMMAND */
async function createApp() {
  let appName = args[1] || "";
  if (!appName) {
    appName = await askQuestion("Enter project name: ");
  }

  console.log(`Creating Rivra app ${appName}...`);
  try { 
    execSync(`npm create ripple --y ${appName}`, { stdio: "inherit" });
    process.chdir(appName);

    console.log("Installing dependencies...");
    execSync("npm install", { stdio: "inherit" });
    
    await initApp();
  } catch (err: any) {
    console.error("Failed to create Rivra app:", err.message);
    process.exit(1);
  }
}

/** DEV COMMAND */
async function startDev() {
  console.log("Starting Rivra development server...");
  try {
    execSync(
      `npx nodemon --watch api --watch plugins --ext ts,js --exec 'ts-node --esm server.ts'`,
      { stdio: "inherit" }
    );
  } catch (err: any) {
    console.error("Dev server failed:", err.message);
    process.exit(1);
  }
}

/** BUILD COMMAND */
async function buildApp() {
  console.log("Building Rivra app...");
  try {
    execSync("npx vite build && tsc -p tsconfig.build.json", {
      stdio: "inherit",
    });
  } catch (err: any) {
    console.error("Build failed:", err.message);
    process.exit(1);
  }
}

/** START COMMAND */
async function startApp() {
  console.log("Starting Rivra app...");
  try {
    execSync(`NODE_ENV=production node dist/server/server.js`, { stdio: "inherit" });
  } catch (err: any) {
    console.error("Failed to start app:", err.message);
    process.exit(1);
  }
}

/** INIT COMMAND */
async function initApp() {
  console.log("Initializing Ripple Tools (Full-stack mode)...");

  try {
    console.log("Running `npx ripple-file-router init`...");
    execSync("npx ripple-file-router init --yes", { stdio: "inherit" });
    console.log("ripple-file-router initialized successfully!");
  } catch (err: any) {
    console.error("Failed to run ripple-file-router init:", err.message);
    process.exit(1);
  }

  const projectDir = process.cwd();
  const srcDir = path.join(projectDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  const enableFullStack = await askQuestion(
    "Enable full-stack mode (Fastify + Vite)? (y/n): "
  );

  if (enableFullStack.toLowerCase() !== "y") {
    console.log("Ripple project initialized (frontend only).");
    return;
  }

  console.log("Setting up full-stack mode...");

  const indexPath = path.join(projectDir, "server.ts");
  const nodemonPath = path.join(projectDir, "nodemon.json");
  const serverDir = path.join(projectDir, "api");
  const apiPath = path.join(serverDir, "index.ts");
  const rootPlugin = path.join(projectDir, "plugins");
  const pluginPath = path.join(rootPlugin, "global.ts");
  const middlewareDir = path.join(rootPlugin, "middleware");
  const middlewarePath = path.join(middlewareDir, "middleware.ts");

  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(rootPlugin, { recursive: true });
  fs.mkdirSync(middlewareDir, { recursive: true });

  const indexContent = `
import { StartServer } from "rivra/server"

(async () => {
  const app = await StartServer();
  // app.register(...) // register plugins and add custom instance behaviours.
})();`;
  fs.writeFileSync(indexPath, indexContent.trim() + "\n");

  const apiContent = `
import type { App, Req, Reply } from "rivra"

export default async function registerApi(app: App) { 
  app.get("/", async (req: Req, reply: Reply) => {
    return { message: "Hello from Ripple full-stack!" }
  })
}`;
  fs.writeFileSync(apiPath, apiContent.trim() + "\n");

  const nodemonContent = `
{
  "watch": ["index.ts", "api/**/*"],
  "ext": "ts,js",
  "ignore": ["node_modules"],
  "exec": "ts-node --esm server.ts"
}`;
  fs.writeFileSync(nodemonPath, nodemonContent.trim() + "\n");

  const pluginContent = `
import type { App, Req, Reply } from "rivra"

export default async function (app: App) {
  app.addHook('preHandler', async (req: Req, reply: Reply) => {
    console.log(req.originalUrl)
    if (req.originalUrl === "/protected") {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}

// plugins/some_plugin.ts -> global plugin (all routes)
// plugins/auth.pg.ts -> plugin -> api/auth
// plugins/auth.md.ts -> middleware -> api/auth
// plugins/users/index.ts -> plugin -> api/users
// plugins/users/users.md.ts -> middleware -> api/users
`;
  fs.writeFileSync(pluginPath, pluginContent.trim() + "\n");

  const middlewareContent = `
import type { App, Req, Reply } from "rivra"

export default async function (app: App) {
  app.addHook('preHandler', async (req: Req, reply: Reply) => {
    console.log('Middleware triggered:', req.url);
  });
}

// plugins/middleware/some_middleware.ts -> global middleware (all routes)
// plugins/auth.pg.ts -> plugin -> api/auth
// plugins/auth.md.ts -> middleware -> api/auth
// plugins/users/index.ts -> plugin -> api/users
// plugins/users/users.md.ts -> middleware -> api/users
`;
  fs.writeFileSync(middlewarePath, middlewareContent.trim() + "\n");

  // tsconfig setup
  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "NodeNext",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      moduleResolution: "nodenext",
      jsx: "preserve",
      jsxImportSource: "ripple",
      noEmit: true,
      isolatedModules: true,
      types: ["node"],
      allowImportingTsExtensions: false,
      skipLibCheck: true,
      noEmitOnError: false,
    },
  };
  fs.writeFileSync(
    path.join(projectDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );

  const tsBuild = {
    extends: "./tsconfig.json",
    include: ["index.ts", "api/**/*.ts"],
    exclude: ["node_modules", "dist", "src/**/*.ripple", "src/pages"],
    compilerOptions: { noEmit: false, outDir: "dist/server" },
  };
  fs.writeFileSync(
    path.join(projectDir, "tsconfig.build.json"),
    JSON.stringify(tsBuild, null, 2)
  );

  // update package.json
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.scripts = {
    ...pkg.scripts,
    dev: "npx rivra dev",
    build: "npx rivra build",
    start: "npx rivra start",
    serve: "vite preview",
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  console.log("Installing dependencies...");
  execSync(
    "npm install fastify @fastify/middie ripple-file-router get-port vite",
    { stdio: "inherit" }
  );
  execSync("npm install ts-node @types/connect -D", { stdio: "inherit" });

  console.log(`
Rivra full-stack initialized successfully!

Next steps:
  npm run dev   # start development server
  npm run build # build for production
  npm start     # run production build
`);
}

/** CLI Router */
async function main() {
  switch (args[0]) {
    case "create":
      await createApp();
      break;
    case "init":
      await initApp();
      break;
    case "dev":
      await startDev();
      break;
    case "build":
      await buildApp();
      break;
    case "start":
      await startApp();
      break;
    default:
      console.log(`
Usage: rivra <command>

Commands:
  create <name>   Create a new Rivra app
  init            Initialize Rivra (full-stack mode)
  dev             Start development server
  build           Build project for production
  start           Run built app
`);
  }
}

main();
