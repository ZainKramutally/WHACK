import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { makeStubVisualInputs } from '../visualInputs';
import { FLORA_GRID } from '../layout';
import type { VisualInputs } from '../../worlds/types';
import { ARCHETYPE_META, ROLE_BAND, buildFloraLibrary } from './index';
import { makePlantList, placePlants, type PlantList } from './place';
import { makeEnv, plantEnv } from './traits';
import { TRAITS, VARY_JND, varyDistance, varyPlant, type PlantVary, type TraitContext } from './vary';

/** A trait context: the cell's biomass and sea, the world's light and heat band. */
const cx = (mat: number, canopy: number, submerged: boolean, light: number, heatBand: number): TraitContext =>
  plantEnv(Object.assign(makeEnv(), { light, heatBand, co2: 0.25 }), mat, canopy, submerged ? -1 : 1, 0, 0.3, 'mid');
import { plantMatrix, plantShape } from './instance';

const PATCH = 400;
const VERBOSE = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VERBOSE;
function inputs(fill: (c: number) => [number, number], over: Partial<VisualInputs> = {}): VisualInputs {
  const flora = new Float32Array(64 * 64 * 2);
  for (let c = 0; c < 4096; c++) { const [m, k] = fill(c); flora[c * 2] = m; flora[c * 2 + 1] = k; }
  return { ...makeStubVisualInputs(), flora, seaLevel: -1, terrain: { rise: 1, progress: {}, height: () => 0 }, lifeOnLand: true, ...over };
}
const silicon = (): Partial<VisualInputs> => {
  const stub = makeStubVisualInputs();
  return { world: { ...stub.world, id: 'silicon', composition: { c: 0.1, si: 0.9, o: 0 }, solvent: { ...stub.world.solvent, name: 'Liquid nitrogen' } }, light: 0.016 };
};
/** Biomass that varies from cell to cell (so neighbours differ in their conditions too), canopy over most of the patch. */
const varied = (c: number): [number, number] => [0.4 + 0.5 * ((c * 37) % 11) / 10, ((c * 53) % 7) < 2 ? 0.05 : 0.5 + 0.5 * ((c * 29) % 5) / 4];
const lookOf = (l: PlantList, i: number): PlantVary => ({
  size: 1, girth: 1 + l.wg[i], crown: 1 + l.wc[i], leanX: l.lx[i], leanZ: l.lz[i], twist: l.wt[i], droop: l.wd[i], bend: l.wb[i],
  r: 0.9 + l.tr[i], g: 0.9 + l.tg[i], b: 0.9 + l.tb[i],
});
const worlds: [string, Partial<VisualInputs>][] = [['carbon', {}], ['silicon', silicon()]];

