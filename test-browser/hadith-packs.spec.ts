import { test, expect } from '@playwright/test';

test('public collections download without a key, expose chapters and source references, and survive offline reload',async({page,context})=>{
  await page.goto('/');await expect(page.locator('.prayer-card')).toHaveCount(6);
  await page.getByRole('navigation').getByRole('button',{name:'Hadith library',exact:true}).click();
  await expect(page.locator('.hadith-collection')).toHaveCount(17);
  expect((await page.evaluate(()=>window.athan.hadithStatus())).connected).toBe(false);
  await page.locator('.hadith-collection').first().getByRole('button',{name:'Download',exact:true}).click();
  await expect(page.locator('.hadith-reader')).toContainText('intentions',{timeout:20000});
  await expect(page.locator('.hadith-reader .hadith-references')).toContainText('Book 1, Hadith 1');
  await page.getByLabel('Hadith book',{exact:true}).selectOption('1');
  const chapters=page.getByLabel('Hadith chapter',{exact:true});
  expect(await chapters.locator('option').count()).toBeGreaterThan(2);
  await chapters.selectOption({index:1});
  await expect(page.locator('.hadith-reader')).toContainText('intentions');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);await page.reload();await expect(page.locator('.prayer-card')).toHaveCount(6);
  await page.getByRole('navigation').getByRole('button',{name:'Hadith library',exact:true}).click();
  await expect(page.locator('.hadith-reader')).toContainText('intentions');
  await page.getByLabel('Search hadith').fill('no matching fixture');await expect(page.locator('.hadith-reader')).toHaveText('No matching readings');
  await page.getByLabel('Search hadith').fill('');
  await page.locator('.language-picker select').selectOption('ar');
  await page.locator('.hadith-reader').scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/screenshots/hadith-public-arabic.png',animations:'disabled'});
  await page.locator('.language-picker select').selectOption('en');
  await page.screenshot({path:'docs/screenshots/hadith-public-english.png',animations:'disabled'});
});
