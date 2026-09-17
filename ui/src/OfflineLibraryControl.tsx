import { useEffect, useState } from 'react';
import { Check, Download, LoaderCircle, X } from 'lucide-react';
import { HADITH_COLLECTIONS, type HadithStatus } from '../../src/hadith-library.js';
import { isBrowser, keepOfflineData, offlineState, subscribeOffline } from './browser/offline';
import { isMobile } from './platform';

export function OfflineLibraryControl({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<HadithStatus | null>(null), [error, setError] = useState('');
  const [offline, setOffline] = useState(offlineState);
  useEffect(() => {
    let live = true;
    const update = () => { void window.athan.hadithStatus().then(value => { if (live) setStatus(value); }).catch(e => { if (live) setError(String(e)); }); };
    update(); const off = window.athan.subscribe(update), storage = subscribeOffline(() => setOffline(offlineState()));
    return () => { live = false; off(); storage(); };
  }, []);
  if (!isBrowser || isMobile) return compact ? null : <p className="devotion-note">All collections are included on this device and can be read offline.</p>;
  const count = status?.collections.filter(c => c.complete && c.source === 'community').length ?? 0;
  const complete = count === HADITH_COLLECTIONS.length && offline.ready;
  const saving = !!status?.savingAll || !!status?.downloading;
  const save = async () => {
    setError('');
    // Request protection from the click. Declining it does not prevent local saving.
    void keepOfflineData().catch(() => {});
    try { await window.athan.hadithSaveAll(); } catch (error) { setError(String(error).replace(/^Error: /, '')); }
  };
  return <div className={`offline-library-control ${compact ? 'compact' : ''}`}>
    <button type="button" className="button secondary small" disabled={saving || complete} onClick={() => void save()}>
      {saving ? <LoaderCircle size={15} className="spin" /> : complete ? <Check size={15} /> : <Download size={15} />}
      {saving ? `Saving offline · ${count}/${HADITH_COLLECTIONS.length}` : complete ? 'Everything saved offline' : 'Save everything offline'}
    </button>
    {saving && <button type="button" className="icon-button" aria-label="Cancel offline saving" onClick={() => void window.athan.hadithCancel()}><X size={16} /></button>}
    {!compact && <p>Save the app, locations, readings and all 17 hadith collections on this browser. Default recordings are saved automatically. Collection files total {(HADITH_COLLECTIONS.reduce((n, c) => n + c.bytes, 0) / 1e6).toFixed(1)} MB.</p>}
    {(error || status?.error) && <small role="alert">{error || status?.error} Saved collections remain available; try again to finish.</small>}
  </div>;
}
