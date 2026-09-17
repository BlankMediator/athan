import test from 'node:test';
import assert from 'node:assert/strict';
import { searchOnline, athanText, PRAYER_UNITS } from '../dist/index.js';

test('online lookup encodes the query and validates usable coordinates and zones', async () => {
  const result = await searchOnline('Coburg, Victoria', 'au', async url => {
    assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
    assert.equal(url.searchParams.get('name'), 'Coburg, Victoria'); assert.equal(url.searchParams.get('countryCode'), 'AU');
    return new Response(JSON.stringify({ results: [{ id: 1, name: 'Coburg', admin1: 'Victoria', country: 'Australia', latitude: -37.75, longitude: 144.9667, timezone: 'Australia/Melbourne' }] }));
  });
  assert.equal(result.locations[0].timeZone, 'Australia/Melbourne'); assert.match(result.attribution, /GeoNames/);
});
test('online lookup handles no results, remote errors and unusable data', async () => {
  assert.deepEqual((await searchOnline('missing', undefined, async () => new Response('{}'))).locations, []);
  await assert.rejects(searchOnline('query', undefined, async () => new Response('', { status: 503 })), /HTTP 503/);
  await assert.rejects(searchOnline('query', undefined, async () => new Response('{"results":[{"id":1}]}')));
  await assert.rejects(searchOnline('query', undefined, async () => { throw new Error('fetch failed', { cause: { code: 'ETIMEDOUT' } }); }), /ETIMEDOUT.*offline/);
  await assert.rejects(searchOnline('x')); await assert.rejects(searchOnline('London', 'United Kingdom'));
});
test('one incomplete online match does not discard valid cities or bypass the country filter', async () => {
  const sydney = { id: 2147714, name: 'Sydney', country: 'Australia', country_code: 'AU', latitude: -33.87, longitude: 151.21, timezone: 'Australia/Sydney' };
  const result = await searchOnline('Sydney', 'AU', async () => new Response(JSON.stringify({ results: [
    sydney, { ...sydney, id: 2, timezone: undefined }, { ...sydney, id: 3, timezone: 'Not/AZone' },
    { ...sydney, id: 4, latitude: 200 }, { ...sydney, id: 5, country_code: 'CA' },
  ] })));
  assert.equal(result.locations.length, 1); assert.equal(result.locations[0].id, 'geonames-2147714');
  await assert.rejects(searchOnline('Sydney', 'AU', async () => new Response(JSON.stringify({ results: [{ ...sydney, timezone: undefined }] }))), /No usable city locations/);
  await assert.rejects(searchOnline('Sydney', 'AU', async () => new Response('<html>Unavailable</html>')), /unreadable response/);
});

test('Athan text includes Fajr-only addition and obligatory prayer units', () => {
  assert.equal(athanText(false).length, 7); assert.equal(athanText(true).length, 8);
  assert.equal(athanText(true).find(line => line.arabic === 'الصلاة خير من النوم').repetitions, 2);
  assert.deepEqual(PRAYER_UNITS.map(p => p.obligatory), [2, 4, 4, 3, 4]);
});
