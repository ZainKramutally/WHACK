// Silicon flora (new; no reference species fits the grammar). Straight hexagonal stems, branches that leave their trunk
// at exactly 60°, faceted (flat-normal) caps, and no curl anywhere. Value still inverts with height: ink/maroon bases,
// crimson (violet on the silicon palette) mid, blush/bone tops. Crystals are stiff, so sway is a third of carbon's.
//   prismTitan (giant, ~30 m): 0 plates (bright: wide hex caps), 1 lanterns (dim: glowing bipyramid pods),
//                              2 candelabra (dim: branches snap back vertical), 3 pagoda (bright: stacked hex plates)
//   shardTree (mid, ~10 m):    0 opposite shards, 1 pod shards (dim), 2 basalt column cluster, 3 lattice fan
//   crystalGround (0.3–2 m):   0 druse, 1 tile crust, 2 needle tuft, 3 geode cup
import { MeshBuilder, add, clamp01, norm, revolve, rod, rotate, scl, sub, type ProfilePt, type V3 } from '../mesh';
import type { Rng } from '../rng';

const UP: V3 = [0, 1, 0];
const D60 = Math.PI / 3;
/** Unit direction at `tilt` from vertical towards azimuth `az`. */
const dirAt = (tilt: number, az: number): V3 => [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
/** Snap an angle to 15° (silicon joints). */
const snap15 = (a: number) => Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
const STIFF = 0.35;

/** Horizontal faceted hex plate (cap) centred on `c`: violet underside, pale top, low pyramid crown. */
function hexPlate(b: MeshBuilder, c: V3, R: number, sway: number, phase: number) {
  const th = R * 0.08;
  revolve(b, add(c, [0, -th, 0]), UP, [
    { r: R * 0.15, y: 0, key: 'maroon', sway, crease: true, cap: 0.15 },
    { r: R * 0.6, y: th * 0.4, key: 'crimson', sway, crease: true, cap: 0.6 },
    { r: R, y: th, key: 'blush', sway, crease: true, cap: 1, rim: 1 },
    { r: R * 0.97, y: th * 1.6, key: 'bone', sway, crease: true, cap: 1, rim: 1 },
    { r: R * 0.5, y: th * 2.2, key: 'bone', sway, crease: true, cap: 0.5 },
    { r: 0, y: th * 3.2, key: 'bone', sway },
  ], 6, phase);
}

/** Hexagonal bipyramid pod along `d` from `o`, with a glow-site band at its waist (glows only in the dark). */
function pod(b: MeshBuilder, o: V3, d: V3, L: number, sway: number) {
  const R = L * 0.3;
  const prof: ProfilePt[] = [
    { r: 0, y: 0, key: 'crimson', sway },
    { r: R * 0.8, y: L * 0.32, key: 'blush', sway, crease: true },
    { r: R, y: L * 0.45, key: 'glow', glow: 1, sway, crease: true },
    { r: R, y: L * 0.58, key: 'blush', sway, crease: true },
    { r: R * 0.6, y: L * 0.8, key: 'bone', sway, crease: true },
    { r: 0, y: L, key: 'bone', sway },
  ];
  revolve(b, o, d, prof, 6);
}

export function prismTitan(rng: Rng, variant: number) {
  const H = [30, 32, 28, 34][variant] * rng.range(0.94, 1.06);
  const b = new MeshBuilder();
  const sw = (y: number) => STIFF * clamp01(Math.pow(Math.max(0, y) / H, 1.5));
  const rT = H * 0.028;
  const ph = rng.range(0, 1);
  // trunk: straight hex prism, tapering, in three value bands
  const trunkTop = H * (variant === 1 ? 0.86 : variant === 3 ? 0.9 : 0.8);
  rod(b, [0, -0.3, 0], [0, H * 0.12, 0], rT * 1.6, rT * 1.15, 6, () => 'ink', (s) => sw(s * H * 0.12), 0, ph);
  rod(b, [0, H * 0.12, 0], [0, H * 0.45, 0], rT * 1.15, rT * 0.85, 6, () => 'maroon', (s) => sw(H * (0.12 + 0.33 * s)), 0, ph);
  rod(b, [0, H * 0.45, 0], [0, trunkTop, 0], rT * 0.85, rT * 0.5, 6, () => 'crimson', (s) => sw(H * 0.45 + (trunkTop - H * 0.45) * s), variant === 1 ? H * 0.1 : 0, ph);
  const az0 = rng.range(0, Math.PI * 2);
  if (variant === 3) {
    // pagoda: stacked hex plates shrinking upward, short 60° struts beneath each
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const y = H * (0.42 + 0.15 * k);
      const R = H * (0.3 - 0.055 * k);
      for (let q = 0; q < 3; q++) {
        const d = dirAt(D60, az0 + k * 0.5 + (q * 2 * Math.PI) / 3);
        const o: V3 = [0, y - R * 0.45, 0];
        rod(b, o, add(o, scl(d, R * 0.5)), rT * 0.3, rT * 0.2, 6, () => 'crimson', () => sw(y), 0);
      }
      hexPlate(b, [0, y, 0], R, sw(y), ph + k * 0.08);
    }
    return b.build({ flat: true });
  }
  const tiers = variant === 2 ? 2 : 3;
  for (let k = 0; k < tiers; k++) {
    const y = H * (0.36 + (0.4 * k) / Math.max(1, tiers - 1)) * (variant === 2 ? 0.9 : 1);
    const L = H * (0.3 - 0.06 * k) * rng.range(0.9, 1.1);
    for (let q = 0; q < 4; q++) {
      const az = az0 + k * (Math.PI / 4) + (q * Math.PI) / 2;
      const d = dirAt(D60, az);
      const o: V3 = [0, y, 0];
      const e = add(o, scl(d, L));
      rod(b, o, e, rT * 0.42, rT * 0.28, 6, (s) => (s < 0.5 ? 'crimson' : 'blush'), (s) => sw(y + (e[1] - y) * s), 0);
      if (variant === 0) hexPlate(b, add(e, [0, rT * 0.2, 0]), H * (0.11 - 0.015 * k), sw(e[1]), ph + q * 0.1);
      else if (variant === 1) pod(b, e, norm(add(d, [0, -1.2, 0])), H * 0.09, sw(e[1]));
      else {
        // candelabra: the branch snaps back to vertical (60° from the branch) and ends in a pointed crystal
        const top = add(e, [0, L * 0.7, 0]);
        rod(b, e, top, rT * 0.28, rT * 0.2, 6, (s) => (s < 0.6 ? 'blush' : 'bone'), (s) => sw(e[1] + (top[1] - e[1]) * s), H * 0.035);
        pod(b, add(top, [0, H * 0.03, 0]), UP, H * 0.05, sw(top[1]));
      }
    }
  }
  if (variant === 0) hexPlate(b, [0, trunkTop, 0], H * 0.27, sw(trunkTop), ph);
  else if (variant === 1) pod(b, [0, trunkTop + H * 0.1, 0], UP, H * 0.1, sw(H));
  return b.build({ flat: true });
}

