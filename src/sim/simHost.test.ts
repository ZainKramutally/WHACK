import { describe, expect, it } from 'vitest';
import { createBus } from '../bus';
import type { SimSnapshot } from '../worlds/types';
import { startSimClient } from './client';
import { SimHost } from './simHost';
import { parseToWorker, snapshotTransferables, type FromWorker, type ToWorker } from './workerProtocol';

const EARTH = { temperature: 15, nitrogen: 1, oxygen: 21 };

/** A host on a fake clock. `step(ms)` advances the clock and pumps once. */
function fakeHost(opts: { tickMs?: number; budgetMs?: number } = {}) {
  let t = 1000;
  const out: { msg: FromWorker; transfer: Transferable[] }[] = [];
  const host = new SimHost({
    post: (msg, transfer) => out.push({ msg, transfer }),
    now: () => (t += opts.tickMs ?? 0),
    budgetMs: opts.budgetMs,
  });
  return {
    host, out,
    step(ms: number) { t += ms; host.pump(); },
    snapshots: () => out.flatMap((o) => (o.msg.type === 'snapshot' ? [o.msg.snapshot] : [])),
  };
}

describe('parseToWorker', () => {
  it('accepts the four message types', () => {
    const ok: ToWorker[] = [
      { type: 'init' },
      { type: 'selectWorld', worldId: 'silicon', requested: EARTH },
      { type: 'controlSet', controlId: 'oxygen', value: 3 },
      { type: 'dispose' },
    ];
    for (const m of ok) expect(parseToWorker(m)).toEqual({ ok: true, msg: expect.objectContaining({ type: m.type }) });
  });
  it('rejects malformed messages with an error string', () => {
    const bad: unknown[] = [
      null, 5, {}, { type: 'nope' },
      { type: 'selectWorld', worldId: 'gold', requested: EARTH },
      { type: 'selectWorld', worldId: 'carbon', requested: { temperature: 1 } },
      { type: 'controlSet', controlId: 'gravity', value: 1 },
      { type: 'controlSet', controlId: 'oxygen', value: Infinity },
    ];
    for (const m of bad) expect(parseToWorker(m).ok).toBe(false);
  });
});

