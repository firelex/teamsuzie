import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
