#!/usr/bin/env python3
"""Render each preset at its pin aspect, save design/concept/worlds/eco-XX.png and a pin|render compare JPG.

Usage (from mockups/worlds):
  python3 scripts/capture.py                    # all four presets, starts its own dev server
  python3 scripts/capture.py eco01 eco14        # a subset
  python3 scripts/capture.py --testgeo          # add #testgeo (stand-in ground + columns)
  python3 scripts/capture.py --url http://127.0.0.1:5173   # reuse a running dev server
  python3 scripts/capture.py --only eco14      # one preset (same as positional)
  python3 scripts/capture.py --no-fps           # skip the fps measurement
  python3 scripts/capture.py --pixel            # pixel mode (?style=pixel) -> design/concept/worlds-pixel/eco-XX.png + pin | v1 | pixel sheets; fps for both
  python3 scripts/capture.py --pixel --ph 270   # internal pixel height (160-360, default 216)
  python3 scripts/capture.py --fps-runs 3       # fps: N x 5 s windows after 2 s warm-up; prints best + median
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
OUT_PIXEL = ROOT / "design" / "concept" / "worlds-pixel"
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
    ap.add_argument("--only", action="append", default=[], help="capture just this preset (repeatable), e.g. --only eco14")
    ap.add_argument("--fps-runs", type=int, default=3, help="5 s fps windows per preset after a 2 s warm-up")
    ap.add_argument("--fps-size", default="1920x1080", help="fps viewport, e.g. 2560x1440")
    ap.add_argument("--fps-q", default="", help="e.g. low to add ?q=low")
    ap.add_argument("--pixel", action="store_true", help="render pixel mode (?style=pixel) into worlds-pixel/ with pin | v1 | pixel sheets")
    ap.add_argument("--ph", type=int, default=216, help="pixel mode internal height in px")
    ap.add_argument("--extra", default="", help="extra hash flags, e.g. nofigure")
    a = ap.parse_args()
    wanted = a.presets + a.only
    metas = [m for m in preset_meta() if not wanted or m[0] in wanted]
    out_dir = OUT_PIXEL if a.pixel else OUT
    out_dir.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    flags = ["capture"] + (["testgeo"] if a.testgeo else []) + ([a.extra] if a.extra else [])
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])
            def shot(pid, w, h, style):
                pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
                q = f"preset={pid}" + (f"&style=pixel&ph={a.ph}" if style == "pixel" else "")
                pg.goto(f"{url}/?{q}#{'&'.join(flags)}")
                pg.wait_for_function("window.__ready===true", timeout=60000)
                tmp = out_dir / f"_{pid}-{style}.png"
                if style == "pixel":
                    pg.locator("canvas").screenshot(path=str(tmp))
                else:
                    pg.screenshot(path=str(tmp))
                pg.close()
                return tmp, errs

            for pid, aspect, pin in metas:
                name = pid.replace('eco', 'eco-')
                w = round(H * aspect)
                if a.pixel:
                    # viewport height = integer multiple of the internal height
                    ih = a.ph if aspect >= 1 else round(a.ph * 16 / 9)  # internal height (portrait pins swap axes)
                    vh = ih * max(1, round(1000 / ih))  # integer upscale close to the 1000 px sheet height
                    ptmp, errs = shot(pid, round(vh * aspect) + 4, vh, "pixel")
                    png = out_dir / f"{name}.png"
                    ptmp.replace(png)
                    vtmp, _ = shot(pid, w, H, "v1")
                    r1 = Image.open(vtmp).convert("RGB"); vtmp.unlink()
                    r = Image.open(png).convert("RGB")
                    r2 = r.resize((round(r.width * H / r.height), H), Image.NEAREST)
                    pn = Image.open(pin).convert("RGB"); pn = pn.resize((round(pn.width * H / pn.height), H), Image.LANCZOS)
                    cmp = Image.new("RGB", (pn.width + r1.width + r2.width, H), (20, 20, 20))
                    cmp.paste(pn, (0, 0)); cmp.paste(r1, (pn.width, 0)); cmp.paste(r2, (pn.width + r1.width, 0))
                    cmp.save(out_dir / f"{name}-compare.jpg", quality=88)
                    print(f"{pid}: {png}  ({r.width}x{r.height})" + (f"  console errors: {errs[:3]}" if errs else ""))
                    continue
                tmp, errs = shot(pid, w, H, "v1")
                png = out_dir / f"{name}.png"
                tmp.replace(png)
                r = Image.open(png).convert("RGB"); pn = Image.open(pin).convert("RGB")
                pn = pn.resize((round(pn.width * H / pn.height), H), Image.LANCZOS)
                cmp = Image.new("RGB", (pn.width + r.width, H), (20, 20, 20))
                cmp.paste(pn, (0, 0)); cmp.paste(r, (pn.width, 0))
                cmp.save(out_dir / f"{name}-compare.jpg", quality=88)
                print(f"{pid}: {png}  ({r.width}x{r.height})" + (f"  console errors: {errs[:3]}" if errs else ""))
            if not a.no_fps:
                import statistics
                fw, fh = (int(v) for v in a.fps_size.split("x"))
                tag = f"@{a.fps_size} q={a.fps_q or 'high'}"
                for pid, _, _ in metas:
                  for style in (["v1", "pixel"] if a.pixel else ["v1"]):
                    pg = b.new_page(viewport={"width": fw, "height": fh}, device_scale_factor=1)
                    pg.goto(f"{url}/?preset={pid}{'&q=' + a.fps_q if a.fps_q else ''}{'&style=pixel&ph=' + str(a.ph) if style == 'pixel' else ''}#orbit" + ("&testgeo" if a.testgeo else ""))
                    pg.wait_for_function("window.__ready===true", timeout=60000)
                    pg.wait_for_timeout(2000)  # warm-up
                    runs = [pg.evaluate("""() => new Promise(res => { let n = 0; const t0 = performance.now();
                        const f = () => { n++; const dt = performance.now() - t0; if (dt >= 5000) res(n / (dt / 1000)); else requestAnimationFrame(f); };
                        requestAnimationFrame(f); })""") for _ in range(a.fps_runs)]
                    best, med = max(runs), statistics.median(runs)
                    warn = "  WARNING: best/median differ >15%, GPU is probably shared; trust best" if best > med * 1.15 else ""
                    print(f"fps {pid} {style} {tag}: best {best:.1f}  median {med:.1f}  runs {[round(r, 1) for r in runs]}{warn}")
                    pg.close()
            b.close()
    finally:
        if proc: proc.terminate()


if __name__ == "__main__":
    main()
