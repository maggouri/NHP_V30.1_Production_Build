/**
 * USPTO batch queue persistence — survives pause/resume and MV3 SW restarts.
 * Pure merge helpers are testable without chrome.* APIs.
 */
(function (global) {
    'use strict';

    global.USPTO_BATCH_SNAPSHOT_KEY = 'usptoBatchSnapshot';
    global.USPTO_IN_FLIGHT_KEY = 'uInFlight';

    global.mergeUsptoRequeueNiches = function mergeUsptoRequeueNiches({
        pending = [],
        inFlight = [],
        current = '',
        safe = [],
        banned = [],
        errors = []
    } = {}) {
        const pendingList = Array.isArray(pending) ? [...pending] : [];
        const doneKeys = new Set(
            [...(safe || []), ...(banned || []), ...(errors || [])]
                .map((item) => global.normalizeNicheKey(item))
                .filter(Boolean)
        );
        const pendingKeys = new Set(pendingList.map((item) => global.normalizeNicheKey(item)).filter(Boolean));
        const requeue = [];

        for (const raw of [...(inFlight || []), current]) {
            const niche = String(raw || '').trim();
            if (!niche) continue;
            const key = global.normalizeNicheKey(niche);
            if (!key || doneKeys.has(key) || pendingKeys.has(key)) continue;
            if (requeue.some((item) => global.normalizeNicheKey(item) === key)) continue;
            requeue.push(niche);
            pendingKeys.add(key);
        }

        return [...requeue, ...pendingList];
    };

    global.buildUsptoBatchSnapshot = function buildUsptoBatchSnapshot(data = {}) {
        const pending = Array.isArray(data.uPending) ? data.uPending : [];
        const inFlight = Array.isArray(data.uInFlight) ? data.uInFlight : [];
        return {
            version: 1,
            pending: [...pending],
            inFlight: [...inFlight],
            safe: Array.isArray(data.uSafe) ? [...data.uSafe] : [],
            banned: Array.isArray(data.uBanned) ? [...data.uBanned] : [],
            errors: Array.isArray(data.uErrors) ? [...data.uErrors] : [],
            total: Number(data.uTotal || 0),
            current: data.uCurrent || null,
            paused: data.uPaused === true,
            updatedAt: new Date().toISOString()
        };
    };

    global.snapshotPendingCount = function snapshotPendingCount(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return 0;
        const pending = Array.isArray(snapshot.pending) ? snapshot.pending.length : 0;
        const inFlight = Array.isArray(snapshot.inFlight) ? snapshot.inFlight.length : 0;
        return pending + inFlight;
    };

    global.persistUsptoBatchSnapshot = async function persistUsptoBatchSnapshot(reason = 'sync') {
        const data = await global.getStorage([
            'uPending',
            global.USPTO_IN_FLIGHT_KEY,
            'uCurrent',
            'uSafe',
            'uBanned',
            'uErrors',
            'uTotal',
            'uPaused'
        ]);
        const pending = Array.isArray(data.uPending) ? data.uPending : [];
        const inFlight = Array.isArray(data[global.USPTO_IN_FLIGHT_KEY]) ? data[global.USPTO_IN_FLIGHT_KEY] : [];
        const snapshot = global.buildUsptoBatchSnapshot(data);

        if (!pending.length && !inFlight.length && !data.uPaused) {
            await global.setStorage({
                [global.USPTO_BATCH_SNAPSHOT_KEY]: null,
                usptoBatchSnapshotReason: reason
            });
            return null;
        }

        await global.setStorage({
            [global.USPTO_BATCH_SNAPSHOT_KEY]: snapshot,
            usptoBatchSnapshotReason: reason
        });
        return snapshot;
    };

    global.requeueUsptoInFlightForPause = async function requeueUsptoInFlightForPause() {
        const data = await global.getStorage([
            'uPending',
            global.USPTO_IN_FLIGHT_KEY,
            'uCurrent',
            'uSafe',
            'uBanned',
            'uErrors',
            'uTotal'
        ]);
        const mergedPending = global.mergeUsptoRequeueNiches({
            pending: data.uPending || [],
            inFlight: data[global.USPTO_IN_FLIGHT_KEY] || [],
            current: data.uCurrent || '',
            safe: data.uSafe || [],
            banned: data.uBanned || [],
            errors: data.uErrors || []
        });

        await global.setStorage({
            uPending: mergedPending,
            [global.USPTO_IN_FLIGHT_KEY]: [],
            uCurrent: null
        });
        await global.persistUsptoBatchSnapshot('pause');
        return mergedPending;
    };

    global.restoreUsptoQueueFromSnapshot = async function restoreUsptoQueueFromSnapshot() {
        const data = await global.getStorage([
            'uPending',
            global.USPTO_IN_FLIGHT_KEY,
            global.USPTO_BATCH_SNAPSHOT_KEY,
            'uPaused',
            'uTotal',
            'uSafe',
            'uBanned',
            'uErrors'
        ]);
        const pending = Array.isArray(data.uPending) ? data.uPending : [];
        const inFlight = Array.isArray(data[global.USPTO_IN_FLIGHT_KEY]) ? data[global.USPTO_IN_FLIGHT_KEY] : [];
        if (pending.length || inFlight.length) {
            return { restored: false, pending: pending.length + inFlight.length };
        }

        const snapshot = data[global.USPTO_BATCH_SNAPSHOT_KEY];
        const snapPending = Array.isArray(snapshot?.pending) ? snapshot.pending : [];
        const snapInFlight = Array.isArray(snapshot?.inFlight) ? snapshot.inFlight : [];
        const merged = global.mergeUsptoRequeueNiches({
            pending: snapPending,
            inFlight: snapInFlight,
            current: snapshot?.current || '',
            safe: snapshot?.safe || data.uSafe || [],
            banned: snapshot?.banned || data.uBanned || [],
            errors: snapshot?.errors || data.uErrors || []
        });
        if (!merged.length) {
            return { restored: false, pending: 0 };
        }

        const update = {
            uPending: merged,
            [global.USPTO_IN_FLIGHT_KEY]: [],
            uCurrent: null
        };
        if (!Number(data.uTotal) && snapshot?.total) update.uTotal = snapshot.total;
        await global.setStorage(update);
        await global.persistUsptoBatchSnapshot('restore');
        return { restored: true, pending: merged.length };
    };

    global.addUsptoInFlightNiche = async function addUsptoInFlightNiche(niche) {
        const clean = String(niche || '').trim();
        if (!clean) return;
        const data = await global.getStorage([global.USPTO_IN_FLIGHT_KEY]);
        const inFlight = Array.isArray(data[global.USPTO_IN_FLIGHT_KEY]) ? [...data[global.USPTO_IN_FLIGHT_KEY]] : [];
        const key = global.normalizeNicheKey(clean);
        if (!key || inFlight.some((item) => global.normalizeNicheKey(item) === key)) return;
        inFlight.push(clean);
        await global.setStorage({ [global.USPTO_IN_FLIGHT_KEY]: inFlight });
    };

    global.removeUsptoInFlightNiche = async function removeUsptoInFlightNiche(niche) {
        const key = global.normalizeNicheKey(niche);
        if (!key) return;
        const data = await global.getStorage([global.USPTO_IN_FLIGHT_KEY]);
        const inFlight = Array.isArray(data[global.USPTO_IN_FLIGHT_KEY]) ? data[global.USPTO_IN_FLIGHT_KEY] : [];
        const next = inFlight.filter((item) => global.normalizeNicheKey(item) !== key);
        if (next.length !== inFlight.length) {
            await global.setStorage({ [global.USPTO_IN_FLIGHT_KEY]: next });
        }
    };

    global.primeUsptoQueueRecovery = async function primeUsptoQueueRecovery() {
        try {
            const restored = await global.restoreUsptoQueueFromSnapshot();
            if (restored.restored) {
                console.log(`[USPTO] Restored ${restored.pending} pending niche(s) from batch snapshot`);
            }
        } catch (error) {
            console.warn('[USPTO] queue recovery skipped:', error?.message || error);
        }
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
