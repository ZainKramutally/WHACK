// Parasol titan (hero, 60-180 m): segmented S-curved stalk with collar rings and buttress roots,
// 1-4 stacked pleated discs (bone tops, crimson gill-pleated undersides, maroon zigzag rims).
import type { FloraKey as PaletteKey } from '../mesh';
import { MeshBuilder, add, bead, clamp01, lerp3, norm, revolve, sub, sweep, type ProfilePt, type V3 } from '../mesh';
import type { Rng } from '../rng';

interface Disc { t: number; R: number; cup: number; dome: number; fringe?: number; glowLine?: boolean }
interface Cfg { H: number; r0: number; lean: number; discs: Disc[]; neckGlow: boolean; crown: boolean; collars: number }

const VARIANTS: Cfg[] = [
  // monarch: one vast cupped cap with a dangling fringe
  { H: 150, r0: 3.2, lean: 0.10, discs: [{ t: 1, R: 58, cup: 0.08, dome: 0.2, fringe: 22, glowLine: true }], neckGlow: false, crown: false, collars: 4 },
  // pagoda: three tiers shrinking upward
  { H: 170, r0: 3.6, lean: 0.05, discs: [{ t: 0.6, R: 50, cup: 0.07, dome: 0.03 }, { t: 0.8, R: 36, cup: 0.09, dome: 0.03 }, { t: 1, R: 22, cup: 0.12, dome: 0.12 }], neckGlow: true, crown: false, collars: 3 },
  // sapling twin: lean, two caps
  { H: 72, r0: 1.5, lean: 0.18, discs: [{ t: 0.78, R: 22, cup: 0.12, dome: 0.03, glowLine: true }, { t: 1, R: 12, cup: 0.16, dome: 0.14 }], neckGlow: false, crown: false, collars: 3 },
  // sentinel: needle stalk with four plates and a glowing crown
  { H: 180, r0: 2.4, lean: 0.04, discs: [{ t: 0.55, R: 26, cup: 0.05, dome: 0.02 }, { t: 0.7, R: 32, cup: 0.06, dome: 0.02 }, { t: 0.84, R: 24, cup: 0.08, dome: 0.02 }, { t: 0.95, R: 14, cup: 0.12, dome: 0.06 }], neckGlow: true, crown: true, collars: 5 },
];

export function parasolTitan(rng: Rng, variant: number) {
  const c = VARIANTS[variant];
  const H = c.H * rng.range(0.94, 1.06);
  const b = new MeshBuilder();
  const swayY = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.6));
  // stalk param t in [0,1]; disc d.t is the stalk param it sits on (1 = stalk top)
  const stalkTop = H * (c.crown ? 0.94 : 0.97);
  // stalk centreline
  const lx = c.lean * rng.sign(), lz = c.lean * rng.range(-0.5, 0.5), wob = rng.range(0.02, 0.05), ph = rng.range(0, 6.28);
  const path = (t: number): V3 => [
    H * (lx * t * t + wob * Math.sin(Math.PI * 1.3 * t + ph) * (1 - t) * t),
    t * stalkTop,
    H * (lz * t * t + wob * Math.cos(Math.PI * 1.1 * t + ph) * (1 - t) * t),
  ];
  const tan = (t: number) => norm(sub(path(Math.min(1, t + 0.01)), path(Math.max(0, t - 0.01))));
  const rAt = (t: number) => c.r0 * (1 - 0.62 * t) * (1 + 1.6 * Math.exp(-t / 0.035));
  // samples: uniform + collar triplets
  const ts: number[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) ts.push(Math.pow(i / N, 1.15));
  const collarTs: number[] = [];
  const firstT = c.discs[0].t * (c.discs.length > 1 ? 0.9 : 0.8);
  for (let k = 0; k < c.collars; k++) collarTs.push(0.14 + (k + rng.range(-0.25, 0.25)) * (firstT - 0.14) / Math.max(1, c.collars - 1));
  const bump = new Map<number, number>();
  for (const ct of collarTs) for (const [d, m] of [[-0.012, 1.0], [-0.004, 1.55], [0.006, 1.5], [0.014, 1.0]] as const) {
    const t = ct + d; ts.push(t); bump.set(t, m);
  }
  const neckT = c.discs[c.discs.length - 1].t - 0.03;
  ts.sort((a, b) => a - b);
  const bandKey = (t: number): PaletteKey => {
    if (bump.has(t) && bump.get(t)! > 1.2) return t < 0.45 ? 'blush' : 'maroon';
    if (t < 0.09) return 'ink';
    if (t < 0.36) return 'maroon';
    if (t < 0.68) return 'crimson';
    return 'blush';
  };
  const pts = ts.map(path);
  const lobes = rng.int(4, 6);
  sweep(b, [...pts, add(pts[pts.length - 1], [0, 0.4, 0])], {
    segs: 14,
    radius: (_s, i) => (i >= ts.length ? 0 : rAt(ts[i]) * (bump.get(ts[i]) ?? 1)),
    key: (_s, i) => bandKey(ts[Math.min(i, ts.length - 1)]),
    glow: undefined,
    sway: (_s, p) => swayY(p[1]),
    mod: (s) => (s < 0.06 ? (j: number, th: number) => 1 + 0.9 * (1 - s / 0.06) * Math.pow(Math.max(0, Math.cos(lobes * th)), 3) : undefined),
    u0: [1, 0, 0],
  });
  // neck glow band: re-tag via a thin separate collar (keeps stalk bands simple)
  if (c.neckGlow) {
    const p0 = path(neckT), ax = tan(neckT), r = rAt(neckT) * 1.18;
    revolve(b, p0, ax, [
      { r: r * 0.9, y: -0.4, key: 'glow', glow: 1, sway: swayY(p0[1]) },
      { r, y: 0.2, key: 'glow', glow: 1, sway: swayY(p0[1]) },
      { r: r * 0.9, y: 1.0, key: 'glow', glow: 1, sway: swayY(p0[1]) },
    ], 14);
  }
  // discs
  for (const d of c.discs) {
    const axis = norm(lerp3(tan(d.t), [0, 1, 0], 0.55));
    disc(b, rng, path(d.t), axis, d, rAt(d.t), swayY, H);
  }
  if (c.crown) {
    const p = add(path(1), [0, 1.5, 0]);
    revolve(b, add(path(1), [0, -1, 0]), [0, 1, 0], [
      { r: 1.2, y: 0, key: 'maroon', sway: swayY(p[1]) },
      { r: 1.6, y: 1.5, key: 'maroon', sway: swayY(p[1]) },
      { r: 0.5, y: 3.0, key: 'maroon', sway: swayY(p[1]) },
      { r: 0, y: 6, key: 'maroon', sway: 1 },
    ], 8);
    bead(b, add(p, [0, 6.5, 0]), [0, 1, 0], 2.0, 8, 4, 'glow', 1, 1);
  }
  return b.build();
}

