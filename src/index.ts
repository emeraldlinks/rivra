export * from "./createFileRoutes";
export * from "./userouter";
export * from "./types";
export * from "./store";
export * from "./stores"


import _Link from "./rcomponents/link.ripple";
import _PageRoutes from "./rcomponents/page_routes.ripple";
import _Router  from "./rcomponents/router.ripple";

import type { Component } from "ripple";


export const Router = _Router as unknown as (
    props: {
        routes: any
    }
) => void






/**
 * A navigation component for client-side routing.
 *
 * @param {string} href - The URL path to navigate to.
 * @param {Component} children - The content to render inside the link.
 * @param {() => void} [onLoading] - Optional callback triggered when navigation starts.
 * @param {string} [className] - Additional class names for styling.
 * @param {Component} [loadingComponent] - Optional component to display while loading.
 * @param {boolean} [emitEvent=true] - Whether to emit route events during navigation.
 * @param {Record<string, string | number | boolean>} [queries] - Optional query parameters for URLSearch.
 *
 * @example
 * <Link href="/dashboard" onLoading={() => console.log('Loading...')}>
 *   <span>Go to Dashboard</span>
 * </Link>
 */
export const Link = _Link as unknown as (
  props: {
    href: string;
    children: Component;
    emitEvent?: boolean;
    onLoading?: () => void;
    loadingComponent?: Component;
    className?: string;
    queries?: Record<string, string | number | boolean>;
  }
) => void;


 export const  PageRoutes = _PageRoutes as unknown as (
    props: {
        modules?: any,
    enableLoader?: boolean
}
  ) => void ;