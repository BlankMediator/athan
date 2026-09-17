import { expect, test } from '@playwright/test';
import { swipe } from '../test-mobile/touch';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test('phone browser scrolls through a long page with finger swipes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.prayer-card')).toHaveCount(6);
  await swipe(page, { x: 190, y: 740 }, { x: 190, y: 250 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
