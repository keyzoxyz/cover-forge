/** Sample photos for the cover-art maker: a night boulevard and a sunset
 * pier, painted with canvas 2D and returned as data-URL image records. */
const TAU = Math.PI * 2;
const SIZE = { width: 1200, height: 800 };

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surfaceFor(canvas, width, height) {
  const surface = canvas && canvas.getContext ? canvas : document.createElement('canvas');
  surface.width = width; surface.height = height;
  return { surface, ctx: surface.getContext('2d') };
}

const fill = (ctx, x, y, w, h, s) => { ctx.fillStyle = s; ctx.fillRect(x, y, w, h); };
const dot = (ctx, x, y, r, s) => { ctx.fillStyle = s; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const polygon = (ctx, pts, s) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = s; ctx.fill(); };
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const radial = (ctx, x, y, r, inner, outer) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, outer); return g; };
const glow = (ctx, x, y, r, inner, outer) => { ctx.fillStyle = radial(ctx, x, y, r, inner, outer); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

function paintNightCity(ctx, w, h) {
  const rand = seeded(0x51ce77), u = h / 800, horizon = h * 0.64;
  const vx = w * 0.52, halfTop = 10 * u, lb = w * 0.24, rb = w * 0.8;
  fill(ctx, 0, 0, w, horizon, lin(ctx, 0, 0, 0, horizon, [[0, '#03040c'], [0.55, '#0c1230'], [1, '#42224d']]));
  fill(ctx, 0, h * 0.14, w, horizon - h * 0.14, radial(ctx, vx, horizon, w * 0.6, 'rgba(255,124,86,0.26)', 'rgba(255,124,86,0)'));
  for (let i = 0; i < 150; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.7;
    dot(ctx, rand() * w, rand() * horizon * 0.72, (0.5 + rand() * 1.1) * u, rand() > 0.82 ? '#ffd9b0' : '#dfe9ff');
  }
  ctx.globalAlpha = 1;
  const mx = w * 0.79, my = h * 0.15, mr = 22 * u;
  glow(ctx, mx, my, mr * 6, 'rgba(214,230,255,0.35)', 'rgba(214,230,255,0)');
  dot(ctx, mx, my, mr, '#f2f5ff'); dot(ctx, mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 'rgba(180,195,225,0.35)');
  dot(ctx, mx + mr * 0.35, my + mr * 0.3, mr * 0.16, 'rgba(180,195,225,0.35)');
  for (let x = -30 * u; x < w + 30 * u; x += (60 + rand() * 140) * u + 4 * u) {
    const bh = (46 + rand() * 120) * u;
    fill(ctx, x, horizon - bh, (60 + rand() * 140) * u, bh, '#070a18');
  }
  const lit = ['#ffd9a0', '#ffc76f', '#ffb45e', '#f7e6c2', '#9fd6ff'];
  for (let x = -50 * u; x < w + 50 * u; ) {
    const bw = (64 + rand() * 110) * u, bh = (110 + rand() * 220) * u, top = horizon - bh, tone = (7 + rand() * 9) | 0;
    fill(ctx, x, top, bw, bh, `rgb(${tone},${tone + 2},${tone + 10})`);
    fill(ctx, x, top, bw, 2 * u, 'rgba(255,168,120,0.12)');
    if (rand() > 0.55) {
      const ax = x + bw * (0.3 + rand() * 0.4);
      fill(ctx, ax, top - 18 * u, 2 * u, 18 * u, '#0a0d1c'); dot(ctx, ax, top - 18 * u, 2 * u, '#ff4d4d');
    }
    const cols = Math.max(2, (bw / (17 * u)) | 0), rows = Math.max(3, (bh / (26 * u)) | 0);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if (rand() < 0.42) continue;
      ctx.globalAlpha = 0.45 + rand() * 0.55;
      fill(ctx, x + (8 + c * 17) * u, top + (12 + r * 26) * u, 8 * u, 12 * u, lit[(rand() * lit.length) | 0]);
    }
    ctx.globalAlpha = 1; x += bw + 6 * u;
  }
  const asphalt = lin(ctx, 0, horizon, 0, h, [[0, '#131627'], [1, '#05060d']]);
  polygon(ctx, [[vx - halfTop, horizon], [vx + halfTop, horizon], [rb, h], [lb, h]], asphalt);
  polygon(ctx, [[lb - 60 * u, h], [vx - halfTop * 1.6, horizon], [vx - halfTop, horizon], [lb, h]], '#0b0d18');
  polygon(ctx, [[rb, h], [vx + halfTop, horizon], [vx + halfTop * 1.6, horizon], [rb + 60 * u, h]], '#0b0d18');
  const laneY = (t) => horizon + (h - horizon) * Math.pow(t, 1.7);
  for (let t = 0.03; t < 1; t += 0.075) {
    const y0 = laneY(t), y1 = laneY(t + 0.042), spread = (y0 - horizon) / (h - horizon);
    fill(ctx, vx - (0.6 + 2.2 * spread) * u, y0, (1.2 + 4.4 * spread) * u, y1 - y0, 'rgba(255,214,150,0.75)');
  }
  for (const side of [-1, 1]) for (let t = 0.14; t < 1; t += 0.17) {
    const f = Math.pow(t, 1.6), topX = vx + side * halfTop * 2.2, botX = side < 0 ? lb - 6 * u : rb + 6 * u;
    const px = topX + (botX - topX) * f, py = horizon + (h - horizon) * f;
    const ph = (24 + 120 * Math.pow(t, 1.4)) * u, lr = 26 * u * t + 6 * u;
    fill(ctx, px - 1.5 * u, py - ph, 3 * u, ph, '#07080f');
    glow(ctx, px, py - ph, lr, 'rgba(255,206,138,0.55)', 'rgba(255,150,70,0)');
    dot(ctx, px, py - ph, 2.4 * u, '#ffe2ae');
    fill(ctx, px - 2 * u, py, 4 * u, ph * 0.9, 'rgba(255,170,90,0.05)');
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const y = h * (0.8 + rand() * 0.17), x = w * (0.27 + rand() * 0.46);
    ctx.fillStyle = rand() > 0.4 ? 'rgba(255,238,200,0.55)' : 'rgba(255,74,58,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, (30 + rand() * 110) * u * (y / h), (2.5 + rand() * 4) * u, 0, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintPierSunset(ctx, w, h) {
  const rand = seeded(0x9e11a), u = h / 800, horizon = h * 0.57;
  fill(ctx, 0, 0, w, horizon, lin(ctx, 0, 0, 0, horizon, [[0, '#140e2e'], [0.32, '#4a1f52'], [0.58, '#9c3a58'], [0.78, '#e4674a'], [1, '#ffd693']]));
  const sx = w * 0.64, sy = horizon - 6 * u, sr = 62 * u;
  glow(ctx, sx, sy, sr * 4.2, 'rgba(255,226,150,0.75)', 'rgba(255,120,60,0)');
  const sun = lin(ctx, 0, sy - sr, 0, sy + sr, [[0, '#fffbe0'], [0.55, '#ffd27a'], [1, '#ff9147']]);
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const cx = rand() * w, cy = h * 0.1 + rand() * h * 0.36;
    const cw = (120 + rand() * 260) * u, ch = (7 + rand() * 16) * u, a = 0.16 + rand() * 0.3;
    ctx.fillStyle = `rgba(46,18,52,${a})`; ctx.beginPath(); ctx.ellipse(cx, cy, cw, ch, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,150,90,${a * 0.8})`; ctx.beginPath();
    ctx.ellipse(cx, cy + ch * 0.9, cw * 0.75, ch * 0.32, 0, 0, TAU); ctx.fill();
  }
  fill(ctx, 0, horizon, w, h - horizon, lin(ctx, 0, horizon, 0, h, [[0, '#d9835a'], [0.18, '#7a3a52'], [0.55, '#331b3c'], [1, '#100b22']]));
  for (let y = horizon + 3 * u; y < h; y += 5 * u) {
    const d = (y - horizon) / (h - horizon), spread = w * (0.02 + d * 0.16);
    for (let i = 0, n = 2 + ((rand() * 4) | 0); i < n; i++) {
      const len = (6 + rand() * 40) * u * (0.4 + d);
      ctx.globalAlpha = (0.15 + rand() * 0.5) * (1 - d * 0.45);
      fill(ctx, sx + (rand() * 2 - 1) * spread - len / 2, y, len, (1 + rand() * 1.6) * u, rand() > 0.3 ? '#ffd08a' : '#ffab63');
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.08 + rand() * 0.18;
    fill(ctx, rand() * w, horizon + (h - horizon) * rand(), (20 + rand() * 90) * u, 1.4 * u, '#ffd9a8');
  }
  ctx.globalAlpha = 1;
  const lN = [-0.06 * w, h * 1.02], lF = [0.1 * w, horizon + 4 * u];
  const rN = [0.66 * w, h * 1.02], rF = [0.21 * w, horizon + 6 * u];
  const lerp = (a, b, t) => a + (b - a) * t;
  const leftAt = (t) => [lerp(lN[0], lF[0], t), lerp(lN[1], lF[1], t)];
  const rightAt = (t) => [lerp(rN[0], rF[0], t), lerp(rN[1], rF[1], t)];
  polygon(ctx, [lN, lF, rF, rN], '#0d0916');
  for (let t = 0.08; t < 1; t += 0.085) {
    const [lx, ly] = leftAt(t), [rx, ry] = rightAt(t);
    ctx.strokeStyle = 'rgba(255,178,120,0.13)'; ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
  }
  for (let t = 0.1; t < 1; t += 0.16) {
    const ph = (10 + 110 * Math.pow(t, 1.5)) * u;
    for (const [px, py] of [leftAt(t), rightAt(t)]) {
      fill(ctx, px - 3 * u, py - ph, 6 * u, ph, '#08060f');
      fill(ctx, px - 3 * u, py, 6 * u, ph * 1.8, 'rgba(8,6,15,0.45)');
    }
    const [lx, ly] = leftAt(t), [rx, ry] = rightAt(t);
    ctx.strokeStyle = 'rgba(10,7,17,0.9)'; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.moveTo(lx, ly - ph); ctx.lineTo(rx, ry - ph); ctx.stroke();
  }
  for (const t of [0.32, 0.62]) {
    const [px, py] = rightAt(t);
    const ph = (10 + 110 * Math.pow(t, 1.5)) * u + 34 * u;
    fill(ctx, px - 1.6 * u, py - ph, 3.2 * u, ph, '#08060f');
    glow(ctx, px, py - ph, 20 * u, 'rgba(255,220,150,0.7)', 'rgba(255,150,70,0)');
    dot(ctx, px, py - ph, 2.2 * u, '#fff0c8');
  }
  for (const [bx, by, bs] of [[0.3, 0.2, 1], [0.36, 0.16, 0.8], [0.73, 0.26, 0.9]]) {
    ctx.strokeStyle = 'rgba(30,12,36,0.8)'; ctx.lineWidth = 1.5 * u;
    ctx.beginPath(); ctx.moveTo(bx * w - 8 * u * bs, by * h);
    ctx.quadraticCurveTo(bx * w, by * h - 6 * u * bs, bx * w + 8 * u * bs, by * h);
    ctx.stroke();
  }
}

async function asImage(src) {
  if (typeof Image !== 'function') return null;
  const img = new Image();
  img.src = src;
  if (typeof img.decode === 'function') {
    try { await img.decode(); } catch { /* element is still usable */ }
  }
  return img;
}

export async function buildSamples(canvas, drawCover) {
  const scenes = [
    { id: 'night-city', label: 'Night boulevard', paint: paintNightCity,
      alt: 'A night city boulevard lined with lit windows and amber streetlights' },
    { id: 'pier-sunset', label: 'Pier at sunset', paint: paintPierSunset,
      alt: 'A wooden pier silhouetted against an orange sunset over a glittering sea' },
  ];
  const { surface, ctx } = surfaceFor(canvas, SIZE.width, SIZE.height);
  const samples = [];
  for (const scene of scenes) {
    surface.width = SIZE.width; surface.height = SIZE.height;
    ctx.save(); scene.paint(ctx, SIZE.width, SIZE.height);
    if (typeof drawCover === 'function') {
      const meta = { id: scene.id, width: SIZE.width, height: SIZE.height, sample: true };
      try {
        if (drawCover.length >= 3) drawCover(ctx, SIZE.width, SIZE.height);
        else drawCover(ctx, meta);
      } catch { /* optional hook must not break the samples */ }
    }
    ctx.restore();
    const src = surface.toDataURL('image/png');
    samples.push({ id: scene.id, label: scene.label, alt: scene.alt,
      width: SIZE.width, height: SIZE.height, aspect: SIZE.width / SIZE.height,
      src, url: src, image: await asImage(src) });
  }
  return samples;
}