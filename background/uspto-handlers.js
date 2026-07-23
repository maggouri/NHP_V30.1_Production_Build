/**
 * USPTO fast-scan worker helpers (background service worker).
 * Relies on globals defined in background.js (getStorage, normalizeNicheKey, etc.) at call time.
 */
(function (global) {
    'use strict';

    global.USPTO_FAST_WORKERS_MAX = 10;
    global.USPTO_FAST_TAB_READY_TIMEOUT_MS = 25000;
    global.USPTO_FAST_WORKER_TARGET_KEY = 'usptoFastWorkerTarget';
    global.USPTO_FAST_WORKER_ACTIVE_KEY = 'usptoFastWorkerActive';
    global.USPTO_RUN_MODE_KEY = 'usptoRunMode';
    global.USPTO_RUN_MODE_SILENT = 'silent-fast';
    global.USPTO_RUN_MODE_VISIBLE = 'strict-visible';
    global.usptoFastActiveWorkers = new Map();
    global.usptoFastClaimLock = Promise.resolve();
    global.USPTO_FAST_PROXY_POOL = [
        '31.59.20.176:6754:vzkrukrl:7pbfm71autef',
        '23.95.150.145:6114:vzkrukrl:7pbfm71autef',
        '198.23.239.134:6540:vzkrukrl:7pbfm71autef',
        '45.38.107.97:6014:vzkrukrl:7pbfm71autef',
        '107.172.163.27:6543:vzkrukrl:7pbfm71autef',
        '198.105.121.200:6462:vzkrukrl:7pbfm71autef',
        '216.10.27.159:6837:vzkrukrl:7pbfm71autef',
        '142.111.67.146:5611:vzkrukrl:7pbfm71autef',
        '191.96.254.138:6185:vzkrukrl:7pbfm71autef',
        '31.58.9.4:6077:vzkrukrl:7pbfm71autef'
    ];

    global.getUSPTOFastProxyPool = async function getUSPTOFastProxyPool() {
        const data = await global.getStorage(['ap_accounts_teepublic', 'ap_accounts', 'ap_proxy_pool']);
        const accountPool = [...(data.ap_accounts_teepublic || data.ap_accounts || [])]
            .map((acc) => String(acc?.proxy || '').trim())
            .filter(Boolean);
        const storedPool = String(data.ap_proxy_pool || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const merged = [...global.USPTO_FAST_PROXY_POOL, ...accountPool, ...storedPool];
        return [...new Set(merged)];
    };

    global.removePendingNicheByValue = function removePendingNicheByValue(pendingList, niche) {
        const pending = Array.isArray(pendingList) ? [...pendingList] : [];
        const idx = pending.findIndex((item) => global.normalizeNicheKey(item) === global.normalizeNicheKey(niche));
        if (idx >= 0) pending.splice(idx, 1);
        return pending;
    };

    global.finalizeUSPTOFastItem = async function finalizeUSPTOFastItem(niche, status) {
        const cacheKey = global.NHP_NICHE_CACHE_STORAGE_KEY || 'nhp_niche_cache';
        const data = await global.getStorage(['uPending', 'uSafe', 'uBanned', 'uErrors', 'uTotal', 'usptoHistory', cacheKey]);
        const pending = global.removePendingNicheByValue(data.uPending || [], niche);
        const safe = [...(data.uSafe || [])];
        const banned = [...(data.uBanned || [])];
        const errors = [...(data.uErrors || [])];
        const nicheKey = global.normalizeNicheKey(niche);
        let cache = global.sanitizeNicheCacheMap(data[cacheKey] || {});

        if (status === 'safe') {
            safe.push(niche);
            if (nicheKey) cache = global.upsertNicheCacheUspto(cache, nicheKey, 'safe');
        } else if (status === 'banned') {
            banned.push(niche);
            if (nicheKey) cache = global.upsertNicheCacheUspto(cache, nicheKey, 'banned');
        } else {
            errors.push(niche);
        }

        const legacy = global.syncNicheCacheToLegacyMaps(cache);
        await global.removeUsptoInFlightNiche(niche);
        await global.setStorage({
            uPending: pending,
            uSafe: safe,
            uBanned: banned,
            uErrors: errors,
            uCurrent: null,
            usptoHistory: legacy.usptoHistory,
            [cacheKey]: cache,
        });
        await global.persistPersistentNicheMemory('uspto');
        await global.persistUsptoBatchSnapshot('uspto_finalize');
        if (status === 'safe' || status === 'banned') {
            await global.recordArchiveStage([{ text: niche, status }], 'uspto', 'uspto_stage');
        }
    };

    global.requeueUSPTOFastItem = async function requeueUSPTOFastItem(niche) {
        const cleanNiche = String(niche || '').trim();
        if (!cleanNiche) return;
        const data = await global.getStorage(['uPending', 'uSafe', 'uBanned']);
        const pending = Array.isArray(data.uPending) ? [...data.uPending] : [];
        const done = [...(data.uSafe || []), ...(data.uBanned || [])]
            .map((item) => global.normalizeNicheKey(item));
        const key = global.normalizeNicheKey(cleanNiche);
        if (!key || done.includes(key) || pending.some((item) => global.normalizeNicheKey(item) === key)) return;
        await global.removeUsptoInFlightNiche(cleanNiche);
        await global.setStorage({ uPending: [cleanNiche, ...pending], uCurrent: null });
        await global.persistUsptoBatchSnapshot('uspto_requeue');
    };

    global.updateUSPTOFastActiveCount = async function updateUSPTOFastActiveCount() {
        await global.setStorage({ [global.USPTO_FAST_WORKER_ACTIVE_KEY]: global.usptoFastActiveWorkers.size });
    };

    global.normalizeUSPTOFastWorkerTarget = function normalizeUSPTOFastWorkerTarget(value, fallback = 4) {
        const numeric = parseInt(value, 10);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(1, Math.min(global.USPTO_FAST_WORKERS_MAX, numeric));
    };

    global.getUSPTOFastWorkerTarget = async function getUSPTOFastWorkerTarget() {
        const data = await global.getStorage([global.USPTO_FAST_WORKER_TARGET_KEY]);
        return global.normalizeUSPTOFastWorkerTarget(data[global.USPTO_FAST_WORKER_TARGET_KEY], 4);
    };

    global.normalizeUSPTORunMode = function normalizeUSPTORunMode(value) {
        return value === global.USPTO_RUN_MODE_VISIBLE ? global.USPTO_RUN_MODE_VISIBLE : global.USPTO_RUN_MODE_SILENT;
    };

    global.getUSPTORunMode = async function getUSPTORunMode() {
        const data = await global.getStorage([global.USPTO_RUN_MODE_KEY]);
        return global.normalizeUSPTORunMode(data[global.USPTO_RUN_MODE_KEY]);
    };

    global.createUSPTOEngineTarget = async function createUSPTOEngineTarget(workerIndex = 0) {
        const mode = await global.getUSPTORunMode();
        const url = 'https://tmsearch.uspto.gov/search/search-information';
        if (mode === global.USPTO_RUN_MODE_VISIBLE) {
            return new Promise((resolve) => {
                chrome.windows.create({
                    url,
                    type: 'popup',
                    focused: false,
                    width: 900,
                    height: 760,
                    left: 80 + (workerIndex * 24),
                    top: 80 + (workerIndex * 24)
                }, (win) => {
                    const tab = win?.tabs?.[0];
                    if (!win?.id || !tab?.id) {
                        resolve(null);
                        return;
                    }
                    resolve({ windowId: win.id, tabId: tab.id, mode });
                });
            });
        }

        return new Promise((resolve) => {
            chrome.tabs.create({ url, active: false }, (tab) => {
                if (!tab || !tab.id) {
                    resolve(null);
                    return;
                }
                resolve({ windowId: null, tabId: tab.id, mode });
            });
        });
    };

    global.closeUSPTOEngineTarget = async function closeUSPTOEngineTarget(engineData) {
        if (!engineData) return;
        try {
            if (engineData.windowId) {
                await chrome.windows.remove(engineData.windowId);
                return;
            }
        } catch (_) { }
        try {
            if (engineData.tabId) await chrome.tabs.remove(engineData.tabId);
        } catch (_) { }
    };

    global.getNextUSPTOFastWorkerSlot = function getNextUSPTOFastWorkerSlot() {
        for (let idx = 0; idx < global.USPTO_FAST_WORKERS_MAX; idx += 1) {
            if (!global.usptoFastActiveWorkers.has(idx)) return idx;
        }
        return -1;
    };

    global.closeLingeringUSPTOFastTabs = async function closeLingeringUSPTOFastTabs() {
        try {
            const tabs = await chrome.tabs.query({ url: 'https://tmsearch.uspto.gov/*' });
            const ids = tabs.map((t) => t.id).filter(Boolean);
            if (ids.length) {
                await chrome.tabs.remove(ids).catch(() => { });
            }
        } catch (_) { }
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
