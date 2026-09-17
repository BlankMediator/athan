import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COMMUNITY_COLLECTIONS } from '../src/hadith-catalogue.js';
import type { Plugin } from 'vite';

/** Precaches the app, fonts and city catalogue. Hadith packs are separate optional downloads. */
export function offlineBuild(native = false): Plugin {
  return {
    name: 'athan-offline',
    generateBundle: { order: 'post', handler(_options, bundle) {
      const extra: Record<string, string | Buffer> = {};
      const audio = JSON.parse(readFileSync(new URL('../assets/audio/defaults.json', import.meta.url), 'utf8')) as { recordings: { path: string; bytes: number; sha256: string }[] };
      extra['audio/defaults.json'] = readFileSync(new URL('../assets/audio/defaults.json', import.meta.url));
      for (const recording of audio.recordings) {
        if (!/^audio\/[a-z0-9-]+\.mp3$/.test(recording.path)) throw new Error('Invalid default recording path');
        const bytes = readFileSync(new URL(`../assets/${recording.path}`, import.meta.url));
        if (bytes.length !== recording.bytes || createHash('sha256').update(bytes).digest('hex') !== recording.sha256) throw new Error(`Default recording is incomplete: ${recording.path}`);
        extra[recording.path] = bytes;
      }
      for (const file of ['countries.json', 'cities.json.gz']) extra[`locations/${file}`] = readFileSync(new URL(`../assets/locations/${file}`, import.meta.url));
      for (const file of ['README.md', 'LICENSE-fitrahive.txt']) extra[`devotion/${file}`] = readFileSync(new URL(`../assets/devotion/${file}`, import.meta.url));
      for (const file of ['LICENSE-AGPL-3.0.txt', 'source-metadata.json']) extra[`devotion/hisn/${file}`] = readFileSync(new URL(`../assets/devotion/hisn/${file}`, import.meta.url));
      extra['audio/README.md'] = readFileSync(new URL('../assets/audio/README.md', import.meta.url));
      extra['locations/README.md'] = readFileSync(new URL('../assets/locations/README.md', import.meta.url));
      extra['THIRD_PARTY.md'] = readFileSync(new URL('../THIRD_PARTY.md', import.meta.url));
      extra['icon.png'] = readFileSync(new URL('../assets/icon.png', import.meta.url));
      extra['manifest.webmanifest'] = JSON.stringify({ id: './', name: 'Athan — Prayer companion', short_name: 'Athan', description: 'Prayer times, calendars and Qibla, available offline.', start_url: './', scope: './', display: 'standalone', background_color: '#f6f7f2', theme_color: '#355e4d', icons: [{ src: 'icon.png', sizes: '256x256', type: 'image/png' }] });
      for (const [fileName, source] of Object.entries(extra)) this.emitFile({ type: 'asset', fileName, source });
      const files = [...new Set([...Object.keys(bundle), ...Object.keys(extra), 'index.html'])].sort();
      const digest = createHash('sha256');
      for (const file of files) { const entry = bundle[file]; digest.update(file); digest.update(extra[file] ?? (entry ? entry.type === 'chunk' ? entry.code : entry.source : '')); }
      const version = digest.digest('hex').slice(0, 16);
      // Optional collection packs are served locally, but not precached with the application shell.
      // A download stores its validated records in IndexedDB for subsequent offline reading.
      for(const collection of COMMUNITY_COLLECTIONS) this.emitFile({type:'asset',fileName:`hadith/${collection.file}`,source:readFileSync(new URL(`../assets/hadith/${collection.file}`,import.meta.url))});
      for(const name of ['README.md','manifest.json','quality-report.json','LICENSE-CheeseWithSauce.txt','LICENSE-Sehal.md','LICENSE-Jaguar.md']) this.emitFile({type:'asset',fileName:`hadith/${name}`,source:readFileSync(new URL(`../assets/hadith/${name}`,import.meta.url))});
      if (native) return; // Native projects bundle these files; never cache old app code in a service worker.
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const PREFIX = 'athan-app-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href);
const SHELL = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try { await cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' }))); }
  catch (error) { await caches.delete(CACHE); throw error; }
  // Updated builds wait until all old tabs close, so assets and application code stay together.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = request.mode === 'navigate' ? SHELL : url.origin + url.pathname;
    const saved = await cache.match(key);
    if (saved) return saved;
    return fetch(request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const complete = (await Promise.all(FILES.map(file => cache.match(file)))).every(Boolean);
    event.ports[0]?.postMessage({ ready: complete });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window' });
    const tab = tabs.find(tab => tab.url.startsWith(self.registration.scope));
    const opened = tab ? await tab.focus() : await self.clients.openWindow(self.registration.scope);
    if (opened && event.notification.data?.reading) opened.postMessage({ reading: event.notification.data.reading });
  })());
});
` });
    } },
  };
}
