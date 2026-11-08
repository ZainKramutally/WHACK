// Generate transition B, "Mitosis Tide": the selection screen's real particle box divides on a steady pulse
// (196 → 25,088 grains); each division front sweeps outward like a tide, and the daughters land on the REAL carbon/silicon
// terrain height field at the exact pixels of the end frame, clump into 2×2 / plus grains and fuse into the terrain.
// Pure function of t (seeded RNG, GPU-analytic motion), so ?t= stills and video agree. Mock only: src/ is imported read-only.
import * as THREE from 'three/webgpu';
import {
  float, vec2, vec3, vec4, uniform, attribute, positionGeometry, positionWorld, cameraProjectionMatrix, cameraViewMatrix,
  mix, smoothstep, clamp, floor, varying, fract, sin, dot, pow, max, min, select, exp, step, abs, uv, pass, screenCoordinate, length,
} from 'three/tsl';
import { createBox, mulberry32, BOX_PAL, seaRamp } from '../../../src/ui/selection/box';
import { createTerrain, spawnPoint, seaLevelForCover, type TerrainState } from '../../../src/gen/terrain';
import { createHeightNode, createTerrainMesh, createTerrainUniforms } from '../../../src/render/terrainNode';
import { createSky } from '../../../src/render/sky';
import { createSea } from '../../../src/render/sea';
import { groundColour } from '../../../src/render/palette';
import { createCharacter } from '../../../src/player/character';
import { worldFor, controlList } from '../../../src/worlds';
import { startingConditions } from '../../../src/sim/limits';
import type { Conditions } from '../../../src/worlds/types';

/* ------------------------------------------------------------------ config */
const q = new URLSearchParams(location.search);
const worldId = q.get('world') === 'silicon' ? 'silicon' : 'carbon';
const world = worldFor(worldId);
const frozenT = q.has('t') ? Number(q.get('t')) : null;
const T_END = 6.0;                         // seconds from Generate to spawn (build.spawnSec)
const BUILD_SEC = world.build.durationSec; // rise = buildProgress = t / 20
const N_SEEDS_DOUBLINGS = 7;
const PULSE0 = 0.85, PULSE_DT = 0.5, SWEEP = 0.4;   // pulse k (1-based) starts at PULSE0 + PULSE_DT * (k-1)
const LIFT = 0.1;                          // grains float this far above the surface (m)
const PX = 5.97 / 1080;                    // metres per selection-screenshot pixel at the start camera
const SHEET_BOX = { x: 984, y: 267.578125, w: 544, h: 544 };   // the box canvas inside assets/sheet-*.png (px)

// Reference numbers captured from the real app at spawn (?world=…&demo): see design/iteration/…-transition-b/.
const REF = {
  carbon: { temperature: 15, pressure: 1.1929, light: 0.88915, coverEnd: 0.7422, camUp: 3.2211, camBack: 5.1665, pitchDeg: 20.05, frozen: false },
  silicon: { temperature: -183, pressure: 3.6511, light: 0.015725, coverEnd: 0.4790, camUp: 3.2769, camBack: 5.1665, pitchDeg: 20.05, frozen: false },
}[worldId];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const alpha = (tau: number, a: number) => (tau <= 0 ? 0 : (tau / a) * Math.exp(1 - tau / a));   // soft attack + decay, peak 1 at tau = a

/* ------------------------------------------------------------------ world / terrain */
const seed = world.demoSeed;
const terrain = createTerrain(world.terrain, seed);
const heat = (T: number) => clamp01((T - world.solvent.freezeC) / world.terrain.heatSolventSpan + 0.5);
const stateAt = (t: number): TerrainState => {
  const r = Math.min(t, T_END) / BUILD_SEC;
  const progress: Record<string, number> = {};
  for (const m of world.terrain.machines) progress[m.id] = r;
  return { rise: r, progress, heatSolvent: heat(REF.temperature) };
};
const fillAt = (t: number) => sstep(world.build.seasSec[0], world.build.seasSec[1], t);
// Spawn exactly as main.ts spawnFor(): shore search on the finished terrain at the final sea cover.
const finalFull: TerrainState = (() => { const progress: Record<string, number> = {}; for (const m of world.terrain.machines) progress[m.id] = 1; return { rise: 1, progress, heatSolvent: heat(REF.temperature) }; })();
const spawn = spawnPoint(terrain, finalFull, seaLevelForCover(terrain, finalFull, REF.coverEnd));
const XS = spawn.x, ZS = spawn.z;
const seaLevelTable: number[] = [];
for (let i = 0; i <= 60; i++) { const t = i / 10; seaLevelTable.push(seaLevelForCover(terrain, stateAt(t), REF.coverEnd * fillAt(t))); }
const seaLevelAt = (t: number) => { const f = clamp01(t / T_END) * 60; const i = Math.min(59, Math.floor(f)); return lerp(seaLevelTable[i], seaLevelTable[i + 1], f - i); };
const seaCoverAt = (t: number) => REF.coverEnd * fillAt(t);

