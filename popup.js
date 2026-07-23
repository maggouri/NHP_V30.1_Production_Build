import { initTrendModule } from './modules/trend.js';
import { initUsptoModule, updateUSPTO as usptoUpdate } from './modules/uspto/uspto.js';
import { initAnalysisModule, updateTeePublic as analysisUpdate } from './modules/analysis/analysis.js';
import { initNoteModule } from './modules/note/note.js?v=note_tp_pages_every_niche_20260719';
import { initStudioModule } from './modules/studio/studio.js';
import { initGenerateModule, activateGeneratePanel, handlePromptBagGenerate } from './modules/generate/generate.js';
import { initCanvaBridgePanel, activateCanvaBridgeTab, deactivateCanvaBridgeTab } from './modules/generate/canva-bridge-panel.js';
import { initRadarModule } from './modules/radar/radar.js?v=note_hunt_thumbfix_20260627';
import { initSeoModule } from './modules/seo/seo.js';
import { initAutopilotModule, updateAutopilot, bindApUploadConfirmModalEarly } from './modules/autopilot/autopilot.js';
import { initCreatyModule, NHP_activateCreatyPanel } from './modules/creaty/creaty.js';
import { initAdminModule, updateAuthUI, refreshLibrary, refreshAdminUsers } from './modules/admin/admin.js';
import { initTMHuntModule } from './modules/tmhunt/tmhunt.js';
import { initSocialModule } from './social.js';
import { initRedbubbleHubModule, initAmazonHubModule } from './modules/market-hubs/market-hubs.js';
import { createLightboxZoom } from './utils/lightbox-zoom.js';
import { initPipelineProgressFloat } from './utils/pipeline-progress-float.js';


// ══════════════════════════════════════════════════════
//  GLOBAL STATE & BRIDGE SELECTORS
// ══════════════════════════════════════════════════════
const NHPDatabase = {
  dbName: 'NHP_Designs_DB',
  storeName: 'images',
  dbPromise: null,
  init: function () {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        db.onversionchange = () => {
          try { db.close(); } catch (_) { }
          this.dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = (e) => {
        this.dbPromise = null;
        reject(e);
      };
    });
    return this.dbPromise;
  },
  saveImage: async function (id, base64Data) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      try {
        if (store.keyPath === 'id') {
          store.put({ id, data: base64Data });
        } else {
          store.put({ data: base64Data }, id);
        }
      } catch (error) {
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  },
  getImage: async function (id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(id);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = (e) => reject(e);
    });
  },
  deleteImage: async function (id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  },
  clearAllImages: async function () {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  },
  listAllImageIds: async function () {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAllKeys();
      req.onsuccess = () => resolve((req.result || []).map((id) => String(id)));
      req.onerror = (e) => reject(e);
    });
  }
};

window.NHPDatabase = NHPDatabase;

let designQueue = []; // Central image queue
let isBatchProcessing = false; // Block storage writes during major ops
let saveQueueTimeout = null;
let isSavingQueue = false;
let pendingSave = false;
let storageEchoSuppressUntil = 0;
let autoTuneLastRunAt = 0;
let autoTuneScheduleTimeout = null;
let lastQueueRenderCount = -1;
let lastQueueRenderFingerprint = '';
let dashboardRefreshTimeout = null;

function markStorageEchoSuppress(ms = 1500) {
  storageEchoSuppressUntil = Date.now() + ms;
}

function isStorageEchoSuppressed() {
  return Date.now() < storageEchoSuppressUntil;
}

/** Unified batch flag — avoids popup vs module mismatch. */
function setBatchProcessing(enabled) {
  const on = !!enabled;
  isBatchProcessing = on;
  window.isBatchProcessing = on;
  if (!on) {
    lastQueueRenderCount = -1;
    lastQueueRenderFingerprint = '';
  }
}
window.NHP_setBatchProcessing = setBatchProcessing;
window.NHP_markStorageEchoSuppress = markStorageEchoSuppress;
const LOW_SPEC_MODE_KEY = 'nhpLowSpecMode';
const AUTO_LITE_ASSIST_KEY = 'nhpAutoLiteAssist';
const PERFORMANCE_MODE_KEY = 'nhpPerformanceMode';
const FORCE_I3_MODE_KEY = 'nhpForceI3Ram2GbMode';
const GOD_MODE_SETTINGS_KEY = 'nhpGodModeSettings';
const INTERNAL_ECHO_STORAGE_KEYS = new Set([
  PERFORMANCE_MODE_KEY,
  LOW_SPEC_MODE_KEY,
  AUTO_LITE_ASSIST_KEY,
  FORCE_I3_MODE_KEY,
  'savedDesignQueue'
]);
window.NHP_LOW_SPEC_MODE = false;
window.NHP_IS_LIGHT_MODE = false;
window.NHP_PERFORMANCE_MODE = 'performance';
const PERFORMANCE_PROFILES = Object.freeze({
  performance: {
    listMaxRender: 180,
    queueMaxRender: 72,
    queueRenderDebounceMs: 140,
    queueSaveDebounceMs: 2400,
    refreshDelayMs: 650,
    thumbnailWidth: 128
  },
  balanced: {
    listMaxRender: 120,
    queueMaxRender: 48,
    queueRenderDebounceMs: 200,
    queueSaveDebounceMs: 3200,
    refreshDelayMs: 950,
    thumbnailWidth: 112
  },
  lite: {
    listMaxRender: 80,
    queueMaxRender: 32,
    queueRenderDebounceMs: 280,
    queueSaveDebounceMs: 4500,
    refreshDelayMs: 1400,
    thumbnailWidth: 96
  },
  ultra: {
    listMaxRender: 50,
    queueMaxRender: 24,
    queueRenderDebounceMs: 380,
    queueSaveDebounceMs: 5800,
    refreshDelayMs: 2000,
    thumbnailWidth: 80
  }
});
let autoLiteAssistEnabled = true;
let currentPerformanceMode = 'performance';
let forceI3Ram2GbModeEnabled = false;

function setLowSpecMode(enabled) {
  window.NHP_LOW_SPEC_MODE = !!enabled;
  window.NHP_IS_LIGHT_MODE = currentPerformanceMode !== 'performance';
  window.NHP_PERFORMANCE_MODE = currentPerformanceMode;
  document.body.classList.toggle('nhp-low-spec-mode', !!enabled);
  document.body.classList.toggle('nhp-light-mode', window.NHP_IS_LIGHT_MODE);
  const lowSpecBtn = document.getElementById('btn-low-spec-mode');
  if (lowSpecBtn) {
    const modeLabel = currentPerformanceMode[0].toUpperCase() + currentPerformanceMode.slice(1);
    lowSpecBtn.textContent = `Mode: ${modeLabel}`;
    lowSpecBtn.style.background = enabled ? '#14532d' : '#0f172a';
    lowSpecBtn.style.color = enabled ? '#bbf7d0' : '#cbd5e1';
    lowSpecBtn.style.borderColor = enabled ? '#166534' : '#334155';
  }
}

function getActivePerformanceProfile() {
  return PERFORMANCE_PROFILES[currentPerformanceMode] || PERFORMANCE_PROFILES.performance;
}

function decideAdaptivePerformanceMode() {
  if (forceI3Ram2GbModeEnabled) return 'ultra';
  const memory = Number(navigator.deviceMemory || 0);
  const queueSize = designQueue.length;

  if (queueSize >= 300 || (memory > 0 && memory <= 2)) return 'ultra';
  if (queueSize >= 220 || (memory > 0 && memory <= 4)) return 'lite';
  if (queueSize >= 90 || (memory > 4 && memory <= 8)) return 'balanced';
  return 'performance';
}

function setAdaptivePerformanceMode(mode, reason = 'runtime') {
  const nextMode = ['performance', 'balanced', 'lite', 'ultra'].includes(mode) ? mode : 'performance';
  const changed = currentPerformanceMode !== nextMode;
  if (!changed) return false;

  currentPerformanceMode = nextMode;
  setLowSpecMode(nextMode === 'lite' || nextMode === 'ultra');
  markStorageEchoSuppress(700);
  chrome.storage.local.set({
    [LOW_SPEC_MODE_KEY]: nextMode === 'lite' || nextMode === 'ultra',
    [PERFORMANCE_MODE_KEY]: nextMode
  });

  if (autoLiteAssistEnabled && reason !== 'manual') {
    showToast(`⚙️ Auto Mode: ${nextMode.toUpperCase()} (${reason})`, 1800);
  }
  return true;
}

function maybeAutoTunePerformance(reason = 'runtime') {
  if (!autoLiteAssistEnabled || isBatchProcessing || window.isBatchProcessing) return;
  const now = Date.now();
  if (now - autoTuneLastRunAt < 5000) return;
  autoTuneLastRunAt = now;
  const desiredMode = decideAdaptivePerformanceMode();
  setAdaptivePerformanceMode(desiredMode, reason);
}

function scheduleAutoTunePerformance(reason = 'runtime') {
  if (autoTuneScheduleTimeout) return;
  autoTuneScheduleTimeout = setTimeout(() => {
    autoTuneScheduleTimeout = null;
    maybeAutoTunePerformance(reason);
  }, 800);
}

function normalizeQueueItem(item) {
  if (!item || typeof item !== 'object') return null;
  const fileName = item.file?.name || item.name || 'design.png';
  const fileType = item.file?.type || item.type || 'image/png';
  return {
    ...item,
    file: { name: fileName, type: fileType }
  };
}

function serializeQueueItemForStorage(item) {
  const normalized = normalizeQueueItem(item);
  if (!normalized) return null;
  return {
    id: normalized.id,
    file: normalized.file,
    thumbnail: normalized.thumbnail || null,
    status: normalized.status || 'pending',
    progress: typeof normalized.progress === 'number' ? normalized.progress : 0,
    meta: normalized.meta || null
  };
}

function nhpGhostUrl(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  const normalized = p.startsWith('/') ? p : `/${p}`;
  if (window.NhpRuntimeConfig?.localUrl) {
    return window.NhpRuntimeConfig.localUrl(3019, normalized);
  }
  return `http://127.0.0.1:3019${normalized}`;
}

/** Full-res library PNG from TeeMaster edited saves (metadataOnly SEO queue). */
function getQueueLibraryImageUrl(item) {
  const libraryId = String(item?.meta?.libraryId || '').trim();
  if (libraryId) {
    return nhpGhostUrl(`/api/library/${encodeURIComponent(libraryId)}/download`);
  }
  const raw = item?.meta?.libraryImageUrl;
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http')) return trimmed;
  return nhpGhostUrl(trimmed);
}

async function repairQueueLibraryRefs(options = {}) {
  const { silent = true } = options;
  const needsRepair = designQueue.filter((item) => {
    if (!item?.meta) return false;
    if (item.meta.libraryId && !item.meta.libraryImageUrl) return true;
    if (item.meta.libraryImageUrl || item.meta.libraryId) return false;
    const src = String(item.meta.source || '').toLowerCase();
    return src.includes('teemaster') || src.includes('library') || src.includes('canva');
  });
  if (!needsRepair.length) return { repaired: 0 };

  let repaired = 0;
  for (const queueItem of needsRepair) {
    if (queueItem.meta.libraryId && !queueItem.meta.libraryImageUrl) {
      queueItem.meta.libraryImageUrl = `/api/library/${encodeURIComponent(queueItem.meta.libraryId)}/download`;
      repaired++;
      continue;
    }
  }

  const unresolved = needsRepair.filter((item) => !item.meta.libraryImageUrl && !item.meta.libraryId);
  if (!unresolved.length) {
    if (repaired > 0) {
      await saveQueueToStorage(true, { metadataOnly: true });
      renderQueue();
      if (!silent && typeof showToast === 'function') {
        showToast(`♻️ تم ربط ${repaired} تصميم بمكتبة Ghost`);
      }
    }
    return { repaired };
  }

  try {
    const res = await fetch(nhpGhostUrl('/api/library'));
    if (!res.ok) return { repaired, skipped: true };
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) return { repaired };

    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
    for (const queueItem of unresolved) {
      const filename = queueItem?.file?.name || queueItem?.name || '';
      if (!filename) continue;
      const targetNorm = norm(filename.replace(/\.[^.]+$/, ''));
      const match = items.find((libItem) =>
        norm(libItem.fileName?.replace(/\.[^.]+$/, '')) === targetNorm
        || norm(libItem.displayName) === targetNorm
        || norm(libItem.promptPreview) === targetNorm
      );
      if (!match?.id) continue;
      queueItem.meta = {
        ...queueItem.meta,
        libraryId: match.id,
        libraryImageUrl: `/api/library/${encodeURIComponent(match.id)}/download`
      };
      repaired++;
    }

    if (repaired > 0) {
      await saveQueueToStorage(true, { metadataOnly: true });
      renderQueue();
      if (!silent && typeof showToast === 'function') {
        showToast(`♻️ تم ربط ${repaired} تصميم بمكتبة Ghost`);
      }
    }
    return { repaired };
  } catch (error) {
    console.warn('[NHP] repairQueueLibraryRefs failed:', error?.message || error);
    return { repaired: 0, error: error?.message || String(error) };
  }
}

/** Grid thumbnail: prefer cached thumb — avoids broken tiny icons when library URL is down. */
function getQueueThumbSrc(item) {
  if (!item) return 'icon.png';
  if (item.thumbnail) return item.thumbnail;
  if (item.base64) {
    const b64 = item.base64;
    return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  }
  const libraryUrl = getQueueLibraryImageUrl(item);
  if (libraryUrl) return libraryUrl;
  return 'icon.png';
}

/** Full preview / lightbox: prefer library full-res when available. */
function getQueuePreviewSrc(item) {
  if (!item) return 'icon.png';
  const libraryUrl = getQueueLibraryImageUrl(item);
  if (libraryUrl) return libraryUrl;
  if (item.base64) {
    const b64 = item.base64;
    return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  }
  if (item.thumbnail) return item.thumbnail;
  return 'icon.png';
}

function buildQueueRenderFingerprint() {
  const max = getActivePerformanceProfile().queueMaxRender;
  return designQueue.slice(0, max).map((item) => {
    const thumb = getQueueThumbSrc(item);
    const thumbKey = thumb === 'icon.png' ? 'icon' : String(thumb).slice(0, 40);
    return `${item.id}:${item.status || 'pending'}:${thumbKey}`;
  }).join('|');
}

async function hydrateMissingQueueThumbnails() {
  const profile = getActivePerformanceProfile();
  const candidates = designQueue.filter((item) => getQueueThumbSrc(item) === 'icon.png');
  if (!candidates.length) return;

  let changed = false;
  for (const item of candidates) {
    try {
      const b64 = await NHPDatabase.getImage(item.id);
      if (!b64) continue;
      const dataUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
      const thumb = await createQueueThumbnail(dataUrl, profile.thumbnailWidth);
      if (!thumb) continue;
      item.thumbnail = thumb;
      changed = true;
      document.querySelectorAll(`#seo-queue .queue-item[data-id="${item.id}"] img, #ap-queue .queue-item[data-id="${item.id}"] img`)
        .forEach((img) => { img.src = thumb; });
    } catch (_) { /* per-item */ }
  }

  if (changed) {
    lastQueueRenderFingerprint = '';
    saveQueueToStorage(true, { metadataOnly: true }).catch(() => {});
  }
}

window.NHP_hydrateMissingQueueThumbnails = hydrateMissingQueueThumbnails;

window.NHP_queueThumbError = function queueThumbError(imgEl) {
  if (!imgEl || imgEl.dataset.nhpThumbRetry === '1') return;
  const itemId = imgEl.closest('.queue-item')?.getAttribute('data-id');
  if (!itemId) return;
  const item = designQueue.find((entry) => entry.id === itemId);
  if (!item) return;
  imgEl.dataset.nhpThumbRetry = '1';
  void (async () => {
    try {
      const b64 = await NHPDatabase.getImage(item.id);
      if (b64) {
        const dataUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
        const thumb = await createQueueThumbnail(dataUrl, getActivePerformanceProfile().thumbnailWidth);
        if (thumb) {
          item.thumbnail = thumb;
          imgEl.src = thumb;
          saveQueueToStorage(true, { metadataOnly: true }).catch(() => {});
          return;
        }
      }
      const fallback = getQueueThumbSrc(item);
      if (fallback && fallback !== 'icon.png' && fallback !== imgEl.src) {
        imgEl.src = fallback;
      }
    } catch (_) { /* ignore */ }
  })();
};

function createQueueThumbnail(dataUrl, maxWidth = 160) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function syncGlobalQueueReference() {
  window.designQueue = designQueue;
  window.getDesignQueue = () => designQueue;
}

function replaceDesignQueue(nextQueue) {
  designQueue = Array.isArray(nextQueue) ? nextQueue.map(normalizeQueueItem).filter(Boolean) : [];
  syncGlobalQueueReference();
}

syncGlobalQueueReference();

// Bridge Selectors for Infrastructure/Modules
const S = {
  get nicheSelect() { return document.getElementById('seo-niche-select'); },
  get imageInput() { return document.getElementById('seo-image-upload'); },
  get uploadTrigger() { return document.getElementById('seo-upload-trigger'); },
  get queueList() { return document.getElementById('seo-queue'); },
  get queueContainer() { return document.getElementById('seo-queue-container'); },
  get previewImg() { return document.getElementById('seo-img-preview'); },
  get previewFilename() { return document.getElementById('seo-current-filename'); },
  get previewWrap() { return document.getElementById('seo-preview-wrap'); },
  get genBtn() { return document.getElementById('seo-genBtn'); },
  get titleEl() { return document.getElementById('seo-title'); },
  get tagsEl() { return document.getElementById('seo-tags'); },
  get descEl() { return document.getElementById('seo-desc'); },
  get tpBtn() { return document.getElementById('seo-teepublicBtn'); },
  get loading() { return document.getElementById('seo-loading'); },
  get mainTagEl() { return document.getElementById('seo-main-tag'); }
};

const AP_SEO = {
  get previewImg() { return document.getElementById('ap-img-preview'); },
  get previewFilename() { return document.getElementById('ap-current-filename'); },
  get previewPanel() { return document.getElementById('ap-seo-preview'); },
  get queueCount() { return document.getElementById('ap-queue-count'); },
  get queueContainer() { return document.getElementById('ap-queue-container'); },
  get title() { return document.getElementById('ap-seo-title'); },
  get mainTag() { return document.getElementById('ap-seo-main-tag'); },
  get tags() { return document.getElementById('ap-seo-tags'); },
  get desc() { return document.getElementById('ap-seo-desc'); }
};

// ══════════════════════════════════════════════════════
//  GLOBAL INFRASTRUCTURE (Queue & Preview)
// ══════════════════════════════════════════════════════
window.showDesignPreview = async (id) => {
  const item = designQueue.find(i => i.id === id);
  if (!item) return;
  let previewSrc = getQueuePreviewSrc(item);

  // Fallback to IndexedDB if thumbnail is missing and base64 was cleared from RAM
  if (previewSrc === 'icon.png') {
      try {
          const b64 = await NHPDatabase.getImage(item.id);
          if (b64) previewSrc = `data:image/png;base64,${b64}`;
      } catch (e) {}
  }

  try {
    // 1. Update SEO Panel (Universal)
    if (S.previewImg) {
      S.previewImg.src = previewSrc;
      if (S.previewFilename) S.previewFilename.textContent = item.file.name;
      if (S.previewWrap) S.previewWrap.classList.remove('hidden');
    }

    // 2. Update Autopilot Panel
    if (AP_SEO.previewImg) {
      AP_SEO.previewImg.src = previewSrc;
      if (AP_SEO.previewFilename) AP_SEO.previewFilename.textContent = item.file.name;
      if (AP_SEO.previewPanel) AP_SEO.previewPanel.classList.remove('hidden');

      if (item.meta) {
        if (AP_SEO.title) AP_SEO.title.value = item.meta.title || '';
        if (AP_SEO.mainTag) AP_SEO.mainTag.value = item.meta.main_tag || '';
        if (AP_SEO.tags) AP_SEO.tags.value = Array.isArray(item.meta.tags) ? item.meta.tags.join(', ') : (item.meta.tags || '');
        if (AP_SEO.desc) AP_SEO.desc.value = item.meta.description || '';
      } else {
        if (AP_SEO.title) AP_SEO.title.value = '';
        if (AP_SEO.mainTag) AP_SEO.mainTag.value = '';
        if (AP_SEO.tags) AP_SEO.tags.value = '';
        if (AP_SEO.desc) AP_SEO.desc.value = '';
      }
    }

    // 3. Deep UI Refresh: Force update the SEO fields across all tabs via Bridge
    if (typeof window.NHP_SEO_Update === 'function') {
      window.NHP_SEO_Update(item.meta || null);
    }

    window.dispatchEvent(new CustomEvent('nhp:design-preview', {
      detail: { id, fileName: item.file?.name || '' }
    }));

    if (typeof queueLightboxIsOpen === 'function' && queueLightboxIsOpen()) {
      const lbId = queueLightboxState.items[queueLightboxState.index]?.queueId;
      if (lbId === id) void queueLightboxUpdateChrome();
    }
  } catch (err) {
    console.error('❌ SEO Preview Update Sync Error:', err);
  }
};

let renderQueueTimeout = null;
function renderQueue() {
  if (!document.getElementById('seo-queue') && !document.getElementById('ap-queue')) return;
  if (renderQueueTimeout) clearTimeout(renderQueueTimeout);
  const profile = getActivePerformanceProfile();
  const batchExtra = (isBatchProcessing || window.isBatchProcessing) ? 240 : 0;
  renderQueueTimeout = setTimeout(() => {
    renderQueueTimeout = null;
    actualRenderQueue();
  }, profile.queueRenderDebounceMs + batchExtra);
}
window.renderQueue = renderQueue;

function escapeQueueHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSeoOrAutopilotQueuePanelActive() {
  return __nhpActiveTabPanel === 'seo' || __nhpActiveTabPanel === 'autopilot';
}

function isAutopilotPanelActive() {
  return __nhpActiveTabPanel === 'autopilot'
    || document.getElementById('panel-autopilot')?.classList.contains('active');
}

function isLabPanelActive() {
  return __nhpActiveTabPanel === 'lab'
    || document.getElementById('panel-lab')?.classList.contains('active');
}

