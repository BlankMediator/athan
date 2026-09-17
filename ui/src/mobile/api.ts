import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import type { DesktopAPI } from '../../../src/desktop/types.js';
import type { ReadingTarget } from '../../../src/devotion-content.js';
import { readingForDay, readingNotification } from '../../../src/devotion-content.js';
import { resolveLanguage } from '../../../src/localization.js';
import { mobileNotificationPlan } from '../../../src/mobile/notification-plan.js';
import { createBrowserAPI } from '../browser/api';
import { nearestCity } from '../browser/catalogue';
import { library } from '../browser/devotion';
import { readSetting, writeSetting } from '../browser/storage';
import { mobileActions, mobileStatus, setMobileStatus } from './status';

const NativePrint = registerPlugin<{ print(options: { html: string; name: string }): Promise<void> }>('AthanPrint');
const owned = (id: number) => id >= 41000 && id < 41060;

export async function createMobileAPI(): Promise<DesktopAPI> {
  if (!Capacitor.isNativePlatform()) throw new Error('Open the mobile project on an Android or iOS device. For a web browser, use the browser build.');
  const platform = Capacitor.getPlatform();
  let enabled = await readSetting<boolean>('mobile-enabled') === true;
  let active = (await NativeApp.getState()).isActive;
  const listeners = new Set<() => void>(), readingListeners = new Set<(target: ReadingTarget) => void>();
  let pendingReading: ReadingTarget | undefined;
  let queue = Promise.resolve();
  const serial = (task: () => Promise<void>) => { const next = queue.then(task); queue = next.catch(() => {}); return next; };
  const publish = () => { for (const listener of listeners) listener(); };
  const report = (error: unknown) => { setMobileStatus({ error: `Reminders need attention: ${String(error)}` }); publish(); };
  async function requestNotifications() {
    const permission = await LocalNotifications.requestPermissions();
    setMobileStatus({ permission: permission.display });
    if (permission.display !== 'granted') throw new Error('Allow notifications in your device settings to receive prayer reminders.');
  }
  const base = await createBrowserAPI({
    native: true, requestNotifications,
    async exportFile(content, name) {
      const file = await Filesystem.writeFile({ path: `exports/${name}`, directory: Directory.Cache, data: content, encoding: Encoding.UTF8, recursive: true });
      await Share.share({ title: name, files: [file.uri], dialogTitle: 'Save or share your calendar' });
      return 'Calendar opened in the share sheet.';
    },
    async printHtml(html) { await NativePrint.print({ html, name: 'Athan prayer calendar' }); return 'Calendar opened in the system print dialog.'; },
    async openUrl(url) { await Browser.open({ url }); },
    async copyText(string) { await Clipboard.write({ string }); },
  });
  base.subscribe(publish);
  base.subscribeReading(target => { for (const callback of readingListeners) callback(target); });
  async function reschedule() {
    try {
      const snapshot = await base.snapshot();
      const permission = await LocalNotifications.checkPermissions();
      const exact = platform !== 'android' || (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
      setMobileStatus({ platform, permission: permission.display, exact, error: null });
      const plan = permission.display === 'granted' ? mobileNotificationPlan(snapshot.config, snapshot.preferences, enabled, new Date(), (kind, date) => {
        const reading = readingForDay(library, kind, date);
        return { ...readingNotification(reading, resolveLanguage(snapshot.preferences.language, navigator.languages)), target: { kind, id: reading.item.id } };
      }) : [];
      const { notifications } = await LocalNotifications.getPending();
      const previous = notifications.filter(n => owned(n.id)).map(({ id }) => ({ id }));
      if (previous.length) await LocalNotifications.cancel({ notifications: previous });
      setMobileStatus({ pending: 0, through: null });
      if (plan.length) await LocalNotifications.schedule({ notifications: plan.map(item => ({
        id: item.id, title: item.title, body: item.body,
        schedule: { at: item.at, allowWhileIdle: true },
        channelId: 'athan-reminders-v1', smallIcon: 'ic_stat_athan',
        // Never open the exact-alarm settings page during an automatic refresh.
        isExactNotification: exact,
        extra: { key: item.key, reading: item.reading },
      })) });
      setMobileStatus({ pending: plan.filter(n => n.kind !== 'refresh').length, through: plan.filter(n => n.kind !== 'refresh').at(-1)?.at.toISOString() ?? null });
    } catch (error) { report(error); throw error; }
    finally { publish(); }
  }
  mobileActions(() => serial(reschedule), async () => {
    if (platform === 'android') await LocalNotifications.changeExactNotificationSetting();
    await serial(reschedule);
  });
  const onNotification = (target?: ReadingTarget) => {
    if (!target || !(target.kind === 'dua' ? library.duas : library.hadiths).some(item => item.id === target.id)) return;
    if (!readingListeners.size) pendingReading = target;
    for (const callback of readingListeners) callback(target);
  };
  await LocalNotifications.addListener('localNotificationActionPerformed', event => onNotification(event.notification.extra?.reading));
  // Android's silent channel is created natively before the WebView starts.
  if (platform === 'android') await NativeApp.addListener('backButton', () => {
    const event = new Event('athan-back', { cancelable: true });
    if (window.dispatchEvent(event)) void NativeApp.minimizeApp();
  });
  await NativeApp.addListener('appStateChange', state => {
    active = state.isActive;
    if (!active) { void base.running(false).catch(report); return; }
    void serial(async () => { await reschedule(); await base.running(enabled); }).catch(report);
  });
  // Refresh while visible as well as on reopening; no JavaScript background timer is required.
  setInterval(() => { if (active) void serial(reschedule).catch(report); }, 3600000);
  const api: DesktopAPI = {
    ...base,
    async snapshot(date) {
      const snapshot = await base.snapshot(date);
      return { ...snapshot, runtime: { ...snapshot.runtime, status: enabled ? 'running' : 'paused' } };
    },
    async saveConfig(config) { await serial(async () => { await base.saveConfig(config); await reschedule(); }); },
    async preferences(patch) { await serial(async () => { await base.preferences(patch); await reschedule(); }); },
    async running(value) {
      await serial(async () => {
        if (value) await base.preferences({ notifications: true });
        await writeSetting('mobile-enabled', value); enabled = value;
        await base.running(value && active);
        await reschedule();
      });
    },
    async dismissAlerts() { await base.dismissAlerts(); await LocalNotifications.removeAllDeliveredNotifications(); },
    async deviceLocation() {
      const permission = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') throw new Error('Location permission was denied. You can still choose a city or enter coordinates.');
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 18000, maximumAge: 60000 });
      const { latitude, longitude, accuracy } = position.coords;
      return { latitude, longitude, accuracy, timestamp: new Date(position.timestamp).toISOString(), source: 'Device location services', ...await nearestCity(latitude, longitude) };
    },
    async recordings() { return (await base.recordings()).map(record => ({ ...record, group: record.group.replace('this browser', 'this device') })); },
    async diagnostics() {
      const state = mobileStatus();
      const diagnostics = (await base.diagnostics()).filter(row => row.check === 'Saved recording' || row.check === 'Offline app and city catalogue');
      return [...diagnostics,
        { check: 'Settings storage', ok: true, detail: 'Settings use native app storage. Imported recordings and installed reading packs stay on this device. Uninstalling or clearing app data removes them.' },
        { check: 'Notification permission', ok: state.permission === 'granted', detail: state.permission },
        { check: 'Scheduled reminders', ok: !state.error, detail: state.error ?? `${state.pending} reminders queued${state.through ? ` through ${new Date(state.through).toLocaleString()}` : ''}. Open Athan regularly to extend the schedule.` },
        { check: 'Precise timing', ok: state.exact, detail: state.exact ? 'Precise scheduling is allowed. Device power restrictions can still affect delivery.' : 'Allow Alarms & reminders to improve timing. Current reminders may be delayed.' },
        { check: 'Playback', ok: true, detail: 'Full recordings play while Athan is open. Background notifications are silent. Activity records foreground playback only.' }];
    },
    subscribe(callback) { listeners.add(callback); return () => { listeners.delete(callback); }; },
    subscribeReading(callback) {
      readingListeners.add(callback);
      if (pendingReading) { const target = pendingReading; pendingReading = undefined; queueMicrotask(() => callback(target)); }
      return () => { readingListeners.delete(callback); };
    },
  };
  // Permission failures should never prevent access to prayer times or saved readings.
  await reschedule().catch(report);
  await base.running(enabled && active);
  return api;
}
