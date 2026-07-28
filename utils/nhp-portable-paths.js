/**
 * Portable path resolution — project root (extension folder) and NHP_DATA sibling.
 * Used by background (importScripts) and UI pages (script tag).
 */
(function (global) {
    'use strict';

    const NATIVE_HOST = 'com.nhp.server_launcher';
    const DEFAULT_EXTENSION_ID = 'bhhahkcjolghbigcognobplmgdbkmekb';
    const REGISTER_SCRIPT_NAME = 'addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd';
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
            return 'Native Messaging غير مسجّل — شغّل addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd مرة واحدة ثم أعد تحميل الإضافة.';
        }
        if (kind === 'forbidden') {
            return `Native Messaging مرفوض — معرّف الإضافة (${extId}) لا يطابق allowed_origins. أعد تشغيل addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd ${extId}`;
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
                `أو من cmd:\naddon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd ${extId}\n` +
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
 * Never use process.cwd() as primary truth. Never persist absolute paths.
 */
if (typeof module !== 'undefined' && module.exports && typeof process !== 'undefined' && process.versions && process.versions.node) {
    const fs = require('fs');
    const path = require('path');

    const MARKER_JSON = 'nhp-portable.json';
    const MARKER_DOT = '.nhp-portable-root';
    const PORTABLE_CONFIG = 'portable.config.json';

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
        'archive',
        'cache',
        'downloads',
        'databases'
    ]);

    const DEFAULT_LAYOUT = Object.freeze({
        extension: '.',
        data: '../NHP_DATA',
        source: '../NHP_SOURCE'
    });

    let cachedPortable = null;
    let cachedKey = '';

    function normalizeNodePath(value) {
        return String(value || '').trim().replace(/\//g, path.sep).replace(/[\\/]+$/, '');
    }

    function isAbsolutePathLiteral(rel) {
        const s = String(rel || '').trim();
        return /^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('\\\\') || s.startsWith('/');
    }

    function assertRelativeName(rel, label) {
        const s = String(rel || '').trim().replace(/\\/g, '/');
        if (!s || isAbsolutePathLiteral(s) || s.split('/').includes('..') || path.isAbsolute(s)) {
            throw new Error(`[NHP Portable] ${label} must be a relative path without '..': got "${rel}"`);
        }
        return s.replace(/\//g, path.sep);
    }

    function looksLikeExtensionRoot(dir) {
        try {
            return fs.existsSync(path.join(dir, 'manifest.json'))
                || (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'ghost-server.js')));
        } catch (_) {
            return false;
        }
    }

    function readJsonSafe(filePath) {
        try {
            if (!fs.existsSync(filePath)) return null;
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (_) {
            return null;
        }
    }

    function findPortableRootFrom(startDir) {
        let cur = path.resolve(normalizeNodePath(startDir) || __dirname);
        for (let i = 0; i < 8; i += 1) {
            if (fs.existsSync(path.join(cur, MARKER_JSON)) || fs.existsSync(path.join(cur, MARKER_DOT))) {
                return cur;
            }
            // Sibling layout: Ext folder itself holds portable.config.json
            if (looksLikeExtensionRoot(cur) && fs.existsSync(path.join(cur, PORTABLE_CONFIG))) {
                return cur;
            }
            const parent = path.dirname(cur);
            if (!parent || parent === cur) break;
            cur = parent;
        }
        return null;
    }

    function readLayout(portableOrAppRoot) {
        const marker = readJsonSafe(path.join(portableOrAppRoot, MARKER_JSON));
        const cfg = readJsonSafe(path.join(portableOrAppRoot, PORTABLE_CONFIG));
        const folders = Object.assign({}, DEFAULT_LAYOUT, marker?.folders || {});
        // Legacy portable.config.json uses dataRoot relative to app root
        if (cfg?.dataRoot && !marker?.folders?.data) {
            folders.data = String(cfg.dataRoot).trim() || folders.data;
        }
        if (cfg?.appRoot && cfg.appRoot !== '.') {
            folders.extension = String(cfg.appRoot).trim() || folders.extension;
        }
        // Enforce relative-only names in marker
        for (const key of Object.keys(folders)) {
            const val = String(folders[key] || '').trim();
            if (!val) continue;
            if (isAbsolutePathLiteral(val)) {
                throw new Error(`[NHP Portable] nhp-portable.json folders.${key} must be relative, got absolute`);
            }
        }
        return { folders, marker, config: cfg };
    }

    function resolveAppRoot(options = {}) {
        // Explicit hint wins when it looks like the extension root (tests + servers).
        for (const raw of [options.appRootHint, options.appRoot]) {
            const dir = normalizeNodePath(raw);
            if (!dir) continue;
            try {
                if (looksLikeExtensionRoot(dir)) return path.resolve(dir);
            } catch (_) { /* try next */ }
        }
        const envCandidates = [
            process.env.NHP_APP_ROOT,
            process.env.NHP_ROOT_DIR,
            process.env.NHP_ROOT
        ];
        for (const raw of envCandidates) {
            const dir = normalizeNodePath(raw);
            if (!dir) continue;
            try {
                if (looksLikeExtensionRoot(dir)) return path.resolve(dir);
            } catch (_) { /* try next */ }
        }
        // Prefer Ext root when this file lives in utils/
        const fromUtils = path.resolve(__dirname, '..');
        if (looksLikeExtensionRoot(fromUtils)) return fromUtils;
        const hint = normalizeNodePath(options.appRootHint || __dirname);
        return path.resolve(hint);
    }

    function readPortableConfig(appRoot) {
        return readJsonSafe(path.join(appRoot, PORTABLE_CONFIG));
    }

    function resolveDataRoot(appRoot, config) {
        if (process.env.NHP_DATA_ROOT && String(process.env.NHP_DATA_ROOT).trim()) {
            const envData = path.resolve(String(process.env.NHP_DATA_ROOT).trim());
            const envApp = process.env.NHP_APP_ROOT
                ? path.resolve(String(process.env.NHP_APP_ROOT).trim())
                : '';
            // Trust env only when it was set for this same App Root (portable launcher).
            if (!envApp || samePath(envApp, appRoot)) {
                return envData;
            }
        }
        const layout = readLayout(appRoot);
        const rel = String(layout.folders.data || config?.dataRoot || '../NHP_DATA').trim() || '../NHP_DATA';
        if (isAbsolutePathLiteral(rel)) {
            throw new Error('[NHP Portable] data folder name must be relative');
        }
        return path.resolve(appRoot, rel);
    }

    function resolveSourceRoot(appRoot) {
        if (process.env.NHP_SOURCE_ROOT && String(process.env.NHP_SOURCE_ROOT).trim()) {
            const envSource = path.resolve(String(process.env.NHP_SOURCE_ROOT).trim());
            const envApp = process.env.NHP_APP_ROOT
                ? path.resolve(String(process.env.NHP_APP_ROOT).trim())
                : '';
            if (!envApp || samePath(envApp, appRoot)) {
                return envSource;
            }
        }
        const layout = readLayout(appRoot);
        const rel = String(layout.folders.source || '../NHP_SOURCE').trim() || '../NHP_SOURCE';
        if (isAbsolutePathLiteral(rel)) {
            throw new Error('[NHP Portable] source folder name must be relative');
        }
        return path.resolve(appRoot, rel);
    }

    function samePath(a, b) {
        try {
            return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
        } catch (_) {
            return false;
        }
    }

    function isPathInside(child, parent) {
        const rel = path.relative(path.resolve(parent), path.resolve(child));
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    }

    function assertWritableUnderData(targetPath, appRoot, dataRoot, sourceRoot) {
        const resolved = path.resolve(targetPath);
        if (!isPathInside(resolved, dataRoot)) {
            throw new Error(`[NHP Portable] Refusing write outside Data root: ${resolved}`);
        }
        // Sibling layout: Data is outside Extension — never allow mutable writes under Ext/Source.
        if (!isPathInside(dataRoot, appRoot) && isPathInside(resolved, appRoot)) {
            throw new Error(`[NHP Portable] Refusing write into Extension root: ${resolved}`);
        }
        if (sourceRoot && !samePath(sourceRoot, dataRoot)
            && !isPathInside(dataRoot, sourceRoot)
            && isPathInside(resolved, sourceRoot)) {
            throw new Error(`[NHP Portable] Refusing write into Source root: ${resolved}`);
        }
        return resolved;
    }

    function resolveWritableDataPath(relative, options = {}) {
        const api = getPortablePaths(options);
        const rel = assertRelativeName(relative, 'resolveWritableDataPath');
        const target = path.resolve(api.dataRoot, rel);
        return assertWritableUnderData(target, api.appRoot, api.dataRoot, api.sourceRoot);
    }

    function getPortablePaths(options = {}) {
        const appRoot = resolveAppRoot(options);
        const config = readPortableConfig(appRoot);
        const dataRoot = resolveDataRoot(appRoot, config);
        const sourceRoot = resolveSourceRoot(appRoot);
        const portableRoot = findPortableRootFrom(appRoot) || appRoot;
        const cacheKey = `${appRoot}||${dataRoot}||${sourceRoot}`;
        if (!options.forceReload && cachedPortable && cachedKey === cacheKey) {
            return cachedPortable;
        }

        const pathMap = Object.assign(
            {},
            Object.fromEntries(DEFAULT_DATA_SUBDIRS.map((name) => [name === '.tmp' ? 'tmp' : name, name])),
            config?.paths || {}
        );

        function get(name) {
            const key = String(name || '').trim();
            const rel = pathMap[key] || key;
            if (isAbsolutePathLiteral(rel) || String(rel).split(/[/\\]/).includes('..')) {
                throw new Error(`[NHP Portable] data subpath must be relative without '..': ${rel}`);
            }
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

        function assertNotExtensionWrite(targetPath) {
            return assertWritableUnderData(targetPath, appRoot, dataRoot, sourceRoot);
        }

        // Align process env for child tools / scripts.
        process.env.NHP_APP_ROOT = appRoot;
        process.env.NHP_ROOT = appRoot;
        process.env.NHP_ROOT_DIR = appRoot;
        process.env.NHP_DATA_ROOT = dataRoot;
        process.env.NHP_SOURCE_ROOT = sourceRoot;
        process.env.NHP_PORTABLE_ROOT = portableRoot;
        process.env.NHP_LOG_DIR = path.join(dataRoot, 'server_logs');

        if (options.ensure === true) {
            ensureDataDirs();
        }

        const api = {
            portableRoot,
            appRoot,
            extensionRoot: appRoot,
            dataRoot,
            sourceRoot,
            config,
            get,
            ensureDataDirs,
            assertNotExtensionWrite,
            resolveWritableDataPath: (relative) => resolveWritableDataPath(relative, { ...options, forceReload: true }),
            getPortableRoot: () => portableRoot,
            getExtensionRoot: () => appRoot,
            getDataRoot: () => dataRoot,
            getSourceRoot: () => sourceRoot,
            getLogsDir: () => get('server_logs'),
            getCacheDir: () => get('cache'),
            getDownloadsDir: () => get('downloads'),
            getProfilesDir: () => get('server_profiles'),
            getDatabaseDir: () => get('databases'),
            getGeneratedDir: () => get('generated_designs'),
            getTempDir: () => get('tmp'),
            getBackupsDir: () => get('backups'),
            join: (...parts) => path.join(dataRoot, ...parts.filter(Boolean))
        };

        cachedPortable = api;
        cachedKey = cacheKey;
        return api;
    }

    function getPortableRoot(options = {}) {
        return getPortablePaths(options).portableRoot;
    }
    function getExtensionRoot(options = {}) {
        return getPortablePaths(options).extensionRoot;
    }
    function getDataRoot(options = {}) {
        return getPortablePaths(options).dataRoot;
    }
    function getSourceRoot(options = {}) {
        return getPortablePaths(options).sourceRoot;
    }
    function getLogsDir(options = {}) {
        return getPortablePaths(options).getLogsDir();
    }
    function getCacheDir(options = {}) {
        return getPortablePaths(options).getCacheDir();
    }
    function getDownloadsDir(options = {}) {
        return getPortablePaths(options).getDownloadsDir();
    }
    function getProfilesDir(options = {}) {
        return getPortablePaths(options).getProfilesDir();
    }
    function getDatabaseDir(options = {}) {
        return getPortablePaths(options).getDatabaseDir();
    }
    function getGeneratedDir(options = {}) {
        return getPortablePaths(options).getGeneratedDir();
    }
    function getTempDir(options = {}) {
        return getPortablePaths(options).getTempDir();
    }
    function getBackupsDir(options = {}) {
        return getPortablePaths(options).getBackupsDir();
    }

    module.exports = {
        getPortablePaths,
        getPortableRoot,
        getExtensionRoot,
        getDataRoot,
        getSourceRoot,
        getLogsDir,
        getCacheDir,
        getDownloadsDir,
        getProfilesDir,
        getDatabaseDir,
        getGeneratedDir,
        getTempDir,
        getBackupsDir,
        resolveWritableDataPath,
        DEFAULT_DATA_SUBDIRS,
        DEFAULT_EXTENSION_ID: 'bhhahkcjolghbigcognobplmgdbkmekb',
        REGISTER_SCRIPT_NAME: 'addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd'
    };
}
