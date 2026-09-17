import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../dist/config-model.js';
import { prefsSchema } from '../dist/desktop/preferences.js';
import { mobileNotificationPlan, localReminderTime, MOBILE_QUEUE_LIMIT } from '../dist/mobile/notification-plan.js';
import { eventsForDay } from '../dist/events.js';

const reading = (kind, date) => ({ title: kind, body: date, target: { kind, id: date } });
const prefs = () => prefsSchema.parse({ notifications: true });
const now = new Date('2026-09-16T20:00:00Z');
test('mobile reminders use the shared prayer instants and respect pause and permission preferences', () => {
  const config = defaultConfig(), p = prefs();
  const plan = mobileNotificationPlan(config, p, true, now, reading);
  assert.ok(plan.length > 20 && plan.length <= MOBILE_QUEUE_LIMIT);
  const expected = eventsForDay(config, '2026-09-17').filter(event => event.at > now);
  for (const event of expected) assert.equal(+plan.find(item => item.key === event.id).at, +event.at);
  assert.equal(new Set(plan.map(n => n.id)).size, plan.length);
  assert.ok(plan.every(n => n.at > now));
  assert.equal(plan.at(-1).kind, 'refresh');
  assert.deepEqual(mobileNotificationPlan(config, p, false, now, reading), []);
  assert.deepEqual(mobileNotificationPlan(config, { ...p, notifications: false }, true, now, reading), []);
});
test('daily readings remain scheduled when prayer alerts are paused', () => {
  const p = { ...prefs(), dailyDua: { enabled: true, time: '18:30' } };
  const plan = mobileNotificationPlan(defaultConfig(), p, false, now, reading);
  assert.equal(plan.filter(n => n.kind === 'reading').length, 7);
  assert.ok(plan.filter(n => n.kind === 'reading').every(n => n.reading.kind === 'dua'));
  assert.equal(plan.filter(n => n.kind === 'prayer').length, 0);
});
test('dense schedules respect capacity without splitting simultaneous reminders', () => {
  const config = defaultConfig();
  config.reminders = Array.from({ length: 25 }, (_, i) => ({ id: `test-${i}`, label: 'Reminder', prayer: 'dhuhr', offsetMinutes: 0, enabled: true, repeat: 1, file: null }));
  const plan = mobileNotificationPlan(config, prefs(), true, now, reading);
  assert.ok(plan.length <= MOBILE_QUEUE_LIMIT);
  const last = plan.filter(n => n.kind === 'prayer').at(-1);
  const allAtLastTime = eventsForDay(config, last.key.split(':')[1]).filter(e => +e.at === +last.at);
  assert.equal(plan.filter(e => +e.at === +last.at).length, allAtLastTime.length);
});
test('disabled weekdays and prayer switches are preserved', () => {
  const config = defaultConfig(); config.scheduler.days = [];
  assert.deepEqual(mobileNotificationPlan(config, prefs(), true, now, reading), []);
  config.scheduler.days = [0, 1, 2, 3, 4, 5, 6]; config.audio.prayers.fajr.enabled = false;
  assert.ok(mobileNotificationPlan(config, prefs(), true, now, reading).every(n => !n.key.includes(':fajr:')));
});
test('saved-location time zones, half-hour zones, DST gaps and folds are explicit', () => {
  assert.equal(localReminderTime('2026-09-17', '08:00', 'Australia/Melbourne').toISOString(), '2026-09-16T22:00:00.000Z');
  assert.equal(localReminderTime('2026-09-17', '08:00', 'Asia/Kolkata').toISOString(), '2026-09-17T02:30:00.000Z');
  assert.equal(localReminderTime('2026-04-05', '02:30', 'Australia/Melbourne').toISOString(), '2026-04-04T15:30:00.000Z');
  assert.equal(localReminderTime('2026-10-04', '02:30', 'Australia/Melbourne').toISOString(), '2026-10-03T16:30:00.000Z');
});
