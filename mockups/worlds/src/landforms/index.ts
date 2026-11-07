// Landforms: terrain rings, spires (+horns, pores, glow), arches, walls/crust, procedural filler.
// Everything reads WorldUniforms in the shaders, so the dials morph it live. Geometry is fixed per preset.
import * as THREE from 'three/webgpu';
import { float, uniform } from 'three/tsl';
import type { Landmark, TSLNode, Vec2, WorldContext, WorldModule } from '../contracts';
import { buildArch, buildSpire, buildWall, spireProfile, wallProfile, type Geo } from './geo';
import { bakePores } from './pores';
import { archNodes, poreNodes, terrainColor } from './nodes';
import { makeTerrainHeight, buildRing, ringSpecs, terrainParams } from './terrain';
import { clamp, mix, smoothstep } from './noise';

const toGeometry = (g: Geo): any => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(g.aT, 1));
  geo.setIndex(new THREE.Uint32BufferAttribute(g.idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
};

/** Point `along` metres down the path (extrapolating past the end) plus its unit direction. */
function pathAt(path: Vec2[], along: number): { p: Vec2; dir: Vec2 } {
  let rest = along;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1][0] - path[i][0], dz = path[i + 1][1] - path[i][1], l = Math.hypot(dx, dz) || 1;
    if (rest <= l || i === path.length - 2) {
      const t = rest / l;
      return { p: [path[i][0] + dx * t, path[i][1] + dz * t], dir: [dx / l, dz / l] };
    }
    rest -= l;
  }
  return { p: path[0], dir: [0, -1] };
}

