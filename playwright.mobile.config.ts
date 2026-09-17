import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test-mobile', outputDir: './test-results/mobile', timeout: 60000, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4176', channel: 'msedge', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, trace: 'retain-on-failure' },
  webServer: { command: 'npx vite preview ui --config ui/vite.config.ts --mode mobile --host 127.0.0.1 --port 4176 --strictPort', url: 'http://127.0.0.1:4176', reuseExistingServer: false },
});
