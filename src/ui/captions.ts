// One-line bottom-centre captions, queued so a burst is read in order (each ~2.5 s), fading ~4 s after the last.
import { el } from './dom';
import { listen, type UiBus } from './uiBus';
import { formatValue } from './format';
import { controlList } from '../worlds/controls';
import type { ControlDef, SimSnapshot, WorldConfig } from '../worlds/types';

const SHOW_MS = 4000;      // a lone caption stays this long, then fades
const MIN_MS = 2500;       // when others are waiting, each caption shows at least this long
const MAX_QUEUE = 4;

export function mountCaptions(root: HTMLElement, bus: UiBus, world: WorldConfig, controls: ControlDef[] = controlList) {
  const box = el('div', 'wu-caption');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  root.append(box);

  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let pumpTimer: ReturnType<typeof setTimeout> | undefined;
  let startShown = false;
  const queue: string[] = [];
  let current = '';
  let busy = false;

  function pump() {
    if (busy) return;
    const text = queue.shift();
    if (text === undefined) return;
    busy = true;
    current = text;
    box.textContent = text;
    box.classList.add('wu-on');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => box.classList.remove('wu-on'), SHOW_MS);
    pumpTimer = setTimeout(() => { busy = false; pump(); }, MIN_MS);
  }
  /** Queue a caption. `low` ones (e.g. new forms) are dropped if anything is already waiting or showing. */
  function show(text: string, low = false) {
    if (low && (queue.length > 0 || busy)) return;
    if (queue[queue.length - 1] === text || (busy && current === text && queue.length === 0)) return;
    queue.push(text);
    if (queue.length > MAX_QUEUE) queue.shift();
    pump();
  }
  function showStart() {
    if (startShown) return;
    startShown = true;
    show(world.build.captions.start);
  }

  const limitReason = (id: string) => {
    const l = world.limits.find((x) => x.id === id);
    if (!l) return null;
    return world.status === 'speculative' && !/speculative/i.test(l.reason) ? `${l.reason} (speculative)` : l.reason;
  };

  const offs = [
    listen(bus, 'world:selected', showStart),
    // Mounted after Generate? The first build snapshot is the fallback trigger.
    listen(bus, 'sim:snapshot', (s: SimSnapshot) => { if (s.buildProgress < 1) showStart(); }),
    listen(bus, 'build:life', () => show(world.build.captions.life)),
    listen(bus, 'control:blocked', ({ controlId, limitId, start: isStart }) => {
      const r = limitReason(limitId);
      if (!r) return;
      const def = controls.find((c) => c.id === controlId);
      const start = world.startDefaults[controlId];
      if (isStart && def && start !== undefined) {
        show(`${r}, so ${def.label.toLowerCase()} starts at ${formatValue(start, def.unit)}`);
      } else show(r);
    }),
    listen(bus, 'guide:newForm', ({ name }) => show(`New form: ${name}`, true)),
  ];

  return {
    show,
    dispose() { clearTimeout(fadeTimer); clearTimeout(pumpTimer); offs.forEach((f) => f()); box.remove(); },
  };
}
