// The selection screen (CLAUDE.md "The experience"; docs/features/selection-screen.md): "Life is ▢ based" as a pixel-art
// research paper, ported from mockups/selection-screen. Slider maths is ui/sliderMath, viability and bands are
// sim/limits, and every world fact (status, caveat, reasoning, bounds, Earth values, sources) is read from the world configs.
// Emits `selection:changed` on every change; hands Generate to the host, which emits `world:selected` once the world is built.
import './selection.css';
import { controlList, sourceFor, worldFor, worlds } from '../../worlds';
import type { Conditions, ControlDef, ControlId, LethalLimit, WorldConfig } from '../../worlds/types';
import { fracToValue, redSegments, valueToFrac } from '../sliderMath';
import type { UiBus } from '../uiBus';
import { createBox } from './box';
import { group14 } from './elements';
import { LAUNCH_SOLID_SEC, startLaunch, type Launch } from './launch';
import {
  bandsFor, generatePayload, initialSelection, plannedMoves, redReason, selectElement, setCondition, viability,
  type SelectionState,
} from './state';

export interface SelectionOptions {
  /** Generate was clicked. The host builds the world and emits `world:selected` with this payload, then calls worldStarted(). */
  onGenerate(payload: { worldId: WorldConfig['id']; requested: Conditions }): void;
}

