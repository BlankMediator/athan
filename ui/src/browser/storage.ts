import type { Snapshot } from '../../../src/desktop/types.js';
import { isMobile } from '../platform';
import { configSchema, type Config, PRAYERS } from '../../../src/config-model.js';

export type AudioRecord = { id: string; name: string; blob: Blob; sha256?: string; default?: boolean };
type History = Snapshot['history'][number];
let database: Promise<IDBDatabase> | undefined;
function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('athan-browser', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('settings');
      request.result.createObjectStore('audio', { keyPath: 'id' });
      request.result.createObjectStore('history', { keyPath: 'id' });
    };
    request.onerror = () => reject(new Error('Browser storage is unavailable. Allow site data to save Athan for offline use.'));
    request.onblocked = () => reject(new Error('Close other Athan tabs to finish upgrading local storage.'));
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined; }; resolve(request.result); };
  }).catch(error => { database = undefined; throw error; });
  return database;
}
async function transaction<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode), request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(new Error(`Could not save or read local data: ${tx.error?.message ?? request.error?.message ?? 'storage unavailable'}`));
    tx.onerror = () => {};
  });
}
const nativeSetting = (key: string) => isMobile && ['config', 'preferences', 'mobile-enabled'].includes(key);
export async function readSetting<T>(key: string): Promise<T | undefined> {
  if (nativeSetting(key)) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: `athan-${key}` });
    return value === null ? undefined : JSON.parse(value) as T;
  }
  return transaction<T | undefined>('settings', 'readonly', s => s.get(key));
}
export async function writeSetting(key: string, value: unknown) {
  if (nativeSetting(key)) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: `athan-${key}`, value: JSON.stringify(value) });
  } else await transaction('settings', 'readwrite', s => s.put(value, key));
}
export const audioRecords = () => transaction<AudioRecord[]>('audio', 'readonly', s => s.getAll());
export const readAudio = (id: string) => transaction<AudioRecord | undefined>('audio', 'readonly', s => s.get(id));
export const storeAudio = (audio: AudioRecord) => transaction('audio', 'readwrite', s => s.put(audio));
/** Seed only on first creation, in the same transaction that checks for an existing profile. */
export async function initializeConfig(defaults: Config): Promise<Config> {
  if (isMobile) {
    const saved = await readSetting('config');
    const config = configSchema.parse(saved ?? defaults);
    if (!saved) await writeSetting('config', config);
    return config;
  }
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite'), store = tx.objectStore('settings');
    let value: Config;
    const request = store.get('config');
    request.onsuccess = () => {
      try { value = configSchema.parse(request.result ?? defaults); if (!request.result) store.put(value, 'config'); }
      catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(value); tx.onabort = () => reject(tx.error ?? new Error('Could not save the browser profile.'));
  });
}
export const history = async () => (await transaction<History[]>('history', 'readonly', s => s.getAll())).sort((a, b) => b.claimed.localeCompare(a.claimed));
export const finishEvent = (event: History) => transaction('history', 'readwrite', s => s.put(event));
/** A single read/write transaction claims each event across tabs and browser restarts. */
export async function claimEvent(event: History): Promise<boolean> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite'), store = tx.objectStore('history');
    let claimed = false;
    const get = store.get(event.id);
    get.onsuccess = () => { if (!get.result) { store.add(event); claimed = true; } };
    tx.oncomplete = () => resolve(claimed);
    tx.onabort = () => reject(tx.error);
  });
}
export async function pruneHistory() {
  const db = await open(), cutoff = new Date(Date.now() - 8 * 86400000).toISOString();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite'), cursor = tx.objectStore('history').openCursor();
    cursor.onsuccess = () => { const row = cursor.result; if (row) { if (row.value.scheduled < cutoff) row.delete(); row.continue(); } };
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
}
