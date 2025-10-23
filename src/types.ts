import { Component } from "ripple";
import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";



export type Req = FastifyRequest;
export type Reply = FastifyReply;
export type App = FastifyInstance;

export interface Route {
  path: string;
  component: Component;
}

export interface RouterProp {
  routes: Route[];
}

export interface LinkProps {
  href: string;
  children: Component;
  onLoading?: () => void;
  emitEvent?: boolean;
  loadingComponent?: Component;
  className?: string;
  queries?: Record<string, string | number | boolean>;
}
