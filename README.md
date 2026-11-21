[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/cover-forge/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/cover-forge/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Cover Forge

Cover Forge turns 2–4 of your own photos into GTA 6 style cover art: a
sun-drenched, neon-soaked poster rendered on a single 1024×1024 canvas, with
title and caption type, selectable templates and colour palettes, and a
one-click PNG export.

It is a fully static, dependency-free browser app. All rendering is done with
the canvas 2D API in plain ES modules — no build step, no network calls, no
external fonts or assets.

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | The app shell: controls, canvas preview, module entry point |
| `app/style.css` | Page styling for the masthead, control panel and preview |
| `app/src/main.js` | Browser entry: wires inputs, file drops, live re-render and PNG export |
| `app/src/cover.js` | Poster engine — templates, palettes, layout and canvas drawing |
| `app/src/shots.js` | Procedural demo scenes used as placeholder photos before you add your own |
| `tools/shoot.py` | Headless screenshot harness that captures the app into `screenshots/` |
| `vendor/makefun-app.ts` | make.fun app scaffolding (unused by the static app) |
| `LICENSE` | MIT licence text |

## Run it

Capture fresh screenshots (optional — needs Playwright and Pillow):

    python3 tools/shoot.py

This serves the repository root on `127.0.0.1:8100`, drives `app/index.html`
in headless Chromium at 1280×1400 and writes PNGs into `screenshots/`.

To use the app, serve the repository root and open `app/index.html` from that
server (a `file://` URL will not work because the scripts are ES modules):

    python3 -m http.server 8000

Then open <http://localhost:8000/app/index.html>, drop in 2–4 photos, set a
title and captions, pick a template and palette, and hit **Export PNG**.

## Licence

MIT — see [LICENSE](LICENSE).