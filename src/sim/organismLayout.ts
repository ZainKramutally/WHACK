// Layout of SimSnapshot.organisms: one record per living organism, ORGANISM_STRIDE floats each.
// The renderer reads creatures and plants from this buffer, so change it only by agreement.
// Rule: append only. Never reorder or reuse an existing index; bump LAYOUT_VERSION when the stride grows.
import { BODY_GENES, type BodyGenes, type Composition } from './genome';
import type { LocomotionMode } from './develop';

export const LAYOUT_VERSION = 2;

const GENE_BASE = 12; // v2: the 12 body genes sit at 12..23 in BODY_GENES order

export const OrganismField = {
  // v1
  x: 0, // position in the terrain patch, 0..1
  y: 1, // position in the terrain patch, 0..1
  role: 2, // 0 producer, 1 consumer
  size: 3, // relative body size (1 = typical)
  prefTemp: 4, // preferred temperature, °C
  tolerance: 5, // temperature tolerance width, °C
  chem: 6, // 0..1: oxygen need (carbon) or cold stability (silicon)
  energy: 7, // stored energy relative to the organism's reproduction threshold (1 = ready to copy)
  id: 8, // stable id for the organism's whole life, never reused; inspect cards follow it
  generation: 9, // how many copies separate it from the founders
  // v2 (appended)
  heading: 10, // radians, 0 = +x, counter-clockwise, in (−π, π]
  mode: 11, // locomotion mode: LOCOMOTION in develop.ts (0 walk, 1 swim, 2 hover, 3 sessile)
  // 12..23: the 12 body genes in BODY_GENES order (see geneField)
  compC: 24, // body composition, carbon share
  compSi: 25, // silicon share
  compO: 26, // oxygen share
  lineage: 27, // founder id this animal descends from
} as const;

export const ORGANISM_STRIDE = 28;

/** Field index of a body gene: size 12, segments 13, limbPairs 14, limbLen 15, plates 16, horns 17, gape 18, diet 19, eyes 20, buoy 21, glow 22, sociality 23. */
export function geneField(gene: (typeof BODY_GENES)[number]): number {
  return GENE_BASE + BODY_GENES.indexOf(gene);
}

/** One organism, decoded. Animals carry real genes; producers (population.ts) leave them at 0. */
export interface OrganismRecord {
  x: number; y: number; role: number; size: number;
  prefTemp: number; tolerance: number; chem: number; energy: number;
  id: number; generation: number;
  heading: number; mode: LocomotionMode;
  body: BodyGenes; comp: Composition; lineage: number;
}

/** Writes `rec` as record number `index` of `buf`. Fields the record doesn't set stay 0. */
export function packOrganism(buf: Float32Array, index: number, rec: OrganismRecord): void {
  const o = index * ORGANISM_STRIDE;
  buf[o + OrganismField.x] = rec.x;
  buf[o + OrganismField.y] = rec.y;
  buf[o + OrganismField.role] = rec.role;
  buf[o + OrganismField.size] = rec.size;
  buf[o + OrganismField.prefTemp] = rec.prefTemp;
  buf[o + OrganismField.tolerance] = rec.tolerance;
  buf[o + OrganismField.chem] = rec.chem;
  buf[o + OrganismField.energy] = rec.energy;
  buf[o + OrganismField.id] = rec.id;
  buf[o + OrganismField.generation] = rec.generation;
  buf[o + OrganismField.heading] = rec.heading;
  buf[o + OrganismField.mode] = rec.mode;
  for (let i = 0; i < BODY_GENES.length; i++) buf[o + GENE_BASE + i] = rec.body[BODY_GENES[i]];
  buf[o + OrganismField.compC] = rec.comp.c;
  buf[o + OrganismField.compSi] = rec.comp.si;
  buf[o + OrganismField.compO] = rec.comp.o;
  buf[o + OrganismField.lineage] = rec.lineage;
}

/** Reads record number `index` of `buf` (inverse of packOrganism, up to float32 precision). */
export function readOrganism(buf: Float32Array, index: number): OrganismRecord {
  const o = index * ORGANISM_STRIDE;
  const body = {} as BodyGenes;
  for (let i = 0; i < BODY_GENES.length; i++) body[BODY_GENES[i]] = buf[o + GENE_BASE + i];
  return {
    x: buf[o + OrganismField.x],
    y: buf[o + OrganismField.y],
    role: buf[o + OrganismField.role],
    size: buf[o + OrganismField.size],
    prefTemp: buf[o + OrganismField.prefTemp],
    tolerance: buf[o + OrganismField.tolerance],
    chem: buf[o + OrganismField.chem],
    energy: buf[o + OrganismField.energy],
    id: buf[o + OrganismField.id],
    generation: buf[o + OrganismField.generation],
    heading: buf[o + OrganismField.heading],
    mode: buf[o + OrganismField.mode] as LocomotionMode,
    body,
    comp: { c: buf[o + OrganismField.compC], si: buf[o + OrganismField.compSi], o: buf[o + OrganismField.compO] },
    lineage: buf[o + OrganismField.lineage],
  };
}

/** Number of records in a snapshot buffer. */
export function organismCount(buf: Float32Array): number {
  return buf.length / ORGANISM_STRIDE;
}
