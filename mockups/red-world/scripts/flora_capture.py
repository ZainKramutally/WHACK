#!/usr/bin/env python3
"""Capture the flora lab (flora.html) to design/iteration/{YYYY-MM-DD-HHMM}-red-flora/.

Writes lineup.png (true scale), grid.png (one cell per archetype), grid-sil.png (ink silhouettes),
lineup-low.png and grid-low.png (2 m eye height looking up, ?cam=low), and lineup-low-trans.png
(&trans=1: proposed translucency term for pale bands, a scene-material suggestion),
lineup-top.png and grid-top.png (?cam=top: ~200 m up, 45 degrees down).
Usage (from mockups/red-world):
  python3 scripts/flora_capture.py                 # starts its own vite on 127.0.0.1
  python3 scripts/flora_capture.py --url http://127.0.0.1:5183 --seed 7 --tag r2
Needs: pip install playwright ; playwright install chromium  (channel="chromium" gives real WebGPU on macOS)
"""
import argparse, socket, subprocess, sys, time, urllib.request
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
ROOT = PROJECT.parent.parent


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def start_server():
    port = free_port()
    proc = subprocess.Popen(["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"], cwd=PROJECT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}"
    for _ in range(150):
        try:
            urllib.request.urlopen(url + "/flora.html", timeout=1); return proc, url
        except Exception:
            time.sleep(0.2)
    proc.kill(); sys.exit("dev server did not start")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--tag", default="", help="suffix for the output folder")
    a = ap.parse_args()
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    out = ROOT / "design" / "iteration" / f"{stamp}-red-flora{('-' + a.tag) if a.tag else ''}"
    out.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
            for name, query, vp in [
                ("lineup", "view=lineup", (1920, 1080)),
                ("grid", "view=grid", (1920, 1440)),
                ("grid-sil", "view=grid&sil=1", (1920, 1440)),
                ("lineup-low", "view=lineup&cam=low", (1920, 1080)),
                ("grid-low", "view=grid&cam=low", (1920, 1440)),
                ("lineup-low-trans", "view=lineup&cam=low&trans=1", (1920, 1080)),
                ("lineup-top", "view=lineup&cam=top", (1920, 1080)),
                ("grid-top", "view=grid&cam=top", (1920, 1440)),
            ]:
                pg = b.new_page(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
                pg.goto(f"{url}/flora.html?{query}&seed={a.seed}")
                try:
                    pg.wait_for_function("window.__ready===true", timeout=60000)
                except Exception:
                    print(f"{name}: not ready; errors: {errs[:5]}"); pg.close(); continue
                pg.wait_for_timeout(300)
                pg.screenshot(path=str(out / f"{name}.png"))
                info = pg.inner_text("#info")
                print(f"{name}: {out / (name + '.png')}  [{info}]" + (f"  console: {errs[:3]}" if errs else ""))
                pg.close()
            b.close()
    finally:
        if proc: proc.kill()


if __name__ == "__main__":
    main()
