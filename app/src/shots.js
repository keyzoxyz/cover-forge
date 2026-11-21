// shots.js — procedurally painted sample photos for the cover art maker.
// Canvas2D only: no network, no image files, so the demo poster works from file://.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const line = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

function glow(ctx, x, y, r, inner) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function paintNightCity(ctx, w, h) {
  const rand = rng(0x5eed);
  const hz = h * 0.62; // horizon / far end of the boulevard

  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#070b1c');
  sky.addColorStop(0.55, '#141636');
  sky.addColorStop(1, '#3a2a4d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, hz);

  glow(ctx, w * 0.78, h * 0.16, w * 0.15, 'rgba(255,246,214,0.8)');
  ctx.fillStyle = '#fff8dc';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.16, w * 0.026, 0, Math.PI * 2);
  ctx.fill();

  // Two depth layers of towers; only the near layer gets lit windows.
  for (let layer = 0; layer < 2; layer++) {
    const far = !layer;
    let x = -w * 0.04;
    while (x < w) {
      const bw = w * (0.05 + rand() * 0.09);
      const bh = h * (far ? 0.06 + rand() * 0.18 : 0.12 + rand() * 0.3);
      const top = hz - layer * h * 0.02 - bh;
      ctx.fillStyle = far ? '#151734' : '#080a18';
      ctx.fillRect(x, top, bw, bh);
      if (!far) {
        const cols = Math.max(2, Math.round(bw / 16));
        const rows = Math.max(3, Math.round(bh / 20));
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if (rand() > 0.45) continue;
            ctx.fillStyle = `rgba(255,${200 + rand() * 40},${110 + rand() * 60},${0.4 + rand() * 0.55})`;
            ctx.fillRect(x + (i + 0.25) * (bw / cols), top + (j + 0.25) * (bh / rows), (bw / cols) * 0.5, (bh / rows) * 0.45);
          }
        }
      }
      x += bw + w * (0.005 + rand() * 0.012);
    }
  }

  // Asphalt converging to the horizon.
  const road = ctx.createLinearGradient(0, hz, 0, h);
  road.addColorStop(0, '#1b1a26');
  road.addColorStop(1, '#05050b');
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, hz);
  ctx.lineTo(w * 0.72, hz);
  ctx.lineTo(w * 1.12, h);
  ctx.lineTo(-w * 0.12, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = Math.max(1, w * 0.002);
  for (let i = 1; i < 5; i++) {
    const t = i / 4;
    const y = hz + (h - hz) * t * t;
    line(ctx, w * (0.28 + 0.12 * t), y, w * (0.72 - 0.12 * t), y);
  }

  // Lane dashes widen toward the viewer to sell the perspective.
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const dw = w * (0.004 + t * 0.012);
    ctx.fillStyle = 'rgba(255,236,170,0.5)';
    ctx.fillRect(w * 0.5 - dw / 2, hz + (h - hz) * t * t, dw, h * (0.008 + t * 0.03));
  }

  // Street lamps alternating down both kerbs, each with a warm pool of light.
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const y = hz + (h - hz) * t * t;
    const x = w * 0.5 + (i % 2 ? 1 : -1) * w * (0.2 + 0.36 * t);
    const ph = h * (0.1 + 0.3 * t);
    ctx.strokeStyle = 'rgba(12,12,20,0.95)';
    ctx.lineWidth = Math.max(1, w * (0.002 + 0.005 * t));
    line(ctx, x, y, x, y - ph);
    glow(ctx, x, y - ph, w * (0.03 + 0.07 * t), 'rgba(255,196,110,0.6)');
    ctx.fillStyle = '#ffd79a';
    ctx.beginPath();
    ctx.arc(x, y - ph, w * (0.004 + 0.008 * t), 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail lights heading away, headlights approaching.
  for (let i = 0; i < 10; i++) {
    const t = rand();
    const away = rand() > 0.5;
    const x = w * (0.5 + (rand() - 0.5) * 0.2 * (0.3 + t)) + (away ? -1 : 1) * w * 0.06 * t;
    glow(ctx, x, hz + (h - hz) * t * t, w * (0.006 + 0.03 * t), away ? 'rgba(255,70,60,0.5)' : 'rgba(255,248,220,0.55)');
  }

  // Sky glow bleeding onto the wet asphalt.
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#3a2a4d' : '#141636';
    ctx.fillRect(0, hz + i * h * 0.015, w, h * 0.02);
  }
  ctx.globalAlpha = 1;
}

