import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Explicit import step: normal builds use these prepared assets and never read a user's profile.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] ?? join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Athan/sound');
const destination = join(root, 'assets/audio');
mkdirSync(destination, { recursive: true });
const inputs = [
  ['fajr-mishary', 'Mishary Rashid — Fajr', 'fajr/RashidMishary_Fajr.wma'],
  ['al-aqsa', 'Al-Aqsa', 'otherprayers/Alaqsa.wma'],
  ['egypt', 'Egypt', 'otherprayers/Egypt.wma'],
  ['madina', 'Madina', 'otherprayers/Madina.wma'],
  ['makkah', 'Makkah', 'otherprayers/Makkah.wma'],
  ['dua', 'Dua after Athan', 'dua/dua.wma'],
  ['bismillah', 'Bismillah', 'bismillah/Bismillah.wma'],
];
const recordings = inputs.map(([id, name, relative]) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(source, relative), '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3', 'pipe:1'], { windowsHide: true, maxBuffer: 25 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Could not convert ${relative}: ${result.error?.message ?? result.stderr.toString()}`);
  const bytes = result.stdout, sha256 = createHash('sha256').update(bytes).digest('hex');
  const path = `audio/${id}-${sha256.slice(0, 12)}.mp3`;
  writeFileSync(join(root, 'assets', path), bytes);
  console.log(`${name}: ${Math.round(bytes.length / 1024)} KB`);
  return { id: `default/${id}`, name, path, bytes: bytes.length, sha256, source: relative };
});
writeFileSync(join(destination, 'defaults.json'), JSON.stringify({ version: 1, recordings,
  defaults: { fajr: 'default/fajr-mishary', dhuhr: 'default/al-aqsa', asr: 'default/egypt', maghrib: 'default/egypt', isha: 'default/egypt', dua: 'default/dua', startup: 'default/bismillah' },
  provenance: 'Converted to MP3 from the recordings supplied in the existing Athan installation at the user’s request. The recording credits and original filenames are preserved; no new licence is asserted.',
}, null, 2) + '\n');
