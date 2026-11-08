import { describe, expect, it } from 'vitest';
import { rust } from '../gen/crust';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { LOOK_PALETTES } from './palette';
import { MINERAL_COLOURS, RustRatchet, floraPigment, mineralColour } from './crustLook';

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

describe('mineralColour', () => {
  it('covers every mineral of both worlds and rusts only oxidising ones', () => {
    for (const w of [carbon, silicon]) for (const m of w.terrain.crust!.minerals) {
      expect(MINERAL_COLOURS[m.id], m.id).toBeDefined();
      if (!m.oxidises) expect(mineralColour(m.id, 1)).toBe(mineralColour(m.id, 0));
    }
    expect(mineralColour('basalt', 1)).not.toBe(mineralColour('basalt', 0));
  });
});
