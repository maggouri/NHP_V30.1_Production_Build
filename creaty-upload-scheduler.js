/**
 * CREATY Column 2 — Artisan 12-day upload scheduler (chrome.alarms + Ghost Server 3019)
 * Loaded at end of background.js (shares scope with startAPProcess / nhpUrl).
 */
(function initCreatyUploadScheduler(global) {
    'use strict';

    if (global.CreatyUploadScheduler) return;

    const GHOST_PORT = 3019;
    const SCHEDULE_KEY_PREFIX = 'creaty_artisan_schedule_';
    const ALARM_PREFIX = 'creaty_artisan_sched_';
    const ARTISAN_PLAN_DAYS = 12;
    const ARTISAN_MAX_DESIGNS = 5;
    const MAX_RETRY = 3;
    const RETRY_DELAY_MIN = 15;

    const DL_DB_NAME = 'creaty-design-library';
    const DL_META_STORE = 'designs';
    const DL_BLOB_STORE = 'blobs';
    const GROUP_SIZE = 5;

    const DESIGN_STATUS = { READY: 'ready', PULLED: 'pulled', PUBLISHED: 'published' };

    const ARTISAN_PHASE_DEFS = [
        { id: 'foundation', dayStart: 1, dayEnd: 2, isDesign: false },
        { id: 'design1', dayStart: 3, dayEnd: 4, isDesign: true, designIndex: 0 },
        { id: 'design2', dayStart: 5, dayEnd: 6, isDesign: true, designIndex: 1 },
        { id: 'design3', dayStart: 7, dayEnd: 8, isDesign: true, designIndex: 2 },
        { id: 'design4', dayStart: 9, dayEnd: 10, isDesign: true, designIndex: 3 },
        { id: 'design5_review', dayStart: 11, dayEnd: 12, isDesign: true, designIndex: 4 },
    ];

    let dlDbPromise = null;

    function scheduleStorageKey(email) {
        const safe = String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
        return `${SCHEDULE_KEY_PREFIX}${safe}`;
    }

    function alarmNameForEmail(email) {
        const safe = String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
        return `${ALARM_PREFIX}${safe}`;
    }

    function parseIsoDate(iso) {
        const parts = String(iso || '').split('-').map(Number);
        if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function daysSinceStart(schedule) {
        const start = parseIsoDate(schedule?.startDate);
        if (!start) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        return Math.max(0, Math.floor((today - start) / 86400000));
    }

    function calendarDayFromSchedule(schedule) {
        if (!schedule?.started || schedule.paused) return schedule?.currentDay || 1;
        const gap = Math.max(1, Number(schedule.daysBetween) || 2);
        const elapsed = daysSinceStart(schedule);
        const computed = Math.min(ARTISAN_PLAN_DAYS, Math.floor(elapsed / gap) + 1);
        return Math.max(schedule.currentDay || 1, computed);
    }

    function phaseForDay(day, schedule) {
        const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule?.designCount) || ARTISAN_MAX_DESIGNS);
        const allowedIds = new Set(
            ARTISAN_PHASE_DEFS.filter((d) => d.isDesign).slice(0, designCount).map((d) => d.id)
        );
        return ARTISAN_PHASE_DEFS.find((def) => {
            if (def.isDesign && !allowedIds.has(def.id)) return false;
            return day >= def.dayStart && day <= def.dayEnd;
        }) || null;
    }

    function nextPendingDesignPhase(schedule) {
        const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule?.designCount) || ARTISAN_MAX_DESIGNS);
        const designPhases = ARTISAN_PHASE_DEFS.filter((d) => d.isDesign).slice(0, designCount);
        for (const def of designPhases) {
            const stored = schedule.phases?.find((p) => p.id === def.id);
            if (!stored || (stored.status !== 'done' && stored.status !== 'skipped')) return def;
        }
        return null;
    }

    function computeNextUploadMs(schedule, phaseDef) {
        const gap = Math.max(1, Number(schedule.daysBetween) || 2);
        const start = parseIsoDate(schedule.startDate);
        if (!start || !phaseDef) {
            return Date.now() + gap * 86400000;
        }
        const targetDay = phaseDef.dayStart;
        const targetDate = new Date(start);
        targetDate.setDate(targetDate.getDate() + (targetDay - 1) * gap);
        targetDate.setHours(9, 0, 0, 0);
        const ms = targetDate.getTime() - Date.now();
        return ms > 60000 ? ms : 60000;
    }

    function openDesignDb() {
        if (dlDbPromise) return dlDbPromise;
        dlDbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DL_DB_NAME, 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dlDbPromise;
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

    async function updateDesignMeta(id, patch) {
        const db = await openDesignDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DL_META_STORE, 'readwrite');
            const store = tx.objectStore(DL_META_STORE);
            const getReq = store.get(String(id));
            getReq.onsuccess = () => {
                const current = getReq.result;
                if (!current) {
                    reject(new Error('Design not found'));
                    return;
                }
                store.put({ ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() });
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function normalizeAccountRef(value) {
        return String(value || '').trim().toLowerCase();
    }

    function groupAssignedEmail(designs) {
        const sorted = [...designs].sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
        for (const d of sorted) {
            const ref = normalizeAccountRef(d?.assignedAccountId);
            if (ref) return ref;
        }
        return '';
    }

    function isQuintetUploadReady(designs) {
        const sorted = [...designs].sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
        if (sorted.length < GROUP_SIZE) return false;
        return sorted.every((d) => {
            const st = String(d?.status || DESIGN_STATUS.READY);
            return st === DESIGN_STATUS.READY || st === DESIGN_STATUS.PULLED;
        });
    }

    async function getCompleteGroupForAccount(accountEmail) {
        return findQuintetForAccount(accountEmail);
    }

    async function findQuintetForAccount(accountEmail) {
        const all = await listAllDesigns();
        const byGroup = new Map();
        for (const d of all) {
            const gid = d.groupId || 'ungrouped';
            if (gid === 'ungrouped') continue;
            if (!byGroup.has(gid)) byGroup.set(gid, []);
            byGroup.get(gid).push(d);
        }
        const email = normalizeAccountRef(accountEmail);
        if (!email) return null;
        for (const [groupId, designs] of byGroup.entries()) {
            const sorted = designs.sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
            const assigned = groupAssignedEmail(sorted);
            const isComplete = sorted.length >= GROUP_SIZE;
            if (isComplete && isQuintetUploadReady(sorted) && assigned === email) {
                return { groupId, designs: sorted };
            }
        }
        return null;
    }

    async function listUnassignedCompleteQuintets() {
        const all = await listAllDesigns();
        const byGroup = new Map();
        for (const d of all) {
            const gid = d.groupId || 'ungrouped';
            if (gid === 'ungrouped') continue;
            if (!byGroup.has(gid)) byGroup.set(gid, []);
            byGroup.get(gid).push(d);
        }
        const results = [];
        for (const [groupId, designs] of byGroup.entries()) {
            const sorted = designs.sort((a, b) => (a.groupIndex ?? 0) - (b.groupIndex ?? 0));
            const assigned = groupAssignedEmail(sorted);
            const isComplete = sorted.length >= GROUP_SIZE;
            const allReady = sorted.every((d) => d.status === DESIGN_STATUS.READY);
            if (isComplete && allReady && !assigned) {
                results.push({ groupId, designs: sorted });
            }
        }
        return results.sort((a, b) => new Date(a.designs[0]?.createdAt || 0) - new Date(b.designs[0]?.createdAt || 0));
    }

    async function assignUnassignedQuintetToAccount(accountEmail) {
        const email = normalizeAccountRef(accountEmail);
        if (!email) return { success: false, error: 'email_required' };
        const existing = await findQuintetForAccount(email);
        if (existing) return { success: true, group: existing, alreadyAssigned: true };
        const unassigned = await listUnassignedCompleteQuintets();
        if (!unassigned.length) return { success: false, error: 'no_unassigned_quintet' };
        const pick = unassigned[0];
        for (const d of pick.designs) {
            await updateDesignMeta(d.id, { assignedAccountId: email });
        }
        const group = await findQuintetForAccount(email);
        return { success: true, group, groupId: pick.groupId, alreadyAssigned: false };
    }

    async function blobToBase64(blob) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    async function loadSchedule(email) {
        const key = scheduleStorageKey(email);
        const items = await chrome.storage.local.get([key]);
        return items[key] || null;
    }

    async function saveSchedule(email, state, syncOpts) {
        const key = scheduleStorageKey(email);
        state.updatedAt = new Date().toISOString();
        await chrome.storage.local.set({ [key]: state });
        broadcastScheduleUpdate(email, state);
        queueScheduleSync(email, syncOpts?.lastEvent, syncOpts || {});
        if (typeof CreatyAccountArchive !== 'undefined' && CreatyAccountArchive.queueSave) {
            CreatyAccountArchive.queueSave(email, syncOpts?.lastEvent || 'schedule_saved');
        }
    }

    function broadcastScheduleUpdate(email, state, extra = {}) {
        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_SCHEDULE_UPDATE',
                email,
                schedule: state,
                ...extra,
            });
        } catch (_) { /* no listeners */ }
    }

    function scheduleLog(email, message, level = 'info') {
        broadcastScheduleUpdate(null, null, {
            log: message,
            level,
            email,
        });
        if (email && message) {
            queueScheduleSync(email, message);
        }
        try {
            getHandlersApi().appendAutomationLog?.(`[CREATY Schedule] ${message}`, level === 'error' ? 'error' : 'info');
        } catch (_) { /* ignore */ }
    }

    function getHandlersApi() {
        return global.__emailCoreHandlersApi || {};
    }

    function getCreatyHandlersApi() {
        return global.__creatyHandlersApi || {};
    }

    const scheduleSyncPending = new Map();
    const scheduleSyncEvents = new Map();
    const SCHEDULE_SYNC_DEBOUNCE_MS = 30000;

    async function flushScheduleSync(email, lastEvent) {
        const key = String(email || '').trim().toLowerCase();
        if (!key) return;
        const api = getCreatyHandlersApi();
        if (!api.syncCreatySchedule) return;
        const schedule = await loadSchedule(key);
        await api.syncCreatySchedule(key, schedule, lastEvent);
    }

    function queueScheduleSync(email, lastEvent, options = {}) {
        const key = String(email || '').trim().toLowerCase();
        if (!key) return;
        const api = getCreatyHandlersApi();
        if (!api.syncCreatySchedule) return;

        if (lastEvent) scheduleSyncEvents.set(key, lastEvent);

        if (options.immediate) {
            const pending = scheduleSyncPending.get(key);
            if (pending) clearTimeout(pending);
            scheduleSyncPending.delete(key);
            const ev = scheduleSyncEvents.get(key) || lastEvent || '';
            scheduleSyncEvents.delete(key);
            if (options.cleared) {
                void api.syncCreatySchedule(key, null, ev);
                return;
            }
            void flushScheduleSync(key, ev);
            return;
        }

        if (scheduleSyncPending.has(key)) return;

        scheduleSyncPending.set(
            key,
            setTimeout(() => {
                scheduleSyncPending.delete(key);
                const ev = scheduleSyncEvents.get(key) || '';
                scheduleSyncEvents.delete(key);
                void flushScheduleSync(key, ev);
            }, SCHEDULE_SYNC_DEBOUNCE_MS)
        );
    }

    async function pingGhostServer(port = GHOST_PORT) {
        try {
            const url = `http://127.0.0.1:${port}/ping`;
            const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3500) });
            return res.ok;
        } catch (err) {
            console.error('[CreatyUploadScheduler] pingGhostServer failed', { port, error: err?.message || err });
            return false;
        }
    }

    async function loadAccountByEmail(email) {
        const stored = await chrome.storage.local.get(['ap_accounts_teepublic', 'ap_accounts']);
        const accounts = Array.isArray(stored.ap_accounts_teepublic)
            ? stored.ap_accounts_teepublic
            : (Array.isArray(stored.ap_accounts) ? stored.ap_accounts : []);
        return accounts.find((a) => String(a?.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()) || null;
    }

    async function loadStoreProfile(email) {
        if (typeof CreatyStoreGenerator !== 'undefined' && CreatyStoreGenerator.loadStoreProfile) {
            try {
                const loaded = await CreatyStoreGenerator.loadStoreProfile(email);
                if (loaded?.profile) return loaded.profile;
            } catch (_) { /* fall through */ }
        }
        const key = typeof CreatyStoreGenerator !== 'undefined' && CreatyStoreGenerator.profileStorageKey
            ? CreatyStoreGenerator.profileStorageKey(email)
            : `creaty_store_profile_${String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_')}`;
        const stored = await chrome.storage.local.get([key]);
        return stored[key] || null;
    }

    function summarizeStoreProfile(profile) {
        if (!profile) return '';
        const parts = [];
        if (profile.title) parts.push(`«${profile.title}»`);
        if (profile.bio) parts.push('نبذة');
        const links = profile.links || {};
        const linkCount = ['instagram', 'twitter', 'facebook', 'pinterest'].filter((k) => links[k]).length;
        if (linkCount) parts.push(`${linkCount} رابط`);
        if (profile.avatarDataUrl) parts.push('avatar');
        if (profile.coverDataUrl) parts.push('cover');
        return parts.join(' · ');
    }

    async function buildAccountBundle(email, scheduleNiche = '') {
        const account = await loadAccountByEmail(email);
        if (!account) return null;
        let storeProfile = await loadStoreProfile(email);
        if (!storeProfile && account.storeProfile) storeProfile = account.storeProfile;
        if (storeProfile && scheduleNiche && !storeProfile.niche) {
            storeProfile = { ...storeProfile, niche: scheduleNiche };
        }
        const quintet = await getCompleteGroupForAccount(email);
        return {
            email,
            account: {
                ...account,
                storeProfile: storeProfile || null,
            },
            storeProfile: storeProfile || null,
            quintet,
            niche: String(scheduleNiche || storeProfile?.niche || '').trim(),
        };
    }

    function quintetDesignSummaries(group) {
        if (!group?.designs?.length) return [];
        return group.designs.map((d, i) => ({
            index: i,
            id: d.id,
            title: d.title || d.filename || `Design ${i + 1}`,
            description: d.description || '',
            tags: Array.isArray(d.tags) ? d.tags : [],
            mainTag: d.mainTag || '',
            niche: d.niche || '',
            filename: d.filename || '',
        }));
    }

    function isAccountActivated(acc) {
        if (global.ApAccountActivation?.isAutAccountActivated) {
            return global.ApAccountActivation.isAutAccountActivated(acc);
        }
        return !!(acc?.tpActivated && String(acc?.creaty_phase || '').toUpperCase() === 'DONE');
    }

    async function buildQueueItemFromDesign(design, base64, scheduleNiche = '', storeTitle = '') {
        const tags = Array.isArray(design.tags) ? design.tags : [];
        const title = design.title || design.filename || 'Untitled';
        let description = String(design.description || '').trim();
        if (storeTitle && description && !description.toLowerCase().includes(storeTitle.toLowerCase())) {
            description = `${description} | ${storeTitle}`;
        } else if (storeTitle && !description) {
            description = storeTitle;
        }
        return {
            id: `creaty_sched_${design.id}_${Date.now()}`,
            file: {
                name: design.filename || 'design.png',
                type: design.mimeType || 'image/png',
            },
            base64,
            meta: {
                title,
                description,
                tags: tags.slice(0, 15),
                mainTag: design.mainTag || tags[0] || '',
                niche: design.niche || scheduleNiche || '',
                storeTitle: storeTitle || '',
            },
        };
    }

    async function applyStoreProfileViaGhost(account, storeProfile, port = GHOST_PORT) {
        if (!storeProfile?.title) {
            throw new Error('storeProfile.title missing');
        }
        const url = typeof nhpUrl === 'function'
            ? nhpUrl(port, '/apply-store-profile')
            : `http://127.0.0.1:${port}/apply-store-profile`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account: {
                    email: account.email,
                    pass: account.pass,
                    storeProfile,
                },
                storeProfile,
                isVisual: false,
                platform: 'teepublic',
            }),
            signal: AbortSignal.timeout(3600000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.error || `Ghost store profile failed (${res.status})`);
        }
        return data;
    }

    async function uploadDesignViaGhost(account, design, port = GHOST_PORT, scheduleNiche = '', options = {}) {
        const storeProfile = options.storeProfile || account?.storeProfile || null;
        const designIndex = Number(options.designIndex);
        const designTotal = Number(options.designTotal) || ARTISAN_MAX_DESIGNS;
        const title = design.title || design.filename || 'Untitled';
        const posLabel = Number.isFinite(designIndex)
            ? `رفع التصميم ${designIndex + 1}/${designTotal} — ${title}`
            : `رفع التصميم: ${title}`;
        scheduleLog(account.email, `⏳ ${posLabel}...`, 'info');

        const blob = await getDesignBlob(design.id);
        if (!blob) throw new Error('Design image missing in library');
        const base64 = await blobToBase64(blob);
        const queueItem = await buildQueueItemFromDesign(
            design,
            base64,
            scheduleNiche,
            storeProfile?.title || ''
        );
        const payload = {
            queueItemId: queueItem.id,
            file: queueItem.file,
            base64: queueItem.base64,
            meta: queueItem.meta,
        };

        if (typeof enqueueStartAPProcess === 'function') {
            await enqueueStartAPProcess({
                accounts: [{ ...account, storeProfile }],
                countPer: 1,
                delaySec: 0,
                isVisual: false,
                actionType: 'publish',
                defaultColor: 'Black',
                isRandom: false,
                platform: 'teepublic',
                port,
                inlineQueue: [queueItem],
                scheduleMode: true,
                storeProfile,
                applyStoreProfileFirst: options.applyStoreProfileFirst === true,
            });
            return { success: true, queueItemId: queueItem.id };
        }

        const guard = global.NhpSeqUploadGuard;
        const unlocked = guard && typeof guard.readUnlockState === 'function'
            ? await guard.readUnlockState()
            : false;
        if (!unlocked) {
            throw new Error('SEQ_UPLOAD_GUARD: sequential upload required — use enqueueStartAPProcess');
        }

        if (typeof startAPProcess === 'function') {
            await startAPProcess({
                accounts: [{ ...account, storeProfile }],
                countPer: 1,
                delaySec: 0,
                isVisual: false,
                actionType: 'publish',
                defaultColor: 'Black',
                isRandom: false,
                platform: 'teepublic',
                port,
                inlineQueue: [queueItem],
                scheduleMode: true,
                storeProfile,
                applyStoreProfileFirst: options.applyStoreProfileFirst === true,
            }, { __seqGuardBypass: true });
            return { success: true, queueItemId: queueItem.id };
        }

        if (!unlocked) {
            throw new Error('SEQ_UPLOAD_GUARD: direct /upload bypass blocked');
        }

        const url = typeof nhpUrl === 'function' ? nhpUrl(port, '/upload') : `http://127.0.0.1:${port}/upload`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account: { email: account.email, pass: account.pass, storeProfile },
                designs: [payload],
                actionType: 'publish',
                defaultColor: 'Black',
                isVisual: false,
                platform: 'teepublic',
                storeProfile,
                applyStoreProfileFirst: options.applyStoreProfileFirst === true,
            }),
            signal: AbortSignal.timeout(3600000),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(body || `Ghost upload failed (${res.status})`);
        }
        return { success: true, queueItemId: queueItem.id };
    }

    async function clearAlarm(email) {
        const name = alarmNameForEmail(email);
        try {
            await chrome.alarms.clear(name);
        } catch (_) { /* ignore */ }
    }

    async function scheduleAlarm(email, whenMs) {
        const name = alarmNameForEmail(email);
        const when = Math.max(60000, Number(whenMs) || 60000);
        await chrome.alarms.create(name, { when: Date.now() + when });
    }

    async function updateNextUploadAt(email, schedule, phaseDef, delayMs) {
        const nextMs = delayMs != null ? delayMs : computeNextUploadMs(schedule, phaseDef);
        schedule.nextUploadAt = new Date(Date.now() + nextMs).toISOString();
        await saveSchedule(email, schedule);
        await scheduleAlarm(email, nextMs);
    }

    async function completeFoundationPhase(schedule, email) {
        const phase = schedule.phases?.find((p) => p.id === 'foundation');
        if (!phase || phase.status === 'done' || phase.status === 'skipped') return;

        if (schedule.skipStoreSetup) {
            scheduleLog(email, 'تخطي مرحلة التأسيس — المتجر جاهز مسبقاً', 'info');
        } else {
            const bundle = await buildAccountBundle(email, schedule.niche || '');
            const storeProfile = bundle?.storeProfile || schedule.storeProfile || null;

            if (!storeProfile?.title) {
                scheduleLog(
                    email,
                    '⚠️ لا يوجد ملف متجر محفوظ — أنشئه من تبويب «توليد المتجر» (Tab 2) ثم احفظه للحساب',
                    'warn'
                );
                schedule.lastError = 'store_profile_missing';
                await saveSchedule(email, schedule);
                await scheduleAlarm(email, RETRY_DELAY_MIN * 60000);
                return;
            }

            const account = bundle?.account || await loadAccountByEmail(email);
            if (!account) {
                scheduleLog(email, '⛔ الحساب غير موجود', 'error');
                return;
            }

            const summary = summarizeStoreProfile(storeProfile);
            scheduleLog(email, `تطبيق ملف المتجر على ${email}...`, 'info');
            scheduleLog(email, `البيانات المحفوظة: ${summary}`, 'info');

            try {
                const result = await applyStoreProfileViaGhost(
                    account,
                    storeProfile,
                    schedule.ghostPort || GHOST_PORT
                );
                const applied = result?.appliedFields || {};
                const appliedList = [
                    applied.title ? 'عنوان' : null,
                    applied.bio ? 'نبذة' : null,
                    applied.instagram || applied.twitter || applied.facebook || applied.pinterest ? 'روابط' : null,
                    applied.avatar ? 'avatar' : null,
                    applied.cover ? 'cover' : null,
                ].filter(Boolean).join('، ');
                scheduleLog(
                    email,
                    `✅ تم تطبيق ملف المتجر — «${result?.title || storeProfile.title}»${appliedList ? ` (${appliedList})` : ''}`,
                    'success'
                );
                schedule.storeProfileTitle = result?.title || storeProfile.title;
                schedule.storeProfileAppliedAt = new Date().toISOString();
                schedule.lastError = null;
            } catch (err) {
                schedule.lastError = String(err?.message || err || 'store_profile_apply_failed');
                scheduleLog(email, `❌ فشل تطبيق ملف المتجر: ${schedule.lastError}`, 'error');
                schedule.retryCount = (schedule.retryCount || 0) + 1;
                await saveSchedule(email, schedule);
                if (schedule.retryCount < MAX_RETRY) {
                    await scheduleAlarm(email, RETRY_DELAY_MIN * 60000);
                } else {
                    schedule.paused = true;
                    scheduleLog(email, '⛔ توقفت الجدولة بعد فشل تطبيق ملف المتجر', 'error');
                    await clearAlarm(email);
                }
                return;
            }
        }

        phase.status = 'done';
        if (phase.checklist) {
            Object.keys(phase.checklist).forEach((k) => { phase.checklist[k] = true; });
        }
        schedule.currentDay = Math.max(schedule.currentDay || 1, 3);
        schedule.retryCount = 0;
        await saveSchedule(email, schedule);
    }

    async function markDesignPhaseDone(schedule, email, phaseDef, design) {
        const phase = schedule.phases?.find((p) => p.id === phaseDef.id);
        if (phase) {
            phase.status = 'done';
            if (phase.checklist) Object.keys(phase.checklist).forEach((k) => { phase.checklist[k] = true; });
        }
        schedule.uploadsCompleted = (schedule.uploadsCompleted || 0) + 1;
        schedule.designUploadIndex = (phaseDef.designIndex ?? 0) + 1;
        schedule.lastUploadAt = new Date().toISOString();
        schedule.lastError = null;
        schedule.retryCount = 0;
        schedule.currentDay = Math.max(schedule.currentDay || 1, phaseDef.dayEnd + 1);
        if (design?.id) {
            await updateDesignMeta(design.id, {
                status: DESIGN_STATUS.PUBLISHED,
                pulledAt: new Date().toISOString(),
            });
        }
        await saveSchedule(email, schedule);
    }

    function isManualPhaseMode(schedule) {
        return String(schedule?.phaseAdvanceMode || 'auto').toLowerCase() === 'manual';
    }

    async function notifyPhaseDue(email, schedule, phaseDef) {
        const label = phaseDef?.isDesign
            ? `Design ${(phaseDef.designIndex ?? 0) + 1} upload due`
            : 'Foundation phase due';
        const arLabel = phaseDef?.isDesign
            ? `حان موعد رفع التصميم ${(phaseDef.designIndex ?? 0) + 1}`
            : 'حان موعد مرحلة التأسيس';
        scheduleLog(email, `🔔 ${arLabel} — ${label} (manual mode) / الوضع اليدوي`, 'warn');
        try {
            chrome.notifications?.create?.(`creaty_phase_${Date.now()}`, {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'CREATY — Artisan Schedule',
                message: `${arLabel} · ${email}`,
                priority: 1,
            });
        } catch (_) { /* notifications optional */ }
    }

    async function advanceSchedulePhase(email, options = {}) {
        const schedule = await loadSchedule(email);
        if (!schedule?.started) return { success: false, error: 'schedule_not_started' };
        if (schedule.paused && !options.force) return { success: false, error: 'schedule_paused' };

        schedule.awaitingPhaseAdvance = null;
        schedule.automationEnabled = true;
        await saveSchedule(email, schedule);
        await tickSchedule(email, { manualAdvance: true });

        const updated = await loadSchedule(email);
        return { success: true, schedule: updated };
    }

    async function tickSchedule(email, options = {}) {
        const schedule = await loadSchedule(email);
        if (!schedule?.started || schedule.paused) return;
        if (!schedule.automationEnabled && !options.manualAdvance) return;

        const account = await loadAccountByEmail(email);
        if (!account || !isAccountActivated(account)) {
            scheduleLog(email, '⛔ الحساب غير مفعّل — تم إيقاف الجدولة', 'error');
            schedule.paused = true;
            schedule.lastError = 'account_not_activated';
            await saveSchedule(email, schedule);
            await clearAlarm(email);
            return;
        }

        const ghostOnline = await pingGhostServer(schedule.ghostPort || GHOST_PORT);
        if (!ghostOnline) {
            scheduleLog(email, `Ghost Server (${schedule.ghostPort || GHOST_PORT}) غير متصل — إعادة المحاولة بعد ${RETRY_DELAY_MIN} دقيقة`, 'warn');
            schedule.lastError = 'ghost_offline';
            await saveSchedule(email, schedule);
            await scheduleAlarm(email, RETRY_DELAY_MIN * 60000);
            return;
        }

        const calendarDay = calendarDayFromSchedule(schedule);
        const currentPhaseDef = phaseForDay(calendarDay, schedule);
        const foundationPhase = schedule.phases?.find((p) => p.id === 'foundation');
        const foundationPending = foundationPhase && foundationPhase.status !== 'done' && foundationPhase.status !== 'skipped';

        if (foundationPending && (!currentPhaseDef || currentPhaseDef.id === 'foundation')) {
            await completeFoundationPhase(schedule, email);
            const reloaded = await loadSchedule(email);
            const foundationAfter = reloaded?.phases?.find((p) => p.id === 'foundation');
            const foundationDone = foundationAfter?.status === 'done' || foundationAfter?.status === 'skipped';
            if (!foundationDone || reloaded?.paused) {
                if (!reloaded?.paused && reloaded?.lastError === 'store_profile_missing') {
                    await scheduleAlarm(email, RETRY_DELAY_MIN * 60000);
                }
                return;
            }
            const nextDesignPhase = nextPendingDesignPhase(reloaded);
            if (nextDesignPhase) {
                await updateNextUploadAt(email, reloaded, nextDesignPhase, computeNextUploadMs(reloaded, nextDesignPhase));
            }
            return;
        }

        const targetPhase = nextPendingDesignPhase(schedule);
        if (!targetPhase) {
            scheduleLog(email, '✅ اكتملت خطة Artisan — 12 يوم', 'success');
            schedule.automationEnabled = false;
            await saveSchedule(email, schedule);
            await clearAlarm(email);
            return;
        }

        if (calendarDay < targetPhase.dayStart) {
            await updateNextUploadAt(email, schedule, targetPhase, computeNextUploadMs(schedule, targetPhase));
            return;
        }

        const group = await getCompleteGroupForAccount(email);
        if (!group) {
            scheduleLog(email, '⛔ لا توجد مجموعة تصاميم (5) معيّنة لهذا الحساب — عيّن من العمود 3', 'error');
            schedule.paused = true;
            schedule.lastError = 'no_quintet';
            await saveSchedule(email, schedule);
            await clearAlarm(email);
            return;
        }

        schedule.groupId = group.groupId;
        const designIndex = targetPhase.designIndex ?? 0;
        const design = group.designs[designIndex];
        if (!design) {
            scheduleLog(email, `⛔ التصميم ${designIndex + 1} غير موجود في المجموعة`, 'error');
            schedule.paused = true;
            schedule.lastError = 'design_missing';
            await saveSchedule(email, schedule);
            await clearAlarm(email);
            return;
        }

        const bundle = await buildAccountBundle(email, schedule.niche || '');
        const storeProfile = bundle?.storeProfile || schedule.storeProfile || account?.storeProfile || null;
        if (!schedule.skipStoreSetup && !storeProfile?.title) {
            scheduleLog(email, '⛔ لا يمكن الرفع بدون عنوان متجر — احفظ ملف المتجر من تبويب «توليد المتجر»', 'error');
            schedule.paused = true;
            schedule.lastError = 'store_title_required';
            await saveSchedule(email, schedule);
            await clearAlarm(email);
            return;
        }

        const designCount = Math.min(ARTISAN_MAX_DESIGNS, Number(schedule?.designCount) || ARTISAN_MAX_DESIGNS);
        const accountForUpload = storeProfile ? { ...account, storeProfile } : account;

        try {
            await uploadDesignViaGhost(
                accountForUpload,
                design,
                schedule.ghostPort || GHOST_PORT,
                schedule.niche || '',
                {
                    storeProfile,
                    designIndex,
                    designTotal: designCount,
                    applyStoreProfileFirst: designIndex === 0 && !schedule.storeProfileAppliedAt,
                }
            );
            await markDesignPhaseDone(schedule, email, targetPhase, design);
            scheduleLog(
                email,
                `✅ تم رفع التصميم ${designIndex + 1}/${designCount} — ${design.title || design.filename}`,
                'success'
            );

            const updated = await loadSchedule(email);
            const nextPhase = nextPendingDesignPhase(updated);
            if (nextPhase) {
                const gap = Math.max(1, Number(updated.daysBetween) || 2);
                await updateNextUploadAt(email, updated, nextPhase, gap * 86400000);
            } else {
                scheduleLog(email, '✅ اكتملت جميع الرفعات — الخطة مكتملة', 'success');
                updated.automationEnabled = false;
                await saveSchedule(email, updated);
                await clearAlarm(email);
            }
        } catch (err) {
            const retry = (schedule.retryCount || 0) + 1;
            schedule.retryCount = retry;
            schedule.lastError = String(err?.message || err || 'upload_failed');
            scheduleLog(email, `❌ فشل الرفع (${retry}/${MAX_RETRY}): ${schedule.lastError}`, 'error');
            await saveSchedule(email, schedule);
            if (retry < MAX_RETRY) {
                await scheduleAlarm(email, RETRY_DELAY_MIN * 60000);
            } else {
                schedule.paused = true;
                scheduleLog(email, '⛔ توقفت الجدولة بعد 3 محاولات فاشلة', 'error');
                await saveSchedule(email, schedule);
                await clearAlarm(email);
            }
        }
    }

    async function restoreActiveAlarms() {
        const all = await chrome.storage.local.get(null);
        const keys = Object.keys(all).filter((k) => k.startsWith(SCHEDULE_KEY_PREFIX));
        for (const key of keys) {
            const schedule = all[key];
            const email = schedule?.accountEmail;
            if (!email || !schedule?.started || schedule.paused || !schedule.automationEnabled) continue;
            const name = alarmNameForEmail(email);
            const existing = await chrome.alarms.get(name);
            if (!existing) {
                const nextPhase = nextPendingDesignPhase(schedule);
                const ms = schedule.nextUploadAt
                    ? Math.max(60000, new Date(schedule.nextUploadAt).getTime() - Date.now())
                    : computeNextUploadMs(schedule, nextPhase);
                await scheduleAlarm(email, ms);
            }
        }
    }

    async function listActivatedAccounts() {
        const stored = await chrome.storage.local.get(['ap_accounts_teepublic', 'ap_accounts']);
        const accounts = Array.isArray(stored.ap_accounts_teepublic)
            ? stored.ap_accounts_teepublic
            : (Array.isArray(stored.ap_accounts) ? stored.ap_accounts : []);
        return accounts.filter((acc) => !!String(acc?.email || '').trim() && isAccountActivated(acc));
    }

    async function assessAccountScheduleReadiness(email, options = {}) {
        const strictStore = options.strictStore !== false;
        const normalized = normalizeAccountRef(email);
        const account = await loadAccountByEmail(normalized);
        if (!account) {
            return {
                email: normalized,
                ok: false,
                activated: false,
                hasStore: false,
                hasQuintet: false,
                reason: 'الحساب غير موجود في AUT',
            };
        }
        const activated = isAccountActivated(account);
        if (!activated) {
            return {
                email: normalized,
                ok: false,
                activated: false,
                hasStore: false,
                hasQuintet: false,
                account,
                reason: 'الحساب غير مفعّل — أكمل العمود 1',
            };
        }
        const storeProfile = await loadStoreProfile(normalized);
        const hasStore = !!(storeProfile?.title);
        const quintet = await findQuintetForAccount(normalized);
        const hasQuintet = !!quintet;
        const niche = String(storeProfile?.niche || '').trim();
        const scheduleReadyFlag = await (async () => {
            const key = `creaty_schedule_ready_${normalized.replace(/[^a-z0-9@._-]/g, '_')}`;
            const stored = await chrome.storage.local.get([key]);
            return !!stored[key]?.scheduleReady;
        })();

        if (!hasQuintet) {
            return {
                email: normalized,
                ok: false,
                activated,
                hasStore,
                hasQuintet: false,
                account,
                storeProfile: hasStore ? storeProfile : null,
                reason: 'لا توجد مجموعة 5 تصاميم معيّنة — عيّن من العمود 3',
            };
        }
        if (strictStore && !hasStore) {
            return {
                email: normalized,
                ok: false,
                activated,
                hasStore: false,
                hasQuintet: true,
                account,
                quintet,
                reason: 'لا يوجد ملف متجر — أنشئه من تبويب «توليد المتجر»',
            };
        }

        return {
            email: normalized,
            ok: hasStore && hasQuintet,
            activated,
            hasStore,
            hasQuintet,
            scheduleReady: scheduleReadyFlag,
            account,
            storeProfile: hasStore ? storeProfile : null,
            quintet,
            niche,
        };
    }

    async function listReadyAccountsForSchedule(limit = 50) {
        const activated = await listActivatedAccounts();
        const ready = [];
        const partial = { quintetOnly: 0, storeOnly: 0 };
        for (const acc of activated) {
            const email = String(acc.email).trim();
            const check = await assessAccountScheduleReadiness(email, { strictStore: true });
            if (check.hasQuintet && !check.hasStore) partial.quintetOnly += 1;
            if (check.hasStore && !check.hasQuintet) partial.storeOnly += 1;
            if (check.ok) ready.push(check);
            if (ready.length >= limit) break;
        }
        ready.partial = partial;
        return ready;
    }

    async function resolveBatchTargets(payload = {}) {
        const mode = String(payload.selectionMode || payload.mode || 'single').toLowerCase();
        const countLimit = Math.min(50, Math.max(1, Number(payload.accountCount || payload.countLimit) || 1));
        const skipStore = payload.skipStoreSetup === true;
        const singleEmail = String(payload.accountEmail || payload.email || '').trim();
        const multiEmails = Array.isArray(payload.accountEmails)
            ? payload.accountEmails.map((e) => String(e || '').trim()).filter(Boolean)
            : [];

        let candidates = [];
        if (mode === 'all') {
            candidates = (await listActivatedAccounts()).map((a) => String(a.email).trim());
        } else if (mode === 'multi') {
            candidates = multiEmails.length ? multiEmails : (singleEmail ? [singleEmail] : []);
        } else {
            candidates = singleEmail ? [singleEmail] : [];
        }

        const seen = new Set();
        candidates = candidates.filter((email) => {
            const key = email.toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const targets = [];
        const skipped = [];

        for (const email of candidates) {
            if (targets.length >= countLimit) break;
            const check = await assessAccountScheduleReadiness(email);
            if (!check.ok) {
                skipped.push({ email, reason: check.reason });
                scheduleLog(email, `⏭️ تخطي ${email}: ${check.reason}`, 'warn');
                continue;
            }
            if (!skipStore && !check.storeProfile?.title) {
                skipped.push({ email, reason: 'لا يوجد ملف متجر' });
                scheduleLog(email, `⏭️ تخطي ${email}: لا يوجد ملف متجر`, 'warn');
                continue;
            }
            if (!check.quintet) {
                skipped.push({ email, reason: 'لا توجد مجموعة تصاميم (5)' });
                scheduleLog(email, `⏭️ تخطي ${email}: لا توجد مجموعة تصاميم (5)`, 'warn');
                continue;
            }
            targets.push(check);
        }

        return { mode, countLimit, targets, skipped };
    }

    async function startBatchAutomation(payload = {}) {
        const ghostOnline = await pingGhostServer(payload?.ghostPort || GHOST_PORT);
        if (!ghostOnline) {
            return { success: false, error: 'schedule_ghost_offline' };
        }

        const { targets, skipped, countLimit } = await resolveBatchTargets(payload);
        if (!targets.length) {
            return {
                success: false,
                error: 'schedule_no_ready_accounts',
                skipped,
                countLimit,
            };
        }

        const results = [];
        for (const target of targets) {
            const niche = String(payload.niche || target.niche || target.storeProfile?.niche || '').trim();
            if (!niche) {
                skipped.push({ email: target.email, reason: 'النيش غير محدد — أنشئ ملف المتجر من Tab 2' });
                scheduleLog(target.email, `⏭️ تخطي ${target.email}: النيش غير محدد`, 'warn');
                continue;
            }
            const result = await startAutomation({
                ...payload,
                accountEmail: target.email,
                email: target.email,
                niche,
                storeProfile: target.storeProfile,
                quintet: target.quintet,
            });
            results.push({ email: target.email, ...result });
        }

        const started = results.filter((r) => r.success);
        scheduleLog(
            null,
            `🚀 بدء جدولة دفعية: ${started.length}/${targets.length} حساب (حد ${countLimit})`,
            started.length ? 'success' : 'warn'
        );

        return {
            success: started.length > 0,
            started: started.length,
            total: targets.length,
            results,
            skipped,
            countLimit,
        };
    }

    async function validateStartPayload(payload) {
        const email = String(payload?.accountEmail || payload?.email || '').trim();
        if (!email) return { ok: false, error: 'schedule_account_required' };

        const bundle = await buildAccountBundle(email, payload?.niche || '');
        if (!bundle?.account) return { ok: false, error: 'schedule_account_not_found' };
        if (!isAccountActivated(bundle.account)) return { ok: false, error: 'schedule_account_not_activated' };

        const niche = String(payload?.niche || bundle.niche || bundle.storeProfile?.niche || '').trim();
        if (!niche) return { ok: false, error: 'schedule_niche_required' };

        const group = bundle.quintet || payload?.quintet || (await getCompleteGroupForAccount(email));
        if (!group) return { ok: false, error: 'schedule_quintet_required' };

        const ghostOnline = await pingGhostServer(payload?.ghostPort || GHOST_PORT);
        if (!ghostOnline) return { ok: false, error: 'schedule_ghost_offline' };

        const storeProfile = payload?.storeProfile || bundle.storeProfile || null;
        if (!payload?.skipStoreSetup && !storeProfile?.title) {
            return { ok: false, error: 'schedule_store_profile_required' };
        }

        return {
            ok: true,
            email,
            account: bundle.account,
            group,
            niche,
            storeProfile,
            quintetDesigns: quintetDesignSummaries(group),
        };
    }

    async function startAutomation(payload) {
        const validation = await validateStartPayload(payload);
        if (!validation.ok) return { success: false, error: validation.error };

        const { email, group, niche, storeProfile } = validation;
        let schedule = await loadSchedule(email);
        if (!schedule) {
            schedule = {
                niche,
                startDate: payload.startDate || new Date().toISOString().slice(0, 10),
                daysBetween: Math.min(7, Math.max(1, Number(payload.daysBetween) || 2)),
                designCount: Math.min(ARTISAN_MAX_DESIGNS, Math.max(1, Number(payload.designCount) || ARTISAN_MAX_DESIGNS)),
                accountEmail: email,
                started: false,
                paused: false,
                currentDay: 1,
                phases: ARTISAN_PHASE_DEFS.map((def) => ({
                    id: def.id,
                    status: 'pending',
                    checklist: {},
                })),
            };
        }
        schedule.niche = niche;
        schedule.startDate = payload.startDate || schedule.startDate;
        schedule.daysBetween = Math.min(7, Math.max(1, Number(payload.daysBetween) || schedule.daysBetween || 2));
        schedule.designCount = Math.min(ARTISAN_MAX_DESIGNS, Math.max(1, Number(payload.designCount) || schedule.designCount || ARTISAN_MAX_DESIGNS));
        schedule.skipStoreSetup = payload.skipStoreSetup === true;
        schedule.started = true;
        schedule.paused = false;
        schedule.automationEnabled = true;
        schedule.groupId = group.groupId;
        schedule.ghostPort = GHOST_PORT;
        schedule.retryCount = 0;
        schedule.lastError = null;
        schedule.uploadsCompleted = schedule.uploadsCompleted || 0;

        schedule.storeProfileTitle = storeProfile?.title || schedule.storeProfileTitle || '';
        await saveSchedule(email, schedule, {
            immediate: true,
            lastEvent: `🚀 بدأت الأتمتة — «${schedule.storeProfileTitle || '—'}»`,
        });
        scheduleLog(
            email,
            `🚀 بدأت الأتمتة — «${schedule.storeProfileTitle || '—'}» | ${group.designs.length} تصاميم | Ghost ${GHOST_PORT}`,
            'success'
        );
        if (!payload.skipStoreSetup && storeProfile?.title) {
            scheduleLog(email, `📋 سيُطبَّق ملف المتجر ثم رفع ${group.designs.length} تصميم حسب خطة Artisan`, 'info');
        }

        const nextPhase = nextPendingDesignPhase(schedule);
        const foundationPhase = schedule.phases?.find((p) => p.id === 'foundation');
        const runNow = foundationPhase?.status !== 'done';
        await scheduleAlarm(email, runNow ? 5000 : computeNextUploadMs(schedule, nextPhase));

        return { success: true, email, schedule, groupId: group.groupId };
    }

    async function pauseAutomation(email) {
        const schedule = await loadSchedule(email);
        if (!schedule) return { success: false, error: 'schedule_not_found' };
        schedule.paused = true;
        await saveSchedule(email, schedule, { immediate: true, lastEvent: '⏸️ الجدولة متوقفة مؤقتاً' });
        await clearAlarm(email);
        scheduleLog(email, '⏸️ الجدولة متوقفة مؤقتاً', 'warn');
        return { success: true, schedule };
    }

    async function resumeAutomation(email) {
        const schedule = await loadSchedule(email);
        if (!schedule?.started) return { success: false, error: 'schedule_not_started' };
        schedule.paused = false;
        schedule.automationEnabled = true;
        schedule.currentDay = calendarDayFromSchedule({ ...schedule, paused: false });
        await saveSchedule(email, schedule, { immediate: true, lastEvent: '▶️ استئناف الجدولة' });
        const nextPhase = nextPendingDesignPhase(schedule);
        await scheduleAlarm(email, computeNextUploadMs(schedule, nextPhase));
        scheduleLog(email, '▶️ استئناف الجدولة', 'info');
        return { success: true, schedule };
    }

    async function resetAutomation(email) {
        await clearAlarm(email);
        const key = scheduleStorageKey(email);
        await chrome.storage.local.remove(key);
        queueScheduleSync(email, '↺ تم إعادة ضبط الجدولة', { immediate: true, cleared: true });
        scheduleLog(email, '↺ تم إعادة ضبط الجدولة', 'warn');
        return { success: true };
    }

    async function getScheduleStatus(email) {
        const schedule = email ? await loadSchedule(email) : null;
        const ghostOnline = await pingGhostServer(GHOST_PORT);
        let quintet = null;
        let storeProfile = null;
        if (email) {
            quintet = await getCompleteGroupForAccount(email);
            storeProfile = await loadStoreProfile(email);
        }
        return {
            success: true,
            schedule,
            ghostOnline,
            ghostPort: GHOST_PORT,
            hasQuintet: !!quintet,
            groupId: quintet?.groupId || schedule?.groupId || null,
            quintetDesignCount: quintet?.designs?.length || 0,
            hasStoreProfile: !!(storeProfile?.title),
            storeProfileTitle: storeProfile?.title || schedule?.storeProfileTitle || null,
        };
    }

    async function handleAction(request) {
        const action = request?.action;
        const email = String(request?.accountEmail || request?.email || '').trim();

        if (action === 'CREATY_SCHEDULE_START') {
            return startAutomation(request);
        }
        if (action === 'CREATY_SCHEDULE_BATCH_START') {
            return startBatchAutomation(request);
        }
        if (action === 'CREATY_SCHEDULE_LIST_READY') {
            const limit = Math.min(50, Math.max(1, Number(request?.limit) || 50));
            const activated = await listActivatedAccounts();
            let quintetOnly = 0;
            let storeOnly = 0;
            const ready = [];
            for (const acc of activated) {
                const email = String(acc.email).trim();
                const check = await assessAccountScheduleReadiness(email, { strictStore: true });
                if (check.hasQuintet && !check.hasStore) quintetOnly += 1;
                if (check.hasStore && !check.hasQuintet) storeOnly += 1;
                if (check.ok) ready.push(check);
                if (ready.length >= limit) break;
            }
            return {
                success: true,
                accounts: ready.map((r) => ({
                    email: r.email,
                    niche: r.niche,
                    storeTitle: r.storeProfile?.title || '',
                    quintetCount: r.quintet?.designs?.length || 0,
                })),
                count: ready.length,
                stats: {
                    activated: activated.length,
                    ready: ready.length,
                    quintetOnly,
                    storeOnly,
                },
            };
        }
        if (action === 'CREATY_SCHEDULE_ADVANCE') {
            return advanceSchedulePhase(email, request);
        }
        if (action === 'CREATY_SCHEDULE_PAUSE') {
            return pauseAutomation(email);
        }
        if (action === 'CREATY_SCHEDULE_RESUME') {
            return resumeAutomation(email);
        }
        if (action === 'CREATY_SCHEDULE_RESET') {
            return resetAutomation(email);
        }
        if (action === 'CREATY_SCHEDULE_TICK') {
            await tickSchedule(email);
            return { success: true };
        }
        if (action === 'CREATY_SCHEDULE_STATUS') {
            return getScheduleStatus(email);
        }
        return null;
    }

    function onAlarm(alarm) {
        const name = String(alarm?.name || '');
        if (!name.startsWith(ALARM_PREFIX)) return;
        const safeEmail = name.slice(ALARM_PREFIX.length).replace(/_/g, (m, offset, str) => {
            const parts = str.split('_');
            return m;
        });
        void (async () => {
            const all = await chrome.storage.local.get(null);
            for (const [key, schedule] of Object.entries(all)) {
                if (!key.startsWith(SCHEDULE_KEY_PREFIX)) continue;
                const email = schedule?.accountEmail;
                if (!email) continue;
                if (alarmNameForEmail(email) === name) {
                    await tickSchedule(email);
                    break;
                }
            }
        })();
    }

    function init() {
        chrome.alarms.onAlarm.addListener(onAlarm);
        restoreActiveAlarms().catch(() => { });

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            for (const key of Object.keys(changes)) {
                if (!key.startsWith(SCHEDULE_KEY_PREFIX)) continue;
                const email = changes[key]?.newValue?.accountEmail;
                if (email) queueScheduleSync(email);
            }
        });
    }

    global.CreatyUploadScheduler = {
        init,
        handleAction,
        tickSchedule,
        pingGhostServer,
        getScheduleStatus,
        validateStartPayload,
        loadStoreProfile,
        loadAccountBundle: buildAccountBundle,
        buildAccountBundle,
        applyStoreProfileViaGhost,
        listReadyAccountsForSchedule,
        listActivatedAccounts,
        assessAccountScheduleReadiness,
        resolveBatchTargets,
        startBatchAutomation,
        findQuintetForAccount,
        getCompleteGroupForAccount,
        assignUnassignedQuintetToAccount,
        getDesignBlob,
        loadSchedule,
        advanceSchedulePhase,
        scheduleStorageKey,
        GHOST_PORT,
    };
})(typeof self !== 'undefined' ? self : globalThis);
