import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { Derived, WorldUniforms, Dials, SpeciesId } from '../contracts';
import { SPECIES } from '../contracts';

const col = () => uniform(new THREE.Color());
const f = (v = 0) => uniform(v);

/** Created once. Modules read, core writes (applyDerived). */
export function createUniforms(): WorldUniforms {
  const niches = {} as Record<SpeciesId, any>;
  for (const s of SPECIES) niches[s] = f(0);
  return {
    time: f(0),
    skyTop: col(), skyHorizon: col(), haze: col(), fogColor: col(),
    ground: col(), shadowColor: col(), accent: col(),
    stoneColor: col(), glowColor: col(), poreGlowColor: col(),
    stainAmount: f(), pores: f(), erosion: f(), snow: f(),
    glow: f(), char: f(), heat: f(), light: f(), age: f(),
    wind: f(0.5),
    niches,
  };
}

const setHex = (u: any, hex: number) => u.value.setHex(hex, THREE.SRGBColorSpace);

export function applyDerived(u: WorldUniforms, d: Derived, dials: Dials) {
  const p = d.palette;
  setHex(u.skyTop, p.skyTop); setHex(u.skyHorizon, p.skyHorizon); setHex(u.haze, p.haze);
  setHex(u.fogColor, p.fog); setHex(u.ground, p.ground); setHex(u.shadowColor, p.shadow); setHex(u.accent, p.accent);
  setHex(u.stoneColor, d.stoneColor); setHex(u.glowColor, d.glowHue); setHex(u.poreGlowColor, d.poreGlowHue);
  u.stainAmount.value = d.stainAmount; u.pores.value = d.pores; u.erosion.value = d.erosion; u.snow.value = d.snow;
  u.glow.value = d.glow; u.char.value = d.char;
  u.heat.value = dials.heat; u.light.value = dials.light; u.age.value = dials.age;
  for (const s of SPECIES) u.niches[s].value = d.niches[s];
}
