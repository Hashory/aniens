import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  plugins: [vue()],
  resolve: {
    alias: {
      '#app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '#vue': fileURLToPath(new URL('./src/vue', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:14202',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
