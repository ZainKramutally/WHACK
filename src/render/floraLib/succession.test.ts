import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { makeStubVisualInputs } from '../visualInputs';
import type { VisualInputs } from '../../worlds/types';
import type { App } from '../app';
import { createFlora } from '../flora';
import { ARCHETYPE_KEYS } from './index';
import { makePlantList, placePlants } from './place';
import { GATES, gateShare, worldEnv } from './gates';
import { createTerrain, seaLevelForCover, type TerrainState } from '../../gen/terrain';
import { crustMap } from '../../gen/crust';
import { carbon } from '../../worlds/carbon';
import { SHARE_RATE, SHARE_REBUILD, easeShares, easedGates, gateTarget, gateTargets, shareDelta, statsMoved, statsOf, type GateShares } from './succession';

const PATCH = 400;
function inputs(over: Partial<VisualInputs> = {}, stats: Record<string, number> = {}): VisualInputs {
  const flora = new Float32Array(64 * 64 * 2);
  for (let c = 0; c < 4096; c++) { flora[c * 2] = 0.8; flora[c * 2 + 1] = 0.6; }
  const stub = makeStubVisualInputs();
  return { ...stub, flora, seaLevel: -1, terrain: { rise: 1, progress: {}, height: () => 0, patchSize: PATCH }, lifeOnLand: true, buildProgress: 1, ...over, stats: { ...stub.stats, ...stats } };
}

describe('succession easing (succession.ts)', () => {
  it('eases each gate\'s share to its target monotonically, at SHARE_RATE, exactly arriving, and back', () => {
    const e: GateShares = { cushion: 0 };
    let prev = 0, t = 0;
    for (; t < 15; t += 0.1) {
      easeShares(e, { cushion: 1 }, 0.1);
      expect(e.cushion!).toBeGreaterThanOrEqual(prev);
      expect(e.cushion! - prev).toBeLessThanOrEqual(SHARE_RATE * 0.1 + 1e-9);
      prev = e.cushion!;
    }
    expect(e.cushion).toBe(1);
    for (let k = 0; k < 150; k++) { const p = e.cushion!; easeShares(e, { cushion: 0.5 }, 0.1); expect(e.cushion!).toBeLessThanOrEqual(p); }
    expect(e.cushion).toBe(0.5);
    easeShares(e, { cushion: 0 }, 0.1, true); // a new world snaps
    expect(e.cushion).toBe(0);
  });

  it('targets follow gates.ts gateShare (ramp × share): niche gates stay off at defaults, and eased copies carry no ramp', async () => {
    const { GATES, gateShare } = await import('./gates');
    const e = worldEnv(inputs());
    for (const g of GATES) expect(gateTarget(g, e), g.id).toBe(Math.min(1, Math.max(0, gateShare(g, e))));
    const ramped = GATES.filter((g) => g.ramp && g.chem === 'carbon');
    expect(ramped.length).toBeGreaterThan(0);
    for (const g of ramped) expect(gateTarget(g, e), `${g.id} at defaults`).toBe(gateShare(g, e));
    const g = ramped[0];
    const copy = easedGates(e, { [g.id]: 0.3 } as GateShares)[g.role].find((x) => x.id === g.id)!;
    expect(copy.ramp).toBeUndefined();
    expect(copy.share).toBe(0.3);
    expect(gateShare(copy, e)).toBe(0.3);
  });

  it('at the default conditions nothing changes: shares hold, so no re-placement is triggered', () => {
    const inp = inputs();
    const e = easeShares({}, gateTargets(worldEnv(inp)), 0, true), placed = { ...e };
    for (let k = 0; k < 600; k++) easeShares(e, gateTargets(worldEnv(inp)), 1 / 60);
    expect(shareDelta(e, placed)).toBe(0);
    expect(statsMoved(inp, statsOf(inp))).toBe(false);
  });

  it('colonisation only adds: plants that flipped at a lower share stay flipped at a higher one', () => {
    const inp = inputs({}, { temperature: -10 });
    const cushion = ARCHETYPE_KEYS.indexOf('groundCover#4');
    const flipped = (s: number) => {
      const l = placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList(), undefined, null, undefined, { cushion: s });
      const set = new Set<string>();
      for (let i = 0; i < l.n; i++) if (l.arch[i] === cushion) set.add(`${l.cell[i]}/${l.slot[i]}/${l.dark[i]}`);
      return set;
    };
    const a = flipped(0.3), b = flipped(0.7), none = flipped(0), all = flipped(1);
    expect(none.size).toBe(0);
    expect(a.size).toBeGreaterThan(0);
    expect(b.size).toBeGreaterThan(a.size);
    expect(all.size).toBeGreaterThan(b.size);
    for (const k of a) expect(b.has(k), k).toBe(true);
    for (const k of b) expect(all.has(k), k).toBe(true);
  });

  it('a slider-driven stat change re-places within the fast cadence, even when the flora grid is unchanged', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    camera.position.set(0, 3, 6);
    const app = { scene: new THREE.Scene(), camera } as unknown as App;
    const flora = createFlora(app);
    const warm = inputs();
    flora.update(1 / 60, 1, warm, PATCH);
    const teeth = () => { const l = flora.placed(); let n = 0; for (let i = 0; i < l.n; i++) n += l.teeth[i]; return n / Math.max(1, l.n); };
    const before = teeth();
    // the same flora buffer, only the temperature moved (the slider): T6 makes every carbon plant toothed below 1 °C
    const cold: VisualInputs = { ...warm, stats: { ...warm.stats, temperature: -5 } };
    flora.update(1 / 60, 1.3, cold, PATCH);
    expect(teeth()).toBeGreaterThan(before);
    // and a cold gate's share starts easing in (re-placed when it has moved by SHARE_REBUILD)
    let t = 1.3;
    const cushion = ARCHETYPE_KEYS.indexOf('groundCover#4');
    const count = () => { const l = flora.placed(); let n = 0; for (let i = 0; i < l.n; i++) n += l.arch[i] === cushion ? 1 : 0; return n; };
    const seen: number[] = [count()];
    for (let k = 0; k < 13 * 60; k++) { t += 1 / 60; flora.update(1 / 60, t, cold, PATCH); if (k % 60 === 59) seen.push(count()); }
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeGreaterThanOrEqual(seen[k - 1]);
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[1]);
    expect(SHARE_REBUILD).toBeLessThan(0.1);
    flora.dispose();
  });
});

