#!/usr/bin/env python3
"""Capture deterministic screenshots of the Cover Forge app.

Serves the repository root on 127.0.0.1:8100 (http.server in a background
thread), drives app/index.html in headless Chromium at 1280x1400 through the
window.__cover hook, and writes four PNGs to screenshots/. Every file is kept
under 256 KiB, quantising to at most 256 colours when a shot is too large.

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


class QuietHandler(SimpleHTTPRequestHandler):
    """Static file handler that keeps the console output clean."""

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass


def start_server() -> ThreadingHTTPServer:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def settle(page) -> None:
    """Wait for fonts and two animation frames so the canvas is repainted."""
    page.evaluate(
        """() => new Promise((resolve) => {
            const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(done, done);
            else done();
        })"""
    )


def quantise(path: Path) -> int:
    """Shrink an oversized PNG in place; returns the new byte size."""
    from PIL import Image

    with Image.open(path) as img:
        rgb = img.convert("RGB")
        # 256 colours or fewer, no dithering: keeps PNG compression effective.
        for colors in (256, 192, 128, 64):
            reduced = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT,
                                   dither=Image.Dither.NONE)
            reduced.save(path, format="PNG", optimize=True)
            if path.stat().st_size <= LIMIT:
                break
        else:
            # Extremely busy frames can stay large; shrink until they fit.
            scale = 0.85
            while path.stat().st_size > LIMIT and rgb.width > 320:
                w, h = max(1, int(rgb.width * scale)), max(1, int(rgb.height * scale))
                rgb = rgb.resize((w, h), Image.Resampling.LANCZOS)
                rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT,
                             dither=Image.Dither.NONE).save(path, format="PNG", optimize=True)
                scale *= 0.85
    return path.stat().st_size


def save(page, name: str, selector: str | None = None) -> None:
    path = OUT / name
    if selector is None:
        page.screenshot(path=str(path), full_page=False)
    else:
        page.locator(selector).screenshot(path=str(path))

    size = path.stat().st_size
    note = ""
    if size > LIMIT:
        before = size
        size = quantise(path)
        note = f" (quantised from {before} bytes)"
    flag = "" if size <= LIMIT else "  !! still over 256 KiB"
    print(f"{name}: {size} bytes{note}{flag}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1400})
            page.goto(f"{BASE}/app/index.html", wait_until="load")
            page.wait_for_function("() => window.__cover && window.__cover.state")
            try:
                # The demo poster paints its sample photos asynchronously.
                page.wait_for_function("() => window.__cover.state.photos.length > 0",
                                       timeout=15000)
            except Exception:
                print("warning: demo photos did not finish loading; capturing anyway")
            settle(page)

            # 1. Demo poster on the default Vice Dusk template.
            save(page, "1-default.png")

            # 2. Neon Rain template.
            page.evaluate("() => window.__cover.setTemplate('Neon Rain')")
            settle(page)
            save(page, "2-neon.png")

            # 3. Custom title and captions (state is live; redraw explicitly).
            page.evaluate(
                """() => {
                    const cover = window.__cover;
                    cover.setTitle('NEON NIGHTS');
                    ['DOWNTOWN AFTER DARK', 'CHROME AND PALM TREES',
                     'MIDNIGHT RUN', 'NO BRAKES'].forEach((text, i) => {
                        if (cover.state.captions) cover.state.captions[i] = text;
                    });
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