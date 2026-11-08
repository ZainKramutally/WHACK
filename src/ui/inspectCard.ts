// Click-to-inspect card: what it is, details, why, and "this world" beside the other world's targets.
// Holds a transparent window for the render layer's counterpart view and reports its rect on inspect:window.
import { el } from './dom';
import { formatStat, formatValue } from './format';
import { statsAtStart } from './otherWorld';
import { listen, type UiBus } from './uiBus';
import { ORGANISM_STRIDE, OrganismField as F, readOrganism, type OrganismRecord } from '../sim/organismLayout';
import type { BodyPlan } from '../sim/develop';
import { floraBin, formForBin } from '../render/floraForm';
import { heatBand } from '../render/visualInputs';
import { organismRows, producerRows, speciesName } from './lifeText';
import type { LifeRegistry } from './lifeRegistry';
import type { InspectTarget, SimSnapshot, WorldConfig } from '../worlds/types';

const CARD_W = 340; // matches .wu-inspect width in ui.css: four comparison columns of unbroken numbers fit
const GAP = 16;
const TOP = 52; // clear of the Conditions / Bestiary tabs (ui.css .wu-inspect max-height matches)

type Rows = [string, string][];

export function findOrganism(buf: Float32Array, id: number): Float32Array | null {
  const i = indexOfOrganism(buf, id);
  return i < 0 ? null : buf.subarray(i * ORGANISM_STRIDE, (i + 1) * ORGANISM_STRIDE);
}

/** Record number of organism `id` in the buffer, or -1 if it is gone. */
export function indexOfOrganism(buf: Float32Array, id: number): number {
  for (let i = 0; i + ORGANISM_STRIDE <= buf.length; i += ORGANISM_STRIDE) {
    if (buf[i + F.id] === id) return i / ORGANISM_STRIDE;
  }
  return -1;
}

