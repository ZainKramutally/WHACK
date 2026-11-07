// Pure player maths (no three.js): camera-relative movement, pitch clamp, collision push-out, boundary clamp, easing.
// Convention: camera yaw θ looks along (-sin θ, 0, -cos θ), as three's rotation.y (θ = 0 looks down -Z, the hero shot).

export interface Circle { x: number; z: number; r: number; top: number }
export interface Disc { x: number; z: number; r: number }

/** Unit (or zero) XZ move vector from key axes (forward +1 = W, right +1 = D) relative to the camera yaw. */
export function moveVector(forward: number, right: number, yaw: number): [number, number] {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // forward
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // right
  const x = fx * forward + rx * right, z = fz * forward + rz * right;
  const l = Math.hypot(x, z);
  return l < 1e-9 ? [0, 0] : [x / l, z / l];
}

/** Follow-camera elevation above the focus, radians: slightly below the horizon up to almost straight down. */
export const PITCH_MIN = -0.25, PITCH_MAX = 1.45;
export const clampPitch = (p: number) => Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));

/** Push a point of radius `pr` out of every circle it overlaps (circles with top below `y` are ignored). Returns [x, z]. */
export function resolveCircles(x: number, z: number, pr: number, y: number, circles: readonly Circle[], passes = 2): [number, number] {
  for (let p = 0; p < passes; p++) {
    let moved = false;
    for (const c of circles) {
      if (y > c.top) continue;
      const dx = x - c.x, dz = z - c.z, rr = c.r + pr;
      if (Math.abs(dx) >= rr || Math.abs(dz) >= rr) continue;
      const d = Math.hypot(dx, dz);
      if (d >= rr) continue;
      // exactly at the centre: push out along +X (deterministic)
      const nx = d > 1e-9 ? dx / d : 1, nz = d > 1e-9 ? dz / d : 0;
      x = c.x + nx * rr; z = c.z + nz * rr; moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}

/** Hard world boundary: never beyond the disc edge (edgeSlow makes the approach soft). */
export function clampDisc(x: number, z: number, disc: Disc): [number, number] {
  const dx = x - disc.x, dz = z - disc.z, d = Math.hypot(dx, dz);
  if (d <= disc.r) return [x, z];
  return [disc.x + (dx / d) * disc.r, disc.z + (dz / d) * disc.r];
}

/** Soft boundary: scale the outward part of a move vector to 0 over the last `band` metres before the edge. */
export function edgeSlow(x: number, z: number, mx: number, mz: number, disc: Disc, band: number): [number, number] {
  const dx = x - disc.x, dz = z - disc.z, d = Math.hypot(dx, dz);
  if (d < disc.r - band || d < 1e-9) return [mx, mz];
  const nx = dx / d, nz = dz / d, out = mx * nx + mz * nz;
  if (out <= 0) return [mx, mz];
  const k = Math.max(0, Math.min(1, (disc.r - d) / band));
  return [mx - nx * out * (1 - k), mz - nz * out * (1 - k)];
}

/** Frame-rate independent exponential smoothing factor (Bruno View.js lerp, made dt-correct). */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** True if (x, y, z) is inside any circle (padded by `pad`) below its top. */
export function insideCircles(x: number, z: number, y: number, pad: number, circles: readonly Circle[]): boolean {
  for (const c of circles) if (y <= c.top && Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
  return false;
}

/**
 * Camera boom pull-in: march from the focus along the unit direction (dx, dy, dz) up to `len`, and return the longest
 * clear length (first blocked sample minus `margin`, at least `min`). `blocked` tests one world point.
 */
export function marchBoom(fx: number, fy: number, fz: number, dx: number, dy: number, dz: number, len: number,
  blocked: (x: number, y: number, z: number) => boolean, step = 0.5, margin = 0.6, min = 1.2): number {
  for (let s = Math.min(step, len); s <= len + 1e-9; s += step) {
    if (blocked(fx + dx * s, fy + dy * s, fz + dz * s)) return Math.max(min, s - margin);
    if (s < len && s + step > len) s = len - step; // always test the far end
  }
  return len;
}
