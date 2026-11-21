// Sample photos for the cover-art maker — all painted with canvas 2D so the
// demo poster needs no external image files.

const TAU = Math.PI * 2;
const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const seedRand = (seed) => { let s = seed >>> 0; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function gradient(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  return g;
}
function glow(ctx, x, y, r, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  [[0, alpha], [0.32, alpha * 0.3], [1, 0]].forEach(([at, a]) => g.addColorStop(at, `rgba(${rgb},${a})`));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function scratch(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  throw new Error('buildSamples: no canvas implementation');
}
function finish(ctx, w, h, rand, dark) {
  const v = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.16, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, rgba(0, 0, 0, dark));
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 0.05;
  for (let i = 0; i < (w * h) / 1400; i++) { const n = (rand() * 255) | 0; ctx.fillStyle = `rgb(${n},${n},${n})`; ctx.fillRect(rand() * w, rand() * h, 1.6, 1.6); }
  ctx.globalAlpha = 1;
}
function paintBoulevard(ctx, w, h) {
  const rand = seedRand(0x6e696768), horizon = h * 0.56, vx = w * 0.5, vw = w * 0.05;
  ctx.fillStyle = gradient(ctx, 0, 0, 0, horizon, [[0, '#050714'], [0.45, '#0d1130'], [0.78, '#241a46'], [1, '#4a2a53']]);
  ctx.fillRect(0, 0, w, horizon);
  glow(ctx, vx, horizon, w * 0.72, '255,110,170', 0.26);
  for (let i = 0, n = 15; i < n; i++) {                 // skyline with lit windows
    const bw = w * (0.05 + rand() * 0.08), bx = -w * 0.04 + w * 1.1 * (i / n) + rand() * w * 0.015;
    const bh = h * (0.11 + rand() * 0.3), by = horizon - bh;
    ctx.fillStyle = i % 3 ? '#121429' : '#0b0d20'; ctx.fillRect(bx, by, bw, bh);
    if (rand() > 0.65) ctx.fillRect(bx + bw * 0.48, by - h * 0.035, Math.max(1, w * 0.002), h * 0.035);
    const cols = Math.max(2, Math.round(bw / (w * 0.017))), rows = Math.max(3, Math.round(bh / (h * 0.025)));
    const cw = bw / cols, ch = bh / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if (rand() > 0.45) continue;
      ctx.fillStyle = rand() > 0.32 ? rgba(255, 196, 112, 0.4 + rand() * 0.55) : rgba(120, 205, 255, 0.3 + rand() * 0.5);
      ctx.fillRect(bx + c * cw + cw * 0.22, by + r * ch + ch * 0.24, cw * 0.5, ch * 0.42);
    }
  }
  ctx.fillStyle = '#07070d'; ctx.fillRect(0, horizon, w, h - horizon);
  ctx.beginPath(); ctx.moveTo(vx - vw, horizon); ctx.lineTo(vx + vw, horizon); ctx.lineTo(w * 1.18, h); ctx.lineTo(-w * 0.18, h);
  ctx.fillStyle = gradient(ctx, 0, horizon, 0, h, [[0, '#191722'], [1, '#2b2733']]); ctx.fill();

  for (let i = 0; i < 10; i++) {                        // converging lane dashes
    const t0 = i / 10, t1 = t0 + 0.05, y0 = horizon + (h - horizon) * t0 * t0, y1 = horizon + (h - horizon) * t1 * t1;
    const a0 = w * 0.004 * (0.4 + t0 * 2.2), a1 = w * 0.005 * (0.4 + t1 * 2.2);
    ctx.fillStyle = 'rgba(238,206,140,0.7)'; ctx.beginPath();
    ctx.moveTo(vx - a0, y0); ctx.lineTo(vx + a0, y0); ctx.lineTo(vx + a1, y1); ctx.lineTo(vx - a1, y1); ctx.fill();
  }
  for (const side of [-1, 1]) for (const t of [0.18, 0.4, 0.64, 0.88]) {
    const x = vx + side * (vw + (w * 0.56 - vw) * t * t), y = horizon + (h - horizon) * t * t;
    const pole = (h - horizon) * 0.3 * t, arm = pole * 0.38, lx = x - side * arm, ly = y - pole;
    ctx.strokeStyle = 'rgba(8,8,14,0.95)'; ctx.lineWidth = Math.max(1.4, w * 0.0045 * t);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ly); ctx.lineTo(lx, ly); ctx.stroke();
    glow(ctx, lx, ly, pole * 0.85, '255,196,120', 0.55);
    ctx.fillStyle = '#ffeac4'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.2, w * 0.005 * t), 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.45; ctx.fillStyle = gradient(ctx, 0, y, 0, y + pole * 1.6, [[0, 'rgba(255,186,104,0.5)'], [1, 'rgba(255,186,104,0)']]);
    ctx.fillRect(lx - pole * 0.11, y, pole * 0.22, pole * 1.6); ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 3; i++) {                         // tail-light trails
    const y = horizon + (h - horizon) * (0.55 + i * 0.13);
    glow(ctx, vx - w * 0.22, y, w * (0.04 + i * 0.025), '255,52,92', 0.3);
  }
  finish(ctx, w, h, rand, 0.55);
}

