// Screenshots (P) and video (V, press again to stop) of the 3D canvas, plus window.lifeCam.screenshot() /
// startRecording() / stopRecording() for Playwright. The DOM UI is never in the image: only the canvas is captured.
// A screenshot is read inside the frame loop right after the render (the drawing buffer can be cleared after present).
import type { App } from './render/app';

/** yyyymmdd-hhmmss in local time. */
export function stamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
/** life-<world>-<seed>-<stamp>.<ext>; world and seed are made filename-safe, and unknown ones read "menu" / "0". */
export function captureName(world: string | undefined, seed: number | undefined, d: Date, ext: 'png' | 'webm'): string {
  const w = (world ?? 'menu').replace(/[^a-z0-9]+/gi, '-') || 'menu';
  return `life-${w}-${seed ?? 0}-${stamp(d)}.${ext}`;
}
/** First supported recorder type, best first. */
export function pickMime(isSupported: (t: string) => boolean): string | undefined {
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm'].find(isSupported);
}
/** True when no render frame has requested a recorder frame lately, so a timer should (selection screen, stalled loop). */
export function needFallbackFrame(nowMs: number, lastFrameMs: number, gapMs = 100): boolean {
  return nowMs - lastFrameMs > gapMs;
}
/** "0:12" */
export function recClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface CaptureApi {
  screenshot(): Promise<Blob>;
  startRecording(): void;
  stopRecording(): Promise<Blob | null>;
  /** The run being captured, for file names. */
  setRun(world: string | undefined, seed: number | undefined): void;
  readonly recording: boolean;
}

export interface CaptureOptions {
  /** Master audio tap (a MediaStream of the game's sound), or null. */
  audioStream?: () => MediaStream | null;
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export function mountCapture(app: App, opts: CaptureOptions = {}): CaptureApi {
  const canvas = app.renderer.domElement;
  let world: string | undefined, seed: number | undefined;

  // ---- feedback (DOM, so never in the image) ----
  const flash = document.createElement('div'); flash.className = 'wu-cap-flash';
  const toast = document.createElement('div'); toast.className = 'wu-cap-toast';
  const chip = document.createElement('div'); chip.className = 'wu-cap-rec'; chip.hidden = true;
  document.body.append(flash, toast, chip);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string) => {
    toast.textContent = text; toast.classList.add('wu-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('wu-on'), 2200);
  };

  // ---- screenshots ----
  const pending: ((b: Blob) => void)[] = [];
  const grab = (resolve: (b: Blob) => void) =>
    canvas.toBlob((b) => { if (b) resolve(b); }, 'image/png');
  // Recording frames are requested explicitly (captureStream(0) + requestFrame) right after each render: a stream that
  // waits for canvas changes can stall on a second recording, and WebGPU presents outside the 2D "canvas changed" path.
  let vTrack: CanvasCaptureMediaStreamTrack | null = null;
  let lastRecFrame = 0;
  app.registerOverlay(() => {
    if (vTrack) { vTrack.requestFrame(); lastRecFrame = performance.now(); }
    if (!pending.length) return;
    const rs = pending.splice(0);
    // toBlob snapshots the canvas when it is called, so every waiting request gets this frame
    for (const r of rs) grab(r);
  });
  function screenshot(): Promise<Blob> {
    return new Promise<Blob>((resolve) => {
      let done = false;
      const fin = (b: Blob) => { if (!done) { done = true; resolve(b); } };
      pending.push(fin);
      // No frame is drawn while the selection screen covers the canvas: read what is there after a moment.
      setTimeout(() => { if (!done) { const i = pending.indexOf(fin); if (i >= 0) pending.splice(i, 1); grab(fin); } }, 300);
    });
  }
  async function shootAndSave() {
    const blob = await screenshot();
    flash.classList.remove('wu-on'); void flash.offsetWidth; flash.classList.add('wu-on');
    const name = captureName(world, seed, new Date(), 'png');
    download(blob, name);
    say(`Saved screenshot: ${name}`);
  }

  // ---- video ----
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let t0 = 0, tick: ReturnType<typeof setInterval> | undefined, fallback: ReturnType<typeof setInterval> | undefined;
  let owned: MediaStreamTrack[] = [];   // tracks made for this recording only; stopped when it ends
  let finishing: ((b: Blob | null) => void)[] = [];

  function startRecording() {
    if (rec || typeof MediaRecorder === 'undefined') { if (typeof MediaRecorder === 'undefined') say('Video recording is not supported in this browser'); return; }
    // A fresh stream and fresh tracks per recording. The audio tap is shared, so its tracks are cloned (stopping a clone leaves the tap alive).
    const video = canvas.captureStream(0);
    vTrack = video.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const audio = opts.audioStream?.() ?? null;
    const aTracks = audio ? audio.getAudioTracks().map((t) => t.clone()) : [];
    owned = [vTrack, ...aTracks];
    const stream = new MediaStream(owned);
    const mimeType = pickMime((t) => MediaRecorder.isTypeSupported(t));
    chunks = [];
    const r = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 20_000_000 });
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      clearInterval(tick); clearInterval(fallback); chip.hidden = true;
      for (const t of owned) t.stop();
      owned = []; vTrack = null;
      const blob = chunks.length ? new Blob(chunks, { type: r.mimeType || 'video/webm' }) : null;
      rec = null;
      if (blob) { const name = captureName(world, seed, new Date(), 'webm'); download(blob, name); say(`Saved video: ${name}`); }
      const fs = finishing; finishing = [];
      for (const f of fs) f(blob);
    };
    r.start(1000);
    rec = r;
    t0 = performance.now();
    vTrack.requestFrame(); lastRecFrame = performance.now();
    fallback = setInterval(() => { if (vTrack && needFallbackFrame(performance.now(), lastRecFrame)) { vTrack.requestFrame(); lastRecFrame = performance.now(); } }, 33);
    chip.hidden = false; chip.textContent = '● REC 0:00';
    tick = setInterval(() => { chip.textContent = `● REC ${recClock((performance.now() - t0) / 1000)}`; }, 500);
  }
  function stopRecording(): Promise<Blob | null> {
    if (!rec) return Promise.resolve(null);
    return new Promise((resolve) => { finishing.push(resolve); rec!.stop(); });
  }

  // ---- keys: P and V (not while typing, not with modifiers) ----
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.code === 'KeyP') void shootAndSave();
    else if (e.code === 'KeyV') { if (rec) void stopRecording(); else startRecording(); }
  };
  window.addEventListener('keydown', onKey);
  // Save what was recorded if the page goes away.
  window.addEventListener('pagehide', () => { if (rec) void stopRecording(); });

  return {
    screenshot, startRecording, stopRecording,
    setRun(w, s) { world = w; seed = s; },
    get recording() { return rec !== null; },
  };
}
