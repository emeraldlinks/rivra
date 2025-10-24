/**
 * @typedef Subscriber
 * A callback that receives the current store state or derived value.
 * @example
 * const unsub = store.subscribe(state => console.log(state));
 */
type Subscriber<T> = (value: T) => void;

/**
 * @typedef StoreOptions
 * Options for creating a store.
 * @property persist Whether to persist store in localStorage (default: false)
 * @property storageKey The key to use in localStorage if persist is true
 */
interface StoreOptions {
  persist?: boolean;
  storageKey?: string;
}

/**
 * @typedef Middleware
 * A function that runs before or after each update.
 * @param state Current state of the store
 * @param action Optional string describing the event
 * @param payload Optional data passed to update/set
 */
type Middleware<T> = (state: T, action?: string, payload?: any) => void;

/**
 * @function createStore
 * Creates a reactive store with optional persistence and tools like watch & middleware.
 *
 * @param initial The initial state object
 * @param options Optional store options
 * @returns Store API with get, set, update, delete, subscribe, derive, watch, use, clear
 *
 * @example
 * const counterStore = createStore({ count: 0 });
 */
export function createStore<T extends object>(
  initial: T,
  options: StoreOptions = {}
) {
  const { persist = false, storageKey } = options;

  // Load persisted state if enabled
  let value: T = { ...initial };
  if (persist && storageKey) {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        value = JSON.parse(stored);
      } catch {}
    }
  }

  const subs = new Set<Subscriber<T>>();
  const watchers: { selector: (state: T) => any; cb: (newVal: any, oldVal: any) => void }[] = [];
  const middlewares: Middleware<T>[] = [];

  /** Notify all subscribers and watchers of a state change */
  function notify(action?: string, payload?: any) {
    subs.forEach(fn => fn(value));
    watchers.forEach(({ selector, cb }) => {
      const newVal = selector(value);
      const oldVal = selector(prevValue);
      if (newVal !== oldVal) cb(newVal, oldVal);
    });
    middlewares.forEach(fn => fn(value, action, payload));
  }

  let prevValue = { ...value };

  /** Persist current state to localStorage if enabled */
  function persistToStorage() {
    if (persist && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (err) {
        console.log("error saving to localStorage: ", err);
      }
    }
  }

  /** @function get — Returns the current store state */
  function get(): T {
    return value;
  }

  /** @function set — Replaces the entire store state */
  function set(next: T, action = "set") {
    prevValue = value;
    value = { ...next };
    persistToStorage();
    notify(action, next);
  }

  /**
   * @function update
   * Merges a partial object or uses a callback to modify the current state.
   *
   * - Object patch: `store.update({ count: 1 })`
   * - Callback style: `store.update(prev => ({ count: prev.count + 1 }))`
   */
  function update(partial: Partial<T>): void;
  function update(partialFn: (prev: T) => Partial<T>): void;
  function update(partialOrFn: Partial<T> | ((prev: T) => Partial<T>), action = "update") {
    prevValue = value;
    const patch =
      typeof partialOrFn === "function" ? partialOrFn(value) : partialOrFn;
    value = { ...value, ...patch };
    persistToStorage();
    notify(action, patch);
  }

  /** @function delete — Removes one or multiple keys from the store */
  function deleteKeys(keys: (keyof T) | (keyof T)[], action = "delete") {
    prevValue = value;
    const kArray = Array.isArray(keys) ? keys : [keys];
    kArray.forEach(k => delete (value as any)[k]);
    persistToStorage();
    notify(action, keys);
  }

  /** @function clear — Clears both state and its localStorage record */
  function clear() {
    prevValue = { ...value };
    value = { ...initial };
    if (persist && storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.warn("Failed to clear persisted store:", err);
      }
    }
    notify("clear");
  }

  /**
   * @function subscribe
   * Subscribes to all store changes (full state or a selected part).
   *
   * @param {Function} fn Callback to receive state or selected part
   * @param {Function} [selector] Optional selector to receive subset
   *
   * @example
   * store.subscribe(s => console.log(s)); // full state
   * store.subscribe(s => console.log(s.theme), s => s.theme); // only theme
   */
  function subscribe(fn: Subscriber<T>, selector?: (state: T) => any) {
    const wrapper = selector ? (state: T) => fn(selector(state)) : fn;
    subs.add(wrapper);
    wrapper(value); // initial call
    return () => subs.delete(wrapper);
  }

  /**
   * @function watch
   * Watches a specific value in the store and runs callback when it changes.
   * Provides both new and old values.
   *
   * @param {Function} selector Function selecting what to watch
   * @param {Function} callback Called with (newValue, oldValue)
   *
   * @example
   * store.watch(s => s.count, (n, o) => console.log(`count: ${o} → ${n}`));
   */
  function watch(selector: (s: T) => any, callback: (n: any, o: any) => void) {
    watchers.push({ selector, cb: callback });
    return () => {
      const i = watchers.findIndex(w => w.cb === callback);
      if (i >= 0) watchers.splice(i, 1);
    };
  }

  /**
   * @function use
   * Adds middleware to run on every state change.
   *
   * Middleware is for logging, analytics, or side effects.
   *
   * @param {Function} middleware Function with (state, action?, payload?)
   *
   * @example
   * store.use((s, action) => console.log(`[${action}]`, s));
   */
  function use(middleware: Middleware<T>) {
    middlewares.push(middleware);
    return () => {
      const i = middlewares.indexOf(middleware);
      if (i >= 0) middlewares.splice(i, 1);
    };
  }

  /**
   * @function derive
   * Creates a derived store that reacts to changes in selected parts of the state.
   *
   * @example
   * const themeStore = store.derive(s => s.theme);
   * themeStore.subscribe(v => console.log("theme:", v));
   */
  function derive<K>(selector: (s: T) => K) {
    return {
      subscribe(cb: (v: K) => void) {
        return subscribe(state => cb(selector(state)));
      },
    };
  }

  return {
    get,
    set,
    update,
    delete: deleteKeys,
    clear,
    subscribe,
    watch,
    use,
    derive,
  };
}

export default createStore

// -------------------- Example Stores --------------------

 /**
   *This provides a basic store for your app like theme, user etc. it's an example which you can delete;
   */
export const appStore = createStore(
  {
    user: { name: "Joe", location: "unknown", preferences: [] },
    count: 0,
    theme: "light",
  },
  { persist: true, storageKey: "appStore" }
);

export const routeStore = createStore(
   { path: "/" }, { persist: true, storageKey: "routeStore" }
   );

// /* -------------------- Example Usage -------------------- */

// // Subscribe to entire state
// appStore.subscribe(s => console.log("State changed:", s));

// // Watch a specific value
// appStore.watch(s => s.count, (n, o) => console.log(`Count: ${o} → ${n}`));

// // Use middleware for logging
// appStore.use((state, action, payload) =>
//   console.log(`[${action}]`, payload, state)
// );

// // Partial update
// appStore.update({ count: 1 });

// // Callback update (safe addition)
// appStore.update(prev => ({ count: prev.count + 1 }));

// // Derived store
// const themeStore = appStore.derive(s => s.theme);
// themeStore.subscribe(theme => console.log("Theme:", theme));

// // Clear store
// appStore.clear();
