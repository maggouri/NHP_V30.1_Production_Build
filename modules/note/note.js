// ══════════════════════════════════════════════════════
//  ████████  NOTE MODULE (NICHE COMMANDER)  ████████
// ══════════════════════════════════════════════════════

import { initRadarModule } from '../radar/radar.js?v=note_niche_align_hunt_20260719';
import {
    emailcoreApiRequest,
    hasEmailCoreCredentials,
} from '../creaty/emailcore-library.js';
import { isCreatySearchToolsSyncReplacingOldTrends } from '../creaty/search-tools-sync-ui.js';

/**
 * State and Store
 */
let NC_state = {
    niches: [],
    unofficialTrends: [],
    doneHistory: [],
    history: [], // [{ timestamp: "...", niches: [...] }]
    /** @type {{ left: Array<{key:string,text:string,nicheId:string,count:number}>, right: Array<{key:string,text:string,nicheId:string,count:number}> }} */
    columnBuckets: { left: [], right: [] }
};

let showToastRef = (msg) => console.log("TOAST:", msg);
let switchTabRef = (name) => console.log("SWITCH TAB:", name);
let NC_archiveIndex = { niches: {} };
let NC_dailyTrends = [];
/** Cached trend rank index rebuilt when dailyTrends changes. */
let NC_trendRankIndex = null;
/** Server-provided trend ranks from synced Design Images eligible_niches. */
const NC_trendRankByKey = new Map();
let archiveStorageListenerAttached = false;
const NOTE_LITE_MAX_VISIBLE_ITEMS = 120;
/** Soft cap for Notes list DOM rows (search bypasses by filtering first). */
const NOTE_LIST_MAX_VISIBLE_ITEMS = 180;
const NC_SAVE_DEBOUNCE_MS = 400;
const NC_STORAGE_RENDER_DEBOUNCE_MS = 160;
const NC_HUNT_QUERY_SYNC_MS = 140;
const NC_GOOGLE_AI_DESIGNS_TEMPLATE_KEY = 'ncGoogleAiDesignsTemplate';
const NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE = 'احدث تصاميم القمصان متعلقة ب - {niche} -';
const NHP_OPEN_RADAR_FROM_NOTE_KEY = 'nhp_openRadarFromNote';
/** Debounce CREATY final-clean auto-fetch across popup reopen spam (ms). */
const NC_CREATY_AUTO_FETCH_DEBOUNCE_MS = 45000;
const NC_CREATY_AUTO_FETCH_AT_KEY = 'ncCreatyAutoFetchAt';
/** CREATY Design Images gallery cache (same feed as admin #design-images). */
const NC_DESIGN_IMAGES_FEED_KEY = 'nhpDesignImagesFeed';
const NC_CREATY_SYNC_ENABLED_KEY = 'nhpEmailCoreSearchToolsSyncEnabled';
const NC_CREATY_SYNC_META_KEY = 'nhpEmailCoreSearchToolsSyncMeta';
let NC_creatyAutoFetchInFlight = false;
/** @type {Map<string, Array<{thumb:string,full:string,page:string,title:string}>>} */
let NC_designImagesByKey = new Map();

/** @type {{ kind: 'none' } | { kind: 'niche'; id: string } | { kind: 'unofficial'; key: string }}} */
let NC_selection = { kind: 'none' };
/** @type {ReturnType<typeof setTimeout> | null} */
let NC_saveTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let NC_storageRenderTimer = null;
/** Coalesce chrome.storage-driven renders (initialized once — avoids TDZ/ReferenceError in strict modules). */
let NC_storageRenderPending = { list: false, unofficial: false };
/** Single holder for list RAF coalescing (avoids duplicate `let NC_listRenderFilter` merge bugs). */
const NC_listRenderCoalesce = { filter: '', raf: 0 };
/** Ignore storage-driven UI churn for writes originating from this module (prevents save → onChanged → render → save loops). */
let NC_suppressTeepublicStorageListener = false;
/** Last serialized payload we persisted for `teepublic_manager_data` (skips redundant chrome.storage.local.set). */
let NC_lastPersistedTeepublicJson = null;
let NC_visibilityFlushAttached = false;
let NC_googleAiDesignsTemplate = NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE;
let NC_listRenderFingerprint = '';
let NC_searchDebounceTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let NC_huntQuerySyncTimer = null;
let NC_importInFlight = 0;
let noteModuleBootstrapped = false;
let noteInitInFlight = null;
/** Invalidates in-flight NC_loadFromLocal callbacks after imports (prevents list flash-then-empty). */
let NC_storageLoadGeneration = 0;
const NC_BULK_TEXTAREA_MAX_LINES = 2500;
const NC_STORAGE_ECHO_SUPPRESS_MS = 1800;

function isNotePanelActive() {
    return !!document.getElementById('panel-note')?.classList.contains('active');
}

function NC_buildListRenderFingerprint(filter, sortedEntries, unofficialItems) {
    // Cheap full-list id/state sig (avoids missing updates past the old 48-row window).
    const sig = sortedEntries.map(({ niche }) => [
        niche.id,
        niche.isCompleted ? '1' : '0',
        niche.shariaRuling || '',
        niche.needsReanalysis ? '1' : '0',
        niche.intake_source || (niche.from_early_radar ? 'early_radar' : ''),
        niche.pageCount ?? niche.pages ?? '',
        niche.quality || '',
    ].join(':')).join('|');
    const bucketSig = (bucket) => (Array.isArray(bucket) ? bucket : [])
        .map((e) => `${e.key}:${e.count}:${e.nicheId}`)
        .join('|');
    NC_ensureColumnBuckets();
    const columnsSig = `${bucketSig(NC_state.columnBuckets.left)}<>${bucketSig(NC_state.columnBuckets.right)}`;
    const unofficialSig = (Array.isArray(unofficialItems) ? unofficialItems : [])
        .map((it) => NC_stableUnofficialKey(it))
        .join(',');
    return `${filter}|${sortedEntries.length}|${unofficialItems.length}|${sig}|${columnsSig}|${unofficialSig}`;
}

function NC_applyDesignImagesFeed(feed) {
    const groups = Array.isArray(feed?.groups) ? feed.groups : [];
    const map = new Map();
    NC_trendRankByKey.clear();
    for (const group of groups) {
        const images = (Array.isArray(group?.images) ? group.images : [])
            .map((img) => {
                const thumb = String(img?.thumb_url || img?.image_url || '').trim();
                const full = String(img?.image_url || img?.thumb_url || '').trim();
                if (!thumb && !full) return null;
                return {
                    thumb: thumb || full,
                    full: full || thumb,
                    page: String(img?.page_url || full || thumb || '').trim(),
                    title: String(img?.title || group?.niche || group?.niche_display || '').trim(),
                };
            })
            .filter(Boolean);
        if (!images.length) continue;
        const keys = [
            NC_normalizeNicheKey(group?.niche_key),
            NC_normalizeNicheKey(group?.niche),
            NC_normalizeNicheKey(group?.niche_display),
        ].filter(Boolean);
        for (const key of keys) {
            if (!map.has(key)) map.set(key, images);
        }
        NC_indexPageCountKeys(keys, NC_extractPageCountFromRecord(group));
        const groupRank = Number(group?.trend_rank ?? group?.trendRank);
        if (Number.isFinite(groupRank) && groupRank >= 1) {
            for (const key of keys) {
                if (!NC_trendRankByKey.has(key)) NC_trendRankByKey.set(key, Math.trunc(groupRank));
            }
        }
    }
    const eligible = Array.isArray(feed?.eligible_niches) ? feed.eligible_niches : [];
    for (const entry of eligible) {
        const pages = NC_extractPageCountFromRecord(entry);
        if (!Number.isFinite(pages)) continue;
        const keys = [
            NC_normalizeNicheKey(entry?.niche_key),
            NC_normalizeNicheKey(entry?.niche),
            NC_normalizeNicheKey(entry?.niche_display),
            NC_normalizeNicheKey(entry?.name),
            NC_normalizeNicheKey(entry?.text),
        ].filter(Boolean);
        NC_indexPageCountKeys(keys, pages);
        const rank = Number(entry?.trend_rank ?? entry?.trendRank);
        if (Number.isFinite(rank) && rank >= 1) {
            for (const key of keys) {
                if (!NC_trendRankByKey.has(key)) NC_trendRankByKey.set(key, Math.trunc(rank));
            }
        }
    }
    NC_designImagesByKey = map;
    // Cache only — do not auto-fill left hunt pane (user clicks «الموقع» on a niche row).
}

function NC_lookupDesignImagesForText(text) {
    const key = NC_normalizeNicheKey(text);
    if (!key) return [];
    return NC_designImagesByKey.get(key) || [];
}

async function NC_isCreatySearchToolsSyncEnabled() {
    const stored = await new Promise((resolve) => {
        chrome.storage.local.get([NC_CREATY_SYNC_ENABLED_KEY, NC_CREATY_SYNC_META_KEY], resolve);
    });
    return isCreatySearchToolsSyncReplacingOldTrends(
        stored[NC_CREATY_SYNC_ENABLED_KEY] !== false,
        stored[NC_CREATY_SYNC_META_KEY] || {}
    );
}

/** Pull Design Images into nhpDesignImagesFeed (CREATY sync path); no fake images. */
async function NC_refreshDesignImagesFeed({ quiet = true } = {}) {
    if (!(await NC_isCreatySearchToolsSyncEnabled())) return { skipped: true, reason: 'sync_disabled' };
    if (!(await hasEmailCoreCredentials())) {
        if (!quiet) showToastRef('⚠️ أدخل مفتاح CREATY لمزامنة صور التصاميم');
        return { skipped: true, reason: 'missing_creaty' };
    }
    try {
        const data = await emailcoreApiRequest('/nhp/design-images');
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        const eligible = Array.isArray(data?.eligible_niches) ? data.eligible_niches : [];
        if (!groups.length && !eligible.length) {
            // Keep previous cache — never invent stubs.
            return { ok: true, updated: false, reason: data?.error || 'empty' };
        }
        const payload = {
            groups,
            eligible_niches: eligible,
            fetched_at: data?.fetched_at || null,
            source: data?.source || null,
            synced_at: new Date().toISOString(),
        };
        await new Promise((resolve) => {
            chrome.storage.local.set({ [NC_DESIGN_IMAGES_FEED_KEY]: payload }, () => resolve());
        });
        NC_applyDesignImagesFeed(payload);
        return { ok: true, updated: true, groups: groups.length };
    } catch (err) {
        console.warn('NC_refreshDesignImagesFeed:', err);
        if (!quiet) showToastRef(`⚠️ صور التصاميم: ${err?.message || err}`);
        return { ok: false, error: String(err?.message || err) };
    }
}

function NC_loadDesignImagesFeedFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get([NC_DESIGN_IMAGES_FEED_KEY], (res) => {
            const feed = res?.[NC_DESIGN_IMAGES_FEED_KEY];
            if (feed && typeof feed === 'object') NC_applyDesignImagesFeed(feed);
            resolve(feed || null);
        });
    });
}

function NC_ensureColumnBuckets() {
    if (!NC_state.columnBuckets || typeof NC_state.columnBuckets !== 'object') {
        NC_state.columnBuckets = { left: [], right: [] };
    }
    if (!Array.isArray(NC_state.columnBuckets.left)) NC_state.columnBuckets.left = [];
    if (!Array.isArray(NC_state.columnBuckets.right)) NC_state.columnBuckets.right = [];
}

function NC_normalizeBucketEntry(entry) {
    const key = String(entry?.key || entry?.text || '').trim().toLowerCase();
    const text = String(entry?.text || entry?.key || '').trim() || key;
    return {
        key,
        text,
        nicheId: String(entry?.nicheId || ''),
        count: Math.max(1, Number(entry?.count) || 1)
    };
}

function NC_mergeBucketEntry(bucket, entry) {
    const norm = NC_normalizeBucketEntry(entry);
    if (!norm.key) return;
    const idx = bucket.findIndex((e) => e.key === norm.key);
    if (idx >= 0) {
        bucket[idx].count += norm.count;
        if (norm.nicheId) bucket[idx].nicheId = norm.nicheId;
        if (norm.text) bucket[idx].text = norm.text;
    } else {
        bucket.push(norm);
    }
}

function NC_moveLeftColumnToRight() {
    NC_ensureColumnBuckets();
    NC_state.columnBuckets.left.forEach((entry) => {
        NC_mergeBucketEntry(NC_state.columnBuckets.right, entry);
    });
    NC_state.columnBuckets.left = [];
}

