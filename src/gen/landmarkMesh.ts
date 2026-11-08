// Mesh data for the landmark structures (see gen/landmarks.ts). Pure arrays, no three.js, so tests can check shapes.
// Local space: origin at the structure's base centre, y up, +x along the span for arches. Triangle soup with a hex colour
// per vertex (flat bands, so strata and ice tiers read crisply); render/landmarks.ts wraps it into a BufferGeometry.
//
// Silicon relics stand on a heightfield bump (terrain.ts piers: height·(1−smoothstep(r/R))²). Every pier mesh is built to
// enclose that bump, so the heightfield spike never shows through the tiers (see bumpRadius and the test).
import type { Landmark } from './landmarks';
import { LOOK_PALETTES } from '../render/palette';

export interface LandmarkMeshData {
  positions: Float32Array;     // xyz per vertex, triangle soup
  hex: Uint32Array;            // sRGB hex colour per vertex
  /** Height of the highest point above the base (local y), used to sink the mesh below the ground while it grows. */
  top: number;
}

/** A piece of a landmark: arches are two piers and a lintel, everything else is one piece. */
export type PieceKind = 'body' | 'lintel';
export interface Piece { kind: PieceKind; mesh: LandmarkMeshData; /** local-space anchor of the piece (arch piers sit at ±span/2 along x). */ offset: [number, number, number] }

interface Ring { y: number; r: number; hex: number; cx?: number; cz?: number; rot?: number }
interface Soup { pos: number[]; hex: number[] }

const hash = (s: number, i: number, j: number) => {
  let x = (Math.imul(i + 1, 0x27d4eb2d) ^ Math.imul(j + 7, 0x165667b1) ^ s) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const mulberry = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const mixHex = (a: number, b: number, t: number) => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

/** Radius of the heightfield bump `height·(1−smoothstep(r/R))²` at height `y` (the inverse of the pier profile), for y in [0, height]. */
export function bumpRadius(y: number, height: number, radius: number): number {
  const s = Math.sqrt(Math.min(1, Math.max(0, y / height)));
  const t = 1 - s;                                    // smoothstep value to invert
  const x = 0.5 - Math.sin(Math.asin(Math.min(1, Math.max(-1, 1 - 2 * t))) / 3);   // inverse of 3x²−2x³
  return radius * x;
}

/** Faceted solid of revolution through `rings` (band above ring i takes ring i's colour). */
function lathe(out: Soup, rings: Ring[], sides: number, seed: number, jitter: number, cap?: number): void {
  const vert = (i: number, j: number): [number, number, number] => {
    const g = rings[i];
    const a = (TWO_PI * j) / sides + (g.rot ?? 0);
    const r = g.r * (1 + jitter * (2 * hash(seed, i, j % sides) - 1));
    return [(g.cx ?? 0) + r * Math.cos(a), g.y, (g.cz ?? 0) + r * Math.sin(a)];
  };
  const tri = (a: number[], b: number[], c: number[], hex: number) => {
    out.pos.push(...a, ...b, ...c);
    out.hex.push(hex, hex, hex);
  };
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < sides; j++) {
      const A = vert(i, j), B = vert(i, j + 1), C = vert(i + 1, j), D = vert(i + 1, j + 1);
      tri(A, C, B, rings[i].hex);
      tri(B, C, D, rings[i].hex);
    }
  }
  if (cap !== undefined) {
    const t = rings.length - 1, g = rings[t];
    const c = [g.cx ?? 0, g.y, g.cz ?? 0];
    for (let j = 0; j < sides; j++) tri(c, vert(t, j + 1), vert(t, j), cap);
  }
}

/** Tube along a path in the local xy plane (z is the other cross-section axis). */
function tube(out: Soup, path: { x: number; y: number; r: number; hex: number }[], sides: number, seed: number, jitter: number): void {
  const frame = (i: number) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    return { nx: -ty / l, ny: tx / l };
  };
  const vert = (i: number, j: number): [number, number, number] => {
    const p = path[i], f = frame(i);
    const a = (TWO_PI * j) / sides + 0.4 * i;
    const r = p.r * (1 + jitter * (2 * hash(seed, i, j % sides) - 1));
    return [p.x + r * Math.cos(a) * f.nx, p.y + r * Math.cos(a) * f.ny, r * Math.sin(a)];
  };
  for (let i = 0; i + 1 < path.length; i++) {
    for (let j = 0; j < sides; j++) {
      const A = vert(i, j), B = vert(i, j + 1), C = vert(i + 1, j), D = vert(i + 1, j + 1);
      out.pos.push(...A, ...B, ...C, ...B, ...D, ...C);
      const h = path[i].hex;
      out.hex.push(h, h, h, h, h, h);
    }
  }
}

