[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/cover-forge/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/cover-forge/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Cover Forge

Cover Forge turns 2–4 of your own photos into a sun-drenched, neon-soaked GTA 6
style cover: a multi-panel canvas poster with a masthead title, per-photo
captions, slanted panel strips and a halftone finish. Pick a template and a
palette, tweak the text, then export the poster as a PNG. Everything is vanilla
Canvas 2D — no frameworks, no network calls, no external fonts.

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | The app shell: photo drop zone, captions, title, template and palette pickers, export button. |
| `app/style.css` | Layout and styling for the controls and live preview. |
| `app/src/cover.js` | Cover art engine — templates, palettes, panel layout, halftone and type, all on Canvas 2D. |
| `app/src/main.js` | UI state, drag-and-drop photo loading, live redraw and PNG export. |
| `app/src/shots.js` | Procedurally painted sample photos, so the demo poster renders with no image files. |
| `app/samples/` | Two sample JPEGs (`boulevard.jpg`, `pier.jpg`). |
| `app/fonts/` | Font licence notice (`OFL-Lato.txt`). |
| `tools/shoot.py` | Playwright script: serves the repo, drives the app at 1280×1400 and writes four PNGs to `screenshots/`. |
| `screenshots/` | Generated demo screenshots (output of `tools/shoot.py`). |
| `vendor/makefun-app.ts` | Vendored make.fun library used to build the bounty dossier. |
| `main.ts`, `serve.ts` | Empty placeholders. |
| `LICENSE` | MIT licence text. |
| `.gitignore` | Ignore rules. |

## Run it

First, regenerate the demo screenshots (needs Playwright's Chromium and Pillow):

```sh
python3 tools/shoot.py
```

Then serve the repository root and open the app in a browser:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/app/index.html>. Serving the root (rather than
opening the file directly) keeps the ES modules and the drop zone behaving the
same way they do under the screenshot script. Drop in 2–4 photos, or use the
built-in demo poster, and hit **Export PNG**.

## Licence

MIT © 2026 make.fun — see [LICENSE](LICENSE).