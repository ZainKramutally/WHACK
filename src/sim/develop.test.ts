import { describe, expect, it } from 'vitest';
import { develop, LOCOMOTION, type DevelopConditions, type DevelopInputs } from './develop';
import { BODY_GENES, makeFounders, type AnimalGenome, type BodyGenes } from './genome';
import { makeRng } from './rng';

const base = makeFounders(1, 1, { c: 0.8, si: 0.05, o: 0.15 })[0]!;
const legged = (g: AnimalGenome): AnimalGenome => ({
  ...g, body: { ...g.body, limbPairs: 0.5, limbLen: 0.6, size: 0.4, eyes: 0.6, horns: 0.6, glow: 0.8 },
});
const carbon: AnimalGenome = legged(base);
const silicon: AnimalGenome = { ...legged(base), comp: { c: 0.05, si: 0.9, o: 0.05 } };
const day: DevelopConditions = { light: 1, heatBand: 0.5 };
// Fixtures equal to the old constants (now world config, life.inputs): water world with Earth-like air.
const water: DevelopInputs = {
  solvent: { rho: 1.0, mu: 0.89, epsilonR: 80, liquidBandC: [0, 100] },
  airDensity: 0.1,
  tissueDensity: { C: 1.05, Si: 2.2 },
};

describe('develop', () => {
  it('is referentially transparent', () => {
    expect(develop(carbon, day, water)).toEqual(develop(structuredClone(carbon), { ...day }, structuredClone(water)));
    expect(develop(silicon, day, water)).toEqual(develop(silicon, day, water));
  });

  it('silicon: radial faceted hub, rod arms with 15° joints, dot-eye clusters at the arm tips', () => {
    const p = develop(silicon, day, water);
    expect(p.chemistry).toBe('silicon');
    expect(p.architecture).toBe('radial');
    expect([3, 4, 5, 6, 8]).toContain(p.symmetry);
    expect(p.sides).toBe(p.symmetry);
    expect(p.segmentCount).toBe(0); // no spine
    expect(p.tiers).toBeGreaterThanOrEqual(1);
    expect(p.tierRadii).toHaveLength(p.tiers);
    expect(p.arms).toHaveLength(p.symmetry);
    for (const a of p.arms) expect(Number.isFinite(a.azimuthDeg)).toBe(true);
    expect(p.flatShaded).toBe(true);
    expect(p.limbKind).toBe('rod');
    expect(p.limbSegments).toBe(2);
    expect(p.limbJointAngles.length).toBeGreaterThan(0);
    for (const a of p.limbJointAngles) expect(Math.abs(a % 15)).toBe(0);
    expect(p.bodyJointMaxDeg % 15).toBe(0);
    expect(p.eyeCount % p.symmetry).toBe(0); // the same number of dots at every arm tip
    expect(p.eyeKind).toBe('dots');
    expect(p.curl).toBe(0);
  });

  it('carbon: axial head-to-tail chain of round curling segments, tentacle limbs, a pair of ring eyes', () => {
    const p = develop(carbon, day, water);
    expect(p.chemistry).toBe('carbon');
    expect(p.architecture).toBe('axial');
    expect(p.symmetry).toBe(2);
    expect(p.segmentCount).toBeGreaterThanOrEqual(3);
    expect(p.tiers).toBe(0);
    expect(p.arms).toEqual([]);
    expect(p.sides).toBe(12);
    expect(p.flatShaded).toBe(false);
    expect(p.curl).toBeGreaterThan(0);
    expect(['tentacle', 'leg']).toContain(p.limbKind); // never radial rods
    const soft = develop({ ...carbon, body: { ...carbon.body, limbLen: 0.2, plates: 0.05, diet: 0.05 } }, day, water);
    expect(soft.limbKind).toBe('tentacle');
    expect(soft.limbSegments).toBeGreaterThan(2);
    expect(p.jointSnapDeg).toBe(0);
    expect(soft.limbJointAngles.some((a) => a % 15 !== 0)).toBe(true);
    const stiff = develop({ ...carbon, body: { ...carbon.body, limbLen: 0.9, plates: 0.6, diet: 0.8 } }, day, water);
    expect(stiff.limbKind).toBe('leg');
    expect(stiff.limbSegments).toBe(2);
    expect(p.eyeCount % 2).toBe(0); // eyes come in pairs
    expect(p.eyeKind).toBe('rings');
  });

  it('glow is 0 at full light, rises as light falls, and ignores oxygen', () => {
    const at = (g: AnimalGenome, light: number) => develop(g, { ...day, light }, water).glow;
    expect(at(carbon, 1)).toBe(0);
    expect(at(carbon, 0.5)).toBeGreaterThan(0);
    expect(at(carbon, 0.1)).toBeGreaterThan(at(carbon, 0.5));
    expect(at(carbon, 0)).toBeCloseTo(carbon.body.glow);
    const oxy = { ...carbon, comp: { c: 0.3, si: 0.1, o: 0.6 } };
    const noOxy = { ...carbon, comp: { c: 0.9, si: 0.1, o: 0 } };
    expect(at(oxy, 0.3)).toBe(at(noOxy, 0.3));
    expect(at(silicon, 0.3)).toBe(at(carbon, 0.3));
  });

  it('eyes grow, and cost more, in the dark', () => {
    const bright = develop(carbon, { ...day, light: 1 }, water);
    const dark = develop(carbon, { ...day, light: 0.05 }, water);
    expect(dark.eyeArea).toBeGreaterThan(bright.eyeArea);
    expect(dark.eyeUpkeep).toBeGreaterThan(bright.eyeUpkeep);
  });

  it('cold makes bigger bodies (temperature–size rule), more so in the sea than on land', () => {
    const worm = base; // legless: not a walker
    const cold = develop(worm, { ...day, heatBand: 0 }, water).scale;
    const hot = develop(worm, { ...day, heatBand: 1 }, water).scale;
    expect(cold).toBeGreaterThan(hot);
    const w = (h: number) => develop(carbon, { ...day, heatBand: h }, water);
    expect(w(0).mode).toBe(LOCOMOTION.walk);
    expect(w(0).scale / w(1).scale).toBeLessThan(cold / hot);
  });

  it('a legless worm swims; a long-legged dense body walks', () => {
    expect(develop(base, day, water).mode).toBe(LOCOMOTION.swim);
    const stilts = { ...silicon, body: { ...silicon.body, limbPairs: 1, limbLen: 1, buoy: 0 } };
    expect(develop(stilts, day, water).mode).toBe(LOCOMOTION.walk);
  });

  it('gas-filled bodies hover in thick air but not thin air', () => {
    const bell: AnimalGenome = { ...base, body: { ...base.body, buoy: 0.7, limbPairs: 0, segments: 0, size: 0.5 } };
    const thin = develop(bell, day, { ...water, airDensity: 0.1 });
    const thick = develop(bell, day, { ...water, airDensity: 0.4 });
    expect(thin.modeCosts.hover).toBeGreaterThan(thick.modeCosts.hover);
    expect(thick.mode).toBe(LOCOMOTION.hover);
  });

  it('derives defence from plates and horns, mass from size, and diet gains', () => {
    const plain = develop(base, day, water);
    const armed = develop({ ...base, body: { ...base.body, plates: 0.8, horns: 0.8 } }, day, water);
    expect(armed.defence).toBeGreaterThan(plain.defence);
    expect(armed.mass).toBeGreaterThan(plain.mass);
    const big = develop({ ...base, body: { ...base.body, size: 0.9 } }, day, water);
    expect(big.mass).toBeGreaterThan(plain.mass);
    const hunter = develop({ ...base, body: { ...base.body, diet: 1 } }, day, water);
    expect(hunter.meatGain).toBe(1);
    expect(hunter.plantGain).toBe(0);
  });

  it('a limb bud smoothly lowers walking cost without being a leg', () => {
    const cost = (lp: number) => develop({ ...base, body: { ...base.body, limbPairs: lp } }, day, water).modeCosts.walk;
    expect(develop({ ...base, body: { ...base.body, limbPairs: 0.1 } }, day, water).legPairs).toBe(0);
    expect(cost(0.1)).toBeLessThan(cost(0));
  });

  it('limbPairs sets the symmetry order on silicon (arm count) and the leg pairs on carbon', () => {
    const at = (g: AnimalGenome, lp: number) => develop({ ...g, body: { ...g.body, limbPairs: lp } }, day, water);
    expect([0, 0.12, 0.23, 0.34, 0.5].map((lp) => at(silicon, lp).symmetry)).toEqual([3, 4, 5, 6, 8]);
    expect([0, 0.25, 0.5, 0.75, 1].map((lp) => at(carbon, lp).legPairs)).toEqual([0, 1, 2, 3, 4]);
    expect(at(carbon, 1).symmetry).toBe(2);
  });

  it('segments is spine length on carbon and facet tiers on silicon', () => {
    const at = (g: AnimalGenome, seg: number) => develop({ ...g, body: { ...g.body, segments: seg } }, day, water);
    expect(at(carbon, 1).segmentCount).toBeGreaterThan(at(carbon, 0).segmentCount);
    expect(at(carbon, 1).tiers).toBe(0);
    expect(at(silicon, 1).tiers).toBeGreaterThan(at(silicon, 0).tiers);
    expect(at(silicon, 1).segmentCount).toBe(0);
    expect(at(silicon, 1).tiers).toBeLessThanOrEqual(5);
  });

  it('the same genes build structurally different plans in each chemistry', () => {
    const g = legged(base);
    const c = develop({ ...g, comp: { c: 0.9, si: 0.05, o: 0.05 } }, day, water);
    const si = develop({ ...g, comp: { c: 0.05, si: 0.9, o: 0.05 } }, day, water);
    expect(c.architecture).toBe('axial');
    expect(si.architecture).toBe('radial');
    expect(c.arms.length).toBe(0);
    expect(si.arms.length).toBeGreaterThan(0);
    expect(c.symmetry).not.toBe(si.symmetry);
    expect(c.sides).not.toBe(si.sides);
    expect(c.limbKind).not.toBe(si.limbKind);
    expect(c.eyeKind).not.toBe(si.eyeKind);
  });

  describe('for any genome', () => {
    const rng = makeRng(7)('develop-property');
    const randomGenome = (comp: AnimalGenome['comp']): AnimalGenome => {
      const body = {} as BodyGenes;
      for (const gene of BODY_GENES) body[gene] = rng();
      return { ...base, body, comp };
    };
    const carbonComp = () => { const si = 0.5 * rng(); const o = (1 - si) * 0.3 * rng(); return { c: 1 - si - o, si, o }; };
    const siliconComp = () => { const si = 0.51 + 0.49 * rng(); const o = (1 - si) * 0.5 * rng(); return { c: 1 - si - o, si, o }; };
    const worlds: DevelopInputs[] = [water, { ...water, airDensity: 0.65, solvent: { rho: 0.81, mu: 0.16, epsilonR: 1.4, liquidBandC: [-210, -147] }, tissueDensity: { C: 1.05, Si: 2.2 } }];

    it('carbon plans are axial and silicon plans are radial, with the right structure', () => {
      for (let n = 0; n < 300; n++) {
        const inputs = worlds[n % 2]!;
        const cond = { light: rng(), heatBand: rng() };
        const c = develop(randomGenome(carbonComp()), cond, inputs);
        expect(c.architecture).toBe('axial');
        expect(c.symmetry).toBe(2);
        expect(c.arms).toHaveLength(0);
        expect(c.tiers).toBe(0);
        expect(c.segmentCount).toBeGreaterThanOrEqual(3);
        expect([2, 4, 6]).toContain(c.eyeCount === 0 ? 2 : c.eyeCount);
        const s = develop(randomGenome(siliconComp()), cond, inputs);
        expect(s.architecture).toBe('radial');
        expect([3, 4, 5, 6, 8]).toContain(s.symmetry);
        expect(s.arms).toHaveLength(s.symmetry);
        expect(s.tierRadii).toHaveLength(s.tiers);
        expect(s.tiers).toBeGreaterThanOrEqual(1);
        expect(s.tiers).toBeLessThanOrEqual(5);
        expect(s.segmentCount).toBe(0);
        expect(s.eyeCount % s.symmetry).toBe(0);
        expect(s.hornCount).toBeLessThanOrEqual(7);
      }
    });

    it('keeps the ecology-facing quantities finite and sane on both architectures', () => {
      for (let n = 0; n < 300; n++) {
        const inputs = worlds[n % 2]!;
        for (const comp of [carbonComp(), siliconComp()]) {
          const p = develop(randomGenome(comp), { light: rng(), heatBand: rng() }, inputs);
          for (const v of [p.scale, p.mass, p.bodyDensity, p.defence, p.glow, p.modeCosts.walk, p.modeCosts.swim, p.modeCosts.hover, p.modeCosts.sessile]) {
            expect(Number.isFinite(v)).toBe(true);
          }
          expect(p.scale).toBeGreaterThan(0);
          expect(p.mass).toBeGreaterThan(0);
          expect(p.bodyDensity).toBeGreaterThan(0);
          expect(p.defence).toBeGreaterThanOrEqual(0);
          expect(p.legPairs).toBeGreaterThanOrEqual(0);
          expect(p.legPairs).toBeLessThanOrEqual(4);
        }
      }
    });

    it('mass is never below the tissue mass, whatever the buoyancy (no massless gas bags)', () => {
      for (let n = 0; n < 300; n++) {
        const comp = n % 2 ? siliconComp() : carbonComp();
        const g = randomGenome(comp);
        const p = develop({ ...g, body: { ...g.body, buoy: 1 } }, { light: rng(), heatBand: rng() }, water);
        // fill 0.1 × 1000 kg/m³-scale × scale³ × tissue density (≥ carbon's), plus any extras
        expect(p.mass).toBeGreaterThanOrEqual(100 * p.scale ** 3 * water.tissueDensity.C * 0.999);
      }
    });
  });

  it('buoyancy adds gas-bag volume, not mass: whole-body density falls while mass stays', () => {
    const at = (buoy: number) => develop({ ...carbon, body: { ...carbon.body, buoy } }, { light: 1, heatBand: 0.5 }, { ...water, airDensity: 0 });
    const solid = at(0), bag = at(1);
    expect(bag.bodyDensity).toBeLessThan(0.1 * solid.bodyDensity);
    expect(bag.bodyDensity).toBeGreaterThan(0);
    expect(bag.mass).toBeGreaterThanOrEqual(solid.mass * 0.999);
  });

  describe('variety (No Man\'s Sky): the same 12 genes build many distinct forms, and mutation walks between them', () => {
    const rng = makeRng(11)('variety');
    const gen = (comp: AnimalGenome['comp']): AnimalGenome => {
      const body = {} as BodyGenes;
      for (const gene of BODY_GENES) body[gene] = rng();
      return { ...base, body, comp };
    };
    const carbonComp = { c: 0.85, si: 0.05, o: 0.1 }, siliconComp = { c: 0.05, si: 0.9, o: 0.05 };
    const form = (p: ReturnType<typeof develop>) =>
      p.architecture === 'radial'
        ? `R${p.symmetry}/${p.armKind}/${p.flare > 0.3 ? 'bowl' : p.flare < -0.3 ? 'cone' : 'stack'}/${p.hornCount > 3 ? 'crown' : p.hornCount > 0 ? 'spire' : 'bare'}/${p.tileLength > 0.4 ? 'geode' : 'tiles'}`
        : `A/${p.tailKind}/${p.limbKind}/${p.hornKind}/${p.finSpan > 0 ? 'fin' : p.wingSpan > 0 ? 'wing' : 'plain'}/${p.carapace > 0.5 ? 'carapace' : 'soft'}/${p.crest > 0.4 ? 'crest' : 'smooth'}`;

    it('random genomes cover dozens of distinct forms in each architecture', () => {
      const seen = { carbon: new Set<string>(), silicon: new Set<string>() };
      for (let n = 0; n < 400; n++) {
        seen.carbon.add(form(develop(gen(carbonComp), { light: 0.6, heatBand: 0.5 }, water)));
        seen.silicon.add(form(develop(gen(siliconComp), { light: 0.6, heatBand: 0.5 }, water)));
      }
      expect(seen.carbon.size).toBeGreaterThan(40);
      expect(seen.silicon.size).toBeGreaterThan(40);
    });

    it('evolved-style genomes (genes crowded in the low 0..0.6 band) still span many forms', () => {
      const seen = { carbon: new Set<string>(), silicon: new Set<string>() };
      const low = (comp: AnimalGenome['comp']): AnimalGenome => {
        const body = {} as BodyGenes;
        for (const gene of BODY_GENES) body[gene] = 0.6 * rng() * rng() ** 0.5;
        return { ...base, body, comp };
      };
      for (let n = 0; n < 400; n++) {
        seen.carbon.add(form(develop(low(carbonComp), { light: 0.6, heatBand: 0.5 }, water)));
        seen.silicon.add(form(develop(low(siliconComp), { light: 0.6, heatBand: 0.5 }, water)));
      }
      expect(seen.carbon.size).toBeGreaterThan(25);
      expect(seen.silicon.size).toBeGreaterThan(25);
    });

    it('mode follows form: fins only on swimmers, wings only on hoverers', () => {
      for (let n = 0; n < 400; n++) {
        const p = develop(gen(carbonComp), { light: 0.6, heatBand: rng() }, water);
        if (p.finSpan > 0) expect(p.mode).toBe(LOCOMOTION.swim);
        if (p.wingSpan > 0) expect(p.mode).toBe(LOCOMOTION.hover);
        expect(p.finSpan * p.wingSpan).toBe(0);
      }
    });

    it('derived traits stay in range and lineage colour is a pure function of the genes', () => {
      for (let n = 0; n < 300; n++) {
        const g = gen(n % 2 ? siliconComp : carbonComp);
        const p = develop(g, { light: rng(), heatBand: rng() }, water);
        for (const v of [p.hue, p.accent, p.spots, p.crest, p.carapace, p.jaw, p.tileLength]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
        expect(p.bands).toBeGreaterThanOrEqual(0); expect(p.bands).toBeLessThanOrEqual(3);
        expect(Math.abs(p.flare)).toBeLessThanOrEqual(1);
        expect(p.hue).toBe(develop(structuredClone(g), { light: 0.2, heatBand: 0.9 }, water).hue); // conditions never recolour a lineage
      }
    });

    it('a small mutation usually keeps the form (smooth walk), and large ones usually change it', () => {
      let kept = 0, keptBig = 0;
      const total = 300;
      for (let n = 0; n < total; n++) {
        const g = gen(carbonComp);
        const nudge = (sigma: number): AnimalGenome => {
          const body = { ...g.body };
          for (const gene of BODY_GENES) body[gene] = Math.min(1, Math.max(0, body[gene] + sigma * (rng() - 0.5) * 2));
          return { ...g, body };
        };
        const f0 = form(develop(g, { light: 0.6, heatBand: 0.5 }, water));
        if (form(develop(nudge(0.03), { light: 0.6, heatBand: 0.5 }, water)) === f0) kept++;
        if (form(develop(nudge(0.5), { light: 0.6, heatBand: 0.5 }, water)) === f0) keptBig++;
      }
      expect(kept / total).toBeGreaterThan(0.6);
      expect(keptBig / total).toBeLessThan(0.3);
    });
  });
});
