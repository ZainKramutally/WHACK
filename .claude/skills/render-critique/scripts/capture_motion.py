#!/usr/bin/env python3
"""Capture a still + a short frame sequence (for motion critique) from a live WebGL/WebGPU page.

usage:
  python3 -I capture_motion.py --url "http://127.0.0.1:5173/?preset=eco12" --out design/critique/2026-11-07-eco12 \
      [--size 1280x720] [--seconds 4] [--fps 12] [--ready-js "window.__ready === true"] [--settle 1.5]

Writes: still.png, frames/f000.png..., motion.gif (half size), capture.json (timings).
Uses Playwright Chromium with channel="chromium" (real Metal WebGPU on Apple Silicon; plain headless shell has no adapter).
Only point it at localhost / 127.0.0.1 pages you started yourself.
"""
import argparse, json, pathlib, sys, time
from PIL import Image
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--size", default="1280x720")
ap.add_argument("--seconds", type=float, default=4.0)
ap.add_argument("--fps", type=float, default=12.0)
ap.add_argument("--ready-js", default="")
ap.add_argument("--settle", type=float, default=1.5)
a = ap.parse_args()

w, h = (int(v) for v in a.size.lower().split("x"))
out = pathlib.Path(a.out); (out / "frames").mkdir(parents=True, exist_ok=True)
n = max(2, int(round(a.seconds * a.fps)))

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel="chromium")
    pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(a.url, wait_until="load", timeout=60000)
    if a.ready_js:
        pg.wait_for_function(a.ready_js, timeout=60000)
    pg.wait_for_timeout(int(a.settle * 1000))
    pg.screenshot(path=str(out / "still.png"))
    # CDP screencast streams real compositor frames (~30-60 fps); screenshots manage only a few fps.
    import base64
    cdp = pg.context.new_cdp_session(pg)
    got = []
    live = {"on": True}
    def on_frame(ev):
        if not live["on"]:
            return
        got.append((time.perf_counter(), ev["data"]))
        try:
            cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception:
            pass
    cdp.on("Page.screencastFrame", on_frame)
    cdp.send("Page.startScreencast", {"format": "png", "everyNthFrame": 1, "maxWidth": w, "maxHeight": h})
    t_end = time.perf_counter() + a.seconds
    while time.perf_counter() < t_end:
        pg.wait_for_timeout(20)
    live["on"] = False
    cdp.send("Page.stopScreencast")
    pg.wait_for_timeout(100)
    b.close()
    if len(got) < 3:
        sys.exit("screencast returned too few frames; is the page animating?")
    # resample the stream to the requested fps (nearest frame in time)
    t0 = got[0][0]; ts = [g[0] - t0 for g in got]
    stamps = []
    for i in range(n):
        t = i / a.fps
        j = min(range(len(ts)), key=lambda k: abs(ts[k] - t))
        stamps.append(round(ts[j], 4))
        (out / "frames" / f"f{i:03d}.png").write_bytes(base64.b64decode(got[j][1]))
    raw_fps = round((len(got) - 1) / (ts[-1] or 1), 1)

frames = [Image.open(out / "frames" / f"f{i:03d}.png").convert("RGB") for i in range(n)]
gw = min(480, frames[0].width); small = [f.resize((gw, max(1, round(f.height * gw / f.width))), Image.NEAREST) for f in frames]
dur = int(1000 / a.fps)
small[0].save(out / "motion.gif", save_all=True, append_images=small[1:], duration=dur, loop=0)
json.dump({"url": a.url, "size": [w, h], "frames": n, "fps_target": a.fps, "stamps": stamps,
           "stream_fps": raw_fps,
           "page_errors": errors[:20]}, open(out / "capture.json", "w"), indent=1)
print(f"captured {n} frames at {a.fps} fps (stream {raw_fps} fps) -> {out}; page errors: {len(errors)}")
