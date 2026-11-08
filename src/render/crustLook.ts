// Crust look (docs/features/crust.md "The look"): ground colour per mineral, the rust ratchet, and the carbon flora
// pigment blend (purple → green). Pure; the art layer feeds it the oxygen stat and reads colours back. Decoration only.
import type { FloraPalette } from './floraLib';
import { mixHex } from './palette';

/** [fresh, rusted] ground colour per mineral id; minerals that don't oxidise have the same colour twice. */
export const MINERAL_COLOURS: Record<string, readonly [number, number]> = {
  basalt: [0x2a3330, 0x6a2c22],     // charcoal, green-black → oxidised brown-red
  ironstone: [0x8c2a1c, 0xb8402a],  // red jasper (the black hematite bands are BAND_DARK below)
  granite: [0xc8b4b0, 0xc8b4b0],    // pale pink-grey
  silicide: [0x3a3e4c, 0x9a9488],   // dark metallic → pale silica
  nitride: [0xf0e6cc, 0xf0e6cc],    // pale cream
  waterIce: [0xdcecf8, 0xdcecf8],   // white-blue
};
/** Ironstone's black hematite band colour (mixed in by height). */
export const BAND_DARK = 0x2a1418;
const FALLBACK = 0x6a6a6a;

/** Ground colour of a mineral at a rust level 0..1 (non-oxidising minerals ignore it). */
export function mineralColour(id: string, rustLevel: number): number {
  const c = MINERAL_COLOURS[id];
  if (!c) return FALLBACK;
  return mixHex(c[0], c[1], Math.min(1, Math.max(0, rustLevel)));
}

/** Highest oxygen seen this run, as a rust level. Rock doesn't un-rust; a new world resets it. */
export class RustRatchet {
  private worldId = '';
  private maxO2 = 0;
  private lastProgress = 0;
  /** Feed the oxygen stat (%); returns rust(max seen). */
  /** `buildProgress` (optional): a drop in it means a new run of the same world started, so the ratchet resets. */
  update(world: { id: string; rustOxygen?: number }, oxygenPct: number, buildProgress?: number): number {
    const newRun = buildProgress !== undefined && buildProgress < this.lastProgress - 0.5;
    if (buildProgress !== undefined) this.lastProgress = buildProgress;
    if (newRun || world.id !== this.worldId) { this.worldId = world.id; this.maxO2 = 0; }
    if (Number.isFinite(oxygenPct) && oxygenPct > this.maxO2) this.maxO2 = oxygenPct;
    return world.rustOxygen ? Math.min(1, Math.max(0, this.maxO2 / world.rustOxygen)) : 0;   // same form as gen/crust rust()
  }
  reset() { this.worldId = ''; this.maxO2 = 0; this.lastProgress = 0; }
}
/** The run's shared ratchet (flora and ground both read it). */
export const crustRatchet = new RustRatchet();

// Carbon flora pigment: early life on retinal purple, then chlorophyll green once oxygenic photosynthesis takes over.
const PURPLE = { maroon: 0x3a1450, crimson: 0x6a2a96, blush: 0xb48ad8 } as const;
const GREEN = { maroon: 0x123a20, crimson: 0x2e8a3c, blush: 0xa8dc88 } as const;
const STEPS = 8;
const cache = new Map<string, FloraPalette>();

/** Carbon flora palette at ratchet `r` (0 purple … 1 green); other palettes pass through unchanged. Cached per step. */
export function floraPigment(base: FloraPalette, silicon: boolean, r: number): FloraPalette {
  if (silicon) return base;
  const step = Math.round(Math.min(1, Math.max(0, r)) * STEPS);
  const key = `${base.ink}-${step}`;
  let p = cache.get(key);
  if (!p) {
    const t = step / STEPS;
    p = { ...base,
      maroon: mixHex(PURPLE.maroon, GREEN.maroon, t),
      crimson: mixHex(PURPLE.crimson, GREEN.crimson, t),
      blush: mixHex(PURPLE.blush, GREEN.blush, t) };
    cache.set(key, p);
  }
  return p;
}
