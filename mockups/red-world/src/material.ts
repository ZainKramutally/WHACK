// One world material (Bruno Simon folio-2025 MeshDefaultMaterial technique, MIT): Lambert node material whose
// outputNode does palette colour → ground bounce → cel core shadow + captured cast shadow tinted with PALETTE.shadow
// → foreground value push → range + valley-haze fog toward the sky white → HDR glow (blooms past threshold 1).
// Pixel mode quantises shadow into 3 bands and fog into dithered steps (dither only in the fog gradient).
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, mix, max, normalWorld, positionWorld, positionLocal, attribute, uniform, cameraPosition,
  sin, cos, screenCoordinate, frontFacing, If, exp, smoothstep, floor, mod, texture, mx_worley_noise_vec2, clamp, dot,
  normalize, pow, fract, mx_noise_float, mx_noise_vec3, step, dFdx, dFdy, cross,
} from 'three/tsl';
import { PALETTE } from './contracts';
import { ENV } from './env/active';
import { DATA_RECT, HERO, EXPLORER, CORNER_CAP } from './layout';
import { heightAt } from './field';

const HERO_BASE_Y = heightAt(HERO.x, HERO.z);

export const PIXEL = new URLSearchParams(location.search).get('style') !== 'smooth';

/**
 * Air colour A/B (?fog=<name>, default 'lilac' = PALETTE.haze/skyHorizon; 'current' = the original warm haze). Each preset sets the fog/haze colour, the matching sky horizon stop
 * (so sky and fog meet seamlessly) and a density multiplier. The zenith stays white; ground/flora/shadow are untouched.
 */
export const FOG_PRESETS = {
  lilac: { haze: PALETTE.haze, horizon: PALETTE.skyHorizon, density: 1 },   // default (human pick): #e4daef / #f3eef8
  current: { haze: 0xfde9e2, horizon: 0xfff6ee, density: 1 },              // the original warm white-pink haze
  teal: { haze: 0xd6ece8, horizon: 0xedf6f3, density: 1 },
  apricot: { haze: 0xfbd8c2, horizon: 0xfdede2, density: 1.05 },
  ash: { haze: 0xdcd6dc, horizon: 0xebe8eb, density: 1.3 },
  sulfur: { haze: 0xececcd, horizon: 0xf6f5e6, density: 1.1 }, // wildcard: pale toxic yellow-green, alien and dry
} as const;
export type FogName = keyof typeof FOG_PRESETS;
const fogParam = new URLSearchParams(location.search).get('fog') as FogName | null;
/** No ?fog: the active environment's air (environmentFrom → palette.haze/skyHorizon + fog density). */
export const FOG: { haze: number; horizon: number; density: number } = fogParam && fogParam in FOG_PRESETS ? FOG_PRESETS[fogParam]
  : { haze: PALETTE.haze, horizon: PALETTE.skyHorizon, density: ENV.fog.density };

const c3 = (hex: number) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };
const lin = (hex: number) => new THREE.Color(hex);

export const U = {
  lightDir: uniform(new THREE.Vector3(-0.62, 0.5, -0.6).normalize()),
  sun: uniform(lin(ENV.light.sun).multiplyScalar(ENV.light.intensity)),
  shadowTint: uniform(lin(PALETTE.shadow)),
  shadowMix: uniform(ENV.light.shadowMix),
  shadowGain: uniform(0.82),
  coreLow: uniform(-0.12),
  coreHigh: uniform(0.42),
  bounceDist: uniform(140),
  bounceStrength: uniform(0.6),
  fogColor: uniform(lin(FOG.haze)),
  fogStart: uniform(420 * ENV.fog.startScale),
  fogDist: uniform(3800 / FOG.density),
  hazeDist: uniform(1500),
  hazeBase: uniform(-8),
  hazeHeight: uniform(55),
  hazeAmount: uniform(fogParam ? Math.min(0.7, 0.42 * FOG.density) : ENV.fog.hazeAmount),
  fgPush: uniform(0.82),
  glowK: uniform(2.6 * ENV.glow.strength),
  windK: uniform(0.6 * ENV.flora.sway),
  // environment (src/env/derive.ts): ground character + flora pigment
  sheen: uniform(ENV.ground.sheen),
  banding: uniform(ENV.ground.banding),
  ice: uniform(ENV.ground.ice),
  deadBands: uniform(ENV.ground.deadBands),
  prismatic: uniform(ENV.ground.prismatic),
  seaLevel: uniform(-1e4),   // set by sea.ts
  floraTint: uniform(lin(ENV.flora.tint)),
  floraTintAmt: uniform(ENV.flora.tintAmount),
  time: uniform(0),
  lamp: uniform(new THREE.Vector3(EXPLORER.x, 0, EXPLORER.z)), // explorer lamp (main.ts follows the avatar)
};

