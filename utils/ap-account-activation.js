/**
 * TeePublic account activation classification for AUT / CREATY / Ghost upload.
 * Primary: local flags (tpActivated, creaty_phase, teepublic_status, activationOverride).
 */
(function initApAccountActivation(global) {
    'use strict';

    if (global.ApAccountActivation) return;

    const ARTISAN_DESIGN_THRESHOLD = 5;

    function normalizeStatus(acc) {
        return String(acc?.teepublic_status || acc?.tp_status || '').trim().toLowerCase();
    }

    function normalizePhase(acc) {
        return String(acc?.creaty_phase || '').trim().toUpperCase();
    }

    /**
     * @returns {'activated'|'not_activated'|'unknown'}
     */
    function getAutAccountActivationStatus(acc) {
        if (!acc || !String(acc.email || '').trim()) return 'unknown';

        const override = String(acc.activationOverride || '').trim().toLowerCase();
        if (override === 'activated') return 'activated';
        if (override === 'not_activated') return 'not_activated';

        const stored = String(acc.activationStatus || '').trim().toLowerCase();
        if (stored === 'activated' && acc.tpActivated === true && normalizePhase(acc) === 'DONE') {
            return 'activated';
        }

        const status = normalizeStatus(acc);
        const phase = normalizePhase(acc);
        const tpActivated = acc.tpActivated === true;

        if (tpActivated && phase === 'DONE' && status === 'active') return 'activated';
        if (tpActivated && phase === 'DONE') return 'activated';
        if (['active', 'artisan'].includes(status) && tpActivated) return 'activated';

        if (['failed', 'error', 'pending', 'pending_activation', 'awaiting_activation'].includes(status)) {
            return 'not_activated';
        }
        if (['PENDING', 'OPENING', 'WAIT_EMAIL', 'WAITING_EMAIL', 'ACTIVATING', 'FAILED', 'ERROR'].includes(phase)) {
            return 'not_activated';
        }
        if (phase === 'SKIPPED') {
            const reason = String(acc.skipReason || '').trim().toLowerCase();
            if (reason.includes('needs_activation') || reason.includes('no_activation_link')) {
                return 'not_activated';
            }
            if (reason.includes('already_activated')) return 'activated';
            if (!tpActivated && phase !== 'DONE') return 'not_activated';
        }

        return 'not_activated';
    }

    function isAutAccountActivated(acc) {
        return getAutAccountActivationStatus(acc) === 'activated';
    }

    function getAccountDesignUploadCount(acc) {
        const candidates = [
            acc?.stats?.uploaded,
            acc?.designsUploaded,
            acc?.uploadedCount,
            acc?.totalDesignsUploaded,
            acc?.designs_done,
        ];
        for (const value of candidates) {
            const n = Number(value);
            if (Number.isFinite(n) && n >= 0) return n;
        }
        return 0;
    }

    /**
     * Account lifecycle tab status for AUT / CREATY lists.
     * @returns {'inactive'|'active'|'artisan'}
     */
    function deriveAccountStatus(acc) {
        if (!acc || typeof acc !== 'object') return 'inactive';

        const status = normalizeStatus(acc);
        const uploads = getAccountDesignUploadCount(acc);

        if (
            uploads >= ARTISAN_DESIGN_THRESHOLD
            || acc.is_artisan === true
            || status === 'artisan'
            || acc.groupId === 'g_artisan'
            || acc.artisan_detected_at
        ) {
            return 'artisan';
        }

        if (status === 'deactivated' || status === 'disabled' || acc.deactivated === true) {
            return 'inactive';
        }

        if (isAutAccountActivated(acc)) return 'active';
        if (['active', 'registered', 'signup_complete'].includes(status)) return 'active';

        return 'inactive';
    }

    function buildActivationStoragePatch(acc, extraPatch = {}) {
        const merged = { ...(acc || {}), ...(extraPatch || {}) };
        const activationStatus = getAutAccountActivationStatus(merged);
        return {
            ...extraPatch,
            activationStatus,
            activationSyncedAt: new Date().toISOString(),
        };
    }

    function activationBadgeMeta(acc, lang = 'ar') {
        const isEn = String(lang || '').toLowerCase().startsWith('en');
        const status = getAutAccountActivationStatus(acc);
        if (status === 'activated') {
            return {
                status,
                emoji: '🟢',
                label: isEn ? 'Activated' : 'مفعّل',
                cssClass: 'ap-act-badge--on',
            };
        }
        return {
            status: status === 'unknown' ? 'not_activated' : status,
            emoji: '🔴',
            label: isEn ? 'Not activated' : 'غير مفعل',
            cssClass: 'ap-act-badge--off',
        };
    }

    global.ApAccountActivation = {
        getAutAccountActivationStatus,
        isAutAccountActivated,
        deriveAccountStatus,
        getAccountDesignUploadCount,
        ARTISAN_DESIGN_THRESHOLD,
        buildActivationStoragePatch,
        activationBadgeMeta,
    };
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : window);
