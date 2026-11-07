// Test-only configs (the real ones live in src/worlds/). Names mirror what createTerrain requires.
import type { TerrainConfig } from '../worlds/types';

const base = { amplitude: 40, frequency: 1 / 160, octaves: 5, lacunarity: 2, gain: 0.5, warpAmp: 30, warpFreq: 1 / 220, exponent: 1.2, rampRange: 0.75, rampDetail: 0.25 };
const src = { why: 'test fixture', sources: [], assumption: true };

export const carbonLike: TerrainConfig = {
  ...src, patchSize: 400, base, spawn: { shoreDistance: 40 }, heatSolventSpan: 120,
  machines: [
    { id: 'M3', rate: 1, params: { halfWidth: 0.2, finHeight: 8, finSpacing: 14, finWarp: 10, finSharp: 6, breakup: 0.35, uplandMin: 0.1 } },
    { id: 'M4', rate: 1, params: { depth: 18, widthWet: 40, widthDry: 22, steepWet: 1.35, steepDry: 3.2, dryStart: 0.55, dryEnd: 0.95, meanderAmp: 40, meanderFreq: 0.01, offsetFrac: 0.25 } },
    { id: 'M5', rate: 1, params: { bandH: 5, sharpness: 0.7, strength: 0.8 } },
    { id: 'M6', rate: 1, params: { moundHeight: 4, bandCenter: -0.15, bandWidth: 0.3, moundFreq: 0.03, threshold: 0.5 } },
  ],
};

export const siliconLike: TerrainConfig = {
  ...src, patchSize: 400, base: { ...base, amplitude: 30 }, spawn: { shoreDistance: 50 }, heatSolventSpan: 80,
  machines: [
    { id: 'M2', rate: 1, params: { rimHeight: 3, bandCenter: 0.2, bandWidth: 0.25, patchFreq: 0.05, threshold: 0.45 } },
    { id: 'M4', rate: 1, params: { depth: 12, widthWet: 30, widthDry: 18, steepWet: 1.35, steepDry: 3.2, dryStart: 0.55, dryEnd: 0.95, meanderAmp: 30, meanderFreq: 0.01, offsetFrac: 0.25 } },
    { id: 'M5', rate: 1, params: { bandH: 6, sharpness: 0.6, strength: 0.6 } },
  ],
  relics: [
    { kind: 'iceSpire', count: 6, params: { height: 25, radius: 7 } },
    { kind: 'iceArch', count: 3, params: { height: 20, radius: 6, span: 24 } },
  ],
};
