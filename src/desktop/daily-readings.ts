import { dailyReading, dueDailyReminders, type ReadingAlert, type DailyReminder } from '../devotion.js';
import { dateAt } from '../dates.js';
import { Ledger } from '../storage.js';

/** A local-day claim prevents repeat notifications after restart, clock changes and DST folds. */
export function deliverDailyReadings(path: string, preferences: { dailyHadith: DailyReminder; dailyDua: DailyReminder }, now: Date, zone: string, deliver: (reading: ReadingAlert) => void) {
  const due = dueDailyReminders(preferences, now, zone);
  if (!due.length) return;
  const date = dateAt(now, zone), ledger = new Ledger(path);
  try {
    for (const kind of due) {
      const id = `daily:${kind}:${date}`;
      if (!ledger.claim(id, now, now)) continue;
      try { deliver({ ...dailyReading(kind, date), date, id }); ledger.finish(id, 'delivered'); }
      catch (error) { ledger.finish(id, 'failed', String(error)); throw error; }
    }
  } finally { ledger.close(); }
}
