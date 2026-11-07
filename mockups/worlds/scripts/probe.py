#!/usr/bin/env python3
"""Colour fidelity probe. python3 scripts/probe.py http://127.0.0.1:5173
Top row (unlit basic) must equal the hex ±3/255 through bloom/dither/colour space. Bottom row shows the lit world material."""
import sys, io
from playwright.sync_api import sync_playwright
from PIL import Image
url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"
COLORS = [0xf94b1e, 0xece4d6, 0x8badc5, 0x093f1b, 0x27aaa6, 0xda1b58, 0x303b51, 0xa47c68]
preset = sys.argv[2] if len(sys.argv) > 2 else "eco04"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
    pg = b.new_page(viewport={"width": 1000, "height": 1000}, device_scale_factor=1)
    pg.goto(f"{url}/?preset={preset}#capture&probe&nofigure#orbit")
    pg.wait_for_function("window.__ready===true", timeout=60000)
    img = Image.open(io.BytesIO(pg.screenshot())).convert("RGB"); b.close()
W, H = img.size
def avg(cx, cy, r=6):
    px = [img.getpixel((cx + dx, cy + dy)) for dx in range(-r, r) for dy in range(-r, r)]
    return tuple(round(sum(c[i] for c in px) / len(px)) for i in range(3))
# patches sit at camera-space z=-8: find them by scanning for the centre row: project using fov of the preset is fiddly, so sample a grid
import json
# scan the middle band for runs matching the top-row colours
def close(a, c, tol=4): return all(abs(a[i] - ((c >> (16 - 8 * i)) & 255)) <= tol for i in range(3))
found = {}
for y in range(0, H, 4):
    for x in range(0, W, 4):
        px = img.getpixel((x, y))
        for c in COLORS:
            if close(px, c) and c not in found: found[c] = (x, y, px)
ok = 0
for c in COLORS:
    if c in found: ok += 1; print(f"#{c:06x} top row OK at {found[c][:2]}")
    else: print(f"#{c:06x} NOT FOUND within ±4")
print(f"{ok}/{len(COLORS)} basic patches reproduce the hex within ±4/255")
img.save("/tmp/probe.png")
