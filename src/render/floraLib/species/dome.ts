// Jellyshroom domes (carbon ground cover for dark water margins, FloraForm species 'dome'; new, no reference species).
// Ribbed translucent bells on the ground with a scalloped skirt and a glow-site cap (lit only in the dark).
// Ground cover is the most numerous carbon flora, so bells stay lean (12 sides single, 8 in a cluster: ~110 and ~220
// tris). No core bead: the flora material is opaque, so a bead inside a bell never shows.
//  0 single bell, 1 cluster of three smaller bells
import { MeshBuilder, clamp01, revolve, type V3 } from '../mesh';
import type { Rng } from '../rng';

function bell(b: MeshBuilder, o: V3, R: number, H: number, phase: number, segs: number) {
  // ribs alternate round the bell (segs / 2 of them: 6 on 12 sides, the ripple the 10-rib term made on 16); the skirt's
  // 14-scallop term keeps the same 2-lobe wave on 12 or 8 sides as it had on 16
  const ribs = (_j: number, th: number) => 1 + 0.06 * Math.cos((segs / 2) * th);
  const sw = (y: number) => clamp01(0.15 + 0.5 * (y / H));
  revolve(b, o, [0, 1, 0], [
    { r: R * 1.12, y: 0, key: 'maroon', sway: 0.05, mod: (_j, th) => 1 + 0.08 * Math.cos(14 * th) },
    { r: R * 1.05, y: H * 0.18, key: 'crimson', sway: sw(H * 0.18), mod: ribs, crease: true },
    { r: R * 0.92, y: H * 0.55, key: 'blush', sway: sw(H * 0.55), mod: ribs },
    { r: R * 0.6, y: H * 0.88, key: 'bone', sway: sw(H * 0.88), mod: ribs },
    { r: R * 0.22, y: H * 1.0, key: 'glowDeep', glow: 0.8, sway: sw(H), crease: true },
    { r: 0, y: H * 1.02, key: 'glowDeep', glow: 0.8, sway: sw(H) },
  ], segs, phase);
}

export function jellyDome(rng: Rng, variant: number) {
  const b = new MeshBuilder();
  if (variant === 0) {
    const R = rng.range(0.7, 0.9);
    bell(b, [0, -0.05, 0], R, R * 1.1, rng.range(0, 1), 12);
  } else {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const R = rng.range(0.3, 0.5) * (k === 0 ? 1.3 : 1);
      const d = k === 0 ? 0 : 0.6;
      bell(b, [Math.cos(a) * d, -0.05, Math.sin(a) * d], R, R * rng.range(0.9, 1.3), rng.range(0, 1), 8);
    }
  }
  return b.build();
}
