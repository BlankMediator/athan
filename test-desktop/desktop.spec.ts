import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { defaultConfig } from '../src/config.js';

let app: ElectronApplication, page: Page, profile: string;
const root = resolve('.'), screenshots = join(root, 'docs/screenshots');
const errors: string[] = [];
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  mkdirSync(join(root, 'test-results'), { recursive: true }); mkdirSync(screenshots, { recursive: true });
  profile = mkdtempSync(join(root, 'test-results/desktop-profile-'));
  const config = defaultConfig(); config.audio.enabled = false; config.audio.volume = 0;
  writeFileSync(join(profile, 'config.json'), JSON.stringify(config));
  writeFileSync(join(profile, 'desktop.json'), JSON.stringify({ notifications: false, closeToTray: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v !== undefined && k !== 'ELECTRON_RUN_AS_NODE')) as Record<string, string>;
  app = await electron.launch({ executablePath: join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env: { ...env, ATHAN_DATA_DIR: profile }, timeout: 20000 });
  page = await app.firstWindow(); page.on('pageerror', error => errors.push(String(error)));
  await expect(page.getByRole('heading', { name: 'A moment for what matters.' })).toBeVisible();
});
test.afterAll(async () => { await app?.close(); });

test('dashboard renders live data in an isolated desktop renderer', async () => {
  await expect(page.locator('.prayer-card')).toHaveCount(6);
  await expect(page.locator('.location-button')).toContainText('Coburg');
  await expect(page.locator('.calculation-note')).toContainText('Muslim World League');
  await expect(page.getByRole('button', { name: 'Enable Athan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop Athan', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => ({ node: typeof (window as any).process, require: typeof (window as any).require, bridge: typeof window.athan.snapshot }))).toEqual({ node: 'undefined', require: 'undefined', bridge: 'function' });
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getLastWebPreferences());
  expect(prefs.sandbox).toBe(true); expect(prefs.contextIsolation).toBe(true); expect(prefs.nodeIntegration).toBe(false);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'today-light.png') });
});

test('calendar navigates dates and exports a real calendar', async () => {
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.calendar-day')).toHaveCount(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.locator('.calendar-detail>p')).toContainText('1 ');
  await expect(page.locator('.calendar-prayers>div')).toHaveCount(6);
  const output = join(profile, 'calendar.ics');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, output);
  await page.getByRole('button', { name: 'Export calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Calendar file (.ics)', exact: true }).click();
  await expect.poll(() => existsSync(output)).toBe(true);
  expect(readFileSync(output, 'utf8')).toContain('BEGIN:VCALENDAR');
  expect(readFileSync(output, 'utf8')).toContain('BEGIN:VEVENT');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'calendar.png') });
});

test('calendar converts both ways, rejects nonexistent dates and jumps from its event list', async () => {
  await expect(page.locator('.key-events-list>button')).toHaveCount(11);
  await page.getByLabel('Gregorian date', { exact: true }).fill('2027-02-08');
  await page.getByRole('button', { name: 'Convert date', exact: true }).click();
  await expect(page.locator('.conversion-result')).toContainText('1 Ramadan 1448 AH');
  await page.getByRole('button', { name: 'Show in calendar', exact: true }).click();
  await expect(page.locator('.calendar-day.selected')).toHaveAttribute('id', 'calendar-2027-02-08');
  await expect(page.locator('.selected-event')).toContainText('Ramadan begins');
  await page.getByRole('button', { name: 'Hijri → Gregorian', exact: true }).click();
  await page.getByLabel('Hijri day', { exact: true }).fill('1');
  await page.getByRole('combobox', { name: 'Hijri month', exact: true }).selectOption('10');
  await page.getByLabel('Hijri year', { exact: true }).fill('1448');
  await page.getByRole('button', { name: 'Convert date', exact: true }).click();
  await expect(page.locator('.conversion-result')).toContainText('9 March 2027');
  await page.getByRole('combobox', { name: 'Hijri month', exact: true }).selectOption('9');
  await page.getByLabel('Hijri day', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Convert date', exact: true }).click();
  await expect(page.locator('.converter-panel').getByRole('alert')).toContainText('does not exist');
  await expect(page.locator('.conversion-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Eid al-Adha in calendar', exact: true }).click();
  await expect(page.locator('.selected-event')).toContainText('Eid al-Adha');
  await expect(page.locator('.calendar-day.selected')).toBeFocused();
  await page.getByLabel('Go to month', { exact: true }).fill('2027-02');
  await expect(page.locator('.calendar-day')).toHaveCount(28);
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'calendar-ramadan.png') });
  await page.locator('.calendar-tools').scrollIntoViewIfNeeded();
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'calendar-tools.png') });
});

