import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { playFile } from '../dist/audio.js';

test('Windows player pauses without consuming its playback limit, then resumes', { skip: process.platform !== 'win32', timeout: 25000 }, async () => {
  const folder = resolve('test-results'); mkdirSync(folder, { recursive: true });
  const path = join(mkdtempSync(join(folder, 'native-pause-')), 'silent.wav');
  const wav = Buffer.alloc(44 + 8000 * 3 * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40); writeFileSync(path, wav);
  let pause, completed = false;
  const abort = new AbortController();
  const result = playFile(path, { volume: 0, maxSeconds: 1, signal: abort.signal, onControl: control => { pause = control; pause(true); } }).then(output => { completed = true; return output; });
  // Attach a failure handler immediately while Windows opens its media decoder.
  void result.catch(() => {});
  try {
    await delay(3500); assert.equal(completed, false);
    pause(false); assert.match(await result, /duration=3/);
  } finally { abort.abort(); }
});
