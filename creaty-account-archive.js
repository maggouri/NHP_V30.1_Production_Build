/**
 * CREATY Account Archive — IndexedDB snapshot per account (store + schedule + quintet).
 * Loaded in background via importScripts; exposes CreatyAccountArchive global.
 */
(function initCreatyAccountArchive(global) {
    'use strict';

    if (global.CreatyAccountArchive) return;

    const DB_NAME = 'creaty-account-archive';
    const DB_VERSION = 1;
    const STORE_NAME = 'archives';
    const ARCHIVE_VERSION = 1;
    const DEBOUNCE_MS = 1800;

    const PROFILE_KEY_PREFIX = 'creaty_store_profile_';
    const SCHEDULE_KEY_PREFIX = 'creaty_artisan_schedule_';
    const DL_DB_NAME = 'creaty-design-library';
    const DL_META_STORE = 'designs';
    const DL_BLOB_STORE = 'blobs';
    const GROUP_SIZE = 5;

    let dbPromise = null;
    const pendingSaves = new Map();

    function safeEmailKey(email) {
        return String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    }

    function normalizeEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    function profileStorageKey(email) {
        return `${PROFILE_KEY_PREFIX}${safeEmailKey(email)}`;
    }

    function scheduleStorageKey(email) {
        return `${SCHEDULE_KEY_PREFIX}${safeEmailKey(email)}`;
    }

    function openArchiveDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'email' });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function openDesignDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DL_DB_NAME, 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function readStorage(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (items) => resolve(items || {}));
        });
    }

    async function writeStorage(patch) {
        return new Promise((resolve) => {
            chrome.storage.local.set(patch, () => resolve());
        });
    }

    async function listAllDesigns() {
        const db = await openDesignDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DL_META_STORE, 'readonly');
            const req = tx.objectStore(DL_META_STORE).getAll();
            req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
            req.onerror = () => reject(req.error);
        });
    }

    async function getDesignBlob(id) {
        const db = await openDesignDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DL_BLOB_STORE, 'readonly');
            const req = tx.objectStore(DL_BLOB_STORE).get(String(id));
            req.onsuccess = () => resolve(req.result?.blob || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function putDesignRecord(meta, blob) {
        const db = await openDesignDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction([DL_META_STORE, DL_BLOB_STORE], 'readwrite');
            tx.objectStore(DL_META_STORE).put(meta);
            if (blob) tx.objectStore(DL_BLOB_STORE).put({ id: meta.id, blob });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function blobToDataUrl(blob) {
        if (!blob) return null;
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(binary);
        const mime = blob.type || 'image/png';
        return `data:${mime};base64,${b64}`;
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
        } catch (_) {
            return null;
        }
    }

    async function listActivatedEmails() {
        const stored = await readStorage(['ap_accounts_teepublic', 'ap_accounts']);
        const accounts = Array.isArray(stored.ap_accounts_teepublic)
            ? stored.ap_accounts_teepublic
            : (Array.isArray(stored.ap_accounts) ? stored.ap_accounts : []);
        return accounts
            .map((a) => normalizeEmail(a?.email))
            .filter(Boolean);
    }

    async function listAssignedDesignEmails() {
        const all = await listAllDesigns();
        const emails = new Set();
        for (const d of all) {
            const ref = normalizeEmail(d?.assignedAccountId);
            if (ref) emails.add(ref);
        }
        return [...emails];
    }

    async function findQuintetForAccount(accountEmail) {
        const email = normalizeEmail(accountEmail);
        if (!email) return null;
        const all = await listAllDesigns();
        const byGroup = new Map();
        for (const d of all) {
            const gid = d.groupId || 'ungrouped';
            if (gid === 'ungrouped') continue;
            if (!byGroup.has(gid)) byGroup.set(gid, []);
            byGroup.get(gid).push(d);
        }
        for (const [groupId, designs] of byGroup.entries()) {
            const sorted = designs.sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
            const assigned = normalizeEmail(sorted[0]?.assignedAccountId);
            if (sorted.length >= GROUP_SIZE && assigned === email) {
                return { groupId, designs: sorted };
            }
        }
        return null;
    }

    function scheduleDayLabel(schedule) {
        if (!schedule?.started) return 0;
        const day = Number(schedule.currentDay) || 1;
        return Math.min(12, Math.max(0, day));
    }

    async function collectAccountSnapshot(email, { includeDesignData = true, eventNote = '' } = {}) {
        const key = normalizeEmail(email);
        if (!key) return null;

        const profileKey = profileStorageKey(key);
        const schedKey = scheduleStorageKey(key);
        const stored = await readStorage([profileKey, schedKey]);
        const storeProfile = stored[profileKey] && typeof stored[profileKey] === 'object'
            ? stored[profileKey]
            : null;
        const schedule = stored[schedKey] && typeof stored[schedKey] === 'object'
            ? stored[schedKey]
            : null;

        const quintet = await findQuintetForAccount(key);
        const designs = [];
        if (quintet?.designs?.length) {
            for (const d of quintet.designs) {
                const entry = {
                    id: d.id,
                    title: d.title || '',
                    filename: d.filename || '',
                    description: d.description || '',
                    mainTag: d.mainTag || '',
                    tags: Array.isArray(d.tags) ? d.tags : [],
                    niche: d.niche || '',
                    status: d.status || 'ready',
                    groupId: d.groupId,
                    groupIndex: d.groupIndex ?? 0,
                    assignedAccountId: d.assignedAccountId || key,
                    uploadedAt: d.createdAt || d.updatedAt || null,
                    phaseDay: null,
                };
                if (includeDesignData) {
                    const blob = await getDesignBlob(d.id);
                    if (blob) {
                        entry.dataUrl = await blobToDataUrl(blob);
                        entry.mimeType = blob.type || d.mimeType || 'image/png';
                    }
                }
                designs.push(entry);
            }
        }

        const niche = String(
            schedule?.niche || storeProfile?.niche || ''
        ).trim();

        const existing = await getArchive(key);
        const activityLog = Array.isArray(existing?.activityLog) ? [...existing.activityLog] : [];
        if (eventNote) {
            activityLog.push({
                at: new Date().toISOString(),
                message: String(eventNote).slice(0, 500),
                level: 'info',
            });
            while (activityLog.length > 200) activityLog.shift();
        }

        const now = new Date().toISOString();
        return {
            email: key,
            niche,
            storeProfile: storeProfile ? { ...storeProfile } : null,
            schedule: schedule ? { ...schedule, accountEmail: key } : null,
            quintetGroupId: quintet?.groupId || null,
            designs,
            activityLog,
            archivedAt: existing?.archivedAt || now,
            updatedAt: now,
            version: ARCHIVE_VERSION,
            hasImages: !!(storeProfile?.avatarDataUrl || storeProfile?.coverDataUrl),
            scheduleDay: scheduleDayLabel(schedule),
        };
    }

    async function saveArchive(email, options = {}) {
        const key = normalizeEmail(email);
        if (!key) return { success: false, error: 'archive_email_required' };
        const snapshot = await collectAccountSnapshot(key, options);
        if (!snapshot) return { success: false, error: 'archive_collect_failed' };

        const hasData = snapshot.storeProfile || snapshot.schedule || snapshot.designs?.length;
        if (!hasData && !options.force) {
            return { success: false, error: 'archive_empty', skipped: true };
        }

        const db = await openArchiveDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(snapshot);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_ARCHIVE_UPDATED',
                email: key,
                archive: {
                    email: key,
                    hasImages: snapshot.hasImages,
                    scheduleDay: snapshot.scheduleDay,
                    niche: snapshot.niche,
                    updatedAt: snapshot.updatedAt,
                },
            });
        } catch (_) { /* popup closed */ }

        return { success: true, archive: snapshot };
    }

    function queueSave(email, eventNote = '') {
        const key = normalizeEmail(email);
        if (!key) return;
        const prev = pendingSaves.get(key);
        if (prev?.timer) clearTimeout(prev.timer);
        const timer = setTimeout(() => {
            pendingSaves.delete(key);
            void saveArchive(key, { eventNote: prev?.note || eventNote }).catch(() => { });
        }, DEBOUNCE_MS);
        pendingSaves.set(key, { timer, note: eventNote || prev?.note || '' });
    }

    async function getArchive(email) {
        const key = normalizeEmail(email);
        if (!key) return null;
        const db = await openArchiveDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function listArchives() {
        const db = await openArchiveDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => {
                const rows = (req.result || []).sort(
                    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
                );
                resolve(rows);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function patchAccountStoreProfile(email, profile) {
        if (typeof CreatyStoreGenerator !== 'undefined' && CreatyStoreGenerator.saveStoreProfile) {
            await CreatyStoreGenerator.saveStoreProfile(email, profile);
            return;
        }
        const key = profileStorageKey(email);
        await writeStorage({ [key]: { ...profile, updatedAt: new Date().toISOString() } });
    }

    async function restoreSchedule(email, schedule) {
        const key = normalizeEmail(email);
        if (!schedule || typeof schedule !== 'object') return;
        const schedKey = scheduleStorageKey(key);
        const restored = { ...schedule, accountEmail: key, updatedAt: new Date().toISOString() };
        await writeStorage({ [schedKey]: restored });
        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_SCHEDULE_UPDATE',
                email: key,
                schedule: restored,
            });
        } catch (_) { /* popup closed */ }
    }

    async function restoreDesigns(email, designs = [], { replace = true } = {}) {
        const key = normalizeEmail(email);
        if (!Array.isArray(designs) || !designs.length) return { restored: 0 };

        if (replace) {
            const existing = await findQuintetForAccount(key);
            if (existing?.designs?.length) {
                const db = await openDesignDb();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([DL_META_STORE, DL_BLOB_STORE], 'readwrite');
                    for (const d of existing.designs) {
                        tx.objectStore(DL_META_STORE).delete(String(d.id));
                        tx.objectStore(DL_BLOB_STORE).delete(String(d.id));
                    }
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            }
        }

        const groupId = designs[0]?.groupId || `cg_import_${Date.now()}`;
        let restored = 0;
        for (const d of designs) {
            const blob = d.dataUrl ? dataUrlToBlob(d.dataUrl) : null;
            if (!blob && !d.id) continue;
            const id = String(d.id || `cd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
            const meta = {
                id,
                filename: d.filename || 'design.png',
                title: d.title || '',
                description: d.description || '',
                mainTag: d.mainTag || '',
                tags: Array.isArray(d.tags) ? d.tags : [],
                niche: d.niche || '',
                status: d.status || 'ready',
                mimeType: d.mimeType || blob?.type || 'image/png',
                size: blob?.size || 0,
                groupId: d.groupId || groupId,
                groupIndex: d.groupIndex ?? restored,
                assignedAccountId: key,
                sourceSeoId: d.sourceSeoId || null,
                pulledBy: null,
                pulledAt: null,
                createdAt: d.uploadedAt || d.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await putDesignRecord(meta, blob);
            restored += 1;
        }
        return { restored };
    }

    function validateImportPayload(payload) {
        if (!payload || typeof payload !== 'object') return { ok: false, error: 'archive_invalid_json' };
        const manifest = payload.manifest || {};
        const archive = payload.archive || (Array.isArray(payload.accounts) ? null : payload);
        if (manifest.type && manifest.type !== 'creaty-account-archive' && manifest.type !== 'creaty-account-archive-batch') {
            return { ok: false, error: 'archive_invalid_type' };
        }
        if (Array.isArray(payload.accounts)) {
            return { ok: true, batch: true, accounts: payload.accounts };
        }
        const doc = archive || payload;
        const email = normalizeEmail(doc.email || manifest.email);
        if (!email) return { ok: false, error: 'archive_email_missing' };
        return { ok: true, batch: false, archive: doc, email };
    }

    async function importArchive(payload, { mode = 'replace' } = {}) {
        const validated = validateImportPayload(payload);
        if (!validated.ok) return { success: false, error: validated.error };

        if (validated.batch) {
            const results = [];
            for (const doc of validated.accounts) {
                results.push(await importArchive({ manifest: payload.manifest, archive: doc }, { mode }));
            }
            const ok = results.filter((r) => r.success).length;
            return { success: ok > 0, imported: ok, total: results.length, results };
        }

        const doc = validated.archive;
        const email = validated.email;
        const replace = mode !== 'merge';

        if (doc.storeProfile && typeof doc.storeProfile === 'object') {
            if (replace) {
                await patchAccountStoreProfile(email, doc.storeProfile);
            } else {
                const profileKey = profileStorageKey(email);
                const stored = await readStorage([profileKey]);
                const existing = stored[profileKey] && typeof stored[profileKey] === 'object' ? stored[profileKey] : {};
                await patchAccountStoreProfile(email, {
                    ...existing,
                    ...doc.storeProfile,
                    links: { ...(existing.links || {}), ...(doc.storeProfile.links || {}) },
                    imagePrompts: { ...(existing.imagePrompts || {}), ...(doc.storeProfile.imagePrompts || {}) },
                });
            }
        }
        if (doc.schedule && typeof doc.schedule === 'object') {
            if (replace) {
                await restoreSchedule(email, doc.schedule);
            } else {
                const schedKey = scheduleStorageKey(email);
                const stored = await readStorage([schedKey]);
                const existing = stored[schedKey] && typeof stored[schedKey] === 'object' ? stored[schedKey] : {};
                await restoreSchedule(email, { ...existing, ...doc.schedule, accountEmail: email });
            }
        }
        if (doc.designs?.length) {
            await restoreDesigns(email, doc.designs, { replace });
        }

        const saved = await saveArchive(email, { force: true, eventNote: 'import_restore' });
        return { success: true, email, archive: saved.archive, mode: replace ? 'replace' : 'merge' };
    }

    async function buildExportDocument(email, { includeDesignData = true } = {}) {
        const key = normalizeEmail(email);
        let archive = await getArchive(key);
        if (!archive || includeDesignData) {
            const fresh = await collectAccountSnapshot(key, { includeDesignData });
            if (fresh) archive = fresh;
        }
        if (!archive) return null;
        return {
            manifest: {
                version: ARCHIVE_VERSION,
                type: 'creaty-account-archive',
                exportDate: new Date().toISOString(),
                email: key,
            },
            archive,
        };
    }

    async function buildBatchExportDocument({ includeDesignData = true } = {}) {
        const rows = await listArchives();
        const accounts = [];
        for (const row of rows) {
            const doc = await buildExportDocument(row.email, { includeDesignData });
            if (doc?.archive) accounts.push(doc.archive);
        }
        return {
            manifest: {
                version: ARCHIVE_VERSION,
                type: 'creaty-account-archive-batch',
                exportDate: new Date().toISOString(),
                count: accounts.length,
            },
            accounts,
        };
    }

    async function handleAction(request) {
        const action = request?.action;
        const email = normalizeEmail(request?.accountEmail || request?.email);

        if (action === 'CREATY_ARCHIVE_SAVE') {
            if (!email) return { success: false, error: 'archive_email_required' };
            return saveArchive(email, { force: !!request.force, eventNote: request.eventNote || '' });
        }
        if (action === 'CREATY_ARCHIVE_QUEUE_SAVE') {
            if (!email) return { success: false, error: 'archive_email_required' };
            queueSave(email, request.eventNote || '');
            return { success: true, queued: true };
        }
        if (action === 'CREATY_ARCHIVE_LIST') {
            const rows = await listArchives();
            return {
                success: true,
                archives: rows.map((a) => ({
                    email: a.email,
                    niche: a.niche || '',
                    hasImages: !!a.hasImages,
                    scheduleDay: a.scheduleDay || 0,
                    scheduleStarted: !!a.schedule?.started,
                    designCount: Array.isArray(a.designs) ? a.designs.length : 0,
                    updatedAt: a.updatedAt,
                    archivedAt: a.archivedAt,
                })),
            };
        }
        if (action === 'CREATY_ARCHIVE_GET') {
            if (!email) return { success: false, error: 'archive_email_required' };
            const archive = await getArchive(email);
            return { success: true, archive };
        }
        if (action === 'CREATY_ARCHIVE_EXPORT_JSON') {
            if (request.all) {
                const doc = await buildBatchExportDocument({ includeDesignData: request.includeDesignData !== false });
                return { success: true, document: doc };
            }
            if (!email) return { success: false, error: 'archive_email_required' };
            const doc = await buildExportDocument(email, { includeDesignData: request.includeDesignData !== false });
            if (!doc) return { success: false, error: 'archive_not_found' };
            return { success: true, document: doc };
        }
        if (action === 'CREATY_ARCHIVE_IMPORT') {
            return importArchive(request.payload || request.document, { mode: request.mode || 'replace' });
        }
        if (action === 'CREATY_ARCHIVE_SNAPSHOT_ALL') {
            let emails = Array.isArray(request.emails) ? request.emails.map(normalizeEmail).filter(Boolean) : [];
            if (!emails.length) {
                const activated = await listActivatedEmails();
                const assigned = await listAssignedDesignEmails();
                emails = [...new Set([...activated, ...assigned])];
            }
            const saved = [];
            for (const em of emails) {
                const r = await saveArchive(em, { force: true, eventNote: request.eventNote || 'bulk_snapshot' });
                if (r.success) saved.push(em);
            }
            return { success: true, saved: saved.length, emails: saved };
        }
        if (action === 'CREATY_ARCHIVE_QUEUE_DESIGNS') {
            const emails = Array.isArray(request.accountEmails)
                ? request.accountEmails.map(normalizeEmail).filter(Boolean)
                : [];
            const targets = emails.length ? emails : await listAssignedDesignEmails();
            targets.forEach((em) => queueSave(em, 'design_library_changed'));
            return { success: true, queued: targets.length };
        }
        return null;
    }

    global.CreatyAccountArchive = {
        handleAction,
        saveArchive,
        queueSave,
        getArchive,
        listArchives,
        collectAccountSnapshot,
        buildExportDocument,
        buildBatchExportDocument,
        importArchive,
        validateImportPayload,
        ARCHIVE_VERSION,
    };
})(typeof self !== 'undefined' ? self : globalThis);
