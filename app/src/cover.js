/**
 * cover.js — poster drawing engine for the cover art maker. Paints a GTA-style
 * multi-panel poster: masthead, 1-4 slanted photo panels, caption strips,
 * studio banner, halftone, scanlines, border. Pure Canvas 2D: no DOM, no
 * network, no external fonts.
 */

const DISPLAY = '"Arial Black", "Helvetica Neue", Impact, Arial, sans-serif';
const SANS = '"Helvetica Neue", Arial, sans-serif';
const MONO = '"Courier New", ui-monospace, monospace';

export const PALETTES = [
  { id: 'sunset', name: 'Sunset Strip', bg: '#1b1033', ink: '#f7ecd2', accent: '#ff3d68', accent2: '#ffc93c' },
  { id: 'vice', name: 'Mint Vice', bg: '#06201d', ink: '#eafff6', accent: '#25e0a0', accent2: '#ff7ad9' },
  { id: 'noir', name: 'Noir City', bg: '#0a0a0c', ink: '#f1f1ee', accent: '#e8452c', accent2: '#8aa2ff' },
  { id: 'dune', name: 'Dune Heat', bg: '#2a1a10', ink: '#ffe9c7', accent: '#ff8a3d', accent2: '#63d2ff' },
];

export const TEMPLATES = [
  { id: 'vice', name: 'VICE', studio: 'NORTHSIDE PICTURES', kicker: 'A NORTHSIDE PICTURES RELEASE', masthead: 0.185, slant: 0.075, caption: 0.115, tracking: 0.95, dot: 1, scan: 1 },
  { id: 'brut', name: 'BRUT', studio: 'HARDLIGHT STUDIO', kicker: 'HARDLIGHT STUDIO PRESENTS', masthead: 0.24, slant: 0.02, caption: 0.13, tracking: 1.04, dot: 0.7, scan: 0.7 },
  { id: 'neon', name: 'NEON', studio: 'PARALLAX MEDIA', kicker: 'A PARALLAX MEDIA ORIGINAL', masthead: 0.16, slant: 0.12, caption: 0.1, tracking: 0.88, dot: 1.3, scan: 1.25 },
];

const DEFAULT_PALETTE = { bg: '#141018', ink: '#f6f1e6', accent: '#ff3d68', accent2: '#ffc93c' };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const displayFont = (size) => `900 ${size}px ${DISPLAY}`;
const sansFont = (size, weight = 700) => `${weight} ${size}px ${SANS}`;
const monoFont = (size) => `700 ${size}px ${MONO}`;

