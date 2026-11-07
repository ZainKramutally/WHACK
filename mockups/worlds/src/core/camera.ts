// Camera rig: pin view (locked to the preset + 0.05 m breathing drift, letterboxed to the pin aspect) or orbit.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Composition } from '../contracts';

export class CameraRig {
  mode: 'pin' | 'orbit' = 'pin';
  controls: any;
  private base = new THREE.Vector3();
  private target = new THREE.Vector3();
  private comp!: Composition;

  constructor(public camera: any, private dom: HTMLElement, private renderer: any, private stage: HTMLElement) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
  }

  setComposition(c: Composition) {
    this.comp = c;
    this.base.set(...c.camera.position);
    this.target.set(...c.camera.target);
    this.camera.fov = c.camera.fov;
    this.camera.position.copy(this.base);
    this.camera.lookAt(this.target);
    this.controls.target.copy(this.target);
    this.layout();
  }

  setMode(m: 'pin' | 'orbit') {
    if (m === this.mode) return;
    this.mode = m;
    this.controls.enabled = m === 'orbit';
    if (m === 'pin') { this.camera.position.copy(this.base); this.camera.lookAt(this.target); this.controls.target.copy(this.target); }
    this.layout();
  }

  toggle() { this.setMode(this.mode === 'pin' ? 'orbit' : 'pin'); }

  /** Size the canvas: pin view letterboxes to the pin aspect, orbit fills the window. */
  layout(quality: 'low' | 'high' = 'high') {
    const w = innerWidth, h = innerHeight;
    const a = this.mode === 'pin' ? this.comp.aspect : w / h;
    const cw = Math.floor(Math.min(w, h * a)), ch = Math.floor(cw / a);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * (quality === 'low' ? 0.5 : 1));
    this.renderer.setSize(cw, ch);
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  update(t: number, dt: number, drift: boolean) {
    if (this.mode === 'orbit') { this.controls.update(dt); return; }
    const k = drift ? 1 : 0;
    this.camera.position.set(
      this.base.x + Math.sin(t * 0.37) * 0.03 * k,
      this.base.y + Math.sin(t * 0.51 + 1.3) * 0.02 * k,
      this.base.z + Math.sin(t * 0.29 + 0.7) * 0.03 * k,
    );
    this.camera.lookAt(this.target);
  }
}
