// What the UI knows about living things: body plans (from snapshot births), which species each animal belongs to, how many
// of each species are alive, which species dominates, and the bestiary (species the player has found, and ones that died out).
// Species identity comes only from the sim: a species exists here when the sim announces it (`guide:newForm`, a cluster of
// at least 20 that held for 20 ecology seconds). The UI's clustering distance is used only to map live animals to the
// nearest announced species within FORM_RADIUS; it never creates one.
import {
  FORM_RADIUS, centroidDistance, functionalType, genomeCentroid, hintOf, meanCentroid,
  type FormCentroid, type FunctionalType, type GuideAnimal,
} from '../sim/guide';
import { Bestiary, type KindSighting } from './bestiary';
import { LOCOMOTION, isSiliconWalkerGenes, type BodyPlan, type LocomotionMode } from '../sim/develop';
import { organismCount, readOrganism } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { listen, type UiBus } from './uiBus';

export interface FormInfo { name: string; type: FunctionalType; alive: number; repId: number }
export interface Species { binId: number; name: string; centroid: FormCentroid; organismId?: number; /** How the announcing animal moved: only animals that move the same way take the name (a hoverer is not a "swimmer"). */ mode?: LocomotionMode; /** Whether the announcing animal was bilateral (axial) rather than a radial silicon hub: a radial tripod and an armoured biped never share a name. */ axial?: boolean }
export interface Analysis {
  /** Animal id → species name. Animals matching no announced species have no entry. */
  nameOf: Map<number, string>;
  forms: Map<string, FormInfo>;
  /** The species with the most live animals. */
  dominant: FormInfo | null;
}

/** A live animal takes the name of the nearest announced species within this distance: a little wider than the sim's cluster radius, so the many animals in clusters too small to announce still read as a kin of a named species. */
const MATCH_RADIUS = 1.8 * FORM_RADIUS;

/** Bilateral (axial) body? Carbon always; silicon only when develop() builds it as the armoured walker. */
const axialOf = (r: { comp: { si: number }; body: { segments: number; limbPairs: number } }): boolean => r.comp.si <= 0.5 || isSiliconWalkerGenes(r.body);

export const EMPTY_ANALYSIS: Analysis = { nameOf: new Map(), forms: new Map(), dominant: null };

/**
 * Map the live animals in an organism buffer to their nearest announced species (within FORM_RADIUS; ties to the lowest
 * bin id). Pure. Also returns each species' mean centroid so the caller can let it follow slow drift, as the sim's bins do.
 */
export function assignSpecies(
  buf: Float32Array,
  species: readonly Species[],
  modeOf: (id: number) => LocomotionMode | undefined = () => undefined,
): Analysis & { drifted: Map<number, FormCentroid> } {
  const members = new Map<number, GuideAnimal[]>();
  const nameOf = new Map<number, string>();
  const ordered = [...species].sort((a, b) => a.binId - b.binId);
  for (let i = 0; i < organismCount(buf); i++) {
    const r = readOrganism(buf, i);
    if (r.role < 0.5) continue; // producers are not animals
    const genome = { body: r.body, climate: { prefTemp: r.prefTemp, tolerance: r.tolerance, chem: r.chem }, comp: r.comp, lineage: r.lineage };
    const c = genomeCentroid(genome);
    let best: Species | undefined;
    let bestD = MATCH_RADIUS;
    for (const sp of ordered) {
      const diver = sp.name.endsWith(' Diver') && (r.mode === LOCOMOTION.swim || r.mode === LOCOMOTION.hover);   // an amphibious species takes both movers
      if (sp.mode !== undefined && sp.mode !== r.mode && !diver) continue;
      if (sp.axial !== undefined && sp.axial !== axialOf(r)) continue;
      const d = centroidDistance(c, sp.centroid);
      if (d <= bestD && (!best || d < bestD)) { best = sp; bestD = d; }
    }
    if (!best) continue;
    nameOf.set(r.id, best.name);
    const list = members.get(best.binId) ?? [];
    list.push({ id: r.id, mode: modeOf(r.id), genome });
    members.set(best.binId, list);
  }
  const forms = new Map<string, FormInfo>();
  const drifted = new Map<number, FormCentroid>();
  let dominant: FormInfo | null = null;
  for (const sp of ordered) {
    const list = members.get(sp.binId);
    if (!list) continue;
    const info: FormInfo = { name: sp.name, type: functionalType(sp.centroid, hintOf(list)), alive: list.length, repId: list[0]!.id };
    forms.set(sp.name, info);
    drifted.set(sp.binId, meanCentroid(list.map((a) => genomeCentroid(a.genome))));
    if (!dominant || info.alive > dominant.alive || (info.alive === dominant.alive && info.name < dominant.name)) dominant = info;
  }
  return { nameOf, forms, dominant, drifted };
}

const ANALYSE_EVERY_SEC = 1;
const MAX_PLANS = 4096;

