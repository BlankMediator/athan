import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import { defaultConfig, eventsForDay, sendNetworkAlert } from '../dist/index.js';

test('opt-in network transport sends the versioned event to a loopback receiver', { timeout: 5000 }, async t => {
  const receiver = createSocket('udp4');
  t.after(() => receiver.close());
  await new Promise((resolve, reject) => { receiver.once('error', reject); receiver.bind(0, '127.0.0.1', resolve); });
  const config = defaultConfig(); config.network.enabled = true;
  config.network.targets = [{ host: '127.0.0.1', port: receiver.address().port }];
  const event = eventsForDay(config, '2026-09-13')[0];
  const message = new Promise(resolve => receiver.once('message', data => resolve(JSON.parse(data.toString()))));
  await sendNetworkAlert(config, event);
  assert.deepEqual(await message, { protocol: 'athan-alert-v1', id: event.id, prayer: 'fajr', at: event.at.toISOString(), location: event.location });
});
test('network disabled and per-prayer filters do not resolve or contact configured hosts', async () => {
  const config = defaultConfig(); config.network.targets = [{ host: 'invalid.invalid', port: 45845 }];
  const event = eventsForDay(config, '2026-09-13')[0];
  await sendNetworkAlert(config, event);
  config.network.enabled = true; config.network.prayers = ['isha']; await sendNetworkAlert(config, event);
  config.network.prayers = ['fajr']; config.network.days = []; await sendNetworkAlert(config, event);
});
