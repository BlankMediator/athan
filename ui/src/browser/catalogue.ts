import { createCitySearch, type City, type Country } from '../../../src/city-index.js';
import { nearestCatalogueCity } from '../../../src/nearest-city.js';
let metadata: Promise<Country[]> | undefined;
let catalogue: Promise<ReturnType<typeof createCitySearch>> | undefined;
let cityRows: Promise<City[]> | undefined;
async function get(path: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}locations/${path}`);
  if (!response.ok) throw new Error('City catalogue is not downloaded yet. Reconnect once to finish offline setup; saved locations still work.');
  return response;
}
export function countries() {
  metadata ??= get('countries.json').then(r => r.json()).then(r => r.countries as Country[]).catch(error => { metadata = undefined; throw error; });
  return metadata;
}
export async function cities(code: string, query = '', offset = 0) {
  catalogue ??= rows().then(async value => createCitySearch(await countries(), value)).catch(error => { catalogue = undefined; throw error; });
  return (await catalogue)(code, query, offset);
}
function rows() {
  cityRows ??= get('cities.json.gz').then(response => new Response(response.body!.pipeThrough(new DecompressionStream('gzip'))).json() as Promise<City[]>).catch(error => { cityRows = undefined; throw error; });
  return cityRows;
}
export async function nearestCity(latitude: number, longitude: number) { return nearestCatalogueCity(await rows(), await countries(), latitude, longitude); }
