// Basalt pillars (M7): one InstancedMesh of flat-shaded hexagonal prisms on worldMaterial, drawn on the hex lattice that
// gen/terrain.ts `pillarCell` flattens into the CPU height. The GPU ground mesh leaves M7 out, so the prisms ARE the pillars.
// The ink outline comes from the pixel post pass's depth edges (post.ts), like every other prop. Read-only: layout and tops
// are pure functions of (terrain, state) in gen/pillars.ts; colours come from the crust (mineralColour + rust ratchet).
import * as THREE from 'three/webgpu';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';
import type { Terrain, TerrainState } from '../gen/terrain';
import { pillarCandidates, pillarTops, type PillarSet } from '../gen/pillars';
import { attribute, float, mix, positionWorld, smoothstep, uniform, vec3, mx_noise_float } from 'three/tsl';
import { worldMaterial } from './material';
import { mineralColour } from './crustLook';
import { GROUND } from './terrainNode';

/** Unit hexagonal prism (y 0..1, pointy along z to match Kit.hexCell), non-indexed: 6 top + 12 side triangles. */
export function hexPrismGeometry(size: number): THREE.BufferGeometry {
  const R = (size / Math.sqrt(3)) * 0.985;    // circumradius; the 1.5% gap leaves an ink line between neighbours
  const v = Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 2 + k * Math.PI / 3; return [R * Math.cos(a), R * Math.sin(a)] as const; });
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  for (let k = 0; k < 6; k++) {
    const [x0, z0] = v[k], [x1, z1] = v[(k + 1) % 6];
    tri([0, 1, 0], [x1, 1, z1], [x0, 1, z0]);                                // top, facing +y
    tri([x0, 0, z0], [x1, 1, z1], [x1, 0, z1]); tri([x0, 0, z0], [x0, 1, z0], [x1, 1, z1]);   // side, facing outward
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  // per-vertex top-versus-side factor: tops read ~20% lighter than the sides (Icelandic columns: lit, weathered tops)
  const shade = new Float32Array(pos.length / 3);
  for (let i = 0; i < shade.length; i++) shade[i] = pos[i * 3 + 1] === 1 && Math.abs(g.getAttribute('normal').getY(i)) > 0.5 ? 1 : 0.83;
  g.setAttribute('pshade', new THREE.BufferAttribute(shade, 1));
  return g;
}

export interface PillarsPart {
  /** Lay out the pillars for this terrain (once per world, seed and crust). */
  setTerrain(t: Terrain | null): void;
  update(dt: number, inputs: VisualInputs): void;
  readonly count: number;
  dispose(): void;
}

const CHUNK = 400;           // pillars re-evaluated per frame while the state is changing
const _c = new THREE.Color();

