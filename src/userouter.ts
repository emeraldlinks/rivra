import type { Component } from "ripple";

type RouterListener = (path: string) => void;

/**
 * RouterStore
 * -----------
 * This class provides a simple client-side router with support for:
 * - path tracking
 * - query parameters
 * - dynamic route params
 * - loading state
 * - router events (start, complete, change)
 * 
 * It uses the HTML5 history API to manage navigation without full page reloads.
 */
class RouterStore {
  /** Current pathname of the app (e.g., "/users/42") */
  path: string = "";

  /** Object containing query parameters (e.g., { name: "Joe" }) */
  queries: Record<string, string> = {};

  /** Object containing dynamic route parameters (e.g., { id: "42" }) */
  params: Record<string, string> = {};

  /** Loading state, true when a navigation starts, false when complete */
  loading = false;

  /** Internal event listeners grouped by type */
  private listeners: {
    start: RouterListener[];
    complete: RouterListener[];
    change: RouterListener[];
  } = { start: [], complete: [], change: [] };

  /**
   * Constructor
   * -----------
   * Initializes the router with the current location.
   * Automatically listens to "popstate" events to sync browser back/forward navigation.
   */
  constructor() {
    this.syncWithLocation();
    window.addEventListener("popstate", () => this.syncWithLocation());
  }

  /**
   * syncWithLocation
   * ----------------
   * Updates the internal router state to match window.location.
   * Emits "change" and "complete" events by default unless `announce` is false.
   * 
   * @param announce Whether to trigger router events (default: true)
   */
  private syncWithLocation(announce: boolean = true) {
    this.path = location.pathname;
    this.queries = Object.fromEntries(new URLSearchParams(location.search).entries());
    this.params = {};
    this.loading = false;

    if (announce) {
      this.emit("change", this.path);
      this.emit("complete", this.path);
    }
  }

  /**
   * emit
   * ----
   * Calls all listeners of the given type with the current path.
   * 
   * @param type Event type: "start", "complete", or "change"
   * @param path The current navigation path
   */
  private emit(type: keyof RouterStore["listeners"], path: string) {
    for (const cb of this.listeners[type]) cb(path);
  }

  /**
   * on
   * --
   * Subscribe to a router event.
   * 
   * @param type Event type: "start", "complete", "change"
   * @param cb Callback function called with the path
   * @returns Unsubscribe function
   */
  on(type: keyof RouterStore["listeners"], cb: RouterListener) {
    this.listeners[type].push(cb);
    return () => {
      this.listeners[type] = this.listeners[type].filter(fn => fn !== cb);
    };
  }

  /**
   * push
   * ----
   * Navigate to a new URL and push it into the browser history.
   * Emits "start" if `announce` is true.
   * 
   * @param url Target URL
   * @param announce Whether to trigger router events (default: true)
   */
  push(url: string, announce: boolean = true) {
    this.loading = true;
    if (announce) this.emit("start", url);

    const [path, search = ""] = url.split("?");
    window.history.pushState({}, "", url);
    this.path = path;
    this.queries = Object.fromEntries(new URLSearchParams(search).entries());
    this.syncWithLocation(announce);
    window.dispatchEvent(new Event("popstate"));
  }

  /**
   * replace
   * -------
   * Navigate to a new URL and replace the current browser history entry.
   * Emits "start" if `announce` is true.
   * 
   * @param url Target URL
   * @param announce Whether to trigger router events (default: true)
   */
  replace(url: string, announce: boolean = true) {
    this.loading = true;
    if (announce) this.emit("start", url);

    const [path, search = ""] = url.split("?");
    window.history.replaceState({}, "", url);
    this.path = path;
    this.queries = Object.fromEntries(new URLSearchParams(search).entries());
    this.syncWithLocation(announce);
    window.dispatchEvent(new Event("popstate"));
  }

  /**
   * back
   * ----
   * Navigate back in browser history.
   * Emits "start" if `announce` is true.
   * 
   * @param announce Whether to trigger router events (default: true)
   */
  back(announce: boolean = true) {
    this.loading = true;
    if (announce) this.emit("start", this.path);
    history.back();
    window.dispatchEvent(new Event("popstate"));
  }

  /**
   * matchRoute
   * ----------
   * Check if a given path matches a route pattern.
   * Supports dynamic parameters (e.g., "/users/:id") and wildcards "*".
   * 
   * @param pathPattern Route pattern
   * @param currentPath Current path to match
   * @returns true if matches, null if not
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
}

export const routerStore = new RouterStore();

/**
 * useRouter Hook
 * --------------
 * A simple reactive interface to access router state in Ripple components.
 * Provides:
 * - path
 * - queries (query parameters)
 * - params (dynamic route params)
 * - loading state
 * - navigation methods: push, replace, back
 * - route matching and event subscription
 */
export function useRouter() {
  return {
    get path() {
      return routerStore.path;
    },
    get queries() {
      return routerStore.queries;
    },
    get params() {
      return routerStore.params;
    },
    get loading() {
      return routerStore.loading;
    },
    push: (url: string, announce: boolean = true) => routerStore.push(url, announce),
    replace: (url: string, announce: boolean = true) => routerStore.replace(url, announce),
    back: (announce: boolean = true) => routerStore.back(announce),
    match: (pattern: string, currentPath: string) => routerStore.matchRoute(pattern, currentPath),
    on: (type: "start" | "complete" | "change", cb: (path: string) => void) =>
      routerStore.on(type, cb),
  };
}

// -------------------- Example --------------------
// Default global events
const router = useRouter();

/*
router.on("start", (path) => {
  console.log("Navigating to:", path);
});

router.on("complete", (path) => {
  console.log("Navigation finished:", path);
});

router.on("change", (path) => {
  console.log("Route changed:", path);
});
*/
