// Keyboard + mouse-drag + wheel input. Polled each frame by the controller; `onFirst` fires on the first click or key.
export interface InputState {
  forward: number; right: number; up: number;  // -1..1 axes
  run: boolean;
  lookDX: number; lookDY: number;               // accumulated drag pixels since the last poll
  zoom: number;                                 // accumulated wheel steps since the last poll
  flyToggles: number;                           // F presses since the last poll
}

const KEYS = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  up: ['Space'], down: ['KeyC', 'ControlLeft', 'ControlRight'], run: ['ShiftLeft', 'ShiftRight'],
};
const ALL = new Set(Object.values(KEYS).flat());

export function createInput(el: HTMLElement, onFirst: () => void) {
  const down = new Set<string>();
  let dx = 0, dy = 0, zoom = 0, fly = 0, first = false, dragging = false, lastX = 0, lastY = 0;
  const kick = () => { if (!first) { first = true; onFirst(); } };

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.altKey) return;
    if (ALL.has(e.code) || e.code === 'KeyF') e.preventDefault();
    if (e.code === 'KeyF' && !e.repeat) fly++;
    down.add(e.code);
    kick();
  });
  addEventListener('keyup', (e) => { down.delete(e.code); });
  addEventListener('blur', () => down.clear());

  el.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    kick();
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx += e.clientX - lastX; dy += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
  });
  const up = (e: PointerEvent) => { dragging = false; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); zoom += Math.sign(e.deltaY) * Math.min(3, Math.abs(e.deltaY) / 100 || 1); kick(); }, { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  const any = (codes: string[]) => codes.some((c) => down.has(c));
  const axis = (pos: string[], neg: string[]) => (any(pos) ? 1 : 0) - (any(neg) ? 1 : 0);

  return {
    poll(): InputState {
      const s: InputState = {
        forward: axis(KEYS.fwd, KEYS.back), right: axis(KEYS.right, KEYS.left), up: axis(KEYS.up, KEYS.down),
        run: any(KEYS.run), lookDX: dx, lookDY: dy, zoom, flyToggles: fly,
      };
      dx = dy = zoom = 0; fly = 0;
      return s;
    },
  };
}