export function mountLifeRegistry(bus: UiBus) {
  const plans = new Map<number, BodyPlan>();
  const bestiary = new Bestiary();
  const species: Species[] = [];
  let pending: { binId: number; name: string; organismId: number; tries: number }[] = [];
  let analysis: Analysis = EMPTY_ANALYSIS;
  let organisms: Float32Array = new Float32Array(0);
  let prevOrganisms: Float32Array = new Float32Array(0);
  let now = 0;
  let lastAt = -Infinity;
  const subs = new Set<() => void>();
  const finds = new Set<(name: string) => void>();
  const notify = () => subs.forEach((f) => f());

  function analyse() {
    const a = assignSpecies(organisms, species, (id) => plans.get(id)?.mode);
    analysis = a;
    for (const sp of species) { const c = a.drifted.get(sp.binId); if (c) sp.centroid = c; }
    const sightings = new Map<string, KindSighting>();
    for (const [name, f] of a.forms) sightings.set(name, { alive: f.alive, type: f.type.label });
    bestiary.update(sightings, now);
  }

  /** Species announced before their organism's body plan arrived: the tile waits for plans.get(organismId), unmodified. */
  function fillPlans() {
    for (const sp of species) {
      if (bestiary.get(sp.name)?.plan) continue;
      const plan = sp.organismId === undefined ? undefined : plans.get(sp.organismId);
      if (plan) bestiary.setPlan(sp.name, plan);
    }
  }

  /** The announcing organism's genes give the species centroid. Events arrive just before the snapshot that holds it. */
  function resolvePending() {
    pending = pending.filter((p) => {
      for (const buf of [organisms, prevOrganisms]) {
        for (let i = 0; i < organismCount(buf); i++) {
          const r = readOrganism(buf, i);
          if (r.id !== p.organismId) continue;
          if (!species.some((sp) => sp.binId === p.binId)) {
            const centroid = genomeCentroid({ body: r.body, climate: { prefTemp: r.prefTemp, tolerance: r.tolerance, chem: r.chem }, comp: r.comp, lineage: r.lineage });
            species.push({ binId: p.binId, name: p.name, centroid, organismId: p.organismId, mode: r.mode, axial: axialOf(r) });
            const plan = plans.get(p.organismId);
            bestiary.announce(p.name, functionalType(centroid, { mode: plan?.mode }).label, now, plan);
          }
          return false;
        }
      }
      return ++p.tries < 5; // not in either snapshot (died at once): try a few more, then give up
    });
  }

  /** The player clicked animal `id`: file its kind as found (once), and tell subscribers about a new find. */
  function discover(id: number) {
    if (!analysis.nameOf.has(id)) analyse(); // born since the last analysis
    const name = analysis.nameOf.get(id);
    if (name === undefined) return; // gone, or not an animal
    let generation: number | undefined;
    for (let i = 0; i < organismCount(organisms); i++) {
      const r = readOrganism(organisms, i);
      if (r.id === id) { generation = r.generation; break; }
    }
    const isNew = bestiary.discover(name, now, { type: analysis.forms.get(name)?.type.label, generation });
    if (isNew) finds.forEach((f) => f(name));
    notify();
  }

  function isLiveAnimal(id: number): boolean {
    for (let i = 0; i < organismCount(organisms); i++) {
      const r = readOrganism(organisms, i);
      if (r.id === id) return r.role >= 0.5;
    }
    return false;
  }

  const offs = [
    listen(bus, 'sim:snapshot', (s) => {
      now = s.timeSec;
      prevOrganisms = organisms;
      organisms = s.organisms;
      for (const b of s.births) {
        try { plans.set(b.id, unpackBodyPlan(b.plan)); } catch { /* unknown plan version: card falls back to genes */ }
      }
      const hadPending = pending.length;
      if (hadPending) resolvePending();
      fillPlans();
      if (now - lastAt >= ANALYSE_EVERY_SEC || now < lastAt || (hadPending && pending.length < hadPending)) {
        lastAt = now;
        analyse();
        if (plans.size > MAX_PLANS) {
          const alive = new Set<number>();
          for (let i = 0; i < organismCount(s.organisms); i++) alive.add(readOrganism(s.organisms, i).id);
          for (const id of plans.keys()) if (!alive.has(id)) plans.delete(id);
        }
        notify();
      }
    }),
    listen(bus, 'guide:newForm', (f) => { if (!species.some((sp) => sp.binId === f.binId) && !pending.some((p) => p.binId === f.binId)) pending.push({ ...f, tries: 0 }); }),
    // Registered before the inspect card mounts, so the card already sees the kind as found when it renders.
    listen(bus, 'inspect:open', ({ target }) => { if (target.kind === 'organism') discover(target.organismId); }),
  ];

  return {
    planOf: (id: number): BodyPlan | undefined => plans.get(id),
    /**
     * Species of a live animal: the sim's name for it, or no name when it matches no announced species.
     * `recognised` once the player has found that species (clicking one of its animals does that). Undefined for ids that aren't live animals.
     */
    formOf(id: number): { name?: string; recognised: boolean } | undefined {
      if (!analysis.nameOf.has(id) && !isLiveAnimal(id)) return undefined;
      const name = analysis.nameOf.get(id);
      return name === undefined ? { recognised: false } : { name, recognised: bestiary.get(name)?.found === true };
    },
    /** The bestiary: found and locked living kinds, and kinds that died out. */
    bestiary: () => bestiary,
    dominant(): { info: FormInfo; plan?: BodyPlan } | null {
      const d = analysis.dominant;
      return d ? { info: d, plan: plans.get(d.repId) } : null;
    },
    onChange(fn: () => void) { subs.add(fn); return () => subs.delete(fn); },
    /** Called once per kind, the first time the player finds it. */
    onDiscover(fn: (name: string) => void) { finds.add(fn); return () => finds.delete(fn); },
    dispose() { offs.forEach((f) => f()); subs.clear(); finds.clear(); },
  };
}
export type LifeRegistry = ReturnType<typeof mountLifeRegistry>;
