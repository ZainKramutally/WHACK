#!/usr/bin/env python3
"""Capture 360° check views (ground + ~200 m fly) into design/iteration/{stamp}-red-world-views/ as one contact sheet.

Usage (from mockups/red-world): python3 scripts/views.py [--url http://127.0.0.1:PORT]
Uses ?free (OrbitControls) and sets camera/target through window.__scene.
"""
import argparse, sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from capture import start_server, ROOT  # noqa: E402

VIEWS = [  # name, camera xyz, target xyz (y is added to terrain-ish height by eye)
    ("south-arch2", (0, 6, 60), (300, 120, 1560)),
    ("east-forest", (80, 6, -60), (1350, 60, -250)),
    ("west-hollow", (-300, 12, 180), (-950, -5, 250)),
    ("nw-ribs", (-400, 8, -300), (-1500, 120, -1050)),
    ("fly-north", (0, 200, 600), (95, 60, -470)),
    ("fly-south", (100, 220, -900), (200, 0, 900)),
    ("fly-east", (-400, 200, -200), (1500, 0, -300)),
    ("hero-base", (60, 4, -330), (95, 80, -470)),
]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--url"); a = ap.parse_args()
    out = ROOT / "design" / "iteration" / f"{datetime.now().strftime('%Y-%m-%d-%H%M')}-red-world-views"
    out.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
            pg = b.new_page(viewport={"width": 960, "height": 540})
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"{url}/?free&style=pixel#capture")
            pg.wait_for_function("window.__ready===true", timeout=90000)
            shots = []
            for name, cam, tgt in VIEWS:
                pg.evaluate("""([c, t]) => { const s = window.__scene; s.camera.position.set(...c); s.controls.target.set(...t); s.controls.update(); }""", [list(cam), list(tgt)])
                pg.wait_for_timeout(700)
                f = out / f"{name}.png"; pg.screenshot(path=str(f)); shots.append(f)
            b.close()
            sheet = Image.new("RGB", (960 * 2, 540 * 4))
            for i, f in enumerate(shots):
                sheet.paste(Image.open(f).convert("RGB"), ((i % 2) * 960, (i // 2) * 540))
            sheet.save(out / "sheet.png")
            print(out / "sheet.png", ("errors: " + str(errs[:3])) if errs else "")
    finally:
        if proc: proc.terminate()


if __name__ == "__main__":
    main()
