/**
 * Lightweight mouse-wheel zoom + pan for .generate-lightbox previews.
 */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.12;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function createLightboxZoom(options = {}) {
  const {
    viewport,
    img,
    zoomInBtn,
    zoomOutBtn,
    zoomResetBtn,
    zoomLevelEl
  } = options;

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let bound = false;

  function updateLevelDisplay() {
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
    zoomResetBtn?.classList.toggle('is-hidden', scale <= 1.01);
  }

  function applyTransform() {
    if (!img) return;
    if (scale <= 1.001) {
      img.style.transform = '';
      viewport?.classList.remove('is-zoomed', 'is-dragging');
      return;
    }
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    viewport?.classList.add('is-zoomed');
  }

  function reset() {
    scale = 1;
    panX = 0;
    panY = 0;
    dragging = false;
    if (img) img.style.transform = '';
    viewport?.classList.remove('is-zoomed', 'is-dragging');
    updateLevelDisplay();
  }

  function setScale(next, clientX, clientY) {
    const prev = scale;
    const newScale = clamp(next, MIN_SCALE, MAX_SCALE);
    if (viewport && clientX != null && clientY != null && prev > 0) {
      const rect = viewport.getBoundingClientRect();
      const offsetX = clientX - (rect.left + rect.width / 2);
      const offsetY = clientY - (rect.top + rect.height / 2);
      const ratio = newScale / prev;
      panX = panX - offsetX * (ratio - 1);
      panY = panY - offsetY * (ratio - 1);
    }
    scale = newScale;
    if (scale <= 1.001) {
      reset();
      return;
    }
    applyTransform();
    updateLevelDisplay();
  }

  function zoomBy(factor, clientX, clientY) {
    setScale(scale * factor, clientX, clientY);
  }

  function viewportCenter() {
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function onWheel(e) {
    if (!viewport || !img?.src) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomBy(factor, e.clientX, e.clientY);
  }

  function onPointerDown(e) {
    if (scale <= 1 || e.button !== 0) return;
    if (e.target.closest('.generate-lightbox-nav, .generate-lightbox-close, .generate-lightbox-toolbar, .generate-lightbox-zoom')) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewport?.classList.add('is-dragging');
    viewport?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    viewport?.classList.remove('is-dragging');
    try { viewport?.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
  }

  function onDblClick(e) {
    if (scale <= 1) return;
    e.preventDefault();
    reset();
  }

  function bind() {
    if (bound || !viewport || !img) return;
    bound = true;
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('dblclick', onDblClick);
    zoomInBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = viewportCenter();
      zoomBy(ZOOM_STEP, c.x, c.y);
    });
    zoomOutBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = viewportCenter();
      zoomBy(1 / ZOOM_STEP, c.x, c.y);
    });
    zoomResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      reset();
    });
    const observer = new MutationObserver(() => {
      if (img.getAttribute('src')) reset();
    });
    observer.observe(img, { attributes: true, attributeFilter: ['src'] });
    updateLevelDisplay();
  }

  return { bind, reset };
}
