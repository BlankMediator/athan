import { DatabaseSync } from 'node:sqlite';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function writeJson(path: string, value: unknown, overwrite = false): void {
  mkdirSync(dirname(path), { recursive: true });
  const content = JSON.stringify(value, null, 2) + '\n';
  if (!overwrite) { writeFileSync(path, content, { flag: 'wx' }); return; }
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, content, { flag: 'wx' }); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

export type DeliveryStatus = 'claimed' | 'delivered' | 'failed' | 'skipped' | 'dismissed';
export class Ledger {
  private db: DatabaseSync;
  private closed = false;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try { this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, scheduled TEXT NOT NULL, claimed TEXT NOT NULL,
        status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
      );`); } catch (error) { this.db.close(); throw error; }
  }
  claim(id: string, at: Date, now: Date): boolean {
    return this.db.prepare('INSERT OR IGNORE INTO deliveries(id,scheduled,claimed,status) VALUES(?,?,?,?)')
      .run(id, at.toISOString(), now.toISOString(), 'claimed').changes === 1;
  }
  finish(id: string, status: DeliveryStatus, detail = ''): void {
    this.db.prepare('UPDATE deliveries SET status=?, detail=? WHERE id=?').run(status, detail, id);
  }
  history(limit = 50) {
    return this.db.prepare('SELECT * FROM deliveries ORDER BY claimed DESC, id LIMIT ?').all(limit);
  }
  close(): void { if (!this.closed) { this.db.close(); this.closed = true; } }
}

/** Exclusive daemon lock; SQLite also atomically protects each delivery across processes. */
export function acquireLock(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const existing = JSON.parse(readFileSync(path, 'utf8')) as { pid: number };
    if (!Number.isInteger(existing.pid) || existing.pid <= 0) throw new Error(`Invalid daemon lock: ${path}`);
    let alive = true;
    try { process.kill(existing.pid, 0); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; else throw error;
    }
    if (alive) throw new Error(`Athan is already running (PID ${existing.pid})`);
    unlinkSync(path);
  }
  const token = randomUUID();
  const fd = openSync(path, 'wx');
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); } finally { closeSync(fd); }
  return () => {
    if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).token === token) unlinkSync(path);
  };
}
