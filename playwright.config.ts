import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './test-desktop', outputDir: './test-results/desktop', timeout: 60000, workers: 1, retries: 0,
  reporter: 'list', use: { trace: 'retain-on-failure' } });
