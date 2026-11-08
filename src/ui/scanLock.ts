// Scanner hover lock: pixel corner brackets that snap in around the living thing under the pointer or reticle, with a
// short label. Driven by `inspect:hover` (render → UI); the same payload object is re-emitted each frame with its rect
// updated in place, so a moving target is followed without allocating. DOM only: the art direction bans 3D outlines.
import { el } from './dom';
import { listen, type UiBus } from './uiBus';
import type { WorldConfig } from '../worlds/types';
import type { LifeRegistry } from './lifeRegistry';
import { scanState, type ScanState } from './scanLabel';

export function mountScanLock(root: HTMLElement, bus: UiBus, world: WorldConfig, registry: LifeRegistry) {
  const lock = el('div', 'wu-scan');
  lock.hidden = true;
  for (const c of ['tl', 'tr', 'bl', 'br']) lock.append(el('i', `wu-scan-c wu-scan-${c}`));
  const label = el('span', 'wu-scan-label');
  lock.append(label);
  root.append(lock);

  let lockedKey = '';
  let current: Parameters<Parameters<typeof listen<'inspect:hover'>>[2]>[0] = null;

  let shownState: ScanState | '' = '';
  const nameFor = (t: NonNullable<typeof current>['target']): { state: ScanState; label: string } =>
    t.kind === 'organism' ? scanState(registry.formOf(t.organismId)) : { state: 'plant', label: world.features.producer.name };
  /** Apply state + label. Returns true if the state changed (the snap/ping animation restarts then). */
  const apply = (t: NonNullable<typeof current>['target']): boolean => {
    const { state, label: text } = nameFor(t);
    if (label.textContent !== text) label.textContent = text;
    if (state === shownState) return false;
    shownState = state;
    lock.dataset.state = state;
    return true;
  };

  const off = listen(bus, 'inspect:hover', (h) => {
    current = h;
    if (!h) { lock.hidden = true; lockedKey = ''; shownState = ''; return; }
    const t = h.target;
    const key = t.kind === 'organism' ? `o${t.organismId}` : `p${t.cell}`;
    if (key !== lockedKey) {
      lockedKey = key;
      apply(t);
      lock.classList.remove('wu-scan-snap');
      void lock.offsetWidth; // restart the snap-in animation
      lock.classList.add('wu-scan-snap');
    }
    const r = h.rect;
    lock.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    lock.style.width = `${Math.round(r.width)}px`;
    lock.style.height = `${Math.round(r.height)}px`;
    lock.hidden = false;
  });
  // The label follows the bestiary live: clicking and filing a kind turns NEW SPECIES into its name.
  const refresh = () => {
    if (!current) return;
    if (apply(current.target)) { lock.classList.remove('wu-scan-snap'); void lock.offsetWidth; lock.classList.add('wu-scan-snap'); }
  };
  const offChange = registry.onChange(refresh);
  const offFind = registry.onDiscover(refresh);

  return {
    dispose() { off(); offChange(); offFind(); lock.remove(); },
  };
}
