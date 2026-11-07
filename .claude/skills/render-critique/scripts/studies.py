#!/usr/bin/env python3
"""Painter's diagnostic study board: the views an art director squints through.

usage: python3 -I studies.py --image still.png --out board.jpg [--ref pin.jpg]

Board panels (each labelled):
  original · greyscale value · notan 2-value · notan 3-value · squint (blur) · 96 px thumbnail (upscaled)
  saturation map · hue wheel (area-weighted palette scatter) · edge/detail density heatmap
  thirds + golden-section overlay · horizontal flip · reference (if --ref)
Also prints value-mass shares for the 3-value notan and the area-weighted hue histogram (12 bins).
"""
import argparse, colorsys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ap = argparse.ArgumentParser(); ap.add_argument("--image", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--ref"); a = ap.parse_args()
P = 360  # panel height
src = Image.open(a.image).convert("RGB")
pw = max(1, round(src.width * P / src.height)); im = src.resize((pw, P), Image.LANCZOS)
arr = np.asarray(im).astype(np.float32) / 255
L = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]

def to_img(x): return Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8)).convert("RGB")
panels = [("original", im), ("value (greyscale)", to_img(L))]
t = float(np.median(L)); panels.append((f"notan 2-value (t={t:.2f})", to_img((L > t).astype(np.float32))))
t1, t2 = 0.22, 0.55  # fixed value thresholds (dark / mid / light), so masses are comparable across images
n3 = np.where(L < t1, 0.0, np.where(L < t2, 0.5, 1.0))
panels.append(("notan 3-value (fixed .22/.55)", to_img(n3)))
panels.append(("squint (blur)", im.filter(ImageFilter.GaussianBlur(P / 40))))
th = im.resize((max(1, round(96 * pw / P)), 96), Image.BILINEAR).resize((pw, P), Image.NEAREST)
panels.append(("96 px thumbnail", th))
hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255
panels.append(("saturation", to_img(hsv[..., 1])))

# hue wheel: area-weighted scatter of quantised colours on (hue angle, saturation radius), dot size = area
q = im.quantize(colors=24, method=Image.Quantize.MEDIANCUT); pal = q.getpalette()[:72]; cnt = q.getcolors()
wheel = Image.new("RGB", (P, P), (24, 24, 28)); d = ImageDraw.Draw(wheel); c = P / 2; R = P * 0.44
for r in (0.33, 0.66, 1.0): d.ellipse([c - R * r, c - R * r, c + R * r, c + R * r], outline=(60, 60, 66))
for k in range(12):
    ang = math.radians(k * 30); d.line([c, c, c + R * math.cos(ang), c - R * math.sin(ang)], fill=(45, 45, 50))
tot = sum(n for n, _ in cnt); hist = np.zeros(12)
for n, i in cnt:
    rgb = pal[i * 3:i * 3 + 3]; h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in rgb)); share = n / tot
    hist[int(h * 12) % 12] += share * (s > 0.12)
    ang = h * 2 * math.pi; rr = R * s; x, y = c + rr * math.cos(ang), c - rr * math.sin(ang); rad = 3 + 40 * math.sqrt(share)
    d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=tuple(rgb), outline=(230, 230, 230))
panels.append(("hue wheel (size = area, radius = sat)", wheel.resize((pw, P)) if pw != P else wheel))

g = L; ed = np.abs(np.diff(g, axis=1, prepend=g[:, :1])) + np.abs(np.diff(g, axis=0, prepend=g[:1, :]))
heat = to_img(np.asarray(to_img(ed * 4).convert("L").filter(ImageFilter.GaussianBlur(P / 30))).astype(np.float32) / 255 * 3)
panels.append(("detail density (edges, blurred)", ImageOps.colorize(heat.convert("L"), (10, 10, 30), (255, 200, 60))))

ov = im.copy(); d = ImageDraw.Draw(ov)
for f, col in ((1 / 3, (255, 255, 255)), (2 / 3, (255, 255, 255)), (0.382, (255, 90, 90)), (0.618, (255, 90, 90))):
    d.line([pw * f, 0, pw * f, P], fill=col, width=1); d.line([0, P * f, pw, P * f], fill=col, width=1)
panels.append(("thirds (white) + golden (red)", ov))
panels.append(("flip test", ImageOps.mirror(im)))
if a.ref:
    r = Image.open(a.ref).convert("RGB"); panels.append(("reference", r.resize((max(1, round(r.width * P / r.height)), P), Image.LANCZOS)))

cols = 4; rows = math.ceil(len(panels) / cols); cw = max(p.width for _, p in panels)
board = Image.new("RGB", (cols * cw, rows * (P + 22)), (16, 16, 18)); bd = ImageDraw.Draw(board)
for k, (name, p) in enumerate(panels):
    x, y = (k % cols) * cw, (k // cols) * (P + 22); board.paste(p, (x + (cw - p.width) // 2, y + 22)); bd.text((x + 6, y + 5), name, fill=(220, 220, 220))
board.save(a.out, quality=88)
masses = [(n3 == v).mean() for v in (0.0, 0.5, 1.0)]
names = ["red", "orange", "yellow", "lime", "green", "teal", "cyan", "azure", "blue", "violet", "magenta", "rose"]
print("notan 3-value masses dark/mid/light:", [round(float(m), 2) for m in masses])
print("hue histogram (saturated area share):", {names[i]: round(float(hist[i]), 3) for i in range(12) if hist[i] > 0.005})
print("board ->", a.out)
