// Cover art engine — GTA-6-style multi-panel poster. Pure canvas 2D.
// No DOM, no network, no external fonts (generic families only).

export const TEMPLATES = {
  street: { name: 'street', border: 6, masthead: 0.16, banner: 0.10, slant: 0.22, captionSize: 0.028, captionAlign: 'left', uppercase: true, panelGap: 5 },
  gloss:  { name: 'gloss',  border: 10, masthead: 0.18, banner: 0.12, slant: 0.10, captionSize: 0.030, captionAlign: 'center', uppercase: true, panelGap: 10 },
  zine:   { name: 'zine',   border: 3, masthead: 0.20, banner: 0.08, slant: 0.30, captionSize: 0.024, captionAlign: 'right', uppercase: false, panelGap: 2 },
};

export const PALETTES = {
  neon:   { bg: '#0e0b1a', ink: '#f6f1ff', accent: '#ff2e88', accent2: '#00e5ff' },
  sunset: { bg: '#2a1030', ink: '#fff3e0', accent: '#ff6b35', accent2: '#ffd23f' },
  acid:   { bg: '#101403', ink: '#f4ffd6', accent: '#b6ff00', accent2: '#00ffa3' },
  mono:   { bg: '#111111', ink: '#f2f2f2', accent: '#ffffff', accent2: '#9a9a9a' },
};

// ---------- primitives ----------

function rnd(seed) { // deterministic LCG so output is stable per size
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function fitFont(ctx, text, family, weight, maxW, maxH) {
  let size = Math.max(8, Math.floor(maxH));
  for (let i = 0; i < 40; i++) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW || size <= 8) break;
    size -= Math.max(1, Math.floor(size * 0.06));
  }
  return size;
}

function halftone(ctx, x, y, w, h, color, cell, r0, r1, opacity) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  const cols = Math.max(1, Math.ceil(w / cell)), rows = Math.max(1, Math.ceil(h / cell));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const t = (i + j) / Math.max(1, cols + rows - 2), r = r0 + (r1 - r0) * t;
    if (r <= 0.2) continue;
    ctx.beginPath();
    ctx.arc(x + i * cell + cell / 2, y + j * cell + cell / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function scanlines(ctx, x, y, w, h, color, step, alpha) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let yy = y; yy < y + h; yy += step) ctx.fillRect(x, Math.round(yy), w, Math.max(1, Math.floor(step / 2)));
  ctx.restore();
}

