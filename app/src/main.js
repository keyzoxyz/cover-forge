// main.js — state, wiring, render loop, export.
import { drawCover } from './cover.js';
import { runShot } from './shots.js';

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const SAMPLES = {
  pier: './samples/pier.jpg',
  boulevard: './samples/boulevard.jpg',
};

const state = {
  photos: [null, null, null, null],
  caption: 'SUNSET HEIST',
  subline: '',
  grade: 'sunset',
  layout: 'grid',
  size: '1080x1080',
  dirty: true,
};

const $ = (sel) => document.querySelector(sel);
const canvas = $('#poster');
const stageLabel = $('#stageLabel');
const dimsChip = $('#dims');
const stageRight = $('#stageRight');
const statusEl = $('#status');
const captionInput = $('#caption');
const sublineInput = $('#subline');
const countEl = $('#captionCount');
const slots = Array.from(document.querySelectorAll('.slot'));
const blobs = [null, null, null, null];

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.classList.remove('ok', 'warn', 'err');
  if (kind) statusEl.classList.add(kind);
}

function resizeCanvas() {
  const [w, h] = SIZES[state.size] || SIZES['1080x1080'];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  dimsChip.textContent = `${w} × ${h}`;
  stageRight.textContent = `${w} × ${h}`;
}

function updateStageLabel() {
  const layoutName = { grid: 'CLASSIC GRID', triptych: 'TRIPTYCH', tall: 'TALL POSTER' }[state.layout] || 'CLASSIC GRID';
  const gradeName = { sunset: 'SUNSET', neon: 'NEON NIGHT', gold: 'GOLD HEIST' }[state.grade] || 'SUNSET';
  stageLabel.textContent = `PREVIEW · ${gradeName} · ${layoutName}`;
}

function render() {
  if (state.dirty) {
    state.dirty = false;
    resizeCanvas();
    updateStageLabel();
    drawCover(canvas, state);
  }
  requestAnimationFrame(render);
}

function invalidate() {
  state.dirty = true;
}

// ---- photos ----
function clearPhoto(i) {
  if (blobs[i]) {
    URL.revokeObjectURL(blobs[i]);
    blobs[i] = null;
  }
  state.photos[i] = null;
  slots[i].classList.remove('has-photo');
  slots[i].querySelector('img').removeAttribute('src');
  slots[i].querySelector('input').value = '';
  invalidate();
}

function setPhoto(i, src, isBlob) {
  if (blobs[i]) {
    URL.revokeObjectURL(blobs[i]);
    blobs[i] = null;
  }
  if (!src) {
    clearPhoto(i);
    return;
  }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => invalidate();
  img.src = src;
  state.photos[i] = img;
  slots[i].classList.add('has-photo');
  slots[i].querySelector('img').src = src;
  if (isBlob) blobs[i] = src;
  invalidate();
}

slots.forEach((slot, i) => {
  slot.querySelector('input').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('That file is not an image', 'warn');
      return;
    }
    setPhoto(i, URL.createObjectURL(file), true);
    setStatus(`Panel ${i + 1}: ${file.name}`, 'ok');
  });
});

$('#samples').addEventListener('click', () => {
  setPhoto(0, SAMPLES.pier);
  setPhoto(1, SAMPLES.boulevard);
  setPhoto(2, SAMPLES.boulevard);
  setPhoto(3, SAMPLES.pier);
  setStatus('Sample photos loaded', 'ok');
});

$('#clear').addEventListener('click', () => {
  for (let i = 0; i < 4; i += 1) clearPhoto(i);
  setStatus('Panels cleared — add your own photos');
});

// ---- text + pickers ----
captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  countEl.textContent = `${captionInput.value.length} / 64`;
  invalidate();
});

sublineInput.addEventListener('input', () => {
  state.subline = sublineInput.value;
  invalidate();
});

['grade', 'layout', 'size'].forEach((name) => {
  document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state[name] = radio.value;
      invalidate();
    });
  });
});

// ---- export ----
$('#export').addEventListener('click', async () => {
  const btn = $('#export');
  btn.disabled = true;
  setStatus('Painting full-size export…', 'warn');
  try {
    const [w, h] = SIZES[state.size] || SIZES['1080x1080'];
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    drawCover(out, state);
    const blob = await new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
    });
    const url = URL.createObjectURL(blob);
    $('#exportImg').src = url;
    const link = $('#download');
    link.href = url;
    link.download = `cover-forge-${w}x${h}.png`;
    $('#exportInfo').textContent = `cover-forge-${w}x${h}.png · ${(blob.size / 1024).toFixed(0)} KiB`;
    $('#exportView').hidden = false;
    setStatus(`Exported ${w}×${h} PNG`, 'ok');
  } catch (err) {
    setStatus(`Export failed: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#back').addEventListener('click', () => {
  $('#exportView').hidden = true;
});

// ---- fonts: real FontFace loads from app/fonts, relative URLs ----
async function loadFonts() {
  const faces = [
    new FontFace('Lato', 'url(./fonts/Lato-Black.ttf)', { weight: '900', style: 'normal' }),
    new FontFace('Lato', 'url(./fonts/Lato-Bold.ttf)', { weight: '700', style: 'normal' }),
    new FontFace('Lato Black', 'url(./fonts/Lato-Black.ttf)', { weight: '400', style: 'normal' }),
  ];
  const loaded = await Promise.all(faces.map((f) => f.load()));
  loaded.forEach((f) => document.fonts.add(f));
  await document.fonts.ready;
  return document.fonts.check('900 40px Lato');
}

// ---- shot harness boot ----
function bootShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return;

  const caption = q.get('caption');
  if (caption !== null && caption !== '') {
    state.caption = caption;
    captionInput.value = caption;
    countEl.textContent = `${caption.length} / 64`;
  }
  const size = q.get('size');
  if (size && SIZES[size]) {
    state.size = size;
    const radio = document.querySelector(`input[name="size"][value="${size}"]`);
    if (radio) radio.checked = true;
  }

  const load = async () => {
    const key = q.get('photo');
    if (!key || !SAMPLES[key]) return;
    const otherKey = key === 'pier' ? 'boulevard' : 'pier';
    const order = [key, otherKey, otherKey, key];
    await Promise.all(order.map((k, i) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        state.photos[i] = img;
        slots[i].classList.add('has-photo');
        slots[i].querySelector('img').src = SAMPLES[k];
        resolve();
      };
      img.onerror = () => resolve();
      img.src = SAMPLES[k];
    })));
    invalidate();
  };

  runShot(shot, q, load).catch((err) => setStatus(`Shot error: ${err.message}`, 'err'));
}

(async function boot() {
  const ok = await loadFonts().catch((err) => {
    setStatus(`Font load issue: ${err.message}`, 'warn');
    return false;
  });
  if (ok !== false) setStatus('Lato loaded · ready', 'ok');
  window.__latoReady = ok !== false;
  bootShot();
  invalidate();
  requestAnimationFrame(render);
})();