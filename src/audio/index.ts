// Soundscape wiring (docs/features/audio.md). Read-only: listens to the bus, the DOM and the player's state.
// mountAudio() runs once at boot (selection screen, UI cues, mute button); attachWorld() runs per started world.
import { Vector3, type PerspectiveCamera } from 'three/webgpu';
import { bus } from '../bus';
import { canLive } from '../sim/limits';
import { boxState } from '../ui/selection/boxState';
import { OrganismField, ORGANISM_STRIDE, geneField } from '../sim/organismLayout';
import { worldFor } from '../worlds';
import type { SimSnapshot, WorldConfig, WorldId } from '../worlds/types';
import type { PlayerState } from '../player';
import { createEngine, type Engine } from './engine';
import { ambienceTargets, callRate } from './pure';

const UI_CUES = ['ui.hover', 'ui.click', 'ui.verdict.alive', 'ui.verdict.red', 'ui.slider.tick', 'ui.slider.blocked', 'ui.panel.open', 'ui.panel.close', 'ui.generate',
  'ui.scan.flash', 'ui.card.open', 'ui.extinct', 'amb.select', 'build.push', 'build.multiply', 'build.land'];
const worldCues = (id: WorldId) => [
  `amb.${id}.land`, `amb.${id}.shore`, `amb.${id}.under`, 'amb.frozen', 'amb.build.rise', 'amb.carbon.barren',
  'build.seas', 'build.seas.silicon', 'build.life', 'build.complete',
  'step.soil', 'step.rock', 'step.crystal', 'step.ice', 'step.wet', 'player.jump', 'player.land', 'player.splash.in', 'player.splash.out', 'player.swim', 'player.rebreather',
  ...(id === 'carbon' ? ['c.call.small', 'c.call.herd', 'c.call.apex', 'c.call.swim', 'c.wing'] : ['si.call.small', 'si.call.bell', 'si.clack', 'si.call.walker']),
];

export interface WorldAudioDeps {
  world: WorldConfig;
  camera: PerspectiveCamera;
  playerState: () => PlayerState;
  spawned: () => boolean;
  heightAt: (x: number, z: number) => number;
  patchSize: number;
  /** Mineral id under (x, z), or null when unknown. */
  mineralAt?: (x: number, z: number) => string | null;
}

export interface AudioApi { engine: Engine; attachWorld(d: WorldAudioDeps): (dt: number) => void }

/** Every interactive thing on the selection screen and in the world UI (many are not <button>s). */
const INTERACTIVE = 'button, a[href], [role=button], [role=slider], [role=option], [role=tab], .wu-tab, .axis, .btn, .chip, .cnav, .linkbtn, summary';

const SPEAKER_ON = '<svg viewBox="0 0 12 10" width="18" height="15" shape-rendering="crispEdges" fill="currentColor"><path d="M0 3h3l3-3v10L3 7H0z"/><path d="M8 3h1v4H8zM10 1h1v8h-1z"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 12 10" width="18" height="15" shape-rendering="crispEdges" fill="currentColor"><path d="M0 3h3l3-3v10L3 7H0z"/><path d="M8 3h1v1H8zM9 4h1v1H9zM10 3h1v1h-1zM8 6h1v1H8zM10 6h1v1h-1zM9 5h1v1H9z"/></svg>';

