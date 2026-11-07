// The inspect card's counterpart view: while the UI holds an `inspect:window` rect, draw a small scissored viewport
// of the other world's version of the inspected thing, turning slowly. Organisms: the same genome re-run through
// develop() with the other world's composition, as beads. Sea/ground/sky/producer: a swatch of the other world.
// Runs only while the window is set. Draws after the main scene render (it wraps renderer.render).
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { Bus } from '../bus';
import type { InspectTarget, VisualInputs, WorldConfig, WorldId } from '../worlds/types';
import type { AnimalGenome } from '../sim/genome';
import { develop, type DevelopInputs } from '../sim/develop';
import { OrganismField, ORGANISM_STRIDE, organismCount, readOrganism } from '../sim/organismLayout';
import { beadLayout } from './layout';
import { creatureColour, floraColours, groundColour, mixHex, seaStyle, skyStyle, type Tone } from './palette';

export interface CounterpartPart {
  update(dt: number, t: number, inputs: VisualInputs): void;
  dispose(): void;
}

export interface CounterpartDeps {
  app: App;
  bus: Bus;
  /** Config of a world by id (the other world is looked up from here). */
  worldFor: (id: WorldId) => WorldConfig;
  getInputs: () => VisualInputs;
}

const mid = (w: WorldConfig, key: string, fallback: number): number => {
  const r = w.targets[key] ?? w.ranges[key];
  return r ? (r[0] + r[1]) / 2 : fallback;
};

/** Gas density in kg/m³ from P (bar), T (°C) for N₂-dominated air; the world's own scale maps it into develop()'s range. */
export function airDensityKgM3(pressureBar: number, tempC: number): number {
  return (pressureBar * 1e5 * 0.028) / (8.314 * (tempC + 273.15));
}

export function developInputsFor(w: WorldConfig): DevelopInputs {
  const rho = airDensityKgM3(mid(w, 'pressure', 1), mid(w, 'temperature', 15));
  const i = w.life.inputs;
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
  let target: InspectTarget | null = null;
  let builtFor = '';
  const disposables: { dispose(): void }[] = [];

  const clearContent = () => {
    turntable.clear();
    for (const d of disposables.splice(0)) d.dispose();
  };

  const mat = (hex: number, o: { flat?: boolean; rough?: number; opacity?: number } = {}) => {
    const m = new THREE.MeshStandardNodeMaterial({ color: hex, roughness: o.rough ?? 0.6, flatShading: !!o.flat });
    if (o.opacity !== undefined && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
    disposables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T): T => { disposables.push(g); return g; };

  function setBackdrop(other: WorldConfig) {
    if (backdrop) { scene.remove(backdrop); backdrop.geometry.dispose(); (backdrop.material as THREE.Material).dispose(); }
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
    const m = new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    backdrop = new THREE.Mesh(g, m);
    scene.add(backdrop);
    key.color.setHex(sky.starColour);
    key.intensity = 0.8 + 1.8 * sky.brightness;
  }

  function organismContent(other: WorldConfig, inputs: VisualInputs, id: number) {
    const buf = inputs.organisms;
    const n = organismCount(buf);
    let idx = -1;
    for (let i = 0; i < n; i++) if (buf[i * ORGANISM_STRIDE + OrganismField.id] === id) { idx = i; break; }
    if (idx < 0) return;
    const rec = readOrganism(buf, idx);
    const genome: AnimalGenome = {
      body: rec.body,
      climate: { prefTemp: rec.prefTemp, tolerance: rec.tolerance, chem: rec.chem },
      comp: other.life.composition,
      lineage: rec.lineage,
    };
    const plan = develop(genome, { light: Math.min(1, mid(other, 'light', 1)), heatBand: 0.5 }, developInputsFor(other));
    const lay = beadLayout(plan);
    const silicon = plan.chemistry === 'silicon';
    const sphere = geo(silicon ? new THREE.IcosahedronGeometry(1, 0) : new THREE.SphereGeometry(1, 12, 8));
    const k = 1 / Math.max(0.2, lay.radius);          // fit the body into a unit-radius view
    const group = new THREE.Group();
    for (const b of lay.beads) {
      const m = new THREE.Mesh(sphere, mat(creatureColour(silicon, rec.body.diet, b.tone as Tone), { flat: silicon, rough: silicon ? 0.35 : 0.6 }));
      m.position.set(b.x * k, (b.y - lay.centreY) * k, b.z * k);
      m.scale.setScalar(b.r * k);
      group.add(m);
    }
    group.position.y = 0.6;
    turntable.add(group);
  }

  function seaContent(other: WorldConfig) {
    const s = seaStyle(other.solvent.name, false, other.solvent.solidSinks);
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
    const star = new THREE.Mesh(geo(new THREE.CircleGeometry(1, 24)), new THREE.MeshBasicNodeMaterial({ color: sky.starColour, fog: false }));
    disposables.push(star.material as THREE.Material);
    star.position.set(1.2, 2.6, -8);
    star.scale.setScalar(0.45 * sky.starSize * 2);
    turntable.add(star);
    cam.lookAt(0, 1.2, 0);
  }

  function build(inputs: VisualInputs) {
    const key2 = `${inputs.world.id}|${target?.kind}|${target && 'organismId' in target ? target.organismId : ''}`;
    if (key2 === builtFor) return;
    builtFor = key2;
    clearContent();
    cam.position.set(0, 1.1, 3.4);
    cam.lookAt(0, 0.45, 0);
    if (!target) return;
    const other = deps.worldFor(inputs.world.id === 'carbon' ? 'silicon' : 'carbon');
    setBackdrop(other);
    switch (target.kind) {
      case 'organism': organismContent(other, inputs, target.organismId); break;
      case 'sea': seaContent(other); break;
      case 'ground': groundContent(other); break;
      case 'producer': producerContent(other); break;
      case 'sky': skyContent(other); break;
    }
    void r.compileAsync(scene, cam);
  }

  const onWindow = (w: typeof rect) => { rect = w; if (!w) { builtFor = ''; clearContent(); } };
  const onOpen = (e: { target: InspectTarget }) => { target = e.target; builtFor = ''; };
  const onClose = () => { rect = null; target = null; builtFor = ''; clearContent(); };
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
    update(dt, _t, inputs) {
      if (!rect || !target) return;
      build(inputs);
      turntable.rotation.y += dt * 0.6;
    },
    dispose() {
      bus.off('inspect:window', onWindow);
      bus.off('inspect:open', onOpen);
      bus.off('inspect:close', onClose);
      r.render = origRender;
      clearContent();
      if (backdrop) { backdrop.geometry.dispose(); (backdrop.material as THREE.Material).dispose(); }
    },
  };
}