function NC_countLinesByKey(lines) {
    const map = new Map();
    (Array.isArray(lines) ? lines : []).forEach((line) => {
        const key = String(line || '').trim().toLowerCase();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
}

function NC_buildLeftBucketFromNiches(niches, lineCounts) {
    const left = [];
    (Array.isArray(niches) ? niches : []).forEach((niche) => {
        const text = String(niche?.text || '').trim();
        const key = text.toLowerCase();
        if (!key) return;
        const count = lineCounts?.get(key) || 1;
        NC_mergeBucketEntry(left, { key, text, nicheId: niche.id, count });
    });
    return left;
}

function NC_applyNewBatchToColumns(niches, lineCounts) {
    NC_ensureColumnBuckets();
    NC_moveLeftColumnToRight();
    NC_state.columnBuckets.left = NC_buildLeftBucketFromNiches(niches, lineCounts);
}

function NC_syncLeftBucketWithNiches(niches, lineCounts) {
    NC_ensureColumnBuckets();
    NC_state.columnBuckets.left = NC_buildLeftBucketFromNiches(niches, lineCounts);
}

function NC_migrateLegacyColumnBucketsIfNeeded() {
    NC_ensureColumnBuckets();
    const hasAny = NC_state.columnBuckets.left.length > 0 || NC_state.columnBuckets.right.length > 0;
    if (hasAny || !NC_state.niches.length) return;
    NC_state.columnBuckets.left = NC_buildLeftBucketFromNiches(NC_state.niches);
}

function NC_batchKeyFromNiches(niches) {
    return (Array.isArray(niches) ? niches : [])
        .map((n) => String(n?.text || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('|');
}

function NC_resolveNicheForBucket(entry) {
    const norm = NC_normalizeBucketEntry(entry);
    if (!norm.key) return null;
    const byId = norm.nicheId
        ? NC_state.niches.find((n) => n.id === norm.nicheId)
        : null;
    if (byId) return byId;
    const byKey = NC_state.niches.find((n) => n.text.trim().toLowerCase() === norm.key);
    if (byKey) return byKey;
    return {
        id: norm.nicheId || `archived_${norm.key}`,
        text: norm.text || norm.key,
        isCompleted: false,
        done: false,
        _archivedColumnOnly: true
    };
}

function NC_getFilteredColumnEntries(bucket, filter = '') {
    NC_ensureColumnBuckets();
    const normalizedFilter = String(filter || '').trim().toLowerCase();
    return (Array.isArray(bucket) ? bucket : []).filter((entry) => {
        const niche = NC_resolveNicheForBucket(entry);
        const text = String(niche?.text || entry?.text || entry?.key || '').toLowerCase();
        return !normalizedFilter || text.includes(normalizedFilter);
    });
}

function openIsolatedToolWindow(url) {
    const popupWidth = 800;
    const popupHeight = 600;

    if (typeof chrome !== 'undefined' && chrome.windows?.create) {
        const screenWidth = typeof screen !== 'undefined' && Number.isFinite(screen.availWidth) ? screen.availWidth : popupWidth;
        const screenHeight = typeof screen !== 'undefined' && Number.isFinite(screen.availHeight) ? screen.availHeight : popupHeight;
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

    // Fallback for environments without chrome.windows.
    if (typeof window !== 'undefined') {
        const fallbackLeft = Math.round(((window.screen?.availWidth || popupWidth) - popupWidth) / 2);
        const fallbackTop = Math.round(((window.screen?.availHeight || popupHeight) - popupHeight) / 2);
        window.open(
            url,
            '_blank',
            `popup=yes,width=${popupWidth},height=${popupHeight},left=${fallbackLeft},top=${fallbackTop},noopener,noreferrer`
        );
    }
}

function NC_openIsolatedPopup(url) {
    openIsolatedToolWindow(url);
}

function NC_buildGoogleAiDesignsQuery(nicheText) {
    const template = String(NC_googleAiDesignsTemplate || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE).trim()
        || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE;
    return buildGoogleAiDesignsQuery(nicheText, template);
}

function copyNote(id, text) {
    NC_copyNicheText(id, text);
}

function deleteNote(id) {
    void NC_deleteNiche(id);
}

function isLowSpecModeEnabled() {
    return !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;
}

// طابور المعالجة التلقائية للأحكام الشرعية
let shariaQueue = [];
let isProcessingSharia = false;

const NC_SHARIA_CACHE_KEY = 'nhp_niche_sharia_cache';

function NC_isAiQuotaOrAccessError(error) {
    const message = String(error?.message || error || '');
    return /Gemini API Error \((403|429)\)|quota|rate limit|denied access|temporarily disabled/i.test(message);
}

function NC_aiRetryWaitMs() {
    const until = Number(window.AICentralBrain?.geminiApiDisabledUntil || 0);
    if (!Number.isFinite(until) || until <= Date.now()) return 0;
    return until - Date.now();
}

function NC_normalizeNicheKey(text) {
    return String(text || '').trim().toLowerCase();
}

/** @returns {'halal'|'haram'|'shubha'|'unknown'} */
function NC_classifyShariaFromText(ruling) {
    const s = String(ruling || '');
    // Arabic substrings + Latin/bracket forms — `\b` does not reliably anchor Arabic words in JS regex.
    if (/حرام|\[\s*haram\s*\]|\bharam\b/i.test(s)) return 'haram';
    if (/حلال|\[\s*halal\s*\]|\bhalal\b/i.test(s)) return 'halal';
    if (/شبهة|\[\s*(makruh|doubtful|doubt|ambiguous|uncertain|questionable)\s*\]/i.test(s)) {
        return 'shubha';
    }
    return 'unknown';
}

function NC_arabicLabelForClass(cls) {
    if (cls === 'haram') return 'حرام';
    if (cls === 'halal') return 'حلال';
    if (cls === 'shubha') return 'شبهة';
    return '';
}

function NC_defaultTooltipForClass(cls) {
    switch (cls) {
        case 'halal':
            return 'أخضر — حلال: تقدير ذكاء اصطناعي عام؛ العمل في هذا النيتش غالباً مسموح في سياق POD. للفتاوى الدقيقة استشر عالماً.';
        case 'haram':
            return 'أحمر — حرام: تقدير ذكاء اصطناعي عام؛ يُحتمل أن العمل في هذا السياق غير جائز. يُنصح بالتحقق مع أهل العلم.';
        case 'shubha':
            return 'برتقالي — شبهة: يوجد إشكال؛ راجع التفاصيل قبل الاعتماد التجاري. مرّر المؤشر لقراءة تبرير التحليل إن وُجد.';
        default:
            return 'رمادي — لم يُحسم بعد: جاري التحليل أو تعذّر الطلب. الجسر المحلي (127.0.0.1:3031) اختياري؛ إن وُجد مفتاح Gemini يُكمَل التحليل مباشرةً. انقر يميناً على النقطة لإعادة المحاولة.';
    }
}

function NC_nicheHasDefinitiveSharia(niche) {
    const fromField = niche?.shariaRuling;
    if (fromField === 'halal' || fromField === 'haram' || fromField === 'shubha') return true;
    const ar = String(niche?.sharia || '').trim();
    if (ar && NC_classifyShariaFromText(ar) !== 'unknown') return true;
    return false;
}

function NC_getShariaDotClass(niche) {
    if (niche?.shariaRuling && niche.shariaRuling !== 'unknown') return niche.shariaRuling;
    if (niche?.sharia) return NC_classifyShariaFromText(niche.sharia);
    return 'unknown';
}

function NC_getShariaDotTitle(niche) {
    const cls = NC_getShariaDotClass(niche);
    const reason = niche?.shariaReason || niche?.shariaAnalysis || '';
    const trimmed = String(reason || '').trim();
    if (cls === 'unknown' && trimmed) return trimmed;
    if (trimmed.length > 8) return trimmed;
    return NC_defaultTooltipForClass(cls);
}

function NC_syncDotElementFromNiche(dotEl, niche) {
    if (!dotEl || !niche) return;
    const cls = NC_getShariaDotClass(niche);
    dotEl.className = `nc-action-btn action-btn nc-sharia-btn nc-sharia-neon--${cls}`;
    const title = NC_getShariaDotTitle(niche);
    dotEl.title = title;
    dotEl.setAttribute('aria-label', title);
}

function NC_readShariaCache() {
    return new Promise((resolve) => {
        chrome.storage.local.get([NC_SHARIA_CACHE_KEY], (r) => {
            resolve(r[NC_SHARIA_CACHE_KEY] || {});
        });
    });
}

function NC_writeShariaCacheEntry(key, entry) {
    return NC_readShariaCache().then((all) => {
        all[key] = { ...entry, at: Date.now() };
        return new Promise((resolve) => {
            chrome.storage.local.set({ [NC_SHARIA_CACHE_KEY]: all }, resolve);
        });
    });
}

async function NC_hydrateShariaFromCache() {
    const cache = await NC_readShariaCache();
    let changed = false;
    for (const n of NC_state.niches) {
        const k = NC_normalizeNicheKey(n.text);
        const c = cache[k];
        if (c?.ruling && c.ruling !== 'unknown' && !NC_nicheHasDefinitiveSharia(n)) {
            n.shariaRuling = c.ruling;
            if (c.reason) n.shariaReason = c.reason;
            if (!n.sharia) n.sharia = NC_arabicLabelForClass(c.ruling);
            changed = true;
        }
    }
    if (changed) NC_scheduleSaveToLocal();
}

async function processShariaQueue() {
    if (isProcessingSharia) return;
    isProcessingSharia = true;
    while (shariaQueue.length > 0) {
        if (!isNotePanelActive()) break;
        if (NC_aiRetryWaitMs() > 0) {
            shariaQueue.forEach((item) => {
                if (item) item._shariaJobScheduled = false;
            });
            shariaQueue = [];
            break;
        }
        const niche = shariaQueue.shift();
        if (!NC_nicheHasDefinitiveSharia(niche)) {
            await NC_getShariaRuling(niche);
            if (NC_aiRetryWaitMs() > 0) {
                shariaQueue.forEach((item) => {
                    if (item) item._shariaJobScheduled = false;
                });
                shariaQueue = [];
                break;
            }
            await new Promise(r => setTimeout(r, 4000)); // فاصل زمني لتجنب حظر الـ API
        }
    }
    isProcessingSharia = false;
}

/**
 * Storage Functions
 */
function NC_escapeSelectorFragment(value) {
    const s = String(value ?? '');
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(s);
    }
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function NC_getNotesSearchFilter() {
    return document.getElementById('nc-search')?.value || '';
}

/** Immediate persist of Note module state; clears any pending debounced save. */
function NC_flushSaveToLocal() {
    clearTimeout(NC_saveTimer);
    NC_saveTimer = null;
    return new Promise((resolve) => {
        NC_ensureColumnBuckets();
        const dataToSave = {
            niches: NC_state.niches,
            unofficialTrends: NC_state.unofficialTrends,
            doneHistory: NC_state.doneHistory,
            history: NC_state.history,
            columnBuckets: NC_state.columnBuckets
        };
        const payloadJson = JSON.stringify(dataToSave);
        if (payloadJson === NC_lastPersistedTeepublicJson) {
            resolve();
            return;
        }
        NC_markTeepublicStorageEchoSuppress();
        chrome.storage.local.set({ teepublic_manager_data: dataToSave }, () => {
            NC_lastPersistedTeepublicJson = payloadJson;
            resolve();
        });
    });
}

/** Debounced persist for rapid toggles/deletes; flush on tab hide via NC_attachVisibilityFlush. */
function NC_scheduleSaveToLocal() {
    clearTimeout(NC_saveTimer);
    NC_saveTimer = setTimeout(() => {
        NC_saveTimer = null;
        NC_flushSaveToLocal().catch(() => {});
    }, NC_SAVE_DEBOUNCE_MS);
}

async function NC_saveToLocal() {
    await NC_flushSaveToLocal();
}

function NC_updateNotesStats(filter = '') {
    const statsEl = document.getElementById('nc-stats');
    if (!statsEl) return;
    const sortedEntries = NC_getSortedNiches(filter);
    const filteredLen = sortedEntries.length;
    const unofficialLen = NC_getFilteredUnofficialTrends(filter).length;
    const totalVisible = filteredLen + unofficialLen;
    statsEl.innerText = unofficialLen
        ? `${totalVisible} نيش (${filteredLen} عادي + ${unofficialLen} Radar)`
        : `${filteredLen} نيش`;
}

function NC_syncNicheCardCompletionDom(noteId) {
    const niche = NC_state.niches.find((n) => n.id === noteId);
    const sel = NC_escapeSelectorFragment(noteId);
    const card = document.querySelector(`.nc-master-card[data-niche-id="${sel}"]`);
    if (!niche || !card) return;
    const isPreviouslyDone = NC_state.doneHistory.includes(niche.text.trim().toLowerCase());
    const isActuallyDone = NC_isNicheCompleted(niche) || isPreviouslyDone;
    card.classList.toggle('niche-done', isActuallyDone);
    card.classList.toggle('completed-niche', isActuallyDone);
    const nameEl = card.querySelector('.nc-master-card-name');
    if (!nameEl) return;
    const raw = NC_escapeHtml(niche.text);
    nameEl.innerHTML = isActuallyDone ? `<span class="nc-master-card-done">${raw}</span>` : raw;
}

/** Coalesces multiple list refresh requests into one animation frame. */
function NC_requestRenderListSoon(filter) {
    NC_listRenderCoalesce.filter = filter;
    if (NC_listRenderCoalesce.raf) return;
    NC_listRenderCoalesce.raf = requestAnimationFrame(() => {
        NC_listRenderCoalesce.raf = 0;
        NC_renderList(NC_listRenderCoalesce.filter);
    });
}

function NC_scheduleStorageDriveRender(parts = { list: true, unofficial: false }) {
    if (!isNotePanelActive()) return;
    try {
        NC_storageRenderPending.list = NC_storageRenderPending.list || !!parts.list;
        NC_storageRenderPending.unofficial = NC_storageRenderPending.unofficial || !!parts.unofficial;
        NC_listRenderCoalesce.filter = NC_getNotesSearchFilter();
        clearTimeout(NC_storageRenderTimer);
        const nicheCount = NC_state.niches?.length || 0;
        const debounceMs = nicheCount > 200
            ? Math.min(420, NC_STORAGE_RENDER_DEBOUNCE_MS + 120)
            : NC_STORAGE_RENDER_DEBOUNCE_MS;
        NC_storageRenderTimer = setTimeout(() => {
            NC_storageRenderTimer = null;
            const pending = NC_storageRenderPending;
            NC_storageRenderPending = { list: false, unofficial: false };
            try {
                if (pending.list) NC_renderList(NC_listRenderCoalesce.filter);
                if (pending.unofficial) NC_renderUnofficialTrends();
            } catch (err) {
                console.warn('NC_scheduleStorageDriveRender:', err);
            }
        }, debounceMs);
    } catch (err) {
        console.warn('NC_scheduleStorageDriveRender (schedule):', err);
    }
}

function NC_attachVisibilityFlush() {
    if (NC_visibilityFlushAttached) return;
    NC_visibilityFlushAttached = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            void NC_flushSaveToLocal();
        }
    });
}

function NC_normalizeNichesArray(niches) {
    return (Array.isArray(niches) ? niches : []).map((niche) => {
        const isCompleted = typeof niche?.isCompleted === 'boolean'
            ? niche.isCompleted
            : !!niche?.done;
        let shariaRuling = niche.shariaRuling;
        if (!shariaRuling && niche.sharia) {
            const inferred = NC_classifyShariaFromText(niche.sharia);
            if (inferred !== 'unknown') shariaRuling = inferred;
        }
        return {
            ...niche,
            isCompleted,
            done: isCompleted,
            ...(shariaRuling ? { shariaRuling } : {})
        };
    });
}

function NC_snapshotPersistPayload() {
    NC_ensureColumnBuckets();
    return {
        niches: NC_state.niches,
        unofficialTrends: NC_state.unofficialTrends,
        doneHistory: NC_state.doneHistory,
        history: NC_state.history,
        columnBuckets: NC_state.columnBuckets
    };
}

function NC_bumpStorageLoadGeneration() {
    NC_storageLoadGeneration += 1;
}

function NC_markTeepublicStorageEchoSuppress(ms = NC_STORAGE_ECHO_SUPPRESS_MS) {
    NC_suppressTeepublicStorageListener = true;
    if (typeof window.NHP_markStorageEchoSuppress === 'function') {
        window.NHP_markStorageEchoSuppress(ms);
    }
    setTimeout(() => {
        NC_suppressTeepublicStorageListener = false;
    }, ms);
}

/** Avoid stale storage writes wiping in-memory imports (shows then disappears). */
function NC_shouldAcceptIncomingNiches(incomingCount) {
    const localCount = NC_state.niches.length;
    if (NC_importInFlight > 0) return false;
    if (incomingCount >= localCount) return true;
    if (localCount === 0) return true;
    return false;
}

function NC_applyPayloadFromStorage(data, { merge = false, force = false } = {}) {
    if (!data || typeof data !== 'object') return false;

    const incomingNiches = NC_normalizeNichesArray(data.niches);
    const localCount = NC_state.niches.length;
    const incomingCount = incomingNiches.length;
    const incomingHistoryCount = Array.isArray(data.history) ? data.history.length : 0;
    const localHistoryCount = Array.isArray(NC_state.history) ? NC_state.history.length : 0;
    const archiveAdvanced = incomingHistoryCount > localHistoryCount;

    if (!force && incomingCount < localCount && localCount > 0 && !archiveAdvanced) {
        if (merge && Array.isArray(data.unofficialTrends)) {
            NC_state.unofficialTrends = data.unofficialTrends;
        }
        return false;
    }
    if (merge && !archiveAdvanced && !NC_shouldAcceptIncomingNiches(incomingCount)) {
        if (Array.isArray(data.unofficialTrends)) {
            NC_state.unofficialTrends = data.unofficialTrends;
        }
        return false;
    }

    NC_state.niches = incomingNiches;
    if (Array.isArray(data.unofficialTrends)) NC_state.unofficialTrends = data.unofficialTrends;
    if (Array.isArray(data.doneHistory)) NC_state.doneHistory = data.doneHistory;
    if (Array.isArray(data.history)) NC_state.history = data.history;
    if (data.columnBuckets && typeof data.columnBuckets === 'object') {
        NC_state.columnBuckets = {
            left: Array.isArray(data.columnBuckets.left) ? data.columnBuckets.left.map(NC_normalizeBucketEntry) : [],
            right: Array.isArray(data.columnBuckets.right) ? data.columnBuckets.right.map(NC_normalizeBucketEntry) : []
        };
    } else {
        NC_state.columnBuckets = { left: [], right: [] };
    }
    NC_migrateLegacyColumnBucketsIfNeeded();
    try {
        NC_lastPersistedTeepublicJson = JSON.stringify(NC_snapshotPersistPayload());
    } catch (_) {
        NC_lastPersistedTeepublicJson = null;
    }
    return true;
}

function NC_syncBulkTextareaDeferred() {
    const bulkTextarea = document.getElementById('bulk-text');
    if (!bulkTextarea) return;
    const count = NC_state.niches.length;
    if (count > NC_BULK_TEXTAREA_MAX_LINES) {
        bulkTextarea.value = '';
        bulkTextarea.placeholder = `${count} نيش في القائمة — استخدم البحث أو التصدير (اللصق اليدوي الكبير قد يبطّئ الواجهة)`;
        return;
    }
    bulkTextarea.placeholder = '';
    const run = () => {
        bulkTextarea.value = NC_state.niches.map((n) => n.text).join('\n');
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 1400 });
    } else {
        setTimeout(run, 0);
    }
}

async function NC_loadFromLocal() {
    const generation = NC_storageLoadGeneration;
    return new Promise((resolve) => {
        chrome.storage.local.get(['teepublic_manager_data'], (res) => {
            if (generation !== NC_storageLoadGeneration) {
                resolve();
                return;
            }
            const data = res.teepublic_manager_data;
            if (data) {
                NC_applyPayloadFromStorage(data, { merge: true });
            } else {
                NC_state.niches = [];
                NC_state.unofficialTrends = [];
                NC_state.doneHistory = [];
                NC_state.history = [];
                NC_state.columnBuckets = { left: [], right: [] };
                NC_lastPersistedTeepublicJson = null;
            }
            resolve();
        });
    });
}

async function NC_refreshFromStorageIfNewer() {
    if (NC_importInFlight > 0) return;
    const generation = NC_storageLoadGeneration;
    return new Promise((resolve) => {
        chrome.storage.local.get(['teepublic_manager_data'], (res) => {
            if (generation !== NC_storageLoadGeneration) {
                resolve();
                return;
            }
            const data = res.teepublic_manager_data;
            if (data) NC_applyPayloadFromStorage(data, { merge: true });
            resolve();
        });
    });
}

async function NC_loadArchiveIndex() {
    try {
        NC_archiveIndex = await getArchiveIndexFromStorage();
    } catch (error) {
        console.warn('NC archive load failed:', error);
        NC_archiveIndex = { niches: {} };
    }
}

async function NC_loadTrendRanks() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['dailyTrends'], (res) => {
            NC_dailyTrends = Array.isArray(res.dailyTrends) ? res.dailyTrends : [];
            NC_trendRankIndex = null;
            resolve();
        });
    });
}

async function NC_loadGoogleAiDesignsTemplate() {
    return new Promise((resolve) => {
        chrome.storage.local.get([NC_GOOGLE_AI_DESIGNS_TEMPLATE_KEY], (res) => {
            const stored = String(res?.[NC_GOOGLE_AI_DESIGNS_TEMPLATE_KEY] || '').trim();
            NC_googleAiDesignsTemplate = stored || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE;
            resolve();
        });
    });
}

