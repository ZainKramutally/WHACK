// Footstep and landing dust: pure particle pool + emitter (no three.js). Render-only; reads the player's state, writes nothing back.
export const DUST_POOL = 192;
export const LANDING_CAP = 28;       // most particles one landing may spawn
const STRIDE_WALK = 1.25, STRIDE_SPRINT = 1.0; // metres of travel per footfall
const DUST_G = 0.35;                 // dust is light: falls at this share of the world's g
const G0 = 9.81;

export type DustSurface = 'ground' | 'ice' | 'none';
export interface DustPlayer {
  x: number; y: number; z: number; vx: number; vz: number;
  heading: number; speed: number;
  mode: 'walk' | 'swim' | string;
  grounded: boolean; sprinting: boolean; onIce: boolean; landed: number;
}

export interface DustPool {
  readonly size: number;
  px: Float32Array; py: Float32Array; pz: Float32Array;
  vx: Float32Array; vy: Float32Array; vz: Float32Array;
  life: Float32Array;   // seconds left; <= 0 is free
  maxLife: Float32Array;
  size0: Float32Array;  // start size (m)
  r: Float32Array; g: Float32Array; b: Float32Array;
  alive(): number;
  update(dt: number, p: DustPlayer, surface: DustSurface, gravityG: number, tint: { r: number; g: number; b: number }, rand?: () => number): void;
}

export function createDustPool(size = DUST_POOL): DustPool {
  const f = () => new Float32Array(size);
  const pool: DustPool = {
    size, px: f(), py: f(), pz: f(), vx: f(), vy: f(), vz: f(), life: f(), maxLife: f(), size0: f(), r: f(), g: f(), b: f(),
    alive() { let n = 0; for (let i = 0; i < size; i++) if (pool.life[i] > 0) n++; return n; },
    update,
  };
  let next = 0;        // ring cursor: reuses the oldest slot when full
  let travelled = 0;   // metres since the last footfall
  let foot = 1;        // alternating foot side
  let rnd: () => number = Math.random;

  function spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, sz: number, tint: { r: number; g: number; b: number }) {
    const i = next; next = (next + 1) % size;
    const life = 0.4 + rnd() * 0.5;
    pool.px[i] = x; pool.py[i] = y; pool.pz[i] = z;
    pool.vx[i] = vx; pool.vy[i] = vy; pool.vz[i] = vz;
    pool.life[i] = life; pool.maxLife[i] = life; pool.size0[i] = sz;
    const k = 0.9 + rnd() * 0.2; // slight brightness jitter per grain
    pool.r[i] = Math.min(1, tint.r * k); pool.g[i] = Math.min(1, tint.g * k); pool.b[i] = Math.min(1, tint.b * k);
  }

  function update(dt: number, p: DustPlayer, surface: DustSurface, gravityG: number, tint: { r: number; g: number; b: number }, rand?: () => number) {
    rnd = rand ?? Math.random;
    const g = G0 * DUST_G * Math.max(0.05, gravityG);
    // Integrate: gravity pulls down, air drag bleeds horizontal speed; the pool never allocates.
    const drag = Math.exp(-3 * dt);
    for (let i = 0; i < size; i++) {
      if (pool.life[i] <= 0) continue;
      pool.life[i] -= dt;
      pool.vy[i] -= g * dt;
      pool.vx[i] *= drag; pool.vz[i] *= drag;
      pool.px[i] += pool.vx[i] * dt; pool.py[i] += pool.vy[i] * dt; pool.pz[i] += pool.vz[i] * dt;
      if (pool.py[i] < p.y - 0.02 && pool.vy[i] < 0) { pool.vy[i] = 0; pool.vx[i] *= 0.5; pool.vz[i] *= 0.5; } // rests on the ground near the feet
    }
    if (surface === 'none') { travelled = 0; return; }
    const ice = surface === 'ice';
    if (p.landed > 0) {
      const n = Math.min(LANDING_CAP, Math.round(8 + 20 * p.landed));
      const sp = 1.2 + 2.2 * p.landed;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.3;
        const s = sp * (0.7 + rnd() * 0.5);
        spawn(p.x + Math.cos(a) * 0.25, p.y + 0.05, p.z + Math.sin(a) * 0.25, Math.cos(a) * s, 0.5 + rnd() * 0.8 * p.landed + 0.3, Math.sin(a) * s, (ice ? 0.07 : 0.14) + 0.08 * p.landed, tint);
      }
      travelled = 0;
      return;
    }
    if (!p.grounded || p.speed < 0.5) { travelled = 0; return; }
    travelled += p.speed * dt;
    const stride = p.sprinting ? STRIDE_SPRINT : STRIDE_WALK;
    while (travelled >= stride) {
      travelled -= stride;
      foot = -foot;
      const n = p.sprinting ? 4 : 2;
      const side = foot * 0.15;
      // Foot position: beside the body, perpendicular to heading (heading 0 faces -z; forward = (-sin, -cos)).
      const fx = p.x + Math.cos(p.heading) * side, fz = p.z - Math.sin(p.heading) * side;
      const sz = (p.sprinting ? 0.13 : 0.09) * (ice ? 0.6 : 1);
      for (let k = 0; k < n; k++) {
        spawn(fx + (rnd() - 0.5) * 0.1, p.y + 0.04, fz + (rnd() - 0.5) * 0.1,
          -p.vx * 0.15 + (rnd() - 0.5) * 0.8, 0.4 + rnd() * 0.6, -p.vz * 0.15 + (rnd() - 0.5) * 0.8, sz * (0.8 + rnd() * 0.5), tint);
      }
    }
  }
  return pool;
}

/** Which surface is under the player: nothing while swimming or airborne (landing is handled by `landed`). */
export function dustSurface(p: Pick<DustPlayer, 'mode' | 'onIce' | 'grounded' | 'landed'>): DustSurface {
  if (p.mode === 'swim') return 'none';
  if (!p.grounded && p.landed <= 0) return 'none';
  return p.onIce ? 'ice' : 'ground';
}
