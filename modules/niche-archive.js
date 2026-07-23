export const NHP_ARCHIVE_STORAGE_KEY = 'nhp_niche_archive_index';
export const NHP_ARCHIVE_SETTINGS_KEY = 'nhp_trend_archive_settings';
export const NHP_TMH_HISTORY_KEY = 'tmhHistory';

const DEFAULT_ARCHIVE = Object.freeze({
    version: 1,
    updatedAt: null,
    snapshotCount: 0,
    lastSnapshotId: null,
    niches: {}
});

const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    intervalMinutes: 180,
    lastAutoCaptureAt: null
});

function normalizeString(value = '') {
    return String(value || '').trim();
}

function normalizeNullableString(value = null) {
    const normalized = normalizeString(value);
    return normalized || null;
}

function normalizeEnum(value, allowed) {
    const normalized = normalizeString(value).toLowerCase();
    return allowed.includes(normalized) ? normalized : null;
}

export function normalizeNicheKey(value = '') {
    return normalizeString(value).toLowerCase();
}

export function createEmptyArchiveIndex() {
    return JSON.parse(JSON.stringify(DEFAULT_ARCHIVE));
}

export function createDefaultArchiveSettings() {
    return { ...DEFAULT_SETTINGS };
}

function sanitizeArchiveRecord(rawKey, rawRecord = {}) {
    const text = normalizeString(rawRecord.text || rawKey);
    if (!text) return null;

    const firstSeenAt = normalizeNullableString(rawRecord.firstSeenAt);
    const lastSeenAt = normalizeNullableString(rawRecord.lastSeenAt);
    const firstSeenDate = normalizeNullableString(rawRecord.firstSeenDate);
    const lastSeenDate = normalizeNullableString(rawRecord.lastSeenDate);
    const appearances = Number.isFinite(rawRecord.appearances) && rawRecord.appearances > 0 ? Math.floor(rawRecord.appearances) : 0;
    const bestRank = Number.isFinite(rawRecord.bestRank) && rawRecord.bestRank > 0 ? Math.floor(rawRecord.bestRank) : null;
    const latestRank = Number.isFinite(rawRecord.latestRank) && rawRecord.latestRank > 0 ? Math.floor(rawRecord.latestRank) : null;

    return {
        text,
        firstSeenAt,
        lastSeenAt,
        firstSeenDate,
        lastSeenDate,
        appearances,
        bestRank,
        latestRank,
        firstSnapshotId: normalizeNullableString(rawRecord.firstSnapshotId),
        lastSnapshotId: normalizeNullableString(rawRecord.lastSnapshotId),
        lastSource: normalizeNullableString(rawRecord.lastSource),
        lastQuality: normalizeNullableString(rawRecord.lastQuality),
        stages: {
            trend: normalizeEnum(rawRecord.stages?.trend, ['captured']),
            tmhunt: normalizeEnum(rawRecord.stages?.tmhunt, ['safe', 'restricted']),
            uspto: normalizeEnum(rawRecord.stages?.uspto, ['safe', 'banned']),
            analysis: normalizeEnum(rawRecord.stages?.analysis, ['excel', 'med', 'sat', 'emp']),
            note: normalizeEnum(rawRecord.stages?.note, ['queued', 'done', 'manual', 'removed'])
        }
    };
}

export function sanitizeArchiveIndex(rawArchive = {}) {
    const clean = createEmptyArchiveIndex();
    clean.version = 1;
    clean.updatedAt = normalizeNullableString(rawArchive.updatedAt);
    clean.snapshotCount = Number.isFinite(rawArchive.snapshotCount) && rawArchive.snapshotCount > 0 ? Math.floor(rawArchive.snapshotCount) : 0;
    clean.lastSnapshotId = normalizeNullableString(rawArchive.lastSnapshotId);

    const sourceNiches = rawArchive.niches && typeof rawArchive.niches === 'object' ? rawArchive.niches : {};
    for (const [rawKey, rawRecord] of Object.entries(sourceNiches)) {
        const key = normalizeNicheKey(rawKey || rawRecord?.text);
        const record = sanitizeArchiveRecord(key, rawRecord);
        if (!key || !record) continue;
        clean.niches[key] = record;
    }

    return clean;
}

export function sanitizeArchiveSettings(rawSettings = {}) {
    return {
        enabled: rawSettings?.enabled !== false,
        intervalMinutes: Number.isFinite(rawSettings?.intervalMinutes) && rawSettings.intervalMinutes >= 60
            ? Math.floor(rawSettings.intervalMinutes)
            : DEFAULT_SETTINGS.intervalMinutes,
        lastAutoCaptureAt: normalizeNullableString(rawSettings?.lastAutoCaptureAt)
    };
}

export function getArchiveRecord(index, nicheText) {
    const cleanIndex = sanitizeArchiveIndex(index);
    return cleanIndex.niches[normalizeNicheKey(nicheText)] || null;
}

export function escapeHtml(value = '') {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatArchiveDate(value, locale = 'ar-EG') {
    if (!value) return 'غير معروف';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}

export function getPriorityMeta(rank) {
    if (!rank || rank <= 0) {
        return { label: 'غير محددة', shortLabel: 'N/A', color: '#94A3B8' };
    }
    if (rank <= 10) {
        return { label: 'عالية جدا', shortLabel: 'TOP', color: '#10B981' };
    }
    if (rank <= 30) {
        return { label: 'عالية', shortLabel: 'HIGH', color: '#22C55E' };
    }
    if (rank <= 80) {
        return { label: 'متوسطة', shortLabel: 'MID', color: '#F59E0B' };
    }
    return { label: 'منخفضة', shortLabel: 'LOW', color: '#64748B' };
}

function sendRuntimeMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!response) {
                reject(new Error('No response from background'));
                return;
            }
            if (response.success === false) {
                reject(new Error(response.error || 'Archive request failed'));
                return;
            }
            resolve(response);
        });
    });
}

export function getStorageValue(key, fallbackValue) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] ?? fallbackValue);
        });
    });
}

export async function getArchiveIndexFromStorage() {
    const raw = await getStorageValue(NHP_ARCHIVE_STORAGE_KEY, null);
    return sanitizeArchiveIndex(raw || {});
}

export async function getArchiveSettingsFromStorage() {
    const raw = await getStorageValue(NHP_ARCHIVE_SETTINGS_KEY, null);
    return sanitizeArchiveSettings(raw || {});
}

export async function refreshArchiveIndex() {
    const response = await sendRuntimeMessage({ action: 'NHP_ARCHIVE_REFRESH' });
    return sanitizeArchiveIndex(response.index || {});
}

export async function recordTrendSnapshot(trends, source = 'manual_fetch') {
    const response = await sendRuntimeMessage({
        action: 'NHP_ARCHIVE_RECORD_TRENDS',
        trends,
        source
    });
    return sanitizeArchiveIndex(response.index || {});
}

export async function recordNoteLifecycle(items, reason = 'note_update') {
    const response = await sendRuntimeMessage({
        action: 'NHP_ARCHIVE_RECORD_NOTE',
        items,
        reason
    });
    return sanitizeArchiveIndex(response.index || {});
}

export async function exportArchiveBundle() {
    return sendRuntimeMessage({ action: 'NHP_ARCHIVE_EXPORT_BUNDLE' });
}

export async function importArchiveBundle(bundle, mode = 'merge') {
    const response = await sendRuntimeMessage({
        action: 'NHP_ARCHIVE_IMPORT_BUNDLE',
        bundle,
        mode
    });
    return sanitizeArchiveIndex(response.index || {});
}
