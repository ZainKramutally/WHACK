// Click-to-inspect card: what it is, details, why, and "this world" beside the other world's targets.
// Holds a transparent window for the render layer's counterpart view and reports its rect on inspect:window.
import { el } from './dom';
import { formatValue, midpoint } from './format';
import { listen, type UiBus } from './uiBus';
import { ORGANISM_STRIDE, OrganismField as F } from '../sim/organismLayout';
import type { InspectTarget, SimSnapshot, WorldConfig } from '../worlds/types';

const CARD_W = 300;
const GAP = 16;

type Rows = [string, string][];

export function findOrganism(buf: Float32Array, id: number): Float32Array | null {
  for (let i = 0; i + ORGANISM_STRIDE <= buf.length; i += ORGANISM_STRIDE) {
    if (buf[i + F.id] === id) return buf.subarray(i, i + ORGANISM_STRIDE);
  }
  return null;
}

export function mountInspectCard(
  root: HTMLElement, bus: UiBus, world: WorldConfig, other: WorldConfig | undefined,
  formNames: Map<number, string>,
) {
  const card = el('aside', 'wu-card wu-inspect');
  card.hidden = true;
  const title = el('h2', 'wu-h');
  const closeBtn = el('button', 'wu-x', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  const kind = el('p', 'wu-sub');
  const status = el('p', 'wu-status');
  const details = el('ul', 'wu-details');
  const whyP = el('p', 'wu-why-line');
  const cmpTitle = el('h3', 'wu-h3');
  const table = el('table', 'wu-table wu-cmp');
  const win = el('div', 'wu-window');
  const winLabel = el('p', 'wu-window-label');
  card.append(title, closeBtn, kind, status, details, whyP, cmpTitle, table, win, winLabel);
  root.append(card);

  let target: InspectTarget | null = null;
  let anchor = { x: 0, y: 0 };
  let last: SimSnapshot | null = null;
  let lastRec: Float32Array | null = null; // last known organism record, kept after death
  let lastRect = '';

  const otherName = other ? `A ${other.id} world` : '';

  function describe(t: InspectTarget, s: SimSnapshot): { rows: Rows; dead: boolean; name: string } {
    const feat = world.features[t.kind];
    let name = feat.name;
    let dead = false;
    const rows: Rows = [];
    const st = s.stats;
    if (t.kind === 'organism') {
      let rec = findOrganism(s.organisms, t.organismId);
      if (rec) lastRec = Float32Array.from(rec);
      else { dead = true; rec = lastRec; }
      const formName = formNames.get(t.organismId);
      if (formName) name = formName;
      if (rec) {
        const producer = rec[F.role] === 0;
        rows.push(['Role', producer ? 'Plant (producer)' : 'Animal (consumer)']);
        rows.push(['Size', `${rec[F.size].toFixed(2)} × typical`]);
        rows.push(['Preferred temperature', `${formatValue(rec[F.prefTemp], '°C')} ± ${rec[F.tolerance].toFixed(1)} °C`]);
        rows.push([world.id === 'silicon' ? 'Cold stability' : 'Oxygen need', `${Math.round(rec[F.chem] * 100)}%`]);
        rows.push(['Generation', String(rec[F.generation])]);
        if (!dead) rows.push(['Energy', rec[F.energy] >= 1 ? 'Ready to copy itself' : `${Math.round(rec[F.energy] * 100)}% of the way to copying`]);
      }
    } else if (t.kind === 'producer') {
      const mat = s.flora[t.cell * 2] ?? 0;
      const canopy = s.flora[t.cell * 2 + 1] ?? 0;
      rows.push(['Ground cover', mat.toFixed(2)], ['Taller growth', canopy.toFixed(2)]);
      if (mat + canopy <= 0) dead = true;
    } else if (t.kind === 'sea') {
      const temp = st.temperature;
      if (temp !== undefined) {
        rows.push(['Solvent', world.solvent.name], ['Temperature', formatValue(temp, '°C')],
          ['State', temp < world.solvent.freezeC ? 'Frozen solid' : 'Liquid']);
      }
      if (st.seaCover !== undefined) rows.push(['Sea cover', formatValue(st.seaCover, '%')]);
    } else if (t.kind === 'sky') {
      rows.push(['Star', world.starType]);
      if (st.pressure !== undefined) rows.push(['Air pressure', formatValue(st.pressure, 'bar')]);
      const gas = world.facts.find((f) => f.id === 'mainGas');
      if (gas) rows.push(['Main gas', gas.value]);
    }
    return { rows, dead, name };
  }

  function compareRows(t: InspectTarget, s: SimSnapshot): string[][] {
    const feat = world.features[t.kind];
    const out: string[][] = [];
    for (const id of feat.statIds) {
      const def = world.stats.find((x) => x.id === id);
      if (!def) continue;
      const mine = s.stats[id];
      const range = other?.targets[id];
      out.push([
        def.label,
        mine !== undefined ? formatValue(mine, def.unit) : '–',
        range ? formatValue(midpoint(range), def.unit) : '–',
        formatValue(def.earthValue, def.unit),
      ]);
    }
    for (const id of feat.factIds) {
      const def = world.facts.find((x) => x.id === id);
      if (!def) continue;
      out.push([def.label, def.value, other?.facts.find((x) => x.id === id)?.value ?? '–', def.earthValue]);
    }
    return out;
  }

  function render() {
    if (!target || !last) return;
    const feat = world.features[target.kind];
    const { rows, dead, name } = describe(target, last);
    title.textContent = name;
    kind.textContent = feat.description;
    status.textContent = dead
      ? target.kind === 'organism' ? 'This one has died.' : 'Nothing is growing here now.'
      : '';
    status.hidden = !dead;
    details.replaceChildren(...rows.map(([k, v]) => {
      const li = el('li');
      li.append(el('span', 'wu-k', k), el('span', 'wu-v', v));
      return li;
    }));
    const flags = feat.assumption ? ' (assumption)' : '';
    whyP.textContent = `Why: ${feat.why}${flags}`;

    cmpTitle.textContent = 'Compared';
    const head = el('tr');
    for (const h of ['', 'This world', otherName ? `${otherName} (today)` : '', 'Earth']) head.append(el('th', undefined, h));
    const body = compareRows(target, last).map((r) => {
      const tr = el('tr');
      r.forEach((c, i) => tr.append(el('td', i === 0 ? 'wu-stat-name' : 'wu-num', c)));
      return tr;
    });
    const thead = el('thead');
    thead.append(head);
    table.replaceChildren(thead, ...body);

    win.hidden = !other;
    winLabel.hidden = !other;
    if (other) {
      winLabel.textContent = target.kind === 'organism'
        ? `If this were built from ${other.id} (illustration)`
        : `A patch of the ${other.id} world (illustration)`;
    }
    place();
    reportWindow();
  }

  function place() {
    const h = card.offsetHeight;
    let x = anchor.x + GAP;
    if (x + CARD_W > window.innerWidth - 8) x = Math.max(8, anchor.x - GAP - CARD_W);
    const y = Math.max(8, Math.min(anchor.y - 20, window.innerHeight - h - 8));
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  /** Cut the counterpart window out of the card's translucent background so the canvas shows through. */
  function punchWindow(r: DOMRect) {
    const c = card.getBoundingClientRect();
    const st = card.style as CSSStyleDeclaration & Record<string, string>;
    const g = 'linear-gradient(#000, #000)';
    const x = Math.round(r.left - c.left) + 1, y = Math.round(r.top - c.top) + 1;
    const size = `100% 100%, ${Math.max(0, Math.round(r.width) - 2)}px ${Math.max(0, Math.round(r.height) - 2)}px`;
    const pos = `0 0, ${x}px ${y}px`;
    for (const k of ['mask', 'webkitMask']) {
      st[`${k}Image`] = `${g}, ${g}`;
      st[`${k}Size`] = size;
      st[`${k}Position`] = pos;
      st[`${k}Repeat`] = 'no-repeat';
    }
    st.maskComposite = 'exclude';
    st.webkitMaskComposite = 'xor';
  }

  function reportWindow() {
    if (card.hidden || win.hidden) return;
    const r = win.getBoundingClientRect();
    punchWindow(r);
    const key = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    if (key === lastRect) return;
    lastRect = key;
    bus.emit('inspect:window', { x: r.left, y: r.top, width: r.width, height: r.height });
  }

  function open(t: InspectTarget, at: { x: number; y: number }) {
    target = t;
    anchor = at;
    lastRec = null;
    lastRect = '';
    card.hidden = false;
    render();
  }

  /** Hide the card. `notify` also tells the render layer (skip when the render layer closed it). */
  function close(notify = true) {
    if (card.hidden) return;
    card.hidden = true;
    card.style.maskImage = '';
    card.style.removeProperty('-webkit-mask-image');
    target = null;
    lastRect = '';
    bus.emit('inspect:window', null);
    if (notify) bus.emit('inspect:close', {});
  }

  closeBtn.addEventListener('click', () => close());
  // Click elsewhere closes. The render layer's own click (which opens a new card) comes after pointerdown.
  const onDown = (e: PointerEvent) => {
    if (!card.hidden && !card.contains(e.target as Node)) close();
  };
  document.addEventListener('pointerdown', onDown, true);
  const onResize = () => { if (!card.hidden) { place(); lastRect = ''; reportWindow(); } };
  window.addEventListener('resize', onResize);

  const offs = [
    listen(bus, 'inspect:open', ({ target: t, at }) => open(t, at)),
    listen(bus, 'inspect:close', () => close(false)),
  ];

  return {
    el: card,
    isOpen: () => !card.hidden,
    close: () => close(),
    update(s: SimSnapshot) {
      last = s;
      if (!card.hidden) render();
    },
    dispose() {
      offs.forEach((f) => f());
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
      card.remove();
    },
  };
}
