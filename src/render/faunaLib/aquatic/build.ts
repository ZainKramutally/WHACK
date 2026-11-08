// Ported from mockups/red-world/src/fauna/aquatic/ (never imported; docs/features/aquatic-life.md). App edits: imports,
// and an allocation-free pose (below).
// buildSwimmer(params, seed): pure. Turns SwimmerParams into a Swimmer: a fixed geometry template (tubes = lofted
// bodies/bells, sheets = fin membranes, parts = instances of shared part geometry) and a pose function of
// (t, path, instance) that fills them each frame. Same (params, seed) → same swimmer and the same pose at every t.
//   carbon (axial): a follow-the-leader spine along the path with a travelling body wave (motion.ts), banking into
//     curves, a slow buoyancy bob; fins, lobes, crest, eyes, feelers and glow dots ride the spine frames.
//   silicon (radial): a faceted crystal hub whose rod arms row in stepped 15° beats, or faceted bells (alone or a
//     colony chain) that jet-pulse in sequence; dot eyes at the tips, glow from darkness; never bilateral.
//
// Allocation-free pose: everything pose() writes lives in arrays sized once at build (spine joints, tube rings, fin
// columns) or in this module's scratch vectors (one pose runs at a time; it never re-enters). It works in place with
// v3.ts's out-param helpers, in the same operation order as the mockup's tuple maths, so a pose matches the original to
// float rounding (golden.test.ts, against golden/buildV1.ts). The vectors and arrays handed to the sink, and the
// returned centre and forward, are reused by the next pose: a sink must copy what it keeps (fauna.ts does).
import type { LookKey as PaletteKey } from '../../palette';
import {
  add3, copy3, cross3, dot, len3 as len, lerp3o, madd3, norm3, reject3, rotate3, rotate3cs, scl3, set3, sub3, v3, type Path, type V3,
} from './v3';
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
export interface SwimInstance { s0: number; phase: number; off: [number, number]; k: number; /** Extra jaw gape (rad) while attacking (render-only; 0 or absent closed). */ gape?: number }

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
  /** Pose at time t: fills tubes and sheets and emits parts. Returns the body centre and travel direction (reused by
   *  the next pose call: copy them to keep them). */
  pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink): { centre: V3; forward: V3 };
}

const UP: V3 = [0, 1, 0];
const X_AXIS: V3 = [1, 0, 0];
const D2R = Math.PI / 180;
const cl = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const ss = (a: number, b: number, x: number) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const snap = (rad: number, deg: number) => Math.round(rad / (deg * D2R)) * deg * D2R;
const vs = (n: number): V3[] => Array.from({ length: n }, v3);

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

// ---- scratch (module-wide: one pose at a time) ---------------------------------------------------------------------
// The part basis handed to the sink, and each helper's own working vectors, so a helper never clobbers its caller's.
const QO = v3(), QX = v3(), QY = v3(), QZ = v3();
const BY = v3(), BYN = v3(), BX = v3();             // bone()
const LY = v3(), LX = v3(), LZ = v3();              // blade()
const FY = v3(), FX = v3(), FO = v3();              // flipper()
const PA = v3(), PT = v3();                          // a copy of path.at()'s point and tangent
const F0U = v3(), F0R = v3();                        // frameOf() outputs at the path
const UL = v3();                                     // spineAt()
// pose working vectors: named by role, each used within one block
const T1 = v3(), T2 = v3(), T3 = v3(), T4 = v3(), T5 = v3(), T6 = v3(), T7 = v3(), T8 = v3();
const ANG = { deg: 0, fold: 0 };

/** Path point and tangent at s, copied into PA, PT (a path may reuse its return object). */
function pathAt(path: Path, s: number): void {
  const a = path.at(s);
  copy3(PA, a.p); copy3(PT, a.t);
}

/** Frame from a forward vector, up toward `up`, into oU and oR (neither may alias T). */
function frameOf(T: V3, up: V3, oU: V3, oR: V3): void {
  const ref = Math.abs(dot(T, up)) > 0.97 ? X_AXIS : up;
  norm3(oU, reject3(oU, ref, T));
  cross3(oR, T, oU);
}

/** Basis whose y runs a → b with radius r across, x toward `hint`. */
function bone(sink: SwimSink, type: SwimPart, a: V3, b: V3, r: number, hint: V3, ca: PaletteKey, cb: PaletteKey, glow = 0, tr = false) {
  sub3(BY, b, a); norm3(BYN, BY);
  reject3(BX, hint, BYN);
  if (len(BX) < 1e-6) cross3(BX, BYN, Math.abs(BYN[1]) < 0.9 ? UP : X_AXIS);
  norm3(BX, BX);
  scl3(QX, BX, r);
  scl3(QZ, cross3(QZ, BX, BYN), r);
  sink.part(type, a, QX, BY, QZ, ca, cb, glow, tr);
}

/** Blade part: root o, length along dir, chord along `chordDir` (re-orthogonalised), thin across. */
function blade(sink: SwimSink, type: SwimPart, o: V3, dir: V3, length: number, chordDir: V3, chord: number, ca: PaletteKey, cb: PaletteKey, glow: number, tr: boolean) {
  norm3(LY, dir);
  reject3(LX, chordDir, LY);
  if (len(LX) < 1e-6) cross3(LX, LY, UP);
  norm3(LX, LX);
  cross3(LZ, LX, LY);
  sink.part(type, o, scl3(QX, LX, chord), scl3(QY, LY, length), scl3(QZ, LZ, Math.max(chord, length) * 0.04), ca, cb, glow, tr);
}

/** Plesiosaur flipper: the fin part as a hydrofoil (thickness and camber scale with the chord, not squashed flat like a
 *  fish fin). The left one runs its chord forward from the trailing edge so z = x × y points up on both sides: both
 *  arch the same way with a right-handed basis. */
function flipper(sink: SwimSink, root: V3, spanDir: V3, span: number, chordDir: V3, chord: number, sd: number, ca: PaletteKey, cb: PaletteKey) {
  norm3(FY, spanDir);
  reject3(FX, chordDir, FY);
  if (len(FX) < 1e-6) cross3(FX, FY, UP);
  norm3(FX, FX);
  if (sd > 0) copy3(FO, root); else madd3(FO, root, FX, chord);
  if (sd < 0) scl3(FX, FX, -1);
  sink.part('blade', FO, scl3(QX, FX, chord), scl3(QY, FY, span), scl3(QZ, cross3(QZ, FX, FY), chord), ca, cb, 0, false);
}

