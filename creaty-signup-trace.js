/**
 * Structured signup pipeline trace — shared by Creaty Server (Node) and extension (importScripts).
 * Enable: CREATY_SIGNUP_TRACE=1 (server) or chrome.storage.local.creatySignupTrace=true (extension UI).
 * Disable: CREATY_SIGNUP_TRACE=0
 */
(function initCreatySignupTrace(root) {
    const SIGNUP_TRACE_ENV = String(
        (typeof process !== 'undefined' && process.env && process.env.CREATY_SIGNUP_TRACE) || ''
    ).trim().toLowerCase();

    function isSignupTraceEnabled() {
        if (SIGNUP_TRACE_ENV === '0' || SIGNUP_TRACE_ENV === 'false' || SIGNUP_TRACE_ENV === 'off') {
            return false;
        }
        if (SIGNUP_TRACE_ENV === '1' || SIGNUP_TRACE_ENV === 'true' || SIGNUP_TRACE_ENV === 'on') {
            return true;
        }
        return true;
    }

    function maskToken(token) {
        const value = String(token || '').trim();
        if (!value) return '';
        if (value.length <= 8) return '***';
        return `${value.slice(0, 4)}…${value.slice(-4)}`;
    }

    function pickTraceFields(payload = {}) {
        const email = String(payload.email || payload.display_email || '').trim();
        const password = String(payload.password || payload.pass || '');
        return {
            firstName: String(payload.firstName || payload.first_name || '').trim(),
            lastName: String(payload.lastName || payload.last_name || '').trim(),
            email,
            passwordLen: password.length,
            storeName: String(payload.storeName || payload.store_name || payload.nickname || '').trim(),
            sessionId: String(payload.sessionId || payload.id || payload.emailcoreSessionId || '').trim(),
            token: maskToken(payload.token),
            userId: String(payload.userId || '').trim(),
            apiBase: String(payload.apiBase || '').replace(/\/+$/, ''),
            httpStatus: payload.httpStatus ?? payload.status ?? '',
            responseSnippet: String(payload.responseSnippet || payload.error || payload.message || '').slice(0, 180),
            expectedSessionId: String(payload.expectedSessionId || '').trim(),
            sentSessionId: String(payload.sentSessionId || payload.sessionId || payload.id || '').trim(),
        };
    }

    function formatSignupTraceLine(stage, payload = {}, extra = {}) {
        const fields = { ...pickTraceFields(payload), ...extra };
        const parts = [
            `stage=${String(stage || 'unknown')}`,
            `first=${fields.firstName || '—'}`,
            `last=${fields.lastName || '—'}`,
            `email=${fields.email || '—'}`,
            `pwLen=${fields.passwordLen || 0}`,
            `store=${fields.storeName || '—'}`,
            `sessionId=${fields.sessionId || '—'}`,
            `token=${fields.token || '—'}`,
            `userId=${fields.userId || '—'}`,
            `apiBase=${fields.apiBase || '—'}`,
        ];
        if (fields.httpStatus !== '' && fields.httpStatus != null) {
            parts.push(`http=${fields.httpStatus}`);
        }
        if (fields.responseSnippet) {
            parts.push(`resp=${fields.responseSnippet.replace(/\s+/g, ' ')}`);
        }
        if (fields.expectedSessionId) {
            parts.push(`expectedSessionId=${fields.expectedSessionId}`);
        }
        if (fields.sentSessionId && fields.sentSessionId !== fields.sessionId) {
            parts.push(`sentSessionId=${fields.sentSessionId}`);
        }
        return parts.join(' | ');
    }

    function traceSignupPipeline(stage, payload = {}, options = {}) {
        if (!isSignupTraceEnabled() && options.force !== true) return null;
        const line = formatSignupTraceLine(stage, payload, options.extra || {});
        const full = `[SIGNUP-TRACE] ${line}`;
        return {
            line,
            full,
            stage: String(stage || ''),
            fields: pickTraceFields(payload),
        };
    }

    const api = {
        isSignupTraceEnabled,
        maskToken,
        pickTraceFields,
        formatSignupTraceLine,
        traceSignupPipeline,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.CreatySignupTrace = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
