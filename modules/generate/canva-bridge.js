/**
 * Canva Bridge — top-level Studio & AI workspace.
 * Reuses Prompt Generator library; manual SEO send via dedicated button.
 */

import { createLightboxZoom } from '../../utils/lightbox-zoom.js';
import {
  createLibraryRenamePoller,
  getNotePickerItems,
  patchLibraryDisplayName,
  requestLibrarySmartRename
} from '../../utils/library-naming.js';

const CANVA_SECRET_PLACEHOLDER = '••••••';
const DEFAULT_CANVA_REDIRECT_URI = 'http://127.0.0.1:3019/api/canva/auth/callback';
const CANVA_AUTO_CONNECT_KEY = 'canvaAutoConnect';
const CANVA_STUDIO_PEEL_DISPATCH_ACTION = 'generate_library_to_studio_peel';
const CANVA_STUDIO_PEEL_BUFFER_KEY = 'studio_peel_banana_buffer';
const CANVA_STUDIO_TEEMASTER_DISPATCH_ACTION = 'generate_library_to_studio_teemaster';
const CANVA_STUDIO_TEEMASTER_BUFFER_KEY = 'studio_teemaster_buffer';
const CANVA_FULL_PIPELINE_STEP_LABELS = [
  'Peel Banana — إزالة العلامة',
  'TeeMaster Pro 5K — استقبال الصور',
  'السحر الشامل — تنظيف الخلفية',
  'معالجة + RENAME AI + SEO',
  'Autopilot — رفع الحسابات'
];
const CANVA_TEEMASTER_FULL_PATH_STEP_LABELS = [
  'TeeMaster Pro 5K — استقبال الصور',
  'السحر الشامل — تنظيف الخلفية',
  'معالجة 5K — حفظ في التصاميم المعدّلة',
  'إرسال إلى SEO (مكتبة محلية)',
  'توليد SEO محلي + Autopilot'
];
/** معالجة TeeMaster (بدون Peel): استقبال → سحر → 5K → حفظ معدّل */
const CANVA_TEEMASTER_EDITED_STEP_LABELS = [
  'TeeMaster Pro 5K — استقبال الصور',
  'السحر الشامل — تنظيف الخلفية',
  'معالجة 5K — حفظ في التصاميم المعدّلة'
];
const CANVA_TEEMASTER_EDITED_VERSION = 'TeeMaster Edited';
const CANVA_TEEMASTER_SEND_ONLY_LABEL = 'إرسال إلى TeeMaster فقط';
const CANVA_PIPELINE_ITEM_DELAY_MS = 150;
const CANVA_TEEMASTER_CHUNK_QUEUE_TIMEOUT_MS = 120000;
const CANVA_TEEMASTER_CHUNK_PROCESS_TIMEOUT_MS = 300000;
const CANVA_TEEMASTER_BUFFER_MAX = 500;
const CANVA_TEEMASTER_PIPELINE_CHUNK_SIZE_DEFAULT = 15;
const CANVA_TEEMASTER_LARGE_BATCH_WARN = 50;
const CANVA_TEEMASTER_PIPELINE_MAX_DESIGNS = 500;
const CANVA_TEEMASTER_SEO_ENQUEUE_CHUNK = 20;
const CANVA_TEEMASTER_TIMEOUT_PER_ITEM_MS = 5000;
const CANVA_TEEMASTER_TIMEOUT_MIN_MS = 180000;
const CANVA_TEEMASTER_TIMEOUT_MAX_MS = 3600000;

let canvaAutoConnectEnabled = true;
let canvaAutoConnectAttempted = false;
let canvaManualDisconnect = false;
let canvaAutoConnectRunning = false;

let canvaSettingsState = {
  open: false,
  hasSecret: false,
  saving: false
};

const CANVA_STEPS = [
  { id: 'idle', label: 'Not connected' },
  { id: 'connected', label: 'Connected to Canva' },
  { id: 'selected', label: 'Design selected' },
  { id: 'uploaded', label: 'Uploaded to Canva' },
  { id: 'opened', label: 'Opened in Canva' },
  { id: 'imported', label: 'Edited design imported' },
  { id: 'seo', label: 'Sent to SEO' }
];

let canvaHelpers = {
  showToast: () => {},
  switchTab: null,
  getDesignQueue: null,
  setDesignQueue: null,
  saveQueueToStorage: null,
  renderQueue: null,
  ghostUrl: (p) => `http://127.0.0.1:3019${p}`,
  fetchLibrary: null,
  upsertLibraryItems: null,
  libraryImageUrl: null,
  libraryItems: () => []
};

let canvaState = {
  step: 'idle',
  mockMode: true,
  connected: false,
  needsReconnect: false,
  sessionId: null,
  selectedItem: null,
  assetId: null,
  canvaDesignId: null,
  uploadedLibraryId: null,
  editUrl: null,
  savedLibraryId: null,
  importPath: null,
  busy: false,
  popupWindowId: null,
  popupTabId: null,
  activeBlankCanva: null
};

const canvaLibrarySelected = new Set();
const canvaBatchDesignContexts = new Map();
const CANVA_BATCH_STAGGER_MS = 400;
const CANVA_LIB_DL_DELAY_MS = 200;
const CANVA_BLANK_CTX_PREFIX = '__nhp_blank_5000__';
/** Pagination + lazy thumbs kick in when tab has more than this many cards. */
const CANVA_LIBRARY_PERF_THRESHOLD = 20;
const CANVA_LIBRARY_PAGE_SIZE = 20;
const CANVA_LIBRARY_RENDER_DEBOUNCE_MS = 280;
let canvaLibraryView = 'all';
let canvaLibraryDownloadBusy = false;
let canvaHighlightId = null;
let canvaLibraryDragDepth = 0;
let canvaPreviewZoomCtrl = null;
let canvaRenameInFlight = false;
let canvaRenamePoller = null;
let canvaNotePickerBound = false;
let canvaNotePickerState = { targetIds: [], items: [] };
let canvaPreviewNameSaveTimer = null;
let canvaLastRenameCount = 0;
let canvaFullPipelineBusy = false;
let canvaFullPipelineCancelled = false;
let canvaTeeMasterPipelineBusy = false;
let canvaTeeMasterFullPathBusy = false;
let canvaTeeMasterFullPathCancelled = false;
let canvaSeoEnqueueBusy = false;
let canvaSeoEnqueueCtx = null;
let canvaPipelineUiPaused = false;
let canvaPipelineGlobalThrottle = { lastMs: 0, lastStage: '', timer: null, pending: null };
/** Library integrity audit — broken design ids + issue map from GET /api/library/audit */
let canvaLibraryAuditBusy = false;
let canvaLibraryBrokenIds = new Set();
let canvaLibraryBrokenIssues = new Map();
let canvaLibraryAuditSummary = { total: 0, broken: 0, scanned: false };
let canvaLibraryRendered = 0;
let canvaLibraryGridActive = false;
let canvaLibraryThumbObserver = null;
let canvaLibraryLoadObserver = null;
let canvaLibraryRenderTimer = null;
let canvaLibraryPendingRender = null;
let canvaEditedVersionIndexCache = null;

function canvaLibraryUsesPerfMode(itemCount) {
  return itemCount > CANVA_LIBRARY_PERF_THRESHOLD;
}

function canvaInvalidateEditedVersionIndex() {
  canvaEditedVersionIndexCache = null;
}

function canvaGetEditedVersionIndex() {
  if (!canvaEditedVersionIndexCache) {
    canvaEditedVersionIndexCache = canvaBuildEditedVersionIndex();
  }
  return canvaEditedVersionIndexCache;
}

function canvaScheduleLibraryRender(options = {}) {
  canvaLibraryPendingRender = { ...options };
  if (canvaLibraryRenderTimer) return;
  canvaLibraryRenderTimer = setTimeout(() => {
    canvaLibraryRenderTimer = null;
    const pending = canvaLibraryPendingRender;
    canvaLibraryPendingRender = null;
    if (pending) canvaRenderLibrary({ ...pending, immediate: true });
  }, CANVA_LIBRARY_RENDER_DEBOUNCE_MS);
}

function canvaDestroyLibraryGridObservers() {
  canvaLibraryThumbObserver?.disconnect();
  canvaLibraryThumbObserver = null;
  canvaLibraryLoadObserver?.disconnect();
  canvaLibraryLoadObserver = null;
}

function canvaRevokeLibraryThumbBlob(img) {
  if (!img) return;
  const blobUrl = img.dataset?.blobUrl;
  if (blobUrl) {
    try { URL.revokeObjectURL(blobUrl); } catch (_) { /* ignore */ }
    delete img.dataset.blobUrl;
  }
}

function canvaIsPipelineUiPaused() {
  return !!(canvaPipelineUiPaused || window.teemasterFullPathInProgress
    || canvaTeeMasterFullPathBusy || canvaTeeMasterPipelineBusy);
}

function canvaSetPipelineUiPaused(paused) {
  canvaPipelineUiPaused = !!paused;
  window.canvaPipelineUiPaused = canvaPipelineUiPaused;
}

function canvaYieldToMainThread() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 48 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function canvaReleaseDataUrl(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.dataURL) obj.dataURL = null;
  if (obj.thumbnail) obj.thumbnail = null;
}
let canvaKeyboardNavBound = false;
const CANVA_DOUBLE_ENTER_MS = 700;
let canvaLastEnterAt = 0;
let canvaEnterDeleteTimer = null;

function resetCanvaEnterDelete() {
  canvaLastEnterAt = 0;
  if (canvaEnterDeleteTimer) {
    clearTimeout(canvaEnterDeleteTimer);
    canvaEnterDeleteTimer = null;
  }
}

function canvaPreviewItems() {
  return canvaFilteredLibraryItems();
}

function canvaIsEditedDesign(item) {
  if (!item) return false;
  const source = item.source || item.meta?.source;
  const versionLabel = item.versionLabel || item.meta?.versionLabel;
  const originalDesignId = item.originalDesignId || item.meta?.originalDesignId;
  if (source === 'canva') return true;
  if (versionLabel === 'Canva Edited') return true;
  if (versionLabel === CANVA_TEEMASTER_EDITED_VERSION) return true;
  if (source === 'teemaster') return true;
  if (originalDesignId) return true;
  return false;
}

/** One card = one SEO item — originals on «all» tab, edited on «edited» tab; no batch __dN fan-out. */
function canvaResolveSeoEligibleIds(ids) {
  const onEditedTab = canvaLibraryView === 'edited';
  const seen = new Set();
  const out = [];
  for (const rawId of ids || []) {
    const id = String(rawId || '').trim();
    if (!id) continue;
    const item = canvaFindLibraryItem(id);
    if (!item) continue;
    const isEdited = canvaIsEditedDesign(item);
    if (onEditedTab ? !isEdited : isEdited) continue;
    const canonicalId = String(item.id || id).trim();
    if (!canonicalId || seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    out.push(canonicalId);
  }
  return out;
}

function canvaIsPreviewSeoEligible() {
  if (canvaLibrarySelected.size > 0) {
    return canvaResolveSeoEligibleIds([...canvaLibrarySelected]).length > 0;
  }
  const singleId = canvaState.savedLibraryId || canvaState.selectedItem?.id;
  if (!singleId) return false;
  const item = canvaFindLibraryItem(singleId);
  if (!item) return false;
  const onEditedTab = canvaLibraryView === 'edited';
  return onEditedTab ? canvaIsEditedDesign(item) : !canvaIsEditedDesign(item);
}

function canvaGetOriginalDesignRef(item) {
  return String(item?.originalDesignId || item?.meta?.originalDesignId || '').trim();
}

/** Best display title for a library row (inherits from originalDesignId when needed). */
function canvaResolveItemDisplayName(item) {
  if (!item) return '';
  const direct = String(item.displayName || item.title || '').trim();
  if (direct) return direct;
  const origId = canvaGetOriginalDesignRef(item);
  if (origId) {
    const orig = canvaFindLibraryItem(origId);
    if (orig) {
      const fromOrig = String(orig.displayName || orig.title || '').trim();
      if (fromOrig) return fromOrig;
    }
  }
  const fromFile = String(item.fileName || '').replace(/\.[^.]+$/, '').trim();
  if (fromFile && !/^design_\d+$/i.test(fromFile) && !/^composite$/i.test(fromFile)) return fromFile;
  return String(item.promptPreview || '').trim();
}

/** Mirror server sanitizeLibraryFileName for SEO download / upload labels. */
function canvaSanitizeFileName(displayName) {
  let base = String(displayName || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 56)
    .replace(/\.+/g, '_')
    .slice(0, 80);
  if (!base) base = 'design';
  return `${base}.png`;
}

function canvaBuildEditedVersionIndex() {
  const items = (canvaHelpers.libraryItems?.() || []).filter(Boolean);
  const originalsWithEdits = new Set();
  const editedByOriginal = new Map();

  items.forEach((item) => {
    if (!canvaIsEditedDesign(item)) return;
    const origRef = canvaGetOriginalDesignRef(item);
    if (!origRef) return;
    originalsWithEdits.add(origRef);
    const list = editedByOriginal.get(origRef) || [];
    list.push(item);
    editedByOriginal.set(origRef, list);
  });

  return { originalsWithEdits, editedByOriginal };
}

function canvaOriginalHasEditedVersion(item, originalsWithEdits) {
  if (!item || canvaIsEditedDesign(item)) return false;
  const id = String(item.id || '').trim();
  const storageId = String(item.storageId || '').trim();
  if (id && originalsWithEdits.has(id)) return true;
  if (storageId && originalsWithEdits.has(storageId)) return true;
  return false;
}

function canvaFindEditedVersionsForOriginal(originalId) {
  const { editedByOriginal } = canvaBuildEditedVersionIndex();
  const id = String(originalId || '').trim();
  if (!id) return [];
  const item = canvaFindLibraryItem(id);
  const storageId = String(item?.storageId || '').trim();
  return editedByOriginal.get(id)
    || (storageId ? editedByOriginal.get(storageId) : null)
    || [];
}

function canvaScheduleHighlightClear(highlightId) {
  if (!highlightId) return;
  setTimeout(() => {
    if (canvaHighlightId === highlightId) {
      canvaHighlightId = null;
      canvaRenderLibrary();
    }
  }, 4500);
}

function canvaNavigateToEditedForOriginal(originalId) {
  const edited = canvaFindEditedVersionsForOriginal(originalId);
  canvaLibraryView = 'edited';
  canvaHighlightId = edited[0]?.id || null;
  canvaUpdateLibraryTabs();
  const visible = canvaFilteredLibraryItems();
  if (canvaState.selectedItem && !visible.some((it) => it.id === canvaState.selectedItem.id)) {
    canvaState.selectedItem = null;
    canvaResetCanvaDesignState();
  }
  canvaRenderLibrary();
  canvaRenderPreview();
  canvaUpdateButtons();
  if (canvaHighlightId) {
    canvaScrollToLibraryCard(canvaHighlightId);
    canvaScheduleHighlightClear(canvaHighlightId);
  }
}

function canvaFilteredLibraryItems() {
  const items = (canvaHelpers.libraryItems?.() || []).filter(Boolean);
  if (canvaLibraryView === 'edited') {
    return items.filter(canvaIsEditedDesign);
  }
  return items.filter((it) => !canvaIsEditedDesign(it));
}

function canvaFindLibraryItem(id) {
  if (!id) return null;
  return (canvaHelpers.libraryItems?.() || []).find((it) => it.id === id) || null;
}

function canvaPreviewIndexForItem(item) {
  if (!item?.id) return -1;
  return canvaPreviewItems().findIndex((it) => it.id === item.id);
}

function canvaEls() {
  return {
    root: document.getElementById('canva-bridge-root'),
    statusPill: document.getElementById('canva-bridge-status-pill'),
    steps: document.getElementById('canva-bridge-steps'),
    library: document.getElementById('canva-bridge-library'),
    libraryWrap: document.getElementById('canva-bridge-library-wrap'),
    libraryDrop: document.getElementById('canva-bridge-library-drop'),
    libUploadBtn: document.getElementById('canva-bridge-lib-upload-btn'),
    libFileInput: document.getElementById('canva-bridge-lib-file-input'),
    libAuditBtn: document.getElementById('canva-bridge-lib-audit-btn'),
    libAuditStatus: document.getElementById('canva-bridge-lib-audit-status'),
    libSelectBroken: document.getElementById('canva-bridge-lib-select-broken'),
    libReconcileBtn: document.getElementById('canva-bridge-lib-reconcile-btn'),
    libSelectVisible: document.getElementById('canva-bridge-lib-select-visible'),
    libSelectAll: document.getElementById('canva-bridge-lib-select-all'),
    libDeselectAll: document.getElementById('canva-bridge-lib-deselect-all'),
    libSelectCount: document.getElementById('canva-bridge-lib-select-count'),
    libEmptyTab: document.getElementById('canva-bridge-lib-empty-tab'),
    libDeleteSelected: document.getElementById('canva-bridge-lib-delete-selected'),
    libDownloadSelected: document.getElementById('canva-bridge-lib-download-selected'),
    libDownloadAll: document.getElementById('canva-bridge-lib-download-all'),
    libSendStudio: document.getElementById('canva-bridge-lib-send-studio'),
    libTeeMasterSendOnly: document.getElementById('canva-bridge-lib-teemaster-send-only'),
    libTeeMasterEdited: document.getElementById('canva-bridge-lib-teemaster-edited'),
    libTeeMasterFullPath: document.getElementById('canva-bridge-lib-teemaster-full-path'),
    libFullPipeline: document.getElementById('canva-bridge-lib-full-pipeline'),
    libSendSeo: document.getElementById('canva-bridge-lib-send-seo'),
    libSelectionCount: document.getElementById('canva-bridge-lib-selection-count'),
    libSmartRename: document.getElementById('canva-bridge-lib-smart-rename'),
    libRenameSelected: document.getElementById('canva-bridge-lib-rename-selected'),
    libRenameAll: document.getElementById('canva-bridge-lib-rename-all'),
    libRenameNotes: document.getElementById('canva-bridge-lib-rename-notes'),
    notePicker: document.getElementById('canva-bridge-note-picker'),
    notePickerBackdrop: document.getElementById('canva-bridge-note-picker-backdrop'),
    notePickerClose: document.getElementById('canva-bridge-note-picker-close'),
    notePickerSearch: document.getElementById('canva-bridge-note-picker-search'),
    notePickerList: document.getElementById('canva-bridge-note-picker-list'),
    notePickerEmpty: document.getElementById('canva-bridge-note-picker-empty'),
    tabAll: document.getElementById('canva-bridge-tab-all'),
    tabEdited: document.getElementById('canva-bridge-tab-edited'),
    previewViewer: document.getElementById('canva-bridge-preview-viewer'),
    previewStage: document.querySelector('#canva-bridge-preview-viewer .design-preview-viewer-stage'),
    previewViewport: document.getElementById('canva-bridge-preview-viewport'),
    previewImg: document.getElementById('canva-bridge-preview-img'),
    previewEmpty: document.getElementById('canva-bridge-preview-empty'),
    previewMeta: document.getElementById('canva-bridge-preview-meta'),
    previewFilename: document.getElementById('canva-bridge-preview-filename'),
    previewNameRow: document.getElementById('canva-bridge-preview-name-row'),
    previewNameInput: document.getElementById('canva-bridge-preview-name-input'),
    previewNameNotes: document.getElementById('canva-bridge-preview-name-notes'),
    previewLabel: document.getElementById('canva-bridge-preview-label'),
    previewBadge: document.getElementById('canva-bridge-preview-badge'),
    previewBadgeLine: document.getElementById('canva-bridge-preview-badge-line'),
    previewPrev: document.getElementById('canva-bridge-preview-prev'),
    previewNext: document.getElementById('canva-bridge-preview-next'),
    previewCounter: document.getElementById('canva-bridge-preview-counter'),
    previewZoomIn: document.getElementById('canva-bridge-preview-zoom-in'),
    previewZoomOut: document.getElementById('canva-bridge-preview-zoom-out'),
    previewZoomReset: document.getElementById('canva-bridge-preview-zoom-reset'),
    previewZoomLevel: document.getElementById('canva-bridge-preview-zoom-level'),
    previewSendOpen: document.getElementById('canva-bridge-preview-send-open'),
    previewAutoRename: document.getElementById('canva-bridge-preview-auto-rename'),
    previewSeo: document.getElementById('canva-bridge-preview-seo'),
    previewDl: document.getElementById('canva-bridge-preview-dl'),
    previewDel: document.getElementById('canva-bridge-preview-del'),
    msg: document.getElementById('canva-bridge-msg'),
    loading: document.getElementById('canva-bridge-loading'),
    btnConnectApi: document.getElementById('canva-bridge-connect-api'),
    btnConnect: document.getElementById('canva-bridge-connect'),
    btnDisconnect: document.getElementById('canva-bridge-disconnect'),
    btnReconnect: document.getElementById('canva-bridge-reconnect'),
    btnRefresh: document.getElementById('canva-bridge-refresh'),
    btnSelect: document.getElementById('canva-bridge-select'),
    btnSendOpen: document.getElementById('canva-bridge-send-open'),
    btnOpenBlank: document.getElementById('canva-bridge-open-blank'),
    btnImport: document.getElementById('canva-bridge-import'),
    btnSeo: document.getElementById('canva-bridge-seo'),
    btnSettings: document.getElementById('canva-bridge-settings'),
    settingsModal: document.getElementById('canva-bridge-settings-modal'),
    settingsBackdrop: document.getElementById('canva-bridge-settings-backdrop'),
    settingsClientId: document.getElementById('canva-bridge-settings-client-id'),
    settingsClientSecret: document.getElementById('canva-bridge-settings-client-secret'),
    settingsRedirectUri: document.getElementById('canva-bridge-settings-redirect-uri'),
    settingsEnvTemplate: document.getElementById('canva-bridge-env-template'),
    settingsMsg: document.getElementById('canva-bridge-settings-msg'),
    settingsSave: document.getElementById('canva-bridge-settings-save'),
    settingsCancel: document.getElementById('canva-bridge-settings-cancel'),
    copyClientId: document.getElementById('canva-bridge-copy-client-id'),
    copyRedirectUri: document.getElementById('canva-bridge-copy-redirect-uri'),
    copyEnvTemplate: document.getElementById('canva-bridge-copy-env-template'),
    settingsAutoConnect: document.getElementById('canva-bridge-settings-auto-connect')
  };
}

function canvaSetMsg(text, type = '') {
  const { msg } = canvaEls();
  if (!msg) return;
  msg.textContent = text || '';
  msg.className = 'canva-bridge-msg' + (type ? ` is-${type}` : '');
}

function canvaSetLoading(on, label = 'جاري المعالجة...') {
  const { loading } = canvaEls();
  if (!loading) return;
  loading.classList.toggle('is-hidden', !on);
  loading.textContent = on ? label : '';
  canvaState.busy = on;
  canvaUpdateButtons();
  canvaRenderPreview();
}

function canvaSetStep(stepId) {
  canvaState.step = stepId;
  const { steps, statusPill } = canvaEls();
  const order = CANVA_STEPS.map((s) => s.id);
  const idx = order.indexOf(stepId);
  if (steps) {
    steps.innerHTML = CANVA_STEPS.map((s, i) => {
      const cls = i < idx ? 'is-done' : (s.id === stepId ? 'is-active' : '');
      return `<span class="canva-bridge-step ${cls}">${s.label}</span>`;
    }).join('');
  }
  if (statusPill) {
    statusPill.className = 'canva-bridge-status-pill'
      + (canvaState.mockMode ? ' is-mock' : '')
      + (canvaState.connected ? ' is-connected' : '');
    const stepLabel = CANVA_STEPS.find((s) => s.id === stepId)?.label || stepId;
    statusPill.textContent = canvaState.mockMode
      ? `Mock · ${stepLabel}`
      : (canvaState.connected ? stepLabel : 'Not connected');
  }
  canvaUpdateButtons();
}

function canvaUpdateButtons() {
  const els = canvaEls();
  const busy = canvaState.busy;
  const hasSel = !!canvaState.selectedItem;
  const connected = canvaState.connected;
  if (els.btnConnect) els.btnConnect.disabled = busy;
  if (els.btnDisconnect) els.btnDisconnect.disabled = busy || !connected || canvaState.mockMode;
  if (els.btnReconnect) {
    els.btnReconnect.disabled = busy || canvaState.mockMode;
    els.btnReconnect.classList.toggle('is-highlight', canvaState.needsReconnect);
  }
  if (els.btnRefresh) els.btnRefresh.disabled = busy;
  if (els.btnSelect) els.btnSelect.disabled = busy || !hasSel;
  const hasSendOpen = hasSel || canvaLibrarySelected.size > 0;
  if (els.btnSendOpen) els.btnSendOpen.disabled = busy || !connected || !hasSendOpen;
  if (els.btnOpenBlank) els.btnOpenBlank.disabled = busy || !connected;
  const hasImportCtx = !!canvaState.canvaDesignId
    || !!(canvaState.activeBlankCanva?.designId || canvaState.activeBlankCanva?.canvaDesignId)
    || (canvaState.selectedItem?.id && canvaBatchDesignContexts.has(canvaState.selectedItem.id));
  if (els.btnImport) els.btnImport.disabled = busy || !hasImportCtx;
  if (els.btnSeo) {
    els.btnSeo.classList.add('is-hidden');
    els.btnSeo.disabled = true;
    els.btnSeo.hidden = true;
  }
}

function canvaIsScopeError(errText = '') {
  const raw = String(errText || '');
  return /missing scope|insufficient_scope|invalid_scope|design:(meta|content):read|asset:(read|write)|profile:read|scope.*required|required scope/i.test(raw);
}

function canvaScopeReconnectMessage(errText = '') {
  if (!canvaIsScopeError(errText)) return null;
  return 'الصلاحيات موجودة في Canva لكن التوكن القديم لا يحتويها — اضغط «إعادة الربط» أو «قطع الاتصال» ثم «Connect Canva»';
}

async function canvaPromptReconnectIfScopeError(errText = '') {
  if (!canvaIsScopeError(errText)) return false;
  const ok = confirm(
    `${canvaScopeReconnectMessage(errText)}\n\nهل تريد إعادة الربط الآن؟ (سيتم مسح التوكن وفتح نافذة Canva)`
  );
  if (ok) await canvaReconnect();
  return ok;
}

function canvaExplainImportError(errText = '') {
  const raw = String(errText || '');
  const scopeMsg = canvaScopeReconnectMessage(raw);
  if (scopeMsg) return scopeMsg;
  if (/unknown endpoint/i.test(raw) && /export/i.test(raw)) {
    return 'مسار تصدير Canva غير صحيح — أعد تشغيل Ghost Server ثم جرّب «استيراد التصميم المعدّل» مرة أخرى';
  }
  if (/export timed out/i.test(raw)) {
    return 'انتهت مهلة تصدير التصميم من Canva — انتظر قليلاً ثم أعد المحاولة';
  }
  if (/license_required/i.test(raw)) {
    return 'التصميم يحتوي عناصر مدفوعة في Canva — اشترِ العناصر أو استخدم Canva Pro ثم أعد التصدير';
  }
  if (/approval_required/i.test(raw)) {
    return 'التصميم يحتاج موافقة مراجع في Canva قبل التصدير';
  }
  if (/internal_failure/i.test(raw)) {
    return 'خطأ داخلي في Canva أثناء التصدير — أعد المحاولة لاحقاً';
  }
  if (/no download url|export download failed/i.test(raw)) {
    return `فشل تنزيل التصميم المُصدَّر من Canva: ${raw}`;
  }
  if (/export job failed|export completed/i.test(raw)) {
    return `فشل تصدير التصميم من Canva: ${raw}`;
  }
  if (/transparent|canva pro|premium|paid plan/i.test(raw)) {
    return 'تصدير PNG بخلفية شفافة يتطلب Canva Pro — سيتم إزالة الخلفية السوداء محلياً عند الإمكان';
  }
  if (/design id required/i.test(raw)) {
    return 'معرّف تصميم Canva غير متوفر — اضغط «إرسال وفتح في Canva» للتعديل أولاً';
  }
  return null;
}

function canvaExplainUploadError(errText = '') {
  const raw = String(errText || '');
  const scopeMsg = canvaScopeReconnectMessage(raw);
  if (scopeMsg) return scopeMsg;
  if (/unsupported content type|application\/octet-stream/i.test(raw)) {
    return 'فشل رفع التصميم — Canva يقبل فقط رفع الملف كبيانات ثنائية. أعد تشغيل Ghost Server ثم أعد المحاولة.';
  }
  if (/file_too_big/i.test(raw)) {
    return 'حجم الصورة كبير جداً لرفعها إلى Canva — استخدم ملفاً أصغر.';
  }
  if (/import_failed/i.test(raw)) {
    return 'تعذّر استيراد الصورة إلى Canva — تأكد أن الملف PNG أو JPEG صالح.';
  }
  if (/timed out|asset upload timed out/i.test(raw)) {
    return 'انتهت مهلة رفع التصميم إلى Canva — انتظر قليلاً ثم أعد المحاولة.';
  }
  if (/not found on disk|not found in library/i.test(raw)) {
    return 'ملف التصميم غير موجود — حدّث المكتبة أو اختر تصميماً آخر.';
  }
  if (/empty or unreadable/i.test(raw)) {
    return 'ملف التصميم فارغ أو تالف — اختر صورة أخرى من المكتبة.';
  }
  if (/asset id|asset upload/i.test(raw)) {
    return `فشل رفع التصميم إلى Canva: ${raw}`;
  }
  return null;
}

function canvaExplainApiFailure(path, res, data) {
  const errText = data?.error ? String(data.error) : '';
  const scopeMsg = canvaScopeReconnectMessage(errText);
  if (scopeMsg) return scopeMsg;
  if (String(path || '').includes('/import-edited')) {
    const importMsg = canvaExplainImportError(errText);
    if (importMsg) return importMsg;
  }
  if (String(path || '').includes('/upload-design')) {
    const uploadMsg = canvaExplainUploadError(errText);
    if (uploadMsg) return uploadMsg;
  }
  if (res.status === 404) {
    const settingsRoute = String(path || '').includes('/settings');
    return settingsRoute
      ? 'مسار إعدادات Canva غير متوفر (404) — أعد تشغيل ghost-server.js على المنفذ 3019'
      : 'مسار Canva API غير موجود (404) — أعد تشغيل Ghost Server على المنفذ 3019';
  }
  if (errText) return errText;
  return `خطأ Canva API (${res.status})`;
}

async function canvaApi(path, options = {}) {
  const url = canvaHelpers.ghostUrl(path);
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
  } catch (_) {
    throw new Error('Ghost Server غير مشغّل — شغّل Ghost على المنفذ 3019 (Generate → إعادة تشغيل Ghost Server)');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok || data.success === false) {
    throw new Error(canvaExplainApiFailure(path, res, data));
  }
  return data;
}

