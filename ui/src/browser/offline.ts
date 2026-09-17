import { isMobile } from '../platform';
export const isBrowser = location.protocol !== 'athan:';
export type OfflineState = { ready: boolean; message: string; persistent: boolean };
let state: OfflineState = { ready: isMobile || !isBrowser, message: isMobile ? 'Installed on this device · works offline' : isBrowser ? 'Preparing offline access…' : 'Stored on this computer · works offline', persistent: isMobile || !isBrowser };
const listeners = new Set<() => void>();
let appReady = state.ready, recordingsReady = !isBrowser;
let appMessage = state.message, recordingMessage = 'Saving default recordings for offline playback…';
export const offlineState = () => state;
export const subscribeOffline = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function update(patch: Partial<OfflineState>) { state = { ...state, ...patch }; for (const listener of listeners) listener(); }
function readiness(ready: boolean, message: string) {
  appReady = ready; appMessage = message;
  update({ ready: appReady && recordingsReady, message: !appReady ? appMessage : !recordingsReady ? recordingMessage : isMobile ? 'Installed on this device · works offline' : 'Ready for offline use' });
}
export function setRecordingsState(ready: boolean, message = '') {
  recordingsReady = ready; if (message) recordingMessage = message;
  readiness(appReady, appMessage);
}
export async function keepOfflineData() {
  const persistent = await navigator.storage?.persist?.() ?? false;
  update({ persistent });
  return persistent;
}
export async function prepareOffline() {
  if (!isBrowser || isMobile) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    readiness(false, 'Offline reopening requires HTTPS or localhost.'); return;
  }
  try {
    update({ persistent: await navigator.storage?.persisted?.() ?? false });
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' });
    const check = async () => {
      const worker = registration.active;
      if (!worker) return;
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); readiness(false, 'Could not verify offline files. Reconnect and reload to try again.'); }, 10000);
      channel.port1.onmessage = event => {
        clearTimeout(timer); channel.port1.close();
        const ready = event.data?.ready === true;
        readiness(ready, ready ? 'Ready for offline use' : 'Offline files are incomplete. Reconnect and reload to download them.');
      };
      worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
    };
    const watch = (worker: ServiceWorker | null) => {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'activated') void check();
        if (worker.state === 'redundant' && !registration.active) readiness(false, 'Offline download did not finish. Reconnect and reload to try again.');
      });
    };
    watch(registration.installing); watch(registration.waiting);
    registration.addEventListener('updatefound', () => watch(registration.installing));
    navigator.serviceWorker.addEventListener('controllerchange', () => void check());
    window.addEventListener('online', () => { void registration.update().catch(() => {}); void check(); });
    await check();
  } catch { readiness(false, 'Offline setup is unavailable. Reconnect and reload to try again.'); }
}
