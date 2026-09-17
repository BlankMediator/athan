import { tr, getLanguage } from './i18n/runtime';
import { homeVerse } from '../../src/home-verse.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, MapPin, Moon, Pause, Play, Sparkles, Sunrise, Volume2, VolumeX, Bell, Compass as CompassIcon, LoaderCircle, Square } from 'lucide-react';
import type { Day } from '../../src/desktop/types.js';
import { arabic, labels, longDate, methods, Panel, PrayerIcon, shiftDate, timeParts, time, times, useApp } from './shared';
import { Compass, Landscape } from './art';
import { useDeviceCompass } from './DeviceTools';
import { isMobile } from './platform';
import { MobileStatus } from './mobile/MobileStatus';
import { headingDifference } from '../../src/compass.js';

export function Today() {
  const verse = homeVerse(getLanguage());
  const { snapshot: s, now, navigate, busy, act, save } = useApp();
  const [date, setDate] = useState(s.today), [day, setDay] = useState<Day>(s.day), [error, setError] = useState('');
  const previousToday = useRef(s.today);
  useEffect(() => { if (date === previousToday.current) setDate(s.today); previousToday.current = s.today; }, [s.today]);
  useEffect(() => { let live = true; void window.athan.snapshot(date).then(r => { if (live) { setDay(r.day); setError(''); } }).catch(e => { if (live) setError(String(e)); }); return () => { live = false; }; }, [date, s.config]);
  const next = s.next, seconds = Math.max(0, Math.ceil(((next ? +new Date(next.at) : now) - now) / 1000));
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0'));
  const enabled = s.runtime.status !== 'paused';
  return <>
    {isMobile && <MobileStatus />}
    <section className="hero-card" aria-label="Next prayer"><Landscape /><div className="hero-text"><span className="hero-eyebrow"><span className="tiny-star">✦</span> YOUR NEXT PRAYER</span>
      <div className="hero-prayer"><h2>{next ? labels[next.prayer] : 'A quiet moment'}</h2><span lang="ar" dir="rtl">{next && getLanguage() !== 'ar' ? arabic[next.prayer] : ''}</span></div>
      <p className="hero-time">{next ? time(next.at, s) : 'No upcoming time available'}<span>·</span>{next?.date === s.today ? 'Today' : 'Tomorrow'}</p>
      <div className="countdown" aria-label={`${countdown[0]} hours ${countdown[1]} minutes until ${next?.prayer ?? 'prayer'}`}><span>{countdown[0]}<small>HOURS</small></span><i>:</i><span>{countdown[1]}<small>MINUTES</small></span><i>:</i><span>{countdown[2]}<small>SECONDS</small></span></div>
    </div><button className={`hero-alert ${enabled ? 'enabled' : ''}`} disabled={busy} onClick={() => void act(() => window.athan.running(!enabled), enabled ? 'Automatic Athan paused.' : 'Automatic Athan is on.')}>
      {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}<span>{enabled ? 'Athan is on' : 'Enable Athan'}</span><span className="hero-alert-dot" /></button>
      <div className="hero-caption"><span /> A pause. A prayer. A new beginning.</div>
    </section>
    <div className="home-playback-controls"><div><strong>Prayer audio</strong><span>{s.runtime.alerts.length || s.runtime.playing ? 'A prayer, reminder or recording is active' : 'Ready for the next call'}</span></div><button type="button" className="button secondary stop-athan" disabled={!s.runtime.alerts.length && !s.runtime.playing} onClick={() => void act(() => window.athan.dismissAlerts())}><Square size={15} fill="currentColor" />Stop Athan</button><small>Stops the current sound. Future prayers stay scheduled.</small></div>
    <section className="timetable"><header className="section-header"><div><h2>Prayer times</h2><span>{date === s.today ? 'Today' : longDate(date, { day: 'numeric', month: 'short' })} <i>·</i> {longDate(date, { day: 'numeric', month: 'long' })}</span></div><div className="date-navigation"><button className="icon-button" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft size={17} /></button><button className="text-button" onClick={() => setDate(s.today)}>Today</button><button className="icon-button" aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight size={17} /></button><span className="vertical-rule" /><button className="icon-button" aria-label="Open calendar" onClick={() => navigate('calendar')}><CalendarDays size={18} /></button></div></header>
      <div className="prayer-grid">{times.map(prayer => {
        const upcoming = next?.prayer === prayer && next.date === day.date, earlier = day.times[prayer] && +new Date(day.times[prayer]!) < now;
        const audio = prayer === 'sunrise' ? null : s.config.audio.prayers[prayer];
        return <article className={`prayer-card ${upcoming ? 'upcoming' : ''} ${earlier ? 'earlier' : ''}`} key={prayer}><div className="prayer-card-top"><PrayerIcon prayer={prayer} />{upcoming ? <span className="next-badge">NEXT</span> : <span className="prayer-arabic" lang="ar">{arabic[prayer]}</span>}</div><h3>{labels[prayer]}</h3><time>{timeParts(day.times[prayer], s).clock}<small>{timeParts(day.times[prayer], s).period}</small></time><div className="prayer-card-bottom"><span>{prayer === 'sunrise' ? 'Daybreak' : upcoming ? 'Coming up' : earlier ? 'Earlier today' : 'Prayer time'}</span>{audio && <button className="icon-button" aria-label={`${audio.enabled ? 'Mute' : 'Enable'} ${labels[prayer]} Athan`} disabled={busy} onClick={() => { const config = structuredClone(s.config); config.audio.prayers[prayer as keyof typeof config.audio.prayers].enabled = !audio.enabled; void save(config); }}>{audio.enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}</button>}</div></article>;
      })}</div>
      <div className="duha-window"><div><strong>Duha / Ishraq</strong><small>Estimated voluntary prayer window</small></div><span dir="ltr"><bdi>{time(day.ishraq, s)}</bdi> – <bdi>{time(day.duhaEnd, s)}</bdi></span><small>{tr('From {0} minutes after sunrise to {1} minutes before solar noon.', s.config.calculation.ishraqAfterSunrise, s.config.calculation.duhaBeforeNoon)}</small></div><div className="calculation-note"><span className="small-dot" />{methods[s.config.calculation.method]}<span>·</span>{s.config.calculation.madhab === 'Hanafi' ? 'Hanafi' : 'Standard'} Asr<button onClick={() => navigate('settings')}>Adjust settings <ArrowUpRight size={13} /></button></div>
      {error && <p className="inline-warning" role="alert">{error}</p>}{day.warnings.map(w => <p className="inline-warning" key={w}>{w}</p>)}
    </section>
    <div className="today-lower"><button className="qibla-preview" onClick={() => navigate('qibla')}><div><span className="eyebrow">FIND YOUR DIRECTION</span><h3>Always, toward Makkah.</h3><p>{s.day.qibla.toFixed(1)}° <span>from true north</span></p><span className="inline-link">Explore Qibla <ArrowUpRight size={15} /></span></div><Compass bearing={s.day.qibla} mini /></button>
      <div className="night-card"><span className="night-icon"><Moon size={23} strokeWidth={1.5} /></span><span className="eyebrow">IN THE STILLNESS</span><h3>The last third of the night</h3><strong>{time(s.day.lastThirdOfNight, s)}</strong><p>A quiet window for prayer and reflection.</p><span className="night-bottom"><Clock3 size={13} /> Calculated from Maghrib to Fajr</span></div>
    </div>
    <div className="day-note"><span className="note-symbol">✦</span><p><q lang={getLanguage()} dir="auto" title={verse.translator}>{verse.text}</q><span>Quran · 13:28 (excerpt)</span></p><div className="note-line" /></div>
  </>;
}

