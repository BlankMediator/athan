import { safeStorage, net } from 'electron';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { writeJson } from '../storage.js';
import { HadithLibrary, HADITH_COLLECTIONS, collectionId, type DownloadedHadith } from '../hadith-library.js';

export function desktopHadithLibrary(directory: string, changed: () => void) {
  const folder = join(directory, 'hadith'); mkdirSync(folder, { recursive: true });
  const keyFile = join(folder, 'connection.json'); let sessionKey = '';
  const encrypted = safeStorage.isEncryptionAvailable();
  const cache = new Map<string, DownloadedHadith | null>();
  return new HadithLibrary({
    persistentKey: encrypted,
    async key(value) {
      if (value !== undefined) {
        sessionKey = value;
        if (value && encrypted) writeJson(keyFile, { encrypted: safeStorage.encryptString(value).toString('base64') }, true);
        else if (existsSync(keyFile)) unlinkSync(keyFile);
      }
      if (!sessionKey && encrypted && existsSync(keyFile)) {
        try { sessionKey = safeStorage.decryptString(Buffer.from(JSON.parse(readFileSync(keyFile, 'utf8')).encrypted, 'base64')); } catch { /* A key from another Windows account cannot be decrypted. */ }
      }
      return sessionKey;
    },
    async read(id) { const path = join(folder, `${collectionId.parse(id)}.json`); if (!cache.has(id)) cache.set(id, existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as DownloadedHadith : null); return cache.get(id)!; },
    async write(id, value) { const path = join(folder, `${collectionId.parse(id)}.json`); if (value) writeJson(path, value, true); else if (existsSync(path)) unlinkSync(path); cache.set(id, value); },
  }, (url, options) => net.fetch(String(url), options), changed, async (id, signal) => {
    const pack=HADITH_COLLECTIONS.find(c=>c.id===id)!;
    const bytes=readFileSync(new URL(`../../assets/hadith/${pack.file}`,import.meta.url));
    if(createHash('sha256').update(bytes).digest('hex')!==pack.sha256)throw new Error('The collection pack failed its integrity check.');
    signal.throwIfAborted();return JSON.parse(gunzipSync(bytes,{maxOutputLength:100_000_000}).toString('utf8'));
  });
}