function NC_normalizeTrendMatchKey(text) {
    const base = String(text || '').trim();
    if (!base) return '';
    return base
        .toLowerCase()
        .normalize('NFKC')
        .replace(/&/g, ' and ')
        .replace(/[''`]/g, '')
        .replace(/[-–—_/]+/g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function NC_buildTrendRankIndex(trends) {
    const exact = new Map();
    const normalized = new Map();
    (Array.isArray(trends) ? trends : []).forEach((raw, i) => {
        const name = typeof raw === 'string'
            ? raw.trim()
            : String(raw?.text || raw?.name || raw?.title || raw?.niche || '').trim();
        if (!name) return;
        const rank = i + 1;
        const exactKey = name.toLowerCase();
        if (!exact.has(exactKey)) exact.set(exactKey, rank);
        const normKey = NC_normalizeTrendMatchKey(name);
        if (normKey && !normalized.has(normKey)) normalized.set(normKey, rank);
    });
    return { exact, normalized, version: trends.length };
}

function NC_getTrendRank(nicheText) {
    const target = String(nicheText || '').trim();
    if (!target) return null;

    const key = NC_normalizeNicheKey(target);
    if (key && NC_trendRankByKey.has(key)) return NC_trendRankByKey.get(key);

    if (!NC_dailyTrends.length) return null;
    if (!NC_trendRankIndex || NC_trendRankIndex.version !== NC_dailyTrends.length) {
        NC_trendRankIndex = NC_buildTrendRankIndex(NC_dailyTrends);
    }

    const exactKey = target.toLowerCase();
    if (NC_trendRankIndex.exact.has(exactKey)) return NC_trendRankIndex.exact.get(exactKey);

    const normKey = NC_normalizeTrendMatchKey(target);
    if (normKey && NC_trendRankIndex.normalized.has(normKey)) {
        return NC_trendRankIndex.normalized.get(normKey);
    }
    return null;
}

/** Max TeePublic pages shown in Notes (hide higher; match EmailCore Classified/Design Images). */
const NC_MAX_DISPLAY_PAGES = 15;
/** Live TeePublic search grid size (matches background.js / EmailCore extractAnalysisPageCount). */
const NC_TP_DESIGNS_PER_PAGE = 36;
/** Cross-feed page lookup: niche_key → real TeePublic page count (never invents). */
const NC_pageCountByKey = new Map();

function NC_indexPageCountKeys(keys, pages) {
    if (!Number.isFinite(pages) || pages < 0) return;
    for (const key of keys) {
        const k = NC_normalizeNicheKey(key);
        if (!k) continue;
        const prev = NC_pageCountByKey.get(k);
        NC_pageCountByKey.set(k, Number.isFinite(prev) ? Math.max(prev, pages) : pages);
    }
}

function NC_pagesFromTotalResults(totalResults, perPage = NC_TP_DESIGNS_PER_PAGE) {
    const total = Number(totalResults);
    if (!Number.isFinite(total) || total < 0) return null;
    const size = Number(perPage);
    const pageSize = Number.isFinite(size) && size > 0 ? size : NC_TP_DESIGNS_PER_PAGE;
    if (total === 0) return 0;
    return Math.max(1, Math.ceil(total / pageSize));
}

/** Extract real page count from a niche/feed record — never invents. */
function NC_extractPageCountFromRecord(row) {
    if (row == null) return null;
    let obj = row;
    if (typeof row === 'string') {
        const trimmed = row.trim();
        if (!trimmed) return null;
        try {
            obj = JSON.parse(trimmed);
        } catch {
            return null;
        }
    }
    if (!obj || typeof obj !== 'object') return null;

    const summary = obj.summary && typeof obj.summary === 'object' ? obj.summary : {};
    const detailRaw = obj.analysis_detail_json ?? obj.analysis_detail ?? obj.analysisDetail;
    let detail = null;
    if (detailRaw && typeof detailRaw === 'object') {
        detail = detailRaw;
    } else if (typeof detailRaw === 'string' && detailRaw.trim()) {
        try {
            detail = JSON.parse(detailRaw);
        } catch {
            detail = null;
        }
    }
    const detailSummary = detail?.summary && typeof detail.summary === 'object' ? detail.summary : {};

    const directCandidates = [
        obj.pageCount,
        obj.pages,
        obj.tp_pages,
        obj.teepublic_pages,
        obj.page_count,
        obj.analysis_page_count,
        obj.maxPage,
        summary.pageCount,
        summary.maxPage,
        summary.pages,
        detail?.pageCount,
        detail?.pages,
        detail?.maxPage,
        detailSummary.pageCount,
        detailSummary.maxPage,
    ];
    const directNums = directCandidates
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v >= 0);
    let best = directNums.length ? Math.max(...directNums) : null;

    const source = String(
        summary.source || obj.source || detailSummary.source || detail?.source || ''
    ).toLowerCase();
    // Explicit TeePublic "Page X of Y" must not be inflated by result-count math.
    if (source === 'pageof') {
        return Number.isFinite(best) ? best : null;
    }

    const totalResults = Number(
        summary.totalResults
        ?? obj.totalResults
        ?? obj.total_results
        ?? obj.designCount
        ?? obj.design_count
        ?? detailSummary.totalResults
        ?? detail?.totalResults
        ?? detail?.total_results
    );
    const perPageRaw = Number(
        summary.resultsPerPage
        ?? obj.resultsPerPage
        ?? obj.results_per_page
        ?? detailSummary.resultsPerPage
        ?? detail?.resultsPerPage
        ?? NC_TP_DESIGNS_PER_PAGE
    );
    const fromCount = NC_pagesFromTotalResults(totalResults, perPageRaw);
    if (Number.isFinite(fromCount)) {
        best = best == null ? fromCount : Math.max(best, fromCount);
    }
    return Number.isFinite(best) ? best : null;
}

function NC_lookupIndexedPageCount(nicheOrText) {
    const text = typeof nicheOrText === 'string'
        ? nicheOrText
        : (nicheOrText?.text || nicheOrText?.niche || nicheOrText?.niche_display || nicheOrText?.name || '');
    const keys = [
        NC_normalizeNicheKey(text),
        NC_normalizeNicheKey(nicheOrText?.niche_key),
        NC_normalizeNicheKey(nicheOrText?.nicheKey),
    ].filter(Boolean);
    let best = null;
    for (const key of keys) {
        const n = NC_pageCountByKey.get(key);
        if (!Number.isFinite(n) || n < 0) continue;
        best = best == null ? n : Math.max(best, n);
    }
    return Number.isFinite(best) ? best : null;
}

function NC_resolveNichePageCount(niche) {
    const fromObj = NC_extractPageCountFromRecord(niche);
    if (Number.isFinite(fromObj)) return fromObj;
    return NC_lookupIndexedPageCount(niche);
}

function NC_ingestTpPageCountsMap(pageCounts) {
    if (!pageCounts || typeof pageCounts !== 'object') return;
    for (const [rawKey, rawVal] of Object.entries(pageCounts)) {
        const n = Number(rawVal);
        if (!Number.isFinite(n) || n < 0) continue;
        NC_indexPageCountKeys([rawKey], n);
    }
}

function NC_ingestFinalCleanFeedItems(items) {
    for (const row of Array.isArray(items) ? items : []) {
        const pages = NC_extractPageCountFromRecord(row);
        if (!Number.isFinite(pages)) continue;
        const keys = [
            row?.niche_key,
            row?.nicheKey,
            row?.niche,
            row?.niche_display,
            row?.text,
            row?.name,
        ];
        NC_indexPageCountKeys(keys, pages);
    }
}

/** Load real page counts from Analysis + CREATY feeds into the lookup index. */
async function NC_loadPageCountIndex() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tpPageCounts', 'nhpFinalCleanFeed', NC_DESIGN_IMAGES_FEED_KEY], (res) => {
            NC_ingestTpPageCountsMap(res?.tpPageCounts);
            const cleanItems = res?.nhpFinalCleanFeed?.items;
            if (Array.isArray(cleanItems)) NC_ingestFinalCleanFeedItems(cleanItems);
            const feed = res?.[NC_DESIGN_IMAGES_FEED_KEY];
            if (feed && typeof feed === 'object') {
                // Re-index eligible/groups without wiping image map if already applied.
                const eligible = Array.isArray(feed.eligible_niches) ? feed.eligible_niches : [];
                for (const entry of eligible) {
                    const pages = NC_extractPageCountFromRecord(entry);
                    if (!Number.isFinite(pages)) continue;
                    NC_indexPageCountKeys([
                        entry?.niche_key,
                        entry?.niche,
                        entry?.niche_display,
                        entry?.name,
                        entry?.text,
                    ], pages);
                }
                for (const group of (Array.isArray(feed.groups) ? feed.groups : [])) {
                    NC_indexPageCountKeys([
                        group?.niche_key,
                        group?.niche,
                        group?.niche_display,
                    ], NC_extractPageCountFromRecord(group));
                }
            }
            resolve();
        });
    });
}

/** Soft-backfill pageCount onto niche objects when index/feed has real data. */
function NC_backfillNichePageCounts(niches = NC_state.niches) {
    let changed = false;
    for (const niche of Array.isArray(niches) ? niches : []) {
        if (!niche || typeof niche !== 'object') continue;
        const pages = NC_resolveNichePageCount(niche);
        if (!Number.isFinite(pages)) continue;
        if (!Number.isFinite(Number(niche.pageCount)) || Number(niche.pageCount) !== pages) {
            niche.pageCount = pages;
            changed = true;
        }
        if (!Number.isFinite(Number(niche.pages)) || Number(niche.pages) !== pages) {
            niche.pages = pages;
            changed = true;
        }
        NC_indexPageCountKeys([niche.text, niche.niche_key, niche.nicheKey], pages);
    }
    return changed;
}

function NC_intakeSortRank(niche) {
    return NC_isEarlyRadarNiche(niche) ? 1 : 0;
}

function NC_qualityClassKey(niche) {
    const q = String(niche?.quality || niche?.analysis_status || niche?.siteAnalysisStatus || '').trim().toLowerCase();
    if (q === 'excellent' || q === 'excel' || q === 'exc') return 'excellent';
    if (q === 'medium' || q === 'average' || q === 'med') return 'medium';
    if (q === 'saturated' || q === 'sat') return 'saturated';
    // Derive from real page count when quality field missing — never invent niches.
    const pages = NC_resolveNichePageCount(niche);
    if (Number.isFinite(pages)) {
        if (pages <= 3) return 'excellent';
        if (pages <= 6) return 'medium';
        return 'saturated';
    }
    return '';
}

/** Discrete page-band colors: ≤3 green, 4–6 orange, ≥7 red (matches legend). */
function NC_pagesSaturationStyle(pages) {
    if (!Number.isFinite(pages)) return '';
    if (pages <= 3) {
        return 'color:#10B981;border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.12)';
    }
    if (pages <= 6) {
        return 'color:#F59E0B;border-color:rgba(245,158,11,0.42);background:rgba(245,158,11,0.12)';
    }
    return 'color:#EF4444;border-color:rgba(239,68,68,0.42);background:rgba(239,68,68,0.12)';
}

/**
 * Opportunity tiers from quality × TeePublic trend rank (live list only).
 * ذهبي Golden: EXC + Trend #1–20
 * فضي Silver: EXC + #21–50 OR MED + #1–20
 * برونزي Bronze: MED + #21–50 OR EXC + #51+
 * Saturated stays مشبع (no gold/silver).
 */
function NC_resolveOpportunityTier(niche) {
    const klass = NC_qualityClassKey(niche);
    if (klass === 'saturated') return null;
    const trendRank = NC_getTrendRank(niche?.text);
    if (!Number.isFinite(trendRank) || trendRank < 1) return null;
    if (klass === 'excellent' && trendRank <= 20) {
        return {
            key: 'golden',
            labelAr: 'نيتش ذهبي',
            labelEn: 'Golden',
            title: 'نيتش ذهبي / Golden: ممتاز (EXC) + ترند #1–20',
        };
    }
    if ((klass === 'excellent' && trendRank <= 50) || (klass === 'medium' && trendRank <= 20)) {
        return {
            key: 'silver',
            labelAr: 'نيتش فضي',
            labelEn: 'Silver',
            title: 'نيتش فضي / Silver: ممتاز + ترند #21–50 أو متوسط + ترند #1–20',
        };
    }
    if ((klass === 'medium' && trendRank <= 50) || (klass === 'excellent' && trendRank > 50)) {
        return {
            key: 'bronze',
            labelAr: 'نيتش برونزي',
            labelEn: 'Bronze',
            title: 'نيتش برونزي / Bronze: متوسط + ترند #21–50 أو ممتاز + ترند #51+',
        };
    }
    return null;
}

function NC_getOpportunityTierBadgeHtml(niche) {
    const tier = NC_resolveOpportunityTier(niche);
    if (!tier) return '';
    return `<span class="nc-master-card-tag nc-master-card-tag--tier-${tier.key}" title="${NC_escapeHtml(tier.title)}">${NC_escapeHtml(tier.labelAr)}</span>`;
}

function NC_getQualityBadgeHtml(niche) {
    const klass = NC_qualityClassKey(niche);
    // Discrete class colors via CSS — do not override with page HSL.
    if (klass === 'excellent') {
        return `<span class="nc-master-card-tag nc-master-card-tag--exc" title="ممتاز / Excellent (EXC) — ≤3 صفحات">ممتاز</span>`;
    }
    if (klass === 'medium') {
        return `<span class="nc-master-card-tag nc-master-card-tag--med" title="متوسط / Medium (MED) — 4–6 صفحات">متوسط</span>`;
    }
    if (klass === 'saturated') {
        return `<span class="nc-master-card-tag nc-master-card-tag--sat" title="مشبع / Saturated (SAT) — ≥7 صفحات">مشبع</span>`;
    }
    return '';
}

function NC_getTrendBadgeHtml(niche) {
    const trendRank = NC_getTrendRank(niche?.text);
    if (Number.isFinite(trendRank) && trendRank >= 1) {
        return `<span class="nc-master-card-tag nc-master-card-tag--trend" title="ترتيب ترند TeePublic الرسمي #${trendRank}">Trend #${trendRank}</span>`;
    }
    const rec = getArchiveRecord(NC_archiveIndex, niche?.text);
    const archivedRank = rec?.latestRank || rec?.bestRank;
    if (Number.isFinite(archivedRank) && archivedRank >= 1) {
        return `<span class="nc-master-card-tag nc-master-card-tag--trend-arch" title="أفضل ترتيب مؤرشف #${archivedRank}">Best #${archivedRank}</span>`;
    }
    return '';
}

function NC_getPagesBadgeHtml(niche) {
    const pages = NC_resolveNichePageCount(niche);
    if (!Number.isFinite(pages)) return '';
    const satStyle = NC_pagesSaturationStyle(pages);
    return `<span class="nc-master-card-tag nc-master-card-tag--pages" style="${satStyle}" title="TeePublic pages">${pages} صفحات</span>`;
}

function NC_getClassAndPagesBadgeHtml(niche) {
    return `${NC_getOpportunityTierBadgeHtml(niche)}${NC_getQualityBadgeHtml(niche)}${NC_getTrendBadgeHtml(niche)}${NC_getPagesBadgeHtml(niche)}`;
}

function NC_getSortedNiches(filter = "") {
    return NC_state.niches
        .map((niche, index) => ({
            niche,
            originalIndex: index,
            trendRank: NC_getTrendRank(niche.text),
            archiveRecord: getArchiveRecord(NC_archiveIndex, niche.text),
            pages: NC_resolveNichePageCount(niche),
            intakeRank: NC_intakeSortRank(niche),
        }))
        .filter(({ niche, pages }) => {
            if (!niche.text.toLowerCase().includes(filter.toLowerCase())) return false;
            // Hide niches with known page count > 15 (unknown pages still shown).
            if (Number.isFinite(pages) && pages > NC_MAX_DISPLAY_PAGES) return false;
            return true;
        })
        .sort((a, b) => {
            // Official TeePublic trends first, then Early Radar (الرادار).
            if (a.intakeRank !== b.intakeRank) return a.intakeRank - b.intakeRank;

            const aPages = Number.isFinite(a.pages) ? a.pages : Number.POSITIVE_INFINITY;
            const bPages = Number.isFinite(b.pages) ? b.pages : Number.POSITIVE_INFINITY;
            if (aPages !== bPages) return aPages - bPages;

            const aIsLiveTrend = Number.isFinite(a.trendRank);
            const bIsLiveTrend = Number.isFinite(b.trendRank);
            if (aIsLiveTrend !== bIsLiveTrend) return aIsLiveTrend ? -1 : 1;
            if (aIsLiveTrend && bIsLiveTrend && a.trendRank !== b.trendRank) {
                return a.trendRank - b.trendRank;
            }

            return a.originalIndex - b.originalIndex;
        });
}

function NC_getMetaBadges(niche) {
    const archiveRecord = getArchiveRecord(NC_archiveIndex, niche.text);
    const liveTrendRank = NC_getTrendRank(niche.text);
    const archivedRank = archiveRecord?.latestRank || archiveRecord?.bestRank || null;
    if (!archiveRecord) {
        if (!liveTrendRank) {
            return `
                <div class="nc-meta-inline" style="flex:1 1 180px; min-width:120px; overflow:hidden; display:flex; align-items:center; justify-content:flex-start; gap:6px; white-space:nowrap;" title="هذا النيتش غير موجود في ترند اليوم">
                    <span class="nc-meta-priority" style="flex:0 0 auto; color:#94A3B8; border:1px solid rgba(148,163,184,0.28); background:rgba(148,163,184,0.10); padding:2px 7px; border-radius:999px; font-size:9px; font-weight:700;">
                        خارج ترند اليوم
                    </span>
                </div>
            `;
        }

        return `
            <div class="nc-meta-inline" style="flex:1 1 180px; min-width:120px; overflow:hidden; display:flex; align-items:center; justify-content:flex-start; gap:6px; white-space:nowrap;" title="ترتيب الترند الحالي #${liveTrendRank}">
                <span class="nc-meta-priority" style="flex:0 0 auto; color:#4F46E5; border:1px solid rgba(79,70,229,0.35); background:rgba(79,70,229,0.12); padding:2px 7px; border-radius:999px; font-size:9px; font-weight:700;">
                    ترند #${liveTrendRank}
                </span>
            </div>
        `;
    }

    const rank = liveTrendRank || archivedRank;
    const priorityMeta = getPriorityMeta(rank);
    const stageParts = [];
    if (archiveRecord.stages?.tmhunt) stageParts.push(`TMH ${archiveRecord.stages.tmhunt}`);
    if (archiveRecord.stages?.uspto) stageParts.push(`USPTO ${archiveRecord.stages.uspto}`);
    if (archiveRecord.stages?.analysis) stageParts.push(`ANL ${archiveRecord.stages.analysis}`);

    const visibleParts = [
        liveTrendRank ? `ترند #${liveTrendRank}` : null,
        !liveTrendRank && archivedRank ? `أفضل ترتيب #${archivedRank}` : null,
        !liveTrendRank && !archivedRank ? 'خارج ترند اليوم' : null,
        `أول ${formatArchiveDate(archiveRecord.firstSeenAt)}`,
        `ظهور ${archiveRecord.appearances || 1}`
    ].filter(Boolean);

    if (stageParts.length > 0) visibleParts.push(stageParts.join(' • '));

    const fullSummary = [
        `${priorityMeta.label}${rank ? ` #${rank}` : ''}`,
        ...visibleParts
    ].join(' • ');

    return `
        <div class="nc-meta-inline" style="flex:1 1 180px; min-width:120px; overflow:hidden; display:flex; align-items:center; justify-content:flex-start; gap:6px; white-space:nowrap;" title="${fullSummary.replace(/"/g, '&quot;')}">
            <span class="nc-meta-priority" style="flex:0 0 auto; color:${rank ? priorityMeta.color : '#94A3B8'}; border:1px solid ${rank ? `${priorityMeta.color}55` : 'rgba(148,163,184,0.28)'}; background:${rank ? `${priorityMeta.color}18` : 'rgba(148,163,184,0.10)'}; padding:2px 7px; border-radius:999px; font-size:9px; font-weight:700;">
                ${liveTrendRank ? `ترند #${liveTrendRank}` : archivedRank ? `أفضل #${archivedRank}` : 'خارج ترند اليوم'}
            </span>
            <span class="nc-meta-summary" style="min-width:0; overflow:hidden; text-overflow:ellipsis; color:var(--luxury-text-dim); font-size:10px; font-weight:600; direction:rtl; text-align:right;">
                ${visibleParts.join(' • ')}
            </span>
        </div>
    `;
}

function NC_getFilteredUnofficialTrends(filter = "") {
    const normalizedFilter = String(filter || '').trim().toLowerCase();
    const items = Array.isArray(NC_state.unofficialTrends) ? NC_state.unofficialTrends : [];
    return items.filter((item) => {
        const safeText = String(item?.text || item?.keyword || item?.niche || '').trim().toLowerCase();
        return !normalizedFilter || safeText.includes(normalizedFilter);
    });
}

function NC_isNicheCompleted(niche) {
    if (typeof niche?.isCompleted === 'boolean') return niche.isCompleted;
    return !!niche?.done;
}

function NC_appendUnofficialTrendCard(container, item) {
    if (!container || !item) return;

    const div = document.createElement('div');
    div.className = 'nc-task-card nc-imported-card';
    const safeText = String(item.text || item.keyword || item.niche || '').trim() || '[Missing niche text]';

    const badges = [
        `<span style="background:rgba(236,72,153,0.12); color:#ec4899; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(236,72,153,0.22);">RADAR</span>`
    ];
    if (item.usptoStatus === 'queued') badges.push(`<span style="background:rgba(245,158,11,0.12); color:#f59e0b; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(245,158,11,0.18);">USPTO</span>`);
    else if (item.usptoStatus === 'safe') badges.push(`<span style="background:rgba(16,185,129,0.12); color:#10b981; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(16,185,129,0.18);">SAFE</span>`);
    else if (item.usptoStatus === 'banned') badges.push(`<span style="background:rgba(239,68,68,0.12); color:#ef4444; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(239,68,68,0.18);">BLOCK</span>`);

    if (item.analysisStatus === 'excel') badges.push(`<span style="background:rgba(16,185,129,0.12); color:#10b981; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(16,185,129,0.18);">EXC</span>`);
    else if (item.analysisStatus === 'med') badges.push(`<span style="background:rgba(245,158,11,0.12); color:#f59e0b; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(245,158,11,0.18);">MED</span>`);
    else if (item.analysisStatus === 'sat') badges.push(`<span style="background:rgba(239,68,68,0.12); color:#ef4444; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(239,68,68,0.18);">SAT</span>`);
    if (item.sourceType === 'ai_fusion') badges.push(`<span style="background:rgba(236,72,153,0.12); color:#ec4899; font-size:7px; padding:1px 4px; border-radius:999px; margin-right:5px; font-weight:700; border:1px solid rgba(236,72,153,0.18);">AI</span>`);

    div.innerHTML = `
        <div class="nc-card-layout" style="display:flex; align-items:center; gap:10px; width:100%; direction:rtl;">
            <div class="nc-btn-group flex items-center gap-1.5" style="flex:0 0 auto; white-space:nowrap;">
                <button class="interactive btn-copy-unofficial nc-action-btn px-1.5" title="نسخ">
                    <i class="fa-solid fa-copy text-[9px]"></i>
                </button>
                <button class="interactive btn-preview-unofficial nc-action-btn px-1.5" title="فتح على TeePublic">
                    <i class="fa-solid fa-eye text-[9px]"></i>
                </button>
                <button class="interactive btn-radar-unofficial nc-action-btn px-1.5" title="فتح في Radar" style="background:rgba(236,72,153,0.1); color:#ec4899; border:1px solid rgba(236,72,153,0.2);">
                    <i class="fa-solid fa-radar text-[9px]"></i>
                </button>
            </div>
            <div class="flex-1 flex justify-end items-center overflow-hidden pr-3">
                ${badges.join('')}
                <span class="task-text text-right mr-3" style="font-weight:700; display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                    <i class="fa-solid fa-radar" style="color:#ec4899; font-size:10px; flex:0 0 auto;" title="Imported from Radar"></i>
                    <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${NC_escapeHtml(safeText)}</span>
                </span>
                <div class="w-2.5 h-2.5 rounded-full" style="background:#ec4899; box-shadow:0 0 16px rgba(236,72,153,0.35);"></div>
            </div>
        </div>
    `;

    div.addEventListener('click', (e) => {
        if (!e.target.closest('.interactive')) NC_copyNicheText(item.id || safeText, safeText);
    });

    div.querySelector('.btn-copy-unofficial')?.addEventListener('click', (e) => {
        e.stopPropagation();
        NC_copyNicheText(item.id || safeText, safeText);
    });
    div.querySelector('.btn-preview-unofficial')?.addEventListener('click', (e) => {
        e.stopPropagation();
        NC_openIsolatedPopup(`https://www.teepublic.com/t-shirts?query=${encodeURIComponent(safeText)}`);
    });
    div.querySelector('.btn-radar-unofficial')?.addEventListener('click', (e) => {
        e.stopPropagation();
        NC_openRadarAndScan(safeText);
    });

    container.appendChild(div);
}

