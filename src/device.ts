import { spawn, type ChildProcess } from 'node:child_process';
import { z } from 'zod';

export interface DevicePosition { latitude: number; longitude: number; accuracy: number; timestamp: string; source: string; }
export interface CompassState { status: 'off' | 'waiting' | 'reading' | 'unavailable' | 'error'; trueNorth?: number | null | undefined; magneticNorth?: number | undefined; accuracy?: string | undefined; message?: string | undefined; timestamp?: string | undefined; }
const positionSchema = z.object({ latitude: z.number().min(-89.9).max(89.9), longitude: z.number().min(-180).max(180), accuracy: z.number().nonnegative(), timestamp: z.string().datetime({ offset: true }), source: z.string() });
const compassSchema = z.object({ status: z.enum(['off', 'waiting', 'reading', 'unavailable', 'error']), trueNorth: z.number().min(0).max(360).nullable().optional(), magneticNorth: z.number().min(0).max(360).optional(), accuracy: z.string().optional(), timestamp: z.string().optional(), message: z.string().optional() });
const preamble = `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
`;
function launch(script: string) {
  return spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(preamble + script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

export async function readDevicePosition(): Promise<DevicePosition> {
  if (process.platform !== 'win32') throw new Error('Device location is available on Windows. You can still select a country and city.');
  const script = `try {
    $null = [Windows.Devices.Geolocation.Geolocator,Windows.Devices.Geolocation,ContentType=WindowsRuntime]
    $null = [Windows.Devices.Geolocation.Geoposition,Windows.Devices.Geolocation,ContentType=WindowsRuntime]
    $locator = [Windows.Devices.Geolocation.Geolocator]::new()
    $locator.DesiredAccuracyInMeters = 100
    $operation = $locator.GetGeopositionAsync([TimeSpan]::FromMinutes(1), [TimeSpan]::FromSeconds(18))
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 1 } | Select-Object -First 1
    $task = $method.MakeGenericMethod([Windows.Devices.Geolocation.Geoposition]).Invoke($null, @($operation))
    $position = $task.GetAwaiter().GetResult()
    $coordinate = $position.Coordinate
    @{ latitude=$coordinate.Point.Position.Latitude; longitude=$coordinate.Point.Position.Longitude; accuracy=$coordinate.Accuracy; timestamp=$coordinate.Timestamp.ToString('o'); source=$coordinate.PositionSource.ToString() } | ConvertTo-Json -Compress
  } catch { @{ error='Windows could not provide a location. Check Settings > Privacy & security > Location, including desktop app access, then try again. Country and city selection remains available.' } | ConvertTo-Json -Compress; exit 1 }`;
  return new Promise((resolve, reject) => {
    const child = launch(script); let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Windows location timed out. Check location services or choose a city manually.')); }, 23000);
    child.stdout?.on('data', data => { output += data; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', () => {
      clearTimeout(timer);
      try { const value = JSON.parse(output.trim()); if (value.error) throw new Error(value.error); resolve(positionSchema.parse(value)); }
      catch (error) { reject(error instanceof SyntaxError ? new Error('Windows location is unavailable on this device.') : error); }
    });
  });
}

export class DeviceCompass {
  private child: ChildProcess | null = null;
  stop() { const child = this.child; this.child = null; child?.kill(); }
  start(report: (state: CompassState) => void) {
    this.stop();
    if (process.platform !== 'win32') { report({ status: 'unavailable', message: 'No Windows compass source is available.' }); return; }
    const script = `try {
      $null = [Windows.Devices.Sensors.Compass,Windows.Devices.Sensors,ContentType=WindowsRuntime]
      $sensor = [Windows.Devices.Sensors.Compass]::GetDefault()
      if ($null -eq $sensor) { @{status='unavailable';message='This device has no compass sensor. The calculated true-north bearing is still available.'} | ConvertTo-Json -Compress; exit }
      $sensor.ReportInterval = [Math]::Max(250, $sensor.MinimumReportInterval)
      while ($true) {
        $reading = $sensor.GetCurrentReading()
        if ($null -eq $reading) { @{status='waiting';message='Waiting for a compass reading...'} | ConvertTo-Json -Compress }
        else { @{ status='reading'; trueNorth=$reading.HeadingTrueNorth; magneticNorth=$reading.HeadingMagneticNorth; accuracy=$reading.HeadingAccuracy.ToString(); timestamp=$reading.Timestamp.ToString('o') } | ConvertTo-Json -Compress }
        Start-Sleep -Milliseconds 250
      }
    } catch { @{status='error';message='The Windows compass is unavailable. Try reconnecting or use the calculated bearing.'} | ConvertTo-Json -Compress }`;
    const child = launch(script); this.child = child; let pending = '', terminal = false;
    report({ status: 'waiting', message: 'Looking for a device compass...' });
    child.stdout?.on('data', chunk => {
      pending += chunk;
      while (pending.includes('\n')) {
        const end = pending.indexOf('\n'), line = pending.slice(0, end).trim(); pending = pending.slice(end + 1);
        if (this.child !== child || !line) continue;
        try { const state = compassSchema.parse(JSON.parse(line)); terminal ||= state.status === 'unavailable' || state.status === 'error'; report(state); }
        catch { terminal = true; report({ status: 'error', message: 'Windows returned an unreadable compass reading.' }); this.stop(); }
      }
    });
    child.on('error', () => { if (this.child === child) { terminal = true; report({ status: 'error', message: 'Could not open the Windows compass source.' }); this.stop(); } });
    child.on('close', () => { if (this.child === child) { this.child = null; if (!terminal) report({ status: 'error', message: 'The device compass disconnected.' }); } });
  }
}
