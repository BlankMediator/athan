import { createHash } from 'node:crypto';
import type { Config } from './config-model.js';
import { renderCalendarIcs } from './calendar-export.js';
export { calendarRows, calendarCsv } from './calendar-export.js';
export function calendarIcs(config: Config, start: string, end: string, generated = new Date()): string {
  return renderCalendarIcs(config, start, end, key => createHash('sha256').update(key).digest('hex').slice(0, 32), generated);
}
