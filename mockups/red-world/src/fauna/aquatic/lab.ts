// Aquatic lab (fauna.html?view=aquatic…): an underwater tank for the procedural swimmers.
//   ?view=aquatic                 all five swimming in one tank (~50 individuals); &water=carbon|nitrogen (default carbon)
//   ?view=aquatic&i=N             orbit close-up of swimmer N (follows it), param panel + seed re-roll (live only)
//   ?view=aquatic-strip&i=N       6 frames over one stroke cycle from a fixed side camera (judge wave vs travel)
//   ?view=aquatic-sheet&i=N       configurability sheet: swimmer N across 6 param settings
// &seed=N re-rolls proportions, &set=key:value,fins.lateral:9 overrides params, &t=SEC freezes time, &style=smooth.
// Capture hooks: window.__ready, window.__info, window.__fps. The free camera (labcam.ts) runs in live views.
import * as THREE from 'three/webgpu';
import { createPost } from '../../post';
import { createLabCam } from '../labcam';
import { stadium, type Path } from '../path';
import { add, norm, rotate, scl, type V3 } from '../../flora/mesh';
import { buildSwimmer, schoolOffsets, type SwimInstance } from './build';
import { buildAquarium, type Aquarium, type SwimEntry } from './render';
import { W, setWater, waterBackground, floorMaterial } from './material';
import { WATERS, type WaterKind } from './palette';
import { AQUATIC_VARIANTS, variantParams } from './variants';
import { mergeParams, parseSet, type DeepPartial, type SwimmerParams } from './params';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'aquatic';
const pick = Math.min(AQUATIC_VARIANTS.length - 1, Number(q.get('i') ?? (view === 'aquatic' ? -1 : 0)));
const single = view === 'aquatic' && q.has('i');
const lineup = view === 'aquatic' && !single;
let seed = Number(q.get('seed') ?? 1);
const fixedT = q.has('t') ? Number(q.get('t')) : null;
const FREE = fixedT === null && !location.hash.includes('capture');
const crowd = Number(q.get('crowd') ?? 1);
let over: DeepPartial<SwimmerParams> = parseSet(q.get('set'));
const baseParams = AQUATIC_VARIANTS.map(variantParams);
const nativeWater = (i: number): WaterKind => (baseParams[i].chemistry === 'silicon' ? 'nitrogen' : 'carbon');
const water: WaterKind = (q.get('water') as WaterKind) ?? (lineup ? 'carbon' : nativeWater(Math.max(0, pick)));

// ---- paths ------------------------------------------------------------------------------------------------------------
/** Stadium loop at depth cy with a gentle vertical swell (dip m, `waves` per lap); tangent includes the climb. */
function swimLoop(cx: number, cy: number, cz: number, a: number, b: number, dip = 0.6, waves = 2): Path {
  const st = stadium(cx, cz, a, b);
  const k = (2 * Math.PI * waves) / st.length;
  return {
    length: st.length,
    at(s) {
      const r = st.at(s);
      const y = cy + dip * Math.sin(k * s), dy = dip * k * Math.cos(k * s);
      return { p: [r.p[0], y, r.p[2]], t: norm([r.t[0], dy, r.t[2]]) };
    },
  };
}
const swimLine = (x0: number, y: number, z0: number): Path => ({ length: Infinity, at: (s) => ({ p: [x0 + s, y, z0], t: [1, 0, 0] }) });