function dotPart(sink: SwimSink, o: V3, r: number, glow: number, key: PaletteKey = 'glow') {
  sink.part('dot', o, set3(QX, r, 0, 0), set3(QY, 0, r, 0), set3(QZ, 0, 0, r), key, key, glow, false);
}

/** Banking roll (rad) from path curvature at s: lean into the turn, up toward the turn centre. */
function bankAt(path: Path, s: number, L: number, speed: number): number {
  const d = Math.max(0.25, 0.3 * L);
  const a = path.at(s).t, h0 = Math.atan2(a[2], a[0]);
  const b = path.at(s + d).t, h1 = Math.atan2(b[2], b[0]);
  let dh = h1 - h0;
  if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
  const kappa = -dh / d; // > 0: left turn (x → −z)
  const lean = Math.atan((speed * speed * kappa) / 2.5 + 0.6 * kappa * L);
  return -cl(lean, -0.75, 0.75);
}

// ---- spine (axial) ---------------------------------------------------------------------------------------------
interface SpineS { u: number[]; P: V3[]; T: V3[]; U: V3[]; R: V3[] }
interface Frame { p: V3; T: V3; U: V3; R: V3 }
const frame = (): Frame => ({ p: v3(), T: v3(), U: v3(), R: v3() });

/** The spine's frame at u, into f. */
function spineAt(sp: SpineS, u: number, f: Frame): Frame {
  const n = sp.u.length - 1, u0 = sp.u[0], du = sp.u[1] - sp.u[0];
  const x = cl((u - u0) / du, 0, n), i = Math.min(n - 1, Math.floor(x)), fr = x - i;
  const p0 = sp.P[Math.max(0, i - 1)], p1 = sp.P[i], p2 = sp.P[i + 1], p3 = sp.P[Math.min(n, i + 2)];
  // Catmull-Rom weights (hot path: no per-component closures)
  const f2 = fr * fr, f3 = f2 * fr;
  const w0 = 0.5 * (-fr + 2 * f2 - f3), w1 = 0.5 * (2 - 5 * f2 + 3 * f3), w2 = 0.5 * (fr + 4 * f2 - 3 * f3), w3 = 0.5 * (f3 - f2);
  set3(f.p,
    w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
    w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1],
    w0 * p0[2] + w1 * p1[2] + w2 * p2[2] + w3 * p3[2]);
  norm3(f.T, lerp3o(f.T, sp.T[i], sp.T[i + 1], fr));
  lerp3o(UL, sp.U[i], sp.U[i + 1], fr);
  norm3(f.U, reject3(f.U, UL, f.T));
  cross3(f.R, f.T, f.U);
  return f;
}

/** Plesiosaur landmarks along the body (u): skull end, front girdle (neck end) and hind girdle (tail start). */
export function plesioMarks(p: SwimmerParams): { head: number; fore: number; hind: number } {
  const head = 0.07, fore = Math.min(0.6, head + p.neck), hind = Math.max(fore + 0.3, 1 - p.tailLen);
  return { head, fore, hind };
}