function actualRenderQueue() {
  const activeId = document.querySelector('.queue-item.active')?.getAttribute('data-id') || null;
  const countEl = document.getElementById('seo-queue-count');
  if (countEl) countEl.textContent = `${designQueue.length} ملفات`;
  if (AP_SEO.queueCount) AP_SEO.queueCount.textContent = `${designQueue.length} ملفات`;

  const duringBatch = isBatchProcessing || window.isBatchProcessing;
  if (!isSeoOrAutopilotQueuePanelActive() && !duringBatch) {
    const queueLabel = `${designQueue.length} ملفات`;
    const rbhCount = document.getElementById('rbh-shared-queue-count');
    const amhCount = document.getElementById('amh-shared-queue-count');
    if (rbhCount) rbhCount.textContent = queueLabel;
    if (amhCount) amhCount.textContent = queueLabel;
    window.dispatchEvent(new CustomEvent('nhp:queue-rendered', {
      detail: { count: designQueue.length, activeId, lightweight: true }
    }));
    return;
  }
  const renderFingerprint = buildQueueRenderFingerprint();
  if (duringBatch && designQueue.length === lastQueueRenderCount && renderFingerprint === lastQueueRenderFingerprint && designQueue.length > 0) {
    window.dispatchEvent(new CustomEvent('nhp:queue-rendered', {
      detail: { count: designQueue.length, activeId, lightweight: true }
    }));
    return;
  }
  lastQueueRenderCount = designQueue.length;
  lastQueueRenderFingerprint = renderFingerprint;

  const visibleQueue = designQueue.slice(0, getActivePerformanceProfile().queueMaxRender);

  const html = visibleQueue.map(item => `
    <div class="queue-item ${item.status === 'done' ? 'done' : ''} ${item.status === 'synced' ? 'synced' : ''} ${item.status === 'loading' ? 'loading' : ''} ${item.id === activeId ? 'active' : ''}" 
         data-id="${item.id}" title="${escapeQueueHtml(item.file.name)}">
        <img src="${getQueueThumbSrc(item)}" data-queue-id="${item.id}" loading="lazy" decoding="async" title="انقر للمعاينة" alt="${escapeQueueHtml(item.file.name)}" onerror="window.NHP_queueThumbError?.(this)">
        ${item.status === 'loading' ? '<div class="absolute inset-0 flex items-center justify-center bg-black/40"><div class="spinner-small" style="width:12px; height:12px;"></div></div>' : ' '}
        <button data-remove-id="${item.id}" class="remove-btn" 
                style="position:absolute; top:0; left:0; background:rgba(239, 68, 68, 0.8); color:white; border:none; width:14px; height:14px; font-size:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:0 0 4px 0;">✕</button>
    </div>
  `).join('');

  const seoQ = document.getElementById('seo-queue');
  const apQ = document.getElementById('ap-queue');
  if (seoQ) seoQ.innerHTML = html;
  if (apQ) apQ.innerHTML = html;

  const seoContainer = document.getElementById('seo-queue-container');
  const apContainer = document.getElementById('ap-queue-container');
  if (designQueue.length > 0) {
    if (seoContainer) seoContainer.classList.remove('hidden');
    if (apContainer) apContainer.classList.remove('hidden');
  } else {
    if (seoContainer) seoContainer.classList.add('hidden');
    if (apContainer) apContainer.classList.add('hidden');
  }

  window.dispatchEvent(new CustomEvent('nhp:queue-rendered', {
    detail: { count: designQueue.length, activeId }
  }));
  scheduleAutoTunePerformance('queue');
  void hydrateMissingQueueThumbnails();
}

function saveQueueToStorage(immediate = false, options = {}) {
  const metadataOnly = options?.metadataOnly === true;
  if (!immediate && (isBatchProcessing || window.isBatchProcessing)) return Promise.resolve(false);
  if (saveQueueTimeout) clearTimeout(saveQueueTimeout);

  const doSave = async () => {
    if (isSavingQueue) {
      pendingSave = true;
      return false;
    }
    isSavingQueue = true;
    try {
      if (!metadataOnly) {
        const pendingBase64 = designQueue.filter((item) => item?.base64);
        for (let item of pendingBase64) {
          try {
            await NHPDatabase.saveImage(item.id, item.base64);
            delete item.base64;
          } catch (e) {
            console.error('❌ IndexedDB Save Error:', e);
          }
        }
      }
      markStorageEchoSuppress(metadataOnly ? 900 : 1500);
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({
          savedDesignQueue: designQueue.map(serializeQueueItemForStorage).filter(Boolean)
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('❌ chrome.storage queue save failed:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || 'storage_save_failed'));
            return;
          }
          resolve();
        });
      });
    } finally {
      isSavingQueue = false;
      if (pendingSave) {
        pendingSave = false;
        saveQueueToStorage(true);
      }
    }
    return true;
  };

  if (immediate) {
    return doSave().catch((error) => {
      console.error('❌ Immediate queue save failed:', error);
      if (typeof showToast === 'function') {
        showToast('⚠️ فشل حفظ الطابور — مساحة التخزين ممتلئة أو البروفايل تغيّر');
      }
      return false;
    });
  }

  const saveDebounceMs = getActivePerformanceProfile().queueSaveDebounceMs;
  return new Promise((resolve) => {
    saveQueueTimeout = setTimeout(async () => {
      try {
        resolve(await doSave());
      } catch (error) {
        console.error('❌ Delayed queue save failed:', error);
        resolve(false);
      }
    }, saveDebounceMs);
  });
}
window.saveQueueToStorage = saveQueueToStorage;

/**
 * Recover designs saved in IndexedDB but missing from savedDesignQueue (e.g. crash mid-upload).
 */
async function recoverDesignQueueFromIndexedDB(options = {}) {
  const { silent = false, force = false } = options;
  const db = window.NHPDatabase || NHPDatabase;
  if (!db?.listAllImageIds) return { recovered: 0, skipped: true };

  let storedIds = [];
  try {
    storedIds = await db.listAllImageIds();
  } catch (error) {
    console.warn('Queue recovery: IndexedDB list failed', error);
    return { recovered: 0, error: error?.message || String(error) };
  }
  if (!storedIds.length) return { recovered: 0 };

  const known = new Set(designQueue.map((item) => String(item.id)));
  const orphans = storedIds.filter((id) => !known.has(id));
  if (!orphans.length) return { recovered: 0 };

  const shouldRecover = force || designQueue.length === 0;
  if (!shouldRecover) {
    return { recovered: 0, orphans: orphans.length, needsPrompt: true };
  }

  const recoveredItems = orphans.map((id) => ({
    id,
    file: { name: `recovered_${String(id).slice(0, 10)}.png`, type: 'image/png' },
    thumbnail: null,
    status: 'pending',
    meta: null
  }));

  replaceDesignQueue([...designQueue, ...recoveredItems]);

  for (const item of recoveredItems) {
    try {
      const b64 = await db.getImage(item.id);
      if (b64) {
        item.thumbnail = await createQueueThumbnail(`data:image/png;base64,${b64}`, 96);
      }
    } catch (_) { /* ignore per-item thumbnail errors */ }
  }

  await saveQueueToStorage(true);
  renderQueue();
  if (designQueue.length > 0) showDesignPreview(designQueue[0].id);

  if (!silent && typeof showToast === 'function') {
    showToast(`♻️ تم استعادة ${recoveredItems.length} تصميم من الذاكرة المحلية`);
  }

  return { recovered: recoveredItems.length, orphans: orphans.length };
}
window.recoverDesignQueueFromIndexedDB = recoverDesignQueueFromIndexedDB;

function removeFromQueue(id) {
  designQueue = designQueue.filter(i => i.id !== id);
  NHPDatabase.deleteImage(id).catch(console.error);
  syncGlobalQueueReference();
  if (designQueue.length === 0) {
    const seoContainer = document.getElementById('seo-queue-container');
    const seoPreview = document.getElementById('seo-preview-wrap');
    if (seoContainer) seoContainer.classList.add('hidden');
    if (seoPreview) seoPreview.classList.add('hidden');
    if (AP_SEO.queueContainer) AP_SEO.queueContainer.classList.add('hidden');
    if (AP_SEO.previewPanel) AP_SEO.previewPanel.classList.add('hidden');
  }
  renderQueue();
  saveQueueToStorage();
  if (queueLightboxIsOpen()) {
    if (!designQueue.length) {
      closeQueueLightbox();
      return;
    }
    const currentId = queueLightboxState.items[queueLightboxState.index]?.queueId;
    const nextItems = queueBuildLightboxItems();
    let nextIndex = nextItems.findIndex((item) => item.queueId === currentId);
    if (nextIndex < 0) nextIndex = Math.min(queueLightboxState.index, nextItems.length - 1);
    queueLightboxState = { items: nextItems, index: Math.max(0, nextIndex) };
    void queueLightboxUpdateChrome();
    const active = nextItems[queueLightboxState.index];
    if (active?.queueId) queueLightboxSyncActiveThumb(active.queueId);
  }
}
window.removeFromQueue = removeFromQueue;

// ══════════════════════════════════════════════════════
//  QUEUE LIGHTBOX (SEO + Autopilot — matches Generate library)
// ══════════════════════════════════════════════════════
let queueLightboxBound = false;
let queueLightboxState = { items: [], index: 0 };
let queueLightboxZoomCtrl = null;
const QUEUE_LB_ENTER_DELETE_MS = 800;
let queueLightboxEnterDeleteAt = 0;
let queueLightboxEnterDeleteTimer = null;
let queueNotePickerBound = false;
let queueNotePickerState = { queueId: null, items: [] };
let queueLightboxAiRenameRunning = false;
let queueLightboxSeoRunning = false;
const QUEUE_NOTE_MANAGER_KEY = 'teepublic_manager_data';
const QUEUE_AI_RENAME_BRIDGE_TIMEOUT_MS = 52000;
const QUEUE_AI_RENAME_IMAGE_MAX_WIDTH = 220;

function resetQueueLightboxEnterDelete() {
  queueLightboxEnterDeleteAt = 0;
  if (queueLightboxEnterDeleteTimer) {
    clearTimeout(queueLightboxEnterDeleteTimer);
    queueLightboxEnterDeleteTimer = null;
  }
}

function queueLightboxIsTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function ensureQueueLightboxZoom() {
  if (queueLightboxZoomCtrl) return queueLightboxZoomCtrl;
  const els = queueLightboxEls();
  queueLightboxZoomCtrl = createLightboxZoom({
    viewport: document.getElementById('queue-lightbox-viewport'),
    img: els.img,
    zoomInBtn: document.getElementById('queue-lightbox-zoom-in'),
    zoomOutBtn: document.getElementById('queue-lightbox-zoom-out'),
    zoomResetBtn: document.getElementById('queue-lightbox-zoom-reset'),
    zoomLevelEl: document.getElementById('queue-lightbox-zoom-level')
  });
  queueLightboxZoomCtrl.bind();
  return queueLightboxZoomCtrl;
}

function queueLightboxEls() {
  return {
    box: document.getElementById('queue-lightbox'),
    img: document.getElementById('queue-lightbox-img'),
    close: document.getElementById('queue-lightbox-close'),
    backdrop: document.getElementById('queue-lightbox-backdrop'),
    prev: document.getElementById('queue-lightbox-prev'),
    next: document.getElementById('queue-lightbox-next'),
    counter: document.getElementById('queue-lightbox-counter'),
    dl: document.getElementById('queue-lightbox-dl'),
    del: document.getElementById('queue-lightbox-del'),
    metaWrap: document.getElementById('queue-lightbox-meta'),
    filename: document.getElementById('queue-lightbox-filename'),
    seoEmpty: document.getElementById('queue-lightbox-seo-empty'),
    title: document.getElementById('queue-lightbox-title'),
    mainTag: document.getElementById('queue-lightbox-main-tag'),
    tags: document.getElementById('queue-lightbox-tags'),
    desc: document.getElementById('queue-lightbox-desc'),
    rename: document.getElementById('queue-lightbox-rename'),
    autoRename: document.getElementById('queue-lightbox-auto-rename'),
    genSeo: document.getElementById('queue-lightbox-gen-seo')
  };
}

function queueLightboxIsOpen() {
  const { box } = queueLightboxEls();
  return !!box && !box.classList.contains('is-hidden');
}

async function queueResolveFullSrc(item) {
  if (!item) return '';
  const libraryUrl = getQueueLibraryImageUrl(item);
  if (libraryUrl) return libraryUrl;
  if (item.base64) {
    const b = item.base64;
    return b.startsWith('data:') ? b : `data:image/png;base64,${b}`;
  }
  try {
    const b64 = await NHPDatabase.getImage(item.id);
    if (b64) return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
  } catch (_) { /* ignore */ }
  return getQueuePreviewSrc(item);
}

function queueBuildLightboxItems() {
  return designQueue.map((item) => ({
    queueId: item.id,
    alt: item.file?.name || 'تصميم',
    filename: item.file?.name || 'design.png',
    thumbSrc: getQueueThumbSrc(item),
    downloadFilename: item.file?.name || `nhp_design_${item.id}.png`
  }));
}

function getActiveQueueItemId() {
  return document.querySelector('#seo-queue .queue-item.active, #ap-queue .queue-item.active')?.getAttribute('data-id')
    || queueLightboxState.items[queueLightboxState.index]?.queueId
    || null;
}

function queueReadSeoFormFields() {
  if (isAutopilotPanelActive() && AP_SEO.title) {
    return {
      title: AP_SEO.title.value,
      main_tag: AP_SEO.mainTag?.value || '',
      tags: AP_SEO.tags?.value || '',
      description: AP_SEO.desc?.value || ''
    };
  }
  if (S.titleEl) {
    return {
      title: S.titleEl.value,
      main_tag: S.mainTagEl?.value || '',
      tags: S.tagsEl?.value || '',
      description: S.descEl?.value || ''
    };
  }
  return null;
}

function normalizeQueueMeta(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.Title || '').trim();
  const main_tag = String(raw.main_tag || raw.mainTag || raw.MainTag || '').trim();
  const description = String(raw.description || raw.Description || raw.desc || raw.Desc || '').trim();
  let tags = raw.tags;
  if (Array.isArray(tags)) {
    tags = tags.map((t) => String(t).trim()).filter(Boolean).join(', ');
  } else {
    tags = String(tags || '').trim();
  }
  if (!title && !main_tag && !tags && !description) return null;
  return { title, main_tag, tags, description };
}

function queueLightboxResolveMeta(queueItem, queueId) {
  const fromItem = normalizeQueueMeta(queueItem?.meta);
  if (fromItem) return fromItem;
  const activeId = getActiveQueueItemId();
  if (queueId && activeId === queueId) {
    return normalizeQueueMeta(queueReadSeoFormFields());
  }
  return null;
}

function sanitizeQueueFilenameBase(input) {
  return String(input || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'design';
}

function splitQueueFilenameParts(filename) {
  const name = String(filename || 'design.png');
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '.png' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function applyQueueItemRename(queueId, newBaseName) {
  const item = designQueue.find((i) => i.id === queueId);
  if (!item) return false;
  const { ext } = splitQueueFilenameParts(item.file?.name || 'design.png');
  const safeBase = sanitizeQueueFilenameBase(newBaseName);
  if (!safeBase) return false;
  const fullName = safeBase.includes('.') ? safeBase : `${safeBase}${ext}`;
  item.file = { ...item.file, name: fullName };

  const activeId = getActiveQueueItemId();
  if (activeId === queueId) {
    if (S.previewFilename) S.previewFilename.textContent = fullName;
    if (AP_SEO.previewFilename) AP_SEO.previewFilename.textContent = fullName;
  }

  renderQueue();
  saveQueueToStorage(true, { metadataOnly: true });
  queueLightboxSyncActiveThumb(queueId);

  if (queueLightboxIsOpen()) {
    const lbRef = queueLightboxState.items[queueLightboxState.index];
    if (lbRef?.queueId === queueId) {
      lbRef.filename = fullName;
      lbRef.downloadFilename = fullName;
      lbRef.alt = fullName;
      void queueLightboxUpdateChrome();
    }
  }

  window.dispatchEvent(new CustomEvent('nhp:queue-item-renamed', {
    detail: { id: queueId, fileName: fullName }
  }));
  return fullName;
}

function buildQueueAutoRenameBase(meta, currentFilename) {
  const { base } = splitQueueFilenameParts(currentFilename);
  const seed = String(meta?.main_tag || meta?.title || '').trim();
  if (seed) return sanitizeQueueFilenameBase(seed.replace(/[_-]+/g, ' '));
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+\d+\s*$/, '').trim();
  return sanitizeQueueFilenameBase(cleaned || base);
}

function queueExtractJsonObject(text = '') {
  const value = String(text || '').trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : value;
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

function queueIsLowQualityAiFilename(value = '') {
  const normalized = String(value || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized || normalized.length < 3) return true;
  const badPatterns = [
    /^chatgpt(?:_|\s)*image/i,
    /^extracted_/i,
    /^gemini(?:_|\s)*generated/i,
    /^generated(?:_|\s)*(?:image|img|design)/i,
    /^untitled/i,
    /^new(?:_|\s)*image/i,
    /^design$/i,
    /^image$/i
  ];
  return badPatterns.some((rx) => rx.test(normalized));
}

function normalizeQueueAiFilenameBase(value = '') {
  const withoutExt = String(value || '').replace(/\.[a-z0-9]+$/i, '');
  return withoutExt
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, ' ')
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .replace(/[\s_-]+/g, ' ')
    .trim()
    .slice(0, 80);
}

function parseQueueAiRenamePayload(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.error) return '';
    const raw = String(
      payload.filename
      || payload.file_name
      || payload.fileName
      || payload.name
      || payload.title
      || payload.result
      || payload.text
      || payload.content
      || ''
    ).trim();
    const base = normalizeQueueAiFilenameBase(raw);
    if (base && !queueIsLowQualityAiFilename(base)) return base;
    if (raw && !base) {
      const parsedNested = queueExtractJsonObject(raw);
      if (parsedNested) {
        const nested = parseQueueAiRenamePayload(parsedNested);
        if (nested) return nested;
      }
    }
  }
  const text = typeof payload === 'string'
    ? payload
    : (payload?.result || payload?.text || payload?.content || '');
  const parsed = queueExtractJsonObject(text);
  if (parsed) {
    const fromJson = parseQueueAiRenamePayload(parsed);
    if (fromJson) return fromJson;
  }
  const line = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) || '';
  const quoted = line.match(/"filename"\s*:\s*"([^"]+)"/i)?.[1]
    || line.match(/filename\s*[:=]\s*["']?([^"'\n]+)/i)?.[1];
  const candidate = normalizeQueueAiFilenameBase(quoted || line);
  if (candidate && !queueIsLowQualityAiFilename(candidate)) return candidate;
  return '';
}

function buildQueueAiRenamePrompt(meta, currentFilename) {
  const lines = [
    'You are naming a print-on-demand (POD) T-shirt design file for TeePublic / Amazon Merch.',
    '',
    `Current filename: ${currentFilename || 'unknown.png'}`
  ];
  if (meta?.title) lines.push(`SEO Title: ${meta.title}`);
  if (meta?.main_tag) lines.push(`Main tag: ${meta.main_tag}`);
  if (meta?.tags) lines.push(`Tags: ${meta.tags}`);
  if (meta?.description) lines.push(`Description: ${meta.description}`);
  lines.push(
    '',
    'Analyze the attached design image (if provided) and any SEO hints above.',
    'Generate ONE short, descriptive English filename for marketplace upload.',
    '',
    'Rules:',
    '- English only, 3-6 words, catchy and niche-specific',
    '- Spaces only — no special characters, no file extension',
    '- Describe what the design shows, not the file format',
    '- Avoid generic names: design, image, untitled, chatgpt image, extracted',
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{"filename":"Your Suggested Name Here"}'
  );
  return lines.join('\n');
}

function queueSendBridgeMessage(payload, timeoutMs = QUEUE_AI_RENAME_BRIDGE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      settle({ success: false, error: `انتهت مهلة الاتصال (${Math.round(timeoutMs / 1000)}ث)` });
    }, Math.max(1000, timeoutMs));
    try {
      chrome.runtime.sendMessage(payload, (res) => {
        if (chrome.runtime?.lastError) {
          settle({
            success: false,
            error: chrome.runtime.lastError.message || 'Extension background is unavailable.'
          });
          return;
        }
        settle(res || { success: false, error: 'Empty response from background.' });
      });
    } catch (err) {
      settle({ success: false, error: err?.message || 'Failed to reach extension background.' });
    }
  });
}

async function queueGetProxyRoutingMode() {
  try {
    const res = await queueSendBridgeMessage({ action: 'get_proxy_routing_info' }, 8000);
    if (res?.success && res.routingMode) return res.routingMode;
  } catch (_) { /* ignore */ }
  return 'distributed';
}

async function queueResolveGptApiKey() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['nhpGptApiKey', 'nhpAdminAiKeys'], (res) => {
        const adminKeys = res?.nhpAdminAiKeys || {};
        const domKey = document.getElementById('seo-api-key-gpt')?.value?.trim() || '';
        resolve(String(adminKeys.gpt || domKey || res?.nhpGptApiKey || '').trim());
      });
    } catch (_) {
      resolve('');
    }
  });
}

async function queueCreateAiThumbnail(imageSrc, maxWidth = QUEUE_AI_RENAME_IMAGE_MAX_WIDTH) {
  const raw = String(imageSrc || '').trim();
  if (!raw) return null;
  const dataUrl = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function queuePrepareAiImagePayload(imageSrc) {
  const raw = String(imageSrc || '').trim();
  if (!raw) return { base64: null, mimeType: 'image/jpeg' };
  const maxWidth = window.NHP_IS_LIGHT_MODE || window.NHP_LOW_SPEC_MODE ? 140 : QUEUE_AI_RENAME_IMAGE_MAX_WIDTH;
  try {
    const thumb = await queueCreateAiThumbnail(raw, maxWidth);
    if (thumb) {
      return {
        base64: thumb,
        mimeType: thumb.match(/^data:([^;,]+)/i)?.[1] || 'image/jpeg'
      };
    }
  } catch (_) { /* fall through */ }
  const dataUrl = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
  return {
    base64: dataUrl,
    mimeType: dataUrl.match(/^data:([^;,]+)/i)?.[1] || 'image/png'
  };
}

async function queueRequestAiRenameSuggestion({ meta, currentFilename, imageSrc }) {
  const apiKey = await queueResolveGptApiKey();
  const proxyRoutingMode = await queueGetProxyRoutingMode();
  const prompt = buildQueueAiRenamePrompt(meta, currentFilename);
  const { base64, mimeType } = await queuePrepareAiImagePayload(imageSrc);

  const response = await queueSendBridgeMessage({
    action: 'call_gpt',
    prompt,
    base64: base64 || undefined,
    mimeType,
    apiKey: apiKey || undefined,
    proxyRoutingMode,
    retryContext: 'queue-rename',
    persistentRetry: false,
    maxAttempts: 4,
    fetchTimeoutMs: 25000
  });

  if (!response?.success) {
    const err = response?.error || 'فشل طلب الذكاء الاصطناعي.';
    if (/api key is missing/i.test(err)) {
      return { error: 'مفتاح GPT API غير موجود — أضفه من إعدادات SEO.' };
    }
    return { error: err };
  }

  const data = response.data;
  if (data?.error) return { error: String(data.error) };

  const filename = parseQueueAiRenamePayload(data);
  if (!filename) {
    return { error: 'لم يُرجع الذكاء الاصطناعي اسمًا صالحًا.' };
  }
  return { filename };
}

function queueLightboxSetSeoLine(el, label, value) {
  if (!el) return;
  const text = String(value || '').trim();
  if (!text) {
    el.textContent = '';
    el.classList.add('is-hidden');
    return;
  }
  el.textContent = `${label}: ${text}`;
  el.classList.remove('is-hidden');
}

function queueLightboxSyncActiveThumb(queueId) {
  if (!queueId) return;
  document.querySelectorAll('#seo-queue .queue-item, #ap-queue .queue-item').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-id') === queueId);
  });
}

