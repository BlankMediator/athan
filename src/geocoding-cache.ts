import { z } from 'zod';
import { locationSchema } from './config-model.js';
import { searchOnline } from './geocoding.js';

const entrySchema = z.object({ savedAt: z.string().datetime(), attribution: z.string(), locations: z.array(locationSchema) });
export type SearchCache = Record<string, z.infer<typeof entrySchema>>;
export interface SearchCacheStore { read(): Promise<unknown>; write(value: SearchCache): Promise<void>; }
export function parseSearchCache(value: unknown): SearchCache {
  const parsed = z.record(z.string(), entrySchema).safeParse(value);
  return parsed.success ? parsed.data : {};
}
/** Cache only validated results. A failed lookup must never erase a useful result. */
export async function cachedSearch(query: string, country: string | undefined, store: SearchCacheStore,
  fetcher: typeof fetch = fetch, offline = false) {
  if (query.trim().length < 2 || query.length > 150) throw new Error('Enter a city name or postal code of 2–150 characters');
  if (country && !/^[A-Za-z]{2}$/.test(country)) throw new Error('Country code must be two letters, e.g. AU');
  const key = `${country?.toUpperCase() ?? ''}:${query.trim().normalize('NFKC').toLowerCase()}`;
  const cache = parseSearchCache(await store.read().catch(() => ({})));
  const saved = cache[key];
  const fallback = () => ({ ...saved!, cached: true, cacheWarning: `Showing a saved search from ${saved!.savedAt.slice(0, 10)}. Online lookup is unavailable.` });
  if (offline && saved) return fallback();
  try {
    if (offline) throw new Error('No saved search for this query. Use the built-in cities or enter coordinates while offline.');
    const result = await searchOnline(query, country, fetcher);
    const savedAt = new Date().toISOString();
    try {
      // Re-read after the network request so independent searches retain each other's results.
      const latest = parseSearchCache(await store.read().catch(() => ({})));
      const entries = Object.entries({ ...latest, [key]: { ...result, savedAt } }).sort((a, b) => b[1].savedAt.localeCompare(a[1].savedAt));
      await store.write(Object.fromEntries(entries.slice(0, 100)));
    } catch { return { ...result, cached: false, cacheWarning: 'This search could not be saved. Save your selected location before going offline.' }; }
    return { ...result, cached: false };
  } catch (error) { if (saved) return fallback(); throw error; }
}
