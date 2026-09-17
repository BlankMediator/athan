import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PolarCircleResolution, PrayerTimes, Qibla } from 'adhan';
import { activeLocation, TIMES, PRAYERS, type Config, type PrayerTime } from './config-model.js';
import { addDays, dateAt, parseDate } from './dates.js';
import { toHijri } from './calendar.js';

export interface DailyTimes {
  date: string; locationId: string; timeZone: string;
  times: Record<PrayerTime, Date | null>; sunset: Date | null;
  middleOfNight: Date | null; lastThirdOfNight: Date | null;
  ishraq: Date | null; duhaEnd: Date | null;
  hijri: ReturnType<typeof toHijri>; qibla: number; warnings: string[];
}
function raw(config: Config, date: string): PrayerTimes {
  const location = activeLocation(config), c = config.calculation;
  const params = CalculationMethod[c.method]();
  params.madhab = Madhab[c.madhab];
  params.highLatitudeRule = HighLatitudeRule[c.highLatitudeRule];
  params.polarCircleResolution = PolarCircleResolution[c.polarResolution];
  if (c.fajrAngle !== undefined) params.fajrAngle = c.fajrAngle;
  if (c.ishaAngle !== undefined) { params.ishaAngle = c.ishaAngle; params.ishaInterval = 0; }
  if (c.ishaInterval !== undefined) params.ishaInterval = c.ishaInterval;
  if (c.maghribAngle !== undefined) params.maghribAngle = c.maghribAngle;
  params.methodAdjustments.dhuhr = c.dhuhrAfterNoon;
  params.methodAdjustments.maghrib = c.maghribAfterSunset;
  params.adjustments = { ...c.adjustments };
  if (c.method === 'UmmAlQura' && params.ishaInterval > 0 && toHijri(date, config.hijriAdjustment).month === 9)
    params.ishaInterval += c.ramadanIshaExtra;
  // Adhan reads the host's calendar fields then returns UTC instants. Construct those fields explicitly.
  const compute = (solarDate: string) => {
    const d = parseDate(solarDate);
    return new PrayerTimes(new Coordinates(location.latitude, location.longitude),
      new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12), params);
  };
  let result = compute(date);
  // Civil time zones can cross the solar date line (e.g. Samoa and Kiritimati).
  if (Number.isFinite(+result.dhuhr)) {
    const actual = dateAt(result.dhuhr, location.timeZone);
    const shift = Math.round((+parseDate(date) - +parseDate(actual)) / 86_400_000);
    if (shift) result = compute(addDays(date, shift));
  }
  return result;
}
const valid = (date: Date): Date | null => Number.isFinite(+date) ? date : null;
export function calculateDay(config: Config, date: string): DailyTimes {
  const location = activeLocation(config), today = raw(config, date), tomorrow = raw(config, addDays(date, 1));
  const times = Object.fromEntries(TIMES.map(p => [p, valid(today[p])])) as DailyTimes['times'];
  const warnings: string[] = [];
  for (const p of TIMES) if (!times[p]) warnings.push(`${p} cannot be calculated; select a polar resolution if appropriate.`);
  if (config.calculation.polarResolution !== 'Unresolved') warnings.push(`Polar fallback enabled: ${config.calculation.polarResolution}; affected times may be estimates.`);
  const start = valid(today.maghrib), end = valid(tomorrow.fajr);
  const night = start && end && +end > +start ? +end - +start : null;
  const ordered = TIMES.map(p => times[p]).filter((t): t is Date => t !== null);
  // Derive the morning window from astronomical sunrise/transit, not user prayer corrections.
  const solarNoon = times.dhuhr ? new Date(+times.dhuhr - (config.calculation.dhuhrAfterNoon + config.calculation.adjustments.dhuhr) * 60000) : null;
  const sunrise = times.sunrise ? new Date(+times.sunrise - config.calculation.adjustments.sunrise * 60000) : null;
  const ishraq = sunrise ? new Date(+sunrise + config.calculation.ishraqAfterSunrise * 60000) : null;
  const duhaEnd = solarNoon ? new Date(+solarNoon - config.calculation.duhaBeforeNoon * 60000) : null;
  const morningValid = ishraq && duhaEnd && +ishraq < +duhaEnd;
  if (ordered.some((t, i) => i > 0 && +t <= +ordered[i - 1]!)) warnings.push('Prayer times overlap or are out of order. Review adjustments and high-latitude settings.');
  return { date, locationId: location.id, timeZone: location.timeZone, times, sunset: valid(today.sunset),
    ishraq: morningValid ? ishraq : null, duhaEnd: morningValid ? duhaEnd : null,
    middleOfNight: night === null ? null : new Date(+start! + night / 2),
    lastThirdOfNight: night === null ? null : new Date(+start! + night * 2 / 3),
    hijri: toHijri(date, config.hijriAdjustment), qibla: Qibla(new Coordinates(location.latitude, location.longitude)), warnings };
}
export function nextPrayer(config: Config, now = new Date()) {
  const date = dateAt(now, activeLocation(config).timeZone);
  const candidates = [-1, 0, 1, 2].flatMap(offset => {
    const day = calculateDay(config, addDays(date, offset));
    return PRAYERS.flatMap(prayer => day.times[prayer] ? [{ prayer, at: day.times[prayer]!, date: day.date }] : []);
  }).filter(p => p.at > now).sort((a, b) => +a.at - +b.at);
  const next = candidates[0];
  return next ? { ...next, secondsRemaining: Math.ceil((+next.at - +now) / 1000) } : null;
}