async function queueLightboxUpdateChrome() {
  const els = queueLightboxEls();
  const { items, index } = queueLightboxState;
  const ref = items[index];
  if (!els.box || !els.img || !ref) return;

  const queueItem = designQueue.find((i) => i.id === ref.queueId);
  const src = queueItem
    ? await queueResolveFullSrc(queueItem)
    : (ref.thumbSrc || 'icon.png');

  els.img.src = src || ref.thumbSrc || 'icon.png';
  els.img.alt = ref.alt || 'معاينة';

  const filename = queueItem?.file?.name || ref.filename || 'design.png';
  if (els.filename) els.filename.textContent = filename;

  const meta = queueLightboxResolveMeta(queueItem, ref.queueId);
  const tagsText = meta?.tags || '';
  const hasSeo = !!meta;
  if (els.metaWrap) els.metaWrap.classList.toggle('is-empty', !hasSeo);
  if (els.seoEmpty) els.seoEmpty.classList.toggle('is-hidden', hasSeo);
  queueLightboxSetSeoLine(els.title, 'العنوان', meta?.title);
  queueLightboxSetSeoLine(els.mainTag, 'الطاك الرئيسي', meta?.main_tag);
  queueLightboxSetSeoLine(els.tags, 'التاجات', tagsText);
  queueLightboxSetSeoLine(els.desc, 'الوصف', meta?.description);

  const multi = items.length > 1;
  els.prev?.classList.toggle('is-hidden', !multi);
  els.next?.classList.toggle('is-hidden', !multi);
  if (els.prev) els.prev.disabled = !multi || index <= 0;
  if (els.next) els.next.disabled = !multi || index >= items.length - 1;

  if (els.counter) {
    els.counter.classList.toggle('is-hidden', !multi);
    els.counter.textContent = multi ? `${index + 1} / ${items.length}` : '';
  }
}

async function openQueueLightbox(queueId, options = {}) {
  const items = queueBuildLightboxItems();
  if (!items.length || !queueId) return;
  const idx = items.findIndex((item) => item.queueId === queueId);
  queueLightboxState = { items, index: idx >= 0 ? idx : 0 };

  const { box } = queueLightboxEls();
  if (!box) return;

  await queueLightboxUpdateChrome();
  queueLightboxSyncActiveThumb(queueId);
  if (options.syncPreview !== false && typeof showDesignPreview === 'function') {
    showDesignPreview(queueId);
  }

  resetQueueLightboxEnterDelete();
  box.classList.remove('is-hidden');
  box.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
window.openQueueLightbox = openQueueLightbox;

function closeQueueLightbox() {
  const { box, img } = queueLightboxEls();
  if (!box) return;
  closeQueueNotePicker();
  resetQueueLightboxEnterDelete();
  queueLightboxZoomCtrl?.reset();
  box.classList.add('is-hidden');
  box.setAttribute('aria-hidden', 'true');
  if (img) {
    img.removeAttribute('src');
    img.alt = '';
  }
  queueLightboxState = { items: [], index: 0 };
  document.body.style.overflow = '';
}
window.closeQueueLightbox = closeQueueLightbox;

async function queueLightboxGo(delta) {
  const { items, index } = queueLightboxState;
  if (items.length <= 1) return;
  const next = index + delta;
  if (next < 0 || next >= items.length) return;
  resetQueueLightboxEnterDelete();
  queueLightboxState.index = next;
  const ref = items[next];
  await queueLightboxUpdateChrome();
  if (ref?.queueId) {
    queueLightboxSyncActiveThumb(ref.queueId);
    if (typeof showDesignPreview === 'function') showDesignPreview(ref.queueId);
  }
}

function queueTriggerDownload(src, filename) {
  if (!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = filename || `nhp_${Date.now()}.png`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function queueLightboxDownloadCurrent() {
  const ref = queueLightboxState.items[queueLightboxState.index];
  if (!ref) return;
  const queueItem = designQueue.find((i) => i.id === ref.queueId);
  const src = queueItem ? await queueResolveFullSrc(queueItem) : ref.thumbSrc;
  if (!src) return;
  queueTriggerDownload(src, ref.downloadFilename || ref.filename || 'design.png');
}

function queueNotePickerEls() {
  return {
    box: document.getElementById('queue-note-picker'),
    backdrop: document.getElementById('queue-note-picker-backdrop'),
    close: document.getElementById('queue-note-picker-close'),
    search: document.getElementById('queue-note-picker-search'),
    list: document.getElementById('queue-note-picker-list'),
    empty: document.getElementById('queue-note-picker-empty')
  };
}

function queueNotePickerIsOpen() {
  const { box } = queueNotePickerEls();
  return !!box && !box.classList.contains('is-hidden');
}

function queueExtractNoteLabel(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string' || typeof entry === 'number') {
    return String(entry).trim();
  }
  return String(
    entry.text
    || entry.key
    || entry.title
    || entry.name
    || entry.keyword
    || entry.niche
    || ''
  ).trim();
}

function queueGetNotesListItems() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([QUEUE_NOTE_MANAGER_KEY, 'nhp_current_niche_context'], (res) => {
        const data = res?.[QUEUE_NOTE_MANAGER_KEY] || {};
        const items = [];
        const seen = new Set();
        const pushLabel = (rawLabel, source = 'niche') => {
          const text = queueExtractNoteLabel(rawLabel);
          if (!text || !/\S/.test(text)) return;
          const key = text.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          items.push({
            id: `${source}:${key}`,
            text,
            source
          });
        };

        pushLabel(res?.nhp_current_niche_context, 'current');
        (Array.isArray(data.niches) ? data.niches : []).forEach((entry) => pushLabel(entry, 'niche'));
        (Array.isArray(data.unofficialTrends) ? data.unofficialTrends : []).forEach((entry) => pushLabel(entry, 'trend'));
        (Array.isArray(data.history) ? data.history : []).forEach((batch) => {
          (Array.isArray(batch?.niches) ? batch.niches : []).forEach((entry) => pushLabel(entry, 'history'));
        });

        resolve(items);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

function queueRenderNotePickerList(filter = '') {
  const { list, empty } = queueNotePickerEls();
  if (!list) return;
  const needle = String(filter || '').trim().toLowerCase();
  const allItems = queueNotePickerState.items;
  const matches = allItems.filter((item) => (
    !needle || item.text.toLowerCase().includes(needle)
  ));
  const frag = document.createDocumentFragment();

  matches.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'queue-note-picker-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'queue-note-picker-item';
    btn.title = item.text;
    btn.setAttribute('aria-label', item.text);

    const label = document.createElement('span');
    label.className = 'queue-note-picker-item-text';
    label.textContent = item.text;
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      void queueApplyNotePickerSelection(item.text);
    });
    li.appendChild(btn);
    frag.appendChild(li);
  });

  list.replaceChildren(frag);

  if (empty) {
    const hasAny = allItems.length > 0;
    const showEmpty = matches.length === 0;
    empty.classList.toggle('is-hidden', !showEmpty);
    if (showEmpty) {
      empty.textContent = hasAny
        ? 'لا توجد نتائج مطابقة للبحث.'
        : 'لا توجد ملاحظات في القائمة — أضف نيتشات من تبويب Notes أولاً.';
    }
  }
}

function closeQueueNotePicker() {
  const { box, search } = queueNotePickerEls();
  if (!box) return;
  box.classList.add('is-hidden');
  box.setAttribute('aria-hidden', 'true');
  if (search) search.value = '';
  queueNotePickerState = { queueId: null, items: [] };
}

async function openQueueNotePicker(queueId) {
  if (!queueId) return;
  const items = await queueGetNotesListItems();
  queueNotePickerState = { queueId, items };
  const { box, search } = queueNotePickerEls();
  if (!box) return;
  queueRenderNotePickerList('');
  box.classList.remove('is-hidden');
  box.setAttribute('aria-hidden', 'false');
  if (search) {
    search.value = '';
    if (items.length) search.focus();
  }
  if (!items.length && typeof showToast === 'function') {
    showToast('⚠️ قائمة Notes فارغة — أضف نيتشات من تبويب Notes');
  }
}

async function queueApplyNotePickerSelection(noteText) {
  const queueId = queueNotePickerState.queueId;
  const trimmed = String(noteText || '').trim();
  closeQueueNotePicker();
  if (!queueId || !trimmed) return;
  const result = applyQueueItemRename(queueId, trimmed);
  if (result && typeof showToast === 'function') {
    showToast(`✅ تمت التسمية من Notes: ${result}`);
  }
}

function bindQueueNotePicker() {
  if (queueNotePickerBound) return;
  queueNotePickerBound = true;
  const els = queueNotePickerEls();
  els.close?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeQueueNotePicker();
  });
  els.backdrop?.addEventListener('click', () => closeQueueNotePicker());
  els.search?.addEventListener('input', () => {
    queueRenderNotePickerList(els.search?.value || '');
  });
  els.search?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      closeQueueNotePicker();
    }
  });
}

function queueLightboxManualRename() {
  const ref = queueLightboxState.items[queueLightboxState.index];
  if (!ref?.queueId) return;
  void openQueueNotePicker(ref.queueId);
}

async function queueLightboxAutoRename() {
  if (queueLightboxAiRenameRunning) return;
  const ref = queueLightboxState.items[queueLightboxState.index];
  if (!ref?.queueId) return;

  const els = queueLightboxEls();
  const btn = els.autoRename;
  const originalHtml = btn?.innerHTML || '';
  queueLightboxAiRenameRunning = true;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري التسمية بالذكاء...';
  }
  if (typeof showToast === 'function') showToast('🤖 جاري التسمية بالذكاء...');

  try {
    const queueItem = designQueue.find((i) => i.id === ref.queueId);
    const meta = queueLightboxResolveMeta(queueItem, ref.queueId);
    const current = queueItem?.file?.name || ref.filename || 'design.png';
    const imageSrc = queueItem ? await queueResolveFullSrc(queueItem) : '';

    const suggestion = await queueRequestAiRenameSuggestion({
      meta,
      currentFilename: current,
      imageSrc
    });

    if (suggestion.error) {
      if (typeof showToast === 'function') showToast(`⚠️ ${suggestion.error}`);
      return;
    }

    const result = applyQueueItemRename(ref.queueId, suggestion.filename);
    if (result && typeof showToast === 'function') {
      showToast(`✅ تسمية بالذكاء: ${result}`);
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`⚠️ فشل التسمية بالذكاء: ${err?.message || 'خطأ غير معروف'}`);
    }
  } finally {
    queueLightboxAiRenameRunning = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function queueLightboxGenerateSeo() {
  if (queueLightboxSeoRunning) return;
  const ref = queueLightboxState.items[queueLightboxState.index];
  if (!ref?.queueId) return;
  if (typeof window.NHP_SEO_GenerateForItem !== 'function') {
    if (typeof showToast === 'function') showToast('⚠️ توليد SEO غير متاح — افتح تبويب SEO أولاً');
    return;
  }

  const els = queueLightboxEls();
  const btn = els.genSeo;
  const originalHtml = btn?.innerHTML || '';
  queueLightboxSeoRunning = true;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> جاري التوليد...';
  }

  try {
    await window.NHP_SEO_GenerateForItem(ref.queueId);
    await queueLightboxUpdateChrome();
    queueLightboxSyncActiveThumb(ref.queueId);
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`⚠️ فشل توليد SEO: ${err?.message || 'خطأ غير معروف'}`);
    }
  } finally {
    queueLightboxSeoRunning = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

window.NHP_refreshQueueLightbox = (queueId) => {
  if (!queueLightboxIsOpen()) return;
  const currentId = queueLightboxState.items[queueLightboxState.index]?.queueId;
  if (!queueId || queueId === currentId) void queueLightboxUpdateChrome();
};
window.NHP_applyQueueItemRename = applyQueueItemRename;
window.NHP_buildQueueAutoRenameBase = buildQueueAutoRenameBase;

async function queueLightboxDeleteCurrent(options = {}) {
  const { skipConfirm = false } = options;
  const ref = queueLightboxState.items[queueLightboxState.index];
  if (!ref?.queueId) return;
  if (!skipConfirm && !confirm('حذف هذا التصميم من القائمة؟')) return;
  resetQueueLightboxEnterDelete();

  const deletedIndex = queueLightboxState.index;
  removeFromQueue(ref.queueId);
  if (typeof showToast === 'function') showToast('🗑️ تم حذف الصورة من الطابور');

  const nextItems = queueBuildLightboxItems();
  if (!nextItems.length) {
    closeQueueLightbox();
    return;
  }
  const nextIndex = Math.min(deletedIndex, nextItems.length - 1);
  queueLightboxState = { items: nextItems, index: nextIndex };
  await queueLightboxUpdateChrome();
  const active = nextItems[nextIndex];
  if (active?.queueId) {
    queueLightboxSyncActiveThumb(active.queueId);
    if (typeof showDesignPreview === 'function') showDesignPreview(active.queueId);
  }
}

function bindQueueLightbox() {
  if (queueLightboxBound) return;
  queueLightboxBound = true;
  ensureQueueLightboxZoom();
  bindQueueNotePicker();

  const els = queueLightboxEls();
  els.close?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeQueueLightbox();
  });
  els.backdrop?.addEventListener('click', () => closeQueueLightbox());
  els.prev?.addEventListener('click', (e) => {
    e.stopPropagation();
    void queueLightboxGo(-1);
  });
  els.next?.addEventListener('click', (e) => {
    e.stopPropagation();
    void queueLightboxGo(1);
  });
  els.dl?.addEventListener('click', (e) => {
    e.stopPropagation();
    void queueLightboxDownloadCurrent();
  });
  els.del?.addEventListener('click', (e) => {
    e.stopPropagation();
    void queueLightboxDeleteCurrent();
  });
  els.rename?.addEventListener('click', (e) => {
    e.stopPropagation();
    queueLightboxManualRename();
  });
  els.autoRename?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeQueueNotePicker();
    void queueLightboxAutoRename();
  });
  els.genSeo?.addEventListener('click', (e) => {
    e.stopPropagation();
    void queueLightboxGenerateSeo();
  });

  window.addEventListener('nhp:queue-rendered', () => {
    if (queueLightboxIsOpen()) void queueLightboxUpdateChrome();
  });

  document.addEventListener('keydown', (e) => {
    if (!queueLightboxIsOpen()) return;
    if (queueLightboxIsTypingTarget(e.target)) return;

    if (e.key === 'Escape') {
      if (queueNotePickerIsOpen()) {
        e.preventDefault();
        e.stopPropagation();
        closeQueueNotePicker();
        return;
      }
      closeQueueLightbox();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      void queueLightboxGo(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      void queueLightboxGo(1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const now = Date.now();
      if (
        queueLightboxEnterDeleteAt
        && (now - queueLightboxEnterDeleteAt) <= QUEUE_LB_ENTER_DELETE_MS
      ) {
        void queueLightboxDeleteCurrent({ skipConfirm: true });
        return;
      }
      queueLightboxEnterDeleteAt = now;
      if (queueLightboxEnterDeleteTimer) clearTimeout(queueLightboxEnterDeleteTimer);
      queueLightboxEnterDeleteTimer = setTimeout(
        resetQueueLightboxEnterDelete,
        QUEUE_LB_ENTER_DELETE_MS
      );
      if (typeof showToast === 'function') {
        showToast('اضغط Enter مرة أخرى للحذف', 1500);
      }
      return;
    }
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      resetQueueLightboxEnterDelete();
    }
  });

  document.addEventListener('click', (e) => {
    const itemEl = e.target.closest('#seo-queue .queue-item, #ap-queue .queue-item');
    if (!itemEl || e.target.closest('.remove-btn')) return;
    const id = itemEl.getAttribute('data-id');
    if (id) void openQueueLightbox(id, { syncPreview: false });
  });
}

bindQueueLightbox();

function bindOptionalClick(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.addEventListener('click', handler);
}

const panelLoaders = new Map();
const panelLoadPromises = new Map();
const loadedPanels = new Set();
const LAZY_ONLY_PANELS = new Set(['amazon', 'redbubble', 'admin']);
const EAGER_PANEL_ORDER = ['dashboard', 'tmh', 'note', 'studio', 'lab', 'seo', 'autopilot', 'social'];
// Performance mode: avoid preloading heavy panels to keep tab switching snappy.
const ENABLE_EAGER_PANEL_PRELOAD = false;

function registerPanelLoader(tabName, loader) {
  panelLoaders.set(tabName, loader);
}

function ensurePanelLoaded(tabName) {
  if (!tabName || loadedPanels.has(tabName)) return Promise.resolve();
  const existingPromise = panelLoadPromises.get(tabName);
  if (existingPromise) return existingPromise;

  const loader = panelLoaders.get(tabName);
  if (!loader) return Promise.resolve();

  const promise = Promise.resolve()
    .then(loader)
    .then(() => {
      loadedPanels.add(tabName);
    })
    .catch((err) => {
      console.error(`Panel Load Error [${tabName}]`, err);
      throw err;
    })
    .finally(() => {
      panelLoadPromises.delete(tabName);
    });

  panelLoadPromises.set(tabName, promise);
  return promise;
}

window.NHP_ensurePanelLoaded = ensurePanelLoaded;

async function loadPanelHtml(panelId, htmlPath, initCb, errorLabel, contentSelector) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const target = contentSelector ? panel.querySelector(contentSelector) : panel;
  if (!target) return;
  // Preserve browser cache for static html files; versioned paths still invalidate normally via ?v=...
  const response = await fetch(htmlPath, { cache: 'default' });
  const html = await response.text();
  target.innerHTML = html;
  if (typeof initCb === 'function') {
    await Promise.resolve(initCb());
  }
}

function scheduleDeferredPanelPreload(activeTab) {
  // Lazy-only panels must stay unloaded until the user opens them.
}

function scheduleDeferredPanelPreloadHeavy(activeTab) {
  const preloadOrder = Array.from(LAZY_ONLY_PANELS);
  let delayMs = 250;

  preloadOrder
    .filter((tab) => tab !== activeTab)
    .forEach((tabName) => {
      setTimeout(() => {
        ensurePanelLoaded(tabName).catch(() => {});
      }, delayMs);
      delayMs += 250;
    });
}

function loadEagerPanels(activeTab) {
  if (!ENABLE_EAGER_PANEL_PRELOAD) return;
  let delayMs = 120;
  EAGER_PANEL_ORDER
    .filter((tabName) => tabName !== activeTab)
    .forEach((tabName) => {
      setTimeout(() => {
        ensurePanelLoaded(tabName).catch(() => {});
      }, delayMs);
      delayMs += 120;
    });
}

// ══════════════════════════════════════════════════════
//  TAB SWITCHING  (event listeners — NO inline onclick)
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
//  UI AUTO-NAVIGATION (PIPELINE VISUALS)
// ══════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === 'SWITCH_TAB_UI') {
    switchTab(req.tab);
    return;
  }
  if (req.action === 'ap_queue_state' && req.data) {
    if (isDashboardPanelActive()) renderDashboardQueueMonitor(req.data);
  }
});

const NHP_PENDING_GENERATE_FROM_IMAGE_KEY = 'nhpPendingGenerateFromImage';

async function runGenerateFromFloatingPayload(payload = {}) {
  await ensurePanelLoaded('generate');
  switchTab('generate');
  const run = typeof window.NHP_handlePromptBagGenerate === 'function'
    ? window.NHP_handlePromptBagGenerate
    : (typeof window.NHP_injectAndGenerate === 'function'
      ? window.NHP_injectAndGenerate
      : handlePromptBagGenerate);
  await run({
    prompt: payload.prompt || '',
    imageDataUrl: payload.imageDataUrl || payload.dataUrl || '',
    imageUrl: payload.imageUrl || payload.imageDataUrl || '',
    name: payload.name || 'floating-image.png'
  });
}

async function consumePendingGenerateFromImage() {
  return await new Promise((resolve) => {
    chrome.storage.local.get([NHP_PENDING_GENERATE_FROM_IMAGE_KEY], (res) => {
      const pending = res?.[NHP_PENDING_GENERATE_FROM_IMAGE_KEY];
      if (!pending || !String(pending.imageDataUrl || '').startsWith('data:image/')) {
        resolve(false);
        return;
      }
      chrome.storage.local.remove(NHP_PENDING_GENERATE_FROM_IMAGE_KEY, () => {
        void runGenerateFromFloatingPayload(pending).then(() => resolve(true)).catch(() => resolve(false));
      });
    });
  });
}

// Prompt Bag → Generate: handled solely by generate.js (generateBindPromptBagBridge).
// Do NOT add a second postMessage listener here — it caused duplicate tabs/generation.

function bindFloatingGenerateBridge() {
  if (window.__nhpFloatingGenerateBridge) return;
  window.__nhpFloatingGenerateBridge = true;

  chrome.runtime.onMessage.addListener((req) => {
    if (req?.action !== 'GENERATE_FROM_IMAGE') return;
    void runGenerateFromFloatingPayload(req);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[NHP_PENDING_GENERATE_FROM_IMAGE_KEY]?.newValue) return;
    const pending = changes[NHP_PENDING_GENERATE_FROM_IMAGE_KEY].newValue;
    if (!String(pending?.imageDataUrl || '').startsWith('data:image/')) return;
    chrome.storage.local.remove(NHP_PENDING_GENERATE_FROM_IMAGE_KEY);
    void runGenerateFromFloatingPayload(pending);
  });

  setTimeout(() => { void consumePendingGenerateFromImage(); }, 800);
}
bindFloatingGenerateBridge();

/** Resolved panel name last applied by switchTab (skips redundant DOM work). */
let __nhpActiveTabPanel = null;

