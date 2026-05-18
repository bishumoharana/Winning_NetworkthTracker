import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:  './tests/integration',
  timeout:  30_000,
  retries:  1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    // Electron tests don't use a browser, but keep trace on failure for debugging
    trace: 'on-first-retry',
  },
});
