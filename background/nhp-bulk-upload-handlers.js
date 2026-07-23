/**
 * NHP bulk design upload — background handlers (independent from Prompt Bag).
 */
(function initNhpBulkUploadHandlers(globalScope) {
    const g = globalScope || (typeof self !== 'undefined' ? self : globalThis);
    if (g.__nhpBulkUploadHandlersReady) return;
    g.__nhpBulkUploadHandlersReady = true;

    const PROGRESS_KEY = 'nhp_bulk_upload_progress';

    async function patchProgress(patch) {
        const cur = await chrome.storage.local.get([PROGRESS_KEY]);
        const prev = (cur[PROGRESS_KEY] && typeof cur[PROGRESS_KEY] === 'object') ? cur[PROGRESS_KEY] : {};
        const stats = g.NhpUploadQueue ? await g.NhpUploadQueue.getQueueStats() : prev;
        const next = {
            ...prev,
            ...stats,
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        await chrome.storage.local.set({ [PROGRESS_KEY]: next });
        return next;
    }

    async function handleBulkUploadMessage(req) {
        const q = g.NhpUploadQueue;
        if (!q) {
            return { ok: false, error: 'Upload queue not loaded' };
        }

        const action = String(req?.action || req?.type || '').trim();

        if (action === 'NHP_BULK_UPLOAD_ENQUEUE' || action === 'NHP_BULK_UPLOAD_ENQUEUE_BATCH') {
            const items = action === 'NHP_BULK_UPLOAD_ENQUEUE_BATCH'
                ? (Array.isArray(req.items) ? req.items : [])
                : [req];
            const created = [];
            for (const item of items) {
                const job = await q.enqueueBulkUpload({
                    sourceUrl: item.sourceUrl || item.imageUrl || item.url,
                    blob: item.blob,
                    filename: item.filename || item.name,
                    mime: item.mime,
                    niche: item.niche || item.nicheName,
                    tags: item.tags,
                    pageUrl: item.pageUrl,
                    width: item.width,
                    height: item.height,
                });
                created.push({ id: job.id, status: job.status });
            }
            q.scheduleWorkerTick(0);
            const progress = await patchProgress({});
            return { ok: true, jobs: created, progress };
        }

        if (action === 'NHP_BULK_UPLOAD_STATUS') {
            const progress = await patchProgress({});
            return { ok: true, progress };
        }

        if (action === 'NHP_BULK_UPLOAD_PUMP') {
            await q.pumpWorker();
            const progress = await patchProgress({});
            return { ok: true, progress };
        }

        if (action === 'NHP_BULK_UPLOAD_CANCEL') {
            const id = String(req.jobId || req.id || '').trim();
            if (!id) return { ok: false, error: 'jobId required' };
            await q.cancelJob(id);
            const progress = await patchProgress({});
            return { ok: true, progress };
        }

        if (action === 'NHP_BULK_UPLOAD_CLEAR_COMPLETED') {
            const n = await q.clearCompleted();
            const progress = await patchProgress({});
            return { ok: true, cleared: n, progress };
        }

        return null;
    }

    g.handleNhpBulkUploadMessage = handleBulkUploadMessage;
    g.NHP_BULK_UPLOAD_PROGRESS_KEY = PROGRESS_KEY;

    if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
        chrome.runtime.onStartup.addListener(() => {
            if (g.NhpUploadQueue) g.NhpUploadQueue.scheduleWorkerTick(1000);
        });
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
        chrome.runtime.onInstalled.addListener(() => {
            if (g.NhpUploadQueue) g.NhpUploadQueue.scheduleWorkerTick(1000);
        });
    }
})(typeof self !== 'undefined' ? self : globalThis);