// ---- entries -----------------------------------------------------------------------------------------------------------
interface Lane { i: number; path: Path; count: number }
function paramsFor(i: number): SwimmerParams { return i === pick && !lineup ? mergeParams(baseParams[i], over) : baseParams[i]; }
function entriesFor(lanes: Lane[], sd: number): { entries: SwimEntry[]; firstOf: number[] } {
  const entries: SwimEntry[] = [];
  const firstOf: number[] = AQUATIC_VARIANTS.map(() => -1);
  for (const l of lanes) {
    const p = paramsFor(l.i);
    const lead = buildSwimmer(p, sd * 31 + l.i);
    const insts: SwimInstance[] = schoolOffsets(lead, l.count, sd + l.i);
    firstOf[l.i] = entries.length;
    insts.forEach((inst, k) => entries.push({ sw: k === 0 ? lead : buildSwimmer(p, sd * 31 + l.i + 1000 * k), path: l.path, inst }));
  }
  return { entries, firstOf };
}
// lineup: each species in its own band of the tank, all crossing the frame (camera at z = 22 looking at the origin)
const LINEUP: Lane[] = [
  { i: 0, path: swimLoop(-1, 6.2, -7, 9, 4.5, 0.8, 1), count: 2 },
  { i: 1, path: swimLoop(-5.5, -1.6, -2, 3.4, 2.6, 0.3, 2), count: 3 },
  { i: 2, path: swimLoop(2.5, 0.4, 9, 2.6, 1.8, 0.4, 2), count: 32 },
  { i: 3, path: swimLoop(5, 7.2, -3, 3.5, 3, 0.6, 1), count: 10 },
  { i: 4, path: swimLoop(-8.5, 8.6, -1, 2.6, 3.2, 0.5, 1), count: 2 },
];
function lanesForView(): Lane[] {
  if (lineup) return LINEUP.map((l) => ({ ...l, count: Math.round(l.count * crowd) || 1 }));
  const p = paramsFor(pick);
  const L = p.chemistry === 'silicon' && p.plan === 'bell' ? p.length * (p.radial.chain + 1) : p.length;
  if (view === 'aquatic-strip' || view === 'aquatic-sheet') return [{ i: pick, path: swimLine(0, 2, 0), count: 1 }];
  const r = Math.max(2.5, 2.2 * L);
  return [{ i: pick, path: swimLoop(0, 2, 0, r * 0.9, r, 0.25 * L, 1), count: Math.min(p.school, p.chemistry === 'silicon' ? 1 : 6) }];
}

// ---- scene ------------------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGPURenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();
document.body.style.background = '#000';

setWater(water);
W.floorY.value = lineup ? -6 : -4;
W.surfaceY.value = lineup ? 14 : 12;
const scene = new THREE.Scene();
scene.backgroundNode = waterBackground();
const wv = WATERS[water];
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMaterial(wv.floor, wv.floorLight));
floor.rotation.x = -Math.PI / 2;
floor.position.y = W.floorY.value;
scene.add(floor);
// a few rock pillars at the back give the tank depth planes (they fade into the water)
const rocks = new THREE.Group();
{
  const mat = floorMaterial(wv.floor, wv.shadow);
  const R = (a: number) => { const x = Math.sin(a * 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let k = 0; k < 9; k++) {
    const h = 14 + 26 * R(k + 1), r = 2 + 4 * R(k + 7);
    const g = new THREE.CylinderGeometry(r * 0.45, r, h, 7, 4);
    const pp = g.attributes.position;
    for (let v = 0; v < pp.count; v++) { const y = pp.getY(v); const s = 1 + 0.18 * Math.sin(y * 1.7 + k) ; pp.setX(v, pp.getX(v) * s); pp.setZ(v, pp.getZ(v) * s); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.position.set(-60 + 15 * k + 6 * R(k + 3), W.floorY.value + h / 2 - 0.3, -48 - 30 * R(k + 5));
    rocks.add(m);
  }
}
scene.add(rocks);

let lanes = lanesForView();
let built = entriesFor(lanes, seed);
let aq: Aquarium = buildAquarium(built.entries);
scene.add(aq.group);
function rebuild() {
  scene.remove(aq.group); aq.dispose();
  lanes = lanesForView();
  built = entriesFor(lanes, seed);
  aq = buildAquarium(built.entries);
  scene.add(aq.group);
  publishInfo();
}

const camera = new THREE.PerspectiveCamera(lineup ? 40 : 36, innerWidth / innerHeight, 0.03, 600);
const post = createPost(renderer, scene, camera);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.resize(innerHeight); };
addEventListener('resize', resize);
resize();

function publishInfo() {
  (window as any).__info = {
    water, seed,
    variants: AQUATIC_VARIANTS.map((v, i) => {
      const sw = buildSwimmer(paramsFor(i), seed * 31 + i);
      const k = sw.kin;
      return {
        name: v.name, why: v.why, inspiration: v.inspiration, chemistry: sw.params.chemistry, plan: sw.params.plan, length: +sw.L.toFixed(2),
        motion: k.kind, cycle: +k.cycle.toFixed(3), speed: +k.speed.toFixed(3), waveSpeed: +k.waveSpeed.toFixed(3), slip: +k.slip.toFixed(2), school: sw.params.school,
      };
    }),
    stats: aq.stats(),
  };
}
publishInfo();

// ---- cameras ----------------------------------------------------------------------------------------------------------
const UPV: V3 = [0, 1, 0];
/** Front-3/4 close-up of entry k at its current pose, on the side the light comes from. */
function closeUp(k: number, distK = 2.6, yaw = 1.05) {
  const c = aq.centres[k], f = aq.forwards[k], sw = built.entries[k].sw;
  const fh = norm([f[0], 0, f[2]]);
  const Lx = W.lightDir.value.x, Lz = W.lightDir.value.z;
  const side = Math.cos(Math.atan2(fh[2], fh[0]) + yaw) * Lx + Math.sin(Math.atan2(fh[2], fh[0]) + yaw) * Lz >= 0 ? 1 : -1;
  const d = rotate(fh, UPV, -side * yaw);
  const ext = Math.max(sw.frameR, 0.3);
  const pos = add(add(c, scl(d, ext * distK)), [0, ext * 0.45, 0]);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(c[0], c[1] - ext * 0.05, c[2]);
}

const info = document.getElementById('info')!;
const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));

