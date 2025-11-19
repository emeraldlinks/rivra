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

const file_routing = async () => {
  const targetDir = path.join(process.cwd(), "src");
  const pagesDir = path.join(targetDir, "pages");

  // Ensure src/pages directory exists
  fs.mkdirSync(pagesDir, { recursive: true });

  // --- Write index.ripple ---
  const indexContent = `
import { track } from 'ripple';

export default component Home() {
    let count = track(0);

    <div class=" dark:bg-black dark:text-white" style={\`display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; text-align: center; font-family: sans-serif;\`}>
        <main class="main" style={\`flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;\`}>
            <img src="https://www.ripplejs.com/ripple-logo-horizontal.png" lazy alt="" width={260} style={\`margin-bottom: 2rem;\`} />
            <h1 class="title" style={\`font-size: 2.5rem; margin-bottom: 1rem;\`}>
                {'Welcome to Rivra '}<span class="highlight" style={\`color: #0070f3;\`}>{"Ripple!"}</span>
            </h1>

            <div class="counter" style={\`display: flex; align-items: center; margin: 1rem 0;\`}>
                <button class="counter-btn" style={\`background: #0070f3; color: white; border: none; border-radius: 13px; padding: 0.5rem 1rem; font-size: 1.5rem; cursor: pointer;\`} onClick={() => @count--}>{'–'}</button>
                <span class="count" style={\`margin: 0 1rem; font-size: 1.5rem; font-weight: bold;\`}>{@count}</span>
                <button class="counter-btn" style={\`background: #0070f3; color: white; border: none; border-radius: 13px; padding: 0.5rem 1rem; font-size: 1.5rem; cursor: pointer;\`} onClick={() => @count++}>{'+'}</button>
            </div>

            <p class="description" style={\`margin-top: 1rem; color: #555;\`}>
                {'Get started by editing '}<code class="code" style={\`background: #f5f5f5; padding: 0.2rem 0.5rem; border-radius: 4px;\`}>{"src/App.ripple"}</code>
            </p>

            <div class="grid" style={\`display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem;\`}>
                <a class="card" href="https://ripplejs.com/docs/introduction" target="_blank" style={\`padding: 1.5rem; text-decoration: none; border: 1px solid #eaeaea; border-radius: 10px; transition: 0.3s;\`}>
                    <h2 style={\`margin-bottom: 0.5rem; color: #0070f3;\`}>{'Documentation →'}</h2>
                    <p style={\`color: #555;\`}>{'Learn how to build with Ripple'}</p>
                </a>
                <a class="card" href="https://github.com/trueadm/ripple" target="_blank" style={\`padding: 1.5rem; text-decoration: none; border: 1px solid #eaeaea; border-radius: 10px; transition: 0.3s;\`}>
                    <h2 style={\`margin-bottom: 0.5rem; color: #0070f3;\`}>{'GitHub →'}</h2>
                    <p style={\`color: #555;\`}>{'View the source code'}</p>
                </a>
            </div>
        </main>

        <footer class="footer" style={\`margin-top: 3rem; font-size: 0.9rem; color: #888;\`}>
            <a href="https://ripplejs.com" target="_blank" rel="noopener noreferrer" style={\`text-decoration: none; color: inherit;\`}>
                {'Powered by '}<span class="footer-logo" style={\`color: #0070f3; font-weight: bold;\`}>{"Ripple"}</span>
            </a>
        </footer>

        <style>
            .some-element{
                /* some style here */
            }
        </style>
    </div>
}
`;

  // --- Write notfound.ripple ---
  const notfoundContent = `
import { useRouter, Link } from "rivra/router";

export default component NotFound404() {
  <div class="notfound  dark:!text-white dark:bg-black ">
    <h1 class="error-code">
      {"40"}<span class="last">{"4"}</span>
    </h1>
    <p>{"Oops! The page you are looking for does not exist."}</p>
    <Link href="/" className="button  dark:text-black dark:bg-white bg-black text-white rounded-md p-2 font-bold animate-bounce mt-8">{"Go Home"}</Link>

    <style>
      .error-code {
        font-size: 8rem;
        font-weight: 700;
        margin: 0;
      }
      .error-code::first-letter {
        font-size: 10rem;
        font-weight: 900;
      }
      .error-code .last {
        font-size: 10rem;
        font-weight: 900;
      }
      .notfound {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        text-align: center;
        background-color: #f9f9f9;
        font-family: system-ui, sans-serif;
        padding: 0 20px;
        color: #111;
      }
      .notfound h1 {
        font-size: 8rem;
        margin: 0;
        font-weight: 700;
      }
      .notfound p {
        font-size: 1.5rem;
        margin: 1rem 0;
      }
      .button {
        margin-top: 1.5rem;
        padding: 0.75rem 1.5rem;
        background-color: #111;
        color: #fff;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        transition: background-color 0.2s;
      }
      .button:hover {
        background-color: #333;
      }
    </style>
  </div>
}
`;

  // --- Write App.ripple (always overwrite) ---
  const appContent = `
import { PageRoutes } from "rivra/router";
import { modules } from "./routes";

export component App() {
    <PageRoutes modules={modules} />
}
`;

  fs.writeFileSync(
    path.join(pagesDir, "index.ripple"),
    indexContent.trim(),
    "utf8"
  );
  fs.writeFileSync(
    path.join(pagesDir, "notfound.ripple"),
    notfoundContent.trim(),
    "utf8"
  );
  fs.writeFileSync(
    path.join(targetDir, "App.ripple"),
    appContent.trim(),
    "utf8"
  );

  // --- Write routes.ts ---
  const routesFile = path.join(targetDir, "routes.ts");
  const routesContent = `
// Auto-generated by rivra/router
// @ts-ignore
export const modules = import.meta.glob("/src/pages/**/*.ripple", { eager: true });
`;
  fs.writeFileSync(routesFile, routesContent.trim(), "utf8");

  // --- Create vercel.json ---
  const vercelPath = path.join(process.cwd(), "vercel.json");
  const vercelConfig = {
    rewrites: [{ source: "/(.*)", destination: "/index.html" }],
  };
  fs.writeFileSync(vercelPath, JSON.stringify(vercelConfig, null, 2));

  // console.log(
  //   "✅ Created src/pages/index.ripple, notfound.ripple, App.ripple, routes.ts, and vercel.json"
  // );
};

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
    execSync("npm i rivra@latest", { stdio: "inherit" });

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
      `npx cross-env NODE_NO_WARNINGS=1 NODE_OPTIONS="--no-deprecation" npx nodemon --watch api --watch plugins --ext ts,js --exec "node --loader ts-node/esm server.ts"`,
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
    execSync("vite build && tsc -p tsconfig.build.json", {
      stdio: "inherit",
    });
  } catch (err: any) {
    console.error("Build failed: ", err.message?.toString());
    process.exit(1);
  }
}

