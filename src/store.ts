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
 * @function createStore
 * Creates a reactive store with optional persistence.
 *
 * @param initial The initial state object
 * @param options Optional store options
 * @returns Store API with get, set, update, delete, subscribe, derive
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

  /**
   * @function get
   * Returns the current store state.
   *
   * @example
   * const state = store.get();
   */
  function get(): T {
    return value;
  }

  /**
   * @function set
   * Replaces the store state with a new object.
   *
   * @example
   * store.set({ count: 10 });
   */
  function set(next: T) {
    value = { ...next };
    notify();
    persistToStorage();
  }

  /**
   * @function update
   * Merges a partial state object into the current state.
   *
   * @example
   * store.update({ count: store.get().count + 1 });
   */
  function update(partial: Partial<T>) {
    value = { ...value, ...partial };
    notify();
    persistToStorage();
  }

  /**
   * @function deleteKeys
   * Removes one or multiple keys from the store.
   *
   * @example
   * store.delete('count');
   * store.delete(['count', 'theme']);
   */
  function deleteKeys(keys: (keyof T) | (keyof T)[]) {
    const kArray = Array.isArray(keys) ? keys : [keys];
    kArray.forEach(k => {
      if (k in value) delete value[k];
    });
    notify();
    persistToStorage();
  }

  /**
   * @function subscribe
   * Subscribe to state changes.
   * Optionally provide a selector to receive only part of the state.
   *
   * @example
   * const unsub = store.subscribe(state => console.log(state));
   * const unsubCount = store.subscribe(state => console.log(state.count), s => s.count);
   */
  function subscribe(fn: Subscriber<T>, selector?: (state: T) => any) {
    const wrapper = selector ? (state: T) => fn(selector(state)) : fn;
    subs.add(wrapper);
    wrapper(value); // initial call
    return () => subs.delete(wrapper);
  }

  /**
   * @function derive
   * Creates a derived store from a selector function.
   *
   * @example
   * const countStore = store.derive(s => s.count);
   * countStore.subscribe(c => console.log("Count:", c));
   */
  function derive<K>(selector: (s: T) => K) {
    return {
      subscribe(cb: (v: K) => void) {
        return subscribe(state => cb(selector(state)));
      }
    };
  }

  /** Notify all subscribers of a state change */
  function notify() {
    subs.forEach(fn => fn(value));
  }

  /** Persist current state to localStorage if enabled */
  function persistToStorage() {
    if (persist && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch(err) {
        console.log("error saving to localStorage: ", err)
      }
    }
  }

  return { get, set, update, delete: deleteKeys, subscribe, derive };
}

// -------------------- Example Stores --------------------
/**
 * Route store for storing current route path
 * Persisted in localStorage as "routeStore"
 */
export const routeStore = createStore(
  { path: "/" },
  { persist: true, storageKey: "routeStore" }
);

/**
 * App store for global state
 * Tracks path, user info, theme
 * Persisted in localStorage as "appStore"
 */
export const appStore = createStore(
  { path: "/", user: null as null | { name: string }, theme: "light" },
  { persist: true, storageKey: "appStore" }
);
