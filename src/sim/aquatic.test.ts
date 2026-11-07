// Aquatic communities (owner request): a sea that holds swimmers, made by the same develop()/selection method.
import { describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import type { WorldConfig } from '../worlds/types';
import { ecologyFromWorld } from './__fixtures__/ecologyFromWorld';
import type { BodyPlan } from './develop';
import { CAP, Ecology } from './ecology';
import { WorldSimulation } from './simulation';

const slow = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SLOW;
const DT = 1 / 20;
const bestMode = (eco: Ecology, costs: BodyPlan['modeCosts'], mode: number, liquid: number, stranded = false): number =>
  (eco as unknown as { bestMode(p: { modeCosts: BodyPlan['modeCosts']; mode: number }, l: number, s: boolean): number }).bestMode({ modeCosts: costs, mode }, liquid, stranded);

describe('medium decides the mode, and a body keeps to its habitat', () => {
  const { eco } = ecologyFromWorld(carbon);
  const cheap = { walk: 2, swim: 3, hover: 0.5, sessile: 8 };
  it('hover is flight: allowed over land and the shore, never over the sea', () => {
    expect(bestMode(eco, cheap, 2, 0)).toBe(2);
    expect(bestMode(eco, cheap, 2, eco.L.wadeDepth)).toBe(2);
    expect(bestMode(eco, cheap, 2, 3)).toBe(3);   // a hoverer cannot go over deep water
  });
  it('a swimmer stays in the sea: it cannot step onto land, however cheap walking is', () => {
    expect(bestMode(eco, { walk: 0.1, swim: 3, hover: 20, sessile: 8 }, 1, 0)).toBe(3);
    expect(bestMode(eco, { walk: 0.1, swim: 3, hover: 20, sessile: 8 }, 1, 2)).toBe(1);
  });
  it('a walker cannot enter deep water, even if it could afford to swim', () => {
    expect(bestMode(eco, { walk: 1, swim: 2, hover: 20, sessile: 8 }, 0, 3)).toBe(3);
    expect(bestMode(eco, { walk: 1, swim: 2, hover: 20, sessile: 8 }, 0, 0.2)).toBe(0);
  });
  it('a stranded animal moves in its own mode to get home', () => {
    expect(bestMode(eco, { walk: 1, swim: 9, hover: 20, sessile: 8 }, 0, 3, true)).toBe(0);
    expect(bestMode(eco, { walk: 9, swim: 2, hover: 20, sessile: 8 }, 1, 0, true)).toBe(1);
  });
});

describe.each([carbon, silicon])('founders in both niches ($id)', (w: WorldConfig) => {
  it('seeds swimmers in the sea and walkers on the shore, each in a cell that suits its body', () => {
    const { eco, env } = ecologyFromWorld(w);
    eco.seedLife(env);
    expect(eco.animals).toBeGreaterThanOrEqual(24);
    for (let i = 0; i < CAP; i++) {
      if (!eco.alive[i]) continue;
      const liquid = eco.grid.liquid[Math.floor(eco.y[i]) * 64 + Math.floor(eco.x[i])];
      if (eco.plan[i].mode === 1) expect(liquid).toBeGreaterThan(0);
      else if (eco.plan[i].mode !== 3) expect(liquid).toBeLessThanOrEqual(eco.L.wadeDepth);
    }
  });
  it('keeps to its habitat for a while: nearly all swimmers in the sea, nearly all walkers on land', () => {
    const { eco, env } = ecologyFromWorld(w);
    eco.seedLife(env);
    for (let t = 0; t < 600; t++) eco.step(env, DT);
    let sw = 0, swOk = 0, wk = 0, wkOk = 0;
    for (let i = 0; i < CAP; i++) {
      if (!eco.alive[i]) continue;
      const liquid = eco.grid.liquid[Math.floor(eco.y[i]) * 64 + Math.floor(eco.x[i])];
      if (eco.plan[i].mode === 1) { sw++; if (liquid > 0) swOk++; }
      else if (eco.plan[i].mode !== 3) { wk++; if (liquid <= eco.L.wadeDepth) wkOk++; }
    }
    expect(sw + wk).toBeGreaterThanOrEqual(24);
    if (sw > 0) expect(swOk / sw).toBeGreaterThanOrEqual(0.9);
    if (wk > 0) expect(wkOk / wk).toBeGreaterThanOrEqual(0.9);
  });
});

describe('one bud per parent per decide window', () => {
  it('a parent that stays in the "bud" action for several ticks still buds once per window', () => {
    const { eco, env } = ecologyFromWorld(carbon);
    eco.seedLife(env);
    const seen = new Map<string, number>();
    let total = 0;
    const proto = Ecology.prototype as unknown as { bud(p: number): void };
    const orig = proto.bud;
    proto.bud = function (this: Ecology, p: number) {
      const window = Math.floor((this.tick + p) / 4); // decide() runs when (tick + slot) % DECIDE_EVERY === 0
      const key = `${this.id[p]}:${window}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      total++;
      orig.call(this, p);
    };
    try {
      for (let t = 0; t < 600; t++) eco.step(env, DT);
    } finally {
      proto.bud = orig;
    }
    expect(total).toBeGreaterThan(10);
    expect(Math.max(...seen.values())).toBe(1);
  });
});

describe('the sea is inhabited at the end of the build (SLOW)', () => {
  it.skipIf(!slow).each([[silicon, silicon.demoSeed], [silicon, 7], [silicon, 424242]] as [WorldConfig, number][])('silicon seed %# keeps a swimming community in the sea (SLOW)', { timeout: 120000 }, (w, seed) => {
    const sim = new WorldSimulation(w, { temperature: 15, nitrogen: 1, oxygen: 21 }, { seed });
    sim.advance(w.build.durationSec);
    const eco = (sim as unknown as { life: { eco: Ecology } }).life.eco;
    let n = 0, inWater = 0, swimmers = 0, swimmersInWater = 0, hoverOverDeep = 0;
    for (let i = 0; i < CAP; i++) {
      if (!eco.alive[i]) continue;
      n++;
      const liquid = eco.grid.liquid[Math.floor(eco.y[i]) * 64 + Math.floor(eco.x[i])];
      if (liquid > 0) inWater++;
      if (eco.plan[i].mode === 1) { swimmers++; if (liquid > 0) swimmersInWater++; }
      if (eco.mode[i] === 2 && liquid > eco.L.wadeDepth + 2) hoverOverDeep++;
    }
    expect(n).toBeGreaterThan(900);
    expect(inWater / n).toBeGreaterThanOrEqual(0.3);
    expect(swimmers).toBeGreaterThan(0);
    expect(swimmersInWater / swimmers).toBeGreaterThanOrEqual(0.5);
    expect(hoverOverDeep / n).toBeLessThan(0.02);
  });
});
