// World controller: renderer + scene + lights + sky + fog + post + camera + morph + modules.
// Travel = dispose/rebuild modules for another preset behind a fade. Rewrite = morph dials live.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { Dials, Preset, WorldContext, WorldModule, WorldUniforms } from '../contracts';
import { PRESETS, presetById } from '../presets';
import { derive, hexToLinear } from '../derive';
import { createUniforms, applyDerived } from './uniforms';
import { createMaterialFactory } from './materials';
import { createSkyNode } from './sky';
import { createFogNode } from './fog';
import { createPost } from './post';
import { CameraRig } from './camera';
import { Morph, cloneDials } from './morph';
import { createFigure } from './figure';
import { createTestGeo } from './testgeo';
import { makeRng } from './rng';
import landforms from '../landforms';
import flora from '../flora';

export interface Flags { capture: boolean; testgeo: boolean; nofigure: boolean; debug: boolean; stats: boolean; orbit: boolean }
export const parseFlags = (): Flags => {
  const tok = new Set(location.hash.slice(1).split(/[&,#]/).filter(Boolean));
  return { capture: tok.has('capture'), testgeo: tok.has('testgeo'), nofigure: tok.has('nofigure'), debug: tok.has('debug'), stats: tok.has('stats'), orbit: tok.has('orbit') };
};

export class World {
  renderer: any; scene: any; camera: any;
  uniforms: WorldUniforms = createUniforms();
  materials = createMaterialFactory(this.uniforms);
  morph!: Morph;
  rig!: CameraRig;
  post!: ReturnType<typeof createPost>;
  ctx!: WorldContext;
  preset!: Preset;
  modules: WorldModule[] = [];
  quality: 'low' | 'high';
  elapsed = 0;
  frozen = false; // capture: after the settle window, motion is frozen
  frames = 0;
  onDerived?: () => void;
  onPreset?: () => void;
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  private fogDensity = uniform(0.005);
  private extras: { update?(): void; dispose(): void }[] = [];
  private building = false;

  constructor(public flags: Flags, quality: 'low' | 'high', private stage: HTMLElement, private fadeEl: HTMLElement) {
    this.quality = quality;
  }

  async init(presetId: Preset['id']) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    await this.renderer.init();
    this.stage.appendChild(this.renderer.domElement);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    this.rig = new CameraRig(this.camera, this.renderer.domElement, this.renderer, this.stage);
    this.scene.fogNode = createFogNode(this.uniforms, this.fogDensity);

    const sh = this.sun.shadow;
    sh.mapSize.set(this.quality === 'low' ? 1024 : 2048, this.quality === 'low' ? 1024 : 2048);
    sh.camera.left = -75; sh.camera.right = 75; sh.camera.top = 75; sh.camera.bottom = -75;
    sh.camera.near = 1; sh.camera.far = 700;
    sh.bias = -0.0004; sh.normalBias = 0.05;
    this.sun.castShadow = true;

    this.post = createPost(this.renderer, this.scene, this.camera);
    await this.load(presetId, true);
    addEventListener('resize', () => this.rig.layout(this.quality));
    addEventListener('keydown', (e) => { if (e.key === 'o' || e.key === 'O') this.rig.toggle(); });
    if (this.flags.orbit) this.rig.setMode('orbit');
  }

  /** Build (or rebuild) a preset. Dials snap to the preset's own dials. */
  private async build(preset: Preset) {
    this.preset = preset;
    this.scene.clear();
    this.scene.add(this.sun, this.sun.target, this.hemi);
    const comp = preset.composition;
    this.sun.position.set(...comp.sunDir);
    this.morph = this.morph ?? new Morph(preset.dials);
    this.morph.reset(preset.dials);
    const derived = derive(this.morph.current, PRESETS);
    applyDerived(this.uniforms, derived, this.morph.current);
    this.fogDensity.value = derived.fogDensity;
    this.scene.backgroundNode = createSkyNode(this.uniforms, comp);
    this.rig.setComposition(comp);
    this.rig.layout(this.quality);

    this.ctx = {
      scene: this.scene, camera: this.camera, renderer: this.renderer, preset, derived,
      uniforms: this.uniforms, materials: this.materials, quality: this.quality,
      terrainHeight: () => 0, rng: makeRng(preset.dials.seed),
    };
    this.modules = [landforms(), flora()];
    for (const m of this.modules) await m.build(this.ctx);
    if (this.flags.testgeo) this.extras.push(createTestGeo(this.ctx));
    if (!this.flags.nofigure) { const f = createFigure(this.ctx); if (f) this.extras.push(f); }
    this.updateLights(derived);
    this.onDerived?.();
    this.onPreset?.();
    this.elapsed = 0; this.frozen = false; this.frames = 0; (window as any).__ready = false;
  }

  private teardown() {
    for (const m of this.modules) { try { m.dispose(); } catch (e) { console.error(e); } }
    for (const x of this.extras) x.dispose();
    this.modules = []; this.extras = [];
  }

  private async load(id: Preset['id'], first = false) {
    if (this.building) return;
    this.building = true;
    try {
      if (!first) { this.fadeEl.style.opacity = '1'; await new Promise((r) => setTimeout(r, 380)); this.teardown(); }
      await this.build(presetById(id));
      if (!first) { await new Promise((r) => requestAnimationFrame(() => r(0))); this.fadeEl.style.opacity = '0'; }
      history.replaceState(null, '', `?preset=${id}${location.hash}`);
    } finally { this.building = false; }
  }

  /** Travel: new place behind a short fade. */
  travel(id: Preset['id']) { return this.load(id); }

  /** Rewrite: morph the current place to new dials over ~3s. */
  rewrite(d: Dials, dur = 3) { this.morph.setTarget(d, dur); }

  private updateLights(d = this.ctx.derived) {
    const p = d.palette;
    const c = (hex: number) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
    // sun: warm-neutral key from the haze colour; fill: sky (top) over ground bounce
    this.sun.color.copy(c(p.haze)).lerp(new THREE.Color(1, 0.97, 0.92), 0.55);
    this.sun.intensity = Math.PI * 0.85;
    // fill = shadow hue lifted to a mid luminance (keeps its chroma), a little sky mixed in
    const sh = c(p.shadow);
    const lum = Math.max(0.004, 0.2126 * sh.r + 0.7152 * sh.g + 0.0722 * sh.b);
    sh.multiplyScalar(Math.min(12, 0.3 / lum));
    this.hemi.color.copy(sh).lerp(c(p.skyHorizon), 0.3);
    this.hemi.groundColor.copy(c(p.ground)).lerp(this.hemi.color, 0.5);
    this.hemi.intensity = Math.PI * 0.65;
    const [r, g, b] = hexToLinear(p.skyHorizon);
    this.post.setPalette(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }

  private fitShadow() {
    const f = new THREE.Vector3(); this.camera.getWorldDirection(f); f.y = 0; f.normalize();
    const focus = this.camera.position.clone().addScaledVector(f, 55); focus.y = 0;
    const dir = new THREE.Vector3(...this.preset.composition.sunDir).normalize();
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(dir, 300);
    this.sun.target.updateMatrixWorld();
  }

  frame(rawDt: number) {
    const dt = Math.min(0.05, rawDt);
    this.frames++;
    let mdt = dt;
    if (this.flags.capture) {
      this.elapsed += dt;
      if (this.elapsed > 1.5) this.frozen = true;
      mdt = this.frozen ? 0 : dt;
      this.uniforms.time.value = 12;
    } else {
      this.uniforms.time.value += dt;
    }
    if (this.morph.update(mdt)) {
      Object.assign(this.ctx.derived, derive(this.morph.current, PRESETS));
      applyDerived(this.uniforms, this.ctx.derived, this.morph.current);
      this.fogDensity.value = this.ctx.derived.fogDensity;
      this.updateLights();
      this.onDerived?.();
    }
    this.rig.update(this.uniforms.time.value, dt, !this.flags.capture);
    this.fitShadow();
    for (const m of this.modules) m.update?.(this.ctx, mdt);
    for (const x of this.extras) x.update?.();
    this.post.setGrainTime(this.flags.capture ? 0 : this.uniforms.time.value);
    this.post.render();
    if (this.flags.capture && this.frozen && this.frames > 20) (window as any).__ready = true;
    else if (!this.flags.capture && this.frames === 30) (window as any).__ready = true;
  }
}
