// Full-sim A/B: a WorldSimulation from Generate through the build, at given slider settings. Prints life metrics.
// Run: AB=1 WORLD=carbon O2=30 T=15 N=1 G=1.0 EXTRA=60 node ../node_modules/vite-node/vite-node.mjs scripts/simAB.ts
import { carbon } from '../src/worlds/carbon';
import { silicon } from '../src/worlds/silicon';
import { WorldSimulation } from '../src/sim/simulation';
import { EcologyLife } from '../src/sim/lifeModel';
import type { Ecology } from '../src/sim/ecology';
import { metrics } from './climateAB';
import type { WorldConfig } from '../src/worlds/types';

const e = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
export function makeSim(w: WorldConfig, cond: { temperature: number; nitrogen: number; oxygen: number }, gravity?: number, seed = w.demoSeed) {
  let world: WorldConfig = gravity ? { ...w, ranges: { ...w.ranges, gravity: [gravity, gravity] as [number, number] } } : w;
  if (e.LEDGER) world = { ...world, life: { ...world.life, ledger: { ...world.life.ledger, ...JSON.parse(e.LEDGER) } } };
  if (e.ECON) world = { ...world, life: { ...world.life, inputs: { ...world.life.inputs, economics: { ...world.life.inputs.economics!, ...JSON.parse(e.ECON) } } } };
  const holder: { life?: EcologyLife } = {};
  let sim!: WorldSimulation;
  const life = new EcologyLife(world, seed, { liquid: () => (sim as unknown as { liquidNow(): ArrayLike<number> }).liquidNow() });
  holder.life = life;
  sim = new WorldSimulation(world, cond, { life, seed });
  const eco = () => (life as unknown as { eco: Ecology }).eco;
  return { sim, eco, world };
}
export function runBuild(sim: WorldSimulation, world: WorldConfig, extraSec = 0): number {
  const step = 0.25;
  let forms = 0;
  for (let t = 0; t < world.build.durationSec + extraSec; t += step) {
    sim.advance(step);
    sim.snapshot();
    for (const ev of sim.drainEvents()) if (ev.type === 'guide:newForm') forms++;
  }
  return forms;
}
if (e.AB === 'sim') {
  const w = e.WORLD === 'silicon' ? silicon : carbon;
  const isC = w.id === 'carbon';
  const cond = { temperature: Number(e.T ?? (isC ? 15 : -183)), nitrogen: Number(e.N ?? (isC ? 1 : 30)), oxygen: Number(e.O2 ?? 0) };
  const t0 = Date.now();
  const { sim, eco, world } = makeSim(w, cond, e.G ? Number(e.G) : undefined, e.SEED ? Number(e.SEED) : undefined);
  const forms = runBuild(sim, world, Number(e.EXTRA ?? 0));
  const s = sim.snapshot();
  const m = metrics(eco());
  console.log(JSON.stringify(cond), 'g=' + (s.stats.gravity ?? '?'), 'O2=' + s.stats.oxygen.toFixed(1), 'T=' + s.stats.temperature.toFixed(1), 'N=' + s.stats.nitrogen.toFixed(2), 'sea=' + s.stats.seaCover.toFixed(0));
  console.log(Object.entries(m).map(([k, v]) => `${k}=${Number(v).toFixed(3)}`).join(' '), `forms=${forms}`, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// Table mode: AB=table SEEDS=11,12,13 EXTRA=250 → means over seeds for each condition pair, carbon.
if (e.AB === 'table') {
  const seeds = (e.SEEDS ?? '11,12,13').split(',').map(Number);
  const pairs: [string, { temperature: number; nitrogen: number; oxygen: number }, number | undefined][] = [
    ['O2 30%', { temperature: 15, nitrogen: 1, oxygen: 30 }, undefined], ['O2 5%', { temperature: 15, nitrogen: 1, oxygen: 5 }, undefined],
    ['T 35C', { temperature: 35, nitrogen: 1, oxygen: 21 }, undefined], ['T -20C', { temperature: -20, nitrogen: 1, oxygen: 21 }, undefined],
    ['g 0.8', { temperature: 15, nitrogen: 1, oxygen: 21 }, 0.8], ['g 1.3', { temperature: 15, nitrogen: 1, oxygen: 21 }, 1.3],
    ['N 0.12x', { temperature: 15, nitrogen: 0.12, oxygen: 21 }, undefined], ['N 1x', { temperature: 15, nitrogen: 1, oxygen: 21 }, undefined],
  ];
  const keys = ['n', 'sizeTop', 'walkN', 'walkLimb', 'walkLen', 'flora', 'bodyMass', 'size', 'maxScale', 'diet', 'carni', 'limbAll', 'limbRatio', 'leggedFrac', 'skin', 'load'];
  for (const [label, cond, g] of pairs) {
    if (e.ONLY && !label.startsWith(e.ONLY)) continue;
    const acc: Record<string, number> = {};
    for (const sd of seeds) {
      const { sim, eco, world } = makeSim(carbon, cond, g, sd);
      runBuild(sim, world, Number(e.EXTRA ?? 250));
      const m = metrics(eco()) as unknown as Record<string, number>;
      for (const k of keys) acc[k] = (acc[k] ?? 0) + m[k] / seeds.length;
    }
    console.log(label.padEnd(8), keys.map((k) => `${k}=${acc[k].toFixed(3)}`).join(' '));
  }
}