test('PDF export provides four real layouts, retains the main window, and handles cancellation', async () => {
  await page.getByRole('button', { name: 'Export calendar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const layouts = [
    { title: 'Monthly prayer timetable', file: 'month.pdf', pages: 1 },
    { title: 'Ramadan timetable', file: 'ramadan.pdf', pages: 1 },
    { title: 'Year at a glance', file: 'year.pdf', pages: 1 },
    { title: 'Full year of prayer times', file: 'year-timetables.pdf', pages: 12 },
  ];
  for (const layout of layouts) {
    const output = join(profile, layout.file);
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, output);
    await page.locator('.export-layouts').getByRole('button', { name: layout.title, exact: false }).click();
    await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
    await expect(page.locator('.pdf-saved')).toContainText(output);
    expect(readFileSync(output).subarray(0, 5).toString()).toBe('%PDF-');
    // Chromium writes page dictionaries outside compressed streams; catch accidental spill pages.
    expect(readFileSync(output).toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(layout.pages);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  }
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'calendar-export.png') });
  await page.locator('.export-layouts').getByRole('button', { name: 'Monthly prayer timetable', exact: false }).click();
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined }); });
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save PDF', exact: true })).toBeEnabled();
  await expect(page.locator('.pdf-saved')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
});

test('Qibla and location editing use the shared calculation core', async () => {
  await page.getByRole('navigation').getByRole('button', { name: 'Qibla', exact: true }).click();
  await expect(page.locator('.bearing-value')).toContainText('278.9');
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'qibla.png') });
  await page.getByRole('button', { name: 'Change location', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Country or territory', exact: true })).toHaveValue('AU');
  await page.getByRole('textbox', { name: 'Filter cities', exact: true }).fill('Sydney');
  await expect(page.getByRole('listbox', { name: 'City', exact: true }).getByRole('option', { name: 'Sydney, New South Wales', exact: true })).toHaveCount(1);
  await page.getByRole('listbox', { name: 'City', exact: true }).selectOption({ label: 'Sydney, New South Wales' });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.location-button')).toContainText('Sydney');
  const saved = JSON.parse(readFileSync(join(profile, 'config.json'), 'utf8'));
  expect(saved.locations.find((l: { id: string }) => l.id === saved.activeLocation).timeZone).toBe('Australia/Sydney');
  await page.getByRole('combobox', { name: 'Saved locations', exact: true }).selectOption('coburg');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.location-button')).toContainText('Coburg');
});

test('country then city selection browses offline, filters and preserves saved settings until save', async () => {
  const countries = page.getByRole('combobox', { name: 'Country or territory', exact: true });
  const cities = page.getByRole('listbox', { name: 'City', exact: true });
  await countries.selectOption('DE');
  await expect(cities.getByRole('option')).toHaveCount(201);
  await page.getByRole('button', { name: 'Show more cities', exact: true }).click();
  await expect(cities.getByRole('option')).toHaveCount(401);
  await page.getByRole('textbox', { name: 'Filter cities', exact: true }).fill('Berlin');
  await expect(cities.getByRole('option', { name: 'Berlin, State of Berlin', exact: true })).toHaveCount(1);
  await cities.selectOption({ label: 'Berlin, State of Berlin' });
  await expect(page.getByRole('textbox', { name: 'Time zone', exact: false })).toHaveValue('Europe/Berlin');
  await expect(page.locator('.location-button')).toContainText('Coburg');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.location-button')).toContainText('Berlin');
  await page.getByRole('tab', { name: 'Prayer calculation', exact: true }).click();
  await page.locator('.location-button').click();
  await expect(page.getByRole('tab', { name: 'Location', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('combobox', { name: 'Saved locations', exact: true }).selectOption('coburg');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.location-button')).toContainText('Coburg');
  await countries.selectOption('AU');
  await page.getByRole('textbox', { name: 'Filter cities', exact: true }).fill('Coburg');
  await expect(cities.getByRole('option', { name: 'Coburg, Victoria', exact: true })).toHaveCount(1);
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'location-picker.png') });
});

