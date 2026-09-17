import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass as CompassIcon, LocateFixed, LoaderCircle, Square } from 'lucide-react';
import type { Location } from '../../src/config.js';
import type { DeviceLocation } from '../../src/desktop/types.js';
import type { CompassState } from '../../src/device.js';
import { Panel } from './shared';
import { isBrowser } from './browser/offline';
import { isMobile } from './platform';
import { magneticDeclination, normalizeHeading } from '../../src/compass.js';

export function DeviceLocationPicker({ choose }: { choose: (location: Location) => void }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState<DeviceLocation | null>(null), [error, setError] = useState('');
  const live = useRef(true); useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const locate = async () => {
    setBusy(true); setError(''); setResult(null);
    try { const position = await window.athan.deviceLocation(); if (live.current) setResult(position); }
    catch (e) { if (live.current) setError(String(e).replace(/^Error: (?:Error invoking remote method '[^']+': Error: )?/, '')); }
    finally { if (live.current) setBusy(false); }
  };
  return <Panel className="device-location-panel" title="Let your device find you" subtitle={`Use ${isMobile ? 'your device’s' : isBrowser ? 'your browser’s' : 'Windows'} location services when available, then review before saving.`}>
    <button type="button" className="button secondary" disabled={busy} onClick={() => void locate()}>{busy ? <LoaderCircle size={16} className="spin" /> : <LocateFixed size={16} />}{busy ? 'Finding your location…' : 'Use device location'}</button>
    {error && <p role="alert" className="inline-warning">{error}</p>}
    {result && <div className="device-position" role="status"><strong>{result.location.name}</strong><p>{result.latitude.toFixed(5)}°, {result.longitude.toFixed(5)}° · Accuracy about {Math.round(result.accuracy)} m · {result.source}</p><p>Suggested time zone: <b>{result.location.timeZone}</b>. Based on the nearest catalogue city ({result.distanceKm.toFixed(1)} km away); check it if you are near a time-zone border.</p><button type="button" className="button primary" onClick={() => { choose(result.location); setResult(null); }}>Use these coordinates</button></div>}
  </Panel>;
}

export function useDeviceCompass(location: Location) {
  const [state, setState] = useState<CompassState>({ status: 'off' });
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const unsubscribe = window.athan.subscribeCompass(value => { setState(value); if (['off', 'unavailable', 'error'].includes(value.status)) setEnabled(false); });
    return () => { unsubscribe(); void window.athan.compass(false).catch(() => {}); };
  }, []);
  // Do not keep presenting a frozen heading as live after a sensor stops updating.
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { if (!enabled) return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [enabled]);
  const fresh = state.status === 'reading' && !!state.timestamp && clock - +new Date(state.timestamp) < 5000;
  const declination = useMemo(() => magneticDeclination(location.latitude, location.longitude), [location.latitude, location.longitude]);
  const estimated = state.trueNorth == null;
  const heading = !fresh ? undefined : state.trueNorth ?? (state.magneticNorth == null ? undefined : normalizeHeading(state.magneticNorth + (declination ?? 0)));
  const toggle = async () => {
    const next = !enabled; setEnabled(next); setState(next ? { status: 'waiting' } : { status: 'off' });
    try { await window.athan.compass(next); }
    catch { setEnabled(false); setState({ status: 'error', message: 'Could not connect to the device compass.' }); }
  };
  return { heading, approximate: estimated && declination === undefined, button: <button type="button" className="button secondary compass-toggle" onClick={() => void toggle()}>{enabled ? <Square size={14} /> : <CompassIcon size={16} />}{enabled ? 'Stop device compass' : 'Use device compass'}</button>, controls: <div className="device-compass-controls"><div role="status">
    {heading !== undefined ? <><strong>Live heading · {heading.toFixed(1)}° {estimated ? declination === undefined ? 'magnetic north' : 'estimated true north' : 'true north'}</strong><p>Point the top of the screen ahead. Keep your device flat and away from magnetic objects. Accuracy: {state.accuracy ?? 'unknown'}.</p>{estimated && <p>{declination === undefined ? 'Magnetic correction is unavailable; the Kaaba direction is approximate.' : `Magnetic heading: ${state.magneticNorth?.toFixed(1)}°. Corrected for your saved location using the World Magnetic Model.`}</p>}</> : state.status === 'reading' ? <p>Waiting for a fresh compass reading. The dial shows the calculated true-north bearing.</p> : <p>{state.message ?? (enabled ? 'Looking for a compass sensor…' : 'Use device compass to follow your heading. Turn until the Kaaba reaches the marker at the top.')}</p>}
  </div></div> };
}
