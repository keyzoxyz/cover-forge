/**
 * main.js — browser entry for the Cover Forge poster maker.
 * Wires the controls, drag-and-drop, captions and PNG export to the
 * pure-canvas renderer in cover.js, and paints a demo poster on load.
 */

import { drawCover, TEMPLATES, PALETTES } from './cover.js';
import { buildSamples } from './shots.js';

const MAX_PHOTOS = 4;
const POSTER_W = 1200;
const POSTER_H = 1500;
const DEMO_STATUS = 'Demo poster ready — drop 2–4 photos to make it yours.';
const CAPTION_PLACEHOLDERS = ['Ride or die', 'No rules tonight', 'Sunset state of mind', 'Outrun the law'];

const state = {
  title: 'Vice City Nights',
  template: TEMPLATES[0].id,
  palette: PALETTES[0].id,
  captions: ['', '', '', ''],
  photos: [],
};

const els = { captions: [] };
const objectUrls = [];

const byId = (id) => document.getElementById(id);
const paletteById = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];
const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cover-art';

function setStatus(text) {
  if (els.status) els.status.textContent = text;
}

function redraw() {
  if (!els.ctx) return;
  drawCover(els.ctx, {
    width: POSTER_W,
    height: POSTER_H,
    photos: state.photos,
    title: state.title || 'UNTITLED',
    template: state.template,
    palette: paletteById(state.palette),
  });
}

function syncCaptionFields() {
  els.captions.forEach((input, i) => {
    if (!input) return;
    input.disabled = i >= state.photos.length;
    input.value = state.captions[i] || '';
  });
}

function setPhotos(next) {
  state.photos.length = 0;
  next.slice(0, MAX_PHOTOS).forEach((photo) => {
    photo.caption = photo.caption || state.captions[state.photos.length] || '';
    state.photos.push(photo);
  });
  syncCaptionFields();
}

function buildCaptionFields() {
  const grid = document.querySelector('.field-grid');
  if (!grid) return;
  grid.textContent = '';
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const label = document.createElement('label');
    label.className = 'field';
    const caption = document.createElement('span');
    caption.className = 'field__label';
    caption.textContent = 'Caption ' + (i + 1);
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'caption-' + i;
    input.name = 'caption-' + i;
    input.maxLength = 60;
    input.placeholder = CAPTION_PLACEHOLDERS[i];
    input.value = state.captions[i] || '';
    input.addEventListener('input', () => {
      state.captions[i] = input.value;
      if (state.photos[i]) state.photos[i].caption = input.value;
      redraw();
    });
    label.append(caption, input);
    grid.appendChild(label);
    els.captions[i] = input;
  }
  syncCaptionFields();
}

function fillSelect(select, items, value, onChange) {
  if (!select) return;
  select.textContent = '';
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  select.value = items.some((item) => item.id === value) ? value : items[0].id;
  select.addEventListener('change', () => onChange(select.value));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = url;
  });
}

function releaseObjectUrls() {
  while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
}

async function handleFiles(files) {
  const picked = Array.from(files || [])
    .filter((file) => file && /^image\//.test(file.type || ''))
    .slice(0, MAX_PHOTOS);
  if (!picked.length) {
    setStatus('Those files are not images — try JPG, PNG or WebP.');
    return;
  }
  setStatus('Loading photos…');
  releaseObjectUrls();
  const records = [];
  for (const file of picked) {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    try {
      const image = await loadImage(url);
      records.push({ image, url, name: file.name, caption: '' });
    } catch (err) {
      URL.revokeObjectURL(url);
      objectUrls.splice(objectUrls.indexOf(url), 1);
    }
  }
  if (!records.length) {
    setStatus('Those images could not be read — try another file.');
    return;
  }
  state.captions = ['', '', '', ''];
  setPhotos(records);
  redraw();
  setStatus(records.length + (records.length === 1 ? ' photo loaded — add a caption.' : ' photos loaded — add captions and export.'));
}

async function loadDemo() {
  try {
    const surface = document.createElement('canvas');
    const samples = await buildSamples(surface);
    state.captions = samples.slice(0, MAX_PHOTOS)
      .map((sample) => String(sample.label || '').toUpperCase())
      .concat(['', '', '', ''])
      .slice(0, MAX_PHOTOS);
    setPhotos(samples.slice(0, MAX_PHOTOS).map((sample) => ({
      image: sample.image,
      url: sample.src,
      name: sample.id,
      caption: String(sample.label || '').toUpperCase(),
    })));
    redraw();
  } catch (err) {
    /* keep the synchronously painted placeholder poster */
  }
  setStatus(DEMO_STATUS);
}

function exportPng() {
  if (!els.canvas) return;
  const filename = slugify(state.title) + '.png';
  const save = (href, revoke) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1000);
    setStatus('Exported ' + filename);
  };
  if (typeof els.canvas.toBlob === 'function') {
    els.canvas.toBlob((blob) => {
      if (blob) save(URL.createObjectURL(blob), true);
      else save(els.canvas.toDataURL('image/png'), false);
    }, 'image/png');
  } else {
    save(els.canvas.toDataURL('image/png'), false);
  }
}

function wireDropzone() {
  const zone = (els.file && els.file.closest('.dropzone')) || document.body;
  const highlight = () => zone.classList.add('is-dragover');
  const clear = () => zone.classList.remove('is-dragover');

  ['dragenter', 'dragover'].forEach((type) =>
    zone.addEventListener(type, (event) => { event.preventDefault(); highlight(); }));
  ['dragleave', 'dragend'].forEach((type) =>
    zone.addEventListener(type, () => clear()));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    clear();
    handleFiles(event.dataTransfer && event.dataTransfer.files);
  });
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}

function init() {
  els.canvas = byId('poster');
  if (!els.canvas) return;
  els.ctx = els.canvas.getContext('2d');
  els.canvas.width = POSTER_W;
  els.canvas.height = POSTER_H;
  els.status = byId('status');
  els.title = byId('title');
  els.template = byId('template');
  els.palette = byId('palette');
  els.file = byId('photos');
  els.export = byId('export');

  if (els.title) {
    els.title.value = state.title;
    els.title.addEventListener('input', () => {
      state.title = els.title.value;
      redraw();
    });
  }
  fillSelect(els.template, TEMPLATES, state.template, (value) => {
    state.template = value;
    redraw();
  });
  fillSelect(els.palette, PALETTES, state.palette, (value) => {
    state.palette = value;
    redraw();
  });
  buildCaptionFields();

  if (els.file) {
    els.file.addEventListener('change', () => {
      const files = Array.from(els.file.files || []);
      els.file.value = '';
      handleFiles(files);
    });
  }
  wireDropzone();
  if (els.export) els.export.addEventListener('click', exportPng);

  window.__cover = {
    setTemplate(value) {
      const hit = typeof value === 'number' ? TEMPLATES[value] : TEMPLATES.find((t) => t.id === value || t.name === value);
      if (hit) state.template = hit.id;
      if (els.template) els.template.value = state.template;
      redraw();
    },
    setPalette(value) {
      const hit = typeof value === 'number' ? PALETTES[value] : PALETTES.find((p) => p.id === value || p.name === value);
      if (hit) state.palette = hit.id;
      if (els.palette) els.palette.value = state.palette;
      redraw();
    },
    setTitle(value) {
      state.title = value == null ? '' : String(value);
      if (els.title) els.title.value = state.title;
      redraw();
    },
    photos: state.photos,
  };

  redraw();
  setStatus(DEMO_STATUS);
  loadDemo();
}

if (document.readyState === 'interactive' || document.readyState === 'complete') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });