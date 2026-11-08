// Plain-words descriptions of living things (CLAUDE.md "Click to inspect"): pure functions from a body plan, genes
// or flora cell to label/value rows. No DOM, so they are unit-tested. The sim's BodyPlan is the source of every number.
import { roleOf, type FunctionalType, type Role } from '../sim/guide';
import type { BodyPlan, LocomotionMode } from '../sim/develop';
import type { BodyGenes } from '../sim/genome';
import type { OrganismRecord } from '../sim/organismLayout';
import type { FloraForm, FloraSpecies } from '../render/floraForm';
import { formatValue } from './format';

export type Rows = [string, string][];

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function lengthWords(m: number): string {
  return m >= 1 ? `${m.toFixed(1)} m` : `${Math.max(1, Math.round(m * 100))} cm`;
}

export function movesWords(mode: LocomotionMode, radial = false): string {
  switch (mode) {
    case 0: return 'Walks on the ground';
    case 1: return radial ? 'Rolls and tumbles through the liquid on its faceted hub' : 'Swims';
    case 2: return 'Floats and hovers in the air';
    default: return 'Stays rooted in one place';
  }
}

export function roleWords(role: Role): string {
  switch (role) {
    case 'grazer': return 'Grazer (eats plants)';
    case 'hunter': return 'Hunter (eats other animals)';
    default: return 'Omnivore (eats plants and other animals)';
  }
}

/** The body, one row per feature. `Role` and `Moves` are separate (see organismRows). */
const ARM_WORDS: Record<BodyPlan['armKind'], string> = { none: 'rod', rod: 'straight rod', branch: 'branching', fan: 'fan-bladed', whip: 'whip-like' };
const TAIL_WORDS: Record<BodyPlan['tailKind'], string> = { none: 'None', taper: 'Tapering', whip: 'Long whip', fluke: 'Flat fluke', club: 'Armoured club' };
const HORN_WORDS: Record<BodyPlan['hornKind'], string> = { none: 'horn', pair: 'horn', crown: 'crown horn', antler: 'antler tine', tusk: 'tusk', spire: 'crystal spire' };

export function planRows(plan: BodyPlan): Rows {
  const si = plan.chemistry === 'silicon';
  const radial = plan.architecture === 'radial';
  const rows: Rows = [
    radial
      ? ['Body', `Radial crystal: ${plan.symmetry}-fold symmetry, ${plural(plan.tiers, 'facet tier')}, ${plan.flare > 0.3 ? 'flared' : plan.flare < -0.3 ? 'tapered' : 'straight-sided'}, no head or tail`]
      : ['Body', `${plural(plan.segmentCount, 'segment')}, ${plan.curl > 0.05 ? 'curling' : 'rounded'}`],
    ['Length', lengthWords(plan.scale)],
    radial
      ? ['Arms', `${plan.symmetry} ${ARM_WORDS[plan.armKind]} arms${plan.legPairs === 0 ? ' (short spikes)' : ''}`]
      : ['Legs', plan.legPairs === 0 ? 'None' : `${plural(plan.legPairs, 'pair')} of ${plan.limbKind === 'leg' ? 'jointed legs' : 'tentacles'}`],
    ['Plates', plan.plateCover < 0.05 ? 'None' : `${si ? 'Silicon-nitride ceramic tiles' : 'Shell'} over ${pct(plan.plateCover)} of the ${radial ? 'facets' : 'back'}`],
    ['Horns', plan.hornCount === 0 ? 'None' : plural(plan.hornCount, HORN_WORDS[plan.hornKind])],
    ['Eyes', plan.eyeKind === 'none' || plan.eyeCount === 0
      ? 'None'
      : radial
        ? `${plural(plan.eyeCount / plan.symmetry, 'dot eye')} at each arm tip`
        : plural(plan.eyeCount, 'ring eye')],
  ];
  if (!radial && plan.tailKind !== 'none') rows.push(['Tail', TAIL_WORDS[plan.tailKind]]);
  if (plan.finSpan > 0.05) rows.push(['Fins', 'Paddle fins for swimming']);
  if (plan.wingSpan > 0.05) rows.push(['Wings', 'Membrane wings for hovering']);
  if (plan.glow > 0.1) rows.push(['Glow', `${plan.glow > 0.5 ? 'Bright' : 'Faint'}${si ? ' (non-oxygen chemiluminescence, speculative)' : ''}`]);
  return rows;
}

