/**
 * Multi-endpoint CLIProxy config with cloud-first failover.
 * Loaded in service worker (importScripts) and extension UI pages.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'nhpProxyEndpoints';
    const ROUTING_MODE_KEY = 'nhpProxyRoutingMode';
    const LEGACY_BASE_URL_KEY = 'nhpProxyBaseUrl';
    const LEGACY_API_KEY_KEY = 'nhpGptApiKey';
    const ADMIN_AI_KEYS_KEY = 'nhpAdminAiKeys';

    const CLOUD_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
    const LOCAL_BASE_URL = 'http://127.0.0.1:8317/v1';
    const LOCAL_DEFAULT_API_KEY = 'nhp-local-cliproxy-key';
    const HEALTH_CACHE_TTL_MS = 30000;

    const ROUTING_MODES = Object.freeze({
        DISTRIBUTED: 'distributed',
        FAILOVER: 'failover',
        LOCAL_ONLY: 'local-only'
    });

    let roundRobinIndex = 0;
    const healthCache = new Map();

    function fixHostnameTypo(value) {
        return String(value || '').replace(/cliproxy-api-ywrp\.onrender\.com/gi, 'cliproxyapi-ywrp.onrender.com');
    }

    function normalizeBaseUrl(value, fallback = CLOUD_BASE_URL) {
        let raw = fixHostnameTypo(String(value || '').trim() || fallback);
        if (typeof NhpStorageMigrate !== 'undefined' && NhpStorageMigrate.migratePortInUrl) {
            raw = NhpStorageMigrate.migratePortInUrl(raw);
        } else {
            raw = raw.replace(/:8517(\/|$)/g, ':8317$1');
        }
        return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1') || fallback;
    }

    function isLocalCliProxyBaseUrl(baseUrl) {
        const value = String(baseUrl || '').toLowerCase();
        return /:(8317)(\/|$)/.test(value) && /127\.0\.0\.1|localhost/.test(value);
    }

    function makeEndpointId(baseUrl) {
        const normalized = normalizeBaseUrl(baseUrl, '');
        if (!normalized) return `endpoint-${Date.now()}`;
        return normalized
            .replace(/^https?:\/\//i, '')
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || `endpoint-${Date.now()}`;
    }

    function normalizeEndpoint(raw = {}, index = 0) {
        const baseUrl = normalizeBaseUrl(raw.baseUrl, index === 1 ? LOCAL_BASE_URL : CLOUD_BASE_URL);
        const id = String(raw.id || makeEndpointId(baseUrl)).trim() || makeEndpointId(baseUrl);
        const label = String(raw.label || '').trim()
            || (isLocalCliProxyBaseUrl(baseUrl) ? 'CLIProxy محلي' : (baseUrl.includes('onrender.com') ? 'CLIProxy Render' : 'CLIProxy'));
        return {
            id,
            label,
            baseUrl,
            apiKey: String(raw.apiKey || '').trim(),
            enabled: raw.enabled !== false,
            priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : (index + 1) * 10
        };
    }

    function resolveEndpointApiKey(endpoint, fallbackKey = '') {
        // Local CLIProxy only accepts the gateway key — never probe it with a cloud SEO key.
        if (isLocalCliProxyBaseUrl(endpoint?.baseUrl)) return LOCAL_DEFAULT_API_KEY;
        const explicit = String(endpoint?.apiKey || '').trim();
        if (explicit === LOCAL_DEFAULT_API_KEY || explicit === 'nhp-local-cli-proxy-key') {
            // Local placeholder must not be sent to cloud endpoints.
            const fallback = String(fallbackKey || '').trim();
            return (fallback && fallback !== LOCAL_DEFAULT_API_KEY && fallback !== 'nhp-local-cli-proxy-key')
                ? fallback
                : '';
        }
        if (explicit) return explicit;
        const fallback = String(fallbackKey || '').trim();
        if (fallback === LOCAL_DEFAULT_API_KEY || fallback === 'nhp-local-cli-proxy-key') return '';
        return fallback;
    }

    function defaultEndpoints(apiKey = '') {
        const key = String(apiKey || '').trim();
        const cloudKey = key && key !== LOCAL_DEFAULT_API_KEY ? key : '';
        // Cloud primary (Render), local backup (8317).
        return [
            normalizeEndpoint({ id: 'cliproxy-render', label: 'CLIProxy Render (سحابي)', baseUrl: CLOUD_BASE_URL, apiKey: cloudKey, enabled: true, priority: 10 }, 0),
            normalizeEndpoint({ id: 'cliproxy-local', label: 'CLIProxy محلي (8317)', baseUrl: LOCAL_BASE_URL, apiKey: LOCAL_DEFAULT_API_KEY, enabled: true, priority: 20 }, 1)
        ];
    }

    /** Ensure canonical Render+local pair stays cloud-first even if storage still has old local-first priorities. */
    function ensureCloudFirstPriorities(endpoints = []) {
        const list = Array.isArray(endpoints) ? endpoints.slice() : [];
        const cloud = list.find((item) => /onrender\.com/i.test(String(item.baseUrl || '')));
        const local = list.find((item) => isLocalCliProxyBaseUrl(item.baseUrl));
        if (cloud && local && (Number(local.priority) || 0) <= (Number(cloud.priority) || 0)) {
            cloud.priority = 10;
            local.priority = 20;
        }
        return list;
    }

    function mergeEndpoints(stored = [], legacyBaseUrl = '', legacyApiKey = '') {
        const key = String(legacyApiKey || '').trim();
        const cloudKey = key && key !== LOCAL_DEFAULT_API_KEY ? key : '';
        const list = Array.isArray(stored) && stored.length
            ? stored.map((entry, index) => {
                const baseUrl = entry?.baseUrl || '';
                const apiKey = isLocalCliProxyBaseUrl(baseUrl)
                    ? LOCAL_DEFAULT_API_KEY
                    : (String(entry?.apiKey || '').trim() || cloudKey);
                return normalizeEndpoint({ ...entry, apiKey }, index);
            })
            : defaultEndpoints(cloudKey);

        const legacy = normalizeBaseUrl(legacyBaseUrl, '');
        if (legacy && !list.some((item) => normalizeBaseUrl(item.baseUrl) === legacy)) {
            list.push(normalizeEndpoint({
                baseUrl: legacy,
                apiKey: isLocalCliProxyBaseUrl(legacy) ? LOCAL_DEFAULT_API_KEY : cloudKey,
                enabled: true,
                priority: 15
            }, list.length));
        }

        const seen = new Set();
        const unique = [];
        list.forEach((item) => {
            const urlKey = normalizeBaseUrl(item.baseUrl);
            if (seen.has(urlKey)) return;
            seen.add(urlKey);
            unique.push({
                ...item,
                baseUrl: urlKey,
                apiKey: isLocalCliProxyBaseUrl(urlKey) ? LOCAL_DEFAULT_API_KEY : item.apiKey
            });
        });

        ensureCloudFirstPriorities(unique);
        unique.sort((a, b) => (a.priority || 0) - (b.priority || 0));
        return unique;
    }

    function getPrimaryEndpoint(endpoints = []) {
        const enabled = endpoints.filter((item) => item.enabled !== false);
        const sorted = enabled.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
        // Cloud-first: lowest priority wins (Render = 10, local backup = 20).
        return sorted[0] || normalizeEndpoint({ baseUrl: CLOUD_BASE_URL }, 0);
    }

    function isRetryableProxyFailure(errorMessage, httpStatus = 0) {
        const status = Number(httpStatus) || 0;
        // Cross-host failover: try next endpoint once on auth rejection (each host has its own key).
        if (status === 401 || status === 403) return true;
        const retry = global.NhpCliProxyRetry;
        if (retry?.isCliProxyRetryableFailure) {
            return retry.isCliProxyRetryableFailure(errorMessage, httpStatus);
        }
        const msg = String(errorMessage || '').toLowerCase();
        return status >= 500 || status === 408 || status === 429 || /failed to fetch|network|timeout|unavailable|غير متاح/i.test(msg);
    }

    function readStorage(keys) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(keys, (items) => resolve(items || {}));
            } catch (_) {
                resolve({});
            }
        });
    }

    function writeStorage(payload) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set(payload, () => resolve(payload));
            } catch (_) {
                resolve(payload);
            }
        });
    }

    async function loadRoutingMode() {
        const stored = await readStorage([ROUTING_MODE_KEY]);
        const mode = String(stored[ROUTING_MODE_KEY] || ROUTING_MODES.DISTRIBUTED).trim().toLowerCase();
        if (mode === ROUTING_MODES.FAILOVER || mode === ROUTING_MODES.LOCAL_ONLY) return mode;
        return ROUTING_MODES.DISTRIBUTED;
    }

    async function saveRoutingMode(mode) {
        const normalized = String(mode || ROUTING_MODES.DISTRIBUTED).trim().toLowerCase();
        const next = Object.values(ROUTING_MODES).includes(normalized)
            ? normalized
            : ROUTING_MODES.DISTRIBUTED;
        await writeStorage({ [ROUTING_MODE_KEY]: next });
        return next;
    }

    function getEnabledEndpoints(endpoints = []) {
        return (Array.isArray(endpoints) ? endpoints : [])
            .filter((item) => item.enabled !== false && item.baseUrl);
    }

    function filterEndpointsByMode(endpoints, mode) {
        const enabled = getEnabledEndpoints(endpoints);
        if (mode === ROUTING_MODES.LOCAL_ONLY) {
            return enabled.filter((item) => isLocalCliProxyBaseUrl(item.baseUrl));
        }
        return enabled;
    }

    function endpointHealthCacheKey(endpoint) {
        return normalizeBaseUrl(endpoint?.baseUrl || '');
    }

    async function checkEndpointHealth(endpoint, legacyApiKey = '', timeoutMs = 2500) {
        const baseUrl = normalizeBaseUrl(endpoint?.baseUrl || '');
        if (!baseUrl) return { online: false, endpoint, baseUrl };
        const cacheKey = endpointHealthCacheKey(endpoint);
        const cached = healthCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return { ...cached.value, cached: true };
        }
        const apiKey = resolveEndpointApiKey(endpoint, legacyApiKey);
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        let online = false;
        try {
            const res = await fetch(`${baseUrl}/models`, {
                method: 'GET',
                headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
                signal: controller?.signal
            });
            online = res.ok || res.status === 401;
        } catch (_) {
            online = false;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
        const value = { online, endpoint, baseUrl, endpointId: endpoint?.id, endpointLabel: endpoint?.label };
        healthCache.set(cacheKey, { value, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS });
        return value;
    }

    async function getHealthyEndpoints(endpoints = [], legacyApiKey = '', options = {}) {
        const mode = options.routingMode || await loadRoutingMode();
        const chain = filterEndpointsByMode(endpoints, mode);
        if (!chain.length) return [];
        const checks = await Promise.all(chain.map((endpoint) => checkEndpointHealth(endpoint, legacyApiKey, options.timeoutMs)));
        const healthy = checks.filter((item) => item.online).map((item) => item.endpoint);
        if (healthy.length) return healthy;
        return options.allowUnhealthy !== false ? chain : [];
    }

    function pickEndpointByIndex(endpoints, index = 0) {
        if (!endpoints.length) return null;
        const safeIndex = Math.abs(Number(index) || 0);
        return endpoints[safeIndex % endpoints.length];
    }

    function pickRoundRobinEndpoint(endpoints) {
        if (!endpoints.length) return null;
        const picked = endpoints[roundRobinIndex % endpoints.length];
        roundRobinIndex = (roundRobinIndex + 1) % Math.max(endpoints.length, 1);
        return picked;
    }

    function enrichEndpoint(endpoint, legacyApiKey = '') {
        if (!endpoint) return endpoint;
        return {
            ...endpoint,
            apiKey: resolveEndpointApiKey(endpoint, legacyApiKey)
        };
    }

    async function loadProxyEndpoints() {
        const stored = await readStorage([STORAGE_KEY, LEGACY_BASE_URL_KEY, LEGACY_API_KEY_KEY, ADMIN_AI_KEYS_KEY, ROUTING_MODE_KEY]);
        const adminKeys = stored[ADMIN_AI_KEYS_KEY] && typeof stored[ADMIN_AI_KEYS_KEY] === 'object'
            ? stored[ADMIN_AI_KEYS_KEY]
            : {};
        const legacyApiKey = String(stored[LEGACY_API_KEY_KEY] || adminKeys.gpt || '').trim();
        const legacyBaseUrl = String(stored[LEGACY_BASE_URL_KEY] || adminKeys.baseUrl || '').trim();
        const endpoints = mergeEndpoints(stored[STORAGE_KEY], legacyBaseUrl, legacyApiKey);
        const primary = getPrimaryEndpoint(endpoints);
        const routingMode = await loadRoutingMode();
        return {
            endpoints,
            primary,
            routingMode,
            legacyBaseUrl: primary.baseUrl,
            legacyApiKey: primary.apiKey || legacyApiKey
        };
    }

    async function saveProxyEndpoints(endpoints, { syncLegacy = true } = {}) {
        const normalized = mergeEndpoints(endpoints);
        const primary = getPrimaryEndpoint(normalized);
        const payload = { [STORAGE_KEY]: normalized };
        if (syncLegacy) {
            payload[LEGACY_BASE_URL_KEY] = primary.baseUrl;
            if (primary.apiKey) payload[LEGACY_API_KEY_KEY] = primary.apiKey;
            payload[ADMIN_AI_KEYS_KEY] = {
                ...(await readStorage([ADMIN_AI_KEYS_KEY]))[ADMIN_AI_KEYS_KEY],
                baseUrl: primary.baseUrl,
                gpt: primary.apiKey || undefined
            };
        }
        await writeStorage(payload);
        return normalized;
    }

    /**
     * Try enabled endpoints in priority order (cloud first by default).
     * @param {(endpoint: object) => Promise<object>} runOnce
     * @param {(result: object) => boolean} [isSuccess]
     */
    async function callWithProxyFailover(runOnce, isSuccess) {
        const { endpoints, legacyApiKey } = await loadProxyEndpoints();
        const chain = getEnabledEndpoints(endpoints).map((endpoint) => enrichEndpoint(endpoint, legacyApiKey));
        const successFn = typeof isSuccess === 'function'
            ? isSuccess
            : (result) => result && !result.error && result.success !== false;

        let lastResult = { error: 'No CLIProxy endpoints configured.' };
        for (const endpoint of chain) {
            const result = await runOnce(endpoint);
            if (successFn(result)) {
                return { ...result, endpointId: endpoint.id, endpointLabel: endpoint.label, baseUrl: endpoint.baseUrl, routingMode: ROUTING_MODES.FAILOVER };
            }
            const errMsg = result?.error || 'request_failed';
            const httpStatus = Number(result?.httpStatus) || 0;
            lastResult = result?.error ? result : { error: errMsg, httpStatus };
            if (!isRetryableProxyFailure(errMsg, httpStatus)) break;
        }
        return lastResult;
    }

    /**
     * Route across healthy endpoints — distributed round-robin by default, failover on request failure.
     * @param {(endpoint: object) => Promise<object>} runOnce
     * @param {(result: object) => boolean} [isSuccess]
     * @param {{ routingMode?: string, batchIndex?: number, endpointId?: string, preferHealthy?: boolean }} [options]
     */
    async function callWithProxyRouting(runOnce, isSuccess, options = {}) {
        const loaded = await loadProxyEndpoints();
        const routingMode = String(options.routingMode || loaded.routingMode || ROUTING_MODES.DISTRIBUTED).toLowerCase();
        const successFn = typeof isSuccess === 'function'
            ? isSuccess
            : (result) => result && !result.error && result.success !== false;

        if (routingMode === ROUTING_MODES.FAILOVER) {
            return callWithProxyFailover(runOnce, isSuccess);
        }

        const healthy = await getHealthyEndpoints(loaded.endpoints, loaded.legacyApiKey, {
            routingMode,
            allowUnhealthy: true
        });
        const chain = healthy.map((endpoint) => enrichEndpoint(endpoint, loaded.legacyApiKey));
        if (!chain.length) {
            return { error: 'No CLIProxy endpoints configured.' };
        }

        let ordered = chain.slice();
        if (options.endpointId) {
            const forced = chain.find((item) => item.id === options.endpointId);
            ordered = forced ? [forced, ...chain.filter((item) => item.id !== options.endpointId)] : ordered;
        } else if (Number.isFinite(Number(options.batchIndex))) {
            const primary = pickEndpointByIndex(chain, Number(options.batchIndex));
            ordered = primary ? [primary, ...chain.filter((item) => item.id !== primary.id)] : ordered;
        } else if (routingMode === ROUTING_MODES.DISTRIBUTED) {
            const primary = pickRoundRobinEndpoint(chain);
            ordered = primary ? [primary, ...chain.filter((item) => item.id !== primary.id)] : ordered;
        }

        let lastResult = { error: 'All CLIProxy endpoints failed.' };
        for (const endpoint of ordered) {
            console.log(`[CLIProxy-Routing] mode=${routingMode} → ${endpoint.label || endpoint.id} (${endpoint.baseUrl})`);
            const result = await runOnce(endpoint);
            if (successFn(result)) {
                return {
                    ...result,
                    endpointId: endpoint.id,
                    endpointLabel: endpoint.label,
                    baseUrl: endpoint.baseUrl,
                    routingMode
                };
            }
            const errMsg = result?.error || 'request_failed';
            const httpStatus = Number(result?.httpStatus) || 0;
            lastResult = result?.error ? result : { error: errMsg, httpStatus };
            if (!isRetryableProxyFailure(errMsg, httpStatus)) break;
        }
        return lastResult;
    }

    async function getProxyRoutingInfo() {
        const loaded = await loadProxyEndpoints();
        const healthy = await getHealthyEndpoints(loaded.endpoints, loaded.legacyApiKey, {
            routingMode: loaded.routingMode,
            allowUnhealthy: true
        });
        const checks = await Promise.all(
            getEnabledEndpoints(loaded.endpoints).map((endpoint) => checkEndpointHealth(endpoint, loaded.legacyApiKey))
        );
        return {
            routingMode: loaded.routingMode,
            endpoints: loaded.endpoints,
            healthyCount: healthy.length,
            healthyEndpointIds: healthy.map((item) => item.id),
            health: checks.map((item) => ({
                endpointId: item.endpointId,
                endpointLabel: item.endpointLabel,
                baseUrl: item.baseUrl,
                online: item.online
            }))
        };
    }

    const api = {
        STORAGE_KEY,
        ROUTING_MODE_KEY,
        LEGACY_BASE_URL_KEY,
        LEGACY_API_KEY_KEY,
        CLOUD_BASE_URL,
        LOCAL_BASE_URL,
        LOCAL_DEFAULT_API_KEY,
        ROUTING_MODES,
        fixHostnameTypo,
        normalizeBaseUrl,
        isLocalCliProxyBaseUrl,
        normalizeEndpoint,
        defaultEndpoints,
        mergeEndpoints,
        getPrimaryEndpoint,
        resolveEndpointApiKey,
        loadRoutingMode,
        saveRoutingMode,
        getEnabledEndpoints,
        checkEndpointHealth,
        getHealthyEndpoints,
        pickEndpointByIndex,
        loadProxyEndpoints,
        saveProxyEndpoints,
        callWithProxyFailover,
        callWithProxyRouting,
        getProxyRoutingInfo,
        isRetryableProxyFailure
    };

    global.NhpProxyEndpoints = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