function vignette(ctx, x, y, w, h, color) {
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.30, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawVignette(ctx, w, h, strength) { // darkens the corners with a radial falloff
  const raw = strength == null ? 1 : Number(strength);
  const s = Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 1));
  if (s <= 0 || w <= 0 || h <= 0) return;
  const cx = w / 2, cy = h / 2;
  const inner = Math.min(w, h) * 0.34;
  const outer = Math.hypot(cx, cy); // radius that reaches the corners
  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.65, `rgba(0,0,0,${(0.45 * s).toFixed(3)})`);
  g.addColorStop(1, `rgba(0,0,0,${(0.88 * s).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function coverDraw(ctx, img, x, y, w, h) { // object-fit: cover, tolerating missing natural sizes
  let iw = (img && (img.naturalWidth || img.width)) || w;
  let ih = (img && (img.naturalHeight || img.height)) || h;
  if (!iw || !ih) { iw = w; ih = h; }
  const s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
  try { ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h); }
  catch (e) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y, w, h); }
}

function slantPath(ctx, x, y, w, h, lean) { // parallelogram leaning right at the top
  const off = Math.round(lean * w);
  ctx.beginPath();
  ctx.moveTo(x + off, y); ctx.lineTo(x + w + off, y);
  ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  ctx.closePath();
  return off;
}

function clipText(ctx, text, maxW) {
  let t = text;
  if (ctx.measureText(t).width > maxW) {
    while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    t += '…';
  }
  return t;
}

// ---------- layout ----------

function layoutPanels(n, x, y, w, h, tpl) {
  const gap = tpl.panelGap;
  if (n <= 1) return [{ x, y, w, h }];
  if (n === 2) { // wide top, short bottom
    const topH = Math.round((h - gap) * 0.62);
    return [{ x, y, w, h: topH }, { x, y: y + topH + gap, w, h: h - topH - gap }];
  }
  if (n === 3) { // tall left, right column split
    const colW = Math.round((w - gap) * 0.58), rightX = x + colW + gap, rightW = w - colW - gap;
    const halfH = Math.round((h - gap) / 2);
    return [{ x, y, w: colW, h }, { x: rightX, y, w: rightW, h: halfH },
            { x: rightX, y: y + halfH + gap, w: rightW, h: h - halfH - gap }];
  }
  const cw = Math.round((w - gap) / 2), ch = Math.round((h - gap) / 2); // 4: 2x2
  return [{ x, y, w: cw, h: ch }, { x: x + cw + gap, y, w: w - cw - gap, h: ch },
          { x, y: y + ch + gap, w: cw, h: h - ch - gap },
          { x: x + cw + gap, y: y + ch + gap, w: w - cw - gap, h: h - ch - gap }];
}

// ---------- main ----------

export function drawCover(ctx, opts) {
  if (ctx && typeof ctx.getContext === 'function') ctx = ctx.getContext('2d');
  const o = opts || {};
  const width = o.width || 1080, height = o.height || 1350;
  const photos = Array.isArray(o.photos) ? o.photos.filter(Boolean).slice(0, 4) : [];
  const tpl = TEMPLATES[o.template] || TEMPLATES.street;
  const pal = o.palette || PALETTES.neon;
  const n = photos.length;
  const title = String(o.title || 'UNTITLED');
  const rand = rnd(1337 + width * 7 + height * 3 + n * 101);

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, pal.bg);
  bgGrad.addColorStop(1, '#050509');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const pad = tpl.border, innerW = width - pad * 2, innerH = height - pad * 2;
  const mastH = Math.round(innerH * tpl.masthead), bannerH = Math.round(innerH * tpl.banner);
  const mastY = pad, bannerY = height - pad - bannerH;
  const bodyY = mastY + mastH + tpl.panelGap;
  const bodyH = bannerY - bodyY - tpl.panelGap;
  const bodyX = pad, bodyW = innerW;
  const lean = tpl.slant * mastH * 0.5;

  // ---- masthead band ----
  ctx.save();
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(pad + lean, mastY); ctx.lineTo(pad + innerW, mastY);
  ctx.lineTo(pad + innerW - lean, mastY + mastH); ctx.lineTo(pad, mastY + mastH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.accent2;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(pad, mastY + mastH - 6, innerW, 6);
  ctx.restore();

  if (title) { // auto-fit title, chunky shadow pass
    ctx.save();
    const fam = tpl.name === 'zine' ? 'Georgia, serif' : 'Impact, "Arial Black", sans-serif';
    const size = fitFont(ctx, title, fam, '900', innerW * 0.90, mastH * 0.62);
    ctx.font = `900 ${size}px ${fam}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(title, width / 2 + size * 0.05, mastY + mastH / 2 + size * 0.06);
    ctx.fillStyle = pal.ink;
    ctx.fillText(title, width / 2, mastY + mastH / 2);
    ctx.restore();
  }

  // ---- panels + caption strips ----
  const boxes = layoutPanels(n, bodyX, bodyY, bodyW, bodyH, tpl);
  const capStrip = n ? Math.min(Math.round(tpl.captionSize * height * 1.6), Math.round(bodyH * 0.18)) : 0;

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i], photo = photos[i] || photos[photos.length - 1];
    const picH = Math.max(20, b.h - capStrip - 4);

    ctx.save();
    slantPath(ctx, b.x, b.y, b.w, picH, tpl.slant);
    ctx.clip();
    if (photo && photo.image) coverDraw(ctx, photo.image, b.x - 6, b.y - 6, b.w + 12, picH + 12);
    else { // gradient placeholder panel
      const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + picH);
      g.addColorStop(0, pal.accent2);
      g.addColorStop(1, pal.accent);
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, picH);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x, b.y, b.w, picH);
    }
    vignette(ctx, b.x - 4, b.y - 4, b.w + 8, picH + 8, 'rgba(0,0,0,0.62)');
    halftone(ctx, b.x, b.y + picH * 0.55, b.w, picH * 0.45, pal.ink, Math.max(6, Math.round(width / 90)), 0.3, 2.4, 0.16);
    scanlines(ctx, b.x, b.y, b.w, picH, '#000000', 4, 0.10);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = i % 2 ? pal.accent2 : pal.accent;
    ctx.fillRect(b.x, b.y, Math.max(3, Math.round(width * 0.004)), picH);
    ctx.restore();

    if (capStrip > 0) { // caption strip under the panel
      const capY = b.y + picH + 4;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(b.x, capY, b.w, capStrip);
      ctx.fillStyle = i % 2 ? pal.accent2 : pal.accent;
      ctx.fillRect(b.x, capY, b.w, 2);
      const raw = (photo && photo.caption) || `PANEL ${i + 1}`;
      const txt = tpl.uppercase ? String(raw).toUpperCase() : String(raw);
      const fs = Math.max(9, Math.min(capStrip * 0.62, b.w * 0.075));
      ctx.font = `700 ${fs}px ${tpl.name === 'zine' ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'}`;
      ctx.fillStyle = pal.ink;
      ctx.textBaseline = 'middle';
      ctx.textAlign = tpl.captionAlign === 'center' ? 'center' : tpl.captionAlign === 'right' ? 'right' : 'left';
      const tx = tpl.captionAlign === 'center' ? b.x + b.w / 2 : tpl.captionAlign === 'right' ? b.x + b.w - 10 : b.x + 10;
      ctx.fillText(clipText(ctx, txt, b.w - 20), tx, capY + capStrip / 2 + 1);
      ctx.restore();
    }
  }

  // ---- bottom banner + studio line ----
  ctx.save();
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(pad, bannerY); ctx.lineTo(pad + innerW, bannerY);
  ctx.lineTo(pad + innerW - lean * 0.6, bannerY + bannerH); ctx.lineTo(pad, bannerY + bannerH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const sfam = 'Helvetica, Arial, sans-serif';
  ctx.save();
  ctx.font = `800 ${Math.max(9, Math.round(bannerH * 0.34))}px ${sfam}`;
  ctx.fillStyle = pal.bg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const studio = String(o.studio || o.studioLine || 'NOUS STUDIOS  •  A HERMES PICTURE  •  OUT NOW');
  ctx.fillText(clipText(ctx, studio, innerW * 0.86), width / 2, bannerY + bannerH / 2);

  const chipW = Math.round(innerW * 0.11), chipH = Math.round(bannerH * 0.52);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(pad + 12, bannerY + (bannerH - chipH) / 2, chipW, chipH);
  ctx.fillStyle = pal.accent;
  ctx.font = `900 ${Math.max(7, Math.round(chipH * 0.62))}px ${sfam}`;
  ctx.fillText('18+', pad + 12 + chipW / 2, bannerY + bannerH / 2 + 1);
  ctx.restore();

  // ---- global texture: halftone corners + scanlines + grain ----
  halftone(ctx, pad, bannerY - height * 0.10, innerW, height * 0.10, pal.accent2, Math.max(7, Math.round(width / 70)), 2.2, 0.2, 0.12);
  scanlines(ctx, pad, mastY, innerW, innerH, '#ffffff', 3, 0.035);
  ctx.save();
  ctx.fillStyle = pal.ink;
  const specks = Math.min(900, Math.round((width * height) / 2200));
  for (let i = 0; i < specks; i++) {
    ctx.globalAlpha = 0.02 + rand() * 0.05;
    ctx.fillRect(pad + rand() * innerW, pad + rand() * innerH, 1 + (rand() > 0.85 ? 1 : 0), 1);
  }
  ctx.restore();

  // ---- corner vignette: darken the edges last, under the border ----
  drawVignette(ctx, width, height, o.vignette == null ? 1 : o.vignette);

  // ---- thin credit line along the very bottom ----
  ctx.save();
  const cfs = Math.max(7, Math.round(bannerH * 0.17));
  ctx.font = `600 ${cfs}px ${sfam}`;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = pal.bg;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  const credit = String(o.credit || 'ART BY NOUS  •  COVER ENGINE');
  ctx.fillText(clipText(ctx, credit, innerW * 0.52), width - pad - Math.max(8, Math.round(pad * 1.2)), height - pad - Math.max(2, Math.round(bannerH * 0.08)));
  ctx.restore();

  // ---- double border ----
  ctx.save();
  const bw = Math.max(2, tpl.border);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = bw;
  ctx.strokeRect(bw / 2, bw / 2, width - bw, height - bw);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = Math.max(1, bw / 2);
  ctx.strokeRect(bw * 1.9, bw * 1.9, width - bw * 3.8, height - bw * 3.8);
  ctx.restore();

  ctx.restore();
}

export default drawCover;