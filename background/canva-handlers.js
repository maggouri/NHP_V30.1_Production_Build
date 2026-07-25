/**
 * Canva Bridge — popup windows, OAuth, editor save-bar (background service worker).
 * Loaded via importScripts from background.js; relies on getGhostServerUrl at call time.
 */
(function (global) {
    'use strict';
const CANVA_POPUP_SESSION_KEY = 'nhpCanvaPopupRef';
const CANVA_BATCH_POPUP_SESSION_KEY = 'nhpCanvaBatchPopups';
const CANVA_POPUP_RECENT_MS = 30 * 60 * 1000;
let canvaPopupWindowId = null;
let canvaPopupTabId = null;
let canvaPopupEditUrl = null;
let canvaPopupOpenedAt = 0;
let canvaPopupDesignId = null;
let canvaPopupLibraryId = null;
let canvaPopupBlank = false;
let canvaPopupTitle = '';
const canvaPopupTabWatchers = new Map();
const canvaOAuthPopupWatchers = new Map();

function isCanvaOAuthCallbackUrl(url = '') {
    const raw = String(url || '').trim();
    return /\/api\/canva\/auth\/callback(?:\?|$)/i.test(raw)
        && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(raw);
}

function notifyCanvaOAuthComplete() {
    try {
        chrome.runtime.sendMessage({ action: 'CANVA_OAUTH_COMPLETE' }).catch(() => {});
    } catch (_) {}
}

function watchCanvaOAuthPopup(windowId, tabId) {
    const key = typeof tabId === 'number' ? `tab:${tabId}` : `win:${windowId}`;
    const existing = canvaOAuthPopupWatchers.get(key);
    if (existing?.cleanup) existing.cleanup();

    let closed = false;
    const cleanup = () => {
        chrome.tabs.onUpdated.removeListener(listener);
        canvaOAuthPopupWatchers.delete(key);
    };

    const closePopup = async () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
            if (typeof windowId === 'number') await chrome.windows.remove(windowId);
        } catch (_) {}
        notifyCanvaOAuthComplete();
    };

    const listener = (updatedTabId, changeInfo, tab) => {
        if (typeof tabId === 'number' && updatedTabId !== tabId) return;
        if (typeof windowId === 'number' && tab?.windowId !== windowId) return;
        const url = String(changeInfo.url || (changeInfo.status === 'complete' ? tab?.url : '') || '');
        if (!isCanvaOAuthCallbackUrl(url)) return;
        setTimeout(() => { void closePopup(); }, 1200);
    };

    canvaOAuthPopupWatchers.set(key, { cleanup, closePopup });
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(cleanup, 10 * 60 * 1000);
}

