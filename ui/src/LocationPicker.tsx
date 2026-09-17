import { getLocale, tr, t } from './i18n/runtime';
import { useEffect, useRef, useState } from 'react';
import { Globe2, LoaderCircle, MapPin, Search } from 'lucide-react';
import type { Location } from '../../src/config.js';
import type { CityResults, Country } from '../../src/city-catalogue.js';
import { Field, Panel } from './shared';

const message = (error: unknown) => String(error).replace(/^Error: (?:Error invoking remote method '[^']+': Error: )?/, '');

export function LocationPicker({ location, choose }: { location: Location; choose: (place: Location) => void }) {
  const [countries, setCountries] = useState<Country[]>([]), [country, setCountry] = useState('');
  const [query, setQuery] = useState(''), [result, setResult] = useState<CityResults | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [online, setOnline] = useState<Location[] | null>(null), [onlineLoading, setOnlineLoading] = useState(false), [onlineError, setOnlineError] = useState('');
  const [selected, setSelected] = useState(''), [cacheNote, setCacheNote] = useState('');
  const generation = useRef(0), initialCountry = useRef(location.country), onlineRequest = useRef(0);
  const localRequest = useRef(0);

  useEffect(() => {
    let active = true;
    void window.athan.countries().then(items => {
      if (!active) return;
      setCountries(items);
      setCountry(items.find(c => c.name.toLowerCase() === initialCountry.current.toLowerCase())?.code ?? '');
    }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; generation.current++; onlineRequest.current++; localRequest.current++; };
  }, []);

  const resetSearch = () => {
    generation.current++; onlineRequest.current++; localRequest.current++;
    setResult(null); setOnline(null); setError(''); setOnlineError('');
    setOnlineLoading(false); setSelected(''); setCacheNote('');
  };

  useEffect(() => {
    if (!country) { setLoading(false); return; }
    const current = generation.current, request = ++localRequest.current;
    setLoading(true);
    const timer = setTimeout(() => {
      void window.athan.cities(country, query.trim()).then(value => {
        if (current === generation.current && request === localRequest.current) setResult(value);
      }).catch(e => {
        if (current === generation.current && request === localRequest.current) setError(message(e));
      }).finally(() => {
        if (current === generation.current && request === localRequest.current) setLoading(false);
      });
    }, query ? 180 : 0);
    return () => { clearTimeout(timer); localRequest.current++; };
  }, [country, query]);

  const more = async () => {
    if (!result) return;
    const current = generation.current, request = ++localRequest.current;
    setLoading(true); setError('');
    try {
      const value = await window.athan.cities(country, query.trim(), result.locations.length);
      if (current === generation.current && request === localRequest.current) setResult(previous => previous ? { ...value, locations: [...previous.locations, ...value.locations] } : value);
    } catch (e) { if (current === generation.current && request === localRequest.current) setError(message(e)); }
    finally { if (current === generation.current && request === localRequest.current) setLoading(false); }
  };

  const searchOnline = async () => {
    if (query.trim().length < 2 || !country) return;
    const current = generation.current, request = ++onlineRequest.current;
    setOnline(null); setOnlineError(''); setCacheNote(''); setOnlineLoading(true); setSelected('');
    try {
      const value = await window.athan.search(query.trim(), true, country);
      if (current === generation.current && request === onlineRequest.current) { setOnline(value.locations); setCacheNote(value.cacheWarning ?? ''); }
    } catch (e) {
      if (current === generation.current && request === onlineRequest.current) setOnlineError(`${message(e)} Built-in cities remain available below.`);
    } finally { if (current === generation.current && request === onlineRequest.current) setOnlineLoading(false); }
  };

  const cities = online ?? result?.locations ?? [];
  const selectedCountry = countries.find(c => c.code === country);
  return <Panel title="Find your location" subtitle="Choose a country, then a city. The built-in catalogue works offline.">
    <div className="form-grid country-city-filters">
      <Field label="Country or territory"><select value={country} onChange={e => { resetSearch(); setLoading(Boolean(e.target.value)); setCountry(e.target.value); setQuery(''); }}>
        <option value="">Choose a country…</option>
        {countries.map(c => <option key={c.code} value={c.code}>{new Intl.DisplayNames([getLocale()], { type: 'region' }).of(c.code) ?? c.name}</option>)}
      </select></Field>
      <Field label="Filter cities" hint="Type a city, suburb or region to narrow the list."><div className="city-filter"><Search size={17} /><input aria-label="Filter cities" disabled={!country} maxLength={150} placeholder="Start typing a city…" value={query} onChange={e => { resetSearch(); setLoading(true); setQuery(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /></div></Field>
    </div>
    <div className="city-list-heading"><span><MapPin size={15} />{online !== null ? 'Online results' : selectedCountry ? tr('Cities in {0}', new Intl.DisplayNames([getLocale()], { type: 'region' }).of(selectedCountry.code) ?? selectedCountry.name) : 'City'}</span>
      <small role="status">{loading && !result ? 'Loading cities…' : online !== null ? `${online.length} matches` : result ? `${result.total.toLocaleString(getLocale())} cities${result.total > result.locations.length ? ` · showing ${result.locations.length.toLocaleString(getLocale())}` : ''}` : ''}</small>
    </div>
    <select className="city-list" aria-label="City" size={6} value={selected} disabled={!cities.length} onChange={e => { const place = cities.find(c => c.id === e.target.value); if (place) { setSelected(place.id); choose(place); } }}>
      <option value="" disabled>{!country ? 'Choose a country first' : loading && !result ? 'Loading cities…' : !cities.length ? 'No matching cities — try online search or enter coordinates below' : 'Select a city…'}</option>
      {cities.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
    </select>
    <div className="city-list-actions">
      {online === null && result && result.total > result.locations.length && <button type="button" className="button secondary" disabled={loading} onClick={() => void more()}>{loading && <LoaderCircle size={14} className="spin" />}Show more cities</button>}
      {online !== null && <button type="button" className="button secondary" onClick={() => { setOnline(null); setSelected(''); }}>Back to built-in cities</button>}
      <button type="button" className="button secondary online-city-search" disabled={!country || query.trim().length < 2 || onlineLoading} onClick={() => void searchOnline()}>{onlineLoading ? <LoaderCircle size={15} className="spin" /> : <Globe2 size={15} />}{onlineLoading ? 'Searching online…' : 'Search online'}</button>
    </div>
    {error && <p className="inline-warning" role="alert">{error}</p>}
    {cacheNote && <p className="city-lookup-note" role="status">{cacheNote}</p>}
    {onlineError && <p className="inline-warning" role="alert">{onlineError}</p>}
    <p className="city-lookup-note">Can’t find your city? Type its name and search online, or enter coordinates below. Online search sends the typed name and selected country to Open-Meteo.</p>
    <p className="city-attribution">Location data © GeoNames · CC BY 4.0{online !== null ? ' · Online results served by Open-Meteo' : ' · Built-in cities and towns with 500+ residents, plus administrative centres'}</p>
  </Panel>;
}
