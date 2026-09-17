import { createSocket } from 'node:dgram';
import { parseDate } from './dates.js';
import type { Config } from './config.js';
import type { ScheduledEvent } from './scheduler.js';

export async function sendNetworkAlert(config: Config, event: ScheduledEvent): Promise<void> {
  const net = config.network;
  if (!net.enabled || event.kind !== 'athan' || !net.prayers.includes(event.prayer) ||
    !net.days.includes(parseDate(event.prayerDate).getUTCDay())) return;
  const payload = Buffer.from(JSON.stringify({ protocol: 'athan-alert-v1', id: event.id,
    prayer: event.prayer, at: event.at.toISOString(), location: event.location }));
  await Promise.all(net.targets.map(target => new Promise<void>((resolve, reject) => {
    const socket = createSocket('udp4');
    let settled = false;
    const finish = (error?: Error | null) => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      try { socket.close(); } catch { /* Socket may fail before binding. */ }
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Network alert timed out')), 5000);
    socket.once('error', finish);
    socket.send(payload, target.port, target.host, finish);
  })));
}
