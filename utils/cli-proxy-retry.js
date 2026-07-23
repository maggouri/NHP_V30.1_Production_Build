/**
 * CLI Proxy retry helpers — shared by background service worker (importScripts).
 */
(function (global) {
    'use strict';

    const RETRY = Object.freeze({
        INITIAL_DELAY_MS: 2500,
        MAX_DELAY_MS: 12000,
        BACKOFF_FACTOR: 1.45,
        REQUEST_TIMEOUT_MS: 300000,
        /** Studio rename: cap background retries so UI can fall back. */
        STUDIO_RENAME_MAX_ATTEMPTS: 4
    });

    function sleepMs(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isCliProxyHostBaseUrl(baseUrl) {
        return /127\.0\.0\.1:8317|localhost:8317|cliproxy-?api-ywrp\.onrender\.com/i.test(String(baseUrl || ''));
    }

    function isCliProxyRetryableFailure(errorMessage, httpStatus = 0) {
        const msg = String(errorMessage || '').toLowerCase();
        const status = Number(httpStatus) || 0;
        if (status === 502 || status === 503 || status === 504 || status === 408 || status === 429) return true;
        if (status >= 500) return true;
        if (/failed to fetch|networkerror|fetch failed|econnrefused|etimedout|timeout|timed out|cli proxy|غير متاح|empty response|bad gateway|service unavailable|socket hang up|aborted|temporarily unavailable/i.test(msg)) {
            return true;
        }
        return !msg;
    }

    function isOpenAiCompatibleEmptyResult(result) {
        if (!result || result.error) return true;
        const text = String(result.result || result.prompt || result.text || '').trim();
        if (text) return false;
        if (result.title || result.tags || result.filename || result.suggested_title || result.suggestedTitle) return false;
        return true;
    }

    function broadcastCliProxyRetryStatus(payload = {}) {
        const message = { action: 'cli_proxy_retry_status', ts: Date.now(), ...payload };
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage(message);
            }
        } catch (_) { /* service worker may have no listeners */ }
    }

    function normalizeCliProxyBaseUrl(value, getDefaultBaseUrl) {
        const fallback = typeof getDefaultBaseUrl === 'function' ? getDefaultBaseUrl() : 'https://cliproxyapi-ywrp.onrender.com/v1';
        const rawInput = String(value || '')
            .trim()
            .replace(/cliproxy-api-ywrp\.onrender\.com/gi, 'cliproxyapi-ywrp.onrender.com');
        // Keep local 8317 — do not remap to Render (Codex/Gemini live on local CLIProxy).
        const raw = rawInput || fallback;
        return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1').replace(/([^:]\/)\/+/g, '$1') || fallback;
    }

    /**
     * Persistent retry loop for CLI Proxy OpenAI-compatible calls.
     * @param {object} opts
     * @param {string} opts.contextLabel
     * @param {() => Promise<object>} opts.runOnce
     * @param {(result: object) => boolean} [opts.isSuccess]
     * @param {(result: object) => { errMsg: string, httpStatus?: number }} [opts.getFailure]
     * @param {number} [opts.maxAttempts] 0 = unlimited (default)
     */
    async function runPersistentRetry(opts = {}) {
        const contextLabel = String(opts.contextLabel || 'cli-proxy');
        const runOnce = opts.runOnce;
        const maxAttempts = Math.max(0, Number(opts.maxAttempts) || 0);
        const isSuccess = opts.isSuccess || ((result) => !result?.error && !isOpenAiCompatibleEmptyResult(result));
        const getFailure = opts.getFailure || ((result) => ({
            errMsg: result?.error || 'Empty response from AI',
            httpStatus: Number(result?.httpStatus) || 0
        }));

        let attempt = 0;
        let delayMs = RETRY.INITIAL_DELAY_MS;

        while (true) {
            attempt += 1;
            if (attempt > 1) {
                broadcastCliProxyRetryStatus({
                    context: contextLabel,
                    attempt,
                    delayMs,
                    status: 'waiting'
                });
                await sleepMs(delayMs);
                delayMs = Math.min(
                    RETRY.MAX_DELAY_MS,
                    Math.round(delayMs * RETRY.BACKOFF_FACTOR)
                );
            } else {
                broadcastCliProxyRetryStatus({ context: contextLabel, attempt: 1, status: 'trying' });
            }

            const result = await runOnce();

            if (isSuccess(result)) {
                broadcastCliProxyRetryStatus({ context: contextLabel, attempt, status: 'success' });
                return result;
            }

            const { errMsg, httpStatus = 0 } = getFailure(result);
            if (!isCliProxyRetryableFailure(errMsg, httpStatus)) {
                return result?.error ? result : { error: errMsg };
            }

            if (maxAttempts > 0 && attempt >= maxAttempts) {
                broadcastCliProxyRetryStatus({
                    context: contextLabel,
                    attempt,
                    status: 'exhausted',
                    error: errMsg
                });
                return result?.error ? result : { error: errMsg };
            }

            broadcastCliProxyRetryStatus({
                context: contextLabel,
                attempt,
                delayMs,
                status: 'retry',
                error: errMsg
            });
            console.warn(`[CLI-Proxy] retry ${attempt} (${contextLabel}): ${errMsg}`);
        }
    }

    global.NhpCliProxyRetry = Object.freeze({
        RETRY,
        sleepMs,
        isCliProxyHostBaseUrl,
        isCliProxyRetryableFailure,
        isOpenAiCompatibleEmptyResult,
        broadcastCliProxyRetryStatus,
        normalizeCliProxyBaseUrl,
        runPersistentRetry
    });
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
