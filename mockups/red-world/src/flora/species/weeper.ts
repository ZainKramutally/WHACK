// Weeper (15-60 m): vertebrate-looking arching spine(s) with collars, curling over like a crook,
// with a curtain of long drooping filaments. Foreground framing piece.
import { MeshBuilder, add, bead, clamp01, curl, norm, revolve, scl, sub, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

interface Cfg { H: number; spines: number; reach: number; curl: number; threads: number }
const VARIANTS: Cfg[] = [
  { H: 42, spines: 1, reach: 0.75, curl: 0.35, threads: 20 },
  { H: 34, spines: 2, reach: 0.65, curl: 0.25, threads: 14 },
  { H: 58, spines: 1, reach: 1.0, curl: 0.5, threads: 26 },
  { H: 18, spines: 3, reach: 0.9, curl: 0.15, threads: 9 },
];

export function weeper(rng: Rng, variant: number) {
  const c = VARIANTS[variant];
  const H = c.H * rng.range(0.94, 1.06);
  const b = new MeshBuilder();
  const yaw0 = rng.range(0, Math.PI * 2);
  const rBase = H * 0.028;
  // root knot
  revolve(b, [0, -0.3, 0], [0, 1, 0], [
    { r: rBase * 2.4, y: 0, key: 'ink', sway: 0 },
    { r: rBase * 1.6, y: rBase * 1.5, key: 'ink', sway: 0.01 },
    { r: 0, y: rBase * 4, key: 'maroon', sway: 0.03 },
  ], 10);
  for (let k = 0; k < c.spines; k++) {
    const a = yaw0 + (k / c.spines) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const dir: V3 = [Math.cos(a), 0, Math.sin(a)];
    const hk = H * (k === 0 ? 1 : rng.range(0.7, 0.9));
    // crozier spine: tangent angle sweeps up -> over -> down -> curls back into a spiral (fiddlehead)
    const bend = 2.3 * c.reach, coil = 5.5 + c.curl * 5;
    const theta = (u: number) => Math.PI / 2 - bend * Math.pow(u, 1.6) - coil * Math.pow(u, 7);
    const raw = curl([0, 0, 0], dir, 1, 44, theta);
    const top = Math.max(...raw.map((p) => p[1]));
    const pts = raw.map((p) => scl(p, hk / top));
    // spine: vertebral bands (collar every few rings)
    const nPts = pts.length;
    const S: number[] = [0];
    for (let i = 1; i < nPts; i++) S.push(S[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
    const Ltot = S[nPts - 1];
    const swayS = (s: number) => clamp01(Math.pow(s, 1.4));
    const vert = (i: number) => i > 2 && i % 3 === 0 && i < nPts - 6;
    sweep(b, pts, {
      segs: 9,
      radius: (s, i) => rBase * (1 - 0.8 * s) * (vert(i) ? 1.35 : 1),
      key: (s, i) => (vert(i) ? (s < 0.4 ? 'blush' : 'maroon') : s < 0.08 ? 'ink' : s < 0.45 ? 'maroon' : 'crimson'),
      sway: (s) => swayS(s),
    });
    // tip droplet pod
    const tip = pts[nPts - 1];
    bead(b, add(tip, [0, -rBase * 0.7, 0]), norm(sub(tip, pts[nPts - 2])), rBase * 0.9, 8, 4, 'glow', 1, 1);
    // curtain of threads hanging from the arch (s in 0.35..0.97)
    const threads = Math.round(c.threads / Math.max(1, k === 0 ? 1 : 1.5));
    for (let t = 0; t < threads; t++) {
      const sT = 0.32 + 0.48 * (t + rng.range(0, 1)) / threads;
      let i = 1;
      while (i < nPts - 1 && S[i] / Ltot < sT) i++;
      const f = (sT * Ltot - S[i - 1]) / (S[i] - S[i - 1] || 1);
      const top = add(pts[i - 1], scl(sub(pts[i], pts[i - 1]), f));
      if (top[1] < H * 0.3) continue;
      const L = (top[1] - H * 0.08) * rng.range(0.45, 0.95);
      const swing = rng.range(-1, 1) * H * 0.02;
      const side: V3 = [-dir[2], 0, dir[0]];
      const tp: V3[] = [];
      for (let q = 0; q <= 6; q++) {
        const u = q / 6;
        tp.push(add(add(top, [0, -L * u, 0]), scl(side, swing * u * u)));
      }
      const s0 = swayS(sT);
      sweep(b, tp, {
        segs: 3,
        radius: (u) => H * 0.011 * (1 - 0.55 * u),
        key: (u) => (u < 0.3 ? 'maroon' : u < 0.75 ? 'crimson' : 'blush'),
        sway: (u) => s0 + (1 - s0) * u,
      });
      if (t % 7 === 3) bead(b, tp[6], [0, -1, 0], H * 0.011, 5, 3, 'glow', 1, 1);
    }
  }
  return b.build();
}
