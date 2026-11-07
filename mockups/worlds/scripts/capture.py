#!/usr/bin/env python3
"""Render each preset at its pin aspect, save design/concept/worlds/eco-XX.png and a pin|render compare JPG.

Usage (from mockups/worlds):
  python3 scripts/capture.py                    # all four presets, starts its own dev server
  python3 scripts/capture.py eco01 eco14        # a subset
  python3 scripts/capture.py --testgeo          # add #testgeo (stand-in ground + columns)
  python3 scripts/capture.py --url http://127.0.0.1:5173   # reuse a running dev server
  python3 scripts/capture.py --no-fps           # skip the fps measurement
Needs: pip install playwright pillow ; playwright install chromium  (channel="chromium" gives real Metal/WebGPU)
"""
import argparse, os, re, subprocess, sys, time, socket, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
ROOT = PROJECT.parent.parent
OUT = ROOT / "design" / "concept" / "worlds"
H = 1000


def preset_meta():
    """(id, aspect, pin path) parsed from src/presets.ts so the script never drifts from it."""
    src = (PROJECT / "src" / "presets.ts").read_text()
    out = []
    for m in re.finditer(r"id: '(eco\d+)'.*?pin: pin\('(\d+)'\).*?aspect: ([0-9.]+)", src, re.S):
        out.append((m.group(1), float(m.group(3)), ROOT / "research/visual/pinterest-silicon/ecosystem" / f"2026-11-07-ecosystem-{m.group(2)}.jpg"))
    return out


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def start_server():
    port = free_port()
    proc = subprocess.Popen(["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"], cwd=PROJECT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            urllib.request.urlopen(url, timeout=1); return proc, url
        except Exception:
            time.sleep(0.2)
    proc.kill(); sys.exit("dev server did not start")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("presets", nargs="*")
    ap.add_argument("--url")
    ap.add_argument("--testgeo", action="store_true")
    ap.add_argument("--no-fps", action="store_true")
    ap.add_argument("--fps-size", default="1920x1080", help="fps viewport, e.g. 2560x1440")
    ap.add_argument("--fps-q", default="", help="e.g. low to add ?q=low")
    ap.add_argument("--extra", default="", help="extra hash flags, e.g. nofigure")
    a = ap.parse_args()
    metas = [m for m in preset_meta() if not a.presets or m[0] in a.presets]
    OUT.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    flags = ["capture"] + (["testgeo"] if a.testgeo else []) + ([a.extra] if a.extra else [])
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
            for pid, aspect, pin in metas:
                w = round(H * aspect)
                pg = b.new_page(viewport={"width": w, "height": H}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
                pg.goto(f"{url}/?preset={pid}#{'&'.join(flags)}")
                pg.wait_for_function("window.__ready===true", timeout=60000)
                png = OUT / f"{pid.replace('eco', 'eco-')}.png"
                pg.screenshot(path=str(png))
                pg.close()
                r = Image.open(png).convert("RGB"); pn = Image.open(pin).convert("RGB")
                pn = pn.resize((round(pn.width * H / pn.height), H), Image.LANCZOS)
                cmp = Image.new("RGB", (pn.width + r.width, H), (20, 20, 20))
                cmp.paste(pn, (0, 0)); cmp.paste(r, (pn.width, 0))
                cmp.save(OUT / f"{pid.replace('eco', 'eco-')}-compare.jpg", quality=88)
                print(f"{pid}: {png}  ({r.width}x{r.height})" + (f"  console errors: {errs[:3]}" if errs else ""))
            if not a.no_fps:
                for pid, _, _ in metas[:4]:
                    fw, fh = (int(v) for v in a.fps_size.split("x"))
                    pg = b.new_page(viewport={"width": fw, "height": fh}, device_scale_factor=1)
                    pg.goto(f"{url}/?preset={pid}{'&q=' + a.fps_q if a.fps_q else ''}#orbit" + ("&testgeo" if a.testgeo else ""))
                    pg.wait_for_function("window.__ready===true", timeout=60000)
                    pg.wait_for_timeout(1500)
                    fps = pg.evaluate("""() => new Promise(res => { let n = 0; const t0 = performance.now();
                        const f = () => { n++; if (performance.now() - t0 >= 3000) res(n / ((performance.now() - t0) / 1000)); else requestAnimationFrame(f); };
                        requestAnimationFrame(f); })""")
                    print(f"fps {pid} @{a.fps_size}{' q=' + a.fps_q if a.fps_q else ' q=high'}: {fps:.1f}")
                    pg.close()
            b.close()
    finally:
        if proc: proc.terminate()


if __name__ == "__main__":
    main()
