import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { defaultConfig, Ledger, Scheduler, eventsForDay, acquireLock, readConfig, writeJson, importLegacy } from '../dist/index.js';

function temporary(t) {
  const root = resolve(tmpdir()), directory = mkdtempSync(join(root, 'athan-test-'));
  t.resources = [];
  t.after(() => { for (const resource of t.resources) resource.close(); assert.ok(resolve(directory).startsWith(root + sep)); rmSync(directory, { recursive: true, force: true }); }); return directory;
}
function setup(t) {
  const directory = temporary(t), path = join(directory, 'ledger.sqlite');
  const config = defaultConfig(), ledger = new Ledger(path), scheduler = new Scheduler(config, ledger);
  t.resources.push(ledger); const events = eventsForDay(config, '2026-09-13');
  return { config, ledger, scheduler, events, path };
}
test('fires at the exact time, never early or twice across repeated polls', async t => {
  const { scheduler, events, ledger } = setup(t); const event = events[0]; let count = 0;
  await scheduler.tick(new Date(+event.at - 1), async () => { count++; }, [event]); assert.equal(count, 0);
  await scheduler.tick(event.at, async () => { count++; }, [event]);
  await scheduler.tick(new Date(+event.at + 1000), async () => { count++; }, [event]);
  assert.equal(count, 1); assert.equal(ledger.history()[0].status, 'delivered');
});
test('grace boundary catches short sleep, while stale calls are skipped', async t => {
  const { scheduler, events, ledger } = setup(t); let count = 0;
  await scheduler.tick(new Date(+events[0].at + 90000), async () => count++, [events[0]]);
  await scheduler.tick(new Date(+events[1].at + 90001), async () => count++, [events[1]]);
  assert.equal(count, 1); assert.equal(ledger.history().find(row => row.id === events[1].id).status, 'skipped');
});
test('a restart does not replay delivered or failed events', async t => {
  const { scheduler, events, path } = setup(t); const event = events[0]; let calls = 0;
  await scheduler.tick(event.at, async () => { calls++; throw new Error('missing speaker'); }, [event]);
  const second = new Ledger(path); t.resources.push(second);
  await new Scheduler(defaultConfig(), second).tick(event.at, async () => { calls++; }, [event]);
  assert.equal(calls, 1); assert.equal(second.history()[0].status, 'failed'); assert.match(second.history()[0].detail, /missing speaker/);
});
test('a crash after claim is preserved as uncertain, preventing repeat playback', async t => {
  const { ledger, scheduler, events } = setup(t); const event = events[0];
  ledger.claim(event.id, event.at, event.at); let calls = 0;
  await scheduler.tick(event.at, async () => { calls++; }, [event]); assert.equal(calls, 0); assert.equal(ledger.history()[0].status, 'claimed');
});
test('overlapping ticks and independent connections claim an event once', async t => {
  const { scheduler, events, path } = setup(t); const second = new Ledger(path); t.resources.push(second);
  let calls = 0, release; const blocked = new Promise(r => release = r), event = events[0];
  const first = scheduler.tick(event.at, async () => { calls++; await blocked; }, [event]);
  await new Scheduler(defaultConfig(), second).tick(event.at, async () => { calls++; }, [event]);
  assert.equal(calls, 1); release(); await first;
});
test('backward clock changes and changed offsets do not replay the same prayer', async t => {
  const { scheduler, events } = setup(t); let count = 0; const e = events[0];
  await scheduler.tick(e.at, async () => count++, [e]);
  await scheduler.tick(new Date(+e.at - 3600000), async () => count++, [e]);
  await scheduler.tick(new Date(+e.at + 60000), async () => count++, [{ ...e, at: new Date(+e.at + 60000) }]);
  assert.equal(count, 1);
});
test('midnight rollover gives tomorrow prayers distinct durable IDs', async t => {
  const { scheduler, events, config } = setup(t), tomorrow = eventsForDay(config, '2026-09-14'); let count = 0;
  for (const e of [events[0], tomorrow[0]]) await scheduler.tick(e.at, async () => count++, [e]);
  assert.equal(count, 2);
});
test('corrupt ledger fails closed instead of resetting duplicate history', t => {
  const path = join(temporary(t), 'bad.sqlite'); writeFileSync(path, 'broken database'); assert.throws(() => new Ledger(path));
});
test('daemon lock blocks a second runner and can be reacquired after release', t => {
  const path = join(temporary(t), 'daemon.lock'); const release = acquireLock(path);
  assert.throws(() => acquireLock(path), /already running/); release(); acquireLock(path)(); assert.equal(existsSync(path), false);
});
test('config paths are relative to the config file and writes refuse accidental replacement', t => {
  const directory = temporary(t), path = join(directory, 'settings.json'), c = defaultConfig(); c.audio.prayers.fajr.file = 'sounds/fajr.wav';
  writeJson(path, c); assert.throws(() => writeJson(path, c));
  assert.equal(readConfig(path).audio.prayers.fajr.file, join(directory, 'sounds/fajr.wav'));
  c.calculation.madhab = 'Hanafi'; writeJson(path, c, true); assert.equal(readConfig(path).calculation.madhab, 'Hanafi');
});
test('legacy import overlays user settings and references existing audio without copying it', t => {
  const root = temporary(t), install = join(root, 'install'), overlay = join(root, 'overlay');
  for (const p of ['city', 'sound/otherprayers', 'sound/fajr']) mkdirSync(join(install, p), { recursive: true });
  mkdirSync(join(overlay, 'city'), { recursive: true });
  writeFileSync(join(install, 'city/selectedCity'), 'Coburg');
  writeFileSync(join(install, 'city/Coburg'), '__Coburg__Australia__Victoria__***-37.75__144.9__10***');
  writeFileSync(join(overlay, 'city/Coburg'), '__Coburg__Australia__Victoria__***-37.75__144.9667__10***');
  writeFileSync(join(install, 'sound/selectedAthan'), 'Egypt.wma;Egypt.wma;No_Athan.wma;Egypt.wma;Egypt.wma');
  writeFileSync(join(install, 'sound/otherprayers/Egypt.wma'), 'fixture');
  const { config, warnings } = importLegacy(install, { virtualRoot: overlay, timeZone: 'Australia/Melbourne', method: 'MuslimWorldLeague' });
  assert.equal(config.locations[0].longitude, 144.9667); assert.equal(config.audio.prayers.asr.enabled, false);
  assert.equal(config.audio.prayers.fajr.file, join(install, 'sound/otherprayers/Egypt.wma')); assert.ok(warnings.length);
});
