import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { makeStubVisualInputs } from './visualInputs';
import { cellAt } from './layout';
import { createFlora } from './flora';
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
