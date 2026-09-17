import { readFile } from 'node:fs/promises';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createCitySearch, type Country, type City } from './city-index.js';
export type { Country, CityResults } from './city-index.js';
const directory = new URL('../assets/locations/', import.meta.url);
let metadata: Promise<{ countries: Country[] }> | undefined;
let catalogue: Promise<ReturnType<typeof createCitySearch>> | undefined;
export async function listCountries(): Promise<Country[]> {
  metadata ??= readFile(new URL('countries.json', directory), 'utf8').then(JSON.parse).catch(error => { metadata = undefined; throw error; });
  return (await metadata).countries.map(country => ({ ...country }));
}
export async function searchCities(countryCode: string, query = '', offset = 0) {
  catalogue ??= (async () => createCitySearch(await listCountries(), JSON.parse((await promisify(gunzip)(await readFile(new URL('cities.json.gz', directory)))).toString('utf8')) as City[]))().catch(error => { catalogue = undefined; throw error; });
  return (await catalogue)(countryCode, query, offset);
}
