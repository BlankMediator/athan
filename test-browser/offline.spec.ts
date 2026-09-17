import { test, expect, chromium } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { calculateDay } from '../src/prayers.js';

test('browser keeps settings, unseen calendars, catalogue, readings, exports and audio after disconnect and reload', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A moment for what matters.' })).toBeVisible();
  await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect(page.getByRole('button', { name: 'Close window' })).toHaveCount(0);
  const initial = await page.evaluate(() => window.athan.snapshot());
  await page.evaluate(async () => {
    const s = await window.athan.snapshot();
    s.config.locations.push({ id: 'berlin', name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.405, timeZone: 'Europe/Berlin' });
    s.config.activeLocation = 'berlin'; s.config.calculation.madhab = 'Hanafi'; s.config.hour12 = false;
    await window.athan.saveConfig(s.config);
    await window.athan.preferences({ theme: 'dark', favoriteDuas: ['daily-dua-1'] });
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Athan & sounds' }).click();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Browse Fajr recording', exact: true }).click();
  // One second of silent PCM, safe to preview during automated testing.
  const wav = Buffer.alloc(44 + 16000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
  await (await fileChooser).setFiles({ name: 'offline-test.wav', mimeType: 'audio/wav', buffer: wav });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Your changes have been saved.', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.offline-status strong')).toHaveText('Offline · your prayer information is available');
  const saved = await page.evaluate(() => window.athan.snapshot());
  expect(saved.config.activeLocation).toBe('berlin'); expect(saved.config.hour12).toBe(false);
  expect(saved.preferences.theme).toBe('dark'); expect(saved.preferences.favoriteDuas).toContain('daily-dua-1');
  expect(saved.config.audio.prayers.fajr.file).toContain('offline-test.wav');
  expect(saved.day.times).toEqual(JSON.parse(JSON.stringify(calculateDay(saved.config, saved.today))).times);
  expect(saved.day.qibla).not.toBe(initial.day.qibla);
  const nextYear = await page.evaluate(() => window.athan.calendarMonth('2028-03'));
  expect(nextYear.days).toHaveLength(31); expect(nextYear.days[30]!.times.fajr).toBeTruthy();
  expect((await page.evaluate(() => window.athan.cities('NZ', 'Auckland'))).locations.length).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.athan.devotionLibrary())).duas.length).toBeGreaterThan(90);
  const tomorrow = await page.evaluate(() => window.athan.snapshot('2027-01-01'));
  expect(tomorrow.day.date).toBe('2027-01-01'); expect(tomorrow.day.times.fajr).toBeTruthy();
  await page.getByRole('navigation').getByRole('button', { name: 'Athan & sounds' }).click();
  await page.getByRole('button', { name: 'Preview Fajr recording', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.athan.snapshot())).runtime.playing).not.toBeNull();
  await page.evaluate(() => window.athan.dismissAlerts());
  expect((await page.evaluate(() => window.athan.snapshot())).runtime.error).toBeNull();
  for (const format of ['csv', 'ics'] as const) {
    const downloaded = page.waitForEvent('download'); await page.evaluate(format => window.athan.exportCalendar('2028-03', format), format);
    const download = await downloaded, file = await download.path();
    expect(download.suggestedFilename()).toBe(`Athan-March 2028.${format}`);
    expect(readFileSync(file!, 'utf8')).toContain(format === 'csv' ? '2028-03-31' : 'BEGIN:VEVENT');
  }
  // Headless printing returns without an OS dialog; inspect the actual offline print document.
  expect(await page.evaluate(() => window.athan.exportPdf({ layout: 'month', year: 2028, month: 3 }))).toContain('Save as PDF');
  await expect(page.frameLocator('iframe[title="Printable prayer calendar"]').locator('body')).toContainText('Berlin');
  expect(errors).toEqual([]);
});

