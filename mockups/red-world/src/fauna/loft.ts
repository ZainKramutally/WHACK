// Body loft (F §3.6 generalised cylinder): a static ring template per plan (ring positions along the spine, radius
// factors, skin colours and glow per vertex), and a writer that places the rings on the posed spine each frame.
// Carbon: 12 sides, smooth (indexed grid, finite-difference normals). Silicon: 6 sides, stepped prisms, flat faces
// (non-indexed, one normal per face). Colours are value-inverted bands: dark belly, crimson flank, pale back + pattern.
import { LINEAR, add, cross, norm, scl, sub, type V3 } from '../flora/mesh';
import type { PaletteKey } from '../contracts';
import type { FaunaPlan } from './develop';
import { hash01, spineAt, type Spine } from './rig';
import { KEY_LIGHT } from './bell';

interface Ring { x: number; rj: number; rf: number } // fractional joint index, joint radius to use (−1 = interpolate), factor

export interface LoftTemplate {
  rings: Ring[];
  sides: number;
  flat: boolean;          // face normals (silicon facets)
  perFace: boolean;       // per-face colours (hard-edged spots), smooth or flat normals
  vertexCount: number;
  color: Float32Array;   // linear rgb per output vertex
  glow: Float32Array;    // per output vertex
  index: number[] | null; // smooth only (local indices)
  theta: number[];       // angle per side
}

function ringsFor(plan: FaunaPlan): Ring[] {
  const n = plan.segments;
  const R: Ring[] = [];
  if (plan.chemistry === 'silicon' && plan.mode === 'sessile') {
    R.push({ x: 0.02, rj: 0, rf: 0 });
    for (let i = 0; i < n; i++) {
      const w = i % 2 ? 0.94 : 1; // alternating repeat units
      R.push({ x: i + 0.02, rj: i, rf: 0.72 * w }, { x: i + 0.12, rj: i, rf: w }, { x: i + 0.88, rj: i, rf: w }, { x: i + 0.98, rj: i, rf: 0.72 * w });
    }
    R.push({ x: n - 0.02, rj: n - 1, rf: 0 });
  } else {
    // rounded caps whose length follows the end radius (in joint units), so heads are domes, not pipe ends
    const segL = plan.scale / n;
    const ch = Math.min(1.2, (plan.radii[0] * 1.05) / segL), ct = Math.min(1, (plan.radii[n] * 1.2) / segL);
    const dome: [number, number][] = [[1, 0.02], [0.86, 0.5], [0.6, 0.8], [0.3, 0.96]];
    if (plan.mode !== 'sessile') for (const [f, rf] of dome) R.push({ x: -ch * f, rj: 0, rf });
    const per = plan.form === 'bell' ? 4 : 3;
    for (let k = 0; k <= per * n; k++) R.push({ x: k / per, rj: -1, rf: 1 });
    for (const [f, rf] of [...dome].reverse()) R.push({ x: n + ct * f, rj: n, rf: plan.mode === 'sessile' ? 0.98 - f * 0.4 : rf });
  }
  return R;
}

