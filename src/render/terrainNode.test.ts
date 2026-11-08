import { describe, expect, it } from 'vitest';
import { float } from 'three/tsl';
import { Mesh, BoxGeometry, MeshBasicNodeMaterial, NodeBuilder } from 'three/webgpu';
import { createTerrain } from '../gen/terrain';
import { carbon } from '../worlds/carbon';
import { silicon } from '../worlds/silicon';
import { carbonLike, siliconLike } from '../gen/terrainFixtures';
import { createHeightNode, createTerrainMesh, createTerrainUniforms, setTerrainUniforms } from './terrainNode';

// Graph construction only (no GPU here): catches API typos and wrong node types in the TSL mirror.
describe('terrainNode', () => {
  it.each([['carbon', carbonLike], ['silicon', siliconLike]] as const)('builds a displaced mesh for the %s config', (_n, cfg) => {
    const terrain = createTerrain(cfg, 3);
    const u = createTerrainUniforms();
    setTerrainUniforms(u, { rise: 0.5, heatSolvent: 0.4, progress: { M3: 1, M4: 0.2 } });
    expect(u.rise.value).toBe(0.5);
    expect(u.progress.M4.value).toBe(0.2);
    const mesh = createTerrainMesh(terrain, u, { segments: 8 });
    expect(mesh.geometry.getAttribute('position').count).toBe(81);
    expect((mesh.material as { positionNode?: unknown }).positionNode).toBeTruthy();
  });

  it.each([['carbon', carbon, ['M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']], ['silicon', silicon, ['M2', 'M4', 'M5', 'M7', 'M8', 'M9']]] as const)(
    'the %s height node builds only the machines its config lists', (_n, world, listed) => {
      const terrain = createTerrain(world.terrain, world.demoSeed);
      const read: string[] = [];
      const machines = new Proxy(terrain.params.machines, { get: (t, k) => { read.push(String(k)); return (t as never)[k]; } });
      const spied = { ...terrain, params: { ...terrain.params, machines } };
      const node = createHeightNode(spied, createTerrainUniforms())(float(1), float(2));
      const mat = new MeshBasicNodeMaterial();
      const Builder = NodeBuilder as unknown as new (o: unknown, r: unknown, p: unknown) => { material: unknown };   // abstract in types, bare-constructible at runtime
      const nb = new Builder(new Mesh(new BoxGeometry(), mat), {}, {});
      nb.material = mat;
      node.build(nb as never);   // the Fn body runs here; an unused machine's params are never read
      expect([...new Set(read)].sort()).toEqual([...listed]);
    });
});
