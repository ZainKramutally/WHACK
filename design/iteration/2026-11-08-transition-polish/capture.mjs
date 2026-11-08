import { chromium } from '/tmp/pw-node/node_modules/playwright/index.mjs';
import fs from 'fs';
const [world, out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:${port}/?demo&debug`);
await p.waitForSelector('[data-r="generate"]', { timeout: 60000 });
if (world === 'silicon') await p.click('[data-fam="silicon"]');
await p.waitForTimeout(9000);   // let the plan prime
// in-page per-frame state logger
await p.evaluate(() => {
  const log = (window.__tlog = []);
  const q = (s) => document.querySelector(s);
  const st = (e) => { if (!e) return null; const c = getComputedStyle(e); return { o: +(+c.opacity).toFixed(3), v: c.visibility, d: c.display, m: (c.maskImage || '').slice(0, 60), tf: c.transform === 'none' ? 1 : +c.transform.slice(7).split(',')[0] }; };
  const loop = () => {
    const sheet = q('.sel, [class*="sel"]') && document.getElementById('ui')?.firstElementChild;
    const roots = [...document.querySelectorAll('.launching')];
    const sh = roots[0] || null;
    const ov = [...document.querySelectorAll('canvas')].find((c) => c.style.zIndex === '101');
    const hud = q('.wu-root'); const tab = q('.wu-tab'); const cap = q('.wu-caption');
    log.push({ w: performance.timeOrigin + performance.now(), T: window.__genT ?? null, sheet: st(sh), overlay: st(ov), hud: st(hud), tab: st(tab), cap: st(cap), capOn: cap?.classList.contains('wu-on') ?? null, char: window.player?.state ? !!window.app?.scene?.getObjectByName?.('x') : null, charVis: window.player ? (window.__charVis ?? null) : null });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
const cdp = await p.context().newCDPSession(p);
const frames = [];
let n = 0;
cdp.on('Page.screencastFrame', async (f) => {
  const t = f.metadata.timestamp * 1000;
  fs.writeFileSync(`${out}/f${String(n).padStart(4, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  frames.push({ n: n++, w: t });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
const t0 = Date.now();
await p.click('[data-r="generate"]');
await p.waitForTimeout(9500);
await cdp.send('Page.stopScreencast');
const log = await p.evaluate(() => ({ log: window.__tlog, frames: window.__genFrames, cam: window.__genCam }));
fs.writeFileSync(`${out}/log.json`, JSON.stringify({ ...log, frames2: frames, t0 }));
console.log('frames', frames.length, 'log', log.log.length);
await b.close();