async function canvaRefreshStatus() {
  try {
    const data = await canvaApi('/api/canva/status');
    canvaState.mockMode = !!data.mockMode;
    canvaState.needsReconnect = !!(data.needsReconnect || data.scopesStale || data.connectedWithStaleScopes);
    canvaState.connected = !!(data.connected || (data.mockMode && !canvaState.needsReconnect));
    if (data.mockMode) {
      canvaSetMsg('بيانات Canva غير مُعدّة — وضع Mock مفعّل. افتح الإعدادات ⚙️ لإدخال Client ID و Secret.', 'warning');
    } else if (canvaState.needsReconnect) {
      canvaSetMsg('التوكن قديم ولا يحتوي كل الصلاحيات — اضغط «إعادة الربط».', 'warning');
      canvaSetStep('idle');
    } else if (canvaState.connected) {
      canvaSetMsg('متصل بـ Canva.', 'success');
      canvaSetStep(canvaState.step === 'idle' ? 'connected' : canvaState.step);
    } else {
      canvaSetMsg('غير متصل — اضغط Connect Canva.', '');
      canvaSetStep('idle');
    }
  } catch (err) {
    canvaSetMsg(`خطأ في الحالة: ${err.message}`, 'error');
  }
  canvaUpdateButtons();
}

async function canvaLoadAutoConnectPref() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    canvaAutoConnectEnabled = true;
    return;
  }
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get([CANVA_AUTO_CONNECT_KEY], (r) => resolve(r || {}));
  });
  canvaAutoConnectEnabled = stored[CANVA_AUTO_CONNECT_KEY] !== false;
  const { settingsAutoConnect } = canvaEls();
  if (settingsAutoConnect) settingsAutoConnect.checked = canvaAutoConnectEnabled;
}

async function canvaSaveAutoConnectPref(enabled) {
  canvaAutoConnectEnabled = !!enabled;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise((resolve) => {
      chrome.storage.local.set({ [CANVA_AUTO_CONNECT_KEY]: canvaAutoConnectEnabled }, resolve);
    });
  }
  const { settingsAutoConnect } = canvaEls();
  if (settingsAutoConnect) settingsAutoConnect.checked = canvaAutoConnectEnabled;
}

function canvaShouldAutoConnect() {
  if (!canvaAutoConnectEnabled || canvaAutoConnectAttempted || canvaManualDisconnect || canvaAutoConnectRunning) {
    return false;
  }
  if (canvaState.busy) return false;
  if (canvaState.connected && !canvaState.needsReconnect) return false;
  return true;
}

async function canvaMaybeAutoConnect() {
  if (!canvaShouldAutoConnect()) return;
  canvaAutoConnectAttempted = true;
  canvaAutoConnectRunning = true;
  try {
    if (canvaState.needsReconnect) {
      canvaSetMsg('جاري الربط التلقائي مع Canva...', 'loading');
      await canvaReconnect();
    } else if (!canvaState.connected) {
      canvaSetMsg('جاري الربط التلقائي مع Canva...', 'loading');
      await canvaConnect();
    }
  } catch (_) {
    /* محاولة واحدة فقط — لا إعادة محاولة تلقائية */
  } finally {
    canvaAutoConnectRunning = false;
  }
}

async function canvaRefreshStatusAndMaybeAutoConnect() {
  await canvaRefreshStatus();
  await canvaMaybeAutoConnect();
}

function canvaBuildEnvTemplate(clientId = '', redirectUri = DEFAULT_CANVA_REDIRECT_URI) {
  const id = clientId || 'OC-YourClientId';
  return `CANVA_CLIENT_ID=${id}\nCANVA_CLIENT_SECRET=your_secret_here\nCANVA_REDIRECT_URI=${redirectUri}`;
}

function canvaUpdateEnvTemplatePreview() {
  const { settingsClientId, settingsRedirectUri, settingsEnvTemplate } = canvaEls();
  if (!settingsEnvTemplate) return;
  const clientId = settingsClientId?.value?.trim() || '';
  const redirectUri = settingsRedirectUri?.value?.trim() || DEFAULT_CANVA_REDIRECT_URI;
  settingsEnvTemplate.textContent = canvaBuildEnvTemplate(clientId, redirectUri);
}

function canvaSetSettingsMsg(text, type = '') {
  const { settingsMsg } = canvaEls();
  if (!settingsMsg) return;
  settingsMsg.textContent = text || '';
  settingsMsg.className = 'canva-bridge-settings-msg' + (type ? ` is-${type}` : '');
}

async function canvaCopyText(text, successLabel = 'تم النسخ') {
  const value = String(text || '').trim();
  if (!value) {
    canvaSetSettingsMsg('لا يوجد نص للنسخ', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    canvaSetSettingsMsg(successLabel, 'success');
    canvaHelpers.showToast?.('✅ ' + successLabel);
  } catch (_) {
    canvaSetSettingsMsg('تعذر النسخ — انسخ يدوياً', 'error');
  }
}

function canvaOpenSettingsModal() {
  const els = canvaEls();
  if (!els.settingsModal) return;
  canvaSettingsState.open = true;
  els.settingsModal.classList.remove('is-hidden');
  els.settingsModal.setAttribute('aria-hidden', 'false');
  canvaSetSettingsMsg('');
  void canvaLoadAutoConnectPref();
  void canvaLoadSettingsForm();
}

function canvaCloseSettingsModal() {
  const els = canvaEls();
  if (!els.settingsModal) return;
  canvaSettingsState.open = false;
  canvaSettingsState.saving = false;
  els.settingsModal.classList.add('is-hidden');
  els.settingsModal.setAttribute('aria-hidden', 'true');
  canvaSetSettingsMsg('');
  if (els.settingsClientSecret) els.settingsClientSecret.value = '';
}

async function canvaLoadSettingsForm() {
  const els = canvaEls();
  canvaSetSettingsMsg('جاري تحميل الإعدادات...', 'loading');
  try {
    const data = await canvaApi('/api/canva/settings');
    canvaSettingsState.hasSecret = !!data.hasSecret;
    if (els.settingsClientId) {
      els.settingsClientId.value = data.clientId || '';
    }
    if (els.settingsClientSecret) {
      els.settingsClientSecret.value = data.hasSecret ? CANVA_SECRET_PLACEHOLDER : '';
      els.settingsClientSecret.placeholder = data.hasSecret
        ? 'محفوظ — اتركه أو أدخل قيمة جديدة'
        : 'أدخل Client Secret';
    }
    const redirectUri = data.redirectUri || DEFAULT_CANVA_REDIRECT_URI;
    if (els.settingsRedirectUri) {
      els.settingsRedirectUri.value = redirectUri;
      els.settingsRedirectUri.title = redirectUri;
    }
    canvaUpdateEnvTemplatePreview();
    canvaSetSettingsMsg('', '');
  } catch (err) {
    if (els.settingsRedirectUri && !els.settingsRedirectUri.value) {
      els.settingsRedirectUri.value = DEFAULT_CANVA_REDIRECT_URI;
      els.settingsRedirectUri.title = DEFAULT_CANVA_REDIRECT_URI;
    }
    canvaUpdateEnvTemplatePreview();
    canvaSetSettingsMsg(`تعذر تحميل الإعدادات: ${err.message}`, 'error');
  }
}

async function canvaSaveSettings() {
  const els = canvaEls();
  if (canvaSettingsState.saving) return;
  const clientId = els.settingsClientId?.value?.trim() || '';
  const clientSecretRaw = els.settingsClientSecret?.value?.trim() || '';
  const redirectUri = els.settingsRedirectUri?.value?.trim() || DEFAULT_CANVA_REDIRECT_URI;

  if (!clientId) {
    canvaSetSettingsMsg('Client ID مطلوب', 'error');
    return;
  }
  if (!/^OC-[A-Za-z0-9_-]{4,}$/.test(clientId)) {
    canvaSetSettingsMsg('صيغة Client ID غير صحيحة (مثال: OC-AZ8LCwZlJ92z)', 'error');
    return;
  }
  const keepSecret = !clientSecretRaw
    || clientSecretRaw === CANVA_SECRET_PLACEHOLDER
    || /^•+$/.test(clientSecretRaw);
  if (!keepSecret && !clientSecretRaw) {
    canvaSetSettingsMsg('Client Secret مطلوب', 'error');
    return;
  }
  if (!canvaSettingsState.hasSecret && keepSecret) {
    canvaSetSettingsMsg('Client Secret مطلوب', 'error');
    return;
  }

  canvaSettingsState.saving = true;
  canvaSetSettingsMsg('جاري الحفظ في .env...', 'loading');
  if (els.settingsSave) els.settingsSave.disabled = true;

  try {
    const data = await canvaApi('/api/canva/settings', {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        clientSecret: keepSecret ? CANVA_SECRET_PLACEHOLDER : clientSecretRaw,
        redirectUri
      })
    });
    canvaSettingsState.hasSecret = !!data.hasSecret;
    canvaState.mockMode = !!data.mockMode;
    if (els.settingsClientSecret) {
      els.settingsClientSecret.value = data.hasSecret ? CANVA_SECRET_PLACEHOLDER : '';
    }
    canvaUpdateEnvTemplatePreview();
    canvaSetSettingsMsg(data.message || 'تم حفظ إعدادات Canva في ملف .env', 'success');
    canvaHelpers.showToast?.('✅ تم حفظ إعدادات Canva');
    await canvaRefreshStatus();
    setTimeout(() => {
      if (canvaSettingsState.open) canvaCloseSettingsModal();
    }, 700);
  } catch (err) {
    canvaSetSettingsMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
  } finally {
    canvaSettingsState.saving = false;
    if (els.settingsSave) els.settingsSave.disabled = false;
  }
}

let canvaOAuthStatusPollTimer = null;
let canvaOAuthCompleteListener = null;

function canvaOpenOAuthPopup(authUrl) {
  const url = String(authUrl || '').trim();
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { action: 'CANVA_OAUTH_OPEN', url, focused: false },
        (resp) => {
          if (chrome.runtime.lastError || !resp?.success) {
            window.open(url, '_blank', 'noopener,noreferrer');
            resolve(false);
            return;
          }
          resolve(true);
        }
      );
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    resolve(false);
  });
}

function canvaStopOAuthStatusWatch() {
  if (canvaOAuthStatusPollTimer) {
    clearInterval(canvaOAuthStatusPollTimer);
    canvaOAuthStatusPollTimer = null;
  }
  if (canvaOAuthCompleteListener && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(canvaOAuthCompleteListener);
    canvaOAuthCompleteListener = null;
  }
}

async function canvaOnOAuthFlowFinished(prefetched) {
  canvaStopOAuthStatusWatch();
  if (prefetched?.connected && !(prefetched.needsReconnect || prefetched.scopesStale || prefetched.connectedWithStaleScopes)) {
    canvaHelpers.showToast?.('✅ تم ربط Canva');
  }
  await canvaRefreshStatus();
}

function canvaWatchOAuthCompletion() {
  canvaStopOAuthStatusWatch();
  let attempts = 0;
  const maxAttempts = 90;

  canvaOAuthCompleteListener = (message) => {
    if (message?.action !== 'CANVA_OAUTH_COMPLETE') return;
    void canvaOnOAuthFlowFinished();
  };
  chrome.runtime?.onMessage?.addListener(canvaOAuthCompleteListener);

  canvaOAuthStatusPollTimer = setInterval(() => {
    attempts += 1;
    if (attempts > maxAttempts) {
      canvaStopOAuthStatusWatch();
      return;
    }
    void canvaApi('/api/canva/status')
      .then((data) => {
        if (data?.connected && !(data.needsReconnect || data.scopesStale || data.connectedWithStaleScopes)) {
          void canvaOnOAuthFlowFinished(data);
        }
      })
      .catch(() => {});
  }, 2000);
}

async function canvaBeginOAuthFlow(authUrl, { backgroundLabel = 'جاري الربط في الخلفية — أكمل تسجيل الدخول في نافذة Canva.' } = {}) {
  await canvaOpenOAuthPopup(authUrl);
  canvaSetMsg(backgroundLabel, 'warning');
  canvaHelpers.showToast?.('نافذة Canva في الخلفية — أكمل الربط');
  canvaWatchOAuthCompletion();
}

async function canvaDisconnect() {
  canvaManualDisconnect = true;
  canvaSetLoading(true, 'قطع الاتصال...');
  try {
    await canvaApi('/api/canva/auth/disconnect', { method: 'POST' });
    canvaState.connected = false;
    canvaState.needsReconnect = false;
    canvaState.sessionId = null;
    canvaState.assetId = null;
    canvaState.canvaDesignId = null;
    canvaState.uploadedLibraryId = null;
    canvaState.editUrl = null;
    canvaSetStep('idle');
    canvaSetMsg('تم قطع الاتصال — اضغط Connect Canva أو «إعادة الربط» للحصول على توكن جديد.', 'warning');
    canvaHelpers.showToast?.('تم قطع اتصال Canva');
  } catch (err) {
    canvaSetMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
  } finally {
    canvaSetLoading(false);
    void canvaRefreshStatus();
  }
}

async function canvaReconnect() {
  canvaSetLoading(true, 'إعادة الربط...');
  try {
    const start = await canvaApi('/api/canva/auth/reconnect', {
      method: 'POST',
      body: JSON.stringify({})
    });
    canvaState.connected = false;
    canvaState.needsReconnect = false;
    canvaState.sessionId = null;
    canvaState.assetId = null;
    canvaState.canvaDesignId = null;
    canvaState.uploadedLibraryId = null;
    canvaState.editUrl = null;
    canvaSetStep('idle');
    if (start.mockMode && start.connected) {
      canvaState.connected = true;
      canvaSetStep('connected');
      canvaSetMsg('Mock Canva reconnection established.', 'success');
      canvaHelpers.showToast?.('✅ Canva mock reconnected');
      return;
    }
    if (start.authUrl) {
      void canvaBeginOAuthFlow(start.authUrl, {
        backgroundLabel: 'تم مسح التوكن القديم — أكمل الربط في نافذة Canva (تُغلق تلقائياً عند الانتهاء).'
      });
    } else {
      canvaSetMsg(start.message || 'تم مسح التوكن — ابدأ OAuth من جديد.', 'warning');
    }
  } catch (err) {
    canvaSetMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
  } finally {
    canvaSetLoading(false);
    void canvaRefreshStatus();
  }
}

async function canvaConnect() {
  canvaSetLoading(true, 'Connecting...');
  try {
    const start = await canvaApi('/api/canva/auth/start' + (canvaState.mockMode ? '?mock=1' : ''));
    if (start.mockMode && start.connected) {
      canvaState.connected = true;
      canvaSetStep('connected');
      canvaSetMsg('Mock Canva connection established.', 'success');
      canvaHelpers.showToast?.('✅ Canva mock connected');
      return;
    }
    if (start.authUrl) {
      void canvaBeginOAuthFlow(start.authUrl, {
        backgroundLabel: 'أكمل تسجيل الدخول في نافذة Canva (تُغلق تلقائياً عند الانتهاء).'
      });
    }
  } catch (err) {
    canvaSetMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
  } finally {
    canvaSetLoading(false);
    void canvaRefreshStatus();
  }
}

function canvaRemoveLibrarySelection(ids) {
  const drop = Array.isArray(ids) ? ids : [ids];
  drop.forEach((id) => {
    canvaLibrarySelected.delete(id);
    canvaBatchDesignContexts.delete(id);
  });
  if (canvaState.selectedItem && drop.includes(canvaState.selectedItem.id)) {
    canvaState.selectedItem = null;
    canvaRenderPreview();
  }
  canvaUpdateLibraryToolbar();
}

function canvaLibraryCounts() {
  const items = (canvaHelpers.libraryItems?.() || []).filter(Boolean);
  const edited = items.filter(canvaIsEditedDesign).length;
  const all = items.length - edited;
  return { all, edited };
}

function canvaUpdateLibraryTabs() {
  const { tabAll, tabEdited } = canvaEls();
  const isEdited = canvaLibraryView === 'edited';
  const { all, edited } = canvaLibraryCounts();
  if (tabAll) {
    tabAll.classList.toggle('is-active', !isEdited);
    tabAll.setAttribute('aria-selected', !isEdited ? 'true' : 'false');
    tabAll.textContent = all ? `مكتبة التصاميم (${all})` : 'مكتبة التصاميم';
  }
  if (tabEdited) {
    tabEdited.classList.toggle('is-active', isEdited);
    tabEdited.setAttribute('aria-selected', isEdited ? 'true' : 'false');
    tabEdited.textContent = edited ? `التصاميم المعدّلة (${edited})` : 'التصاميم المعدّلة';
  }
}

function canvaSetLibraryView(view) {
  canvaLibraryView = view === 'edited' ? 'edited' : 'all';
  canvaUpdateLibraryTabs();
  const visible = canvaFilteredLibraryItems();
  if (canvaState.selectedItem && !visible.some((it) => it.id === canvaState.selectedItem.id)) {
    canvaState.selectedItem = null;
    canvaResetCanvaDesignState();
  }
  canvaRenderLibrary();
  canvaRenderPreview();
  canvaUpdateButtons();
}

