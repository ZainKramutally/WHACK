// The selection-screen particle box (CLAUDE.md "The particle box"): a pixel-art figure ported from
// mockups/selection-screen. Simulated on a 600-unit field, drawn at 150 px and upscaled with nearest-neighbour.
// Its own random stream, so playing with it never changes the demo run. What it shows comes from boxState().
import type { Conditions, WorldConfig } from '../../worlds/types';
import { crustMinerals } from './bedCrust';
import { boxState, MAX_N2, MAX_O2, type BoxState } from './boxState';

export const BOX_PAL = {
  water: ['#04202B', '#0A4C5E', '#0F7A8A', '#1BA8AE', '#5DDCCF', '#C4FFEE'],
  frost: ['#1E2C66', '#34549E', '#5C86CF', '#8FB6EC', '#CFE6FF', '#FFFFFF'],
  carbon: ['#7A1622', '#D2332A', '#FF6A3D', '#FFB08A'],
  silicon: ['#0B3A78', '#1B8FD6', '#3FE3F2', '#BFF8FF'],
  oxygen: ['#5C0E4E', '#BE1F86', '#FF4FB0', '#FFC0E6'],
  bone: ['#A8957C', '#D8CBB4', '#EFE6D4', '#FFFAEE'],
  spark: ['#FF7A00', '#FFB300', '#FFF2A0'],
  /** Bed grains per mineral id: dark, mid, light. Unknown ids fall back to `rock`. */
  crust: {
    basalt: ['#1F2A26', '#3A4A42', '#58695E'],
    ironstone: ['#4A1710', '#8C2A1C', '#B8402A'],
    granite: ['#8E8A84', '#C9C3B8', '#F2EEE4'],
    silicide: ['#4A525C', '#8794A3', '#CDD8E4'],
    nitride: ['#9A9484', '#CFC8B2', '#F4EEDA'],
    waterIce: ['#A9C2DA', '#D8E8F6', '#FFFFFF'],
    rock: ['#4A4A4A', '#808080', '#B8B8B8'],
  } as Record<string, string[]>,
  /** Where oxidising grains end up at full rust: basalt to rust red, silicide to grey-white silica. */
  crustRust: {
    basalt: ['#5A1E12', '#A8432A', '#D9694A'],
    ironstone: ['#6A2216', '#B8402A', '#D96A4E'],
    silicide: ['#B9B9B4', '#DCDCD6', '#F6F6F2'],
    rock: ['#6A3A2A', '#9A5A40', '#C98060'],
  } as Record<string, string[]>,
};
/** Sea ramp for a world: the solvent decides (water vs the frost ramp). */
export const seaRamp = (world: WorldConfig) => (world.solvent.solidSinks ? BOX_PAL.frost : BOX_PAL.water);

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const S = 600, LO = 150, K = LO / S;
/** Element atoms in the soup. About 3x the first version; tuned by eye for the 150 px figure. */
export const N_ATOMS = 80;
/** Neighbour grid cell: equals the bonding reach, so a 3x3 block of cells covers every candidate. */
const CELL = 32, GRID = Math.ceil(S / CELL);
/** Atoms closer than this (and not bonded) bounce off each other. */
const HARD = 18;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
interface Atom { x: number; y: number; vx: number; vy: number; b: number[]; rock: number; j: number }
interface Gas { x: number; y: number; vx: number; vy: number; a: number }

const CARBON_SPRITE = ['.11.', '1232', '1222', '.00.'];
const SILICON_SPRITE = ['..w..', '.w12.', 'w1210', '.110.', '..0..'];
const ROCK_SPRITE = ['123', '220', '100'];
/** Bed grain sprites (0 dark, 1 mid, 2 light); a few variants so the packed bed does not tile. */
const GRAIN_SPRITES = [['120', '011', '100'], ['011', '121', '010'], ['210', '110', '001']];
/** Bed geometry: grain size and rows in box pixels; BED_U is the same height in field units. */
const GRAIN = 3, BED_ROWS = 4, BED_PX = GRAIN * BED_ROWS, BED_U = BED_PX / K;
const BED_COLS = LO / GRAIN;

