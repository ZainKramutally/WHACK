// Plant presence over time (render-only): a newly placed plant grows in, a plant that leaves the placement shrinks
// out instead of vanishing. Plants are keyed by something stable across re-placements, so one that stays placed never
// replays its growth. Pure bookkeeping: flora.ts owns the lists and draws the scales this reports.

export const GROW_SEC = 2.2;
export const DIE_SEC = 1.5;
export const DYING_CAP = 256;

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/** Stable key of a placed plant: flora cell, slot within its role, archetype and the dark foreground flag. */
export const plantKey = (cell: number, slot: number, arch: number, dark: number): number =>
  cell + 65536 * (slot + 256 * (arch + 256 * (dark ? 1 : 0)));

export class Presence {
  n = 0;
  /** Keys of the list being placed next: fill [0, n) then call sync(n). */
  nextKeys: Float64Array;
  keys: Float64Array;
  /** Seconds each current plant has been placed (≥ GROW_SEC: fully grown). */
  age: Float32Array;
  private nextAge: Float32Array;
  private map = new Map<number, number>();
  /** Seconds each dying slot has been dying; -1: free. */
  dAge: Float32Array;
  /** Plants still easing (growing or dying): flora.ts skips the per-frame matrix pass while 0. */
  active = 0;
  constructor(cap: number, private poolCap = DYING_CAP, private growSec = GROW_SEC, private dieSec = DIE_SEC) {
    this.nextKeys = new Float64Array(cap); this.keys = new Float64Array(cap);
    this.age = new Float32Array(cap); this.nextAge = new Float32Array(cap);
    this.dAge = new Float32Array(poolCap).fill(-1);
  }
  /**
   * Adopt the next placement (keys in nextKeys[0..newN)). `isNew(i)` says whether a plant that just appeared should
   * grow (near the camera) or simply be there. `die(oldIndex, slot)` is called for each plant that left while the old
   * list is still intact, and returns true if it took the slot (copied the plant) to shrink it out.
   */
  sync(newN: number, isNew: (i: number) => boolean, die: (oldIndex: number, slot: number) => boolean): void {
    const next = new Map<number, number>(); // per rebuild (a few per second), not per frame
    let free = 0;
    for (let i = 0; i < newN; i++) {
      const k = this.nextKeys[i];
      const old = this.map.get(k);
      if (old !== undefined && !next.has(k)) this.nextAge[i] = this.age[old];
      else this.nextAge[i] = next.has(k) || !isNew(i) ? this.growSec : 0;
      if (!next.has(k)) next.set(k, i);
    }
    for (const [k, old] of this.map) {
      if (next.has(k)) continue;
      while (free < this.poolCap && this.dAge[free] >= 0) free++;
      if (free >= this.poolCap) break; // pool full: the rest vanish at once
      if (die(old, free)) this.dAge[free] = 0;
    }
    [this.keys, this.nextKeys] = [this.nextKeys, this.keys];
    [this.age, this.nextAge] = [this.nextAge, this.age];
    this.map = next; this.n = newN;
    this.recount();
  }
  /** Drop everything (a new world). */
  reset(): void {
    this.map.clear(); this.n = 0; this.dAge.fill(-1); this.active = 0;
  }
  /** Advance by dt seconds. */
  tick(dt: number): void {
    for (let i = 0; i < this.n; i++) if (this.age[i] < this.growSec) this.age[i] += dt;
    for (let j = 0; j < this.poolCap; j++) {
      if (this.dAge[j] < 0) continue;
      this.dAge[j] += dt;
      if (this.dAge[j] >= this.dieSec) this.dAge[j] = -1;
    }
    this.recount();
  }
  growScale(i: number): number { return smooth(this.age[i] / this.growSec); }
  dieScale(j: number): number { return 1 - smooth(this.dAge[j] / this.dieSec); }
  private recount(): void {
    let a = 0;
    for (let i = 0; i < this.n; i++) if (this.age[i] < this.growSec) a++;
    for (let j = 0; j < this.poolCap; j++) if (this.dAge[j] >= 0) a++;
    this.active = a;
  }
}
