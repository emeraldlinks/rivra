




# Ripple-file-router 
**(Minimal Ripple tool kit. Not just a router)**



A lightweight, file-based router for **Ripple.js** that automatically generates page routes from your ***.ripple***  files, supports nested directories, and includes a global loader plus a persistent state manager. 
#
Not just a router—it's a complete toolkit from **ripple-tooling**, making state management, storage, and app tooling easier and fully accessible with zero dependencies.

##
![npm](https://img.shields.io/npm/v/ripple-file-router)
![downloads](https://img.shields.io/npm/dt/ripple-file-router)
![license](https://img.shields.io/npm/l/ripple-file-router)
<img src="https://www.ripplejs.com/ripple-logo-horizontal.png" alt="Ripple Logo" width="100" style="margin-left:30px; height:30px;" />
<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="22" fill="none" stroke="#00f0ff" stroke-width="2"/>
  <circle cx="50" cy="50" r="32" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="6 3"/>
  <rect x="38" y="38" width="24" height="28" fill="#00f0ff" rx="2"/>
  <line x1="41" y1="45" x2="59" y2="45" stroke="#121212" stroke-width="2" stroke-linecap="round"/>
  <line x1="41" y1="52" x2="59" y2="52" stroke="#121212" stroke-width="2" stroke-linecap="round"/>
  <line x1="41"




##

## Installation

```bash
npm install ripple-file-router
npx ripple-file-router init  
```

or

```bash
yarn add ripple-file-router
npx ripple-file-router init  
```

## Quick Start
 
After initiating ripple-file-router, the pages directory, the routes.ts file for you app modules and the configured App.ripple file will be visible in your project src dir. The App.ripple is optional to overwrite.

### Directory Structure

Here's an example `pages/` directory:

```
pages/
├── index.ripple        # Home page
├── about.ripple        # About page
└── users/
    └── [id]/
        └── user/
            └── [username]/
                └── comments/
```

Dynamic segments use `[param]` notation like `[id]` or `[username]`.

---

### App Component

```ts
import {PageRoutes} from "ripple-file-router"
import { modules } from "./routes";

export component App() {
        <PageRoutes modules={modules}  />
}
```

That's it! Your routing is now set up. `PageRoutes` automatically reads your `pages/` folder and matches routes, including dynamic parameters.

---

### Link Component

Use the `Link` component for navigation:

```ts
import Link from "ripple-file-router"

export component Navigation() {
  <nav>
    <Link href="/"><p>{"Home"}</p></Link>
    <Link emitEvent={false}  href="/about"><p>{"About"}</p></Link>
    <Link href="/users/42/user/john" queries={{name: "John", age: 20}}><p>{"User Profile"}</p></Link>
  </nav>
}
```

#### Props:

| Prop               | Type                  | Default | Description                                   |
| ------------------ | --------------------- | ------- | --------------------------------------------- |
| `href`             | `string`              | —       | Path to navigate to                           |
| `children`         | `Component`           | —       | Content to render inside link                 |
| `onLoading`        | `() => void`          | —       | Callback when navigation starts               |
| `emitEvent`        | `boolean`             | `true`  | Whether to trigger route events for this link |
| `loadingComponent` | `Component`           | —       | Optional component to show while loading      |
| `className`        | `string`              | —       | Additional CSS class names for styling        |
| `queries`          | `Record<string, any>` | —       | Optional query parameters for URLSearch       |


---

### Router And Events

You can subscribe to router events if you need custom behavior:

```ts
import { useRouter } from "ripple-file-router"

const router = useRouter();

router.on("start", path => console.log("Navigating to:", path));
router.on("complete", path => console.log("Navigation finished:", path));
router.on("change", path => console.log("Route changed:", path));



//Guard back navigation
router.beforePopState((url) => {
  if (url === "/protected") {
    console.log("Navigation blocked:", url);
    return false; // Cancel navigation
  }
});

// Navigate to a new route
router.push("/users/42?tab=posts");
router.push("/users/42?tab=posts", true, false, {name: "John", age: 20}); // path, emitEvent, shallow (partial url change), queries


//Replace URL shallowly (no full sync)//
router.replace("/users/42?tab=profile", true, true);

// Prefetch a route
router.prefetch("/about");

// Resolve href
console.log("Resolved href:", router.resolveHref("/contact?ref=home"));

// Access reactive properties
console.log("Current path:", router.path);
console.log("Query params:", router.queries);
console.log("Dynamic params:", router.params);
console.log("Full URL:", router.asPath);

// Access full URL info
console.log(router.host);
console.log(router.hostname);
console.log(router.origin);
console.log(router.protocol);
console.log(router.port);
console.log(router.href);
console.log(router.search);
console.log(router.hash);
```

* `start`: triggered before navigation begins
* `complete`: triggered after navigation finishes
* `change`: triggered on every path change

You can opt out of events per `Link` with `emitEvent={false}`.

---

### Dynamic Route Params

Access route params and queries in any component:

```ts
import { useRouter } from "ripple-file-router"

export component UserProfile() {
  const router = useRouter();
  
  const id = router.params.id;           // dynamic param
  const username = router.params.username;
  const queryName = router.queries.name; // URL query ?name=...
  // or 
  const {params, queries} = router;
  
  <div>
    {"User ID: " + id}
    {"Username: " + username}
    {"Query name: " + queryName}
  </div>
}
```

---

### Global Loading Indicator (Optional)
you can disable it with props ```ts
 <PageRoutes enableLoader={false} /> 
``` 

```ts
import {PageRoutes} from "ripple-file-router"
import { modules } from "./routes";

export component App() {
        <PageRoutes modules={modules} enableLoader={false} />
}

```


---

---

### A minimal reactive store that manages shared state across your app with an intuitive API. It provides reactivity, persistence, and derived state — all in under a few lines of code.

| Feature                        | Description                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| **`get()`**                    | Returns the current store value.                                                         |
| **`set(next)`**                | Replaces the entire store value.                                                         |
| **`update(partialOrFn)`**      | Merges new data into the store. Supports both object patching and callback styles.       |
| **`subscribe(fn, selector?)`** | Reactively listens for state changes, optionally to a selected portion.                  |
| **`derive(selector)`**         | Creates a new store derived from a specific part of another store (like computed state). |
| **`delete(keys)`**             | Removes one or more keys from the store.                                                 |
| **`clear()`**                  | Resets store to initial state and removes persisted data.                                |
| **`persist` (option)**         | Automatically saves and restores state from `localStorage`.                              |



-------------------- Example Stores --------------------
```ts
 //* Route store for storing current route path
 //* Persisted in localStorage as "routeStore"
 //*/
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

```
Here are extra two simple Hello World store examples for getting started and explain things better.

### Store without persist (default)
```ts
import { createStore } from "ripple-file-router"

// Create a simple store
const helloStore = createStore({ message: "Hello World!" });

// Subscribe to changes
helloStore.subscribe(state => {
  console.log("Current message:", state.message);
});

// Get changes anywhere
const data = helloStore.get();
console.log(helloStore) // { message: Current message}
console.log(data.message) // Current message


// Update the store
helloStore.update({ message: "Hello Ripple!" });

// Output:
// Current message: Hello World!
// Current message: Hello Ripple!



```

### Store with persist

```ts
import { createStore } from "ripple-file-router"
import { track } from "ripple"

const message = track("")

// Create a persisted store
const persistentHelloStore = createStore(
  { message: "Hello Persistent World!" },
  { persist: true, storageKey: "helloStore" }
);

// Subscribe to changes
persistentHelloStore.subscribe(state => {
  console.log("Current message:", state.message);
});


// Get changes anywhere
const data = helloStore.get();
console.log(helloStore) // { message: Current message}
console.log(data.message) // Current message


// Update the store
persistentHelloStore.update({ message: "Updated and Persisted!" });


// Callback update (safe addition)
persistentHelloStore.update(prev => ({ message: prev.message + " " +  @message }));


// Reload the page and subscribe again
persistentHelloStore.subscribe(state => {
  console.log("After reload:", state.message);
});

// Output (after reload):
// After reload: Updated and Persisted!



export const appStore = createStore(
  {
    user: { name: "Joe", location: "unknown", preferences: [] },
    count: 0,
    theme: "light",
  },
  { persist: true, storageKey: "appStore" }
);



// Subscribe to entire state
appStore.subscribe(s => console.log("State changed:", s));

// Watch a specific value
appStore.watch(s => s.count, (n, o) => console.log(`Count: ${o} → ${n}`));

// Use middleware for logging
appStore.use((state, action, payload) =>
  console.log(`[${action}]`, payload, state)
);

// Partial update
appStore.update({ count: 1 });

// Callback update (safe addition)
appStore.update(prev => ({ count: prev.count + 1 }));

// Derived store
const themeStore = appStore.derive(s => s.theme);
themeStore.subscribe(theme => console.log("Theme:", theme));

// Clear store
appStore.clear();


```


### Here’s a concise side-by-side comparison between ripple-file-router createStore and Zustand:

| Feature / Aspect         | **createStore** (ripple-file-router) | **Zustand**                              |
| ------------------------ | ------------------------------------ | ---------------------------------------- |
| **Size / Complexity**    | Ultra-light (~2 KB)                  | Larger, includes middleware and devtools |
| **Reactivity Model**     | Manual `subscribe` / `derive`        | React hooks (`useStore`)                 |
| **Selectors**            | Optional selector argument           | Built-in via hooks                       |
| **Persistence**          | Native `persist` option              | Needs middleware plugin                  |
| **DevTools Integration** | Coming soon                          | Built-in Redux DevTools support          |
| **Middleware**           | Planned via `use()`                  | Full middleware API                      |
| **Callback Updates**     | Supported: `update(prev => {...})`   | Supported: `set(state => {...})`         |
| **Derived Stores**       | `derive(selector)`                   | Selectors or derived state               |
| **Performance**          | Minimal overhead                     | Optimized for React, slightly heavier    |
| **Framework Support**    | Framework-agnostic                   | React-only                               |
| **TypeScript**           | Fully typed generics                 | Excellent TS support                     |
| **Persistence Control**  | Built-in localStorage                | Plugin required                          |
| **Use Case Fit**         | Libraries & multi-framework projects | React apps needing global state          |

---


## Minimal IndexDB Manager with Zero Dependencies.

 📘 Example Usage
 -------------------------------------------------------------------------- 

   ✅ Minimal Example
 ```ts
 const userStore = createIndexDBStore({
  storeName: 'users',
 });
 await userStore.add({ id: 'u1', name: 'Joseph', age: 22 });
 const all = await userStore.getAll();
  console.log(all);
 ```
 
   ✅ Full Configuration Example
   ```ts
   interface User {
     id: string;
     name: string;
     age: number;
   }
  
   const userStore = createIndexDBStore<User>({
     dbName: "MyAppDB",
     storeName: "users",
     keyPath: "id",
     version: 1,
   });
  
   // ➕ Add record
   await userStore.add({ id: 'u1', name: 'Ada', age: 45 });
  
   // 🔁 Update record by key or object
   await userStore.update('u1', { age: 46 });
  
   // 🔍 Get a record by key
   const user = await userStore.get('u1');
   console.log('Single user:', user);
  
   // 📦 Get all records
   const allUsers = await userStore.getAll();
   console.log('All users:', allUsers);
  
   // ❌ Remove record by ID
   await userStore.remove('u1');
  
   // 🧹 Clear all records
   await userStore.clear();
  
   // 🔎 Query using a filter function
   const adults = await userStore.query(u => u.age > 30);
   console.log('Adults:', adults);
  
   // 👂 Subscribe to store changes (reactive)
   const unsubscribe = userStore.subscribe(state => {
     console.log('Store changed:', state.items);
   });
  
   // 👁️ Watch specific property or subset of data
   const watchAdults = userStore.deriveQuery(items => items.filter(u => u.age > 30));
   watchAdults.subscribe(adults => console.log('Adults updated:', adults));
  
   // 🔦 Filter (where)
   const namedJohn = await userStore.where({ name: 'John' });
   console.log('Users named John:', namedJohn);
  
   // 🥇 Get first matching record
   const firstUser = await userStore.first({ age: 46 });
   console.log('First matching user:', firstUser);
  
   // 🔍 Find by ID (alias for get)
   const found = await userStore.find('u1');
   console.log('Found user:', found);
  
   // 🧩 Put (alias for update)
   await userStore.put({ id: 'u1', name: 'Ada', age: 50 });
  
   // 💳 Perform custom transaction
   await userStore.transaction(tx => {
     const store = tx.objectStore('users');
     store.add({ id: 'u2', name: 'Ken', age: 35 });
   });
  
   // 🧭 Watch specific user reactively
   const watchUser = userStore.deriveQuery(items => items.find(u => u.id === 'u1') || null);
   watchUser.subscribe(u => console.log('u1 changed:', u));
  
   // 🧹 Unsubscribe from store updates
   unsubscribe();
   ```
  
   ✅ Multi-Store Example (using IndexDBManager)
   ```ts
   interface User {
     id: string;
     name: string;
   }
  
   interface Post {
     id: string;
     title: string;
   }
  
   // Create manager
   const db = new IndexDBManager("MyAppDB");
  
   // Create multiple stores
   const users = db.createStore<User>("users", "id");
   const posts = db.createStore<Post>("posts", "id");
  
   // Add data
   await users.add({ id: "u1", name: "Joe" });
   await posts.add({ id: "p1", title: "Hello World" });
  
   // Query data
   const allUsers = await users.getAll();
   const allPosts = await posts.getAll();
  
   console.log(allUsers, allPosts);
  
   // Watch updates
   users.subscribe(state => console.log("Users changed:", state.items));
   posts.subscribe(state => console.log("Posts changed:", state.items));
   ```

 ## IndexDB with offline/online live database synchronization
 
 This is experimental currently. This api allows you make your apps offline first.

   ```ts
  const userStore = createIndexDBStore<User>({
    dbName: "MyAppDB",
    storeName: "users",
    keyPath: "id",
    version: 1,
    sync: {
      endpoint: "https://api.example.com/users",
      async push(item, action) {
        // simple example using fetch
        if (action === "add") await fetch(this.endpoint!, { method: "POST", body: JSON.stringify(item) });
        if (action === "update") await fetch(`${this.endpoint}/${(item as any).id}`, { method: "PUT", body: JSON.stringify(item) });
        if (action === "remove") await fetch(`${this.endpoint}/${(item as any).id}`, { method: "DELETE" });
      },
      async pull() {
        const res = await fetch("https://api.example.com/users");
        return res.json();
      },
      interval: 15000,
      autoSync: true,
      onOffline: () => console.log("User store offline"),
      onOnline: () => console.log("User store online"),
    },
  });
 
  // Multi-store manager usage with global + per-store callbacks:
 
  const db = new IndexDBManager("MyAppDB", 1, {
    onOffline: () => console.log("Global offline"),
    onOnline: () => console.log("Global online"),
  });
 
  // per-store callbacks override global if provided
  const users = db.createStore<User>("users", "id", {
    sync: {
      onOffline: () => console.log("Users store offline"),
      onOnline: () => console.log("Users store online"),
    }
  });
 
  const posts = db.createStore<{ id: string; title: string }>("posts", "id");

  ```


### Features

* File-based routing
* Dynamic route segments `[param]`
* URL query support
* Optional per-link router events
* Reactive `Link` component with optional loading UI
* Global progress loader
* Minimal setup—just structure `pages/`
* Minimal indexDB manager with zero dependencies.
* Zustand like global state management available in and outside components






# ripple-tools
