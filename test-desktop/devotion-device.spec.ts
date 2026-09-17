import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { defaultConfig } from '../src/config.js';

const root = resolve('.'), shots = join(root, 'docs/screenshots');
let app: ElectronApplication, page: Page, profile: string, recording: string;
const errors: string[] = [];
test.describe.configure({ mode: 'serial' });
async function launch() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k !== 'ELECTRON_RUN_AS_NODE' && v !== undefined)) as Record<string, string>;
  app = await electron.launch({ executablePath: join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env: { ...env, ATHAN_DATA_DIR: profile } });
  page = await app.firstWindow(); page.on('pageerror', e => errors.push(String(e)));
  await expect(page.getByRole('heading', { name: 'A moment for what matters.' })).toBeVisible();
}
test.beforeAll(async () => {
  mkdirSync(join(root, 'test-results'), { recursive: true }); mkdirSync(shots, { recursive: true });
  profile = mkdtempSync(join(root, 'test-results/devotion-profile-'));
  mkdirSync(join(profile, 'recordings')); recording = join(profile, 'recordings/custom.wav'); writeFileSync(recording, '');
  const config = defaultConfig(); config.audio.enabled = false; config.audio.volume = 0; config.audio.prayers.fajr.file = recording;
  writeFileSync(join(profile, 'config.json'), JSON.stringify(config));
  writeFileSync(join(profile, 'desktop.json'), JSON.stringify({ notifications: false, closeToTray: true }));
  await launch();
});
test.afterAll(async () => { await app?.close(); });

test('dua library searches, filters, counts, copies and saves favorites with referenced hadith readings', async () => {
  const snap = await page.evaluate(() => window.athan.snapshot());
  expect(snap.preferences.dailyHadith.enabled).toBe(false); expect(snap.preferences.dailyDua.enabled).toBe(false);
  expect(snap.readingAlerts).toEqual([]);
  await page.getByRole('navigation').getByRole('button', { name: 'Hisnul Muslim' }).click();
  await expect(page.locator('.reading-index>p')).toHaveText('268 supplications');
  await page.getByLabel('Dua category').selectOption('chapter-28');
  await expect(page.locator('.reading-index>p')).toHaveText('13 supplications');
  await page.getByLabel('Search readings').fill('');
  expect(await page.locator('.reading-index button').count()).toBeGreaterThan(0);
  await page.locator('.reading-index button').first().click();
  await expect(page.locator('.dua-arabic')).toHaveAttribute('dir', 'rtl');
  const title = await page.locator('.dua-reading h2').innerText();
  await page.getByRole('button', { name: 'Save dua to favorites' }).click();
  await expect(page.getByRole('button', { name: 'Remove dua from favorites' })).toBeVisible();
  await page.getByRole('button', { name: 'Count recitation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Count recitation', exact: true })).toHaveText(/^1(?: \/.*)?$/);
  await page.getByRole('button', { name: 'Reset recitation count' }).click();
  await expect(page.getByRole('button', { name: 'Count recitation', exact: true })).toHaveText(/^0(?: \/.*)?$/);
  await app.evaluate(async ({ clipboard }) => { (globalThis as any).savedClipboard = await clipboard.readText(); });
  try {
    await page.getByRole('button', { name: 'Copy dua', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    expect(await app.evaluate(async ({ clipboard }, expected) => (await clipboard.readText()).includes(expected.replace(/^\d+[a-z]?\. /, '')), title)).toBe(true);
  } finally { await app.evaluate(({ clipboard }) => clipboard.writeText((globalThis as any).savedClipboard)); }
  await page.getByLabel('Dua category').selectOption('all'); await page.getByLabel('Search readings').fill('');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.locator('.reading-index>p')).toHaveText('1 supplications');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getElementById('main-content')!.scrollTo({ top: 0 }));
  await page.screenshot({ path: join(shots, 'duas-light.png'), animations: 'disabled' });
  await page.getByRole('tab', { name: 'Daily hadith collection' }).click();
  await expect(page.locator('.reading-index button')).toHaveCount(12);
  await expect(page.locator('.meaning-label').first()).toHaveText('Original Arabic narration');
  await app.evaluate(({ shell }) => { shell.openExternal = async url => { (globalThis as any).sourceUrl = url; }; });
  await page.getByRole('button', { name: 'Read on Sunnah.com' }).click();
  expect(await app.evaluate(() => (globalThis as any).sourceUrl)).toMatch(/^https:\/\/sunnah\.com\//);
  await page.screenshot({ path: join(shots, 'hadith-light.png'), animations: 'disabled' });
  await page.getByRole('tab', { name: 'Hisnul Muslim' }).click();
  await page.evaluate(() => window.athan.preferences({ theme: 'dark' }));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1100, 760));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: join(shots, 'duas-dark-compact.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.querySelector('.main-scroll')!.scrollWidth <= document.querySelector('.main-scroll')!.clientWidth)).toBe(true);
  await page.evaluate(() => window.athan.preferences({ theme: 'light' }));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1380, 920));
});

