// Render the app's existing geometric vector mark for native launcher and splash assets.
import { chromium } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#355e4d"/><path d="M24 8 29 16 38 14 36 23 41 29 32 32 29 41 23 36 14 38 16 29 8 24 16 19 14 10 23 12Z" fill="none" stroke="#f4efd9" stroke-width="1.3"/><path d="M24 16 32 24 24 32 16 24Z" fill="none" stroke="#f4efd9" stroke-width="1.2"/><circle cx="24" cy="24" r="2.5" fill="#dbbc7e"/></svg>`;
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (path, width, height, size, background) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:${background}}body{display:grid;place-items:center}svg{width:${size}px;height:${size}px}</style>${mark}`);
    await page.screenshot({ path, omitBackground: background === 'transparent' });
  };
  await render('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, 760, '#355e4d');
  const root = resolve('android/app/src/main/res');
  for (const dir of await readdir(root, { withFileTypes: true })) if (dir.isDirectory()) {
    for (const name of await readdir(resolve(root, dir.name))) if (/^(ic_launcher.*|splash)\.png$/.test(name)) {
      const path = resolve(root, dir.name, name), bytes = await readFile(path);
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      const foreground = name.includes('foreground'), splash = name === 'splash.png';
      await render(path, width, height, splash ? Math.min(width, height) * .22 : foreground ? width * .58 : width * .85, foreground ? 'transparent' : splash ? '#f6f7f2' : '#355e4d');
    }
  }
  const splashRoot = 'ios/App/App/Assets.xcassets/Splash.imageset';
  for (const name of await readdir(splashRoot)) if (name.endsWith('.png')) {
    const path = resolve(splashRoot, name), bytes = await readFile(path);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    await render(path, width, height, Math.min(width, height) * .2, '#f6f7f2');
  }
} finally { await browser.close(); }
