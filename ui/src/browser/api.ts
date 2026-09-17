import { z } from 'zod';
import { BrowserAudio } from './audio';
import { localId } from '../ids';
import { activeLocation, configSchema, defaultConfig, PRAYERS, type Config } from '../../../src/config-model.js';
import { calculateDay, nextPrayer } from '../../../src/prayers.js';
import { dateAt, parseDate } from '../../../src/dates.js';
import { eventsBetween, fromHijri, islamicDays, toHijri } from '../../../src/calendar.js';
import { calendarCsv, calendarRows, renderCalendarIcs } from '../../../src/calendar-export.js';
import { calendarPrintHtml, pdfPeriod } from '../../../src/calendar-layout.js';
import { eventsAround, type ScheduledEvent } from '../../../src/events.js';
import { cachedSearch } from '../../../src/geocoding-cache.js';
import type { DesktopAPI, Preferences, Snapshot } from '../../../src/desktop/types.js';
import { countries, cities } from './catalogue';
import { offlineState } from './offline';
import { audioRecords, claimEvent, finishEvent, history, initializeConfig, pruneHistory, readAudio, readSetting, storeAudio, writeSetting } from './storage';
import { browserDefaultConfig, cacheDefaultRecordings } from './default-recordings';
import manrope from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
import notoArabic from '@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2?url';
import cormorant from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url';
import { prefsSchema as sharedPrefs, prefsPatch } from '../../../src/desktop/preferences.js';
import { duaText, dueDailyReminders, readingForDay, readingNotification, type ReadingAlert, type ReadingTarget } from '../../../src/devotion-content.js';
import type { CompassState } from '../../../src/device.js';
import { library } from './devotion';
import { deviceLocation, browserCompass } from './device';
import { calendarPeriod } from '../../../src/calendar-period.js';
import { HadithLibrary, HADITH_COLLECTIONS, collectionId, HADITH_SOURCES, narrationId, narrationUrl, type DownloadedHadith } from '../../../src/hadith-library.js';
import { resolveLanguage } from '../../../src/localization.js';

const prefsSchema = sharedPrefs.extend({ closeToTray: z.boolean().default(false), notifications: z.boolean().default(false) });
const serialize = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;
function bounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choose a valid month');
  const start = `${month}-01`, date = parseDate(start);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
  if (start < '1901-01-01' || end > '2098-12-31') throw new Error('Choose a month between 1901 and 2098');
  return { start, end };
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000); return name;
}
const blobData = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
});

