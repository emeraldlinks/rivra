declare module "rivra" {
import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";
  import type { Component } from "ripple";

  export interface LinkProps {
    href: string;
    className?: string;
    onLoading?: () => void;
    loadingComponent?: Component<any>;
    emitEvent?: boolean;
    children?: any;
    queries?: Record<string, string | number | boolean>;
  }

  export const Link: Component<LinkProps>;
  export const Router: Component<any>;
  export const PageRoutes: Component<any>;
  export type Req = FastifyRequest;
export type Reply = FastifyReply;
export type App = FastifyInstance;
}
