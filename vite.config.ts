import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      overrides: {
        process: {
          nextTick: (callback: Function, ...args: any[]) => {
            Promise.resolve().then(() => callback(...args));
          }
        }
      }
    }),
  ],
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    }
  }
});