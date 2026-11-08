import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { makeStubVisualInputs } from '../visualInputs';
import type { VisualInputs } from '../../worlds/types';
import type { App } from '../app';
import { createFlora } from '../flora';
import { ARCHETYPE_KEYS } from './index';
import { makePlantList, placePlants } from './place';
import { worldEnv } from './gates';
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