/** Body radius profile 0..1 at u (0 nose, 1 tail). `mk`: the plesiosaur's landmarks (plesioMarks), computed once. */
function profile(p: SwimmerParams, u: number, mk: { head: number; fore: number; hind: number }): number {
  const pk = p.peak;
  let r: number;
  if (p.plan === 'plesiosaur') {
    // snout → skull, a slim neck thickening into the shoulders, a barrel torso between the girdles, a tapering tail
    const hd = mk.head, nE = mk.fore, tS = mk.hind;
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

/** A tube's per-pose arrays, sized once. */
interface TubeBuf { c: V3[]; U: V3[]; R: V3[]; w: number[]; h: number[] }
const tubeBuf = (n: number): TubeBuf => ({ c: vs(n), U: vs(n), R: vs(n), w: new Array(n).fill(0), h: new Array(n).fill(0) });

// ---- carbon: axial swimmer ---------------------------------------------------------------------------------------
function buildAxial(p: SwimmerParams, seed: number, jit: () => number): Omit<Swimmer, 'params' | 'seed'> {
  const L = p.length * (1 + 0.08 * (jit() - 0.5));
  const aspect = p.aspect * (1 + 0.08 * (jit() - 0.5));
  const P = { ...p, length: L, aspect };
  const kin = kinematics(P);
  const ribbon = p.plan === 'ribbon', plesio = p.plan === 'plesiosaur';
  const marks = plesioMarks(P);
  const whip = p.tail === 'whip' ? 0.35 : 0;
  const NJ = ribbon ? 40 : 22, uMax = 1 + whip;
  const NR = ribbon ? 56 : 30;
  const rMax = (aspect * L) / 2;
  const rw = (u: number) => rMax * profile(P, u, marks);
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
    const mk = marks, torso = mk.hind - mk.fore, span = p.fins.lateralSize * L;
    const cF = Math.min(0.17, 0.42 * torso), cH = Math.min(0.15, 0.42 * torso);
    return [
      { u: mk.fore + 0.02, chord: cF, span, lag: 0 },
      { u: mk.hind - 0.02 - cH, chord: cH, span: 0.85 * span, lag: 0.3 },
    ].map((f) => ({ u: f.u, chord: f.chord * L, span: f.span, lag: f.lag, inset: 0.8 * Math.min(rw(f.u), rw(f.u + f.chord)) }));
  })() : [];
  const extent = L * (0.6 + p.head.feelerLen * (p.head.feelers > 0 ? 0.5 : 0)) + whip * L;
  const glowK = p.glow;
  // head layout (static): eye slots, sizes
  const hw = rw(0.07), hh = rh(0.07);
  const ne = p.head.eyes, er = Math.min(p.head.eyeSize * L, 0.62 * Math.min(Math.max(hw, hh), 1.6 * Math.min(hw, hh)));
  const stalk = p.head.stalks * L;
  const eyeSlots: { side: number; up: number; fwd: number }[] = [];
  for (let i = 0; i < Math.floor(ne / 2); i++) eyeSlots.push({ side: -1, up: 0.25 + 0.5 * i, fwd: -0.12 * i }, { side: 1, up: 0.25 + 0.5 * i, fwd: -0.12 * i });
  if (ne % 2) eyeSlots.push({ side: 0, up: 1, fwd: 0.05 });

  // per-pose storage, sized once
  const sp: SpineS = { u: Array.from({ length: NJ }, (_, j) => (j / (NJ - 1)) * uMax), P: vs(NJ), T: vs(NJ), U: vs(NJ), R: vs(NJ) };
  const body = tubeBuf(NR), whipT = tubeBuf(10);
  for (let i = 0; i < NR; i++) { body.w[i] = rw(ringU[i]); body.h[i] = rh(ringU[i]); }
  for (let i = 0; i < 10; i++) whipT.w[i] = whipT.h[i] = rw(0.97) * (1 - 0.9 * (i / 9));
  const dorsalA = vs(dorsal >= 0 ? sheets[dorsal].cols : 0), dorsalB = vs(dorsalA.length);
  const ventralA = vs(ventral >= 0 ? sheets[ventral].cols : 0), ventralB = vs(ventralA.length);
  const f = frame(), g = frame();   // spine frames: f for each feature, g where a second one is live (head, tail)
  const out = { centre: v3(), forward: v3() };

  // The hot loops are small functions of their own, so TurboFan inlines their helpers (one huge pose() runs out of
  // inlining budget, and every helper call then boxes its numbers).
  /** Spine joints along the path behind the head, then the travelling wave across the banked frame. */
  function spine(t: number, path: Path, s: number, bank: number, ox: number, oy: number, pitch: number, ph: number) {
    const cb = Math.cos(bank), sb = Math.sin(bank);
    for (let j = 0; j < NJ; j++) {
      const u = sp.u[j];
      pathAt(path, s - u * L);
      frameOf(PT, UP, F0U, F0R);
      rotate3cs(sp.U[j], F0U, PT, cb, sb); rotate3cs(sp.R[j], F0R, PT, cb, sb);
      const lat = L * bodyWave(kin, P.undulation, Math.min(u, 1.15), t, ph * 2 * Math.PI);
      const pp = madd3(sp.P[j], PA, F0R, ox);
      madd3(pp, pp, F0U, oy + pitch * (0.4 - u) * L);
      madd3(pp, pp, sp.R[j], lat);
    }
    for (let j = 0; j < NJ; j++) {
      const T = norm3(sp.T[j], sub3(sp.T[j], sp.P[Math.max(0, j - 1)], sp.P[Math.min(NJ - 1, j + 1)]));
      norm3(sp.U[j], reject3(sp.U[j], sp.U[j], T));
      cross3(sp.R[j], T, sp.U[j]);
    }
  }
  /** A tube's rings from the spine at the given u values. */
  function tubeFromSpine(tb: TubeBuf, n: number, u0: number, du: number, us: number[] | null) {
    for (let i = 0; i < n; i++) { spineAt(sp, us ? us[i] : u0 + du * i, f); copy3(tb.c[i], f.p); copy3(tb.U[i], f.U); copy3(tb.R[i], f.R); }
  }
  /** The dorsal sail's base and tip lines. */
  function dorsalSail(t: number, ph: number) {
    const n = sheets[dorsal].cols, A = dorsalA, B = dorsalB;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1), u = dU[0] + (dU[1] - dU[0]) * x;
      spineAt(sp, u, f);
      const h = p.fins.dorsal * L * (ribbon ? (0.75 + 0.25 * Math.sin(Math.PI * x)) * (1 - 0.6 * ss(0.85, 1, x)) : Math.sin(Math.PI * x) ** 0.7);
      const th = finRipple(kin, u, t, fringeAmp, ph * 6.28);
      const base = madd3(A[i], f.p, f.U, rhTop(u) * 0.8);
      // a fish's dorsal fin sweeps back (the eel ribbon's long fin stands upright)
      madd3(T1, scl3(T1, f.U, h * Math.cos(th)), f.R, h * Math.sin(th));
      madd3(B[i], add3(B[i], base, T1), f.T, ribbon ? 0 : -0.6 * h);
    }
  }
  /** Glow dots along the mid-flank lateral line. */
  function lateralLine(t: number, ph: number, sink: SwimSink) {
    const nll = Math.round(p.lateralLine * (ribbon ? 22 : 14));
    for (let i = 0; i < nll; i++) {
      const u = 0.14 + 0.78 * (i / Math.max(1, nll - 1));
      spineAt(sp, u, f);
      const pulse = 0.55 + 0.45 * Math.sin(2 * Math.PI * (0.6 * t - u * 1.5) + ph);
      for (let sd = -1; sd <= 1; sd += 2) dotPart(sink, madd3(T1, f.p, f.R, sd * rw(u) * 0.99), Math.max(0.003, Math.min(0.008 * L, 0.11 * rh(u))), glowK * pulse * 0.8);
    }
  }

  function pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink) {
    const ph = inst.phase;
    const s = inst.s0 + advance(kin, t);
    const bank = bankAt(path, s, L, kin.speed);
    const bobT = 2 * Math.PI * (t / (3.4 + 0.6 * Math.sin(seed)) + ph * 0.37);
    const bob = 0.03 * L * Math.sin(bobT), pitch = 0.025 * Math.sin(bobT + 1.1);
    const wander = inst.k > 0 ? 1 : 0;
    const ox = inst.off[0] + wander * 0.22 * L * Math.sin(0.31 * t + 7.1 * inst.k);
    const oy = inst.off[1] + wander * 0.16 * L * Math.sin(0.23 * t + 3.3 * inst.k) + bob;
    spine(t, path, s, bank, ox, oy, pitch, ph);
    // body tube
    tubeFromSpine(body, NR, 0, 0, ringU);
    sink.tube(0, body.c, body.U, body.R, body.w, body.h, topK);
    if (whip) {
      tubeFromSpine(whipT, 10, 0.97, (uMax - 0.97) / 9, null);
      sink.tube(1, whipT.c, whipT.U, whipT.R, whipT.w, whipT.h);
    }
    // dorsal sail: rippling membrane (oarfish), crest rays at the front
    if (dorsal >= 0) {
      const n = sheets[dorsal].cols, A = dorsalA, B = dorsalB;
      dorsalSail(t, ph);
      sink.sheet(dorsal, A, B);
      // fin rays: every other column, so the ripple reads as a row of tilting spines
      for (let i = 1; i < n - 1; i += 2) bone(sink, 'rod', A[i], B[i], Math.max(0.002, 0.0035 * L), sp.T[0], p.colour.accent, p.colour.accent);
    }
    // ventral keel (hatchet blade) with the photophore row along its edge
    if (ventral >= 0) {
      const n = sheets[ventral].cols, A = ventralA, B = ventralB;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1), u = vU[0] + (vU[1] - vU[0]) * x;
        spineAt(sp, u, f);
        const base = madd3(A[i], f.p, f.U, -(rh(u) * 0.85));
        madd3(B[i], base, f.U, -keel(x));
      }
      sink.sheet(ventral, A, B);
    }
    if (p.photophores > 0) {
      const n = p.photophores;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n, u = vU[0] + (vU[1] - vU[0]) * x;
        spineAt(sp, u, f);
        const h = p.fins.ventral > 0 ? keel(x) : 0;
        madd3(T1, f.p, f.U, -(rh(u) * 0.85 + h * 0.9));
        for (let sd = -1; sd <= 1; sd += 2) dotPart(sink, madd3(T2, T1, f.R, sd * Math.max(rw(u) * 0.35, 0.004 * L)), Math.max(0.003, 0.009 * L), 0.25 + 0.45 * glowK);
      }
    }
    // lateral fins: a metachronal lobe fringe (≥ 3 pairs) or flapping pectoral paddles
    const nl = p.fins.lateral;
    if (ribbon && nl > 0) {
      // oarfish pelvic "oars": two long trailing rays from under the head, each ending in a paddle
      spineAt(sp, 0.09, f);
      for (let sd = -1; sd <= 1; sd += 2) {
        const at = madd3(T1, madd3(T1, f.p, f.U, -(rh(0.09) * 0.8)), f.R, sd * rw(0.09) * 0.6);
        const dir = scl3(T2, f.T, -1);
        norm3(dir, madd3(dir, madd3(dir, dir, f.U, -0.55), f.R, sd * 0.25));
        const segs = 6, segL = (p.fins.lateralSize * 1.6 * L) / segs;
        for (let k = 0; k < segs; k++) {
          const nxt = madd3(T3, at, dir, segL);
          bone(sink, 'rod', at, nxt, Math.max(0.003, 0.004 * L), f.R, p.colour.accent, p.colour.accent);
          copy3(at, nxt);
          norm3(dir, rotate3(dir, dir, f.R, 0.1 * Math.sin(2 * Math.PI * kin.freq * t - k * 0.8 + sd + ph)));
        }
        blade(sink, 'blade', at, dir, 0.035 * L, f.U, 0.02 * L, p.colour.accent, p.colour.body, glowK * 0.6, finTr);
      }
    }
    for (let i = 0; i < (ribbon || plesio ? 0 : nl); i++) {
      const lobes = nl >= 3;
      const u = lobes ? 0.16 + 0.66 * (nl === 1 ? 0.5 : i / (nl - 1)) : 0.2 + 0.25 * i;
      spineAt(sp, u, f);
      const size = p.fins.lateralSize * L * lobeSizes[i];
      const spacing = lobes ? (0.66 / Math.max(1, nl - 1)) * L : size * 0.6;
      for (let sd = -1; sd <= 1; sd += 2) {
        const th = lobes ? finRipple(kin, u, t, 0.5, ph * 6.28 + (sd > 0 ? 0 : 0.35)) : 0.55 * Math.sin(2 * Math.PI * kin.freq * t * 0.8 + ph * 6.28 + (sd > 0 ? 0 : Math.PI * 0.15)) - 0.25;
        const outV = scl3(T1, f.R, sd);
        const dir = scl3(T2, outV, Math.cos(th));
        norm3(dir, madd3(dir, madd3(dir, dir, f.U, Math.sin(th)), f.T, lobes ? -0.35 : -0.55));
        madd3(T3, scl3(T3, f.R, sd * rw(u) * 0.85), f.U, lobes ? -rh(u) * 0.2 : -rh(u) * 0.35);
        const root = add3(T3, f.p, T3);
        blade(sink, 'blade', root, dir, size, scl3(T4, f.T, -1), lobes ? Math.max(spacing * 1.9, size * 0.8) : size * 0.6, p.colour.accent, p.colour.body, 0, finTr);
      }
    }
    // plesiosaur flippers: four long hydrofoils rooted flush on the flanks at the girdles, flying underwater: each flaps
    // up and down with a pitch twist a quarter cycle ahead of the flap, and the hind pair lags the fore pair
    // (one stroke per stroke cycle, so the stroke rate follows the travel speed fauna.ts drives the phase with)
    const stroke = 2 * Math.PI * kin.freq * t + ph * 2 * Math.PI;
    for (const fl of flippers) {
      spineAt(sp, fl.u, f);
      const a = stroke - 2 * Math.PI * fl.lag;
      const flap = 0.6 * Math.sin(a) - 0.12, pitch2 = 0.45 * Math.cos(a); // leading edge down on the downstroke
      for (let sd = -1; sd <= 1; sd += 2) {
        const spanDir = scl3(T1, f.R, sd * Math.cos(flap));
        norm3(spanDir, madd3(spanDir, madd3(spanDir, spanDir, f.U, Math.sin(flap)), f.T, -0.3));
        const chordDir = rotate3(T2, scl3(T2, f.T, -1), spanDir, sd * pitch2); // twist about the span axis
        madd3(T3, scl3(T3, f.R, sd * fl.inset), f.U, -rh(fl.u) * 0.15);
        flipper(sink, add3(T3, f.p, T3), spanDir, fl.span, chordDir, fl.chord, sd, p.colour.accent, p.colour.body);
      }
    }
    // tail fins
    const tf = spineAt(sp, 0.995, g), tl = p.tailSize * L;
    const tip = tf.p;
    const back = scl3(T5, tf.T, -1);
    if (p.tail === 'fork' || p.tail === 'lunate') {
      const ang = p.tail === 'fork' ? 0.62 : 0.95;
      for (let sd = -1; sd <= 1; sd += 2) blade(sink, 'blade', tip, madd3(T1, scl3(T1, back, Math.cos(ang)), tf.U, sd * Math.sin(ang)), tl, back, tl * (p.tail === 'fork' ? 0.75 : 0.5), p.colour.accent, p.colour.body, 0, finTr);
    } else if (p.tail === 'fan') {
      for (let sd = -1; sd <= 1; sd += 2) for (let k = 0; k < 3; k++) {
        const a = (0.25 + 0.32 * k) * sd;
        const fl = 0.08 * Math.sin(2 * Math.PI * kin.freq * t + k);
        madd3(T1, madd3(T1, scl3(T1, back, Math.cos(a)), tf.R, Math.sin(a)), tf.U, fl);
        blade(sink, 'blade', tip, T1, tl * (1 - 0.15 * k), tf.R, tl * 0.32, p.colour.accent, p.colour.body, 0, finTr);
      }
    }
    // head: eyes (in the head or on stalks), crest rays, feelers, mouth
    const hf = spineAt(sp, 0.07, g);
    for (const e of eyeSlots) {
      const upward = topK < 1 && stalk > 0; // deep-sea tubular eyes stare up
      const outDir = scl3(T1, hf.R, e.side * (upward ? 0.35 : 0.9));
      norm3(outDir, madd3(outDir, madd3(outDir, outDir, hf.U, upward ? 1.2 : e.up * (stalk > 0 ? 1.1 : 0.55)), hf.T, 0.15 + e.fwd));
      const surf = scl3(T2, hf.R, e.side * hw * (upward ? 0.55 : 0.82));
      madd3(surf, madd3(surf, surf, hf.U, hh * topK * (e.side === 0 || upward ? 0.8 : 0.15 + 0.35 * e.up)), hf.T, e.fwd * L * 0.4);
      add3(surf, hf.p, surf);
      const at = copy3(T3, surf);
      if (stalk > 0) {
        const sway = 0.12 * Math.sin(1.7 * t + e.side * 1.3 + e.up * 2 + ph);
        const sdv = norm3(T4, madd3(T4, outDir, hf.T, sway));
        madd3(at, surf, sdv, stalk * (e.side === 0 ? 1.15 : 1));
        bone(sink, 'rod', surf, at, Math.max(0.004, er * 0.28), hf.T, p.colour.body, p.colour.body);
      }
      const z = norm3(T4, madd3(T4, outDir, hf.T, 0.35));
      frameOf(z, hf.U, T6, T7);
      sink.part('eye', at, scl3(QX, T7, -er), scl3(QY, T6, er), scl3(QZ, z, er), 'ink', 'bone', 0, false); // −eR: right-handed (eR × eu = −z)
    }
    for (let i = 0; i < p.head.crest; i++) {
      const u = 0.03 + 0.012 * i;
      spineAt(sp, u, f);
      const base = madd3(T1, f.p, f.U, rhTop(u) * 0.85);
      const lag = 0.25 * Math.sin(2 * Math.PI * kin.freq * 0.5 * t - i * 0.6 + ph);
      const dir = scl3(T2, f.U, 1);
      norm3(dir, madd3(dir, madd3(dir, dir, f.T, -0.55 - 0.1 * i), f.R, lag * 0.5));
      const tipC = madd3(T3, base, dir, (0.07 + 0.012 * i) * L * (ribbon ? 1.4 : 1));
      bone(sink, 'rod', base, tipC, Math.max(0.004, 0.006 * L), f.R, p.colour.accent, p.colour.accent);
      if (glowK > 0.05) dotPart(sink, tipC, Math.max(0.005, 0.008 * L), glowK);
    }
    const nf = p.head.feelers;
    for (let i = 0; i < nf; i++) {
      const side = nf === 1 ? 0 : (i % 2 ? 1 : -1) * (1 + Math.floor(i / 2) * 0.6);
      const f0 = spineAt(sp, 0.02, f);
      const at = scl3(T1, f0.R, side * hw * 0.45);
      add3(at, f0.p, madd3(at, at, f0.U, -hh * 0.35));
      const dir = madd3(T2, f0.T, f0.U, -0.35);
      norm3(dir, madd3(dir, dir, f0.R, side * 0.25));
      const segs = 8, segL = (p.head.feelerLen * L) / segs;
      const grasp = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 2.6 + i * 0.7 + ph);
      const axis = norm3(T3, cross3(T3, dir, f0.U)); // curl down and back under the head
      for (let k = 0; k < segs; k++) {
        const nxt = madd3(T4, at, dir, segL);
        const r = Math.max(0.004, 0.024 * L * (1 - 0.65 * (k / segs)) * (p.plan === 'segmented' ? 1 : 0.6));
        bone(sink, 'rod', at, nxt, r, f0.U, p.colour.accent, p.colour.accent);
        if (k > 1 && k % 2 === 0) { // inner spines
          const spike = scl3(T5, f0.U, -1);
          norm3(spike, madd3(spike, spike, dir, 0.3));
          bone(sink, 'rod', nxt, madd3(T6, nxt, spike, r * 3.2), r * 0.35, dir, p.colour.body, p.colour.body);
        }
        copy3(at, nxt);
        norm3(dir, rotate3(dir, dir, axis, -(0.2 + 0.28 * grasp) * (k / segs + 0.5)));
      }
    }
    if (p.head.mouth === 'cone') {
      spineAt(sp, 0.09, f);
      const o = madd3(T1, f.p, f.U, -(rh(0.09) * 0.75));
      const r = rw(0.09) * 0.45;
      sink.part('ring', o, scl3(QX, f.R, r), scl3(QY, f.U, r * 0.6), scl3(QZ, f.T, -r), p.colour.accent, 'ink', 0, false); // R × U = −T
    } else if (p.head.mouth === 'proboscis') {
      const f0 = spineAt(sp, 0.0, f);
      const at = copy3(T1, f0.p), dir = norm3(T2, madd3(T2, f0.T, f0.U, -0.2));
      const segs = 6, segL = 0.32 * L / segs;
      for (let k = 0; k < segs; k++) {
        const nxt = madd3(T3, at, dir, segL);
        bone(sink, 'rod', at, nxt, Math.max(0.003, 0.012 * L), f0.U, p.colour.body, p.colour.body);
        copy3(at, nxt);
        norm3(dir, rotate3(dir, dir, f0.R, -0.12 * Math.sin(1.3 * t + k * 0.5 + ph)));
      }
      for (let sd = -1; sd <= 1; sd += 2) blade(sink, 'blade', at, madd3(T4, dir, f0.U, 0.6 * sd), 0.05 * L, dir, 0.02 * L, p.colour.accent, p.colour.accent, 0, false);
    } else if (p.head.mouth === 'jaw') {
      spineAt(sp, 0.04, f);
      const o = madd3(T1, f.p, f.U, -(rh(0.04) * 0.5));
      const gape = 0.12 + 0.1 * Math.sin(2 * Math.PI * kin.freq * 0.5 * t + ph) + (inst.gape ?? 0);
      blade(sink, 'blade', o, norm3(T2, madd3(T2, f.T, f.U, -gape)), 0.12 * L, f.R, rw(0.04) * 1.2, p.colour.body, p.colour.accent, 0, false);
    }
    // lateral line glow and dorsal armour
    lateralLine(t, ph, sink);
    const np = Math.round(p.plates * 11);
    for (let i = 0; i < np; i++) {
      const u = 0.12 + 0.72 * ((i + 0.5) / np);
      spineAt(sp, u, f);
      const w = rw(u) * 1.15, l = (0.72 / np) * L * 1.35;
      sink.part('plate', madd3(T1, f.p, f.U, rhTop(u) * 0.62), scl3(QX, f.R, w), scl3(QY, f.U, rhTop(u) * 0.55 + 0.01 * L), scl3(QZ, f.T, -l * 0.5), p.colour.body, p.colour.accent, 0, false);
    }
    const mid = spineAt(sp, 0.45, f);
    copy3(out.centre, mid.p); copy3(out.forward, mid.T);
    return out;
  }
  return { kin, L, extent, frameR: 0.55 * L, tubes, sheets, pose };
}

