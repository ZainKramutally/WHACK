// Rib fan (10-40 m): a cupped, flat fan of radial ribs joined by concentric rungs (radiolarian
// lattice / sea fan), or a dichotomous gorgonian branching fan. Tips carry knobs, a few glow.
import type { PaletteKey } from '../../contracts';
import { MeshBuilder, add, bead, clamp01, cross, curl, norm, revolve, scl, sheet, sub, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

interface Cfg { H: number; span: number; ribs: number; rungs: number; fans: number; branching: boolean; cup: number; web: number }
const VARIANTS: Cfg[] = [
  { H: 32, span: 0.7, ribs: 9, rungs: 3, fans: 1, branching: false, cup: 0.18, web: 0.66 },
  { H: 20, span: 1.35, ribs: 13, rungs: 3, fans: 1, branching: false, cup: 0.12, web: 0 },
  { H: 40, span: 0.55, ribs: 7, rungs: 2, fans: 2, branching: false, cup: 0.2, web: 0.72 },
  { H: 24, span: 0, ribs: 7, rungs: 0, fans: 0, branching: true, cup: 0, web: 0 },
];

export function ribFan(rng: Rng, variant: number) {
  const c = VARIANTS[variant];
  const H = c.H * rng.range(0.94, 1.06);
  const b = new MeshBuilder();
  const swayY = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.4));
  if (c.branching) return crinoid(b, rng, c, H, swayY);
  const trunkH = H * 0.16;
  const rT = H * 0.022;
  const yaw0 = Math.PI / 2 + rng.range(-0.25, 0.25); // fan faces +z by default; instances yaw it
  // trunk
  sweep(b, [[0, -0.3, 0], [0, trunkH * 0.5, 0], [0, trunkH, 0], [0, trunkH * 1.05, 0]], {
    segs: 8, radius: (s, i) => (i === 3 ? 0 : rT * (1.6 - 0.6 * s) * (i === 0 ? 1.4 : 1)), key: (s) => (s < 0.3 ? 'ink' : 'maroon'), sway: (_s, p) => swayY(p[1]),
  });
  const hub: V3 = [0, trunkH, 0];
  const L = H - trunkH;
  const keyAt = (s: number): PaletteKey => (s < 0.3 ? 'maroon' : s < 0.7 ? 'crimson' : 'blush');
  for (let f = 0; f < c.fans; f++) {
    const yaw = yaw0 + (c.fans > 1 ? (f ? 0.42 : -0.42) : 0);
    const nrm: V3 = [Math.cos(yaw), 0, Math.sin(yaw)]; // fan plane normal
    const side: V3 = [-nrm[2], 0, nrm[0]];
    const tilt = c.fans > 1 ? (f ? 0.3 : -0.3) : 0;
    // point on the cupped fan: angle phi from vertical in-plane, radial dist s (0..1)
    const fanPt = (phi: number, s: number): V3 => {
      const ph = phi + tilt;
      const inPlane = add(scl(side, Math.sin(ph) * s * L), [0, Math.cos(ph) * s * L * (1 - 0.06 * s), 0]);
      return add(add(hub, inPlane), scl(nrm, c.cup * L * s * s * (0.6 + Math.abs(Math.sin(ph)))));
    };
    // radial ribs
    const ribPhis: number[] = [];
    for (let k = 0; k < c.ribs; k++) ribPhis.push(-c.span / 2 + (c.span * k) / (c.ribs - 1) + rng.range(-0.03, 0.03));
    const ribLen = ribPhis.map((phi) => 0.82 + 0.18 * Math.cos(phi * 1.2) + rng.range(-0.06, 0.06));
    ribPhis.forEach((phi, k) => {
      const pts: V3[] = [];
      for (let i = 0; i <= 12; i++) pts.push(fanPt(phi, (i / 12) * ribLen[k]));
      sweep(b, pts, { segs: 6, radius: (s) => rT * 0.75 * (1 - 0.65 * s), key: (s) => keyAt(s * ribLen[k]), sway: (_s, p) => swayY(p[1]) });
      const tip = pts[12];
      bead(b, tip, norm(sub(tip, pts[11])), rT * 0.85, 6, 3, k % 3 === 1 ? 'glow' : 'maroon', k % 3 === 1 ? 1 : 0, swayY(tip[1]));
    });
    // membrane web between ribs over the inner fan, scalloped (bat-wing) edge
    if (c.web > 0) {
      const G: V3[][] = [];
      const per = 4, cols = (c.ribs - 1) * per;
      const rowsN = 4;
      for (let i = 0; i <= rowsN; i++) {
        const row: V3[] = [];
        for (let j = 0; j <= cols; j++) {
          const g = Math.floor(Math.min(j, cols - 1) / per), fr = j / per - g;
          const phi = ribPhis[g] + (ribPhis[g + 1] - ribPhis[g]) * fr;
          const sMax = c.web * (1 - 0.2 * Math.pow(Math.sin(fr * Math.PI), 2));
          row.push(fanPt(phi, 0.06 + (sMax - 0.06) * (i / rowsN)));
        }
        G.push(row);
      }
      sheet(b, G, (i) => (i < 2 ? 'maroon' : i < 3 ? 'crimson' : 'blush'), (p) => swayY(p[1]), rT * 0.12);
    }
    // concentric rungs (arcs between ribs)
    for (let q = 1; q <= c.rungs; q++) {
      const s = 0.25 + (0.62 * q) / (c.rungs + 0.4);
      const pts: V3[] = [];
      const n = c.ribs * 3;
      const p0 = ribPhis[0], p1 = ribPhis[c.ribs - 1];
      for (let i = 0; i <= n; i++) {
        const phi = p0 + ((p1 - p0) * i) / n;
        // rungs sag slightly between ribs
        pts.push(fanPt(phi, s));
      }
      sweep(b, pts, { segs: 4, radius: () => rT * 0.32, key: () => (q % 2 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]) });
    }
  }
  // collar where the fan leaves the trunk
  revolve(b, add(hub, [0, -rT, 0]), [0, 1, 0], [
    { r: rT * 1.3, y: 0, key: 'blush', sway: swayY(trunkH) },
    { r: rT * 1.9, y: rT * 0.8, key: 'blush', sway: swayY(trunkH) },
    { r: 0, y: rT * 1.8, key: 'blush', sway: swayY(trunkH + rT) },
  ], 8);
  return b.build();
}

