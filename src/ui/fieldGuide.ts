// Field guide tab: every form found so far, newest first, with its functional type, when it was first seen and
// how many are alive now. Counts refresh with the registry (about once a second).
import { el } from './dom';
import type { LifeRegistry } from './lifeRegistry';

export function mountFieldGuide(registry: LifeRegistry, onCount: (n: number) => void) {
  const drawer = el('aside', 'wu-drawer wu-guide');
  drawer.setAttribute('aria-label', 'Field guide');
  drawer.append(el('h2', 'wu-h', 'Field guide'));
  const empty = el('p', 'wu-note', 'No new forms yet. When a body plan becomes common, it is added here.');
  const list = el('ol', 'wu-forms');
  drawer.append(empty, list);
  let shown = 0;

  function render() {
    const rows = registry.forms();
    empty.hidden = rows.length > 0;
    list.replaceChildren(...rows.map((r) => {
      const li = el('li');
      const head = el('div', 'wu-form-head');
      head.append(el('strong', undefined, r.name));
      if (r.type) head.append(el('span', 'wu-form-type', r.type));
      const meta = el('div', 'wu-dim');
      meta.textContent = `First seen ${Math.round(r.firstSeenSec)} s after Generate · ${r.alive > 0 ? `${r.alive} alive now` : 'none alive now'}`;
      li.append(head, meta);
      return li;
    }));
    if (rows.length !== shown) { shown = rows.length; onCount(shown); }
  }
  render();
  const off = registry.onChange(render);

  return { el: drawer, dispose() { off(); drawer.remove(); } };
}
