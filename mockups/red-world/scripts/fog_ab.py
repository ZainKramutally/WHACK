#!/usr/bin/env python3
"""Fog colour A/B: hero + ~200 m fly view per ?fog preset -> design/iteration/{stamp}-red-world-fog/ (+ labelled sheet.png).

Usage (from mockups/red-world): python3 scripts/fog_ab.py [--url http://127.0.0.1:PORT] [names...]
"""
import argparse, statistics, sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(Path(__file__).resolve().parent))
from capture import start_server, ROOT, FPS_JS  # noqa: E402

NAMES = ["lilac", "current", "teal", "apricot", "ash", "sulfur"]
FLY = ((-400, 200, -200), (1500, 0, -300))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("names", nargs="*"); ap.add_argument("--fps", action="store_true")
    a = ap.parse_args()
    names = a.names or NAMES
    out = ROOT / "design" / "iteration" / f"{datetime.now().strftime('%Y-%m-%d-%H%M')}-red-world-fog"
    out.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
            for n in names:
                pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
                pg.goto(f"{url}/?style=pixel&fog={n}#capture"); pg.wait_for_function("window.__ready===true", timeout=90000)
                pg.wait_for_timeout(1200); pg.screenshot(path=str(out / f"hero-{n}.png"))
                if a.fps:
                    runs = [pg.evaluate(FPS_JS) for _ in range(2)]
                    print(f"fps {n}: best {max(runs):.1f} median {statistics.median(runs):.1f}")
                pg.close()
                pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
                pg.goto(f"{url}/?free&style=pixel&fog={n}#capture"); pg.wait_for_function("window.__ready===true", timeout=90000)
                pg.evaluate("""([c, t]) => { const s = window.__scene; s.camera.position.set(...c); s.controls.target.set(...t); s.controls.update(); }""", [list(FLY[0]), list(FLY[1])])
                pg.wait_for_timeout(900); pg.screenshot(path=str(out / f"fly-{n}.png")); pg.close()
                print(n, "ok")
            b.close()
        W, H, L = 960, 540, 44
        sheet = Image.new("RGB", (W * 2, (H + L) * len(names)), (24, 18, 20))
        d = ImageDraw.Draw(sheet)
        try: font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)
        except Exception: font = ImageFont.load_default()
        for i, n in enumerate(names):
            y = i * (H + L)
            d.text((14, y + 8), f"?fog={n}", fill=(250, 240, 235), font=font)
            sheet.paste(Image.open(out / f"hero-{n}.png").convert("RGB").resize((W, H), Image.LANCZOS), (0, y + L))
            sheet.paste(Image.open(out / f"fly-{n}.png").convert("RGB").resize((W, H), Image.LANCZOS), (W, y + L))
        sheet.save(out / "sheet.png")
        print(out / "sheet.png")
    finally:
        if proc: proc.terminate()


if __name__ == "__main__":
    main()
