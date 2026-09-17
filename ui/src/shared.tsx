import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Moon, Sunrise, Sun, Sunset, CloudSun, Check, X, LoaderCircle, Volume2, VolumeX } from 'lucide-react';
import type { Config, Prayer, PrayerTime } from '../../src/config.js';
import type { ReadingTarget } from '../../src/devotion.js';
import type { Snapshot, Recording } from '../../src/desktop/types.js';
import { getLocale, t } from './i18n/runtime';
import { HIJRI_MONTHS, type HijriDate } from '../../src/calendar.js';
export const hijriDateText = (date: HijriDate) => `${date.day} ${t(HIJRI_MONTHS[date.month - 1]!)} ${date.year} ${t('AH')}`;
export const prayers: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const times: PrayerTime[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const labels: Record<string, string> = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
export const arabic: Record<string, string> = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
export const methods: Record<string, string> = { MuslimWorldLeague: 'Muslim World League', Karachi: 'University of Islamic Sciences, Karachi', NorthAmerica: 'Islamic Society of North America', UmmAlQura: 'Umm al-Qura, Makkah', Egyptian: 'Egyptian General Authority of Survey', Dubai: 'Dubai', MoonsightingCommittee: 'Moonsighting Committee', Kuwait: 'Kuwait', Qatar: 'Qatar', Singapore: 'Singapore', Tehran: 'University of Tehran', Turkey: 'Turkey', Other: 'Custom angles' };
const icons = { fajr: Sunrise, sunrise: Sun, dhuhr: Sun, asr: CloudSun, maghrib: Sunset, isha: Moon };
export function PrayerIcon({ prayer, size = 22 }: { prayer: PrayerTime; size?: number }) { const Icon = icons[prayer]; return <Icon size={size} strokeWidth={1.5} />; }
export function time(value: string | null | undefined, snapshot: Snapshot, hour12 = snapshot.config.hour12) {
  return value ? new Intl.DateTimeFormat(getLocale(), { timeZone: snapshot.day.timeZone, hour: 'numeric', minute: '2-digit', hour12 }).formatToParts(new Date(value)).map(part => part.type === 'dayPeriod' ? t(part.value) : part.value).join('') : '—';
}
export function timeParts(value: string | null | undefined, snapshot: Snapshot) {
  if (!value) return { clock: '—', period: '' };
  const parts = new Intl.DateTimeFormat(getLocale(), { timeZone: snapshot.day.timeZone, hour: 'numeric', minute: '2-digit', hour12: snapshot.config.hour12 }).formatToParts(new Date(value));
  return { clock: parts.filter(p => p.type !== 'dayPeriod').map(p => p.value).join('').trim(), period: t(parts.find(p => p.type === 'dayPeriod')?.value ?? '') };
}
export function longDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) { return new Intl.DateTimeFormat(getLocale(), { calendar: 'gregory', ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)); }
export function shiftDate(date: string, offset: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
export function hijriLabel(snapshot: Snapshot) {
  const months = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah'];
  return `${snapshot.day.hijri.day} ${t(months[snapshot.day.hijri.month - 1]!)}, ${snapshot.day.hijri.year} ${t('AH')}`;
}
export function filename(path: string | null) { return path?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '').replace(/_/g, ' ') ?? 'No recording'; }
export type Page = 'today' | 'calendar' | 'qibla' | 'sounds' | 'reminders' | 'settings' | 'activity' | 'duas' | 'hadith';
export type SettingsTab = 'location' | 'calculation' | 'preferences';
export interface AppContextValue { snapshot: Snapshot; now: number; busy: boolean; recordings: Recording[];
  readingTarget: ReadingTarget | null;
  settingsTab: SettingsTab; setSettingsTab: (tab: SettingsTab) => void;
  navigate: (page: Page) => void; refresh: () => Promise<void>;
  act: (action: () => Promise<unknown>, message?: string) => Promise<void>;
  save: (config: Config, message?: string) => Promise<void>;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('Missing app context'); return value; }
export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`switch ${checked ? 'on' : ''}`}><span /></button>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Panel({ title, subtitle, children, className = '' }: { title?: string; subtitle?: string; children: ReactNode; className?: string }) { return <section className={`panel ${className}`}>{title && <div className="panel-heading"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>}{children}</section>; }
export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></header>{children}</dialog>;
}
export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p></div>; }
export function SaveBar({ dirty, save, reset }: { dirty: boolean; save: () => void; reset: () => void }) {
  const { busy } = useApp(); return dirty ? <div className="save-bar"><span><span className="small-dot" /> You have unsaved changes</span><div><button type="button" className="button ghost" disabled={busy} onClick={reset}>Discard</button><button type="button" className="button primary" disabled={busy} onClick={save}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Save changes</button></div></div> : null;
}
export function SoundState({ enabled }: { enabled: boolean }) { return enabled ? <Volume2 size={14} /> : <VolumeX size={14} />; }
