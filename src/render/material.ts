// The one world material (Red World look; Bruno Simon folio-2025 MeshDefaultMaterial technique, MIT), ported from
// mockups/red-world/src/material.ts with its scene specifics stripped. A Lambert node material whose outputNode does:
//   base colour (colorNode × vertex colour × instance colour) → ground bounce → cel core-shadow terminator (N·L, no
//   shadow maps) → shadow mixed toward the tinted shadow colour → flora translucency → foreground value push →
//   range fog + valley haze toward the lilac haze → HDR glow (luminance-normalised, > 1 so bloom threshold 1 catches it).
// All custom look nodes live here (owner ruling, docs/features/art-layer.md). Every distance is patch-relative.
//
//   const mat = worldMaterial({ kind: 'flora', vertexColors: true, glowAttr: 'aGlow', swayAttr: 'aSway', translucent: true });
//   updateLook(inputs, camera, dt, patch);   // once per frame, first in world.ts's step
//
// Uniforms in LOOK and PAL are shared by every worldMaterial and by sky/post code that wants the same air.
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec3, vec4, mix, max, min, normalWorld, positionWorld, positionLocal, attribute, uniform, cameraPosition,
  sin, cos, screenCoordinate, exp, smoothstep, floor, mod, clamp, dot, diffuseColor, abs, pow, normalize, If, Discard, step,
  positionGeometry, normalGeometry, normalLocal, vertexIndex,
} from 'three/tsl';
import type { VisualInputs } from '../worlds/types';
import { LOOK_PALETTES, lookPalette, type LookKey, type LookPalette } from './palette';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export type LookKind = 'ground' | 'flora' | 'fauna' | 'sea' | 'prop' | 'backdrop';
export interface WorldMaterialOpts {
  kind: LookKind;
  /** Overrides the material colour (e.g. the terrain colour field). Multiplied by vertex/instance colour if present. */
  colorNode?: N;
  /** Read attribute `color` (linear rgb). Instance colours (InstancedMesh.instanceColor) always apply. */
  vertexColors?: boolean;
  /** Float attribute, 0..1 emissive weight → LOOK glow colour at HDR > 1 ('name.c': one component of a vec4). */
  glowAttr?: string | null;
  /** Float attribute, 0..1 wind weight (0 at the base, rising to the tips) ('name.c': one component of a vec4). */
  swayAttr?: string | null;
  /** Flora underside translucency + far pale-tissue tint (default: true for kind 'flora'). */
  translucent?: boolean;
  /** Faceted normals. */
  flat?: boolean;
  side?: number;
  /** Cut-out around the camera→LOOK.focus line (default: true for 'flora'; pixel mode: hard edge, smooth: dither). It adds a discard, which costs
   *  early-z on every fragment of the material, so turn it off on buckets that can't hide the player (far LOD, ground cover). */
  cutout?: boolean;
  /** Fresnel rim toward PAL.bone, 0..1 strength (fauna). */
  rim?: number;
  /** Per-instance vec4 attribute of shape terms (crown, twist, droop, bend; floraLib/instance.ts plantShape) that bends
   *  each instance in its own frame before instancing (flora: every plant its own). Every geometry drawn with the
   *  material needs it (zeros draw the native shape). */
  plantAttr?: string | null;
  /** Per-instance vec4 attribute (tint r, g, b, glow; floraLib/instance.ts plantLook): the colour multiplier and glow of
   *  each instance. With it, `glowAttr` holds signed glow-site weights (floraLib paintSites: + glow, − glowDeep), lit by
   *  the instance's glow. */
  lookAttr?: string | null;
  /** Per-vertex rim weight ('name.c'), with lookAttr: a toothed plant's rim vertices take a saw edge (T6). */
  rimAttr?: string | null;
}

/** Pixel mode (the default look). `?style=smooth` is the comparison view. post.ts reads the same flag. */
export const PIXEL = typeof location === 'undefined' || new URLSearchParams(location.search).get('style') !== 'smooth';

const lin = (hex: number) => new THREE.Color(hex);
const LUMA = vec3(0.2126, 0.7152, 0.0722);

