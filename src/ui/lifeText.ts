// Plain-words descriptions of living things (CLAUDE.md "Click to inspect"): pure functions from a body plan, genes
// or flora cell to label/value rows. No DOM, so they are unit-tested. The sim's BodyPlan is the source of every number.
import { flightCeiling, flightEnvFromStats, type FlightParams } from '../sim/flight';
import { roleOf, type FunctionalType, type Role } from '../sim/guide';
import { SILICON_WALKER_SEGMENT_THRESHOLD, skinArea, supportLoad, type BodyPlan, type LocomotionMode } from '../sim/develop';
import type { BodyGenes } from '../sim/genome';
import type { OrganismRecord } from '../sim/organismLayout';
import type { FloraForm, FloraSpecies } from '../render/floraForm';
import type { WorldConfig } from '../worlds/types';
import type { LifeRules } from '../sim/population';
import { habitatOf, type Habitat } from './cardIcons';

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
  /** The world's chemistry trait (world.life.rules.chemTrait): every coefficient for the living-conditions rows comes from here. */
  chemTrait: ChemTrait;
  /** world.life.ledger: aerobicRef / aerobicHunt feed the hunter's oxygen threshold. */
  ledger?: Record<string, number>;
  /** Species this animal belongs to (the sim's announced name), and whether the player has found it. No name: it matches no announced species. */
  form?: { name?: string; recognised: boolean };
  /** Include live-only rows (energy). */
  alive: boolean;
  /** Live stats and the world's flight coefficients, for the flight-ceiling row. */
  flight?: { stats: Record<string, number>; params: FlightParams; tissueRhoC: number };
}

type ChemTrait = LifeRules['chemTrait'];

/**
 * Temperature range the animal is comfortable in: preferred ± tolerance (one standard deviation of the sim's comfort curve,
 * ecology.ts climateMatch). On silicon the warm side stretches by 1 / (1 − warmRelief × coldStability), as the sim shrinks warm-side stress.
 */
export function livingRange(prefTemp: number, tolerance: number, chem: number, ct: ChemTrait): [number, number] {
  const warm = ct.kind === 'coldStability' ? tolerance / (1 - ct.warmRelief * chem) : tolerance;
  return [prefTemp - tolerance, prefTemp + warm];
}

export function livingRangeText(lo: number, hi: number): string {
  const f = (v: number) => v.toFixed(1).replace(/\.0$/, '').replace('-', '−');
  return `${f(lo)} – ${f(hi)} °C`;
}

/**
 * Least oxygen (%) below which the animal starts paying an oxygen penalty in the sim: the largest of
 * - aerobic gain (ecology.ts ~702): food use 1 − chem + chem·(1 + aerobicBonus)·O₂/(O₂ + halfSaturation) beats its O₂-free value (1 − chem) from O₂ = halfSaturation / aerobicBonus, when chem > 0;
 * - size cap (ecology.ts ~703, population.ts maxBodySize): stress appears when size > (baseMaxSize + maxSizePerPercent·O₂) / (1 + huntPenalty·diet), i.e. below O₂ = ((1 + huntPenalty·diet)·size − baseMaxSize) / maxSizePerPercent;
 * - hunters only (ecology.ts ~709, ~770): catch rate ∝ scope^aerobicHunt, and scope = aerobicFloor + (1 − aerobicFloor)·O₂/aerobicRef reaches 1 at O₂ = aerobicRef.
 * Not counted: the soft speed and movement-cost loss every mover pays below aerobicRef (it would put every animal at ~21%).
 * Null on a world with no oxygen trait (silicon). All coefficients come from world config.
 */
export function minOxygen(chem: number, size: number, diet: number, ct: ChemTrait, ledger: Record<string, number> = {}): number | null {
  if (ct.kind !== 'oxygenNeed') return null;
  const aerobic = chem > 0 && ct.aerobicBonus > 0 ? ct.halfSaturation / ct.aerobicBonus : 0;
  const cap = ct.maxSizePerPercent > 0 ? ((1 + (ct.huntPenalty ?? 0) * diet) * size - ct.baseMaxSize) / ct.maxSizePerPercent : 0;
  const hunt = roleOf(diet) === 'hunter' && (ledger.aerobicRef ?? 0) > 0 && (ledger.aerobicHunt ?? 0) > 0 ? ledger.aerobicRef : 0;
  return Math.max(0, aerobic, cap, hunt);
}

