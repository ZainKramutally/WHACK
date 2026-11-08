// Bestiary pixel sprite: a creature's body plan drawn as a tiny pixel-art picture (art layer, read-only, pure).
// It reuses the 3D layout (creatureLayout.beadLayout) and colours (palette.creatureColour), so the picture is the same
// body the world draws: ellipsoid beads and limb rods for carbon, hexagonal beads for silicon walkers, prism tiers, tiles
// and arm rods for radial silicon.
// Oblique view from the front-left and a little above, painter's order far to near, flat tone colours, far parts
// shaded, and a one-pixel ink outline, as in the pixel style. Every pixel is either fully opaque or empty.
import type { BodyPlan } from '../sim/develop';
import { beadLayout, type BeadTone } from './creatureLayout';
import { WORLD_TONE, creatureColour, LOOK_PALETTES, scaleHex } from './palette';
import { faunaLook } from './faunaLib/species';

// Oblique projection: screen u = x + KU·z, screen v (up) = y − KV·z; z grows away from the viewer.
const KU = 0.38, KV = 0.3;
const FAR_SHADE = 0.78; // parts on the far side are darker
const MARGIN = 2;       // pixels left empty around the body for the outline

interface Prim {
  depth: number;
  colour: number;
  /** Bounding box in body units (u, v). */
  u0: number; u1: number; v0: number; v1: number;
  /** Inside test in body units. */
  inside(u: number, v: number): boolean;
}

function ellipse(cu: number, cv: number, ru: number, rv: number, depth: number, colour: number): Prim {
  const iu = 1 / Math.max(ru, 1e-6), iv = 1 / Math.max(rv, 1e-6);
  return {
    depth, colour, u0: cu - ru, u1: cu + ru, v0: cv - rv, v1: cv + rv,
    inside: (u, v) => { const a = (u - cu) * iu, b = (v - cv) * iv; return a * a + b * b <= 1; },
  };
}

/** A flat-topped hexagon in the same box as the ellipse (a silicon walker's faceted bead). */
function hexagon(cu: number, cv: number, ru: number, rv: number, depth: number, colour: number): Prim {
  const iu = 1 / Math.max(ru, 1e-6), iv = 1 / Math.max(rv, 1e-6);
  return {
    depth, colour, u0: cu - ru, u1: cu + ru, v0: cv - rv, v1: cv + rv,
    inside: (u, v) => { const a = Math.abs((u - cu) * iu), b = Math.abs((v - cv) * iv); return b <= 1 && b <= 2 * (1 - a); },
  };
}

function capsule(au: number, av: number, bu: number, bv: number, r: number, depth: number, colour: number): Prim {
  const du = bu - au, dv = bv - av, len2 = du * du + dv * dv || 1e-12, r2 = r * r;
  return {
    depth, colour, u0: Math.min(au, bu) - r, u1: Math.max(au, bu) + r, v0: Math.min(av, bv) - r, v1: Math.max(av, bv) + r,
    inside: (u, v) => {
      const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
      const eu = u - (au + t * du), ev = v - (av + t * dv);
      return eu * eu + ev * ev <= r2;
    },
  };
}

const project = (x: number, y: number, z: number): [number, number] => [x + KU * z, y - KV * z];

/** The plan's parts as flat 2D primitives in body units, far ones first. */
function primitives(raw: BodyPlan): Prim[] {
  // As the world draws it: the species colourway, pattern and proportions (faunaLook falls back to the plan's own), in
  // the world's one body colour + one accent.
  const { plan, hue, accent, diet, hard, skin } = faunaLook(raw);
  const lay = beadLayout(plan);
  const silicon = plan.chemistry === 'silicon';
  const colour = (tone: BeadTone, z: number) => {
    // armour and skin guard as fauna draws them; a radial body's shell tiles (tone 2) keep the species skin
    const c = creatureColour(silicon, diet, lay.radial && tone === 2 ? 0 : WORLD_TONE[tone], hue, accent, hard, skin);
    return z > 0.02 * plan.scale ? scaleHex(c, FAR_SHADE) : c;
  };
  const prims: Prim[] = [];
  const shape = silicon && !lay.radial ? hexagon : ellipse; // silicon walkers are faceted, carbon round
  for (const b of lay.beads) {
    const yaw = b.yaw ?? 0, sx = b.sx ?? 1, sy = b.sy ?? 1, sz = b.sz ?? 1;
    const ru = b.r * (sx * Math.abs(Math.cos(yaw)) + sz * Math.abs(Math.sin(yaw)) * (0.4 + KU));
    const rv = b.r * (sy + 0.15 * sz * KV);
    const [u, v] = project(b.x, b.y, b.z);
    prims.push(shape(u, v, ru, rv, b.z, colour(b.tone, b.z)));
  }
  const rods = [...(lay.limbRods ?? []), ...(lay.radial?.rods ?? [])];
  for (const r of rods) {
    const [au, av] = project(r.ax, r.ay, r.az);
    const [bu, bv] = project(r.bx, r.by, r.bz);
    const zMid = (r.az + r.bz) / 2;
    prims.push(capsule(au, av, bu, bv, r.r, zMid, colour(r.tone, zMid)));
  }
  return prims.sort((a, b) => b.depth - a.depth); // far (large z) first
}

