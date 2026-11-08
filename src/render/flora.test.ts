import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { makeStubVisualInputs } from './visualInputs';
import { cellAt } from './layout';
import { MAX_VERTEX_BUFFERS, createFlora, vertexBuffers } from './flora';
import { floraLibrary } from './floraLib';
import { LOOK_INSTANCE_ATTRS, lookGeometry } from './floraLib/instance';
import { paintSites } from './floraLib';
import { LOOK_PALETTES } from './palette';
import type { App } from './app';
import type { VisualInputs } from '../worlds/types';

const PATCH = 400;
function inputs(fill: (c: number) => [number, number]): VisualInputs {
  const flora = new Float32Array(64 * 64 * 2);
  for (let c = 0; c < 4096; c++) { const [m, k] = fill(c); flora[c * 2] = m; flora[c * 2 + 1] = k; }
  return { ...makeStubVisualInputs(), flora, seaLevel: -1, terrain: { rise: 1, progress: {}, height: () => 0, patchSize: PATCH }, lifeOnLand: true, buildProgress: 1 };
}
function fakeApp(): App {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  camera.position.set(0, 3, 6);
  return { scene: new THREE.Scene(), camera } as unknown as App;
}

describe('flora buckets', () => {
  it('every bucket and warm-up mesh binds at most 8 vertex buffers (WebGPU default; three r187 shared builds)', () => {
    const app = fakeApp();
    const flora = createFlora(app);
    const over: string[] = [];
    let n = 0;
    for (const o of app.scene.getObjectByName('flora')!.children) {
      const mesh = o as THREE.InstancedMesh;
      if (!mesh.isInstancedMesh) continue;
      n++;
      if (vertexBuffers(mesh) > MAX_VERTEX_BUFFERS) over.push(`${mesh.name || 'warm-up'}: ${vertexBuffers(mesh)}`);
    }
    expect(n).toBeGreaterThan(30);
    expect(over).toEqual([]);
    flora.dispose();
  });

  it('every look geometry (the buckets\' and the producer card\'s) counts at most 8 with its per-instance buffers and matrix', () => {
    const over: string[] = [];
    for (const a of floraLibrary().archetypes) for (const [lod, l] of a.lod.entries()) {
      const n = Object.keys(lookGeometry(l).attributes).length + LOOK_INSTANCE_ATTRS + 1;
      if (n > MAX_VERTEX_BUFFERS) over.push(`${a.key}/L${lod}: ${n}`);
      // the part weights stay as source data, one (rim, cap) pair per vertex
      if (l.part) expect(l.part.length, a.key).toBe(2 * l.geometry.getAttribute('position').count);
    }
    expect(over).toEqual([]);
  });
});

describe('packed look geometry (aVtx)', () => {
  it('carries the library\'s sway, painted glow-site weights, colours and part weights unchanged', () => {
    let bad = 0, checked = 0;
    for (const a of floraLibrary().archetypes) for (const l of a.lod) for (const dark of [false, true]) {
      const pal = LOOK_PALETTES[a.chem];
      const look = lookGeometry(l), ref = l.geometry.clone(); // ref: the unpacked layout (aSway, aGlow)
      paintSites({ ...l, geometry: look }, pal, dark);
      paintSites({ ...l, geometry: ref }, pal, dark);
      const v = look.getAttribute('aVtx').array, sway = ref.getAttribute('aSway').array, glow = ref.getAttribute('aGlow').array;
      const c = look.getAttribute('color').array, cr = ref.getAttribute('color').array;
      for (let i = 0; i < sway.length; i++) {
        if (v[i * 4] !== sway[i] || v[i * 4 + 1] !== glow[i]) bad++;
        if (l.part && (v[i * 4 + 2] !== l.part[i * 2] || v[i * 4 + 3] !== l.part[i * 2 + 1])) bad++;
        checked++;
      }
      for (let i = 0; i < c.length; i++) if (c[i] !== cr[i]) bad++;
      expect(look.getAttribute('aSway') ?? look.getAttribute('aGlow') ?? look.getAttribute('aPart')).toBeUndefined();
      ref.dispose();
    }
    expect(checked).toBeGreaterThan(10000);
    expect(bad).toBe(0);
  });
});

