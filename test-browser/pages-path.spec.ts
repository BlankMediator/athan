import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

test('the Pages subdirectory loads, caches audio and reopens offline without controlling the main site', async ({ browser }) => {
  const root = resolve('browser-ui');
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    if (!path.startsWith('/athan/')) { res.writeHead(404).end(); return; }
    const file = resolve(root, path.slice('/athan/'.length) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const context = await browser.newContext();
  try {
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${port}/athan/`);
    await expect(page.locator('.offline-status summary')).toHaveText('Available offline', { timeout: 30000 });
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.scope)).toBe(`http://127.0.0.1:${port}/athan/`);
    expect(await page.evaluate(async () => navigator.serviceWorker.getRegistration('/'))).toBeUndefined();
    await context.setOffline(true); await page.reload();
    await expect(page.locator('.prayer-card')).toHaveCount(6);
    expect(await page.evaluate(() => window.athan.recordings())).toHaveLength(7);
    expect((await page.evaluate(() => window.athan.cities('AU', 'Coburg'))).locations.length).toBeGreaterThan(0);
  } finally { await context.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
