import { describe, expect, it } from 'vitest';
import { rust } from '../gen/crust';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { LOOK_PALETTES } from './palette';
import { MINERAL_COLOURS, MINERAL_HARD, RED_WORLD_GROUND_IDS, hardRustStep, redWorldRamp, RustRatchet, floraPigment, mineralColour, worldHard } from './crustLook';
import { GLOW_BAND, HARD_GAP, creatureColour, creatureHard } from './palette';

const cw = { id: 'carbon', rustOxygen: carbon.terrain.crust!.rustOxygen };
const sw = { id: 'silicon', rustOxygen: silicon.terrain.crust!.rustOxygen };

describe('RustRatchet', () => {
  it('never decreases', () => {
    const r = new RustRatchet();
    const seq = [0, 0.5, 1.5, 0.2, 0, 3].map((k) => r.update(cw, k * cw.rustOxygen));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    expect(seq[seq.length - 1]).toBe(1);
    expect(new RustRatchet().update(cw, 1)).toBe(rust(carbon, 1));
  });
  it('is 0 at oxygen 0 throughout', () => {
    const r = new RustRatchet();
    for (let i = 0; i < 5; i++) expect(r.update(sw, 0)).toBe(0);
  });
  it('resets when a new run of the same world starts (build progress drops)', () => {
    const r = new RustRatchet();
    expect(r.update(cw, 21, 1)).toBe(1);
    expect(r.update(cw, 21, 1)).toBe(1);
    expect(r.update(cw, 0, 0.02)).toBe(0);
  });
  it('resets on a world change', () => {
    const r = new RustRatchet();
    expect(r.update(cw, 21)).toBe(1);
    expect(r.update(sw, 0)).toBe(0);
    expect(r.update(cw, 0)).toBe(0);
  });
});

describe('floraPigment', () => {
  const base = LOOK_PALETTES.carbon;
  it('is purple at 0 and green at 1', () => {
    const p0 = floraPigment(base, false, 0).crimson, p1 = floraPigment(base, false, 1).crimson;
    expect((p0 >> 16) & 255).toBeGreaterThan((p0 >> 8) & 255);   // red/blue dominate green
    expect(p0 & 255).toBeGreaterThan((p0 >> 8) & 255);
    expect((p1 >> 8) & 255).toBeGreaterThan((p1 >> 16) & 255);   // green dominates
    expect((p1 >> 8) & 255).toBeGreaterThan(p1 & 255);
  });
  it('leaves silicon unchanged', () => {
    const s = LOOK_PALETTES.silicon;
    expect(floraPigment(s, true, 0)).toBe(s);
    expect(floraPigment(s, true, 1)).toBe(s);
  });
});

describe('reducedLava family', () => {
  it('has a fresh and a rusted look, colour and non-purple air', () => {
    expect(MINERAL_LOOK.reducedLava).toHaveLength(2);
    expect(MINERAL_COLOURS.reducedLava).toBeDefined();
    const fresh = mineralFamily('reducedLava', true, 0), rusted = mineralFamily('reducedLava', true, 1);
    expect(fresh.red).not.toBe(rusted.red);
    const lum = (h: number) => 0.2126 * ((h >> 16) & 255) + 0.7152 * ((h >> 8) & 255) + 0.0722 * (h & 255);
    expect(lum(rusted.red)).toBeGreaterThan(lum(fresh.red) + 10);   // pale enstatite → near-white silica
    // pale on purpose: the shore ground must hold the dark creatures (ring L ≤ 0.5)
    for (const c of [MINERAL_COLOURS.reducedLava[0], MINERAL_COLOURS.reducedLava[1], fresh.red, rusted.red]) expect(hexToLab(c)[0]).toBeGreaterThanOrEqual(0.7);
    for (const f of [fresh, rusted]) for (const k of ['haze', 'horizon', 'shadow', 'floraCrimson'] as const) {
      const [, a, b] = hexToLab(f[k]), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
      expect(Math.hypot(a, b) < 0.03 || h < 280 || h > 330, k).toBe(true);
    }
  });
});

describe('mineralColour', () => {
  it('covers every mineral of both worlds and rusts only oxidising ones', () => {
    for (const w of [carbon, silicon]) for (const m of w.terrain.crust!.minerals) {
      expect(MINERAL_COLOURS[m.id], m.id).toBeDefined();
      if (!m.oxidises) expect(mineralColour(m.id, 1)).toBe(mineralColour(m.id, 0));
    }
    expect(mineralColour('basalt', 1)).not.toBe(mineralColour('basalt', 0));
  });
});

