import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    // Split vendor chunk so app code caching is not invalidated by deps changes
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['canvas-confetti']
        }
      }
    },
    // Expose PWA-friendly asset names: keep hashes for cache busting
    assetsInlineLimit: 4096
  },
  preview: {
    port: 4173
  }
});