export default function landforms(): WorldModule {
  const disposables: Array<{ dispose(): void }> = [];
  const group = new THREE.Group();
  group.name = 'landforms';
  let tris = 0;

  // update-time state
  const heroSpires: any[] = [];
  const fillers: Array<{ mesh: any; items: Array<{ x: number; y: number; z: number; yaw: number; sx: number; sy: number; r: number; f: number }> }> = [];
  let archSurvive: TSLNode;
  let dummy: any;
  let uRock: TSLNode;

  return {
    id: 'landforms',

    build(ctx: WorldContext) {
      const u = ctx.uniforms, d = ctx.derived, comp = ctx.preset.composition, dials = ctx.preset.dials;
      const low = ctx.quality === 'low';
      const rnd = ctx.rng('landforms');
      const seed = dials.seed;
      const camPos = comp.camera.position;

      // ------------------------------------------------ terrain
      const tp = terrainParams(comp.valley, comp.valleyWidth, dials.heat, d.snow, d.life, dials.sea.acid, seed);
      const height = makeTerrainHeight(tp);
      ctx.terrainHeight = height;
      const halfW = Math.max(4, comp.valleyWidth / 2);

      const uCrust = uniform(tp.acid);
      uRock = uniform(smoothstep(0.4, 0.8, d.builders));
      const terrainMat = ctx.materials.create({ color: terrainColor(u, uCrust, uRock), snowCover: true });
      disposables.push(terrainMat);
      for (const spec of ringSpecs(ctx.quality)) {
        const r = buildRing(height, spec);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(r.position, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(r.normal, 3));
        geo.setAttribute('aU', new THREE.BufferAttribute(r.aU, 1));
        geo.setAttribute('aCrust', new THREE.BufferAttribute(r.aCrust, 1));
        geo.setIndex(new THREE.BufferAttribute(r.index, 1));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, terrainMat);
        m.frustumCulled = false; m.receiveShadow = true;
        group.add(m); disposables.push(geo);
        tris += r.index.length / 3;
      }

      // ------------------------------------------------ materials
      const LAYER_DENS: [number, number, number] = [0.9, 0.4, 0.45];
      const makeTex = (data: Uint8Array, w: number, h: number) => {
        const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
        t.magFilter = t.minFilter = THREE.LinearFilter;
        t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
        t.generateMipmaps = false; t.needsUpdate = true;
        disposables.push(t);
        return t;
      };
      interface StoneSpec {
        H: number; bury: number; radiusAt: (y: number) => [number, number];
        scale: number; res: [number, number]; porousMul: number; vertex: boolean;
        fine: boolean; fineSize?: number; glow?: boolean; darken?: number; warm?: boolean; capTop?: boolean; graded?: boolean;
      }
      /** Bakes this shape's pore field once, then builds the stone material that reads it. */
      const stoneMat = (sp: StoneSpec) => {
        const sc = sp.scale;
        const q = low ? 0.5 : 1;
        const W = Math.round(sp.res[0] * q), Hp = Math.round(sp.res[1] * q);
        const t0 = performance.now();
        const baked = bakePores({
          W, Hpx: Hp, H: sp.H, bury: sp.bury, radiusAt: sp.radiusAt,
          layers: [
            { size: 11 * sc, rLo: 0.3, rHi: 0.45, off: 0, dens: LAYER_DENS[0] },
            { size: 6 * sc, rLo: 0.24, rHi: 0.4, off: 11.3, dens: LAYER_DENS[1] },
            sp.fine ? { size: (sp.fineSize ?? 1.8) * sc, rLo: 0.2, rHi: 0.38, off: 27.1, dens: LAYER_DENS[2] } : null,
          ],
          sizeMul: sp.graded ? (y) => mix(1.25, 0.55, smoothstep(0, sp.H * 0.75, y)) : undefined,
          densBuild: clamp(d.pores * sp.porousMul, 0, 1), vertex: sp.vertex, scale: Math.max(0.3, sc), seed,
        });
        bakeMs += performance.now() - t0;
        const n = poreNodes(u, {
          tex1: makeTex(baked.t1, W, Hp), tex2: makeTex(baked.t2, W, Hp), maxD: baked.maxD, H: sp.H, bury: sp.bury,
          dens: LAYER_DENS, porousMul: sp.porousMul, vertex: sp.vertex, glow: sp.glow, darken: sp.darken, warm: sp.warm, capTop: sp.capTop,
        });
        const m = ctx.materials.create({ stone: true, snowCover: true, color: n.tint, emissive: n.emissive, positionNode: n.position });
        disposables.push(m);
        return m;
      };
      let bakeMs = 0;

      const place = (mesh: any, x: number, z: number, sink = 0) => {
        mesh.position.set(x, height(x, z) - sink, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
      };
      const addGeo = (geo: any, mat: any, x: number, z: number) => {
        disposables.push(geo);
        tris += geo.index.count / 3;
        const mesh = new THREE.Mesh(geo, mat);
        place(mesh, x, z);
        return mesh;
      };
      const segFactor = (x: number, z: number) => {
        const dist = Math.hypot(x - camPos[0], z - camPos[2]);
        return (dist < 60 ? 1 : dist < 150 ? 0.6 : 0.4) * (low ? 0.6 : 1);
      };

      // ------------------------------------------------ landmarks
      archSurvive = uniform(1);
      let i = 0;
      for (const lm of comp.landmarks as Landmark[]) {
        i++;
        if (lm.kind === 'spire') {
          const f = segFactor(lm.pos[0], lm.pos[1]);
          const g = buildSpire({
            H: lm.height, R: lm.radius, erosion: d.erosion, lean: lm.lean, horns: lm.horns,
            radial: Math.max(40, Math.round(Math.min(220, (2 * Math.PI * lm.radius) / 0.55) * f)) & ~1, rings: Math.round(380 * f), seed: seed + i * 7,
          });
          const porous = lm.porous ? 1 : 0.15;
          const bury = Math.max(3, lm.height * 0.03);
          const mat = stoneMat({
            H: lm.height, bury, radiusAt: (y) => { const r = lm.radius * spireProfile(y / lm.height, lm.horns ? Math.min(d.erosion, 0.3) : d.erosion); return [r, r]; },
            scale: lm.radius / 14, res: f > 0.9 ? [512, 1024] : f > 0.5 ? [384, 768] : [256, 512], porousMul: porous, vertex: f > 0.5, fine: true, graded: true,
          });
          const mesh = addGeo(toGeometry(g), mat, lm.pos[0], lm.pos[1]);
          heroSpires.push(mesh);
        } else if (lm.kind === 'wall') {
          const crust = lm.height < 14;
          const f = crust ? 0.5 : segFactor(lm.pos[0], lm.pos[1]) + 0.3;
          const g = buildWall({
            H: lm.height, w: lm.width, d: lm.depth, overhang: !!lm.overhang,
            radial: Math.round((crust ? 56 : 72) * f), rings: Math.round((crust ? 36 : 110) * f), seed: seed + i * 13,
          });
          const m = stoneMat({
            H: lm.height, bury: Math.max(1.5, lm.height * 0.06),
            radiusAt: (y) => { const pr = crust ? Math.sqrt(Math.max(0, 1 - Math.pow(y / lm.height, 2.4))) * (1 + 0.5 * Math.exp(-(y / lm.height) * 6)) : wallProfile(y / lm.height, !!lm.overhang); return [lm.width / 2 * pr, lm.depth / 2 * pr]; },
            scale: clamp(Math.min(lm.width, lm.depth) / 18, 0.3, 2), res: crust ? [160, 96] : [384, 256], porousMul: crust ? 1.5 : 1, vertex: !crust,
            fine: true, fineSize: crust ? 0.9 : 1.8, glow: !crust, warm: crust, capTop: !crust && !!lm.overhang, graded: !crust,
          });
          const mesh = addGeo(toGeometry(g), m, lm.pos[0], lm.pos[1]);
          mesh.rotation.y = lm.yaw ?? 0;
        } else if (lm.kind === 'arch') {
          const ha = height(lm.a[0], lm.a[1]), hb = height(lm.b[0], lm.b[1]);
          const g = buildArch({ a: lm.a, b: lm.b, ha, hb, apex: lm.apex, R: lm.radius, radial: low ? 20 : 32, rings: low ? 90 : 150, seed: seed + i * 5 });
          const an = archNodes(u, archSurvive, lm.radius);
          const mat = ctx.materials.create({ snowCover: true, color: an.tone, positionNode: an.position });
          mat.opacityNode = an.opacity; mat.alphaTest = 0.5; mat.transparent = false;
          disposables.push(mat);
          const geo = toGeometry(g); disposables.push(geo); tris += geo.index.count / 3;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true; mesh.receiveShadow = true;
          group.add(mesh); // world-space geometry
        }
      }

      // ------------------------------------------------ filler spires (instanced, low-poly, far away)
      const nFill = Math.round((low ? 14 : 30) * smoothstep(0.5, 0.85, d.builders));
      if (nFill > 0) {
        const VARIANTS = 3, Hv = 100, Rv = 8;
        const far = comp.valleyWidth > 200 ? 1400 : 700;
        const fmat = stoneMat({
          H: Hv, bury: 6, radiusAt: (y) => { const r = Rv * spireProfile(y / Hv, d.erosion); return [r, r]; },
          scale: Rv / 14, res: [128, 256], porousMul: 0.25, vertex: false, fine: false,
        });
        const per = Math.ceil(nFill / VARIANTS);
        for (let v = 0; v < VARIANTS; v++) {
          const geo = toGeometry(buildSpire({ H: Hv, R: Rv, erosion: d.erosion, radial: low ? 12 : 18, rings: low ? 32 : 56, seed: seed + 100 + v, bury: 6, horns: false }));
          disposables.push(geo);
          const mesh = new THREE.InstancedMesh(geo, fmat, per);
          mesh.frustumCulled = false; mesh.castShadow = false;
          const items: any[] = [];
          for (let k = 0; k < per; k++) {
            const along = mix(70, far, Math.pow(rnd(), 0.8));
            const { p, dir } = pathAt(comp.valley, along);
            const side = rnd() < 0.5 ? -1 : 1;
            const lat = side * (Math.min(halfW, 60) * 1.3 + rnd() * (halfW > 100 ? 450 : 90));
            const x = p[0] + -dir[1] * lat, z = p[1] + dir[0] * lat;
            const H = (28 + 80 * rnd()) * (1 - 0.5 * along / far);
            const R = H * (0.05 + 0.05 * (1 - d.erosion)) * (0.8 + 0.4 * rnd());
            items.push({ x, y: height(x, z), z, yaw: rnd() * 6.28, sx: R / Rv, sy: H / Hv, r: rnd(), f: 0 });
          }
          fillers.push({ mesh, items });
          group.add(mesh);
          tris += (geo.index.count / 3) * per * 0.5; // rough: about half are visible
        }
      }

      // ------------------------------------------------ crust lumps (acid sponge) along the path edge
      if (tp.acid > 0.4 || tp.snow > 0.3) {
        const snowyG = tp.snow > tp.acid;
        const geos = [0, 1, 2].map((v) => toGeometry(buildWall({ H: 6, w: 7 + v, d: 6 + v * 0.5, overhang: false, radial: 40, rings: 28, seed: seed + 300 + v })));
        const snowy = tp.snow > tp.acid;
        const cmat = stoneMat({
          H: 6, bury: 1.5, radiusAt: (y) => { const pr = Math.sqrt(Math.max(0, 1 - Math.pow(y / 6, 2.4))) * (1 + 0.5 * Math.exp(-(y / 6) * 6)); return [3.5 * pr, 3 * pr]; },
          scale: 0.3, res: [160, 96], porousMul: snowy ? 0.6 : 0.8, vertex: false, fine: true, fineSize: 0.9, glow: false, darken: snowy ? 0.5 : 1.15, warm: !snowy,
        });
        const dummy = new THREE.Object3D();
        const nC = low ? 18 : snowy ? 48 : 66, per = Math.ceil(nC / 3);
        geos.forEach((geo, v) => {
          disposables.push(geo);
          const mesh = new THREE.InstancedMesh(geo, cmat, per);
          mesh.castShadow = true; mesh.receiveShadow = true;
          for (let k = 0; k < per; k++) {
            const along = snowy ? 14 + rnd() * 120 : 4 + rnd() * 110;
            const { p, dir } = pathAt(comp.valley, along);
            const side = rnd() < 0.5 ? -1 : 1;
            const lat = side * (halfW * (snowy ? 0.45 + rnd() * 0.6 : 0.5 + rnd() * 0.9));
            const x = p[0] + -dir[1] * lat, z = p[1] + dir[0] * lat;
            const s = snowy ? 0.45 + rnd() * rnd() * 1.4 : 0.18 + rnd() * rnd() * 0.5;
            dummy.position.set(x, height(x, z), z);
            dummy.rotation.set(0, rnd() * 6.28, 0);
            dummy.scale.set(s, s * (0.7 + rnd() * 0.5), s);
            dummy.updateMatrix();
            mesh.setMatrixAt(k, dummy.matrix);
          }
          group.add(mesh);
          tris += (geo.index.count / 3) * per;
        });
      }

      ctx.scene.add(group);
      (window as any).__landformTris = Math.round(tris);
      console.info(`[landforms] ~${Math.round(tris / 1000)}k tris (${ctx.quality}), pore bake ${Math.round(bakeMs)} ms`);
    },

    update(ctx: WorldContext, dt: number) {
      // arches thin and crumble as derived.arches drops (derived is already morphing)
      if (uRock) uRock.value = smoothstep(0.4, 0.8, ctx.derived.builders);
      if (archSurvive) archSurvive.value = smoothstep(0.08, 0.55, ctx.derived.arches);
      // spire heights follow the dial
      const sh = ctx.derived.spireHeight;
      for (const m of heroSpires) m.scale.y += (sh - m.scale.y) * Math.min(1, dt * 2);
      // filler spires grow in/out with builders
      dummy ??= new THREE.Object3D();
      const b = ctx.derived.builders;
      for (const fl of fillers) {
        let dirty = false;
        for (let k = 0; k < fl.items.length; k++) {
          const it = fl.items[k];
          const target = it.r < b ? 1 : 0;
          if (Math.abs(target - it.f) > 1e-3 || fl.mesh.__init !== true) {
            it.f += (target - it.f) * Math.min(1, dt * 2);
            dirty = true;
          }
          dummy.position.set(it.x, it.y, it.z);
          dummy.rotation.set(0, it.yaw, 0);
          const s = Math.max(1e-4, it.f);
          dummy.scale.set(it.sx * Math.max(0.2, s), it.sy * s * sh, it.sx * Math.max(0.2, s));
          dummy.updateMatrix();
          fl.mesh.setMatrixAt(k, dummy.matrix);
        }
        fl.mesh.__init = true;
        if (dirty) fl.mesh.instanceMatrix.needsUpdate = true;
      }
    },

    dispose() {
      for (const d of disposables) d.dispose();
      disposables.length = 0;
      group.removeFromParent();
      heroSpires.length = 0; fillers.length = 0;
    },
  };
}
