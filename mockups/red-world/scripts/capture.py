#!/usr/bin/env python3
"""Capture the Red World hero frame.

Writes design/iteration/{YYYY-MM-DD-HHMM}-red-world/hero.png (pixel, 1920x1080) and hero-smooth.png, then prints fps
(best / median of N x 5 s windows after a 2 s warm-up) for pixel mode (and smooth with --fps-smooth).

Usage (from mockups/red-world):
  python3 scripts/capture.py                # starts its own dev server on a free 127.0.0.1 port
  python3 scripts/capture.py --url http://127.0.0.1:5183
  python3 scripts/capture.py --no-fps --tag r2   # folder suffix, e.g. ...-red-world-r2
Needs: pip install playwright ; playwright install chromium  (channel="chromium" gives real Metal/WebGPU)
"""
import argparse, socket, statistics, subprocess, sys, time, urllib.request
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
            urllib.request.urlopen(url, timeout=1); return proc, url
        except Exception:
            time.sleep(0.2)
    proc.kill(); sys.exit("dev server did not start")


FPS_JS = """() => new Promise(res => { let n = 0; const t0 = performance.now();
  const f = () => { n++; const dt = performance.now() - t0; if (dt >= 5000) res(n / (dt / 1000)); else requestAnimationFrame(f); };
  requestAnimationFrame(f); })"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--no-fps", action="store_true")
    ap.add_argument("--fps-smooth", action="store_true")
    ap.add_argument("--fps-runs", type=int, default=3)
    ap.add_argument("--tag", default="")
    ap.add_argument("--query", default="", help="extra query, e.g. seed=3")
    a = ap.parse_args()
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    out = ROOT / "design" / "iteration" / f"{stamp}-red-world{('-' + a.tag) if a.tag else ''}"
    out.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    extra = ("&" + a.query) if a.query else ""
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])

            def open_page(q, hash_):
                pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
                pg.goto(f"{url}/?{q}{extra}#{hash_}")
                pg.wait_for_function("window.__ready===true", timeout=90000)
                return pg, errs

            for name, q in (("hero.png", "style=pixel"), ("hero-smooth.png", "style=smooth")):
                pg, errs = open_page(q, "capture")
                pg.wait_for_timeout(1500)
                pg.screenshot(path=str(out / name))
                pg.close()
                print(f"{out / name}" + (f"  console errors: {errs[:3]}" if errs else ""))

            if not a.no_fps:
                for style in (["pixel", "smooth"] if a.fps_smooth else ["pixel"]):
                    pg, _ = open_page(f"style={style}", "")
                    pg.wait_for_timeout(2000)
                    runs = [pg.evaluate(FPS_JS) for _ in range(a.fps_runs)]
                    best, med = max(runs), statistics.median(runs)
                    warn = "  WARNING: best/median differ >15%, GPU probably shared; trust best" if best > med * 1.15 else ""
                    print(f"fps {style} @1920x1080: best {best:.1f}  median {med:.1f}  runs {[round(r, 1) for r in runs]}{warn}")
                    pg.close()
            b.close()
    finally:
        if proc: proc.terminate()


if __name__ == "__main__":
    main()
