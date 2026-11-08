// What the UI knows about living things: body plans (from snapshot births), which form each animal belongs to, how many
// of each form are alive, which form dominates, and the bestiary (kinds the player has found, and kinds that died out).
// Re-uses the sim's pure clustering and naming (sim/guide.ts), so a form's name here matches the sim's.
import { clusterForms, functionalType, nameForm, type FunctionalType, type GuideAnimal } from '../sim/guide';
import { Bestiary, type KindSighting } from './bestiary';
import type { BodyPlan, LocomotionMode } from '../sim/develop';
import { organismCount, readOrganism } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { listen, type UiBus } from './uiBus';

export interface FormInfo { name: string; type: FunctionalType; alive: number; repId: number; /** Largest single cluster under this name. */ largest: number }
export interface Analysis {
  /** Animal id → form name (every animal gets one, including those in clusters too small to count as a form). */
  nameOf: Map<number, string>;
  forms: Map<string, FormInfo>;
  /** The form with the most live animals. */
  dominant: FormInfo | null;
}

export const EMPTY_ANALYSIS: Analysis = { nameOf: new Map(), forms: new Map(), dominant: null };

/** Cluster the live animals in an organism buffer and name the clusters. Pure. */
export function analyseAnimals(buf: Float32Array, modeOf: (id: number) => LocomotionMode | undefined = () => undefined): Analysis {
  const animals: GuideAnimal[] = [];
  for (let i = 0; i < organismCount(buf); i++) {
    const r = readOrganism(buf, i);
    if (r.role < 0.5) continue; // producers are not animals
    animals.push({
      id: r.id,
      mode: modeOf(r.id), // the plan's real mode (stable), not the buffer's current-medium mode
      genome: { body: r.body, climate: { prefTemp: r.prefTemp, tolerance: r.tolerance, chem: r.chem }, comp: r.comp, lineage: r.lineage },
    });
  }
  const nameOf = new Map<number, string>();
  const forms = new Map<string, FormInfo>();
  const biggest = new Map<string, number>(); // size of the largest cluster seen under each name
  for (const cl of clusterForms(animals)) {
    const name = nameForm(cl.centroid, cl.hint);
    let info = forms.get(name);
    if (!info) {
      info = { name, type: functionalType(cl.centroid, cl.hint), alive: 0, repId: cl.members[0], largest: 0 };
      forms.set(name, info);
    }
    info.alive += cl.members.length;
    info.largest = Math.max(info.largest, cl.members.length);
    if (cl.members.length > (biggest.get(name) ?? 0)) {
      biggest.set(name, cl.members.length);
      info.type = functionalType(cl.centroid, cl.hint);
      info.repId = cl.members[0];
    }
    for (const id of cl.members) nameOf.set(id, name);
  }
  let dominant: FormInfo | null = null;
  for (const f of forms.values()) {
    if (!dominant || f.alive > dominant.alive || (f.alive === dominant.alive && f.name < dominant.name)) dominant = f;
  }
  return { nameOf, forms, dominant };
}

const ANALYSE_EVERY_SEC = 1;
const MAX_PLANS = 4096;

export function mountLifeRegistry(bus: UiBus) {
  const plans = new Map<number, BodyPlan>();
  const bestiary = new Bestiary();
  let analysis = EMPTY_ANALYSIS;
  let organisms: Float32Array = new Float32Array(0);
  let now = 0;
  let lastAt = -Infinity;
  const subs = new Set<() => void>();
  const finds = new Set<(name: string) => void>();
  const notify = () => subs.forEach((f) => f());

  function analyse() {
    analysis = analyseAnimals(organisms, (id) => plans.get(id)?.mode);
    const sightings = new Map<string, KindSighting>();
    for (const [name, f] of analysis.forms) sightings.set(name, { alive: f.alive, largest: f.largest, type: f.type.label, plan: plans.get(f.repId) });
    bestiary.update(sightings, now);
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
    const isNew = bestiary.discover(name, now, { type: analysis.forms.get(name)?.type.label, plan: plans.get(id), generation });
    if (isNew) finds.forEach((f) => f(name));
    notify();
  }

  const offs = [
    listen(bus, 'sim:snapshot', (s) => {
      now = s.timeSec;
      organisms = s.organisms;
      for (const b of s.births) {
        try { plans.set(b.id, unpackBodyPlan(b.plan)); } catch { /* unknown plan version: card falls back to genes */ }
      }
      if (now - lastAt >= ANALYSE_EVERY_SEC || now < lastAt) {
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
    // Registered before the inspect card mounts, so the card already sees the kind as found when it renders.
    listen(bus, 'inspect:open', ({ target }) => { if (target.kind === 'organism') discover(target.organismId); }),
  ];

  return {
    planOf: (id: number): BodyPlan | undefined => plans.get(id),
    /** Form of a live animal; `recognised` once the player has found its kind (clicking it does that). */
    formOf(id: number): { name: string; recognised: boolean } | undefined {
      const name = analysis.nameOf.get(id);
      return name === undefined ? undefined : { name, recognised: bestiary.get(name)?.found === true };
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
