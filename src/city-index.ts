import type { Location } from './config-model.js';
export interface Country { code: string; name: string; cityCount: number; }
export interface CityResults { locations: Location[]; total: number; offset: number; }
export type City = [id: number, name: string, countryCode: string, latitude: number, longitude: number, timeZone: string, aliases: string];
type IndexedCity = { city: City; name: string; search: string };
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function createCitySearch(countries: Country[], rows: City[]) {
    const index = new Map<string, IndexedCity[]>();
    for (const city of rows) {
      const group = index.get(city[2]) ?? [];
      group.push({ city, name: normalize(city[1].split(',')[0]!), search: normalize(`${city[1]} ${city[6]}`) });
      index.set(city[2], group);
    }
    for (const group of index.values()) group.sort((a, b) => collator.compare(a.city[1], b.city[1]) || a.city[0] - b.city[0]);
  return (countryCode: string, query = '', offset = 0): CityResults => {
  const code = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Select a valid country');
  if (query.length > 150 || !Number.isInteger(offset) || offset < 0) throw new Error('Invalid city search');
  const country = countries.find(c => c.code === code);
  if (!country) throw new Error('Select a valid country');
  const term = normalize(query), words = term.split(' ').filter(Boolean);
  const group = index.get(code) ?? [];
  const matches = words.length ? group.filter(row => words.every(word => row.search.includes(word))) : group;
  if (words.length) {
    const rank = (row: IndexedCity) => row.name === term ? 0 : row.name.startsWith(term) ? 1 : 2;
    matches.sort((a, b) => rank(a) - rank(b) || collator.compare(a.city[1], b.city[1]) || a.city[0] - b.city[0]);
  }
  return { total: matches.length, offset, locations: matches.slice(offset, offset + 200).map(({ city }) => ({
    id: `geonames-${city[0]}`, name: city[1], country: country.name, latitude: city[3], longitude: city[4], timeZone: city[5],
  })) };
  };
}
