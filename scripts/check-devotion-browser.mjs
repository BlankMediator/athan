// An isolated browser smoke check for the shared reading/device additions.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const root = resolve('browser-ui');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ geolocation: { latitude: 52.52, longitude: 13.405, accuracy: 20 }, permissions: ['geolocation'] });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !!window.athan);
  const before = await page.evaluate(() => window.athan.snapshot());
  assert.equal(before.preferences.dailyHadith.enabled, false); assert.equal(before.preferences.dailyDua.enabled, false);
  assert.equal((await page.evaluate(() => window.athan.devotionLibrary())).duas.length, 268);
  const detected = await page.evaluate(() => window.athan.deviceLocation());
  assert.equal(detected.location.timeZone, 'Europe/Berlin'); assert.equal(detected.accuracy, 20);
  assert.equal((await page.evaluate(() => window.athan.snapshot())).config.activeLocation, before.config.activeLocation);
  await page.evaluate(() => window.athan.preferences({ dailyHadith: { enabled: true, time: '00:00' }, dailyDua: { enabled: true, time: '00:00' }, favoriteDuas: ['daily-dua-1'] }));
  assert.equal((await page.evaluate(() => window.athan.snapshot())).readingAlerts.length, 2);
  await page.reload(); await page.waitForFunction(() => !!window.athan);
  const restarted = await page.evaluate(() => window.athan.snapshot());
  assert.equal(restarted.readingAlerts.length, 0); assert.deepEqual(restarted.preferences.favoriteDuas, ['daily-dua-1']);
  await page.evaluate(async () => {
    // Simulate granted sensor permission only in this isolated test context.
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { value: async () => 'granted', configurable: true });
    window.sensorReadings = []; window.athan.subscribeCompass(value => window.sensorReadings.push(value));
    await window.athan.compass(true);
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { absolute: true, alpha: 45 }));
  });
  const sensor = await page.evaluate(() => window.sensorReadings.at(-1));
  assert.equal(sensor.magneticNorth, 315); assert.equal(sensor.trueNorth, null);
  await page.evaluate(() => window.athan.compass(false));
  await page.waitForFunction(async () => { const reg = await navigator.serviceWorker.getRegistration(); return !!reg?.active; });
  await context.setOffline(true);
  await page.reload(); await page.waitForFunction(() => !!window.athan);
  assert.equal((await page.evaluate(() => window.athan.devotionLibrary())).hadiths.length, 12);
  assert.equal((await page.evaluate(() => window.athan.cities('AU', 'Coburg'))).locations.length > 0, true);
  assert.deepEqual(errors, []);
  console.log('Browser readings, defaults, persistence, device location, compass fallback and offline library passed.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
