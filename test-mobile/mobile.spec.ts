import { test, expect, type Page } from '@playwright/test';
import { swipe } from './touch';

async function nativeBridge(page: Page, platform: 'android' | 'ios' = 'android') {
  await page.addInitScript(platform => {
    const win = window as any;
    if (platform === 'android') win.androidBridge = {};
    else win.webkit = { messageHandlers: { bridge: {} } };
    win.mobileCalls = [];
    win.nativeEvents = {};
    win.notificationsAllowed = true;
    win.exactAllowed = false;
    const plugins: Record<string, string[]> = {
      App: ['getState', 'minimizeApp'], Preferences: ['get', 'set'],
      LocalNotifications: ['checkPermissions', 'requestPermissions', 'checkExactNotificationSetting', 'changeExactNotificationSetting', 'getPending', 'cancel', 'schedule', 'createChannel', 'removeAllDeliveredNotifications'],
      Filesystem: ['writeFile'], Share: ['share'], Clipboard: ['write'], Browser: ['open'],
      Geolocation: ['requestPermissions', 'getCurrentPosition'], AthanPrint: ['print'],
    };
    win.Capacitor = {
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({ name, methods: [...methods.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] })),
      nativeCallback(plugin: string, _method: string, options: any, callback: any) { win.nativeEvents[`${plugin}:${options.eventName}`] = callback; return '1'; },
      async nativePromise(plugin: string, method: string, options: any = {}) {
        win.mobileCalls.push({ plugin, method, options });
        if (plugin === 'Preferences') {
          if (method === 'get') return { value: localStorage.getItem(options.key) };
          localStorage.setItem(options.key, options.value); return {};
        }
        if (plugin === 'App') return { isActive: true };
        if (plugin === 'LocalNotifications') {
          if (method.endsWith('Permissions')) return { display: win.notificationsAllowed ? 'granted' : 'denied' };
          if (method === 'checkExactNotificationSetting') return { exact_alarm: win.exactAllowed ? 'granted' : 'denied' };
          if (method === 'changeExactNotificationSetting') { win.exactAllowed = true; return {}; }
          if (method === 'getPending') return { notifications: JSON.parse(localStorage.getItem('pending') ?? '[]') };
          if (method === 'cancel') { if (!options.notifications?.length) throw new Error('Invalid empty notifications array'); localStorage.setItem('pending', '[]'); return {}; }
          if (method === 'schedule') { if (win.failSchedule) throw new Error('Scheduling unavailable'); localStorage.setItem('pending', JSON.stringify(options.notifications)); return { notifications: options.notifications.map((n: any) => ({ id: n.id })) }; }
        }
        if (plugin === 'Filesystem') return { uri: 'file:///cache/' + options.path };
        if (plugin === 'Geolocation' && method === 'requestPermissions') return { location: 'granted', coarseLocation: 'granted' };
        if (plugin === 'Geolocation') return { coords: { latitude: -37.744, longitude: 144.966, accuracy: 20 }, timestamp: Date.now() };
        return {};
      },
    };
  }, platform);
}
async function open(page: Page) { await page.goto('/'); await expect(page.locator('.prayer-card')).toHaveCount(6); }
async function pending(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('pending') ?? '[]')); }

test('Android queues reminders, refreshes permissions, persists settings and cancels on pause', async ({ page }) => {
  await nativeBridge(page); await open(page);
  await expect(page.getByRole('button', { name: 'Allow precise alarms' })).toBeVisible();
  expect(await pending(page)).toEqual([]);
  await page.evaluate(() => window.athan.running(true));
  const first = await pending(page);
  expect(first.length).toBeGreaterThan(20); expect(first.length).toBeLessThanOrEqual(60);
  expect(first.every((n: any) => n.isExactNotification === false)).toBe(true);
  await page.getByRole('button', { name: 'Allow precise alarms' }).click();
  await expect.poll(async () => (await pending(page)).every((n: any) => n.isExactNotification)).toBe(true);
  await page.evaluate(async () => { const s = await window.athan.snapshot(); s.config.hour12 = false; await window.athan.saveConfig(s.config); });
  await page.reload(); await expect(page.locator('.prayer-card')).toHaveCount(6);
  const saved = await page.evaluate(() => window.athan.snapshot());
  expect(saved.runtime.status).toBe('running'); expect(saved.config.hour12).toBe(false);
  await page.evaluate(() => window.athan.running(false));
  expect(await pending(page)).toEqual([]);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))).toBe(0);
});

