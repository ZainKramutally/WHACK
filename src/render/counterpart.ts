// The inspect card's 3D window: while the UI holds an `inspect:window` rect, draw a small scissored viewport of the
// inspected thing, turning slowly. Organisms: the creature itself, built from its own cached BodyPlan as beads (never
// another chemistry's rebuild). Sea/ground/sky/producer: this world's swatch, or the other world's via the toggle.
// Runs only while the window is set. Draws after the main scene render (it wraps renderer.render).
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { Bus } from '../bus';
import type { BusEvents, InspectTarget, VisualInputs, WorldConfig, WorldId } from '../worlds/types';
import type { DevelopInputs } from '../sim/develop';
import { gasDensity } from '../sim/models';
import { beadLayout } from './layout';
import { creatureColour, floraColours, groundColour, mixHex, seaStyle, skyStyle, type Tone } from './palette';

export interface CounterpartPart {
  /** Resolves when the swatch materials are compiled (never rejects). */
  ready: Promise<void>;
  update(dt: number, t: number, inputs: VisualInputs): void;
  dispose(): void;
}

export interface CounterpartDeps {
  app: App;
  bus: Bus;
  /** Config of a world by id (the other world is looked up from here). */
  worldFor: (id: WorldId) => WorldConfig;
  getInputs: () => VisualInputs;
  /** Bead layout of a creature as it lives in this world (from its BodyPlan), for the default 'self' view. */
  layoutOf?: (id: number) => { layout: ReturnType<typeof beadLayout>; silicon: boolean; diet: number } | null;
}

const mid = (w: WorldConfig, key: string, fallback: number): number => {
  const r = w.targets[key] ?? w.ranges[key];
  return r ? (r[0] + r[1]) / 2 : fallback;
};


export function developInputsFor(w: WorldConfig): DevelopInputs {
  const i = w.life.inputs;
  const rho = gasDensity(mid(w, 'pressure', 1), mid(w, 'temperature', 15), i.airDensity.molarMass);
  return { solvent: i.solvent, airDensity: rho * i.airDensity.scale, tissueDensity: i.tissueDensity };
}

