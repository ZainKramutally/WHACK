// Loft writer (no three.js): rings placed on a posed axis become a smooth generalised cylinder (F §3.6). A ring is a
// centre, an axis T and an up U (⟂ T), and two radii (a across, b up); its cross-section is a precomputed unit
// section (circle, or a rounded n-gon for silicon hubs). Normals are analytic: the section's 2D normal scaled for the
// ellipse, tilted along T by the radius slope, so caps dome smoothly. Every slot has a fixed ring count; unused rings
// repeat the last one's positions (zero-area quads; their normals and colours are never seen), so one static index
// buffer serves every creature. No allocations per call.

/** Floats per ring: cx, cy, cz, tx, ty, tz, ux, uy, uz, a, b, colour slot. */
const len2 = (x: number, y: number) => Math.sqrt(x * x + y * y);
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

export const RING_STRIDE = 12;

export interface Section { n: number; px: Float32Array; py: Float32Array; nx: Float32Array; ny: Float32Array }

/** Unit circle with `n` sides, θ_j = 2πj/n. */
export function circleSection(n: number): Section {
  return ngonSection(n, 0, 0, 0);
}

/**
 * Rounded n-gon of vertex radius 1 sampled at `n` angles: radius = mix(1, polygon, facet). Vertices sit at
 * θ = phase + 2πk/folds. folds 0 gives a circle.
 */
export function ngonSection(n: number, folds: number, facet: number, phase: number): Section {
  const px = new Float32Array(n), py = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n);
  const step = folds > 0 ? (2 * Math.PI) / folds : 0;
  for (let j = 0; j < n; j++) {
    const th = (2 * Math.PI * j) / n;
    let r = 1;
    if (folds > 0) {
      let d = (th - phase) % step; if (d < 0) d += step;
      const poly = Math.cos(Math.PI / folds) / Math.cos(d - Math.PI / folds);
      r = 1 + (poly - 1) * facet;
    }
    px[j] = Math.cos(th) * r; py[j] = Math.sin(th) * r;
  }
  for (let j = 0; j < n; j++) {
    const a = (j + n - 1) % n, b = (j + 1) % n;
    let tx = px[b] - px[a], ty = py[b] - py[a];
    const l = len2(tx, ty) || 1; tx /= l; ty /= l;
    let ox = ty, oy = -tx;                                   // a perpendicular; flip outward
    if (ox * px[j] + oy * py[j] < 0) { ox = -ox; oy = -oy; }
    nx[j] = ox; ny[j] = oy;
  }
  return { n, px, py, nx, ny };
}

/** Triangle indices for `slots` slots of rings × sides vertices each (outward winding). */
export function gridIndex(rings: number, sides: number, slots: number): Uint32Array {
  const per = (rings - 1) * sides * 6;
  const out = new Uint32Array(per * slots);
  let k = 0;
  for (let s = 0; s < slots; s++) {
    const base = s * rings * sides;
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < sides; j++) {
      const a = base + i * sides + j, b = base + i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
      out[k++] = a; out[k++] = c; out[k++] = b; out[k++] = b; out[k++] = c; out[k++] = d;
    }
  }
  return out;
}

/**
 * Write `nr` rings (at most `maxRings`; padded to `maxRings` by repeating the last one's positions) into a slot
 * starting at vertex `vOff`.
 * `rgb` holds linear colours per slot (3 floats each); `glowW` the glow weight per slot.
 */
export function writeRings(
  rings: Float32Array, nr: number, maxRings: number, sec: Section,
  pos: Float32Array, nor: Float32Array, col: Float32Array, glow: Float32Array, vOff: number,
  rgb: Float32Array, glowW: Float32Array,
): void {
  const S = sec.n;
  let v = vOff;
  const n = Math.min(nr, maxRings);
  for (let ii = 0; ii < n; ii++) {
    const o = ii * RING_STRIDE;
    const cx = rings[o], cy = rings[o + 1], cz = rings[o + 2];
    const tx = rings[o + 3], ty = rings[o + 4], tz = rings[o + 5];
    const ux = rings[o + 6], uy = rings[o + 7], uz = rings[o + 8];
    const a = rings[o + 9], b = rings[o + 10], slot = rings[o + 11];
    // R = T × U
    const rx = ty * uz - tz * uy, ry = tz * ux - tx * uz, rz = tx * uy - ty * ux;
    // radius slope along the axis, from the neighbouring rings
    const p = (ii > 0 ? ii - 1 : 0) * RING_STRIDE, q = (ii < n - 1 ? ii + 1 : n - 1) * RING_STRIDE;
    const dl = len3(rings[q] - rings[p], rings[q + 1] - rings[p + 1], rings[q + 2] - rings[p + 2]);
    const slope = dl > 1e-9 ? ((rings[q + 9] + rings[q + 10]) - (rings[p + 9] + rings[p + 10])) / (2 * dl) : 0;
    const s3 = slot * 3, cr = rgb[s3], cg = rgb[s3 + 1], cb = rgb[s3 + 2], gw = glowW[slot];
    for (let j = 0; j < S; j++, v++) {
      const sx = sec.px[j] * a, sy = sec.py[j] * b;
      const k = v * 3;
      pos[k] = cx + rx * sx + ux * sy; pos[k + 1] = cy + ry * sx + uy * sy; pos[k + 2] = cz + rz * sx + uz * sy;
      // ellipse normal ∝ (nx·b, ny·a), normalised, then tilted back along T by the slope
      let ex = sec.nx[j] * b, ey = sec.ny[j] * a;
      const el = len2(ex, ey) || 1; ex /= el; ey /= el;
      let nx = rx * ex + ux * ey - tx * slope, ny = ry * ex + uy * ey - ty * slope, nz = rz * ex + uz * ey - tz * slope;
      const nl = len3(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      col[k] = cr; col[k + 1] = cg; col[k + 2] = cb;
      glow[v] = gw;
    }
  }
  // Pad: repeat the last ring's positions only (the quads collapse to zero area, so nothing else is ever shaded).
  const last = (vOff + (n - 1) * S) * 3;
  for (let i = n; i < maxRings; i++) pos.copyWithin((vOff + i * S) * 3, last, last + S * 3);
}

/** Set ring i: centre, axis (normalised here), up hint (made ⟂ axis here), radii, colour slot. */
export function setRing(
  rings: Float32Array, i: number, cx: number, cy: number, cz: number, tx: number, ty: number, tz: number,
  hx: number, hy: number, hz: number, a: number, b: number, slot: number,
): void {
  const tl = len3(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const d = hx * tx + hy * ty + hz * tz;
  let ux = hx - tx * d, uy = hy - ty * d, uz = hz - tz * d;
  let ul = len3(ux, uy, uz);
  if (ul < 1e-6) { ux = -ty; uy = tx; uz = 0; ul = len2(ux, uy) || 1; if (ul < 1e-6) { ux = 1; uy = 0; uz = 0; ul = 1; } }
  const o = i * RING_STRIDE;
  rings[o] = cx; rings[o + 1] = cy; rings[o + 2] = cz;
  rings[o + 3] = tx; rings[o + 4] = ty; rings[o + 5] = tz;
  rings[o + 6] = ux / ul; rings[o + 7] = uy / ul; rings[o + 8] = uz / ul;
  rings[o + 9] = a; rings[o + 10] = b; rings[o + 11] = slot;
}
