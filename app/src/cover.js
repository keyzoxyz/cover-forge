// GTA-6-style poster engine. Pure canvas 2D, no DOM, no network, no external fonts.
export const TEMPLATES = ['vice', 'miami', 'sunset'];
export const PALETTES = [
  { bg: '#0b0b1a', ink: '#f7f2e8', accent: '#ff2e88', accent2: '#00e5ff' },
  { bg: '#f5e6c8', ink: '#141210', accent: '#ff5a1f', accent2: '#1b3bd6' },
  { bg: '#101c14', ink: '#eaf6e2', accent: '#c6ff00', accent2: '#ff7bd5' },
  { bg: '#1b1226', ink: '#f0e9ff', accent: '#9d4dff', accent2: '#ffd166' }
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function rgb(hex) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };

function fitImage(ctx, image, x, y, w, h) {
  const iw = (image && (image.naturalWidth || image.width)) || 1;
  const ih = (image && (image.naturalHeight || image.height)) || 1;
  const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function panelLayout(count, w, top, bottom, slants) {
  const n = clamp(count, 1, 4), panels = [], bh = bottom - top;
  for (let i = 0; i < n; i++) {
    const x0 = (w * i) / n, x1 = (w * (i + 1)) / n;
    const lean = slants ? (i % 2 === 0 ? 1 : -1) * (bottom - top) * 0.035 : 0;
    const first = i === 0, last = i === n - 1;
    panels.push({
      i, lean, x0, x1, first, last,
      points: [[x0 + (first ? 0 : -lean), top], [x1 + (last ? 0 : lean), top],
               [x1 + (last ? 0 : -lean), top + bh], [x0 + (first ? 0 : lean), top + bh]]
    });
  }
  return panels;
}

function path(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function halftone(ctx, x, y, w, h, step, color, maxR) {
  ctx.save(); ctx.fillStyle = color;
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      const dx = (xx - x) / w, dy = (yy - y) / h;
      const r = maxR * (1 - Math.sqrt(dx * dx + dy * dy)) * (0.5 + 0.5 * Math.abs(Math.sin(xx * 0.7)));
      if (r > 0.35) {
        ctx.beginPath(); ctx.arc(xx + (step % 2 ? step / 2 : 0), yy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function scanlines(ctx, x, y, w, h, gap, alpha, color) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let yy = y; yy < y + h; yy += gap) ctx.fillRect(x, yy, w, Math.max(1, gap * 0.45));
  ctx.restore();
}

function masthead(ctx, o, w, h, bandH, pal, tpl) {
  ctx.save();
  ctx.fillStyle = pal.accent; ctx.fillRect(0, 0, w, bandH);
  ctx.globalAlpha = 0.18; ctx.fillStyle = pal.accent2;
  for (let i = -2; i < 8; i++) {
    const bx = (w / 7) * i;
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + w * 0.06, 0);
    ctx.lineTo(bx - w * 0.02, bandH); ctx.lineTo(bx - w * 0.08, bandH); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  scanlines(ctx, 0, 0, w, bandH, Math.max(3, h * 0.006), 0.14, pal.bg);

  const upper = String(o.title || 'UNTITLED').toUpperCase();
  let fs = bandH * (tpl === 'miami' ? 0.56 : 0.64);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const setFont = () => { ctx.font = `900 ${fs}px Impact, "Arial Black", sans-serif`; };
  setFont();
  let tw = ctx.measureText(upper).width;
  const maxW = w * 0.9;
  if (tw > maxW) { fs *= maxW / tw; setFont(); tw = ctx.measureText(upper).width; }

  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, fs * 0.055); ctx.strokeStyle = pal.bg;
  ctx.strokeText(upper, w / 2, bandH * 0.5);
  const g = ctx.createLinearGradient(0, bandH * 0.1, 0, bandH * 0.92);
  g.addColorStop(0, pal.ink); g.addColorStop(0.55, pal.ink); g.addColorStop(1, pal.accent2);
  ctx.fillStyle = g; ctx.fillText(upper, w / 2, bandH * 0.5);

  const tag = tpl === 'vice' ? 'A NEW CITY. A NEW CHAOS.' : tpl === 'miami' ? 'EVERYTHING IS PERSONAL' : 'THE HEAT NEVER LEFT';
  ctx.font = `700 ${Math.max(7, bandH * 0.11)}px "Courier New", monospace`;
  ctx.fillStyle = pal.bg; ctx.globalAlpha = 0.8;
  ctx.fillText(`★  ${tag}  ★`, w / 2, bandH * (tpl === 'miami' ? 0.84 : 0.86));
  ctx.restore();
}

function captionStrip(ctx, panel, photo, x, y, w, hBar, pal) {
  ctx.save(); path(ctx, panel.points); ctx.clip();
  ctx.fillStyle = pal.bg; ctx.fillRect(x, y, w, hBar + 2);
  ctx.globalAlpha = 0.16; ctx.fillStyle = pal.accent;
  for (let i = 0; i < 40; i++) ctx.fillRect(x + (i * 17) % w, y + ((i * 7) % hBar), 9, 1);
  ctx.globalAlpha = 1; ctx.fillStyle = pal.accent; ctx.fillRect(x, y, w, Math.max(1, hBar * 0.045));
  ctx.restore();

  const cap = String(photo.caption || '');
  if (!cap) return;
  let fs = hBar * 0.42, maxW = w * 0.86;
  ctx.save();
  ctx.font = `700 ${fs}px "Courier New", monospace`;
  const tw = ctx.measureText(cap).width;
  if (tw > maxW) { fs *= maxW / tw; ctx.font = `700 ${fs}px "Courier New", monospace`; }
  ctx.fillStyle = pal.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(cap, x + w * 0.07, y + hBar * 0.58);
  ctx.restore();
}

function banner(ctx, o, w, h, y, pal, tpl) {
  ctx.save();
  ctx.fillStyle = pal.ink; ctx.fillRect(0, y, w, h - y);
  ctx.fillStyle = pal.accent; ctx.fillRect(0, y, w, Math.max(2, h * 0.004));
  halftone(ctx, w * 0.62, y + (h - y) * 0.2, w * 0.36, (h - y) * 0.7,
    Math.max(6, w * 0.012), rgba(pal.accent2, 0.5), Math.max(1.2, w * 0.0032));

  const bh = h - y;
  const studio = String(o.studio || (tpl === 'miami' ? 'MIAMI VICE PICTURES' : 'LEONIDA FILMS'));
  const line = `${studio.toUpperCase()}  ·  ${o.year || new Date().getFullYear()}`;
  ctx.font = `900 ${Math.max(7, bh * 0.2)}px "Arial Black", Impact, sans-serif`;
  ctx.fillStyle = pal.bg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(line, w * 0.045, y + bh * 0.36);
  ctx.font = `700 ${Math.max(6, bh * 0.11)}px "Courier New", monospace`;
  ctx.globalAlpha = 0.62;
  ctx.fillText('RATED  M — MATURE  ·  SOME MATERIAL MAY BE INAPPROPRIATE', w * 0.045, y + bh * 0.7);
  ctx.globalAlpha = 1;

  const bw = bh * 0.44, bx = w - bw - w * 0.045, by = y + bh * 0.28;
  ctx.strokeStyle = pal.bg; ctx.lineWidth = Math.max(1.5, bw * 0.06); ctx.strokeRect(bx, by, bw, bw);
  ctx.fillStyle = pal.bg; ctx.font = `900 ${bw * 0.62}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center'; ctx.fillText('M', bx + bw / 2, by + bw * 0.54);
  ctx.restore();
}

function border(ctx, w, h, pal) {
  const m = Math.max(3, Math.min(w, h) * 0.018);
  ctx.save();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = m;
  ctx.strokeRect(m / 2, m / 2, w - m, h - m);
  ctx.globalAlpha = 0.55; ctx.strokeStyle = pal.accent2; ctx.lineWidth = Math.max(1, m * 0.4);
  const i2 = m * 2.1;
  ctx.strokeRect(i2, i2, w - i2 * 2, h - i2 * 2);
  ctx.globalAlpha = 1; ctx.strokeStyle = pal.accent; ctx.lineWidth = Math.max(1, m * 0.5);
  const L = m * 3;
  for (const [cx, cy] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
    ctx.beginPath();
    ctx.moveTo(cx - L / 2, cy); ctx.lineTo(cx + L / 2, cy);
    ctx.moveTo(cx, cy - L / 2); ctx.lineTo(cx, cy + L / 2); ctx.stroke();
  }
  ctx.restore();
}

function drawVignette(ctx, w, h, strength) {
  const s = clamp(typeof strength === 'number' ? strength : 0.42, 0, 1);
  const cx = w / 2, cy = h / 2;
  const inner = Math.min(w, h) * 0.26;
  const outer = Math.sqrt(cx * cx + cy * cy) * 1.05;
  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, `rgba(0,0,0,${(s * 0.28).toFixed(3)})`);
  g.addColorStop(1, `rgba(0,0,0,${s.toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function creditLine(ctx, o, w, h, pal) {
  const studio = String(o.studio || 'LEONIDA FILMS').toUpperCase();
  const text = String(o.credit || `COVER ART  ·  ${studio}  ·  ${o.year || new Date().getFullYear()}`);
  const fs = Math.max(6, Math.min(w, h) * 0.0105);
  ctx.save();
  ctx.font = `400 ${fs}px "Courier New", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pal.bg;
  ctx.fillText(text, w / 2, h - Math.max(4, Math.min(w, h) * 0.011));
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawCover(target, opts) {
  const o = opts || {};
  const ctx = (target && typeof target.getContext === 'function') ? target.getContext('2d') : target;
  if (!ctx) throw new Error('drawCover: no 2D context');

  const w = Math.max(1, Math.round(o.width || 1000));
  const h = Math.max(1, Math.round(o.height || 1500));
  const tpl = TEMPLATES.indexOf(o.template) >= 0 ? o.template : TEMPLATES[0];
  const pal = o.palette || PALETTES[0];
  const photos = (Array.isArray(o.photos) ? o.photos : []).filter(p => p && p.image).slice(0, 4);
  const n = photos.length;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h);
  halftone(ctx, w * 0.02, h * 0.02, w * 0.5, h * 0.5, Math.max(8, w * 0.022), rgba(pal.accent, 0.16), Math.max(1, w * 0.004));
  halftone(ctx, w * 0.5, h * 0.45, w * 0.48, h * 0.4, Math.max(8, w * 0.022), rgba(pal.accent2, 0.14), Math.max(1, w * 0.004));

  const bandH = h * (tpl === 'miami' ? 0.2 : tpl === 'sunset' ? 0.17 : 0.19);
  const bannerY = h - h * 0.095;
  const gridTop = bandH, gridBottom = bannerY;
  const capH = (gridBottom - gridTop) * (n <= 2 ? 0.11 : 0.13);
  ctx.fillStyle = pal.accent2;
  ctx.fillRect(0, bandH - Math.max(2, h * 0.004), w, Math.max(2, h * 0.004));

  if (!n) {
    ctx.save();
    ctx.fillStyle = rgba(pal.accent, 0.5);
    ctx.font = `900 ${(gridBottom - gridTop) * 0.22}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NO SIGNAL', w / 2, (gridTop + gridBottom) / 2);
    ctx.restore();
    scanlines(ctx, 0, gridTop, w, gridBottom - gridTop, Math.max(3, h * 0.005), 0.2, pal.accent2);
  } else {
    const panels = panelLayout(n, w, gridTop, gridBottom - capH, tpl !== 'miami');
    for (let i = 0; i < n; i++) {
      const p = panels[i], photo = photos[i], pw = p.x1 - p.x0, ph = gridBottom - capH - gridTop;
      ctx.save(); path(ctx, p.points); ctx.fillStyle = pal.bg; ctx.fill(); ctx.clip();
      fitImage(ctx, photo.image, p.x0 - Math.abs(p.lean) - 2, gridTop, pw + Math.abs(p.lean) * 2 + 4, ph);
      ctx.globalAlpha = 0.16; ctx.fillStyle = i % 2 === 0 ? pal.accent : pal.accent2;
      ctx.fillRect(p.x0 - 4, gridTop, pw + 8, ph);
      ctx.globalAlpha = 1;
      scanlines(ctx, p.x0 - 4, gridTop, pw + 8, ph, Math.max(3, h * 0.0035), 0.1, '#000');
      const shade = ctx.createLinearGradient(0, gridBottom - capH * 3.4, 0, gridBottom - capH);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = shade; ctx.fillRect(p.x0 - 4, gridBottom - capH * 3.4, pw + 8, capH * 2.4);
      ctx.restore();

      if (!p.last) {
        ctx.save();
        ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(2, w * 0.004);
        ctx.beginPath(); ctx.moveTo(p.x1 + p.lean, gridTop); ctx.lineTo(p.x1 - p.lean, gridTop + ph); ctx.stroke();
        ctx.strokeStyle = pal.accent; ctx.lineWidth = Math.max(1, w * 0.0016);
        ctx.beginPath(); ctx.moveTo(p.x1 + p.lean + w * 0.006, gridTop); ctx.lineTo(p.x1 - p.lean + w * 0.006, gridTop + ph); ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = rgba(pal.bg, 0.75);
      ctx.fillRect(p.x0 + w * 0.012, gridTop + w * 0.012, w * 0.055, w * 0.038);
      ctx.fillStyle = pal.accent2; ctx.font = `900 ${w * 0.024}px "Courier New", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1).padStart(2, '0'), p.x0 + w * 0.0395, gridTop + w * 0.031);
      ctx.restore();

      captionStrip(ctx, p, photo, p.x0 - Math.abs(p.lean), gridBottom - capH, pw + Math.abs(p.lean) * 2, capH, pal);
    }
  }

  masthead(ctx, o, w, h, bandH, pal, tpl);
  banner(ctx, o, w, h, bannerY, pal, tpl);
  drawVignette(ctx, w, h, o.vignette);
  border(ctx, w, h, pal);
  creditLine(ctx, o, w, h, pal);
  ctx.restore();
}

export default drawCover;