/**
 * UI Functions
 */
function NC_getUnofficialPrimaryTag(item) {
    if (item.usptoStatus === 'safe') return 'USPTO safe';
    if (item.usptoStatus === 'banned') return 'USPTO block';
    if (item.usptoStatus === 'queued') return 'USPTO queue';
    if (item.analysisStatus === 'excel') return 'TP EXC';
    if (item.analysisStatus === 'med') return 'TP MED';
    if (item.analysisStatus === 'sat') return 'TP SAT';
    if (item.label) return String(item.label).slice(0, 18);
    return 'RADAR';
}

function NC_getUnofficialCardDate(item) {
    const raw = item.updatedAt || item.createdAt;
    return NC_formatShortDate(raw);
}

function NC_deleteUnofficialTrendByKey(key) {
    if (!key) return;
    NC_state.unofficialTrends = (NC_state.unofficialTrends || []).filter((it) => NC_stableUnofficialKey(it) !== key);
    NC_scheduleSaveToLocal();
    NC_requestRenderListSoon(NC_getNotesSearchFilter());
    showToastRef('Removed Radar item');
}

function NC_ensureImageHuntColumnVisible() {
    const col = document.getElementById('note-image-hunt-column')
        || document.getElementById('nc-image-hunt-column');
    if (!col) return;
    col.hidden = false;
    col.removeAttribute('hidden');
    col.classList.add('is-active');
}

function NC_fixNoteMasterDetailLayout() {
    const grid = document.getElementById('notes-master-detail');
    if (!grid) return;

    grid.classList.add('notes-master-detail-grid');
    grid.querySelector('#nc-detail-panel')?.remove();

    const master = grid.querySelector('.nc-master-column');
    const hunt = document.getElementById('note-image-hunt-column')
        || document.getElementById('nc-image-hunt-column');

    if (hunt && hunt.parentElement !== grid) {
        grid.appendChild(hunt);
    }

    if (master && hunt) {
        if (master.compareDocumentPosition(hunt) & Node.DOCUMENT_POSITION_PRECEDING) {
            grid.appendChild(hunt);
        } else if (hunt.nextElementSibling !== master) {
            grid.insertBefore(master, hunt);
            grid.appendChild(hunt);
        }
    }

    NC_ensureImageHuntColumnVisible();
}

function NC_syncImageHuntQueryFromSelection() {
    let text = '';
    if (NC_selection.kind === 'niche') {
        const niche = NC_getSelectedNiche();
        text = String(niche?.text || '').trim();
    } else if (NC_selection.kind === 'unofficial') {
        const item = (NC_state.unofficialTrends || []).find((it) => NC_stableUnofficialKey(it) === NC_selection.key);
        text = String(item?.text || item?.keyword || item?.niche || '').trim();
    }
    if (!text) return;
    NC_ensureImageHuntColumnVisible();
    if (typeof window.NHP_initNoteImageHunt === 'function') {
        window.NHP_initNoteImageHunt();
    }
    if (typeof window.NHP_setImageHuntQuery === 'function') {
        window.NHP_setImageHuntQuery(text);
    } else {
        const qInput = document.getElementById('note-image-hunt-query')
            || document.getElementById('nc-image-hunt-query');
        if (qInput) qInput.value = text;
    }
    // Niche select only sets the hunt query — no Design Images / Oracle auto-seed.
}

/** Debounce hunt query writes so rapid niche clicks don't thrash the hunt UI. */
function NC_scheduleImageHuntQuerySync() {
    clearTimeout(NC_huntQuerySyncTimer);
    NC_huntQuerySyncTimer = setTimeout(() => {
        NC_huntQuerySyncTimer = null;
        NC_syncImageHuntQueryFromSelection();
    }, NC_HUNT_QUERY_SYNC_MS);
}

function NC_clearActiveMasterCards() {
    document.querySelectorAll('.nc-master-card.is-active').forEach((el) => {
        el.classList.remove('is-active');
    });
}

function NC_setActiveMasterCard(selector) {
    NC_clearActiveMasterCards();
    if (!selector) return;
    document.querySelector(selector)?.classList.add('is-active');
}

/** Paint #note-image-hunt-grid from nhpDesignImagesFeed for one niche (manual «الموقع» only). */
function NC_seedSelectedNicheDesignImagesIntoHunt(nicheText) {
    const text = String(nicheText || '').trim();
    if (!text) return 0;
    const images = NC_lookupDesignImagesForText(text);
    if (typeof window.NHP_seedNoteImageHuntFromDesignImages === 'function') {
        return window.NHP_seedNoteImageHuntFromDesignImages(images, text) || 0;
    }
    // Fallback: paint grid directly if radar module not ready yet.
    const grid = document.getElementById('note-image-hunt-grid');
    if (!grid) return 0;
    if (!images.length) {
        grid.innerHTML = '';
        return 0;
    }
    grid.innerHTML = images.map((img, i) => {
        const src = NC_escapeHtml(img.thumb || img.full);
        const title = NC_escapeHtml(img.title || text);
        return `<div class="radar-image-hunt-card" data-index="${i}" title="Design Images">
            <div class="radar-image-hunt-thumb">
                <img src="${src}" alt="${title}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
                <span class="radar-image-source-badge">Design Images</span>
            </div>
        </div>`;
    }).join('');
    return images.length;
}

/**
 * Manual niche-row «الموقع»: load EmailCore Design Images for this niche into left hunt grid.
 * Uses cached nhpDesignImagesFeed; refreshes from CREATY /nhp/design-images if empty.
 */
async function NC_loadDesignImagesForNicheIntoHunt(nicheText) {
    const text = String(nicheText || '').trim();
    if (!text) return 0;

    NC_ensureImageHuntColumnVisible();
    if (typeof window.NHP_initNoteImageHunt === 'function') {
        window.NHP_initNoteImageHunt();
    }
    if (typeof window.NHP_setImageHuntQuery === 'function') {
        window.NHP_setImageHuntQuery(text);
    }

    let images = NC_lookupDesignImagesForText(text);
    if (!images.length) {
        showToastRef('⏳ جاري جلب Design Images من الموقع…');
        await NC_refreshDesignImagesFeed({ quiet: true });
        images = NC_lookupDesignImagesForText(text);
    }

    const count = NC_seedSelectedNicheDesignImagesIntoHunt(text);
    if (count > 0) {
        showToastRef(`🖼️ ${count} صورة من Design Images (الموقع)`);
    } else {
        showToastRef('ℹ️ لا صور Design Images لهذا النيتش على الموقع');
    }
    return count;
}