/** Live palette colours (linear), one uniform per role. Unmodulated: what vertex colours are authored in. */
export const PAL = {} as Record<LookKey, N>;
/** The same roles after star modulation (dim + tint): for unlit things such as the sky and fog. */
export const PAL_LIT = {} as Record<LookKey, N>;
for (const k of Object.keys(LOOK_PALETTES.carbon) as LookKey[]) {
  PAL[k] = uniform(lin(LOOK_PALETTES.carbon[k]));
  PAL_LIT[k] = uniform(lin(LOOK_PALETTES.carbon[k]));
}

/** Shared look uniforms. Distances in metres, derived from the patch size each frame by updateLook. */
export const LOOK: Record<string, N> = {
  // air
  fogColor: uniform(lin(LOOK_PALETTES.carbon.haze)),
  hazeColor: uniform(lin(LOOK_PALETTES.carbon.haze)),
  skyZenith: uniform(lin(LOOK_PALETTES.carbon.skyZenith)),
  skyHorizon: uniform(lin(LOOK_PALETTES.carbon.skyHorizon)),
  fogStart: uniform(48),
  fogDist: uniform(400),
  hazeDist: uniform(160),
  hazeBase: uniform(-2),
  hazeHeight: uniform(24),
  hazeAmount: uniform(0.42),
  camAlt: uniform(0),        // camera height above the ground under it
  // light: the star's direction (matches the star disc in sky.ts; whoever moves the star sets this), reference warm white
  lightDir: uniform(new THREE.Vector3(0.55, 0.7, 0.45).normalize()),
  lightColor: uniform(new THREE.Color(1.0, 0.97, 0.93)),
  ambient: uniform(1),       // star dimming on the shadow side (0.12..1)
  shadowTint: uniform(lin(LOOK_PALETTES.carbon.shadow)),
  shadowMix: uniform(0.86),
  shadowGain: uniform(0.82),
  coreLow: uniform(-0.12),
  coreHigh: uniform(0.42),
  bounce: uniform(lin(LOOK_PALETTES.carbon.red)),
  bounceDist: uniform(16),
  bounceStrength: uniform(0.6),
  groundY: uniform(0),       // ground height under the camera, the bounce falloff's floor
  // depth planes
  fgNear: uniform(2),
  fgFar: uniform(14),
  fgPush: uniform(0.55),
  fgTint: uniform(new THREE.Vector3(0.32, 0.12, 0.2)), // per-channel multiplier toward ink/crimson (reference)
  paleNear: uniform(240),
  paleFar: uniform(1000),
  // glow and wind
  glowColor: uniform(lin(LOOK_PALETTES.carbon.glow)),
  glowK: uniform(2.6),
  wind: uniform(0.6),
  time: uniform(0),
  camPos: uniform(new THREE.Vector3()),
  // flora cut-out around the camera→focus line (the player), so plants never hide the character. Far away = off.
  focus: uniform(new THREE.Vector3(1e6, 1e6, 1e6)),
  focusR: uniform(2.5),
  patch: uniform(400),
  brightness: uniform(1),
  // underwater overlay (render-only): sky.ts writes these once per frame, post.ts reads them
  underwater: uniform(0),    // eased submersion 0..1; exactly 0 above the waterline window, on frozen seas and with no sea
  waterTint: uniform(lin(LOOK_PALETTES.carbon.shadow)), // the liquid's lit tint the overlay grades toward
  waterClear: uniform(0),    // 0 water (dense, dark) .. 1 liquid nitrogen (clear, pale)
  waterDepth: uniform(0),    // camera depth under the surface as a fraction of the grade's full depth, 0..1
};

/** Ordered 4×4 Bayer threshold in [0, 1) from the (internal) pixel coordinate (for sky/fog dithering). */
export const bayer4 = Fn(() => {
  const p = floor(screenCoordinate.xy);
  const b2 = (x: N, y: N) => mod(x.mul(2).add(y.mul(3)), 4);
  const lo = b2(mod(p.x, 2), mod(p.y, 2)), hi = b2(mod(floor(p.x.div(2)), 2), mod(floor(p.y.div(2)), 2));
  return lo.mul(4).add(hi).add(0.5).div(16);
});

/** HDR glow colour: luminance-normalised so every hue blooms equally, × LOOK.glowK (> 1 passes bloom threshold 1). */
export const glowHDR = (k: N = LOOK.glowK): N => vec3(LOOK.glowColor).div(dot(vec3(LOOK.glowColor), LUMA).max(1e-3)).mul(k);

