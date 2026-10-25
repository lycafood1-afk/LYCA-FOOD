import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./local/', import.meta.url)),
  base: '/admin-assets/',
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('../local-runtime/public/admin/', import.meta.url)),
    emptyOutDir: true,
  },
});
