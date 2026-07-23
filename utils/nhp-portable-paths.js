/**
 * Portable path resolution — project root (extension folder) and NHP_DATA sibling.
 * Used by background (importScripts) and UI pages (script tag).
 */
(function (global) {
    'use strict';

    const NATIVE_HOST = 'com.nhp.server_launcher';
    const DEFAULT_EXTENSION_ID = 'bhhahkcjolghbigcognobplmgdbkmekb';
    const REGISTER_SCRIPT_NAME = 'addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.bat';
    const PROJECT_DIR_STORAGE_KEY = 'nhpProjectDir';
    const EMAILCORE_DIR_STORAGE_KEY = 'emailcoreProjectDir';
    const PORTABLE_CONFIG_FILENAME = 'portable.config.json';
    const NATIVE_HOST_RECHECK_MS = 120000;

    let resolveCache = '';
    let dataRootCache = '';
    let resolveCacheAt = 0;
    const CACHE_TTL_MS = 45000;
    let nativeHostStatus = { checked: false, ok: false, error: null, errorKind: null, checkedAt: null, projectDir: null };

    function isValidProjectDir(dir) {
        const value = String(dir || '').trim();
        if (!value || value.length < 3) return false;
        return /^[a-zA-Z]:\\/.test(value) || value.startsWith('\\\\');
    }

    function normalizeWinPath(value) {
        return String(value || '').trim().replace(/\//g, '\\').replace(/\\+$/, '');
    }

    function joinWinPath(root, ...parts) {
        const base = normalizeWinPath(root);
        const rel = parts
            .filter((part) => part !== undefined && part !== null && String(part).length > 0)
            .map((part) => String(part).replace(/^[/\\]+/, '').replace(/[/\\]+$/, ''))
            .join('\\');
        return base ? `${base}\\${rel}` : rel;
    }

    async function readStorageProjectDir() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return '';
        try {
            const stored = await chrome.storage.local.get([PROJECT_DIR_STORAGE_KEY, EMAILCORE_DIR_STORAGE_KEY]);
            const candidates = [
                stored?.[PROJECT_DIR_STORAGE_KEY],
                stored?.[EMAILCORE_DIR_STORAGE_KEY]
            ];
            for (const candidate of candidates) {
                const dir = normalizeWinPath(candidate);
                if (isValidProjectDir(dir)) return dir;
            }
        } catch (_) { /* ignore */ }
        return '';
    }

    async function sendNativeHostMessage(message) {
        if (typeof chrome?.runtime?.sendNativeMessage !== 'function') {
            throw new Error('nativeMessaging unavailable');
        }
        const result = await chrome.runtime.sendNativeMessage(NATIVE_HOST, message);
        if (!result) throw new Error('Native host returned empty response');
        return result;
    }

    async function fetchProjectDirFromNativeHost() {
        try {
            const result = await sendNativeHostMessage({ action: 'ping' });
            const dir = normalizeWinPath(result?.projectDir);
            if (result?.success && isValidProjectDir(dir)) {
                if (result.dataRoot) dataRootCache = normalizeWinPath(result.dataRoot);
                return dir;
            }
        } catch (_) { /* native host not registered */ }
        return '';
    }

    async function persistProjectDir(dir) {
        const normalized = normalizeWinPath(dir);
        if (!isValidProjectDir(normalized)) return;
        resolveCache = normalized;
        resolveCacheAt = Date.now();
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ [PROJECT_DIR_STORAGE_KEY]: normalized });
            }
        } catch (_) { /* ignore */ }
        if (typeof NhpRuntimeConfig !== 'undefined') {
            try {
                NhpRuntimeConfig.setCacheFromStorage({
                    [NhpRuntimeConfig.STORAGE_KEYS.projectDir]: normalized
                });
            } catch (_) { /* ignore */ }
        }
    }

    async function resolveProjectDir(forceRefresh = false) {
        if (!forceRefresh && resolveCache && Date.now() - resolveCacheAt < CACHE_TTL_MS) {
            return resolveCache;
        }

        let dir = await readStorageProjectDir();
        if (!dir) {
            dir = await fetchProjectDirFromNativeHost();
        }
        if (dir) {
            await persistProjectDir(dir);
            return dir;
        }

        if (typeof NhpRuntimeConfig !== 'undefined') {
            const cached = normalizeWinPath(NhpRuntimeConfig.getCached?.()?.projectDir);
            if (isValidProjectDir(cached)) {
                resolveCache = cached;
                resolveCacheAt = Date.now();
                return cached;
            }
        }

        resolveCache = '';
        resolveCacheAt = Date.now();
        return '';
    }

    async function resolveDataRoot(projectDir) {
        if (dataRootCache) return dataRootCache;
        const root = normalizeWinPath(projectDir || await resolveProjectDir());
        if (!root) return 'NHP_DATA';
        try {
            const result = await sendNativeHostMessage({ action: 'ping' });
            const nativeDataRoot = normalizeWinPath(result?.dataRoot);
            if (nativeDataRoot) {
                dataRootCache = nativeDataRoot;
                return nativeDataRoot;
            }
        } catch (_) { /* ignore */ }
        if (typeof NhpRuntimeConfig !== 'undefined' && NhpRuntimeConfig.dataRootFromProjectDir) {
            return NhpRuntimeConfig.dataRootFromProjectDir(root);
        }
        return joinWinPath(root, '..', 'NHP_DATA');
    }

    function invalidateCache() {
        resolveCache = '';
        dataRootCache = '';
        resolveCacheAt = 0;
    }

    function getRuntimeExtensionId() {
        try {
            return chrome?.runtime?.id || DEFAULT_EXTENSION_ID;
        } catch (_) {
            return DEFAULT_EXTENSION_ID;
        }
    }

    function buildRegisterScriptPath(projectDir) {
        const root = normalizeWinPath(projectDir);
        return root ? joinWinPath(root, REGISTER_SCRIPT_NAME) : REGISTER_SCRIPT_NAME;
    }

    function classifyNativeHostError(err) {
        const raw = String(err?.message || err || '').trim();
        if (/not found|Specified native messaging host/i.test(raw)) return 'not_registered';
        if (/forbidden/i.test(raw)) return 'forbidden';
        if (/Unsupported action/i.test(raw)) return 'host_outdated';
        if (/nativeMessaging unavailable/i.test(raw)) return 'permission_missing';
        return 'host_error';
    }

    function formatNativeHostError(err) {
        const raw = String(err?.message || err || '').trim();
        const extId = getRuntimeExtensionId();
        const kind = classifyNativeHostError(err);
        if (kind === 'not_registered') {
            return 'Native Messaging غير مسجّل — شغّل addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.bat مرة واحدة ثم أعد تحميل الإضافة.';
        }
        if (kind === 'forbidden') {
            return `Native Messaging مرفوض — معرّف الإضافة (${extId}) لا يطابق allowed_origins. أعد تشغيل addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.bat ${extId}`;
        }
        if (kind === 'host_outdated') {
            return 'Native Messaging متصل لكن المضيف قديم — أعد تشغيل سكربت التسجيل ثم أعد تحميل الإضافة.';
        }
        if (kind === 'permission_missing') {
            return 'صلاحية nativeMessaging غير متاحة في هذه الإضافة.';
        }
        return raw || 'Native Messaging غير متاح';
    }

    function buildNativeHostRegisterHint(projectDir) {
        const extId = getRuntimeExtensionId();
        const scriptPath = buildRegisterScriptPath(projectDir);
        return {
            extensionId: extId,
            registerScript: scriptPath,
            registerCommand: `"${scriptPath}" ${extId}`,
            messageAr:
                `لتشغيل السيرفرات من الإضافة: شغّل مرة واحدة (نقر مزدوج):\n${scriptPath}\n` +
                `أو من cmd:\naddon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.bat ${extId}\n` +
                'ثم أعد تحميل الإضافة من chrome://extensions'
        };
    }

    async function verifyNativeHostConnection(options = {}) {
        const silent = options.silent === true;
        try {
            const result = await sendNativeHostMessage({ action: 'ping' });
            if (result?.success) {
                const dir = normalizeWinPath(result.projectDir);
                nativeHostStatus = {
                    checked: true,
                    ok: true,
                    error: null,
                    errorKind: null,
                    checkedAt: Date.now(),
                    projectDir: isValidProjectDir(dir) ? dir : null
                };
                if (nativeHostStatus.projectDir) {
                    await persistProjectDir(nativeHostStatus.projectDir);
                }
                return nativeHostStatus;
            }
            throw new Error(result?.error || 'Native host ping failed');
        } catch (e) {
            const errMsg = formatNativeHostError(e);
            nativeHostStatus = {
                checked: true,
                ok: false,
                error: errMsg,
                errorKind: classifyNativeHostError(e),
                checkedAt: Date.now(),
                projectDir: null
            };
            if (!silent && typeof console !== 'undefined') {
                console.warn('[NHP] Native host:', errMsg);
            }
            return nativeHostStatus;
        }
    }

    async function ensureNativeHostReady(options = {}) {
        const stale =
            !nativeHostStatus.checkedAt ||
            Date.now() - nativeHostStatus.checkedAt > NATIVE_HOST_RECHECK_MS;
        if (!nativeHostStatus.ok || stale) {
            await verifyNativeHostConnection({ silent: options.silent !== false });
        }
        return nativeHostStatus;
    }

    function getNativeHostStatusSnapshot() {
        return { ...nativeHostStatus };
    }

    global.NhpPortablePaths = Object.freeze({
        NATIVE_HOST,
        DEFAULT_EXTENSION_ID,
        REGISTER_SCRIPT_NAME,
        PROJECT_DIR_STORAGE_KEY,
        PORTABLE_CONFIG_FILENAME,
        NATIVE_HOST_RECHECK_MS,
        isValidProjectDir,
        normalizeWinPath,
        joinWinPath,
        resolveProjectDir,
        resolveDataRoot,
        persistProjectDir,
        invalidateCache,
        getRuntimeExtensionId,
        buildRegisterScriptPath,
        buildNativeHostRegisterHint,
        formatNativeHostError,
        classifyNativeHostError,
        verifyNativeHostConnection,
        ensureNativeHostReady,
        getNativeHostStatusSnapshot,
        sendNativeHostMessage
    });
})(typeof globalThis !== 'undefined' ? globalThis : self);