/** When the body plan was not captured (born before the UI mounted): only what the genes and buffer say. */
export function geneRows(b: BodyGenes): Rows {
  const rows: Rows = [['Body', 'Details were not captured for this one']];
  if (b.glow > 0.5) rows.push(['Glow', 'Glows']);
  return rows;
}

export interface OrganismContext {
  chemistry: 'carbon' | 'silicon';
  /** Species this animal belongs to (the sim's announced name), and whether the player has found it. No name: it matches no announced species. */
  form?: { name?: string; recognised: boolean };
  /** Include live-only rows (energy). */
  alive: boolean;
}

export function organismRows(rec: OrganismRecord, plan: BodyPlan | undefined, ctx: OrganismContext): Rows {
  const rows: Rows = [];
  if (ctx.form) rows.push(['Form', ctx.form.name === undefined ? '(not yet a recognised species)' : ctx.form.recognised ? ctx.form.name : `${ctx.form.name} (not yet a common form)`]);
  rows.push(['Role', roleWords(roleOf(plan ? plan.diet : rec.body.diet))]);
  rows.push(['Moves', movesWords(plan ? plan.mode : rec.mode, plan ? plan.architecture === 'radial' : ctx.chemistry === 'silicon')]);
  rows.push(...(plan ? planRows(plan) : geneRows(rec.body)));
  rows.push(['Size', `${rec.size.toFixed(2)} × typical`]);
  rows.push(['Preferred temperature', `${formatValue(rec.prefTemp, '°C')} ± ${rec.tolerance.toFixed(1)} °C`]);
  rows.push([ctx.chemistry === 'silicon' ? 'Cold stability' : 'Oxygen need', pct(rec.chem)]);
  rows.push(['Generation', String(rec.generation)]);
  if (ctx.alive) rows.push(['Energy', rec.energy >= 1 ? 'Ready to copy itself' : `${pct(rec.energy)} of the way to copying`]);
  return rows;
}

// ---- plants ----

const SPECIES: Record<FloraSpecies, string> = {
  tuft: 'Ground tuft', capped: 'Capped stalk', cup: 'Lantern cup', dome: 'Jellyshroom dome', spire: 'Crystal spire', crust: 'Crystal crust',
};
export const speciesName = (s: FloraSpecies): string => SPECIES[s];

/** Biomass is 0..1 of a cell's capacity. */
export function biomassWords(v: number): string {
  return v < 0.02 ? 'Almost none' : v < 0.15 ? 'Sparse' : v < 0.4 ? 'Thin' : v < 0.7 ? 'Thick' : 'Dense';
}

export function producerRows(mat: number, canopy: number, form: FloraForm | null): Rows {
  const rows: Rows = [];
  if (form) rows.push(['Form', speciesName(form.species)]);
  rows.push(['Ground cover', biomassWords(mat)], ['Taller growth', biomassWords(canopy)]);
  if (form) {
    rows.push(['Height', form.heightScale > 1.15 ? 'Tall (cold favours size)' : form.heightScale < 0.85 ? 'Short (heat shrinks it)' : 'Medium']);
    if (form.glow > 0.1) rows.push(['Glow', form.chemistry === 'silicon' ? 'Glowing tips in the dark' : 'Glows in the dim light']);
  }
  return rows;
}

// ---- dominant form (summary card) ----

export interface DominantInfo { name: string; alive: number; type: FunctionalType }

export function dominantRows(d: DominantInfo, plan: BodyPlan | undefined): Rows {
  const rows: Rows = [['Form', d.name], ['Alive now', String(d.alive)], ['Type', d.type.label]];
  if (plan) rows.push(['Moves', movesWords(plan.mode, plan.architecture === 'radial')], ...planRows(plan));
  return rows;
}
