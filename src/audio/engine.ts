// Web Audio engine: one context, groups, shared reverb, master low-pass (underwater), limiter, lazy cue decoding.
// Degrades silently: a missing manifest or file means the cue just doesn't play. Never touches sim state or the sim RNG.

export type Group = 'ambience' | 'sfx' | 'ui' | 'creatures' | 'build';
interface Entry { id: string; file: string; loop: boolean; gain: number }
export interface OnceOpts {
  group?: Group; gain?: number; rate?: number; duck?: boolean; send?: number;
  at?: { x: number; y: number; z: number }; refDistance?: number;
  /** Per-organism seed for the synthesised call fallback (contour, timbre). */
  /** Fade out so the cue never outlasts the next build event (seconds). */ maxSec?: number;
  seed?: number; /** Body length relative to a 4 m typical body, for the formant. */ lengthRel?: number; /** HRTF (nearest few) instead of equalpower. */ hrtf?: boolean;
}

const MAX_VOICES = 24;
const MAX_CREATURE_VOICES = 6;
const MANIFEST_URL = '/audio/manifest.json';

/** Particle-box audio state, from boxState(world, conditions) plus the Nitrogen and Oxygen sliders. */
export interface BoxAudio {
  rate: number;                       // grains per second (0 = silent grains)
  element: 'carbon' | 'silicon';
  heat: number;                       // 0..1
  gas: boolean;                       // boiling off: busy, hissy bursts
  frozen: boolean;                    // silence + a faint low creak
  n2k: number;                        // 0..1 from log10(nitrogen): airy hiss layer level
  rust: boolean;                      // silicon oxidising: low crackle
  o2k: number;                        // 0..1 oxygen (carbon: slight shimmer)
  alive: boolean;                     // canLive passes: soft slow swell
}

export interface Engine {
  readonly ctx: AudioContext | null;
  resume(): void;
  /** The game's sound as a MediaStream (a tap after the limiter), for video capture; null when there is no audio. */
  captureStream(): MediaStream | null;
  setMuted(m: boolean): void;
  muted(): boolean;
  /** Start fetching + decoding these cue bases (and their variants) in the background. */
  preload(bases: string[]): void;
  once(base: string, o?: OnceOpts): boolean;
  /** Fade a looping bed toward `gain` (0 stops it audibly). */
  bed(id: string, gain: number, group?: Group): void;
  /** Fade every bed not listed in `keep` to silence. */
  silenceBedsExcept(keep: Set<string>): void;
  setUnderwater(on: boolean): void;
  duck(sec: number): void;
  listener(px: number, py: number, pz: number, fx: number, fy: number, fz: number): void;
  windSet(gain: number, cutoffHz: number): void;
  /** Selection-screen particle box sound; null silences it. */
  box(b: BoxAudio | null): void;
  /** Fade a looping music track toward `level` over `sec` seconds (0 fades it out and stops it). */
  music(id: string, level: number, sec: number): void;
  tick(dt: number): void;           // advances the granular scheduler
  creatureVoices(): number;
  /** A rare distant one-off (call or creak), synthesised. */
  /** Subtle synthesised two-tick lock-on for the NEW SPECIES scanner lock (no file, no reverb send). */
  lockOn(): void;
  stinger(kind: 'call' | 'creak', at: { x: number; y: number; z: number }, rate: number): void;
  dispose(): void;
}