function NC_renderList(filter = "") {
    const shell = document.getElementById('niche-container');
    const col0 = document.getElementById('niche-col-0');
    const tail = document.getElementById('niche-tail');
    const splitRow = shell?.querySelector('.nc-master-split-row');
    if (!shell || !col0 || !tail) return;

    const sortedEntries = NC_getSortedNiches(filter);
    const filtered = sortedEntries.map(({ niche }) => niche);
    const unofficialItems = NC_getFilteredUnofficialTrends(filter);
    NC_ensureColumnBuckets();
    NC_migrateLegacyColumnBucketsIfNeeded();
    const leftBucketVisible = NC_getFilteredColumnEntries(NC_state.columnBuckets.left, filter);
    const rightBucketVisible = NC_getFilteredColumnEntries(NC_state.columnBuckets.right, filter);
    const bucketVisible = leftBucketVisible.length + rightBucketVisible.length;
    const totalVisible = bucketVisible + unofficialItems.length;
    const listFp = NC_buildListRenderFingerprint(filter, sortedEntries, unofficialItems);
    // Check fingerprint before clearing DOM — early return after innerHTML='' left stats at N but list empty.
    if (listFp === NC_listRenderFingerprint && totalVisible > 0) {
        const statsEl = document.getElementById('nc-stats');
        if (statsEl) {
            statsEl.innerText = unofficialItems.length
                ? `${totalVisible} نيش (${filtered.length} عادي + ${unofficialItems.length} Radar)`
                : `${filtered.length} نيش`;
        }
        return;
    }
    NC_listRenderFingerprint = listFp;

    col0.innerHTML = '';
    tail.innerHTML = '';
    tail.hidden = true;
    shell.classList.remove('nc-master-shell--empty', 'nc-master-shell--tail-only');
    if (splitRow) splitRow.style.display = '';

    const statsEl = document.getElementById('nc-stats');
    if (statsEl) {
        statsEl.innerText = unofficialItems.length
            ? `${totalVisible} نيش (${filtered.length} عادي + ${unofficialItems.length} Radar)`
            : `${filtered.length} نيش`;
    }

    if (totalVisible === 0) {
        NC_listRenderFingerprint = '';
        NC_selection = { kind: 'none' };
        shell.classList.add('nc-master-shell--empty');
        if (splitRow) splitRow.style.display = 'none';
        tail.hidden = false;
        tail.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 opacity-30">
                <i class="fa-solid fa-cloud-upload-alt text-4xl mb-3 text-slate-500"></i>
                <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">لصق النيشات للبدء</p>
            </div>
        `;
        return;
    }

    const prevNicheId = NC_selection.kind === 'niche' ? NC_selection.id : null;
    const prevUnofficialKey = NC_selection.kind === 'unofficial' ? NC_selection.key : null;

    const maxCards = isLowSpecModeEnabled() ? NOTE_LITE_MAX_VISIBLE_ITEMS : NOTE_LIST_MAX_VISIBLE_ITEMS;
    let leftBucketEntries = leftBucketVisible;
    let rightBucketEntries = rightBucketVisible;
    let listCapped = false;
    const combinedBucketCount = leftBucketEntries.length + rightBucketEntries.length;
    if (combinedBucketCount > maxCards) {
        listCapped = true;
        if (leftBucketEntries.length >= maxCards) {
            leftBucketEntries = leftBucketEntries.slice(0, maxCards);
            rightBucketEntries = [];
        } else {
            rightBucketEntries = rightBucketEntries.slice(0, maxCards - leftBucketEntries.length);
        }
    }
    const hasNicheCards = leftBucketEntries.length > 0 || rightBucketEntries.length > 0;
    if (splitRow) splitRow.style.display = hasNicheCards ? '' : 'none';
    shell.classList.toggle('nc-master-shell--tail-only', !hasNicheCards && unofficialItems.length > 0);

    if (statsEl && hasNicheCards) {
        const leftTotal = NC_state.columnBuckets.left.reduce((sum, e) => sum + (e.count || 1), 0);
        const rightTotal = NC_state.columnBuckets.right.reduce((sum, e) => sum + (e.count || 1), 0);
        const base = unofficialItems.length
            ? `${filtered.length} نيش (${filtered.length} عادي + ${unofficialItems.length} Radar)`
            : `${filtered.length} نيش`;
        const capHint = listCapped ? ` — عرض ${leftBucketEntries.length + rightBucketEntries.length}/${combinedBucketCount}` : '';
        statsEl.innerText = `${base} — حديثة ${leftTotal} | قديمة ${rightTotal}${capHint}`;
    }

    const appendNicheCard = (niche, columnEl, appearanceCount = 1) => {
        const div = document.createElement('div');
        const isPreviouslyDone = NC_state.doneHistory.includes(niche.text.trim().toLowerCase());
        const isActuallyDone = NC_isNicheCompleted(niche) || isPreviouslyDone;
        const safeText = String(niche.text || '').trim();

        div.className = `nc-master-card nc-master-card--niche ${isActuallyDone ? 'niche-done completed-niche' : ''}`;
        div.dataset.nicheId = niche.id;
        div.title = NC_getDescriptorText(niche);

        const primary = NC_escapeHtml(NC_getPrimaryTagLabel(niche));
        const dateLabel = NC_escapeHtml(NC_getCardDateLabel(niche));
        const intakeBadge = NC_getIntakeOriginBadgeHtml(niche);
        const tierBadge = NC_getOpportunityTierBadgeHtml(niche);
        const qualityBadge = NC_getQualityBadgeHtml(niche);
        const trendBadge = NC_getTrendBadgeHtml(niche);
        const pagesBadge = NC_getPagesBadgeHtml(niche);
        const recheckBadge = niche.needsReanalysis
            ? '<span class="nc-master-card-tag" style="background:rgba(56,189,248,0.12);color:#38bdf8;border-color:rgba(56,189,248,0.28);">RECHECK</span>'
            : '';
        const countBadge = appearanceCount > 1
            ? `<span class="nc-master-card-count" title="ظهر ${appearanceCount} مرات في هذا العمود">×${appearanceCount}</span>`
            : '';
        let nameHtml = NC_escapeHtml(niche.text);
        if (isActuallyDone) {
            nameHtml = `<span class="nc-master-card-done">${nameHtml}</span>`;
        }

        const hasSharia = NC_nicheHasDefinitiveSharia(niche);
        const dotClassBase = hasSharia
            ? `nc-action-btn action-btn nc-sharia-btn nc-sharia-neon--${NC_getShariaDotClass(niche)}`
            : (isLowSpecModeEnabled()
                ? 'nc-action-btn action-btn nc-sharia-btn nc-sharia-neon--unknown'
                : 'nc-action-btn action-btn nc-sharia-btn nc-sharia-neon--loading');
        const dotTitleRaw = hasSharia
            ? NC_getShariaDotTitle(niche)
            : (isLowSpecModeEnabled()
                ? NC_defaultTooltipForClass('unknown')
                : 'جاري تحليل مدى ملاءمة العمل في هذا النيتش للمسلم (ذكاء اصطناعي)…');
        const dotTitleEsc = NC_escapeHtml(dotTitleRaw);

        /* Fixed meta slots → quality | pages | intake | trend | date (+ golden/silver when match) */
        div.innerHTML = `
            <div class="nc-master-card-body note-text-wrapper nc-title-lane">
                <div class="nc-master-card-name note-title" title="${NC_escapeHtml(safeText)}">${nameHtml}${countBadge}</div>
            </div>
            <div class="nc-master-card-meta nc-meta-lane" dir="ltr">
                <span class="nc-meta-slot nc-meta-slot--quality">${tierBadge}${qualityBadge}</span>
                <span class="nc-meta-slot nc-meta-slot--pages">${pagesBadge}</span>
                <span class="nc-meta-slot nc-meta-slot--intake">${intakeBadge}</span>
                <span class="nc-meta-slot nc-meta-slot--trend">
                    ${trendBadge || `<span class="nc-master-card-tag note-trend">${primary}</span>`}${recheckBadge}
                </span>
                <span class="nc-meta-slot nc-meta-slot--date">
                    <span class="nc-master-card-date note-date">${dateLabel}</span>
                </span>
            </div>
            <div class="nc-niche-actions-row">
                <div class="nc-btn-group note-actions">
                <button type="button" class="nc-action-btn action-btn done-btn" data-action="toggle-done" title="Mark as Done">
                    <span aria-hidden="true">✔️</span>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-pinterest" data-action="pinterest" title="صيد من Pinterest — Ctrl+نقرة لفتح في المتصفح">
                    <i class="fa-brands fa-pinterest-p"></i>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-google-images" data-action="google-images-recent" title="صيد من صور Google (24 ساعة) — Ctrl+نقرة لفتح في المتصفح">
                    <i class="fa-regular fa-images"></i>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-google-ai-designs" data-action="google-ai-designs" title="صيد من تصاميم AI — Ctrl+نقرة لفتح في المتصفح">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-teepublic" data-action="teepublic" title="صيد من TeePublic — Ctrl+نقرة لفتح في المتصفح">
                    <i class="fa-solid fa-shirt"></i>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-design-images" data-action="design-images" title="جلب صور Design Images من الموقع (EmailCore) لهذا النيتش فقط">
                    <span class="nc-design-images-btn-label" aria-hidden="true">الموقع</span>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-image-hunt" data-action="image-hunt" title="صيد الصور في عمود النوت — جلب من المصادر (يدوي)">
                    <span class="nc-image-hunt-btn-label" aria-hidden="true">صيد</span>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-ai-mode" data-action="ai-mode" title="توليد معلومات النيتش عبر الذكاء الاصطناعي">
                    <span aria-hidden="true">✨</span>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-copy" data-action="copy" title="Copy note">
                    <i class="fa-solid fa-copy"></i>
                </button>
                <button type="button" class="nc-action-btn action-btn btn-delete delete-btn" data-action="delete" title="Delete note">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <button type="button" id="sharia-dot-${niche.id}" class="${dotClassBase}" title="${dotTitleEsc}" aria-label="${dotTitleEsc}">
                    <span class="nc-sharia-indicator" aria-hidden="true"></span>
                </button>
                </div>
            </div>
        `;

        div.addEventListener('click', () => {
            NC_selectNiche(niche.id);
        });
        div.querySelector('.note-title')?.addEventListener('click', (e) => {
            e.stopPropagation();
            NC_selectNiche(niche.id);
            void NC_openRadarAndScan(safeText, 'aggregator');
        });
        div.querySelector('.note-actions')?.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;
            e.stopPropagation();
            const encodedName = encodeURIComponent(safeText);
            const action = actionBtn.dataset.action;
            const openExternal = !!(e.ctrlKey || e.metaKey);
            const huntFromSource = (sourceMode, externalUrl) => {
                NC_selectNiche(niche.id);
                if (openExternal && externalUrl) {
                    openIsolatedToolWindow(externalUrl);
                    return;
                }
                void NC_openRadarAndScan(safeText, sourceMode);
            };
            if (action === 'pinterest') {
                huntFromSource('pinterest', buildPinterestSearchUrl(safeText));
                return;
            }
            if (action === 'toggle-done') {
                void toggleNoteCompletion(niche.id);
                return;
            }
            if (action === 'google-images-recent') {
                huntFromSource('google_images', buildGoogleImagesRecentUrl(safeText));
                return;
            }
            if (action === 'google-ai-designs') {
                huntFromSource('google_ai', buildGoogleAiModeUrl(safeText, NC_googleAiDesignsTemplate));
                return;
            }
            if (action === 'teepublic') {
                huntFromSource('teepublic', buildTeepublicSearchUrl(safeText));
                return;
            }
            if (action === 'design-images') {
                NC_selectNiche(niche.id);
                void NC_loadDesignImagesForNicheIntoHunt(safeText);
                return;
            }
            if (action === 'image-hunt') {
                NC_selectNiche(niche.id);
                void NC_openRadarAndScan(safeText, 'aggregator');
                return;
            }
            if (action === 'ai-mode') {
                openIsolatedToolWindow(`https://google.com/search?q=شرح+${encodedName}`);
                return;
            }
            if (action === 'copy') {
                copyNote(niche.id, safeText);
                return;
            }
            if (action === 'delete') {
                void deleteNote(niche.id);
            }
        });

        div.querySelector(`#sharia-dot-${niche.id}`)?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const live = NC_state.niches.find((n) => n.id === niche.id);
            if (!live || NC_nicheHasDefinitiveSharia(live)) return;
            live._shariaAutoFetchDone = false;
            live._shariaJobScheduled = false;
            live._shariaInFlight = false;
            showToastRef('إعادة التحليل الشرعي…');
            void NC_getShariaRuling(live);
        });

        columnEl.appendChild(div);

        if (
            !niche._archivedColumnOnly
            && !isLowSpecModeEnabled()
            && !NC_nicheHasDefinitiveSharia(niche)
            && !niche._shariaAutoFetchDone
            && !niche._shariaJobScheduled
            && !niche._shariaInFlight
        ) {
            niche._shariaJobScheduled = true;
            shariaQueue.push(niche);
            processShariaQueue();
        }
    };

    const leftFrag = document.createDocumentFragment();
    leftBucketEntries.forEach((entry) => {
        const niche = NC_resolveNicheForBucket(entry);
        if (niche) appendNicheCard(niche, leftFrag, entry.count || 1);
    });
    col0.appendChild(leftFrag);
    if (rightBucketEntries.length) {
        const oldDivider = document.createElement('div');
        oldDivider.className = 'nc-master-divider';
        oldDivider.innerHTML = `
            <div class="nc-master-divider-line"></div>
            <div class="nc-master-divider-label">
                <span>النيتشات القديمة المتراكمة</span>
            </div>
            <div class="nc-master-divider-line"></div>
        `;
        col0.appendChild(oldDivider);
        const rightFrag = document.createDocumentFragment();
        rightBucketEntries.forEach((entry) => {
            const niche = NC_resolveNicheForBucket(entry);
            if (niche) appendNicheCard(niche, rightFrag, entry.count || 1);
        });
        col0.appendChild(rightFrag);
    }

    if (unofficialItems.length) {
        tail.hidden = false;
        const divider = document.createElement('div');
        divider.className = 'nc-master-divider';
        divider.innerHTML = `
            <div class="nc-master-divider-line"></div>
            <div class="nc-master-divider-label">
                <i class="fa-solid fa-radar"></i>
                <span>Imported From Radar</span>
            </div>
            <div class="nc-master-divider-line"></div>
        `;
        tail.appendChild(divider);

        const unofficialCap = isLowSpecModeEnabled()
            ? Math.max(20, Math.floor(NOTE_LITE_MAX_VISIBLE_ITEMS / 3))
            : Math.max(40, Math.floor(NOTE_LIST_MAX_VISIBLE_ITEMS / 2));
        const visibleUnofficialItems = unofficialItems.length > unofficialCap
            ? unofficialItems.slice(0, unofficialCap)
            : unofficialItems;

        const tailFrag = document.createDocumentFragment();
        visibleUnofficialItems.forEach((item) => {
            const div = document.createElement('div');
            const key = NC_stableUnofficialKey(item);
            div.className = 'nc-master-card nc-master-card--unofficial';
            div.dataset.unofficialKey = key;
            const safeText = String(item.text || item.keyword || item.niche || '').trim() || '[Missing niche text]';
            div.title = safeText;

            const primary = NC_escapeHtml(NC_getUnofficialPrimaryTag(item));
            const dateLabel = NC_escapeHtml(NC_getUnofficialCardDate(item));
            const pagesBadge = NC_getPagesBadgeHtml(item);

            div.innerHTML = `
                <div class="nc-master-card-body note-text-wrapper nc-title-lane">
                    <div class="nc-master-card-name note-title">${NC_escapeHtml(safeText)}</div>
                </div>
                <div class="nc-master-card-meta nc-meta-lane" dir="ltr">
                    <span class="nc-meta-slot nc-meta-slot--quality"></span>
                    <span class="nc-meta-slot nc-meta-slot--pages">${pagesBadge}</span>
                    <span class="nc-meta-slot nc-meta-slot--intake">
                        <span class="nc-master-card-tag nc-master-card-tag--radar">${primary}</span>
                    </span>
                    <span class="nc-meta-slot nc-meta-slot--trend"></span>
                    <span class="nc-meta-slot nc-meta-slot--date">
                        <span class="nc-master-card-date">${dateLabel}</span>
                    </span>
                </div>
                <div class="nc-unofficial-actions note-actions">
                    <button type="button" class="nc-action-btn btn-google" title="Google search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                    <button type="button" class="nc-action-btn btn-uspto" title="USPTO search">
                        <i class="fa-solid fa-landmark"></i>
                    </button>
                    <button type="button" class="nc-action-btn btn-trademark" title="Trademark search">
                        <i class="fa-solid fa-certificate"></i>
                    </button>
                    <button type="button" class="nc-action-btn btn-copy" title="Copy">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button type="button" class="nc-action-btn btn-delete" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            div.addEventListener('click', () => NC_selectUnofficial(item));
            div.querySelector('.btn-google')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openIsolatedToolWindow(`https://www.google.com/search?q=${encodeURIComponent(safeText)}`);
            });
            div.querySelector('.btn-uspto')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openIsolatedToolWindow(`https://tmsearch.uspto.gov/search/search-results?query=${encodeURIComponent(safeText)}`);
            });
            div.querySelector('.btn-trademark')?.addEventListener('click', (e) => {
                e.stopPropagation();
                openIsolatedToolWindow(`https://www.trademarkia.com/trademarks-search.aspx?tn=${encodeURIComponent(safeText)}`);
            });
            div.querySelector('.btn-copy')?.addEventListener('click', (e) => {
                e.stopPropagation();
                NC_copyNicheText(item.id || key, safeText);
            });
            div.querySelector('.btn-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                void NC_deleteUnofficialTrendByKey(key);
            });
            tailFrag.appendChild(div);
        });
        tail.appendChild(tailFrag);
    }

    const nicheStillThere = prevNicheId && NC_state.niches.some((n) => n.id === prevNicheId);
    const unofficialStillThere = prevUnofficialKey
        && unofficialItems.some((it) => NC_stableUnofficialKey(it) === prevUnofficialKey);

    if (nicheStillThere) {
        NC_selectNiche(prevNicheId);
    } else if (unofficialStillThere) {
        NC_selection = { kind: 'unofficial', key: prevUnofficialKey };
        NC_setActiveMasterCard(`.nc-master-card[data-unofficial-key="${NC_escapeSelectorFragment(prevUnofficialKey)}"]`);
        NC_scheduleImageHuntQuerySync();
    } else if (leftBucketEntries.length > 0) {
        const firstLeft = NC_resolveNicheForBucket(leftBucketEntries[0]);
        if (firstLeft) NC_selectNiche(firstLeft.id);
    } else if (rightBucketEntries.length > 0) {
        const firstRight = NC_resolveNicheForBucket(rightBucketEntries[0]);
        if (firstRight) NC_selectNiche(firstRight.id);
    } else if (filtered.length > 0) {
        NC_selectNiche(sortedEntries[0].niche.id);
    } else if (unofficialItems.length > 0) {
        const first = isLowSpecModeEnabled()
            ? unofficialItems.slice(0, Math.max(20, Math.floor(NOTE_LITE_MAX_VISIBLE_ITEMS / 3)))[0]
            : unofficialItems[0];
        NC_selectUnofficial(first);
    } else {
        NC_selection = { kind: 'none' };
    }
}

function NC_getUnofficialBadge(label, color) {
    return `<span style="display:inline-flex; align-items:center; padding:2px 7px; border-radius:999px; font-size:9px; font-weight:700; color:${color}; background:${color}20; border:1px solid ${color}35;">${label}</span>`;
}

function NC_escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function NC_stableUnofficialKey(item) {
    const t = String(item?.text || item?.keyword || item?.niche || '').trim();
    return String(item?.id || '').trim() || `u_${t.toLowerCase().slice(0, 80)}`;
}

function NC_formatShortDate(isoOrArchive) {
    if (!isoOrArchive) return '—';
    try {
        const d = new Date(isoOrArchive);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
        return '—';
    }
}

function NC_getCardDateLabel(niche) {
    if (niche?.addedAt) return NC_formatShortDate(niche.addedAt);
    const rec = getArchiveRecord(NC_archiveIndex, niche?.text);
    if (rec?.firstSeenAt) return NC_formatShortDate(rec.firstSeenAt);
    return '—';
}

function NC_getPrimaryTagLabel(niche) {
    const trendRank = NC_getTrendRank(niche?.text);
    if (Number.isFinite(trendRank) && trendRank >= 1) return `Trend #${trendRank}`;
    const rec = getArchiveRecord(NC_archiveIndex, niche?.text);
    const archivedRank = rec?.latestRank || rec?.bestRank;
    if (archivedRank) return `Best #${archivedRank}`;
    return '—';
}

/** Normalize EmailCore intake origin: early_radar | teepublic_trends | ''. */
function NC_resolveIntakeSource(rowOrNiche) {
    const raw = String(rowOrNiche?.intake_source || '').trim().toLowerCase();
    if (raw === 'early_radar' || raw === 'teepublic_trends') return raw;
    if (rowOrNiche?.from_early_radar === true) return 'early_radar';
    const batch = String(rowOrNiche?.source_batch_id || '').trim();
    if (/^early_radar/i.test(batch)) return 'early_radar';
    return raw || '';
}

function NC_isEarlyRadarNiche(niche) {
    return NC_resolveIntakeSource(niche) === 'early_radar'
        || niche?.from_early_radar === true;
}

/** Badge: Official TeePublic trends vs Early Radar («الرادار») — site Design Images parity. */
function NC_getIntakeOriginBadgeHtml(niche) {
    const source = NC_resolveIntakeSource(niche);
    if (!source && niche?.from_early_radar !== true && niche?.from_early_radar !== false) {
        return '';
    }
    if (NC_isEarlyRadarNiche(niche) || source === 'early_radar') {
        return `<span class="nc-master-card-tag nc-master-card-tag--intake-radar" title="Early Niche Radar — غير رسمي">الرادار</span>`;
    }
    if (source === 'teepublic_trends') {
        return `<span class="nc-master-card-tag nc-master-card-tag--intake-official" title="Official TeePublic trends">TeePublic</span>`;
    }
    return '';
}

function NC_getSelectedNiche() {
    if (NC_selection.kind !== 'niche') return null;
    return NC_state.niches.find((n) => n.id === NC_selection.id) || null;
}

function NC_selectNiche(id) {
    NC_selection = id ? { kind: 'niche', id } : { kind: 'none' };
    if (id) {
        NC_setActiveMasterCard(`.nc-master-card[data-niche-id="${NC_escapeSelectorFragment(id)}"]`);
        NC_scheduleImageHuntQuerySync();
    } else {
        NC_clearActiveMasterCards();
    }
}

function NC_selectUnofficial(item) {
    const key = NC_stableUnofficialKey(item);
    NC_selection = { kind: 'unofficial', key };
    NC_setActiveMasterCard(`.nc-master-card[data-unofficial-key="${NC_escapeSelectorFragment(key)}"]`);
    NC_scheduleImageHuntQuerySync();
}

function NC_extractTrendBadge(descriptorText, fallbackRank) {
    const safeDescriptor = String(descriptorText || '').trim();
    let badgeText = '';
    let tooltipText = safeDescriptor;

    const trendPattern = /(?:ترند|trend)\s*#?\s*(\d{1,4})/i;
    const trendMatch = safeDescriptor.match(trendPattern);
    if (trendMatch) {
        badgeText = `ترند #${trendMatch[1]}`;
        tooltipText = safeDescriptor
            .replace(trendMatch[0], '')
            .replace(/\s*•\s*•\s*/g, ' • ')
            .replace(/^\s*•\s*|\s*•\s*$/g, '')
            .trim();
    } else if (Number.isFinite(fallbackRank)) {
        badgeText = `ترند #${fallbackRank}`;
    }

    return {
        badgeText,
        tooltipText: tooltipText || safeDescriptor
    };
}

function NC_getDescriptorText(niche) {
    const archiveRecord = getArchiveRecord(NC_archiveIndex, niche.text);
    const liveTrendRank = NC_getTrendRank(niche.text);
    const archivedRank = archiveRecord?.latestRank || archiveRecord?.bestRank || null;
    const parts = [];

    if (liveTrendRank) parts.push(`ترند #${liveTrendRank}`);
    else if (archivedRank) parts.push(`أفضل #${archivedRank}`);
    else parts.push('خارج ترند اليوم');

    if (archiveRecord?.firstSeenAt) parts.push(`أول ${formatArchiveDate(archiveRecord.firstSeenAt)}`);
    if (archiveRecord?.appearances) parts.push(`ظهور ${archiveRecord.appearances}`);
    if (archiveRecord?.stages?.tmhunt) parts.push(`TMH ${archiveRecord.stages.tmhunt}`);
    if (archiveRecord?.stages?.uspto) parts.push(`USPTO ${archiveRecord.stages.uspto}`);
    if (archiveRecord?.stages?.analysis) parts.push(`ANL ${archiveRecord.stages.analysis}`);
    if (niche.quality === 'excellent' || NC_qualityClassKey(niche) === 'excellent') parts.push('EXC');
    if (niche.quality === 'average' || niche.quality === 'medium' || NC_qualityClassKey(niche) === 'medium') parts.push('MED');
    if (NC_qualityClassKey(niche) === 'saturated') parts.push('SAT');
    const tier = NC_resolveOpportunityTier(niche);
    if (tier) parts.push(`${tier.labelAr} (${tier.labelEn})`);
    if (niche.sharia) parts.push(`شرعي: ${niche.sharia}`);

    return parts.join(' • ');
}

