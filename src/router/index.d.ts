import type { Component } from "ripple";
export declare const Router: (props: {
    routes: any;
}) => void;
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
 *   <span>{"Go to Dashboard"}</span>
 * </Link>
 */
declare const Link: (props: {
    href: string;
    children: Component;
    emitEvent?: boolean;
    onLoading?: () => void;
    loadingComponent?: Component;
    className?: string;
    queries?: Record<string, string | number | boolean>;
}) => void;
export declare const PageRoutes: (props: {
    modules?: any;
    enableLoader?: boolean;
}) => void;
export { Link };





  export interface InuseRouter {
    readonly path: string;
    readonly asPath: string;
    readonly queries: Record<string, string>;
    readonly params: Record<string, string>;
    readonly loading: boolean;

    push(
      url: string,
      announce?: boolean,
      shallow?: boolean,
      queries?: Record<string, string | number | boolean>
    ): void;

    replace(
      url: string,
      announce?: boolean,
      shallow?: boolean,
      queries?: Record<string, string | number | boolean>
    ): void;

    back(announce?: boolean): void;

    match(pattern: string, currentPath: string): true | null;
    on(type: "start" | "complete" | "change", cb: (path: string) => void): () => void;
    beforePopState(cb: (url: string) => boolean | void): () => void;
    prefetch(url: string): Promise<void>;
    resolveHref(url: string): string;
    isActive(url: string): boolean;

    readonly host: string;
    readonly hostname: string;
    readonly protocol: string;
    readonly origin: string;
    readonly port: string;
    readonly href: string;
    readonly hash: string;
    readonly search: string;
  }

  /**
   * useRouter hook
   *
   * Provides client-side navigation and routing utilities.
   *
   * @example
   * ```ts
   * import { useRouter } from "rivra/router";
   * const router = useRouter();
   * router.push("/about");
   * ```
   */
  export function useRouter(): InuseRouter;