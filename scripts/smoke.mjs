// Headless smoke test, dev-only: boots each world on a real GPU, then checks fps, errors, creature counts,
// click-to-inspect on a creature, the slider red zones, swimming, and saves screenshots to /tmp.
//
//   npm run smoke                        both worlds (starts its own dev server)
//   npm run smoke -- carbon              one world
//   SMOKE_URL=http://127.0.0.1:5173 npm run smoke      reuse a running dev server
//
// Playwright is NOT a project dependency. It uses `playwright` if resolvable, else the module at $PLAYWRIGHT_PATH
// (e.g. /path/to/node_modules/playwright/index.mjs). Real GPU: headless Chromium with WebGPU (Metal on macOS).
// Exits 1 on any page error or console error. Screenshots: /tmp/{card,slider,swim}-{world}.png
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

async function loadPlaywright() {
  const tries = ['playwright', process.env.PLAYWRIGHT_PATH].filter(Boolean);
  for (const t of tries) {
    try {
      return await import(t.startsWith('/') ? `file://${t}` : t);
    } catch { /* try the next one */ }
  }
  console.error('smoke: Playwright not found. Install it somewhere and set PLAYWRIGHT_PATH=/abs/path/to/node_modules/playwright/index.mjs,\nor run `npm i --no-save playwright` (then `npx playwright install chromium`).');
  process.exit(2);
}

async function startDevServer() {
  const port = 5300 + Math.floor(Math.random() * 90);
  const proc = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return { url, stop: () => proc.kill() }; } catch { /* not up yet */ }
    await sleep(500);
  }
  proc.kill();
  throw new Error('smoke: dev server did not start');
}

const { chromium } = await loadPlaywright();
const arg = process.argv[2];
const worlds = arg === 'carbon' || arg === 'silicon' ? [arg] : ['carbon', 'silicon'];
const server = process.env.SMOKE_URL ? { url: process.env.SMOKE_URL, stop() {} } : await startDevServer();
const BASE = server.url;
let failed = false;
const MIN_FPS = 50; // fail bar for the average fps after the build at 1920x1080 (only meaningful when the machine is quiet: check `uptime`)

