import { z } from 'zod';
const daily = z.strictObject({ enabled: z.boolean(), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Choose a time in HH:mm format') });
export const prefsSchema = z.strictObject({
  theme: z.enum(['light', 'dark', 'system']).default('light'), closeToTray: z.boolean().default(true), notifications: z.boolean().default(true), resumeAlerts: z.boolean().default(false),
  dailyHadith: daily.default({ enabled: false, time: '09:00' }), dailyDua: daily.default({ enabled: false, time: '20:00' }),
  favoriteDuas: z.array(z.string().regex(/^[a-z0-9-]+$/).max(100)).max(500).default([]),
  calendar: z.enum(['gregorian', 'hijri']).default('gregorian'),
  language: z.enum(['system', 'en', 'ar', 'ur', 'tr', 'id', 'fr']).default('system'),
});
export const prefsPatch = z.strictObject({
  theme: z.enum(['light', 'dark', 'system']).optional(), closeToTray: z.boolean().optional(), notifications: z.boolean().optional(), resumeAlerts: z.boolean().optional(),
  dailyHadith: daily.optional(), dailyDua: daily.optional(), favoriteDuas: z.array(z.string().regex(/^[a-z0-9-]+$/).max(100)).max(500).optional(),
  calendar: z.enum(['gregorian', 'hijri']).optional(), language: z.enum(['system', 'en', 'ar', 'ur', 'tr', 'id', 'fr']).optional(),
});
