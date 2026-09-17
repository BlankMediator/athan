import { getLanguage, t, tr } from './i18n/runtime';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Bookmark, Check, ExternalLink, LoaderCircle, RotateCcw, Search, Sunrise } from 'lucide-react';
import type { DevotionLibrary, Dua, Hadith } from '../../src/devotion.js';
import { readingForDay } from '../../src/devotion-content.js';
import { isBrowser } from './browser/offline';
import { isMobile } from './platform';
import { Field, Panel, Switch, useApp } from './shared';

export function DailyReminderSettings() {
  const { snapshot: s, act, busy } = useApp();
  const [hadithTime, setHadithTime] = useState(s.preferences.dailyHadith.time), [duaTime, setDuaTime] = useState(s.preferences.dailyDua.time);
  useEffect(() => { setHadithTime(s.preferences.dailyHadith.time); setDuaTime(s.preferences.dailyDua.time); }, [s.preferences.dailyHadith.time, s.preferences.dailyDua.time]);
  return <Panel title="A daily moment of remembrance" subtitle="Optional hadith and dua readings. Both are off until you enable them." className="daily-reminder-settings">
    {(['hadith', 'dua'] as const).map(kind => {
      const key = kind === 'hadith' ? 'dailyHadith' : 'dailyDua', prefs = s.preferences[key], value = kind === 'hadith' ? hadithTime : duaTime, change = kind === 'hadith' ? setHadithTime : setDuaTime;
      return <div className="daily-setting" key={kind}><div><strong>{kind === 'hadith' ? 'Daily hadith' : 'Daily dua'}</strong><small>{kind === 'hadith' ? 'A complete narration with its original wording and source.' : 'A general supplication from your dua collection.'}</small></div><Field label={`Daily ${kind} time`}><input type="time" required value={value} onChange={e => change(e.target.value)} /></Field><button type="button" className="button secondary small" disabled={busy || value === prefs.time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)} onClick={() => void act(() => window.athan.preferences({ [key]: { ...prefs, time: value } }), 'Reminder time saved.')}><Check size={14} />Save time</button><Switch label={`Enable daily ${kind}`} checked={prefs.enabled} disabled={busy} onChange={enabled => void act(() => window.athan.preferences({ [key]: { ...prefs, enabled } }))} /></div>;
    })}
    <p className="devotion-note">{tr('Times follow {0}.', s.day.timeZone.replace(/_/g, ' '))} {isMobile ? 'These silent readings are scheduled on your device. Open Athan regularly to refresh upcoming reminders.' : isBrowser ? 'These silent readings run while this tab is open and your device is awake, independently of prayer calls.' : 'These silent readings run while Athan is open or in the tray, independently of prayer calls.'} {"If today's time has passed, the reading appears once when enabled or next opened. Earlier days are not queued."}{!s.preferences.notifications && ' Notifications are off; readings will appear in the app.'}</p>
    {s.readingError && <p role="alert" className="inline-warning">{s.readingError}</p>}
  </Panel>;
}

