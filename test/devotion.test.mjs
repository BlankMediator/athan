import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devotionLibrary, dailyReading, dueDailyReminders } from '../dist/devotion.js';
import { deliverDailyReadings } from '../dist/desktop/daily-readings.js';
import { prefsSchema, prefsPatch } from '../dist/desktop/preferences.js';
import { nearestCity } from '../dist/device-location.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readingNotification } from '../dist/devotion-content.js';

test('daily notification uses the complete published narration and its reference', () => {
  const reading = { kind: 'hadith', item: devotionLibrary().hadiths[0] };
  for (const language of ['en', 'ar', 'ur', 'tr', 'id', 'fr']) {
    const notification = readingNotification(reading, language);
    const text = ['ar', 'ur'].includes(language) ? reading.item.arabic : reading.item.meaning;
    assert.equal(notification.body, `${text}\n${reading.item.reference}`);
    if (language !== 'en') assert.doesNotMatch(notification.title, /Daily hadith/);
  }
});

test('the offline library has stable unique entries, Arabic, references and sourced hadith meanings', () => {
  const { duas, hadiths } = devotionLibrary();
  assert.equal(duas.length, 268); assert.equal(hadiths.length, 12);
  assert.equal(new Set([...duas, ...hadiths].map(d => d.id)).size, 280);
  for (const dua of duas) {
    assert.match(dua.arabic, /[\u0600-\u06ff]/); assert.ok(dua.title && dua.meaning && dua.reference);
    assert.doesNotMatch(Object.values(dua).join(' '), /<\/?(?:script|a|p|div|b)[\s>]/i);
  }
  const sources=JSON.parse(readFileSync(new URL('../assets/devotion/hadith-sources.json',import.meta.url),'utf8'));
  for (const hadith of hadiths) {
    assert.match(hadith.url, /^https:\/\/sunnah\.com\/(?:bukhari|muslim):[\da-z]+$/);
    assert.equal(hadith.wording,'source-verbatim');assert.match(hadith.arabic,/[\u0600-\u06ff]/);
    const source=sources.entries.find(row=>row.id===hadith.id);
    assert.equal(createHash('sha256').update(hadith.arabic).digest('hex'),source.arabicSha256);
    assert.equal(createHash('sha256').update(hadith.meaning).digest('hex'),source.englishSha256);
  }
  assert.equal(new Set(duas.map(d => d.chapter)).size, 132);
  for (const dua of duas) assert.equal(dua.url, `https://sunnah.com/hisn:${dua.number}`);
  for (const date of ['1901-01-01', '2026-09-16', '2098-12-31']) {
    assert.ok(dailyReading('dua', date).item.id.startsWith('hisn-'));
    assert.ok([129, 130].includes(dailyReading('dua', date).item.chapter));
    assert.ok(dailyReading('hadith', date).item.reference);
    assert.deepEqual(dailyReading('dua', date), dailyReading('dua', date));
  }
});
test('new readings are off and unrelated preference patches preserve times, toggles and favorites', () => {
  const defaults = prefsSchema.parse({ theme: 'system', resumeAlerts: true });
  assert.deepEqual(defaults.dailyHadith, { enabled: false, time: '09:00' });
  assert.deepEqual(defaults.dailyDua, { enabled: false, time: '20:00' });
  const old = { ...defaults, dailyHadith: { enabled: true, time: '13:15' }, favoriteDuas: ['daily-dua-1'] };
  assert.deepEqual(prefsSchema.parse({ ...old, ...prefsPatch.parse({ theme: 'dark' }) }), { ...old, theme: 'dark' });
  assert.throws(() => prefsPatch.parse({ dailyDua: { enabled: true, time: '24:00' } }));
});
test('daily reminders use local time, persist once per day and never create a ledger while off', () => {
  const root = mkdtempSync(join(tmpdir(), 'athan-readings-')), path = join(root, 'readings.sqlite'), delivered = [];
  try {
    const prefs = prefsSchema.parse({});
    deliverDailyReadings(path, prefs, new Date('2026-09-16T13:00Z'), 'Australia/Melbourne', r => delivered.push(r));
    assert.equal(existsSync(path), false);
    prefs.dailyHadith = { enabled: true, time: '09:00' }; prefs.dailyDua = { enabled: true, time: '20:00' };
    const run = time => deliverDailyReadings(path, prefs, new Date(time), 'Australia/Melbourne', r => delivered.push(r));
    run('2026-09-15T22:59Z'); assert.equal(delivered.length, 0);
    run('2026-09-15T23:00Z'); assert.equal(delivered.length, 1); assert.equal(delivered[0].date, '2026-09-16');
    run('2026-09-16T09:59Z'); assert.equal(delivered.length, 1);
    run('2026-09-16T10:00Z'); assert.equal(delivered.length, 2);
    run('2026-09-16T12:00Z'); run('2026-09-16T10:00Z'); assert.equal(delivered.length, 2);
    run('2026-09-18T11:00Z'); assert.equal(delivered.length, 4); assert.ok(delivered.slice(2).every(r => r.date === '2026-09-18'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('daylight saving gaps catch up once and repeated hours do not repeat a reading', () => {
  const root = mkdtempSync(join(tmpdir(), 'athan-dst-')), path = join(root, 'readings.sqlite'), delivered = [];
  const prefs = prefsSchema.parse({ dailyDua: { enabled: true, time: '02:30' } });
  const run = time => deliverDailyReadings(path, prefs, new Date(time), 'Australia/Melbourne', r => delivered.push(r));
  try {
    run('2026-04-04T15:30Z'); run('2026-04-04T16:30Z'); assert.equal(delivered.length, 1);
    run('2026-10-03T15:59Z'); assert.equal(delivered.length, 1);
    run('2026-10-03T16:00Z'); run('2026-10-03T16:15Z'); assert.equal(delivered.length, 2);
    assert.deepEqual(dueDailyReminders(prefs, new Date('2026-09-16T00:00Z'), 'America/New_York'), ['dua']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('device location retains measured coordinates and suggests a nearby city time zone worldwide', async () => {
  for (const [lat, lon, zone, country] of [[-37.7352, 144.9693, 'Australia/Melbourne', 'Australia'], [52.52, 13.405, 'Europe/Berlin', 'Germany'], [40.7128, -74.006, 'America/New_York', 'United States']]) {
    const { location, distanceKm } = await nearestCity(lat, lon);
    assert.equal(location.latitude, lat); assert.equal(location.longitude, lon);
    assert.equal(location.timeZone, zone); assert.equal(location.country, country); assert.ok(distanceKm < 10);
  }
  await assert.rejects(nearestCity(NaN, 0), /Invalid device coordinates/);
});
