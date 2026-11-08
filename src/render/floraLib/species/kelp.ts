// Bladder kelp (carbon mid; flora-traits A5): "gas floats lift fronds to the light, in water or in thick air". A
// curling stipe from a holdfast, with round gas bladders at the blade bases up its length, the top one largest.
// Kelp pneumatocysts float fronds toward light [sci, textbook]; lift per volume is ρ_fluid − ρ_gas, so in air over
// ~5 × Earth's density the same floats lift as well (DESIGN.md R11, "thick air is a sea"; in air [speculative]).
// In water place.ts sizes it to the water depth plus a little, so its top float sits on the surface. ~360 tris near.
import { MeshBuilder, add, bead, bezier, clamp01, norm, revolve, scl, sub, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

export function bladderKelp(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 10 * rng.range(0.95, 1.05);
  revolve(b, [0, -0.15, 0], [0, 1, 0], [
    { r: H * 0.045, y: 0, key: 'ink', sway: 0 },
    { r: H * 0.03, y: H * 0.018, key: 'maroon', sway: 0.02 },
    { r: 0, y: H * 0.04, key: 'maroon', sway: 0.04 },
  ], 8);
  const az = rng.range(0, Math.PI * 2);
  const d: V3 = [Math.cos(az), 0, Math.sin(az)], side: V3 = [-d[2], 0, d[0]];
  // a gentle S-curl up to the surface float
  const pts = bezier([0, 0, 0], add(scl(d, H * 0.12), [0, H * 0.35, 0]), add(scl(d, -H * 0.1), [0, H * 0.7, 0]), add(scl(side, H * 0.05), [0, H * 0.94, 0]), 10);
  sweep(b, pts, { segs: 6, radius: (s) => H * 0.012 * (1 - 0.4 * s), key: (s) => (s < 0.15 ? 'maroon' : 'crimson'), sway: (s) => clamp01(s) });
  const n = 5;
  for (let k = 1; k <= n; k++) {
    const s = k / n, i = Math.round(s * (pts.length - 1));
    const t = norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
    const rb = H * (0.016 + 0.03 * s * s);
    const out: V3 = k % 2 ? side : scl(side, -1);
    const c = k === n ? add(pts[i], scl(t, rb * 0.6)) : add(pts[i], scl(out, rb * 0.9));
    bead(b, c, t, rb, 8, 3, k === n ? 'bone' : 'blush', 0, clamp01(s));
    if (k === n) continue;
    // a blade from each lower bladder, drooping outward
    const L = H * rng.range(0.12, 0.18), o = add(c, scl(out, rb * 0.8));
    const blade = [o, add(add(o, scl(out, L * 0.5)), [0, L * 0.15, 0]), add(add(o, scl(out, L)), [0, -L * 0.1, 0])];
    sweep(b, blade, { segs: 3, radius: (u) => (u >= 1 ? 0 : H * 0.012 * (1 - 0.5 * u)), key: (u) => (u < 0.5 ? 'crimson' : 'blush'), sway: () => 1, cap: (u) => u });
  }
  return b.build();
}
