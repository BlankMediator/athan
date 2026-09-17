import { test, expect } from '@playwright/test';

test('HTTP LAN pages support readings, reminders and recordings without secure-context APIs', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: 'en-AU' });
  // Serve the real build under an ordinary HTTP hostname, not a trusted localhost origin.
  await context.route('http://athan.lan.test/**', async route => {
    const response = await route.fetch({ url: route.request().url().replace('http://athan.lan.test', baseURL!) });
    await route.fulfill({ response });
  });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto('http://athan.lan.test/');
    await expect(page.locator('.prayer-card')).toHaveCount(6);
    expect(await page.evaluate(() => ({ secure: isSecureContext, uuid: typeof crypto.randomUUID, locks: typeof navigator.locks })))
      .toEqual({ secure: false, uuid: 'undefined', locks: 'undefined' });
    await page.getByRole('navigation').getByRole('button', { name: 'Hisnul Muslim', exact: true }).click();
    await expect(page.locator('.reading-index>p')).toHaveText('268 supplications');
    await page.getByRole('navigation').getByRole('button', { name: 'Reminders', exact: true }).click();
    await page.getByRole('button', { name: 'Add reminder', exact: true }).click();
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const reminder = (await page.evaluate(() => window.athan.snapshot())).config.reminders[0];
    expect(reminder.id).toMatch(/^reminder-[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    const fileChooser = page.waitForEvent('filechooser');
    const selected = page.evaluate(() => window.athan.chooseAudio());
    await (await fileChooser).setFiles({ name: 'lan-sample.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(44) });
    expect(await selected).toMatch(/^audio\/[\da-f-]+\/lan-sample\.wav$/);
    expect((await page.evaluate(() => window.athan.recordings())).filter(r => r.path.endsWith('/lan-sample.wav'))).toHaveLength(1);
    const snapshot = await page.evaluate(() => window.athan.snapshot());
    const downloaded = page.waitForEvent('download');
    await page.evaluate(month => window.athan.exportCalendar(month, 'csv'), snapshot.today.slice(0, 7));
    expect((await downloaded).suggestedFilename()).toMatch(/\.csv$/);
    await expect(page.evaluate(month => window.athan.exportCalendar(month, 'ics'), snapshot.today.slice(0, 7))).rejects.toThrow(/ICS export requires HTTPS/);
    await expect(page.evaluate(() => window.athan.running(true))).rejects.toThrow(/HTTPS or localhost/);
    await page.reload(); await expect(page.locator('.prayer-card')).toHaveCount(6);
    expect((await page.evaluate(() => window.athan.snapshot())).config.reminders[0].id).toBe(reminder.id);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
