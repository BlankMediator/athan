import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { defaultConfig, writeJson, Ledger, runService, eventsForDay, requestStop } from '../dist/index.js';

function context(t) {
  const root = resolve(tmpdir()), directory = mkdtempSync(join(root, 'athan-cli-test-'));
  t.after(() => { assert.ok(resolve(directory).startsWith(root + sep)); rmSync(directory, { recursive: true, force: true }); });
  const path = join(directory, 'config.json'), state = join(directory, 'state');
  writeJson(path, defaultConfig());
  const run = (...args) => spawnSync(process.execPath, ['dist/cli.js', '--config', path, '--state', state, ...args], { encoding: 'utf8' });
  return { run, path, directory, state };
}
test('CLI times produces JSON and dry run does not create scheduler state', t => {
  const { run, state } = context(t), times = run('times', '2026-09-13', '--json');
  assert.equal(times.status, 0, times.stderr); const day = JSON.parse(times.stdout);
  const result = run('run', '--once', '--dry-run', '--at', day.times.fajr);
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).events.length, 1);
  assert.equal(existsSync(state), false);
});
test('CLI refuses malformed dates, unknown settings and simulated live playback', t => {
  const { run } = context(t);
  assert.equal(run('times', '2026-02-30').status, 1);
  assert.equal(run('locations', 'use', 'missing').status, 1);
  assert.equal(run('run', '--once', '--at', '2026-09-13T00:00:00Z').status, 1);
});
test('CLI creates a full month calendar and refuses to overwrite an existing export', t => {
  const { run, directory } = context(t), out = join(directory, 'month.ics');
  const result = run('calendar', '--month', '2026-09', '--format', 'ics', '--out', out);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((readFileSync(out, 'utf8').match(/BEGIN:VEVENT/g) ?? []).length, 150);
  assert.equal(run('calendar', '--month', '2026-09', '--out', out).status, 1);
});
test('service once connects dispatch, SQLite history, log and lock cleanup with silent audio', async t => {
  const { state } = context(t); const config = defaultConfig(); config.audio.enabled = false;
  const event = eventsForDay(config, '2026-09-13')[0];
  await runService(config, state, { once: true, now: event.at });
  assert.equal(existsSync(join(state, 'daemon.lock')), false);
  const ledger = new Ledger(join(state, 'deliveries.sqlite'));
  try { assert.equal(ledger.history(100).find(row => row.id === event.id).status, 'delivered'); } finally { ledger.close(); }
  assert.match(readFileSync(join(state, 'events.jsonl'), 'utf8'), /completed/);
});
test('a background scheduler exits cleanly through the stop request', { timeout: 10000 }, async t => {
  const { path, state } = context(t), config = defaultConfig(); config.audio.enabled = false; config.scheduler.pollSeconds = 1;
  writeJson(path, config, true);
  const child = spawn(process.execPath, ['dist/cli.js', '--config', path, '--state', state, 'run'], { windowsHide: true });
  const ended = new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  try {
    await new Promise((resolve, reject) => {
      child.stdout.on('data', data => { if (data.toString().includes('started')) resolve(); });
      child.once('error', reject); child.once('exit', code => reject(new Error(`Exited before starting: ${code}`)));
    });
    requestStop(state); assert.equal(await ended, 0);
    assert.equal(existsSync(join(state, 'daemon.lock')), false);
    assert.equal(existsSync(join(state, 'stop.request.json')), false);
  } finally { if (child.exitCode === null) child.kill(); await ended.catch(() => {}); }
});
