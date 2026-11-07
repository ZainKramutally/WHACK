// Ground cover (0.3-3 m), <= 300 tris each: urchin spikes, polyp nubs, crimson bristle tuft, puff pods.
import { MeshBuilder, add, bead, clamp01, norm, revolve, scl, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

export function groundCover(rng: Rng, variant: number) {
  const b = new MeshBuilder();
  if (variant === 0) {
    // urchin: low dome bristling with long radial spikes (3-sided cones)
    const R = rng.range(0.32, 0.4);
    revolve(b, [0, -0.05, 0], [0, 1, 0], [
      { r: R * 1.05, y: 0, key: 'ink', sway: 0 },
      { r: R, y: R * 0.45, key: 'maroon', sway: 0.1 },
      { r: R * 0.6, y: R * 0.85, key: 'maroon', sway: 0.2 },
      { r: 0, y: R * 1.0, key: 'maroon', sway: 0.2 },
    ], 7);
    bead(b, [0, R * 0.98, 0], [0, 1, 0], R * 0.18, 4, 2, 'glow', 1, 0.2);
    const n = 34;
    for (let k = 0; k < n; k++) {
      // fibonacci hemisphere
      const y = 0.08 + 0.92 * (k + 0.5) / n;
      const a = k * 2.39996 + rng.range(-0.1, 0.1);
      const rr = Math.sqrt(1 - y * y);
      const d = norm([Math.cos(a) * rr, y, Math.sin(a) * rr]);
      const p0: V3 = add([0, R * 0.45, 0], scl(d, R * 0.75));
      const l = R * rng.range(1.4, 2.4);
      sweep(b, [p0, add(p0, scl(d, l))], { segs: 3, radius: (s) => (s < 1 ? R * 0.07 : 0), key: () => (k % 4 ? 'crimson' : 'blush'), sway: (s) => 0.2 + 0.5 * s * y });
    }
  } else if (variant === 1) {
    // polyp nubs: stubby flared tubes with cupped dark mouths
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const rad = k === 0 ? 0 : rng.range(0.25, 0.55);
      const h = rng.range(0.5, 1.3) * (k === 0 ? 1.2 : 1);
      const r = rng.range(0.09, 0.14);
      const o: V3 = [Math.cos(a) * rad, -0.05, Math.sin(a) * rad];
      const ax = norm([Math.cos(a) * rad * 0.6, 1, Math.sin(a) * rad * 0.6]);
      const sw = (y: number) => clamp01((y / 1.6) * 0.8);
      revolve(b, o, ax, [
        { r: r * 1.6, y: 0, key: 'maroon', sway: 0 },
        { r: r * 0.8, y: h * 0.55, key: 'crimson', sway: sw(h * 0.55) },
        { r: r * 1.7, y: h, key: 'blush', sway: sw(h), crease: true },
        { r: r * 1.1, y: h * 1.02, key: 'ink', sway: sw(h) },
        { r: 0, y: h * 0.8, key: 'ink', sway: sw(h) },
      ], 7, rng.range(0, 1));
    }
  } else if (variant === 2) {
    // bristle tuft: fountain of curved crimson blades with bone tips
    const n = 15;
    const H = rng.range(2.2, 2.8);
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996;
      const lean = 0.2 + 0.8 * Math.sqrt((k + 0.5) / n);
      const d: V3 = [Math.cos(a), 0, Math.sin(a)];
      const h = H * (1.05 - 0.5 * lean) * rng.range(0.85, 1.05);
      const out = H * 0.55 * lean;
      const pts: V3[] = [];
      for (let i = 0; i <= 3; i++) {
        const s = i / 3;
        pts.push(add(scl(d, 0.05 + out * s * s), [0, h * Math.sin(s * Math.PI * 0.5) - 0.05, 0]));
      }
      sweep(b, pts, { segs: 3, radius: (s) => (s >= 1 ? 0 : 0.05 * (1 - 0.7 * s)), key: (s) => (s < 0.3 ? 'maroon' : s < 0.66 ? 'crimson' : 'blush'), sway: (s) => s });
    }
  } else {
    // puff pods: three ribbed bulbs on a shared crust, one pore glows
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const o: V3 = [Math.cos(a) * 0.17, -0.03, Math.sin(a) * 0.17];
      const P = rng.range(0.12, 0.2) * (k === 0 ? 1.4 : 1);
      const ribs = (j: number) => 1 + (j % 2 ? 0.1 : -0.1);
      revolve(b, o, norm([Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3]), [
        { r: P * 0.6, y: 0, key: 'maroon', sway: 0 },
        { r: P * 0.95, y: P * 0.45, key: 'crimson', sway: 0.1, mod: ribs },
        { r: P, y: P * 0.95, key: 'blush', sway: 0.15, mod: ribs },
        { r: P * 0.7, y: P * 1.5, key: 'bone', sway: 0.25, mod: ribs, crease: true },
        { r: P * 0.35, y: P * 1.65, key: k === 0 ? 'glow' : 'crimson', glow: k === 0 ? 1 : 0, sway: 0.3 },
        { r: 0, y: P * 1.5, key: k === 0 ? 'glow' : 'crimson', glow: k === 0 ? 1 : 0, sway: 0.3 },
      ], 10);
    }
  }
  return b.build();
}
