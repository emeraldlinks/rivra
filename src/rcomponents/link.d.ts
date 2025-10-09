import type { Component } from "ripple";

declare module "./rcomponents/link.ripple" {
  export default function Link(
    href: string,
    children: Component,
    emitEvent?: boolean,
    onLoading?: () => void,
    loadingComponent?: Component,
    className?: string,
    queries?: Record<string, string | number | boolean>
  ): void;
}


 export declare function Link(
    href: string,
    children: Component,
    emitEvent?: boolean,
    onLoading?: () => void,
    loadingComponent?: Component,
    className?: string,
    queries?: Record<string, string | number | boolean>
  ): void;