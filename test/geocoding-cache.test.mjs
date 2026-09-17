import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedSearch } from '../dist/geocoding-cache.js';

const place = { id: 2950159, name: 'Berlin', country: 'Germany', country_code: 'DE', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' };
const success = async () => new Response(JSON.stringify({ results: [place] }));
const disconnected = async () => { throw new TypeError('Failed to fetch'); };

test('desktop search cache survives a fresh store and loss of reception, with country-specific keys', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'athan-search-')), 'searches.json');
  const store = () => ({ read: async () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}, write: async value => writeFileSync(path, JSON.stringify(value)) });
  const online = await cachedSearch(' Berlin ', 'de', store(), success);
  assert.equal(online.cached, false);
  const offline = await cachedSearch('berlin', 'DE', store(), disconnected, true);
  assert.deepEqual(offline.locations, online.locations); assert.equal(offline.cached, true);
  assert.match(offline.cacheWarning, /saved search/);
  assert.equal((await cachedSearch('BERLIN', 'DE', store(), disconnected)).cached, true);
  await assert.rejects(cachedSearch('berlin', 'US', store(), disconnected, true), /No saved search/);
});

test('corrupt cache is recoverable and cache write errors are visible without losing search results', async () => {
  const result = await cachedSearch('Berlin', 'DE', { read: async () => ({ bad: 'data' }), write: async () => { throw new Error('Disk full'); } }, success);
  assert.equal(result.locations[0].timeZone, 'Europe/Berlin');
  assert.match(result.cacheWarning, /could not be saved/);
});

test('failed refresh preserves saved results and invalid queries never return a cache hit', async () => {
  let data = {};
  const store = { read: async () => data, write: async value => { data = value; } };
  await cachedSearch('Berlin', 'DE', store, success);
  const original = structuredClone(data);
  const result = await cachedSearch('Berlin', 'DE', store, async () => new Response('{}', { status: 503 }));
  assert.equal(result.cached, true); assert.deepEqual(data, original);
  await assert.rejects(cachedSearch('B', 'DE', store, success), /2–150/);
});
