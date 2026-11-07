// Lantern pod cluster (5-25 m): thin arching stems from a root knot, each carrying a ribbed pod
// (diatom / radiolarian lantern) whose mouth glows cyan. The main accent carrier.
import { MeshBuilder, add, bead, bezier, clamp01, norm, revolve, scl, sub, sweep, type ProfilePt, type V3 } from '../mesh';
import type { Rng } from '../rng';

interface Cfg { H: number; stems: number; spread: number; droop: boolean; pod: number; shape: 'lantern' | 'onion' | 'orb'; chandelier?: boolean }
const VARIANTS: Cfg[] = [
  { H: 11, stems: 5, spread: 0.55, droop: true, pod: 1.3, shape: 'lantern' },
  { H: 22, stems: 3, spread: 0.22, droop: false, pod: 2.4, shape: 'onion' },
  { H: 7, stems: 9, spread: 0.75, droop: false, pod: 0.42, shape: 'orb' },
  { H: 25, stems: 6, spread: 0.32, droop: true, pod: 1.6, shape: 'lantern', chandelier: true },
];

export function lanternPods(rng: Rng, variant: number) {
  const c = VARIANTS[variant];
  const H = c.H * rng.range(0.93, 1.07);
  const b = new MeshBuilder();
  const swayY = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.3));
  const P = c.pod * H / c.H;
  // root knot
  revolve(b, [0, -0.2, 0], [0, 1, 0], [
    { r: H * 0.06, y: 0, key: 'ink', sway: 0 },
    { r: H * 0.05, y: H * 0.03, key: 'maroon', sway: swayY(H * 0.03) },
    { r: 0, y: H * 0.07, key: 'maroon', sway: swayY(H * 0.07) },
  ], 8);
  const stemR = H * 0.011;
  if (c.chandelier) {
    // one tall stem, a crown disc, and pods hanging on short arcs around it
    const top: V3 = [rng.range(-1, 1), H * 0.95, rng.range(-1, 1)];
    const pts = bezier([0, 0, 0], [0, H * 0.4, 0], [top[0] * 0.5, H * 0.75, top[2] * 0.5], top, 14);
    sweep(b, pts, { segs: 7, radius: (s) => stemR * 2.2 * (1 - 0.5 * s), key: (s) => (s < 0.3 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]) });
    revolve(b, add(top, [0, -0.6, 0]), [0, 1, 0], [
      { r: 0, y: 0, key: 'crimson', sway: swayY(top[1]) },
      { r: H * 0.1, y: 0.3, key: 'maroon', sway: swayY(top[1]), crease: true },
      { r: H * 0.07, y: 1.0, key: 'blush', sway: swayY(top[1]) },
      { r: 0, y: 1.6, key: 'blush', sway: swayY(top[1]) },
    ], 14);
    for (let k = 0; k < c.stems; k++) {
      const a = (k / c.stems) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const o = add(top, [Math.cos(a) * H * 0.09, 0, Math.sin(a) * H * 0.09]);
      const drop = H * rng.range(0.18, 0.4);
      const out = H * 0.06;
      const sp = bezier(o, add(o, [Math.cos(a) * out, H * 0.04, Math.sin(a) * out]), add(o, [Math.cos(a) * out * 1.6, -drop * 0.3, Math.sin(a) * out * 1.6]), add(o, [Math.cos(a) * out * 1.5, -drop, Math.sin(a) * out * 1.5]), 8);
      const s0 = swayY(top[1]);
      sweep(b, sp, { segs: 4, radius: () => stemR * 0.7, key: () => 'crimson', sway: (s) => s0 + (1 - s0) * s * 0.7 });
      pod(b, sp[sp.length - 1], norm(sub(sp[sp.length - 1], sp[sp.length - 2])), P * rng.range(0.8, 1.15), c.shape, clamp01(s0 + 0.7 * (1 - s0)));
    }
    return b.build();
  }
  for (let k = 0; k < c.stems; k++) {
    const a = (k / c.stems) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const h = H * rng.range(0.6, 1.0) - P * (c.droop ? 0 : 2.2);
    const out = H * c.spread * rng.range(0.6, 1.1);
    const dir: V3 = [Math.cos(a), 0, Math.sin(a)];
    const base: V3 = scl(dir, H * 0.02);
    const tip = c.droop ? add(scl(dir, out * 1.1), [0, h * 0.8, 0]) : add(scl(dir, out * 0.6), [0, h, 0]);
    const pts = c.droop
      ? bezier(base, [base[0], h * 0.7, base[2]], add(scl(dir, out * 0.7), [0, h * 1.12, 0]), tip, 12)
      : bezier(base, [base[0], h * 0.4, base[2]], add(scl(dir, out * 0.45), [0, h * 0.75, 0]), tip, 12);
    sweep(b, pts, { segs: 5, radius: (s) => stemR * (1.3 - 0.6 * s), key: (s) => (s < 0.25 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]) });
    const end = pts[pts.length - 1];
    const d = c.droop ? ([0, -1, 0] as V3) : norm(sub(end, pts[pts.length - 3]));
    pod(b, end, d, P * rng.range(0.75, 1.2), c.shape, swayY(end[1]));
  }
  return b.build();
}

