// Flora draw buckets: one InstancedMesh per archetype × LOD × value step (the dark foreground step of ground cover).
// flora.ts allocates exactly these and fills them from a PlantList, so countDraws gives the real draw-call and triangle
// count of any placement without a GPU (floraLib.test.ts holds the budget).
//
// Buckets are NOT chunked. Ground cover lives within ~150 m of the camera, near-LOD plants within 40–90 m and far ones
// across the patch, so a third-person camera inside the patch sees part of nearly every chunk. On the silicon demo
// spawn, chunks (100 m; 200 m for ground) culled 30% of the triangles for 3.7× the draw calls: 66 visible draws and
// 0.32M triangles, against 18 draws and 0.46M triangles unchunked. Off-screen triangles are clipped before any fragment
// work, and each draw costs far more CPU than its culled vertices cost GPU. Every bucket in use is one draw call.
import { ARCHETYPE_META, type FloraRole } from './index';
import type { PlantList } from './place';

/** Instance capacity per bucket (allocated once at startup; overflow is dropped and counted). Worst case (canopy over
 * the whole patch) places ~3.3k ground plants, ≤ ~600 dark ones (within 30 m), ~1.3k mids and ≤ 169 giants in all. */
export const BUCKET_CAP: Readonly<Record<FloraRole | 'groundDark', number>> = { ground: 4096, groundDark: 1024, mid: 1024, giant: 256 };

export interface BucketDef { id: number; arch: number; lod: 0 | 1; dark: 0 | 1; role: FloraRole; cap: number }

/** Bucket id of an archetype index × LOD × value step (dark = 1: the foreground step). */
export const bucketId = (arch: number, lod: number, dark: number): number => (arch * 2 + lod) * 2 + dark;
/** One past the largest bucket id. */
export const BUCKET_IDS = ARCHETYPE_META.length * 4;

/** Every bucket: ground cover is near-LOD only and is the only role with the dark step; mid and giant have two LODs. */
export function bucketDefs(): BucketDef[] {
  const out: BucketDef[] = [];
  ARCHETYPE_META.forEach(({ role }, arch) => {
    for (const lod of [0, 1] as const) for (const dark of [0, 1] as const) {
      if (role === 'ground' ? lod === 1 : dark === 1) continue;
      out.push({ id: bucketId(arch, lod, dark), arch, lod, dark, role, cap: role === 'ground' && dark ? BUCKET_CAP.groundDark : BUCKET_CAP[role] });
    }
  });
  return out;
}

const CAPS = (() => {
  const c = new Int32Array(BUCKET_IDS);
  for (const b of bucketDefs()) c[b.id] = b.cap;
  return c;
})();

export interface DrawCount {
  /** Buckets in use: one draw call each. */
  draws: number;
  triangles: number;
  /** Plants over their bucket's capacity (not drawn). */
  dropped: number;
  byRole: Record<FloraRole, { draws: number; triangles: number }>;
}

/** Draw calls and triangles flora.ts submits for a plant list. `triangles(arch, lod)`: the archetype's LOD triangle count. */
export function countDraws(list: PlantList, triangles: (arch: number, lod: number) => number): DrawCount {
  const n = new Int32Array(BUCKET_IDS);
  for (let i = 0; i < list.n; i++) n[bucketId(list.arch[i], list.lod[i], list.dark[i])]++;
  const out: DrawCount = { draws: 0, triangles: 0, dropped: 0, byRole: { ground: { draws: 0, triangles: 0 }, mid: { draws: 0, triangles: 0 }, giant: { draws: 0, triangles: 0 } } };
  for (let id = 0; id < BUCKET_IDS; id++) {
    if (!n[id]) continue;
    const drawn = Math.min(n[id], CAPS[id]);
    out.dropped += n[id] - drawn;
    if (!drawn) continue;
    const arch = id >> 2, t = drawn * triangles(arch, (id >> 1) & 1), r = out.byRole[ARCHETYPE_META[arch].role];
    out.draws++; out.triangles += t; r.draws++; r.triangles += t;
  }
  return out;
}
