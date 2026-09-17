import { createServer } from 'node:http';
import { createServer as createSecureServer, get as httpsGet } from 'node:https';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { isIP } from 'node:net';
import { certificateCovers, lanAddresses, loadServerTls } from './server-tls.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../browser-ui');
const lan = process.argv.includes('--lan');
const port = Number(process.env.ATHAN_BROWSER_PORT ?? (lan ? 4174 : 4173));
const host = lan ? '0.0.0.0' : process.env.ATHAN_BROWSER_HOST ?? '127.0.0.1';
const openRequested = process.argv.includes('--open') && !process.argv.includes('--no-open');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('ATHAN_BROWSER_PORT must be a whole number from 1 to 65535.'); process.exit(1);
}
if (!isIP(host) && !/^[a-zA-Z0-9.-]+$/.test(host)) {
  console.error('ATHAN_BROWSER_HOST must be a host name or IP address.'); process.exit(1);
}
if (!existsSync(resolve(root, 'index.html')) || !existsSync(resolve(root, 'sw.js'))) {
  console.error('Build the browser app first: npm.cmd run build:browser'); process.exit(1);
}
let browserHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
let tls;
try { tls = loadServerTls({ lan, http: process.argv.includes('--http'), projectRoot: resolve(root, '..') }); }
catch (error) { console.error(error.message); process.exit(1); }
if (tls && !certificateCovers(tls.certificate, browserHost)) {
  if (lan) browserHost = lanAddresses().find(entry => certificateCovers(tls.certificate, entry.address))?.address;
  if (!browserHost || !certificateCovers(tls.certificate, browserHost)) {
    console.error('The certificate does not cover this server address. Use the LAN launcher on a listed certificate address, supply a matching certificate, or pass --http for localhost.'); process.exit(1);
  }
}
const scheme = tls ? 'https' : 'http';
const url = `${scheme}://${isIP(browserHost) === 6 ? `[${browserHost}]` : browserHost}:${port}/`;
function showAddresses() {
  console.log(`\nOn this PC: ${url}`);
  if (tls) console.log(`HTTPS certificate: ${tls.certPath}\nThe certificate must be trusted on each connecting device. Valid until ${tls.certificate.validTo}.`);
  if (lan) {
    console.log('On another device on the same network, open one of these addresses:');
    try {
      const addresses = lanAddresses().filter(entry => !tls || certificateCovers(tls.certificate, entry.address));
      for (const { name, address } of addresses) console.log(`  ${scheme}://${address}:${port}/  (${name})`);
      if (!addresses.length) console.log('  No network address found. Connect this PC to Wi-Fi or Ethernet and restart the launcher.');
    } catch { console.log(`  Could not list addresses. Use this PC's IPv4 address with port ${port}.`); }
    console.log('Keep this PC and the server window running. If Windows Firewall asks, allow Node.js on your private network.');
    if (!tls) console.log('HTTP LAN mode: times, calendars and readings work. Automatic prayers, offline reopening and device sensors on other devices require trusted HTTPS. See README.md for HTTPS setup.');
    else console.log('Use an address covered by your certificate, trusted by each connecting device.');
  }
}
function openBrowser() {
  const executable = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(executable, [url], { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.error(`Could not open a browser automatically. Open ${url} in your browser.`));
  child.unref();
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.gz': 'application/gzip', '.mp3': 'audio/mpeg' };
const handler = async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__athan_local_server__') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ app: 'athan-browser', version: 1, host, lan, scheme })); return;
    }
    const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Content-Length': info.size,
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else createReadStream(path).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
};
let server;
try { server = tls ? createSecureServer(tls, handler) : createServer(handler); }
catch { console.error('Could not use the HTTPS certificate and private key. Check that the PEM files are valid and match.'); process.exit(1); }
server.on('error', async error => {
  if (error.code === 'EADDRINUSE' && openRequested) {
    try {
      const identity = tls ? await new Promise((resolveIdentity, reject) => {
        // Trust only the configured certificate for this self-signed local server check.
        const request = httpsGet(`${url}__athan_local_server__`, { ca: tls.cert, timeout: 1500 }, response => {
          let body = ''; response.setEncoding('utf8');
          response.on('data', chunk => { body += chunk; if (body.length > 4096) request.destroy(new Error('Unexpected server response')); });
          response.on('end', () => { try { if (response.statusCode !== 200) throw new Error('Unexpected server response'); resolveIdentity(JSON.parse(body)); } catch (e) { reject(e); } });
        });
        request.on('error', reject); request.on('timeout', () => request.destroy(new Error('Server check timed out')));
      }) : await fetch(`${url}__athan_local_server__`, { signal: AbortSignal.timeout(1500), redirect: 'error' }).then(response => { if (!response.ok) throw new Error('Unexpected server response'); return response.json(); });
      if (identity.app === 'athan-browser' && identity.version === 1 && (!lan || identity.lan === true)) {
        console.log('Athan is already being served.'); showAddresses(); openBrowser(); return;
      }
    } catch { /* An occupied port may belong to another application. */ }
  }
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Close the other server, or set ATHAN_BROWSER_PORT to another port and try again.`
    : `Could not start the local server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  showAddresses();
  console.log('\nKeep this window open. Press Ctrl+C or close the window to stop the server.\nEach browser stores its own settings, separately from the desktop app.\n');
  if (openRequested) openBrowser();
});
