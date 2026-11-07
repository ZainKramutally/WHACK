// The selection-screen particle box (CLAUDE.md "The particle box"): a pixel-art figure ported from
// mockups/selection-screen. Simulated on a 600-unit field, drawn at 150 px and upscaled with nearest-neighbour.
// Its own random stream, so playing with it never changes the demo run. What it shows comes from boxState().
import type { Conditions, WorldConfig } from '../../worlds/types';
import { boxState, MAX_N2, MAX_O2, type BoxState } from './boxState';

export const BOX_PAL = {
  water: ['#04202B', '#0A4C5E', '#0F7A8A', '#1BA8AE', '#5DDCCF', '#C4FFEE'],
  frost: ['#1E2C66', '#34549E', '#5C86CF', '#8FB6EC', '#CFE6FF', '#FFFFFF'],
  carbon: ['#7A1622', '#D2332A', '#FF6A3D', '#FFB08A'],
  silicon: ['#0B3A78', '#1B8FD6', '#3FE3F2', '#BFF8FF'],
  oxygen: ['#5C0E4E', '#BE1F86', '#FF4FB0', '#FFC0E6'],
  bone: ['#A8957C', '#D8CBB4', '#EFE6D4', '#FFFAEE'],
  spark: ['#FF7A00', '#FFB300', '#FFF2A0'],
};
/** Sea ramp for a world: the solvent decides (water vs the frost ramp). */
export const seaRamp = (world: WorldConfig) => (world.solvent.solidSinks ? BOX_PAL.frost : BOX_PAL.water);

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const S = 600, LO = 150, K = LO / S;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
interface Atom { x: number; y: number; vx: number; vy: number; b: number[]; rock: number; j: number }
interface Gas { x: number; y: number; vx: number; vy: number; a: number }

const CARBON_SPRITE = ['.11.', '1232', '1222', '.00.'];
const SILICON_SPRITE = ['..w..', '.w12.', 'w1210', '.110.', '..0..'];
const ROCK_SPRITE = ['123', '220', '100'];

export interface Box {
  frame(now: number, dt: number, world: WorldConfig, cond: Conditions): BoxState;
  /** Particle positions as 0..1 fractions of the box, for the Generate transition. */
  seeds(): { x: number; y: number }[];
  /** Region tag for the liquid ("liquid water", "ice"...) and its vertical position (0..1), or null when dry. */
  liquidTag(world: WorldConfig): { text: string; y: number } | null;
}

