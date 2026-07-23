/**
 * Canva Bridge — top-level Studio & AI panel (full-width workspace).
 */
import { initCanvaBridge, activateCanvaBridgePanel, deactivateCanvaBridgePanel, refreshCanvaBridgeLibrary, canvaBuildLibraryThumbUrlCandidates } from './canva-bridge.js';

const GHOST_PORT = 3019;
let canvaPanelHelpers = {};
let canvaPanelLibraryItems = [];
let canvaPanelGhostPort = GHOST_PORT;

function canvaPanelGhostUrl(path) {
  const port = canvaPanelGhostPort || GHOST_PORT;
  if (window.NhpRuntimeConfig?.localUrl) {
    return window.NhpRuntimeConfig.localUrl(port, path);
  }
  const p = path.startsWith('/') ? path : `/${path}`;
  return `http://127.0.0.1:${port}${p}`;
}

function canvaPanelLibraryImageUrl(item) {
  const urls = canvaBuildLibraryThumbUrlCandidates(item, canvaPanelGhostUrl);
  return urls[0] || '';
}

function canvaPanelLibraryImageFallbackUrls(item) {
  return canvaBuildLibraryThumbUrlCandidates(item, canvaPanelGhostUrl);
}

function canvaPanelItemIsRenderable(item) {
  if (!item || typeof item !== 'object') return false;
  const id = String(item.id || '').trim();
  if (!id || /^index\.json$/i.test(id)) return false;
  return canvaPanelLibraryImageFallbackUrls(item).length > 0;
}

async function canvaPanelReadStoredGhostPort() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(['nhpGhostPort', 'nhpGhostTeepublicPort'], (r) => resolve(r || {}));
    });
    const p = Number(stored?.nhpGhostPort || stored?.nhpGhostTeepublicPort);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch (_) {
    return null;
  }
}

async function canvaPanelEnsureGhostPort() {
  const stored = await canvaPanelReadStoredGhostPort();
  canvaPanelGhostPort = stored || GHOST_PORT;
}

function canvaPanelStripHeavyFields(item) {
  if (!item || typeof item !== 'object') return item;
  const clean = { ...item };
  delete clean.dataURL;
  delete clean.thumbnail;
  delete clean.base64;
  return clean;
}

async function canvaPanelFetchLibrary() {
  await canvaPanelEnsureGhostPort();
  const res = await fetch(canvaPanelGhostUrl('/api/library'));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  canvaPanelLibraryItems = (Array.isArray(data?.items) ? data.items : [])
    .map(canvaPanelStripHeavyFields)
    .filter(canvaPanelItemIsRenderable);
  return canvaPanelLibraryItems;
}

/** Merge freshly uploaded rows into cache so TeeMaster full path can queue SEO immediately. */
function canvaPanelUpsertLibraryItems(items) {
  for (const item of items || []) {
    const row = canvaPanelStripHeavyFields(item);
    if (!row?.id || !canvaPanelItemIsRenderable(row)) continue;
    const idx = canvaPanelLibraryItems.findIndex((it) => it.id === row.id);
    if (idx >= 0) {
      canvaPanelLibraryItems[idx] = { ...canvaPanelLibraryItems[idx], ...row };
    } else {
      canvaPanelLibraryItems.unshift(row);
    }
  }
}

export function initCanvaBridgePanel(helpers = {}) {
  canvaPanelHelpers = {
    showToast: helpers.showToast || (() => {}),
    switchTab: typeof helpers.switchTab === 'function' ? helpers.switchTab : null,
    getDesignQueue: typeof helpers.getDesignQueue === 'function' ? helpers.getDesignQueue : null,
    setDesignQueue: typeof helpers.setDesignQueue === 'function' ? helpers.setDesignQueue : null,
    saveQueueToStorage: typeof helpers.saveQueueToStorage === 'function' ? helpers.saveQueueToStorage : null,
    renderQueue: typeof helpers.renderQueue === 'function' ? helpers.renderQueue : null
  };

  void canvaPanelEnsureGhostPort().then(() => {
    initCanvaBridge({
      ...canvaPanelHelpers,
      ghostUrl: canvaPanelGhostUrl,
      fetchLibrary: canvaPanelFetchLibrary,
      upsertLibraryItems: canvaPanelUpsertLibraryItems,
      libraryImageUrl: (item) => canvaPanelLibraryImageUrl(item),
      libraryItems: () => canvaPanelLibraryItems.filter(canvaPanelItemIsRenderable)
    });
    void canvaPanelFetchLibrary().then(() => refreshCanvaBridgeLibrary());
  });

  console.log('🎨 Canva Bridge Panel: ready');
}

export function deactivateCanvaBridgeTab() {
  deactivateCanvaBridgePanel();
}

export function activateCanvaBridgeTab() {
  if (!document.getElementById('canva-bridge-root')) return;
  void canvaPanelEnsureGhostPort().then(async () => {
    try {
      await canvaPanelFetchLibrary();
    } catch (_) { /* keep cached items */ }
    activateCanvaBridgePanel();
    refreshCanvaBridgeLibrary();
  });
}
