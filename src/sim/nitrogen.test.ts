// #55: the Nitrogen slider reaches the creatures (CLAUDE.md "Condition sliders").
// Silicon: nitrogen is the sea, so lowering it shrinks the sea, strands its swimmers (they cannot graze where they cannot
// live) and costs their numbers within seconds; raising it brings the sea and the swimmers back.
// Carbon: nitrogen is air, so the sea stays put and only the 0.05× edge ("Not enough nitrogen to build cells") stresses life.
// Each case runs a full 20 s build plus live ecology on the demo seed, so they run with SLOW=1 only.
import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import type { WorldConfig } from '../worlds/types';
import { LOCOMOTION } from './develop';
import { organismCount, readOrganism } from './organismLayout';
import { WorldSimulation } from './simulation';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;

function census(sim: WorldSimulation) {
  const s = sim.snapshot();
  let animals = 0, swimmers = 0;
  for (let i = 0, n = organismCount(s.organisms); i < n; i++) {
    const r = readOrganism(s.organisms, i);
    if (r.role !== 1) continue;
    animals++;
    if (r.mode === LOCOMOTION.swim) swimmers++;
  }
  return { animals, swimmers, seaCover: s.stats.seaCover };
}

/** Advance in 50 ms frames (the frame rate never changes the outcome). */
const runFor = (sim: WorldSimulation, sec: number) => { for (let k = 0; k < sec * 20; k++) sim.advance(0.05); };

/** The world's default run at the end of its build, plus 10 s of live ecology to settle. */
function settled(w: WorldConfig): WorldSimulation {
  const sim = new WorldSimulation(w, { ...w.startDefaults });
  runFor(sim, w.build.durationSec + 10);
  return sim;
}

describe('the Nitrogen slider reaches the creatures (#55)', () => {
  it.skipIf(!slow)('silicon: lowering nitrogen shrinks the sea and costs its swimmers; raising it brings them back', () => {
    const sim = settled(silicon);
    const before = census(sim);
    sim.setControl('nitrogen', sim.snapshot().bands.nitrogen.low * 1.15);
    runFor(sim, 10);
    const dry = census(sim);
    expect(dry.seaCover).toBeLessThan(before.seaCover / 2);
    expect(dry.swimmers).toBeLessThan(before.swimmers * 0.6);

    sim.setControl('nitrogen', silicon.startDefaults.nitrogen);
    runFor(sim, 60);
    const wet = census(sim);
    expect(wet.seaCover).toBeGreaterThan(before.seaCover * 0.9);
    expect(wet.swimmers).toBeGreaterThan(dry.swimmers * 1.5);
  }, 120_000);

  it.skipIf(!slow)('carbon: nitrogen is air, so the sea stays put and only the 0.05× edge stresses life', () => {
    const sim = settled(carbon);
    const before = census(sim);
    sim.setControl('nitrogen', 0.06);
    runFor(sim, 10);
    const edge = census(sim);
    expect(Math.abs(edge.seaCover - before.seaCover)).toBeLessThan(1);
    expect(edge.animals).toBeLessThan(before.animals / 2);

    sim.setControl('nitrogen', carbon.startDefaults.nitrogen);
    runFor(sim, 30);
    expect(census(sim).animals).toBeGreaterThan(edge.animals);
  }, 120_000);
});
