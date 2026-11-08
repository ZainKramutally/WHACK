import { describe, expect, it } from 'vitest';
import { environmentFrom, NAMED, parseSoup, n2VapourBar, type Soup } from './derive';
import { PALETTE_KEYS, RED_WORLD, dE, hexToLab, labToHex } from './palette';
import { seaLevelFor } from './sealevel';

const scalars = (e: ReturnType<typeof environmentFrom>) => [
  e.fog.density, e.fog.hazeAmount, e.fog.startScale, ...e.sky.moonStrength, e.light.intensity, e.glow.strength,
  e.ground.sheen, e.ground.banding, e.ground.crust, e.ground.ice, e.ground.prismatic, e.flora.tintAmount, e.flora.heightScale,
];
/** Largest per-key palette step (OKLab) and scalar step between two soups. */
function step(a: Soup, b: Soup) {
  const ea = environmentFrom(a), eb = environmentFrom(b);
  const pal = Math.max(...PALETTE_KEYS.map((k) => dE(ea.palette[k], eb.palette[k])));
  const sa = scalars(ea), sb = scalars(eb);
  return { pal, sc: Math.max(...sa.map((v, i) => Math.abs(v - sb[i]))) };
}

describe('environmentFrom', () => {
  it('is deterministic', () => {
    for (const { soup } of Object.values(NAMED)) expect(environmentFrom({ ...soup })).toEqual(environmentFrom({ ...soup }));
  });

  it('returns every palette role as a valid sRGB hex', () => {
    for (const { soup } of Object.values(NAMED)) {
      const p = environmentFrom(soup).palette;
      expect(Object.keys(p).sort()).toEqual([...PALETTE_KEYS].sort());
      for (const k of PALETTE_KEYS) expect(Number.isInteger(p[k]) && p[k] >= 0 && p[k] <= 0xffffff).toBe(true);
    }
  });

  it('reproduces the adopted Red World at the Rust World soup', () => {
    const p = environmentFrom(NAMED.rust.soup).palette;
    for (const k of PALETTE_KEYS) expect(dE(p[k], RED_WORLD[k])).toBeLessThan(0.01);
  });

  it('changes continuously along every slider (no jumps away from phase changes)', () => {
    const sweeps: [Soup, keyof Soup, number, number][] = [
      [NAMED.rust.soup, 'oxygenPct', 0, 40], [NAMED.rust.soup, 'temperatureC', 1, 122], [NAMED.rust.soup, 'nitrogenX', 0.05, 1000],
      [NAMED.cryo.soup, 'temperatureC', -209, -147], [NAMED.cryo.soup, 'oxygenPct', 0, 5], [NAMED.archean.soup, 'seaCover', 0, 1],
      [NAMED.cryo.soup, 'light', 0.005, 1],
    ];
    for (const [base, key, lo, hi] of sweeps) {
      const N = 400;
      const log = key === 'nitrogenX' || key === 'light';
      const at = (i: number) => (log ? lo * (hi / lo) ** (i / N) : lo + ((hi - lo) * i) / N);
      for (let i = 0; i < N; i++) {
        const s = step({ ...base, [key]: at(i) }, { ...base, [key]: at(i + 1) });
        expect(s.pal, `${String(key)} @ ${at(i)}`).toBeLessThan(0.03);
        expect(s.sc, `${String(key)} @ ${at(i)}`).toBeLessThan(0.08);
      }
    }
  });

  it('only jumps at a phase change, and the frozen flag moves the sea to ice', () => {
    const w = environmentFrom({ ...NAMED.snowball.soup, frozen: false }), f = environmentFrom(NAMED.snowball.soup);
    expect(w.sea.frozen).toBe(false); expect(f.sea.frozen).toBe(true);
  });

  it('follows the chemistry it claims', () => {
    const rust = environmentFrom(NAMED.rust.soup), arch = environmentFrom(NAMED.archean.soup), cryo = environmentFrom(NAMED.cryo.soup);
    const hue = (hex: number) => { const [, a, b] = hexToLab(hex); return Math.atan2(b, a); };
    expect(Math.abs(hue(rust.palette.red))).toBeLessThan(0.8);                 // ferric red
    expect(hue(arch.palette.red)).toBeGreaterThan(1.5);                         // ferrous green
    expect(cryo.glow.strength).toBeGreaterThan(rust.glow.strength * 1.8);       // glow from darkness
    expect(cryo.ground.relicIce).toBe(1); expect(rust.ground.relicIce).toBe(0);
    expect(environmentFrom(NAMED.deepair.soup).sky.moons).toBe(0);              // thick air hides the moons
    expect(n2VapourBar(-183)).toBeGreaterThan(3.3); expect(n2VapourBar(-183)).toBeLessThan(3.9);
  });

  it('parses ?soup and derives frozen from the solvent', () => {
    expect(parseSoup('s,-215,40,0')).toMatchObject({ element: 'silicon', temperatureC: -215, frozen: true, light: 0.01 });
    expect(parseSoup('c,-5,1,21')).toMatchObject({ element: 'carbon', frozen: true, light: 1 });
    expect(parseSoup('c,15,1,21').frozen).toBe(false);
  });

  it('OKLab round-trips hexes', () => {
    for (const h of [0, 0xffffff, 0xe8331f, 0x3ff5e0, 0x5c48a8]) expect(labToHex(hexToLab(h))).toBe(h);
  });
});

describe('seaLevelFor', () => {
  it('is -Infinity without sea, then rises monotonically and continuously with cover', () => {
    expect(seaLevelFor(0)).toBe(-Infinity);
    let prev = seaLevelFor(0.001);
    for (let c = 0.002; c <= 1; c += 0.001) {
      const l = seaLevelFor(c);
      expect(l).toBeGreaterThanOrEqual(prev);
      expect(l - prev).toBeLessThan(0.5);
      prev = l;
    }
  });
});