function extractCanvaDesignIdFromUrl(url = '') {
    try {
        const raw = String(url || '');
        // API token URLs (canva.com/api/design/{jwt}/edit) — real design id is not in the path
        if (/canva\.com\/api\/design\//i.test(raw)) return '';
        const m = raw.match(/canva\.com\/design\/([A-Za-z0-9_-]+)/i);
        return m ? m[1] : '';
    } catch (_) {
        return '';
    }
}

function isCanvaEditorTabUrl(url = '') {
    const raw = String(url || '').trim();
    if (!raw || !/canva\.com/i.test(raw)) return false;
    if (/canva\.com\/api\/design\//i.test(raw)) return true;
    return /canva\.com\/design\/[A-Za-z0-9_-]+/i.test(raw);
}

function canvaEditUrlMatchesDesign(url = '', designId = '') {
    const raw = String(url || '').trim();
    const id = String(designId || '').trim();
    if (!raw) return false;
    if (id && new RegExp(`/design/${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`, 'i').test(raw)) return true;
    return /canva\.com\/(?:api\/)?design\/[^/?#]+\/edit/i.test(raw);
}

function isRecentCanvaPopupEntry(entry, now = Date.now()) {
    if (!entry || typeof entry !== 'object') return false;
    const openedAt = Number(entry.openedAt) || 0;
    return !openedAt || (now - openedAt) <= CANVA_POPUP_RECENT_MS;
}

async function storeCanvaPopupRef({
    windowId = null,
    tabId = null,
    editUrl = '',
    designId = '',
    libraryId = '',
    blank = false,
    title = '',
    isFallbackTab = false,
    openedAt = null
} = {}) {
    const prior = await loadCanvaPopupRef();
    const ref = {
        windowId: typeof windowId === 'number' ? windowId : null,
        tabId: typeof tabId === 'number' ? tabId : null,
        editUrl: String(editUrl || prior?.editUrl || '').trim(),
        designId: String(designId || prior?.designId || extractCanvaDesignIdFromUrl(editUrl || prior?.editUrl || '')).trim(),
        libraryId: String(libraryId || prior?.libraryId || '').trim(),
        blank: !!(blank || prior?.blank),
        title: String(title || prior?.title || '').trim(),
        isFallbackTab: !!isFallbackTab,
        openedAt: Number(openedAt) || Number(prior?.openedAt) || Date.now()
    };
    canvaPopupWindowId = ref.windowId;
    canvaPopupTabId = ref.tabId;
    canvaPopupEditUrl = ref.editUrl;
    canvaPopupOpenedAt = ref.openedAt;
    canvaPopupDesignId = ref.designId || null;
    canvaPopupLibraryId = ref.libraryId || null;
    canvaPopupBlank = ref.blank;
    canvaPopupTitle = ref.title;
    try {
        await chrome.storage.session.set({ [CANVA_POPUP_SESSION_KEY]: ref });
    } catch (_) {
    }
    return ref;
}

async function loadCanvaPopupRef() {
    if (canvaPopupWindowId || canvaPopupTabId) {
        return {
            windowId: canvaPopupWindowId,
            tabId: canvaPopupTabId,
            editUrl: canvaPopupEditUrl,
            designId: canvaPopupDesignId || '',
            libraryId: canvaPopupLibraryId || '',
            blank: !!canvaPopupBlank,
            title: canvaPopupTitle || '',
            openedAt: canvaPopupOpenedAt
        };
    }
    try {
        const stored = await chrome.storage.session.get([CANVA_POPUP_SESSION_KEY]);
        const ref = stored?.[CANVA_POPUP_SESSION_KEY];
        if (ref && typeof ref === 'object') {
            canvaPopupWindowId = typeof ref.windowId === 'number' ? ref.windowId : null;
            canvaPopupTabId = typeof ref.tabId === 'number' ? ref.tabId : null;
            canvaPopupEditUrl = String(ref.editUrl || '').trim();
            canvaPopupDesignId = String(ref.designId || '').trim() || null;
            canvaPopupLibraryId = String(ref.libraryId || '').trim() || null;
            canvaPopupBlank = !!ref.blank;
            canvaPopupTitle = String(ref.title || '').trim();
            canvaPopupOpenedAt = Number(ref.openedAt) || 0;
            return ref;
        }
    } catch (_) {
    }
    return null;
}

async function clearCanvaPopupRef() {
    canvaPopupWindowId = null;
    canvaPopupTabId = null;
    canvaPopupEditUrl = null;
    canvaPopupOpenedAt = 0;
    canvaPopupDesignId = null;
    canvaPopupLibraryId = null;
    canvaPopupBlank = false;
    canvaPopupTitle = '';
    try {
        await chrome.storage.session.remove([CANVA_POPUP_SESSION_KEY]);
    } catch (_) {
    }
}

async function loadCanvaBatchPopupRefs() {
    try {
        const stored = await chrome.storage.session.get([CANVA_BATCH_POPUP_SESSION_KEY]);
        const batch = stored?.[CANVA_BATCH_POPUP_SESSION_KEY];
        return Array.isArray(batch) ? batch.filter((entry) => entry && typeof entry === 'object') : [];
    } catch (_) {
        return [];
    }
}

async function storeCanvaBatchPopupEntry({
    libraryId = '',
    designId = '',
    windowId = null,
    tabId = null,
    editUrl = '',
    isFallbackTab = false,
    blank = false,
    title = ''
} = {}) {
    const libId = String(libraryId || '').trim();
    const desId = String(designId || '').trim();
    const isBlank = !!blank || (!libId && !!desId);
    const entry = {
        libraryId: libId,
        designId: desId,
        windowId: typeof windowId === 'number' ? windowId : null,
        tabId: typeof tabId === 'number' ? tabId : null,
        editUrl: String(editUrl || '').trim(),
        isFallbackTab: !!isFallbackTab,
        blank: isBlank,
        title: String(title || (isBlank ? 'NHP Blank 5000×5000' : '')).trim(),
        openedAt: Date.now()
    };
    const batch = await loadCanvaBatchPopupRefs();
    const idx = batch.findIndex((item) => {
        if (entry.libraryId && item.libraryId === entry.libraryId) return true;
        if (entry.designId && item.designId === entry.designId) return true;
        return false;
    });
    if (idx >= 0) {
        entry.openedAt = Number(batch[idx].openedAt) || entry.openedAt;
        batch[idx] = entry;
    } else batch.push(entry);
    try {
        await chrome.storage.session.set({ [CANVA_BATCH_POPUP_SESSION_KEY]: batch });
    } catch (_) {
    }
    return entry;
}

async function touchCanvaBatchPopupEntry({
    libraryId = '',
    designId = '',
    windowId = null,
    tabId = null
} = {}) {
    const libId = String(libraryId || '').trim();
    const desId = String(designId || '').trim();
    const batch = await loadCanvaBatchPopupRefs();
    const now = Date.now();
    let touched = false;
    const next = batch.map((item) => {
        const match = (libId && item.libraryId === libId)
            || (desId && item.designId === desId)
            || (typeof tabId === 'number' && item.tabId === tabId)
            || (typeof windowId === 'number' && item.windowId === windowId);
        if (!match) return item;
        touched = true;
        return {
            ...item,
            openedAt: now,
            tabId: typeof tabId === 'number' ? tabId : item.tabId,
            windowId: typeof windowId === 'number' ? windowId : item.windowId
        };
    });
    if (!touched) return false;
    try {
        await chrome.storage.session.set({ [CANVA_BATCH_POPUP_SESSION_KEY]: next });
    } catch (_) {
    }
    return true;
}

function withServiceWorkerKeepAlive(promise) {
    const tick = setInterval(() => {
        try {
            chrome.runtime.getPlatformInfo(() => {});
        } catch (_) {
        }
    }, 15000);
    return Promise.resolve(promise).finally(() => clearInterval(tick));
}

async function removeCanvaBatchPopupEntry({ libraryId = '', designId = '', windowId = null, tabId = null } = {}) {
    const libId = String(libraryId || '').trim();
    const desId = String(designId || '').trim();
    const batch = await loadCanvaBatchPopupRefs();
    const next = batch.filter((item) => {
        if (libId && item.libraryId === libId) return false;
        if (desId && item.designId === desId) return false;
        if (typeof windowId === 'number' && item.windowId === windowId) return false;
        if (typeof tabId === 'number' && item.tabId === tabId) return false;
        return true;
    });
    try {
        if (next.length) {
            await chrome.storage.session.set({ [CANVA_BATCH_POPUP_SESSION_KEY]: next });
        } else {
            await chrome.storage.session.remove([CANVA_BATCH_POPUP_SESSION_KEY]);
        }
    } catch (_) {
    }
}

function canvaPopupRefMatchesTarget(ref, { designId = '', editUrl = '' } = {}) {
    const targetDesignId = String(designId || '').trim();
    const targetEditUrl = String(editUrl || '').trim();
    if (!ref) return false;
    if (targetDesignId && ref.designId === targetDesignId) return true;
    if (targetEditUrl && ref.editUrl === targetEditUrl) return true;
    if (targetDesignId && canvaEditUrlMatchesDesign(ref.editUrl, targetDesignId)) return true;
    return !targetDesignId && !targetEditUrl;
}

function canvaBatchEntryMatchesTabOrDesign(entry, tabId, designId) {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof tabId === 'number' && entry.tabId === tabId) return true;
    const desId = String(designId || '').trim();
    if (desId && entry.designId === desId) return true;
    if (desId && canvaEditUrlMatchesDesign(entry.editUrl, desId)) return true;
    return false;
}

async function updateCanvaPopupTabBinding(windowId, tabId, editUrl = '', designId = '') {
    if (typeof tabId !== 'number') return;
    const ref = await loadCanvaPopupRef();
    const shouldUpdateRef = (typeof windowId === 'number' && ref?.windowId === windowId)
        || (ref?.tabId === tabId)
        || (!ref?.tabId && typeof windowId === 'number' && ref?.windowId === windowId);
    if (shouldUpdateRef || !ref?.tabId) {
        await storeCanvaPopupRef({
            windowId: typeof windowId === 'number' ? windowId : (ref?.windowId ?? null),
            tabId,
            editUrl: String(editUrl || ref?.editUrl || '').trim(),
            isFallbackTab: !!ref?.isFallbackTab
        });
    }
    const desId = String(designId || extractCanvaDesignIdFromUrl(editUrl) || '').trim();
    if (desId) {
        const batch = await loadCanvaBatchPopupRefs();
        const entry = batch.find((item) => {
            if (typeof windowId === 'number' && item.windowId === windowId) return true;
            if (desId && item.designId === desId) return true;
            return false;
        });
        if (entry) {
            await storeCanvaBatchPopupEntry({
                ...entry,
                tabId,
                designId: desId || entry.designId,
                editUrl: String(editUrl || entry.editUrl || '').trim(),
                windowId: typeof windowId === 'number' ? windowId : entry.windowId
            });
        }
    }
}

async function queryFirstTabId(windowId) {
    if (typeof windowId !== 'number') return null;
    const tabs = await chrome.tabs.query({ windowId }).catch(() => []);
    return tabs[0]?.id ?? null;
}

/** Real Chrome popup — URL must be passed at create time (never empty window + tabs.update). */
async function openCanvaPopupWindow(url, { width = 1280, height = 900, focused = true } = {}) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) throw new Error('Canva popup URL is required.');
    const w = Math.max(480, Math.min(1600, Number(width) || 1280));
    const h = Math.max(480, Math.min(1200, Number(height) || 900));
    const popup = await chrome.windows.create({
        url: targetUrl,
        type: 'popup',
        width: w,
        height: h,
        focused: !!focused
    });
    const tabId = popup?.tabs?.[0]?.id
        ?? (popup?.id ? await queryFirstTabId(popup.id) : null);
    return { popup, tabId };
}

