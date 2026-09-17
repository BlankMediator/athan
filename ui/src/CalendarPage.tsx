import { t, tr, getLocale } from './i18n/runtime';
import { useEffect, useRef, useState } from 'react';
import { calendarPeriod, monthForDate, nextMonth, type CalendarMonth, type CalendarKind } from '../../src/calendar-period.js';
import { isBrowser } from './browser/offline';
import { ArrowRight, ArrowLeftRight, CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, FolderOpen, FileText, LoaderCircle, Moon, Sparkles } from 'lucide-react';
import type { Day, ConvertedDate } from '../../src/desktop/types.js';
import type { CalendarPdfOptions } from '../../src/calendar-print.js';
import { HIJRI_MONTHS, type CalendarEvent } from '../../src/calendar.js';
import { Field, hijriDateText as hijriText, labels, longDate, Modal, Panel, PrayerIcon, time, times, useApp } from './shared';

const errorText = (error: unknown) => String(error).replace(/^Error: (?:Error invoking remote method '[^']+': Error: )?/, '');
const shortName = (event: CalendarEvent) => t(event.name.split(' (')[0]!);
const eventNote = (event: CalendarEvent) => event.name.includes('(') ? t(event.name.slice(event.name.indexOf('('))).slice(1, -1) : t('Estimated Islamic date');

function CalendarSwitch({ value, change }: { value: CalendarKind; change: (calendar: CalendarKind) => void }) {
  return <div className="converter-tabs calendar-mode" aria-label="Calendar system">{(['gregorian', 'hijri'] as const).map(calendar => <button type="button" key={calendar} aria-pressed={value === calendar} onClick={() => change(calendar)}>{calendar === 'hijri' ? 'Hijri' : 'Gregorian'}</button>)}</div>;
}
function MonthPicker({ value, change }: { value: CalendarMonth; change: (value: CalendarMonth) => void }) {
  const [yearText, setYearText] = useState(String(value.year));
  useEffect(() => setYearText(String(value.year)), [value.year]);
  return value.calendar === 'gregorian' ? <Field label="Go to month"><input aria-label="Go to month" type="month" required min="1901-01" max="2098-12" value={`${value.year}-${String(value.month).padStart(2, '0')}`} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) change({ ...value, year: +e.target.value.slice(0, 4), month: +e.target.value.slice(5) }); }} /></Field> : <div className="hijri-fields"><Field label="Hijri month"><select value={value.month} onChange={e => change({ ...value, month: +e.target.value })}>{HIJRI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field><Field label="Hijri year"><input type="number" required min="1" max="9999" value={yearText} onChange={e => { setYearText(e.target.value); if (/^\d{4}$/.test(e.target.value)) change({ ...value, year: +e.target.value }); }} onBlur={() => setYearText(String(value.year))} /></Field></div>;
}

