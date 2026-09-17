import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { translateMessage } from '../src/localization.js';
import { homeVerse } from '../src/home-verse.js';

test('languages preserve the layout, load Arabic fonts and show source hadith wording', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({width:1280,height:960});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/');await expect(page.locator('.prayer-card')).toHaveCount(6);
  const initial=await page.locator('.sidebar').boundingBox(), main=await page.locator('.main-scroll').boundingBox();
  mkdirSync('docs/screenshots',{recursive:true});
  const audit:Record<string,unknown>={};
  for(const language of ['ar','ur','tr','id','fr','en']) {
    await page.locator('.language-picker select').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(page.locator('html')).toHaveAttribute('dir','ltr');
    await expect(page.locator('.language-picker>svg')).toBeVisible();
    expect((await page.locator('.sidebar').boundingBox())!.x).toBe(initial!.x);
    expect((await page.locator('.main-scroll').boundingBox())!.x).toBe(main!.x);
    await expect(page.locator('.page-header h1')).toHaveText(translateMessage('A moment for what matters.',language));
    await expect(page.locator('.day-note q')).toHaveText(homeVerse(language).text);
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.fonts.check('16px "Noto Sans Arabic Variable"','العربية اردو'))).toBe(true);
    const cards=await page.locator('.prayer-card').evaluateAll(cards=>cards.map(card=>card.getBoundingClientRect().x));
    expect(cards.every((x,i)=>i===0||x>cards[i-1]!)).toBe(true);
    await page.screenshot({path:`docs/screenshots/language-fixed-${language}.png`,animations:'disabled'});
    for(const [id,name] of [[1,'calendar'],[2,'qibla'],[3,'sounds'],[4,'reminders'],[7,'settings'],[6,'hadith']] as const) {
      await page.locator('.sidebar nav button').nth(id).click();
      await expect(page.locator('.page-header h1')).toBeVisible();
      if(name==='hadith')await expect(page.locator('.hadith-collection')).toHaveCount(17);
      if(name==='settings')await page.getByRole('tab').nth(1).click();
      const findings=await page.locator('.page-content').evaluate(root=>{
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), findings:string[]=[];
        while(walker.nextNode()){const element=walker.currentNode.parentElement,text=walker.currentNode.textContent?.trim()??'';
          if(element&&element.getClientRects().length&&/[a-zA-Z]{3}/.test(text)&&!element.closest('[data-source-text],[lang="en"]'))findings.push(text);}
        return [...new Set(findings)];
      });
      if(language==='ar')audit[name]=findings;
      if(name==='settings')for(const tab of [0,2]) {
        await page.getByRole('tab').nth(tab).click();
        if(language==='ar')audit[`settings-${tab}`]=await page.locator('.page-content').innerText();
        expect(await page.locator('.main-scroll').evaluate(main=>main.scrollWidth<=main.clientWidth)).toBe(true);
      }
      expect(await page.locator('.main-scroll').evaluate(main=>main.scrollWidth<=main.clientWidth)).toBe(true);
    }
    await page.locator('.sidebar nav button').nth(0).click();
  }
  await page.locator('.sidebar nav button').nth(5).click();
  await page.getByRole('tab',{name:'Daily hadith collection'}).click();
  await expect(page.locator('.hadith-original')).toBeVisible();
  const library=await page.evaluate(()=>window.athan.devotionLibrary());
  await page.getByLabel('Search readings').fill('Sahih al-Bukhari 1');
  await page.locator('.reading-index button').first().click();
  await expect(page.locator('.hadith-original')).toHaveText(library.hadiths[0]!.arabic);
  await expect(page.locator('.hadith-meaning')).toHaveText(library.hadiths[0]!.meaning);
  await expect(page.locator('.meaning-label').first()).toHaveText('Original Arabic narration');
  await page.screenshot({path:'docs/screenshots/daily-hadith-original.png',animations:'disabled'});
  writeFileSync('test-results/language-audit.json',JSON.stringify(audit,null,2));
  expect(errors).toEqual([]);
});