if (view === 'aquatic-strip') {
  // 6 frames across one stroke/pulse cycle; the swimmer passes a fixed side camera (travel vs wave reads frame to frame)
  const cw = 640, ch = 400;
  renderer.setSize(cw, ch); camera.aspect = cw / ch; camera.updateProjectionMatrix(); post.resize(ch);
  const out = document.createElement('canvas');
  out.width = cw * 3; out.height = ch * 2;
  renderer.domElement.style.display = 'none';
  document.body.appendChild(out);
  const ctx = out.getContext('2d')!;
  const sw = built.entries[0].sw, k = sw.kin;
  const tMid = 6, t0 = tMid - k.cycle / 2;
  built.entries[0].inst.s0 = -(sw.kin.kind === 'wave' ? k.speed * tMid : k.speed * tMid) + sw.L * 0.45;
  W.time.value = tMid; aq.update(tMid);
  const c = aq.centres[0], ext = sw.frameR * 1.15 + k.stroke * 0.5;
  // body waves are lateral, so wave swimmers are watched from above-side (~60° up); rowers and bells from the side
  if (k.kind === 'wave') camera.position.set(c[0] + 0.1 * ext, c[1] + ext * 2.1, c[2] + ext * 1.25);
  else camera.position.set(c[0] + 0.12 * ext, c[1] + 0.35 * ext, c[2] + ext * 2.3);
  camera.lookAt(c[0], c[1], c[2]);
  for (let f = 0; f < 6; f++) {
    const t = t0 + (f / 6) * k.cycle;
    W.time.value = t; aq.update(t); post.render();
    await raf(); await raf();
    const bmp = await createImageBitmap(renderer.domElement);
    ctx.drawImage(bmp, (f % 3) * cw, Math.floor(f / 3) * ch);
    ctx.fillStyle = water === 'carbon' ? '#f4e6dc' : '#22060f'; ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(`${AQUATIC_VARIANTS[pick].name}  t+${(t - t0).toFixed(2)}s  ${k.kind} cycle ${k.cycle.toFixed(2)}s  v ${k.speed.toFixed(2)} m/s${k.kind === 'wave' ? `  wave ${k.waveSpeed.toFixed(2)} m/s` : `  ${k.stroke.toFixed(2)} m/stroke`}`, (f % 3) * cw + 8, Math.floor(f / 3) * ch + 18);
  }
  (window as any).__ready = true;
} else if (view === 'aquatic-sheet') {
  // configurability: the same swimmer under 6 param settings, same pose time and framing
  const p0 = paramsFor(pick), si = p0.chemistry === 'silicon';
  const bell = si && p0.plan === 'bell';
  const PRESETS: { label: string; set: DeepPartial<SwimmerParams> }[] = si ? [
    { label: 'base', set: {} },
    { label: bell ? 'chain 1 (lone bell)' : 'symmetry 3, arms ×1.5', set: bell ? { radial: { chain: 1, trail: 1.2 } } : { radial: { symmetry: 3, armLen: p0.radial.armLen * 1.5 } } },
    p0.radial.symmetry >= 6 ? { label: 'symmetry 3, tiers 2', set: { radial: { symmetry: 3, tiers: 2 } } } : { label: 'symmetry 8, tiers 5', set: { radial: { symmetry: 8, tiers: 5 } } },
    bell ? { label: 'symmetry 4, flared', set: { aspect: p0.aspect * 1.5, radial: { symmetry: 4 } } } : { label: 'spikes 1, opaque', set: { translucency: 0.1, radial: { spikes: 1 } } },
    { label: bell ? 'trail 3, eyes 2' : 'eyes 3, feelers 2', set: bell ? { radial: { trail: 3 }, head: { eyes: 2 } } : { head: { eyes: 3, feelers: 2 } } },
    { label: bell ? 'plan radial (rower)' : 'plan bell', set: bell ? { plan: 'radial', length: 1.1, aspect: 0.55 } : { plan: 'bell', length: 0.8, aspect: 1.2, radial: { chain: 3, trail: 1.5 } } },
  ] : [
    { label: 'base', set: {} },
    { label: 'long + thin, anguilliform', set: { length: p0.length * 1.3, aspect: p0.aspect * 0.5, undulation: 1 } },
    { label: 'short + deep, carangiform', set: { aspect: p0.aspect * 1.7, depth: Math.min(4, p0.depth * 1.3), undulation: 0, tail: 'lunate' } },
    p0.head.eyes >= 4 ? { label: 'two eyes, no claws, jaw', set: { head: { eyes: 2, stalks: 0, feelers: 0, mouth: 'jaw' } } } : { label: 'five stalked eyes + claws', set: { head: { eyes: 5, stalks: 0.12, feelers: 2, feelerLen: 0.32 } } },
    p0.fins.lateral >= 3 ? { label: 'pectoral paddles + sail + fork', set: { fins: { lateral: 1, lateralSize: 0.22, dorsal: 0.08, fringe: 0 }, tail: 'fork' } } : { label: 'lobe fringe + sail + fan', set: { fins: { lateral: 9, lateralSize: 0.16, dorsal: 0.07, fringe: 0.8 }, tail: 'fan' } },
    { label: 'glass + glow', set: { translucency: 0.85, glow: 1, photophores: 14, lateralLine: 1 } },
  ];
  const cw = 640, ch = 400;
  renderer.setSize(cw, ch); camera.aspect = cw / ch; camera.updateProjectionMatrix(); post.resize(ch);
  const out = document.createElement('canvas');
  out.width = cw * 3; out.height = ch * 2;
  renderer.domElement.style.display = 'none';
  document.body.appendChild(out);
  const ctx = out.getContext('2d')!;
  const t = fixedT ?? 6;
  scene.remove(aq.group);
  for (let c = 0; c < 6; c++) {
    const p = mergeParams(p0, PRESETS[c].set);
    const sw = buildSwimmer(p, seed * 31 + pick);
    const a = buildAquarium([{ sw, path: swimLine(0, 2, 0), inst: { s0: -sw.kin.speed * t, phase: 0, off: [0, 0], k: 0 } }]);
    scene.add(a.group);
    W.time.value = t; a.update(t);
    aq = a; built = { entries: [{ sw, path: swimLine(0, 2, 0), inst: { s0: 0, phase: 0, off: [0, 0], k: 0 } }], firstOf: [] };
    closeUp(0, 2.4, 0.6);
    post.render();
    await raf(); await raf();
    const bmp = await createImageBitmap(renderer.domElement);
    ctx.drawImage(bmp, (c % 3) * cw, Math.floor(c / 3) * ch);
    ctx.fillStyle = water === 'carbon' ? '#f4e6dc' : '#22060f'; ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(`${AQUATIC_VARIANTS[pick].name} · ${PRESETS[c].label}`, (c % 3) * cw + 8, Math.floor(c / 3) * ch + 18);
    scene.remove(a.group); a.dispose();
  }
  (window as any).__ready = true;
} else {
  if (lineup) { camera.position.set(0, 2.2, 22); camera.lookAt(0, 2.8, 0); }
  let labcam: ReturnType<typeof createLabCam> | null = null;
  const centreOfVariant = (i: number) => (built.firstOf[i] >= 0 ? aq.centres[built.firstOf[i]] : null);
  const startLabCam = () => {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const subj = lineup ? [0, 2.8, 0] : aq.centres[0];
    const d = camera.position.distanceTo(new THREE.Vector3(subj[0], subj[1], subj[2]));
    const tgt = camera.position.clone().addScaledVector(dir, d);
    return createLabCam({ camera, dom: renderer.domElement, target: [tgt.x, tgt.y, tgt.z], creatures: AQUATIC_VARIANTS.length, centreOf: centreOfVariant, select: Math.max(0, pick), follow: !lineup, autoRotate: lineup ? 0 : 0.12 });
  };
  if (!lineup && FREE) mountPanel();
  const t0 = performance.now();
  let lastNow = t0, frames = 0, fpsT = t0, fps = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const t = fixedT ?? (now - t0) / 1000 + 4;
    W.time.value = t;
    aq.update(t);
    const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    if (labcam) labcam.update(dt);
    else {
      if (!lineup) closeUp(0);
      if (FREE) labcam = startLabCam();
    }
    post.render();
    frames++;
    if (now - fpsT > 1000) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; (window as any).__fps = fps; }
    const st = aq.stats();
    info.textContent = `${lineup ? 'tank' : AQUATIC_VARIANTS[pick].name} · ${water} · seed ${seed} · ${st.swimmers} swimmers · ${st.drawCalls} draws · ${fps.toFixed(0)} fps`;
    if (frames === 3) (window as any).__ready = true;
  });
}

