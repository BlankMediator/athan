import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { listCountries, searchCities } from '../dist/city-catalogue.js';

test('bundled city data has usable coordinates, unique IDs and supported IANA zones', () => {
  const rows = JSON.parse(gunzipSync(readFileSync(new URL('../assets/locations/cities.json.gz', import.meta.url))));
  const metadata = JSON.parse(readFileSync(new URL('../assets/locations/countries.json', import.meta.url)));
  assert.equal(rows.length, metadata.cityCount);
  assert.ok(rows.length > 200000);
  const ids = new Set(), zones = new Set(), counts = new Map();
  for (const [id, name, country, lat, lon, zone] of rows) {
    assert.ok(Number.isInteger(id) && !ids.has(id)); ids.add(id);
    assert.ok(name.length > 0 && name.length <= 150);
    assert.ok(Number.isFinite(lat) && lat >= -89.9 && lat <= 89.9);
    assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180);
    zones.add(zone); counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  for (const zone of zones) assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: zone }));
  for (const country of metadata.countries) assert.equal(counts.get(country.code) ?? 0, country.cityCount);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), rows.length);
});

test('country browsing is paginated without duplicates and rejects invalid inputs', async () => {
  const countries = await listCountries();
  assert.equal(countries.find(c => c.code === 'AU').name, 'Australia');
  const first = await searchCities('au'), second = await searchCities('AU', '', 200);
  assert.equal(first.total, countries.find(c => c.code === 'AU').cityCount);
  assert.equal(first.locations.length, 200); assert.equal(second.offset, 200);
  assert.ok(second.locations.every(l => !first.locations.some(p => p.id === l.id)));
  assert.ok([...first.locations, ...second.locations].every(l => l.country === 'Australia'));
  assert.equal((await searchCities('AU', '', first.total)).locations.length, 0);
  await assert.rejects(searchCities('ZZ'), /valid country/);
  await assert.rejects(searchCities('../AU'), /valid country/);
  await assert.rejects(searchCities('AU', 'x'.repeat(151)), /Invalid city/);
  await assert.rejects(searchCities('AU', '', -1), /Invalid city/);
});

test('worldwide search supports country boundaries, alternate names and diacritics', async () => {
  for (const [country, name, zone] of [['AU', 'Coburg', 'Australia/Melbourne'], ['DE', 'Berlin', 'Europe/Berlin'], ['GB', 'London', 'Europe/London'], ['PK', 'Karachi', 'Asia/Karachi'], ['SA', 'Makkah', 'Asia/Riyadh'], ['BR', 'Sao Paulo', 'America/Sao_Paulo']]) {
    const matches = await searchCities(country, name);
    assert.ok(matches.locations.some(l => l.timeZone === zone), `${country}: ${name}`);
  }
  assert.deepEqual((await searchCities('BR', 'São Paulo')).locations, (await searchCities('BR', 'Sao Paulo')).locations);
  assert.ok((await searchCities('DE', 'Berlin')).locations.every(l => l.country === 'Germany'));
  assert.equal((await searchCities('AU', 'zzzzzzunknownplace')).total, 0);
});