export interface SelectionScreen {
  /** The host has emitted `world:selected`; the cover may lift once the ground is solid. */
  worldStarted(): void;
  dispose(): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const minus = (s: string) => s.replace('-', '−');
const SYM: Record<ControlId, string> = { temperature: 'T', nitrogen: 'N', oxygen: 'x<sub>O₂</sub>' };
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

export function mountSelectionScreen(host: HTMLElement, bus: UiBus, opts: SelectionOptions): SelectionScreen {
  const root = document.createElement('div');
  root.className = 'selscreen';
  root.innerHTML = `
<div class="sky" aria-hidden="true"><div></div><div></div><div></div><div></div></div>
<div class="desk">
  <div class="shadowbox"><article class="sheet">
    <header class="titleblock">
      <h1>Life Is <span class="slot" aria-live="polite"><span data-r="sym"></span></span> Based</h1>
      <p class="subtitle">Choosing a chemistry for a new world</p>
      <p class="authors">WHACK 26 Team</p>
      <p class="affil">Marshall Wace “New Worlds” challenge</p>
      <p class="date">8 November 2026</p>
      <section class="abstract" aria-labelledby="absTitle"><h2 id="absTitle">Abstract</h2><p data-r="abstract"></p></section>
    </header>
    <div class="columns">
      <div class="col">
        <section aria-labelledby="s1">
          <h2 class="sec" id="s1"><span class="no">1</span>Choose an element</h2>
          <p>Group 14 shares carbon’s four bonding hands. Table 1 lists the column; only carbon and silicon can be chosen. The last column reports whether that chemistry’s life could persist under the conditions set in Section 2.</p>
          <figure>
            <figcaption><b>Table 1:</b> Group 14 of the periodic table. Select a row.</figcaption>
            <div class="tablewrap"><table aria-label="Group 14 of the periodic table">
              <thead><tr><th></th><th class="num"><span class="m">Z</span></th><th>Element</th><th>Status</th><th>Viability now</th></tr></thead>
              <tbody data-r="rows" role="radiogroup" aria-label="Choose an element"></tbody>
            </table></div>
          </figure>
        </section>
        <section aria-labelledby="s2">
          <h2 class="sec" id="s2"><span class="no">2</span>Starting conditions</h2>
          <p>Every condition is drawn on the same full range for every world. Checkered intervals mark where the selected world’s life would die; the dashed line marks Earth. Drag a marker, or focus an axis and use the arrow keys. The bounds are given by Eq. (1).</p>
          <figure>
            <div class="axes" data-r="controls"></div>
            <figcaption><b>Figure 1:</b> Starting conditions for the selected world. On this page the checkered intervals are a preview; once a world is running, a marker cannot enter them.</figcaption>
          </figure>
          <div class="eq" aria-live="polite"><div class="body" data-r="eqBody"></div><div class="no">(1)</div></div>
          <p class="eqnote" data-r="eqNote"></p>
          <p class="note" data-r="notice"></p>
          <div class="actions">
            <button class="btn" data-r="standardise" type="button">Standardise to optimum</button>
            <button class="btn primary" data-r="generate" type="button">Generate world</button>
          </div>
        </section>
      </div>
      <div class="col">
        <section aria-labelledby="s3">
          <h2 class="sec" id="s3"><span class="no">3</span>Observation</h2>
          <p>Figure 2 shows the selected chemistry in miniature. It is driven by the same viability test as Table 1, so the two never disagree: chains link and copy where life can persist, and each failing bound has its own signature.</p>
          <figure class="boxfig">
            <div class="frame" data-r="frame">
              <canvas data-r="box" width="150" height="150" role="img" aria-label="Atoms and molecules of the selected world"></canvas>
              <span class="tag" style="top:8px">gas</span>
              <span class="tag" data-r="tagLiq" hidden></span>
            </div>
            <figcaption data-r="boxCaption"></figcaption>
            <p class="fail" data-r="boxFail"></p>
          </figure>
        </section>
        <section class="refs" aria-labelledby="refs"><h2 id="refs">References</h2><ol data-r="refs"></ol></section>
      </div>
    </div>
    <div class="footnotes"><p data-r="footnote"></p></div>
    <div class="pageno">1</div>
  </article></div>
</div>
<div class="toast" data-r="toast" role="status" aria-live="polite"></div>
<canvas data-r="launch" id="launch" aria-hidden="true"></canvas>
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

  let state: SelectionState = initialSelection();
  let busy = false;      // gliding or launching: input is ignored
  let launching = false;
  let started = false;
  let startedAt = 0;
  let launch: Launch | null = null;
  let raf = 0;
  let alive = true;

  // ---- Table 1 ----
  const tbody = r('rows');
  const pickRows = new Map<string, HTMLElement>();
  for (const e of group14) {
    const tr = document.createElement('tr');
    if (e.worldId) {
      const w = worldFor(e.worldId);
      tr.className = 'pick';
      tr.style.setProperty('--sw', e.worldId === 'carbon' ? 'var(--c2)' : 'var(--s3)');
      tr.innerHTML = `<td><button class="radio" type="button" role="radio" aria-label="${esc(e.name)}"></button></td>
        <td class="num">${e.z}</td><td>${esc(e.name)} (${e.symbol})</td>
        <td>${w.status === 'known' ? 'Known' : 'Speculative<span class="dagger">†</span>'}</td><td class="via"></td>`;
      tr.addEventListener('click', () => choose(e.z));
      tr.querySelector('.radio')!.addEventListener('keydown', (ev) => {
        const k = (ev as KeyboardEvent).key;
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(k)) return;
        ev.preventDefault();
        const other = group14.find((x) => x.worldId && x.worldId !== state.worldId)!;
        choose(other.z);
        pickRows.get(other.worldId!)!.querySelector<HTMLElement>('.radio')!.focus();
      });
      pickRows.set(e.worldId, tr);
    } else {
      tr.className = 'grey';
      tr.innerHTML = `<td></td><td class="num">${e.z}</td><td>${esc(e.name)} (${e.symbol})</td><td>Not in this version</td><td class="via">${esc(e.reason ?? '')}</td>`;
      tr.addEventListener('click', () => {
        tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
        announce(`${e.name} can’t be chosen: ${e.reason}.`);
      });
    }
    tbody.append(tr);
  }

  // ---- Figure 1: axes ----
  const axes = new Map<ControlId, HTMLElement>();
  for (const def of controlList) {
    const id = def.id;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="ctl-head"><span id="sel-lab-${id}">${SYM[id]}, ${esc(def.label.toLowerCase())}${def.scale === 'log' ? ' (log scale)' : ''}</span><output data-o="${id}"></output></div>
      <div class="axis" role="slider" tabindex="0" aria-labelledby="sel-lab-${id}" data-a="${id}">
        <div class="zone low"></div><div class="band"></div><div class="zone high"></div>
        <div class="earth"><span>⊕ Earth</span></div><div class="marker"></div>
      </div>
      <div class="ticks">${ticksFor(def).map((v) => `<span style="left:${valueToFrac(v, def) * 100}%">${tickLabel(def, v)}</span>`).join('')}</div>
      <div class="reason" data-re="${id}"></div>
      <p class="hint">${esc(def.hint)}</p>`;
    r('controls').append(wrap);
    const ax = wrap.querySelector<HTMLElement>('.axis')!;
    axes.set(id, ax);
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

  // ---- Particle box ----
  const boxCanvas = r('box') as HTMLCanvasElement;
  const box = createBox(boxCanvas);

  // ---- Render ----
  function render() {
    const world = worldFor(state.worldId);
    const cond = state.conditions;
    const live = viability(world, cond);
    root.dataset.world = world.id;
    const sym = group14.find((e) => e.worldId === world.id)!.symbol;
    const slot = r('sym');
    if (slot.textContent !== sym) slot.textContent = sym;

    const solvent = world.solvent.name.toLowerCase();
    r('abstract').innerHTML = `Every living thing on Earth is built on carbon. Carbon has siblings. We let the reader choose one, set a young planet’s starting conditions, and generate a world that evolves from them. The chemistry selected here, ${esc(world.displayName.toLowerCase())}, is <i>${world.status}</i>: ${world.status === 'known' ? `life as we know it, in ${esc(solvent)}.` : `a world of ${esc(solvent)} seas, which most chemists doubt.<span class="dagger">†</span>`}`;

    for (const [wid, tr] of pickRows) {
      const sel = wid === world.id;
      tr.classList.toggle('sel', sel);
      const radio = tr.querySelector<HTMLElement>('.radio')!;
      radio.setAttribute('aria-checked', String(sel));
      radio.tabIndex = sel ? 0 : -1;
      const v = viability(worldFor(wid as WorldConfig['id']), cond);
      const via = tr.querySelector<HTMLElement>('.via')!;
      via.className = `via ${v.ok ? 'ok' : 'no'}`;
      via.innerHTML = `<span class="sw"></span>${v.ok ? 'Life can persist' : esc(v.reason)}`;
    }

    const bands = bandsFor(state);
    for (const def of controlList) {
      const id = def.id;
      const ax = axes.get(id)!;
      const band = bands[id];
      const low = ax.querySelector<HTMLElement>('.zone.low')!;
      const high = ax.querySelector<HTMLElement>('.zone.high')!;
      const bandEl = ax.querySelector<HTMLElement>('.band')!;
      low.style.width = high.style.width = bandEl.style.width = '0%';
      const segs = redSegments(band, def);
      if (band.empty) { low.style.left = '0%'; low.style.width = '100%'; }
      else {
        const lo = valueToFrac(band.low, def), hi = valueToFrac(band.high, def);
        bandEl.style.left = `${lo * 100}%`; bandEl.style.width = `${Math.max(0.8, (hi - lo) * 100)}%`;
        for (const sg of segs) {
          const el = sg.side === 'low' ? low : high;
          el.style.left = `${sg.from * 100}%`; el.style.width = `${(sg.to - sg.from) * 100}%`;
        }
      }
      const earth = world.stats.find((s) => s.id === id)?.earthValue;
      const earthEl = ax.querySelector<HTMLElement>('.earth')!;
      earthEl.hidden = earth === undefined;
      if (earth !== undefined) earthEl.style.left = `${valueToFrac(earth, def) * 100}%`;
      ax.querySelector<HTMLElement>('.marker')!.style.left = `${valueToFrac(cond[id], def) * 100}%`;
      const why = redReason(world, band, cond[id]);
      ax.classList.toggle('in-red', !!why);
      root.querySelector<HTMLElement>(`[data-re="${id}"]`)!.textContent = why ? `${why}.` : '';
      root.querySelector<HTMLElement>(`[data-o="${id}"]`)!.innerHTML = `${SYM[id]} = ${fmt(id, cond[id])}`;
      ax.setAttribute('aria-valuemin', String(def.min));
      ax.setAttribute('aria-valuemax', String(def.max));
      ax.setAttribute('aria-valuenow', String(Math.round(cond[id] * 100) / 100));
      ax.setAttribute('aria-valuetext', `${fmt(id, cond[id])}, ${why ? `in a lethal interval: ${why}` : `inside ${world.displayName.toLowerCase()}’s living band`}`);
    }

    // Eq. (1): the selected world's limit list, as bounds.
    const failId = live.ok ? undefined : live.limitId;
    r('eqBody').innerHTML = world.limits.map((l) => boundHTML(world, l, l.id === failId)).join(',&nbsp; ');
    let note = live.ok ? 'At present every bound holds.' : `At present a bound fails: ${esc(live.reason.toLowerCase())}.`;
    if (world.limits.some((l) => l.model === 'seasEmpty')) {
      const nb = bands.nitrogen;
      note = nb.empty
        ? `At ${fmt('temperature', cond.temperature)} no nitrogen inventory gives a sea: ${esc((world.limits.find((l) => l.id === nb.blockingLimitId)?.reason ?? '').toLowerCase())}.`
        : `At ${fmt('temperature', cond.temperature)} the seas need N ≥ ${fmt('nitrogen', nb.low)}; the planet has ${fmt('nitrogen', cond.nitrogen)}. ${note}`;
    }
    r('eqNote').innerHTML = note;

    const { moves } = plannedMoves(state);
    r('notice').innerHTML = moves.length
      ? `Note: ${esc(world.displayName)} life cannot persist here yet. Generating will set ${moves.map((m) => `${SYM[m.controlId]} to ${fmt(m.controlId, m.to)}`).join(' and ')}.`
      : '';

    const spec = world.status === 'speculative';
    r('boxCaption').innerHTML = `<b>Figure 2:</b> ${esc(world.displayName)} atoms in ${esc(solvent)}${spec ? '<span class="dagger">†</span>' : ''}. Illustration, not to scale.`;
    r('boxFail').textContent = live.ok ? '' : `Life cannot persist: ${live.reason.toLowerCase()}.`;

    const specWorld = Object.values(worlds).find((w) => w.status === 'speculative');
    r('footnote').innerHTML = spec
      ? `<span class="dagger">†</span> Speculative. ${esc(world.caveat ?? '')} See <button type="button" class="linkbtn" data-r="appLink">Appendix A</button>.`
      : specWorld ? `<span class="dagger">†</span> ${esc(specWorld.displayName)} is speculative; select it in Table 1 for the reasoning and its caveat (<button type="button" class="linkbtn" data-r="appLink">Appendix A</button>).` : '';
    root.querySelector('[data-r="appLink"]')?.addEventListener('click', openAppendix);

    renderRefs(world, specWorld);
    bus.emit('selection:changed', { worldId: world.id, conditions: { ...cond } });
  }

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
    const world = worldFor(state.worldId);
    const { start, moves } = plannedMoves(state);
    opts.onGenerate(generatePayload(state));
    const begin = () => { launching = true; busy = true; root.classList.add('launching'); launch = startLaunch(r('launch') as HTMLCanvasElement, boxCanvas, r('frame').getBoundingClientRect(), world, box.seeds(), performance.now()); };
    if (!moves.length) { busy = true; begin(); return; }
    const m = moves[0];
    toast(`${esc(world.displayName)} life cannot survive at ${fmt(m.controlId, m.from)}, so this world starts at ${fmt(m.controlId, m.to)}.`, 2600);
    glideTo(start, 800, () => setTimeout(begin, 450));
  }
  r('generate').addEventListener('click', generate);

  // ---- Main loop ----
  let last = performance.now();
  let fading = false;
  function frame(now: number) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!launching) {
      const world = worldFor(state.worldId);
      box.frame(now, dt, world, state.conditions);
      const tag = box.liquidTag(world), tl = r('tagLiq');
      tl.hidden = !tag;
      if (tag) { tl.textContent = tag.text; tl.style.top = `calc(${tag.y * 100}% + 8px)`; }
    } else if (launch) {
      const t = launch.draw(now);
      // Lift the cover once the particles are ground and the real world has had time to spawn the character.
      const spawnIn = worldFor(state.worldId).build.spawnSec - 0.6;
      if (!fading && started && t >= LAUNCH_SOLID_SEC && (now - startedAt) / 1000 >= spawnIn) {
        fading = true;
        root.style.transition = 'opacity 0.6s steps(6, end)';
        root.style.opacity = '0';
        setTimeout(() => dispose(), 700);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function dispose() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    clearTimeout(toastTimer);
    document.removeEventListener('keydown', onKey);
    root.remove();
  }

  render();
  raf = requestAnimationFrame(frame);

  return {
    worldStarted() { started = true; startedAt = performance.now(); },
    dispose,
  };
}
