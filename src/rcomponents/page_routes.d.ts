// page_routes.ripple.d.ts
import type { Component } from "ripple"; // if needed

declare module "./rcomponents/page_routes.ripple" {
  export default function PageRoutes(
    modules?: any,
    enableLoader?: boolean,
  ): void;
}


  export declare function PageRoutes(
    modules?: any,
    enableLoader?: boolean,
  ): void;