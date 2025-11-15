import Fastify from "fastify";
import fastifyMiddie from "@fastify/middie";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { executeServerFunction } from "ripple/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();

const rpc_modules = new Map();

async function getRequestBody(req: any) {
  return new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function StartServer() {
  const app = Fastify({ logger: true });

  await app.register(fastifyMiddie);

  const vite = await createViteServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'custom',
  });

  // Use Vite as middleware
  app.use((req, res, next) => {
    vite.middlewares(req, res, next);
  });

  // SSR route
  app.all("/*", async (req, reply) => {
    try {
      // Handle RPC requests
      if (req.raw.url?.startsWith('/_$_ripple_rpc_$_/')) {
        const hash = req.raw.url.slice('/_$_ripple_rpc_$_/'.length);
        const module_info = rpc_modules.get(hash);

        if (!module_info) {
          reply.status(500).send('RPC module not found');
          return;
        }

        const file_path = module_info[0];
        const func_name = module_info[1];
        const { _$_server_$_: server } = await vite.ssrLoadModule(file_path);
        const rpc_arguments = await getRequestBody(req.raw);
        const result = await executeServerFunction(server[func_name], rpc_arguments);
        reply.type("application/json").send(result);
        return;
      }

      // SSR HTML
      let template = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(req.raw.url!, template);

      const { render, get_css_for_hashes } = await vite.ssrLoadModule('ripple/server');
      const { App } = await vite.ssrLoadModule('/src/App.ripple');
      const { head, body, css } = await render(App);

      let css_tags = '';
      if (css.size > 0) {
        const css_content = get_css_for_hashes(css);
        if (css_content) css_tags = `<style data-ripple-ssr>${css_content}</style>`;
      }

      const html = template
        .replace('<!--ssr-head-->', head + css_tags)
        .replace('<!--ssr-body-->', body);

      reply.type('text/html').send(html);

    } catch (err) {
      console.error('SSR Error:', err);
    //   reply.status(500).send(String(err.stack || err));
    }
  });

  const port = 3000;
  app.listen({ port }, () => console.log(`🚀 Fastify + Vite SSR running at http://localhost:${port}`));
}

export default StartServer;
StartServer()