let activeTabPersistTimer = null;
let pendingActiveTabValue = null;
const MARKETS_STORAGE_KEY = 'nhp_markets_tab';
const TASK_PROGRESS_STORAGE_KEYS = [
  'dashboardTaskProgress',
  'usptoTaskProgress',
  'analysisTaskProgress',
  'usptoProgress',
  'analysisProgress'
];
const AP_UPLOAD_QUEUE_STATE_KEY = 'ap_upload_queue_state';
const DASHBOARD_STORAGE_KEYS = [
  'tpTotal', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpPending', 'tpRunning', 'tpDailyLimit',
  'ap_accounts', 'ap_accounts_teepublic', 'ap_accounts_redbubble', 'ap_accounts_amazon', 'ap_accounts_pinterest',
  'teepublic_manager_data',
  'uSafe', 'uBanned', 'uErrors', 'uPending', 'uTotal', 'uRunning',
  AP_UPLOAD_QUEUE_STATE_KEY,
  ...TASK_PROGRESS_STORAGE_KEYS
];
const DASHBOARD_QUEUE_TTL_MS = 2800;
let dashboardDataFingerprint = '';
let dashboardQueueFetchTimer = null;
let dashboardQueueFetchInFlight = false;
let dashboardLastQueueFetchAt = 0;
let dashboardBootstrapped = false;
const marketsGlobalTabMap = {
  amazon: 'tab-amazon',
  redbubble: 'tab-redbubble',
  pinterest: 'tab-social'
};
let globalNavWired = false;

function schedulePersistActiveTab(name) {
  pendingActiveTabValue = name;
  clearTimeout(activeTabPersistTimer);
  activeTabPersistTimer = setTimeout(() => {
    activeTabPersistTimer = null;
    const tab = pendingActiveTabValue;
    pendingActiveTabValue = null;
    if (tab != null) {
      chrome.storage.local.set({ activeTab: tab });
    }
  }, 220);
}

function flushPersistActiveTab() {
  clearTimeout(activeTabPersistTimer);
  activeTabPersistTimer = null;
  if (pendingActiveTabValue != null) {
    chrome.storage.local.set({ activeTab: pendingActiveTabValue });
    pendingActiveTabValue = null;
  }
}

function getDashboardHeaderButtons() {
  const navRoot = document.getElementById('header-nav-groups');
  if (!navRoot) return [];

  const buttons = new Set();
  const exactIdBtn = document.getElementById('nav-dashboard');
  if (exactIdBtn) buttons.add(exactIdBtn);

  navRoot.querySelectorAll('.nav-btn').forEach((btn) => {
    const onclickValue = String(btn.getAttribute('onclick') || '').toLowerCase();
    const labelText = String(btn.textContent || '').trim();
    const dataRoute = String(btn.dataset.route || '').toLowerCase();
    const isDashboardBtn =
      dataRoute === 'dashboard' ||
      btn.id === 'nav-dashboard' ||
      onclickValue.includes("switchtab('dashboard')") ||
      labelText.toLowerCase() === 'home' ||
      labelText.toLowerCase().endsWith(' home');
    if (isDashboardBtn) buttons.add(btn);
  });

  return Array.from(buttons);
}

export function switchTab(name) {
  name = String(name || '').trim().toLowerCase();
  if (name === 'notes') name = 'note';
  if (name === 'lab' || name === 'radar') name = 'note';
  if (name === 'automation') name = 'seo';
  if (name === 'promptbag') name = 'generate';
  
  if (name === 'studio') {
    window.__nhpStudioMode = 'normal';
  }

  const knownPanels = [
    'dashboard', 'trend', 'tmsearch', 'tmh', 'uspto', 'teepublic',
    'note', 'studio', 'generate', 'canva-bridge', 'lab', 'seo', 'autopilot', 'creaty',
    'admin', 'social', 'redbubble', 'amazon'
  ];
  if (!knownPanels.includes(name)) {
    name = 'dashboard';
  }

  const requestedTmh = name === 'tmh';
  if (requestedTmh) {
    name = 'admin';
    setTimeout(() => {
      const btn = document.getElementById('btn-admin-open-tmhunt');
      if (btn) btn.click();
    }, 0);
  }

  lazyInitializeEmbeddedTab(name);

  if (__nhpActiveTabPanel === name && !requestedTmh) {
    ensurePanelLoaded(name).then(() => {
      if (typeof updateWorkspaceNavigationUI === 'function') {
        updateWorkspaceNavigationUI(name);
      }
    }).catch(() => {});
    schedulePersistActiveTab(name);
    if (name === 'dashboard') scheduleDashboardRefresh();
    return;
  }
  cleanupActiveTab();
  __nhpActiveTabPanel = name;

  ensurePanelLoaded(name).then(() => {
    if (typeof updateWorkspaceNavigationUI === 'function') {
      updateWorkspaceNavigationUI(name);
    }
  }).catch(() => {});

  // Lightweight nav logic: update active icon only.
  const listItems = document.querySelectorAll('.navigation ul li');

  listItems.forEach(li => li.classList.remove('active'));

  const activeLi = document.getElementById('li-' + name);
  if (activeLi) {
    activeLi.classList.add('active');
  }
  document.querySelectorAll('.nav-dd-panel > a[id^="tab-"]').forEach((tabEl) => {
    tabEl.classList.remove('is-active');
  });
  const activeTopNav = document.getElementById('tab-' + name);
  if (activeTopNav) {
    activeTopNav.classList.add('is-active');
  }
  document.querySelectorAll('#header-nav-groups .nav-btn, #header-nav-groups .nav-top-btn').forEach((btn) => {
    btn.classList.remove('active', 'is-active-route');
  });
  const isDashboardRoute = name === 'dashboard';
  getDashboardHeaderButtons().forEach((btn) => {
    btn.classList.toggle('active', isDashboardRoute);
    btn.classList.toggle('is-active-route', isDashboardRoute);
  });

  // Prevent default links - handle only on setup
  if (!window.magicNavInit) {
    document.querySelectorAll('.navigation ul li a').forEach(a => {
      a.addEventListener('click', (e) => e.preventDefault());
    });
    window.magicNavInit = true;
  }

  // Robust panel switching: always hide every known panel first,
  // then show only the requested one.
  knownPanels.forEach((panelName) => {
    const p = document.getElementById('panel-' + panelName);
    if (!p) return;
    p.classList.remove('active');
    p.style.display = 'none';
  });

  const panel = document.getElementById('panel-' + name);
  if (panel) {
    panel.classList.add('active');
    panel.style.display = '';
  }
  if (name === 'dashboard') {
    if (!dashboardBootstrapped) {
      dashboardBootstrapped = true;
      refreshDashboardView({ force: true });
      requestDashboardQueueState({ force: true });
    } else {
      scheduleDashboardRefresh();
      requestDashboardQueueState();
    }
  }
  if (name === 'trend' && typeof window.NHP_activateTrendPanel === 'function') {
    window.NHP_activateTrendPanel();
  }
  if (name === 'uspto' && typeof window.NHP_activateUsptoPanel === 'function') {
    window.NHP_activateUsptoPanel();
  }
  if (name === 'teepublic' && typeof window.NHP_activateTeepublicPanel === 'function') {
    window.NHP_activateTeepublicPanel();
  }
  if (name === 'note') {
    ensurePanelLoaded('note').then(() => {
      if (typeof window.NHP_activateNotePanel === 'function') window.NHP_activateNotePanel();
    }).catch(() => {});
  }
  if (name === 'seo') {
    ensurePanelLoaded('seo').then(() => {
      if (typeof window.NHP_activateSeoPanel === 'function') window.NHP_activateSeoPanel();
    }).catch(() => {});
  }
  if (name === 'autopilot') {
    ensurePanelLoaded('autopilot').then(() => {
      if (typeof window.NHP_activateAutopilotPanel === 'function') window.NHP_activateAutopilotPanel();
    }).catch(() => {});
  }
  if (name === 'creaty') {
    ensurePanelLoaded('creaty').then(() => {
      if (typeof window.NHP_activateCreatyPanel === 'function') window.NHP_activateCreatyPanel();
    }).catch(() => {});
  }
  if (name === 'lab') {
    ensurePanelLoaded('lab').then(() => {
      if (typeof window.NHP_activateLabPanel === 'function') window.NHP_activateLabPanel();
    }).catch(() => {});
  }
  if (name === 'studio') {
    ensurePanelLoaded('studio').then(() => {
      if (typeof window.NHP_activateStudioPanel === 'function') window.NHP_activateStudioPanel();
    }).catch(() => {});
  }
  if (name === 'generate') {
    ensurePanelLoaded('generate').then(() => {
      if (typeof activateGeneratePanel === 'function') activateGeneratePanel();
    }).catch(() => {});
  }
  if (name === 'canva-bridge') {
    ensurePanelLoaded('canva-bridge').then(() => {
      if (typeof activateCanvaBridgeTab === 'function') activateCanvaBridgeTab();
    }).catch(() => {});
  }
  if (name === 'tmh') {
    ensurePanelLoaded('tmh').then(() => {
      if (typeof window.NHP_activateTmhPanel === 'function') window.NHP_activateTmhPanel();
    }).catch(() => {});
  }
  if (name === 'admin') {
    ensurePanelLoaded('admin').then(() => {
      if (typeof window.NHP_activateAdminPanel === 'function') window.NHP_activateAdminPanel();
    }).catch(() => {});
  }
  if (name === 'social') {
    ensurePanelLoaded('social').then(() => {
      if (typeof window.NHP_activateSocialPanel === 'function') window.NHP_activateSocialPanel();
    }).catch(() => {});
  }
  if (name === 'redbubble') {
    ensurePanelLoaded('redbubble').then(() => {
      if (typeof window.NHP_activateRedbubbleHubPanel === 'function') window.NHP_activateRedbubbleHubPanel();
    }).catch(() => {});
  }
  if (name === 'amazon') {
    ensurePanelLoaded('amazon').then(() => {
      if (typeof window.NHP_activateAmazonHubPanel === 'function') window.NHP_activateAmazonHubPanel();
    }).catch(() => {});
  }
  syncMarketsInlineTabs(name);

  // Lock outer page scroll only for Autopilot; keep scroll internal to cards.
  document.body.classList.toggle('autopilot-lock', name === 'autopilot');

  schedulePersistActiveTab(name);

  // Focus specific panels or elements if needed
  if (name === 'teepublic') {
    const input = document.getElementById('tp-niches');
    if (input && !input.value) input.focus();
  }
  
  if (typeof updateWorkspaceNavigationUI === 'function') {
    updateWorkspaceNavigationUI(name);
  }
}
window.switchTab = switchTab;
window.openMasterSettings = function openMasterSettings() {
  if (typeof window.__nhpOpenGodModeModal === 'function') {
    window.__nhpOpenGodModeModal();
    return;
  }
  const overlay = document.getElementById('god-mode-overlay');
  if (overlay) overlay.classList.add('visible');
};

function resolveDashboardShortcutTab(rawTarget) {
  const target = String(rawTarget || '').trim().toLowerCase();
  if (!target) return null;
  if (target === 'automation') return 'seo';
  if (target === 'notes') return 'note';
  const allowed = new Set([
    'dashboard', 'trend', 'tmsearch', 'tmh', 'uspto', 'teepublic',
    'note', 'studio', 'lab', 'seo', 'autopilot',
    'admin', 'social', 'redbubble', 'amazon'
  ]);
  return allowed.has(target) ? target : null;
}

function openDashboardShortcut(target, label = 'هذا القسم') {
  const resolvedTab = resolveDashboardShortcutTab(target);
  if (!resolvedTab) {
    showToast(`تعذر فتح ${label}: المسار غير معروف.`);
    console.warn('[Dashboard Shortcut] Unknown target:', target);
    return false;
  }

  switchTab(resolvedTab);

  if (__nhpActiveTabPanel !== resolvedTab) {
    showToast(`تعذر فتح ${label} الآن. حاول مرة أخرى.`);
    console.warn('[Dashboard Shortcut] Switch failed:', { target, resolvedTab, active: __nhpActiveTabPanel });
    return false;
  }
  return true;
}

function openDashboardSettings(label = 'الإعدادات') {
  if (typeof window.openMasterSettings === 'function') {
    window.openMasterSettings();
    const overlay = document.getElementById('god-mode-overlay');
    if (overlay && !overlay.classList.contains('visible') && typeof window.__nhpOpenGodModeModal !== 'function') {
      showToast(`تعذر فتح ${label} الآن. حاول مرة أخرى.`);
      return false;
    }
    return true;
  }
  showToast(`تعذر فتح ${label}: الزر غير جاهز.`);
  console.warn('[Dashboard Shortcut] openMasterSettings is unavailable');
  return false;
}

function isDashboardPanelActive() {
  return __nhpActiveTabPanel === 'dashboard'
    || document.getElementById('panel-dashboard')?.classList.contains('active');
}

function buildDashboardFingerprint(data = {}) {
  const niches = extractDashboardNiches(data);
  const accountStats = countActiveAutomationAccounts(data);
  const queue = data[AP_UPLOAD_QUEUE_STATE_KEY] || {};
  return JSON.stringify({
    tpExcel: (data.tpExcel || []).length,
    tpDailyLimit: Number(data.tpDailyLimit || 50),
    niches: niches.length,
    accounts: `${accountStats.active}/${accountStats.total}`,
    uDone: (data.uSafe || []).length + (data.uBanned || []).length + (data.uErrors || []).length,
    uPending: (data.uPending || []).length,
    uRunning: !!data.uRunning,
    tpDone: (data.tpExcel || []).length + (data.tpMed || []).length + (data.tpSat || []).length + (data.tpEmp || []).length,
    tpPending: (data.tpPending || []).length,
    tpRunning: !!data.tpRunning,
    tpTotal: Number(data.tpTotal || 0),
    apStatus: queue.overallStatus || '',
    apProgress: Number(queue.overallProgressPercent || 0),
    apDesigns: Array.isArray(queue.perDesign) ? queue.perDesign.length : 0
  });
}

function normalizeMarketplaceTab(name) {
  if (name === 'social') return 'pinterest';
  if (name === 'amazon' || name === 'redbubble') return name;
  return null;
}

function syncMarketsInlineTabs(activeGlobalTab) {
  const activeMarket = normalizeMarketplaceTab(activeGlobalTab);
  if (!activeMarket) return;
  document.querySelectorAll('.markets-tab-btn[data-markets-tab]').forEach((btn) => {
    btn.classList.toggle('markets-tab-active', btn.dataset.marketsTab === activeMarket);
  });
  try {
    localStorage.setItem(MARKETS_STORAGE_KEY, activeMarket);
  } catch (_) {}
}

function initMarketsInlineTabs() {
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.markets-tab-btn[data-markets-tab]');
    if (!btn) return;
    event.preventDefault();
    const market = btn.dataset.marketsTab;
    const targetGlobalTabId = marketsGlobalTabMap[market];
    const targetGlobalTab = targetGlobalTabId ? document.getElementById(targetGlobalTabId) : null;
    if (targetGlobalTab) {
      targetGlobalTab.click();
    } else if (market === 'pinterest') {
      switchTab('social');
    } else if (market === 'amazon' || market === 'redbubble') {
      switchTab(market);
    }
  });

  try {
    const cachedMarket = localStorage.getItem(MARKETS_STORAGE_KEY);
    if (cachedMarket === 'amazon' || cachedMarket === 'redbubble' || cachedMarket === 'pinterest') {
      syncMarketsInlineTabs(cachedMarket === 'pinterest' ? 'social' : cachedMarket);
    }
  } catch (_) {}
}

const SECTION_TABS = {
  'search': [
    { id: 'tab-trend', text: 'Trends', icon: 'fa-solid fa-fire' },
    { id: 'tab-uspto', text: 'USPTO', icon: 'fa-solid fa-scale-balanced' },
    { id: 'tab-teepublic', text: 'Analysis', icon: 'fa-solid fa-chart-simple' }
  ],
  'automation': [
    { id: 'tab-seo', text: 'SEO AI', icon: 'fa-solid fa-magic' },
    { id: 'tab-autopilot', text: 'AUT', icon: 'fa-solid fa-rocket' },
    { id: 'tab-creaty', text: 'CREATY', icon: 'fa-solid fa-masks-theater' },
    { id: 'tab-amazon', text: 'Marketplaces', icon: 'fa-solid fa-cart-shopping' },
    { id: 'tab-redbubble', text: 'Marketplaces', icon: 'fa-solid fa-cart-shopping', hidden: true },
    { id: 'tab-social', text: 'Marketplaces', icon: 'fa-solid fa-cart-shopping', hidden: true }
  ],
  'studio-ai': [
    // Visual L→R (secondary-nav-pills is direction:ltr): Prompt Generator | Canva Bridge | Studio
    { id: 'tab-generate', text: 'Prompt Generator', icon: 'fa-solid fa-wand-magic-sparkles' },
    { id: 'tab-canva-bridge', text: 'Canva Bridge', icon: 'fa-brands fa-canva' },
    { id: 'tab-studio', text: 'Studio', icon: 'fa-solid fa-palette' }
  ],
  'notes-lab': [
    { id: 'tab-note', text: 'Notes', icon: 'fa-solid fa-note-sticky' }
  ]
};

function updateWorkspaceNavigationUI(activeTabId) {
  let activeSection = null;
  let tabInfo = null;
  
  if (activeTabId === 'dashboard') {
    activeSection = 'home';
  } else if (activeTabId === 'admin') {
    activeSection = 'admin';
  } else {
    for (const [sectionName, tabs] of Object.entries(SECTION_TABS)) {
      const match = tabs.find(t => t.id === 'tab-' + activeTabId);
      if (match) {
        activeSection = sectionName;
        tabInfo = match;
        const currentActiveBtn = document.querySelector('.nav-section-btn.active');
        const currentSection = currentActiveBtn ? currentActiveBtn.dataset.section : null;
        if (currentSection === sectionName) {
          break;
        }
      }
    }
  }

  document.querySelectorAll('#header-nav-groups .nav-btn').forEach((btn) => {
    btn.classList.remove('active', 'is-active-route');
  });
  
  if (activeSection === 'home') {
    const homeBtn = document.getElementById('nav-dashboard');
    if (homeBtn) homeBtn.classList.add('active', 'is-active-route');
  } else if (activeSection === 'admin') {
    const adminBtn = document.getElementById('top-admin-btn');
    if (adminBtn) adminBtn.classList.add('active', 'is-active-route');
  } else if (activeSection) {
    const secBtn = document.querySelector(`.nav-section-btn[data-section="${activeSection}"]`);
    if (secBtn) secBtn.classList.add('active', 'is-active-route');
  }

  let secNavBar = document.getElementById('secondary-nav-bar');
  let secPills = document.getElementById('secondary-nav-pills');
  
  if (!secNavBar) {
    secNavBar = document.createElement('div');
    secNavBar.className = 'secondary-nav-container';
    secNavBar.id = 'secondary-nav-bar';
    secNavBar.style.display = 'none';
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'secondary-nav-scroll';
    
    secPills = document.createElement('div');
    secPills.className = 'secondary-nav-pills';
    secPills.id = 'secondary-nav-pills';
    
    scrollContainer.appendChild(secPills);
    secNavBar.appendChild(scrollContainer);
  }

  if (activeSection && activeSection !== 'home' && activeSection !== 'admin') {
    const tabs = (SECTION_TABS[activeSection] || []).filter((t) => !t.hidden);
    // Single-tab groups (e.g. Notes-only) skip the secondary pill bar.
    if (tabs.length <= 1) {
      secNavBar.style.display = 'none';
      secPills.innerHTML = '';
      secNavBar.remove();
    } else {
      secNavBar.style.display = 'block';
      secPills.innerHTML = tabs.map((t) => {
        let isActive = t.id === 'tab-' + activeTabId;
        if (t.id === 'tab-amazon') {
          isActive = ['amazon', 'redbubble', 'social'].includes(activeTabId);
        }
        const activeClass = isActive ? 'is-active' : '';
        return `
          <button type="button" class="sec-tab-pill ${activeClass}" data-tab-target="${t.id}">
            <i class="${t.icon}"></i>
            <span>${t.text}</span>
          </button>
        `;
      }).join('');

      secPills.querySelectorAll('.sec-tab-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          const targetId = pill.dataset.tabTarget;
          if (targetId === 'tab-amazon') {
            let cachedMarket = 'amazon';
            try {
              const cache = localStorage.getItem(MARKETS_STORAGE_KEY);
              if (cache === 'pinterest' || cache === 'social') {
                cachedMarket = 'social';
              } else if (cache === 'redbubble') {
                cachedMarket = 'redbubble';
              } else if (cache === 'amazon') {
                cachedMarket = 'amazon';
              }
            } catch (_) {}
            switchTab(cachedMarket);
          } else {
            const tabName = String(targetId || '').replace(/^tab-/, '');
            if (tabName) switchTab(tabName);
          }
        });
      });

      const activePanel = document.getElementById('panel-' + activeTabId);
      if (activePanel) {
        activePanel.prepend(secNavBar);
      }
    }
  } else {
    secNavBar.style.display = 'none';
    secPills.innerHTML = '';
    secNavBar.remove();
  }

  const breadcrumbNav = document.getElementById('breadcrumb-nav');
  if (breadcrumbNav) {
    let html = `<span class="breadcrumb-item"><i class="fa-solid fa-house"></i> <span>Home</span></span>`;
    
    if (activeSection === 'admin') {
      html += `
        <span class="breadcrumb-separator"><i class="fa-solid fa-chevron-right"></i></span>
        <span class="breadcrumb-item breadcrumb-current"><i class="fa-solid fa-gear"></i> <span>Admin</span></span>
      `;
    } else if (activeSection && activeSection !== 'home') {
      const sectionLabel = activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace('-', ' & ');
      const sectionIcon = activeSection === 'search' ? 'fa-solid fa-magnifying-glass' 
                         : activeSection === 'notes-lab' ? 'fa-solid fa-pen-to-square'
                         : activeSection === 'studio-ai' ? 'fa-solid fa-wand-magic-sparkles'
                         : 'fa-solid fa-bolt';
                         
      html += `
        <span class="breadcrumb-separator"><i class="fa-solid fa-chevron-right"></i></span>
        <span class="breadcrumb-item"><i class="${sectionIcon}"></i> <span>${sectionLabel}</span></span>
      `;
      
      if (tabInfo) {
        html += `
          <span class="breadcrumb-separator"><i class="fa-solid fa-chevron-right"></i></span>
          <span class="breadcrumb-item breadcrumb-current"><i class="${tabInfo.icon}"></i> <span>${tabInfo.text}</span></span>
        `;
      }
    }
    
    breadcrumbNav.innerHTML = html;
  }
}

