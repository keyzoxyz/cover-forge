// Cover Forge browser entry. Type=module scripts are deferred, so the DOM is
// already parsed when this runs: init() executes at top level, not on an event.
import { drawCover, TEMPLATES, PALETTES } from './cover.js';
import { buildSamples } from './shots.js';

const MAX_PHOTOS = 4;
const DEMO_STATUS = 'Demo poster ready — drop 2–4 photos to make it yours.';
const PALETTE_NAMES = ['Vice Night', 'Miami Heat', 'Toxic Lime', 'Ultra Violet'];
const state = { title: 'COVER FORGE', template: TEMPLATES[0], palette: PALETTES[0],
  captions: ['', '', '', ''], photos: [] };
const els = {};
const objectUrls = [];
let showingDemo = true;

const $ = (id) => document.getElementById(id);

function setStatus(message, kind) {
  if (!els.status) return;
  els.status.textContent = message;
  if (kind) els.status.dataset.state = kind;
  else delete els.status.dataset.state;
}

function redraw() {
  if (!els.canvas) return;
  const canvas = els.canvas;
  drawCover(canvas, {
    width: canvas.width || 1024,
    height: canvas.height || 1024,
    title: state.title,
    studio: 'COVER FORGE PICTURES',
    year: new Date().getFullYear(),
    template: state.template,
    palette: state.palette,
    photos: state.photos.map((image, i) => ({ image, caption: state.captions[i] || '' })),
  });
}

function setupCaptionInputs() {
  if (!els.captions) return;
  const existing = Array.from(els.captions.querySelectorAll('input'));
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const input = existing[i] || els.captions.appendChild(document.createElement('input'));
    input.type = 'text';
    input.className = 'input';
    input.id = `caption-${i}`;
    input.name = `caption-${i}`;
    input.autocomplete = 'off';
    input.placeholder = `Caption ${i + 1}`;
    input.value = state.captions[i];
    input.addEventListener('input', () => {
      state.captions[i] = input.value;
      redraw();
    });
  }
}

