// Copied from mockups/red-world/src/fauna/aquatic/ (never imported; docs/features/aquatic-life.md). Edits for the app: imports only.
// buildSwimmer(params, seed): pure. Turns SwimmerParams into a Swimmer: a fixed geometry template (tubes = lofted
// bodies/bells, sheets = fin membranes, parts = instances of shared part geometry) and a pose function of
// (t, path, instance) that fills them each frame. Same (params, seed) → same swimmer and the same pose at every t.
//   carbon (axial): a follow-the-leader spine along the path with a travelling body wave (motion.ts), banking into
//     curves, a slow buoyancy bob; fins, lobes, crest, eyes, feelers and glow dots ride the spine frames.
//   silicon (radial): a faceted crystal hub whose rod arms row in stepped 15° beats, or faceted bells (alone or a
//     colony chain) that jet-pulse in sequence; dot eyes at the tips, glow from darkness; never bilateral.
import type { LookKey as PaletteKey } from '../../palette';
import { add, cross, dot, len, lerp3, norm, rotate, scl, sub, type Path, type V3 } from './v3';
import { advance, armAngle, bellPulse, bodyWave, finRipple, kinematics, STEP_DEG, type Kinematics } from './motion';
import { normaliseParams, type SwimmerParams } from './params';

export type SwimPart = 'eye' | 'dot' | 'rod' | 'rodSi' | 'blade' | 'bladeSi' | 'plate' | 'crystal' | 'ring';
export const SWIM_PARTS: SwimPart[] = ['eye', 'dot', 'rod', 'rodSi', 'blade', 'bladeSi', 'plate', 'crystal', 'ring'];

/** A lofted tube: `rings` cross-sections of `sides` vertices; flat = faceted (silicon), open = no end caps (bells). */
export interface TubeSpec { rings: number; sides: number; flat: boolean; colour: PaletteKey; translucent: boolean; glow: number; theta0: number }
/** A fin membrane: a strip of `cols` columns from base line to tip line. */
export interface SheetSpec { cols: number; colour: PaletteKey; translucent: boolean; glow: number }

export interface SwimSink {
  /** top (optional) scales the upper half-height: < 1 gives a flat back over a deep belly. */
  tube(i: number, c: V3[], U: V3[], R: V3[], rw: number[], rh: number[], top?: number): void;
  sheet(i: number, a: V3[], b: V3[]): void;
  /** Origin and three scaled basis axes (columns of the instance matrix); band 0 → colour a, band 1 → colour b.
   *  The basis must be right-handed (x × y along +z): the material flips back-facing normals, so a mirrored basis
   *  would shade inside-out. */
  part(type: SwimPart, o: V3, x: V3, y: V3, z: V3, a: PaletteKey, b: PaletteKey, glow: number, translucent: boolean): void;
}

/** Per individual: start distance along its path, a time phase, a school offset (m, across/up the path) and its index. */
export interface SwimInstance { s0: number; phase: number; off: [number, number]; k: number }

export interface Swimmer {
  params: SwimmerParams;
  seed: number;
  kin: Kinematics;
  /** Actual body length after seeded jitter (m). */
  L: number;
  /** Rough bounding radius (m) including trailing parts, for spacing. */
  extent: number;
  /** Radius of the main body (m), for close-up framing. */
  frameR: number;
  tubes: TubeSpec[];
  sheets: SheetSpec[];
  /** Pose at time t: fills tubes and sheets and emits parts. Returns the body centre and travel direction. */
  pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink): { centre: V3; forward: V3 };
}

const UP: V3 = [0, 1, 0];
const D2R = Math.PI / 180;
const cl = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const ss = (a: number, b: number, x: number) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const snap = (rad: number, deg: number) => Math.round(rad / (deg * D2R)) * deg * D2R;

/** mulberry32: deterministic stream in [0, 1). */
function rng(seed: number) {
  let a = (seed >>> 0) ^ 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frame from a forward vector, up toward world up. */
function frameOf(T: V3, up: V3 = UP): { U: V3; R: V3 } {
  const ref: V3 = Math.abs(dot(T, up)) > 0.97 ? [1, 0, 0] : up;
  const U = norm(sub(ref, scl(T, dot(ref, T))));
  return { U, R: cross(T, U) };
}

/** Basis whose y runs a → b with radius r across, x toward `hint`. */
function bone(sink: SwimSink, type: SwimPart, a: V3, b: V3, r: number, hint: V3, ca: PaletteKey, cb: PaletteKey, glow = 0, tr = false) {
  const y = sub(b, a), yn = norm(y);
  let x = sub(hint, scl(yn, dot(hint, yn)));
  if (len(x) < 1e-6) x = Math.abs(yn[1]) < 0.9 ? cross(yn, UP) : cross(yn, [1, 0, 0]);
  x = norm(x);
  sink.part(type, a, scl(x, r), y, scl(cross(x, yn), r), ca, cb, glow, tr);
}

/** Blade part: root o, length along dir, chord along `chordDir` (re-orthogonalised), thin across. */
function blade(sink: SwimSink, type: SwimPart, o: V3, dir: V3, length: number, chordDir: V3, chord: number, ca: PaletteKey, cb: PaletteKey, glow: number, tr: boolean) {
  const y = norm(dir);
  let x = sub(chordDir, scl(y, dot(chordDir, y)));
  if (len(x) < 1e-6) x = cross(y, UP);
  x = norm(x);
  const z = cross(x, y);
  sink.part(type, o, scl(x, chord), scl(y, length), scl(z, Math.max(chord, length) * 0.04), ca, cb, glow, tr);
}

/** Plesiosaur flipper: the fin part as a hydrofoil (thickness and camber scale with the chord, not squashed flat like a
 *  fish fin). The left one runs its chord forward from the trailing edge so z = x × y points up on both sides: both
 *  arch the same way with a right-handed basis. */
function flipper(sink: SwimSink, root: V3, spanDir: V3, span: number, chordDir: V3, chord: number, sd: number, ca: PaletteKey, cb: PaletteKey) {
  const y = norm(spanDir);
  let x = sub(chordDir, scl(y, dot(chordDir, y)));
  if (len(x) < 1e-6) x = cross(y, UP);
  x = norm(x);
  const o = sd > 0 ? root : add(root, scl(x, chord));
  if (sd < 0) x = scl(x, -1);
  sink.part('blade', o, scl(x, chord), scl(y, span), scl(cross(x, y), chord), ca, cb, 0, false);
}

function dotPart(sink: SwimSink, o: V3, r: number, glow: number, key: PaletteKey = 'glow') {
  sink.part('dot', o, [r, 0, 0], [0, r, 0], [0, 0, r], key, key, glow, false);
}

/** Banking roll (rad) from path curvature at s: lean into the turn, up toward the turn centre. */
function bankAt(path: Path, s: number, L: number, speed: number): number {
  const d = Math.max(0.25, 0.3 * L);
  const a = path.at(s).t, b = path.at(s + d).t;
  const h0 = Math.atan2(a[2], a[0]), h1 = Math.atan2(b[2], b[0]);
  let dh = h1 - h0;
  if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
  const kappa = -dh / d; // > 0: left turn (x → −z)
  const lean = Math.atan((speed * speed * kappa) / 2.5 + 0.6 * kappa * L);
  return -cl(lean, -0.75, 0.75);
}

// ---- spine (axial) ---------------------------------------------------------------------------------------------
interface SpineS { u: number[]; P: V3[]; T: V3[]; U: V3[]; R: V3[] }
function spineAt(sp: SpineS, u: number): { p: V3; T: V3; U: V3; R: V3 } {
  const n = sp.u.length - 1, u0 = sp.u[0], du = sp.u[1] - sp.u[0];
  const x = cl((u - u0) / du, 0, n), i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const p0 = sp.P[Math.max(0, i - 1)], p1 = sp.P[i], p2 = sp.P[i + 1], p3 = sp.P[Math.min(n, i + 2)];
  // Catmull-Rom weights (hot path: no per-component closures)
  const f2 = f * f, f3 = f2 * f;
  const w0 = 0.5 * (-f + 2 * f2 - f3), w1 = 0.5 * (2 - 5 * f2 + 3 * f3), w2 = 0.5 * (f + 4 * f2 - 3 * f3), w3 = 0.5 * (f3 - f2);
  const p: V3 = [
    w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
    w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1],
    w0 * p0[2] + w1 * p1[2] + w2 * p2[2] + w3 * p3[2],
  ];
  const T = norm(lerp3(sp.T[i], sp.T[i + 1], f));
  const Ul = lerp3(sp.U[i], sp.U[i + 1], f);
  const U = norm(sub(Ul, scl(T, dot(Ul, T))));
  return { p, T, U, R: cross(T, U) };
}

