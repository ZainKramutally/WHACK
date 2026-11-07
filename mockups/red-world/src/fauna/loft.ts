// Body loft (F §3.6 generalised cylinder): a static ring template per plan (ring positions along the spine, radius
// factors, skin colours and glow per vertex), and a writer that places the rings on the posed spine each frame.
// Carbon: 12 sides, smooth (indexed grid, finite-difference normals). Silicon: 6 sides, stepped prisms, flat faces
// (non-indexed, one normal per face). Colours are value-inverted bands: dark belly, crimson flank, pale back + pattern.
import { LINEAR, add, cross, norm, scl, sub, type V3 } from '../flora/mesh';
import type { PaletteKey } from '../contracts';
import type { FaunaPlan } from './develop';
import { hash01, spineAt, type Spine } from './rig';

interface Ring { x: number; rj: number; rf: number } // fractional joint index, joint radius to use (−1 = interpolate), factor

export interface LoftTemplate {
  rings: Ring[];
  sides: number;
  flat: boolean;
  vertexCount: number;
  color: Float32Array;   // linear rgb per output vertex
  glow: Float32Array;    // per output vertex
  index: number[] | null; // smooth only (local indices)
  theta: number[];       // angle per side
}

function ringsFor(plan: FaunaPlan): Ring[] {
  const n = plan.segments;
  const R: Ring[] = [];
  if (plan.chemistry === 'silicon') {
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
    for (let k = 0; k <= 3 * n; k++) R.push({ x: k / 3, rj: -1, rf: 1 });
    for (const [f, rf] of [...dome].reverse()) R.push({ x: n + ct * f, rj: n, rf: plan.mode === 'sessile' ? 0.98 - f * 0.4 : rf });
  }
  return R;
}

/** Skin colour of ring band i, side j (d = sin θ: +1 dorsal, −1 ventral). */
function skin(plan: FaunaPlan, x: number, j: number, d: number): { key: PaletteKey; glow: number } {
  const n = plan.segments;
  const seg = Math.floor(Math.max(0, x));
  const h = plan.seed;
  if (plan.mode !== 'sessile' && x < 0.35 && d < -0.1 && plan.gape > 0.25) return { key: 'ink', glow: 0 }; // mouth line
  if (d < -0.3) return { key: plan.belly, glow: 0 };
  if (d < 0.25) {
    // flank: crimson (or maroon when the back is crimson)
    return { key: plan.back === 'crimson' || plan.chemistry === 'silicon' ? 'maroon' : 'crimson', glow: 0 };
  }
  let mark = false;
  if (plan.pattern === 'bands') mark = seg % 2 === 1;
  else if (plan.pattern === 'spots') mark = hash01(h + Math.floor(x * 2.5) * 17, j) < 0.22;
  else mark = hash01(h + Math.floor(x / 1.5) * 13, Math.floor(j / 3)) < 0.4;
  return { key: mark ? plan.mark : plan.back, glow: 0 };
}

export function loftTemplate(plan: FaunaPlan): LoftTemplate {
  const rings = ringsFor(plan);
  const S = plan.sides, flat = plan.flat;
  const theta = Array.from({ length: S }, (_, j) => (S === 6 ? Math.PI / 2 + ((j + 0.5) * 2 * Math.PI) / 6 : (j * 2 * Math.PI) / S));
  const nr = rings.length;
  const col: number[] = [], glw: number[] = [];
  const push = (k: PaletteKey, g: number) => { const c = LINEAR[k]; col.push(c[0], c[1], c[2]); glw.push(g); };
  let index: number[] | null = null;
  if (!flat) {
    for (let i = 0; i < nr; i++) for (let j = 0; j < S; j++) { const s = skin(plan, rings[i].x, j, Math.sin(theta[j])); push(s.key, s.glow); }
    index = [];
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
      const a = i * S + j, b = i * S + ((j + 1) % S), c = a + S, d = b + S;
      index.push(a, b, c, b, d, c);
    }
  } else {
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
      const mid = (theta[j] + theta[(j + 1) % S] + (j === S - 1 ? 2 * Math.PI : 0)) / 2;
      const s = skin(plan, (rings[i].x + rings[i + 1].x) / 2, j, Math.sin(mid));
      for (let v = 0; v < 6; v++) push(s.key, s.glow);
    }
  }
  return { rings, sides: S, flat, vertexCount: col.length / 3, color: new Float32Array(col), glow: new Float32Array(glw), index, theta };
}

/** Place the template on a posed spine: writes positions and normals at vertex offset `off`. */
export function writeLoft(tp: LoftTemplate, plan: FaunaPlan, sp: Spine, pos: Float32Array, nor: Float32Array, off: number) {
  const smooth = plan.chemistry === 'carbon';
  const S = tp.sides, nr = tp.rings.length;
  const G: V3[] = new Array(nr * S);
  for (let i = 0; i < nr; i++) {
    const rg = tp.rings[i];
    const f = spineAt(sp, rg.x, smooth);
    const r = (rg.rj >= 0 ? sp.r[rg.rj] : f.r) * rg.rf;
    for (let j = 0; j < S; j++) {
      const th = tp.theta[j];
      G[i * S + j] = add(f.p, add(scl(f.R, Math.cos(th) * r), scl(f.U, Math.sin(th) * r * plan.aspect)));
    }
  }
  if (!tp.flat) {
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
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < S; j++) {
    const a = G[i * S + j], b = G[i * S + ((j + 1) % S)], c = G[(i + 1) * S + j], d = G[(i + 1) * S + ((j + 1) % S)];
    let nn = cross(sub(b, a), sub(c, a));
    if (nn[0] * nn[0] + nn[1] * nn[1] + nn[2] * nn[2] < 1e-14) nn = cross(sub(d, b), sub(c, b));
    nn = norm(nn);
    for (const p of [a, b, c, b, d, c]) {
      pos[v] = p[0]; pos[v + 1] = p[1]; pos[v + 2] = p[2];
      nor[v] = nn[0]; nor[v + 1] = nn[1]; nor[v + 2] = nn[2];
      v += 3;
    }
  }
}
