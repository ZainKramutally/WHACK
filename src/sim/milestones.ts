// Milestones: real events in the living world that earn a caption ("A hunter has evolved"). Pure detection over a few
// numbers the simulation reads once per ecology second; deterministic, and each id fires at most once per run.
// Thresholds here are about what counts as "first" or "enough", not world facts; the wording lives in world config.
import type { MilestoneId } from '../worlds/types';

export interface MilestoneAnimal {
  id: number;
  mode: 0 | 1 | 2 | 3;   // live locomotion mode (LOCOMOTION in develop.ts)
  diet: number;          // 0..1 diet gene
  scale: number;         // body length, metres
  ageSec: number;        // ecology seconds alive
  onLand: boolean;       // its cell holds no liquid
  armoured: boolean;     // wears a ceramic shell (plan.shellCover)
}

export interface MilestoneInput {
  sec: number;                                            // ecology seconds since the world began
  animals: readonly MilestoneAnimal[];
  speciesLive: readonly { id: number; live: number }[];   // every announced species and how many animals are alive in it
  seaCover: number;                                       // %
  buildComplete: boolean;
}

export interface MilestoneFire { id: MilestoneId; organismId?: number; speciesBinId?: number }

const HUNTER_DIET = 0.65;     // the sim's hunter line (guide.ts roleOf)
const SETTLE_SEC = 3;         // an animal must have lived this long, so a lone newborn does not count
const GIANT_M = 2;            // metres
const APEX_SHARE = 0.9;       // top decile of body length
const FIRST_SPECIES = 5;
const MANY_SPECIES = 8;
const EXTINCT_SEC = 20;       // a species with no animals for this long is gone
const CRASH_BELOW = 0.4;      // of the recent peak
const RECOVER_ABOVE = 0.8;
const PEAK_WINDOW = 12;       // samples of PEAK_EVERY seconds: the "recent" peak looks back a minute
const PEAK_EVERY = 5;
const MIN_PEAK = 100;         // no crash talk in a tiny world
const SEA_SHRINK_POINTS = 10;

export class MilestoneTracker {
  private fired = new Set<MilestoneId>();
  private peaks: number[] = [];
  private lastPeakSample = -Infinity;
  private crashPeak = 0;
  private seaBase: number | undefined;
  private seenSpecies = new Set<number>();
  private emptySince = new Map<number, number>();

  has(id: MilestoneId): boolean { return this.fired.has(id); }

  /** Returns the milestones newly reached at this moment, in a fixed order. */
  update(inp: MilestoneInput): MilestoneFire[] {
    const out: MilestoneFire[] = [];
    const fire = (id: MilestoneId, extra: Partial<MilestoneFire> = {}) => {
      if (this.fired.has(id)) return;
      this.fired.add(id);
      out.push({ id, ...extra });
    };
    const as = inp.animals;
    const settled = as.filter((a) => a.ageSec >= SETTLE_SEC);

    const walker = settled.find((a) => a.mode === 0 && a.onLand);
    if (walker) fire('walker', { organismId: walker.id });
    const flier = settled.find((a) => a.mode === 2);
    if (flier) fire('flier', { organismId: flier.id });
    const hunters = settled.filter((a) => a.diet > HUNTER_DIET);
    if (hunters.length > 0) fire('hunter', { organismId: hunters[0].id });
    if (hunters.length > 0 && as.length >= 20) {
      const sorted = as.map((a) => a.scale).sort((x, y) => x - y);
      const q = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * APEX_SHARE))];
      const apex = hunters.filter((a) => a.scale >= q).sort((x, y) => y.scale - x.scale)[0];
      if (apex) fire('apex', { organismId: apex.id });
    }
    const giant = settled.find((a) => a.scale >= GIANT_M);
    if (giant) fire('giant', { organismId: giant.id });
    const shell = settled.find((a) => a.armoured && a.mode === 0);
    if (shell) fire('armoured', { organismId: shell.id });

    const n = inp.speciesLive.length;
    if (n >= FIRST_SPECIES) fire('species5');
    if (n >= MANY_SPECIES) fire('species8');

    // a species that has been alive and is now gone for EXTINCT_SEC
    for (const s of inp.speciesLive) {
      if (s.live > 0) { this.seenSpecies.add(s.id); this.emptySince.delete(s.id); }
      else if (this.seenSpecies.has(s.id)) {
        const since = this.emptySince.get(s.id) ?? inp.sec;
        this.emptySince.set(s.id, since);
        if (inp.sec - since >= EXTINCT_SEC) fire('extinct', { speciesBinId: s.id });
      }
    }

    // a crash is a fall below CRASH_BELOW of the recent peak; recovery is the way back above RECOVER_ABOVE of that peak
    if (inp.sec - this.lastPeakSample >= PEAK_EVERY) {
      this.lastPeakSample = inp.sec;
      this.peaks.push(as.length);
      if (this.peaks.length > PEAK_WINDOW) this.peaks.shift();
    }
    const peak = Math.max(0, ...this.peaks);
    if (!this.fired.has('crash') && peak >= MIN_PEAK && as.length < CRASH_BELOW * peak) {
      this.crashPeak = peak;
      fire('crash');
    }
    if (this.fired.has('crash') && !this.fired.has('recover') && as.length > RECOVER_ABOVE * this.crashPeak) fire('recover');

    if (inp.buildComplete) {
      if (this.seaBase === undefined) this.seaBase = inp.seaCover;
      else if (inp.seaCover <= this.seaBase - SEA_SHRINK_POINTS) fire('seasShrink');
    }
    return out;
  }
}
