import { appendFileSync, existsSync, mkdirSync, statSync, renameSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { AudioQueue, validateAudio, type playFile } from './audio.js';
import { AlertDismissedError } from './alert-dismissed.js';
import { activeLocation, PRAYERS, type Config } from './config.js';
import { dateAt } from './dates.js';
import { sendNetworkAlert } from './network.js';
import { eventsAround, Scheduler, type ScheduledEvent } from './scheduler.js';
import { acquireLock, Ledger, writeJson } from './storage.js';

export function requestStop(stateDir: string): void {
  const lock = join(stateDir, 'daemon.lock');
  if (!existsSync(lock)) throw new Error('Athan Core is not running in this state directory');
  const owner = JSON.parse(readFileSync(lock, 'utf8')) as { pid: number; token: string };
  if (!Number.isInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== 'string') throw new Error('Invalid daemon lock');
  process.kill(owner.pid, 0); // Check existence; never terminate an unrelated process.
  writeJson(join(stateDir, 'stop.request.json'), owner, true);
}

export function doctor(config: Config) {
  const checks: { check: string; ok: boolean; detail: string }[] = [];
  checks.push({ check: 'Configuration', ok: true, detail: `${activeLocation(config).name}; ${config.calculation.method}; ${config.calculation.madhab}` });
  checks.push({ check: 'Native audio', ok: process.platform === 'win32' || !config.audio.enabled, detail: process.platform });
  const files = new Set([config.audio.duaFile, config.audio.startupEnabled ? config.audio.startupFile : null,
    ...PRAYERS.filter(p => config.audio.prayers[p].enabled).map(p => config.audio.prayers[p].file),
    ...config.reminders.filter(r => r.enabled).map(r => r.file)].filter((f): f is string => f !== null));
  for (const file of files) {
    try { validateAudio(file); checks.push({ check: 'Recording', ok: true, detail: file }); }
    catch (error) { checks.push({ check: 'Recording', ok: false, detail: String(error) }); }
  }
  for (const prayer of PRAYERS) if (config.audio.enabled && config.audio.prayers[prayer].enabled && !config.audio.prayers[prayer].file)
    checks.push({ check: `${prayer} audio`, ok: false, detail: 'No recording selected; event will be logged silently' });
  return checks;
}

export interface ServiceControls { dismissAlerts(ids?: readonly string[]): void; }
export interface ServiceOptions {
  once?: boolean; now?: Date; dryRun?: boolean; signal?: AbortSignal;
  quiet?: boolean; playStartup?: boolean; onReady?: (controls: ServiceControls) => void; onEvent?: (event: Record<string, unknown>) => void;
  player?: typeof playFile;
}
export async function runService(config: Config, stateDir: string, options: ServiceOptions = {}) {
  if (options.now && !options.once) throw new Error('--at is only supported with --once');
  const initial = options.now ?? new Date();
  if (options.dryRun) {
    const due = eventsAround(config, initial).filter(e => e.at <= initial && +initial - +e.at <= config.scheduler.graceSeconds * 1000);
    console.log(JSON.stringify({ dryRun: true, at: initial, events: due }, null, 2)); return;
  }
  mkdirSync(stateDir, { recursive: true });
  const release = acquireLock(join(stateDir, 'daemon.lock'));
  const owner = JSON.parse(readFileSync(join(stateDir, 'daemon.lock'), 'utf8')) as { token: string };
  const stopPath = join(stateDir, 'stop.request.json');
  let ledger: Ledger;
  try { ledger = new Ledger(join(stateDir, 'deliveries.sqlite')); } catch (error) { release(); throw error; }
  const queue = new AudioQueue(options.player), scheduler = new Scheduler(config, ledger);
  const active = new Map<string, AbortController>();
  const controls: ServiceControls = { dismissAlerts: ids => {
    for (const id of ids ?? [...active.keys()]) active.get(id)?.abort(new AlertDismissedError());
  } };
  const logFile = join(stateDir, 'events.jsonl');
  const log = (value: object) => {
    if (existsSync(logFile) && statSync(logFile).size > 5_000_000) renameSync(logFile, `${logFile}.1`);
    const line = JSON.stringify({ loggedAt: new Date(), ...value });
    appendFileSync(logFile, line + '\n');
    if (!options.quiet) console.log(line);
    options.onEvent?.(value as Record<string, unknown>);
  };
  const dispatch = async (event: ScheduledEvent) => {
    const controller = new AbortController(); active.set(event.id, controller);
    const checkDismissed = () => { if (controller.signal.aborted) throw controller.signal.reason; };
    try {
      log({ type: 'trigger', event });
      checkDismissed();
      const failures: string[] = [];
      try { await sendNetworkAlert(config, event); } catch (error) { failures.push(String(error)); }
      checkDismissed();
      if (config.audio.enabled && event.files.length) {
        try {
          await queue.enqueue(event.files, event.repeat, event.kind,
            { volume: config.audio.volume, maxSeconds: config.audio.maxPlaybackSeconds, signal: controller.signal },
            +event.at + config.scheduler.graceSeconds * 1000);
        } catch (error) { checkDismissed(); failures.push(String(error)); }
      }
      checkDismissed();
      log({ type: failures.length ? 'failed' : 'completed', id: event.id, failures });
      if (failures.length) throw new Error(failures.join('; '));
    } catch (error) {
      if (error instanceof AlertDismissedError) log({ type: 'dismissed', id: event.id });
      throw error;
    } finally { active.delete(event.id); }
  };
  const inFlight = new Set<Promise<unknown>>();
  let cachedDay = '', cachedEvents: ScheduledEvent[] = [];
  const tick = async (now: Date) => {
    const day = dateAt(now, activeLocation(config).timeZone);
    if (cachedDay !== day) { cachedEvents = eventsAround(config, now); cachedDay = day; }
    const pending = scheduler.tick(now, dispatch, cachedEvents);
    inFlight.add(pending); void pending.finally(() => inFlight.delete(pending)).catch(() => {});
    return pending;
  };
  let timer: NodeJS.Timeout | undefined;
  let onSignal: () => void = () => {};
  try {
    if (options.signal?.aborted) return;
    log({ type: 'started', pid: process.pid, location: activeLocation(config).name });
    options.onReady?.(controls);
    if (options.once) {
      const result = await tick(initial);
      if (result.failed.length) throw new Error(`${result.failed.length} event(s) failed; inspect history`);
      return;
    }
    // Launch initial tick immediately. Polling continues while recordings are playing.
    void tick(initial).catch(error => { log({ type: 'scheduler-error', error: String(error) }); onSignal(); });
    if (options.playStartup !== false && config.audio.enabled && config.audio.startupEnabled && config.audio.startupFile) {
      const controller = new AbortController(); active.set('startup', controller);
      log({ type: 'startup-audio-started' });
      void queue.enqueue([config.audio.startupFile], 1, 'startup',
        { volume: config.audio.volume, maxSeconds: config.audio.maxPlaybackSeconds, signal: controller.signal })
        .then(() => log({ type: 'startup-audio-completed' }))
        .catch(error => log({ type: error instanceof AlertDismissedError ? 'startup-audio-dismissed' : 'startup-audio-error', error: String(error) }))
        .finally(() => active.delete('startup'));
    }
    await new Promise<void>(resolve => {
      onSignal = resolve;
      options.signal?.addEventListener('abort', onSignal, { once: true });
      if (options.signal?.aborted) { resolve(); return; }
      process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
      timer = setInterval(() => {
        if (existsSync(stopPath)) {
          try {
            const request = JSON.parse(readFileSync(stopPath, 'utf8')) as { token: string };
            if (request.token === owner.token) { unlinkSync(stopPath); resolve(); return; }
          } catch (error) { log({ type: 'stop-request-error', error: String(error) }); }
        }
        void tick(new Date()).catch(error => { log({ type: 'scheduler-error', error: String(error) }); resolve(); });
      }, config.scheduler.pollSeconds * 1000);
    });
  } finally {
    if (timer) clearInterval(timer);
    process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
    options.signal?.removeEventListener('abort', onSignal);
    await queue.stop(); await Promise.allSettled(inFlight); ledger.close(); release();
  }
}
