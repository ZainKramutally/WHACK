// Flora: 9 niche-gated instanced species + motes. See docs/features/world-generator.md §2/§7.
import { uniform } from 'three/tsl';
import type { WorldContext, WorldModule } from '../contracts';
import { BUILDERS, Env } from './species';
import { FloraMesh, buildInstanced, visibleCount } from './build';
import { makeValley } from './placement';
import { buildMotes } from './motes';

export default function flora(): WorldModule {
  const meshes: FloraMesh[] = [];
  let motes: ReturnType<typeof buildMotes> | null = null;
  const own = { capWidth: uniform(0.3), stalkHeight: uniform(0.3) };

  return {
    id: 'flora',
    build(ctx: WorldContext) {
      const env: Env = {
        ctx, rng: ctx.rng('flora:place'), valley: makeValley(ctx.preset.composition.valley), q: ctx.quality === 'low' ? 0.5 : 1,
        lm: ctx.preset.composition.landmarks, vw: ctx.preset.composition.valleyWidth, ownUniforms: own,
      };
      own.capWidth.value = ctx.derived.capWidth; own.stalkHeight.value = ctx.derived.stalkHeight;
      for (const b of BUILDERS) {
        const sb = b(env);
        const fm = buildInstanced(ctx, sb.id, sb.geo, sb.mat, sb.insts, { castShadow: sb.shadow });
        meshes.push(fm);
        if (sb.extra) meshes.push(...sb.extra(env, sb, fm));
      }
      motes = buildMotes(ctx);
      const tris = meshes.reduce((a, m) => a + m.tris, 0);
      (window as any).__flora = { meshes, motes, tris, instances: meshes.reduce((a, m) => a + m.n, 0) };
      console.info(`[flora] ${meshes.length} meshes, ${(window as any).__flora.instances} instances, ${tris} tris (all-visible upper bound)`);
    },
    update(ctx: WorldContext) {
      own.capWidth.value = ctx.derived.capWidth; own.stalkHeight.value = ctx.derived.stalkHeight;
      for (const m of meshes) {
        const c = visibleCount(m.rands, m.n, ctx.uniforms.niches[m.id].value);
        m.mesh.count = c; m.mesh.visible = c > 0;
      }
      motes?.update(ctx);
    },
    dispose() {
      for (const m of meshes) { m.mesh.removeFromParent(); m.mesh.geometry.dispose(); m.mesh.material.dispose(); }
      motes?.meshes.forEach((m: any) => { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); });
      meshes.length = 0; motes = null;
    },
  };
}