async function sendCanvaEditorForceShow(tabId, payload) {
    return new Promise((resolve) => {
        try {
            chrome.tabs.sendMessage(tabId, payload, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        delivered: false,
                        shown: false,
                        error: chrome.runtime.lastError.message || 'Message failed'
                    });
                    return;
                }
                resolve({
                    delivered: true,
                    shown: !!response?.shown,
                    response: response || null
                });
            });
        } catch (err) {
            resolve({
                delivered: false,
                shown: false,
                error: err?.message || 'Message failed'
            });
        }
    });
}

async function injectCanvaEditorSaveBarScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['utils/canva-editor-save-bar.js']
        });
        return true;
    } catch (_) {
        return false;
    }
}

async function ensureCanvaEditorSaveBar(tabId, designId = '', windowId = null) {
    if (typeof tabId !== 'number') return false;
    const delays = [0, 250, 600, 1200, 2000, 3500, 5000, 8000, 12000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt]) {
            await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
        const desId = String(designId || '').trim();
        const ctx = await resolveCanvaEditorInjectContext(tabId, desId, { windowId });
        if (!ctx.show) continue;
        const payload = { action: 'CANVA_EDITOR_FORCE_SHOW', ...ctx };

        let result = await sendCanvaEditorForceShow(tabId, payload);
        if (result.shown) return true;

        if (!result.delivered || !result.shown) {
            await injectCanvaEditorSaveBarScript(tabId);
            await new Promise((resolve) => setTimeout(resolve, 150));
            result = await sendCanvaEditorForceShow(tabId, payload);
            if (result.shown) return true;
        }
    }
    return false;
}

async function bindCanvaPopupTab(tabId, url, watch = {}) {
    const designId = String(watch.designId || '').trim() || extractCanvaDesignIdFromUrl(url);
    const windowId = typeof watch.windowId === 'number' ? watch.windowId : null;
    if (!designId) {
        const ctx = await resolveCanvaEditorInjectContext(tabId, '', { windowId });
        if (ctx.show) {
            await ensureCanvaEditorSaveBar(tabId, ctx.designId, windowId);
        }
        return;
    }
    await updateCanvaPopupTabBinding(windowId, tabId, url || watch.editUrl || '', designId);
    if (watch.libraryId || designId || watch.batchMode || watch.blank) {
        await storeCanvaBatchPopupEntry({
            libraryId: watch.libraryId || '',
            designId,
            windowId,
            tabId,
            editUrl: url || watch.editUrl || '',
            blank: watch.blank,
            title: watch.title
        });
    }
    const shown = await ensureCanvaEditorSaveBar(tabId, designId, windowId);
    if (shown && typeof watch.windowId === 'number') {
        const active = canvaPopupTabWatchers.get(watch.windowId);
        if (active?.intervalId) clearInterval(active.intervalId);
        canvaPopupTabWatchers.delete(watch.windowId);
    }
}

async function probeCanvaPopupWindowTabs(watch) {
    if (!watch || typeof watch.windowId !== 'number') return;
    const tabs = await chrome.tabs.query({ windowId: watch.windowId }).catch(() => []);
    for (const tab of tabs) {
        if (tab?.id && isCanvaEditorTabUrl(tab.url || '')) {
            await bindCanvaPopupTab(tab.id, tab.url, watch);
            return;
        }
    }
}

