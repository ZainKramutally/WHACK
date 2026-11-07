// Hand-picked review genomes spanning the morphospace. Field-guide names are for review only (the sim names forms
// itself with the trait-based generator). Each "why" ties the visible traits back to genes and chemistry.
import type { BodyGenes, Composition } from './genome';

export interface Variant { name: string; why: string; genes: BodyGenes; comp: Composition; age?: number }

// The hero sky whale: one genome, two life stages (age is the only difference).
const BELLWHALE: BodyGenes = {
  size: 1.0, segments: 0.15, limbPairs: 0.1, limbLen: 0.7, plates: 0, horns: 0,
  gape: 0.2, diet: 0.15, eyes: 0.6, buoy: 1.0, glow: 0.5, sociality: 0.4,
};
const BELL_COMP: Composition = { c: 0.8, si: 0.05, o: 0.15 };

const G = (o: Partial<BodyGenes>): BodyGenes => ({
  size: 0.4, segments: 0.3, limbPairs: 0, limbLen: 0.3, plates: 0, horns: 0,
  gape: 0.3, diet: 0.2, eyes: 0.4, buoy: 0, glow: 0, sociality: 0.2, ...o,
});

export const VARIANTS: Variant[] = [
  {
    name: 'Shale Rhinosaur',
    why: 'Silicon body (si .65): hex-faceted, stepped segments on two pairs of straight rod legs that trot; plates .85 buy bite defence, horns .7 → three straight Si horns.',
    genes: G({ size: 0.7, segments: 0.3, limbPairs: 0.5, limbLen: 0.25, plates: 0.85, horns: 0.7, gape: 0.5, diet: 0.3, eyes: 0.35, glow: 0.1 }),
    comp: { c: 0.15, si: 0.65, o: 0.2 },
  },
  {
    name: 'Hammerhead Stiltwalker',
    why: 'limbLen 1.0 on a small Si body makes 2× body-length rods (cheap strides, high vision); eyes .9 → six dots spread on a hammerhead bar.',
    genes: G({ size: 0.6, segments: 0.1, limbPairs: 0.5, limbLen: 1.0, plates: 0.3, gape: 0.2, diet: 0.2, eyes: 0.9, glow: 0.2 }),
    comp: { c: 0.25, si: 0.65, o: 0.1 },
  },
  {
    name: 'Bannered Sandserpent',
    why: 'Carbon (c .7) and segments 1.0 → 16 smooth segments; no limbs, so it crawls by lateral waves; carbon dorsal row = frills, long body = banded skin.',
    genes: G({ size: 0.6, segments: 1.0, limbPairs: 0, limbLen: 0, plates: 0.1, gape: 0.6, diet: 0.8, eyes: 0.5, glow: 0.3, sociality: 0.1 }),
    comp: { c: 0.7, si: 0.2, o: 0.1 },
  },
  {
    name: 'Cyclops Hopper',
    why: 'limbPairs .25 → one long rear pair, so it hops; carbon spends its large eye budget (.95) on one glossy eye; plates .75 tile its back.',
    genes: G({ size: 0.4, segments: 0.25, limbPairs: 0.25, limbLen: 0.75, plates: 0.75, gape: 0.3, diet: 0.3, eyes: 0.95, glow: 0.1 }),
    comp: { c: 0.6, si: 0.25, o: 0.15 },
  },
  {
    name: 'Tiled Grazer',
    why: 'limbPairs .75 → three pairs of short rods in a tripod wave; diet .05 grazer armoured by plates .9; Si gives a four-dot eye cluster and one straight horn.',
    genes: G({ size: 0.45, segments: 0.35, limbPairs: 0.75, limbLen: 0.25, plates: 0.9, horns: 0.3, gape: 0.3, diet: 0.05, eyes: 0.6, glow: 0.15, sociality: 0.6 }),
    comp: { c: 0.2, si: 0.7, o: 0.1 },
  },
  {
    name: 'Drift Leviathan',
    why: 'buoy .95 makes body density fall below the thick air, so hovering beats walking; cold + size 1.0 → a 20 m giant; glow .7 in dim light lights cyan lures on its trailing tendrils.',
    genes: G({ size: 1.0, segments: 0.55, limbPairs: 0, limbLen: 0.2, gape: 0.4, diet: 0.1, eyes: 0.3, buoy: 0.95, glow: 0.7, sociality: 0.2 }),
    comp: { c: 0.8, si: 0.05, o: 0.15 },
  },
  {
    name: 'Glass Crown',
    why: 'High si and no legs → radial order 6; it cannot float, so it roots and filter-feeds with twelve rod arms snapping in 15° steps; glow .6 lights its crown.',
    genes: G({ size: 0.55, segments: 0.6, limbPairs: 0, limbLen: 0.6, plates: 0.4, gape: 0.2, diet: 0.3, eyes: 0.1, buoy: 0.1, glow: 0.6, sociality: 0 }),
    comp: { c: 0.1, si: 0.8, o: 0.1 },
  },
  {
    name: 'Ember Skitter',
    why: 'size .12 → a 30 cm critter on three pairs of curling carbon legs at a fast cadence; sociality 1.0 → it moves in a swarm; glow .5 adds a cyan tail spot.',
    genes: G({ size: 0.12, segments: 0.25, limbPairs: 0.75, limbLen: 0.45, plates: 0.1, gape: 0.2, diet: 0.2, eyes: 0.5, glow: 0.5, sociality: 1.0 }),
    comp: { c: 0.65, si: 0.2, o: 0.15 },
  },
  {
    name: 'Bellwhale (adolescent)',
    why: 'buoy 1.0 makes hovering the cheapest mode, and a body this short (segments .15) carries its gas as a radial bell instead of a hull; size 1.0 + cold → a ~22 m bell drifting ~90 m up; limbLen .7 → three grip arms; glow .5 in dim light → cyan points on the tendrils.',
    genes: BELLWHALE, comp: BELL_COMP, age: 1,
  },
  {
    name: 'Bellwhale (juvenile)',
    why: 'The same genome at age .12: 2.6 m; growth is allometric, so the young bell is rounder and the eyes (∝ size^0.65) are relatively twice as big.',
    genes: BELLWHALE, comp: BELL_COMP, age: 0.12,
  },
];
