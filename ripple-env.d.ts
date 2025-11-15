
declare module "*.ripple" {
  import type { Component } from "ripple";

  // mimic a JSX-like component type with prop inference
  const component: <P = Record<string, any>>(props: P) => ReturnType<Component>;
  export default component;
}
