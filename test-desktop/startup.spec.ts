import { test, expect, _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defaultConfig } from '../src/config.js';
test('startup Bismillah plays while prayers are paused, is dismissible, and never repeats on scheduler resume', async () => {
  const root=resolve('.');mkdirSync(join(root,'test-results'),{recursive:true});const profile=mkdtempSync(join(root,'test-results/startup-'));
  const wav=join(profile,'silent.wav'), samples=8000*60, audio=Buffer.alloc(44+samples*2);
  audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(8000,24);audio.writeUInt32LE(16000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(samples*2,40);writeFileSync(wav,audio);
  const config=defaultConfig();config.audio.volume=0;config.audio.startupEnabled=true;config.audio.startupFile=wav;config.scheduler.days=[];
  writeFileSync(join(profile,'config.json'),JSON.stringify(config));writeFileSync(join(profile,'desktop.json'),JSON.stringify({notifications:false,resumeAlerts:false,language:'en'}));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
  const app=await electron.launch({executablePath:join(root,'node_modules/electron/dist/electron.exe'),args:[root],env:{...env,ATHAN_DATA_DIR:profile}});
  try {
    const page=await app.firstWindow();await expect(page.locator('.active-alert')).toContainText('Bismillah on startup');
    expect((await page.evaluate(()=>window.athan.snapshot())).runtime.status).toBe('paused');
    await page.getByRole('button',{name:'Stop Athan',exact:true}).click();await expect(page.locator('.active-alert')).toHaveCount(0);
    await page.evaluate(async()=>{await window.athan.running(true);await window.athan.running(false);await window.athan.running(true);});
    await expect(page.locator('.active-alert')).toHaveCount(0);expect((await page.evaluate(()=>window.athan.snapshot())).runtime.playing).toBeNull();
    await page.evaluate(()=>window.athan.running(false));
  } finally {await app.close();}
});
