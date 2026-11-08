// Keyboard + mouse + gamepad → intents. Callbacks for discrete actions, poll() for continuous ones.
import { clamp, applyDeadZone, nextPadSprint, dragEnd, dragMove, dragStart, type DragState } from './logic';

export type InputKind = 'keyboard' | 'gamepad';

export interface InputCallbacks {
  /** Click without drag (client pixels) or gamepad A (reticle at screen centre). */
  onInspect?(at: { x: number; y: number } | 'reticle'): void;
  onToggleConditions?(): void;
  onClose?(): void;
  /** Gamepad D-pad left/right on the picked slider; delta is -1 or +1 (repeats while held). */
  onSliderNudge?(index: number, delta: -1 | 1): void;
  /** Gamepad D-pad up/down changed the picked slider. */
  onSliderSelect?(index: number): void;
  /** The most recently used input device changed (controls hint, reticle). */
  onLastUsedChange?(kind: InputKind): void;
}

export interface Intents {
  moveX: number;     // right +
  moveZ: number;     // forward +
  sprint: boolean;   // Shift held, or gamepad L3 toggled on (the controller ignores it while swimming)
  rise: number;      // up + / sink -  (swimming)
  jump: boolean;     // Space, pad X or RB held (the controller edge-detects; on land it jumps, in water `rise` applies)
  orbitYaw: number;  // radians this frame, camera yaw change
  orbitPitch: number; // radians this frame, + = camera higher
  zoom: number;      // log-distance change this frame: + out, - in (wheel, LT/RT)
}

export interface InputOptions {
  sliderCount?: number;
  mouseOrbitRadPerPx?: number;
  padOrbitRadPerSec?: number;
  deadZone?: number;
}

export interface InputHandle {
  poll(dt: number): Intents;
  readonly lastUsed: InputKind;
  readonly gamepadConnected: boolean;
  dispose(): void;
}

const GP = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, L3: 10, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
const REPEAT_DELAY = 0.35;
const REPEAT_EVERY = 0.09;

