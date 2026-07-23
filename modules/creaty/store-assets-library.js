/**
 * CREATY Store Assets Library — Avatar/Cover assets for store setup.
 */

const STORE_ASSETS_DB = 'creaty-store-assets-library';
const STORE_ASSETS_VERSION = 1;
const ASSET_STORE = 'assets';
const ASSET_BLOB_STORE = 'blobs';
const GENERATE_PORTS = [3019, 3024];

let assetDbPromise = null;

function openAssetDb() {
  if (assetDbPromise) return assetDbPromise;
  assetDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(STORE_ASSETS_DB, STORE_ASSETS_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        const store = db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('topic', 'topic', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(ASSET_BLOB_STORE)) {
        db.createObjectStore(ASSET_BLOB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return assetDbPromise;
}

function newId() {
  return `csa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeTopic(topic) {
  return String(topic || '').trim() || 'غير مصنف';
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] || 'image/png' });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function listStoreAssets() {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, 'readonly');
    const req = tx.objectStore(ASSET_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

export async function getStoreAssetBlob(id) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_BLOB_STORE, 'readonly');
    const req = tx.objectStore(ASSET_BLOB_STORE).get(String(id));
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addStoreAssetFromBlob(blob, meta = {}) {
  if (!(blob instanceof Blob)) throw new Error('Invalid blob');
  const type = String(meta.type || '').toLowerCase() === 'cover' ? 'cover' : 'avatar';
  const createdAt = new Date().toISOString();
  const id = newId();
  const row = {
    id,
    type,
    topic: normalizeTopic(meta.topic),
    title: String(meta.title || `${type} ${normalizeTopic(meta.topic)}`).trim(),
    filename: String(meta.filename || `${type}.png`).trim(),
    mimeType: blob.type || meta.mimeType || 'image/png',
    size: blob.size,
    source: meta.source || 'manual',
    createdAt,
    updatedAt: createdAt,
  };
  const db = await openAssetDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([ASSET_STORE, ASSET_BLOB_STORE], 'readwrite');
    tx.objectStore(ASSET_STORE).put(row);
    tx.objectStore(ASSET_BLOB_STORE).put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent('nhp:creaty-store-assets-changed'));
  return row;
}

export async function deleteStoreAsset(id) {
  const db = await openAssetDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([ASSET_STORE, ASSET_BLOB_STORE], 'readwrite');
    tx.objectStore(ASSET_STORE).delete(String(id));
    tx.objectStore(ASSET_BLOB_STORE).delete(String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent('nhp:creaty-store-assets-changed'));
}

async function getCliProxyKeys() {
  const stored = await chrome.storage.local.get(['nhpProxyBaseUrl', 'nhpGptApiKey', 'nhpAdminAiKeys']);
  const admin = stored.nhpAdminAiKeys && typeof stored.nhpAdminAiKeys === 'object' ? stored.nhpAdminAiKeys : {};
  return {
    apiKey: String(stored.nhpGptApiKey || admin.gpt || '').trim(),
    baseUrl: String(stored.nhpProxyBaseUrl || admin.baseUrl || 'https://cliproxyapi-ywrp.onrender.com/v1').trim(),
    imageModel: String(admin.imageModel || admin.image_model || 'auto').trim(),
  };
}

async function resolveGeneratePort() {
  for (const port of GENERATE_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/generate/health`, { signal: AbortSignal.timeout(2500) });
      if (res.status !== 404) return port;
    } catch { /* try next */ }
  }
  return GENERATE_PORTS[0];
}

function buildPrompt({ type, topic, prompt }) {
  const kind = type === 'cover' ? 'wide TeePublic store cover banner' : 'square TeePublic store avatar';
  const ratio = type === 'cover' ? 'wide 4:1 banner composition' : 'square 1:1 profile composition';
  return [
    `Generate ${kind}.`,
    `Topic/theme: ${topic}.`,
    prompt ? `User direction: ${prompt}.` : '',
    ratio,
    'Cohesive POD brand look, clean readable subject, no watermark, no text overlay, no product mockup, no shirt, no border.',
  ].filter(Boolean).join(' ');
}

