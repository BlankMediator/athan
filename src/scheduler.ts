import type { Config } from './config-model.js';
import { eventsAround, type ScheduledEvent } from './events.js';
import { Ledger } from './storage.js';
import { AlertDismissedError } from './alert-dismissed.js';
export * from './events.js';

export interface TickResult { delivered: string[]; failed: string[]; skipped: string[]; dismissed: string[]; }
export class Scheduler {
  constructor(private config: Config, private ledger: Ledger) {}
  async tick(now: Date, dispatch: (event: ScheduledEvent) => Promise<void>, events = eventsAround(this.config, now)): Promise<TickResult> {
    const result: TickResult = { delivered: [], failed: [], skipped: [], dismissed: [] };
    if (!Number.isFinite(+now)) throw new Error('Invalid scheduler clock');
    const pending: Promise<void>[] = [];
    for (const event of events) {
      if (event.at > now) continue;
      const late = (+now - +event.at) / 1000;
      // Old events are recorded as skipped, not replayed together after a long sleep.
      if (!this.ledger.claim(event.id, event.at, now)) continue;
      if (late > this.config.scheduler.graceSeconds) {
        this.ledger.finish(event.id, 'skipped', `Late by ${Math.floor(late)} seconds`);
        result.skipped.push(event.id); continue;
      }
      // Claim before side effects. Overlapping ticks and process restarts cannot double-fire.
      pending.push((async () => {
        try {
          await dispatch(event);
          this.ledger.finish(event.id, 'delivered'); result.delivered.push(event.id);
        } catch (error) {
          const status = error instanceof AlertDismissedError ? 'dismissed' : 'failed';
          this.ledger.finish(event.id, status, String(error)); result[status].push(event.id);
        }
      })());
    }
    await Promise.all(pending);
    return result;
  }
}