const NAVIGATION_ORDER = [
  "home",
  "search-tools",
  "notes-lab",
  "studio-ai",
  "automation",
  "admin"
];

function enforceNavigationOrder() {
  const navRoot = document.getElementById('header-nav-groups');
  if (!navRoot) return;

  const getNavElement = (key) => {
    if (key === 'home') return document.getElementById('nav-dashboard');
    if (key === 'search-tools') return document.querySelector('#header-nav-groups .nav-section-btn[data-section="search"]');
    if (key === 'notes-lab') return document.querySelector('#header-nav-groups .nav-section-btn[data-section="notes-lab"]');
    if (key === 'studio-ai') return document.getElementById('nav-studio-ai');
    if (key === 'automation') return document.querySelector('#header-nav-groups .nav-section-btn[data-section="automation"]');
    if (key === 'admin') return document.getElementById('top-admin-btn');
    return null;
  };

  NAVIGATION_ORDER.forEach((key) => {
    const el = getNavElement(key);
    if (el && navRoot.contains(el)) {
      navRoot.appendChild(el);
    }
  });
}

function resolveSectionPrimaryTab(section) {
  const tabs = SECTION_TABS[section] || [];
  if (!tabs.length) return null;
  const first = tabs.find((tab) => !tab.hidden) || tabs[0];
  if (!first?.id) return null;
  return String(first.id).replace(/^tab-/, '');
}

function initDashboardActions() {
  const openMap = {
    automation: 'autopilot',
    studio: 'studio',
    notes: 'note'
  };

  document.querySelectorAll('[data-dash-open]').forEach((btn) => {
    if (btn.dataset.dashOpenBound === '1') return;
    btn.dataset.dashOpenBound = '1';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const key = String(btn.getAttribute('data-dash-open') || '').trim().toLowerCase();
      switchTab(openMap[key] || key);
    });
  });

  const quickAdd = document.getElementById('dash-quick-add');
  if (quickAdd && quickAdd.dataset.bound !== '1') {
    quickAdd.dataset.bound = '1';
    quickAdd.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      quickAddNiche(quickAdd.value);
      quickAdd.value = '';
    });
  }

  const serversRefreshBtn = document.getElementById('dash-servers-refresh-btn');
  if (serversRefreshBtn && serversRefreshBtn.dataset.bound !== '1') {
    serversRefreshBtn.dataset.bound = '1';
    serversRefreshBtn.addEventListener('click', (event) => {
      event.preventDefault();
      refreshDashboardServersStatus();
    });
  }
}

function initGlobalHeaderDropdownNav() {
  if (globalNavWired) return;
  const navRoot = document.getElementById('header-nav-groups');
  if (!navRoot) return;

  enforceNavigationOrder();

  navRoot.querySelectorAll('.nav-section-btn').forEach((btn) => {
    if (btn.dataset.sectionBound === '1') return;
    btn.dataset.sectionBound = '1';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const section = String(btn.dataset.section || '').trim().toLowerCase();
      if (section === 'admin') {
        switchTab('admin');
        return;
      }
      const tabName = resolveSectionPrimaryTab(section);
      if (tabName) switchTab(tabName);
    });
  });

  getDashboardHeaderButtons().forEach((btn) => {
    if (btn.dataset.dashboardBound === '1') return;
    btn.dataset.dashboardBound = '1';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      switchTab('dashboard');
    });
  });

  globalNavWired = true;
}


// Helper: Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function openIsolatedToolWindow(url) {
  const popupWidth = 800;
  const popupHeight = 600;
  if (typeof chrome !== 'undefined' && chrome.windows?.create) {
    const screenWidth = Number.isFinite(screen?.availWidth) ? screen.availWidth : popupWidth;
    const screenHeight = Number.isFinite(screen?.availHeight) ? screen.availHeight : popupHeight;
    const left = Math.round((screenWidth - popupWidth) / 2);
    const top = Math.round((screenHeight - popupHeight) / 2);
    chrome.windows.create({
      url,
      type: 'popup',
      width: popupWidth,
      height: popupHeight,
      left,
      top,
      focused: true
    });
    return;
  }
  window.open(url, '_blank', `popup=yes,width=${popupWidth},height=${popupHeight}`);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractDashboardNiches(data = {}) {
  const source = data.teepublic_manager_data || {};
  return Array.isArray(source.niches) ? source.niches : [];
}

function getDashboardAccountPools(data = {}) {
  const teepublic = Array.isArray(data.ap_accounts_teepublic)
    ? data.ap_accounts_teepublic
    : (Array.isArray(data.ap_accounts) ? data.ap_accounts : []);
  const redbubble = Array.isArray(data.ap_accounts_redbubble) ? data.ap_accounts_redbubble : [];
  const amazon = Array.isArray(data.ap_accounts_amazon) ? data.ap_accounts_amazon : [];
  const pinterest = Array.isArray(data.ap_accounts_pinterest) ? data.ap_accounts_pinterest : [];
  return { teepublic, redbubble, amazon, pinterest };
}

function countActiveAutomationAccounts(data = {}) {
  const pools = getDashboardAccountPools(data);
  const allAccounts = [...pools.teepublic, ...pools.redbubble, ...pools.amazon, ...pools.pinterest];
  const total = allAccounts.length;
  const active = allAccounts.filter((account) => account?.enabled !== false).length;
  return { active, total };
}

function renderDashboardFromStorageData(data = {}, options = {}) {
  const force = options.force === true;
  const fingerprint = buildDashboardFingerprint(data);
  if (!force && fingerprint === dashboardDataFingerprint) return;
  dashboardDataFingerprint = fingerprint;

  const tpUploaded = Array.isArray(data.tpExcel) ? data.tpExcel.length : 0;
  const tpDailyMax = Math.max(1, Number(data.tpDailyLimit || 50) || 50);
  const tpDailyCurrent = Math.max(0, Math.min(tpUploaded, tpDailyMax));
  const dailyPct = Math.round((tpDailyCurrent / tpDailyMax) * 100);
  const accountStats = countActiveAutomationAccounts(data);
  const niches = extractDashboardNiches(data);

  const dailyCurrentEl = document.getElementById('dash-daily-upload-current');
  const dailyMaxEl = document.getElementById('dash-daily-upload-max');
  const dailyFillEl = document.getElementById('dash-daily-upload-fill');
  const totalNichesEl = document.getElementById('dash-total-niches-value');
  const accountsEl = document.getElementById('dash-accounts-value');

  if (dailyCurrentEl) dailyCurrentEl.textContent = String(tpDailyCurrent);
  if (dailyMaxEl) dailyMaxEl.textContent = String(tpDailyMax);
  if (dailyFillEl) dailyFillEl.style.width = `${Math.max(0, Math.min(100, dailyPct))}%`;
  if (totalNichesEl) totalNichesEl.textContent = String(niches.length);
  if (accountsEl) accountsEl.textContent = `${accountStats.active}/${accountStats.total}`;
  updateDashboardTaskProgress(data);
  renderDashboardQueueMonitor(data[AP_UPLOAD_QUEUE_STATE_KEY] || null);
  refreshDashboardServersStatus();
}

function clampProgressPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function setTaskProgress(progressId, barId, percent) {
  const safePercent = clampProgressPercent(percent);
  const percentEl = document.getElementById(progressId);
  const barEl = document.getElementById(barId);
  if (percentEl) percentEl.textContent = `${safePercent}%`;
  if (barEl) barEl.style.width = `${safePercent}%`;
}

function toLengthOrNumber(value) {
  if (Array.isArray(value)) return value.length;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getByPath(source, path) {
  if (!source || !path) return undefined;
  if (!path.includes('.')) return source[path];
  return path.split('.').reduce((acc, segment) => (acc == null ? undefined : acc[segment]), source);
}

function pickTaskProgressValue(data, explicitKeys, fallbackBuilder) {
  for (const key of explicitKeys) {
    const raw = getByPath(data, key);
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return clampProgressPercent(raw);
    }
    if (raw && typeof raw === 'object' && typeof raw.percent === 'number') {
      return clampProgressPercent(raw.percent);
    }
  }
  return clampProgressPercent(fallbackBuilder());
}

function deriveTaskProgress(doneCount, pendingCount, explicitTotal, isRunning) {
  const done = Math.max(0, Number(doneCount || 0));
  const pending = Math.max(0, Number(pendingCount || 0));
  const total = Math.max(done + pending, Math.max(0, Number(explicitTotal || 0)));
  if (total <= 0) return 0;
  if (!isRunning && done <= 0) return 0;
  return clampProgressPercent((done / total) * 100);
}

function deriveUsptoProgress(data = {}) {
  const done = toLengthOrNumber(data.uSafe) || 0;
  const blocked = toLengthOrNumber(data.uBanned) || 0;
  const errors = toLengthOrNumber(data.uErrors) || 0;
  const pending = toLengthOrNumber(data.uPending) || 0;
  return deriveTaskProgress(done + blocked + errors, pending, data.uTotal, data.uRunning);
}

function deriveAnalysisProgress(data = {}) {
  const uploaded = toLengthOrNumber(data.tpExcel) || 0;
  const medium = toLengthOrNumber(data.tpMed) || 0;
  const saturated = toLengthOrNumber(data.tpSat) || 0;
  const empty = toLengthOrNumber(data.tpEmp) || 0;
  const done = uploaded + medium + saturated + empty;
  const pending = toLengthOrNumber(data.tpPending) || 0;
  return deriveTaskProgress(done, pending, data.tpTotal, data.tpRunning);
}

function updateDashboardTaskProgress(data = {}) {
  const usptoPercent = pickTaskProgressValue(
    data,
    ['dashboardTaskProgress.uspto', 'usptoTaskProgress', 'usptoProgress'],
    () => deriveUsptoProgress(data)
  );
  const analysisPercent = pickTaskProgressValue(
    data,
    ['dashboardTaskProgress.analysis', 'analysisTaskProgress', 'analysisProgress'],
    () => deriveAnalysisProgress(data)
  );
  setTaskProgress('uspto-percent', 'uspto-bar', usptoPercent);
  setTaskProgress('analysis-percent', 'analysis-bar', analysisPercent);
}

function normalizeDashboardQueueStatus(value, fallback = 'waiting') {
  const status = String(value || '').trim().toLowerCase();
  if (['waiting', 'ready', 'uploading', 'uploaded', 'published', 'skipped', 'stopped', 'failed'].includes(status)) {
    return status;
  }
  return fallback;
}

function getDashboardQueueStatusVisual(status) {
  const normalized = normalizeDashboardQueueStatus(status);
  const map = {
    waiting: { label: 'waiting', color: '#94a3b8' },
    ready: { label: 'ready', color: '#22c55e' },
    uploading: { label: 'uploading', color: '#818cf8' },
    uploaded: { label: 'uploaded', color: '#10b981' },
    published: { label: 'published', color: '#10b981' },
    skipped: { label: 'skipped', color: '#f59e0b' },
    stopped: { label: 'stopped', color: '#f59e0b' },
    failed: { label: 'failed', color: '#ef4444' }
  };
  return map[normalized] || map.waiting;
}

function renderDashboardQueueList(targetId, title, items, formatter, emptyText) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    el.innerHTML = `
      <div class="dash-queue-list-title"><span>${escapeHtml(title)}</span></div>
      <div class="dash-recent-empty">${escapeHtml(emptyText)}</div>
    `;
    return;
  }
  const rows = safeItems.map(formatter).join('');
  el.innerHTML = `
    <div class="dash-queue-list-title"><span>${escapeHtml(title)}</span><span>${safeItems.length}</span></div>
    ${rows}
  `;
}

function renderDashboardQueueMonitor(state = null) {
  const progressPercentEl = document.getElementById('dash-ap-queue-progress-percent');
  if (!progressPercentEl) return;

  const source = state && typeof state === 'object' ? state : {};
  const perAccount = Array.isArray(source.perAccount) ? source.perAccount : [];
  const perDesign = Array.isArray(source.perDesign) ? source.perDesign : [];
  const totalPlannedUploads = Math.max(0, Number(source.totalPlannedUploads) || perDesign.length);
  const completedUploads = Math.max(
    0,
    Number(source.completedUploads)
      || perDesign.filter((item) => {
        const s = normalizeDashboardQueueStatus(item?.status);
        return s === 'uploaded' || s === 'published';
      }).length
  );
  const progressPercent = totalPlannedUploads > 0
    ? Math.max(0, Math.min(100, Math.round((completedUploads / totalPlannedUploads) * 100)))
    : Math.max(0, Math.min(100, Number(source.overallProgressPercent) || 0));
  const selectedAccounts = Math.max(0, Number(source.selectedAccountCount) || 0);
  const completedAccounts = Math.max(0, Number(source.completedAccountCount) || 0);
  const statusVisual = getDashboardQueueStatusVisual(source.overallStatus || 'waiting');
  const designsReady = !!source.designsReadyForUpload;

  const progressBar = document.getElementById('dash-ap-queue-progress-bar');
  const progressText = document.getElementById('dash-ap-queue-progress-text');
  const designsCount = document.getElementById('dash-ap-queue-design-count');
  const stateEl = document.getElementById('dash-ap-queue-state');
  const readyEl = document.getElementById('dash-ap-queue-ready');
  const selectedEl = document.getElementById('dash-ap-queue-selected');
  const completedEl = document.getElementById('dash-ap-queue-completed');
  const pillEl = document.getElementById('dash-ap-queue-pill');

  progressPercentEl.textContent = `${progressPercent}%`;
  if (progressBar) progressBar.style.width = `${progressPercent}%`;
  if (progressText) progressText.textContent = `${completedAccounts} / ${selectedAccounts} حساب`;
  if (designsCount) designsCount.textContent = `${perDesign.length} designs`;
  if (selectedEl) selectedEl.textContent = String(selectedAccounts);
  if (completedEl) completedEl.textContent = String(completedAccounts);
  if (stateEl) {
    stateEl.textContent = statusVisual.label;
    stateEl.style.color = statusVisual.color;
  }
  if (pillEl) {
    pillEl.textContent = statusVisual.label;
    pillEl.style.color = statusVisual.color;
  }
  if (readyEl) {
    readyEl.textContent = designsReady ? 'ready' : 'waiting';
    readyEl.style.color = designsReady ? '#10b981' : '#f59e0b';
  }

  renderDashboardQueueList(
    'dash-ap-account-list',
    'Accounts',
    perAccount,
    (item) => {
      const visual = getDashboardQueueStatusVisual(item?.status);
      const name = item?.accountLabel || item?.accountEmail || 'Account';
      const planned = Number(item?.plannedCount || 0);
      const uploaded = Number(item?.uploadedCount || 0);
      const statusText = planned > 0 ? `${visual.label} (${uploaded}/${planned})` : visual.label;
      return `<div class="dash-queue-list-item">
        <span class="dash-queue-item-name">${escapeHtml(name)}</span>
        <span class="dash-queue-item-status" style="color:${visual.color};">${escapeHtml(statusText)}</span>
      </div>`;
    },
    'No accounts in queue.'
  );

  renderDashboardQueueList(
    'dash-ap-design-list',
    'Designs',
    perDesign,
    (item) => {
      const visual = getDashboardQueueStatusVisual(item?.status);
      const name = item?.title || item?.queueItemId || 'Design';
      return `<div class="dash-queue-list-item">
        <span class="dash-queue-item-name">${escapeHtml(name)}</span>
        <span class="dash-queue-item-status" style="color:${visual.color};">${escapeHtml(visual.label)}</span>
      </div>`;
    },
    'No designs in queue.'
  );
}

function requestDashboardQueueState(options = {}) {
  const force = options.force === true;
  if (!force && !isDashboardPanelActive()) return;

  const now = Date.now();
  if (!force && now - dashboardLastQueueFetchAt < DASHBOARD_QUEUE_TTL_MS) return;

  clearTimeout(dashboardQueueFetchTimer);
  dashboardQueueFetchTimer = setTimeout(() => {
    if (dashboardQueueFetchInFlight) return;
    dashboardQueueFetchInFlight = true;
    dashboardLastQueueFetchAt = Date.now();

    chrome.storage.local.get([AP_UPLOAD_QUEUE_STATE_KEY], (result) => {
      const stored = result?.[AP_UPLOAD_QUEUE_STATE_KEY];
      renderDashboardQueueMonitor(stored && typeof stored === 'object' ? stored : {});
    });

    const queueMsgWatchdog = setTimeout(() => {
      dashboardQueueFetchInFlight = false;
    }, RUNTIME_MESSAGE_TIMEOUT_MS + 500);

    chrome.runtime.sendMessage({ action: 'ap_get_queue_state' }, (response) => {
      clearTimeout(queueMsgWatchdog);
      dashboardQueueFetchInFlight = false;
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        renderDashboardQueueMonitor(response.data);
      }
    });
  }, force ? 0 : 300);
}

let dashboardServersFetchInFlight = false;

function syncNhpVersionBadge() {
  try {
    const manifest = chrome.runtime.getManifest();
    const major = String(manifest?.version || '40').split('.')[0] || '40';
    document.querySelectorAll('.version-tag').forEach((el) => {
      el.textContent = `V${major}`;
    });
  } catch (_) { /* ignore */ }
}

function renderDashboardServersList(servers = []) {
  const list = document.getElementById('dash-servers-list');
  const feedback = document.getElementById('dash-servers-feedback');
  if (!list) return;
  list.innerHTML = '';
  if (!Array.isArray(servers) || !servers.length) {
    if (feedback) feedback.textContent = 'لا توجد سيرفرات مسجّلة.';
    return;
  }
  const enabled = servers.filter((item) => !item.disabled);
  const onlineEnabled = enabled.filter((item) => item.online).length;
  const disabledCount = servers.filter((item) => item.disabled).length;
  if (feedback) {
    feedback.textContent = disabledCount > 0
      ? `${onlineEnabled} / ${enabled.length} متصل (${disabledCount} معطّلة)`
      : `${onlineEnabled} / ${servers.length} متصل`;
  }
  servers.forEach((server) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.375rem 0.5rem;border-radius:0.5rem;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.2);';
    const dot = server.disabled ? '#94a3b8' : (server.online ? '#34d399' : '#f87171');
    const label = server.label || server.id || 'Server';
    const port = server.port || '—';
    const statusLabel = server.disabled
      ? (server.online ? 'DIS' : 'DIS')
      : (server.online ? 'OK' : 'OFF');
    row.innerHTML = `<span style="display:flex;align-items:center;gap:0.5rem;min-width:0;font-size:0.6875rem;color:#e2e8f0;"><span style="width:0.5rem;height:0.5rem;border-radius:9999px;background:${dot};flex-shrink:0;"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label} <span style="color:#94a3b8">:${port}</span></span></span><span style="font-size:0.625rem;color:${dot};font-weight:700;">${statusLabel}</span>`;
    list.appendChild(row);
  });
}

function refreshDashboardServersStatus() {
  if (dashboardServersFetchInFlight) return;
  dashboardServersFetchInFlight = true;
  const feedback = document.getElementById('dash-servers-feedback');
  if (feedback) feedback.textContent = 'جاري قراءة حالة السيرفرات...';
  chrome.runtime.sendMessage({ action: 'get_extension_servers_status' }, (res) => {
    dashboardServersFetchInFlight = false;
    if (chrome.runtime.lastError) {
      if (feedback) feedback.textContent = chrome.runtime.lastError.message || 'تعذّر قراءة حالة السيرفرات';
      return;
    }
    if (!res?.success) {
      if (feedback) feedback.textContent = res?.error || 'تعذّر قراءة حالة السيرفرات';
      return;
    }
    renderDashboardServersList(res.servers || []);
  });
}

function scheduleDashboardRefresh() {
  if (!isDashboardPanelActive()) return;
  if (dashboardRefreshTimeout) return;
  const delay = getActivePerformanceProfile().refreshDelayMs + 350;
  dashboardRefreshTimeout = setTimeout(() => {
    dashboardRefreshTimeout = null;
    refreshDashboardView();
  }, delay);
}

function refreshDashboardView(options = {}) {
  const force = options.force === true;
  if (!force && !isDashboardPanelActive()) return;
  chrome.storage.local.get(DASHBOARD_STORAGE_KEYS, (data) => {
    renderDashboardFromStorageData(data || {}, options);
  });
}

const RUNTIME_MESSAGE_TIMEOUT_MS = 9000;
/** Skip Full-Auto pipeline kicks until popup wiring + first paint complete. */
window.__nhpInitComplete = false;

