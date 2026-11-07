// CPU bake of the pore field into two RGBA8 textures, sampled in (angle, height) space of a swept tube.
// The fragment/vertex shaders then do two texture reads instead of three 27-cell Worley searches.
//   T1: R dnA, G tA, B dnB, A tB      T2: R dnC, G tC, B disp, A speck
// dn = distance to the nearest feature point / pore radius (0 centre, 1 edge), stored /1.6.
// t  = per-cell hash: the pore exists when the live density (uniforms.pores) exceeds t, so the dial still morphs it.
// disp = baked push-in / rim swell in metres (fixed per preset, so geometry stays fixed).
import { fbm3, mix, smoothstep } from './noise';

export interface PoreLayerSpec { size: number; rLo: number; rHi: number; off: number; dens: number }

export interface BakeOpts {
  W: number; Hpx: number;
  H: number; bury: number;
  radiusAt: (y: number) => [number, number];   // surface radius (x, z) at height y (above base)
  layers: [PoreLayerSpec, PoreLayerSpec, PoreLayerSpec | null];
  sizeMul?: (y: number) => number;             // pore cell size scale along the height
  densBuild: number;                           // density used for the baked displacement
  vertex: boolean;                             // bake displacement at all
  nodules?: boolean;                           // small warts/nodules on the bone surface
  scale: number;                               // lump/wart scale in metres per unit
  seed: number;
}

function cellHash(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ 0x9e3779b1;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface Worley { dn: number; t: number; rad: number }

/** 3D Worley F1 with one hash per cell. Returns normalised distance dn and the per-cell existence threshold t. */
export function worleyPore(px: number, py: number, pz: number, L: PoreLayerSpec, sizeScale: number): Worley {
  const s = L.size * sizeScale;
  const x = px / s + L.off, y = py / s + L.off, z = pz / s + L.off;
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  let best = 9, bh = 0;
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const h = cellHash(ix + i, iy + j, iz + k);
    const dx = i + ((h & 1023) / 1024) * 0.85 + 0.075 - fx;
    const dy = j + (((h >>> 10) & 1023) / 1024) * 0.85 + 0.075 - fy;
    const dz = k + (((h >>> 20) & 1023) / 1024) * 0.85 + 0.075 - fz;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best) { best = d; bh = h; }
  }
  const t = ((bh >>> 3) & 0xffff) / 65536;
  const r2 = ((bh >>> 5) & 0x3ff) / 1024;
  const rad = mix(L.rLo, L.rHi, r2);
  return { dn: Math.sqrt(best) / rad, t, rad };
}

const NODULE = (sc: number): PoreLayerSpec => ({ size: 1.3 * Math.max(0.3, sc), rLo: 0.14, rHi: 0.32, off: 41.7, dens: 0.45 });
const q8 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

export function bakePores(o: BakeOpts): { t1: Uint8Array; t2: Uint8Array; maxD: number } {
  const { W, Hpx } = o;
  const t1 = new Uint8Array(W * Hpx * 4), t2 = new Uint8Array(W * Hpx * 4);
  const [A, B, C] = o.layers;
  const maxD = Math.max(0.5, o.radiusAt(0)[0] * 0.3);
  for (let j = 0; j < Hpx; j++) {
    const v = (j + 0.5) / Hpx;
    const y = v * (o.H + o.bury) - o.bury;
    const [rx, rz] = o.radiusAt(Math.max(0, y));
    const sm = o.sizeMul ? o.sizeMul(Math.max(0, y)) : 1;
    const localR = Math.min(rx, rz);
    for (let i = 0; i < W; i++) {
      const th = ((i + 0.5) / W - 0.5) * Math.PI * 2; // matches atan2(z, x) / 2π + 0.5
      const px = rx * Math.cos(th), pz = rz * Math.sin(th);
      const a = worleyPore(px, y, pz, A, sm);
      const b = worleyPore(px, y, pz, B, sm);
      const c = C ? worleyPore(px, y, pz, C, 1) : { dn: 2, t: 2, rad: 0 };
      const o4 = (j * W + i) * 4;
      t1[o4] = q8(Math.min(a.dn, 1.6) / 1.6); t1[o4 + 1] = q8(a.t);
      t1[o4 + 2] = q8(Math.min(b.dn, 1.6) / 1.6); t1[o4 + 3] = q8(b.t);
      t2[o4] = q8(Math.min(c.dn, 1.6) / 1.6); t2[o4 + 1] = q8(Math.min(c.t, 1));

      let disp = 0;
      if (o.vertex) {
        let push = 0, rise = 0;
        for (const [w, L] of [[a, A], [b, B]] as const) {
          if (w.t > o.densBuild * L.dens) continue;
          const metres = w.rad * L.size * sm;
          const depth = Math.pow(Math.max(0, 1 - w.dn * w.dn), 0.8);
          push += Math.pow(depth, 0.6) * metres * 0.42;
          rise += Math.exp(-Math.pow((w.dn - 1.16) / 0.26, 2)) * metres * 0.32;
        }
        const inside = a.dn < 1 && a.t <= o.densBuild * A.dens || b.dn < 1 && b.t <= o.densBuild * B.dens;
        const lumps = inside ? 0 : fbm3(px / (o.scale * 0.9), y / (o.scale * 0.9), pz / (o.scale * 0.9), 3, o.seed) * o.scale * 0.35;
        disp = Math.min(rise, localR * 0.14) - Math.min(push, localR * 0.3) + lumps;
      }
      const speck = fbm3(px / (o.scale * 0.7), y / (o.scale * 0.7), pz / (o.scale * 0.7), 3, o.seed + 1);
      const warts = fbm3(px / (o.scale * 0.22), y / (o.scale * 0.22), pz / (o.scale * 0.22), 2, o.seed + 2);
      let surf = Math.abs(speck) * 0.2 + Math.abs(warts) * 0.18; // 0..~0.38
      if (o.nodules) {
        // small nodules scattered on the bone: bump up, dark contact ring
        const n = worleyPore(px, y, pz, NODULE(o.scale), 1);
        const insidePore = a.dn < 1.3 || b.dn < 1.3;
        if (!insidePore && n.t < 0.45) {
          const bump = Math.sqrt(Math.max(0, 1 - n.dn * n.dn));
          disp += bump * o.scale * 0.22 * (o.vertex ? 1 : 0);
          surf += (smoothstep(1.0, 1.15, n.dn) * (1 - smoothstep(1.15, 1.7, n.dn))) * 0.22 - bump * 0.05;
          t2[o4 + 2] = q8(0.5 + Math.max(-maxD, Math.min(maxD, disp)) / (2 * maxD));
        }
      }
      t2[o4 + 2] = q8(0.5 + Math.max(-maxD, Math.min(maxD, disp)) / (2 * maxD));
      t2[o4 + 3] = q8(Math.max(0, surf) / 0.4);
    }
  }
  void smoothstep;
  return { t1, t2, maxD };
}