/** Range fog + valley haze factor 0..1 at world position p (pixel mode quantises it into 16 steps). */
export const fogAt = (p: N): N => {
  const dist = p.sub(cameraPosition).length();
  // height-aware air: at walking height this is the ground fog; flying, the clear zone and fog length grow with altitude
  const alt = max(LOOK.camAlt.sub(8), 0);
  const fogStart = LOOK.fogStart.add(alt.mul(2.4));
  const fogDist = LOOK.fogDist.mul(alt.div(LOOK.patch.mul(1.1)).add(1));
  const range = float(1).sub(exp(max(dist.sub(fogStart), 0).div(fogDist).negate()));
  const haze = float(1).sub(exp(max(dist.sub(fogStart.mul(0.6)), 0).div(LOOK.hazeDist.mul(alt.div(LOOK.patch.mul(0.75)).add(1))).negate()))
    .mul(exp(max(p.y.sub(LOOK.hazeBase), 0).div(LOOK.hazeHeight).negate())).mul(LOOK.hazeAmount)
    .mul(float(1).sub(smoothstep(LOOK.patch.mul(0.05), LOOK.patch.mul(0.8), alt).mul(0.55)));
  const f = clamp(max(range, haze), 0, 1).toVar();
  if (PIXEL) f.assign(floor(f.mul(16).add(0.5)).div(16));
  return f;
};

/**
 * The shape terms of `plantAttr`, applied to the geometry in the plant's own (native, pre-instance) frame, with y up
 * from its base: crown scale 1 + c·y² on x/z, then a turn of t·y about the stem, a drop of d·r²·y² (r: distance from the
 * stem) and a bend of b·y² along +X. Normals take the matching first-order correction n − (∇δ)ᵀn (the twist's shear
 * is left out: it is zero on surfaces of revolution).
 */
const plantDeform = (name: string, teeth?: { look: string; rim: string }) => (): void => {
  const P = attribute(name, 'vec4');
  const p = positionGeometry, n = normalGeometry;
  const c = P.x, t = P.y, d = P.z, b = P.w;
  const y = max(p.y, 0), y2 = y.mul(y);
  const r2 = p.x.mul(p.x).add(p.z.mul(p.z));
  // margin teeth (T6): on a toothed plant, every other rim vertex is pulled TEETH_DEPTH toward the stem, a saw edge
  const jag = teeth ? lookTeeth(attribute(teeth.look, 'vec4')).mul(attr1(teeth.rim)).mul(mod(float(vertexIndex), 2)).mul(TEETH_DEPTH) : float(0);
  const k = c.mul(y2).add(1).mul(float(1).sub(jag));
  const a = t.mul(y), ca = cos(a), sa = sin(a);
  const xk = p.x.mul(k), zk = p.z.mul(k);
  positionLocal.assign(vec3(
    xk.mul(ca).sub(zk.mul(sa)).add(b.mul(y2)),
    p.y.sub(d.mul(r2).mul(y2)),
    xk.mul(sa).add(zk.mul(ca)),
  ));
  // crown and droop in the native frame, then the turn, then the bend (it acts along +X after the turn)
  const cy2 = c.mul(y2), dy2 = d.mul(y2).mul(2);
  const nx = n.x.sub(cy2.mul(n.x)).add(dy2.mul(p.x).mul(n.y));
  const ny = n.y.sub(y.mul(2).mul(c).mul(p.x.mul(n.x).add(p.z.mul(n.z)))).add(d.mul(2).mul(r2).mul(y).mul(n.y));
  const nz = n.z.sub(cy2.mul(n.z)).add(dy2.mul(p.z).mul(n.y));
  const rx = nx.mul(ca).sub(nz.mul(sa)), rz = nx.mul(sa).add(nz.mul(ca));
  normalLocal.assign(normalize(vec3(rx, ny.sub(y.mul(2).mul(b).mul(rx)), rz)));
};

/** Lambert node material that runs a deformation on the geometry before three applies instancing (in r187 the
 * positionNode runs after it, in the instanced frame), the way skinning and morphs do. */