function canvaScrollToLibraryCard(id) {
  if (!id) return;
  requestAnimationFrame(() => {
    const card = document.querySelector(`.canva-bridge-lib-card[data-lib-id="${CSS.escape(id)}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function canvaIsBridgePanelActive() {
  const panel = document.getElementById('panel-canva-bridge');
  if (!panel?.classList.contains('active')) return false;
  if (panel.style.display === 'none') return false;
  return !!document.getElementById('canva-bridge-root');
}

function canvaKeyboardNavBlocked() {
  const picker = document.getElementById('canva-bridge-note-picker');
  if (picker && !picker.classList.contains('is-hidden')) return true;
  if (canvaSettingsState.open) return true;

  const active = document.activeElement;
  if (!active || active === document.body) return false;
  if (active.closest?.('#canva-bridge-settings-modal:not(.is-hidden)')) return true;

  const root = document.getElementById('canva-bridge-root');
  if (!root?.contains(active)) return false;

  const tag = active.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (active.isContentEditable) return true;

  return false;
}

function canvaClaimKeyboardFocus() {
  const root = document.getElementById('canva-bridge-root');
  if (!root || !canvaIsBridgePanelActive()) return;

  const active = document.activeElement;
  if (active && active !== document.body && !root.contains(active)) {
    active.blur?.();
  }
  if (canvaKeyboardNavBlocked()) return;

  const viewport = document.getElementById('canva-bridge-preview-viewport');
  if (!viewport) return;
  if (!viewport.hasAttribute('tabindex')) viewport.tabIndex = -1;
  try {
    viewport.focus({ preventScroll: true });
  } catch (_) { /* ignore */ }
}

function canvaCanPreviewDelete() {
  return !!canvaState.selectedItem?.id && !canvaState.busy;
}

function canvaExecutePreviewKeyboardDelete() {
  const id = canvaState.selectedItem?.id;
  if (!id) return;
  void canvaDeleteLibraryOne(id, { skipConfirm: true });
}

function canvaLibraryGridColumns() {
  const { library } = canvaEls();
  if (!library) return 1;
  const cards = library.querySelectorAll('.canva-bridge-lib-card');
  if (!cards.length) return 1;
  const firstTop = cards[0].offsetTop;
  let cols = 0;
  cards.forEach((card) => {
    if (card.offsetTop === firstTop) cols += 1;
  });
  return cols || 1;
}

function canvaSetLibSelectedCount(n) {
  const { libSelectionCount } = canvaEls();
  if (!libSelectionCount) return;
  const text = n ? `${n} محدد` : '0 محدد';
  const countText = libSelectionCount.querySelector('.canva-bridge-lib-count-text');
  if (countText) countText.textContent = text;
  else libSelectionCount.textContent = text;
}

function canvaSetLibBtnLabel(btn, text) {
  if (!btn) return;
  const emoji = btn.querySelector('.canva-bridge-lib-btn-emoji');
  const spans = btn.querySelectorAll('span:not(.canva-bridge-lib-btn-emoji)');
  const label = spans[spans.length - 1];
  if (label) label.textContent = text;
  else if (!emoji) btn.textContent = text;
}

function canvaBrokenIssueTooltip(id) {
  const issues = canvaLibraryBrokenIssues.get(id);
  if (!issues?.length) return 'تصميم تالف';
  return issues.map((issue) => {
    const base = issue.messageAr || issue.type || 'مشكلة';
    if (issue.fileName && issue.actualFile) return `${base}: ${issue.fileName} ← ${issue.actualFile}`;
    if (issue.fileName) return `${base}: ${issue.fileName}`;
    return base;
  }).join('\n');
}

function canvaApplyLibraryAuditReport(report) {
  canvaLibraryBrokenIds = new Set(Array.isArray(report?.brokenIds) ? report.brokenIds : []);
  canvaLibraryBrokenIssues = new Map();
  for (const issue of report?.issues || []) {
    if (!issue?.id) continue;
    if (!canvaLibraryBrokenIssues.has(issue.id)) canvaLibraryBrokenIssues.set(issue.id, []);
    canvaLibraryBrokenIssues.get(issue.id).push(issue);
  }
  canvaLibraryAuditSummary = {
    total: Number(report?.totalDesigns) || 0,
    broken: Number(report?.brokenCount) || canvaLibraryBrokenIds.size,
    scanned: true
  };
  canvaUpdateLibraryAuditBadge();
  canvaRenderLibrary({ force: true });
}

function canvaUpdateLibraryAuditBadge() {
  const { libAuditStatus, libSelectBroken, libReconcileBtn, libAuditBtn } = canvaEls();
  if (!canvaLibraryAuditSummary.scanned) {
    if (libAuditStatus) {
      libAuditStatus.hidden = true;
      libAuditStatus.textContent = '';
    }
    if (libSelectBroken) libSelectBroken.disabled = true;
    if (libReconcileBtn) libReconcileBtn.disabled = true;
    if (libAuditBtn) libAuditBtn.classList.remove('is-running');
    return;
  }
  const { total, broken } = canvaLibraryAuditSummary;
  if (libAuditStatus) {
    libAuditStatus.hidden = false;
    libAuditStatus.classList.toggle('is-ok', broken === 0);
    libAuditStatus.textContent = broken
      ? `${broken} تصاميم تالفة من ${total}`
      : `جميع التصاميم سليمة (${total})`;
  }
  const uiBusy = canvaLibraryAuditBusy || canvaState.busy;
  if (libSelectBroken) libSelectBroken.disabled = broken === 0 || uiBusy;
  if (libReconcileBtn) libReconcileBtn.disabled = broken === 0 || uiBusy;
  if (libAuditBtn) libAuditBtn.classList.toggle('is-running', canvaLibraryAuditBusy);
}

async function canvaRunLibraryAudit({ silent = false } = {}) {
  if (canvaLibraryAuditBusy) return null;
  canvaLibraryAuditBusy = true;
  canvaUpdateLibraryAuditBadge();
  if (!silent) canvaSetMsg('جاري فحص سلامة المكتبة…', 'info');
  try {
    const res = await fetch(canvaHelpers.ghostUrl('/api/library/audit'));
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    canvaApplyLibraryAuditReport(data);
    if (!silent) {
      canvaSetMsg(data.summaryAr || 'اكتمل الفحص', data.brokenCount ? 'warn' : 'success');
    }
    return data;
  } catch (err) {
    if (!silent) canvaSetMsg(`فشل فحص المكتبة: ${err.message}`, 'error');
    return null;
  } finally {
    canvaLibraryAuditBusy = false;
    canvaUpdateLibraryAuditBadge();
    canvaUpdateLibraryToolbar();
  }
}

function canvaSelectBrokenLibrary() {
  if (!canvaLibraryBrokenIds.size) return;
  canvaLibrarySelected.clear();
  for (const id of canvaLibraryBrokenIds) canvaLibrarySelected.add(id);
  canvaRenderLibrary({ force: true });
  canvaUpdateLibraryToolbar();
  canvaSetMsg(`تم تحديد ${canvaLibrarySelected.size} تصميم تالف`, 'warn');
}

async function canvaReconcileLibraryIndex() {
  if (canvaLibraryAuditBusy || canvaState.busy) return;
  canvaLibraryAuditBusy = true;
  canvaUpdateLibraryAuditBadge();
  canvaSetMsg('جاري إصلاح الفهرس من القرص…', 'info');
  try {
    const res = await fetch(canvaHelpers.ghostUrl('/api/library/reconcile'), { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    if (typeof canvaHelpers.fetchLibrary === 'function') {
      await canvaHelpers.fetchLibrary();
    }
    if (data.report) canvaApplyLibraryAuditReport(data.report);
    canvaRenderLibrary({ force: true });
    canvaSetMsg(data.summaryAr || 'تم إصلاح الفهرس', data.report?.brokenCount ? 'warn' : 'success');
  } catch (err) {
    canvaSetMsg(`فشل إصلاح الفهرس: ${err.message}`, 'error');
  } finally {
    canvaLibraryAuditBusy = false;
    canvaUpdateLibraryAuditBadge();
    canvaUpdateLibraryToolbar();
  }
}

function canvaUpdateLibraryToolbar() {
  const els = canvaEls();
  const items = canvaFilteredLibraryItems();
  const n = canvaLibrarySelected.size;
  const dlBusy = canvaLibraryDownloadBusy;
  const uiBusy = canvaState.busy || dlBusy || canvaFullPipelineBusy || canvaTeeMasterPipelineBusy || canvaTeeMasterFullPathBusy;
  const seoEnqueueBusy = canvaSeoEnqueueBusy;
  const onOriginalsTab = canvaLibraryView === 'all';
  const hasPipelineTargets = canvaResolveSmartRenameIds().length > 0;

  if (els.libDeleteSelected) els.libDeleteSelected.disabled = n === 0 || uiBusy;
  if (els.libDownloadSelected) els.libDownloadSelected.disabled = n === 0 || uiBusy;
  if (els.libDownloadAll) els.libDownloadAll.disabled = items.length === 0 || uiBusy;
  if (els.libEmptyTab) els.libEmptyTab.disabled = items.length === 0 || uiBusy;
  canvaSetLibSelectedCount(n);

  const renameBusy = uiBusy || canvaRenameInFlight;
  const hasItems = items.length > 0;
  if (els.libSmartRename) els.libSmartRename.disabled = !hasItems || renameBusy;
  if (els.libRenameSelected) els.libRenameSelected.disabled = n === 0 || renameBusy;
  if (els.libRenameAll) els.libRenameAll.disabled = !hasItems || renameBusy;
  if (els.libRenameNotes) els.libRenameNotes.disabled = !hasItems || renameBusy;
  if (els.libSendStudio) els.libSendStudio.disabled = n === 0 || uiBusy;
  canvaUpdateLibraryAuditBadge();
  if (els.libTeeMasterSendOnly) {
    els.libTeeMasterSendOnly.disabled = n === 0 || uiBusy;
  }
  if (els.libTeeMasterEdited) {
    els.libTeeMasterEdited.disabled = !onOriginalsTab || !hasPipelineTargets || uiBusy;
  }
  if (els.libTeeMasterFullPath) {
    els.libTeeMasterFullPath.disabled = !onOriginalsTab || !hasPipelineTargets || uiBusy;
  }
  if (els.libFullPipeline) els.libFullPipeline.disabled = n === 0 || uiBusy;
  const seoEligibleCount = canvaResolveSeoEligibleIds([...canvaLibrarySelected]).length;
  if (els.libSendSeo) {
    const seoAllowed = seoEligibleCount > 0;
    els.libSendSeo.classList.remove('is-hidden');
    els.libSendSeo.disabled = !seoAllowed || uiBusy || seoEnqueueBusy;
    els.libSendSeo.title = onOriginalsTab
      ? 'إرسال التصاميم الأصلية المحددة إلى قسم SEO'
      : 'إرسال التصاميم المعدّلة المحددة إلى قسم SEO';
  }
}

function canvaResolveSmartRenameIds() {
  if (canvaLibrarySelected.size > 0) return [...canvaLibrarySelected];
  return canvaFilteredLibraryItems().map((it) => it.id).filter(Boolean);
}

function canvaResolveRenameIdsForMode(mode) {
  if (mode === 'selected') return [...canvaLibrarySelected].filter(Boolean);
  if (mode === 'all') return canvaFilteredLibraryItems().map((it) => it.id).filter(Boolean);
  if (mode === 'single') {
    const id = canvaState.selectedItem?.id;
    return id ? [id] : [];
  }
  return canvaResolveSmartRenameIds();
}

function canvaPatchLocalDisplayName(id, displayName, fileName, thumbUrl) {
  const item = canvaFindLibraryItem(id);
  if (!item) return;
  const name = String(displayName || '').trim();
  if (!name) return;
  item.displayName = name;
  if (!item.title) item.title = name;
  if (fileName) item.fileName = fileName;
  if (thumbUrl) item.thumbUrl = thumbUrl;
}

function canvaEnsureRenamePoller() {
  if (canvaRenamePoller) return canvaRenamePoller;
  canvaRenamePoller = createLibraryRenamePoller({
    fetchLibrary: canvaHelpers.fetchLibrary,
    getItems: () => canvaHelpers.libraryItems?.() || [],
    onUpdated: ({ updated, timedOut }) => {
      canvaRenderLibrary();
      canvaRenderPreview();
      if (updated) {
        const n = canvaLastRenameCount || 1;
        canvaHelpers.showToast?.(`✅ تم تسمية ${n} تصميم`);
        canvaLastRenameCount = 0;
      } else if (timedOut) {
        canvaHelpers.showToast?.('⏳ التسمية قيد المعالجة — قد تظهر الأسماء بعد لحظات');
      }
    }
  });
  return canvaRenamePoller;
}

function canvaSetRenameButtonsLoading(on) {
  const els = canvaEls();
  const targets = [
    els.libSmartRename,
    els.libRenameSelected,
    els.libRenameAll,
    els.libRenameNotes,
    els.previewAutoRename,
    els.previewNameNotes
  ];
  targets.forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle('is-loading', on);
    if (on) btn.disabled = true;
  });
  if (!on) canvaUpdateLibraryToolbar();
}

async function canvaSmartRenameLibrary(ids, { toastScheduled = true } = {}) {
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!list.length) {
    canvaHelpers.showToast?.('حدّد تصاميم من المكتبة أولاً');
    return;
  }
  if (canvaRenameInFlight) {
    canvaHelpers.showToast?.('⏳ تسمية ذكية قيد التنفيذ — انتظر قليلاً');
    return;
  }
  canvaRenameInFlight = true;
  canvaSetRenameButtonsLoading(true);
  canvaLastRenameCount = list.length;
  canvaHelpers.showToast?.(`🤖 جاري التسمية بالذكاء (${list.length})...`);
  try {
    const data = await requestLibrarySmartRename({
      ghostUrl: canvaHelpers.ghostUrl,
      ids: list
    });
    if (toastScheduled) {
      canvaHelpers.showToast?.(data.message || 'تمت جدولة التسمية الذكية');
    }
    canvaEnsureRenamePoller().start();
  } catch (err) {
    canvaHelpers.showToast?.(`⚠️ ${err?.message || 'فشل التسمية الذكية'}`);
  } finally {
    canvaRenameInFlight = false;
    canvaSetRenameButtonsLoading(false);
  }
}

async function canvaApplyNoteNameToLibrary(ids, noteText) {
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  const name = String(noteText || '').trim();
  if (!list.length || !name) return { ok: 0, fail: 0 };
  let ok = 0;
  let fail = 0;
  for (const id of list) {
    try {
      const data = await patchLibraryDisplayName({
        ghostUrl: canvaHelpers.ghostUrl,
        id,
        displayName: name
      });
      canvaPatchLocalDisplayName(id, data.displayName || name, data.fileName, data.thumbUrl);
      ok += 1;
    } catch (_) {
      fail += 1;
    }
  }
  canvaRenderLibrary();
  canvaRenderPreview();
  if (ok > 0) {
    const suffix = fail > 0 ? ` — فشل ${fail}` : '';
    canvaHelpers.showToast?.(`✅ تم تسمية ${ok} تصميم من Notes${suffix}`);
  } else {
    canvaHelpers.showToast?.('⚠️ فشل تطبيق الاسم من Notes');
  }
  return { ok, fail };
}

function canvaCloseNotePicker() {
  const els = canvaEls();
  if (!els.notePicker) return;
  els.notePicker.classList.add('is-hidden');
  els.notePicker.setAttribute('aria-hidden', 'true');
  if (els.notePickerSearch) els.notePickerSearch.value = '';
  canvaNotePickerState = { targetIds: [], items: [] };
}

function canvaRenderNotePickerList(filter = '') {
  const els = canvaEls();
  if (!els.notePickerList) return;
  const needle = String(filter || '').trim().toLowerCase();
  const allItems = canvaNotePickerState.items || [];
  const matches = allItems.filter((item) => (
    !needle || item.text.toLowerCase().includes(needle)
  ));
  const frag = document.createDocumentFragment();
  matches.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'canva-bridge-note-picker-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'canva-bridge-note-picker-item';
    btn.title = item.text;
    btn.setAttribute('aria-label', item.text);
    const label = document.createElement('span');
    label.className = 'canva-bridge-note-picker-item-text';
    label.textContent = item.text;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      void canvaApplyNotePickerSelection(item.text);
    });
    li.appendChild(btn);
    frag.appendChild(li);
  });
  els.notePickerList.replaceChildren(frag);
  if (els.notePickerEmpty) {
    const hasAny = allItems.length > 0;
    const showEmpty = matches.length === 0;
    els.notePickerEmpty.classList.toggle('is-hidden', !showEmpty);
    if (showEmpty) {
      els.notePickerEmpty.textContent = hasAny
        ? 'لا توجد نتائج مطابقة للبحث.'
        : 'لا توجد ملاحظات في القائمة — أضف نيتشات من تبويب Notes أولاً.';
    }
  }
}

async function canvaOpenNotePicker(targetIds) {
  const ids = (Array.isArray(targetIds) ? targetIds : []).filter(Boolean);
  if (!ids.length) {
    canvaHelpers.showToast?.('حدّد تصميماً أو أكثر أولاً');
    return;
  }
  const items = await getNotePickerItems();
  canvaNotePickerState = { targetIds: ids, items };
  const els = canvaEls();
  if (!els.notePicker) return;
  canvaRenderNotePickerList('');
  els.notePicker.classList.remove('is-hidden');
  els.notePicker.setAttribute('aria-hidden', 'false');
  if (els.notePickerSearch) {
    els.notePickerSearch.value = '';
    if (items.length) els.notePickerSearch.focus();
  }
  if (!items.length) {
    canvaHelpers.showToast?.('⚠️ قائمة Notes فارغة — أضف نيتشات من تبويب Notes');
  }
}

async function canvaApplyNotePickerSelection(noteText) {
  const ids = [...(canvaNotePickerState.targetIds || [])];
  const trimmed = String(noteText || '').trim();
  canvaCloseNotePicker();
  if (!ids.length || !trimmed) return;

  if (ids.length === 1 && canvaState.selectedItem?.id === ids[0]) {
    const els = canvaEls();
    if (els.previewNameInput) els.previewNameInput.value = trimmed;
  }

  await canvaApplyNoteNameToLibrary(ids, trimmed);
}

function canvaBindNotePicker() {
  if (canvaNotePickerBound) return;
  canvaNotePickerBound = true;
  const els = canvaEls();
  els.notePickerClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    canvaCloseNotePicker();
  });
  els.notePickerBackdrop?.addEventListener('click', () => canvaCloseNotePicker());
  els.notePickerSearch?.addEventListener('input', () => {
    canvaRenderNotePickerList(els.notePickerSearch?.value || '');
  });
  els.notePickerSearch?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      canvaCloseNotePicker();
    }
  });
}

function canvaOpenNotePickerForMode(mode) {
  const ids = canvaResolveRenameIdsForMode(mode);
  void canvaOpenNotePicker(ids);
}

async function canvaSavePreviewDisplayName() {
  const item = canvaState.selectedItem;
  const els = canvaEls();
  if (!item?.id || !els.previewNameInput) return;
  const name = String(els.previewNameInput.value || '').trim();
  if (!name) return;
  const current = String(item.displayName || item.fileName || '').trim();
  if (name === current) return;
  try {
    const data = await patchLibraryDisplayName({
      ghostUrl: canvaHelpers.ghostUrl,
      id: item.id,
      displayName: name
    });
    canvaPatchLocalDisplayName(item.id, data.displayName || name, data.fileName, data.thumbUrl);
    canvaRenderLibrary();
    canvaRenderPreview();
    canvaHelpers.showToast?.(`✅ تم حفظ الاسم: ${data.displayName || name}`);
  } catch (err) {
    canvaHelpers.showToast?.(`⚠️ ${err?.message || 'فشل حفظ الاسم'}`);
  }
}

function canvaBindPreviewNameInput() {
  const els = canvaEls();
  if (els.previewNameInput?.dataset.bound === '1') return;
  if (els.previewNameInput) els.previewNameInput.dataset.bound = '1';
  els.previewNameInput?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      void canvaSavePreviewDisplayName();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const item = canvaState.selectedItem;
      if (item && els.previewNameInput) {
        els.previewNameInput.value = item.displayName || item.fileName || '';
      }
    }
  });
  els.previewNameInput?.addEventListener('blur', () => {
    if (canvaPreviewNameSaveTimer) clearTimeout(canvaPreviewNameSaveTimer);
    canvaPreviewNameSaveTimer = setTimeout(() => { void canvaSavePreviewDisplayName(); }, 280);
  });
  els.previewNameNotes?.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = canvaState.selectedItem?.id;
    if (id) void canvaOpenNotePicker([id]);
  });
}

function canvaLibraryDownloadFilename(item) {
  const raw = item?.displayName || item?.fileName || item?.name || '';
  const name = String(raw || '').trim();
  if (name) return /\.(png|jpe?g|webp)$/i.test(name) ? name : `${name}.png`;
  return `${item?.id || 'design'}.png`;
}

function canvaTriggerDownload(objectUrl, filename) {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function canvaDownloadLibraryItem(item, { quiet = false } = {}) {
  if (!item) return false;
  const urls = canvaLibraryImageFallbackUrls(item);
  if (!urls.length) {
    if (!quiet) canvaHelpers.showToast?.('⚠️ رابط التحميل غير متوفر');
    return false;
  }
  const name = canvaLibraryDownloadFilename(item);
  let lastErr = null;
  for (const src of urls) {
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const type = String(blob.type || '').toLowerCase();
      if (type.includes('json') || type.includes('text')) {
        throw new Error('الخادم لم يُرجع صورة');
      }
      const url = URL.createObjectURL(blob);
      canvaTriggerDownload(url, name);
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      if (!quiet) canvaHelpers.showToast?.('✅ تم التحميل');
      return true;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!quiet) {
    const msg = lastErr?.message || 'فشل التحميل';
    canvaSetMsg(msg, 'error');
    canvaHelpers.showToast?.(`⚠️ ${msg}`);
  }
  return false;
}

function canvaSetLibraryDownloadBusy(busy) {
  canvaLibraryDownloadBusy = !!busy;
  canvaUpdateLibraryToolbar();
}

async function canvaDownloadLibraryBatch(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length || canvaLibraryDownloadBusy) return { ok: 0, fail: 0, total: 0 };
  canvaSetLibraryDownloadBusy(true);
  let ok = 0;
  let fail = 0;
  const total = list.length;
  try {
    for (let i = 0; i < list.length; i += 1) {
      if (await canvaDownloadLibraryItem(list[i], { quiet: true })) ok += 1;
      else fail += 1;
      if (i < list.length - 1) await canvaSleep(CANVA_LIB_DL_DELAY_MS);
    }
  } finally {
    canvaSetLibraryDownloadBusy(false);
  }
  return { ok, fail, total };
}

async function canvaDownloadLibrarySelected() {
  const ids = [...canvaLibrarySelected];
  if (!ids.length) return;
  const items = ids.map((id) => canvaFindLibraryItem(id)).filter(Boolean);
  const { ok, fail } = await canvaDownloadLibraryBatch(items);
  if (ok > 0) {
    canvaHelpers.showToast?.(
      fail > 0 ? `تم تحميل ${ok} صورة — فشل ${fail}` : `تم تحميل ${ok} صورة`
    );
  } else {
    canvaHelpers.showToast?.('⚠️ تعذّر تحميل التصاميم المحددة');
  }
}

async function canvaDownloadLibraryAll() {
  const items = canvaFilteredLibraryItems();
  if (!items.length) {
    canvaHelpers.showToast?.('لا توجد تصاميم في هذا العرض');
    return;
  }
  const { ok, fail, total } = await canvaDownloadLibraryBatch(items);
  if (ok > 0) {
    canvaHelpers.showToast?.(
      fail > 0 ? `تم تحميل ${ok}/${total} صورة — فشل ${fail}` : `تم تحميل ${ok} صورة`
    );
  } else {
    canvaHelpers.showToast?.('⚠️ تعذّر تحميل التصاميم');
  }
}

function canvaSelectFilteredLibrary(selectAll) {
  const items = canvaFilteredLibraryItems();
  if (selectAll) {
    items.forEach((item) => canvaLibrarySelected.add(item.id));
  } else {
    items.forEach((item) => canvaLibrarySelected.delete(item.id));
  }
  canvaRenderLibrary();
}

function canvaSelectLibraryFirstN(count) {
  const items = canvaFilteredLibraryItems();
  const n = Math.max(0, Math.min(parseInt(String(count || '0'), 10) || 0, items.length));
  canvaLibrarySelected.clear();
  for (let i = 0; i < n; i += 1) {
    canvaLibrarySelected.add(items[i].id);
  }
  canvaRenderLibrary();
}

function canvaHumanizeLibraryError(errOrMsg) {
  const raw = String(errOrMsg?.message || errOrMsg || '');
  if (/NHP_V10|V10\.1 Production Build/i.test(raw)) {
    return 'Ghost Server يعمل من مجلد مشروع قديم. أعد تشغيله من المشروع الحالي (Generate → إعادة تشغيل Ghost Server).';
  }
  if (/^EPERM:|EPERM|permission denied|EBUSY|EACCES/i.test(raw)) {
    return 'تعذّر الحذف — الملف قيد الاستخدام أو محمي. أغلق معاينة الصورة أو أي برنامج يعرض التصميم ثم أعد المحاولة.';
  }
  return raw || 'فشلت العملية';
}

async function canvaEmptyCurrentTabLibrary() {
  const items = canvaFilteredLibraryItems();
  if (!items.length) {
    canvaHelpers.showToast?.('لا توجد تصاميم في هذا العرض');
    return;
  }
  const tabLabel = canvaLibraryView === 'edited' ? 'التصاميم المعدّلة' : 'مكتبة التصاميم';
  if (!confirm(`هل تريد تفريغ «${tabLabel}» (${items.length} تصميم)؟\n\nلن تُحذف التصاميم في التبويب الآخر.`)) return;
  const ids = items.map((it) => it.id).filter(Boolean);
  canvaSetLoading(true, 'جاري تفريغ العرض الحالي...');
  try {
    const res = await fetch(canvaHelpers.ghostUrl('/api/library/bulk'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || 'فشل التفريغ');
    const removedIds = data.deleted?.length ? data.deleted : (data.success ? ids : []);
    if (!data.success && !data.partial) throw new Error(data?.error || data?.message || 'فشل التفريغ');
    if (removedIds.length) canvaRemoveLibrarySelection(removedIds);
    if (typeof canvaHelpers.fetchLibrary === 'function') await canvaHelpers.fetchLibrary();
    canvaRenderLibrary();
    const toastMsg = data.message
      || (data.success ? `تم تفريغ ${tabLabel} (${data.count || removedIds.length} تصميم).` : (data.error || 'فشل التفريغ'));
    canvaSetMsg(toastMsg, data.partial && !data.success ? 'warning' : 'success');
    canvaHelpers.showToast?.(data.partial ? `⚠️ ${toastMsg}` : toastMsg);
  } catch (err) {
    const msg = canvaHumanizeLibraryError(err);
    canvaSetMsg(msg, 'error');
    canvaHelpers.showToast?.(`⚠️ ${msg}`);
  } finally {
    canvaSetLoading(false);
  }
}

function canvaParseLibraryItemId(item) {
  const id = String(item?.id || '');
  const storageId = item?.storageId || id.replace(/(?:__d|_d)\d+$/i, '') || id;
  let designIndex = item?.designIndex;
  if (!designIndex) {
    const match = id.match(/(?:__d|_d)(\d+)$/i);
    designIndex = match ? parseInt(match[1], 10) : 1;
  }
  return { id, storageId, designIndex };
}

/** API routes need __dN id + fileName so server never falls back to composite.png. */
function canvaResolveSendLibraryRef(item) {
  if (!item) return { libraryId: '', fileName: '' };
  const { id, storageId, designIndex } = canvaParseLibraryItemId(item);
  const fileName = String(item.fileName || '').trim() || `design_${designIndex}.png`;
  const libraryId = /(?:__d|_d)\d+$/i.test(id) ? id : `${storageId}__d${designIndex}`;
  return { libraryId, fileName };
}

function canvaIsPhysicalLibraryFileName(name) {
  const n = String(name || '').trim();
  return /^(design_\d+|split_\d+|composite)\.(png|jpe?g|webp)$/i.test(n);
}

/** Ordered Ghost URLs — physical split names before display-style fileName. */
export function canvaBuildLibraryFileUrlCandidates(item, ghostUrlFn) {
  const toUrl = typeof ghostUrlFn === 'function' ? ghostUrlFn : canvaHelpers.ghostUrl;
  const out = [];
  const pushPath = (p) => {
    const v = String(p || '').trim();
    if (!v) return;
    const full = v.startsWith('http') ? v : toUrl(v.startsWith('/') ? v : `/${v}`);
    if (!out.includes(full)) out.push(full);
  };
  if (!item) return out;

  const { id, storageId, designIndex } = canvaParseLibraryItemId(item);
  const sendRef = canvaResolveSendLibraryRef(item);
  const libId = sendRef.libraryId || id;

  pushPath(`/api/library/${encodeURIComponent(libId)}/download`);

  const fn = String(item.fileName || sendRef.fileName || '').trim();
  if (fn) {
    pushPath(`/api/library/${encodeURIComponent(storageId)}/file/${encodeURIComponent(fn)}`);
  }

  const files = Array.isArray(item.files) ? item.files : [];
  for (const f of files) {
    if (f?.name) pushPath(`/api/library/${encodeURIComponent(storageId)}/file/${encodeURIComponent(f.name)}`);
    if (f?.url) pushPath(f.url);
  }

  pushPath(item.thumbUrl);
  pushPath(item.previewUrl);
  pushPath(item.url);

  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    pushPath(`/api/library/${encodeURIComponent(storageId)}/file/design_${designIndex}.${ext}`);
    pushPath(`/api/library/${encodeURIComponent(storageId)}/file/split_${designIndex}.${ext}`);
  }
  pushPath(`/api/library/${encodeURIComponent(storageId)}/file/composite.png`);

  return out.filter(Boolean);
}

/** True when index thumbUrl points at a full design file, not a small preview. */
function canvaIsLikelyFullResLibraryPath(rawPath) {
  const p = String(rawPath || '').trim().toLowerCase();
  if (!p) return false;
  if (p.includes('/download')) return true;
  if (/\/thumb(\?|$)/.test(p)) return false;
  if (/thumb\.(webp|jpe?g)(\?|$)/.test(p)) return false;
  return /\/file\/(design_|split_|composite)/i.test(p) || /\.(png|webp|jpe?g)(\?|$)/.test(p);
}

const CANVA_LIBRARY_THUMB_MAX_PX = 256;

/** Full-resolution preview / download / SEO — `/download` first. */
export function canvaBuildLibraryPreviewUrlCandidates(item, ghostUrlFn) {
  return canvaBuildLibraryFileUrlCandidates(item, ghostUrlFn);
}

function canvaLibraryItemIsSplitDesign(item) {
  const id = String(item?.id || '');
  return /(?:__d|_d)\d+$/i.test(id) || Number(item?.designIndex) > 1;
}

function canvaLibraryPathLooksComposite(rawPath) {
  return /\/file\/composite\.(png|jpe?g|webp)(\?|$)/i.test(String(rawPath || ''));
}

/** Grid only — lightweight `/thumb?w=256`, never full `/download`. */
export function canvaBuildLibraryThumbUrlCandidates(item, ghostUrlFn) {
  const toUrl = typeof ghostUrlFn === 'function' ? ghostUrlFn : canvaHelpers.ghostUrl;
  const out = [];
  const pushPath = (p) => {
    const v = String(p || '').trim();
    if (!v) return;
    if (canvaIsLikelyFullResLibraryPath(v)) return;
    const full = v.startsWith('http') ? v : toUrl(v.startsWith('/') ? v : `/${v}`);
    if (!out.includes(full)) out.push(full);
  };
  if (!item) return out;

  const { id, storageId } = canvaParseLibraryItemId(item);
  const sendRef = canvaResolveSendLibraryRef(item);
  const libId = sendRef.libraryId || id;
  const isSplitCard = canvaLibraryItemIsSplitDesign(item);
  const thumbQuery = `?w=${CANVA_LIBRARY_THUMB_MAX_PX}`;

  pushPath(`/api/library/${encodeURIComponent(libId)}/thumb${thumbQuery}`);
  if (!isSplitCard) {
    pushPath(`/api/library/${encodeURIComponent(storageId)}/thumb${thumbQuery}`);
  }
  if (!isSplitCard || !canvaLibraryPathLooksComposite(item.thumbUrl)) {
    pushPath(item.thumbUrl);
  }
  if (!isSplitCard || !canvaLibraryPathLooksComposite(item.previewUrl)) {
    pushPath(item.previewUrl);
  }

  return out.filter(Boolean);
}

function canvaEnsureLibraryThumbObserver() {
  if (canvaLibraryThumbObserver) return canvaLibraryThumbObserver;
  const { library } = canvaEls();
  canvaLibraryThumbObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.thumbLoaded === '1' || img.dataset.thumbLoading === '1') return;
      const item = canvaFindLibraryItem(img.dataset.libItemId);
      if (!item) return;
      img.dataset.thumbLoading = '1';
      canvaLibraryThumbObserver.unobserve(img);
      void canvaLoadLibraryGridThumb(img, item);
    });
  }, { root: library, rootMargin: '120px', threshold: 0.01 });
  return canvaLibraryThumbObserver;
}

async function canvaLoadLibraryGridThumb(img, item, attempt = 0) {
  const urls = canvaBuildLibraryThumbUrlCandidates(item);
  const thumbWrap = img.closest('.canva-bridge-lib-card-thumb');
  if (!urls.length) {
    img.removeAttribute('src');
    img.style.opacity = '0.35';
    img.dataset.thumbLoaded = '1';
    img.dataset.thumbLoading = '';
    return;
  }
  let loaded = false;
  for (const url of urls) {
    try {
      canvaRevokeLibraryThumbBlob(img);
      if (url.startsWith('data:image/')) {
        img.src = url;
        loaded = true;
        break;
      }
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!String(blob.type || '').toLowerCase().startsWith('image/')) continue;
      const blobUrl = URL.createObjectURL(blob);
      img.dataset.blobUrl = blobUrl;
      img.src = blobUrl;
      loaded = true;
      break;
    } catch (_) { /* try next */ }
  }
  if (!loaded && attempt < 1) {
    await new Promise((r) => setTimeout(r, 200));
    return canvaLoadLibraryGridThumb(img, item, attempt + 1);
  }
  img.style.opacity = loaded ? '' : '0.35';
  img.dataset.thumbLoaded = '1';
  img.dataset.thumbLoading = '';
  thumbWrap?.classList.toggle('is-thumb-missing', !loaded);
}

function canvaBindLibraryGridThumb(img, item, { lazy = false } = {}) {
  img.className = 'canva-bridge-lib-card-img';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.dataset.libItemId = item.id;
  delete img.dataset.thumbLoaded;
  delete img.dataset.thumbLoading;
  if (!lazy) {
    void canvaLoadLibraryGridThumb(img, item);
    return;
  }
  canvaEnsureLibraryThumbObserver().observe(img);
}

async function canvaReconcileLibraryItemFileNames(item) {
  const { id } = canvaParseLibraryItemId(item);
  if (!id) return [];
  try {
    const res = await fetch(canvaHelpers.ghostUrl(`/api/library/${encodeURIComponent(id)}`));
    if (!res.ok) return [];
    const data = await res.json();
    const remote = data?.item;
    if (!remote) return [];
    const names = (remote.files || []).map((f) => f?.name).filter(Boolean);
    if (names.length) return names;
    return remote.fileName ? [remote.fileName] : [];
  } catch (_) {
    return [];
  }
}

async function canvaFetchLibraryImageAsDataUrl(item) {
  const candidates = canvaBuildLibraryFileUrlCandidates(item);
  let lastErr = null;
  for (const url of candidates) {
    try {
      return await canvaFetchImageAsDataUrl(url);
    } catch (err) {
      lastErr = err;
    }
  }

  const { storageId } = canvaParseLibraryItemId(item);
  const remoteNames = await canvaReconcileLibraryItemFileNames(item);
  for (const name of remoteNames) {
    if (!name) continue;
    try {
      const url = canvaHelpers.ghostUrl(
        `/api/library/${encodeURIComponent(storageId)}/file/${encodeURIComponent(name)}`
      );
      return await canvaFetchImageAsDataUrl(url);
    } catch (err) {
      lastErr = err;
    }
  }

  const label = canvaResolveItemDisplayName(item) || item?.id || '';
  const errMsg = String(lastErr?.message || '');
  if (errMsg.includes('404')) {
    throw new Error(`ملف التصميم غير موجود على القرص — ${label}`);
  }
  throw new Error(lastErr?.message || 'تعذّر جلب الصورة من المكتبة');
}

async function canvaFetchImageAsDataUrl(src) {
  const resolved = String(src || '').trim();
  if (!resolved) throw new Error('مصدر الصورة غير متاح');
  if (resolved.startsWith('data:image/')) return resolved;
  const res = await fetch(resolved);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const type = String(blob.type || '').toLowerCase();
  if (type.includes('json') || type.includes('text') || (type && !type.startsWith('image/'))) {
    throw new Error('الخادم لم يُرجع PNG');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('تعذّر قراءة الصورة'));
    reader.readAsDataURL(blob);
  });
}

function canvaBufferPeelStudioImage(imageData) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.get([CANVA_STUDIO_PEEL_BUFFER_KEY], (res) => {
        const buffer = res[CANVA_STUDIO_PEEL_BUFFER_KEY] || [];
        buffer.push(imageData);
        if (buffer.length > CANVA_TEEMASTER_BUFFER_MAX) {
          buffer.splice(0, buffer.length - CANVA_TEEMASTER_BUFFER_MAX);
        }
        chrome.storage.local.set({ [CANVA_STUDIO_PEEL_BUFFER_KEY]: buffer }, resolve);
      });
    } catch (_) {
      resolve();
    }
  });
}

async function canvaDispatchPeelStudioImage(imageData) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    await canvaBufferPeelStudioImage(imageData);
    console.warn('[Canva Bridge→Peel] chrome.runtime غير متاح — تم التخزين المؤقت');
    return { delivered: false, buffered: true };
  }
  const response = await chrome.runtime.sendMessage({
    action: CANVA_STUDIO_PEEL_DISPATCH_ACTION,
    data: imageData
  });
  if (!response?.success) {
    throw new Error(response?.error || 'فشل توجيه الصورة إلى Studio');
  }
  return { delivered: !response.buffered, buffered: !!response.buffered };
}

function canvaBufferTeeMasterStudioImage(imageData) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.get([CANVA_STUDIO_TEEMASTER_BUFFER_KEY], (res) => {
        const buffer = res[CANVA_STUDIO_TEEMASTER_BUFFER_KEY] || [];
        buffer.push(imageData);
        if (buffer.length > CANVA_TEEMASTER_BUFFER_MAX) {
          buffer.splice(0, buffer.length - CANVA_TEEMASTER_BUFFER_MAX);
        }
        chrome.storage.local.set({ [CANVA_STUDIO_TEEMASTER_BUFFER_KEY]: buffer }, resolve);
      });
    } catch (_) {
      resolve();
    }
  });
}

async function canvaDispatchTeeMasterStudioImage(imageData) {
  if (!imageData?.dataURL) {
    throw new Error('بيانات الصورة ناقصة — لم يُجلب PNG من المكتبة');
  }
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    await canvaBufferTeeMasterStudioImage(imageData);
    console.warn('[Canva Bridge→TeeMaster] chrome.runtime غير متاح — تم التخزين المؤقت');
    return { delivered: false, buffered: true };
  }
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      action: CANVA_STUDIO_TEEMASTER_DISPATCH_ACTION,
      data: imageData
    });
  } catch (err) {
    const detail = canvaFormatRuntimeDispatchError(err, 'فشل توجيه الصورة إلى TeeMaster');
    if (/تبويب Studio غير نشط/i.test(detail)) {
      await canvaBufferTeeMasterStudioImage(imageData);
      return { delivered: false, buffered: true };
    }
    throw new Error(detail);
  }
  if (response == null) {
    throw new Error('فشل توجيه الصورة إلى TeeMaster — لا يوجد مستمع في الخلفية (أعد تحميل الإضافة)');
  }
  if (!response?.success) {
    const errText = typeof response?.error === 'string' && response.error.trim()
      ? response.error
      : canvaFormatRuntimeDispatchError(response?.error, 'فشل توجيه الصورة إلى TeeMaster');
    throw new Error(errText);
  }
  return { delivered: !response.buffered, buffered: !!response.buffered };
}

async function canvaEnsureStudioPeelReady() {
  if (typeof window.NHP_ensurePanelLoaded === 'function') {
    await window.NHP_ensurePanelLoaded('studio');
  }
  if (typeof window.NHP_activateStudioPanel === 'function') {
    window.NHP_activateStudioPanel();
  }
  if (typeof window.studioWaitPeelImportReady === 'function') {
    await window.studioWaitPeelImportReady(10000);
    return;
  }
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (document.getElementById('panel-studio') && window.STUDIO_TME) return;
    await canvaSleep(60);
  }
  throw new Error('تعذّر فتح TeeMaster Pro 5K — أعد المحاولة من تبويب Studio');
}

async function canvaEnsureSeoModuleReady() {
  if (typeof window.NHP_ensurePanelLoaded === 'function') {
    await window.NHP_ensurePanelLoaded('seo');
  }
  if (typeof window.NHP_activateSeoPanel === 'function') {
    window.NHP_activateSeoPanel();
  }
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (typeof window.NHP_SEO_GenerateAllLocal === 'function'
      || typeof window.NHP_SEO_GenerateAll === 'function') {
      return;
    }
    await canvaSleep(300);
  }
  throw new Error('وحدة SEO لم تُحمَّل — أعد تحميل الإضافة');
}

function canvaCountSeoQueuePending() {
  const queue = canvaHelpers.getDesignQueue?.() || [];
  return queue.filter((item) => item && item.status !== 'done').length;
}

function canvaGetStudioStep2Baseline() {
  if (typeof window.studioGetPipelineSnapshot === 'function') {
    return window.studioGetPipelineSnapshot()?.step2Count || 0;
  }
  return 0;
}

async function canvaInvokeStudioFullPipeline(options) {
  if (typeof window.studioStartFullUploadPipeline === 'function') {
    return window.studioStartFullUploadPipeline(options);
  }
  throw new Error('وحدة Studio غير جاهزة — افتح تبويب Studio وأعد المحاولة');
}

function canvaSetFullPipelineUiBusy(busy) {
  canvaFullPipelineBusy = !!busy;
  canvaUpdateLibraryToolbar();
  canvaUpdateButtons();
}

async function canvaSendOneDesignToStudioPeel(item) {
  const { storageId, designIndex } = canvaParseLibraryItemId(item);
  const dataURL = await canvaFetchLibraryImageAsDataUrl(item);
  if (!dataURL.startsWith('data:image/')) {
    throw new Error('تعذّر تحويل التصميم إلى PNG');
  }
  const imageData = {
    name: `canva_${storageId}_d${designIndex}.png`,
    dataURL,
    timestamp: Date.now(),
    source: 'canva_bridge_library',
    libraryId: item.id,
    displayName: canvaResolveItemDisplayName(item)
  };
  return canvaDispatchPeelStudioImage(imageData);
}

async function canvaSendOneDesignToStudioTeeMaster(item) {
  const { storageId, designIndex } = canvaParseLibraryItemId(item);
  const dataURL = await canvaFetchLibraryImageAsDataUrl(item);
  if (!dataURL.startsWith('data:image/')) {
    throw new Error('تعذّر تحويل التصميم إلى PNG');
  }
  const imageData = {
    name: `canva_${storageId}_d${designIndex}.png`,
    dataURL,
    timestamp: Date.now(),
    source: 'canva_bridge_library',
    libraryId: item.id,
    displayName: canvaResolveItemDisplayName(item)
  };
  return canvaDispatchTeeMasterStudioImage(imageData);
}

async function canvaSendLibrarySelectedToStudio() {
  const ids = [...canvaLibrarySelected];
  if (!ids.length) {
    canvaHelpers.showToast?.('⚠️ حدّد تصميماً واحداً على الأقل');
    return;
  }
  const items = ids.map((id) => canvaFindLibraryItem(id)).filter(Boolean);
  if (!items.length) {
    canvaHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }
  const { libSendStudio } = canvaEls();
  if (libSendStudio) {
    libSendStudio.disabled = true;
    canvaSetLibBtnLabel(libSendStudio, 'جاري الإرسال...');
  }
  canvaHelpers.switchTab?.('studio');
  try {
    await canvaEnsureStudioPeelReady();
  } catch (err) {
    canvaHelpers.showToast?.(`⚠️ ${err?.message || 'تعذّر فتح Studio'}`);
    if (libSendStudio) {
      libSendStudio.disabled = canvaLibrarySelected.size === 0;
      canvaSetLibBtnLabel(libSendStudio, 'Peel');
    }
    return;
  }
  let sent = 0;
  let buffered = 0;
  let lastErr = '';
  for (const item of items) {
    try {
      const route = await canvaSendOneDesignToStudioPeel(item);
      if (route?.buffered) buffered += 1;
      else sent += 1;
    } catch (err) {
      lastErr = err?.message || String(err);
      console.warn('[Canva Bridge→Peel Banana]', err);
    }
    await canvaSleep(120);
  }
  if (libSendStudio) {
    libSendStudio.disabled = canvaLibrarySelected.size === 0;
    canvaSetLibBtnLabel(libSendStudio, 'Peel');
  }
  if (sent > 0 || buffered > 0) {
    const parts = [];
    if (sent > 0) parts.push(`${sent} مباشرة`);
    if (buffered > 0) parts.push(`${buffered} في الانتظار`);
    canvaHelpers.showToast?.(`✅ ${parts.join(' + ')} → Peel Banana → TeeMaster Pro 5K`);
  } else {
    canvaHelpers.showToast?.(
      lastErr
        ? `⚠️ فشل الإرسال إلى Peel Banana: ${lastErr}`
        : '⚠️ تعذّر إرسال التصاميم — تأكد من Ghost Server والصور PNG'
    );
  }
}

/**
 * Send selected library images directly to TeeMaster Pro 5K, then stop.
 * Does not run Peel, magic, 5K process, SEO, or Autopilot — waits for the user.
 */
async function canvaSendLibrarySelectedToTeeMasterOnly() {
  if (canvaTeeMasterPipelineBusy || canvaTeeMasterFullPathBusy || canvaFullPipelineBusy) {
    canvaHelpers.showToast?.('⏳ مسار معالجة آخر يعمل بالفعل');
    return;
  }
  const ids = [...canvaLibrarySelected];
  if (!ids.length) {
    canvaHelpers.showToast?.('⚠️ حدّد تصميماً واحداً على الأقل');
    return;
  }
  const items = ids.map((id) => canvaFindLibraryItem(id)).filter(Boolean);
  if (!items.length) {
    canvaHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }
  const { libTeeMasterSendOnly } = canvaEls();
  if (libTeeMasterSendOnly) {
    libTeeMasterSendOnly.disabled = true;
    canvaSetLibBtnLabel(libTeeMasterSendOnly, 'جاري الإرسال...');
  }
  canvaHelpers.switchTab?.('studio');
  try {
    await canvaEnsureStudioPeelReady();
  } catch (err) {
    canvaHelpers.showToast?.(`⚠️ ${err?.message || 'تعذّر فتح Studio'}`);
    if (libTeeMasterSendOnly) {
      libTeeMasterSendOnly.disabled = canvaLibrarySelected.size === 0;
      canvaSetLibBtnLabel(libTeeMasterSendOnly, CANVA_TEEMASTER_SEND_ONLY_LABEL);
    }
    return;
  }
  let sent = 0;
  let buffered = 0;
  let lastErr = '';
  for (const item of items) {
    try {
      const route = await canvaSendOneDesignToStudioTeeMaster(item);
      if (route?.buffered) buffered += 1;
      else sent += 1;
    } catch (err) {
      lastErr = err?.message || String(err);
      console.warn('[Canva Bridge→TeeMaster فقط]', err);
    }
    await canvaSleep(120);
  }
  try {
    await window.studioDrainTeeMasterBuffer?.();
  } catch (_) { /* ignore */ }

  if (libTeeMasterSendOnly) {
    libTeeMasterSendOnly.disabled = canvaLibrarySelected.size === 0;
    canvaSetLibBtnLabel(libTeeMasterSendOnly, CANVA_TEEMASTER_SEND_ONLY_LABEL);
  }
  canvaUpdateLibraryToolbar();

  if (sent > 0 || buffered > 0) {
    const parts = [];
    if (sent > 0) parts.push(`${sent} مباشرة`);
    if (buffered > 0) parts.push(`${buffered} في الانتظار`);
    const msg = `✅ ${parts.join(' + ')} → TeeMaster — في انتظارك (بدون Peel وبدون متابعة تلقائية)`;
    canvaHelpers.showToast?.(msg);
    canvaSetMsg?.(msg, 'success');
  } else {
    const errMsg = lastErr
      ? `⚠️ فشل الإرسال إلى TeeMaster: ${lastErr}`
      : '⚠️ تعذّر إرسال التصاميم — تأكد من Ghost Server والصور PNG';
    canvaHelpers.showToast?.(errMsg);
    canvaSetMsg?.(errMsg, 'error');
  }
}

async function canvaStartFullUploadPipeline() {
  if (canvaFullPipelineBusy || canvaTeeMasterFullPathBusy) {
    canvaHelpers.showToast?.('⏳ مسار الرفع الكامل يعمل بالفعل');
    return;
  }
  const ids = [...canvaLibrarySelected];
  if (!ids.length) {
    canvaHelpers.showToast?.('⚠️ حدّد تصميماً واحداً على الأقل');
    return;
  }
  const n = ids.length;
  if (!confirm(`سيتم إرسال ${n} تصاميم → Peel → TeeMaster → SEO → Autopilot`)) return;
  const items = ids.map((id) => canvaFindLibraryItem(id)).filter(Boolean);
  if (!items.length) {
    canvaHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }

  canvaFullPipelineCancelled = false;
  canvaSetFullPipelineUiBusy(true);
  canvaPipelineGlobalStart({
    id: 'full-upload',
    title: 'مسار الرفع الكامل',
    totalItems: items.length,
    stage: CANVA_FULL_PIPELINE_STEP_LABELS[0]
  });

  let pipelineOk = false;
  let pipelineErr = '';
  try {
    try {
      await canvaEnsureStudioPeelReady();
    } catch (err) {
      canvaHelpers.showToast?.(`⚠️ ${err?.message || 'تعذّر فتح Studio'}`);
      return;
    }

    const baselineStep2 = canvaGetStudioStep2Baseline();
    const targetStep2Count = baselineStep2 + items.length;
    canvaSetLoading(true, `${CANVA_FULL_PIPELINE_STEP_LABELS[0]} (0/${items.length})...`);

    let sent = 0;
    let lastErr = '';
    for (let i = 0; i < items.length; i += 1) {
      if (canvaFullPipelineCancelled) break;
      canvaSetLoading(true, `${CANVA_FULL_PIPELINE_STEP_LABELS[0]} (${i + 1}/${items.length})...`);
      canvaEmitProgressFromLabel(`${CANVA_FULL_PIPELINE_STEP_LABELS[0]} (${i + 1}/${items.length})`);
      try {
        await canvaSendOneDesignToStudioPeel(items[i]);
        sent += 1;
      } catch (err) {
        lastErr = err?.message || String(err);
        console.warn('[Canva Bridge→Full Pipeline Peel]', err);
      }
      await canvaSleep(CANVA_PIPELINE_ITEM_DELAY_MS);
    }

    if (canvaFullPipelineCancelled) {
      canvaHelpers.showToast?.('⏹️ تم إلغاء مسار الرفع الكامل');
      return;
    }
    if (sent === 0) {
      canvaHelpers.showToast?.(
        lastErr
          ? `❌ فشل إرسال الصور: ${lastErr}`
          : '❌ لم تُرسل أي صورة — تحقق من Ghost Server والصور'
      );
      return;
    }

    canvaSetLoading(true, CANVA_FULL_PIPELINE_STEP_LABELS[2] || 'جاري مسار Studio...');
    const pipelineResult = await canvaInvokeStudioFullPipeline({
      targetStep2Count,
      includeAutopilot: false,
      onProgress: ({ label }) => {
        if (label) {
          canvaSetLoading(true, label);
          canvaEmitProgressFromLabel(label);
        }
      },
      cancelCheck: () => {
        if (canvaFullPipelineCancelled) {
          window.studioCancelFullUploadPipeline?.();
          throw new Error('تم إلغاء مسار الرفع الكامل');
        }
      }
    });

    if (pipelineResult?.success) {
      pipelineOk = true;
    } else if (!canvaFullPipelineCancelled) {
      pipelineErr = pipelineResult?.error || 'فشل مسار الرفع الكامل';
      canvaHelpers.showToast?.(`❌ ${pipelineErr}`);
    }
  } finally {
    canvaSetFullPipelineUiBusy(false);
    canvaSetLoading(false);
    canvaHidePipelineProgress();
    if (canvaFullPipelineCancelled) {
      canvaPipelineGlobalEnd(false, 'تم إلغاء مسار الرفع الكامل');
      canvaHelpers.showToast?.('⏹️ تم إلغاء مسار الرفع الكامل');
    } else if (pipelineOk) {
      canvaPipelineGlobalEnd(true, 'اكتمل مسار الرفع الكامل');
      canvaHelpers.showToast?.('✅ اكتمل مسار الرفع الكامل');
    } else if (pipelineErr) {
      canvaPipelineGlobalEnd(false, pipelineErr);
      /* toast already shown */
    } else {
      canvaPipelineGlobalEnd(false, 'توقّف مسار الرفع الكامل');
    }
  }
}

function canvaSetTeeMasterPipelineUiBusy(busy) {
  canvaTeeMasterPipelineBusy = !!busy;
  if (!canvaTeeMasterFullPathBusy) {
    canvaSetPipelineUiPaused(!!busy);
  }
  canvaUpdateLibraryToolbar();
  canvaUpdateButtons();
}

async function canvaInvokeStudioTeeMasterEditedPipeline(options) {
  if (typeof window.studioStartTeeMasterEditedPipeline !== 'function') {
    throw new Error('وحدة Studio غير جاهزة — افتح تبويب Studio وأعد المحاولة');
  }
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await window.studioStartTeeMasterEditedPipeline(options);
    if (result?.error !== 'pipeline_busy' || attempt === maxAttempts - 1) return result;
    await canvaSleep(600 + attempt * 400);
  }
  return { success: false, error: 'pipeline_busy' };
}

async function canvaInvokeStudioSeoAutPipeline(options) {
  if (typeof window.studioRunSeoGenerateAndAutopilot === 'function') {
    return window.studioRunSeoGenerateAndAutopilot(options);
  }
  throw new Error('وحدة Studio غير جاهزة — افتح تبويب Studio وأعد المحاولة');
}

function canvaSetTeeMasterFullPathUiBusy(busy) {
  canvaTeeMasterFullPathBusy = !!busy;
  canvaUpdateLibraryToolbar();
  canvaUpdateButtons();
}

/** Blocks other flows from clearing SEO while مسار TeeMaster chunked run is active. */
function canvaSetTeeMasterFullPathInProgress(active) {
  window.teemasterFullPathInProgress = !!active;
  canvaSetPipelineUiPaused(!!active);
}

function canvaFormatTeeMasterChunkProgress(chunkIndex, chunkTotal, done, total, phaseLabel) {
  const prefix = chunkTotal > 1 ? `دفعة ${chunkIndex}/${chunkTotal} — ` : '';
  const suffix = total > 1 ? ` ${done}/${total}` : '';
  return `${prefix}${phaseLabel}${suffix}`;
}

function canvaGetTeeMasterChunkSize() {
  if (typeof window.studioGetTeeMasterChunkSize === 'function') {
    return window.studioGetTeeMasterChunkSize();
  }
  return CANVA_TEEMASTER_PIPELINE_CHUNK_SIZE_DEFAULT;
}

/** Smaller chunks for 50+ designs or low-spec mode to avoid memory/UI freeze. */
function canvaResolveTeeMasterChunkSize(itemCount) {
  const n = Math.max(0, Number(itemCount) || 0);
  let size = typeof window.studioGetTeeMasterChunkSize === 'function'
    ? window.studioGetTeeMasterChunkSize(n)
    : canvaGetTeeMasterChunkSize();
  if (n > CANVA_TEEMASTER_LARGE_BATCH_WARN) {
    size = Math.min(size, 5);
  } else if (n > 30) {
    size = Math.min(size, 8);
  }
  if (window.NHP_IS_LIGHT_MODE || window.NHP_LOW_SPEC_MODE) {
    size = Math.min(size, 5);
  }
  return Math.max(1, size);
}

function canvaChunkArray(items, chunkSize) {
  const size = Math.max(1, Number(chunkSize) || canvaGetTeeMasterChunkSize());
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function canvaResolveTeeMasterTimeoutMs(
  itemCount,
  perItemMs = CANVA_TEEMASTER_TIMEOUT_PER_ITEM_MS,
  minMs = CANVA_TEEMASTER_TIMEOUT_MIN_MS,
  maxMs = CANVA_TEEMASTER_TIMEOUT_MAX_MS
) {
  const n = Math.max(1, Number(itemCount) || 1);
  return Math.min(maxMs, Math.max(minMs, n * perItemMs));
}

function canvaResolveTeeMasterChunkTimeouts(itemCount, isChunked) {
  if (!isChunked) {
    return {
      uploadTimeoutMs: canvaResolveTeeMasterTimeoutMs(itemCount, 3500),
      magicIdleTimeoutMs: canvaResolveTeeMasterTimeoutMs(itemCount, 2500, 120000, CANVA_TEEMASTER_TIMEOUT_MAX_MS),
      processIdleTimeoutMs: canvaResolveTeeMasterTimeoutMs(itemCount, 12000)
    };
  }
  return {
    uploadTimeoutMs: Math.max(
      CANVA_TEEMASTER_CHUNK_QUEUE_TIMEOUT_MS,
      canvaResolveTeeMasterTimeoutMs(itemCount, 4500, CANVA_TEEMASTER_CHUNK_QUEUE_TIMEOUT_MS, CANVA_TEEMASTER_TIMEOUT_MAX_MS)
    ),
    magicIdleTimeoutMs: Math.max(
      180000,
      canvaResolveTeeMasterTimeoutMs(itemCount, 3000, 180000, CANVA_TEEMASTER_TIMEOUT_MAX_MS)
    ),
    processIdleTimeoutMs: Math.max(
      CANVA_TEEMASTER_CHUNK_PROCESS_TIMEOUT_MS,
      canvaResolveTeeMasterTimeoutMs(itemCount, 15000, CANVA_TEEMASTER_CHUNK_PROCESS_TIMEOUT_MS, CANVA_TEEMASTER_TIMEOUT_MAX_MS)
    )
  };
}

function canvaSetPipelineProgress(done, total, label, batchMeta = {}) {
  const safeDone = Math.max(0, Number(done) || 0);
  const safeTotal = Math.max(1, Number(total) || 1);
  const batchIndex = Number(batchMeta.batchIndex) || 0;
  const batchTotal = Number(batchMeta.batchTotal) || 0;
  const pct = Math.min(100, Math.round((safeDone / safeTotal) * 100));
  const batchSuffix = batchTotal > 1 ? ` — دفعة ${batchIndex}/${batchTotal}` : '';
  const detail = safeTotal > 1
    ? `${label} — ${safeDone}/${safeTotal}${batchSuffix} (${pct}%)`
    : label;

  if (canvaSeoEnqueueCtx) {
    canvaSeoEnqueueProgressUpdate(safeDone, safeTotal, batchIndex, batchTotal);
    return;
  }

  if (!canvaIsGlobalPipelineActive()) {
    canvaSetLoading(true, detail);
  }
  canvaUpdateSeoEnqueueInlineProgress(safeDone, safeTotal, detail);

  if (canvaIsGlobalPipelineActive()) {
    const phase = String(label || '').includes('SEO') ? 'seo-enqueue' : 'process';
    canvaPipelineGlobalUpdate({
      stage: label,
      itemDone: safeDone,
      itemTotal: safeTotal,
      batchIndex,
      batchTotal,
      phase,
      percent: canvaComputeWeightedPercent(phase, safeDone, safeTotal, 0, 0)
    });
  }
}

function canvaHidePipelineProgress() {
  const wrap = document.getElementById('canva-bridge-pipeline-progress');
  if (wrap) wrap.classList.add('is-hidden');
  const libStrip = document.getElementById('canva-bridge-lib-pipeline-strip');
  if (libStrip) libStrip.classList.add('is-hidden');
}

function canvaUpdateSeoEnqueueInlineProgress(done, total, detail) {
  const safeDone = Math.max(0, Number(done) || 0);
  const safeTotal = Math.max(1, Number(total) || 1);
  const pct = Math.min(100, Math.round((safeDone / safeTotal) * 100));
  const fill = document.getElementById('canva-bridge-pipeline-progress-fill');
  const wrap = document.getElementById('canva-bridge-pipeline-progress');
  if (fill) fill.style.width = `${pct}%`;
  if (wrap) wrap.classList.toggle('is-hidden', false);

  const libFill = document.getElementById('canva-bridge-lib-pipeline-strip-fill');
  const libStrip = document.getElementById('canva-bridge-lib-pipeline-strip');
  const libLabel = document.getElementById('canva-bridge-lib-pipeline-strip-label');
  if (libFill) libFill.style.width = `${pct}%`;
  if (libStrip) libStrip.classList.toggle('is-hidden', false);
  if (libLabel) libLabel.textContent = detail;
}

function canvaSeoEnqueueProgressStart(total) {
  const safeTotal = Math.max(1, Number(total) || 1);
  canvaSeoEnqueueCtx = { total: safeTotal };
  const detail = `إرسال إلى SEO 0/${safeTotal}`;
  canvaUpdateSeoEnqueueInlineProgress(0, safeTotal, detail);
  window.NHP_PIPELINE_PROGRESS?.start?.({
    pipelineId: 'canva-seo-enqueue',
    title: 'إرسال إلى SEO',
    itemTotal: safeTotal,
    total: safeTotal,
    done: 0,
    stage: detail,
    percent: 0
  });
}

function canvaSeoEnqueueProgressUpdate(done, total, batchIndex = 0, batchTotal = 0) {
  const safeDone = Math.max(0, Number(done) || 0);
  const safeTotal = Math.max(1, Number(total) || 1);
  const pct = Math.min(100, Math.round((safeDone / safeTotal) * 100));
  const batchSuffix = batchTotal > 1 ? ` — دفعة ${batchIndex}/${batchTotal}` : '';
  const detail = `إرسال إلى SEO ${safeDone}/${safeTotal}${batchSuffix} (${pct}%)`;

  canvaUpdateSeoEnqueueInlineProgress(safeDone, safeTotal, detail);

  if (canvaSeoEnqueueCtx) {
    window.NHP_PIPELINE_PROGRESS?.update?.({
      done: safeDone,
      total: safeTotal,
      stage: detail,
      percent: pct,
      batchIndex,
      batchTotal
    });
  }
}

function canvaSeoEnqueueProgressEnd(success, message) {
  canvaHidePipelineProgress();
  if (canvaSeoEnqueueCtx) {
    window.NHP_PIPELINE_PROGRESS?.end?.({ success, message });
    canvaSeoEnqueueCtx = null;
  }
}

async function canvaAppendSeoQueueBatch(batchItems, { render = true } = {}) {
  if (!batchItems?.length) return;
  if (typeof canvaHelpers.getDesignQueue !== 'function' || typeof canvaHelpers.setDesignQueue !== 'function') return;
  const current = canvaHelpers.getDesignQueue() || [];
  canvaHelpers.setDesignQueue([...current, ...batchItems]);
  if (render) canvaHelpers.renderQueue?.();
  await canvaHelpers.saveQueueToStorage?.(true);
}

function canvaIsGlobalPipelineActive() {
  return !!(canvaTeeMasterFullPathBusy || canvaFullPipelineBusy);
}

function canvaParsePipelineLabel(label) {
  const out = { stage: String(label || '').trim() };
  if (!out.stage) return out;
  const itemMatch = out.stage.match(/(\d+)\s*\/\s*(\d+)/);
  if (itemMatch) {
    out.itemDone = Number(itemMatch[1]) || 0;
    out.itemTotal = Number(itemMatch[2]) || 0;
  }
  const batchMatch = out.stage.match(/دفعة\s*(\d+)\s*\/\s*(\d+)/);
  if (batchMatch) {
    out.batchIndex = Number(batchMatch[1]) || 0;
    out.batchTotal = Number(batchMatch[2]) || 0;
  }
  const dashParts = out.stage.split('—');
  if (dashParts.length > 1) {
    out.stage = dashParts[dashParts.length - 1].trim();
  }
  return out;
}

function canvaComputeWeightedPercent(phase, itemDone, itemTotal, subDone, subTotal) {
  const itemRatio = itemTotal > 0 ? Math.min(1, itemDone / itemTotal) : 0;
  const subRatio = subTotal > 0 ? Math.min(1, subDone / subTotal) : 0;
  if (phase === 'seo-enqueue') return Math.round((72 + itemRatio * 8) * 10) / 10;
  if (phase === 'seo') return Math.round((80 + subRatio * 10) * 10) / 10;
  if (phase === 'autopilot') return Math.round((90 + subRatio * 10) * 10) / 10;
  return Math.round(itemRatio * 72);
}

let canvaGlobalPipelineCtx = null;

function canvaPipelineGlobalStart(opts = {}) {
  canvaGlobalPipelineCtx = {
    id: opts.id || 'pipeline',
    title: opts.title || 'مسار المعالجة',
    totalItems: Math.max(1, Number(opts.totalItems) || 1)
  };
  window.NHP_pipelineBackgroundMode = true;
  window.NHP_PIPELINE_PROGRESS?.start?.({
    pipelineId: canvaGlobalPipelineCtx.id,
    title: canvaGlobalPipelineCtx.title,
    itemTotal: canvaGlobalPipelineCtx.totalItems,
    stage: opts.stage || 'بدء المسار...',
    percent: 0
  });
}

function canvaPipelineGlobalUpdate(detail = {}, force = false) {
  if (!canvaGlobalPipelineCtx && !window.NHP_PIPELINE_PROGRESS?.isActive?.()) return;
  const payload = { ...detail };
  if (typeof payload.percent !== 'number' && payload.phase) {
    payload.percent = canvaComputeWeightedPercent(
      payload.phase,
      payload.itemDone ?? 0,
      payload.itemTotal ?? canvaGlobalPipelineCtx?.totalItems ?? 0,
      payload.seoDone ?? payload.done ?? 0,
      payload.seoTotal ?? payload.total ?? 0
    );
  }
  const stage = String(payload.stage || payload.label || '');
  const now = Date.now();
  const stageChanged = stage && stage !== canvaPipelineGlobalThrottle.lastStage;
  if (!force && !stageChanged && (now - canvaPipelineGlobalThrottle.lastMs) < 1000) {
    canvaPipelineGlobalThrottle.pending = payload;
    if (!canvaPipelineGlobalThrottle.timer) {
      const wait = 1000 - (now - canvaPipelineGlobalThrottle.lastMs);
      canvaPipelineGlobalThrottle.timer = setTimeout(() => {
        canvaPipelineGlobalThrottle.timer = null;
        const pending = canvaPipelineGlobalThrottle.pending;
        canvaPipelineGlobalThrottle.pending = null;
        if (pending) canvaPipelineGlobalUpdate(pending, true);
      }, Math.max(16, wait));
    }
    return;
  }
  canvaPipelineGlobalThrottle.lastMs = now;
  if (stage) canvaPipelineGlobalThrottle.lastStage = stage;
  window.NHP_PIPELINE_PROGRESS?.update?.(payload);
}

function canvaPipelineGlobalEnd(success, message) {
  window.NHP_pipelineBackgroundMode = false;
  window.NHP_PIPELINE_PROGRESS?.end?.({ success, message });
  canvaGlobalPipelineCtx = null;
}

function canvaEmitProgressFromLabel(label, extra = {}) {
  const parsed = canvaParsePipelineLabel(label);
  canvaPipelineGlobalUpdate({
    stage: parsed.stage || label,
    itemDone: parsed.itemDone ?? extra.itemDone,
    itemTotal: parsed.itemTotal ?? extra.itemTotal ?? canvaGlobalPipelineCtx?.totalItems,
    batchIndex: parsed.batchIndex ?? extra.batchIndex,
    batchTotal: parsed.batchTotal ?? extra.batchTotal,
    phase: extra.phase || 'process',
    percent: extra.percent
  });
}

function canvaBuildTeeMasterFullPathConfirmMessage(count) {
  const steps = CANVA_TEEMASTER_FULL_PATH_STEP_LABELS.map((label, i) => `${i + 1}. ${label}`).join('\n');
  const chunkSize = canvaResolveTeeMasterChunkSize(count);
  const chunkCount = Math.ceil(count / chunkSize);
  const largeWarn = count > CANVA_TEEMASTER_LARGE_BATCH_WARN
    ? `\n\n⚠️ سيتم معالجة ${count} تصميم — قد يستغرق وقتاً طويلاً (${chunkCount} دفعة × ~${chunkSize} تصميم).`
    : (count > chunkSize
      ? `\n\n⚠️ سيتم معالجة ${count} تصميم على ${chunkCount} دفعة (حوالي ${chunkSize} تصميم/دفعة).`
      : '');
  return `سيتم إرسال ${count} تصميم عبر المسار التالي:\n\n${steps}\n\n📚 SEO عبر المكتبة المحلية (BubbleSpider + NHP API — نص فقط، بدون مسار Studio المؤقت).\n⚠️ بدون إعادة تسمية AI — سمِّ التصاميم يدوياً قبل البدء.${largeWarn}\n\nمتابعة؟`;
}

/**
 * TeeMaster → magic → 5K → save edited library copies (Peel optional via skipPeel).
 * @returns {{ savedIds: string[], savedCount: number, saveErrors: Array, lastSavedId: string|null }}
 */
async function canvaRunTeeMasterEditedCore(items, options = {}) {
  const {
    onProgress,
    cancelCheck,
    skipPeel = true,
    stepLabels = CANVA_TEEMASTER_EDITED_STEP_LABELS,
    batchContext = null,
    skipStudioEnsure = false,
    skipLibraryRefresh = false
  } = options;

  const peelNameToItem = new Map(items.map((item) => [canvaBuildPeelFileName(item), item]));
  let savedCount = 0;
  let lastSavedId = null;
  const savedIds = [];
  const savedItemsById = new Map();
  const saveErrors = [];

  const globalTotal = batchContext?.globalTotal ?? items.length;
  const globalBase = batchContext?.globalOffset ?? 0;
  const formatProgress = (done, label) => {
    const chunkSuffix = batchContext
      ? ` (دفعة ${batchContext.chunkIndex}/${batchContext.totalChunks})`
      : '';
    if (label) return `TeeMaster ${done}/${globalTotal}${chunkSuffix} — ${label}`;
    return `TeeMaster ${done}/${globalTotal}${chunkSuffix}...`;
  };

  if (!skipStudioEnsure) {
    try {
      await canvaEnsureStudioPeelReady();
    } catch (err) {
      throw new Error(err?.message || 'تعذّر فتح Studio');
    }
  } else if (batchContext) {
    try {
      await canvaEnsureStudioPeelReady();
    } catch (err) {
      throw new Error(err?.message || 'تعذّر فتح Studio');
    }
    await window.studioWaitForTeeMasterPipelineIdle?.(90000, cancelCheck);
    await window.studioWaitForStep2Empty?.(10000, cancelCheck);
  }

  const baselineStep2 = canvaGetStudioStep2Baseline();
  const failedIds = [];
  const chunkTimeouts = canvaResolveTeeMasterChunkTimeouts(items.length, !!batchContext);
  const uploadTimeoutMs = chunkTimeouts.uploadTimeoutMs;
  const magicIdleTimeoutMs = chunkTimeouts.magicIdleTimeoutMs;
  const processIdleTimeoutMs = chunkTimeouts.processIdleTimeoutMs;
  const uploadLabel = skipPeel
    ? (stepLabels[0] && !/Peel/i.test(stepLabels[0])
      ? stepLabels[0]
      : 'TeeMaster Pro 5K — استقبال الصور')
    : (stepLabels[0] || CANVA_FULL_PIPELINE_STEP_LABELS[0]);

  let sent = 0;
  let lastErr = '';
  const sendOne = skipPeel ? canvaSendOneDesignToStudioTeeMaster : canvaSendOneDesignToStudioPeel;
  for (let i = 0; i < items.length; i += 1) {
    if (cancelCheck?.()) throw new Error('تم إلغاء المسار');
    const progressLabel = formatProgress(globalBase + i + 1, uploadLabel);
    canvaSetLoading(true, progressLabel);
    onProgress?.(progressLabel);
    try {
      await sendOne(items[i]);
      sent += 1;
    } catch (err) {
      const label = canvaResolveItemDisplayName(items[i]) || items[i]?.id || '';
      const phase = skipPeel ? 'Direct' : 'Peel';
      lastErr = canvaFormatRuntimeDispatchError(err, `خطأ في توجيه الصورة إلى TeeMaster — ${label}`);
      const itemId = items[i]?.id || '';
      failedIds.push({ id: itemId, error: lastErr });
      console.warn(`[Canva Bridge→TeeMaster Edited ${phase}] تخطّي ${label}:`, lastErr);
      canvaHelpers.showToast?.(`⚠️ تخطّي «${label}»: ${lastErr}`);
    }
    await canvaYieldToMainThread();
    await canvaSleep(CANVA_PIPELINE_ITEM_DELAY_MS);
  }

  await window.studioDrainTeeMasterBuffer?.();
  await canvaSleep(350);

  if (sent === 0) {
    throw new Error(lastErr
      ? `فشل إرسال الصور: ${lastErr}`
      : 'لم تُرسل أي صورة — تحقق من Ghost Server والصور');
  }

  const targetStep2Count = baselineStep2 + sent;

  const pipelineResult = await canvaInvokeStudioTeeMasterEditedPipeline({
    targetStep2Count,
    skipPeel,
    queueTimeoutMs: uploadTimeoutMs,
    magicIdleTimeoutMs,
    processIdleTimeoutMs,
    onProgress: ({ label }) => {
      if (!label) return;
      const progressLabel = formatProgress(Math.min(globalBase + items.length, globalTotal), label);
      onProgress?.(progressLabel);
      canvaSetLoading(true, progressLabel);
    },
    cancelCheck
  });

  if (!pipelineResult?.success) {
    throw new Error(pipelineResult?.error || 'فشل معالجة TeeMaster');
  }

  const processedFiles = Array.isArray(pipelineResult.files) ? pipelineResult.files : [];
  if (!processedFiles.length) {
    throw new Error('لم تُرجع Studio أي صور مُعالجة');
  }

  const saveLabel = formatProgress(
    Math.min(globalBase + processedFiles.length, globalTotal),
    'حفظ في التصاميم المعدّلة'
  );
  canvaSetLoading(true, saveLabel);
  onProgress?.(saveLabel);

  for (let i = 0; i < processedFiles.length; i += 1) {
    const file = processedFiles[i];
    const baseName = String(file?.name || '').replace(/_POD_5K\.png$/i, '.png');
    const sourceItem = peelNameToItem.get(baseName)
      || peelNameToItem.get(String(file?.name || ''))
      || items[i]
      || null;
    const originalLibraryId = sourceItem?.id
      || canvaParsePeelImageNameToLibraryId(file?.name)
      || canvaParsePeelImageNameToLibraryId(baseName);
    if (!originalLibraryId || !file?.dataURL) {
      saveErrors.push({ name: file?.name, error: 'تعذّر ربط الصورة بالتصميم الأصلي' });
      continue;
    }
    const displayName = canvaResolveItemDisplayName(sourceItem)
      || String(file?.displayName || file?.meta?.displayName || '').trim()
      || undefined;
    try {
      const saved = await canvaSaveTeeMasterEditedToLibrary({
        dataURL: file.dataURL,
        originalLibraryId,
        displayName: displayName || undefined
      });
      if (saved?.id) {
        savedCount += 1;
        lastSavedId = saved.id;
        savedIds.push(saved.id);
        savedItemsById.set(saved.id, saved);
      }
    } catch (err) {
      saveErrors.push({ name: file?.name, error: err?.message || String(err) });
    } finally {
      canvaReleaseDataUrl(file);
    }
    await canvaYieldToMainThread();
  }

  if (Array.isArray(pipelineResult.files)) {
    pipelineResult.files.forEach(canvaReleaseDataUrl);
    pipelineResult.files.length = 0;
  }
  await window.studioReleaseTeeMasterEditedBuffers?.();

  if (!skipLibraryRefresh) {
    if (typeof canvaHelpers.fetchLibrary === 'function') {
      await canvaHelpers.fetchLibrary();
    }
    if (savedItemsById.size && typeof canvaHelpers.upsertLibraryItems === 'function') {
      canvaHelpers.upsertLibraryItems([...savedItemsById.values()]);
    }
    if (!canvaIsPipelineUiPaused()) {
      canvaRenderLibrary({ force: true });
    }
  }

  return { savedIds, savedCount, saveErrors, lastSavedId, savedItemsById, failedIds, sentCount: sent };
}

function canvaIsNonRetryableTeeMasterChunkError(err) {
  const msg = String(err?.message || '');
  return /ملف.*غير موجود|HTTP 404|لم تُرسل أي صورة|فشل إرسال الصور/i.test(msg);
}

/**
 * TeeMaster edited core in chunks for 100+ designs — clears Studio slot between chunks.
 */
async function canvaRunTeeMasterEditedCoreChunked(items, options = {}) {
  if (!Array.isArray(items) || !items.length) {
    return { savedIds: [], savedCount: 0, saveErrors: [], lastSavedId: null, savedItemsById: new Map() };
  }
  const chunkSize = canvaResolveTeeMasterChunkSize(items.length);
  if (items.length <= chunkSize) {
    return canvaRunTeeMasterEditedCore(items, options);
  }

  const chunks = canvaChunkArray(items, chunkSize);
  const merged = {
    savedIds: [],
    savedCount: 0,
    saveErrors: [],
    lastSavedId: null,
    savedItemsById: new Map()
  };
  let globalOffset = 0;

  try {
    await canvaEnsureStudioPeelReady();
  } catch (err) {
    throw new Error(err?.message || 'تعذّر فتح Studio');
  }

  canvaHelpers.showToast?.(`📦 ${items.length} تصميم → ${chunks.length} دفعات (${chunkSize}/دفعة)`);

  for (let ci = 0; ci < chunks.length; ci += 1) {
    if (options.cancelCheck?.()) throw new Error('تم إلغاء المسار');
    if (ci > 0) {
      await window.studioClearTeeMasterEditedChunkBuffers?.({ maxIdleWaitMs: 90000 });
      await canvaSleep(500);
    }

    const chunk = chunks[ci];
    canvaSetPipelineProgress(
      globalOffset + 1,
      items.length,
      `دفعة TeeMaster ${ci + 1}/${chunks.length}`
    );
    if (canvaIsGlobalPipelineActive()) {
      canvaPipelineGlobalUpdate({
        stage: `دفعة TeeMaster ${ci + 1}/${chunks.length}`,
        batchIndex: ci + 1,
        batchTotal: chunks.length,
        itemDone: globalOffset,
        itemTotal: items.length,
        phase: 'process'
      });
    }
    if (items.length > CANVA_TEEMASTER_LARGE_BATCH_WARN) {
      canvaHelpers.showToast?.(`⏳ دفعة ${ci + 1}/${chunks.length} — ${chunk.length} تصميم`);
    }

    let result;
    let chunkErr = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        canvaHelpers.showToast?.(`🔁 إعادة محاولة دفعة ${ci + 1}/${chunks.length}...`);
        await window.studioClearTeeMasterEditedChunkBuffers?.({ maxIdleWaitMs: 60000 });
        await canvaSleep(500);
      }
      try {
        result = await canvaRunTeeMasterEditedCore(chunk, {
          ...options,
          batchContext: {
            globalTotal: items.length,
            globalOffset,
            chunkIndex: ci + 1,
            totalChunks: chunks.length
          },
          skipStudioEnsure: true,
          skipLibraryRefresh: true
        });
        chunkErr = null;
        break;
      } catch (err) {
        chunkErr = err;
        console.error(`[Canva Bridge] TeeMaster chunk ${ci + 1}/${chunks.length} attempt ${attempt + 1}:`, err);
        if (canvaIsNonRetryableTeeMasterChunkError(err)) break;
        if (attempt === 1) {
          const errMsg = err?.message || String(err);
          canvaHelpers.showToast?.(`❌ توقّفت دفعة ${ci + 1}/${chunks.length}: ${errMsg}`);
          if (canvaIsGlobalPipelineActive()) {
            canvaPipelineGlobalUpdate({
              stage: `فشل دفعة ${ci + 1}/${chunks.length}: ${errMsg}`,
              batchIndex: ci + 1,
              batchTotal: chunks.length,
              itemDone: globalOffset,
              itemTotal: items.length,
              phase: 'process'
            });
          }
          throw new Error(`دفعة ${ci + 1}/${chunks.length}: ${errMsg}`);
        }
      }
    }

    globalOffset += chunk.length;
    merged.savedIds.push(...(result.savedIds || []));
    merged.savedCount += result.savedCount || 0;
    merged.lastSavedId = result.lastSavedId || merged.lastSavedId;
    (result.saveErrors || []).forEach((err) => merged.saveErrors.push(err));
    if (result.savedItemsById instanceof Map) {
      result.savedItemsById.forEach((val, key) => merged.savedItemsById.set(key, val));
    }

    if ((result.savedCount || 0) === 0) {
      const chunkErr = result.saveErrors?.[0]?.error || 'لم يُحفظ أي تصميم';
      canvaHelpers.showToast?.(`❌ دفعة ${ci + 1}/${chunks.length}: ${chunkErr}`);
      throw new Error(`دفعة ${ci + 1}/${chunks.length}: ${chunkErr}`);
    }

    if (result.saveErrors?.length) {
      canvaHelpers.showToast?.(
        `⚠️ دفعة ${ci + 1}/${chunks.length}: حُفظ ${result.savedCount} — فشل ${result.saveErrors.length}`
      );
    } else if (ci < chunks.length - 1) {
      canvaHelpers.showToast?.(`✅ دفعة ${ci + 1}/${chunks.length} — متابعة...`);
    }

    if (typeof options.onChunkComplete === 'function') {
      await options.onChunkComplete(result, ci, chunks.length);
    }

    if (result.savedItemsById?.size && typeof canvaHelpers.upsertLibraryItems === 'function') {
      canvaHelpers.upsertLibraryItems([...result.savedItemsById.values()]);
    }
    canvaUpdateLibraryToolbar();
    await canvaYieldToMainThread();
  }

  if (typeof canvaHelpers.fetchLibrary === 'function') {
    await canvaHelpers.fetchLibrary();
  }
  if (merged.savedItemsById.size && typeof canvaHelpers.upsertLibraryItems === 'function') {
    canvaHelpers.upsertLibraryItems([...merged.savedItemsById.values()]);
  }

  canvaSetPipelineProgress(items.length, items.length, 'اكتملت معالجة TeeMaster');
  if (merged.savedCount === 0) {
    throw new Error('لم يُحفظ أي تصميم — تحقق من الملفات على القرص');
  }
  if (merged.savedCount < items.length) {
    canvaHelpers.showToast?.(
      `⚠️ اكتمل حفظ ${merged.savedCount}/${items.length} — تُخطّي التصاميم ذات الملفات المفقودة`
    );
  }
  return merged;
}

/** TeeMaster full path only: drop stale SEO queue items before enqueueing new edited designs. */
async function canvaClearSeoQueueBeforeTeeMasterPath(newDesignCount) {
  const existing = canvaHelpers.getDesignQueue?.() || [];
  if (!existing.length) return false;

  if (typeof window.studioClearSeoQueue === 'function') {
    await window.studioClearSeoQueue({ force: true });
  } else {
    for (const item of existing) {
      try {
        await window.NHPDatabase?.deleteImage?.(item.id);
      } catch (_) { /* keep clearing */ }
    }
    canvaHelpers.setDesignQueue?.([]);
    canvaHelpers.renderQueue?.();
    await canvaHelpers.saveQueueToStorage?.(true);
  }

  const count = Number(newDesignCount) || 0;
  canvaHelpers.showToast?.(`تم تفريغ قائمة SEO — إضافة ${count} تصميم جديد`);
  return true;
}

async function canvaEnqueueIdsToSeoBatched(idsToSend, options = {}) {
  const {
    auto = false,
    chunkSize = CANVA_TEEMASTER_SEO_ENQUEUE_CHUNK,
    savedItemsById = null,
    forceLocalLibrary = false,
    onProgress,
    source = 'canva-bridge'
  } = options;

  if (!idsToSend?.length) {
    throw new Error('لا توجد تصاميم صالحة للإرسال إلى SEO');
  }

  const fallbackItems = savedItemsById instanceof Map ? savedItemsById : new Map();
  const total = idsToSend.length;
  const useUrlsOnly = total > 3;
  const enqueueChunk = Math.max(1, Number(chunkSize) || CANVA_TEEMASTER_SEO_ENQUEUE_CHUNK);
  const batchTotal = Math.ceil(total / enqueueChunk);
  const useStandaloneProgress = !auto && !canvaIsGlobalPipelineActive();
  const errors = [];
  const allQueueItems = [];
  let processed = 0;
  let progressEnded = false;

  if (!auto) {
    canvaHelpers.showToast?.(`⏳ بدء إرسال ${total} تصميم إلى SEO...`);
  }

  canvaSeoEnqueueBusy = true;
  canvaUpdateLibraryToolbar();

  if (useStandaloneProgress) {
    canvaSeoEnqueueProgressStart(total);
  } else if (!auto) {
    canvaSetLoading(true, total > 1
      ? `جاري إرسال ${total} تصميم إلى SEO...`
      : 'جاري الإرسال إلى SEO...');
  }

  try {
    for (let offset = 0; offset < total; offset += enqueueChunk) {
      const chunk = idsToSend.slice(offset, offset + enqueueChunk);
      const batchIndex = Math.floor(offset / enqueueChunk) + 1;
      const batchItems = [];

      for (const libraryId of chunk) {
        try {
          const libItem = canvaFindLibraryItem(libraryId) || fallbackItems.get(libraryId);
          const useLocal = forceLocalLibrary || (libItem && canvaIsEditedDesign(libItem));
          const queueItem = useLocal
            ? (libItem
              ? await canvaBuildLocalLibrarySeoQueueItem(libItem, {
                includeImageBase64: !useUrlsOnly,
                source: source === 'canva-bridge-teemaster-path' ? 'teemaster' : 'canva-edited'
              })
              : await canvaSendOneToLocalLibrarySeo(libraryId))
            : await canvaSendOneToSeo(libraryId);
          batchItems.push(queueItem);
          allQueueItems.push(queueItem);
        } catch (err) {
          const errMsg = err?.message || String(err);
          errors.push({ libraryId, error: errMsg });
          if (!auto && total <= 20) {
            canvaHelpers.showToast?.(`⚠️ فشل تصميم: ${errMsg}`);
          }
        }

        processed++;
        onProgress?.(processed, total, batchIndex, batchTotal);
        canvaSetPipelineProgress(processed, total, 'إضافة إلى طابور SEO', { batchIndex, batchTotal });
        await canvaYieldToMainThread();
      }

      if (batchItems.length) {
        await canvaAppendSeoQueueBatch(batchItems);
      }

      if (offset + enqueueChunk < total) {
        await canvaYieldToMainThread();
        await canvaSleep(80);
      }
    }

    if (!allQueueItems.length) {
      throw new Error(errors[0]?.error || 'فشل الإرسال إلى SEO');
    }

    window.dispatchEvent(new CustomEvent('nhp:design-ready-for-seo', {
      detail: {
        items: allQueueItems,
        source,
        autoSwitch: auto,
        queueAlreadyUpdated: true
      }
    }));

    canvaSetStep('seo');

    if (!auto) {
      const okMsg = errors.length
        ? `تم إرسال ${allQueueItems.length} — فشل ${errors.length}`
        : `تم إرسال ${allQueueItems.length} تصميم إلى SEO`;
      canvaHelpers.showToast?.(errors.length ? `⚠️ ${okMsg}` : `🚀 ${okMsg}`);
      if (useStandaloneProgress) {
        canvaSeoEnqueueProgressEnd(!errors.length, okMsg);
        progressEnded = true;
      }
      canvaHelpers.switchTab?.('seo');
    }

    return { count: allQueueItems.length, errors };
  } catch (err) {
    if (!auto && useStandaloneProgress && !progressEnded) {
      canvaSeoEnqueueProgressEnd(false, err?.message || 'فشل الإرسال إلى SEO');
      progressEnded = true;
    }
    throw err;
  } finally {
    canvaSeoEnqueueBusy = false;
    if (!auto && !useStandaloneProgress) canvaSetLoading(false);
    if (!auto && !useStandaloneProgress) canvaHidePipelineProgress();
    canvaUpdateLibraryToolbar();
  }
}

async function canvaSendEditedIdsToSeo(libraryIds, auto = false, savedItemsById = null, options = {}) {
  const fallbackItems = savedItemsById instanceof Map ? savedItemsById : new Map();
  const {
    chunkSize = CANVA_TEEMASTER_SEO_ENQUEUE_CHUNK,
    onProgress,
    appendOnly: _appendOnly = false
  } = options;
  const idsToSend = [];
  const seen = new Set();
  for (const rawId of libraryIds || []) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) continue;
    const item = canvaFindLibraryItem(id) || fallbackItems.get(id);
    if (!item || !canvaIsEditedDesign(item)) continue;
    seen.add(id);
    idsToSend.push(id);
  }

  if (!idsToSend.length) {
    throw new Error('لا توجد تصاميم معدّلة صالحة للإرسال إلى SEO — تأكد من اكتمال الحفظ في المكتبة');
  }

  return canvaEnqueueIdsToSeoBatched(idsToSend, {
    auto,
    chunkSize,
    onProgress,
    savedItemsById: fallbackItems,
    forceLocalLibrary: true,
    source: 'canva-bridge-teemaster-path'
  });
}

function canvaBuildPeelFileName(item) {
  const { storageId, designIndex } = canvaParseLibraryItemId(item);
  return `canva_${storageId}_d${designIndex}.png`;
}

function canvaParsePeelImageNameToLibraryId(name) {
  const m = String(name || '').match(/^canva_(.+?)_d(\d+)(?:_POD_5K)?\.png$/i);
  if (!m) return null;
  return `${m[1]}__d${m[2]}`;
}

const CANVA_LIBRARY_UPLOAD_MAX_BYTES = 40 * 1024 * 1024;

function canvaIsNetworkFetchError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const cause = String(err?.cause?.message || err?.cause?.code || '').toLowerCase();
  return /fetch failed|failed to fetch|networkerror|network error|econnrefused|econnreset|enotfound|socket hang up|err_connection_refused|err_connection_reset|undici|connect|aborted/i.test(`${msg} ${cause}`);
}

function canvaExplainGhostFetchError(err, context = 'الاتصال بـ Ghost Server') {
  if (canvaIsNetworkFetchError(err)) {
    return `Ghost Server غير متاح — شغّل Ghost على المنفذ 3019 (Generate → إعادة تشغيل Ghost Server). (${context})`;
  }
  return String(err?.message || err || 'خطأ غير معروف');
}

function canvaFormatRuntimeDispatchError(err, fallback = 'فشل توجيه الصورة') {
  const runtimeMsg = typeof chrome !== 'undefined' ? chrome.runtime?.lastError?.message : '';
  const raw = runtimeMsg || err?.message || (typeof err === 'string' ? err : '');
  const text = String(raw || '').trim();
  if (!text || text === '{}' || text === '[object Object]') {
    return `${fallback} — تأكد من فتح تبويب Studio وأعد تحميل الإضافة إن لزم`;
  }
  if (/receiving end does not exist|could not establish connection/i.test(text)) {
    return `${fallback} — تبويب Studio غير نشط (سيتم التخزين المؤقت حتى تفتح Studio)`;
  }
  return `${fallback}: ${text}`;
}

/** Parse data: URLs via atob — fetch(dataURL) fails on large 5K PNGs in extension context. */
function canvaNormalizeBase64Payload(payload) {
  let b64 = String(payload || '').replace(/\s/g, '');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return b64;
}

function canvaParseDataUrlToBlob(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;,]+)?(?:;([^;,]+))?,(.*)$/s);
  if (!match) return null;
  const mime = match[1] || 'image/png';
  const encoding = match[2] || '';
  const payload = match[3] || '';
  try {
    if (!encoding || encoding.toLowerCase() === 'base64') {
      const binary = atob(canvaNormalizeBase64Payload(payload));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch (_) {
    return null;
  }
}

async function canvaDataUrlToBlob(dataURL) {
  const raw = String(dataURL || '').trim();
  if (!raw) throw new Error('لا توجد بيانات صورة للحفظ');
  if (raw.startsWith('data:')) {
    const blob = canvaParseDataUrlToBlob(raw);
    if (!blob || !blob.size) {
      throw new Error('تعذّر تحويل صورة 5K — حجم data URL غير صالح');
    }
    return blob;
  }
  if (raw.startsWith('blob:')) {
    try {
      const res = await fetch(raw);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    } catch (err) {
      throw new Error(canvaExplainGhostFetchError(err, 'قراءة blob URL'));
    }
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    } catch (err) {
      throw new Error(canvaExplainGhostFetchError(err, 'جلب الصورة من الرابط'));
    }
  }
  throw new Error('صيغة الصورة غير مدعومة — يُتوقع data: URL من TeeMaster');
}

function canvaLibraryImageFallbackUrls(item) {
  return canvaBuildLibraryPreviewUrlCandidates(item);
}

function canvaBindLibraryPreviewImg(img, item) {
  const urls = canvaLibraryImageFallbackUrls(item);
  if (!urls.length) {
    img.removeAttribute('src');
    img.style.opacity = '0.35';
    return;
  }
  let idx = 0;
  img.style.opacity = '';
  img.onerror = () => {
    idx += 1;
    if (idx < urls.length) {
      img.src = urls[idx];
      return;
    }
    img.style.opacity = '0.35';
  };
  img.src = urls[0];
}

function canvaBindLibraryImg(img, item) {
  canvaBindLibraryPreviewImg(img, item);
}

async function canvaPostLibraryUpload(form) {
  const url = canvaHelpers.ghostUrl('/api/library/upload');
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: form });
  } catch (err) {
    throw new Error(canvaExplainGhostFetchError(err, 'رفع إلى مكتبة التصاميم'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    const serverErr = data?.error || '';
    if (res.status === 413 || /too large|file size|limit/i.test(serverErr)) {
      throw new Error(`حجم الصورة كبير جداً (الحد ${Math.round(CANVA_LIBRARY_UPLOAD_MAX_BYTES / (1024 * 1024))}MB) — جرّب ضغط PNG أو زِد حد الرفع في Ghost`);
    }
    if (res.status === 404) {
      throw new Error('مسار /api/library/upload غير مسجّل — أعد تشغيل ghost-server.js على المنفذ 3019');
    }
    throw new Error(serverErr || `فشل الرفع (HTTP ${res.status})`);
  }
  return data;
}

async function canvaSaveTeeMasterEditedToLibrary({ dataURL, originalLibraryId, displayName }) {
  const blob = await canvaDataUrlToBlob(dataURL);
  if (blob.size > CANVA_LIBRARY_UPLOAD_MAX_BYTES) {
    const mb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(`صورة 5K كبيرة (${mb}MB) — الحد ${Math.round(CANVA_LIBRARY_UPLOAD_MAX_BYTES / (1024 * 1024))}MB`);
  }
  const safeLabel = displayName ? canvaSanitizeFileName(displayName) : 'teemaster_edited.png';
  const form = new FormData();
  form.append('image', blob, safeLabel);
  form.append('originalDesignId', originalLibraryId);
  form.append('versionLabel', CANVA_TEEMASTER_EDITED_VERSION);
  form.append('source', 'teemaster');
  if (displayName) form.append('displayName', displayName);
  const data = await canvaPostLibraryUpload(form);
  return data.items?.[0] || null;
}

async function canvaStartTeeMasterEditedPipeline() {
  if (canvaTeeMasterPipelineBusy || canvaTeeMasterFullPathBusy || canvaFullPipelineBusy) {
    canvaHelpers.showToast?.('⏳ مسار معالجة آخر يعمل بالفعل');
    return;
  }
  if (canvaLibraryView !== 'all') {
    canvaHelpers.showToast?.('⚠️ معالجة TeeMaster متاحة من تبويب مكتبة التصاميم فقط');
    return;
  }

  const ids = canvaResolveSmartRenameIds();
  if (!ids.length) {
    canvaHelpers.showToast?.('⚠️ لا توجد تصاميم في العرض الحالي');
    return;
  }

  const items = ids.map((id) => canvaFindLibraryItem(id)).filter(Boolean);
  if (!items.length) {
    canvaHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }
  if (items.length > CANVA_TEEMASTER_PIPELINE_MAX_DESIGNS) {
    canvaHelpers.showToast?.(`⚠️ الحد الأقصى ${CANVA_TEEMASTER_PIPELINE_MAX_DESIGNS} تصميم في المسار — حدّد عدداً أقل`);
    return;
  }

  const { libTeeMasterEdited } = canvaEls();
  if (libTeeMasterEdited) {
    libTeeMasterEdited.disabled = true;
    canvaSetLibBtnLabel(libTeeMasterEdited, 'جاري المعالجة...');
  }

  canvaSetTeeMasterPipelineUiBusy(true);
  canvaHelpers.switchTab?.('studio');

  try {
    const { savedCount, saveErrors, lastSavedId } = await canvaRunTeeMasterEditedCoreChunked(items, {
      skipPeel: true,
      stepLabels: CANVA_TEEMASTER_EDITED_STEP_LABELS,
      onProgress: (label) => {
        if (label) canvaSetLoading(true, label);
      }
    });

    if (savedCount > 0) {
      canvaSetPipelineUiPaused(false);
      canvaLibraryView = 'edited';
      canvaHighlightId = lastSavedId;
      canvaUpdateLibraryTabs();
      canvaRenderLibrary({ force: true });
      canvaRenderPreview();
      canvaUpdateButtons();
      if (canvaHighlightId) {
        canvaScrollToLibraryCard(canvaHighlightId);
        canvaScheduleHighlightClear(canvaHighlightId);
      }
      const msg = saveErrors.length
        ? `✅ حُفظت ${savedCount} نسخة معدّلة — فشل ${saveErrors.length}`
        : `✅ اكتملت معالجة ${savedCount} تصميم — راجع التصاميم المعدّلة`;
      canvaHelpers.showToast?.(msg);
      canvaSetMsg(msg, saveErrors.length ? 'warning' : 'success');
    } else {
      const errDetail = saveErrors.map((e) => e.error).filter(Boolean).join(' — ') || 'فشل حفظ النسخ المعدّلة';
      const errMsg = saveErrors.length === 1
        ? saveErrors[0].error
        : `فشل حفظ ${saveErrors.length} تصميم: ${errDetail}`;
      canvaHelpers.showToast?.(`❌ ${errMsg}`);
      canvaSetMsg(errMsg, 'error');
    }
  } catch (err) {
    const errMsg = err?.message || String(err);
    canvaHelpers.showToast?.(`❌ ${errMsg}`);
    canvaSetMsg(errMsg, 'error');
  } finally {
    canvaSetTeeMasterPipelineUiBusy(false);
    canvaSetPipelineUiPaused(false);
    canvaSetLoading(false);
    canvaHidePipelineProgress();
    canvaHelpers.switchTab?.('canva-bridge');
    if (libTeeMasterEdited) {
      canvaSetLibBtnLabel(libTeeMasterEdited, 'معالجة TeeMaster');
      canvaUpdateLibraryToolbar();
    }
  }
}

async function canvaStartTeeMasterFullPathPipeline() {
  if (canvaTeeMasterFullPathBusy || canvaTeeMasterPipelineBusy || canvaFullPipelineBusy) {
    canvaHelpers.showToast?.('⏳ مسار معالجة آخر يعمل بالفعل');
    return;
  }
  if (canvaLibraryView !== 'all') {
    canvaHelpers.showToast?.('⚠️ مسار TeeMaster متاح من تبويب التصاميم الأصلية فقط');
    return;
  }

  const ids = canvaResolveSmartRenameIds();
  if (!ids.length) {
    canvaHelpers.showToast?.('⚠️ لا توجد تصاميم في العرض الحالي');
    return;
  }

  const items = ids.map((id) => canvaFindLibraryItem(id)).filter(Boolean);
  if (!items.length) {
    canvaHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }
  if (items.length > CANVA_TEEMASTER_PIPELINE_MAX_DESIGNS) {
    canvaHelpers.showToast?.(`⚠️ الحد الأقصى ${CANVA_TEEMASTER_PIPELINE_MAX_DESIGNS} تصميم في مسار TeeMaster — حدّد عدداً أقل`);
    return;
  }

  if (!confirm(canvaBuildTeeMasterFullPathConfirmMessage(items.length))) return;

  const { libTeeMasterFullPath } = canvaEls();
  if (libTeeMasterFullPath) {
    libTeeMasterFullPath.disabled = true;
    canvaSetLibBtnLabel(libTeeMasterFullPath, 'جاري المسار...');
  }

  canvaTeeMasterFullPathCancelled = false;
  canvaSetTeeMasterFullPathUiBusy(true);
  canvaSetTeeMasterFullPathInProgress(true);
  canvaPipelineGlobalStart({
    id: 'teemaster-full-path',
    title: 'مسار TeeMaster',
    totalItems: items.length,
    stage: CANVA_TEEMASTER_FULL_PATH_STEP_LABELS[0]
  });

  let pipelineOk = false;
  let pipelineErr = '';
  const totalItems = items.length;

  try {
    await canvaEnsureStudioPeelReady();
    await canvaEnsureSeoModuleReady();
    await canvaClearSeoQueueBeforeTeeMasterPath(totalItems);

    const {
      savedIds: allSavedIds,
      savedCount,
      saveErrors: allSaveErrors,
      lastSavedId,
      savedItemsById: allSavedItemsById
    } = await canvaRunTeeMasterEditedCoreChunked(items, {
      skipPeel: true,
      stepLabels: CANVA_TEEMASTER_FULL_PATH_STEP_LABELS,
      cancelCheck: () => {
        if (canvaTeeMasterFullPathCancelled) throw new Error('تم إلغاء مسار TeeMaster');
      },
      onProgress: (label) => {
        if (label) {
          canvaSetLoading(true, label);
          canvaEmitProgressFromLabel(label);
        }
      }
    });
    if (savedCount === 0) {
      const errDetail = allSaveErrors.map((e) => e.error).filter(Boolean).join(' — ') || 'فشل حفظ النسخ المعدّلة';
      throw new Error(allSaveErrors.length === 1 ? allSaveErrors[0].error : errDetail);
    }

    if (typeof canvaHelpers.fetchLibrary === 'function') {
      await canvaHelpers.fetchLibrary();
    }
    if (allSavedItemsById.size && typeof canvaHelpers.upsertLibraryItems === 'function') {
      canvaHelpers.upsertLibraryItems([...allSavedItemsById.values()]);
    }

    if (allSaveErrors.length) {
      canvaHelpers.showToast?.(`⚠️ حُفظت ${savedCount} — فشل ${allSaveErrors.length} — يُكمل المسار للمحفوظة`);
    } else {
      canvaHelpers.showToast?.(`✅ حُفظت ${savedCount} تصميم في التصاميم المعدّلة — متابعة SEO...`);
    }

    canvaSetPipelineProgress(savedCount, totalItems, CANVA_TEEMASTER_FULL_PATH_STEP_LABELS[3]);
    const seoResult = await canvaSendEditedIdsToSeo(allSavedIds, true, allSavedItemsById);
    if (seoResult.errors?.length) {
      canvaHelpers.showToast?.(`⚠️ أُرسل ${seoResult.count} إلى SEO — فشل ${seoResult.errors.length}`);
    } else {
      canvaHelpers.showToast?.(`📚 أُضيف ${seoResult.count} تصميم إلى طابور SEO (مكتبة محلية)`);
    }

    const pendingSeo = canvaCountSeoQueuePending();
    if (!pendingSeo) {
      throw new Error(`طابور SEO فارغ بعد الإرسال (${savedCount} مُرسل) — أعد المحاولة من تبويب SEO`);
    }

    canvaSetPipelineProgress(savedCount, totalItems, CANVA_TEEMASTER_FULL_PATH_STEP_LABELS[4]);
    canvaHelpers.showToast?.(`🧠 بدء توليد SEO المحلي + الرفع عبر Autopilot لـ ${pendingSeo} تصميم...`);
    const seoAutResult = await canvaInvokeStudioSeoAutPipeline({
      includeAutopilot: true,
      localLibrarySeo: true,
      designCount: pendingSeo,
      totalSteps: CANVA_TEEMASTER_FULL_PATH_STEP_LABELS.length,
      onProgress: ({ label, done, total }) => {
        if (typeof done === 'number' && typeof total === 'number' && total > 0) {
          canvaSetPipelineProgress(done, total, label || 'Autopilot');
          canvaPipelineGlobalUpdate({
            stage: label || 'Autopilot',
            seoDone: done,
            seoTotal: total,
            phase: String(label || '').includes('SEO') ? 'seo' : 'autopilot'
          });
        } else if (label) {
          canvaSetLoading(true, label);
          canvaEmitProgressFromLabel(label, { phase: 'seo' });
        }
      },
      cancelCheck: () => {
        if (canvaTeeMasterFullPathCancelled) throw new Error('تم إلغاء مسار TeeMaster');
      }
    });

    if (!seoAutResult?.success) {
      pipelineErr = seoAutResult?.error || 'فشل توليد SEO أو Autopilot';
      canvaHelpers.showToast?.(`❌ ${pipelineErr}`);
      return;
    }

    pipelineOk = true;
    canvaSetPipelineUiPaused(false);
    canvaLibraryView = 'edited';
    canvaHighlightId = lastSavedId;
    canvaUpdateLibraryTabs();
    canvaRenderLibrary({ force: true });
    canvaRenderPreview();
    canvaUpdateButtons();
    if (canvaHighlightId) {
      canvaScrollToLibraryCard(canvaHighlightId);
      canvaScheduleHighlightClear(canvaHighlightId);
    }
  } catch (err) {
    if (!canvaTeeMasterFullPathCancelled) {
      pipelineErr = err?.message || String(err);
      canvaHelpers.showToast?.(`❌ ${pipelineErr}`);
      canvaSetMsg(pipelineErr, 'error');
    }
  } finally {
    canvaSetTeeMasterFullPathInProgress(false);
    canvaSetPipelineUiPaused(false);
    canvaHidePipelineProgress();
    canvaSetTeeMasterFullPathUiBusy(false);
    canvaSetLoading(false);
    if (libTeeMasterFullPath) {
      canvaSetLibBtnLabel(libTeeMasterFullPath, 'مسار TeeMaster');
      canvaUpdateLibraryToolbar();
    }
    if (canvaTeeMasterFullPathCancelled) {
      canvaPipelineGlobalEnd(false, 'تم إلغاء مسار TeeMaster');
      canvaHelpers.showToast?.('⏹️ تم إلغاء مسار TeeMaster');
    } else if (pipelineOk) {
      canvaPipelineGlobalEnd(true, 'اكتمل مسار TeeMaster → SEO → Autopilot');
      canvaHelpers.showToast?.('✅ اكتمل مسار TeeMaster → SEO → Autopilot');
      canvaSetMsg('✅ اكتمل مسار TeeMaster → SEO → Autopilot', 'success');
    } else if (pipelineErr) {
      canvaPipelineGlobalEnd(false, pipelineErr);
    } else {
      canvaPipelineGlobalEnd(false, 'توقّف مسار TeeMaster');
    }
  }
}

async function canvaSendSelectedToSeo() {
  const ids = canvaLibrarySelected.size > 0
    ? [...canvaLibrarySelected]
    : (canvaState.selectedItem?.id ? [canvaState.selectedItem.id] : []);
  if (!ids.length) {
    canvaHelpers.showToast?.('⚠️ حدّد تصميماً واحداً على الأقل');
    return;
  }
  const onEditedTab = canvaLibraryView === 'edited';
  const eligible = canvaResolveSeoEligibleIds(ids);
  const skipped = ids.length - eligible.length;
  if (!eligible.length) {
    canvaHelpers.showToast?.(onEditedTab
      ? '⚠️ اختر تصاميم معدّلة من هذا التبويب'
      : '⚠️ اختر تصاميم أصلية من مكتبة التصاميم');
    return;
  }
  if (skipped > 0) {
    canvaHelpers.showToast?.(onEditedTab
      ? `⚠️ تم تخطي ${skipped} تصميم غير معدّل`
      : `⚠️ تم تخطي ${skipped} تصميم معدّل — يُرسل الأصل فقط`);
  }
  await canvaSendToSeo(false, eligible);
}

function canvaResetCanvaDesignState() {
  canvaState.assetId = null;
  canvaState.canvaDesignId = null;
  canvaState.uploadedLibraryId = null;
  canvaState.editUrl = null;
  canvaState.importPath = null;
  canvaState.popupWindowId = null;
  canvaState.popupTabId = null;
}

function canvaSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canvaGetBatchContext(libraryId) {
  if (!libraryId) return null;
  return canvaBatchDesignContexts.get(libraryId) || null;
}

function canvaGetBlankContext(designId) {
  const id = String(designId || canvaState.canvaDesignId || '').trim();
  if (!id) return null;
  return canvaBatchDesignContexts.get(canvaBlankContextKey(id)) || null;
}

function canvaIsBlankActive() {
  return !!(canvaState.activeBlankCanva?.designId || canvaState.activeBlankCanva?.canvaDesignId);
}

function canvaClearBlankCanvaState(designId = '') {
  const id = String(designId || canvaState.activeBlankCanva?.designId || canvaState.canvaDesignId || '').trim();
  if (id) canvaBatchDesignContexts.delete(canvaBlankContextKey(id));
  canvaState.activeBlankCanva = null;
}

function canvaResolveImportContext() {
  const item = canvaState.selectedItem;
  if (item) {
    const batchCtx = canvaGetBatchContext(item.id);
    const designId = String(
      batchCtx?.canvaDesignId || canvaState.canvaDesignId || ''
    ).trim();
    if (!designId) return null;
    return {
      libraryId: item.id,
      canvaDesignId: designId,
      sessionId: batchCtx?.sessionId || canvaState.sessionId,
      promptPreview: item.promptPreview,
      title: item.displayName || item.promptPreview || '',
      blank: false,
      batchCtx
    };
  }

  const blank = canvaState.activeBlankCanva;
  if (blank) {
    const designId = String(blank.designId || blank.canvaDesignId || canvaState.canvaDesignId || '').trim();
    if (!designId) return null;
    const batchCtx = canvaGetBlankContext(designId) || blank;
    const linkedId = String(blank.libraryId || batchCtx?.libraryId || '').trim();
    const linkToLibrary = !!(blank.linkToLibrary || batchCtx?.linkToLibrary) && linkedId;
    if (linkToLibrary) {
      const linkedItem = canvaFindLibraryItem(linkedId);
      return {
        libraryId: linkedId,
        canvaDesignId: designId,
        sessionId: blank.sessionId || batchCtx?.sessionId || canvaState.sessionId,
        promptPreview: linkedItem?.promptPreview || blank.title || 'NHP Blank 5000×5000',
        title: linkedItem?.displayName || linkedItem?.promptPreview || blank.title || 'NHP Blank 5000×5000',
        blank: false,
        batchCtx
      };
    }
    return {
      libraryId: null,
      canvaDesignId: designId,
      sessionId: blank.sessionId || batchCtx?.sessionId || canvaState.sessionId,
      promptPreview: blank.title || 'NHP Blank 5000×5000',
      title: blank.title || 'NHP Blank 5000×5000',
      blank: true,
      batchCtx
    };
  }

  const fallbackDesignId = String(canvaState.canvaDesignId || '').trim();
  const fallbackCtx = canvaGetBlankContext(fallbackDesignId);
  if (fallbackCtx?.blankCanvas || fallbackCtx?.blank) {
    const linkedId = String(fallbackCtx.libraryId || '').trim();
    const linkToLibrary = !!fallbackCtx.linkToLibrary && linkedId;
    if (linkToLibrary) {
      const linkedItem = canvaFindLibraryItem(linkedId);
      return {
        libraryId: linkedId,
        canvaDesignId: fallbackDesignId,
        sessionId: fallbackCtx.sessionId || canvaState.sessionId,
        promptPreview: linkedItem?.promptPreview || fallbackCtx.title || 'NHP Blank 5000×5000',
        title: linkedItem?.displayName || linkedItem?.promptPreview || fallbackCtx.title || 'NHP Blank 5000×5000',
        blank: false,
        batchCtx: fallbackCtx
      };
    }
    return {
      libraryId: null,
      canvaDesignId: fallbackDesignId,
      sessionId: fallbackCtx.sessionId || canvaState.sessionId,
      promptPreview: fallbackCtx.title || 'NHP Blank 5000×5000',
      title: fallbackCtx.title || 'NHP Blank 5000×5000',
      blank: true,
      batchCtx: fallbackCtx
    };
  }

  return null;
}

function canvaApplyDesignContext(ctx) {
  if (!ctx) return;
  if (ctx.sessionId) canvaState.sessionId = ctx.sessionId;
  canvaState.assetId = ctx.assetId ?? canvaState.assetId;
  canvaState.canvaDesignId = ctx.canvaDesignId ?? null;
  canvaState.uploadedLibraryId = ctx.libraryId ?? canvaState.uploadedLibraryId;
  canvaState.editUrl = ctx.editUrl ?? canvaState.editUrl;
  canvaState.popupWindowId = ctx.windowId ?? null;
  canvaState.popupTabId = ctx.tabId ?? null;
}

function canvaResolveSendOpenTargets() {
  if (canvaLibrarySelected.size > 1) {
    return {
      mode: 'batch',
      items: [...canvaLibrarySelected]
        .map((id) => canvaFindLibraryItem(id))
        .filter(Boolean)
    };
  }
  const item = canvaState.selectedItem;
  return item ? { mode: 'single', items: [item] } : { mode: 'single', items: [] };
}

function canvaNeedsUploadForItem(item, ctx = null) {
  if (!item) return true;
  if (ctx?.canvaDesignId) return false;
  if (canvaState.uploadedLibraryId === item.id && canvaState.canvaDesignId) return false;
  return true;
}

function canvaSelectActiveItem(item) {
  if (canvaState.selectedItem?.id !== item?.id) {
    canvaClearBlankCanvaState();
    const batchCtx = canvaGetBatchContext(item?.id);
    if (batchCtx) {
      canvaResetCanvaDesignState();
      canvaApplyDesignContext(batchCtx);
    } else {
      canvaResetCanvaDesignState();
    }
  }
  canvaState.selectedItem = item;
  canvaRenderLibrary();
  canvaRenderPreview();
  if (canvaState.connected) canvaSetStep(canvaState.canvaDesignId ? 'opened' : 'selected');
  canvaUpdateButtons();
  canvaClaimKeyboardFocus();
}

async function canvaDeleteLibraryOne(id, { skipConfirm = false } = {}) {
  if (!id) return;
  if (!skipConfirm && !confirm('حذف هذا التصميم من المكتبة؟')) return;

  const itemsBefore = canvaPreviewItems();
  const currentIdx = itemsBefore.findIndex((it) => it.id === id);
  const nextIndex = currentIdx >= 0 && itemsBefore.length > 1
    ? Math.min(currentIdx, itemsBefore.length - 2)
    : -1;

  canvaSetLoading(true, 'جاري الحذف...');
  try {
    const res = await fetch(canvaHelpers.ghostUrl(`/api/library/${encodeURIComponent(id)}`), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(canvaHumanizeLibraryError(data?.error || data?.message || 'فشل الحذف'));
    if (!data?.success) {
      throw new Error(canvaHumanizeLibraryError(data?.error || data?.message || 'فشل الحذف'));
    }
    canvaRemoveLibrarySelection(id);
    if (typeof canvaHelpers.fetchLibrary === 'function') await canvaHelpers.fetchLibrary();
    canvaRenderLibrary();

    const itemsAfter = canvaPreviewItems();
    if (nextIndex >= 0 && itemsAfter.length) {
      const pick = itemsAfter[Math.min(nextIndex, itemsAfter.length - 1)];
      if (pick) canvaSelectActiveItem(pick);
    }

    canvaSetMsg('تم حذف التصميم.', 'success');
    canvaHelpers.showToast?.('تم حذف التصميم');
  } catch (err) {
    const msg = canvaHumanizeLibraryError(err);
    canvaSetMsg(msg, 'error');
    canvaHelpers.showToast?.(`⚠️ ${msg}`);
  } finally {
    canvaSetLoading(false);
  }
}

async function canvaDeleteLibrarySelected({ skipConfirm = false } = {}) {
  const ids = [...canvaLibrarySelected];
  if (!ids.length) return;
  if (!skipConfirm && !confirm(`حذف ${ids.length} تصميم؟`)) return;
  canvaSetLoading(true, 'جاري حذف المحدد...');
  try {
    const res = await fetch(canvaHelpers.ghostUrl('/api/library/bulk'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || 'فشل الحذف');
    const removedIds = data.deleted?.length ? data.deleted : (data.success ? ids : []);
    if (!data.success && !data.partial) throw new Error(data?.error || data?.message || 'فشل الحذف');
    if (removedIds.length) canvaRemoveLibrarySelection(removedIds);
    if (typeof canvaHelpers.fetchLibrary === 'function') await canvaHelpers.fetchLibrary();
    canvaRenderLibrary();
    const toastMsg = data.message || `تم حذف ${data.count || removedIds.length} تصميم.`;
    canvaSetMsg(toastMsg, data.partial && !data.success ? 'warning' : 'success');
    canvaHelpers.showToast?.(data.partial ? `⚠️ ${toastMsg}` : toastMsg);
  } catch (err) {
    const msg = canvaHumanizeLibraryError(err);
    canvaSetMsg(msg, 'error');
    canvaHelpers.showToast?.(`⚠️ ${msg}`);
  } finally {
    canvaSetLoading(false);
  }
}

async function canvaUploadLibraryFiles(fileList) {
  const files = [...(fileList || [])].filter((f) => f && /^image\/(png|jpeg|webp)$/i.test(f.type));
  if (!files.length) {
    canvaSetMsg('اختر ملفات PNG أو JPEG أو WebP فقط.', 'warning');
    return;
  }
  canvaSetLoading(true, `جاري رفع ${files.length} صورة...`);
  try {
    const form = new FormData();
    files.forEach((file) => form.append('image', file, file.name));
    const data = await canvaPostLibraryUpload(form);
    if (typeof canvaHelpers.fetchLibrary === 'function') await canvaHelpers.fetchLibrary();
    canvaRenderLibrary();
    canvaSetMsg(`تمت إضافة ${data.count || files.length} تصميم إلى المكتبة.`, 'success');
    canvaHelpers.showToast?.(`✅ تم رفع ${data.count || files.length} صورة`);
  } catch (err) {
    canvaSetMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
  } finally {
    canvaSetLoading(false);
  }
}

function canvaBindLibraryDragDrop() {
  const { libraryWrap } = canvaEls();
  if (!libraryWrap || libraryWrap.dataset.dndBound === '1') return;
  libraryWrap.dataset.dndBound = '1';

  const showDrop = (on) => {
    libraryWrap.classList.toggle('is-dragover', on);
  };

  libraryWrap.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    canvaLibraryDragDepth += 1;
    showDrop(true);
  });
  libraryWrap.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    showDrop(true);
  });
  libraryWrap.addEventListener('dragleave', () => {
    canvaLibraryDragDepth = Math.max(0, canvaLibraryDragDepth - 1);
    if (canvaLibraryDragDepth === 0) showDrop(false);
  });
  libraryWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    canvaLibraryDragDepth = 0;
    showDrop(false);
    const files = e.dataTransfer?.files;
    if (files?.length) void canvaUploadLibraryFiles(files);
  });
}

function canvaCreateLibraryCard(item, originalsWithEdits, { lazyThumb = false } = {}) {
  const card = document.createElement('article');
  card.className = 'canva-bridge-lib-card'
    + (canvaState.selectedItem?.id === item.id ? ' is-selected' : '')
    + (canvaLibrarySelected.has(item.id) ? ' is-multi-selected' : '')
    + (canvaHighlightId === item.id ? ' is-highlight' : '')
    + (canvaLibraryBrokenIds.has(item.id) ? ' is-broken' : '');
  card.title = canvaLibraryBrokenIds.has(item.id)
    ? canvaBrokenIssueTooltip(item.id)
    : (item.promptPreview || item.displayName || item.id);
  card.dataset.libId = item.id;

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.className = 'canva-bridge-lib-chk';
  chk.checked = canvaLibrarySelected.has(item.id);
  chk.setAttribute('aria-label', 'تحديد للحذف الجماعي');
  chk.addEventListener('mousedown', (e) => e.stopPropagation());
  chk.addEventListener('click', (e) => e.stopPropagation());
  chk.addEventListener('change', (e) => {
    e.stopPropagation();
    if (chk.checked) canvaLibrarySelected.add(item.id);
    else canvaLibrarySelected.delete(item.id);
    card.classList.toggle('is-multi-selected', chk.checked);
    canvaUpdateLibraryToolbar();
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'canva-bridge-lib-delete';
  delBtn.title = 'حذف';
  delBtn.setAttribute('aria-label', 'حذف التصميم');
  delBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void canvaDeleteLibraryOne(item.id);
  });

  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'canva-bridge-lib-download';
  dlBtn.title = 'تحميل';
  dlBtn.setAttribute('aria-label', 'تحميل التصميم');
  dlBtn.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';
  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void canvaDownloadLibraryItem(item);
  });

  const thumb = document.createElement('div');
  thumb.className = 'canva-bridge-lib-card-thumb'
    + (canvaIsEditedDesign(item) ? ' nhp-transparency-bg' : '');

  const img = document.createElement('img');
  img.alt = card.title;
  canvaBindLibraryGridThumb(img, item, { lazy: lazyThumb });

  if (canvaLibraryView !== 'edited' && originalsWithEdits
    && canvaOriginalHasEditedVersion(item, originalsWithEdits)) {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'canva-bridge-lib-edited-badge';
    badge.title = 'نسخة معدّلة في مكتبة التصاميم المعدّلة';
    badge.setAttribute('aria-label', badge.title);
    badge.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span>معدّل</span>';
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      canvaNavigateToEditedForOriginal(item.id);
    });
    thumb.appendChild(badge);
  }

  thumb.appendChild(chk);
  thumb.appendChild(img);
  thumb.appendChild(dlBtn);
  thumb.appendChild(delBtn);

  const blankBtn = document.createElement('button');
  blankBtn.type = 'button';
  blankBtn.className = 'canva-bridge-lib-blank-btn';
  blankBtn.textContent = 'canva 5000';
  blankBtn.title = 'إرسال التصميم وفتحه في Canva 5000×5000';
  blankBtn.setAttribute('aria-label', blankBtn.title);
  blankBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void canvaSendAndOpen5000(item, blankBtn);
  });

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'canva-bridge-lib-rename-btn';
  renameBtn.title = 'تسمية هذا التصميم بالذكاء الاصطناعي';
  renameBtn.setAttribute('aria-label', renameBtn.title);
  renameBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> تسمية';
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void canvaSmartRenameLibrary([item.id]);
  });

  const cardFooter = document.createElement('div');
  cardFooter.className = 'canva-bridge-lib-card-footer';
  cardFooter.appendChild(blankBtn);
  cardFooter.appendChild(renameBtn);

  card.appendChild(thumb);
  card.appendChild(cardFooter);
  card.addEventListener('click', (e) => {
    if (e.target.closest('.canva-bridge-lib-chk, .canva-bridge-lib-delete, .canva-bridge-lib-download, .canva-bridge-lib-edited-badge, .canva-bridge-lib-blank-btn, .canva-bridge-lib-rename-btn')) return;
    if (e.ctrlKey || e.metaKey) {
      const wasSelected = canvaLibrarySelected.has(item.id);
      if (wasSelected) canvaLibrarySelected.delete(item.id);
      else canvaLibrarySelected.add(item.id);
      card.classList.toggle('is-multi-selected', !wasSelected);
      chk.checked = !wasSelected;
      canvaUpdateLibraryToolbar();
      return;
    }
    canvaSelectActiveItem(item);
  });
  return card;
}

function canvaAppendLibrarySentinel(library, total) {
  library.querySelector('.canva-bridge-lib-sentinel')?.remove();
  const sentinel = document.createElement('button');
  sentinel.type = 'button';
  sentinel.className = 'canva-bridge-lib-sentinel';
  sentinel.textContent = `تحميل المزيد (${canvaLibraryRendered}/${total})`;
  sentinel.addEventListener('click', () => {
    canvaRenderLibrary({ reset: false, force: true, immediate: true });
  });
  library.appendChild(sentinel);

  canvaLibraryLoadObserver?.disconnect();
  canvaLibraryLoadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((en) => en.isIntersecting)) return;
    canvaLibraryLoadObserver?.disconnect();
    canvaLibraryLoadObserver = null;
    canvaRenderLibrary({ reset: false, force: true, immediate: true });
  }, { root: library, rootMargin: '80px', threshold: 0.1 });
  canvaLibraryLoadObserver.observe(sentinel);
}

function canvaRenderLibrary(options = {}) {
  const { library } = canvaEls();
  if (!library) return;

  if (canvaIsPipelineUiPaused() && options.force && options.immediate !== true) {
    canvaScheduleLibraryRender(options);
    return;
  }

  const force = options.force === true;
  if (!force && canvaIsPipelineUiPaused()) {
    canvaUpdateLibraryTabs();
    canvaUpdateLibraryToolbar();
    return;
  }

  if (!canvaLibraryGridActive) {
    canvaUpdateLibraryTabs();
    canvaUpdateLibraryToolbar();
    return;
  }

  const items = canvaFilteredLibraryItems();
  canvaUpdateLibraryTabs();
  canvaUpdateLibraryToolbar();

  const perf = canvaLibraryUsesPerfMode(items.length);
  const reset = options.reset !== false;

  if (!items.length) {
    canvaDestroyLibraryGridObservers();
    library.querySelectorAll('.canva-bridge-lib-card-img').forEach(canvaRevokeLibraryThumbBlob);
    library.innerHTML = canvaLibraryView === 'edited'
      ? '<p class="canva-bridge-empty">لا توجد تصاميم معدّلة بعد — عدّل عبر Canva أو استخدم معالجة TeeMaster من مكتبة التصاميم.</p>'
      : '<p class="canva-bridge-empty">لا توجد تصاميم في المكتبة — ولّد من المحادثة أو أضف صوراً من الحاسوب.</p>';
    canvaLibraryRendered = 0;
    return;
  }

  const originalsWithEdits = canvaLibraryView !== 'edited'
    ? canvaGetEditedVersionIndex().originalsWithEdits
    : null;

  if (reset) {
    canvaInvalidateEditedVersionIndex();
    canvaDestroyLibraryGridObservers();
    library.querySelectorAll('.canva-bridge-lib-card-img').forEach(canvaRevokeLibraryThumbBlob);
    library.innerHTML = '';
    canvaLibraryRendered = 0;
  }

  const pageSize = perf ? CANVA_LIBRARY_PAGE_SIZE : items.length;
  const slice = items.slice(canvaLibraryRendered, canvaLibraryRendered + pageSize);
  slice.forEach((item) => {
    library.appendChild(canvaCreateLibraryCard(item, originalsWithEdits, { lazyThumb: perf }));
  });
  canvaLibraryRendered += slice.length;

  if (perf && canvaLibraryRendered < items.length) {
    canvaAppendLibrarySentinel(library, items.length);
  } else {
    library.querySelector('.canva-bridge-lib-sentinel')?.remove();
  }
}

function canvaEnsurePreviewZoom() {
  if (canvaPreviewZoomCtrl) return canvaPreviewZoomCtrl;
  const els = canvaEls();
  canvaPreviewZoomCtrl = createLightboxZoom({
    viewport: els.previewViewport,
    img: els.previewImg,
    zoomInBtn: els.previewZoomIn,
    zoomOutBtn: els.previewZoomOut,
    zoomResetBtn: els.previewZoomReset,
    zoomLevelEl: els.previewZoomLevel
  });
  canvaPreviewZoomCtrl.bind();
  return canvaPreviewZoomCtrl;
}

function canvaPreviewGo(delta, { scroll = false } = {}) {
  const items = canvaPreviewItems();
  if (!items.length) return;
  const currentIdx = canvaPreviewIndexForItem(canvaState.selectedItem);
  const base = currentIdx >= 0 ? currentIdx : 0;
  const next = Math.max(0, Math.min(items.length - 1, base + delta));
  if (next === currentIdx) return;
  const item = items[next];
  canvaSelectActiveItem(item);
  if (scroll && item?.id) canvaScrollToLibraryCard(item.id);
}

function canvaBindKeyboardNav() {
  if (canvaKeyboardNavBound) return;
  canvaKeyboardNavBound = true;
  document.addEventListener('keydown', (e) => {
    if (!canvaIsBridgePanelActive()) return;
    if (canvaKeyboardNavBlocked()) {
      resetCanvaEnterDelete();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!canvaCanPreviewDelete()) {
        resetCanvaEnterDelete();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (canvaLastEnterAt && (now - canvaLastEnterAt) <= CANVA_DOUBLE_ENTER_MS) {
        resetCanvaEnterDelete();
        canvaExecutePreviewKeyboardDelete();
        return;
      }
      canvaLastEnterAt = now;
      if (canvaEnterDeleteTimer) clearTimeout(canvaEnterDeleteTimer);
      canvaEnterDeleteTimer = setTimeout(resetCanvaEnterDelete, CANVA_DOUBLE_ENTER_MS);
      canvaHelpers.showToast?.('اضغط Enter مرة أخرى للحذف', 1500);
      return;
    }

    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      resetCanvaEnterDelete();
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      canvaPreviewGo(-1, { scroll: true });
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      canvaPreviewGo(1, { scroll: true });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      canvaPreviewGo(-canvaLibraryGridColumns(), { scroll: true });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      canvaPreviewGo(canvaLibraryGridColumns(), { scroll: true });
    }
  });
}

async function canvaPreviewDownload() {
  const item = canvaState.selectedItem;
  if (!item) return;
  canvaSetLoading(true, 'جاري التحميل...');
  try {
    await canvaDownloadLibraryItem(item, { quiet: false });
  } finally {
    canvaSetLoading(false);
  }
}

function canvaBindPreviewToolbar() {
  const els = canvaEls();
  if (els.previewViewer?.dataset.toolbarBound === '1') return;
  if (els.previewViewer) els.previewViewer.dataset.toolbarBound = '1';

  canvaEnsurePreviewZoom();

  els.previewPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    canvaPreviewGo(-1);
  });
  els.previewNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    canvaPreviewGo(1);
  });
  els.previewDl?.addEventListener('click', (e) => {
    e.stopPropagation();
    void canvaPreviewDownload();
  });
  els.previewDel?.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = canvaState.selectedItem?.id;
    if (id) void canvaDeleteLibraryOne(id);
  });
  els.previewSendOpen?.addEventListener('click', (e) => {
    e.stopPropagation();
    void canvaSendAndOpen();
  });
  els.previewSeo?.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = canvaState.selectedItem?.id;
    if (!id) {
      canvaHelpers.showToast?.('⚠️ اختر تصميماً من المكتبة أولاً');
      return;
    }
    void canvaSendToSeo(false, [id]);
  });
  els.previewAutoRename?.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = canvaState.selectedItem?.id;
    if (id) void canvaSmartRenameLibrary([id]);
  });
}

function canvaResolvePreviewBadge() {
  if (!canvaState.selectedItem) return { show: false, text: '', title: '' };
  if (canvaState.savedLibraryId) {
    return { show: true, text: 'Canva Edited', title: 'تم الحفظ كإصدار جديد من Canva' };
  }
  if (canvaState.importPath) {
    return { show: true, text: 'Canva Edited', title: 'تم الاستيراد من Canva — لم يُحفظ بعد' };
  }
  if (canvaState.canvaDesignId && canvaState.uploadedLibraryId === canvaState.selectedItem?.id) {
    return { show: true, text: 'في Canva', title: 'التصميم مرفوع إلى Canva' };
  }
  const versionLabel = canvaState.selectedItem?.versionLabel
    || canvaState.selectedItem?.meta?.versionLabel;
  if (versionLabel) {
    return { show: true, text: versionLabel, title: versionLabel };
  }
  return { show: false, text: '', title: '' };
}

function canvaRenderPreview() {
  const els = canvaEls();
  const item = canvaState.selectedItem;
  const items = canvaPreviewItems();
  const previewUrls = item ? canvaLibraryImageFallbackUrls(item) : [];
  const showItem = previewUrls.length > 0;
  const idx = canvaPreviewIndexForItem(item);
  const multi = items.length > 1;
  const busy = canvaState.busy;
  const connected = canvaState.connected;

  const showTransparencyBg = showItem && canvaIsEditedDesign(item);

  if (els.previewViewer) els.previewViewer.classList.toggle('is-empty', !showItem);
  if (els.previewMeta) els.previewMeta.classList.toggle('is-empty', !showItem);
  if (els.previewViewport) {
    els.previewViewport.classList.toggle('nhp-transparency-bg', showTransparencyBg);
  }
  if (els.previewStage) {
    els.previewStage.classList.toggle('nhp-transparency-bg', showTransparencyBg);
  }

  if (els.previewImg) {
    if (showItem) {
      const fallbacks = canvaLibraryImageFallbackUrls(item);
      const src = fallbacks[0] || '';
      if (els.previewImg.getAttribute('src') !== src) {
        canvaPreviewZoomCtrl?.reset();
        canvaBindLibraryPreviewImg(els.previewImg, item);
      }
      els.previewImg.alt = item.promptPreview || item.displayName || 'معاينة التصميم';
      els.previewImg.hidden = false;
    } else {
      canvaPreviewZoomCtrl?.reset();
      els.previewImg.removeAttribute('src');
      els.previewImg.alt = '';
      els.previewImg.hidden = true;
    }
  }

  const fileName = showItem
    ? (item.fileName || item.displayName || item.promptPreview || item.id)
    : '—';
  const designLabel = showItem
    ? (item.promptPreview || item.displayName || item.id)
    : 'اختر تصميماً من المكتبة';

  if (els.previewFilename) els.previewFilename.textContent = fileName;
  if (els.previewLabel) els.previewLabel.textContent = designLabel;

  if (els.previewNameRow) els.previewNameRow.classList.toggle('is-hidden', !showItem);
  if (els.previewNameInput && showItem) {
    if (document.activeElement !== els.previewNameInput || els.previewNameInput.dataset.itemId !== item.id) {
      els.previewNameInput.dataset.itemId = item.id;
      els.previewNameInput.value = item.displayName || item.fileName || '';
    }
    els.previewNameInput.disabled = busy;
  } else if (els.previewNameInput) {
    els.previewNameInput.dataset.itemId = '';
    els.previewNameInput.value = '';
  }
  if (els.previewNameNotes) els.previewNameNotes.disabled = !showItem || busy || canvaRenameInFlight;

  const badge = canvaResolvePreviewBadge();
  if (els.previewBadgeLine) els.previewBadgeLine.classList.toggle('is-hidden', !badge.show);
  if (els.previewBadge) {
    els.previewBadge.textContent = badge.text;
    els.previewBadge.title = badge.title;
  }

  if (els.previewPrev) {
    els.previewPrev.classList.toggle('is-hidden', !multi || !showItem);
    els.previewPrev.disabled = !showItem || idx <= 0;
  }
  if (els.previewNext) {
    els.previewNext.classList.toggle('is-hidden', !multi || !showItem);
    els.previewNext.disabled = !showItem || idx < 0 || idx >= items.length - 1;
  }
  if (els.previewCounter) {
    els.previewCounter.classList.toggle('is-hidden', !multi || !showItem);
    if (showItem && idx >= 0) {
      els.previewCounter.setAttribute('dir', 'ltr');
      els.previewCounter.textContent = `${idx + 1} / ${items.length}`;
    } else {
      els.previewCounter.textContent = '';
    }
  }

  const hasItem = !!item;
  const hasSendOpen = hasItem || canvaLibrarySelected.size > 0;
  if (els.previewDl) els.previewDl.disabled = !hasItem || busy;
  if (els.previewDel) els.previewDel.disabled = !hasItem || busy;
  if (els.previewAutoRename) els.previewAutoRename.disabled = !hasItem || busy || canvaRenameInFlight;
  if (els.previewSendOpen) els.previewSendOpen.disabled = busy || !connected || !hasSendOpen;
  if (els.previewSeo) {
    const seoEligible = canvaIsPreviewSeoEligible();
    els.previewSeo.classList.toggle('is-hidden', !seoEligible);
    els.previewSeo.disabled = busy || !seoEligible;
    els.previewSeo.hidden = !seoEligible;
  }
}

async function canvaRefreshLibrary() {
  canvaSetLoading(true, 'Refreshing library...');
  try {
    if (typeof canvaHelpers.fetchLibrary === 'function') {
      await canvaHelpers.fetchLibrary();
    }
    canvaRenderLibrary();
    canvaSetMsg('Library refreshed.', 'success');
  } catch (err) {
    canvaSetMsg(err.message, 'error');
  } finally {
    canvaSetLoading(false);
  }
}

function canvaNeedsUploadForSelection(item) {
  return canvaNeedsUploadForItem(item, canvaGetBatchContext(item?.id));
}

async function canvaCloseEditPopup(ctx = null) {
  if (canvaState.mockMode) return { closed: false, skipped: 'mock' };
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return { closed: false };
  const designId = ctx?.canvaDesignId || canvaState.canvaDesignId;
  const editUrl = ctx?.editUrl || canvaState.editUrl;
  const libraryId = ctx?.libraryId || canvaState.uploadedLibraryId || canvaState.selectedItem?.id;
  const windowId = ctx?.windowId ?? canvaState.popupWindowId;
  const tabId = ctx?.tabId ?? canvaState.popupTabId;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'CANVA_CLOSE_POPUP',
      mockMode: canvaState.mockMode,
      designId,
      editUrl,
      libraryId,
      windowId,
      tabId
    }, (res) => {
      if (!ctx || ctx.libraryId === canvaState.uploadedLibraryId) {
        canvaState.popupWindowId = null;
        canvaState.popupTabId = null;
      }
      if (libraryId) {
        canvaBatchDesignContexts.delete(libraryId);
      } else if (designId && (ctx?.blank || ctx?.blankCanvas || canvaIsBlankActive())) {
        canvaBatchDesignContexts.delete(canvaBlankContextKey(designId));
      }
      resolve(res || { closed: false });
    });
  });
}

async function canvaOpenDesignPopupFor({
  sessionId,
  designId,
  editUrl,
  libraryId = '',
  focus = true,
  batchMode = false,
  quiet = false,
  blank = false,
  title = ''
} = {}) {
  const activeSessionId = sessionId || canvaState.sessionId;
  const activeDesignId = designId || canvaState.canvaDesignId;
  if (!activeDesignId && !activeSessionId) {
    throw new Error('معرّف تصميم Canva غير متوفر');
  }
  const data = await canvaApi('/api/canva/open-design', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: activeSessionId,
      designId: activeDesignId
    })
  });
  const resolvedDesignId = data.designId || activeDesignId;
  const resolvedEditUrl = data.editUrl || editUrl || `https://www.canva.com/design/${resolvedDesignId}/edit`;
  const url = resolvedEditUrl;
  const isBlankOpen = !!(blank || (!String(libraryId || '').trim() && resolvedDesignId));
  const resolvedTitle = String(title || (isBlankOpen ? 'NHP Blank 5000×5000' : '')).trim();
  let windowId = null;
  let tabId = null;

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'CANVA_OPEN_POPUP',
        url,
        width: 1280,
        height: 900,
        focus,
        libraryId,
        designId: resolvedDesignId,
        batchMode,
        blank: isBlankOpen,
        title: isBlankOpen ? resolvedTitle : ''
      }, (res) => {
        if (res?.success) {
          windowId = res.windowId ?? null;
          tabId = res.tabId ?? null;
          if (!quiet) {
            if (res.fallback) {
              canvaSetMsg('تم فتح Canva في تبويب — عدّل التصميم ثم استورده.', 'warning');
            } else {
              canvaSetMsg('تم فتح Canva في نافذة منبثقة — عدّل التصميم ثم استورده.', 'success');
            }
          }
        } else if (res?.tabId) {
          tabId = res.tabId;
          if (!quiet) {
            canvaSetMsg('تم فتح Canva في تبويب — عدّل التصميم ثم استورده.', 'success');
          }
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
          if (!quiet) {
            canvaSetMsg('تم فتح Canva في المتصفح.', 'warning');
          }
        }
        resolve();
      });
    });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
    if (!quiet) {
      canvaSetMsg('تم فتح Canva في المتصفح.', 'warning');
    }
  }

  return {
    designId: resolvedDesignId,
    editUrl: resolvedEditUrl,
    windowId,
    tabId
  };
}