/** Plesiosaur landmarks along the body (u): skull end, front girdle (neck end) and hind girdle (tail start). */
export function plesioMarks(p: SwimmerParams): { head: number; fore: number; hind: number } {
  const head = 0.07, fore = Math.min(0.6, head + p.neck), hind = Math.max(fore + 0.3, 1 - p.tailLen);
  return { head, fore, hind };
}

/** Body radius profile 0..1 at u (0 nose, 1 tail). */
function profile(p: SwimmerParams, u: number): number {
  const pk = p.peak;
  let r: number;
  if (p.plan === 'plesiosaur') {
    // snout → skull, a slim neck thickening into the shoulders, a barrel torso between the girdles, a tapering tail
    const { head: hd, fore: nE, hind: tS } = plesioMarks(p);
    if (u <= hd) return 0.42 * Math.sin((Math.PI / 2) * Math.min(1, u / (0.6 * hd))) ** 0.7;
    if (u <= nE) { const x = (u - hd) / Math.max(1e-6, nE - hd); return 0.42 - 0.12 * ss(0, 0.25, x) + 0.25 * ss(0.65, 1, x); }
    if (u <= tS) { const x = (u - nE) / Math.max(1e-6, tS - nE); return 0.55 + 0.45 * Math.sin(Math.PI * x) ** 0.6; }
    const x = (u - tS) / Math.max(1e-6, 1 - tS);
    return 0.52 * (1 - x) ** 1.1 + 0.03;
  }
  if (p.plan === 'ribbon') r = Math.sin((Math.PI / 2) * cl(u / 0.07, 0, 1)) ** 0.7 * (1 - 0.72 * ss(0.5, 1, u));
  else if (u < pk) r = Math.sin((Math.PI / 2) * (u / pk)) ** (p.plan === 'fusiform' ? 0.8 : 0.55);
  else r = Math.cos((Math.PI / 2) * ((u - pk) / (1 - pk))) ** (p.plan === 'segmented' ? 0.55 : p.plan === 'fusiform' ? 1.25 : 0.85) * 0.93 + 0.07 * (1 - u);
  if (p.plan === 'segmented') r *= 1 - 0.07 * (1 - Math.abs(Math.cos(Math.PI * u * (p.fins.lateral + 1))));
  return Math.max(0, r);
}

