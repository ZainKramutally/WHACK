// Jellyshroom domes (carbon ground cover for dark water margins, FloraForm species 'dome'; new, no reference species).
// Ribbed translucent bells on the ground with a scalloped skirt and a glow-site core (lit only in the dark).
//  0 single bell, 1 cluster of three smaller bells
import { MeshBuilder, clamp01, revolve, type V3 } from '../mesh';
import type { Rng } from '../rng';

function bell(b: MeshBuilder, o: V3, R: number, H: number, phase: number) {
  const ribs = (_j: number, th: number) => 1 + 0.06 * Math.cos(10 * th);
  const sw = (y: number) => clamp01(0.15 + 0.5 * (y / H));
  revolve(b, o, [0, 1, 0], [
    { r: R * 1.12, y: 0, key: 'maroon', sway: 0.05, mod: (_j, th) => 1 + 0.08 * Math.cos(14 * th) },
    { r: R * 1.05, y: H * 0.18, key: 'crimson', sway: sw(H * 0.18), mod: ribs, crease: true },
    { r: R * 0.92, y: H * 0.55, key: 'blush', sway: sw(H * 0.55), mod: ribs },
    { r: R * 0.6, y: H * 0.88, key: 'bone', sway: sw(H * 0.88), mod: ribs },
    { r: R * 0.22, y: H * 1.0, key: 'glowDeep', glow: 0.8, sway: sw(H), crease: true },
    { r: 0, y: H * 1.02, key: 'glowDeep', glow: 0.8, sway: sw(H) },
  ], 16, phase);
  // inner core bead: a glow site seen through the translucent bell
  revolve(b, [o[0], o[1] + H * 0.15, o[2]], [0, 1, 0], [
    { r: 0, y: 0, key: 'glow', glow: 1, sway: sw(H * 0.2) },
    { r: R * 0.3, y: H * 0.2, key: 'glow', glow: 1, sway: sw(H * 0.3) },
    { r: 0, y: H * 0.42, key: 'glow', glow: 1, sway: sw(H * 0.4) },
  ], 8);
}

export function jellyDome(rng: Rng, variant: number) {
  const b = new MeshBuilder();
  if (variant === 0) {
    const R = rng.range(0.7, 0.9);
    bell(b, [0, -0.05, 0], R, R * 1.1, rng.range(0, 1));
  } else {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const R = rng.range(0.3, 0.5) * (k === 0 ? 1.3 : 1);
      const d = k === 0 ? 0 : 0.6;
      bell(b, [Math.cos(a) * d, -0.05, Math.sin(a) * d], R, R * rng.range(0.9, 1.3), rng.range(0, 1));
    }
  }
  return b.build();
}