/** A plain capsule in the plan's body colour (grey if even that fails), for a plan whose layout can't be built. */
function fallbackPrims(plan: BodyPlan): Prim[] {
  let c = 0x9a8f8c;
  try { c = creatureColour(plan.chemistry === 'silicon', plan.diet, 0, plan.hue, plan.accent); } catch { /* keep grey */ }
  return [capsule(-1, 0.35, 1, 0.35, 0.35, 0, c)];
}

/**
 * Rasterise the plan into a w × h RGBA buffer (row 0 at the top), fitted and centred, with a one-pixel ink outline.
 * Deterministic: the same plan and size give the same pixels (the world's species look once fauna has drawn the animal,
 * the plan's own before). Never throws: a plan whose layout fails draws as a plain capsule.
 */
export function spritePixels(plan: BodyPlan, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  let prims: Prim[];
  try { prims = primitives(plan); } catch { prims = fallbackPrims(plan); } // a plan the layout can't build: a plain capsule
  if (prims.length === 0) return out;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of prims) { u0 = Math.min(u0, p.u0); u1 = Math.max(u1, p.u1); v0 = Math.min(v0, p.v0); v1 = Math.max(v1, p.v1); }
  const scale = Math.min((w - 2 * MARGIN) / Math.max(u1 - u0, 1e-6), (h - 2 * MARGIN) / Math.max(v1 - v0, 1e-6));
  const offU = (w - (u1 - u0) * scale) / 2, offV = (h - (v1 - v0) * scale) / 2;
  const filled = new Uint8Array(w * h);
  const colours = new Uint32Array(w * h);
  for (const p of prims) {
    const px0 = Math.max(0, Math.floor(offU + (p.u0 - u0) * scale)), px1 = Math.min(w - 1, Math.ceil(offU + (p.u1 - u0) * scale));
    const py0 = Math.max(0, Math.floor(h - offV - (p.v1 - v0) * scale)), py1 = Math.min(h - 1, Math.ceil(h - offV - (p.v0 - v0) * scale));
    for (let py = py0; py <= py1; py++) {
      const v = v0 + (h - offV - (py + 0.5)) / scale;
      for (let px = px0; px <= px1; px++) {
        const u = u0 + (px + 0.5 - offU) / scale;
        if (p.inside(u, v)) { const i = py * w + px; filled[i] = 1; colours[i] = p.colour; }
      }
    }
  }
  const ink = LOOK_PALETTES[plan.chemistry === 'silicon' ? 'silicon' : 'carbon'].ink;
  const put = (i: number, c: number) => { out[i * 4] = (c >> 16) & 255; out[i * 4 + 1] = (c >> 8) & 255; out[i * 4 + 2] = c & 255; out[i * 4 + 3] = 255; };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (filled[i]) { put(i, colours[i]); continue; }
      const edge = (px > 0 && filled[i - 1]) || (px < w - 1 && filled[i + 1]) || (py > 0 && filled[i - w]) || (py < h - 1 && filled[i + w]);
      if (edge) put(i, ink);
    }
  }
  return out;
}

/** Paint the plan's sprite into a canvas at its own pixel size (scale it up in CSS with image-rendering: pixelated). */
export function drawSprite(canvas: HTMLCanvasElement, plan: BodyPlan): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(canvas.width, canvas.height);
  img.data.set(spritePixels(plan, canvas.width, canvas.height));
  ctx.putImageData(img, 0, 0);
}
