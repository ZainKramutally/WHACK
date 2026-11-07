// Conditions panel: sliders (full range, living band, red zones, Earth marker), stats beside Earth's,
// years counter, silicon reasoning + caveat, and a button for the summary card.
import { el } from './dom';
import { formatStat, formatValue, formatYears } from './format';
import { clampToBand, fracToValue, redSegments, valueToFrac } from './sliderMath';
import { newTarget, nudgedValue, setTarget, syncLive, type SliderTarget } from './sliderTarget';
import { listen, type UiBus } from './uiBus';
import type { ControlDef, ControlId, LivingBand, SimSnapshot, WorldConfig } from '../worlds/types';

const STEP = 0.01; // keyboard / D-pad step, as a fraction of the track
const REASON_MS = 3000;
const PULSE_MS = 600;
const GHOST_MIN_FRAC = 0.005; // show the live ghost once it is half a percent of the track from the target

interface SliderView {
  def: ControlDef;
  root: HTMLElement;
  track: HTMLElement;
  thumb: HTMLElement;
  reds: HTMLElement;
  chips: HTMLElement;
  readout: HTMLElement;
  reason: HTMLElement;
  /** What the thumb and readout show: the player's target. The sim's eased live value is the `live` ghost. */
  value: number;
  live: number;
  ghost: HTMLElement;
  st: SliderTarget;
  band: LivingBand | null;
  dragging: boolean;
  reasonTimer?: ReturnType<typeof setTimeout>;
  bandKey?: string;
}

