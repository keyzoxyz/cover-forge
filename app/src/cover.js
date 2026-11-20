// cover.js — the painter. Deterministic, offline, canvas-only.
// drawCover(canvas, state) splits the poster into panels, cover-fits each photo,
// grades it per style, then lays the GTA-style caption block on top.

const GRADES = {
  sunset: {
    label: 'SUNSET',
    tint: ['rgba(255,176,84,0.62)', 'rgba(255,46,136,0.58)', 'rgba(94,26,120,0.5)'],
    accent: '#ffc94a',
    ink: '#fff2d8',
    shadow: '#ff2e88',
    sub: 'THE COAST IS YOURS',
  },
  neon: {
    label: 'NEON NIGHT',
    tint: ['rgba(18,10,64,0.72)', 'rgba(255,46,136,0.5)', 'rgba(33,224,200,0.52)'],
    accent: '#21e0c8',
    ink: '#eaf6ff',
    shadow: '#ff2e88',
    sub: 'AFTER MIDNIGHT',
  },
  gold: {
    label: 'GOLD HEIST',
    tint: ['rgba(64,38,8,0.6)', 'rgba(255,201,74,0.52)', 'rgba(120,74,18,0.55)'],
    accent: '#ffd76a',
    ink: '#fff6df',
    shadow: '#7a4a12',
    sub: 'ONE LAST SCORE',
  },
};

const LAYOUTS = ['grid', 'triptych', 'tall'];
const CAPTION_FAMILY = 'Lato, "Lato Black", Helvetica, Arial, sans-serif';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// cover-fit: crop to fill the rect, never distort
function fitRect(iw, ih, w, h) {
  if (!iw || !ih) return { sx: 0, sy: 0, sw: 1, sh: 1 };
  const target = w / h;
  const source = iw / ih;
  if (source > target) {
    const sw = ih * target;
    return { sx: (iw - sw) / 2, sy: 0, sw, sh: ih };
  }
  const sh = iw / target;
  return { sx: 0, sy: (ih - sh) * 0.42, sw: iw, sh };
}

function panelRects(layout, w, h, g) {
  const half = g / 2;
  if (layout === 'triptych') {
    const heroW = Math.round(w * 0.56) - half;
    const colX = heroW + g;
    const colW = w - colX;
    const topH = Math.round(h * 0.58) - half;
    const lowY = topH + g;
    const lowH = h - lowY;
    const lowW = Math.round((colW - g) / 2);
    return [
      { x: 0, y: 0, w: heroW, h },
      { x: colX, y: 0, w: colW, h: topH },
      { x: colX, y: lowY, w: lowW, h: lowH },
      { x: colX + lowW + g, y: lowY, w: colW - lowW - g, h: lowH },
    ];
  }
  if (layout === 'tall') {
    const heroH = Math.round(h * 0.6) - half;
    const lowY = heroH + g;
    const lowH = h - lowY;
    const cellW = Math.floor((w - g * 2) / 3);
    return [
      { x: 0, y: 0, w, h: heroH },
      { x: 0, y: lowY, w: cellW, h: lowH },
      { x: cellW + g, y: lowY, w: cellW, h: lowH },
      { x: (cellW + g) * 2, y: lowY, w: w - (cellW + g) * 2, h: lowH },
    ];
  }
  const cw = Math.round((w - g) / 2);
  const ch = Math.round((h - g) / 2);
  return [
    { x: 0, y: 0, w: cw, h: ch },
    { x: cw + g, y: 0, w: w - cw - g, h: ch },
    { x: 0, y: ch + g, w: cw, h: h - ch - g },
    { x: cw + g, y: ch + g, w: w - cw - g, h: h - ch - g },
  ];
}

