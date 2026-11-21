#!/usr/bin/env python3
"""Capture Cover Forge screenshots with Playwright.

Serves the repository root at http://127.0.0.1:8100, drives app/index.html
through four states and writes PNGs into screenshots/.  Any shot over
256 KiB is re-encoded as a palette PNG with at most 256 colours.

Run from anywhere:  python3 tools/shoot.py
"""

from __future__ import annotations

import functools
import http.server
import socket
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS = ROOT / "screenshots"
HOST = "127.0.0.1"
PORT = 8100
LIMIT = 256 * 1024


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Static file handler that keeps the terminal clean."""

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass


def start_server() -> http.server.ThreadingHTTPServer:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer((HOST, PORT), handler)
    httpd.daemon_threads = True

    # Fail loudly instead of silently screenshotting whatever else is on 8100.
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        probe.settimeout(0.5)
        if probe.connect_ex((HOST, PORT)) != 0:
            raise RuntimeError("could not bind %s:%s" % (HOST, PORT))
    finally:
        probe.close()

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def settle(page) -> None:
    """Let pending rAF callbacks paint after a state change."""
    page.evaluate(
        "() => new Promise((resolve) => "
        "requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))"
    )


def shrink_to_limit(path: Path, limit: int = LIMIT) -> None:
    """Re-encode as a ≤256-colour PNG until the file fits under ``limit``."""
    if path.stat().st_size <= limit:
        return

    image = Image.open(path).convert("RGB")
    for colors in (256, 192, 128, 96, 64, 48, 32):
        candidate = image.quantize(colors=colors, method=Image.Quantize.MEDIANCUT,
                                   dither=Image.Dither.NONE)
        candidate.save(path, format="PNG", optimize=True)
        if path.stat().st_size <= limit:
            return

    # Extreme fallback: same palette, reduced pixel dimensions.
    scale = 0.9
    while path.stat().st_size > limit and scale > 0.25:
        resized = image.resize(
            (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
        resized.quantize(colors=32, method=Image.Quantize.MEDIANCUT,
                         dither=Image.Dither.NONE).save(path, format="PNG", optimize=True)
        scale -= 0.1

    if path.stat().st_size > limit:
        raise RuntimeError("%s is still over %d bytes" % (path.name, limit))


def report(path: Path) -> None:
    size = path.stat().st_size
    print("%-14s %8d bytes  (%6.1f KiB)" % (path.name, size, size / 1024))


def capture(page, filename: str) -> Path:
    target = SCREENSHOTS / filename
    if filename == "4-export.png":
        canvas = page.locator("#poster")
        # Capture the poster at its native 1200x1500 resolution rather than
        # the CSS-scaled preview size.
        canvas.evaluate(
            "(el) => { el.style.width = el.width + 'px'; el.style.height = el.height + 'px'; }"
        )
        settle(page)
        canvas.screenshot(path=str(target), type="png")
    else:
        page.screenshot(path=str(target), type="png", full_page=False, animations="disabled")
    shrink_to_limit(target)
    return target


def main() -> None:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    httpd = start_server()

    results: list[Path] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(
                viewport={"width": 1280, "height": 1400}, device_scale_factor=1
            )

            page.goto("http://%s:%d/app/index.html" % (HOST, PORT), wait_until="load")
            page.wait_for_function("() => !!window.__cover", timeout=15_000)
            # The demo scenes are built asynchronously; wait for them, but do
            # not fail if the fallback placeholder poster is all we get.
            try:
                page.wait_for_function("() => window.__cover.photos.length > 0", timeout=10_000)
            except Exception:
                pass
            page.evaluate("() => document.fonts.ready.then(() => true)")
            settle(page)

            # 1 — demo poster, default Vice Dusk template.
            results.append(capture(page, "1-default.png"))

            # 2 — Neon Rain template.
            page.evaluate("() => window.__cover.setTemplate('Neon Rain')")
            settle(page)
            results.append(capture(page, "2-neon.png"))

            # 3 — custom title and captions.
            page.evaluate(
                """() => {
                    window.__cover.setTitle('Midnight Run');
                    const captions = ['After hours', 'Neon skyline', 'No brakes', 'Last exit'];
                    captions.forEach((text, i) => {
                        const input = document.getElementById('caption-' + i);
                        if (!input) return;
                        input.value = text;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                }"""
            )
            settle(page)
            results.append(capture(page, "3-photos.png"))

            # 4 — poster canvas only.
            results.append(capture(page, "4-export.png"))

            browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    for path in results:
        report(path)


if __name__ == "__main__":
    main()