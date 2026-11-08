// Fading hint for whichever input was used last, a centre reticle while the gamepad is in use,
// and gamepad button polling for the UI (Y: Conditions, B: close, D-pad: sliders).
import { el } from './dom';

const HINT_MS = 6000;
const DEADZONE = 0.2;
const REPEAT_MS = 120;

const TEXT = {
  keyboard: 'WASD move · Shift sprint · drag to look · click to inspect · Space / Shift swim (in water) · Tab conditions',
  gamepad: 'Left stick move · L3 sprint · right stick look · A inspect · B close · Y conditions · D-pad sliders',
};

export interface HintCallbacks {
  onY(): void;
  onB(): void;
  onDpad(dx: number, dy: number): void;
}

export interface HintOptions {
  /** The host owns gamepad input (player/input.ts): skip our own polling and drive the mode via setMode(). */
  externalInput?: boolean;
}

export function mountControlsHint(root: HTMLElement, cb: HintCallbacks, opts: HintOptions = {}) {
  const hint = el('div', 'wu-hint-bar');
  const reticle = el('div', 'wu-reticle');
  reticle.hidden = true;
  root.append(hint, reticle);

  let mode: 'keyboard' | 'gamepad' = 'keyboard';
  let timer: ReturnType<typeof setTimeout> | undefined;

  function showHint() {
    hint.textContent = TEXT[mode];
    hint.classList.add('wu-on');
    clearTimeout(timer);
    timer = setTimeout(() => hint.classList.remove('wu-on'), HINT_MS);
  }
  function setMode(m: typeof mode) {
    if (m === mode && hint.textContent) return;
    mode = m;
    reticle.hidden = m !== 'gamepad';
    showHint();
  }

  const onKey = () => setMode('keyboard');
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onKey);
  window.addEventListener('pointermove', onKey);
  showHint();

  // Gamepad polling: edge-detected buttons, D-pad repeats while held.
  let raf = 0;
  let prev: boolean[] = [];
  let lastRepeat = 0;
  function poll(now: number) {
    raf = requestAnimationFrame(poll);
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p): p is Gamepad => !!p);
    if (!pad) return;
    const b = pad.buttons.map((x) => x.pressed);
    const edge = (i: number) => b[i] && !prev[i];
    const sticks = pad.axes.some((a) => Math.abs(a) > DEADZONE);
    if (b.some(Boolean) || sticks) setMode('gamepad');
    if (edge(3)) cb.onY();
    if (edge(1)) cb.onB();
    const dx = (b[15] ? 1 : 0) - (b[14] ? 1 : 0);
    const dy = (b[13] ? 1 : 0) - (b[12] ? 1 : 0);
    if (dx || dy) {
      const fresh = edge(12) || edge(13) || edge(14) || edge(15);
      if (fresh || now - lastRepeat > REPEAT_MS) {
        lastRepeat = now;
        cb.onDpad(dx, dy);
      }
    }
    prev = b;
  }
  if (!opts.externalInput) raf = requestAnimationFrame(poll);

  return {
    setMode,
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onKey);
      window.removeEventListener('pointermove', onKey);
      hint.remove();
      reticle.remove();
    },
  };
}
