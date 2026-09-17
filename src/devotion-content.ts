import { parseDate } from './dates.js';
import { translate } from './localization.js';
export interface Dua { id: string; number?: string; chapter?: number; arabicTitle?: string; url?: string; category: string; categoryName: string; title: string; arabic: string; transliteration: string; meaning: string; reference: string; notes: string | null; }
export interface Hadith { id: string; title: string; arabic: string; meaning: string; wording: 'source-verbatim'; reference: string; url: string; }
export type Reading = { kind: 'dua'; item: Dua } | { kind: 'hadith'; item: Hadith };
export type ReadingAlert = Reading & { id: string; date: string; };
export type ReadingTarget = { kind: 'dua' | 'hadith'; id: string; };
/** Notifications carry source wording too; the OS may visually truncate the preview. */
export function readingNotification(reading: Reading, language: string) {
  const original = language === 'ar' || language === 'ur';
  const label = translate(reading.kind === 'hadith' ? 'Daily hadith' : 'Daily dua', language);
  const title = original && reading.kind === 'dua' ? reading.item.arabicTitle ?? reading.item.title : translate(reading.item.title, language);
  return { title: `${label} · ${title}`, body: `${original ? reading.item.arabic : reading.item.meaning}\n${reading.item.reference}` };
}
export interface DailyReminder { enabled: boolean; time: string; }
export interface DevotionLibrary { duas: Dua[]; hadiths: Hadith[]; }
export const duaText = (dua: Dua) => `${dua.title}\n\n${dua.arabic}\n\n${dua.transliteration}\n\n${dua.meaning}\n\n${dua.notes ?? ''}\n\n${dua.reference}\n${dua.url ?? ''}`;
export const categories = { 'morning-dhikr': 'Morning', 'evening-dhikr': 'Evening', 'dhikr-after-salah': 'After prayer', 'daily-dua': 'Daily occasions', 'selected-dua': 'Selected supplications' };
export function buildLibrary(sources: Record<string, Record<string, string | null>[]>, hadiths: Hadith[]): DevotionLibrary {
  return { duas: Object.entries(categories).flatMap(([category, categoryName]) => sources[category]!.map((row, index) => ({ id: `${category}-${index + 1}`, category, categoryName, title: row.title!, arabic: row.arabic!, transliteration: row.latin!, meaning: row.translation!, reference: row.source || 'Reference not specified in the source dataset', notes: row.notes ?? null }))), hadiths };
}
export function readingForDay(content: DevotionLibrary, kind: 'dua' | 'hadith', date: string): Reading {
  const day = Math.floor(+parseDate(date) / 86400000);
  const index = (length: number) => ((day % length) + length) % length;
  if (kind === 'hadith') return { kind, item: content.hadiths[index(content.hadiths.length)]! };
  const general = content.duas.filter(d => d.category === 'selected-dua' || [129, 130].includes(d.chapter ?? 0));
  return { kind, item: general[index(general.length)]! };
}
export function dueDailyReminders(preferences: { dailyHadith: DailyReminder; dailyDua: DailyReminder }, now: Date, timeZone: string): ('dua' | 'hadith')[] {
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return (['hadith', 'dua'] as const).filter(kind => { const p = kind === 'hadith' ? preferences.dailyHadith : preferences.dailyDua; return p.enabled && clock >= p.time; });
}
