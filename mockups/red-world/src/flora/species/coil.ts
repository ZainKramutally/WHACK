// Coil spire (30-120 m): an open helical corkscrew (no centre column) tapering to a ribbed bulb,
// a firework of filaments, or (inverted) a widening vortex with a hanging fringe.
import type { PaletteKey } from '../../contracts';
import { MeshBuilder, add, bead, clamp01, norm, revolve, sub, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

interface Cfg { H: number; R0: number; r0: number; turns: number; strands: number; tip: 'bulb' | 'firework' | 'fringe'; invert: boolean }
const VARIANTS: Cfg[] = [
  { H: 95, R0: 9, r0: 2.2, turns: 4.5, strands: 1, tip: 'bulb', invert: false },
  { H: 70, R0: 7, r0: 1.6, turns: 3.2, strands: 1, tip: 'firework', invert: false },
  { H: 112, R0: 8, r0: 1.7, turns: 5.5, strands: 2, tip: 'bulb', invert: false },
  { H: 42, R0: 9, r0: 1.4, turns: 2.6, strands: 1, tip: 'fringe', invert: true },
];

export function coilSpire(rng: Rng, variant: number) {
  const c = VARIANTS[variant];
  const H = c.H * rng.range(0.94, 1.06);
  const b = new MeshBuilder();
  const swayY = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.5));
  const hTop = H * (c.tip === 'bulb' ? 0.84 : c.tip === 'firework' ? 0.8 : 0.97);
  const ph0 = rng.range(0, 6.28);
  // helix radius profile: flares out of the ground, then tapers (or widens when inverted)
  const Rh = (t: number) => c.invert
    ? c.R0 * (0.25 + 0.75 * Math.pow(t, 0.8))
    : c.R0 * Math.min(1, t * 7) * Math.pow(1 - t, 0.9) + c.r0 * 0.5;
  const helix = (t: number, ph: number): V3 => {
    const a = ph + t * c.turns * Math.PI * 2;
    return [Math.cos(a) * Rh(t), t * hTop, Math.sin(a) * Rh(t)];
  };
  const bands = rng.int(9, 13);
  // value inverts with height: ink/maroon stripes low, crimson/blush stripes high
  const keyAt = (t: number): PaletteKey => {
    if (t < 0.06) return 'ink';
    if (t > 0.92) return 'blush';
    const odd = Math.floor(t * bands) % 2 === 1;
    if (t < 0.4) return odd ? 'maroon' : 'ink';
    if (t < 0.7) return odd ? 'crimson' : 'maroon';
    return odd ? 'blush' : 'crimson';
  };
  const n = Math.round(c.turns * 22);
  for (let k = 0; k < c.strands; k++) {
    const ph = ph0 + (k * Math.PI * 2) / c.strands;
    const pts: V3[] = [];
    // root: rise from the base centre into the coil
    for (let i = 0; i <= n; i++) pts.push(helix(i / n, ph));
    sweep(b, pts, {
      segs: 10,
      radius: (s) => c.r0 * (c.invert ? 1 - 0.45 * s : 1 - 0.65 * s) * (s < 0.02 ? 1.8 : 1),
      key: (s) => keyAt(s),
      sway: (_s, p) => swayY(p[1]),
    });
  }
  // root mound
  revolve(b, [0, -0.3, 0], [0, 1, 0], [
    { r: c.R0 * 0.3, y: 0, key: 'ink', sway: 0 },
    { r: c.R0 * 0.22, y: c.r0 * 1.2, key: 'ink', sway: swayY(c.r0 * 1.5) },
    { r: 0, y: c.r0 * 2, key: 'ink', sway: swayY(c.r0 * 2) },
  ], 10);
  const top = c.invert ? helix(1, ph0) : ([0, hTop, 0] as V3);
  if (c.tip === 'bulb') {
    // a ribbed onion bulb with a glowing pore at its crown
    const Rb = H * 0.085;
    const ribs = (j: number) => 1 + (j % 2 ? 0.07 : -0.07);
    const s0 = swayY(hTop);
    revolve(b, add(top, [0, -Rb * 0.3, 0]), [0, 1, 0], [
      { r: 0, y: 0, key: 'maroon', sway: s0 },
      { r: Rb * 0.55, y: Rb * 0.2, key: 'blush', sway: s0, mod: ribs },
      { r: Rb, y: Rb * 0.8, key: 'blush', sway: s0, mod: ribs },
      { r: Rb * 0.9, y: Rb * 1.5, key: 'bone', sway: s0, mod: ribs },
      { r: Rb * 0.45, y: Rb * 2.1, key: 'crimson', sway: 1, mod: ribs, crease: true },
      { r: Rb * 0.32, y: Rb * 2.3, key: 'glow', glow: 1, sway: 1 },
      { r: 0, y: Rb * 2.15, key: 'glow', glow: 1, sway: 1 },
    ], 16);
    // spire needle above the bulb
    sweep(b, [add(top, [0, Rb * 1.9, 0]), [0, (top[1] + Rb * 1.9 + H) / 2, 0], [0, H, 0]], {
      segs: 5, radius: (s) => Rb * 0.12 * (1 - s), key: () => 'crimson', sway: () => 1,
    });
  } else if (c.tip === 'firework') {
    const m = rng.int(9, 12);
    const L = H - hTop;
    for (let k = 0; k < m; k++) {
      const a = (k / m) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const el = rng.range(0.15, 0.7);
      const d: V3 = norm([Math.cos(a) * Math.cos(el), Math.sin(el) + 0.3, Math.sin(a) * Math.cos(el)]);
      const pts: V3[] = [];
      for (let i = 0; i <= 7; i++) {
        const s = i / 7;
        const p = add(top, [d[0] * L * 1.6 * s, d[1] * L * 1.3 * s - L * 0.9 * s * s, d[2] * L * 1.6 * s]);
        pts.push(p);
      }
      sweep(b, pts, { segs: 4, radius: (s) => 0.5 * (1 - 0.7 * s), key: (s) => (s < 0.5 ? 'crimson' : 'blush'), sway: (s) => swayY(hTop) + (1 - swayY(hTop)) * s });
      bead(b, pts[7], sub(pts[7], pts[6]), 1.0, 6, 3, k % 3 ? 'blush' : 'glow', k % 3 ? 0 : 1, 1);
    }
  } else {
    // inverted vortex: a fringe of filaments hangs from the top whorl
    const m = 16;
    const s0 = swayY(hTop);
    for (let k = 0; k < m; k++) {
      const p0 = helix(1 - k / (m * c.turns), ph0);
      const L = H * rng.range(0.25, 0.5);
      const pts: V3[] = [];
      for (let i = 0; i <= 5; i++) pts.push(add(p0, [0, -L * (i / 5), 0]));
      sweep(b, pts, { segs: 3, radius: (s) => 0.35 * (1 - 0.6 * s), key: (s) => (s < 0.4 ? 'maroon' : 'crimson'), sway: (s) => s0 + (1 - s0) * s });
      if (k % 5 === 0) bead(b, pts[5], [0, -1, 0], 0.55, 6, 3, 'glow', 1, 1);
    }
  }
  return b.build();
}
