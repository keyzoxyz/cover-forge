#!/usr/bin/env python3
"""Capture the cover-art screenshots for the bounty writeup.

Serves the repository root on http://127.0.0.1:8100 with http.server in a
background thread, drives app/index.html in headless Chromium at 1280x1400,
and writes four PNGs into screenshots/:

    1-default.png  demo poster, Vice Dusk template
    2-neon.png     after window.__cover.setTemplate('Neon Rain')
    3-photos.png   after loading the sample photos, captions and a title
    4-export.png   element.screenshot() crop of the poster canvas alone

Every file is kept under 256 KiB; oversized shots are quantised to a palette
of at most 256 colours (Pillow) before being re-checked. The byte size of each
final file is printed at the end.

Run from anywhere:  python3 tools/shoot.py
"""

from __future__ import annotations

import functools
import http.server
import threading
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import ViewportSize, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots"
HOST = "127.0.0.1"
PORT = 8100
VIEWPORT: ViewportSize = {"width": 1280, "height": 1400}
SIZE_LIMIT = 256 * 1024  # 256 KiB


# --------------------------------------------------------------------- server


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler without per-request logging noise."""

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass


def start_server() -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    try:
        httpd = http.server.ThreadingHTTPServer((HOST, PORT), handler)
    except OSError as exc:
        raise SystemExit(f"cannot bind {HOST}:{PORT} - is another server running? ({exc})")

    thread = threading.Thread(target=httpd.serve_forever, name="coverart-http", daemon=True)
    thread.start()

    base = f"http://{HOST}:{PORT}"
    url = f"{base}/app/index.html"
    for _ in range(100):
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return httpd, base
        except OSError:
            time.sleep(0.05)

    httpd.shutdown()
    httpd.server_close()
    raise SystemExit(f"server at {base} never became ready")


# ---------------------------------------------------------------- page helpers


def settle(page, extra_ms: int = 80) -> None:
    """Wait for two animation frames plus a short beat so canvas paint lands."""
    page.evaluate(
        """(extra) => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(
                () => setTimeout(resolve, extra)));
        })""",
        extra_ms,
    )


def wait_for_demo(page) -> None:
    """Wait until the canvas exists, fonts are ready and the demo art is drawn."""
    page.wait_for_selector("#poster", state="attached", timeout=30_000)
    page.wait_for_function(
        "() => !!window.__cover && document.fonts && document.fonts.status === 'complete'",
        timeout=30_000,
    )
    try:
        page.wait_for_function(
            "() => /Demo poster ready/.test(document.querySelector('#status')?.textContent || '')",
            timeout=20_000,
        )
    except PlaywrightTimeoutError:
        # The engine still paints from primitives if sample building failed;
        # fall back to checking that the canvas has opaque pixels.
        page.wait_for_function(
            """() => {
                const c = document.querySelector('#poster');
                if (!c || c.width < 512) return false;
                const px = c.getContext('2d').getImageData(0, 0, 1, 1).data;
                return px[3] > 0;
            }""",
            timeout=20_000,
        )
    settle(page)


# --------------------------------------------------------------- png shrinking


def shrink_png(path: Path) -> None:
    """Quantise (and, as a last resort, downscale) until the PNG is under 256 KiB."""
    if path.stat().st_size <= SIZE_LIMIT:
        return

    from PIL import Image

    with Image.open(path) as source:
        image = source.convert("RGB")

    for colors in (256, 192, 128, 96, 64, 32):
        candidate = path.with_name(f"{path.stem}.q{colors}.tmp.png")
        quantised = image.quantize(
            colors=colors,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.FLOYDSTEINBERG,
        )
        quantised.save(candidate, format="PNG", optimize=True)
        if candidate.stat().st_size <= SIZE_LIMIT:
            candidate.replace(path)
            return
        candidate.unlink()

    # Extremely noisy shots may still overflow at 32 colours; scale down gently.
    scaled = image
    while scaled.width > 320:
        scaled = scaled.resize(
            (max(1, int(scaled.width * 0.8)), max(1, int(scaled.height * 0.8))),
            Image.Resampling.LANCZOS,
        )
        candidate = path.with_name(f"{path.stem}.scaled.tmp.png")
        scaled.quantize(
            colors=256,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.FLOYDSTEINBERG,
        ).save(candidate, format="PNG", optimize=True)
        if candidate.stat().st_size <= SIZE_LIMIT:
            candidate.replace(path)
            return
        candidate.unlink()

    raise RuntimeError(f"could not shrink {path.name} below {SIZE_LIMIT} bytes")


def capture(page, name: str, element: str | None = None) -> Path:
    path = SHOTS / name
    if element:
        page.locator(element).screenshot(path=str(path))
    else:
        page.screenshot(path=str(path))
    shrink_png(path)
    return path


# ----------------------------------------------------------------------- main


def main() -> int:
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd, base = start_server()
    written: list[Path] = []

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
            page = context.new_page()

            try:
                page.goto(f"{base}/app/index.html", wait_until="load", timeout=30_000)
                wait_for_demo(page)

                # 1 - the demo poster, default Vice Dusk template.
                written.append(capture(page, "1-default.png"))

                # 2 - Neon Rain. The driver API matches by id first; the label
                # "Neon Rain" resolves through the select if the engine only
                # knows "neon-rain", so fall back explicitly and verify.
                active = page.evaluate("() => window.__cover.setTemplate('Neon Rain')")
                if active != "neon-rain":
                    active = page.evaluate("() => window.__cover.setTemplate('neon-rain')")
                settle(page)
                print(f"template after setTemplate('Neon Rain'): {active}")
                written.append(capture(page, "2-neon.png"))

                # 3 - the real sample photos loaded through the file input,
                # then a caption set and a poster title.
                page.set_input_files(
                    "#photo-input",
                    [str(ROOT / "app/samples/boulevard.jpg"), str(ROOT / "app/samples/pier.jpg")],
                )
                page.wait_for_function(
                    "() => /Loaded \\d+ photos?/.test(document.querySelector('#status')?.textContent || '')",
                    timeout=20_000,
                )
                for index, caption in enumerate(
                    ("Ocean Drive, 2 a.m.", "The pier after closing"), start=1
                ):
                    field = page.locator(f"#caption-{index}")
                    if field.is_visible():
                        field.fill(caption)
                page.fill("#poster-title", "Boulevard Nights")
                settle(page)
                written.append(capture(page, "3-photos.png"))

                # 4 - tight crop of the poster canvas itself.
                written.append(capture(page, "4-export.png", element="#poster"))
            finally:
                context.close()
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print("\nwrote screenshots:")
    for path in written:
        size = path.stat().st_size
        flag = "OK" if size <= SIZE_LIMIT else "TOO BIG"
        print(f"  {path.name}: {size:,} bytes ({size / 1024:.1f} KiB) [{flag}]")

    return 0 if all(p.stat().st_size <= SIZE_LIMIT for p in written) else 1


if __name__ == "__main__":
    raise SystemExit(main())