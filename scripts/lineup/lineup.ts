// Dev-only creature lineup: N random genomes developed in one world's chemistry, drawn by the real fauna code on flat ground.
//   /scripts/lineup/index.html?world=carbon&n=20&seed=1&cols=5&gap=16&view=front
// Not part of the game or any test tier. Used for the variety screenshots (/tmp/variety-{world}.png).
import * as THREE from 'three/webgpu';
import { createApp } from '../../src/render/app';
import { createFauna } from '../../src/render/fauna';
import { developInputsFor } from '../../src/render/counterpart';
import { worlds } from '../../src/worlds';
import { develop } from '../../src/sim/develop';
import { BODY_GENES, type AnimalGenome, type BodyGenes } from '../../src/sim/genome';
import { makeRng } from '../../src/sim/rng';
import { packBodyPlan } from '../../src/sim/plan';
import { packOrganism, ORGANISM_STRIDE } from '../../src/sim/organismLayout';
import { makeStubVisualInputs } from '../../src/render/visualInputs';
import { patchToWorld } from '../../src/render/layout';

const q = new URLSearchParams(location.search);
const id = q.get('world') === 'silicon' ? 'silicon' : 'carbon';
const n = Number(q.get('n') ?? 20), seed = Number(q.get('seed') ?? 1), cols = Number(q.get('cols') ?? 5), gap = Number(q.get('gap') ?? 16);
const light = Number(q.get('light') ?? 0.6), patch = 200;
const world = worlds[id];

const app = await createApp();
for (const o of [...app.scene.children]) if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) app.scene.remove(o);
const ground = app.scene.children.find((o) => o instanceof THREE.Mesh) as THREE.Mesh | undefined;
if (ground && id === 'silicon') (ground.material as THREE.MeshStandardMaterial).color.setHex(0x6e7388);
app.scene.background = new THREE.Color(id === 'silicon' ? 0x3a4260 : 0x9ec8e8);
app.scene.fog = null;

const rng = makeRng(seed)('lineup');
const inputsDev = developInputsFor(world);
const comp = world.life.composition;
const rows = Math.ceil(n / cols);
const buf = new Float32Array(n * ORGANISM_STRIDE);
const births: { id: number; plan: Float32Array }[] = [];
const summary: unknown[] = [];
for (let i = 0; i < n; i++) {
  // Mostly-uniform genes with a size bias toward small bodies so the lineup fits the frame.
  const body = {} as BodyGenes;
  for (const g of BODY_GENES) body[g] = rng();
  // size=wide spreads the size gene over the whole range (tiny swarmers to giants); the default keeps the lineup in frame.
  body.size = q.get('size') === 'wide' ? 0.9 * rng() ** 1.5 : 0.1 + 0.25 * rng();
  const genome: AnimalGenome = { body, climate: { prefTemp: 15, tolerance: 8, chem: 0.5 }, comp: { ...comp }, lineage: i };
  const plan = develop(genome, { light, heatBand: 0.5 }, inputsDev);
  births.push({ id: i + 1, plan: packBodyPlan(plan) });
  const col = i % cols, row = Math.floor(i / cols);
  const wx = (col - (cols - 1) / 2) * gap, wz = -row * gap;
  packOrganism(buf, i, {
    x: (wx / patch) + 0.5, y: (wz / patch) + 0.5, role: 1, size: plan.scale / 0.15, prefTemp: 15, tolerance: 8, chem: 0.5, energy: 0.5,
    id: i + 1, generation: 0, heading: 0, mode: plan.mode, body, comp: genome.comp, lineage: i,
  });
  summary.push({ i, mode: plan.mode, arch: plan.architecture, sym: plan.symmetry, tiers: plan.tiers, armKind: plan.armKind, limb: plan.limbKind, tail: plan.tailKind, horn: plan.hornKind, fin: +plan.finSpan.toFixed(2), wing: +plan.wingSpan.toFixed(2), girth: +plan.girth.toFixed(2), segs: plan.segmentCount });
}
const inputs = {
  ...makeStubVisualInputs(),
  organisms: buf, births, seaLevel: -1000, light,
  terrain: { rise: 1, progress: {}, height: () => 0 },
  stats: { seaCover: 0 },
};
app.setVisualInputsSource(() => inputs);
const fauna = createFauna(app);
app.registerFrameHook((dt, t) => fauna.update(dt, t, inputs, patch));

const midZ = -((rows - 1) * gap) / 2;
const span = Math.max(cols * gap, rows * gap);
const zoom = Number(q.get('zoom') ?? 0.62);
app.camera.position.set(0, span * 0.5 * zoom, midZ + span * 0.85 * zoom);
app.camera.lookAt(0, 1, midZ);
Object.assign(window, { lineup: { summary, app, fauna, patchToWorld } });
(window as unknown as { __ready: boolean }).__ready = true;