async function canvaOpenDesignPopup() {
  const openResult = await canvaOpenDesignPopupFor({
    sessionId: canvaState.sessionId,
    designId: canvaState.canvaDesignId,
    editUrl: canvaState.editUrl,
    libraryId: canvaState.uploadedLibraryId || canvaState.selectedItem?.id || '',
    focus: true,
    batchMode: false
  });
  canvaState.editUrl = openResult.editUrl;
  canvaState.canvaDesignId = openResult.designId;
  canvaState.popupWindowId = openResult.windowId;
  canvaState.popupTabId = openResult.tabId;
  canvaSetStep('opened');
}

async function canvaSendAndOpenOne(item, {
  index = 0,
  total = 1,
  staggerOpen = false,
  focusLast = true,
  batchMode = false
} = {}) {
  if (!item) throw new Error('لم يتم اختيار تصميم');

  const existingCtx = canvaGetBatchContext(item.id);
  let sessionId = existingCtx?.sessionId || canvaState.sessionId;
  let assetId = existingCtx?.assetId || null;
  let canvaDesignId = existingCtx?.canvaDesignId || null;
  let editUrl = existingCtx?.editUrl || null;
  const needsUpload = canvaNeedsUploadForItem(item, existingCtx);

  if (needsUpload) {
    canvaSetLoading(true, total > 1 ? `جاري الرفع ${index + 1}/${total}...` : 'جاري الرفع إلى Canva...');
    const sendRef = canvaResolveSendLibraryRef(item);
    let up;
    try {
      up = await canvaApi('/api/canva/upload-design', {
        method: 'POST',
        body: JSON.stringify({
          libraryId: sendRef.libraryId,
          fileName: sendRef.fileName,
          sessionId,
          title: item.displayName || item.promptPreview || 'NHP Design'
        })
      });
      sessionId = up.sessionId;
      assetId = up.assetId;
      if (!batchMode) canvaSetStep('uploaded');
    } catch (err) {
      throw new Error(canvaSendOpenStepError('upload', err));
    }

    canvaSetLoading(true, total > 1 ? `جاري الإنشاء ${index + 1}/${total}...` : 'جاري إنشاء التصميم في Canva...');
    try {
      const created = await canvaApi('/api/canva/create-design', {
        method: 'POST',
        body: JSON.stringify({ sessionId, assetId })
      });
      canvaDesignId = created.designId;
      editUrl = created.editUrl;
    } catch (err) {
      throw new Error(canvaSendOpenStepError('create', err));
    }
  }

  if (staggerOpen && index > 0) {
    await canvaSleep(CANVA_BATCH_STAGGER_MS);
  }

  canvaSetLoading(true, total > 1 ? `جاري فتح ${index + 1}/${total}...` : 'جاري فتح Canva...');
  try {
    const openResult = await canvaOpenDesignPopupFor({
      sessionId,
      designId: canvaDesignId,
      editUrl,
      libraryId: item.id,
      focus: !batchMode || (focusLast && index === total - 1),
      batchMode,
      quiet: batchMode
    });
    canvaDesignId = openResult.designId;
    editUrl = openResult.editUrl;

    const ctx = {
      libraryId: item.id,
      sessionId,
      assetId,
      canvaDesignId,
      editUrl,
      windowId: openResult.windowId,
      tabId: openResult.tabId
    };
    canvaBatchDesignContexts.set(item.id, ctx);
    return ctx;
  } catch (err) {
    throw new Error(canvaSendOpenStepError('open', err));
  }
}