async function NC_openRadarAndScan(queryText, sourceMode = 'aggregator') {
    const safeText = String(queryText || '').trim();
    if (!safeText) return;
    const mode = String(sourceMode || 'aggregator').trim() || 'aggregator';

    try {
        if (typeof switchTabRef === 'function') switchTabRef('note');
        if (typeof window.NHP_ensurePanelLoaded === 'function') {
            await window.NHP_ensurePanelLoaded('note');
        }
        if (typeof initRadarModule === 'function') {
            initRadarModule({ showToast: showToastRef, switchTab: switchTabRef });
        }
        if (typeof window.NHP_initNoteImageHunt === 'function') {
            window.NHP_initNoteImageHunt();
        }
        if (typeof window.NHP_openNoteImageHunt === 'function') {
            await window.NHP_openNoteImageHunt(safeText, mode);
            showToastRef('🖼️ جاري صيد الصور في المفكرة…');
            return;
        }
        if (typeof window.NHP_openRadarImageHuntFromNote === 'function') {
            await window.NHP_openRadarImageHuntFromNote(safeText, mode);
            return;
        }
    } catch (error) {
        console.warn('NC open note image hunt failed:', error);
    }

    showToastRef('⚠️ تعذر تهيئة صيد الصور في النوت. حاول مرة أخرى.');
}

function NC_renderUnofficialTrends() {
    const container = document.getElementById('unofficial-trends-container');
    const statsEl = document.getElementById('nc-unofficial-stats');
    const panel = document.getElementById('nc-unofficial-panel');
    if (!container) return;

    const items = Array.isArray(NC_state.unofficialTrends) ? [...NC_state.unofficialTrends] : [];
    if (statsEl) statsEl.textContent = `${items.length} عنصر`;
    if (panel) panel.style.display = 'none';
    container.innerHTML = '';
    return;

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-[10px] text-white/20">لا توجد ترندات غير رسمية حالياً</div>`;
        return;
    }

    container.innerHTML = '';
    items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'nc-unofficial-card';
        const safeText = String(item.text || item.keyword || item.niche || '').trim() || '[Missing niche text]';

        const badges = [];
        if (item.label) {
            badges.push(NC_getUnofficialBadge(item.label, '#4f46e5'));
        }
        if (item.usptoStatus === 'queued') badges.push(NC_getUnofficialBadge('USPTO Queue', '#f59e0b'));
        if (item.usptoStatus === 'safe') badges.push(NC_getUnofficialBadge('USPTO Safe', '#10b981'));
        if (item.usptoStatus === 'banned') badges.push(NC_getUnofficialBadge('USPTO Blocked', '#ef4444'));
        if (item.analysisStatus === 'queued') badges.push(NC_getUnofficialBadge('TP Queue', '#60a5fa'));
        if (item.analysisStatus === 'excel') badges.push(NC_getUnofficialBadge('TP Excellent', '#10b981'));
        if (item.analysisStatus === 'med') badges.push(NC_getUnofficialBadge('TP Average', '#f59e0b'));
        if (item.analysisStatus === 'sat') badges.push(NC_getUnofficialBadge('TP Saturated', '#ef4444'));
        if (item.analysisStatus === 'emp') badges.push(NC_getUnofficialBadge('TP Empty', '#94a3b8'));
        if (item.sourceType === 'ai_fusion') badges.push(NC_getUnofficialBadge('AI Fusion', '#ec4899'));

        const contentCol = document.createElement('div');
        contentCol.className = 'nc-unofficial-content';

        const topRow = document.createElement('div');
        topRow.className = 'nc-unofficial-top';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'nc-unofficial-title';
        titleDiv.textContent = safeText;
        titleDiv.title = safeText;
        topRow.appendChild(titleDiv);

        if (Number.isFinite(item.todayScore)) {
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'nc-unofficial-score';
            scoreSpan.textContent = `Today ${item.todayScore}`;
            topRow.appendChild(scoreSpan);
        }
        contentCol.appendChild(topRow);

        const badgeRow = document.createElement('div');
        badgeRow.className = 'nc-unofficial-badges';
        badgeRow.innerHTML = badges.join('');
        contentCol.appendChild(badgeRow);

        if (item.angle) {
            const angleDiv = document.createElement('div');
            angleDiv.className = 'nc-unofficial-meta';
            angleDiv.textContent = `Angle: ${item.angle}`;
            contentCol.appendChild(angleDiv);
        }

        if (item.whyNow) {
            const whyDiv = document.createElement('div');
            whyDiv.className = 'nc-unofficial-meta';
            whyDiv.textContent = `Why now: ${item.whyNow}`;
            contentCol.appendChild(whyDiv);
        }

        if ((item.rawExamples || []).length) {
            const examplesDiv = document.createElement('div');
            examplesDiv.className = 'nc-unofficial-examples';
            examplesDiv.textContent = (item.rawExamples || []).slice(0, 2).join(' | ');
            contentCol.appendChild(examplesDiv);
        }

        const actionCol = document.createElement('div');
        actionCol.className = 'nc-unofficial-actions';
        actionCol.innerHTML = `
            <button class="interactive btn-copy-unofficial nc-action-btn px-1.5" title="نسخ">
                <i class="fa-solid fa-copy text-[9px]"></i>
            </button>
            <button class="interactive btn-preview-unofficial nc-action-btn px-1.5" title="فتح على TeePublic">
                <i class="fa-solid fa-eye text-[9px]"></i>
            </button>
            <button class="interactive btn-radar-unofficial nc-action-btn px-1.5" title="فتح في Radar" style="background:rgba(236,72,153,0.1); color:#ec4899; border:1px solid rgba(236,72,153,0.2);">
                <i class="fa-solid fa-radar text-[9px]"></i>
            </button>
        `;

        div.appendChild(contentCol);
        div.appendChild(actionCol);

        div.querySelector('.btn-copy-unofficial').addEventListener('click', (e) => {
            e.stopPropagation();
            NC_copyNicheText(item.id || safeText, safeText);
        });
        div.querySelector('.btn-preview-unofficial').addEventListener('click', (e) => {
            e.stopPropagation();
            NC_openIsolatedPopup(`https://www.teepublic.com/t-shirts?query=${encodeURIComponent(safeText)}`);
        });
        div.querySelector('.btn-radar-unofficial').addEventListener('click', (e) => {
            e.stopPropagation();
            NC_openRadarAndScan(safeText);
        });

        container.appendChild(div);
    });
}

function NC_renderHistory() {
    const container = document.getElementById('nc-history-list');
    if (!container) return;
    container.innerHTML = "";

    if (!NC_state.history || NC_state.history.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-[10px] text-white/20">لا يوجد سجل حالياً</div>`;
        return;
    }

    // Show last 10 batches
    const reversedHistory = [...NC_state.history].reverse().slice(0, 10);

    reversedHistory.forEach((batch, idx) => {
        const actualIdx = NC_state.history.length - 1 - idx;
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-2 mb-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all";
        div.innerHTML = `
            <div class="flex flex-col">
                <span style="font-size:10px; font-weight:700; color:var(--primary);">${batch.timestamp}</span>
                <span style="font-size:9px; color:var(--text-muted);">${batch.niches.length} نيش</span>
            </div>
            <div class="flex gap-2">
                <button class="interactive p-1.5 bg-white/5 rounded hover:bg-white/20 btn-download-batch" title="تحميل TXT">
                    <i class="fa-solid fa-download text-[10px] text-white"></i>
                </button>
                <button class="interactive p-1.5 bg-red-500/10 rounded hover:bg-red-500/20 btn-delete-history" title="حذف من السجل">
                    <i class="fa-solid fa-trash-can text-[10px] text-red-400"></i>
                </button>
            </div>
        `;

        div.querySelector('.btn-download-batch').addEventListener('click', () => NC_downloadBatch(actualIdx));
        div.querySelector('.btn-delete-history').addEventListener('click', () => NC_deleteHistoryItem(actualIdx));

        container.appendChild(div);
    });
}

