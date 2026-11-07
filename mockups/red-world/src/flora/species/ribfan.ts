// Rib fan (10-40 m), four distinct body plans:
//  0 fan: cupped radial ribs + rungs + scalloped membrane web (radiolarian lattice / sea fan)
//  1 whorl: a vertical pinwheel of in-plane spiral arms around a ribbed hub, on a stalk
//  2 sheaf: a splayed bundle of spatulate, cupped paddles on narrow stems
//  3 crinoid: sea-lily stalk, calyx cup and inward-curling pinnulate arms
import type { PaletteKey } from '../../contracts';
import { MeshBuilder, add, bead, bezier, clamp01, cross, curl, norm, revolve, scl, sheet, sub, sweep, type V3 } from '../mesh';
import type { Rng } from '../rng';

interface Cfg { H: number; form: 'fan' | 'whorl' | 'sheaf' | 'crinoid'; span: number; ribs: number; rungs: number; fans: number; cup: number; web: number }
const VARIANTS: Cfg[] = [
  { H: 32, form: 'fan', span: 0.75, ribs: 9, rungs: 3, fans: 1, cup: 0.18, web: 0.66 },
  { H: 28, form: 'whorl', span: 0, ribs: 9, rungs: 0, fans: 0, cup: 0.1, web: 0 },
  { H: 34, form: 'sheaf', span: 0, ribs: 9, rungs: 0, fans: 0, cup: 0.45, web: 0 },
  { H: 24, form: 'crinoid', span: 0, ribs: 7, rungs: 0, fans: 0, cup: 0, web: 0 },
];

export function ribFan(rng: Rng, variant: number) {
  const c = VARIANTS[variant];
  const H = c.H * rng.range(0.94, 1.06);
  const b = new MeshBuilder();
  const swayY = (y: number) => clamp01(Math.pow(Math.max(0, y) / H, 1.4));
  if (c.form === 'crinoid') return crinoid(b, rng, c, H, swayY);
  if (c.form === 'whorl') return whorl(b, rng, c, H, swayY);
  if (c.form === 'sheaf') return sheaf(b, rng, c, H, swayY);
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

/** Vertical pinwheel: arms spiral in one plane out of a ribbed hub on a curved stalk. */
function whorl(b: MeshBuilder, rng: Rng, c: Cfg, H: number, swayY: (y: number) => number) {
  const R = H * 0.4, hubY = H - R - H * 0.04, rS = H * 0.02;
  const yaw = Math.PI / 2 + rng.range(-0.25, 0.25);
  const nrm: V3 = [Math.cos(yaw), 0, Math.sin(yaw)], side: V3 = [-nrm[2], 0, nrm[0]];
  const hub: V3 = add(scl(side, rng.range(-1, 1) * H * 0.04), [0, hubY, 0]);
  const stalk: V3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    stalk.push(add(scl(hub, t), [0, (-0.2 + t * hubY) - hub[1] * t, 0]));
  }
  sweep(b, stalk, {
    segs: 8, radius: (s, i) => rS * (1.5 - 0.7 * s) * (i === 0 ? 1.6 : 1), key: (s) => (s < 0.12 ? 'ink' : s < 0.6 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]),
  });
  // hub: ribbed lens facing +/- nrm, glowing core on both faces
  const Rh = H * 0.065, s0 = swayY(hubY);
  const ribs = (j: number) => 1 + (j % 2 ? 0.1 : -0.1);
  revolve(b, add(hub, scl(nrm, -Rh * 0.55)), nrm, [
    { r: 0, y: 0, key: 'glowDeep', glow: 1, sway: s0 },
    { r: Rh * 0.35, y: Rh * 0.1, key: 'crimson', sway: s0, crease: true },
    { r: Rh, y: Rh * 0.4, key: 'blush', sway: s0, mod: ribs },
    { r: Rh, y: Rh * 0.7, key: 'crimson', sway: s0, mod: ribs },
    { r: Rh * 0.35, y: Rh * 1.0, key: 'glowDeep', glow: 1, sway: s0, crease: true },
    { r: 0, y: Rh * 1.1, key: 'glowDeep', glow: 1, sway: s0 },
  ], 14);
  const m = c.ribs, turn = rng.range(2.0, 2.6) * rng.sign();
  for (let k = 0; k < m; k++) {
    const a0 = (k / m) * Math.PI * 2 + rng.range(-0.08, 0.08);
    const L = R * rng.range(1.15, 1.35);
    const pts: V3[] = [];
    let x = Math.cos(a0) * Rh * 0.9, y = Math.sin(a0) * Rh * 0.9;
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      if (i > 0) {
        const ang = a0 + turn * Math.pow(s, 1.3);
        x += (Math.cos(ang) * L) / n; y += (Math.sin(ang) * L) / n;
      }
      const d = Math.hypot(x, y) / R;
      pts.push(add(add(hub, add(scl(side, x), [0, y, 0])), scl(nrm, c.cup * R * d * d)));
    }
    sweep(b, pts, {
      segs: 6, radius: (s) => rS * 0.75 * (1 - 0.7 * s),
      key: (s) => (s < 0.3 ? 'maroon' : s < 0.7 ? 'crimson' : 'blush'), sway: (_s, p) => swayY(p[1]),
    });
    const tip = pts[n];
    bead(b, tip, norm(sub(tip, pts[n - 1])), rS * 0.7, 6, 3, k % 3 === 0 ? 'glow' : 'maroon', k % 3 === 0 ? 1 : 0, swayY(tip[1]));
  }
  return b.build();
}

