/**
 * NHP runtime config — Windows/local backend only.
 * Loaded in service worker (importScripts) and extension UI pages (script tag).
 */
(function (global) {
    'use strict';

    const STORAGE_KEYS = Object.freeze({
        backendMode: 'nhpBackendMode',
        localHost: 'nhpLocalHost',
        projectDir: 'nhpProjectDir',
        proxyBaseUrl: 'nhpProxyBaseUrl',
        proxyEndpoints: 'nhpProxyEndpoints'
    });

    /** Empty = portable; set via Admin or addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.bat after copy. */
    const DEFAULT_WINDOWS_PROJECT_DIR = '';
    const DEFAULT_WIN_HOST = '127.0.0.1';
    const DEFAULT_WIN_CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    /** Cloud Render CLIProxy is primary; local 8317 is backup via NhpProxyEndpoints failover. */
    const DEFAULT_PROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
    const DEFAULT_CLOUD_PROXY_BASE_URL = DEFAULT_PROXY_BASE_URL;
    const DEFAULT_LOCAL_PROXY_BASE_URL = 'http://127.0.0.1:8317/v1';

    const PORTS = Object.freeze({
        manager: 3009,
        ghostTeepublic: 3019,
        creaty: 3020,
        ghostRedbubble: 3021,
        ghostAmazon: 3022,
        pinterest: 3023,
        aiBridge: 3031,
        cliproxy: 8317,
        chromeDebug: 9331
    });

    let cache = null;

    function normalizeBackendMode(_) { return 'windows'; }

    function stripHost(value) {
        return String(value || '')
            .trim()
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .split(':')[0];
    }

    function normalizeHost(value, backendMode) {
        const host = stripHost(value);
        if (host) {
            if (/^localhost$/i.test(host)) return DEFAULT_WIN_HOST;
            return host;
        }
        return DEFAULT_WIN_HOST;
    }

    function defaultProjectDir(_) { return DEFAULT_WINDOWS_PROJECT_DIR; }

    function defaultChromePath(_) { return DEFAULT_WIN_CHROME_PATH; }

    function getCached() {
        if (!cache) {
            cache = {
                backendMode: 'windows',
                localHost: DEFAULT_WIN_HOST,
                projectDir: DEFAULT_WINDOWS_PROJECT_DIR,
                proxyBaseUrl: DEFAULT_CLOUD_PROXY_BASE_URL
            };
        }
        return cache;
    }

    function localUrl(port, path, hostOverride) {
        const host = hostOverride || getCached().localHost;
        const portNum = Number(port) || 0;
        const pathStr = path
            ? (String(path).startsWith('/') ? String(path) : `/${path}`)
            : '';
        return `http://${host}:${portNum}${pathStr}`;
    }

    function defaultProxyBaseUrl(_hostOverride) {
        return DEFAULT_CLOUD_PROXY_BASE_URL;
    }

    function defaultLocalProxyBaseUrl(hostOverride) {
        if (!hostOverride) return DEFAULT_LOCAL_PROXY_BASE_URL;
        return localUrl(PORTS.cliproxy, '/v1', hostOverride);
    }

    function joinPath(...parts) {
        const sep = '\\';
        return parts
            .filter((p) => p !== undefined && p !== null && String(p).length > 0)
            .map((p) => String(p).replace(/[/\\]+$/, '').replace(/^[/\\]+/, ''))
            .join(sep);
    }

    /** Sibling NHP_DATA next to the extension App Root (Chrome/extension context). */
    function dataRootFromProjectDir(projectDir) {
        const raw = String(projectDir || '').trim().replace(/[/\\]+$/, '');
        if (!raw) return 'NHP_DATA';
        const parts = raw.split(/[/\\]/);
        parts.pop();
        return parts.length ? `${parts.join('\\')}\\NHP_DATA` : 'NHP_DATA';
    }

    function joinDataPath(projectDir, ...relParts) {
        return joinPath(dataRootFromProjectDir(projectDir), ...relParts);
    }

    function applyHostToStoredUrl(url, hostOverride) {
        const raw = String(url || '').trim();
        if (!raw) return raw;
        const host = stripHost(hostOverride || getCached().localHost);
        try {
            const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`);
            parsed.hostname = host;
            return parsed.toString().replace(/\/+$/, '');
        } catch (_) {
            return raw.replace(/127\.0\.0\.1|localhost/gi, host);
        }
    }

    function setCacheFromStorage(data) {
        const payload = data && typeof data === 'object' ? data : {};
        const backendMode = normalizeBackendMode(payload[STORAGE_KEYS.backendMode]);
        const localHost = normalizeHost(payload[STORAGE_KEYS.localHost], backendMode);
        const projectDir = String(payload[STORAGE_KEYS.projectDir] || '').trim() || defaultProjectDir(backendMode);
        const storedProxyBaseUrl = String(payload[STORAGE_KEYS.proxyBaseUrl] || '').trim();
        // Keep explicit stored URL (local or cloud); default empty → cloud primary.
        const proxyBaseUrl = storedProxyBaseUrl || defaultProxyBaseUrl();
        cache = { backendMode, localHost, projectDir, proxyBaseUrl };
        return cache;
    }

    function loadFromStorage() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            return Promise.resolve(setCacheFromStorage({}));
        }
        return new Promise((resolve) => {
            chrome.storage.local.get(Object.values(STORAGE_KEYS), (res) => {
                if (chrome.runtime?.lastError) resolve(setCacheFromStorage({}));
                else resolve(setCacheFromStorage(res || {}));
            });
        });
    }

    function saveToStorage(partial) {
        const patch = partial && typeof partial === 'object' ? partial : {};
        const next = setCacheFromStorage({
            [STORAGE_KEYS.backendMode]: patch.backendMode ?? getCached().backendMode,
            [STORAGE_KEYS.localHost]: patch.localHost ?? getCached().localHost,
            [STORAGE_KEYS.projectDir]: patch.projectDir ?? getCached().projectDir,
            [STORAGE_KEYS.proxyBaseUrl]: patch.proxyBaseUrl ?? getCached().proxyBaseUrl
        });
        const toSave = {
            [STORAGE_KEYS.backendMode]: next.backendMode,
            [STORAGE_KEYS.localHost]: next.localHost,
            [STORAGE_KEYS.projectDir]: next.projectDir,
            [STORAGE_KEYS.proxyBaseUrl]: next.proxyBaseUrl
        };
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            return Promise.resolve(next);
        }
        return new Promise((resolve) => {
            chrome.storage.local.set(toSave, () => resolve(next));
        });
    }

    function wrapCommandForBackend(command) { return String(command || ''); }

    function isCliProxyLocalBaseUrl(baseUrl) {
        const value = String(baseUrl || '').toLowerCase();
        return /:(8317)(\/|$)/.test(value) && /127\.0\.0\.1|localhost/.test(value);
    }

    function migrateProxyBaseUrlForHost(storedBaseUrl) {
        let raw = String(storedBaseUrl || '').trim();
        if (typeof NhpStorageMigrate !== 'undefined' && NhpStorageMigrate.migratePortInUrl) {
            raw = NhpStorageMigrate.migratePortInUrl(raw);
        } else {
            raw = raw.replace(/:8517(\/|$)/g, ':8317$1');
        }
        if (!raw || !isCliProxyLocalBaseUrl(raw)) return raw || DEFAULT_CLOUD_PROXY_BASE_URL;
        return applyHostToStoredUrl(raw.endsWith('/v1') ? raw : `${raw.replace(/\/+$/, '')}/v1`);
    }

    const api = {
        STORAGE_KEYS,
        PORTS,
        DEFAULT_WINDOWS_PROJECT_DIR,
        DEFAULT_WIN_HOST,
        DEFAULT_WIN_CHROME_PATH,
        DEFAULT_PROXY_BASE_URL,
        DEFAULT_CLOUD_PROXY_BASE_URL,
        DEFAULT_LOCAL_PROXY_BASE_URL,
        loadFromStorage,
        saveToStorage,
        getCached,
        setCacheFromStorage,
        localUrl,
        defaultProxyBaseUrl,
        defaultLocalProxyBaseUrl,
        joinPath,
        dataRootFromProjectDir,
        joinDataPath,
        applyHostToStoredUrl,
        wrapCommandForBackend,
        normalizeBackendMode,
        normalizeHost,
        defaultProjectDir,
        defaultChromePath,
        isCliProxyLocalBaseUrl,
        migrateProxyBaseUrlForHost
    };

    global.NhpRuntimeConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
