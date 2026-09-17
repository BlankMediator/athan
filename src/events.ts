import { activeLocation, PRAYERS, type Config, type Prayer } from './config-model.js';
import { addDays, dateAt, parseDate } from './dates.js';
import { calculateDay } from './prayers.js';

export interface ScheduledEvent {
  id: string; kind: 'athan' | 'reminder'; prayer: Prayer; prayerDate: string;
  at: Date; files: string[]; repeat: number; location: string;
}
export function eventsForDay(config: Config, date: string): ScheduledEvent[] {
  const day = calculateDay(config, date), location = activeLocation(config);
  // Weekday refers to the parent prayer day, even when a reminder crosses midnight.
  if (!config.scheduler.days.includes(parseDate(date).getUTCDay())) return [];
  const events: ScheduledEvent[] = [];
  for (const prayer of PRAYERS) {
    const at = day.times[prayer], audio = config.audio.prayers[prayer];
    if (!at) continue;
    if (audio.enabled) events.push({ id: `${location.id}:${date}:${prayer}:athan`, kind: 'athan', prayer, prayerDate: date,
      at, files: [audio.file, config.audio.duaFile].filter((f): f is string => f !== null), repeat: 1, location: location.name });
    for (const reminder of config.reminders.filter(r => r.prayer === prayer && r.enabled)) {
      events.push({ id: `${location.id}:${date}:${prayer}:reminder:${reminder.id}`, kind: 'reminder', prayer, prayerDate: date,
        at: new Date(+at + reminder.offsetMinutes * 60000), files: reminder.file ? [reminder.file] : [],
        repeat: reminder.repeat, location: location.name });
    }
  }
  return events.sort((a, b) => +a.at - +b.at || (a.kind === 'athan' ? -1 : 1));
}
export function eventsAround(config: Config, now: Date): ScheduledEvent[] {
  const day = dateAt(now, activeLocation(config).timeZone);
  return [-2, -1, 0, 1, 2].flatMap(n => eventsForDay(config, addDays(day, n))).sort((a, b) => +a.at - +b.at);
}
