import { readFile } from 'node:fs/promises';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { listCountries } from './city-catalogue.js';
import { nearestCatalogueCity } from './nearest-city.js';
import type { City } from './city-index.js';
let rows: Promise<City[]> | undefined;
export async function nearestCity(latitude: number, longitude: number) {
  rows ??= readFile(new URL('../assets/locations/cities.json.gz', import.meta.url)).then(promisify(gunzip)).then(b => JSON.parse(b.toString()) as City[]).catch(error => { rows = undefined; throw error; });
  return nearestCatalogueCity(await rows, await listCountries(), latitude, longitude);
}