export function mountConditions(
  bus: UiBus, world: WorldConfig, controls: ControlDef[], onOpenSummary: () => void,
) {
  const speculative = world.status === 'speculative';
  const drawer = el('aside', 'wu-drawer wu-conditions');
  drawer.setAttribute('aria-label', 'Conditions');
  drawer.append(el('h2', 'wu-h', 'Conditions'));

  // --- sliders ---
  const sliderBox = el('section', 'wu-sliders');
  sliderBox.append(el('p', 'wu-note', 'Ask “what if?” Moving a slider is you changing the planet, not a natural event. Keys: ↑↓ choose a slider, ←→ move it.'));
  const views = new Map<ControlId, SliderView>();
  let selected = 0; // D-pad focus

  const limitReason = (id?: string): string => {
    const l = world.limits.find((x) => x.id === id);
    if (!l) return 'Life cannot survive there';
    return speculative && !/speculative/i.test(l.reason) ? `${l.reason} (speculative)` : l.reason;
  };

  function showReason(v: SliderView, text: string) {
    v.reason.textContent = text;
    v.reason.classList.add('wu-on');
    clearTimeout(v.reasonTimer);
    v.reasonTimer = setTimeout(() => v.reason.classList.remove('wu-on'), REASON_MS);
  }
  function pulse(v: SliderView, side: 'low' | 'high' | 'all') {
    for (const seg of Array.from(v.reds.children) as HTMLElement[]) {
      if (side === 'all' || seg.dataset.side === side) {
        seg.classList.remove('wu-pulse');
        void seg.offsetWidth; // restart the animation
        seg.classList.add('wu-pulse');
        setTimeout(() => seg.classList.remove('wu-pulse'), PULSE_MS);
      }
    }
  }

  function paintThumb(v: SliderView) {
    v.thumb.style.left = `${valueToFrac(v.value, v.def) * 100}%`;
    v.thumb.setAttribute('aria-valuenow', String(v.value));
    v.readout.textContent = formatValue(v.value, v.def.unit);
    // The eased live value, shown as a ghost while it is still catching up with the target.
    const apart = Math.abs(valueToFrac(v.live, v.def) - valueToFrac(v.value, v.def)) > GHOST_MIN_FRAC;
    v.ghost.hidden = !apart;
    if (apart) v.ghost.style.left = `${valueToFrac(v.live, v.def) * 100}%`;
  }

  function paintBand(v: SliderView) {
    // Called every snapshot (20 Hz): repaint only when the band visibly changed (3 significant digits), or the pulse
    // animation would be killed.
    const b = v.band;
    const key = b ? `${b.low.toPrecision(3)}|${b.high.toPrecision(3)}|${b.empty ?? ''}|${b.lowLimitId ?? ''}|${b.highLimitId ?? ''}|${b.blockingLimitId ?? ''}` : '';
    if (key === v.bandKey) return;
    v.bandKey = key;
    v.reds.replaceChildren();
    v.chips.replaceChildren();
    if (!v.band) return;
    for (const seg of redSegments(v.band, v.def)) {
      const s = el('div', 'wu-red');
      s.dataset.side = seg.side;
      s.style.left = `${seg.from * 100}%`;
      s.style.width = `${(seg.to - seg.from) * 100}%`;
      const why = limitReason(seg.limitId);
      s.title = why;
      v.reds.append(s);
      const chip = el('span', 'wu-chip');
      chip.append(el('i', 'wu-swatch'), document.createTextNode(why));
      v.chips.append(chip);
    }
  }

  /** Move the thumb to a requested value, stopping at the band edge. */
  function request(v: SliderView, requested: number) {
    const r = v.band ? clampToBand(requested, v.band) : { value: requested, blocked: null as null | 'low' | 'high', limitId: undefined };
    if (r.blocked) {
      pulse(v, r.blocked);
      showReason(v, limitReason(r.limitId));
    }
    if (r.value !== v.value) {
      v.value = r.value;
      setTarget(v.st, r.value, v.live, performance.now());
      paintThumb(v);
      bus.emit('control:set', { controlId: v.def.id, value: r.value });
    }
  }

  for (const def of controls) {
    const root = el('div', 'wu-slider');
    const head = el('div', 'wu-slider-head');
    const readout = el('span', 'wu-readout');
    head.append(el('span', 'wu-label', def.label), readout);
    const track = el('div', 'wu-track');
    const reds = el('div', 'wu-reds');
    const earth = el('div', 'wu-earth');
    earth.style.left = `${valueToFrac(def.default, def) * 100}%`;
    earth.title = `Earth: ${formatValue(def.default, def.unit)}`;
    earth.append(el('span', 'wu-earth-label', 'Earth'));
    const thumb = el('div', 'wu-thumb');
    thumb.tabIndex = 0;
    thumb.setAttribute('role', 'slider');
    thumb.setAttribute('aria-label', def.label);
    thumb.setAttribute('aria-valuemin', String(def.min));
    thumb.setAttribute('aria-valuemax', String(def.max));
    const ghost = el('div', 'wu-ghost');
    ghost.hidden = true;
    ghost.title = 'Where the planet is now, easing toward your setting';
    track.append(reds, earth, ghost, thumb);
    const chips = el('div', 'wu-chips');
    const reason = el('div', 'wu-reason');
    root.append(head, track, chips, reason, el('p', 'wu-hint', def.hint));
    sliderBox.append(root);

    const v: SliderView = { def, root, track, thumb, reds, chips, readout, reason, value: def.default, live: def.default, ghost, st: newTarget(def.default), band: null, dragging: false };
    views.set(def.id, v);
    paintThumb(v);

    const fromPointer = (e: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      request(v, fracToValue((e.clientX - rect.left) / rect.width, def));
    };
    track.addEventListener('pointerdown', (e) => {
      v.dragging = true;
      track.setPointerCapture(e.pointerId);
      fromPointer(e);
      e.preventDefault();
    });
    track.addEventListener('pointermove', (e) => { if (v.dragging) fromPointer(e); });
    const end = () => { v.dragging = false; };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
  }
  drawer.append(sliderBox);

  // --- years counter ---
  const years = el('div', 'wu-years');
  const yearsNum = el('strong', undefined, '0 years');
  years.append(el('span', undefined, 'Since formation: '), yearsNum, el('em', 'wu-tag', 'illustrative'));
  drawer.append(years);

  // --- stats ---
  const statsBox = el('section', 'wu-stats');
  const table = el('table', 'wu-table');
  const thead = el('thead');
  const hr = el('tr');
  for (const h of ['', world.displayName, 'Earth']) hr.append(el('th', undefined, h));
  thead.append(hr);
  const tbody = el('tbody');
  const statCells = new Map<string, HTMLElement>();
  for (const s of world.stats) {
    const tr = el('tr');
    const name = el('td', 'wu-stat-name');
    name.append(el('span', undefined, s.label));
    if (s.assumption) name.append(el('em', 'wu-tag', 'assumption'));
    if (s.id === 'pace') name.append(el('em', 'wu-tag', 'compressed in the time-lapse'));
    const now = el('td', 'wu-num', '–');
    statCells.set(s.id, now);
    tr.append(name, now, el('td', 'wu-num wu-dim', formatValue(s.earthValue, s.unit)));
    const why = el('tr', 'wu-why');
    const wc = el('td', undefined, s.why);
    wc.colSpan = 3;
    why.append(wc);
    tbody.append(tr, why);
  }
  for (const f of world.facts) {
    const tr = el('tr');
    const name = el('td', 'wu-stat-name');
    name.append(el('span', undefined, f.label));
    if (f.assumption) name.append(el('em', 'wu-tag', 'assumption'));
    tr.append(name, el('td', 'wu-num', f.value), el('td', 'wu-num wu-dim', f.earthValue));
    const why = el('tr', 'wu-why');
    const wc = el('td', undefined, f.why);
    wc.colSpan = 3;
    why.append(wc);
    tbody.append(tr, why);
  }
  table.append(thead, tbody);
  statsBox.append(el('h3', 'wu-h3', 'Stats'), table);
  drawer.append(statsBox);

  // --- silicon: reasoning chain and caveat ---
  if (speculative) {
    const sp = el('section', 'wu-reasoning');
    sp.append(el('h3', 'wu-h3', 'Why this world is like this'), el('em', 'wu-tag wu-spec', 'speculative'));
    const ol = el('ol');
    for (const step of world.reasoning) {
      const li = el('li', undefined, step.text);
      if (step.assumption) li.append(el('em', 'wu-tag', 'assumption'));
      ol.append(li);
    }
    sp.append(ol);
    if (world.caveat) {
      const c = el('p', 'wu-caveat');
      c.append(el('strong', undefined, 'The case against: '), document.createTextNode(world.caveat));
      sp.append(c);
    }
    drawer.append(sp);
  }

  const summaryBtn = el('button', 'wu-btn', 'Open summary card');
  summaryBtn.type = 'button';
  summaryBtn.addEventListener('click', onOpenSummary);
  drawer.append(summaryBtn);

  // --- live updates ---
  function update(s: SimSnapshot) {
    yearsNum.textContent = formatYears(s.yearsShown);
    for (const st of world.stats) {
      const n = statCells.get(st.id);
      const val = s.stats[st.id];
      if (n && val !== undefined) n.textContent = formatStat(st.id, val, st.unit);
    }
    for (const v of views.values()) {
      const b = s.bands[v.def.id];
      if (b) { v.band = b; paintBand(v); }
      const live = s.controls[v.def.id];
      if (live === undefined) continue;
      v.live = live;
      // The target stays while the live value eases toward it; the sim's own moves (drift, clamps) and idle time adopt it.
      if (!v.dragging && syncLive(v.st, live, performance.now())) v.value = v.st.target;
      paintThumb(v);
    }
  }

  const offs = [
    listen(bus, 'control:blocked', ({ controlId, limitId }) => {
      const v = views.get(controlId);
      if (!v) return;
      const side = v.band && !v.band.empty ? (v.value <= v.band.low ? 'low' : 'high') : 'all';
      pulse(v, side);
      showReason(v, limitReason(limitId));
    }),
  ];

  /** D-pad: up/down pick a slider, left/right move it. */
  function selectSlider(delta: number) {
    selected = (selected + delta + controls.length) % controls.length;
    controls.forEach((c, i) => views.get(c.id)?.root.classList.toggle('wu-selected', i === selected));
  }
  function setSelected(index: number) {
    selected = Math.max(0, Math.min(controls.length - 1, index));
    selectSlider(0);
  }
  function nudgeSelected(dir: number) {
    const v = views.get(controls[selected].id);
    if (v) request(v, nudgedValue(v.st, dir, v.def, STEP));
  }
  selectSlider(0);

  /**
   * Keyboard, like the gamepad D-pad: up/down choose a slider (and focus its thumb), left/right move it.
   * Tab is the game's Conditions toggle, so the arrows work wherever focus is while the panel is open.
   */
  function handleKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    switch (e.key) {
      case 'ArrowUp': selectSlider(-1); focusSelected(); return true;
      case 'ArrowDown': selectSlider(1); focusSelected(); return true;
      case 'ArrowLeft': nudgeSelected(-1); return true;
      case 'ArrowRight': nudgeSelected(1); return true;
      default: return false;
    }
  }
  function focusSelected() { views.get(controls[selected].id)?.thumb.focus({ preventScroll: true }); }

  return {
    handleKey,
    focusSelected,
    el: drawer,
    update,
    selectSlider,
    setSelected,
    nudgeSelected,
    dispose() { offs.forEach((f) => f()); drawer.remove(); },
  };
}
