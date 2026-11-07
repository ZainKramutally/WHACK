import { describe, expect, it } from 'vitest';
import { makeRng } from './rng';
import { ORGANISM_STRIDE, OrganismField } from './organismLayout';
import { CONSUMER, PRODUCER, Population, pace, type Environment, type Genome, type LifeRules } from './population';

// Test fixtures only. The real values live in each world's config (life.rules).
const carbonRules: LifeRules = {
  maxOrganisms: 400,
  producerCapacity: 300,
  timeScale: 1,
  metabolism: { activationEnergyKJ: 50, referenceC: 15, compression: 0.03 },
  producer: { lightGain: 1, upkeep: 0.3 },
  consumer: { biteRate: 10, biteSize: 0.12, assimilation: 0.7, upkeep: 0.15, halfFood: 40, interference: 4, grazeShare: 0.6 },
  reproduction: { energyThreshold: 1, childShare: 0.5, maturityAge: 0.3 },
  lifespan: 6,
  toleranceCost: 0.02,
  stressDeath: 1.5,
  edgeStressWeight: 1,
  mutation: { size: 0.05, prefTemp: 0.6, tolerance: 0.3, chem: 0.05, roleFlip: 0 },
  bounds: { size: [0.2, 5], tolerance: [1, 30] },
  chemTrait: { kind: 'oxygenNeed', halfSaturation: 2, aerobicBonus: 1, baseMaxSize: 0.5, maxSizePerPercent: 0.1 },
};

const siliconRules: LifeRules = {
  ...carbonRules,
  chemTrait: { kind: 'coldStability', warmRelief: 0.5, cost: 0.2 },
};

const spread = { size: 0.1, prefTemp: 3, tolerance: 1, chem: 0.1 };
const plant = (prefTemp: number): Genome => ({ role: PRODUCER, size: 1, prefTemp, tolerance: 8, chem: 0 });
const animal = (prefTemp: number, chem: number): Genome => ({ role: CONSUMER, size: 1, prefTemp, tolerance: 8, chem });
const env = (temperature: number, extra: Partial<Environment> = {}): Environment => ({
  temperature,
  oxygen: 21,
  light: 1,
  habitat: 1,
  edgeStress: 0,
  ...extra,
});

const DT = 0.05; // demo seconds per step
function run(pop: Population, envAt: (t: number) => Environment, seconds: number) {
  for (let t = 0; t < seconds; t += DT) pop.step(envAt(t), DT);
}

function newPop(rules: LifeRules, seed = 1) {
  return new Population(rules, makeRng(seed)('population'));
}

describe('pace', () => {
  it('is 1 at the reference temperature and about a quarter at −183 °C', () => {
    expect(pace(15, carbonRules.metabolism)).toBeCloseTo(1, 10);
    const cold = pace(-183, carbonRules.metabolism);
    expect(cold).toBeGreaterThan(0.2);
    expect(cold).toBeLessThan(0.3);
  });
});

