import geomagnetism from 'geomagnetism';
export const normalizeHeading = (degrees: number) => ((degrees % 360) + 360) % 360;
export const headingDifference = (target: number, heading: number) => ((target - heading + 540) % 360) - 180;
export function magneticDeclination(latitude: number, longitude: number, date = new Date()): number | undefined {
  try {
    const field = geomagnetism.model(date).point([latitude, longitude]);
    // A compass cannot give a reliable direction near the magnetic poles.
    return Number.isFinite(field.decl) && field.h >= 2000 ? field.decl : undefined;
  } catch { return undefined; }
}
/** Project the visible screen's top edge onto the Earth horizontal plane. */
export function orientationHeading(alpha: number, beta = 0, gamma = 0, screenAngle = 0): number | undefined {
  const r = Math.PI / 180, a = alpha*r, b = beta*r, g = gamma*r, s = screenAngle*r;
  const east = Math.sin(s)*(Math.cos(a)*Math.cos(g)-Math.sin(a)*Math.sin(b)*Math.sin(g))-Math.cos(s)*Math.sin(a)*Math.cos(b);
  const north = Math.sin(s)*(Math.sin(a)*Math.cos(g)+Math.cos(a)*Math.sin(b)*Math.sin(g))+Math.cos(s)*Math.cos(a)*Math.cos(b);
  if (Math.hypot(east, north) < .1) return undefined;
  return normalizeHeading(Math.atan2(east, north)/r);
}
