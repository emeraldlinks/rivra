import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [ripple(), tailwindcss()],
	server: {
		port: 3000
	}
});