export function createInput(el: HTMLElement, cb: InputCallbacks = {}, opts: InputOptions = {}): InputHandle {
  const sliderCount = opts.sliderCount ?? 3;
  const mouseRad = opts.mouseOrbitRadPerPx ?? 0.005;
  const padRad = opts.padOrbitRadPerSec ?? 2.6;
  const dz = opts.deadZone ?? 0.18;

  let lastUsed: InputKind = 'keyboard';
  const setLast = (k: InputKind) => {
    if (k !== lastUsed) {
      lastUsed = k;
      cb.onLastUsedChange?.(k);
    }
  };

  // keyboard
  const keys = new Set<string>();
  const isTyping = (t: EventTarget | null) =>
    t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setLast('keyboard');
      if (!e.repeat) cb.onToggleConditions?.();
      return;
    }
    if (e.key === 'Escape') {
      setLast('keyboard');
      if (!e.repeat) cb.onClose?.();
      return;
    }
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.code;
    if (k === 'KeyW' || k === 'KeyA' || k === 'KeyS' || k === 'KeyD' || k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') {
      keys.add(k);
      setLast('keyboard');
      if (k === 'Space') e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => void keys.delete(e.code);
  const onBlur = () => keys.clear();

  // mouse: drag orbits, click inspects
  let drag: DragState | null = null;
  let lastPx = 0;
  let lastPy = 0;
  let orbitDx = 0;
  let orbitDy = 0;
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    drag = dragStart(e.clientX, e.clientY);
    lastPx = e.clientX;
    lastPy = e.clientY;
    setLast('keyboard');
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    drag = dragMove(drag, e.clientX, e.clientY);
    // Only orbit once the press is a drag, so a click never nudges the camera.
    if (drag.dragging) {
      orbitDx += e.clientX - lastPx;
      orbitDy += e.clientY - lastPy;
    }
    lastPx = e.clientX;
    lastPy = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!drag) return;
    const result = dragEnd(drag, e.clientX, e.clientY);
    drag = null;
    el.releasePointerCapture?.(e.pointerId);
    if (result === 'click') cb.onInspect?.({ x: e.clientX, y: e.clientY });
  };
  let wheelZoom = 0;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    wheelZoom += clamp(e.deltaY * unit, -400, 400) * 0.005;
  };
  const onPointerCancel = () => {
    drag = null;
  };

  // gamepad
  let connectedPad = false;
  const prev = new Array<boolean>(17).fill(false);
  let padSprint = false;
  let slider = 0;
  let heldDir: -1 | 0 | 1 = 0;
  let heldTime = 0;
  const onPadConnect = () => void (connectedPad = true);
  const onPadDisconnect = () => {
    connectedPad = !!findPad();
    prev.fill(false);
    heldDir = 0;
    if (!connectedPad && lastUsed === 'gamepad') setLast('keyboard');
  };
  function findPad(): Gamepad | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('gamepadconnected', onPadConnect);
  window.addEventListener('gamepaddisconnected', onPadDisconnect);

  function poll(dt: number): Intents {
    let moveX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let moveZ = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    let rise = (keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0);
    if (moveX !== 0 && moveZ !== 0) {
      moveX *= Math.SQRT1_2;
      moveZ *= Math.SQRT1_2;
    }
    // Mouse drag right turns the view right; drag down tilts the camera up (inverted-Y feel of a grab).
    let orbitYaw = -orbitDx * mouseRad;
    let orbitPitch = orbitDy * mouseRad;
    orbitDx = 0;
    orbitDy = 0;

    let jump = keys.has('Space');
    let zoom = wheelZoom;
    wheelZoom = 0;
    let sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const pad = findPad();
    connectedPad = !!pad;
    if (!pad) padSprint = false;
    if (pad) {
      const [lx, ly] = applyDeadZone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, dz);
      const [rx, ry] = applyDeadZone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, dz);
      const down = (i: number) => !!pad.buttons[i]?.pressed;
      const edge = (i: number) => down(i) && !prev[i];
      let used = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0;

      if (lx !== 0 || ly !== 0) {
        moveX = lx;
        moveZ = -ly; // stick up is negative
      }
      padSprint = nextPadSprint(padSprint, edge(GP.L3), lx !== 0 || ly !== 0);
      if (padSprint) sprint = true;
      orbitYaw += -rx * padRad * dt;
      orbitPitch += ry * padRad * dt;
      const padRise = (down(GP.RB) ? 1 : 0) - (down(GP.LB) ? 1 : 0);
      if (padRise !== 0) rise = padRise;
      jump = jump || down(GP.RB) || down(GP.X);

      zoom += ((pad.buttons[GP.LT]?.value ?? 0) - (pad.buttons[GP.RT]?.value ?? 0)) * 3.5 * dt;
      if (edge(GP.A)) cb.onInspect?.('reticle');
      if (edge(GP.B)) cb.onClose?.();
      if (edge(GP.Y)) cb.onToggleConditions?.();
      if (edge(GP.UP)) {
        slider = (slider + sliderCount - 1) % sliderCount;
        cb.onSliderSelect?.(slider);
      }
      if (edge(GP.DOWN)) {
        slider = (slider + 1) % sliderCount;
        cb.onSliderSelect?.(slider);
      }
      const dir: -1 | 0 | 1 = down(GP.RIGHT) ? 1 : down(GP.LEFT) ? -1 : 0;
      if (dir !== 0) {
        if (dir !== heldDir) {
          heldTime = 0;
          cb.onSliderNudge?.(slider, dir);
        } else {
          const before = heldTime;
          heldTime += dt;
          if (heldTime > REPEAT_DELAY) {
            const n = Math.floor((heldTime - REPEAT_DELAY) / REPEAT_EVERY) - Math.floor(Math.max(0, before - REPEAT_DELAY) / REPEAT_EVERY);
            for (let i = 0; i < Math.max(0, n); i++) cb.onSliderNudge?.(slider, dir);
          }
        }
      }
      heldDir = dir;

      for (let i = 0; i < prev.length; i++) {
        const p = down(i);
        if (p && !prev[i]) used = true;
        prev[i] = p;
      }
      if (used) setLast('gamepad');
    }
    return { moveX, moveZ, sprint, rise, jump, orbitYaw, orbitPitch, zoom };
  }

  return {
    poll,
    get lastUsed() {
      return lastUsed;
    },
    get gamepadConnected() {
      return connectedPad;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('gamepadconnected', onPadConnect);
      window.removeEventListener('gamepaddisconnected', onPadDisconnect);
    },
  };
}