test('iOS mobile navigation fits narrow screens and uses native exports', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await nativeBridge(page, 'ios'); await open(page);
  await page.evaluate(() => window.athan.running(true));
  expect((await pending(page)).length).toBeGreaterThan(20);
  await page.evaluate(() => window.athan.running(false));
  await page.screenshot({ path: 'output/mobile/iphone-today.png', fullPage: true });
  for (const name of ['Calendar', 'Qibla', 'Athan & sounds', 'Reminders', 'Hisnul Muslim', 'Hadith library', 'Settings', 'Today']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.page-content')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflow, `${name} overflows the phone`).toBe(false);
  }
  await page.evaluate(async () => { const s = await window.athan.snapshot(); await window.athan.exportCalendar(s.today.slice(0, 7), 'csv'); await window.athan.exportCalendar(s.today.slice(0, 7), 'ics'); });
  expect(await page.evaluate(() => (window as any).mobileCalls.filter((c: any) => c.plugin === 'Share').length)).toBe(2);
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Export calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).mobileCalls.filter((c: any) => c.plugin === 'AthanPrint').length)).toBe(1);
  expect(errors).toEqual([]);
});

test('denial leaves alerts paused; daily readings schedule independently; failures are visible', async ({ page }) => {
  await nativeBridge(page); await open(page);
  await page.evaluate(() => { (window as any).notificationsAllowed = false; });
  await expect(page.evaluate(() => window.athan.running(true))).rejects.toThrow(/Allow notifications/);
  expect((await page.evaluate(() => window.athan.snapshot())).runtime.status).toBe('paused');
  await page.evaluate(() => { (window as any).notificationsAllowed = true; });
  await page.evaluate(() => window.athan.preferences({ notifications: true, dailyDua: { enabled: true, time: '18:30' } }));
  expect((await pending(page)).filter((n: any) => n.extra.reading).length).toBeGreaterThan(0);
  await page.evaluate(() => { (window as any).failSchedule = true; });
  await page.getByRole('button', { name: 'Refresh reminders' }).click();
  await expect(page.locator('.mobile-status')).toContainText('Scheduling unavailable');
});

test('resume rebuilds the schedule, notification taps open readings and Android back closes dialogs', async ({ page }) => {
  await nativeBridge(page); await open(page);
  await page.evaluate(() => window.athan.running(true));
  const count = await page.evaluate(() => (window as any).mobileCalls.filter((c: any) => c.method === 'schedule').length);
  await page.evaluate(() => (window as any).nativeEvents['App:appStateChange']({ isActive: false }));
  expect((await page.evaluate(() => window.athan.snapshot())).runtime.status).toBe('running');
  await page.evaluate(() => (window as any).nativeEvents['App:appStateChange']({ isActive: true }));
  await expect.poll(() => page.evaluate(() => (window as any).mobileCalls.filter((c: any) => c.method === 'schedule').length)).toBeGreaterThan(count);
  await page.getByRole('navigation').getByRole('button', { name: 'Reminders', exact: true }).click();
  await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).nativeEvents['App:backButton']({}));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => (window as any).nativeEvents['App:backButton']({}));
  await expect(page.locator('.hero-card')).toBeVisible();
  await page.evaluate(async () => { const library = await window.athan.devotionLibrary(); (window as any).nativeEvents['LocalNotifications:localNotificationActionPerformed']({ notification: { extra: { reading: { kind: 'dua', id: library.duas[0].id } } } }); });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Hisnul Muslim', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('phone and tablet layouts fit in Arabic and dark mode', async ({ page }) => {
  await nativeBridge(page, 'ios'); await open(page);
  await page.evaluate(() => window.athan.preferences({ language: 'ar', theme: 'dark' }));
  for (const viewport of [{ width: 320, height: 640 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('touch swipes scroll the page and horizontal navigation', async ({ page }) => {
  await nativeBridge(page); await open(page);
  const hero = page.locator('.hero-card');
  const before = (await hero.boundingBox())!.y;
  await swipe(page, { x: 190, y: 740 }, { x: 190, y: 300 });
  await expect.poll(async () => (await hero.boundingBox())!.y).toBeLessThan(before - 100);
  const nav = page.getByRole('navigation');
  const box = (await nav.boundingBox())!;
  await swipe(page, { x: 335, y: box.y + box.height / 2 }, { x: 60, y: box.y + box.height / 2 });
  await expect.poll(() => nav.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
});

for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
  test(`touch scrolling works at ${viewport.width} × ${viewport.height} and navigation resets the page`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await nativeBridge(page); await open(page);
    const main = (await page.locator('#main-content').boundingBox())!;
    const x = Math.min(viewport.width - 40, main.x + main.width * .55);
    await swipe(page, { x, y: viewport.height - 40 }, { x, y: 170 });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(60);
    await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('reading lists and tall dialogs scroll with touch', async ({ page }) => {
  await nativeBridge(page); await open(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Hisnul Muslim', exact: true }).click();
  const list = page.locator('.reading-index > div');
  await list.scrollIntoViewIfNeeded();
  const box = (await list.boundingBox())!;
  await swipe(page, { x: box.x + box.width / 2, y: box.y + box.height - 15 }, { x: box.x + box.width / 2, y: box.y + 15 });
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(60);
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Export calendar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const bounds = (await dialog.boundingBox())!;
  await swipe(page, { x: bounds.x + 20, y: bounds.y + bounds.height - 35 }, { x: bounds.x + 20, y: bounds.y + 60 });
  await expect.poll(() => dialog.evaluate(el => el.scrollTop)).toBeGreaterThan(50);
});