export interface BrowserHost {
  native?: boolean;
  requestNotifications?: () => Promise<void>;
  exportFile?: (content: string, name: string, type: string) => Promise<string>;
  printHtml?: (html: string) => Promise<string>;
  openUrl?: (url: string) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
}
export async function createBrowserAPI(host: BrowserHost = {}): Promise<DesktopAPI> {
  const exportFile = host.exportFile ?? download;
  const openUrl = host.openUrl ?? (async (url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); });
  let config = await initializeConfig(browserDefaultConfig());
  let preferences: Preferences = prefsSchema.parse(await readSetting('preferences') ?? {});
  // Commit the initial profile before reporting success, including storage/quota failures.
  await writeSetting('preferences', preferences);
  await pruneHistory();
  let running = false, releaseLock: (() => void) | null = null, error: string | null = null;
  let activeEvent: Snapshot['history'][number] | null = null, dismissed = new Set<string>();
  const alerts = new Map<string, { id: string; title: string }>();
  const notifications = new Map<string, Notification>();
  const listeners = new Set<() => void>();
  const publish = () => { for (const listener of listeners) listener(); };
  const audio = new BrowserAudio(publish, async path => {
    let record = await readAudio(path);
    if (!record && path.startsWith('default/')) { await cacheDefaultRecordings(); record = await readAudio(path); }
    if (!record) throw new Error('This recording is not saved on this device. Choose it again in Athan & sounds.');
    return record.blob;
  });
  // A failed recording download must not stop local prayer calculations.
  let recordingDownload = cacheDefaultRecordings().catch(() => {}).finally(publish);
  window.addEventListener('online', () => { recordingDownload = cacheDefaultRecordings().catch(() => {}).finally(publish); });
  let hadithKey = '';
  const hadith = new HadithLibrary({ persistentKey: false,
    async key(value) { if (value !== undefined) hadithKey = value; return hadithKey; },
    async read(id) { return await readSetting(`hadith-${id}`) as DownloadedHadith | null; },
    async write(id, value) { await writeSetting(`hadith-${id}`, value); },
  }, (url, options) => fetch(url, options), publish, async (id,signal) => {
    const pack=HADITH_COLLECTIONS.find(c=>c.id===id)!;
    const response=await fetch(new URL(`hadith/${pack.file}`,document.baseURI),{signal});
    if(!response.ok)throw new Error('This collection could not be loaded. Reconnect and try again, or save everything for offline access while online.');
    const bytes=await response.arrayBuffer();if(bytes.byteLength!==pack.bytes)throw new Error('The collection download is incomplete.');
    if(crypto.subtle) {
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==pack.sha256)throw new Error('The collection pack failed its integrity check.');
    }
    signal.throwIfAborted();
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  });
  const readingAlerts = new Map<string, ReadingAlert>(), readingListeners = new Set<(target: ReadingTarget) => void>();
  const compassListeners = new Set<(state: CompassState) => void>();
  const compass = browserCompass(state => { for (const listener of compassListeners) listener(state); });
  let readingError: string | null = null, readingTick = false;
  const openReading = (target: ReadingTarget) => { for (const listener of readingListeners) listener(target); };
  navigator.serviceWorker?.addEventListener('message', event => {
    const target = event.data?.reading as ReadingTarget | undefined;
    if (target && (target.kind === 'dua' ? library.duas : library.hadiths).some(item => item.id === target.id)) openReading(target);
  });
  async function dismissReading(id: string) {
    readingAlerts.delete(id); notifications.get(id)?.close(); notifications.delete(id);
    const registration = host.native ? undefined : await navigator.serviceWorker?.getRegistration();
    for (const notification of await registration?.getNotifications({ tag: id }) ?? []) notification.close();
    publish();
  }
  async function checkReadings() {
    if (readingTick || (host.native && document.hidden)) return; readingTick = true;
    try {
      const now = new Date(), zone = activeLocation(config).timeZone, date = dateAt(now, zone);
      for (const [id, reading] of readingAlerts) if (reading.date !== date || !preferences[reading.kind === 'hadith' ? 'dailyHadith' : 'dailyDua'].enabled) await dismissReading(id);
      for (const kind of dueDailyReminders(preferences, now, zone)) {
        const id = `daily:${kind}:${date}`, row = { id, scheduled: now.toISOString(), claimed: now.toISOString(), status: 'claimed', detail: '' };
        if (!await claimEvent(row)) continue;
        const reading = { ...readingForDay(library, kind, date), id, date };
        readingAlerts.set(id, reading); publish();
        try {
          if (!host.native && preferences.notifications && 'Notification' in window && Notification.permission === 'granted') {
            const { title, body } = readingNotification(reading, resolveLanguage(preferences.language, navigator.languages)), target = { kind, id: reading.item.id };
            const options = { body, tag: id, silent: true, data: { reading: target } };
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration) await registration.showNotification(title, options);
            else { const notification = new Notification(title, options); notifications.set(id, notification); notification.onclick = () => { window.focus(); openReading(target); void dismissReading(id); }; }
          }
          await finishEvent({ ...row, status: 'delivered' });
        } catch (e) { await finishEvent({ ...row, status: 'failed', detail: String(e) }); throw e; }
      }
      readingError = null;
    } catch (e) { readingError = `Daily readings could not be checked: ${String(e)}`; }
    finally { readingTick = false; publish(); }
  }
  setInterval(() => void checkReadings(), 15000);
  const channel = new BroadcastChannel('athan-browser');
  const reload = async () => { config = configSchema.parse(await readSetting('config')); preferences = prefsSchema.parse(await readSetting('preferences')); publish(); };
  channel.onmessage = () => { void reload().catch(e => { error = String(e); publish(); }); };
  const changed = () => { channel.postMessage('changed'); publish(); };
  const stop = () => audio.stop();
  const removeAlert = (id: string) => { alerts.delete(id); notifications.get(id)?.close(); notifications.delete(id); };
  const dismiss = async () => {
    stop();
    if (activeEvent) { dismissed.add(activeEvent.id); await finishEvent({ ...activeEvent, status: 'dismissed' }); }
    for (const id of alerts.keys()) removeAlert(id);
    if (!host.native && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      for (const notification of await registration?.getNotifications() ?? []) notification.close();
    }
    changed();
  };
  const play = (files: string[], repeat: number, maxSeconds = config.audio.maxPlaybackSeconds) => audio.play(files, repeat, config.audio.volume, maxSeconds);
  async function notify(event: ScheduledEvent, title: string) {
    if (host.native || !preferences.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await registration.showNotification(title, { body: `${event.location} · A moment for prayer.`, tag: event.id, silent: true });
    else { const notification = new Notification(title, { body: event.location, silent: true, tag: event.id }); notifications.set(event.id, notification); }
  }
  let ticking = false, planKey = '', plan: ScheduledEvent[] = [], foregroundSince = Date.now();
  async function tick() {
    if (!running || ticking || (host.native && document.hidden)) return; ticking = true;
    try {
      const now = new Date(), day = dateAt(now, activeLocation(config).timeZone), key = `${day}:${JSON.stringify(config)}`;
      if (planKey !== key) { plan = eventsAround(config, now); planKey = key; await pruneHistory(); }
      for (const event of plan) {
        if (!running) break;
        if (event.at > now || (host.native && +event.at < foregroundSince)) continue;
        const row = { id: event.id, scheduled: event.at.toISOString(), claimed: now.toISOString(), status: 'claimed', detail: '' };
        if (!await claimEvent(row)) continue;
        const late = (Date.now() - +event.at) / 1000;
        if (late > config.scheduler.graceSeconds) { await finishEvent({ ...row, status: 'skipped', detail: 'The browser was closed, asleep or too late to deliver this alert.' }); continue; }
        activeEvent = row;
        const title = `${event.prayer[0]!.toUpperCase()}${event.prayer.slice(1)}${event.kind === 'reminder' ? ' reminder' : ' prayer'}`;
        alerts.set(event.id, { id: event.id, title }); publish();
        try {
          try { await notify(event, title); }
          catch { error = 'The notification could not be shown. Prayer audio is still available.'; publish(); }
          if (!dismissed.has(event.id) && config.audio.enabled && event.files.length) await play(event.files, event.repeat);
          await finishEvent({ ...row, status: dismissed.has(event.id) ? 'dismissed' : 'delivered' });
        } catch (e) { error = String(e); await finishEvent({ ...row, status: dismissed.has(event.id) ? 'dismissed' : 'failed', detail: error }); }
        finally { activeEvent = null; dismissed.delete(event.id); setTimeout(() => { removeAlert(event.id); publish(); }, 60000); changed(); }
      }
    } catch (e) { error = `Alerts paused: ${String(e)}`; running = false; releaseLock?.(); releaseLock = null; publish(); }
    finally { ticking = false; }
  }
  setInterval(() => void tick(), 1000);
  window.addEventListener('pagehide', () => { stop(); releaseLock?.(); running = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { void reload().then(tick).catch(e => { error = String(e); publish(); }); } });

  if (config.audio.enabled && config.audio.startupEnabled && config.audio.startupFile) void play([config.audio.startupFile], 1).catch(() => { error = 'Browser autoplay blocked the startup recording. Prayer audio can be enabled from the dashboard.'; publish(); });
  const api: DesktopAPI = {
    hadithStatus: () => hadith.status(), hadithConnect: key => hadith.connect(key),
    hadithDownload: id => hadith.download(id), async hadithCancel() { hadith.cancel(); },
    hadithSaveAll: () => hadith.saveAll(),
    hadithRead: id => hadith.read(id), hadithRemove: id => hadith.remove(id),
    async hadithSource(id, number) {
      if (id.startsWith('source:') && HADITH_SOURCES[id.slice(7)]) { await openUrl(HADITH_SOURCES[id.slice(7)]!); return; }
      if (id === 'connection') { await openUrl('https://sunnah.com/developers'); return; }
      collectionId.parse(id);
      const entry=number ? (await hadith.read(id))?.entries.find(e=>narrationId(e)===number) : undefined;
      if (number && !entry) throw new Error('Unknown narration');
      await openUrl(entry ? entry.url ?? narrationUrl(id, entry.hadithNumber) : `https://sunnah.com/${id}`);
    },
    async snapshot(date) {
      const now = new Date(), today = dateAt(now, activeLocation(config).timeZone), day = calculateDay(config, date ?? today);
      return serialize<Snapshot>({ config, preferences, day, today, now, deviceLanguages: navigator.languages, next: nextPrayer(config, now), startupEnabled: false,
        runtime: { status: running ? 'running' : 'paused', error, playing: audio.playing, audioPaused: audio.paused, audioLoading: audio.loading, alerts: [...alerts.values()] }, history: (await history()).slice(0, 30),
        readingAlerts: [...readingAlerts.values()], readingError,
        observances: [day.hijri.year, day.hijri.year + 1].flatMap(year => islamicDays(year, config.hijriAdjustment)).filter(e => e.date >= today).slice(0, 4) });
    },
    async month(month) { const { start, end } = bounds(month); return serialize(calendarRows(config, start, end)); },
    async calendarMonth(month) { const { start, end } = calendarPeriod(month, config.hijriAdjustment); return serialize({ days: calendarRows(config, start, end), events: eventsBetween(start, end, config.hijriAdjustment) }); },
    async calendarEvents(year) { return islamicDays(z.number().int().min(1).max(9999).parse(year), config.hijriAdjustment); },
    async convertDate(request) {
      const gregorian = request.calendar === 'gregorian' ? request.date : fromHijri(request.year, request.month, request.day, config.hijriAdjustment);
      parseDate(gregorian);
      if (gregorian < '1901-01-01' || gregorian > '2098-12-31') throw new Error('Choose a date between Gregorian years 1901 and 2098');
      return { gregorian, hijri: toHijri(gregorian, config.hijriAdjustment) };
    },
    async saveConfig(value: Config) { const parsed = configSchema.parse(value); await writeSetting('config', parsed); config = parsed; changed(); },
    async preferences(patch) {
      if (patch.notifications) {
        if (host.requestNotifications) await host.requestNotifications();
        else if (!('Notification' in window) || await Notification.requestPermission() !== 'granted') throw new Error('Allow notifications in your browser site settings to enable them.');
      }
      const value = prefsSchema.parse({ ...preferences, ...prefsPatch.parse(patch) }); await writeSetting('preferences', value); preferences = value; await checkReadings(); changed();
    },
    async running(enabled) {
      if (!enabled) { running = false; await dismiss(); releaseLock?.(); releaseLock = null; publish(); return; }
      if (config.audio.enabled) await audio.unlock();
      if (running) return;
      if (host.native) { foregroundSince = Date.now(); running = true; error = null; publish(); void tick(); return; }
      if (!navigator.locks) throw new Error('This browser needs HTTPS or localhost and Web Locks to safely run prayers.');
      await new Promise<void>((resolve, reject) => {
        void navigator.locks.request('athan-prayer-alerts', { ifAvailable: true }, async lock => {
          if (!lock) { reject(new Error('Prayers are already enabled in another Athan tab.')); return; }
          running = true; error = null;
          await new Promise<void>(release => { releaseLock = release; resolve(); publish(); });
        }).catch(reject);
      });

      void tick();
    },
    dismissAlerts: dismiss,
    pauseAudio: paused => audio.pause(paused),
    async chooseAudio() {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*,.mp3,.wav,.m4a,.ogg';
        input.oncancel = () => resolve(null);
        input.onchange = () => {
          const file = input.files?.[0]; if (!file) { resolve(null); return; }
          if (file.size > 50 * 1024 * 1024) { reject(new Error('Choose a recording smaller than 50 MB.')); return; }
          const id = `audio/${localId()}/${file.name}`;
          void storeAudio({ id, name: file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '), blob: file }).then(() => resolve(id), reject);
        };
        input.click();
      });
    },
    async recordings() { await recordingDownload; return (await audioRecords()).map(record => ({ name: record.name, path: record.id, group: record.default ? 'Default · saved in this browser' : 'Saved in this browser' })); },
    async preview(path) {
      if (activeEvent) throw new Error('Dismiss the current prayer alert before previewing a recording.');
      if (!path) { stop(); publish(); return; }
      await audio.unlock();
      error = null; void play([path], 1, config.audio.maxPlaybackSeconds).catch(e => { error = String(e); publish(); });
    },
    async exportCalendar(month, format) {
      const { start, end, title } = calendarPeriod(month, config.hijriAdjustment);
      if (format === 'csv') return exportFile(calendarCsv(config, start, end), `Athan-${title}.csv`, 'text/csv;charset=utf-8');
      if (!crypto.subtle) throw new Error('ICS export requires HTTPS or localhost. You can export PDF or CSV over this LAN connection.');
      const hashes = new Map<string, string>(), place = activeLocation(config);
      await Promise.all(calendarRows(config, start, end).flatMap(day => PRAYERS.map(async prayer => {
        const key = `${place.id}:${place.latitude}:${place.longitude}:${day.date}:${prayer}`;
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
        hashes.set(key, [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32));
      })));
      return exportFile(renderCalendarIcs(config, start, end, key => hashes.get(key)!), `Athan-${title}.ics`, 'text/calendar;charset=utf-8');
    },
    async exportedFile() { throw new Error('Use your browser’s downloads list to open a saved file or show its folder.'); },
    async exportPdf(options) {
      pdfPeriod(options, config.hijriAdjustment);
      const fonts = await Promise.all([manrope, cormorant, notoArabic].map(async url => { const response = await fetch(url); if (!response.ok) throw new Error('Print fonts are not available offline yet.'); return blobData(await response.blob()); }));
      const language = resolveLanguage(preferences.language, navigator.languages);
      const html = calendarPrintHtml({ ...config, locale: language === 'en' ? 'en-AU' : language }, options, `@font-face{font-family:Manrope;font-weight:100 900;src:url(${fonts[0]})}@font-face{font-family:Cormorant;font-weight:600;src:url(${fonts[1]})}@font-face{font-family:NotoArabic;font-weight:100 900;src:url(${fonts[2]})}`);
      if (host.printHtml) return host.printHtml(html);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })), frame = document.createElement('iframe');
      frame.title = 'Printable prayer calendar'; frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
      try {
        await new Promise<void>((resolve, reject) => { frame.onload = () => resolve(); frame.onerror = () => reject(new Error('Could not open print preview')); frame.src = url; document.body.append(frame); });
        await frame.contentDocument?.fonts.ready;
        frame.contentWindow?.print();
      } finally { setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000); }
      return 'Choose Save as PDF in the browser print dialog.';
    },
    countries, cities,
    deviceLocation, compass,
    subscribeCompass(callback) { compassListeners.add(callback); return () => { compassListeners.delete(callback); }; },
    async devotionLibrary() { return library; },
    async copyDua(id) {
      const dua = library.duas.find(d => d.id === id); if (!dua) throw new Error('Unknown dua');
      await (host.copyText ? host.copyText(duaText(dua)) : navigator.clipboard.writeText(duaText(dua)));
    },
    dismissReading,
    async openReadingSource(id) {
      const url = id === 'dua-library' ? 'https://github.com/majmoo-io/hisnu-al-muslim-data/tree/main/data/ar.al-qahtani-sunnah-com' : library.duas.find(item => item.id === id)?.url ?? library.hadiths.find(item => item.id === id)?.url;
      if (!url) throw new Error('Unknown reading source');
      await openUrl(url);
    },
    subscribeReading(callback) { readingListeners.add(callback); return () => { readingListeners.delete(callback); }; },
    async search(query, online, country) {
      if (!online) return country ? cities(country, query) : { locations: config.locations.filter(l => l.name.toLowerCase().includes(query.toLowerCase())) };
      return cachedSearch(query, country, { read: () => readSetting('search-cache'), write: async value => { await writeSetting('search-cache', value); } }, fetch, !navigator.onLine);
    },
    async startup() { throw new Error('Use the desktop app for Windows sign-in startup.'); },
    async diagnostics() {
      const offline = offlineState(), records = new Set((await audioRecords()).map(r => r.id));
      const files = [...Object.values(config.audio.prayers).map(p => p.file), config.audio.duaFile, config.audio.startupFile, ...config.reminders.map(r => r.file)].filter((f): f is string => !!f);
      return [{ check: 'Offline app and city catalogue', ok: offline.ready, detail: offline.message },
        { check: 'Settings and saved locations', ok: !!await readSetting('config'), detail: 'Saved on this device in this browser. Prayer times, Qibla and calendars are calculated locally.' },
        { check: 'Storage protection', ok: offline.persistent, detail: offline.persistent ? 'The browser granted persistent storage.' : 'Use Keep offline data above. Clearing site data or using private browsing can remove saved data.' },
        ...[...new Set(files)].map(path => ({ check: 'Saved recording', ok: records.has(path), detail: path.split('/').at(-1)! })),
        { check: 'Browser prayers', ok: true, detail: 'Enable Athan after opening the app. Keep the tab open and device awake. Background tabs can be delayed by the browser.' }];
    },
    async window() {},
    subscribe(callback) { listeners.add(callback); return () => { listeners.delete(callback); }; },
  };
  void checkReadings();
  return api;
}