/** START COMMAND */
async function startApp() {
  console.log("Starting Rivra app...");
  try {
    execSync(`NODE_ENV=production node dist/server.js`, {
      stdio: "inherit",
    });
  } catch (err: any) {
    console.error("Failed to start app:", err.message);
    process.exit(1);
  }
}

/** INIT COMMAND */
async function initApp() {
  console.log("Initializing Ripple Tools (Full-stack mode)...");

  try {
    await file_routing();
  } catch (err: any) {
    console.error("Failed to run complete:", err.message);
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
import { StartServer, RivraHandler } from "rivra/server";

(async () => {
  const app = await StartServer();
   app.start();
})();


export default RivraHandler;
`;
  fs.writeFileSync(indexPath, indexContent.trim() + "\n");

  const apiContent = `
import type { Req, Reply } from "rivra"

export default async function handler(req: Req, res: Reply) {
  if (req.method !== "GET") return res.status(405).send({ message: "Method not allowed" });
  res.status(200).send({ hello: "serverless" });
}
`;
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

export default async function(app: App) {

  // await app.register(cookie, {
  //   secret: "my-secret-key",
  //   parseOptions: {},
  // });
  app.addHook("onRequest", async (req, reply) => {
    console.log("Incoming URL:", req.raw.url);
    reply.header('X-Powered-By', 'Rivra');
    console.log("Cookies:", req.cookies); // Now safe
  });
  app.decorateRequest("user", null);
}

// plugins/some_plugin.ts -> global plugin (all routes)
// plugins/auth.pg.ts -> plugin -> api/auth
// plugins/auth.md.ts -> middleware -> api/auth
// plugins/users/index.ts -> plugin -> api/users
// plugins/users/users.md.ts -> middleware -> api/users
// You can also access "app" for shared logic

`;
  fs.writeFileSync(pluginPath, pluginContent.trim() + "\n");

  const middlewareContent = `
import type {Req, Reply } from "rivra"


export default function (req: Req, res: Reply) {
  console.log("Incoming:", req.method, req.url);
  
  const truthy = true
  if (!truthy) {
    res.code(400).send({error: "Bad request"})
    return
  }
  if (req.url === "/api/blocked") {
    res.code(403).send({ error: "Forbidden" });
    return;
  }

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
    include: ["index.ts", "api/**/*.ts", "server.ts", "plugins", "src"],
    exclude: ["node_modules", "dist", "src/**/*.ripple", "src/pages"],
    compilerOptions: { noEmit: false, outDir: "dist" },
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
  execSync("npm install fastify @fastify/middie get-port vite", {
    stdio: "inherit",
  });
  execSync("npm install ts-node @types/connect cross-env -D", {
    stdio: "inherit",
  });

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
