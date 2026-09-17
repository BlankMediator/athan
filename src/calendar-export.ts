import { activeLocation, TIMES, PRAYERS, type Config } from './config-model.js';
import { dateRange, formatTime } from './dates.js';
import { calculateDay } from './prayers.js';

export function calendarRows(config: Config, start: string, end: string) {
  return [...dateRange(start, end)].map(date => calculateDay(config, date));
}
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
export function calendarCsv(config: Config, start: string, end: string): string {
  const rows = [['date', 'hijri', 'timeZone', ...TIMES, 'ishraq', 'duhaEnd', 'warnings']];
  for (const day of calendarRows(config, start, end)) rows.push([day.date,
    `${day.hijri.year}-${day.hijri.month}-${day.hijri.day}`, day.timeZone,
    ...TIMES.map(p => formatTime(day.times[p], day.timeZone, false)), formatTime(day.ishraq, day.timeZone, false), formatTime(day.duhaEnd, day.timeZone, false), day.warnings.join('; ')]);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
function escapeIcs(value: string): string { return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function fold(line: string): string {
  let part = '', output = '';
  for (const char of line) {
    if (new TextEncoder().encode(part + char).length > 73) { output += part + '\r\n'; part = ' '; }
    part += char;
  }
  return output + part;
}
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
export function renderCalendarIcs(config: Config, start: string, end: string, hash: (key: string) => string, generated = new Date()): string {
  const location = activeLocation(config);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Athan Core//Prayer Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const day of calendarRows(config, start, end)) for (const prayer of PRAYERS) {
    const at = day.times[prayer]; if (!at) continue;
    const uid = hash(`${location.id}:${location.latitude}:${location.longitude}:${day.date}:${prayer}`);
    lines.push('BEGIN:VEVENT', `UID:${uid}@athan.local`, `DTSTAMP:${stamp(generated)}`,
      `DTSTART:${stamp(at)}`, `DTEND:${stamp(new Date(+at + 60000))}`,
      `SUMMARY:${prayer[0]!.toUpperCase() + prayer.slice(1)}`, `LOCATION:${escapeIcs(location.name)}`,
      'TRANSP:TRANSPARENT', `DESCRIPTION:${escapeIcs(`${config.calculation.method}; ${config.calculation.madhab}. Prayer start time. ${day.warnings.join(' ')}`)}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
