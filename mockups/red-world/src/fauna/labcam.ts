// Free camera for the fauna lab: OrbitControls (orbit / wheel zoom / right- or shift-drag pan, damped) around a target
// that WASD/arrows + Q/E move (Shift ×3), 1–9/0 ease to creature N, and F makes follow the selected creature.
// A small fading hint lists the keys. The lab only creates it for live views (never for captures).
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface LabCamOpts {
  camera: any;
  dom: HTMLElement;
  target: [number, number, number];             // initial orbit target (the default framing's look-at point)
  creatures: number;                            // selectable creatures (variant indices 0..n-1)
  centreOf: (i: number) => number[] | null;     // live centre of creature i (null if not in this view)
  select?: number;                              // initially selected creature
  follow?: boolean;                             // start in follow mode
  autoRotate?: number;                          // rad/s, until the user touches the camera
}

export function createLabCam(o: LabCamOpts) {
  const c = new OrbitControls(o.camera, o.dom);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.screenSpacePanning = true;
  c.target.set(...o.target);
  if (o.autoRotate) { c.autoRotate = true; c.autoRotateSpeed = (o.autoRotate * 60) / (2 * Math.PI); }
  c.addEventListener('start', () => { c.autoRotate = false; });
  c.update();

  let sel = o.select ?? 0;
  let follow = !!o.follow;
  let ease: { from: any; to: any; t: number } | null = null;
  const keys = new Set<string>();
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();

  const hint = document.createElement('div');
  hint.textContent = 'drag orbit · wheel zoom · right/shift-drag pan · WASD/arrows move · Q/E down/up · Shift ×3 · 1–9,0 creature · F follow · H hint';
  Object.assign(hint.style, {
    position: 'fixed', left: '8px', bottom: '6px', font: '12px ui-monospace, monospace', color: '#22060f',
    background: 'rgba(253,233,226,0.75)', padding: '3px 6px', transition: 'opacity 1.2s', opacity: '1', pointerEvents: 'none',
  });
  document.body.appendChild(hint);
  let hintT = 6;
  const showHint = (s = 4) => { hintT = s; hint.style.opacity = '1'; };

  /** Shift the target (and the camera with it, so the framing is kept) by d. */
  const shift = (d: any) => { c.target.add(d); o.camera.position.add(d); };

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(e.code);
    if (k === 'f') { follow = !follow; showHint(2); hint.textContent = `follow ${follow ? 'on' : 'off'} · creature ${sel + 1 === 10 ? 0 : sel + 1}`; setTimeout(() => (hint.textContent = HINT), 1500); }
    if (k === 'h') showHint(6);
    const n = '1234567890'.indexOf(e.key);
    if (n >= 0 && n < o.creatures && o.centreOf(n)) {
      sel = n;
      const to = new THREE.Vector3(...(o.centreOf(n) as [number, number, number]));
      ease = { from: c.target.clone(), to, t: 0 };
      c.autoRotate = false;
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const HINT = hint.textContent;

  function update(dt: number) {
    // keyboard travel, relative to the camera's horizontal heading, scaled by the viewing distance
    const fast = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1;
    const dist = o.camera.position.distanceTo(c.target);
    const sp = Math.max(2, dist * 0.6) * fast * dt;
    o.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, o.camera.up).normalize();
    tmp.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) tmp.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) tmp.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) tmp.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) tmp.sub(right);
    if (keys.has('KeyE')) tmp.y += 1;
    if (keys.has('KeyQ')) tmp.y -= 1;
    if (tmp.lengthSq() > 0) { ease = null; c.autoRotate = false; shift(tmp.normalize().multiplyScalar(sp)); }
    // eased jump to a creature, then (optionally) follow it
    if (ease) {
      ease.t = Math.min(1, ease.t + dt / 0.7);
      const live = o.centreOf(sel);
      if (live) ease.to.set(live[0], live[1], live[2]);
      const e = ease.t * ease.t * (3 - 2 * ease.t);
      const want = ease.from.clone().lerp(ease.to, e);
      shift(want.sub(c.target));
      if (ease.t >= 1) ease = null;
    } else if (follow) {
      const live = o.centreOf(sel);
      if (live) shift(tmp.set(live[0], live[1], live[2]).sub(c.target));
    }
    c.update(dt);
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hint.style.opacity = '0'; }
  }
  return { controls: c, update };
}