class PlantMaterial extends THREE.MeshLambertNodeMaterial {
  deform: (() => void) | null = null;
  setupPosition(builder: N): N {
    this.deform?.();
    return super.setupPosition(builder);
  }
  customProgramCacheKey(): string {
    return 'plant:' + super.customProgramCacheKey();
  }
}

/** A float attribute by name, or one component of a vec4 attribute as 'name.c' (e.g. 'aVtx.y': a packed look's glow). */
const attr1 = (name: string): N => {
  const [n, c] = name.split('.');
  return c ? (attribute(n, 'vec4') as N)[c] : attribute(n, 'float');
};

/** How far a toothed rim's alternate vertices are pulled toward the stem (share of their distance) ([art], T6). */
const TEETH_DEPTH = 0.18;
/** lookAttr packs a plant's glow 0..1 and its margin teeth 0/1 into w = glow + 2 × teeth (floraLib/instance.ts plantLook). */
const lookTeeth = (look: N): N => floor(look.w.mul(0.5));
const lookGlow = (look: N): N => look.w.sub(lookTeeth(look).mul(2));

/** A plant's own glow and tint (lookAttr: vec4(r, g, b, glow + 2·teeth)) on colours painted by floraLib paintSites: its glow sites
 * (signed weight `glowW`: + glow, − glowDeep) turn toward their glow colour by min(1, 1.5 g), as paint() does at that glow,
 * then the tint applies. */
const plantSiteColour = (base: N, look: N, glowW: N): N => {
  // ÷ the neutral tint (paintSites' headroom), so a glow site at the neutral tint shows its exact glow colour
  const key = mix(vec3(PAL.glowDeep), vec3(PAL.glow), step(0, glowW)).div(0.9);
  return mix(base, key, min(lookGlow(look).mul(1.5), 1).mul(step(1e-4, abs(glowW)))).mul(look.xyz);
};

/** The world's plants drawn outside the world look (the inspect card's live view, standard lighting): bent per instance
 * like the world's, with each instance's own tint and glow. Its geometry needs `color` and `aGlow` painted by
 * paintSites, and per-instance `plantAttr` (shape) and `lookAttr` (tint, glow) attributes. */
class PlantViewMaterial extends THREE.MeshStandardNodeMaterial {
  deform: (() => void) | null = null;
  setupPosition(builder: N): N {
    this.deform?.();
    return super.setupPosition(builder);
  }
  customProgramCacheKey(): string {
    return 'plantView:' + super.customProgramCacheKey();
  }
}
export function plantViewMaterial(opts: { plantAttr: string; lookAttr: string; glowAttr: string; rimAttr?: string }): N {
  const m = new PlantViewMaterial({ side: THREE.DoubleSide, roughness: 0.7 });
  m.deform = plantDeform(opts.plantAttr, opts.rimAttr ? { look: opts.lookAttr, rim: opts.rimAttr } : undefined);
  const look = attribute(opts.lookAttr, 'vec4'), glowW = attr1(opts.glowAttr);
  m.colorNode = plantSiteColour(attribute('color', 'vec3'), look, glowW);
  m.emissiveNode = vec3(PAL.glow).mul(abs(glowW).mul(lookGlow(look)).mul(0.8)); // no bloom here: the sites just light up
  m.userData.look = 'flora';
  return m;
}