const TWO_PI = Math.PI * 2;
const finish = (s: Soup): LandmarkMeshData => {
  let top = 0;
  for (let i = 1; i < s.pos.length; i += 3) if (s.pos[i] > top) top = s.pos[i];
  return { positions: new Float32Array(s.pos), hex: new Uint32Array(s.hex), top };
};

// ---- palettes (Red World roles; the art layer re-skins by replacing the material) ----
const C = LOOK_PALETTES.carbon, SI = LOOK_PALETTES.silicon;
const ICE = [SI.bone, 0xdbe9fb, SI.blush, 0xb7c4f2];
const ROCK = [0xe9b9a8, 0xc9566a, 0xa8122a, 0xf2a2a0, 0x8a2840, 0xd98a8a];
const SHELL = [C.bone, 0xfbd9cf, C.blush, 0xe8c4b8];

// ---- tiered spire, enclosing the heightfield bump ----

/** Rings of a faceted, stepped spire of `height` and base `radius`. Exported for the bump-enclosure test. */
export function spireRings(height: number, radius: number, seed: number, skirt = 0.3): { rings: Ring[]; sides: number; jitter: number } {
  const rnd = mulberry(seed);
  const sides = 6 + Math.floor(rnd() * 3);
  const topY = 1.12 * height;
  const f = (y: number) => 1.25 * radius * Math.pow(Math.max(0, 1 - y / topY), 0.75);
  const n = 7 + Math.floor(rnd() * 4);
  const rings: Ring[] = [{ y: -skirt * height, r: f(0) * 1.05, hex: ICE[2], rot: 0 }];
  for (let k = 0; k < n; k++) {
    const y0 = topY * Math.pow(k / n, 0.9), y1 = topY * Math.pow((k + 1) / n, 0.9);
    const rot = rnd() * 0.9;
    const ledge = 0.1 + 0.2 * rnd();                 // how far each tier steps in: the jagged, stacked-crystal look
    const lift = k % 2 === 0 ? 0 : 0.18;             // alternate tiers lighter, so the steps read at a distance
    const wall = mixHex(SI.maroon, ICE[0], Math.min(1, Math.max(0, 0.2 + 0.7 * (y0 / topY) + lift + 0.2 * (rnd() - 0.5))));
    rings.push({ y: y0, r: f(y0) * (0.97), hex: wall, rot });
    rings.push({ y: y1 - 0.01, r: f(y1) * (0.97 - ledge), hex: mixHex(ICE[0], ICE[1], rnd()), rot });
  }
  rings.push({ y: topY, r: 0.02 * radius, hex: ICE[0], rot: 0 });
  return { rings, sides, jitter: 0.05 };
}

function spire(lm: Landmark): Soup {
  const s: Soup = { pos: [], hex: [] };
  const { rings, sides, jitter } = spireRings(lm.height, lm.radius, lm.seed);
  lathe(s, rings, sides, lm.seed, jitter);
  return s;
}

// ---- arch ----

function archPier(lm: Landmark, which: 0 | 1): Soup {
  const s: Soup = { pos: [], hex: [] };
  const H = lm.height, R = lm.radius, rnd = mulberry(lm.seed + which * 977);
  const sides = 7 + Math.floor(rnd() * 2);
  const col = (y01: number) => R * (1.3 - 0.65 * Math.pow(y01, 1.5));
  const rings: Ring[] = [{ y: -0.45 * H, r: col(0) * 1.05, hex: ICE[2], rot: 0 }];
  const n = 5;
  for (let k = 0; k < n; k++) {
    const y0 = (k / n) * H, y1 = ((k + 1) / n) * H, rot = rnd() * 0.8;
    rings.push({ y: y0, r: col(y0 / H) * 0.97, hex: mixHex(SI.crimson, ICE[0], 0.3 + 0.6 * (y0 / H) + 0.15 * (rnd() - 0.5)), rot });
    rings.push({ y: y1 - 0.01, r: col(y1 / H) * (0.93 - 0.04 * rnd()), hex: mixHex(ICE[0], ICE[1], rnd()), rot });
  }
  rings.push({ y: 1.04 * H, r: 0.25 * R, hex: ICE[0], rot: 0 });
  lathe(s, rings, sides, lm.seed + which, 0.06);
  return s;
}