function quickAddNiche(valueFromCaller) {
  const raw = typeof valueFromCaller === 'string' ? valueFromCaller : '';
  const value = raw.trim();
  if (!value) return;

  chrome.storage.local.get(['teepublic_manager_data'], (res) => {
    const current = res.teepublic_manager_data || {};
    const currentNiches = Array.isArray(current.niches) ? current.niches : [];
    const lowered = value.toLowerCase();
    const exists = currentNiches.some((item) => String(item?.text || '').trim().toLowerCase() === lowered);
    if (exists) {
      showToast('ℹ️ هذا النيتش موجود بالفعل.');
      return;
    }
    const nowIso = new Date().toISOString();
    const nextNiches = [{
      id: `dash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: value,
      done: false,
      quality: null,
      createdAt: nowIso,
      updatedAt: nowIso
    }, ...currentNiches];

    const nextData = {
      ...current,
      niches: nextNiches,
      doneHistory: Array.isArray(current.doneHistory) ? current.doneHistory : [],
      history: Array.isArray(current.history) ? current.history : [],
      unofficialTrends: Array.isArray(current.unofficialTrends) ? current.unofficialTrends : []
    };
    markStorageEchoSuppress(1200);
    chrome.storage.local.set({ teepublic_manager_data: nextData }, () => {
      showToast('✅ تمت إضافة النيتش إلى الملاحظات.');
      dashboardDataFingerprint = '';
      if (isDashboardPanelActive()) refreshDashboardView({ force: true });
    });
  });
}
window.quickAddNiche = quickAddNiche;

const GOD_MODE_DEFAULTS = Object.freeze({
  geminiApiKey: '',
  openAiApiKey: '',
  proxyBaseUrl: 'https://cliproxyapi-ywrp.onrender.com/v1',
  defaultAiModel: 'auto',
  dailyUploadLimit: 50,
  uploadDelaySeconds: 5,
  proxy: {
    url: '',
    host: '',
    port: '',
    username: '',
    password: ''
  },
  compactMode: false,
  hotkeys: {
    openExtension: 'Ctrl+Shift+Y',
    quickSaveNiche: 'Ctrl+Shift+S',
    openGodMode: 'Ctrl+Shift+G'
  }
});

function mergeGodModeSettings(raw = {}) {
  const merged = {
    ...GOD_MODE_DEFAULTS,
    ...raw,
    proxy: {
      ...GOD_MODE_DEFAULTS.proxy,
      ...(raw.proxy || {})
    },
    hotkeys: {
      ...GOD_MODE_DEFAULTS.hotkeys,
      ...(raw.hotkeys || {})
    }
  };
  merged.geminiApiKey = '';
  if (!String(merged.openAiApiKey || '').trim()) {
    merged.openAiApiKey = '';
  }
  if (!String(merged.proxyBaseUrl || '').trim()) {
    merged.proxyBaseUrl = GOD_MODE_DEFAULTS.proxyBaseUrl;
  }
  // Keep local CLIProxy (8317) when configured — do not force Render.
  if (!String(merged.defaultAiModel || '').trim()) {
    merged.defaultAiModel = GOD_MODE_DEFAULTS.defaultAiModel;
  }
  return merged;
}

function applyCompactMode(enabled) {
  document.body.classList.toggle('nhp-compact-mode', !!enabled);
}

function normalizeHotkeyInput(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/control/ig, 'Ctrl')
    .replace(/shift/ig, 'Shift')
    .replace(/alt/ig, 'Alt')
    .replace(/meta|cmd|command/ig, 'Meta');
}

function formatStorageBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildNichesCsv(data = {}) {
  const niches = extractDashboardNiches(data);
  if (!niches.length) return 'niche,done,quality,createdAt,updatedAt';
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = niches.map((item) => [
    esc(item?.text || ''),
    item?.done ? '1' : '0',
    esc(item?.quality || ''),
    esc(item?.createdAt || ''),
    esc(item?.updatedAt || '')
  ].join(','));
  return ['niche,done,quality,createdAt,updatedAt', ...rows].join('\n');
}

function initGodModeSettings() {
  const overlay = document.getElementById('god-mode-overlay');
  if (!overlay) return;

  const openBtn = document.getElementById('btn-god-mode-open');
  const closeBtn = document.getElementById('btn-god-mode-close');
  const saveBtn = document.getElementById('gm-save-settings');
  const tabButtons = Array.from(document.querySelectorAll('.god-mode-tab-btn[data-gm-tab]'));
  const tabPanels = Array.from(document.querySelectorAll('.god-mode-panel[data-gm-panel]'));
  const fileInput = document.getElementById('gm-import-file');
  const compactModeToggle = document.getElementById('gm-compact-mode');
  const hotkeyInputs = Array.from(document.querySelectorAll('.gm-hotkey-input[data-hotkey-name]'));
  const storageUsageEl = document.getElementById('gm-storage-usage');
  const dataStatusEl = document.getElementById('gm-data-status');
  const geminiStatusEl = document.getElementById('gm-gemini-status');
  const openaiStatusEl = document.getElementById('gm-openai-status');

  const readSettingsForm = () => ({
    geminiApiKey: document.getElementById('gm-gemini-key')?.value.trim() || '',
    openAiApiKey: document.getElementById('gm-openai-key')?.value.trim() || '',
    proxyBaseUrl: document.getElementById('gm-base-url')?.value.trim() || GOD_MODE_DEFAULTS.proxyBaseUrl,
    defaultAiModel: document.getElementById('gm-default-model')?.value || GOD_MODE_DEFAULTS.defaultAiModel,
    dailyUploadLimit: Math.max(1, Number(document.getElementById('gm-daily-upload-limit')?.value || 50) || 50),
    uploadDelaySeconds: Math.max(0, Number(document.getElementById('gm-upload-delay-seconds')?.value || 5) || 5),
    proxy: {
      url: document.getElementById('gm-proxy-url')?.value.trim() || '',
      host: document.getElementById('gm-proxy-host')?.value.trim() || '',
      port: document.getElementById('gm-proxy-port')?.value.trim() || '',
      username: document.getElementById('gm-proxy-user')?.value.trim() || '',
      password: document.getElementById('gm-proxy-pass')?.value || ''
    },
    compactMode: !!compactModeToggle?.checked,
    hotkeys: hotkeyInputs.reduce((acc, input) => {
      const hotkeyName = input.getAttribute('data-hotkey-name');
      if (hotkeyName) acc[hotkeyName] = normalizeHotkeyInput(input.value);
      return acc;
    }, {})
  });

  const applySettingsToForm = (settings) => {
    const merged = mergeGodModeSettings(settings);
    const byId = (id) => document.getElementById(id);
    if (byId('gm-gemini-key')) byId('gm-gemini-key').value = merged.geminiApiKey;
    if (byId('gm-openai-key')) byId('gm-openai-key').value = merged.openAiApiKey;
    if (byId('gm-base-url')) byId('gm-base-url').value = merged.proxyBaseUrl;
    if (byId('gm-default-model')) byId('gm-default-model').value = merged.defaultAiModel;
    if (byId('gm-daily-upload-limit')) byId('gm-daily-upload-limit').value = String(merged.dailyUploadLimit);
    if (byId('gm-upload-delay-seconds')) byId('gm-upload-delay-seconds').value = String(merged.uploadDelaySeconds);
    if (byId('gm-proxy-url')) byId('gm-proxy-url').value = merged.proxy.url;
    if (byId('gm-proxy-host')) byId('gm-proxy-host').value = merged.proxy.host;
    if (byId('gm-proxy-port')) byId('gm-proxy-port').value = merged.proxy.port;
    if (byId('gm-proxy-user')) byId('gm-proxy-user').value = merged.proxy.username;
    if (byId('gm-proxy-pass')) byId('gm-proxy-pass').value = merged.proxy.password;
    if (compactModeToggle) compactModeToggle.checked = !!merged.compactMode;
    hotkeyInputs.forEach((input) => {
      const hotkeyName = input.getAttribute('data-hotkey-name');
      if (!hotkeyName) return;
      input.value = merged.hotkeys[hotkeyName] || '';
    });
    applyCompactMode(!!merged.compactMode);
  };

  const switchTab = (tabName) => {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-gm-tab') === tabName));
    tabPanels.forEach((panel) => panel.classList.toggle('active', panel.getAttribute('data-gm-panel') === tabName));
  };

  const refreshStorageUsage = () => {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      if (storageUsageEl) storageUsageEl.textContent = `Storage usage: ${formatStorageBytes(bytes)}`;
    });
  };

  const openModal = () => {
    chrome.storage.local.get([GOD_MODE_SETTINGS_KEY], (store) => {
      applySettingsToForm(store[GOD_MODE_SETTINGS_KEY] || {});
      refreshStorageUsage();
      if (dataStatusEl) dataStatusEl.textContent = '';
      if (geminiStatusEl) geminiStatusEl.textContent = '';
      if (openaiStatusEl) openaiStatusEl.textContent = '';
      switchTab('ai-engine');
      overlay.classList.add('visible');
    });
  };
  window.__nhpOpenGodModeModal = openModal;

  const closeModal = () => {
    overlay.classList.remove('visible');
  };

  const runConnectionCheck = async (type) => {
    const statusEl = type === 'gemini' ? geminiStatusEl : openaiStatusEl;
    if (!statusEl) return;
    statusEl.className = 'gm-status';
    statusEl.textContent = 'Checking...';
    const settings = readSettingsForm();
    const key = type === 'gemini' ? settings.geminiApiKey : settings.openAiApiKey;
    if (!key) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Missing API key.';
      return;
    }
    if (type === 'gemini' && !/^AIza[0-9A-Za-z_\-]{20,}$/.test(key)) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Gemini key format looks invalid.';
      return;
    }
    if (type === 'openai' && !/^(sk|nhp)_[A-Za-z0-9\-_]{20,}$|^sk-[A-Za-z0-9\-_]{20,}$/.test(key)) {
      statusEl.classList.add('error');
      statusEl.textContent = 'NHP key format looks invalid.';
      return;
    }
    try {
      const endpoint = type === 'gemini'
        ? `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
        : (key.startsWith('nhp_') ? `${String(settings.proxyBaseUrl || GOD_MODE_DEFAULTS.proxyBaseUrl).replace(/\/+$/, '')}/models` : 'https://api.openai.com/v1/models');
      const response = await fetch(endpoint, {
        headers: type === 'openai' ? { Authorization: `Bearer ${key}` } : {}
      });
      if (!response.ok) {
        statusEl.classList.add('error');
        statusEl.textContent = `Connection failed (${response.status}).`;
        return;
      }
      statusEl.classList.add('ok');
      statusEl.textContent = 'Connection successful.';
    } catch (error) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Network check unavailable, key saved for runtime use.';
    }
  };

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('visible')) {
      closeModal();
    }
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-gm-tab')));
  });

  document.getElementById('gm-test-gemini')?.addEventListener('click', () => runConnectionCheck('gemini'));
  document.getElementById('gm-test-openai')?.addEventListener('click', () => runConnectionCheck('openai'));

  hotkeyInputs.forEach((input) => {
    input.addEventListener('keydown', (event) => {
      event.preventDefault();
      const parts = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.shiftKey) parts.push('Shift');
      if (event.altKey) parts.push('Alt');
      if (event.metaKey) parts.push('Meta');
      const k = String(event.key || '').toUpperCase();
      if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(k)) {
        const normalizedKey = k.length === 1 ? k : (event.key || '');
        if (normalizedKey) parts.push(normalizedKey);
      }
      input.value = parts.join('+');
    });
  });

  compactModeToggle?.addEventListener('change', () => {
    applyCompactMode(compactModeToggle.checked);
  });

  saveBtn?.addEventListener('click', () => {
    const nextSettings = mergeGodModeSettings(readSettingsForm());
    chrome.storage.local.set({
      [GOD_MODE_SETTINGS_KEY]: nextSettings,
      nhpProxyBaseUrl: nextSettings.proxyBaseUrl,
      nhpGptApiKey: nextSettings.openAiApiKey,
      tpDailyLimit: nextSettings.dailyUploadLimit,
      ap_upload_delay_seconds: nextSettings.uploadDelaySeconds,
      ap_proxy_pool: nextSettings.proxy.url
        ? [nextSettings.proxy.url]
        : (nextSettings.proxy.host && nextSettings.proxy.port
          ? [{
              host: nextSettings.proxy.host,
              port: nextSettings.proxy.port,
              username: nextSettings.proxy.username,
              password: nextSettings.proxy.password
            }]
          : [])
    }, () => {
      applyCompactMode(nextSettings.compactMode);
      showToast('✅ تم حفظ إعدادات God Mode بنجاح');
      closeModal();
      refreshDashboardView();
    });
  });

  document.getElementById('gm-export-json')?.addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json;charset=utf-8' });
      downloadBlob(blob, `nhp-backup-${Date.now()}.json`);
      showToast('📦 JSON backup exported');
    });
  });

  document.getElementById('gm-export-csv')?.addEventListener('click', () => {
    chrome.storage.local.get(['teepublic_manager_data'], (data) => {
      const csv = buildNichesCsv(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `nhp-niches-${Date.now()}.csv`);
      showToast('📄 CSV backup exported');
    });
  });

  document.getElementById('gm-import-backup')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    const selected = fileInput.files && fileInput.files[0];
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        if (selected.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid backup format');
          chrome.storage.local.set(parsed, () => {
            if (dataStatusEl) {
              dataStatusEl.className = 'gm-status ok';
              dataStatusEl.textContent = 'JSON backup imported successfully.';
            }
            refreshStorageUsage();
            refreshDashboardView();
            showToast('✅ تم استيراد نسخة JSON');
          });
          return;
        }
        if (selected.name.toLowerCase().endsWith('.csv')) {
          const rows = parseCsvRows(text);
          const niches = rows.slice(1).map((row, index) => {
            const nicheText = row.split(',')[0]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
            return nicheText
              ? {
                  id: `csv_${Date.now()}_${index}`,
                  text: nicheText,
                  done: false,
                  quality: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              : null;
          }).filter(Boolean);
          chrome.storage.local.get(['teepublic_manager_data'], (current) => {
            const existing = current.teepublic_manager_data || {};
            chrome.storage.local.set({
              teepublic_manager_data: {
                ...existing,
                niches,
                doneHistory: Array.isArray(existing.doneHistory) ? existing.doneHistory : [],
                history: Array.isArray(existing.history) ? existing.history : [],
                unofficialTrends: Array.isArray(existing.unofficialTrends) ? existing.unofficialTrends : []
              }
            }, () => {
              if (dataStatusEl) {
                dataStatusEl.className = 'gm-status ok';
                dataStatusEl.textContent = `CSV imported (${niches.length} niches).`;
              }
              refreshDashboardView();
              showToast('✅ تم استيراد ملف CSV');
            });
          });
        }
      } catch (error) {
        if (dataStatusEl) {
          dataStatusEl.className = 'gm-status error';
          dataStatusEl.textContent = 'Import failed. Please check file format.';
        }
        showToast('❌ فشل استيراد النسخة الاحتياطية');
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(selected);
  });

  document.getElementById('gm-clear-cache')?.addEventListener('click', () => {
    const firstConfirm = confirm('⚠️ Clear cache now?\nThis removes queue/cache data only.');
    if (!firstConfirm) return;
    const secondConfirm = confirm('تأكيد نهائي: سيتم مسح الكاش والطابور الآن.');
    if (!secondConfirm) return;
    chrome.storage.local.remove([
      'savedDesignQueue',
      'gemini_pending_image',
      'gemini_pending_prompt',
      'gemini_auto_trigger',
      'lastDataStr'
    ], async () => {
      await NHPDatabase.clearAllImages().catch(() => {});
      replaceDesignQueue([]);
      renderQueue();
      saveQueueToStorage(true);
      refreshStorageUsage();
      if (dataStatusEl) {
        dataStatusEl.className = 'gm-status ok';
        dataStatusEl.textContent = 'Cache cleared successfully.';
      }
      showToast('🧹 تم مسح الكاش بنجاح');
    });
  });

  document.getElementById('gm-factory-reset')?.addEventListener('click', () => {
    const firstConfirm = confirm('⚠️ Delete all niches and reset all local data?');
    if (!firstConfirm) return;
    const secondConfirm = confirm('تأكيد نهائي: لا يمكن التراجع بعد الآن. متابعة؟');
    if (!secondConfirm) return;
    chrome.storage.local.clear(async () => {
      await NHPDatabase.clearAllImages().catch(() => {});
      showToast('🔄 تم تنفيذ Factory Reset. سيتم إعادة التشغيل...');
      setTimeout(() => location.reload(), 1100);
    });
  });

  chrome.storage.local.get([GOD_MODE_SETTINGS_KEY], (store) => {
    const settings = mergeGodModeSettings(store[GOD_MODE_SETTINGS_KEY] || {});
    applyCompactMode(settings.compactMode);
  });
}


// backgroundSyncData moved to admin.js


async function autoSyncCloudData() {
  const store = await new Promise(r => chrome.storage.local.get(['cloudSyncEnabled'], r));
  if (store.cloudSyncEnabled === false) return; // Silent return if disabled

  if (typeof GitHubSync === 'undefined') return;
  const user = await AuthManager.getCurrentUser();
  if (!user) return;

  console.log('🔄 Seamless Sync: Checking for cloud updates...');
  const cloudData = await GitHubSync.getData();
  if (!cloudData) return;

  chrome.storage.local.get(['savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory'], (local) => {
    let hasNewData = false;
    const update = {};

    const buildNoteSyncSignature = (noteData = {}) => JSON.stringify({
      niches: (noteData.niches || [])
        .map(item => ({
          text: String(item?.text || '').trim().toLowerCase(),
          done: !!item?.done,
          quality: item?.quality || null
        }))
        .filter(item => item.text)
        .sort((a, b) => a.text.localeCompare(b.text)),
      doneHistory: [...new Set((noteData.doneHistory || []).map(item => String(item || '').trim().toLowerCase()).filter(Boolean))].sort(),
      history: (noteData.history || [])
        .map(entry => ({
          timestamp: entry?.timestamp || '',
          niches: (entry?.niches || []).map(item => String(item || '').trim().toLowerCase()).filter(Boolean).sort()
        }))
        .sort((a, b) => `${a.timestamp}|${a.niches.join('|')}`.localeCompare(`${b.timestamp}|${b.niches.join('|')}`)),
      unofficialTrends: (noteData.unofficialTrends || [])
        .map(item => ({
          text: String(item?.text || '').trim().toLowerCase(),
          sourceType: item?.sourceType || null,
          usptoStatus: item?.usptoStatus || null,
          analysisStatus: item?.analysisStatus || null,
          pipelineStage: item?.pipelineStage || null,
          autoPipeline: !!item?.autoPipeline
        }))
        .filter(item => item.text)
        .sort((a, b) => a.text.localeCompare(b.text))
    });

    const mergeNoteData = (localNoteData = {}, cloudNoteData = {}) => {
      const merged = {
        niches: [],
        doneHistory: [],
        history: [],
        unofficialTrends: []
      };

      const localDoneHistory = (localNoteData.doneHistory || []).map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
      const cloudDoneHistory = (cloudNoteData.doneHistory || []).map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
      const mergedDoneHistorySet = new Set([...localDoneHistory, ...cloudDoneHistory]);
      const nicheMap = new Map();

      (localNoteData.niches || []).forEach(item => {
        const key = String(item?.text || '').trim().toLowerCase();
        if (!key) return;
        nicheMap.set(key, {
          ...item,
          text: String(item.text || '').trim(),
          done: !!item.done || mergedDoneHistorySet.has(key)
        });
      });

      (cloudNoteData.niches || []).forEach(item => {
        const key = String(item?.text || '').trim().toLowerCase();
        if (!key) return;

        if (!nicheMap.has(key)) {
          nicheMap.set(key, {
            ...item,
            text: String(item.text || '').trim(),
            done: !!item.done || mergedDoneHistorySet.has(key)
          });
          return;
        }

        const existing = nicheMap.get(key);
        nicheMap.set(key, {
          ...item,
          ...existing,
          text: existing.text || String(item.text || '').trim(),
          quality: existing.quality || item.quality || null,
          done: !!existing.done || !!item.done || mergedDoneHistorySet.has(key)
        });
      });

      merged.niches = Array.from(nicheMap.values());
      merged.niches.forEach(item => {
        const key = String(item?.text || '').trim().toLowerCase();
        if (item.done && key) mergedDoneHistorySet.add(key);
      });

      merged.doneHistory = Array.from(mergedDoneHistorySet);

      const historyMap = new Map();
      [...(localNoteData.history || []), ...(cloudNoteData.history || [])].forEach(entry => {
        const timestamp = entry?.timestamp || '';
        const niches = (entry?.niches || []).map(item => String(item || '').trim()).filter(Boolean);
        const key = `${timestamp}__${niches.map(item => item.toLowerCase()).sort().join('|')}`;
        if (!historyMap.has(key)) {
          historyMap.set(key, { timestamp, niches });
        }
      });
      merged.history = Array.from(historyMap.values());

      const unofficialMap = new Map();
      [...(localNoteData.unofficialTrends || []), ...(cloudNoteData.unofficialTrends || [])].forEach(item => {
        const key = String(item?.text || '').trim().toLowerCase();
        if (!key) return;
        const existing = unofficialMap.get(key) || {};
        unofficialMap.set(key, {
          ...item,
          ...existing,
          text: existing.text || String(item.text || '').trim(),
          sourceType: existing.sourceType || item.sourceType || null,
          usptoStatus: item.usptoStatus || existing.usptoStatus || null,
          analysisStatus: item.analysisStatus || existing.analysisStatus || null,
          pipelineStage: item.pipelineStage || existing.pipelineStage || null,
          autoPipeline: !!existing.autoPipeline || !!item.autoPipeline,
          updatedAt: item.updatedAt || existing.updatedAt || null,
          createdAt: existing.createdAt || item.createdAt || null
        });
      });
      merged.unofficialTrends = Array.from(unofficialMap.values());

      return merged;
    };

    // 1. Sync Designs
    if (cloudData.savedDesignQueue && cloudData.savedDesignQueue.length > 0) {
      const mergedQueue = [...(local.savedDesignQueue || [])];
      cloudData.savedDesignQueue.forEach(cloudItem => {
        if (!mergedQueue.some(localItem => localItem.id === cloudItem.id)) {
          mergedQueue.push(cloudItem);
          hasNewData = true;
        }
      });
      if (hasNewData) update.savedDesignQueue = mergedQueue;
    }

    // 2. Sync Accounts
    if (cloudData.ap_accounts && cloudData.ap_accounts.length > 0) {
      const mergedAccs = [...(local.ap_accounts || [])];
      cloudData.ap_accounts.forEach(cloudAcc => {
        if (!mergedAccs.some(localAcc => localAcc.email === cloudAcc.email)) {
          mergedAccs.push(cloudAcc);
          hasNewData = true;
        }
      });
      if (hasNewData) update.ap_accounts = mergedAccs;
    }

    // 3. Sync Notes
    if (cloudData.teepublic_manager_data) {
      const localNotesData = local.teepublic_manager_data || { niches: [], doneHistory: [], history: [], unofficialTrends: [] };
      const cloudNotesData = cloudData.teepublic_manager_data || { niches: [], doneHistory: [], history: [], unofficialTrends: [] };
      const mergedNotesData = mergeNoteData(localNotesData, cloudNotesData);

      if (buildNoteSyncSignature(mergedNotesData) !== buildNoteSyncSignature(localNotesData)) {
        update.teepublic_manager_data = mergedNotesData;
        hasNewData = true;
      }
    }

    // 4. Sync USPTO History
    if (cloudData.usptoHistory) {
      const localHistory = local.usptoHistory || {};
      const cloudHistory = cloudData.usptoHistory;
      let historyChanged = false;
      for (const key in cloudHistory) {
        if (!localHistory[key]) {
          localHistory[key] = cloudHistory[key];
          historyChanged = true;
        }
      }
      if (historyChanged) {
        update.usptoHistory = localHistory;
        hasNewData = true;
      }
    }

    if (hasNewData) {
      chrome.storage.local.set(update, () => {
        console.log('✨ Seamless Sync: Local state updated from cloud.');
        showToast('🔄 تم مزامنة بيانات حسابك سحابياً بنجاح');

        // Refresh UI
        if (update.savedDesignQueue) {
          replaceDesignQueue(update.savedDesignQueue);
          renderQueue();
        }
        if (update.ap_accounts && typeof updateAutopilot === 'function') {
          updateAutopilot({ ap_accounts: update.ap_accounts });
        }
        if (update.teepublic_manager_data && typeof window.NHP_activateNotePanel === 'function' && document.getElementById('niche-container')) {
          window.NHP_activateNotePanel();
        } else if (update.teepublic_manager_data && typeof initNoteModule === 'function' && document.getElementById('niche-container')) {
          initNoteModule({ showToast, switchTab });
        }
      });
    }
  });
}

