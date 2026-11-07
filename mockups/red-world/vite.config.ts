import { defineConfig } from 'vite';

// Localhost only: never expose this dev server on the network.
export default defineConfig({
  server: { host: '127.0.0.1', port: 5183, strictPort: false },
  preview: { host: '127.0.0.1' },
  build: { target: 'esnext' },
});
