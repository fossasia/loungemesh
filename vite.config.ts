import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [
    vue(),
    // Emit pre-compressed .gz and .br siblings so nginx can serve them
    // instantly via gzip_static / brotli_static without CPU overhead.
    compression({ algorithm: 'gzip', exclude: /\.(png|jpe?g|gif|webp|ico|svg)$/ }),
    compression({ algorithm: 'brotliCompress', exclude: /\.(png|jpe?g|gif|webp|ico|svg)$/ }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src-vue', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Vite 8 / Rolldow requires a function, not a static object
        manualChunks(id) {
          if (
            id.includes('node_modules/vue/') ||
            id.includes('node_modules/vue-router/') ||
            id.includes('node_modules/pinia/')
          ) {
            return 'vendor-vue';
          }
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
