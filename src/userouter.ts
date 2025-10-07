import type { Component } from "ripple";

type RouterListener = (path: string) => void;
type BeforePopCallback = (url: string) => boolean | void;

/**
 * RouterStore
 * -----------
 * Client-side router for Ripple apps, inspired by Next.js router.
 * Features:
 * - Path tracking
 * - Query parameters
 * - Dynamic route parameters (params)
 * - Loading state
 * - Router events: start, complete, change
 * - Shallow routing
 * - Back navigation guards
 * - Prefetching of routes
 * 
 * Uses HTML5 History API to avoid full page reloads.
 */
class RouterStore {
  /** Current pathname (e.g., "/users/42") */
  path: string = "";

  /** Query parameters (e.g., { tab: "posts" }) */
  queries: Record<string, string> = {};

  /** Dynamic route parameters extracted from matched patterns (e.g., { id: "42" }) */
  params: Record<string, string> = {};

  /** Loading state, true when navigation starts */
  loading = false;

  /** Internal event listeners: start, complete, change */
  private listeners: {
    start: RouterListener[];
    complete: RouterListener[];
    change: RouterListener[];
  } = { start: [], complete: [], change: [] };

  /** Callbacks that can block back/forward navigation */
  private beforePop: BeforePopCallback[] = [];

  constructor() {
    this.syncWithLocation();
    window.addEventListener("popstate", () => this.handlePopState());
  }

  /** Handle browser back/forward events */
  private handlePopState() {
    for (const fn of this.beforePop) {
      const result = fn(this.asPath);
      if (result === false) return; // Cancel navigation
    }
    this.syncWithLocation();
  }

  /**
   * Sync router state with window.location
   * @param announce Whether to emit events (default: true)
   */
  private syncWithLocation(announce = true) {
    this.path = window.location.pathname;
    this.queries = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    this.params = {};
    this.loading = false;

    if (announce) {
      this.emit("change", this.path);
      this.emit("complete", this.path);
    }
  }

  /** Emit event to all listeners */
  private emit(type: keyof RouterStore["listeners"], path: string) {
    for (const cb of this.listeners[type]) cb(path);
  }

  /**
   * Subscribe to router events
   * @param type "start" | "complete" | "change"
   * @param cb Callback called with path
   * @returns Unsubscribe function
   */
  on(type: keyof RouterStore["listeners"], cb: RouterListener) {
    this.listeners[type].push(cb);
    return () => {
      this.listeners[type] = this.listeners[type].filter(fn => fn !== cb);
    };
  }


  /** Builds a complete URL from path + query object */
  private buildUrl(path: string, queries?: Record<string, any>): string {
    if (!queries || Object.keys(queries).length === 0) return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queries)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  /**
   * Register a callback before back/forward navigation
   * Return false to cancel navigation
   */
  beforePopState(cb: BeforePopCallback) {
    this.beforePop.push(cb);
    return () => {
      this.beforePop = this.beforePop.filter(f => f !== cb);
    };
  }

  /**
   * Navigate to a new URL (pushState)
   * @param url Target URL
   * @param announce Emit events? (default: true)
   * @param shallow Update URL without full sync? (default: false)
   */
  push(
    url: string,
    announce = true,
    shallow = false,
    queries?: Record<string, string | number | boolean>,
  ) {
    const fullUrl = this.buildUrl(url, queries);
    this.navigate(fullUrl, "push", announce, shallow);
  }

  /**
   * Replace current URL (replaceState)
   * @param url Target URL
   * @param announce Emit events? (default: true)
   * @param shallow Update URL without full sync? (default: false)
   */

  replace(
    url: string,
    announce = true,
    shallow = false,
    queries?: Record<string, string | number | boolean>,
  ) {
    const fullUrl = this.buildUrl(url, queries);
    this.navigate(fullUrl, "replace", announce, shallow);
  }


  /** Go back in browser history */
  back(announce = true) {
    this.loading = true;
    if (announce) this.emit("start", this.path);
    history.back();
    window.dispatchEvent(new Event("popstate"));
  }

  /** Internal navigation helper */
  private navigate(url: string, method: "push" | "replace", announce = true, shallow = false) {
    this.loading = true;
    if (announce) this.emit("start", url);

    const [path, search = ""] = url.split("?");

    // Always update internal state
    this.path = path;
    this.queries = Object.fromEntries(new URLSearchParams(search).entries());

    // Update browser history
    if (method === "push") window.history.pushState({}, "", url);
    else window.history.replaceState({}, "", url);

    // Only run full sync/announce if NOT shallow
    if (!shallow) this.syncWithLocation(announce);

    // Trigger popstate so listeners react
    window.dispatchEvent(new Event("popstate"));
  }