function DateConverter({ chosen, jump }: { chosen: Day | undefined; jump: (date: string) => void }) {
  const { snapshot: s } = useApp();
  const [direction, setDirection] = useState<'gregorian' | 'hijri'>('gregorian');
  const [gregorian, setGregorian] = useState(s.today), [hijri, setHijri] = useState(s.day.hijri);
  const [result, setResult] = useState<ConvertedDate | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const request = useRef(0);
  const reset = () => { request.current++; setResult(null); setError(''); setLoading(false); };
  useEffect(() => { reset(); return () => { request.current++; }; }, [s.config.hijriAdjustment]);
  const convert = async () => {
    const id = ++request.current; setLoading(true); setError(''); setResult(null);
    try {
      const value = await window.athan.convertDate(direction === 'gregorian' ? { calendar: 'gregorian', date: gregorian } : { calendar: 'hijri', year: hijri.year, month: hijri.month, day: hijri.day });
      if (id === request.current) setResult(value);
    } catch (e) { if (id === request.current) setError(errorText(e)); }
    finally { if (id === request.current) setLoading(false); }
  };
  return <Panel title="Two calendars, one day" subtitle="Convert a date, then find it in your calendar." className="converter-panel">
    <div className="converter-tabs">{(['gregorian', 'hijri'] as const).map(value => <button type="button" key={value} aria-pressed={direction === value} onClick={() => { reset(); setDirection(value); }}>{value === 'gregorian' ? 'Gregorian → Hijri' : 'Hijri → Gregorian'}</button>)}</div>
    <form onSubmit={e => { e.preventDefault(); void convert(); }}>
      {direction === 'gregorian' ? <Field label="Gregorian date"><input type="date" required min="1901-01-01" max="2098-12-31" value={gregorian} onChange={e => { reset(); setGregorian(e.target.value); }} /></Field> : <div className="hijri-fields">
        <Field label="Hijri day"><input required type="number" min="1" max="30" value={hijri.day} onChange={e => { reset(); setHijri({ ...hijri, day: +e.target.value }); }} /></Field>
        <Field label="Hijri month"><select value={hijri.month} onChange={e => { reset(); setHijri({ ...hijri, month: +e.target.value }); }}>{HIJRI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
        <Field label="Hijri year"><input required type="number" min="1" max="9999" value={hijri.year} onChange={e => { reset(); setHijri({ ...hijri, year: +e.target.value }); }} /></Field>
      </div>}
      <div className="converter-actions"><button className="button secondary" type="submit" disabled={loading}>{loading ? <LoaderCircle size={16} className="spin" /> : <ArrowLeftRight size={16} />}Convert date</button><button className="text-button" type="button" disabled={!chosen} onClick={() => { if (chosen) { reset(); setGregorian(chosen.date); setHijri(chosen.hijri); } }}>Use selected day</button></div>
    </form>
    {error && <p role="alert" className="inline-warning">{error}</p>}
    {result && <div className="conversion-result" role="status"><small>{direction === 'gregorian' ? longDate(result.gregorian, { day: 'numeric', month: 'long', year: 'numeric' }) : hijriText(result.hijri)}</small><strong>{direction === 'gregorian' ? hijriText(result.hijri) : longDate(result.gregorian, { day: 'numeric', month: 'long', year: 'numeric' })}</strong><button className="text-button" onClick={() => jump(result.gregorian)}>Show in calendar <ArrowRight size={14} /></button></div>}
    <p className="calendar-fine-print"><span>Umm al-Qura calendar</span>{s.config.hijriAdjustment ? ` · ${tr('{0} day correction', `${s.config.hijriAdjustment > 0 ? '+' : ''}${s.config.hijriAdjustment}`)}` : ''}. <span>Local moon sightings may differ.</span></p>
  </Panel>;
}

function ExportCalendar({ month, hijriYear, close }: { month: CalendarMonth; hijriYear: number; close: () => void }) {
  const { act, busy, snapshot: s } = useApp();
  const [layout, setLayout] = useState<CalendarPdfOptions['layout']>('month'), [year, setYear] = useState(month.year), [selectedMonth, setMonth] = useState(month);
  const [saved, setSaved] = useState('');
  const layouts = [
    { id: 'month', title: 'Monthly prayer timetable', hint: 'One A4 page · daily prayer times and Hijri dates' },
    { id: 'ramadan', title: 'Ramadan timetable', hint: 'One A4 page · suhoor, iftar and all prayer times' },
    { id: 'year', title: 'Year at a glance', hint: 'One A3 landscape page · twelve months and key events' },
    { id: 'year-timetables', title: 'Full year of prayer times', hint: 'Twelve A4 pages · one monthly timetable per page' },
  ] as const;
  const options = (): CalendarPdfOptions => layout === 'month' ? { layout, ...selectedMonth } : { layout, year, calendar: layout === 'ramadan' ? 'hijri' : selectedMonth.calendar };
  return <Modal title="A calendar to keep close" close={close} wide>
    <p className="modal-intro">Print a beautiful timetable for your fridge, desk or prayer space. Times use your saved location and calculation settings.</p>
    <CalendarSwitch value={selectedMonth.calendar} change={calendar => { const next = monthForDate(calendarPeriod(selectedMonth, s.config.hijriAdjustment).start, calendar, s.config.hijriAdjustment); setMonth(next); setYear(layout === 'ramadan' ? hijriYear : next.year); setSaved(''); }} /><div className="export-layouts">{layouts.map(item => <button type="button" key={item.id} aria-pressed={layout === item.id} onClick={() => { setLayout(item.id); setYear(item.id === 'ramadan' ? hijriYear : selectedMonth.year); setSaved(''); }}><FileText size={21} /><span><strong>{item.title}</strong><small>{item.hint}</small></span></button>)}</div>
    <form onSubmit={e => { e.preventDefault(); void act(async () => { const file = await window.athan.exportPdf(options()); if (file) setSaved(file); }); }}>
      {layout === 'month' ? <MonthPicker value={selectedMonth} change={value => { setMonth(value); setSaved(''); }} /> : <Field label={layout === 'ramadan' ? 'Ramadan Hijri year' : selectedMonth.calendar === 'hijri' ? 'Hijri year to print' : 'Gregorian year to print'}><input type="number" required min={1} max={9999} value={year} onChange={e => { setYear(+e.target.value); setSaved(''); }} /></Field>}
      <p className="calendar-fine-print">PDFs include both calendars, event notes and your time zone. Ramadan and Islamic event dates remain subject to local moon sightings.</p>
      {saved && <div className="pdf-saved"><p role="status">{isBrowser ? saved : tr('Saved to {0}', saved)}</p>{!isBrowser && <div className="export-actions"><button type="button" className="button secondary small" onClick={() => void act(() => window.athan.exportedFile(saved, 'open'))}><ExternalLink size={15} />Open file</button><button type="button" className="button secondary small" onClick={() => void act(() => window.athan.exportedFile(saved, 'reveal'))}><FolderOpen size={15} />Show in folder</button></div>}</div>}
      <footer className="modal-footer"><button className="button ghost" type="button" onClick={close}>Close</button><button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{isBrowser ? 'Print / Save PDF' : 'Save PDF'}</button></footer>
    </form>
    <div className="other-exports"><span>Other formats for {selectedMonth.calendar === 'hijri' ? `${t(HIJRI_MONTHS[selectedMonth.month - 1]!)} ${selectedMonth.year} ${t('AH')}` : `${selectedMonth.month} / ${selectedMonth.year}`}</span><button className="text-button" disabled={busy} onClick={() => void act(async () => { const file = await window.athan.exportCalendar(selectedMonth, 'ics'); if (file) setSaved(file); })}>Calendar file (.ics)</button><button className="text-button" disabled={busy} onClick={() => void act(async () => { const file = await window.athan.exportCalendar(selectedMonth, 'csv'); if (file) setSaved(file); })}>Spreadsheet (.csv)</button></div>
  </Modal>;
}

export function CalendarPage() {
  const { snapshot: s, act } = useApp();
  const [month, setMonth] = useState(() => monthForDate(s.today, s.preferences.calendar, s.config.hijriAdjustment)), [days, setDays] = useState<Day[]>([]), [selected, setSelected] = useState(s.today);
  const [events, setEvents] = useState<CalendarEvent[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [exporting, setExporting] = useState(false);
  const [eventYear, setEventYear] = useState(s.day.hijri.year), [keyEvents, setKeyEvents] = useState<CalendarEvent[]>([]), [eventError, setEventError] = useState(''), [eventsLoading, setEventsLoading] = useState(false);
  const eventList = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null), focusDate = useRef(false);
  const calendarConfig = JSON.stringify(s.config);
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setDays([]); setEvents([]);
    void window.athan.calendarMonth(month).then(value => { if (live) { setDays(value.days); setEvents(value.events); } }).catch(e => { if (live) setError(errorText(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [JSON.stringify(month), calendarConfig]);
  useEffect(() => {
    let live = true; setKeyEvents([]); setEventError(''); setEventsLoading(true);
    void window.athan.calendarEvents(eventYear).then(value => { if (live) setKeyEvents(value); }).catch(e => { if (live) setEventError(errorText(e)); }).finally(() => { if (live) setEventsLoading(false); });
    return () => { live = false; };
  }, [eventYear, s.config.hijriAdjustment]);
  useEffect(() => { if (focusDate.current && days.some(d => d.date === selected)) { document.getElementById(`calendar-${selected}`)?.focus({ preventScroll: true }); focusDate.current = false; } }, [days, selected]);
  const jump = (date: string) => {
    if (date < '1901-01-01' || date > '2098-12-31') { setError('Choose a date between 1901 and 2098'); return; }
    focusDate.current = true; document.getElementById(`calendar-${date}`)?.focus({ preventScroll: true }); setSelected(date); setMonth(monthForDate(date, month.calendar, s.config.hijriAdjustment)); toolbar.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };
  const move = (delta: number) => { try { jump(calendarPeriod(nextMonth(month, delta), s.config.hijriAdjustment).start); } catch (e) { setError(errorText(e)); } };
  const switchCalendar = (calendar: CalendarKind) => { setMonth(monthForDate(chosen?.date ?? selected, calendar, s.config.hijriAdjustment)); void act(() => window.athan.preferences({ calendar })); };
  useEffect(() => { const list = eventList.current; if (!list || !keyEvents.length) return; const index = keyEvents.findIndex(e => e.date >= s.today); const item = list.children[index < 0 ? keyEvents.length - 1 : index] as HTMLElement | undefined; if (item) list.scrollTop = item.offsetTop - (list.clientHeight - item.clientHeight) / 2; }, [keyEvents, s.today]);
  const chosen = days.find(d => d.date === selected) ?? days[0], blanks = (new Date(`${days[0]?.date ?? s.today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const chosenEvents = events.filter(e => e.date === chosen?.date);
  return <>
    <div className="calendar-toolbar" ref={toolbar}><div><button className="icon-button" aria-label="Previous month" disabled={days[0]?.date === '1901-01-01'} onClick={() => move(-1)}><ChevronLeft size={18} /></button><div><h2>{month.calendar === 'hijri' ? `${t(HIJRI_MONTHS[month.month - 1]!)} ${month.year} ${t('AH')}` : longDate(`${month.year}-${String(month.month).padStart(2, '0')}-01`, { month: 'long', year: 'numeric' })}</h2><p className="calendar-hijri-range">{month.calendar === 'hijri' && days[0] ? `${longDate(days[0].date, { day: 'numeric', month: 'short' })} – ${longDate(days.at(-1)!.date, { day: 'numeric', month: 'short', year: 'numeric' })}` : days[0] ? `${t(HIJRI_MONTHS[days[0].hijri.month - 1]!)}${days.at(-1)!.hijri.month !== days[0].hijri.month ? ` / ${t(HIJRI_MONTHS[days.at(-1)!.hijri.month - 1]!)}` : ''} ${days[0].hijri.year === days.at(-1)!.hijri.year ? days[0].hijri.year : `${days[0].hijri.year}–${days.at(-1)!.hijri.year}`} ${t('AH')}` : 'Your Gregorian and Hijri calendar'}</p></div><button className="icon-button" aria-label="Next month" disabled={days.at(-1)?.date === '2098-12-31'} onClick={() => move(1)}><ChevronRight size={18} /></button><button className="button ghost small" onClick={() => jump(s.today)}>This month</button></div><button className="button secondary" onClick={() => setExporting(true)}><Download size={16} />Export calendar</button></div>
    <div className="calendar-jump"><CalendarSwitch value={month.calendar} change={switchCalendar} /><MonthPicker value={month} change={value => { try { jump(calendarPeriod(value, s.config.hijriAdjustment).start); } catch(e) { setError(errorText(e)); } }} /></div>
    <div className="calendar-layout"><section className="calendar-panel panel"><div className="weekdays">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(w => <span key={w}>{w}</span>)}</div>
      {loading ? <div className="calendar-loading"><LoaderCircle className="spin" size={24} /></div> : error ? <p className="inline-warning" role="alert">{error}</p> : <div className="month-grid">{Array.from({ length: blanks }, (_, i) => <span className="calendar-blank" key={`blank${i}`} />)}{days.map(day => { const dayEvents = events.filter(e => e.date === day.date); return <button key={day.date} id={`calendar-${day.date}`} onClick={() => setSelected(day.date)} aria-label={`View ${day.date}${dayEvents.length ? `, ${dayEvents.map(shortName).join(', ')}` : ''}`} aria-pressed={chosen?.date === day.date} title={`${hijriText(day.hijri)}${dayEvents.length ? ` · ${dayEvents.map(e => `${shortName(e)} · ${eventNote(e)}`).join(' · ')}` : ''}`} className={`calendar-day ${chosen?.date === day.date ? 'selected' : ''} ${day.date === s.today ? 'today' : ''} ${day.hijri.month === 9 ? 'ramadan' : ''} ${dayEvents.length ? 'has-event' : ''}`}><span>{month.calendar === 'hijri' ? day.hijri.day : +day.date.slice(-2)}</span><small>{month.calendar === 'hijri' ? +day.date.slice(-2) : day.hijri.day}{month.calendar === 'gregorian' && day.hijri.day === 1 ? ` ${t(HIJRI_MONTHS[day.hijri.month - 1]!)}` : ''}</small>{dayEvents.length ? <span className="calendar-event-mark"><Sparkles size={11} /></span> : day.date === s.today ? <i /> : null}</button>; })}</div>}
      <footer><span><i className="small-dot" /> Today</span><span><Sparkles size={11} /> Key event</span><span className="ramadan-key">Ramadan</span><span className="muted">Small numerals · {month.calendar === 'hijri' ? 'Gregorian' : 'Hijri'}</span></footer>
    </section><aside className="calendar-detail panel"><span className="eyebrow">YOUR DAILY TIMETABLE</span><h2>{chosen ? longDate(chosen.date, { weekday: 'long' }) : ''}</h2><p>{chosen ? longDate(chosen.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p><div className="selected-hijri"><Moon size={15} />{chosen ? hijriText(chosen.hijri) : ''}</div>
      {chosenEvents.map(event => <div key={event.name} className="selected-event"><Sparkles size={14} /><div><strong>{shortName(event)}</strong><small>{eventNote(event)}</small></div></div>)}
      <div className="calendar-prayers">{chosen && times.map(prayer => <div key={prayer}><PrayerIcon prayer={prayer} size={20} /><span>{labels[prayer]}</span><strong>{time(chosen.times[prayer], s)}</strong></div>)}</div>{chosen && <div className="duha-window compact"><strong>Duha / Ishraq</strong><span dir="ltr"><bdi>{time(chosen.ishraq, s)}</bdi> – <bdi>{time(chosen.duhaEnd, s)}</bdi></span><small>Estimated voluntary prayer window</small></div>}<button className="text-button" onClick={() => setExporting(true)}>Print this month <Download size={14} /></button>
    </aside></div>
    <div className="calendar-tools"><DateConverter chosen={chosen} jump={jump} /><Panel title="Key Islamic events" subtitle="Choose an event to jump to its date in the main calendar." className="key-events-panel"><div className="event-year"><span>Hijri year</span><button className="icon-button" aria-label="Previous event year" onClick={() => setEventYear(y => y - 1)}><ChevronLeft size={16} /></button><strong>{eventYear} AH</strong><button className="icon-button" aria-label="Next event year" onClick={() => setEventYear(y => y + 1)}><ChevronRight size={16} /></button><button className="text-button" onClick={() => setEventYear(s.day.hijri.year)}>Current year</button></div>
      {eventsLoading ? <p className="calendar-fine-print" role="status">Loading events…</p> : eventError ? <p role="alert" className="inline-warning">{eventError}</p> : <div className="key-events-list" ref={eventList}>{keyEvents.map(event => <button key={`${event.date}-${event.name}`} className={selected === event.date ? 'selected' : ''} onClick={() => jump(event.date)} aria-label={`Show ${shortName(event)} in calendar`}><span className="event-date"><strong>{+event.date.slice(-2)}</strong><small>{longDate(event.date, { month: 'short' })}</small></span><span><strong>{shortName(event)}</strong><small>{event.day} {t(HIJRI_MONTHS[event.month - 1]!)} · {event.date.slice(0, 4)}{event.name.includes('(') ? ` · ${eventNote(event)}` : ''}</small></span><ArrowRight size={15} /></button>)}</div>}
    </Panel></div>
    <p className="calendar-fine-print calendar-estimates">Islamic dates begin at the preceding sunset. Events are estimated using Umm al-Qura and your saved Hijri correction; local moon sightings may differ. Laylat al-Qadr’s exact night is not known.</p>
    {exporting && <ExportCalendar month={month} hijriYear={chosen?.hijri.year ?? s.day.hijri.year} close={() => setExporting(false)} />}
  </>;
}