test('browser restarts offline with its saved profile and advances the local day', async ({ baseURL }) => {
  const profile = mkdtempSync(resolve('test-results/browser-restart-'));
  let context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true });
  try {
    let page = context.pages()[0]!; await page.goto(baseURL!);
    await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
    await page.evaluate(async () => { const s = await window.athan.snapshot(); s.config.calculation.adjustments.fajr = 7; await window.athan.saveConfig(s.config); });
    await context.close();
    context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, offline: true });
    page = context.pages()[0]!;
    await page.clock.setFixedTime(new Date('2026-10-07T05:00:00Z'));
    await page.goto(baseURL!);
    await expect(page.locator('.prayer-card')).toHaveCount(6);
    const s = await page.evaluate(() => window.athan.snapshot());
    expect(s.today).toBe('2026-10-07'); expect(s.config.calculation.adjustments.fajr).toBe(7);
    expect(s.day.times.fajr).toBe(calculateDay(s.config, s.today).times.fajr!.toISOString());
  } finally { await context.close(); }
});

test('online search results are retained and labelled after connection loss', async ({ page, context }) => {
  await context.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{ id: 2950159, name: 'Berlin', country: 'Germany', country_code: 'DE', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' }] } }));
  await page.goto('/'); await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  expect((await page.evaluate(() => window.athan.search('Berlin', true, 'DE'))).cached).toBe(false);
  await context.unrouteAll(); await context.setOffline(true); await page.reload();
  await expect(page.locator('.prayer-card')).toHaveCount(6);
  const result = await page.evaluate(() => window.athan.search('berlin', true, 'de'));
  expect(result.cached).toBe(true); expect(result.cacheWarning).toContain('saved search'); expect(result.locations[0]!.timeZone).toBe('Europe/Berlin');
});

test('offline setup failure is visible and a later reload recovers', async ({ page, context }) => {
  await context.route('**/locations/cities.json.gz', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.offline-status strong')).toHaveText('Offline download did not finish. Reconnect and reload to try again.');
  expect((await page.evaluate(() => window.athan.snapshot())).day.times.fajr).toBeTruthy();
  await context.unrouteAll(); await page.reload();
  await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
});

test('only one browser tab runs alerts and completed events are not replayed', async ({ page, context }) => {
  await page.goto('/'); await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  const s = await page.evaluate(() => window.athan.snapshot()), at = s.day.times.dhuhr!;
  await page.clock.setFixedTime(new Date(+new Date(at) + 1000));
  await page.evaluate(async () => { const s = await window.athan.snapshot(); s.config.audio.enabled = false; await window.athan.saveConfig(s.config); await window.athan.running(true); });
  await expect.poll(async () => (await page.evaluate(() => window.athan.snapshot())).history.filter(h => h.id.endsWith(':dhuhr:athan') && h.status === 'delivered').length).toBe(1);
  const other = await context.newPage(); await other.goto('/'); await expect(other.locator('.prayer-card')).toHaveCount(6);
  expect(await other.evaluate(() => window.athan.running(true).then(() => '', e => String(e)))).toContain('another Athan tab');
  await page.reload(); await expect(page.locator('.prayer-card')).toHaveCount(6);
  await page.clock.setFixedTime(new Date(+new Date(at) + 2000));
  await page.evaluate(() => window.athan.running(true));
  expect((await page.evaluate(() => window.athan.snapshot())).history.filter(h => h.id.endsWith(':dhuhr:athan') && h.status === 'delivered')).toHaveLength(1);
  await page.evaluate(() => window.athan.running(false));
});

test('phone layout keeps every main page within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  for (const label of ['Today', 'Calendar', 'Qibla', 'Athan & sounds', 'Reminders', 'Hisnul Muslim', 'Hadith library', 'Settings']) {
    await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.page-content')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), label).toBeLessThanOrEqual(390);
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Today', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/browser-phone.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'docs/screenshots/browser-desktop.png', fullPage: true, animations: 'disabled' });
});
