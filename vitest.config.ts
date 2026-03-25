import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src-vue', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src-vue/**/*.test.ts', 'src-vue/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src-vue/workers/**', 'public/**'],
    },
  },
});