export function shardTree(rng: Rng, variant: number) {
  const H = [10, 11, 7, 12][variant] * rng.range(0.92, 1.08);
  const b = new MeshBuilder();
  const sw = (y: number) => STIFF * clamp01(Math.pow(Math.max(0, y) / H, 1.4));
  const rT = H * 0.035;
  const az0 = rng.range(0, Math.PI * 2);
  if (variant === 2) {
    // basalt column cluster: hex columns of stepped height, pyramid caps
    const n = rng.int(4, 6);
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996 + az0, rr = k === 0 ? 0 : H * 0.075 * Math.sqrt(k);
      const h = H * (k === 0 ? 1 : rng.range(0.35, 0.85));
      const o: V3 = [Math.cos(a) * rr, -0.2, Math.sin(a) * rr];
      const r = H * rng.range(0.03, 0.05);
      revolve(b, o, UP, [
        { r: r * 1.05, y: 0, key: 'ink', sway: 0, crease: true },
        { r, y: h * 0.3, key: 'maroon', sway: sw(h * 0.3), crease: true },
        { r, y: h * 0.7, key: 'crimson', sway: sw(h * 0.7), crease: true },
        { r: r * 0.95, y: h * 0.92, key: 'blush', sway: sw(h), crease: true },
        { r: 0, y: h, key: 'bone', sway: sw(h) },
      ], 6, rng.range(0, 1));
    }
    return b.build({ flat: true });
  }
  const top: V3 = [0, H * 0.85, 0];
  rod(b, [0, -0.2, 0], [0, H * 0.3, 0], rT * 1.4, rT, 6, () => 'ink', (s) => sw(s * H * 0.3));
  rod(b, [0, H * 0.3, 0], top, rT, rT * 0.55, 6, (s) => (s < 0.5 ? 'maroon' : 'crimson'), (s) => sw(H * (0.3 + 0.55 * s)), H * 0.1);
  if (variant === 3) {
    // lattice fan: two 60° branches; each sprouts a child that snaps back to vertical (60° from its parent)
    for (const side of [-1, 1]) {
      const az = az0 + (side > 0 ? 0 : Math.PI);
      const o: V3 = [0, H * 0.32, 0];
      const d = dirAt(D60, az);
      const e = add(o, scl(d, H * 0.45));
      rod(b, o, e, rT * 0.6, rT * 0.4, 6, () => 'crimson', (s) => sw(o[1] + (e[1] - o[1]) * s), H * 0.05);
      for (let k = 1; k <= 2; k++) {
        const p = add(o, scl(d, H * 0.45 * (k / 2.2)));
        const t = add(p, [0, H * (0.35 - 0.08 * k), 0]);
        rod(b, p, t, rT * 0.35, rT * 0.25, 6, (s) => (s < 0.5 ? 'blush' : 'bone'), (s) => sw(p[1] + (t[1] - p[1]) * s), H * 0.05);
      }
    }
    return b.build({ flat: true });
  }
  // opposite pairs at 60°, each tier turned 90°
  for (let k = 0; k < 2; k++) {
    const y = H * (0.42 + 0.22 * k);
    const L = H * (0.38 - 0.1 * k);
    for (const s0 of [0, Math.PI]) {
      const d = dirAt(D60, az0 + s0 + k * (Math.PI / 2));
      const o: V3 = [0, y, 0], e = add(o, scl(d, L));
      rod(b, o, e, rT * 0.5, rT * 0.32, 6, (s) => (s < 0.5 ? 'crimson' : 'blush'), (s) => sw(y + (e[1] - y) * s), variant === 0 ? H * 0.06 : 0);
      if (variant === 1) pod(b, e, norm(add(d, [0, -1.4, 0])), H * 0.12, sw(e[1]));
    }
  }
  if (variant === 1) pod(b, add(top, [0, H * 0.08, 0]), UP, H * 0.1, sw(H));
  return b.build({ flat: true });
}

