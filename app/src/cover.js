/**
 * cover.js — pure canvas 2D poster engine for Vice Cover Studio.
 * No DOM lookups, no network: everything is painted from primitives.
 */
const FONT_HEAVY = '"Arial Black", "Helvetica Neue", Impact, sans-serif';
const FONT_MONO = '"Courier New", ui-monospace, monospace';
const TAU = Math.PI * 2;

export const TEMPLATES = [
  { id: 'vice-dusk', name: 'Vice Dusk', kicker: 'VICE COVER STUDIO PRESENTS',
    tagline: 'SUNSETS · SCHEMES · SECOND CHANCES', studio: 'VICE COVER STUDIO — A PALM TREE PICTURES RELEASE — MMXXVI',
    slant: 0.045, bandH: 0.175, wash: 0.18, scan: 0.055 },
  { id: 'neon-rain', name: 'Neon Rain', kicker: 'NEON RAIN PICTURES',
    tagline: 'THE CITY NEVER DRIES OUT', studio: 'NEON RAIN PICTURES — IN ASSOCIATION WITH VICE COVER STUDIO',
    slant: -0.06, bandH: 0.15, wash: 0.26, scan: 0.085 },
  { id: 'sunset-heist', name: 'Sunset Heist', kicker: 'SUNSET HEIST',
    tagline: 'ONE LAST SCORE BEFORE THE SUN GOES DOWN', studio: 'SUNSET HEIST PRODUCTIONS — A VICE COVER STUDIO JOINT',
    slant: 0.025, bandH: 0.2, wash: 0.13, scan: 0.04 },
];

