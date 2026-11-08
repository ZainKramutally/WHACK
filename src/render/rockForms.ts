// Per-mineral macro rock structures in the scene (gen/rockForms.ts): lava tubes, mesas, domes, mounds, crystal clusters.
// Read-only art layer. One merged mesh per family (so roughly one draw call per family present), one shared world material
// with vertex colours. Colours come from the crust palette (mineralColour / redWorldRamp) and are re-tinted when the rust
// ratchet moves. The whole family rises out of the ground with the terrain `rise`.
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import { worldMaterial } from './material';
import { crustRatchet, mineralColour, redWorldRamp } from './crustLook';
import { lichenStep, ROLE } from '../gen/rockFormMesh';
import type { FamilyMesh, RockFormSet } from '../gen/rockForms';

export interface RockFormsPart {
  /** Replace the structures (null clears). Builds the meshes now; the material is shared with the landmarks, so already compiled. */
  setSet(set: RockFormSet | null): void;
  update(dt: number, t: number, inputs: VisualInputs, patch: number): void;
  readonly drawCalls: number;
  dispose(): void;
}

const DARK = 0x0c0a12;
/** Yellow-ochre crustose lichen (Icelandic basalt), on up-facing basalt only once life is on land. */
const LICHEN = 0xb89a3a;
const LICHEN_RUST_FREE = new Set(['basalt']);
const c = new THREE.Color();

interface Entry { fam: FamilyMesh; mesh: THREE.Mesh; colour: THREE.BufferAttribute; rustKey: number; lichenKey: number }

export function createRockFormsPart(app: App): RockFormsPart {
  const material = worldMaterial({ kind: 'prop', vertexColors: true, flat: true });
  const root = new THREE.Group();
  root.name = 'rockForms';
  app.scene.add(root);
  let entries: Entry[] = [];
  let lichen = 0;

  function clear() {
    for (const e of entries) { root.remove(e.mesh); e.mesh.geometry.dispose(); }
    entries = [];
  }

  function tint(e: Entry, rust: number, lichen: number) {
    const { fam } = e;
    const ramp = redWorldRamp(rust);
    const rampHex = [0, ramp.redLight, ramp.red, ramp.crimson, ramp.maroon];
    const base = fam.matIds.map((id) => mineralColour(id, rust));
    const arr = e.colour.array as Float32Array;
    const n = fam.role.length;
    let lastKey = -1;
    const rgb: [number, number, number] = [0, 0, 0];
    c.setHex(LICHEN);
    const lr = c.r, lg = c.g, lb = c.b;
    const lichenMat = fam.matIds.map((id) => LICHEN_RUST_FREE.has(id));
    for (let i = 0; i < n; i++) {
      const role = fam.role[i], key = role * 16 + fam.mat[i];
      if (key !== lastKey) {
        lastKey = key;
        c.setHex(role === ROLE.MINERAL ? base[fam.mat[i]] : role === ROLE.DARK ? DARK : rampHex[role]);
        rgb[0] = c.r; rgb[1] = c.g; rgb[2] = c.b;
      }
      const s = role === ROLE.DARK ? 1 : fam.shade[i];
      let r = rgb[0] * s, g = rgb[1] * s, b = rgb[2] * s;
      const m = lichen > 0 && lichenMat[fam.mat[i]] ? fam.lichen[i] * lichen : 0;   // up-facing mask x the eased lichen cover
      if (m > 0) { const k = Math.min(1, m * 1.4), ls = 0.85 + 0.3 * fam.shade[i] * 0.5; r += (lr * ls - r) * k; g += (lg * ls - g) * k; b += (lb * ls - b) * k; }
      arr[i * 3] = Math.min(1, r); arr[i * 3 + 1] = Math.min(1, g); arr[i * 3 + 2] = Math.min(1, b);
    }
    e.colour.needsUpdate = true;
    e.rustKey = Math.round(rust * 32);
    e.lichenKey = Math.round(lichen * 32);
  }

  return {
    setSet(set) {
      clear();
      lichen = 0;
      if (!set) return;
      for (const fam of set.families) {
        const g = new THREE.BufferGeometry();
        const colour = new THREE.BufferAttribute(new Float32Array(fam.role.length * 3), 3);
        g.setAttribute('position', new THREE.BufferAttribute(fam.positions, 3));
        g.setAttribute('color', colour);
        g.computeVertexNormals();                 // non-indexed: flat faces
        const mesh = new THREE.Mesh(g, material);
        mesh.frustumCulled = false;               // the family is sunk and moved as a whole
        mesh.name = `rock:${fam.family}`;
        mesh.raycast = () => {};                  // never pickable
        mesh.visible = false;
        root.add(mesh);
        const e: Entry = { fam, mesh, colour, rustKey: -1, lichenKey: -1 };
        tint(e, 0, lichen);
        entries.push(e);
      }
    },
    update(dt, _t, inputs) {
      if (!entries.length) return;
      lichen = lichenStep(lichen, inputs.lifeOnLand, dt);
      const rust = crustRatchet.update(inputs.world, inputs.stats.oxygen ?? 0, inputs.buildProgress);
      const rise = Math.min(1, Math.max(0, inputs.terrain.rise));
      for (const e of entries) {
        if (Math.round(rust * 32) !== e.rustKey || Math.round(lichen * 32) !== e.lichenKey) tint(e, rust, lichen);
        e.mesh.visible = rise > 0.004;
        e.mesh.position.y = -(1 - rise) * (e.fam.top + 5);   // at rise 0 everything is under the flat ground; the feet stay buried while it rises
      }
    },
    get drawCalls() { return entries.length; },
    dispose() {
      clear();
      app.scene.remove(root);
      material.dispose();
    },
  };
}
