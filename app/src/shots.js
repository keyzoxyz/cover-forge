/* Synthesised demo photos for the cover art maker.
 * buildSamples(canvas, drawCover) -> [nightBoulevard, pierSunset] as
 * HTMLImageElements built from canvas.toDataURL(), so nothing external loads.
 */
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const rng = (seed) => {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
};

const load = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('sample image failed to decode'));
  img.src = src;
});

/* Night city boulevard: lit tower windows, sodium lamp pools, wet asphalt. */
function city(w, h) {
  const c = mk(w, h), g = c.getContext('2d'), r = rng(20261121), hz = h * 0.62;

  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#070a1c'); sky.addColorStop(0.55, '#101a3a'); sky.addColorStop(1, '#33406b');
  g.fillStyle = sky; g.fillRect(0, 0, w, hz);

  g.fillStyle = '#fff';
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.25 + r() * 0.6;
    g.fillRect(r() * w, r() * hz * 0.5, 1.4, 1.4);
  }
  g.globalAlpha = 1;

  // Tower blocks with scattered lit windows.
  const n = 14;
  for (let i = 0; i < n; i++) {
    const bw = w * (0.05 + r() * 0.07), bh = hz * (0.18 + r() * 0.44);
    const bx = (i / n) * w + r() * 6 - 3, by = hz - bh;
    const wall = g.createLinearGradient(bx, by, bx + bw, by);
    wall.addColorStop(0, '#151d33'); wall.addColorStop(1, '#0c1224');
    g.fillStyle = wall; g.fillRect(bx, by, bw, bh);

    const cols = Math.max(2, Math.floor(bw / 11)), rows = Math.max(3, Math.floor(bh / 14));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      if (r() < 0.42) continue;
      const wx = bx + 4 + cx * (bw - 8) / cols, wy = by + 6 + cy * (bh - 10) / rows;
      g.fillStyle = r() < 0.72
        ? `rgba(255,206,128,${0.45 + r() * 0.5})`
        : `rgba(150,206,255,${0.3 + r() * 0.45})`;
      g.fillRect(wx, wy, 3.2, 4.2);
    }
  }

  const road = g.createLinearGradient(0, hz, 0, h);
  road.addColorStop(0, '#1b1d2b'); road.addColorStop(1, '#08090f');
  g.fillStyle = road; g.fillRect(0, hz, w, h - hz);

  const vpx = w * 0.5, vpy = hz;

  // Street lamps receding toward the vanishing point, with road reflections.
  for (let i = 0; i < 9; i++) {
    const t = Math.pow(i / 8, 0.75);
    for (const side of [-1, 1]) {
      const x = vpx + side * (w * 0.06 + t * w * 0.46), y = vpy + t * (h - vpy) * 0.92;
      const rad = 10 + t * 78;
      const halo = g.createRadialGradient(x, y, 0, x, y, rad);
      halo.addColorStop(0, 'rgba(255,193,110,0.55)'); halo.addColorStop(0.45, 'rgba(255,160,70,0.16)');
      halo.addColorStop(1, 'rgba(255,140,50,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill();
      g.fillStyle = `rgba(255,186,104,${0.16 - t * 0.1})`;
      g.fillRect(x - (2 + t * 9) / 2, y, 2 + t * 9, (h - y) * 0.55);
    }
  }

  // Tram rails converging on the vanishing point.
  g.strokeStyle = 'rgba(200,215,255,0.10)'; g.lineWidth = 1.2;
  for (const off of [-0.16, -0.065, 0.065, 0.16]) {
    g.beginPath(); g.moveTo(vpx + w * off * 0.32, vpy); g.lineTo(vpx + w * off * 2.6, h); g.stroke();
  }

  // Headlight and taillight streaks on the far lanes.
  for (let i = 0; i < 22; i++) {
    const y = vpy + Math.pow(r(), 1.5) * (h - vpy), sp = (y - vpy) / (h - vpy);
    const x = vpx + (r() - 0.5) * w * 0.75 * sp, len = 6 + sp * 44;
    const lg = g.createLinearGradient(x, y, x + len, y);
    lg.addColorStop(0, r() < 0.55 ? 'rgba(255,250,225,0.85)' : 'rgba(255,60,50,0.8)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(x, y, len, 1 + sp * 3.4);
  }

  const vig = g.createRadialGradient(w / 2, h * 0.55, h * 0.15, w / 2, h * 0.55, h * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = vig; g.fillRect(0, 0, w, h);
  return c;
}

/* Pier at sunset: molten sky, sun glitter on the water, silhouetted deck. */
function pier(w, h) {
  const c = mk(w, h), g = c.getContext('2d'), r = rng(778899), wl = h * 0.58;

  const sky = g.createLinearGradient(0, 0, 0, wl);
  sky.addColorStop(0, '#2b1b4d'); sky.addColorStop(0.38, '#8a3f6b'); sky.addColorStop(0.68, '#e2683f');
  sky.addColorStop(0.9, '#ffb35c'); sky.addColorStop(1, '#ffd98d');
  g.fillStyle = sky; g.fillRect(0, 0, w, wl);

  // Cloud bands catching the last light.
  for (let i = 0; i < 12; i++) {
    const cy = wl * (0.12 + r() * 0.72), ch = 3 + r() * 13;
    const cw = w * (0.12 + r() * 0.45), cx = r() * (w - cw * 0.5), warm = 1 - cy / wl;
    g.fillStyle = `rgba(255,${Math.round(120 + warm * 90)},${Math.round(90 + warm * 60)},${0.06 + r() * 0.14})`;
    g.beginPath(); g.ellipse(cx + cw / 2, cy, cw / 2, ch, 0, 0, 6.2832); g.fill();
  }

  // Sun disc and its glow, dipping into the sea.
  const sx = w * 0.66, sy = wl - h * 0.055, sr = h * 0.075;
  const glow = g.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 5.2);
  glow.addColorStop(0, 'rgba(255,236,180,0.95)'); glow.addColorStop(0.25, 'rgba(255,176,92,0.45)');
  glow.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(sx, sy, sr * 5.2, 0, 6.2832); g.fill();
  g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(sx, sy, sr, 0, 6.2832); g.fill();

  const sea = g.createLinearGradient(0, wl, 0, h);
  sea.addColorStop(0, '#c9683c'); sea.addColorStop(0.25, '#7b3f52'); sea.addColorStop(1, '#20152f');
  g.fillStyle = sea; g.fillRect(0, wl, w, h - wl);

  // Sun glitter column under the disc.
  for (let i = 0; i < 220; i++) {
    const t = Math.pow(r(), 0.7), y = wl + t * (h - wl) * 0.95;
    const spread = 14 + t * w * 0.3, x = sx + (r() - 0.5) * spread * 2;
    g.fillStyle = `rgba(255,214,150,${0.5 * (1 - t) + 0.06})`;
    g.fillRect(x, y, 3 + r() * (4 + t * 34), 1 + t * 2.6);
  }

  // Ripple texture across the rest of the water.
  for (let i = 0; i < 260; i++) {
    const y = wl + r() * (h - wl), t = (y - wl) / (h - wl);
    g.fillStyle = `rgba(255,180,190,${(0.03 + r() * 0.07) * (1 - t * 0.4)})`;
    g.fillRect(r() * w, y, 4 + r() * (3 + t * 26), 1);
  }

  // Deck in perspective, from the right edge out to the horizon.
  const dy = wl + h * 0.055, dh = h * 0.055, fx = w * 0.3, fy = wl - h * 0.005;

  g.strokeStyle = 'rgba(24,14,22,0.9)';
  for (let i = 0; i <= 7; i++) {
    const t = i / 7, x = fx + (w - fx) * t, y = fy + (dy - fy) * t;
    g.lineWidth = 1.6 + t * 5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (h - y) * (0.16 + t * 0.2)); g.stroke();
  }

  g.fillStyle = '#2a1a24';
  g.beginPath();
  g.moveTo(fx, fy); g.lineTo(w, dy); g.lineTo(w, dy + dh); g.lineTo(fx, fy + dh * 0.18);
  g.closePath(); g.fill();

  g.strokeStyle = 'rgba(150,96,80,0.22)'; g.lineWidth = 1;
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    g.beginPath(); g.moveTo(fx, fy + dh * 0.18 * t); g.lineTo(w, dy + dh * t); g.stroke();
  }

  // Mooring bollards with rim light.
  for (let i = 0; i < 3; i++) {
    const t = 0.25 + i * 0.28, x = fx + (w - fx) * t, y = fy + (dy - fy) * t;
    const bh = 5 + t * 12, bwid = 2.8 + t * 4;
    g.fillStyle = '#120a10'; g.fillRect(x - bwid / 2, y - bh, bwid, bh);
    g.fillStyle = 'rgba(255,196,128,0.55)'; g.fillRect(x - bwid / 2, y - bh, 1 + t * 1.4, bh);
  }

  // Distant birds.
  g.strokeStyle = 'rgba(28,18,30,0.75)'; g.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const bx = w * (0.1 + r() * 0.34), by = wl * (0.16 + r() * 0.3), s = 3 + r() * 4;
    g.beginPath(); g.moveTo(bx - s, by);
    g.quadraticCurveTo(bx - s * 0.4, by - s * 0.7, bx, by);
    g.quadraticCurveTo(bx + s * 0.4, by - s * 0.7, bx + s, by);
    g.stroke();
  }

  const vig = g.createRadialGradient(w * 0.6, h * 0.5, h * 0.2, w * 0.6, h * 0.5, h);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(30,8,24,0.5)');
  g.fillStyle = vig; g.fillRect(0, 0, w, h);
  return c;
}

export async function buildSamples(canvas, drawCover) {
  // Samples are fully self-contained; drawCover is accepted so callers can pass
  // their own painter through, but these two images do not depend on it.
  const w = (canvas && canvas.width) || 1600, h = (canvas && canvas.height) || 1000;
  const [nightImg, pierImg] = await Promise.all([
    load(city(w, h).toDataURL('image/png')),
    load(pier(w, h).toDataURL('image/png')),
  ]);
  return [nightImg, pierImg];
}