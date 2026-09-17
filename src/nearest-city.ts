import type { Location } from './config-model.js';
import type { City, Country } from './city-index.js';
/** Retains exact coordinates; the nearest city's zone must be reviewed before saving. */
export function nearestCatalogueCity(rows: City[], countries: Country[], latitude: number, longitude: number): { location: Location; distanceKm: number } {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 89.9 || Math.abs(longitude) > 180) throw new Error('Invalid device coordinates');
  const rad = Math.PI / 180, lat = latitude * rad;
  let nearest: City | null = null, best = Infinity;
  for (const city of rows) {
    const a = Math.sin((city[3] - latitude) * rad / 2) ** 2 + Math.cos(lat) * Math.cos(city[3] * rad) * Math.sin((city[4] - longitude) * rad / 2) ** 2;
    if (a < best) { best = a; nearest = city; }
  }
  if (!nearest) throw new Error('The city catalogue is unavailable');
  const country = countries.find(c => c.code === nearest![2]);
  return { location: { id: 'device-location', name: `Near ${nearest[1]}`.slice(0, 150), country: country?.name ?? '', latitude, longitude, timeZone: nearest[5] }, distanceKm: 12742 * Math.asin(Math.sqrt(Math.min(1, best))) };
}
