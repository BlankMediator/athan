import { readFileSync } from 'node:fs';
import type { Config } from './config-model.js';
import { calendarPrintHtml as render, type CalendarPdfOptions } from './calendar-layout.js';
export { pdfOptionsSchema, pdfPeriod, type CalendarPdfOptions } from './calendar-layout.js';
let fonts = '';
function printFonts() {
  fonts ||= [
    ['Manrope', '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', '100 900'],
    ['Cormorant', '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2', '600'],
    ['NotoArabic', '@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2', '100 900'],
  ].map(([name, path, weight]) => `@font-face{font-family:${name};font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(new URL(`../node_modules/${path}`, import.meta.url)).toString('base64')}) format('woff2')}`).join('');
  return fonts;
}

export function calendarPrintHtml(config: Config, options: CalendarPdfOptions): string { return render(config, options, printFonts()); }