/**
 * Node.js CommonJS API for local servers (ghost/creaty/pinterest/ai-bridge).
 * Browser/extension code uses global.NhpPortablePaths from the IIFE above.
 */
if (typeof module !== 'undefined' && module.exports && typeof process !== 'undefined' && process.versions && process.versions.node) {
    const fs = require('fs');
    const path = require('path');

    const DEFAULT_DATA_SUBDIRS = Object.freeze([
        'generated_designs',
        'server_logs',
        'server_profiles',
        'server_profiles_creaty',
        'server_profiles_creaty_preview',
        'server_profiles_pinterest',
        'profile_backups',
        'profile_backups_pinterest',
        'profile_browser_locks',
        'temp_uploads',
        'temp_uploads_ai_bridge',
        'temp_uploads_pinterest',
        'metadata_store',
        'backups',
        '.tmp',
        'archive'
    ]);

    let cachedPortable = null;
    let cachedKey = '';

    function normalizeNodePath(value) {
        return String(value || '').trim().replace(/\//g, path.sep).replace(/[\\/]+$/, '');
    }

    function resolveAppRoot(options = {}) {
        const envCandidates = [
            process.env.NHP_APP_ROOT,
            process.env.NHP_ROOT_DIR,
            process.env.NHP_ROOT,
            options.appRootHint,
            options.appRoot
        ];
        for (const raw of envCandidates) {
            const dir = normalizeNodePath(raw);
            if (!dir) continue;
            try {
                if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'manifest.json'))) {
                    return path.resolve(dir);
                }
            } catch (_) { /* try next */ }
        }
        const hint = normalizeNodePath(options.appRootHint || __dirname);
        return path.resolve(hint);
    }

    function readPortableConfig(appRoot) {
        try {
            const configPath = path.join(appRoot, 'portable.config.json');
            if (!fs.existsSync(configPath)) return null;
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (_) {
            return null;
        }
    }

    function resolveDataRoot(appRoot, config) {
        if (process.env.NHP_DATA_ROOT && String(process.env.NHP_DATA_ROOT).trim()) {
            return path.resolve(String(process.env.NHP_DATA_ROOT).trim());
        }
        const rel = String(config?.dataRoot || '../NHP_DATA').trim() || '../NHP_DATA';
        return path.resolve(appRoot, rel);
    }

    function getPortablePaths(options = {}) {
        const appRoot = resolveAppRoot(options);
        const config = readPortableConfig(appRoot);
        const dataRoot = resolveDataRoot(appRoot, config);
        const cacheKey = `${appRoot}||${dataRoot}`;
        if (!options.forceReload && cachedPortable && cachedKey === cacheKey) {
            return cachedPortable;
        }

        const pathMap = Object.assign({}, Object.fromEntries(DEFAULT_DATA_SUBDIRS.map((name) => [name === '.tmp' ? 'tmp' : name, name])), config?.paths || {});

        function get(name) {
            const key = String(name || '').trim();
            const rel = pathMap[key] || key;
            return path.join(dataRoot, rel);
        }

        function ensureDataDirs() {
            try {
                if (!fs.existsSync(dataRoot)) fs.mkdirSync(dataRoot, { recursive: true });
            } catch (_) { /* ignore */ }
            for (const name of DEFAULT_DATA_SUBDIRS) {
                try {
                    const dir = path.join(dataRoot, name);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                } catch (_) { /* ignore */ }
            }
            return true;
        }

        // Align process env for child tools / scripts.
        process.env.NHP_APP_ROOT = appRoot;
        process.env.NHP_ROOT = appRoot;
        process.env.NHP_ROOT_DIR = appRoot;
        process.env.NHP_DATA_ROOT = dataRoot;
        process.env.NHP_LOG_DIR = path.join(dataRoot, 'server_logs');

        const api = {
            appRoot,
            dataRoot,
            config,
            get,
            ensureDataDirs,
            join: (...parts) => path.join(dataRoot, ...parts.filter(Boolean))
        };

        cachedPortable = api;
        cachedKey = cacheKey;
        return api;
    }

    module.exports = {
        getPortablePaths,
        DEFAULT_EXTENSION_ID: 'bhhahkcjolghbigcognobplmgdbkmekb',
        REGISTER_SCRIPT_NAME: 'addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.bat'
    };
}