export function createCounterpart(deps: CounterpartDeps): CounterpartPart {
  const { app, bus } = deps;
  const r = app.renderer;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  cam.position.set(0, 1.1, 3.4);
  cam.lookAt(0, 0.45, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 2);
  scene.add(key);

  const turntable = new THREE.Group();
  scene.add(turntable);
  let backdrop: THREE.Mesh | null = null;

  let rect: { x: number; y: number; width: number; height: number } | null = null;
  let mode: 'self' | 'other' = 'self';
  let target: InspectTarget | null = null;
  let builtFor = '';
  const disposables: { dispose(): void }[] = [];

  const clearContent = () => {
    turntable.clear();
    for (const d of disposables.splice(0)) d.dispose();
  };

  // Materials are cached for the life of the view (building a node material is the slow part of opening a card).
  const matCache = new Map<string, THREE.Material>();
  const mat = (hex: number, o: { flat?: boolean; rough?: number; opacity?: number } = {}) => {
    const key = `${hex}|${o.flat ? 1 : 0}|${o.rough ?? 0.6}|${o.opacity ?? 1}`;
    let m = matCache.get(key) as THREE.MeshStandardNodeMaterial | undefined;
    if (!m) {
      m = new THREE.MeshStandardNodeMaterial({ color: hex, roughness: o.rough ?? 0.6, flatShading: !!o.flat });
      if (o.opacity !== undefined && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
      matCache.set(key, m);
    }
    return m;
  };
  const basicMat = (hex: number) => {
    const key = `basic|${hex}`;
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshBasicNodeMaterial({ color: hex, fog: false }); matCache.set(key, m); }
    return m;
  };
  // One white material per chemistry for beads; per-bead colour comes from instanceColor.
  const beadMat = {
    round: new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }),
    faceted: new THREE.MeshStandardNodeMaterial({ roughness: 0.35, flatShading: true }),
  };
  const beadGeo = { round: new THREE.SphereGeometry(1, 12, 8), faceted: new THREE.IcosahedronGeometry(1, 0) };
  const geo = <T extends THREE.BufferGeometry>(g: T): T => { disposables.push(g); return g; };

  const backdrops = new Map<string, THREE.Mesh>();
  function backdropFor(other: WorldConfig): THREE.Mesh {
    let m = backdrops.get(other.id);
    if (!m) {
      const sky = skyStyle(other.starType, mid(other, 'light', 1), mid(other, 'pressure', 1), mid(other, 'temperature', 15));
      const g = new THREE.SphereGeometry(40, 24, 16);
      const pos = g.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, pos.getY(i) / 40));
        c.setHex(mixHex(sky.horizon, sky.zenith, Math.sqrt(t)));
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      m = new THREE.Mesh(g, new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
      backdrops.set(other.id, m);
    }
    return m;
  }
  function setBackdrop(other: WorldConfig) {
    if (backdrop) scene.remove(backdrop);
    backdrop = backdropFor(other);
    scene.add(backdrop);
    const sky = skyStyle(other.starType, mid(other, 'light', 1), mid(other, 'pressure', 1), mid(other, 'temperature', 15));
    key.color.setHex(sky.starColour);
    key.intensity = 0.8 + 1.8 * sky.brightness;
  }

  /** One InstancedMesh for all beads of a layout, framed so the whole body fills a window of this aspect. */
  function beadsContent(lay: ReturnType<typeof beadLayout>, silicon: boolean, diet: number, aspect: number) {
    const mesh = new THREE.InstancedMesh(silicon ? beadGeo.faceted : beadGeo.round, silicon ? beadMat.faceted : beadMat.round, lay.beads.length);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lay.beads.length * 3), 3);
    // Bounds: horizontal reach (turntable spins around y) and height.
    let reach = 0.05, minY = Infinity, maxY = -Infinity;
    for (const b of lay.beads) {
      reach = Math.max(reach, Math.hypot(b.x, b.z) + b.r);
      minY = Math.min(minY, b.y - b.r);
      maxY = Math.max(maxY, b.y + b.r);
    }
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
    // Fit the window, but keep the spin radius small next to the camera distance so near parts don't balloon.
    const k = Math.min((halfH * aspect * 0.8) / reach, (halfH * 0.62) / Math.max(0.05, (maxY - minY) / 2), 1.4 / reach);
    const cy = (minY + maxY) / 2;
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    lay.beads.forEach((b, i) => {
      m4.makeScale(b.r * k, b.r * k, b.r * k).setPosition(b.x * k, (b.y - cy) * k, b.z * k);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setHex(creatureColour(silicon, diet, b.tone as Tone)));
    });
    mesh.frustumCulled = false;
    mesh.position.y = 0.6; // a little above the look-at height so hanging limbs stay in frame
    turntable.add(mesh);
  }

  // Placeholder for a creature whose body plan hasn't arrived: a neutral label, never another chemistry's rebuild.
  let notScanned: THREE.Mesh | null = null;
  function notScannedContent() {
    if (!notScanned) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 96;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = 'rgba(20,24,32,0.85)'; g.fillRect(0, 0, 256, 96);
        g.fillStyle = '#c8d0dc'; g.font = '24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('Not scanned yet', 128, 48);
      }
      const tex = new THREE.CanvasTexture(c);
      notScanned = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicNodeMaterial({ map: tex, transparent: true, fog: false }));
      notScanned.position.y = 0.6;
    }
    turntable.add(notScanned);
  }

  /** The clicked creature itself, in its own chemistry, from its own cached BodyPlan layout. */
  function organismContent(id: number) {
    const own = deps.layoutOf?.(id);
    if (own) beadsContent(own.layout, own.silicon, own.diet, rect ? rect.width / rect.height : 2);
    else notScannedContent();
  }

  function seaContent(other: WorldConfig, frozen = false) {
    const s = seaStyle(other.solvent.name, frozen, other.solvent.solidSinks);
    const bed = new THREE.Mesh(geo(new THREE.BoxGeometry(2.4, 0.3, 2.4)), mat(groundColour(other.life.composition, 1)));
    bed.position.y = -0.15;
    const liquid = new THREE.Mesh(geo(new THREE.BoxGeometry(2.4, 0.7, 2.4)), mat(s.colour, { rough: 0.1, opacity: Math.max(0.3, s.opacity) }));
    liquid.position.y = 0.35;
    turntable.add(bed, liquid);
  }

  function groundContent(other: WorldConfig) {
    const base = groundColour(other.life.composition, 1);
    const plate = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.3, 1.3, 0.25, 24)), mat(base));
    plate.position.y = -0.12;
    turntable.add(plate);
    const rockGeo = geo(new THREE.IcosahedronGeometry(1, 0));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, d = 0.15 + 0.12 * i;
      const rock = new THREE.Mesh(rockGeo, mat(mixHex(base, 0xffffff, 0.12 * ((i * 5) % 3)), { flat: true, rough: 0.9 }));
      rock.position.set(Math.cos(a) * d, 0.05 + 0.05 * (i % 3), Math.sin(a) * d);
      rock.scale.set(0.2 + 0.07 * (i % 4), 0.15 + 0.05 * (i % 3), 0.2 + 0.05 * (i % 2));
      turntable.add(rock);
    }
  }

  function producerContent(other: WorldConfig) {
    const silicon = other.life.composition.si > 0.5;
    const cols = floraColours(silicon, 0.4);
    const plate = new THREE.Mesh(geo(new THREE.CylinderGeometry(1, 1, 0.2, 20)), mat(groundColour(other.life.composition, 1)));
    plate.position.y = -0.1;
    turntable.add(plate);
    const up = new THREE.Vector3(0, 1, 0);
    const place = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      mesh.scale.set(rad, len, rad);
      mesh.position.copy(from);
      parent.add(mesh);
    };
    if (silicon) {
      const cone = geo(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0));
      const m1 = mat(cols.stem, { flat: true, rough: 0.25 }), m2 = mat(cols.tip, { flat: true, rough: 0.25 });
      for (let p = 0; p < 3; p++) {
        const base = new THREE.Vector3(Math.cos(p * 2.1) * 0.5, 0, Math.sin(p * 2.1) * 0.5);
        const d = new THREE.Vector3(0.1, 1, 0.05);
        place(turntable, cone, m1, base, d, 1.2, 0.09);
        const at = base.clone().addScaledVector(d.clone().normalize(), 0.55);
        for (let b = 0; b < 2; b++) {
          const a = p + b * Math.PI;
          place(turntable, cone, m2, at, new THREE.Vector3(Math.sin(Math.PI / 3) * Math.cos(a), Math.cos(Math.PI / 3), Math.sin(Math.PI / 3) * Math.sin(a)), 0.65, 0.06);
        }
      }
    } else {
      const cyl = geo(new THREE.CylinderGeometry(0.55, 1, 1, 6).translate(0, 0.5, 0));
      const ball = geo(new THREE.SphereGeometry(1, 10, 8));
      const m1 = mat(cols.stem), m2 = mat(cols.tip);
      for (let p = 0; p < 3; p++) {
        const cur = new THREE.Vector3(Math.cos(p * 2.1) * 0.5, 0, Math.sin(p * 2.1) * 0.5);
        let phi = 0.05;
        for (let j = 0; j < 3; j++) {
          const d = new THREE.Vector3(Math.sin(phi) * Math.cos(p), Math.cos(phi), Math.sin(phi) * Math.sin(p));
          place(turntable, cyl, m1, cur, d, 0.45, 0.07 * (1 - 0.25 * j));
          cur.addScaledVector(d.normalize(), 0.45);
          phi += 0.4;
        }
        const b = new THREE.Mesh(ball, m2);
        b.position.copy(cur);
        b.scale.setScalar(0.17);
        turntable.add(b);
      }
    }
  }

  function skyContent(other: WorldConfig) {
    // The backdrop is the sky; add the star disc and a low ground ring for scale.
    const sky = skyStyle(other.starType, mid(other, 'light', 1), mid(other, 'pressure', 1), mid(other, 'temperature', 15));
    const star = new THREE.Mesh(geo(new THREE.CircleGeometry(1, 24)), basicMat(sky.starColour));
    star.position.set(1.2, 2.6, -8);
    star.scale.setScalar(0.45 * sky.starSize * 2);
    turntable.add(star);
    cam.lookAt(0, 1.2, 0);
  }

  function build(inputs: VisualInputs) {
    const key2 = `${inputs.world.id}|${mode}|${target?.kind}|${target && 'organismId' in target ? target.organismId : ''}`;
    if (key2 === builtFor) return;
    builtFor = key2;
    clearContent();
    cam.position.set(0, 1.1, 3.4);
    cam.lookAt(0, 0.45, 0);
    if (!target) return;
    // 'self' shows this world's version of the thing; 'other' the opposite chemistry's.
    const other = deps.worldFor(mode === 'self' ? inputs.world.id : inputs.world.id === 'carbon' ? 'silicon' : 'carbon');
    setBackdrop(other);
    switch (target.kind) {
      case 'organism': organismContent(target.organismId); break;
      case 'sea': seaContent(other, mode === 'self' && inputs.frozen); break;
      case 'ground': groundContent(other); break;
      case 'producer': producerContent(other); break;
      case 'sky': skyContent(other); break;
    }
    r.compileAsync(scene, cam).catch(console.error);
  }

  // Warm-up: build every swatch of both worlds once, compile them together, then clear. Materials and backdrops
  // stay cached, so opening a card later only builds meshes.
  function warmUp(): Promise<void> {
    for (const id of ['carbon', 'silicon'] as const) {
      const other = deps.worldFor(id);
      seaContent(other); groundContent(other); producerContent(other); skyContent(other);
      beadsContent({ beads: [{ x: 0, y: 0.2, z: 0, r: 0.2, tone: 0 }, { x: 0.4, y: 0.2, z: 0, r: 0.1, tone: 1 }], nBody: 2, limbs: [], stride: 0, radius: 0.6, centreY: 0.2 }, other.life.composition.si > 0.5, 0.5, 2);
      backdropFor(other);
    }
    const all = [...backdrops.values()];
    all.forEach((b) => scene.add(b));
    return r.compileAsync(scene, cam).catch(console.error).then(() => {
      all.forEach((b) => scene.remove(b));
      if (!target) clearContent(); // a card may have opened meanwhile; build() clears warm-up content itself
    });
  }
  const ready = warmUp();

  const onWindow = (w: BusEvents['inspect:window']) => {
    rect = w;
    const m = target?.kind === 'organism' ? 'self' : (w?.mode ?? 'self'); // creatures never show another chemistry
    if (m !== mode) { mode = m; builtFor = ''; }
    if (!w) { builtFor = ''; clearContent(); }
  };
  const onOpen = (e: { target: InspectTarget }) => { target = e.target; mode = 'self'; builtFor = ''; };
  const onClose = () => { rect = null; target = null; mode = 'self'; builtFor = ''; clearContent(); };
  bus.on('inspect:window', onWindow);
  bus.on('inspect:open', onOpen);
  bus.on('inspect:close', onClose);

  // Draw after the main scene: a second pass on the same canvas, scissored to the card's window.
  const origRender = r.render.bind(r);
  r.render = (s: THREE.Object3D, c: THREE.Camera) => {
    origRender(s, c);
    if (s !== app.scene || !rect || !target || rect.width < 4 || rect.height < 4) return;
    const prevAuto = r.autoClear;
    r.autoClear = false;
    r.setScissorTest(true);
    r.setViewport(rect.x, rect.y, rect.width, rect.height);
    r.setScissor(rect.x, rect.y, rect.width, rect.height);
    cam.aspect = rect.width / rect.height;
    cam.updateProjectionMatrix();
    r.clearDepth(); // the canvas keeps the main pass's depth; the swatch must not be tested against it
    origRender(scene, cam);
    r.setScissorTest(false);
    r.setViewport(0, 0, window.innerWidth, window.innerHeight);
    r.autoClear = prevAuto;
  };

  return {
    ready,
    update(dt, _t, inputs) {
      if (!rect || !target) return;
      build(inputs);
      turntable.rotation.y += dt * 0.6;
      if (notScanned && notScanned.parent === turntable) notScanned.rotation.y = -turntable.rotation.y; // keep the label facing us
    },
    dispose() {
      bus.off('inspect:window', onWindow);
      bus.off('inspect:open', onOpen);
      bus.off('inspect:close', onClose);
      r.render = origRender;
      clearContent();
      for (const m of matCache.values()) m.dispose();
      for (const b of backdrops.values()) { b.geometry.dispose(); (b.material as THREE.Material).dispose(); }
      for (const m of Object.values(beadMat)) m.dispose();
      for (const g of Object.values(beadGeo)) g.dispose();
      if (notScanned) { (notScanned.material as THREE.MeshBasicNodeMaterial).map?.dispose(); (notScanned.material as THREE.Material).dispose(); notScanned.geometry.dispose(); }
    },
  };
}
