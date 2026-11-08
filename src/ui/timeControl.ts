// Time speed: a playback row (×1 ×2 ×4 ×8 ×16) in the Conditions panel, a HUD chip while above ×1, and [ / ] keys.
// Available only after the build; during it the row is disabled ("after the build"). Not a condition: the three-sliders rule holds.
import { el } from './dom';
import { listen, type UiBus } from './uiBus';
import { TIME_FACTORS } from '../worlds/time';

/** The factor one step up or down from `cur`, clamped to the ends. */
export function stepFactor(cur: number, dir: -1 | 1): number {
  const i = Math.max(0, TIME_FACTORS.findIndex((f) => f >= cur));
  return TIME_FACTORS[Math.min(TIME_FACTORS.length - 1, Math.max(0, i + dir))]!;
}

export function mountTimeControl(bus: UiBus) {
  const row = el('section', 'wu-time');
  const head = el('div', 'wu-time-head');
  const note = el('span', 'wu-time-note', 'after the build');
  head.append(el('span', 'wu-time-label', 'Time'), note);
  const btns = el('div', 'wu-time-btns');
  const buttons = TIME_FACTORS.map((f) => {
    const b = el('button', 'wu-time-btn', `×${f}`);
    b.type = 'button';
    b.addEventListener('click', () => set(f));
    btns.append(b);
    return b;
  });
  row.append(head, btns);
  const chip = el('div', 'wu-time-chip');
  chip.hidden = true;

  let enabled = false;
  let factor = 1;

  function paint() {
    note.hidden = enabled;
    buttons.forEach((b, i) => {
      b.disabled = !enabled;
      b.classList.toggle('wu-on', TIME_FACTORS[i] === factor);
    });
    chip.hidden = !(enabled && factor > 1);
    chip.textContent = `⏩ ×${factor}`;
  }
  function set(f: number) {
    if (!enabled || f === factor) return;
    factor = f;
    paint();
    bus.emit('time:set', { factor: f });
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if (e.key === '[') set(stepFactor(factor, -1));
    else if (e.key === ']') set(stepFactor(factor, 1));
  };
  window.addEventListener('keydown', onKey);
  const offs = [
    listen(bus, 'build:complete', () => { enabled = true; paint(); }),
    // A snapshot also tells us (the UI may mount after build:complete) and carries the live factor.
    listen(bus, 'sim:snapshot', (s) => {
      const en = s.buildProgress >= 1;
      const f = s.timeFactor ?? 1;
      if (en !== enabled || f !== factor) { enabled = en; factor = f; paint(); }
    }),
    () => window.removeEventListener('keydown', onKey),
  ];
  paint();
  return { el: row, chip, dispose() { offs.forEach((f) => f()); row.remove(); chip.remove(); } };
}
