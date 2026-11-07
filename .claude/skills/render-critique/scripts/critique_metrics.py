#!/usr/bin/env python3
"""Objective still + motion metrics for an art critique. Numbers support judgement; they never replace it.

usage:
  python3 -I critique_metrics.py --still OUT/still.png [--frames OUT/frames] [--ref pin.jpg] [--json OUT/metrics.json]

Still metrics (computed on a 360 px-tall working copy):
  value_L5/50/95      luminance percentiles (contrast / value structure)
  sat_mean            mean HSV saturation
  palette_k8          8-colour median-cut palette with coverage %
  field_share         coverage of the dominant hue family (one field: ~0.6-0.95 reads calm)
  accent_share        share of saturated pixels whose hue is >=60 deg from the field hue (one fire: ~0.02-0.12)
  glow_share          bright saturated pixels of any hue (neon/emissive presence); blown_white = clipped white area
  clutter             edge density (Sobel>thr) — higher = busier.  ~<0.08 calm, 0.08-0.15 busy, >0.15 messy
  speckle             % pixels with <=1 same-colour 8-neighbour after 8-colour quantise (noise / mess)
  focus_peak          where the most salient region is (thirds grid cell) + how concentrated saliency is (0..1)
  thumb_readability   value contrast of the 64 px thumbnail (silhouette read at a glance)
  depth_steps         number of distinct value bands from bottom to top of frame (layered depth)
  ref_palette_dist    mean nearest-colour distance (LAB-ish) to the reference image palette, if --ref
Motion metrics (if --frames, consecutive frames):
  motion_energy       mean |frame diff| (0..1); calm idle scenes ~0.002-0.02
  flicker             % pixels that change and change back within 2 frames (shimmer / crawling) — want <0.5%
  jitter_regions      3x3 grid of motion energy (where motion lives; should be on life/water, not on rock)
  loop_seam           diff between last and first frame vs median step (≈1 → seamless loop)
"""
import argparse, colorsys, json, pathlib
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("--still", required=True)
ap.add_argument("--frames")
ap.add_argument("--ref")
ap.add_argument("--json")
a = ap.parse_args()

def load(path, h=360):
    im = Image.open(path).convert("RGB")
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.BILINEAR)

def lum(arr):
    return (0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]) / 255.0

def palette(im, k=8):
    q = im.quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    p = q.getpalette()[: k * 3]; cnt = sorted(q.getcolors(), reverse=True); tot = sum(c for c, _ in cnt)
    return q, [("#%02x%02x%02x" % tuple(p[i * 3:i * 3 + 3]), round(c / tot, 3)) for c, i in cnt]

im = load(a.still); arr = np.asarray(im).astype(np.float32); L = lum(arr)
hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255.0
H, S, V = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
m = {}
m["value_L5/50/95"] = [round(float(np.percentile(L, q)), 3) for q in (5, 50, 95)]
m["sat_mean"] = round(float(S.mean()), 3)
q, pal = palette(im); m["palette_k8"] = pal

# field hue = circular mean of hue weighted by area of moderately saturated pixels
w = (S > 0.15).astype(np.float32) + 1e-6
ang = np.deg2rad(H); fh = np.rad2deg(np.arctan2((np.sin(ang) * w).sum(), (np.cos(ang) * w).sum())) % 360
dh = np.abs(((H - fh) + 180) % 360 - 180)
m["field_hue_deg"] = round(float(fh), 1)
m["field_share"] = round(float(((dh < 40) | (S < 0.15)).mean()), 3)
m["accent_share"] = round(float(((dh >= 60) & (S > 0.35) & (V > 0.35)).mean()), 3)
m["glow_share"] = round(float(((V > 0.8) & (S > 0.3)).mean()), 3)   # bright saturated pixels (emissive/neon), any hue
m["blown_white"] = round(float(((V > 0.97) & (S < 0.12)).mean()), 3)  # clipped near-white area

g = np.asarray(im.convert("L")).astype(np.float32) / 255.0
gx = np.abs(np.diff(g, axis=1))[:-1, :]; gy = np.abs(np.diff(g, axis=0))[:, :-1]
m["clutter"] = round(float(((gx + gy) > 0.12).mean()), 3)

qa = np.asarray(q); same = np.zeros(qa.shape, np.int32)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        if dx or dy:
            same += (np.roll(np.roll(qa, dy, 0), dx, 1) == qa)
m["speckle_pct"] = round(float((same[1:-1, 1:-1] <= 1).mean() * 100), 2)

# crude saliency: local contrast + saturation + brightness pop vs blurred surround
blur = np.asarray(im.filter(ImageFilter.GaussianBlur(18))).astype(np.float32)
sal = np.abs(arr - blur).mean(-1) / 255.0 + 0.5 * S * V
sal = sal / (sal.max() + 1e-6)
hh, ww = sal.shape; cells = [[float(sal[r*hh//3:(r+1)*hh//3, c*ww//3:(c+1)*ww//3].mean()) for c in range(3)] for r in range(3)]
flat = np.array(cells).ravel(); peak = int(flat.argmax())
m["focus_peak_cell"] = ["top", "middle", "bottom"][peak // 3] + "-" + ["left", "centre", "right"][peak % 3]
m["focus_concentration"] = round(float((flat.max() - flat.mean()) / (flat.mean() + 1e-6)), 3)

th = np.asarray(im.convert("L").resize((max(1, round(64 * im.width / im.height)), 64), Image.BILINEAR)).astype(np.float32) / 255
m["thumb_readability"] = round(float(np.percentile(th, 95) - np.percentile(th, 5)), 3)
rows = np.array([np.median(L[r * L.shape[0] // 8:(r + 1) * L.shape[0] // 8]) for r in range(8)])
m["depth_steps"] = int(len(set(np.round(rows / 0.06).astype(int).tolist())))

if a.ref:
    _, rp = palette(load(a.ref))
    def rgb(hx): return np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    d = [min(np.linalg.norm(rgb(c) - rgb(r)) for r, _ in rp) for c, _ in pal]
    m["ref_palette"] = rp; m["ref_palette_dist"] = round(float(np.average(d, weights=[s for _, s in pal])), 1)

if a.frames:
    fs = sorted(pathlib.Path(a.frames).glob("*.png"))
    F = [np.asarray(load(f, 240)).astype(np.float32) / 255 for f in fs]
    if len(F) >= 3:
        diffs = [np.abs(F[i + 1] - F[i]).mean(-1) for i in range(len(F) - 1)]
        m["motion_energy"] = round(float(np.mean([d.mean() for d in diffs])), 4)
        fl = []
        for i in range(len(F) - 2):
            ch1 = np.abs(F[i + 1] - F[i]).mean(-1) > 0.06
            back = np.abs(F[i + 2] - F[i]).mean(-1) < 0.02
            fl.append((ch1 & back).mean())
        m["flicker_pct"] = round(float(np.mean(fl) * 100), 3)
        E = np.mean(diffs, 0); hh, ww = E.shape
        m["jitter_regions_3x3"] = [[round(float(E[r*hh//3:(r+1)*hh//3, c*ww//3:(c+1)*ww//3].mean()), 4) for c in range(3)] for r in range(3)]
        med = float(np.median([d.mean() for d in diffs])) + 1e-6
        m["loop_seam_ratio"] = round(float(np.abs(F[0] - F[-1]).mean() / med), 2)

print(json.dumps(m, indent=1))
if a.json:
    pathlib.Path(a.json).write_text(json.dumps(m, indent=1))
