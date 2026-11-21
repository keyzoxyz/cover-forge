#!/usr/bin/env python3
"""Capture deterministic screenshots of the Cover Forge app.

Serves the repo root on 127.0.0.1:8100, drives app/index.html in headless
Chromium at 1280x1400 via the window.__cover test hook, and writes four
PNGs to screenshots/, each kept under 256 KiB (quantised to <=256 colours
when needed).

Usage:  python tools/shoot.py
"""

from __future__ import annotations

import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots"
HOST, PORT = "127.0.0.1", 8100
BASE = f"http://{HOST}:{PORT}"
LIMIT = 256 * 1024
COLORS = 256


class QuietHandler(SimpleHTTPRequestHandler):
    """Static handler that keeps the test output clean."""

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass


def start_server() -> tuple[ThreadingHTTPServer, threading.Thread]:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def settle(page) -> None:
    """Wait for fonts and two animation frames so the canvas is repainted."""
    page.evaluate(
        """() => new Promise((resolve) => {
            const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(done, done);
            else done();
        })"""
    )


def quantise(path: Path) -> None:
    """Shrink an oversized PNG to a 256-colour palette, in place."""
    from PIL import Image

    with Image.open(path) as img:
        rgb = img.convert("RGB")
        reduced = rgb.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        reduced.save(path, format="PNG", optimize=True)


def save(page, name: str, selector: str | None = None) -> None:
    path = OUT / name
    if selector is None:
        page.screenshot(path=str(path), full_page=False)
    else:
        page.locator(selector).screenshot(path=str(path))

    size = path.stat().st_size
    if size > LIMIT:
        before = size
        quantise(path)
        size = path.stat().st_size
        note = f" (quantised from {before} bytes)"
    else:
        note = ""

    flag = "" if size <= LIMIT else "  !! still over 256 KiB"
    print(f"{name}: {size} bytes{note}{flag}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    server, _thread = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1400})
            page.goto(f"{BASE}/app/index.html", wait_until="load")
            page.wait_for_function("() => window.__cover && window.__cover.state")
            settle(page)

            # 1. Demo poster, default Vice Dusk template.
            if page.evaluate("() => window.__cover.state.template") != "vice-dusk":
                page.evaluate("() => window.__cover.setTemplate('vice-dusk')")
            settle(page)
            save(page, "1-default.png")

            # 2. Neon Rain template.
            page.evaluate("() => window.__cover.setTemplate('Neon Rain')")
            settle(page)
            save(page, "2-neon.png")

            # 3. Custom title and captions (state is live; redraw explicitly).
            page.evaluate(
                """() => {
                    const cover = window.__cover;
                    cover.setTitle('NEON RAIN');
                    cover.state.captions[0] = 'Downtown after dark';
                    cover.state.captions[1] = 'Chrome and palm trees';
                    cover.state.captions[2] = 'Midnight run';
                    cover.state.captions[3] = 'No brakes';
                    cover.redraw();
                }"""
            )
            settle(page)
            save(page, "3-photos.png")

            # 4. The poster canvas on its own.
            save(page, "4-export.png", selector="#poster")

            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()