import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { configSchema, PRAYERS, type Config } from './config-model.js';
export * from './config-model.js';

export function readConfig(path: string): Config {
  const config = configSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const absolute = (p: string | null): string | null => p === null || isAbsolute(p) ? p : resolve(dirname(path), p);
  for (const prayer of PRAYERS) config.audio.prayers[prayer].file = absolute(config.audio.prayers[prayer].file);
  config.audio.duaFile = absolute(config.audio.duaFile);
  config.audio.startupFile = absolute(config.audio.startupFile);
  for (const reminder of config.reminders) reminder.file = absolute(reminder.file);
  return config;
}

