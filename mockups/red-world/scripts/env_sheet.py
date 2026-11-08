#!/usr/bin/env python3
"""Environment sheet: hero + ~200 m fly view per named environment (?env=<name>), labelled with the soup values and
the one-line chemistry rationale -> design/iteration/{stamp}-red-env/sheet.png (+ each frame, + thumbs.png).

Usage (from mockups/red-world):
  python3 scripts/env_sheet.py [--url http://127.0.0.1:PORT] [--fps] [--tag r2] [names...]
Names default to every NAMED environment in src/env/derive.ts (read from the page).
"""
import argparse, statistics, sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(Path(__file__).resolve().parent))
from capture import start_server, ROOT, FPS_JS  # noqa: E402

FLY = ((-400, 200, -200), (1500, 0, -300))


def font(size, bold=False):
    for f in ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try: return ImageFont.truetype(f, size)
        except Exception: pass
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url"); ap.add_argument("--fps", action="store_true"); ap.add_argument("--tag", default="")
    ap.add_argument("names", nargs="*")
    a = ap.parse_args()
    out = ROOT / "design" / "iteration" / f"{datetime.now().strftime('%Y-%m-%d-%H%M')}-red-env{('-' + a.tag) if a.tag else ''}"
    out.mkdir(parents=True, exist_ok=True)
    proc, url = (None, a.url) if a.url else start_server()
    meta = {}
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, channel="chromium", args=["--enable-unsafe-webgpu"])

            def page(q, h="capture"):
                pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "404" not in m.text else None)
                pg.goto(f"{url}/?style=pixel&{q}#{h}"); pg.wait_for_function("window.__ready===true", timeout=120000)
                return pg, errs

            names = a.names
            if not names:
                pg, _ = page("env=rust")
                names = pg.evaluate("() => Object.keys(window.__env.named)")
                pg.close()
            for n in names:
                pg, errs = page(f"env={n}")
                pg.wait_for_timeout(1200); pg.screenshot(path=str(out / f"hero-{n}.png"), timeout=120000)
                meta[n] = pg.evaluate("() => ({ title: window.__env.title, soup: window.__env.soupText, why: window.__env.env.rationale, sea: window.__env.seaLevel })")
                if a.fps:
                    pg.close(); pg, _ = page(f"env={n}", "")
                    pg.wait_for_timeout(2000)
                    runs = [pg.evaluate(FPS_JS) for _ in range(3)]
                    meta[n]["fps"] = max(runs)
                    print(f"fps {n}: best {max(runs):.1f} median {statistics.median(runs):.1f}")
                pg.close()
                pg, errs2 = page(f"free&env={n}")
                pg.evaluate("""([c, t]) => { const s = window.__scene; s.camera.position.set(...c); s.controls.target.set(...t); s.controls.update(); }""", [list(FLY[0]), list(FLY[1])])
                pg.wait_for_timeout(900); pg.screenshot(path=str(out / f"fly-{n}.png"), timeout=120000); pg.close()
                print(n, "ok", ("errors: " + str((errs + errs2)[:3])) if errs or errs2 else "")
            b.close()
        W, H, L = 960, 540, 70
        sheet = Image.new("RGB", (W * 2, (H + L) * len(names)), (20, 16, 20))
        d = ImageDraw.Draw(sheet)
        f1, f2 = font(26, True), font(17)
        for i, n in enumerate(names):
            y = i * (H + L); m = meta[n]
            fps = f"   {m['fps']:.0f} fps" if "fps" in m else ""
            d.text((14, y + 8), f"{m['title']}  ?env={n}   {m['soup']}{fps}", fill=(250, 240, 235), font=f1)
            d.text((14, y + 42), m["why"], fill=(205, 195, 200), font=f2)
            sheet.paste(Image.open(out / f"hero-{n}.png").convert("RGB").resize((W, H), Image.LANCZOS), (0, y + L))
            sheet.paste(Image.open(out / f"fly-{n}.png").convert("RGB").resize((W, H), Image.LANCZOS), (W, y + L))
        sheet.save(out / "sheet.png")
        # thumbnail test: every hero at 240 px wide side by side (must be instantly distinct)
        tw, th = 240, 135
        thumbs = Image.new("RGB", (tw * len(names), th + 22), (20, 16, 20)); dt = ImageDraw.Draw(thumbs)
        for i, n in enumerate(names):
            thumbs.paste(Image.open(out / f"hero-{n}.png").convert("RGB").resize((tw, th), Image.LANCZOS), (i * tw, 22))
            dt.text((i * tw + 4, 3), n, fill=(240, 230, 230), font=font(14))
        thumbs.save(out / "thumbs.png")
        print(out / "sheet.png")
    finally:
        if proc: proc.terminate()


if __name__ == "__main__":
    main()
