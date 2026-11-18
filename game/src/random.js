// Every placement comes from this seed; no external assets or services.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
