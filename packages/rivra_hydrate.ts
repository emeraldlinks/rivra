// src/rivra_hydrate.ts
type ComponentModule = Record<string, any>;

async function hydrateNode(node: Element) {
  const id = node.getAttribute("data-_rivra_id");
  const modUrl = node.getAttribute("data-_rivra_mod");
  const propsJson = node.getAttribute("data-_rivra_props") || "null";
  let props;
  try {
    props = JSON.parse(propsJson);
  } catch {
    props = null;
  }

  if (!modUrl || !id) return;

  try {
    // dynamic import — works in dev because vite serves /src/..., in prod you should ensure /_rivra_modules/* is served
    const mod: ComponentModule = await import(modUrl);
    // find exported component by name; fallback to default or first export
    const Comp = mod[id] ?? mod.default ?? Object.values(mod)[0];

    if (!Comp) {
      console.warn("Rivra: component export not found", id, modUrl);
      return;
    }

    // if the module exposes hydrate(el, props) call it
    if (typeof Comp.hydrate === "function") {
      try {
        await Comp.hydrate(node, props);
        console.debug(`Rivra: hydrated ${id}`);
        return;
      } catch (err) {
        console.warn("Rivra: error in component.hydrate, falling back to render:", id, err);
      }
    }

    // fallback: if Comp is a function that returns HTML string, call it and diff/patch or replace innerHTML
    if (typeof Comp === "function") {
      const out = Comp(props);
      if (typeof out === "string") {
        // naive fallback: only replace innerHTML (keeps the wrapper node)
        node.innerHTML = out;
        console.debug(`Rivra: rendered fallback for ${id}`);
        return;
      } else if (out && out.body) {
        node.innerHTML = out.body;
        return;
      }
    }

    // if module exports per-component hydrate functions separately
    if (typeof mod.hydrate === "function") {
      await mod.hydrate(node, props);
      return;
    }

    console.warn("Rivra: no hydrate or render fallback for", id);
  } catch (err) {
    console.error("Rivra: failed to hydrate", id, modUrl, err);
  }
}

export async function hydrateAll(root: Element | Document = document) {
  // use querySelectorAll on the document or container
  const nodes = Array.from((root as Element).querySelectorAll?.("[data-_rivra_id]") ?? []);
  // hydrate sequentially to avoid simultaneous heavy imports; you can parallelize if desired
  for (const node of nodes) {
    // Avoid hydrating nodes already hydrated
    if ((node as Element).getAttribute("data-_rivra_hydrated") === "1") continue;
    await hydrateNode(node as Element);
    (node as Element).setAttribute("data-_rivra_hydrated", "1");
  }
}

// Optionally auto-run
if (typeof window !== "undefined") {
  // run on next tick so DOM is ready
  setTimeout(() => {
    hydrateAll().catch((e) => console.error("Rivra hydrate error", e));
  }, 0);
}