describe('per-vertex deformation weights', () => {
  it('vertices at the same position carry the same rim (teeth) and cap (droop) weights, so no seam tears (every archetype × LOD)', () => {
    const torn: string[] = [];
    let shared = 0, oldScheme = 0;
    for (const a of floraLibrary().archetypes) for (const [lod, l] of a.lod.entries()) {
      if (!l.part) continue;
      const pos = l.geometry.getAttribute('position').array, q = 1e5 / Math.max(1e-3, a.size);
      const seen = new Map<string, number>();
      let bad = 0;
      for (let v = 0; v < pos.length / 3; v++) {
        const key = `${Math.round(pos[v * 3] * q)},${Math.round(pos[v * 3 + 1] * q)},${Math.round(pos[v * 3 + 2] * q)}`;
        const w = seen.get(key);
        if (w === undefined) { seen.set(key, v); continue; }
        shared++;
        if (l.part[w * 2] !== l.part[v * 2] || l.part[w * 2 + 1] !== l.part[v * 2 + 1]) bad++;
        // the old shader parity (vertexIndex & 1) tore doubled rings apart: the scan must see that
        if (Math.max(l.part[w * 2], l.part[v * 2]) > 0 && (w & 1) !== (v & 1)) oldScheme++;
      }
      if (bad) torn.push(`${a.key}/L${lod}: ${bad} split positions`);
    }
    expect(shared).toBeGreaterThan(1000); // doubled rings and seams exist, so the scan bites
    expect(torn).toEqual([]);
    expect(oldScheme).toBeGreaterThan(0);
  });
});

describe('FloraPart.plantsIn', () => {
  it('returns exactly the plants the world drew in a cell, after the spawn clearing, with their drawn instance matrices', () => {
    const app = fakeApp();
    const flora = createFlora(app);
    flora.setClearing(0, 0, 25);
    flora.update(0, 1, inputs(() => [0.6, 1]), PATCH);
    const list = flora.placed();
    const meshes = new Map<string, THREE.InstancedMesh>();
    for (const o of app.scene.getObjectByName('flora')!.children) meshes.set(o.name, o as THREE.InstancedMesh);
    const m = new THREE.Matrix4();
    const drawnIn = (p: { key: string; lod: number; dark: boolean; matrix: THREE.Matrix4 }) => {
      const mesh = meshes.get(`${p.key}/L${p.lod}${p.dark ? 'd' : ''}`)!;
      // the bucket stores its matrices as float32, the record keeps them in double precision
      const same = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.every((v, j) => Math.abs(v - b.elements[j]) <= 1e-5 * (1 + Math.abs(v)));
      for (let k = 0; k < mesh.count; k++) if (same(mesh.getMatrixAt(k, m), p.matrix)) return true;
      return false;
    };
    // the cell under the spawn clearing holds ground cover only; a cell with a grove or a giant outside it gets them too
    let grove = -1;
    for (let i = 0; i < list.n && grove < 0; i++) if (list.h[i] > 4) grove = list.cell[i]; // mid and giant plants are ≥ 5 m full grown
    expect(grove).toBeGreaterThanOrEqual(0);
    for (const [cell, tall] of [[cellAt(0, 0, PATCH), false], [grove, true]] as const) {
      const got = flora.plantsIn(cell);
      let inList = 0;
      for (let i = 0; i < list.n; i++) if (list.cell[i] === cell) inList++;
      expect(got.length, `cell ${cell}`).toBe(inList); // nothing dropped for capacity here
      expect(got.length).toBeGreaterThan(0);
      expect(got.some((p) => p.role !== 'ground'), `tall plants in cell ${cell}`).toBe(tall);
      for (const p of got) {
        expect(p.cell).toBe(cell);
        expect(drawnIn(p), `${p.key} drawn as recorded`).toBe(true);
        expect(p.height).toBeGreaterThan(0);
        expect(p.radius).toBeGreaterThan(0);
      }
    }
    flora.dispose();
  });
});
