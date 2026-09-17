import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_CODES, resolveLanguage, translate, translateMessage } from '../dist/localization.js';
import { translations } from '../dist/translations.js';
import { defaultConfig } from '../dist/config.js';
import { calendarPrintHtml } from '../dist/calendar-print.js';
import { homeVerse } from '../dist/home-verse.js';
test('device language matches supported base language and otherwise falls back to English',()=>{
 assert.equal(resolveLanguage('system',['ar-SA','en-AU']),'ar');assert.equal(resolveLanguage('system',['ur-PK']),'ur');assert.equal(resolveLanguage('system',['de-DE','fr-FR']),'fr');
 assert.equal(resolveLanguage('system',['ja-JP']),'en');assert.equal(resolveLanguage('tr',['ar']),'tr');
 for(const key of Object.keys(translations))assert.equal(translations[key].filter(Boolean).length,5,key);
 for(const locale of LANGUAGE_CODES.slice(1)) {assert.notEqual(translate('Settings',locale),'Settings');assert.notEqual(translate('TODAY',locale),'TODAY');}
 assert.equal(translate('My own location name','ar'),'My own location name');
});
test('dynamic messages translate the full phrase and preserve inserted values',()=>{
 assert.equal(translateMessage('  235,803 cities · showing 200  ','ar'),'235,803 مدينة · المعروض 200');
 assert.equal(translateMessage('Mute Fajr Athan','ar'),'كتم أذان الفجر');
 assert.equal(translateMessage('Book 12','fr'),'Livre 12');
 assert.equal(translateMessage('Any user-supplied title','ar'),'Any user-supplied title');
});
test('Arabic exports use RTL, localized headings, and still escape user text',()=>{
 const config=defaultConfig();config.locale='ar';config.locations[0].name='A <script> & B';
 const html=calendarPrintHtml(config,{layout:'month',calendar:'hijri',year:1448,month:9});
 assert.match(html,/<html lang="ar" dir="rtl">/);assert.match(html,/رمضان 1448 هـ/);assert.match(html,/A &lt;script&gt; &amp; B/);assert.doesNotMatch(html,/&amp;lt;script/);
});

test('home and PDF reflections, calculation settings and correction notes use every selected language',()=>{
 const decode=html=>html.replace(/&#39;/g,"'").replace(/&amp;/g,'&');
 for(const language of LANGUAGE_CODES) {
   const config=defaultConfig();config.locale=language;config.hijriAdjustment=1;
   const html=decode(calendarPrintHtml(config,{layout:'month',calendar:'gregorian',year:2026,month:10}));
   assert.ok(html.includes(homeVerse(language).text),`${language} reflection`);
   assert.ok(html.includes(translateMessage('Quran · 13:28 (excerpt)',language)));
   assert.ok(html.includes(translateMessage('12-hour clock',language)));
   if(language!=='en') {
     assert.ok(!html.includes(homeVerse('en').text));
     assert.doesNotMatch(html,/>[^<>]*(?:12-hour clock|Hijri correction|Friday|Key Islamic date|CALCULATED FOR YOUR LOCATION)[^<>]*</);
   }
 }
});
