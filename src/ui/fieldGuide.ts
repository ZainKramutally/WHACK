// Field guide tab: forms found so far (guide:newForm), newest first.
import { el } from './dom';
import { listen, type UiBus } from './uiBus';

export function mountFieldGuide(bus: UiBus, formNames: Map<number, string>, onCount: (n: number) => void) {
  const drawer = el('aside', 'wu-drawer wu-guide');
  drawer.setAttribute('aria-label', 'Field guide');
  drawer.append(el('h2', 'wu-h', 'Field guide'));
  const empty = el('p', 'wu-note', 'No new forms yet. When a body plan becomes common, it is added here.');
  const list = el('ol', 'wu-forms');
  drawer.append(empty, list);
  const seen = new Set<number>();

  const off = listen(bus, 'guide:newForm', ({ binId, name, organismId }) => {
    if (seen.has(binId)) return;
    seen.add(binId);
    formNames.set(organismId, name);
    const li = el('li');
    li.append(el('strong', undefined, name), el('span', 'wu-dim', ` · form ${seen.size}`));
    list.prepend(li);
    empty.hidden = true;
    onCount(seen.size);
  });

  return { el: drawer, dispose() { off(); drawer.remove(); } };
}