export function createBasaltPillars(app: App): PillarsPart {
  // Base colour per instance (`pbase`, linear rgb, rewritten only when the rust changes), top/side factor per vertex (`pshade`).
  // Lichen: yellow-ochre patches on the tops, one uniform (the world's eased lifeOnLand). Per pillar `plichen` (0..0.85, a hash)
  // sets how much of its top is covered, and world-position noise makes the cover patchy. No per-frame instance rewrites.
  const lichenOn = uniform(0);
  const lc = new THREE.Color(0xb89a3a);
  const lichenCol = vec3(lc.r, lc.g, lc.b);
  const shadeA = attribute('pshade', 'float');
  const cover = GROUND.life.mul(lichenOn).mul(attribute('plichen', 'float'));
  const noise = mx_noise_float(vec3(positionWorld.x.mul(1.3), positionWorld.y.mul(0.2), positionWorld.z.mul(1.3))).mul(0.5).add(0.5);
  const thr = float(1).sub(cover);
  const lichen = smoothstep(thr, thr.add(0.12), noise).mul(smoothstep(0.9, 0.95, shadeA));
  const material = worldMaterial({ kind: 'prop', flat: true, colorNode: mix(attribute('pbase', 'vec3').mul(shadeA), lichenCol, lichen) });
  const root = new THREE.Group();
  root.name = 'basaltPillars';
  app.scene.add(root);
  let mesh: THREE.InstancedMesh | null = null;
  let geo: THREE.BufferGeometry | null = null;
  let terrain: Terrain | null = null;
  let set: PillarSet | null = null;
  let cursor = 0;
  let dirty = true;
  let last = { rise: -1, p7: -1, hs: -1, sig: '' };
  let lastRust = -1, rustT = 0;

  function clear() {
    if (mesh) { root.remove(mesh); mesh.dispose(); }
    geo?.dispose();
    mesh = null; geo = null; set = null; terrain = null;
  }

  function colours(rust: number) {
    if (!mesh || !set || !terrain) return;
    const ids = terrain.config.crust.minerals.map((m) => m.id);
    const a = geo!.getAttribute('pbase') as THREE.BufferAttribute;
    for (let i = 0; i < set.count; i++) {
      _c.setHex(mineralColour(ids[set.mineral[i]], rust));
      _c.multiplyScalar(0.82 + 0.36 * set.shade[i]);
      a.setXYZ(i, _c.r, _c.g, _c.b);
    }
    a.needsUpdate = true;
    lastRust = rust;
  }

  function setMatrix(i: number, present: boolean, base: number, top: number) {
    const a = mesh!.instanceMatrix.array as Float32Array;
    const h = top - base, o = i * 16;
    const on = present && h > 0.01;
    a[o] = on ? 1 : 0; a[o + 5] = on ? h : 0; a[o + 10] = on ? 1 : 0; a[o + 15] = 1;
    a[o + 12] = set!.cx[i]; a[o + 13] = base; a[o + 14] = set!.cz[i];
  }

  return {
    setTerrain(t) {
      clear();
      if (!t) return;
      const s = pillarCandidates(t);
      if (s.count === 0) return;
      terrain = t; set = s;
      geo = hexPrismGeometry(s.size);
      geo.setAttribute('pbase', new THREE.InstancedBufferAttribute(new Float32Array(s.count * 3), 3));
      const li = new Float32Array(s.count);
      for (let i = 0; i < s.count; i++) li[i] = 0.85 * ((s.shade[i] * 7.31) % 1);   // a second hash of the column, so lichen cover is independent of its value
      geo.setAttribute('plichen', new THREE.InstancedBufferAttribute(li, 1));
      mesh = new THREE.InstancedMesh(geo, material, s.count);
      mesh.frustumCulled = false;   // one draw call across the whole patch
      mesh.name = 'basaltPillars';
      colours(GROUND.rust.value as number);
      root.add(mesh);
      cursor = 0; dirty = true; last = { rise: -1, p7: -1, hs: -1, sig: '' };
    },
    update(dt, inputs) {
      lichenOn.value = inputs.world.id === 'carbon' ? 1 : 0;   // silicon has no lichen: its flora is crystalline
      if (!mesh || !set || !terrain) return;
      const pr = inputs.terrain.progress;
      const sig = ['M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'M9'].map((k) => Math.round((pr[k] ?? 0) * 200)).join(',');
      const rise = inputs.terrain.rise, p7 = pr.M7 ?? 0, hs = inputs.heatSolvent;
      if (!dirty && cursor === 0 && (Math.abs(rise - last.rise) > 0.004 || Math.abs(p7 - last.p7) > 0.004 || Math.abs(hs - last.hs) > 0.004 || sig !== last.sig)) {
        dirty = true;
        last = { rise, p7, hs, sig };
      }
      if (dirty) {
        if (cursor === 0) last = { rise, p7, hs, sig };
        const st: TerrainState = { rise, heatSolvent: hs, progress: pr };
        const end = Math.min(set.count, cursor + CHUNK);
        for (let i = cursor; i < end; i++) { const p = pillarTops(terrain, set, i, st); setMatrix(i, p.present, p.base, p.top); }
        cursor = end;
        mesh.instanceMatrix.needsUpdate = true;
        if (cursor >= set.count) { cursor = 0; dirty = false; }
      }
      rustT += dt;
      const rust = GROUND.rust.value as number;
      if (rustT > 0.25 && Math.abs(rust - lastRust) > 0.01) { rustT = 0; colours(rust); }
    },
    get count() { return set?.count ?? 0; },
    dispose() { clear(); app.scene.remove(root); material.dispose(); },
  };
}
