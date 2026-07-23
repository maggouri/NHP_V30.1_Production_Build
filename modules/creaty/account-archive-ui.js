/**
 * CREATY Account Archive UI — Column 2 tab «مكتبة الحسابات»
 */

let wired = false;
let jsZipPromise = null;

function $(id) {
  return document.getElementById(id);
}

async function sendArchiveAction(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...payload }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(res || { success: false, error: 'empty_response' });
    });
  });
}

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  if (jsZipPromise) return jsZipPromise;
  jsZipPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('Peel Banana/src/lib/jszip.min.js');
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('jszip_load_failed'));
    document.head.appendChild(script);
  });
  return jsZipPromise;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeFilePart(email) {
  return String(email || 'account').replace(/[^a-z0-9@._-]+/gi, '_');
}

function formatArchiveStatus(row, t) {
  const day = Number(row.scheduleDay) || 0;
  const hasSched = row.scheduleStarted ? t('archiveStatusDay', { day, total: 12 }) : t('archiveStatusNoSchedule');
  const imgs = row.hasImages ? t('archiveStatusHasImages') : t('archiveStatusNoImages');
  const designs = row.designCount
    ? t('archiveStatusDesigns', { count: row.designCount })
    : t('archiveStatusNoDesigns');
  return `${hasSched} · ${imgs} · ${designs}`;
}

function renderArchiveList(rows, t) {
  const list = $('creaty-archive-list');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = `<p class="creaty-archive-empty">${t('archiveEmpty')}</p>`;
    return;
  }
  list.innerHTML = rows.map((row) => {
    const email = String(row.email || '');
    const status = formatArchiveStatus(row, t);
    const niche = row.niche ? `<span class="creaty-archive-niche">${escapeHtml(row.niche)}</span>` : '';
    const updated = row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—';
    return `
      <article class="creaty-archive-row" data-archive-email="${escapeHtml(email)}">
        <div class="creaty-archive-row__main">
          <div class="creaty-archive-row__email" dir="ltr">${escapeHtml(email)}</div>
          ${niche}
          <div class="creaty-archive-row__status">${escapeHtml(status)}</div>
          <div class="creaty-archive-row__meta">${escapeHtml(t('archiveUpdated', { date: updated }))}</div>
        </div>
        <div class="creaty-archive-row__actions">
          <button type="button" class="creaty-btn creaty-btn--ghost creaty-btn--compact" data-archive-action="zip" data-email="${escapeHtml(email)}" title="${escapeHtml(t('archiveDownload'))}">
            <i class="fa-solid fa-file-zipper"></i> ${escapeHtml(t('archiveDownload'))}
          </button>
          <button type="button" class="creaty-btn creaty-btn--ghost creaty-btn--compact" data-archive-action="json" data-email="${escapeHtml(email)}" title="${escapeHtml(t('archiveBackup'))}">
            <i class="fa-solid fa-file-export"></i> ${escapeHtml(t('archiveBackup'))}
          </button>
        </div>
      </article>`;
  }).join('');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refreshArchiveList(t, setStatus) {
  const res = await sendArchiveAction('CREATY_ARCHIVE_LIST');
  if (!res?.success) {
    setStatus?.(t('archiveLoadFailed', { error: res?.error || '?' }), 'err');
    return;
  }
  renderArchiveList(res.archives || [], t);
}

async function exportJson(email, { all = false } = {}, t, setStatus) {
  setStatus?.(t('archiveExporting'), 'busy');
  const res = await sendArchiveAction('CREATY_ARCHIVE_EXPORT_JSON', {
    accountEmail: email,
    all,
    includeDesignData: true,
  });
  if (!res?.success || !res.document) {
    setStatus?.(t('archiveExportFailed', { error: res?.error || '?' }), 'err');
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const name = all
    ? `creaty-archives-all_${stamp}.json`
    : `creaty-archive_${safeFilePart(email)}_${stamp}.json`;
  const blob = new Blob([JSON.stringify(res.document, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, name);
  setStatus?.(t('archiveExportDone', { name }), 'ok');
}

async function exportZip(email, t, setStatus) {
  setStatus?.(t('archiveExporting'), 'busy');
  const res = await sendArchiveAction('CREATY_ARCHIVE_EXPORT_JSON', {
    accountEmail: email,
    includeDesignData: true,
  });
  if (!res?.success || !res.document?.archive) {
    setStatus?.(t('archiveExportFailed', { error: res?.error || '?' }), 'err');
    return;
  }
  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const archive = res.document.archive;
    zip.file('manifest.json', JSON.stringify(res.document.manifest, null, 2));
    zip.file('archive.json', JSON.stringify(archive, null, 2));
    if (archive.storeProfile?.avatarDataUrl) {
      const blob = dataUrlToBlob(archive.storeProfile.avatarDataUrl);
      if (blob) zip.file('images/avatar.png', blob);
    }
    if (archive.storeProfile?.coverDataUrl) {
      const blob = dataUrlToBlob(archive.storeProfile.coverDataUrl);
      if (blob) zip.file('images/cover.png', blob);
    }
    (archive.designs || []).forEach((d, i) => {
      if (!d.dataUrl) return;
      const blob = dataUrlToBlob(d.dataUrl);
      if (blob) zip.file(`designs/design_${i + 1}.png`, blob);
    });
    const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(out, `creaty-archive_${safeFilePart(email)}_${stamp}.zip`);
    setStatus?.(t('archiveZipDone', { email }), 'ok');
  } catch (err) {
    setStatus?.(t('archiveExportFailed', { error: String(err?.message || err) }), 'err');
  }
}

function dataUrlToBlob(dataUrl) {
  try {
    const raw = String(dataUrl || '');
    const match = raw.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: match[1] || 'image/png' });
  } catch {
    return null;
  }
}

