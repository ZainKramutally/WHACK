// Summary card: the world's stats now, beside Earth's, plus the dominant life form's traits. Opened on demand only.
import { el } from './dom';
import { formatStat, formatValue } from './format';
import { dominantRows } from './lifeText';
import type { LifeRegistry } from './lifeRegistry';
import type { SimSnapshot, WorldConfig } from '../worlds/types';

function paceCell(d: { id: string; label: string }): HTMLElement {
  const td = el('td', 'wu-stat-name', d.label);
  if (d.id === 'pace') td.append(el('em', 'wu-tag', 'compressed in the time-lapse'));
  return td;
}

export function mountSummaryCard(root: HTMLElement, world: WorldConfig, registry: LifeRegistry) {
  const card = el('aside', 'wu-card wu-summary');
  card.hidden = true;
  const x = el('button', 'wu-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  card.append(el('h2', 'wu-h', `${world.displayName}: summary`), x);
  const table = el('table', 'wu-table');
  const traits = el('ul', 'wu-details');
  card.append(table, el('h3', 'wu-h3', 'Dominant life form'), traits);
  if (world.status === 'speculative') card.append(el('em', 'wu-tag wu-spec', 'speculative'));
  root.append(card);

  let last: SimSnapshot | null = null;

  function render() {
    if (!last || card.hidden) return;
    const s = last;
    const head = el('tr');
    for (const h of ['', 'Now', 'Earth']) head.append(el('th', undefined, h));
    const thead = el('thead');
    thead.append(head);
    const rows = world.stats.map((d) => {
      const tr = el('tr');
      tr.append(
        paceCell(d),
        el('td', 'wu-num', s.stats[d.id] !== undefined ? formatStat(d.id, s.stats[d.id], d.unit) : '–'),
        el('td', 'wu-num wu-dim', formatValue(d.earthValue, d.unit)),
      );
      return tr;
    });
    for (const f of world.facts) {
      const tr = el('tr');
      tr.append(el('td', 'wu-stat-name', f.label), el('td', 'wu-num wu-wrap', f.value), el('td', 'wu-num wu-dim wu-wrap', f.earthValue));
      rows.push(tr);
    }
    table.replaceChildren(thead, ...rows);

    const t = s.traitAverages;
    const oxy = world.id === 'silicon' ? 'Cold stability' : 'Oxygen need';
    const dom = registry.dominant();
    const items: [string, string | undefined][] = [
      ...(dom ? dominantRows({ name: dom.info.name, alive: dom.info.alive, type: dom.info.type }, dom.plan) : []),
      ['Animals', String(s.population.consumers)],
      ['Plants', String(s.population.producers)],
      ['Generations', String(Math.round(s.generation))],
      ['Animal size', t.consumerSize !== undefined ? `${t.consumerSize.toFixed(2)} × typical` : undefined],
      ['Preferred temperature', t.prefTemp !== undefined ? formatValue(t.prefTemp, '°C') : undefined],
      ['Temperature tolerance', t.tolerance !== undefined ? `± ${t.tolerance.toFixed(1)} °C` : undefined],
      [oxy, t.consumerChem !== undefined ? `${Math.round(t.consumerChem * 100)}%` : undefined],
    ];
    traits.replaceChildren(...items.filter(([, v]) => v !== undefined).map(([k, v]) => {
      const li = el('li');
      li.append(el('span', 'wu-k', k), el('span', 'wu-v', v));
      return li;
    }));
  }

  x.addEventListener('click', () => api.close());
  const api = {
    el: card,
    isOpen: () => !card.hidden,
    open() { card.hidden = false; render(); },
    close() { card.hidden = true; },
    toggle() { if (card.hidden) api.open(); else api.close(); },
    update(s: SimSnapshot) { last = s; render(); },
    dispose() { card.remove(); },
  };
  return api;
}
