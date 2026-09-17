import { translations } from './translations.js';
export const LANGUAGE_CODES = ['en', 'ar', 'ur', 'tr', 'id', 'fr'] as const;
export type Language = typeof LANGUAGE_CODES[number];
export function resolveLanguage(choice: string, device: readonly string[]): Language {
  if ((LANGUAGE_CODES as readonly string[]).includes(choice)) return choice as Language;
  return device.map(locale => locale.toLowerCase().split(/[-_]/)[0]!).find(code => (LANGUAGE_CODES as readonly string[]).includes(code)) as Language ?? 'en';
}
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'").toLowerCase();
const lookup = Object.fromEntries(Object.entries(translations).map(([key, values]) => [normalize(key), values]));
const patterns = Object.entries(translations).filter(([key]) => /\{\d+\}/.test(key)).map(([key, values]) => {
  const slots: number[] = [], pieces = normalize(key).split(/(\{\d+\})/);
  const pattern = pieces.map(piece => /^\{\d+\}$/.test(piece)
    ? (slots.push(Number(piece.slice(1, -1))), '(.+?)') : piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return { matcher: new RegExp(`^${pattern}$`, 'i'), slots, values };
});
export function translate(text: string, locale: string) {
  const language = resolveLanguage(locale, [locale]), index = LANGUAGE_CODES.indexOf(language) - 1;
  if (index < 0) return text;
  const value = lookup[normalize(text)]?.[index];
  return value ? text.replace(text.trim(), value) : text;
}
/** Match complete interface messages before substituting translated dynamic labels. */
export function translateMessage(text: string, locale: string): string {
  const translated = translate(text, locale);
  if (translated !== text || resolveLanguage(locale, [locale]) === 'en') return translated;
  const index = LANGUAGE_CODES.indexOf(resolveLanguage(locale, [locale])) - 1;
  for (const { matcher, slots, values } of patterns) {
    // Keep captured source values in their original case.
    const match = text.trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'").match(matcher);
    if (!match) continue;
    const parameters = new Map(slots.map((slot, i) => [slot, translate(match[i + 1]!, locale)]));
    return values[index]!.replace(/\{(\d+)\}/g, (_, slot: string) => parameters.get(+slot) ?? '');
  }
  return text;
}