/** Skin colour of ring band i, side j (d = sin θ: +1 dorsal, −1 ventral). */
function skin(plan: FaunaPlan, x: number, j: number, d: number, th = 0): { key: PaletteKey; glow: number } {
  if (plan.form === 'bell') {
    // gas bell: pale crown → blush → crimson → maroon rim in stepped bands, mottled with spots that grow denser lower
    const u = x / plan.segments;
    // mottling: a few large organic blotches (3–5 on juveniles, a few more and smaller on adolescents), each with a
    // ragged edge and a freckle halo, instead of per-cell noise that reads as a checkerboard at a distance
    const nBl = Math.round(6 + 6 * plan.age + hash01(plan.seed, 41) * 1.4); // all round the bell: 3–5 face the viewer
    const scaleBl = 1.2 - 0.3 * plan.age;
    let inBlot = false, freckle = false;
    for (let b = 0; b < nBl; b++) {
      const uc = 0.25 + 0.55 * hash01(plan.seed + b, 43), tc = 2 * Math.PI * ((b + 0.6 * hash01(plan.seed + b, 47)) / nBl);
      const ru = (0.07 + 0.06 * hash01(plan.seed + b, 53)) * scaleBl, rt = ru * (2.2 + hash01(plan.seed + b, 59));
      let dt = th - tc; dt = Math.atan2(Math.sin(dt), Math.cos(dt));
      const d = Math.hypot((u - uc) / ru, dt / rt);
      const ragged = 0.85 + 0.3 * hash01(plan.seed + Math.floor(x * 4) * 13 + b, j);
      if (d < ragged) inBlot = true;
      else if (d < 1.5 && hash01(plan.seed + Math.floor(x * 4) * 7, j + b * 97) < 0.18) freckle = true;
    }
    const cell = inBlot || freckle ? 0 : 1;
    // soft specular: a bone patch where the bell faces the key light (bell vertex dir = (sin θ, ·, cos θ))
    const kl = Math.hypot(KEY_LIGHT[0], KEY_LIGHT[2]);
    const face = (Math.sin(th) * KEY_LIGHT[0] + Math.cos(th) * KEY_LIGHT[2]) / kl;
    if (face > 0.9 + ((u - 0.66) / 0.12) ** 2 * 0.1 && u > 0.5 && u < 0.8) return { key: 'bone', glow: 0 };
    const band = u > 0.8 ? 4 : u > 0.56 ? 3 : u > 0.3 ? 2 : u > 0.12 ? 1 : 0;
    const baseK: PaletteKey[] = ['maroon', 'crimson', 'blush', 'blush', 'bone'];
    const spotK: PaletteKey[] = ['crimson', 'maroon', 'crimson', 'crimson', 'blush'];
    return { key: cell === 0 && band > 0 ? spotK[band] : baseK[band], glow: 0 };
  }
  const n = plan.segments;
  const seg = Math.floor(Math.max(0, x));
  const h = plan.seed;
  if (plan.mode !== 'sessile' && x < 0.35 && d < -0.1 && plan.gape > 0.25) return { key: 'ink', glow: 0 }; // mouth line
  if (d < -0.45) return { key: plan.belly, glow: 0 };
  if (d < -0.05) {
    // flank: crimson (or maroon when the back is crimson)
    return { key: plan.back === 'crimson' || plan.chemistry === 'silicon' ? 'maroon' : 'crimson', glow: 0 };
  }
  let mark = false;
  if (plan.pattern === 'bands') mark = seg % 2 === 1;
  else if (plan.pattern === 'spots') mark = hash01(h + Math.floor(x * 2.5) * 17, j) < 0.14;
  else mark = hash01(h + Math.floor(x / 1.5) * 13, Math.floor(j / 3)) < 0.22; // sparse marks: the back stays pale
  return { key: mark ? plan.mark : plan.back, glow: 0 };
}

export function loftTemplate(plan: FaunaPlan): LoftTemplate {
  const rings = ringsFor(plan);
  const S = plan.sides, flat = plan.flat, perFace = flat || plan.form === 'bell';
  const theta = Array.from({ length: S }, (_, j) => (S === 6 ? Math.PI / 2 + ((j + 0.5) * 2 * Math.PI) / 6 : (j * 2 * Math.PI) / S));
  const nr = rings.length;
  const col: number[] = [], glw: number[] = [];
  const push = (k: PaletteKey, g: number) => { const c = LINEAR[k]; col.push(c[0], c[1], c[2]); glw.push(g); };
  let index: number[] | null = null;
  if (!perFace) {
    for (let i = 0; i < nr; i++) for (let j = 0; j < S; j++) { const s = skin(plan, rings[i].x, j, Math.sin(theta[j])); push(s.key, s.glow); }
    index = [];
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
      const a = i * S + j, b = i * S + ((j + 1) % S), c = a + S, d = b + S;
      index.push(a, b, c, b, d, c);
    }
  } else {
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
      const mid = (theta[j] + theta[(j + 1) % S] + (j === S - 1 ? 2 * Math.PI : 0)) / 2;
      const s = skin(plan, (rings[i].x + rings[i + 1].x) / 2, j, Math.sin(mid), mid);
      for (let v = 0; v < 6; v++) push(s.key, s.glow);
    }
  }
  return { rings, sides: S, flat, perFace, vertexCount: col.length / 3, color: new Float32Array(col), glow: new Float32Array(glw), index, theta };
}

