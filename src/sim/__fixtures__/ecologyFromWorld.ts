// Test helper: builds an Ecology the way the worker will, from a real WorldConfig at its demo seed.
// Terrain heights at full rise → sea level for a mid-target sea cover → per-cell liquid depth; nutrients and the
// ledger come from the config. Not used by app code.
import { createTerrain, sampleHeights, seaLevelFromHeights } from '../../gen/terrain';
import type { WorldConfig } from '../../worlds/types';
import { Ecology, type EcologyEnv, type EcologyLedger } from '../ecology';
import { createGrid, CELLS } from '../grid';

/** Typical start-of-world conditions per world (the worker takes these from live stats). */
export function startEnv(world: WorldConfig): EcologyEnv {
  return world.id === 'carbon'
    ? { temperature: 15, oxygen: 21, light: 1, habitat: 1, edgeStress: 0, heatBand: 0.5 }
    : { temperature: -183, oxygen: 0, light: 0.01, habitat: 1, edgeStress: 0, heatBand: 0.5 };
}

export function ecologyFromWorld(world: WorldConfig): { eco: Ecology; env: EcologyEnv } {
  const terrain = createTerrain(world.terrain, world.demoSeed);
  const heights = sampleHeights(terrain, { rise: 1, progress: {}, heatSolvent: 0.5 });
  const cover = (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200;
  const seaLevel = seaLevelFromHeights(heights, cover);
  const liquid = new Float32Array(CELLS);
  for (let i = 0; i < CELLS; i++) liquid[i] = Math.max(0, seaLevel - heights[i]);
  const L = world.life.ledger as unknown as EcologyLedger & { supplyC: number; supplySi: number; supplyO: number };
  const env = startEnv(world);
  const airKgM3 = world.id === 'carbon' ? 1.2 : 13; // real P·M/(R·T); the worker computes this live
  const eco = new Ecology({
    seed: world.demoSeed,
    grid: createGrid({ liquid, supply: { c: L.supplyC, si: L.supplySi, o: L.supplyO } }),
    rules: world.life.rules,
    inputs: {
      solvent: world.life.inputs.solvent,
      airDensity: world.life.inputs.airDensity.scale * airKgM3,
      tissueDensity: world.life.inputs.tissueDensity,
    },
    composition: world.life.composition,
    founderClimate: { prefTemp: world.life.founders.prefTemp, tolerance: world.life.founders.tolerance, chem: world.life.founders.chem },
    ledger: L,
  });
  return { eco, env };
}
