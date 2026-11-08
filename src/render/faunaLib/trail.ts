// A swimmer's recent path in its own body space, as the aquatic builder's Path (faunaLib/aquatic/v3.ts): the live head
// at s = 0, the head's recorded positions behind it (s < 0, by arc length), and ahead of the head (s > 0) an arc of the
// swimmer's turn curvature, which the builder reads for its bank. Short history falls back to straight on. Pure, no
// three.js, preallocated: a pose calls at() a few dozen times a frame and nothing allocates.
import type { Path, V3 } from './aquatic/v3';

export class TrailPath implements Path {
  readonly length = Infinity;
  /** Body-space points, head first (x, z pairs), and their arc lengths from the head. */
  private readonly pts: Float32Array;
  private readonly arc: Float32Array;
  private n = 0;
  private kap = 0;
  private straight = true;
  private straightX = 0;
  // at() results rotate through a small pool: callers hold at most a couple at once (the builder's bankAt holds two)
  private readonly pool = Array.from({ length: 8 }, () => ({ p: [0, 0, 0] as V3, t: [1, 0, 0] as V3 }));
  private k = 0;

  constructor(readonly capacity: number) {
    this.pts = new Float32Array((capacity + 1) * 2);
    this.arc = new Float32Array(capacity + 1);
  }

  /** A straight path along +x with the head at (headX, 0, 0): the rest pose, or no trail. */
  straightOn(headX: number): this { this.straight = true; this.straightX = headX; return this; }

  /** Start a trail at the live head (body space). `kap`: turn curvature ahead, 1 / body units (> 0 turns toward +z). */
  begin(headX: number, kap: number): this {
    this.straight = false; this.kap = kap;
    this.pts[0] = headX; this.pts[1] = 0; this.arc[0] = 0; this.n = 1;
    return this;
  }

  /** Append the next older head position (body space); points closer than `minGap` to the last one are skipped. */
  push(x: number, z: number, minGap = 1e-4): void {
    if (this.n > this.capacity) return;
    const i = this.n, l = Math.hypot(x - this.pts[i * 2 - 2], z - this.pts[i * 2 - 1]);
    if (l < minGap) return;
    this.pts[i * 2] = x; this.pts[i * 2 + 1] = z; this.arc[i] = this.arc[i - 1] + l; this.n++;
  }

  at(s: number): { p: V3; t: V3 } {
    const o = this.pool[this.k++ & 7], p = o.p, t = o.t, P = this.pts, A = this.arc, n = this.n;
    p[1] = 0; t[1] = 0;
    if (this.straight) { p[0] = s + this.straightX; p[2] = 0; t[0] = 1; t[2] = 0; return o; }
    if (s >= 0 || n < 2) {
      let tx = 1, tz = 0;
      if (n >= 2) { const dx = P[0] - P[2], dz = P[1] - P[3], l = Math.hypot(dx, dz) || 1; tx = dx / l; tz = dz / l; }
      if (s < 0) { p[0] = P[0] + tx * s; p[2] = P[1] + tz * s; t[0] = tx; t[2] = tz; return o; } // no history: straight back
      const nx = -tz, nz = tx, th = this.kap * s, kap = this.kap;
      if (Math.abs(kap) > 1e-9) {
        const a = Math.sin(th) / kap, b = (1 - Math.cos(th)) / kap;
        p[0] = P[0] + tx * a + nx * b; p[2] = P[1] + tz * a + nz * b;
        t[0] = tx * Math.cos(th) + nx * Math.sin(th); t[2] = tz * Math.cos(th) + nz * Math.sin(th);
      } else { p[0] = P[0] + tx * s; p[2] = P[1] + tz * s; t[0] = tx; t[2] = tz; }
      return o;
    }
    const d = -s;
    let i = 0;
    while (i < n - 2 && A[i + 1] < d) i++;
    const ax = P[i * 2], az = P[i * 2 + 1], bx = P[i * 2 + 2], bz = P[i * 2 + 3];
    const l = A[i + 1] - A[i] || 1, tx = (ax - bx) / l, tz = (az - bz) / l, u = d - A[i]; // past the oldest: straight on
    p[0] = ax - tx * u; p[2] = az - tz * u; t[0] = tx; t[2] = tz;
    return o;
  }
}

/** A fixed pool of slot indices 0..size−1 (the swimmers' trail rings). Preallocated; reset() frees every slot. */
export class SlotPool {
  private readonly free: Int32Array;
  private n = 0;
  constructor(readonly size: number) { this.free = new Int32Array(size); this.reset(); }
  /** Every slot free again (a new run: the entries that held slots are gone). */
  reset(): void { for (let i = 0; i < this.size; i++) this.free[i] = this.size - 1 - i; this.n = this.size; }
  /** A free slot, or −1 when all are taken. */
  acquire(): number { return this.n > 0 ? this.free[--this.n] : -1; }
  release(slot: number): void { if (slot >= 0 && this.n < this.size) this.free[this.n++] = slot; }
  get available(): number { return this.n; }
}