export function worldMaterial(opts: WorldMaterialOpts): N {
  const kind = opts.kind;
  const translucent = opts.translucent ?? kind === 'flora';
  const bounce = kind !== 'sea' && kind !== 'backdrop' && kind !== 'ground';
  const m = opts.plantAttr ? new PlantMaterial() : new THREE.MeshLambertNodeMaterial();
  if (opts.plantAttr && m instanceof PlantMaterial) m.deform = plantDeform(opts.plantAttr, opts.rimAttr && opts.lookAttr ? { look: opts.lookAttr, rim: opts.rimAttr } : undefined);
  m.side = (opts.side ?? THREE.FrontSide) as THREE.Side;
  m.vertexColors = opts.vertexColors === true;
  m.flatShading = opts.flat === true;
  m.fog = false; // the outputNode does its own air
  m.userData.look = kind;
  if (opts.colorNode) m.colorNode = opts.colorNode;
  const glowW: N = opts.glowAttr ? attr1(opts.glowAttr) : null;
  const look: N = opts.lookAttr ? attribute(opts.lookAttr, 'vec4') : null;

  if (opts.swayAttr) {
    // positionNode runs after instancing in r187: positionLocal is already instance-transformed (identity mesh)
    const s = attr1(opts.swayAttr);
    const ph = positionLocal.x.mul(0.13).add(positionLocal.z.mul(0.17));
    const t = LOOK.time;
    const near = smoothstep(2, 12, positionLocal.sub(cameraPosition).length()).mul(0.3).add(0.7); // fg sway damped 30%
    const amp = s.mul(s).mul(LOOK.wind);
    const off = vec3(sin(t.mul(0.55).add(ph)).add(sin(t.mul(1.3).add(ph.mul(2.1))).mul(0.3)), 0, cos(t.mul(0.43).add(ph.mul(1.3))).mul(0.6)).mul(amp).mul(near);
    m.positionNode = positionLocal.add(off);
  }

  m.outputNode = Fn(() => {
    if (opts.cutout ?? kind === 'flora') {
      // cut-out in a cylinder from the camera to the focus, widening toward the focus
      const C = cameraPosition, F = vec3(LOOK.focus), P = positionWorld;
      const CF = F.sub(C);
      const len2 = dot(CF, CF).max(1e-4);
      const t = dot(P.sub(C), CF).div(len2);
      const d = P.sub(C.add(CF.mul(t))).length();
      const inside = t.greaterThan(0).and(t.lessThan(1)).and(len2.lessThan(1e6));
      const fade = float(1).sub(smoothstep(LOOK.focusR.mul(0.6), LOOK.focusR, d.div(t.mul(0.65).add(0.35))));
      // Pixel mode cuts with one hard edge (mid-band): a dithered band leaves kept plant pixels beside discarded ones,
      // and post.ts's depth-edge ink then fires on nearly every kept pixel (a dark speckled ring). Smooth keeps the dither.
      If(inside.and(PIXEL ? fade.greaterThan(0.5) : bayer4().lessThan(fade)), () => { Discard(); });
    }
    // diffuseColor = colorNode (or material colour) × vertex colour × instance colour, with opacity in .a
    const base = vec3(diffuseColor.rgb).toVar();
    if (look && glowW) base.assign(plantSiteColour(base, look, glowW));
    else if (look) base.assign(base.mul(look.xyz));
    const N = normalWorld;
    const col = base.toVar();
    const dist = positionWorld.sub(cameraPosition).length();

    if (translucent) {
      // pale tissue tints toward blush/crimson with distance, so far groves read as masses, not white speckle
      const pale = smoothstep(0.45, 0.75, dot(base, LUMA));
      const far = smoothstep(LOOK.paleNear, LOOK.paleFar, dist);
      base.assign(mix(base, mix(vec3(PAL.blush), vec3(PAL.crimson), 0.6), pale.mul(far).mul(0.9)));
      col.assign(base);
    }

    if (bounce) {
      // ground bounce: down-facing surfaces near the ground pick up the ground colour
      const orient = dot(N, vec3(0, -1, 0)).smoothstep(-0.3, 1.0);
      const fall = float(1).sub(clamp(positionWorld.y.sub(LOOK.groundY).add(2).div(LOOK.bounceDist), 0, 1)).pow(1.5);
      col.assign(mix(col, vec3(LOOK.bounce), orient.mul(fall).mul(LOOK.bounceStrength)));
    }

    const lit = col.mul(LOOK.lightColor);
    const ndl = dot(N, LOOK.lightDir);
    const shade = float(1).sub(smoothstep(LOOK.coreLow, LOOK.coreHigh, ndl)).toVar();
    if (translucent) {
      // thin pale bands glow through on their undersides; dark ones stay shadowed
      const trans = dot(base, LUMA).mul(0.8).mul(max(N.y.negate(), 0));
      shade.assign(min(shade, float(1).sub(trans)));
    }
    if (PIXEL) shade.assign(floor(shade.mul(2).add(0.5)).div(2));
    const shadowCol = mix(col, vec3(LOOK.shadowTint), LOOK.shadowMix).mul(LOOK.shadowGain).mul(LOOK.ambient);
    const out = mix(lit, shadowCol, shade).toVar();

    if (kind !== 'backdrop' && kind !== 'sea') {
      // foreground value push: the nearest plane goes darker and more saturated (ink/crimson family)
      const fg = float(1).sub(smoothstep(LOOK.fgNear, LOOK.fgFar, dist)).mul(LOOK.fgPush);
      out.assign(mix(out, out.mul(vec3(LOOK.fgTint)), fg));
    }

    if (opts.rim) {
      const V = normalize(cameraPosition.sub(positionWorld));
      const fres = pow(float(1).sub(abs(dot(N, V))), 3).mul(opts.rim);
      out.assign(mix(out, vec3(PAL.bone), fres));
    }

    const f = fogAt(positionWorld);
    out.assign(mix(out, vec3(LOOK.fogColor), f));

    if (glowW) {
      const weight = (look ? abs(glowW).mul(lookGlow(look)) : glowW).mul(f.oneMinus()).clamp(0, 1);
      out.assign(mix(out, glowHDR(), weight));
    }
    return vec4(out, diffuseColor.a);
  })();
  return m;
}

