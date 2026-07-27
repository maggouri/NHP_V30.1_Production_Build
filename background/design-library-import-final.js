/**
 * Official Local NHP40 receiver for EmailCore DAM contract:
 *   design_library.import_final v1.0.0
 *
 * W6 Edited Library → Send To Local NHP40 → bridge → download final asset →
 * validate → save to local Edited Library → ack statuses.
 *
 * Never re-processes images. Never deletes W6 originals on local delete.
 * Prefer URL/Blob over Base64. Never log tokens/cookies.
 */
(function initDesignLibraryImportFinalReceiver(globalScope) {
  const CONTRACT_TYPE = 'design_library.import_final';
  const CONTRACT_VERSION = '1.0.1';
  const CONTRACT_VERSIONS_ACCEPTED = ['1.0.0', '1.0.1'];
  const DEDUPE_STORAGE_KEY = 'nhp40_import_final_dedupe_v1';
  const GHOST_UPLOAD_URL = 'http://127.0.0.1:3019/api/library/upload';
  const BADGE_LABEL = 'From EmailCore';
  const ALLOWED_HOST_SUFFIXES = [
    'emailcore.app',
    'nocochat.com',
    'localhost',
    '127.0.0.1',
  ];

  function safeStr(v) {
    return String(v == null ? '' : v).trim();
  }

  function dedupeKey(contract) {
    return [
      safeStr(contract.designId),
      safeStr(contract.editedVersion || contract.processingVersion || 'v1'),
      safeStr(contract.checksum || contract.editedObjectKey || ''),
    ].join('::');
  }

  async function loadDedupeMap() {
    try {
      const stored = await chrome.storage.local.get([DEDUPE_STORAGE_KEY]);
      const map = stored[DEDUPE_STORAGE_KEY];
      return map && typeof map === 'object' ? map : {};
    } catch {
      return {};
    }
  }

  async function rememberDedupe(key, meta) {
    const map = await loadDedupeMap();
    map[key] = {
      at: new Date().toISOString(),
      localLibraryId: meta?.localLibraryId || null,
      designId: meta?.designId || null,
    };
    const keys = Object.keys(map);
    if (keys.length > 2000) {
      keys.slice(0, keys.length - 1500).forEach((k) => { delete map[k]; });
    }
    await chrome.storage.local.set({ [DEDUPE_STORAGE_KEY]: map });
  }

  function assertOriginAllowed(mediaUrl, apiBase) {
    let host = '';
    try {
      host = new URL(mediaUrl, apiBase || 'https://emailcore.app').hostname.toLowerCase();
    } catch {
      const err = new Error('invalid_media_url');
      err.code = 'INVALID_ORIGIN';
      throw err;
    }
    const ok = ALLOWED_HOST_SUFFIXES.some((suffix) => (
      host === suffix || host.endsWith(`.${suffix}`)
    ));
    if (!ok) {
      const err = new Error(`origin_not_allowed:${host}`);
      err.code = 'ORIGIN_REJECTED';
      throw err;
    }
    return host;
  }

  function assertNoPathTraversal(objectKey) {
    const key = safeStr(objectKey);
    if (!key) return;
    if (key.includes('..') || key.includes('\\') || key.startsWith('/') || key.includes('\0')) {
      const err = new Error('path_traversal_rejected');
      err.code = 'PATH_TRAVERSAL';
      throw err;
    }
  }

  function validateContractShape(contract) {
    if (!contract || typeof contract !== 'object') {
      const err = new Error('missing_contract');
      err.code = 'INVALID_CONTRACT';
      throw err;
    }
    if (safeStr(contract.type) !== CONTRACT_TYPE) {
      const err = new Error(`unexpected_type:${contract.type}`);
      err.code = 'INVALID_CONTRACT_TYPE';
      throw err;
    }
    const ver = safeStr(contract.version || contract.contractVersion);
    if (ver && !CONTRACT_VERSIONS_ACCEPTED.includes(ver)) {
      const err = new Error(`unsupported_contractVersion:${ver}`);
      err.code = 'UNSUPPORTED_CONTRACT_VERSION';
      throw err;
    }
    if (!safeStr(contract.designId)) {
      const err = new Error('designId_required');
      err.code = 'MISSING_DESIGN_ID';
      throw err;
    }
    if (!safeStr(contract.editedObjectKey) && !safeStr(contract.asset?.mediaUrl || contract.asset?.objectKey)) {
      const err = new Error('editedObjectKey_or_mediaUrl_required');
      err.code = 'MISSING_ASSET_REF';
      throw err;
    }
    assertNoPathTraversal(contract.editedObjectKey || contract.asset?.objectKey);
  }

  async function resolveAuth() {
    const CREATY_STORAGE_KEYS = globalScope.CREATY_STORAGE_KEYS || {
      apiBase: 'emailcore_creaty_api_base',
      userId: 'emailcore_creaty_user_id',
      token: 'emailcore_creaty_token',
    };
    const stored = await chrome.storage.local.get([
      CREATY_STORAGE_KEYS.apiBase,
      CREATY_STORAGE_KEYS.userId,
      CREATY_STORAGE_KEYS.token,
    ]);
    const apiBase = safeStr(
      (typeof globalScope.normalizeEmailCoreApiBase === 'function'
        ? globalScope.normalizeEmailCoreApiBase(stored[CREATY_STORAGE_KEYS.apiBase])
        : stored[CREATY_STORAGE_KEYS.apiBase])
      || 'https://emailcore.app',
    ).replace(/\/$/, '');
    const userId = safeStr(stored[CREATY_STORAGE_KEYS.userId]);
    const token = safeStr(stored[CREATY_STORAGE_KEYS.token]);
    if (!userId || !token) {
      const err = new Error('missing_link_session');
      err.code = 'LINK_SESSION_REQUIRED';
      throw err;
    }
    return { apiBase, userId, token };
  }

  async function downloadFinalAsset(contract, auth) {
    const objectKey = safeStr(contract.editedObjectKey || contract.asset?.objectKey);
    let mediaUrl = safeStr(contract.asset?.mediaUrl || '');
    if (!mediaUrl && objectKey) {
      mediaUrl = `${auth.apiBase}/api/extension/designs/media?key=${encodeURIComponent(objectKey)}`;
    }
    if (!mediaUrl) {
      const err = new Error('no_media_url');
      err.code = 'MISSING_MEDIA_URL';
      throw err;
    }
    assertOriginAllowed(mediaUrl, auth.apiBase);

    const absolute = mediaUrl.startsWith('http')
      ? mediaUrl
      : `${auth.apiBase}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
    const url = new URL(absolute);
    if (!url.searchParams.get('userId')) url.searchParams.set('userId', auth.userId);

    const res = await fetch(url.toString(), {
      headers: {
        'x-creaty-token': auth.token,
        'x-extension-id': chrome.runtime.id,
      },
    });
    if (!res.ok) {
      const err = new Error(`download_http_${res.status}`);
      err.code = 'DOWNLOAD_FAILED';
      throw err;
    }
    const blob = await res.blob();
    if (!blob || !blob.size) {
      const err = new Error('empty_blob');
      err.code = 'EMPTY_ASSET';
      throw err;
    }
    return { blob, mediaUrl: url.toString(), objectKey };
  }

  async function validateBlob(contract, blob) {
    const mime = safeStr(blob.type || contract.mimeType || 'image/png').toLowerCase();
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(mime)) {
      const err = new Error(`invalid_mime:${mime || 'unknown'}`);
      err.code = 'INVALID_MIME';
      throw err;
    }
    const maxBytes = Number(contract.sizeBytes) > 0
      ? Math.max(Number(contract.sizeBytes) * 2, 25 * 1024 * 1024)
      : 40 * 1024 * 1024;
    if (blob.size > maxBytes) {
      const err = new Error(`size_exceeded:${blob.size}`);
      err.code = 'SIZE_EXCEEDED';
      throw err;
    }
    // Soft dimension check when browser Image is available (MV3 worker may lack it).
    return { mime, size: blob.size };
  }

  async function saveToLocalEditedLibrary(contract, blob, auth) {
    const displayName = safeStr(contract.displayName) || `EmailCore ${contract.designId}`;
    const fileName = `${displayName.replace(/[^\w\u0600-\u06FF.\s-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'edited'}.png`;
    const form = new FormData();
    // Ghost accepts either `file` or `image`
    form.append('file', blob, fileName);
    form.append('image', blob, fileName);
    form.append('displayName', displayName);
    form.append('source', 'emailcore');
    form.append('versionLabel', BADGE_LABEL);
    form.append('badge', BADGE_LABEL);
    form.append('fromEmailCore', '1');
    form.append('w6DesignId', safeStr(contract.designId));
    form.append('editedVersion', safeStr(contract.editedVersion || 'v1'));
    if (contract.checksum) form.append('checksum', safeStr(contract.checksum));
    if (contract.editedObjectKey) form.append('oracleObjectKey', safeStr(contract.editedObjectKey));
    if (contract.nicheId) form.append('nicheId', safeStr(contract.nicheId));
    if (contract.nicheName) form.append('nicheName', safeStr(contract.nicheName));
    if (contract.nicheName) form.append('niche', safeStr(contract.nicheName));
    // originalDesignId marks local Edited Library (not Generated).
    form.append('originalDesignId', safeStr(contract.designId));
    form.append('siteDesignId', safeStr(contract.designId));
    if (auth?.userId) form.append('siteUserId', String(auth.userId));
    form.append('metadata', JSON.stringify({
      fromEmailCore: true,
      badge: BADGE_LABEL,
      contractType: CONTRACT_TYPE,
      contractVersion: CONTRACT_VERSION,
      designId: contract.designId,
      editedVersion: contract.editedVersion,
      checksum: contract.checksum,
      editedObjectKey: contract.editedObjectKey,
      nicheId: contract.nicheId || null,
      nicheName: contract.nicheName || null,
      deleteLocalOnly: true,
      neverDeleteW6Original: true,
      width: contract.width,
      height: contract.height,
      dpi: contract.dpi,
    }));

    const res = await fetch(GHOST_UPLOAD_URL, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (data?.skipped || /duplicate|already exists|موجود/i.test(String(data?.error || ''))) {
      return {
        status: 'duplicate',
        localLibraryId: data?.id || data?.libraryId || data?.item?.id || null,
        data,
      };
    }
    if (!res.ok || data?.success === false) {
      const err = new Error(data?.error || `ghost_upload_http_${res.status}`);
      err.code = 'SAVE_FAILED';
      throw err;
    }
    return {
      status: 'imported',
      localLibraryId: data?.id || data?.libraryId || data?.item?.id || null,
      data,
    };
  }

  async function importOneContract(rawContract, { outboxId = null } = {}) {
    const stages = [];
    const mark = (status) => { stages.push(status); return status; };
    mark('accepted');

    try {
      validateContractShape(rawContract);
      const key = dedupeKey(rawContract);
      const dedupe = await loadDedupeMap();
      if (dedupe[key]) {
        return {
          ok: true,
          status: 'duplicate',
          designId: rawContract.designId,
          editedVersion: rawContract.editedVersion,
          checksum: rawContract.checksum,
          localLibraryId: dedupe[key].localLibraryId || null,
          stages: [...stages, 'duplicate'],
          outboxId,
        };
      }

      const auth = await resolveAuth();
      mark('downloading');
      const { blob } = await downloadFinalAsset(rawContract, auth);
      mark('validating');
      await validateBlob(rawContract, blob);
      mark('saving');
      const saved = await saveToLocalEditedLibrary(rawContract, blob, auth);
      if (saved.status === 'imported' || saved.status === 'duplicate') {
        await rememberDedupe(key, {
          localLibraryId: saved.localLibraryId,
          designId: rawContract.designId,
        });
      }
      try {
        chrome.runtime.sendMessage({
          action: 'GENERATE_LIBRARY_REFRESH',
          source: 'design_library.import_final',
        });
      } catch { /* ignore */ }

      return {
        ok: true,
        status: saved.status,
        designId: rawContract.designId,
        editedVersion: rawContract.editedVersion,
        checksum: rawContract.checksum,
        localLibraryId: saved.localLibraryId,
        stages: [...stages, saved.status],
        outboxId,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'failed',
        designId: rawContract?.designId || null,
        error: err?.message || String(err),
        code: err?.code || 'IMPORT_FAILED',
        stages: [...stages, 'failed'],
        outboxId,
      };
    }
  }

  async function importFinalContracts(payload = {}) {
    const list = Array.isArray(payload.contracts)
      ? payload.contracts
      : (payload.contract ? [payload.contract] : []);
    if (!list.length) {
      return {
        success: false,
        ok: false,
        status: 'failed',
        error: 'no_contracts',
        imported: 0,
        duplicate: 0,
        failed: 0,
      };
    }

    const items = [];
    let imported = 0;
    let duplicate = 0;
    let failed = 0;
    for (const contract of list) {
      const one = await importOneContract(contract, { outboxId: payload.outboxId || null });
      items.push(one);
      if (one.status === 'imported') imported += 1;
      else if (one.status === 'duplicate') duplicate += 1;
      else failed += 1;
    }

    const first = items[0] || {};
    return {
      success: failed === 0,
      ok: failed === 0,
      status: items.length === 1
        ? first.status
        : (failed ? 'failed' : (imported ? 'imported' : 'duplicate')),
      imported,
      duplicate,
      failed,
      listed: list.length,
      items,
      localLibraryId: first.localLibraryId || null,
      designId: first.designId || null,
    };
  }

  globalScope.NHP40_IMPORT_FINAL = {
    CONTRACT_TYPE,
    CONTRACT_VERSION,
    importFinalContracts,
    importOneContract,
    dedupeKey,
  };
})(typeof self !== 'undefined' ? self : globalThis);
