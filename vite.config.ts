// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "vite-ripple-loader",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith(".ripple")) {
          return id; // mark as handled
        }
      },
      load(id) {
        if (id.endsWith(".ripple")) {
          // Example: just wrap the file path as a component
          return `export default function RipplePage() {
            return "Loaded ripple file: ${id}";
          }`;
        }
      },
    },
  ],
});