export function createBox(canvas: HTMLCanvasElement, seed = 20261107): Box {
  const rnd = mulberry32(seed);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const atoms: Atom[] = Array.from({ length: 26 }, () => ({ x: 90 + rnd() * 420, y: 400 + rnd() * 150, vx: 0, vy: 0, b: [], rock: 0, j: rnd() < 0.5 ? 0 : 1 }));
  const solvent = Array.from({ length: 170 }, () => ({ x: rnd() * S, y: 380 + rnd() * 210, vx: 0, vy: 0 }));
  const gasN2: Gas[] = Array.from({ length: MAX_N2 }, () => ({ x: rnd() * S, y: rnd() * 320, vx: rnd() - 0.5, vy: rnd() - 0.5, a: rnd() * 6.28 }));
  const gasO2: Gas[] = Array.from({ length: MAX_O2 }, () => ({ x: rnd() * S, y: rnd() * 320, vx: rnd() - 0.5, vy: rnd() - 0.5, a: rnd() * 6.28 }));
  const flashes: { x: number; y: number; t: number }[] = [];
  let poolNow = 0.42;
  let lastTag: { text: string; y: number } | null = null;

  const chainOf = (i: number) => {
    const seen = new Set([i]), stack = [i];
    while (stack.length) { const a = stack.pop()!; for (const n of atoms[a].b) if (!seen.has(n)) { seen.add(n); stack.push(n); } }
    return seen;
  };
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
        const ty = st.iceFloats ? yPool + 10 + row * sp * 0.8 : S - 10 - row * sp * 0.8;
        p.x += (col * sp + sp / 2 - p.x) * 0.08; p.y += (ty - p.y) * 0.08; p.vx = p.vy = 0;
        return;
      }
      p.vx = (p.vx + kick()) * 0.86; p.vy = (p.vy + kick()) * 0.86;
      p.x += p.vx; p.y += p.vy;
      const top = st.phase === 'gas' || poolNow < 0.03 ? 4 : yPool + 6;
      if (p.x < 3) { p.x = 3; p.vx *= -1; } if (p.x > S - 3) { p.x = S - 3; p.vx *= -1; }
      if (p.y < top) { p.y = top + (st.phase === 'gas' ? 0 : (top - p.y) * 0.2); p.vy = Math.abs(p.vy); }
      if (p.y > S - 3) { p.y = S - 3; p.vy *= -1; }
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
        if (a.y > S - 12) { a.y = S - 12; a.vy = 0; }
        if (st.effect !== 'rust' && rnd() < 0.004) a.rock = 0;
        return;
      }
      if (frozenFx) { a.vx = a.vy = 0; return; }
      if (dry) {
        a.vy += 0.3; a.vx = (a.vx + kick() * 0.8) * 0.9;
        a.x += a.vx; a.y += a.vy;
        if (a.y > S - 12) { a.y = S - 12; a.vy = -Math.abs(a.vy) * 0.35 - rnd() * speed * 1.4; }
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
        if (a.y > S - 12) { a.y = S - 12; a.vy = -Math.abs(a.vy); }
      }
      if (a.x < 12) { a.x = 12; a.vx = Math.abs(a.vx); } if (a.x > S - 12) { a.x = S - 12; a.vx = -Math.abs(a.vx); }
      if (st.effect === 'rust') {
        for (let k = 0; k < st.o2Gas; k++) {
          const g = gasO2[k];
          if (Math.abs(g.x - a.x) < 40 && Math.abs(g.y - a.y) < 60 && rnd() < 0.02) { a.rock = 1; [...a.b].forEach((n) => unbond(i, n)); break; }
        }
      }
    });
    if (pBreak) atoms.forEach((a, i) => { [...a.b].forEach((n) => { if (n > i && rnd() < pBreak * dt * 60 * 0.2) unbond(i, n); }); });
    if (pForm && !dry && !frozenFx) {
      for (let i = 0; i < atoms.length; i++) {
        const a = atoms[i];
        if (a.rock || a.b.length >= 2) continue;
        for (let j = i + 1; j < atoms.length; j++) {
          const o = atoms[j];
          if (o.rock || o.b.length >= 2 || a.b.includes(j)) continue;
          if (Math.abs(o.x - a.x) > 32 || Math.abs(o.y - a.y) > 32) continue;
          if (rnd() > pForm) continue;
          const ca = chainOf(i);
          if (ca.has(j) || ca.size + chainOf(j).size > maxLen) continue;
          a.b.push(j); o.b.push(i);
          break;
        }
      }
    }
    if (living) {
      const done = new Set<number>();
      atoms.forEach((a, i) => {
        if (done.has(i) || a.rock) return;
        const ch = chainOf(i);
        ch.forEach((k) => done.add(k));
        if (ch.size >= 6 && rnd() < 0.005) {
          const ends = [...ch].filter((k) => atoms[k].b.length === 1);
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
  const dot = (x: number, y: number, col: string, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
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
    lastTag = poolNow > 0.06
      ? { text: `${st.frozen >= 1 ? (st.iceFloats ? 'ice' : 'solid') : 'liquid'} ${st.frozen >= 1 && st.iceFloats ? '' : world.solvent.name.toLowerCase().replace(/^liquid /, '')}`.trim(), y: yP / LO }
      : null;
  }

  return {
    frame(now, dt, world, cond) {
      const st = boxState(world, cond);
      const yPool = step(st, dt, world.solvent.solidSinks);
      draw(st, yPool, now, world);
      return st;
    },
    seeds: () => [...atoms, ...solvent].map((p) => ({ x: p.x / S, y: p.y / S })),
    liquidTag: () => lastTag,
  };
}
