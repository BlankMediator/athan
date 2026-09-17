import { test, expect } from '@playwright/test';
import { magneticDeclination, normalizeHeading } from '../src/compass.js';

test.use({ launchOptions: { args: ['--autoplay-policy=user-gesture-required'] } });

async function observeAudio(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    (window as any).audioContexts = [];
    window.AudioContext = class extends NativeContext {
      constructor() {
        super();
        const analyser = this.createAnalyser(), mute = this.createGain(); mute.gain.value = 0;
        analyser.connect(mute); mute.connect(this.destination);
        Object.defineProperty(this, 'destination', { value: analyser });
        (window as any).audioContexts.push({ context: this, analyser });
      }
    };
  });
}
const rms = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const item = (window as any).audioContexts.at(-1); if (!item) return 0;
  const samples = new Float32Array(item.analyser.fftSize); item.analyser.getFloatTimeDomainData(samples);
  return Math.sqrt(samples.reduce((sum, n) => sum + n*n, 0) / samples.length);
});

test('manual audio produces samples, pauses and resumes across pages with immediate controls', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/'); await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  await page.getByRole('navigation').getByRole('button', { name: 'Athan & sounds', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Fajr recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause audio', exact: true })).toBeVisible();
  await expect.poll(() => rms(page), { timeout: 15000 }).toBeGreaterThan(.001);
  await page.getByRole('button', { name: 'Pause audio', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).audioContexts.at(-1).context.state)).toBe('suspended');
  await expect(page.getByRole('button', { name: 'Resume audio', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Resume audio', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).audioContexts.at(-1).context.state)).toBe('running');
  await expect.poll(() => rms(page)).toBeGreaterThan(.001);
  await page.getByRole('button', { name: 'Dismiss / stop sound', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Audio player' })).toHaveCount(0);
  await expect.poll(() => rms(page)).toBeLessThan(.00001);
});

test('Enable Athan unlocks real scheduled audio without needing a preview first', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/'); await expect(page.locator('.offline-status summary')).toHaveText('Available offline');
  const s = await page.evaluate(() => window.athan.snapshot()), at = s.day.times.dhuhr!;
  await page.clock.setFixedTime(new Date(+new Date(at) - 1000));
  await page.getByRole('button', { name: 'Enable Athan', exact: true }).click();
  await page.clock.setFixedTime(new Date(+new Date(at) + 1000));
  await expect(page.locator('.audio-dock')).toContainText('Dhuhr prayer');
  await expect.poll(() => rms(page), { timeout: 15000 }).toBeGreaterThan(.001);
  await page.getByRole('button', { name: 'Pause audio', exact: true }).click();
  expect((await page.evaluate(() => window.athan.snapshot())).runtime.status).toBe('running');
  await page.getByRole('button', { name: 'Dismiss / stop sound', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.athan.snapshot())).history.find(h => h.id.endsWith(':dhuhr:athan'))?.status).toBe('dismissed');
  await page.evaluate(() => window.athan.running(false));
});

test('compass follows magnetic sensor direction and the Kaaba tracks the relative bearing', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.prayer-card')).toHaveCount(6);
  await page.getByRole('navigation').getByRole('button', { name: 'Qibla', exact: true }).click();
  await page.getByRole('button', { name: 'Use device compass', exact: true }).click();
  const s = await page.evaluate(() => window.athan.snapshot()), place = s.config.locations.find(l => l.id === s.config.activeLocation)!;
  const declination = magneticDeclination(place.latitude, place.longitude)!;
  const emit = (heading: number) => page.evaluate(heading => {
    const event = new Event('deviceorientation');
    Object.assign(event, { webkitCompassHeading: heading, webkitCompassAccuracy: 5 }); window.dispatchEvent(event);
  }, heading);
  await emit(90);
  await expect(page.locator('.device-compass-controls')).toContainText('estimated true north');
  await expect.poll(async () => +(await page.locator('.qibla-marker').getAttribute('data-relative-bearing'))!).toBeCloseTo(normalizeHeading(s.day.qibla - 90 - declination), 1);
  await emit(normalizeHeading(s.day.qibla - declination));
  await expect(page.locator('.qibla-guidance')).toHaveText('You are facing the Qibla');
  await expect(page.locator('.compass-rose')).not.toHaveAttribute('transform', 'rotate(0 200 200)');
  await page.locator('.compass').evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.locator('.compass').screenshot({ path: 'docs/screenshots/live-compass.png' });
  await page.getByRole('button', { name: 'Stop device compass', exact: true }).click();
  await emit(180);
  await expect(page.locator('.compass-rose')).toHaveAttribute('transform', 'rotate(0 200 200)');
});

test('hamburger collapses and restores navigation on desktop and phone and remembers the choice', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.prayer-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByRole('navigation')).toBeHidden();
  await page.reload(); await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand navigation' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByRole('navigation')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.screenshot({ path: 'docs/screenshots/collapsed-navigation-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Expand navigation' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Qibla', exact: true }).click();
  await expect(page.locator('.compass-panel')).toBeVisible();
});