// USPTO & TeePublic tabs — switch panels inside popup
bindOptionalClick('tab-dashboard', () => switchTab('dashboard'));
bindOptionalClick('tab-trend', () => switchTab('trend'));
bindOptionalClick('tab-tmsearch', () => switchTab('tmsearch'));
bindOptionalClick('tab-tmh', () => switchTab('tmh'));
bindOptionalClick('tab-uspto', () => switchTab('uspto'));
bindOptionalClick('tab-teepublic', () => switchTab('teepublic'));
bindOptionalClick('tab-seo', () => switchTab('seo'));
bindOptionalClick('tab-note', () => switchTab('note'));
bindOptionalClick('tab-lab', () => switchTab('lab'));
bindOptionalClick('tab-autopilot', () => switchTab('autopilot'));
bindOptionalClick('tab-creaty', () => switchTab('creaty'));
bindOptionalClick('tab-social', () => switchTab('social'));
bindOptionalClick('tab-redbubble', () => switchTab('redbubble'));
bindOptionalClick('tab-amazon', () => switchTab('amazon'));
bindOptionalClick('tab-studio', () => switchTab('studio'));
bindOptionalClick('tab-generate', () => switchTab('generate'));
bindOptionalClick('tab-canva-bridge', () => switchTab('canva-bridge'));
bindOptionalClick('tab-admin', () => switchTab('admin'));

// Restore active tab
function emergencyPersistDesignQueue() {
  if (!designQueue.length) return;
  try {
    chrome.runtime.sendMessage({
      action: 'emergency_save_design_queue',
      queue: designQueue.map(serializeQueueItemForStorage).filter(Boolean)
    });
  } catch (_) { /* ignore */ }
}

// Global Safe Timer Helpers
function safeSetTimeout(fn, ms) {
  const t = setTimeout(fn, ms);
  if (!window.__nhp_timeouts) window.__nhp_timeouts = [];
  window.__nhp_timeouts.push(t);
  return t;
}
function safeSetInterval(fn, ms) {
  const i = setInterval(fn, ms);
  if (!window.__nhp_intervals) window.__nhp_intervals = [];
  window.__nhp_intervals.push(i);
  return i;
}

// Emergency Safe Reset
window.NHP_SAFE_RESET = function () {
  console.log('[NHP] Emergency Safe Reset triggered');
  if (refreshTimeout) { clearTimeout(refreshTimeout); refreshTimeout = null; }
  if (dashboardRefreshTimeout) { clearTimeout(dashboardRefreshTimeout); dashboardRefreshTimeout = null; }
  if (dashboardQueueFetchTimer) { clearTimeout(dashboardQueueFetchTimer); dashboardQueueFetchTimer = null; }
  if (activeTabPersistTimer) { clearTimeout(activeTabPersistTimer); activeTabPersistTimer = null; }
  if (genBtnSafetyTimeout) { clearTimeout(genBtnSafetyTimeout); genBtnSafetyTimeout = null; }
  
  dashboardDataFingerprint = '';
  lastDataStr = '';
  dashboardBootstrapped = false;
  
  if (window.__nhp_intervals) {
    window.__nhp_intervals.forEach(clearInterval);
    window.__nhp_intervals = [];
  }
  if (window.__nhp_timeouts) {
    window.__nhp_timeouts.forEach(clearTimeout);
    window.__nhp_timeouts = [];
  }
  if (window.__nhp_observers) {
    window.__nhp_observers.forEach(obs => {
      try { obs.disconnect(); } catch(_) {}
    });
    window.__nhp_observers = [];
  }
  
  const active = __nhpActiveTabPanel || 'dashboard';
  console.log('[NHP] Re-rendering active tab:', active);
  switchTab(active);
  refreshAll(true);
  
  if (typeof window.showToast === 'function') {
    window.showToast('♻️ تم إصلاح التجمّد بنجاح وإعادة رندرة القسم النشط');
  }
};

// Lazy initialization variables for embedded tabs
let trendInitialized = false;
let usptoInitialized = false;
let analysisInitialized = false;

function lazyInitializeEmbeddedTab(name) {
  if (name === 'trend' && !trendInitialized) {
    trendInitialized = true;
    if (typeof initTrendModule === 'function') {
      initTrendModule(showToast, switchTab, (data) => usptoUpdate(data, { showToast, switchTab, renderList, parseNiches, exportTxt, copyList }));
    }
  }
  if (name === 'uspto' && !usptoInitialized) {
    usptoInitialized = true;
    if (typeof initUsptoModule === 'function') {
      initUsptoModule({ parseNiches, showToast, copyList, exportTxt, renderList, switchTab });
    }
  }
  if (name === 'teepublic' && !analysisInitialized) {
    analysisInitialized = true;
    if (typeof initAnalysisModule === 'function') {
      initAnalysisModule({ parseNiches, showToast, copyList, exportTxt, renderList, switchTab });
    }
  }
}

function cleanupActiveTab() {
  const prev = __nhpActiveTabPanel;
  if (prev === 'canva-bridge' && typeof window.NHP_deactivateCanvaBridgeTab === 'function') {
    window.NHP_deactivateCanvaBridgeTab();
  }
}

function getOptimisticStartupDefaults() {
  const urlParams = new URLSearchParams(window.location.search);
  const forcedTab = urlParams.get('tab');
  const allowed = ['dashboard', 'trend', 'tmsearch', 'tmh', 'uspto', 'teepublic', 'seo', 'note', 'autopilot', 'studio', 'generate', 'canva-bridge', 'admin', 'lab', 'social', 'redbubble', 'amazon'];
  const forcedResolved = forcedTab === 'promptbag' ? 'generate' : forcedTab;
  const activeTab = allowed.includes(forcedResolved) ? forcedResolved : 'dashboard';
  return {
    activeTab,
    cloudSyncEnabled: true,
    [LOW_SPEC_MODE_KEY]: false,
    [AUTO_LITE_ASSIST_KEY]: true,
    [PERFORMANCE_MODE_KEY]: 'performance',
    [FORCE_I3_MODE_KEY]: false,
    [GOD_MODE_SETTINGS_KEY]: GOD_MODE_DEFAULTS
  };
}

function resolveStartupActiveTab(result) {
  const urlParams = new URLSearchParams(window.location.search);
  const forcedTab = urlParams.get('tab');
  const allowed = ['dashboard', 'trend', 'tmsearch', 'tmh', 'uspto', 'teepublic', 'seo', 'note', 'autopilot', 'studio', 'generate', 'canva-bridge', 'admin', 'lab', 'social', 'redbubble', 'amazon'];
  const storedTab = result.activeTab === 'promptbag' ? 'generate' : result.activeTab;
  const forcedResolved = forcedTab === 'promptbag' ? 'generate' : forcedTab;
  return allowed.includes(forcedResolved)
    ? forcedResolved
    : (allowed.includes(storedTab) ? storedTab : 'dashboard');
}

function applyStartupPreferences(result) {
  const cloudSyncToggleEl = document.getElementById('toggle-cloud-sync');
  if (cloudSyncToggleEl) {
    cloudSyncToggleEl.checked = result.cloudSyncEnabled !== false;
  }
  autoLiteAssistEnabled = result[AUTO_LITE_ASSIST_KEY] !== false;
  forceI3Ram2GbModeEnabled = result[FORCE_I3_MODE_KEY] === true;
  const savedMode = String(result[PERFORMANCE_MODE_KEY] || '').toLowerCase();
  const hasSavedPerfMode = ['performance', 'balanced', 'lite', 'ultra'].includes(savedMode);
  const deviceMemory = Number(navigator.deviceMemory || 0);
  currentPerformanceMode = hasSavedPerfMode
    ? savedMode
    : (result[LOW_SPEC_MODE_KEY] === true
      ? 'lite'
      : (deviceMemory > 0 && deviceMemory <= 8 ? 'balanced' : 'performance'));
  setLowSpecMode(currentPerformanceMode === 'lite' || currentPerformanceMode === 'ultra');
  maybeAutoTunePerformance('startup');

  if (!result[GOD_MODE_SETTINGS_KEY]) {
    chrome.storage.local.set({ [GOD_MODE_SETTINGS_KEY]: GOD_MODE_DEFAULTS });
  } else {
    const mergedGodSettings = mergeGodModeSettings(result[GOD_MODE_SETTINGS_KEY]);
    applyCompactMode(mergedGodSettings.compactMode);
  }
}

function reconcileStartupStorage(storedResult) {
  const merged = { ...getOptimisticStartupDefaults(), ...(storedResult || {}) };
  const prevTab = __nhpActiveTabPanel;
  applyStartupPreferences(merged);
  const active = resolveStartupActiveTab(merged);
  const urlParams = new URLSearchParams(window.location.search);
  const forcedTab = urlParams.get('tab');
  const forcedResolved = forcedTab === 'promptbag' ? 'generate' : forcedTab;
  if (active !== prevTab) {
    switchTab(active);
  }
  if (forcedResolved && ['dashboard', 'trend', 'tmsearch', 'tmh', 'uspto', 'teepublic', 'seo', 'note', 'autopilot', 'studio', 'generate', 'admin', 'lab', 'social', 'redbubble', 'amazon'].includes(forcedResolved)) {
    chrome.storage.local.set({ activeTab: forcedResolved });
  }
}

function initializeWithStorageData(result) {
  applyStartupPreferences(result);
  const active = resolveStartupActiveTab(result);
  switchTab(active);
  const urlParams = new URLSearchParams(window.location.search);
  const forcedTab = urlParams.get('tab');
  const forcedResolved = forcedTab === 'promptbag' ? 'generate' : forcedTab;
  const allowed = ['dashboard', 'trend', 'tmsearch', 'tmh', 'uspto', 'teepublic', 'seo', 'note', 'autopilot', 'studio', 'generate', 'admin', 'lab', 'social', 'redbubble', 'amazon'];
  if (allowed.includes(forcedResolved)) {
    chrome.storage.local.set({ activeTab: forcedResolved });
  }

  window.__nhpInitComplete = true;

  // Defer heavy widgets and refresh logic
  console.log('popup:init:heavy-deferred', performance.now());
  safeSetTimeout(() => {
    scheduleInitialRefresh();
    deferHeavyStartupWork();
  }, 800);

  // Hide loader
  const loaderEl = document.getElementById('nhp-global-loader');
  if (loaderEl) loaderEl.style.display = 'none';
}

function fallbackToDefaults() {
  console.warn('[NHP] Falling back to default startup config...');
  try {
    initializeWithStorageData({
      activeTab: 'dashboard',
      cloudSyncEnabled: true,
      [LOW_SPEC_MODE_KEY]: false,
      [AUTO_LITE_ASSIST_KEY]: true,
      [PERFORMANCE_MODE_KEY]: 'performance',
      [FORCE_I3_MODE_KEY]: false,
      [GOD_MODE_SETTINGS_KEY]: GOD_MODE_DEFAULTS
    });
  } catch (e) {
    console.error('[NHP] Fatal double-fault during fallback:', e);
  }
}

function startPopupInitialization() {
  if (window.__NHP_BOOTSTRAPPED__) return;
  window.__NHP_BOOTSTRAPPED__ = true;

  syncNhpVersionBadge();
  if (typeof NhpStorageMigrate !== 'undefined') {
    NhpStorageMigrate.runStorageMigration().catch(() => {});
  }
  if (typeof NhpRuntimeConfig !== 'undefined') {
    NhpRuntimeConfig.loadFromStorage().catch(() => {});
  }

  try {
    initPipelineProgressFloat();
  } catch (err) {
    console.warn('[NHP] pipeline progress float skipped:', err);
  }

  try {
    if (typeof bindApUploadConfirmModalEarly === 'function') {
      bindApUploadConfirmModalEarly();
    }
  } catch (err) {
    console.warn('[NHP] upload confirm modal bind skipped:', err);
  }

  window.addEventListener('pagehide', emergencyPersistDesignQueue);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') emergencyPersistDesignQueue();
  });
  initMarketsInlineTabs();
  initGlobalHeaderDropdownNav();
  initDashboardActions();
  
  // Watchdog warning timer for initial loading skeleton
  const loaderWarningTimer = safeSetTimeout(() => {
    const warningEl = document.getElementById('nhp-loader-warning');
    if (warningEl) warningEl.style.display = 'block';
  }, 3000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersistActiveTab();
  });
  window.addEventListener('pagehide', flushPersistActiveTab);

  initGodModeSettings();

  document.addEventListener('click', (event) => {
    const aiBtn = event.target.closest('[data-dash-ai]');
    if (aiBtn) {
      event.preventDefault();
      const query = aiBtn.getAttribute('data-dash-ai') || '';
      openIsolatedToolWindow(`https://www.google.com/search?q=${query}&udm=50`);
      return;
    }
    const teeBtn = event.target.closest('[data-dash-tp]');
    if (teeBtn) {
      event.preventDefault();
      const query = teeBtn.getAttribute('data-dash-tp') || '';
      openIsolatedToolWindow(`https://www.teepublic.com/t-shirts?query=${query}`);
      return;
    }
  });

  // Tab/window mode only — never use viewport width on the toolbar popup (causes collapse)
  const urlParams = new URLSearchParams(window.location.search);
  const isTab = urlParams.get('mode') === 'tab';
  const forcedTab = urlParams.get('tab');

  if (isTab) {
    document.documentElement.classList.add('nhp-tab-mode');
    document.body.classList.add('full-page');
    // Hide controls meant for launching expanded modes
    const expandBtn = document.getElementById('btnExpand');
    const windowBtn = document.getElementById('btnLaunchWindow');
    if (expandBtn) expandBtn.style.display = 'none';
    if (windowBtn) windowBtn.style.display = 'none';
  } else {
    document.documentElement.classList.add('nhp-popup-mode');
    document.body.classList.add('nhp-popup-mode');
  }

  // Fast storage read first (skip heavy savedDesignQueue blob on critical path)
  const startupStorageKeys = [
    'activeTab', 'cloudSyncEnabled', LOW_SPEC_MODE_KEY, AUTO_LITE_ASSIST_KEY,
    PERFORMANCE_MODE_KEY, FORCE_I3_MODE_KEY, GOD_MODE_SETTINGS_KEY
  ];

  try {
    console.log('popup:init:start', performance.now());
    const optimistic = getOptimisticStartupDefaults();
    initializeWithStorageData(optimistic);
    console.log('popup:init:first-render', performance.now());

    chrome.storage.local.get(startupStorageKeys, (result) => {
      console.log('popup:init:storage-loaded', performance.now());
      if (loaderWarningTimer) clearTimeout(loaderWarningTimer);

      if (chrome.runtime.lastError) {
        console.error('popup:init:error', chrome.runtime.lastError);
        return;
      }

      try {
        reconcileStartupStorage(result);
      } catch (err) {
        console.error('popup:init:error inside storage reconcile:', err);
      }
    });
  } catch (err) {
    console.error('popup:init:error during startup get:', err);
    fallbackToDefaults();
  }

  // Cloud Sync Toggle Initialization (initial state from merged storage read above)
  const cloudSyncToggle = document.getElementById('toggle-cloud-sync');
  if (cloudSyncToggle) {
    cloudSyncToggle.addEventListener('change', () => {
      const isEnabled = cloudSyncToggle.checked;
      chrome.storage.local.set({ cloudSyncEnabled: isEnabled }, () => {
        showToast(isEnabled ? '✅ تم تفعيل المزامنة السحابية' : '⚠️ تم تعطيل المزامنة السحابية الذكية');
        if (isEnabled && typeof autoSyncCloudData === 'function') {
          const runSync = () => { autoSyncCloudData(); };
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(runSync, { timeout: 6000 });
          } else {
            setTimeout(runSync, 400);
          }
        }
      });
    });
  }

  const lowSpecBtn = document.getElementById('btn-low-spec-mode');
  if (lowSpecBtn) {
    lowSpecBtn.addEventListener('click', () => {
      const cycleOrder = forceI3Ram2GbModeEnabled
        ? ['ultra', 'lite', 'balanced', 'performance']
        : ['performance', 'balanced', 'lite'];
      const nextIndex = (cycleOrder.indexOf(currentPerformanceMode) + 1) % cycleOrder.length;
      const nextMode = cycleOrder[nextIndex];
      setAdaptivePerformanceMode(nextMode, 'manual');
      chrome.storage.local.set({ [LOW_SPEC_MODE_KEY]: nextMode === 'lite' || nextMode === 'ultra', [PERFORMANCE_MODE_KEY]: nextMode }, () => {
        showToast(`🎛️ Manual mode: ${nextMode.toUpperCase()}`);
        refreshAll(true);
      });
    });
  }

  const adminTmhShell = document.getElementById('admin-tmhunt-shell');
  const adminTmhHost = document.getElementById('admin-tmhunt-host');
  const adminOpenTmhBtn = document.getElementById('btn-admin-open-tmhunt');
  const adminCloseTmhBtn = document.getElementById('btn-admin-close-tmhunt');

  const openAdminTmhunt = async () => {
    await ensurePanelLoaded('tmh').catch(() => {});
    const tmhPanel = document.getElementById('panel-tmh');
    if (!tmhPanel || !adminTmhHost || !adminTmhShell) return;
    tmhPanel.classList.remove('tab-panel', 'active');
    tmhPanel.style.padding = '0';
    tmhPanel.style.margin = '0';
    tmhPanel.style.minHeight = '0';
    tmhPanel.style.display = 'block';
    adminTmhHost.appendChild(tmhPanel);
    adminTmhShell.classList.remove('hidden');
  };

  if (adminOpenTmhBtn) {
    adminOpenTmhBtn.addEventListener('click', () => {
      switchTab('admin');
      openAdminTmhunt();
    });
  }
  if (adminCloseTmhBtn && adminTmhShell) {
    adminCloseTmhBtn.addEventListener('click', () => {
      adminTmhShell.classList.add('hidden');
    });
  }

  bindOptionalClick('tmhub-btn-uspto', () => switchTab('uspto'));
  bindOptionalClick('tmhub-btn-analysis', () => switchTab('teepublic'));

  registerPanelLoader('tmh', () => loadPanelHtml('panel-tmh', 'modules/tmhunt/tmhunt.html', () => {
    if (typeof initTMHuntModule === 'function') initTMHuntModule({ showToast, switchTab });
  }));

  registerPanelLoader('note', () => loadPanelHtml('panel-note', 'modules/note/note.html?v=note_hunt_pagination_20260604', async () => {
    if (typeof initNoteModule === 'function') await initNoteModule({ showToast, switchTab });
  }));

  registerPanelLoader('studio', () => loadPanelHtml('panel-studio', 'modules/studio/studio.html?v=force_20260508_studio_step1_one_col', () => {
    if (typeof initStudioModule === 'function') {
      initStudioModule({
        showToast,
        switchTab,
        getWorkspaceHandle: () => window.NHP_WorkspaceHandle,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue,
        showDesignPreview
      });
    }
  }));
  registerPanelLoader('generate', () => loadPanelHtml('panel-generate', 'modules/generate/generate.html?v=generate_20260628', () => {
    if (typeof initGenerateModule === 'function') {
      initGenerateModule({
        showToast,
        showWarnToast,
        switchTab,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue
      });
      window.NHP_activateGeneratePanel = activateGeneratePanel;
      void consumePendingGenerateFromImage();
    }
  }, null, '#panel-generate-content'));

  registerPanelLoader('canva-bridge', () => loadPanelHtml('panel-canva-bridge', 'modules/generate/canva-bridge.html?v=20260628f', () => {
    if (typeof initCanvaBridgePanel === 'function') {
      initCanvaBridgePanel({
        showToast,
        switchTab,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue
      });
      window.NHP_activateCanvaBridgeTab = activateCanvaBridgeTab;
      window.NHP_deactivateCanvaBridgeTab = deactivateCanvaBridgeTab;
    }
  }));

  // CLIProxyAPI Manager is opened via an Admin button (no standalone panel).

  registerPanelLoader('lab', () => loadPanelHtml('panel-lab', 'modules/radar/radar.html?v=note_columns_50_50_20260604', async () => {
    if (typeof initRadarModule === 'function') initRadarModule({ showToast, switchTab });
    if (typeof window.NHP_consumePendingRadarFromNote === 'function') {
      await window.NHP_consumePendingRadarFromNote();
    }
  }));

  registerPanelLoader('seo', () => loadPanelHtml('panel-seo', 'modules/seo/seo.html?v=force_20260518_queue_recovery', () => {
    if (typeof initSeoModule === 'function') {
      initSeoModule({
        showToast,
        switchTab,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue,
        showDesignPreview,
        removeFromQueue,
        recoverDesignQueueFromIndexedDB
      });
    }
  }));

  registerPanelLoader('autopilot', () => loadPanelHtml('panel-autopilot', 'modules/autopilot/autopilot.html', () => {
    if (typeof initAutopilotModule === 'function') {
      initAutopilotModule({
        showToast,
        switchTab,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue,
        showDesignPreview,
        removeFromQueue
      });
    }
  }));

  registerPanelLoader('creaty', () => loadPanelHtml('panel-creaty', 'modules/creaty/creaty.html?v=creaty_full_ui_20260609', () => {
    if (typeof initCreatyModule === 'function') {
      initCreatyModule({ showToast, switchTab });
      window.NHP_activateCreatyPanel = NHP_activateCreatyPanel;
    }
  }));
  registerPanelLoader('social', () => loadPanelHtml('panel-social', 'social.html', () => {
    if (typeof initSocialModule === 'function') {
      initSocialModule({ showToast, switchTab });
    }
  }));

  registerPanelLoader('redbubble', () => loadPanelHtml('panel-redbubble', 'modules/market-hubs/redbubble-hub.html', () => {
    if (typeof initRedbubbleHubModule === 'function') {
      initRedbubbleHubModule({
        showToast,
        switchTab,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue,
        showDesignPreview,
        removeFromQueue
      });
    }
  }));

  registerPanelLoader('amazon', () => loadPanelHtml('panel-amazon', 'modules/market-hubs/amazon-hub.html', () => {
    if (typeof initAmazonHubModule === 'function') {
      initAmazonHubModule({
        showToast,
        switchTab,
        getDesignQueue: () => designQueue,
        setDesignQueue: (q) => { replaceDesignQueue(q); },
        saveQueueToStorage,
        renderQueue,
        showDesignPreview,
        removeFromQueue
      });
    }
  }));

