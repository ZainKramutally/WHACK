// Silicon-only archetypes (flora-traits §2b; owner ask: more plant things on silicon). All [speculative]: living
// silicon-nitride crystal is our world's invention, each form reasoned from silicon's own conditions (liquid-N₂
// shallows, ~1% light, ~13 kg/m³ air, −183 °C, the sea margin). Silicon grammar as crystal.ts: straight hex prisms and
// 3-sided struts, 60° steps, flat-shaded facets, far LOD = near; no curl. Crystals are stiff (a third of carbon's
// sway) and never bend or droop (vary.ts), so their part weights stay (0, 0).
//   nitrideCrown  (ground) a crown of hex columns leaning out of a glowing geode dish: the sea-margin band
//   lanternBulb   (ground) faceted bulbs on struts, glow-site waists: lures where light is scarce
//   laceFan       (mid)    a hexagonal 60° lattice fan on a stalk: filters the dense air
//   airPlankton   (mid)    a hexagonal raft of gas bladders on a tether: floats in the thick air
//   glassKelp     (mid)    a hex stalk with leaning hex blades: the deeper water of the clear N₂ sea
import { MeshBuilder, add, clamp01, len, norm, revolve, rod, scl, sub, type FloraKey, type V3 } from '../mesh';
import type { Rng } from '../rng';

const UP: V3 = [0, 1, 0];
const D60 = Math.PI / 3;
const D15 = Math.PI / 12;
const STIFF = 0.35;
/** Unit direction at `tilt` from vertical towards azimuth `az`. */
const dirAt = (tilt: number, az: number): V3 => [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];

/** A thin 3-sided strut from a to e with a flat cap (lace, spars, tethers): two bands, 9 tris. */
function strut(b: MeshBuilder, a: V3, e: V3, r: number, body: FloraKey, cap: FloraKey, sa: number, se: number, glow = 0) {
  const ax = sub(e, a), L = len(ax);
  if (L < 1e-6) return;
  revolve(b, a, ax, [
    { r, y: 0, key: body, sway: sa, crease: true },
    { r: r * 0.85, y: L, key: cap, glow, sway: se, crease: true },
    { r: 0, y: L, key: cap, glow, sway: se },
  ], 3);
}

/** A hex column from o along d (length L, radius r): crimson body, blush shoulder, a pointed bone tip. 30 tris. */
function column(b: MeshBuilder, o: V3, d: V3, L: number, r: number, sway: (y: number) => number, phase: number) {
  const y = (s: number) => o[1] + d[1] * L * s;
  revolve(b, o, d, [
    { r, y: 0, key: 'crimson', sway: sway(y(0)), crease: true },
    { r, y: L * 0.78, key: 'blush', sway: sway(y(0.78)), crease: true },
    { r: r * 0.7, y: L * 0.88, key: 'bone', sway: sway(y(0.88)), crease: true },
    { r: 0, y: L, key: 'bone', sway: sway(y(1)) },
  ], 6, phase);
}

/** S1 (ground, ~1 m): a low hex geode dish with a glowing floor, crowned by six hex columns leaning out 15° and one
 * tall one in the middle. Nitride precipitates where the liquid-N₂ margin evaporates (the M2 crust bands). ~250 tris. */
export function nitrideCrown(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = rng.range(0.9, 1.2), R = H * 0.45;
  const sw = (y: number) => STIFF * clamp01(y / H) * 0.5;
  revolve(b, [0, -0.05, 0], UP, [
    { r: R * 0.85, y: 0, key: 'ink', sway: 0, crease: true },
    { r: R, y: H * 0.08, key: 'crimson', sway: 0, crease: true },
    { r: R * 0.92, y: H * 0.16, key: 'bone', sway: sw(H * 0.16), crease: true },
    { r: R * 0.6, y: H * 0.12, key: 'glow', glow: 1, sway: sw(H * 0.12), crease: true },
    { r: 0, y: H * 0.1, key: 'glow', glow: 1, sway: sw(H * 0.1) },
  ], 6, rng.range(0, 1));
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 6; k++) {
    const az = az0 + k * D60;
    const o: V3 = [Math.cos(az) * R * 0.7, H * 0.08, Math.sin(az) * R * 0.7];
    column(b, o, dirAt(D15, az), H * rng.range(0.55, 0.85), H * 0.055, sw, k * 0.1);
  }
  column(b, [0, H * 0.08, 0], UP, H * 0.92, H * 0.07, sw, 0.5);
  return b.build({ flat: true });
}