function paintPierSunset(ctx, w, h) {
  const rand = rng(0xc0ffee);
  const hz = h * 0.58;
  const sx = w * 0.62;
  const sy = hz - h * 0.05;

  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#241a4a');
  sky.addColorStop(0.42, '#8c3a5c');
  sky.addColorStop(0.75, '#e2683f');
  sky.addColorStop(1, '#f9b35c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, hz);

  glow(ctx, sx, sy, w * 0.32, 'rgba(255,214,140,0.5)');
  ctx.fillStyle = '#ffe3a3';
  ctx.beginPath();
  ctx.arc(sx, sy, w * 0.042, 0, Math.PI * 2);
  ctx.fill();

  // Backlit cloud streaks.
  for (let i = 0; i < 6; i++) {
    const y = hz * (0.18 + rand() * 0.62);
    const ch = h * (0.014 + rand() * 0.02);
    const g = ctx.createLinearGradient(0, y, 0, y + ch);
    g.addColorStop(0, 'rgba(255,190,150,0)');
    g.addColorStop(0.5, `rgba(255,170,150,${0.07 + rand() * 0.12})`);
    g.addColorStop(1, 'rgba(255,190,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, ch);
  }

  const sea = ctx.createLinearGradient(0, hz, 0, h);
  sea.addColorStop(0, '#c96a48');
  sea.addColorStop(0.25, '#7d3f53');
  sea.addColorStop(1, '#1c1630');
  ctx.fillStyle = sea;
  ctx.fillRect(0, hz, w, h - hz);

  // Sun glitter: a widening column of broken strokes.
  for (let i = 0; i < 80; i++) {
    const t = rand();
    const len = w * (0.006 + 0.05 * t) * (0.4 + rand());
    ctx.fillStyle = `rgba(255,${190 + rand() * 50},${130 + rand() * 60},${(1 - t) * 0.45 * rand() + 0.05})`;
    ctx.fillRect(sx + (rand() - 0.5) * w * (0.03 + 0.26 * t) - len / 2, hz + (h - hz) * t * t, len, Math.max(1, h * 0.002 * (0.5 + 2 * t)));
  }

  // Pier deck sweeping in from the lower left.
  const deckY = hz + h * 0.045;
  const dg = ctx.createLinearGradient(0, deckY, 0, h);
  dg.addColorStop(0, '#3a2418');
  dg.addColorStop(1, '#120b0a');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, h * 1.05);
  ctx.lineTo(w * 0.16, deckY);
  ctx.lineTo(w * 0.66, deckY);
  ctx.lineTo(w * 0.92, h * 1.05);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,200,150,0.1)';
  ctx.lineWidth = Math.max(1, w * 0.0015);
  for (let i = 1; i < 14; i++) {
    const t = Math.pow(i / 14, 1.8);
    const y = deckY + (h * 1.05 - deckY) * t;
    line(ctx, -w * 0.05 + w * 0.21 * t, y, w * 0.92 - w * 0.26 * t, y);
  }

  // Posts, each trailed by a wavy reflection in the water.
  for (const px of [0.2, 0.32, 0.44, 0.56, 0.68]) {
    const t = (px - 0.16) / 0.5;
    const x = w * px;
    const top = deckY - h * (0.02 + 0.1 * (1 - t));
    const base = deckY + h * 0.02 + h * 0.06 * t;
    ctx.fillStyle = '#150d0b';
    ctx.fillRect(x - w * 0.006, top, w * 0.012, base - top);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(20,10,14,${0.4 - k * 0.05})`;
      ctx.fillRect(x - w * 0.006 + Math.sin(k * 1.7 + px * 9) * w * 0.006, base + h * 0.02 * k, w * 0.012, h * 0.02);
    }
  }

  ctx.strokeStyle = 'rgba(18,10,10,0.85)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  line(ctx, w * 0.16, deckY - h * 0.12, w * 0.66, deckY - h * 0.09);
  line(ctx, w * 0.16, deckY - h * 0.07, w * 0.66, deckY - h * 0.055);

  // A lone figure at the rail, for scale and story.
  const fx = w * 0.47;
  const fy = deckY - h * 0.035;
  const fh = h * 0.075;
  ctx.fillStyle = '#0d0709';
  ctx.fillRect(fx - w * 0.008, fy - fh, w * 0.016, fh);
  ctx.beginPath();
  ctx.arc(fx, fy - fh - w * 0.012, w * 0.011, 0, Math.PI * 2);
  ctx.fill();
}

const SAMPLES = [
  { id: 'night-boulevard', title: 'Night Boulevard', paint: paintNightCity },
  { id: 'pier-sunset', title: 'Pier at Sunset', paint: paintPierSunset },
];

function prepare(canvas) {
  if (!canvas || typeof canvas.toDataURL !== 'function') {
    throw new TypeError('buildSamples needs a canvas element with toDataURL()');
  }
  if (!canvas.width) canvas.width = 1024;
  if (!canvas.height) canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire a 2d context for the sample photos');
  return ctx;
}

async function toImage(canvas, sample) {
  const src = canvas.toDataURL('image/jpeg', 0.92);
  if (typeof Image === 'undefined') return { src, width: canvas.width, height: canvas.height, alt: sample.title };
  const img = new Image();
  img.alt = sample.title;
  img.src = src;
  if (typeof img.decode === 'function') {
    try {
      await img.decode(); // resolves before first paint; tolerates failure below
    } catch {
      // Some engines reject decode() on big data URLs even though src is usable.
    }
  }
  return img;
}

/**
 * Paint the demo photos and hand back image-like objects.
 *
 * @param {HTMLCanvasElement} canvas scratch canvas, reused for both scenes
 * @param {(img: HTMLImageElement, sample: {id: string, title: string}) => any} [drawCover]
 *        optional hook fired as each photo becomes ready, so the caller can
 *        compose the demo poster with no external files.
 * @returns {Promise<HTMLImageElement[]>}
 */
export async function buildSamples(canvas, drawCover) {
  const ctx = prepare(canvas);
  const out = [];

  for (const sample of SAMPLES) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sample.paint(ctx, canvas.width, canvas.height);
    ctx.restore();

    const img = await toImage(canvas, sample);
    out.push(img);
    if (typeof drawCover === 'function') await drawCover(img, { id: sample.id, title: sample.title });
  }

  return out;
}

export default buildSamples;