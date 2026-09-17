import { test, expect, _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { defaultConfig } from '../src/config.js';
import { toHijri } from '../src/calendar.js';

test('calendar modes, file actions, startup settings, complete Hisn and six language layouts', async () => {
  test.setTimeout(120000);
  const root = resolve('.'); mkdirSync(join(root,'test-results'), { recursive:true });
  const profile = mkdtempSync(join(root,'test-results/update-')), shots=join(root,'docs/screenshots');
  mkdirSync(shots,{recursive:true});
  const config=defaultConfig();config.audio.enabled=false;
  writeFileSync(join(profile,'config.json'),JSON.stringify(config));writeFileSync(join(profile,'desktop.json'),JSON.stringify({notifications:false,language:'en'}));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
  const app=await electron.launch({executablePath:join(root,'node_modules/electron/dist/electron.exe'),args:[root],env:{...env,ATHAN_DATA_DIR:profile}});
  try {
    const page=await app.firstWindow(), errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
    await expect(page.locator('.duha-window')).toBeVisible();
    await expect(page.locator('.offline-status')).toHaveCount(1);
    for(const code of ['ar','ur','tr','id','fr','en']) {
      await page.locator('.language-picker select').selectOption(code);
      await expect(page.locator('html')).toHaveAttribute('lang',code);
      await expect(page.locator('html')).toHaveAttribute('dir','ltr');
      await expect(page.locator('.prayer-card')).toHaveCount(6);
      await page.screenshot({path:join(shots,`language-${code}.png`),animations:'disabled'});
      expect(await page.evaluate(()=>{const main=document.querySelector('.main-scroll')!;return main.scrollWidth<=main.clientWidth;})).toBe(true);
    }
    await page.getByRole('navigation').getByRole('button',{name:'Calendar',exact:true}).click();
    await expect.poll(() => page.locator('.key-events-list>button').count()).toBe(11);
    expect(await page.evaluate(async () => { const s=await window.athan.snapshot(), events=await window.athan.calendarEvents(s.day.hijri.year), list=document.querySelector('.key-events-list')!; const index=events.findIndex(e=>e.date>=s.today), item=list.children[index<0?events.length-1:index] as HTMLElement; const wanted=Math.max(0,Math.min(list.scrollHeight-list.clientHeight,item.offsetTop-(list.clientHeight-item.clientHeight)/2)); return Math.abs(list.scrollTop-wanted)<3; })).toBe(true);
    await page.locator('.calendar-jump .calendar-mode').getByRole('button',{name:'Hijri',exact:true}).click();
    await page.locator('.calendar-jump').getByLabel('Hijri year',{exact:true}).fill('1448');
    await page.locator('.calendar-jump').getByRole('combobox',{name:'Hijri month',exact:true}).selectOption('9');
    await expect(page.locator('.calendar-day')).toHaveCount(29);
    await expect(page.locator('.calendar-day').first()).toHaveAttribute('id','calendar-2027-02-08');
    await expect(page.locator('.calendar-day').last()).toHaveAttribute('id','calendar-2027-03-08');
    await expect(page.locator('.calendar-day').first().locator(':scope > span').first()).toHaveText('1');
    await page.screenshot({path:join(shots,'calendar-hijri.png'),animations:'disabled'});
    const target=join(profile,'hijri-month.pdf');
    await app.evaluate(({dialog,shell},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});shell.openPath=async path=>{(globalThis as any).opened=path;return '';};shell.showItemInFolder=path=>{(globalThis as any).revealed=path;};},target);
    await page.getByRole('button',{name:'Export calendar',exact:true}).click();
    await page.getByRole('button',{name:'Save PDF',exact:true}).click();
    await expect(page.locator('.pdf-saved')).toContainText(target);
    expect(readFileSync(target).toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    await page.getByRole('button',{name:'Open file',exact:true}).click();await page.getByRole('button',{name:'Show in folder',exact:true}).click();
    expect(await app.evaluate(()=>(globalThis as any).opened)).toBe(target);expect(await app.evaluate(()=>(globalThis as any).revealed)).toBe(target);
    await expect(page.evaluate(()=>window.athan.exportedFile('C:\\Windows\\notepad.exe','open'))).rejects.toThrow(/Export this file again/);
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('.calendar-toolbar h2')).toHaveText('Shawwal 1448 AH');
    const result=await page.evaluate(()=>window.athan.calendarMonth({calendar:'hijri',year:1448,month:10}));expect(result.days.every(d=>toHijri(d.date).month===10)).toBe(true);
    await page.getByRole('navigation').getByRole('button',{name:'Athan & sounds',exact:true}).click();await expect(page.getByRole('switch',{name:'Bismillah on startup'})).toHaveCount(0);
    await page.getByRole('navigation').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'App preferences',exact:true}).click();await expect(page.getByRole('switch',{name:'Bismillah on startup',exact:true})).toHaveAttribute('aria-checked','false');
    await page.getByRole('navigation').getByRole('button',{name:'Hisnul Muslim',exact:true}).click();await expect(page.locator('.reading-index>p')).toHaveText('268 supplications');
    await page.getByLabel('Search readings').fill('Hisn al-Muslim 267');await expect(page.locator('.reading-index button')).toHaveCount(1);
    await app.evaluate(({shell})=>{shell.openExternal=async url=>{(globalThis as any).source=url;};});
    await page.getByRole('button',{name:'Read on Sunnah.com',exact:true}).click();expect(await app.evaluate(()=>(globalThis as any).source)).toBe('https://sunnah.com/hisn:267');
    await page.getByRole('navigation').getByRole('button',{name:'Hadith library',exact:true}).click();
    await expect(page.locator('.hadith-collection')).toHaveCount(17);
    // Real optional pack through desktop IPC: no credentials and no external network.
    await app.evaluate(({net})=>{const original=net.fetch.bind(net);net.fetch=async(input,options)=>{if(new URL(String(input)).protocol==='file:')return original(input,options);throw new Error('Offline');};});
    await page.locator('.hadith-collection').first().getByRole('button',{name:'Download',exact:true}).click();
    await expect(page.locator('.hadith-reader')).toContainText('intentions');
    await expect(page.locator('.hadith-collection').first()).toContainText('7278 saved on this device');
    expect(JSON.parse(readFileSync(join(profile,'hadith/bukhari.json'),'utf8')).entries).toHaveLength(7278);
    await page.getByLabel('Hadith book',{exact:true}).selectOption('1');
    expect(await page.getByLabel('Hadith chapter',{exact:true}).locator('option').count()).toBeGreaterThan(2);
    await page.locator('.hadith-reader').getByRole('button',{name:'Read on Sunnah.com',exact:true}).click();
    expect(await app.evaluate(()=>(globalThis as any).source)).toBe('https://sunnah.com/bukhari:1');
    await page.locator('.hadith-reader').scrollIntoViewIfNeeded();
    await page.screenshot({path:join(shots,'hadith-library.png'),animations:'disabled'});
    await page.reload();
    await page.getByRole('navigation').getByRole('button',{name:'Hadith library',exact:true}).click();
    await expect(page.locator('.hadith-reader')).toContainText('intentions');
    await page.getByLabel('Search hadith').fill('no matching fixture');
    await expect(page.locator('.hadith-reader')).toContainText('No matching readings');
    expect(errors).toEqual([]);
  } finally {await app.close();}
});