function canvaSendOpenStepError(step, err) {
  const labels = {
    upload: 'فشل الرفع إلى Canva',
    create: 'فشل إنشاء التصميم في Canva',
    open: 'فشل فتح Canva'
  };
  const scopeMsg = canvaScopeReconnectMessage(err.message);
  const prefix = labels[step] || 'فشل إرسال وفتح Canva';
  return `${prefix}: ${scopeMsg || err.message}`;
}

function canvaBlankContextKey(designId) {
  const id = String(designId || '').trim();
  return id ? `${CANVA_BLANK_CTX_PREFIX}:${id}` : CANVA_BLANK_CTX_PREFIX;
}

async function canvaSendAndOpen5000(item, buttonEl = null) {
  if (!canvaState.connected) {
    canvaSetMsg('اربط Canva أولاً — Connect Canva', 'warning');
    return;
  }
  if (!item) return;

  const setBtnLoading = (on) => {
    if (!buttonEl) return;
    buttonEl.disabled = on;
    buttonEl.classList.toggle('is-loading', on);
    buttonEl.textContent = on ? 'جاري...' : 'canva 5000';
  };

  const needsUpload = canvaNeedsUploadForItem(item, canvaGetBatchContext(item.id));
  setBtnLoading(true);
  canvaSetLoading(true, needsUpload ? 'جاري الرفع إلى Canva...' : 'جاري فتح Canva...');
  try {
    const ctx = await canvaSendAndOpenOne(item, {
      index: 0,
      total: 1,
      staggerOpen: false,
      focusLast: true,
      batchMode: false
    });
    canvaState.sessionId = ctx.sessionId || canvaState.sessionId;
    canvaState.assetId = ctx.assetId;
    canvaState.canvaDesignId = ctx.canvaDesignId;
    canvaState.editUrl = ctx.editUrl;
    canvaState.uploadedLibraryId = item.id;
    canvaState.popupWindowId = ctx.windowId;
    canvaState.popupTabId = ctx.tabId;
    canvaState.selectedItem = item;
    if (needsUpload) {
      canvaRenderPreview();
      canvaSetMsg('تم رفع التصميم وفتح Canva 5000×5000.', 'success');
    } else {
      canvaSetMsg('تم فتح التصميم في Canva 5000×5000.', 'success');
    }
    canvaSetStep('opened');
    canvaHelpers.showToast?.('✅ تم فتح Canva 5000×5000');
  } catch (err) {
    canvaSetMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
    if (canvaIsScopeError(err.message)) {
      canvaState.needsReconnect = true;
      canvaUpdateButtons();
      void canvaPromptReconnectIfScopeError(err.message);
    }
  } finally {
    setBtnLoading(false);
    canvaSetLoading(false);
  }
}

