import { z } from 'zod';
import { locationSchema } from './config-model.js';

const placeSchema = z.object({
  id: z.number().int(), name: z.string(), country: z.string().optional(), admin1: z.string().optional(),
  country_code: z.string().optional(), latitude: z.number(), longitude: z.number(), timezone: z.string(),
});
const responseSchema = z.object({ results: z.array(z.unknown()).default([]) });

/** Optional setup-time lookup only. The scheduler never calls a web service. */
export async function searchOnline(query: string, countryCode?: string, fetcher: typeof fetch = fetch) {
  if (query.trim().length < 2 || query.length > 150) throw new Error('Enter a city name or postal code of 2–150 characters');
  if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) throw new Error('Country code must be two letters, e.g. AU');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim()); url.searchParams.set('count', '20'); url.searchParams.set('language', 'en');
  if (countryCode) url.searchParams.set('countryCode', countryCode.toUpperCase());
  let response: Response, content: string;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
    content = await response.text();
  }
  catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
    throw new Error(`City lookup is unavailable (${cause?.code ?? (error instanceof Error ? error.name : 'network error')}). Check internet access; saved locations and prayer times still work offline.`);
  }
  if (!response.ok) throw new Error(`City lookup failed: HTTP ${response.status}`);
  if (content.length > 200000) throw new Error('City lookup response is unexpectedly large');
  let parsed: z.infer<typeof responseSchema>;
  try { parsed = responseSchema.parse(JSON.parse(content)); }
  catch { throw new Error('The city service returned an unreadable response. Please try again.'); }
  const locations = parsed.results.flatMap(value => {
    const result = placeSchema.safeParse(value);
    if (!result.success) return [];
    const place = result.data;
    if (countryCode && place.country_code && place.country_code.toUpperCase() !== countryCode.toUpperCase()) return [];
    const location = locationSchema.safeParse({ id: `geonames-${place.id}`,
      name: [place.name, place.admin1].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      country: place.country ?? '', latitude: place.latitude, longitude: place.longitude, timeZone: place.timezone });
    return location.success ? [location.data] : [];
  });
  if (parsed.results.length && !locations.length) throw new Error('No usable city locations were returned. Try a more specific city name or enter coordinates manually.');
  return { attribution: 'Location data: GeoNames, served by Open-Meteo (https://open-meteo.com/en/docs/geocoding-api)',
    locations };
}
