import { Component } from "ripple";


export interface Route {
  path: string;
  component: Component;
}

export interface RouterProp {
  routes: Route[];
}