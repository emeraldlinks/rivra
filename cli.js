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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
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
  if (args[0] === "dev") {
    console.log("starting dev server");
    execSync(
      'npx nodemon --watch packages --ext ts,js --exec "npx ts-node --esm src/packages/server.ts"',
      { stdio: "inherit" }
    );
  }

  if (args[0] === "init") {
    console.log("Initializing Ripple Tools Full...");

    try {
      console.log("Running `npx ripple-file-router init`...");
      execSync("npx ripple-file-router init --y", { stdio: "inherit" });
      console.log("ripple-file-router initialized successfully!");
    } catch (err) {
      console.error("Failed to run ripple-file-router init:", err.message);
      process.exit(1);
    }

    const projectDir = process.cwd();
    const srcDir = path.join(projectDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    const fullStack = await askQuestion(
      "Enable full-stack mode (Fastify + Vite)? (y/n): "
    );
    if (fullStack.toLowerCase() !== "y") {
      console.log("Ripple project initialized (frontend only).");
      process.exit(0);
    }

    console.log("Setting up full-stack mode...");

    const indexPath = path.join(projectDir, "server.ts");
    const nodemonPath = path.join(projectDir, "nodemon.json");
    const serverDir = path.join(projectDir, "api");
    const apiPath = path.join(serverDir, "index.ts");
    const rootPlugin = path.join(projectDir, "plugins");
    const pluginPath = path.join(rootPlugin, "global.ts");
    const middlewarDir = path.join(rootPlugin, "middlware");
    const middlewarePath = path.join(middlewarDir, "middleware.ts");

    fs.mkdirSync(serverDir, { recursive: true });
    fs.mkdirSync(rootPlugin, { recursive: true });
    fs.mkdirSync(middlewarDir, { recursive: true });

    const indexContent = `
    import { StartServer } from "rivra/server"

    (async () => {
      const app = await StartServer();
      // app.register(...) // register plugins and add custom instance behaviours.
    })();`;

    fs.writeFileSync(indexPath, indexContent);
    console.log("index.ts created");

    const apiContent = `
        import type { App, Req, Reply } from "rivra"

        export default async function registerApi(app: App) { 
          app.get("/", async (req: Req, reply: Reply) => {
            return { message: "Hello from Ripple full-stack!" }
          })
        }`;
    fs.writeFileSync(apiPath, apiContent);
    console.log("api/index.ts created");

    const nodemonContent = `
  {
    "watch": ["index.ts", "api/**/*"],
    "ext": "ts,js",
    "ignore": ["node_modules"],
    "exec": "ts-node --esm server.ts"
  }`;
    fs.writeFileSync(nodemonPath, nodemonContent);

    const pluginContent = `
import type { App, Req, Reply } from "rivra"

  export default async function (app: App) {
  app.addHook('preHandler', async (req: Req, reply: Reply) => {
    console.log(req.originalUrl)
    if (req.originalUrl === "/protected") {
      console.log("protected route")
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
    fs.writeFileSync(pluginPath, pluginContent);

    const middlewareContent = `
import type { App, Req, Reply } from "rivra"

export default async function (app: App) {
  app.addHook('preHandler', async (req: Req, reply: Reply) => {
    console.log('Middleware triggered:', req.url);
  });
}
// plugins/middlware/some_middleware.ts -> global middleware (all routes)
// plugins/auth.pg.ts -> plugin -> api/auth
// plugins/auth.md.ts -> middleware -> api/auth
// plugins/users/index.ts -> plugin -> api/users
// plugins/users/users.md.ts -> middleware -> api/users
    `;
    fs.writeFileSync(middlewarePath, middlewareContent);

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
    console.log("tsconfig.json created");

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
    console.log("tsconfig.build.json created");

    const pkgPath = path.join(projectDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.start = "node dist/server/index.js";
    pkg.scripts.dev =
      "npx nodemon --watch api --watch plugins --ext ts,js --exec 'ts-node --esm' server.ts";
    pkg.scripts.build = "vite build && tsc -p tsconfig.build.json";
    pkg.scripts.serve = "vite preview";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log("package.json updated");

    console.log("Installing dependencies...");
    execSync(
      "npm install fastify @fastify/middie ripple-file-router get-port vite",
      { stdio: "inherit" }
    );
    execSync("npm install ts-node @types/connect -D", { stdio: "inherit" });
    console.log("Dependencies installed");

    console.log("Ripple Tools Full initialized successfully (Full-stack mode)!");
  } else {
    console.log("Unknown command. Use `rivra init` or `rivra dev`");
    process.exit(1);
  }
}

main();