/** S5 (ground, ~1 m): three faceted hex bulbs on struts, the side ones leaning out 15°; each bulb's waist and crown are
 * a glow site, lit only in the dark (glow from darkness: a lure where light is scarce). ~135 tris. */
export function lanternBulb(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = rng.range(0.8, 1.2);
  const sw = (y: number) => STIFF * clamp01(y / H) * 0.7;
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 3; k++) {
    const az = az0 + (k * 2 * Math.PI) / 3;
    const o: V3 = k === 0 ? [0, -0.05, 0] : [Math.cos(az) * H * 0.22, -0.05, Math.sin(az) * H * 0.22];
    const d = k === 0 ? UP : dirAt(D15, az);
    const h = H * (k === 0 ? 0.62 : rng.range(0.35, 0.5)), top = add(o, scl(d, h));
    strut(b, o, top, H * 0.022, 'crimson', 'crimson', 0, sw(top[1]));
    const Rb = H * (k === 0 ? 0.13 : 0.1);
    revolve(b, top, d, [
      { r: 0, y: 0, key: 'blush', sway: sw(top[1]) },
      { r: Rb * 0.8, y: Rb * 0.5, key: 'blush', sway: sw(top[1]), crease: true },
      { r: Rb, y: Rb * 1.1, key: 'glow', glow: 1, sway: sw(top[1] + Rb), crease: true },
      { r: Rb * 0.75, y: Rb * 1.7, key: 'bone', sway: sw(top[1] + Rb * 1.7), crease: true },
      { r: 0, y: Rb * 2.2, key: 'glowDeep', glow: 0.6, sway: sw(top[1] + Rb * 2.2) },
    ], 6, k * 0.2);
  }
  return b.build({ flat: true });
}

/** S2 (mid, ~7 m): a hex stalk carrying a vertical hexagonal fan of 3-sided struts: six spokes, three hexagonal rings
 * and diagonals between them, so the cells are 60° triangles. A suspension filter for the dense air, on the sea-fan
 * analogy (gorgonians spread across the flow to catch plankton) [analogue; speculative on silicon]. ~370 tris. */
export function laceFan(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 7 * rng.range(0.92, 1.08);
  const sw = (y: number) => STIFF * clamp01(Math.pow(Math.max(0, y) / H, 1.3));
  const hub = H * 0.35;
  rod(b, [0, -0.2, 0], [0, hub, 0], H * 0.035, H * 0.026, 6, (s) => (s < 0.3 ? 'ink' : 'crimson'), (s) => sw(s * hub));
  const Rf = H * 0.32, C: V3 = [0, hub + Rf, 0], yaw = rng.range(0, Math.PI * 2);
  const ex: V3 = [Math.cos(yaw), 0, Math.sin(yaw)];
  // node on ring i (0 = hub .. 3 = rim) at spoke k: the fan stands in the plane of ex and up, a vertex at the top
  const node = (i: number, k: number): V3 => {
    const th = Math.PI / 2 + k * D60, r = (Rf * i) / 3;
    return add(C, add(scl(ex, Math.cos(th) * r), [0, Math.sin(th) * r, 0]));
  };
  const r0 = H * 0.009;
  strut(b, [0, hub - H * 0.02, 0], C, H * 0.02, 'crimson', 'crimson', sw(hub), sw(C[1]));
  for (let k = 0; k < 6; k++) {
    const a = node(3, k);
    strut(b, C, a, r0 * 1.3, 'crimson', 'blush', sw(C[1]), sw(a[1]));
    for (let i = 1; i <= 3; i++) {
      const p = node(i, k), q = node(i, k + 1);
      strut(b, p, q, r0, i === 3 ? 'bone' : 'blush', i === 3 ? 'bone' : 'blush', sw(p[1]), sw(q[1]), i === 3 && k % 2 === 0 ? 0.5 : 0);
      if (i < 3) { const s = node(i + 1, k + 1); strut(b, p, s, r0 * 0.8, 'blush', 'blush', sw(p[1]), sw(s[1])); }
    }
  }
  return b.build({ flat: true });
}