test('recording folder button starts in the selected recording directory and preserves cancellation', async () => {
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = (async (_window: unknown, options: any) => { (globalThis as any).audioDialog = options; return { canceled: true, filePaths: [] }; }) as any; });
  await page.getByRole('navigation').getByRole('button', { name: 'Athan & sounds' }).click();
  await page.getByRole('button', { name: 'Browse Fajr recording', exact: true }).click();
  expect(await app.evaluate(() => (globalThis as any).audioDialog.defaultPath)).toBe(dirname(recording));
  await expect(page.getByLabel('Fajr recording', { exact: true })).toHaveValue(recording);
  const bundled = (await page.evaluate(() => window.athan.recordings()))[0];
  if (bundled) {
    await page.getByLabel('Fajr recording', { exact: true }).selectOption(bundled.path);
    await page.getByRole('button', { name: 'Browse Fajr recording', exact: true }).click();
    expect(await app.evaluate(() => (globalThis as any).audioDialog.defaultPath)).toBe(dirname(bundled.path));
  }
  await page.getByLabel('Fajr recording', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Browse Fajr recording', exact: true }).click();
  expect(await app.evaluate(() => (globalThis as any).audioDialog.defaultPath)).toBeUndefined();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
});

test('device coordinates are reviewed before saving and compass handles live, magnetic and missing sensors', async () => {
  await app.evaluate(() => {
    const cp = process.getBuiltinModule('child_process'), original = cp.spawn;
    const { EventEmitter } = process.getBuiltinModule('events'), { PassThrough } = process.getBuiltinModule('stream');
    const state = (globalThis as any).devices = { geo: 'ok', compass: 'true', killed: 0, started: 0 };
    cp.spawn = function (exe: string, args: any, options: any) {
      const script = exe === 'powershell.exe' ? Buffer.from(args.at(-1), 'base64').toString('utf16le') : '';
      if (!script.includes('Windows.Devices.')) return original(exe, args, options);
      const child = new EventEmitter() as any; child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => { state.killed++; child.emit('close', 0); return true; };
      setTimeout(() => {
        if (script.includes('Geolocator')) { child.stdout.write(JSON.stringify(state.geo === 'ok' ? { latitude: -37.7352, longitude: 144.9693, accuracy: 18, source: 'Satellite', timestamp: new Date().toISOString() } : { error: 'Location access denied by Windows.' })); child.emit('close', 0); }
        else { state.started++; child.stdout.write(JSON.stringify(state.compass === 'missing' ? { status: 'unavailable', message: 'This device has no compass sensor.' } : { status: 'reading', trueNorth: state.compass === 'true' ? 45 : null, magneticNorth: 34, accuracy: 'High', timestamp: new Date().toISOString() }) + '\n'); }
      }, 30); return child;
    } as any;
    process.getBuiltinModule('module').syncBuiltinESMExports();
  });
  const before = (await page.evaluate(() => window.athan.snapshot())).config;
  await page.locator('.location-button').click();
  await page.getByRole('button', { name: 'Use device location', exact: true }).click();
  await expect(page.locator('.device-position')).toContainText('Accuracy about 18 m');
  expect((await page.evaluate(() => window.athan.snapshot())).config).toEqual(before);
  await page.getByRole('button', { name: 'Use these coordinates' }).click();
  expect((await page.evaluate(() => window.athan.snapshot())).config).toEqual(before);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const saved = (await page.evaluate(() => window.athan.snapshot())).config;
  expect(saved.locations.find(l => l.id === saved.activeLocation)).toMatchObject({ latitude: -37.7352, longitude: 144.9693, timeZone: 'Australia/Melbourne' });
  await app.evaluate(() => { (globalThis as any).devices.geo = 'denied'; });
  await page.getByRole('button', { name: 'Use device location', exact: true }).click();
  await expect(page.locator('.device-location-panel [role=alert]')).toContainText('Location access denied');
  await page.screenshot({ path: join(shots, 'device-location.png'), animations: 'disabled' });
  await page.getByRole('navigation').getByRole('button', { name: 'Qibla', exact: true }).click();
  await page.getByRole('button', { name: 'Use device compass' }).click();
  await expect(page.locator('.device-compass-controls')).toContainText('45.0° true north');
  await expect(page.locator('.compass>g').first()).toHaveAttribute('transform', 'rotate(-45 200 200)');
  await page.screenshot({ path: join(shots, 'device-compass.png'), animations: 'disabled' });
  await expect(page.locator('.device-compass-controls')).toContainText('Waiting for a fresh compass reading', { timeout: 8000 });
  await page.getByRole('button', { name: 'Stop device compass' }).click();
  await app.evaluate(() => { (globalThis as any).devices.compass = 'magnetic'; });
  await page.getByRole('button', { name: 'Use device compass' }).click();
  await expect(page.locator('.device-compass-controls')).toContainText('Magnetic heading: 34.0°');
  await expect(page.locator('.compass>g').first()).toHaveAttribute('transform', 'rotate(0 200 200)');
  const kills = await app.evaluate(() => (globalThis as any).devices.killed);
  await page.getByRole('navigation').getByRole('button', { name: 'Today', exact: true }).click();
  expect(await app.evaluate(() => (globalThis as any).devices.killed)).toBeGreaterThan(kills);
  await app.evaluate(() => { (globalThis as any).devices.compass = 'missing'; });
  await page.getByRole('navigation').getByRole('button', { name: 'Qibla', exact: true }).click();
  await page.getByRole('button', { name: 'Use device compass' }).click();
  await expect(page.locator('.device-compass-controls')).toContainText('no compass sensor');
});