function rgba(hex, a) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/i.test(h)) return `rgba(0,0,0,${a})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function trackedWidth(ctx, text, tr) {
  let w = 0;
  for (let i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width;
  return w * tr;
}

function drawTracked(ctx, text, x, y, tr) {
  for (let i = 0, cx = x; i < text.length; i++) {
    ctx.fillText(text[i], cx, y);
    cx += ctx.measureText(text[i]).width * tr;
  }
}

function fitTracked(ctx, text, maxW, maxH, tr) {
  ctx.font = displayFont(100);
  return clamp((100 * maxW) / (trackedWidth(ctx, text, tr) || 1), 8, maxH);
}

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + '\u2026').width > maxW) out = out.slice(0, -1);
  return out + '\u2026';
}

const rectPoly = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function tracePoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

function polyBounds(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i++) {
    x0 = Math.min(x0, p[i][0]); y0 = Math.min(y0, p[i][1]);
    x1 = Math.max(x1, p[i][0]); y1 = Math.max(y1, p[i][1]);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Clip a convex polygon against a linear half-plane f(x, y) >= 0. */
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a[0], a[1]), fb = f(b[0], b[1]);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Split the body rect into 1-4 cells along one slanted vertical and one slanted horizontal line. */
function splitCells(rect, count, slant, gap) {
  const full = rectPoly(rect.x, rect.y, rect.w, rect.h);
  const n = clamp(count, 1, 4);
  if (n === 1) return [full];
  const offV = Math.max(2, rect.w * slant);
  const offH = Math.max(2, rect.h * slant * 0.7);
  const midX = rect.x + rect.w * (n === 3 ? 0.585 : 0.5);
  const midY = rect.y + rect.h * 0.5;
  const g = gap / 2;
  const vx = (py) => midX + offV * ((2 * (py - rect.y)) / rect.h - 1);
  const hy = (px) => midY + offH * ((2 * (px - rect.x)) / rect.w - 1);
  const left = clipHalf(full, (px, py) => vx(py) - g - px);
  const right = clipHalf(full, (px, py) => px - vx(py) - g);
  if (n === 2) return [left, right];
  const top = (q) => clipHalf(q, (px, py) => hy(px) - g - py);
  const bottom = (q) => clipHalf(q, (px, py) => py - hy(px) - g);
  if (n === 3) return [left, top(right), bottom(right)];
  return [top(left), bottom(left), top(right), bottom(right)];
}

function halftone(ctx, box, color, step, maxR, alpha) {
  const cols = Math.max(1, (box.w / step) | 0), rows = Math.max(1, (box.h / step) | 0);
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  ctx.fillStyle = rgba(color, alpha);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = (c + 0.5) / cols, ty = (r + 0.5) / rows;
      const rad = maxR * (1 - ty) * Math.sin(Math.PI * clamp(tx * 1.1, 0, 1));
      const px = box.x + c * step + step * (r % 2 ? 1 : 0.5);
      const py = box.y + r * step + step * 0.5;
      if (rad < 0.4 || px > box.x + box.w + step) continue;
      ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function scanlines(ctx, box, color, step, alpha) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = box.y; y < box.y + box.h; y += step) {
    ctx.moveTo(box.x, y + 0.5); ctx.lineTo(box.x + box.w, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBackdrop(ctx, w, h, pal) {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createLinearGradient(0, 0, w, h);
  glow.addColorStop(0, rgba(pal.accent, 0.18));
  glow.addColorStop(0.5, rgba(pal.accent2, 0.06));
  glow.addColorStop(1, rgba(pal.bg, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawPanel(ctx, poly, photo, i, tpl, pal, unit) {
  if (!poly || poly.length < 3) return;
  const b = polyBounds(poly);
  if (b.w < 4 || b.h < 4) return;
  ctx.save(); tracePoly(ctx, poly); ctx.clip();
  ctx.fillStyle = rgba(pal.ink, 0.07); ctx.fillRect(b.x, b.y, b.w, b.h);

  const img = photo && photo.image;
  if (img && img.width > 0 && img.height > 0) {
    const s = Math.max(b.w / img.width, b.h / img.height);
    const dw = img.width * s, dh = img.height * s;
    try {
      ctx.drawImage(img, b.x + (b.w - dw) / 2, b.y + (b.h - dh) / 2, dw, dh);
    } catch (err) { /* undrawable source: keep the backdrop */ }
  } else {
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, rgba(pal.accent, 0.4));
    g.addColorStop(1, rgba(pal.bg, 0.9));
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.fillStyle = rgba(pal.bg, 0.16); ctx.fillRect(b.x, b.y, b.w, b.h);

  const sh = clamp(b.h * tpl.caption, 18, Math.max(24, b.h * 0.24));
  const sy = b.y + b.h - sh, tab = Math.max(sh * 0.95, 20);
  ctx.fillStyle = rgba(pal.ink, 0.94); ctx.fillRect(b.x, sy, b.w, sh);
  ctx.fillStyle = pal.accent; ctx.fillRect(b.x, sy, tab, sh);
  ctx.fillStyle = pal.accent2; ctx.fillRect(b.x, sy, b.w, Math.max(1.5, sh * 0.06));

  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = displayFont(sh * 0.46); ctx.fillStyle = pal.bg;
  ctx.fillText(String(i + 1).padStart(2, '0'), b.x + tab / 2, sy + sh * 0.56);
  const label = String((photo && photo.caption) || 'PANEL ' + (i + 1)).toUpperCase();
  ctx.font = sansFont(clamp(sh * 0.34, 8, 26), 800); ctx.textAlign = 'left';
  const avail = b.w - tab - sh * 0.7;
  if (avail > 10) ctx.fillText(ellipsize(ctx, label, avail), b.x + tab + sh * 0.35, sy + sh * 0.56);
  ctx.restore();

  ctx.save(); tracePoly(ctx, poly);
  ctx.strokeStyle = rgba(pal.ink, 0.45); ctx.lineWidth = Math.max(1, unit * 0.0018);
  ctx.stroke(); ctx.restore();
}

function drawMasthead(ctx, box, opts, tpl, pal, count) {
  const unit = Math.min(box.w, box.h), pad = box.w * 0.028;
  ctx.save();
  ctx.fillStyle = rgba(pal.ink, 0.05); ctx.fillRect(box.x, box.y, box.w, box.h);
  halftone(ctx, { x: box.x, y: box.y, w: box.w, h: box.h * 0.95 }, pal.accent,
    Math.max(5, unit * 0.06), Math.max(1.3, unit * 0.024) * tpl.dot, 0.18);

  const kicker = String(opts.kicker || tpl.kicker || '').toUpperCase(), kTrack = 1.45;
  let kSize = clamp(box.h * 0.08, 8, 20);
  ctx.font = monoFont(kSize); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const kW = trackedWidth(ctx, kicker, kTrack) || 1;
  if (kW > box.w * 0.55) { kSize = Math.max(6, (kSize * box.w * 0.55) / kW); ctx.font = monoFont(kSize); }
  ctx.fillStyle = pal.accent2;
  drawTracked(ctx, kicker, box.x + pad, box.y + box.h * 0.2, kTrack);

  ctx.textAlign = 'right'; ctx.font = monoFont(clamp(box.h * 0.07, 7, 16));
  ctx.fillStyle = rgba(pal.ink, 0.62);
  ctx.fillText(String(count).padStart(2, '0') + ' SHOT' + (count === 1 ? '' : 'S'),
    box.x + box.w - pad, box.y + box.h * 0.2);

  const title = String(opts.title || 'UNTITLED').toUpperCase(), track = tpl.tracking;
  const size = fitTracked(ctx, title, box.w - pad * 2, box.h * 0.62, track);
  ctx.font = displayFont(size); ctx.textAlign = 'left';
  const tx = box.x + (box.w - trackedWidth(ctx, title, track)) / 2;
  const ty = box.y + box.h - Math.max(8, box.h * 0.19);
  ctx.fillStyle = rgba(pal.accent, 0.95);
  drawTracked(ctx, title, tx + size * 0.045, ty + size * 0.045, track);
  ctx.fillStyle = pal.ink;
  drawTracked(ctx, title, tx, ty, track);

  const ruleH = Math.max(2, box.h * 0.014), ruleY = box.y + box.h - Math.max(4, box.h * 0.07);
  ctx.fillStyle = rgba(pal.ink, 0.8); ctx.fillRect(box.x + pad, ruleY, box.w - pad * 2, ruleH);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(box.x + pad, ruleY - ruleH * 2.2, (box.w - pad * 2) * 0.18, ruleH * 1.3);
  ctx.restore();
}

function drawBanner(ctx, box, tpl, pal, count) {
  ctx.save();
  ctx.fillStyle = rgba(pal.ink, 0.96); ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = pal.accent; ctx.fillRect(box.x, box.y, box.w, Math.max(3, box.h * 0.07));
  halftone(ctx, { x: box.x + box.w * 0.6, y: box.y, w: box.w * 0.4, h: box.h }, pal.bg,
    Math.max(4, box.h * 0.14), Math.max(1.2, box.h * 0.05), 0.16);

  const pad = box.w * 0.018;
  ctx.font = monoFont(clamp(box.h * 0.24, 8, 26)); ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillStyle = pal.bg;
  ctx.fillText(String(tpl.studio || 'STUDIO').toUpperCase(), box.x + pad, box.y + box.h * 0.6);
  ctx.textAlign = 'right'; ctx.fillStyle = rgba(pal.bg, 0.62);
  ctx.fillText(String(count).padStart(2, '0') + ' SHOT' + (count === 1 ? '' : 'S') + '  /  ' + tpl.name,
    box.x + box.w - pad, box.y + box.h * 0.6);
  ctx.restore();
}

function vignette(ctx, w, h, pal) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, rgba(pal.bg, 0)); g.addColorStop(1, rgba(pal.bg, 0.55));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/**
 * Darken the poster's corners with a radial gradient that fades from clear at
 * the centre to near-black at the edges. `strength` is 0-1; <= 0 is a no-op.
 */
function drawVignette(ctx, w, h, strength) {
  const s = clamp(typeof strength === 'number' ? strength : 0.45, 0, 1);
  if (s <= 0) return;
  const inner = Math.min(w, h) * 0.26, outer = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(w / 2, h / 2, inner, w / 2, h / 2, outer);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, rgba('#000000', s * 0.3));
  g.addColorStop(1, rgba('#000000', s));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawBorder(ctx, w, h, pal) {
  const unit = Math.min(w, h), inset = Math.max(6, unit * 0.016), i2 = inset + Math.max(4, unit * 0.008);
  ctx.save();
  ctx.strokeStyle = rgba(pal.ink, 0.9); ctx.lineWidth = Math.max(2, unit * 0.004);
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.strokeStyle = rgba(pal.accent, 0.8); ctx.lineWidth = 1;
  ctx.strokeRect(i2, i2, w - i2 * 2, h - i2 * 2);

  const tick = unit * 0.05;
  ctx.strokeStyle = pal.accent2; ctx.lineWidth = Math.max(2, unit * 0.005);
  const corners = [[i2, i2, 1, 1], [w - i2, i2, -1, 1], [i2, h - i2, 1, -1], [w - i2, h - i2, -1, -1]];
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    ctx.beginPath();
    ctx.moveTo(c[0] + c[2] * tick, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * tick);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paint a poster onto a CanvasRenderingContext2D.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width:number, height:number, photos:Array<{image:any, caption?:string}>,
 *          title?:string, template?:string, palette?:object, kicker?:string}} opts
 */
export function drawCover(ctx, opts) {
  const o = opts || {};
  const w = Math.max(64, Math.round(o.width || 1200));
  const h = Math.max(64, Math.round(o.height || 1500));
  const pal = Object.assign({}, DEFAULT_PALETTE, o.palette || {});
  const tpl = TEMPLATES.filter((t) => t.id === o.template)[0] || TEMPLATES[0];
  const photos = (Array.isArray(o.photos) ? o.photos : []).slice(0, 4);
  const count = clamp(photos.length || 1, 1, 4);
  const unit = Math.min(w, h), margin = Math.max(12, unit * 0.045);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, pal);

  const mastH = h * tpl.masthead, bannerH = Math.max(46, h * 0.072);
  const mastBox = { x: margin, y: margin, w: w - margin * 2, h: mastH };
  const bannerBox = { x: margin, y: h - margin - bannerH, w: w - margin * 2, h: bannerH };
  const bodyTop = margin + mastH + unit * 0.022;
  const body = { x: margin, y: bodyTop, w: w - margin * 2, h: Math.max(60, bannerBox.y - bodyTop - unit * 0.028) };

  const cells = splitCells(body, count, tpl.slant, Math.max(4, unit * 0.011));
  for (let i = 0; i < cells.length; i++) drawPanel(ctx, cells[i], photos[i], i, tpl, pal, unit);

  drawMasthead(ctx, mastBox, o, tpl, pal, count);
  drawBanner(ctx, bannerBox, tpl, pal, count);
  vignette(ctx, w, h, pal);
  scanlines(ctx, { x: 0, y: 0, w, h }, '#000000', Math.max(3, Math.round(unit / 240)), 0.1 * tpl.scan);

  // Thin credit line sitting inside the frame, just below the studio banner.
  const creditSize = clamp(unit * 0.009, 7, 13);
  const creditInset = Math.max(6, unit * 0.016) + creditSize * 1.6;
  ctx.save();
  ctx.font = monoFont(creditSize);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(pal.ink, 0.4);
  const credit = String(tpl.studio || 'STUDIO').toUpperCase() + ' \u00b7 ' + tpl.name + ' \u00b7 COVER ART MAKER';
  ctx.fillText(ellipsize(ctx, credit, w - margin * 2), w / 2, h - creditInset);
  ctx.restore();

  drawVignette(ctx, w, h, 0.4);
  drawBorder(ctx, w, h, pal);
  ctx.restore();
}