/** Ribbed pod hanging/standing from `o` along `d`. Mouth at the far end glows. */
function pod(b: MeshBuilder, o: V3, d: V3, P: number, shape: Cfg['shape'], sway: number) {
  const ribs = (j: number) => 1 + (j % 2 ? 0.09 : -0.09);
  const sw = clamp01(sway);
  let prof: ProfilePt[];
  if (shape === 'lantern') {
    prof = [
      { r: 0, y: 0, key: 'crimson', sway: sw },
      { r: P * 0.25, y: P * 0.1, key: 'crimson', sway: sw },
      { r: P * 0.8, y: P * 0.55, key: 'blush', sway: sw, mod: ribs },
      { r: P * 1.0, y: P * 1.2, key: 'blush', sway: sw, mod: ribs },
      { r: P * 0.8, y: P * 1.85, key: 'bone', sway: sw, mod: ribs },
      { r: P * 0.45, y: P * 2.2, key: 'maroon', sway: sw, crease: true },
      { r: P * 0.36, y: P * 2.3, key: 'glow', glow: 1, sway: sw },
      { r: 0, y: P * 2.1, key: 'glow', glow: 1, sway: sw },
    ];
  } else if (shape === 'onion') {
    prof = [
      { r: 0, y: 0, key: 'crimson', sway: sw },
      { r: P * 0.6, y: P * 0.3, key: 'crimson', sway: sw, mod: ribs },
      { r: P * 1.0, y: P * 0.9, key: 'blush', sway: sw, mod: ribs },
      { r: P * 0.85, y: P * 1.5, key: 'bone', sway: sw, mod: ribs },
      { r: P * 0.45, y: P * 2.0, key: 'bone', sway: sw, mod: ribs },
      { r: P * 0.22, y: P * 2.4, key: 'glow', glow: 1, sway: sw, crease: true },
      { r: P * 0.1, y: P * 2.75, key: 'crimson', sway: sw },
      { r: 0, y: P * 3.6, key: 'crimson', sway: sw },
    ];
  } else {
    prof = [
      { r: 0, y: 0, key: 'maroon', sway: sw },
      { r: P * 0.7, y: P * 0.3, key: 'crimson', sway: sw, mod: ribs },
      { r: P * 1.0, y: P * 1.0, key: 'blush', sway: sw, mod: ribs },
      { r: P * 0.7, y: P * 1.7, key: 'blush', sway: sw, mod: ribs, crease: true },
      { r: P * 0.4, y: P * 1.85, key: 'glow', glow: 1, sway: sw },
      { r: 0, y: P * 1.75, key: 'glow', glow: 1, sway: sw },
    ];
  }
  revolve(b, o, d, prof, 20);
  if (shape === 'lantern') bead(b, add(o, scl(d, P * 2.55)), d, P * 0.18, 6, 3, 'glow', 1, sw);
}