describe('succession on the carbon demo terrain (natural crust mix)', () => {
  const NICHE = ['barrel', 'thorn', 'nitro', 'lycopod', 'heath', 'reeds'] as const;
  function demo(stats: Record<string, number>): VisualInputs {
    const w = carbon, terrain = createTerrain(w.terrain, w.demoSeed), stub = makeStubVisualInputs();
    const hs = Math.min(1, Math.max(0, 0.5 + (15 - w.solvent.freezeC) / w.terrain.heatSolventSpan));
    const state: TerrainState = { rise: 1, heatSolvent: hs, progress: Object.fromEntries(w.terrain.machines.map((m) => [m.id, 1])) };
    const sea = seaLevelForCover(terrain, state, (w.targets.seaCover[0] + w.targets.seaCover[1]) / 200);
    const minerals = w.terrain.crust.minerals, map = crustMap(w, w.demoSeed);
    const flora = new Float32Array(64 * 64 * 2);
    for (let c = 0; c < 4096; c++) { flora[c * 2] = 0.8; flora[c * 2 + 1] = 0.6; }
    return {
      ...stub, flora, lifeOnLand: true, buildProgress: 1, light: 1, seaLevel: sea,
      world: { ...stub.world, id: 'carbon', solvent: w.solvent, composition: w.life.composition,
        crust: { ids: minerals.map((m) => m.id), oxidises: minerals.map((m) => m.oxidises), shares: map.shares, elevation: minerals.map((m) => m.elevation) } },
      stats: { ...stub.stats, temperature: 15, nitrogen: 1, oxygen: 21, co2: 0.25, seaLevel: sea, ...stats },
      terrain: { rise: 1, progress: state.progress as Record<string, number>, height: (x, z) => terrain.height(x, z, state), patchSize: PATCH,
        crust: { minerals, weights: (x, z) => terrain.crustWeights(x, z) } },
    };
  }
  const nicheBy = new Set(GATES.filter((g) => (NICHE as readonly string[]).includes(g.id)).map((g) => g.by));
  const countNiche = (l: ReturnType<typeof makePlantList>, by?: string) => { let n = 0; for (let i = 0; i < l.n; i++) { const k = ARCHETYPE_KEYS[l.arch[i]]; if (by ? k === by : nicheBy.has(k)) n++; } return n; };

  it('at defaults (15 °C, N 1, O₂ 21, natural mix) succession places no niche kind; at 40 °C barrels ease in to their gateShare target', () => {
    const base = demo({});
    const shares = easeShares({}, gateTargets(worldEnv(base)), 0, true);
    for (const id of NICHE) expect(shares[id], id).toBe(0);
    expect(countNiche(placePlants(base, PATCH, { x: 0, z: 0 }, makePlantList(), undefined, null, undefined, shares))).toBe(0);

    const hot = demo({ temperature: 40 }), barrel = GATES.find((g) => g.id === 'barrel')!;
    const target = gateShare(barrel, worldEnv(hot));
    expect(target).toBeGreaterThan(0.2);
    const counts: number[] = [];
    let prev = 0;
    for (let k = 0; k < 15 * 4; k++) {
      easeShares(shares, gateTargets(worldEnv(hot)), 0.25);
      expect(shares.barrel!).toBeGreaterThanOrEqual(prev);
      prev = shares.barrel!;
      if (k % 8 === 7) counts.push(countNiche(placePlants(hot, PATCH, { x: 0, z: 0 }, makePlantList(), undefined, null, undefined, shares), barrel.by));
    }
    expect(shares.barrel).toBe(target);
    for (let k = 1; k < counts.length; k++) expect(counts[k]).toBeGreaterThanOrEqual(counts[k - 1]);
    expect(counts[counts.length - 1]).toBeGreaterThan(0);
  });
});