/** S3 (mid, ~9 m): an anchor crystal, a hex filament tether and, at its top, a hexagonal raft of seven gas bladders on
 * 60° spars. 3.6 bar of N₂ at −183 °C is ≈ 11 × Earth's air density, so a gas bladder lifts ≈ 11 × as much [physics];
 * the lifting gas and living rafts are [speculative] (as A6). Bladder crowns are glow sites. ~170 tris. */
export function airPlankton(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 9 * rng.range(0.92, 1.08);
  const sw = (y: number) => 0.6 * clamp01(Math.max(0, y) / H);
  revolve(b, [0, -0.2, 0], UP, [
    { r: H * 0.04, y: 0, key: 'ink', sway: 0, crease: true },
    { r: H * 0.03, y: H * 0.03, key: 'crimson', sway: 0, crease: true },
    { r: 0, y: H * 0.06, key: 'crimson', sway: 0 },
  ], 6, rng.range(0, 1));
  const C: V3 = [0, H * 0.86, 0];
  strut(b, [0, H * 0.04, 0], C, H * 0.006, 'crimson', 'blush', 0, sw(C[1]));
  const Rr = H * 0.12, Lb = H * 0.09, az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k <= 6; k++) {
    const az = az0 + k * D60;
    const p: V3 = k === 6 ? C : [Math.cos(az) * Rr, C[1] + (k % 2 ? -0.03 : 0.03) * H, Math.sin(az) * Rr];
    if (k < 6) strut(b, C, p, H * 0.005, 'blush', 'blush', sw(C[1]), sw(p[1]));
    const L = k === 6 ? Lb * 1.3 : Lb * rng.range(0.85, 1.05);
    revolve(b, add(p, [0, -L * 0.5, 0]), UP, [
      { r: 0, y: 0, key: 'blush', sway: sw(p[1]) },
      { r: L * 0.42, y: L * 0.5, key: 'glow', glow: 1, sway: sw(p[1]), crease: true },
      { r: 0, y: L, key: 'bone', sway: sw(p[1]) },
    ], 6, k * 0.1);
  }
  return b.build({ flat: true });
}

/** S4 (mid, aquatic, ~8 m): a hex stalk with six thin hex blades leaning out at 60° steps up its length, reaching up
 * through the clear liquid nitrogen (it is colourless, so light reaches deeper water [speculative]). Sized to the depth
 * less half a metre, so it never breaks the surface. ~230 tris. */
export function glassKelp(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 8 * rng.range(0.92, 1.08);
  const sw = (y: number) => STIFF * clamp01(Math.pow(Math.max(0, y) / H, 1.2));
  rod(b, [0, -0.1, 0], [0, H * 0.9, 0], H * 0.03, H * 0.016, 6, (s) => (s < 0.15 ? 'ink' : 'crimson'), (s) => sw(s * H * 0.9), H * 0.1);
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < 6; k++) {
    const y = H * (0.22 + 0.11 * k), az = az0 + k * D60 * 2;   // alternate sides (120° steps)
    const out = dirAt(D60, az), Rp = H * (0.11 - 0.008 * k), th = Rp * 0.06;
    const at: V3 = [0, y, 0], c = add(at, scl(out, Rp * 0.9));
    strut(b, at, c, H * 0.008, 'crimson', 'crimson', sw(y), sw(c[1]));
    const n = norm(add(scl(out, 0.5), [0, 0.87, 0]));   // the blade leans 30° off vertical, facing out and up
    revolve(b, add(c, scl(n, -th)), n, [
      { r: 0, y: 0, key: 'crimson', sway: sw(c[1]) },
      { r: Rp, y: th, key: 'blush', sway: sw(c[1]), crease: true },
      { r: Rp * 0.9, y: th * 2, key: 'bone', sway: sw(c[1]), crease: true },
      { r: 0, y: th * 3, key: 'bone', sway: sw(c[1]) },
    ], 6, k * 0.1);
  }
  return b.build({ flat: true });
}
