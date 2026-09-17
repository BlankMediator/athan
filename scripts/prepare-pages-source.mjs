import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'output/pages-source');
const directories = ['.github', 'assets', 'src', 'ui', 'scripts', 'test', 'test-browser', 'test-desktop', 'test-mobile', 'docs', 'android', 'ios'];
const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts', 'playwright.browser.config.ts', 'playwright.mobile.config.ts', '.gitignore', 'README.md', 'THIRD_PARTY.md', 'Open Athan.cmd', 'Open Athan Browser.cmd', 'Serve Athan.bat', 'Serve Athan LAN.bat', 'Build Android.cmd', 'capacitor.config.ts'];
const blocked = /(?:^|[/\\])(?:\.athan|\.git|node_modules|certificates|screenshots|\.env(?:\.[^/\\]*)?)(?:[/\\]|$)|\.(?:pem|key|pfx|p12|keystore|jks|mobileprovision|log)$/i;
const nativeGenerated = /(?:^|[/\\])(?:build|\.gradle|DerivedData|xcuserdata|public)(?:[/\\]|$)|(?:^|[/\\])local\.properties$|\.(?:apk|aab|aar|xcuserstate)$/i;
let count = 0, size = 0;
function copy(relative) {
  const source = join(root, relative), destination = join(target, relative);
  if (!existsSync(source) || blocked.test(relative) || (/^(?:android|ios)[/\\]/.test(relative) && nativeGenerated.test(relative))) return;
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Do not publish symlinks: ${relative}`);
  if (stat.isDirectory()) { mkdirSync(destination, { recursive: true }); for (const entry of readdirSync(source)) copy(join(relative, entry)); return; }
  const bytes = readFileSync(source);
  if (/\.(?:ts|tsx|js|mjs|cts|json|txt|md|html|yml|yaml)$/i.test(relative) && /^-----BEGIN (?:[A-Z ]*PRIVATE KEY|CERTIFICATE)-----/m.test(bytes.toString())) throw new Error(`Unexpected certificate material: ${relative}`);
  mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, bytes); count++; size += bytes.length;
}
mkdirSync(target, { recursive: true });
for (const path of [...directories, ...files]) copy(path);
console.log(`Prepared ${count} source files (${(size / 1024 ** 2).toFixed(1)} MB) in ${target}. Private profiles and certificates were excluded.`);