/** Ordered 4×4 Bayer threshold in [0, 1) from the (internal) pixel coordinate. */
export const bayer4 = Fn(() => {
  const p = floor(screenCoordinate.xy);
  const b2 = (x: any, y: any) => mod(x.mul(2).add(y.mul(3)), 4);
  const lo = b2(mod(p.x, 2), mod(p.y, 2)), hi = b2(mod(floor(p.x.div(2)), 2), mod(floor(p.y.div(2)), 2));
  return lo.mul(4).add(hi).add(0.5).div(16);
});

// ---- ground colour field (Bruno Terrain.js idea): one data texture drives the ground colour AND the bounce colour
let groundTex: any = null;
export function setGroundTexture(t: any) { groundTex = t; }

export const groundColor = Fn(([xz]: any[]) => {
  const uvT = xz.sub(vec2(DATA_RECT.x0, DATA_RECT.z0)).div(vec2(DATA_RECT.x1 - DATA_RECT.x0, DATA_RECT.z1 - DATA_RECT.z0));
  const d = texture(groundTex, uvT);
  const c = mix(c3(PALETTE.red), c3(PALETTE.redLight), smoothstep(0.5, 0.85, d.b)).toVar();
  c.assign(mix(c, c3(PALETTE.crimson), d.g.mul(0.85)));
  // bank light: the river mask blurred over ~±7 m lifts the ground beside every bed toward redLight/blush
  const o = vec2(7 / (DATA_RECT.x1 - DATA_RECT.x0), 7 / (DATA_RECT.z1 - DATA_RECT.z0));
  const near = texture(groundTex, uvT.add(vec2(o.x, 0))).r.add(texture(groundTex, uvT.sub(vec2(o.x, 0))).r)
    .add(texture(groundTex, uvT.add(vec2(0, o.y))).r).add(texture(groundTex, uvT.sub(vec2(0, o.y))).r).mul(0.25);
  c.assign(mix(c, mix(c3(PALETTE.redLight), c3(PALETTE.blush), 0.3), near.mul(d.r.oneMinus()).mul(0.55)));
  // dry salt bed: pale blush/bone with polygonal crack lines
  const w = mx_worley_noise_vec2(xz.mul(0.32));
  const crack = smoothstep(0.1, 0.03, w.y.sub(w.x));
  // leading line brightens toward the focal point: maroon/crimson near the camera → blush → bone at the hero's base
  const along = d.a;
  const bed = mix(c3(PALETTE.maroon), c3(PALETTE.crimson), smoothstep(0.0, 0.1, along)).toVar();
  bed.assign(mix(bed, c3(PALETTE.blush), smoothstep(0.08, 0.45, along)));
  bed.assign(mix(bed, c3(PALETTE.bone), smoothstep(0.45, 0.9, along).mul(0.6).add(smoothstep(0.3, 0.7, d.b).mul(0.25)).clamp(0, 1)));
  const crackCol = mix(c3(PALETTE.ink), c3(PALETTE.crimson), smoothstep(0.1, 0.5, along));
  c.assign(mix(c, mix(bed, crackCol, crack.mul(0.8)), d.r));
  return c;
});

