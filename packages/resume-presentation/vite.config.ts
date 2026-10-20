import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname, 'harness'),
  plugins: [react()],
  resolve: {
    alias: {
      '@resume-studio/studio-contracts': path.resolve(
        __dirname,
        '../studio-contracts/src/index.ts',
      ),
      '@resume-studio/resume-presentation': path.resolve(__dirname, 'src/index.ts'),
    },
  },
});
