import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Integration tests share a Postgres DB and a Redis instance; run them
    // serially so resets in one file don't race with work in another.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
