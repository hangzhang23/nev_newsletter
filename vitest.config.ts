import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'frontend/src/**/*.test.ts'],
    environment: 'node',
  },
});
