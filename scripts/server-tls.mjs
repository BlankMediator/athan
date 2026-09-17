import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';

export function lanAddresses() {
  return Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries ?? [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
    .map(entry => ({ name, address: entry.address })))
    .sort((a, b) => Number(/virtual|vethernet|tailscale|vpn|docker|wsl/i.test(a.name)) - Number(/virtual|vethernet|tailscale|vpn|docker|wsl/i.test(b.name)) || a.name.localeCompare(b.name));
}
export function certificateCovers(certificate, host) { return !!(isIP(host) ? certificate.checkIP(host) : certificate.checkHost(host)); }
export function loadServerTls({ lan, http = false, projectRoot, env = process.env }) {
  if (http) return undefined;
  let certPath = env.ATHAN_TLS_CERT, keyPath = env.ATHAN_TLS_KEY;
  if (Boolean(certPath) !== Boolean(keyPath)) throw new Error('Set both ATHAN_TLS_CERT and ATHAN_TLS_KEY, or neither.');
  if (!certPath && lan) {
    // Keys remain outside the served files. Only LAN mode auto-discovers a local certificate.
    const folders = [join(projectRoot, 'certificates'), 'D:/Certificates'];
    const folder = folders.find(folder => existsSync(join(folder, 'athan-cert.pem')) || existsSync(join(folder, 'athan-key.pem')));
    if (folder) { certPath = join(folder, 'athan-cert.pem'); keyPath = join(folder, 'athan-key.pem'); }
  }
  if (!certPath) return undefined;
  let cert, key;
  try { cert = readFileSync(certPath); key = readFileSync(keyPath); }
  catch { throw new Error('Could not read the HTTPS certificate/key pair. Check ATHAN_TLS_CERT and ATHAN_TLS_KEY or the certificates folder.'); }
  try {
    const certificate = new X509Certificate(cert);
    if (!certificate.checkPrivateKey(createPrivateKey(key))) throw new Error('The HTTPS certificate and private key do not match.');
    if (Date.now() < Date.parse(certificate.validFrom) || Date.now() > Date.parse(certificate.validTo)) throw new Error('The HTTPS certificate is not currently valid.');
    return { cert, key, certificate, certPath };
  } catch (error) {
    if (error.message.startsWith('The HTTPS')) throw error;
    throw new Error('Could not parse the HTTPS certificate/key pair. Use matching PEM files.');
  }
}
