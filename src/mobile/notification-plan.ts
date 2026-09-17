import { activeLocation, type Config } from '../config-model.js';
import { addDays, dateAt } from '../dates.js';
import { eventsForDay } from '../events.js';
import type { Preferences } from '../desktop/types.js';
import type { ReadingTarget } from '../devotion-content.js';

export interface MobileAlert {
  id: number;
  key: string;
  at: Date;
  title: string;
  body: string;
  kind: 'prayer' | 'reading' | 'refresh';
  reading?: ReadingTarget;
}
export const MOBILE_QUEUE_LIMIT = 60; // Leave room below iOS's pending-notification ceiling.
export const MOBILE_HORIZON_DAYS = 7;

/** Convert a wall clock in the saved location to an instant, choosing the first DST fold.
 * A nonexistent spring-forward minute moves forward by the size of the DST gap.
 */
export function localReminderTime(date: string, time: string, zone: string): Date {
  const wall = Date.parse(`${date}T${time}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const represented = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (name: string) => parts.find(p => p.type === name)!.value;
    return Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
  };
  const offsets = new Set([-36, -12, 0, 12, 36].map(hours => { const instant = wall + hours * 3600000; return represented(instant) - instant; }));
  const candidates = [...offsets].map(offset => wall - offset).sort((a, b) => a - b);
  const exact = candidates.find(instant => represented(instant) === wall);
  const next = candidates.filter(instant => represented(instant) > wall).sort((a, b) => represented(a) - represented(b))[0];
  return new Date(exact ?? next ?? candidates[0]!);
}

export function mobileNotificationPlan(config: Config, preferences: Preferences, enabled: boolean, now: Date,
  reading: (kind: 'dua' | 'hadith', date: string) => { title: string; body: string; target: ReadingTarget },
): MobileAlert[] {
  if (!preferences.notifications) return [];
  const location = activeLocation(config), today = dateAt(now, location.timeZone);
  const end = localReminderTime(addDays(today, MOBILE_HORIZON_DAYS), '00:00', location.timeZone);
  const alerts: Omit<MobileAlert, 'id'>[] = [];
  // Include adjacent prayer dates because reminder offsets may cross midnight.
  if (enabled) for (let day = -2; day <= MOBILE_HORIZON_DAYS + 2; day++) {
    for (const event of eventsForDay(config, addDays(today, day))) {
      if (event.at <= now || event.at >= end) continue;
      alerts.push({ key: event.id, at: event.at, title: `${event.prayer[0]!.toUpperCase()}${event.prayer.slice(1)} ${event.kind === 'reminder' ? 'reminder' : 'prayer'}`, body: `${event.location} · A moment for prayer.`, kind: 'prayer' });
    }
  }
  for (let day = 0; day < MOBILE_HORIZON_DAYS; day++) for (const kind of ['hadith', 'dua'] as const) {
    const preference = preferences[kind === 'hadith' ? 'dailyHadith' : 'dailyDua'];
    if (!preference.enabled) continue;
    const date = addDays(today, day), at = localReminderTime(date, preference.time, location.timeZone);
    if (at <= now) continue;
    const item = reading(kind, date);
    alerts.push({ key: `daily:${kind}:${date}`, at, title: item.title, body: item.body, kind: 'reading', reading: item.target });
  }
  alerts.sort((a, b) => +a.at - +b.at || a.key.localeCompare(b.key));
  if (!alerts.length) return [];
  let selected = alerts.slice(0, MOBILE_QUEUE_LIMIT - 1);
  // Do not split a group of simultaneous reminders at the capacity boundary.
  if (alerts.length > selected.length) {
    const excludedTime = +alerts[selected.length]!.at;
    selected = selected.filter(alert => +alert.at < excludedTime);
  }
  const expires = selected.at(-1)?.at ?? new Date(+now + 60000);
  selected.push({ key: 'athan:refresh', at: new Date(+expires + 1000), title: 'Refresh your prayer reminders', body: 'Open Athan to schedule the next days of alerts.', kind: 'refresh' });
  return selected.map((alert, index) => ({ ...alert, id: 41000 + index }));
}