/* ------------------------------------------------------------------ camera path (Hermite through 3 keys) */
const hFinal = terrain.height(XS, ZS, stateAt(T_END));
const KEYS = [
  { t: 0, p: [XS - 296 * PX, 1.6, ZS + 5.17], pitch: 0 },
  { t: 1.25, p: [XS, 1.7, ZS + 2.7], pitch: 0 },
  { t: 3.3, p: [XS, hFinal + 1.7, ZS + 6.5], pitch: 0.4 },
  { t: T_END, p: [XS, hFinal + REF.camUp, ZS + REF.camBack], pitch: (REF.pitchDeg * Math.PI) / 180 },
];
function hermite(vals: number[], times: number[], t: number) {
  const n = vals.length;
  const m = vals.map((_, i) => (i === 0 || i === n - 1 ? 0 : (vals[i + 1] - vals[i - 1]) / (times[i + 1] - times[i - 1])));
  let i = 0; while (i < n - 2 && t > times[i + 1]) i++;
  const h = times[i + 1] - times[i], s = clamp01((t - times[i]) / h);
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vals[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * vals[i + 1] + (s3 - s2) * h * m[i + 1];
}
const times = KEYS.map((k) => k.t);
function cameraAt(t: number) {
  const tt = Math.min(t, T_END);
  const pos = [0, 1, 2].map((a) => hermite(KEYS.map((k) => k.p[a]), times, tt));
  const pitch = hermite(KEYS.map((k) => k.pitch), times, tt);
  // soft swell at each pulse: a ~1% dolly-in breath
  let sw = 0; for (let k = 1; k <= N_SEEDS_DOUBLINGS; k++) sw += alpha(t - (PULSE0 + PULSE_DT * (k - 1)), 0.16);
  return { pos, pitch, fov: 60 - 0.9 * Math.min(1.2, sw) };
}

/* ------------------------------------------------------------------ main */
const errEl = document.getElementById('err')!;
async function main() {
  const W = Math.round(window.innerWidth), H = Math.round(window.innerHeight);
  const renderer = new THREE.WebGPURenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  document.body.appendChild(renderer.domElement);
  await renderer.init();
  // Diagnostics: GPU errors the browser would otherwise swallow (device lost, validation).
  const gpuErrors: string[] = [];
  const dev = (renderer as unknown as { backend: { device?: GPUDevice } }).backend?.device;
  dev?.lost.then((i) => { gpuErrors.push(`DEVICE LOST ${i.reason}: ${i.message}`); console.error('DEVICE LOST', i.reason, i.message); });
  dev?.addEventListener('uncapturederror', (e) => { const m = (e as GPUUncapturedErrorEvent).error.message; gpuErrors.push(m); console.error('GPU', m); });
  Object.assign(window, { __gpuErrors: gpuErrors, __renderer: renderer });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
  const fakeApp = { scene, camera } as never;
  const sky = createSky(fakeApp);
  const sea = createSea(fakeApp);
  const inputs = {
    world: { id: world.id, status: world.status, starType: world.starType, solvent: world.solvent, composition: world.life.composition },
    stats: { temperature: REF.temperature, pressure: REF.pressure, seaCover: 0 }, seaLevel: 0, frozen: REF.frozen, light: REF.light,
  } as never as Parameters<typeof sky.update>[1];
  const setInputs = (t: number) => {
    const i = inputs as unknown as { stats: Record<string, number>; seaLevel: number };
    i.stats.seaCover = seaCoverAt(t) * 100; i.seaLevel = seaLevelAt(t);
  };

  // Terrain: the app's own mesh, gated by a screen-block dither (complementary to the grains).
  const tu = createTerrainUniforms();
  const heightN = createHeightNode(terrain, tu);
  const mesh = createTerrainMesh(terrain, tu);
  (mesh.material as THREE.MeshStandardNodeMaterial).color.setHex(groundColour(world.life.composition, 0));
  scene.add(mesh);
  // Ghost ground: the same displaced mesh in the box's deep-water colour, so the unborn world is a dark slab the grains light up.
  const ghostMat = (mesh.material as THREE.MeshStandardNodeMaterial).clone();
  const ghost = new THREE.Mesh(mesh.geometry, ghostMat);
  ghost.frustumCulled = false;
  scene.add(ghost);

  const uT = uniform(0), uP = uniform(1), uToon = uniform(0), uFlash = uniform(0), uVis = uniform(0), uSeaMix = uniform(0), uLrPerM = uniform(1);
  const uDis = uniform(0), uBoxFade = uniform(0);
  const uRes = uniform(new THREE.Vector2(W, H));
  const blockHash = (b: unknown) => fract(sin(dot(b as never, vec2(12.9898, 78.233))).mul(43758.5453));
  const dither4 = blockHash(floor(screenCoordinate.xy.div(4)));
  (mesh.material as THREE.MeshStandardNodeMaterial).maskNode = dither4.lessThan(uVis);
  (sea.mesh.material as THREE.MeshStandardNodeMaterial).maskNode = dither4.lessThan(uVis);
  ghostMat.maskNode = dither4.greaterThanEqual(uVis);
  const ghostA = new THREE.Color(seaRamp(world)[1]), ghostB = new THREE.Color(groundColour(world.life.composition, 0)).multiplyScalar(0.7);

  // Character (the app's own placeholder), grows out of the settled grains at the very end.
  const character = createCharacter();
  character.root.visible = false;
  scene.add(character.root);

  /* ---- selection-screen sheet (real screenshot) + the real box canvas ---- */
  const loader = new THREE.TextureLoader();
  const sheetTex = await loader.loadAsync(new URL(`./assets/sheet-${worldId}.png`, import.meta.url).href);
  sheetTex.colorSpace = THREE.SRGBColorSpace; sheetTex.magFilter = THREE.NearestFilter; sheetTex.minFilter = THREE.NearestFilter; sheetTex.generateMipmaps = false;
  const YC = 1.6, BOXW = SHEET_BOX.w * PX;
  const boxCx = XS, boxCy = YC + (540 - (SHEET_BOX.y + SHEET_BOX.h / 2)) * PX;
  const sheetMat = new THREE.MeshBasicNodeMaterial({ map: sheetTex, fog: false });
  const sheetRad = length(positionWorld.xy.sub(vec2(boxCx, boxCy))).div(7.5);
  sheetMat.maskNode = sheetRad.mul(0.88).add(blockHash(floor(screenCoordinate.xy.div(8))).mul(0.12)).greaterThanEqual(uDis);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1920 * PX, 1080 * PX), sheetMat);
  sheet.position.set(XS - 296 * PX, YC, ZS);
  scene.add(sheet);

  const boxCanvas = document.createElement('canvas'); boxCanvas.width = 150; boxCanvas.height = 150;
  const boxTex = new THREE.CanvasTexture(boxCanvas);
  boxTex.colorSpace = THREE.SRGBColorSpace; boxTex.magFilter = THREE.NearestFilter; boxTex.minFilter = THREE.NearestFilter; boxTex.generateMipmaps = false;
  const boxMat = new THREE.MeshBasicNodeMaterial({ map: boxTex, fog: false });
  boxMat.maskNode = blockHash(floor(screenCoordinate.xy.div(8))).greaterThanEqual(uBoxFade);
  const boxMesh = new THREE.Mesh(new THREE.PlaneGeometry(BOXW, BOXW), boxMat);
  boxMesh.position.set(boxCx, boxCy, ZS + 0.02);
  scene.add(boxMesh);

  // The box clock: it runs live, then time dilates to a stop as the first pulse builds (so its dots hold still for gen 0).
  const cond: Conditions = (() => {
    const requested = Object.fromEntries(controlList.map((c) => [c.id, c.default])) as Conditions;
    return startingConditions(world, requested).start;
  })();
  const boxTimeAt = (t: number) => (t < 0.5 ? t : t < 1 ? 0.5 + 0.5 * ((t - 0.5) * 2 - Math.pow((t - 0.5) * 2, 3) + Math.pow((t - 0.5) * 2, 4) / 2) : 0.75);
  const PREROLL = 150, STEP = 1 / 60;
  const makeBox = (c: HTMLCanvasElement) => { const b = createBox(c); for (let i = 0; i < PREROLL; i++) b.frame((i + 1) * STEP * 1000, STEP, world, cond); return b; };
  let box = makeBox(boxCanvas), boxSteps = 0;
  const boxAdvance = (t: number) => {
    const target = Math.round(boxTimeAt(t) / STEP);
    if (target < boxSteps) { box = makeBox(boxCanvas); boxSteps = 0; }
    while (boxSteps < target) { boxSteps++; box.frame((PREROLL + boxSteps) * STEP * 1000, STEP, world, cond); }
    boxTex.needsUpdate = true;
  };
  // A second box run to the frozen moment gives gen 0's exact dot positions.
  const seedBox = makeBox(document.createElement('canvas'));
  for (let i = 0; i < Math.round(boxTimeAt(2) / STEP); i++) seedBox.frame((PREROLL + i + 1) * STEP * 1000, STEP, world, cond);
  const seeds = seedBox.seeds();
  const nAtoms = 26;

  /* ---- bake the end frame (twice: dry, and with the sea) at the low-res lattice ---- */
  const P_PIX = 4;
  const Wlr = Math.ceil(W / P_PIX), Hlr = Math.ceil(H / P_PIX);
  const cam6 = cameraAt(T_END);
  const setCamera = (c: ReturnType<typeof cameraAt>) => {
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    camera.rotation.set(-c.pitch, 0, 0);
    camera.fov = c.fov; camera.updateProjectionMatrix();
  };
  const bakeRT = new THREE.RenderTarget(Wlr, Hlr, { type: THREE.FloatType, depthBuffer: true });
  const applyTerrain = (t: number) => {
    const s = stateAt(t);
    tu.rise.value = s.rise; tu.heatSolvent.value = s.heatSolvent;
    for (const k in tu.progress) tu.progress[k as keyof typeof tu.progress].value = s.progress[k] ?? 0;
  };
  async function bake(withSea: boolean) {
    applyTerrain(T_END); setInputs(T_END); setCamera(cam6);
    sky.update(0.016, inputs, 400); sea.update(0.016, 0, inputs, 400);
    sea.mesh.visible = withSea && seaCoverAt(T_END) > 0.005;
    sheet.visible = boxMesh.visible = ghost.visible = false; character.root.visible = false;
    uVis.value = 1;
    renderer.setRenderTarget(bakeRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
    const d = await renderer.readRenderTargetPixelsAsync(bakeRT, 0, 0, Wlr, Hlr);
    return d as Float32Array;
  }
  await renderer.compileAsync(scene, camera);
  const bakeDry = await bake(false);
  const bakeWet = await bake(true);
  sheet.visible = boxMesh.visible = ghost.visible = true;

  /* ---- landing slots: stratified rays through the lattice cells of the end frame ---- */
  const GRID = 512, S = terrain.patchSize, cell = S / GRID;
  const stFinal = stateAt(T_END);
  const hgrid = new Float32Array((GRID + 1) * (GRID + 1));
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) hgrid[j * (GRID + 1) + i] = terrain.height(-S / 2 + i * cell, -S / 2 + j * cell, stFinal);
  const hAt = (x: number, z: number) => {
    const fx = (x + S / 2) / cell, fz = (z + S / 2) / cell;
    const i = Math.min(GRID - 1, Math.max(0, Math.floor(fx))), j = Math.min(GRID - 1, Math.max(0, Math.floor(fz)));
    const a = fx - i, b = fz - j, r = GRID + 1;
    return lerp(lerp(hgrid[j * r + i], hgrid[j * r + i + 1], a), lerp(hgrid[(j + 1) * r + i], hgrid[(j + 1) * r + i + 1], a), b);
  };
  const inPatch = (x: number, z: number) => Math.abs(x) < S / 2 - 1 && Math.abs(z) < S / 2 - 1;
  const camP = new THREE.Vector3(...cam6.pos);
  const tanH = Math.tan((cam6.fov * Math.PI) / 360), aspect = W / H;
  const qRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-cam6.pitch, 0, 0));
  function rayHit(lx: number, ly: number): { x: number; z: number } | null {
    const nx = (lx / Wlr) * 2 - 1, ny = 1 - (ly / Hlr) * 2;
    const d = new THREE.Vector3(nx * aspect * tanH, ny * tanH, -1).normalize().applyQuaternion(qRot);
    let tPrev = 0.3, prevAbove = true;
    for (let tt = 0.3; tt < 380; tt += Math.max(0.35, tt * 0.012)) {
      const x = camP.x + d.x * tt, y = camP.y + d.y * tt, z = camP.z + d.z * tt;
      if (!inPatch(x, z)) { if (tt > 4) return null; continue; }
      const above = y > hAt(x, z);
      if (prevAbove && !above) {
        let lo = tPrev, hi = tt;
        for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; const x2 = camP.x + d.x * mid, z2 = camP.z + d.z * mid; (camP.y + d.y * mid > terrain.height(x2, z2, stFinal)) ? (lo = mid) : (hi = mid); }
        const tm = (lo + hi) / 2; return { x: camP.x + d.x * tm, z: camP.z + d.z * tm };
      }
      prevAbove = above; tPrev = tt;
    }
    return null;
  }
  const N = 196 * Math.pow(2, N_SEEDS_DOUBLINGS);
  const rs = mulberry32(0x5eed + (worldId === 'silicon' ? 7 : 0));
  const slots: { x: number; z: number; px: number; py: number; plus: number }[] = [];
  { // dense cells over the end frame, plus a sparser margin around it so the tide never shows a frustum edge while the camera pulls back
    const inCore = (x: number, y: number) => x >= 0 && x < Wlr && y >= 0 && y < Hlr;
    const build = (pitch: number) => {
      slots.length = 0;
      for (let cy = 0; cy < Hlr; cy += pitch) for (let cx = 0; cx < Wlr; cx += pitch) {
        const px = Math.min(Wlr - 1, cx + rs() * pitch), py = Math.min(Hlr - 1, cy + rs() * pitch);
        const h = rayHit(px, py); if (h) slots.push({ x: h.x, z: h.z, px, py, plus: 0 });
      }
      const pm = pitch * 2.3;
      for (let cy = -0.3 * Hlr; cy < 1.55 * Hlr; cy += pm) for (let cx = -0.3 * Wlr; cx < 1.3 * Wlr; cx += pm) {
        const px = cx + rs() * pm, py = cy + rs() * pm;
        if (inCore(px, py)) continue;
        const h = rayHit(px, py); if (h) slots.push({ x: h.x, z: h.z, px, py, plus: 2 });
      }
    };
    let pitch = 2.0;
    for (let it = 0; it < 4; it++) { build(pitch); pitch *= Math.sqrt(slots.length / N); if (Math.abs(slots.length - N) < N * 0.03) break; }
    let guard = 0;
    while (slots.length < N && guard++ < 40000) { const px = rs() * Wlr, py = (0.3 + 0.7 * rs()) * Hlr; const h = rayHit(px, py); if (h) slots.push({ x: h.x, z: h.z, px, py, plus: 0 }); }
    while (slots.length > N) slots.splice(Math.floor(rs() * slots.length), 1);
  }
  const bakeAt = (arr: Float32Array, px: number, py: number): [number, number, number] => {
    // render-target rows start at the bottom in WebGPU readbacks; fall back to flipping if the sky row is mismatched
    const ix = Math.min(Wlr - 1, Math.max(0, Math.floor(px))), iy = Math.min(Hlr - 1, Math.max(0, Math.floor(py)));
    const o = ((flipY ? Hlr - 1 - iy : iy) * Wlr + ix) * 4;
    return [arr[o], arr[o + 1], arr[o + 2]];
  };
  // Orientation check: the top row of the end frame is sky (bright blue), the bottom row is ground.
  const flipY = (() => { const top = bakeDry[(0 * Wlr + Wlr / 2 | 0) * 4 + 2], bot = bakeDry[((Hlr - 1) * Wlr + (Wlr / 2 | 0)) * 4 + 2]; return !(top > bot); })();

  /* ---- lineage: sort by ground distance from the spawn, split into generations, pair parents/daughters by bearing ---- */
  const dist = (s: { x: number; z: number }) => Math.hypot(s.x - XS, s.z - ZS);
  slots.sort((a, b) => dist(a) - dist(b));
  const bearing = (s: { x: number; z: number }) => Math.atan2(s.z - ZS, s.x - XS);
  const camD = (s: { x: number; z: number }) => Math.hypot(s.x - camP.x, s.z - camP.z);
  for (const s of slots) if (s.plus !== 2) s.plus = rs() < (camD(s) < 14 ? 0.55 : camD(s) < 45 ? 0.3 : 0.12) ? 1 : 0;

  type P = {
    sx: number; sy: number; sz: number; birth: number; appear: number; lx: number; lz: number; dur: number; arc: number;
    col: [number, number, number]; sizeW: number; plus: number; slot: number;
  };
  const ps: P[] = new Array(N);
  const colAtom = new THREE.Color(worldId === 'silicon' ? BOX_PAL.silicon[2] : BOX_PAL.carbon[2]);
  const colSolv = new THREE.Color(seaRamp(world)[5]);
  const posAt = (p: P, t: number): [number, number, number] => {
    const u = clamp01((t - p.birth) / p.dur), e = 1 - Math.pow(1 - u, 2.2);
    const hL = terrain.height(p.lx, p.lz, stateAt(t)) + LIFT;
    return [lerp(p.sx, p.lx, e), lerp(p.sy, hL, u) + p.arc * 4 * u * (1 - u), lerp(p.sz, p.lz, e)];
  };
  // generation 0: the box's own dots
  const n0 = 196;
  for (let i = 0; i < n0; i++) {
    const sd = seeds[i], atom = i < nAtoms, s = slots[i];
    const c = atom ? colAtom : colSolv;
    const f = 0.62 + 0.3 * rs() + 0.35 * (sd.y);   // lower dots fall later (they are already in the liquid)
    ps[i] = {
      sx: boxCx + (sd.x - 0.5) * BOXW, sy: boxCy + (0.5 - sd.y) * BOXW, sz: ZS + 0.03,
      birth: f, appear: 0.55, lx: s.x, lz: s.z, dur: 0.55 + 0.25 * rs(), arc: 0.4 + rs() * 0.8,
      col: [c.r, c.g, c.b], sizeW: atom ? 0.06 : 0.02, plus: s.plus, slot: i,
    };
  }
  let have = n0;
  for (let g = 1; g <= N_SEEDS_DOUBLINGS; g++) {
    const Pg = PULSE0 + PULSE_DT * (g - 1);
    const parents = ps.slice(0, have).map((p, i) => ({ i, a: Math.atan2(p.lz - ZS, p.lx - XS) })).sort((a, b) => a.a - b.a);
    const kids = Array.from({ length: have }, (_, k) => have + k).sort((a, b) => bearing(slots[a]) - bearing(slots[b]));
    // within the pulse, daughters are born in order of distance (a front sweeping outward)
    const order = kids.map((k) => k).sort((a, b) => dist(slots[a]) - dist(slots[b]));
    const rank = new Map(order.map((k, r) => [k, r / Math.max(1, order.length - 1)]));
    kids.forEach((k, j) => {
      const par = ps[parents[j].i], s = slots[k];
      const b = Pg + SWEEP * Math.pow(rank.get(k)!, 0.85);
      const at = posAt(par, b);
      const d = Math.hypot(s.x - at[0], s.z - at[2]);
      ps[k] = {
        sx: at[0], sy: at[1], sz: at[2], birth: b, appear: b, lx: s.x, lz: s.z,
        dur: Math.min(0.8, Math.max(0.32, 0.28 + 0.004 * d)), arc: Math.min(18, 0.09 * d + 0.2 + rs() * 0.6),
        col: par.col, sizeW: 0, plus: s.plus, slot: k,
      };
    });
    have *= 2;
  }
  let lastLand = 0; for (const p of ps) lastLand = Math.max(lastLand, p.birth + p.dur);

  /* ---- instanced grains ---- */
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.instanceCount = N;
  const A = new Float32Array(N * 4), B = new Float32Array(N * 4), C = new Float32Array(N * 4), D = new Float32Array(N * 4), E = new Float32Array(N * 4);
  const lin = (v: number) => v;   // bake readback is already linear in the working space
  ps.forEach((p, i) => {
    const s = slots[p.slot];
    const dry = bakeAt(bakeDry, s.px, s.py), wet = bakeAt(bakeWet, s.px, s.py);
    A.set([p.sx, p.sy, p.sz, p.birth], i * 4); B.set([p.lx, p.lz, p.dur, p.arc], i * 4);
    C.set([p.col[0], p.col[1], p.col[2], p.appear], i * 4);
    D.set([lin(dry[0]), lin(dry[1]), lin(dry[2]), p.sizeW], i * 4); E.set([lin(wet[0]), lin(wet[1]), lin(wet[2]), p.plus], i * 4);
  });
  for (const [name, arr] of [['aA', A], ['aB', B], ['aC', C], ['aD', D], ['aE', E]] as const) geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, 4));

  const aA = attribute('aA', 'vec4'), aB = attribute('aB', 'vec4'), aC = attribute('aC', 'vec4'), aD = attribute('aD', 'vec4'), aE = attribute('aE', 'vec4');
  const u = clamp(uT.sub(aA.w).div(aB.z), 0, 1);
  const e = float(1).sub(pow(float(1).sub(u), 2.2));
  const hL = heightN(aB.x, aB.y).add(LIFT);
  const wpos = vec3(mix(aA.x, aB.x, e), mix(aA.y, hL, u).add(aB.w.mul(4).mul(u).mul(float(1).sub(u))), mix(aA.z, aB.y, e));
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(wpos, 1)));
  const age = uT.sub(aC.w);
  const landT = aA.w.add(aB.z);
  const flash = exp(age.mul(-9)).mul(step(0.7, aC.w)).clamp(0, 1);
  const sFlight = max(float(1), aD.w.mul(uLrPerM).div(max(clip.w, 0.1)));
  const grow = smoothstep(landT, landT.add(0.4), uT);
  const size = max(floor(mix(sFlight, float(3).add(aE.w), grow).add(step(0.5, flash)).add(0.5)), 1);
  const Wlrn = uRes.x.div(uP), Hlrn = uRes.y.div(uP);
  const ndc = clip.xy.div(clip.w);
  const lr = vec2(ndc.x.mul(0.5).add(0.5).mul(Wlrn), ndc.y.mul(0.5).add(0.5).mul(Hlrn));
  const odd = step(0.25, fract(size.mul(0.5)));
  const cpos = mix(floor(lr.add(0.5)), floor(lr).add(0.5), odd);
  const lr2 = cpos.add(positionGeometry.xy.mul(size));
  const ndc2 = vec2(lr2.x.div(Wlrn).mul(2).sub(1), lr2.y.div(Hlrn).mul(2).sub(1));
  const outClip = vec4(ndc2.mul(clip.w), clip.z, clip.w);
  const visible = uT.greaterThanEqual(aC.w).and(clip.w.greaterThan(0.1));
  const col0 = mix(aC.xyz, vec3(1.0, 0.95, 0.84), flash.mul(0.5));
  const baked = mix(aD.xyz, aE.xyz, uSeaMix);
  const colF = mix(col0, baked, smoothstep(landT.sub(0.14), landT.add(0.45), uT));
  const grainMat = new THREE.MeshBasicNodeMaterial({ fog: false, toneMapped: false });
  grainMat.vertexNode = select(visible, outClip, vec4(3, 3, 3, 1));
  grainMat.colorNode = varying(colF, 'vGrain');
  const shapeOk = select(aE.w.greaterThan(0.5).and(aE.w.lessThan(1.5)), min(abs(positionGeometry.x), abs(positionGeometry.y)).lessThan(0.2), float(1).greaterThan(0));
  grainMat.maskNode = shapeOk.and(dither4.greaterThanEqual(uVis));
  grainMat.depthTest = false; grainMat.depthWrite = false;
  const grains = new THREE.Mesh(geo, grainMat);
  grains.frustumCulled = false; grains.renderOrder = 10;
  scene.add(grains);
  character.root.traverse((o) => { (o as THREE.Mesh).renderOrder = 20; });

  /* ---- post: block-average pixelate + dithered posterize + pulse flash ---- */
  const scenePass = pass(scene, camera);
  const sceneTex = scenePass.getTextureNode();
  const pix = uv().mul(uRes);
  const blk = floor(pix.div(uP));
  const cuv = blk.add(0.5).mul(uP).div(uRes);
  const tap = (dx: number, dy: number) => sceneTex.sample(cuv.add(vec2(dx, dy).mul(uP).div(uRes)));
  const avg = tap(-0.25, -0.25).add(tap(0.25, -0.25)).add(tap(-0.25, 0.25)).add(tap(0.25, 0.25)).mul(0.25);
  const srgb = pow(max(avg.rgb, vec3(0)), vec3(1 / 2.2));
  const nz = fract(dot(blk, vec2(0.75487766, 0.56984029)));
  const L = 8;
  const quant = floor(srgb.mul(L).add(nz)).div(L);
  const graded = pow(mix(srgb, quant, uToon), vec3(2.2)).add(vec3(1.0, 0.86, 0.62).mul(uFlash));
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = vec4(graded, 1);

  /* ---- frame ---- */
  const hud = document.getElementById('hud')!;
  if (q.has('hud')) hud.style.display = 'block';
  const lrPerM = (fov: number) => (Hlr * 1) / (2 * Math.tan((fov * Math.PI) / 360));
  function renderAt(t: number) {
    boxAdvance(t);
    applyTerrain(t); setInputs(t);
    const c = cameraAt(t);
    setCamera(c);
    sky.update(0.016, inputs, 400); sea.update(0.016, 0, inputs, 400);
    sea.mesh.visible = seaCoverAt(t) > 0.005 && t > 4.2;
    const pFade = 1 - sstep(4.9, 6.0, t);
    uP.value = t < 1 ? lerp(1, P_PIX, sstep(0.1, 0.95, t)) : lerp(1, P_PIX, sstep(5.0, 6.0, t) * -1 + 1);
    uToon.value = t < 1 ? sstep(0.1, 0.95, t) : 1 - sstep(5.0, 6.0, t);
    uT.value = t;
    ghostMat.color.copy(ghostA).lerp(ghostB, sstep(3.9, 5.3, t));
    uVis.value = sstep(4.7, 5.7, t);
    uSeaMix.value = sstep(2.8, 5.0, t);
    uDis.value = sstep(0.25, 1.3, t) * 1.05;
    uBoxFade.value = sstep(0.62, 1.0, t);
    uLrPerM.value = lrPerM(c.fov) * (uP.value > 0 ? (P_PIX / uP.value) : 1);
    let fl = 0; for (let k = 1; k <= N_SEEDS_DOUBLINGS; k++) fl += alpha(t - (PULSE0 + PULSE_DT * (k - 1)), 0.08);
    uFlash.value = 0.05 * Math.min(1, fl) * (1 - sstep(4.8, 5.8, t));
    const k = sstep(5.1, 5.9, t);
    character.root.visible = k > 0.001;
    if (k > 0.001) {
      character.root.position.set(XS, terrain.height(XS, ZS, stateAt(t)), ZS);
      character.root.scale.setScalar(Math.max(0.001, k));
    }
    pipeline.render();
    void pFade;
    if (hud.style.display === 'block') hud.textContent = `t=${t.toFixed(2)}s  p=${uP.value.toFixed(2)}  ${N} grains`;
  }

  let seekT = frozenT ?? 0;
  Object.assign(window, {
    __ready: true,
    __seek: (t: number) => { seekT = t; renderAt(t); },
    __info: { N, lastLand, spawn: { x: XS, z: ZS, h: hFinal }, flipY, slots: slots.length },
  });

  /* ---- run ---- */
  for (const tw of [6, 5.4, 3, 1.2, 0.5, 0]) { renderAt(tw); await new Promise((r) => requestAnimationFrame(() => r(null))); }   // compile every variant before the clock starts
  if (frozenT !== null) { renderAt(frozenT); renderer.setAnimationLoop(() => renderAt(seekT)); return; }
  let t0 = performance.now(), last = t0, frames = 0;
  const dts: number[] = [];
  const stats: Record<string, unknown> = { done: false, avg: 0, min: 0, over20: 0, frames: 0, slow: [] as number[][] };
  Object.assign(window, { __stats: stats });
  // Replay: reset the clock. The box is rebuilt (150 pre-roll steps) right away, outside the next frame's time budget.
  const restart = () => { t0 = performance.now(); last = t0; dts.length = 0; (stats.slow as number[][]).length = 0; frames = 0; stats.done = false; renderAt(0); };
  const onKey = (ev: KeyboardEvent) => { if (ev.key.toLowerCase() === 'r' && !ev.repeat && !ev.metaKey && !ev.ctrlKey) restart(); };
  addEventListener('keydown', onKey);
  // Teardown: free the GPU device when the page goes away, so quick reloads never stack devices.
  addEventListener('pagehide', (ev) => {
    if (ev.persisted) return;   // entering the back/forward cache: the page may come back, keep the device
    removeEventListener('keydown', onKey);
    renderer.setAnimationLoop(null);
    renderer.dispose();
    dev?.destroy();
  });
  renderer.setAnimationLoop((now: number) => {
    // rAF timestamps can precede the performance.now() taken in the key handler: never feed the scene a negative time.
    const el = Math.max(0, now - t0) / 1000;
    renderAt(Math.min(el, T_END));
    if (frames++ > 0 && el <= T_END) { dts.push(now - last); if (now - last > 20) (stats.slow as number[][]).push([+el.toFixed(2), Math.round(now - last)]); }
    last = now;
    if (!stats.done && el > T_END && dts.length) {
      const s = dts.slice(2);
      stats.avg = 1000 / (s.reduce((a, b) => a + b, 0) / s.length);
      stats.min = 1000 / Math.max(...s); stats.over20 = s.filter((d) => d > 20).length; stats.frames = s.length; stats.done = true;
      console.log('FPS', JSON.stringify(stats));
    }
  });
}
main().catch((e) => { console.error(e); errEl.textContent = String(e && (e as Error).stack || e); });