// ---- carbon: axial swimmer ---------------------------------------------------------------------------------------
function buildAxial(p: SwimmerParams, seed: number, jit: () => number): Omit<Swimmer, 'params' | 'seed'> {
  const L = p.length * (1 + 0.08 * (jit() - 0.5));
  const aspect = p.aspect * (1 + 0.08 * (jit() - 0.5));
  const P = { ...p, length: L, aspect };
  const kin = kinematics(P);
  const ribbon = p.plan === 'ribbon', plesio = p.plan === 'plesiosaur';
  const whip = p.tail === 'whip' ? 0.35 : 0;
  const NJ = ribbon ? 40 : 22, uMax = 1 + whip;
  const NR = ribbon ? 56 : 30;
  const rMax = (aspect * L) / 2;
  const rw = (u: number) => rMax * profile(P, u);
  const rh = (u: number) => rw(u) * P.depth;
  const topK = p.fins.ventral > 0.05 ? 0.62 : 1; // keeled bodies: flat back, deep belly (hatchet)
  const rhTop = (u: number) => rh(u) * topK;
  const tubes: TubeSpec[] = [{ rings: NR, sides: 14, flat: false, colour: p.colour.body, translucent: false, glow: 0, theta0: 0 }];
  const ringU = Array.from({ length: NR }, (_, i) => {
    const x = i / (NR - 1);
    return x < 0.12 ? 0.12 * (x / 0.12) ** 1.6 : x; // denser rings at the nose so it reads round
  });
  if (whip) tubes.push({ rings: 10, sides: 6, flat: false, colour: p.colour.body, translucent: false, glow: 0, theta0: 0 });
  const sheets: SheetSpec[] = [];
  const finTr = p.translucency > 0.35;
  const dorsal = p.fins.dorsal > 0 ? sheets.push({ cols: ribbon ? 44 : 14, colour: p.colour.accent, translucent: true, glow: 0 }) - 1 : -1;
  const ventral = p.fins.ventral > 0 ? sheets.push({ cols: 12, colour: p.colour.body, translucent: false, glow: 0 }) - 1 : -1;
  const dU: [number, number] = ribbon ? [0.035, 0.985] : [Math.max(0.12, p.peak - 0.04), Math.min(0.75, p.peak + 0.16)]; // a small dorsal fin
  const vU: [number, number] = [0.14, Math.min(0.78, p.peak + 0.4)];
  const fringeAmp = 0.12 + 0.45 * p.fins.fringe;
  // hatchet keel: rises fast behind the head, deepest in front, tapers back to the tail
  const keel = (x: number) => Math.max(1e-4, p.fins.ventral * L * Math.sin((Math.PI / 2) * Math.min(1, x * 3.2)) ** 0.6 * (1 - x) ** 1.1);
  const lobeSizes = Array.from({ length: p.fins.lateral }, (_, i) => {
    const x = p.fins.lateral === 1 ? 0.5 : i / (p.fins.lateral - 1);
    return p.fins.lateral >= 3 ? 0.55 + 0.45 * Math.sin(Math.PI * (0.15 + 0.7 * x)) : 1;
  });
  // plesiosaur flippers (static layout): the fore root chord starts at the front girdle, the hind one ends at the hind
  // girdle, so both roots lie along the torso; inset inside the flank along the whole root chord, so no root shows a gap
  const flippers = plesio ? (() => {
    const mk = plesioMarks(P), torso = mk.hind - mk.fore, span = p.fins.lateralSize * L;
    const cF = Math.min(0.17, 0.42 * torso), cH = Math.min(0.15, 0.42 * torso);
    return [
      { u: mk.fore + 0.02, chord: cF, span, lag: 0 },
      { u: mk.hind - 0.02 - cH, chord: cH, span: 0.85 * span, lag: 0.3 },
    ].map((f) => ({ u: f.u, chord: f.chord * L, span: f.span, lag: f.lag, inset: 0.8 * Math.min(rw(f.u), rw(f.u + f.chord)) }));
  })() : [];
  const extent = L * (0.6 + p.head.feelerLen * (p.head.feelers > 0 ? 0.5 : 0)) + whip * L;
  const glowK = p.glow;

  function pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink) {
    const ph = inst.phase;
    const s = inst.s0 + advance(kin, t);
    const bank = bankAt(path, s, L, kin.speed);
    const bobT = 2 * Math.PI * (t / (3.4 + 0.6 * Math.sin(seed)) + ph * 0.37);
    const bob = 0.03 * L * Math.sin(bobT), pitch = 0.025 * Math.sin(bobT + 1.1);
    const wander = inst.k > 0 ? 1 : 0;
    const ox = inst.off[0] + wander * 0.22 * L * Math.sin(0.31 * t + 7.1 * inst.k);
    const oy = inst.off[1] + wander * 0.16 * L * Math.sin(0.23 * t + 3.3 * inst.k) + bob;
    // spine joints along the path behind the head, then the travelling wave across the banked frame
    const sp: SpineS = { u: [], P: [], T: [], U: [], R: [] };
    for (let j = 0; j < NJ; j++) {
      const u = (j / (NJ - 1)) * uMax;
      const a = path.at(s - u * L);
      const f0 = frameOf(a.t);
      const U = rotate(f0.U, a.t, bank), R = rotate(f0.R, a.t, bank);
      const lat = L * bodyWave(kin, P.undulation, Math.min(u, 1.15), t, ph * 2 * Math.PI);
      const pp = add(add(add(a.p, scl(f0.R, ox)), scl(f0.U, oy + pitch * (0.4 - u) * L)), scl(R, lat));
      sp.u.push(u); sp.P.push(pp); sp.U.push(U); sp.R.push(R);
    }
    for (let j = 0; j < NJ; j++) {
      const T = norm(sub(sp.P[Math.max(0, j - 1)], sp.P[Math.min(NJ - 1, j + 1)]));
      const U = norm(sub(sp.U[j], scl(T, dot(sp.U[j], T))));
      sp.T.push(T); sp.U[j] = U; sp.R[j] = cross(T, U);
    }
    // body tube
    const c: V3[] = [], Us: V3[] = [], Rs: V3[] = [], W: number[] = [], H: number[] = [];
    for (const u of ringU) { const f = spineAt(sp, u); c.push(f.p); Us.push(f.U); Rs.push(f.R); W.push(rw(u)); H.push(rh(u)); }
    sink.tube(0, c, Us, Rs, W, H, topK);
    if (whip) {
      const c2: V3[] = [], U2: V3[] = [], R2: V3[] = [], W2: number[] = [];
      for (let i = 0; i < 10; i++) { const u = 0.97 + (uMax - 0.97) * (i / 9); const f = spineAt(sp, u); c2.push(f.p); U2.push(f.U); R2.push(f.R); W2.push(rw(0.97) * (1 - 0.9 * (i / 9))); }
      sink.tube(1, c2, U2, R2, W2, W2);
    }
    // dorsal sail: rippling membrane (oarfish), crest rays at the front
    if (dorsal >= 0) {
      const n = sheets[dorsal].cols, A: V3[] = [], B: V3[] = [];
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1), u = dU[0] + (dU[1] - dU[0]) * x;
        const f = spineAt(sp, u);
        const h = p.fins.dorsal * L * (ribbon ? (0.75 + 0.25 * Math.sin(Math.PI * x)) * (1 - 0.6 * ss(0.85, 1, x)) : Math.sin(Math.PI * x) ** 0.7);
        const th = finRipple(kin, u, t, fringeAmp, ph * 6.28);
        const base = add(f.p, scl(f.U, rhTop(u) * 0.8));
        // a fish's dorsal fin sweeps back (the eel ribbon's long fin stands upright)
        A.push(base); B.push(add(add(base, add(scl(f.U, h * Math.cos(th)), scl(f.R, h * Math.sin(th)))), scl(f.T, ribbon ? 0 : -0.6 * h)));
      }
      sink.sheet(dorsal, A, B);
      // fin rays: every other column, so the ripple reads as a row of tilting spines
      for (let i = 1; i < n - 1; i += ribbon ? 2 : 2) bone(sink, 'rod', A[i], B[i], Math.max(0.002, 0.0035 * L), sp.T[0], p.colour.accent, p.colour.accent);
    }
    // ventral keel (hatchet blade) with the photophore row along its edge
    if (ventral >= 0) {
      const n = sheets[ventral].cols, A: V3[] = [], B: V3[] = [];
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1), u = vU[0] + (vU[1] - vU[0]) * x;
        const f = spineAt(sp, u);
        const h = keel(x);
        const base = sub(f.p, scl(f.U, rh(u) * 0.85));
        A.push(base); B.push(sub(base, scl(f.U, h)));
      }
      sink.sheet(ventral, A, B);
    }
    if (p.photophores > 0) {
      const n = p.photophores;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n, u = vU[0] + (vU[1] - vU[0]) * x;
        const f = spineAt(sp, u);
        const h = p.fins.ventral > 0 ? keel(x) : 0;
        const o = sub(f.p, scl(f.U, rh(u) * 0.85 + h * 0.9));
        for (const sd of [-1, 1]) dotPart(sink, add(o, scl(f.R, sd * Math.max(rw(u) * 0.35, 0.004 * L))), Math.max(0.003, 0.009 * L), 0.25 + 0.45 * glowK);
      }
    }
    // lateral fins: a metachronal lobe fringe (≥ 3 pairs) or flapping pectoral paddles
    const nl = p.fins.lateral;
    if (ribbon && nl > 0) {
      // oarfish pelvic "oars": two long trailing rays from under the head, each ending in a paddle
      const f = spineAt(sp, 0.09);
      for (const sd of [-1, 1]) {
        let at = add(sub(f.p, scl(f.U, rh(0.09) * 0.8)), scl(f.R, sd * rw(0.09) * 0.6));
        let dir = norm(add(add(scl(f.T, -1), scl(f.U, -0.55)), scl(f.R, sd * 0.25)));
        const segs = 6, segL = (p.fins.lateralSize * 1.6 * L) / segs;
        for (let k = 0; k < segs; k++) {
          const nxt = add(at, scl(dir, segL));
          bone(sink, 'rod', at, nxt, Math.max(0.003, 0.004 * L), f.R, p.colour.accent, p.colour.accent);
          at = nxt;
          dir = norm(rotate(dir, f.R, 0.1 * Math.sin(2 * Math.PI * kin.freq * t - k * 0.8 + sd + ph)));
        }
        blade(sink, 'blade', at, dir, 0.035 * L, f.U, 0.02 * L, p.colour.accent, p.colour.body, glowK * 0.6, finTr);
      }
    }
    for (let i = 0; i < (ribbon || plesio ? 0 : nl); i++) {
      const lobes = nl >= 3;
      const u = lobes ? 0.16 + 0.66 * (nl === 1 ? 0.5 : i / (nl - 1)) : 0.2 + 0.25 * i;
      const f = spineAt(sp, u);
      const size = p.fins.lateralSize * L * lobeSizes[i];
      const spacing = lobes ? (0.66 / Math.max(1, nl - 1)) * L : size * 0.6;
      for (const sd of [-1, 1]) {
        const th = lobes ? finRipple(kin, u, t, 0.5, ph * 6.28 + (sd > 0 ? 0 : 0.35)) : 0.55 * Math.sin(2 * Math.PI * kin.freq * t * 0.8 + ph * 6.28 + (sd > 0 ? 0 : Math.PI * 0.15)) - 0.25;
        const out = scl(f.R, sd);
        const dir = norm(add(add(scl(out, Math.cos(th)), scl(f.U, Math.sin(th))), scl(f.T, lobes ? -0.35 : -0.55)));
        const root = add(f.p, add(scl(f.R, sd * rw(u) * 0.85), scl(f.U, lobes ? -rh(u) * 0.2 : -rh(u) * 0.35)));
        blade(sink, 'blade', root, dir, size, scl(f.T, -1), lobes ? Math.max(spacing * 1.9, size * 0.8) : size * 0.6, p.colour.accent, p.colour.body, 0, finTr);
      }
    }
    // plesiosaur flippers: four long hydrofoils rooted flush on the flanks at the girdles, flying underwater: each flaps
    // up and down with a pitch twist a quarter cycle ahead of the flap, and the hind pair lags the fore pair
    // (one stroke per stroke cycle, so the stroke rate follows the travel speed fauna.ts drives the phase with)
    const stroke = 2 * Math.PI * kin.freq * t + ph * 2 * Math.PI;
    for (const fl of flippers) {
      const f = spineAt(sp, fl.u);
      const a = stroke - 2 * Math.PI * fl.lag;
      const flap = 0.6 * Math.sin(a) - 0.12, pitch = 0.45 * Math.cos(a); // leading edge down on the downstroke
      for (const sd of [-1, 1]) {
        const spanDir = norm(add(add(scl(f.R, sd * Math.cos(flap)), scl(f.U, Math.sin(flap))), scl(f.T, -0.3)));
        const chordDir = rotate(scl(f.T, -1), spanDir, sd * pitch); // twist about the span axis
        const root = add(f.p, add(scl(f.R, sd * fl.inset), scl(f.U, -rh(fl.u) * 0.15)));
        flipper(sink, root, spanDir, fl.span, chordDir, fl.chord, sd, p.colour.accent, p.colour.body);
      }
    }
    // tail fins
    const tf = spineAt(sp, 0.995), tl = p.tailSize * L;
    const tip = tf.p;
    const back = scl(tf.T, -1);
    if (p.tail === 'fork' || p.tail === 'lunate') {
      const ang = p.tail === 'fork' ? 0.62 : 0.95;
      for (const sd of [-1, 1]) blade(sink, 'blade', tip, add(scl(back, Math.cos(ang)), scl(tf.U, sd * Math.sin(ang))), tl, back, tl * (p.tail === 'fork' ? 0.75 : 0.5), p.colour.accent, p.colour.body, 0, finTr);
    } else if (p.tail === 'fan') {
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
        const a = (0.25 + 0.32 * k) * sd;
        const fl = 0.08 * Math.sin(2 * Math.PI * kin.freq * t + k);
        blade(sink, 'blade', tip, add(add(scl(back, Math.cos(a)), scl(tf.R, Math.sin(a))), scl(tf.U, fl)), tl * (1 - 0.15 * k), tf.R, tl * 0.32, p.colour.accent, p.colour.body, 0, finTr);
      }
    }
    // head: eyes (in the head or on stalks), crest rays, feelers, mouth
    const hf = spineAt(sp, 0.07);
    const hw = rw(0.07), hh = rh(0.07);
    const ne = p.head.eyes, er = Math.min(p.head.eyeSize * L, 0.62 * Math.min(Math.max(hw, hh), 1.6 * Math.min(hw, hh)));
    const stalk = p.head.stalks * L;
    const eyeSlots: { side: number; up: number; fwd: number }[] = [];
    for (let i = 0; i < Math.floor(ne / 2); i++) eyeSlots.push({ side: -1, up: 0.25 + 0.5 * i, fwd: -0.12 * i }, { side: 1, up: 0.25 + 0.5 * i, fwd: -0.12 * i });
    if (ne % 2) eyeSlots.push({ side: 0, up: 1, fwd: 0.05 });
    for (const e of eyeSlots) {
      const upward = topK < 1 && stalk > 0; // deep-sea tubular eyes stare up
      const outDir = norm(add(add(scl(hf.R, e.side * (upward ? 0.35 : 0.9)), scl(hf.U, upward ? 1.2 : e.up * (stalk > 0 ? 1.1 : 0.55))), scl(hf.T, 0.15 + e.fwd)));
      const surf = add(hf.p, add(add(scl(hf.R, e.side * hw * (upward ? 0.55 : 0.82)), scl(hf.U, hh * topK * (e.side === 0 || upward ? 0.8 : 0.15 + 0.35 * e.up))), scl(hf.T, e.fwd * L * 0.4)));
      let at = surf;
      if (stalk > 0) {
        const sway = 0.12 * Math.sin(1.7 * t + e.side * 1.3 + e.up * 2 + ph);
        const sd = norm(add(outDir, scl(hf.T, sway)));
        at = add(surf, scl(sd, stalk * (e.side === 0 ? 1.15 : 1)));
        bone(sink, 'rod', surf, at, Math.max(0.004, er * 0.28), hf.T, p.colour.body, p.colour.body);
      }
      const z = norm(add(outDir, scl(hf.T, 0.35)));
      const { U: eu, R: eR } = frameOf(z, hf.U);
      sink.part('eye', at, scl(eR, -er), scl(eu, er), scl(z, er), 'ink', 'bone', 0, false); // −eR: right-handed (eR × eu = −z)
    }
    for (let i = 0; i < p.head.crest; i++) {
      const u = 0.03 + 0.012 * i;
      const f = spineAt(sp, u);
      const base = add(f.p, scl(f.U, rhTop(u) * 0.85));
      const lag = 0.25 * Math.sin(2 * Math.PI * kin.freq * 0.5 * t - i * 0.6 + ph);
      const dir = norm(add(add(scl(f.U, 1), scl(f.T, -0.55 - 0.1 * i)), scl(f.R, lag * 0.5)));
      const tipC = add(base, scl(dir, (0.07 + 0.012 * i) * L * (ribbon ? 1.4 : 1)));
      bone(sink, 'rod', base, tipC, Math.max(0.004, 0.006 * L), f.R, p.colour.accent, p.colour.accent);
      if (glowK > 0.05) dotPart(sink, tipC, Math.max(0.005, 0.008 * L), glowK);
    }
    const nf = p.head.feelers;
    for (let i = 0; i < nf; i++) {
      const side = nf === 1 ? 0 : (i % 2 ? 1 : -1) * (1 + Math.floor(i / 2) * 0.6);
      const f0 = spineAt(sp, 0.02);
      let at = add(f0.p, add(scl(f0.R, side * hw * 0.45), scl(f0.U, -hh * 0.35)));
      let dir = norm(add(add(f0.T, scl(f0.U, -0.35)), scl(f0.R, side * 0.25)));
      const segs = 8, segL = (p.head.feelerLen * L) / segs;
      const grasp = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 2.6 + i * 0.7 + ph);
      const axis = norm(cross(dir, f0.U)); // curl down and back under the head
      for (let k = 0; k < segs; k++) {
        const nxt = add(at, scl(dir, segL));
        const r = Math.max(0.004, 0.024 * L * (1 - 0.65 * (k / segs)) * (p.plan === 'segmented' ? 1 : 0.6));
        bone(sink, 'rod', at, nxt, r, f0.U, p.colour.accent, p.colour.accent);
        if (k > 1 && k % 2 === 0) { // inner spines
          const spike = norm(add(scl(f0.U, -1), scl(dir, 0.3)));
          bone(sink, 'rod', nxt, add(nxt, scl(spike, r * 3.2)), r * 0.35, dir, p.colour.body, p.colour.body);
        }
        at = nxt;
        dir = norm(rotate(dir, axis, -(0.2 + 0.28 * grasp) * (k / segs + 0.5)));
      }
    }
    if (p.head.mouth === 'cone') {
      const f = spineAt(sp, 0.09);
      const o = sub(f.p, scl(f.U, rh(0.09) * 0.75));
      const r = rw(0.09) * 0.45;
      sink.part('ring', o, scl(f.R, r), scl(f.U, r * 0.6), scl(f.T, -r), p.colour.accent, 'ink', 0, false); // R × U = −T
    } else if (p.head.mouth === 'proboscis') {
      const f0 = spineAt(sp, 0.0);
      let at = f0.p, dir = norm(add(f0.T, scl(f0.U, -0.2)));
      const segs = 6, segL = 0.32 * L / segs;
      for (let k = 0; k < segs; k++) {
        const nxt = add(at, scl(dir, segL));
        bone(sink, 'rod', at, nxt, Math.max(0.003, 0.012 * L), f0.U, p.colour.body, p.colour.body);
        at = nxt;
        dir = norm(rotate(dir, f0.R, -0.12 * Math.sin(1.3 * t + k * 0.5 + ph)));
      }
      for (const sd of [-1, 1]) blade(sink, 'blade', at, add(dir, scl(f0.U, 0.6 * sd)), 0.05 * L, dir, 0.02 * L, p.colour.accent, p.colour.accent, 0, false);
    } else if (p.head.mouth === 'jaw') {
      const f = spineAt(sp, 0.04);
      const o = sub(f.p, scl(f.U, rh(0.04) * 0.5));
      const gape = 0.12 + 0.1 * Math.sin(2 * Math.PI * kin.freq * 0.5 * t + ph);
      blade(sink, 'blade', o, norm(add(f.T, scl(f.U, -gape))), 0.12 * L, f.R, rw(0.04) * 1.2, p.colour.body, p.colour.accent, 0, false);
    }
    // lateral line glow and dorsal armour
    const nll = Math.round(p.lateralLine * (ribbon ? 22 : 14));
    for (let i = 0; i < nll; i++) {
      const u = 0.14 + 0.78 * (i / Math.max(1, nll - 1));
      const f = spineAt(sp, u);
      const pulse = 0.55 + 0.45 * Math.sin(2 * Math.PI * (0.6 * t - u * 1.5) + ph);
      for (const sd of [-1, 1]) dotPart(sink, add(f.p, scl(f.R, sd * rw(u) * 0.99)), Math.max(0.003, Math.min(0.008 * L, 0.11 * rh(u))), glowK * pulse * 0.8);
    }
    const np = Math.round(p.plates * 11);
    for (let i = 0; i < np; i++) {
      const u = 0.12 + 0.72 * ((i + 0.5) / np);
      const f = spineAt(sp, u);
      const w = rw(u) * 1.15, l = (0.72 / np) * L * 1.35;
      sink.part('plate', add(f.p, scl(f.U, rhTop(u) * 0.62)), scl(f.R, w), scl(f.U, rhTop(u) * 0.55 + 0.01 * L), scl(f.T, -l * 0.5), p.colour.body, p.colour.accent, 0, false);
    }
    const mid = spineAt(sp, 0.45);
    return { centre: mid.p, forward: mid.T };
  }
  return { kin, L, extent, frameR: 0.55 * L, tubes, sheets, pose };
}

