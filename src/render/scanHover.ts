// Scanner hover: finds the living thing under the mouse (or the gamepad reticle) at ~15 Hz with the picker's
// non-emitting resolve(), projects its world bounds to a screen rect every frame and publishes `inspect:hover`.
// Only creatures and producers lock; the sea, ground and sky never do. Read-only; no allocation per frame once locked.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { Bus } from '../bus';
import type { InspectTarget } from '../worlds/types';
import { inLock } from './lockHit';
import type { PickBounds, PickResult } from './pick';

const RESOLVE_EVERY = 1 / 15; // s
const MIN_SIZE = 28;          // px: a tiny plant still gets a visible lock
const GRACE = 0.25;           // s a creature lock survives with no hit
const STICKY_MARGIN = 12;     // px around the creature's rect in which the pointer keeps the lock
const CLICK_MARGIN = 16;      // px around a locked creature in which a click opens it even if the ray misses
const PAD = 4;                // px

type Life = Extract<InspectTarget, { kind: 'organism' | 'producer' }>;
type HoverPayload = { target: Life; rect: { x: number; y: number; width: number; height: number } };

export interface ScanHover {
  /** Which device drives the lock: the mouse position, or the screen centre. */
  setInputKind(kind: 'keyboard' | 'gamepad'): void;
  /** The locked creature if this click (client pixels, or 'reticle') lands inside its lock rect plus a margin, else null. */
  lockedCreatureAt(at: { x: number; y: number } | 'reticle'): { target: InspectTarget; at: { x: number; y: number } } | null;
  dispose(): void;
}

export function createScanHover(
  app: App,
  bus: Bus,
  pick: (at: { x: number; y: number } | 'reticle') => PickResult,
  locate: (id: number) => { x: number; y: number; z: number; radius: number } | null,
): ScanHover {
  const canvas = app.renderer.domElement;
  let kind: 'keyboard' | 'gamepad' = 'keyboard';
  let px = 0, py = 0, pointerIn = false, dragging = false;
  let grace = 0;
  let acc = RESOLVE_EVERY; // resolve on the first frame
  let payload: HoverPayload | null = null;
  let key = '';
  let bounds: PickBounds | null = null;
  let cr: DOMRect = canvas.getBoundingClientRect();
  const v = new THREE.Vector3(), right = new THREE.Vector3();

  const clear = () => {
    if (!payload) return;
    payload = null; key = ''; bounds = null;
    canvas.style.cursor = '';
    bus.emit('inspect:hover', null);
  };

  /** Project the bounds' vertical box into payload.rect. Returns false if it is behind the camera. */
  function project(b: PickBounds, rect: HoverPayload['rect']): boolean {
    const cam = app.camera;
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      const s = i & 1 ? 1 : -1, top = i & 2 ? b.height : 0;
      v.set(b.x + right.x * b.radius * s, b.y + top + right.y * b.radius * s, b.z + right.z * b.radius * s).project(cam);
      if (v.z > 1 || v.z < -1) return false;
      const sx = cr.left + (v.x * 0.5 + 0.5) * cr.width, sy = cr.top + (-v.y * 0.5 + 0.5) * cr.height;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
    let w = x1 - x0 + 2 * PAD, h = y1 - y0 + 2 * PAD;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    w = Math.max(MIN_SIZE, Math.min(w, cr.width)); h = Math.max(MIN_SIZE, Math.min(h, cr.height));
    rect.x = cx - w / 2; rect.y = cy - h / 2; rect.width = w; rect.height = h;
    return true;
  }

  const onMove = (e: PointerEvent) => {
    px = e.clientX; py = e.clientY; pointerIn = true;
    dragging = e.buttons !== 0;
    if (dragging) clear();
  };
  const onLeave = () => { pointerIn = false; clear(); };
  const onDown = () => { dragging = true; clear(); };
  const onUp = (e: PointerEvent) => { dragging = e.buttons !== 0; acc = RESOLVE_EVERY; };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);

  const off = app.registerFrameHook((dt) => {
    const active = kind === 'gamepad' || (pointerIn && !dragging);
    if (!active) { clear(); return; }
    acc += dt;
    if (acc >= RESOLVE_EVERY) {
      acc = 0;
      cr = canvas.getBoundingClientRect();
      const r = pick(kind === 'gamepad' ? 'reticle' : { x: px, y: py });
      const t = r.target;
      if ((t.kind === 'organism' || t.kind === 'producer') && r.bounds) {
        const k = t.kind === 'organism' ? `o${t.organismId}` : `p${t.cell}`;
        if (k !== key || !payload) {
          key = k;
          payload = { target: t, rect: { x: 0, y: 0, width: 0, height: 0 } };
          canvas.style.cursor = 'pointer';
        }
        bounds = r.bounds;
        grace = 0;
      } else if (payload && payload.target.kind === 'organism' && inLock(kind === 'gamepad' ? cr.left + cr.width / 2 : px, kind === 'gamepad' ? cr.top + cr.height / 2 : py, payload.rect, STICKY_MARGIN)) {
        grace = 0; // still on the creature's rect: a missed resolve on a small or moving body must not drop the lock
      } else if (payload && payload.target.kind === 'organism' && (grace += RESOLVE_EVERY) < GRACE) {
        // within the grace window: keep the lock
      } else clear();
    }
    if (!payload || !bounds) return;
    // creatures move: re-read the live position every frame (plants are static between rebuilds)
    if (payload.target.kind === 'organism') {
      const l = locate(payload.target.organismId);
      if (!l) { clear(); return; }
      bounds.x = l.x; bounds.y = l.y - l.radius; bounds.z = l.z; bounds.height = 2 * l.radius; bounds.radius = l.radius;
    }
    if (!project(bounds, payload.rect)) { clear(); return; }
    bus.emit('inspect:hover', payload);
  });

  return {
    lockedCreatureAt(at) {
      if (!payload || payload.target.kind !== 'organism') return null;
      const x = at === 'reticle' ? cr.left + cr.width / 2 : at.x, y = at === 'reticle' ? cr.top + cr.height / 2 : at.y;
      return inLock(x, y, payload.rect, CLICK_MARGIN) ? { target: payload.target, at: { x, y } } : null;
    },
    setInputKind(k) { kind = k; if (k === 'gamepad') acc = RESOLVE_EVERY; clear(); },
    dispose() {
      off();
      clear();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    },
  };
}
