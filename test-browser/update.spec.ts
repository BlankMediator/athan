import { test, expect } from '@playwright/test';
test('device language, calendar choice, complete readings and preference persistence work in a browser', async ({ browser }) => {
  const context=await browser.newContext({locale:'ar-EG'}),page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
  try {
    await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang','ar');await expect(page.locator('html')).toHaveAttribute('dir','ltr');
    await page.locator('.language-picker select').selectOption('en');await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.getByRole('navigation').getByRole('button',{name:'Calendar',exact:true}).click();
    await page.locator('.calendar-jump .calendar-mode').getByRole('button',{name:'Hijri',exact:true}).click();
    await expect(page.locator('.calendar-day')).not.toHaveCount(0);
    expect((await page.evaluate(()=>window.athan.devotionLibrary())).duas).toHaveLength(268);
    const snapshot=await page.evaluate(()=>window.athan.snapshot());expect(snapshot.preferences.dailyDua.enabled).toBe(false);expect(snapshot.preferences.dailyHadith.enabled).toBe(false);
    await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
    expect((await page.evaluate(()=>window.athan.snapshot())).preferences.calendar).toBe('hijri');
    await page.getByRole('navigation').getByRole('button',{name:'Calendar',exact:true}).click();await expect(page.locator('.calendar-jump .calendar-mode').getByRole('button',{name:'Hijri',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(errors).toEqual([]);
  } finally {await context.close();}
});
test('browser hadith API is explicitly connected and its key is session-only', async ({ page }) => {
  await page.route('https://api.sunnah.com/v1/**',route=>route.fulfill({json:{data:[],next:null,total:0}}));
  await page.goto('/');await expect(page.locator('.prayer-card')).toHaveCount(6);
  await page.evaluate(()=>window.athan.hadithConnect('test-session-key'));
  expect((await page.evaluate(()=>window.athan.hadithStatus())).connected).toBe(true);
  await page.reload();await expect(page.locator('.prayer-card')).toHaveCount(6);
  expect((await page.evaluate(()=>window.athan.hadithStatus())).connected).toBe(false);
});
