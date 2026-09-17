import type { Page } from '@playwright/test';

/** Real browser touch input: dispatching DOM TouchEvents does not exercise scrolling. */
export async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12, id: 1 }] });
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    // Stop the finger before lifting so the next assertion/navigation isn't racing a fling.
    await new Promise(resolve => setTimeout(resolve, 120));
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}