async function canvaOpenBlankCanvas(options = {}) {
  if (!canvaState.connected) {
    canvaSetMsg('اربط Canva أولاً — Connect Canva', 'warning');
    return;
  }

  const libraryId = String(options.libraryId || '').trim();
  const linkToLibrary = !!(options.linkToLibrary && libraryId);

  canvaSetLoading(true, 'جاري إنشاء لوحة فارغة 5000×5000...');
  try {
    const created = await canvaApi('/api/canva/create-blank-design', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: canvaState.sessionId,
        title: 'NHP Blank 5000×5000'
      })
    });

    const sessionId = created.sessionId;
    const designId = created.designId;
    const editUrl = created.editUrl;

    canvaSetLoading(true, 'جاري فتح Canva...');
    const openResult = await canvaOpenDesignPopupFor({
      sessionId,
      designId,
      editUrl,
      libraryId: linkToLibrary ? libraryId : '',
      focus: true,
      batchMode: true,
      blank: !linkToLibrary,
      title: blankTitle
    });

    const ctxKey = canvaBlankContextKey(designId);
    const blankTitle = 'NHP Blank 5000×5000';
    const ctx = {
      libraryId: linkToLibrary ? libraryId : null,
      linkToLibrary,
      sessionId,
      assetId: null,
      canvaDesignId: designId,
      designId,
      editUrl: openResult.editUrl,
      windowId: openResult.windowId,
      tabId: openResult.tabId,
      blankCanvas: true,
      blank: true,
      title: blankTitle
    };
    canvaBatchDesignContexts.set(ctxKey, ctx);

    canvaState.sessionId = sessionId;
    canvaState.canvaDesignId = designId;
    canvaState.editUrl = openResult.editUrl;
    canvaState.uploadedLibraryId = linkToLibrary ? libraryId : null;
    canvaState.selectedItem = linkToLibrary ? (canvaFindLibraryItem(libraryId) || null) : null;
    canvaState.popupWindowId = openResult.windowId;
    canvaState.popupTabId = openResult.tabId;
    canvaState.activeBlankCanva = {
      designId,
      sessionId,
      blank: true,
      libraryId: linkToLibrary ? libraryId : null,
      linkToLibrary,
      title: blankTitle,
      canvaDesignId: designId,
      editUrl: openResult.editUrl,
      windowId: openResult.windowId,
      tabId: openResult.tabId
    };

    canvaSetStep('opened');
    canvaSetMsg(
      created.mockMode
        ? 'تم فتح لوحة Canva فارغة (وضع تجريبي) — أضف التصميم يدوياً.'
        : 'تم فتح لوحة Canva فارغة 5000×5000 — أضف التصميم يدوياً ثم عد إلى NHP.',
      'success'
    );
    canvaHelpers.showToast?.('✅ فتح Canva فارغ 5000×5000');
  } catch (err) {
    const scopeMsg = canvaScopeReconnectMessage(err.message);
    canvaSetMsg(scopeMsg || err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${scopeMsg || err.message}`);
    if (canvaIsScopeError(err.message)) {
      canvaState.needsReconnect = true;
      canvaUpdateButtons();
      void canvaPromptReconnectIfScopeError(err.message);
    }
  } finally {
    canvaSetLoading(false);
  }
}

async function canvaSendAndOpen() {
  const { mode, items } = canvaResolveSendOpenTargets();
  if (!items.length) {
    canvaSetMsg('اختر تصميماً من المكتبة أو حدّد عدة تصاميم.', 'warning');
    return;
  }

  if (mode === 'batch') {
    canvaSetLoading(true, `جاري الإرسال 0/${items.length}...`);
    const errors = [];
    const successes = [];

    try {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        try {
          const ctx = await canvaSendAndOpenOne(item, {
            index: i,
            total: items.length,
            staggerOpen: true,
            focusLast: true,
            batchMode: true
          });
          successes.push(ctx);
          if (ctx.sessionId) canvaState.sessionId = ctx.sessionId;
        } catch (err) {
          const label = item.displayName || item.promptPreview || item.id;
          errors.push({ libraryId: item.id, label, error: err.message });
        }
      }

      if (!successes.length) {
        throw new Error(errors[0]?.error || 'فشل إرسال وفتح Canva');
      }

      const activeId = canvaState.selectedItem?.id;
      const activeCtx = activeId ? canvaGetBatchContext(activeId) : null;
      if (activeCtx) {
        canvaApplyDesignContext(activeCtx);
      } else {
        canvaApplyDesignContext(successes[successes.length - 1]);
      }
      canvaSetStep('opened');
      canvaRenderPreview();

      if (errors.length) {
        const failedNames = errors.map((e) => e.label).slice(0, 3).join('، ');
        const more = errors.length > 3 ? ` و${errors.length - 3} أخرى` : '';
        canvaSetMsg(
          `تم فتح ${successes.length}/${items.length} تصميم — فشل ${errors.length}: ${failedNames}${more}`,
          'warning'
        );
        canvaHelpers.showToast?.(`⚠️ تم فتح ${successes.length} — فشل ${errors.length}`);
      } else {
        canvaSetMsg(`تم إرسال وفتح ${successes.length} تصميم في Canva.`, 'success');
        canvaHelpers.showToast?.(`✅ تم فتح ${successes.length} تصميم في Canva`);
      }
    } catch (err) {
      canvaSetMsg(err.message, 'error');
      canvaHelpers.showToast?.(`⚠️ ${err.message}`);
      if (canvaIsScopeError(err.message)) {
        canvaState.needsReconnect = true;
        canvaUpdateButtons();
        void canvaPromptReconnectIfScopeError(err.message);
      }
    } finally {
      canvaSetLoading(false);
    }
    return;
  }

  const item = items[0];
  if (!item) return;

  const needsUpload = canvaNeedsUploadForSelection(item);
  canvaSetLoading(true, needsUpload ? 'جاري الرفع إلى Canva...' : 'جاري فتح Canva...');
  try {
    const ctx = await canvaSendAndOpenOne(item, {
      index: 0,
      total: 1,
      staggerOpen: false,
      focusLast: true,
      batchMode: false
    });
    canvaState.sessionId = ctx.sessionId || canvaState.sessionId;
    canvaState.assetId = ctx.assetId;
    canvaState.canvaDesignId = ctx.canvaDesignId;
    canvaState.editUrl = ctx.editUrl;
    canvaState.uploadedLibraryId = item.id;
    canvaState.popupWindowId = ctx.windowId;
    canvaState.popupTabId = ctx.tabId;
    if (needsUpload) {
      canvaRenderPreview();
      canvaSetMsg('تم رفع التصميم — جاري فتح Canva...', 'success');
    }
    canvaSetStep('opened');
    canvaHelpers.showToast?.('✅ تم الإرسال وفتح Canva');
  } catch (err) {
    canvaSetMsg(err.message, 'error');
    canvaHelpers.showToast?.(`⚠️ ${err.message}`);
    if (canvaIsScopeError(err.message)) {
      canvaState.needsReconnect = true;
      canvaUpdateButtons();
      void canvaPromptReconnectIfScopeError(err.message);
    }
  } finally {
    canvaSetLoading(false);
  }
}

async function canvaImportAndSaveForDesign({
  libraryId,
  canvaDesignId,
  sessionId,
  promptPreview,
  blank = false,
  title = ''
} = {}) {
  const designId = String(canvaDesignId || '').trim();
  const origId = String(libraryId || '').trim();
  const isBlank = !!blank;
  if (!designId) throw new Error('افتح تصميماً في Canva أولاً');
  if (!isBlank && !origId) throw new Error('معرّف التصميم في المكتبة غير متوفر');

  const importBody = isBlank
    ? {
      sessionId,
      canvaDesignId: designId,
      blank: true,
      title: title || 'NHP Blank 5000×5000'
    }
    : {
      sessionId,
      libraryId: origId,
      canvaDesignId: designId,
      originalDesignId: origId
    };

  const importData = await canvaApi('/api/canva/import-edited', {
    method: 'POST',
    body: JSON.stringify(importBody)
  });

  const resolvedName = canvaResolveItemDisplayName(canvaState.selectedItem);
  const saveBody = isBlank
    ? {
      sessionId,
      canvaDesignId: designId,
      importPath: importData.importPath,
      promptPreview: promptPreview ?? title ?? importData.promptPreview,
      versionLabel: 'Canva Edited',
      blank: true,
      blankOriginal: true,
      title: title || 'NHP Blank 5000×5000',
      displayName: title || 'NHP Blank 5000×5000'
    }
    : {
      sessionId,
      originalDesignId: origId,
      canvaDesignId: designId,
      importPath: importData.importPath,
      promptPreview: promptPreview ?? canvaState.selectedItem?.promptPreview,
      versionLabel: 'Canva Edited',
      displayName: resolvedName
    };

  const saveData = await canvaApi('/api/canva/save-version', {
    method: 'POST',
    body: JSON.stringify(saveBody)
  });

  return { importData, saveData };
}

async function canvaApplyImportSaveResult({
  importData,
  saveData,
  originalLibraryId = '',
  closePopupCtx = null,
  skipClosePopup = false,
  blankDesignId = ''
} = {}) {
  canvaState.importPath = importData?.importPath;
  canvaState.savedLibraryId = saveData.libraryId;
  if (blankDesignId) canvaClearBlankCanvaState(blankDesignId);
  canvaLibraryView = 'edited';
  canvaHighlightId = saveData.libraryId;
  canvaUpdateLibraryTabs();
  canvaSetStep('imported');
  canvaRenderPreview();
  canvaSetMsg(
    importData?.mockMode
      ? `تم الاستيراد والحفظ (وضع تجريبي): ${saveData.libraryId}`
      : `تم استيراد وحفظ النسخة المعدّلة: ${saveData.libraryId}`,
    'success'
  );
  canvaHelpers.showToast?.('✅ تم الاستيراد والحفظ في التصاميم المعدّلة');

  if (!skipClosePopup) {
    const closeResult = await canvaCloseEditPopup(closePopupCtx || {
      libraryId: originalLibraryId || canvaState.uploadedLibraryId || canvaState.selectedItem?.id,
      canvaDesignId: canvaState.canvaDesignId,
      editUrl: canvaState.editUrl,
      windowId: canvaState.popupWindowId,
      tabId: canvaState.popupTabId
    });
    if (closeResult?.closed) {
      canvaHelpers.showToast?.('تم إغلاق نافذة Canva');
    }
  }

  if (typeof canvaHelpers.fetchLibrary === 'function') {
    await canvaHelpers.fetchLibrary();
  }
  const savedItem = canvaFindLibraryItem(saveData.libraryId);
  if (savedItem) canvaSelectActiveItem(savedItem);
  canvaRenderLibrary();
  canvaScrollToLibraryCard(saveData.libraryId);
  canvaScheduleHighlightClear(saveData.libraryId);
}

async function canvaOnImportedFromEditor(req = {}) {
  const originalLibraryId = String(req.originalLibraryId || '').trim();
  const savedLibraryId = String(req.libraryId || '').trim();
  const blankDesignId = String(req.blankDesignId || req.canvaDesignId || '').trim();
  if (originalLibraryId) canvaBatchDesignContexts.delete(originalLibraryId);
  if (blankDesignId) canvaClearBlankCanvaState(blankDesignId);
  await canvaApplyImportSaveResult({
    importData: { mockMode: !!req.mockMode },
    saveData: { libraryId: savedLibraryId },
    originalLibraryId,
    blankDesignId,
    skipClosePopup: true
  });
}

function canvaListenEditorImportEvents() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage?.addListener) return;
  if (canvaListenEditorImportEvents._bound) return;
  canvaListenEditorImportEvents._bound = true;
  chrome.runtime.onMessage.addListener((req) => {
    if (req?.action !== 'CANVA_IMPORTED_FROM_EDITOR') return;
    void canvaOnImportedFromEditor(req);
  });
}

async function canvaImportEdited() {
  const importCtx = canvaResolveImportContext();
  if (!importCtx?.canvaDesignId) {
    canvaSetMsg('افتح تصميماً في Canva أولاً', 'warning');
    return;
  }

  if (importCtx.batchCtx) {
    canvaApplyDesignContext(importCtx.batchCtx);
  }

  canvaSetLoading(true, 'جاري استيراد وحفظ النسخة المعدّلة...');
  try {
    const { importData, saveData } = await canvaImportAndSaveForDesign({
      libraryId: importCtx.libraryId,
      canvaDesignId: importCtx.canvaDesignId,
      sessionId: importCtx.sessionId || canvaState.sessionId,
      promptPreview: importCtx.promptPreview,
      blank: importCtx.blank,
      title: importCtx.title
    });
    const closeCtx = importCtx.batchCtx || {
      libraryId: importCtx.libraryId || '',
      canvaDesignId: importCtx.canvaDesignId,
      editUrl: canvaState.editUrl,
      windowId: canvaState.popupWindowId,
      tabId: canvaState.popupTabId
    };
    await canvaApplyImportSaveResult({
      importData,
      saveData,
      originalLibraryId: importCtx.libraryId || '',
      closePopupCtx: closeCtx,
      blankDesignId: importCtx.blank ? importCtx.canvaDesignId : ''
    });
  } catch (err) {
    canvaSetMsg(canvaExplainImportError(err.message) || err.message, 'error');
  } finally {
    canvaSetLoading(false);
  }
}

function canvaResolveLibrarySeoFileName(libItem, displayName = '') {
  const label = String(displayName || canvaResolveItemDisplayName(libItem) || '').trim();
  if (label) return canvaSanitizeFileName(label);
  const fromIndex = String(libItem?.fileName || '').trim();
  return fromIndex || 'design.png';
}

function canvaResolveLibraryThumbPath(libItem) {
  const urls = canvaBuildLibraryFileUrlCandidates(libItem);
  if (!urls.length) return '';
  const first = urls[0];
  if (first.startsWith('http')) {
    try {
      const u = new URL(first);
      return u.pathname + u.search;
    } catch (_) {
      return '';
    }
  }
  return first.startsWith('/') ? first : '';
}

async function canvaBuildLocalLibrarySeoQueueItem(libItem, options = {}) {
  const {
    includeImageBase64 = true,
    source = 'teemaster'
  } = options;
  const sendRef = canvaResolveSendLibraryRef(libItem);
  const libraryId = sendRef.libraryId || String(libItem?.id || '').trim();
  const libraryFileName = sendRef.fileName || String(libItem?.fileName || '').trim();
  const displayName = canvaResolveItemDisplayName(libItem) || '';
  const fileName = canvaResolveLibrarySeoFileName(libItem, displayName);
  const libraryImagePath = libraryId
    ? `/api/library/${encodeURIComponent(libraryId)}/download`
    : canvaResolveLibraryThumbPath(libItem);
  const imageUrl = libraryImagePath ? canvaHelpers.ghostUrl(libraryImagePath) : '';

  let thumbnail = null;
  if (imageUrl) {
    thumbnail = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 160;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve(imageUrl);
        }
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
  }

  let imageBase64;
  if (includeImageBase64 && imageUrl) {
    try {
      const dataUrl = await canvaFetchImageAsDataUrl(imageUrl);
      imageBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    } catch (err) {
      console.warn('[Canva Bridge] local library image fetch failed:', err?.message || err);
    }
  }

  const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    file: { name: fileName, type: 'image/png' },
    base64: imageBase64 || undefined,
    thumbnail,
    status: 'pending',
    meta: {
      source,
      libraryId,
      libraryFileName,
      libraryImageUrl: libraryImagePath || undefined,
      displayName: displayName || fileName.replace(/\.[^.]+$/, ''),
      versionLabel: libItem?.versionLabel || libItem?.meta?.versionLabel || CANVA_TEEMASTER_EDITED_VERSION,
      originalDesignId: libItem?.originalDesignId || libItem?.meta?.originalDesignId || ''
    }
  };
}

async function canvaSendOneToLocalLibrarySeo(libraryId) {
  const libItem = canvaFindLibraryItem(libraryId);
  if (!libItem) {
    throw new Error(`التصميم غير موجود في المكتبة المحلية: ${libraryId}`);
  }
  if (!canvaIsEditedDesign(libItem)) {
    throw new Error('التصميم ليس نسخة معدّلة في المكتبة المحلية');
  }
  return canvaBuildLocalLibrarySeoQueueItem(libItem, {
    includeImageBase64: true,
    source: 'teemaster'
  });
}

async function canvaBuildSeoQueueItem(payload) {
  const id = `canva_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const displayName = String(payload.displayName || '').trim();
  const fileName = displayName
    ? canvaSanitizeFileName(displayName)
    : (payload.fileName || 'canva_edited.png');
  let thumbnail = null;
  const src = payload.thumbUrl
    ? canvaHelpers.ghostUrl(payload.thumbUrl)
    : (payload.imageBase64 ? `data:image/png;base64,${payload.imageBase64}` : null);
  if (src) {
    thumbnail = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 160;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch (_) {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }
  return {
    id,
    file: { name: fileName, type: 'image/png' },
    base64: payload.imageBase64,
    thumbnail,
    status: 'pending',
    meta: {
      source: 'canva',
      libraryId: payload.libraryId,
      displayName: displayName || fileName.replace(/\.[^.]+$/, ''),
      libraryFileName: payload.fileName || fileName,
      canvaDesignId: payload.canvaDesignId || canvaState.canvaDesignId,
      versionLabel: payload.versionLabel || 'Canva Edited'
    }
  };
}

async function canvaSendOneToSeo(libraryId) {
  const libItem = canvaFindLibraryItem(libraryId);
  const sendRef = canvaResolveSendLibraryRef(libItem || { id: libraryId });
  const data = await canvaApi('/api/canva/send-to-seo', {
    method: 'POST',
    body: JSON.stringify({
      libraryId: sendRef.libraryId,
      fileName: sendRef.fileName,
      sessionId: canvaState.sessionId
    })
  });
  const displayName = canvaResolveItemDisplayName(libItem) || data.displayName || '';
  return canvaBuildSeoQueueItem({
    ...data,
    libraryId: data.libraryId || libraryId,
    displayName,
    canvaDesignId: libItem?.canvaDesignId || libItem?.meta?.canvaDesignId,
    versionLabel: libItem?.versionLabel || libItem?.meta?.versionLabel || 'Canva Edited'
  });
}

async function canvaSendToSeo(auto = false, explicitIds = null) {
  const rawIds = Array.isArray(explicitIds) && explicitIds.length
    ? explicitIds.filter(Boolean)
    : (canvaLibrarySelected.size > 0
      ? [...canvaLibrarySelected]
      : [canvaState.savedLibraryId || canvaState.selectedItem?.id].filter(Boolean));

  const onEditedTab = canvaLibraryView === 'edited';
  const idsToSend = canvaResolveSeoEligibleIds(rawIds);
  const skippedIneligible = rawIds.length - idsToSend.length;

  if (!idsToSend.length) {
    if (!auto) {
      const msg = onEditedTab
        ? 'اختر تصميماً معدّلاً أو حدّد تصاميم من تبويب التصاميم المعدّلة.'
        : (skippedIneligible > 0
          ? 'التصاميم المعدّلة لا تُرسل من هذا التبويب — اختر تصاميم أصلية.'
          : 'اختر تصميماً أو حدّد تصاميم من المكتبة.');
      canvaSetMsg(msg, 'warning');
      canvaHelpers.showToast?.(skippedIneligible > 0 && !onEditedTab
        ? '⚠️ التصاميم المعدّلة لا تُرسل من تبويب الأصول'
        : '⚠️ لم يتم تحديد أي تصميم');
    }
    return;
  }

  if (!auto && skippedIneligible > 0) {
    canvaHelpers.showToast?.(onEditedTab
      ? `⚠️ تم تخطي ${skippedIneligible} تصميم غير معدّل`
      : `⚠️ تم تخطي ${skippedIneligible} تصميم معدّل — يُرسل الأصل فقط`);
  }

  try {
    const result = await canvaEnqueueIdsToSeoBatched(idsToSend, {
      auto,
      forceLocalLibrary: onEditedTab,
      source: onEditedTab ? 'canva-bridge-teemaster-path' : 'canva-bridge'
    });
    const count = result.count;
    if (!auto) {
      if (result.errors.length) {
        canvaSetMsg(`تم إرسال ${count} تصميم — فشل ${result.errors.length}.`, 'warning');
      } else {
        canvaSetMsg(
          count > 1 ? `تم إرسال ${count} تصميم إلى قائمة SEO.` : 'تم إرسال التصميم إلى SEO.',
          'success'
        );
      }
    }
    return result;
  } catch (err) {
    if (!auto) {
      canvaSetMsg(err.message, 'error');
      canvaHelpers.showToast?.(`⚠️ ${err.message}`);
    }
    throw err;
  }
}

function canvaBindEvents() {
  const root = document.getElementById('canva-bridge-root');
  if (root?.dataset.eventsBound === '1') return;
  if (root) root.dataset.eventsBound = '1';

  const els = canvaEls();
  els.btnConnect?.addEventListener('click', () => void canvaConnect());
  els.btnDisconnect?.addEventListener('click', () => void canvaDisconnect());
  els.btnReconnect?.addEventListener('click', () => void canvaReconnect());
  els.btnRefresh?.addEventListener('click', () => void canvaRefreshLibrary());
  els.btnSelect?.addEventListener('click', () => {
    if (canvaState.selectedItem && canvaState.connected) {
      canvaSetStep('selected');
      canvaRenderPreview();
      canvaSetMsg('Design selected.', 'success');
    }
  });
  els.btnSendOpen?.addEventListener('click', () => void canvaSendAndOpen());
  els.btnOpenBlank?.addEventListener('click', () => void canvaOpenBlankCanvas());
  els.btnImport?.addEventListener('click', () => void canvaImportEdited());
  // Sidebar SEO removed — only originals from مكتبة التصاميم may go to SEO (toolbar / preview).

  els.libUploadBtn?.addEventListener('click', () => els.libFileInput?.click());
  els.libAuditBtn?.addEventListener('click', () => void canvaRunLibraryAudit());
  els.libSelectBroken?.addEventListener('click', () => canvaSelectBrokenLibrary());
  els.libReconcileBtn?.addEventListener('click', () => void canvaReconcileLibraryIndex());
  els.libFileInput?.addEventListener('change', () => {
    const files = els.libFileInput?.files;
    if (files?.length) void canvaUploadLibraryFiles(files);
    if (els.libFileInput) els.libFileInput.value = '';
  });
  els.libSelectVisible?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const items = canvaFilteredLibraryItems();
    const allSelected = items.length > 0 && items.every((it) => canvaLibrarySelected.has(it.id));
    canvaSelectFilteredLibrary(!allSelected);
  });
  els.libSelectAll?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    canvaSelectFilteredLibrary(true);
  });
  els.libDeselectAll?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    canvaSelectFilteredLibrary(false);
  });
  els.libSelectCount?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    canvaSelectLibraryFirstN(els.libSelectCount?.value);
  });
  els.libEmptyTab?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void canvaEmptyCurrentTabLibrary();
  });
  els.libDeleteSelected?.addEventListener('click', () => void canvaDeleteLibrarySelected());
  els.libDownloadSelected?.addEventListener('click', () => void canvaDownloadLibrarySelected());
  els.libDownloadAll?.addEventListener('click', () => void canvaDownloadLibraryAll());
  els.libSendStudio?.addEventListener('click', () => { void canvaSendLibrarySelectedToStudio(); });
  els.libTeeMasterSendOnly?.addEventListener('click', () => { void canvaSendLibrarySelectedToTeeMasterOnly(); });
  els.libTeeMasterEdited?.addEventListener('click', () => { void canvaStartTeeMasterEditedPipeline(); });
  els.libTeeMasterFullPath?.addEventListener('click', () => { void canvaStartTeeMasterFullPathPipeline(); });
  els.libFullPipeline?.addEventListener('click', () => { void canvaStartFullUploadPipeline(); });
  els.libSendSeo?.addEventListener('click', () => { void canvaSendSelectedToSeo(); });
  els.libSmartRename?.addEventListener('click', () => {
    void canvaSmartRenameLibrary(canvaResolveSmartRenameIds());
  });
  els.libRenameSelected?.addEventListener('click', () => {
    void canvaSmartRenameLibrary(canvaResolveRenameIdsForMode('selected'));
  });
  els.libRenameAll?.addEventListener('click', () => {
    void canvaSmartRenameLibrary(canvaResolveRenameIdsForMode('all'));
  });
  els.libRenameNotes?.addEventListener('click', () => {
    canvaOpenNotePickerForMode(canvaLibrarySelected.size > 0 ? 'selected' : 'all');
  });
  els.tabAll?.addEventListener('click', () => canvaSetLibraryView('all'));
  els.tabEdited?.addEventListener('click', () => canvaSetLibraryView('edited'));
  canvaBindLibraryDragDrop();

  els.btnConnectApi?.addEventListener('click', () => {
    window.open('https://www.canva.com/developers/integrations/connect-api', '_blank', 'noopener,noreferrer');
  });
  els.btnSettings?.addEventListener('click', () => canvaOpenSettingsModal());
  els.settingsBackdrop?.addEventListener('click', () => canvaCloseSettingsModal());
  els.settingsCancel?.addEventListener('click', () => canvaCloseSettingsModal());
  els.settingsSave?.addEventListener('click', () => void canvaSaveSettings());
  els.settingsClientId?.addEventListener('input', () => canvaUpdateEnvTemplatePreview());
  els.settingsClientSecret?.addEventListener('focus', () => {
    if (els.settingsClientSecret?.value === CANVA_SECRET_PLACEHOLDER) {
      els.settingsClientSecret.value = '';
    }
  });
  els.copyClientId?.addEventListener('click', () => {
    void canvaCopyText(els.settingsClientId?.value?.trim(), 'تم نسخ Client ID');
  });
  els.copyRedirectUri?.addEventListener('click', () => {
    void canvaCopyText(els.settingsRedirectUri?.value?.trim(), 'تم نسخ Redirect URI');
  });
  els.copyEnvTemplate?.addEventListener('click', () => {
    void canvaCopyText(els.settingsEnvTemplate?.textContent, 'تم نسخ قالب .env');
  });
  els.settingsAutoConnect?.addEventListener('change', () => {
    void canvaSaveAutoConnectPref(els.settingsAutoConnect.checked);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const picker = document.getElementById('canva-bridge-note-picker');
    if (picker && !picker.classList.contains('is-hidden')) {
      canvaCloseNotePicker();
      return;
    }
    if (canvaSettingsState.open) canvaCloseSettingsModal();
  });
}

