import { spawn } from 'node:child_process';
import { statSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// Fixed script; file names are supplied as JSON data on stdin, never interpolated into executable text.
const PLAYER_SCRIPT = `
$ErrorActionPreference = 'Stop'
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
try {
  $player.Volume = [double]$request.volume / 100
  $player.Open([Uri]::new([string]$request.file, [UriKind]::Absolute))
  $clock = [Diagnostics.Stopwatch]::StartNew()
  while (-not $player.NaturalDuration.HasTimeSpan) {
    if ($clock.Elapsed.TotalSeconds -gt 15) { throw 'Audio could not be decoded within 15 seconds' }
    Start-Sleep -Milliseconds 50
  }
  $duration = $player.NaturalDuration.TimeSpan.TotalSeconds
  if ($duration -le 0) { throw 'Audio file has no playable duration' }
  [Console]::Out.WriteLine(('duration=' + $duration))
  $player.Play()
  $clock.Restart()
  $limit = [Math]::Min($duration + 0.25, [double]$request.maxSeconds)
  $paused = $false
  while ($clock.Elapsed.TotalSeconds -lt $limit) {
    if ($request.controlFile) {
      $line = ''
      try { $line = [IO.File]::ReadAllText([string]$request.controlFile) } catch [IO.IOException] { }
      if ($line -eq 'pause' -and -not $paused) { $player.Pause(); $clock.Stop(); $paused = $true }
      elseif ($line -eq 'resume' -and $paused) { $player.Play(); $clock.Start(); $paused = $false }
    }
    Start-Sleep -Milliseconds 50
  }
  $player.Stop()
} finally { $player.Close() }
`;

export interface PlayOptions { volume: number; maxSeconds: number; signal?: AbortSignal; onControl?: (pause: (paused: boolean) => void) => void; }
export function validateAudio(path: string): void {
  const file = statSync(path);
  if (!file.isFile() || file.size === 0) throw new Error(`Audio file is missing or empty: ${path}`);
}
export function playFile(path: string, options: PlayOptions): Promise<string> {
  if (!Number.isFinite(options.volume) || options.volume < 0 || options.volume > 100 ||
    !Number.isFinite(options.maxSeconds) || options.maxSeconds < 1 || options.maxSeconds > 3600)
    throw new Error('Invalid playback volume or duration');
  validateAudio(path);
  if (process.platform !== 'win32') throw new Error('Native playback currently requires Windows; calculation and dry runs work on other platforms.');
  if (options.signal?.aborted) return Promise.reject(new Error('Playback cancelled'));
  return new Promise((resolvePromise, reject) => {
    const controlDirectory = options.onControl ? mkdtempSync(join(tmpdir(), 'athan-player-')) : null;
    const controlFile = controlDirectory ? join(controlDirectory, 'state') : null;
    if (controlFile) writeFileSync(controlFile, 'resume');
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden',
      '-EncodedCommand', Buffer.from(PLAYER_SCRIPT, 'utf16le').toString('base64')],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    const stop = () => child.kill();
    let timeout = setTimeout(stop, (options.maxSeconds + 25) * 1000);
    options.signal?.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', data => { output = (output + String(data)).slice(-4096); });
    child.stderr.on('data', data => { error = (error + String(data)).slice(-4096); });
    child.stdin.on('error', () => { /* process error/close supplies the useful failure */ });
    child.once('error', reject);
    child.once('close', code => {
      clearTimeout(timeout); options.signal?.removeEventListener('abort', stop);
      if (controlFile && controlDirectory) { try { unlinkSync(controlFile); rmdirSync(controlDirectory); } catch { /* Never remove anything beyond our two temporary paths. */ } }
      if (code === 0 && !options.signal?.aborted) resolvePromise(output.trim());
      else reject(new Error(options.signal?.aborted ? 'Playback cancelled' : `Audio playback failed (${code}): ${error}`));
    });
    child.stdin.end(JSON.stringify({ file: resolve(path), volume: options.volume, maxSeconds: options.maxSeconds, controlFile }));
    if (options.onControl) options.onControl(paused => {
      if (child.killed || child.exitCode !== null) return;
      clearTimeout(timeout);
      if (!paused) timeout = setTimeout(stop, (options.maxSeconds + 25) * 1000);
      if (controlFile) writeFileSync(controlFile, paused ? 'pause' : 'resume');
    });
  });
}

/** A prayer interrupts a reminder; two prayers never mix. All files in a sequence stay together. */
export class AudioQueue {
  private idle: Promise<void> = Promise.resolve();
  private draining = false;
  private items: { files: string[]; repeat: number; kind: string; options: PlayOptions; expiresAt: number;
    resolve: () => void; reject: (error: unknown) => void }[] = [];
  private current: { kind: string; controller: AbortController } | undefined;
  private closed = false;
  constructor(private player: typeof playFile = playFile, private clock: () => number = Date.now) {}
  enqueue(files: string[], repeat: number, kind: 'athan' | 'reminder' | 'startup', options: PlayOptions,
    expiresAt = Infinity): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Audio queue stopped'));
    if (kind === 'athan' && this.current && this.current.kind !== 'athan') this.current.controller.abort();
    const result = new Promise<void>((resolve, reject) => {
      this.items.push({ files, repeat, kind, options, expiresAt, resolve, reject });
      this.items.sort((a, b) => Number(a.kind !== 'athan') - Number(b.kind !== 'athan'));
    });
    if (!this.draining) { this.draining = true; this.idle = this.drain(); }
    return result;
  }
  private async drain(): Promise<void> {
    try {
      while (this.items.length) {
        const item = this.items.shift()!;
        const controller = new AbortController();
        const cancel = () => controller.abort(item.options.signal?.reason);
        try {
          if (this.closed) throw new Error('Audio queue stopped');
          if (item.options.signal?.aborted) throw item.options.signal.reason;
          if (this.clock() > item.expiresAt) throw new Error('Queued audio expired before playback');
          this.current = { kind: item.kind, controller };
          item.options.signal?.addEventListener('abort', cancel, { once: true });
          for (let n = 0; n < item.repeat; n++) for (const file of item.files) {
            if (controller.signal.aborted) throw new Error('Playback cancelled');
            await this.player(file, { ...item.options, signal: controller.signal });
          }
          if (item.options.signal?.aborted) throw item.options.signal.reason;
          item.resolve();
        } catch (error) { item.reject(item.options.signal?.aborted ? item.options.signal.reason : error); }
        finally { item.options.signal?.removeEventListener('abort', cancel); this.current = undefined; }
      }
    } finally { this.draining = false; }
  }
  async stop(): Promise<void> { this.closed = true; this.current?.controller.abort(); await this.idle; }
}
