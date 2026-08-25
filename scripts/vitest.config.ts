import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['ingest/**/*.test.ts', 'prerender/**/*.test.ts', 'publish/**/*.test.ts', 'validate-snapshot/**/*.test.ts'],
    environment: 'node',
  },
});
