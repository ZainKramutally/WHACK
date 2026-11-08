// Cinematic geology stills, dev-only. Boots each (world, seed) on a real GPU in ONE headless Chromium, finds the biggest
// landmarks and rock forms, frames each with window.lifeCam (low telephoto hero angles, a look-up shot, one high wide
// establishing shot per seed) and saves PNGs. Every shot's exact lifeCam.set() pose goes to <out>/shots.json.
//
//   CINE_URL=http://127.0.0.1:5199 node scripts/cinematic.mjs carbon:1108,7 silicon:2611,90210
//   node scripts/cinematic.mjs --sheet /tmp/cinematic/raw/carbon-7-*.png     contact sheet of existing PNGs (no world)
//
// Env: CINE_URL (a running dev server; required), CINE_OUT (default /tmp/cinematic/raw), CINE_PER_SEED (landmarks per seed, 4),
//      CINE_KINDS (optional comma list of landmark / rock-form kinds to shoot, e.g. iceSpire,iceArch).
// Playwright is not a project dependency: `playwright` if resolvable, else $PLAYWRIGHT_PATH (see scripts/smoke.mjs).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

async function loadPlaywright() {
  for (const t of ['playwright', process.env.PLAYWRIGHT_PATH].filter(Boolean)) {
    try { return await import(t.startsWith('/') ? `file://${t}` : t); } catch { /* next */ }
  }
  console.error('cinematic: Playwright not found; set PLAYWRIGHT_PATH=/abs/path/to/node_modules/playwright/index.mjs');
  process.exit(2);
}

const { chromium } = await loadPlaywright();
const OUT = process.env.CINE_OUT ?? '/tmp/cinematic/raw';
const PER_SEED = Number(process.env.CINE_PER_SEED ?? 4);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });

async function contactSheet(files, outPath, cols = 4) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const cells = files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${basename(f)}</figcaption></figure>`).join('');
  await p.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px}
    figure{margin:0}img{width:100%;display:block}figcaption{font:13px sans-serif;color:#ddd;padding:2px}</style>${cells}`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: outPath, fullPage: true });
  await p.close();
}

if (process.argv[2] === '--sheet') {
  const files = process.argv.slice(3).filter((f) => !f.startsWith('--') && existsSync(f));
  const out = process.env.CINE_SHEET ?? `${OUT}/sheet.png`;
  await contactSheet(files, out, Number(process.env.CINE_COLS ?? 4));
  console.log('sheet', out);
  await browser.close();
  process.exit(0);
}

const BASE = process.env.CINE_URL;
if (!BASE) { console.error('cinematic: set CINE_URL to a running dev server'); process.exit(2); }
const jobs = process.argv.slice(2).flatMap((a) => { const [w, s] = a.split(':'); return s.split(',').map((seed) => ({ world: w, seed: Number(seed) })); });
const shotsPath = `${OUT}/shots.json`;
const log = existsSync(shotsPath) ? JSON.parse(readFileSync(shotsPath, 'utf8')) : {};

