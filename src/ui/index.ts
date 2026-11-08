// In-world DOM UI. Mount once the world is generated; call dispose() to tear everything down.
//
// Consumes bus events: sim:snapshot, world:selected, build:life, control:blocked, inspect:open, inspect:close.
// (guide:newForm is no longer shown: kinds enter the bestiary when the player finds them.)
// Emits: control:set, inspect:window (card rect, or null), inspect:close.
import './ui.css';
import { mountCaptions } from './captions';
import { mountConditions } from './conditions';
import { controlList } from '../worlds/controls';
import { mountControlsHint } from './controlsHint';
import { el } from './dom';
import { mountBestiary } from './bestiaryPanel';
import { mountInspectCard } from './inspectCard';
import { mountLifeRegistry } from './lifeRegistry';
import { replayUrl } from '../seed';
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
  /** This run's seed, shown small in the Conditions panel with a link that replays it. */
  seed?: number;
  /** Whether a flora cell is under the sea (render/floraForm cellSubmerged), so the producer card names the form the world draws. */
  floraSubmerged?: (cell: number) => boolean;
}

type Panel = 'conditions' | 'bestiary';

export function mountWorldUI(root: HTMLElement, bus: UiBus, world: WorldConfig, opts: WorldUIOptions = {}) {
  const host = el('div', 'wu-root');
  host.dataset.world = world.id;
  root.append(host);

  const registry = mountLifeRegistry(bus);
  const captions = mountCaptions(host, bus, world, opts.controls ?? controlList);
  const summary = mountSummaryCard(host, world, registry);
  const conditions = mountConditions(bus, world, opts.controls ?? controlList, () => summary.toggle());
  const bestiaryBadge = el('span', 'wu-badge'); // declared before mountBestiary, which reports counts as it mounts
  bestiaryBadge.hidden = true;
  const bestiary = mountBestiary(host, bus, world, registry, (found, total) => {
    bestiaryBadge.textContent = `${found}/${total}`;
    bestiaryBadge.hidden = total === 0;
  });
  const inspect = mountInspectCard(host, bus, world, opts.otherWorld, registry, opts.floraSubmerged);
  const offFind = registry.onDiscover((name) => captions.show(`New entry: ${name}`));

  // Tabs: closed by default.
  const tabs = el('nav', 'wu-tabs');
  const mkTab = (label: string, panel: Panel) => {
    const b = el('button', 'wu-tab', label);
    b.type = 'button';
    b.addEventListener('click', () => toggle(panel));
    return b;
  };
  const condTab = mkTab('Conditions', 'conditions');
  const bestiaryTab = mkTab('Bestiary', 'bestiary');
  bestiaryTab.append(bestiaryBadge);
  tabs.append(condTab, bestiaryTab);
  if (opts.seed !== undefined) {
    const seedLine = el('p', 'wu-seed', `Seed ${opts.seed} · `);
    const copy = el('button', 'wu-link', 'Copy link');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      const url = replayUrl(location.href, world.id, opts.seed!);
      void navigator.clipboard?.writeText(url).catch(() => undefined);
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
    });
    seedLine.append(copy);
    conditions.el.append(seedLine);
  }
  host.append(tabs, conditions.el, bestiary.el);

  let open: Panel | null = null;
  let latest: SimSnapshot | null = null;
  function show(p: Panel | null) {
    open = p;
    conditions.el.classList.toggle('wu-open', p === 'conditions');
    bestiary.el.classList.toggle('wu-open', p === 'bestiary');
    bestiary.setOpen(p === 'bestiary');
    condTab.classList.toggle('wu-active', p === 'conditions');
    if (p === 'conditions') { if (latest) conditions.update(latest); conditions.focusSelected(); }
    bestiaryTab.classList.toggle('wu-active', p === 'bestiary');
    if (p !== 'conditions' && conditions.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }
  const toggle = (p: Panel) => show(open === p ? null : p);

  /** Esc / B: close the topmost thing. */
  function closeTop() {
    if (inspect.isOpen()) inspect.close();
    else if (bestiary.pageOpen()) bestiary.closePage();
    else if (summary.isOpen()) summary.close();
    else if (open) show(null);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') { e.preventDefault(); toggle('conditions'); }
    else if (e.key === 'Escape') closeTop();
  };
  if (!opts.externalInput) window.addEventListener('keydown', onKey);
  // Arrow keys work the sliders while Conditions is open (Tab is the panel toggle, so focus cannot be tabbed into it).
  const onArrows = (e: KeyboardEvent) => {
    if (open !== 'conditions' || (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if (conditions.handleKey(e)) e.preventDefault();
  };
  window.addEventListener('keydown', onArrows);

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
      window.removeEventListener('keydown', onArrows);
      hint.dispose();
      captions.dispose();
      conditions.dispose();
      offFind();
      bestiary.dispose();
      inspect.dispose();
      summary.dispose();
      registry.dispose();
      host.remove();
    },
  };
}