/** The icon chips' data: diet role and habitat. */
export function organismTags(rec: OrganismRecord, plan: BodyPlan | undefined): { role: Role; habitat: Habitat } {
  return { role: roleOf(plan ? plan.diet : rec.body.diet), habitat: habitatOf(plan ? plan.mode : rec.mode, rec.body.buoy) };
}

export function organismRows(rec: OrganismRecord, plan: BodyPlan | undefined, ctx: OrganismContext): Rows {
  const rows: Rows = [];
  if (ctx.form) rows.push(['Form', ctx.form.name === undefined ? '(not yet a recognised species)' : ctx.form.recognised ? ctx.form.name : `${ctx.form.name} (not yet a common form)`]);
  const [lo, hi] = livingRange(rec.prefTemp, rec.tolerance, rec.chem, ctx.chemTrait);
  rows.push(['Lives at', livingRangeText(lo, hi)]);
  const o2 = minOxygen(rec.chem, rec.size, plan ? plan.diet : rec.body.diet, ctx.chemTrait, ctx.ledger);
  if (o2 !== null) rows.push(['Needs', `≥ ${o2.toFixed(1)}% oxygen${rec.chem > 0 ? ` (${pct(rec.chem)} of its energy from oxygen)` : ''}`]);
  if (plan) rows.push(['Length', lengthWords(plan.scale)]);
  if (plan && ctx.flight && plan.mode === 2 && (plan.liftSpan ?? 0) > 0) {
    const env = flightEnvFromStats(ctx.flight.stats);
    const h = flightCeiling({ mass: plan.mass, liftSpan: plan.liftSpan!, bodyDensity: plan.bodyDensity, chemistry: plan.chemistry }, env, ctx.flight.params, ctx.flight.tissueRhoC);
    rows.push(['Flight ceiling', h < 1 ? 'Cannot climb: weight beats lift here' : `Up to ${Math.round(h).toLocaleString('en-US')} m: the ceiling set by gravity (${env.gravity.toFixed(2)} g) and air density (${env.airKgM3.toFixed(1)} kg/m³)`]);
  }
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
 * Lines for effects the model prices from the live climate: heat balance (skin area against temperature), standing under
 * gravity (square-cube support load) and flight or floating (wings, air density, gravity). A line appears only when the
 * effect is big enough to matter for this body here; the thresholds are presentation only.
 */
export function bodyFitExplanations(plan: BodyPlan, world: WorldConfig, stats: Record<string, number>, spec = ''): TraitExplanation[] {
  const out: TraitExplanation[] = [];
  const L = (world.life.ledger ?? {}) as Record<string, number>;
  const t = stats.temperature, g = stats.gravity, rho = stats.airDensity;

  if ((L.thermalSpanC ?? 0) > 0 && (L.thermalK ?? 0) > 0 && t !== undefined && plan.mass > 0) {
    const x = Math.max(-1, Math.min(1, (t - (L.thermalRefC ?? 15)) / L.thermalSpanC!));
    const skin = skinArea(plan) / Math.max(1e-9, plan.mass ** 0.75) / (L.thermalSurfRef || 1);
    const load = x < 0 ? -x * (skin - 1) : x * (1 / skin - 1);
    const cost = L.thermalK! * load; // the share of upkeep it adds (or saves), as the sim prices it
    if (cost > 0.08) {
      out.push({ label: `Heat${spec}`, text: x < 0
        ? 'Long and thin, with a lot of skin for its size. In this cold it loses heat fast, which costs extra energy.'
        : 'Compact and bulky, with little skin for its size. In this heat it struggles to shed warmth, which costs extra energy.' });
    } else if (cost < -0.08) {
      out.push({ label: `Heat${spec}`, text: x < 0
        ? 'Compact and bulky: in the cold, a round body loses less heat, like a walrus. That saves energy.'
        : 'Slender with long limbs: in the heat, extra skin sheds warmth. That saves energy.' });
    }
  }

  if (plan.mode === 0 && g !== undefined && (L.supportCost ?? 0) > 0) {
    const scaleRef = (world.life.inputs as { economics?: { gravityScaleRef?: number } }).economics?.gravityScaleRef ?? 1;
    const cost = L.supportCost! * (supportLoad(plan, g, scaleRef) - (L.supportRef ?? 0));
    if (cost > 0.1) {
      out.push({ label: `Gravity${spec}`, text: `Holding up this body is costly here: gravity is ${g.toFixed(2)} g, and long legs on a big body cost the most.` });
    } else if (cost < -0.1) {
      out.push({ label: `Gravity${spec}`, text: `This body is easy to hold up on a world with ${g.toFixed(2)} g, so standing and walking cost less.` });
    }
  }

  if (plan.mode === 2 && rho !== undefined && g !== undefined) {
    out.push({ label: `Flight${spec}`, text: plan.wingSpan > 0
      ? `Flies: a light body, big wings, thick air (${rho.toFixed(1)} kg/m³) and gravity of ${g.toFixed(2)} g make flight affordable here.`
      : `Floats: a light body hangs in air this thick (${rho.toFixed(1)} kg/m³), with gravity at ${g.toFixed(2)} g.` });
  }
  return out;
}

/**
 * "Why these traits?": one plain line per trait, cause then effect, written as a museum label. Each line states only what the
 * model does with the genes. It does not claim to know why a lineage spread in a particular run.
 */
export function organismExplanations(
  rec: OrganismRecord, plan: BodyPlan, world: WorldConfig, stats: Record<string, number>,
): TraitExplanation[] {
  const explanations: TraitExplanation[] = [];
  const silicon = plan.chemistry === 'silicon';
  const spec = silicon ? ' (speculative)' : '';

  if (silicon && plan.architecture === 'axial') {
    explanations.push({
      label: `Body shape${spec}`,
      text: 'A walker with a front end and one or two pairs of legs. Our model builds this shape from silicon when a genome has enough segments and one or two leg pairs. It is a design guess, not known biology.',
    });
  } else if (silicon) {
    explanations.push({
      label: `Body shape${spec}`,
      text: 'A crystal star: arms around a central hub. This is our default silicon shape. The walker shape needs more segments plus one or two leg pairs, and this genome falls short. It is a design guess, not known biology.',
    });
  } else {
    const legs = plan.legPairs === 0 ? 'no legs' : plural(plan.legPairs, 'pair of legs', 'pairs of legs');
    explanations.push({
      label: 'Body shape',
      text: `A head-to-tail body with ${plural(plan.segmentCount, 'segment')} and ${legs}. Our model gives every carbon animal this layout. That is a simplification: real animals come in many more shapes.`,
    });
  }

  const how: Record<LocomotionMode, string> = {
    0: 'Walking costs this body the least energy, so it walks.',
    1: 'Swimming costs this body the least energy, so it swims.',
    2: 'Hovering costs this body the least energy, so it floats in the air.',
    3: 'Moving costs more than it pays back, so it stays put.',
  };
  explanations.push({ label: 'How it moves', text: `${how[plan.mode]} In another habitat, the model can pick a different way.` });

  explanations.push(...bodyFitExplanations(plan, world, stats, spec));

  const role = roleOf(plan.diet);
  explanations.push({
    label: 'What it eats',
    text: role === 'hunter'
      ? 'Other animals. Meat gives it most of its energy, but it only eats if prey is within reach.'
      : role === 'grazer'
        ? 'Plants. Plants give it most of its energy.'
        : 'Plants and other animals. Both feed it.',
  });

  const plated = plan.plateCover >= 0.05;
  const horned = plan.hornCount > 0;
  const parts = plated && horned ? 'Plates and horns' : plated ? 'Plates' : 'Horns';
  explanations.push({
    label: `Armour${spec}`,
    text: !plated && !horned
      ? 'No plates or horns, so nothing on its body makes it harder to eat.'
      : `${parts} make it harder for hunters to eat. The cost is extra weight.${silicon && plated ? ' Hard ceramic plates add even more defence in our model, which is a guess.' : ''}`,
  });

  const chemistryTrait = world.life.rules.chemTrait;
  if (chemistryTrait.kind === 'coldStability') {
    explanations.push({
      label: `Cold stability${spec}`,
      text: 'Its chemistry stays steady when the temperature climbs above what it likes, which eases heat stress. Keeping that up uses energy, so more stability is not free.',
    });
  } else {
    const oxygen = Math.max(0, stats.oxygen ?? 0);
    const oxygenAvailable = oxygen / (oxygen + chemistryTrait.halfSaturation);
    const foodFactor = 1 - rec.chem + rec.chem * (1 + chemistryTrait.aerobicBonus) * oxygenAvailable;
    explanations.push({
      label: 'Oxygen',
      text: `Part of its energy comes from burning oxygen. At ${oxygen.toFixed(1)}% oxygen it gets ${foodFactor.toFixed(1)}× the energy from food that an animal without this trait would. Less oxygen means a smaller boost, and big bodies need it most.`,
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
