import type { CompassState } from '../../../src/device.js';
import { nearestCity } from './catalogue';
export async function deviceLocation() {
  if (!navigator.geolocation) throw new Error('Device location requires a supported browser on HTTPS or localhost. You can still choose a country and city.');
  const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(error.code === 1 ? 'Location access was denied. Allow location in your browser site settings or choose a city.' : 'Your device could not provide a location. Try again or choose a city.')), { enableHighAccuracy: true, timeout: 18000, maximumAge: 60000 }));
  const { latitude, longitude, accuracy } = position.coords;
  return { latitude, longitude, accuracy, timestamp: new Date(position.timestamp).toISOString(), source: 'Browser location services', ...await nearestCity(latitude, longitude) };
}
export function browserCompass(report: (state: CompassState) => void) {
  let cleanup = () => {}, generation = 0;
  async function compass(enabled: boolean) {
    const current = ++generation; cleanup(); cleanup = () => {};
    if (!enabled) { report({ status: 'off' }); return; }
    if (!window.isSecureContext || !('DeviceOrientationEvent' in window)) { report({ status: 'unavailable', message: 'This browser has no compass source. The calculated true-north bearing is still available.' }); return; }
    const orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: (absolute: boolean) => Promise<string> };
    if (orientation.requestPermission && await orientation.requestPermission(true) !== 'granted') { report({ status: 'error', message: 'Compass permission was not granted.' }); return; }
    if (current !== generation) return;
    report({ status: 'waiting' });
    const timer = setTimeout(() => { cleanup(); report({ status: 'unavailable', message: 'No compass readings are available from this device or browser.' }); }, 8000);
    const listener = (event: DeviceOrientationEvent) => {
      const value = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
      if (value.webkitCompassHeading != null && Number.isFinite(value.webkitCompassHeading)) {
        clearTimeout(timer); report({ status: 'reading', trueNorth: null, magneticNorth: value.webkitCompassHeading, accuracy: String(value.webkitCompassAccuracy ?? 'unknown'), timestamp: new Date().toISOString() });
      } else if (event.absolute && event.alpha != null) {
        clearTimeout(timer);
        // The browser does not identify magnetic declination correction; never label it true north.
        report({ status: 'reading', trueNorth: null, magneticNorth: (360 - event.alpha) % 360, accuracy: 'Browser north reference is unverified', timestamp: new Date().toISOString() });
      }
    };
    window.addEventListener('deviceorientationabsolute', listener as EventListener);
    window.addEventListener('deviceorientation', listener);
    cleanup = () => { clearTimeout(timer); window.removeEventListener('deviceorientationabsolute', listener as EventListener); window.removeEventListener('deviceorientation', listener); };
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) void compass(false); });
  window.addEventListener('pagehide', () => { void compass(false); });
  return compass;
}
