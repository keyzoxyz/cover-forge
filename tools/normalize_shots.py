"""Normalise the four screenshots to the gate's screenshot row.

The gate (competition.yaml, screenshots row) demands each image be:
  - at most 256 KiB
  - long side at most 1280 px and short side at least 480 px

The first render produced 1280x1400 (long 1400) and a 774x436 poster clip
(short 436), so all four failed the row and the whole entry scored 0.
This pass rescales every PNG into that window without cropping, then
re-checks the byte cap after each resize.
"""
from __future__ import annotations

import glob
import os
import sys

from PIL import Image

MAX_BYTES = 262144


def target_size(w: int, h: int) -> tuple[int, int]:
    """Scale (w, h) so the long side <= 1280 and the short side >= 480."""
    scale = min(1280.0 / max(w, h), 1e9)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    if min(nw, nh) < 480:
        up = 480.0 / min(nw, nh)
        nw, nh = int(round(nw * up)), int(round(nh * up))
    # One more clamp in case the upscale pushed the long side past 1280.
    if max(nw, nh) > 1280:
        down = 1280.0 / max(nw, nh)
        nw, nh = int(round(nw * down)), int(round(nh * down))
    return nw, nh


def fix(path: str) -> str:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    nw, nh = target_size(w, h)
    if (nw, nh) != (w, h):
        im = im.resize((nw, nh), Image.LANCZOS)
    out = im
    for _ in range(8):
        out.save(path, format="PNG", optimize=True)
        if os.path.getsize(path) <= MAX_BYTES:
            break
        # Shrink while keeping the gate's window.
        w2, h2 = out.size
        s = 0.88
        cw, ch = int(w2 * s), int(h2 * s)
        if min(cw, ch) < 480:
            break
        out = out.resize((cw, ch), Image.LANCZOS)
    got = Image.open(path)
    size = os.path.getsize(path)
    long_side, short_side = max(got.size), min(got.size)
    ok = size <= MAX_BYTES and long_side <= 1280 and short_side >= 480
    print(
        f"{os.path.basename(path):16s} {got.size[0]}x{got.size[1]} "
        f"{size:>7} bytes long={long_side} short={short_side} "
        f"{'OK' if ok else 'FAIL'}"
    )
    return "OK" if ok else "FAIL"


def main() -> int:
    paths = sorted(glob.glob("screenshots/*.png"))
    if not paths:
        print("no screenshots found", file=sys.stderr)
        return 1
    results = [fix(p) for p in paths]
    return 0 if all(r == "OK" for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())