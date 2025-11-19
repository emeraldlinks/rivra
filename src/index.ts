// export * from "./createFileRoutes";
export * from "./types";
export * from "./stores";
export * from "./router"



import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";

export type Req = FastifyRequest & Record<string, any>;
export type Reply = FastifyReply & Record<string, any>;
export type App = FastifyInstance & Record<string, any>;

