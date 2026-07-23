/**
 * CREATY AI Supervisor bridge — polls Ghost journal + syncs chrome.storage.
 */
(function initCreatyAiSupervisorBridge(global) {
    'use strict';

    const STORAGE_KEY = 'creaty_supervisor_journal';
    const STATUS_KEY = 'creaty_supervisor_status';
    const POLL_MS = 6000;
    const SUPERVISOR_PORTS = [3019, 3024, 3020];

    let pollTimer = null;

    function localBaseUrl(port) {
        if (typeof NhpRuntimeConfig !== 'undefined') {
            return NhpRuntimeConfig.localUrl(port);
        }
        return `http://127.0.0.1:${port}`;
    }

    async function fetchServerJson(path, timeoutMs = 3500) {
        const results = [];
        for (let i = 0; i < SUPERVISOR_PORTS.length; i += 1) {
            const port = SUPERVISOR_PORTS[i];
            const base = localBaseUrl(port);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(`${base}${path}`, { signal: controller.signal });
                if (!res.ok) continue;
                const data = await res.json();
                results.push({ port, data });
            } catch (_) {
                /* try next port */
            } finally {
                clearTimeout(timer);
            }
        }
        return results;
    }

    function mergeJournalEntries(portResults) {
        const seen = new Set();
        const merged = [];
        portResults.forEach(({ data }) => {
            const rows = Array.isArray(data?.entries) ? data.entries : [];
            rows.forEach((row) => {
                const key = `${row.ts || ''}|${row.email || ''}|${row.step || ''}|${row.phase || ''}`;
                if (seen.has(key)) return;
                seen.add(key);
                merged.push(row);
            });
        });
        merged.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
        return merged.slice(0, 40);
    }

    function pickActiveStatus(portResults) {
        const active = portResults
            .map(({ port, data }) => ({ port, status: data?.status || {} }))
            .filter((row) => row.status?.active === true);
        if (active.length) return active[0];
        return portResults[0] || { port: 3020, status: {} };
    }

    async function syncSupervisorState() {
        const [journalResults, statusResults] = await Promise.all([
            fetchServerJson('/api/supervisor/journal?limit=40'),
            fetchServerJson('/api/supervisor/status'),
        ]);
        const entries = mergeJournalEntries(journalResults);
        const active = pickActiveStatus(statusResults);
        const status = active.status || {};
        await new Promise((resolve) => {
            chrome.storage.local.set({
                [STORAGE_KEY]: entries,
                [STATUS_KEY]: {
                    ...status,
                    syncedAt: new Date().toISOString(),
                    serverPort: active.port || 3020,
                    serverBase: localBaseUrl(active.port || 3020),
                },
            }, () => resolve());
        });
        try {
            chrome.runtime.sendMessage({
                type: 'creaty_supervisor_update',
                entries,
                status,
            }).catch(() => {});
        } catch (_) { /* ignore */ }
        return { entries, status };
    }

    function startSupervisorPoll() {
        if (pollTimer) return;
        void syncSupervisorState();
        pollTimer = setInterval(() => { void syncSupervisorState(); }, POLL_MS);
    }

    function stopSupervisorPoll() {
        if (!pollTimer) return;
        clearInterval(pollTimer);
        pollTimer = null;
    }

    global.CreatyAiSupervisorBridge = {
        STORAGE_KEY,
        STATUS_KEY,
        syncSupervisorState,
        startSupervisorPoll,
        stopSupervisorPoll,
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
