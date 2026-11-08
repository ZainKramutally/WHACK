// Bestiary state (replaces the field guide; owner ruling 2026-11-08). Pure and deterministic: no DOM, no clock of its own.
//
// A kind is a species the sim announced (`guide:newForm`: a cluster of ≥ 20 that held for 20 ecology seconds and matched
// no earlier species). The bestiary only files announced species (announce()); it never invents kinds of its own.
//   - Living kinds stay locked ("?") until the player clicks one of their animals: discovery is the player's job.
//   - A kind with no live animals for EXTINCT_AFTER_SEC is filed as extinct automatically, found or not, so the history
//     of what evolved and died out fills in by itself. If the name comes back, the kind returns to the living.
// The body plan kept for a kind is the announced organism's own, unmodified (the art layer keys species colours on its bits).
// It is set once, at announcement or as soon as that plan arrives (setPlan), and never replaced.
import type { BodyPlan } from '../sim/develop';

/** Seconds (snapshot clock) a kind must have no live animals before it is filed as extinct, so a brief dip to zero doesn't flicker. */
export const EXTINCT_AFTER_SEC = 5;

export interface KindSighting {
  /** Live animals carrying this name. */
  alive: number;
  /** Functional type label, e.g. "grazer · walker". */
  type: string;
}

export interface BestiaryEntry {
  name: string;
  type: string;
  /** The player clicked a living animal of this kind. */
  found: boolean;
  foundAtSec?: number;
  /** Generation of the clicked specimen. */
  generation?: number;
  /** When it joined the bestiary. */
  firstSeenSec: number;
  alive: number;
  peak: number;
  extinct: boolean;
  /** Last time any animal of this kind was alive (the extinction time once extinct). */
  lastAliveSec: number;
  plan?: BodyPlan;
}

export class Bestiary {
  private kinds = new Map<string, BestiaryEntry>();

  has(name: string): boolean { return this.kinds.has(name); }
  get(name: string): BestiaryEntry | undefined { return this.kinds.get(name); }

  /**
   * Fold in one analysis of the live animals (name → sighting). Refreshes counts and pictures of announced species, and files kinds with no live animals for EXTINCT_AFTER_SEC as extinct (or revives them). Returns whether
   * anything visible changed.
   */
  update(sightings: ReadonlyMap<string, KindSighting>, now: number): boolean {
    let changed = false;
    for (const e of this.kinds.values()) {
      const s = sightings.get(e.name);
      const alive = s?.alive ?? 0;
      if (alive !== e.alive) changed = true;
      e.alive = alive;
      if (alive > 0) {
        e.lastAliveSec = now;
        e.peak = Math.max(e.peak, alive);
        if (s!.type) e.type = s!.type;
        if (e.extinct) { e.extinct = false; changed = true; }
      } else if (!e.extinct && now - e.lastAliveSec >= EXTINCT_AFTER_SEC) {
        e.extinct = true;
        changed = true;
      }
    }
    return changed;
  }

  /** The sim announced a species. Files it locked; a repeat announcement of the same name is ignored. */
  announce(name: string, type: string, now: number, plan?: BodyPlan): boolean {
    if (this.kinds.has(name)) return false;
    this.kinds.set(name, { name, type, found: false, firstSeenSec: now, alive: 0, peak: 0, extinct: false, lastAliveSec: now, plan });
    return true;
  }

  /** Late plan for an announced species that had none yet. Never replaces an existing plan. */
  setPlan(name: string, plan: BodyPlan): boolean {
    const e = this.kinds.get(name);
    if (!e || e.plan) return false;
    e.plan = plan;
    return true;
  }

  /**
   * The player clicked a live animal of this species. Only announced species can be found.
   * Returns true only for a new find, so the caller can announce it once.
   */
  discover(name: string, now: number, specimen: { type?: string; generation?: number } = {}): boolean {
    const e = this.kinds.get(name);
    if (!e || e.found) return false;
    e.found = true;
    e.foundAtSec = now;
    e.generation = specimen.generation;
    if (specimen.type) e.type = specimen.type;
    e.extinct = false;
    e.lastAliveSec = now;
    e.alive = Math.max(e.alive, 1);
    e.peak = Math.max(e.peak, 1);
    return true;
  }

  /** Living kinds (found first, in the order found; then locked, most numerous first), then extinct (most recent first). */
  living(): BestiaryEntry[] {
    return [...this.kinds.values()].filter((e) => !e.extinct).sort((a, b) =>
      a.found !== b.found ? (a.found ? -1 : 1)
        : a.found ? (a.foundAtSec! - b.foundAtSec!) || cmp(a.name, b.name)
          : (b.alive - a.alive) || cmp(a.name, b.name));
  }
  extinct(): BestiaryEntry[] {
    return [...this.kinds.values()].filter((e) => e.extinct).sort((a, b) => (b.lastAliveSec - a.lastAliveSec) || cmp(a.name, b.name));
  }
  /** Found kinds and every kind in the bestiary, for the tab badge ("3/7"). */
  counts(): { found: number; total: number } {
    let found = 0;
    for (const e of this.kinds.values()) if (e.found) found++;
    return { found, total: this.kinds.size };
  }
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** How a bestiary tile reads: every announced kind shows its name and sprite; `new` kinds carry the scanner's NEW SPECIES stamp. */
export type TileState = 'extinct' | 'new' | 'scanned';
export function tileState(e: Pick<BestiaryEntry, 'extinct' | 'found'>): TileState {
  return e.extinct ? 'extinct' : e.found ? 'scanned' : 'new';
}
