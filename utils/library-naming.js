/**
 * Shared library naming helpers — same APIs as Generate library smart-rename.
 */

const NOTE_MANAGER_KEY = 'teepublic_manager_data';
const GPT_API_KEY_STORAGE = 'nhpGptApiKey';
const PROXY_BASE_URL_STORAGE = 'nhpProxyBaseUrl';
const ADMIN_AI_KEYS_STORAGE = 'nhpAdminAiKeys';

const DEFAULT_RENAME_POLL_MS = 2500;
const DEFAULT_RENAME_POLL_MAX = 12;

function readChromeStorage(keys) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve({});
        return;
      }
      chrome.storage.local.get(keys, (res) => resolve(res || {}));
    } catch (_) {
      resolve({});
    }
  });
}

function normalizeProxyBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (typeof window !== 'undefined' && window.NhpRuntimeConfig?.normalizeProxyBaseUrl) {
    return window.NhpRuntimeConfig.normalizeProxyBaseUrl(raw);
  }
  return raw.replace(/\/+$/, '');
}

/** Preserve spaces — Prompt Bag / library display name from niche title. */
export function nicheTitleToFileName(title) {
  const fn = typeof globalThis !== 'undefined' && globalThis.NHP_nicheTitleToFileName;
  if (typeof fn === 'function') return fn(title);
  const base = String(title || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .trim();
  return base ? `${base}.png` : 'reference.png';
}

export function nicheTitleFromFileName(name) {
  const fn = typeof globalThis !== 'undefined' && globalThis.NHP_nicheTitleFromFileName;
  if (typeof fn === 'function') return fn(name);
  return String(name || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .trim();
}

export function nicheKeyFromTitle(title) {
  const fn = typeof globalThis !== 'undefined' && globalThis.NHP_nicheKey;
  if (typeof fn === 'function') return fn(title);
  return nicheTitleFromFileName(title).toLowerCase();
}

export function extractNoteLabel(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry.trim();
  return String(
    entry.text
    || entry.title
    || entry.name
    || entry.keyword
    || entry.niche
    || ''
  ).trim();
}

/** Note context for POST /api/library/smart-rename (matches generate.js). */
export async function getNoteRenameContext(limit = 60) {
  const res = await readChromeStorage(['teepublic_manager_data', 'nhp_current_niche_context']);
  const data = res.teepublic_manager_data || {};
  const raw = data.niches || [];
  const history = Array.isArray(data.history) ? data.history : [];
  const unique = [];
  const seen = new Set();
  const pushEntry = (text, detail, source) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ niche: trimmed, detail, source });
  };
  const currentCtx = String(res.nhp_current_niche_context || '').trim();
  if (currentCtx) pushEntry(currentCtx, '', 'current');
  raw.forEach((entry) => {
    const text = extractNoteLabel(entry);
    const detail = String(entry?.noteBody || entry?.note || entry?.description || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    pushEntry(text, detail, 'current');
  });
  history.forEach((batch) => {
    const batchNiches = Array.isArray(batch?.niches) ? batch.niches : [];
    batchNiches.forEach((text) => pushEntry(text, '', 'memory'));
  });
  return unique.slice(0, Math.max(1, Number(limit) || 60));
}

/** Flat note list for picker UI (matches popup queue note picker). */
export async function getNotePickerItems() {
  const res = await readChromeStorage([NOTE_MANAGER_KEY, 'nhp_current_niche_context']);
  const data = res?.[NOTE_MANAGER_KEY] || {};
  const items = [];
  const seen = new Set();
  const pushLabel = (rawLabel, source = 'niche') => {
    const text = extractNoteLabel(rawLabel);
    if (!text || !/\S/.test(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id: `${source}:${key}`, text, source });
  };

  pushLabel(res?.nhp_current_niche_context, 'current');
  (Array.isArray(data.niches) ? data.niches : []).forEach((entry) => pushLabel(entry, 'niche'));
  (Array.isArray(data.unofficialTrends) ? data.unofficialTrends : []).forEach((entry) => pushLabel(entry, 'trend'));
  (Array.isArray(data.history) ? data.history : []).forEach((batch) => {
    (Array.isArray(batch?.niches) ? batch.niches : []).forEach((entry) => pushLabel(entry, 'history'));
  });
  return items;
}

