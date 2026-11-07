#!/usr/bin/env python3
"""Capture the fauna lab (fauna.html) to design/iteration/{YYYY-MM-DD-HHMM}-red-fauna/.

Writes lineup.png (all variants walking), one-{i}-{slug}.png (orbit close-up per creature, pixel), one-{i}-{slug}-smooth.png, sky-{i}-{slug}.png (floaters: looking up from the ground, ?view=sky),
strip-{i}-{slug}.png (6 frames over one gait cycle from a fixed side camera, to judge foot planting), and prints fps
for the live lineup (best / median of N x 5 s windows).
Usage (from mockups/red-world):
  python3 scripts/fauna_capture.py                    # starts its own vite on 127.0.0.1
  python3 scripts/fauna_capture.py --url http://127.0.0.1:5183 --seed 2 --tag r2 --only 0,3
Needs: pip install playwright ; playwright install chromium  (channel="chromium" gives real WebGPU on macOS)
"""
import argparse, re, socket, statistics, subprocess, sys, time, urllib.request
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
ROOT = PROJECT.parent.parent

FPS_JS = """() => new Promise(res => { let n = 0; const t0 = performance.now();
  const f = () => { n++; const dt = performance.now() - t0; if (dt >= 5000) res(n / (dt / 1000)); else requestAnimationFrame(f); };
  requestAnimationFrame(f); })"""


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def start_server():
    port = free_port()
    proc = subprocess.Popen(["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"], cwd=PROJECT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}"
    for _ in range(150):
        try:
            urllib.request.urlopen(url + "/fauna.html", timeout=1); return proc, url
        except Exception:
            time.sleep(0.2)
    proc.kill(); sys.exit("dev server did not start")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--tag", default="")
    ap.add_argument("--only", default="", help="comma list of variant indices")
    ap.add_argument("--no-fps", action="store_true")
    ap.add_argument("--fps-runs", type=int, default=3)
    a = ap.parse_args()
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    out = ROOT / "design" / "iteration" / f"{stamp}-red-fauna{('-' + a.tag) if a.tag else ''}"
    out.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])

            def shot(name, query, vp=(1920, 1080), wait=400):
                pg = b.new_page(viewport={"width": vp[0], "height": vp[1]}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                pg.goto(f"{url}/fauna.html?{query}&seed={a.seed}")
                try:
                    pg.wait_for_function("window.__ready===true", timeout=90000)
                except Exception:
                    print(f"{name}: not ready; errors: {errs[:5]}"); pg.close(); return None
                pg.wait_for_timeout(wait)
                pg.screenshot(path=str(out / f"{name}.png"))
                info = pg.evaluate("window.__info")
                print(f"{out / (name + '.png')}" + (f"  console: {errs[:3]}" if errs else ""))
                return pg, info

            r = shot("lineup", "view=lineup&t=9")
            if not r: sys.exit(1)
            pg, info = r
            pg.close()
            r = shot("lineup-smooth", "view=lineup&t=9&style=smooth")
            if r: r[0].close()
            names = [v["name"] for v in info["variants"]]
            idx = [int(i) for i in a.only.split(",")] if a.only else range(len(names))
            for i in idx:
                s = slug(names[i])
                for style, suffix in (("pixel", ""), ("smooth", "-smooth")):
                    r = shot(f"one-{i}-{s}{suffix}", f"view=one&i={i}&t=7&style={style}")
                    if r: r[0].close()
                r = shot(f"strip-{i}-{s}", f"view=strip&i={i}", vp=(1920, 800))
                if r: r[0].close()
                if info["variants"][i]["mode"] == "hover":
                    r = shot(f"sky-{i}-{s}", f"view=sky&i={i}&t=7")
                    if r: r[0].close()
            if not a.no_fps:
                pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
                pg.goto(f"{url}/fauna.html?view=lineup&seed={a.seed}")
                pg.wait_for_function("window.__ready===true", timeout=90000)
                pg.wait_for_timeout(2000)
                runs = [pg.evaluate(FPS_JS) for _ in range(a.fps_runs)]
                print(f"fps lineup pixel @1920x1080: best {max(runs):.1f}  median {statistics.median(runs):.1f}  runs {[round(x, 1) for x in runs]}")
                print("stats", pg.evaluate("window.__info.stats"))
                pg.close()
            b.close()
    finally:
        if proc: proc.kill()


if __name__ == "__main__":
    main()