const sourceTitle = (item: Dua | Hadith) => ['ar', 'ur'].includes(getLanguage()) && 'arabicTitle' in item ? item.arabicTitle ?? item.title : item.title;
const normalize = (text: string) => text.normalize('NFKD').replace(/[\p{M}\u0640]/gu, '').toLocaleLowerCase().replace(/[أإآ]/g, 'ا');
function DuaReading({ dua }: { dua: Dua }) {
  const { snapshot: s, act, busy } = useApp(), [count, setCount] = useState(0), [copied, setCopied] = useState(false);
  const favorite = s.preferences.favoriteDuas.includes(dua.id);
  const words = `${dua.notes ?? ''} ${dua.meaning}`;
  const times = words.match(/\b(\d+|three|seven|ten|thirty-three|one hundred)\s+times\b/i)?.[1]?.toLowerCase();
  const target = times ? Number(times) || ({ three: 3, seven: 7, ten: 10, 'thirty-three': 33, 'one hundred': 100 } as Record<string, number>)[times] || null : null;
  useEffect(() => { setCount(0); setCopied(false); }, [dua.id]);
  const copy = () => act(async () => { await window.athan.copyDua(dua.id); setCopied(true); });
  return <article className="dua-reading panel"><header><span className="eyebrow" data-source-text dir="auto">{sourceTitle(dua)}</span><button type="button" className={`icon-button ${favorite ? 'is-favorite' : ''}`} disabled={busy} aria-label={favorite ? 'Remove dua from favorites' : 'Save dua to favorites'} aria-pressed={favorite} onClick={() => void act(() => window.athan.preferences({ favoriteDuas: favorite ? s.preferences.favoriteDuas.filter(id => id !== dua.id) : [...s.preferences.favoriteDuas, dua.id] }))}><Bookmark size={19} fill={favorite ? 'currentColor' : 'none'} /></button></header><h2>{dua.number && <small className="hisn-number">{dua.number}. </small>}{sourceTitle(dua)}</h2>
    <div className="dua-arabic" lang="ar" dir="rtl">{dua.arabic}</div>
    {dua.transliteration && <div className="reading-block"><span className="eyebrow">TRANSLITERATION</span><p className="transliteration" lang="en" dir="ltr">{dua.transliteration}</p></div>}
    <div className="reading-block"><span className="eyebrow">MEANING</span><p lang="en" dir="ltr">{dua.meaning}</p></div>
    <div className="dua-reference"><BookOpen size={15} /><span data-source-text>{dua.reference}</span></div>
    <button type="button" className="text-button" onClick={() => void act(() => window.athan.openReadingSource(dua.id))}>Read on Sunnah.com <ExternalLink size={14} /></button>{dua.notes && <p className="devotion-note" lang="en" dir="ltr">{dua.notes}</p>}<footer><button type="button" className="button secondary" aria-label="Count recitation" onClick={() => setCount(n => target ? Math.min(target, n + 1) : n + 1)}>{count === target ? <Check size={16} /> : <span className="count-dot" />}{count}{target ? ` / ${target}` : ''}</button><button type="button" className="icon-button" aria-label="Reset recitation count" onClick={() => setCount(0)}><RotateCcw size={15} /></button><button type="button" className="text-button copy-reading" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy dua'}</button></footer>
  </article>;
}
function HadithReading({ hadith }: { hadith: Hadith }) {
  const { act } = useApp();
  return <article className="hadith-reading panel"><span className="eyebrow">Daily hadith</span><BookOpen className="reading-emblem" size={35} strokeWidth={1.2} /><h2>{hadith.title}</h2><span className="meaning-label">Original Arabic narration</span><p className="dua-arabic hadith-original" lang="ar" dir="rtl">{hadith.arabic}</p><span className="meaning-label">Published English translation</span><p className="hadith-meaning" lang="en" dir="ltr">{hadith.meaning}</p><div className="dua-reference"><BookOpen size={16} /><span data-source-text>{hadith.reference}</span></div><button type="button" className="text-button" onClick={() => void act(() => window.athan.openReadingSource(hadith.id))}>Read on Sunnah.com <ExternalLink size={14} /></button></article>;
}