export function mountAudio(): AudioApi {
  const engine = createEngine();
  let scene: 'select' | 'world' = 'select';
  let selWorld: WorldId = 'carbon';

  // ---- autoplay + mute ----
  let clicked = false;
  const unlock = () => { engine.resume(); if (!clicked) { clicked = true; selMusic(); } };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'wu-tab wu-audio';
  const paint = () => { btn.innerHTML = engine.muted() ? SPEAKER_OFF : SPEAKER_ON; btn.setAttribute('aria-label', engine.muted() ? 'Unmute sound (M)' : 'Mute sound (M)'); btn.title = 'Sound (M)'; btn.style.opacity = engine.muted() ? '0.6' : '1'; };
  const toggleMute = () => { engine.setMuted(!engine.muted()); paint(); if (!engine.muted()) updateBeds(); };
  btn.addEventListener('click', toggleMute);
  addEventListener('keydown', (e) => {
    if (e.key !== 'm' && e.key !== 'M') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    toggleMute();
  });
  const style = document.createElement('style');
  style.textContent = `.wu-audio{cursor:pointer;color:var(--bone3,#f1e6c8);display:inline-flex;align-items:center;justify-content:center;padding:5px 9px}
.wu-audio.floating{position:fixed;right:12px;bottom:12px;z-index:60;background:#1c1a17;border:2px solid #f1e6c8}`;
  document.head.append(style);
  paint();
  const place = () => {
    const tabs = document.querySelector('.wu-tabs');
    if (tabs && btn.parentElement !== tabs) { btn.classList.remove('floating'); tabs.append(btn); }
    else if (!tabs && !btn.parentElement) { btn.classList.add('floating'); document.body.append(btn); }
  };
  place();

  // Selection screen: the selected world's track, very quietly, after the first click; crossfades with the element.
  function selMusic() {
    const on = clicked && scene === 'select';
    engine.music('music.carbon', on && selWorld === 'carbon' ? 0.4 : 0, 2);
    engine.music('music.silicon', on && selWorld === 'silicon' ? 0.4 : 0, 2);
  }

  // ---- ambience bed state shared by selection + world ----
  let worldBeds: (() => Record<string, number>) | null = null;
  function updateBeds() {
    const t = scene === 'select' ? ambienceTargets({ scene: 'select', worldId: selWorld, spawned: false, buildProgress: 0, seasFilled: false, lifeStarted: false, frozen: false, underwater: false, shoreK: 0 })
      : worldBeds ? worldBeds() : {};
    const keep = new Set(Object.keys(t));
    for (const id of keep) engine.bed(id, t[id]);
    engine.silenceBedsExcept(keep);
  }

  engine.preload(UI_CUES);
  engine.preload(worldCues(selWorld));
  bus.on('selection:changed', ({ worldId, conditions }) => {
    if (worldId !== selWorld) { selWorld = worldId; engine.preload(worldCues(worldId)); }
    const w = worldFor(worldId);
    selMusic();
    try {
      const b = boxState(w, conditions);
      const frozen = b.phase === 'frozen' || b.effect === 'freeze';
      const gas = b.phase === 'gas';
      let alive = false;
      try { alive = canLive(w, conditions).ok; } catch { /* keep */ }
      const rate = (2 + 34 * b.heat * b.heat + (gas ? 6 : 0)) * (worldId === 'silicon' ? 0.55 : 1);
      engine.box({
        rate: frozen ? 0 : rate, element: worldId, heat: b.heat, gas, frozen,
        n2k: Math.min(1, Math.max(0, (Math.log10(Math.max(0.01, conditions.nitrogen)) + 2) / 4)),
        rust: worldId === 'silicon' && b.effect === 'rust', o2k: Math.min(1, Math.max(0, conditions.oxygen / 40)), alive: alive && !frozen,
      });
    } catch { engine.box({ rate: 6, element: worldId, heat: 0.5, gas: false, frozen: false, n2k: 0.5, rust: false, o2k: 0, alive: false }); }
    const key = `${conditions.temperature}|${conditions.nitrogen}|${conditions.oxygen}`;
    if (key !== lastCond) { lastCond = key; sliderTick(); }   // not on a pure element or rock change
    // verdict flips on the element cells (carbon / silicon): a soft low tone for red, a brighter one for alive
    let flip: 'alive' | 'red' | null = null;
    for (const wid of ['carbon', 'silicon'] as WorldId[]) {
      let ok = true;
      try { ok = canLive(worldFor(wid), conditions).ok; } catch { /* keep */ }
      const was = verdict.get(wid);
      if (was !== undefined && was !== ok && (wid === worldId || !flip)) flip = ok ? 'alive' : 'red';
      verdict.set(wid, ok);
    }
    if (flip) engine.once(`ui.verdict.${flip}`);
  });
  updateBeds();

  // ---- UI cues (delegated DOM + bus) ----
  let lastCond = '';
  const verdict = new Map<WorldId, boolean>();
  let lastHover: Element | null = null, lastHoverAt = 0, lastTick = 0;
  function sliderTick() { const n = performance.now(); if (n - lastTick > 70) { lastTick = n; engine.once('ui.slider.tick', { gain: 0.6 }); } }
  addEventListener('pointerover', (e) => {
    const t = (e.target as Element | null)?.closest?.(INTERACTIVE);
    if (!t || t === lastHover) return;
    lastHover = t;
    const n = performance.now(); if (n - lastHoverAt < 60) return; lastHoverAt = n;
    engine.once('ui.hover', { gain: 0.7 });
  }, { passive: true });
  addEventListener('pointerout', (e) => { if (!(e.relatedTarget as Element | null)?.closest?.(INTERACTIVE)) lastHover = null; }, { passive: true });
  addEventListener('click', (e) => {
    const t = e.target as Element | null;
    if (!t?.closest) return;
    if (t.closest('[data-r="generate"]')) { engine.once('ui.generate', { duck: true }); return; }
    if (t.closest('[role=slider], .axis')) return;   // sliders tick instead
    if (t.closest('.wu-tab') && !t.closest('.wu-audio')) return;   // panel open/close is heard from the drawer state below
    if (t.closest(INTERACTIVE)) engine.once('ui.click');
  }, { capture: true });
  bus.on('control:set', () => sliderTick());
  bus.on('control:blocked', (b) => { if (!b.start) engine.once('ui.slider.blocked'); });
  let lastFlash = -1e9;
  // A click on a NEW SPECIES (lock still 'new') plays the scan flash instead of the card blip; and never both within 400 ms.
  bus.on('inspect:open', () => { if (!lockWasNew && performance.now() - lastFlash > 400) engine.once('ui.card.open'); });

  // DOM-state cues that have no bus event: drawers, scanner lock on NEW SPECIES, first scan filed, extinction.
  let drawerOpen = false, lockWasNew = false, deadN = 0, lastCaption = '';
  const mo = new MutationObserver(() => {
    place();
    const open = !!document.querySelector('.wu-drawer.wu-open');
    if (open !== drawerOpen) { drawerOpen = open; engine.once(open ? 'ui.panel.open' : 'ui.panel.close'); }
    const lock = document.querySelector<HTMLElement>('.wu-scan');
    const isNew = !!lock && !lock.hidden && lock.dataset.state === 'new';
    if (isNew && !lockWasNew) engine.lockOn();
    lockWasNew = isNew;
    const cap = document.querySelector('.wu-caption')?.textContent ?? '';
    if (cap !== lastCaption) { lastCaption = cap; if (cap.startsWith('New entry')) lastFlash = performance.now(); engine.once('ui.scan.flash'); }
    const counts = document.querySelectorAll('.wu-bestiary .wu-bt-count');
    const dn = counts.length > 1 ? Number(counts[1].textContent) || 0 : 0;
    if (dn > deadN) engine.once('ui.extinct');
    deadN = dn;
  });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-state'] });

  // ---- main loop for the granular fizz (the world adds its own update) ----
  let last = performance.now();
  const loop = () => { const n = performance.now(); engine.tick(Math.min(0.1, (n - last) / 1000)); last = n; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  bus.on('world:selected', () => { scene = 'world'; engine.box(null); selMusic(); engine.preload(worldCues(selWorld)); });

  function attachWorld(d: WorldAudioDeps): (dt: number) => void {
    const { world } = d;
    const id = world.id;
    const [seasStart] = world.build.seasSec;
    let latest: SimSnapshot | null = null;
    let lifeStarted = false, complete = false;
    bus.on('sim:snapshot', (s) => { latest = s; });
    bus.on('build:life', () => { lifeStarted = true; engine.once('build.life', { duck: true }); });
    bus.on('build:complete', () => { complete = true; engine.once('build.complete', { duck: true }); musicAt = tAcc; });
    // music phrases: fade in 6 s, play 90–150 s, fade out 8 s, silent 45–90 s, repeat
    const trackId = `music.${id}`;
    let musicAt = -1, musicState: 'wait' | 'in' | 'out' | 'silent' = 'wait', musicNext = 0;
    function musicStep(now: number) {
      if (!complete || musicAt < 0) return;
      if (musicState === 'wait') { musicState = 'in'; engine.music(trackId, 1, 6); musicNext = now + 6 + 90 + Math.random() * 60; }
      else if (musicState === 'in' && now >= musicNext) { musicState = 'out'; engine.music(trackId, 0, 8); musicNext = now + 8 + 45 + Math.random() * 45; }
      else if (musicState === 'out' && now >= musicNext) { musicState = 'wait'; }
    }
    const fired = { push: false, multiply: false, land: false, seas: false };
    let underwater = false, stepDist = 0, lastJumpT = -1e9, swimT = 0, creatureT = 0, tAcc = 0, bedT = 0;
    let nextCallAt = 8 + Math.random() * 8, lastCallAt = -1e9, lastStingerAt = -1e9;
    const fwd = new Vector3();
    let shoreK = 0, seasFilled = false, frozen = false, stingerAt = 25 + Math.random() * 30;

    worldBeds = () => !latest ? {} : ambienceTargets({
      scene: 'world', worldId: id, spawned: d.spawned(), buildProgress: complete ? 1 : latest.buildProgress, seasFilled, lifeStarted, frozen, underwater, shoreK,
    });

    /** One global gate: a call every 10–20 s from ONE animal among the nearest 4 within 60 m (weighted to the nearest). */
    function creatures(s: SimSnapshot, p: PlayerState, now: number) {
      if (now < nextCallAt) return;
      if (now - lastStingerAt < 5) { nextCallAt = lastStingerAt + 5; return; }
      const buf = s.organisms, n = Math.floor(buf.length / ORGANISM_STRIDE);
      const K = 4, idx: number[] = [], dist: number[] = [];
      for (let i = 0; i < n; i++) {
        const o = i * ORGANISM_STRIDE;
        if (buf[o + OrganismField.role] < 0.5 || buf[o + OrganismField.mode] === 3) continue;   // sessile bodies are silent
        const dx = (buf[o + OrganismField.x] - 0.5) * d.patchSize - p.x, dz = (buf[o + OrganismField.y] - 0.5) * d.patchSize - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 60 * 60) continue;
        let j = dist.length;
        if (j >= K && d2 >= dist[K - 1]) continue;
        while (j > 0 && dist[j - 1] > d2) j--;
        idx.splice(j, 0, i); dist.splice(j, 0, d2);
        if (idx.length > K) { idx.pop(); dist.pop(); }
      }
      if (!idx.length) { nextCallAt = now + 2; return; }   // nobody in range: skip this turn, look again soon
      let rank = 0; { let r = Math.random() * ((idx.length * (idx.length + 1)) / 2); while (r > idx.length - rank && rank < idx.length - 1) { r -= idx.length - rank; rank++; } }   // weights N, N-1, …, 1
      const i = idx[rank], o = i * ORGANISM_STRIDE;
      const oid = buf[o + OrganismField.id];
      const mode = buf[o + OrganismField.mode];
      const diet = buf[o + geneField('diet')], soc = buf[o + geneField('sociality')], seg = buf[o + geneField('segments')];
      const size = buf[o + OrganismField.size];
      const drawnLen = 2 * Math.pow(Math.max(size, 0.01) / 0.15, 0.8);
      const swimmer = mode === 1;
      let cue: string;
      if (id === 'carbon') cue = swimmer ? 'c.call.swim' : mode === 2 ? 'c.wing' : diet > 0.65 && drawnLen > 3 ? 'c.call.apex' : soc > 0.5 ? 'c.call.herd' : 'c.call.small';
      else cue = mode === 2 ? 'si.call.bell' : mode === 0 ? (seg >= 0.55 ? 'si.call.walker' : 'si.clack') : 'si.call.small';
      const wx = (buf[o + OrganismField.x] - 0.5) * d.patchSize, wz = (buf[o + OrganismField.y] - 0.5) * d.patchSize;
      const wy = d.heightAt(wx, wz) + 1 + Math.min(60, buf[o + OrganismField.altitude] * 0.1);
      const rate = callRate(drawnLen / 4, s.stats.temperature, world.life.inputs.airDensity.molarMass);   // length relative to a 4 m typical body
      const ok = engine.once(cue, { rate, at: { x: wx, y: wy, z: wz }, gain: swimmer && !underwater ? 0.4 : 1, refDistance: 6 + Math.min(14, drawnLen), seed: oid, lengthRel: drawnLen / 4, hrtf: true });
      if (ok) { lastCallAt = now; nextCallAt = now + 10 + Math.random() * 10; } else nextCallAt = now + 2;   // file still decoding: try again shortly
    }

    return (dt) => {
      const s = latest; if (!s) return;
      tAcc += dt;
      musicStep(tAcc);
      const p = d.playerState();
      seasFilled = s.timeSec >= seasStart;
      frozen = s.stats.temperature < world.solvent.freezeC;
      shoreK = seasFilled ? Math.min(1, Math.max(0, 1 - (p.y - s.stats.seaLevel) / 12)) : 0;

      // build one-shots, from the config's own timings
      const spawnSec = world.build.spawnSec;
      if (!fired.push && s.timeSec >= 0) { fired.push = true; engine.once('build.push', { duck: true, maxSec: spawnSec * 0.25 }); }
      if (!fired.multiply && s.timeSec >= spawnSec * 0.25) { fired.multiply = true; engine.once('build.multiply', { duck: true, maxSec: spawnSec * 0.55 }); }
      if (!fired.land && s.timeSec >= spawnSec * 0.8) { fired.land = true; engine.once('build.land', { duck: true, maxSec: Math.max(2, seasStart - spawnSec * 0.8) }); }
      if (!fired.seas && seasFilled && !complete) { fired.seas = true; engine.once(id === 'silicon' ? 'build.seas.silicon' : 'build.seas', { duck: true, maxSec: Math.max(3, world.build.seasSec[1] - seasStart) }); }

      if (!d.spawned()) { bedT += dt; if (bedT > 0.25) { bedT = 0; updateBeds(); } return; }

      // underwater switch
      const uw = p.mode === 'swim' && seasFilled && !frozen && p.y < s.stats.seaLevel;
      if (uw !== underwater) { underwater = uw; engine.setUnderwater(uw); updateBeds(); }
      bedT += dt; if (bedT > 0.25) { bedT = 0; updateBeds(); }

      // wind: denser air is louder and lower; the player's speed adds gust
      const rho = s.stats.airDensity ?? 1.2;
      const dens = Math.min(1, rho / 13);
      const gust = Math.min(1, p.speed / 8);
      engine.windSet(uw ? 0 : (0.025 + 0.05 * dens + 0.05 * gust) * (s.buildProgress < 1 ? 0.4 : 1), 160 + 700 / (1 + rho / 2) + 250 * gust);

      // footsteps and player cues
      if (p.switchedFrom === 'walk' && p.mode === 'swim') engine.once('player.splash.in');
      else if (p.switchedFrom === 'swim' && p.mode === 'walk') engine.once('player.splash.out');
      if (p.jumped) { lastJumpT = performance.now(); engine.once('player.jump', { gain: 0.4 }); }
      if (p.landed > 0.35 || (p.landed > 0.05 && performance.now() - lastJumpT < 2000)) engine.once('player.land', { gain: Math.min(1, 0.2 + 0.3 * p.landed) });
      if (p.mode === 'walk' && p.grounded && p.speed > 0.6) {
        stepDist += p.speed * dt;
        const stride = p.sprinting ? 2.4 : 1.7;
        if (stepDist >= stride) {
          stepDist = 0;
          const min = d.mineralAt?.(p.x, p.z) ?? null;
          let cue = 'step.soil';
          if (p.onIce) cue = 'step.ice';
          else if (!frozen && shoreK > 0.85 && seasFilled) cue = 'step.wet';
          else if (id === 'silicon') cue = min === 'ice' || min === 'waterIce' ? 'step.ice' : 'step.crystal';
          else cue = min === 'granite' ? 'step.rock' : 'step.soil';
          engine.once(cue, { gain: p.sprinting ? 0.45 : 0.3, rate: 0.94 + Math.random() * 0.12 });
        }
      } else stepDist = Math.min(stepDist, 1);
      if (p.mode === 'swim' && p.speed > 1.5) { swimT += dt; if (swimT > 1.1) { swimT = 0; engine.once('player.swim', { gain: 0.7 }); } } else swimT = 0.8;

      // listener = camera
      d.camera.getWorldDirection(fwd);
      engine.listener(d.camera.position.x, d.camera.position.y, d.camera.position.z, fwd.x, fwd.y, fwd.z);

      if (s.buildProgress >= 1 && tAcc >= stingerAt) {
        if (tAcc - lastCallAt < 5) { stingerAt = lastCallAt + 5; } else {
        stingerAt = tAcc + 20 + Math.random() * 40; lastStingerAt = tAcc;
        const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90;
        const sx = p.x + Math.cos(a) * r, sz = p.z + Math.sin(a) * r;
        engine.stinger(lifeStarted && !frozen && Math.random() < 0.6 ? 'call' : 'creak', { x: sx, y: d.heightAt(sx, sz) + 3, z: sz }, callRate(2, s.stats.temperature, world.life.inputs.airDensity.molarMass));
        }
      }
      creatureT += dt;
      if (creatureT >= 0.5) { creatureT = 0; if (lifeStarted) creatures(s, p, tAcc); }
    };
  }

  return { engine, attachWorld };
}
