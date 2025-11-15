import type { Component } from "ripple";
import type { Route } from "./types";



let NotFoundComponent: Component;


export function createFileRoutes(modules: any[]): Route[] {
  // @ts-ignore
  ///const modules = import.meta.glob("/src/pages/**/*.ripple", { eager: true });
 NotFoundComponent = modules["/src/pages/notfound.ripple"]?.default

  const routes: Route[] = Object.entries(modules).map(([file, mod]) => {
    const path = file
      .replace("/src/pages", "")
      .replace(/index\.ripple$/, "")
      .replace(/\.ripple$/, "")
      .replace(/\[(.+?)\]/g, ":$1");

    return {
      path: path || "/",
      component: (mod as { default: Component }).default,
    };
  });

  routes.push({ path: "*", component: NotFoundComponent });
  return routes;
}