// ---- silicon: radial hub rower -----------------------------------------------------------------------------------
function buildRower(p: SwimmerParams, seed: number, jit: () => number): Omit<Swimmer, 'params' | 'seed'> {
  const L = p.length * (1 + 0.08 * (jit() - 0.5));
  const P = { ...p, length: L };
  const kin = kinematics(P);
  const sym = p.radial.symmetry, T = p.radial.tiers;
  const sides = sym >= 5 ? sym : 2 * sym;
  const rMax = (p.aspect * L) / 2;
  // bipyramid of stepped tiers: front apex → T tiers (widest in the middle, quantised to quarters) → back apex
  const tierR = Array.from({ length: T }, (_, i) => {
    const x = T === 1 ? 0.5 : i / (T - 1);
    return rMax * Math.max(0.45, Math.round((0.55 + 0.45 * Math.sin(Math.PI * (0.15 + 0.7 * x))) * 4) / 4);
  });
  const ring: { u: number; r: number }[] = [{ u: 0, r: 0 }];
  const span = 0.6; // tiers fill the middle 60% of the axis
  for (let i = 0; i < T; i++) {
    const u0 = 0.2 + (span * i) / T, u1 = 0.2 + (span * (i + 1)) / T;
    ring.push({ u: u0, r: tierR[i] * 0.86 }, { u: u0 + 0.02, r: tierR[i] }, { u: u1 - 0.02, r: tierR[i] }, { u: u1, r: tierR[i] * 0.86 });
  }
  ring.push({ u: 1, r: 0 });
  const tr = p.translucency > 0.5;
  const tubes: TubeSpec[] = [{ rings: ring.length, sides, flat: true, colour: p.colour.body, translucent: tr, glow: 0, theta0: Math.PI / sides }];
  const armL = p.radial.armLen * L;
  const extent = Math.max(L * 0.6, armL * 1.1) + p.radial.trail * L;
  const glowK = p.glow;
  const nSpikes = Math.round(p.radial.spikes * 2 * sym);

  function pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink) {
    const ph = inst.phase;
    const s = inst.s0 + advance(kin, t, ph);
    const here = path.at(s);
    const Tf = here.t;
    const f0 = frameOf(Tf);
    const bank = bankAt(path, s, L, kin.speed) * 0.5;
    const roll = 0.22 * t + ph * 6.28 + bank; // it rolls slowly as it rows
    const U = rotate(f0.U, Tf, roll), R = rotate(f0.R, Tf, roll);
    const wander = inst.k > 0 ? 1 : 0;
    const bob = 0.04 * L * Math.sin(2 * Math.PI * (t / 4.1 + ph * 0.37));
    const ox = inst.off[0] + wander * 0.3 * L * Math.sin(0.27 * t + 5.3 * inst.k);
    const oy = inst.off[1] + wander * 0.25 * L * Math.sin(0.21 * t + 2.1 * inst.k) + bob;
    const phi = ((kin.freq * t + ph) % 1 + 1) % 1;
    const centre = add(add(here.p, scl(f0.R, ox)), scl(f0.U, oy));
    const nose = add(centre, scl(Tf, L / 2));
    const c: V3[] = [], Us: V3[] = [], Rs: V3[] = [], W: number[] = [];
    for (const rg of ring) { c.push(sub(nose, scl(Tf, rg.u * L))); Us.push(U); Rs.push(R); W.push(rg.r); }
    sink.tube(0, c, Us, Rs, W, W);
    // inner core glow (seen through translucent facets) and facet spikes
    const core = 0.4 * rMax;
    sink.part('crystal', centre, scl(R, core * 0.55), scl(Tf, core * 1.1), scl(U, core * 0.55), p.colour.accent, 'glow', glowK * 0.7, false);
    for (let i = 0; i < nSpikes; i++) {
      const tier = i % T, a = ((Math.floor(i / T) + 0.5) / Math.ceil(nSpikes / T)) * 2 * Math.PI + (tier % 2) * Math.PI / sym;
      const radial = add(scl(R, Math.cos(a)), scl(U, Math.sin(a)));
      const u = 0.2 + (span * (tier + 0.5)) / T;
      const o = add(sub(nose, scl(Tf, u * L)), scl(radial, tierR[tier] * 0.9));
      const sl = rMax * (0.5 + 0.6 * p.radial.spikes);
      sink.part('crystal', add(o, scl(radial, sl * 0.4)), scl(Tf, sl * 0.18), scl(radial, sl * 0.5), scl(cross(Tf, radial), sl * 0.18), p.colour.body, p.colour.accent, 0, tr);
    }
    // rowing arms: stepped 15° beats in the power stroke, folded feathered recovery
    const { deg, fold } = armAngle(kin, phi);
    const knee = snap((15 + 60 * fold) * D2R, STEP_DEG);
    const upper = armL * 0.55, lower = armL * 0.45;
    for (let k = 0; k < sym; k++) {
      const a = (2 * Math.PI * k) / sym;
      const radial = add(scl(R, Math.cos(a)), scl(U, Math.sin(a)));
      const tangent = cross(Tf, radial);
      const root = add(centre, scl(radial, rMax * 0.95));
      const d1 = norm(add(scl(Tf, Math.cos(deg * D2R)), scl(radial, Math.sin(deg * D2R))));
      const kneeP = add(root, scl(d1, upper));
      const d2 = norm(rotate(d1, tangent, knee)); // fold back toward the tail
      const tipP = add(kneeP, scl(d2, lower));
      const rr = Math.max(0.005, 0.026 * L);
      bone(sink, 'rodSi', root, kneeP, rr, tangent, p.colour.accent, p.colour.body);
      bone(sink, 'rodSi', kneeP, tipP, rr * 0.8, tangent, p.colour.accent, p.colour.body);
      sink.part('crystal', kneeP, scl(tangent, rr * 1.25), scl(d1, rr * 1.5), scl(cross(tangent, d1), rr * 1.25), p.colour.accent, p.colour.body, glowK * 0.12, false);
      // paddle: face-on to the stroke in power, feathered (turned 90°) in recovery
      const feather = snap(fold * 90 * D2R, STEP_DEG);
      const chord = rotate(tangent, d2, feather);
      blade(sink, 'bladeSi', sub(tipP, scl(d2, lower * 0.75)), d2, lower * 0.9, chord, lower * 0.75, p.colour.body, p.colour.accent, 0, false);
      // dot eyes at the arm tip
      const ne = Math.max(0, p.head.eyes);
      for (let e = 0; e < ne; e++) {
        const off = ne === 1 ? [0, 0] : [Math.cos((2 * Math.PI * e) / ne), Math.sin((2 * Math.PI * e) / ne)];
        const eo = add(add(tipP, scl(tangent, off[0] * rr * 1.3)), scl(cross(d2, tangent), off[1] * rr * 1.3));
        dotPart(sink, eo, Math.max(0.004, p.head.eyeSize * L * 0.45), 0.4 + 0.4 * glowK);
      }
      for (let f = 0; f < p.head.feelers; f++) {
        const fd = norm(rotate(d2, tangent, snap((f % 2 ? 1 : -1) * 30 * D2R, STEP_DEG)));
        bone(sink, 'rodSi', tipP, add(tipP, scl(fd, lower * 0.5)), rr * 0.4, tangent, p.colour.accent, p.colour.accent);
      }
    }
    // trailing lattice: stiff rods with 15° joints behind the hub
    if (p.radial.trail > 0) {
      const tail = sub(nose, scl(Tf, L));
      const nT = Math.max(2, Math.floor(sym / 2)), segs = 6, segL = (p.radial.trail * L) / segs;
      for (let k = 0; k < nT; k++) {
        const a = (2 * Math.PI * k) / nT + 0.3;
        const radial = add(scl(f0.R, Math.cos(a)), scl(f0.U, Math.sin(a)));
        let at = tail, dir = scl(Tf, -1);
        for (let j = 0; j < segs; j++) {
          const bend = snap((10 + 8 * Math.sin(0.9 * t - j * 0.7 + k)) * D2R * (j > 0 ? 1 : 0), STEP_DEG);
          dir = norm(rotate(dir, cross(dir, radial), -bend * 0.5));
          const nxt = add(at, scl(dir, segL));
          bone(sink, 'rodSi', at, nxt, Math.max(0.003, 0.012 * L), radial, p.colour.accent, p.colour.accent, 0);
          dotPart(sink, nxt, Math.max(0.004, 0.018 * L), glowK * (0.5 + 0.5 * Math.sin(2 * Math.PI * (0.8 * t - j / segs) + k)));
          at = nxt;
        }
      }
    }
    return { centre, forward: Tf };
  }
  return { kin, L, extent, frameR: 1.2 * (rMax + armL), tubes, sheets: [], pose };
}

