// What the UI knows about living things: body plans (from snapshot births), which field-guide form each animal
// belongs to, how many of each form are alive, and which form dominates. Re-uses the sim's pure clustering and
// naming (sim/guide.ts), so a form's name here is the one the sim announced.
import { clusterForms, functionalType, nameForm, type FunctionalType, type GuideAnimal } from '../sim/guide';
import type { BodyPlan, LocomotionMode } from '../sim/develop';
import { organismCount, readOrganism } from '../sim/organismLayout';
import { unpackBodyPlan } from '../sim/plan';
import { listen, type UiBus } from './uiBus';

export interface FormInfo { name: string; type: FunctionalType; alive: number; repId: number }
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
      info = { name, type: functionalType(cl.centroid, cl.hint), alive: 0, repId: cl.members[0] };
      forms.set(name, info);
    }
    info.alive += cl.members.length;
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

export interface GuideRow { name: string; type: string; firstSeenSec: number; alive: number }

const ANALYSE_EVERY_SEC = 1;
const MAX_PLANS = 4096;

export function mountLifeRegistry(bus: UiBus) {
  const plans = new Map<number, BodyPlan>();
  const known = new Map<string, { firstSeenSec: number; type?: FunctionalType }>();
  let analysis = EMPTY_ANALYSIS;
  let now = 0;
  let lastAt = -Infinity;
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());

  const offs = [
    listen(bus, 'sim:snapshot', (s) => {
      now = s.timeSec;
      for (const b of s.births) {
        try { plans.set(b.id, unpackBodyPlan(b.plan)); } catch { /* unknown plan version: card falls back to genes */ }
      }
      if (now - lastAt >= ANALYSE_EVERY_SEC || now < lastAt) {
        lastAt = now;
        analysis = analyseAnimals(s.organisms, (id) => plans.get(id)?.mode);
        for (const [name, info] of analysis.forms) { const k = known.get(name); if (k) k.type = info.type; }
        if (plans.size > MAX_PLANS) {
          const alive = new Set<number>();
          for (let i = 0; i < organismCount(s.organisms); i++) alive.add(readOrganism(s.organisms, i).id);
          for (const id of plans.keys()) if (!alive.has(id)) plans.delete(id);
        }
        notify();
      }
    }),
    listen(bus, 'guide:newForm', ({ name }) => {
      if (!known.has(name)) { known.set(name, { firstSeenSec: now, type: analysis.forms.get(name)?.type }); notify(); }
    }),
  ];

  return {
    planOf: (id: number): BodyPlan | undefined => plans.get(id),
    /** Form of a live animal; `recognised` once the guide has announced that name. */
    formOf(id: number): { name: string; recognised: boolean } | undefined {
      const name = analysis.nameOf.get(id);
      return name === undefined ? undefined : { name, recognised: known.has(name) };
    },
    /** Announced forms, newest first, with how many are alive now. */
    forms(): GuideRow[] {
      return [...known].map(([name, k]) => ({
        name,
        type: (analysis.forms.get(name)?.type ?? k.type)?.label ?? '',
        firstSeenSec: k.firstSeenSec,
        alive: analysis.forms.get(name)?.alive ?? 0,
      })).sort((a, b) => b.firstSeenSec - a.firstSeenSec || (a.name < b.name ? -1 : 1));
    },
    dominant(): { info: FormInfo; plan?: BodyPlan } | null {
      const d = analysis.dominant;
      return d ? { info: d, plan: plans.get(d.repId) } : null;
    },
    onChange(fn: () => void) { subs.add(fn); return () => subs.delete(fn); },
    dispose() { offs.forEach((f) => f()); subs.clear(); },
  };
}
export type LifeRegistry = ReturnType<typeof mountLifeRegistry>;
