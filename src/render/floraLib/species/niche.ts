// Carbon niche archetypes (flora-traits §2c; owner ask: "plants that differ with temperature, nitrogen, oxygen and rock").
// Each takes over from a base kind within normal slider moves, ramped in gates.ts. Carbon grammar as the base species:
// smooth revolves and curling sweeps, ring bands, round caps; glow sites are lit only in the dark. Earth patterns applied
// to our plants by analogy, tagged per builder. None sets part weights, so aPart stays (0, 0) (the crack scan holds).
//   barrelSucculent (mid)    hot: ribbed columnar succulent with upturned arms (CAM: thick, ribbed, leafless) [analogue]
//   thornShrub      (ground) hot: twiggy mound of tiny leaves and pale thorns (leaf size falls with heat; Wright 2017) [sci]
//   nitroGrove      (mid)    N-rich: a stout stalk with huge broad leaf caps (nitrogen loading → big leaves, fast growth) [analogue]
//   lycopodGiant    (giant)  O₂-rich: scale-barked trunk forking twice, cones at the tips (Lepidodendron) [analogue]
//   heathShrub      (ground) granite: a low dense dome of tiny bell flowers (heath on poor acid ground) [analogue]
//   ironReeds       (ground) ironstone: a sheaf of rust-red reeds with seed heads (metallophytes) [analogue]
import { MeshBuilder, add, bead, bezier, clamp01, norm, revolve, rod, scl, sweep, type ProfilePt, type V3 } from '../mesh';
import type { Rng } from '../rng';

const UP: V3 = [0, 1, 0];
const dirAt = (tilt: number, az: number): V3 => [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];

/** Hot mid (~6 m): a ribbed column (6 ribs) with two arms curving up from mid-height, a bone crown with glow buds. */
export function barrelSucculent(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 6 * rng.range(0.92, 1.08), R = H * 0.11;
  const sw = (y: number) => 0.35 * clamp01(Math.max(0, y) / H);   // a water-filled column barely sways
  const ribs = (j: number) => 1 + (j % 2 ? 0.14 : -0.1);
  revolve(b, [0, -0.2, 0], UP, [
    { r: R * 1.1, y: 0, key: 'maroon', sway: 0, mod: ribs },
    { r: R, y: H * 0.15, key: 'crimson', sway: sw(H * 0.15), mod: ribs },
    { r: R * 1.04, y: H * 0.55, key: 'crimson', sway: sw(H * 0.55), mod: ribs },
    { r: R * 0.9, y: H * 0.85, key: 'blush', sway: sw(H * 0.85), mod: ribs },
    { r: R * 0.55, y: H * 0.97, key: 'bone', sway: sw(H), mod: ribs },
    { r: 0, y: H, key: 'glowDeep', glow: 0.6, sway: sw(H) },
  ], 12, rng.range(0, 1));
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 2; k++) {
    const az = az0 + k * Math.PI + rng.range(-0.3, 0.3), d: V3 = [Math.cos(az), 0, Math.sin(az)];
    const y0 = H * rng.range(0.35, 0.5), reach = H * 0.22, top = y0 + H * rng.range(0.25, 0.35);
    const pts = bezier([d[0] * R * 0.6, y0, d[2] * R * 0.6], [d[0] * reach, y0, d[2] * reach], [d[0] * reach, y0 + (top - y0) * 0.4, d[2] * reach], [d[0] * reach, top, d[2] * reach], 5);
    sweep(b, pts, { segs: 8, radius: (s) => R * 0.62 * (s > 0.85 ? 0.7 : 1), key: (s) => (s > 0.85 ? 'blush' : 'crimson'), sway: (_s, p) => sw(p[1]) });
    bead(b, [d[0] * reach, top + R * 0.15, d[2] * reach], UP, R * 0.35, 6, 2, 'glowDeep', 0.6, sw(top));
  }
  return b.build();
}

