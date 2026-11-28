import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src-vue', import.meta.url)),
      // Server-only dependencies, stubbed so server controller tests can
      // run under this runner without the server dependencies installed.
      jsonwebtoken: fileURLToPath(
        new URL('./server/src/controllers/__tests__/stubs/jsonwebtoken.ts', import.meta.url),
      ),
      'google-auth-library': fileURLToPath(
        new URL(
          './server/src/controllers/__tests__/stubs/google-auth-library.ts',
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src-vue/test/setup.ts'],
    include: ['src-vue/**/*.test.ts', 'src-vue/**/*.spec.ts', 'server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src-vue/**/*.{ts,vue}'],
      exclude: [
        'src-vue/**/*.test.ts',
        'src-vue/**/*.spec.ts',
        'src-vue/test/**',
        'src-vue/vite-env.d.ts',
        'src-vue/types/**',
        /** Interface-only module (no executable statements). */
        'src-vue/services/MediaService.ts',
        /** Browser-only MediaRecorder/canvas/AudioContext plumbing — not runnable in jsdom. */
        'src-vue/composables/useSessionRecorder.ts',
        /** Authentication store and component modules. */
        'src-vue/stores/authStore.ts',
        'src-vue/components/auth/**',
        'src-vue/components/home/ScheduleModal.vue',
        'src-vue/pages/HomePage.vue',
        'src-vue/components/layout/AppHeader.vue',
        'src-vue/components/session/SessionFeaturePanels.vue',
      ],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
