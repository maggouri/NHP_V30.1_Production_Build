/**
 * Shared niche cache TTL helpers (popup ES modules + node tests).
 * Mirrors background/niche-cache-ttl.js rules.
 */

export const NHP_NICHE_CACHE_STORAGE_KEY = 'nhp_niche_cache';
export const SAFE_CLASS_TTL_MS = 48 * 60 * 60 * 1000;
export const BANNED_SATURATED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

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

export function normalizeNicheKey(value = '') {
  return String(value || '').toLowerCase().trim();
}

export function normalizeClassificationTier(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'excel' || s === 'excellent') return 'excellent';
  if (s === 'med' || s === 'medium') return 'medium';
  if (s === 'sat' || s === 'saturated') return 'saturated';
  return s || null;
}

export function tpStatusFromClassification(classification) {
  const tier = normalizeClassificationTier(classification);
  if (tier === 'excellent') return 'excel';
  if (tier === 'medium') return 'med';
  if (tier === 'saturated') return 'sat';
  return null;
}

export function resolveUsptoCacheTtlMs(usptoStatus) {
  const s = String(usptoStatus || '').toLowerCase();
  if (s === 'safe') return SAFE_CLASS_TTL_MS;
  if (s === 'banned') return BANNED_SATURATED_TTL_MS;
  return 0;
}

export function resolveAnalysisCacheTtlMs(classification) {
  const s = String(classification || '').toLowerCase();
  if (s === 'excellent' || s === 'medium' || s === 'excel' || s === 'med') return SAFE_CLASS_TTL_MS;
  if (s === 'saturated' || s === 'sat') return BANNED_SATURATED_TTL_MS;
  return 0;
}

export function buildNicheCacheExpiresAt(checkedAtIso, ttlMs) {
  const checkedMs = parseIsoMs(checkedAtIso);
  if (!checkedMs || !ttlMs) return null;
  return new Date(checkedMs + ttlMs).toISOString();
}

export function sanitizeNicheCacheEntry(raw = {}, nicheKey = '') {
  const key = nicheKey || normalizeNicheKey(raw.niche_key);
  const entry = {
    niche_key: key,
    uspto_status: null,
    classification: null,
    uspto_checked_at: null,
    uspto_expires_at: null,
    classification_checked_at: null,
    classification_expires_at: null,
  };
  if (!key) return entry;

  const uspto = String(raw.uspto_status || '').toLowerCase();
  if (uspto === 'safe' || uspto === 'banned') entry.uspto_status = uspto;

  entry.classification = normalizeClassificationTier(raw.classification);
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
    entry.uspto_expires_at = buildNicheCacheExpiresAt(entry.uspto_checked_at, resolveUsptoCacheTtlMs(entry.uspto_status));
  }
  if (entry.classification_checked_at && !entry.classification_expires_at && entry.classification) {
    entry.classification_expires_at = buildNicheCacheExpiresAt(
      entry.classification_checked_at,
      resolveAnalysisCacheTtlMs(entry.classification)
    );
  }
  return entry;
}

export function sanitizeNicheCacheMap(rawCache = {}) {
  const out = {};
  if (!rawCache || typeof rawCache !== 'object') return out;
  for (const [rawKey, rawValue] of Object.entries(rawCache)) {
    const key = normalizeNicheKey(rawKey);
    if (!key) continue;
    out[key] = sanitizeNicheCacheEntry(rawValue, key);
  }
  return out;
}

export function isNicheUsptoCacheValid(entry, { force = false, nowMs = Date.now() } = {}) {
  if (force || !entry) return false;
  const status = String(entry.uspto_status || '').toLowerCase();
  if (status !== 'safe' && status !== 'banned') return false;
  if (entry.uspto_expires_at) return parseIsoMs(entry.uspto_expires_at) > nowMs;
  return isWithinTtl(entry.uspto_checked_at, resolveUsptoCacheTtlMs(status), nowMs);
}

export function isNicheClassificationCacheValid(entry, { force = false, nowMs = Date.now() } = {}) {
  if (force || !entry) return false;
  const tier = normalizeClassificationTier(entry.classification);
  if (!tier) return false;
  if (entry.classification_expires_at) return parseIsoMs(entry.classification_expires_at) > nowMs;
  return isWithinTtl(entry.classification_checked_at, resolveAnalysisCacheTtlMs(tier), nowMs);
}

export function migrateLegacyHistoryToNicheCache(usptoHistory = {}, tpHistory = {}, baseIso = new Date().toISOString()) {
  const map = {};
  for (const [rawKey, rawStatus] of Object.entries(usptoHistory || {})) {
    const key = normalizeNicheKey(rawKey);
    const status = String(rawStatus || '').toLowerCase();
    if (!key || (status !== 'safe' && status !== 'banned')) continue;
    map[key] = sanitizeNicheCacheEntry({
      niche_key: key,
      uspto_status: status,
      uspto_checked_at: baseIso,
      uspto_expires_at: buildNicheCacheExpiresAt(baseIso, resolveUsptoCacheTtlMs(status)),
    }, key);
  }
  for (const [rawKey, rawStatus] of Object.entries(tpHistory || {})) {
    const key = normalizeNicheKey(rawKey);
    const tier = normalizeClassificationTier(rawStatus);
    if (!key || !tier) continue;
    const prev = map[key] || sanitizeNicheCacheEntry({}, key);
    map[key] = sanitizeNicheCacheEntry({
      ...prev,
      niche_key: key,
      classification: tier,
      classification_checked_at: baseIso,
      classification_expires_at: buildNicheCacheExpiresAt(baseIso, resolveAnalysisCacheTtlMs(tier)),
    }, key);
  }
  return map;
}

export function buildCacheFromStorageData(data = {}) {
  let cache = sanitizeNicheCacheMap(data[NHP_NICHE_CACHE_STORAGE_KEY] || {});
  if (!Object.keys(cache).length) {
    cache = migrateLegacyHistoryToNicheCache(data.usptoHistory || {}, data.tpHistory || {});
  }
  return cache;
}

export function splitNichesByNicheCache(niches = [], cache = {}, {
  mode = 'uspto',
  force = false,
  allowedStatuses = [],
} = {}) {
  const buckets = {};
  allowedStatuses.forEach((status) => { buckets[status] = []; });
  const pending = [];
  const seen = new Set();
  let rememberedCount = 0;
  const cleanCache = sanitizeNicheCacheMap(cache);
  const nowMs = Date.now();

  for (const rawNiche of niches) {
    const niche = String(rawNiche || '').trim();
    const key = normalizeNicheKey(niche);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const entry = cleanCache[key];
    let remembered = false;

    if (mode === 'uspto') {
      if (!force && isNicheUsptoCacheValid(entry, { nowMs })) {
        const bucketKey = entry.uspto_status;
        if (allowedStatuses.includes(bucketKey)) {
          buckets[bucketKey].push(niche);
          remembered = true;
        }
      }
    } else if (mode === 'analysis') {
      if (!force && isNicheClassificationCacheValid(entry, { nowMs })) {
        const tpStatus = tpStatusFromClassification(entry.classification);
        if (tpStatus && allowedStatuses.includes(tpStatus)) {
          buckets[tpStatus].push(niche);
          remembered = true;
        }
      }
    }

    if (remembered) rememberedCount += 1;
    else pending.push(niche);
  }

  return { pending, buckets, rememberedCount, totalUnique: seen.size };
}
