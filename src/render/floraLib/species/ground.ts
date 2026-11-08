// Ground cover (0.5-4 m), smooth enough to walk right up to. It is the most numerous carbon flora (thousands of
// instances), so it stays lean: ~200 tris each near (spike crowns ~270). Every colour band and profile ring of the Red
// World reference is kept; what thins is the ring sides (8 on domes, 6 on tubes) and the count of repeated parts.
// The far LOD (beyond 30 m, a few pixels tall) also keeps every other spike, blade and bristle, so it is ~60-110 tris.
//  0 urchin: ribbed dome bristling with radial spikes
//  1 polyp nubs: flared, ribbed tubes with dark cupped mouths
//  2 bristle tuft: fountain of curved crimson blades
//  3 spike crowns: 2-4 m stalks topped with thistle-like bristle crowns (crops well along the frame bottom)
import { MeshBuilder, add, clamp01, detail, norm, revolve, scl, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

export function groundCover(rng: Rng, variant: number) {
  const b = new MeshBuilder();
  // far LOD: every other spike, blade and bristle, thickened to keep its coverage. Each part still draws its random
  // numbers, so the parts both LODs share are identical and the swap at the LOD radius doesn't reshuffle the plant.
  const far = detail() < 1;
  const skip = (k: number) => far && k % 2 === 1;
  if (variant === 0) {
    const R = rng.range(0.32, 0.4);
    // on 8 sides, cos(3θ) gives the same 3-lobe ripple that the 9-rib term made on the reference's 12 sides
    const ribs = (_j: number, th: number) => 1 + 0.06 * Math.cos(3 * th);
    revolve(b, [0, -0.05, 0], [0, 1, 0], [
      { r: R * 1.08, y: 0, key: 'ink', sway: 0 },
      { r: R * 1.04, y: R * 0.25, key: 'maroon', sway: 0.05, mod: ribs },
      { r: R * 0.95, y: R * 0.55, key: 'maroon', sway: 0.12, mod: ribs },
      { r: R * 0.72, y: R * 0.82, key: 'crimson', sway: 0.18, mod: ribs },
      { r: R * 0.36, y: R * 0.98, key: 'crimson', sway: 0.2, crease: true },
      { r: R * 0.18, y: R * 1.0, key: 'glowDeep', glow: 0.6, sway: 0.2 },
      { r: 0, y: R * 0.94, key: 'glowDeep', glow: 0.6, sway: 0.2 },
    ], 8);
    // 36 three-sided spikes (the reference had 52 four-sided ones), thicker so the dome keeps ~80 % of its bristle mass
    const n = 36;
    for (let k = 0; k < n; k++) {
      const y = 0.06 + 0.94 * (k + 0.5) / n; // fibonacci hemisphere
      const a = k * 2.39996 + rng.range(-0.1, 0.1);
      const rr = Math.sqrt(1 - y * y);
      const d = norm([Math.cos(a) * rr, y, Math.sin(a) * rr]);
      const p0: V3 = add([0, R * 0.45, 0], scl(d, R * 0.72));
      const l = R * rng.range(1.4, 2.6);
      if (skip(k)) continue;
      const pale = k % (far ? 8 : 4) === 0; // a quarter of the drawn spikes are pale in both LODs
      sweep(b, [p0, add(p0, scl(d, l))], { segs: 3, radius: (s) => (s < 1 ? R * (far ? 0.11 : 0.08) : 0), key: () => (pale ? 'blush' : 'crimson'), sway: (s) => 0.2 + 0.5 * s * y });
    }
  } else if (variant === 1) {
    // four tubes (the reference had five), 10 % fatter: one central, three spread evenly round it
    const n = 4;
    for (let k = 0; k < n; k++) {
      const a = (k / (n - 1)) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const rad = k === 0 ? 0 : rng.range(0.25, 0.55);
      const h = rng.range(0.5, 1.3) * (k === 0 ? 1.2 : 1);
      const r = rng.range(0.1, 0.155);
      const o: V3 = [Math.cos(a) * rad, -0.05, Math.sin(a) * rad];
      const ax = norm([Math.cos(a) * rad * 0.6, 1, Math.sin(a) * rad * 0.6]);
      const sw = (y: number) => clamp01((y / 1.6) * 0.8);
      const ribs = (_j: number, th: number) => 1 + 0.07 * Math.cos(3 * th); // alternating on 6 sides, as 5 ribs on 10
      revolve(b, o, ax, [
        { r: r * 1.6, y: 0, key: 'ink', sway: 0 },
        { r: r * 0.85, y: h * 0.5, key: 'maroon', sway: sw(h * 0.5), mod: ribs },
        { r: r * 1.15, y: h * 0.85, key: 'crimson', sway: sw(h * 0.85), mod: ribs },
        { r: r * 1.75, y: h, key: 'blush', sway: sw(h), crease: true },
        { r: r * 1.2, y: h * 1.02, key: 'maroon', sway: sw(h) },
        { r: 0, y: h * 0.8, key: 'maroon', sway: sw(h) },
      ], 6, rng.range(0, 1));
    }
  } else if (variant === 2) {
    // 13 blades of three segments (the reference had 18 of four), a little wider so the fountain keeps its mass. Bands
    // go by ring (maroon base, crimson middle, blush tip), so every blade keeps all three whatever its curve.
    const n = 13;
    const H = rng.range(2.2, 2.8);
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996;
      const lean = 0.2 + 0.8 * Math.sqrt((k + 0.5) / n);
      const d: V3 = [Math.cos(a), 0, Math.sin(a)];
      const h = H * (1.05 - 0.5 * lean) * rng.range(0.85, 1.05);
      if (skip(k)) continue;
      const out = H * 0.55 * lean;
      const pts: V3[] = [];
      for (const s of [0, 0.3, 0.7, 1]) {
        pts.push(add(scl(d, 0.05 + out * s * s), [0, h * Math.sin(s * Math.PI * 0.5) - 0.05, 0]));
      }
      sweep(b, pts, { segs: 3, radius: (s) => (s >= 1 ? 0 : (far ? 0.08 : 0.062) * (1 - 0.7 * s)), key: (_s, i) => (i === 0 ? 'maroon' : i === 1 ? 'crimson' : 'blush'), sway: (s) => s });
    }
  } else {
    // spike crowns: 2-3 tall stalks, each a thistle crown of radiating bristles around a dark knob
    const n = rng.int(2, 3);
    const H = rng.range(2.6, 3.2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const h = H * (k === 0 ? 1 : rng.range(0.55, 0.8));
      const lean = k === 0 ? 0.04 : rng.range(0.12, 0.22);
      const top: V3 = [Math.cos(a) * h * lean, h, Math.sin(a) * h * lean];
      const base: V3 = [Math.cos(a) * 0.08, -0.05, Math.sin(a) * 0.08];
      const pts: V3[] = [];
      // rings at the band edges only: ink foot 40 %, maroon stalk 40 %, crimson neck 20 %, as the reference drew (its
      // 0.2 ring sat just under its ink threshold). Bands go by ring, so no ring can flip colour on an edge; the sag is
      // a few cm, so chords hold it.
      for (const s of [0, 0.4, 0.8, 1]) {
        pts.push(add(scl(base, 1 - s), scl(add(top, [0, -0.15 * h * s * (1 - s), 0]), s)));
      }
      const sw = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.4));
      sweep(b, pts, { segs: 4, radius: (s) => 0.05 * (1.4 - 0.7 * s), key: (_s, i) => (i === 0 ? 'ink' : i === 1 ? 'maroon' : 'crimson'), sway: (_s, p) => sw(p[1]) });
      // knob
      const R = 0.12 + 0.04 * (k === 0 ? 1 : 0);
      revolve(b, add(top, [0, -R * 0.6, 0]), [0, 1, 0], [
        { r: 0, y: 0, key: 'maroon', sway: sw(h) },
        { r: R, y: R * 0.6, key: 'maroon', sway: sw(h) },
        { r: R * 0.8, y: R * 1.3, key: 'crimson', sway: sw(h) },
        { r: 0, y: R * 1.6, key: 'crimson', sway: sw(h) },
      ], 5);
      // bristle crown: long spikes radiating up/out, short ones drooping below (thistle); 15, thicker (the reference had 22)
      const m = 15;
      for (let q = 0; q < m; q++) {
        const yy = -0.35 + 1.3 * (q + 0.5) / m;
        const az = q * 2.39996 + k;
        const rr = Math.sqrt(Math.max(0, 1 - Math.min(1, yy * yy)));
        const dir = norm([Math.cos(az) * rr, yy, Math.sin(az) * rr]);
        const l = (yy > 0 ? 0.55 : 0.3) * rng.range(0.7, 1.2) * (k === 0 ? 1.2 : 1);
        if (skip(q)) continue;
        const p0 = add(top, scl(dir, R * 0.8));
        sweep(b, [p0, add(p0, scl(dir, l))], { segs: 3, radius: (s) => (s < 1 ? (far ? 0.035 : 0.027) : 0), key: () => (q % 3 ? 'crimson' : 'blush'), sway: (s) => clamp01(sw(h) + 0.2 * s) });
      }
    }
  }
  return b.build();
}