function drawSlot(ctx, img, r, grade, idx) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  if (img && img.complete && img.naturalWidth) {
    const s = fitRect(img.naturalWidth, img.naturalHeight, r.w, r.h);
    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, r.x, r.y, r.w, r.h);
  } else {
    const flat = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    flat.addColorStop(0, '#151c46');
    flat.addColorStop(0.55, '#241a4d');
    flat.addColorStop(1, '#0d1230');
    ctx.fillStyle = flat;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(143,154,196,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2 - 18, r.y + r.h / 2);
    ctx.lineTo(r.x + r.w / 2 + 18, r.y + r.h / 2);
    ctx.moveTo(r.x + r.w / 2, r.y + r.h / 2 - 18);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h / 2 + 18);
    ctx.stroke();
  }

  // colour grade: gradients through composite modes
  const t = grade.tint;
  const lin = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.35, r.y + r.h);
  lin.addColorStop(0, t[0]);
  lin.addColorStop(0.52, t[1]);
  lin.addColorStop(1, t[2]);

  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = lin;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.34;
  const warm = ctx.createLinearGradient(r.x, r.y + r.h, r.x + r.w, r.y);
  warm.addColorStop(0, grade.accent);
  warm.addColorStop(1, 'rgba(10,14,53,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = 'rgba(200,120,180,1)';
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // per-panel vignette
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(
    r.x + r.w / 2, r.y + r.h * 0.46, Math.min(r.w, r.h) * 0.22,
    r.x + r.w / 2, r.y + r.h * 0.5, Math.max(r.w, r.h) * 0.78
  );
  vig.addColorStop(0, 'rgba(4,6,18,0)');
  vig.addColorStop(0.68, 'rgba(4,6,18,0.2)');
  vig.addColorStop(1, 'rgba(3,4,12,0.66)');
  ctx.fillStyle = vig;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  if (idx > 0) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(10,12,30,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
  ctx.restore();
}

function wrapLines(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.slice(0, maxLines);
}

function fitCaption(ctx, text, maxW, maxLines, start, min) {
  let size = start;
  for (;;) {
    ctx.font = `900 ${size}px ${CAPTION_FAMILY}`;
    let lines = wrapLines(ctx, text, maxW, maxLines);
    let widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
    // a single unbreakable word can still exceed the column: squeeze it to fit
    if (widest > maxW) {
      const squeeze = maxW / widest;
      if (squeeze > 0.55) {
        ctx.font = `900 ${size * squeeze}px ${CAPTION_FAMILY}`;
        const recheck = wrapLines(ctx, text, maxW, maxLines);
        const rw = recheck.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
        if (rw <= maxW) return { size: size * squeeze, lines: recheck, squeezed: true };
      }
    }
    const joined = lines.join(' ');
    const fitsAll = joined.replace(/\s+/g, ' ') === text.replace(/\s+/g, ' ');
    if (widest <= maxW && (fitsAll || lines.length === maxLines)) {
      return { size, lines };
    }
    if (size * 0.94 <= min) break; // never shrink below the floor
    size *= 0.94;
  }
  ctx.font = `900 ${min}px ${CAPTION_FAMILY}`;
  return { size: min, lines: wrapLines(ctx, text, maxW, maxLines) };
}

function drawCaption(ctx, state, grade, w, h, s) {
  const caption = (state.caption || 'COVER FORGE').toUpperCase().trim().replace(/\s+/g, ' ');
  if (!caption) return;
  const side = Math.round(w * 0.055);
  const maxW = w - side * 2;
  const maxLines = w > h ? 2 : 3;
  const fit = fitCaption(ctx, caption, maxW * 0.94, maxLines, Math.round(h * 0.135), Math.round(h * 0.045));
  const size = fit.size;
  const lead = size * 0.86;
  const blockH = fit.lines.length * lead;

  // scrim so type always reads over photography
  const scrim = ctx.createLinearGradient(0, h - blockH - size * 2.1, 0, h);
  scrim.addColorStop(0, 'rgba(6,8,22,0)');
  scrim.addColorStop(0.45, 'rgba(6,8,22,0.5)');
  scrim.addColorStop(1, 'rgba(4,6,16,0.86)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h - blockH - size * 2.1, w, blockH + size * 2.1);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const sub = (state.subline || grade.sub).toUpperCase().trim();
  const subSize = Math.max(11, Math.round(size * 0.2));
  const ruleY = h - Math.round(h * 0.055) - blockH - subSize * 2.5;
  const baseY = h - Math.round(h * 0.055) - subSize * 1.9;

  // thin rule above
  ctx.fillStyle = grade.accent;
  ctx.fillRect(side, ruleY, Math.round(size * 1.05), Math.max(2, Math.round(s * 3)));
  ctx.globalAlpha = 0.45;
  ctx.fillRect(side + Math.round(size * 1.05) + Math.round(s * 8), ruleY + Math.round(s * 1), Math.round(w * 0.16), Math.max(1, Math.round(s)));
  ctx.globalAlpha = 1;

  // kicker
  ctx.font = `700 ${Math.round(subSize * 0.86)}px ${CAPTION_FAMILY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(grade.label + ' · COVER SERIES', side, ruleY - Math.round(s * 12));

  // caption: offset shadow then face
  ctx.font = `900 ${size}px ${CAPTION_FAMILY}`;
  const dx = Math.round(size * 0.055);
  const dy = Math.round(size * 0.045);
  ctx.fillStyle = grade.shadow;
  fit.lines.forEach((line, i) => {
    ctx.fillText(line, side + dx, baseY - blockH + lead * (i + 0.82) + dy);
  });

  const face = ctx.createLinearGradient(0, baseY - blockH, 0, baseY);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(0.62, grade.ink);
  face.addColorStop(1, grade.tint[0]);
  ctx.fillStyle = face;
  fit.lines.forEach((line, i) => {
    ctx.fillText(line, side, baseY - blockH + lead * (i + 0.82));
  });

  // release-style sub-line below
  ctx.font = `700 ${subSize}px ${CAPTION_FAMILY}`;
  ctx.fillStyle = grade.accent;
  const spaced = sub.split('').join('\u200a');
  ctx.fillText(spaced, side, h - Math.round(h * 0.042));
  const tw = ctx.measureText(spaced).width;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `700 ${Math.round(subSize * 0.8)}px ${CAPTION_FAMILY}`;
  ctx.fillText('2026', side + tw + Math.round(s * 14), h - Math.round(h * 0.042));
  ctx.globalAlpha = 1;
}

function drawSprite(ctx, w, h, s, grade, rand) {
  // film grain + faint scanlines, seeded so exports are reproducible
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const dots = Math.round((w * h) / 2600);
  for (let i = 0; i < dots; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const a = 0.05 + rand() * 0.12;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = grade.accent;
  for (let y = 0; y < h; y += Math.max(3, Math.round(s * 4))) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

export function drawCover(canvas, state) {
  const w = Math.round(canvas.width);
  const h = Math.round(canvas.height);
  const ctx = canvas.getContext('2d');
  const s = Math.max(0.5, w / 1080);
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = LAYOUTS.includes(state.layout) ? state.layout : 'grid';
  const gap = Math.round(8 * s);
  const rand = rng(seedOf((state.caption || '') + layout + state.grade));

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#080b1c';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(layout, w, h, gap);
  rects.forEach((r, i) => drawSlot(ctx, (state.photos || [])[i] || null, r, grade, i));

  drawSprite(ctx, w, h, s, grade, rand);
  drawCaption(ctx, state, grade, w, h, s);

  // global vignette + 1px inner border
  const gv = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  gv.addColorStop(0, 'rgba(0,0,0,0)');
  gv.addColorStop(1, 'rgba(2,3,10,0.62)');
  ctx.fillStyle = gv;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  ctx.restore();
}

export { GRADES, LAYOUTS };