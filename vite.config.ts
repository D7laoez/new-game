import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500
  },
  preview: {
    port: 4173
  }
});