function ensureCanvaBridgeStyles() {
  const viewerHref = 'utils/design-preview-viewer.css?v=20260628c';
  const bridgeHref = 'modules/generate/canva-bridge.css?v=20260701-hover-close-fix';

  let viewerLink = document.getElementById('nhp-design-preview-viewer-css');
  if (!viewerLink) {
    viewerLink = document.createElement('link');
    viewerLink.id = 'nhp-design-preview-viewer-css';
    viewerLink.rel = 'stylesheet';
    viewerLink.href = viewerHref;
    document.head.appendChild(viewerLink);
  } else if (viewerLink.getAttribute('href') !== viewerHref) {
    viewerLink.href = viewerHref;
  }

  let link = document.getElementById('nhp-canva-bridge-css');
  if (link) {
    if (link.getAttribute('href') !== bridgeHref) link.href = bridgeHref;
    return;
  }
  link = document.createElement('link');
  link.id = 'nhp-canva-bridge-css';
  link.rel = 'stylesheet';
  link.href = bridgeHref;
  document.head.appendChild(link);
}

function canvaBindToolbarGroups() {
  const root = document.getElementById('canva-bridge-library-toolbar');
  if (!root || root.dataset.groupToggleBound === '1') return;
  root.dataset.groupToggleBound = '1';

  root.querySelectorAll('.canva-bridge-toolbar-group[data-toolbar-group]').forEach((group) => {
    const toggle = group.querySelector('.canva-bridge-toolbar-group-title');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', 'false');
    group.addEventListener('mouseenter', () => toggle.setAttribute('aria-expanded', 'true'));
    group.addEventListener('mouseleave', () => {
      toggle.setAttribute('aria-expanded', 'false');
      if (group.contains(document.activeElement)) document.activeElement?.blur?.();
    });
  });
}