const FLARE = 0.2; // rim upturn as a fraction of disc radius

function disc(b: MeshBuilder, rng: Rng, o: V3, axis: V3, d: Disc, rs: number, swayY: (y: number) => number, H: number) {
  const { R, cup, dome } = d;
  const th = R * 0.035;
  const gill = R * 0.045;
  const pleat = (amp: number) => (j: number) => (j % 2 ? amp : -amp);
  const zig = (amp: number) => (j: number) => 1 + (j % 2 ? amp : -amp);
  const sw = (r: number, y: number) => clamp01(swayY(o[1] + y) + 0.25 * (r / R));
  const prof: ProfilePt[] = [];
  // underside, outward: stepped bands darkest at the stalk, pale toward the rim (reads from a low camera)
  const bands: [number, PaletteKey][] = [[0, 'maroon'], [0.14, 'crimson'], [0.3, 'crimson'], [0.47, 'blush'], [0.64, 'blush'], [0.78, 'bone'], [0.9, 'bone'], [1, 'maroon']];
  if (d.glowLine) bands.splice(3, 0, [0.452, 'glow']);
  bands.forEach(([f, key], k) => {
    const r = rs * 0.9 + (R - rs * 0.9) * f;
    const y = -0.12 * R * Math.pow(1 - f, 1.6) + cup * R * f * f + FLARE * R * Math.pow(f, 5); // rim flares up so the pale band catches light from below
    const g = key === 'glow' ? 1 : 0;
    prof.push({ r, y, key, glow: g, sway: sw(r, y), lift: k > 0 ? pleat(gill * f) : undefined, crease: f === 1 });
  });
  // lip (zigzag rim)
  prof.push({ r: R * 1.025, y: cup * R + FLARE * R + th * 0.5, key: 'maroon', sway: sw(R, cup * R), crease: true, mod: zig(0.025), lift: pleat(gill) });
  // top, inward
  // top, inward: stepped bone/blush growth rings, faint radial spokes (pleat lift), crimson umbo ring
  const tops: [number, PaletteKey][] = [
    [0.97, 'blush'], [0.88, 'bone'], [0.75, 'blush'], [0.72, 'bone'], [0.54, 'blush'], [0.51, 'bone'],
    [0.33, 'blush'], [0.3, 'bone'], [0.14, 'crimson'], [0.09, 'bone'],
  ];
  const ty = (f: number) => th + cup * R * f * f + FLARE * R * Math.pow(f, 5) + dome * R * (1 - f) * (1 - f);
  tops.forEach(([f, key], i) => prof.push({ r: R * f, y: ty(f), key, sway: sw(R * f, cup * R), crease: i === 0, lift: i > 0 ? pleat(R * 0.012 * f) : undefined }));
  prof.push({ r: 0, y: ty(0), key: 'bone', sway: sw(0, dome * R) });
  revolve(b, o, axis, prof, 48, rng.range(0, 1));
  // dangling fringe filaments from the rim underside
  if (d.fringe) {
    for (let k = 0; k < d.fringe; k++) {
      const a = (k / d.fringe) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const rr = R * rng.range(0.82, 0.97);
      const fu = (rr - rs * 0.9) / (R - rs * 0.9);
      const top: V3 = add(o, [Math.cos(a) * rr, -0.12 * R * Math.pow(1 - fu, 1.6) + cup * R * fu * fu + FLARE * R * Math.pow(fu, 5) + gill * 0.5, Math.sin(a) * rr]);
      const L = H * rng.range(0.12, 0.3);
      const pts: V3[] = [];
      for (let i = 0; i <= 6; i++) {
        const s = i / 6;
        pts.push(add(top, [Math.cos(a) * s * s * L * 0.08, -s * L, Math.sin(a) * s * s * L * 0.08]));
      }
      const s0 = sw(rr, cup * R);
      sweep(b, pts, {
        segs: 4, radius: (s) => 0.55 * (1 - 0.6 * s),
        key: (s) => (s < 0.5 ? 'maroon' : 'crimson'), sway: (s) => s0 + (1 - s0) * s,
      });
      if (k % 4 === 0) bead(b, pts[6], [0, -1, 0], 1.1, 6, 3, 'glow', 1, 1);
    }
  }
}