// Organism buffer layout (src/sim/organismLayout.ts): stride 28 floats, role at +2 (>0.5 = consumer), id at +8, x/y at +0/+1.
async function smoke(world) {
  const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const problems = [];
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e)); p.on('console', (m) => ['error'].includes(m.type()) && errs.push(m.text().slice(0, 200)));
  await p.goto(`${BASE}/?world=${world}&debug`);
  await p.evaluate(() => {
    window.__fps = []; let n = 0, last = performance.now();
    const tick = (now) => { n++; if (now - last >= 1000) { window.__fps.push({ fps: Math.round(n * 1000 / (now - last)), prog: window.app?.inputs?.buildProgress ?? 0 }); n = 0; last = now; } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const consumers = () => p.evaluate(() => { const o = window.app.inputs.organisms; let c = 0; for (let i = 0; i < o.length; i += 28) if (o[i + 2] > 0.5) c++; return c; });
  await p.waitForFunction(() => window.app?.inputs?.buildProgress >= 1 && window.app.inputs.organisms?.length > 0, null, { timeout: 90000, polling: 500 });
  await p.waitForTimeout(4000);
  const built = await consumers();
  console.log('consumers at build end+4s', built);
  if (built < 100) problems.push(`only ${built} creatures after the build`);

  // 1. creature click
  const findCreature = () => p.evaluate(() => {
    const i = window.app.inputs, patch = window.view.patchSize, s = window.player.state; let best = null;
    for (let o = 0; o < i.organisms.length; o += 28) if (i.organisms[o + 2] > 0.5) {
      const x = (i.organisms[o] - 0.5) * patch, z = (i.organisms[o + 1] - 0.5) * patch, h = i.terrain.height(x, z), d = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (h > i.seaLevel + 0.5 && (!best || d < best.d)) best = { x, z, d, id: i.organisms[o + 8], size: i.organisms[o + 3] };
    }
    return best;
  });
  const screenOf = (id) => p.evaluate((id) => {
    const i = window.app.inputs, patch = window.view.patchSize, cam = window.app.camera;
    for (let o = 0; o < i.organisms.length; o += 28) if (i.organisms[o + 8] === id) {
      const x = (i.organisms[o] - 0.5) * patch, z = (i.organisms[o + 1] - 0.5) * patch;
      const v = new cam.position.constructor(x, i.terrain.height(x, z) + 0.6, z).project(cam);
      return { sx: Math.round((v.x * 0.5 + 0.5) * innerWidth), sy: Math.round((-v.y * 0.5 + 0.5) * innerHeight), front: v.z < 1 };
    }
    return null;
  }, id);
  const c = await findCreature();
  console.log('nearest land creature', JSON.stringify(c && { ...c, d: Math.round(Math.sqrt(c.d)) }));
  // Stand 6 m in front of the creature's far side along the camera's current heading, so it ends up in view.
  await p.evaluate((c) => {
    const cam = window.app.camera, d = cam.getWorldDirection(new cam.position.constructor());
    const len = Math.hypot(d.x, d.z) || 1;
    window.player.respawn(c.x - (d.x / len) * 6, c.z - (d.z / len) * 6);
  }, c);
  await p.waitForTimeout(2500);
  let hit = null;
  for (let k = 0; k < 6 && !hit; k++) {
    const sc = await screenOf(c.id);
    if (sc?.front && sc.sx > 0 && sc.sx < 1920 && sc.sy > 0 && sc.sy < 1080) {
      await p.mouse.click(sc.sx, sc.sy); await p.waitForTimeout(1200);
      const card = await p.evaluate(() => { const c = document.querySelector('.wu-inspect'); return c && !c.hidden ? { text: c.textContent.slice(0, 160), win: (() => { const w = c.querySelector('.wu-window'); const r = w?.getBoundingClientRect(); return w && !w.hidden ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })() } : null; });
      console.log('click try', k, JSON.stringify(sc), card ? 'CARD ' + JSON.stringify(card) : 'no card');
      if (card && card.text.length) { hit = card; if (!/organism|worm|swimmer|walker|drifter|crawler|body/i.test(card.text)) console.log('(card may be non-creature)'); }
    } else console.log('creature off-screen', JSON.stringify(sc));
    if (!hit) await p.waitForTimeout(500);
  }
  if (!hit) problems.push('clicking a creature did not open an inspect card');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `/tmp/card-${world}.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  // 3. swim
  const sea = await p.evaluate(() => {
    const i = window.app.inputs, patch = window.view.patchSize; let best = null;
    for (let a = -patch / 2 + 10; a < patch / 2 - 10; a += 6) for (let z = -patch / 2 + 10; z < patch / 2 - 10; z += 6) {
      const h = i.terrain.height(a, z); if (h < i.seaLevel - 3 && (!best || h > best.h - 0.01 && Math.hypot(a, z) < Math.hypot(best.x, best.z))) best = { x: a, z, h };
    }
    return { best, sea: i.seaLevel };
  });
  console.log('sea target', JSON.stringify(sea));
  if (sea.best) {
    await p.evaluate((s) => window.player.respawn(s.x, s.z), sea.best);
    await p.waitForTimeout(3000);
    console.log('player', JSON.stringify(await p.evaluate(() => ({ mode: window.player.state.mode, y: +window.player.state.y.toFixed(2), cam: +window.app.camera.position.y.toFixed(2), sea: +window.app.inputs.seaLevel.toFixed(2) }))));
    await p.screenshot({ path: `/tmp/swim-${world}.png` });
    if ((await p.evaluate(() => window.player.state.mode)) !== 'swim') problems.push('player did not switch to swim mode in the sea');
  }
  // 2. slider
  await p.keyboard.press('Tab'); await p.waitForTimeout(700);
  const before = await consumers();
  const track = await p.evaluate(() => { const r = document.querySelector('.wu-track').getBoundingClientRect(); return { l: r.left, r: r.right, y: r.top + r.height / 2 }; });
  const readout = () => p.evaluate(() => ({ temp: document.querySelector('.wu-readout')?.textContent, reason: document.querySelector('.wu-reason')?.textContent, T: window.app.inputs.stats.temperature, bandLow: window.app.inputs.heatBand }));
  await p.mouse.move((track.l + track.r) / 2, track.y); await p.mouse.down();
  const mid = track.l + (track.r - track.l) * (world === 'carbon' ? 0.8 : 0.75);
  await p.mouse.move(mid, track.y, { steps: 10 }); await p.waitForTimeout(500);
  console.log('moderate drag', JSON.stringify(await readout()), 'consumers', before);
  const ms = []; for (let t = 0; t < 15; t += 5) { await p.waitForTimeout(5000); ms.push(await consumers()); }
  console.log('moderate: consumers every 5s', JSON.stringify(ms));
  await p.mouse.move(track.r - 1, track.y, { steps: 12 }); await p.waitForTimeout(500);
  console.log('slider hot drag', JSON.stringify(await readout()), 'consumers', before);
  await p.screenshot({ path: `/tmp/slider-${world}.png` });
  const series = [];
  for (let t = 0; t < 10; t += 5) { await p.waitForTimeout(5000); series.push(await consumers()); }
  await p.mouse.up();
  console.log('consumers every 5s for 10s after hard drag', JSON.stringify(series), 'T', (await readout()).T);
  // cold drag too
  await p.mouse.move((track.l + track.r) / 2, track.y); await p.mouse.down(); await p.mouse.move(track.l + 1, track.y, { steps: 12 }); await p.waitForTimeout(500);
  console.log('slider cold drag', JSON.stringify(await readout())); await p.mouse.up();
  await p.keyboard.press('Tab'); await p.waitForTimeout(400);

  const fps = await p.evaluate(() => window.__fps);
  const avg = (a) => a.length ? Math.round(a.reduce((s, x) => s + x.fps, 0) / a.length) : null;
  const build = fps.filter((f) => f.prog < 1), after = fps.filter((f) => f.prog >= 1);
  console.log('fps@1920x1080 build avg', avg(build), 'min', Math.min(...build.map((f) => f.fps)), '| after avg', avg(after), 'min', Math.min(...after.map((f) => f.fps)), '| samples', build.length, after.length);
  if (after.length && avg(after) < MIN_FPS) problems.push(`fps after the build averaged ${avg(after)} (< ${MIN_FPS})`);
  console.log(errs.length ? errs.slice(0, 6) : 'no errors');
  if (problems.length) console.log('PROBLEMS:', problems);
  await b.close();
    return errs.length === 0 && problems.length === 0;
}

try {
  for (const w of worlds) {
    console.log(`\n=== ${w} ===`);
    if (!(await smoke(w))) failed = true;
  }
} finally {
  server.stop();
}
process.exit(failed ? 1 : 0);