// Runs in the page: list the structures and plan the camera poses (all checks against the CPU height sampler).
async function planShots({ perSeed, kindsOnly }) {
  const { createRockForms } = await import('/src/gen/rockForms.ts');
  const { createTerrain } = await import('/src/gen/terrain.ts');
  const { worldFor } = await import('/src/worlds/index.ts');
  const worldId = new URLSearchParams(location.search).get('world');
  const W = worldFor(worldId);
  const T = createTerrain(W.terrain, window.seed);
  const lms = window.landmarks;
  const seaCover = (W.targets.seaCover[0] + W.targets.seaCover[1]) / 200;
  const rf = lms ? createRockForms(T, lms, { seaCover }) : null;
  const I = window.app.inputs;
  const H = (x, z) => I.terrain.height(x, z);
  const sea = I.seaLevel ?? -1e9;
  const ground = (x, z) => Math.max(H(x, z), sea);
  const half = (I.terrain.patchSize ?? T.patchSize) / 2;

  const state = { rise: I.terrain.rise, heatSolvent: I.heatSolvent, progress: I.terrain.progress };
  const items = [];
  for (const l of lms?.landmarks ?? []) {
    const size = l.kind === 'iceArch' ? Math.max(l.height, l.span + 2 * l.radius) : Math.max(l.height, 2 * l.radius);
    items.push({ src: 'landmark', id: l.id, kind: l.kind, x: l.x, z: l.z, h: l.height, r: l.kind === 'iceArch' ? l.span / 2 + l.radius : l.radius, size, angle: l.angle });
  }
  for (const f of rf?.forms ?? []) {
    const r = f.kind === 'lavaTube' ? (f.length ?? f.size) / 2 : f.size;
    items.push({ src: 'rockForm', id: f.id, kind: f.kind, x: f.x, z: f.z, h: f.height, r, size: Math.max(f.height, 2 * r), angle: f.angle });
  }
  // Solid footprints (camera must stay out of them).
  const circles = [];
  for (const l of lms?.landmarks ?? []) for (const c of lms.footprints(l)) circles.push(c);
  for (const f of rf?.forms ?? []) for (const c of rf.footprints(f)) circles.push(c);
  const inside = (x, z, m) => circles.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + m) ** 2);
  // Ground must not rise above the camera→target segment (keeps the subject in view).
  const clearLine = (a, b) => {
    for (let k = 1; k < 24; k++) {
      const t = k / 24, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      if (H(x, z) > y - 0.3) return false;
    }
    return true;
  };
  const inPatch = (x, z) => Math.abs(x) < half * 0.92 && Math.abs(z) < half * 0.92;

  // Biggest first, one per kind before repeating a kind.
  // Score: size, less for structures out in the edge fog; drowned ones (top below the sea) are dropped,
  // and at most one mostly-submerged subject per seed is kept (shot from under the water).
  for (const it of items) {
    // Stand on the plain ground: the heightfield carries the relic piers, so H at a spire's centre is its pier top.
    it.base = it.src === 'landmark' ? lms.plainHeight(it.x, it.z, state) : H(it.x, it.z);
    it.wet = it.base + it.h < sea - 3;            // fully submerged: shot from under the water
    if (!it.wet && it.base < sea) { it.h -= sea - it.base; it.base = sea; it.size = Math.max(it.h, 2 * it.r); }   // a sea stack: frame the part above the water
    const edge = Math.max(Math.abs(it.x), Math.abs(it.z)) / half;
    it.score = it.size * (edge > 0.75 ? 0.5 : 1) * (it.wet ? 0.6 : 1);
  }
  const sorted = items.filter((it) => (!kindsOnly || kindsOnly.includes(it.kind)) && inPatch(it.x, it.z) && it.h > 2 && (it.base + it.h > sea + 3 || it.base + it.h < sea - 3)).sort((a, b) => b.score - a.score);
  const pick = [], kinds = new Set();
  const ok = (it) => !pick.includes(it) && !pick.some((p) => Math.hypot(p.x - it.x, p.z - it.z) < 15) && !(it.wet && pick.some((p) => p.wet));
  for (const it of sorted) if (pick.length < perSeed && !kinds.has(it.kind) && ok(it)) { pick.push(it); kinds.add(it.kind); }
  for (const it of sorted) if (pick.length < perSeed && ok(it)) pick.push(it);

  const r2 = (v) => Math.round(v * 100) / 100;
  const pose = (pos, look, fov) => ({ pos: pos.map(r2), look: look.map(r2), fov });
  const shots = [];
  for (const it of pick) {
    const base = it.base;
    const got = [];
    // Try 16 azimuths × a few distances; take two well-separated hero angles and one low look-up.
    const tries = [];
    for (let a = 0; a < 16; a++) for (const mul of [2.2, 1.7, 2.8]) tries.push({ az: (a / 16) * Math.PI * 2, mul });
    const heroes = [];
    for (const { az, mul } of tries) {
      if (heroes.length >= 2) break;
      if (heroes.some((h) => Math.abs(Math.atan2(Math.sin(h.az - az), Math.cos(h.az - az))) < 1.6)) continue;
      const d = Math.min(it.wet ? 40 : 110, Math.max(10, mul * it.size));
      const cx = it.x + Math.cos(az) * d, cz = it.z + Math.sin(az) * d;
      if (!inPatch(cx, cz) || inside(cx, cz, 2)) continue;
      const cy = (it.wet ? Math.min(H(cx, cz) + 3, sea - 1.5) : ground(cx, cz) + Math.min(6, Math.max(1.5, it.size * 0.08)));
      if (it.wet && cy < H(cx, cz) + 1) continue;
      // Off-centre look: shift the target sideways by ~12% of the distance (subject lands near a third).
      const sx = -Math.sin(az), sz = Math.cos(az), off = 0.12 * d * (heroes.length ? -1 : 1);
      const look = [it.x + sx * off, base + it.h * 0.5, it.z + sz * off];
      if (!clearLine([cx, cy, cz], [it.x, base + it.h * 0.45, it.z])) continue;
      const fov = Math.round(Math.max(30, Math.min(45, (2 * Math.atan((it.size * 0.85) / d) * 180) / Math.PI)));
      heroes.push({ az, p: pose([cx, cy, cz], look, fov), tag: 'hero' });
    }
    got.push(...heroes);
    // Look-up: close (1.4× size), camera 1.5 m above ground, aim above the top so the sky fills the frame.
    for (let a = 0; a < 16; a++) {
      const az = (a / 16) * Math.PI * 2 + 0.2, d = Math.max(7, 1.4 * Math.max(it.h, it.r * 1.5));
      const cx = it.x + Math.cos(az) * d, cz = it.z + Math.sin(az) * d;
      if (!inPatch(cx, cz) || inside(cx, cz, 1.5)) continue;
      if (heroes.some((h) => Math.abs(Math.atan2(Math.sin(h.az - az), Math.cos(h.az - az))) < 0.8)) continue;
      if (it.wet) break;
      const cy = ground(cx, cz) + 1.5;
      if (!clearLine([cx, cy, cz], [it.x, base + it.h * 0.8, it.z])) continue;
      got.push({ p: pose([cx, cy, cz], [it.x - Math.sin(az) * 0.1 * d, base + it.h * 0.7, it.z + Math.cos(az) * 0.1 * d], 42), tag: 'lookup' });
      break;
    }
    for (const g of got) shots.push({ ...g.p, subject: `${it.src}:${it.kind}#${it.id}`, tag: g.tag, size: r2(it.size) });
  }
  // Establishing: high, from the side of the patch away from the subjects' centroid, looking across them.
  if (pick.length) {
    const mx = pick.reduce((s, p) => s + p.x, 0) / pick.length, mz = pick.reduce((s, p) => s + p.z, 0) / pick.length;
    let az = Math.atan2(-mz, -mx); if (!Number.isFinite(az)) az = 0.7;
    const d = half * 0.75, cx = Math.max(-half * 0.85, Math.min(half * 0.85, mx + Math.cos(az) * d)), cz = Math.max(-half * 0.85, Math.min(half * 0.85, mz + Math.sin(az) * d));
    const cy = ground(cx, cz) + 45;
    shots.push({ ...pose([cx, cy, cz], [mx, H(mx, mz) + 5, mz], 50), subject: 'establishing', tag: 'wide' });
  }
  return { worldId, sea, half, picked: pick.map((p) => `${p.src}:${p.kind}${p.wet ? '(wet)' : ''} h=${r2(p.h)} r=${r2(p.r)} at (${r2(p.x)},${r2(p.z)})`), shots };
}