export interface WorldMatOpts {
  colorNode?: any;
  glow?: boolean;       // read aGlow
  sway?: boolean;       // read aSway (+ instanced aScale if instanced)
  instanced?: boolean;
  side?: any;
  bounce?: boolean;
  fog?: boolean;
  castShadowFlag?: boolean;
  translucent?: boolean; // flora: pale down-facing tissue lets light through (rw-flora's banded undersides)
  lampPool?: boolean;    // terrain: faint cyan pool under the explorer's lamp
  facet?: boolean;       // flat per-triangle normal from screen derivatives (silicon crystal tissue), no geometry cost
  surface?: 'ground' | 'rock'; // environment ground character: metallic crusts + glints, frost/bedrock, BIF bands, shore rings
}

const LUMW = vec3(0.2126, 0.7152, 0.0722);
const ROCK = ENV.ground.rock;

export function worldMaterial(o: WorldMatOpts = {}): any {
  const m = new THREE.MeshLambertNodeMaterial();
  m.side = o.side ?? THREE.FrontSide;
  const colorNode = o.colorNode ?? attribute('color', 'vec3');
  const glowW = o.glow ? attribute('aGlow', 'float') : float(0);

  if (o.sway) {
    // positionNode runs after instancing in r187: positionLocal is already instance-transformed (mesh at identity)
    const s = attribute('aSway', 'float');
    const sc = o.instanced ? attribute('aScale', 'float') : float(1);
    const ph = positionLocal.x.mul(0.013).add(positionLocal.z.mul(0.017));
    const t = U.time;
    const near = smoothstep(10, 60, positionLocal.sub(cameraPosition).length()).mul(0.3).add(0.7); // fg sway damped 30%
    const amp = s.mul(s).mul(U.windK).mul(sc.pow(0.6)).mul(near);
    const off = vec3(sin(t.mul(0.55).add(ph)).add(sin(t.mul(1.3).add(ph.mul(2.1))).mul(0.3)), 0, cos(t.mul(0.43).add(ph.mul(1.3))).mul(0.6)).mul(amp);
    // the hero breathes: a slow 7 s sway with tip lag (higher = later), big enough to read at 470 m (~3 internal px)
    const hero = float(1).sub(smoothstep(60, 90, positionLocal.xz.sub(vec2(HERO.x, HERO.z)).length()));
    const lag = positionLocal.y.sub(HERO_BASE_Y).mul(0.012);
    const breath = sin(t.mul((2 * Math.PI) / 7).sub(lag));
    const heroSway = vec3(breath, 0, breath.mul(0.35)).mul(s.mul(s)).mul(hero).mul(3.4);
    m.positionNode = positionLocal.add(off).add(heroSway);
  }

  const caught = float(1).toVar();
  m.receivedShadowNode = Fn(([shadow]: any[]) => { caught.mulAssign(shadow.r); return float(1); });

  m.outputNode = Fn(() => {
    const base = vec3(colorNode).toVar();
    const N = normalWorld.toVar();
    if (m.side === THREE.DoubleSide) If(frontFacing.not(), () => { N.mulAssign(-1); });
    if (o.facet) {
      // flat facet normal, oriented to the same side as the interpolated one
      const Nf = normalize(cross(dFdx(positionWorld), dFdy(positionWorld))).toVar();
      If(dot(Nf, N).lessThan(0), () => { Nf.mulAssign(-1); });
      N.assign(Nf);
    }
    const col = base.toVar();
    const dist = positionWorld.sub(cameraPosition).length();
    const P = positionWorld;
    if (o.translucent) {
      // flora pigment (environmentFrom → flora.tint): colourise by luminance, glow parts untouched
      const lum = dot(base, LUMW);
      const tinted = vec3(U.floraTint).mul(lum.div(max(dot(vec3(U.floraTint), LUMW), 0.03))).min(vec3(1.15));
      base.assign(mix(base, tinted, U.floraTintAmt.mul(glowW.oneMinus())));
      col.assign(base);
    }
    // metallic mask (specular hematite crusts / silicide; BIF steel bands) and ice sparkle, for the glint pass
    const metal = float(0).toVar();
    const sparkle = float(0).toVar();
    if (o.surface) {
      // specular hematite / silicide: a dark steel of the ground's own ink + crevice colour, made metallic by its glints
      const steel = mix(c3(PALETTE.ink), c3(PALETTE.maroon), 0.55).add(c3(PALETTE.skyZenith).mul(0.06));
      if (o.surface === 'ground') {
        const uvT = P.xz.sub(vec2(DATA_RECT.x0, DATA_RECT.z0)).div(vec2(DATA_RECT.x1 - DATA_RECT.x0, DATA_RECT.z1 - DATA_RECT.z0));
        const bed = texture(groundTex, uvT).r;
        const n = mx_noise_float(P.xz.mul(0.09)).add(mx_noise_float(P.xz.mul(0.43)).mul(0.45));
        metal.assign(smoothstep(0.42, 0.5, n).mul(U.sheen).mul(bed.oneMinus()));
        col.assign(mix(col, steel, metal.mul(0.85)));
        sparkle.assign(U.ice.mul(0.6));
        // shore rings: pale crust (or sinter) bands just above the sea, left as the level falls
        const h = P.y.sub(U.seaLevel);
        const ring = step(0.45, fract(h.div(0.9).add(mx_noise_float(P.xz.mul(0.02)).mul(0.6))))
          .mul(smoothstep(0.05, 0.35, h)).mul(float(1).sub(smoothstep(2.6, 4.2, h))).mul(U.deadBands);
        col.assign(mix(col, c3(PALETTE.bone), ring.mul(0.8)));
        // hot springs (carbon, hot): prismatic rings, pigment banded by temperature as the water cools away from the pool:
        // turquoise water → yellow → orange carotenoid mats → red-brown (Grand Prismatic Spring)
        const hp = h.add(mx_noise_float(P.xz.mul(0.03)).mul(0.6));
        const pr = mix(c3(PALETTE.bone), mix(c3(PALETTE.blush), c3(PALETTE.bone), 0.3), smoothstep(0.5, 0.7, hp)).toVar();
        pr.assign(mix(pr, vec3(U.floraTint), smoothstep(1.5, 1.7, hp)));
        pr.assign(mix(pr, c3(PALETTE.crimson), smoothstep(3.0, 3.2, hp)));
        const prW = smoothstep(-0.2, 0.1, hp).mul(float(1).sub(smoothstep(4.6, 5.6, hp))).mul(U.prismatic);
        col.assign(mix(col, pr, prW.mul(0.9)));
      } else {
        const steep = smoothstep(0.78, 0.42, N.y);
        // banded iron formation: jasper red / steel hematite-magnetite / pale chert, on cliff faces
        const bt = fract(P.y.div(16).add(mx_noise_float(P.mul(0.0035)).mul(0.9)));
        const jasper = mix(c3(PALETTE.red), c3(PALETTE.crimson), 0.35);
        const bif = mix(jasper, steel, smoothstep(0.42, 0.47, bt)).toVar();
        bif.assign(mix(bif, c3(PALETTE.blush), smoothstep(0.72, 0.76, bt)));
        const bandW = steep.mul(U.banding);
        col.assign(mix(col, bif, bandW.mul(0.9)));
        metal.assign(bandW.mul(smoothstep(0.42, 0.47, bt)).mul(float(1).sub(smoothstep(0.72, 0.76, bt))).max(U.sheen.mul(0.25).mul(steep)));
        // frost: steep faces show the bedrock under the snow (environmentFrom → ground.rock)
        const rb = fract(P.y.div(23).add(mx_noise_float(P.mul(0.006)).mul(0.7)));
        const rock = mix(mix(c3(ROCK.base), c3(ROCK.shade), smoothstep(0.5, 0.56, rb)), c3(ROCK.light), smoothstep(0.85, 0.9, rb).mul(0.6));
        col.assign(mix(col, rock, smoothstep(0.62, 0.36, N.y.add(mx_noise_float(P.mul(0.02)).mul(0.25))).mul(U.ice)));
        sparkle.assign(U.ice.mul(smoothstep(0.6, 0.85, N.y)).mul(0.5));
      }
    }
    if (o.translucent) {
      // flora only: pale surfaces (titan caps, edge-on at distance) tint toward blush/crimson with distance (250-1000 m), so from
      // the air groves group as masses instead of a speckle of white discs
      const pale = smoothstep(0.45, 0.75, dot(base, vec3(0.2126, 0.7152, 0.0722)));
      const up = float(1); // all pale flora surfaces: thin far discs read edge-on, so undersides count too
      const far = smoothstep(250, 1000, dist);
      base.assign(mix(base, mix(c3(PALETTE.blush), c3(PALETTE.crimson), 0.6), pale.mul(up).mul(far).mul(0.9)));
      col.assign(base);
    }

    if (o.bounce !== false) {
      const orient = dot(N, vec3(0, -1, 0)).smoothstep(-0.3, 1.0);
      const fall = float(1).sub(clamp(positionWorld.y.sub(-15).div(U.bounceDist), 0, 1)).pow(1.5);
      col.assign(mix(col, groundColor(positionWorld.xz), orient.mul(fall).mul(U.bounceStrength)));
    }

    const lit = col.mul(U.sun);
    const ndl = dot(N, U.lightDir);
    const core = float(1).sub(smoothstep(U.coreLow, U.coreHigh, ndl));
    const shade = max(core, caught.oneMinus()).clamp(0, 1).toVar();
    if (o.translucent) {
      // lit = max(NdotL_cel, luminance(vertexColor) * 0.8 * max(-N.y, 0)): thin pale bands glow through, dark ones stay shadowed
      const trans = dot(base, vec3(0.2126, 0.7152, 0.0722)).mul(0.8).mul(max(N.y.negate(), 0)).toVar();
      // the hero's lowest cap keeps a dark rim/underside so its silhouette still wins against the sky
      // the hero keeps the darkest silhouette against the sky: translucency capped on all its caps (lowest cap darkest)
      const heroNear = float(1).sub(smoothstep(70, 95, positionWorld.xz.sub(vec2(HERO.x, HERO.z)).length()));
      const heroLow = float(1).sub(smoothstep(HERO_BASE_Y + HERO.height * 0.66, HERO_BASE_Y + HERO.height * 0.72, positionWorld.y));
      trans.assign(mix(trans, trans.min(mix(0.22, 0.1, heroLow)), heroNear));
      shade.assign(shade.min(float(1).sub(trans)));
    }
    if (PIXEL) shade.assign(floor(shade.mul(2).add(0.5)).div(2));
    const shadowCol = mix(col, vec3(U.shadowTint), U.shadowMix).mul(U.shadowGain);
    const out = mix(lit, shadowCol, shade).toVar();

    if (o.surface) {
      // metallic glints: a noise-perturbed normal flashes single pixels where the half-vector lines up (lit side only)
      const V = normalize(cameraPosition.sub(P));
      const H = normalize(U.lightDir.add(V));
      const Np = normalize(N.add(mx_noise_vec3(P.mul(1.3)).mul(0.6)));
      const sp = pow(max(dot(Np, H), 0), 18);
      const near = float(1).sub(smoothstep(120, 900, dist));
      const g = step(0.5, sp).mul(metal).add(step(0.85, sp).mul(sparkle)).mul(shade.oneMinus()).mul(near).clamp(0, 1);
      const lobe = pow(max(dot(N, H), 0), 10).mul(metal).mul(0.35).mul(shade.oneMinus());
      out.assign(out.add(vec3(U.sun).mul(lobe)));
      out.assign(mix(out, vec3(U.sun).mul(2.4), g)); // HDR: the brightest glints catch a 1 px stepped bloom halo
    }

    // foreground value push: the nearest plane goes darker and more saturated (ink/crimson)
    const fg = float(1).sub(smoothstep(6, 75, dist)).mul(U.fgPush);
    out.assign(mix(out, out.mul(vec3(0.32, 0.12, 0.2)), fg));

    if (o.translucent) {
      const pxz0 = positionWorld.xz;
      // the overhanging corner cap frames the sky: one value step toward haze so it never matches the hero's contrast
      const corner = float(1).sub(smoothstep(16, 30, pxz0.sub(vec2(CORNER_CAP.x, CORNER_CAP.z)).length())).mul(smoothstep(4, 8, positionWorld.y));
      out.assign(mix(out, vec3(U.fogColor), corner.mul(0.3)));
      // the hero's neck light spills a little cyan onto the nearest underside band
      const hr = pxz0.sub(vec2(HERO.x, HERO.z)).length();
      const hy = positionWorld.y.sub(HERO_BASE_Y + HERO.height * 0.88).div(HERO.height * 0.035);
      const spill = float(1).sub(smoothstep(4, 18, hr)).mul(exp(hy.mul(hy).negate())).mul(max(N.y.negate(), 0)); // just around the neck
      out.assign(mix(out, c3(PALETTE.glow).mul(0.8), spill.mul(0.6)));
    }

    if (o.fog !== false) {
      // the midground (< ~400 m) stays clear and saturated; air builds only past it (value planes, brief §3)
      // height-aware air: from the ground (eye < ~10 m) this is exactly the hero-frame fog; flying, the clear zone and the
      // fog length grow with altitude so groves keep contrast from 200-420 m, while the ranges (3-9 km) still fade to white
      const alt = max(cameraPosition.y.sub(10), 0);
      const fogStart = U.fogStart.add(alt.mul(2.4));
      const fogDist = U.fogDist.mul(alt.div(450).add(1));
      const range = float(1).sub(exp(max(dist.sub(fogStart), 0).div(fogDist).negate()));
      const haze = float(1).sub(exp(max(dist.sub(fogStart.mul(0.6)), 0).div(U.hazeDist.mul(alt.div(300).add(1))).negate()))
        .mul(exp(max(positionWorld.y.sub(U.hazeBase), 0).div(U.hazeHeight).negate())).mul(U.hazeAmount)
        .mul(float(1).sub(smoothstep(20, 320, alt).mul(0.55)));
      const f = clamp(max(range, haze), 0, 1).toVar();
      if (PIXEL) f.assign(floor(f.mul(16).add(0.5)).div(16));
      out.assign(mix(out, vec3(U.fogColor), f));
      if (o.lampPool) {
        const lp = float(1).sub(smoothstep(0.6, 7, positionWorld.xz.sub(U.lamp.xz).length()));
        out.assign(mix(out, c3(PALETTE.glow).mul(0.9), lp.mul(lp).mul(0.55)));
      }
      if (o.glow) {
        const g = c3(PALETTE.glow);
        const hdr = g.div(dot(g, vec3(0.2126, 0.7152, 0.0722))).mul(U.glowK);
        // glow is pushed toward the focal area (hero neck/caps, pods around the explorer) and calmer elsewhere
        const pxz = positionWorld.xz;
        const focal = max(float(1).sub(smoothstep(45, 120, pxz.sub(vec2(HERO.x, HERO.z)).length())),
          float(1).sub(smoothstep(14, 40, pxz.sub(vec2(EXPLORER.x, EXPLORER.z)).length())).mul(1.6));
        const corner = float(1).sub(smoothstep(16, 30, pxz.sub(vec2(CORNER_CAP.x, CORNER_CAP.z)).length()));
        const weight = glowW.mul(f.oneMinus()).mul(mix(0.3, 1, focal.clamp(0, 1))).mul(mix(1, 1.6, focal.sub(1).clamp(0, 1).mul(1.6)))
          .mul(corner.mul(0.85).oneMinus()).clamp(0, 1);
        out.assign(mix(out, hdr.mul(mix(0.65, 1.5, focal)), weight));
      }
    }
    return vec4(out, 1);
  })();
  return m;
}
