import manifest from '../../../assets/audio/defaults.json';
import { PRAYERS, defaultConfig } from '../../../src/config-model.js';
import { readAudio, storeAudio } from './storage';
import { setRecordingsState } from './offline';

export const defaultRecordings = manifest.recordings;
export function browserDefaultConfig() {
  const config = defaultConfig();
  for (const prayer of PRAYERS) config.audio.prayers[prayer].file = manifest.defaults[prayer];
  config.audio.duaFile = manifest.defaults.dua; config.audio.startupFile = manifest.defaults.startup;
  return config;
}
let pending: Promise<void> | undefined;
/** Each origin/profile gets audio blobs, independent of desktop paths or playback history. */
export function cacheDefaultRecordings(): Promise<void> {
  if (pending) return pending;
  setRecordingsState(false, 'Saving default recordings for offline playback…');
  pending = (async () => {
    for (const item of defaultRecordings) {
      const saved = await readAudio(item.id);
      if (saved?.sha256 === item.sha256 && saved.blob.size === item.bytes) continue;
      const response = await fetch(new URL(item.path, document.baseURI), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Could not download ${item.name}. Reconnect and reload to finish saving the default recordings.`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== item.bytes) throw new Error(`The ${item.name} recording download is incomplete. Reconnect and reload.`);
      if (crypto.subtle) {
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (digest !== item.sha256) throw new Error(`The ${item.name} recording failed its integrity check. Reconnect and reload.`);
      }
      await storeAudio({ id: item.id, name: item.name, blob: new Blob([bytes], { type: 'audio/mpeg' }), sha256: item.sha256, default: true });
    }
    setRecordingsState(true);
  })().catch(error => { setRecordingsState(false, String(error).replace(/^Error: /, '')); throw error; }).finally(() => { pending = undefined; });
  return pending;
}
