// The Generate transition (CLAUDE.md "The particle box and the Generate transition"): "Mitosis Tide".
// The selection screen's real particle box divides on a steady pulse (196 → 25,088 grains); each pulse is a front sweeping outward,
// daughters arc onto the real terrain's height field (their height follows the live `rise`) and light it up grain by grain; the
// real terrain, drawn under a dark ghost slab, is revealed where grains land. The camera pushes into the box, pulls back and settles
// into the exact pose the player has at build.spawnSec. The DOM selection sheet zooms in step with the 3D camera and dissolves
// outward from the box, so frame 0 is the real selection screen and the last frame IS the live world.
//
// Everything animated is a pure function of the build clock T (the sim's timeSec, interpolated between snapshots), the run seed and
// the box layout. Grains are plain scene objects, so the app's pixel post pass treats them like the rest of the world.
//
//   const gen = createGenerate(app);
//   gen.prime(worldId, terrain, seed, conditions, handle);   // while the selection screen is up: plans in time slices, compiles
//   gen.start({ ... });                                      // on Generate, just before world:selected
import * as THREE from 'three/webgpu';
import {
  float, vec2, vec3, vec4, uniform, attribute, positionGeometry, positionWorld, cameraProjectionMatrix, cameraViewMatrix,
  mix, smoothstep, clamp, floor, fract, sin, dot, max, min, select, exp, step, abs, pow, screenCoordinate, texture, varying,
} from 'three/tsl';
import type { Terrain } from '../gen/terrain';
import { MACHINE_IDS } from '../gen/terrain';
import { startingConditions } from '../sim/limits';
import { worldFor } from '../worlds';
import type { Conditions, SimSnapshot, WorldId } from '../worlds/types';
import type { App } from './app';
import { PAL, PIXEL, worldMaterial } from './material';
import { INTERNAL_H } from './post';
import { createHeightNode, createTerrainMesh, createTerrainUniforms } from './terrainNode';
import {
  alpha, D0, hermite, LIFT, planSteps, PULSE0, PULSE_DT, refineEarly, REVEAL_RES, spawnCameraPose, sstep, GEN0,
  type CamPose, type GenPlan, type PlanInput, type Vec3,
} from './generatePlan';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** What the selection screen hands over at Generate (ui/selection/screen.ts `handle`). */
export interface LaunchHandle {
  root: HTMLElement;
  boxCanvas: HTMLCanvasElement;
  boxRect(): DOMRect;
  /** The box's dots as 0..1 fractions (y down): element atoms first. */
  seeds(): { x: number; y: number }[];
  /** Time dilation for the live box (1 = normal). */
  setBoxSpeed(k: number): void;
  dispose(): void;
}

export interface StartOptions {
  worldId: WorldId;
  requested: Conditions;
  seed: number;
  terrain: Terrain;
  handle: LaunchHandle;
  /** Latest sim snapshot (null until the first arrives). */
  snapshot(): SimSnapshot | null;
  /** Where the player will spawn (main.ts spawnFor) and the ground there as the sim stands. */
  spawnFor(s: SimSnapshot): { x: number; z: number };
  groundAt(x: number, z: number): number;
  seaLevelNow(): number;
  frozenNow(): boolean;
}

export interface Generate {
  /** Plan and compile for this world/seed/conditions while the selection screen is up. Cheap to call repeatedly: it debounces. */
  prime(worldId: WorldId, terrain: Terrain, seed: number, requested: Conditions, handle: LaunchHandle): void;
  start(o: StartOptions): void;
  dispose(): void;
}

const YC = 1.6;                       // box plane centre height (m): above the flat ground at rise 0
const PUSH = { t: 1.25, d: 2.7 };     // the camera has pushed in to here
const SLICE_MS = 5;

interface Primed {
  key: string;
  plan: GenPlan;
  group: THREE.Group;
  geo: THREE.InstancedBufferGeometry;
  ghostMat: N; grainMat: N; revealTex: THREE.DataTexture; ghostGeo: THREE.BufferGeometry;
  terrain: Terrain;
  tu: ReturnType<typeof createTerrainUniforms>;
  U: Record<string, N>;
  pxPerM0: number; boxSize: number;
  dispose(): void;
}

