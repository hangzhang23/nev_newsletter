import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['ingest/**/*.test.ts', 'prerender/**/*.test.ts'],
    environment: 'node',
  },
});
