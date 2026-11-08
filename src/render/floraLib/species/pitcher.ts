// Pitcher urn (carbon mid, 5–12 m; flora-traits A1): "nitrogen-poor, bright and wet ground grows traps". A leaning urn
// on a short curling stalk from a root knot: maroon foot, bone body with crimson vein bands, a crimson neck, a ribbed
// flared lip (peristome; a glow site, lit only in the dark), an ink mouth turning down inside, and a hooded lid.
// Carnivory pays where light and water are plentiful and nutrients scarce (Givnish et al. 1984; Ellison & Gotelli
// 2001): an Earth pattern applied to our plants by analogy, gated in gates.ts. ~340 tris near, ~130 far.
import { MeshBuilder, add, bezier, clamp01, norm, revolve, rotate, scl, sweep, type ProfilePt, type V3 } from '../mesh';
import type { Rng } from '../rng';

export function pitcherUrn(rng: Rng, _variant: number) {
  const b = new MeshBuilder();
  const H = 9 * rng.range(0.93, 1.07);
  // a fluid-filled urn is stiff: half the sway of a stalk
  const sw = (y: number) => 0.5 * clamp01(Math.pow(Math.max(0, y) / H, 1.4));
  revolve(b, [0, -0.2, 0], [0, 1, 0], [
    { r: H * 0.08, y: 0, key: 'ink', sway: 0 },
    { r: H * 0.055, y: H * 0.04, key: 'maroon', sway: 0.01 },
    { r: 0, y: H * 0.09, key: 'maroon', sway: 0.02 },
  ], 8);
  const az = rng.range(0, Math.PI * 2), lean = rng.range(0.14, 0.24);
  const dir: V3 = [Math.cos(az), 0, Math.sin(az)];
  const foot: V3 = [dir[0] * H * 0.07, H * 0.1, dir[2] * H * 0.07];
  const axis = norm([dir[0] * Math.sin(lean), Math.cos(lean), dir[2] * Math.sin(lean)]);
  // the stalk curls out of the knot into the urn's foot
  sweep(b, bezier([0, H * 0.02, 0], [0, H * 0.07, 0], add(foot, [-dir[0] * H * 0.03, -H * 0.03, -dir[2] * H * 0.03]), foot, 4),
    { segs: 6, radius: () => H * 0.026, key: () => 'maroon', sway: (_s, p) => sw(p[1]) });
  const L = H * 0.82, R = H * 0.17;
  const ribs = (j: number) => 1 + (j % 2 ? 0.07 : -0.07);
  const prof: ProfilePt[] = [
    { r: 0, y: 0, key: 'maroon', sway: sw(foot[1]) },
    { r: R * 0.55, y: L * 0.04, key: 'maroon', sway: sw(foot[1] + L * 0.04) },
    { r: R * 0.95, y: L * 0.16, key: 'bone', sway: sw(foot[1] + L * 0.16) },
    { r: R, y: L * 0.3, key: 'crimson', sway: sw(foot[1] + L * 0.3) },
    { r: R * 0.98, y: L * 0.34, key: 'bone', sway: sw(foot[1] + L * 0.34) },
    { r: R * 0.9, y: L * 0.5, key: 'crimson', sway: sw(foot[1] + L * 0.5) },
    { r: R * 0.86, y: L * 0.54, key: 'blush', sway: sw(foot[1] + L * 0.54) },
    { r: R * 0.62, y: L * 0.78, key: 'crimson', sway: sw(foot[1] + L * 0.78) },
    { r: R * 0.8, y: L * 0.9, key: 'crimson', sway: sw(foot[1] + L * 0.9), crease: true, rim: 0.5 },
    { r: R * 0.95, y: L * 0.95, key: 'glowDeep', glow: 0.8, sway: sw(foot[1] + L), crease: true, rim: 1, mod: ribs },
    { r: R * 0.7, y: L * 0.93, key: 'ink', sway: sw(foot[1] + L), crease: true, rim: 1, mod: ribs },
    { r: R * 0.5, y: L * 0.7, key: 'ink', sway: sw(foot[1] + L) },
    { r: 0, y: L * 0.55, key: 'ink', sway: sw(foot[1] + L) },
  ];
  revolve(b, foot, axis, prof, 12, rng.range(0, 1));
  // the hood: a lens held over the mouth from its back rim, tipped forward
  const top = add(foot, scl(axis, L * 0.95));
  const hingeAxis = norm([-dir[2], 0, dir[0]]);
  const lidAxis = rotate(axis, hingeAxis, -0.7);
  const lidC = add(add(top, scl(dir, -R * 0.55)), scl(axis, R * 0.45));
  revolve(b, lidC, lidAxis, [
    { r: 0, y: 0, key: 'crimson', sway: sw(H) },
    { r: R * 0.78, y: L * 0.02, key: 'crimson', sway: sw(H), crease: true, cap: 1, rim: 1 },
    { r: 0, y: L * 0.05, key: 'blush', sway: sw(H) },
  ], 8);
  return b.build();
}
