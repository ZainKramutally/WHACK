// The inspect card's 3D window: while the UI holds an `inspect:window` rect, draw a small scissored viewport of the
// inspected thing, turning slowly. Organisms: the creature itself, built from its own cached BodyPlan as beads (never
// another chemistry's rebuild). Producer: the clicked cell's own plants, the real flora archetypes the world places
// there (near LOD, the world's palette and glow). Sea/ground/sky: this world's swatch. There is no other-world view.
// Runs only while the window is set. Drawn as an app overlay: after the post pipeline has written the frame, straight to the
// canvas at full resolution, so the card's view stays crisp (never pixelated or outlined).
import { flightParamsFor } from '../sim/flight';
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { Bus } from '../bus';
import type { BusEvents, InspectTarget, VisualInputs, WorldConfig, WorldId } from '../worlds/types';
import type { DevelopInputs } from '../sim/develop';
import { gasDensity } from '../sim/models';
import { beadLayout, cellCentre } from './layout';
import { floraForm } from './floraForm';
import { LOOK_PALETTES, WORLD_TONE, creatureColour, groundColour, lookKind, mixHex, seaStyle, skyStyle } from './palette';
import { buildFloraLibrary, paint, type FloraLibrary } from './floraLib';
import { makePlantList, type Clearing } from './floraLib/place';
import { plantsInCell } from './cellPlants';
import type { BakedCreature } from './fauna';
import { PART_TYPES } from './faunaLib/adapter';
import { gridIndex } from './faunaLib/loft';
import { partGeometries } from './faunaLib/parts';

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
  layoutOf?: (id: number) => {
    layout: ReturnType<typeof beadLayout>; silicon: boolean; diet: number; hue: number; accent: number;
    /** The creature as the world's near LOD draws it (loft and parts) at rest pose; the live view prefers this. */
    bake?: () => BakedCreature | null;
  } | null;
  /** The world's spawn clearing (as given to flora.setClearing), so the producer view drops the plants the world clears. */
  getClearing?: () => Clearing | null;
}

const mid = (w: WorldConfig, key: string, fallback: number): number => {
  const r = w.targets[key] ?? w.ranges[key];
  return r ? (r[0] + r[1]) / 2 : fallback;
};