/** Lean faceted prism for ground cover: one body band and a pointed tip (≈ 3·segs triangles). */
function prism(b: MeshBuilder, a: V3, e: V3, r: number, segs: number, body: 'maroon' | 'crimson', sway: (s: number) => number, tip: number) {
  const ax = sub(e, a), L = Math.hypot(ax[0], ax[1], ax[2]);
  revolve(b, a, ax, [
    { r, y: 0, key: body, sway: sway(0), crease: true },
    { r: r * 0.9, y: L, key: 'bone', sway: sway(1), crease: true },
    { r: 0, y: L + tip, key: 'bone', sway: sway(1) },
  ], segs);
}

// Ground cover is the most numerous flora (thousands of instances), so it stays lean: ~100–160 triangles each.
export function crystalGround(rng: Rng, variant: number) {
  const b = new MeshBuilder();
  const H = [1.2, 0.5, 1.6, 0.9][variant] * rng.range(0.9, 1.1);
  const sw = (y: number) => STIFF * clamp01(y / H) * 0.6;
  if (variant === 0 || variant === 2) {
    // druse / needle tuft: crystals from one point, tilts snapped to 15°
    const n = variant === 0 ? rng.int(5, 7) : rng.int(8, 11);
    for (let k = 0; k < n; k++) {
      const tilt = snap15(k === 0 ? 0 : rng.range(0.25, variant === 0 ? 0.9 : 0.75));
      const d = dirAt(tilt, k * 2.39996);
      const L = H * (k === 0 ? 1 : rng.range(0.45, 0.9));
      const r = variant === 0 ? L * 0.13 : L * 0.045;
      const e = scl(d, L);
      prism(b, [0, -0.05, 0], e, r, variant === 0 ? 6 : 4, k === 0 ? 'maroon' : 'crimson', (s) => sw(e[1] * s), r * 1.6);
    }
    return b.build({ flat: true });
  }
  if (variant === 1) {
    // tile crust: low hex tiles of mixed size; a few carry a glow-site core
    const n = rng.int(4, 6);
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996, rr = k === 0 ? 0 : 0.38 * Math.sqrt(k);
      const R = rng.range(0.24, 0.42), h = H * rng.range(0.4, 1);
      const o: V3 = [Math.cos(a) * rr, -0.05, Math.sin(a) * rr];
      const core = k % 3 === 0;
      revolve(b, o, UP, core ? [
        { r: R, y: 0, key: 'maroon', sway: 0, crease: true },
        { r: R * 0.9, y: h, key: 'blush', sway: sw(h), crease: true },
        { r: R * 0.35, y: h * 1.05, key: 'glow', glow: 1, sway: sw(h), crease: true },
        { r: 0, y: h * 1.1, key: 'glow', glow: 1, sway: sw(h) },
      ] : [
        { r: R, y: 0, key: 'maroon', sway: 0, crease: true },
        { r: R * 0.9, y: h, key: 'blush', sway: sw(h), crease: true },
        { r: 0, y: h * 1.1, key: 'bone', sway: sw(h) },
      ], 6, rng.range(0, 1));
    }
    return b.build({ flat: true });
  }
  // geode cup: an open hex cup; its inner lining is a glow site. The wall is ink only at its foot (bases ink, then
  // maroon): an all-ink wall left 58% of the cup ink, a black blob on the dim silicon world.
  const R = H * 0.55;
  revolve(b, [0, -0.05, 0], UP, [
    { r: R * 0.5, y: 0, key: 'ink', sway: 0, crease: true },
    { r: R * 0.68, y: H * 0.3, key: 'maroon', sway: sw(H * 0.3), crease: true },
    { r: R * 1.1, y: H, key: 'maroon', sway: sw(H), crease: true },
    { r: R * 0.85, y: H * 1.02, key: 'bone', sway: sw(H), crease: true },
    { r: R * 0.55, y: H * 0.6, key: 'glow', glow: 1, sway: sw(H), crease: true },
    { r: 0, y: H * 0.35, key: 'glow', glow: 1, sway: sw(H) },
  ], 6, rng.range(0, 1));
  // three spikes on the rim
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const o: V3 = [Math.cos(a) * R, H * 0.95, Math.sin(a) * R];
    const d = rotate(UP, norm([-Math.sin(a), 0, Math.cos(a)]), -D60 * 0.5);
    prism(b, o, add(o, scl(d, H * 0.3)), H * 0.05, 3, 'crimson', () => sw(H), H * 0.08);
  }
  return b.build({ flat: true });
}

