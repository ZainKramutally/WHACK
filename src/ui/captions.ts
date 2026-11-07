// One-line bottom-centre captions that fade after ~4 s. A new caption replaces the current one.
import { el } from './dom';
import { listen, type UiBus } from './uiBus';
import type { SimSnapshot, WorldConfig } from '../worlds/types';

const SHOW_MS = 4000;

export function mountCaptions(root: HTMLElement, bus: UiBus, world: WorldConfig) {
  const box = el('div', 'wu-caption');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  root.append(box);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let startShown = false;

  function show(text: string) {
    box.textContent = text;
    box.classList.add('wu-on');
    clearTimeout(timer);
    timer = setTimeout(() => box.classList.remove('wu-on'), SHOW_MS);
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
    listen(bus, 'control:blocked', ({ limitId }) => {
      const r = limitReason(limitId);
      if (r) show(r);
    }),
    listen(bus, 'guide:newForm', ({ name }) => show(`New form: ${name}`)),
  ];

  return {
    show,
    dispose() { clearTimeout(timer); offs.forEach((f) => f()); box.remove(); },
  };
}
