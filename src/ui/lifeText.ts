// Plain-words descriptions of living things (CLAUDE.md "Click to inspect"): pure functions from a body plan, genes
// or flora cell to label/value rows. No DOM, so they are unit-tested. The sim's BodyPlan is the source of every number.
import { flightCeiling, flightEnvFromStats, type FlightParams } from '../sim/flight';
import { roleOf, type FunctionalType, type Role } from '../sim/guide';
import { SILICON_WALKER_SEGMENT_THRESHOLD, type BodyPlan, type LocomotionMode } from '../sim/develop';
import type { BodyGenes } from '../sim/genome';
import type { OrganismRecord } from '../sim/organismLayout';
import type { FloraForm, FloraSpecies } from '../render/floraForm';
import type { WorldConfig } from '../worlds/types';
import { formatValue } from './format';

export type Rows = [string, string][];

export interface TraitExplanation { label: string; text: string }

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function lengthWords(m: number): string {
  return m >= 1 ? `${m.toFixed(1)} m` : `${Math.max(1, Math.round(m * 100))} cm`;
}

export function movesWords(mode: LocomotionMode, radial = false, plan?: Pick<BodyPlan, 'chemistry' | 'architecture' | 'legPairs' | 'shellCover'>): string {
  switch (mode) {
    case 0:
      if (plan && plan.chemistry === 'silicon' && plan.architecture === 'axial' && plan.legPairs > 0) {
        return `Walks on ${plan.legPairs === 1 ? 'two' : 'four'} jointed rod legs${plan.shellCover >= 0.05 ? ' under a ceramic shell' : ''}`;
      }
      return 'Walks on the ground';
    case 1: return radial ? 'Rows through the liquid with its rod arms, hub level' : 'Swims';
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
      : si
        ? ['Body', `Front-first body of ${plural(plan.segmentCount, 'angular segment')}${plan.shellCover >= 0.05 ? ' under a ceramic shell' : ''}`]
        : ['Body', `${plural(plan.segmentCount, 'segment')}, ${plan.curl > 0.05 ? 'curling' : 'rounded'}`],
    ['Length', lengthWords(plan.scale)],
    radial
      ? ['Arms', `${plan.symmetry} ${ARM_WORDS[plan.armKind]} arms${plan.legPairs === 0 ? ' (short spikes)' : ''}`]
      : ['Legs', plan.legPairs === 0 ? 'None' : `${plural(plan.legPairs, 'pair')} of ${plan.limbKind === 'leg' ? (si ? 'angular jointed rod legs' : 'jointed legs') : 'tentacles'}`],
    ['Plates', plan.plateCover < 0.05 ? 'None' : `${si ? (radial ? 'Silicon-nitride ceramic tiles' : 'Silicon-nitride ceramic shell') : 'Shell'} over ${pct(plan.plateCover)} of the ${radial ? 'facets' : si ? 'segments' : 'back'}`],
    ['Horns', plan.hornCount === 0 ? 'None' : plural(plan.hornCount, !radial && si ? 'ceramic spike' : HORN_WORDS[plan.hornKind])],
    ['Eyes', plan.eyeKind === 'none' || plan.eyeCount === 0
      ? 'None'
      : radial
        ? `${plural(plan.eyeCount / plan.symmetry, 'dot eye')} at each arm tip`
        : plural(plan.eyeCount, si ? 'dot eye at the front' : 'ring eye')],
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
  /** Live stats and the world's flight coefficients, for the flight-ceiling row. */
  flight?: { stats: Record<string, number>; params: FlightParams; tissueRhoC: number };
}

export function organismRows(rec: OrganismRecord, plan: BodyPlan | undefined, ctx: OrganismContext): Rows {
  const rows: Rows = [];
  if (ctx.form) rows.push(['Form', ctx.form.name === undefined ? '(not yet a recognised species)' : ctx.form.recognised ? ctx.form.name : `${ctx.form.name} (not yet a common form)`]);
  rows.push(['Role', roleWords(roleOf(plan ? plan.diet : rec.body.diet))]);
  rows.push(['Moves', movesWords(plan ? plan.mode : rec.mode, plan ? plan.architecture === 'radial' : ctx.chemistry === 'silicon', plan)]);
  rows.push(...(plan ? planRows(plan) : geneRows(rec.body)));
  if (plan && ctx.flight && plan.mode === 2 && (plan.liftSpan ?? 0) > 0) {
    const env = flightEnvFromStats(ctx.flight.stats);
    const h = flightCeiling({ mass: plan.mass, liftSpan: plan.liftSpan!, bodyDensity: plan.bodyDensity, chemistry: plan.chemistry }, env, ctx.flight.params, ctx.flight.tissueRhoC);
    rows.push(['Flight ceiling', h < 1 ? 'Cannot climb: weight beats lift here' : `Up to ${Math.round(h).toLocaleString('en-US')} m: the ceiling set by gravity (${env.gravity.toFixed(2)} g) and air density (${env.airKgM3.toFixed(1)} kg/m³)`]);
  }
  rows.push(['Size', `${rec.size.toFixed(2)} × typical`]);
  rows.push(['Preferred temperature', `${formatValue(rec.prefTemp, '°C')} ± ${rec.tolerance.toFixed(1)} °C`]);
  rows.push([ctx.chemistry === 'silicon' ? 'Cold stability' : 'Oxygen need', pct(rec.chem)]);
  rows.push(['Generation', String(rec.generation)]);
  if (ctx.alive) rows.push(['Energy', rec.energy >= 1 ? 'Ready to copy itself' : `${pct(rec.energy)} of the way to copying`]);
  return rows;
}

/** A specimen-specific subtitle; unlike the world-level feature copy, this follows the actual developed body plan. */
export function organismDescription(plan: BodyPlan): string {
  if (plan.chemistry === 'silicon' && plan.architecture === 'axial') {
    const shell = plan.shellCover >= 0.05 ? `, ceramic shell over ${pct(plan.shellCover)} of its body` : '';
    return `Front-first silicon walker: ${plural(plan.segmentCount, 'angular segment')}${shell}.`;
  }
  if (plan.chemistry === 'silicon') {
    return `${plan.symmetry}-fold radial silicon hub with ${plural(plan.tiers, 'facet tier')} and ${plan.armKind} arms.`;
  }
  return `Bilateral carbon body with ${plural(plan.segmentCount, 'segment')}; ${plan.legPairs === 0 ? 'no leg pairs' : plural(plan.legPairs, 'leg pair')}.`;
}

/**
 * Explain the model rules acting on this animal's genes. These describe implemented effects and trade-offs;
 * they deliberately do not claim to identify why a lineage spread in a particular run.
 */
export function organismExplanations(
  rec: OrganismRecord, plan: BodyPlan, world: WorldConfig, stats: Record<string, number>,
): TraitExplanation[] {
  const explanations: TraitExplanation[] = [];
  const genes = rec.body;
  const legsFromGene = Math.round(4 * genes.limbPairs);
  const gene = (v: number) => v.toFixed(2);

  if (plan.chemistry === 'silicon' && plan.architecture === 'axial') {
    explanations.push({
      label: 'Body plan · speculative rule',
      text: `Segment gene ${gene(genes.segments)} meets the ≥ ${SILICON_WALKER_SEGMENT_THRESHOLD.toFixed(2)} gate, and the limb gene resolves to ${legsFromGene} pairs (gate: 1–2). That triggers our assumed front-first silicon branch; the plates gene separately sets shell coverage.`,
    });
  } else if (plan.chemistry === 'silicon') {
    const missedGates: string[] = [];
    if (genes.segments < SILICON_WALKER_SEGMENT_THRESHOLD) {
      missedGates.push(`segment gene ${gene(genes.segments)} is below ${SILICON_WALKER_SEGMENT_THRESHOLD.toFixed(2)}`);
    }
    if (legsFromGene < 1 || legsFromGene > 2) {
      missedGates.push(`${legsFromGene} leg pair${legsFromGene === 1 ? '' : 's'} ${legsFromGene === 1 ? 'falls' : 'fall'} outside the 1–2 gate`);
    }
    explanations.push({
      label: 'Body plan · speculative rule',
      text: `This genome misses the walker gate: ${missedGates.join('; ')}. Radial ${plan.symmetry}-fold crystals are the model’s fallback; both silicon forms are design assumptions, not established biology.`,
    });
  } else {
    explanations.push({
      label: 'Body plan · model grammar',
      text: `The model reads carbon body genes through a bilateral, front-to-back grammar; this genome develops ${plan.segmentCount} segments and ${plan.legPairs} leg pairs. That is our simplifying body-plan rule, not a claim that all carbon life must have this shape.`,
    });
  }

  const modeNames: Record<LocomotionMode, string> = { 0: 'walking', 1: 'swimming', 2: 'hovering', 3: 'staying put' };
  const costs = plan.modeCosts;
  explanations.push({
    label: 'Movement · modeled cost',
    text: `${modeNames[plan.mode]} has the lowest relative cost at birth: walk ${costs.walk.toFixed(2)}, swim ${costs.swim.toFixed(2)}, hover ${costs.hover.toFixed(2)}, stay put ${costs.sessile.toFixed(2)}. The ecology can choose again in another medium; these are model scores, not measured energy use.`,
  });

  explanations.push({
    label: 'Feeding · modeled trade-off',
    text: `Diet gene ${gene(plan.diet)} makes it a ${roleOf(plan.diet)} in the model. Plant-gain and meat-gain weights are ${pct(plan.plantGain)} and ${pct(plan.meatGain)}; hunting still needs reachable prey.`,
  });

  explanations.push({
    label: 'Protection · modeled trade-off',
    text: `${pct(plan.plateCover)} plate coverage and ${plan.hornCount} horn${plan.hornCount === 1 ? '' : 's'} set its predator-defense score to ${plan.defence.toFixed(2)}. Plates and horns add mass; silicon plates also slow modeled dissolution in liquid. This is a possible trade-off, not proof of selection.`,
  });

  const chemistryTrait = world.life.rules.chemTrait;
  if (chemistryTrait.kind === 'coldStability') {
    explanations.push({
      label: 'Climate · cold stability',
      text: `Cold-stability gene ${pct(rec.chem)} shrinks the above-preference temperature difference by ${pct(chemistryTrait.warmRelief * rec.chem)} before the stress calculation. It also raises upkeep by ${pct(chemistryTrait.cost * rec.chem)}, so greater stability has a cost.`,
    });
  } else {
    const oxygen = Math.max(0, stats.oxygen ?? 0);
    const oxygenAvailable = oxygen / (oxygen + chemistryTrait.halfSaturation);
    const foodFactor = 1 - rec.chem + rec.chem * (1 + chemistryTrait.aerobicBonus) * oxygenAvailable;
    explanations.push({
      label: 'Climate · oxygen need',
      text: `At ${oxygen.toFixed(1)}% oxygen, this gene gives a modeled food-use factor of ${foodFactor.toFixed(1)}×. The same rule raises the size ceiling with oxygen; low oxygen constrains large consumers.`,
    });
  }

  return explanations;
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
  if (plan) rows.push(['Moves', movesWords(plan.mode, plan.architecture === 'radial', plan)], ...planRows(plan));
  return rows;
}
