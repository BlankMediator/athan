export const DAY_MS = 86_400_000;
export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be YYYY-MM-DD');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100)
    throw new Error('Use a real Gregorian date between 1900 and 2100');
  return date;
}
export function addDays(date: string, count: number): string {
  return new Date(+parseDate(date) + count * DAY_MS).toISOString().slice(0, 10);
}
export function dateAt(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function formatTime(instant: Date | null, timeZone: string, hour12 = true, locale = 'en-AU'): string {
  return instant === null ? 'Unavailable' : new Intl.DateTimeFormat(locale,
    { timeZone, hour: '2-digit', minute: '2-digit', hour12 }).format(instant);
}
export function* dateRange(start: string, end: string): Generator<string> {
  const a = parseDate(start), b = parseDate(end);
  if (b < a || +b - +a > 366 * DAY_MS) throw new Error('Choose an ordered range of at most 367 days');
  for (let value = start; value <= end; value = addDays(value, 1)) yield value;
}