function lintel(lm: Landmark): Soup {
  const s: Soup = { pos: [], hex: [] };
  const H = lm.height, R = lm.radius, rnd = mulberry(lm.seed + 4242);
  const n = 18, rise = 0.28 * H;
  const path = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, sn = Math.sin(Math.PI * t);
    path.push({
      x: t * lm.span, y: rise * Math.pow(sn, 0.7),
      r: R * (0.66 - 0.22 * sn) * (1 + 0.1 * (rnd() - 0.5)),
      hex: mixHex(ICE[0], ICE[1], 0.5 + 0.5 * Math.sin(t * 17)),
    });
  }
  tube(s, path, 8, lm.seed + 99, 0.1);
  return s;
}

// ---- crystal columns ----

function crystals(lm: Landmark): Soup {
  const s: Soup = { pos: [], hex: [] };
  const rnd = mulberry(lm.seed);
  const n = 6 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TWO_PI, d = i === 0 ? 0 : (0.25 + 0.4 * rnd()) * lm.radius;
    const h = lm.height * (i === 0 ? 1 : 0.35 + 0.6 * Math.pow(rnd(), 1.2));
    const r = lm.radius * (0.12 + 0.12 * rnd()) * (i === 0 ? 1.3 : 1);
    const lean = (i === 0 ? 0.05 : 0.12 + 0.25 * rnd()), la = rnd() * TWO_PI;
    const dx = Math.cos(la) * lean, dz = Math.sin(la) * lean;
    const ox = Math.cos(a) * d, oz = Math.sin(a) * d;
    const hex = ICE[Math.floor(rnd() * ICE.length)];
    const rings: Ring[] = [
      { y: -2, r, hex, cx: ox - 2 * dx, cz: oz - 2 * dz, rot: 0 },
      { y: 0.8 * h, r: r * 0.95, hex: mixHex(hex, ICE[0], 0.4), cx: ox + 0.8 * h * dx, cz: oz + 0.8 * h * dz, rot: 0 },
      { y: h, r: r * 0.02, hex: ICE[0], cx: ox + h * dx, cz: oz + h * dz, rot: 0 },
    ];
    lathe(s, rings, 6, lm.seed + i, 0.04);
  }
  return s;
}

// ---- carbon rock and shell ----

function reefPillar(lm: Landmark): Soup {
  const s: Soup = { pos: [], hex: [] };
  const rnd = mulberry(lm.seed);
  const H = lm.height, R = lm.radius, ph = rnd() * TWO_PI;
  const n = 12, sides = 9;
  const rings: Ring[] = [{ y: -0.2 * H, r: R * 1.5, hex: SHELL[2], rot: 0 }];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const cap = u > 0.88 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.88) / 0.12, 2))) : 1;     // domed top
    const r = R * (0.72 + 0.2 * Math.sin(u * Math.PI * 4 + ph) + 0.55 * Math.pow(1 - u, 4)) * cap;
    rings.push({ y: u * H, r: Math.max(0.05, r), hex: SHELL[i % SHELL.length], rot: 0.15 * i });
  }
  lathe(s, rings, sides, lm.seed, 0.12);
  return s;
}

function stromatolite(lm: Landmark): Soup {
  const s: Soup = { pos: [], hex: [] };
  const rnd = mulberry(lm.seed);
  const layers = 4 + Math.floor(rnd() * 2);
  const rings: Ring[] = [{ y: -0.25 * lm.height, r: lm.radius * 1.15, hex: SHELL[2], rot: 0 }];
  let y = 0;
  for (let k = 0; k < layers; k++) {
    const r = lm.radius * (1 - 0.17 * k), h = (lm.height / layers) * (0.8 + 0.4 * rnd()), rot = rnd();
    rings.push({ y, r: r * 0.95, hex: SHELL[k % SHELL.length], rot });
    rings.push({ y: y + 0.35 * h, r, hex: SHELL[(k + 1) % SHELL.length], rot });
    rings.push({ y: y + h, r: r * 0.78, hex: SHELL[(k + 2) % SHELL.length], rot });
    y += h;
  }
  rings.push({ y: y + 0.08 * lm.height, r: lm.radius * 0.12, hex: SHELL[0], rot: 0 });
  lathe(s, rings, 12, lm.seed, 0.1);
  return s;
}