describe('per-plant variation (vary.ts)', () => {
  it('is pure: the same plant always gets the same look, and a moving camera never changes a plant', () => {
    const a = varyPlant(5, 1234, 3, false, cx(0.7, 0.4, false, 0.8, 0.5));
    expect(varyPlant(5, 1234, 3, false, cx(0.7, 0.4, false, 0.8, 0.5))).toEqual(a);
    for (const [, over] of worlds) {
      const inp = inputs(varied, over);
      const near = placePlants(inp, PATCH, { x: 0, z: 0 }, makePlantList());
      const moved = placePlants(inp, PATCH, { x: 20, z: -12 }, makePlantList());
      const key = (l: PlantList, i: number) => `${l.cell[i]}/${ARCHETYPE_META[l.arch[i]].role}/${l.dark[i]}/${l.slot[i]}`;
      const seen = new Map<string, number>();
      for (let i = 0; i < near.n; i++) seen.set(key(near, i), i);
      let same = 0;
      for (let j = 0; j < moved.n; j++) {
        const i = seen.get(key(moved, j));
        if (i === undefined) continue;
        same++;
        expect(lookOf(moved, j)).toEqual(lookOf(near, i));
        expect(moved.arch[j]).toBe(near.arch[i]);
      }
      expect(same).toBeGreaterThan(1000);
    }
  });

  it('no two plants of one archetype and value step within any 3 × 3 block of cells look alike (≥ 1 JND apart)', () => {
    // rolling ground with a sea: neighbours differ in wetness, height rank and mineral too (cell-driven traits)
    const rolling: Partial<VisualInputs> = { seaLevel: 0, terrain: { rise: 1, progress: {}, height: (x, z) => 6 * Math.sin(x / 23) * Math.cos(z / 31) + 2, patchSize: PATCH } };
    for (const [name, over] of worlds) for (const [fill, ground] of [[varied, {}], [() => [0.6, 1] as [number, number], {}], [() => [1, 0] as [number, number], {}], [varied, rolling], [() => [0.6, 1] as [number, number], rolling]] as const) {
      const l = placePlants(inputs(fill, { ...over, ...ground }), PATCH, { x: 0, z: 0 }, makePlantList());
      const byCell = new Map<number, number[]>();
      for (let i = 0; i < l.n; i++) { const c = l.cell[i]; if (!byCell.has(c)) byCell.set(c, []); byCell.get(c)!.push(i); }
      let pairs = 0, worst = Infinity;
      for (let i = 0; i < l.n; i++) {
        const c = l.cell[i], col = c % FLORA_GRID, row = Math.floor(c / FLORA_GRID);
        // every other cell that shares a 3 × 3 block with this one (|Δcol|, |Δrow| ≤ 2)
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          const cc = col + dc, rr = row + dr;
          if (cc < 0 || rr < 0 || cc >= FLORA_GRID || rr >= FLORA_GRID) continue;
          for (const j of byCell.get(rr * FLORA_GRID + cc) ?? []) {
            if (j <= i || l.arch[j] !== l.arch[i] || l.dark[j] !== l.dark[i]) continue;
            pairs++;
            const d = varyDistance(lookOf(l, i), lookOf(l, j), l.h[i], l.h[j], l.yaw[i], l.yaw[j]);
            worst = Math.min(worst, d);
          }
        }
      }
      if (VERBOSE) console.log(`${name}: ${l.n} plants, ${pairs} same-look neighbour pairs, closest ${worst.toFixed(2)} JND`);
      expect(pairs, name).toBeGreaterThan(500);
      expect(worst, `${name}: closest pair ${worst.toFixed(2)} JND over ${pairs} pairs`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps sizes in their role bands (cold taller) and silicon straight, faceted and 60°-branched', () => {
    for (const [name, over] of worlds) {
      const mean: Record<string, number[]> = {};
      for (const heatBand of [0, 1]) {
        const l = placePlants(inputs(() => [0.6, 1], { ...over, heatBand }), PATCH, { x: 0, z: 0 }, makePlantList());
        const sum = { ground: 0, mid: 0, giant: 0 }, n = { ground: 0, mid: 0, giant: 0 };
        const bad: string[] = [];
        for (let i = 0; i < l.n; i++) {
          const meta = ARCHETYPE_META[l.arch[i]], [lo, hi] = ROLE_BAND[meta.role], v = lookOf(l, i), h = l.h[i];
          if (!(h >= lo && h <= hi)) bad.push(`${meta.role} height ${h}`);
          sum[meta.role] += h; n[meta.role]++;
          // the tint never exceeds 1 (nothing new blooms) and never blacks a plant out
          if (![v.r, v.g, v.b].every((ch) => ch > 0.45 && ch <= 1 + 1e-6)) bad.push(`tint ${v.r} ${v.g} ${v.b}`); // (float32 storage)
          if (Math.atan(Math.hypot(v.leanX, v.leanZ)) * 180 / Math.PI >= 10) bad.push(`lean ${v.leanX} ${v.leanZ}`);
          if (meta.chem === 'silicon') {
            // no curl, and a branch built at 60° from its trunk is drawn within 3° of it at the widest crown and girth
            if (v.twist || v.droop || v.bend) bad.push('silicon curls');
            const drawn = Math.atan(v.girth * v.crown * Math.tan(Math.PI / 3)) * 180 / Math.PI;
            if (!(Math.abs(drawn - 60) < 3)) bad.push(`silicon branch at ${drawn.toFixed(2)}°`);
          }
        }
        expect(bad.slice(0, 5), `${name} heatBand ${heatBand}: ${bad.length} plants off`).toEqual([]);
        for (const role of ['ground', 'mid', 'giant'] as const) (mean[role] ??= []).push(sum[role] / Math.max(1, n[role]));
      }
      for (const role of ['ground', 'mid', 'giant'] as const) expect(mean[role][0], `${name} ${role}: cold taller`).toBeGreaterThan(mean[role][1]);
    }
  });

  it('carbon curls: stems bend, twist and droop or splay, and the cell biomass shapes them', () => {
    const lean = varyPlant(5, 700, 1, false, cx(0.1, 0.1, false, 0.8, 0.5)), dense = varyPlant(5, 700, 1, false, cx(1, 1, false, 0.8, 0.5));
    expect(Math.hypot(dense.leanX, dense.leanZ)).toBeLessThan(Math.hypot(lean.leanX, lean.leanZ)); // dense cells stand straighter
    let bend = 0, twist = 0, droop = 0;
    const carbon = ARCHETYPE_META.findIndex((m) => m.chem === 'carbon' && m.role === 'mid');
    for (let c = 0; c < 200; c++) {
      const v = varyPlant(carbon, c, 0, false, cx(0.6, 0.6, false, 0.2, 0.5));
      bend = Math.max(bend, Math.abs(v.bend)); twist = Math.max(twist, Math.abs(v.twist)); droop = Math.max(droop, v.droop);
    }
    expect(bend).toBeGreaterThan(5 * VARY_JND.bend);
    expect(twist).toBeGreaterThan(0.4);
    expect(droop).toBeGreaterThan(3 * VARY_JND.droop); // dim light: caps hang
  });

  it('draws a plant with no look as before (matrix and shape terms), and girth only widens it', () => {
    const lib = buildFloraLibrary(7), a = lib.archetypes[3], l = makePlantList(2);
    l.n = 1; l.arch[0] = 3; l.x[0] = 4; l.y[0] = 2; l.z[0] = -6; l.h[0] = 12; l.yaw[0] = 0.7;
    const s = 12 / a.size, old = new Matrix4().compose(new Vector3(4, 2 - 0.36, -6), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), l.yaw[0]), new Vector3(s, s, s));
    expect(plantMatrix(l, 0, a, new Matrix4()).toArray()).toEqual(old.toArray());
    const out = new Float32Array(4);
    plantShape(l, 0, a, out, 0);
    expect(Array.from(out)).toEqual([0, 0, 0, 0]);
    l.wg[0] = 0.1;
    const m = plantMatrix(l, 0, a, new Matrix4()), sc = new Vector3();
    m.decompose(new Vector3(), new Quaternion(), sc);
    expect(sc.x).toBeCloseTo(s * 1.1, 5); expect(sc.y).toBeCloseTo(s, 5); expect(sc.z).toBeCloseTo(s * 1.1, 5);
  });
});

