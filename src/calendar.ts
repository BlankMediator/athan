import { addDays, parseDate } from './dates.js';

export interface HijriDate { year: number; month: number; day: number; calendar: 'islamic-umalqura'; }
export const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah'] as const;
export function hijriText(date: HijriDate) { return `${date.day} ${HIJRI_MONTHS[date.month - 1]} ${date.year} AH`; }
const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
});
export function toHijri(gregorian: string, adjustment = 0): HijriDate {
  if (!Number.isInteger(adjustment) || Math.abs(adjustment) > 2) throw new Error('Hijri adjustment must be -2 to 2 days');
  const parts = formatter.formatToParts(parseDate(addDays(gregorian, adjustment)));
  const get = (name: string) => Number(parts.find(p => p.type === name)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), calendar: 'islamic-umalqura' };
}
export function fromHijri(year: number, month: number, day: number, adjustment = 0): string {
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1 || day > 30)
    throw new Error('Invalid Hijri date');
  let low = +parseDate('1900-01-03'), high = +parseDate('2099-12-29');
  const key = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
  const target = key(year, month, day);
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 86_400_000 / 2) * 86_400_000;
    const date = new Date(middle).toISOString().slice(0, 10);
    const h = toHijri(date, adjustment), value = key(h.year, h.month, h.day);
    if (value === target) return date;
    if (value < target) low = middle + 86_400_000; else high = middle - 86_400_000;
  }
  throw new Error('Hijri date does not exist or is outside supported Gregorian range 1900–2099');
}

export const ISLAMIC_DAYS = [
  { name: 'Islamic New Year', month: 1, day: 1 }, { name: 'Ashura', month: 1, day: 10 },
  { name: 'Mawlid (observed in some traditions)', month: 3, day: 12 },
  { name: 'Isra and Miraj (traditional date)', month: 7, day: 27 },
  { name: 'Ramadan begins', month: 9, day: 1 },
  { name: 'Last ten nights of Ramadan begin', month: 9, day: 21 },
  { name: 'Laylat al-Qadr (commonly observed 27th; exact night unknown)', month: 9, day: 27 },
  { name: 'Eid al-Fitr', month: 10, day: 1 }, { name: 'Hajj begins', month: 12, day: 8 },
  { name: 'Day of Arafah', month: 12, day: 9 }, { name: 'Eid al-Adha', month: 12, day: 10 },
] as const;
export function islamicDays(hijriYear: number, adjustment = 0) {
  return ISLAMIC_DAYS.map(event => ({ ...event, hijriYear,
    date: fromHijri(hijriYear, event.month, event.day, adjustment), estimated: true }));
}
export type CalendarEvent = ReturnType<typeof islamicDays>[number];
export function eventsBetween(start: string, end: string, adjustment = 0): CalendarEvent[] {
  if (parseDate(end) < parseDate(start)) throw new Error('Choose an ordered date range');
  const first = toHijri(start, adjustment).year, last = toHijri(end, adjustment).year;
  if (last - first > 2) throw new Error('Choose a calendar range of up to two years');
  return Array.from({ length: last - first + 1 }, (_, n) => islamicDays(first + n, adjustment)).flat()
    .filter(event => event.date >= start && event.date <= end).sort((a, b) => a.date.localeCompare(b.date));
}
