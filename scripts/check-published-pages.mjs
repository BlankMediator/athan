import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import manifest from '../assets/audio/defaults.json' with { type: 'json' };

const url = process.argv[2] ?? 'https://blankmediator.github.io/athan/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => document.querySelector('.offline-status summary')?.textContent === 'Available offline', null, { timeout: 120000 });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
  assert.equal(scope, new URL('./', page.url()).href);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.prayer-card');
  assert.equal(await page.locator('.prayer-card').count(), 6);
  const recordings = await page.evaluate(() => window.athan.recordings());
  assert.deepEqual(recordings.map(item => item.path).sort(), manifest.recordings.map(item => item.id).sort());
  const cities = await page.evaluate(() => window.athan.cities('AU', 'Coburg'));
  assert.ok(cities.locations.length > 0);
  const decoded = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('athan-browser', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const rows = await new Promise((resolve, reject) => { const request = db.transaction('audio').objectStore('audio').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    const decoder = new AudioContext();
    try { return await Promise.all(rows.map(async row => ({ id: row.id, duration: (await decoder.decodeAudioData(await row.blob.arrayBuffer())).duration }))); }
    finally { await decoder.close(); }
  });
  assert.equal(decoded.length, 7);
  assert.ok(decoded.every(item => item.duration > 1));
  console.log(`Verified ${url}: HTTPS, service-worker scope, offline reload, prayer times, city search and all seven decoded default recordings.`);
} finally { await browser.close(); }