for (const { world, seed } of jobs) {
  const t0 = Date.now();
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e));
  try {
    await p.goto(`${BASE}/?world=${world}&seed=${seed}&cinematic&debug`);
    // The selection-screen placeholder inputs already read buildProgress 1, so also wait for creatures, then for the sea to settle.
    await p.waitForFunction(() => window.app?.inputs?.buildProgress >= 1 && window.app.inputs.organisms?.length > 0 && window.lifeCam && window.landmarks !== undefined, null, { timeout: 120000, polling: 500 });
    let sea0 = NaN;
    for (let i = 0; i < 10; i++) {
      await p.waitForTimeout(1500);
      const s = await p.evaluate(() => window.app.inputs.seaLevel);
      if (Math.abs(s - sea0) < 0.05) break;
      sea0 = s;
    }
    await p.waitForTimeout(3000);
    // Hide the ?debug fps readout (the in-world UI is hidden by ?cinematic).
    await p.evaluate(() => { for (const d of document.querySelectorAll('body > div')) if (d.style.font?.includes('monospace')) d.style.display = 'none'; window.lifeCam.hideUI(true); });
    const plan = await p.evaluate(planShots, { perSeed: PER_SEED, kindsOnly: process.env.CINE_KINDS?.split(',') ?? null });
    console.log(`${world}-${seed}: build ${((Date.now() - t0) / 1000).toFixed(0)}s, sea ${plan.sea.toFixed(1)}, picked`, plan.picked);
    let k = 0;
    for (const s of plan.shots) {
      const name = `${world}-${seed}-${String(k).padStart(2, '0')}`;
      await p.evaluate((s) => window.lifeCam.set({ pos: s.pos, look: s.look, fov: s.fov }), s);
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${OUT}/${name}.png` });
      log[name] = { world, seed, ...s, set: `lifeCam.set({ pos: ${JSON.stringify(s.pos)}, look: ${JSON.stringify(s.look)}, fov: ${s.fov} })` };
      k++;
    }
    writeFileSync(shotsPath, JSON.stringify(log, null, 1));
    console.log(`${world}-${seed}: ${k} shots in ${((Date.now() - t0) / 1000).toFixed(0)}s${errs.length ? ' ERRORS ' + errs.slice(0, 3).join(' | ') : ''}`);
  } catch (e) {
    console.error(`${world}-${seed}: FAILED ${e.message.split('\n')[0]}`, errs.slice(0, 3));
  } finally {
    await p.close();
  }
}
await browser.close();
