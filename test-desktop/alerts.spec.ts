import { test, expect, _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defaultConfig } from '../src/config.js';
import { eventsForDay } from '../src/scheduler.js';
import { addDays, dateAt } from '../src/dates.js';

test('desktop dismissal stops native audio, preserves later alerts and works from notifications and tray', async () => {
  test.setTimeout(90000);
  const root = resolve('.'); mkdirSync(join(root, 'test-results'), { recursive: true });
  const profile = mkdtempSync(join(root, 'test-results/dismiss-profile-')), wav = join(profile, 'silence.wav');
  // A valid minute of silent PCM, plus volume zero. No audible test or native toast is produced.
  const samples = 8000 * 60, audio = Buffer.alloc(44 + samples * 2);
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write('data', 36); audio.writeUInt32LE(samples * 2, 40); writeFileSync(wav, audio);
  const config = defaultConfig(); config.audio.volume = 0; config.audio.prayers.fajr.file = wav; config.audio.duaFile = wav;
  config.scheduler.pollSeconds = 1;
  config.reminders = [1, 2, 3].map(n => ({ id: `reminder-${n}`, prayer: 'fajr', offsetMinutes: n, file: wav, repeat: 3, enabled: true }));
  const event = eventsForDay(config, addDays(dateAt(new Date(), 'Australia/Melbourne'), 1))[0]!;
  writeFileSync(join(profile, 'config.json'), JSON.stringify(config));
  writeFileSync(join(profile, 'desktop.json'), JSON.stringify({ notifications: true, resumeAlerts: false }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => k !== 'ELECTRON_RUN_AS_NODE' && v !== undefined)) as Record<string, string>;
  const app = await electron.launch({ executablePath: join(root, 'node_modules/electron/dist/electron.exe'), args: [root], cwd: root, env: { ...env, ATHAN_DATA_DIR: profile } });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: 'Enable Athan', exact: true })).toBeVisible();
    await app.evaluate(async ({ Notification, Tray }, now) => {
      const state = globalThis as any;
      state.alertTest = { clock: now, notifications: [], players: [], menu: null, tooltip: '' };
      const RealDate = Date;
      globalThis.Date = class extends RealDate {
        constructor(...args: any[]) { super(...(args.length ? args : [state.alertTest.clock]) as [any]); }
        static now() { return state.alertTest.clock; }
      } as DateConstructor;
      Notification.prototype.show = function () { state.alertTest.notifications.push(this); };
      const originalMenu = Tray.prototype.setContextMenu, originalTip = Tray.prototype.setToolTip;
      Tray.prototype.setContextMenu = function (menu) { state.alertTest.menu = menu; originalMenu.call(this, menu); };
      Tray.prototype.setToolTip = function (tip) { state.alertTest.tooltip = tip; originalTip.call(this, tip); };
      const cp = process.getBuiltinModule('child_process'), originalSpawn = cp.spawn;
      cp.spawn = function (...args: any[]) {
        const child = (originalSpawn as any)(...args);
        if (args[0] === 'powershell.exe') {
          const record = { closed: false, decoded: false }; state.alertTest.players.push(record);
          child.stdout?.on('data', (data: Buffer) => { if (String(data).includes('duration=')) record.decoded = true; });
          child.once('close', () => { record.closed = true; });
        }
        return child;
      } as typeof cp.spawn;
      process.getBuiltinModule('module').syncBuiltinESMExports();
    }, +event.at);
    const players = () => app.evaluate(() => (globalThis as any).alertTest.players);
    const nextAlert = async (minute: number, index: number) => {
      await app.evaluate((_, now) => { (globalThis as any).alertTest.clock = now; }, +event.at + minute * 60000);
      await expect(page.locator('.active-alert')).toContainText('Fajr reminder');
      await expect.poll(async () => (await players())[index]?.decoded, { timeout: 15000 }).toBe(true);
    };
    const stopped = async (index: number) => {
      await expect(page.locator('.active-alert')).toHaveCount(0);
      await expect.poll(async () => (await players())[index]?.closed).toBe(true);
      expect((await page.evaluate(() => window.athan.snapshot())).runtime.status).toBe('running');
    };
    await page.getByRole('button', { name: 'Enable Athan', exact: true }).click();
    await expect(page.locator('.active-alert')).toContainText('Time for Fajr');
    await expect.poll(async () => (await players())[0]?.decoded, { timeout: 15000 }).toBe(true);
    expect(await app.evaluate(() => (globalThis as any).alertTest.tooltip)).toMatch(/Current: Fajr\nNext: Dhuhr · .+\nRemaining: /);
    await app.evaluate(() => (globalThis as any).alertTest.notifications[0].emit('close', { reason: 'timedOut' }));
    await expect(page.locator('.active-alert')).toBeVisible();
    await page.screenshot({ path: join(root, 'docs/screenshots/dismiss-alert.png') });
    await page.getByRole('button', { name: 'Stop Athan', exact: true }).click();
    await stopped(0);
    await expect(page.getByRole('button', { name: 'Stop Athan', exact: true })).toBeDisabled();
    await expect.poll(async () => (await page.evaluate(() => window.athan.snapshot())).history.find(row => row.id === event.id)?.status).toBe('dismissed');

    await nextAlert(1, 1);
    // An old notification must not stop the new alert.
    await app.evaluate(() => (globalThis as any).alertTest.notifications[0].emit('close', { reason: 'userCanceled' }));
    await expect(page.locator('.active-alert')).toBeVisible();
    await app.evaluate(() => (globalThis as any).alertTest.notifications[1].emit('action', { actionIndex: 0 }));
    await stopped(1);

    await nextAlert(2, 2);
    await app.evaluate(() => (globalThis as any).alertTest.notifications[2].emit('close', { reason: 'userCanceled' }));
    await stopped(2);

    await nextAlert(3, 3);
    await app.evaluate(() => {
      const item = (globalThis as any).alertTest.menu.items.find((i: any) => i.label === 'Dismiss / stop sound');
      if (!item.enabled) throw new Error('Tray dismissal unavailable');
      item.click(item);
    });
    await stopped(3);
    const saved = await page.evaluate(() => window.athan.snapshot());
    expect(saved.history.filter(row => row.status === 'dismissed')).toHaveLength(4);
    expect(saved.runtime.error).toBeNull(); expect(saved.preferences.resumeAlerts).toBe(true);
    expect(saved.config.audio.prayers.fajr.enabled).toBe(true); expect((await players())).toHaveLength(4);
    await page.evaluate(file => window.athan.preview(file), wav);
    await expect(page.locator('.active-alert')).toContainText('Sound preview');
    await expect.poll(async () => (await players())[4]?.decoded, { timeout: 15000 }).toBe(true);
    await page.getByRole('button', { name: 'Dismiss / stop sound', exact: true }).click();
    await stopped(4);
  } finally { await app.close(); }
});
