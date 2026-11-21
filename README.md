[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/keyzoxyz/gta6-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)

# Vice Cover Studio

Vice Cover Studio is a browser-only cover-art maker. You drop in 2–4 photos,
type a title and captions, pick a template and a palette, and it paints a
Vice City-style poster onto a 1024×1024 canvas that you can export as a PNG.

Everything happens client-side on a single `<canvas>` — no uploads, no network
requests, no build step, no dependencies. The poster engine is plain ES modules
(`app/src/cover.js`) that draws only from primitives: gradients, slanted panel
quadrants, halftone dots, scanlines, vignette and a masthead band. When no photos
are supplied it still renders a complete poster, and on first load it
synthesises two demo photos (a night boulevard and a pier at sunset) in a
throwaway canvas so the page is never empty.

Photos are read through `URL.createObjectURL`, so nothing leaves the machine;
captions and the title live in one `state` object and every change repaints
from it. Export writes the canvas out with `toBlob` under a slug of the title.

## Templates

A template decides the *layout voice* of the poster: the masthead copy, the
height of the title band, the slant of the panel dividers, the strength of the
colour wash over each photo, and the scanline opacity.

| Template | id | Character |
| --- | --- | --- |
| Vice Dusk | `vice-dusk` | Default. Warm magenta wash, gentle rightward slant, tall band with the "VICE COVER STUDIO PRESENTS" kicker. |
| Neon Rain | `neon-rain` | Heavier cyan wash and the strongest scanlines, with dividers slanted the other way for a rain-streaked look. |
| Sunset Heist | `sunset-heist` | Lightest wash, almost upright dividers, deepest title band — the calmest, most poster-like layout. |

Template choice only affects geometry and typographic furniture; colours come
from the palette, so the two axes can be mixed freely (3 × 4 = 12 looks).

## Palettes

A palette is four colours — `bg`, `ink`, `accent`, `accent2` — reused
everywhere: the page background, masthead fill, title outline and rule, caption
strips, issue badge, border and halftone dots. The accent pair is also blended
into each photo as a translucent gradient wash so the images sit inside the
poster rather than on top of it.

| Palette | id | bg / ink | accent / accent2 |
| --- | --- | --- | --- |
| Dusk Magenta | `dusk-magenta` | near-black plum / warm cream | hot pink / electric cyan |
| Neon Cyan | `neon-cyan` | deep teal-black / ice white | electric cyan / hot pink |
| Sunset Gold | `sunset-gold` | burnt umber / pale gold | orange / marigold |
| Vice Noir | `vice-noir` | charcoal / bone | signal red / cool grey |

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | Static shell: controls (photos, captions, title, template, palette, export), the `#poster` canvas and the hidden preview `<img>`. |
| `app/style.css` | Page layout and control styling; the poster itself is entirely canvas-drawn. |
| `app/src/main.js` | Browser entry point. Owns `state`, wires the DOM, loads photos, exports PNG, and exposes `window.__cover` for scripted use. |
| `app/src/cover.js` | The engine: `TEMPLATES`, `PALETTES` and `drawCover(ctx, opts)`. Pure canvas, no DOM or network access. |
| `app/src/shots.js` | `buildSamples()` — generates the two demo photos in-canvas and returns them as `Image` elements. |
| `app/samples/boulevard.jpg`, `app/samples/pier.jpg` | Real sample photos used by the screenshot script. |
| `app/fonts/OFL-Lato.txt` | Placeholder for the Lato OFL licence text. |
| `tools/shoot.py` | Headless screenshot script (Playwright + Chromium) that serves the repo, drives the page and writes `screenshots/*.png` under 256 KiB each. |
| `tools/.keep` | Keeps the `tools/` directory in git. |
| `vendor/makefun-app.ts` | Vendored make.fun browser-app library (single-file, stdlib-only, erasable TypeScript). Drop-in helper for dossier/scoring output; the app does not import it. |
| `main.ts` | Empty placeholder entry point. |
| `serve.ts` | Empty placeholder for a Node-based static server. |
| `LICENSE` | Repository licence. |

## Run it locally

The app is static ES modules, so it needs to be served over HTTP — opening the
file directly with `file://` will be blocked by module CORS rules.

```
cd /var/lib/wiseagent/bounties/coverart
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/app/index.html` in a browser. (Any static
server works; serve the repository root, not `app/`, so relative paths resolve.)

To regenerate the screenshots instead, the script does its own serving:

```
python3 tools/shoot.py
```

It binds `127.0.0.1:8100`, drives `app/index.html` in headless Chromium at
1280×1400, and writes `1-default.png`, `2-neon.png`, `3-photos.png` and
`4-export.png` into `screenshots/`. Requirements: Python 3.10+, `playwright`
with Chromium installed, and Pillow for the size-capping re-encode.

## Scripted controls

`window.__cover` is available once the page has booted:

```js
window.__cover.setTemplate('Neon Rain');  // returns the active template id
window.__cover.setPalette('sunset-gold'); // returns the active palette id
window.__cover.setTitle('Boulevard Nights');
```

Useful for screenshots and smoke tests; it takes both ids (`vice-dusk`) and
display names (`Vice Dusk`).