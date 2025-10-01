import { defineConfig } from 'vite';
import { ripple } from 'vite-plugin-ripple';
import path from 'path';

export default defineConfig(({ mode }) => ({
	plugins: [ripple()],
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
			external: ['ripple', /^ripple\//],
		},
	},
	root: path.resolve(__dirname),
}));