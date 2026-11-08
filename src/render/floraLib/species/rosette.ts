// Woolly rosette giant (carbon giant, 20–30 m; flora-traits A2): "the cold, bright heights grow giant rosettes". A
// column with a shaggy skirt of hanging dead leaves and a pale ball crown of curling rosette leaves (a lollipop with a
// skirt). Tropical-alpine giant rosettes (Espeletia, Dendrosenecio) keep an insulating skirt of dead leaves and a hairy,
// reflective crown (Smith & Young 1987; Meinzer et al. 1985): the one real Earth case where cold goes with a tall form,
// the best analogue of the owner's cold → tall rule. ~400 tris near, ~170 far.
import { MeshBuilder, add, bezier, clamp01, curl, detail, revolve, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

export function woollyRosette(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 26 * rng.range(0.94, 1.06);
  const swayY = (y: number) => 0.6 * clamp01(Math.pow(Math.max(0, y) / H, 1.5));
  const rT = H * 0.035, lean = rng.range(-1, 1) * H * 0.03;
  const pts = bezier([0, -0.3, 0], [0, H * 0.3, 0], [lean, H * 0.6, 0], [lean * 1.4, H * 0.8, 0], 5);
  sweep(b, pts, {
    segs: 8, radius: (s, i) => rT * (1.3 - 0.4 * s) * (i === 0 ? 1.5 : 1),
    key: (s) => (s < 0.1 ? 'ink' : s < 0.5 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]),
  });
  // the skirt: a shaggy cone of dead leaves from the crown down the upper trunk, banded, with a zigzag hem
  const shag = (j: number) => (j % 2 ? 1.12 : 0.9);
  const sk: V3 = [lean * 0.9, H * 0.42, 0];
  revolve(b, sk, [0, 1, 0], [
    { r: rT * 3.2, y: 0, key: 'maroon', sway: swayY(sk[1]), mod: shag, rim: 1, cap: 1 },
    { r: rT * 2.6, y: H * 0.12, key: 'crimson', sway: swayY(sk[1] + H * 0.12), mod: shag, cap: 0.7 },
    { r: rT * 2.0, y: H * 0.25, key: 'maroon', sway: swayY(sk[1] + H * 0.25), mod: shag, cap: 0.4 },
    { r: rT * 1.4, y: H * 0.34, key: 'crimson', sway: swayY(sk[1] + H * 0.34) },
    { r: rT * 1.0, y: H * 0.38, key: 'crimson', sway: swayY(sk[1] + H * 0.38) },
  ], 12, rng.range(0, 1));
  // the crown: a pale ball (a hairy, reflective coat) with curling rosette leaves
  const top = pts[pts.length - 1], Rc = H * 0.09;
  const cc = add(top, [0, Rc * 0.7, 0]), s0 = swayY(cc[1]);
  revolve(b, cc, [0, 1, 0], [
    { r: 0, y: -Rc, key: 'crimson', sway: s0 },
    { r: Rc * 0.85, y: -Rc * 0.45, key: 'blush', sway: s0 },
    { r: Rc, y: 0, key: 'blush', sway: s0 },
    { r: Rc * 0.8, y: Rc * 0.55, key: 'bone', sway: s0 },
    { r: 0, y: Rc * 0.9, key: 'bone', sway: s0 },
  ], 10, rng.range(0, 1));
  const far = detail() < 1;
  for (let k = 0; k < 18; k++) {
    const az = k * 2.39996 + rng.range(-0.1, 0.1);
    const up = 0.15 + 0.6 * ((k * 7) % 18) / 18;           // elevation of the leaf's start
    const dir: V3 = [Math.cos(az), 0, Math.sin(az)];
    const o = add(cc, [dir[0] * Rc * 0.8, Rc * (up - 0.3), dir[2] * Rc * 0.8]);
    const L = Rc * rng.range(1.3, 1.8);
    if (far && k % 2) continue;
    const leaf = curl(o, dir, L, 2, (s) => up - 1.6 * s);  // tips curl down
    sweep(b, leaf, {
      segs: 3, radius: (s) => (s >= 1 ? 0 : Rc * 0.13 * (1 - 0.4 * s)), key: (s) => (s < 0.5 ? 'blush' : 'bone'),
      sway: (s) => clamp01(s0 + 0.3 * s), cap: (s) => s,
    });
  }
  return b.build();
}