describe('condition traits (TRAITS)', () => {
  it('each maps its driver monotonically, with a why, under a unique id', () => {
    const ids = new Set<string>();
    for (const t of TRAITS) {
      expect(ids.has(t.id), t.id).toBe(false); ids.add(t.id);
      expect(t.why.length, t.id).toBeGreaterThan(10);
      let up = 0, down = 0, prev = t.map(-1);
      for (let x = -1; x <= 3; x += 0.01) { const y = t.map(x); if (y > prev + 1e-12) up++; if (y < prev - 1e-12) down++; prev = y; }
      expect(up === 0 || down === 0, `${t.id} is monotone`).toBe(true);
    }
  });
});

describe('glow per plant (paintSites + the flora material lookAttr)', () => {
  it('lighting a site-painted plant by its own glow gives exactly what paint() gives at that glow', async () => {
    const { paint, paintSites } = await import('./index');
    const { Color } = await import('three/webgpu');
    const lib = buildFloraLibrary(7);
    const pal = { ink: 0x22060f, maroon: 0x5c0a1e, crimson: 0xa8122a, blush: 0xf2a2a0, bone: 0xf4e6dc, glow: 0x3ff5e0, glowDeep: 0x0f8f9a };
    const lin = (hex: number) => { const c = new Color().setHex(hex); return [c.r, c.g, c.b]; };
    const G = lin(pal.glow), D = lin(pal.glowDeep);
    let sites = 0, deep = 0, err = 0;
    for (const key of ['lanternPods#0', 'jellyDome#1', 'weeper#0', 'crystalGround#3']) for (const dark of [false, true]) {
      const built = lib.byKey.get(key)!.lod[0];
      const sited = built.geometry.clone();
      paintSites({ ...built, geometry: sited }, pal, dark);
      const c0 = sited.getAttribute('color').array as Float32Array, s = sited.getAttribute('aGlow').array as Float32Array;
      for (const g of [0, 0.3, 0.7, 1]) {
        const ref = built.geometry.clone();
        paint({ ...built, geometry: ref }, pal, g, dark);
        const c = ref.getAttribute('color').array as Float32Array, a = ref.getAttribute('aGlow').array as Float32Array;
        for (let v = 0; v < s.length; v++) {
          // the material: site colour toward its glow colour (by the sign) by min(1, 1.5 g), emissive |s| × g
          // (painted ÷ 0.9 for headroom and drawn × the neutral 0.9 tint; the glow colour ÷ 0.9 to match)
          const w = Math.abs(s[v]), k = s[v] >= 0 ? G : D, t = Math.min(1, 1.5 * g) * (w > 1e-4 ? 1 : 0);
          for (let ch = 0; ch < 3; ch++) err = Math.max(err, Math.abs(0.9 * (c0[v * 3 + ch] + (k[ch] / 0.9 - c0[v * 3 + ch]) * t) - c[v * 3 + ch]));
          err = Math.max(err, Math.abs(w * g - a[v]));
          if (g === 1 && w > 0) { sites++; if (s[v] < 0) deep++; }
        }
        ref.dispose();
      }
      sited.dispose();
    }
    expect(err).toBeLessThan(0.006); // bone's red channel clamps at 1 in the headroom (0.905 → 0.9)
    expect(sites).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(0); // glowDeep sites keep their deep colour
  });
});
