import type { Preset } from './contracts';
import { World, parseFlags } from './core/world';
import { createDebug, createStats } from './core/debug';

const params = new URLSearchParams(location.search);
const flags = parseFlags();
const quality: 'low' | 'high' = params.get('q') === 'low' ? 'low' : 'high';
const presetId = (params.get('preset') ?? 'eco14') as Preset['id'];

const world = new World(flags, quality, document.getElementById('stage')!, document.getElementById('fade')!);
(window as any).__world = world;
await world.init(presetId);

const debug = flags.debug ? createDebug(world) : null;
const stats = flags.stats ? await createStats(world) : null;

let last = performance.now();
world.renderer.setAnimationLoop((now: number) => {
  const dt = (now - last) / 1000; last = now;
  world.frame(dt);
  debug?.tick(dt);
  stats?.update();
});
