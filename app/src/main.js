import { drawCover, TEMPLATES, PALETTES } from './cover.js';
import { buildSamples } from './shots.js';

const MAX_PHOTOS = 4;
const state = {
  title: '',
  template: TEMPLATES[0],
  palette: PALETTES[0],
  captions: ['', '', '', ''],
  photos: [],
};

const els = {};
let sampleSources = [];

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
}

function redraw() {
  if (!els.canvas) return;
  drawCover(els.canvas, {
    title: state.title,
    template: state.template,
    palette: state.palette,
    captions: state.captions,
    photos: state.photos,
  });
}

function ensureCaptionInputs() {
  if (!els.captions) return;
  if (els.captions.children.length) return;
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const row = document.createElement('div');
    row.className = 'caption-row';
    const label = document.createElement('label');
    label.setAttribute('for', `caption-${i}`);
    label.textContent = `Photo ${i + 1} caption`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `caption-${i}`;
    input.name = `caption-${i}`;
    input.placeholder = 'Add a caption…';
    input.addEventListener('input', () => {
      state.captions[i] = input.value;
      redraw();
    });
    row.appendChild(label);
    row.appendChild(input);
    els.captions.appendChild(row);
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name || 'image'}`));
    };
    img.src = url;
  });
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && (f.type || '').startsWith('image/'));
  if (!files.length) {
    setStatus('No image files found — try JPG, PNG, or WebP.');
    return;
  }
  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) {
    setStatus(`Photo limit reached (${MAX_PHOTOS}). Remove one to add another.`);
    return;
  }
  const batch = files.slice(0, room);
  const loaded = [];
  for (const file of batch) {
    try {
      loaded.push(await loadImageFromFile(file));
    } catch (err) {
      console.warn(err);
    }
  }
  if (!loaded.length) {
    setStatus('Those images could not be read.');
    return;
  }
  for (const item of loaded) {
    state.photos.push(item.img);
    if (!sampleSources.includes(item.img)) sampleSources.push(item.img);
  }
  redraw();
  const n = state.photos.length;
  setStatus(
    n >= 2
      ? `${n} photos loaded — poster updated.`
      : `1 photo loaded — drop 1–3 more to fill the grid.`
  );
}

function clearPhotos() {
  for (const photo of state.photos) {
    const match = sampleSources.find((s) => s === photo);
    if (match) {
      if (match.url && match.url.startsWith('blob:')) URL.revokeObjectURL(match.url);
    }
  }
  state.photos = [];
  redraw();
  setStatus('Photos cleared — showing the demo poster.');
}

async function exportPng() {
  if (!els.canvas) return;
  const name = (state.title || 'cover-art').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'cover-art';
  const dataUrl = els.canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `${name}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus(`Exported ${name}.png`);
}

function wireFileInput() {
  if (els.fileInput) {
    els.fileInput.addEventListener('change', (e) => {
      addFiles(e.target.files);
      e.target.value = '';
    });
  }
}

function wireDropZone() {
  const zone = els.dropZone || document.body;
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((type) => {
    zone.addEventListener(type, stop, false);
  });
  zone.addEventListener('dragenter', () => zone.classList.add('dragging'));
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', (e) => {
    zone.classList.remove('dragging');
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) addFiles(dt.files);
  });
}

function wireTitle() {
  if (!els.titleInput) return;
  els.titleInput.addEventListener('input', () => {
    state.title = els.titleInput.value;
    redraw();
  });
}

function wireTemplate() {
  if (!els.templateSelect) return;
  els.templateSelect.innerHTML = '';
  TEMPLATES.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = String(t).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    els.templateSelect.appendChild(opt);
  });
  els.templateSelect.value = state.template;
  els.templateSelect.addEventListener('change', () => {
    state.template = els.templateSelect.value;
    redraw();
  });
}

function wirePalette() {
  if (!els.paletteSelect) return;
  els.paletteSelect.innerHTML = '';
  PALETTES.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = String(p).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    els.paletteSelect.appendChild(opt);
  });
  els.paletteSelect.value = state.palette;
  els.paletteSelect.addEventListener('change', () => {
    state.palette = els.paletteSelect.value;
    redraw();
  });
}

function wireExport() {
  if (els.exportBtn) els.exportBtn.addEventListener('click', exportPng);
  if (els.clearBtn) els.clearBtn.addEventListener('click', clearPhotos);
}

function init() {
  els.canvas = $('cover-canvas') || document.querySelector('canvas');
  els.status = $('status');
  els.fileInput = $('file-input');
  els.dropZone = $('drop-zone');
  els.titleInput = $('title');
  els.templateSelect = $('template');
  els.paletteSelect = $('palette');
  els.captions = $('captions');
  els.exportBtn = $('export');
  els.clearBtn = $('clear');

  ensureCaptionInputs();
  wireFileInput();
  wireDropZone();
  wireTitle();
  wireTemplate();
  wirePalette();
  wireExport();

  state.photos = buildSamples();
  redraw();
  setStatus('Demo poster ready — drop 2–4 photos to make it yours.');
}

window.__cover = {
  setTemplate(value) {
    state.template = value;
    if (els.templateSelect) els.templateSelect.value = value;
    redraw();
  },
  setPalette(value) {
    state.palette = value;
    if (els.paletteSelect) els.paletteSelect.value = value;
    redraw();
  },
  setTitle(value) {
    state.title = value;
    if (els.titleInput) els.titleInput.value = value;
    redraw();
  },
  get photos() {
    return state.photos;
  },
  get state() {
    return state;
  },
  redraw,
};

init();