/** Splayed bundle of spatulate paddles: narrow stems widening into cupped, rounded blades. */
function sheaf(b: MeshBuilder, rng: Rng, c: Cfg, H: number, swayY: (y: number) => number) {
  const m = c.ribs, W = H * 0.085, rS = H * 0.011;
  revolve(b, [0, -0.2, 0], [0, 1, 0], [
    { r: H * 0.07, y: 0, key: 'ink', sway: 0 },
    { r: H * 0.05, y: H * 0.03, key: 'ink', sway: swayY(H * 0.03) },
    { r: 0, y: H * 0.06, key: 'maroon', sway: swayY(H * 0.06) },
  ], 9);
  const sm = (a: number, b2: number, x: number) => { const t = clamp01((x - a) / (b2 - a)); return t * t * (3 - 2 * t); };
  for (let k = 0; k < m; k++) {
    const a = (k / m) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const out: V3 = [Math.cos(a), 0, Math.sin(a)];
    const lean = k === 0 ? 0.1 : rng.range(0.7, 1.5);
    const h = H * (k === 0 ? 0.97 : rng.range(0.5, 0.85));
    const p0 = scl(out, H * 0.03);
    const C = bezier(p0, add(p0, [0, h * 0.4, 0]), add(scl(out, h * 0.22 * lean), [0, h * 0.75, 0]), add(scl(out, h * 0.45 * lean), [0, h, 0]), 11);
    const sideK: V3 = [-out[2], 0, out[0]];
    const Wk = W * rng.range(0.8, 1.15) * (k === 0 ? 1.2 : 1);
    const G: V3[][] = [];
    const cols = 7;
    for (let i = 0; i < C.length; i++) {
      const s = Math.min(0.985, i / (C.length - 1));
      const T = norm(sub(C[Math.min(C.length - 1, i + 1)], C[Math.max(0, i - 1)]));
      const nK = norm(cross(sideK, T));
      const tipRound = s > 0.8 ? Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.8) / 0.2, 2))) : 1;
      const w = Wk * (0.06 + 0.94 * sm(0.55, 0.8, s)) * tipRound;
      const row: V3[] = [];
      for (let j = 0; j < cols; j++) {
        const x = -1 + (2 * j) / (cols - 1);
        row.push(add(add(C[i], scl(sideK, x * w)), scl(nK, c.cup * w * x * x)));
      }
      G.push(row);
    }
    sheet(b, G, (i) => { const s = i / (C.length - 1); return s < 0.12 ? 'ink' : s < 0.4 ? 'maroon' : s < 0.62 ? 'crimson' : 'blush'; }, (p) => swayY(p[1]), rS * 0.15);
    sweep(b, C.slice(0, 10), {
      segs: 5, radius: (s) => rS * (1.2 - 0.8 * s), key: (s) => (s < 0.15 ? 'ink' : s < 0.5 ? 'maroon' : 'crimson'), sway: (_s, p) => swayY(p[1]),
    });
    if (k % 3 === 1) {
      const T = norm(sub(C[9], C[7]));
      const nK = norm(cross(sideK, T));
      bead(b, add(C[8], scl(nK, Wk * 0.08)), nK, Wk * 0.12, 6, 3, 'glow', 1, swayY(C[8][1]));
    }
  }
  return b.build();
}
