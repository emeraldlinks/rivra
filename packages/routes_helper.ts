import type { FastifyInstance } from "fastify";

export function isServerlessHandler(fn: any) {
  // A serverless handler always takes at least 2 arguments (req, res)
  return fn && typeof fn === "function" && fn.length >= 2;
}

export function isFastifyPlugin(fn: any) {
  // Fastify plugin style takes a single argument (app)
  return fn && typeof fn === "function" && fn.length === 1;
}



export function wrapServerless(app: FastifyInstance, handler: Function, routePath: string) {
  app.all(routePath, async (req, reply) => {
    return handler(req, reply);
  });
}