// ---- silicon: faceted bell, alone or a siphonophore-like chain ---------------------------------------------------------
function buildBell(p: SwimmerParams, seed: number, jit: () => number): Omit<Swimmer, 'params' | 'seed'> {
  const H = p.length * (1 + 0.08 * (jit() - 0.5)); // one bell's height
  const P = { ...p, length: H };
  const kin = kinematics(P);
  const K = p.radial.chain, sym = p.radial.symmetry, T = p.radial.tiers;
  const sides = sym >= 5 ? sym : 2 * sym;
  const Rrim = (p.aspect * H) / 2;
  // bell profile: closed apex → stepped tiers → flared rim (quantised steps so it reads as a lattice of facets)
  const prof: { u: number; r: number }[] = [{ u: 0, r: 0 }];
  for (let i = 0; i < T; i++) {
    const r = Math.max(0.3, ((i + 1) / T) ** 0.7);
    const u0 = 0.06 + (0.84 * i) / T, u1 = 0.06 + (0.84 * (i + 1)) / T;
    prof.push({ u: u0, r: r * 0.8 }, { u: u0 + 0.01, r }, { u: u1, r });
  }
  prof.push({ u: 0.97, r: 1.06 }, { u: 1, r: 1.0 });
  const tubes: TubeSpec[] = [];
  for (let b = 0; b < K; b++) tubes.push({ rings: prof.length, sides, flat: true, colour: p.colour.body, translucent: true, glow: 0, theta0: Math.PI / sides });
  const gap = 1.08 * H;
  const lead = K > 1 ? 0.55 * H : 0;
  const chainLen = lead + K * gap;
  const extent = 0.5 * chainLen + p.radial.trail * H + Rrim;
  const glowK = p.glow;
  const combRows = sym, combDots = 4;

  function pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink) {
    const ph = inst.phase;
    const s = inst.s0 + advance(kin, t, ph, K);
    const wander = inst.k > 0 ? 1 : 0;
    const bob = 0.05 * H * Math.sin(2 * Math.PI * (t / 5.3 + ph * 0.37));
    const ox = inst.off[0] + wander * 0.25 * H * Math.sin(0.19 * t + 4.3 * inst.k);
    const oy = inst.off[1] + wander * 0.2 * H * Math.sin(0.17 * t + 1.7 * inst.k) + bob;
    const roll = 0.12 * t + ph * 6.28;
    const at = (d: number) => {
      const a = path.at(s - d);
      const f = frameOf(a.t);
      return { p: add(add(a.p, scl(f.R, ox)), scl(f.U, oy)), T: a.t, U: rotate(f.U, a.t, roll), R: rotate(f.R, a.t, roll), f };
    };
    const head = at(0);
    // float (pneumatophore) leads a colony: an elongated crystal with a glowing tip
    if (K > 1) {
      const fl = 0.42 * H;
      sink.part('crystal', add(head.p, scl(head.T, -fl * 0.2)), scl(head.R, fl * 0.32), scl(head.T, fl * 0.7), scl(head.U, fl * 0.32), p.colour.accent, 'glow', 0, true);
      dotPart(sink, add(head.p, scl(head.T, fl * 0.5)), 0.05 * H, 0.5 + 0.5 * glowK);
    }
    let prevApex: V3 = head.p;
    let last = head;
    for (let b = 0; b < K; b++) {
      const d = lead + b * gap;
      const f = at(d);
      const phi = ((kin.freq * t + ph - b / K) % 1 + 1) % 1;
      const pulse = bellPulse(phi);
      const stretch = 1 + 0.18 * (1 - pulse);
      const apex = f.p;
      // the stem links the float and each bell's apex
      if (b > 0 || K > 1) bone(sink, 'rodSi', prevApex, apex, Math.max(0.004, 0.025 * H), f.U, p.colour.accent, p.colour.accent);
      const c: V3[] = [], Us: V3[] = [], Rs: V3[] = [], W: number[] = [];
      for (const rg of prof) {
        const g = rg.u ** 1.5; // the rim contracts most, the apex barely
        c.push(sub(apex, scl(f.T, rg.u * H * stretch)));
        Us.push(f.U); Rs.push(f.R);
        W.push(Rrim * rg.r * (1 - (1 - pulse) * g));
      }
      sink.tube(b, c, Us, Rs, W, W);
      // comb rows (ctenophore): glow dots down each facet edge, shimmering in a wave that runs apex → rim
      for (let j = 0; j < combRows; j++) {
        const a = (2 * Math.PI * j) / combRows + Math.PI / sides;
        for (let q = 0; q < combDots; q++) {
          const u = 0.22 + 0.62 * (q / (combDots - 1));
          let r = 0; for (let i = 1; i < prof.length; i++) if (prof[i].u >= u) { r = prof[i].r; break; }
          const rad = Rrim * r * (1 - (1 - pulse) * u ** 1.5) * 1.02;
          const o = add(sub(apex, scl(f.T, u * H * stretch)), add(scl(f.R, Math.cos(a) * rad), scl(f.U, Math.sin(a) * rad)));
          const sh = Math.max(0, Math.sin(2 * Math.PI * (1.6 * t - 2 * u - j / combRows) + ph));
          dotPart(sink, o, Math.max(0.003, 0.014 * H), glowK * (0.06 + 0.8 * sh ** 4));
        }
      }
      const rimR = W[W.length - 1], rimC = sub(apex, scl(f.T, H * stretch));
      sink.part('ring', rimC, scl(f.R, rimR), scl(f.T, rimR * 0.12), scl(f.U, rimR), p.colour.accent, p.colour.accent, 0, false);
      // inner crystal core (manubrium) and dot eyes on the rim vertices
      const core = add(apex, scl(f.T, -0.42 * H * stretch));
      sink.part('crystal', core, scl(f.R, 0.12 * Rrim), scl(f.T, 0.22 * H), scl(f.U, 0.12 * Rrim), p.colour.accent, 'glow', 0.6 * glowK, false);
      if (p.head.eyes > 0) for (let j = 0; j < sym; j++) {
        const a = (2 * Math.PI * j) / sym;
        const rim = add(sub(apex, scl(f.T, H * stretch)), add(scl(f.R, Math.cos(a) * W[W.length - 1] * 1.03), scl(f.U, Math.sin(a) * W[W.length - 1] * 1.03)));
        dotPart(sink, rim, Math.max(0.004, p.head.eyeSize * H * 0.5), 0.4 + 0.4 * glowK);
      }
      prevApex = apex;
      last = f;
    }
    // siphosome: stiff lattice tendrils with 15° joints hanging back from the last bell, lit like a pyrosome
    if (p.radial.trail > 0) {
      const base = add(prevApex, scl(last.T, -0.5 * H));
      const nT = 3, segs = 8, segL = (p.radial.trail * H) / segs;
      for (let k = 0; k < nT; k++) {
        const a = (2 * Math.PI * k) / nT + 0.4;
        const radial = add(scl(last.f.R, Math.cos(a)), scl(last.f.U, Math.sin(a)));
        let pt = add(base, scl(radial, 0.25 * Rrim)), dir = norm(add(scl(last.T, -1), scl(radial, 0.25)));
        for (let j = 0; j < segs; j++) {
          const sway = snap((14 * Math.sin(0.7 * t - 0.6 * j + 2 * k + ph)) * D2R, STEP_DEG);
          dir = norm(rotate(dir, norm(cross(dir, radial)), sway * 0.5));
          dir = norm(add(dir, scl(UP, -0.08))); // lattice droops slightly
          const nxt = add(pt, scl(dir, segL));
          bone(sink, 'rodSi', pt, nxt, Math.max(0.003, 0.024 * H), radial, p.colour.accent, p.colour.accent);
          dotPart(sink, nxt, Math.max(0.003, 0.018 * H), glowK * (0.15 + 0.6 * Math.max(0, Math.sin(2 * Math.PI * (0.7 * t - j / segs) + k)) ** 3));
          if (j % 2 === 1) { // side spurs at ±60° (lattice branching)
            const sd = norm(rotate(dir, radial, 60 * D2R * (j % 4 === 1 ? 1 : -1)));
            bone(sink, 'rodSi', nxt, add(nxt, scl(sd, segL * 0.5)), Math.max(0.002, 0.009 * H), radial, p.colour.accent, p.colour.accent);
          }
          pt = nxt;
        }
      }
    }
    const mid = at(chainLen * 0.4);
    return { centre: mid.p, forward: head.T };
  }
  return { kin, L: H, extent, frameR: 0.5 * chainLen + Rrim + 0.3 * p.radial.trail * H, tubes, sheets: [], pose };
}

