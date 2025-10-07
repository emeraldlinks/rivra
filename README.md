# ripple-file-router

A minimal, file-based routing system for **Ripple.js**. Automatically generates routes from your .ripple pages, supports nested directories, includes global router loader and persistent state manager. Structure your `pages/` directory and start routing with a single component.


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
 
After initiating ripple-file-router, the pages directory and the configured App.ripple file will be visible in your project src dir. The App.ripple is optional to overwrite.

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
    <Link emitEvent={false} href="/about"><p>{"About"}</p></Link>
    <Link href="/users/42/user/john"><p>{"User Profile"}</p></Link>
  </nav>
}
```

#### Props:

| Prop               | Type         | Default | Description                                   |
| ------------------ | ------------ | ------- | --------------------------------------------- |
| `href`              | `string`     | —       | Path to navigate to                           |
| `children`         | `Component`  | —       | Content to render inside link                 |
| `onLoading`        | `() => void` | —       | Callback when navigation starts               |
| `emitEvent`        | `boolean`    | `true`  | Whether to trigger route events for this link |
| `loadingComponent` | `Component`  | —       | Optional component to show while loading      |

---

### Router Events

You can subscribe to router events if you need custom behavior:

```ts
import { useRouter } from "ripple-file-router"

const router = useRouter();

router.on("start", path => console.log("Navigating to:", path));
router.on("complete", path => console.log("Navigation finished:", path));
router.on("change", path => console.log("Route changed:", path));
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

`GlobalLoader` reacts to router events and shows a top progress bar automatically.

---

---

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

// Reload the page and subscribe again
persistentHelloStore.subscribe(state => {
  console.log("After reload:", state.message);
});

// Output (after reload):
// After reload: Updated and Persisted!


```

---

### Features

* File-based routing
* Dynamic route segments `[param]`
* URL query support
* Optional per-link router events
* Reactive `Link` component with optional loading UI
* Global progress loader
* Minimal setup—just structure `pages/`
* Zustand like global state management available in and outside components