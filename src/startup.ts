import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

export function startupCommand(configPath: string, stateDir: string): string {
  const args = [process.execPath, fileURLToPath(new URL('./cli.js', import.meta.url)), '--config', resolve(configPath), '--state', resolve(stateDir), 'run'];
  if (args.some(a => /["\r\n]/.test(a))) throw new Error('Invalid path for Windows startup command');
  const quotePS = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const argumentLine = args.slice(1).map(a => `"${a}"`).join(' ');
  const script = `Start-Process -FilePath ${quotePS(args[0]!)} -ArgumentList ${quotePS(argumentLine)} -WindowStyle Hidden`;
  return `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${Buffer.from(script, 'utf16le').toString('base64')}`;
}
// Explicit CLI operation only; building or initializing never changes Windows startup.
export function setStartup(enabled: boolean, configPath: string, stateDir: string): void {
  if (process.platform !== 'win32') throw new Error('Windows startup is only available on Windows');
  if (!process.env.APPDATA) throw new Error('Windows APPDATA directory is unavailable');
  const shortcut = join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Athan Core.lnk');
  if (!enabled) { if (existsSync(shortcut)) unlinkSync(shortcut); return; }
  const command = startupCommand(configPath, stateDir);
  // A Startup-folder shortcut avoids the registry Run command's 260-character limit.
  const script = `$ErrorActionPreference='Stop'; $r=[Console]::In.ReadToEnd()|ConvertFrom-Json; ` +
    `$s=(New-Object -ComObject WScript.Shell).CreateShortcut($r.shortcut); ` +
    `$s.TargetPath=$r.target; $s.Arguments=$r.arguments; $s.Description='Athan Core offline prayer scheduler'; $s.Save()`;
  const args = ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  const result = spawnSync('powershell.exe', args, { encoding: 'utf8', windowsHide: true,
    input: JSON.stringify({ shortcut, target: join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      arguments: command.slice('powershell.exe '.length) }) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Could not change startup setting');
}
