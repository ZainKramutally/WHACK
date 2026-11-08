// The selection screen (CLAUDE.md "The experience"; docs/features/selection-screen.md): "Life is ▢ based" as a pixel-art
// research paper, ported from mockups/selection-screen. Slider maths is ui/sliderMath, viability and bands are
// sim/limits, and every world fact (status, caveat, reasoning, bounds, Earth values, sources) is read from the world configs.
// Emits `selection:changed` on every change; hands Generate to the host, which emits `world:selected` once the world is built.
import { cinematicOn, setCinematic } from '../../cinematicSetting';
import './selection.css';
import { withCrustChoice } from '../../gen/crust';
import { controlList, sourceFor, worldFor, worlds } from '../../worlds';
import { CRUST_PICKS } from '../../worlds/controls';
import type { Conditions, ControlDef, ControlId, CrustPickId, LethalLimit, WorldConfig } from '../../worlds/types';
import { fracToValue, redSegments, valueToFrac } from '../sliderMath';
import type { UiBus } from '../uiBus';
import { createBox, N_ATOMS } from './box';
import { group14 } from './elements';
import { elementIcon } from './icons';
import {
  bandsFor, effectiveCrust, generatePayload, initialSelection, plannedMoves, redReason, selectElement, setCondition, toggleCrust, viability,
  type SelectionState, type Viability,
} from './state';

/** What the Generate transition (render/generate.ts) needs from the screen: the sheet, the live box and a way to remove it. */
export interface LaunchHandle {
  root: HTMLElement;
  boxCanvas: HTMLCanvasElement;
  boxRect(): DOMRect;
  /** The box's dots as 0..1 fractions of the box (y down): the element's atoms first. */
  seeds(): { x: number; y: number }[];
  /** How many of the seeds are element atoms (the rest are solvent). */
  atomCount: number;
  /** Time dilation for the live box (1 = normal, 0 = frozen). */
  setBoxSpeed(k: number): void;
  dispose(): void;
}

export interface SelectionOptions {
  /**
   * Generate was clicked (after any slider glide). The host builds the world, emits `world:selected` with this payload and drives
   * the transition through `handle`, which also removes the screen when it is done.
   */
  onGenerate(payload: { worldId: WorldConfig['id']; requested: Conditions; crust?: CrustPickId; egg?: 'lead' }, handle: LaunchHandle): void;
}