export function DevotionPage() {
  const { snapshot: s, readingTarget, act, navigate } = useApp();
  const [library, setLibrary] = useState<DevotionLibrary | null>(null), [error, setError] = useState('');
  const [kind, setKind] = useState<'dua' | 'hadith'>(readingTarget?.kind ?? 'dua'), [selected, setSelected] = useState(readingTarget?.id ?? '');
  const [category, setCategory] = useState('all'), [query, setQuery] = useState(''), [favorites, setFavorites] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  useEffect(() => { let live = true; void window.athan.devotionLibrary().then(data => { if (live) setLibrary(data); }).catch(e => { if (live) setError(String(e)); }); return () => { live = false; }; }, []);
  useEffect(() => { if (readingTarget) { setKind(readingTarget.kind); setSelected(readingTarget.id); setQuery(''); setCategory('all'); setFavorites(false); } }, [readingTarget]);
  if (error) return <Panel><p role="alert" className="inline-warning">{error}</p></Panel>;
  if (!library) return <div className="calendar-loading"><LoaderCircle className="spin" size={24} /></div>;
  const dailyDua = readingForDay(library, 'dua', s.today).item, dailyHadith = readingForDay(library, 'hadith', s.today).item;
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const numberQuery = kind === 'dua' ? query.trim().match(/^(?:Hisn(?:\s+al-Muslim)?[:\s]*)?(\d+[a-z]?)$/i)?.[1]?.toLowerCase() : null;
  const entries = (kind === 'dua' ? library.duas.filter(d => (category === 'all' || d.category === category) && (!favorites || s.preferences.favoriteDuas.includes(d.id))) : library.hadiths)
    .filter(item => numberQuery ? 'number' in item && item.number === numberQuery : words.every(w => normalize(`${item.title} ${item.meaning} ${item.reference} ${'arabic' in item ? `${item.arabic} ${'transliteration' in item ? item.transliteration : ''}` : ''}`).includes(w)));
  const chosen = entries.find(item => item.id === selected) ?? entries.find(item => item.id === (kind === 'dua' ? dailyDua.id : dailyHadith.id)) ?? entries[0];
  const jump = (nextKind: 'dua' | 'hadith', id: string) => { setKind(nextKind); setSelected(id); setQuery(''); setCategory('all'); setFavorites(false); };
  return <>
    <div className="reading-daily-cards"><button onClick={() => jump('dua', dailyDua.id)}><Sunrise size={22} /><span><small>TODAY'S DUA</small><strong data-source-text dir="auto">{sourceTitle(dailyDua)}</strong></span><ArrowRight size={17} /></button><button onClick={() => jump('hadith', dailyHadith.id)}><BookOpen size={22} /><span><small>TODAY'S HADITH</small><strong>{dailyHadith.title}</strong></span><ArrowRight size={17} /></button></div>
    <div className="reading-tabs" role="tablist" aria-label="Reading collections"><button role="tab" aria-selected={kind === 'dua'} onClick={() => { setKind('dua'); setQuery(''); }}>Hisnul Muslim <span>{library.duas.length}</span></button><button role="tab" aria-selected={kind === 'hadith'} onClick={() => { setKind('hadith'); setQuery(''); }}>Daily hadith collection <span>{library.hadiths.length}</span></button><button className="text-button" onClick={() => navigate('reminders')}>Daily reminder settings <ArrowRight size={14} /></button></div>
    <div className="reading-filter"><label className="reading-search"><Search size={16} /><input aria-label="Search readings" placeholder="Search a situation, meaning or Arabic phrase…" value={query} onChange={e => setQuery(e.target.value)} /></label>{kind === 'dua' && <><select aria-label="Dua category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All occasions</option>{[...new Map(library.duas.map(d => [d.category, sourceTitle(d)])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button className={`button secondary ${favorites ? 'is-favorite' : ''}`} aria-pressed={favorites} onClick={() => setFavorites(v => !v)}><Bookmark size={15} />Favorites</button></>}</div>
    <div className="reading-layout"><section className="reading-index panel" aria-label="Reading list"><p>{entries.length} {kind === 'dua' ? 'supplications' : 'narrations'}</p><div>{entries.map(item => <button key={item.id} aria-pressed={chosen?.id === item.id} onClick={() => { setSelected(item.id); reader.current?.focus({ preventScroll: true }); }}><span>{'number' in item && item.number ? `${item.number}. ` : ''}{'category' in item ? sourceTitle(item) : item.title}</span><small>{'categoryName' in item ? sourceTitle(item) : item.reference}</small></button>)}</div></section><div ref={reader} tabIndex={-1} className="reading-content">{chosen ? 'category' in chosen ? <DuaReading dua={chosen} /> : <HadithReading hadith={chosen} /> : <Panel><h2>No matching readings</h2><p>Try another search or category, or save a dua to your favorites.</p></Panel>}</div></div>
    <div className="library-credit"><p>{kind === 'dua' ? 'Hisnul Muslim (Fortress of the Muslim) by Saeed al-Qahtani. Complete edition: 132 chapters and 268 entries, including 75a and 75. Arabic, English meanings, transliteration and original references from the Sunnah.com edition supplied by majmoo-io. Reading texts are Arabic and English; interface language does not change the source wording.' : 'Original Arabic narrations and published English translations from Sunnah.com, with narration context and source references preserved.'}</p>{kind === 'dua' && <button className="text-button" onClick={() => void act(() => window.athan.openReadingSource('dua-library'))}>Source edition · AGPL-3.0 <ExternalLink size={12} /></button>}</div>
  </>;
}