async function importArchiveFile(file, t, setStatus, onDone) {
  if (!file) return;
  setStatus?.(t('archiveImporting'), 'busy');
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    setStatus?.(t('archiveImportInvalid'), 'err');
    return;
  }
  const merge = $('creaty-archive-import-merge')?.checked === true;
  const res = await sendArchiveAction('CREATY_ARCHIVE_IMPORT', {
    payload,
    mode: merge ? 'merge' : 'replace',
  });
  if (!res?.success) {
    setStatus?.(t('archiveImportFailed', { error: res?.error || '?' }), 'err');
    return;
  }
  const count = res.imported ?? 1;
  setStatus?.(t('archiveImportDone', { count }), 'ok');
  await refreshArchiveList(t, setStatus);
  onDone?.(res);
}

export function initCreatyAccountArchiveUi({ t, setStatus, onImportComplete } = {}) {
  if (wired) {
    void refreshArchiveList(t, setStatus);
    return;
  }
  wired = true;

  const statusEl = $('creaty-archive-status');
  const setArchiveStatus = (text, level = 'hint') => {
    if (setStatus) setStatus(text, level);
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.className = 'creaty-archive-status';
      if (level === 'ok') statusEl.classList.add('creaty-archive-status--ok');
      else if (level === 'err') statusEl.classList.add('creaty-archive-status--err');
      else if (level === 'busy') statusEl.classList.add('creaty-archive-status--busy');
    }
  };

  $('creaty-archive-refresh-btn')?.addEventListener('click', () => {
    void refreshArchiveList(t, setArchiveStatus);
  });

  $('creaty-archive-save-all-btn')?.addEventListener('click', async () => {
    setArchiveStatus(t('archiveSavingAll'), 'busy');
    const res = await sendArchiveAction('CREATY_ARCHIVE_SNAPSHOT_ALL', {
      eventNote: 'manual_snapshot_all',
    });
    if (!res?.success) {
      setArchiveStatus(t('archiveSaveFailed', { error: res?.error || '?' }), 'err');
      return;
    }
    setArchiveStatus(t('archiveSaveAllDone', { count: res.saved || 0 }), 'ok');
    void refreshArchiveList(t, setArchiveStatus);
  });

  $('creaty-archive-download-all-btn')?.addEventListener('click', () => {
    void exportJson('', { all: true }, t, setArchiveStatus);
  });

  $('creaty-archive-import-btn')?.addEventListener('click', () => {
    $('creaty-archive-import-file')?.click();
  });

  $('creaty-archive-import-file')?.addEventListener('change', () => {
    const file = $('creaty-archive-import-file')?.files?.[0];
    void importArchiveFile(file, t, setArchiveStatus, onImportComplete);
    if ($('creaty-archive-import-file')) $('creaty-archive-import-file').value = '';
  });

  $('creaty-archive-list')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-archive-action]');
    if (!btn) return;
    const email = btn.getAttribute('data-email') || '';
    const action = btn.getAttribute('data-archive-action');
    if (action === 'json') void exportJson(email, {}, t, setArchiveStatus);
    else if (action === 'zip') void exportZip(email, t, setArchiveStatus);
  });

  void refreshArchiveList(t, setArchiveStatus);
}

export async function queueAccountArchiveSave(email, eventNote = '') {
  if (!email) return;
  await sendArchiveAction('CREATY_ARCHIVE_QUEUE_SAVE', { accountEmail: email, eventNote });
}
