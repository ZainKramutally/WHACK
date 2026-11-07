// In-world DOM UI. Mount once the world is generated; call dispose() to tear everything down.
//
// Consumes bus events: sim:snapshot, world:selected, build:life, control:blocked, guide:newForm,
//   inspect:open, inspect:close.
// Emits: control:set, inspect:window (card rect, or null), inspect:close.
import './ui.css';
import { mountCaptions } from './captions';
import { mountConditions } from './conditions';
import { controlList } from '../worlds/controls';
import { mountControlsHint } from './controlsHint';
import { el } from './dom';
import { mountFieldGuide } from './fieldGuide';
import { mountInspectCard } from './inspectCard';
import { mountSummaryCard } from './summaryCard';
import { listen, type UiBus } from './uiBus';
import type { ControlDef, SimSnapshot, WorldConfig } from '../worlds/types';

export type { UiBus } from './uiBus';

export interface WorldUIOptions {
  /** Slider definitions (worlds/controls.ts). Defaults to the CLAUDE.md table. */
  controls?: ControlDef[];
  /** The other world, for the "A carbon world" comparison column. Omit to show Earth only. */
  otherWorld?: WorldConfig;
  /**
   * The host owns keyboard/gamepad input (player/input.ts): the UI skips its own Tab/Esc handling and gamepad polling.
   * Drive it through the returned toggleConditions / close / selectSlider / nudgeSlider / setInputKind instead.
   */
  externalInput?: boolean;
}

type Panel = 'conditions' | 'guide';

export function mountWorldUI(root: HTMLElement, bus: UiBus, world: WorldConfig, opts: WorldUIOptions = {}) {
  const host = el('div', 'wu-root');
  host.dataset.world = world.id;
  root.append(host);

  const formNames = new Map<number, string>();
  const captions = mountCaptions(host, bus, world);
  const summary = mountSummaryCard(host, world);
  const conditions = mountConditions(bus, world, opts.controls ?? controlList, () => summary.toggle());
  const guide = mountFieldGuide(bus, formNames, (n) => { guideBadge.textContent = String(n); guideBadge.hidden = false; });
  const inspect = mountInspectCard(host, bus, world, opts.otherWorld, formNames);

  // Tabs: closed by default.
  const tabs = el('nav', 'wu-tabs');
  const guideBadge = el('span', 'wu-badge');
  guideBadge.hidden = true;
  const mkTab = (label: string, panel: Panel) => {
    const b = el('button', 'wu-tab', label);
    b.type = 'button';
    b.addEventListener('click', () => toggle(panel));
    return b;
  };
  const condTab = mkTab('Conditions', 'conditions');
  const guideTab = mkTab('Field guide', 'guide');
  guideTab.append(guideBadge);
  tabs.append(condTab, guideTab);
  host.append(tabs, conditions.el, guide.el);

  let open: Panel | null = null;
  let latest: SimSnapshot | null = null;
  function show(p: Panel | null) {
    open = p;
    conditions.el.classList.toggle('wu-open', p === 'conditions');
    guide.el.classList.toggle('wu-open', p === 'guide');
    condTab.classList.toggle('wu-active', p === 'conditions');
    if (p === 'conditions' && latest) conditions.update(latest);
    guideTab.classList.toggle('wu-active', p === 'guide');
  }
  const toggle = (p: Panel) => show(open === p ? null : p);

  /** Esc / B: close the topmost thing. */
  function closeTop() {
    if (inspect.isOpen()) inspect.close();
    else if (summary.isOpen()) summary.close();
    else if (open) show(null);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') { e.preventDefault(); toggle('conditions'); }
    else if (e.key === 'Escape') closeTop();
  };
  if (!opts.externalInput) window.addEventListener('keydown', onKey);

  const hint = mountControlsHint(host, {
    onY: () => toggle('conditions'),
    onB: closeTop,
    onDpad(dx, dy) {
      if (open !== 'conditions') { show('conditions'); return; }
      if (dy) conditions.selectSlider(dy);
      if (dx) conditions.nudgeSelected(dx);
    },
  }, { externalInput: opts.externalInput });

  const offSnap = listen(bus, 'sim:snapshot', (s) => {
    latest = s;
    inspect.update(s);
    summary.update(s);
    if (open === 'conditions') conditions.update(s); // closed most of the time; show() catches it up
  });

  return {
    /** Programmatic access for the host app (e.g. hide UI during the Generate transition). */
    captions,
    showCaption: captions.show,
    toggleConditions: () => toggle('conditions'),
    /** Esc / B: close the topmost card or panel. */
    close: closeTop,
    /** Gamepad D-pad: pick slider `index` (opens Conditions if closed). */
    selectSlider(index: number) {
      if (open !== 'conditions') show('conditions');
      conditions.setSelected(index);
    },
    /** Gamepad D-pad: move slider `index` by -1 or +1 step (opens Conditions if closed). */
    nudgeSlider(index: number, delta: -1 | 1) {
      if (open !== 'conditions') show('conditions');
      conditions.setSelected(index);
      conditions.nudgeSelected(delta);
    },
    /** Last-used input device, for the controls hint and the gamepad reticle. */
    setInputKind: hint.setMode,
    dispose() {
      offSnap();
      window.removeEventListener('keydown', onKey);
      hint.dispose();
      captions.dispose();
      conditions.dispose();
      guide.dispose();
      inspect.dispose();
      summary.dispose();
      host.remove();
    },
  };
}