// ---- mineral look families ----------------------------------------------------------------------------------------
import { LOCAL_TAU_SEC, LocalCrust, blendFamilies, crustFloraTint, crustRock, mineralFamily, MINERAL_LOOK, type CrustMix } from './crustLook';
import { hexToLab, lookPalette, skyStyle } from './palette';

const mixOf = (w: typeof carbon): CrustMix => {
  const ms = w.terrain.crust!.minerals;
  return { ids: ms.map((m) => m.id), oxidises: ms.map((m) => m.oxidises), shares: ms.map((m) => (m.share[0] + m.share[1]) / 2), elevation: ms.map((m) => m.elevation) };
};
const hueOf = (hex: number) => { const [, a, b] = hexToLab(hex); return { C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }; };
const isRed = (hex: number) => { const { C, h } = hueOf(hex); return C > 0.1 && (h < 50 || h > 350); };
const inputsFor = (w: typeof carbon, oxygen: number, over: Partial<{ weights: number[] }> = {}) => {
  const mix = mixOf(w);
  return {
    world: { id: w.id, rustOxygen: w.terrain.crust!.rustOxygen, composition: w.life.composition, starType: 'G-type', crust: mix } as never,
    stats: { oxygen, pressure: 1, temperature: 15 }, buildProgress: 1, light: 1,
    terrain: { crustWeights: over.weights ? () => over.weights! : undefined } as never,
  };
};

