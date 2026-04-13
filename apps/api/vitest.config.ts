import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'lcov'],
    },
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@moongate/config': '/Users/ry/Documents/sponsorship/packages/config/src/index.ts',
      '@moongate/types': '/Users/ry/Documents/sponsorship/packages/types/src/index.ts',
      '@moongate/utils': '/Users/ry/Documents/sponsorship/packages/utils/src/index.ts',
    },
  },
});
