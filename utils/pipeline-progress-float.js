/**
 * NHP HuntPro — global floating pipeline progress card (popup shell).
 * Resizable, persistent size, minimize → FAB restore.
 */
export function initPipelineProgressFloat() {
  'use strict';

  try {
    if (window.__nhpPipelineProgressFloatInit) return;
    window.__nhpPipelineProgressFloatInit = true;

  const ROOT_ID = 'nhp-pipeline-float-root';
  const CARD_ID = 'nhp-pipeline-float-card';
  const FAB_ID = 'nhp-pipeline-float-fab';
  const SIZE_KEY = 'nhp_pipeline_float_size';
  const MIN_KEY = 'nhp_pipeline_float_minimized';

  const SIZE_STEP = 28;
  const MIN_W = 200;
  const MAX_W_RATIO = 0.42;
  /** Legacy height key kept only to sanitize old oversized persisted values. */
  const MAX_H_RATIO = 0.32;

  let root = null;
  let card = null;
  let fab = null;
  let active = false;
  let minimized = false;
  let dismissed = false;
  let savedSize = null;
  let hideTimer = null;
  let persistedLoaded = false;

  async function ensurePersistedLoaded() {
    if (persistedLoaded) return;
    await loadPersisted();
    persistedLoaded = true;
  }

  const ui = {
    pct: null,
    items: null,
    stageLabel: null,
    stage: null,
    batch: null,
    fill: null,
    detail: null,
    title: null
  };

  const state = {
    pipelineId: '',
    title: 'مسار المعالجة',
    percent: 0,
    stage: '',
    detail: '',
    done: 0,
    total: 0,
    batchIndex: 0,
    batchTotal: 0,
    status: 'running'
  };

  const UPDATE_THROTTLE_MS = 1000;
  let lastUpdateMs = 0;
  let lastUpdateStage = '';
  let pendingUpdate = null;
  let updateTimer = null;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function defaultSize() {
    const vw = window.innerWidth || 1200;
    const w = Math.round(Math.min(360, Math.max(MIN_W, vw * 0.28)));
    return {
      width: clamp(w, MIN_W, Math.round(vw * MAX_W_RATIO)),
      height: 0
    };
  }

  function maxSize() {
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    return {
      width: Math.round(vw * MAX_W_RATIO),
      height: Math.round(vh * MAX_H_RATIO)
    };
  }

  function normalizeSize(size) {
    const d = defaultSize();
    const max = maxSize();
    const width = clamp(Math.round(Number(size?.width) || d.width), MIN_W, max.width);
    // Height is content-driven (CSS height:auto). Ignore legacy tall persisted heights.
    const rawH = Math.round(Number(size?.height) || 0);
    const height = rawH > max.height ? 0 : rawH;
    return { width, height };
  }

  function readStorage(keys) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(keys, (r) => resolve(r || {}));
          return;
        }
      } catch (_) { /* ignore */ }
      const out = {};
      keys.forEach((k) => {
        try {
          const raw = localStorage.getItem(k);
          if (raw != null) out[k] = JSON.parse(raw);
        } catch (_) { /* ignore */ }
      });
      resolve(out);
    });
  }

  function writeStorage(key, value) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ [key]: value });
        return;
      }
    } catch (_) { /* ignore */ }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* ignore */ }
  }

  async function loadPersisted() {
    const stored = await readStorage([SIZE_KEY, MIN_KEY]);
    if (stored[SIZE_KEY] && typeof stored[SIZE_KEY] === 'object') {
      const normalized = normalizeSize(stored[SIZE_KEY]);
      // Drop legacy tall/wide sizes that created the empty black footer band.
      const max = maxSize();
      const legacyTall = Number(stored[SIZE_KEY].height) > max.height;
      const legacyWide = Number(stored[SIZE_KEY].width) > max.width;
      savedSize = (legacyTall || legacyWide)
        ? defaultSize()
        : normalized;
      if (legacyTall || legacyWide) {
        writeStorage(SIZE_KEY, savedSize);
      }
    }
    minimized = stored[MIN_KEY] === true || stored[MIN_KEY] === '1' || stored[MIN_KEY] === 1;
  }

  function persistSize(size) {
    savedSize = normalizeSize(size);
    writeStorage(SIZE_KEY, savedSize);
  }

  function persistMinimized(value) {
    minimized = !!value;
    writeStorage(MIN_KEY, minimized);
  }

  function getAppliedSize() {
    return normalizeSize(savedSize || defaultSize());
  }

  function applySizeToCard(size) {
    if (!card) return;
    const s = normalizeSize(size);
    card.style.width = `${s.width}px`;
    // Always auto-height so the dock never leaves a tall empty black band.
    card.style.height = 'auto';
    card.style.maxHeight = `${maxSize().height}px`;
  }

  function bumpSize(dw) {
    const cur = getAppliedSize();
    persistSize({
      width: cur.width + dw,
      height: 0
    });
    applySizeToCard(savedSize);
  }

  function resetSize() {
    const d = defaultSize();
    persistSize(d);
    applySizeToCard(d);
  }

  function ensureDom() {
    if (root) return;
    root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.className = 'nhp-pf-hidden';
      root.setAttribute('aria-live', 'polite');
      // Inline fallbacks: if CSS fails to load, never leave a document-flow black band.
      root.style.cssText = 'position:fixed;inset:auto 0 0 0;width:0;height:0;overflow:visible;z-index:2147483000;pointer-events:none;display:none;';
      root.innerHTML = `
        <button type="button" class="nhp-pf-fab is-hidden" id="${FAB_ID}" aria-label="استعادة بطاقة التقدم" style="display:none;position:fixed;left:14px;bottom:14px;pointer-events:auto;">
          <span class="nhp-pf-fab-pct" data-fab-pct>0%</span>
          <span class="nhp-pf-fab-label">مسار</span>
        </button>
        <div class="nhp-pf-card is-hidden" id="${CARD_ID}" role="dialog" aria-label="تقدم المسار" style="display:none;position:fixed;left:14px;bottom:14px;height:auto;max-height:32vh;pointer-events:auto;">
          <header class="nhp-pf-head">
            <div class="nhp-pf-title-wrap">
              <span class="nhp-pf-dot" aria-hidden="true"></span>
              <h2 class="nhp-pf-title" data-title>مسار المعالجة</h2>
            </div>
            <div class="nhp-pf-actions">
              <button type="button" class="nhp-pf-btn" data-action="shrink" title="تصغير العرض" aria-label="تصغير العرض">−</button>
              <button type="button" class="nhp-pf-btn" data-action="grow" title="تكبير العرض" aria-label="تكبير العرض">+</button>
              <button type="button" class="nhp-pf-btn" data-action="reset-size" title="إعادة الحجم الافتراضي" aria-label="إعادة الحجم الافتراضي">↺</button>
              <button type="button" class="nhp-pf-btn" data-action="minimize" title="تصغير إلى زر" aria-label="تصغير إلى زر">—</button>
              <button type="button" class="nhp-pf-btn is-danger" data-action="dismiss" title="إخفاء" aria-label="إخفاء">×</button>
            </div>
          </header>
          <div class="nhp-pf-body">
            <div class="nhp-pf-pct-row">
              <span class="nhp-pf-pct" data-pct>0%</span>
              <span class="nhp-pf-items" data-items></span>
            </div>
            <p class="nhp-pf-stage-label">المرحلة الحالية</p>
            <p class="nhp-pf-stage" data-stage>—</p>
            <p class="nhp-pf-batch is-hidden" data-batch hidden></p>
            <div class="nhp-pf-track" aria-hidden="true"><div class="nhp-pf-fill" data-fill></div></div>
            <p class="nhp-pf-detail" data-detail></p>
          </div>
          <div class="nhp-pf-resize-handle" data-resize-handle title="اسحب لتغيير العرض" aria-hidden="true"></div>
        </div>`;
      (document.body || document.documentElement).appendChild(root);
    }

    card = root.querySelector(`#${CARD_ID}`);
    fab = root.querySelector(`#${FAB_ID}`);
    ui.pct = root.querySelector('[data-pct]');
    ui.items = root.querySelector('[data-items]');
    ui.stageLabel = root.querySelector('.nhp-pf-stage-label');
    ui.stage = root.querySelector('[data-stage]');
    ui.batch = root.querySelector('[data-batch]');
    ui.fill = root.querySelector('[data-fill]');
    ui.detail = root.querySelector('[data-detail]');
    ui.title = root.querySelector('[data-title]');
    wireEvents();
  }

  function wireEvents() {
    root.querySelector('[data-action="shrink"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      bumpSize(-SIZE_STEP);
    });
    root.querySelector('[data-action="grow"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      bumpSize(SIZE_STEP);
    });
    root.querySelector('[data-action="reset-size"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetSize();
    });
    root.querySelector('[data-action="minimize"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setMinimized(true);
    });
    root.querySelector('[data-action="dismiss"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setDismissed(true);
    });
    fab?.addEventListener('click', () => {
      dismissed = false;
      setMinimized(false);
    });

    const handle = root.querySelector('[data-resize-handle]');
    if (handle && card) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;

      const onMove = (ev) => {
        if (!dragging) return;
        const pt = ev.touches?.[0] || ev;
        const dx = startX - pt.clientX;
        persistSize({ width: startW + dx, height: 0 });
        applySizeToCard(savedSize);
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      const onDown = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const pt = ev.touches?.[0] || ev;
        const cur = getAppliedSize();
        dragging = true;
        startX = pt.clientX;
        startY = pt.clientY;
        startW = cur.width;
        startH = 0;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
      };

      handle.addEventListener('mousedown', onDown);
      handle.addEventListener('touchstart', onDown, { passive: false });
    }
  }

  function render() {
    ensureDom();
    const pct = clamp(Math.round(Number(state.percent) || 0), 0, 100);
    if (ui.pct) ui.pct.textContent = `${pct}%`;
    if (ui.title) ui.title.textContent = state.title || 'مسار المعالجة';
    if (ui.stage) ui.stage.textContent = state.stage || '—';
    if (ui.detail) ui.detail.textContent = state.detail || '';
    if (ui.fill) ui.fill.style.width = `${pct}%`;

    const done = Number(state.done) || 0;
    const total = Number(state.total) || 0;
    if (ui.items) {
      ui.items.textContent = total > 0 ? `${done}/${total}` : '';
    }

    const batchIndex = Number(state.batchIndex) || 0;
    const batchTotal = Number(state.batchTotal) || 0;
    if (ui.batch) {
      const showBatch = batchTotal > 1;
      ui.batch.hidden = !showBatch;
      ui.batch.classList.toggle('is-hidden', !showBatch);
      ui.batch.textContent = showBatch ? `دفعة ${batchIndex}/${batchTotal}` : '';
    }

    const fabPct = root.querySelector('[data-fab-pct]');
    if (fabPct) fabPct.textContent = `${pct}%`;

    card?.classList.toggle('is-complete', state.status === 'success');
    card?.classList.toggle('is-error', state.status === 'error');
  }

  function syncVisibility() {
    ensureDom();
    root.classList.toggle('nhp-pf-hidden', !active);
    root.classList.toggle('nhp-pf-active', active);
    // Defense in depth if stylesheet is missing / overridden.
    root.style.display = active ? '' : 'none';

    const showFab = active && minimized && !dismissed;
    const showCard = active && !minimized && !dismissed;

    card?.classList.toggle('is-hidden', !showCard);
    fab?.classList.toggle('is-hidden', !showFab);
    if (card) card.style.display = showCard ? 'flex' : 'none';
    if (fab) fab.style.display = showFab ? 'flex' : 'none';

    if (showCard) {
      applySizeToCard(getAppliedSize());
    }
  }

  function setMinimized(value) {
    minimized = !!value;
    persistMinimized(minimized);
    if (!minimized) {
      dismissed = false;
      applySizeToCard(getAppliedSize());
    }
    syncVisibility();
    render();
  }

  function setDismissed(value) {
    dismissed = !!value;
    if (dismissed) minimized = false;
    syncVisibility();
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function scheduleHide(delayMs = 3200) {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      active = false;
      dismissed = false;
      minimized = false;
      syncVisibility();
    }, delayMs);
  }

  function applyUpdatePayload(payload = {}) {
    const p = normalizePayload(payload);
    if (p.title) state.title = String(p.title);
    if (p.stage != null) state.stage = String(p.stage);
    else if (p.label != null) state.stage = String(p.label);
    if (p.detail != null) state.detail = String(p.detail);
    if (typeof p.percent === 'number') state.percent = clamp(p.percent, 0, 100);
    if (typeof p.done === 'number') state.done = p.done;
    if (typeof p.total === 'number') state.total = p.total;
    if (typeof p.batchIndex === 'number') state.batchIndex = p.batchIndex;
    if (typeof p.batchTotal === 'number') state.batchTotal = p.batchTotal;

    if (typeof p.done === 'number' && typeof p.total === 'number' && p.total > 0 && p.percent == null) {
      state.percent = clamp(Math.round((p.done / p.total) * 100), 0, 100);
    }

    if (p.step != null && p.totalSteps != null && p.totalSteps > 0 && p.percent == null) {
      const step = Number(p.step) || 0;
      const totalSteps = Number(p.totalSteps) || 1;
      const stepPct = (step / totalSteps) * 100;
      if (typeof p.done === 'number' && typeof p.total === 'number' && p.total > 0) {
        const inner = p.done / p.total;
        state.percent = clamp(Math.round(stepPct + (inner * (100 / totalSteps))), 0, 100);
      } else {
        state.percent = clamp(Math.round(stepPct), 0, 100);
      }
    }

    state.status = 'running';
    render();
    syncVisibility();
  }

  function flushPendingUpdate() {
    updateTimer = null;
    if (!pendingUpdate) return;
    const payload = pendingUpdate;
    pendingUpdate = null;
    lastUpdateMs = Date.now();
    if (payload.stage != null) lastUpdateStage = String(payload.stage);
    else if (payload.label != null) lastUpdateStage = String(payload.label);
    applyUpdatePayload(payload);
  }
  function normalizePayload(payload = {}) {
    const p = { ...payload };
    if (p.itemDone != null && p.done == null) p.done = p.itemDone;
    if (p.itemTotal != null && p.total == null) p.total = p.itemTotal;
    if (p.seoDone != null && p.done == null) p.done = p.seoDone;
    if (p.seoTotal != null && p.total == null) p.total = p.seoTotal;
    if (p.stage != null && p.label == null) p.label = p.stage;
    return p;
  }

  async function start(payload = {}) {
    clearHideTimer();
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    pendingUpdate = null;
    lastUpdateMs = 0;
    lastUpdateStage = '';
    await ensurePersistedLoaded();
    const p = normalizePayload(payload);
    active = true;
    dismissed = false;
    state.pipelineId = String(p.pipelineId || p.id || 'pipeline');
    state.title = String(p.title || 'مسار المعالجة');
    state.percent = Number(p.percent) || 0;
    state.stage = String(p.stage || p.label || 'بدء المسار...');
    state.detail = String(p.detail || '');
    state.done = Number(p.done) || 0;
    state.total = Number(p.total) || Number(p.totalItems) || Number(p.itemTotal) || 0;
    state.batchIndex = Number(p.batchIndex) || 0;
    state.batchTotal = Number(p.batchTotal) || 0;
    state.status = 'running';

    if (p.resetMinimized) {
      minimized = false;
      persistMinimized(false);
    }

    ensureDom();
    applySizeToCard(getAppliedSize());
    syncVisibility();
    render();
  }

  function update(payload = {}) {
    if (!active && payload.force !== true) return;
    const p = normalizePayload(payload);
    const stage = String(p.stage ?? p.label ?? '');
    const now = Date.now();
    const stageChanged = stage && stage !== lastUpdateStage;
    if (!p.force && !stageChanged && (now - lastUpdateMs) < UPDATE_THROTTLE_MS) {
      pendingUpdate = { ...(pendingUpdate || {}), ...p };
      if (!updateTimer) {
        const wait = UPDATE_THROTTLE_MS - (now - lastUpdateMs);
        updateTimer = setTimeout(flushPendingUpdate, Math.max(16, wait));
      }
      return;
    }
    lastUpdateMs = now;
    if (stage) lastUpdateStage = stage;
    applyUpdatePayload(p);
  }

  function complete(payload = {}) {
    if (!active) return;
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    if (pendingUpdate) {
      applyUpdatePayload(pendingUpdate);
      pendingUpdate = null;
    }
    state.status = payload.success === false ? 'error' : 'success';
    if (payload.message) state.stage = String(payload.message);
    if (typeof payload.percent === 'number') {
      state.percent = clamp(payload.percent, 0, 100);
    } else if (state.status === 'success') {
      state.percent = 100;
    }
    render();
    if (!dismissed) syncVisibility();
    scheduleHide(payload.success === false ? 5200 : 3600);
  }

  function hide() {
    clearHideTimer();
    active = false;
    dismissed = false;
    syncVisibility();
  }

  function isActive() {
    return active;
  }

  function restore() {
    if (!active) return;
    dismissed = false;
    setMinimized(false);
  }

  window.NHP_PIPELINE_PROGRESS = {
    start,
    update,
    complete,
    end: complete,
    hide,
    isActive,
    restore,
    getDefaultSize: defaultSize,
    SIZE_KEY,
    MIN_KEY
  };

    void ensurePersistedLoaded();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureDom, { once: true });
    } else {
      ensureDom();
    }
  } catch (err) {
    console.warn('[NHP] pipeline-progress-float init failed (non-fatal):', err);
  }
}
