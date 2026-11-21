/**
 * main.js — browser entry for Vice Cover Studio.
 *
 * Wires the static markup in index.html to the pure canvas engine in cover.js.
 * All mutable UI state lives in one `state` object, and every mutation funnels
 * through draw(), so the poster can always be reproduced from state alone.
 * No network access: photos are local object URLs, demo art is generated.
 */
import { drawCover, TEMPLATES, PALETTES } from './cover.js';
import { buildSamples } from './shots.js';

const MAX_PHOTOS = 4;
const $ = (id) => document.getElementById(id);

const canvas = $('poster');
const ctx = canvas ? canvas.getContext('2d') : null;
const hidden = $('hidden-cover');
const fileInput = $('photo-input');
const dropZone = $('drop-zone');
const captionsBox = $('captions');
const captionInputs = [1, 2, 3, 4].map((i) => $('caption-' + i));
const captionFields = captionInputs.map((el) => (el ? el.closest('.field') : null));
const titleInput = $('poster-title');
const templateSelect = $('template-select');
const paletteSelect = $('palette-select');
const exportBtn = $('export-btn');
const statusEl = $('status');

const DEFAULT_TITLE = 'Vice City Nights';

const state = {
  title: '',
  template: TEMPLATES[0].id,
  palette: PALETTES[0].id,
  captions: ['', '', '', ''],
  photos: [],
  urls: [],
  earnedCount: 0,
  demo: true,
};

const paletteById = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];
const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

/* ------------------------------------------------------------------ render */

let mirrorTimer = 0;

/** Debounced copy of the canvas into the hidden <img>, for scrapers/previews. */
function scheduleMirror() {
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    if (!hidden || !canvas || typeof canvas.toDataURL !== 'function') return;
    try {
      hidden.src = canvas.toDataURL('image/png');
      hidden.alt = 'Cover art preview: ' + (state.title.trim() || DEFAULT_TITLE);
    } catch (err) {
      /* A tainted canvas is impossible here; never let preview mirroring break the app. */
    }
  }, 80);
}

function draw() {
  if (!ctx) return;
  drawCover(ctx, {
    width: canvas.width,
    height: canvas.height,
    title: state.title,
    template: state.template,
    palette: paletteById(state.palette),
    photos: state.photos,
  });
  scheduleMirror();
}

/* ------------------------------------------------------------------ photos */

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be decoded.'));
    img.src = url;
  });
}

function syncCaptions() {
  const n = state.photos.length;
  if (captionsBox) captionsBox.hidden = n === 0;
  captionFields.forEach((field, i) => {
    const input = captionInputs[i];
    if (field) field.hidden = i >= n;
    if (input) input.disabled = i >= n;
  });
}

function releaseUrls() {
  state.urls.forEach((url) => URL.revokeObjectURL(url));
  state.urls = [];
}

async function loadPhotos(files) {
  const picked = Array.from(files || [])
    .filter((file) => file && /^image\//.test(file.type))
    .slice(0, MAX_PHOTOS);

  if (!picked.length) {
    setStatus('Those files were not images — try JPG, PNG or WebP.');
    return;
  }

  const urls = picked.map((file) => URL.createObjectURL(file));
  try {
    const images = await Promise.all(urls.map(loadImage));
    releaseUrls();
    state.urls = urls;
    state.photos = images;
    state.demo = false;
    syncCaptions();
    draw();
    const n = images.length;
    setStatus(
      n < 2
        ? `Loaded ${n} photo — add ${2 - n} more for the full layout.`
        : `Loaded ${n} photos. Tweak the title or hit Export PNG.`
    );
  } catch (err) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    setStatus(err && err.message ? err.message : 'That image could not be loaded.');
  }
}

/* --------------------------------------------------------------- demo boot */

/* The demo is built inside init() so the first paint never depends on files. */

/* ----------------------------------------------------------------- export */

function slug(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function currentFilename() {
  return (slug(state.title) || 'vice-cover') + '-cover.png';
}

function exportPng() {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    setStatus('Export is not available in this browser.');
    return;
  }
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the canvas could not be encoded.');
      return;
    }
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = currentFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    setStatus('Exported ' + currentFilename());
  }, 'image/png');
}

/* ------------------------------------------------------------------ wiring */

if (fileInput) {
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = ''; // allow re-picking the same file
    loadPhotos(files);
  });
}

if (dropZone) {
  dropZone.addEventListener('click', (event) => {
    if (event.target === fileInput || !fileInput) return; // avoid click recursion
    fileInput.click();
  });
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (fileInput) fileInput.click();
    }
  });
  ['dragenter', 'dragover'].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'dragend'].forEach((type) => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('is-dragging'));
  });
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    if (event.dataTransfer && event.dataTransfer.files) loadPhotos(event.dataTransfer.files);
  });
}

if (titleInput) {
  titleInput.addEventListener('input', () => {
    state.title = titleInput.value;
    draw();
  });
}

if (templateSelect) {
  templateSelect.addEventListener('change', () => {
    state.template = templateById(templateSelect.value).id;
    draw();
  });
}

if (paletteSelect) {
  paletteSelect.addEventListener('change', () => {
    state.palette = paletteById(paletteSelect.value).id;
    draw();
  });
}

captionInputs.forEach((input, index) => {
  if (!input) return;
  input.addEventListener('input', () => {
    state.captions[index] = input.value;
    draw(); // captions are part of state; the engine repaints from it
  });
});

if (exportBtn) exportBtn.addEventListener('click', exportPng);

/* ------------------------------------------------------- headless driver API */

function setTemplate(id) {
  const template = templateById(String(id));
  state.template = template.id;
  if (templateSelect) templateSelect.value = template.id;
  draw();
  return state.template;
}

function setPalette(id) {
  const palette = paletteById(String(id));
  state.palette = palette.id;
  if (paletteSelect) paletteSelect.value = palette.id;
  draw();
  return state.palette;
}

function setTitle(text) {
  state.title = String(text == null ? '' : text).slice(0, 40);
  if (titleInput) titleInput.value = state.title;
  draw();
  return state.title;
}

function markEarnedCount(count) {
  const next = Math.max(0, Math.floor(Number(count) || 0));
  state.earnedCount = next;
  document.body.dataset.earnedCount = String(next);
  const badge = $('earned-count');
  if (badge) badge.textContent = String(next);
  return next;
}

window.__cover = { setTemplate, setPalette, setTitle, markEarnedCount };

/* -------------------------------------------------------------------- boot */

async function init() {
  if (templateSelect) state.template = templateById(templateSelect.value).id;
  if (paletteSelect) state.palette = paletteById(paletteSelect.value).id;
  if (titleInput) state.title = titleInput.value;
  syncCaptions();

  /* Paint a finished poster straight away: buildSamples() synthesises the demo
     photos in a throwaway canvas, so nothing has to be uploaded first. */
  try {
    const samples = await buildSamples(canvas, drawCover);
    if (!state.photos.length) {
      state.photos = samples.slice(0, MAX_PHOTOS);
      state.demo = true;
      syncCaptions();
    }
    draw();
    setStatus('Demo poster ready — drop 2–4 photos to make it yours.');
  } catch (err) {
    console.error('Demo samples failed to build:', err);
    draw(); // the engine still paints a poster from primitives alone
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => draw())
      .catch((err) => console.error('Fonts failed to load:', err));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}