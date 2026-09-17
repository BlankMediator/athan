import { readdirSync, readFileSync, statSync, lstatSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
const root = resolve(process.argv[2] ?? 'browser-ui');
const forbidden = /(?:^|[/\\])(?:\.athan|\.git|certificates|node_modules)(?:[/\\]|$)|\.(?:pem|key|pfx|p12|env|map)$/i;
let total = 0, count = 0;
function check(folder) {
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry), name = relative(root, path), stat = lstatSync(path);
    if (forbidden.test(name) || stat.isSymbolicLink()) throw new Error(`Private or unsupported file in Pages output: ${name}`);
    if (stat.isDirectory()) { check(path); continue; }
    if (stat.size > 100 * 1024 * 1024) throw new Error(`File exceeds the GitHub repository limit: ${name}`);
    if (/\.(?:json|html|js|txt|md)$/i.test(name) && /^-----BEGIN (?:[A-Z ]*PRIVATE KEY|CERTIFICATE)-----/m.test(readFileSync(path, 'utf8'))) throw new Error(`Unexpected certificate material: ${name}`);
    total += stat.size; count++;
  }
}
check(root);
for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', 'audio/defaults.json']) if (!statSync(join(root, file)).isFile()) throw new Error(`Missing ${file}`);
if (total > 1024 ** 3) throw new Error('The Pages site exceeds 1 GB.');
console.log(`Pages output checked: ${count} files, ${(total / 1024 ** 2).toFixed(1)} MB. No local profiles, certificate files or private keys.`);
