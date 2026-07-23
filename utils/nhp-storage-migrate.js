/**
 * One-shot chrome.storage migration — legacy CLIProxy/Ghost ports and local gateway key typo.
 * Loaded in service worker (importScripts) and extension UI pages (script tag).
 */
(function (global) {
    'use strict';

    const MIGRATION_FLAG_KEY = 'nhpStorageMigrateV40';
    const CANONICAL_LOCAL_KEY = 'nhp-local-cliproxy-key';
    const LOCAL_KEY_ALIASES = Object.freeze(['nhp-local-cliproxy-key', 'nhp-local-cli-proxy-key']);
    const LEGACY_CLIPROXY_PORT = 8517;
    const CANONICAL_CLIPROXY_PORT = 8317;
    const CANONICAL_GHOST_PORT = 3019;
    const LEGACY_GHOST_PORTS = new Set([3010, 1010, 1019]);

    function isLocalGatewayKey(key) {
        return LOCAL_KEY_ALIASES.includes(String(key || '').trim());
    }

    function normalizeLocalGatewayKey(key) {
        const k = String(key || '').trim();
        return isLocalGatewayKey(k) ? CANONICAL_LOCAL_KEY : k;
    }

    function migratePortInUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return raw;
        return raw
            .replace(new RegExp(`:${LEGACY_CLIPROXY_PORT}(/|$)`, 'g'), `:${CANONICAL_CLIPROXY_PORT}$1`)
            .replace(/\/v1\/v1$/i, '/v1');
    }

    function migrateGhostPort(port) {
        const p = Number(port);
        if (!Number.isFinite(p) || p <= 0) return null;
        if (LEGACY_GHOST_PORTS.has(p)) return CANONICAL_GHOST_PORT;
        return p;
    }

    function migrateStoragePayload(data) {
        const patch = {};
        const src = data && typeof data === 'object' ? data : {};

        if (src.nhpProxyBaseUrl) {
            const next = migratePortInUrl(src.nhpProxyBaseUrl);
            if (next !== src.nhpProxyBaseUrl) patch.nhpProxyBaseUrl = next;
        }

        if (src.nhpGptApiKey && isLocalGatewayKey(src.nhpGptApiKey)) {
            const next = normalizeLocalGatewayKey(src.nhpGptApiKey);
            if (next !== src.nhpGptApiKey) patch.nhpGptApiKey = next;
        }

        if (src.nhpAdminAiKeys && typeof src.nhpAdminAiKeys === 'object') {
            const ak = { ...src.nhpAdminAiKeys };
            let changed = false;
            if (ak.baseUrl) {
                const nb = migratePortInUrl(ak.baseUrl);
                if (nb !== ak.baseUrl) {
                    ak.baseUrl = nb;
                    changed = true;
                }
            }
            if (ak.gpt && isLocalGatewayKey(ak.gpt)) {
                const nk = normalizeLocalGatewayKey(ak.gpt);
                if (nk !== ak.gpt) {
                    ak.gpt = nk;
                    changed = true;
                }
            }
            if (changed) patch.nhpAdminAiKeys = ak;
        }

        if (Array.isArray(src.nhpProxyEndpoints)) {
            let changed = false;
            const endpoints = src.nhpProxyEndpoints.map((ep) => {
                const next = { ...(ep || {}) };
                if (next.baseUrl) {
                    const nb = migratePortInUrl(next.baseUrl);
                    if (nb !== next.baseUrl) {
                        next.baseUrl = nb;
                        changed = true;
                    }
                }
                if (isLocalGatewayKey(next.apiKey)) {
                    const nk = normalizeLocalGatewayKey(next.apiKey);
                    if (nk !== next.apiKey) {
                        next.apiKey = nk;
                        changed = true;
                    }
                }
                return next;
            });
            if (changed) patch.nhpProxyEndpoints = endpoints;
        }

        for (const key of ['nhpGhostPort', 'nhpGhostTeepublicPort']) {
            if (src[key] == null) continue;
            const migrated = migrateGhostPort(src[key]);
            const current = Number(src[key]);
            if (migrated != null && migrated !== current) {
                patch[key] = migrated;
            }
        }

        return patch;
    }

    function runStorageMigration(force = false) {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            return Promise.resolve({ migrated: false, skipped: true });
        }
        return new Promise((resolve) => {
            chrome.storage.local.get([MIGRATION_FLAG_KEY], (flagRes) => {
                if (chrome.runtime?.lastError) {
                    resolve({ migrated: false, error: chrome.runtime.lastError.message });
                    return;
                }
                if (!force && flagRes?.[MIGRATION_FLAG_KEY] === 'v40') {
                    resolve({ migrated: false, skipped: true });
                    return;
                }
                chrome.storage.local.get(null, (all) => {
                    if (chrome.runtime?.lastError) {
                        resolve({ migrated: false, error: chrome.runtime.lastError.message });
                        return;
                    }
                    const patch = migrateStoragePayload(all || {});
                    patch[MIGRATION_FLAG_KEY] = 'v40';
                    const hasDataPatch = Object.keys(patch).some((k) => k !== MIGRATION_FLAG_KEY);
                    chrome.storage.local.set(patch, () => {
                        resolve({
                            migrated: hasDataPatch,
                            keys: Object.keys(patch).filter((k) => k !== MIGRATION_FLAG_KEY)
                        });
                    });
                });
            });
        });
    }

    const api = {
        MIGRATION_FLAG_KEY,
        CANONICAL_LOCAL_KEY,
        LOCAL_KEY_ALIASES,
        isLocalGatewayKey,
        normalizeLocalGatewayKey,
        migratePortInUrl,
        migrateGhostPort,
        migrateStoragePayload,
        runStorageMigration
    };

    global.NhpStorageMigrate = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
