import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [
    vue(),
    // Emit pre-compressed .gz and .br siblings so nginx can serve them
    // instantly via gzip_static / brotli_static without CPU overhead.
    compression({ algorithms: ['gzip'], exclude: /\.(png|jpe?g|gif|webp|ico|svg)$/ }),
    compression({ algorithms: ['brotliCompress'], exclude: /\.(png|jpe?g|gif|webp|ico|svg)$/ }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src-vue', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    port: 5173,
    // lib-jitsi-meet is not bundled; proxy /libs/ to the jitsi-web container so
    // dev uses the same library build as the running bridge. Override the target
    // with VITE_JITSI_LIBS_ORIGIN if jitsi-web is reachable on another origin.
    proxy: {
      '/libs': {
        target: process.env.VITE_JITSI_LIBS_ORIGIN || 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_API_ORIGIN || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
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
          if (id.includes('node_modules/emoji-mart-vue-fast')) {
            return 'vendor-emoji';
          }
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
