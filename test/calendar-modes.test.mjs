import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarPeriod, monthForDate, nextMonth } from '../dist/calendar-period.js';
import { calendarPrintHtml, pdfPeriod } from '../dist/calendar-print.js';
import { toHijri } from '../dist/calendar.js';
import { dateRange } from '../dist/dates.js';
import { defaultConfig } from '../dist/config.js';
import { calculateDay } from '../dist/prayers.js';
import { eventsForDay } from '../dist/scheduler.js';
test('Hijri month navigation preserves exact periods, corrections, and year rollover', () => {
  for (const adjustment of [-2,0,2]) for (const month of [1,9,12]) {
    const input={calendar:'hijri',year:1448,month}, range=calendarPeriod(input,adjustment);
    const dates=[...dateRange(range.start,range.end)]; assert.ok([29,30].includes(dates.length));
    for(const date of dates) assert.deepEqual(monthForDate(date,'hijri',adjustment), input);
    assert.equal(toHijri(range.start,adjustment).day,1);
    assert.deepEqual(pdfPeriod({layout:'month',...input},adjustment).start,range.start);
  }
  assert.deepEqual(nextMonth({calendar:'hijri',year:1448,month:12},1),{calendar:'hijri',year:1449,month:1});
  assert.throws(()=>calendarPeriod({calendar:'hijri',year:1000,month:1}));
  assert.equal(calendarPeriod('2028-02').end,'2028-02-29');
});
test('both Hijri year PDFs cover twelve lunar months once, with Hijri primary numerals',()=>{
  const config=defaultConfig();
  for(const layout of ['year','year-timetables']) {
    const html=calendarPrintHtml(config,{layout,calendar:'hijri',year:1448});
    const dates=[...html.matchAll(/data-date="([\d-]+)"/g)].map(m=>m[1]);
    assert.ok([354,355].includes(dates.length)); assert.equal(new Set(dates).size,dates.length);
    assert.ok(dates.every(d=>toHijri(d).year===1448)); assert.match(html,/1448 AH/);
    if(layout==='year') assert.match(html,/Large numerals: Hijri/);
    else { assert.match(html,/<th>Hijri<\/th><th>Gregorian/); assert.match(html,/Duha ends/); }
  }
});
test('Duha margins follow astronomical sunrise/noon, do not schedule extra Athans, and handle polar nulls',()=>{
  const config=defaultConfig(), day=calculateDay(config,'2026-10-04');
  assert.equal(+day.ishraq-+day.times.sunrise,20*60000);
  assert.equal(+day.times.dhuhr-+day.duhaEnd,(10+config.calculation.dhuhrAfterNoon)*60000);
  config.calculation.adjustments.sunrise=30;config.calculation.adjustments.dhuhr=15;
  const adjusted=calculateDay(config,'2026-10-04');
  assert.equal(+adjusted.ishraq,+day.ishraq);assert.equal(+adjusted.duhaEnd,+day.duhaEnd);
  assert.equal(eventsForDay(config,'2026-10-04').filter(e=>e.kind==='athan').length,5);
  config.locations[0].latitude=78.2;config.locations[0].longitude=15.6;config.locations[0].timeZone='Arctic/Longyearbyen';
  const polar=calculateDay(config,'2026-06-21');assert.equal(polar.ishraq,null);assert.equal(polar.duhaEnd,null);
});
