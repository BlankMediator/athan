import { readFileSync } from 'node:fs';
import { readingForDay, type DevotionLibrary, type Hadith } from './devotion-content.js';
export * from './devotion-content.js';
let library: DevotionLibrary | undefined;
export function devotionLibrary(): DevotionLibrary {
  library ??= { duas: JSON.parse(readFileSync(new URL('../assets/devotion/hisn/edition.json', import.meta.url), 'utf8')).duas, hadiths: JSON.parse(readFileSync(new URL('../assets/devotion/hadiths.json', import.meta.url), 'utf8')) as Hadith[] };
  return library;
}
export const dailyReading = (kind: 'dua' | 'hadith', date: string) => readingForDay(devotionLibrary(), kind, date);
