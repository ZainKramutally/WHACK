// Live pixel-mode state: the active palette (≤32 colours) and field/sky ramps as TSL uniforms, rebuilt on change.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { SeaWeights } from '../contracts';
import { PALETTE_SIZE, stainFalloff, buildPalette, dominantSea, fieldRamp, hexToLin, paletteBias, paletteKind, skyBands, toOklab, useDimWater } from './palette';

export function createPixelState() {
  const mk = (n: number) => Array.from({ length: n }, () => uniform(new THREE.Color()));
  const palette = mk(PALETTE_SIZE);
  /** Oklab of each palette colour (x=L, y=a, z=b, w=static distance bias). */
  const paletteLab = Array.from({ length: PALETTE_SIZE }, () => uniform(new THREE.Vector4()));
  /** 0 neutral · 1 carbon · 2 stain (context-dependent biases applied in the shader). */
  const paletteKind_ = Array.from({ length: PALETTE_SIZE }, () => uniform(0));
  const field = mk(6);
  const sky = mk(4); // sky bands top → horizon; sky[3] is also the depth-haze colour
  const stainK = uniform(1); // 1 = prefer bone over stain on high stone; 0 for fully stained worlds (eco-01)
  const hazeK = uniform(1); // scales the stepped depth haze by the world's own fog density
  const pixAngle = uniform(0.004); // radians per internal pixel (vertical)
  let sea: SeaWeights = { water: 1, ammonia: 0, methane: 0, acid: 0 };
  let light = 1;
  let skyHex: [number, number] = [0x335577, 0xaabbcc];
  let key = '';
  const set = (u: any, hex: number) => u.value.setHex(hex, THREE.SRGBColorSpace);
  const recut = () => {
    const bands = skyBands(skyHex[0], skyHex[1], sea, light);
    const k = `${dominantSea(sea)}|${useDimWater(sea, light)}|${bands.join(',')}`;
    if (k === key) return; // only when the dominant sea, dim ramp or sky bands actually change
    key = k;
    bands.forEach((hex, i) => set(sky[i], hex));
    fieldRamp(sea, light).forEach((hex, i) => set(field[i], hex));
    buildPalette(sea, light, bands).forEach((hex, i) => {
      set(palette[i], hex);
      paletteLab[i].value.set(...toOklab(hexToLin(hex)), paletteBias(hex));
      paletteKind_[i].value = hex === bands[3] ? 0 : paletteKind(hex); // the horizon band doubles as depth haze: surfaces may use it
    });
  };
  return {
    palette, paletteLab, paletteKind: paletteKind_, field, sky, pixAngle, hazeK, stainK,
    setStain(stainAmount: number) { stainK.value = stainFalloff(stainAmount); },
    /** Clear worlds (eco-01) keep their far landmarks; foggy ones get the full stepped haze. */
    setHaze(fogDensity: number) { hazeK.value = Math.min(0.6, Math.max(0.25, fogDensity / 0.004)); },
    /** The v1 sky's top and haze colours decide the 4 sky band colours. */
    setSky(top: number, haze: number) { skyHex = [top, haze]; recut(); },
    setSea(s: SeaWeights, l = 1) { sea = s; light = l; recut(); },
    setLayout(heightPx: number, fovDeg: number) { pixAngle.value = (fovDeg * Math.PI / 180) / heightPx; },
  };
}
export type PixelState = ReturnType<typeof createPixelState>;
