import { describe, expect, it } from 'vitest';
import { createTerrain, type TerrainState } from './terrain';
import { pillarCandidates, pillarTops } from './pillars';
import { hexPrismGeometry } from '../render/basaltPillars';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { withCrustChoice } from './crust';

const full: TerrainState = { rise: 1, heatSolvent: 0.5, progress: { M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 } };
const worlds = [['carbon', carbon], ['carbon (basalt chip)', withCrustChoice(carbon, 'basalt')], ['silicon', silicon], ['silicon (basalt chip)', withCrustChoice(silicon, 'basalt')]] as const;

describe('basalt pillars', () => {
  it('the hex floor pattern and the inland pavement are gone from config', () => {
    for (const w of [carbon, silicon]) {
      const p = w.terrain.machines.find((m) => m.id === 'M7')!.params;
      for (const k of ['inlandStepH', 'jointDark', 'jointWidth', 'groove', 'edge']) expect(p, k).not.toHaveProperty(k);
      expect(p.size).toBeGreaterThanOrEqual(1.5);
      expect(p.size).toBeLessThanOrEqual(3);
    }
  });

  it.each(worlds)('%s: layout is deterministic, only on M7 minerals, within budget', (name, w) => {
    const t = createTerrain(w.terrain, w.demoSeed);
    const a = pillarCandidates(t), b = pillarCandidates(createTerrain(w.terrain, w.demoSeed));
    expect(Array.from(b.ix)).toEqual(Array.from(a.ix));
    expect(Array.from(b.cz)).toEqual(Array.from(a.cz));
    const ids = w.terrain.crust.minerals.map((m) => m.id);
    const allowed = w.terrain.machines.find((m) => m.id === 'M7')!.minerals!;
    for (let i = 0; i < a.count; i++) expect(allowed, `${name} #${i}`).toContain(ids[a.mineral[i]]);
    let present = 0;
    for (let i = 0; i < a.count; i++) if (pillarTops(t, a, i, full).present) present++;
    console.log(`pillars ${name}: ${a.count} candidates, ${present} present at final state, ${present * 18} triangles`);
    expect(a.count).toBeLessThan(10000);
  });

  it.each(worlds)('%s: prism tops equal the CPU height over the whole cell', (_n, w) => {
    const t = createTerrain(w.terrain, w.demoSeed);
    const s = pillarCandidates(t);
    let checked = 0;
    for (let i = 0; i < s.count && checked < 40; i++) {
      const p = pillarTops(t, s, i, full);
      if (!p.present) continue;
      checked++;
      const gate = w.terrain.machines.find((m) => m.id === 'M7')!.minerals!.map((m) => w.terrain.crust.minerals.findIndex((c) => c.id === m));
      for (const [dx, dz] of [[0, 0], [0.2, 0.1], [-0.15, 0.25], [0.3, -0.1]]) {
        if (t.crustWeights(s.cx[i] + dx * s.size, s.cz[i] + dz * s.size).reduce((a, v, j) => a + (gate.includes(j) ? v : 0), 0) <= 0.5) continue;   // a cell edge on other rock is smooth ground
        expect(t.height(s.cx[i] + dx * s.size, s.cz[i] + dz * s.size, full)).toBeCloseTo(p.top, 6);
      }
      expect(p.top).toBeGreaterThan(p.base);
    }
    if (w.id === 'carbon') expect(checked).toBeGreaterThan(0);
  });

  it('no pillars before M7 progress', () => {
    const t = createTerrain(carbon.terrain, carbon.demoSeed);
    const s = pillarCandidates(t);
    for (let i = 0; i < s.count; i++) expect(pillarTops(t, s, i, { ...full, progress: { ...full.progress, M7: 0 } }).present).toBe(false);
  });

  it('prism geometry: 18 triangles, hexagonal, faces point outward', () => {
    const g = hexPrismGeometry(3);
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
    expect(pos.count).toBe(54);
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const out = nor.getX(i) * cx + nor.getZ(i) * cz + nor.getY(i) * (cy - 0.5);   // normal · (face centre − prism centre)
      expect(out).toBeGreaterThan(0);
    }
  });
});
