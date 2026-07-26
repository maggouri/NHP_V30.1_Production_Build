/**
 * Ghost Server connection probe + retry — shared by popup panels, Prompt Bag, background SW.
 * Default: 3 attempts, 2s between failures (server may be slow to accept connections).
 */
(function (global) {
    'use strict';

    const DEFAULT_PORT = 3019;
    const RETRY = Object.freeze({
        ATTEMPTS: 3,
        DELAY_MS: 2000,
        PING_TIMEOUT_MS: 1500
    });

    function sleepMs(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function ghostLocalUrl(port, path = '/ping') {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        if (typeof global.NhpRuntimeConfig !== 'undefined' && global.NhpRuntimeConfig.localUrl) {
            return global.NhpRuntimeConfig.localUrl(port, normalized);
        }
        return `http://127.0.0.1:${port}${normalized}`;
    }

    /**
     * Single GET /ping (or custom path) with timeout.
     * @returns {Promise<{ ok: boolean, port: number, data: object|null }>}
     */
    async function probePingOnce(port, options = {}) {
        const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : RETRY.PING_TIMEOUT_MS;
        const path = options.path || '/ping';
        const parseJson = options.parseJson !== false;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeoutMs);
            const res = await fetch(ghostLocalUrl(port, path), { method: 'GET', signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) return { ok: false, port, data: null };
            const data = parseJson ? await res.json().catch(() => ({})) : null;
            return { ok: true, port, data };
        } catch (_) {
            return { ok: false, port, data: null };
        }
    }

    /**
     * Run detectFn up to maxAttempts times; wait delayMs between failures.
     * detectFn returns truthy on success.
     */
    async function withRetry(detectFn, options = {}) {
        const maxAttempts = Math.max(1, Number(options.attempts ?? options.maxAttempts ?? RETRY.ATTEMPTS));
        const delayMs = Number(options.delayMs ?? RETRY.DELAY_MS);
        const onAttempt = typeof options.onAttempt === 'function' ? options.onAttempt : null;
        const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;

        let lastResult = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (onAttempt) onAttempt(attempt, maxAttempts);
            lastResult = await detectFn(attempt);
            if (lastResult) return lastResult;
            if (attempt < maxAttempts) {
                if (onRetry) onRetry(attempt, maxAttempts, delayMs);
                await sleepMs(delayMs);
            }
        }
        return lastResult;
    }

    /** Probe one port with retry (simple online check). */
    async function probePortWithRetry(port, options = {}) {
        let found = null;
        await withRetry(async () => {
            const probed = await probePingOnce(port, options);
            if (probed.ok) {
                found = probed;
                return probed;
            }
            return null;
        }, options);
        return found;
    }

    /**
     * Try ports in order on each attempt; retry full cycle between failures.
     * @param {number[]} ports
     * @param {object} options — probe(port), isMatch(probed), pick(probed), attempts, delayMs, onRetry
     */
    async function detectPortWithRetry(ports, options = {}) {
        const uniquePorts = [...new Set((ports || [DEFAULT_PORT]).filter((p) => Number(p) > 0))];
        const isMatch = typeof options.isMatch === 'function'
            ? options.isMatch
            : (probed) => !!probed?.ok;
        const probe = typeof options.probe === 'function'
            ? options.probe
            : (port) => probePingOnce(port, options);

        let found = null;
        await withRetry(async () => {
            for (const port of uniquePorts) {
                const probed = await probe(port);
                if (isMatch(probed)) {
                    found = typeof options.pick === 'function' ? options.pick(probed) : port;
                    return found;
                }
            }
            return null;
        }, options);
        return found;
    }

    global.NhpGhostConnect = Object.freeze({
        DEFAULT_PORT,
        RETRY,
        sleepMs,
        ghostLocalUrl,
        probePingOnce,
        withRetry,
        probePortWithRetry,
        detectPortWithRetry
    });
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
