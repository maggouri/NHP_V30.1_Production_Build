/**
 * AUT upload monitor — run log + fail-soft counters for Autopilot uploads.
 * Shared shape used by background (chrome.storage) and AUT UI.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.NhpApUploadMonitor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STORAGE_KEY = 'ap_upload_monitor_log';
    const MAX_ITEMS = 400;
    const MAX_NOTES = 200;

    function nowIso() {
        return new Date().toISOString();
    }

    function emptyCounts() {
        return { ok: 0, skipped_failed: 0, corrected: 0 };
    }

    function createRun(meta = {}) {
        return {
            runId: `apmon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            startedAt: nowIso(),
            finishedAt: null,
            platform: meta.platform || 'teepublic',
            isRetry: !!meta.isRetry,
            continueOnError: true,
            counts: emptyCounts(),
            items: [],
            notes: [{
                at: nowIso(),
                source: 'monitor',
                text: 'بدأ مراقب الرفع — وضع الاستمرار عند الفشل مفعّل (لن يوقف الدفعة بسبب عنصر واحد).'
            }]
        };
    }

    function appendNote(run, text, source = 'monitor') {
        if (!run || !text) return run;
        run.notes = Array.isArray(run.notes) ? run.notes : [];
        run.notes.push({ at: nowIso(), source: source || 'monitor', text: String(text).slice(0, 500) });
        if (run.notes.length > MAX_NOTES) run.notes = run.notes.slice(-MAX_NOTES);
        return run;
    }

    function upsertItem(run, item) {
        if (!run || !item) return run;
        run.items = Array.isArray(run.items) ? run.items : [];
        const id = String(item.queueItemId || item.id || '');
        const accountId = String(item.accountId || '');
        const idx = run.items.findIndex((row) =>
            String(row.queueItemId || '') === id && String(row.accountId || '') === accountId
        );
        const next = {
            ...(idx >= 0 ? run.items[idx] : {}),
            ...item,
            queueItemId: id,
            accountId,
            updatedAt: nowIso()
        };
        if (idx >= 0) run.items[idx] = next;
        else run.items.push(next);
        if (run.items.length > MAX_ITEMS) run.items = run.items.slice(-MAX_ITEMS);
        return run;
    }

    function recomputeCounts(run) {
        const counts = emptyCounts();
        for (const item of (run?.items || [])) {
            const status = String(item.status || '').toLowerCase();
            if (status === 'upload_ok' || status === 'published' || status === 'uploaded' || status === 'ok') {
                counts.ok += 1;
                if (item.corrected || item.colorsStatus === 'corrected') counts.corrected += 1;
            } else if (status === 'failed' || status === 'skipped_failed' || status === 'colors_failed') {
                counts.skipped_failed += 1;
            } else if (status === 'corrected') {
                counts.ok += 1;
                counts.corrected += 1;
            }
        }
        if (run) run.counts = counts;
        return counts;
    }

    function finalizeRun(run, extraNote) {
        if (!run) return run;
        recomputeCounts(run);
        run.finishedAt = nowIso();
        if (extraNote) appendNote(run, extraNote, 'monitor');
        appendNote(
            run,
            `انتهى المراقب | نجاح=${run.counts.ok} | متخطى/فاشل=${run.counts.skipped_failed} | مُصحَّح=${run.counts.corrected}`,
            'monitor'
        );
        return run;
    }

    function summarizeFailuresRuleBased(run) {
        const failed = (run?.items || []).filter((item) => {
            const s = String(item.status || '').toLowerCase();
            return s === 'failed' || s === 'skipped_failed' || s === 'colors_failed';
        });
        if (!failed.length) return 'لا توجد عناصر فاشلة في آخر تشغيل.';
        const byReason = {};
        for (const item of failed) {
            let key = String(item.reason || item.error || 'سبب غير معروف').slice(0, 120);
            if (/primary\s*color\s*for\s*bags|bags?\s*primary/i.test(key)) {
                key = 'primary color for bags (needs bags/totes color)';
            }
            byReason[key] = (byReason[key] || 0) + 1;
        }
        const top = Object.entries(byReason)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([reason, n]) => `${n}× ${reason}`)
            .join(' | ');
        return `ملخص قواعدي للفشل (${failed.length}): ${top}`;
    }

    function isBagsPrimaryColorIssue(text) {
        return /primary\s*color\s*for\s*bags|choose\s+a\s+primary\s+color.*bag/i.test(String(text || ''));
    }

    function formatCountsLabel(counts) {
        const c = counts || emptyCounts();
        return `✓ ${c.ok || 0} | ✎ ${c.corrected || 0} | ⏭ ${c.skipped_failed || 0}`;
    }

    return {
        STORAGE_KEY,
        createRun,
        appendNote,
        upsertItem,
        recomputeCounts,
        finalizeRun,
        summarizeFailuresRuleBased,
        formatCountsLabel,
        emptyCounts,
        isBagsPrimaryColorIssue
    };
});