test('online search passes country, ignores stale replies and leaves offline cities usable on failure', async () => {
  await app.evaluate(({ net }) => {
    const state = globalThis as any;
    state.originalLocationFetch = net.fetch;
    state.locationRequests = [];
    net.fetch = async (input, options) => {
      const url = String(input);
      if (!url.startsWith('https://geocoding-api.open-meteo.com/')) return state.originalLocationFetch(input, options);
      state.locationRequests.push(url);
      if (state.locationFailure) throw new Error('Simulated network outage');
      return new Promise(resolve => { state.completeLocationRequest = () => resolve(new Response(JSON.stringify({ results: [{ id: 2950159, name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41, timezone: 'Europe/Berlin' }] }))); });
    };
  });
  const countries = page.getByRole('combobox', { name: 'Country or territory', exact: true });
  const filter = page.getByRole('textbox', { name: 'Filter cities', exact: true });
  const cities = page.getByRole('listbox', { name: 'City', exact: true });
  try {
    await countries.selectOption('DE'); await filter.fill('Berlin');
    await page.getByRole('button', { name: 'Search online', exact: true }).click();
    await expect.poll(() => app.evaluate(() => (globalThis as any).locationRequests.length)).toBe(1);
    const url = new URL(await app.evaluate(() => (globalThis as any).locationRequests[0]));
    expect(url.searchParams.get('countryCode')).toBe('DE'); expect(url.searchParams.get('name')).toBe('Berlin');
    await countries.selectOption('AU'); await filter.fill('Coburg');
    await app.evaluate(() => (globalThis as any).completeLocationRequest());
    await expect(cities.getByRole('option', { name: 'Coburg, Victoria', exact: true })).toHaveCount(1);
    await expect(cities.getByRole('option', { name: 'Berlin', exact: true })).toHaveCount(0);
    await expect(page.getByText('Online results', { exact: true })).toHaveCount(0);
    await app.evaluate(() => { (globalThis as any).locationFailure = true; });
    await page.getByRole('button', { name: 'Search online', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Built-in cities remain available');
    await expect(cities.getByRole('option', { name: 'Coburg, Victoria', exact: true })).toHaveCount(1);
    await countries.selectOption('DE'); await filter.fill('Berlin');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await app.evaluate(() => { (globalThis as any).locationFailure = false; });
    await page.getByRole('button', { name: 'Search online', exact: true }).click();
    await expect.poll(() => app.evaluate(() => (globalThis as any).locationRequests.length)).toBe(3);
    await app.evaluate(() => (globalThis as any).completeLocationRequest());
    await expect(page.getByText('Online results', { exact: true })).toBeVisible();
    await cities.selectOption({ label: 'Berlin' });
    await expect(page.getByRole('textbox', { name: 'Time zone', exact: false })).toHaveValue('Europe/Berlin');
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await countries.selectOption('AU'); await filter.fill('zzzzznotacity');
    await expect(cities.getByRole('option')).toHaveCount(1);
    await expect(cities).toBeDisabled();
  } finally {
    await app.evaluate(({ net }) => { net.fetch = (globalThis as any).originalLocationFetch; });
  }
});

test('calculation settings persist and invalid coordinates fail visibly', async () => {
  await page.getByRole('tab', { name: 'Prayer calculation', exact: true }).click();
  await page.getByRole('combobox', { name: 'Asr calculation', exact: true }).selectOption('Hanafi');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => JSON.parse(readFileSync(join(profile, 'config.json'), 'utf8')).calculation.madhab).toBe('Hanafi');
  await page.getByRole('tab', { name: 'Location', exact: true }).click();
  await page.getByRole('textbox', { name: 'Time zone', exact: false }).fill('Invalid/Zone');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('valid IANA time zone');
  expect(JSON.parse(readFileSync(join(profile, 'config.json'), 'utf8')).locations[0].timeZone).toBe('Australia/Melbourne');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss message' }).click();
});

test('sound selection, silent preview and custom recording picker', async () => {
  await page.getByRole('navigation').getByRole('button', { name: 'Athan & sounds', exact: true }).click();
  const choices = page.getByRole('combobox', { name: 'Fajr recording', exact: true });
  const options = await choices.locator('option').evaluateAll(items => items.map(o => (o as HTMLOptionElement).value).filter(Boolean));
  if (options.length) {
    await choices.selectOption(options[0]!);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect.poll(() => JSON.parse(readFileSync(join(profile, 'config.json'), 'utf8')).audio.prayers.fajr.file).toBe(options[0]);
    await page.getByRole('button', { name: 'Preview Fajr recording', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop Fajr recording', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop Fajr recording', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Preview Fajr recording', exact: true })).toBeVisible();
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, options[0]!);
    await page.getByRole('button', { name: 'Browse Dhuhr recording', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Dhuhr recording', exact: true })).toHaveValue(options[0]!);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect.poll(() => JSON.parse(readFileSync(join(profile, 'config.json'), 'utf8')).audio.prayers.dhuhr.file).toBe(options[0]);
  }
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'sounds.png') });
});

test('reminders can be added, edited and removed', async () => {
  await page.getByRole('navigation').getByRole('button', { name: 'Reminders', exact: true }).click();
  await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', { name: 'Prayer', exact: true }).selectOption('maghrib');
  await page.getByRole('spinbutton', { name: 'Minutes from prayer', exact: false }).fill('-15');
  await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(page.getByRole('heading', { name: '15 minutes before Maghrib' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Maghrib reminder' }).click();
  await page.getByRole('spinbutton', { name: 'Minutes from prayer', exact: false }).fill('10');
  await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(page.getByRole('heading', { name: '10 minutes after Maghrib' })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'reminders.png') });
  await page.getByRole('button', { name: 'Delete Maghrib reminder' }).click();
  await page.getByRole('button', { name: 'Remove reminder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little nudge goes a long way.' })).toBeVisible();
  expect(JSON.parse(readFileSync(join(profile, 'config.json'), 'utf8')).reminders).toHaveLength(0);
});

test('desktop alerts start, survive settings edits and stop without leaving a lock', async () => {
  await page.getByRole('navigation').getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Enable Athan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Athan is on', exact: true })).toBeVisible();
  expect(existsSync(join(profile, 'state/daemon.lock'))).toBe(true);
  await page.getByRole('button', { name: 'Mute Isha Athan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable Isha Athan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Athan is on', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close window', exact: true }).click();
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(false);
  expect(existsSync(join(profile, 'state/daemon.lock'))).toBe(true);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.show());
  await page.getByRole('button', { name: 'Athan is on', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable Athan', exact: true })).toBeVisible();
  expect(existsSync(join(profile, 'state/daemon.lock'))).toBe(false);
  expect(JSON.parse(readFileSync(join(profile, 'desktop.json'), 'utf8')).resumeAlerts).toBe(false);
});

test('theme persists, compact layout fits, and activity is accessible', async () => {
  await page.getByRole('button', { name: 'Toggle color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  if (await page.getByRole('button', { name: 'Dismiss message' }).isVisible()) await page.getByRole('button', { name: 'Dismiss message' }).click();
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'today-dark.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1060, 760));
  expect(await page.evaluate(() => { const main = document.querySelector('.main-scroll')!; return main.scrollWidth <= main.clientWidth; })).toBe(true);
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'compact.png') });
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.calendar-day')).not.toHaveCount(0);
  expect(await page.evaluate(() => { const main = document.querySelector('.main-scroll')!; return main.scrollWidth <= main.clientWidth; })).toBe(true);
  await page.locator('.calendar-tools').scrollIntoViewIfNeeded();
  await page.screenshot({ animations: 'disabled', path: join(screenshots, 'calendar-compact-dark.png') });
  await page.getByRole('button', { name: 'Export calendar', exact: true }).click();
  const dialogBounds = await page.getByRole('dialog').boundingBox();
  expect(dialogBounds!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual((await page.evaluate(() => innerHeight)) + 1);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Activity & health', exact: true }).click();
  await expect(page.locator('.diagnostic-list>div')).not.toHaveCount(0);
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'A moment for what matters.' })).toBeVisible();
});