export const PALETTES = [
  { id: 'dusk-magenta', name: 'Dusk Magenta', bg: '#140a1a', ink: '#f7ead8', accent: '#ff3ea5', accent2: '#35e6e0' },
  { id: 'neon-cyan', name: 'Neon Cyan', bg: '#04141a', ink: '#eafcff', accent: '#35e6e0', accent2: '#ff3ea5' },
  { id: 'sunset-gold', name: 'Sunset Gold', bg: '#1a0d06', ink: '#fff0d0', accent: '#ff8a2b', accent2: '#ffd166' },
  { id: 'vice-noir', name: 'Vice Noir', bg: '#0b0b0d', ink: '#f2efe6', accent: '#e8352f', accent2: '#8b8f9a' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function rgba(hex, a) {
  if (typeof hex !== 'string') return hex;
  let s = hex.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length !== 6) return hex;
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? hex : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function edgeAt(e, y, y0, h) { return e.a + (e.b - e.a) * ((y - y0) / h); }

function fitFont(ctx, text, maxW, size, weight, family, floor = 10) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    s -= 1;
  } while (s > floor);
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

function clipText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

// Letter-spaced caps; condenses size/tracking to respect maxW.
function spaced(ctx, text, x, y, size, track, weight, family, maxW = Infinity) {
  const chars = [...String(text).toUpperCase()];
  ctx.font = `${weight} ${size}px ${family}`;
  let widths = chars.map((c) => ctx.measureText(c).width);
  let total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  if (total > maxW && maxW > 0) {
    const k = maxW / total;
    size *= k; track *= k;
    ctx.font = `${weight} ${size}px ${family}`;
    widths = chars.map((c) => ctx.measureText(c).width);
    total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  }
  let cx = x;
  for (let i = 0; i < chars.length; i++) { ctx.fillText(chars[i], cx, y); cx += widths[i] + track; }
  return total;
}

// Panel quads: vertical dividers slant, horizontal cuts stay level.
function buildCards(x0, y0, cw, ch, n, slant, gap) {
  const cols = n === 1 ? [0, 1] : n === 3 ? [0, 0.58, 1] : [0, 0.5, 1];
  const flat = (x) => ({ a: x, b: x });
  const line = (f) => ({ a: x0 + cw * f - slant, b: x0 + cw * f + slant });
  const shift = (e, d) => ({ a: e.a + d, b: e.b + d });
  const cards = [];
  for (let c = 0; c < cols.length - 1; c++) {
    const left = c === 0 ? flat(x0) : shift(line(cols[c]), gap / 2);
    const right = c === cols.length - 2 ? flat(x0 + cw) : shift(line(cols[c + 1]), -gap / 2);
    const rows = n === 4 ? (c === 0 ? [0, 0.46, 1] : [0, 0.56, 1]) : n === 3 && c === 1 ? [0, 0.5, 1] : [0, 1];
    for (let r = 0; r < rows.length - 1; r++) {
      const top = r === 0 ? y0 : y0 + ch * rows[r] - gap / 2;
      const bot = r === rows.length - 2 ? y0 + ch : y0 + ch * rows[r + 1] + gap / 2;
      cards.push({
        pts: [[edgeAt(left, top, y0, ch), top], [edgeAt(right, top, y0, ch), top],
          [edgeAt(right, bot, y0, ch), bot], [edgeAt(left, bot, y0, ch), bot]],
        left, right, top, bot, ey0: y0, eh: ch,
      });
    }
  }
  return cards;
}

function paintPhoto(ctx, img, box, zoom) {
  const { x, y, w, h } = box;
  const iw = img && (img.naturalWidth || img.width);
  const ih = img && (img.naturalHeight || img.height);
  if (!iw || !ih) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 24) {
      ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
    }
    return;
  }
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawPanel(ctx, card, photo, idx, p, t, gap) {
  const xs = card.pts.map((pt) => pt[0]);
  const bx = Math.min(...xs), bw = Math.max(...xs) - bx, bh = card.bot - card.top;
  ctx.save();
  polyPath(ctx, card.pts);
  ctx.clip();
  paintPhoto(ctx, photo && photo.image, { x: bx, y: card.top, w: bw, h: bh }, 1.06 + (idx % 3) * 0.015);
  const wash = ctx.createLinearGradient(0, card.top, 0, card.bot);
  wash.addColorStop(0, rgba(p.accent, t.wash));
  wash.addColorStop(0.55, rgba(p.accent2, t.wash * 0.45));
  wash.addColorStop(1, rgba(p.bg, 0.74));
  ctx.fillStyle = wash; ctx.fillRect(bx, card.top, bw, bh);
  // Halftone texture over the photo, clipped to the slanted panel quad.
  const dotStyle = idx % 2 ? p.ink : p.accent2;
  const dotStep = Math.max(6, Math.min(bw, bh) * 0.042);
  ctx.globalAlpha = 0.15;
  drawHalftone(ctx, bx, card.top, bw, bh, dotStep, dotStyle);
  ctx.globalAlpha = 1;
  // Caption strip tucked into the bottom of the panel.
  const capH = clamp(bh * 0.16, 18, 46), ys = card.bot - capH;
  const l0 = edgeAt(card.left, ys, card.ey0, card.eh), r0 = edgeAt(card.right, ys, card.ey0, card.eh);
  const l1 = edgeAt(card.left, card.bot, card.ey0, card.eh), r1 = edgeAt(card.right, card.bot, card.ey0, card.eh);
  polyPath(ctx, [[l0, ys], [r0, ys], [r1, card.bot], [l1, card.bot]]);
  ctx.fillStyle = rgba(p.ink, 0.95); ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.fillRect(l0 + capH * 0.18, ys + capH * 0.22, capH * 0.3, capH * 0.56);
  const num = String(idx + 1).padStart(2, '0');
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  ctx.font = `700 ${Math.max(9, capH * 0.24)}px ${FONT_MONO}`;
  ctx.fillStyle = p.accent;
  const numW = ctx.measureText(num).width;
  ctx.fillText(num, r0 - capH * 0.2, ys + capH / 2);
  const tx = l0 + capH * 0.62;
  const avail = Math.max(20, r0 - capH * 0.2 - numW - 8 - tx);
  const label = (photo && photo.caption ? String(photo.caption) : `FRAME ${num}`).toUpperCase();
  fitFont(ctx, label, avail, capH * 0.46, '900', FONT_HEAVY);
  ctx.textAlign = 'left'; ctx.fillStyle = p.bg;
  ctx.fillText(clipText(ctx, label, avail), tx, ys + capH / 2 + 1);
  ctx.restore();
  polyPath(ctx, card.pts);
  ctx.strokeStyle = rgba(p.ink, 0.5);
  ctx.lineWidth = Math.max(1.5, gap * 0.18);
  ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawMasthead(ctx, w, h, m, t, p, title) {
  const band = { x: m, y: m, w: w - 2 * m, h: h * t.bandH };
  const pad = band.h * 0.16, bSize = band.h * 0.44;
  const bx = band.x + band.w - pad - bSize, by = band.y + (band.h - bSize) / 2;
  ctx.fillStyle = p.ink; ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.fillStyle = rgba(p.bg, 0.72);
  spaced(ctx, t.kicker, band.x + pad, band.y + pad * 0.95 + band.h * 0.06,
    band.h * 0.082, band.h * 0.022, '700', FONT_MONO, bx - band.x - pad * 2);
  const avail = Math.max(60, bx - pad * 1.2 - (band.x + pad));
  const ts = fitFont(ctx, title, avail / 0.93, band.h * 0.56, '900', FONT_HEAVY, 12);
  const rawW = ctx.measureText(title).width;
  const squeeze = Math.min(0.93, avail / Math.max(1, rawW));
  const baseline = band.y + band.h * 0.72;
  ctx.save();
  ctx.translate(band.x + pad, baseline);
  ctx.scale(squeeze, 1);
  ctx.font = `900 ${ts}px ${FONT_HEAVY}`;
  ctx.lineJoin = 'round';
  const tw = rawW * squeeze;
  ctx.fillStyle = rgba(p.accent2, 0.85); ctx.fillText(title, ts * 0.04, ts * 0.04);
  ctx.strokeStyle = p.accent; ctx.lineWidth = ts * 0.05; ctx.strokeText(title, 0, 0);
  ctx.fillStyle = p.bg; ctx.fillText(title, 0, 0);
  ctx.restore();
  ctx.fillStyle = p.accent;
  ctx.fillRect(band.x + pad, baseline + ts * 0.12, Math.min(tw * 0.62, avail), Math.max(3, band.h * 0.035));
  ctx.fillStyle = rgba(p.bg, 0.62);
  spaced(ctx, t.tagline, band.x + pad, band.y + band.h - pad * 0.55,
    band.h * 0.08, band.h * 0.02, '600', FONT_MONO, avail);
  // Issue badge.
  ctx.fillStyle = p.bg; ctx.fillRect(bx, by, bSize, bSize);
  ctx.strokeStyle = rgba(p.accent2, 0.9); ctx.lineWidth = Math.max(1, bSize * 0.025);
  ctx.strokeRect(bx, by, bSize, bSize);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = p.accent; ctx.font = `900 ${bSize * 0.5}px ${FONT_HEAVY}`;
  ctx.fillText('VI', bx + bSize / 2, by + bSize * 0.45);
  ctx.fillStyle = rgba(p.ink, 0.9); ctx.font = `700 ${Math.max(6, bSize * 0.1)}px ${FONT_MONO}`;
  ctx.fillText('ISSUE 06', bx + bSize / 2, by + bSize * 0.8);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const stripH = Math.max(3, h * 0.007);
  ctx.fillStyle = p.accent; ctx.fillRect(band.x, band.y + band.h, band.w, stripH);
  ctx.fillStyle = p.accent2; ctx.fillRect(band.x + band.w * 0.72, band.y + band.h, band.w * 0.28, stripH);
}

function drawBanner(ctx, w, h, m, t, p) {
  const bh = h * 0.078, x = m, y = h - m - bh, bw = w - 2 * m;
  ctx.fillStyle = p.bg; ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = rgba(p.ink, 0.05); ctx.fillRect(x, y, bw, bh);
  const lineH = Math.max(2, h * 0.0035);
  ctx.fillStyle = p.accent; ctx.fillRect(x, y, bw, lineH);
  ctx.fillStyle = p.accent2; ctx.fillRect(x + bw * 0.18, y, bw * 0.06, lineH);
  const pad = bh * 0.22, rs = bh * 0.56, rx = x + pad, ry = y + (bh - rs) / 2;
  ctx.fillStyle = p.accent; ctx.fillRect(rx, ry, rs, rs);
  ctx.fillStyle = p.bg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${rs * 0.62}px ${FONT_HEAVY}`;
  ctx.fillText('R', rx + rs / 2, ry + rs * 0.54);
  const sx = rx + rs + pad, rightW = bh * 2.4;
  const maxW = Math.max(60, x + bw - pad - rightW - sx);
  ctx.textAlign = 'left'; ctx.fillStyle = rgba(p.ink, 0.86);
  spaced(ctx, t.studio, sx, y + bh * 0.56, bh * 0.27, bh * 0.035, '700', FONT_MONO, maxW);
  ctx.textAlign = 'right'; ctx.fillStyle = p.accent;
  ctx.font = `700 ${Math.max(8, bh * 0.22)}px ${FONT_MONO}`;
  ctx.fillText('COVER 06', x + bw - pad, y + bh * 0.56);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function scanlines(ctx, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = '#000'; ctx.globalAlpha = alpha;
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.globalAlpha = Math.min(1, alpha * 1.9);
  ctx.fillRect(0, h * 0.36, w, 2); ctx.fillRect(0, h * 0.63, w, 2);
  ctx.restore();
}

function halftone(ctx, x, y, w, h, step, color, alpha, clipPts) {
  ctx.save();
  if (clipPts) { polyPath(ctx, clipPts); ctx.clip(); }
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  let row = 0;
  for (let gy = 0; gy <= h; gy += step, row++) {
    for (let gx = 0; gx <= w; gx += step) {
      const t = (gx / w + gy / h) / 2;
      const r = step * 0.46 * (1 - t * 0.8);
      if (r < 0.6) continue;
      const off = row % 2 ? step * 0.5 : 0;
      ctx.beginPath(); ctx.arc(x + gx + off, y + gy, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// Flat halftone dot screen used for panel texture. Alpha and clipping are the
// caller's job (set ctx.globalAlpha / clip before calling) so the same helper
// can serve panels, accents and the masthead.
function drawHalftone(ctx, x, y, w, h, step, color) {
  const s = Math.max(3, step);
  const ww = Math.max(1, w), hh = Math.max(1, h);
  ctx.save();
  ctx.fillStyle = color;
  let row = 0;
  for (let gy = 0; gy <= hh; gy += s, row++) {
    for (let gx = 0; gx <= ww; gx += s) {
      const t = clamp((gx / ww + gy / hh) / 2, 0, 1);
      const r = s * 0.36 * (1 - t * 0.6);
      if (r < 0.5) continue;
      const off = row % 2 ? s * 0.5 : 0;
      ctx.beginPath(); ctx.arc(x + gx + off, y + gy, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// Light film-grain pass. Deterministic (seeded LCG) so the same cover always
// renders identically; stays out of Math.random on purpose.
function grain(ctx, w, h, amount) {
  const a = clamp(Number(amount) || 0, 0, 1);
  const count = Math.round((w * h) / 620);
  let seed = (Math.round(w) * 73856093) ^ (Math.round(h) * 19349663) ^ 0x5f3759df;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.save();
  for (let i = 0; i < count; i++) {
    const gx = rnd() * w, gy = rnd() * h;
    const light = rnd() > 0.5;
    const sz = rnd() > 0.84 ? 2 : 1;
    ctx.fillStyle = light ? '#ffffff' : '#000000';
    ctx.globalAlpha = a * (0.3 + rnd() * 0.7);
    ctx.fillRect(gx, gy, sz, sz);
  }
  ctx.restore();
}

function vignette(ctx, w, h, color) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, 0.55));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function drawBorder(ctx, w, h, m, p) {
  const x = m * 0.5, s = Math.max(3, w * 0.006);
  ctx.save();
  ctx.strokeStyle = p.ink; ctx.lineWidth = s;
  ctx.strokeRect(x, x, w - 2 * x, h - 2 * x);
  ctx.strokeStyle = rgba(p.accent2, 0.75); ctx.lineWidth = 1;
  const inset = s * 1.8;
  ctx.strokeRect(x + inset, x + inset, w - 2 * (x + inset), h - 2 * (x + inset));
  ctx.fillStyle = p.accent;
  const c = s * 3;
  ctx.fillRect(x, x, c, s); ctx.fillRect(x, x, s, c);
  ctx.fillRect(w - x - c, h - x - s, c, s); ctx.fillRect(w - x - s, h - x - c, s, c);
  ctx.restore();
}

export function drawCover(ctx, opts = {}) {
  const w = Math.max(320, Number(opts.width) || 1024);
  const h = Math.max(320, Number(opts.height) || 1024);
  const t = TEMPLATES.find((x) => x.id === opts.template) || TEMPLATES[0];
  const src = opts.palette || PALETTES[0];
  const p = { bg: src.bg || PALETTES[0].bg, ink: src.ink || PALETTES[0].ink,
    accent: src.accent || PALETTES[0].accent, accent2: src.accent2 || PALETTES[0].accent2 };
  const photos = Array.isArray(opts.photos) ? opts.photos.slice(0, 4) : [];
  const n = clamp(photos.length || 1, 1, 4);
  const rawTitle = String(opts.title == null ? '' : opts.title).trim();
  const title = (rawTitle || 'Vice City Nights').toUpperCase();
  const m = w * 0.03, bandH = h * t.bandH, bannerH = h * 0.078, gapTop = h * 0.018;
  const cw = w - 2 * m;
  const ch = h - 2 * m - bandH - bannerH - gapTop * 2;
  const x0 = m, y0 = m + bandH + gapTop;
  const gap = Math.max(5, w * 0.009);
  const slant = cw * t.slant;
  ctx.save();
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
  const amb = ctx.createLinearGradient(0, 0, w, h);
  amb.addColorStop(0, rgba(p.accent, 0.1));
  amb.addColorStop(0.55, rgba(p.bg, 0));
  amb.addColorStop(1, rgba(p.accent2, 0.08));
  ctx.fillStyle = amb; ctx.fillRect(0, 0, w, h);
  const cards = buildCards(x0, y0, cw, ch, n, slant, gap);
  cards.forEach((card, i) => drawPanel(ctx, card, photos[i], i, p, t, gap));
  drawMasthead(ctx, w, h, m, t, p, title);
  drawBanner(ctx, w, h, m, t, p);
  scanlines(ctx, w, h, t.scan);
  grain(ctx, w, h, 0.05);
  const step = Math.max(7, w * 0.011);
  halftone(ctx, x0, y0, cw * 0.42, ch * 0.52, step, p.ink, 0.14,
    [[x0, y0], [x0 + cw * 0.42, y0], [x0, y0 + ch * 0.52]]);
  halftone(ctx, x0 + cw * 0.6, y0 + ch * 0.52, cw * 0.4, ch * 0.48, step, p.accent2, 0.12,
    [[x0 + cw, y0 + ch * 0.38], [x0 + cw, y0 + ch], [x0 + cw * 0.52, y0 + ch]]);
  vignette(ctx, w, h, p.bg);
  drawBorder(ctx, w, h, m, p);
  ctx.restore();
}