export function mountInspectCard(
  root: HTMLElement, bus: UiBus, world: WorldConfig, other: WorldConfig | undefined,
  registry: LifeRegistry, floraSubmerged?: (cell: number) => boolean,
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
  const toggle = el('div', 'wu-toggle');
  const selfBtn = el('button', 'wu-toggle-btn', 'This creature');
  const otherBtn = el('button', 'wu-toggle-btn', 'If built from …');
  selfBtn.type = 'button'; otherBtn.type = 'button';
  toggle.append(selfBtn, otherBtn);
  const winLabel = el('p', 'wu-window-label');
  // The counterpart window sits near the top so it is visible without scrolling on a short screen.
  card.append(title, closeBtn, kind, status, win, toggle, winLabel, details, whyP, cmpTitle, table);
  let viewMode: 'self' | 'other' = 'self';
  root.append(card);

  let target: InspectTarget | null = null;
  let anchor = { x: 0, y: 0 };
  let last: SimSnapshot | null = null;
  let lastRec: OrganismRecord | null = null; // last known organism record, kept after death
  let lastPlan: BodyPlan | undefined;
  let lastForm: { name: string; recognised: boolean } | undefined;
  let lastRect = '';

  const otherName = other ? `A ${other.id} world` : '';
  const otherStart = other ? statsAtStart(other) : undefined;

  function describe(t: InspectTarget, s: SimSnapshot): { rows: Rows; dead: boolean; name: string } {
    const feat = world.features[t.kind];
    let name = feat.name;
    let dead = false;
    const rows: Rows = [];
    const st = s.stats;
    if (t.kind === 'organism') {
      const idx = indexOfOrganism(s.organisms, t.organismId);
      if (idx >= 0) {
        lastRec = readOrganism(s.organisms, idx);
        lastPlan = registry.planOf(t.organismId) ?? lastPlan;
        lastForm = registry.formOf(t.organismId) ?? lastForm;
      } else dead = true;
      if (lastForm?.recognised) name = lastForm.name;
      if (lastRec) {
        rows.push(...organismRows(lastRec, lastPlan, { chemistry: world.id === 'silicon' ? 'silicon' : 'carbon', form: lastForm, alive: !dead }));
      }
    } else if (t.kind === 'producer') {
      const mat = s.flora[t.cell * 2] ?? 0;
      const canopy = s.flora[t.cell * 2 + 1] ?? 0;
      dead = mat + canopy <= 0;
      const form = dead ? null : formForBin(floraBin(mat, canopy, {
        world: { composition: world.life.composition, solvent: world.solvent },
        light: s.stats.light ?? 1,
        heatBand: heatBand(s),
      } as Parameters<typeof floraBin>[2], floraSubmerged?.(t.cell) ?? false));
      if (form) name = speciesName(form.species);
      rows.push(...producerRows(mat, canopy, form));
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
      // The other world at its own starting conditions, from its derived models (not its end-of-build target midpoints).
      const otherToday = otherStart && other?.stats.some((x) => x.id === id) ? otherStart[id] : undefined;
      out.push([
        def.label,
        mine !== undefined ? formatStat(id, mine, def.unit) : '–',
        otherToday !== undefined ? formatStat(id, otherToday, def.unit) : '–',
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
    for (const h of ['', 'This world', otherName ? `${otherName} (at start)` : '', 'Earth']) head.append(el('th', undefined, h));
    const body = compareRows(target, last).map((r) => {
      const tr = el('tr');
      // Numbers stay on one line ("14.6 °C"); text facts (body chemistry) wrap.
      r.forEach((c, i) => tr.append(el('td', i === 0 ? 'wu-stat-name' : c.length > 12 ? 'wu-num wu-wrap' : 'wu-num', c)));
      return tr;
    });
    const thead = el('thead');
    thead.append(head);
    table.replaceChildren(thead, ...body);

    // Creatures only ever show themselves (carbon and silicon bodies must not mirror each other): no toggle for them.
    const isOrg = target.kind === 'organism';
    win.hidden = false;
    winLabel.hidden = false;
    toggle.hidden = !other || isOrg;
    if (isOrg) viewMode = 'self';
    if (other && !isOrg) {
      selfBtn.textContent = 'This world';
      otherBtn.textContent = `A ${other.id} world`;
      selfBtn.classList.toggle('wu-on', viewMode === 'self');
      otherBtn.classList.toggle('wu-on', viewMode === 'other');
    }
    winLabel.textContent = isOrg
      ? 'This creature (live)'
      : viewMode === 'self' ? 'A patch of this world (illustration)' : `A patch of the ${other?.id ?? ''} world (illustration)`;
    place();
    reportWindow();
  }

  function place() {
    const h = card.offsetHeight;
    let x = anchor.x + GAP;
    if (x + CARD_W > window.innerWidth - 8) x = Math.max(8, anchor.x - GAP - CARD_W);
    const y = Math.max(TOP, Math.min(anchor.y - 20, window.innerHeight - h - 8)); // below the tab row
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
    // Only the part of the window inside the card's visible (scrolled) area is shown; none visible means no render.
    const w = win.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const left = Math.max(w.left, c.left), top = Math.max(w.top, c.top);
    const right = Math.min(w.right, c.right), bottom = Math.min(w.bottom, c.bottom);
    const visible = right - left >= 4 && bottom - top >= 4;
    const key = (visible ? [left, top, right - left, bottom - top].map(Math.round).join(',') : 'hidden') + viewMode;
    if (visible) punchWindow(new DOMRect(left, top, right - left, bottom - top));
    else { card.style.maskImage = ''; card.style.removeProperty('-webkit-mask-image'); }
    if (key === lastRect) return;
    lastRect = key;
    bus.emit('inspect:window', visible ? { x: left, y: top, width: right - left, height: bottom - top, mode: viewMode } : null);
  }

  function open(t: InspectTarget, at: { x: number; y: number }) {
    target = t;
    viewMode = 'self';
    anchor = at;
    lastRec = null;
    lastPlan = undefined;
    lastForm = undefined;
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

  const setMode = (m: 'self' | 'other') => {
    if (viewMode === m) return;
    viewMode = m;
    selfBtn.classList.toggle('wu-on', m === 'self');
    otherBtn.classList.toggle('wu-on', m === 'other');
    if (target && other && target.kind !== 'organism') {
      winLabel.textContent = m === 'self' ? 'A patch of this world (illustration)' : `A patch of the ${other.id} world (illustration)`;
    }
    lastRect = '';
    reportWindow();
  };
  selfBtn.addEventListener('click', () => setMode('self'));
  otherBtn.addEventListener('click', () => setMode('other'));
  closeBtn.addEventListener('click', () => close());
  // Scrolling the card moves the counterpart window with it.
  card.addEventListener('scroll', () => reportWindow());
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
