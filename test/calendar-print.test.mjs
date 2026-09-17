import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarPrintHtml, pdfPeriod } from '../dist/calendar-print.js';
import { eventsBetween, fromHijri, toHijri } from '../dist/calendar.js';
import { addDays, dateRange } from '../dist/dates.js';
import { activeLocation, defaultConfig } from '../dist/config.js';
import { calculateDay } from '../dist/prayers.js';

test('event ranges span Hijri years, remain ordered and respect the saved correction', () => {
  const events = eventsBetween('2027-01-01', '2027-12-31');
  assert.ok(new Set(events.map(e => e.hijriYear)).size > 1);
  assert.deepEqual(events.map(e => e.date), events.map(e => e.date).sort());
  assert.ok(events.every(e => e.estimated && e.date.startsWith('2027-')));
  const ramadan = events.find(e => e.name === 'Ramadan begins');
  assert.equal(ramadan.date, '2027-02-08');
  assert.equal(eventsBetween('2027-01-01', '2027-12-31', 1).find(e => e.name === ramadan.name).date, addDays(ramadan.date, -1));
  assert.throws(() => eventsBetween('2027-02-01', '2027-01-01'));
});

test('Ramadan export includes exactly one full Hijri month, including corrected dates', () => {
  for (const year of [1447, 1448, 1449]) for (const correction of [-2, 0, 2]) {
    const p = pdfPeriod({ layout: 'ramadan', year }, correction);
    const days = [...dateRange(p.start, p.end)];
    assert.ok(days.length === 29 || days.length === 30);
    assert.equal(p.start, fromHijri(year, 9, 1, correction));
    assert.ok(days.every(d => toHijri(d, correction).month === 9));
    assert.equal(toHijri(addDays(p.end, 1), correction).month, 10);
  }
  assert.throws(() => pdfPeriod({ layout: 'month', year: 2027, month: 13 }));
  assert.throws(() => pdfPeriod({ layout: 'ramadan', year: 1000 }));
});

test('print layouts cover leap days and whole years without losing or duplicating dates', () => {
  const c = defaultConfig();
  for (const layout of ['year', 'year-timetables']) {
    const html = calendarPrintHtml(c, { layout, year: 2028 });
    const dates = [...html.matchAll(/data-date="([\d-]+)"/g)].map(m => m[1]);
    assert.equal(dates.length, 366); assert.equal(new Set(dates).size, 366);
    assert.ok(dates.includes('2028-02-29'));
    assert.equal((html.match(/<section class="sheet /g) ?? []).length, layout === 'year' ? 1 : 12);
    assert.match(html, /local moon sightings may differ/);
  }
});

test('PDF HTML escapes location text and uses saved local prayer calculations', () => {
  const c = defaultConfig(); c.hour12 = false; c.calculation.madhab = 'Hanafi';
  activeLocation(c).name = 'Test <script>alert(1)</script> & City';
  const html = calendarPrintHtml(c, { layout: 'month', year: 2026, month: 10 });
  assert.ok(!html.includes('<script>')); assert.match(html, /Test &lt;script&gt;/);
  assert.match(html, /Hanafi Asr/); assert.match(html, /Australia\/Melbourne/);
  assert.equal((html.match(/data-date=/g) ?? []).length, 31);
  const day = calculateDay(c, '2026-10-04');
  assert.ok(day.times.fajr);
  const local = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false }).format(day.times.fajr);
  assert.ok(html.includes(local));
});
