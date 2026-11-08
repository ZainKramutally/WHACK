// Sea level from sea cover, pure. The hero basin stands in for the app's terrain patch: seaLevel is the height below
// which `cover × COMPRESS` of the basin lies (CLAUDE.md "seaLevel is the height at which the fraction of the patch lying
// below it equals seaCover"). COMPRESS 0.5 is a mockup concession [game]: it keeps the hero frame's foreground dry.
import { heightAt } from '../field';
import { BASIN, EXPLORER } from '../layout';

export const COMPRESS = 0.5;
let sorted: number[] | null = null;

function basinHeights(): number[] {
  if (sorted) return sorted;
  const hs: number[] = [];
  for (let x = BASIN.x - 340; x <= BASIN.x + 340; x += 5) for (let z = BASIN.z - 340; z <= BASIN.z + 340; z += 5)
    if (Math.hypot(x - BASIN.x, z - BASIN.z) < BASIN.radius * 1.3) hs.push(heightAt(x, z));
  return (sorted = hs.sort((a, b) => a - b));
}

/** Highest the sea may sit: below the hero camera's ground. */
export const SEA_CAP = heightAt(0, 0) - 1.0;

/** Sea level (m) for a 0..1 sea cover; -Infinity when there is no sea. Continuous and non-decreasing in cover. */
export function seaLevelFor(cover: number): number {
  if (!(cover > 0)) return -Infinity;
  const hs = basinHeights();
  const f = Math.min(1, cover * COMPRESS) * (hs.length - 1);
  const i = Math.floor(f), t = f - i;
  const h = hs[i] + (hs[Math.min(hs.length - 1, i + 1)] - hs[i]) * t;
  return Math.min(SEA_CAP, h);
}

/** Nearest dry stand for the explorer (metres from EXPLORER, searched toward the left bank first). */
export function dryExplorer(level: number): { x: number; z: number } {
  if (heightAt(EXPLORER.x, EXPLORER.z) > level + 0.35) return { x: EXPLORER.x, z: EXPLORER.z };
  for (let r = 1; r < 60; r += 0.5) for (const s of [-1, 1]) {
    const x = EXPLORER.x + s * r, z = EXPLORER.z + r * 0.3;
    if (heightAt(x, z) > level + 0.35) return { x, z };
  }
  return { x: EXPLORER.x, z: EXPLORER.z };
}