/** Hot ground (~1 m): seven forking twigs splaying from the root, each tipped with a pale thorn and a few tiny leaves. */
export function thornShrub(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = rng.range(0.9, 1.1);
  const sw = (y: number) => 0.8 * clamp01(Math.max(0, y) / H);
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 7; k++) {
    const az = az0 + k * 2.4, tilt = 0.35 + 0.5 * ((k * 0.37) % 1);
    const a: V3 = [0, -0.04, 0], m = add(a, scl(dirAt(tilt, az), H * 0.55)), e = add(m, scl(dirAt(tilt + 0.3, az + 0.5), H * 0.4));
    rod(b, a, m, H * 0.025, H * 0.016, 4, () => 'maroon', (s) => sw(a[1] + (m[1] - a[1]) * s));
    rod(b, m, e, H * 0.014, H * 0.006, 3, () => 'crimson', (s) => sw(m[1] + (e[1] - m[1]) * s), H * 0.08);   // the thorn tip
    rod(b, m, add(m, scl(dirAt(tilt - 0.4, az - 0.6), H * 0.22)), H * 0.01, H * 0.004, 3, () => 'bone', () => sw(m[1]), H * 0.05);
    bead(b, add(m, scl(dirAt(tilt, az), H * 0.12)), UP, H * 0.05, 4, 2, 'blush', 0, sw(m[1]));
  }
  return b.build();
}

/** N-rich mid (~8 m): a stout stalk carrying three huge, shallow leaf caps at staggered heights, and one unfurling crozier. */
export function nitroGrove(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 8 * rng.range(0.92, 1.08);
  const sw = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.3));
  revolve(b, [0, -0.2, 0], UP, [
    { r: H * 0.06, y: 0, key: 'maroon', sway: 0 },
    { r: H * 0.04, y: H * 0.1, key: 'crimson', sway: sw(H * 0.1) },
    { r: H * 0.03, y: H * 0.85, key: 'crimson', sway: sw(H * 0.85) },
    { r: 0, y: H * 0.88, key: 'blush', sway: sw(H) },
  ], 8, rng.range(0, 1));
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 3; k++) {
    const az = az0 + k * 2.1, y = H * (0.48 + 0.18 * k), R = H * (0.34 - 0.05 * k);
    const out: V3 = [Math.cos(az), 0, Math.sin(az)], at: V3 = [0, y, 0], c = add(at, scl(out, R * 0.75));
    sweep(b, [at, add(at, [out[0] * R * 0.4, R * 0.12, out[2] * R * 0.4]), c], { segs: 5, radius: () => H * 0.012, key: () => 'crimson', sway: (_s, p) => sw(p[1]) });
    const n = norm(add(scl(out, 0.35), UP));   // the cap tips out and up, to the light
    revolve(b, c, n, [
      { r: 0, y: -R * 0.02, key: 'blush', sway: sw(y) },
      { r: R * 0.92, y: -R * 0.05, key: 'blush', sway: sw(y) },
      { r: R, y: 0, key: 'crimson', sway: sw(y), crease: true },
      { r: R * 0.5, y: R * 0.1, key: 'crimson', sway: sw(y), crease: true },
      { r: 0, y: R * 0.06, key: 'blush', sway: sw(y) },
    ], 12, k * 0.3);
  }
  const top: V3 = [0, H * 0.86, 0], cd: V3 = [Math.cos(az0 + 1), 0, Math.sin(az0 + 1)];
  sweep(b, bezier(top, add(top, [0, H * 0.1, 0]), add(top, [cd[0] * H * 0.1, H * 0.16, cd[2] * H * 0.1]), add(top, [cd[0] * H * 0.08, H * 0.08, cd[2] * H * 0.08]), 5),
    { segs: 6, radius: (s) => H * 0.016 * (1 - 0.5 * s), key: (s) => (s > 0.7 ? 'bone' : 'crimson'), sway: (_s, p) => sw(p[1]) });
  return b.build();
}

/** O₂-rich giant (~26 m): a tall scale-barked trunk (alternating crimson and maroon diamond bands), forking twice into four
 * limbs, each ending in a strap-leaf tuft and a hanging cone. */
