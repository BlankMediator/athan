import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlertDismissedError, AudioQueue, defaultConfig, eventsForDay, runService, Ledger, addDays, dateAt } from '../dist/index.js';

test('dismissal stops the active sequence and queued repeats but permits a later Athan', async () => {
  const calls = [], first = new AbortController(), queued = new AbortController();
  const queue = new AudioQueue((file, options) => {
    calls.push(file);
    return file === 'current' ? new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('player stopped')), { once: true })) : Promise.resolve('played');
  });
  const options = { volume: 0, maxSeconds: 30 };
  const active = assert.rejects(queue.enqueue(['current', 'dua'], 3, 'athan', { ...options, signal: first.signal }), AlertDismissedError);
  const waiting = assert.rejects(queue.enqueue(['queued'], 3, 'reminder', { ...options, signal: queued.signal }), AlertDismissedError);
  first.abort(new AlertDismissedError()); queued.abort(new AlertDismissedError());
  await Promise.all([active, waiting]);
  await queue.enqueue(['later-athan', 'later-dua'], 1, 'athan', options);
  assert.deepEqual(calls, ['current', 'later-athan', 'later-dua']);
  await queue.stop();
});

test('dismissing while a trigger is being delivered prevents audio and persists across restart', async () => {
  const state = mkdtempSync(join(tmpdir(), 'athan-dismiss-'));
  const config = defaultConfig(); config.audio.prayers.fajr.file = 'fajr'; config.audio.duaFile = 'dua';
  const event = eventsForDay(config, addDays(dateAt(new Date(), 'Australia/Melbourne'), 1))[0];
  let controls, plays = 0;
  try {
    await runService(config, state, { once: true, now: event.at, quiet: true, player: async () => { plays++; return ''; },
      onReady: value => { controls = value; }, onEvent: value => { if (value.type === 'trigger') controls.dismissAlerts([value.event.id]); } });
    assert.equal(plays, 0);
    const ledger = new Ledger(join(state, 'deliveries.sqlite'));
    try { assert.equal(ledger.history(100).find(row => row.id === event.id).status, 'dismissed'); } finally { ledger.close(); }
    await runService(config, state, { once: true, now: event.at, quiet: true, player: async () => { plays++; return ''; } });
    assert.equal(plays, 0);
    const log = readFileSync(join(state, 'events.jsonl'), 'utf8');
    assert.match(log, /"type":"dismissed"/); assert.doesNotMatch(log, /"type":"failed"/);
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('service dismissal aborts playback without reporting a failed call or playing its dua', async () => {
  const state = mkdtempSync(join(tmpdir(), 'athan-dismiss-playing-'));
  const config = defaultConfig(); config.audio.prayers.fajr.file = 'fajr'; config.audio.duaFile = 'dua';
  const event = eventsForDay(config, addDays(dateAt(new Date(), 'Australia/Melbourne'), 1))[0];
  let controls;
  const played = [];
  try {
    await runService(config, state, { once: true, now: event.at, quiet: true, onReady: value => { controls = value; },
      player: (file, { signal }) => new Promise((resolve, reject) => {
        played.push(file); signal.addEventListener('abort', () => reject(new Error('stopped')));
        controls.dismissAlerts();
      }) });
    assert.deepEqual(played, ['fajr']);
    const ledger = new Ledger(join(state, 'deliveries.sqlite'));
    try { assert.equal(ledger.history(100).find(row => row.id === event.id).status, 'dismissed'); } finally { ledger.close(); }
  } finally { rmSync(state, { recursive: true, force: true }); }
});
