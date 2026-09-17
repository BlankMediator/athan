import { spawn } from 'node:child_process';
import { get } from 'node:https';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { certificateCovers, lanAddresses, loadServerTls } from './server-tls.mjs';
const tls = loadServerTls({ lan: true, projectRoot: resolve('.') });
assert.ok(tls, 'Add the local certificate/key pair before checking HTTPS.');
const address = lanAddresses().find(entry => certificateCovers(tls.certificate, entry.address))?.address;
assert.ok(address, 'The certificate must cover an active LAN address.');
const port = '4186';
const server = spawn(process.execPath, ['scripts/serve-browser.mjs', '--lan', '--no-open'], { cwd: resolve('.'), env: { ...process.env, ATHAN_BROWSER_PORT: port }, windowsHide: true });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HTTPS server did not start')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('On this PC:')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => { clearTimeout(timer); reject(new Error(String(data))); });
    server.on('error', reject);
  });
  const request = path => new Promise((resolve, reject) => {
    const req = get(`https://${address}:${port}${path}`, { ca: tls.cert }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('HTTPS request timed out')));
  });
  const identity = await request('/__athan_local_server__');
  assert.equal(identity.status, 200); assert.equal(JSON.parse(identity.body).scheme, 'https');
  assert.equal((await request('/')).status, 200);
  assert.equal((await request('/audio/defaults.json')).status, 200);
  assert.equal((await request('/certificates/athan-key.pem')).status, 404);
  assert.equal((await request('/.athan/config.json')).status, 404);
  console.log(`HTTPS verified with certificate trust and hostname validation at https://${address}:${port}/. Certificate/key pair matches; private files are not served.`);
} finally { server.kill(); }
