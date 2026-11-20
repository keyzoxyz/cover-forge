// shots.js — deterministic screenshot harness for the Playwright shooter.
// runShot(shot, query, load): 'editor' | 'cover' | 'export'.
// Sets window.__shotReady only after two requestAnimationFrames, so every
// pixel the shooter grabs is already painted.

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function waitForPaint() {
  return nextFrame().then(nextFrame);
}

function fillCaption(text) {
  const input = document.querySelector('#caption');
  if (!input) return;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function showStatus(msg) {
  const el = document.querySelector('#status');
  if (el) el.textContent = msg;
}

export async function runShot(shot, query, load) {
  const body = document.body;

  if (typeof load === 'function') {
    try {
      await load();
    } catch (err) {
      showStatus(`Shot load failed: ${err.message}`);
    }
  }

  if (shot === 'editor') {
    body.classList.remove('shot-cover', 'shot-export');
    const view = document.querySelector('#exportView');
    if (view) view.hidden = true;
    showStatus('Editor ready — pick photos, caption, grade, layout, size.');
  } else if (shot === 'cover') {
    body.classList.remove('shot-export');
    body.classList.add('shot-cover');
    const view = document.querySelector('#exportView');
    if (view) view.hidden = true;
  } else if (shot === 'export') {
    body.classList.remove('shot-cover');
    body.classList.add('shot-export');
    const caption = query.get('caption');
    if (caption) fillCaption(caption);
    const exportBtn = document.querySelector('#export');
    if (exportBtn) exportBtn.click();
    // give toBlob + image decode a beat before we declare ready
    await new Promise((resolve) => setTimeout(resolve, 420));
  } else {
    showStatus(`Unknown shot: ${shot}`);
  }

  if (shot === 'cover' || shot === 'editor') {
    await waitForPaint();
    await waitForPaint();
  } else {
    await waitForPaint();
  }

  window.__shotReady = true;
  window.__shotName = shot;
  return shot;
}