  /**
   * Match a route pattern to a path
   * @param pathPattern Pattern (e.g., "/users/:id")
   * @param currentPath Path to match (e.g., "/users/42")
   * @returns true if matches, null if not
   * Sets `this.params` with extracted dynamic parameters
   */
  matchRoute(pathPattern: string, currentPath: string) {
    if (!currentPath) return null;
    const normalize = (p: string) => (p === "/" ? "" : p.replace(/\/+$/, ""));
    const pattern = normalize(pathPattern);
    const path = normalize(currentPath);

    let wildcardIndex = 0;
    const regexPattern = pattern
      .replace(/:([A-Za-z0-9_]+)/g, (_, key) => `(?<${key}>[^/]+)`)
      .replace(/\*/g, () => {
        wildcardIndex++;
        return `(?<wildcard${wildcardIndex}>.*)`;
      });

    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (!match) return null;
    this.params = match.groups || {};
    return true;
  }

  /** Simulate prefetching a route */
  prefetch(url: string) {
    console.log("Prefetching route:", url);
    return Promise.resolve();
  }

  /** Resolve relative href to absolute path + query */
  resolveHref(href: string) {
    const url = new URL(href, window.location.origin);
    return url.pathname + url.search;
  }

  /** Full path with query string */
  get asPath() {
    return window.location.pathname + window.location.search;
  }
}

export const routerStore = new RouterStore();

/** useRouter hook */
export function useRouter() {
  return {
    // Basic path info
    get path() { return routerStore.path; },
    get asPath() { return routerStore.asPath; },

    // Query params and dynamic route params
    get queries() { return routerStore.queries; },
    get params() { return routerStore.params; },

    // Navigation/loading
    get loading() { return routerStore.loading; },

    push: (
      url: string,
      announce = true,
      shallow = false,
      queries?: Record<string, string | number | boolean>,
    ) => routerStore.push(url, announce, shallow, queries),


    replace: (
      url: string,
      announce = true,
      shallow = false,
      queries?: Record<string, string | number | boolean>,
    ) => routerStore.replace(url, announce, shallow, queries),

    back: (announce = true) => routerStore.back(announce),

    // Route matching & events
    match: (pattern: string, currentPath: string) => routerStore.matchRoute(pattern, currentPath),
    on: (type: "start" | "complete" | "change", cb: (path: string) => void) => routerStore.on(type, cb),
    beforePopState: (cb: BeforePopCallback) => routerStore.beforePopState(cb),
    prefetch: (url: string) => routerStore.prefetch(url),
    resolveHref: (url: string) => routerStore.resolveHref(url),

    // Extended URL info
    get host() { return window.location.host; },
    get hostname() { return window.location.hostname; },
    get protocol() { return window.location.protocol; },
    get origin() { return window.location.origin; },
    get port() { return window.location.port; },
    get href() { return window.location.href; },
    get hash() { return window.location.hash; },
    get search() { return window.location.search; },
  };
}

// -------------------- Example Usage --------------------

// const router = useRouter();

// // Listen to navigation events
// router.on("start", (path) => console.log("Start navigating to:", path));
// router.on("change", (path) => console.log("Route changed to:", path));
// router.on("complete", (path) => console.log("Navigation complete:", path));

// Guard back navigation
// router.beforePopState((url) => {
//   if (url === "/protected") {
//     console.log("Navigation blocked:", url);
//     return false; // Cancel navigation
//   }
// });

// Navigate to a new route
//router.push("/users/42?tab=posts");

// Replace URL shallowly (no full sync)//
//router.replace("/users/42?tab=profile", true, true);

// Prefetch a route
// router.prefetch("/about");

// Resolve href
// console.log("Resolved href:", router.resolveHref("/contact?ref=home"));

// Access reactive properties
// console.log("Current path:", router.path);
// console.log("Query params:", router.queries);
// console.log("Dynamic params:", router.params);
// console.log("Full URL:", router.asPath);

// Access full URL info
// console.log(router.host);
// console.log(router.hostname);
// console.log(router.origin);
// console.log(router.protocol);
// console.log(router.port);
// console.log(router.href);
// console.log(router.search);
// console.log(router.hash);
