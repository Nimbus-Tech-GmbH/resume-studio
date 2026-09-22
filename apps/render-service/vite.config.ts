import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/server.ts',
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'server.js',
        format: 'es',
      },
    },
    target: 'node20',
  },
  ssr: {
    noExternal: true,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
});