const _c = new THREE.Color();
const setHex = (u: N, hex: number) => { u.value.setHex(hex); };
let lastPal: LookPalette | null = null;

/** The palette updateLook last applied (null before the first frame). */
export function currentLook(): LookPalette | null {
  return lastPal;
}

/**
 * Drive every LOOK/PAL uniform from the inputs. Call once per frame, first in world.ts's step, before any part reads
 * LOOK. `patch` is the terrain patch size in metres (default 400).
 */
export function updateLook(inputs: VisualInputs, camera: THREE.Camera, dt: number, patch = 400): void {
  const p = lookPalette(inputs);
  lastPal = p;
  for (const k of Object.keys(p.base) as LookKey[]) {
    setHex(PAL[k], p.base[k]);
    setHex(PAL_LIT[k], p[k]);
  }
  setHex(LOOK.fogColor, p.haze);
  setHex(LOOK.hazeColor, p.haze);
  setHex(LOOK.skyZenith, p.skyZenith);
  setHex(LOOK.skyHorizon, p.skyHorizon);
  setHex(LOOK.shadowTint, p.base.shadow);
  setHex(LOOK.bounce, p.base.red);
  setHex(LOOK.glowColor, p.base.glow);
  // key light: the reference sun × star tint × dimming; the shadow side dims the same way
  _c.setHex(p.starTint);
  LOOK.lightColor.value.setRGB(1.0 * _c.r * p.dim, 0.97 * _c.g * p.dim, 0.93 * _c.b * p.dim);
  LOOK.ambient.value = p.dim;
  LOOK.brightness.value = p.brightness;
  LOOK.fgTint.value.set(...(p.kind === 'silicon' ? [0.16, 0.14, 0.34] : [0.32, 0.12, 0.2]) as [number, number, number]);

  // patch-relative air. Reference: clear midground, fog from ~0.1 world, ranges at the world edge ~90% white.
  // Here the patch (400 m) is the world and the far plane (1000 m) closes it: fog starts at 0.12 patch,
  // e-folds every patch length, so the patch edge (~0.5-1 patch away) is a third to half hazed and 2.5 patch is white.
  LOOK.patch.value = patch;
  LOOK.fogStart.value = 0.12 * patch;
  LOOK.fogDist.value = patch / (1 + p.airHaze);
  LOOK.hazeDist.value = (0.4 * patch) / (1 + p.airHaze);
  LOOK.hazeHeight.value = 0.06 * patch;
  LOOK.hazeBase.value = inputs.seaLevel - 2;
  LOOK.bounceDist.value = 0.04 * patch;
  LOOK.paleNear.value = 0.6 * patch;
  LOOK.paleFar.value = 2.5 * patch;
  LOOK.fgNear.value = 0.005 * patch;
  LOOK.fgFar.value = 0.035 * patch;

  LOOK.time.value += dt;
  LOOK.camPos.value.copy(camera.position);
  const gy = inputs.terrain.height(camera.position.x, camera.position.z);
  const ground = Number.isFinite(gy) ? Math.max(gy, inputs.seaLevel) : 0;
  LOOK.groundY.value = ground;
  LOOK.camAlt.value = Math.max(0, camera.position.y - ground);
}
