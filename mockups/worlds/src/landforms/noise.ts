// Small CPU noise kit (deterministic, no deps). Used by terrain, spire, arch and wall geometry.
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// integer-lattice hash → [0,1)
function h3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** 3D value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = fade(x - xi), fy = fade(y - yi), fz = fade(z - zi);
  const c = (dx: number, dy: number, dz: number) => h3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = mix(c(0, 0, 0), c(1, 0, 0), fx), x10 = mix(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = mix(c(0, 0, 1), c(1, 0, 1), fx), x11 = mix(c(0, 1, 1), c(1, 1, 1), fx);
  return mix(mix(x00, x10, fy), mix(x01, x11, fy), fz) * 2 - 1;
}
export const noise2 = (x: number, z: number, seed = 0) => noise3(x, 0.37, z, seed);

export function fbm3(x: number, y: number, z: number, oct = 4, seed = 0): number {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * noise3(x * f, y * f, z * f, seed + i * 17);
    norm += a; a *= 0.5; f *= 2.03;
  }
  return sum / norm;
}
export const fbm2 = (x: number, z: number, oct = 4, seed = 0) => fbm3(x, 0.37, z, oct, seed);

/** Ridged variant in [0,1]: sharp crests. */
export function ridged3(x: number, y: number, z: number, oct = 3, seed = 0): number {
  let a = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise3(x * f, y * f, z * f, seed + i * 31));
    sum += a * n * n; norm += a; a *= 0.5; f *= 2.1;
  }
  return sum / norm;
}
