const { app } = require('electron');
const { mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');
const root = resolve(__dirname, '..'), out = join(root, 'tmp/pdfs');
app.setPath('userData', join(root, 'tmp/pdf-session'));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const { defaultConfig } = await import(pathToFileURL(join(root, 'dist/config.js')));
  const { exportCalendarPdf } = await import(pathToFileURL(join(root, 'dist/desktop/pdf.js')));
  const config = defaultConfig(); mkdirSync(out, { recursive: true });
  for (const [name, locale, options] of [
    ...['en','ar','ur','tr','id','fr'].map(locale=>[`month-${locale}`,locale,{layout:'month',calendar:'gregorian',year:2026,month:10}]),
    ['ramadan-en', 'en-AU', { layout: 'ramadan', year: 1448 }],
    ['year-hijri', 'en-AU', { layout: 'year', calendar: 'hijri', year: 1448 }],
    ['year-timetables', 'en-AU', { layout: 'year-timetables', calendar: 'hijri', year: 1448 }],
    ['ramadan-ar', 'ar', { layout: 'month', calendar: 'hijri', year: 1448, month: 9 }],
    ['year-ur', 'ur', { layout: 'year', calendar: 'hijri', year: 1448 }],
  ]) {
    await exportCalendarPdf({ ...config, locale, hijriAdjustment:1 }, options, join(out, `${name}.pdf`)); console.log(name);
  }
}).then(() => app.quit()).catch(error => { console.error(error); app.exit(1); });
