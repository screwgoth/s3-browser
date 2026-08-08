import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    // Playwright specs live in e2e/ and are run by `npx playwright test`.
    include: ['src/**/*.test.ts'],
  },
});
