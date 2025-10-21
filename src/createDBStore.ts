/**
 * indexdb-store.ts
 *
 * Full implementation of createIndexDBStore + IndexDBManager with:
 * - Full JSDoc
 * - Multi-store manager
 * - Optional sync adapter hooks
 * - Global (manager) + per-store online/offline callbacks
 * - SSR-safe checks
 * - Preserves all existing methods and signatures
 *
 * Drop into your project. Typescript friendly.
 */

import { createStore } from "./store";

/* --------------------------------------------------------------------------
 * Types & Options
 * -------------------------------------------------------------------------- */

/**
 * Live sync & network callback config (part of DBStoreOptions.sync)
 */
interface SyncOptions {
  /** Base URL or remote DB client (optional helper) */
  endpoint?: string;
  /** Push local change to remote */
  push?: (item: any, action: "add" | "update" | "remove") => Promise<void>;
  /** Pull data from remote */
  pull?: () => Promise<any[]>;
  /** Auto-sync pull interval (ms) */
  interval?: number;
  /** Automatically push on local changes */
  autoSync?: boolean;
  /** Called when this store detects it's offline */
  onOffline?: () => void;
  /** Called when this store becomes online again */
  onOnline?: () => void;
}

/**
 * Configuration options for IndexedDB-backed reactive store.
 */
interface DBStoreOptions {
  /** Database name (defaults to "default_db") */
  dbName?: string;
  /** Store name (required) */
  storeName: string;
  /** Key path for object store (defaults to "id") */
  keyPath?: string;
  /** Database version (defaults to 1) */
  version?: number;
  /** Automatically load data into store on init (default: true) */
  autoLoad?: boolean;
  /** Live sync configuration (optional) */
  sync?: SyncOptions;
}

/** Filter type for query operations */
type QueryFilter<T> = Partial<Record<keyof T, any>> | ((item: T) => boolean);

/* --------------------------------------------------------------------------
 * Utility: SSR-safe feature detection
 * -------------------------------------------------------------------------- */
const isBrowser =
  typeof window !== "undefined" && typeof navigator !== "undefined";
const supportsBroadcastChannel = typeof BroadcastChannel !== "undefined";

/* --------------------------------------------------------------------------
 * createIndexDBStore
 * -------------------------------------------------------------------------- */

/**
 * Creates a reactive IndexedDB-backed store with ORM-like methods.
 * Includes reactivity, syncing across tabs, live sync hooks, and offline detection.
 *
 * @template T - The record type stored in IndexedDB.
 * @param {DBStoreOptions} options - Configuration for the store.
 * @returns {object} Reactive data store with CRUD, query, and utility methods.
 * @example
 * // Create multiple stores
 * const userStore = createIndexDBStore({storeName: 'users'});
 */