function startCanvaPopupTabWatch(windowId, meta = {}) {
    if (typeof windowId !== 'number') return;
    const existing = canvaPopupTabWatchers.get(windowId);
    if (existing?.timeoutId) clearTimeout(existing.timeoutId);
    if (existing?.intervalId) clearInterval(existing.intervalId);
    const libId = String(meta.libraryId || '').trim();
    const desId = String(meta.designId || '').trim();
    const watch = {
        windowId,
        libraryId: libId,
        designId: desId,
        editUrl: String(meta.editUrl || '').trim(),
        batchMode: !!meta.batchMode,
        blank: !!(meta.blank || (!libId && desId)),
        title: String(meta.title || (meta.blank ? 'NHP Blank 5000×5000' : '')).trim(),
        startedAt: Date.now()
    };
    watch.intervalId = setInterval(() => {
        void probeCanvaPopupWindowTabs(watch);
    }, 1000);
    watch.timeoutId = setTimeout(() => {
        if (watch.intervalId) clearInterval(watch.intervalId);
        canvaPopupTabWatchers.delete(windowId);
    }, CANVA_POPUP_RECENT_MS);
    canvaPopupTabWatchers.set(windowId, watch);
    void probeCanvaPopupWindowTabs(watch);
}

async function handleCanvaEditorTabUpdated(tabId, changeInfo, tab) {
    if (!tab?.url || !isCanvaEditorTabUrl(tab.url)) return;
    if (changeInfo.status !== 'complete' && !changeInfo.url) return;
    const designId = extractCanvaDesignIdFromUrl(tab.url);
    const windowId = typeof tab.windowId === 'number' ? tab.windowId : null;

    if (windowId !== null && canvaPopupTabWatchers.has(windowId)) {
        const watch = canvaPopupTabWatchers.get(windowId);
        await bindCanvaPopupTab(tabId, tab.url, watch);
        return;
    }

    const ctx = await resolveCanvaEditorInjectContext(tabId, designId, { windowId });
    if (!ctx.show) return;
    await ensureCanvaEditorSaveBar(tabId, ctx.designId || designId, windowId);
}

async function resolveCanvaEditorInjectContext(tabId, designId, { windowId = null } = {}) {
    const desId = String(designId || '').trim();
    const tid = typeof tabId === 'number' ? tabId : null;
    const wid = typeof windowId === 'number' ? windowId : null;
    const now = Date.now();
    const batch = await loadCanvaBatchPopupRefs();
    const ref = await loadCanvaPopupRef();
    let matched = null;

    if (tid) {
        matched = batch.find((entry) => isRecentCanvaPopupEntry(entry, now)
            && canvaBatchEntryMatchesTabOrDesign(entry, tid, desId)) || null;
    }

    if (!matched && wid !== null) {
        matched = batch.find((entry) => isRecentCanvaPopupEntry(entry, now) && entry.windowId === wid) || null;
    }

    if (!matched && desId) {
        matched = batch.find((entry) => isRecentCanvaPopupEntry(entry, now) && entry.designId === desId) || null;
    }

    if (!matched && ref && isRecentCanvaPopupEntry(ref, now)) {
        const tabMatch = tid && (ref.tabId === tid || !ref.tabId);
        const windowMatch = wid !== null && ref.windowId === wid;
        const designMatch = desId && canvaEditUrlMatchesDesign(ref.editUrl, desId);
        if (tabMatch || windowMatch || designMatch) {
            const refDesignId = desId
                || String(ref.designId || '').trim()
                || extractCanvaDesignIdFromUrl(ref.editUrl);
            matched = {
                libraryId: String(ref.libraryId || '').trim(),
                designId: refDesignId,
                tabId: ref.tabId || tid,
                windowId: ref.windowId ?? wid,
                editUrl: ref.editUrl,
                blank: !!ref.blank,
                title: String(ref.title || '').trim()
            };
        }
    }

    if (!matched) return { show: false };

    if (!String(matched.designId || desId || '').trim()) {
        const hint = batch.find((entry) => isRecentCanvaPopupEntry(entry, now) && (
            (tid && entry.tabId === tid)
            || (wid !== null && entry.windowId === wid)
        ));
        if (hint?.designId) matched.designId = hint.designId;
        if (hint?.libraryId && !matched.libraryId) matched.libraryId = hint.libraryId;
    }

    const resolvedDesignId = String(matched.designId || desId).trim();
    if (!resolvedDesignId) return { show: false };

    if (tid && matched.tabId !== tid) {
        await updateCanvaPopupTabBinding(matched.windowId ?? null, tid, matched.editUrl, matched.designId || desId);
        matched.tabId = tid;
    } else if (tid && !matched.tabId) {
        matched.tabId = tid;
    }

    return {
        show: true,
        libraryId: String(matched.libraryId || '').trim(),
        designId: resolvedDesignId,
        tabId: typeof matched.tabId === 'number' ? matched.tabId : tid,
        windowId: typeof matched.windowId === 'number' ? matched.windowId : null,
        editUrl: String(matched.editUrl || '').trim(),
        blank: !!(matched.blank || (!matched.libraryId && matched.designId)),
        title: String(matched.title || (matched.blank ? 'NHP Blank 5000×5000' : '')).trim()
    };
}