function NC_downloadBatch(idx) {
    const batch = NC_state.history[idx];
    if (!batch) return;

    const content = batch.niches.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `niches_batch_${batch.timestamp.replace(/[:\/ ]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToastRef('📥 جاري تحميل الملف...');
}

async function NC_deleteHistoryItem(idx) {
    if (!confirm('هل تريد حذف هذه الدفعة من السجل؟')) return;
    NC_state.history.splice(idx, 1);
    await NC_saveToLocal();
    NC_renderHistory();
    showToastRef('🗑️ تم الحذف من السجل');
}

function NC_copyNicheText(id, text) {
    navigator.clipboard.writeText(text).then(() => {
        showToastRef('📋 تم النسخ: ' + text);
        const card = Array.from(document.querySelectorAll('.nc-master-card')).find((el) => el.dataset.nicheId === id || el.textContent.includes(text));
        if (card) {
            card.classList.add('nc-copy-flash');
            setTimeout(() => card.classList.remove('nc-copy-flash'), 500);
        }
    });
}

function toggleNoteCompletion(noteId) {
    const nicheIndex = NC_state.niches.findIndex(n => n.id === noteId);
    if (nicheIndex === -1) return;

    const currentState = NC_isNicheCompleted(NC_state.niches[nicheIndex]);
    const nextState = !currentState;
    NC_state.niches[nicheIndex].isCompleted = nextState;
    NC_state.niches[nicheIndex].done = nextState; // keep legacy compatibility
    const cleanLower = NC_state.niches[nicheIndex].text.trim().toLowerCase();

    if (nextState) {
        if (!NC_state.doneHistory.includes(cleanLower)) {
            NC_state.doneHistory.push(cleanLower);
        }
    } else {
        NC_state.doneHistory = NC_state.doneHistory.filter(h => h !== cleanLower);
    }

    const nicheSnap = NC_state.niches[nicheIndex];

    const filter = NC_getNotesSearchFilter();
    NC_syncNicheCardCompletionDom(noteId);
    NC_updateNotesStats(filter);
    NC_scheduleSaveToLocal();

    void (async () => {
        try {
            const idx = await recordNoteLifecycle([{
                text: nicheSnap.text,
                status: nextState ? 'done' : 'queued',
                quality: nicheSnap.quality || null
            }], 'note_toggle');
            NC_archiveIndex = idx;
        } catch (e) {
            console.warn('NC recordNoteLifecycle toggle:', e);
        }
    })();

}


function NC_toggleDone(id) {
    toggleNoteCompletion(id);
}

function NC_deleteNiche(id) {
    const removed = NC_state.niches.find(n => n.id === id);
    NC_state.niches = NC_state.niches.filter(n => n.id !== id);
    NC_ensureColumnBuckets();
    if (removed) {
        const key = removed.text.trim().toLowerCase();
        NC_state.columnBuckets.left = NC_state.columnBuckets.left.filter((e) => e.key !== key);
    } else if (String(id || '').startsWith('archived_')) {
        const key = String(id).slice('archived_'.length);
        NC_state.columnBuckets.right = NC_state.columnBuckets.right.filter((e) => e.key !== key);
    }
    const bulkTextarea = document.getElementById('bulk-text');
    if (bulkTextarea) {
        bulkTextarea.value = NC_state.niches.map(n => n.text).join('\n');
    }

    NC_scheduleSaveToLocal();
    NC_requestRenderListSoon(NC_getNotesSearchFilter());

    if (!removed) return;

    void (async () => {
        try {
            const idx = await recordNoteLifecycle([{ text: removed.text, status: 'removed', quality: removed.quality || null }], 'note_delete');
            NC_archiveIndex = idx;
        } catch (e) {
            console.warn('NC recordNoteLifecycle delete:', e);
            try {
                await NC_loadArchiveIndex();
            } catch (_) { /* ignore */ }
        }
    })();
}

async function NC_updateBulk() {
    const bulkTextarea = document.getElementById('bulk-text');
    if (!bulkTextarea) return;

    const textStr = bulkTextarea.value;
    const allLines = textStr.split('\n').map(l => l.trim()).filter(l => l);
    const lineCounts = NC_countLinesByKey(allLines);
    const previousBatchKey = NC_batchKeyFromNiches(NC_state.niches);

    const seenLocal = new Set();
    const uniqueLines = allLines.filter(line => {
        const lower = line.toLowerCase();
        if (seenLocal.has(lower)) return false;
        seenLocal.add(lower);
        return true;
    });

    NC_bumpStorageLoadGeneration();
    NC_importInFlight += 1;
    try {
        const dailyTrends = await new Promise((resolve) => {
            chrome.storage.local.get(['dailyTrends'], (data) => resolve(data.dailyTrends || []));
        });
        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(tText.trim().toLowerCase(), i + 1);
        });

        const oldNichesMap = new Map(NC_state.niches.map(n => [n.text.toLowerCase(), n]));
        const lifecycleItems = [];

        NC_state.niches = uniqueLines.map(line => {
            const lower = line.toLowerCase();
            const rank = trendRankMap.get(lower) || 999999;

            if (oldNichesMap.has(lower)) {
                const old = oldNichesMap.get(lower);
                old.rank = rank;
                return old;
            }

            const isPreviouslyDone = NC_state.doneHistory.includes(lower);
            const created = {
                id: 'nc_' + Math.random().toString(36).substr(2, 9),
                text: line,
                isCompleted: isPreviouslyDone,
                done: isPreviouslyDone,
                rank: rank,
                addedAt: new Date().toISOString()
            };
            lifecycleItems.push({
                text: created.text,
                status: isPreviouslyDone ? 'done' : 'manual',
                quality: null
            });
            return created;
        });

        NC_state.niches.sort((a, b) => (a.rank || 999999) - (b.rank || 999999));

        const nextBatchKey = NC_batchKeyFromNiches(NC_state.niches);
        if (previousBatchKey && previousBatchKey !== nextBatchKey) {
            NC_applyNewBatchToColumns(NC_state.niches, lineCounts);
        } else {
            NC_syncLeftBucketWithNiches(NC_state.niches, lineCounts);
        }

        NC_listRenderFingerprint = '';
        NC_requestRenderListSoon(NC_getNotesSearchFilter());
        showToastRef('✅ تم تحديث قائمة النيشات');

        NC_scheduleSaveToLocal();

        if (lifecycleItems.length > 0) {
            void recordNoteLifecycle(lifecycleItems, 'note_bulk')
                .then((idx) => { NC_archiveIndex = idx; })
                .catch((e) => console.warn('NC recordNoteLifecycle bulk:', e));
        }
    } finally {
        NC_importInFlight = Math.max(0, NC_importInFlight - 1);
    }
}

function NC_exportData() {
    if (NC_state.niches.length === 0 && NC_state.history.length === 0) {
        return showToastRef('⚠️ لا توجد بيانات لتصديرها');
    }
    const dataStr = JSON.stringify(NC_state, null, 2);
    const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NHP_Note_Backup_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToastRef('📤 تم تصدير نسخة احتياطية (TXT)');
}

function NC_importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        NC_bumpStorageLoadGeneration();
        NC_importInFlight += 1;
        try {
            const data = JSON.parse(event.target.result);
            if (data.niches || data.history || data.unofficialTrends) {
                NC_applyPayloadFromStorage({
                    niches: data.niches || [],
                    unofficialTrends: data.unofficialTrends || [],
                    doneHistory: data.doneHistory || [],
                    history: data.history || [],
                    columnBuckets: data.columnBuckets || null
                }, { merge: false, force: true });

                NC_listRenderFingerprint = '';
                NC_requestRenderListSoon(NC_getNotesSearchFilter());
                NC_renderUnofficialTrends();
                NC_renderHistory();
                NC_syncBulkTextareaDeferred();
                showToastRef('✅ تم استيراد النسخة الاحتياطية بنجاح');

                await NC_flushSaveToLocal();

                const lifecycleBatch = NC_state.niches.slice(0, 120).map((niche) => ({
                    text: niche.text,
                    status: NC_isNicheCompleted(niche) ? 'done' : 'manual',
                    quality: niche.quality || null
                }));
                if (lifecycleBatch.length > 0) {
                    void recordNoteLifecycle(lifecycleBatch, 'note_import')
                        .then((idx) => { NC_archiveIndex = idx; })
                        .catch((e) => console.warn('NC recordNoteLifecycle file import:', e));
                }
            } else {
                throw new Error('Invalid format');
            }
        } catch (err) {
            showToastRef('❌ فشل الاستيراد: الملف غير صالح');
        } finally {
            NC_importInFlight = Math.max(0, NC_importInFlight - 1);
            e.target.value = '';
        }
    };
    reader.readAsText(file);
}

async function NC_clearAll() {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع النيتشات في الملاحظات؟')) return;
    const removedItems = NC_state.niches.map(niche => ({ text: niche.text, status: 'removed', quality: niche.quality || null }));
    NC_state.niches = [];
    NC_state.columnBuckets = { left: [], right: [] };
    const bulkTextarea = document.getElementById('bulk-text');
    if (bulkTextarea) bulkTextarea.value = '';
    await NC_saveToLocal();
    if (removedItems.length > 0) {
        await recordNoteLifecycle(removedItems, 'note_clear');
        await NC_loadArchiveIndex();
    }
    NC_renderList();
    showToastRef('🗑️ تم إخلاء الملاحظات بالكامل');
}

function NC_mapFinalCleanItemsToNotes(items, trendRankMap) {
    const combinedRaw = [];
    for (const row of Array.isArray(items) ? items : []) {
        const text = String(row?.niche || row?.niche_display || row?.text || '').trim();
        if (!text) continue;
        const status = String(row?.analysis_status || row?.quality || '').trim().toLowerCase();
        const quality = status === 'excellent' || status === 'exc'
            ? 'excellent'
            : (status === 'saturated' || status === 'sat'
                ? 'saturated'
                : (status === 'medium' || status === 'average' || status === 'med' ? 'average' : (status || 'average')));
        const intake_source = NC_resolveIntakeSource(row);
        const pageCount = NC_extractPageCountFromRecord(row);
        // Hide niches with known pages > 15 (never invent pages).
        if (Number.isFinite(pageCount) && pageCount > NC_MAX_DISPLAY_PAGES) continue;
        if (Number.isFinite(pageCount)) {
            NC_indexPageCountKeys([
                text,
                row?.niche_key,
                row?.nicheKey,
                row?.niche,
                row?.niche_display,
            ], pageCount);
        }
        combinedRaw.push({
            text,
            quality,
            rank: trendRankMap.get(text.toLowerCase()) || 999999,
            analysis_status: status || quality,
            pageCount,
            pages: pageCount,
            intake_source,
            from_early_radar: intake_source === 'early_radar' || row?.from_early_radar === true,
            source_batch_id: row?.source_batch_id || null,
        });
    }
    const seenCombined = new Set();
    return combinedRaw.filter((item) => {
        const lower = item.text.trim().toLowerCase();
        if (seenCombined.has(lower)) return false;
        seenCombined.add(lower);
        return true;
    });
}

async function NC_applyCombinedNicheImport(combined, _options = {}) {
    const isRecheckImport = _options?.recheck === true || _options?.source === 'recheck';
    const emptyMessage = _options?.emptyMessage || '⚠️ لا توجد نيتشات للاستيراد';
    const sourceLabel = _options?.sourceLabel || 'analysis';
    const combinedRaw = Array.isArray(combined) ? combined : [];

    if (combinedRaw.length === 0) {
        showToastRef(emptyMessage);
        return { addedCount: 0, updatedCount: 0, total: 0 };
    }

    const previousActiveItems = NC_normalizeNichesArray(NC_state.niches)
        .filter((n) => String(n?.text || '').trim());
    const previousBatchKey = previousActiveItems
        .map((n) => String(n.text || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('|');
    const existingByKey = new Map(previousActiveItems.map((n) => [n.text.toLowerCase(), n]));
    let addedCount = 0;
    let updatedCount = 0;
    let archivedPrevious = false;
    const touchedItems = [];
    const requestedAt = new Date().toISOString();

    const nextItems = combinedRaw.map((item) => {
        const lower = item.text.trim().toLowerCase();
        const existingItem = existingByKey.get(lower);
        const isCompleted = NC_state.doneHistory.includes(lower);
        const preparedItem = {
            ...(existingItem || {}),
            id: existingItem?.id || ('nc_' + Math.random().toString(36).substr(2, 9)),
            text: item.text.trim(),
            isCompleted,
            done: isCompleted,
            quality: item.quality || existingItem?.quality || '',
            rank: item.rank,
            pageCount: Number.isFinite(item.pageCount) ? item.pageCount
                : (Number.isFinite(item.pages) ? item.pages
                    : (Number.isFinite(existingItem?.pageCount) ? existingItem.pageCount : null)),
            pages: Number.isFinite(item.pages) ? item.pages
                : (Number.isFinite(item.pageCount) ? item.pageCount
                    : (Number.isFinite(existingItem?.pages) ? existingItem.pages : null)),
            addedAt: existingItem?.addedAt || requestedAt,
            needsReanalysis: isRecheckImport,
            reanalysisRequestedAt: isRecheckImport ? requestedAt : null,
            previousAnalysisQuality: isRecheckImport
                ? (item.quality || existingItem?.previousAnalysisQuality || null)
                : null,
            siteAnalysisStatus: item.analysis_status || existingItem?.siteAnalysisStatus || null,
            intake_source: item.intake_source || existingItem?.intake_source || '',
            from_early_radar: item.from_early_radar === true
                || item.intake_source === 'early_radar'
                || existingItem?.from_early_radar === true,
            source_batch_id: item.source_batch_id || existingItem?.source_batch_id || null,
        };

        if (existingItem) {
            updatedCount++;
        } else {
            addedCount++;
        }

        touchedItems.push(preparedItem);
        return preparedItem;
    });

    nextItems.sort((a, b) => {
        const ia = NC_intakeSortRank(a);
        const ib = NC_intakeSortRank(b);
        if (ia !== ib) return ia - ib;
        const pa = NC_resolveNichePageCount(a);
        const pb = NC_resolveNichePageCount(b);
        const pagesA = Number.isFinite(pa) ? pa : Number.POSITIVE_INFINITY;
        const pagesB = Number.isFinite(pb) ? pb : Number.POSITIVE_INFINITY;
        if (pagesA !== pagesB) return pagesA - pagesB;
        return (a.rank || 999999) - (b.rank || 999999);
    });

    const nextBatchKey = nextItems
        .map((n) => String(n.text || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('|');

    if (!isRecheckImport && previousBatchKey && previousBatchKey !== nextBatchKey) {
        const lastHistory = Array.isArray(NC_state.history) && NC_state.history.length > 0
            ? NC_state.history[NC_state.history.length - 1]
            : null;
        const lastHistoryKey = Array.isArray(lastHistory?.niches)
            ? lastHistory.niches
                .map((text) => String(text || '').trim().toLowerCase())
                .filter(Boolean)
                .sort()
                .join('|')
            : '';

        if (lastHistoryKey !== previousBatchKey) {
            const now = new Date();
            const timestamp = now.toLocaleDateString('ar-EG') + ' ' + now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            if (!NC_state.history) NC_state.history = [];
            NC_state.history.push({
                timestamp: timestamp,
                niches: previousActiveItems.map((item) => item.text)
            });
            archivedPrevious = true;
        }
    }

    NC_state.niches = nextItems;

    const lineCounts = NC_countLinesByKey(combinedRaw.map((item) => item.text));
    if (!isRecheckImport && previousBatchKey && previousBatchKey !== nextBatchKey) {
        NC_applyNewBatchToColumns(nextItems, lineCounts);
    } else if (!isRecheckImport) {
        NC_syncLeftBucketWithNiches(nextItems, lineCounts);
    }

    if (touchedItems.length > 0) {
        NC_listRenderFingerprint = '';
        NC_requestRenderListSoon(NC_getNotesSearchFilter());
        NC_syncBulkTextareaDeferred();

        if (_options?.successMessage) {
            showToastRef(_options.successMessage(touchedItems.length, addedCount, updatedCount, archivedPrevious));
        } else if (archivedPrevious) {
            showToastRef(`✅ تم أرشفة القائمة القديمة واستيراد ${touchedItems.length} نيش جديد`);
        } else if (addedCount > 0) {
            showToastRef(`✅ تم استيراد ${addedCount} نيش جديد!`);
        } else {
            showToastRef(`✅ تم تحديث ${updatedCount} نيش لإعادة التحليل`);
        }

        await NC_flushSaveToLocal();

        const lifecycleBatch = touchedItems.map((item) => ({
            text: item.text,
            status: isRecheckImport ? 'recheck' : 'queued',
            quality: item.quality
        }));
        if (lifecycleBatch.length > 0) {
            void recordNoteLifecycle(
                lifecycleBatch,
                isRecheckImport ? 'analysis_recheck' : (sourceLabel === 'site' ? 'site_final_clean' : 'analysis_import')
            ).then((archivedIdx) => {
                NC_archiveIndex = archivedIdx;
                NC_listRenderFingerprint = '';
                NC_requestRenderListSoon(NC_getNotesSearchFilter());
            }).catch((e) => console.warn('NC recordNoteLifecycle import:', e));
        }
    } else {
        showToastRef('ℹ️ جميع النيتشات موجودة بالفعل في القائمة');
    }

    return { addedCount, updatedCount, total: touchedItems.length, archivedPrevious };
}

/** Fetch final-clean niches from EmailCore via CREATY extension token (المفتاح). */
export async function NC_fetchNichesFromSite(options = {}) {
    const auto = options?.auto === true;
    const quietMissingCreds = options?.quietMissingCreds === true || auto;
    const btn = document.getElementById('btn-fetch-site-niches');
    const statsEl = document.getElementById('nc-stats');
    if (btn?.dataset.busy === '1') return;

    if (!(await hasEmailCoreCredentials())) {
        if (quietMissingCreds) {
            if (statsEl) statsEl.title = 'أدخل مفتاح CREATY في لوحة الإدارة للمزامنة';
            return;
        }
        showToastRef('⚠️ أدخل المفتاح (Access Token) و User ID في CREATY → EmailCore ثم احفظ');
        return;
    }

    if (btn) {
        btn.dataset.busy = '1';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }
    const prevStats = statsEl?.textContent || '';
    if (statsEl) statsEl.textContent = auto ? 'مزامنة تلقائية من الموقع…' : 'جاري الجلب من الموقع…';

    NC_bumpStorageLoadGeneration();
    NC_importInFlight += 1;
    const imagesPromise = NC_refreshDesignImagesFeed({ quiet: true });
    try {
        const data = await emailcoreApiRequest('/nhp/final-clean');
        if (!data?.ok && !Array.isArray(data?.items)) {
            throw new Error(data?.error || 'استجابة غير صالحة من الموقع');
        }
        const items = Array.isArray(data.items) ? data.items : [];
        NC_ingestFinalCleanFeedItems(items);
        const dailyTrends = await new Promise((resolve) => {
            chrome.storage.local.get(['dailyTrends'], (res) => resolve(res.dailyTrends || []));
        });
        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(String(tText || '').trim().toLowerCase(), i + 1);
        });

        const combined = NC_mapFinalCleanItemsToNotes(items, trendRankMap);
        const result = await NC_applyCombinedNicheImport(combined, {
            source: 'site',
            sourceLabel: 'site',
            emptyMessage: auto
                ? 'ℹ️ لا توجد نيتشات نشطة على الموقع حالياً'
                : '⚠️ لا توجد نيتشات نظيفة (ممتازة/متوسطة) على الموقع حالياً',
            successMessage: (total, added, updated, archived) => {
                const prefix = auto ? 'مزامنة' : 'جلب';
                if (archived) return `✅ ${prefix} ${total} نيش من الموقع (أُرشفت القائمة السابقة)`;
                if (added > 0) return `✅ ${prefix} ${total} نيش من الموقع (${added} جديد)`;
                return `✅ تم تحديث ${updated || total} نيش من الموقع`;
            },
        });
        if (statsEl && result.total > 0) {
            statsEl.title = `آخر جلب من الموقع: ${result.total} نيش`;
        }
    } catch (err) {
        const msg = String(err?.message || err || 'فشل الجلب');
        showToastRef(`❌ فشل جلب النيتشات: ${msg}`);
        if (statsEl) statsEl.textContent = prevStats || statsEl.textContent;
        console.warn('NC_fetchNichesFromSite:', err);
    } finally {
        try {
            const imagesResult = await imagesPromise;
            if (imagesResult?.updated) {
                NC_listRenderFingerprint = '';
                NC_requestRenderListSoon(NC_getNotesSearchFilter());
            }
        } catch (_) { /* refresh already logs */ }
        NC_importInFlight = Math.max(0, NC_importInFlight - 1);
        if (btn) {
            btn.dataset.busy = '0';
            btn.disabled = false;
            btn.style.opacity = '';
        }
    }
}

/** Auto-run CREATY final-clean once per Notes/extension open (debounced). */
async function NC_maybeAutoFetchSiteNiches() {
    if (NC_creatyAutoFetchInFlight) return;
    try {
        const store = typeof chrome?.storage?.session !== 'undefined'
            ? chrome.storage.session
            : chrome.storage.local;
        const stored = await new Promise((resolve) => {
            store.get([NC_CREATY_AUTO_FETCH_AT_KEY], (res) => resolve(res || {}));
        });
        const lastAt = Number(stored[NC_CREATY_AUTO_FETCH_AT_KEY] || 0) || 0;
        if (Date.now() - lastAt < NC_CREATY_AUTO_FETCH_DEBOUNCE_MS) return;

        NC_creatyAutoFetchInFlight = true;
        await new Promise((resolve) => {
            store.set({ [NC_CREATY_AUTO_FETCH_AT_KEY]: Date.now() }, () => resolve());
        });
        await NC_fetchNichesFromSite({ auto: true, quietMissingCreds: true });
    } catch (err) {
        console.warn('NC_maybeAutoFetchSiteNiches:', err);
    } finally {
        NC_creatyAutoFetchInFlight = false;
    }
}

export async function NC_importFromAnalysis(_options = {}) {
    NC_bumpStorageLoadGeneration();
    NC_importInFlight += 1;
    try {
        const data = await new Promise((resolve) => {
            chrome.storage.local.get(['tpExcel', 'tpMed', 'tpSat', 'dailyTrends', 'tpPageCounts'], resolve);
        });
        const isRecheckImport = _options?.recheck === true || _options?.source === 'recheck';
        const excel = data.tpExcel || [];
        const med = data.tpMed || [];
        const sat = data.tpSat || [];
        const dailyTrends = data.dailyTrends || [];
        NC_ingestTpPageCountsMap(data.tpPageCounts);

        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(tText.trim().toLowerCase(), i + 1);
        });

        const resolveImportPages = (nicheText) => {
            const key = NC_normalizeNicheKey(nicheText);
            const fromIndex = key ? NC_pageCountByKey.get(key) : null;
            return Number.isFinite(fromIndex) && fromIndex >= 0 ? fromIndex : null;
        };

        const mapBucket = (list, quality) => (Array.isArray(list) ? list : []).map((n) => {
            const text = String(n || '').trim();
            const pageCount = resolveImportPages(text);
            return {
                text,
                quality,
                rank: trendRankMap.get(text.toLowerCase()) || 999999,
                pageCount,
                pages: pageCount,
            };
        }).filter((item) => {
            if (!item.text) return false;
            // Same Notes rule as site final-clean: hide known pages > 15.
            if (Number.isFinite(item.pageCount) && item.pageCount > NC_MAX_DISPLAY_PAGES) return false;
            return true;
        });

        const combinedRaw = [
            ...mapBucket(excel, 'excellent'),
            ...mapBucket(med, 'average'),
            ...mapBucket(sat, 'saturated'),
        ];
        const seenCombined = new Set();
        const combined = combinedRaw.filter(item => {
            const lower = item.text.trim().toLowerCase();
            if (seenCombined.has(lower)) return false;
            seenCombined.add(lower);
            return true;
        });

        if (combined.length === 0) {
            showToastRef('⚠️ لا توجد نيتشات في قسم التحليل (ممتازة أو متوسطة)');
            return;
        }

        await NC_applyCombinedNicheImport(combined, {
            recheck: isRecheckImport,
            source: isRecheckImport ? 'recheck' : 'analysis',
            sourceLabel: 'analysis',
            emptyMessage: '⚠️ لا توجد نيتشات في قسم التحليل (ممتازة أو متوسطة)',
        });
    } finally {
        NC_importInFlight = Math.max(0, NC_importInFlight - 1);
    }
}

/**
 * AI Sharia Ruling Function — neon dot + chrome.storage cache by niche name
 */
async function NC_getShariaRuling(nicheObj) {
    if (!nicheObj || nicheObj._shariaInFlight) return;
    nicheObj._shariaInFlight = true;

    const dotEl = document.getElementById(`sharia-dot-${nicheObj.id}`);
    const cacheKey = NC_normalizeNicheKey(nicheObj.text);

    const resolveNicheIndex = () => {
        const byId = NC_state.niches.findIndex((n) => n.id === nicheObj.id);
        if (byId !== -1) return byId;
        const k = NC_normalizeNicheKey(nicheObj.text);
        return NC_state.niches.findIndex((n) => NC_normalizeNicheKey(n.text) === k);
    };

    const patchStateAndPersist = (rulingClass, reasonText) => {
        const idx = resolveNicheIndex();
        if (idx === -1) return;
        NC_state.niches[idx].shariaRuling = rulingClass;
        if (rulingClass !== 'unknown') {
            NC_state.niches[idx].sharia = NC_arabicLabelForClass(rulingClass);
        }
        NC_state.niches[idx].shariaReason = reasonText || '';
        if (rulingClass !== 'unknown') {
            void NC_writeShariaCacheEntry(cacheKey, { ruling: rulingClass, reason: reasonText || '' });
        }
        NC_scheduleSaveToLocal();
        const nicheRef = NC_state.niches[idx];
        const liveDot = document.getElementById(`sharia-dot-${nicheRef.id}`) || dotEl;
        if (liveDot) NC_syncDotElementFromNiche(liveDot, nicheRef);
    };

    try {
        const cachedAll = await NC_readShariaCache();
        const cached = cachedAll[cacheKey];
        if (cached?.ruling && cached.ruling !== 'unknown') {
            patchStateAndPersist(cached.ruling, cached.reason || '');
            return;
        }

        const loadingDot = document.getElementById(`sharia-dot-${nicheObj.id}`) || dotEl;
        if (loadingDot) {
            loadingDot.className = 'nc-action-btn action-btn nc-sharia-btn nc-sharia-neon--loading';
            loadingDot.title = 'جاري تحليل مدى ملاءمة العمل في هذا النيتش (ذكاء اصطناعي)…';
            loadingDot.setAttribute('aria-label', loadingDot.title);
        }

        if (!window.AICentralBrain) {
            patchStateAndPersist(
                'unknown',
                'محرك الذكاء الاصطناعي غير متاح في هذه الصفحة.'
            );
            return;
        }

        let ruling = '';
        let lastErr = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                if (attempt > 0) await new Promise((r) => setTimeout(r, 1800));
                ruling = await window.AICentralBrain.getIslamicRuling(nicheObj.text);
                if (ruling && String(ruling).trim()) break;
                ruling = '';
            } catch (e) {
                lastErr = e;
                ruling = '';
                if (NC_isAiQuotaOrAccessError(e)) break;
            }
        }

        if (!ruling || !String(ruling).trim()) {
            const waitMs = NC_aiRetryWaitMs();
            const detail =
                waitMs > 0
                    ? `تم إيقاف تحليل الذكاء مؤقتاً بسبب حد Gemini API. أعد المحاولة بعد ${Math.ceil(waitMs / 1000)} ثانية.`
                    :
                (lastErr && (lastErr.message || String(lastErr))) ||
                'لم يُرجع النموذج نصاً صالحاً (محظور أو فارغ). انقر يميناً على النقطة لإعادة المحاولة.';
            patchStateAndPersist('unknown', detail);
            return;
        }

        const rulingClass = NC_classifyShariaFromText(ruling);
        const reasonText =
            rulingClass === 'unknown'
                ? `${ruling}\n\nلم يُستخرج حكم صريح [حلال]/[حرام]/[شبهة] من النص. انقر يميناً لإعادة المحاولة.`
                : ruling;
        patchStateAndPersist(rulingClass, reasonText);
    } catch (err) {
        console.warn('NC_getShariaRuling:', err);
        const msg = String(err?.message || err || 'خطأ غير معروف.');
        try {
            patchStateAndPersist(
                'unknown',
                `${msg} — انقر يميناً على النقطة لإعادة المحاولة.`
            );
        } catch (_) {
            const liveDot = document.getElementById(`sharia-dot-${nicheObj.id}`) || dotEl;
            if (liveDot) {
                liveDot.className = 'nc-action-btn action-btn nc-sharia-btn nc-sharia-neon--unknown';
                liveDot.title = msg;
                liveDot.setAttribute('aria-label', msg);
            }
        }
    } finally {
        nicheObj._shariaInFlight = false;
        nicheObj._shariaJobScheduled = false;
        nicheObj._shariaAutoFetchDone = true;
    }
}

function NC_initCompactDashboardUI() {
    const panel = document.getElementById('panel-note');
    if (!panel || panel.dataset.ncCompactReady === '1') return;

    const root = panel.querySelector('.glass-card');
    const searchInput = document.getElementById('nc-search');
    const statsEl = document.getElementById('nc-stats');
    const importAnalysisBtn = document.getElementById('btn-import-analysis');
    const fetchSiteNichesBtn = document.getElementById('btn-fetch-site-niches');
    const exportNoteBtn = document.getElementById('btn-export-note');
    const importNoteBtn = document.getElementById('btn-import-note');
    const clearNoteBtn = document.getElementById('btn-clear-note');
    const manualTextarea = document.getElementById('bulk-text');
    const manualUpdateBtn = document.getElementById('nc-update-bulk');
    const historyList = document.getElementById('nc-history-list');
    if (!root || !searchInput || !statsEl || !importAnalysisBtn || !exportNoteBtn || !importNoteBtn || !clearNoteBtn || !manualTextarea || !manualUpdateBtn || !historyList) {
        return;
    }

    root.classList.add('notes-root');

    const toolbar = document.createElement('div');
    toolbar.className = 'notes-toolbar';
    toolbar.innerHTML = `
        <h2 class="notes-title">نوتة المهام</h2>
        <div class="notes-search-shell" id="nc-search-shell">
            <button type="button" id="nc-search-toggle" class="notes-icon-btn" title="بحث">
                <i class="fa-solid fa-magnifying-glass"></i>
            </button>
        </div>
        <div class="notes-actions" id="nc-notes-actions"></div>
        <div class="notes-popover" id="nc-manual-popover"></div>
        <div class="notes-popover" id="nc-history-popover"></div>
    `;

    const titleRow = root.querySelector(':scope > div');
    if (titleRow && titleRow.parentNode === root) {
        root.insertBefore(toolbar, titleRow);
        titleRow.classList.add('notes-bottom-collapsed');
    } else {
        root.insertBefore(toolbar, root.firstChild);
    }

    const notesActions = toolbar.querySelector('#nc-notes-actions');
    const searchShell = toolbar.querySelector('#nc-search-shell');
    const manualPopover = toolbar.querySelector('#nc-manual-popover');
    const historyPopover = toolbar.querySelector('#nc-history-popover');
    if (!notesActions || !searchShell || !manualPopover || !historyPopover) return;

    const masterSearchShell = document.getElementById('nc-master-search-shell');
    if (masterSearchShell) {
        if (searchInput.parentElement !== masterSearchShell) {
            masterSearchShell.appendChild(searchInput);
        }
    } else {
        searchShell.appendChild(searchInput);
    }
    toolbar.insertBefore(statsEl, searchShell);
    if (!document.getElementById('nc-tier-legend')) {
        const legend = document.createElement('div');
        legend.id = 'nc-tier-legend';
        legend.className = 'nc-tier-legend';
        legend.title = [
            'ذهبي Golden: ممتاز + ترند #1–20',
            'فضي Silver: ممتاز + #21–50 أو متوسط + #1–20',
            'برونزي Bronze: متوسط + #21–50 أو ممتاز + #51+',
            'مشبع: ≥7 صفحات (ليس ذهبياً)',
            'الألوان: ممتاز أخضر · متوسط برتقالي · مشبع أحمر',
        ].join('\n');
        legend.innerHTML = `
            <span class="nc-tier-legend__item nc-tier-legend__item--gold">ذهبي=#1–20+ممتاز</span>
            <span class="nc-tier-legend__item nc-tier-legend__item--silver">فضي</span>
            <span class="nc-tier-legend__item nc-tier-legend__item--exc">ممتاز</span>
            <span class="nc-tier-legend__item nc-tier-legend__item--med">متوسط</span>
            <span class="nc-tier-legend__item nc-tier-legend__item--sat">مشبع</span>
        `;
        toolbar.insertBefore(legend, searchShell);
    }
    const legacySearchRow = searchInput.parentElement;
    if (legacySearchRow && legacySearchRow !== searchShell && legacySearchRow.id !== 'nc-master-search-shell') {
        legacySearchRow.classList.add('notes-bottom-collapsed');
    }

    notesActions.append(...[
        fetchSiteNichesBtn,
        importAnalysisBtn,
        exportNoteBtn,
        importNoteBtn,
        clearNoteBtn
    ].filter(Boolean));
    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.id = 'nc-toggle-manual';
    plusBtn.className = 'notes-icon-btn';
    plusBtn.title = 'إضافة يدوية';
    plusBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';

    const historyBtn = document.createElement('button');
    historyBtn.type = 'button';
    historyBtn.id = 'nc-toggle-history';
    historyBtn.className = 'notes-icon-btn';
    historyBtn.title = 'السجل';
    historyBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>';
    const aiPhraseBtn = document.createElement('button');
    aiPhraseBtn.type = 'button';
    aiPhraseBtn.id = 'nc-edit-ai-designs-template';
    aiPhraseBtn.className = 'notes-icon-btn';
    aiPhraseBtn.title = 'تعديل عبارة Google AI Mode';
    aiPhraseBtn.innerHTML = '<i class="fa-solid fa-quote-right"></i>';
    notesActions.append(plusBtn, historyBtn, aiPhraseBtn);

    const manualWrap = document.createElement('div');
    manualWrap.innerHTML = `
        <div class="field-label" style="margin-bottom:6px; font-size:10px;">مربع الإضافة اليدوية</div>
        <div id="nc-manual-tools" style="display:flex; flex-direction:column; gap:6px;"></div>
    `;
    const manualTools = manualWrap.querySelector('#nc-manual-tools');
    if (manualTools) {
        manualTools.append(manualTextarea, manualUpdateBtn);
    }
    manualPopover.appendChild(manualWrap);

    const historyWrap = document.createElement('div');
    historyWrap.innerHTML = '<div class="field-label" style="margin-bottom:6px; font-size:10px;">السجل التاريخي</div>';
    historyWrap.appendChild(historyList);
    historyPopover.appendChild(historyWrap);

    const oldBottomBlock = root.querySelector(':scope > div.mt-4.pt-3.border-t.border-white\\/10');
    if (oldBottomBlock) {
        oldBottomBlock.classList.add('notes-bottom-collapsed');
    }

    const closePopovers = () => {
        manualPopover.classList.remove('is-open');
        historyPopover.classList.remove('is-open');
    };

    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = !manualPopover.classList.contains('is-open');
        closePopovers();
        if (opening) manualPopover.classList.add('is-open');
    });

    historyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = !historyPopover.classList.contains('is-open');
        closePopovers();
        if (opening) historyPopover.classList.add('is-open');
    });

    aiPhraseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopovers();
        const nextTemplate = prompt(
            'عدّل عبارة البحث. استخدم {niche} مكان عنوان النيتش.',
            NC_googleAiDesignsTemplate || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE
        );
        if (nextTemplate === null) return;
        const clean = String(nextTemplate || '').trim() || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE;
        NC_googleAiDesignsTemplate = clean;
        chrome.storage.local.set({ [NC_GOOGLE_AI_DESIGNS_TEMPLATE_KEY]: clean }, () => {
            showToastRef('✅ تم تحديث عبارة Google AI Mode');
        });
    });

    toolbar.querySelector('#nc-search-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (masterSearchShell?.contains(searchInput)) {
            searchInput.focus();
            searchInput.select?.();
            return;
        }
        searchShell.classList.toggle('notes-search-open');
        if (searchShell.classList.contains('notes-search-open')) searchInput.focus();
    });

    document.addEventListener('click', (e) => {
        if (!toolbar.contains(e.target)) closePopovers();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePopovers();
            searchShell.classList.remove('notes-search-open');
        }
    });

    NC_fixNoteMasterDetailLayout();

    panel.dataset.ncCompactReady = '1';
}

let isInitialized = false;

export async function activateNotePanel() {
    if (!document.getElementById('niche-container')) return;
    NC_fixNoteMasterDetailLayout();
    if (typeof window.NHP_refreshRadarImageHuntRefs === 'function') {
        window.NHP_refreshRadarImageHuntRefs('note');
    }
    if (NC_importInFlight > 0) {
        NC_listRenderFingerprint = '';
        NC_requestRenderListSoon(NC_getNotesSearchFilter());
        return;
    }
    await NC_refreshFromStorageIfNewer();
    NC_listRenderFingerprint = '';
    NC_requestRenderListSoon(NC_getNotesSearchFilter());
    if (document.getElementById('unofficial-trends-container')) {
        NC_renderUnofficialTrends();
    }
    NC_renderHistory();
    if (shariaQueue.length > 0 && !isProcessingSharia) {
        processShariaQueue();
    }
    void NC_maybeAutoFetchSiteNiches();
}

async function runNoteModuleInit(helpers) {
    if (helpers) {
        showToastRef = helpers.showToast;
        switchTabRef = helpers.switchTab;
    }

    // Quiet init — avoid console spam on every Notes open.

    if (!noteModuleBootstrapped) {
        noteModuleBootstrapped = true;
        await NC_loadFromLocal();
    } else {
        await NC_refreshFromStorageIfNewer();
    }
    await Promise.all([
        NC_hydrateShariaFromCache(),
        NC_loadArchiveIndex(),
        NC_loadTrendRanks(),
        NC_loadGoogleAiDesignsTemplate(),
        NC_loadDesignImagesFeedFromStorage(),
        NC_loadPageCountIndex(),
    ]);
    if (NC_backfillNichePageCounts()) {
        NC_scheduleSaveToLocal();
    }
    NC_attachVisibilityFlush();

    chrome.storage.local.get(['dailyTrends'], async (data) => {
        const dailyTrends = data.dailyTrends || [];
        const trendRankMap = new Map();
        dailyTrends.forEach((t, i) => {
            const tText = typeof t === 'string' ? t : (t.text || t.title || '');
            trendRankMap.set(tText.trim().toLowerCase(), i + 1);
        });

        let changed = false;
        NC_state.niches.forEach(n => {
            const currentRank = trendRankMap.get(n.text.trim().toLowerCase()) || 999999;
            if (n.rank !== currentRank) {
                n.rank = currentRank;
                changed = true;
            }
        });

        NC_state.niches.sort((a, b) => (a.rank || 999999) - (b.rank || 999999));
        
        if (changed) {
            await NC_saveToLocal();
        }

        NC_initCompactDashboardUI();
        try {
            initRadarModule({ showToast: showToastRef, switchTab: switchTabRef });
            window.NHP_initNoteImageHunt?.();
        } catch (err) {
            console.warn('NC note image hunt init failed:', err);
        }

        if (!isInitialized) {
            const searchInput = document.getElementById('nc-search');
            if (searchInput) {
                searchInput.oninput = () => {
                    NC_listRenderFingerprint = '';
                    NC_listRenderCoalesce.filter = NC_getNotesSearchFilter();
                    clearTimeout(NC_searchDebounceTimer);
                    const delay = (window.NHP_IS_LIGHT_MODE || window.NHP_LOW_SPEC_MODE) ? 400 : 280;
                    NC_searchDebounceTimer = setTimeout(() => {
                        NC_requestRenderListSoon(NC_listRenderCoalesce.filter);
                    }, delay);
                };
            }

            const bulkUpdateBtn = document.getElementById('nc-update-bulk');
            if (bulkUpdateBtn) {
                bulkUpdateBtn.onclick = NC_updateBulk;
            }

        const importAnalysisBtn = document.getElementById('btn-import-analysis');
        if (importAnalysisBtn) {
            importAnalysisBtn.onclick = NC_importFromAnalysis;
        }

        const fetchSiteNichesBtn = document.getElementById('btn-fetch-site-niches');
        if (fetchSiteNichesBtn) {
            fetchSiteNichesBtn.onclick = () => { void NC_fetchNichesFromSite(); };
        }

        const clearNoteBtn = document.getElementById('btn-clear-note');
        if (clearNoteBtn) {
            clearNoteBtn.onclick = NC_clearAll;
        }

        const exportNoteBtn = document.getElementById('btn-export-note');
        if (exportNoteBtn) {
            exportNoteBtn.onclick = NC_exportData;
        }

        const importNoteBtn = document.getElementById('btn-import-note');
        const importNoteInput = document.getElementById('nc-import-input');
        if (importNoteBtn && importNoteInput) {
            importNoteBtn.onclick = () => importNoteInput.click();
            importNoteInput.onchange = NC_importData;
        }

        if (!archiveStorageListenerAttached) {
            archiveStorageListenerAttached = true;
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local') return;
                if (changes.nhp_niche_archive_index) {
                    NC_archiveIndex = changes.nhp_niche_archive_index.newValue || { niches: {} };
                    NC_scheduleStorageDriveRender({ list: true, unofficial: false });
                }
                if (changes.dailyTrends) {
                    NC_dailyTrends = Array.isArray(changes.dailyTrends.newValue) ? changes.dailyTrends.newValue : [];
                    NC_trendRankIndex = null;
                    NC_scheduleStorageDriveRender({ list: true, unofficial: false });
                }
                if (changes[NC_DESIGN_IMAGES_FEED_KEY]) {
                    const feed = changes[NC_DESIGN_IMAGES_FEED_KEY].newValue;
                    if (feed && typeof feed === 'object') {
                        NC_applyDesignImagesFeed(feed);
                        if (NC_backfillNichePageCounts()) NC_scheduleSaveToLocal();
                        NC_scheduleStorageDriveRender({ list: true, unofficial: false });
                    } else {
                        // Cache clear only — left hunt pane stays until user clicks «الموقع» or صيد.
                        NC_designImagesByKey = new Map();
                    }
                }
                if (changes.tpPageCounts) {
                    NC_ingestTpPageCountsMap(changes.tpPageCounts.newValue);
                    if (NC_backfillNichePageCounts()) NC_scheduleSaveToLocal();
                    NC_scheduleStorageDriveRender({ list: true, unofficial: false });
                }
                if (changes.nhpFinalCleanFeed) {
                    const items = changes.nhpFinalCleanFeed.newValue?.items;
                    if (Array.isArray(items)) {
                        NC_ingestFinalCleanFeedItems(items);
                        if (NC_backfillNichePageCounts()) NC_scheduleSaveToLocal();
                        NC_scheduleStorageDriveRender({ list: true, unofficial: false });
                    }
                }
                if (changes.teepublic_manager_data && !NC_suppressTeepublicStorageListener) {
                    const nextData = changes.teepublic_manager_data.newValue;
                    if (!nextData || typeof nextData !== 'object') return;
                    if (NC_applyPayloadFromStorage(nextData, { merge: true })) {
                        NC_listRenderFingerprint = '';
                        NC_scheduleStorageDriveRender({ list: true, unofficial: true });
                    }
                }
            });
        }
        isInitialized = true;
    }

    NC_syncBulkTextareaDeferred();

    NC_renderList();
    NC_renderUnofficialTrends();
    NC_renderHistory();

    // If analysis finished while Note wasn't loaded, consume pending auto-import now.
    chrome.storage.local.get(['tpPendingAutoImportSignature', 'tpLastAutoImportSignature'], async (res) => {
        const pendingSignature = String(res?.tpPendingAutoImportSignature || '').trim();
        const lastSignature = String(res?.tpLastAutoImportSignature || '').trim();
        if (!pendingSignature || pendingSignature === lastSignature) return;

        try {
            await NC_importFromAnalysis({ source: 'pending', signature: pendingSignature });
            chrome.storage.local.set({
                tpLastAutoImportSignature: pendingSignature,
                tpPendingAutoImportSignature: null
            });
        } catch (error) {
            console.warn('Note pending auto-import failed:', error);
        }
    });

    chrome.storage.local.get(['tpRecheckNoteRequest'], async (res) => {
        const request = res?.tpRecheckNoteRequest;
        if (!request || !Array.isArray(request.niches) || !request.niches.length) return;
        try {
            await NC_importFromAnalysis({ source: 'recheck', recheck: true });
            chrome.storage.local.set({ tpRecheckNoteRequest: null });
        } catch (error) {
            console.warn('Note pending recheck import failed:', error);
        }
    });

    // Auto CREATY pull once when Notes boots (debounced across reopen spam).
    void NC_maybeAutoFetchSiteNiches();
    });
}

export const initNoteModule = async (helpers) => {
    if (noteInitInFlight) return noteInitInFlight;
    noteInitInFlight = runNoteModuleInit(helpers).finally(() => {
        noteInitInFlight = null;
    });
    return noteInitInFlight;
};

// Expose to window for legacy sync calls (NC_INIT)
window.NC_INIT = initNoteModule;
window.NHP_activateNotePanel = activateNotePanel;
window.NC_importFromAnalysis = NC_importFromAnalysis;
window.NC_fetchNichesFromSite = NC_fetchNichesFromSite;
import {
    formatArchiveDate,
    getArchiveIndexFromStorage,
    getArchiveRecord,
    getPriorityMeta,
    recordNoteLifecycle
} from '../niche-archive.js';
import {
    buildGoogleAiDesignsQuery,
    buildGoogleAiModeUrl,
    buildGoogleImagesRecentUrl,
    buildPinterestSearchUrl,
    buildTeepublicSearchUrl
} from '../radar/radar-search-urls.js';