export function createIndexDBStore<T extends Record<string, any>>(
  options: DBStoreOptions
) {
  const {
    dbName = "default_db",
    storeName,
    keyPath,
    version = 1,
    autoLoad = true,
    sync,
  } = options;

  // main reactive store for items
  const store = createStore<{ items: T[] }>({ items: [] });

  // database reference and runtime state
  let db: IDBDatabase | null = null;
  let resolvedKeyPath: string | null = keyPath || null;

  // cross-tab channel (guarded for SSR / old browsers)
  const bc =
    isBrowser && supportsBroadcastChannel
      ? new BroadcastChannel(`${dbName}_${storeName}_sync`)
      : null;

  // network state
  let isOffline = isBrowser ? !navigator.onLine : false;

  /* ------------------------------------------------------------------------
   * DB helpers
   * ------------------------------------------------------------------------ */

  /**
   * Opens or upgrades the IndexedDB database.
   * @returns {Promise<IDBDatabase>} The database instance.
   */
  async function openDB(): Promise<IDBDatabase> {
    if (!isBrowser)
      throw new Error("IndexedDB not available in this environment (SSR).");
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const _db = req.result;
        if (!_db.objectStoreNames.contains(storeName)) {
          _db.createObjectStore(storeName, {
            keyPath: resolvedKeyPath || "id",
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function ensureDB() {
    if (!db) db = await openDB();
    return db!;
  }

  /** Initializes the store and loads all data if autoLoad is true. */
  async function init() {
    if (!isBrowser) return; // SSR-safe: do not attempt DB operations on server
    db = await openDB();
    if (autoLoad) {
      const all = await getAll();
      store.set({ items: all });
    }
    setupNetworkListeners();
    setupAutoPull();
  }

  function ensureKeyPath(item: T) {
    if (!resolvedKeyPath) {
      const firstKey = Object.keys(item)[0];
      resolvedKeyPath = firstKey;
    }
    return resolvedKeyPath!;
  }

  /* ------------------------------------------------------------------------
   * CRUD
   * ------------------------------------------------------------------------ */

  /**
   * Adds a new record to the store.
   * @param {T} item - The record to add.
   * @returns {Promise<void>}
   */
  async function add(item: T) {
    const dbRef = await ensureDB();
    ensureKeyPath(item);
    return new Promise<void>((resolve, reject) => {
      const tx = dbRef.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).add(item);
      req.onsuccess = async () => {
        store.update((s) => ({ items: [...s.items, item] }));
        bc?.postMessage("sync");
        await maybeSync(item, "add");
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Updates an existing record by ID or object.
   * @param {IDBValidKey | Partial<T>} idOrItem - Record ID or object containing key.
   * @param {Partial<T>} [partial] - Partial data to merge when using ID form.
   * @returns {Promise<void>}
   */
  async function update(
    idOrItem: IDBValidKey | Partial<T>,
    partial?: Partial<T>
  ) {
    const dbRef = await ensureDB();

    let id: IDBValidKey;
    let newData: Partial<T> = {};

    const isKeyType =
      typeof idOrItem === "string" ||
      typeof idOrItem === "number" ||
      idOrItem instanceof Date ||
      idOrItem instanceof ArrayBuffer ||
      ArrayBuffer.isView(idOrItem) ||
      Array.isArray(idOrItem);

    if (isKeyType) {
      id = idOrItem as IDBValidKey;
      newData = partial || {};
    } else if (typeof idOrItem === "object" && idOrItem !== null) {
      ensureKeyPath(idOrItem as T);
      id = (idOrItem as any)[resolvedKeyPath!];
      newData = idOrItem as Partial<T>;
    } else {
      throw new Error("Invalid argument passed to update()");
    }

    const existing = await get(id);
    if (!existing) return;

    const updated = { ...existing, ...newData } as T;

    return new Promise<void>((resolve, reject) => {
      const tx = dbRef.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).put(updated);
      req.onsuccess = async () => {
        store.update((s) => ({
          items: s.items.map((i) =>
            (i as any)[resolvedKeyPath!] === id ? updated : i
          ),
        }));
        bc?.postMessage("sync");
        await maybeSync(updated, "update");
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves a record by ID.
   * @param {IDBValidKey} id - Record key.
   * @returns {Promise<T | undefined>} The matching record, if found.
   */
  async function get(id: IDBValidKey): Promise<T | undefined> {
    const dbRef = await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = dbRef.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves all records.
   * @returns {Promise<T[]>} All stored records.
   */
  async function getAll(): Promise<T[]> {
    const dbRef = await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = dbRef.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Removes a record by ID.
   * @param {IDBValidKey} id - Record key.
   * @returns {Promise<void>}
   */
  async function remove(id: IDBValidKey) {
    const dbRef = await ensureDB();
    const key = resolvedKeyPath || "id";
    return new Promise<void>((resolve, reject) => {
      const tx = dbRef.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = async () => {
        store.update((s) => ({
          items: s.items.filter((i) => (i as any)[key] !== id),
        }));
        bc?.postMessage("sync");
        await maybeSync({ [key]: id } as any, "remove");
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Clears all data from the store.
   * @returns {Promise<void>}
   */
  async function clear() {
    const dbRef = await ensureDB();
    return new Promise<void>((resolve, reject) => {
      const tx = dbRef.transaction(storeName, "readwrite");
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => {
        store.set({ items: [] });
        bc?.postMessage("sync");
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /* ------------------------------------------------------------------------
   * Queries & Utilities
   * ------------------------------------------------------------------------ */

  async function where(filter: QueryFilter<T>): Promise<T[]> {
    const all = await getAll();
    if (typeof filter === "function") return all.filter(filter);
    return all.filter((item) =>
      Object.entries(filter).every(([k, v]) => item[k as keyof T] === v)
    );
  }

  async function first(filter?: QueryFilter<T>): Promise<T | undefined> {
    const res = filter ? await where(filter) : await getAll();
    return res[0];
  }

  async function find(id: IDBValidKey): Promise<T | undefined> {
    return get(id);
  }

    /**
   * Get the last matching record
   * @example
   * const lastAdult = await User.last(u => u.age >= 18);
   */
  async function last(filter?: QueryFilter<T>): Promise<T | undefined> {
    const res = filter ? await where(filter) : await getAll();
    return res[res.length - 1];
  }

  /**
   * Count items matching filter
   * @example
   * const adultCount = await User.count(u => u.age >= 18);
   */
  async function count(filter?: QueryFilter<T>): Promise<number> {
    const res = filter ? await where(filter) : await getAll();
    return res.length;
  }

  /**
   * Check if any record exists matching filter
   * @example
   * const exists = await User.exists({ name: "John" });
   */
  async function exists(filter: QueryFilter<T>): Promise<boolean> {
    const res = await where(filter);
    return res.length > 0;
  }

  /**
   * Get a random record
   * @example
   * const randomUser = await User.random();
   */
  async function random(filter?: QueryFilter<T>): Promise<T | undefined> {
    const res = filter ? await where(filter) : await getAll();
    if (res.length === 0) return undefined;
    return res[Math.floor(Math.random() * res.length)];
  }

  async function below(filter: Partial<T>): Promise<T[]> {
  const all = await getAll();
  return all.filter(item =>
    Object.entries(filter).every(([k, v]) => {
      const val = item[k as keyof T];
      if (typeof val === "number" && typeof v === "number") return (val as number) < (v as number);
      if (typeof val === "string" && typeof v === "string") return (val as string) < (v as string);
      return false;
    })
  );
}

async function above(filter: Partial<T>): Promise<T[]> {
  const all = await getAll();
  return all.filter(item =>
    Object.entries(filter).every(([k, v]) => {
      const val = item[k as keyof T];
      if (typeof val === "number" && typeof v === "number") return (val as number) > (v as number);
      if (typeof val === "string" && typeof v === "string") return (val as string) > (v as string);
      return false;
    })
  );
}



  async function query(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await getAll();
    return all.filter(predicate);
  }

  /**
   * Creates a derived live query that reacts to store changes.
   * @template U
   * @param {(items: T[]) => U} selector - Function that selects part of the data.
   * @returns {{ subscribe(fn: (value: U) => void): () => void; get(): U }}
   */
  function deriveQuery<U>(selector: (items: T[]) => U) {
    const live = createStore({ value: selector(store.get().items) });

    store.watch(
      (s) => s.items,
      (items) => {
        const result = selector(items);
        live.set({ value: result });
      }
    );

    return {
      subscribe: (fn: (v: U) => void) => live.subscribe((s) => fn(s.value)),
      get: () => live.get().value,
    };
  }

  /* ------------------------------------------------------------------------
   * Live sync & network listeners (per-store)
   * ------------------------------------------------------------------------ */

  async function maybeSync(item: any, action: "add" | "update" | "remove") {
    // sync only if configured and online
    if (
      sync?.autoSync &&
      typeof isBrowser !== "undefined" &&
      navigator.onLine &&
      sync.push
    ) {
      try {
        await sync.push(item, action);
      } catch (err) {
        // swallow - caller may implement retry
        console.warn(
          `[createIndexDBStore:${storeName}] sync push failed:`,
          err
        );
      }
    }
  }

  function setupAutoPull() {
    if (!isBrowser) return;
    if (sync?.interval && sync.pull) {
      setInterval(async () => {
        if (!navigator.onLine) return;
        try {
          const remote = await sync.pull!();
          if (remote) {
            store.set({ items: remote as T[] });
          }
        } catch (err) {
          console.warn(
            `[createIndexDBStore:${storeName}] sync pull failed:`,
            err
          );
        }
      }, sync.interval);
    }
  }

  function setupNetworkListeners() {
    if (!isBrowser) return;

    // offline
    window.addEventListener("offline", () => {
      isOffline = true;
      try {
        sync?.onOffline?.();
      } catch (err) {
        console.error("onOffline callback error:", err);
      }
      // Trigger store subscribers reactively (announce network change)
      store.update((s) => ({ items: s.items }));
    });

    // online
    window.addEventListener("online", async () => {
      const wasOffline = isOffline;
      isOffline = false;
      try {
        sync?.onOnline?.();
      } catch (err) {
        console.error("onOnline callback error:", err);
      }
      // If we were offline and now online, optionally pull latest
      if (wasOffline && sync?.pull) {
        try {
          const remote = await sync.pull();
          if (remote) store.set({ items: remote as T[] });
        } catch (err) {
          console.warn(
            `[createIndexDBStore:${storeName}] sync pull after online failed:`,
            err
          );
        }
      }
      // notify subscribers (reactive)
      store.update((s) => ({ items: s.items }));
    });
  }

  // cross-tab broadcast listener (keeps store in sync across tabs)
  if (bc) {
    bc.onmessage = async (msg) => {
      if (msg.data === "sync") {
        const all = await getAll();
        store.set({ items: all });
      }
    };
  }

  /* ------------------------------------------------------------------------
   * Transactions
   * ------------------------------------------------------------------------ */

  /**
   * Runs a custom transaction operation.
   * @param {(tx: IDBTransaction) => void} fn - Transaction callback.
   * @returns {Promise<void>}
   */
  async function transaction(fn: (tx: IDBTransaction) => void) {
    const dbRef = await ensureDB();
    const tx = dbRef.transaction(storeName, "readwrite");
    fn(tx);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // initialize
  init();

  /* ------------------------------------------------------------------------
   * Public API (do not remove these keys — kept for compatibility)
   * ------------------------------------------------------------------------ */
  return {
    add,
    update,
    get,
    getAll,
    remove,
    clear,
    query,
    subscribe: store.subscribe,
    watch: store.watch,
    deriveQuery,
    where,
    first,
    find,
    put: update,
    transaction,
    random,
    exists,
    count,
    last,
    above,
    below
  };
}

/* --------------------------------------------------------------------------
 * IndexDBManager — multi-store manager with global network callbacks
 * -------------------------------------------------------------------------- */

/**
 * Options for IndexDBManager constructor (global network callbacks).
 */
interface IndexDBManagerOptions {
  onOffline?: () => void;
  onOnline?: () => void;
}

/**
 * A lightweight IndexedDB manager that can create and manage multiple stores.
 * Supports optional global onOnline/onOffline callbacks. Each store also supports
 * per-store callbacks via its DBStoreOptions.sync.onOnline/onOffline.
 */
export class IndexDBManager {
  private dbName: string;
  private version: number;
  private stores: Record<string, ReturnType<typeof createIndexDBStore<any>>> =
    {};
  private globalOnOffline?: () => void;
  private globalOnOnline?: () => void;

  /**
   * Create a manager for a named IndexedDB database.
   * @param {string} dbName - database name
   * @param {number} [version=1] - db version
   * @param {IndexDBManagerOptions} [opts] - global network callbacks
   */
  constructor(
    dbName: string,
    version: number = 1,
    opts?: IndexDBManagerOptions
  ) {
    this.dbName = dbName;
    this.version = version;
    this.globalOnOffline = opts?.onOffline;
    this.globalOnOnline = opts?.onOnline;

    // If running in browser, hook into global online/offline to call manager-level hooks.
    if (isBrowser) {
      window.addEventListener("offline", () => {
        try {
          this.globalOnOffline?.();
        } catch (err) {
          console.error("IndexDBManager.onOffline error:", err);
        }
      });
      window.addEventListener("online", () => {
        try {
          this.globalOnOnline?.();
        } catch (err) {
          console.error("IndexDBManager.onOnline error:", err);
        }
      });
    }
  }

  /**
   * Creates a new store within the database.
   *
   * @template T
   * @param {string} storeName - The name of the object store.
   * @param {string} [keyPath='id'] - The key path used as the primary key.
   * @param {{ sync?: SyncOptions }} [opts] - Optional per-store additions (e.g., per-store onOnline/onOffline).
   * @returns {ReturnType<typeof createIndexDBStore<T>>} The created store instance.
   *
   * @example
   * // Create multiple stores
   * const users = db.createStore<User>("users", "id");
   * const posts = db.createStore<Post>("posts", "id");
   */
  createStore<T extends Record<string, any>>(
    storeName: string,
    keyPath: string = "id",
    opts?: { sync?: SyncOptions }
  ) {
    // merge global and per-store network callbacks: per-store takes precedence
    const mergedSync: SyncOptions | undefined = opts?.sync
      ? {
          ...opts.sync,
          onOffline: opts.sync.onOffline ?? this.globalOnOffline,
          onOnline: opts.sync.onOnline ?? this.globalOnOnline,
        }
      : this.globalOnOffline || this.globalOnOnline
      ? { onOffline: this.globalOnOffline, onOnline: this.globalOnOnline }
      : undefined;

    const store = createIndexDBStore<T>({
      dbName: this.dbName,
      storeName,
      keyPath,
      version: this.version,
      sync: mergedSync,
    });
    this.stores[storeName] = store;
    return store;
  }

  /**
   * Retrieves a store by its name.
   * @param {string} name - The store name.
   * @returns {ReturnType<typeof createIndexDBStore> | undefined} The store instance, if found.
   */
  getStore(name: string) {
    return this.stores[name];
  }
}

/* --------------------------------------------------------------------------
 * 📘 Example Usage (merged, minimal + full + multi-store)
 * --------------------------------------------------------------------------
 *
 * Minimal:
 *
 * const userStore = createIndexDBStore({
 *   storeName: 'users',
 * });
 *
 * await userStore.add({ id: 'u1', name: 'Joseph', age: 22 });
 * const all = await userStore.getAll();
 * console.log(all);
 *
 *
 * Full single-store config:
 *
 * interface User {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const userStore = createIndexDBStore<User>({
 *   dbName: "MyAppDB",
 *   storeName: "users",
 *   keyPath: "id",
 *   version: 1,
 *   sync: {
 *     endpoint: "https://api.example.com/users",
 *     async push(item, action) {
 *       // simple example using fetch
 *       if (action === "add") await fetch(this.endpoint!, { method: "POST", body: JSON.stringify(item) });
 *       if (action === "update") await fetch(`${this.endpoint}/${(item as any).id}`, { method: "PUT", body: JSON.stringify(item) });
 *       if (action === "remove") await fetch(`${this.endpoint}/${(item as any).id}`, { method: "DELETE" });
 *     },
 *     async pull() {
 *       const res = await fetch("https://api.example.com/users");
 *       return res.json();
 *     },
 *     interval: 15000,
 *     autoSync: true,
 *     onOffline: () => console.log("User store offline"),
 *     onOnline: () => console.log("User store online"),
 *   },
 * });
 *
 * // Multi-store manager usage with global + per-store callbacks:
 *
 * const db = new IndexDBManager("MyAppDB", 1, {
 *   onOffline: () => console.log("Global offline"),
 *   onOnline: () => console.log("Global online"),
 * });
 *
 * // per-store callbacks override global if provided
 * const users = db.createStore<User>("users", "id", {
 *   sync: {
 *     onOffline: () => console.log("Users store offline"),
 *     onOnline: () => console.log("Users store online"),
 *   }
 * });
 *
 * const posts = db.createStore<{ id: string; title: string }>("posts", "id");
 *
 * await users.add({ id: "u1", name: "Joe", age: 22 });
 * await posts.add({ id: "p1", title: "Hello World" });
 *
 * users.subscribe(state => console.log("Users changed:", state.items));
 * posts.subscribe(state => console.log("Posts changed:", state.items));
 *
 * // derived example (watch one user)
 * const watchUser = users.deriveQuery(items => items.find(u => u.id === "u1") || null);
 * const unsubscribeWatch = watchUser.subscribe(u => console.log("u1 changed:", u));
 *
 * // manual transaction example
 * await users.transaction(tx => {
 *   const s = tx.objectStore("users");
 *   s.add({ id: "u2", name: "Ada", age: 45 });
 * });
 *
 * // Note: When running in SSR environment, store operations that touch IndexedDB are safe-guarded.
 *
 * -------------------------------------------------------------------------- */
