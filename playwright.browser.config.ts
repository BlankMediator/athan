import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test-browser', outputDir: './test-results/browser', timeout: 90000, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4175', channel: 'msedge', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve-browser.mjs', env: { ATHAN_BROWSER_PORT: '4175' }, url: 'http://127.0.0.1:4175', reuseExistingServer: false },
});