/** Build a swimmer. Pure and deterministic: the seed only jitters proportions (±4%) inside the params. */
export function buildSwimmer(params: SwimmerParams, seed: number): Swimmer {
  const p = normaliseParams(params);
  const jit = rng(seed * 7919 + 17);
  const core = p.chemistry === 'silicon' ? (p.plan === 'bell' ? buildBell(p, seed, jit) : buildRower(p, seed, jit)) : buildAxial(p, seed, jit);
  return { params: p, seed, ...core };
}

/** School member offsets (m, across/up the path) and lags, deterministic per index: a loose staggered lens. */
export function schoolOffsets(sw: Swimmer, n: number, seed = 1): SwimInstance[] {
  const r = rng(seed * 104729 + 3);
  const out: SwimInstance[] = [{ s0: 0, phase: 0, off: [0, 0], k: 0 }];
  const sp = Math.max(sw.L * 1.4, sw.extent * (sw.params.chemistry === 'silicon' ? 1.7 : 0.9));
  for (let k = 1; k < n; k++) {
    const ring = Math.ceil(Math.sqrt(k)), a = k * 2.399963; // golden-angle lens
    out.push({
      s0: -sp * (0.6 * ring + 0.5 * r()),
      phase: r(),
      off: [Math.cos(a) * sp * 0.75 * ring * (0.8 + 0.3 * r()), Math.sin(a) * sp * 0.45 * ring * (0.8 + 0.3 * r())],
      k,
    });
  }
  return out;
}
