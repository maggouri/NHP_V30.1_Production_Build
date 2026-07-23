/**
 * NHP bulk design upload queue — durable IndexedDB jobs (MV3 service worker safe).
 * Independent from Prompt Bag (chrome.storage.local). Binary Blob upload, no Base64.
 */
(function initNhpUploadQueue(globalScope) {
    const g = globalScope || (typeof self !== 'undefined' ? self : globalThis);
    if (g.NhpUploadQueue) return;

    const DB_NAME = 'NHP_UploadQueue_DB';
    const DB_VERSION = 1;
    const STORE = 'jobs';
    const ALARM_NAME = 'nhp_bulk_upload_tick';
    const MAX_CONCURRENT_UPLOADS = 3;
    const RETRY_DELAYS_MS = [0, 2000, 5000, 15000, 60000];
    const STATUSES = Object.freeze({
        pending: 'pending',
        fetching: 'fetching',
        ready: 'ready',
        uploading: 'uploading',
        verifying: 'verifying',
        completed: 'completed',
        retry_wait: 'retry_wait',
        failed: 'failed',
        cancelled: 'cancelled',
    });

    let dbPromise = null;
    let workerRunning = false;
    let activeCount = 0;

    function jitter(ms) {
        const spread = Math.floor(ms * 0.15);
        return ms + Math.floor(Math.random() * spread);
    }

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'id' });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
        });
        return dbPromise;
    }

    async function withStore(mode, fn) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const store = tx.objectStore(STORE);
            Promise.resolve(fn(store))
                .then((result) => {
                    tx.oncomplete = () => resolve(result);
                    tx.onerror = () => reject(tx.error);
                })
                .catch(reject);
        });
    }

    function newJobId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    async function putJob(job) {
        return withStore('readwrite', (store) => {
            store.put(job);
        });
    }

    async function getJob(id) {
        return withStore('readonly', (store) => new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    }

    async function listJobs(filterStatus) {
        return withStore('readonly', (store) => new Promise((resolve, reject) => {
            const out = [];
            const req = store.openCursor();
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) return resolve(out);
                const row = cursor.value;
                if (!filterStatus || row.status === filterStatus) out.push(row);
                cursor.continue();
            };
            req.onerror = () => reject(req.error);
        }));
    }

    async function getQueueStats() {
        const jobs = await listJobs();
        const stats = {
            total: jobs.length,
            pending: 0,
            active: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
        };
        for (const j of jobs) {
            if (j.status === STATUSES.completed) stats.completed += 1;
            else if (j.status === STATUSES.failed) stats.failed += 1;
            else if (j.status === STATUSES.cancelled) stats.cancelled += 1;
            else if ([STATUSES.uploading, STATUSES.fetching, STATUSES.verifying, STATUSES.ready].includes(j.status)) {
                stats.active += 1;
            } else stats.pending += 1;
        }
        return stats;
    }

    async function enqueueBulkUpload(input = {}) {
        const now = new Date().toISOString();
        const job = {
            id: newJobId(),
            sourceUrl: String(input.sourceUrl || '').trim(),
            blob: input.blob instanceof Blob ? input.blob : null,
            filename: String(input.filename || 'design.png').trim(),
            mime: String(input.mime || 'image/png').trim(),
            niche: input.niche != null ? String(input.niche).trim() : '',
            tags: input.tags != null ? String(input.tags).trim() : '',
            objectKey: '',
            uploadId: '',
            status: input.blob instanceof Blob ? STATUSES.ready : STATUSES.pending,
            attempts: 0,
            uploadedBytes: 0,
            sha256: '',
            width: input.width != null ? Number(input.width) : null,
            height: input.height != null ? Number(input.height) : null,
            createdAt: now,
            updatedAt: now,
            lastError: '',
        };
        if (!job.sourceUrl && !(job.blob instanceof Blob)) {
            throw new Error('enqueueBulkUpload requires sourceUrl or blob');
        }
        await putJob(job);
        scheduleWorkerTick(0);
        return job;
    }

    async function updateJob(id, patch) {
        const cur = await getJob(id);
        if (!cur) return null;
        const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
        await putJob(next);
        return next;
    }

    async function sha256Blob(blob) {
        const buf = await blob.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    function scheduleWorkerTick(delayMs) {
        if (typeof chrome === 'undefined' || !chrome.alarms) return;
        const when = Date.now() + Math.max(0, Number(delayMs) || 0);
        chrome.alarms.create(ALARM_NAME, { when });
    }

    async function readEmailCoreAuth() {
        if (typeof g.readEmailCoreAuth === 'function') {
            return g.readEmailCoreAuth();
        }
        const keys = [
            'emailcore_session_token',
            'emailcore_creaty_api_base',
            'emailcore_session_user_id',
            'emailcore_creaty_token',
            'emailcore_creaty_user_id',
        ];
        const stored = await chrome.storage.local.get(keys);
        const sessionToken = stored.emailcore_session_token || stored.emailcore_creaty_token || '';
        const apiBase = String(stored.emailcore_creaty_api_base || 'https://emailcore.app').replace(/\/+$/, '');
        return {
            apiBase,
            sessionToken,
            userId: stored.emailcore_session_user_id || stored.emailcore_creaty_user_id || '',
        };
    }

    function authHeaders(sessionToken) {
        const headers = { 'content-type': 'application/json' };
        if (!sessionToken) return headers;
        if (String(sessionToken).includes('.')) {
            headers['x-extension-session'] = sessionToken;
        } else {
            headers['x-creaty-token'] = sessionToken;
        }
        return headers;
    }

    async function apiPost(auth, path, body) {
        const url = `${auth.apiBase}${path}`;
        const headers = authHeaders(auth.sessionToken);
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `HTTP ${res.status}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    function proxyImageUrl(auth, sourceUrl, pageUrl) {
        const u = new URL(`${auth.apiBase}/api/admin/nhp/design-images/proxy-image`);
        u.searchParams.set('url', sourceUrl);
        if (pageUrl) u.searchParams.set('pageUrl', pageUrl);
        return u.toString();
    }

    function needsProxyFetch(url) {
        const s = String(url || '').toLowerCase();
        return /amazon\.|googleusercontent|redbubble|etsy|pinterest/.test(s);
    }

    async function fetchJobBlob(job, auth) {
        if (job.blob instanceof Blob) return job.blob;
        const sourceUrl = job.sourceUrl;
        if (!sourceUrl) throw new Error('Missing sourceUrl');

        if (needsProxyFetch(sourceUrl)) {
            const fetchFn = typeof g.fetchImageAsDataUrlFromCandidates === 'function'
                ? g.fetchImageAsDataUrlFromCandidates
                : null;
            if (fetchFn) {
                const fetched = await fetchFn([sourceUrl], job.pageUrl || sourceUrl);
                const dataUrl = fetched?.dataUrl || '';
                const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
                if (!match) throw new Error('Extension fetch returned invalid dataUrl');
                const bin = atob(match[2]);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
                return new Blob([bytes], { type: match[1] || job.mime });
            }

            const headers = authHeaders(auth.sessionToken);
            const res = await fetch(proxyImageUrl(auth, sourceUrl, job.pageUrl || ''), { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.dataUrl) {
                throw new Error(data.error || 'Proxy fetch failed');
            }
            const match = String(data.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
            if (!match) throw new Error('Invalid proxy dataUrl');
            const bin = atob(match[2]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: match[1] || job.mime });
        }

        const res = await fetch(sourceUrl, { credentials: 'omit' });
        if (!res.ok) throw new Error(`Fetch failed HTTP ${res.status}`);
        return res.blob();
    }

    async function processJob(job, auth) {
        let working = { ...job };
        try {
            if (!working.blob) {
                working = await updateJob(working.id, { status: STATUSES.fetching, lastError: '' });
                const blob = await fetchJobBlob(working, auth);
                working = await updateJob(working.id, {
                    blob,
                    mime: blob.type || working.mime,
                    status: STATUSES.ready,
                });
            }

            if (!working.sha256) {
                working.sha256 = await sha256Blob(working.blob);
                working = await updateJob(working.id, { sha256: working.sha256 });
            }

            working = await updateJob(working.id, { status: STATUSES.uploading, lastError: '' });

            const create = await apiPost(auth, '/api/admin/nhp/uploads/create', {
                filename: working.filename,
                mime: working.mime || working.blob.type || 'image/png',
                size: working.blob.size,
                sha256: working.sha256,
                niche: working.niche || undefined,
                tags: working.tags || undefined,
            });

            working = await updateJob(working.id, {
                uploadId: create.uploadId,
                objectKey: create.objectKey,
            });

            const putHeaders = { ...(create.headers || {}) };
            if (!putHeaders['Content-Type'] && working.mime) {
                putHeaders['Content-Type'] = working.mime;
            }

            const putRes = await fetch(create.uploadUrl, {
                method: create.method || 'PUT',
                headers: putHeaders,
                body: working.blob,
            });
            const putData = await putRes.json().catch(() => ({}));
            if (!putRes.ok) {
                throw new Error(putData.error || `PUT failed HTTP ${putRes.status}`);
            }

            working = await updateJob(working.id, {
                status: STATUSES.verifying,
                uploadedBytes: working.blob.size,
            });

            await apiPost(auth, '/api/admin/nhp/uploads/complete', {
                uploadId: create.uploadId,
                objectKey: create.objectKey,
                sha256: working.sha256,
                width: working.width,
                height: working.height,
            });

            await updateJob(working.id, {
                status: STATUSES.completed,
                blob: null,
                lastError: '',
            });
            return true;
        } catch (err) {
            const attempts = (working.attempts || 0) + 1;
            const maxAttempts = RETRY_DELAYS_MS.length;
            const delay = attempts < maxAttempts ? jitter(RETRY_DELAYS_MS[attempts]) : null;
            const status = delay != null ? STATUSES.retry_wait : STATUSES.failed;
            await updateJob(working.id, {
                status,
                attempts,
                lastError: String(err?.message || err),
                blob: working.blob instanceof Blob ? working.blob : null,
            });
            if (delay != null) scheduleWorkerTick(delay);
            return false;
        }
    }

    async function pumpWorker() {
        if (workerRunning) return;
        workerRunning = true;
        try {
            const auth = await readEmailCoreAuth();
            if (!auth.sessionToken) return;

            while (activeCount < MAX_CONCURRENT_UPLOADS) {
                const jobs = await listJobs();
                const candidate = jobs.find((j) =>
                    j.status === STATUSES.pending
                    || j.status === STATUSES.ready
                    || j.status === STATUSES.retry_wait
                );
                if (!candidate) break;

                await updateJob(candidate.id, {
                    status: candidate.status === STATUSES.retry_wait ? STATUSES.pending : candidate.status,
                });

                activeCount += 1;
                processJob(candidate, auth)
                    .finally(() => {
                        activeCount -= 1;
                        scheduleWorkerTick(250);
                    });
            }
        } finally {
            workerRunning = false;
        }
    }

    async function cancelJob(id) {
        return updateJob(id, { status: STATUSES.cancelled, blob: null });
    }

    async function clearCompleted() {
        const jobs = await listJobs(STATUSES.completed);
        for (const j of jobs) {
            await withStore('readwrite', (store) => store.delete(j.id));
        }
        return jobs.length;
    }

    function installAlarmListener() {
        if (typeof chrome === 'undefined' || !chrome.alarms?.onAlarm) return;
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === ALARM_NAME) pumpWorker().catch(() => {});
        });
    }

    installAlarmListener();

    g.NhpUploadQueue = {
        DB_NAME,
        STATUSES,
        MAX_CONCURRENT_UPLOADS,
        ALARM_NAME,
        enqueueBulkUpload,
        getQueueStats,
        listJobs,
        getJob,
        cancelJob,
        clearCompleted,
        pumpWorker,
        scheduleWorkerTick,
    };
})(typeof self !== 'undefined' ? self : globalThis);
