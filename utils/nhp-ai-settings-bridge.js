/**
 * INT-007 Wave 1+2 — EmailCore AI settings bridge (D1 PULL).
 * Extension reads GPT/CLIProxy + Gemini from EmailCore SSOT; local storage is cache-only.
 */
(function initNhpAiSettingsBridge(global) {
    'use strict';

    if (global.NhpAiSettingsBridge) return;

    const AI_SETTINGS_BRIDGE_PATH = '/ai-settings';
    const CACHE_KEY = 'nhpAiSettingsBridgeCache';
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const EMAILCORE_KEYS = Object.freeze({
        apiBase: 'emailcore_creaty_api_base',
        userId: 'emailcore_creaty_user_id',
        token: 'emailcore_creaty_token',
        sessionToken: 'emailcore_session_token',
        sessionUserId: 'emailcore_session_user_id',
    });
    const LEGACY_CACHE_KEYS = Object.freeze({
        gpt: 'nhpGptApiKey',
        baseUrl: 'nhpProxyBaseUrl',
        aggregate: 'nhpAdminAiKeys',
    });
    const GEMINI_LEGACY_KEYS = Object.freeze({
        internal: 'nhpInternalGeminiKey',
        seo: 'seoInternalGeminiKey',
        custom: 'customGeminiKey',
        generate: 'generateGeminiApiKey',
        aggregate: 'nhpAdminAiKeys',
        godMode: 'nhpGodModeSettings',
    });
    const GEMINI_LADDER_ORDER = Object.freeze([
        { alias: GEMINI_LEGACY_KEYS.internal, key: GEMINI_LEGACY_KEYS.internal },
        { alias: GEMINI_LEGACY_KEYS.seo, key: GEMINI_LEGACY_KEYS.seo },
        { alias: GEMINI_LEGACY_KEYS.custom, key: GEMINI_LEGACY_KEYS.custom },
        { alias: GEMINI_LEGACY_KEYS.generate, key: GEMINI_LEGACY_KEYS.generate },
        { alias: 'nhpAdminAiKeys.gemini', key: GEMINI_LEGACY_KEYS.aggregate, aggregateField: 'gemini' },
        { alias: 'nhpGodModeSettings.geminiApiKey', key: GEMINI_LEGACY_KEYS.godMode, godModeField: 'geminiApiKey' },
    ]);

    /** AR-64 — alias audit always on in dev; enabled in production for migration window. */
    const ALIAS_AUDIT_ENABLED = true;

    function normalizeEmailCoreApiBase(value, fallback = 'https://emailcore.app') {
        let base = String(value || fallback).trim().replace(/\/+$/, '');
        try {
            const url = new URL(base);
            if (url.hostname === 'www.emailcore.app') url.hostname = 'emailcore.app';
            base = url.origin;
        } catch (_) {
            /* keep raw */
        }
        return base;
    }

    function normalizeCliProxyBaseUrl(value, fallback) {
        if (typeof NhpAiCliproxy !== 'undefined' && NhpAiCliproxy.normalizeCliProxyBaseUrl) {
            return NhpAiCliproxy.normalizeCliProxyBaseUrl(value);
        }
        const raw = String(value || fallback || '').trim();
        return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1').replace(/([^:]\/)\/+/g, '$1') || fallback;
    }

    function logAliasAudit(alias, file) {
        if (!ALIAS_AUDIT_ENABLED) return;
        console.warn(JSON.stringify({
            event: 'alias_audit',
            alias: String(alias || ''),
            resolvedTo: 'gemini',
            source: 'Extension',
            file: String(file || 'nhp-ai-settings-bridge.js'),
        }));
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

    function writeStorage(patch) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set(patch, () => resolve(patch));
            } catch (_) {
                resolve(patch);
            }
        });
    }

    async function getEmailCoreCreatyCreds() {
        const stored = await readStorage(Object.values(EMAILCORE_KEYS));
        const apiBase = normalizeEmailCoreApiBase(stored[EMAILCORE_KEYS.apiBase]);
        const sessionToken = String(stored[EMAILCORE_KEYS.sessionToken] || '').trim();
        const sessionUserId = String(stored[EMAILCORE_KEYS.sessionUserId] || '').trim();
        if (sessionToken && sessionUserId) {
            return { apiBase, userId: sessionUserId, token: sessionToken, sessionToken };
        }
        const userId = String(stored[EMAILCORE_KEYS.userId] || '').trim();
        const token = String(stored[EMAILCORE_KEYS.token] || '').trim();
        if (!userId || !token) {
            throw new Error('EmailCore session missing — Admin → Integrations login');
        }
        return { apiBase, userId, token };
    }

    async function fetchBridgeFromEmailCore(creds, { method = 'GET', body } = {}) {
        const apiPath = AI_SETTINGS_BRIDGE_PATH.startsWith('/')
            ? AI_SETTINGS_BRIDGE_PATH
            : `/${AI_SETTINGS_BRIDGE_PATH}`;
        const url = new URL(`${creds.apiBase}/api/creaty${apiPath}`);
        url.searchParams.set('userId', creds.userId);
        const fetchOpts = {
            method,
            headers: {
                'content-type': 'application/json',
            },
        };
        if (creds.sessionToken || String(creds.token || '').includes('.')) {
            fetchOpts.headers['x-extension-session'] = creds.sessionToken || creds.token;
        } else {
            fetchOpts.headers['x-creaty-token'] = creds.token;
        }
        if (method !== 'GET' && method !== 'HEAD') {
            fetchOpts.body = JSON.stringify({ ...(body || {}), userId: creds.userId });
        }
        const response = await fetch(url.toString(), fetchOpts);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error || data?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }
        return data;
    }

    function getCliproxyFromPayload(payload) {
        const slot = payload?.providers?.cliproxy;
        if (!slot || typeof slot !== 'object') return null;
        return {
            baseUrl: normalizeCliProxyBaseUrl(slot.baseUrl, slot.defaultBaseUrl),
            apiKey: String(slot.apiKey || '').trim(),
            model: String(slot.model || slot.defaultModel || 'auto').trim() || 'auto',
            configured: !!slot.configured,
            keyHint: String(slot.keyHint || '').trim(),
            source: String(slot.source || 'emailcore').trim(),
            envManaged: !!slot.envManaged,
            owner: String(payload.owner || 'emailcore'),
            fetchedAt: String(payload.fetchedAt || new Date().toISOString()),
        };
    }

    function getGeminiFromPayload(payload) {
        const slot = payload?.providers?.gemini;
        if (!slot || typeof slot !== 'object') return null;
        return {
            apiKey: String(slot.apiKey || '').trim(),
            model: String(slot.model || slot.defaultModel || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash',
            configured: !!slot.configured,
            keyHint: String(slot.keyHint || '').trim(),
            source: String(slot.source || 'emailcore').trim(),
            owner: String(payload.owner || 'emailcore'),
            fetchedAt: String(payload.fetchedAt || new Date().toISOString()),
            models: Array.isArray(payload?.models?.gemini) ? payload.models.gemini : [],
        };
    }

    function isCacheFresh(cache, force = false) {
        if (force || !cache?.fetchedAt) return false;
        const age = Date.now() - Date.parse(cache.fetchedAt);
        return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
    }

    async function writeCliproxyCache(cliproxy, aggregatePatch = {}) {
        const baseUrl = normalizeCliProxyBaseUrl(cliproxy?.baseUrl);
        const apiKey = String(cliproxy?.apiKey || '').trim();
        const stored = await readStorage([LEGACY_CACHE_KEYS.aggregate]);
        const prevAggregate = stored[LEGACY_CACHE_KEYS.aggregate] && typeof stored[LEGACY_CACHE_KEYS.aggregate] === 'object'
            ? stored[LEGACY_CACHE_KEYS.aggregate]
            : {};
        const nextAggregate = {
            ...prevAggregate,
            ...aggregatePatch,
            gpt: apiKey,
            baseUrl,
        };
        await writeStorage({
            [CACHE_KEY]: {
                owner: cliproxy?.owner || 'emailcore',
                fetchedAt: cliproxy?.fetchedAt || new Date().toISOString(),
                cliproxy: {
                    baseUrl,
                    apiKey,
                    model: cliproxy?.model || 'auto',
                    configured: !!cliproxy?.configured,
                    keyHint: cliproxy?.keyHint || '',
                    source: cliproxy?.source || 'emailcore',
                    envManaged: !!cliproxy?.envManaged,
                },
            },
            [LEGACY_CACHE_KEYS.gpt]: apiKey,
            [LEGACY_CACHE_KEYS.baseUrl]: baseUrl,
            [LEGACY_CACHE_KEYS.aggregate]: nextAggregate,
        });
        return { baseUrl, apiKey, model: cliproxy?.model || 'auto' };
    }

    async function writeGeminiCache(gemini, aggregatePatch = {}) {
        const apiKey = String(gemini?.apiKey || '').trim();
        const model = String(gemini?.model || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';
        const stored = await readStorage([CACHE_KEY, LEGACY_CACHE_KEYS.aggregate]);
        const prevCache = stored[CACHE_KEY] && typeof stored[CACHE_KEY] === 'object' ? stored[CACHE_KEY] : {};
        const prevAggregate = stored[LEGACY_CACHE_KEYS.aggregate] && typeof stored[LEGACY_CACHE_KEYS.aggregate] === 'object'
            ? stored[LEGACY_CACHE_KEYS.aggregate]
            : {};
        const nextAggregate = {
            ...prevAggregate,
            ...aggregatePatch,
            gemini: apiKey,
        };
        const nextCache = {
            ...prevCache,
            owner: gemini?.owner || prevCache.owner || 'emailcore',
            fetchedAt: gemini?.fetchedAt || new Date().toISOString(),
            gemini: {
                apiKey,
                model,
                configured: !!gemini?.configured,
                keyHint: gemini?.keyHint || '',
                source: gemini?.source || 'emailcore',
            },
        };
        await writeStorage({
            [CACHE_KEY]: nextCache,
            [LEGACY_CACHE_KEYS.aggregate]: nextAggregate,
            // INT-007 W2 — legacy Gemini keys are cache mirrors only (written after EmailCore PUT).
            [GEMINI_LEGACY_KEYS.internal]: apiKey,
            [GEMINI_LEGACY_KEYS.seo]: apiKey,
        });
        return { apiKey, model };
    }

    function resolveLegacyGeminiFromStorage(stored, { file, includeGenerate = true, includeGodMode = true } = {}) {
        for (const entry of GEMINI_LADDER_ORDER) {
            if (!includeGenerate && entry.key === GEMINI_LEGACY_KEYS.generate) continue;
            if (!includeGodMode && entry.key === GEMINI_LEGACY_KEYS.godMode) continue;
            let value = '';
            if (entry.aggregateField) {
                const agg = stored[entry.key];
                value = agg && typeof agg === 'object' ? String(agg[entry.aggregateField] || '').trim() : '';
            } else if (entry.godModeField) {
                const gm = stored[entry.key];
                value = gm && typeof gm === 'object' ? String(gm[entry.godModeField] || '').trim() : '';
            } else {
                value = String(stored[entry.key] || '').trim();
            }
            if (value) {
                logAliasAudit(entry.alias, file);
                return { apiKey: value, alias: entry.alias, fromLegacy: true };
            }
        }
        return { apiKey: '', alias: '', fromLegacy: false };
    }

    async function resolveGeminiApiKey({ file, includeGenerate = true, includeGodMode = true, pullIfStale = true } = {}) {
        const storageKeys = [
            CACHE_KEY,
            ...GEMINI_LADDER_ORDER.map((e) => e.key),
        ];
        const stored = await readStorage(storageKeys);
        const cache = stored[CACHE_KEY];
        const bridgeKey = String(cache?.gemini?.apiKey || '').trim();
        if (bridgeKey) {
            return {
                apiKey: bridgeKey,
                model: String(cache?.gemini?.model || 'gemini-2.0-flash').trim(),
                source: 'bridge-cache',
                alias: null,
            };
        }
        if (pullIfStale) {
            try {
                const pulled = await pullAiSettings({ force: true });
                const geminiKey = String(pulled?.gemini?.apiKey || '').trim();
                if (geminiKey) {
                    return {
                        apiKey: geminiKey,
                        model: String(pulled.gemini.model || 'gemini-2.0-flash').trim(),
                        source: 'bridge-pull',
                        alias: null,
                    };
                }
            } catch (_) {
                /* ladder fallback below */
            }
        }
        const legacy = resolveLegacyGeminiFromStorage(stored, { file, includeGenerate, includeGodMode });
        if (legacy.apiKey) {
            return {
                apiKey: legacy.apiKey,
                model: 'gemini-2.0-flash',
                source: 'legacy-ladder',
                alias: legacy.alias,
            };
        }
        return { apiKey: '', model: 'gemini-2.0-flash', source: 'empty', alias: null };
    }

    async function maybeMigrateGeminiToEmailCore(legacyApiKey) {
        const key = String(legacyApiKey || '').trim();
        if (!key) return false;
        try {
            const creds = await getEmailCoreCreatyCreds();
            const current = await fetchBridgeFromEmailCore(creds, { method: 'GET' });
            const existing = String(current?.providers?.gemini?.apiKey || '').trim();
            if (existing) return false;
            await fetchBridgeFromEmailCore(creds, {
                method: 'PUT',
                body: {
                    providerId: 'gemini',
                    apiKey: key,
                    migrateFromExtension: true,
                },
            });
            return true;
        } catch (_) {
            return false;
        }
    }

    async function pullAiSettings({ force = false } = {}) {
        const stored = await readStorage([CACHE_KEY]);
        const existing = stored[CACHE_KEY];
        if (!force && isCacheFresh(existing, false) && existing?.cliproxy?.apiKey) {
            return existing;
        }
        const creds = await getEmailCoreCreatyCreds();
        const payload = await fetchBridgeFromEmailCore(creds, { method: 'GET' });
        const cliproxy = getCliproxyFromPayload(payload);
        if (!cliproxy) {
            throw new Error('Bridge payload missing cliproxy provider');
        }
        const gemini = getGeminiFromPayload(payload);
        await writeCliproxyCache(cliproxy);
        if (gemini) {
            await writeGeminiCache(gemini);
        } else {
            const legacy = await resolveGeminiApiKey({ file: 'pullAiSettings', pullIfStale: false });
            if (legacy.apiKey && !gemini?.configured) {
                await maybeMigrateGeminiToEmailCore(legacy.apiKey);
            }
        }
        const refreshed = await readStorage([CACHE_KEY]);
        const cache = refreshed[CACHE_KEY] || {};
        return {
            owner: payload.owner || 'emailcore',
            envPolicy: payload.envPolicy || 'bootstrap_only',
            fetchedAt: payload.fetchedAt || cliproxy.fetchedAt,
            cliproxy,
            gemini: gemini || cache.gemini || null,
            models: payload.models && typeof payload.models === 'object' ? payload.models : {},
            registry: Array.isArray(payload.registry) ? payload.registry : [],
        };
    }

    async function saveCliproxySettings({ baseUrl, apiKey, model, providerId = 'cliproxy' }) {
        const creds = await getEmailCoreCreatyCreds();
        const payload = await fetchBridgeFromEmailCore(creds, {
            method: 'PUT',
            body: {
                providerId,
                baseUrl,
                apiKey,
                model,
            },
        });
        const cliproxy = getCliproxyFromPayload(payload);
        if (!cliproxy) {
            throw new Error('Bridge save response missing cliproxy provider');
        }
        await writeCliproxyCache(cliproxy);
        return cliproxy;
    }

    async function saveGeminiSettings({ apiKey, model, providerId = 'gemini', migrateFromExtension = false } = {}) {
        const creds = await getEmailCoreCreatyCreds();
        const payload = await fetchBridgeFromEmailCore(creds, {
            method: 'PUT',
            body: {
                providerId,
                apiKey,
                model,
                migrateFromExtension: !!migrateFromExtension,
            },
        });
        const gemini = getGeminiFromPayload(payload);
        if (!gemini) {
            throw new Error('Bridge save response missing gemini provider');
        }
        await writeGeminiCache(gemini);
        return gemini;
    }

    async function getCachedCliproxySettings({ pullIfStale = true } = {}) {
        const stored = await readStorage([CACHE_KEY, LEGACY_CACHE_KEYS.gpt, LEGACY_CACHE_KEYS.baseUrl]);
        const cache = stored[CACHE_KEY];
        if (isCacheFresh(cache, false) && cache?.cliproxy) {
            return {
                ...cache.cliproxy,
                owner: cache.owner || 'emailcore',
                fetchedAt: cache.fetchedAt,
                fromCache: true,
            };
        }
        if (pullIfStale) {
            try {
                const pulled = await pullAiSettings({ force: true });
                return {
                    ...pulled.cliproxy,
                    owner: pulled.owner || 'emailcore',
                    fetchedAt: pulled.fetchedAt,
                    fromCache: false,
                };
            } catch (_) {
                /* fall through to legacy cache */
            }
        }
        const legacyBase = stored[LEGACY_CACHE_KEYS.baseUrl];
        const legacyKey = stored[LEGACY_CACHE_KEYS.gpt];
        if (legacyBase || legacyKey) {
            return {
                baseUrl: normalizeCliProxyBaseUrl(legacyBase),
                apiKey: String(legacyKey || '').trim(),
                model: 'auto',
                configured: !!(legacyBase && legacyKey),
                fromCache: true,
                stale: true,
            };
        }
        return null;
    }

    async function getCachedGeminiSettings({ pullIfStale = true, file } = {}) {
        const resolved = await resolveGeminiApiKey({ file: file || 'getCachedGeminiSettings', pullIfStale });
        return {
            apiKey: resolved.apiKey,
            model: resolved.model,
            configured: !!resolved.apiKey,
            source: resolved.source,
            alias: resolved.alias,
            fromCache: resolved.source === 'bridge-cache' || resolved.source === 'legacy-ladder',
        };
    }

    global.NhpAiSettingsBridge = {
        AI_SETTINGS_BRIDGE_PATH,
        CACHE_KEY,
        CACHE_TTL_MS,
        EMAILCORE_KEYS,
        GEMINI_LEGACY_KEYS,
        GEMINI_LADDER_ORDER,
        ALIAS_AUDIT_ENABLED,
        logAliasAudit,
        normalizeCliProxyBaseUrl,
        pullAiSettings,
        saveCliproxySettings,
        saveGeminiSettings,
        getCachedCliproxySettings,
        getCachedGeminiSettings,
        resolveGeminiApiKey,
        maybeMigrateGeminiToEmailCore,
        writeCliproxyCache,
        writeGeminiCache,
        getCliproxyFromPayload,
        getGeminiFromPayload,
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
