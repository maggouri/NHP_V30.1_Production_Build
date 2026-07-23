/**
 * Per-niche USPTO / classification memory with TTL (chrome.storage.local).
 * Safe + excellent/medium → 48h; banned + saturated → 72h (3 days).
 */
(function (global) {
    'use strict';

    const HOUR_MS = 60 * 60 * 1000;
    const DAY_MS = 24 * HOUR_MS;

    global.NHP_NICHE_CACHE_STORAGE_KEY = 'nhp_niche_cache';
    global.SAFE_CLASS_TTL_MS = 48 * HOUR_MS;
    global.BANNED_SATURATED_TTL_MS = 3 * DAY_MS;

    function parseIsoMs(iso) {
        if (!iso) return null;
        const ms = Date.parse(iso);
        return Number.isFinite(ms) ? ms : null;
    }

    function isWithinTtl(checkedAtIso, ttlMs, nowMs = Date.now()) {
        const checkedMs = parseIsoMs(checkedAtIso);
        if (!checkedMs || !Number.isFinite(ttlMs) || ttlMs <= 0) return false;
        return (nowMs - checkedMs) < ttlMs;
    }

    global.resolveUsptoCacheTtlMs = function resolveUsptoCacheTtlMs(usptoStatus) {
        const s = String(usptoStatus || '').toLowerCase();
        if (s === 'safe') return global.SAFE_CLASS_TTL_MS;
        if (s === 'banned') return global.BANNED_SATURATED_TTL_MS;
        return 0;
    };

    global.resolveAnalysisCacheTtlMs = function resolveAnalysisCacheTtlMs(classification) {
        const s = String(classification || '').toLowerCase();
        if (s === 'excellent' || s === 'medium' || s === 'excel' || s === 'med') return global.SAFE_CLASS_TTL_MS;
        if (s === 'saturated' || s === 'sat') return global.BANNED_SATURATED_TTL_MS;
        return 0;
    };

    global.normalizeClassificationTier = function normalizeClassificationTier(raw) {
        const s = String(raw || '').toLowerCase();
        if (s === 'excel' || s === 'excellent') return 'excellent';
        if (s === 'med' || s === 'medium') return 'medium';
        if (s === 'sat' || s === 'saturated') return 'saturated';
        return s || null;
    };

    global.tpStatusFromClassification = function tpStatusFromClassification(classification) {
        const tier = global.normalizeClassificationTier(classification);
        if (tier === 'excellent') return 'excel';
        if (tier === 'medium') return 'med';
        if (tier === 'saturated') return 'sat';
        return null;
    };

    global.buildNicheCacheExpiresAt = function buildNicheCacheExpiresAt(checkedAtIso, ttlMs) {
        const checkedMs = parseIsoMs(checkedAtIso);
        if (!checkedMs || !ttlMs) return null;
        return new Date(checkedMs + ttlMs).toISOString();
    };

    global.createEmptyNicheCacheEntry = function createEmptyNicheCacheEntry(nicheKey) {
        return {
            niche_key: nicheKey,
            uspto_status: null,
            classification: null,
            checked_at: null,
            expires_at: null,
            uspto_checked_at: null,
            uspto_expires_at: null,
            classification_checked_at: null,
            classification_expires_at: null,
        };
    };

    global.sanitizeNicheCacheEntry = function sanitizeNicheCacheEntry(raw = {}, nicheKey = '') {
        const key = nicheKey || String(raw.niche_key || '').trim().toLowerCase();
        const entry = global.createEmptyNicheCacheEntry(key);
        if (!key) return entry;

        const uspto = String(raw.uspto_status || '').toLowerCase();
        if (uspto === 'safe' || uspto === 'banned') entry.uspto_status = uspto;

        entry.classification = global.normalizeClassificationTier(raw.classification);

        entry.uspto_checked_at = typeof raw.uspto_checked_at === 'string' ? raw.uspto_checked_at
            : (typeof raw.checked_at === 'string' && entry.uspto_status ? raw.checked_at : null);
        entry.classification_checked_at = typeof raw.classification_checked_at === 'string'
            ? raw.classification_checked_at
            : (typeof raw.checked_at === 'string' && entry.classification ? raw.checked_at : null);

        entry.uspto_expires_at = typeof raw.uspto_expires_at === 'string' ? raw.uspto_expires_at
            : (typeof raw.expires_at === 'string' && entry.uspto_status ? raw.expires_at : null);
        entry.classification_expires_at = typeof raw.classification_expires_at === 'string'
            ? raw.classification_expires_at
            : null;

        if (entry.uspto_checked_at && !entry.uspto_expires_at && entry.uspto_status) {
            entry.uspto_expires_at = global.buildNicheCacheExpiresAt(
                entry.uspto_checked_at,
                global.resolveUsptoCacheTtlMs(entry.uspto_status)
            );
        }
        if (entry.classification_checked_at && !entry.classification_expires_at && entry.classification) {
            entry.classification_expires_at = global.buildNicheCacheExpiresAt(
                entry.classification_checked_at,
                global.resolveAnalysisCacheTtlMs(entry.classification)
            );
        }

        entry.checked_at = entry.uspto_checked_at || entry.classification_checked_at || null;
        const expiryCandidates = [entry.uspto_expires_at, entry.classification_expires_at]
            .map(parseIsoMs)
            .filter(Number.isFinite);
        entry.expires_at = expiryCandidates.length
            ? new Date(Math.max(...expiryCandidates)).toISOString()
            : null;

        return entry;
    };

    global.sanitizeNicheCacheMap = function sanitizeNicheCacheMap(rawCache = {}) {
        const out = {};
        if (!rawCache || typeof rawCache !== 'object') return out;
        for (const [rawKey, rawValue] of Object.entries(rawCache)) {
            const key = global.normalizeNicheKey(rawKey);
            if (!key) continue;
            out[key] = global.sanitizeNicheCacheEntry(rawValue, key);
        }
        return out;
    };

    global.isNicheUsptoCacheValid = function isNicheUsptoCacheValid(entry, { force = false, nowMs = Date.now() } = {}) {
        if (force || !entry) return false;
        const status = String(entry.uspto_status || '').toLowerCase();
        if (status !== 'safe' && status !== 'banned') return false;
        if (entry.uspto_expires_at) return parseIsoMs(entry.uspto_expires_at) > nowMs;
        return isWithinTtl(entry.uspto_checked_at, global.resolveUsptoCacheTtlMs(status), nowMs);
    };

    global.isNicheClassificationCacheValid = function isNicheClassificationCacheValid(entry, { force = false, nowMs = Date.now() } = {}) {
        if (force || !entry) return false;
        const tier = global.normalizeClassificationTier(entry.classification);
        if (!tier) return false;
        if (entry.classification_expires_at) return parseIsoMs(entry.classification_expires_at) > nowMs;
        return isWithinTtl(entry.classification_checked_at, global.resolveAnalysisCacheTtlMs(tier), nowMs);
    };

    global.upsertNicheCacheUspto = function upsertNicheCacheUspto(cache, nicheKey, usptoStatus, checkedAtIso = new Date().toISOString()) {
        const key = global.normalizeNicheKey(nicheKey);
        const status = String(usptoStatus || '').toLowerCase();
        if (!key || (status !== 'safe' && status !== 'banned')) return cache;
        const map = { ...(cache || {}) };
        const prev = global.sanitizeNicheCacheEntry(map[key] || {}, key);
        const ttl = global.resolveUsptoCacheTtlMs(status);
        map[key] = {
            ...prev,
            niche_key: key,
            uspto_status: status,
            uspto_checked_at: checkedAtIso,
            uspto_expires_at: global.buildNicheCacheExpiresAt(checkedAtIso, ttl),
            checked_at: checkedAtIso,
            expires_at: global.buildNicheCacheExpiresAt(checkedAtIso, ttl),
        };
        return map;
    };

    global.upsertNicheCacheClassification = function upsertNicheCacheClassification(cache, nicheKey, classification, checkedAtIso = new Date().toISOString()) {
        const key = global.normalizeNicheKey(nicheKey);
        const tier = global.normalizeClassificationTier(classification);
        if (!key || !tier) return cache;
        const map = { ...(cache || {}) };
        const prev = global.sanitizeNicheCacheEntry(map[key] || {}, key);
        const ttl = global.resolveAnalysisCacheTtlMs(tier);
        const usptoExpires = parseIsoMs(prev.uspto_expires_at);
        const classExpires = parseIsoMs(global.buildNicheCacheExpiresAt(checkedAtIso, ttl));
        map[key] = {
            ...prev,
            niche_key: key,
            classification: tier,
            classification_checked_at: checkedAtIso,
            classification_expires_at: global.buildNicheCacheExpiresAt(checkedAtIso, ttl),
            checked_at: checkedAtIso,
            expires_at: new Date(Math.max(usptoExpires || 0, classExpires || 0) || Date.now()).toISOString(),
        };
        return map;
    };

    global.migrateLegacyHistoryToNicheCache = function migrateLegacyHistoryToNicheCache(usptoHistory = {}, tpHistory = {}, baseIso = new Date().toISOString()) {
        let cache = {};
        for (const [rawKey, rawStatus] of Object.entries(usptoHistory || {})) {
            const status = String(rawStatus || '').toLowerCase();
            if (status !== 'safe' && status !== 'banned') continue;
            cache = global.upsertNicheCacheUspto(cache, rawKey, status, baseIso);
        }
        for (const [rawKey, rawStatus] of Object.entries(tpHistory || {})) {
            cache = global.upsertNicheCacheClassification(cache, rawKey, rawStatus, baseIso);
        }
        return cache;
    };

    global.syncNicheCacheToLegacyMaps = function syncNicheCacheToLegacyMaps(cache = {}, { nowMs = Date.now() } = {}) {
        const usptoHistory = {};
        const tpHistory = {};
        for (const [key, rawEntry] of Object.entries(cache || {})) {
            const entry = global.sanitizeNicheCacheEntry(rawEntry, key);
            if (global.isNicheUsptoCacheValid(entry, { nowMs })) {
                usptoHistory[key] = entry.uspto_status;
            }
            if (global.isNicheClassificationCacheValid(entry, { nowMs })) {
                const tpStatus = global.tpStatusFromClassification(entry.classification);
                if (tpStatus) tpHistory[key] = tpStatus;
            }
        }
        return { usptoHistory, tpHistory };
    };

    global.splitNichesByNicheCache = function splitNichesByNicheCache(niches = [], cache = {}, {
        mode = 'uspto',
        force = false,
        allowedStatuses = [],
    } = {}) {
        const buckets = {};
        allowedStatuses.forEach((status) => { buckets[status] = []; });
        const pending = [];
        const seen = new Set();
        let rememberedCount = 0;
        const cleanCache = global.sanitizeNicheCacheMap(cache);
        const nowMs = Date.now();

        for (const rawNiche of niches) {
            const niche = String(rawNiche || '').trim();
            const key = global.normalizeNicheKey(niche);
            if (!key || seen.has(key)) continue;
            seen.add(key);

            const entry = cleanCache[key];
            let remembered = false;

            if (mode === 'uspto') {
                if (!force && global.isNicheUsptoCacheValid(entry, { nowMs })) {
                    const bucketKey = entry.uspto_status;
                    if (allowedStatuses.includes(bucketKey)) {
                        buckets[bucketKey].push(niche);
                        remembered = true;
                    }
                }
            } else if (mode === 'analysis') {
                if (!force && global.isNicheClassificationCacheValid(entry, { nowMs })) {
                    const tpStatus = global.tpStatusFromClassification(entry.classification);
                    if (tpStatus && allowedStatuses.includes(tpStatus)) {
                        buckets[tpStatus].push(niche);
                        remembered = true;
                    }
                }
            }

            if (remembered) {
                rememberedCount += 1;
            } else {
                pending.push(niche);
            }
        }

        return { pending, buckets, rememberedCount, totalUnique: seen.size };
    };

    global.pruneExpiredNicheCache = function pruneExpiredNicheCache(cache = {}, nowMs = Date.now()) {
        const out = {};
        for (const [key, rawEntry] of Object.entries(global.sanitizeNicheCacheMap(cache))) {
            const entry = global.sanitizeNicheCacheEntry(rawEntry, key);
            const usptoValid = global.isNicheUsptoCacheValid(entry, { nowMs });
            const classValid = global.isNicheClassificationCacheValid(entry, { nowMs });
            if (!usptoValid && !classValid) continue;
            if (!usptoValid) {
                entry.uspto_status = null;
                entry.uspto_checked_at = null;
                entry.uspto_expires_at = null;
            }
            if (!classValid) {
                entry.classification = null;
                entry.classification_checked_at = null;
                entry.classification_expires_at = null;
            }
            entry.checked_at = entry.uspto_checked_at || entry.classification_checked_at || null;
            const expiryCandidates = [entry.uspto_expires_at, entry.classification_expires_at]
                .map(parseIsoMs)
                .filter(Number.isFinite);
            entry.expires_at = expiryCandidates.length
                ? new Date(Math.max(...expiryCandidates)).toISOString()
                : null;
            out[key] = entry;
        }
        return out;
    };

    global.loadNicheCacheBundle = async function loadNicheCacheBundle(getStorageFn) {
        const data = await getStorageFn([
            global.NHP_NICHE_CACHE_STORAGE_KEY,
            'usptoHistory',
            'tpHistory',
        ]);
        let cache = global.sanitizeNicheCacheMap(data[global.NHP_NICHE_CACHE_STORAGE_KEY] || {});
        if (!Object.keys(cache).length) {
            cache = global.migrateLegacyHistoryToNicheCache(data.usptoHistory || {}, data.tpHistory || {});
        } else {
            cache = global.pruneExpiredNicheCache(cache);
        }
        const legacy = global.syncNicheCacheToLegacyMaps(cache);
        return { cache, ...legacy };
    };

    global.persistNicheCacheBundle = async function persistNicheCacheBundle(setStorageFn, cache, reason = 'sync') {
        const pruned = global.pruneExpiredNicheCache(cache);
        const legacy = global.syncNicheCacheToLegacyMaps(pruned);
        await setStorageFn({
            [global.NHP_NICHE_CACHE_STORAGE_KEY]: pruned,
            usptoHistory: legacy.usptoHistory,
            tpHistory: legacy.tpHistory,
            nhp_niche_cache_reason: reason,
            nhp_niche_cache_updated_at: new Date().toISOString(),
        });
        return { cache: pruned, ...legacy };
    };

}(typeof globalThis !== 'undefined' ? globalThis : self));
