import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, eventsForDay, calculateDay, addDays, dateAt, parseDate } from '../dist/index.js';
import { nextAlert, timeRemaining, trayToolTip } from '../dist/desktop/tray.js';

test('tooltip includes a changing countdown without truncating it for long location names', () => {
  const config = defaultConfig(), at = eventsForDay(config, '2026-09-15')[0].at;
  config.locations[0].name = 'A very long location name '.repeat(6);
  const now = new Date(+at - 3720000), first = trayToolTip(config, true, now);
  assert.match(first, /^Athan · .+…\nCurrent: Isha\nNext: Fajr · .+\nRemaining: 1h 2m$/); assert.ok(first.length <= 127);
  assert.match(trayToolTip(config, true, new Date(+at - 32000)), /Remaining: 32s$/);
  assert.match(trayToolTip(config, true, new Date(+at - 31000)), /Remaining: 31s$/);
  assert.match(trayToolTip(config, true, new Date(+at)), /Current: Fajr\nNext: Dhuhr ·/);
  assert.equal(trayToolTip(config, false, now), first);
});

test('next alert observes disabled prayers, independent reminders, weekdays and tomorrow', () => {
  const config = defaultConfig(), day = '2026-09-15', fajr = calculateDay(config, day).times.fajr;
  config.audio.prayers.fajr.enabled = false;
  config.reminders.push({ id: 'prepare', prayer: 'fajr', offsetMinutes: -10, file: null, repeat: 1, enabled: true });
  const now = new Date(+fajr - 900000), next = nextAlert(config, now);
  assert.equal(next.kind, 'reminder'); assert.equal(+next.at, +fajr - 600000);
  assert.match(trayToolTip(config, true, now), /Next: Fajr · .+\nRemaining: 15m/);
  config.reminders = [];
  const tomorrow = addDays(day, 1); config.scheduler.days = [parseDate(tomorrow).getUTCDay()];
  const weekly = nextAlert(config, now);
  assert.equal(weekly.prayerDate, tomorrow); assert.equal(weekly.prayer, 'dhuhr');
  for (const prayer of Object.values(config.audio.prayers)) prayer.enabled = false;
  assert.equal(nextAlert(config, now), null); assert.match(trayToolTip(config, true, now), /Next: Fajr · .+\nRemaining: 15m/);
});

test('countdown uses elapsed time across daylight saving and midnight', () => {
  const config = defaultConfig(), at = eventsForDay(config, '2026-10-04')[0].at;
  const now = new Date(+at - 4 * 3600000);
  assert.equal(timeRemaining(at, now), '4h 0m');
  assert.equal(+nextAlert(config, now).at, +at);
  assert.ok(dateAt(now, 'Australia/Melbourne') <= '2026-10-04');
  assert.equal(timeRemaining(new Date(+now - 1), now), '0s');
  assert.equal(timeRemaining(new Date(+now + 90060000), now), '1d 1h 1m');
});

test('tray translates labels and countdowns while retaining all four lines', () => {
  const config = defaultConfig(), at = eventsForDay(config, '2026-09-15')[0].at;
  for (const locale of ['ar', 'ur', 'tr', 'id', 'fr']) {
    config.locale = locale;
    config.locations[0].name = 'A long saved location name '.repeat(6);
    const text = trayToolTip(config, true, new Date(+at - 3720000));
    assert.equal(text.split('\n').length, 4);
    assert.ok(text.length <= 127, `${locale}: ${text.length}`);
    assert.doesNotMatch(text, /Current:|Next:|Remaining:/);
  }
});
