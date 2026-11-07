import { describe, expect, it } from 'vitest';
import { createTerrain } from '../gen/terrain';
import { carbonLike, siliconLike } from '../gen/terrainFixtures';
import { createTerrainMesh, createTerrainUniforms, setTerrainUniforms } from './terrainNode';

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
});
