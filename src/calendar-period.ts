import { z } from 'zod';
import { addDays, parseDate } from './dates.js';
import { fromHijri, HIJRI_MONTHS, toHijri } from './calendar.js';
export const calendarKind = z.enum(['gregorian', 'hijri']);
export const monthSelection = z.strictObject({ calendar: calendarKind, year: z.number().int().min(1).max(9999), month: z.number().int().min(1).max(12) });
export type CalendarKind = z.infer<typeof calendarKind>;
export type CalendarMonth = z.infer<typeof monthSelection>;
export type CalendarMonthInput = CalendarMonth | string;
export function monthForDate(date: string, calendar: CalendarKind, adjustment = 0): CalendarMonth {
  parseDate(date);
  const h = toHijri(date, adjustment);
  return { calendar, year: calendar === 'hijri' ? h.year : +date.slice(0, 4), month: calendar === 'hijri' ? h.month : +date.slice(5, 7) };
}
export function nextMonth(input: CalendarMonth, delta: number): CalendarMonth {
  const n = input.year * 12 + input.month - 1 + delta;
  return { calendar: input.calendar, year: Math.floor(n / 12), month: ((n % 12) + 12) % 12 + 1 };
}
export function calendarPeriod(input: CalendarMonthInput, adjustment = 0) {
  const selection = monthSelection.parse(typeof input === 'string' && /^\d{4}-\d{2}$/.test(input) ? { calendar: 'gregorian', year: +input.slice(0, 4), month: +input.slice(5) } : input);
  const following = nextMonth(selection, 1);
  const start = selection.calendar === 'hijri' ? fromHijri(selection.year, selection.month, 1, adjustment) : `${selection.year}-${String(selection.month).padStart(2, '0')}-01`;
  const end = selection.calendar === 'hijri' ? addDays(fromHijri(following.year, following.month, 1, adjustment), -1) : new Date(Date.UTC(selection.year, selection.month, 0, 12)).toISOString().slice(0, 10);
  if (start < '1901-01-01' || end > '2098-12-31') throw new Error('Choose a complete month within Gregorian years 1901–2098');
  parseDate(start); parseDate(end);
  const title = selection.calendar === 'hijri' ? `${HIJRI_MONTHS[selection.month - 1]} ${selection.year} AH` : new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(parseDate(start));
  return { ...selection, start, end, title };
}
