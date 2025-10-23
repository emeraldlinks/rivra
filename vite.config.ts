import { defineConfig, type PluginOption } from 'vite';
import { ripple } from 'vite-plugin-ripple';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [...(ripple() as PluginOption[])],
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: mode !== 'production',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['ripple', "node_modules", /^ripple\//],
    },
  },
  root: path.resolve(__dirname),
}));