export { CalendarPage } from './CalendarPage';

export function QiblaPage() {
  const { snapshot: s, navigate } = useApp(), location = s.config.locations.find(l => l.id === s.config.activeLocation)!;
  const device = useDeviceCompass(location);
  const difference = device.heading === undefined ? undefined : headingDifference(s.day.qibla, device.heading);
  return <div className="qibla-layout"><section className="compass-panel panel"><span className="eyebrow">A SHARED DIRECTION</span>{device.button}<Compass bearing={s.day.qibla} heading={device.heading} /><div className="bearing-value">{s.day.qibla.toFixed(1)}<span>°</span></div><p>Qibla bearing · clockwise from true north</p><div className={`qibla-guidance ${difference !== undefined && Math.abs(difference) <= 5 ? "aligned" : ""}`} role="status">{difference === undefined ? "Turn on the compass, then point the top marker toward the Kaaba." : Math.abs(difference) <= 5 ? "You are facing the Qibla" : `Turn ${Math.abs(difference).toFixed(0)}° ${difference > 0 ? "right" : "left"} toward the Kaaba`}</div><span className="compass-rule" />{device.controls}</section><div className="qibla-information"><div className="qibla-quote"><span className="quote-ornament">✦</span><h2>Wherever you are,<br /><em>find your connection.</em></h2><p>Your direction to the Kaaba, calculated from your saved location.</p></div><Panel><span className="eyebrow">YOUR STARTING POINT</span><div className="place-detail"><MapPin size={22} /><div><h3>{location.name}</h3><p>{location.country}</p></div></div><div className="coordinate-pair"><div><small>LATITUDE</small><strong>{Math.abs(location.latitude).toFixed(4)}° {location.latitude < 0 ? 'S' : 'N'}</strong></div><div><small>LONGITUDE</small><strong>{Math.abs(location.longitude).toFixed(4)}° {location.longitude < 0 ? 'W' : 'E'}</strong></div></div><button className="text-button" onClick={() => navigate('settings')}>Change location <ArrowUpRight size={15} /></button></Panel><p className="compass-instruction"><CompassIcon size={19} />The bearing uses your saved location. The red needle points north; the Kaaba marks the Qibla. Turn your device until the Kaaba lines up with the fixed marker at the top. Magnetic readings are corrected for this location when a model is available.</p></div></div>;
}