function hoodoo(lm: Landmark): Soup {
  const s: Soup = { pos: [], hex: [] };
  const rnd = mulberry(lm.seed);
  const H = lm.height, R = lm.radius, ph = rnd() * TWO_PI;
  const rings: Ring[] = [{ y: -0.2 * H, r: R * 1.2, hex: ROCK[0], rot: 0 }];
  const stem = 8;
  for (let i = 0; i <= stem; i++) {
    const u = i / stem, y = u * 0.74 * H;
    rings.push({ y, r: R * (0.46 + 0.54 * Math.pow(1 - u, 2.2) + 0.07 * Math.sin(u * 20 + ph)), hex: ROCK[Math.floor(rnd() * ROCK.length)], rot: 0.3 * i });
  }
  const cap = [[0.77, 0.52], [0.8, 1.0], [0.88, 1.08], [0.96, 0.82], [1.0, 0.25]];
  cap.forEach(([u, r], i) => rings.push({ y: u * H, r: R * r, hex: i < 2 ? ROCK[2] : ROCK[4], rot: 0.3 * (stem + i) }));
  lathe(s, rings, 9, lm.seed, 0.14, ROCK[4]);
  return s;
}

/** Stepped strata: walls with ledges. `skirt` is a buried talus flare. Used by rock stacks (rough) and buttes (broad). */
function strata(lm: Landmark, o: { layers: [number, number]; sides: number; jitter: number; shrink: number; talus: number; palette: number[]; dark: number }): Soup {
  const s: Soup = { pos: [], hex: [] };
  const rnd = mulberry(lm.seed);
  const H = lm.height, R = lm.radius;
  const n = o.layers[0] + Math.floor(rnd() * (o.layers[1] - o.layers[0] + 1));
  const rings: Ring[] = [{ y: -0.25 * H, r: R * (1 + o.talus) * 1.1, hex: o.palette[2], rot: 0 }];
  // talus flare up to the first cliff
  rings.push({ y: 0.12 * H, r: R * (1 + 0.35 * o.talus), hex: mixHex(o.palette[1], o.dark, 0.5), rot: 0.2 });
  let y = 0.12 * H, r = R;
  for (let k = 0; k < n; k++) {
    const h = ((H - 0.12 * H) / n) * (0.7 + 0.6 * rnd()), nr = r * (1 - o.shrink * rnd());
    const col = o.palette[Math.floor(rnd() * o.palette.length)];
    const rot = rnd() * 0.5;
    rings.push({ y, r, hex: col, rot });
    rings.push({ y: Math.min(H, y + h) - 0.01, r: r * 0.98, hex: mixHex(col, 0xffffff, 0.18), rot });
    y = Math.min(H, y + h);
    r = nr;
    if (y >= H) break;
  }
  rings.push({ y: H, r: r * 0.97, hex: o.palette[0], rot: 0.1 });
  lathe(s, rings, o.sides, lm.seed, o.jitter, mixHex(o.palette[0], 0xffffff, 0.3));
  return s;
}

const rockStack = (lm: Landmark) => strata(lm, { layers: [4, 7], sides: 8, jitter: 0.1, shrink: 0.35, talus: 0.25, palette: ROCK, dark: C.maroon });
const butte = (lm: Landmark) => strata(lm, { layers: [8, 12], sides: 16, jitter: 0.05, shrink: 0.04, talus: 0.5, palette: [0xc9566a, 0xa8122a, 0x8a2840, 0xd98a8a, 0x5c0a1e], dark: C.maroon });

// ---- public ----

/** The pieces to draw for a landmark, in local space (arch: two piers at ±span/2 along x, and a lintel from the first pier's top). */
export function landmarkPieces(lm: Landmark): Piece[] {
  switch (lm.kind) {
    case 'iceSpire': return [{ kind: 'body', mesh: finish(spire(lm)), offset: [0, 0, 0] }];
    case 'iceArch': return [
      { kind: 'body', mesh: finish(archPier(lm, 0)), offset: [-lm.span / 2, 0, 0] },
      { kind: 'body', mesh: finish(archPier(lm, 1)), offset: [lm.span / 2, 0, 0] },
      { kind: 'lintel', mesh: finish(lintel(lm)), offset: [-lm.span / 2, 0.9 * lm.height, 0] },
    ];
    case 'crystalCluster': return [{ kind: 'body', mesh: finish(crystals(lm)), offset: [0, 0, 0] }];
    case 'reefPillar': return [{ kind: 'body', mesh: finish(reefPillar(lm)), offset: [0, 0, 0] }];
    case 'stromatolite': return [{ kind: 'body', mesh: finish(stromatolite(lm)), offset: [0, 0, 0] }];
    case 'hoodoo': return [{ kind: 'body', mesh: finish(hoodoo(lm)), offset: [0, 0, 0] }];
    case 'rockStack': return [{ kind: 'body', mesh: finish(rockStack(lm)), offset: [0, 0, 0] }];
    case 'butte': return [{ kind: 'body', mesh: finish(butte(lm)), offset: [0, 0, 0] }];
  }
}
