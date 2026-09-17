import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { defaultConfig } from '../src/config.js';

test('desktop retains its location, full catalogue and calendars with network disabled after restart', async () => {
  const root = resolve('.'); mkdirSync(join(root, 'test-results'), { recursive: true });
  const profile = mkdtempSync(join(root, 'test-results/offline-desktop-'));
  const config = defaultConfig(); config.audio.enabled = false; config.calculation.adjustments.fajr = 4;
  writeFileSync(join(profile, 'config.json'), JSON.stringify(config));
  writeFileSync(join(profile, 'desktop.json'), JSON.stringify({ notifications: false, closeToTray: false }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v !== undefined && k !== 'ELECTRON_RUN_AS_NODE')) as Record<string, string>;
  const launch = () => electron.launch({ executablePath: join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env: { ...env, ATHAN_DATA_DIR: profile }, timeout: 20000 });
  let app = await launch();
  try {
    let page = await app.firstWindow(); await expect(page.locator('.prayer-card')).toHaveCount(6);
    // The optional search provider is isolated from the network and returns a validated fixture.
    await app.evaluate(({ net }) => {
      net.fetch = async () => new Response(JSON.stringify({ results: [{ id: 2950159, name: 'Berlin', country: 'Germany', country_code: 'DE', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' }] }));
      net.isOnline = () => true;
    });
    const search = await page.evaluate(() => window.athan.search('Berlin', true, 'DE'));
    expect(search.cached).toBe(false);
    await page.evaluate(async () => { const s = await window.athan.snapshot(); s.config.hour12 = false; await window.athan.saveConfig(s.config); });
    await app.close(); app = await launch();
    page = await app.firstWindow(); await expect(page.locator('.prayer-card')).toHaveCount(6);
    await app.evaluate(({ net, BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.webContents.session.enableNetworkEmulation({ offline: true });
      net.fetch = async () => { throw new Error('Test: no internet reception'); }; net.isOnline = () => false;
    });
    const saved = await page.evaluate(() => window.athan.snapshot());
    expect(saved.config.hour12).toBe(false); expect(saved.config.calculation.adjustments.fajr).toBe(4);
    expect(saved.day.times.fajr).toBeTruthy(); expect(saved.day.qibla).toBeGreaterThan(0);
    expect((await page.evaluate(() => window.athan.calendarMonth('2029-01'))).days).toHaveLength(31);
    expect((await page.evaluate(() => window.athan.cities('JP', 'Tokyo'))).locations.length).toBeGreaterThan(0);
    expect((await page.evaluate(() => window.athan.devotionLibrary())).duas.length).toBeGreaterThan(90);
    const cached = await page.evaluate(() => window.athan.search('berlin', true, 'DE'));
    expect(cached.cached).toBe(true); expect(cached.locations).toEqual(search.locations);
    await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.locator('.calendar-day')).not.toHaveCount(0);
  } finally { await app.close(); }
});