export interface SelectionScreen {
  /** Same object that onGenerate receives: usable while the screen is up, to prepare the transition. */
  handle: LaunchHandle;
  dispose(): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const minus = (s: string) => s.replace('-', '−');
const SYM: Record<ControlId, string> = { temperature: 'T', nitrogen: 'N', oxygen: 'x<sub>O₂</sub>' };
const worldIds = Object.keys(worlds) as WorldConfig['id'][];
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fmt(id: ControlId, v: number): string {
  if (id === 'temperature') return `${minus(String(Math.round(v)))} °C`;
  if (id === 'nitrogen') {
    const s = v >= 10 ? Math.round(v).toLocaleString('en-GB') : v >= 1 ? v.toFixed(1).replace(/\.0$/, '') : v.toPrecision(2).replace(/0+$/, '');
    return `${s} × Earth`;
  }
  return `${v > 0 && v < 1 ? v.toFixed(1) : Math.round(v)} %`;
}

function ticksFor(def: ControlDef): number[] {
  const out: number[] = [];
  if (def.scale === 'log') {
    for (let v = def.min; v < def.max; v *= 100) out.push(v);
  } else {
    const step = def.max - def.min > 100 ? 100 : 20;
    for (let v = def.min; v < def.max; v += step) out.push(v);
  }
  out.push(def.max);
  return out;
}
const tickLabel = (def: ControlDef, v: number) => (def.scale === 'log' ? v.toLocaleString('en-GB') : minus(String(v)));

/** A world's bounds, one line per limit, built from its LethalLimit list. */
function boundHTML(world: WorldConfig, l: LethalLimit, failing: boolean): string {
  const sym = l.statId === 'seaCover' ? 'N' : SYM[l.statId as ControlId] ?? esc(l.statId);
  const unit = (id: string, v: number) => fmt(id as ControlId, v).replace(' × Earth', ' × Earth');
  let rhs: string;
  const op = l.side === 'below' ? '≥' : '≤';
  switch (l.model) {
    case 'fixed': rhs = unit(l.statId, l.params.value); break;
    case 'solventFreezes': rhs = unit('temperature', world.solvent.freezeC + (l.params.offset ?? 0)); break;
    case 'solventCritical': rhs = unit('temperature', world.solvent.criticalC + (l.params.offset ?? 0)); break;
    case 'seasEmpty': rhs = 'N<sub>seas</sub>(T)'; break;
  }
  return `<span class="${failing ? 'bad' : ''}">${sym} ${op} ${rhs}</span>`;
}

/**
 * A text slot whose text differs per world. Every world's variant sits in the same grid cell and only the selected one is
 * visible, so the slot is always as tall as its tallest variant at the current width (no line counts to guess).
 */
function makeStack(el: HTMLElement): (html: Record<string, string>, active: string) => void {
  const kids = new Map<string, HTMLElement>();
  for (const id of worldIds) {
    const k = document.createElement('span');
    el.append(k);
    kids.set(id, k);
  }
  return (html, active) => {
    for (const [id, k] of kids) {
      if (k.dataset.h !== html[id]) { k.innerHTML = html[id]; k.dataset.h = html[id]; }
      const on = id === active;
      k.classList.toggle('on', on);
      if (on) k.removeAttribute('aria-hidden'); else k.setAttribute('aria-hidden', 'true');
    }
  };
}

export function mountSelectionScreen(host: HTMLElement, bus: UiBus, opts: SelectionOptions): SelectionScreen {
  const root = document.createElement('div');
  root.className = 'selscreen';
  root.innerHTML = `
<div class="sky" aria-hidden="true"><div></div><div></div><div></div><div></div></div>
<div class="desk">
  <div class="shadowbox"><article class="sheet">
    <header class="titleblock">
      <div class="tl">
        <h1>Life Is <span class="slot" aria-live="polite"><span data-r="sym"></span></span> Based</h1>
        <p class="byline">Choosing a chemistry for a new world · WHACK 26 Team · Marshall Wace “New Worlds” challenge · 8 November 2026</p>
      </div>
      <section class="abstract" aria-labelledby="absTitle"><p class="stack" data-r="abstract"></p></section>
    </header>
    <div class="page">
      <div class="colL">
        <section aria-labelledby="s1">
          <h2 class="sec" id="s1"><span class="no">1</span>Choose an element <small>(Table 1: Group 14; scroll sideways, or use ← →)</small></h2>
          <figure>
            <div class="carousel">
              <button class="cnav prev" data-r="prev" type="button" aria-label="Previous element">‹</button>
              <div class="track" data-r="track" role="listbox" tabindex="0" aria-orientation="horizontal" aria-label="Group 14 of the periodic table: scroll sideways to browse; carbon and silicon can be chosen"></div>
              <button class="cnav next" data-r="next" type="button" aria-label="Next element">›</button>
            </div>
            <div class="pips" data-r="pips" aria-hidden="true"></div>
          </figure>
        </section>
        <section aria-labelledby="s2">
          <h2 class="sec" id="s2"><span class="no">2</span>Starting conditions</h2>
          <figure>
            <div class="axes" data-r="controls"></div>
            <figcaption><b>Figure 1:</b> Checkered: life would die (preview). Dashed: Earth. Drag, or use arrow keys.</figcaption>
          </figure>
        </section>
      </div>
      <div class="colR">
        <section aria-labelledby="s3">
          <h2 class="sec" id="s3"><span class="no">3</span>Observation</h2>
          <figure class="boxfig">
            <div class="frame" data-r="frame">
              <canvas data-r="box" width="150" height="150" role="img" aria-label="Atoms and molecules of the selected world"></canvas>
              <span class="tag" style="top:8px">gas</span>
              <span class="tag" data-r="tagLiq" hidden></span>
              <span class="tag tagBed" data-r="tagBed" hidden></span>
            </div>
            <div class="rock" data-r="rock" role="group" aria-label="Rock"></div>
            <figcaption class="stack" data-r="boxCaption"></figcaption>
            <p class="fail" data-r="boxFail"></p>
          </figure>
        </section>
        <div class="eq" aria-live="polite"><div class="body stack" data-r="eqBody"></div><div class="no">(1)</div></div>
        <p class="eqnote" data-r="eqNote"></p>
        <p class="note" data-r="notice"></p>
        <div class="actions">
          <button class="btn" data-r="standardise" type="button">Standardise to optimum</button>
          <button class="btn" data-r="cinematic" type="button" aria-pressed="false" title="Start in the free camera with the interface hidden (C leaves it)"></button>
          <button class="btn primary" data-r="generate" type="button">Generate world</button>
        </div>
      </div>
    </div>
    <div class="footnotes"><p class="stack" data-r="footnote"></p></div>
    <details class="more">
      <summary>Read more: method notes and references</summary>
      <div class="morebody">
        <div>
          <h2 class="sec"><span class="no">1</span>Choose an element</h2>
          <p>Group 14 shares carbon’s four bonding hands. Table 1 lists the column as a row of cards you scroll through; only carbon and silicon can be chosen. Each card reports whether that chemistry’s life could persist under the conditions set in Section 2.</p>
          <h2 class="sec"><span class="no">2</span>Starting conditions</h2>
          <p>Every condition is drawn on the same full range for every world. The bounds are given by Eq. (1).</p>
          <ul class="hints" data-r="hints"></ul>
          <h2 class="sec"><span class="no">3</span>Observation</h2>
          <p>Figure 2 shows the selected chemistry in miniature. It is driven by the same viability test as the cards in Table 1, so the two never disagree: chains link and copy where life can persist, and each failing bound has its own signature.</p>
        </div>
        <section class="refs" aria-labelledby="refs"><h2 id="refs">References</h2><ol data-r="refs"></ol></section>
      </div>
    </details>
    <div class="pageno">1</div>
  </article></div>
</div>
<div class="toast" data-r="toast" role="status" aria-live="polite"></div>
<div class="scrim" data-r="appScrim" hidden>
  <div class="appendix" role="dialog" aria-modal="true" aria-labelledby="appTitle">
    <h2 id="appTitle" data-r="appTitle"></h2>
    <ol data-r="appSteps"></ol>
    <p class="caveat" data-r="appCaveat"></p>
    <button class="btn" type="button" data-r="appClose">Close</button>
  </div>
</div>
<div class="sr" data-r="announce" aria-live="polite"></div>`;
  host.append(root);

  const r = (name: string) => root.querySelector<HTMLElement>(`[data-r="${name}"]`)!;
  const announce = (msg: string) => { const a = r('announce'); a.textContent = ''; requestAnimationFrame(() => { a.textContent = msg; }); };

  const stacks = {
    abstract: makeStack(r('abstract')),
    eqBody: makeStack(r('eqBody')),
    boxCaption: makeStack(r('boxCaption')),
    footnote: makeStack(r('footnote')),
  };
  // The Appendix link lives in every footnote variant: one delegated listener.
  r('footnote').addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.linkbtn')) openAppendix(); });

  let state: SelectionState = initialSelection();
  let busy = false;      // gliding or launching: input is ignored
  let launching = false;
  let boxSpeed = 1;
  let raf = 0;
  let alive = true;

  // ---- Table 1: a horizontal carousel of group-14 cards ----
  // Scrolling a selectable card into the centre selects it; a locked card in the centre is shown greyed and leaves the last
  // selectable element selected (the box always shows a selectable element).
  const track = r('track');
  const pips = r('pips');
  let eggOn = false;   // Pb focused: carbon world with the lead easter-egg variant
  const cards: { el: HTMLElement; z: number; worldId?: WorldConfig['id']; egg?: boolean; via?: HTMLElement }[] = [];
  for (const e of group14) {
    const el = document.createElement('div');
    el.id = `ec-${e.z}`;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    const icon = `<div class="eicon">${elementIcon(e)}</div>`;
    if (e.worldId) {
      const w = worldFor(e.worldId);
      el.className = 'ecard pick';
      el.dataset.fam = e.worldId;
      el.style.setProperty('--sw', e.worldId === 'carbon' ? 'var(--c2)' : 'var(--s3)');
      el.innerHTML = `${icon}<div class="ehead"><span class="ename">${esc(e.name)} (${e.symbol})</span><span class="estat">${w.status === 'known' ? 'Known' : 'Speculative<span class="dagger">†</span>'}</span></div><div class="via"></div><span class="esel">Selected</span>`;
    } else if (e.egg) {
      el.className = 'ecard pick';
      el.dataset.fam = 'carbon';
      el.style.setProperty('--sw', 'var(--c2)');
      el.innerHTML = `${icon}<div class="ehead"><span class="ename">${esc(e.name)} (${e.symbol})</span><span class="estat">Easter egg: not science</span></div><div class="via">Tardigrades only. Lead is not a life chemistry.</div><span class="esel">Selected</span>`;
    } else {
      el.className = 'ecard grey';
      el.setAttribute('aria-disabled', 'true');
      el.innerHTML = `${icon}<div class="ehead"><span class="ename">${esc(e.name)} (${e.symbol})</span><span class="estat">Locked</span></div><div class="via">${esc(e.reason ?? '')}</div>`;
    }
    el.addEventListener('click', () => {
      if (suppressClick) return;
      const i = cards.findIndex((c) => c.el === el);
      goTo(i);
      if (!e.worldId && !e.egg) {
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
        announce(`${e.name} can’t be chosen: ${e.reason}.`);
      }
    });
    track.append(el);
    cards.push({ el, z: e.z, worldId: e.worldId, egg: !!e.egg, via: e.worldId ? el.querySelector<HTMLElement>('.via')! : undefined });
    pips.append(document.createElement('span'));
  }

  let focusIdx = 0;
  /** The title's ▢ shows the focused element, so scrolling to a locked one previews it greyed. */
  function showSlot() {
    const f = group14[focusIdx];
    const slot = r('sym');
    if (slot.textContent !== f.symbol) slot.textContent = f.symbol;
    slot.parentElement!.classList.toggle('locked', !f.worldId && !f.egg);
  }
  let aim: number | null = null;   // set while we scroll to a card ourselves, so the scroll handler doesn't fight us
  let aimTimer = 0;
  let suppressClick = false;
  const endAim = () => { aim = null; const i = nearestIdx(); if (i !== focusIdx) setFocus(i); };
  const armAim = (ms: number) => { clearTimeout(aimTimer); aimTimer = window.setTimeout(endAim, ms); };
  const nearestIdx = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.el.offsetLeft + c.el.offsetWidth / 2 - mid);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const scrollToIdx = (i: number) => {
    const c = cards[i].el;
    track.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - track.clientWidth / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  };
  function setFocus(i: number) {
    focusIdx = i;
    cards.forEach((c, k) => c.el.classList.toggle('focus', k === i));
    [...pips.children].forEach((p, k) => p.classList.toggle('on', k === i));
    track.setAttribute('aria-activedescendant', cards[i].el.id);
    (r('prev') as HTMLButtonElement).disabled = i === 0;
    (r('next') as HTMLButtonElement).disabled = i === cards.length - 1;
    const c = cards[i];
    const wasEgg = eggOn;
    eggOn = !!c.egg;
    if (c.egg) { if (state.worldId !== 'carbon') choose(6); }
    else if (c.worldId && c.worldId !== state.worldId) choose(c.z);
    if (wasEgg !== eggOn) render();
    showSlot();
    if (c.egg) announce('Lead: easter egg, not science. Carbon world, tardigrades only.');
    else if (!c.worldId) announce(`${group14[i].name}: ${group14[i].reason}. Locked.`);
  }
  /** Bring card i to the centre (smoothly) and, if it can be chosen, choose it now. */
  function goTo(i: number) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    aim = i;
    armAim(700);
    if (i !== focusIdx) setFocus(i);
    scrollToIdx(i);
  }
  let scrollRaf = 0;
  track.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (aim !== null) { armAim(160); return; }
      const i = nearestIdx();
      if (i !== focusIdx) setFocus(i);
    });
  }, { passive: true });
  const userTakesOver = () => { aim = null; clearTimeout(aimTimer); };
  track.addEventListener('touchstart', userTakesOver, { passive: true });
  r('prev').addEventListener('click', () => goTo(focusIdx - 1));
  r('next').addEventListener('click', () => goTo(focusIdx + 1));
  track.addEventListener('keydown', (ev) => {
    const k = ev.key;
    const to = k === 'ArrowRight' ? focusIdx + 1 : k === 'ArrowLeft' ? focusIdx - 1 : k === 'Home' ? 0 : k === 'End' ? cards.length - 1 : null;
    if (to === null) return;
    ev.preventDefault();
    goTo(to);
  });
  // A vertical wheel (a mouse wheel, or a trackpad swipe up/down) steps one card; sideways scrolling stays native.
  let wheelAcc = 0, wheelLock = 0;
  track.addEventListener('wheel', (ev) => {
    if (Math.abs(ev.deltaX) >= Math.abs(ev.deltaY)) { userTakesOver(); return; }
    const dir = ev.deltaY > 0 ? 1 : -1;
    const next = focusIdx + dir;
    if (next < 0 || next >= cards.length) return;   // at an end: let the page scroll
    ev.preventDefault();
    const now = performance.now();
    if (now < wheelLock) return;
    wheelAcc += ev.deltaY;
    if (Math.abs(wheelAcc) < 30) return;
    wheelAcc = 0; wheelLock = now + 380;
    goTo(next);
  }, { passive: false });
  // Mouse drag (touch and trackpads scroll natively).
  let drag: { x: number; left: number; moved: boolean } | null = null;
  track.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    userTakesOver();
    drag = { x: ev.clientX, left: track.scrollLeft, moved: false };
  });
  track.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; track.classList.add('dragging'); track.setPointerCapture(ev.pointerId); }
    if (drag.moved) track.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    track.classList.remove('dragging');
    if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); goTo(nearestIdx()); }
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  setFocus(0);

  // ---- Figure 1: axes ----
  const axes = new Map<ControlId, HTMLElement>();
  const axRefs = new Map<ControlId, { low: HTMLElement; high: HTMLElement; bandEl: HTMLElement; earthEl: HTMLElement; marker: HTMLElement; reasonEl: HTMLElement; outEl: HTMLElement }>();
  for (const def of controlList) {
    const id = def.id;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="ctl-head" title="${esc(def.hint)}"><span id="sel-lab-${id}">${SYM[id]}, ${esc(def.label.toLowerCase())}${def.scale === 'log' ? ' (log scale)' : ''}</span><span class="reason" data-re="${id}"></span><output data-o="${id}"></output></div>
      <div class="axis" role="slider" tabindex="0" aria-labelledby="sel-lab-${id}" data-a="${id}">
        <div class="zone low"></div><div class="band"></div><div class="zone high"></div>
        <div class="earth"><span>⊕ Earth</span></div><div class="marker"></div>
      </div>
      <div class="ticks">${ticksFor(def).map((v) => `<span style="left:${valueToFrac(v, def) * 100}%">${tickLabel(def, v)}</span>`).join('')}</div>
      `;
    r('controls').append(wrap);
    const ax = wrap.querySelector<HTMLElement>('.axis')!;
    axes.set(id, ax);
    axRefs.set(id, {
      low: ax.querySelector<HTMLElement>('.zone.low')!, high: ax.querySelector<HTMLElement>('.zone.high')!, bandEl: ax.querySelector<HTMLElement>('.band')!,
      earthEl: ax.querySelector<HTMLElement>('.earth')!, marker: ax.querySelector<HTMLElement>('.marker')!,
      reasonEl: wrap.querySelector<HTMLElement>(`[data-re="${id}"]`)!, outEl: wrap.querySelector<HTMLElement>(`[data-o="${id}"]`)!,
    });
    ax.setAttribute('aria-valuemin', String(def.min));
    ax.setAttribute('aria-valuemax', String(def.max));
    const setFromX = (x: number) => { const b = ax.getBoundingClientRect(); change(id, fracToValue((x - b.left) / b.width, def)); };
    ax.addEventListener('pointerdown', (e) => { if (busy) return; ax.setPointerCapture(e.pointerId); setFromX(e.clientX); });
    ax.addEventListener('pointermove', (e) => { if (ax.hasPointerCapture(e.pointerId)) setFromX(e.clientX); });
    ax.addEventListener('keydown', (e) => {
      if (busy) return;
      const v = state.conditions[id];
      const up = e.key === 'ArrowRight' || e.key === 'ArrowUp';
      const down = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
      let nv: number | null = null;
      if (up || down || e.key === 'PageUp' || e.key === 'PageDown') {
        const big = e.shiftKey || e.key.startsWith('Page');
        const dir = up || e.key === 'PageUp' ? 1 : -1;
        const bigStep = def.max - def.min > 100 ? 10 : 5;
        nv = def.scale === 'log' ? v * Math.pow(10, dir * (big ? 1 : 0.05)) : v + dir * (big ? bigStep : 1);
      } else if (e.key === 'Home') nv = def.min;
      else if (e.key === 'End') nv = def.max;
      else if (e.key === 'Enter') { generate(); return; }
      if (nv !== null) { e.preventDefault(); change(id, nv); }
    });
  }

  r('hints').innerHTML = controlList.map((d) => `<li><b>${esc(d.label)}:</b> ${esc(d.hint)}</li>`).join('');

  // ---- Particle box ----
  const boxCanvas = r('box') as HTMLCanvasElement;
  const box = createBox(boxCanvas);
  const eqNote = r('eqNote'), noticeEl = r('notice'), boxFail = r('boxFail');

  // ---- Render ----
  // Per-element last-written values: a DOM write happens only when the value changed.
  const memo = new WeakMap<Element, Map<string, string>>();
  const put = (el: Element, key: string, val: string, apply: () => void) => {
    let m = memo.get(el);
    if (!m) { m = new Map(); memo.set(el, m); }
    if (m.get(key) === val) return;
    m.set(key, val);
    apply();
  };
  const putHtml = (el: HTMLElement, v: string) => put(el, 'h', v, () => { el.innerHTML = v; });
  const putText = (el: HTMLElement, v: string) => put(el, 't', v, () => { el.textContent = v; });
  const putStyle = (el: HTMLElement, prop: 'left' | 'width', v: string) => put(el, prop, v, () => { el.style[prop] = v; });
  const putAttr = (el: Element, name: string, v: string) => put(el, `a:${name}`, v, () => el.setAttribute(name, v));
  const putClass = (el: Element, name: string, on: boolean) => put(el, `c:${name}`, on ? '1' : '0', () => el.classList.toggle(name, on));

  // World-only strings are built once.
  const specWorld = Object.values(worlds).find((w) => w.status === 'speculative');
  const abstractFor = (w: WorldConfig, activeId: string) => `<b${w.id === activeId ? ' id="absTitle"' : ''}>Abstract.</b> Every living thing on Earth is built on carbon. Carbon has siblings. We let the reader choose one, set a young planet’s starting conditions, and generate a world that evolves from them. The chemistry selected here, ${esc(w.displayName.toLowerCase())}, is <i>${w.status}</i>: ${w.status === 'known' ? `life as we know it, in ${esc(w.solvent.name.toLowerCase())}.` : `a world of ${esc(w.solvent.name.toLowerCase())} seas, which most chemists doubt.<span class="dagger">†</span>`}`;
  const abstractBy = Object.fromEntries(worldIds.map((a) => [a, Object.fromEntries(worldIds.map((id) => [id, abstractFor(worlds[id], a)]))]));
  const captionHtml = Object.fromEntries(worldIds.map((id) => {
    const w = worlds[id];
    return [id, `<b>Figure 2:</b> ${esc(w.displayName)} atoms in ${esc(w.solvent.name.toLowerCase())}${w.status === 'speculative' ? '<span class="dagger">†</span>' : ''}. Illustration, not to scale.`];
  }));
  const footFor = (w: WorldConfig) => w.status === 'speculative'
    ? `<span class="dagger">†</span> Speculative. ${esc(w.caveat ?? '')} See <button type="button" class="linkbtn">Appendix A</button>.`
    : specWorld ? `<span class="dagger">†</span> ${esc(specWorld.displayName)} is speculative; select it in Table 1 for the reasoning and its caveat (<button type="button" class="linkbtn">Appendix A</button>).` : '';
  const footHtml = Object.fromEntries(worldIds.map((id) => [id, footFor(worlds[id])]));
  // Eq. (1) text per (world, failing limit): depends only on which limit fails.
  const eqCache = new Map<string, string>();
  const eqFor = (id: WorldConfig['id'], fid: string | undefined) => {
    const k = `${id}|${fid ?? ''}`;
    let s = eqCache.get(k);
    if (s === undefined) { const w = worlds[id]; s = w.limits.map((l) => boundHTML(w, l, l.id === fid)).join(',&nbsp; '); eqCache.set(k, s); }
    return s;
  };

  function render() {
    const world = worldFor(state.worldId);
    const cond = state.conditions;
    const via = {} as Record<WorldConfig['id'], Viability>;
    for (const id of worldIds) via[id] = viability(worldFor(id), cond);
    const live = via[world.id];
    putAttr(root, 'data-world', world.id);
    showSlot();

    stacks.abstract(abstractBy[world.id], world.id);

    for (const c of cards) {
      if (c.egg) { putClass(c.el, 'sel', eggOn); putAttr(c.el, 'aria-selected', String(eggOn)); continue; }
      if (!c.worldId || !c.via) continue;
      const sel = c.worldId === world.id && !eggOn;
      putClass(c.el, 'sel', sel);
      putAttr(c.el, 'aria-selected', String(sel));
      const v = via[c.worldId];
      putAttr(c.via, 'class', `via ${v.ok ? 'ok' : 'no'}`);
      putHtml(c.via, `<span class="sw"></span>${v.ok ? 'Life can persist' : esc(v.reason)}`);
    }

    const bands = bandsFor(state);
    for (const def of controlList) {
      const id = def.id;
      const ax = axes.get(id)!;
      const { low, high, bandEl, earthEl, marker, reasonEl, outEl } = axRefs.get(id)!;
      const band = bands[id];
      let lowL: string | null = null, lowW = '0%', highL: string | null = null, highW = '0%', bandL: string | null = null, bandW = '0%';
      if (band.empty) { lowL = '0%'; lowW = '100%'; }
      else {
        const lo = valueToFrac(band.low, def), hi = valueToFrac(band.high, def);
        bandL = `${lo * 100}%`; bandW = `${Math.max(0.8, (hi - lo) * 100)}%`;
        for (const sg of redSegments(band, def)) {
          if (sg.side === 'low') { lowL = `${sg.from * 100}%`; lowW = `${(sg.to - sg.from) * 100}%`; }
          else { highL = `${sg.from * 100}%`; highW = `${(sg.to - sg.from) * 100}%`; }
        }
      }
      if (lowL !== null) putStyle(low, 'left', lowL);
      if (highL !== null) putStyle(high, 'left', highL);
      if (bandL !== null) putStyle(bandEl, 'left', bandL);
      putStyle(low, 'width', lowW); putStyle(high, 'width', highW); putStyle(bandEl, 'width', bandW);
      const earth = world.stats.find((s) => s.id === id)?.earthValue;
      put(earthEl, 'hid', String(earth === undefined), () => { earthEl.hidden = earth === undefined; });
      if (earth !== undefined) putStyle(earthEl, 'left', `${valueToFrac(earth, def) * 100}%`);
      putStyle(marker, 'left', `${valueToFrac(cond[id], def) * 100}%`);
      const why = redReason(world, band, cond[id]);
      putClass(ax, 'in-red', !!why);
      const reasonText = why ? `${why}.` : '';
      putText(reasonEl, reasonText);
      put(reasonEl, 'title', reasonText, () => { reasonEl.title = reasonText; });
      putHtml(outEl, `${SYM[id]} = ${fmt(id, cond[id])}`);
      putAttr(ax, 'aria-valuenow', String(Math.round(cond[id] * 100) / 100));
      putAttr(ax, 'aria-valuetext', `${fmt(id, cond[id])}, ${why ? `in a lethal interval: ${why}` : `inside ${world.displayName.toLowerCase()}’s living band`}`);
    }

    // Eq. (1): the selected world's limit list, as bounds.
    stacks.eqBody(Object.fromEntries(worldIds.map((id) => {
      const v = via[id];
      return [id, eqFor(id, v.ok ? undefined : v.limitId)];
    })), world.id);
    let note = live.ok ? 'At present every bound holds.' : `At present a bound fails: ${esc(live.reason.toLowerCase())}.`;
    if (world.limits.some((l) => l.model === 'seasEmpty')) {
      const nb = bands.nitrogen;
      note = nb.empty
        ? `At ${fmt('temperature', cond.temperature)} no nitrogen inventory gives a sea: ${esc((world.limits.find((l) => l.id === nb.blockingLimitId)?.reason ?? '').toLowerCase())}.`
        : `At ${fmt('temperature', cond.temperature)} the seas need N ≥ ${fmt('nitrogen', nb.low)}; the planet has ${fmt('nitrogen', cond.nitrogen)}. ${note}`;
    }
    putHtml(eqNote, note);

    const { moves } = plannedMoves(state);
    putHtml(noticeEl, moves.length
      ? `Note: ${esc(world.displayName)} life cannot persist here yet. Generating will set ${moves.map((m) => `${SYM[m.controlId]} to ${fmt(m.controlId, m.to)}`).join(' and ')}.`
      : '');

    stacks.boxCaption(captionHtml, world.id);
    putText(boxFail, live.ok ? '' : `Life cannot persist: ${live.reason.toLowerCase()}.`);

    stacks.footnote(footHtml, world.id);

    renderRefs(world, specWorld);
    renderRock(world);
    bus.emit('selection:changed', { worldId: world.id, conditions: { ...cond }, ...(effectiveCrust(state) ? { crust: effectiveCrust(state) } : {}) });
  }

  // Rock chips (docs/features/crust.md): the same chips on every world, hints from the current world's mineral; none picked = the natural mix.
  const pickHint = (world: WorldConfig, id: CrustPickId) => world.terrain.crust.minerals.find((m) => m.id === id)?.pick?.hint ?? '';
  let rockFor = '';
  function renderRock(world: WorldConfig) {
    const el = r('rock');
    if (rockFor !== world.id) {
      rockFor = world.id;
      el.innerHTML = `<span class="rl">Rock:</span>` + CRUST_PICKS
        .map((c) => `<button type="button" class="chip" data-m="${c.id}" title="${esc(pickHint(world, c.id))}" aria-pressed="false">${esc(c.label)}</button>`).join('');
    }
    el.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => {
      const on = b.dataset.m === effectiveCrust(state);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  r('rock').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!b || busy) return;
    state = toggleCrust(state, b.dataset.m as CrustPickId);
    render();
    const c = CRUST_PICKS.find((x) => x.id === b.dataset.m)!;
    announce(effectiveCrust(state) ? `${c.label} rock: ${pickHint(worldFor(state.worldId), c.id)}.` : 'Natural rock mix.');
  });

  // References: every source cited by the selected world's limits and, for the appendix, the speculative world's reasoning.
  const refIndex = new Map<string, number>();
  const refId = (id: string) => { if (!refIndex.has(id)) refIndex.set(id, refIndex.size + 1); return refIndex.get(id)!; };
  let refsFor = '';
  function renderRefs(world: WorldConfig, specWorld?: WorldConfig) {
    if (refsFor === world.id) return;
    refsFor = world.id;
    refIndex.clear();
    const ids = new Set<string>();
    for (const l of world.limits) l.sources.forEach((s) => ids.add(s));
    specWorld?.reasoning.forEach((s) => s.sources.forEach((x) => ids.add(x)));
    ids.forEach(refId);
    r('refs').innerHTML = [...refIndex].map(([id, n]) => {
      const s = sourceFor(id);
      const link = s.doi ? ` <a href="https://doi.org/${s.doi}" target="_blank" rel="noreferrer">doi:${esc(s.doi)}</a>` : s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.url)}</a>` : '';
      return `<li><span>[${n}]</span><span>${esc(s.citation)}${link}</span></li>`;
    }).join('');
  }

  // ---- Appendix A ----
  let lastFocus: Element | null = null;
  function openAppendix() {
    const w = Object.values(worlds).find((x) => x.status === 'speculative');
    if (!w) return;
    r('appTitle').textContent = `Appendix A: Why ${w.displayName.toLowerCase()}, and why it is doubtful`;
    r('appSteps').innerHTML = w.reasoning.map((s) => {
      const cite = s.sources.length ? ` [${s.sources.map(refId).join(', ')}]` : '';
      const dot = s.text.indexOf('. ');
      const head = dot > 0 ? `<b>${esc(s.text.slice(0, dot + 1))}</b>${esc(s.text.slice(dot + 1))}` : esc(s.text);
      return `<li>${head}${cite}${s.assumption ? ' <i>(assumption)</i>' : ''}</li>`;
    }).join('');
    r('appCaveat').textContent = w.caveat ?? '';
    lastFocus = document.activeElement;
    r('appScrim').hidden = false;
    r('appClose').focus();
  }
  function closeAppendix() { r('appScrim').hidden = true; (lastFocus as HTMLElement | null)?.focus?.(); }
  r('appClose').addEventListener('click', closeAppendix);
  r('appScrim').addEventListener('click', (e) => { if (e.target === r('appScrim')) closeAppendix(); });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !r('appScrim').hidden) closeAppendix(); };
  document.addEventListener('keydown', onKey);

  // ---- Actions ----
  let toastTimer = 0;
  function toast(html: string, ms: number) {
    const t = r('toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  }

  function choose(z: number) {
    if (busy) return;
    const next = selectElement(state, z);
    if (next === state) return;
    state = next;
    r('sym').textContent = '';
    render();
    announce(`${worldFor(state.worldId).displayName} selected.`);
  }
  function change(id: ControlId, v: number) {
    if (busy) return;
    state = setCondition(state, id, v);
    render();
  }

  function glideTo(target: Conditions, ms: number, done: () => void) {
    const from = { ...state.conditions };
    const t0 = performance.now(), d = reduceMotion() ? 1 : ms;
    busy = true;
    const step = (now: number) => {
      if (!alive) return;
      const k = ease(Math.min(1, Math.max(0, (now - t0) / d)));
      const cond = { ...state.conditions };
      for (const def of controlList) {
        const a = from[def.id], b = target[def.id];
        cond[def.id] = def.scale === 'log' ? Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * k) : a + (b - a) * k;
      }
      state = { ...state, conditions: cond };
      render();
      if (k < 1) requestAnimationFrame(step);
      else { state = { ...state, conditions: { ...target } }; render(); done(); }
    };
    requestAnimationFrame(step);
  }

  r('standardise').addEventListener('click', () => {
    if (busy) return;
    const w = worldFor(state.worldId);
    const opt = w.startDefaults;
    const values = controlList.map((c) => `${SYM[c.id]} = ${fmt(c.id, opt[c.id])}`).join(', ');
    if (controlList.every((c) => Math.abs(valueToFrac(state.conditions[c.id], c) - valueToFrac(opt[c.id], c)) < 1e-6)) {
      toast(`Already at ${esc(w.displayName.toLowerCase())}’s optimal starting conditions.`, 2200);
      return;
    }
    glideTo(opt, 600, () => {
      busy = false;
      toast(`Standardised to ${esc(w.displayName.toLowerCase())}’s optimal starting conditions: ${values}.`, 3200);
      announce(`Standardised to ${w.displayName}’s optimal starting conditions.`);
    });
  });

  function generate() {
    if (busy) return;
    const wi = eggOn ? cards.findIndex((c) => c.egg) : cards.findIndex((c) => c.worldId === state.worldId);
    if (focusIdx !== wi) goTo(wi);   // a locked card in focus: bring the chosen element back before launching
    const world = worldFor(state.worldId);
    const { start, moves } = plannedMoves(state);
    const payload = generatePayload(state);   // the settings at the click: the sim moves them itself and reports why
    const begin = () => { launching = true; busy = true; root.classList.add('launching'); opts.onGenerate(eggOn ? { ...payload, egg: 'lead' } : payload, handle); };
    if (!moves.length) { busy = true; begin(); return; }
    const m = moves[0];
    toast(`${esc(world.displayName)} life cannot survive at ${fmt(m.controlId, m.from)}, so this world starts at ${fmt(m.controlId, m.to)}.`, 2600);
    glideTo(start, 800, () => setTimeout(begin, 450));
  }
  r('generate').addEventListener('click', generate);
  const cineBtn = r('cinematic');
  const paintCine = () => { const on = cinematicOn(); cineBtn.textContent = `Cinematic: ${on ? 'on' : 'off'}`; cineBtn.setAttribute('aria-pressed', String(on)); cineBtn.classList.toggle('primary', on); };
  cineBtn.addEventListener('click', () => { setCinematic(!cinematicOn()); paintCine(); });
  paintCine();

  // ---- Main loop ----
  let last = performance.now();
  // Last-written tag state: DOM writes only on change (each write dirties style/layout).
  let tlHidden: boolean | null = null, tlText = '', tlTop = '', blHidden: boolean | null = null, blText = '';
  function frame(now: number) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const world = withCrustChoice(worldFor(state.worldId), effectiveCrust(state));
    // While launching, the box keeps living (slowed by the transition) until its dots hand over to the grains.
    box.frame(now, launching ? dt * boxSpeed : dt, world, state.conditions);
    if (!launching) {
      const tag = box.liquidTag(world), tl = r('tagLiq');
      if (tlHidden !== !tag) { tlHidden = !tag; tl.hidden = !tag; }
      if (tag) {
        if (tlText !== tag.text) { tlText = tag.text; tl.textContent = tag.text; }
        const top = `min(calc(${tag.y * 100}% + 8px), calc(100% - 50px))`;
        if (tlTop !== top) { tlTop = top; tl.style.top = top; }
      }
      const bt = box.bedTag(world), bl = r('tagBed');
      if (blHidden !== !bt) { blHidden = !bt; bl.hidden = !bt; }
      if (bt && blText !== bt.text) { blText = bt.text; bl.textContent = bt.text; }
    }
    raf = requestAnimationFrame(frame);
  }

  function dispose() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    clearTimeout(toastTimer);
    clearTimeout(aimTimer);
    cancelAnimationFrame(scrollRaf);
    document.removeEventListener('keydown', onKey);
    root.remove();
  }

  render();
  raf = requestAnimationFrame(frame);

  const handle: LaunchHandle = {
    root,
    boxCanvas,
    boxRect: () => boxCanvas.getBoundingClientRect(),
    seeds: () => box.seeds(),
    atomCount: N_ATOMS,
    setBoxSpeed: (k) => { boxSpeed = k; },
    dispose,
  };
  return { handle, dispose };
}