async function generateStoreAssets({ type, topic, prompt, count = 4 }) {
  const keys = await getCliProxyKeys();
  if (!keys.apiKey) throw new Error('NHP API key missing');
  const port = await resolveGeneratePort();
  const form = new FormData();
  form.append('prompt', buildPrompt({ type, topic, prompt }));
  form.append('mode', 'text');
  form.append('aiProvider', 'auto');
  form.append('count', String(Number(count) >= 8 ? 8 : 4));
  form.append('quality', 'balanced');
  form.append('styleMode', 'auto');
  form.append('sync', '1');
  form.append('apiKey', keys.apiKey);
  form.append('baseUrl', keys.baseUrl);
  if (keys.imageModel) form.append('imageModel', keys.imageModel);

  const res = await fetch(`http://127.0.0.1:${port}/api/generate`, {
    method: 'POST',
    headers: { 'X-NHP-Api-Key': keys.apiKey },
    body: form,
    signal: AbortSignal.timeout(720000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) throw new Error(data?.error || `Generate failed (${res.status})`);
  const images = (Array.isArray(data.images) ? data.images : []).filter((img) => img?.dataUrl);
  const splitImages = images.filter((img) => /^design_\d+\.png$/i.test(String(img.filename || '')));
  return splitImages.length ? splitImages : images;
}

export function initCreatyStoreAssetsLibrary(rootEl, helpers = {}) {
  const showToast = helpers.showToast || (() => {});
  let assets = [];
  let thumbs = new Map();
  let activeTab = helpers.initialTab === 'generator' ? 'generator' : 'assets';
  let filter = 'all';

  async function refresh() {
    for (const url of thumbs.values()) URL.revokeObjectURL(url);
    thumbs.clear();
    assets = await listStoreAssets();
    for (const asset of assets) {
      const blob = await getStoreAssetBlob(asset.id);
      if (blob) thumbs.set(asset.id, URL.createObjectURL(blob));
    }
    render();
  }

  function renderTabs() {
    return `
      <div class="creaty-store-assets-tabs">
        <button type="button" class="${activeTab === 'assets' ? 'active' : ''}" data-sa-tab="assets">Avatar / Cover</button>
        <button type="button" class="${activeTab === 'generator' ? 'active' : ''}" data-sa-tab="generator">مولد الصور</button>
      </div>`;
  }

  function renderAssets() {
    const shown = assets.filter((a) => filter === 'all' || a.type === filter);
    const cards = shown.map((a) => `
      <article class="creaty-store-asset-card">
        <img src="${escapeHtml(thumbs.get(a.id) || '')}" alt="">
        <div>
          <strong>${escapeHtml(a.title)}</strong>
          <span>${escapeHtml(a.type)} · ${escapeHtml(a.topic)}</span>
        </div>
        <button type="button" class="creaty-dlib-icon-btn" data-sa-delete="${escapeHtml(a.id)}" title="حذف"><i class="fa-solid fa-trash"></i></button>
      </article>`).join('');
    return `
      <div class="creaty-store-assets-toolbar">
        <label class="creaty-btn creaty-btn--primary creaty-btn--compact">
          <i class="fa-solid fa-upload"></i> رفع يدوي
          <input type="file" id="creaty-store-assets-file" accept="image/png,image/jpeg,image/webp" multiple hidden>
        </label>
        <input id="creaty-store-assets-topic" class="creaty-input" placeholder="الموضوع / niche">
        <select id="creaty-store-assets-type" class="creaty-input creaty-select">
          <option value="avatar">Avatar</option>
          <option value="cover">Cover</option>
        </select>
      </div>
      <div class="creaty-store-assets-filters">
        <button type="button" data-sa-filter="all" class="${filter === 'all' ? 'active' : ''}">الكل</button>
        <button type="button" data-sa-filter="avatar" class="${filter === 'avatar' ? 'active' : ''}">Avatar</button>
        <button type="button" data-sa-filter="cover" class="${filter === 'cover' ? 'active' : ''}">Cover</button>
      </div>
      <div class="creaty-store-assets-grid">${cards || '<p class="creaty-dlib-empty__hint">لا توجد صور Avatar/Cover بعد.</p>'}</div>`;
  }

  function renderGenerator() {
    return `
      <div class="creaty-store-assets-generator">
        <select id="creaty-store-gen-type" class="creaty-input creaty-select">
          <option value="avatar">Avatar</option>
          <option value="cover">Cover</option>
        </select>
        <input id="creaty-store-gen-topic" class="creaty-input" placeholder="الموضوع / niche">
        <textarea id="creaty-store-gen-prompt" class="creaty-input creaty-textarea" rows="4" placeholder="وصف إضافي مثل أسلوب الرسم والألوان..."></textarea>
        <button type="button" id="creaty-store-gen-run" class="creaty-btn creaty-btn--ai">
          <i class="fa-solid fa-wand-magic-sparkles"></i> توليد وحفظ في المكتبة
        </button>
        <p id="creaty-store-gen-status" class="creaty-store-assets-status">جاهز</p>
      </div>`;
  }

  function render() {
    if (!rootEl) return;
    rootEl.innerHTML = `${renderTabs()}${activeTab === 'generator' ? renderGenerator() : renderAssets()}`;
    bind();
  }

  function bind() {
    rootEl.querySelectorAll('[data-sa-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.saTab;
        render();
      });
    });
    rootEl.querySelectorAll('[data-sa-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.saFilter || 'all';
        render();
      });
    });
    rootEl.querySelector('#creaty-store-assets-file')?.addEventListener('change', async (ev) => {
      const topic = normalizeTopic(rootEl.querySelector('#creaty-store-assets-topic')?.value);
      const type = rootEl.querySelector('#creaty-store-assets-type')?.value || 'avatar';
      for (const file of Array.from(ev.target.files || [])) {
        await addStoreAssetFromBlob(file, { type, topic, filename: file.name, source: 'manual' });
      }
      showToast('تم حفظ صور المتجر');
      await refresh();
    });
    rootEl.querySelectorAll('[data-sa-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await deleteStoreAsset(btn.dataset.saDelete);
        await refresh();
      });
    });
    rootEl.querySelector('#creaty-store-gen-run')?.addEventListener('click', async () => {
      const status = rootEl.querySelector('#creaty-store-gen-status');
      const type = rootEl.querySelector('#creaty-store-gen-type')?.value || 'avatar';
      const topic = normalizeTopic(rootEl.querySelector('#creaty-store-gen-topic')?.value);
      const prompt = rootEl.querySelector('#creaty-store-gen-prompt')?.value || '';
      try {
        if (status) status.textContent = 'جار التوليد عبر GENERAT...';
        const images = await generateStoreAssets({ type, topic, prompt });
        let saved = 0;
        for (const img of images) {
          const blob = dataUrlToBlob(img.dataUrl);
          if (!blob) continue;
          await addStoreAssetFromBlob(blob, {
            type,
            topic,
            filename: img.filename || `${type}.png`,
            title: `${type} ${topic} ${saved + 1}`,
            source: 'generate',
          });
          saved += 1;
        }
        if (status) status.textContent = `تم حفظ ${saved} صورة في ${type}`;
        showToast(`تم حفظ ${saved} صورة`);
        activeTab = 'assets';
        await refresh();
      } catch (err) {
        if (status) status.textContent = `فشل التوليد: ${err.message}`;
      }
    });
  }

  window.addEventListener('nhp:creaty-store-assets-changed', () => { void refresh(); });
  void refresh();
  return { refresh };
}
