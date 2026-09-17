import { translateMessage } from '../../../src/localization.js';
export { resolveLanguage } from '../../../src/localization.js';
export const languages = { en: 'English', ar: 'العربية', ur: 'اردو', tr: 'Türkçe', id: 'Bahasa Indonesia', fr: 'Français' } as const;
export type Language = keyof typeof languages;
let current: Language = 'en';
export function setLanguage(language: Language) { current = language; }
export const getLanguage = () => current;
export const getLocale = () => ({ en: 'en-AU', ar: 'ar', ur: 'ur-PK', tr: 'tr-TR', id: 'id-ID', fr: 'fr-FR' })[current];
export const tr = (key: string, ...values: (string | number)[]) => t(key).replace(/\{(\d+)\}/g, (_, n: string) => String(values[+n] ?? ''));
export function t(text: string): string {
  return translateMessage(text, current);
}