async function canvaGhostApi(path, options = {}) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${path}`;
    const url = `${getGhostServerUrl()}${normalizedPath}`;
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
    const data = contentType.includes('json') ? await res.json().catch(() => ({})) : {};
    if (!res.ok || data.success === false) {
        const explained = canvaExplainImportError(data.error) || data.error || `خطأ Canva API (${res.status})`;
        throw new Error(explained);
    }
    return data;
}

async function canvaImportAndSaveFromEditor({ libraryId, canvaDesignId, blank = false, title = '' } = {}) {
    const origId = String(libraryId || '').trim();
    const designId = String(canvaDesignId || '').trim();
    const isBlank = !!blank || !origId;
    if (!designId) throw new Error('معرّف تصميم Canva غير متوفر');
    if (!isBlank && !origId) {
        throw new Error('معرّف التصميم في المكتبة غير متوفر — استخدم «استيراد وحفظ» من Canva Bridge');
    }

    const blankTitle = title || 'NHP Blank 5000×5000';
    const importBody = isBlank
        ? { canvaDesignId: designId, blank: true, title: blankTitle }
        : {
            libraryId: origId,
            canvaDesignId: designId,
            originalDesignId: origId
        };

    const importData = await canvaGhostApi('/api/canva/import-edited', {
        method: 'POST',
        body: JSON.stringify(importBody)
    });

    const saveBody = isBlank
        ? {
            canvaDesignId: designId,
            importPath: importData.importPath,
            promptPreview: importData.promptPreview || blankTitle,
            versionLabel: 'Canva Edited',
            blank: true,
            blankOriginal: true,
            title: blankTitle
        }
        : {
            originalDesignId: origId,
            canvaDesignId: designId,
            importPath: importData.importPath,
            promptPreview: importData.promptPreview,
            versionLabel: 'Canva Edited'
        };

    const saveData = await canvaGhostApi('/api/canva/save-version', {
        method: 'POST',
        body: JSON.stringify(saveBody)
    });

    return { importData, saveData, isBlank };
}

function canvaExplainImportError(errText = '') {
    const raw = String(errText || '').trim();
    if (!raw) return '';
    if (/unknown endpoint/i.test(raw) && /export/i.test(raw)) {
        return 'مسار تصدير Canva غير صحيح — أعد تشغيل Ghost Server ثم أعد المحاولة، أو نزّل PNG من Canva مباشرة';
    }
    if (/export timed out/i.test(raw)) {
        return 'انتهت مهلة تصدير Canva — انتظر قليلاً أو نزّل PNG من زر التنزيل في Canva';
    }
    if (/license_required/i.test(raw)) {
        return 'التصميم يحتوي عناصر مدفوعة في Canva — اشترِ العناصر أو نزّل PNG يدوياً';
    }
    if (/approval_required/i.test(raw)) {
        return 'التصميم يحتاج موافقة مراجع في Canva قبل التصدير';
    }
    if (/internal_failure/i.test(raw)) {
        return 'خطأ داخلي في Canva أثناء التصدير — أعد المحاولة لاحقاً أو نزّل PNG يدوياً';
    }
    if (/no download url|export download failed|export job failed|فشل تصدير/i.test(raw)) {
        return `${raw} — جرّب التنزيل اليدوي من Canva (PNG شفاف 5000×5000)`;
    }
    if (/design id required|معرّف تصميم/i.test(raw)) {
        return 'معرّف تصميم Canva غير متوفر — افتح التصميم من NHP مرة أخرى';
    }
    if (/ghost server|غير مشغّل|3019/i.test(raw)) return raw;
    if (/لم تُفتح من nhp/i.test(raw)) return raw;
    return '';
}

const canvaDownloadCapturePending = new Map();
const canvaDownloadCaptureInFlight = new Set();
const CANVA_DOWNLOAD_CAPTURE_DEDUP_MS = 45000;

function canvaDataUrlToBlob(dataUrl) {
    const raw = String(dataUrl || '');
    const comma = raw.indexOf(',');
    if (comma < 0) throw new Error('صيغة الصورة غير صالحة');
    const header = raw.slice(0, comma);
    const b64 = raw.slice(comma + 1);
    const mime = header.match(/data:([^;]+)/i)?.[1] || 'image/png';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

async function blobToDataUrl(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    const mime = blob.type || 'image/png';
    return `data:${mime};base64,${btoa(binary)}`;
}

function canvaDownloadLooksLikePng(item) {
    const mime = String(item?.mime || '').toLowerCase();
    const filename = String(item?.filename || item?.url || '').toLowerCase();
    if (mime.includes('png') || mime.includes('image')) return true;
    if (/\.png(\?|$)/i.test(filename)) return true;
    return false;
}

function canvaDownloadOriginHintsCanva(item) {
    const url = String(item?.url || '').trim();
    const referrer = String(item?.referrer || '').trim();
    if (/canva\.com/i.test(referrer) || /canva\.com/i.test(url) || /\.canva\.com/i.test(url)) return true;
    return false;
}

async function resolveCanvaDownloadCaptureContext(item) {
    const tabId = typeof item?.tabId === 'number' ? item.tabId : null;
    let windowId = null;
    if (tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            windowId = typeof tab.windowId === 'number' ? tab.windowId : null;
        } catch (_) {
        }
    }
    return resolveCanvaEditorInjectContext(tabId, '', { windowId });
}

async function fetchCanvaDownloadImageDataUrl(item) {
    const url = String(item?.url || '').trim();
    if (!url) throw new Error('رابط التنزيل غير متوفر');
    if (url.startsWith('data:image/')) return url;
    if (url.startsWith('blob:')) {
        const tabId = typeof item.tabId === 'number' ? item.tabId : null;
        if (!tabId) throw new Error('تعذّر قراءة تنزيل Canva (blob بدون تبويب)');
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: async (blobUrl) => {
                const res = await fetch(blobUrl);
                const blob = await res.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('فشل قراءة blob'));
                    reader.readAsDataURL(blob);
                });
            },
            args: [url]
        });
        if (!result || !String(result).startsWith('data:image/')) {
            throw new Error('تعذّر تحويل تنزيل Canva إلى صورة');
        }
        return result;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`فشل جلب التنزيل (${res.status})`);
    const blob = await res.blob();
    return blobToDataUrl(blob);
}

async function canvaUploadCapturedDownloadToLibrary({ dataUrl, ctx = {} } = {}) {
    const libraryId = String(ctx.libraryId || '').trim();
    const designId = String(ctx.designId || '').trim();
    const isBlank = !!(ctx.blank || (!libraryId && designId));
    const title = String(ctx.title || (isBlank ? 'NHP Blank 5000×5000' : 'Canva Edited')).trim();
    const blob = canvaDataUrlToBlob(dataUrl);
    if (!blob.size) throw new Error('ملف التنزيل فارغ');
    const form = new FormData();
    const safeName = `canva_${designId || Date.now()}.png`;
    form.append('image', blob, safeName);
    form.append('source', 'canva');
    form.append('versionLabel', 'Canva Edited');
    if (isBlank) {
        if (title) form.append('displayName', title);
    } else if (libraryId) {
        form.append('originalDesignId', libraryId);
        if (title) form.append('displayName', title);
    }
    const uploadUrl = `${getGhostServerUrl()}/api/library/upload`;
    let res;
    try {
        res = await fetch(uploadUrl, { method: 'POST', body: form });
    } catch (_) {
        throw new Error('Ghost Server غير مشغّل — شغّل Ghost على المنفذ 3019');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(data.error || `فشل رفع التنزيل (HTTP ${res.status})`);
    }
    return data.items?.[0] || null;
}

function canvaDownloadCaptureDedupKey(ctx, item) {
    const lib = String(ctx?.libraryId || '').trim();
    const des = String(ctx?.designId || '').trim();
    const dlId = typeof item?.id === 'number' ? item.id : 0;
    return `${lib || 'blank'}:${des || 'node'}:${dlId}`;
}

async function notifyCanvaDownloadCaptured({ ctx, savedItem, tabId }) {
    const savedLibraryId = String(savedItem?.id || savedItem?.storageId || '').trim();
    const toastMessage = 'تم حفظ التنزيل في التصاميم المعدّلة';
    const payload = {
        action: 'CANVA_IMPORTED_FROM_EDITOR',
        success: true,
        libraryId: savedLibraryId,
        originalLibraryId: String(ctx.libraryId || '').trim(),
        canvaDesignId: String(ctx.designId || '').trim(),
        blankDesignId: ctx.blank ? String(ctx.designId || '').trim() : '',
        fromDownloadCapture: true
    };
    try {
        chrome.runtime.sendMessage(payload);
    } catch (_) {
    }
    if (typeof tabId === 'number') {
        try {
            chrome.tabs.sendMessage(tabId, {
                action: 'CANVA_DOWNLOAD_CAPTURED_TOAST',
                message: toastMessage
            });
        } catch (_) {
        }
    }
    try {
        chrome.notifications.create(`nhp-canva-dl-${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'NHP HuntPro — Canva',
            message: toastMessage,
            priority: 1
        });
    } catch (_) {
    }
}

