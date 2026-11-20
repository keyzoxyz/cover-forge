#!/usr/bin/env python3
"""Capture Cover Forge screenshots with headless Chromium (Playwright sync API).

Serves this repo at 127.0.0.1:8099, drives three shots through the app's
?shot= harness, and verifies every image fits the make.fun caps:
  - each file <= 256 KiB
  - long side <= 1280, short side >= 480
Shot 1 (the cover the judge sees biggest) is quality-tuned until it fits.
"""

import http.server
import os
import socketserver
import sys
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8099
SHOTS_DIR = os.path.join(ROOT, "screenshots")
MAX_BYTES = 256 * 1024

# name, url, viewport, grab ("canvas" | "page" | "export"), expected canvas size
SHOTS = [
    (
        "1-cover",
        "/app/index.html?shot=cover&photo=pier&caption=SUNSET%20HEIST&size=1080x1350",
        (1080, 1350),
        "canvas",
        (1080, 1350),
        "jpg",
    ),
    (
        "2-editor",
        "/app/index.html?shot=editor&photo=boulevard",
        (1280, 720),
        "page",
        (1080, 1080),
        "jpg",
    ),
    (
        "3-export",
        "/app/index.html?shot=export&photo=boulevard&caption=GOLD%20HEIST&size=1080x1350",
        (1080, 1350),
        "export",
        (1080, 1350),
        "jpg",
    ),
]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format, *args):  # noqa: A002 - keep the run quiet
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def wait_ready(page, timeout=20000):
    page.wait_for_function("() => window.__shotReady === true", timeout=timeout)


def canvas_size(page):
    return page.evaluate(
        "() => { const c = document.getElementById('poster'); return [c.width, c.height]; }"
    )


def capture(page, url, viewport, grab, want, raw_out):
    page.set_viewport_size({"width": viewport[0], "height": viewport[1]})
    page.goto(f"http://127.0.0.1:{PORT}{url}")
    wait_ready(page)

    got = canvas_size(page)
    if tuple(got) != tuple(want):
        raise SystemExit(f"{url}: canvas is {got}x?, wanted {want}")

    if grab == "page":
        page.screenshot(path=raw_out, full_page=False)
    elif grab == "export":
        page.wait_for_selector("#exportView:not([hidden])", timeout=10000)
        page.query_selector("#exportImg").screenshot(path=raw_out)
    else:
        page.query_selector("#poster").screenshot(path=raw_out)
    return raw_out


def shrink_to_caps(src, dst, max_side=1280, min_side=480, max_bytes=MAX_BYTES):
    """Re-encode as JPEG, downscale to the size cap, tune quality under the byte cap."""
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        long_side = max(w, h)
        if long_side > max_side:
            scale = max_side / long_side
            im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        w, h = im.size
        if min(w, h) < min_side:
            short = min(w, h)
            scale = min_side / short
            im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
            w, h = im.size
            if max(w, h) > max_side:
                raise SystemExit(f"{src}: cannot satisfy both side caps")

        best = None
        lo, hi = 25, 95
        while lo <= hi:
            mid = (lo + hi) // 2
            im.save(dst, "JPEG", quality=mid, optimize=True, progressive=True)
            size = os.path.getsize(dst)
            if size <= max_bytes:
                best = (mid, size)
                lo = mid + 1
            else:
                hi = mid - 1
        if best is not None:
            # the search leaves the last (possibly oversized) encode on disk
            im.save(dst, "JPEG", quality=best[0], optimize=True, progressive=True)
            best = (best[0], os.path.getsize(dst))
        if best is None:
            scale = 0.85
            while scale > 0.3:
                small = im.resize(
                    (max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS
                )
                small.save(dst, "JPEG", quality=82, optimize=True, progressive=True)
                if os.path.getsize(dst) <= max_bytes:
                    best = (82, os.path.getsize(dst))
                    break
                scale -= 0.05
        if best is None:
            raise SystemExit(f"{dst}: could not fit under {max_bytes} bytes")
    return best


def verify(path, max_side=1280, min_side=480, max_bytes=MAX_BYTES):
    size = os.path.getsize(path)
    if size > max_bytes:
        raise SystemExit(f"{path}: {size} bytes > {max_bytes}")
    with Image.open(path) as im:
        im.verify()  # throws on truncation/corruption
    with Image.open(path) as im:
        w, h = im.size
        fmt = im.format
    if max(w, h) > max_side or min(w, h) < min_side:
        raise SystemExit(f"{path}: {w}x{h} outside caps")
    return size, (w, h), fmt


def main():
    os.makedirs(SHOTS_DIR, exist_ok=True)
    httpd = serve()
    print(f"serving {ROOT} on 127.0.0.1:{PORT}")
    failures = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(device_scale_factor=1)
            errors = []
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on(
                "console",
                lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None,
            )
            for name, url, viewport, grab, want, ext in SHOTS:
                raw = os.path.join(SHOTS_DIR, f"{name}.tmp.png")
                out_path = os.path.join(SHOTS_DIR, f"{name}.{ext}")
                try:
                    capture(page, url, viewport, grab, want, raw)
                    quality, _ = shrink_to_caps(raw, out_path)
                    size, dims, fmt = verify(out_path)
                    print(
                        f"ok {name}: {os.path.relpath(out_path, ROOT)} "
                        f"{dims[0]}x{dims[1]} {fmt} q={quality} {size} bytes "
                        f"({size / 1024:.0f} KiB)"
                    )
                except Exception as exc:
                    failures += 1
                    print(f"FAIL {name}: {exc}", file=sys.stderr)
                finally:
                    if os.path.exists(raw):
                        os.remove(raw)
            if errors:
                for e in errors:
                    print(e, file=sys.stderr)
                failures += 1
            browser.close()
    finally:
        httpd.shutdown()
    if failures:
        raise SystemExit(f"{failures} shot(s) failed")
    print("all shots verified within caps")


if __name__ == "__main__":
    main()