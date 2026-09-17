import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { defaultConfig, configSchema, PRAYERS, type Config, type Location } from './config.js';

export const BUILTIN_LOCATIONS: Location[] = [
  { id: 'coburg', name: 'Coburg, Victoria', country: 'Australia', latitude: -37.75, longitude: 144.9667, timeZone: 'Australia/Melbourne' },
  { id: 'melbourne', name: 'Melbourne', country: 'Australia', latitude: -37.8136, longitude: 144.9631, timeZone: 'Australia/Melbourne' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' },
  { id: 'makkah', name: 'Makkah', country: 'Saudi Arabia', latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh' },
  { id: 'madinah', name: 'Madinah', country: 'Saudi Arabia', latitude: 24.4672, longitude: 39.6111, timeZone: 'Asia/Riyadh' },
  { id: 'london', name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
  { id: 'new-york', name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo' },
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', latitude: 24.8607, longitude: 67.0011, timeZone: 'Asia/Karachi' },
];
const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Reads the installed city catalogue on demand; no bundled proprietary catalogue. */
export function searchLegacyCities(root: string, query: string, country?: string) {
  const directory = join(root, 'athanxml', 'country');
  const result: { name: string; country: string; latitude: number; longitude: number; legacyUtcOffset: number; timeZone: null }[] = [];
  for (const name of readdirSync(directory).filter(f => f.endsWith('.xml') && (!country || f.toLowerCase() === `${country.toLowerCase()}.xml`))) {
    const xml = readFileSync(join(directory, name), 'utf8');
    for (const match of xml.matchAll(/<city\s+name="([^"]+)"\s*>([\s\S]*?)<\/city>/g)) {
      const label = decode(match[1]!);
      if (!label.toLowerCase().includes(query.toLowerCase())) continue;
      const body = match[2]!;
      const numeric = (tag: string) => Number(body.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1]);
      const latitude = numeric('latitude') / 10000, longitude = numeric('longitude') / 10000;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
      result.push({ name: label, country: name.slice(0, -4), latitude, longitude, legacyUtcOffset: numeric('timezone') / 100, timeZone: null });
      if (result.length >= 200) return result;
    }
  }
  return result;
}

export function importLegacy(root: string, options: { timeZone: string; method: Config['calculation']['method']; virtualRoot?: string }) {
  const config = defaultConfig(), warnings: string[] = [];
  function read(relative: string): string | null {
    const candidates = [options.virtualRoot && join(options.virtualRoot, relative), join(root, relative)].filter((p): p is string => Boolean(p));
    const path = candidates.find(existsSync);
    return path ? readFileSync(path, 'utf8').trim() : null;
  }
  const selected = read('city/selectedCity');
  if (selected) {
    if (basename(selected) !== selected || selected.includes('..') || /[\\/]/.test(selected)) throw new Error('Invalid legacy city file name');
    const raw = read(`city/${selected}`), chunks = raw?.split('***');
    if (!chunks || chunks.length < 2) throw new Error('Legacy city settings are incomplete');
    const names = chunks[0]!.split('__').map(s => s.trim()).filter(Boolean);
    const coordinates = chunks[1]!.split('__').map(Number);
    config.locations = [{ id: 'imported', name: names[0] || selected, country: names[1] || '',
      latitude: coordinates[0]!, longitude: coordinates[1]!, timeZone: options.timeZone }];
    config.activeLocation = 'imported';
  }
  config.calculation.method = options.method;
  const selectedAudio = read('sound/selectedAthan')?.split(';') ?? [];
  for (const [i, prayer] of PRAYERS.entries()) {
    const name = selectedAudio[i];
    if (!name || name === 'No_Athan.wma') { config.audio.prayers[prayer] = { enabled: name !== 'No_Athan.wma', file: null }; continue; }
    if (basename(name) !== name || /[\\/]/.test(name)) { warnings.push(`Skipped unsupported legacy audio path: ${name}`); continue; }
    const folders = prayer === 'fajr' ? ['fajr', 'otherprayers'] : ['otherprayers', 'fajr'];
    const path = folders.map(folder => join(root, 'sound', folder, name)).find(existsSync);
    config.audio.prayers[prayer].file = path ?? null;
    if (!path) warnings.push(`Missing recording for ${prayer}: ${name}`);
  }
  for (const [flag, field, relative] of [
    ['extra/dua1', 'duaFile', 'sound/dua/dua.wma'],
    ['extra/bismillah', 'startupFile', 'sound/bismillah/Bismillah.wma'],
  ] as const) {
    const path = join(root, relative);
    if (read(flag) === '1' && existsSync(path)) config.audio[field] = path;
  }
  config.hour12 = read('extra/hours12') !== '0';
  warnings.push('Calculation method and time zone were supplied explicitly. Legacy numeric method/DST codes were not guessed.');
  warnings.push('Volume, Asr method, minute adjustments and recitation reminders use the new defaults; review before daily use.');
  return { config: configSchema.parse(config), warnings };
}