async function processCanvaEditorDownload(item) {
    if (!item || item.byExtensionId === chrome.runtime.id) return false;
    if (!canvaDownloadLooksLikePng(item)) return false;
    const ctxWrap = await resolveCanvaDownloadCaptureContext(item);
    if (!ctxWrap?.show) return false;

    const dedupKey = canvaDownloadCaptureDedupKey(ctxWrap, item);
    if (canvaDownloadCaptureInFlight.has(dedupKey)) return false;
    canvaDownloadCaptureInFlight.add(dedupKey);
    setTimeout(() => canvaDownloadCaptureInFlight.delete(dedupKey), CANVA_DOWNLOAD_CAPTURE_DEDUP_MS);

    try {
        const dataUrl = await fetchCanvaDownloadImageDataUrl(item);
        const savedItem = await canvaUploadCapturedDownloadToLibrary({ dataUrl, ctx: ctxWrap });
        if (!savedItem) throw new Error('لم يُعثر على عنصر محفوظ بعد الرفع');
        await notifyCanvaDownloadCaptured({
            ctx: ctxWrap,
            savedItem,
            tabId: typeof item.tabId === 'number' ? item.tabId : ctxWrap.tabId
        });
        console.log('[NHP Canva] Captured editor download → edited designs', savedItem.id || savedItem.storageId);
        return true;
    } catch (err) {
        console.warn('[NHP Canva] Download capture failed:', err?.message || err);
        return false;
    }
}

function shouldQueueCanvaEditorDownload(item) {
    if (!item || item.byExtensionId === chrome.runtime.id) return false;
    if (!canvaDownloadLooksLikePng(item)) return false;
    if (!canvaDownloadOriginHintsCanva(item) && typeof item.tabId !== 'number') return false;
    return true;
}

async function handleCanvaEditorDownloadCreated(item) {
    if (!item || item.byExtensionId === chrome.runtime.id) return;
    const ctx = await resolveCanvaDownloadCaptureContext(item);
    if (!ctx?.show) return;
    canvaDownloadCapturePending.set(item.id, {
        ctx,
        tabId: item.tabId,
        createdAt: Date.now()
    });
    if (String(item.state || '').toLowerCase() === 'complete') {
        canvaDownloadCapturePending.delete(item.id);
        await processCanvaEditorDownload(item);
    }
}

async function handleCanvaEditorDownloadChanged(delta) {
    if (delta.state?.current !== 'complete') return;
    const pending = canvaDownloadCapturePending.get(delta.id);
    if (pending) canvaDownloadCapturePending.delete(delta.id);
    try {
        const [item] = await chrome.downloads.search({ id: delta.id });
        if (!item || item.byExtensionId === chrome.runtime.id) return;
        if (pending) {
            await processCanvaEditorDownload(item);
            return;
        }
        if (!shouldQueueCanvaEditorDownload(item)) return;
        await processCanvaEditorDownload(item);
    } catch (err) {
        console.warn('[NHP Canva] Download changed handler failed:', err?.message || err);
    }
}

