// Terrain: one pure height function (CPU, shared with flora via ctx.terrainHeight) + concentric ring mesh data.
import type { Vec2 } from '../contracts';
import { clamp, fbm2, mix, noise2, ridged3, smoothstep } from './noise';

export interface TerrainParams {
  valley: Vec2[];       // near → far path
  valleyWidth: number;  // full width of the walkable floor
  hot: number;          // 0..1 terraced plain + dune ripples
  snow: number;         // 0..1 smooth wind drifts
  life: number;         // 0..1 soft hummocks
  acid: number;         // 0..1 rough crust outside the path
  seed: number;
}

/** Style weights from the derived values. Hot wins the plain, otherwise the strongest of the rest. */
export function terrainParams(
  valley: Vec2[], valleyWidth: number, heat: number, snow: number, life: number, acidSea: number, seed: number,
): TerrainParams {
  const hot = smoothstep(0.55, 0.95, heat);
  return { valley, valleyWidth, hot, snow: snow * (1 - hot), life: life * (1 - hot) * (1 - 0.5 * acidSea), acid: acidSea * (1 - hot), seed };
}

/** Extend the path so the valley is closed behind the camera and (for open plains) never ends. */
function extendPath(path: Vec2[], width: number): Vec2[] {
  const p = path.length >= 2 ? path.map((v) => [v[0], v[1]] as Vec2) : [[0, 0], [0, -100]] as Vec2[];
  const dir = (a: Vec2, b: Vec2): Vec2 => { const dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  const d0 = dir(p[1], p[0]);
  p.unshift([p[0][0] + d0[0] * 60, p[0][1] + d0[1] * 60]);
  if (width > 200) {
    const n = p.length, d1 = dir(p[n - 2], p[n - 1]);
    p.push([p[n - 1][0] + d1[0] * 4000, p[n - 1][1] + d1[1] * 4000]);
  }
  return p;
}

/** Distance from (x,z) to the polyline. */
export function distToPath(path: Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

const terrace = (t: number, steps: number, soft: number) => {
  const s = t * steps, f = Math.floor(s);
  return (f + smoothstep(0.5 - soft, 0.5 + soft, s - f)) / steps;
};

export interface TerrainFn {
  (x: number, z: number): number;
  /** valley coordinate: 0 on the path centre, 1 at the floor edge */
  valleyU(x: number, z: number): number;
  /** 0..1 roughness/crust noise for colouring */
  crust(x: number, z: number): number;
}

export function makeTerrainHeight(p: TerrainParams): TerrainFn {
  const path = extendPath(p.valley, p.valleyWidth);
  const halfW = Math.max(4, p.valleyWidth / 2);
  const s = p.seed;
  const wallH = clamp(p.valleyWidth * 1.6, 25, 120) * mix(1, 0.18, p.hot);
  const wsum = Math.max(1, p.hot + p.snow + p.life + p.acid);
  const wBase = Math.max(0, 1 - (p.hot + p.snow + p.life + p.acid) / wsum) + 0.0;

  const u = (x: number, z: number) => distToPath(path, x, z) / halfW;

  const fn = ((x: number, z: number) => {
    const uu = u(x, z);
    const floor = 1 - smoothstep(0.35, 0.9, uu); // 1 on the walkable floor
    const amp = mix(1, 0.3, floor);
    let h = 0;

    if (p.hot > 0) {
      // terraced mesas with soft risers + fine dune ripples
      const wx = x + 40 * noise2(x / 170, z / 170, s + 3), wz = z + 40 * noise2(x / 170 + 9, z / 170, s + 4);
      const n = fbm2(wx / 150, wz / 150, 3, s) * 0.5 + 0.5;
      const rip = Math.sin((x * 0.5 + z * 0.22 + 6 * noise2(x / 22, z / 22, s + 5)) * 1.1) * 0.12;
      h += p.hot * (5.5 * terrace(n, 6, 0.28) * amp + rip * (0.4 + 0.6 * smoothstep(0.1, 0.5, floor)));
    }
    if (p.snow > 0) {
      const wx = x + 12 * noise2(x / 60, z / 60, s + 6);
      h += p.snow * (fbm2(wx / 34, z / 34, 3, s + 7) * 1.5 + 0.35 * noise2(x / 9, z / 9, s + 8)) * amp;
    }
    if (p.life > 0) h += p.life * (fbm2(x / 11, z / 11, 3, s + 9) * 1.0 + 0.5 * noise2(x / 4, z / 4, s + 10)) * amp;
    if (p.acid > 0) {
      const rough = 1 - floor; // path stays pale and flat, crust rises outside
      h += p.acid * (ridged3(x / 7, 0.5, z / 7, 3, s + 11) * 1.9 + fbm2(x / 2.2, z / 2.2, 2, s + 12) * 0.35) * rough * rough
        + p.acid * 0.12 * noise2(x / 3, z / 3, s + 13) * floor;
    }
    h += wBase * fbm2(x / 30, z / 30, 2, s + 14) * 0.6 * amp;

    // valley sides
    const side = smoothstep(0.75, 2.4, uu);
    const rough = 0.72 + 0.55 * ridged3(x / 90, 0.2, z / 90, 3, s + 15);
    h += wallH * Math.pow(side, 1.35) * rough + wallH * 0.35 * Math.max(0, uu - 2.4) * 0.5;
    return h;
  }) as TerrainFn;

  fn.valleyU = u;
  fn.crust = (x, z) => clamp(ridged3(x / 5, 0.5, z / 5, 3, s + 21));
  return fn;
}

// ---------------------------------------------------------------- ring mesh

export interface RingSpec { cell: number; half: number; inner: number }
export const ringSpecs = (quality: 'low' | 'high'): RingSpec[] => {
  const k = quality === 'low' ? 1.5 : 1;
  return [
    { cell: 0.8 * k, half: 56, inner: 0 },
    { cell: 2 * k, half: 150, inner: 56 },
    { cell: 6 * k, half: 480, inner: 150 },
    { cell: 24 * k, half: 2400, inner: 480 },
  ];
};

export interface RingData {
  position: Float32Array; normal: Float32Array; aU: Float32Array; aCrust: Float32Array; index: Uint32Array;
}

export function buildRing(h: TerrainFn, r: RingSpec): RingData {
  const n = Math.round((r.half * 2) / r.cell);
  const c = (r.half * 2) / n;
  const stride = n + 1;
  const pos = new Float32Array(stride * stride * 3), nor = new Float32Array(stride * stride * 3);
  const aU = new Float32Array(stride * stride), aC = new Float32Array(stride * stride);
  const e = Math.max(0.3, c * 0.5);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = -r.half + i * c, z = -r.half + j * c, o = j * stride + i;
    // outer rings sink slightly under the finer ring inside them so no cracks show
    const rInf = Math.max(Math.abs(x), Math.abs(z));
    const sink = r.inner > 0 ? (1 - smoothstep(r.inner, r.inner + c * 1.5, rInf)) * (0.15 + 0.06 * c) : 0;
    pos[o * 3] = x; pos[o * 3 + 1] = h(x, z) - sink; pos[o * 3 + 2] = z;
    const nx = h(x - e, z) - h(x + e, z), nz = h(x, z - e) - h(x, z + e), ny = 2 * e;
    const l = Math.hypot(nx, ny, nz);
    nor[o * 3] = nx / l; nor[o * 3 + 1] = ny / l; nor[o * 3 + 2] = nz / l;
    aU[o] = Math.min(h.valleyU(x, z), 4); aC[o] = h.crust(x, z);
  }
  const idx: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = -r.half + i * c, z0 = -r.half + j * c;
    if (r.inner > 0 && x0 >= -r.inner && x0 + c <= r.inner && z0 >= -r.inner && z0 + c <= r.inner) continue;
    const a = j * stride + i, b = a + 1, d = a + stride, f = d + 1;
    idx.push(a, d, b, b, d, f);
  }
  return { position: pos, normal: nor, aU, aCrust: aC, index: new Uint32Array(idx) };
}
