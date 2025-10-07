import { Component } from "ripple";


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
