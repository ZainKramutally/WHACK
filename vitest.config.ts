import { defineConfig } from 'vitest/config';

// Only the app's own tests. mockups/worlds is a separate project with its own config.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
