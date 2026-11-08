import { describe, expect, it } from 'vitest';
import { BODY_GENES } from './genome';
import { geneField, LAYOUT_VERSION, ORGANISM_STRIDE, OrganismField, organismCount, packOrganism, readOrganism, type OrganismRecord } from './organismLayout';

const rec = (id: number): OrganismRecord => ({
  x: 0.25, y: 0.75, role: 1, size: 1.5, prefTemp: 12.5, tolerance: 6, chem: 0.5, energy: 0.75, id, generation: 7,
  heading: -2.5, mode: 2,
  body: Object.fromEntries(BODY_GENES.map((g, i) => [g, (i + 1) / 16])) as OrganismRecord['body'],
  comp: { c: 0.25, si: 0.5, o: 0.25 }, lineage: 3, altitude: 1234, grown: 0.5, intent: 1, targetId: 42,
});

describe('organism layout v2', () => {
  it('keeps the v1 field indices and appends the rest', () => {
    expect(LAYOUT_VERSION).toBe(4);
    expect([OrganismField.x, OrganismField.y, OrganismField.role, OrganismField.size, OrganismField.prefTemp,
      OrganismField.tolerance, OrganismField.chem, OrganismField.energy, OrganismField.id, OrganismField.generation])
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(OrganismField.heading).toBe(10);
    expect(geneField('size')).toBe(12);
    expect(geneField('sociality')).toBe(23);
    expect(OrganismField.grown).toBe(29);
    expect(OrganismField.intent).toBe(30);
    expect(OrganismField.targetId).toBe(ORGANISM_STRIDE - 1);
    const idx = Object.values(OrganismField);
    expect(new Set(idx).size).toBe(idx.length);
  });

  it('round-trips records (exact on dyadic values) at any index', () => {
    const buf = new Float32Array(3 * ORGANISM_STRIDE);
    packOrganism(buf, 0, rec(10));
    packOrganism(buf, 2, rec(12));
    expect(organismCount(buf)).toBe(3);
    expect(readOrganism(buf, 0)).toEqual(rec(10));
    expect(readOrganism(buf, 2)).toEqual(rec(12));
    expect(Array.from(buf.subarray(ORGANISM_STRIDE, 2 * ORGANISM_STRIDE)).every((v) => v === 0)).toBe(true);
  });
});