/** Place the template on a posed spine: writes positions and normals at vertex offset `off`. */
export function writeLoft(tp: LoftTemplate, plan: FaunaPlan, sp: Spine, pos: Float32Array, nor: Float32Array, off: number) {
  const smooth = plan.chemistry === 'carbon';
  const S = tp.sides, nr = tp.rings.length, n = plan.segments;
  const G: V3[] = new Array(nr * S);
  for (let i = 0; i < nr; i++) {
    const rg = tp.rings[i];
    const f = spineAt(sp, rg.x, smooth);
    const r = (rg.rj >= 0 ? sp.r[rg.rj] : f.r) * rg.rf;
    const xc = Math.min(n, Math.max(0, rg.x)), i0 = Math.min(n - 1, Math.floor(xc)), fr = xc - i0;
    const hu = 1 + plan.hump[i0] + (plan.hump[i0 + 1] - plan.hump[i0]) * fr;
    const sg = 1 + plan.sag[i0] + (plan.sag[i0 + 1] - plan.sag[i0]) * fr;
    for (let j = 0; j < S; j++) {
      const th = tp.theta[j], sn = Math.sin(th);
      G[i * S + j] = add(f.p, add(scl(f.R, Math.cos(th) * r), scl(f.U, sn * r * plan.aspect * (sn > 0 ? hu : sg))));
    }
  }
  if (!tp.perFace) {
    for (let i = 0; i < nr; i++) for (let j = 0; j < S; j++) {
      const p = G[i * S + j];
      const dth = sub(G[i * S + ((j + 1) % S)], G[i * S + ((j - 1 + S) % S)]);
      const dx = sub(G[Math.min(nr - 1, i + 1) * S + j], G[Math.max(0, i - 1) * S + j]);
      const nn = norm(cross(dth, dx));
      const k = (off + i * S + j) * 3;
      pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2];
      nor[k] = nn[0]; nor[k + 1] = nn[1]; nor[k + 2] = nn[2];
    }
    return;
  }
  let v = off * 3;
  // smooth per-vertex normals for per-face-coloured smooth bodies (the bell)
  const VN: V3[] | null = tp.flat ? null : G.map((_, k) => {
    const i = Math.floor(k / S), j = k % S;
    const dth = sub(G[i * S + ((j + 1) % S)], G[i * S + ((j - 1 + S) % S)]);
    const dx = sub(G[Math.min(nr - 1, i + 1) * S + j], G[Math.max(0, i - 1) * S + j]);
    return norm(cross(dth, dx));
  });
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
    const ia = i * S + j, ib = i * S + ((j + 1) % S), ic = (i + 1) * S + j, id = (i + 1) * S + ((j + 1) % S);
    const a = G[ia], b = G[ib], c = G[ic], d = G[id];
    let nn = cross(sub(b, a), sub(c, a));
    if (nn[0] * nn[0] + nn[1] * nn[1] + nn[2] * nn[2] < 1e-14) nn = cross(sub(d, b), sub(c, b));
    nn = norm(nn);
    for (const k of [ia, ib, ic, ib, id, ic]) {
      const p = G[k], q = VN ? VN[k] : nn;
      pos[v] = p[0]; pos[v + 1] = p[1]; pos[v + 2] = p[2];
      nor[v] = q[0]; nor[v + 1] = q[1]; nor[v + 2] = q[2];
      v += 3;
    }
  }
}
