[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/cover-forge/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/cover-forge/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Cover Forge

Cover Forge is a browser-based cover art studio for the `gta6-cover-art-01` bounty. Drop in two to four photos, give the poster a title, pick one of three layouts and four palettes, edit the caption strips, and export a 1200x1500 PNG — sun-soaked, neon-drenched, straight out of the box.

Everything is rendered client-side with the Canvas 2D API: no build step, no framework, no network calls, no external fonts. Load `app/index.html` and it paints a demo poster from procedurally generated sample scenes before you touch a file.

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | App shell: photo dropzone, caption and title fields, template/palette pickers, export button, poster canvas. |
| `app/style.css` | Layout and styling for the control panels and poster preview. |
| `app/src/main.js` | Browser entry point. Wires the controls, drag-and-drop, caption inputs and PNG export to the renderer; paints the demo poster on load. |
| `app/src/cover.js` | Pure Canvas 2D poster engine. Draws the masthead, slanted photo panels, caption strips, studio banner, halftone, scanlines and border; defines the templates and palettes. |
| `app/src/shots.js` | Paints the demo sample photos (night boulevard, sunset pier) procedurally and returns them as image records. |
| `app/samples/boulevard.jpg` | Sample night-boulevard photo. |
| `app/samples/pier.jpg` | Sample sunset-pier photo. |
| `app/fonts/OFL-Lato.txt` | License note for the bundled Lato font. |
| `tools/shoot.py` | Playwright script: serves the repo root on 127.0.0.1:8100, drives the app through four states and writes the screenshots. |
| `screenshots/` | Generated screenshots (`1-default.png`, `2-neon.png`, `3-photos.png`, `4-export.png`). |
| `out/` | Scratch/output directory. |
| `vendor/makefun-app.ts` | Vendored make.fun app library (dossier builder and app-tree helpers). |
| `main.ts`, `serve.ts` | Empty TypeScript scaffolds kept for the Node entry-point layout. |

## Run it

Generate the screenshots with the committed Playwright script:

```sh
python3 tools/shoot.py
```

It needs `playwright` (with Chromium installed) and `Pillow`, starts its own static server, and writes the PNGs into `screenshots/`, re-encoding any shot over 256 KiB as a palette PNG.

To use the app itself, serve the repository root and open the page:

```sh
python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000/app/index.html>. Serve the repository root (not `app/`) so the relative module and asset paths resolve as they do in `tools/shoot.py`.