/** Sea-lily: segmented stalk, calyx cup, arms rising and curling inward into croziers, pinnules along them. */
function crinoid(b: MeshBuilder, rng: Rng, c: Cfg, H: number, swayY: (y: number) => number) {
  const stalkH = H * 0.5, rS = H * 0.018;
  const lean: V3 = [rng.range(-1, 1) * H * 0.04, 0, rng.range(-1, 1) * H * 0.04];
  const stalk: V3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    stalk.push([lean[0] * t * t, -0.2 + t * stalkH, lean[2] * t * t]);
  }
  // columnals: alternating thin bands
  sweep(b, stalk, {
    segs: 8, radius: (s, i) => rS * (1.25 - 0.35 * s) * (i % 2 ? 1.18 : 1) * (i === 0 ? 1.8 : 1),
    key: (s, i) => (s < 0.08 ? 'ink' : i % 2 ? (s < 0.5 ? 'blush' : 'maroon') : s < 0.5 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]),
  });
  const top = stalk[24];
  const cupR = H * 0.07, cupH = H * 0.07, s0 = swayY(top[1]);
  revolve(b, add(top, [0, -rS, 0]), [0, 1, 0], [
    { r: rS * 0.9, y: 0, key: 'maroon', sway: s0 },
    { r: cupR * 0.7, y: cupH * 0.5, key: 'crimson', sway: s0, mod: (j) => 1 + (j % 2 ? 0.08 : -0.08) },
    { r: cupR, y: cupH, key: 'blush', sway: swayY(top[1] + cupH), crease: true, mod: (j) => 1 + (j % 2 ? 0.08 : -0.08) },
    { r: cupR * 0.6, y: cupH * 0.95, key: 'glowDeep', glow: 1, sway: swayY(top[1] + cupH) },
    { r: 0, y: cupH * 0.7, key: 'glowDeep', glow: 1, sway: swayY(top[1] + cupH) },
  ], 14);
  const arms = c.ribs;
  const armL = H * 0.62;
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const dir: V3 = [Math.cos(a), 0, Math.sin(a)];
    const o = add(add(top, scl(dir, cupR * 0.85)), [0, cupH * 0.9 - rS, 0]);
    const L = armL * rng.range(0.85, 1.1);
    const th0 = rng.range(0.55, 0.85), turn = rng.range(3.6, 4.4);
    const pts = curl(o, dir, L, 22, (s) => th0 + turn * Math.pow(s, 2.2));
    const s1 = swayY(o[1]);
    const sw = (s: number) => clamp01(s1 + (1 - s1) * s);
    sweep(b, pts, { segs: 6, radius: (s) => rS * 0.75 * (1 - 0.8 * s), key: (s) => (s < 0.35 ? 'maroon' : s < 0.75 ? 'crimson' : 'blush'), sway: (s) => sw(s) });
    // pinnules: short spines off both sides, in the arm plane's outer normal
    const side: V3 = [-dir[2], 0, dir[0]];
    for (let i = 2; i < 18; i += 2) {
      const p = pts[i], tng = norm(sub(pts[i + 1], pts[i - 1]));
      const out = norm(cross(tng, side));
      const l = H * 0.07 * (1 - i / 22);
      for (const sg of [-1, 1]) {
        const d = norm(add(scl(side, sg), scl(out, 0.6)));
        sweep(b, [p, add(p, scl(d, l))], { segs: 3, radius: (s) => (s < 1 ? rS * 0.22 : 0), key: () => 'blush', sway: () => sw(i / 22) });
      }
    }
    bead(b, pts[22], norm(sub(pts[22], pts[21])), rS * 0.55, 6, 3, k % 2 ? 'glow' : 'maroon', k % 2 ? 1 : 0, 1);
  }
  return b.build();
}
