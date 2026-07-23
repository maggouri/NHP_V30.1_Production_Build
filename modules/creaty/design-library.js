/**
 * CREATY Design Library — IndexedDB storage + UI (replica of EmailCore website Design Library)
 * Images can be imported from SEO AI queue (savedDesignQueue + NHPDatabase)
 */

const DB_NAME = 'creaty-design-library';
const DB_VERSION = 1;
const META_STORE = 'designs';
const BLOB_STORE = 'blobs';
export const GROUP_SIZE = 5;

export const DESIGN_STATUS = {
  READY: 'ready',
  PULLED: 'pulled',
  PUBLISHED: 'published',
};

let dbPromise = null;
let migrationDone = false;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('groupId', 'groupId', { unique: false });
        store.createIndex('assignedAccountId', 'assignedAccountId', { unique: false });
        store.createIndex('sourceSeoId', 'sourceSeoId', { unique: false });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function newId() {
  return `cd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function newGroupId() {
  return `cg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

export async function initDesignStore() {
  await openDb();
  if (!migrationDone) {
    await migrateLegacyGroups();
    migrationDone = true;
  }
}

export async function listDesigns({ status = null } = {}) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => {
      let rows = (req.result || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (status) rows = rows.filter((r) => r.status === status);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDesign(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(String(id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getDesignBlob(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const req = tx.objectStore(BLOB_STORE).get(String(id));
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

async function findOpenGroupSlot() {
  const all = await listDesigns();
  const byGroup = new Map();
  for (const d of all) {
    if (!d.groupId) continue;
    if (!byGroup.has(d.groupId)) byGroup.set(d.groupId, []);
    byGroup.get(d.groupId).push(d);
  }
  const candidates = [...byGroup.entries()]
    .filter(([, designs]) => designs.length < GROUP_SIZE)
    .filter(([, designs]) => designs.every((d) => d.status === DESIGN_STATUS.READY))
    .sort((a, b) => {
      const aMin = Math.min(...a[1].map((d) => new Date(d.createdAt).getTime()));
      const bMin = Math.min(...b[1].map((d) => new Date(d.createdAt).getTime()));
      return aMin - bMin;
    });
  if (candidates.length) {
    const [groupId, designs] = candidates[0];
    return { groupId, groupIndex: designs.length };
  }
  return { groupId: newGroupId(), groupIndex: 0 };
}

async function migrateLegacyGroups() {
  const all = await listDesigns();
  const ungrouped = all.filter((d) => !d.groupId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!ungrouped.length) return;
  let groupId = newGroupId();
  let groupIndex = 0;
  for (const d of ungrouped) {
    await updateDesignMeta(d.id, { groupId, groupIndex, assignedAccountId: d.assignedAccountId ?? null });
    groupIndex += 1;
    if (groupIndex >= GROUP_SIZE) {
      groupId = newGroupId();
      groupIndex = 0;
    }
  }
}

export async function addDesignFromBlob(blob, metaPatch = {}) {
  if (!(blob instanceof Blob)) throw new Error('Invalid blob');
  const { groupId, groupIndex } = await findOpenGroupSlot();
  const id = newId();
  const filename = String(metaPatch.filename || 'design.png').trim();
  const mimeType = blob.type || metaPatch.mimeType || 'image/png';
  const createdAt = new Date().toISOString();
  const meta = {
    id,
    filename,
    title: metaPatch.title || '',
    description: metaPatch.description || '',
    mainTag: metaPatch.mainTag || '',
    tags: normalizeTags(metaPatch.tags),
    niche: metaPatch.niche || '',
    status: DESIGN_STATUS.READY,
    mimeType,
    size: blob.size,
    groupId,
    groupIndex,
    assignedAccountId: metaPatch.assignedAccountId ?? null,
    sourceSeoId: metaPatch.sourceSeoId || null,
    pulledBy: null,
    pulledAt: null,
    createdAt,
    updatedAt: createdAt,
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(BLOB_STORE).put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return meta;
}

export async function addDesignFromFile(file) {
  const blob = file instanceof Blob ? file : null;
  if (!blob) throw new Error('Invalid file');
  return addDesignFromBlob(blob, { filename: file.name || 'design.png', mimeType: blob.type });
}

export async function updateDesignMeta(id, patch = {}) {
  const current = await getDesign(id);
  if (!current) throw new Error('Design not found');
  const updated = {
    ...current,
    ...patch,
    id: current.id,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
    updatedAt: new Date().toISOString(),
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return updated;
}

export async function deleteDesign(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(String(id));
    tx.objectStore(BLOB_STORE).delete(String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllDesigns({ status = null } = {}) {
  const rows = await listDesigns({ status });
  if (!rows.length) return 0;
  const ids = rows.map((d) => String(d.id));
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], 'readwrite');
    const metaStore = tx.objectStore(META_STORE);
    const blobStore = tx.objectStore(BLOB_STORE);
    for (const id of ids) {
      metaStore.delete(id);
      blobStore.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return ids.length;
}

export async function listDesignGroups() {
  const all = await listDesigns();
  const byGroup = new Map();
  for (const d of all) {
    const gid = d.groupId || 'ungrouped';
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid).push(d);
  }
  const groups = [...byGroup.entries()].map(([groupId, designs]) => {
    const sorted = designs.sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
    const readyCount = sorted.filter((d) => d.status === DESIGN_STATUS.READY).length;
    const isComplete = sorted.length >= GROUP_SIZE;
    const isPullReady = isComplete && sorted.every((d) => d.status === DESIGN_STATUS.READY) && !!sorted[0]?.assignedAccountId;
    return {
      groupId,
      designs: sorted,
      count: sorted.length,
      readyCount,
      isComplete,
      isPullReady,
      assignedAccountId: sorted[0]?.assignedAccountId || null,
      createdAt: sorted[0]?.createdAt || null,
    };
  });
  return groups.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function assignGroupToAccount(groupId, accountId) {
  const all = await listDesigns();
  const inGroup = all.filter((d) => d.groupId === groupId);
  if (!inGroup.length) throw new Error('Group not found');
  const account = accountId ? String(accountId) : null;
  for (const d of inGroup) {
    await updateDesignMeta(d.id, { assignedAccountId: account });
  }
  return listDesignGroups().then((groups) => groups.find((g) => g.groupId === groupId));
}

export async function autoAssignGroupsToAccounts(accountIds = []) {
  const ids = (accountIds || []).map((id) => String(id)).filter(Boolean);
  if (!ids.length) return { assigned: 0, groups: [] };
  const groups = await listDesignGroups();
  const unassigned = groups.filter(
    (g) => g.isComplete && !g.assignedAccountId && g.designs.every((d) => d.status === DESIGN_STATUS.READY)
  );
  let assigned = 0;
  const results = [];
  for (let i = 0; i < unassigned.length; i += 1) {
    const accountId = ids[i % ids.length];
    const group = await assignGroupToAccount(unassigned[i].groupId, accountId);
    if (group) {
      assigned += 1;
      results.push(group);
    }
  }
  return { assigned, groups: results };
}

export async function assignQuintetToAccount(email) {
  const accountId = String(email || '').trim();
  if (!accountId) throw new Error('Account email required');
  const groups = await listDesignGroups();
  const existing = groups.find(
    (g) => g.isComplete && g.assignedAccountId && String(g.assignedAccountId).trim().toLowerCase() === accountId.toLowerCase()
  );
  if (existing) return existing;
  const result = await autoAssignGroupsToAccounts([accountId]);
  if (result.assigned > 0 && result.groups[0]) return result.groups[0];
  return null;
}

export async function moveDesignToGroup(designId, targetGroupId) {
  const design = await getDesign(designId);
  if (!design) throw new Error('Design not found');
  const groups = await listDesignGroups();
  let groupId = targetGroupId;
  let groupIndex = 0;
  if (groupId === '__new__') {
    groupId = newGroupId();
    groupIndex = 0;
  } else {
    const target = groups.find((g) => g.groupId === groupId);
    if (!target) throw new Error('Group not found');
    if (target.count >= GROUP_SIZE) throw new Error('Group is full');
    groupIndex = target.count;
  }
  return updateDesignMeta(designId, { groupId, groupIndex });
}

export function blobToObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dataUrlToBlob(dataUrl) {
  const raw = String(dataUrl || '');
  const parts = raw.split(',');
  if (parts.length < 2) return null;
  const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/png';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function base64ToBlob(base64, mimeType = 'image/png') {
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!clean) return null;
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

async function loadSeoQueueItems() {
  let queue = [];
  if (typeof window.getDesignQueue === 'function') {
    queue = window.getDesignQueue() || [];
  }
  if (!queue.length) {
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(['savedDesignQueue'], (res) => resolve(res?.savedDesignQueue || []));
    });
    queue = stored;
  }
  return Array.isArray(queue) ? queue : [];
}

export async function resolveSeoItemImage(item) {
  if (item?.base64) {
    const blob = base64ToBlob(item.base64, item.file?.type || 'image/png');
    if (blob) return { blob, preview: item.thumbnail || `data:image/png;base64,${item.base64}` };
  }
  const db = window.NHPDatabase;
  if (db?.getImage && item?.id) {
    try {
      const b64 = await db.getImage(item.id);
      if (b64) {
        const blob = base64ToBlob(b64, item.file?.type || 'image/png');
        const preview = `data:image/png;base64,${b64}`;
        if (blob) return { blob, preview };
      }
    } catch { /* ignore */ }
  }
  if (item?.thumbnail) {
    const blob = dataUrlToBlob(item.thumbnail);
    if (blob) return { blob, preview: item.thumbnail };
  }
  return { blob: null, preview: item?.thumbnail || null };
}

export const CREATY_GENLIB_SOURCE_PREFIX = 'genlib:';

export function creatySourceKeyForGenerateLib(itemId) {
  return `${CREATY_GENLIB_SOURCE_PREFIX}${String(itemId || '').trim()}`;
}

export function buildMetaPatchFromSeoItem(item) {
  const meta = item?.meta || {};
  return {
    filename: item?.file?.name || item?.name || 'seo-design.png',
    title: meta.title || '',
    description: meta.description || '',
    mainTag: meta.main_tag || meta.mainTag || '',
    tags: meta.tags || [],
    niche: meta.niche || '',
    sourceSeoId: String(item?.id || ''),
  };
}

export function notifyCreatyDesignLibraryChanged(accountEmails = []) {
  try {
    window.dispatchEvent(new CustomEvent('nhp:creaty-design-library-changed'));
  } catch { /* ignore */ }
  try {
    const emails = (Array.isArray(accountEmails) ? accountEmails : [])
      .map((e) => String(e || '').trim())
      .filter(Boolean);
    chrome.runtime.sendMessage({
      action: 'CREATY_ARCHIVE_QUEUE_DESIGNS',
      accountEmails: emails,
    });
  } catch { /* background unavailable */ }
}

/**
 * Import SEO AI queue items into CREATY design library (IndexedDB, auto-grouped by 5).
 * @returns {{ imported: number, skipped: number, failed: number }}
 */
export async function importSeoQueueItems(seoItems, { skipExisting = true } = {}) {
  await initDesignStore();
  const items = Array.isArray(seoItems) ? seoItems : [];
  const existing = skipExisting ? await listDesigns() : [];
  const importedKeys = new Set(existing.map((d) => d.sourceSeoId).filter(Boolean));
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const sourceKey = String(item?.id || '');
    if (!sourceKey) {
      failed += 1;
      continue;
    }
    if (skipExisting && importedKeys.has(sourceKey)) {
      skipped += 1;
      continue;
    }
    const { blob } = await resolveSeoItemImage(item);
    if (!blob) {
      failed += 1;
      continue;
    }
    try {
      await addDesignFromBlob(blob, {
        ...buildMetaPatchFromSeoItem(item),
        mimeType: blob.type,
      });
      importedKeys.add(sourceKey);
      imported += 1;
    } catch {
      failed += 1;
    }
  }

  if (imported > 0) notifyCreatyDesignLibraryChanged();
  return { imported, skipped, failed };
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function initCreatyDesignLibrary(rootEl, helpers = {}) {
  const t = helpers.t || ((key) => key);
  const showToast = helpers.showToast || (() => {});
  const getAccountOptions = helpers.getAccountOptions || (() => []);

  if (!rootEl) return { refresh: () => {} };

  let designs = [];
  let designGroups = [];
  let accountOptions = [];
  let statusFilter = 'all';
  let selectedIds = new Set();
  let thumbUrls = new Map();
  let wired = false;

  function revokeThumbUrls() {
    for (const url of thumbUrls.values()) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    thumbUrls.clear();
  }

  async function refreshData() {
    accountOptions = getAccountOptions();
    designs = await listDesigns();
    designGroups = await listDesignGroups();
    if (statusFilter !== 'all') {
      designs = designs.filter((d) => d.status === statusFilter);
    }
  }

  async function loadThumbnails() {
    revokeThumbUrls();
    const allDesigns = await listDesigns();
    for (const d of allDesigns) {
      const blob = await getDesignBlob(d.id);
      if (blob) thumbUrls.set(d.id, blobToObjectUrl(blob));
    }
  }

  function accountLabel(accountId) {
    if (!accountId) return t('dlGroupUnassigned');
    const found = accountOptions.find((a) => a.id === accountId);
    return found?.email || accountId;
  }

  function visibleDesignIds() {
    return designs.map((d) => d.id);
  }

  function allVisibleSelected() {
    const ids = visibleDesignIds();
    return ids.length > 0 && ids.every((id) => selectedIds.has(id));
  }

  function statusBadge(status) {
    const map = {
      ready: 'creaty-dlib-badge--ready',
      pulled: 'creaty-dlib-badge--pulled',
      published: 'creaty-dlib-badge--published',
    };
    const labelKey = { ready: 'dlStatusReady', pulled: 'dlStatusPulled', published: 'dlStatusPublished' };
    return `<span class="creaty-dlib-badge ${map[status] || ''}">${escapeHtml(t(labelKey[status] || 'dlStatusReady'))}</span>`;
  }

  function renderToolbar() {
    const readyCount = designs.filter((d) => d.status === DESIGN_STATUS.READY).length;
    return `
      <div class="creaty-dlib-toolbar">
        <div class="creaty-dlib-toolbar__row">
          <label class="creaty-btn creaty-btn--primary creaty-dlib-upload-btn">
            <i class="fa-solid fa-upload"></i> ${escapeHtml(t('dlUpload'))}
            <input type="file" id="creaty-dlib-file-input" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
          </label>
          <button type="button" class="creaty-btn creaty-btn--ghost" id="creaty-dlib-import-seo">
            <i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(t('dlImportSeo'))}
          </button>
        </div>
        <div class="creaty-dlib-dropzone" id="creaty-dlib-dropzone" tabindex="0" role="button">
          <span>${escapeHtml(t('dlDropHint'))}</span>
        </div>
        <div class="creaty-dlib-toolbar__row creaty-dlib-toolbar__row--stats">
          <span class="creaty-dlib-stats">${escapeHtml(t('dlReadyCount', { count: readyCount }))} · ${escapeHtml(t('dlTotalCount', { count: designs.length }))}</span>
        </div>
        <div class="creaty-dlib-toolbar__row">
          <button type="button" class="creaty-btn creaty-btn--ghost" id="creaty-dlib-auto-assign">${escapeHtml(t('dlAutoAssign'))}</button>
          <button type="button" class="creaty-btn creaty-btn--ghost creaty-dlib-select-all${allVisibleSelected() ? ' creaty-dlib-select-all--active' : ''}" id="creaty-dlib-select-all" aria-pressed="${allVisibleSelected() ? 'true' : 'false'}" ${designs.length ? '' : 'disabled'}>${escapeHtml(t(allVisibleSelected() ? 'dlDeselectAll' : 'dlSelectAll'))}</button>
          <button type="button" class="creaty-btn creaty-btn--danger" id="creaty-dlib-delete-selected" ${selectedIds.size ? '' : 'disabled'}>${escapeHtml(t('dlDeleteSelected'))}</button>
        </div>
        <p class="creaty-dlib-sync-note">${escapeHtml(t('dlSyncNote'))}</p>
      </div>
      <div class="creaty-dlib-filters">
        <button type="button" class="creaty-dlib-filter ${statusFilter === 'all' ? 'creaty-dlib-filter--active' : ''}" data-status="all">${escapeHtml(t('dlFilterAll'))}</button>
        <button type="button" class="creaty-dlib-filter ${statusFilter === DESIGN_STATUS.READY ? 'creaty-dlib-filter--active' : ''}" data-status="${DESIGN_STATUS.READY}">${escapeHtml(t('dlStatusReady'))}</button>
        <button type="button" class="creaty-dlib-filter ${statusFilter === DESIGN_STATUS.PULLED ? 'creaty-dlib-filter--active' : ''}" data-status="${DESIGN_STATUS.PULLED}">${escapeHtml(t('dlStatusPulled'))}</button>
      </div>`;
  }

  function renderGroupsPanel() {
    if (!designGroups.length) return '';
    const accountSelectOptions = accountOptions
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.email || a.id)}</option>`)
      .join('');
    return `
      <div class="creaty-dlib-groups">
        <h3 class="creaty-dlib-section-title">${escapeHtml(t('dlGroupsTitle'))}</h3>
        <p class="creaty-dlib-intro">${escapeHtml(t('dlGroupsIntro', { size: GROUP_SIZE }))}</p>
        <div class="creaty-dlib-groups-grid">
          ${designGroups.map((group, index) => {
            const statusCls = group.isPullReady
              ? 'creaty-dlib-group--ready'
              : group.isComplete
                ? 'creaty-dlib-group--complete'
                : 'creaty-dlib-group--open';
            const thumbs = group.designs.slice(0, GROUP_SIZE).map((d) => {
              const url = thumbUrls.get(d.id);
              return url
                ? `<img src="${url}" alt="" class="creaty-dlib-group-thumb" loading="lazy">`
                : `<span class="creaty-dlib-group-thumb creaty-dlib-group-thumb--empty">🖼</span>`;
            }).join('');
            const emptySlots = Math.max(0, GROUP_SIZE - group.count);
            const emptyHtml = Array.from({ length: emptySlots })
              .map(() => `<span class="creaty-dlib-group-thumb creaty-dlib-group-thumb--slot">+</span>`)
              .join('');
            const badge = group.isPullReady
              ? t('dlGroupPullReady')
              : group.isComplete
                ? t('dlGroupNeedsAssign')
                : t('dlGroupIncomplete');
            return `
              <div class="creaty-dlib-group ${statusCls}" data-group-id="${escapeHtml(group.groupId)}">
                <div class="creaty-dlib-group__head">
                  <strong>${escapeHtml(t('dlGroupLabel', { num: index + 1 }))}</strong>
                  <span>${group.count}/${GROUP_SIZE}</span>
                </div>
                <div class="creaty-dlib-group__thumbs">${thumbs}${emptyHtml}</div>
                <label class="creaty-dlib-group__assign-label">${escapeHtml(t('dlGroupAccount'))}</label>
                <select class="creaty-input creaty-select creaty-dlib-group-select" data-group-id="${escapeHtml(group.groupId)}">
                  <option value="">${escapeHtml(t('dlGroupUnassigned'))}</option>
                  ${accountSelectOptions}
                </select>
                <div class="creaty-dlib-group__meta">
                  <span class="creaty-dlib-badge">${escapeHtml(badge)}</span>
                  <span class="creaty-dlib-group-account" dir="ltr">${escapeHtml(accountLabel(group.assignedAccountId))}</span>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderDesignList() {
    if (!designs.length) {
      return `<div class="creaty-dlib-empty">
        <i class="fa-solid fa-image"></i>
        <p>${escapeHtml(t('dlEmpty'))}</p>
        <p class="creaty-dlib-empty__hint">${escapeHtml(t('dlEmptyHint'))}</p>
      </div>`;
    }
    return `
      <div class="creaty-dlib-list">
        ${designs.map((d) => {
          const thumb = thumbUrls.get(d.id)
            ? `<img src="${thumbUrls.get(d.id)}" alt="" class="creaty-dlib-item-thumb" loading="lazy">`
            : `<span class="creaty-dlib-item-thumb creaty-dlib-item-thumb--empty">🖼</span>`;
          const title = d.title || d.filename;
          return `
            <article class="creaty-dlib-item" data-design-id="${escapeHtml(d.id)}">
              <label class="creaty-dlib-item__check">
                <input type="checkbox" class="creaty-dlib-row-check" data-id="${escapeHtml(d.id)}" ${selectedIds.has(d.id) ? 'checked' : ''}>
              </label>
              ${thumb}
              <div class="creaty-dlib-item__body">
                <div class="creaty-dlib-item__title" dir="ltr">${escapeHtml(title)}</div>
                <div class="creaty-dlib-item__meta">
                  ${statusBadge(d.status)}
                  <span class="creaty-dlib-item__slot">#${(d.groupIndex ?? 0) + 1}</span>
                </div>
              </div>
              <div class="creaty-dlib-item__actions">
                <button type="button" class="creaty-dlib-icon-btn creaty-dlib-preview" data-id="${escapeHtml(d.id)}" title="${escapeHtml(t('dlPreview'))}"><i class="fa-solid fa-eye"></i></button>
                <button type="button" class="creaty-dlib-icon-btn creaty-dlib-edit" data-id="${escapeHtml(d.id)}" title="${escapeHtml(t('dlEditSeo'))}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="creaty-dlib-icon-btn creaty-dlib-move" data-id="${escapeHtml(d.id)}" title="${escapeHtml(t('dlMove'))}"><i class="fa-solid fa-arrows-up-down-left-right"></i></button>
                <button type="button" class="creaty-dlib-icon-btn creaty-dlib-delete" data-id="${escapeHtml(d.id)}" title="${escapeHtml(t('dlDelete'))}"><i class="fa-solid fa-trash"></i></button>
              </div>
            </article>`;
        }).join('')}
      </div>`;
  }

  async function rerender() {
    await refreshData();
    await loadThumbnails();
    rootEl.innerHTML = `
      <p class="creaty-dlib-intro">${escapeHtml(t('dlIntro'))}</p>
      ${renderToolbar()}
      ${renderGroupsPanel()}
      ${renderDesignList()}`;
    bindEvents();
    helpers.onRerender?.();
  }

  async function handleFiles(files) {
    const list = Array.from(files || []).filter((f) => IMAGE_TYPES.includes(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    if (!list.length) {
      showToast(t('dlInvalidFiles'), 'warn');
      return;
    }
    let added = 0;
    for (const file of list) {
      try {
        await addDesignFromFile(file);
        added += 1;
      } catch (err) {
        showToast(err.message || String(err), 'error');
      }
    }
    if (added) {
      showToast(t('dlAdded', { count: added }), 'success');
      await rerender();
      notifyCreatyDesignLibraryChanged();
    }
  }

  function openPreviewModal(id) {
    const design = designs.find((d) => d.id === id);
    const url = thumbUrls.get(id);
    if (!design || !url) return;
    const overlay = document.createElement('div');
    overlay.className = 'creaty-dlib-modal-overlay';
    overlay.innerHTML = `
      <div class="creaty-dlib-modal" role="dialog">
        <h3 class="creaty-dlib-modal__title">${escapeHtml(design.title || design.filename)}</h3>
        <img src="${url}" alt="" class="creaty-dlib-modal__img">
        <div class="creaty-dlib-modal__actions">
          <button type="button" class="creaty-btn creaty-btn--ghost" id="creaty-dlib-modal-close">${escapeHtml(t('dlClose'))}</button>
        </div>
      </div>`;
    const close = () => {
      overlay.remove();
    };
    overlay.querySelector('#creaty-dlib-modal-close')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
  }

  function openEditModal(design) {
    const tagsStr = Array.isArray(design.tags) ? design.tags.join(', ') : '';
    const overlay = document.createElement('div');
    overlay.className = 'creaty-dlib-modal-overlay';
    overlay.innerHTML = `
      <div class="creaty-dlib-modal creaty-dlib-modal--wide" role="dialog">
        <h3 class="creaty-dlib-modal__title">${escapeHtml(t('dlEditSeo'))}</h3>
        <div class="creaty-dlib-form">
          <label>${escapeHtml(t('dlColTitle'))}<input type="text" id="creaty-dlib-edit-title" class="creaty-input" dir="ltr" value="${escapeHtml(design.title || '')}" maxlength="90"></label>
          <label>${escapeHtml(t('dlMainTag'))}<input type="text" id="creaty-dlib-edit-main-tag" class="creaty-input" dir="ltr" value="${escapeHtml(design.mainTag || '')}" maxlength="38"></label>
          <label>${escapeHtml(t('dlDescription'))}<textarea id="creaty-dlib-edit-desc" class="creaty-input creaty-dlib-textarea" dir="ltr" rows="2" maxlength="240">${escapeHtml(design.description || '')}</textarea></label>
          <label>${escapeHtml(t('dlColTags'))}<textarea id="creaty-dlib-edit-tags" class="creaty-input creaty-dlib-textarea" dir="ltr" rows="2" placeholder="${escapeHtml(t('dlTagsPlaceholder'))}">${escapeHtml(tagsStr)}</textarea></label>
        </div>
        <div class="creaty-dlib-modal__actions">
          <button type="button" class="creaty-btn creaty-btn--ghost" id="creaty-dlib-edit-cancel">${escapeHtml(t('dlCancel'))}</button>
          <button type="button" class="creaty-btn creaty-btn--primary" id="creaty-dlib-edit-save">${escapeHtml(t('dlSave'))}</button>
        </div>
      </div>`;
    const close = () => overlay.remove();
    overlay.querySelector('#creaty-dlib-edit-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#creaty-dlib-edit-save')?.addEventListener('click', async () => {
      try {
        await updateDesignMeta(design.id, {
          title: overlay.querySelector('#creaty-dlib-edit-title')?.value || '',
          mainTag: overlay.querySelector('#creaty-dlib-edit-main-tag')?.value || '',
          description: overlay.querySelector('#creaty-dlib-edit-desc')?.value || '',
          tags: overlay.querySelector('#creaty-dlib-edit-tags')?.value || '',
        });
        showToast(t('dlSaved'), 'success');
        close();
        await rerender();
      } catch (err) {
        showToast(err.message || String(err), 'error');
      }
    });
    document.body.appendChild(overlay);
  }

  function openMoveModal(design) {
    const options = designGroups.map((g, i) => {
      const full = g.count >= GROUP_SIZE && g.groupId !== design.groupId;
      return `<option value="${escapeHtml(g.groupId)}" ${full ? 'disabled' : ''}>${escapeHtml(t('dlGroupLabel', { num: i + 1 }))} (${g.count}/${GROUP_SIZE})</option>`;
    }).join('');
    const overlay = document.createElement('div');
    overlay.className = 'creaty-dlib-modal-overlay';
    overlay.innerHTML = `
      <div class="creaty-dlib-modal" role="dialog">
        <h3 class="creaty-dlib-modal__title">${escapeHtml(t('dlMoveToGroup'))}</h3>
        <select id="creaty-dlib-move-target" class="creaty-input creaty-select">
          ${options}
          <option value="__new__">${escapeHtml(t('dlNewGroup'))}</option>
        </select>
        <div class="creaty-dlib-modal__actions">
          <button type="button" class="creaty-btn creaty-btn--ghost" id="creaty-dlib-move-cancel">${escapeHtml(t('dlCancel'))}</button>
          <button type="button" class="creaty-btn creaty-btn--primary" id="creaty-dlib-move-save">${escapeHtml(t('dlSave'))}</button>
        </div>
      </div>`;
    const close = () => overlay.remove();
    overlay.querySelector('#creaty-dlib-move-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#creaty-dlib-move-save')?.addEventListener('click', async () => {
      const target = overlay.querySelector('#creaty-dlib-move-target')?.value;
      if (!target) return;
      try {
        await moveDesignToGroup(design.id, target);
        showToast(t('dlMoved'), 'success');
        close();
        await rerender();
      } catch (err) {
        showToast(err.message || String(err), 'error');
      }
    });
    document.body.appendChild(overlay);
  }

  async function openSeoImportModal() {
    const queue = await loadSeoQueueItems();
    const existing = await listDesigns();
    const importedSeoIds = new Set(existing.map((d) => d.sourceSeoId).filter(Boolean));

    const itemsWithPreview = [];
    for (const item of queue) {
      const { preview } = await resolveSeoItemImage(item);
      itemsWithPreview.push({
        item,
        preview: preview || 'icon.png',
        alreadyImported: importedSeoIds.has(String(item.id)),
        hasSeo: !!(item.meta?.title || item.meta?.tags?.length),
      });
    }

    if (!itemsWithPreview.length) {
      showToast(t('dlSeoEmpty'), 'warn');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'creaty-dlib-modal-overlay';
    overlay.innerHTML = `
      <div class="creaty-dlib-modal creaty-dlib-modal--import" role="dialog">
        <h3 class="creaty-dlib-modal__title">${escapeHtml(t('dlImportSeoTitle'))}</h3>
        <p class="creaty-dlib-import-hint">${escapeHtml(t('dlImportSeoHint'))}</p>
        <div class="creaty-dlib-import-filters">
          <button type="button" class="creaty-dlib-filter creaty-dlib-filter--active" data-seo-filter="all">${escapeHtml(t('dlFilterAll'))}</button>
          <button type="button" class="creaty-dlib-filter" data-seo-filter="seo">${escapeHtml(t('dlFilterWithSeo'))}</button>
          <button type="button" class="creaty-dlib-filter" data-seo-filter="available">${escapeHtml(t('dlFilterAvailable'))}</button>
        </div>
        <div class="creaty-dlib-import-grid" id="creaty-dlib-import-grid"></div>
        <div class="creaty-dlib-modal__actions">
          <button type="button" class="creaty-btn creaty-btn--ghost" id="creaty-dlib-import-cancel">${escapeHtml(t('dlCancel'))}</button>
          <button type="button" class="creaty-btn creaty-btn--primary" id="creaty-dlib-import-confirm">${escapeHtml(t('dlImportSelected'))}</button>
        </div>
      </div>`;

    let seoFilter = 'all';
    const selectedSeoIds = new Set();

    function filteredItems() {
      return itemsWithPreview.filter((row) => {
        if (seoFilter === 'seo' && !row.hasSeo) return false;
        if (seoFilter === 'available' && row.alreadyImported) return false;
        return true;
      });
    }

    function renderImportGrid() {
      const grid = overlay.querySelector('#creaty-dlib-import-grid');
      if (!grid) return;
      const rows = filteredItems();
      grid.innerHTML = rows.map((row) => {
        const name = row.item.file?.name || row.item.name || 'design.png';
        const disabled = row.alreadyImported ? 'disabled' : '';
        const checked = selectedSeoIds.has(row.item.id) ? 'checked' : '';
        const badge = row.hasSeo ? `<span class="creaty-dlib-import-badge">SEO</span>` : '';
        const imported = row.alreadyImported ? `<span class="creaty-dlib-import-badge creaty-dlib-import-badge--done">${escapeHtml(t('dlAlreadyImported'))}</span>` : '';
        return `
          <label class="creaty-dlib-import-item ${row.alreadyImported ? 'creaty-dlib-import-item--disabled' : ''}">
            <input type="checkbox" class="creaty-dlib-import-check" data-id="${escapeHtml(row.item.id)}" ${checked} ${disabled}>
            <img src="${row.preview}" alt="" loading="lazy">
            <span class="creaty-dlib-import-name" dir="ltr" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            ${badge}${imported}
          </label>`;
      }).join('');
      grid.querySelectorAll('.creaty-dlib-import-check').forEach((cb) => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.id;
          if (cb.checked) selectedSeoIds.add(id);
          else selectedSeoIds.delete(id);
        });
      });
    }

    const close = () => overlay.remove();
    overlay.querySelector('#creaty-dlib-import-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-seo-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        seoFilter = btn.dataset.seoFilter || 'all';
        overlay.querySelectorAll('[data-seo-filter]').forEach((b) => {
          b.classList.toggle('creaty-dlib-filter--active', b.dataset.seoFilter === seoFilter);
        });
        renderImportGrid();
      });
    });
    overlay.querySelector('#creaty-dlib-import-confirm')?.addEventListener('click', async () => {
      const ids = [...selectedSeoIds];
      if (!ids.length) {
        showToast(t('dlSelectImages'), 'warn');
        return;
      }
      const toImport = ids
        .map((seoId) => itemsWithPreview.find((r) => String(r.item.id) === String(seoId)))
        .filter((row) => row && !row.alreadyImported)
        .map((row) => row.item);
      const { imported } = await importSeoQueueItems(toImport, { skipExisting: true });
      if (imported) {
        showToast(t('dlImported', { count: imported }), 'success');
        close();
        await rerender();
      } else {
        showToast(t('dlImportFailed'), 'error');
      }
    });

    document.body.appendChild(overlay);
    renderImportGrid();
  }

  function updateSelectionButtons() {
    const btn = rootEl.querySelector('#creaty-dlib-delete-selected');
    if (btn) btn.disabled = !selectedIds.size;
  }

  function bindEvents() {
    rootEl.querySelector('#creaty-dlib-file-input')?.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    });

    const dropzone = rootEl.querySelector('#creaty-dlib-dropzone');
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('creaty-dlib-dropzone--active');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('creaty-dlib-dropzone--active'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('creaty-dlib-dropzone--active');
      handleFiles(e.dataTransfer?.files);
    });
    dropzone?.addEventListener('click', () => rootEl.querySelector('#creaty-dlib-file-input')?.click());

    rootEl.querySelector('#creaty-dlib-import-seo')?.addEventListener('click', () => {
      void openSeoImportModal();
    });

    rootEl.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        statusFilter = btn.dataset.status || 'all';
        selectedIds.clear();
        await rerender();
      });
    });

    rootEl.querySelector('#creaty-dlib-auto-assign')?.addEventListener('click', async () => {
      const ids = accountOptions.map((a) => a.id);
      if (!ids.length) {
        showToast(t('dlNoAccounts'), 'warn');
        return;
      }
      const { assigned } = await autoAssignGroupsToAccounts(ids);
      showToast(t('dlGroupsAssigned', { count: assigned }), assigned ? 'success' : 'warn');
      await rerender();
    });

    rootEl.querySelector('#creaty-dlib-delete-selected')?.addEventListener('click', async () => {
      if (!selectedIds.size) return;
      for (const id of [...selectedIds]) await deleteDesign(id);
      selectedIds.clear();
      showToast(t('dlDeleted'), 'success');
      await rerender();
    });

    rootEl.querySelector('#creaty-dlib-select-all')?.addEventListener('click', () => {
      const ids = visibleDesignIds();
      if (!ids.length) return;
      if (allVisibleSelected()) {
        for (const id of ids) selectedIds.delete(id);
      } else {
        for (const id of ids) selectedIds.add(id);
      }
      updateSelectionButtons();
    });

    rootEl.querySelectorAll('.creaty-dlib-row-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateSelectionButtons();
      });
    });

    rootEl.querySelectorAll('.creaty-dlib-group-select').forEach((sel) => {
      const gid = sel.dataset.groupId;
      const group = designGroups.find((g) => g.groupId === gid);
      if (group?.assignedAccountId) sel.value = group.assignedAccountId;
      sel.addEventListener('change', async () => {
        try {
          const accountId = sel.value || null;
          await assignGroupToAccount(gid, accountId);
          showToast(t('dlGroupAssigned'), 'success');
          await rerender();
          notifyCreatyDesignLibraryChanged(accountId ? [accountId] : []);
        } catch (err) {
          showToast(err.message || String(err), 'error');
        }
      });
    });

    rootEl.querySelectorAll('.creaty-dlib-preview').forEach((btn) => {
      btn.addEventListener('click', () => openPreviewModal(btn.dataset.id));
    });
    rootEl.querySelectorAll('.creaty-dlib-edit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const design = designs.find((d) => d.id === btn.dataset.id) || await getDesign(btn.dataset.id);
        if (design) openEditModal(design);
      });
    });
    rootEl.querySelectorAll('.creaty-dlib-move').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const design = designs.find((d) => d.id === btn.dataset.id) || await getDesign(btn.dataset.id);
        if (design) openMoveModal(design);
      });
    });
    rootEl.querySelectorAll('.creaty-dlib-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await deleteDesign(btn.dataset.id);
        selectedIds.delete(btn.dataset.id);
        showToast(t('dlDeleted'), 'success');
        await rerender();
      });
    });
  }

  async function init() {
    await initDesignStore();
    if (!wired) {
      wired = true;
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.savedDesignQueue) return;
      });
      window.addEventListener('nhp:queue-rendered', () => {
        /* queue updated — import modal reads fresh data on open */
      });
      window.addEventListener('nhp:creaty-design-library-changed', () => {
        void rerender();
      });
    }
    await rerender();
  }

  void init();

  return {
    refresh: rerender,
  };
}
