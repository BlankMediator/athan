import { test, expect } from '@playwright/test';
import manifest from '../assets/audio/defaults.json' with { type: 'json' };

test('each browser profile stores all default recordings and can decode and play them after an offline restart', async ({ browser, baseURL }) => {
  for (let instance = 0; instance < 2; instance++) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); await page.goto(baseURL!);
      await expect(page.locator('.offline-status summary')).toHaveText('Available offline', { timeout: 30000 });
      const list = await page.evaluate(() => window.athan.recordings());
      expect(list.map(r => r.path).sort()).toEqual(manifest.recordings.map(r => r.id).sort());
      const config = (await page.evaluate(() => window.athan.snapshot())).config;
      expect(config.audio.prayers.fajr.file).toBe(manifest.defaults.fajr);
      expect(config.audio.prayers.isha.file).toBe(manifest.defaults.isha);
      await page.evaluate(async () => { const s = await window.athan.snapshot(); s.config.audio.volume = 0; await window.athan.saveConfig(s.config); });
      await context.setOffline(true); await page.reload();
      await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
      const records = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('athan-browser', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const rows = await new Promise<any[]>((resolve, reject) => { const request = db.transaction('audio').objectStore('audio').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        db.close();
        const decoder = new AudioContext();
        try { return await Promise.all(rows.map(async row => ({ id: row.id, bytes: row.blob.size, sha256: row.sha256, duration: (await decoder.decodeAudioData(await row.blob.arrayBuffer())).duration }))); }
        finally { await decoder.close(); }
      });
      for (const record of manifest.recordings) {
        const saved = records.find(r => r.id === record.id)!;
        expect(saved.bytes).toBe(record.bytes); expect(saved.sha256).toBe(record.sha256); expect(saved.duration).toBeGreaterThan(1);
      }
      await page.getByRole('navigation').getByRole('button', { name: 'Athan & sounds', exact: true }).click();
      await page.getByRole('button', { name: 'Preview Fajr recording', exact: true }).click();
      await expect.poll(async () => (await page.evaluate(() => window.athan.snapshot())).runtime.playing).toBe(manifest.defaults.fajr);
      await page.evaluate(() => window.athan.dismissAlerts());
      expect((await page.evaluate(() => window.athan.snapshot())).runtime.error).toBeNull();
    } finally { await context.close(); }
  }
});

test('caching preserves existing custom and deliberately silent choices', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.offline-status summary')).toHaveText('Available offline', { timeout: 30000 });
  await page.evaluate(async () => {
    const s = await window.athan.snapshot();
    s.config.audio.prayers.fajr.file = null; s.config.audio.prayers.fajr.enabled = false;
    s.config.audio.duaFile = null; s.config.audio.startupFile = 'default/makkah';
    await window.athan.saveConfig(s.config);
  });
  await page.reload(); await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  const audio = (await page.evaluate(() => window.athan.snapshot())).config.audio;
  expect(audio.prayers.fajr.file).toBeNull(); expect(audio.prayers.fajr.enabled).toBe(false);
  expect(audio.duaFile).toBeNull(); expect(audio.startupFile).toBe('default/makkah');
  expect(await page.evaluate(() => window.athan.recordings())).toHaveLength(7);
});

test('a failed recording download leaves calculations usable and retries on a later visit', async ({ page, context }) => {
  await context.route('**/audio/*.mp3', route => route.abort());
  await page.goto('/'); await expect(page.locator('.prayer-card')).toHaveCount(6);
  await expect(page.locator('.offline-status summary')).not.toHaveText('Available offline');
  await expect.poll(() => page.evaluate(async () => (await window.athan.diagnostics())[0]!.ok)).toBe(false);
  await context.unrouteAll(); await page.reload();
  await expect(page.locator('.offline-status summary')).toHaveText('Available offline', { timeout: 30000 });
  expect(await page.evaluate(() => window.athan.recordings())).toHaveLength(7);
});
