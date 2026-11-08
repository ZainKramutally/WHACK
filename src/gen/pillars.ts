// Basalt pillar layout (M7): a pure function of (terrain, state), the same inputs as the terrain itself. No RNG streams.
// Cells are the hex lattice of Kit.hexCell at M7's `size`; the CPU height (gen/terrain.ts heightCore) flattens each present cell
// to its pillar top, and render/basaltPillars.ts draws a hexagonal prism standing exactly at `pillarTops(...).top`.
import { pillarCell, kit64, SQRT3, type Terrain, type TerrainState } from './terrain';

export interface PillarSet {
  count: number;
  size: number;                 // lattice spacing (m): across-flats width of one prism
  ix: Int32Array; iz: Int32Array;
  cx: Float32Array; cz: Float32Array;
  mineral: Uint8Array;          // index into terrain.config.crust.minerals (argmax of the crust weights at the centre)
  shade: Float32Array;          // 0..1 per-column hash, for slight value variation
}

/** How far below the pillar's ground a prism extends (m), so its foot is buried on sloping ground. */
export const PILLAR_FOOT = 2;

const FINAL: TerrainState = { rise: 1, heatSolvent: 0.5, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 } };

/** Every cell that could hold a pillar: on an M7 mineral and near the coastal band at the final state (live state may move
 *  the band a little, so the candidate set is slightly wider than the cells present at that state). Empty when M7 is off. */
export function pillarCandidates(terrain: Terrain): PillarSet {
  const P = terrain.params;
  const empty: PillarSet = { count: 0, size: 0, ix: new Int32Array(0), iz: new Int32Array(0), cx: new Float32Array(0), cz: new Float32Array(0), mineral: new Uint8Array(0), shade: new Float32Array(0) };
  const m7 = P.machines.M7;
  if (!P.active.M7 || !m7) return empty;
  const half = terrain.patchSize / 2;
  const nx = Math.ceil(half / (0.5 * m7.size)) + 1, nz = Math.ceil(half / (0.5 * SQRT3 * m7.size)) + 1;
  const out: { ix: number; iz: number; cx: number; cz: number; mineral: number; shade: number }[] = [];
  for (let iz = -nz; iz <= nz; iz++) for (let ix = -nx; ix <= nx; ix++) {
    if (((ix - iz) % 2 + 2) % 2 !== 0) continue;          // lattice A has both ids even, lattice B both odd
    const pc = pillarCell(P, ix, iz, FINAL.heatSolvent, 1, 1, 1, 1, 1, 1, 1, kit64);
    if (Math.abs(pc.cx) > half || Math.abs(pc.cz) > half || pc.gate <= 0.5 || pc.band <= 0.2) continue;
    const w = terrain.crustWeights(pc.cx, pc.cz);
    let best = 0;
    w.forEach((v, j) => { if (v > w[best]) best = j; });
    out.push({ ix, iz, cx: pc.cx, cz: pc.cz, mineral: best, shade: kit64.hash(ix, iz, P.sM7 ^ 0x9e3779b9) });
  }
  const n = out.length;
  const set: PillarSet = { count: n, size: m7.size, ix: new Int32Array(n), iz: new Int32Array(n), cx: new Float32Array(n), cz: new Float32Array(n), mineral: new Uint8Array(n), shade: new Float32Array(n) };
  out.forEach((o, i) => { set.ix[i] = o.ix; set.iz[i] = o.iz; set.cx[i] = o.cx; set.cz[i] = o.cz; set.mineral[i] = o.mineral; set.shade[i] = o.shade; });
  return set;
}

/** Live extent of candidate `i`: `top` equals terrain.height at any point of the cell (the CPU M7 term). */
export function pillarTops(terrain: Terrain, set: PillarSet, i: number, st: TerrainState): { present: boolean; base: number; top: number } {
  const pr = st.progress;
  const pc = pillarCell(terrain.params, set.ix[i], set.iz[i], st.heatSolvent, pr.M2 ?? 0, pr.M3 ?? 0, pr.M4 ?? 0, pr.M5 ?? 0, pr.M6 ?? 0, pr.M8 ?? 0, pr.M9 ?? 0, kit64);
  const top = st.rise * (pc.ground + (pr.M7 ?? 0) * pc.step);
  return { present: pc.present && (pr.M7 ?? 0) > 0, base: st.rise * (pc.ground - PILLAR_FOOT), top };
}
