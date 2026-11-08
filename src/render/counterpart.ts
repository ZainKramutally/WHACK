// The inspect card's 3D window: while the UI holds an `inspect:window` rect, draw a small scissored viewport of the
// inspected thing, turning slowly. Organisms: the creature itself, built from its own cached BodyPlan as beads (never
// another chemistry's rebuild). Sea/ground/sky/producer: this world's swatch, or the other world's via the toggle.
// Runs only while the window is set. Drawn as an app overlay: after the post pipeline has written the frame, straight to the
// canvas at full resolution, so the card's view stays crisp (never pixelated or outlined).
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { Bus } from '../bus';
import type { BusEvents, InspectTarget, VisualInputs, WorldConfig, WorldId } from '../worlds/types';
import type { DevelopInputs } from '../sim/develop';
import { gasDensity } from '../sim/models';
import { FLORA_EPS, beadLayout } from './layout';
import { DARK_BELOW, DIM_BELOW, cellSubmerged, floraBin, floraForm, formForBin, type FloraForm } from './floraForm';
import { WORLD_TONE, creatureColour, floraColours, groundColour, mixHex, seaStyle, skyStyle } from './palette';

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
  layoutOf?: (id: number) => { layout: ReturnType<typeof beadLayout>; silicon: boolean; diet: number; hue: number; accent: number } | null;
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
  const mat = (hex: number, o: { flat?: boolean; rough?: number; opacity?: number; double?: boolean } = {}) => {
    const key = `${hex}|${o.flat ? 1 : 0}|${o.rough ?? 0.6}|${o.opacity ?? 1}|${o.double ? 1 : 0}`;
    let m = matCache.get(key) as THREE.MeshStandardNodeMaterial | undefined;
    if (!m) {
      m = new THREE.MeshStandardNodeMaterial({ color: hex, roughness: o.rough ?? 0.6, flatShading: !!o.flat, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
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
  // Radial (silicon) bodies are prisms: one n-gon cylinder per hub symmetry plus a hex one for arms, tiles and spires.
  const prism = (n: number) => { const g = new THREE.CylinderGeometry(1, 1, 1, n, 1); g.rotateY(Math.PI / 2); return g; };
  const beadGeo = { round: new THREE.SphereGeometry(1, 12, 8), faceted: new THREE.IcosahedronGeometry(1, 0), p3: prism(3), p4: prism(4), p5: prism(5), p6: prism(6), p8: prism(8) };
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
  function beadsContent(lay: ReturnType<typeof beadLayout>, silicon: boolean, diet: number, aspect: number, hue = 0.5, accent = 0.5) {
    const mesh = new THREE.InstancedMesh(silicon ? beadGeo.faceted : beadGeo.round, silicon ? beadMat.faceted : beadMat.round, lay.beads.length);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lay.beads.length * 3), 3);
    // Bounds: horizontal reach (turntable spins around y) and height.
    let reach = 0.05, minY = Infinity, maxY = -Infinity;
    for (const b of lay.beads) {
      const e = b.r * Math.max(b.sx ?? 1, b.sz ?? 1);
      reach = Math.max(reach, Math.hypot(b.x, b.z) + e);
      minY = Math.min(minY, b.y - b.r * (b.sy ?? 1));
      maxY = Math.max(maxY, b.y + b.r * (b.sy ?? 1));
    }
    const rods = lay.radial?.rods ?? [];
    for (const r of rods) {
      reach = Math.max(reach, Math.hypot(r.ax, r.az) + r.r, Math.hypot(r.bx, r.bz) + r.r);
      minY = Math.min(minY, r.ay - r.r, r.by - r.r);
      maxY = Math.max(maxY, r.ay + r.r, r.by + r.r);
    }
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
    // Fit the window, but keep the spin radius small next to the camera distance so near parts don't balloon.
    const k = Math.min((halfH * aspect * 0.8) / reach, (halfH * 0.62) / Math.max(0.05, (maxY - minY) / 2), 1.4 / reach);
    const cy = (minY + maxY) / 2;
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    const q0 = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), pos0 = new THREE.Vector3(), sc0 = new THREE.Vector3();
    lay.beads.forEach((b, i) => {
      q0.setFromAxisAngle(yAxis, -(b.yaw ?? 0));
      m4.compose(pos0.set(b.x * k, (b.y - cy) * k, b.z * k), q0, sc0.set(b.r * (b.sx ?? 1) * k, b.r * (b.sy ?? 1) * k, b.r * (b.sz ?? 1) * k));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setHex(creatureColour(silicon, diet, WORLD_TONE[b.tone], hue, accent)));
    });
    mesh.frustumCulled = false;
    mesh.position.y = 0.6; // a little above the look-at height so hanging limbs stay in frame
    turntable.add(mesh);
    if (lay.radial) {
      const R = lay.radial;
      const hubGeo = ({ 3: beadGeo.p3, 4: beadGeo.p4, 5: beadGeo.p5, 6: beadGeo.p6, 8: beadGeo.p8 } as Record<number, THREE.BufferGeometry>)[R.hubSides] ?? beadGeo.p6;
      const hub = new THREE.InstancedMesh(hubGeo, beadMat.faceted, R.nTiers);
      const hex = new THREE.InstancedMesh(beadGeo.p6, beadMat.faceted, Math.max(1, rods.length - R.nTiers));
      const ax = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), fwd = new THREE.Vector3(1, 0, 0), upV = new THREE.Vector3(0, 1, 0);
      rods.forEach((r, i) => {
        ax.set(r.bx - r.ax, r.by - r.ay, r.bz - r.az);
        const len = Math.max(1e-5, ax.length());
        ax.divideScalar(len);
        if (r.up) p1.crossVectors(ax, upV); else p1.copy(fwd).addScaledVector(ax, -fwd.dot(ax));
        if (p1.lengthSq() < 1e-8) p1.set(0, 0, 1);
        p1.normalize();
        p2.crossVectors(p1, ax);
        const flat = r.flat ?? 1;
        m4.makeBasis(p1.multiplyScalar(r.r * k), ax.clone().multiplyScalar(len * k), p2.multiplyScalar(r.r * flat * k));
        m4.setPosition(((r.ax + r.bx) / 2) * k, ((r.ay + r.by) / 2 - cy) * k, ((r.az + r.bz) / 2) * k);
        const target = i < R.nTiers ? hub : hex;
        const idx = i < R.nTiers ? i : i - R.nTiers;
        target.setMatrixAt(idx, m4);
        target.setColorAt(idx, c.setHex(creatureColour(true, diet, WORLD_TONE[r.tone], hue, accent)));
      });
      for (const m of [hub, hex]) { m.frustumCulled = false; m.position.y = 0.6; turntable.add(m); }
    }
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
    if (own) beadsContent(own.layout, own.silicon, own.diet, rect ? rect.width / rect.height : 2, own.hue, own.accent);
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

  /**
   * The plant form a producer swatch draws. This world: the clicked cell's own form, exactly as the world draws it
   * (floraForm, including submerged cells). The other world: the same patch (biomass mix, depth) under that world's
   * chemistry, solvent and light. Null when nothing grows in the cell.
   */
  function producerForm(cell: number, inputs: VisualInputs, other: WorldConfig): FloraForm | null {
    if (other.id === inputs.world.id) return floraForm(cell, inputs);
    const matB = inputs.flora[cell * 2] ?? 0, canopyB = inputs.flora[cell * 2 + 1] ?? 0;
    if (matB + canopyB <= FLORA_EPS) return null;
    const light = mid(other, 'light', 1);
    return formForBin({
      ...floraBin(matB, canopyB, inputs, cellSubmerged(cell, inputs)),
      silicon: other.life.composition.si > 0.5,
      water: /water/i.test(other.solvent.name),
      light: light < DARK_BELOW ? 0 : light < DIM_BELOW ? 1 : 2,
    });
  }

  /** Three plants of `form` on a ground plate, with the same species shapes and proportions as render/flora.ts. */
  function producerContent(other: WorldConfig, form: FloraForm | null) {
    const silicon = other.life.composition.si > 0.5;
    const cols = floraColours(silicon, 0.4);
    const plate = new THREE.Mesh(geo(new THREE.CylinderGeometry(1, 1, 0.2, 20)), mat(groundColour(other.life.composition, 1)));
    plate.position.y = -0.1;
    turntable.add(plate);
    if (!form) return; // nothing grows here now: bare ground, as the card says
    const up = new THREE.Vector3(0, 1, 0);
    const place = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      mesh.scale.set(rad, len, rad);
      mesh.position.copy(from);
      parent.add(mesh);
    };
    const ball = (m: THREE.Material, g: THREE.BufferGeometry, at: THREE.Vector3, rad: number, squash = 1) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.scale.set(rad, rad * squash, rad);
      mesh.position.copy(at);
      turntable.add(mesh);
    };
    const lampMat = basicMat(silicon ? 0xbfe8ff : 0xfff2a0);
    const lampGeo = geo(new THREE.IcosahedronGeometry(1, 1));
    const lamp = (at: THREE.Vector3, rad: number) => { if (form.glow > 0) ball(lampMat, lampGeo, at, rad); };
    const dirAt = (tilt: number, az: number) => new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
    const cone = geo(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0));
    const cyl = geo(new THREE.CylinderGeometry(0.55, 1, 1, 6).translate(0, 0.5, 0));
    const sphere = geo(new THREE.SphereGeometry(1, 10, 8));
    const cupGeo = geo(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
    const domeGeo = geo(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2));
    const facet = { flat: true, rough: 0.25 };
    for (let p = 0; p < 3; p++) {
      const az = p * 2.1;
      const base = new THREE.Vector3(Math.cos(az) * 0.5, 0, Math.sin(az) * 0.5);
      const h = 0.9 * form.heightScale * (0.85 + 0.15 * p);
      switch (form.species) {
        case 'spire': {
          // Straight trunk; branches leave it at form.branchDeg; glowing tips from darkness.
          const trunk = dirAt(0.12, az);
          place(turntable, cone, mat(cols.stem, facet), base, trunk, h, 0.07 * h + 0.02);
          const at = base.clone().addScaledVector(trunk, h * 0.45);
          const tilt = (form.branchDeg * Math.PI) / 180;
          for (let b = 0; b < form.branches; b++) {
            const d = dirAt(tilt, az + (b * 2 * Math.PI) / form.branches);
            place(turntable, cone, mat(cols.tip, facet), at, d, h * 0.55, 0.05 * h + 0.015);
            lamp(at.clone().addScaledVector(d, h * 0.55), 0.04 * h + 0.03);
          }
          lamp(at.clone().addScaledVector(trunk, h * 0.55), 0.05 * h + 0.03);
          break;
        }
        case 'crust': {
          // Low faceted fans lying close to the ground.
          for (let b = 0; b < 3; b++) place(turntable, cone, mat(b === 0 ? cols.stem : cols.tip, facet), base, dirAt(1.0, az + (b * 2 * Math.PI) / 3), h * 0.5, 0.09 * h + 0.03);
          lamp(base.clone().setY(0.1 * h), 0.04 * h + 0.03);
          break;
        }
        case 'dome': {
          // Submerged mat on a water world: a translucent jellyshroom dome on the ground.
          const rd = 0.6 * form.capScale * h + 0.12;
          ball(mat(cols.tip, { rough: 0.15, opacity: 0.55, double: true }), domeGeo, base, rd, 0.8);
          lamp(base.clone().setY(0.25 * rd), 0.3 * rd);
          break;
        }
        default: {
          // Carbon stems curl by form.curl per segment; tufts are short and capless, caps are balls, cups are open bowls.
          const stemH = form.species === 'tuft' ? h * 0.6 : h;
          const seg = stemH / 3;
          const cur = base.clone();
          let phi = 0.05;
          for (let j = 0; j < 3; j++) {
            const d = dirAt(phi, az);
            place(turntable, cyl, mat(cols.stem), cur, d, seg, 0.06 * stemH * (1 - 0.25 * j) + 0.015);
            cur.addScaledVector(d, seg);
            phi += form.curl;
          }
          const rc = form.capScale * stemH + 0.08;
          if (form.species === 'capped') ball(mat(cols.tip), sphere, cur, rc);
          else if (form.species === 'cup') {
            ball(mat(cols.tip, { rough: 0.5, double: true }), cupGeo, cur, rc * 1.3);
            lamp(cur.clone().setY(cur.y + 0.15 * rc), 0.45 * rc);
          }
        }
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
    // 'self' shows this world's version of the thing; 'other' the opposite chemistry's.
    const other = deps.worldFor(mode === 'self' ? inputs.world.id : inputs.world.id === 'carbon' ? 'silicon' : 'carbon');
    // A producer follows its cell's live form: the swatch rebuilds if the sea rises over it or its biomass mix shifts.
    const form = target?.kind === 'producer' ? producerForm(target.cell, inputs, other) : null;
    const key2 = `${inputs.world.id}|${mode}|${target?.kind}|${target && 'organismId' in target ? target.organismId : ''}|${target?.kind === 'producer' ? `${target.cell}:${form?.key ?? '-'}` : ''}`;
    if (key2 === builtFor) return;
    builtFor = key2;
    clearContent();
    cam.position.set(0, 1.1, 3.4);
    cam.lookAt(0, 0.45, 0);
    if (!target) return;
    setBackdrop(other);
    switch (target.kind) {
      case 'organism': organismContent(target.organismId); break;
      case 'sea': seaContent(other, mode === 'self' && inputs.frozen); break;
      case 'ground': groundContent(other); break;
      case 'producer': producerContent(other, form); break;
      case 'sky': skyContent(other); break;
    }
    r.compileAsync(scene, cam).catch(console.error);
  }

  // Warm-up: build every swatch of both worlds once, compile them together, then clear. Materials and backdrops
  // stay cached, so opening a card later only builds meshes.
  function warmUp(): Promise<void> {
    for (const id of ['carbon', 'silicon'] as const) {
      const other = deps.worldFor(id);
      seaContent(other); groundContent(other); skyContent(other);
      // Every plant species this world can draw (tuft/dome/capped/cup, or crust/spire, lit and glowing), so any producer card is compiled.
      const si = other.life.composition.si > 0.5, water = /water/i.test(other.solvent.name);
      for (const [mix, sub, light] of [[0, false, 2], [0, true, 0], [1, false, 2], [2, false, 1]] as const) {
        producerContent(other, formForBin({ silicon: si, water, sub, lush: 1, light, heat: 2, mix }));
      }
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

  // Draw after the main frame: a second pass on the same canvas, scissored to the card's window.
  const unregisterOverlay = app.registerOverlay(() => {
    if (!rect || !target || rect.width < 4 || rect.height < 4) return;
    const prevAuto = r.autoClear;
    r.autoClear = false;
    r.setScissorTest(true);
    r.setViewport(rect.x, rect.y, rect.width, rect.height);
    r.setScissor(rect.x, rect.y, rect.width, rect.height);
    cam.aspect = rect.width / rect.height;
    cam.updateProjectionMatrix();
    r.clearDepth(); // the swatch must not be tested against whatever depth the canvas holds
    r.render(scene, cam);
    r.setScissorTest(false);
    r.setViewport(0, 0, window.innerWidth, window.innerHeight);
    r.autoClear = prevAuto;
  });

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
      unregisterOverlay();
      clearContent();
      for (const m of matCache.values()) m.dispose();
      for (const b of backdrops.values()) { b.geometry.dispose(); (b.material as THREE.Material).dispose(); }
      for (const m of Object.values(beadMat)) m.dispose();
      for (const g of Object.values(beadGeo)) g.dispose();
      if (notScanned) { (notScanned.material as THREE.MeshBasicNodeMaterial).map?.dispose(); (notScanned.material as THREE.Material).dispose(); notScanned.geometry.dispose(); }
    },
  };
}
