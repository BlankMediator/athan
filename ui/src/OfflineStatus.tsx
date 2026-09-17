import { useEffect, useState } from 'react';
import { CloudCheck, WifiOff } from 'lucide-react';
import { isBrowser, keepOfflineData, offlineState, subscribeOffline } from './browser/offline';
import { isMobile } from './platform';

export function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine), [offline, setOffline] = useState(offlineState), [saving, setSaving] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    const unsubscribe = subscribeOffline(() => setOffline(offlineState()));
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); unsubscribe(); };
  }, []);
  return <details className="offline-status" aria-label="Offline access"><summary><span className="offline-dot" />{!isBrowser ? 'On this device · works offline' : offline.ready ? 'Available offline' : 'Offline access'}</summary><section className="offline-popover">
    <div role="status">{online ? <CloudCheck size={17} /> : <WifiOff size={17} />}<span><strong>{!online && offline.ready ? 'Offline · your prayer information is available' : offline.message}</strong>
      {isMobile ? <small>Prayer times, cities and readings are included in the app. Clearing app data or uninstalling removes your saved settings and recordings.</small> : isBrowser && <small>Times, calendars, Qibla, saved locations and imported recordings stay on this device. {offline.persistent ? 'Storage protection is enabled.' : 'Browser data can be cleared; use Keep offline data to request storage protection.'}</small>}</span>
      {isBrowser && !offline.persistent && <button className="button secondary small" disabled={saving} onClick={() => { setSaving(true); void keepOfflineData().then(ok => setNotice(ok ? 'Offline data protection enabled.' : 'Data is saved, but your browser has not granted storage protection. Avoid clearing site data.')).catch(() => setNotice('Storage protection is unavailable in this browser.')).finally(() => setSaving(false)); }}>Keep offline data</button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {isBrowser && !isMobile && <p>For prayers, enable Athan and keep this app open and your device awake. Browsers can delay prayer calls in background tabs.</p>}
  </section></details>;
}
