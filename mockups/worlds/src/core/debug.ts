// #debug tweakpane: dials (Rewrite), preset buttons (Travel), read-only derived values + niches. #stats: stats-gl.
import { Pane } from 'tweakpane';
import Stats from 'stats-gl';
import type { Dials } from '../contracts';
import { SPECIES } from '../contracts';
import { PRESETS } from '../presets';
import { normalizeRecipe, normalizeSea } from '../derive';
import type { World } from './world';

export function createDebug(world: World) {
  const pane: any = new Pane({ title: 'World dials' });
  (pane.element.parentElement as HTMLElement).style.zIndex = '10';
  const P = { c: 0.3, si: 0.4, o: 0.3, water: 1, ammonia: 0, methane: 0, acid: 0, heat: 0.5, light: 0.5, age: 0.5 };
  const read = (): Dials => ({
    recipe: normalizeRecipe({ c: P.c, si: P.si, o: P.o }),
    sea: normalizeSea({ water: P.water, ammonia: P.ammonia, methane: P.methane, acid: P.acid }),
    heat: P.heat, light: P.light, age: P.age, seed: world.preset.dials.seed,
  });
  const pull = (d: Dials) => {
    Object.assign(P, { ...d.recipe, ...d.sea, heat: d.heat, light: d.light, age: d.age });
    pane.refresh();
  };
  const push = () => {
    const d = read();
    // show the normalised values so the recipe / sea sliders stay honest
    Object.assign(P, { ...d.recipe, ...d.sea });
    pane.refresh();
    world.rewrite(d);
  };

  const presetsF = pane.addFolder({ title: 'Travel' });
  for (const p of PRESETS) presetsF.addButton({ title: `${p.id} ${p.name}` }).on('click', () => world.travel(p.id));

  const rec = pane.addFolder({ title: 'Recipe (normalised)' });
  for (const k of ['c', 'si', 'o'] as const) rec.addBinding(P, k, { min: 0, max: 1, step: 0.01 }).on('change', push);
  const sea = pane.addFolder({ title: 'Sea weights' });
  for (const k of ['water', 'ammonia', 'methane', 'acid'] as const) sea.addBinding(P, k, { min: 0, max: 1, step: 0.01 }).on('change', push);
  for (const k of ['water', 'ammonia', 'methane', 'acid'] as const) {
    sea.addButton({ title: `→ ${k}` }).on('click', () => { P.water = P.ammonia = P.methane = P.acid = 0; P[k] = 1; push(); });
  }
  for (const k of ['heat', 'light', 'age'] as const) pane.addBinding(P, k, { min: 0, max: 1, step: 0.01 }).on('change', push);

  const R: Record<string, number> = {};
  const rf = pane.addFolder({ title: 'Derived (read-only)', expanded: false });
  for (const k of ['stainAmount', 'builders', 'spireHeight', 'erosion', 'pores', 'arches', 'snow', 'life', 'glow', 'capWidth', 'stalkHeight', 'fogDensity', 'char']) {
    R[k] = 0; rf.addBinding(R, k, { readonly: true, format: (v: number) => v.toFixed(3) });
  }
  const nf = pane.addFolder({ title: 'Niches (read-only)', expanded: false });
  for (const s of SPECIES) { R['n_' + s] = 0; nf.addBinding(R, 'n_' + s, { readonly: true, label: s, format: (v: number) => v.toFixed(2) }); }

  let acc = 0;
  const hook = () => {
    const d = world.ctx.derived as any;
    for (const k of Object.keys(R)) R[k] = k.startsWith('n_') ? d.niches[k.slice(2)] : d[k];
  };
  world.onDerived = () => {
    const cur = world.morph.target;
    if (world.morph.current === world.morph.target || true) { acc = 0; hook(); }
    void cur;
  };
  pull(world.preset.dials);
  hook();
  return {
    tick(dt: number) {
      acc += dt;
      if (acc > 0.25) { acc = 0; hook(); pane.refresh(); }
    },
    syncPreset() { pull(world.preset.dials); },
  };
}

export async function createStats(world: World) {
  try {
    const stats = new (Stats as any)({ trackGPU: false });
    document.body.appendChild(stats.dom);
    stats.dom.style.zIndex = '10';
    try { await stats.init(world.renderer); } catch { /* optional */ }
    return stats;
  } catch (e) { console.warn('stats-gl unavailable', e); return null; }
}