registerPanelLoader('admin', () => loadPanelHtml('panel-admin', 'modules/admin/admin.html?v=admin_scroll_theme_strip_20260510', () => {
    const adminPanelContainer = document.getElementById('panel-admin');
    if (typeof initAdminModule === 'function') {
      return initAdminModule({
            showToast,
            switchTab,
            updateWorkspaceUI: (connected, name) => {
              const indicator = document.getElementById('workspace-indicator');
              const pathEl = document.getElementById('workspace-path');
              if (indicator && pathEl) {
                indicator.className = connected ? 'bg-safe shadow-safe' : 'bg-slate-500';
                pathEl.textContent = connected ? name : "المجلد التلقائي غير متصل";
                pathEl.style.color = connected ? 'var(--safe)' : 'var(--text)';
              }
            },
            refreshLocalLibrary: () => {
              if (typeof refreshLocalLibrary === 'function') refreshLocalLibrary();
            },
            saveQueueToStorage,
            backgroundSyncData: () => {},
            initNoteModule: () => {
              if (typeof initNoteModule === 'function') initNoteModule({ showToast, switchTab });
            }
      }).then(() => {
        if (typeof updateAuthUI === 'function') updateAuthUI();
      });
    }
  }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPopupInitialization);
} else {
  startPopupInitialization();
}

// Pro Upgrade Btn
bindOptionalClick('proUpgradeBtn', () => {
  chrome.tabs.create({ url: 'https://maggouriverse.gumroad.com/l/yjgby' });
});

// Launch as Independent App Window
document.getElementById('btnLaunchWindow')?.addEventListener('click', () => {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html?mode=tab'),
    type: 'popup',
    width: 1280,
    height: 850,
    focused: false
  });
});

// Expand to Large Tab Mode
document.getElementById('btnExpand')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=tab') });
});

// Update Popup Btn
document.getElementById('btnUpdatePopup')?.addEventListener('click', () => {
  location.reload();
});

// Reset All Data Btn
document.getElementById('btnResetAll')?.addEventListener('click', () => {
  if (confirm('⚠️ هل أنت متأكد من أنك تريد مسح كافة البيانات وإعادة التعيين بشكل كامل؟\nلا يمكن التراجع عن هذه العملية.')) {
    chrome.storage.local.clear(async () => {
      await NHPDatabase.clearAllImages().catch(() => {});
      showToast('🔄 تم مسح كافة البيانات، جاري إعادة التشغيل...');
      setTimeout(() => location.reload(), 1500);
    });
  }
});

// ══════════════════════════════════════════════════════
//  TOAST & HELPERS
// ══════════════════════════════════════════════════════
function getToastEl() {
  return document.getElementById('toast');
}

export function showToast(msg, ms = 2500) {
  const toast = getToastEl();
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('is-warn');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), ms);
}

export function showWarnToast(msg, ms = 4000) {
  const toast = getToastEl();
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('is-warn', 'show');
  setTimeout(() => {
    toast.classList.remove('show', 'is-warn');
  }, ms);
}
window.showToast = showToast;
window.showWarnToast = showWarnToast;

export function parseNiches(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  return el.value
    .split(/[\n,]+/)
    .map(n => n.trim())
    .filter(n => n.length > 0);
}

export function renderList(arr, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  
  const sig = arr ? `${arr.length}-${arr[0]}-${arr[arr.length - 1]}` : 'empty';
  if (el._renderSig === sig) return;
  el._renderSig = sig;

  if (!arr || arr.length === 0) {
    el.innerHTML = '<div class="empty-msg">لا توجد نتائج</div>';
    return;
  }

  const MAX_RENDER = getActivePerformanceProfile().listMaxRender;
  const toRender = arr.slice(0, MAX_RENDER);
  const frag = document.createDocumentFragment();
  const useListDelegation = containerId === 'u-safeList' || containerId === 'u-bannedList';

  toRender.forEach((n, i) => {
    const div = document.createElement('div');
    div.className = 'card-item animate-scale-in';
    div.title = n;
    if (useListDelegation) div.dataset.niche = n;

    let badge = '';
    if (containerId === 'u-safeList') badge = '<span style="background:var(--safe); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">SAFE</span>';
    if (containerId === 'u-bannedList') badge = '<span style="background:var(--banned); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">BANNED</span>';
    if (containerId === 'tp-excelList') badge = '<span style="background:var(--safe); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">EXCELLENT</span>';
    if (containerId === 'tp-medList') badge = '<span style="background:var(--warning); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">AVERAGE</span>';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i + 1}. ${n}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          ${badge}
          <i class="fa-solid fa-shield-halved ai-global-audit" data-niche="${n}" title="فحص الأمان الذكي (AI)" style="font-size: 10px; color: ${containerId.includes('safe') || containerId.includes('excel') ? 'var(--safe)' : 'var(--banned)'}; opacity: 0.5; cursor: pointer;"></i>
        </div>
      </div>
    `;

    if (!useListDelegation) {
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('ai-global-audit')) {
          e.stopPropagation();
          const niche = e.target.getAttribute('data-niche');
          if (niche) {
            showToast(`🛡️ جاري تحليل الأمان لـ "${niche}"...`);
            if (window.AICentralBrain) {
              window.AICentralBrain.checkTrademarkRisk(niche).then(report => {
                alert(`🛡️ تقرير الحارس القانوني (AI):\n\n${report || 'فشل جلب التقرير'}`);
              });
            }
          }
          return;
        }
        navigator.clipboard.writeText(n).then(() => showToast(`✅ تم نسخ: ${n}`));
      });
    }
    frag.appendChild(div);
  });

  if (arr.length > MAX_RENDER) {
    const moreDiv = document.createElement('div');
    moreDiv.className = 'text-center py-2 text-slate-500 text-[10px]';
    moreDiv.textContent = `+${arr.length - MAX_RENDER} عناصر أخرى مخفية لتسريع الواجهة`;
    frag.appendChild(moreDiv);
  }

  el.innerHTML = '';
  el.appendChild(frag);
  el.scrollTop = el.scrollHeight;
}

export function exportTxt(data, filename) {
  const content = Array.isArray(data) ? data.join('\n') : data;
  if (!content) { showToast('⚠️ لا توجد بيانات للتصدير'); return; }
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 تم التصدير بنجاح!');
}

export function copyList(storageKey, label) {
  chrome.storage.local.get(storageKey, d => {
    const arr = d[storageKey] || [];
    if (!arr.length) { showToast('⚠️ القائمة فارغة'); return; }
    navigator.clipboard.writeText(arr.join('\n'))
      .then(() => showToast(`✅ تم نسخ ${label} !`));
  });
}

// ══════════════════════════════════════════════════════
//  SMART LIVE UPDATE & SPEED OPTIMIZATION
// ══════════════════════════════════════════════════════
const UI_KEYS = [
  'uRunning', 'uPending', 'uSafe', 'uBanned', 'uErrors', 'uTotal', 'uCurrent', 'usptoFastWorkerTarget', 'usptoFastWorkerActive', 'usptoRunMode',
  'tpRunning', 'tpPending', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpTotal', 'tpCurrent', 'tpDailyLimit', 'tpPageCounts',
  'ap_accounts', 'ap_accounts_teepublic', 'ap_accounts_redbubble', 'ap_accounts_amazon', 'ap_accounts_pinterest', 'ap_proxy_pool', 'ap_auto_rotate', 'ap_visual_mode', 'ap_auto_login',
  'emailcore_aut_last_sync', 'emailcore_sessions',
  AP_UPLOAD_QUEUE_STATE_KEY,
  'isFullAuto',
  'rbTotal', 'rbUploaded', 'rbPending',
  ...TASK_PROGRESS_STORAGE_KEYS
];
let lastDataStr = '';
let refreshTimeout = null;

function refreshAll(force = false) {
  if (!force && refreshTimeout) return;
  const refreshDelay = force ? 0 : getActivePerformanceProfile().refreshDelayMs;
  refreshTimeout = setTimeout(() => {
    chrome.storage.local.get(UI_KEYS, data => {
      const currentDataStr = JSON.stringify({
        u: [data.uRunning, (data.uSafe || []).length, (data.uBanned || []).length, (data.uErrors || []).length, (data.uPending || []).length, data.uCurrent, data.usptoFastWorkerTarget, data.usptoFastWorkerActive, data.usptoRunMode],
        tp: [data.tpRunning, (data.tpExcel || []).length, (data.tpMed || []).length, (data.tpSat || []).length, (data.tpEmp || []).length, data.tpCurrent],
        ap: (data.ap_accounts || []).length
      });
      if (!force && currentDataStr === lastDataStr) {
        refreshTimeout = null;
        return;
      }
      lastDataStr = currentDataStr;

      // Global Module Updates (pipeline side-effects run inside each module; UI gated per panel)
      updateUSPTO(data);
      analysisUpdate(data, { showToast, switchTab, renderList, parseNiches, exportTxt, copyList });

      const queueState = data[AP_UPLOAD_QUEUE_STATE_KEY];
      const uploadBusy = queueState && ['uploading', 'running'].includes(String(queueState.overallStatus || '').toLowerCase());
      if (typeof updateAutopilot === 'function' && (isAutopilotPanelActive() || uploadBusy)) {
        updateAutopilot(data);
      }

      // Badge counts only; no animation for a lighter UI.
      ['usptoTabCount', 'tpTabCount'].forEach(id => {
        const count = id === 'usptoTabCount' ? (data.uSafe?.length || 0) : ((data.tpExcel || []).length);
        const indicator = document.getElementById(id);
        if (indicator) indicator.textContent = count;
      });

      const trendKpiTotal = document.getElementById('trend-kpi-total');
      const trendKpiSafe = document.getElementById('trend-kpi-safe');
      const trendKpiAnalysis = document.getElementById('trend-kpi-analysis');
      const trendKpiState = document.getElementById('trend-kpi-state');
      const dashTpTotal = document.getElementById('dash-tp-total');
      const dashTpUploaded = document.getElementById('dash-tp-uploaded');
      const dashTpPending = document.getElementById('dash-tp-pending');
      const dashTpProgress = document.getElementById('dash-tp-progress');
      const dashRbTotal = document.getElementById('dash-rb-total');
      const dashRbUploaded = document.getElementById('dash-rb-uploaded');
      const dashRbPending = document.getElementById('dash-rb-pending');
      const dashRbProgress = document.getElementById('dash-rb-progress');
      if (isDashboardPanelActive()) {
        const totalDesigns = (data.tpTotal || 0) + ((data.uSafe || []).length + (data.uBanned || []).length + (data.uErrors || []).length);
        const uploaded = (data.tpExcel || []).length;
        const pending = Math.max(0, (data.tpPending || []).length + (data.uPending || []).length);
        const progressPct = totalDesigns > 0 ? Math.round((uploaded / totalDesigns) * 100) : 0;
        if (trendKpiTotal) trendKpiTotal.textContent = String(totalDesigns);
        if (trendKpiSafe) trendKpiSafe.textContent = String(uploaded);
        if (trendKpiAnalysis) trendKpiAnalysis.textContent = String(pending);
        if (trendKpiState) trendKpiState.textContent = `${progressPct}%`;
        if (dashTpTotal) dashTpTotal.textContent = String(data.tpTotal || 0);
        if (dashTpUploaded) dashTpUploaded.textContent = String((data.tpExcel || []).length);
        if (dashTpPending) dashTpPending.textContent = String((data.tpPending || []).length);
        if (dashTpProgress) {
          dashTpProgress.style.width = `${Math.max(0, Math.min(100, data.tpTotal > 0 ? Math.round(((data.tpExcel || []).length / data.tpTotal) * 100) : 0))}%`;
        }
        if (dashRbTotal) dashRbTotal.textContent = String((data.rbTotal || 0));
        if (dashRbUploaded) dashRbUploaded.textContent = String((data.rbUploaded || 0));
        if (dashRbPending) dashRbPending.textContent = String((data.rbPending || 0));
        if (dashRbProgress) {
          const rbTotal = Number(data.rbTotal || 0);
          const rbUploaded = Number(data.rbUploaded || 0);
          const rbPct = rbTotal > 0 ? Math.round((rbUploaded / rbTotal) * 100) : 0;
          dashRbProgress.style.width = `${Math.max(0, Math.min(100, rbPct))}%`;
        }
        updateDashboardTaskProgress(data);
        scheduleDashboardRefresh();
        requestDashboardQueueState();
      }
      refreshTimeout = null;
    });
  }, refreshDelay);
}

function shouldSkipStorageRefresh(changes = {}) {
  if (!isStorageEchoSuppressed()) return false;
  const keys = Object.keys(changes);
  if (!keys.length) return true;
  return keys.every((key) => INTERNAL_ECHO_STORAGE_KEYS.has(key));
}

window.NHP_scheduleUnifiedSync = function NHP_scheduleUnifiedSync(changes = {}) {
  const relevant = changes.savedDesignQueue || changes.ap_accounts || changes.teepublic_manager_data || changes.usptoHistory;
  if (!relevant) return;
  if (isBatchProcessing || window.isBatchProcessing) return;
  clearTimeout(window.unifiedSyncTimer);
  window.unifiedSyncTimer = setTimeout(() => {
    if (typeof window.NHP_writeSmartSyncFile === 'function') {
      window.NHP_writeSmartSyncFile();
    }
    if (typeof window.NHP_backgroundSyncData === 'function') {
      window.NHP_backgroundSyncData();
      return;
    }
    if (typeof GitHubSync === 'undefined' || !GitHubSync?.config?.token || GitHubSync.config.token === 'YOUR_GITHUB_TOKEN') {
      return;
    }
    chrome.storage.local.get(['cloudSyncEnabled', 'savedDesignQueue', 'ap_accounts', 'teepublic_manager_data', 'usptoHistory'], async (res) => {
      if (res.cloudSyncEnabled === false) return;
      try {
        await GitHubSync.syncData({
          savedDesignQueue: res.savedDesignQueue || [],
          ap_accounts: res.ap_accounts || [],
          teepublic_manager_data: res.teepublic_manager_data || null,
          usptoHistory: res.usptoHistory || {}
        });
      } catch (error) {
        console.warn('[NHP] Cloud sync skipped:', error);
      }
    });
  }, 1400);
};

function updateUSPTO(data) {
  if (typeof usptoUpdate === 'function') {
    usptoUpdate(data, { showToast, switchTab, renderList, parseNiches, exportTxt, copyList });
  }
}

function scheduleInitialRefresh() {
  const run = () => refreshAll(true);
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 2200 });
  } else {
    setTimeout(run, 120);
  }
}

function deferHeavyStartupWork() {
  const runQueueHydration = async () => {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['savedDesignQueue'], (data) => resolve(data || {}));
      });
      if (result.savedDesignQueue && Array.isArray(result.savedDesignQueue)) {
        replaceDesignQueue(result.savedDesignQueue);
        if (designQueue.length > 0) {
          const repair = await repairQueueLibraryRefs({ silent: false });
          if (repair.repaired > 0) {
            console.log(`[NHP] Repaired ${repair.repaired} queue library refs`);
          }
          renderQueue();
          showDesignPreview(designQueue[0].id);
        }
      }
      const recovery = await recoverDesignQueueFromIndexedDB({ silent: false });
      if (recovery.recovered > 0) {
        console.log(`[NHP] Recovered ${recovery.recovered} designs from IndexedDB`);
      } else if (recovery.needsPrompt && recovery.orphans > 0) {
        console.log(`[NHP] ${recovery.orphans} orphaned designs in IndexedDB — use recover button in SEO`);
      }
    } catch (recoveryError) {
      console.warn('[NHP] Queue recovery skipped:', recoveryError);
    }
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => { runQueueHydration(); }, { timeout: 4500 });
  } else {
    setTimeout(() => { runQueueHydration(); }, 350);
  }
}

// Initial Load and Storage Listeners — deferred until DOMContentLoaded marks init complete
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (typeof window.NHP_scheduleUnifiedSync === 'function') {
    window.NHP_scheduleUnifiedSync(changes);
  }
  if (changes[AP_UPLOAD_QUEUE_STATE_KEY] && isDashboardPanelActive()) {
    renderDashboardQueueMonitor(changes[AP_UPLOAD_QUEUE_STATE_KEY].newValue || {});
  }
  if (changes[FORCE_I3_MODE_KEY]) {
    forceI3Ram2GbModeEnabled = changes[FORCE_I3_MODE_KEY].newValue === true;
    maybeAutoTunePerformance('i3-2gb-toggle');
    refreshAll(true);
    return;
  }
  if (shouldSkipStorageRefresh(changes)) return;
  const relevant = Object.keys(changes).some(key => UI_KEYS.includes(key));
  if (relevant) refreshAll();
});

// Final Setup & UI triggers


// تفعيل زر إزالة الصور الفردية من الطابور (معرض الصور قيد الانتظار)
document.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.remove-btn');
  if (removeBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = removeBtn.getAttribute('data-remove-id');
    if (id && typeof window.removeFromQueue === 'function') {
      window.removeFromQueue(id);
      if (typeof window.showToast === 'function') {
        window.showToast('🗑️ تم حذف الصورة من الطابور');
      }
    }
  }
});

// ==========================================
// AI CREATIVE STUDIO V2 (Gemini Web Automation)
// ==========================================
const GEN_BTN_DEFAULT_HTML = '<span>Gen 5</span> <i class="fas fa-bolt"></i>';
let genBtnSafetyTimeout = null;

function resetGenerateBtnState() {
  const genBtn = document.getElementById('generate-btn');
  if (!genBtn) return;
  if (genBtnSafetyTimeout) {
    clearTimeout(genBtnSafetyTimeout);
    genBtnSafetyTimeout = null;
  }
  genBtn.innerHTML = GEN_BTN_DEFAULT_HTML;
  genBtn.disabled = false;
}

function armGenerateBtnSafetyTimeout(ms = 180000) {
  if (genBtnSafetyTimeout) clearTimeout(genBtnSafetyTimeout);
  genBtnSafetyTimeout = setTimeout(() => {
    const genBtn = document.getElementById('generate-btn');
    if (genBtn?.disabled) {
      resetGenerateBtnState();
      showToast('↩️ انتهت مهلة الانتظار — يمكنك الضغط على Gen 5 مجدداً', 3500);
    }
  }, ms);
}

document.addEventListener('click', async (e) => {
  const genBtn = e.target.closest('#generate-btn');
  if (genBtn) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // إيقاف أي منطق قديم (مثل Fal.ai) بشكل نهائي
    const nicheInput = document.getElementById('niche-input');
    const nicheText = nicheInput ? nicheInput.value.trim() : '';

    // التحقق من وجود نيتش مكتوب أو صورة مرجعية في الطابور
    if (!nicheText && designQueue.length === 0) {
      showToast('⚠️ الرجاء كتابة النيتش أو رفع صورة مرجعية للطابور أولاً!', 3000);
      return;
    }

    genBtn.innerHTML = '<span>⏳ جاري فتح النافذة...</span> <i class="fas fa-spinner fa-spin"></i>';
    genBtn.disabled = true;
    armGenerateBtnSafetyTimeout();

    // إذا كان هناك صورة في أول الطابور، نأخذها كمرجع
    let base64DataUrl = null;
    if (designQueue.length > 0) {
      let b64 = designQueue[0].base64;
      if (!b64) {
        try { b64 = await NHPDatabase.getImage(designQueue[0].id); } catch(err){}
      }
      if (b64) {
        base64DataUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
      }
    }

    // بناء البرومبت بذكاء حسب المعطيات المتوفرة
    const prompt = nicheText
      ? `أنا مصمم Print-on-Demand. النيتش المطلوب هو: "${nicheText}".\nقم بتوليد 4 تصاميم احترافية جداً ومبتكرة لهذا النيتش جاهزة للطباعة على T-shirt بخلفية سوداء بالكامل بستايل مميز (فيكتور، توضيحي، أو كلاسيكي) كما هو مطلوب في الـ Gem.`
      : `استخدم هذه الصورة كمرجع. قم بتحليل النيتش واستخراج الأفكار ثم توليد 4 تصاميم احترافية بستايل مميز للطباعة عند الطلب (POD) وبخلفية سوداء كما هو مطلوب في الـ Gem.`;

    // Use a numeric timestamp so background's idle-storage sweep can recognise this
    // payload as fresh and avoid wiping it before gemini-content.js consumes it.
    chrome.storage.local.set({
      gemini_pending_image: base64DataUrl,
      gemini_pending_prompt: prompt,
      gemini_auto_trigger: Date.now()
    }, () => {
      if (chrome.runtime.lastError) {
        resetGenerateBtnState();
        showToast('⚠️ تعذر حفظ إعدادات التوليد — حاول مجدداً', 3500);
        return;
      }
      const targetUrl = 'https://gemini.google.com/gem/17JX6Wb5RhTO25MXBEEYdAJZ0agwbQ-Yg?usp=sharing';
      chrome.runtime.sendMessage({ action: 'OPEN_GEMINI_POPUP', url: targetUrl, focused: false }, () => {
        if (chrome.runtime.lastError) {
          console.warn('⚠️ Background script not reachable. Opening directly...');
          if (chrome.windows) {
            chrome.windows.create({ url: targetUrl, type: 'popup', width: 900, height: 800, focused: false });
          } else if (chrome.tabs) {
            chrome.tabs.create({ url: targetUrl, active: false });
          } else {
            window.open(targetUrl, '_blank', 'width=900,height=800,popup=yes');
          }
        }
        resetGenerateBtnState();
      });
      showToast('✨ تم إرسال المعطيات وفتح نافذة التوليد!', 4000);
    });
  }
}, true); // Capture Phase لضمان اعتراض الزر قبل أي سكريبت آخر

// استقبال الصور فور انتهاء Gemini من توليدها
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'GEMINI_IMAGES_GENERATED' && message.images) {
    showToast('📥 جاري سحب التصاميم للطابور...', 4000);
    resetGenerateBtnState();

    for (let i = 0; i < message.images.length; i++) {
      try {
        const res = await fetch(message.images[i]);
        const blob = await res.blob();
        const file = new File([blob], `AI_Creative_Studio_Design_${Date.now()}_${i + 1}.png`, { type: 'image/png' });

        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result;
          const b64 = dataUrl.split(',')[1];
          const thumbnail = await createQueueThumbnail(dataUrl, getActivePerformanceProfile().thumbnailWidth);
          // إضافة النتائج في أول طابور الأداة لكي تظهر أمامك فوراً
          designQueue.unshift(normalizeQueueItem({ id: 'img_' + Math.random().toString(36).substr(2, 9), file: file, base64: b64, thumbnail, status: 'pending', meta: {} }));
          syncGlobalQueueReference();
          renderQueue();
          saveQueueToStorage(true);
        };
        reader.readAsDataURL(blob);
      } catch (e) { console.error("Failed to load generated image", e); }
    }
    showToast('🎉 اكتملت العملية! تم سحب التصاميم بنجاح.', 4000);
  }
});
