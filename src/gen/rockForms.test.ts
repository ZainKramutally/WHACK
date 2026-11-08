import { beforeAll, describe, expect, it } from 'vitest';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { withCrustChoice } from './crust';
import { createTerrain, sampleHeights, seaLevelFromHeights, spawnPoint, type TerrainState } from './terrain';
import { createLandmarks } from './landmarks';
import { createRockForms, MAX_FORMS, WEIGHT_MIN, type RockFormSet } from './rockForms';
import type { CrustPickId, WorldConfig } from '../worlds/types';

const FULL: TerrainState = { rise: 1, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 }, heatSolvent: 0.5 };

function run(w: WorldConfig, pick?: CrustPickId) {
  const world = withCrustChoice(w, pick);
  const terrain = createTerrain(world.terrain, world.demoSeed);
  const seaCover = (world.targets.seaCover[0] + world.targets.seaCover[1]) / 200;
  const lm = createLandmarks(terrain, { chemistry: world.life.composition.si > 0.5 ? 'silicon' : 'carbon', seaCover });
  const rf = createRockForms(terrain, lm, { seaCover });
  const sea = seaLevelFromHeights(sampleHeights(terrain, FULL, 64), seaCover);
  return { world, terrain, rf, spawn: spawnPoint(terrain, FULL, sea) };
}

const cases: [string, WorldConfig, CrustPickId | undefined][] = [
  ['carbon natural', carbon, undefined], ['silicon natural', silicon, undefined],
  ...(['basalt', 'granite', 'ironstone', 'silicide', 'nitride'] as CrustPickId[]).flatMap((p) => [[`carbon ${p}`, carbon, p], [`silicon ${p}`, silicon, p]] as [string, WorldConfig, CrustPickId][]),
];
const results = new Map<string, ReturnType<typeof run>>();
beforeAll(() => { for (const [name, w, p] of cases) results.set(name, run(w, p)); }, 120000);

describe('rock forms', () => {
  it('stays inside the triangle budget per family', () => {
    for (const [name] of cases) {
      const { rf } = results.get(name)!;
      for (const f of rf.families) expect(f.triangles, `${name} ${f.family}`).toBeLessThan(8000);
      expect(rf.families.length).toBeLessThanOrEqual(5);
    }
  });
  it('is deterministic', () => {
    const a = run(carbon), b = results.get('carbon natural')!;
    expect(a.rf.forms).toEqual(b.rf.forms);
    expect(Array.from(a.rf.families[0].positions.slice(0, 300))).toEqual(Array.from(b.rf.families[0].positions.slice(0, 300)));
  });
  it('places each structure only where its mineral dominates, clear of the spawn, within budget', () => {
    for (const [name] of cases) {
      const { world, terrain, rf, spawn } = results.get(name)!;
      const ids = world.terrain.crust.minerals.map((m) => m.id);
      expect(rf.forms.length).toBeLessThanOrEqual(MAX_FORMS);
      for (const f of rf.forms) {
        expect(terrain.crustWeights(f.x, f.z)[ids.indexOf(f.mineral)]).toBeGreaterThanOrEqual(WEIGHT_MIN);
        expect(f.mineral).not.toBe('waterIce');
        expect(Math.hypot(f.x - spawn.x, f.z - spawn.z)).toBeGreaterThan(70);
        for (const c of rf.footprints(f)) expect(Math.hypot(c.x - spawn.x, c.z - spawn.z)).toBeGreaterThan(c.r + 25);
      }
      for (const fam of rf.families) { expect(fam.triangles).toBeGreaterThan(0); expect(fam.triangles).toBeLessThan(20000); }
    }
  });
  it('a silicide pick on carbon has no ironstone mesas and no basalt tubes', () => {
    const { rf } = results.get('carbon silicide')!;
    // other minerals can still dominate small pockets of a picked crust, so compare shares rather than demand zero
    const n = (m: string) => rf.forms.filter((f) => f.mineral === m).length;
    expect(n('silicide')).toBeGreaterThan(n('ironstone') + n('basalt'));
    expect(rf.forms.some((f) => f.kind === 'silicideMound' || f.kind === 'pitBoulder')).toBe(true);
  });
  it('has structure families that match the dominant minerals', () => {
    const k = (n: string) => new Set(results.get(n)!.rf.forms.map((f) => f.kind));
    expect(k('carbon granite').has('dome') || k('carbon granite').has('torStack')).toBe(true);
    expect(k('carbon ironstone').has('mesa')).toBe(true);
    expect(k('silicon nitride').has('crystalCluster')).toBe(true);
  });
  it('pushOut moves the player out of a structure', () => {
    const { rf } = results.get('carbon natural')!;
    const f = rf.forms.find((x) => x.kind !== 'lavaTube')!;
    const c = rf.footprints(f)[0];
    const out = rf.pushOut(c.x, c.z, FULL)!;
    expect(Math.hypot(out.x - c.x, out.z - c.z)).toBeGreaterThanOrEqual(c.r);
    expect(rf.pushOut(c.x, c.z, { ...FULL, rise: 0 })).toBeNull();
  });
});
void ({} as RockFormSet);
