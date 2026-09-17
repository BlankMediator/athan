import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Bell, CalendarDays, ChevronRight, Compass as CompassIcon, Globe2, LayoutDashboard, LoaderCircle, MapPin, Minus, Moon, Settings2, Square, Sun, Volume2, X, Activity, Check, AlertCircle, Pause, Play, Menu } from 'lucide-react';
import type { Config } from '../../src/config.js';
import type { Snapshot, Recording } from '../../src/desktop/types.js';
import { AppContext, type Page, type SettingsTab, hijriLabel, longDate } from './shared';
import { Logo } from './art';
import { DevotionPage } from './DevotionPage';
import { HadithPage } from './HadithPage';
import { languages, resolveLanguage, setLanguage } from './i18n/runtime';
import type { ReadingTarget } from '../../src/devotion.js';
import { OfflineStatus } from './OfflineStatus';
import { OfflineLibraryControl } from './OfflineLibraryControl';
import { isBrowser } from './browser/offline';
import { Today, CalendarPage, QiblaPage } from './PrayerPages';
import { SoundsPage, RemindersPage, SettingsPage, ActivityPage } from './SettingsPages';

const navigation = [
  { id: 'today', label: 'Today', icon: LayoutDashboard }, { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'qibla', label: 'Qibla', icon: CompassIcon }, { id: 'sounds', label: 'Athan & sounds', icon: Volume2 },
  { id: 'reminders', label: 'Reminders', icon: Bell }, { id: 'duas', label: 'Hisnul Muslim', icon: BookOpen }, { id: 'hadith', label: 'Hadith library', icon: BookOpen }, { id: 'settings', label: 'Settings', icon: Settings2 },
] as const;
const headings: Record<Page, { eyebrow: string; title: string; subtitle: string }> = {
  hadith: { eyebrow: 'READ WITH UNDERSTANDING', title: 'Words to return to.', subtitle: 'Explore the major collections, at your own pace.' },
  today: { eyebrow: 'IN THE RHYTHM OF YOUR DAY', title: 'A moment for what matters.', subtitle: 'A gentle return, five times a day.' },
  calendar: { eyebrow: 'LOOK A LITTLE AHEAD', title: 'Days with intention.', subtitle: 'Your prayer timetable, one month at a time.' },
  qibla: { eyebrow: 'WHEREVER YOU FIND YOURSELF', title: 'One direction. A shared connection.', subtitle: 'Find your bearing toward the Sacred Mosque.' },
  sounds: { eyebrow: 'A FAMILIAR CALL', title: 'The sound of a pause.', subtitle: 'Choose the voices that bring you back to prayer.' },
  reminders: { eyebrow: 'MAKE A LITTLE SPACE', title: 'A reminder to return.', subtitle: 'A quiet nudge before or after your prayer.' },
  settings: { eyebrow: 'MAKE ATHAN YOUR OWN', title: 'Thoughtfully set for you.', subtitle: 'Your location, your calculation, your daily rhythm.' },
  duas: { eyebrow: 'WORDS FOR YOUR EVERYDAY', title: 'A place for remembrance.', subtitle: 'Duas, dhikr and a daily moment of reflection.' },
  activity: { eyebrow: 'EVERY CALL, ACCOUNTED FOR', title: 'A clear view of your day.', subtitle: 'Recent prayers and the health of your setup.' },
};

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [page, setPageState] = useState<Page>('today');
  const [menuCollapsed, setMenuCollapsed] = useState(() => { try { return localStorage.getItem('athan-menu-collapsed') === 'true'; } catch { return false; } });
  const toggleMenu = () => setMenuCollapsed(value => { try { localStorage.setItem('athan-menu-collapsed', String(!value)); } catch {} return !value; });
  useEffect(() => {
    const navigation = document.getElementById('primary-navigation');
    if (!navigation) return;
    const resize = new ResizeObserver(() => navigation.parentElement?.style.setProperty('--navigation-height', `${navigation.getBoundingClientRect().height}px`));
    resize.observe(navigation); return () => resize.disconnect();
  }, []);
  const [readingTarget, setReadingTarget] = useState<ReadingTarget | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('location');
  const setPage = (next: Page) => { if (next !== page) setSettingsTab('location'); setPageState(next); };
  useEffect(() => {
    const back = (event: Event) => {
      const dialog = document.querySelector('dialog[open]');
      if (dialog) { event.preventDefault(); dialog.dispatchEvent(new Event('cancel', { cancelable: true })); }
      else if (page !== 'today') { event.preventDefault(); setPageState('today'); }
    };
    window.addEventListener('athan-back', back);
    return () => window.removeEventListener('athan-back', back);
  }, [page]);
  const [failure, setFailure] = useState(''), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null), [recordings, setRecordings] = useState<Recording[]>([]);
  const refreshing = useRef(false), refreshAgain = useRef(false), request = useRef(0);
  const language = resolveLanguage(snapshot?.preferences.language ?? 'system', snapshot?.deviceLanguages ?? navigator.languages);
  setLanguage(language);
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = 'ltr'; }, [language]);
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 }); // Phones use the document; desktop uses main-content.
  }, [page, settingsTab]);
  const refresh = useCallback(async () => {
    if (refreshing.current) { refreshAgain.current = true; return; }
    refreshing.current = true; const id = ++request.current;
    try {
      if (!window.athan) throw new Error('Athan could not initialize. Reload to try again.');
      const data = await window.athan.snapshot();
      if (id === request.current) { setSnapshot(data); setFailure(''); }
    } catch (error) { setFailure(String(error).replace(/^Error: /, '')); }
    finally { refreshing.current = false; if (refreshAgain.current) { refreshAgain.current = false; void refresh(); } }
  }, []);
  useEffect(() => {
    void refresh(); void window.athan?.recordings().then(setRecordings).catch(() => {});
    const unsubscribeReading = window.athan?.subscribeReading(target => { setReadingTarget(target); setPageState('duas'); });
    const unsubscribe = window.athan?.subscribe(() => { void refresh(); });
    const poll = setInterval(() => void refresh(), 15000), clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsubscribeReading?.(); unsubscribe?.(); clearInterval(poll); clearInterval(clock); };
  }, [refresh]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(null), toast.error ? 9000 : 3500); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    const choice = snapshot?.preferences.theme ?? 'light', media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.dataset.theme = choice === 'system' ? media.matches ? 'dark' : 'light' : choice;
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [snapshot?.preferences.theme]);
  const act = useCallback(async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try { await action(); await refresh(); const list = await window.athan.recordings(); setRecordings(list); if (message) setToast({ message, error: false }); }
    catch (error) { setToast({ message: String(error).replace(/^Error: (Error invoking remote method '[^']+': Error: )?/, ''), error: true }); }
    finally { setBusy(false); }
  }, [refresh]);
  const controlAudio = async (action: () => Promise<void>) => {
    try { await action(); await refresh(); } catch (error) { setToast({ message: String(error).replace(/^Error: /, ''), error: true }); }
  };
  const save = useCallback((config: Config, message = 'Your changes have been saved.') => act(() => window.athan.saveConfig(config), message), [act]);
  const activeLocation = snapshot?.config.locations.find(l => l.id === snapshot.config.activeLocation);
  const alerting = snapshot?.runtime.status !== 'paused';
  const content = { today: Today, calendar: CalendarPage, qibla: QiblaPage, sounds: SoundsPage, reminders: RemindersPage, settings: SettingsPage, activity: ActivityPage, duas: DevotionPage, hadith: HadithPage }[page];
  const Content = content, heading = headings[page];
  return <div className={`desktop-shell ${menuCollapsed ? "menu-collapsed" : ""} ${snapshot?.runtime.playing || snapshot?.runtime.alerts.length ? "has-audio-controls" : ""}`}>
    {!isBrowser && <div className="window-bar"><span>ATHAN</span><div className="window-actions">
      <button aria-label="Minimize window" onClick={() => void window.athan.window('minimize')}><Minus size={15} /></button>
      <button aria-label="Maximize window" onClick={() => void window.athan.window('maximize')}><Square size={12} /></button>
      <button aria-label="Close window" onClick={() => void window.athan.window('close')}><X size={17} /></button>
    </div></div>}
    <aside className="sidebar" id="primary-navigation" hidden={menuCollapsed}>
      <div className="brand"><Logo /><div><strong>athan<span>.</span></strong><small>A LITTLE CLOSER</small></div></div>
      <span className="nav-caption">YOUR DAILY COMPANION</span>
      <nav aria-label="Main navigation">{navigation.map(item => <button key={item.id} className={page === item.id ? 'selected' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}><item.icon size={19} strokeWidth={1.6} /><span>{item.label}</span>{page === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom">
        <button className={`activity-link ${page === 'activity' ? 'active' : ''}`} onClick={() => setPage('activity')}><Activity size={17} /><span>Activity & health</span><ArrowUpRight size={14} /></button>
        <div className="sidebar-location"><span className="offline-dot" /><div><strong>{activeLocation?.name ?? 'Your location'}</strong><small>Prayer times, always offline.</small></div></div>
        <div className="sidebar-footer"><span>Made for a mindful day.</span><button className="icon-button" aria-label="Toggle color theme" disabled={!snapshot || busy} onClick={() => void act(() => window.athan.preferences({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }))}>{snapshot?.preferences.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div>
      </div>
    </aside>
    <main className="main-scroll" id="main-content">
      <div className="app-toolbar"><button className="icon-button menu-toggle" aria-label={menuCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!menuCollapsed} aria-controls="primary-navigation" onClick={toggleMenu}><Menu size={23}/></button><span>{navigation.find(item => item.id === page)?.label ?? 'Activity & health'}</span>{snapshot && <OfflineLibraryControl compact />}</div>
      {!snapshot ? <div className="loading-state"><Logo size={58} />{failure ? <><h2>Let’s reconnect.</h2><p>{failure}</p><button className="button primary" onClick={() => void refresh()}>Try again</button></> : <><LoaderCircle className="spin" size={22} /><p>Finding the rhythm of your day…</p></>}</div> : <AppContext.Provider value={{ snapshot, now, busy, recordings, readingTarget, settingsTab, setSettingsTab, navigate: setPage, refresh, act, save }}>
        <header className="page-header"><div><span className="eyebrow">{page === 'today' ? longDate(snapshot.today).toUpperCase() : heading.eyebrow}</span><h1>{heading.title}</h1><p>{heading.subtitle}</p></div><div className="header-controls"><label className="language-picker"><Globe2 size={18} aria-hidden="true" /><select aria-label="Language" value={snapshot.preferences.language} disabled={busy} onChange={e => void act(() => window.athan.preferences({ language: e.target.value as Snapshot['preferences']['language'] }))}><option value="system">Device language</option>{Object.entries(languages).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}</select></label><button className="location-button" onClick={() => { setSettingsTab('location'); setPage('settings'); }}><span className="location-icon"><MapPin size={19} strokeWidth={1.5} /></span><span><strong>{activeLocation?.name}</strong><small>{hijriLabel(snapshot)}</small></span><ChevronRight size={16} /></button></div></header>

        {failure && <div className="notice error"><AlertCircle size={17} />{failure}<button onClick={() => void refresh()}>Retry</button></div>}
        {snapshot.runtime.error && <div className="notice error"><AlertCircle size={17} /><span>{snapshot.runtime.error}</span><button onClick={() => setPage('activity')}>View activity</button></div>}
        <div className="page-content" key={page}><Content /></div>
        <footer className="main-footer"><OfflineStatus /><button disabled={busy} onClick={() => void act(() => window.athan.running(!alerting), alerting ? 'Automatic Athan paused.' : 'Automatic Athan is on.')}><span className={`status-light ${alerting ? 'on' : ''}`} />{alerting ? 'Automatic Athan on' : 'Automatic Athan paused'}{busy ? <LoaderCircle size={12} className="spin" /> : alerting ? <Pause size={12} /> : <Play size={12} />}</button></footer>
      </AppContext.Provider>}
    </main>
    {snapshot && (snapshot.runtime.alerts.length > 0 || snapshot.runtime.playing) && <div className="active-alert audio-dock" role="region" aria-label="Audio player">
      <span className="active-alert-icon"><Volume2 size={22} /></span>
      <div className="audio-dock-title" role="status"><strong>{snapshot.runtime.alerts.at(-1)?.title ?? recordings.find(record => record.path === snapshot.runtime.playing)?.name ?? 'Sound preview'}</strong><small>{snapshot.runtime.audioPaused ? 'Audio paused' : snapshot.runtime.audioLoading ? 'Loading recording…' : snapshot.runtime.playing ? 'Now playing' : 'Prayer alert'}</small></div>
      {snapshot.runtime.playing && <button className="button primary" onClick={() => void controlAudio(() => window.athan.pauseAudio(!snapshot.runtime.audioPaused))}>{snapshot.runtime.audioPaused ? <Play size={16}/> : <Pause size={16}/>} {snapshot.runtime.audioPaused ? 'Resume audio' : 'Pause audio'}</button>}
      <button className="button secondary" onClick={() => void controlAudio(() => window.athan.dismissAlerts())}><Square size={14} fill="currentColor" />Dismiss / stop sound</button>
    </div>}
    {snapshot && snapshot.readingAlerts.length > 0 && <aside className="daily-reading-alert" role="status"><span className="eyebrow">{snapshot.readingAlerts[0]!.kind === 'hadith' ? 'Daily hadith' : 'Daily dua'}{snapshot.readingAlerts.length > 1 ? ' · 2 READINGS' : ''}</span><h3>{snapshot.readingAlerts[0]!.item.title}</h3><p lang={language === "ar" || language === "ur" ? "ar" : "en"} dir="auto">{language === "ar" || language === "ur" ? snapshot.readingAlerts[0]!.item.arabic : snapshot.readingAlerts[0]!.item.meaning}</p><small data-source-text>{snapshot.readingAlerts[0]!.item.reference}</small><div><button className="button primary small" onClick={() => { const reading = snapshot.readingAlerts[0]!; setReadingTarget({ kind: reading.kind, id: reading.item.id }); setPage('duas'); void act(() => window.athan.dismissReading(reading.id)); }}>Open reading <BookOpen size={14} /></button><button className="text-button" onClick={() => void act(() => window.athan.dismissReading(snapshot.readingAlerts[0]!.id))}>Dismiss reading</button></div></aside>}
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle size={19} /> : <Check size={19} />}<span>{toast.message}</span><button aria-label="Dismiss message" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}
