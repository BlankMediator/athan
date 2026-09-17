import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadServerTls } from '../scripts/server-tls.mjs';

test('localhost remains HTTP unless explicitly configured, and HTTP override is deliberate', () => {
  assert.equal(loadServerTls({ lan: false, projectRoot: '.', env: {} }), undefined);
  assert.equal(loadServerTls({ lan: true, http: true, projectRoot: '.', env: { ATHAN_TLS_CERT: 'missing' } }), undefined);
  assert.throws(() => loadServerTls({ lan: false, projectRoot: '.', env: { ATHAN_TLS_CERT: 'missing' } }), /both/);
});
test('bad certificate configuration fails visibly instead of silently falling back to HTTP', () => {
  const folder = mkdtempSync(join(tmpdir(), 'athan-tls-'));
  writeFileSync(join(folder, 'cert.pem'), 'invalid'); writeFileSync(join(folder, 'key.pem'), 'invalid');
  assert.throws(() => loadServerTls({ lan: false, projectRoot: '.', env: { ATHAN_TLS_CERT: join(folder, 'cert.pem'), ATHAN_TLS_KEY: join(folder, 'key.pem') } }), /parse/);
});
