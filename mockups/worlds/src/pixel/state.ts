// Live pixel-mode state: the active palette (≤32 colours) and field ramp as TSL uniforms, rebuilt when the dominant sea changes.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { SeaWeights } from '../contracts';
import { PALETTE_SIZE, buildPalette, dominantSea, fieldRamp, hexToLin, paletteBias, skySteps, toOklab } from './palette';

export function createPixelState() {
  const mk = (n: number) => Array.from({ length: n }, () => uniform(new THREE.Color()));
  const mkV = (n: number) => Array.from({ length: n }, () => uniform(new THREE.Vector4()));
  const palette = mk(PALETTE_SIZE);
  const paletteLab = mkV(PALETTE_SIZE); // Oklab of each palette colour (x=L, y=a, z=b, w=distance bias), for the nearest-colour search
  const field = mk(6);
  const sky = mk(4); // sky bands top → horizon; sky[3] is also the depth-haze colour
  let skyHex: [number, number] = [0x335577, 0xaabbcc];
  const pixAngle = uniform(0.004); // radians per internal pixel (vertical)
  let current = '';
  let ramp: number[] = [];
  const set = (u: any, hex: number) => u.value.setHex(hex, THREE.SRGBColorSpace);
  const recut = () => { if (ramp.length) skySteps(skyHex[0], skyHex[1], ramp).forEach((st, i) => set(sky[i], ramp[st])); };
  return {
    palette, paletteLab, field, sky, pixAngle,
    /** The v1 sky's top and haze colours decide which field steps the 4 sky bands use. */
    setSky(top: number, haze: number) { skyHex = [top, haze]; recut(); },
    /** Re-cut the palette when the dominant sea flips (cheap: only on change). */
    setSea(sea: SeaWeights) {
      const k = dominantSea(sea);
      if (k === current) return;
      current = k;
      buildPalette(sea).forEach((hex, i) => { set(palette[i], hex); paletteLab[i].value.set(...toOklab(hexToLin(hex)), paletteBias(hex)); });
      ramp = fieldRamp(sea);
      ramp.forEach((hex, i) => set(field[i], hex));
      recut();
    },
    setLayout(heightPx: number, fovDeg: number) { pixAngle.value = (fovDeg * Math.PI / 180) / heightPx; },
  };
}
export type PixelState = ReturnType<typeof createPixelState>;