function syncCaptionInputs() {
  if (!els.captions) return;
  Array.from(els.captions.querySelectorAll('input')).forEach((input, i) => {
    input.hidden = i >= state.photos.length;
    if (!input.hidden) input.value = state.captions[i] || '';
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not decode ${file.name || 'image'}`));
    img.src = url;
  });
}

function resetPhotos() {
  while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
  state.photos = [];
  state.captions = ['', '', '', ''];
  showingDemo = false;
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && `${f.type || ''}`.startsWith('image/'));
  if (!files.length) return setStatus('No image files found — try JPG, PNG, or WebP.', 'error');
  if (showingDemo) resetPhotos();

  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) return setStatus(`Photo limit reached (${MAX_PHOTOS}) — the grid is full.`, 'error');

  const results = await Promise.allSettled(files.slice(0, room).map(loadImage));
  const loaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!loaded.length) return setStatus('Those images could not be read — try another file.', 'error');

  state.photos.push(...loaded);
  syncCaptionInputs();
  redraw();
  const n = state.photos.length;
  setStatus(n >= 2 ? `${n} photos loaded — poster updated.`
    : '1 photo loaded — add another to fill the grid.', 'ok');
}

function wireFileInput() {
  if (!els.fileInput) return;
  els.fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    event.target.value = '';
    addFiles(files);
  });
}

function wireDropZone() {
  const zone = els.dropZone;
  if (!zone) return;
  const over = (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.add('dragover');
  };
  const out = (event) => {
    event.preventDefault();
    zone.classList.remove('dragover');
  };
  zone.addEventListener('dragenter', over);
  zone.addEventListener('dragover', over);
  zone.addEventListener('dragleave', out);
  zone.addEventListener('drop', (event) => {
    out(event);
    if (event.dataTransfer && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  });
  zone.addEventListener('click', (event) => {
    if (event.target !== els.fileInput && els.fileInput) els.fileInput.click();
  });
  zone.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && els.fileInput) {
      event.preventDefault();
      els.fileInput.click();
    }
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}

function fillSelect(select, entries) {
  if (!select) return;
  select.innerHTML = '';
  entries.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function exportPng() {
  if (!els.canvas) return;
  const name = String(state.title || 'cover-art').trim()
    .replace(/[^\w\s-]+/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'cover-art';
  const link = document.createElement('a');
  link.download = `${name}.png`;
  link.href = els.canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus(`Exported ${name}.png`, 'ok');
}

function wireControls() {
  if (els.titleInput) {
    state.title = els.titleInput.value.trim() || state.title;
    els.titleInput.addEventListener('input', () => {
      state.title = els.titleInput.value;
      redraw();
    });
  }
  fillSelect(els.templateSelect, TEMPLATES.map((t) => ({
    value: t, label: t.charAt(0).toUpperCase() + t.slice(1),
  })));
  if (els.templateSelect) {
    els.templateSelect.value = state.template;
    els.templateSelect.addEventListener('change', () => {
      state.template = els.templateSelect.value;
      redraw();
    });
  }
  fillSelect(els.paletteSelect, PALETTES.map((_, i) => ({
    value: String(i), label: PALETTE_NAMES[i] || `Palette ${i + 1}`,
  })));
  if (els.paletteSelect) {
    els.paletteSelect.value = String(Math.max(0, PALETTES.indexOf(state.palette)));
    els.paletteSelect.addEventListener('change', () => {
      state.palette = PALETTES[Number.parseInt(els.paletteSelect.value, 10)] || state.palette;
      redraw();
    });
  }
  if (els.exportBtn) els.exportBtn.addEventListener('click', exportPng);
}

function setTemplate(value) {
  const key = String(value == null ? '' : value).toLowerCase().replace(/[\s_-]+/g, '');
  const match = TEMPLATES.find((t) => t.toLowerCase() === key) ||
    TEMPLATES.find((t) => key.includes(t.toLowerCase()));
  if (!match) return;
  state.template = match;
  if (els.templateSelect) els.templateSelect.value = match;
  redraw();
}

function setPalette(value) {
  let next = null;
  if (typeof value === 'number') next = PALETTES[value] || null;
  else if (value && typeof value === 'object' && value.bg) next = value;
  else if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (/^\d+$/.test(key)) next = PALETTES[Number.parseInt(key, 10)] || null;
    else if (key.startsWith('#')) next = PALETTES.find((p) => p.bg.toLowerCase() === key) || null;
    else {
      const i = PALETTE_NAMES.findIndex((n) => n.toLowerCase() === key);
      if (i >= 0) next = PALETTES[i];
    }
  }
  if (!next) return;
  state.palette = next;
  if (els.paletteSelect && PALETTES.indexOf(next) >= 0) {
    els.paletteSelect.value = String(PALETTES.indexOf(next));
  }
  redraw();
}

function setTitle(value) {
  state.title = String(value == null ? '' : value);
  if (els.titleInput) els.titleInput.value = state.title;
  redraw();
}

async function init() {
  els.canvas = $('poster') || document.querySelector('canvas');
  els.status = $('status');
  els.fileInput = $('photos') || $('file-input');
  els.dropZone = $('dropzone') || $('drop-zone');
  els.titleInput = $('title');
  els.templateSelect = $('template');
  els.paletteSelect = $('palette');
  els.captions = $('captions');
  els.exportBtn = $('export');

  wireControls();
  setupCaptionInputs();
  wireFileInput();
  wireDropZone();

  try {
    const samples = await buildSamples(els.canvas, drawCover);
    state.photos = samples.map((sample) => sample.image);
    state.captions = samples.map((sample) => sample.caption || '').concat(['', '', '', '']).slice(0, 4);
    syncCaptionInputs();
  } catch (error) {
    console.warn('buildSamples failed:', error);
  }

  redraw();
  setStatus(DEMO_STATUS, 'ok');
}

window.__cover = {
  setTemplate,
  setPalette,
  setTitle,
  get photos() { return state.photos; },
  get state() { return state; },
  redraw,
};

init().catch((error) => {
  console.error(error);
  setStatus('Could not start the cover maker — reload to try again.', 'error');
});