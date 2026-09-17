import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, net, Notification, powerMonitor, protocol, shell, Tray } from 'electron';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { activeLocation, configSchema, defaultConfig, readConfig } from '../config.js';
import { calculateDay, nextPrayer } from '../prayers.js';
import { dateAt, parseDate } from '../dates.js';
import { calendarCsv, calendarIcs, calendarRows } from '../exports.js';
import { islamicDays, eventsBetween, fromHijri, toHijri } from '../calendar.js';
import { pdfOptionsSchema, pdfPeriod } from '../calendar-print.js';
import { exportCalendarPdf } from './pdf.js';
import { Ledger, writeJson } from '../storage.js';
import { doctor, requestStop, runService, type ServiceControls } from '../service.js';
import { playFile } from '../audio.js';
import { BUILTIN_LOCATIONS } from '../locations.js';
import { cachedSearch } from '../geocoding-cache.js';
import { listCountries, searchCities } from '../city-catalogue.js';
import type { Preferences, Recording, Snapshot } from './types.js';
import { trayToolTip } from './tray.js';
import { prefsSchema, prefsPatch } from './preferences.js';
import { DeviceCompass, readDevicePosition } from '../device.js';
import { nearestCity } from '../device-location.js';
import { devotionLibrary, duaText, type ReadingAlert } from '../devotion.js';
import { readingNotification } from '../devotion-content.js';
import { deliverDailyReadings } from './daily-readings.js';
import { calendarPeriod, type CalendarMonthInput } from '../calendar-period.js';
import { desktopHadithLibrary } from './hadith-store.js';
import { collectionId, HADITH_SOURCES, narrationId, narrationUrl } from '../hadith-library.js';
import { resolveLanguage, translate } from '../localization.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const data = resolve(process.env.ATHAN_DATA_DIR ?? join(root, '.athan'));
const configFile = join(data, 'config.json'), stateDir = join(data, 'state'), prefsFile = join(data, 'desktop.json');
const renderer = join(root, 'desktop-ui'), iconPath = join(root, 'assets', 'icon.png');
mkdirSync(data, { recursive: true });
app.setName('Athan'); app.setPath('userData', join(data, 'desktop-session'));
app.setAppUserModelId('local.athan.desktop');
protocol.registerSchemesAsPrivileged([{ scheme: 'athan', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window: BrowserWindow | null = null, tray: Tray | null = null, quitting = false;
let preferences: Preferences = prefsSchema.parse(existsSync(prefsFile) ? JSON.parse(readFileSync(prefsFile, 'utf8')) : {});
let runner: Promise<void> | null = null, runnerAbort: AbortController | null = null, running = false;
let lastError: string | null = null, previewAbort: AbortController | null = null, playing: string | null = null;
let operation = Promise.resolve();
let trayTimer: NodeJS.Timeout | undefined, lastToolTip = '';
let serviceControls: ServiceControls | null = null;
const activeAlerts = new Map<string, { id: string; title: string }>();
const alertNotifications = new Map<string, Notification>();
const alertExpiry = new Map<string, NodeJS.Timeout>();
const allowedAudio = new Set<string>();
const exportedPaths = new Set<string>();
const deviceCompass = new DeviceCompass();
let locationRequest: Promise<import('./types.js').DeviceLocation> | null = null;
let readingTimer: NodeJS.Timeout | undefined, readingError: string | null = null;
const readingAlerts = new Map<string, ReadingAlert>(), readingNotifications = new Map<string, Notification>();
function serialize(action: () => Promise<void>): Promise<void> { const result = operation.then(action); operation = result.catch(() => {}); return result; }
function savePreferences(patch: unknown) { const values = Object.fromEntries(Object.entries(prefsPatch.parse(patch)).filter(([, value]) => value !== undefined)); preferences = prefsSchema.parse({ ...preferences, ...values }); writeJson(prefsFile, preferences, true); nativeTheme.themeSource = preferences.theme; }
function status(): Snapshot['runtime']['status'] {
  if (running) return 'running';
  const lock = join(stateDir, 'daemon.lock');
  if (existsSync(lock)) {
    try { const owner = JSON.parse(readFileSync(lock, 'utf8')); process.kill(owner.pid, 0); return 'external'; } catch { /* Stale lock will be recovered on start. */ }
  }
  return 'paused';
}
function publish() { if (window && !window.isDestroyed()) window.webContents.send('athan:changed'); refreshTray(); }
function clearAlert(id: string) {
  activeAlerts.delete(id);
  clearTimeout(alertExpiry.get(id)); alertExpiry.delete(id);
  const notification = alertNotifications.get(id); alertNotifications.delete(id);
  notification?.close();
}
function dismissAlerts(ids?: readonly string[]) {
  const targets = ids ?? [...activeAlerts.keys()];
  serviceControls?.dismissAlerts(targets);
  for (const id of targets) clearAlert(id);
  if (!ids) { previewAbort?.abort(); previewAbort = null; playing = null; }
  publish();
}
function finishAlert(id: string) {
  if (!activeAlerts.has(id)) return;
  clearTimeout(alertExpiry.get(id));
  // Keep silent/completed alerts dismissible briefly; a still-playing call has no expiry.
  alertExpiry.set(id, setTimeout(() => { clearAlert(id); publish(); }, 60000));
}
function showPrayerAlert(detail: { id: string; prayer: string; kind: string; location: string }) {
  const name = detail.prayer[0]!.toUpperCase() + detail.prayer.slice(1);
  const title = detail.kind === 'athan' ? `Time for ${name}` : `${name} reminder`;
  activeAlerts.set(detail.id, { id: detail.id, title });
  if (!preferences.notifications || !Notification.isSupported()) return;
  const notification = new Notification({ title, body: `${detail.location} · A moment for prayer.`,
    icon: iconPath, silent: true, actions: [{ type: 'button', text: 'Dismiss / stop sound' }] });
  alertNotifications.set(detail.id, notification);
  notification.on('action', event => { if (event.actionIndex === 0) dismissAlerts([detail.id]); });
  notification.on('close', event => { if (event.reason === 'userCanceled') dismissAlerts([detail.id]); });
  notification.on('click', () => { window?.show(); window?.focus(); });
  notification.show();
}
function loginOptions() { return { path: process.execPath, args: app.isPackaged ? ['--hidden'] : [root, '--hidden'] }; }
function interfaceLocale() { const language = resolveLanguage(preferences.language, app.getPreferredSystemLanguages()); return language === 'en' ? 'en-AU' : language; }
function dismissReading(id: string) {
  readingAlerts.delete(id); const notification = readingNotifications.get(id); readingNotifications.delete(id); notification?.close(); publish();
}
function checkDailyReadings() {
  if (quitting) return;
  try {
    const zone = activeLocation(readConfig(configFile)).timeZone, today = dateAt(new Date(), zone);
    for (const [id, reading] of readingAlerts) if (reading.date !== today || !(reading.kind === 'dua' ? preferences.dailyDua.enabled : preferences.dailyHadith.enabled)) dismissReading(id);
    deliverDailyReadings(join(stateDir, 'daily-readings.sqlite'), preferences, new Date(), zone, reading => {
      readingAlerts.set(reading.id, reading);
      if (preferences.notifications && Notification.isSupported()) {
        const notification = new Notification({ ...readingNotification(reading, interfaceLocale()), icon: iconPath, silent: true });
        readingNotifications.set(reading.id, notification);
        notification.on('click', () => { window?.show(); window?.focus(); window?.webContents.send('athan:open-reading', { kind: reading.kind, id: reading.item.id }); dismissReading(reading.id); });
        notification.on('close', event => { if (event.reason === 'userCanceled') dismissReading(reading.id); });
        notification.show();
      }
      publish();
    });
    if (readingError) { readingError = null; publish(); }
  } catch (error) { const message = `Daily readings could not be checked: ${String(error)}`; if (message !== readingError) { readingError = message; publish(); } }
}
function monthBounds(value: unknown) {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(value), start = `${month}-01`, date = parseDate(start);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
  return { start, end };
}
function snapshot(date?: string): Snapshot {
  const config = readConfig(configFile), now = new Date(), today = dateAt(now, activeLocation(config).timeZone);
  const day = calculateDay(config, date ?? today); let history: Snapshot['history'] = [];
  if (existsSync(join(stateDir, 'deliveries.sqlite'))) {
    try { const ledger = new Ledger(join(stateDir, 'deliveries.sqlite')); try { history = ledger.history(30) as unknown as Snapshot['history']; } finally { ledger.close(); } }
    catch (error) { lastError = `History unavailable: ${String(error)}`; }
  }
  const observances = [day.hijri.year, day.hijri.year + 1].flatMap(year => islamicDays(year, config.hijriAdjustment)).filter(e => e.date >= today).slice(0, 4);
  return JSON.parse(JSON.stringify({ config, day, today, now, deviceLanguages: app.getPreferredSystemLanguages(), next: nextPrayer(config, now), preferences, readingAlerts: [...readingAlerts.values()], readingError,
    startupEnabled: app.getLoginItemSettings(loginOptions()).openAtLogin,
    runtime: { status: status(), error: lastError, playing, alerts: [...activeAlerts.values()] }, history, observances }));
}
async function stopOwned() { runnerAbort?.abort(); await runner; runner = null; runnerAbort = null; running = false; }
async function startOwned(playStartup = false) {
  if (running) return;
  if (status() === 'external') throw new Error('The command-line scheduler is already running. Pause it here before starting desktop prayers.');
  previewAbort?.abort(); lastError = null; runnerAbort = new AbortController();
  await new Promise<void>((resolveReady, rejectReady) => {
    runner = runService(readConfig(configFile), stateDir, { signal: runnerAbort!.signal, quiet: true, playStartup,
      onReady: controls => { serviceControls = controls; running = true; resolveReady(); publish(); },
      onEvent: event => {
        if (event.type === 'trigger') {
          previewAbort?.abort();
          showPrayerAlert(event.event as { id: string; prayer: string; kind: string; location: string });
        }
        if (event.type === 'startup-audio-started') activeAlerts.set('startup', { id: 'startup', title: 'Bismillah on startup' });
        if (event.type === 'startup-audio-completed' || event.type === 'startup-audio-error' || event.type === 'startup-audio-dismissed') clearAlert('startup');
        if (event.type === 'completed' || event.type === 'failed') finishAlert(String(event.id));
        if (event.type === 'dismissed') clearAlert(String(event.id));
        if (event.type === 'failed') lastError = 'A prayer alert could not finish. See Activity for details.';
        publish();
      },
    }).catch(error => { lastError = String(error); rejectReady(error); }).finally(() => {
      running = false; serviceControls = null;
      for (const id of activeAlerts.keys()) clearAlert(id);
      publish();
    });
  });
}
function playStartupBismillah() {
  const { audio } = readConfig(configFile);
  if (!audio.enabled || !audio.startupEnabled || !audio.startupFile || activeAlerts.size) return;
  const controller = new AbortController(); previewAbort = controller; playing = audio.startupFile;
  activeAlerts.set('startup', { id: 'startup', title: 'Bismillah on startup' }); publish();
  void playFile(audio.startupFile, { volume: audio.volume, maxSeconds: audio.maxPlaybackSeconds, signal: controller.signal })
    .catch(error => { if (!controller.signal.aborted) lastError = String(error); })
    .finally(() => { if (previewAbort === controller) { playing = null; previewAbort = null; } clearAlert('startup'); publish(); });
}
async function setRunning(enabled: boolean) {
  if (enabled) await startOwned();
  else if (status() === 'external') {
    requestStop(stateDir);
    for (let n = 0; n < 35 && status() === 'external'; n++) await new Promise(r => setTimeout(r, 200));
    if (status() === 'external') throw new Error('The other scheduler has not stopped yet. Try again shortly.');
  } else await stopOwned();
  savePreferences({ resumeAlerts: enabled }); publish();
}
function recordings(): Recording[] {
  const result: Recording[] = [], seen = new Set<string>();
  const add = (path: string | null, group: string) => {
    if (path && existsSync(path) && !seen.has(path) && !path.endsWith('No_Athan.wma')) {
      seen.add(path); allowedAudio.add(path); result.push({ name: basename(path).replace(/\.[^.]+$/, '').replace(/_/g, ' '), path, group });
    }
  };
  const config = readConfig(configFile);
  for (const item of Object.values(config.audio.prayers)) add(item.file, 'Your recordings');
  add(config.audio.duaFile, 'Dua'); add(config.audio.startupFile, 'Bismillah');
  for (const item of config.reminders) add(item.file, 'Recitation');
  const legacy = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Athan', 'sound');
  for (const folder of ['otherprayers', 'fajr', 'dua', 'bismillah']) {
    if (existsSync(join(legacy, folder))) for (const file of readdirSync(join(legacy, folder)))
      if (/\.(wma|mp3|wav|m4a)$/i.test(file)) add(join(legacy, folder, file), folder === 'fajr' ? 'Fajr' : folder === 'otherprayers' ? 'Athan collection' : folder);
  }
  return result;
}
function refreshTrayToolTip() {
  if (!tray) return;
  let text: string;
  try { text = trayToolTip({ ...readConfig(configFile), locale: interfaceLocale() }, status() !== 'paused'); }
  catch { text = 'Athan · Prayer times unavailable\nOpen Athan to review your settings.'; }
  if (text !== lastToolTip) { tray.setToolTip(text); lastToolTip = text; }
}
function refreshTray() {
  if (!tray) return;
  const t = (value: string) => translate(value, interfaceLocale());
  refreshTrayToolTip();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t('Open Athan'), click: () => { window?.show(); window?.focus(); } },
    { label: t('Dismiss / stop sound'), enabled: activeAlerts.size > 0 || playing !== null, click: () => dismissAlerts() },
    { label: t(status() === 'paused' ? 'Start prayers' : 'Pause prayers'), click: () => { void serialize(() => setRunning(status() === 'paused')).catch(error => { lastError = String(error); publish(); }); } },
    { type: 'separator' }, { label: t('Quit Athan'), click: () => app.quit() },
  ]));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  // Electron waits for the entry module to finish before emitting ready.
  void app.whenReady().then(async () => {
  if (!existsSync(configFile)) writeJson(configFile, defaultConfig());
  nativeTheme.themeSource = preferences.theme;
  const hadith = desktopHadithLibrary(data, publish);
  protocol.handle('athan', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    const path = resolve(renderer, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(renderer + sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(path).toString());
  });
  window = new BrowserWindow({ width: 1440, height: 1000, minWidth: 1060, minHeight: 760, show: false, frame: false,
    title: 'Athan', backgroundColor: '#f6f7f2', icon: iconPath,
    webPreferences: { preload: join(root, 'dist/desktop/preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } });
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ipcMain.handle('athan:invoke', async (event, method: string, ...args: unknown[]) => {
    if (event.sender !== window?.webContents || event.senderFrame?.url !== 'athan://app/index.html') throw new Error('Invalid desktop request');
    switch (method) {
      case 'hadithStatus': return hadith.status();
      case 'hadithConnect': return hadith.connect(z.string().parse(args[0]));
      case 'hadithDownload': return hadith.download(collectionId.parse(args[0]));
      case 'hadithCancel': hadith.cancel(); return;
      case 'hadithRead': return hadith.read(collectionId.parse(args[0]));
      case 'hadithRemove': return hadith.remove(collectionId.parse(args[0]));
      case 'hadithSource': {
        const id = z.string().parse(args[0]);
        if (id.startsWith('source:') && HADITH_SOURCES[id.slice(7)]) return shell.openExternal(HADITH_SOURCES[id.slice(7)]!);
        if (id === 'connection') return shell.openExternal('https://sunnah.com/developers');
        collectionId.parse(id);
        if (args[1] === undefined) return shell.openExternal(`https://sunnah.com/${id}`);
        const number = z.string().parse(args[1]), data = await hadith.read(id);
        const entry=data?.entries.find(e=>narrationId(e)===number);
        if (!entry) throw new Error('Unknown narration');
        return shell.openExternal(entry.url ?? narrationUrl(id, entry.hadithNumber));
      }
      case 'snapshot': return snapshot(args[0] === undefined ? undefined : z.string().parse(args[0]));
      case 'month': { const range = monthBounds(args[0]); return JSON.parse(JSON.stringify(calendarRows(readConfig(configFile), range.start, range.end))); }
      case 'calendarMonth': {
        const config = readConfig(configFile), range = calendarPeriod(args[0] as CalendarMonthInput, config.hijriAdjustment);
        if (range.start < '1901-01-01' || range.end > '2098-12-31') throw new Error('Choose a month between 1901 and 2098');
        return JSON.parse(JSON.stringify({ days: calendarRows(config, range.start, range.end), events: eventsBetween(range.start, range.end, config.hijriAdjustment) }));
      }
      case 'calendarEvents': return islamicDays(z.number().int().min(1).max(9999).parse(args[0]), readConfig(configFile).hijriAdjustment);
      case 'convertDate': {
        const request = z.discriminatedUnion('calendar', [z.strictObject({ calendar: z.literal('gregorian'), date: z.string() }),
          z.strictObject({ calendar: z.literal('hijri'), year: z.number().int(), month: z.number().int(), day: z.number().int() })]).parse(args[0]);
        const adjustment = readConfig(configFile).hijriAdjustment;
        const gregorian = request.calendar === 'gregorian' ? request.date : fromHijri(request.year, request.month, request.day, adjustment);
        parseDate(gregorian);
        if (gregorian < '1901-01-01' || gregorian > '2098-12-31') throw new Error('Choose a date between Gregorian years 1901 and 2098');
        return { gregorian, hijri: toHijri(gregorian, adjustment) };
      }
      case 'exportPdf': {
        const options = pdfOptionsSchema.parse(args[0]), config = readConfig(configFile), period = pdfPeriod(options, config.hijriAdjustment);
        const filename = `Athan-${period.title.replace(/[^a-zA-Z0-9 -]/g, '').replace(/ +/g, '-')}.pdf`;
        const picked = await dialog.showSaveDialog(window!, { title: 'Save printable calendar', defaultPath: filename, filters: [{ name: 'PDF calendar', extensions: ['pdf'] }] });
        if (picked.canceled || !picked.filePath) return null;
        await exportCalendarPdf({ ...config, locale: interfaceLocale() }, options, picked.filePath); exportedPaths.add(picked.filePath); return picked.filePath;
      }
      case 'exportedFile': {
        const path = z.string().parse(args[0]), action = z.enum(['open', 'reveal']).parse(args[1]);
        if (!exportedPaths.has(path) || !existsSync(path)) throw new Error('Export this file again before opening it.');
        if (action === 'reveal') shell.showItemInFolder(path);
        else { const error = await shell.openPath(path); if (error) throw new Error(error); }
        return;
      }
      case 'saveConfig': return serialize(async () => { const parsed = configSchema.safeParse(args[0]);
        if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join('\n'));
        const config = parsed.data, wasRunning = running;
        if (status() === 'external') throw new Error('Pause the command-line scheduler before saving settings.');
        if (wasRunning) await stopOwned();
        writeJson(configFile, config, true); if (wasRunning) await startOwned(false); publish(); });
      case 'preferences': savePreferences(args[0]); checkDailyReadings(); publish(); return;
      case 'devotionLibrary': return devotionLibrary();
      case 'copyDua': {
        const id = z.string().max(100).parse(args[0]), dua = devotionLibrary().duas.find(d => d.id === id);
        if (!dua) throw new Error('Unknown dua'); await clipboard.writeText(duaText(dua)); return;
      }
      case 'dismissReading': dismissReading(z.string().max(100).parse(args[0])); return;
      case 'openReadingSource': {
        const id = z.string().max(100).parse(args[0]);
        const url = id === 'dua-library' ? 'https://github.com/majmoo-io/hisnu-al-muslim-data/tree/main/data/ar.al-qahtani-sunnah-com' : devotionLibrary().duas.find(d => d.id === id)?.url ?? devotionLibrary().hadiths.find(h => h.id === id)?.url;
        if (!url) throw new Error('Unknown reading source'); await shell.openExternal(url); return;
      }
      case 'deviceLocation': {
        locationRequest ??= readDevicePosition().then(async position => ({ ...position, ...await nearestCity(position.latitude, position.longitude) })).finally(() => { locationRequest = null; });
        return locationRequest;
      }
      case 'compass': {
        if (z.boolean().parse(args[0])) deviceCompass.start(state => { if (window && !window.isDestroyed()) window.webContents.send('athan:compass', state); });
        else deviceCompass.stop(); return;
      }
      case 'running': return serialize(() => setRunning(z.boolean().parse(args[0])));
      case 'dismissAlerts': dismissAlerts(); return;
      case 'recordings': return recordings();
      case 'chooseAudio': { const selected = z.string().min(1).max(4096).nullable().optional().parse(args[0]); const folder = selected ? dirname(selected) : undefined; const picked = await dialog.showOpenDialog(window!, { title: 'Choose a recording', ...(folder && existsSync(folder) ? { defaultPath: folder } : {}), filters: [{ name: 'Audio', extensions: ['mp3', 'wma', 'wav', 'm4a', 'aac'] }], properties: ['openFile'] });
        const file = picked.canceled ? null : picked.filePaths[0] ?? null; if (file) allowedAudio.add(file); return file; }
      case 'preview': {
        previewAbort?.abort(); playing = null;
        const path = z.string().nullable().parse(args[0]);
        if (!path) { publish(); return; }
        recordings(); if (!allowedAudio.has(path)) throw new Error('Choose a recording before previewing it.');
        const controller = new AbortController(); previewAbort = controller; playing = path; lastError = null; publish();
        void playFile(path, { volume: readConfig(configFile).audio.volume, maxSeconds: 20, signal: controller.signal })
          .catch(error => { if (!controller.signal.aborted) lastError = String(error); })
          .finally(() => { if (previewAbort === controller) { playing = null; previewAbort = null; publish(); } }); return;
      }
      case 'exportCalendar': { const config = readConfig(configFile), range = calendarPeriod(args[0] as CalendarMonthInput, config.hijriAdjustment), format = z.enum(['csv', 'ics']).parse(args[1]);
        const picked = await dialog.showSaveDialog(window!, { title: 'Save prayer calendar', defaultPath: `Athan-${range.title.replace(/ /g, '-')}.${format}`, filters: [{ name: format === 'ics' ? 'Calendar file' : 'Spreadsheet', extensions: [format] }] });
        if (picked.canceled || !picked.filePath) return null;
        writeFileSync(picked.filePath, format === 'csv' ? calendarCsv(config, range.start, range.end) : calendarIcs(config, range.start, range.end)); exportedPaths.add(picked.filePath); return picked.filePath;
      }
      case 'countries': return listCountries();
      case 'cities': return searchCities(z.string().regex(/^[A-Za-z]{2}$/).parse(args[0]), z.string().max(150).parse(args[1]), z.number().int().min(0).parse(args[2]));
      case 'search': { const query = z.string().trim().min(2).max(150).parse(args[0]);
        const country = z.string().regex(/^[A-Za-z]{2}$/).optional().parse(args[2]);
        // Chromium follows Windows networking/proxy settings and avoids Node's failing connection path here.
        if (z.boolean().parse(args[1])) return cachedSearch(query, country, {
          read: async () => { const file = join(data, 'location-search-cache.json'); return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; },
          write: async value => writeJson(join(data, 'location-search-cache.json'), value, true),
        }, (url, options) => net.fetch(url instanceof URL ? url.toString() : url, options), !net.isOnline());
        if (country) return searchCities(country, query);
        return { locations: BUILTIN_LOCATIONS.filter(l => `${l.name} ${l.country}`.toLowerCase().includes(query.toLowerCase())) }; }
      case 'startup': app.setLoginItemSettings({ ...loginOptions(), openAtLogin: z.boolean().parse(args[0]) }); publish(); return;
      case 'diagnostics': return doctor(readConfig(configFile));
      case 'window': switch (z.enum(['minimize', 'maximize', 'close']).parse(args[0])) { case 'minimize': window!.minimize(); break; case 'maximize': window!.isMaximized() ? window!.unmaximize() : window!.maximize(); break; case 'close': window!.close(); } return;
      default: throw new Error('Unknown desktop action');
    }
  });
  window.on('close', event => {
    if (quitting) return;
    event.preventDefault(); if (preferences.closeToTray && (running || preferences.dailyDua.enabled || preferences.dailyHadith.enabled)) window?.hide(); else app.quit();
  });
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24 }));
  tray.on('double-click', () => { window?.show(); window?.focus(); }); refreshTray();
  tray.on('mouse-enter', refreshTrayToolTip);
  powerMonitor.on('resume', refreshTrayToolTip);
  powerMonitor.on('resume', checkDailyReadings);
  window.on('hide', () => { deviceCompass.stop(); window?.webContents.send('athan:compass', { status: 'off', message: 'Compass paused while the window is hidden.' }); });
  // Runs in the main process, including while the dashboard is hidden or alerts are paused.
  trayTimer = setInterval(refreshTrayToolTip, 1000);
  await window.loadURL('athan://app/index.html');
  readingTimer = setInterval(checkDailyReadings, 15000); checkDailyReadings();
  if (!process.argv.includes('--hidden')) window.show();
  void serialize(async () => { if (preferences.resumeAlerts) await startOwned(); playStartupBismillah(); }).catch(error => { lastError = String(error); publish(); });
  app.on('activate', () => { window?.show(); window?.focus(); });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault(); quitting = true; previewAbort?.abort(); hadith.cancel();
    if (trayTimer) clearInterval(trayTimer);
    if (readingTimer) clearInterval(readingTimer);
    deviceCompass.stop(); for (const notification of readingNotifications.values()) notification.close();
    powerMonitor.removeListener('resume', refreshTrayToolTip);
    powerMonitor.removeListener('resume', checkDailyReadings);
    void operation.then(stopOwned).finally(() => { tray?.destroy(); tray = null; app.quit(); });
  });
  }).catch(error => { dialog.showErrorBox('Athan could not open', String(error)); app.quit(); });
}
