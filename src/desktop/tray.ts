import { activeLocation, PRAYERS, type Config, type Prayer } from '../config.js';
import { addDays, dateAt, formatTime } from '../dates.js';
import { calculateDay, nextPrayer } from '../prayers.js';
import { eventsForDay, type ScheduledEvent } from '../scheduler.js';
import { translate, translateMessage } from '../localization.js';

export function nextAlert(config: Config, now: Date): ScheduledEvent | null {
  if (!config.scheduler.days.length || (!Object.values(config.audio.prayers).some(p => p.enabled) && !config.reminders.some(r => r.enabled))) return null;
  const today = dateAt(now, activeLocation(config).timeZone);
  // Include neighbouring parent prayer dates for midnight-crossing reminders, and a full weekly cycle.
  const events = Array.from({ length: 11 }, (_, n) => eventsForDay(config, addDays(today, n - 2))).flat();
  return events.filter(event => event.at > now).sort((a, b) => +a.at - +b.at || Number(a.kind === 'reminder') - Number(b.kind === 'reminder'))[0] ?? null;
}

export function timeRemaining(at: Date, now: Date, locale = 'en'): string {
  const seconds = Math.max(0, Math.ceil((+at - +now) / 1000));
  const unit = (value: number, name: string) => `${value}${translate(name, locale)}`;
  if (seconds < 60) return unit(seconds, 's');
  const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  return days ? `${unit(days, 'd')} ${unit(hours % 24, 'h')} ${unit(minutes % 60, 'm')}` : hours ? `${unit(hours, 'h')} ${unit(minutes % 60, 'm')}` : unit(minutes, 'm');
}

let cached: { key: string; from: number; until: number; prayer: ReturnType<typeof nextPrayer>; current: Prayer | null } | undefined;

export function trayToolTip(config: Config, _alertsOn: boolean, now = new Date()): string {
  const location = activeLocation(config), key = JSON.stringify(config);
  // Reformat the countdown every second without recalculating astronomy every second.
  if (!cached || cached.key !== key || +now < cached.from || +now >= cached.until) {
    const prayer = nextPrayer(config, now), today = dateAt(now, location.timeZone);
    const started = [-1, 0].flatMap(offset => {
      const day = calculateDay(config, addDays(today, offset));
      return PRAYERS.flatMap(name => day.times[name] && day.times[name]! <= now ? [{ prayer: name, at: day.times[name]! }] : []);
    }).sort((a, b) => +b.at - +a.at);
    cached = { key, from: +now, until: Math.min(+now + 60000, prayer ? +prayer.at : Infinity), prayer, current: started[0]?.prayer ?? null };
  }
  const next = cached.prayer;
  const t = (value: string) => translateMessage(value, config.locale);
  let upcoming = t('Next prayer unavailable');
  if (next) {
    const today = dateAt(now, location.timeZone), day = dateAt(next.at, location.timeZone);
    const suffix = day === today ? '' : day === addDays(today, 1) ? ` (${t('tomorrow')})` : ` (${day})`;
    const name = next.prayer[0]!.toUpperCase() + next.prayer.slice(1);
    upcoming = `${t('Next:')} ${t(name)} · ${formatTime(next.at, location.timeZone, config.hour12, config.locale)}${suffix}`;
  }
  const current = cached.current ? cached.current[0]!.toUpperCase() + cached.current.slice(1) : 'Unavailable';
  const body = [`${t('Current:')} ${t(current)}`, upcoming, `${t('Remaining:')} ${next ? timeRemaining(next.at, now, config.locale) : t('Unavailable')}`].join('\n');
  const fullPlace = location.name.replace(/[\r\n]/g, ' '), available = Math.max(0, 127 - body.length - 9);
  const place = fullPlace.length > available ? fullPlace.slice(0, Math.max(0, available - 1)) + '…' : fullPlace;
  return `Athan${place ? ` · ${place}` : ''}\n${body}`;
}