export interface Box {
  frame(now: number, dt: number, world: WorldConfig, cond: Conditions): BoxState;
  /** Particle positions as 0..1 fractions of the box, for the Generate transition. */
  seeds(): { x: number; y: number }[];
  /** Region tag for the liquid ("liquid water", "ice"...) and its vertical position (0..1), or null when dry. */
  liquidTag(world: WorldConfig): { text: string; y: number } | null;
  /** Region tag for the crust bed ("basalt · granite") and its vertical position (0..1), or null with no crust. */
  bedTag(world: WorldConfig): { text: string; y: number } | null;
}

export function createBox(canvas: HTMLCanvasElement, seed = 20261107): Box {
  const rnd = mulberry32(seed);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const atoms: Atom[] = Array.from({ length: N_ATOMS }, () => ({ x: 30 + rnd() * 540, y: 380 + rnd() * 190, vx: 0, vy: 0, b: [], rock: 0, j: rnd() < 0.5 ? 0 : 1 }));
  const solvent = Array.from({ length: 170 }, () => ({ x: rnd() * S, y: 380 + rnd() * 210, vx: 0, vy: 0 }));
  const gasN2: Gas[] = Array.from({ length: MAX_N2 }, () => ({ x: rnd() * S, y: rnd() * 320, vx: rnd() - 0.5, vy: rnd() - 0.5, a: rnd() * 6.28 }));
  const gasO2: Gas[] = Array.from({ length: MAX_O2 }, () => ({ x: rnd() * S, y: rnd() * 320, vx: rnd() - 0.5, vy: rnd() - 0.5, a: rnd() * 6.28 }));
  const flashes: { x: number; y: number; t: number }[] = [];
  let poolNow = 0.42;
  let lastTag: { text: string; y: number } | null = null;
  let lastBedTag: { text: string; y: number } | null = null;
  // The bed: each grain keeps a fixed draw (u picks its mineral from the live shares, v its sprite) and a displayed
  // colour that eases to the target, so switching element or oxygen recolours it over about half a second.
  interface Grain { u: number; v: number; h: number; cur: number[][] | null }
  const grains: Grain[] = Array.from({ length: BED_COLS * BED_ROWS }, () => ({ u: rnd(), v: Math.floor(rnd() * GRAIN_SPRITES.length), h: rnd(), cur: null }));
  const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbHex = (c: number[]) => (0xff000000 | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
  /** Which bed entry owns draw value u, by cumulative share in the order given. */
  function pickBed(st: BoxState, u: number) {
    let acc = 0;
    for (const b of st.bed) { acc += b.share; if (u < acc) return b; }
    return st.bed[st.bed.length - 1];
  }
  const floorY = S - 12 - BED_U;

  // Chain ids and sizes, computed in one pass per step (and patched on each new bond) instead of a BFS per pair.
  const comp = new Int32Array(N_ATOMS), compSize = new Int32Array(N_ATOMS), stack = new Int32Array(N_ATOMS);
  function labelChains() {
    comp.fill(-1);
    for (let i = 0; i < N_ATOMS; i++) {
      if (comp[i] >= 0) continue;
      let sp = 0, size = 0; stack[sp++] = i; comp[i] = i;
      while (sp) { const a = stack[--sp]; size++; for (const n of atoms[a].b) if (comp[n] < 0) { comp[n] = i; stack[sp++] = n; } }
      compSize[i] = size;
    }
  }
  const mergeChains = (ci: number, cj: number) => {
    compSize[ci] += compSize[cj];
    for (let k = 0; k < N_ATOMS; k++) if (comp[k] === cj) comp[k] = ci;
  };
  // Uniform grid: head[cell] -> first atom, nextIn[i] -> next atom in the same cell (-1 ends).
  const head = new Int32Array(GRID * GRID), nextIn = new Int32Array(N_ATOMS);
  const cellOf = (v: number) => clamp(Math.floor(v / CELL), 0, GRID - 1);
  function buildGrid() {
    head.fill(-1);
    for (let i = N_ATOMS - 1; i >= 0; i--) { const c = cellOf(atoms[i].y) * GRID + cellOf(atoms[i].x); nextIn[i] = head[c]; head[c] = i; }
  }
  /** Calls fn(j) for every atom in the 3x3 cells around atom i (including i itself). */
  function near(i: number, fn: (j: number) => boolean | void) {
    const cx = cellOf(atoms[i].x), cy = cellOf(atoms[i].y);
    for (let gy = Math.max(0, cy - 1); gy <= Math.min(GRID - 1, cy + 1); gy++)
      for (let gx = Math.max(0, cx - 1); gx <= Math.min(GRID - 1, cx + 1); gx++)
        for (let j = head[gy * GRID + gx]; j >= 0; j = nextIn[j]) if (fn(j)) return;
  }
  /** Elastic-ish bounce between unbonded atoms: push apart, and swap the approaching share of velocity. */
  function collide(i: number, j: number) {
    const a = atoms[i], o = atoms[j];
    if (a.b.includes(j)) return;
    let dx = o.x - a.x, dy = o.y - a.y;
    let d = Math.hypot(dx, dy);
    if (d >= HARD) return;
    if (d < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d = Math.hypot(dx, dy) || 1; }
    const nx = dx / d, ny = dy / d, push = (HARD - d) * 0.35;
    a.x -= nx * push; a.y -= ny * push; o.x += nx * push; o.y += ny * push;
    const vn = (a.vx - o.vx) * nx + (a.vy - o.vy) * ny;   // > 0 when approaching
    if (vn > 0) { const jn = vn * 0.95; a.vx -= nx * jn; a.vy -= ny * jn; o.vx += nx * jn; o.vy += ny * jn; }
  }
  const unbond = (i: number, j: number) => { atoms[i].b = atoms[i].b.filter((x) => x !== j); atoms[j].b = atoms[j].b.filter((x) => x !== i); };

  function step(st: BoxState, dt: number, isSi: boolean) {
    poolNow += (st.pool - poolNow) * Math.min(1, dt * 1.6);
    const yPool = S * (1 - poolNow);
    const frozenFx = st.effect === 'freeze';
    const speed = frozenFx ? 0.04 : 0.3 + 1.1 * st.heat;
    const kick = () => (rnd() - 0.5) * speed * 2.2;
    const nFrozen = Math.round(st.frozen * solvent.length);
    const cols = 30, sp = S / cols;
    solvent.forEach((p, k) => {
      if (k < nFrozen && st.phase !== 'gas') {
        const row = Math.floor(k / cols), col = k % cols;
        const ty = st.iceFloats ? yPool + 10 + row * sp * 0.8 : S - 10 - BED_U - row * sp * 0.8;
        p.x += (col * sp + sp / 2 - p.x) * 0.08; p.y += (ty - p.y) * 0.08; p.vx = p.vy = 0;
        return;
      }
      p.vx = (p.vx + kick()) * 0.86; p.vy = (p.vy + kick()) * 0.86;
      p.x += p.vx; p.y += p.vy;
      const top = st.phase === 'gas' || poolNow < 0.03 ? 4 : yPool + 6;
      if (p.x < 3) { p.x = 3; p.vx *= -1; } if (p.x > S - 3) { p.x = S - 3; p.vx *= -1; }
      if (p.y < top) { p.y = top + (st.phase === 'gas' ? 0 : (top - p.y) * 0.2); p.vy = Math.abs(p.vy); }
      if (p.y > S - 3 - BED_U) { p.y = S - 3 - BED_U; p.vy *= -1; }
    });
    const gasMove = (g: Gas) => {
      g.x += g.vx * (0.6 + speed); g.y += g.vy * (0.6 + speed); g.a += 0.03 * speed;
      const bottom = poolNow > 0.03 ? yPool - 8 : S - 8;
      if (g.x < 8 || g.x > S - 8) g.vx *= -1;
      if (g.y < 8) { g.y = 8; g.vy = Math.abs(g.vy); }
      if (g.y > bottom) { g.y = bottom; g.vy = -Math.abs(g.vy); }
      g.x = clamp(g.x, 8, S - 8);
    };
    for (let i = 0; i < st.n2Gas; i++) gasMove(gasN2[i]);
    for (let i = 0; i < st.o2Gas; i++) gasMove(gasO2[i]);
    const living = st.ok;
    const pForm = living || st.effect === 'starve' ? 0.05 : 0;
    const pBreak = living ? 0.0015 : st.effect === 'starve' ? 0.06 : st.effect === 'shakeApart' ? 0.25 : st.effect === 'dryUp' || st.effect === 'rust' ? 0.01 : 0;
    const maxLen = st.effect === 'starve' ? 2 : 6;
    const dry = st.phase === 'gas' || poolNow < 0.05;
    atoms.forEach((a, i) => {
      if (a.rock) {
        a.vy += 0.25; a.vx *= 0.9; a.x += a.vx; a.y += a.vy;
        if (a.y > floorY) { a.y = floorY; a.vy = 0; }
        if (st.effect !== 'rust' && rnd() < 0.004) a.rock = 0;
        return;
      }
      if (frozenFx) { a.vx = a.vy = 0; return; }
      if (dry) {
        a.vy += 0.3; a.vx = (a.vx + kick() * 0.8) * 0.9;
        a.x += a.vx; a.y += a.vy;
        if (a.y > floorY) { a.y = floorY; a.vy = -Math.abs(a.vy) * 0.35 - rnd() * speed * 1.4; }
      } else {
        a.vx = (a.vx + kick()) * 0.9; a.vy = (a.vy + kick()) * 0.9;
        for (const n of a.b) {
          const o = atoms[n], dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy) || 1;
          const f = (d - (isSi ? 28 : 24)) * 0.03;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        }
        a.x += a.vx; a.y += a.vy;
        const top = yPool + 14;
        if (a.y < top) { a.y = top; a.vy = Math.abs(a.vy); }
        if (a.y > floorY) { a.y = floorY; a.vy = -Math.abs(a.vy); }
      }
      if (a.x < 12) { a.x = 12; a.vx = Math.abs(a.vx); } if (a.x > S - 12) { a.x = S - 12; a.vx = -Math.abs(a.vx); }
      if (st.effect === 'rust') {
        for (let k = 0; k < st.o2Gas; k++) {
          const g = gasO2[k];
          if (Math.abs(g.x - a.x) < 40 && Math.abs(g.y - a.y) < 60 && rnd() < 0.02) { a.rock = 1; [...a.b].forEach((n) => unbond(i, n)); break; }
        }
      }
    });
    // The rock feeds life: now and then a feeding grain gives an atom up into the liquid. An existing free atom is
    // moved there, so the atom budget never grows. boxState.feeds is already 0 when frozen, dry or not living.
    const feed = st.bed.reduce((m, b) => Math.max(m, b.feeds), 0);
    if (feed > 0 && rnd() < feed * dt * 1.2) {
      const src = atoms.filter((a) => !a.rock && a.b.length === 0);
      const donors = grains.filter((g) => pickBed(st, g.u).feeds > 0 && g.h < 0.5);
      if (src.length && donors.length) {
        const g = donors[Math.floor(rnd() * donors.length)], a = src[Math.floor(rnd() * src.length)];
        const gi = grains.indexOf(g);
        a.x = clamp(((gi % BED_COLS) + 0.5) * GRAIN / K, 12, S - 12); a.y = floorY - 6; a.vx = 0; a.vy = -1.5;
        flashes.push({ x: a.x, y: floorY, t: 0.6 });
      }
    }
    buildGrid();
    if (!frozenFx) for (let i = 0; i < N_ATOMS; i++) near(i, (j) => { if (j > i) collide(i, j); });
    if (pBreak) atoms.forEach((a, i) => { [...a.b].forEach((n) => { if (n > i && rnd() < pBreak * dt * 60 * 0.2) unbond(i, n); }); });
    labelChains();
    if (pForm && !dry && !frozenFx) {
      for (let i = 0; i < N_ATOMS; i++) {
        const a = atoms[i];
        if (a.rock || a.b.length >= 2) continue;
        near(i, (j) => {
          const o = atoms[j];
          if (j <= i || o.rock || o.b.length >= 2 || a.b.includes(j)) return;
          if (Math.abs(o.x - a.x) > 32 || Math.abs(o.y - a.y) > 32) return;
          if (rnd() > pForm) return;
          const ci = comp[i], cj = comp[j];
          if (ci === cj || compSize[ci] + compSize[cj] > maxLen) return;
          a.b.push(j); o.b.push(i);
          mergeChains(ci, cj);
          return true;
        });
      }
    }
    if (living) {
      const done = new Set<number>();
      atoms.forEach((a, i) => {
        if (a.rock || done.has(comp[i])) return;
        done.add(comp[i]);
        if (compSize[comp[i]] >= 6 && rnd() < 0.005) {
          const ends: number[] = [];
          for (let k = 0; k < N_ATOMS; k++) if (comp[k] === comp[i] && atoms[k].b.length === 1) ends.push(k);
          if (!ends.length) return;
          let prev = -1, cur = ends[0];
          for (let s = 0; s < 2; s++) { const next = atoms[cur].b.find((n) => n !== prev); if (next === undefined) return; prev = cur; cur = next; }
          const nxt = atoms[cur].b.find((n) => n !== prev);
          if (nxt === undefined) return;
          unbond(cur, nxt);
          flashes.push({ x: (atoms[cur].x + atoms[nxt].x) / 2, y: (atoms[cur].y + atoms[nxt].y) / 2, t: 0 });
        }
      });
    }
    return yPool;
  }

  const px = (v: number) => Math.round(v * K);
  // One frame buffer, written through a Uint32Array and put on the canvas once per frame. Colours pack to ABGR ints
  // (little-endian RGBA) once per distinct string; the bed passes ints directly.
  const img = ctx.createImageData(LO, LO), buf = new Uint32Array(img.data.buffer);
  const packed = new Map<string, number>();
  const pack = (col: string) => {
    let v = packed.get(col);
    if (v === undefined) {
      const m = col.startsWith('#') ? [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16)) : col.match(/\d+/g)!.map(Number);
      v = (0xff000000 | (m[2] << 16) | (m[1] << 8) | m[0]) >>> 0;
      packed.set(col, v);
    }
    return v;
  };
  const dot = (x: number, y: number, col: string | number, w = 1, h = 1) => {
    const c = typeof col === 'number' ? col : pack(col);
    const x1 = Math.min(LO, x + w), y1 = Math.min(LO, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) for (let xx = Math.max(0, x); xx < x1; xx++) buf[yy * LO + xx] = c;
  };
  function sprite(cx: number, cy: number, rows: string[], cols: Record<string, string>) {
    const h = rows.length, w = rows[0].length, ox = cx - (w >> 1), oy = cy - (h >> 1);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const k = rows[r][c]; if (k !== '.') dot(ox + c, oy + r, cols[k]); }
  }
  function line(x0: number, y0: number, x1: number, y1: number, col: string, thick: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) dot(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col, thick, thick);
  }
  function ring(cx: number, cy: number, r: number, col: string) {
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; dot(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), col); }
  }

  let lastDt = 0.016;
  function draw(st: BoxState, yPoolS: number, now: number, world: WorldConfig) {
    const isSi = world.id === 'silicon';
    const F = seaRamp(world);
    const loop = (now % 12000) / 12000;
    const yP = poolNow > 0.01 ? px(yPoolS) : LO;
    dot(0, 0, F[3], LO, Math.max(0, Math.round(yP * 0.45)));
    dot(0, Math.round(yP * 0.45), F[4], LO, Math.max(0, yP - Math.round(yP * 0.45)));
    if (poolNow > 0.01) {
      const depth = LO - yP;
      dot(0, yP, isSi ? F[3] : F[2], LO, depth);
      dot(0, yP + Math.round(depth * 0.62), isSi ? F[2] : F[1], LO, depth);
      if (st.frozen < 1) {
        for (let x = 0; x < LO; x++) dot(x, yP + (Math.sin(x * 0.25 + loop * Math.PI * 2 * 3) > 0.6 ? -1 : 0), F[4]);
        for (let k = 0; k < 6; k++) dot(Math.round((k * 27 + loop * LO * 2) % LO), yP + 2 + (k % 3) * 3, F[5], 2, 1);
      } else dot(0, yP, F[4], LO, 1);
    }
    const nFrozen = Math.round(st.frozen * solvent.length);
    const gasPhase = st.phase === 'gas' || poolNow < 0.03;
    solvent.forEach((p, k) => {
      const x = px(p.x), y = px(p.y);
      if (k < nFrozen && st.phase !== 'gas') { dot(x - 1, y - 1, F[5], 2, 2); dot(x + 1, y, F[3]); return; }
      dot(x, y, gasPhase ? F[1] : F[5]);
    });
    // Crust bed: packed grains along the bottom rows, coloured by mineral and eased towards their target each frame.
    if (st.bed.length) {
      const palOf = (b: { id: string; rust: number }) => {
        const base = BOX_PAL.crust[b.id] ?? BOX_PAL.crust.rock, rusted = BOX_PAL.crustRust[b.id] ?? BOX_PAL.crustRust.rock;
        return base.map((h, i) => { const a = hexRgb(h), z = hexRgb(rusted[i]); return a.map((v, k) => v + (z[k] - v) * b.rust); });
      };
      const ease = 1 - Math.exp(-lastDt * 6);
      grains.forEach((g, gi) => {
        const col = gi % BED_COLS, row = Math.floor(gi / BED_COLS);
        const b = pickBed(st, g.u), tgt = palOf(b);
        if (!g.cur) g.cur = tgt.map((c) => [...c]);
        else g.cur.forEach((c, i) => { for (let k = 0; k < 3; k++) c[k] += (tgt[i][k] - c[k]) * ease; });
        const x0 = col * GRAIN, y0 = LO - BED_PX + row * GRAIN;
        const sp = GRAIN_SPRITES[g.v], cols = g.cur.map(rgbHex);
        for (let r = 0; r < GRAIN; r++) for (let c = 0; c < GRAIN; c++) dot(x0 + c, y0 + r, cols[+sp[r][c]]);
      });
    }
    const pair = (g: Gas, col: string) => { const dx = Math.round(Math.cos(g.a) * 1.4), dy = Math.round(Math.sin(g.a) * 1.4); const x = px(g.x), y = px(g.y); dot(x - dx, y - dy, col); dot(x + dx, y + dy, col); };
    for (let i = 0; i < st.n2Gas; i++) pair(gasN2[i], F[1]);
    for (let i = 0; i < st.o2Gas; i++) pair(gasO2[i], BOX_PAL.oxygen[2]);
    atoms.forEach((a, i) => a.b.forEach((n) => {
      if (n < i) return;
      const o = atoms[n];
      if (isSi) line(px(a.x), px(a.y), px(o.x), px(o.y), BOX_PAL.silicon[2], 1);
      else line(px(a.x) - 1, px(a.y) - 1, px(o.x) - 1, px(o.y) - 1, BOX_PAL.carbon[1], 2);
    }));
    atoms.forEach((a) => {
      const x = px(a.x), y = px(a.y);
      if (a.rock) { sprite(x, y, ROCK_SPRITE, { 0: BOX_PAL.bone[0], 1: BOX_PAL.bone[1], 2: BOX_PAL.bone[2], 3: BOX_PAL.bone[3] }); return; }
      if (isSi) sprite(x, y, SILICON_SPRITE, { 0: BOX_PAL.silicon[0], 1: BOX_PAL.silicon[1], 2: BOX_PAL.silicon[2], w: '#FFFFFF' });
      else sprite(x + (Math.sin(now * 0.004 + a.j * 3) > 0.7 ? 1 : 0), y, CARBON_SPRITE, { 0: BOX_PAL.carbon[0], 1: BOX_PAL.carbon[1], 2: BOX_PAL.carbon[2], 3: BOX_PAL.carbon[3] });
    });
    for (let k = flashes.length - 1; k >= 0; k--) {
      const f = flashes[k];
      f.t += 0.03;
      if (f.t >= 1) { flashes.splice(k, 1); continue; }
      const x = px(f.x), y = px(f.y), r = 2 + Math.round(f.t * 6);
      dot(x, y, BOX_PAL.spark[2]);
      ring(x, y, r, BOX_PAL.spark[1]);
      if (r > 3) ring(x, y, r + 1, BOX_PAL.spark[0]);
    }
    const bedNames = st.bed.filter((b) => b.share >= 0.15).sort((a, b) => b.share - a.share).slice(0, 2)
      .map((b) => (crustMinerals(world).find((m) => m.id === b.id)?.label ?? b.id).replace(/ \(.*\)/, '').toLowerCase());
    lastBedTag = bedNames.length ? { text: bedNames.join(' · '), y: 1 - BED_PX / 2 / LO } : null;
    lastTag = poolNow > 0.06
      ? { text: `${st.frozen >= 1 ? (st.iceFloats ? 'ice' : 'solid') : 'liquid'} ${st.frozen >= 1 && st.iceFloats ? '' : world.solvent.name.toLowerCase().replace(/^liquid /, '')}`.trim(), y: yP / LO }
      : null;
  }

  return {
    frame(now, dt, world, cond) {
      const st = boxState(world, cond);
      lastDt = dt;
      const yPool = step(st, dt, world.solvent.solidSinks);
      draw(st, yPool, now, world);
      ctx.putImageData(img, 0, 0);
      return st;
    },
    seeds: () => [...atoms, ...solvent].map((p) => ({ x: p.x / S, y: p.y / S })),
    liquidTag: () => lastTag,
    bedTag: () => lastBedTag,
  };
}