function paintPier(ctx, w, h) {
  const rand = seedRand(0x70696572), horizon = h * 0.54, sunX = w * 0.58, sunY = horizon - h * 0.015;
  ctx.fillStyle = gradient(ctx, 0, 0, 0, horizon, [[0, '#1a1130'], [0.34, '#48203f'], [0.6, '#9d3c4e'], [0.82, '#e26a3c'], [1, '#ffc978']]);
  ctx.fillRect(0, 0, w, horizon);
  glow(ctx, sunX, sunY, w * 0.62, '255,206,130', 0.55); ctx.fillStyle = '#ffeab4';
  ctx.beginPath(); ctx.arc(sunX, sunY, w * 0.058, 0, TAU); ctx.fill();
  for (let i = 0; i < 13; i++) {                        // soft sunset cloud bands
    ctx.fillStyle = rgba(190 + rand() * 50, 100 + rand() * 55, 100 + rand() * 35, 0.09 + rand() * 0.2);
    ctx.beginPath(); ctx.ellipse(rand() * w, h * (0.07 + rand() * 0.36), w * (0.1 + rand() * 0.38), h * (0.005 + rand() * 0.014), 0, 0, TAU); ctx.fill();
  }

  ctx.fillStyle = gradient(ctx, 0, horizon, 0, h, [[0, '#40203f'], [0.3, '#26153a'], [1, '#0a0917']]);
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = 'rgba(255,196,128,0.55)'; ctx.fillRect(0, horizon - 1, w, 2);
  for (let i = 0; i < 64; i++) {                        // water shimmer
    const t = rand(), y = horizon + (h - horizon) * Math.pow(t, 1.7), len = w * (0.02 + rand() * 0.2) * (0.35 + t);
    ctx.fillStyle = rgba(255, 150 + rand() * 70, 88 + rand() * 50, (1 - t) * 0.45 * rand());
    ctx.fillRect(w * (0.1 + rand() * 0.8) - len / 2, y, len, Math.max(1, h * 0.003 * (0.4 + t)));
  }
  for (let i = 0; i < 42; i++) {                        // sun reflection column
    const t = i / 42, y = horizon + (h - horizon) * t * t, len = w * (0.012 + rand() * 0.07) * (0.4 + t);
    ctx.fillStyle = rgba(255, 214 - t * 100, 150 - t * 80, (1 - t) * 0.5);
    ctx.fillRect(sunX + (rand() - 0.5) * w * (0.02 + t * 0.18) - len / 2, y, len, Math.max(1, h * 0.0032 * (0.5 + t)));
  }
  const deckTop = horizon + h * 0.015, dx = w * 0.44;
  const xL = (u) => dx - w * 0.055 + (w * 0.12 - dx + w * 0.055) * u;
  const xR = (u) => dx + w * 0.055 + (w * 0.88 - dx - w * 0.055) * u;
  const yAt = (u) => deckTop + (h * 1.02 - deckTop) * u * u;
  const deck = () => {
    ctx.beginPath(); ctx.moveTo(xL(0), deckTop); ctx.lineTo(xR(0), deckTop);
    ctx.lineTo(xR(1), h * 1.02); ctx.lineTo(xL(1), h * 1.02); ctx.closePath();
  };
  ctx.fillStyle = gradient(ctx, 0, deckTop, 0, h, [[0, '#2c1a22'], [1, '#140d13']]); deck(); ctx.fill();
  ctx.save(); deck(); ctx.clip();
  for (let i = 1; i < 24; i++) {                        // plank seams
    const u = i / 24;
    ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = Math.max(1, h * 0.0025 * u);
    ctx.beginPath(); ctx.moveTo(xL(u), yAt(u)); ctx.lineTo(xR(u), yAt(u)); ctx.stroke();
  }
  ctx.restore();
  for (const edge of [xL, xR]) {                        // pilings and railing
    for (const u of [0.2, 0.36, 0.54, 0.74, 0.94]) {
      ctx.strokeStyle = 'rgba(10,7,12,0.96)'; ctx.lineWidth = Math.max(1.5, w * 0.006 * u + 1);
      ctx.beginPath(); ctx.moveTo(edge(u), yAt(u)); ctx.lineTo(edge(u), yAt(u) - h * (0.06 + u * 0.14)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(10,7,12,0.9)'; ctx.lineWidth = Math.max(1.5, w * 0.004); ctx.beginPath();
    for (let u = 0; u <= 1.0001; u += 0.02) {
      const x = edge(u), y = yAt(u) - h * (0.06 + u * 0.14);
      if (u < 0.001) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(20,10,20,0.6)'; ctx.lineWidth = Math.max(1, w * 0.0022);
  for (let i = 0; i < 5; i++) {                         // gulls
    const bx = w * (0.15 + rand() * 0.6), by = h * (0.12 + rand() * 0.22), s = w * (0.008 + rand() * 0.01);
    ctx.beginPath(); ctx.moveTo(bx - s, by); ctx.quadraticCurveTo(bx, by - s * 1.3, bx + s, by); ctx.stroke();
  }
  finish(ctx, w, h, rand, 0.42);
}

// Paints both scenes on scratch canvases and returns image-like handles: `src`
// is the toDataURL payload, `image` the live canvas for synchronous drawImage()
// in drawCover, and toImage() decodes the data URL on demand.
export async function buildSamples(canvas, drawCover) {
  const w = Math.max(1, Math.round((canvas && canvas.width) || 1000)), h = Math.max(1, Math.round((canvas && canvas.height) || 1500));
  const specs = [
    { id: 'night-boulevard', caption: 'BOULEVARD · 02:14 AM', paint: paintBoulevard },
    { id: 'sunset-pier', caption: 'PIER 9 · 08:42 PM', paint: paintPier }
  ];
  const samples = specs.map((spec) => {
    const shot = scratch(w, h), ctx = shot.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); spec.paint(ctx, w, h); ctx.restore();
    const src = shot.toDataURL('image/jpeg', 0.9);
    return {
      id: spec.id, name: spec.id, caption: spec.caption, src,
      width: w, height: h, naturalWidth: w, naturalHeight: h, image: shot,
      toImage: () => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img); img.onerror = () => reject(new Error(`buildSamples: cannot decode ${spec.id}`));
        img.src = src;
      })
    };
  });
  if (typeof drawCover === 'function' && canvas && typeof canvas.getContext === 'function') {
    drawCover(canvas, {
      width: w, height: h, title: 'SAMPLE CITY', studio: 'DEMO PICTURES', year: new Date().getFullYear(),
      photos: samples.map((s) => ({ image: s.image, caption: s.caption }))
    });
  }
  return samples;
}

export default buildSamples;