async function closeCanvaPopupWindow({
    designId = '',
    editUrl = '',
    windowId = null,
    tabId = null,
    libraryId = ''
} = {}) {
    const ref = await loadCanvaPopupRef();
    const batch = await loadCanvaBatchPopupRefs();
    const targetDesignId = String(designId || '').trim();
    const targetEditUrl = String(editUrl || '').trim();
    const targetLibraryId = String(libraryId || '').trim();
    let closed = false;
    let matchedBatchEntry = null;

    if (targetLibraryId) {
        matchedBatchEntry = batch.find((item) => item.libraryId === targetLibraryId) || null;
    }
    if (!matchedBatchEntry && targetDesignId) {
        matchedBatchEntry = batch.find((item) => item.designId === targetDesignId) || null;
    }
    if (!matchedBatchEntry && targetEditUrl) {
        matchedBatchEntry = batch.find((item) => item.editUrl === targetEditUrl) || null;
    }

    const tryCloseWindow = async (winId) => {
        if (typeof winId !== 'number') return false;
        try {
            await chrome.windows.remove(winId);
            return true;
        } catch (_) {
            return false;
        }
    };

    const tryCloseTab = async (closeTabId, { isFallbackTab = false } = {}) => {
        if (typeof closeTabId !== 'number') return false;
        try {
            const tab = await chrome.tabs.get(closeTabId);
            if (!tab?.id) return false;
            if (targetEditUrl && tab.url && tab.url !== targetEditUrl && !canvaEditUrlMatchesDesign(tab.url, targetDesignId)) {
                return false;
            }
            let winType = '';
            try {
                const win = await chrome.windows.get(tab.windowId);
                winType = String(win?.type || '');
            } catch (_) {
            }
            if (isFallbackTab && winType !== 'popup') return false;
            await chrome.tabs.remove(closeTabId);
            return true;
        } catch (_) {
            return false;
        }
    };

    const explicitWindowId = typeof windowId === 'number'
        ? windowId
        : (matchedBatchEntry?.windowId ?? null);
    const explicitTabId = typeof tabId === 'number'
        ? tabId
        : (matchedBatchEntry?.tabId ?? null);
    const explicitFallbackTab = matchedBatchEntry?.isFallbackTab ?? ref?.isFallbackTab ?? false;

    if (!closed && explicitWindowId) {
        closed = await tryCloseWindow(explicitWindowId);
    }
    if (!closed && explicitTabId) {
        closed = await tryCloseTab(explicitTabId, { isFallbackTab: explicitFallbackTab });
    }

    if (!closed && ref?.windowId && canvaPopupRefMatchesTarget(ref, { designId: targetDesignId, editUrl: targetEditUrl })) {
        closed = await tryCloseWindow(ref.windowId);
    }
    if (!closed && ref?.tabId && canvaPopupRefMatchesTarget(ref, { designId: targetDesignId, editUrl: targetEditUrl })) {
        closed = await tryCloseTab(ref.tabId, { isFallbackTab: ref.isFallbackTab });
    }

    if (!closed) {
        try {
            const popupWindows = await chrome.windows.getAll({ windowTypes: ['popup'], populate: true });
            const candidates = [];
            for (const win of popupWindows) {
                for (const tab of (win.tabs || [])) {
                    if (!canvaEditUrlMatchesDesign(tab.url, targetDesignId)) continue;
                    candidates.push({ tab, win, openedAt: ref?.openedAt || canvaPopupOpenedAt || 0 });
                }
            }
            if (candidates.length) {
                candidates.sort((a, b) => {
                    const aMatch = ref?.tabId && a.tab.id === ref.tabId ? 1 : 0;
                    const bMatch = ref?.tabId && b.tab.id === ref.tabId ? 1 : 0;
                    if (aMatch !== bMatch) return bMatch - aMatch;
                    return (b.tab.lastAccessed || 0) - (a.tab.lastAccessed || 0);
                });
                const pick = candidates[0];
                closed = await tryCloseWindow(pick.win.id);
                if (!closed) {
                    closed = await tryCloseTab(pick.tab.id);
                }
            }
        } catch (_) {
        }
    }

    await removeCanvaBatchPopupEntry({
        libraryId: targetLibraryId || matchedBatchEntry?.libraryId || '',
        designId: targetDesignId || matchedBatchEntry?.designId || '',
        windowId: explicitWindowId,
        tabId: explicitTabId
    });

    if (
        ref
        && (
            (typeof explicitWindowId === 'number' && ref.windowId === explicitWindowId)
            || (typeof explicitTabId === 'number' && ref.tabId === explicitTabId)
            || canvaPopupRefMatchesTarget(ref, { designId: targetDesignId, editUrl: targetEditUrl })
        )
    ) {
        await clearCanvaPopupRef();
    }

    return { closed };
}

    const CANVA_MESSAGE_ACTIONS = new Set([
        'CANVA_OAUTH_OPEN',
        'CANVA_OPEN_POPUP',
        'CANVA_CLOSE_POPUP',
        'CANVA_EDITOR_INIT',
        'CANVA_IMPORT_FROM_EDITOR'
    ]);

    global.__canvaHandleMessage = function __canvaHandleMessage(req, sender, sendResponse) {
        if (!req || typeof req !== 'object') return false;
        const action = req.action;
        if (!CANVA_MESSAGE_ACTIONS.has(action)) return false;
    if (req.action === 'CANVA_OAUTH_OPEN') {
        (async () => {
            try {
                const url = String(req.url || '').trim();
                if (!/^https:\/\/(www\.)?canva\.com\//i.test(url)) {
                    throw new Error('Unsupported Canva OAuth URL.');
                }
                const width = Math.max(480, Math.min(900, Number(req.width) || 520));
                const height = Math.max(560, Math.min(1000, Number(req.height) || 720));
                const focused = req.focused === true;
                const { popup, tabId } = await openCanvaPopupWindow(url, { width, height, focused });
                if (popup?.id) {
                    watchCanvaOAuthPopup(popup.id, tabId);
                }
                sendResponse({ success: true, windowId: popup?.id || null, tabId });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to open Canva OAuth popup.' });
            }
        })();
        return true;
    }

    if (req.action === 'CANVA_OPEN_POPUP') {
        (async () => {
            try {
                const url = String(req.url || '').trim();
                if (!/^https:\/\/(www\.)?canva\.com\//i.test(url)) {
                    throw new Error('Unsupported Canva URL.');
                }
                const width = Math.max(720, Math.min(1600, Number(req.width) || 1280));
                const height = Math.max(600, Math.min(1200, Number(req.height) || 900));
                const focused = req.focus !== false;
                const libraryId = String(req.libraryId || '').trim();
                const designId = String(req.designId || '').trim() || extractCanvaDesignIdFromUrl(url);
                const isBlankOpen = !!req.blank || (!libraryId && !!designId);
                const blankTitle = String(req.title || 'NHP Blank 5000×5000').trim();
                const watchMeta = {
                    libraryId,
                    designId,
                    editUrl: url,
                    batchMode: !!req.batchMode,
                    blank: isBlankOpen,
                    title: isBlankOpen ? blankTitle : ''
                };
                try {
                    const { popup, tabId } = await openCanvaPopupWindow(url, { width, height, focused });
                    const refPayload = {
                        windowId: popup?.id || null,
                        tabId,
                        editUrl: url,
                        designId,
                        libraryId,
                        blank: isBlankOpen,
                        title: isBlankOpen ? blankTitle : ''
                    };
                    await storeCanvaPopupRef(refPayload);
                    await storeCanvaBatchPopupEntry({
                        libraryId,
                        designId,
                        ...refPayload
                    });
                    if (popup?.id) {
                        startCanvaPopupTabWatch(popup.id, watchMeta);
                    }
                    if (tabId) {
                        void ensureCanvaEditorSaveBar(tabId, designId, popup?.id ?? null);
                    }
                    sendResponse({ success: true, windowId: popup?.id || null, tabId });
                } catch (popupError) {
                    console.warn('[CANVA] popup window failed, using tab fallback:', popupError?.message || popupError);
                    const tab = await chrome.tabs.create({ url, active: focused });
                    const refPayload = {
                        windowId: null,
                        tabId: tab?.id || null,
                        editUrl: url,
                        designId,
                        libraryId,
                        blank: isBlankOpen,
                        title: isBlankOpen ? blankTitle : '',
                        isFallbackTab: true
                    };
                    await storeCanvaPopupRef(refPayload);
                    await storeCanvaBatchPopupEntry({
                        libraryId,
                        designId,
                        ...refPayload
                    });
                    if (tab?.id) {
                        void ensureCanvaEditorSaveBar(tab.id, designId, null);
                    }
                    sendResponse({
                        success: true,
                        tabId: tab?.id || null,
                        fallback: true,
                        error: popupError?.message || null
                    });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to open Canva.' });
            }
        })();
        return true;
    }

    if (req.action === 'CANVA_CLOSE_POPUP') {
        (async () => {
            try {
                if (req.mockMode === true) {
                    sendResponse({ success: true, closed: false, skipped: 'mock' });
                    return;
                }
                const result = await closeCanvaPopupWindow({
                    designId: req.designId,
                    editUrl: req.editUrl,
                    windowId: typeof req.windowId === 'number' ? req.windowId : null,
                    tabId: typeof req.tabId === 'number' ? req.tabId : null,
                    libraryId: req.libraryId
                });
                sendResponse({ success: true, ...result });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to close Canva popup.' });
            }
        })();
        return true;
    }

    if (req.action === 'CANVA_EDITOR_INIT') {
        (async () => {
            try {
                const tabId = sender?.tab?.id;
                const windowId = typeof sender?.tab?.windowId === 'number' ? sender.tab.windowId : null;
                const designId = String(req.designId || req.canvaDesignId || '').trim();
                const ctx = await resolveCanvaEditorInjectContext(tabId, designId, { windowId });
                if (ctx.show) {
                    await touchCanvaBatchPopupEntry({
                        libraryId: ctx.libraryId,
                        designId: ctx.designId || designId,
                        tabId: ctx.tabId ?? tabId,
                        windowId: ctx.windowId ?? windowId
                    });
                }
                sendResponse({ success: true, ...ctx });
            } catch (error) {
                sendResponse({ success: false, show: false, error: error.message || 'Unable to resolve Canva editor context.' });
            }
        })();
        return true;
    }

    if (req.action === 'CANVA_IMPORT_FROM_EDITOR') {
        (async () => {
            try {
                const tabId = typeof req.tabId === 'number' ? req.tabId : sender?.tab?.id;
                const windowId = typeof req.windowId === 'number'
                    ? req.windowId
                    : (typeof sender?.tab?.windowId === 'number' ? sender.tab.windowId : null);
                const designId = String(req.designId || req.canvaDesignId || '').trim();
                const ctx = await resolveCanvaEditorInjectContext(tabId, designId, { windowId });
                if (!ctx.show) {
                    throw new Error('هذه النافذة لم تُفتح من NHP HuntPro');
                }
                await touchCanvaBatchPopupEntry({
                    libraryId: req.libraryId || ctx.libraryId,
                    designId: ctx.designId || designId,
                    tabId: ctx.tabId ?? tabId,
                    windowId: ctx.windowId ?? windowId
                });
                const libraryId = String(req.libraryId || ctx.libraryId || '').trim();
                const canvaDesignId = String(ctx.designId || designId).trim();
                const isBlank = !!(ctx.blank || req.blank || (!libraryId && canvaDesignId));
                const title = String(ctx.title || req.title || 'NHP Blank 5000×5000').trim();
                const result = await withServiceWorkerKeepAlive(canvaImportAndSaveFromEditor({
                    libraryId,
                    canvaDesignId,
                    blank: isBlank,
                    title
                }));

                const successPayload = {
                    success: true,
                    libraryId: result.saveData.libraryId,
                    mockMode: !!result.importData.mockMode
                };

                try {
                    chrome.runtime.sendMessage({
                        action: 'CANVA_IMPORTED_FROM_EDITOR',
                        ...successPayload,
                        originalLibraryId: libraryId,
                        canvaDesignId,
                        blankDesignId: isBlank ? canvaDesignId : ''
                    });
                } catch (_) {
                }

                // Respond before closing the editor tab — otherwise the content-script
                // message port is destroyed and the save bar shows a false failure.
                sendResponse(successPayload);

                const closeCtx = {
                    designId: canvaDesignId,
                    libraryId,
                    tabId: ctx.tabId ?? tabId,
                    windowId: ctx.windowId ?? (typeof req.windowId === 'number' ? req.windowId : null)
                };
                setTimeout(() => {
                    void closeCanvaPopupWindow(closeCtx);
                }, 400);
            } catch (error) {
                const explained = canvaExplainImportError(error.message) || error.message || 'Unable to import from Canva editor.';
                sendResponse({ success: false, error: explained });
            }
        })();
        return true;
    }

        return false;
    };

    global.handleCanvaEditorTabUpdated = handleCanvaEditorTabUpdated;

    chrome.downloads.onCreated.addListener((item) => {
        void handleCanvaEditorDownloadCreated(item);
    });

    chrome.downloads.onChanged.addListener((delta) => {
        void handleCanvaEditorDownloadChanged(delta);
    });
})(typeof self !== 'undefined' ? self : globalThis);