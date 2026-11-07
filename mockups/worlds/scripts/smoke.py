#!/usr/bin/env python3
"""Run with a dev server up: python3 scripts/smoke.py http://127.0.0.1:5173
Measures: (a) instanced boxes cast shadows, (b) positionNode sway moves the shadow too."""
import sys, io
from playwright.sync_api import sync_playwright
from PIL import Image

url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"

def shot(pg, qs):
    pg.goto(f"{url}/smoke.html?{qs}")
    pg.wait_for_function("window.__ready===true", timeout=30000)
    return Image.open(io.BytesIO(pg.screenshot())).convert("RGB")

def dark_ground_pixels(img):
    # ground is ~light grey; shadow is darker grey (not blue boxes). Return (count, mean x)
    px = img.load(); xs = []
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            if abs(r - g) < 12 and abs(g - b) < 12 and r < 150 and r > 5: xs.append(x)
    return len(xs), (sum(xs) / len(xs) if xs else None)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
    pg = b.new_page(viewport={"width": 400, "height": 400}, device_scale_factor=1)
    base = dark_ground_pixels(shot(pg, "sway=0"))
    s0 = dark_ground_pixels(shot(pg, "sway=1&t=0"))
    s3 = dark_ground_pixels(shot(pg, "sway=1&t=3"))
    print("(a) instanced shadow  : dark ground px =", base[0], "mean x =", base[1], "->", "CASTS" if base[0] > 200 else "NO SHADOW")
    print("(b) sway t=0 / t=3     : mean x", s0[1], "/", s3[1], "->", "SHADOW FOLLOWS positionNode" if s0[1] and s3[1] and abs(s3[1] - s0[1]) > 8 else "shadow ignores positionNode")
    shot(pg, "sway=1&t=3").save("/tmp/smoke_sway3.png")
    b.close()