export async function getLibraryAiCredentialHeaders() {
  const res = await readChromeStorage([
    ADMIN_AI_KEYS_STORAGE,
    GPT_API_KEY_STORAGE,
    PROXY_BASE_URL_STORAGE
  ]);
  const adminKeys = res?.[ADMIN_AI_KEYS_STORAGE] || {};
  const apiKey = String(adminKeys.gpt || res?.[GPT_API_KEY_STORAGE] || '').trim();
  const baseUrl = normalizeProxyBaseUrl(adminKeys.baseUrl || res?.[PROXY_BASE_URL_STORAGE] || '');
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-NHP-Api-Key'] = apiKey;
  if (baseUrl) headers['X-NHP-Proxy-Base-Url'] = baseUrl;
  return headers;
}

export function libraryItemsNameSignature(items = []) {
  return items.map((i) => `${i.displayName || i.title || ''}\u0002${i.fileName || ''}`).join('\u0001');
}

export async function requestLibrarySmartRename({ ghostUrl, ids, noteContext = null }) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) {
    throw new Error('حدّد تصاميم للتسمية');
  }
  const headers = await getLibraryAiCredentialHeaders();
  const ctx = noteContext == null ? await getNoteRenameContext(60) : noteContext;
  const url = typeof ghostUrl === 'function' ? ghostUrl('/api/library/smart-rename') : `${ghostUrl}/api/library/smart-rename`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: list, renameNoteContext: ctx })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    const base = data?.error || `HTTP ${res.status}`;
    const hint404 = res.status === 404
      ? ' — مسار التسمية الذكية غير مسجّل على Ghost؛ أوقف ghost-server.js ثم شغّله من جديد على المنفذ 3019'
      : '';
    const hint503 = res.status === 503 && data?.hint ? ` — ${data.hint}` : '';
    throw new Error(`${base}${hint404}${hint503}`);
  }
  return data;
}

export async function patchLibraryDisplayName({ ghostUrl, id, displayName }) {
  const safeId = String(id || '').trim();
  const name = String(displayName || '').trim();
  if (!safeId || !name) throw new Error('معرّف أو اسم غير صالح');
  const url = typeof ghostUrl === 'function'
    ? ghostUrl(`/api/library/${encodeURIComponent(safeId)}`)
    : `${ghostUrl}/api/library/${encodeURIComponent(safeId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: name })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

export function createLibraryRenamePoller({
  fetchLibrary,
  getItems,
  onUpdated,
  pollMs = DEFAULT_RENAME_POLL_MS,
  maxAttempts = DEFAULT_RENAME_POLL_MAX
} = {}) {
  let timer = null;
  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const start = () => {
    clear();
    let attempts = 0;
    const sigBefore = libraryItemsNameSignature(getItems?.() || []);
    const tick = async () => {
      attempts += 1;
      try {
        if (typeof fetchLibrary === 'function') await fetchLibrary();
      } catch (_) { /* ignore */ }
      const items = getItems?.() || [];
      const sigAfter = libraryItemsNameSignature(items);
      const hasNames = items.some((i) => String(i.displayName || i.title || '').trim());
      if (hasNames && sigBefore !== sigAfter) {
        onUpdated?.({ updated: true, items });
        return;
      }
      if (attempts < maxAttempts) {
        timer = setTimeout(() => { void tick(); }, pollMs);
      } else {
        onUpdated?.({ updated: false, items, timedOut: true });
      }
    };
    timer = setTimeout(() => { void tick(); }, pollMs);
  };
  return { start, clear };
}