const noop = () => {};
export function createEngine(): Engine {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  let ctx: AudioContext | null = null;
  try { ctx = Ctor ? new Ctor() : null; } catch { ctx = null; }
  if (!ctx) {
    return { ctx: null, captureStream: () => null, resume: noop, setMuted: noop, muted: () => true, preload: noop, once: () => false, bed: noop, silenceBedsExcept: noop,
      setUnderwater: noop, duck: noop, listener: noop, windSet: noop, box: noop, music: noop, tick: noop, creatureVoices: () => 0, stinger: noop, lockOn: noop, dispose: noop };
  }
  const c = ctx;
  let tapNode: MediaStreamAudioDestinationNode | null = null;
  let isMuted = false;
  try { isMuted = localStorage.getItem('audio.muted') === '1'; } catch { /* private mode */ }

  // ---- graph ----
  const master = c.createGain(); master.gain.value = isMuted ? 0 : 0.9;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
  const comfort = c.createBiquadFilter(); comfort.type = 'highshelf'; comfort.frequency.value = 6000; comfort.gain.value = -6;   // tame harsh highs
  master.connect(comfort); comfort.connect(limiter); limiter.connect(c.destination);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 22000; lp.Q.value = 0.7;
  lp.connect(master);
  const reverb = c.createConvolver();
  reverb.buffer = makeImpulse(c, 2.4);
  const reverbIn = c.createGain(); reverbIn.gain.value = 1;
  const reverbOut = c.createGain(); reverbOut.gain.value = 0.5;
  reverbIn.connect(reverb); reverb.connect(reverbOut); reverbOut.connect(lp);
  const duckGain = c.createGain(); duckGain.connect(lp);
  const steps = c.createGain(); const stepsLp = c.createBiquadFilter(); stepsLp.type = 'lowpass'; stepsLp.frequency.value = 1600;   // footsteps: muffled, no reverb send
  steps.connect(stepsLp); stepsLp.connect(lp);
  const musicG = c.createGain(); musicG.gain.value = 0.35; musicG.connect(lp);   // music: straight to the master low-pass, a little reverb
  const musicSend = c.createGain(); musicSend.gain.value = 0.15; musicG.connect(musicSend); musicSend.connect(reverbIn);
  const groups: Record<Group, GainNode> = { ambience: c.createGain(), sfx: c.createGain(), ui: c.createGain(), creatures: c.createGain(), build: c.createGain() };
  groups.ambience.connect(duckGain); groups.sfx.connect(lp); groups.creatures.connect(lp); // ui skips the underwater filter but is capped below 5 kHz
  const uiLp = c.createBiquadFilter(); uiLp.type = 'lowpass'; uiLp.frequency.value = 5000; uiLp.Q.value = 0.7; groups.ui.connect(uiLp); uiLp.connect(master);
  // build bus: dark and weighty (low-pass 1.2 kHz, +3 dB low shelf below 150 Hz), not ducked by itself
  const buildLp = c.createBiquadFilter(); buildLp.type = 'lowpass'; buildLp.frequency.value = 1200; buildLp.Q.value = 0.7;
  const buildShelf = c.createBiquadFilter(); buildShelf.type = 'lowshelf'; buildShelf.frequency.value = 150; buildShelf.gain.value = 3;
  groups.build.connect(buildLp); buildLp.connect(buildShelf); buildShelf.connect(lp);
  const sends: Record<Group, GainNode> = { ambience: c.createGain(), sfx: c.createGain(), ui: c.createGain(), creatures: c.createGain(), build: c.createGain() };
  const baseSend: Record<Group, number> = { ambience: 0.12, sfx: 0.18, ui: 0.05, creatures: 0.3, build: 0.1 };
  for (const g of Object.keys(groups) as Group[]) { sends[g].gain.value = baseSend[g]; groups[g].connect(sends[g]); sends[g].connect(reverbIn); }
  groups.sfx.gain.value = 0.9; groups.creatures.gain.value = 0.8; groups.ambience.gain.value = 0.8; groups.ui.gain.value = 0.7; groups.build.gain.value = 1;

  // ---- manifest + buffers ----
  let manifest: Map<string, Entry[]> | null = null;
  let manifestP: Promise<void> | null = null;
  const buffers = new Map<string, AudioBuffer | 'missing' | Promise<void>>();
  function loadManifest(): Promise<void> {
    return (manifestP ??= fetch(MANIFEST_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((arr: Entry[]) => {
        manifest = new Map();
        for (const e of arr) {
          const base = e.id.replace(/\.\d+$/, '');
          const l = manifest.get(base) ?? []; l.push(e); manifest.set(base, l);
        }
      }).catch(() => { manifest = new Map(); console.debug('[audio] no manifest: running silent'); }));
  }
  function ensure(id: string, file: string): Promise<void> {
    const have = buffers.get(id);
    if (have instanceof Promise) return have;
    if (have) return Promise.resolve();
    const p = fetch(`/audio/${file.replace(/^\/?(audio\/)?/, '')}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('404'))))
      .then((ab) => c.decodeAudioData(ab)).then((b) => { buffers.set(id, b); }).catch(() => { buffers.set(id, 'missing'); });
    buffers.set(id, p);
    return p;
  }
  function variants(base: string): Entry[] { return manifest?.get(base) ?? []; }
  function preload(bases: string[]) {
    void loadManifest().then(() => { for (const b of bases) for (const e of variants(b)) void ensure(e.id, e.file); });
  }
  const bufOf = (id: string) => { const b = buffers.get(id); return b && !(b instanceof Promise) && b !== 'missing' ? b : null; };

  // ---- one-shots ----
  let voices = 0, creatureVoices = 0;
  const lastPick = new Map<string, number>();
  function once(base: string, o: OnceOpts = {}): boolean {
    if (isMuted || voices >= MAX_VOICES) return false;
    const vs = variants(base);
    if (!vs.length) {
      if (!manifest) { void loadManifest(); return false; }   // not known yet: stay silent this time
      return synth(base, o);
    }
    const group = o.group ?? (base.startsWith('build.') ? 'build' : base.startsWith('ui.') ? 'ui' : base.startsWith('c.') || base.startsWith('si.') ? 'creatures' : 'sfx');
    if (group === 'creatures' && creatureVoices >= MAX_CREATURE_VOICES) stealOldest();
    let k = Math.floor(Math.random() * vs.length);
    if (vs.length > 1 && k === lastPick.get(base)) k = (k + 1) % vs.length;
    lastPick.set(base, k);
    const e = vs[k];
    const buf = bufOf(e.id);
    if (!buf) { const st = buffers.get(e.id); if (st === 'missing') return synth(base, o); void ensure(e.id, e.file); return false; }
    const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = (o.rate ?? 1) * (group === 'build' ? 0.75 : 1);   // build cues are pitched down and slowed
    const g = c.createGain(); g.gain.value = (o.gain ?? 1) * (e.gain ?? 1);
    if (o.maxSec && buf.duration / src.playbackRate.value > o.maxSec) {   // never outlast the next build event
      const t = c.currentTime, end = t + o.maxSec;
      g.gain.setValueAtTime(g.gain.value, Math.max(t, end - 1.2)); g.gain.linearRampToValueAtTime(0, end);
      src.stop(end + 0.05);
    }
    let tail: AudioNode = g;
    src.connect(g);
    if (o.at) {
      const p = c.createPanner();
      p.panningModel = o.hrtf === false ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = o.refDistance ?? 6; p.rolloffFactor = 1.2; p.maxDistance = 400;
      p.positionX.value = o.at.x; p.positionY.value = o.at.y; p.positionZ.value = o.at.z;
      g.connect(p); tail = p;
    }
    tail.connect((base.startsWith('step.') || base === 'player.land' || base === 'player.jump') ? steps : groups[group]);
    voices++; if (group === 'creatures') creatureVoices++;
    const rec = { stop: () => { try { src.stop(); } catch { /* ended */ } } };
    if (group === 'creatures') creatureList.push(rec);
    src.onended = () => { voices--; if (group === 'creatures') { creatureVoices--; const i = creatureList.indexOf(rec); if (i >= 0) creatureList.splice(i, 1); } try { tail.disconnect(); g.disconnect(); } catch { /* gone */ } };
    src.start();
    if (o.duck) duck(Math.min(4, buf.duration / src.playbackRate.value));
    return true;
  }


  // ---- synthesised fallbacks (used when a cue has no file) ----
  const creatureList: { stop: () => void }[] = [];
  function stealOldest() { creatureList.shift()?.stop(); }
  const hash01 = (n: number, k: number) => { let x = Math.imul((n | 0) ^ (k * 0x9e3779b1), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  function env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0003, t + a + d);
  }
  function blip(group: Group, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'triangle', cutoff = 4000) {
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain(); env(g, t, 0.004, peak, dur);
    osc.connect(f); f.connect(g); g.connect(groups[group]);
    osc.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function route(group: Group, at: OnceOpts['at'], hrtf: boolean, ref: number): AudioNode {
    if (!at) return groups[group];
    const p = c.createPanner(); p.panningModel = hrtf ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.2; p.maxDistance = 400;
    p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; p.connect(groups[group]);
    return p;
  }
  /** One voice: sawtooth source through a bandpass formant at ∝ speed of sound ÷ length (rate carries both), contour from the organism's hash. */
  function call(o: OnceOpts, base: string, dur: number, gainK: number, silicon: boolean, formantHz: number): boolean {
    if (voices >= MAX_VOICES) return false;
    if (creatureVoices >= MAX_CREATURE_VOICES) stealOldest();
    const seed = o.seed ?? Math.floor(Math.random() * 1e6);
    const rate = o.rate ?? 1;
    const t = c.currentTime;
    const f0 = (silicon ? 140 : 110) * rate * (0.8 + hash01(seed, 1) * 0.6);
    const contour = [1, 0.7 + hash01(seed, 2) * 0.9, 0.6 + hash01(seed, 3) * 0.9];
    const osc = c.createOscillator(); osc.type = silicon ? 'sine' : hash01(seed, 7) < 0.5 ? 'sine' : 'triangle';
    const extra: OscillatorNode[] = [];
    if (silicon) {   // FM bell: inharmonic modulator (ratio ~1.4–3.5) bends the carrier, glassy partials
      const mod = c.createOscillator(); mod.frequency.value = f0 * (1.4 + hash01(seed, 8) * 2.1);
      const mg = c.createGain(); mg.gain.value = f0 * (1.2 + hash01(seed, 9) * 1.8);
      mod.connect(mg); mg.connect(osc.frequency); mod.start(t); mod.stop(t + dur + 0.1); extra.push(mod);
    } else {   // soft organic vibrato
      const vib = c.createOscillator(); vib.frequency.value = 4 + hash01(seed, 8) * 4;
      const vg = c.createGain(); vg.gain.value = f0 * 0.04;
      vib.connect(vg); vg.connect(osc.frequency); vib.start(t); vib.stop(t + dur + 0.1); extra.push(vib);
    }
    osc.frequency.setValueAtTime(f0 * contour[0], t);
    osc.frequency.linearRampToValueAtTime(f0 * contour[1], t + dur * 0.5);
    osc.frequency.linearRampToValueAtTime(f0 * contour[2], t + dur);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = silicon ? 3 : 2; bp.frequency.value = Math.min(3500, Math.max(180, formantHz * (0.8 + hash01(seed, 4) * 0.5)));
    const g = c.createGain(); env(g, t, 0.03 + hash01(seed, 5) * 0.05, 0.55 * gainK * (o.gain ?? 1), dur);
    void extra;
    const callLp = c.createBiquadFilter(); callLp.type = 'lowpass'; callLp.frequency.value = 4500;   // nothing above ~5 kHz
    osc.connect(bp); bp.connect(callLp); callLp.connect(g);
    const tail = route('creatures', o.at, !!o.hrtf, o.refDistance ?? 8);
    g.connect(tail);
    voices++; creatureVoices++;
    const rec = { stop: () => { try { osc.stop(); } catch { /* ended */ } } }; creatureList.push(rec);
    osc.onended = () => { voices--; creatureVoices--; const i = creatureList.indexOf(rec); if (i >= 0) creatureList.splice(i, 1); try { g.disconnect(); tail.disconnect(); } catch { /* gone */ } };
    osc.start(t); osc.stop(t + dur + 0.1);
    void base;
    return true;
  }
  function lockOn() {
    if (isMuted || c.state !== 'running') return;
    const t0 = c.currentTime;
    [680, 860].forEach((f, k) => {
      const t = t0 + k * 0.04;
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain(); env(g, t, 0.003, 0.25 * 0.5, 0.03);
      o.connect(g); g.connect(uiLp); o.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
      o.start(t); o.stop(t + 0.05);
    });
  }
  function pad(freqs: number[], dur: number, peak: number) {
    const t = c.currentTime;
    for (const f of freqs) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(groups.sfx); o.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
  function synth(base: string, o: OnceOpts): boolean {
    if (base === 'ui.scan.flash') return synth('ui.click', o);   // fallback only; the file wins
    if (base === 'ui.verdict.alive') { blip('ui', 620, 830, 0.2, 0.05, 'sine', 3500); return true; }
    if (base === 'ui.verdict.red') { blip('ui', 300, 210, 0.26, 0.055, 'sine', 1200); return true; }
    if (base === 'ui.hover') { blip('ui', 2500, 2450, 0.03, 0.045 * (o.gain ?? 1), 'sine', 6000); return true; }
    if (base === 'ui.click') {
      const t = c.currentTime, g = o.gain ?? 1;
      const n = c.createBufferSource(); n.buffer = noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 1.2;
      const ng = c.createGain(); env(ng, t, 0.001, 0.34 * g, 0.022);
      n.connect(f); f.connect(ng); ng.connect(groups.ui); n.onended = () => { try { ng.disconnect(); } catch { /* gone */ } };
      n.start(t, Math.random() * 1.5, 0.05);
      blip('ui', 200, 90, 0.07, 0.3 * g, 'sine', 1400);
      return true;
    }
    if (base === 'ui.slider.tick') { blip('ui', 1200, 1100, 0.025, 0.05 * (o.gain ?? 1), 'sine', 3000); return true; }
    if (base === 'build.complete') { pad([196, 246.9, 293.7], 5, 0.05); setTimeout(() => pad([220, 261.6, 329.6, 440], 6, 0.045), 2200); if (o.duck) duck(5); return true; }
    if (base.startsWith('c.') || base.startsWith('si.')) {
      const silicon = base.startsWith('si.');
      const formant = 500 * (o.rate ?? 1);   // rate already carries c ÷ length
      const dur = base.includes('apex') ? 1.4 : base.includes('herd') ? 0.7 : base.includes('clack') ? 0.12 : base.includes('wing') ? 0.25 : 0.5;
      return call(o, base, dur, base.includes('clack') ? 0.5 : 1, silicon, formant * 2);
    }
    return false;
  }
  function stinger(kind: 'call' | 'creak', at: { x: number; y: number; z: number }, rate: number) {
    if (isMuted || voices >= MAX_VOICES) return;
    if (kind === 'call') { call({ at, rate: rate * 0.6, refDistance: 25, gain: 0.5, seed: Math.floor(Math.random() * 1e6), hrtf: true }, 'stinger', 2.2, 0.8, false, 420); return; }
    const t = c.currentTime;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(55 * rate, t); osc.frequency.linearRampToValueAtTime(38 * rate, t + 2.5);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 12;
    const g = c.createGain(); env(g, t, 0.4, 0.14, 2.4);
    osc.connect(f); f.connect(g); const tail = route('sfx', at, false, 30); g.connect(tail);
    osc.onended = () => { try { g.disconnect(); tail.disconnect(); } catch { /* gone */ } };
    osc.start(t); osc.stop(t + 3);
  }

  // ---- beds ----
  interface Bed { gain: GainNode; src: AudioBufferSourceNode | null; target: number; group: Group }
  const beds = new Map<string, Bed>();
  function bed(id: string, target: number, group: Group = id.startsWith('amb.build') ? 'build' : 'ambience') {
    let b = beds.get(id);
    if (!b) {
      if (target <= 0) return;
      const g = c.createGain(); g.gain.value = 0; g.connect(groups[group]);
      b = { gain: g, src: null, target: 0, group }; beds.set(id, b);
      void loadManifest().then(() => { const e = variants(id)[0]; if (e) void ensure(e.id, e.file).then(() => startBed(id)); });
    }
    b.target = target;
    if (b.src) b.gain.gain.setTargetAtTime(isMuted ? 0 : target * (variants(id)[0]?.gain ?? 1), c.currentTime, 0.6);   // ~1.8 s to settle
    else startBed(id);
  }
  function startBed(id: string) {
    const b = beds.get(id); if (!b || b.src || b.target <= 0) return;
    const e = variants(id)[0]; const buf = e && bufOf(e.id); if (!buf) return;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; if (id.startsWith('amb.build')) src.playbackRate.value = 0.75; src.connect(b.gain); src.start(0, Math.random() * buf.duration);
    b.src = src;
    b.gain.gain.setTargetAtTime(b.target * (e.gain ?? 1), c.currentTime, 0.6);
  }
  function silenceBedsExcept(keep: Set<string>) { for (const [id, b] of beds) if (!keep.has(id) && b.target > 0) bed(id, 0, b.group); }

  // ---- procedural: noise, wind, fizz ----
  const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const windSrc = c.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true;
  const windF = c.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 400; windF.Q.value = 0.8;
  const windG = c.createGain(); windG.gain.value = 0;
  windSrc.connect(windF); windF.connect(windG); windG.connect(groups.ambience); windSrc.start();
  function windSet(gain: number, cutoff: number) {
    windG.gain.setTargetAtTime(isMuted ? 0 : gain, c.currentTime, 0.3);
    windF.frequency.setTargetAtTime(cutoff, c.currentTime, 0.3);
  }
  // ---- particle box: grains (element-specific), airy N2 hiss, frozen creak, rust crackle, alive swell ----
  let bx: BoxAudio | null = null, grainAcc = 0, creakIn = 3, crackleIn = 1, pulseIn = 2, lastElement: 'carbon' | 'silicon' | null = null;
  const elG = { carbon: c.createGain(), silicon: c.createGain() };
  for (const k of ['carbon', 'silicon'] as const) { elG[k].gain.value = 0; elG[k].connect(groups.ui); }
  const hissSrc = c.createBufferSource(); hissSrc.buffer = noiseBuf; hissSrc.loop = true;
  const hissBp = c.createBiquadFilter(); hissBp.type = 'bandpass'; hissBp.frequency.value = 1400; hissBp.Q.value = 0.4;
  const hissLp = c.createBiquadFilter(); hissLp.type = 'lowpass'; hissLp.frequency.value = 3200;
  const hissG = c.createGain(); hissG.gain.value = 0;
  hissSrc.connect(hissBp); hissBp.connect(hissLp); hissLp.connect(hissG); hissG.connect(groups.ui); hissSrc.start();
  function box(b: BoxAudio | null) {
    bx = b;
    const t = c.currentTime;
    hissG.gain.setTargetAtTime(b && !isMuted ? 0.004 + 0.016 * b.n2k : 0, t, 0.25);   // quiet at 0.01x, fuller at 100x+
    if (b) {
      hissBp.frequency.setTargetAtTime(1000 + 800 * b.n2k + (b.gas ? 500 : 0), t, 0.3);
      if (b.element !== lastElement) {   // ~0.5 s crossfade
        lastElement = b.element;
        for (const k of ['carbon', 'silicon'] as const) { elG[k].gain.cancelScheduledValues(t); elG[k].gain.setValueAtTime(elG[k].gain.value, t); elG[k].gain.linearRampToValueAtTime(k === b.element ? 1 : 0, t + 0.5); }
      }
    }
  }
  function grain(b: BoxAudio) {
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    const g = c.createGain();
    const pitch = 1 + 0.35 * b.heat;   // warmer = slightly higher
    let dur: number, peak: number;
    if (b.element === 'carbon') {   // watery bubble: short, round, rising chirp
      const f0 = (600 + Math.random() * 1200) * pitch * (1 + 0.2 * b.o2k);
      f.Q.value = b.gas ? 1.5 : 4 + 2 * b.o2k;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.min(3800, f0 * (b.gas ? 1.2 : 1.6)), t + 0.03);
      s.playbackRate.value = 0.7 + Math.random() * 0.6;
      dur = b.gas ? 0.02 + Math.random() * 0.02 : 0.03 + Math.random() * 0.035; peak = (0.03 + Math.random() * 0.03) * (0.6 + 0.6 * b.heat);
    } else {   // glassy cryogenic tick, sparse, with a faint metallic ring
      const f0 = Math.min(3500, (1500 + Math.random() * 2000) * pitch);
      f.Q.value = b.gas ? 2 : 9;
      f.frequency.value = f0;
      s.playbackRate.value = 1 + Math.random() * 0.5;
      dur = b.gas ? 0.02 : 0.012 + Math.random() * 0.015; peak = (0.03 + Math.random() * 0.025) * (0.6 + 0.6 * b.heat);
      if (!b.gas) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = Math.min(3800, f0 * 1.51);
        const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(peak * 0.18, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0003, t + 0.12);
        o.connect(og); og.connect(elG.silicon); o.onended = () => { try { og.disconnect(); } catch { /* gone */ } };
        o.start(t); o.stop(t + 0.14);
      }
    }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.003 + dur);
    s.connect(f); f.connect(g); g.connect(elG[b.element]);
    s.onended = () => { try { g.disconnect(); f.disconnect(); } catch { /* gone */ } };
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }
  function lowTone(f0: number, f1: number, dur: number, peak: number, attack: number, type: OscillatorType = 'sine') {
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 400;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lpf); lpf.connect(g); g.connect(groups.ui); o.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
    o.start(t); o.stop(t + dur + 0.05);
  }
  function crackle() {
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * (0.03 + Math.random() * 0.05);
      const s = c.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.5;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700 + Math.random() * 500;
      const g = c.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.03, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, tt + 0.03);
      s.connect(f); f.connect(g); g.connect(groups.ui); s.onended = () => { try { g.disconnect(); } catch { /* gone */ } };
      s.start(tt, Math.random() * 1.5, 0.05);
    }
  }
  function tick(dt: number) {
    if (!bx || isMuted || c.state !== 'running') { grainAcc = 0; return; }
    const b = bx;
    if (b.frozen) {   // silence + a very faint low creak every few seconds
      grainAcc = 0; creakIn -= dt;
      if (creakIn <= 0) { creakIn = 3 + Math.random() * 4; lowTone(70 + Math.random() * 30, 45 + Math.random() * 15, 0.9, 0.018, 0.25, 'sawtooth'); }
      return;
    }
    if (b.rate > 0) {
      grainAcc += b.rate * dt;
      let n = 0;
      while (grainAcc >= 1 && n < 4) { grainAcc -= 1; n++; grain(b); }
      if (grainAcc > 4) grainAcc = 0;
    }
    if (b.rust) { crackleIn -= dt; if (crackleIn <= 0) { crackleIn = 0.5 + Math.random() * 1.5; crackle(); } }
    if (b.alive) { pulseIn -= dt; if (pulseIn <= 0) { pulseIn = 3 + Math.random(); lowTone(62, 50, 1.1, 0.02, 0.45); } }
  }

  // ---- music: looping tracks with fading levels (phrases are scheduled by the caller) ----
  interface Track { g: GainNode; src: AudioBufferSourceNode | null; level: number }
  const tracks = new Map<string, Track>();
  function music(id: string, level: number, sec: number) {
    let t = tracks.get(id);
    if (!t) { if (level <= 0) return; const g = c.createGain(); g.gain.value = 0; g.connect(musicG); t = { g, src: null, level: 0 }; tracks.set(id, t); }
    const tr = t; tr.level = level;
    void loadManifest().then(() => {
      const e = variants(id)[0]; if (!e) return;
      void ensure(e.id, e.file).then(() => {
        const buf = bufOf(e.id); if (!buf || tr.level !== level) return;
        const now = c.currentTime;
        if (level > 0 && !tr.src) {
          const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(tr.g); src.start(0, Math.random() * buf.duration); tr.src = src;
        }
        tr.g.gain.cancelScheduledValues(now); tr.g.gain.setValueAtTime(tr.g.gain.value, now);
        tr.g.gain.linearRampToValueAtTime(level * (e.gain ?? 1), now + Math.max(0.05, sec));
        if (level <= 0 && tr.src) { const s0 = tr.src; tr.src = null; try { s0.stop(now + sec + 0.1); } catch { /* ended */ } }
      });
    });
  }

  function duck(sec: number) {
    const t = c.currentTime;
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setTargetAtTime(0.5, t, 0.03);   // −6 dB in ~0.1 s
    duckGain.gain.setTargetAtTime(1, t + sec, 0.2);   // released over ~0.6 s
  }
  duckGain.gain.value = 1;

  function setUnderwater(on: boolean) {
    const t = c.currentTime;
    lp.frequency.setTargetAtTime(on ? 600 : 22000, t, 0.12);
    reverbOut.gain.setTargetAtTime(on ? 1.1 : 0.5, t, 0.3);
    for (const g of ['sfx', 'creatures', 'ambience'] as Group[]) sends[g].gain.setTargetAtTime(baseSend[g] * (on ? 2.2 : 1), t, 0.3);
    // the rebreather loop rides on the same switch
    bed('player.rebreather', on ? 0.8 : 0, 'sfx');
    musicG.gain.setTargetAtTime(on ? 0.35 * 0.4 : 0.35, t, 0.4);   // −8 dB underwater
  }

  function listener(px: number, py: number, pz: number, fx: number, fy: number, fz: number) {
    const l = c.listener;
    if (l.positionX) {
      l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
      l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  }

  return {
    ctx: c,
    captureStream() {
      if (!tapNode) { try { tapNode = c.createMediaStreamDestination(); limiter.connect(tapNode); } catch { return null; } }
      return tapNode.stream;
    },
    resume() { if (c.state !== 'running') void c.resume().catch(noop); },
    setMuted(m) {
      isMuted = m; try { localStorage.setItem('audio.muted', m ? '1' : '0'); } catch { /* ignore */ }
      master.gain.setTargetAtTime(m ? 0 : 0.9, c.currentTime, 0.05);
    },
    muted: () => isMuted,
    preload, once, bed, silenceBedsExcept, setUnderwater, duck, listener,
    windSet,
    box, music,
    tick,
    stinger, lockOn,
    creatureVoices: () => creatureVoices,
    dispose() { void c.close().catch(noop); },
  };
}

/** Exponentially decaying stereo noise: a cheap room/cave impulse, generated in code. */
function makeImpulse(c: AudioContext, sec: number): AudioBuffer {
  const n = Math.floor(c.sampleRate * sec);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
  }
  return b;
}