describe('mineral look families', () => {
  it('every mineral of both worlds has a family; oxidising ones have a rusted variant', () => {
    for (const w of [carbon, silicon]) for (const m of w.terrain.crust!.minerals) {
      expect(MINERAL_LOOK[m.id], m.id).toBeDefined();
      if (m.oxidises) expect(MINERAL_LOOK[m.id].length, m.id).toBe(2);
    }
  });
  it('blend weights sum to 1, whatever the input', () => {
    const r = blendFamilies(mixOf(carbon), [3, 1, 0], 0);
    expect(r.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(r.seaWeights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(blendFamilies(mixOf(carbon), [0, 0, 0], 0).weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it('carbon at rust 0 is not red; a fully rusted ironstone-dominant mix is', () => {
    const fresh = crustRock(inputsFor(carbon, 0), 0, 0, 1)!;
    expect(isRed(fresh.red)).toBe(false);
    expect(isRed(fresh.redLight)).toBe(false);
    const iron = { ...mixOf(carbon), shares: mixOf(carbon).ids.map((id) => (id === 'ironstone' ? 1 : 0)) };
    expect(isRed(blendFamilies(iron, iron.shares, 1).family.red)).toBe(true);
    expect(isRed(mineralFamily('basalt', true, 1).red)).toBe(false);   // rusted basalt is a mild brown, not the Red World
  });
  it('local haze eases monotonically towards the target and never overshoots', () => {
    const l = new LocalCrust();
    l.step([1, 0, 0], 0.05);
    let prev = 1;
    for (let i = 0; i < 80; i++) { const d = Math.abs(l.step([0, 0, 1], 0.05)[0] - 0); expect(d).toBeLessThanOrEqual(prev + 1e-12); prev = d; }
    expect(prev).toBeLessThan(0.07);   // ≈ 4 s in, ~2 s to 95%: tau
    expect(LOCAL_TAU_SEC).toBeGreaterThan(0.3);
  });
  it('local haze leans towards the rock under the camera', () => {
    const ids = mixOf(carbon).ids;
    const at = (id: string) => crustRock(inputsFor(carbon, 0, { weights: ids.map((i) => (i === id ? 1 : 0)) }), 0, 0, 10)!.haze;
    expect(at('basalt')).not.toBe(at('granite'));
    expect(hexToLab(at('basalt'))[2]).toBeLessThan(hexToLab(at('ironstone'))[2]);   // cooler (bluer) than the ochre air
  });
  it('silicon flora and air stay cold; carbon flora tint is green', () => {
    const si = inputsFor(silicon, 0);
    const tint = crustFloraTint(si as never)!;
    expect(tint.crimson & 255).toBeGreaterThan((tint.crimson >> 16) & 255);   // blue ≥ red
    const rock = crustRock(si as never, 0, 0, 1)!;
    expect(rock.skyHorizon & 255).toBeGreaterThanOrEqual((rock.skyHorizon >> 16) & 255);
    expect(rock.haze & 255).toBeGreaterThanOrEqual((rock.haze >> 16) & 255);
    const g = crustFloraTint(inputsFor(carbon, 21) as never)!;
    expect((g.crimson >> 8) & 255).toBeGreaterThan((g.crimson >> 16) & 255);
  });
  it('star modulation still applies on top of the crust look', () => {
    const i = inputsFor(carbon, 0) as never as Parameters<typeof lookPalette>[0] & Parameters<typeof crustRock>[0];
    const rock = crustRock(i, 0, 0, 1)!;
    const bright = lookPalette({ ...i, light: 1 }, rock), dim = lookPalette({ ...i, light: 0.015 }, rock);
    expect(bright.crust).toBe(true);
    expect(bright.base.red).toBe(rock.red);
    expect(dim.red).not.toBe(bright.red);
    expect(skyStyle('G-type', 1, 1, 15, { haze: rock.haze, horizon: rock.skyHorizon }).horizon).not.toBe(skyStyle('G-type', 1, 1, 15).horizon);
  });
});

// ---- iron = the Red World; basalt stays green (owner request 2026-11-08) ----------------------------------------------------
import { withCrustChoice } from '../gen/crust';
import { crustSeaStain } from './crustLook';
const redHue = (hex: number) => { const { h } = hueOf(hex); return h >= 330 || h <= 40; };
const ironW = withCrustChoice(carbon, 'ironstone'), basaltW = withCrustChoice(carbon, 'basalt');
describe('iron-rich and volcanic worlds', () => {
  it('rusted ironstone world: rock, shadow, haze and flora are all red-hued', () => {
    const i = inputsFor(ironW, 40);
    const rock = crustRock(i, 0, 0, 1)!;
    for (const c of [rock.red, rock.shadow, rock.haze, rock.skyHorizon, crustFloraTint(i as never)!.crimson]) expect(redHue(c), c.toString(16)).toBe(true);
    expect(LOOK_PALETTES.carbon.red).toBe(MINERAL_LOOK.ironstone[1]!.red);
  });
  it('Iron-rich at rust 1 is the Red World: rock red near e8331f, shadow near 5a1040', () => {
    const rock = crustRock(inputsFor(ironW, 40), 0, 0, 1)!;
    const d = (a: number, b: number) => { const x = hexToLab(a), y = hexToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    expect(d(rock.red, 0xe8331f)).toBeLessThan(0.08);
    expect(d(rock.shadow, 0x5a1040)).toBeLessThan(0.08);
  });
  it('ironstone flora stays red through the pigment ratchet, never green', () => {
    const t = crustFloraTint(inputsFor(ironW, 40) as never)!;
    const c = floraPigment(LOOK_PALETTES.carbon, false, 1, t).crimson;
    expect((c >> 16) & 255).toBeGreaterThan((c >> 8) & 255);
  });
  it('rusted basalt world: flora crimson is green, rock is not a saturated red, air is cool', () => {
    const i = inputsFor(basaltW, 40);
    const g = crustFloraTint(i as never)!.crimson;
    const h = hueOf(g).h;
    expect(h).toBeGreaterThan(100); expect(h).toBeLessThan(200);
    const rock = crustRock(i, 0, 0, 1)!;
    expect(isRed(rock.red)).toBe(false);
    expect(hexToLab(rock.haze)[2]).toBeLessThan(0.01);
  });
  it('iron stains the shallows; basalt does not', () => {
    expect(crustSeaStain(inputsFor(ironW, 0) as never)).toBeGreaterThan(crustSeaStain(inputsFor(basaltW, 0) as never));
    expect(redHue(MINERAL_LOOK.ironstone[1]!.sea)).toBe(true);
  });
});

describe('ironstone Red World ground', () => {
  it('rusted ironstone is the mockup red; the ramp at rust 1 is the carbon palette', () => {
    expect(mineralColour('ironstone', 1)).toBe(0xe8331f);
    expect(RED_WORLD_GROUND_IDS).toContain('ironstone');
    const r = redWorldRamp(1);
    expect([r.redLight, r.red, r.crimson, r.maroon]).toEqual([0xff5a36, 0xe8331f, 0xa8122a, 0x5c0a1e]);
  });
  it('fresh jasper is darker and less saturated than rusted', () => {
    const f = redWorldRamp(0).red, r = redWorldRamp(1).red;
    const lum = (h: number) => 0.3 * (h >> 16) + 0.5 * ((h >> 8) & 255) + 0.2 * (h & 255);
    expect(lum(f)).toBeLessThan(lum(r));
    expect(f >> 16).toBeLessThan(r >> 16);
  });
});

describe('hard parts wear the world\'s minerals (fauna-colour §2.2, §6)', () => {
  const mix = (w: typeof carbon) => {
    const ms = w.terrain.crust!.minerals;
    return { ids: ms.map((m) => m.id), oxidises: ms.map((m) => m.oxidises), shares: ms.map((m) => (m.share[0] + m.share[1]) / 2), elevation: ms.map((m) => m.elevation) };
  };
  const only = (w: typeof carbon, id: string) => { const c = mix(w); return { ...c, shares: c.ids.map((x) => (x === id ? 1 : 0)) }; };
  const L = (hex: number) => hexToLab(hex)[0];

  it('rock chips change the armour, not the skins; Iron-rich armour is far darker than Continental before oxygen', () => {
    const iron = worldHard(only(carbon, 'ironstone'), 0)!, granite = worldHard(only(carbon, 'granite'), 0)!;
    expect(L(granite) - L(iron)).toBeGreaterThanOrEqual(0.4);
    const skin = creatureColour(false, 0.3, 0, 0.4, 0.5);
    expect(creatureHard(false, 0.3, 0.4, 0.5, iron)).not.toBe(creatureHard(false, 0.3, 0.4, 0.5, granite));
    expect(creatureColour(false, 0.3, 0, 0.4, 0.5)).toBe(skin); // skins never read the crust
    expect(creatureColour(false, 0.3, 2, 0.4, 0.5, iron)).toBe(iron); // the hard tone is the stamped armour
  });

  it('iron armour oxidises black → ochre in three steps; ice builds no armour; it is deterministic', () => {
    expect(hardRustStep(0.2)).toBe(0); expect(hardRustStep(0.3)).toBe(0.5); expect(hardRustStep(0.9)).toBe(1);
    expect(L(worldHard(only(carbon, 'ironstone'), 1)!)).toBeGreaterThan(L(worldHard(only(carbon, 'ironstone'), 0)!) + 0.2);
    expect(worldHard(only(carbon, 'granite'), 1)).toBe(worldHard(only(carbon, 'granite'), 0)); // granite does not oxidise
    const ice = { ids: ['waterIce'], oxidises: [false], shares: [1], elevation: [0] };
    expect(worldHard(ice, 0)).toBeUndefined();
    expect(worldHard(mix(carbon), 0.5)).toBe(worldHard(mix(carbon), 0.5));
    expect(MINERAL_HARD.waterIce).toBeUndefined();
  });

  it('armour reads against its body and stays out of the glow band (every hue, diet, accent, mineral, rust step)', () => {
    const hues = Array.from({ length: 9 }, (_, i) => i / 8);
    const arc = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
    for (const [w, si] of [[carbon, false], [silicon, true]] as const) {
      const glowLab = hexToLab(si ? 0x6ff4ff : 0x3ff5e0), glowH = (Math.atan2(glowLab[2], glowLab[1]) * 180 / Math.PI + 360) % 360;
      const tints = [0, 0.5, 1].flatMap((r) => [worldHard(mix(w), r), ...mix(w).ids.map((id) => worldHard(only(w, id), r))]).filter((x): x is number => x !== undefined);
      for (const t of tints) for (const h of hues) for (const diet of [0.05, 0.5, 0.95]) for (const a of [0.15, 0.5, 0.85]) {
        const hard = creatureHard(si, diet, h, a, t), body = hexToLab(creatureColour(si, diet, 0, h, a)), lab = hexToLab(hard);
        expect(Math.abs(lab[0] - body[0]), 'lightness gap').toBeGreaterThanOrEqual(HARD_GAP - 0.01);
        const C = Math.hypot(lab[1], lab[2]), hh = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
        expect(C < 0.06 || arc(hh, glowH) > 15, `hard ${hard.toString(16)} at ${hh.toFixed(0)}°`).toBe(true);
      }
    }
    void GLOW_BAND;
  });
});