test('daily readings stay independent of prayer calls, support notification clicks and survive restart without repeats', async () => {
  await page.getByRole('navigation').getByRole('button', { name: 'Reminders', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Enable daily hadith' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('switch', { name: 'Enable daily dua' })).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: join(shots, 'daily-reminders.png'), animations: 'disabled' });
  await page.getByLabel('Daily hadith time', { exact: true }).fill('00:00');
  await page.locator('.daily-setting').first().getByRole('button', { name: 'Save time' }).click();
  await app.evaluate(({ Notification }) => { (globalThis as any).readingToasts = []; Notification.prototype.show = function () { (globalThis as any).readingToasts.push(this); }; });
  await page.evaluate(() => window.athan.preferences({ notifications: true }));
  await page.getByRole('switch', { name: 'Enable daily hadith' }).click();
  await expect(page.locator('.daily-reading-alert')).toBeVisible();
  expect((await page.evaluate(() => window.athan.snapshot())).runtime.status).toBe('paused');
  await page.screenshot({ path: join(shots, 'daily-reading-alert.png'), animations: 'disabled' });
  await app.evaluate(() => (globalThis as any).readingToasts[0].emit('click'));
  await expect(page.locator('.hadith-reading')).toBeVisible(); await expect(page.locator('.daily-reading-alert')).toHaveCount(0);
  await page.evaluate(() => window.athan.preferences({ dailyDua: { enabled: true, time: '00:00' } }));
  await expect(page.locator('.daily-reading-alert')).toContainText('Daily dua');
  await page.getByRole('button', { name: 'Open reading', exact: true }).click();
  await expect(page.locator('.dua-reading')).toBeVisible(); await expect(page.locator('.daily-reading-alert')).toHaveCount(0);
  await page.evaluate(() => window.athan.preferences({ theme: 'dark' }));
  expect(await app.evaluate(() => (globalThis as any).readingToasts.length)).toBe(2);
  await page.evaluate(() => window.athan.window('close'));
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(false);
  await app.close(); await launch();
  const saved = await page.evaluate(() => window.athan.snapshot());
  expect(saved.preferences.dailyHadith).toEqual({ enabled: true, time: '00:00' });
  expect(saved.preferences.dailyDua).toEqual({ enabled: true, time: '00:00' });
  expect(saved.preferences.favoriteDuas).toHaveLength(1);
  expect(saved.readingAlerts).toHaveLength(0); expect(saved.readingError).toBeNull();
  await app.evaluate(({ Notification }) => {
    const RealDate = Date, tomorrow = Date.now() + 86400000;
    globalThis.Date = class extends RealDate { constructor(...args: any[]) { super(...(args.length ? args : [tomorrow]) as [any]); } static now() { return tomorrow; } } as DateConstructor;
    (globalThis as any).readingToasts = []; Notification.prototype.show = function () { (globalThis as any).readingToasts.push(this); };
  });
  await page.evaluate(() => window.athan.preferences({ theme: 'light' }));
  expect((await page.evaluate(() => window.athan.snapshot())).readingAlerts).toHaveLength(2);
  await page.getByRole('button', { name: 'Dismiss reading', exact: true }).click();
  await expect(page.locator('.daily-reading-alert')).toContainText('Daily dua');
  await app.evaluate(() => (globalThis as any).readingToasts[1].emit('close', { reason: 'userCanceled' }));
  await expect(page.locator('.daily-reading-alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});
