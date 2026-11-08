// Stilt-root mangrove (carbon mid, 6–12 m; flora-traits A3): "waterlogged shores grow breathing roots". A low cap on a
// short trunk over six arching prop roots that curl down into the mud. Prop roots and pneumatophores ventilate roots
// in anoxic, waterlogged soil (Scholander et al. 1955) [sci]; mangroves are frost-limited at their poleward edge (Osland
// et al. 2013), hence gates.ts's 10 °C mean-temperature floor ([art] threshold). Rows of arches along the shoreline
// make a leading line toward the sea. ~420 tris near, ~200 far.
import { MeshBuilder, add, bezier, clamp01, detail, revolve, scl, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

export function stiltMangrove(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 10 * rng.range(0.94, 1.06);
  const swayY = (y: number) => 0.7 * clamp01(Math.pow(Math.max(0, y) / H, 1.4));
  const rT = H * 0.03, hub: V3 = [0, H * 0.42, 0];
  const lx = rng.range(-1, 1) * H * 0.04;
  const trunk = bezier(hub, [0, H * 0.55, 0], [lx, H * 0.7, 0], [lx * 1.2, H * 0.82, 0], 4);
  sweep(b, trunk, { segs: 6, radius: (s) => rT * (1 - 0.3 * s), key: (s) => (s < 0.5 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]) });
  // prop roots arch out of the hub and curl down into the mud: dark feet, lighter toward the hub
  const n = 6, az0 = rng.range(0, Math.PI * 2), steps = detail() < 1 ? 4 : 6;
  for (let k = 0; k < n; k++) {
    const az = az0 + (k * 2 * Math.PI) / n + rng.range(-0.2, 0.2);
    const d: V3 = [Math.cos(az), 0, Math.sin(az)];
    const R = H * rng.range(0.28, 0.38);
    const pts = bezier(add(hub, [0, -rT, 0]), add(hub, add(scl(d, R * 0.45), [0, H * 0.08, 0])), add(scl(d, R * 1.05), [0, H * 0.18, 0]), add(scl(d, R), [0, -0.15, 0]), steps);
    sweep(b, pts, {
      segs: 4, radius: (s) => rT * 0.45 * (1 - 0.35 * s), key: (s) => (s > 0.8 ? 'ink' : s > 0.35 ? 'maroon' : 'crimson'),
      sway: (_s, p) => 0.5 * swayY(p[1]),
    });
  }
  // the cap: crimson underside, a pale rim, blush and bone on top
  const top = trunk[trunk.length - 1], s0 = swayY(top[1]);
  revolve(b, add(top, [0, -H * 0.01, 0]), [0, 1, 0], [
    { r: rT, y: 0, key: 'maroon', sway: s0 },
    { r: H * 0.27, y: -H * 0.035, key: 'crimson', sway: s0, cap: 1, rim: 1, crease: true },
    { r: H * 0.25, y: H * 0.02, key: 'blush', sway: s0, cap: 1, rim: 1 },
    { r: H * 0.15, y: H * 0.09, key: 'blush', sway: s0, cap: 0.55 },
    { r: 0, y: H * 0.11, key: 'bone', sway: s0 },
  ], 12, rng.range(0, 1));
  return b.build();
}