export function initCanvaBridge(helpers = {}) {
  canvaHelpers = { ...canvaHelpers, ...helpers };
  ensureCanvaBridgeStyles();
  if (!document.getElementById('canva-bridge-root')) return;
  canvaBindToolbarGroups();
  canvaBindEvents();
  canvaListenEditorImportEvents();
  canvaBindLibraryDragDrop();
  canvaBindPreviewToolbar();
  canvaBindKeyboardNav();
  canvaBindNotePicker();
  canvaBindPreviewNameInput();
  canvaUpdateLibraryTabs();
  canvaSetStep('idle');
  canvaLibraryGridActive = canvaIsBridgePanelActive();
  void canvaLoadAutoConnectPref().then(() => canvaRefreshStatusAndMaybeAutoConnect());
  canvaRenderLibrary();
  canvaRenderPreview();
  void canvaRunLibraryAudit({ silent: true });
  console.log('🎨 Canva Bridge: ready');
}

export function activateCanvaBridgePanel() {
  if (!document.getElementById('canva-bridge-root')) return;
  canvaLibraryGridActive = true;
  canvaRenderLibrary({ force: true });
  canvaClaimKeyboardFocus();
  void canvaRefreshStatusAndMaybeAutoConnect();
}

export function deactivateCanvaBridgePanel() {
  canvaLibraryGridActive = false;
  canvaDestroyLibraryGridObservers();
  if (canvaLibraryRenderTimer) {
    clearTimeout(canvaLibraryRenderTimer);
    canvaLibraryRenderTimer = null;
  }
  canvaLibraryPendingRender = null;
  const { library } = canvaEls();
  if (library) {
    library.querySelectorAll('.canva-bridge-lib-card-img').forEach(canvaRevokeLibraryThumbBlob);
    library.innerHTML = '';
  }
  canvaLibraryRendered = 0;
}

export function refreshCanvaBridgeLibrary() {
  canvaInvalidateEditedVersionIndex();
  const opts = { force: !canvaIsPipelineUiPaused() };
  if (canvaIsPipelineUiPaused()) {
    canvaScheduleLibraryRender(opts);
  } else {
    canvaRenderLibrary(opts);
  }
}
