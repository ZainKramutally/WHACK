// The four pin presets. Owner: team lead (art). Colours measured from the pins (median-cut, region means).
// Dials follow docs/WORLD_ATLAS.md §5.3. Compositions are first guesses — agents tune them by
// comparing the captured still against the pin, then report the numbers they changed.
import type { Preset } from './contracts';

const pin = (n: string) => `research/visual/pinterest-silicon/ecosystem/2026-11-07-ecosystem-${n}.jpg`;
const sea = (w: Partial<Preset['dials']['sea']>) => ({ water: 0, ammonia: 0, methane: 0, acid: 0, ...w });

export const PRESETS: Preset[] = [
  {
    id: 'eco01',
    name: 'Vermilion Eclipse',
    pin: pin('01'),
    dials: { recipe: { c: 0.2, si: 0.45, o: 0.35 }, sea: sea({ water: 1 }), heat: 0.9, light: 0.85, age: 0.95, seed: 101 },
    pinPalette: {
      skyTop: 0xbabdac, skyHorizon: 0xb5c9c2, haze: 0xc2d1c9, fog: 0xbecabf,
      ground: 0xf94b1e, shadow: 0x7d2a16, accent: 0x201913,
    },
    composition: {
      aspect: 0.716,
      // Low on a flat plain, slight up-tilt: horizon sits at ~58% from the top of the frame.
      camera: { position: [0, 2.2, 0], target: [4, 22, -200], fov: 52 },
      sunDir: [0.1, 0.28, -0.95],          // eclipse at ~(0.6, 0.33) of the frame
      skyEvent: 'eclipse',
      valley: [[0, 0], [0, -400]],
      valleyWidth: 400,                 // open plain
      landmarks: [
        { kind: 'spire', pos: [-38, -170], height: 135, radius: 5 },
        { kind: 'spire', pos: [62, -260], height: 100, radius: 3.5, horns: true },
        { kind: 'spire', pos: [-6, -230], height: 60, radius: 3 },
        { kind: 'spire', pos: [-120, -320], height: 60, radius: 4 },
        { kind: 'spire', pos: [95, -330], height: 40, radius: 3 },
        { kind: 'spire', pos: [-190, -400], height: 38, radius: 3 },
        { kind: 'spire', pos: [140, -440], height: 52, radius: 3.5 },
        { kind: 'spire', pos: [-60, -500], height: 30, radius: 2.5 },
        { kind: 'spire', pos: [30, -560], height: 36, radius: 3 },
        { kind: 'spire', pos: [-250, -520], height: 44, radius: 3.5 },
        { kind: 'spire', pos: [25, -360], height: 45, radius: 4 },
        { kind: 'spire', pos: [-70, -420], height: 35, radius: 4 },
        { kind: 'monolith', pos: [-4.5, -13], height: 6.2 },   // the pin's big left figure
        { kind: 'monolith', pos: [3, -62], height: 10 },       // the pin's centre figure
        { kind: 'cluster', species: 'ashScrub', pos: [-9, -22], radius: 12, count: 7, scale: 3 },   // the pin's dark smears, foreground
        { kind: 'cluster', species: 'ashScrub', pos: [18, -45], radius: 16, count: 8, scale: 4 },
      ],
      figure: { pos: [8, -95], height: 1.75 },
    },
  },
  {
    id: 'eco04',
    name: 'Frost Arches',
    pin: pin('04'),
    dials: { recipe: { c: 0.15, si: 0.4, o: 0.45 }, sea: sea({ methane: 1 }), heat: 0.1, light: 0.25, age: 0.85, seed: 404 },
    pinPalette: {
      skyTop: 0xe7e9ed, skyHorizon: 0xf0f4f7, haze: 0xd1dfe9, fog: 0xc3c4d4,
      ground: 0xd1dfe9, shadow: 0x303b51, accent: 0xda1b58,
    },
    composition: {
      aspect: 0.561,
      // Eye level on the snowy valley floor, wide lens, vanishing point centre (~55% down).
      camera: { position: [0, 1.6, 0], target: [0, 10, -100], fov: 64 },
      sunDir: [-0.35, 0.7, 0.45],       // high, soft, front-left so arch and wall faces toward us are lit
      skyEvent: 'none',
      valley: [[0, 0], [-2, -60], [4, -140], [0, -260]],
      valleyWidth: 34,
      landmarks: [
        { kind: 'arch', a: [-24, -92], b: [18, -142], apex: 66, radius: 5.2 },
        { kind: 'arch', a: [-10, -158], b: [30, -102], apex: 52, radius: 4.2 },
        { kind: 'wall', pos: [-11, -28], height: 26, width: 8, depth: 8, overhang: true },
        { kind: 'wall', pos: [11, -34], height: 30, width: 9, depth: 9, overhang: true },
        { kind: 'wall', pos: [-44, -100], height: 45, width: 14, depth: 40 },
        { kind: 'wall', pos: [46, -115], height: 50, width: 14, depth: 40 },
        { kind: 'cluster', species: 'lanternCups', pos: [-2.5, -6], radius: 5, count: 40, scale: 1.4 },
        { kind: 'cluster', species: 'lanternCups', pos: [4, -14], radius: 6, count: 60 },
        { kind: 'cluster', species: 'lanternCups', pos: [-9, -35], radius: 8, count: 80 },
        { kind: 'cluster', species: 'lanternCups', pos: [-2.6, -7], radius: 2.2, count: 22, scale: 1.25 },   // pin: left foreground colony
        { kind: 'cluster', species: 'lanternCups', pos: [2.8, -8], radius: 2.4, count: 26, scale: 1.25 },
        { kind: 'cluster', species: 'lanternCups', pos: [1.9, -5.2], radius: 1.6, count: 16, scale: 1.1 },    // pin: right foreground colony
      ],
      figure: { pos: [1, -62], height: 1.75 },
    },
  },
  {
    id: 'eco12',
    name: 'Glow Garden',
    pin: pin('12'),
    dials: { recipe: { c: 0.3, si: 0.55, o: 0.15 }, sea: sea({ water: 1 }), heat: 0.5, light: 0.08, age: 0.5, seed: 1212 },
    pinPalette: {
      skyTop: 0x093f1b, skyHorizon: 0x18735a, haze: 0x1b5f3c, fog: 0x254633,
      ground: 0x4d5e42, shadow: 0x08532e, accent: 0x27aaa6,
    },
    composition: {
      aspect: 1.0,
      // Enclosed grove, no horizon. Giant glow-stalks (8–25 m) mid-right, domes behind, ribbons as backdrop.
      camera: { position: [0, 1.7, 0], target: [5, 7, -30], fov: 48 },
      sunDir: [-0.4, 0.9, 0.2],         // almost no sun: light comes from the glow + floor pool
      skyEvent: 'none',
      valley: [[0, 0], [3, -30], [0, -80]],
      valleyWidth: 30,
      landmarks: [
        { kind: 'cluster', species: 'glowStalks', pos: [7, -50], radius: 9, count: 240, scale: 1 },
        { kind: 'cluster', species: 'glowStalks', pos: [-2, -26], radius: 5, count: 36, scale: 0.15 },
        { kind: 'dome', pos: [16, -48], radius: 18, stack: 3 },
        { kind: 'dome', pos: [-14, -58], radius: 26, stack: 2 },
        { kind: 'dome', pos: [30, -70], radius: 22, stack: 2 },
        { kind: 'dome', pos: [-4, -36], radius: 6 },
        { kind: 'cluster', species: 'shadeRibbons', pos: [0, -95], radius: 60, count: 120, scale: 1 },
      ],
      figure: { pos: [-1.5, -22], height: 1.75 },
    },
  },
  {
    id: 'eco14',
    name: 'Bone Reef',
    pin: pin('14'),
    dials: { recipe: { c: 0.1, si: 0.5, o: 0.4 }, sea: sea({ acid: 1 }), heat: 0.6, light: 0.3, age: 0.8, seed: 1414 },
    pinPalette: {
      skyTop: 0xd6e2d9, skyHorizon: 0xe0f0e7, haze: 0xe0f0e7, fog: 0xbab7ad,
      ground: 0xd6e2d9, shadow: 0x524842, accent: 0xec5401,
    },
    composition: {
      aspect: 0.578,
      // Low on the sand path, tilted up; giant porous spires run out of frame top-left and top-right.
      camera: { position: [0, 1.7, 0], target: [0, 26, -80], fov: 60 },
      sunDir: [-0.45, 0.6, 0.5],        // soft, hazy, front-left: lit faces toward us, shadow in the pores
      skyEvent: 'none',
      valley: [[0, 0], [1, -60], [-3, -160], [0, -300]],
      valleyWidth: 18,
      landmarks: [
        { kind: 'spire', pos: [21, -17], height: 185, radius: 14, porous: true },   // right giant, fills the right half
        { kind: 'spire', pos: [-23, -30], height: 160, radius: 12, porous: true },
        { kind: 'spire', pos: [10, -78], height: 150, radius: 10, porous: true },
        { kind: 'spire', pos: [-14, -150], height: 120, radius: 10, porous: true },
        { kind: 'spire', pos: [16, -220], height: 150, radius: 11, porous: true },
        { kind: 'spire', pos: [-28, -260], height: 100, radius: 9, porous: true },
        { kind: 'wall', pos: [-5.5, -6], height: 3.2, width: 4, depth: 3.5 },     // crust lumps bottom-left
        { kind: 'wall', pos: [-9, -11], height: 5, width: 7, depth: 6 },
      ],
      figure: { pos: [1.5, -48], height: 1.75 },
    },
  },
];

export const presetById = (id: Preset['id']) => PRESETS.find((p) => p.id === id)!;
