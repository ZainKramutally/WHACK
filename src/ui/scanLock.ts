// Scanner hover lock: pixel corner brackets that snap in around the living thing under the pointer or reticle, with a
// short label. Driven by `inspect:hover` (render → UI); the same payload object is re-emitted each frame with its rect
// updated in place, so a moving target is followed without allocating. DOM only: the art direction bans 3D outlines.
import { el } from './dom';
import { listen, type UiBus } from './uiBus';
import type { WorldConfig } from '../worlds/types';
import type { LifeRegistry } from './lifeRegistry';

export function mountScanLock(root: HTMLElement, bus: UiBus, world: WorldConfig, registry: LifeRegistry) {
  const lock = el('div', 'wu-scan');
  lock.hidden = true;
  for (const c of ['tl', 'tr', 'bl', 'br']) lock.append(el('i', `wu-scan-c wu-scan-${c}`));
  const label = el('span', 'wu-scan-label');
  lock.append(label);
  root.append(lock);

  let locked: object | null = null; // identity of the locked target, to restart the snap animation on a new one
  let lockedKey = '';

  const off = listen(bus, 'inspect:hover', (h) => {
    if (!h) { lock.hidden = true; locked = null; lockedKey = ''; return; }
    const t = h.target;
    const key = t.kind === 'organism' ? `o${t.organismId}` : `p${t.cell}`;
    if (key !== lockedKey) {
      lockedKey = key;
      let name = t.kind === 'organism' ? world.features.organism.name : world.features.producer.name;
      if (t.kind === 'organism') {
        const f = registry.formOf(t.organismId);
        if (f?.recognised && f.name) name = f.name;
      }
      label.textContent = name;
      lock.classList.remove('wu-scan-snap');
      void lock.offsetWidth; // restart the snap-in animation
      lock.classList.add('wu-scan-snap');
    }
    locked = h;
    const r = h.rect;
    lock.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    lock.style.width = `${Math.round(r.width)}px`;
    lock.style.height = `${Math.round(r.height)}px`;
    lock.hidden = false;
  });

  return {
    dispose() { off(); lock.remove(); void locked; },
  };
}
