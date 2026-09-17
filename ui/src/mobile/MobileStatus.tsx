import { useSyncExternalStore } from 'react';
import { mobileStatus, subscribeMobileStatus, refreshMobileNotifications, requestExactAlarms } from './status';
import { useApp } from '../shared';

export function MobileStatus() {
  const state = useSyncExternalStore(subscribeMobileStatus, mobileStatus);
  const { act, busy, snapshot } = useApp();
  return <aside className="mobile-status" aria-label="Mobile reminders">
    <strong>{state.pending ? `${state.pending} reminders scheduled` : 'Your prayer companion, wherever you go'}</strong>
    <p>{state.through ? `Scheduled through ${new Date(state.through).toLocaleString(undefined, { timeZone: snapshot.day.timeZone, dateStyle: 'medium', timeStyle: 'short' })} (${snapshot.day.timeZone}). Open Athan regularly to refresh the next days.` : 'Enable Athan to schedule prayer notifications on this device.'}</p>
    <p>Full Athan recordings play while the app is open. Background reminders are silent notifications.</p>
    {state.error && <p role="alert">{state.error}</p>}
    {state.permission === 'denied' && <p>Notifications are blocked. Allow them in your device settings.</p>}
    {!state.exact && <><p>Allow precise alarms for prayer-time notifications. Until then, your device may delay reminders.</p><button className="button secondary small" disabled={busy} onClick={() => void act(requestExactAlarms)}>Allow precise alarms</button></>}
    {(state.pending > 0 || state.error) && <button className="button secondary small" disabled={busy} onClick={() => void act(refreshMobileNotifications)}>Refresh reminders</button>}
  </aside>;
}
