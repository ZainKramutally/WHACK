#!/usr/bin/env python3
"""Art-layer capture of the real app: per world, a pixel still, a smooth still and fps after the build.

Boots /?world={w}&debug&demo&style={pixel|smooth} (skips the selection screen, pinned demo seed), waits until
buildProgress reaches 1 and creatures exist, settles, then screenshots at 1920x1080 (device scale 1).

Writes design/iteration/{YYYY-MM-DD-HHMM}-app{-tag}/{world}-pixel.png, {world}-smooth.png and fps.txt.

Usage (from the repo root):
  python3 scripts/art_capture.py                      # both worlds; starts its own dev server on a free 127.0.0.1 port
  python3 scripts/art_capture.py --worlds silicon --tag sky2
  python3 scripts/art_capture.py --url http://127.0.0.1:5183 --no-fps
  python3 scripts/art_capture.py --query seed=7 --settle 4 --fps-smooth
Needs: pip install playwright ; playwright install chromium   (channel="chromium" gives real Metal/WebGPU)
fps is best / median of N x 5 s windows; trust "best" if the machine is busy (check `uptime`).
"""
import argparse, atexit, os, signal, socket, statistics, subprocess, sys, time, urllib.request
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
_server = None


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def stop_server():
    """Kill the dev server's whole process group (npx -> node vite -> esbuild). Safe to call twice."""
    global _server
    proc, _server = _server, None
    if not proc or proc.poll() is not None:
        return
    try:
        pg = os.getpgid(proc.pid)
        os.killpg(pg, signal.SIGTERM)
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(pg, signal.SIGKILL)
    except ProcessLookupError:
        pass


def _on_signal(sig, _frame):
    stop_server()
    sys.exit(128 + sig)


def start_server():
    global _server
    port = free_port()
    # New session = own process group, so stop_server() takes the children with it.
    _server = subprocess.Popen(["npx", "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"], cwd=ROOT,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    url = f"http://127.0.0.1:{port}"
    for _ in range(200):
        if _server.poll() is not None:
            break
        try:
            urllib.request.urlopen(url, timeout=1); return url
        except Exception:
            time.sleep(0.2)
    stop_server(); sys.exit("art_capture: dev server did not start")


FPS_JS = """() => new Promise(res => { let n = 0; const t0 = performance.now();
  const f = () => { n++; const dt = performance.now() - t0; if (dt >= 5000) res(n / (dt / 1000)); else requestAnimationFrame(f); };
  requestAnimationFrame(f); })"""
BUILT_JS = "() => window.app?.inputs?.buildProgress >= 1 && window.app.inputs.organisms?.length > 0"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", help="reuse a running dev server instead of starting one")
    ap.add_argument("--worlds", default="carbon,silicon")
    ap.add_argument("--tag", default="")
    ap.add_argument("--query", default="", help="extra query, e.g. seed=3 (replaces the pinned demo seed)")
    ap.add_argument("--settle", type=float, default=3.0, help="seconds after the build before the still")
    ap.add_argument("--no-fps", action="store_true")
    ap.add_argument("--fps-smooth", action="store_true", help="also measure fps in smooth mode")
    ap.add_argument("--fps-runs", type=int, default=3)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    a = ap.parse_args()

    atexit.register(stop_server)
    signal.signal(signal.SIGINT, _on_signal)
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGHUP, _on_signal)

    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    out = ROOT / "design" / "iteration" / f"{stamp}-app{('-' + a.tag) if a.tag else ''}"
    out.mkdir(parents=True, exist_ok=True)
    url = a.url or start_server()
    extra = ("&" + a.query) if a.query else ""
    demo = "" if "seed=" in a.query else "&demo"
    lines, failed = [], False
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"])

            def open_built(world, style):
                pg = b.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
                pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" and "404" not in m.text else None)
                pg.goto(f"{url}/?world={world}&debug{demo}&style={style}{extra}")
                pg.wait_for_function(BUILT_JS, timeout=120000, polling=500)
                pg.wait_for_timeout(int(a.settle * 1000))
                return pg, errs

            def fps(pg):
                runs = [pg.evaluate(FPS_JS) for _ in range(a.fps_runs)]
                best, med = max(runs), statistics.median(runs)
                warn = "  WARNING: best/median differ >15%, GPU probably shared; trust best" if best > med * 1.15 else ""
                return best, f"best {best:.1f}  median {med:.1f}  runs {[round(r, 1) for r in runs]}{warn}"

            for world in [w.strip() for w in a.worlds.split(",") if w.strip()]:
                for style in ("pixel", "smooth"):
                    pg, errs = open_built(world, style)
                    path = out / f"{world}-{style}.png"
                    pg.screenshot(path=str(path))
                    print(f"{path}" + (f"  console errors: {errs[:3]}" if errs else ""), flush=True)
                    if errs:
                        failed = True
                        lines.append(f"{world} {style} console errors: {errs[:5]}")
                    if not a.no_fps and (style == "pixel" or a.fps_smooth):
                        best, msg = fps(pg)
                        line = f"fps {world} {style} @{a.width}x{a.height}: {msg}"
                        print(line, flush=True)
                        lines.append(line)
                    pg.close()
            b.close()
    finally:
        stop_server()
    (out / "fps.txt").write_text("\n".join(lines) + "\n")
    print(f"out: {out}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