export function lycopodGiant(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 26 * rng.range(0.94, 1.06), R = H * 0.035;
  const sw = (y: number) => 0.6 * clamp01(Math.pow(Math.max(0, y) / H, 1.6));
  const scale = (j: number) => 1 + (j % 2 ? 0.05 : -0.05);
  const fork = H * 0.66;
  const prof: ProfilePt[] = [{ r: R * 1.6, y: 0, key: 'maroon', sway: 0 }];
  for (let i = 1; i <= 7; i++) {
    const y = (fork * i) / 7;
    prof.push({ r: R * (1.15 - 0.25 * (i / 7)), y, key: i % 2 ? 'crimson' : 'blush', sway: sw(y), mod: scale });
  }
  prof.push({ r: 0, y: fork + R, key: 'crimson', sway: sw(fork) });
  revolve(b, [0, -0.3, 0], UP, prof, 8, rng.range(0, 1));
  const az0 = rng.range(0, Math.PI * 2), F: V3 = [0, fork, 0];
  for (let k = 0; k < 2; k++) {
    const az = az0 + k * Math.PI, m = add(F, scl(dirAt(0.45, az), H * 0.14));
    rod(b, F, m, R * 0.7, R * 0.55, 6, () => 'crimson', (s) => sw(F[1] + (m[1] - F[1]) * s));
    for (let j = 0; j < 2; j++) {
      const az2 = az + (j ? 0.7 : -0.7), e = add(m, scl(dirAt(0.4, az2), H * 0.12));
      rod(b, m, e, R * 0.5, R * 0.38, 6, () => 'crimson', (s) => sw(m[1] + (e[1] - m[1]) * s));
      // the strap-leaf tuft: a shallow bone-and-blush cone around the tip
      revolve(b, e, UP, [
        { r: 0, y: -H * 0.015, key: 'bone', sway: sw(e[1]) },
        { r: H * 0.07, y: -H * 0.01, key: 'blush', sway: sw(e[1]), crease: true },
        { r: 0, y: H * 0.03, key: 'blush', sway: sw(e[1]) },
      ], 6, j * 0.3);
      bead(b, add(e, [0, -H * 0.035, 0]), UP, H * 0.016, 6, 3, 'glowDeep', 0.5, sw(e[1]));   // the hanging cone (a glow site)
    }
  }
  return b.build();
}

/** Granite ground (~0.6 m): a low, dense, rounded mound of fine twigs studded with tiny bell flowers. */
export function heathShrub(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = rng.range(0.55, 0.7), R = H * 1.1;
  const sw = (y: number) => 0.6 * clamp01(Math.max(0, y) / H);
  revolve(b, [0, -0.05, 0], UP, [
    { r: R * 0.85, y: 0, key: 'maroon', sway: 0 },
    { r: R, y: H * 0.3, key: 'crimson', sway: sw(H * 0.3) },
    { r: R * 0.7, y: H * 0.75, key: 'crimson', sway: sw(H * 0.75) },
    { r: 0, y: H * 0.95, key: 'blush', sway: sw(H) },
  ], 10, rng.range(0, 1));
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 14; k++) {
    const t = 0.25 + 0.6 * ((k * 0.618) % 1), az = az0 + k * 2.4;
    const rr = R * Math.cos(t * 1.3) * 0.95, y = H * (0.25 + 0.7 * t);
    bead(b, [Math.cos(az) * rr, y, Math.sin(az) * rr], UP, H * 0.06, 4, 2, k % 3 ? 'blush' : 'bone', 0, sw(y));
  }
  return b.build();
}

/** Ironstone ground (~1.4 m): a sheaf of eleven thin rust-red reeds leaning out, each with a long seed head. */
export function ironReeds(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = rng.range(1.25, 1.5);
  const sw = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.2));
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 11; k++) {
    const az = az0 + k * 2.4, tilt = 0.06 + 0.3 * ((k * 0.41) % 1), L = H * (0.7 + 0.3 * ((k * 0.73) % 1));
    const a: V3 = [Math.cos(az) * H * 0.04, -0.05, Math.sin(az) * H * 0.04], d = dirAt(tilt, az);
    const e = add(a, scl(d, L * 0.78)), t = add(a, scl(d, L));
    rod(b, a, e, H * 0.014, H * 0.009, 3, () => 'crimson', (s) => sw(a[1] + (e[1] - a[1]) * s));
    rod(b, e, t, H * 0.022, H * 0.012, 4, () => (k % 2 ? 'blush' : 'crimson'), (s) => sw(e[1] + (t[1] - e[1]) * s), H * 0.04);
  }
  return b.build();
}