describe('Population', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const make = (seed: number) => {
      const p = newPop(carbonRules, seed);
      p.seed(100, plant(15), spread);
      run(p, () => env(15), 20);
      return p.pack().data;
    };
    expect(make(42)).toEqual(make(42));
    expect(make(43)).not.toEqual(make(42));
  });

  it('settles below the producer capacity without dying out', () => {
    const p = newPop(carbonRules);
    p.seed(20, plant(15), spread);
    run(p, () => env(15), 40);
    const { producers } = p.stats();
    expect(producers).toBeGreaterThan(0.4 * carbonRules.producerCapacity);
    expect(producers).toBeLessThanOrEqual(carbonRules.producerCapacity);
  });

  it('adapts its preferred temperature when the climate slowly warms', () => {
    const p = newPop(carbonRules);
    p.seed(150, plant(15), spread);
    // 10 s steady, 40 s warming from 15 to 30 °C, 20 s holding at 30 °C.
    run(p, (t) => env(t < 10 ? 15 : t < 50 ? 15 + (15 * (t - 10)) / 40 : 30), 70);
    const s = p.stats();
    expect(s.producers).toBeGreaterThan(50);
    expect(s.traitAverages.prefTemp).toBeGreaterThan(24);
  });

  it('keeps producers and consumers alive together, and evolves bigger, more aerobic consumers in oxygen-rich air', () => {
    // As in the sim: producers settle first, then a few small, mildly aerobic consumers arrive.
    const at = (oxygen: number) => {
      const p = newPop(carbonRules, 1);
      p.seed(150, plant(15), spread);
      run(p, () => env(15, { oxygen }), 10);
      p.seed(10, { ...animal(15, 0.3), size: 0.5 }, spread);
      run(p, () => env(15, { oxygen }), 60);
      return p.stats();
    };
    const rich = at(21);
    const poor = at(0.5);
    expect(rich.producers).toBeGreaterThan(50);
    expect(poor.producers).toBeGreaterThan(50);
    expect(rich.consumers).toBeGreaterThan(0);
    expect(poor.consumers).toBeGreaterThan(0);
    expect(rich.traitAverages.consumerSize).toBeGreaterThan(poor.traitAverages.consumerSize);
    expect(rich.traitAverages.consumerChem).toBeGreaterThan(poor.traitAverages.consumerChem);
  });

  it('passes fewer generations in the cold (silicon pace) than at carbon pace', () => {
    const carbon = newPop(carbonRules);
    carbon.seed(100, plant(15), spread);
    run(carbon, () => env(15), 30);

    const silicon = newPop(siliconRules);
    silicon.seed(100, { ...plant(-183), chem: 0.5 }, spread);
    run(silicon, () => env(-183), 30);

    expect(silicon.count).toBeGreaterThan(0);
    expect(silicon.stats().generation).toBeGreaterThan(0);
    expect(silicon.stats().generation).toBeLessThan(0.5 * carbon.stats().generation);
  });

  it('keeps silicon life alive through slow warming, with its comfort band following', () => {
    const p = newPop(siliconRules);
    p.seed(150, { ...plant(-183), chem: 0.3 }, spread);
    // 60 s warming from −183 to −175 °C, then 60 s holding: silicon's slow drift, not a slider yank.
    run(p, (t) => env(-183 + 8 * Math.min(1, t / 60), { oxygen: 0 }), 120);
    const s = p.stats();
    expect(s.producers).toBeGreaterThan(50);
    expect(s.traitAverages.prefTemp).toBeGreaterThan(-181);
  });

  it('thins out as conditions near a lethal limit', () => {
    const at = (edgeStress: number) => {
      const p = newPop(carbonRules, 3);
      p.seed(100, plant(15), spread);
      run(p, () => env(15, { edgeStress }), 30);
      return p.count;
    };
    expect(at(0.5)).toBeLessThan(at(0));
  });

  it('gives each organism a stable id that is never reused, so an inspect card can follow it', () => {
    const p = newPop(carbonRules);
    p.seed(100, plant(15), spread);
    const ids = (pop: Population) => {
      const { data } = pop.pack();
      const out: number[] = [];
      for (let o = 0; o < data.length; o += ORGANISM_STRIDE) out.push(data[o + OrganismField.id]);
      return out;
    };
    const before = ids(p);
    run(p, () => env(15), 10);
    const after = ids(p);
    // Survivors keep their ids; newborns get ids never seen before; nobody shares an id.
    expect(new Set(after).size).toBe(after.length);
    const maxBefore = Math.max(...before);
    const beforeSet = new Set(before);
    for (const id of after) expect(beforeSet.has(id) || id > maxBefore).toBe(true);
  });

  it('packs one record per living organism', () => {
    const p = newPop(carbonRules);
    p.seed(50, plant(15), spread);
    p.seed(10, animal(15, 0.5), spread);
    run(p, () => env(15), 5);
    const { data, count } = p.pack();
    expect(count).toBe(p.count);
    expect(data.length).toBe(count * ORGANISM_STRIDE);
    for (let o = 0; o < data.length; o += ORGANISM_STRIDE) {
      expect([PRODUCER, CONSUMER]).toContain(data[o + OrganismField.role]);
    }
  });
});
