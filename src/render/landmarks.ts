// Landmark structures in the scene (issue #52): ice arches and spires, crystal columns, reef pillars, hoodoos, stacks and buttes.
// Read-only: placement and growth come from gen/landmarks.ts, driven by VisualInputs (rise, machine progress, heatSolvent,
// flora). Structures rise out of the ground with the build (the mesh slides up from below the surface) and reefs thicken
// with the producer biomass around them. One shared worldMaterial with vertex colours, so the art layer re-skins them by
// changing that material, not this file.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { worldMaterial } from './material';
import { biomassAround, biomassFactors, type Landmark, type LandmarkSet } from '../gen/landmarks';
import { landmarkPieces } from '../gen/landmarkMesh';
import type { TerrainState } from '../gen/terrain';
import { mineralIdAt, rockPalette } from './landmarkLook';

export interface LandmarksPart {
  /** Replace the structures (null clears). Builds all meshes now; the material is already compiled with the scene. */
  setSet(set: LandmarkSet | null): void;
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  readonly count: number;
  dispose(): void;
}

interface Entry {
  lm: Landmark;
  meshes: THREE.Mesh[];
  /** Highest local point of the whole structure (m): sinking by this much hides all of it under the ground. */
  top: number;
  tall: number; thick: number;          // eased biomass factors
  tTall: number; tThick: number;        // their targets
  grow: number; baseY: number; pierY: [number, number];
}

const colour = new THREE.Color();
const cache = new Map<number, [number, number, number]>();
const linear = (hex: number): [number, number, number] => {
  let c = cache.get(hex);
  if (!c) {
    colour.setHex(hex);
    c = [colour.r, colour.g, colour.b];
    cache.set(hex, c);
  }
  return c;
};

export function createLandmarksPart(app: App): LandmarksPart {
  const material = worldMaterial({ kind: 'prop', vertexColors: true, flat: true });
  const root = new THREE.Group();
  root.name = 'landmarks';
  app.scene.add(root);

  // A hidden-under-the-world triangle that shares the material and vertex layout, so the scene's warm-up compile covers it.
  const warm = new THREE.BufferGeometry();
  warm.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  warm.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(1), 3));
  warm.computeVertexNormals();
  const warmMesh = new THREE.Mesh(warm, material);
  warmMesh.position.y = -20000;
  root.add(warmMesh);

  let set: LandmarkSet | null = null;
  let entries: Entry[] = [];
  let lastInputs: VisualInputs | null = null;

  function clear() {
    for (const e of entries) for (const m of e.meshes) { root.remove(m); m.geometry.dispose(); }
    entries = [];
    lastInputs = null;
    tinted = false;
  }

  const ROCK_KINDS = new Set(['hoodoo', 'rockStack', 'butte']);
  let tinted = false;

  function build(lm: Landmark, rock?: number[]): Entry {
    const pieces = landmarkPieces(lm, rock);
    const meshes: THREE.Mesh[] = [];
    let top = 0;
    for (const p of pieces) {
      const g = new THREE.BufferGeometry();
      const n = p.mesh.hex.length;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set(linear(p.mesh.hex[i]), i * 3);
      g.setAttribute('position', new THREE.BufferAttribute(p.mesh.positions, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      m.matrixAutoUpdate = p.kind !== 'lintel';   // the lintel carries a shear, so it sets its own matrix
      m.visible = false;
      root.add(m);
      meshes.push(m);
      top = Math.max(top, p.offset[1] + p.mesh.top);
    }
    return { lm, meshes, top, tall: 1, thick: 1, tTall: 1, tThick: 1, grow: 0, baseY: 0, pierY: [0, 0] };
  }

  const shear = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const rot = new THREE.Matrix4();

  function place(e: Entry) {
    const { lm } = e;
    const sink = (1 - e.grow) * e.top * e.tall;
    const show = e.grow > 0.004;
    if (lm.kind === 'iceArch') {
      const c = Math.cos(lm.angle) * lm.span / 2, s = Math.sin(lm.angle) * lm.span / 2;
      const [g0, g1] = e.pierY;
      e.meshes[0].position.set(lm.x - c, g0 - sink, lm.z - s);
      e.meshes[1].position.set(lm.x + c, g1 - sink, lm.z + s);
      // lintel: from the first pier's top toward the second, sheared so both ends meet the piers' tops
      const k = (g1 - g0) / lm.span;
      shear.set(1, 0, 0, 0, k, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      rot.makeRotationY(-lm.angle);
      tmp.makeTranslation(lm.x - c, g0 - sink + 0.9 * lm.height, lm.z - s).multiply(rot).multiply(shear);
      const lintel = e.meshes[2];
      lintel.matrix.copy(tmp);
      lintel.matrixWorldNeedsUpdate = true;
    } else {
      const m = e.meshes[0];
      m.position.set(lm.x, e.baseY - sink, lm.z);
      m.scale.set(e.thick, e.tall, e.thick);
    }
    for (const m of e.meshes) m.visible = show;
  }

  return {
    setSet(s) {
      clear();
      set = s;
      if (s) entries = s.landmarks.map((l) => build(l));
      for (const e of entries) for (const m of e.meshes) m.updateMatrixWorld(true);
    },
    update(dt, _t, inputs, patch) {
      if (!set) return;
      const crust = inputs.terrain.crust;
      if (!tinted && crust) {   // once per set: rock landmarks take the colours of the mineral they stand on
        tinted = true;
        entries = entries.map((e) => {
          if (!ROCK_KINDS.has(e.lm.kind)) return e;
          const rock = rockPalette(mineralIdAt(crust, e.lm.x, e.lm.z));
          if (!rock) return e;
          for (const m of e.meshes) { root.remove(m); m.geometry.dispose(); }
          return build(e.lm, rock);
        });
        lastInputs = null;
      }
      const state: TerrainState = { rise: inputs.terrain.rise, progress: inputs.terrain.progress, heatSolvent: inputs.heatSolvent };
      const fresh = inputs !== lastInputs;
      lastInputs = inputs;
      const k = 1 - Math.exp(-dt / 4);
      for (const e of entries) {
        const { lm } = e;
        if (fresh) {
          e.grow = set.growth(lm, state);
          if (lm.kind === 'iceArch') {
            const c = Math.cos(lm.angle) * lm.span / 2, s = Math.sin(lm.angle) * lm.span / 2;
            e.pierY = [set.plainHeight(lm.x - c, lm.z - s, state), set.plainHeight(lm.x + c, lm.z + s, state)];
          } else e.baseY = set.plainHeight(lm.x, lm.z, state);
          if (lm.biomass) {
            const f = biomassFactors(biomassAround(inputs.flora, lm.x, lm.z, patch));
            e.tTall = f.tall;
            e.tThick = f.thick;
          }
        }
        if (lm.biomass) {
          e.tall += (e.tTall - e.tall) * k;
          e.thick += (e.tThick - e.thick) * k;
        }
        place(e);
      }
    },
    get count() {
      return entries.length;
    },
    dispose() {
      clear();
      app.scene.remove(root);
      warm.dispose();
      material.dispose();
    },
  };
}
