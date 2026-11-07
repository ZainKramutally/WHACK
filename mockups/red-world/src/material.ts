// One world material (Bruno Simon folio-2025 MeshDefaultMaterial technique, MIT): Lambert node material whose
// outputNode does palette colour → ground bounce → cel core shadow + captured cast shadow tinted with PALETTE.shadow
// → foreground value push → range + valley-haze fog toward the sky white → HDR glow (blooms past threshold 1).
// Pixel mode quantises shadow into 3 bands and fog into dithered steps (dither only in the fog gradient).
import * as THREE from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, mix, max, normalWorld, positionWorld, positionLocal, attribute, uniform, cameraPosition,
  sin, cos, screenCoordinate, frontFacing, If, exp, smoothstep, floor, mod, texture, mx_worley_noise_vec2, clamp, dot,
} from 'three/tsl';
import { PALETTE } from './contracts';
import { DATA_RECT, HERO, EXPLORER } from './layout';

export const PIXEL = new URLSearchParams(location.search).get('style') !== 'smooth';

const c3 = (hex: number) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };
const lin = (hex: number) => new THREE.Color(hex);

export const U = {
  lightDir: uniform(new THREE.Vector3(-0.62, 0.5, -0.6).normalize()),
  sun: uniform(new THREE.Color(1.0, 0.97, 0.93)),
  shadowTint: uniform(lin(PALETTE.shadow)),
  shadowMix: uniform(0.88),
  shadowGain: uniform(0.78),
  coreLow: uniform(-0.12),
  coreHigh: uniform(0.42),
  bounceDist: uniform(140),
  bounceStrength: uniform(0.6),
  fogColor: uniform(lin(PALETTE.haze)),
  fogStart: uniform(420),
  fogDist: uniform(3800),
  hazeDist: uniform(1500),
  hazeBase: uniform(-8),
  hazeHeight: uniform(55),
  hazeAmount: uniform(0.42),
  fgPush: uniform(0.82),
  glowK: uniform(2.6),
  windK: uniform(0.6),
  time: uniform(0),
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
}

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
    const amp = s.mul(s).mul(U.windK).mul(sc.pow(0.6));
    const off = vec3(sin(t.mul(0.55).add(ph)).add(sin(t.mul(1.3).add(ph.mul(2.1))).mul(0.3)), 0, cos(t.mul(0.43).add(ph.mul(1.3))).mul(0.6)).mul(amp);
    m.positionNode = positionLocal.add(off);
  }

  const caught = float(1).toVar();
  m.receivedShadowNode = Fn(([shadow]: any[]) => { caught.mulAssign(shadow.r); return float(1); });

  m.outputNode = Fn(() => {
    const base = vec3(colorNode).toVar();
    const N = normalWorld.toVar();
    if (m.side === THREE.DoubleSide) If(frontFacing.not(), () => { N.mulAssign(-1); });
    const col = base.toVar();
    const dist = positionWorld.sub(cameraPosition).length();

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
      const trans = dot(base, vec3(0.2126, 0.7152, 0.0722)).mul(0.8).mul(max(N.y.negate(), 0));
      shade.assign(shade.min(float(1).sub(trans)));
    }
    if (PIXEL) shade.assign(floor(shade.mul(2).add(0.5)).div(2));
    const shadowCol = mix(col, vec3(U.shadowTint), U.shadowMix).mul(U.shadowGain);
    const out = mix(lit, shadowCol, shade).toVar();

    // foreground value push: the nearest plane goes darker and more saturated (ink/crimson)
    const fg = float(1).sub(smoothstep(6, 75, dist)).mul(U.fgPush);
    out.assign(mix(out, out.mul(vec3(0.32, 0.12, 0.2)), fg));

    if (o.fog !== false) {
      // the midground (< ~400 m) stays clear and saturated; air builds only past it (value planes, brief §3)
      const range = float(1).sub(exp(max(dist.sub(U.fogStart), 0).div(U.fogDist).negate()));
      const haze = float(1).sub(exp(max(dist.sub(U.fogStart.mul(0.6)), 0).div(U.hazeDist).negate()))
        .mul(exp(max(positionWorld.y.sub(U.hazeBase), 0).div(U.hazeHeight).negate())).mul(U.hazeAmount);
      const f = clamp(max(range, haze), 0, 1).toVar();
      if (PIXEL) f.assign(floor(f.mul(16).add(0.5)).div(16));
      out.assign(mix(out, vec3(U.fogColor), f));
      if (o.glow) {
        const g = c3(PALETTE.glow);
        const hdr = g.div(dot(g, vec3(0.2126, 0.7152, 0.0722))).mul(U.glowK);
        // glow is pushed toward the focal area (hero neck/caps, pods around the explorer) and calmer elsewhere
        const pxz = positionWorld.xz;
        const focal = max(float(1).sub(smoothstep(60, 240, pxz.sub(vec2(HERO.x, HERO.z)).length())),
          float(1).sub(smoothstep(12, 45, pxz.sub(vec2(EXPLORER.x, EXPLORER.z)).length())));
        out.assign(mix(out, hdr.mul(mix(0.65, 1.5, focal)), glowW.mul(f.oneMinus())));
      }
    }
    return vec4(out, 1);
  })();
  return m;
}
