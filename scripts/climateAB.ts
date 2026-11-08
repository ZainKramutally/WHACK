// Headless A/B: same seed, one condition changed, end-of-build population traits.
import { createTerrain, sampleHeights, seaLevelFromHeights } from '../src/gen/terrain';
import { carbon } from '../src/worlds/carbon';
import { silicon } from '../src/worlds/silicon';
import type { WorldConfig } from '../src/worlds/types';
import { skinArea, supportLoad } from '../src/sim/develop';
import { CAP, Ecology, type EcologyEnv, type EcologyLedger } from '../src/sim/ecology';
import { CELLS, createGrid } from '../src/sim/grid';

export interface Cond { oxygen?: number; temperature?: number; gravity?: number; nitrogen?: number }
const DT = 1 / 20;

export function build(world: WorldConfig, c: Cond, seed = world.demoSeed) {
  const terrain = createTerrain(world.terrain, world.demoSeed);
  const heights = sampleHeights(terrain, { rise: 1, progress: {}, heatSolvent: 0.5 });
  const cover = (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200;
  const seaLevel = seaLevelFromHeights(heights, cover);
  const liquid = new Float32Array(CELLS);
  for (let i = 0; i < CELLS; i++) liquid[i] = Math.max(0, seaLevel - heights[i]);
  const L = world.life.ledger as unknown as EcologyLedger & { supplyC: number; supplySi: number; supplyO: number };
  const isC = world.id === 'carbon';
  const band: [number, number] = isC ? [-50, 122] : [-210, -147];
  const temperature = c.temperature ?? (isC ? 15 : -183);
  const env: EcologyEnv = {
    temperature, oxygen: c.oxygen ?? (isC ? 21 : 0), light: isC ? 1 : 0.01, habitat: 1, edgeStress: 0,
    heatBand: Math.min(1, Math.max(0, (temperature - band[0]) / (band[1] - band[0]))), nitrogen: c.nitrogen ?? 1,
  };
  const eco = new Ecology({
    seed,
    grid: createGrid({ liquid, supply: { c: L.supplyC, si: L.supplySi, o: L.supplyO } }),
    rules: world.life.rules,
    inputs: {
      solvent: world.life.inputs.solvent,
      airDensity: world.life.inputs.airDensity.scale * (isC ? 1.2 : 13),
      tissueDensity: world.life.inputs.tissueDensity,
      gravity: c.gravity ?? 1,
      economics: world.life.inputs.economics,
    },
    composition: world.life.composition,
    founderClimate: { prefTemp: temperature, tolerance: world.life.founders.tolerance, chem: world.life.founders.chem },
    ledger: L,
  });
  eco.seedLife(env);
  return { eco, env };
}

export function metrics(eco: Ecology, grav = 1) {
  const diets: number[] = [];
  let walkN = 0, walkLimb = 0, walkLen = 0; const sizes: number[] = [];
  let limbAll = 0, n = 0, size = 0, hunters = 0, limbRatio = 0, legged = 0, skin = 0, load = 0, swim = 0, maxScale = 0;
  for (let i = 0; i < CAP; i++) {
    if (!eco.alive[i]) continue;
    const p = eco.plan[i];
    n++; size += p.scale; maxScale = Math.max(maxScale, p.scale);
    diets.push(p.diet); sizes.push(p.scale);
    if (p.mode === 0) { walkN++; walkLimb += p.limbLength / p.scale; walkLen += p.scale; }
    if (p.diet > 0.5) hunters++;
    if (p.mode === 1) swim++;
    if (p.legPairs > 0) { legged++; limbRatio += p.limbLength / p.scale; }
    limbAll += p.limbLength / p.scale;
    skin += skinArea(p) / p.mass ** 0.75; load += supportLoad(p, grav, 0.5);
  }
  let fl = 0, mass = 0;
  for (let c = 0; c < CELLS; c++) fl += eco.grid.mat[c] + eco.grid.canopy[c];
  for (let i = 0; i < CAP; i++) if (eco.alive[i]) mass += eco.struct[i];
  const d = Math.max(1, n);
  diets.sort((a, b) => a - b); sizes.sort((a, b) => b - a);
  const top = sizes.slice(0, Math.max(1, Math.floor(n / 10)));
  return { n, sizeTop: top.reduce((a, b) => a + b, 0) / top.length, walkN, walkLimb: walkN ? walkLimb / walkN : 0, walkLen: walkN ? walkLen / walkN : 0, flora: fl / CELLS, bodyMass: mass / d, diet: diets.reduce((a, b) => a + b, 0) / d, dietP90: diets[Math.floor(0.9 * (diets.length - 1))] ?? 0, carni: diets.filter((x) => x > 0.15).length / d, size: size / d, maxScale, hunterFrac: hunters / d, limbAll: limbAll / d, limbRatio: legged ? limbRatio / legged : 0, leggedFrac: legged / d, skin: skin / d, load: load / d, swimmers: swim };
}

export function run(world: WorldConfig, c: Cond, seconds: number, seed?: number) {
  const { eco, env } = build(world, c, seed);
  for (let t = 0; t < seconds / DT; t++) eco.step(env, DT);
  return metrics(eco);
}

const fmt = (m: ReturnType<typeof metrics>) => Object.entries(m).map(([k, v]) => `${k}=${Number(v).toFixed(3)}`).join(' ');
// Run: AB=o2|temp|grav|skin|all WORLD=carbon|silicon SECS=340 node ../node_modules/vite-node/vite-node.mjs scripts/climateAB.ts
const envv = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
if (envv.AB && envv.AB !== 'sim') {
  const which = envv.AB;
  const w = envv.WORLD === 'silicon' ? silicon : carbon;
  const secs = Number(envv.SECS ?? 340);
  const t0 = Date.now();
  const cases: Record<string, [string, Cond][]> = {
    o2: [['O2 30%', { oxygen: 30 }], ['O2 5%', { oxygen: 5 }]],
    temp: [['T 35C', { temperature: 35 }], ['T -20C', { temperature: -20 }]],
    grav: [['g 0.8', { gravity: 0.8 }], ['g 1.3', { gravity: 1.3 }]],
    skin: [['base', {}]],
  };
  for (const [k, list] of Object.entries(cases)) {
    if (which !== 'all' && which !== k) continue;
    for (const [label, c] of list) console.log(label.padEnd(8), fmt(run(w, c, secs)));
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s cpu`);
}