// ---- param panel (live close-up only) ---------------------------------------------------------------------------------
function mountPanel() {
  const p0 = baseParams[pick], si = p0.chemistry === 'silicon';
  type Ctl = { key: string; label: string; min: number; max: number; step: number; get: (p: SwimmerParams) => number };
  const ctls: Ctl[] = [
    { key: 'length', label: si && p0.plan === 'bell' ? 'bell height m' : 'length m', min: Math.max(0.05, p0.length * 0.3), max: p0.length * 2.5, step: 0.01, get: (p) => p.length },
    { key: 'aspect', label: 'aspect', min: 0.02, max: si ? 1.6 : 0.6, step: 0.005, get: (p) => p.aspect },
    si ? { key: 'radial.symmetry', label: 'symmetry', min: 3, max: 8, step: 1, get: (p) => p.radial.symmetry }
      : { key: 'undulation', label: 'undulation', min: 0, max: 1, step: 0.01, get: (p) => p.undulation },
    si ? (p0.plan === 'bell' ? { key: 'radial.chain', label: 'bells', min: 1, max: 6, step: 1, get: (p) => p.radial.chain } : { key: 'radial.armLen', label: 'arm length', min: 0.2, max: 2.2, step: 0.01, get: (p) => p.radial.armLen })
      : { key: 'fins.lateral', label: 'lateral fins', min: 0, max: 14, step: 1, get: (p) => p.fins.lateral },
    { key: 'head.eyes', label: 'eyes', min: 0, max: si ? 3 : 6, step: 1, get: (p) => p.head.eyes },
    { key: 'glow', label: 'glow', min: 0, max: 1, step: 0.01, get: (p) => p.glow },
    { key: 'translucency', label: 'translucency', min: 0, max: 1, step: 0.01, get: (p) => p.translucency },
  ];
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'fixed', right: '8px', top: '8px', font: '12px ui-monospace, monospace', color: '#22060f', background: 'rgba(244,230,220,0.86)', padding: '6px 8px', width: '250px' });
  el.innerHTML = `<b>${AQUATIC_VARIANTS[pick].name}</b><div style="opacity:.7;margin:2px 0 6px">${AQUATIC_VARIANTS[pick].inspiration}</div>`;
  const setStr = () => Object.entries(flat(over)).map(([k, v]) => `${k}:${typeof v === 'number' ? +v.toFixed(3) : v}`).join(',');
  const sync = () => { const u = new URL(location.href); u.searchParams.set('seed', String(seed)); const s = setStr(); if (s) u.searchParams.set('set', s); else u.searchParams.delete('set'); history.replaceState(null, '', u); };
  for (const c of ctls) {
    const row = document.createElement('label');
    Object.assign(row.style, { display: 'grid', gridTemplateColumns: '92px 1fr 40px', gap: '4px', alignItems: 'center' });
    const cur = c.get(mergeParams(p0, over));
    row.innerHTML = `<span>${c.label}</span><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${cur}"><span>${+cur.toFixed(2)}</span>`;
    const input = row.querySelector('input')!, val = row.querySelectorAll('span')[1];
    let pending = 0;
    input.addEventListener('input', () => {
      val.textContent = String(+Number(input.value).toFixed(2));
      over = mergeParams(mergeParams(p0, over), parseSet(`${c.key}:${input.value}`)) as any;
      over = diff(p0, over as SwimmerParams);
      cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { rebuild(); sync(); });
    });
    el.appendChild(row);
  }
  const btns = document.createElement('div');
  btns.style.marginTop = '6px';
  btns.innerHTML = `<button data-a="seed">re-roll seed</button> <button data-a="reset">reset</button>`;
  btns.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (a === 'seed') seed += 1;
    if (a === 'reset') { over = {}; for (const inp of el.querySelectorAll('input')) (inp as HTMLInputElement).value = String(ctls[[...el.querySelectorAll('input')].indexOf(inp)].get(p0)); }
    rebuild(); sync();
  });
  el.appendChild(btns);
  document.body.appendChild(el);
}
function flat(o: any, pre = ''): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o ?? {})) { if (v && typeof v === 'object') Object.assign(out, flat(v, pre + k + '.')); else out[pre + k] = v; }
  return out;
}
/** The overrides of p relative to base (so the URL stays short). */
function diff(base: SwimmerParams, p: SwimmerParams): DeepPartial<SwimmerParams> {
  const fb = flat(base), fp = flat(p), out: string[] = [];
  for (const k of Object.keys(fp)) if (fp[k] !== fb[k]) out.push(`${k}:${fp[k]}`);
  return parseSet(out.join(','));
}
