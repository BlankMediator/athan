import { z } from 'zod';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export const TIMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type Prayer = typeof PRAYERS[number];
export type PrayerTime = typeof TIMES[number];
export const METHODS = ['MuslimWorldLeague', 'Karachi', 'NorthAmerica', 'UmmAlQura', 'Egyptian',
  'Dubai', 'MoonsightingCommittee', 'Kuwait', 'Qatar', 'Singapore', 'Tehran', 'Turkey', 'Other'] as const;

const finite = z.number().finite();
const minuteOffset = finite.int().min(-180).max(180);
const file = z.string().min(1).refine(p => !/[\x00-\x1f]/.test(p), 'Invalid file path');
const days = z.array(z.number().int().min(0).max(6)).max(7).default([0, 1, 2, 3, 4, 5, 6]);
const offsets = z.strictObject({
  fajr: minuteOffset.default(0), sunrise: minuteOffset.default(0), dhuhr: minuteOffset.default(0),
  asr: minuteOffset.default(0), maghrib: minuteOffset.default(0), isha: minuteOffset.default(0),
}).default({ fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
export const locationSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100),
  name: z.string().min(1).max(150), country: z.string().max(150).default(''),
  latitude: finite.min(-89.9).max(89.9), longitude: finite.min(-180).max(180),
  timeZone: z.string().refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
  }, 'Use a valid IANA time zone, e.g. Australia/Melbourne'),
});
export const calculationSchema = z.strictObject({
  method: z.enum(METHODS).default('MuslimWorldLeague'),
  madhab: z.enum(['Shafi', 'Hanafi']).default('Shafi'),
  highLatitudeRule: z.enum(['MiddleOfTheNight', 'SeventhOfTheNight', 'TwilightAngle']).default('TwilightAngle'),
  polarResolution: z.enum(['Unresolved', 'AqrabBalad', 'AqrabYaum']).default('Unresolved'),
  fajrAngle: finite.gt(0).max(30).optional(), ishaAngle: finite.gt(0).max(30).optional(),
  ishaInterval: finite.int().min(0).max(240).optional(),
  maghribAngle: finite.min(0).max(20).optional(),
  // Legacy Athan uses explicit minutes after transit/sunset, not hidden method offsets.
  dhuhrAfterNoon: finite.int().min(0).max(30).default(1),
  maghribAfterSunset: finite.int().min(0).max(30).default(1),
  adjustments: offsets,
  ramadanIshaExtra: finite.int().min(0).max(60).default(30),
  ishraqAfterSunrise: finite.int().min(10).max(60).default(20),
  duhaBeforeNoon: finite.int().min(5).max(30).default(10),
}).refine(c => c.method !== 'Other' || (c.fajrAngle !== undefined &&
  (c.ishaAngle !== undefined || (c.ishaInterval ?? 0) > 0)), 'Custom method needs Fajr and Isha angles (or an Isha interval)');
const prayerAudio = z.strictObject({ enabled: z.boolean().default(true), file: file.nullable().default(null) });
const audioSchema = z.strictObject({
  enabled: z.boolean().default(true), volume: finite.int().min(0).max(100).default(70),
  maxPlaybackSeconds: finite.int().min(1).max(3600).default(600),
  prayers: z.strictObject(Object.fromEntries(PRAYERS.map(p => [p, prayerAudio.default({ enabled: true, file: null })])) as Record<Prayer, z.ZodDefault<typeof prayerAudio>>),
  duaFile: file.nullable().default(null), startupFile: file.nullable().default(null),
  startupEnabled: z.boolean().default(false),
});
export const configSchema = z.strictObject({
  version: z.literal(1),
  locations: z.array(locationSchema).min(1), activeLocation: z.string(),
  calculation: calculationSchema,
  hijriAdjustment: finite.int().min(-2).max(2).default(0),
  hour12: z.boolean().default(true), locale: z.string().default('en-AU').refine(locale => {
    try { new Intl.DateTimeFormat(locale); return true; } catch { return false; }
  }, 'Invalid locale'),
  audio: audioSchema,
  reminders: z.array(z.strictObject({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/), prayer: z.enum(PRAYERS),
    offsetMinutes: minuteOffset, file: file.nullable().default(null),
    repeat: finite.int().min(1).max(20).default(1), enabled: z.boolean().default(true),
  })).default([]),
  scheduler: z.strictObject({
    graceSeconds: finite.int().min(0).max(600).default(90),
    pollSeconds: finite.int().min(1).max(30).default(5), days,
  }),
  network: z.strictObject({
    enabled: z.boolean().default(false), days,
    prayers: z.array(z.enum(PRAYERS)).default([...PRAYERS]),
    targets: z.array(z.strictObject({ host: z.string().min(1), port: finite.int().min(1024).max(65535) })).default([]),
  }),
}).superRefine((c, ctx) => {
  if (!c.locations.some(l => l.id === c.activeLocation)) ctx.addIssue({ code: 'custom', message: 'Active location does not exist' });
  for (const [label, ids] of [['location', c.locations.map(l => l.id)], ['reminder', c.reminders.map(r => r.id)]] as const) {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${label} ID` });
  }
});
export type Config = z.infer<typeof configSchema>;
export type Location = z.infer<typeof locationSchema>;

export function defaultConfig(): Config {
  return configSchema.parse({ version: 1,
    locations: [{ id: 'coburg', name: 'Coburg, Victoria', country: 'Australia', latitude: -37.75,
      longitude: 144.9667, timeZone: 'Australia/Melbourne' }], activeLocation: 'coburg',
    calculation: {}, audio: { prayers: {} }, scheduler: {}, network: {},
  });
}

export function activeLocation(config: Config): Location {
  return config.locations.find(l => l.id === config.activeLocation)!;
}