describe('SimHost', () => {
  it('answers init, and turns bad messages into errors without touching state', () => {
    const f = fakeHost();
    f.host.handle({ type: 'init' });
    f.host.handle({ type: 'controlSet', controlId: 'oxygen', value: 3 }); // before selectWorld
    f.host.handle('garbage');
    f.host.handle({ type: 'selectWorld', worldId: 'carbon', requested: EARTH });
    f.host.handle({ type: 'controlSet', controlId: 'gravity', value: 3 });
    const types = f.out.map((o) => o.msg.type);
    expect(types[0]).toBe('ready');
    expect(types.filter((t) => t === 'error')).toHaveLength(3);
    expect(f.snapshots()).toHaveLength(1); // the selectWorld snapshot
    expect(f.snapshots()[0].controls.oxygen).toBeCloseTo(21, 9);
  });

  it('reports sliders that startingConditions moved, as control:blocked events before the first snapshot', () => {
    const f = fakeHost();
    f.host.handle({ type: 'selectWorld', worldId: 'silicon', requested: EARTH });
    const kinds = f.out.map((o) => (o.msg.type === 'event' ? o.msg.event.name : o.msg.type));
    expect(kinds).toEqual(['control:blocked', 'control:blocked', 'control:blocked', 'snapshot']);
  });

  it('posts snapshots at 20 Hz and transfers the organism and flora buffers', () => {
    const f = fakeHost();
    f.host.handle({ type: 'selectWorld', worldId: 'carbon', requested: EARTH });
    f.out.length = 0;
    for (let i = 0; i < 200; i++) f.step(10); // two seconds
    const n = f.snapshots().length;
    expect(n).toBeGreaterThanOrEqual(39);
    expect(n).toBeLessThanOrEqual(41);
    const last = f.out.filter((o) => o.msg.type === 'snapshot').at(-1)!;
    expect(last.transfer).toContain((last.msg as { snapshot: SimSnapshot }).snapshot.organisms.buffer);
    expect(last.transfer).toContain((last.msg as { snapshot: SimSnapshot }).snapshot.flora.buffer);
    expect(snapshotTransferables((last.msg as { snapshot: SimSnapshot }).snapshot).length).toBeGreaterThanOrEqual(2);
  });

  it('reaches the same state at 60 fps, at 17 fps, and after a suspended tab', () => {
    const end = (frames: number[]) => {
      const f = fakeHost();
      f.host.handle({ type: 'selectWorld', worldId: 'carbon', requested: EARTH });
      for (const ms of frames) f.step(ms);
      f.step(0); // force a final snapshot
      const s = f.snapshots().at(-1)!;
      return { stats: s.stats, pop: s.population, org: Array.from(s.organisms) };
    };
    const total = 12000;
    const fps60 = Array.from({ length: Math.round(total / (1000 / 60)) }, () => 1000 / 60);
    const fps17 = Array.from({ length: Math.round(total / (1000 / 17)) }, () => 1000 / 17);
    const a = end(fps60);
    expect(end(fps17)).toEqual(a);
    expect(end([total])).toEqual(a); // one callback after a 22 s stall
  });

  it('applies controlSet through the living band and reports the block', () => {
    const f = fakeHost();
    f.host.handle({ type: 'selectWorld', worldId: 'carbon', requested: EARTH });
    f.out.length = 0;
    f.host.handle({ type: 'controlSet', controlId: 'temperature', value: 900 });
    expect(f.out.map((o) => o.msg)).toEqual([
      { type: 'event', event: { name: 'control:blocked', payload: { controlId: 'temperature', limitId: 'tooHot' } } },
    ]);
    f.step(100);
    f.step(100);
    expect(f.snapshots().at(-1)!.controls.temperature).toBeCloseTo(122, 2);
  });

  it('stops ticking after dispose', () => {
    const f = fakeHost();
    f.host.handle({ type: 'selectWorld', worldId: 'carbon', requested: EARTH });
    f.host.handle({ type: 'dispose' });
    f.out.length = 0;
    f.step(5000);
    expect(f.out).toEqual([]);
  });
});

describe('startSimClient', () => {
  it('bridges the worker to the bus both ways', () => {
    const bus = createBus();
    const sent: ToWorker[] = [];
    const worker = { onmessage: null as unknown, onerror: null as unknown, terminate: () => { sent.push({ type: 'dispose' }); }, postMessage: (m: ToWorker) => { sent.push(m); } };
    const stop = startSimClient(bus, {
      createWorker: () => worker as never,
      seaLevel: (p, stats) => 100 * p + stats.seaCover,
    });
    bus.emit('world:selected', { worldId: 'carbon', requested: EARTH });
    bus.emit('control:set', { controlId: 'oxygen', value: 5 });
    expect(sent).toEqual([
      { type: 'init' },
      { type: 'selectWorld', worldId: 'carbon', requested: EARTH },
      { type: 'controlSet', controlId: 'oxygen', value: 5 },
    ]);

    const got: string[] = [];
    let level = NaN;
    bus.on('sim:snapshot', (s) => { got.push('snapshot'); level = s.stats.seaLevel; });
    bus.on('build:complete', (p) => got.push(`complete:${p.worldId}`));
    bus.on('control:blocked', (p) => got.push(`blocked:${p.limitId}`));
    const onmessage = worker.onmessage as (e: { data: FromWorker }) => void;
    onmessage({ data: { type: 'event', event: { name: 'build:complete', payload: { worldId: 'carbon' } } } });
    onmessage({ data: { type: 'event', event: { name: 'control:blocked', payload: { controlId: 'oxygen', limitId: 'x' } } } });
    onmessage({ data: { type: 'snapshot', snapshot: { buildProgress: 0.5, stats: { seaCover: 7 } } as unknown as SimSnapshot } });
    expect(got).toEqual(['complete:carbon', 'blocked:x', 'snapshot']);
    expect(level).toBe(57);

    stop();
    bus.emit('control:set', { controlId: 'oxygen', value: 6 });
    expect(sent.at(-1)).toEqual({ type: 'dispose' });
    expect(sent.filter((m) => m.type === 'controlSet')).toHaveLength(1);
  });
});