// ---- silicon: radial hub rower -----------------------------------------------------------------------------------
function buildRower(p: SwimmerParams, seed: number, jit: () => number): Omit<Swimmer, 'params' | 'seed'> {
  void seed;
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
  const hub = tubeBuf(ring.length);
  for (let i = 0; i < ring.length; i++) hub.w[i] = ring[i].r;
  const Tf = v3(), U = v3(), R = v3(), centre = v3(), nose = v3();
  const out = { centre: v3(), forward: v3() };

  function pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink) {
    const ph = inst.phase;
    const s = inst.s0 + advance(kin, t, ph);
    pathAt(path, s);
    copy3(Tf, PT);
    frameOf(Tf, UP, F0U, F0R);
    const bank = bankAt(path, s, L, kin.speed) * 0.5;
    const roll = 0.22 * t + ph * 6.28 + bank; // it rolls slowly as it rows
    rotate3(U, F0U, Tf, roll); rotate3(R, F0R, Tf, roll);
    const wander = inst.k > 0 ? 1 : 0;
    const bob = 0.04 * L * Math.sin(2 * Math.PI * (t / 4.1 + ph * 0.37));
    const ox = inst.off[0] + wander * 0.3 * L * Math.sin(0.27 * t + 5.3 * inst.k);
    const oy = inst.off[1] + wander * 0.25 * L * Math.sin(0.21 * t + 2.1 * inst.k) + bob;
    const phi = ((kin.freq * t + ph) % 1 + 1) % 1;
    madd3(centre, madd3(centre, PA, F0R, ox), F0U, oy);
    madd3(nose, centre, Tf, L / 2);
    for (let i = 0; i < ring.length; i++) { madd3(hub.c[i], nose, Tf, -(ring[i].u * L)); copy3(hub.U[i], U); copy3(hub.R[i], R); }
    sink.tube(0, hub.c, hub.U, hub.R, hub.w, hub.w);
    // inner core glow (seen through translucent facets) and facet spikes
    const core = 0.4 * rMax;
    sink.part('crystal', centre, scl3(QX, R, core * 0.55), scl3(QY, Tf, core * 1.1), scl3(QZ, U, core * 0.55), p.colour.accent, 'glow', glowK * 0.7, false);
    for (let i = 0; i < nSpikes; i++) {
      const tier = i % T, a = ((Math.floor(i / T) + 0.5) / Math.ceil(nSpikes / T)) * 2 * Math.PI + (tier % 2) * Math.PI / sym;
      const radial = madd3(T1, scl3(T1, R, Math.cos(a)), U, Math.sin(a));
      const u = 0.2 + (span * (tier + 0.5)) / T;
      const o = madd3(T2, madd3(T2, nose, Tf, -(u * L)), radial, tierR[tier] * 0.9);
      const sl = rMax * (0.5 + 0.6 * p.radial.spikes);
      sink.part('crystal', madd3(QO, o, radial, sl * 0.4), scl3(QX, Tf, sl * 0.18), scl3(QY, radial, sl * 0.5), scl3(QZ, cross3(QZ, Tf, radial), sl * 0.18), p.colour.body, p.colour.accent, 0, tr);
    }
    // rowing arms: stepped 15° beats in the power stroke, folded feathered recovery
    const { deg, fold } = armAngle(kin, phi, ANG);
    const knee = snap((15 + 60 * fold) * D2R, STEP_DEG);
    const upper = armL * 0.55, lower = armL * 0.45;
    for (let k = 0; k < sym; k++) {
      const a = (2 * Math.PI * k) / sym;
      const radial = madd3(T1, scl3(T1, R, Math.cos(a)), U, Math.sin(a));
      const tangent = cross3(T2, Tf, radial);
      const root = madd3(T3, centre, radial, rMax * 0.95);
      const d1 = madd3(T4, scl3(T4, Tf, Math.cos(deg * D2R)), radial, Math.sin(deg * D2R));
      norm3(d1, d1);
      const kneeP = madd3(T5, root, d1, upper);
      const d2 = norm3(T6, rotate3(T6, d1, tangent, knee)); // fold back toward the tail
      const tipP = madd3(T7, kneeP, d2, lower);
      const rr = Math.max(0.005, 0.026 * L);
      bone(sink, 'rodSi', root, kneeP, rr, tangent, p.colour.accent, p.colour.body);
      bone(sink, 'rodSi', kneeP, tipP, rr * 0.8, tangent, p.colour.accent, p.colour.body);
      sink.part('crystal', kneeP, scl3(QX, tangent, rr * 1.25), scl3(QY, d1, rr * 1.5), scl3(QZ, cross3(QZ, tangent, d1), rr * 1.25), p.colour.accent, p.colour.body, glowK * 0.12, false);
      // paddle: face-on to the stroke in power, feathered (turned 90°) in recovery
      const feather = snap(fold * 90 * D2R, STEP_DEG);
      const chord = rotate3(T8, tangent, d2, feather);
      blade(sink, 'bladeSi', madd3(QO, tipP, d2, -(lower * 0.75)), d2, lower * 0.9, chord, lower * 0.75, p.colour.body, p.colour.accent, 0, false);
      // dot eyes at the arm tip
      const ne = Math.max(0, p.head.eyes);
      for (let e = 0; e < ne; e++) {
        const o0 = ne === 1 ? 0 : Math.cos((2 * Math.PI * e) / ne), o1 = ne === 1 ? 0 : Math.sin((2 * Math.PI * e) / ne);
        const eo = madd3(QO, tipP, tangent, o0 * rr * 1.3);
        madd3(eo, eo, cross3(T8, d2, tangent), o1 * rr * 1.3);
        dotPart(sink, eo, Math.max(0.004, p.head.eyeSize * L * 0.45), 0.4 + 0.4 * glowK);
      }
      for (let fi = 0; fi < p.head.feelers; fi++) {
        const fd = norm3(T8, rotate3(T8, d2, tangent, snap((fi % 2 ? 1 : -1) * 30 * D2R, STEP_DEG)));
        bone(sink, 'rodSi', tipP, madd3(QO, tipP, fd, lower * 0.5), rr * 0.4, tangent, p.colour.accent, p.colour.accent);
      }
    }
    // trailing lattice: stiff rods with 15° joints behind the hub
    if (p.radial.trail > 0) {
      const tail = madd3(T3, nose, Tf, -L);
      const nT = Math.max(2, Math.floor(sym / 2)), segs = 6, segL = (p.radial.trail * L) / segs;
      for (let k = 0; k < nT; k++) {
        const a = (2 * Math.PI * k) / nT + 0.3;
        const radial = madd3(T1, scl3(T1, F0R, Math.cos(a)), F0U, Math.sin(a));
        const at = copy3(T4, tail), dir = scl3(T5, Tf, -1);
        for (let j = 0; j < segs; j++) {
          const bend = snap((10 + 8 * Math.sin(0.9 * t - j * 0.7 + k)) * D2R * (j > 0 ? 1 : 0), STEP_DEG);
          norm3(dir, rotate3(dir, dir, cross3(T6, dir, radial), -bend * 0.5));
          const nxt = madd3(T7, at, dir, segL);
          bone(sink, 'rodSi', at, nxt, Math.max(0.003, 0.012 * L), radial, p.colour.accent, p.colour.accent, 0);
          dotPart(sink, nxt, Math.max(0.004, 0.018 * L), glowK * (0.5 + 0.5 * Math.sin(2 * Math.PI * (0.8 * t - j / segs) + k)));
          copy3(at, nxt);
        }
      }
    }
    copy3(out.centre, centre); copy3(out.forward, Tf);
    return out;
  }
  return { kin, L, extent, frameR: 1.2 * (rMax + armL), tubes, sheets: [], pose };
}

