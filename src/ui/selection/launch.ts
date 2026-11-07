// The Generate transition (2D stand-in for the three.js zoom, ported from the mockup): the camera pushes into Figure 2,
// its particles multiply and settle into ground at 384×216, upscaled by whole numbers. It covers the page while the real
// world builds underneath. The three.js version (render/generate.ts, ~30,000 points) is a follow-up.
import { BOX_PAL, mulberry32, seaRamp } from './box';
import type { WorldConfig } from '../../worlds/types';

const IW = 384, IH = 216;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const terrainY = (x: number) => Math.round(IH * 0.62 + Math.sin(x * 0.03 + 1) * IH * 0.07 + Math.sin(x * 0.08 + 0.4) * IH * 0.03 + Math.sin(x * 0.19 + 2) * IH * 0.012);

/** Seconds from the start of the launch until the particles have become solid ground (the character spawns about here). */
export const LAUNCH_SOLID_SEC = 5.4;

export interface Launch {
  /** Draw one frame; returns seconds since the launch began. */
  draw(now: number): number;
}

export function startLaunch(
  canvas: HTMLCanvasElement,
  boxCanvas: HTMLCanvasElement,
  rect: DOMRect,
  world: WorldConfig,
  seeds: { x: number; y: number }[],
  now: number,
): Launch {
  const ctx = canvas.getContext('2d')!;
  const low = document.createElement('canvas');
  low.width = IW; low.height = IH;
  const g = low.getContext('2d')!;
  const snap = document.createElement('canvas');
  snap.width = boxCanvas.width; snap.height = boxCanvas.height;
  snap.getContext('2d')!.drawImage(boxCanvas, 0, 0);
  const rnd = mulberry32(20261108);
  const F = seaRamp(world);
  const isSi = world.id === 'silicon';
  const lifeCol = isSi ? BOX_PAL.silicon[2] : BOX_PAL.carbon[2];
  const t0 = now;
  type P = { x: number; y: number; tx: number; ty: number; life: boolean };
  const parts: P[] = seeds.map((p) => {
    const tx = rnd() * IW;
    return { x: p.x * IW, y: p.y * IH, tx, ty: terrainY(tx) + rnd() * IH * 0.36, life: rnd() < 0.08 };
  });

  return {
    draw(t1) {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const t = (t1 - t0) / 1000;
      ctx.fillStyle = F[0]; ctx.fillRect(0, 0, W, H);
      if (t < 1.5) {
        const k = ease(t / 1.5);
        const size = Math.max(W, H) * 1.2;
        const x = rect.left + (W / 2 - size / 2 - rect.left) * k;
        const y = rect.top + (H / 2 - size / 2 - rect.top) * k;
        const s = rect.width + (size - rect.width) * k;
        ctx.drawImage(snap, Math.round(x), Math.round(y), Math.round(s), Math.round(s));
        return t;
      }
      for (let b = 0; b < 4; b++) { g.fillStyle = F[1 + b]; g.fillRect(0, Math.round((b * IH * 0.6) / 4), IW, Math.ceil((IH * 0.6) / 4) + 1); }
      g.fillStyle = F[4]; g.fillRect(0, Math.round(IH * 0.6), IW, IH);
      if (t < 5 && parts.length < 5000) {
        const n = parts.length;
        for (let i = 0; i < n && parts.length < 5000; i++) {
          const p = parts[i]; const tx = rnd() * IW;
          parts.push({ x: p.x, y: p.y, tx, ty: terrainY(tx) + rnd() * IH * 0.36, life: rnd() < 0.05 });
        }
      }
      const settle = clamp((t - 1.5) / 3.5, 0, 1);
      const solid = t > 5;
      if (solid) {
        const seaY = Math.round(IH * 0.7);
        g.fillStyle = isSi ? F[3] : F[2]; g.fillRect(0, seaY, IW, IH - seaY);
        g.fillStyle = F[4]; g.fillRect(0, seaY, IW, 1);
        for (let x = 0; x < IW; x++) {
          const ty = terrainY(x);
          g.fillStyle = isSi ? F[5] : BOX_PAL.bone[2]; g.fillRect(x, ty, 1, 2);
          g.fillStyle = isSi ? F[4] : F[1]; g.fillRect(x, ty + 2, 1, Math.max(0, seaY - ty - 2));
        }
      }
      if (!solid || t < 5.6) {
        for (const p of parts) {
          p.x += (p.tx - p.x) * (0.02 + settle * 0.06);
          p.y += (p.ty - p.y) * (0.02 + settle * 0.06);
          g.fillStyle = p.life ? lifeCol : isSi ? F[5] : BOX_PAL.bone[2];
          g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      }
      const scale = Math.max(1, Math.floor(Math.min(W / IW, H / IH)));
      const dw = IW * scale, dh = IH * scale;
      ctx.drawImage(low, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
      return t;
    },
  };
}