/**
 * Whisker reef (silicon mid; flora-traits A8): "clear liquid nitrogen shows the first crystal life from the shore". A
 * bristle of long hex needles leaning out in 15° steps from one base, each tipped with a glow site (lit only in the
 * dark). Elongated hexagonal whiskers echo β-Si₃N₄ grain habit ([unverified], [speculative] as life). place.ts sizes it
 * to the depth less half a metre, so it never breaks the surface (crystals don't float). ~210 tris, far LOD = near.
 */
export function whiskerReef(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 6 * rng.range(0.94, 1.06);
  const sw = (y: number) => STIFF * clamp01(y / H) * 0.8;
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 5; k++) {
    const tilt = k === 0 ? 0 : (Math.PI / 12) * (1 + ((k - 1) % 3));   // 15°, 30°, 45° steps
    const d = dirAt(tilt, az0 + k * D60 * 1.2);
    const L = (k === 0 ? H : H * rng.range(0.55, 0.85)) / Math.cos(tilt);
    const r = H * 0.032;
    revolve(b, [0, -0.1, 0], d, [
      { r: r * 1.3, y: 0, key: 'ink', sway: 0, crease: true },
      { r: r * 1.1, y: L * 0.06, key: 'maroon', sway: sw(L * 0.06 * d[1]), crease: true },
      { r: r * 0.95, y: L * 0.4, key: 'crimson', sway: sw(L * 0.4 * d[1]), crease: true },
      { r: r * 0.6, y: L * 0.9, key: 'glow', glow: 1, sway: sw(L * 0.9 * d[1]), crease: true },
      { r: 0, y: L, key: 'glow', glow: 1, sway: sw(L * d[1]) },
    ], 6, k * 0.1);
  }
  return b.build({ flat: true });
}

/**
 * Frost fern (silicon ground; flora-traits A7): "rich supply branches the crystals". Three vertical blades at 120°,
 * each a spine leaning out 15° with two pairs of side branches at 60° in the blade's plane. Fast growth at high
 * supersaturation breaks flat faces into 60° dendrites (Mullins & Sekerka 1964; Libbrecht 2005 for ice) [sci
 * mechanism, speculative on silicon]. ~135 tris, far LOD = near.
 */
export function frostFern(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = rng.range(0.9, 1.1);
  const sw = (y: number) => STIFF * clamp01(y / H) * 0.6;
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 3; k++) {
    const az = az0 + (k * 2 * Math.PI) / 3;
    const spine = dirAt(Math.PI / 12, az);
    const n = norm([-Math.sin(az), 0, Math.cos(az)]); // the blade plane's normal
    const o: V3 = [0, -0.05, 0], L = H / Math.cos(Math.PI / 12);
    prism(b, o, add(o, scl(spine, L)), H * 0.05, 3, 'maroon', (s) => sw(s * H), H * 0.08);
    for (const t of [0.35, 0.65]) for (const sgn of [-1, 1]) {
      const p = add(o, scl(spine, L * t));
      const d = rotate(spine, n, sgn * D60);
      const bl = L * (0.45 - 0.25 * t);
      prism(b, p, add(p, scl(d, bl)), H * 0.03, 3, 'crimson', (s) => sw(p[1] + s * bl * d[1]), H * 0.05);
    }
  }
  return b.build({ flat: true });
}