// ---- silicon: faceted bell, alone or a siphonophore-like chain ---------------------------------------------------------
/** A bell's frame along the path: centre p, tangent T, rolled U and R, and the unrolled path frame fU, fR. */
interface BellFrame { p: V3; T: V3; U: V3; R: V3; fU: V3; fR: V3 }
const bellFrame = (): BellFrame => ({ p: v3(), T: v3(), U: v3(), R: v3(), fU: v3(), fR: v3() });

function buildBell(p: SwimmerParams, seed: number, jit: () => number): Omit<Swimmer, 'params' | 'seed'> {
  void seed;
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
  // the comb dots' profile radius (the first ring at or past u), fixed per dot
  const combR = Array.from({ length: combDots }, (_, q) => {
    const u = 0.22 + 0.62 * (q / (combDots - 1));
    let r = 0; for (let i = 1; i < prof.length; i++) if (prof[i].u >= u) { r = prof[i].r; break; }
    return r;
  });
  const bells = Array.from({ length: K }, () => tubeBuf(prof.length));
  const head = bellFrame(), fb = bellFrame(), mid = bellFrame(), prevApex = v3();
  const out = { centre: v3(), forward: v3() };
  /** The chain's frame d behind the head (offset across the path by ox, oy; rolled by cr, sr), into o. */
  function at(path: Path, s: number, d: number, ox: number, oy: number, cr: number, sr: number, o: BellFrame): BellFrame {
    pathAt(path, s - d);
    copy3(o.T, PT);
    frameOf(o.T, UP, o.fU, o.fR);
    madd3(o.p, madd3(o.p, PA, o.fR, ox), o.fU, oy);
    rotate3cs(o.U, o.fU, o.T, cr, sr); rotate3cs(o.R, o.fR, o.T, cr, sr);
    return o;
  }

  function pose(t: number, path: Path, inst: SwimInstance, sink: SwimSink) {
    const ph = inst.phase;
    const s = inst.s0 + advance(kin, t, ph, K);
    const wander = inst.k > 0 ? 1 : 0;
    const bob = 0.05 * H * Math.sin(2 * Math.PI * (t / 5.3 + ph * 0.37));
    const ox = inst.off[0] + wander * 0.25 * H * Math.sin(0.19 * t + 4.3 * inst.k);
    const oy = inst.off[1] + wander * 0.2 * H * Math.sin(0.17 * t + 1.7 * inst.k) + bob;
    const roll = 0.12 * t + ph * 6.28, cr = Math.cos(roll), sr = Math.sin(roll);
    at(path, s, 0, ox, oy, cr, sr, head);
    // float (pneumatophore) leads a colony: an elongated crystal with a glowing tip
    if (K > 1) {
      const fl = 0.42 * H;
      sink.part('crystal', madd3(QO, head.p, head.T, -fl * 0.2), scl3(QX, head.R, fl * 0.32), scl3(QY, head.T, fl * 0.7), scl3(QZ, head.U, fl * 0.32), p.colour.accent, 'glow', 0, true);
      dotPart(sink, madd3(QO, head.p, head.T, fl * 0.5), 0.05 * H, 0.5 + 0.5 * glowK);
    }
    copy3(prevApex, head.p);
    for (let b = 0; b < K; b++) {
      const d = lead + b * gap;
      const f = at(path, s, d, ox, oy, cr, sr, fb);
      const phi = ((kin.freq * t + ph - b / K) % 1 + 1) % 1;
      const pulse = bellPulse(phi);
      const stretch = 1 + 0.18 * (1 - pulse);
      const apex = f.p;
      // the stem links the float and each bell's apex
      if (b > 0 || K > 1) bone(sink, 'rodSi', prevApex, apex, Math.max(0.004, 0.025 * H), f.U, p.colour.accent, p.colour.accent);
      const tb = bells[b], W = tb.w;
      for (let i = 0; i < prof.length; i++) {
        const rg = prof[i], gg = rg.u ** 1.5; // the rim contracts most, the apex barely
        madd3(tb.c[i], apex, f.T, -(rg.u * H * stretch));
        copy3(tb.U[i], f.U); copy3(tb.R[i], f.R);
        W[i] = tb.h[i] = Rrim * rg.r * (1 - (1 - pulse) * gg);
      }
      sink.tube(b, tb.c, tb.U, tb.R, W, W);
      // comb rows (ctenophore): glow dots down each facet edge, shimmering in a wave that runs apex → rim
      for (let j = 0; j < combRows; j++) {
        const a = (2 * Math.PI * j) / combRows + Math.PI / sides;
        for (let q = 0; q < combDots; q++) {
          const u = 0.22 + 0.62 * (q / (combDots - 1));
          const rad = Rrim * combR[q] * (1 - (1 - pulse) * u ** 1.5) * 1.02;
          madd3(T1, scl3(T1, f.R, Math.cos(a) * rad), f.U, Math.sin(a) * rad);
          const o = add3(T2, madd3(T2, apex, f.T, -(u * H * stretch)), T1);
          const sh = Math.max(0, Math.sin(2 * Math.PI * (1.6 * t - 2 * u - j / combRows) + ph));
          dotPart(sink, o, Math.max(0.003, 0.014 * H), glowK * (0.06 + 0.8 * sh ** 4));
        }
      }
      const rimR = W[W.length - 1], rimC = madd3(T3, apex, f.T, -(H * stretch));
      sink.part('ring', rimC, scl3(QX, f.R, rimR), scl3(QY, f.T, rimR * 0.12), scl3(QZ, f.U, rimR), p.colour.accent, p.colour.accent, 0, false);
      // inner crystal core (manubrium) and dot eyes on the rim vertices
      const core = madd3(T4, apex, f.T, -0.42 * H * stretch);
      sink.part('crystal', core, scl3(QX, f.R, 0.12 * Rrim), scl3(QY, f.T, 0.22 * H), scl3(QZ, f.U, 0.12 * Rrim), p.colour.accent, 'glow', 0.6 * glowK, false);
      if (p.head.eyes > 0) for (let j = 0; j < sym; j++) {
        const a = (2 * Math.PI * j) / sym;
        madd3(T1, scl3(T1, f.R, Math.cos(a) * W[W.length - 1] * 1.03), f.U, Math.sin(a) * W[W.length - 1] * 1.03);
        const rim = add3(T2, madd3(T2, apex, f.T, -(H * stretch)), T1);
        dotPart(sink, rim, Math.max(0.004, p.head.eyeSize * H * 0.5), 0.4 + 0.4 * glowK);
      }
      copy3(prevApex, apex);
    }
    // siphosome: stiff lattice tendrils with 15° joints hanging back from the last bell, lit like a pyrosome
    const last = fb;
    if (p.radial.trail > 0) {
      const base = madd3(T5, prevApex, last.T, -0.5 * H);
      const nT = 3, segs = 8, segL = (p.radial.trail * H) / segs;
      for (let k = 0; k < nT; k++) {
        const a = (2 * Math.PI * k) / nT + 0.4;
        const radial = madd3(T1, scl3(T1, last.fR, Math.cos(a)), last.fU, Math.sin(a));
        const pt = madd3(T2, base, radial, 0.25 * Rrim);
        const dir = scl3(T3, last.T, -1);
        norm3(dir, madd3(dir, dir, radial, 0.25));
        for (let j = 0; j < segs; j++) {
          const sway = snap((14 * Math.sin(0.7 * t - 0.6 * j + 2 * k + ph)) * D2R, STEP_DEG);
          norm3(dir, rotate3(dir, dir, norm3(T4, cross3(T4, dir, radial)), sway * 0.5));
          norm3(dir, madd3(dir, dir, UP, -0.08)); // lattice droops slightly
          const nxt = madd3(T6, pt, dir, segL);
          bone(sink, 'rodSi', pt, nxt, Math.max(0.003, 0.024 * H), radial, p.colour.accent, p.colour.accent);
          dotPart(sink, nxt, Math.max(0.003, 0.018 * H), glowK * (0.15 + 0.6 * Math.max(0, Math.sin(2 * Math.PI * (0.7 * t - j / segs) + k)) ** 3));
          if (j % 2 === 1) { // side spurs at ±60° (lattice branching)
            const sd = norm3(T7, rotate3(T7, dir, radial, 60 * D2R * (j % 4 === 1 ? 1 : -1)));
            bone(sink, 'rodSi', nxt, madd3(T8, nxt, sd, segL * 0.5), Math.max(0.002, 0.009 * H), radial, p.colour.accent, p.colour.accent);
          }
          copy3(pt, nxt);
        }
      }
    }
    at(path, s, chainLen * 0.4, ox, oy, cr, sr, mid);
    copy3(out.centre, mid.p); copy3(out.forward, head.T);
    return out;
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