export function createGenerate(app: App): Generate {
  const scene = app.scene, camera = app.camera;
  let primed: Primed | null = null;
  let job: { key: string; it: Generator<void, GenPlan>; timer: number; inp: PlanInput; args: PrimeArgs } | null = null;
  let pending: PrimeArgs | null = null;
  let debounce = 0;
  let active: { stop(): void } | null = null;

  interface PrimeArgs { worldId: WorldId; terrain: Terrain; seed: number; requested: Conditions; handle: LaunchHandle }

  const dims = () => {
    const W = window.innerWidth, H = window.innerHeight;
    const baseK = PIXEL ? Math.max(1, Math.round(H / INTERNAL_H)) : 3;
    return { W, H, k: baseK, lowW: Math.ceil(W / baseK), lowH: Math.ceil(H / baseK) };
  };
  const keyOf = (a: PrimeArgs) => {
    const { W, H } = dims();
    const t = Math.round(startingConditions(worldFor(a.worldId), a.requested).start.temperature);
    return `${a.worldId}|${a.seed}|${t}|${W}x${H}`;
  };

  function planInput(a: PrimeArgs): PlanInput {
    const world = worldFor(a.worldId);
    const { lowW, lowH, W, H } = dims();
    const rect = a.handle.boxRect();
    const pxPerM0 = H / (2 * D0 * Math.tan((camera.fov * Math.PI) / 360));
    const seeds = a.handle.seeds().slice(0, GEN0);
    const nAtoms = 26;
    return {
      world, terrain: a.terrain, seed: a.seed,
      start: startingConditions(world, a.requested).start,
      lowW, lowH, fov: camera.fov, aspect: W / H,
      gen0: seeds.map((s, i) => ({ x: s.x, y: s.y, atom: i < nAtoms })),
      boxCy: YC, boxSize: rect.width / pxPerM0,
    };
  }

  function schedule(fn: () => void) {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    return ric ? ric(fn, { timeout: 60 }) : window.setTimeout(fn, 4);
  }

  function pump() {
    if (!job) return;
    const t0 = performance.now();
    while (performance.now() - t0 < SLICE_MS) {
      const r = job.it.next();
      if (r.done) {
        const j = job; job = null;
        void finish(j.args, j.key, r.value, j.inp);
        return;
      }
    }
    job.timer = schedule(pump) as number;
  }

  async function finish(a: PrimeArgs, key: string, plan: GenPlan, inp: PlanInput) {
    try {
      const p = build(a, key, plan, inp);
      scene.add(p.group);
      p.group.visible = true;
      await app.compile(p.group, camera);
      p.group.visible = false;
      primed?.dispose();
      primed = p;
    } catch (e) {
      console.warn('generate: prime failed, the plain fade will be used', e);
    }
    if (pending) { const n = pending; pending = null; prime(n.worldId, n.terrain, n.seed, n.requested, n.handle); }
  }

  /** GPU objects for a plan: the ghost slab, the reveal field and the grains. */
  function build(a: PrimeArgs, key: string, plan: GenPlan, inp: PlanInput): Primed {
    const world = worldFor(a.worldId);
    const S = a.terrain.patchSize;
    const tu = createTerrainUniforms();
    const heightN = createHeightNode(a.terrain, tu);
    const { W, H, k } = dims();
    const U = {
      T: uniform(0), vis: uniform(0), seaMix: uniform(0),
      res: uniform(new THREE.Vector2(W, H)), k: uniform(k), lrPerM: uniform(inp.lowH / (2 * Math.tan((camera.fov * Math.PI) / 360))),
    };
    const dither = fract(sin(dot(floor(screenCoordinate.xy.div(4)), vec2(12.9898, 78.233))).mul(43758.5453));

    // Reveal field (seconds, per patch texel).
    const revealTex = new THREE.DataTexture(plan.reveal, REVEAL_RES, REVEAL_RES, THREE.RedFormat, THREE.FloatType);
    revealTex.minFilter = revealTex.magFilter = THREE.NearestFilter;
    revealTex.generateMipmaps = false;
    revealTex.needsUpdate = true;

    // Ghost slab: the terrain's own displacement, lifted a little, in the world's dark tone; discarded where grains have landed.
    const terrainMesh = createTerrainMesh(a.terrain, tu);
    const tm = terrainMesh.material as N;
    const ghostMat = worldMaterial({ kind: 'ground', colorNode: mix(vec3(PAL.maroon), vec3(PAL.ink), 0.45) });
    ghostMat.positionNode = tm.positionNode.add(vec3(0, 0.12, 0));
    ghostMat.normalNode = tm.normalNode;
    const uvw = vec2(positionWorld.x.div(S).add(0.5), positionWorld.z.div(S).add(0.5));
    const revealT = texture(revealTex, uvw).r;
    ghostMat.maskNode = revealT.add(dither.mul(0.18)).greaterThan(U.T).and(dither.greaterThanEqual(U.vis));
    tm.dispose();
    const ghost = new THREE.Mesh(terrainMesh.geometry, ghostMat);
    ghost.frustumCulled = false;
    ghost.renderOrder = -1;

    // Grains.
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.instanceCount = plan.N;
    for (const [name, arr] of [['aA', plan.A], ['aB', plan.B], ['aC', plan.C], ['aD', plan.D]] as const) {
      const at = new THREE.InstancedBufferAttribute(arr, 4);
      at.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, at);
    }
    const aA = attribute('aA', 'vec4') as N, aB = attribute('aB', 'vec4') as N, aC = attribute('aC', 'vec4') as N, aD = attribute('aD', 'vec4') as N;
    const u = clamp(U.T.sub(aA.w).div(aB.z), 0, 1);
    const e = float(1).sub(pow(float(1).sub(u), 2.2));
    const hL = heightN(aB.x, aB.y).add(LIFT);
    const wpos = vec3(mix(aA.x, aB.x, e), mix(aA.y, hL, u).add(aB.w.mul(4).mul(u).mul(float(1).sub(u))), mix(aA.z, aB.y, e));
    const clip = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(wpos, 1)));
    const age = U.T.sub(aC.w);
    const landT = aA.w.add(aB.z);
    const flash = exp(age.mul(-9)).mul(step(0.7, aC.w)).clamp(0, 1);
    const sFlight = max(float(1), aD.x.mul(U.lrPerM).div(max(clip.w, 0.1)));
    const grow = smoothstep(landT, landT.add(0.35), U.T);
    const kindPlus = step(0.5, aD.y).mul(step(aD.y, 1.5)), kindOuter = step(1.5, aD.y);
    const size = max(floor(mix(sFlight, float(3).add(kindPlus).add(kindOuter.mul(2)), grow).add(step(0.5, flash)).add(0.5)), 1);
    const lowWn = U.res.x.div(U.k), lowHn = U.res.y.div(U.k);
    const ndc = clip.xy.div(clip.w);
    const lr = vec2(ndc.x.mul(0.5).add(0.5).mul(lowWn), ndc.y.mul(0.5).add(0.5).mul(lowHn));
    const odd = step(0.25, fract(size.mul(0.5)));
    const cpos = mix(floor(lr.add(0.5)), floor(lr).add(0.5), odd);
    const lr2 = cpos.add(positionGeometry.xy.mul(size));
    const ndc2 = vec2(lr2.x.div(lowWn).mul(2).sub(1), lr2.y.div(lowHn).mul(2).sub(1));
    const outClip = vec4(ndc2.mul(clip.w), clip.z, clip.w);
    const visible = U.T.greaterThanEqual(aC.w).and(clip.w.greaterThan(0.1));
    // Colours come from the world's palette roles: atoms red, solvent teal, settling into the ground reds.
    const isAtom = step(aC.b, 0.5);
    const flight = mix(vec3(PAL.glow), vec3(PAL.redLight), isAtom);
    const col0 = mix(flight, vec3(PAL.bone), flash.mul(0.6));
    const ground = mix(mix(vec3(PAL.red), vec3(PAL.redLight), aD.z.mul(0.7)), vec3(PAL.crimson), kindPlus.mul(0.5));
    const colF = mix(col0, ground, smoothstep(landT.sub(0.1), landT.add(0.2), U.T));
    const gone = smoothstep(landT.add(0.3), landT.add(0.75), U.T);
    const grainMat = new THREE.MeshBasicNodeMaterial({ fog: false, toneMapped: false });
    grainMat.vertexNode = select(visible, outClip, vec4(3, 3, 3, 1));
    grainMat.colorNode = varying(colF, 'vGrain');
    const shapeOk = select(kindPlus.greaterThan(0.5), min(abs(positionGeometry.x), abs(positionGeometry.y)).lessThan(0.2), float(1).greaterThan(0));
    grainMat.maskNode = shapeOk.and(dither.greaterThanEqual(gone));
    grainMat.depthTest = false; grainMat.depthWrite = false;
    const grains = new THREE.Mesh(geo, grainMat);
    grains.frustumCulled = false; grains.renderOrder = 10;

    const group = new THREE.Group();
    group.add(ghost, grains);
    group.visible = false;
    const boxSize = inp.boxSize;
    return {
      key, plan, group, geo, ghostMat, grainMat, revealTex, ghostGeo: terrainMesh.geometry, terrain: a.terrain, tu, U,
      pxPerM0: H / (2 * D0 * Math.tan((camera.fov * Math.PI) / 360)), boxSize,
      dispose() {
        scene.remove(group);
        geo.dispose(); ghostMat.dispose(); grainMat.dispose(); revealTex.dispose(); terrainMesh.geometry.dispose();
      },
    };
  }

  function prime(worldId: WorldId, terrain: Terrain, seed: number, requested: Conditions, handle: LaunchHandle) {
    if (!('relics' in terrain)) return;   // flat fallback: nothing to land on
    const a: PrimeArgs = { worldId, terrain, seed, requested, handle };
    const key = keyOf(a);
    if (primed?.key === key || job?.key === key) return;
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      if (job) { pending = a; return; }
      const inp = planInput(a);
      job = { key: keyOf(a), it: planSteps(inp), timer: 0, inp, args: a };
      job.timer = schedule(pump) as number;
    }, 250);
  }

  function start(o: StartOptions) {
    const world = worldFor(o.worldId);
    const { W, H } = dims();
    const a: PrimeArgs = { worldId: o.worldId, terrain: o.terrain, seed: o.seed, requested: o.requested, handle: o.handle };
    // A plan that is missing or stale (click before it finished, or the window resized): finish it now, synchronously.
    let p = primed && primed.key === keyOf(a) ? primed : null;
    if (!p && 'relics' in o.terrain) {
      try {
        const inp = planInput(a);
        const it = planSteps(inp);
        let r = it.next();
        while (!r.done) r = it.next();
        p = build(a, keyOf(a), r.value, inp);
        scene.add(p.group);
        primed?.dispose();
        primed = p;
      } catch (e) {
        console.warn('generate: plan failed, using the plain fade', e);
      }
    }
    if (!p) return plainFade(o);
    run(o, p, world, W, H);
  }

  /** Fallback: no 3D transition (flat terrain or a failed plan). The sheet fades out in hard steps. */
  function plainFade(o: StartOptions) {
    const root = o.handle.root;
    root.style.transition = 'opacity 0.6s steps(6, end)';
    root.style.opacity = '0';
    window.setTimeout(() => o.handle.dispose(), 700);
  }

  function run(o: StartOptions, p: Primed, world: ReturnType<typeof worldFor>, W: number, H: number) {
    active?.stop();
    const plan = p.plan, U = p.U, tu = p.tu;
    const dur = world.build.durationSec, spawnSec = world.build.spawnSec;
    const handle = o.handle;
    const rect = handle.boxRect();
    const bx = rect.left + rect.width / 2, by = rect.top + rect.height / 2;
    const px0 = p.pxPerM0;

    // Re-seat generation 0 on the live box dots, then recompute the early daughters.
    const toWorld = (s: { x: number; y: number }): Vec3 => ({
      x: plan.spawn.x + ((rect.left + s.x * rect.width) - bx) / px0,
      y: YC - ((rect.top + s.y * rect.height) - by) / px0,
      z: plan.spawn.z + 0.03,
    });
    const gen0 = () => handle.seeds().slice(0, GEN0).map(toWorld);
    const upto = refineEarly(plan, o.terrain, gen0(), 2);
    const geoA = p.geo.getAttribute('aA') as THREE.InstancedBufferAttribute;
    geoA.clearUpdateRanges(); geoA.addUpdateRange(0, upto * 4); geoA.needsUpdate = true;

    // Box copy that sits above the zooming sheet and dissolves pixel by pixel.
    const overlay = document.createElement('canvas');
    overlay.width = overlay.height = 150;
    overlay.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:101;image-rendering:pixelated;pointer-events:none;transform-origin:50% 50%`;
    document.body.appendChild(overlay);
    const octx = overlay.getContext('2d')!;
    // Dissolve mask: a small CPU canvas of 'erase here' pixels, uploaded when the fade moves (no GPU readback of the box).
    const maskCv = document.createElement('canvas');
    maskCv.width = maskCv.height = 150;
    const mctx = maskCv.getContext('2d', { willReadFrequently: true })!;
    const mimg = mctx.createImageData(150, 150);
    let maskFade = -1;
    const boxHash = new Float32Array(150 * 150);
    for (let i = 0; i < boxHash.length; i++) { const h = Math.sin(i * 12.9898 + 78.233) * 43758.5453; boxHash[i] = h - Math.floor(h); }

    // Sea plane (the world's own): faded in by this module while the transition runs.
    let sea: THREE.Mesh | null = null;
    scene.traverse((c) => {
      const m = c as THREE.Mesh;
      const g = m.geometry as (THREE.BufferGeometry & { parameters?: { width?: number; height?: number } }) | undefined;
      if (m.isMesh && m.renderOrder === 1 && g?.type === 'PlaneGeometry' && g.parameters?.width === 1 && g.parameters?.height === 1) sea = m;
    });
    const seaMat = (sea as THREE.Mesh | null)?.material as THREE.Material | undefined;
    let seaBase = seaMat?.opacity ?? 1, seaWritten = -1;

    const hideUi = document.createElement('style');
    hideUi.textContent = '.wu-root{visibility:hidden}';
    document.head.appendChild(hideUi);
    p.group.visible = true;
    const baseFov = camera.fov;
    let anchor: { sim: number; wall: number } | null = null, lastSim = -1, lastT = 0;
    const wall0 = performance.now();
    const floorOf = (x: number, z: number) => { const g = o.groundAt(x, z); return o.frozenNow() ? Math.max(g, o.seaLevelNow()) : g; };
    let released = false, domGone = false, spawnChecked = false;

    const fin = (): CamPose => {
      // The terrain keeps rising until the build ends, so the spawn pose is re-read on the live ground every frame once the sim runs.
      if (!o.snapshot()) return plan.pose;
      const live = spawnCameraPose(plan.spawn, o.groundAt, floorOf);
      const w = sstep(2.0, 3.0, lastT);
      const mixV = (u: Vec3, v: Vec3): Vec3 => ({ x: u.x + (v.x - u.x) * w, y: u.y + (v.y - u.y) * w, z: u.z + (v.z - u.z) * w });
      return { pos: mixV(plan.pose.pos, live.pos), look: mixV(plan.pose.look, live.look) };
    };

    // ?debug: frame times during the transition, for the headless fps check (window.__genFrames = [[T, ms], …]).
    const dbg = new URLSearchParams(location.search).has('debug');
    const frameLog: number[][] = [];
    let lastNow = 0;
    if (dbg) (window as unknown as Record<string, unknown>).__genFrames = frameLog;
    const hook = (_dt: number) => {
      const now = performance.now();
      if (dbg) { if (lastNow) frameLog.push([+lastT.toFixed(2), +(now - lastNow).toFixed(1)]); lastNow = now; }
      const snap = o.snapshot();
      if (snap && snap.timeSec !== lastSim) { lastSim = snap.timeSec; anchor = { sim: snap.timeSec, wall: now }; }
      const T0 = anchor ? anchor.sim + (now - anchor.wall) / 1000 : (now - wall0) / 1000;
      const T = Math.max(lastT, T0);
      lastT = T;

      // Terrain uniforms: what the real terrain mesh uses (stepped per snapshot), else the build clock.
      const inp = snap ? app.inputs : null;
      const rise = inp ? inp.terrain.rise : Math.min(1, T / dur);
      tu.rise.value = rise;
      tu.heatSolvent.value = inp ? inp.heatSolvent : plan.stateAt(T).heatSolvent;
      for (const id of MACHINE_IDS) tu.progress[id].value = inp ? (inp.terrain.progress[id] ?? 0) : (world.terrain.machines.some((m) => m.id === id) ? Math.min(1, T / dur) : 0);
      U.T.value = T;
      U.vis.value = sstep(spawnSec - 1.3, spawnSec - 0.3, T);
      U.seaMix.value = sstep(2.8, 5.0, T);

      // Camera: Hermite through push-in → pull-back → the player's spawn pose. Released at spawnSec (the player takes over).
      if (!released) {
        const F = fin();
        const fp = F.pos, fh = Math.hypot(F.look.x - fp.x, F.look.z - fp.z);
        const finPitch = Math.atan2(fp.y - F.look.y, fh);
        const times = [0, PUSH.t, 3.3, spawnSec];
        const px = [plan.spawn.x, plan.spawn.x, fp.x, fp.x];
        const py = [YC, YC + 0.1, fp.y - 1.5, fp.y];
        const pz = [plan.spawn.z + D0, plan.spawn.z + PUSH.d, fp.z + 1.3, fp.z];
        const pitch = [0, 0, finPitch + 0.05, finPitch];
        const tt = Math.min(T, spawnSec);
        const cx = hermite(px, times, tt), cy = hermite(py, times, tt), cz = hermite(pz, times, tt), cp = hermite(pitch, times, tt);
        let sw = 0; for (let g = 1; g <= plan.doublings; g++) sw += alpha(T - (PULSE0 + PULSE_DT * (g - 1)), 0.16);
        camera.position.set(cx, cy, cz);
        camera.rotation.set(-cp, 0, 0);
        camera.fov = baseFov - 0.9 * Math.min(1.2, sw);
        // The box sits left of centre on the selection screen: shift the principal point so its centre projects where the DOM draws it.
        const e = sstep(0, PUSH.t, T);
        const sx = (bx - W / 2) * (1 - e), sy = (by - H / 2) * (1 - e);
        if (Math.abs(sx) + Math.abs(sy) > 0.01) camera.setViewOffset(W, H, W / 2 - (W / 2 + sx), H / 2 - (H / 2 + sy), W, H);
        else camera.clearViewOffset();
        camera.updateProjectionMatrix();

        // DOM sheet: zoom about the box in step with the camera, pan to centre, dissolve outward from the box.
        if (!domGone) {
          const k = D0 / Math.max(0.5, cz - plan.spawn.z);
          const dx = (W / 2 - bx) * e, dy = (H / 2 - by) * e;
          const tf = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(${k.toFixed(4)})`;
          const root = handle.root;
          root.style.transformOrigin = `${bx}px ${by}px`;
          root.style.transform = tf;
          // The overlay's own centre is the box centre, so scaling it about itself matches the sheet scaled about the box.
          overlay.style.transform = tf;
          overlay.style.transformOrigin = '50% 50%';
          const rHole = Math.floor((Math.hypot(W, H) * sstep(0.2, 1.35, T)) / 8) * 8;
          const mask = rHole <= 0 ? 'none' : `radial-gradient(circle at ${bx}px ${by}px, transparent ${rHole}px, #000 ${rHole + 1}px)`;
          root.style.maskImage = mask; root.style.webkitMaskImage = mask;
          handle.setBoxSpeed(1 - sstep(0.25, 0.6, T));
          // Box copy with a pixel dissolve.
          octx.globalCompositeOperation = 'source-over';
          octx.clearRect(0, 0, 150, 150);
          octx.drawImage(handle.boxCanvas, 0, 0, 150, 150);
          const fade = sstep(0.62, 1.0, T);
          if (fade > 0) {
            if (Math.abs(fade - maskFade) > 0.004) {
              maskFade = fade;
              const d = mimg.data;
              for (let i = 0; i < boxHash.length; i++) { d[i * 4 + 3] = boxHash[i] < fade ? 255 : 0; }
              mctx.putImageData(mimg, 0, 0);
            }
            octx.globalCompositeOperation = 'destination-out';
            octx.drawImage(maskCv, 0, 0);
          }
          overlay.style.display = fade >= 1 ? 'none' : 'block';
          // Generation 0 follows the live dots until the box has frozen.
          if (T < 0.62) {
            const w0 = gen0();
            for (let i = 0; i < w0.length; i++) { plan.A[i * 4] = w0[i].x; plan.A[i * 4 + 1] = w0[i].y; plan.A[i * 4 + 2] = w0[i].z; }
            geoA.clearUpdateRanges(); geoA.addUpdateRange(0, GEN0 * 4); geoA.needsUpdate = true;
          }
          if (T >= 1.45) { domGone = true; overlay.remove(); handle.dispose(); }
        }
        if (T >= spawnSec - 0.25) hideUi.remove();
        if (T >= spawnSec) { released = true; camera.fov = baseFov; camera.clearViewOffset(); camera.updateProjectionMatrix(); }
      }

      // Sea: fade the world's own plane in as the seas fill, then hand it back untouched.
      if (seaMat) {
        if (seaWritten >= 0 && Math.abs(seaMat.opacity - seaWritten) > 1e-6) seaBase = seaMat.opacity;   // the world restyled it
        const ramp = sstep(3.0, 5.2, T);
        seaWritten = seaBase * ramp;
        seaMat.opacity = seaWritten;
        if (ramp >= 1) { seaMat.opacity = seaBase; seaWritten = -1; }
      }

      if (dbg && T > spawnSec - 1.0) {
        const w = window as unknown as { __genCam?: number[][] };
        (w.__genCam ??= []).push([+T.toFixed(3), camera.position.x, camera.position.y, camera.position.z, camera.rotation.x, camera.fov]);
      }
      // ?debug: does the planned spawn equal the one the player will get? (one extra height scan, debug only)
      if (dbg && !spawnChecked && snap && T >= spawnSec - 0.05) {
        spawnChecked = true;
        const sp = o.spawnFor(snap);
        (window as unknown as Record<string, unknown>).__genSpawn = { plan: plan.spawn, sim: sp, d: Math.hypot(sp.x - plan.spawn.x, sp.z - plan.spawn.z) };
      }
      if (T >= spawnSec + 0.4) stop();
    };

    const unhook = app.registerFrameHook(hook);
    function stop() {
      unhook();
      p.group.visible = false;
      if (seaMat) seaMat.opacity = seaBase;
      overlay.remove(); hideUi.remove();
      if (!domGone) { domGone = true; handle.dispose(); }
      camera.fov = baseFov; camera.clearViewOffset(); camera.updateProjectionMatrix();
      active = null;
    }
    active = { stop };
  }

  return {
    prime,
    start,
    dispose() { window.clearTimeout(debounce); active?.stop(); primed?.dispose(); primed = null; job = null; },
  };
}