export function developInputsFor(w: WorldConfig): DevelopInputs {
  const i = w.life.inputs;
  const rho = gasDensity(mid(w, 'pressure', 1), mid(w, 'temperature', 15), i.airDensity.molarMass);
  return { solvent: i.solvent, airDensity: rho * i.airDensity.scale, tissueDensity: i.tissueDensity, gravity: mid(w, 'gravity', 1), flight: flightParamsFor(i) };
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
  /** A mesh on shared geometry and material: on clear, release its render objects (r187 keeps them, with dispose
   *  listeners on the shared geometry and material, until the object itself dispatches 'dispose'). */
  const releaseOnClear = (m: THREE.Object3D) => {
    disposables.push({ dispose: () => (m as unknown as THREE.EventDispatcher<{ dispose: object }>).dispatchEvent({ type: 'dispose' }) });
  };
  // The world's look for creatures: the near-LOD loft (vertex colours) and sculpted parts (instance colours), in this
  // view's own standard materials (the world material's fog, bounce and foreground push are tuned for the world camera).
  const loftMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.55 });
  const partMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.55 });
  let partGeo: ReturnType<typeof partGeometries> | null = null;
  const partGeoOf = (type: number) => (partGeo ??= partGeometries())[PART_TYPES[type]];

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

  /** The baked near-LOD creature (one loft mesh per slot, one InstancedMesh per part type), framed like the beads. */
  function loftContent(b: BakedCreature, aspect: number) {
    const group = new THREE.Group();
    let reach = 0.05, minY = Infinity, maxY = -Infinity;
    const grow = (x: number, y: number, z: number, r: number) => {
      reach = Math.max(reach, Math.hypot(x, z) + r);
      minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
    };
    for (const l of b.lofts) {
      const g = geo(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.BufferAttribute(l.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(l.nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(l.col, 3));
      g.setIndex(new THREE.BufferAttribute(gridIndex(l.rings, l.sides, 1), 1));
      const mesh = new THREE.Mesh(g, loftMat);
      mesh.frustumCulled = false;
      group.add(mesh);
      for (let i = 0; i < l.pos.length; i += 3) grow(l.pos[i], l.pos[i + 1], l.pos[i + 2], 0);
    }
    for (const p of b.parts) {
      const im = new THREE.InstancedMesh(partGeoOf(p.type), partMat, p.n);
      (im.instanceMatrix.array as Float32Array).set(p.m);
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor = new THREE.InstancedBufferAttribute(p.col, 3);
      im.frustumCulled = false;
      disposables.push(im);
      group.add(im);
      for (let i = 0; i < p.n; i++) {
        const m = p.m, o = i * 16;
        const r = Math.max(Math.hypot(m[o], m[o + 1], m[o + 2]), Math.hypot(m[o + 4], m[o + 5], m[o + 6]), Math.hypot(m[o + 8], m[o + 9], m[o + 10]));
        grow(m[o + 12], m[o + 13], m[o + 14], r);
      }
    }
    if (!Number.isFinite(minY)) return false;
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
    const k = Math.min((halfH * aspect * 0.8) / reach, (halfH * 0.62) / Math.max(0.05, (maxY - minY) / 2), 1.4 / reach);
    group.scale.setScalar(k);
    group.position.y = 0.6 - ((minY + maxY) / 2) * k;
    turntable.add(group);
    return true;
  }

  /** The clicked creature itself, in its own chemistry: as the world draws it near (loft), else its bead layout. */
  function organismContent(id: number) {
    const own = deps.layoutOf?.(id);
    const aspect = rect ? rect.width / rect.height : 2;
    const baked = own?.bake?.() ?? null;
    if (baked && loftContent(baked, aspect)) return;
    if (own) beadsContent(own.layout, own.silicon, own.diet, aspect, own.hue, own.accent);
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

  // ---- producer: the clicked cell's real plants ---------------------------------------------------------------------
  // The world's flora archetypes, rebuilt here from the same seed (pure and deterministic, so the same geometry), near LOD.
  // CARD_LIB_SEED must equal flora.ts LIB_SEED; switch to a shared floraLib library export once there is one.
  const CARD_LIB_SEED = 0x5eed_f10a;
  let floraLib: FloraLibrary | null = null;
  const libOf = () => (floraLib ??= buildFloraLibrary(CARD_LIB_SEED));
  const darkGeo = new Map<number, THREE.BufferGeometry>(); // the foreground value step needs its own colours (as flora.ts)
  // Two-sided like the world's plants (open webs, sieve plates and parasol discs); vertex colours from paint().
  const plantMat = new THREE.MeshStandardNodeMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });
  const plants = makePlantList(2048); // ≥ 81 cells × ~20 plants: the clicked cell's plants are never dropped for its neighbours'
  /** One plant the world draws in a cell: its archetype index, world instance transform, the ground height under it
   *  (the card stands every plant on its plate), and the world's paint for it (value step, glow). */
  interface CellPlant { arch: number; m: THREE.Matrix4; ground: number; dark: boolean; glow: number }
  const UP = new THREE.Vector3(0, 1, 0), tq = new THREE.Quaternion(), tp = new THREE.Vector3(), ts = new THREE.Vector3();

  /**
   * The plants the world draws in `cell`. Today re-derived with the world's own placement (cellPlants.ts) and composed
   * as flora.ts composes its instances; when FloraPart.plantsIn(cell) lands, this is the only function to change.
   */
  function plantsToDraw(cell: number, inputs: VisualInputs, patch: number): CellPlant[] {
    const lib = libOf();
    return plantsInCell(inputs, patch, cell, { x: app.camera.position.x, z: app.camera.position.z }, plants, deps.getClearing?.() ?? null).map((i) => {
      const a = lib.archetypes[plants.arch[i]], s = plants.h[i] / a.size;
      tq.setFromAxisAngle(UP, plants.yaw[i]);
      const m = new THREE.Matrix4().compose(tp.set(plants.x[i], plants.y[i] - 0.03 * plants.h[i], plants.z[i]), tq, ts.set(s, s, s));
      return { arch: plants.arch[i], m, ground: plants.y[i], dark: plants.dark[i] === 1, glow: plants.glow[i] };
    });
  }

  /** The clicked cell's plants on a plate of this world's ground: real archetypes, painted as the world paints them. */
  function producerContent(cell: number, inputs: VisualInputs, aspect: number) {
    const world = deps.worldFor(inputs.world.id);
    const patch = inputs.terrain.patchSize ?? world.terrain.patchSize;
    const lib = libOf();
    const pal = LOOK_PALETTES[lookKind(inputs.world.composition)];
    const cc = cellCentre(cell, patch);
    const group = new THREE.Group();
    let reach = 0.3, top = 0.3;
    const painted = new Set<string>();
    const toCard = new THREE.Matrix4();
    for (const p of plantsToDraw(cell, inputs, patch)) {
      const a = lib.archetypes[p.arch];
      const built = a.lod[0];
      let g = built.geometry;
      if (p.dark) {
        g = darkGeo.get(a.index) ?? built.geometry.clone();
        darkGeo.set(a.index, g);
      }
      const tag = `${a.index}|${p.dark ? 1 : 0}`;
      if (!painted.has(tag)) { paint({ ...built, geometry: g }, pal, p.glow, p.dark); painted.add(tag); }
      const mesh = new THREE.Mesh(g, plantMat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.multiplyMatrices(toCard.makeTranslation(-cc.x, -p.ground, -cc.z), p.m); // around the cell, on the plate
      mesh.frustumCulled = false;
      group.add(mesh);
      releaseOnClear(mesh);
      const e = mesh.matrix.elements;
      const sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
      reach = Math.max(reach, Math.hypot(e[12], e[14]) + a.radius * sc);
      top = Math.max(top, e[13] + a.height * sc);
    }
    const plate = new THREE.Mesh(geo(new THREE.CylinderGeometry(1, 1, 0.2, 24)), mat(groundColour(world.life.composition, 1)));
    const thick = Math.max(0.05, 0.08 * top);
    plate.scale.set(reach, thick, reach);
    plate.position.y = -0.1 * thick; // its top face at y = 0, where the plants stand
    group.add(plate);
    // frame like the creature view: fit the plants' reach and height into the window
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
    const k = Math.min((halfH * aspect * 0.8) / reach, (halfH * 0.62) / Math.max(0.05, top / 2), 1.4 / reach);
    group.scale.setScalar(k);
    group.position.y = 0.6 - (top / 2) * k;
    turntable.add(group);
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
    const other = deps.worldFor(inputs.world.id); // the view always shows this world's own thing
    // A producer is always this world's own cell (no other-world view, owner ruling), and follows its live form: the view
    // rebuilds if the sea rises over it or its biomass mix shifts.
    const form = target?.kind === 'producer' ? floraForm(target.cell, inputs) : null;
    const key2 = `${inputs.world.id}|${target?.kind}|${target && 'organismId' in target ? target.organismId : ''}|${target?.kind === 'producer' ? `${target.cell}:${form?.key ?? '-'}` : ''}`;
    if (key2 === builtFor) return;
    builtFor = key2;
    clearContent();
    cam.position.set(0, 1.1, 3.4);
    cam.lookAt(0, 0.45, 0);
    if (!target) return;
    setBackdrop(other);
    switch (target.kind) {
      case 'organism': organismContent(target.organismId); break;
      case 'sea': seaContent(other, inputs.frozen); break;
      case 'ground': groundContent(other); break;
      case 'producer': producerContent(target.cell, inputs, rect ? rect.width / rect.height : 2); break;
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
      // The producer view: the flora library is built now (not on the first plant card) and its material compiled on
      // one archetype of this chemistry (every archetype shares the same vertex layout, so one pipeline serves them all).
      const lib = libOf(), chem = id;
      const arch = lib.archetypes.find((x) => x.chem === chem);
      if (arch) {
        paint(arch.lod[0], LOOK_PALETTES[chem], 0);
        const plant = new THREE.Mesh(arch.lod[0].geometry, plantMat);
        plant.scale.setScalar(1e-3);
        turntable.add(plant);
        releaseOnClear(plant);
      }
      beadsContent({ beads: [{ x: 0, y: 0.2, z: 0, r: 0.2, tone: 0 }, { x: 0.4, y: 0.2, z: 0, r: 0.1, tone: 1 }], nBody: 2, limbs: [], stride: 0, radius: 0.6, centreY: 0.2 }, other.life.composition.si > 0.5, 0.5, 2);
      backdropFor(other);
    }
    // the creature live view's loft and part pipelines (one tiny ring pair; one instance of every part geometry)
    const ring = (y: number) => [0, y, 0.1, 0.1, y, -0.1, -0.1, y, 0];
    loftContent({
      lofts: [{ pos: Float32Array.from([...ring(0), ...ring(0.2)]), nor: new Float32Array(18).fill(0.577), col: new Float32Array(18).fill(0.5), rings: 2, sides: 3 }],
      parts: PART_TYPES.map((_, type) => ({ type, m: Float32Array.from([0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 1]), col: new Float32Array(3).fill(0.5), n: 1 })),
    }, 2);
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
    if (!w) { builtFor = ''; clearContent(); }
  };
  const onOpen = (e: { target: InspectTarget }) => { target = e.target; builtFor = ''; };
  const onClose = () => { rect = null; target = null; builtFor = ''; clearContent(); };
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
      loftMat.dispose(); partMat.dispose(); plantMat.dispose();
      for (const g of darkGeo.values()) g.dispose();
      if (floraLib) for (const a of floraLib.archetypes) for (const l of a.lod) l.geometry.dispose();
      if (partGeo) for (const g of Object.values(partGeo)) g.dispose();
      if (notScanned) { (notScanned.material as THREE.MeshBasicNodeMaterial).map?.dispose(); (notScanned.material as THREE.Material).dispose(); notScanned.geometry.dispose(); }
    },
  };
}
