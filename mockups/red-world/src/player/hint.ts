// Small unobtrusive controls hint (DOM), bottom-left. Fades out a few seconds after the first move.
import { PALETTE } from '../contracts';

export function createHint() {
  const el = document.createElement('div');
  el.textContent = 'click or press a key to explore · WASD move · drag look · scroll zoom · Shift run · F fly (Space up, C down)';
  const ink = '#' + PALETTE.ink.toString(16).padStart(6, '0');
  Object.assign(el.style, {
    position: 'fixed', left: '18px', bottom: '14px', font: '12px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.04em',
    color: ink, opacity: '0.55', pointerEvents: 'none', userSelect: 'none', transition: 'opacity 1.6s ease', zIndex: '2',
  } as CSSStyleDeclaration);
  document.body.appendChild(el);
  let state: 'waiting' | 'active' | 'gone' = 'waiting';
  return {
    /** Player took control: drop the "click to explore" lead-in. */
    activate() { if (state === 'waiting') { state = 'active'; el.textContent = el.textContent!.replace(/^click or press a key to explore · /, ''); } },
    /** First real move: fade out shortly after. */
    moved() { if (state !== 'active') return; state = 'gone'; setTimeout(() => { el.style.opacity = '0'; }, 2500); setTimeout(() => el.remove(), 4500); },
  };
}
