/**
 * background.js ÔÇö Niche Hunter Pro v9.0
 * ┘èÏ»┘èÏ▒ ┘àÏ¡Ï▒┘æ┘â Ïº┘ä┘üÏ¡ÏÁ: USPTO(┘éÏº┘å┘ê┘å┘è) + TeePublic(┘à┘åÏº┘üÏ│Ï®) + Ïº┘äÏ░┘âÏºÏí Ïº┘äÏºÏÁÏÀ┘åÏºÏ╣┘è + ÏúÏ¬┘àÏ¬Ï® Ïº┘äÏ▒┘üÏ╣
 *
 * TODO(launch): review nativeMessaging ÔÇö required for local server bridge; document host install steps.
 */
try {
    importScripts('peel_banana_engine.js');
} catch (e) {
    console.error('Failed to import peel_banana_engine.js', e);
}
try {
    importScripts('prompt_bag_image_prompts.js');
} catch (e) {
    console.error('Failed to import prompt_bag_image_prompts.js', e);
}
try {
    importScripts('utils/nhp-runtime-config.js');
} catch (e) {
    console.error('Failed to import utils/nhp-runtime-config.js', e);
}
try {
    importScripts('utils/oracle-instance-config.js');
} catch (e) {
    console.error('Failed to import utils/oracle-instance-config.js', e);
}
try {
    importScripts('utils/nhp-storage-migrate.js');
} catch (e) {
    console.error('Failed to import utils/nhp-storage-migrate.js', e);
}
try {
    importScripts('utils/cli-proxy-retry.js');
} catch (e) {
    console.error('Failed to import utils/cli-proxy-retry.js', e);
}
try {
    importScripts('utils/nhp-proxy-endpoints.js');
} catch (e) {
    console.error('Failed to import utils/nhp-proxy-endpoints.js', e);
}
try {
    importScripts('utils/nhp-local-servers.js');
} catch (e) {
    console.error('Failed to import utils/nhp-local-servers.js', e);
}
try {
    importScripts('utils/nhp-portable-paths.js');
} catch (e) {
    console.error('Failed to import utils/nhp-portable-paths.js', e);
}
try {
    importScripts('utils/nhp-setup-api.js');
} catch (e) {
    console.error('Failed to import utils/nhp-setup-api.js', e);
}
try {
    importScripts('utils/nhp-ai-cliproxy.js');
} catch (e) {
    console.error('Failed to import utils/nhp-ai-cliproxy.js', e);
}
try {
    importScripts('utils/nhp-cliproxy-management.js');
} catch (e) {
    console.error('Failed to import utils/nhp-cliproxy-management.js', e);
}
try {
    importScripts('utils/nhp-cliproxy-management.local.js');
} catch (_) {
    /* optional local secrets file (gitignored) */
}
try {
    importScripts('creaty-ai-supervisor-bridge.js');
} catch (e) {
    console.error('Failed to import creaty-ai-supervisor-bridge.js', e);
}
try {
    importScripts('creaty-store-generator.js');
} catch (e) {
    console.error('Failed to import creaty-store-generator.js', e);
}
try {
    importScripts('creaty-account-archive.js');
} catch (e) {
    console.error('Failed to import creaty-account-archive.js', e);
}
try {
    importScripts('utils/ap-account-activation.js');
} catch (e) {
    console.error('Failed to import utils/ap-account-activation.js', e);
}
try {
    importScripts('utils/seq-upload-guard.js');
} catch (e) {
    console.error('Failed to import utils/seq-upload-guard.js', e);
}
try {
    importScripts('modules/autopilot/ap-upload-monitor.js');
} catch (e) {
    console.warn('[NHP] Optional ap-upload-monitor.js not loaded ÔÇö upload monitor disabled:', e?.message || e);
}
try {
    importScripts('background/creaty-proxy-auth.js');
} catch (e) {
    console.error('Failed to import background/creaty-proxy-auth.js', e);
}
try {
    importScripts('emailcore-account-utils.js');
} catch (e) {
    console.error('Failed to import emailcore-account-utils.js', e);
}
try {
    importScripts('creaty-signup-trace.js');
} catch (e) {
    console.error('Failed to import creaty-signup-trace.js', e);
}
try {
    importScripts('creaty-handlers.js');
} catch (e) {
    console.error('Failed to import creaty-handlers.js', e);
}
if (typeof self.__creatyHandleMessage === 'function') {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        try {
            if (!req || typeof req !== 'object') return false;
            const action = req?.action;
            if (!action) return false;
            const isCreaty = String(action).startsWith('CREATY_') || action === 'EMAILCORE_SYNC_CREATY_CONFIG';
            if (!isCreaty) return false;
            return self.__creatyHandleMessage(req, sender, sendResponse);
        } catch (error) {
            console.warn('[CREATY] message guard recovered:', error?.message || error);
            try { sendResponse({ success: false, error: error?.message || String(error) }); } catch (_) { }
            return false;
        }
    });
} else {
    console.error('[CREATY] creaty-handlers.js did not register __creatyHandleMessage');
}
try {
    importScripts('utils/niche-file-naming.js');
} catch (e) {
    console.error('Failed to import utils/niche-file-naming.js', e);
}
try {
    importScripts('background/prompt-bag-handlers.js');
} catch (e) {
    console.error('Failed to import background/prompt-bag-handlers.js', e);
}
try {
    importScripts('utils/nhp-upload-queue.js');
} catch (e) {
    console.error('Failed to import utils/nhp-upload-queue.js', e);
}
try {
    importScripts('background/nhp-bulk-upload-handlers.js');
} catch (e) {
    console.error('Failed to import background/nhp-bulk-upload-handlers.js', e);
}
if (typeof NhpUploadQueue !== 'undefined' && NhpUploadQueue.scheduleWorkerTick) {
    NhpUploadQueue.scheduleWorkerTick(1500);
}
try {
    importScripts('emailcore-teepublic-pipeline.js');
} catch (e) {
    console.error('Failed to import emailcore-teepublic-pipeline.js', e);
}
try {
    importScripts('emailcore-handlers.js');
} catch (e) {
    console.error('Failed to import emailcore-handlers.js', e);
}
try {
    importScripts('creaty-ai-classify.js');
} catch (e) {
    console.error('Failed to import creaty-ai-classify.js', e);
}
try {
    importScripts('modules/radar/teepublic-extract-shared.js');
} catch (e) {
    console.error('Failed to import teepublic-extract-shared.js', e);
}
try {
    importScripts('background/seo-gemini-helpers.js');
} catch (e) {
    console.error('Failed to import background/seo-gemini-helpers.js', e);
}
try {
    importScripts('background/niche-cache-ttl.js');
} catch (e) {
    console.error('Failed to import background/niche-cache-ttl.js', e);
}
try {
    importScripts('background/uspto-queue-persistence.js');
} catch (e) {
    console.error('Failed to import background/uspto-queue-persistence.js', e);
}
try {
    importScripts('background/uspto-handlers.js');
} catch (e) {
    console.error('Failed to import background/uspto-handlers.js', e);
}
try {
    importScripts('background/canva-handlers.js');
} catch (e) {
    console.warn('[NHP] Canva handlers not loaded:', e?.message || e);
}
if (typeof self.__canvaHandleMessage === 'function') {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        try {
            if (!req || typeof req !== 'object') return false;
            const action = req?.action;
            if (!action || !String(action).startsWith('CANVA_')) return false;
            return self.__canvaHandleMessage(req, sender, sendResponse);
        } catch (error) {
            console.warn('[CANVA] message guard recovered:', error?.message || error);
            try { sendResponse({ success: false, error: error?.message || String(error) }); } catch (_) { }
            return false;
        }
    });
} else {
    console.warn('[CANVA] canva-handlers.js did not register __canvaHandleMessage ÔÇö Canva popup/OAuth disabled');
}

(function seedCliProxyManagementKey() {
    try {
        const mgmt = typeof NhpCliProxyManagement !== 'undefined' ? NhpCliProxyManagement : null;
        const localKey = String(globalThis.NhpCliProxyManagementLocal?.managementKey || '').trim();
        if (mgmt && localKey) {
            mgmt.seedManagementKeyIfEmpty(localKey).catch(() => {});
        }
    } catch (_) { /* optional */ }
})();

const _cliProxy = typeof NhpCliProxyRetry !== 'undefined' ? NhpCliProxyRetry : null;
const sleepMs = _cliProxy?.sleepMs || ((ms) => new Promise((r) => setTimeout(r, ms)));
const isCliProxyHostBaseUrl = _cliProxy?.isCliProxyHostBaseUrl || ((baseUrl) => /127\.0\.0\.1:8317|localhost:8317|cliproxy-?api-ywrp\.onrender\.com/i.test(String(baseUrl || '')));
const isCliProxyRetryableFailure = _cliProxy?.isCliProxyRetryableFailure || (() => false);
const isOpenAiCompatibleEmptyResult = _cliProxy?.isOpenAiCompatibleEmptyResult || (() => true);
const broadcastCliProxyRetryStatus = _cliProxy?.broadcastCliProxyRetryStatus || (() => { });
const CLI_PROXY_RETRY_INITIAL_DELAY_MS = _cliProxy?.RETRY?.INITIAL_DELAY_MS ?? 2500;

const NHP_BACKGROUND_PORTS = Object.freeze({
    heartbeat: 'nhp-emailcore-lite-heartbeat-v1'
});
const NHP_TRANSIENT_RECOVERY_KEYS = [
    'apHeartbeat',
    'nhpBackgroundLastError',
    'nhpBackgroundRecoveredAt',
    'nhpConnectionState',
    'nhpPendingRuntimePort',
    'nhpRuntimePortState'
];

function nhpSafeErrorMessage(error) {
    return error?.message || String(error || 'unknown_error');
}

async function nhpResetTransientRuntimeState(reason = 'startup') {
    try {
        const recoveredAt = Date.now();
        if (chrome.storage?.session?.remove) {
            await chrome.storage.session.remove(NHP_TRANSIENT_RECOVERY_KEYS);
            await chrome.storage.session.set({ nhpBackgroundRecoveredAt: recoveredAt, nhpBackgroundRecoveryReason: reason });
        }
        await chrome.storage.local.remove(['nhpConnectionState', 'nhpPendingRuntimePort', 'nhpRuntimePortState']);
        await chrome.storage.local.set({ nhpBackgroundRecoveredAt: recoveredAt, nhpBackgroundRecoveryReason: reason });
    } catch (error) {
        console.warn('[NHP Recovery] transient reset failed:', nhpSafeErrorMessage(error));
    }
}

self.addEventListener?.('error', (event) => {
    try {
        chrome.storage?.session?.set?.({
            nhpBackgroundLastError: nhpSafeErrorMessage(event?.error || event?.message),
            nhpBackgroundLastErrorAt: Date.now()
        });
    } catch (_) { }
});

self.addEventListener?.('unhandledrejection', (event) => {
    try {
        chrome.storage?.session?.set?.({
            nhpBackgroundLastError: nhpSafeErrorMessage(event?.reason),
            nhpBackgroundLastErrorAt: Date.now()
        });
    } catch (_) { }
});
const CLI_PROXY_RETRY_MAX_DELAY_MS = _cliProxy?.RETRY?.MAX_DELAY_MS ?? 12000;
const CLI_PROXY_RETRY_BACKOFF_FACTOR = _cliProxy?.RETRY?.BACKOFF_FACTOR ?? 1.45;
const CLI_PROXY_REQUEST_TIMEOUT_MS = _cliProxy?.RETRY?.REQUEST_TIMEOUT_MS ?? 120000;
const CLI_PROXY_STUDIO_RENAME_MAX_ATTEMPTS = _cliProxy?.RETRY?.STUDIO_RENAME_MAX_ATTEMPTS ?? 4;
const CLI_PROXY_STUDIO_RENAME_TIMEOUT_MS = 25000;
const CLI_PROXY_SEO_GPT_MAX_ATTEMPTS = 3;
const CLI_PROXY_SEO_GPT_TIMEOUT_MS = 45000;

function nhpUrl(port, path = '') {
    if (typeof NhpRuntimeConfig !== 'undefined') {
        return NhpRuntimeConfig.localUrl(port, path);
    }
    const pathStr = path ? (String(path).startsWith('/') ? path : `/${path}`) : '';
    return `http://127.0.0.1:${port}${pathStr}`;
}

const NHP_LOG_ONCE_KEYS = new Set();
function nhpLogOnce(key, level, message, details) {
    if (NHP_LOG_ONCE_KEYS.has(key)) return;
    NHP_LOG_ONCE_KEYS.add(key);
    const payload = details !== undefined ? [message, details] : [message];
    const fn = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.info);
    fn(...payload);
}

let localBridgeOnlineCache = { ok: false, checkedAt: 0 };
const LOCAL_BRIDGE_CHECK_TTL_MS = 60000;

async function isLocalManagerBridgeOnline(forceRefresh = false) {
    if (!forceRefresh && Date.now() - localBridgeOnlineCache.checkedAt < LOCAL_BRIDGE_CHECK_TTL_MS) {
        return localBridgeOnlineCache.ok;
    }
    let ok = false;
    try {
        await fetchJsonWithTimeout(nhpUrl(3009, '/api/ping'), {}, 1500);
        ok = true;
    } catch (_) {
        try {
            await fetchJsonWithTimeout(nhpUrl(3009, '/api/status'), {}, 1500);
            ok = true;
        } catch (__) { /* optional manager offline */ }
    }
    localBridgeOnlineCache = { ok, checkedAt: Date.now() };
    if (!ok) {
        nhpLogOnce(
            'local_bridge_offline',
            'info',
            '[NHP] Local bridge (127.0.0.1:3009) offline ÔÇö optional fallback; register Native Messaging for server control.'
        );
    }
    return ok;
}

async function tryLocalBridgeExecute(bridgeCommand) {
    if (!(await isLocalManagerBridgeOnline())) {
        return { success: false, skipped: true, reason: 'bridge_offline' };
    }
    try {
        const bridgeRes = await fetch(nhpUrl(3009, '/api/execute'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: wrapNhpLaunchCommand(bridgeCommand) }),
            signal: AbortSignal.timeout(LOCAL_BRIDGE_EXECUTE_TIMEOUT_MS)
        });
        if (!bridgeRes.ok) {
            const bodyText = await bridgeRes.text().catch(() => '');
            return { success: false, error: bodyText || `Bridge returned ${bridgeRes.status}` };
        }
        return { success: true, source: 'local_bridge' };
    } catch (error) {
        return { success: false, error: error?.message || String(error) };
    }
}

function buildNativeHostLauncherError(projectDir, nativeError) {
    const hint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
        ? NhpPortablePaths.buildNativeHostRegisterHint(projectDir)
        : null;
    return {
        success: false,
        source: 'native_host_missing',
        nativeHostRequired: true,
        nativeHostOk: false,
        error: nativeError || hint?.messageAr || 'Native Messaging Ï║┘èÏ▒ ┘àÏ│Ï¼┘æ┘ä.',
        registerScript: hint?.registerScript || '',
        registerCommand: hint?.registerCommand || '',
        extensionId: hint?.extensionId || (typeof chrome !== 'undefined' ? chrome.runtime?.id : '')
    };
}

function getNhpProjectDir() {
    if (typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.normalizeWinPath) {
        const cachedPortable = NhpPortablePaths.normalizeWinPath(
            typeof NhpRuntimeConfig !== 'undefined' ? NhpRuntimeConfig.getCached().projectDir : ''
        );
        if (NhpPortablePaths.isValidProjectDir(cachedPortable)) return cachedPortable;
    }
    if (typeof NhpRuntimeConfig !== 'undefined') {
        return NhpRuntimeConfig.getCached().projectDir;
    }
    return '';
}

async function ensureNhpProjectDirResolved(forceRefresh = false) {
    if (typeof NhpPortablePaths !== 'undefined' && typeof NhpPortablePaths.resolveProjectDir === 'function') {
        const resolved = await NhpPortablePaths.resolveProjectDir(forceRefresh);
        if (resolved) return resolved;
    }
    const cached = getNhpProjectDir();
    return cached || '';
}

async function executeNhpLauncherScript(scriptPath, {
    interactive = false,
    terminal = false,
    serverId = '',
    command = 'start',
    port = 0
} = {}) {
    const projectDir = await ensureNhpProjectDirResolved();
    const fullPath = String(scriptPath || '').trim();
    if (!fullPath) {
        return {
            success: false,
            serverId,
            command,
            port,
            error: 'Launcher script path is missing.'
        };
    }
    if (!projectDir) {
        const hint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
            ? NhpPortablePaths.buildNativeHostRegisterHint('')
            : null;
        return {
            success: false,
            serverId,
            command,
            port,
            nativeHostRequired: true,
            error: hint?.messageAr || 'Project directory is not configured. Run Register_NHP_Native_Messaging_User.bat once, then reload the extension.',
            registerScript: hint?.registerScript || '',
            registerCommand: hint?.registerCommand || ''
        };
    }

    const escapedPath = fullPath.replace(/'/g, "''");
    const windowStyle = (interactive || terminal) ? 'Normal' : 'Hidden';
    let nativeCommand = '';
    if (terminal) {
        nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'cd /d ''${projectDir.replace(/'/g, "''")}'' & call ''${escapedPath}''' -WindowStyle Normal`;
    } else {
        nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${escapedPath}' -WindowStyle ${windowStyle}`;
    }
    const bridgeCommand = terminal
        ? `cmd.exe /k "cd /d "${projectDir}" && call "${fullPath}""`
        : `cmd.exe /c "${fullPath}"`;

    const nativeStatus = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.ensureNativeHostReady
        ? await NhpPortablePaths.ensureNativeHostReady({ silent: true })
        : { ok: false, error: 'Native host helper unavailable' };

    if (!nativeStatus.ok) {
        nhpLogOnce(
            'native_host_missing',
            'warn',
            '[NHP Local Server] Native messaging unavailable',
            { serverId, command, error: nativeStatus.error }
        );
        return {
            ...buildNativeHostLauncherError(projectDir, nativeStatus.error),
            serverId,
            command,
            port,
            scriptPath: fullPath
        };
    }

    try {
        const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
            action: 'execute_command',
            command: nativeCommand
        });
        if (result && result.success) {
            return {
                success: true,
                serverId,
                command,
                port,
                scriptPath: fullPath,
                source: 'native_messaging'
            };
        }
        if (result && result.success === false) {
            nhpLogOnce(
                `native_launch_failed_${serverId || 'generic'}`,
                'warn',
                '[NHP Local Server] Native launcher returned failure',
                { serverId, command, port, error: result.error || result.message }
            );
        }
    } catch (error) {
        nhpLogOnce(
            'native_host_runtime_error',
            'warn',
            '[NHP Local Server] Native messaging error',
            { serverId, command, error: error?.message || error }
        );
    }

    const bridgeResult = await tryLocalBridgeExecute(bridgeCommand);
    if (bridgeResult.success) {
        return {
            success: true,
            serverId,
            command,
            port,
            scriptPath: fullPath,
            source: bridgeResult.source || 'local_bridge'
        };
    }
    if (!bridgeResult.skipped) {
        nhpLogOnce(
            'local_bridge_execute_failed',
            'warn',
            '[NHP Local Server] Local bridge unavailable',
            { serverId, command, error: bridgeResult.error }
        );
    }

    const manualHint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildRegisterScriptPath
        ? NhpPortablePaths.buildRegisterScriptPath(projectDir)
        : fullPath;
    return {
        success: false,
        serverId,
        command,
        port,
        scriptPath: fullPath,
        source: 'unavailable',
        error: `Ï¬Ï╣Ï░Ï▒ Ï¬Ï┤Ï║┘è┘ä Ïº┘äÏ│┘âÏ▒Ï¿Ï¬ Ï¬┘ä┘éÏºÏª┘èÏº┘ï ÔÇö Ï┤Ï║┘æ┘ä┘ç ┘èÏ»┘ê┘èÏº┘ï:\n${fullPath}`,
        manualScript: fullPath,
        registerScript: manualHint
    };
}

function getNhpChromePath() {
    if (typeof NhpRuntimeConfig !== 'undefined') {
        return NhpRuntimeConfig.defaultChromePath(NhpRuntimeConfig.getCached().backendMode);
    }
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

function wrapNhpLaunchCommand(command) {
    if (typeof NhpRuntimeConfig !== 'undefined') {
        return NhpRuntimeConfig.wrapCommandForBackend(command);
    }
    return command;
}

const GHOST_SERVER_PORT = 3019;
const AI_BRIDGE_SERVER_PORT = 3031;
function getGhostServerUrl(port = GHOST_SERVER_PORT) {
    const p = Number(port) || GHOST_SERVER_PORT;
    return `http://127.0.0.1:${p}`;
}
function getAiBridgeServerUrl() {
    return nhpUrl(AI_BRIDGE_SERVER_PORT);
}
function getDefaultCliProxyBaseUrl() {
    if (typeof NhpRuntimeConfig !== 'undefined') {
        return NhpRuntimeConfig.defaultProxyBaseUrl();
    }
    return 'https://oracle-api.emailcore.app/cliproxy/v1';
}

function shouldAttemptLocalGhostBootstrap() {
    if (typeof NhpRuntimeConfig === 'undefined') return true;
    const cached = typeof NhpRuntimeConfig.getCached === 'function' ? NhpRuntimeConfig.getCached() : null;
    const proxyBaseUrl = String(cached?.proxyBaseUrl || '').trim();
    if (!proxyBaseUrl) return true;
    if (typeof NhpRuntimeConfig.isCliProxyLocalBaseUrl === 'function') {
        return NhpRuntimeConfig.isCliProxyLocalBaseUrl(proxyBaseUrl);
    }
    return /:(8317)(\/|$)/i.test(proxyBaseUrl) && /127\.0\.0\.1|localhost/i.test(proxyBaseUrl);
}

(async function initNhpRuntimeConfig() {
    if (typeof NhpStorageMigrate !== 'undefined') {
        try {
            const mig = await NhpStorageMigrate.runStorageMigration();
            if (mig?.migrated) {
                console.log('[NHP] storage migration v40 applied:', mig.keys || []);
            }
        } catch (e) {
            console.warn('[NHP] storage migration skipped:', e?.message || e);
        }
    }
    if (typeof NhpRuntimeConfig === 'undefined') return;
    await NhpRuntimeConfig.loadFromStorage();
    if (typeof NhpPortablePaths !== 'undefined' && typeof NhpPortablePaths.resolveProjectDir === 'function') {
        try {
            await NhpPortablePaths.resolveProjectDir();
        } catch (e) {
            console.warn('[NHP] project dir auto-resolve skipped:', e?.message || e);
        }
    }
    if (typeof NhpPortablePaths !== 'undefined' && typeof NhpPortablePaths.verifyNativeHostConnection === 'function') {
        try {
            await NhpPortablePaths.verifyNativeHostConnection({ silent: true });
        } catch (e) {
            console.warn('[NHP] native host probe skipped:', e?.message || e);
        }
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            const keys = Object.values(NhpRuntimeConfig.STORAGE_KEYS);
            if (!keys.some((k) => changes[k])) return;
            NhpRuntimeConfig.loadFromStorage().catch(() => { });
        });
    }
})();

// ÔöÇÔöÇÔöÇ STATE FLAGS ÔöÇÔöÇÔöÇ
let uStopped = false;
let tpStopped = false;
let apStopped = false;
const AP_UPLOAD_QUEUE_STATE_KEY = 'ap_upload_queue_state';
const AP_ADMIN_USER_SELECTION_SAVED_KEY = 'ap_admin_user_selection_saved';
const AP_UPLOAD_MONITOR_LOG_KEY = (typeof NhpApUploadMonitor !== 'undefined' && NhpApUploadMonitor.STORAGE_KEY)
    ? NhpApUploadMonitor.STORAGE_KEY
    : 'ap_upload_monitor_log';
let apQueueStateCache = null;
let apUploadMonitorRun = null;
/** Serializes autopilot runs ÔÇö prevents overlapping startAPProcess / parallel Ghost /upload calls. */
let apProcessChain = Promise.resolve();
let apProcessRunning = false;

function enqueueStartAPProcess(config) {
    apProcessRunning = true;
    const run = async () => {
        try {
            const platformKey = `ap_accounts_${config?.platform || 'teepublic'}`;
            const accRes = await new Promise((resolve) => chrome.storage.local.get([platformKey, 'ap_accounts'], resolve));
            const storageAccounts = accRes[platformKey] || accRes.ap_accounts || [];
            const allowedIds = Array.isArray(config?.selectedAccountIds)
                ? config.selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            const resolved = resolveApConfiguredAccounts(config, storageAccounts, allowedIds);
            const scopedConfig = resolved.config;
            const earlyAccounts = resolved.accounts;
            console.log('[Autopilot][Upload] enqueue scoped emails:', earlyAccounts.map((acc) => acc?.email).filter(Boolean));
            if (!earlyAccounts.length) {
                logApProcessAbort('┘äÏº Ï¬┘êÏ¼Ï» Ï¡Ï│ÏºÏ¿ÏºÏ¬ ┘àÏ¡Ï»Ï»Ï® ┘ä┘äÏ▒┘üÏ╣', { path: 'enqueue_no_accounts', allowedIds });
                throw new Error('┘äÏº Ï¬┘êÏ¼Ï» Ï¡Ï│ÏºÏ¿ÏºÏ¬ ┘àÏ¡Ï»Ï»Ï® ┘ä┘äÏ▒┘üÏ╣');
            }
            const earlyFirst = earlyAccounts[0];
            if (earlyFirst) {
                await publishApQueueState({
                    __replace: true,
                    platform: scopedConfig.platform || 'teepublic',
                    isRunning: true,
                    stopped: false,
                    overallStatus: 'uploading',
                    selectedAccountIds: allowedIds,
                    selectedAccountCount: earlyAccounts.length,
                    completedAccountCount: 0,
                    completedUploads: 0,
                    perAccount: earlyAccounts.map((acc, index) => ({
                        accountId: String(acc?.id || acc?.email || ''),
                        accountLabel: acc?.displayName || acc?.email || 'Unknown',
                        accountEmail: acc?.email || '',
                        status: index === 0 ? 'uploading' : 'waiting',
                        uploadedCount: 0,
                        plannedCount: 0
                    })),
                    ...buildApCurrentAccountFields(earlyFirst, { uploadedCount: 0, plannedCount: 0 }, 0, earlyAccounts.length)
                }, { replace: true });
            }
            const guard = typeof NhpSeqUploadGuard !== 'undefined' ? NhpSeqUploadGuard : null;
            if (guard) {
                const check = await guard.assertSeqGuard({
                    enqueue: { fn: enqueueStartAPProcess, needles: guard.MARKERS.enqueue }
                }, 'enqueueStartAPProcess');
                if (!check.ok) {
                    throw new Error('SEQ_UPLOAD_GUARD: sequential upload fix compromised');
                }
            }
            await startAPProcess(scopedConfig, { __seqGuardBypass: true });
        } catch (err) {
            console.error('[AP] startAPProcess failed:', err);
            const reason = String(err?.message || '');
            const toast = reason.includes('SEQ_UPLOAD_GUARD')
                ? '­ƒöÆ ┘üÏ┤┘ä Ï¿Ï»Ïí Ïº┘äÏ▒┘üÏ╣ ÔÇö Ï¡┘àÏº┘èÏ® Ïº┘äÏ▒┘üÏ╣ Ïº┘ä┘àÏ¬Ï│┘äÏ│┘ä Ï║┘èÏ▒ ┘à┘üÏ╣┘æ┘äÏ®'
                : `ÔÜá´©Å ┘üÏ┤┘ä Ï¿Ï»Ïí Ïº┘äÏ▒┘üÏ╣: ${reason || 'Ï«ÏÀÏú Ï║┘èÏ▒ ┘àÏ╣Ï▒┘ê┘ü'}`;
            if (typeof abortApUploadEarly === 'function') {
                await abortApUploadEarly(toast, { abortDetail: { path: 'enqueue_catch', message: reason } });
            } else {
                chrome.runtime.sendMessage({ action: 'ap_update', done: true, success: false, toast, type: 'error' });
                stopHeartbeat();
            }
        } finally {
            apProcessRunning = false;
        }
    };
    const next = apProcessChain.catch(() => null).then(run);
    apProcessChain = next.catch(() => null);
    return next;
}
function normalizeApQueueStatus(status, fallback = 'waiting') {
    const value = String(status || '').trim().toLowerCase();
    if (['waiting', 'ready', 'uploading', 'uploaded', 'published', 'skipped', 'stopped', 'failed'].includes(value)) return value;
    return fallback;
}
function getApQueuePercent(completed, total) {
    const safeTotal = Math.max(0, Number(total) || 0);
    if (safeTotal <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((Number(completed) || 0) / safeTotal) * 100)));
}
function getApQueueStatusLabel(state) {
    if (state.isRunning) return 'uploading';
    if (state.stopped) return 'stopped';
    if ((state.completedUploads || 0) >= (state.totalPlannedUploads || 0) && (state.totalPlannedUploads || 0) > 0) return 'uploaded';
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    const perDesign = Array.isArray(state.perDesign) ? state.perDesign : [];
    const hasFailedAccounts = perAccount.some((item) => normalizeApQueueStatus(item?.status) === 'failed');
    const hasFailedDesigns = perDesign.some((item) => normalizeApQueueStatus(item?.status) === 'failed');
    if (hasFailedAccounts || hasFailedDesigns || (state.failedAccounts || 0) > 0) return 'failed';
    return 'ready';
}
function resolveApPerAccountLookupKeys(item) {
    const keys = [];
    const id = String(item?.accountId || item?.id || '').trim();
    const email = String(item?.accountEmail || item?.email || '').trim();
    if (id) keys.push(id);
    if (email) keys.push(email);
    return keys;
}

function reorderApPerAccountForSelection(perAccount, selectedAccountIds) {
    if (!Array.isArray(perAccount) || perAccount.length === 0) return perAccount;
    const allowedIds = Array.isArray(selectedAccountIds)
        ? selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    if (!allowedIds.length) return perAccount;
    const allowed = new Set(allowedIds);
    const byKey = new Map();
    perAccount.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        resolveApPerAccountLookupKeys(item).forEach((key) => {
            if (allowed.has(key) && !byKey.has(key)) byKey.set(key, item);
        });
    });
    const ordered = [];
    const seen = new Set();
    allowedIds.forEach((id) => {
        const item = byKey.get(id);
        if (!item) return;
        const stableId = String(item.accountId || item.accountEmail || id).trim();
        if (!stableId || seen.has(stableId)) return;
        seen.add(stableId);
        ordered.push(item);
    });
    return ordered.length ? ordered : perAccount.filter((item) => {
        const keys = resolveApPerAccountLookupKeys(item);
        return keys.some((key) => allowed.has(key));
    });
}

function syncApQueueCurrentAccountFromPerAccount(state) {
    if (!state || typeof state !== 'object') return state;
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    if (!perAccount.length) return state;
    const active = perAccount.find((item) => normalizeApQueueStatus(item?.status) === 'uploading')
        || perAccount.find((item) => {
            const status = normalizeApQueueStatus(item?.status);
            return status === 'waiting' || status === 'ready';
        })
        || perAccount[0];
    if (!active) return state;
    const index = perAccount.indexOf(active);
    return {
        ...state,
        ...buildApCurrentAccountFields(
            { id: active.accountId, email: active.accountEmail, displayName: active.accountLabel },
            active,
            Math.max(0, index),
            perAccount.length
        )
    };
}

function apQueueStateHasStaleUploadMarkers(state) {
    if (!state || typeof state !== 'object' || state.isRunning) return false;
    const status = String(state.overallStatus || '').toLowerCase();
    if (['uploading', 'running'].includes(status)) return true;
    if (String(state.currentAccountEmail || '').trim()) return true;
    if (String(state.currentAccountId || '').trim()) return true;
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    return perAccount.some((item) => normalizeApQueueStatus(item?.status) === 'uploading');
}

function sanitizeIdleApQueueState(state) {
    if (!state || typeof state !== 'object') return null;
    if (state.isRunning) return state;
    if (!apQueueStateHasStaleUploadMarkers(state)) return state;
    const perAccount = (Array.isArray(state.perAccount) ? state.perAccount : []).map((item) => {
        const status = normalizeApQueueStatus(item?.status);
        return {
            ...item,
            status: status === 'uploading' ? 'waiting' : status
        };
    });
    const completedUploads = Math.max(0, Number(state.completedUploads) || 0);
    const totalPlannedUploads = Math.max(0, Number(state.totalPlannedUploads) || 0);
    let overallStatus = String(state.overallStatus || 'waiting').toLowerCase();
    if (['uploading', 'running'].includes(overallStatus)) {
        overallStatus = totalPlannedUploads > 0 && completedUploads >= totalPlannedUploads ? 'uploaded' : 'waiting';
    }
    return {
        ...state,
        isRunning: false,
        overallStatus,
        perAccount,
        ...clearApCurrentAccountFields()
    };
}

async function publishApQueueState(nextState, options = {}) {
    const replace = options.replace === true || nextState?.__replace === true;
    const payload = nextState && typeof nextState === 'object' ? { ...nextState } : {};
    delete payload.__replace;
    apQueueStateCache = replace
        ? { ...payload, updatedAt: new Date().toISOString() }
        : {
            ...(apQueueStateCache || {}),
            ...payload,
            updatedAt: new Date().toISOString()
        };
    const selectionIds = Array.isArray(apQueueStateCache.selectedAccountIds)
        ? apQueueStateCache.selectedAccountIds
        : [];
    if (Array.isArray(apQueueStateCache.perAccount)) {
        apQueueStateCache.perAccount = reorderApPerAccountForSelection(
            apQueueStateCache.perAccount,
            selectionIds
        );
        if (replace || Object.prototype.hasOwnProperty.call(payload, 'perAccount')) {
            apQueueStateCache = syncApQueueCurrentAccountFromPerAccount(apQueueStateCache);
        }
    } else if (replace || apQueueStateCache.isRunning === false) {
        apQueueStateCache.perAccount = [];
    }
    if (replace && !Object.prototype.hasOwnProperty.call(payload, 'perDesign')) {
        apQueueStateCache.perDesign = [];
    }
    apQueueStateCache.overallStatus = getApQueueStatusLabel(apQueueStateCache);
    apQueueStateCache.overallProgressPercent = getApQueuePercent(apQueueStateCache.completedUploads, apQueueStateCache.totalPlannedUploads);
    if (apQueueStateCache.isRunning !== true) {
        apQueueStateCache = sanitizeIdleApQueueState(apQueueStateCache) || apQueueStateCache;
    }
    await setStorage({ [AP_UPLOAD_QUEUE_STATE_KEY]: apQueueStateCache });
    try {
        await chrome.runtime.sendMessage({ action: 'ap_queue_state', data: apQueueStateCache });
    } catch (_) { }
    return apQueueStateCache;
}

/** Service worker restart kills in-flight uploads ÔÇö clear stale isRunning queue snapshots. */
void (async function resetStaleApUploadQueueOnServiceWorkerBoot() {
    try {
        const res = await new Promise((resolve) => chrome.storage.local.get([AP_UPLOAD_QUEUE_STATE_KEY], resolve));
        const state = res?.[AP_UPLOAD_QUEUE_STATE_KEY];
        if (!state?.isRunning) return;
        apProcessRunning = false;
        await publishApQueueState({
            __replace: true,
            isRunning: false,
            stopped: false,
            overallStatus: 'waiting',
            finishedAt: new Date().toISOString(),
            selectedAccountIds: [],
            selectedAccountCount: 0,
            completedAccountCount: 0,
            completedUploads: 0,
            totalPlannedUploads: 0,
            overallProgressPercent: 0,
            perAccount: [],
            perDesign: [],
            ...clearApCurrentAccountFields()
        }, { replace: true });
        console.warn('[AP] Cleared stale upload queue after service worker restart');
    } catch (error) {
        console.warn('[AP] stale upload queue reset failed:', error?.message || error);
    }
})();

function buildApCurrentAccountFields(acc, accountState, index, total) {
    if (!acc) return {};
    return {
        currentAccountId: String(acc?.id || acc?.email || ''),
        currentAccountEmail: acc?.email || '',
        currentAccountLabel: acc?.displayName || acc?.email?.split?.('@')?.[0] || '',
        currentAccountIndex: (Number(index) || 0) + 1,
        currentAccountTotal: Number(total) || 0,
        currentAccountUploaded: Number(accountState?.uploadedCount) || 0,
        currentAccountPlanned: Number(accountState?.plannedCount) || 0
    };
}

function clearApCurrentAccountFields() {
    return {
        currentAccountId: '',
        currentAccountEmail: '',
        currentAccountLabel: '',
        currentAccountIndex: 0,
        currentAccountTotal: 0,
        currentAccountUploaded: 0,
        currentAccountPlanned: 0
    };
}

function buildApFailedRetryConfig(lastConfig = {}, state = {}) {
    const perAccount = Array.isArray(state.perAccount) ? state.perAccount : [];
    const perDesign = Array.isArray(state.perDesign) ? state.perDesign : [];
    const failedDesigns = perDesign.filter((item) => normalizeApQueueStatus(item?.status) === 'failed' && item?.accountId);
    if (failedDesigns.length === 0) {
        return null;
    }

    // Include accounts that own failed designs even if account status is uploaded (partial success).
    const failedAccountIds = new Set(failedDesigns.map((item) => String(item.accountId || '')));
    const sourceAccounts = Array.isArray(lastConfig.accounts) ? lastConfig.accounts : [];
    let retryAccounts = sourceAccounts.filter((acc) => {
        const id = String(acc?.id || acc?.email || '');
        return id && failedAccountIds.has(id);
    });
    if (retryAccounts.length === 0) {
        retryAccounts = [...failedAccountIds].map((accountId) => {
            const fromState = perAccount.find((item) => String(item.accountId || item.accountEmail || '') === accountId);
            return {
                id: accountId,
                email: fromState?.accountEmail || accountId,
                displayName: fromState?.accountLabel || ''
            };
        }).map((acc) => sourceAccounts.find((src) =>
            String(src?.id || '') === String(acc.id) || String(src?.email || '') === String(acc.email)
        )).filter(Boolean);
    }
    if (retryAccounts.length === 0) return null;

    const retryPlan = retryAccounts.map((acc) => {
        const accountId = String(acc?.id || acc?.email || '');
        return {
            accountId,
            queueItemIds: failedDesigns
                .filter((item) => String(item.accountId || '') === accountId)
                .map((item) => String(item.queueItemId || ''))
                .filter(Boolean)
        };
    }).filter((item) => item.queueItemIds.length > 0);

    if (retryPlan.length === 0) return null;
    const maxRetryDesignsForAccount = Math.max(...retryPlan.map((item) => item.queueItemIds.length));
    const accounts = retryAccounts.filter((acc) => retryPlan.some((item) => item.accountId === String(acc?.id || acc?.email || '')));
    return {
        ...lastConfig,
        accounts,
        selectedAccountIds: accounts.map((acc) => String(acc?.id || '')).filter(Boolean),
        retryPlan,
        isRetryFailedOnly: true,
        countPer: Math.max(1, parseApCountPerFromConfig(lastConfig.countPer) || maxRetryDesignsForAccount, maxRetryDesignsForAccount)
    };
}

async function persistApUploadMonitorRun(run) {
    if (!run) return;
    try {
        await setStorage({ [AP_UPLOAD_MONITOR_LOG_KEY]: run });
        await chrome.runtime.sendMessage({
            action: 'ap_upload_monitor',
            data: {
                counts: run.counts || {},
                notes: (run.notes || []).slice(-8),
                finishedAt: run.finishedAt || null,
                isRunning: !run.finishedAt,
                continueOnError: true
            }
        }).catch(() => {});
    } catch (err) {
        console.warn('[AP][Monitor] persist failed:', err?.message || err);
    }
}

function apMonitorAppend(text, source = 'monitor') {
    if (!apUploadMonitorRun || typeof NhpApUploadMonitor === 'undefined') return;
    NhpApUploadMonitor.appendNote(apUploadMonitorRun, text, source);
    NhpApUploadMonitor.recomputeCounts(apUploadMonitorRun);
}

function apMonitorTrackDesign(partial) {
    if (!apUploadMonitorRun || typeof NhpApUploadMonitor === 'undefined') return;
    NhpApUploadMonitor.upsertItem(apUploadMonitorRun, partial);
    NhpApUploadMonitor.recomputeCounts(apUploadMonitorRun);
}

async function apMonitorMaybeAiNote(run) {
    if (!run || typeof NhpApUploadMonitor === 'undefined') return;
    const ruleSummary = NhpApUploadMonitor.summarizeFailuresRuleBased(run);
    NhpApUploadMonitor.appendNote(run, ruleSummary, 'rule');
    try {
        const failed = (run.items || []).filter((item) => /fail|skip/i.test(String(item.status || '')));
        if (failed.length === 0) return;
        const stored = await chrome.storage.local.get(['nhpAdminAiKeys', 'nhpProxyBaseUrl', 'nhpGptApiKey']);
        const adminKeys = stored.nhpAdminAiKeys || {};
        const apiKey = String(adminKeys.apiKey || stored.nhpGptApiKey || '').trim();
        if (!apiKey) {
            NhpApUploadMonitor.appendNote(run, 'AI Ï║┘èÏ▒ ┘àÏ¬ÏºÏ¡ ÔÇö Ï¬┘à Ïº┘äÏºÏ╣Ï¬┘àÏºÏ» Ï╣┘ä┘ë Ïº┘ä┘à┘äÏ«ÏÁ Ïº┘ä┘é┘êÏºÏ╣Ï»┘è ┘ü┘éÏÀ.', 'monitor');
            return;
        }
        const baseUrl = normalizeCliProxyBaseUrl(adminKeys.baseUrl || stored.nhpProxyBaseUrl || CLI_PROXY_API_BASE_URL);
        const prompt = `┘äÏ«ÏÁ Ï¿ÏÑ┘èÏ¼ÏºÏ▓ Ï¿Ïº┘äÏ╣Ï▒Ï¿┘èÏ® ÏúÏ│Ï¿ÏºÏ¿ ┘üÏ┤┘ä Ï▒┘üÏ╣ Ï¬ÏÁÏº┘à┘è┘à TeePublic ┘êÏº┘éÏ¬Ï▒Ï¡ Ï¬ÏÁÏ¡┘èÏ¡Ïº┘ï ┘ä┘äÏú┘ä┘êÏº┘å ÏÑ┘å ┘êÏ¼Ï». Ïº┘äÏ¿┘èÏº┘åÏºÏ¬:\n${JSON.stringify(failed.slice(0, 12).map((f) => ({ title: f.title, reason: f.reason || f.error, colors: f.colorsStatus })))}`;
        const ai = await callOpenAiCompatibleSeoDirect(prompt, null, null, apiKey, {
            baseUrl,
            model: adminKeys.model || CLI_PROXY_API_DEFAULT_MODEL,
            source: 'ap-upload-monitor',
            fetchTimeoutMs: 12000,
            useEndpointBaseUrl: false
        });
        const text = String(ai?.title || ai?.description || ai?.text || ai?.content || '').trim();
        if (text) NhpApUploadMonitor.appendNote(run, `AI: ${text.slice(0, 400)}`, 'ai');
        else NhpApUploadMonitor.appendNote(run, 'AI ┘ä┘à ┘è┘ÅÏ▒Ï¼Ï╣ ┘à┘äÏ«ÏÁÏº┘ï ÔÇö Ïº┘ä┘à┘äÏ«ÏÁ Ïº┘ä┘é┘êÏºÏ╣Ï»┘è ┘âÏº┘ü┘ì.', 'monitor');
    } catch (err) {
        NhpApUploadMonitor.appendNote(run, `Ï¬Ï╣Ï░Ï▒ ÏºÏ│Ï¬Ï»Ï╣ÏºÏí AI (${err?.message || 'error'}) ÔÇö ┘àÏ¬ÏºÏ¿Ï╣Ï® Ï¿Ïº┘ä┘à┘äÏ«ÏÁ Ïº┘ä┘é┘êÏºÏ╣Ï»┘è.`, 'monitor');
    }
}
const wakeServerInFlight = new Map();
let isUSPTOProcessing = false;
let usptoWindowId = null;
let usptoTabId = null;
const SCREEN_SETTINGS_KEY = 'screeeeenvmeSettings';
const SCREEN_RECENT_ITEMS_KEY = 'screeeeenvmeRecentItems';
const SCREEN_EDITOR_IMAGE_KEY = 'screeeeenvmeEditorImage';
const SCREEN_EDITOR_BUFFER_KEY = 'screeeeenvmeBufferedImages';
const SCREEN_LAST_TARGET_TAB_KEY = 'screeeeenvmeLastTargetTab';
const SCREEN_DEFAULT_SETTINGS = {
    useMic: true,
    useTabAudio: true,
    useSystemAudio: true,
    countdown: 3,
    openEditorAfterCapture: false
};
const CLI_PROXY_API_BASE_URL = 'https://oracle-api.emailcore.app/cliproxy/v1';
const CLI_PROXY_API_DEFAULT_MODEL = 'auto';
/** NHP Generate ÔÇö match Ghost .env CLIPROXY_IMAGE_MODEL (Codex gpt-image-2 in CLIProxy UI). */
const CLI_PROXY_API_DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const CLI_PROXY_API_DEFAULT_VISION_MODEL = 'auto';
/** Admin-only: set via ┘ä┘êÏ¡Ï® Ïº┘äÏ¬Ï¡┘â┘à ÔåÆ ┘à┘üÏºÏ¬┘èÏ¡ AI (chrome.storage.local nhpGptApiKey). */
const NHP_DEFAULT_API_KEY = '';

function normalizeCliProxyBaseUrl(value) {
    if (_cliProxy?.normalizeCliProxyBaseUrl) {
        return _cliProxy.normalizeCliProxyBaseUrl(value, getDefaultCliProxyBaseUrl);
    }
    const raw = String(value || '').trim() || getDefaultCliProxyBaseUrl();
    return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1').replace(/([^:]\/)\/+/g, '$1') || getDefaultCliProxyBaseUrl();
}
const PROMPT_BAG_VISION_MODEL_CHAIN = Object.freeze([
    'auto',
    'gpt-5.4',
    'gemini-2.5-flash'
]);
const PROMPT_BAG_VISION_CALL_TIMEOUT_MS = 14000;

function resolveCliProxyVisionModel(model) {
    const raw = String(model || '').trim() || CLI_PROXY_API_DEFAULT_MODEL;
    if (/^gpt-image/i.test(raw) || /^gpt-4o/i.test(raw)) return 'auto';
    return raw;
}

function buildPromptBagSimpleVisionPrompt() {
    return `Analyze the attached apparel/reference image and return JSON only.

Describe what is visible on the garment or printable graphic using concrete words from the image.
If it is a shirt mockup or product photo, describe only the printed logo/text/symbols/colors on the garment.

Return exactly:
{
  "reference_type": "mockup/product photo or printable artwork",
  "image_summary": "concrete visible subject theme and colors",
  "printed_elements": "specific visible logo text symbols colors",
  "chosen_styles": ["style 1", "style 2", "style 3", "style 4"],
  "pose_variations": ["pose 1", "pose 2", "pose 3", "pose 4"],
  "composition": "short composition note",
  "silhouette": "short silhouette note",
  "placement": "short placement note"
}

JSON only. No markdown.`;
}

function buildPromptBagVisionAnalysisPrompt() {
    return `Analyze the attached apparel/reference image and return JSON only.

Goal:
Create a very controlled companion prompt for apparel generation that keeps the same printable design subject/theme, but only improves:
- a concrete image-specific summary of what is visible
- printable artwork/graphic only, never the mockup/product photo
- visible printed logo, text, symbols, mascot, and color mood
- 4 character pose/action variations only if a character exists inside the printable graphic
- motion or action energy
- composition/camera angle
- silhouette readability
- apparel-friendly placement
- the best 4 suitable styles for this design type
- exactly 4 final designs

Strict rules:
- Do NOT rewrite the whole concept
- Do NOT invent a different theme
- Do ask for exactly 4 designs in the final prompt
- If the image is a shirt mockup, flat garment, product photo, or model wearing apparel, extract only the printed logo/text/symbols/color mood from the garment
- Do NOT redraw the shirt, model, mannequin, fabric folds, watermark, product photo setup, or original background
- The final designs must be standalone apparel graphics on a solid black background (#000000)
- If the printable graphic does not contain a person/character, do not invent pose changes
- If the printable graphic contains a person/character, choose exactly 4 different pose/action variations, one per design
- Pose examples: standing, sitting, leaning, walking, jumping, crouching, dancing, running, dynamic action
- Do NOT output long art-direction paragraphs
- Keep every field concise
- Every field must be 3 to 10 words only
- Pose variations must describe only body position/action
- Chosen styles must contain exactly 4 style labels
- Image summary must name the concrete visible subject, not generic words
- Printed elements must describe only the visible printable graphic using concrete words seen in the image, including exact visible words/names/numbers on the print when present
- Composition must describe only framing/composition
- Silhouette must describe only readability/clarity
- Placement must describe only print layout

Available style labels and selection hints:
- Vintage Distressed: classic sports, old logos, mascots, rustic or heritage themes
- 70s Retro Groovy: flowers, sunshine, positivity, funky animals, retro fashion
- Meme Graphic / Sarcastic: humor, reactions, relatable jokes, pet humor
- Line Art Minimalism: elegant portraits, yoga, cats, flowers, lifestyle silhouettes
- Bold Varsity / Collegiate: sports, gym, university themes, mascots
- Cottagecore Aesthetic: mushrooms, forests, frogs, tea, flowers, cozy animals
- 90s Grunge / Y2K: skateboarding, rebellious youth, edgy graphics, chaotic layouts
- Cute Kawaii Chibi: cute animals, anime mascots, food characters
- 80s Neon Synthwave: sports cars, sunsets, gaming, futuristic nightlife
- Dark Academia: books, libraries, gothic literature, intellectual themes
- Watercolor Splatter: artistic animals, floral art, expressive portraits
- Ukiyo-e Japanese: samurai, koi, dragons, waves, Japanese folklore
- Sumi-e Zen: bamboo, tigers, koi, minimal nature, meditative subjects
- Gothic / Witchy: skulls, occult symbols, moons, witches, dark fantasy
- Cartoon Tattoo Style: skull mascots, roses, snakes, daggers, bold characters
- Comic / Pop Art: action scenes, energetic reactions, bold comic graphics
- Psychedelic Trippy: surreal concepts, mushrooms, cosmic art, abstract creatures
- Pixel Art: retro gaming, arcade themes, nostalgic internet aesthetics
- Glitch Art: AI themes, tech concepts, digital corruption, distorted portraits
- Cyberpunk / Futuristic: robots, sci-fi warriors, high-tech concepts

Return exactly this JSON schema:
{
  "reference_type": "mockup/product photo or printable artwork",
  "image_summary": "concrete visible subject and design mood",
  "printed_elements": "specific visible logo/text/symbols/colors only",
  "chosen_styles": ["style 1", "style 2", "style 3", "style 4"],
  "pose_variations": ["pose 1", "pose 2", "pose 3", "pose 4"],
  "composition": "short composition improvement",
  "silhouette": "short silhouette/readability improvement",
  "placement": "short apparel layout improvement"
}

Return JSON only. No markdown. No extra text.`;
}

function extractPromptBagLooseField(raw, label) {
    const match = String(raw || '').match(new RegExp(`${label}\\s*[:=-]\\s*([^\\n\\r,}]+)`, 'i'));
    return String(match?.[1] || '').trim();
}

function normalizePromptBagStyleList(value) {
    const rawList = Array.isArray(value) ? value : String(value || '').split(/[,\n|]+/);
    return rawList.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4);
}

function isPromptBagGenericAnalysis(value) {
    const text = String(value || '').trim().toLowerCase();
    return !text
        || text.length < 8
        || /^(visible |specific )?(printed )?(logo|text|symbols|colors|color mood|graphic|design|printable artwork)( only)?$/i.test(text)
        || /visible (printed )?logo\/text\/symbols\/colors/i.test(text)
        || /the visible printed logo, text, symbols/i.test(text);
}

function parsePromptBagVisionAnalysis(raw) {
    const text = String(raw || '').trim();
    let parsed = {};
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch (_) {
            parsed = {};
        }
    }
    const referenceType = String(
        parsed.reference_type || parsed.referenceType
        || extractPromptBagLooseField(text, 'reference_type')
        || extractPromptBagLooseField(text, 'reference type')
    ).trim() || 'printable artwork';
    let imageSummary = String(
        parsed.image_summary || parsed.imageSummary
        || extractPromptBagLooseField(text, 'image_summary')
        || extractPromptBagLooseField(text, 'image summary')
    ).trim();
    let printedElements = String(
        parsed.printed_elements || parsed.printedElements
        || extractPromptBagLooseField(text, 'printed_elements')
        || extractPromptBagLooseField(text, 'printed elements')
    ).trim();
    const rawAsSummary = text.replace(/\s+/g, ' ').slice(0, 220).trim();
    if (isPromptBagGenericAnalysis(imageSummary) && !isPromptBagGenericAnalysis(printedElements)) {
        imageSummary = printedElements;
    }
    if (isPromptBagGenericAnalysis(printedElements) && !isPromptBagGenericAnalysis(imageSummary)) {
        printedElements = imageSummary;
    }
    if (isPromptBagGenericAnalysis(imageSummary) && isPromptBagGenericAnalysis(printedElements) && !isPromptBagGenericAnalysis(rawAsSummary)) {
        imageSummary = rawAsSummary;
        printedElements = rawAsSummary;
    }
    const ok = lenient
        ? Boolean(String(imageSummary || printedElements || rawAsSummary).trim().length > 6)
        : (!isPromptBagGenericAnalysis(imageSummary) || !isPromptBagGenericAnalysis(printedElements));
    return {
        ok,
        referenceType,
        imageSummary: imageSummary || rawAsSummary || 'printable apparel graphic',
        printedElements: printedElements || imageSummary || rawAsSummary || 'visible printed graphic elements',
        chosenStyles: normalizePromptBagStyleList(
            parsed.chosen_styles || parsed.chosenStyles || parsed.styles || parsed.style
            || extractPromptBagLooseField(text, 'chosen_styles')
            || extractPromptBagLooseField(text, 'chosen styles')
            || extractPromptBagLooseField(text, 'style')
        ),
        poseVariations: normalizePromptBagStyleList(
            parsed.pose_variations || parsed.poseVariations || parsed.poses || parsed.pose
            || extractPromptBagLooseField(text, 'pose_variations')
            || extractPromptBagLooseField(text, 'pose variations')
            || extractPromptBagLooseField(text, 'pose')
        ),
        composition: String(parsed.composition || extractPromptBagLooseField(text, 'composition')).trim() || 'clean centered focal composition',
        silhouette: String(parsed.silhouette || extractPromptBagLooseField(text, 'silhouette')).trim() || 'strong readable subject silhouette',
        placement: String(parsed.placement || extractPromptBagLooseField(text, 'placement')).trim() || 'balanced chest print placement'
    };
}

function buildPromptBagGeneratedPromptFromAnalysis(analysis) {
    const styleRule = analysis.chosenStyles.length >= 4
        ? `Use these 4 selected styles, one per design variation: ${analysis.chosenStyles.join(', ')}.`
        : 'Analyze the design subject and mood, then choose the best 4 matching styles from the provided apparel style list, using one style per design variation.';
    const mockupRule = /mockup|product|garment|shirt|model/i.test(analysis.referenceType)
        ? `The reference is a mockup/product photo: extract only ${analysis.printedElements}; do not redraw the shirt, model, mannequin, fabric folds, watermark, product-photo setup, or original background.`
        : `Use only ${analysis.printedElements} from the printable artwork.`;
    const hasNoPose = !analysis.poseVariations.length
        || analysis.poseVariations.every((item) => /none|no character|no person|not applicable/i.test(item));
    const poseRule = hasNoPose
        ? 'Do not invent a body pose because the printable graphic has no person or character.'
        : `If the printable graphic contains a person or character, create these 4 different pose/action variations for that character only, one per design: ${analysis.poseVariations.slice(0, 4).join(', ')}.`;
    const textRule = typeof appendNhpTextPreservationRule === 'function'
        ? appendNhpTextPreservationRule('')
        : (typeof NHP_TEXT_PRESERVATION_RULE === 'string' ? NHP_TEXT_PRESERVATION_RULE : '');
    return `Generate exactly 4 distinct print-ready apparel graphics. Reference-specific analysis: ${analysis.imageSummary}. ${mockupRule} Place the redesigned graphic only on a solid black background (#000000). Preserve the core theme and the recognizable extracted elements: ${analysis.printedElements}. ${styleRule} ${poseRule} Apply ${analysis.composition}. Maintain ${analysis.silhouette}. Use ${analysis.placement}. High contrast, strong readable silhouette, centered apparel composition. ${textRule} Output final designs only.`.replace(/\s{2,}/g, ' ').trim();
}

function buildPromptBagVisionModelAttemptOrder(preferredModel = '') {
    const order = [];
    const pushUnique = (model) => {
        const value = String(model || '').trim();
        if (!value || order.includes(value)) return;
        order.push(value);
    };
    pushUnique(resolveCliProxyVisionModel(preferredModel));
    PROMPT_BAG_VISION_MODEL_CHAIN.forEach(pushUnique);
    return order;
}

async function callPromptBagVisionAnalysisWithFallback({
    prompt,
    cleanBase64,
    resolvedMimeType,
    apiKey,
    baseUrl,
    preferredModel = ''
}) {
    const models = buildPromptBagVisionModelAttemptOrder(preferredModel);
    const errors = [];
    for (const model of models) {
        const result = await callOpenAiCompatibleSeo(prompt, cleanBase64, resolvedMimeType, apiKey, {
            baseUrl,
            model,
            source: `cliproxy-${model}`
        });
        if (result?.error) {
            errors.push(`${model}: ${result.error}`);
            continue;
        }
        const raw = String(result?.result || result?.prompt || result?.text || '').trim();
        if (!raw) {
            errors.push(`${model}: empty response`);
            continue;
        }
        const analysis = parsePromptBagVisionAnalysis(raw);
        if (analysis.ok) {
            return { analysis, modelUsed: model, errors };
        }
        errors.push(`${model}: generic analysis`);
    }

    const simplePrompt = 'Describe only the visible printable graphic in this apparel image. Return JSON: {"image_summary":"specific subject 3-12 words","printed_elements":"specific visible elements 3-12 words"}. JSON only.';
    for (const model of ['auto', 'gpt-5.4', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'claude-sonnet-4-20250514']) {
        const result = await callOpenAiCompatibleSeo(simplePrompt, cleanBase64, resolvedMimeType, apiKey, {
            baseUrl,
            model,
            source: `cliproxy-simple-${model}`
        });
        if (result?.error) {
            errors.push(`${model}-simple: ${result.error}`);
            continue;
        }
        const analysis = parsePromptBagVisionAnalysis(String(result?.result || result?.prompt || result?.text || ''));
        if (analysis.ok) {
            return { analysis, modelUsed: `${model}-simple`, errors };
        }
    }

    return { analysis: null, modelUsed: '', errors };
}

function buildPromptBagVisionFallbackPrompt(imageName = '') {
    const label = String(imageName || '').trim();
    const refHint = label ? ` (reference: ${label})` : '';
    const base = `Generate exactly 4 distinct print-ready apparel graphics based only on the printable design visible in the reference${refHint}. If the reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel, extract only the printed logo/text/symbols/color mood from the garment and do not redraw the shirt, model, mannequin, fabric folds, product photo, watermark, or original background. Place the redesigned graphic only on a solid black background (#000000). Analyze the design subject and mood, then choose the best 4 matching styles from this list: Vintage Distressed, 70s Retro Groovy, Meme Graphic / Sarcastic, Line Art Minimalism, Bold Varsity / Collegiate, Cottagecore Aesthetic, 90s Grunge / Y2K, Cute Kawaii Chibi, 80s Neon Synthwave, Dark Academia, Watercolor Splatter, Ukiyo-e Japanese, Sumi-e Zen, Gothic / Witchy, Cartoon Tattoo Style, Comic / Pop Art, Psychedelic Trippy, Pixel Art, Glitch Art, Cyberpunk / Futuristic. Use one selected style per design variation. If the extracted printable graphic contains a person or character, create 4 different pose/action variations for that character only, one per design, such as standing, sitting, leaning, walking, jumping, crouching, dancing, running, or dynamic action. If the printable graphic has no person or character, do not invent a body pose. Preserve the core theme, keep high contrast, strong readable silhouette, and centered apparel composition. Output final designs only.`;
    return typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(base) : base;
}
const PNGGEN_TASK_STATE_KEY = 'nhpPngGenTaskState';
const PLATFORM_SERVER_PORTS = Object.freeze({ teepublic: 3019, redbubble: 3021, amazon: 3022, pinterest: 3023 });
const DASHBOARD_EXTENSION_SERVERS = Object.freeze([
    { id: 'teepublic', type: 'platform', platform: 'teepublic', label: 'TeePublic Ghost Server', port: 3019 },
    { id: 'redbubble', type: 'platform', platform: 'redbubble', label: 'Redbubble Ghost Server', port: 3021 },
    { id: 'amazon', type: 'platform', platform: 'amazon', label: 'Amazon Ghost Server', port: 3022 },
    { id: 'pinterest', type: 'platform', platform: 'pinterest', label: 'Pinterest Ghost Server', port: 3023 },
    { id: 'ai-bridge', type: 'bridge', label: 'AI Bridge Server', port: AI_BRIDGE_SERVER_PORT },
    { id: 'cliproxy-local', type: 'cliproxy', label: 'CLIProxyAPI Local', port: 8317 }
]);
const NHP_AUTO_START_CLIPROXY_KEY = 'nhpAutoStartCliProxyLocal';
/** Bound wait for 127.0.0.1:3009 /api/execute in service-worker launcher fallbacks */
const LOCAL_BRIDGE_EXECUTE_TIMEOUT_MS = 8000;
const GHOST_SERVER_BOOTSTRAP_KEY = 'nhpGhostServerBootstrapState';
const GHOST_SERVER_BOOTSTRAP_COOLDOWN_MS = 45000;
const NHP_NICHE_MEMORY_STORAGE_KEY = 'nhp_niche_memory';
const NHP_NICHE_MEMORY_PATH_KEY = 'nhp_niche_memory_path';
const NHP_NICHE_MEMORY_CLOUD_STATUS_KEY = 'nhp_niche_memory_cloud_status';
const NHP_NICHE_MEMORY_CLOUD_MIN_INTERVAL_MS = 60000;
// Local-only mode: disable all GitHub cloud sync attempts for niche memory.
const NHP_LOCAL_ONLY_MODE = true;
const NHP_GITHUB_SYNC_CONFIG = {
    token: '',
    owner: 'maggouri',
    repo: 'niche-hunter-assets',
    branch: 'main'
};
const NHP_ARCHIVE_STORAGE_KEY = 'nhp_niche_archive_index';
const NHP_ARCHIVE_SETTINGS_KEY = 'nhp_trend_archive_settings';
const NHP_TMH_HISTORY_KEY = 'tmhHistory';
const NHP_TREND_CAPTURE_ALARM = 'nhp-trend-capture-alarm';
const NHP_SEND_IMAGE_TO_GEMINI_MENU_ID = 'nhp-send-image-to-gemini';
const NHP_SEND_IMAGE_MENU_ROOT_ID = 'nhp-send-image-root';
const NHP_SEND_IMAGE_FULL_GEMINI_ID = 'nhp-send-image-full-gemini';
const NHP_SEND_IMAGE_FULL_GPT_ID = 'nhp-send-image-full-gpt';
const NHP_LAUNCH_SCREEN_RECORDER_MENU_ID = 'nhp-launch-screen-recorder';
function clearGeminiWebBatchItemWatchdog(session) {
    if (!session?.itemWatchdogId) return;
    clearTimeout(session.itemWatchdogId);
    session.itemWatchdogId = null;
}

function scheduleGeminiWebBatchItemWatchdog(sessionId, index, profile = null) {
    const session = geminiWebBatchSessions.get(sessionId);
    if (!session) return;
    clearGeminiWebBatchItemWatchdog(session);
    const itemTimeoutMs = profile?.itemTimeoutMs || GEMINI_WEB_BATCH_PER_ITEM_TIMEOUT_MS;
    const graceMs = profile?.itemWatchdogGraceMs || 0;
    session.itemWatchdogId = setTimeout(() => {
        void advanceGeminiWebBatchAfterItem({
            requestId: `${sessionId}_${index}`,
            sessionId,
            batchIndex: index,
            success: false,
            error: 'Batch item timed out waiting for Gemini capture.'
        });
    }, itemTimeoutMs + graceMs);
}

function refreshGeminiWebBatchSessionTimeout(sessionId, profile = null) {
    const session = geminiWebBatchSessions.get(sessionId);
    if (!session) return;
    if (session.timeoutId) clearTimeout(session.timeoutId);
    const done = Number.isFinite(session.nextExpectedIndex) ? session.nextExpectedIndex : (session.currentIndex || 0);
    const remaining = Math.max((session.items?.length || 1) - done, 1);
    const perItem = profile?.itemTimeoutMs || session.timingProfile?.itemTimeoutMs || GEMINI_WEB_BATCH_PER_ITEM_TIMEOUT_MS;
    const cap = profile?.maxTotalTimeoutMs || session.timingProfile?.maxTotalTimeoutMs || GEMINI_WEB_BATCH_MAX_TOTAL_TIMEOUT_MS;
    const extensionMs = Math.min(
        (perItem * remaining) + (profile?.lowSpec ? 90000 : 60000),
        cap
    );
    session.timeoutId = setTimeout(() => {
        void handleGeminiWebBatchGlobalTimeout(sessionId);
    }, extensionMs);
}

async function handleGeminiWebBatchGlobalTimeout(sessionId) {
    const session = geminiWebBatchSessions.get(sessionId);
    if (!session) return;
    const pending = Number.isFinite(session.nextExpectedIndex)
        ? session.nextExpectedIndex
        : (session.pendingIndex ?? session.currentIndex ?? 0);
    if (pending < session.items.length) {
        console.warn(`[NHP][SEO Batch] Global watchdog ÔÇö advancing design ${pending + 1}/${session.items.length}.`);
        await advanceGeminiWebBatchAfterItem({
            requestId: `${sessionId}_${pending}`,
            sessionId,
            batchIndex: pending,
            success: false,
            error: 'Gemini Web batch global timeout while waiting for this design.'
        });
        return;
    }
    completeGeminiWebBatch(sessionId);
}

function buildGeminiWebBatchItemResult(session, index, req) {
    const item = session.items[index];
    const capturedText = String(req?.text || '').trim();
    const looksLikePromptTemplate = /\bSEO title only\b/i.test(capturedText)
        && /\btag\s*1,\s*tag\s*2\b/i.test(capturedText);
    return {
        id: item?.id || req?.itemId || `item_${index}`,
        index,
        success: req?.success !== false && !!capturedText && !looksLikePromptTemplate,
        text: looksLikePromptTemplate ? '' : capturedText,
        error: looksLikePromptTemplate
            ? 'Captured prompt template instead of Gemini SEO response.'
            : (req?.error || null)
    };
}

async function recordGeminiWebBatchItemResult(session, sessionId, index, req) {
    if (!session.processedIndices) session.processedIndices = {};
    const itemResult = buildGeminiWebBatchItemResult(session, index, req);
    session.processedIndices[index] = true;
    session.results.push(itemResult);
    try {
        chrome.runtime.sendMessage({
            action: 'GEMINI_WEB_BATCH_ITEM_DONE',
            sessionId,
            item: itemResult,
            provider: session.provider || 'gemini-primary'
        });
    } catch (_) {
    }
    return itemResult;
}

async function restoreGeminiWebBatchSession(sessionId) {
    if (!sessionId) return null;
    if (geminiWebBatchSessions.has(sessionId)) {
        return geminiWebBatchSessions.get(sessionId);
    }

    const progressKey = `${GEMINI_WEB_BATCH_PROGRESS_STORAGE_PREFIX}${sessionId}`;
    const itemsKey = `${GEMINI_WEB_BATCH_ITEMS_STORAGE_PREFIX}${sessionId}`;
    const data = await chrome.storage.local.get([
        progressKey,
        itemsKey,
        GEMINI_WEB_BATCH_STORAGE_KEY
    ]);
    const items = data?.[itemsKey];
    const progress = data?.[progressKey];
    const batchMeta = data?.[GEMINI_WEB_BATCH_STORAGE_KEY];
    if (!Array.isArray(items) || !items.length || batchMeta?.sessionId !== sessionId) {
        return null;
    }

    const restored = {
        items: items.map((item, index) => ({
            id: item?.id || `batch_${index}`,
            prompt: String(item?.prompt || ''),
            base64: item?.base64 || item?.imageData || null,
            mimeType: item?.mimeType || 'image/png'
        })),
        currentIndex: Number(progress?.currentIndex || 0),
        nextExpectedIndex: Number(progress?.currentIndex || 0),
        results: Array.isArray(progress?.results) ? progress.results.slice() : [],
        processedIndices: (Array.isArray(progress?.results) ? progress.results : []).reduce((acc, row) => {
            if (Number.isFinite(Number(row?.index))) acc[Number(row.index)] = true;
            return acc;
        }, {}),
        activeUrl: batchMeta?.activeUrl || GEMINI_SEO_GEM_URL,
        primaryUrl: batchMeta?.activeUrl || GEMINI_SEO_GEM_URL,
        fallbackUrl: CHATGPT_SEO_GPT_URL,
        mode: 'text',
        provider: progress?.provider || 'gemini-primary',
        triedFallback: false,
        resolve: null,
        reject: null,
        timeoutId: null,
        restoredFromStorage: true
    };
    geminiWebBatchSessions.set(sessionId, restored);
    return restored;
}
const geminiWebBatchSessions = new Map();
const LOW_SPEC_MODE_KEY = 'nhpLowSpecMode';
const NHP_NICHE_CONTEXT_TS_KEY = 'nhp_current_niche_context_at';
const NHP_NICHE_CONTEXT_MAX_AGE_MS = 25 * 60 * 1000;
const AI_IMAGE_TASK_QUEUE_KEY = 'nhp_ai_image_task_queue';
const AI_IMAGE_TASK_SAFE_QUEUE_KEY = 'nhp_ai_image_task_safe_queue';
const AI_IMAGE_TASK_MAX_AGE_MS = 120000;
const AI_IMAGE_TASK_SAFE_MAX_AGE_MS = 15 * 60 * 1000;
const AI_IMAGE_TASK_MAX_QUEUE = 8;
/** Must cover gemini-content.js waitForInputSurface (up to ~90s on cold loads). */
const AI_IMAGE_DELIVERY_WAIT_MS = 95000;
const AI_IMAGE_DELIVERY_RETRY_WAIT_MS = 45000;
const AI_IMAGE_LAUNCH_ACK_WAIT_MS = 18000;
const AI_IMAGE_INJECT_STUCK_MS = 100000;
const NHP_AI_IMAGE_NUDGE_ALARM = 'nhp_ai_image_task_nudge';
const AI_IMAGE_PROVIDER_MAX_PAGES_KEY = 'nhpAiImageProviderMaxPages';
const AI_IMAGE_PROVIDER_MAX_PAGES_DEFAULT = 6; // Max simultaneous GPT/Gemini popup windows per provider.
const AI_IMAGE_LOCAL_BRIDGE_TIMEOUT_MS = 12000;
const AI_IMAGE_LOCAL_BRIDGE_RETRY_COOLDOWN_MS = 90000;
const geminiWebTaskResolvers = new Map();
let geminiWebWindowId = null;
let pendingAiImageTasks = [];
const aiImageProviderWindowPools = {
    gemini: { windowIds: [], nextIndex: 0 },
    gpt: { windowIds: [], nextIndex: 0 }
};
let lowSpecModeCache = { value: false, loadedAt: 0 };
let aiImageLocalBridgeLastFailureAt = 0;
const aiImageWindowAssignChains = {
    gemini: Promise.resolve(),
    gpt: Promise.resolve()
};
const NHP_DIAG_LOG_LIMIT = 220;
const nhpDiagnosticLogs = [];

function nhpSafeSerializeDiagnosticArg(value) {
    try {
        if (typeof value === 'string') return value;
        if (value instanceof Error) return `${value.name}: ${value.message}`;
        return JSON.stringify(value);
    } catch (_) {
        try { return String(value); } catch (_) { return '[unserializable]'; }
    }
}

function recordNhpDiagnosticLog(level, args = []) {
    const text = Array.isArray(args) ? args.map((item) => nhpSafeSerializeDiagnosticArg(item)).join(' | ') : '';
    nhpDiagnosticLogs.push({
        ts: Date.now(),
        level: String(level || 'info').toUpperCase(),
        text: String(text || '').slice(0, 1600)
    });
    if (nhpDiagnosticLogs.length > NHP_DIAG_LOG_LIMIT) {
        nhpDiagnosticLogs.splice(0, nhpDiagnosticLogs.length - NHP_DIAG_LOG_LIMIT);
    }
}

if (!globalThis.__NHP_DIAG_CONSOLE_PATCHED__) {
    const origWarn = console.warn?.bind(console);
    const origError = console.error?.bind(console);
    console.warn = (...args) => {
        recordNhpDiagnosticLog('warn', args);
        return origWarn ? origWarn(...args) : undefined;
    };
    console.error = (...args) => {
        recordNhpDiagnosticLog('error', args);
        return origError ? origError(...args) : undefined;
    };
    globalThis.__NHP_DIAG_CONSOLE_PATCHED__ = true;
}

async function isLowSpecModeEnabled() {
    const now = Date.now();
    if ((now - Number(lowSpecModeCache.loadedAt || 0)) < 10000) {
        return !!lowSpecModeCache.value;
    }
    try {
        const stored = await chrome.storage.local.get([LOW_SPEC_MODE_KEY]);
        const enabled = stored?.[LOW_SPEC_MODE_KEY] === true;
        lowSpecModeCache = { value: enabled, loadedAt: now };
        return enabled;
    } catch (_) {
        return !!lowSpecModeCache.value;
    }
}
let persistentNicheMemoryLoadPromise = null;
let persistentGhostServerBootPromise = null;
let persistentNicheMemoryLoaded = false;
let persistentNicheMemoryCloudUploadPromise = null;
let persistentNicheMemoryCloudLastUploadAt = 0;
let persistentNicheArchiveLoadPromise = null;
let persistentNicheArchiveLoaded = false;
const RADAR_UNOFFICIAL_STORAGE_KEYS = {
    results: 'radarUnofficialResults',
    cleanResults: 'radarUnofficialCleanResults',
    state: 'radarUnofficialScanState',
    aiIdeas: 'radarUnofficialAiIdeas',
    aiState: 'radarUnofficialAiState'
};
const RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY = 'radarUnofficialDeferredPipelineItems';
const NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY = 'nhpInternalGeminiKey';
const SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY = 'seoInternalGeminiKey';
const LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY = 'customGeminiKey';
/** Gemini key from admin storage only ÔÇö no hardcoded fallback. */
const RADAR_UNOFFICIAL_DEFAULT_GEMINI_API_KEY = '';
const RADAR_UNOFFICIAL_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const RADAR_UNOFFICIAL_MIN_DELAY_MS = 1500;
const RADAR_UNOFFICIAL_MAX_DELAY_MS = 2000;
const RADAR_UNOFFICIAL_REQUEST_TIMEOUT_MS = 12000;
const RADAR_UNOFFICIAL_AUTOCOMPLETE_ENDPOINT = 'https://www.teepublic.com/search/autocomplete?q=';
const RADAR_UNOFFICIAL_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
async function getInternalGeminiApiKey() {
    return await new Promise((resolve) => {
        try {
            chrome.storage.local.get([
                NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY
            ], (res) => {
                const key = String(
                    res?.[NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY]
                    || RADAR_UNOFFICIAL_DEFAULT_GEMINI_API_KEY
                ).trim();
                resolve(key);
            });
        } catch (_) {
            resolve('');
        }
    });
}
/** ┘üÏ¡ÏÁ TeePublic (Ï¬Ï¿┘ê┘èÏ¿ ┘â┘äÏºÏ│┘è┘â┘è): ÏÁ┘üÏ¡ÏºÏ¬ ┘ä┘â┘ä sort Ï╣Ï¿Ï▒ lab_perform_scan Ï½┘à ┘à┘éÏºÏ▒┘åÏ® New├ùPopular. */
const RADAR_LAB_SCAN_PAGE_COUNT = 3;
const RADAR_IMAGE_FETCH_MAX_PER_SOURCE = 40;
/** Google Images grid: inline base64 thumbs + CDN URLs from results pages. */
const RADAR_GOOGLE_IMAGES_FETCH_LIMIT = 40;
/** Pinterest pin grid: DOM img srcset (736x/474x/236x); hunt paginates via &page= when supported. */
const RADAR_PINTEREST_FETCH_LIMIT = 28;
const RADAR_PINTEREST_MIN_HYDRATED_THUMB_CHARS = 1800;
const PINIMG_URL_RE = /https?:\/\/i\.pinimg\.com\/[^"'<>\s\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s\\]*)?/i;
/** ÏÁ┘èÏ» Ïº┘äÏÁ┘êÏ▒: ┘àÏ╣Ïº┘è┘åÏºÏ¬ ┘à┘å t-shirts?query= (ÏÁ┘üÏ¡ÏºÏ¬ ┘àÏ¬Ï╣Ï»Ï»Ï®) ÔÇö ┘äÏº sort ┘ê┘äÏº lab_perform_scan. */
const RADAR_TEEPUBLIC_IMAGE_TARGET = 80;
const RADAR_TEEPUBLIC_MAX_LISTING_PAGES = 8;
/** Marketplace HTML pagination (Amazon / Redbubble / Etsy). */
const RADAR_AMAZON_MAX_LISTING_PAGES = 3;
const RADAR_REDBUBBLE_MAX_LISTING_PAGES = 3;
const RADAR_ETSY_MAX_LISTING_PAGES = 3;
const RADAR_MARKETPLACE_FETCH_LIMIT = 40;
/** Note image hunt HTML pagination (light fetches; Google may block deep pages). */
const RADAR_PINTEREST_MAX_LISTING_PAGES = 3;
const RADAR_GOOGLE_IMAGES_MAX_PAGES = 3;
const RADAR_GOOGLE_AI_MAX_PAGES = 2;
const RADAR_GOOGLE_IMAGES_RESULTS_PER_PAGE = 20;
const RADAR_GOOGLE_AI_RESULTS_PER_PAGE = 10;
/** CSP grid: reject tiny/placeholder hydrated thumbs (real product previews are larger). */
const RADAR_TP_MIN_HYDRATED_THUMB_CHARS = 6000;

function getTeepublicExtractApi() {
    return globalThis.NHP_TeepublicExtract || null;
}
const RADAR_TEEPUBLIC_FETCH_TIMEOUT_MS = 18000;
const RADAR_IMAGE_FETCH_TIMEOUT_MS = 14000;
const NC_GOOGLE_AI_DESIGNS_TEMPLATE_STORAGE_KEY = 'ncGoogleAiDesignsTemplate';
const NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE_BG = 'ÏºÏ¡Ï»Ï½ Ï¬ÏÁÏº┘à┘è┘à Ïº┘ä┘é┘àÏÁÏº┘å ┘àÏ¬Ï╣┘ä┘éÏ® Ï¿ - {niche} -';
const RADAR_FETCH_HTML_HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function buildRadarGoogleAiDesignsQuery(nicheText, template) {
    const niche = String(nicheText || '').trim();
    const tpl = String(template || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE_BG).trim() || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE_BG;
    if (tpl.includes('{niche}')) return tpl.replaceAll('{niche}', niche);
    return `${tpl} - ${niche} -`;
}

/**
 * Build hunt fetch URL; pageOpts drives pagination (Pinterest &page=, Google &start=).
 * Google HTML may return CAPTCHA/blocked HTML after page 1 ÔÇö hunt stops on empty/blocked.
 */
function buildRadarSearchUrlForSource(sourceKey, niche, aiTemplate, pageOpts = {}) {
    const q = normalizeRadarNicheQuery(niche);
    const enc = encodeURIComponent(q);
    const page = Number(pageOpts.page);
    const start = Number(pageOpts.start);
    if (sourceKey === 'pinterest') {
        const pageNum = Math.max(1, Number.isFinite(page) ? page : 1);
        const base = `https://www.pinterest.com/search/pins/?q=${enc}`;
        return pageNum <= 1 ? base : `${base}&page=${pageNum}`;
    }
    if (sourceKey === 'google_images') {
        const pageIdx = Math.max(0, Number.isFinite(page) ? page : 0);
        const startVal = Number.isFinite(start) && start >= 0
            ? start
            : pageIdx * RADAR_GOOGLE_IMAGES_RESULTS_PER_PAGE;
        // Marketplace / all-time: drop tbs=qdr:d so Design Images can fill toward ~80.
        const recentOnly = pageOpts.recentOnly !== false && !pageOpts.allTime;
        const base = recentOnly
            ? `https://www.google.com/search?tbm=isch&q=${enc}&tbs=qdr:d`
            : `https://www.google.com/search?tbm=isch&q=${enc}`;
        return startVal > 0 ? `${base}&start=${startVal}` : base;
    }
    if (sourceKey === 'google_ai') {
        const aiQuery = buildRadarGoogleAiDesignsQuery(q, aiTemplate);
        const pageIdx = Math.max(0, Number.isFinite(page) ? page : 0);
        const startVal = Number.isFinite(start) && start >= 0
            ? start
            : pageIdx * RADAR_GOOGLE_AI_RESULTS_PER_PAGE;
        const base = `https://www.google.com/search?udm=50&q=${encodeURIComponent(aiQuery)}&tbs=qdr:d`;
        return startVal > 0 ? `${base}&start=${startVal}` : base;
    }
    if (sourceKey === 'teepublic') {
        const pageNum = Math.max(1, Number.isFinite(page) ? page : 1);
        return buildRadarTeepublicSearchUrl(q, pageNum);
    }
    if (sourceKey === 'amazon') {
        const pageNum = Math.max(1, Number.isFinite(page) ? page : 1);
        return buildRadarAmazonSearchUrl(q, pageNum);
    }
    if (sourceKey === 'redbubble') {
        const pageNum = Math.max(1, Number.isFinite(page) ? page : 1);
        return buildRadarRedbubbleSearchUrl(q, pageNum);
    }
    if (sourceKey === 'etsy') {
        const pageNum = Math.max(1, Number.isFinite(page) ? page : 1);
        return buildRadarEtsySearchUrl(q, pageNum);
    }
    return '';
}

function normalizeRadarNicheQuery(raw) {
    let q = String(raw || '').trim();
    if (!q) return '';
    if (/teepublic\.com\/t-shirts/i.test(q)) {
        try {
            const href = q.startsWith('http') ? q : `https://${q.replace(/^\/+/, '')}`;
            const u = new URL(href);
            const fromQuery = u.searchParams.get('query');
            if (fromQuery) q = fromQuery;
        } catch (_) { /* keep */ }
    }
    if (/%[0-9A-Fa-f]{2}/.test(q)) {
        try {
            const decoded = decodeURIComponent(q);
            if (decoded && decoded !== q) q = decoded.trim();
        } catch (_) { /* keep */ }
    }
    return q.trim();
}

function buildRadarTeepublicSearchUrl(niche, page = 1) {
    const enc = encodeURIComponent(normalizeRadarNicheQuery(niche));
    const base = `https://www.teepublic.com/t-shirts?query=${enc}`;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

function buildRadarAmazonSearchUrl(niche, page = 1) {
    const enc = encodeURIComponent(`${normalizeRadarNicheQuery(niche)} t-shirt`);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const base = `https://www.amazon.com/s?k=${enc}`;
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

function buildRadarRedbubbleSearchUrl(niche, page = 1) {
    const enc = encodeURIComponent(normalizeRadarNicheQuery(niche));
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const base = `https://www.redbubble.com/shop/?query=${enc}&iaCode=u-tees`;
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

function buildRadarEtsySearchUrl(niche, page = 1) {
    const enc = encodeURIComponent(`${normalizeRadarNicheQuery(niche)} t-shirt`);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const base = `https://www.etsy.com/search?q=${enc}`;
    if (pageNum <= 1) return base;
    return `${base}&page=${pageNum}`;
}

function isRadarMarketplaceMode(mode) {
    const key = String(mode || '').trim();
    return key === 'marketplace'
        || key === 'design_gallery'
        || key === 'design-images'
        || key === 'design_images';
}

function resolveRadarImageFetchSources(mode) {
    const key = String(mode || '').trim();
    if (key === 'pinterest') return ['pinterest'];
    if (key === 'google_images') return ['google_images'];
    if (key === 'google_ai') return ['google_ai'];
    if (key === 'teepublic') return ['teepublic'];
    if (key === 'amazon') return ['amazon'];
    if (key === 'redbubble') return ['redbubble'];
    if (key === 'etsy') return ['etsy'];
    if (isRadarMarketplaceMode(key)) {
        return ['teepublic', 'amazon', 'redbubble', 'etsy', 'google_images'];
    }
    return ['pinterest', 'google_images', 'google_ai', 'teepublic', 'amazon', 'redbubble', 'etsy'];
}

function extractTeepublicDesignIdFromUrl(url) {
    const TP = getTeepublicExtractApi();
    if (TP) {
        const fromApi = TP.extractNumericDesignId(url);
        if (fromApi) return fromApi;
    }
    const match = String(url || '').match(/\/derived\/production\/designs\/(\d{4,})(?:_\d+)?/i);
    return match ? match[1] : '';
}

function cleanTeepublicExtractedImageSrc(raw) {
    let src = String(raw || '').trim();
    if (!src) return '';
    if (src.includes(' ')) src = src.split(/\s+/)[0].trim();
    if (src.startsWith('//')) src = `https:${src}`;
    return src.replace(/[,]+$/, '');
}

function isRejectedTeepublicProductImageUrl(lower) {
    if (!lower) return true;
    const rejectTerms = [
        'teepublicons', 'favicon', 'placeholder', 'sprite', '/logo', 'logo.',
        'icon.png', '/icon/', '/icons/', '/icon', 'auto-teepublic', 'auto_teepublic',
        'lightbulb', '/assets/', '/static/', '/badge', '/avatar', '/blank',
        '/default', '/empty', '/thumb/', '/thumbs/', '_thumb', '-thumb',
        '/small/', 'size=thumb', 'thumbnail', 'blur_hash', 'data:image',
        '/auto/', '/auto-', 'auto/', 'default-card', 'empty-state'
    ];
    if (rejectTerms.some((term) => lower.includes(term))) return true;
    if (/\.svg(?:\?|$)/i.test(lower)) return true;
    if (!/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(lower)) return true;
    if (/[?&](?:w|h|width|height)=\d{1,2}(?:&|$)/i.test(lower)) return true;
    if (/[?&](?:w|h|width|height)=(?:6[0-4]|[1-9]\d?)(?:&|$)/i.test(lower)) return true;
    if (/\/\d{1,2}x\d{1,2}\//i.test(lower)) return true;
    if (!/\/derived\/production\/designs\/\d{5,}(?:_\d+)?\//i.test(lower)) return true;
    return false;
}

function upgradeTeepublicPreviewSizeInUrl(url) {
    const value = String(url || '');
    if (!/,s_\d+,/i.test(value)) {
        return value.replace(
            /\/(\d{2,3})x(\d{2,3})\//i,
            (full, w, h) => (Math.min(Number(w), Number(h)) < 200 ? '/550x550/' : full)
        );
    }
    return value.replace(/,s_(\d+),/i, (full, size) => {
        const n = Number(size);
        return n < 313 ? ',s_313,' : full;
    });
}

function normalizeTeepublicProductImageUrl(rawUrl, pageUrl) {
    const TP = getTeepublicExtractApi();
    const cleaned = TP
        ? TP.normalizeTeepublicDesignImageUrl(rawUrl)
        : cleanTeepublicExtractedImageSrc(rawUrl);
    const normalized = normalizeImageCandidateUrl(cleaned, pageUrl) || cleaned;
    if (!normalized) return '';
    if (TP) {
        if (!TP.isUsableTeepublicDesignImageUrl(normalized)) return '';
    } else if (isRejectedTeepublicProductImageUrl(normalized.toLowerCase())) {
        return '';
    }
    if (!extractTeepublicDesignIdFromUrl(normalized)) return '';
    return upgradeTeepublicPreviewSizeInUrl(normalized);
}

function isValidHydratedRadarThumbDataUrl(dataUrl) {
    const thumb = String(dataUrl || '').trim();
    if (!thumb.startsWith('data:image/')) return false;
    if (thumb.length < RADAR_TP_MIN_HYDRATED_THUMB_CHARS) return false;
    const lower = thumb.toLowerCase();
    if (lower.includes('teepublicons') || lower.includes('lightbulb') || lower.includes('auto-teepublic')) return false;
    return true;
}

const RADAR_GOOGLE_INLINE_MIN_THUMB_CHARS = 1200;

function unescapeGoogleInlineText(text) {
    let value = String(text || '');
    value = value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return value
        .replace(/\\u002F/gi, '/')
        .replace(/\\u0026/gi, '&')
        .replace(/\\u003d/gi, '=')
        .replace(/\\u003a/gi, ':')
        .replace(/\\\//g, '/');
}

function isRejectedGoogleRadarImageCandidate(raw) {
    const value = String(raw || '').trim();
    if (!value) return true;
    const lower = value.toLowerCase();
    if (/googlelogo|gstatic\.com\/images\/branding|favicon|\/gen_204\b|play[_-]?button|tbn:AAAAAA/i.test(lower)) {
        return true;
    }
    if (value.startsWith('data:image/')) {
        return value.length < 800;
    }
    if (!/^https?:\/\//i.test(value)) return true;
    if (/[?&](?:w|h|width|height)=\d{1,2}(?:&|$)/i.test(lower)) return true;
    if (/\/\d{1,2}x\d{1,2}\//i.test(lower)) return true;
    if (/\.svg(?:\?|$)/i.test(lower)) return true;
    const isGoogleCdn = /(?:encrypted-tbn0\.gstatic\.com|googleusercontent\.com|gstatic\.com\/images)/i.test(lower);
    const isRaster = /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(lower);
    return !isGoogleCdn && !isRaster;
}

function isValidGoogleRadarThumbItem(item) {
    if (!item || typeof item !== 'object') return false;
    const thumb = String(item.thumbUrl || item.url || '').trim();
    if (thumb.startsWith('data:image/')) {
        if (thumb.length < RADAR_GOOGLE_INLINE_MIN_THUMB_CHARS) return false;
        const lower = thumb.toLowerCase();
        if (/googlelogo|gstatic\.com\/images\/branding|favicon/i.test(lower)) return false;
        return true;
    }
    return isValidHydratedRadarThumbDataUrl(item.thumbUrl);
}

function radarPerSourceImageLimit(sourceKey, modeKey) {
    const key = String(modeKey || '').trim();
    const isAggregator = key === 'aggregator' || key === 'all' || !key;
    const isMarketplace = isRadarMarketplaceMode(key);
    if (sourceKey === 'google_images') {
        if (isMarketplace) return RADAR_MARKETPLACE_FETCH_LIMIT;
        return isAggregator ? 16 : RADAR_GOOGLE_IMAGES_FETCH_LIMIT;
    }
    if (sourceKey === 'pinterest') {
        return isAggregator ? 16 : RADAR_PINTEREST_FETCH_LIMIT;
    }
    if (sourceKey === 'amazon' || sourceKey === 'redbubble' || sourceKey === 'etsy') {
        return isMarketplace || !isAggregator
            ? RADAR_MARKETPLACE_FETCH_LIMIT
            : 12;
    }
    if (sourceKey === 'teepublic' && isMarketplace) {
        return RADAR_MARKETPLACE_FETCH_LIMIT;
    }
    return Math.max(6, Math.min(
        RADAR_IMAGE_FETCH_MAX_PER_SOURCE,
        isAggregator ? 12 : RADAR_IMAGE_FETCH_MAX_PER_SOURCE
    ));
}

function pushGoogleRadarImageCandidate(bucket, seen, raw, pageUrl, limit = RADAR_GOOGLE_IMAGES_FETCH_LIMIT) {
    const cap = Math.max(1, limit);
    if (bucket.length >= cap) return;
    let candidate = String(raw || '').trim();
    if (!candidate) return;
    if (candidate.startsWith('//')) candidate = `https:${candidate}`;
    if (/imgurl=/i.test(candidate)) {
        try { candidate = extractGoogleImgUrl(candidate); } catch (_) { /* keep */ }
    }
    if (/%[0-9A-Fa-f]{2}/.test(candidate) && !candidate.startsWith('data:image/')) {
        try { candidate = decodeURIComponent(candidate); } catch (_) { /* keep */ }
    }
    const normalized = normalizeImageCandidateUrl(candidate, pageUrl);
    if (!normalized || isRejectedGoogleRadarImageCandidate(normalized)) return;
    const dedupeKey = normalized.startsWith('data:image/')
        ? `b64:${normalized.length}:${normalized.slice(22, 140)}`
        : normalized;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const inline = normalized.startsWith('data:image/');
    bucket.push({
        id: `radar-img-google_images-${bucket.length + 1}-${Date.now()}`,
        url: normalized,
        thumbUrl: inline ? normalized : normalized,
        source: 'google_images',
        sourceLabel: radarSourceDisplayLabel('google_images'),
        pageUrl: pageUrl || ''
    });
}

function passesTeepublicRadarImageQuality(item) {
    if (!item || typeof item !== 'object') return false;
    const url = String(item.url || '').trim();
    if (!isValidTeepublicProductImageUrl(url)) return false;
    return isValidHydratedRadarThumbDataUrl(item.thumbUrl);
}

function pruneInvalidRadarImageHuntItems(images = [], modeKey = '', urlOnly = false) {
    const teepublicOnly = String(modeKey || '').trim() === 'teepublic';
    return (Array.isArray(images) ? images : []).filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const src = String(item.source || '').trim();
        const url = String(item.url || item.thumbUrl || '').trim();
        if (urlOnly) {
            // EmailCore / marketplace gallery: keep remote https CDN URLs (no data: hydrate required).
            if (src === 'teepublic' || teepublicOnly) {
                return isValidTeepublicProductImageUrl(url);
            }
            if (src === 'google_images' || src === 'google_ai') {
                return !isRejectedGoogleRadarImageCandidate(url);
            }
            if (src === 'pinterest') {
                return !isRejectedPinterestRadarImageCandidate(url);
            }
            if (src === 'amazon' || src === 'redbubble' || src === 'etsy') {
                return isValidMarketplaceRadarImageUrl(url, src);
            }
            return /^https?:\/\//i.test(url) && !/\.svg(?:\?|$)/i.test(url);
        }
        if (src === 'teepublic' || teepublicOnly) {
            return passesTeepublicRadarImageQuality(item);
        }
        if (src === 'google_images' || src === 'google_ai') {
            return isValidGoogleRadarThumbItem(item);
        }
        if (src === 'pinterest') {
            return isValidPinterestRadarThumbItem(item);
        }
        if (src === 'amazon' || src === 'redbubble' || src === 'etsy') {
            // Prefer hydrated thumb when present; otherwise accept real CDN URL.
            const thumb = String(item.thumbUrl || '').trim();
            if (thumb.startsWith('data:image/')) {
                return thumb.length >= 1200 && isValidMarketplaceRadarImageUrl(url, src);
            }
            return isValidMarketplaceRadarImageUrl(url, src);
        }
        return isValidHydratedRadarThumbDataUrl(item.thumbUrl);
    });
}

function isValidTeepublicProductImageUrl(url) {
    const normalized = normalizeTeepublicProductImageUrl(url);
    return Boolean(normalized && extractTeepublicDesignIdFromUrl(normalized));
}

function pushTeepublicRadarImageCandidate(bucket, seenUrls, seenDesignIds, url, pageUrl) {
    const normalized = normalizeTeepublicProductImageUrl(url, pageUrl);
    if (!normalized || seenUrls.has(normalized)) return;
    const designId = extractTeepublicDesignIdFromUrl(normalized);
    if (!designId || seenDesignIds.has(designId)) return;
    seenUrls.add(normalized);
    seenDesignIds.add(designId);
    bucket.push({
        id: `radar-img-teepublic-${designId}`,
        url: normalized,
        thumbUrl: normalized,
        source: 'teepublic',
        sourceLabel: radarSourceDisplayLabel('teepublic'),
        pageUrl: pageUrl || ''
    });
}

function radarSourceDisplayLabel(sourceKey) {
    const map = {
        pinterest: 'Pinterest',
        google_images: 'Google Images',
        google_ai: 'Google AI',
        teepublic: 'TeePublic',
        amazon: 'Amazon',
        redbubble: 'Redbubble',
        etsy: 'Etsy'
    };
    return map[sourceKey] || sourceKey;
}

function isRadarBlockedFetchHtml(html) {
    const text = String(html || '').toLowerCase();
    return !text || text.includes('just a moment') || text.includes('cf_chl_opt') || text.includes('enable javascript and cookies');
}

function pushRadarImageCandidate(bucket, seen, url, sourceKey, pageUrl) {
    const normalized = normalizeImageCandidateUrl(url, pageUrl);
    if (!normalized || seen.has(normalized)) return;
    const lower = normalized.toLowerCase();
    if (lower.includes('favicon') || lower.includes('/logo') || lower.endsWith('.svg')) return;
    if (/gstatic\.com\/images\/branding|googlelogo|favicon/i.test(lower)) return;
    seen.add(normalized);
    bucket.push({
        id: `radar-img-${sourceKey}-${seen.size}-${Date.now()}`,
        url: normalized,
        thumbUrl: normalized,
        source: sourceKey,
        sourceLabel: radarSourceDisplayLabel(sourceKey),
        pageUrl: pageUrl || ''
    });
}

function isRejectedAmazonRadarImageCandidate(raw) {
    const value = String(raw || '').trim();
    if (!value) return true;
    const lower = value.toLowerCase();
    if (!/^https?:\/\//i.test(value)) return true;
    if (!/(?:m\.media-amazon\.com|images-na\.ssl-images-amazon\.com|images-eu\.ssl-images-amazon\.com)/i.test(lower)) {
        return true;
    }
    if (/favicon|sprite|placeholder|\/logo|icon[_-]|\.svg(?:\?|$)|transparent-pixel|grey-pixel/i.test(lower)) {
        return true;
    }
    // Tiny thumbs / UX chrome
    if (/_AC_US(?:4|5|6|7|8)\d_/i.test(value)) return true;
    if (/_SX(?:2|3|4)\d{1,2}_|_SY(?:2|3|4)\d{1,2}_/i.test(value)) return true;
    return !/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(lower) && !/_AC_/i.test(value);
}

function upgradeAmazonMediaUrl(url) {
    let value = String(url || '').trim();
    if (!value) return '';
    // Prefer a mid-size product image suitable for gallery thumbs.
    value = value.replace(/\._AC_[A-Z0-9,_]+_\./i, '._AC_UL640_.');
    value = value.replace(/\._SX\d+_\./i, '._AC_UL640_.');
    value = value.replace(/\._SY\d+_\./i, '._AC_UL640_.');
    return value;
}

function isRejectedRedbubbleRadarImageCandidate(raw) {
    const value = String(raw || '').trim();
    if (!value) return true;
    const lower = value.toLowerCase();
    if (!/^https?:\/\/ih\d*\.redbubble\.net\/image\./i.test(value)) return true;
    if (/favicon|sprite|placeholder|\/logo|avatar|profile/i.test(lower)) return true;
    return false;
}

function upgradeRedbubbleImageUrl(url) {
    let value = String(url || '').trim();
    if (!value) return '';
    // Upgrade small flat thumbs to a larger preview when size is encoded in the path.
    value = value.replace(/\/flat,\d+x\d+,[^/]+\/([^/?#]+)/i, '/flat,550x550,075,f/$1');
    value = value.replace(/\/apparel,\d+x\d+,[^/]+\/([^/?#]+)/i, '/apparel,550x550,f8f8f8.u1/$1');
    return value;
}

function isRejectedEtsyRadarImageCandidate(raw) {
    const value = String(raw || '').trim();
    if (!value) return true;
    const lower = value.toLowerCase();
    if (!/(?:i\.etsystatic\.com|etsystatic\.com)/i.test(lower)) return true;
    if (/favicon|sprite|placeholder|\/logo|avatar|il_75x75|il_70x70|il_57x|il_75xN/i.test(lower)) {
        return true;
    }
    return !/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(lower);
}

function upgradeEtsyImageUrl(url) {
    let value = String(url || '').trim();
    if (!value) return '';
    value = value.replace(/il_\d+xN\./i, 'il_570xN.');
    value = value.replace(/il_\d+x\d+\./i, 'il_570xN.');
    return value;
}

function isValidMarketplaceRadarImageUrl(url, sourceKey) {
    const value = String(url || '').trim();
    if (!/^https?:\/\//i.test(value)) return false;
    if (sourceKey === 'amazon') return !isRejectedAmazonRadarImageCandidate(value);
    if (sourceKey === 'redbubble') return !isRejectedRedbubbleRadarImageCandidate(value);
    if (sourceKey === 'etsy') return !isRejectedEtsyRadarImageCandidate(value);
    return false;
}

function pushMarketplaceRadarImageCandidate(bucket, seen, raw, sourceKey, pageUrl, limit) {
    const cap = Math.max(1, limit || RADAR_MARKETPLACE_FETCH_LIMIT);
    if (bucket.length >= cap) return;
    let candidate = String(raw || '').trim();
    if (!candidate) return;
    if (candidate.startsWith('//')) candidate = `https:${candidate}`;
    if (sourceKey === 'amazon') candidate = upgradeAmazonMediaUrl(candidate);
    if (sourceKey === 'redbubble') candidate = upgradeRedbubbleImageUrl(candidate);
    if (sourceKey === 'etsy') candidate = upgradeEtsyImageUrl(candidate);
    const normalized = normalizeImageCandidateUrl(candidate, pageUrl) || candidate;
    if (!normalized || !isValidMarketplaceRadarImageUrl(normalized, sourceKey)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    bucket.push({
        id: `radar-img-${sourceKey}-${bucket.length + 1}-${Date.now()}`,
        url: normalized,
        thumbUrl: normalized,
        source: sourceKey,
        sourceLabel: radarSourceDisplayLabel(sourceKey),
        pageUrl: pageUrl || ''
    });
}

function extractAmazonImagesFromHtml(html, pageUrl, limit = RADAR_MARKETPLACE_FETCH_LIMIT) {
    const bucket = [];
    const seen = new Set();
    const text = decodeRadarListingHtml(html);
    const cap = Math.max(1, Math.min(limit, RADAR_MARKETPLACE_FETCH_LIMIT));
    const patterns = [
        /https?:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+\-_%,.]+/gi,
        /https?:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[A-Za-z0-9+\-_%,.]+/gi,
        /https?:\/\/images-eu\.ssl-images-amazon\.com\/images\/I\/[A-Za-z0-9+\-_%,.]+/gi
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            pushMarketplaceRadarImageCandidate(bucket, seen, match[0], 'amazon', pageUrl, cap);
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }
    return bucket.slice(0, cap);
}

function extractRedbubbleImagesFromHtml(html, pageUrl, limit = RADAR_MARKETPLACE_FETCH_LIMIT) {
    const bucket = [];
    const seen = new Set();
    const text = decodeRadarListingHtml(html);
    const cap = Math.max(1, Math.min(limit, RADAR_MARKETPLACE_FETCH_LIMIT));
    for (const match of text.matchAll(/https?:\/\/ih\d*\.redbubble\.net\/image\.[^"'<>\s\\]+/gi)) {
        pushMarketplaceRadarImageCandidate(bucket, seen, match[0], 'redbubble', pageUrl, cap);
        if (bucket.length >= cap) return bucket.slice(0, cap);
    }
    // JSON-escaped variants
    for (const match of text.matchAll(/https?:\\\/\\\/ih\d*\.redbubble\.net\\\/image\.[^"'<>\s\\]+/gi)) {
        const unescaped = match[0].replace(/\\\//g, '/');
        pushMarketplaceRadarImageCandidate(bucket, seen, unescaped, 'redbubble', pageUrl, cap);
        if (bucket.length >= cap) return bucket.slice(0, cap);
    }
    return bucket.slice(0, cap);
}

function extractEtsyImagesFromHtml(html, pageUrl, limit = RADAR_MARKETPLACE_FETCH_LIMIT) {
    const bucket = [];
    const seen = new Set();
    const text = decodeRadarListingHtml(html);
    const cap = Math.max(1, Math.min(limit, RADAR_MARKETPLACE_FETCH_LIMIT));
    for (const match of text.matchAll(/https?:\/\/i\.etsystatic\.com\/[^"'<>\s\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s\\]*)?/gi)) {
        pushMarketplaceRadarImageCandidate(bucket, seen, match[0], 'etsy', pageUrl, cap);
        if (bucket.length >= cap) return bucket.slice(0, cap);
    }
    return bucket.slice(0, cap);
}

function decodeRadarListingHtml(html) {
    return String(html || '')
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

function pinimgCanonicalKey(url) {
    const value = String(url || '').trim();
    const match = value.match(/pinimg\.com\/(?:\d+x|originals|236x|474x|564x|736x)\/(.+)/i);
    return match ? match[1].toLowerCase() : value.toLowerCase();
}

function pinimgPathWidthScore(url) {
    const lower = String(url || '').toLowerCase();
    if (/\/originals\//i.test(lower)) return 200;
    const m = lower.match(/\/(\d+)x(?:\d+)?\//);
    return m ? Number(m[1]) || 0 : 0;
}

function isRejectedPinterestRadarImageCandidate(raw) {
    const value = String(raw || '').trim();
    if (!value) return true;
    const lower = value.toLowerCase();
    if (value.startsWith('data:image/')) {
        return value.length < 400;
    }
    if (!/^https?:\/\/i\.pinimg\.com\//i.test(value)) return true;
    if (/pinterest.*logo|\/images\/profile\/|\/avatar|sprite|placeholder|favicon|\/icons?\//i.test(lower)) {
        return true;
    }
    if (/\/(?:60x60|75x75|30x30|50x50|32x32|16x16)\//i.test(lower)) return true;
    return !PINIMG_URL_RE.test(value);
}

function upgradePinterestPinimgResolution(url) {
    const value = String(url || '').trim();
    if (!value || isRejectedPinterestRadarImageCandidate(value)) return '';
    if (pinimgPathWidthScore(value) >= 736) return value;
    return value.replace(
        /^(https?:\/\/i\.pinimg\.com\/)(?:\d+x|236x|474x|564x|736x|originals)(\/)/i,
        '$1736x$2'
    );
}

function pickBestPinimgUrlFromSrcAttr(value) {
    const text = decodeRadarListingHtml(value).trim();
    if (!text) return '';

    const parts = text.includes(',') ? text.split(/,(?=\s*(?:https?:\/\/|\/\/))/) : [text];
    let best = '';
    let bestScore = -1;
    for (const part of parts) {
        const trimmed = part.trim();
        PINIMG_URL_RE.lastIndex = 0;
        const urlMatch = PINIMG_URL_RE.exec(trimmed);
        if (!urlMatch) continue;
        const url = urlMatch[0];
        if (isRejectedPinterestRadarImageCandidate(url)) continue;
        let score = pinimgPathWidthScore(url);
        const wDesc = trimmed.slice(url.length).trim().match(/(\d+)\s*w/i);
        if (wDesc) score = Math.max(score, Number(wDesc[1]));
        if (score > bestScore) {
            bestScore = score;
            best = url;
        }
    }
    if (best) return upgradePinterestPinimgResolution(best);

    PINIMG_URL_RE.lastIndex = 0;
    const single = PINIMG_URL_RE.exec(text);
    return single ? upgradePinterestPinimgResolution(single[0]) : '';
}

function normalizePinterestPinimgUrl(rawUrl, pageUrl) {
    let candidate = String(rawUrl || '').trim();
    if (!candidate) return '';
    if (candidate.startsWith('//')) candidate = `https:${candidate}`;
    if (candidate.startsWith('data:image/')) {
        return normalizeImageCandidateUrl(candidate, pageUrl) || candidate;
    }
    const best = pickBestPinimgUrlFromSrcAttr(candidate) || candidate;
    const upgraded = upgradePinterestPinimgResolution(best);
    const normalized = normalizeImageCandidateUrl(upgraded, pageUrl || 'https://www.pinterest.com/');
    if (!normalized || isRejectedPinterestRadarImageCandidate(normalized)) return '';
    return normalized;
}

function extractPinimgUrlsFromImgTag(tagHtml) {
    const urls = [];
    const srcset = /\bsrcset="([^"]+)"/i.exec(tagHtml);
    const src = /\bsrc="([^"]+)"/i.exec(tagHtml);
    if (srcset) {
        const best = pickBestPinimgUrlFromSrcAttr(srcset[1]);
        if (best) urls.push(best);
    }
    if (src) {
        const best = pickBestPinimgUrlFromSrcAttr(src[1]);
        if (best) urls.push(best);
    }
    return urls;
}

function pushPinterestRadarImageCandidate(bucket, seen, raw, pageUrl) {
    if (bucket.length >= RADAR_PINTEREST_FETCH_LIMIT) return;
    const normalized = normalizePinterestPinimgUrl(raw, pageUrl);
    if (!normalized) return;
    const dedupeKey = normalized.startsWith('data:image/')
        ? `b64:${normalized.length}:${normalized.slice(22, 140)}`
        : pinimgCanonicalKey(normalized);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const inline = normalized.startsWith('data:image/');
    bucket.push({
        id: `radar-img-pinterest-${bucket.length + 1}-${Date.now()}`,
        url: normalized,
        thumbUrl: inline ? normalized : normalized,
        source: 'pinterest',
        sourceLabel: radarSourceDisplayLabel('pinterest'),
        pageUrl: pageUrl || ''
    });
}

function isValidPinterestRadarThumbItem(item) {
    if (!item || typeof item !== 'object') return false;
    const thumb = String(item.thumbUrl || item.url || '').trim();
    const url = String(item.url || '').trim();
    if (thumb.startsWith('data:image/')) {
        return thumb.length >= 400 && !isRejectedPinterestRadarImageCandidate(thumb);
    }
    if (!/^https?:\/\/i\.pinimg\.com\//i.test(url)) return false;
    if (isRejectedPinterestRadarImageCandidate(url)) return false;
    if (thumb.startsWith('data:image/')) {
        return thumb.length >= RADAR_PINTEREST_MIN_HYDRATED_THUMB_CHARS;
    }
    return isValidHydratedRadarThumbDataUrl(thumb);
}

function extractPinterestImagesFromHtml(html, pageUrl, limit = RADAR_PINTEREST_FETCH_LIMIT) {
    const bucket = [];
    const seen = new Set();
    const text = decodeRadarListingHtml(html);
    const cap = Math.max(1, Math.min(limit, RADAR_PINTEREST_FETCH_LIMIT));

    const imgTagPatterns = [
        /<img\b[^>]*\bclass="[^"]*(?:jFOU55|hCL|iFOU|hDj|GrowthUnauthPinImage|PinCard)[^"]*"[^>]*>/gi,
        /<img\b[^>]*\bsrcset="[^"]*pinimg\.com[^"]*"[^>]*>/gi,
        /<img\b[^>]*\bsrc="[^"]*pinimg\.com[^"]*"[^>]*>/gi
    ];
    for (const pattern of imgTagPatterns) {
        for (const match of text.matchAll(pattern)) {
            for (const url of extractPinimgUrlsFromImgTag(match[0])) {
                pushPinterestRadarImageCandidate(bucket, seen, url, pageUrl);
                if (bucket.length >= cap) return bucket.slice(0, cap);
            }
        }
    }

    for (const match of text.matchAll(/\bsrcset="([^"]*pinimg\.com[^"]*)"/gi)) {
        const best = pickBestPinimgUrlFromSrcAttr(match[1]);
        if (best) pushPinterestRadarImageCandidate(bucket, seen, best, pageUrl);
        if (bucket.length >= cap) return bucket.slice(0, cap);
    }

    const scriptMatch = /<script[^>]*id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(text);
    if (scriptMatch) {
        try {
            const data = JSON.parse(scriptMatch[1]);
            const visit = (obj, depth = 0) => {
                if (!obj || typeof obj !== 'object' || bucket.length >= cap || depth > 14) return;
                const images = obj?.images;
                if (images && typeof images === 'object') {
                    const order = ['736x', '564x', '474x', '236x'];
                    let imgUrl = '';
                    for (const sz of order) {
                        if (images[sz]?.url) { imgUrl = images[sz].url; break; }
                    }
                    if (!imgUrl && images.orig?.url) imgUrl = images.orig.url;
                    if (imgUrl && (obj.title || obj.grid_title || obj.description || obj.id)) {
                        pushPinterestRadarImageCandidate(bucket, seen, imgUrl, pageUrl);
                    }
                }
                for (const key of Object.keys(obj)) visit(obj[key], depth + 1);
            };
            visit(data);
        } catch (_) { /* fall through to regex */ }
    }
    if (bucket.length >= cap) return bucket.slice(0, cap);

    const regexes = [
        /https?:\/\/i\.pinimg\.com\/[^"'<>\s\\]+\.(?:jpg|jpeg|png|webp)/gi,
        /"url"\s*:\s*"(https?:\\\/\\\/i\.pinimg\.com[^"]+)"/gi
    ];
    for (const pattern of regexes) {
        for (const match of text.matchAll(pattern)) {
            let raw = (match[1] || match[0] || '').replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\"/g, '"');
            pushPinterestRadarImageCandidate(bucket, seen, raw, pageUrl);
            if (bucket.length >= cap) break;
        }
        if (bucket.length >= cap) break;
    }
    return bucket.slice(0, cap);
}

function extractGoogleImagesFromHtml(html, pageUrl, limit = RADAR_GOOGLE_IMAGES_FETCH_LIMIT) {
    const bucket = [];
    const seen = new Set();
    const text = unescapeGoogleInlineText(html);
    const cap = Math.max(1, Math.min(limit, RADAR_GOOGLE_IMAGES_FETCH_LIMIT));

    const tryPush = (raw) => pushGoogleRadarImageCandidate(bucket, seen, raw, pageUrl, cap);

    const yqPatterns = [
        /<img\b[^>]*\bclass="[^"]*\bYQ4gaf\b[^"]*"[^>]*\bsrc="([^"]+)"/gi,
        /<img\b[^>]*\bsrc="([^"]+)"[^>]*\bclass="[^"]*\bYQ4gaf\b/gi,
        /\bclass="[^"]*\bYQ4gaf\b[^"]*"[^>]*\bsrc="([^"]+)"/gi
    ];
    for (const pattern of yqPatterns) {
        for (const match of text.matchAll(pattern)) {
            tryPush(match[1]);
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }

    const inlinePatterns = [
        /\bsrc="(data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+)"/gi,
        /data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]{80,}/gi
    ];
    for (const pattern of inlinePatterns) {
        for (const match of text.matchAll(pattern)) {
            tryPush(match[1] || match[0]);
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }

    const httpsPatterns = [
        /"ou"\s*:\s*"(https?:[^"\\]+)"/gi,
        /imgurl=([^&"'<>\\]+)/gi,
        /https?:\/\/encrypted-tbn0\.gstatic\.com\/[^"'<>\s\\]+/gi,
        /https?:\/\/[^"'<>\s\\]*googleusercontent\.com\/[^"'<>\s\\]+/gi,
        /https?:\/\/[^"'<>\s\\]*gstatic\.com\/images\/[^"'<>\s\\]+/gi
    ];
    for (const pattern of httpsPatterns) {
        for (const match of text.matchAll(pattern)) {
            tryPush(match[1] || match[0]);
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }

    return bucket.slice(0, cap);
}

function decodeGoogleAiHtmlAttrValue(raw) {
    const entities = String(raw || '')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/gi, '&');
    return unescapeGoogleInlineText(entities);
}

function googleAiUrlFromSizeBlock(block) {
    if (!Array.isArray(block) || typeof block[0] !== 'string') return '';
    const u = block[0].trim();
    if (/^https?:\/\//i.test(u) || u.startsWith('data:image/')) return u;
    return '';
}

/** data-im: [0,"id",[thumb,w,h],[full,w,h],{...}] ÔÇö pair [1]=thumb, [2]=full; else largest area wins. */
function pickGoogleAiThumbFullFromImArray(arr) {
    if (!Array.isArray(arr)) return null;
    if (arr.length >= 4 && typeof arr[1] === 'string' && !/^https?:\/\//i.test(arr[1])) {
        const thumb = googleAiUrlFromSizeBlock(arr[2]);
        const full = googleAiUrlFromSizeBlock(arr[3]);
        if (thumb || full) return { thumb: thumb || full, full: full || thumb };
    }
    const blocks = [];
    for (const entry of arr) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
        const url = entry[0].trim();
        if (!/^https?:\/\//i.test(url)) continue;
        const w = Number(entry[1]) || 0;
        const h = Number(entry[2]) || 0;
        blocks.push({ url, pixels: Math.max(w * h, w, h, 1) });
    }
    if (blocks.length < 2) return null;
    blocks.sort((a, b) => a.pixels - b.pixels);
    return { thumb: blocks[0].url, full: blocks[blocks.length - 1].url };
}

/** data-im / TgQPHd: prefer explicit thumb/full slots, else walk JSON for URL size blocks. */
function extractGoogleAiUrlPairFromJsonish(payload) {
    const urlBlocks = [];
    const visit = (node, depth = 0) => {
        if (!node || depth > 12) return;
        if (Array.isArray(node)) {
            if (node.length >= 1 && typeof node[0] === 'string' && /^https?:\/\//i.test(node[0])) {
                const w = Number(node[1]) || 0;
                const h = Number(node[2]) || 0;
                urlBlocks.push({ url: node[0], pixels: Math.max(w * h, w, h, 1) });
            }
            for (const entry of node) visit(entry, depth + 1);
            return;
        }
        if (node && typeof node === 'object') {
            for (const key of Object.keys(node)) visit(node[key], depth + 1);
        }
    };
    if (typeof payload === 'string') {
        const decoded = decodeGoogleAiHtmlAttrValue(payload).trim();
        if (!decoded) return null;
        try {
            const parsed = JSON.parse(decoded);
            const explicit = pickGoogleAiThumbFullFromImArray(parsed);
            if (explicit) return explicit;
            visit(parsed);
        } catch (_) {
            const https = decoded.match(/https?:\/\/[^"'\\[\]\s<>]+/gi) || [];
            for (const raw of https) {
                urlBlocks.push({ url: raw, pixels: 1 });
            }
        }
    } else {
        const explicit = pickGoogleAiThumbFullFromImArray(payload);
        if (explicit) return explicit;
        visit(payload);
    }
    if (!urlBlocks.length) return null;
    const unique = [];
    const seen = new Set();
    for (const block of urlBlocks) {
        const normalized = String(block.url || '').trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push(block);
    }
    unique.sort((a, b) => b.pixels - a.pixels);
    const full = unique[0].url;
    const thumb = unique.length > 1 ? unique[unique.length - 1].url : full;
    return { full, thumb };
}

function isRejectedGoogleAiRadarImageCandidate(raw) {
    const value = String(raw || '').trim();
    if (!value) return true;
    const lower = value.toLowerCase();
    if (/googlelogo|gstatic\.com\/images\/branding|favicon|\/gen_204\b|play[_-]?button|tbn:AAAAAA/i.test(lower)) {
        return true;
    }
    if (value.startsWith('data:image/')) {
        return value.length < 800;
    }
    if (!/^https?:\/\//i.test(value)) return true;
    if (/[?&](?:w|h|width|height)=\d{1,2}(?:&|$)/i.test(lower)) return true;
    if (/\/\d{1,2}x\d{1,2}\//i.test(lower)) return true;
    if (/\.svg(?:\?|$)/i.test(lower)) return true;
    if (/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(lower)) return false;
    if (/encrypted-tbn|googleusercontent|gstatic\.com\/images/i.test(lower)) return false;
    if (/pinimg\.com|freepik\.|etsy\.|vecteezy|99designs|creativemarket|shutterstock/i.test(lower)) return false;
    return true;
}

function pushGoogleAiRadarImageCandidate(bucket, seen, fullRaw, thumbRaw, inlineRaw, pageUrl, limit = RADAR_IMAGE_FETCH_MAX_PER_SOURCE) {
    const cap = Math.max(1, limit);
    if (bucket.length >= cap) return;

    let full = normalizeImageCandidateUrl(fullRaw, pageUrl) || '';
    let thumb = normalizeImageCandidateUrl(thumbRaw, pageUrl) || '';
    let inline = normalizeImageCandidateUrl(inlineRaw, pageUrl) || '';
    if (/%[0-9A-Fa-f]{2}/.test(full) && !full.startsWith('data:image/')) {
        try { full = decodeURIComponent(full); } catch (_) { /* keep */ }
    }
    if (/%[0-9A-Fa-f]{2}/.test(thumb) && !thumb.startsWith('data:image/')) {
        try { thumb = decodeURIComponent(thumb); } catch (_) { /* keep */ }
    }
    if (/imgurl=/i.test(full)) {
        try { full = extractGoogleImgUrl(full); } catch (_) { /* keep */ }
    }
    if (/imgurl=/i.test(thumb)) {
        try { thumb = extractGoogleImgUrl(thumb); } catch (_) { /* keep */ }
    }

    const fullHttps = full.startsWith('https://') || full.startsWith('http://');
    const thumbHttps = thumb.startsWith('https://') || thumb.startsWith('http://');
    const inlineOk = inline.startsWith('data:image/') && !isRejectedGoogleAiRadarImageCandidate(inline);

    let url = '';
    if (fullHttps && !isRejectedGoogleAiRadarImageCandidate(full)) url = full;
    else if (thumbHttps && !isRejectedGoogleAiRadarImageCandidate(thumb)) url = thumb;
    else if (inlineOk) url = inline;
    if (!url) return;

    let thumbUrl = inlineOk ? inline : (thumbHttps && !isRejectedGoogleAiRadarImageCandidate(thumb) ? thumb : url);
    if (thumbUrl === url && fullHttps && full !== url) thumbUrl = full;

    const dedupeKey = url.startsWith('data:image/')
        ? `b64:${url.length}:${url.slice(22, 140)}`
        : url;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    bucket.push({
        id: `radar-img-google_ai-${bucket.length + 1}-${Date.now()}`,
        url,
        thumbUrl,
        source: 'google_ai',
        sourceLabel: radarSourceDisplayLabel('google_ai'),
        pageUrl: pageUrl || ''
    });
}

function extractGoogleAiImagesFromHtml(html, pageUrl, limit = RADAR_IMAGE_FETCH_MAX_PER_SOURCE) {
    const bucket = [];
    const seen = new Set();
    const text = unescapeGoogleInlineText(html);
    const cap = Math.max(1, limit);
    const tryPush = (full, thumb, inline) => {
        pushGoogleAiRadarImageCandidate(bucket, seen, full, thumb, inline, pageUrl, cap);
    };

    for (const match of text.matchAll(/\bdata-im\s*=\s*"([^"]+)"/gi)) {
        const pair = extractGoogleAiUrlPairFromJsonish(match[1]);
        if (pair) tryPush(pair.full, pair.thumb, '');
        if (bucket.length >= cap) return bucket.slice(0, cap);
    }

    for (const match of text.matchAll(/<!--\s*TgQPHd\|([\s\S]*?)-->/gi)) {
        const pair = extractGoogleAiUrlPairFromJsonish(match[1]);
        if (pair) tryPush(pair.full, pair.thumb, '');
        if (bucket.length >= cap) return bucket.slice(0, cap);
    }

    const prldPatterns = [
        /<img\b[^>]*\bclass="[^"]*\b(?:PRLDce|saa-highlight-img)\b[^"]*"[^>]*\bsrc="([^"]+)"/gi,
        /<img\b[^>]*\bsrc="([^"]+)"[^>]*\bclass="[^"]*\b(?:PRLDce|saa-highlight-img)\b/gi
    ];
    for (const pattern of prldPatterns) {
        for (const match of text.matchAll(pattern)) {
            const src = match[1] || '';
            if (src.startsWith('data:image/')) tryPush(src, src, src);
            else tryPush(src, src, '');
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }

    const inlinePatterns = [
        /\bsrc="(data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+)"/gi,
        /data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]{80,}/gi
    ];
    for (const pattern of inlinePatterns) {
        for (const match of text.matchAll(pattern)) {
            const raw = match[1] || match[0] || '';
            tryPush(raw, raw, raw);
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }

    const fallbackPatterns = [
        /imgurl=([^&"'<>\\]+)/gi,
        /"ou"\s*:\s*"(https?:[^"\\]+)"/gi,
        /https?:\/\/encrypted-tbn0\.gstatic\.com\/[^"'<>\s\\]+/gi,
        /https?:\/\/[^"'<>\s\\]*googleusercontent\.com\/[^"'<>\s\\]+/gi
    ];
    for (const pattern of fallbackPatterns) {
        for (const match of text.matchAll(pattern)) {
            let raw = match[1] || match[0] || '';
            try { raw = decodeURIComponent(raw); } catch (_) { /* keep */ }
            if (/imgurl=/i.test(raw)) {
                try { raw = extractGoogleImgUrl(raw); } catch (_) { /* keep */ }
            }
            tryPush(raw, raw, '');
            if (bucket.length >= cap) return bucket.slice(0, cap);
        }
    }

    return bucket.slice(0, cap);
}

/** Same DOM + raw pipeline as Radar TeePublic scan (teepublic-extract-shared.js). */
function extractTeepublicImagesFromHtml(html, pageUrl, limit = RADAR_TEEPUBLIC_IMAGE_TARGET) {
    const TP = getTeepublicExtractApi();
    if (!TP) return [];
    const bucket = [];
    const seenUrls = new Set();
    const seenDesignIds = new Set();
    const designs = TP.extractTeepublicDesignsFromListingHtml(html, { maxDesigns: limit + 24 });
    for (const design of designs) {
        if (!design?.img) continue;
        pushTeepublicRadarImageCandidate(bucket, seenUrls, seenDesignIds, design.img, pageUrl);
        if (bucket.length >= limit) break;
    }
    return bucket.slice(0, limit);
}

async function fetchRadarTeepublicListingHtml(niche, pageNum = 1) {
    const pageUrl = buildRadarTeepublicSearchUrl(niche, pageNum);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RADAR_TEEPUBLIC_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(pageUrl, { headers: RADAR_FETCH_HTML_HEADERS, signal: controller.signal });
        const html = await response.text();
        return { pageUrl, html, blocked: isRadarBlockedFetchHtml(html) };
    } catch (error) {
        return { pageUrl, html: '', blocked: true, error: error?.message || 'fetch failed' };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * TeePublic image hunt only: https://www.teepublic.com/t-shirts?query={niche}[&page=N].
 * Not used by lab_perform_scan (newest/popular comparison).
 */
async function fetchRadarTeepublicImages(niche, target = RADAR_TEEPUBLIC_IMAGE_TARGET) {
    const query = normalizeRadarNicheQuery(niche);
    const valid = [];
    const seenUrls = new Set();
    const seenDesignIds = new Set();
    const errors = [];
    const hydrateBuffer = [];

    const mergeValid = (batch) => {
        for (const item of batch) {
            const designId = extractTeepublicDesignIdFromUrl(item.url);
            if (!designId || seenDesignIds.has(designId) || seenUrls.has(item.url)) continue;
            seenDesignIds.add(designId);
            seenUrls.add(item.url);
            valid.push(item);
            if (valid.length >= target) break;
        }
    };

    for (let pageNum = 1; pageNum <= RADAR_TEEPUBLIC_MAX_LISTING_PAGES; pageNum += 1) {
        if (valid.length >= target) break;
        const fetched = await fetchRadarTeepublicListingHtml(query, pageNum);
        if (fetched.blocked || !fetched.html) {
            errors.push({ source: 'teepublic', page: pageNum, error: fetched.error || 'blocked or empty page' });
            break;
        }
        const need = Math.max(1, target - valid.length);
        const batch = extractTeepublicImagesFromHtml(fetched.html, fetched.pageUrl, need + 20);
        hydrateBuffer.length = 0;
        hydrateBuffer.push(...batch);
        await hydrateRadarImageHuntThumbnails(hydrateBuffer);
        mergeValid(hydrateBuffer.filter(passesTeepublicRadarImageQuality));
        if (valid.length >= target) break;
        if (pageNum >= RADAR_TEEPUBLIC_MAX_LISTING_PAGES) break;
        await delay(150);
    }

    return {
        images: valid.slice(0, target),
        errors,
        teepublicSearchUrl: query ? buildRadarTeepublicSearchUrl(query, 1) : ''
    };
}

function radarImageHuntMaxPagesForSource(sourceKey) {
    if (sourceKey === 'teepublic') return RADAR_TEEPUBLIC_MAX_LISTING_PAGES;
    if (sourceKey === 'pinterest') return RADAR_PINTEREST_MAX_LISTING_PAGES;
    if (sourceKey === 'google_images') return RADAR_GOOGLE_IMAGES_MAX_PAGES;
    if (sourceKey === 'google_ai') return RADAR_GOOGLE_AI_MAX_PAGES;
    if (sourceKey === 'amazon') return RADAR_AMAZON_MAX_LISTING_PAGES;
    if (sourceKey === 'redbubble') return RADAR_REDBUBBLE_MAX_LISTING_PAGES;
    if (sourceKey === 'etsy') return RADAR_ETSY_MAX_LISTING_PAGES;
    return 1;
}

function createEmptyRadarImageHuntCursor() {
    return {
        pinterest: { page: 1, offset: 0, done: false },
        teepublic: { page: 1, offset: 0, done: false },
        google_images: { page: 0, start: 0, offset: 0, done: false },
        google_ai: { page: 0, start: 0, offset: 0, done: false },
        amazon: { page: 1, offset: 0, done: false },
        redbubble: { page: 1, offset: 0, done: false },
        etsy: { page: 1, offset: 0, done: false }
    };
}

/** Normalize batch cursor (new per-source shape + legacy teepublicPage/offsets migration). */
function normalizeRadarImageHuntCursor(raw) {
    const base = createEmptyRadarImageHuntCursor();
    if (!raw || typeof raw !== 'object') return base;

    const mergeSource = (key, legacyOffset, legacyDone) => {
        const incoming = raw[key];
        if (incoming && typeof incoming === 'object') {
            base[key] = {
                page: Number(incoming.page) || base[key].page,
                start: Number(incoming.start) >= 0 ? Number(incoming.start) : base[key].start,
                offset: Math.max(0, Number(incoming.offset) || 0),
                done: !!incoming.done
            };
            return;
        }
        if (legacyOffset !== undefined) base[key].offset = Math.max(0, Number(legacyOffset) || 0);
        if (legacyDone) base[key].done = true;
    };

    mergeSource('pinterest', raw.offsets?.pinterest, raw.sourceDone?.pinterest);
    mergeSource('google_images', raw.offsets?.google_images, raw.sourceDone?.google_images);
    mergeSource('google_ai', raw.offsets?.google_ai, raw.sourceDone?.google_ai);
    mergeSource('amazon', raw.offsets?.amazon, raw.sourceDone?.amazon);
    mergeSource('redbubble', raw.offsets?.redbubble, raw.sourceDone?.redbubble);
    mergeSource('etsy', raw.offsets?.etsy, raw.sourceDone?.etsy);

    const tpIn = raw.teepublic;
    if (tpIn && typeof tpIn === 'object') {
        mergeSource('teepublic');
        base.teepublic.page = Math.max(1, Number(tpIn.page) || 1);
        base.teepublic.offset = Math.max(0, Number(tpIn.offset) || 0);
        base.teepublic.done = !!tpIn.done;
    } else {
        const tpPage = Math.max(1, Number(raw.teepublicPage) || 1);
        base.teepublic.page = tpPage;
        base.teepublic.done = !!raw.teepublicDone;
        const legacyTpOff = raw.offsets?.[`teepublic_p${tpPage}`];
        if (legacyTpOff !== undefined) base.teepublic.offset = Math.max(0, Number(legacyTpOff) || 0);
    }

    return base;
}

function getRadarImageHuntPageOpts(sourceKey, sc, extra = {}) {
    if (sourceKey === 'teepublic' || sourceKey === 'pinterest'
        || sourceKey === 'amazon' || sourceKey === 'redbubble' || sourceKey === 'etsy') {
        return { page: Math.max(1, Number(sc.page) || 1), ...extra };
    }
    if (sourceKey === 'google_images' || sourceKey === 'google_ai') {
        const pageIdx = Math.max(0, Number(sc.page) || 0);
        const start = Number(sc.start) >= 0
            ? Number(sc.start)
            : pageIdx * (sourceKey === 'google_images'
                ? RADAR_GOOGLE_IMAGES_RESULTS_PER_PAGE
                : RADAR_GOOGLE_AI_RESULTS_PER_PAGE);
        return { page: pageIdx, start, ...extra };
    }
    return { ...extra };
}

async function fetchRadarHtmlForSource(sourceKey, niche, aiTemplate, pageOpts = null) {
    const pageUrl = buildRadarSearchUrlForSource(sourceKey, niche, aiTemplate, pageOpts || {});
    if (!pageUrl) return { sourceKey, pageUrl: '', html: '', blocked: true };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RADAR_IMAGE_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(pageUrl, { headers: RADAR_FETCH_HTML_HEADERS, signal: controller.signal });
        const html = await response.text();
        return { sourceKey, pageUrl, html, blocked: isRadarBlockedFetchHtml(html) };
    } catch (error) {
        return { sourceKey, pageUrl, html: '', blocked: true, error: error?.message || 'fetch failed' };
    } finally {
        clearTimeout(timeoutId);
    }
}

function extractRadarImagesForSource(sourceKey, html, pageUrl, limit) {
    if (sourceKey === 'pinterest') return extractPinterestImagesFromHtml(html, pageUrl, limit);
    if (sourceKey === 'google_images') return extractGoogleImagesFromHtml(html, pageUrl, limit);
    if (sourceKey === 'google_ai') return extractGoogleAiImagesFromHtml(html, pageUrl, limit);
    if (sourceKey === 'teepublic') return extractTeepublicImagesFromHtml(html, pageUrl, limit);
    if (sourceKey === 'amazon') return extractAmazonImagesFromHtml(html, pageUrl, limit);
    if (sourceKey === 'redbubble') return extractRedbubbleImagesFromHtml(html, pageUrl, limit);
    if (sourceKey === 'etsy') return extractEtsyImagesFromHtml(html, pageUrl, limit);
    return [];
}

/** Progressive note image hunt: abort by requestId from popup. */
const radarImageHuntAbortIds = new Set();

function isRadarImageHuntAborted(requestId) {
    const id = String(requestId ?? '').trim();
    return id ? radarImageHuntAbortIds.has(id) : false;
}

function clearRadarImageHuntAbort(requestId) {
    const id = String(requestId ?? '').trim();
    if (id) radarImageHuntAbortIds.delete(id);
}

/**
 * Fetch one batch of hunt images (deduped against seenUrls); cursor paginates per source (pages 1/2/3ÔÇª).
 * Sources run in parallel (e.g. Google Images local + TeePublic local/Oracle) then merge into one result set.
 */
async function radarFetchSourceImagesBatch(niche, mode = 'aggregator', options = {}) {
    const requestId = options.requestId;
    const query = normalizeRadarNicheQuery(niche);
    if (!query) throw new Error('ÏúÏ»Ï«┘ä ┘å┘èÏ┤Ïº┘ï ┘ä┘äÏ¿Ï¡Ï½ Ï╣┘å Ïº┘äÏÁ┘êÏ▒.');
    const batchLimit = Math.min(Math.max(1, Number(options.batchLimit) || 10), 80);
    const urlOnly = options.urlOnly === true || options.hydrateThumbs === false;
    const seenIncoming = new Set(
        (Array.isArray(options.seenUrls) ? options.seenUrls : [])
            .map((u) => String(u || '').trim())
            .filter(Boolean)
    );
    const cursor = normalizeRadarImageHuntCursor(options.cursor);

    let teepublicSearchUrl = buildRadarTeepublicSearchUrl(query, 1);
    const storage = await getStorage([NC_GOOGLE_AI_DESIGNS_TEMPLATE_STORAGE_KEY]);
    const aiTemplate = storage[NC_GOOGLE_AI_DESIGNS_TEMPLATE_STORAGE_KEY] || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE_BG;
    const modeKey = String(mode || 'aggregator').trim();
    const marketplaceMode = isRadarMarketplaceMode(modeKey);
    const sources = resolveRadarImageFetchSources(modeKey);
    const images = [];
    const errors = [];
    const seenDesignIds = new Set();

    const tryAddItem = (item) => {
        const url = String(item?.url || '').trim();
        if (!url || seenIncoming.has(url)) return false;
        const designId = extractTeepublicDesignIdFromUrl(url);
        if (designId) {
            if (seenDesignIds.has(designId)) return false;
            seenDesignIds.add(designId);
        }
        seenIncoming.add(url);
        images.push(item);
        return true;
    };

    const needMore = () => images.length < batchLimit && !isRadarImageHuntAborted(requestId);
    const perSourceSlice = Math.max(2, Math.ceil(batchLimit / Math.max(1, sources.length)));

    const advanceSourcePage = (sourceKey, sc, currentPageNum) => {
        if (sourceKey === 'google_images') {
            sc.page = currentPageNum + 1;
            sc.start = sc.page * RADAR_GOOGLE_IMAGES_RESULTS_PER_PAGE;
        } else if (sourceKey === 'google_ai') {
            sc.page = currentPageNum + 1;
            sc.start = sc.page * RADAR_GOOGLE_AI_RESULTS_PER_PAGE;
        } else {
            sc.page = currentPageNum + 1;
        }
        sc.offset = 0;
    };

    const isPastMaxPages = (sourceKey, sc, pageNum) => {
        const maxPages = radarImageHuntMaxPagesForSource(sourceKey);
        if (sourceKey === 'google_images' || sourceKey === 'google_ai') {
            return pageNum >= maxPages;
        }
        return pageNum > maxPages;
    };

    /** One page slice for a single source (local; TeePublic may race Oracle). */
    const fetchSourcePageSlice = async (sourceKey) => {
        const sc = cursor[sourceKey];
        if (!sc || sc.done || isRadarImageHuntAborted(requestId)) {
            return { sourceKey, rawBatch: [], pageNum: 0, error: null, teepublicSearchUrl: '', fromOracle: false };
        }

        const isGoogle = sourceKey === 'google_images' || sourceKey === 'google_ai';
        const pageNum = isGoogle
            ? Math.max(0, Number(sc.page) || 0)
            : Math.max(1, Number(sc.page) || 1);

        if (isPastMaxPages(sourceKey, sc, pageNum)) {
            sc.done = true;
            return { sourceKey, rawBatch: [], pageNum, error: null, teepublicSearchUrl: '', fromOracle: false };
        }

        if (sourceKey === 'teepublic') {
            // Parallel: local TeePublic HTML + Oracle RADAR_CONTROL (backup/accelerator).
            // Skip Oracle when this request already came from Oracle (__oracleInternal) to avoid recursion.
            const allowOracle = options.skipOracle !== true;
            const [localSettled, oracleSettled] = await Promise.allSettled([
                fetchRadarTeepublicListingHtml(query, pageNum),
                (allowOracle && typeof fetchTeePublicHuntImagesViaOracle === 'function'
                    ? fetchTeePublicHuntImagesViaOracle(query, {
                        batchLimit: perSourceSlice + 8,
                        seenUrls: [...seenIncoming],
                        requestId,
                        cursor: { teepublic: { ...sc } }
                    })
                    : Promise.resolve(null))
            ]);

            const local = localSettled.status === 'fulfilled'
                ? localSettled.value
                : { pageUrl: '', html: '', blocked: true, error: localSettled.reason?.message || 'local fetch failed' };
            const oracle = oracleSettled.status === 'fulfilled' ? oracleSettled.value : null;
            if (local.pageUrl) teepublicSearchUrl = local.pageUrl;
            if (oracle?.teepublicSearchUrl) teepublicSearchUrl = oracle.teepublicSearchUrl;

            const pageOffset = Math.max(0, Number(sc.offset) || 0);
            let rawBatch = [];
            let fromOracle = false;
            let forceDone = false;

            if (!local.blocked && local.html) {
                const extractCap = pageOffset + perSourceSlice + 24;
                rawBatch = extractTeepublicImagesFromHtml(local.html, local.pageUrl, extractCap);
                // Merge any Oracle extras into the same slice (dedupe later via tryAddItem).
                if (oracle?.images?.length) {
                    rawBatch = rawBatch.concat(oracle.images);
                }
            } else if (oracle?.images?.length) {
                rawBatch = oracle.images;
                fromOracle = true;
                forceDone = true;
            } else {
                const errMsg = local.error || oracle?.error || 'blocked or empty page';
                return {
                    sourceKey,
                    rawBatch: [],
                    pageNum,
                    pageOffset: 0,
                    error: errMsg,
                    teepublicSearchUrl: local.pageUrl || oracle?.teepublicSearchUrl || '',
                    fromOracle: false,
                    forceDone: true
                };
            }

            return {
                sourceKey,
                rawBatch,
                pageNum,
                pageOffset: fromOracle ? 0 : pageOffset,
                error: null,
                teepublicSearchUrl: local.pageUrl || oracle?.teepublicSearchUrl || '',
                fromOracle,
                forceDone
            };
        }

        const fetched = await fetchRadarHtmlForSource(
            sourceKey,
            query,
            aiTemplate,
            getRadarImageHuntPageOpts(sourceKey, sc, marketplaceMode ? { allTime: true } : {})
        );

        if (fetched.blocked || !fetched.html) {
            return {
                sourceKey,
                rawBatch: [],
                pageNum,
                pageOffset: 0,
                error: fetched.error || 'blocked or empty page',
                teepublicSearchUrl: '',
                fromOracle: false,
                forceDone: true
            };
        }

        const pageOffset = Math.max(0, Number(sc.offset) || 0);
        const extractCap = pageOffset + perSourceSlice + 24;
        const rawBatch = extractRadarImagesForSource(sourceKey, fetched.html, fetched.pageUrl, extractCap);
        return {
            sourceKey,
            rawBatch,
            pageNum,
            pageOffset,
            error: null,
            teepublicSearchUrl: '',
            fromOracle: false
        };
    };

    // Parallel wave: all active sources fetch together, then round-robin merge.
    const activeSources = sources.filter((sk) => cursor[sk] && !cursor[sk].done);
    if (activeSources.length && needMore()) {
        const slices = await Promise.all(activeSources.map((sk) => fetchSourcePageSlice(sk)));

        // Fair merge across sources until batchLimit.
        const queues = slices.map((slice) => {
            const sc = cursor[slice.sourceKey];
            if (!sc) return { slice, items: [], idx: 0 };
            if (slice.error) {
                errors.push({ source: slice.sourceKey, page: slice.pageNum, error: slice.error });
                sc.done = true;
                return { slice, items: [], idx: 0 };
            }
            if (slice.teepublicSearchUrl) teepublicSearchUrl = slice.teepublicSearchUrl;
            const pageOffset = Math.max(0, Number(slice.pageOffset) || 0);
            const items = slice.fromOracle
                ? (Array.isArray(slice.rawBatch) ? slice.rawBatch : [])
                : (Array.isArray(slice.rawBatch) ? slice.rawBatch.slice(pageOffset) : []);
            return { slice, items, idx: 0, pageOffset, consumed: 0 };
        });

        let progressed = true;
        while (needMore() && progressed) {
            progressed = false;
            for (const q of queues) {
                if (!needMore() || q.idx >= q.items.length) continue;
                if (tryAddItem(q.items[q.idx])) progressed = true;
                q.idx += 1;
                q.consumed += 1;
            }
        }

        for (const q of queues) {
            const sc = cursor[q.slice.sourceKey];
            if (!sc || sc.done) continue;
            if (q.slice.forceDone) {
                sc.done = true;
                continue;
            }
            if (q.slice.fromOracle) {
                sc.done = true;
                continue;
            }
            const pageOffset = Math.max(0, Number(q.pageOffset) || 0);
            sc.offset = pageOffset + q.consumed;
            const pageExhausted = sc.offset >= (q.slice.rawBatch?.length || 0);
            if (!pageExhausted) continue;
            if (!(q.slice.rawBatch?.length)) {
                sc.done = true;
                continue;
            }
            advanceSourcePage(q.slice.sourceKey, sc, q.slice.pageNum);
            if (isPastMaxPages(q.slice.sourceKey, sc, sc.page)) sc.done = true;
        }
    }

    const needsHydration = images.filter((item) => !String(item?.thumbUrl || '').startsWith('data:image/'));
    if (needsHydration.length && !urlOnly && !isRadarImageHuntAborted(requestId)) {
        await hydrateRadarImageHuntThumbnails(needsHydration);
    }
    const pruned = pruneInvalidRadarImageHuntItems(images, modeKey, urlOnly);
    const hasMoreBySource = {};
    for (const sk of sources) {
        hasMoreBySource[sk] = cursor[sk] ? !cursor[sk].done : false;
    }
    const allDone = sources.every((sk) => !hasMoreBySource[sk]);
    const hasMore = !allDone && !isRadarImageHuntAborted(requestId);
    return {
        images: pruned,
        errors,
        query,
        mode: modeKey,
        teepublicSearchUrl,
        cursor,
        hasMore,
        hasMoreBySource,
        batchLimit,
        urlOnly
    };
}

async function radarFetchSourceImages(niche, mode = 'aggregator', options = null) {
    if (options && (options.batchLimit || options.cursor || options.seenUrls || options.urlOnly === true || options.hydrateThumbs === false)) {
        return radarFetchSourceImagesBatch(niche, mode, options || {});
    }
    const query = normalizeRadarNicheQuery(niche);
    if (!query) throw new Error('ÏúÏ»Ï«┘ä ┘å┘èÏ┤Ïº┘ï ┘ä┘äÏ¿Ï¡Ï½ Ï╣┘å Ïº┘äÏÁ┘êÏ▒.');
    let teepublicSearchUrl = buildRadarTeepublicSearchUrl(query, 1);
    const storage = await getStorage([NC_GOOGLE_AI_DESIGNS_TEMPLATE_STORAGE_KEY]);
    const aiTemplate = storage[NC_GOOGLE_AI_DESIGNS_TEMPLATE_STORAGE_KEY] || NC_GOOGLE_AI_DESIGNS_DEFAULT_TEMPLATE_BG;
    const modeKey = String(mode || 'aggregator').trim();
    const marketplaceMode = isRadarMarketplaceMode(modeKey);
    const urlOnly = options?.urlOnly === true || options?.hydrateThumbs === false;
    const sources = resolveRadarImageFetchSources(modeKey);
    const images = [];
    const errors = [];
    const seenGlobal = new Set();

    for (const sourceKey of sources) {
        try {
            if (sourceKey === 'teepublic') {
                const tpResult = await fetchRadarTeepublicImages(query, RADAR_TEEPUBLIC_IMAGE_TARGET);
                if (tpResult.teepublicSearchUrl) teepublicSearchUrl = tpResult.teepublicSearchUrl;
                if (Array.isArray(tpResult.errors)) errors.push(...tpResult.errors);
                for (const item of tpResult.images) {
                    if (seenGlobal.has(item.url)) continue;
                    seenGlobal.add(item.url);
                    images.push(item);
                }
                await delay(100);
                continue;
            }
            const fetched = await fetchRadarHtmlForSource(
                sourceKey,
                query,
                aiTemplate,
                marketplaceMode ? { allTime: true } : {}
            );
            if (fetched.blocked || !fetched.html) {
                errors.push({ source: sourceKey, error: fetched.error || 'blocked or empty page' });
                await delay(120);
                continue;
            }
            const batch = extractRadarImagesForSource(
                sourceKey,
                fetched.html,
                fetched.pageUrl,
                radarPerSourceImageLimit(sourceKey, modeKey)
            );
            for (const item of batch) {
                if (seenGlobal.has(item.url)) continue;
                seenGlobal.add(item.url);
                images.push(item);
            }
        } catch (err) {
            errors.push({ source: sourceKey, error: err?.message || 'source failed' });
        }
        await delay(100);
    }
    const needsHydration = images.filter((item) => !String(item?.thumbUrl || '').startsWith('data:image/'));
    if (needsHydration.length && !urlOnly) await hydrateRadarImageHuntThumbnails(needsHydration);
    const pruned = pruneInvalidRadarImageHuntItems(images, modeKey, urlOnly);
    return { images: pruned, errors, query, mode: modeKey, teepublicSearchUrl, urlOnly };
}

function buildRadarNicheApparelPrompt(nicheText = '') {
    const niche = String(nicheText || '').trim();
    const prefix = niche ? `[Niche: ${niche}]\n` : '';
    return prefix + buildPromptBagVisionFallbackPrompt(niche);
}

function buildRadarNicheMergeApparelPrompt(nicheText = '') {
    const niche = String(nicheText || '').trim();
    const prefix = niche ? `[Niche: ${niche}]\n` : '';
    const refHint = niche ? ` (niche: ${niche})` : '';
    const base = `Generate exactly 4 distinct print-ready apparel graphics based only on the printable designs visible in the TWO attached reference images${refHint}. You are merging/combining ideas from BOTH references: blend graphic elements, symbols, typography, characters, and color mood from reference A and reference B into four fresh cohesive apparel designs. Each of the 4 outputs must explore a different creative fusion ÔÇö do not copy either reference literally. If either reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel, extract only the printed logo/text/symbols/color mood from the garment and do not redraw the shirt, model, mannequin, fabric folds, product photo, watermark, or original background. Place each redesigned graphic only on a solid black background (#000000). Analyze both design subjects and moods, then choose the best 4 matching styles from this list: Vintage Distressed, 70s Retro Groovy, Meme Graphic / Sarcastic, Line Art Minimalism, Bold Varsity / Collegiate, Cottagecore Aesthetic, 90s Grunge / Y2K, Cute Kawaii Chibi, 80s Neon Synthwave, Dark Academia, Watercolor Splatter, Ukiyo-e Japanese, Sumi-e Zen, Gothic / Witchy, Cartoon Tattoo Style, Comic / Pop Art, Psychedelic Trippy, Pixel Art, Glitch Art, Cyberpunk / Futuristic. Use one selected style per design variation. If the extracted printable graphics contain a person or character, create 4 different pose/action variations for that character only, one per design. If the printable graphics have no person or character, do not invent a body pose. Preserve the core theme, keep high contrast, strong readable silhouette, and centered apparel composition. Output final designs only.`;
    return prefix + (typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(base) : base);
}

function scorePromptBagVisionAnalysisQuality(analysis = {}) {
    if (!analysis?.ok) return 0;
    let score = 40;
    const summary = String(analysis.imageSummary || '').trim();
    const printed = String(analysis.printedElements || '').trim();
    if (summary.length >= 12) score += 15;
    if (printed.length >= 12) score += 15;
    if ((analysis.chosenStyles || []).length >= 4) score += 10;
    if ((analysis.poseVariations || []).length >= 1) score += 5;
    if (!isPromptBagGenericAnalysis(summary)) score += 10;
    return Math.min(100, score);
}

function pickPrimaryNicheByVisionAnalysis(nicheA, nicheB, analysisA, analysisB, noteQualityA = '', noteQualityB = '') {
    const noteBoost = (quality) => {
        const q = String(quality || '').trim().toLowerCase();
        if (q === 'excellent') return 20;
        if (q === 'average') return 10;
        return 0;
    };
    const scoreA = scorePromptBagVisionAnalysisQuality(analysisA) + noteBoost(noteQualityA);
    const scoreB = scorePromptBagVisionAnalysisQuality(analysisB) + noteBoost(noteQualityB);
    if (scoreB > scoreA) {
        return { primary: nicheB, secondary: nicheA, primaryAnalysis: analysisB, secondaryAnalysis: analysisA };
    }
    return { primary: nicheA, secondary: nicheB, primaryAnalysis: analysisA, secondaryAnalysis: analysisB };
}

function buildMergedNicheDisplayName(nicheA, nicheB) {
    const tokensA = String(nicheA || '').toLowerCase().split(/[\s_\-/]+/).filter(Boolean);
    const tokensB = String(nicheB || '').toLowerCase().split(/[\s_\-/]+/).filter(Boolean);
    const seen = new Set();
    const out = [];
    const maxLen = Math.max(tokensA.length, tokensB.length);
    for (let i = 0; i < maxLen; i += 1) {
        [tokensA[i], tokensB[i]].forEach((token) => {
            if (token && !seen.has(token)) {
                seen.add(token);
                out.push(token);
            }
        });
    }
    return out.join(' ');
}

function buildRadarCrossNicheMergeApparelPrompt({
    nicheA = '',
    nicheB = '',
    primaryNiche = '',
    primaryAnalysis = null,
    secondaryAnalysis = null
} = {}) {
    const labelA = String(nicheA || '').trim();
    const labelB = String(nicheB || '').trim();
    const primary = String(primaryNiche || labelA || '').trim();
    const secondary = primary === labelA ? labelB : labelA;
    const prefix = `[Cross-Niche Merge: ${labelA} + ${labelB} | primary style: ${primary}]\n`;
    const primaryVision = String(primaryAnalysis?.printedElements || primaryAnalysis?.imageSummary || '').trim();
    const secondaryVision = String(secondaryAnalysis?.printedElements || secondaryAnalysis?.imageSummary || '').trim();
    const primaryHint = primaryVision
        ? ` PRIMARY niche "${primary}" (style/silhouette/composition anchor): ${primaryVision}.`
        : ` PRIMARY niche "${primary}" sets the dominant printable style, silhouette, and composition quality.`;
    const secondaryHint = secondaryVision
        ? ` SECONDARY niche "${secondary}" (complementary fusion layer): ${secondaryVision}.`
        : ` SECONDARY niche "${secondary}" must contribute visible symbols, colors, typography, motifs, and thematic accents.`;
    const base = `MANDATORY CROSS-NICHE FUSION ÔÇö Generate exactly 4 distinct print-ready apparel graphics. Every design MUST visibly blend printable elements from BOTH niches "${labelA}" AND "${labelB}". Do NOT output a design that looks like only one niche.

REFERENCE IMAGE LAYOUT (side-by-side composite):
- LEFT half = niche A: "${labelA}"
- RIGHT half = niche B: "${labelB}"
Read BOTH halves. Extract printable logos, symbols, typography, characters, mascots, and color mood from EACH side.${primaryHint}${secondaryHint}

FUSION RULES:
- PRIMARY "${primary}" keeps style foundation, silhouette quality, and composition strength.
- SECONDARY "${secondary}" adds complementary symbols, colors, typography, motifs, and thematic accents that are CLEARLY visible in every output.
- Each output must show blended elements from BOTH "${labelA}" and "${labelB}" ÔÇö a true crossover fusion, not a copy of either reference.
- If either reference is a shirt mockup, flat garment, product photo, or model wearing apparel, extract printable elements only; do not redraw the shirt, model, fabric folds, watermark, or original background.

Each of the 4 outputs MUST use a DIFFERENT fusion concept (one per design):
1) Primary style silhouette with secondary niche symbols/typography woven in
2) Split or dual-emblem fusion ÔÇö both niche identities equally prominent
3) Secondary motifs layered onto primary composition with shared color palette
4) Bold hybrid crest/badge merging iconic elements from both niches

Solid black background (#000000) only. High contrast, centered composition, print-ready. Choose 4 distinct styles from: Vintage Distressed, 70s Retro Groovy, Meme Graphic / Sarcastic, Line Art Minimalism, Bold Varsity / Collegiate, Cottagecore Aesthetic, 90s Grunge / Y2K, Cute Kawaii Chibi, 80s Neon Synthwave, Dark Academia, Watercolor Splatter, Ukiyo-e Japanese, Sumi-e Zen, Gothic / Witchy, Cartoon Tattoo Style, Comic / Pop Art, Psychedelic Trippy, Pixel Art, Glitch Art, Cyberpunk / Futuristic. One style per design.

REJECT: outputs that look like only "${labelA}" or only "${labelB}", plain single-niche typography, or copying either reference layout without fusion. Output final crossover designs only.`;
    return prefix + (typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(base) : base);
}

function parsePromptBagCharacterPick(raw) {
    const text = String(raw || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            return normalizePromptBagCharacterName(parsed.character || parsed.name || '');
        } catch (_) { /* fallback below */ }
    }
    return normalizePromptBagCharacterName(text.split(/\s+/).slice(0, 3).join(' '));
}

function normalizePromptBagCharacterName(character = '') {
    return String(character || '').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
}

function resolvePromptBagCharacterCrossoverFallback(niche = '', analysisSummary = '') {
    const haystack = `${niche} ${analysisSummary}`.toLowerCase();

    // Goku ONLY when niche clearly matches Dragon Ball / martial-arts fighting themes
    if (/dragon\s*ball|goku|saiyan|kamehameha|vegeta|super\s*saiyan|martial\s*arts|anime\s*fight|kung\s*fu|dragon\s*fist/i.test(haystack)) {
        return 'goku';
    }

    // Superhero / comic ÔÇö match the franchise character, not a generic fighter
    if (/\bbatman\b|gotham|dark\s*knight/i.test(haystack)) return 'batman';
    if (/\brobin\b|boy\s*wonder/i.test(haystack)) return 'robin';
    if (/\bjoker\b/i.test(haystack)) return 'joker';
    if (/spider-?man/i.test(haystack)) return 'spider-man';
    if (/iron\s*man|tony\s*stark/i.test(haystack)) return 'iron man';
    if (/superman|wonder\s*woman|flash|aquaman|dc\s*comics|marvel|superhero|avengers/i.test(haystack)) return 'batman';

    // Nordic / Viking / Norway ÔÇö regional folklore hero, not generic sports anime
    if (/viking|nordic|norway|norsk|odin|asgard|scandinav|\bthor\b/i.test(haystack)) return 'thor';

    // Morocco national football ÔÇö soccer anime crossover, not power-level fighter
    if (/morocco|maroc|atlas\s*lions|maghreb/i.test(haystack)) {
        if (/football|soccer|fifa|world\s*cup|national\s*team|stadium/i.test(haystack)) return 'captain tsubasa';
        return /cute|kawaii|pokemon/i.test(haystack) ? 'pikachu' : 'captain tsubasa';
    }

    // Rock / metal / band ÔÇö music or villain-rock aesthetic, not martial arts
    if (/shinedown|metallica|ac\s*dc|guns\s*n\s*roses|slash|rock\s*band|metal\s*band|punk\s*band/i.test(haystack)) return 'joker';
    if (/rock|metal|punk|heavy|band|concert|guitar|singer|album|song|dj|musician/i.test(haystack)) {
        return /anime|manga|japan|idol|vocaloid/i.test(haystack) ? 'hatsune miku' : 'joker';
    }

    // Football / soccer (general) ÔÇö soccer anime, NOT goku
    if (/football|soccer|fifa|world\s*cup|stadium|penalty|goalkeeper|midfielder/i.test(haystack)) {
        return 'captain tsubasa';
    }

    if (/cute|kawaii|cat|dog|pet|baby|pokemon/i.test(haystack)) return 'pikachu';
    if (/horror|skull|witch|dark|gothic|halloween/i.test(haystack)) return 'jack skellington';
    if (/game|pixel|arcade|retro|nintendo/i.test(haystack)) return 'mario';
    if (/space|sci-?fi|robot|cyber/i.test(haystack)) return 'iron man';

    // Residual sports / action ÔÇö prefer soccer anime over goku
    if (/sport|sports|gym|athlete|action|fight|power/i.test(haystack)) return 'captain tsubasa';

    return 'mickey';
}

function buildCharacterCrossoverDisplayName(character, niche) {
    const char = normalizePromptBagCharacterName(character)
        || resolvePromptBagCharacterCrossoverFallback(niche);
    const nicheClean = String(niche || '').trim().toLowerCase();
    return `${char} ${nicheClean}`.trim();
}

function buildRadarCharacterCrossoverApparelPrompt({ niche = '', character = '', visionHint = '' } = {}) {
    const nicheText = String(niche || '').trim();
    const char = normalizePromptBagCharacterName(character)
        || resolvePromptBagCharacterCrossoverFallback(nicheText, visionHint);
    const vision = String(visionHint || '').trim();
    const prefix = `[Character Crossover: ${char} ├ù ${nicheText}]
IGNORE REFERENCE LAYOUT ÔÇö do NOT copy, trace, or recreate the reference image composition, poses, athlete/player subject, or sports graphic layout. The reference is ONLY for niche motifs (flags, logos, typography, crest, national colors). CREATE NEW apparel graphics where "${char}" is the visible co-star fusion subject ÔÇö not absent, not implied by aura alone.
`;
    const visionLine = vision
        ? ` Niche visual cues from reference (logos, symbols, typography, colors): ${vision}.`
        : '';
    const charLikenessHint = char === 'goku'
        ? ` For "goku" specifically: draw spiky black hair, orange gi or blue shirt, muscular anime face/body, Saiyan features ÔÇö MUST be visibly drawn; orange aura or Kamehameha energy alone is NOT acceptable.`
        : '';
    const base = `MANDATORY CHARACTER CROSSOVER ÔÇö Generate exactly 4 distinct print-ready apparel graphics.

CRITICAL LIKENESS RULE: Every design MUST show "${char}" with RECOGNIZABLE VISUAL LIKENESS ÔÇö visible face and/or head, iconic hair silhouette, signature outfit or colors, and unmistakable body silhouette. "${char}" must occupy at least 40% of the graphic area and be clearly identifiable at a glance. If a viewer cannot name "${char}" from the design, the output FAILED.${charLikenessHint}

FORBIDDEN (automatic rejection):
- Aura-only, energy-only, glow-only, or color-theme-only treatments without "${char}"'s visible body/face
- "${nicheText}" sports/player graphics with only orange/blue/generic power effects suggesting "${char}" without drawing "${char}"
- Abstract power vibes, franchise aesthetic cues, or energy bursts WITHOUT the actual "${char}" character drawn
- Niche-only typography, flags, logos, jerseys, crests, or athlete silhouettes with NO "${char}" visible
- Copying the reference image layout, pose, player photo, or subject without adding "${char}" as co-star fusion
- Do NOT output niche-only sports graphics without the character visible

Niche theme: "${nicheText}". Character: "${char}".${visionLine}
Use the attached reference image ONLY to borrow niche printable elements (logos, symbols, typography, mascot, national/theme colors). You MUST ADD and DRAW "${char}" and fuse "${char}"'s iconic likeness WITH those niche elements ÔÇö recognizable crossover fusion, not a plain copy of the reference. If the reference is a shirt mockup, flat garment, product photo, sports graphic, or model wearing apparel, extract printable niche elements only, then create fresh crossover graphics starring "${char}"; do not redraw the shirt, model, fabric folds, watermark, athlete-only composition, or original background.

Each of the 4 outputs MUST use a DIFFERENT crossover concept (one per design) showing "${char}" IN "${nicheText}" context:
1) "${char}" wearing or merged with the "${nicheText}" jersey/uniform/crest (e.g. "${char} in team kit with niche colors")
2) "${char}" kicking, holding ball, or surrounded by "${nicheText}" symbols, flags, or emblems
3) Cute chibi/simplified "${char}" crossover with "${nicheText}" motifs and crest
4) Dynamic action-pose "${char}" with "${nicheText}" typography, flag colors, or victory/sports energy

Solid black background (#000000) only. High contrast, centered composition, print-ready. Choose 4 distinct styles from: Vintage Distressed, 70s Retro Groovy, Meme Graphic / Sarcastic, Line Art Minimalism, Bold Varsity / Collegiate, Cottagecore Aesthetic, 90s Grunge / Y2K, Cute Kawaii Chibi, 80s Neon Synthwave, Dark Academia, Watercolor Splatter, Ukiyo-e Japanese, Sumi-e Zen, Gothic / Witchy, Cartoon Tattoo Style, Comic / Pop Art, Psychedelic Trippy, Pixel Art, Glitch Art, Cyberpunk / Futuristic. One style per design.

REJECT: plain niche text designs, flag-only graphics, logos without "${char}", niche-only sports graphics without the character visible, aura/color-only homages, or copying the reference layout without character fusion. Do NOT output niche-only sports graphics without the character visible. Output final crossover designs only.`;
    return prefix + (typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(base) : base);
}

async function resolvePromptBagImageDataUrl(imageId, dataUrlHint = '') {
    let dataUrl = String(dataUrlHint || '').trim();
    if (!dataUrl.startsWith('data:image/') && imageId) {
        const bagImages = await getPromptBagImages();
        const stored = bagImages.find((item) => item.id === imageId);
        if (stored?.dataUrl) dataUrl = String(stored.dataUrl).trim();
    }
    if (!dataUrl.startsWith('data:image/')) throw new Error('Missing image data.');
    return normalizeAiImageDataUrl(dataUrl);
}

async function pickCharacterForNicheCrossover({ niche = '', dataUrl = '', apiKey = '', baseUrl = '', preferredModel = '' } = {}) {
    let analysisSummary = String(niche || '').trim();
    let printedElements = '';
    if (dataUrl.startsWith('data:image/') && apiKey) {
        try {
            const { cleanBase64, resolvedMimeType } = resolveSeoInlineImageParts(dataUrl, 'image/png');
            const vision = await callPromptBagVisionAnalysisWithFallback({
                prompt: buildPromptBagVisionAnalysisPrompt(),
                cleanBase64,
                resolvedMimeType,
                apiKey,
                baseUrl,
                preferredModel
            });
            if (vision.analysis?.imageSummary) analysisSummary = vision.analysis.imageSummary;
            if (vision.analysis?.printedElements) printedElements = vision.analysis.printedElements;
        } catch (_) { /* keep niche label */ }
    }
    const visionContext = [analysisSummary, printedElements].filter(Boolean).join(' | ');
    const fallbackCharacter = resolvePromptBagCharacterCrossoverFallback(niche, visionContext);
    if (!apiKey) return fallbackCharacter;
    const pickPrompt = `Pick ONE famous cartoon, anime, gaming, or comic character for an apparel crossover with niche "${niche}".
Reference image analysis: ${visionContext || niche}.

Return JSON only: {"character":"single lowercase english name","reason":"one short phrase"}

RULES:
1. Pick the CLOSEST thematic match ÔÇö character culture, era, vibe, and niche subject must align.
2. Do NOT default to "goku" unless the niche is explicitly Dragon Ball, Saiyan, Kamehameha, martial-arts anime, or super-powered fighting anime.
3. The character must be visually recognizable (face, hair, outfit, silhouette) ÔÇö not aura-only or color-theme-only.

NICHE-SPECIFIC EXAMPLES (pick closest match; do not copy blindly):
- Morocco / national football / soccer team ÔåÆ captain tsubasa, pikachu in team kit, or culturally fitting soccer anime character ÔÇö NOT goku
- Norway / Viking / Nordic soccer ÔåÆ thor, nordic warrior, or regional folklore hero ÔÇö NOT goku
- Rock / metal / band (e.g. shinedown) ÔåÆ joker, rock idol, or music-anime character (e.g. hatsune miku) ÔÇö NOT goku
- Batman / DC animated ÔåÆ batman, robin, or joker ÔÇö NOT goku
- Dragon Ball / martial arts / anime fight ÔåÆ goku
- Cute / kawaii ÔåÆ pikachu, hello kitty
- Horror / gothic ÔåÆ jack skellington
- Retro gaming ÔåÆ mario, sonic
- Sci-fi / tech ÔåÆ iron man, mega man

JSON only. Character name: one or two lowercase English words.`;
    try {
        const result = await callOpenAiCompatibleSeo(pickPrompt, '', 'text/plain', apiKey, {
            baseUrl,
            model: preferredModel || 'auto',
            source: 'prompt-bag-character-pick'
        });
        const character = parsePromptBagCharacterPick(result?.result || result?.prompt || result?.text || '');
        if (character) return character;
    } catch (err) {
        console.warn('[PromptBag] character pick failed:', err?.message || err);
    }
    return fallbackCharacter;
}

async function buildPromptBagCrossNicheMergePack(req = {}) {
    const nicheA = String(req.nicheA || '').trim();
    const nicheB = String(req.nicheB || '').trim();
    if (!nicheA || !nicheB) throw new Error('Missing niche labels.');
    const stored = await chrome.storage.local.get(['nhpAdminAiKeys', 'nhpProxyBaseUrl', 'nhpGptApiKey']);
    const adminKeys = stored?.nhpAdminAiKeys || {};
    const apiKey = String(req.apiKey || adminKeys.gpt || stored.nhpGptApiKey || '').trim();
    const baseUrl = normalizeCliProxyBaseUrl(req.baseUrl || adminKeys.baseUrl || stored.nhpProxyBaseUrl || CLI_PROXY_API_BASE_URL);
    const [dataUrlA, dataUrlB] = await Promise.all([
        resolvePromptBagImageDataUrl(req.imageAId, req.dataUrlA),
        resolvePromptBagImageDataUrl(req.imageBId, req.dataUrlB)
    ]);
    let primaryNiche = nicheA;
    let primaryAnalysis = null;
    let secondaryAnalysis = null;
    if (apiKey) {
        const partsA = resolveSeoInlineImageParts(dataUrlA, 'image/png');
        const partsB = resolveSeoInlineImageParts(dataUrlB, 'image/png');
        const [visionA, visionB] = await Promise.all([
            callPromptBagVisionAnalysisWithFallback({
                prompt: buildPromptBagVisionAnalysisPrompt(),
                cleanBase64: partsA.cleanBase64,
                resolvedMimeType: partsA.resolvedMimeType,
                apiKey,
                baseUrl,
                preferredModel: adminKeys.model || req.model || ''
            }),
            callPromptBagVisionAnalysisWithFallback({
                prompt: buildPromptBagVisionAnalysisPrompt(),
                cleanBase64: partsB.cleanBase64,
                resolvedMimeType: partsB.resolvedMimeType,
                apiKey,
                baseUrl,
                preferredModel: adminKeys.model || req.model || ''
            })
        ]);
        const picked = pickPrimaryNicheByVisionAnalysis(
            nicheA,
            nicheB,
            visionA.analysis,
            visionB.analysis,
            req.noteQualityA || req.qualityA || '',
            req.noteQualityB || req.qualityB || ''
        );
        primaryNiche = picked.primary;
        primaryAnalysis = picked.primaryAnalysis;
        secondaryAnalysis = picked.secondaryAnalysis;
    }
    return {
        prompt: buildRadarCrossNicheMergeApparelPrompt({
            nicheA,
            nicheB,
            primaryNiche,
            primaryAnalysis,
            secondaryAnalysis
        }),
        libraryDisplayName: buildMergedNicheDisplayName(nicheA, nicheB),
        primaryNiche,
        nicheA,
        nicheB
    };
}

async function buildPromptBagCharacterCrossoverPack(req = {}) {
    const niche = String(req.niche || '').trim();
    if (!niche) throw new Error('Missing niche label.');
    const stored = await chrome.storage.local.get(['nhpAdminAiKeys', 'nhpProxyBaseUrl', 'nhpGptApiKey']);
    const adminKeys = stored?.nhpAdminAiKeys || {};
    const apiKey = String(req.apiKey || adminKeys.gpt || stored.nhpGptApiKey || '').trim();
    const baseUrl = normalizeCliProxyBaseUrl(req.baseUrl || adminKeys.baseUrl || stored.nhpProxyBaseUrl || CLI_PROXY_API_BASE_URL);
    const dataUrl = await resolvePromptBagImageDataUrl(req.imageId, req.dataUrl);
    let visionHint = '';
    if (dataUrl.startsWith('data:image/') && apiKey) {
        try {
            const { cleanBase64, resolvedMimeType } = resolveSeoInlineImageParts(dataUrl, 'image/png');
            const vision = await callPromptBagVisionAnalysisWithFallback({
                prompt: buildPromptBagVisionAnalysisPrompt(),
                cleanBase64,
                resolvedMimeType,
                apiKey,
                baseUrl,
                preferredModel: adminKeys.model || req.model || ''
            });
            visionHint = [vision.analysis?.printedElements, vision.analysis?.imageSummary]
                .map((part) => String(part || '').trim())
                .filter(Boolean)
                .join(' | ');
        } catch (_) { /* optional vision hint */ }
    }
    let character = normalizePromptBagCharacterName(req.character);
    if (!character) {
        character = await pickCharacterForNicheCrossover({
            niche,
            dataUrl,
            apiKey,
            baseUrl,
            preferredModel: adminKeys.model || req.model || ''
        });
    }
    character = normalizePromptBagCharacterName(character)
        || resolvePromptBagCharacterCrossoverFallback(niche, visionHint);
    const prompt = buildRadarCharacterCrossoverApparelPrompt({ niche, character, visionHint });
    return {
        prompt,
        libraryDisplayName: buildCharacterCrossoverDisplayName(character, niche),
        character,
        niche,
        visionHint: visionHint || null
    };
}

const RADAR_UNOFFICIAL_TREND_ENDPOINTS = [
    { url: 'https://www.teepublic.com/trending-tags', source: 'trend-page', weight: 4 },
    { url: 'https://www.teepublic.com/tag-directory', source: 'tag-directory', weight: 3 },
    { url: 'https://www.teepublic.com/t-shirts?sort=popular', source: 'popular-page', weight: 2 },
    { url: 'https://www.teepublic.com/t-shirts?sort=newest', source: 'newest-page', weight: 2 }
];
const RADAR_UNOFFICIAL_RAW_IGNORE_TERMS = new Set([
    't-shirt', 't-shirts', 'tee', 'tees', 'shirt', 'shirts', 'design', 'designs',
    'gift', 'gifts', 'funny', 'retro', 'vintage', 'cool', 'popular', 'newest',
    'tag directory', 'trending tags'
]);
const RADAR_UNOFFICIAL_CLEAN_STOP_WORDS = new Set([
    'a', 'an', 'and', 'art', 'classic', 'design', 'edition', 'for', 'funny', 'gift',
    'gifts', 'graphic', 'logo', 'look', 'modern', 'retro', 'style', 'tee', 'tees',
    'the', 'theme', 'tshirt', 'tshirts', 't', 'shirt', 'shirts', 'vintage', 'with'
]);
const RADAR_UNOFFICIAL_VARIANT_TERMS = new Set([
    'art', 'black', 'blue', 'brown', 'dark', 'gold', 'gray', 'green', 'grey', 'light',
    'logo', 'minimalist', 'orange', 'pattern', 'pink', 'purple', 'red', 'silver',
    'theme', 'white', 'yellow'
]);
const RADAR_UNOFFICIAL_HARD_NOISE_PHRASES = new Set([
    'staff', 'staff only', 'medical staff', 'security staff', 'hot staff', 'fancy picks'
]);
let radarUnofficialScanPromise = null;
let radarUnofficialAiPromise = null;

function normalizeNicheKey(value = '') {
    return String(value || '').trim().toLowerCase();
}

function normalizeNoteDataPayload(noteData = {}) {
    return {
        niches: Array.isArray(noteData.niches) ? noteData.niches : [],
        doneHistory: Array.isArray(noteData.doneHistory) ? noteData.doneHistory : [],
        history: Array.isArray(noteData.history) ? noteData.history : [],
        unofficialTrends: Array.isArray(noteData.unofficialTrends) ? noteData.unofficialTrends : []
    };
}

function createEmptyPersistentNicheMemory() {
    return {
        version: 1,
        updatedAt: null,
        path: null,
        uspto: {},
        teepublic: {}
    };
}

function sanitizeHistoryMap(source, allowedStatuses) {
    const result = {};
    if (!source || typeof source !== 'object') return result;
    for (const [rawKey, rawValue] of Object.entries(source)) {
        const key = normalizeNicheKey(rawKey);
        const value = String(rawValue || '').trim().toLowerCase();
        if (!key || !allowedStatuses.includes(value)) continue;
        result[key] = value;
    }
    return result;
}

function sanitizePersistentNicheMemory(rawMemory = {}) {
    return {
        version: 1,
        updatedAt: typeof rawMemory.updatedAt === 'string' ? rawMemory.updatedAt : null,
        path: typeof rawMemory.path === 'string' ? rawMemory.path : null,
        uspto: sanitizeHistoryMap(rawMemory.uspto, ['safe', 'banned']),
        teepublic: sanitizeHistoryMap(rawMemory.teepublic, ['excel', 'med', 'sat', 'emp'])
    };
}

function buildHistoryMapFromBucketLists(bucketMap = {}, allowedStatuses = []) {
    const history = {};
    for (const status of allowedStatuses) {
        const values = Array.isArray(bucketMap[status]) ? bucketMap[status] : [];
        for (const niche of values) {
            const key = normalizeNicheKey(niche);
            if (key) history[key] = status;
        }
    }
    return history;
}

function mergePersistentNicheMemory(...sources) {
    const merged = createEmptyPersistentNicheMemory();
    for (const source of sources) {
        const clean = sanitizePersistentNicheMemory(source);
        Object.assign(merged.uspto, clean.uspto);
        Object.assign(merged.teepublic, clean.teepublic);
        if (clean.path) merged.path = clean.path;
        if (clean.updatedAt) merged.updatedAt = clean.updatedAt;
    }
    merged.updatedAt = new Date().toISOString();
    return merged;
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function base64ToUtf8(base64) {
    const binary = atob(String(base64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

function utf8ToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(String(text || '')));
}

async function getNicheMemoryCloudUserId() {
    const data = await getStorage(['licenseKey', 'guestId']);
    if (data.licenseKey) return String(data.licenseKey).replace(/[^a-zA-Z0-9]/g, '');
    if (data.guestId) return String(data.guestId);
    const guestId = 'guest_' + Math.random().toString(36).slice(2, 11);
    await setStorage({ guestId });
    return guestId;
}

async function getNicheMemoryCloudPath() {
    const userId = await getNicheMemoryCloudUserId();
    return `sync/niche_memory_${userId}.json`;
}

function getGithubContentUrl(path) {
    const cfg = NHP_GITHUB_SYNC_CONFIG;
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
}

async function downloadGithubJson(path) {
    const response = await fetch(`${getGithubContentUrl(path)}?ref=${encodeURIComponent(NHP_GITHUB_SYNC_CONFIG.branch)}`, {
        headers: {
            'Authorization': `token ${NHP_GITHUB_SYNC_CONFIG.token}`,
            'Accept': 'application/vnd.github+json'
        }
    });
    if (response.status === 404) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `GitHub HTTP ${response.status}`);
    if (!data.content) return null;
    return {
        json: JSON.parse(base64ToUtf8(data.content)),
        sha: data.sha || null
    };
}

async function uploadGithubJson(path, jsonData, message) {
    const current = await downloadGithubJson(path).catch((error) => {
        if (/404/.test(error?.message || '')) return null;
        return null;
    });
    const body = {
        message,
        content: utf8ToBase64(JSON.stringify(jsonData)),
        branch: NHP_GITHUB_SYNC_CONFIG.branch
    };
    if (current?.sha) body.sha = current.sha;

    const response = await fetch(getGithubContentUrl(path), {
        method: 'PUT',
        headers: {
            'Authorization': `token ${NHP_GITHUB_SYNC_CONFIG.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `GitHub HTTP ${response.status}`);
    return data;
}

async function importNicheMemoryCloudBackup() {
    if (NHP_LOCAL_ONLY_MODE) return null;
    const path = await getNicheMemoryCloudPath();
    const downloaded = await downloadGithubJson(path);
    if (!downloaded?.json) return null;
    const memory = sanitizePersistentNicheMemory(downloaded.json.memory || downloaded.json);
    await setStorage({
        [NHP_NICHE_MEMORY_CLOUD_STATUS_KEY]: {
            ok: true,
            action: 'import',
            path,
            updatedAt: new Date().toISOString(),
            usptoCount: Object.keys(memory.uspto).length,
            analysisCount: Object.keys(memory.teepublic).length
        }
    });
    return memory;
}

function queueNicheMemoryCloudBackup(memory, reason = 'sync') {
    if (NHP_LOCAL_ONLY_MODE) return;
    const cleanMemory = sanitizePersistentNicheMemory(memory);
    const now = Date.now();
    if (persistentNicheMemoryCloudUploadPromise || (now - persistentNicheMemoryCloudLastUploadAt) < NHP_NICHE_MEMORY_CLOUD_MIN_INTERVAL_MS) {
        return;
    }

    persistentNicheMemoryCloudLastUploadAt = now;
    persistentNicheMemoryCloudUploadPromise = (async () => {
        const path = await getNicheMemoryCloudPath();
        const payload = {
            version: 1,
            type: 'nhp_niche_memory_backup',
            reason,
            updatedAt: new Date().toISOString(),
            counts: {
                uspto: Object.keys(cleanMemory.uspto).length,
                analysis: Object.keys(cleanMemory.teepublic).length
            },
            memory: cleanMemory
        };
        await uploadGithubJson(path, payload, `NHP niche memory backup: ${reason}`);
        await setStorage({
            [NHP_NICHE_MEMORY_CLOUD_STATUS_KEY]: {
                ok: true,
                action: 'upload',
                path,
                updatedAt: payload.updatedAt,
                usptoCount: payload.counts.uspto,
                analysisCount: payload.counts.analysis
            }
        });
    })()
        .catch(async (error) => {
            console.warn('[Niche Memory Cloud] backup skipped:', error.message);
            await setStorage({
                [NHP_NICHE_MEMORY_CLOUD_STATUS_KEY]: {
                    ok: false,
                    action: 'upload',
                    error: error.message,
                    updatedAt: new Date().toISOString()
                }
            });
        })
        .finally(() => {
            persistentNicheMemoryCloudUploadPromise = null;
        });
}

function splitNichesByHistory(niches = [], historyMap = {}, allowedStatuses = [], options = {}) {
    if (typeof splitNichesByNicheCache === 'function') {
        const mode = options.mode || (allowedStatuses.includes('safe') || allowedStatuses.includes('banned') ? 'uspto' : 'analysis');
        const cache = options.cache
            || migrateLegacyHistoryToNicheCache(
                mode === 'uspto' ? historyMap : {},
                mode === 'analysis' ? historyMap : {},
                options.baseIso || new Date().toISOString()
            );
        return splitNichesByNicheCache(niches, cache, {
            mode,
            force: !!options.force,
            allowedStatuses,
        });
    }

    const buckets = {};
    allowedStatuses.forEach(status => { buckets[status] = []; });
    const pending = [];
    const seen = new Set();
    let rememberedCount = 0;
    for (const rawNiche of niches) {
        const niche = String(rawNiche || '').trim();
        const key = normalizeNicheKey(niche);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const status = historyMap[key];
        if (allowedStatuses.includes(status)) {
            buckets[status].push(niche);
            rememberedCount++;
        } else {
            pending.push(niche);
        }
    }
    return { pending, buckets, rememberedCount, totalUnique: seen.size };
}

async function splitNichesWithTtlCache(niches = [], { mode = 'uspto', allowedStatuses = [], force = false } = {}) {
    const bundle = await loadNicheCacheBundle(getStorage);
    return splitNichesByNicheCache(niches, bundle.cache, { mode, force, allowedStatuses });
}

async function touchNicheCacheFromLegacyMaps(usptoHistory = {}, tpHistory = {}, reason = 'sync') {
    let cache = sanitizeNicheCacheMap((await getStorage([NHP_NICHE_CACHE_STORAGE_KEY]))[NHP_NICHE_CACHE_STORAGE_KEY] || {});
    const now = new Date().toISOString();
    for (const [rawKey, rawStatus] of Object.entries(usptoHistory || {})) {
        cache = upsertNicheCacheUspto(cache, rawKey, rawStatus, now);
    }
    for (const [rawKey, rawStatus] of Object.entries(tpHistory || {})) {
        cache = upsertNicheCacheClassification(cache, rawKey, rawStatus, now);
    }
    return persistNicheCacheBundle(setStorage, cache, reason);
}

async function pingGhostServer(timeoutMs = 5000, port = GHOST_SERVER_PORT) {
    await fetchJsonWithTimeout(`${getGhostServerUrl(port)}/ping`, {}, timeoutMs);
    return true;
}

async function markGhostServerBootstrapStart(context = 'core') {
    try {
        await chrome.storage.local.set({
            [GHOST_SERVER_BOOTSTRAP_KEY]: {
                context,
                startedAt: Date.now()
            }
        });
    } catch (_) { }
}

async function clearGhostServerBootstrapState() {
    try {
        await chrome.storage.local.remove(GHOST_SERVER_BOOTSTRAP_KEY);
    } catch (_) { }
}

async function shouldBootstrapGhostServer(context = 'core') {
    try {
        const state = (await chrome.storage.local.get(GHOST_SERVER_BOOTSTRAP_KEY))?.[GHOST_SERVER_BOOTSTRAP_KEY] || null;
        const sameContext = state?.context === context;
        if (sameContext && state?.startedAt && (Date.now() - state.startedAt) < GHOST_SERVER_BOOTSTRAP_COOLDOWN_MS) {
            console.log('[GhostServer] bootstrap skipped Ï¿Ï│Ï¿Ï¿ cooldown ┘åÏ┤ÏÀ', { context, state });
            return false;
        }
    } catch (_) { }

    await markGhostServerBootstrapStart(context);
    return true;
}

function buildGhostServerLauncherVbs(platform = 'teepublic') {
    const projectDir = getNhpProjectDir();
    const setupScriptName = platform === 'pinterest'
        ? 'Start_Pinterest_Server_Background.cmd'
        : 'Start_Server_Setup_Silent.cmd';
    const setupCmdPath = typeof NhpRuntimeConfig !== 'undefined'
        ? NhpRuntimeConfig.joinPath(projectDir, setupScriptName)
        : `${projectDir}\\${setupScriptName}`;

    // ÏºÏ│Ï¬Ï«Ï»Ïº┘à PowerShell Ï¿Ï»┘äÏº┘ï ┘à┘å VBS ┘äÏ¬Ï¼┘åÏ¿ ┘àÏ┤Ïº┘â┘ä Ïº┘äÏ¬Ï¡┘à┘è┘ä
    const psCode = [
        `$ErrorActionPreference = 'Stop'`,
        `$projectDir = '${projectDir}'`,
        `$cmdPath = '${setupCmdPath}'`,
        `Set-Location $projectDir`,
        `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdPath -NoNewWindow -Wait:$false`
    ].join('\r\n');

    return psCode;
}

function sanitizeAccountProfileName(email = '') {
    return String(email || '').replace(/[^a-zA-Z0-9]/g, '_');
}

async function launchExternalAccountBrowser(req = {}) {
    const projectDir = getNhpProjectDir();
    const chromePath = getNhpChromePath();
    const email = req.account?.email || 'session_account';
    const safeEmail = sanitizeAccountProfileName(email);
    let targetUrl = req.targetUrl || 'https://www.teepublic.com/users/sign_in';
    if (req.platform === 'redbubble') targetUrl = 'https://www.redbubble.com/auth/login';
    if (req.platform === 'amazon') targetUrl = 'https://merch.amazon.com/designs/new';
    if (req.platform === 'pinterest') targetUrl = 'https://www.pinterest.com/pin-creation-tool/';

    const userDataDir = typeof NhpRuntimeConfig !== 'undefined' && NhpRuntimeConfig.joinDataPath
        ? NhpRuntimeConfig.joinDataPath(projectDir, 'server_profiles', safeEmail)
        : `${projectDir}\\..\\NHP_DATA\\server_profiles\\${safeEmail}`;
    const psCommand = [
        `$ErrorActionPreference = 'Stop'`,
        `$chromePath = '${chromePath.replace(/'/g, "''")}'`,
        `$userDataDir = '${userDataDir.replace(/'/g, "''")}'`,
        `$targetUrl = '${targetUrl.replace(/'/g, "''")}'`,
        `Start-Process -FilePath $chromePath -ArgumentList @('--new-window', '--no-first-run', '--disable-features=Translate', "--user-data-dir=$userDataDir", $targetUrl) -WorkingDirectory (Split-Path $chromePath)`
    ].join('; ');

    try {
        const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
            action: 'execute_command',
            command: psCommand
        });
        if (result && result.success) return { success: true, mode: 'native_messaging', targetUrl };
    } catch (e) {
        console.warn('[Account Browser] Native messaging unavailable', e);
    }

    try {
        await fetch(nhpUrl(3009, '/api/execute'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: wrapNhpLaunchCommand(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command "${psCommand}"`) }),
            signal: AbortSignal.timeout(LOCAL_BRIDGE_EXECUTE_TIMEOUT_MS)
        });
        return { success: true, mode: 'local_bridge', targetUrl };
    } catch (e) {
        console.warn('[Account Browser] Local bridge unavailable', e);
    }

    try {
        const protocolUrl = `nhp-account://open?email=${encodeURIComponent(email)}&targetUrl=${encodeURIComponent(targetUrl)}&platform=${encodeURIComponent(req.platform || 'teepublic')}`;
        const protocolInteractive = req.interactive !== false;
        const protocolTabLifetimeMs = protocolInteractive ? 12000 : 1500;
        chrome.tabs.create({ url: protocolUrl, active: !!protocolInteractive }, (tab) => {
            setTimeout(() => {
                if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => { });
            }, protocolTabLifetimeMs);
        });
        return { success: true, mode: 'custom_protocol', targetUrl };
    } catch (e) {
        console.warn('[Account Browser] Custom protocol unavailable', e);
    }

    return { success: false, mode: 'fallback_tab', targetUrl };
}

function mapGhostServerLaunchError(err, { action = 'start', platform = 'teepublic', port = 3019 } = {}) {
    const code = String(err?.code || '').trim();
    const msg = String(err?.message || err || '').trim();
    const combined = `${code} ${msg}`;
    if (code === 'EADDRINUSE' || /EADDRINUSE|address already in use/i.test(combined)) {
        return {
            ok: false,
            success: false,
            error: 'EADDRINUSE',
            message: `Ïº┘ä┘à┘å┘üÏ░ ${port} ┘àÏ┤Ï║┘ê┘ä ÔÇö ÏúÏ║┘ä┘é Ïº┘äÏ╣┘à┘ä┘èÏ® Ïº┘äÏ¬┘è Ï¬Ï│Ï¬Ï«Ï»┘à┘ç Ï½┘à ÏúÏ╣Ï» Ïº┘ä┘àÏ¡Ïº┘ê┘äÏ®`,
            source: 'spawn',
            action,
            platform,
            port,
        };
    }
    if (code === 'ENOENT' || /ENOENT|not found|cannot find/i.test(combined)) {
        return {
            ok: false,
            success: false,
            error: 'ENOENT',
            message: '┘à┘ä┘ü Ï¬Ï┤Ï║┘è┘ä Ghost Server Ï║┘èÏ▒ ┘à┘êÏ¼┘êÏ» ÔÇö Ï¬Ï¡┘é┘é ┘à┘å ┘àÏ│ÏºÏ▒ Ïº┘ä┘àÏ┤Ï▒┘êÏ╣',
            source: 'spawn',
            action,
            platform,
            port,
        };
    }
    if (/spawn/i.test(combined)) {
        return {
            ok: false,
            success: false,
            error: 'SPAWN_FAILED',
            message: msg || 'Ï¬Ï╣Ï░Ï▒ Ï¬Ï┤Ï║┘è┘ä Ï╣┘à┘ä┘èÏ® Ghost Server',
            source: 'spawn',
            action,
            platform,
            port,
        };
    }
    return {
        ok: false,
        success: false,
        error: code || 'LAUNCH_FAILED',
        message: msg || 'Ï¬Ï╣Ï░Ï▒ Ï¬Ï┤Ï║┘è┘ä Ghost Server',
        source: 'unavailable',
        action,
        platform,
        port,
    };
}

async function controlGhostServerProcess(action = 'start', platform = 'teepublic', interactive = true) {
    const projectDir = getNhpProjectDir();
    const safePlatform = String(platform || 'teepublic').toLowerCase();
    const isPinterest = safePlatform === 'pinterest';
    const psFilePath = isPinterest
        ? `${projectDir}\\Start_Pinterest_Server_Background.cmd`
        : `${projectDir}\\Start_Ghost_Server_On_Port_Hidden.cmd`;
    const ghostPort = PLATFORM_SERVER_PORTS[safePlatform] || GHOST_SERVER_PORT;
    const stopCmdPath = `${projectDir}\\Stop_Ghost_Server.cmd`;
    const protocolUrl = isPinterest ? 'nhp-pro-pinterest://start' : 'nhp-pro-ghost://start';

    let nativeCommand = '';
    let bridgeCommand = '';

    if (action === 'stop') {
        nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${stopCmdPath.replace(/'/g, "''")}' -WindowStyle Hidden`;
        bridgeCommand = `cmd.exe /c "${stopCmdPath}"`;
    } else if (isPinterest) {
        nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${psFilePath.replace(/'/g, "''")}' -WindowStyle Hidden`;
        bridgeCommand = `cmd.exe /c "${psFilePath}"`;
    } else {
        nativeCommand = `Start-Process -FilePath '${psFilePath.replace(/'/g, "''")}' -ArgumentList '${ghostPort}' -WorkingDirectory '${projectDir.replace(/'/g, "''")}' -WindowStyle Hidden`;
        bridgeCommand = `cmd.exe /c ""${psFilePath}" ${ghostPort}"`;
    }

    try {
        if (typeof chrome.runtime.sendNativeMessage === 'function') {
            const nativeStatus = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.ensureNativeHostReady
                ? await NhpPortablePaths.ensureNativeHostReady({ silent: true })
                : { ok: true };
            if (!nativeStatus.ok) {
                nhpLogOnce(
                    'ghost_native_host_missing',
                    'warn',
                    '[Server Control] Native messaging unavailable',
                    { action, platform: safePlatform, port: ghostPort, error: nativeStatus.error }
                );
            } else {
            const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
                action: 'execute_command',
                command: nativeCommand
            });
            if (result && result.success === false) {
                const mapped = mapGhostServerLaunchError(
                    new Error(result.error || result.message || 'native_launch_failed'),
                    { action, platform: safePlatform, port: ghostPort }
                );
                nhpLogOnce(
                    `ghost_native_launch_failed_${safePlatform}`,
                    'error',
                    '[Server Control] Native launch failed',
                    { action, platform: safePlatform, port: ghostPort, result }
                );
                return mapped;
            }
            if (result && result.success) {
                return { ok: true, success: true, source: 'native_messaging', permissionRequired: false, action, platform: safePlatform, port: ghostPort };
            }
            }
        }
    } catch (e) {
        nhpLogOnce(
            `ghost_native_error_${safePlatform}`,
            'error',
            '[Server Control] Native messaging error',
            { action, platform: safePlatform, port: ghostPort, error: e?.message || e }
        );
        const mapped = mapGhostServerLaunchError(e, { action, platform: safePlatform, port: ghostPort });
        if (mapped.error === 'EADDRINUSE' || mapped.error === 'ENOENT' || mapped.error === 'SPAWN_FAILED') {
            return mapped;
        }
    }

    const bridgeResult = await tryLocalBridgeExecute(bridgeCommand);
    if (bridgeResult.success) {
        return { ok: true, success: true, source: 'local_bridge', permissionRequired: false, action, platform: safePlatform, port: ghostPort };
    }
    if (!bridgeResult.skipped) {
        nhpLogOnce(
            `ghost_bridge_error_${safePlatform}`,
            'error',
            '[Server Control] Local bridge error',
            { action, platform: safePlatform, port: ghostPort, error: bridgeResult.error }
        );
        const mapped = mapGhostServerLaunchError(new Error(bridgeResult.error || 'bridge_failed'), { action, platform: safePlatform, port: ghostPort });
        if (mapped.error === 'EADDRINUSE' || mapped.error === 'ENOENT') {
            return mapped;
        }
    }

    if (action === 'start') {
        try {
            const protocolTabLifetimeMs = interactive ? 12000 : 1500;
            chrome.tabs.create({ url: protocolUrl, active: !!interactive }, (tab) => {
                setTimeout(() => {
                    if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => { });
                }, protocolTabLifetimeMs);
            });
            return { ok: true, success: true, source: 'custom_protocol', permissionRequired: true, action, platform: safePlatform, port: ghostPort };
        } catch (e) {
            nhpLogOnce(
                `ghost_protocol_error_${safePlatform}`,
                'error',
                '[Server Control] Protocol fallback failed',
                { action, platform: safePlatform, port: ghostPort, error: e?.message || e }
            );
            return mapGhostServerLaunchError(e, { action, platform: safePlatform, port: ghostPort });
        }
    }

    const nativeHostHint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
        ? NhpPortablePaths.buildNativeHostRegisterHint(projectDir)
        : null;
    return {
        ok: false,
        success: false,
        source: 'unavailable',
        permissionRequired: false,
        nativeHostRequired: true,
        action,
        platform: safePlatform,
        port: ghostPort,
        error: 'UNAVAILABLE',
        message: nativeHostHint?.messageAr || (action === 'start'
            ? '┘äÏº ┘è┘êÏ¼Ï» ┘àÏ┤Ï║┘æ┘ä Ï«ÏºÏ▒Ï¼┘è ┘äÏ¬Ï┤Ï║┘è┘ä Ghost Server'
            : '┘äÏº ┘è┘êÏ¼Ï» ┘àÏ┤Ï║┘æ┘ä Ï«ÏºÏ▒Ï¼┘è ┘äÏÑ┘è┘éÏº┘ü Ghost Server'),
        registerScript: nativeHostHint?.registerScript || '',
        registerCommand: nativeHostHint?.registerCommand || ''
    };
}


async function controlCreatyServerProcess(action = 'start') {
    const projectDir = getNhpProjectDir();
    const startPath = `${projectDir}\\Start_Creaty_Server_Background.cmd`;
    const stopPath = `${projectDir}\\Stop_Creaty_Server.cmd`;
    let nativeCommand = '';
    let bridgeCommand = '';
    if (action === 'stop') {
        nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${stopPath.replace(/'/g, "''")}' -WindowStyle Hidden`;
        bridgeCommand = `cmd.exe /c "${stopPath}"`;
    } else {
        nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${startPath.replace(/'/g, "''")}', 'force' -WindowStyle Hidden`;
        bridgeCommand = `cmd.exe /c "${startPath}" force`;
    }
    try {
        const nativeStatus = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.ensureNativeHostReady
            ? await NhpPortablePaths.ensureNativeHostReady({ silent: true })
            : { ok: true };
        if (nativeStatus.ok && typeof chrome.runtime.sendNativeMessage === 'function') {
            const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
                action: 'execute_command',
                command: nativeCommand
            });
            if (result && result.success) {
                return { success: true, source: 'native_messaging', action, port: 3020 };
            }
        } else if (!nativeStatus.ok) {
            nhpLogOnce('creaty_native_host_missing', 'warn', '[Creaty Server Control] Native messaging unavailable', nativeStatus.error);
        }
    } catch (e) {
        nhpLogOnce('creaty_native_unavailable', 'warn', '[Creaty Server Control] Native messaging unavailable', e);
    }
    const bridgeResult = await tryLocalBridgeExecute(bridgeCommand);
    if (bridgeResult.success) {
        return { success: true, source: 'local_bridge', action, port: 3020 };
    }
    if (!bridgeResult.skipped) {
        nhpLogOnce('creaty_bridge_unavailable', 'warn', '[Creaty Server Control] Local bridge unavailable', bridgeResult.error);
    }
    const nativeHostHint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
        ? NhpPortablePaths.buildNativeHostRegisterHint(projectDir)
        : null;
    return {
        success: false,
        source: 'unavailable',
        action,
        port: 3020,
        nativeHostRequired: true,
        error: nativeHostHint?.messageAr || 'No external launcher is available for Creaty.',
        registerScript: nativeHostHint?.registerScript || '',
        registerCommand: nativeHostHint?.registerCommand || ''
    };
}

async function controlCliproxyLocalServer(action = 'start') {
    const def = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.getServerById('cliproxy-local') : null;
    const relScript = action === 'stop' ? def?.stopScript : def?.startScript;
    const projectDir = await ensureNhpProjectDirResolved();
    const scriptPath = def && projectDir
        ? NhpLocalServers.joinProjectPath(projectDir, relScript)
        : '';
    if (!scriptPath) {
        return { success: false, source: 'unavailable', action, port: 8317, error: 'CLIProxy launcher script unavailable.' };
    }
    const launchResult = await executeNhpLauncherScript(scriptPath, {
        serverId: 'cliproxy-local',
        command: action,
        port: 8317
    });
    if (!launchResult.success) {
        return { ...launchResult, action, port: 8317, error: launchResult.error || 'No external launcher is available for CLIProxyAPI local.' };
    }
    return { ...launchResult, action, port: 8317 };
}

async function pingCliproxyLocalServer(timeoutMs = 2200) {
    const base = typeof NhpProxyEndpoints !== 'undefined'
        ? NhpProxyEndpoints.LOCAL_BASE_URL
        : 'http://127.0.0.1:8317/v1';
    try {
        const res = await fetch(`${String(base).replace(/\/+$/, '')}/models`, {
            method: 'GET',
            headers: { Authorization: 'Bearer nhp-local-cliproxy-key' },
            signal: AbortSignal.timeout(timeoutMs)
        });
        return res.ok || res.status === 401;
    } catch (_) {
        try {
            await fetchJsonWithTimeout(nhpUrl(8317, '/ping'), {}, timeoutMs);
            return true;
        } catch (__) {
            return false;
        }
    }
}

async function ensureCliProxyLocalServerReady() {
    try {
        const prefs = await chrome.storage.local.get([NHP_AUTO_START_CLIPROXY_KEY]);
        if (prefs[NHP_AUTO_START_CLIPROXY_KEY] !== true) return false;
    } catch (_) { return false; }

    if (await pingCliproxyLocalServer(1800)) return true;

    const launch = await controlCliproxyLocalServer('start');
    if (!launch.success) return false;

    for (let attempt = 1; attempt <= 8; attempt += 1) {
        await delay(1500);
        if (await pingCliproxyLocalServer(2200)) return true;
    }
    return false;
}

async function controlNhpLocalServer(serverId = '', command = 'start', interactive = false) {
    const id = String(serverId || '').trim();
    const action = command === 'terminal'
        ? 'terminal'
        : (command === 'stop' ? 'stop' : (command === 'restart' ? 'restart' : 'start'));
    const def = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.getServerById(id) : null;
    if (!def) return { success: false, serverId: id, command: action, error: 'Unknown local server id.' };

    if (action === 'restart') {
        await controlNhpLocalServer(id, 'stop', interactive);
        await delay(1200);
        return controlNhpLocalServer(id, 'start', interactive);
    }

    const projectDir = await ensureNhpProjectDirResolved();
    if (!projectDir) {
        return {
            success: false,
            serverId: id,
            command: action,
            port: def.port,
            error: 'Project directory is not configured. Run Register_NHP_Native_Messaging_User.bat once, then reload the extension.'
        };
    }

    const relScript = action === 'stop' ? def.stopScript : def.startScript;
    const scriptPath = NhpLocalServers.joinProjectPath(projectDir, relScript);
    const launchResult = await executeNhpLauncherScript(scriptPath, {
        interactive,
        terminal: action === 'terminal',
        serverId: id,
        command: action,
        port: def.port
    });
    if (!launchResult.success) return launchResult;

    if (action === 'terminal') {
        return { ...launchResult, serverId: id, command: action, port: def.port, online: null };
    }

    const waitMs = action === 'start' ? 2800 : 1000;
    await delay(waitMs);

    let online = false;
    if (def.type === 'cliproxy' || def.port === 8317) {
        if (action === 'start') {
            for (let attempt = 1; attempt <= 8; attempt += 1) {
                if (await pingCliproxyLocalServer(2000)) {
                    online = true;
                    return { ...launchResult, serverId: id, command: action, port: def.port, online: true, attempt };
                }
                await delay(1200);
            }
        } else {
            online = !(await pingCliproxyLocalServer(1500));
        }
    } else {
        try {
            await fetchJsonWithTimeout(nhpUrl(def.port, '/ping'), {}, 2000);
            online = true;
        } catch (_) {
            online = false;
        }
    }

    return { ...launchResult, serverId: id, command: action, port: def.port, online };
}

async function readNhpLocalServersDisabledMap() {
    const disabledKey = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.DISABLED_STORAGE_KEY : 'nhpLocalServersDisabled';
    try {
        const stored = await chrome.storage.local.get([disabledKey]);
        return { disabledKey, map: stored[disabledKey] || {} };
    } catch (_) {
        return { disabledKey, map: {} };
    }
}

async function clearNhpLocalServerDisabled(serverId, { clearAll = false } = {}) {
    const { disabledKey, map } = await readNhpLocalServersDisabledMap();
    const id = String(serverId || '').trim();
    if (!clearAll && !id) return false;
    const next = { ...map };
    if (clearAll) {
        const hadDisabled = Object.values(next).some((value) => value === true);
        if (!hadDisabled) return false;
        await chrome.storage.local.set({ [disabledKey]: {} });
        return true;
    }
    if (next[id] !== true) return false;
    delete next[id];
    await chrome.storage.local.set({ [disabledKey]: next });
    return true;
}

async function getNhpLocalServersStatusSnapshot() {
    const list = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.NHP_LOCAL_SERVERS : [];
    const { map: disabled } = await readNhpLocalServersDisabledMap();

    const servers = [];
    for (const def of list) {
        let online = false;
        if (def.port === 8317) {
            online = await pingCliproxyLocalServer(1800);
        } else {
            try {
                await fetchJsonWithTimeout(nhpUrl(def.port, '/ping'), {}, 1800);
                online = true;
            } catch (_) { }
        }
        servers.push({
            id: def.id,
            label: def.label,
            port: def.port,
            type: def.type,
            online,
            disabled: disabled[def.id] === true,
            source: online ? 'direct-ping' : 'offline'
        });
    }
    return { success: true, servers };
}

async function controlNonAutopilotServers(action = 'start', interactive = false) {
    const projectDir = getNhpProjectDir();
    let nativeCommand = '';
    let bridgeCommand = '';
    const scriptName = action === 'stop' ? 'Stop_NonAutopilot_Servers.cmd' : 'Start_NonAutopilot_Servers.cmd';
    const scriptPath = `${projectDir}\\${scriptName}`;
    nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${scriptPath.replace(/'/g, "''")}' -WindowStyle Hidden`;
    bridgeCommand = `cmd.exe /c "${scriptPath}"`;

    try {
        const nativeStatus = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.ensureNativeHostReady
            ? await NhpPortablePaths.ensureNativeHostReady({ silent: true })
            : { ok: true };
        if (nativeStatus.ok && typeof chrome.runtime.sendNativeMessage === 'function') {
            const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
                action: 'execute_command',
                command: nativeCommand
            });
            if (result && result.success) {
                return { success: true, source: 'native_messaging', action };
            }
        } else if (!nativeStatus.ok) {
            nhpLogOnce('nonautopilot_native_host_missing', 'warn', '[Non-Autopilot Servers] Native messaging unavailable', nativeStatus.error);
        }
    } catch (error) {
        nhpLogOnce('nonautopilot_native_unavailable', 'warn', '[Non-Autopilot Servers] Native messaging unavailable', error);
    }

    const bridgeResult = await tryLocalBridgeExecute(bridgeCommand);
    if (bridgeResult.success) {
        return { success: true, source: 'local_bridge', action };
    }
    if (!bridgeResult.skipped) {
        nhpLogOnce('nonautopilot_bridge_unavailable', 'warn', '[Non-Autopilot Servers] Local bridge unavailable', bridgeResult.error);
    }

    if (action === 'stop') {
        try {
            await fetch(`${getAiBridgeServerUrl()}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(1500) });
            return { success: true, source: 'http_shutdown', action };
        } catch (_) { }
    }

    try {
        const protocolUrl = action === 'stop' ? 'nhp-ai-servers-stop://run' : 'nhp-ai-servers://run';
        const protocolTabLifetimeMs = interactive ? 12000 : 1500;
        chrome.tabs.create({ url: protocolUrl, active: !!interactive }, (tab) => {
            setTimeout(() => {
                if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => { });
            }, protocolTabLifetimeMs);
        });
        return { success: true, source: 'custom_protocol', permissionRequired: true, action };
    } catch (error) {
        nhpLogOnce('nonautopilot_protocol_failed', 'warn', '[Non-Autopilot Servers] Protocol fallback failed', error);
    }

    const nativeHostHint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
        ? NhpPortablePaths.buildNativeHostRegisterHint(projectDir)
        : null;
    return {
        success: false,
        source: 'unavailable',
        action,
        nativeHostRequired: true,
        registerScript: nativeHostHint?.registerScript || '',
        registerCommand: nativeHostHint?.registerCommand || '',
        error: nativeHostHint?.messageAr || (action === 'start'
            ? 'Unable to start non-Autopilot servers. Register Native Messaging first.'
            : 'Unable to stop non-Autopilot servers. Register Native Messaging first.')
    };
}

async function controlAiChromeSession(action = 'start', interactive = false) {
    const projectDir = getNhpProjectDir();
    const scriptName = action === 'restart' ? 'Restart_AI_Controlled_Chrome.cmd' : 'Start_AI_Controlled_Chrome.cmd';
    const scriptPath = `${projectDir}\\${scriptName}`;
    const nativeCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '${scriptPath.replace(/'/g, "''")}' -WindowStyle Hidden`;
    const bridgeCommand = `cmd.exe /c "${scriptPath}"`;

    try {
        const nativeStatus = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.ensureNativeHostReady
            ? await NhpPortablePaths.ensureNativeHostReady({ silent: true })
            : { ok: true };
        if (nativeStatus.ok && typeof chrome.runtime.sendNativeMessage === 'function') {
            const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
                action: 'execute_command',
                command: nativeCommand
            });
            if (result && result.success) {
                return { success: true, source: 'native_messaging', action, debugPort: 9331 };
            }
        } else if (!nativeStatus.ok) {
            nhpLogOnce('ai_chrome_native_host_missing', 'warn', '[AI Chrome Session] Native messaging unavailable', nativeStatus.error);
        }
    } catch (error) {
        nhpLogOnce('ai_chrome_native_unavailable', 'warn', '[AI Chrome Session] Native messaging unavailable', error);
    }

    const bridgeResult = await tryLocalBridgeExecute(bridgeCommand);
    if (bridgeResult.success) {
        return { success: true, source: 'local_bridge', action, debugPort: 9331 };
    }
    if (!bridgeResult.skipped) {
        nhpLogOnce('ai_chrome_bridge_unavailable', 'warn', '[AI Chrome Session] Local bridge unavailable', bridgeResult.error);
    }

    try {
        const protocolUrl = action === 'restart' ? 'nhp-ai-chrome-restart://run' : 'nhp-ai-chrome://run';
        const protocolTabLifetimeMs = interactive ? 12000 : 1500;
        chrome.tabs.create({ url: protocolUrl, active: !!interactive }, (tab) => {
            setTimeout(() => {
                if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => { });
            }, protocolTabLifetimeMs);
        });
        return { success: true, source: 'custom_protocol', permissionRequired: true, action, debugPort: 9331 };
    } catch (error) {
        nhpLogOnce('ai_chrome_protocol_failed', 'warn', '[AI Chrome Session] Protocol fallback failed', error);
    }

    const nativeHostHint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
        ? NhpPortablePaths.buildNativeHostRegisterHint(projectDir)
        : null;
    return {
        success: false,
        source: 'unavailable',
        action,
        debugPort: 9331,
        nativeHostRequired: true,
        registerScript: nativeHostHint?.registerScript || '',
        registerCommand: nativeHostHint?.registerCommand || '',
        error: nativeHostHint?.messageAr || 'Unable to start controlled Chrome session. Register Native Messaging first.'
    };
}

async function getPlatformServerStatus(platform = 'teepublic') {
    const safePlatform = String(platform || 'teepublic').toLowerCase();
    const port = PLATFORM_SERVER_PORTS[safePlatform] || PLATFORM_SERVER_PORTS.teepublic;
    let managerStatuses = null;
    try {
        managerStatuses = await fetchJsonWithTimeout(nhpUrl(3009, '/api/status'), {}, 4000);
    } catch (err) {
        recordNhpDiagnosticLog('info', ['[Background][ServerStatus] manager offline', { platform: safePlatform, error: err.message }]);
    }

    const managerOnline = managerStatuses?.[safePlatform] === 'ONLINE';
    if (managerOnline) {
        return { success: true, platform: safePlatform, port, online: true, statuses: managerStatuses, source: 'manager' };
    }

    try {
        await fetchJsonWithTimeout(nhpUrl(port, '/ping'), {}, 2500);
        return { success: true, platform: safePlatform, port, online: true, statuses: managerStatuses, source: 'direct-ping' };
    } catch (err) {
        recordNhpDiagnosticLog('info', ['[Background][ServerStatus] direct ping offline', { platform: safePlatform, port, error: err.message }]);
    }

    return { success: true, platform: safePlatform, port, online: false, statuses: managerStatuses, source: 'offline' };
}

async function getExtensionServersStatusSnapshot() {
    const managerStatus = {
        online: false,
        statusPayload: null,
        source: 'offline'
    };
    try {
        managerStatus.statusPayload = await fetchJsonWithTimeout(nhpUrl(3009, '/api/status'), {}, 3500);
        managerStatus.online = true;
        managerStatus.source = 'manager-status';
    } catch (_) {
        try {
            await fetchJsonWithTimeout(nhpUrl(3009, '/api/ping'), {}, 2000);
            managerStatus.online = true;
            managerStatus.source = 'manager-ping';
        } catch (_) { }
    }

    const servers = [];
    for (const def of DASHBOARD_EXTENSION_SERVERS) {
        if (def.type === 'platform') {
            const status = await getPlatformServerStatus(def.platform);
            servers.push({
                id: def.id,
                type: def.type,
                label: def.label,
                platform: def.platform,
                port: def.port,
                online: !!status.online,
                source: status.source
            });
            continue;
        }

        if (def.type === 'cliproxy') {
            const online = await pingCliproxyLocalServer(1800);
            servers.push({
                id: def.id,
                type: def.type,
                label: def.label,
                port: def.port,
                online,
                source: online ? 'direct-ping' : 'offline'
            });
            continue;
        }

        let online = false;
        try {
            await fetchJsonWithTimeout(`${getAiBridgeServerUrl()}/ping`, {}, 1800);
            online = true;
        } catch (_) { }
        servers.push({
            id: def.id,
            type: def.type,
            label: def.label,
            port: def.port,
            online,
            source: online ? 'direct-ping' : 'offline'
        });
    }

    return { manager: managerStatus, servers };
}

async function bootstrapGhostServerForMemory(context = 'core', platform = 'teepublic') {
    const shouldBootstrap = await shouldBootstrapGhostServer(context);
    if (!shouldBootstrap) return false;

    console.log(`[Server Bootstrap] Triggering for ${platform}...`);
    const protocolUrl = platform === 'pinterest' ? 'nhp-pro-pinterest://start' : 'nhp-pro-ghost://start';
    const serverFile = platform === 'pinterest' ? 'pinterest-server.js' : 'ghost-server.js';

    // Ïº┘ä┘àÏ¡Ïº┘ê┘äÏ® 1: Native Messaging ÏÑÏ░Ïº ┘âÏº┘å ┘àÏ¬ÏºÏ¡Ïº┘ï
    try {
        const psCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'Start_Server_Direct.cmd ${serverFile}' -NoNewWindow -Wait:$false`;

        const result = await chrome.runtime.sendNativeMessage('com.nhp.server_launcher', {
            action: 'execute_command',
            command: psCommand
        });

        if (result && result.success) {
            console.log('[Server Bootstrap] Started via native messaging');
            return true;
        }
    } catch (e) {
        recordNhpDiagnosticLog('info', ['[Server Bootstrap] Native messaging unavailable', {
            error: e?.message || String(e),
            runtimeId: chrome?.runtime?.id || 'unknown',
            hint: 'Run Register_NHP_Native_Messaging_User.bat and ensure allowed_origins uses this runtimeId.'
        }]);
    }

    // Ïº┘ä┘àÏ¡Ïº┘ê┘äÏ® 2: Local Bridge (ÏÑÏ░Ïº ┘âÏº┘å ┘ç┘åÏº┘â Ï│┘èÏ▒┘üÏ▒ ÏóÏ«Ï▒ ┘èÏ╣┘à┘ä)
    try {
        await fetch(nhpUrl(3009, '/api/execute'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: `cmd.exe /c Start_Server_Direct.cmd ${serverFile}` }),
            signal: AbortSignal.timeout(LOCAL_BRIDGE_EXECUTE_TIMEOUT_MS)
        });
        console.log('[Server Bootstrap] Started via Local Bridge');
        return true;
    } catch (e) { }

    // Ïº┘ä┘àÏ¡Ïº┘ê┘äÏ® 3: Ïº┘äÏ¿Ï▒┘êÏ¬┘ê┘â┘ê┘ä Ïº┘ä┘àÏ«ÏÁÏÁ ┘âÏ¡┘ä ÏúÏ«┘èÏ▒ ┘ü┘éÏÀ
    try {
        chrome.tabs.create({ url: protocolUrl, active: false }, (tab) => {
            setTimeout(() => {
                if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => { });
            }, 1500);
        });
        console.log('[Server Bootstrap] Protocol fallback triggered');
        return true;
    } catch (e) {
        recordNhpDiagnosticLog('warn', ['[Server Bootstrap] Protocol fallback failed', e]);
    }

    return true;
}

async function ensureGhostServerReady(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const port = Number(opts.port) || GHOST_SERVER_PORT;
    const forceBootstrap = opts.forUpload === true || opts.forceBootstrap === true;
    for (const timeoutMs of [5000, 8000]) {
        try {
            await pingGhostServer(timeoutMs, port);
            await clearGhostServerBootstrapState();
            console.log('[Autopilot][Upload] Ghost Server ping OK', { timeoutMs, port });
            return true;
        } catch (pingErr) {
            console.warn('[Autopilot][Upload] Ghost Server ping failed:', pingErr?.message || pingErr, { timeoutMs, port });
        }
    }

    if (!forceBootstrap && !shouldAttemptLocalGhostBootstrap()) {
        console.warn('[Autopilot][Upload] Ghost bootstrap skipped ÔÇö remote CLI proxy mode; server must already be running on', port);
        return false;
    }

    if (persistentGhostServerBootPromise) return persistentGhostServerBootPromise;

    persistentGhostServerBootPromise = (async () => {
        try {
            await bootstrapGhostServerForMemory('ensure-ready');
            for (let attempt = 1; attempt <= 5; attempt++) {
                await delay(2000);
                try {
                    await pingGhostServer(5000, port);
                    await clearGhostServerBootstrapState();
                    return true;
                } catch (_) { }
            }
            return false;
        } finally {
            persistentGhostServerBootPromise = null;
        }
    })();

    return persistentGhostServerBootPromise;
}

async function importPersistentNicheMemory(force = false) {
    if (persistentNicheMemoryLoaded && !force) {
        const existing = await getStorage([NHP_NICHE_MEMORY_STORAGE_KEY]);
        return sanitizePersistentNicheMemory(existing[NHP_NICHE_MEMORY_STORAGE_KEY] || {});
    }

    if (persistentNicheMemoryLoadPromise && !force) return persistentNicheMemoryLoadPromise;

    persistentNicheMemoryLoadPromise = (async () => {
        const storageData = await getStorage([
            'usptoHistory', 'tpHistory', 'uSafe', 'uBanned', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp',
            NHP_NICHE_MEMORY_STORAGE_KEY, NHP_NICHE_MEMORY_PATH_KEY
        ]);

        const storageMemory = mergePersistentNicheMemory(
            storageData[NHP_NICHE_MEMORY_STORAGE_KEY] || {},
            {
                path: storageData[NHP_NICHE_MEMORY_PATH_KEY] || null,
                uspto: {
                    ...(storageData.usptoHistory || {}),
                    ...buildHistoryMapFromBucketLists({
                        safe: storageData.uSafe || [],
                        banned: storageData.uBanned || []
                    }, ['safe', 'banned'])
                },
                teepublic: {
                    ...(storageData.tpHistory || {}),
                    ...buildHistoryMapFromBucketLists({
                        excel: storageData.tpExcel || [],
                        med: storageData.tpMed || [],
                        sat: storageData.tpSat || [],
                        emp: storageData.tpEmp || []
                    }, ['excel', 'med', 'sat', 'emp'])
                }
            }
        );

        let mergedMemory = storageMemory;

        try {
            const cloudMemory = await importNicheMemoryCloudBackup();
            if (cloudMemory) {
                mergedMemory = mergePersistentNicheMemory(cloudMemory, mergedMemory);
            }
        } catch (error) {
            console.warn('[Niche Memory Cloud] import skipped:', error.message);
        }

        try {
            const ready = await ensureGhostServerReady();
            if (ready) {
                const remoteData = await fetchJsonWithTimeout(`${getGhostServerUrl()}/niche-memory`, {}, 4000);
                mergedMemory = mergePersistentNicheMemory(remoteData.memory || {}, mergedMemory, {
                    path: remoteData.memoryPath || storageMemory.path || null
                });
            }
        } catch (error) {
            console.warn('[Niche Memory] import skipped:', error.message);
        }

        await touchNicheCacheFromLegacyMaps(mergedMemory.uspto, mergedMemory.teepublic, 'startup_import');
        await setStorage({
            usptoHistory: mergedMemory.uspto,
            tpHistory: mergedMemory.teepublic,
            [NHP_NICHE_MEMORY_STORAGE_KEY]: mergedMemory,
            [NHP_NICHE_MEMORY_PATH_KEY]: mergedMemory.path || null
        });

        queueNicheMemoryCloudBackup(mergedMemory, 'startup_import');
        persistentNicheMemoryLoaded = true;
        return mergedMemory;
    })();

    try {
        return await persistentNicheMemoryLoadPromise;
    } finally {
        persistentNicheMemoryLoadPromise = null;
    }
}

async function persistPersistentNicheMemory(reason = 'sync') {
    const storageData = await getStorage([
        'usptoHistory', 'tpHistory', 'uSafe', 'uBanned', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp',
        NHP_NICHE_MEMORY_STORAGE_KEY, NHP_NICHE_MEMORY_PATH_KEY
    ]);

    const mergedMemory = mergePersistentNicheMemory(
        storageData[NHP_NICHE_MEMORY_STORAGE_KEY] || {},
        {
            path: storageData[NHP_NICHE_MEMORY_PATH_KEY] || null,
            uspto: {
                ...(storageData.usptoHistory || {}),
                ...buildHistoryMapFromBucketLists({
                    safe: storageData.uSafe || [],
                    banned: storageData.uBanned || []
                }, ['safe', 'banned'])
            },
            teepublic: {
                ...(storageData.tpHistory || {}),
                ...buildHistoryMapFromBucketLists({
                    excel: storageData.tpExcel || [],
                    med: storageData.tpMed || [],
                    sat: storageData.tpSat || [],
                    emp: storageData.tpEmp || []
                }, ['excel', 'med', 'sat', 'emp'])
            }
        }
    );

    await setStorage({
        usptoHistory: mergedMemory.uspto,
        tpHistory: mergedMemory.teepublic,
        [NHP_NICHE_MEMORY_STORAGE_KEY]: mergedMemory,
        [NHP_NICHE_MEMORY_PATH_KEY]: mergedMemory.path || null
    });

    try {
        const ready = await ensureGhostServerReady();
        if (!ready) {
            queueNicheMemoryCloudBackup(mergedMemory, reason);
            return null;
        }

        const response = await fetch(`${getGhostServerUrl()}/niche-memory/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memory: mergedMemory, reason })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const savedMemory = mergePersistentNicheMemory(payload.memory || mergedMemory, {
            path: payload.memoryPath || mergedMemory.path || null
        });

        await setStorage({
            usptoHistory: savedMemory.uspto,
            tpHistory: savedMemory.teepublic,
            [NHP_NICHE_MEMORY_STORAGE_KEY]: savedMemory,
            [NHP_NICHE_MEMORY_PATH_KEY]: savedMemory.path || null
        });

        queueNicheMemoryCloudBackup(savedMemory, reason);
        return payload;
    } catch (error) {
        console.warn('[Niche Memory] export skipped:', error.message);
        queueNicheMemoryCloudBackup(mergedMemory, reason);
        return null;
    }
}

function primePersistentNicheMemory() {
    importPersistentNicheMemory().then(async () => {
        try {
            const bundle = await loadNicheCacheBundle(getStorage);
            await persistNicheCacheBundle(setStorage, bundle.cache, 'startup_prune');
        } catch (error) {
            console.warn('[Niche Cache] startup prune skipped:', error.message);
        }
    }).catch(error => {
        console.warn('[Niche Memory] prime failed:', error.message);
    });
}

function createEmptyNicheArchive() {
    return {
        version: 1,
        updatedAt: null,
        snapshotCount: 0,
        lastSnapshotId: null,
        niches: {}
    };
}

function createDefaultTrendArchiveSettings() {
    return {
        enabled: true,
        intervalMinutes: 180,
        lastAutoCaptureAt: null
    };
}

function sanitizeTrendArchiveSettings(rawSettings = {}) {
    const defaults = createDefaultTrendArchiveSettings();
    return {
        enabled: rawSettings?.enabled !== false,
        intervalMinutes: Number.isFinite(rawSettings?.intervalMinutes) && rawSettings.intervalMinutes >= 60
            ? Math.floor(rawSettings.intervalMinutes)
            : defaults.intervalMinutes,
        lastAutoCaptureAt: typeof rawSettings?.lastAutoCaptureAt === 'string' ? rawSettings.lastAutoCaptureAt : null
    };
}

function sanitizeTrendSnapshot(rawSnapshot = {}) {
    const fetchedAt = typeof rawSnapshot.fetchedAt === 'string' ? rawSnapshot.fetchedAt : new Date().toISOString();
    const dateKey = typeof rawSnapshot.dateKey === 'string' && rawSnapshot.dateKey
        ? rawSnapshot.dateKey
        : fetchedAt.slice(0, 10);
    const snapshotId = typeof rawSnapshot.snapshotId === 'string' && rawSnapshot.snapshotId
        ? rawSnapshot.snapshotId
        : `${dateKey}_${Date.now()}`;
    const source = typeof rawSnapshot.source === 'string' && rawSnapshot.source.trim()
        ? rawSnapshot.source.trim()
        : 'manual_fetch';

    const trends = Array.isArray(rawSnapshot.trends) ? rawSnapshot.trends : [];
    const cleanTrends = [];
    const seen = new Set();

    trends.forEach((entry, index) => {
        const text = String(typeof entry === 'string' ? entry : entry?.text || entry?.title || '').trim();
        const key = normalizeNicheKey(text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        const rawRank = Number.isFinite(entry?.rank) ? entry.rank : index + 1;
        cleanTrends.push({
            text,
            rank: Math.max(1, Math.floor(rawRank)),
            priority: Math.max(1, Math.floor(rawRank))
        });
    });

    return {
        version: 1,
        snapshotId,
        fetchedAt,
        dateKey,
        source,
        count: cleanTrends.length,
        trends: cleanTrends
    };
}

function sanitizeTmhHistory(source = {}) {
    const result = {};
    if (!source || typeof source !== 'object') return result;
    for (const [rawKey, rawValue] of Object.entries(source)) {
        const key = normalizeNicheKey(rawKey);
        const value = String(rawValue || '').trim().toLowerCase();
        if (!key || !['safe', 'restricted'].includes(value)) continue;
        result[key] = value;
    }
    return result;
}

function sanitizeArchiveRecord(rawKey, rawRecord = {}) {
    const text = String(rawRecord.text || rawKey || '').trim();
    if (!text) return null;

    const numericOrNull = (value) => Number.isFinite(value) && value > 0 ? Math.floor(value) : null;

    return {
        text,
        firstSeenAt: typeof rawRecord.firstSeenAt === 'string' ? rawRecord.firstSeenAt : null,
        lastSeenAt: typeof rawRecord.lastSeenAt === 'string' ? rawRecord.lastSeenAt : null,
        firstSeenDate: typeof rawRecord.firstSeenDate === 'string' ? rawRecord.firstSeenDate : null,
        lastSeenDate: typeof rawRecord.lastSeenDate === 'string' ? rawRecord.lastSeenDate : null,
        appearances: Number.isFinite(rawRecord.appearances) && rawRecord.appearances > 0 ? Math.floor(rawRecord.appearances) : 0,
        bestRank: numericOrNull(rawRecord.bestRank),
        latestRank: numericOrNull(rawRecord.latestRank),
        firstSnapshotId: typeof rawRecord.firstSnapshotId === 'string' ? rawRecord.firstSnapshotId : null,
        lastSnapshotId: typeof rawRecord.lastSnapshotId === 'string' ? rawRecord.lastSnapshotId : null,
        lastSource: typeof rawRecord.lastSource === 'string' ? rawRecord.lastSource : null,
        lastQuality: typeof rawRecord.lastQuality === 'string' ? rawRecord.lastQuality : null,
        stages: {
            trend: rawRecord.stages?.trend === 'captured' ? 'captured' : null,
            tmhunt: ['safe', 'restricted'].includes(rawRecord.stages?.tmhunt) ? rawRecord.stages.tmhunt : null,
            uspto: ['safe', 'banned'].includes(rawRecord.stages?.uspto) ? rawRecord.stages.uspto : null,
            analysis: ['excel', 'med', 'sat', 'emp'].includes(rawRecord.stages?.analysis) ? rawRecord.stages.analysis : null,
            note: ['queued', 'done', 'manual', 'removed'].includes(rawRecord.stages?.note) ? rawRecord.stages.note : null
        }
    };
}

function sanitizeNicheArchive(rawArchive = {}) {
    const clean = createEmptyNicheArchive();
    clean.updatedAt = typeof rawArchive.updatedAt === 'string' ? rawArchive.updatedAt : null;
    clean.snapshotCount = Number.isFinite(rawArchive.snapshotCount) && rawArchive.snapshotCount > 0 ? Math.floor(rawArchive.snapshotCount) : 0;
    clean.lastSnapshotId = typeof rawArchive.lastSnapshotId === 'string' ? rawArchive.lastSnapshotId : null;

    const sourceNiches = rawArchive.niches && typeof rawArchive.niches === 'object' ? rawArchive.niches : {};
    for (const [rawKey, rawRecord] of Object.entries(sourceNiches)) {
        const key = normalizeNicheKey(rawKey || rawRecord?.text);
        const record = sanitizeArchiveRecord(key, rawRecord);
        if (!key || !record) continue;
        clean.niches[key] = record;
    }

    return clean;
}

function mergeNicheArchiveRecords(baseRecord, incomingRecord) {
    const base = sanitizeArchiveRecord(baseRecord?.text || incomingRecord?.text, baseRecord || {}) || sanitizeArchiveRecord(incomingRecord?.text, incomingRecord || {});
    const incoming = sanitizeArchiveRecord(incomingRecord?.text || baseRecord?.text, incomingRecord || {});
    if (!base && !incoming) return null;
    if (!base) return incoming;
    if (!incoming) return base;

    const chooseEarlier = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
    };
    const chooseLater = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
    };

    return {
        text: incoming.text || base.text,
        firstSeenAt: chooseEarlier(base.firstSeenAt, incoming.firstSeenAt),
        lastSeenAt: chooseLater(base.lastSeenAt, incoming.lastSeenAt),
        firstSeenDate: chooseEarlier(base.firstSeenDate, incoming.firstSeenDate),
        lastSeenDate: chooseLater(base.lastSeenDate, incoming.lastSeenDate),
        appearances: Math.max(base.appearances || 0, incoming.appearances || 0),
        bestRank: Math.min(base.bestRank || Number.MAX_SAFE_INTEGER, incoming.bestRank || Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER
            ? null
            : Math.min(base.bestRank || Number.MAX_SAFE_INTEGER, incoming.bestRank || Number.MAX_SAFE_INTEGER),
        latestRank: incoming.latestRank || base.latestRank || null,
        firstSnapshotId: base.firstSnapshotId || incoming.firstSnapshotId || null,
        lastSnapshotId: incoming.lastSnapshotId || base.lastSnapshotId || null,
        lastSource: incoming.lastSource || base.lastSource || null,
        lastQuality: incoming.lastQuality || base.lastQuality || null,
        stages: {
            trend: incoming.stages?.trend || base.stages?.trend || null,
            tmhunt: incoming.stages?.tmhunt || base.stages?.tmhunt || null,
            uspto: incoming.stages?.uspto || base.stages?.uspto || null,
            analysis: incoming.stages?.analysis || base.stages?.analysis || null,
            note: incoming.stages?.note || base.stages?.note || null
        }
    };
}

function mergeNicheArchives(...sources) {
    const merged = createEmptyNicheArchive();
    sources.forEach((source) => {
        const clean = sanitizeNicheArchive(source);
        merged.snapshotCount = Math.max(merged.snapshotCount, clean.snapshotCount || 0);
        merged.lastSnapshotId = clean.lastSnapshotId || merged.lastSnapshotId;
        merged.updatedAt = clean.updatedAt || merged.updatedAt;

        Object.entries(clean.niches).forEach(([key, record]) => {
            merged.niches[key] = mergeNicheArchiveRecords(merged.niches[key], record);
        });
    });
    merged.updatedAt = new Date().toISOString();
    return sanitizeNicheArchive(merged);
}

function applyTrendSnapshotToArchive(archive, rawSnapshot) {
    const cleanArchive = sanitizeNicheArchive(archive);
    const snapshot = sanitizeTrendSnapshot(rawSnapshot);

    snapshot.trends.forEach((entry) => {
        const key = normalizeNicheKey(entry.text);
        if (!key) return;
        const current = cleanArchive.niches[key] || sanitizeArchiveRecord(key, { text: entry.text, appearances: 0, stages: {} });
        const next = sanitizeArchiveRecord(key, {
            ...current,
            text: entry.text,
            firstSeenAt: current?.firstSeenAt || snapshot.fetchedAt,
            lastSeenAt: snapshot.fetchedAt,
            firstSeenDate: current?.firstSeenDate || snapshot.dateKey,
            lastSeenDate: snapshot.dateKey,
            appearances: (current?.appearances || 0) + 1,
            bestRank: current?.bestRank ? Math.min(current.bestRank, entry.rank) : entry.rank,
            latestRank: entry.rank,
            firstSnapshotId: current?.firstSnapshotId || snapshot.snapshotId,
            lastSnapshotId: snapshot.snapshotId,
            lastSource: snapshot.source,
            stages: {
                ...(current?.stages || {}),
                trend: 'captured'
            }
        });
        cleanArchive.niches[key] = next;
    });

    cleanArchive.snapshotCount = Math.max(cleanArchive.snapshotCount, (cleanArchive.snapshotCount || 0) + 1);
    cleanArchive.lastSnapshotId = snapshot.snapshotId;
    cleanArchive.updatedAt = new Date().toISOString();
    return { archive: sanitizeNicheArchive(cleanArchive), snapshot };
}

function applyStageUpdatesToArchive(archive, items = [], stage = 'note') {
    const cleanArchive = sanitizeNicheArchive(archive);
    const allowedStageValues = {
        tmhunt: ['safe', 'restricted'],
        uspto: ['safe', 'banned'],
        analysis: ['excel', 'med', 'sat', 'emp'],
        note: ['queued', 'done', 'manual', 'removed']
    };

    items.forEach((item) => {
        const text = String(item?.text || item?.niche || '').trim();
        const key = normalizeNicheKey(text);
        if (!key) return;
        const status = String(item?.status || '').trim().toLowerCase();
        if (!allowedStageValues[stage]?.includes(status)) return;

        const current = cleanArchive.niches[key] || sanitizeArchiveRecord(key, { text, appearances: 0, stages: {} });
        const nowIso = typeof item?.at === 'string' ? item.at : new Date().toISOString();
        cleanArchive.niches[key] = sanitizeArchiveRecord(key, {
            ...current,
            text,
            lastSeenAt: current?.lastSeenAt || nowIso,
            lastQuality: typeof item?.quality === 'string' ? item.quality : current?.lastQuality || null,
            stages: {
                ...(current?.stages || {}),
                [stage]: status
            }
        });
    });

    cleanArchive.updatedAt = new Date().toISOString();
    return sanitizeNicheArchive(cleanArchive);
}

async function importPersistentNicheArchive(force = false) {
    if (persistentNicheArchiveLoaded && !force) {
        const existing = await getStorage([NHP_ARCHIVE_STORAGE_KEY, NHP_ARCHIVE_SETTINGS_KEY, NHP_TMH_HISTORY_KEY]);
        return {
            archive: sanitizeNicheArchive(existing[NHP_ARCHIVE_STORAGE_KEY] || {}),
            settings: sanitizeTrendArchiveSettings(existing[NHP_ARCHIVE_SETTINGS_KEY] || {}),
            tmhHistory: sanitizeTmhHistory(existing[NHP_TMH_HISTORY_KEY] || {})
        };
    }

    if (persistentNicheArchiveLoadPromise && !force) return persistentNicheArchiveLoadPromise;

    persistentNicheArchiveLoadPromise = (async () => {
        const storageData = await getStorage([NHP_ARCHIVE_STORAGE_KEY, NHP_ARCHIVE_SETTINGS_KEY, NHP_TMH_HISTORY_KEY]);
        let archive = sanitizeNicheArchive(storageData[NHP_ARCHIVE_STORAGE_KEY] || {});
        const settings = sanitizeTrendArchiveSettings(storageData[NHP_ARCHIVE_SETTINGS_KEY] || {});
        const tmhHistory = sanitizeTmhHistory(storageData[NHP_TMH_HISTORY_KEY] || {});

        try {
            const ready = await ensureGhostServerReady();
            if (ready) {
                const remoteData = await fetchJsonWithTimeout(`${getGhostServerUrl()}/niche-archive`, {}, 5000);
                archive = mergeNicheArchives(remoteData.index || {}, archive);
            }
        } catch (error) {
            console.warn('[Niche Archive] import skipped:', error.message);
        }

        await setStorage({
            [NHP_ARCHIVE_STORAGE_KEY]: archive,
            [NHP_ARCHIVE_SETTINGS_KEY]: settings,
            [NHP_TMH_HISTORY_KEY]: tmhHistory
        });

        persistentNicheArchiveLoaded = true;
        return { archive, settings, tmhHistory };
    })();

    try {
        return await persistentNicheArchiveLoadPromise;
    } finally {
        persistentNicheArchiveLoadPromise = null;
    }
}

async function persistNicheArchive(reason = 'sync', options = {}) {
    const storageData = await getStorage([NHP_ARCHIVE_STORAGE_KEY]);
    const archive = sanitizeNicheArchive(storageData[NHP_ARCHIVE_STORAGE_KEY] || {});
    await setStorage({ [NHP_ARCHIVE_STORAGE_KEY]: archive });

    try {
        const ready = await ensureGhostServerReady();
        if (!ready) return { archive };

        const response = await fetch(`${getGhostServerUrl()}/niche-archive/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                index: archive,
                snapshot: options.snapshot || null,
                reason
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const savedArchive = mergeNicheArchives(payload.index || archive);
        await setStorage({ [NHP_ARCHIVE_STORAGE_KEY]: savedArchive });
        return { archive: savedArchive, payload };
    } catch (error) {
        console.warn('[Niche Archive] persist skipped:', error.message);
        return { archive };
    }
}

async function recordTrendSnapshot(trends = [], source = 'manual_fetch') {
    const archiveState = await importPersistentNicheArchive();
    const { archive, snapshot } = applyTrendSnapshotToArchive(archiveState.archive, {
        trends,
        source,
        fetchedAt: new Date().toISOString()
    });

    await setStorage({ [NHP_ARCHIVE_STORAGE_KEY]: archive });
    await persistNicheArchive('trend_snapshot', { snapshot });
    return archive;
}

async function recordArchiveStage(items = [], stage = 'note', reason = 'stage_update') {
    const archiveState = await importPersistentNicheArchive();
    const archive = applyStageUpdatesToArchive(archiveState.archive, items, stage);
    await setStorage({ [NHP_ARCHIVE_STORAGE_KEY]: archive });
    await persistNicheArchive(reason);
    return archive;
}

async function exportNicheArchiveBundle() {
    const archiveState = await importPersistentNicheArchive(true);
    const storageData = await getStorage([
        NHP_ARCHIVE_STORAGE_KEY,
        NHP_ARCHIVE_SETTINGS_KEY,
        NHP_TMH_HISTORY_KEY,
        'teepublic_manager_data',
        'usptoHistory',
        'tpHistory'
    ]);

    let bundle = {
        version: 1,
        exportedAt: new Date().toISOString(),
        archive: sanitizeNicheArchive(storageData[NHP_ARCHIVE_STORAGE_KEY] || archiveState.archive || {}),
        settings: sanitizeTrendArchiveSettings(storageData[NHP_ARCHIVE_SETTINGS_KEY] || archiveState.settings || {}),
        tmhHistory: sanitizeTmhHistory(storageData[NHP_TMH_HISTORY_KEY] || archiveState.tmhHistory || {}),
        noteData: storageData.teepublic_manager_data || { niches: [], doneHistory: [], history: [] },
        usptoHistory: sanitizeHistoryMap(storageData.usptoHistory || {}, ['safe', 'banned']),
        tpHistory: sanitizeHistoryMap(storageData.tpHistory || {}, ['excel', 'med', 'sat', 'emp']),
        snapshots: []
    };

    try {
        const ready = await ensureGhostServerReady();
        if (ready) {
            const remoteBundle = await fetchJsonWithTimeout(`${getGhostServerUrl()}/niche-archive/export`, {}, 10000);
            bundle.archive = mergeNicheArchives(remoteBundle.bundle?.archive || {}, bundle.archive);
            bundle.snapshots = Array.isArray(remoteBundle.bundle?.snapshots) ? remoteBundle.bundle.snapshots : [];
        }
    } catch (error) {
        console.warn('[Niche Archive] export bundle fallback:', error.message);
    }

    return bundle;
}

async function importNicheArchiveBundle(bundle, mode = 'merge') {
    const cleanMode = mode === 'replace' ? 'replace' : 'merge';
    const importedArchive = sanitizeNicheArchive(bundle?.archive || {});
    const importedSettings = sanitizeTrendArchiveSettings(bundle?.settings || {});
    const importedTmhHistory = sanitizeTmhHistory(bundle?.tmhHistory || {});
    const importedNoteData = bundle?.noteData || null;
    const importedUsptoHistory = sanitizeHistoryMap(bundle?.usptoHistory || {}, ['safe', 'banned']);
    const importedTpHistory = sanitizeHistoryMap(bundle?.tpHistory || {}, ['excel', 'med', 'sat', 'emp']);

    const current = await importPersistentNicheArchive();
    const currentStageData = await getStorage(['usptoHistory', 'tpHistory']);
    const finalArchive = cleanMode === 'replace'
        ? importedArchive
        : mergeNicheArchives(current.archive, importedArchive);
    const finalSettings = cleanMode === 'replace'
        ? importedSettings
        : sanitizeTrendArchiveSettings({ ...current.settings, ...importedSettings });
    const finalTmhHistory = cleanMode === 'replace'
        ? importedTmhHistory
        : { ...current.tmhHistory, ...importedTmhHistory };

    const storagePatch = {
        [NHP_ARCHIVE_STORAGE_KEY]: finalArchive,
        [NHP_ARCHIVE_SETTINGS_KEY]: finalSettings,
        [NHP_TMH_HISTORY_KEY]: finalTmhHistory
    };

    if (importedNoteData && typeof importedNoteData === 'object') {
        storagePatch.teepublic_manager_data = importedNoteData;
    }
    if (Object.keys(importedUsptoHistory).length > 0 || cleanMode === 'replace') {
        storagePatch.usptoHistory = cleanMode === 'replace'
            ? importedUsptoHistory
            : { ...(currentStageData.usptoHistory || {}), ...importedUsptoHistory };
    }
    if (Object.keys(importedTpHistory).length > 0 || cleanMode === 'replace') {
        storagePatch.tpHistory = cleanMode === 'replace'
            ? importedTpHistory
            : { ...(currentStageData.tpHistory || {}), ...importedTpHistory };
    }

    await setStorage(storagePatch);
    await ensureTrendCaptureAlarm();

    try {
        const ready = await ensureGhostServerReady();
        if (ready) {
            const response = await fetch(`${getGhostServerUrl()}/niche-archive/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bundle, mode: cleanMode })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const mergedArchive = mergeNicheArchives(finalArchive, payload.index || {});
            await setStorage({ [NHP_ARCHIVE_STORAGE_KEY]: mergedArchive });
            return mergedArchive;
        }
    } catch (error) {
        console.warn('[Niche Archive] import bundle server sync skipped:', error.message);
    }

    await persistNicheArchive('import_bundle');
    return finalArchive;
}

async function isCreatySearchToolsSyncReplacingOldTrends() {
    if (typeof self.isEmailCoreSearchToolsSyncActive === 'function') {
        try {
            return !!(await self.isEmailCoreSearchToolsSyncActive());
        } catch (error) {
            console.warn('[Niche Archive] CREATY sync gate check failed:', error?.message || error);
        }
    }
    // Fallback if emailcore-handlers did not load: local toggle only (default on).
    try {
        const stored = await getStorage(['nhpEmailCoreSearchToolsSyncEnabled', 'nhpEmailCoreSearchToolsSyncMeta']);
        if (stored.nhpEmailCoreSearchToolsSyncEnabled === false) return false;
        const meta = (stored.nhpEmailCoreSearchToolsSyncMeta && typeof stored.nhpEmailCoreSearchToolsSyncMeta === 'object')
            ? stored.nhpEmailCoreSearchToolsSyncMeta
            : {};
        if (meta.siteEnabled === false) return false;
        if (meta.trendsSkip === 'site_disabled' || meta.feedsSkip === 'site_disabled') return false;
        return true;
    } catch (_) {
        return true;
    }
}

async function ensureTrendCaptureAlarm() {
    const settingsData = await getStorage([NHP_ARCHIVE_SETTINGS_KEY]);
    const settings = sanitizeTrendArchiveSettings(settingsData[NHP_ARCHIVE_SETTINGS_KEY] || {});
    await chrome.alarms.clear(NHP_TREND_CAPTURE_ALARM);

    // CREATY Search Tools sync replaces the old TeePublic/Oracle periodic scrape.
    if (await isCreatySearchToolsSyncReplacingOldTrends()) {
        console.log('[Niche Archive] old trend-capture alarm cleared ÔÇö EmailCore CREATY sync is active');
        return settings;
    }
    if (!settings.enabled) return settings;

    chrome.alarms.create(NHP_TREND_CAPTURE_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: settings.intervalMinutes
    });
    return settings;
}

async function captureTrendSnapshotInBackground(source = 'alarm') {
    if (await isCreatySearchToolsSyncReplacingOldTrends()) {
        console.log('[Niche Archive] skipping old alarm trend fetch ÔÇö EmailCore CREATY sync is active');
        return null;
    }
    let titles = [];
    try {
        titles = await fetchOfficialTrendTitlesBounded(3);
    } catch (error) {
        console.warn('[Niche Archive] alarm trend fetch failed:', error.message);
        return null;
    }
    if (!titles.length) return null;

    const archive = await recordTrendSnapshot(titles, source);
    const settingsData = await getStorage([NHP_ARCHIVE_SETTINGS_KEY]);
    const settings = sanitizeTrendArchiveSettings(settingsData[NHP_ARCHIVE_SETTINGS_KEY] || {});
    settings.lastAutoCaptureAt = new Date().toISOString();
    await setStorage({ [NHP_ARCHIVE_SETTINGS_KEY]: settings });
    return archive;
}

// --- INITIALIZATION ---
//  INITIALIZATION

chrome.runtime.onInstalled.addListener(async () => {
    try {
        await nhpResetTransientRuntimeState('installed');
        console.log('[NHP] Niche Hunter Pro Installed');
        // MerchGhost Storage Init
        const result = await chrome.storage.local.get(['localSalesData', 'localWorksData', 'artistMetrics', 'accountTier']);
        if (!result.localSalesData) await chrome.storage.local.set({ localSalesData: [] });
        if (!result.localWorksData) await chrome.storage.local.set({ localWorksData: [] });
        if (!result.artistMetrics) await chrome.storage.local.set({ artistMetrics: { followers: 0, favorites: 0 } });
        if (!result.accountTier) await chrome.storage.local.set({ accountTier: 'Unknown' });
        console.log('[NHP] MerchGhost Storage Initialized');
        primePersistentNicheMemory();
        importPersistentNicheArchive().catch((error) => console.warn('[Niche Archive] prime failed:', error.message));
        ensureTrendCaptureAlarm().catch((error) => console.warn('[Niche Archive] alarm setup failed:', error.message));
        ensureContextMenus();
        primePersistentNicheMemory();
        void ensureCliProxyLocalServerReady().catch((error) => {
            console.warn('[CLIProxy Local] install auto-start skipped:', error?.message || error);
        });
    } catch (error) {
        console.warn('[NHP] onInstalled recovered:', nhpSafeErrorMessage(error));
    }
});

chrome.runtime.onStartup.addListener(() => {
    void (async () => {
        try {
            await nhpResetTransientRuntimeState('startup');
            await primeUsptoQueueRecovery();
            primePersistentNicheMemory();
            importPersistentNicheArchive().catch((error) => console.warn('[Niche Archive] startup prime failed:', error.message));
            ensureTrendCaptureAlarm().catch((error) => console.warn('[Niche Archive] startup alarm failed:', error.message));
            void ensureAiImageNudgeAlarm();
            if (typeof CreatyAiSupervisorBridge !== 'undefined') {
                CreatyAiSupervisorBridge.startSupervisorPoll();
            }
            void ensureCliProxyLocalServerReady().catch((error) => {
                console.warn('[CLIProxy Local] auto-start skipped:', error?.message || error);
            });
        } catch (error) {
            console.warn('[NHP] onStartup recovered:', nhpSafeErrorMessage(error));
        }
    })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name === NHP_AI_IMAGE_NUDGE_ALARM) {
        void (async () => {
            await loadPendingAiImageTasks();
            if (resetStuckAiImageTasksInQueue()) {
                await savePendingAiImageTasks();
            }
            await nudgeAllPreparedAiImageTasks();
        })();
        return;
    }
    if (alarm?.name !== NHP_TREND_CAPTURE_ALARM) return;
    captureTrendSnapshotInBackground('alarm').catch((error) => {
        console.warn('[Niche Archive] alarm capture failed:', error.message);
    });
});

// When CREATY Search Tools sync toggles (local Admin or site meta), reconfigure old trend-capture alarm.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes.nhpEmailCoreSearchToolsSyncEnabled && !changes.nhpEmailCoreSearchToolsSyncMeta) return;
    ensureTrendCaptureAlarm().catch((error) => {
        console.warn('[Niche Archive] alarm reconfigure after CREATY sync change failed:', error?.message || error);
    });
});

chrome.runtime.onInstalled.addListener(async () => {
    try {
        const current = await chrome.storage.local.get(SCREEN_SETTINGS_KEY);
        if (!current[SCREEN_SETTINGS_KEY]) {
            await chrome.storage.local.set({ [SCREEN_SETTINGS_KEY]: SCREEN_DEFAULT_SETTINGS });
        }
        ensureContextMenus();
        void ensureAiImageNudgeAlarm();
        if (typeof CreatyAiSupervisorBridge !== 'undefined') {
            CreatyAiSupervisorBridge.startSupervisorPoll();
        }
    } catch (error) {
        console.warn('[NHP] screen onInstalled recovered:', nhpSafeErrorMessage(error));
    }
});

chrome.runtime.onStartup.addListener(() => {
    try {
        ensureContextMenus();
        primePersistentNicheMemory();
    } catch (error) {
        console.warn('[NHP] secondary onStartup recovered:', nhpSafeErrorMessage(error));
    }
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
    (async () => {
        try {
            if (
                [
                    NHP_SEND_IMAGE_TO_GEMINI_MENU_ID,
                    NHP_SEND_IMAGE_FULL_GEMINI_ID,
                    NHP_SEND_IMAGE_FULL_GPT_ID
                ].includes(info.menuItemId)
            ) {
                if (info.menuItemId === NHP_SEND_IMAGE_TO_GEMINI_MENU_ID || info.menuItemId === NHP_SEND_IMAGE_FULL_GEMINI_ID) {
                    await handleContextMenuGeminiImageSend(info, tab, { targetUrl: GEMINI_IMAGE_GEM_URL, cropMode: false });
                    return;
                }
                if (info.menuItemId === NHP_SEND_IMAGE_FULL_GPT_ID) {
                    await handleContextMenuGeminiImageSend(info, tab, { targetUrl: CHATGPT_IMAGE_GPT_URL, cropMode: false });
                    return;
                }
                return;
            }

            if (info.menuItemId === NHP_LAUNCH_SCREEN_RECORDER_MENU_ID) {
                await launchAdminScreenRecorderWindow();
                return;
            }

            if (info.menuItemId === NHP_PROMPT_BAG_SAVE_SELECTION_ID) {
                await saveSelectionToPromptBag(info.selectionText || '');
                return;
            }

            if (info.menuItemId === NHP_PROMPT_BAG_PASTE_LAST_PROMPT_ID) {
                if (Number.isFinite(tab?.id)) setPromptBagLastTargetTabId(tab.id);
                await pasteLastPromptFromBag(tab);
                return;
            }

            if (info.menuItemId === NHP_PROMPT_BAG_SAVE_IMAGE_ID) {
                await saveImageToPromptBagFromContext(info, tab);
                return;
            }

            if (info.menuItemId === NHP_PROMPT_BAG_SEND_LAST_GEMINI_ID) {
                await sendLastPromptBagImage(GEMINI_IMAGE_GEM_URL);
                return;
            }

            if (info.menuItemId === NHP_PROMPT_BAG_SEND_LAST_GPT_ID) {
                await sendLastPromptBagImage(CHATGPT_IMAGE_GPT_URL);
                return;
            }

            if (info.menuItemId === NHP_PROMPT_BAG_MANAGE_ID) {
                await openPromptBagManager(tab);
            }
        } catch (error) {
            console.error('[Background] Context menu action failed:', error);
        }
    })();
});

primePersistentNicheMemory();

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        await screenRememberUsableTab(tab);
    } catch (error) {
        console.warn('[Background][Screen Toolkit] unable to remember activated tab', error);
    }
});

async function nudgePendingAiImageTasksForTab(tabId, tab) {
    try {
        const url = String(tab?.url || '');
        if (!/chatgpt\.com|gemini\.google\.com/i.test(url)) return;
        await loadPendingAiImageTasks();
        if (resetStuckAiImageTasksInQueue()) {
            await savePendingAiImageTasks();
        }
        const windowId = tab?.windowId;
        const provider = getAiImageProviderKey(url);
        const matches = pendingAiImageTasks.filter((task) => {
            if (!isActiveAiImageTaskForProvider(task, provider)) return false;
            const stage = String(task.stage || 'prepared');
            if (!['prepared', 'retargeted', 'injecting', 'claimed'].includes(stage)) return false;
            if (Number.isFinite(task.targetTabId) && task.targetTabId === tabId) return true;
            return Number.isFinite(task.targetWindowId)
                && Number.isFinite(windowId)
                && task.targetWindowId === windowId;
        });
        for (const task of matches) {
            await nudgeAiImageTaskTarget(task.id);
        }
    } catch (_) {
    }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        try {
            await screenRememberUsableTab(tab);
        } catch (error) {
            console.warn('[Background][Screen Toolkit] unable to remember updated tab', error);
        }
    }
    if (changeInfo.status === 'complete' && tab) {
        void nudgePendingAiImageTasksForTab(tabId, tab);
    }
    if (tab && (changeInfo.status === 'complete' || changeInfo.url)) {
        if (typeof handleCanvaEditorTabUpdated === 'function') {
            void handleCanvaEditorTabUpdated(tabId, changeInfo, tab);
        }
    }
});

chrome.commands.onCommand.addListener(async (command) => {
    try {
        if (command === 'capture-visible') {
            await screenHandleCaptureVisible();
        } else if (command === 'capture-selected') {
            await screenHandleCaptureSelected();
        } else if (command === 'capture-full-page') {
            await screenHandleCaptureFullPage();
        }
    } catch (error) {
        console.error('[Background][Screen Toolkit] command failed:', error);
    }
});

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

function extractGoogleImgUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const imgUrl = parsed.searchParams.get('imgurl');
        return imgUrl ? decodeURIComponent(imgUrl) : rawUrl;
    } catch (_) {
        return rawUrl;
    }
}

function normalizeImageCandidateUrl(rawUrl, pageUrl) {
    if (typeof rawUrl !== 'string') return null;
    let value = rawUrl.trim();
    if (!value) return null;

    if (/^https?:\/\/(?:www\.)?google\.[^/]+\/imgres/i.test(value) || value.includes('imgurl=')) {
        value = extractGoogleImgUrl(value);
    }

    if (value.startsWith('//')) {
        return `https:${value}`;
    }

    if (value.startsWith('data:image/')) {
        return value;
    }

    if (value.startsWith('blob:')) {
        return value;
    }

    try {
        return new URL(value, pageUrl || 'https://www.google.com/').href;
    } catch (_) {
        return null;
    }
}

function resolveImageFetchReferrer(imageUrl, pageUrl) {
    const lower = String(imageUrl || '').toLowerCase();
    const page = String(pageUrl || '').trim();
    if (lower.includes('teepublic.com') || lower.includes('teepublic')) {
        return page.includes('teepublic.com') ? page : 'https://www.teepublic.com/';
    }
    if (lower.includes('pinimg.com') || lower.includes('pinterest.com')) {
        return page.includes('pinterest.com') ? page : 'https://www.pinterest.com/';
    }
    if (lower.includes('googleusercontent.com') || lower.includes('gstatic.com') || lower.includes('encrypted-tbn')) {
        return (page && /google\.com/i.test(page)) ? page : 'https://www.google.com/';
    }
    return page || undefined;
}

/** Detect raster type from magic bytes when CDN Content-Type is wrong/empty (webp/jpeg/png). */
function sniffImageMimeFromBytes(bytes) {
    if (!bytes || bytes.length < 12) return '';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    // RIFF....WEBP
    if (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
        return 'image/webp';
    }
    // ftyp....avif / heic
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
        if (brand.includes('avif') || brand === 'avis') return 'image/avif';
        if (brand.includes('heic') || brand.includes('heif') || brand === 'mif1') return 'image/heic';
    }
    return '';
}

function isAcceptableFetchedImageBlob(blob, sniffMime = '') {
    if (!blob || !(blob.size > 32)) return false;
    const type = String(blob.type || sniffMime || '').toLowerCase().trim();
    if (type.startsWith('image/')) return true;
    // Some CDNs (TeePublic) return octet-stream / empty type for valid webp/jpeg.
    if (!type || type === 'application/octet-stream' || type === 'binary/octet-stream') {
        return !!sniffMime;
    }
    return false;
}

/**
 * TeePublic CDN variants: webpÔåöjpg/png, i_pÔåöi_m/i_l, and larger s_ preview when present.
 */
function expandTeepublicImageUrlCandidates(rawUrl) {
    const seed = String(rawUrl || '').trim();
    if (!seed || !/images\.teepublic\.com\/derived/i.test(seed)) return seed ? [seed] : [];

    const out = [];
    const seen = new Set();
    const push = (value) => {
        const url = String(value || '').trim();
        if (!url || seen.has(url)) return;
        seen.add(url);
        out.push(url);
    };

    push(seed);
    push(upgradeTeepublicPreviewSizeInUrl(seed));

    const withSize = out.slice();
    for (const url of withSize) {
        push(url.replace(/,i_p:/gi, ',i_m:'));
        push(url.replace(/,i_p:/gi, ',i_l:'));
        push(url.replace(/,i_m:/gi, ',i_p:'));
        push(url.replace(/,i_l:/gi, ',i_p:'));
    }

    const withVariant = out.slice();
    for (const url of withVariant) {
        if (/\.webp(?:\?|$)/i.test(url)) {
            push(url.replace(/\.webp(?=\?|$)/i, '.jpg'));
            push(url.replace(/\.webp(?=\?|$)/i, '.jpeg'));
            push(url.replace(/\.webp(?=\?|$)/i, '.png'));
        } else if (/\.jpe?g(?:\?|$)/i.test(url)) {
            push(url.replace(/\.jpe?g(?=\?|$)/i, '.webp'));
            push(url.replace(/\.jpe?g(?=\?|$)/i, '.png'));
        } else if (/\.png(?:\?|$)/i.test(url)) {
            push(url.replace(/\.png(?=\?|$)/i, '.jpg'));
            push(url.replace(/\.png(?=\?|$)/i, '.webp'));
        }
    }

    return out.slice(0, 12);
}

const _teepublicDesignPageImageCache = new Map();

async function scrapeTeepublicDesignPageImageUrl(designId, referer) {
    const id = String(designId || '').trim();
    if (!/^\d{4,}$/.test(id)) return '';
    if (_teepublicDesignPageImageCache.has(id)) {
        return _teepublicDesignPageImageCache.get(id) || '';
    }
    // Negative-cache empties briefly so hunt storms don't hammer design pages.
    const cacheMiss = (value) => {
        _teepublicDesignPageImageCache.set(id, value || '');
        if (_teepublicDesignPageImageCache.size > 200) {
            const oldest = _teepublicDesignPageImageCache.keys().next().value;
            _teepublicDesignPageImageCache.delete(oldest);
        }
        return value || '';
    };
    const pageUrls = [
        `https://www.teepublic.com/t-shirt/${id}`,
        `https://www.teepublic.com/design/${id}`
    ];
    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'User-Agent': RADAR_FETCH_HTML_HEADERS['User-Agent'],
        'Cache-Control': 'no-cache'
    };
    const safeReferer = String(referer || 'https://www.teepublic.com/').trim();
    if (/^https?:\/\//i.test(safeReferer)) headers.Referer = safeReferer;

    for (const pageUrl of pageUrls) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let html = '';
            try {
                const res = await fetch(pageUrl, { headers, signal: controller.signal, cache: 'no-store' });
                if (!res.ok) continue;
                html = await res.text();
            } finally {
                clearTimeout(timeout);
            }
            if (!html || /just a moment|cf_chl_opt|challenge-platform/i.test(html)) continue;
            const TP = getTeepublicExtractApi();
            if (TP?.extractTeepublicDesignsFromListingHtml) {
                const designs = TP.extractTeepublicDesignsFromListingHtml(html, { maxDesigns: 6 });
                const hit = designs.find((d) => d?.img && (!TP.isUsableTeepublicDesignImageUrl || TP.isUsableTeepublicDesignImageUrl(d.img)));
                if (hit?.img) return cacheMiss(hit.img);
            }
            if (TP?.normalizeTeepublicDesignImageUrl) {
                const match = html.match(/https?:\/\/images\.teepublic\.com\/derived\/production\/designs\/\d+(?:_\d+)?\/[^"'<>\s]+\.(?:webp|jpe?g|png)/i);
                if (match?.[0]) {
                    const normalized = TP.normalizeTeepublicDesignImageUrl(match[0]);
                    if (normalized) return cacheMiss(normalized);
                }
            }
            const match = html.match(/https?:\/\/images\.teepublic\.com\/derived\/production\/designs\/\d+(?:_\d+)?\/[^"'<>\s]+\.(?:webp|jpe?g|png)/i);
            if (match?.[0]) return cacheMiss(match[0]);
        } catch (_) { /* try next */ }
    }
    return cacheMiss('');
}

async function fetchSingleImageAsDataUrl(url, referer) {
    if (url.startsWith('data:image/')) {
        return {
            dataUrl: url,
            sourceUrl: url,
            mimeType: (url.match(/^data:(image\/[^;]+);/i) || [])[1] || 'image/png'
        };
    }

    if (url.startsWith('blob:')) {
        throw new Error('Blob URLs cannot be fetched from the background worker.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    const fetchOpts = {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'User-Agent': RADAR_FETCH_HTML_HEADERS['User-Agent']
        }
    };
    const safeReferer = String(referer || '').trim();
    if (safeReferer && /^https?:\/\//i.test(safeReferer)) {
        fetchOpts.referrer = safeReferer;
        fetchOpts.headers.Referer = safeReferer;
    }
    try {
        response = await fetch(url, fetchOpts);
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Image request timed out.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        throw new Error(`Image request failed with status ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sniffMime = sniffImageMimeFromBytes(bytes);
    const headerType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    let blobType = sniffMime || (headerType.startsWith('image/') ? headerType : '') || 'application/octet-stream';
    // Reject obvious HTML/CF challenge bodies even if labeled oddly.
    if (!sniffMime && (headerType.includes('text/html') || headerType.includes('application/json'))) {
        throw new Error('Fetched resource is not a valid image.');
    }
    const blob = new Blob([buffer], { type: blobType });
    if (!isAcceptableFetchedImageBlob(blob, sniffMime)) {
        throw new Error('Fetched resource is not a valid image.');
    }
    // Prefer sniffed mime so webp/jpeg survive empty CDN content-types.
    const typedBlob = sniffMime && blob.type !== sniffMime
        ? new Blob([buffer], { type: sniffMime })
        : blob;
    const optimizedBlob = await optimizeFetchedImageBlobForLowSpec(typedBlob);

    return {
        dataUrl: await screenBlobToDataUrl(optimizedBlob),
        sourceUrl: url,
        mimeType: optimizedBlob.type || typedBlob.type || sniffMime || 'image/png'
    };
}

async function optimizeFetchedImageBlobForLowSpec(blob) {
    try {
        if (!blob || !blob.type || !blob.type.startsWith('image/')) {
            return blob;
        }
        const lowSpecMode = await isLowSpecModeEnabled();
        if (!lowSpecMode) {
            return blob;
        }
        // Keep already-small images untouched to avoid extra CPU on weak devices.
        if (blob.size <= 900_000) {
            return blob;
        }
        const bitmap = await createImageBitmap(blob);
        const longestSide = Math.max(bitmap.width, bitmap.height);
        const maxSide = blob.size > 2_500_000 ? 768 : 1024;
        const scale = Math.min(1, maxSide / Math.max(1, longestSide));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);

        const options = blob.size > 2_500_000
            ? [
                { type: 'image/webp', quality: 0.68 },
                { type: 'image/jpeg', quality: 0.62 },
                { type: 'image/jpeg', quality: 0.52 }
            ]
            : [
                { type: 'image/webp', quality: 0.74 },
                { type: 'image/jpeg', quality: 0.70 }
            ];
        let best = blob;
        for (const option of options) {
            try {
                const candidate = await canvas.convertToBlob(option);
                if (candidate && candidate.size > 0 && candidate.size < best.size) {
                    best = candidate;
                }
            } catch (_) {
            }
        }
        return best;
    } catch (_) {
        return blob;
    }
}

async function fetchImageAsDataUrlFromCandidates(urls = [], pageUrl) {
    const normalized = [];
    const seen = new Set();

    const pushCandidate = (raw) => {
        const candidate = normalizeImageCandidateUrl(raw, pageUrl) || String(raw || '').trim();
        if (!candidate || seen.has(candidate)) return;
        seen.add(candidate);
        normalized.push(candidate);
        if (/images\.teepublic\.com\/derived/i.test(candidate)) {
            for (const variant of expandTeepublicImageUrlCandidates(candidate)) {
                if (seen.has(variant)) continue;
                seen.add(variant);
                normalized.push(variant);
            }
        }
    };

    for (const rawUrl of urls) {
        pushCandidate(rawUrl);
    }

    if (!normalized.length) {
        throw new Error('No valid image URL was found.');
    }

    const tryCandidates = async (list) => {
        let lastError = null;
        let failCount = 0;
        for (const candidate of list) {
            try {
                const referer = resolveImageFetchReferrer(candidate, pageUrl);
                return await fetchSingleImageAsDataUrl(candidate, referer);
            } catch (error) {
                lastError = error;
                failCount += 1;
                // Avoid console storms during TeePublic hunt ÔÇö one debug sample only.
                if (failCount === 1) {
                    console.debug('[Background] Image candidate failed (further failures silenced):', candidate, error?.message || error);
                }
            }
        }
        return { __failed: true, lastError };
    };

    const firstPass = await tryCandidates(normalized);
    if (!firstPass?.__failed) return firstPass;

    // Last-resort: scrape design page only after CDN variants fail.
    const designIds = new Set();
    for (const candidate of normalized) {
        const id = extractTeepublicDesignIdFromUrl(candidate);
        if (id) designIds.add(id);
    }
    const beforeScrape = normalized.length;
    for (const designId of designIds) {
        try {
            const scraped = await scrapeTeepublicDesignPageImageUrl(designId, pageUrl || 'https://www.teepublic.com/');
            if (scraped) pushCandidate(scraped);
        } catch (_) { /* ignore scrape failures */ }
    }
    if (normalized.length > beforeScrape) {
        const secondPass = await tryCandidates(normalized.slice(beforeScrape));
        if (!secondPass?.__failed) return secondPass;
        throw secondPass.lastError || firstPass.lastError || new Error('Unable to fetch image from all candidates.');
    }

    throw firstPass.lastError || new Error('Unable to fetch image from all candidates.');
}

async function resolveRadarImageHuntItemDataUrl(item, tabId = null) {
    if (!item || typeof item !== 'object') return null;
    for (const field of ['dataUrl', 'thumbUrl', 'displayUrl']) {
        const inline = String(item[field] || '').trim();
        if (inline.startsWith('data:image/')) {
            return { dataUrl: inline, sourceUrl: String(item.url || '').trim() || inline };
        }
    }
    const candidates = [];
    const seen = new Set();
    for (const raw of [item.url, item.thumbUrl, item.displayUrl]) {
        const value = String(raw || '').trim();
        if (!value || value.startsWith('data:image/') || value.startsWith('blob:') || seen.has(value)) continue;
        seen.add(value);
        candidates.push(value);
    }
    if (Number.isFinite(tabId) && candidates.length) {
        try {
            const pageResult = await getImageDataUrlFromPage(tabId, candidates[0], candidates.slice(1));
            if (pageResult?.dataUrl?.startsWith('data:image/')) {
                return { dataUrl: pageResult.dataUrl, sourceUrl: candidates[0] };
            }
        } catch (_) { /* fall through to remote fetch */ }
    }
    if (!candidates.length) return null;
    try {
        const pageUrl = String(item.pageUrl || item.url || candidates[0]).trim();
        const fetched = await fetchImageAsDataUrlFromCandidates(candidates, pageUrl);
        if (!fetched?.dataUrl?.startsWith('data:image/')) return null;
        return { dataUrl: fetched.dataUrl, sourceUrl: fetched.sourceUrl || item.url || candidates[0] };
    } catch (_) {
        return null;
    }
}

/** CSP on extension pages blocks remote img src; hydrate grid thumbs as data URLs. */
async function hydrateRadarImageHuntThumbnails(images = []) {
    if (!Array.isArray(images) || !images.length) return images;
    const concurrency = 3;
    let cursor = 0;
    const worker = async () => {
        while (cursor < images.length) {
            const item = images[cursor++];
            if (!item || typeof item !== 'object') continue;
            const src = String(item.url || '').trim();
            const existing = String(item.thumbUrl || '').trim();
            if (!src) continue;
            if (src.startsWith('data:image/')) {
                if (!existing.startsWith('data:image/') && isValidGoogleRadarThumbItem({ thumbUrl: src, url: src })) {
                    item.thumbUrl = src;
                }
                continue;
            }
            if (existing.startsWith('data:image/')) continue;
            try {
                const fetchUrl = item.source === 'teepublic'
                    ? normalizeTeepublicProductImageUrl(src, item.pageUrl || src)
                    : item.source === 'pinterest'
                        ? (normalizePinterestPinimgUrl(src, item.pageUrl) || src)
                        : item.source === 'google_ai' || item.source === 'google_images'
                            ? (normalizeImageCandidateUrl(src, item.pageUrl) || src)
                            : src;
                if (!fetchUrl) continue;
                const fetched = await fetchImageAsDataUrlFromCandidates([fetchUrl], item.pageUrl || fetchUrl);
                if (isValidHydratedRadarThumbDataUrl(fetched?.dataUrl)) {
                    item.thumbUrl = fetched.dataUrl;
                }
            } catch (_) { /* dropped in pruneInvalidRadarImageHuntItems */ }
            await delay(40);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, () => worker()));
    return images;
}

function createGeminiDesignPrompt(nicheName) {
    return `Act as an expert Print-on-Demand (POD) market analyst and top-tier designer.
I am providing you with an ATTACHED reference design for the niche: "${nicheName}".

Task:
1. First, analyze the attached image and the niche to generate smart market insights (AI Insights) and identify design gaps.
2. Extract only the printable artwork/graphic from the reference. If it is a mockup, product photo, or model wearing apparel, do not redraw the shirt, model, mannequin, folds, watermark, or original background.
3. Present exactly four high-quality POD apparel graphics on a solid black background (#000000), then generate them.

Additional instructions:
- DO NOT start generating before analyzing the attached image.
- ÏºÏ¼Ï╣┘ä Ïú┘ê┘ä Ï¬ÏÁ┘à┘è┘à Ï¿┘å┘üÏ│ Ï│Ï¬Ïº┘è┘ä Ïº┘äÏÁ┘êÏ▒Ï® Ïº┘ä┘àÏ▒┘ü┘éÏ® ┘ê┘ä┘â┘å Ï¿ÏºÏ¡Ï¬Ï▒Ïº┘ü┘èÏ® ÏúÏ╣┘ä┘ë.
- ┘é┘à Ï¿Ï¬ÏÀÏ¿┘è┘é Ïº┘äÏ▒Ïñ┘ë Ïº┘äÏ░┘â┘èÏ® (AI Insights) Ïº┘äÏ¬┘è ÏºÏ│Ï¬┘åÏ¬Ï¼Ï¬┘çÏº ┘äÏºÏ¿Ï¬┘âÏºÏ▒ Ïú┘ü┘âÏºÏ▒ Ï¬Ï│Ï» Ïº┘äÏ½Ï║Ï▒ÏºÏ¬ Ïº┘äÏ¬Ï│┘ê┘è┘é┘èÏ® ┘êÏ¬Ï¬┘ü┘ê┘é Ï╣┘ä┘ë Ïº┘ä┘à┘åÏº┘üÏ│┘è┘å ┘ü┘è ┘çÏ░Ïº Ïº┘ä┘å┘èÏ┤.`;
}

async function resolveNicheNameForImageSend(nicheName, options = {}) {
    const pageHint = String(options.pageNicheHint || nicheName || '').trim();
    if (options.ignoreStoredNicheContext && pageHint) {
        return pageHint;
    }
    if (options.ignoreStoredNicheContext) {
        return 'attached reference design';
    }
    const stored = await chrome.storage.local.get(['nhp_current_niche_context', NHP_NICHE_CONTEXT_TS_KEY]);
    const storedNiche = String(stored?.nhp_current_niche_context || '').trim();
    const storedAt = Number(stored?.[NHP_NICHE_CONTEXT_TS_KEY] || 0);
    const storedFresh = storedNiche && storedAt && (Date.now() - storedAt) < NHP_NICHE_CONTEXT_MAX_AGE_MS;
    if (pageHint) return pageHint;
    if (storedFresh) return storedNiche;
    return String(nicheName || '').trim() || 'Trending Topic';
}

function createAiImagePromptForTarget(nicheName, targetUrl) {
    const url = String(targetUrl || '');
    if (url.includes('chatgpt.com') || url.includes('gemini.google.com')) {
        return typeof resolvePromptBagImagePrompt === 'function'
            ? resolvePromptBagImagePrompt(url, '')
            : (typeof PROMPT_BAG_ARTISAN_IMAGE_PROMPT === 'string'
                ? PROMPT_BAG_ARTISAN_IMAGE_PROMPT
                : (typeof PROMPT_BAG_CHATGPT_IMAGE_PROMPT === 'string' ? PROMPT_BAG_CHATGPT_IMAGE_PROMPT : ''));
    }
    return createGeminiDesignPrompt(nicheName);
}

function ensureContextMenus() {
    if (!chrome.contextMenus) return;

    [
        NHP_SEND_IMAGE_TO_GEMINI_MENU_ID,
        NHP_SEND_IMAGE_MENU_ROOT_ID,
        NHP_SEND_IMAGE_FULL_GEMINI_ID,
        NHP_SEND_IMAGE_FULL_GPT_ID,
        NHP_PROMPT_BAG_MENU_ROOT_ID,
        NHP_PROMPT_BAG_PROMPTS_ROOT_ID,
        NHP_PROMPT_BAG_IMAGES_ROOT_ID,
        NHP_PROMPT_BAG_SAVE_SELECTION_ID,
        NHP_PROMPT_BAG_PASTE_LAST_PROMPT_ID,
        NHP_PROMPT_BAG_MANAGE_ID,
        NHP_PROMPT_BAG_SAVE_IMAGE_ID,
        NHP_PROMPT_BAG_SEND_LAST_GEMINI_ID,
        NHP_PROMPT_BAG_SEND_LAST_GPT_ID
    ].forEach((id) => chrome.contextMenus.remove(id, () => chrome.runtime.lastError));

    chrome.contextMenus.create({
        id: NHP_SEND_IMAGE_MENU_ROOT_ID,
        title: 'ÏÑÏ▒Ï│Ïº┘ä Ïº┘äÏÁ┘êÏ▒Ï® ÏÑ┘ä┘ë AI',
        contexts: ['image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_SEND_IMAGE_FULL_GEMINI_ID,
        parentId: NHP_SEND_IMAGE_MENU_ROOT_ID,
        title: 'ÏÑÏ▒Ï│Ïº┘ä Ïº┘äÏÁ┘êÏ▒Ï® ┘âÏº┘à┘äÏ® ÏÑ┘ä┘ë Gemini',
        contexts: ['image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_SEND_IMAGE_FULL_GPT_ID,
        parentId: NHP_SEND_IMAGE_MENU_ROOT_ID,
        title: 'ÏÑÏ▒Ï│Ïº┘ä Ïº┘äÏÁ┘êÏ▒Ï® ┘âÏº┘à┘äÏ® ÏÑ┘ä┘ë GPT',
        contexts: ['image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_MENU_ROOT_ID,
        title: 'NHP Prompt Bag',
        contexts: ['page', 'frame', 'selection', 'editable', 'link', 'image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_PROMPTS_ROOT_ID,
        parentId: NHP_PROMPT_BAG_MENU_ROOT_ID,
        title: 'Prompts',
        contexts: ['page', 'frame', 'selection', 'editable']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_SAVE_SELECTION_ID,
        parentId: NHP_PROMPT_BAG_PROMPTS_ROOT_ID,
        title: 'Ï¡┘üÏ© Ïº┘ä┘åÏÁ Ïº┘ä┘àÏ¡Ï»Ï» ┘âÏ¿Ï▒┘ê┘àÏ¿Ï¬',
        contexts: ['selection']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_PASTE_LAST_PROMPT_ID,
        parentId: NHP_PROMPT_BAG_PROMPTS_ROOT_ID,
        title: '┘äÏÁ┘é ÏóÏ«Ï▒ Ï¿Ï▒┘ê┘àÏ¿Ï¬',
        contexts: ['page', 'frame', 'selection', 'editable']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_IMAGES_ROOT_ID,
        parentId: NHP_PROMPT_BAG_MENU_ROOT_ID,
        title: 'Images',
        contexts: ['page', 'frame', 'image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_SAVE_IMAGE_ID,
        parentId: NHP_PROMPT_BAG_IMAGES_ROOT_ID,
        title: 'Ï¡┘üÏ© Ïº┘äÏÁ┘êÏ▒Ï® ┘ü┘è Ïº┘äÏ¡┘é┘èÏ¿Ï®',
        contexts: ['image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_SEND_LAST_GEMINI_ID,
        parentId: NHP_PROMPT_BAG_IMAGES_ROOT_ID,
        title: 'ÏÑÏ▒Ï│Ïº┘ä ÏóÏ«Ï▒ ÏÁ┘êÏ▒Ï® ÏÑ┘ä┘ë Gemini',
        contexts: ['page', 'frame', 'image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_SEND_LAST_GPT_ID,
        parentId: NHP_PROMPT_BAG_IMAGES_ROOT_ID,
        title: 'ÏÑÏ▒Ï│Ïº┘ä ÏóÏ«Ï▒ ÏÁ┘êÏ▒Ï® ÏÑ┘ä┘ë ChatGPT',
        contexts: ['page', 'frame', 'image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.create({
        id: NHP_PROMPT_BAG_MANAGE_ID,
        parentId: NHP_PROMPT_BAG_MENU_ROOT_ID,
        title: 'ÏÑÏ»ÏºÏ▒Ï® Ïº┘äÏ¡┘é┘èÏ¿Ï®',
        contexts: ['page', 'frame', 'selection', 'editable', 'link', 'image']
    }, () => chrome.runtime.lastError);

    chrome.contextMenus.remove(NHP_LAUNCH_SCREEN_RECORDER_MENU_ID, () => {
        chrome.runtime.lastError;
        chrome.contextMenus.create({
            id: NHP_LAUNCH_SCREEN_RECORDER_MENU_ID,
            title: 'Ï¿Ï»Ïí Ï¬Ï│Ï¼┘è┘ä Ïº┘äÏ┤ÏºÏ┤Ï®',
            contexts: ['page', 'frame', 'selection', 'editable', 'link', 'image', 'video', 'audio']
        }, () => chrome.runtime.lastError);
    });
}

async function launchAdminScreenRecorderWindow() {
    await chrome.windows.create({
        url: chrome.runtime.getURL('modules/admin/recorder.html'),
        type: 'popup',
        width: 1180,
        height: 860,
        focused: false
    });

    return { ok: true, message: 'Ï¬┘à ┘üÏ¬Ï¡ ┘àÏ│Ï¼┘ä Ïº┘äÏ┤ÏºÏ┤Ï®.' };
}

async function sendLastPromptBagImage(targetUrl) {
    const images = await getPromptBagImages();
    const image = images[0];
    if (!image) {
        await openPromptBagManager();
        return { success: false, error: 'Image bag is empty.' };
    }
    return launchAiImagePopupWithPayload({
        dataUrl: image.dataUrl,
        nicheName: image.name || 'Prompt Bag Image',
        targetUrl,
        promptText: typeof resolvePromptBagImagePrompt === 'function'
            ? resolvePromptBagImagePrompt(targetUrl, '')
            : 'Ï¡┘ä┘æ┘ä ┘çÏ░┘ç Ïº┘äÏÁ┘êÏ▒Ï® ┘êÏº┘éÏ¬Ï▒Ï¡ Ï¬Ï¡Ï│┘è┘åÏºÏ¬ Ï¬ÏÁ┘à┘è┘à ┘ê┘â┘ä┘àÏºÏ¬ ┘à┘üÏ¬ÏºÏ¡┘èÏ® ┘à┘åÏºÏ│Ï¿Ï® ┘ä┘äÏÀÏ¿ÏºÏ╣Ï® Ï╣┘åÏ» Ïº┘äÏÀ┘äÏ¿.'
    });
}

function pngGenDataUrlToBlob(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) throw new Error('Invalid image data URL.');
    const mimeType = match[1] || 'image/png';
    const isBase64 = !!match[2];
    const raw = isBase64 ? atob(match[3] || '') : decodeURIComponent(match[3] || '');
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

async function pngGenBlobToDataUrl(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

function buildNhpPngGenPrompt(promptText = '', basePromptText = '') {
    const builtInBasePrompt = `Generate exactly 4 distinct print-ready apparel graphics based only on the printable design visible in the reference.

If the reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel:
- Extract only the printed logo, text, symbols, mascot, graphic marks, and color mood from the garment.
- Do not redraw the shirt, model, mannequin, fabric folds, product photo setup, watermark, or original background.
- Do not change the mockup pose because the mockup is not the target.

If the extracted printable graphic contains a person or character, you may change only that character pose or action when it improves the design. If the printable graphic has no person or character, do not invent a body pose.

Preserve the core theme and choose the most suitable commercial apparel style for the extracted graphic. Keep the result high contrast, readable, centered, and optimized for print.

Place every final design on a solid black background (#000000). Output final designs only.`;
    const baseWithText = typeof appendNhpTextPreservationRule === 'function'
        ? appendNhpTextPreservationRule(builtInBasePrompt)
        : builtInBasePrompt;
    const basePrompt = String(basePromptText || '').trim() || baseWithText;
    const extra = String(promptText || '').trim();
    return extra ? `${basePrompt}\n\nImage edit suggestions:\n${extra}` : basePrompt;
}

function applyVariationMode(prompt, mode = 'balanced') {
    const m = String(mode || 'balanced').trim().toLowerCase();
    if (m !== 'strong') return prompt;
    // Force the model away from "copy-paste" outputs.
    return `${prompt}\n\nIMPORTANT: Outputs must NOT be near-identical copies. Make variations 2-4 clearly different in composition, style, and rendering. Avoid generating the same image multiple times.`;
}

async function getNhpPngGenSettings(modelOverride = '', baseUrlOverride = '', apiKeyOverride = '') {
    const stored = await chrome.storage.local.get(['nhpProxyBaseUrl', 'nhpGptApiKey']);
    const requestedModel = String(modelOverride || CLI_PROXY_API_DEFAULT_MODEL).trim() || CLI_PROXY_API_DEFAULT_MODEL;
    return {
        baseUrl: normalizeCliProxyBaseUrl(baseUrlOverride || stored.nhpProxyBaseUrl || CLI_PROXY_API_BASE_URL),
        apiKey: String(apiKeyOverride || stored.nhpGptApiKey || '').trim(),
        requestedModel,
        model: requestedModel.toLowerCase() === 'auto' ? CLI_PROXY_API_DEFAULT_IMAGE_MODEL : requestedModel
    };
}

function normalizePngGenSize(size = '') {
    const raw = String(size || '').trim();
    if (/^\d{3,4}x\d{3,4}$/i.test(raw)) return raw.toLowerCase();
    return '1024x1024';
}

async function callNhpPngGeneration({ dataUrl = '', promptText = '', basePromptText = '', variationMode = 'balanced', model = '', count = 4, size = '1024x1024', baseUrl = '', apiKey = '' } = {}) {
    const settings = await getNhpPngGenSettings(model, baseUrl, apiKey);
    const hasImage = !!String(dataUrl || '').trim();
    const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}${hasImage ? '/images/edits' : '/images/generations'}`;
    const prompt = applyVariationMode(buildNhpPngGenPrompt(promptText, basePromptText), variationMode);
    const n = Math.max(1, Math.min(10, Number(count) || 4));
    const safeSize = normalizePngGenSize(size);
    let response;

    if (hasImage) {
        const form = new FormData();
        form.append('model', settings.model);
        form.append('prompt', prompt);
        form.append('n', String(n));
        form.append('size', safeSize);
        form.append('image', pngGenDataUrlToBlob(dataUrl), 'reference.png');
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${settings.apiKey}` },
            body: form
        });
    } else {
        const body = JSON.stringify({
            model: settings.model,
            prompt,
            n,
            size: safeSize,
        });
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey}`
            },
            body
        });
    }

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = { raw: text };
    }
    if (!response.ok) {
        throw new Error(data?.error?.message || data?.message || text || `NHP image API HTTP ${response.status}`);
    }

    const dataUrls = [];
    const urls = [];
    for (const image of Array.isArray(data?.data) ? data.data : []) {
        if (image?.b64_json) {
            dataUrls.push(`data:image/png;base64,${image.b64_json}`);
        } else if (image?.url) {
            const imageResponse = await fetch(image.url);
            if (!imageResponse.ok) throw new Error(`Unable to fetch generated image HTTP ${imageResponse.status}`);
            dataUrls.push(await pngGenBlobToDataUrl(await imageResponse.blob()));
            urls.push(image.url);
        }
    }
    if (!dataUrls.length) throw new Error('NHP image API returned no image data.');
    return {
        dataUrl: dataUrls[0],
        dataUrls,
        urls,
        model: settings.requestedModel,
        routedModel: settings.model,
        raw: data
    };
}

async function callNhpPngGenerationMulti(options = {}) {
    const want = Math.max(1, Math.min(10, Number(options.count) || 4));
    const first = await callNhpPngGeneration({ ...options, count: want });
    const out = Array.isArray(first.dataUrls) ? [...first.dataUrls] : (first.dataUrl ? [first.dataUrl] : []);
    const outUrls = Array.isArray(first.urls) ? [...first.urls] : [];

    // Some image models/endpoints return only 1 image even if n>1. Guarantee count by repeating requests.
    // Sequential requests keep it stable on weak PCs and reduce API flakiness.
    let attempts = 0;
    const maxAttempts = want * 2;
    while (out.length < want && attempts < maxAttempts) {
        attempts += 1;
        const next = await callNhpPngGeneration({ ...options, count: 1 });
        if (next?.dataUrl) out.push(next.dataUrl);
        if (Array.isArray(next?.urls) && next.urls[0]) outUrls.push(next.urls[0]);
    }

    return {
        ...first,
        dataUrl: out[0],
        dataUrls: out.slice(0, want),
        urls: outUrls
    };
}

async function publishPngGenTaskState(state) {
    const next = {
        taskId: state.taskId,
        status: state.status || 'running', // running|done|error
        startedAt: state.startedAt || Date.now(),
        updatedAt: Date.now(),
        total: Number(state.total || 0) || 0,
        done: Number(state.done || 0) || 0,
        dataUrls: Array.isArray(state.dataUrls) ? state.dataUrls : [],
        error: state.error || ''
    };
    await chrome.storage.local.set({ [PNGGEN_TASK_STATE_KEY]: next });
    try {
        await chrome.runtime.sendMessage({ action: 'PNGGEN_TASK_UPDATE', state: next });
    } catch (_) { }
    return next;
}

function createPngGenTaskId() {
    return `pnggen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function runPngGenTask(taskId, req) {
    const want = Math.max(1, Math.min(10, Number(req.count) || 4));
    const baseState = {
        taskId,
        status: 'running',
        startedAt: Date.now(),
        total: want,
        done: 0,
        dataUrls: []
    };
    await publishPngGenTaskState(baseState);
    try {
        // Generate progressively so UI can update without holding message channel open.
        for (let i = 0; i < want; i += 1) {
            const res = await callNhpPngGeneration({
                dataUrl: req.dataUrl || '',
                promptText: req.promptText || '',
                basePromptText: req.basePromptText || '',
                variationMode: req.variationMode || 'balanced',
                model: req.model || '',
                count: 1,
                size: req.size || '1024x1024',
                baseUrl: req.baseUrl || '',
                apiKey: req.apiKey || ''
            });
            const url = res?.dataUrl;
            if (url) baseState.dataUrls.push(url);
            baseState.done = baseState.dataUrls.length;
            await publishPngGenTaskState(baseState);
        }
        baseState.status = 'done';
        await publishPngGenTaskState(baseState);
    } catch (error) {
        baseState.status = 'error';
        baseState.error = error?.message || 'Generation failed.';
        await publishPngGenTaskState(baseState);
    }
}

function isActiveAiImageTaskForProvider(task, provider, now = Date.now()) {
    if (!task) return false;
    if (getAiImageProviderKey(task.targetUrl || '') !== provider) return false;
    if ((now - Number(task.createdAt || 0)) >= AI_IMAGE_TASK_MAX_AGE_MS) return false;
    const stage = String(task.stage || 'prepared');
    return !['done', 'submitted', 'failed', 'image_attached'].includes(stage);
}

function resetStuckAiImageTasksInQueue(now = Date.now()) {
    let changed = false;
    pendingAiImageTasks = pendingAiImageTasks.map((task) => {
        if (!task) return task;
        const stage = String(task.stage || 'prepared');
        if (stage !== 'injecting' && stage !== 'claimed') return task;
        const anchor = Number(task.claimedAt || task.updatedAt || task.createdAt || 0);
        if (!anchor || (now - anchor) < AI_IMAGE_INJECT_STUCK_MS) return task;
        changed = true;
        return {
            ...task,
            stage: 'prepared',
            claimedAt: null,
            claimedByTabId: null,
            claimedByWindowId: null
        };
    });
    return changed;
}

async function pruneExpiredAiImageTasksForProvider(targetUrl) {
    const provider = getAiImageProviderKey(targetUrl);
    await loadPendingAiImageTasks();
    if (resetStuckAiImageTasksInQueue()) {
        await savePendingAiImageTasks();
    }
    const now = Date.now();
    const before = pendingAiImageTasks.length;
    pendingAiImageTasks = pendingAiImageTasks.filter((task) => {
        if (!task) return false;
        const taskProvider = getAiImageProviderKey(task.targetUrl || '');
        if (taskProvider !== provider) return true;
        const ageMs = now - Number(task.createdAt || 0);
        if (ageMs >= AI_IMAGE_TASK_MAX_AGE_MS) return false;
        const stage = String(task.stage || 'prepared');
        if (['done', 'submitted', 'failed', 'image_attached'].includes(stage)) return false;
        return true;
    });
    if (pendingAiImageTasks.length !== before) {
        await savePendingAiImageTasks();
    }
    const hasActive = pendingAiImageTasks.some((task) => isActiveAiImageTaskForProvider(task, provider, now));
    if (!hasActive) {
        try {
            await chrome.storage.local.remove([
                'gemini_auto_trigger',
                'gemini_pending_image',
                'gemini_pending_prompt'
            ]);
        } catch (_) {
        }
    }
}

async function launchAiImagePopupWithPayload({ dataUrl, nicheName, targetUrl, promptText, requireLocalBridge = false, useLocalBridge = true, ignoreStoredNicheContext = false, pageNicheHint = '' }) {
    const finalUrl = normalizeGeminiTargetUrl(targetUrl || GEMINI_IMAGE_GEM_URL, GEMINI_IMAGE_GEM_URL);
    const forceFreshChat = true;
    await pruneExpiredAiImageTasksForProvider(finalUrl);
    const taskId = `aiimg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stableDataUrl = await normalizeAiImageDataUrl(dataUrl);
    const resolvedNicheName = await resolveNicheNameForImageSend(nicheName, {
        ignoreStoredNicheContext,
        pageNicheHint: pageNicheHint || nicheName
    });
    const hasExplicitPrompt = typeof promptText === 'string' && promptText.trim().length > 0;
    const resolvedPromptText = hasExplicitPrompt
        ? promptText.trim()
        : createAiImagePromptForTarget(resolvedNicheName, finalUrl);
    const originalBytes = estimateDataUrlBytes(dataUrl);
    const optimizedBytes = estimateDataUrlBytes(stableDataUrl);
    const shouldTryLocalBridge = requireLocalBridge
        || (useLocalBridge && (
            !aiImageLocalBridgeLastFailureAt
            || (Date.now() - aiImageLocalBridgeLastFailureAt) >= AI_IMAGE_LOCAL_BRIDGE_RETRY_COOLDOWN_MS
        ));
    const localBridgeResult = shouldTryLocalBridge
        ? await tryLocalAiImageBridge({
            targetUrl: finalUrl,
            dataUrl: stableDataUrl,
            promptText: resolvedPromptText
        })
        : null;
    if (localBridgeResult?.success) {
        return {
            taskId,
            targetTabId: null,
            targetWindowId: null,
            originalBytes,
            optimizedBytes,
            bridge: 'local-server',
            ...localBridgeResult
        };
    }
    if (requireLocalBridge) {
        throw new Error('AI Bridge Server is offline. Start the local server before sending.');
    }
    let popup = null;
    let targetTabId = null;
    let targetWindowId = null;

    try {
        const pooledTarget = await getOrCreateAiImageTargetWindow(finalUrl);
        popup = pooledTarget?.popup || null;
        targetWindowId = pooledTarget?.targetWindowId || null;
        targetTabId = pooledTarget?.targetTabId || null;
    } catch (popupError) {
        // Never open a normal browser tab here (RAM spike + UX issue on low-spec devices).
        // Retry with a direct popup create as a safer fallback.
        try {
            const lowSpecMode = await isLowSpecModeEnabled();
            const retryPopup = await chrome.windows.create({
                url: finalUrl,
                type: 'popup',
                focused: false,
                state: 'normal',
                width: lowSpecMode ? 760 : 860,
                height: lowSpecMode ? 620 : 720,
                left: 180,
                top: 100
            });
            popup = retryPopup || null;
            targetWindowId = retryPopup?.id || null;
            targetTabId = retryPopup?.tabs?.[0]?.id || null;
            if (!targetTabId && targetWindowId) {
                const tabs = await chrome.tabs.query({ windowId: targetWindowId }).catch(() => []);
                targetTabId = tabs?.[0]?.id || null;
            }
            console.warn('[NHP][AI Image Send] Pool popup failed; recovered with direct popup retry.', popupError);
        } catch (retryError) {
            console.warn('[NHP][AI Image Send] Popup open failed (no tab fallback).', retryError || popupError);
            throw (retryError || popupError);
        }
    }

    const boundIds = await resolveBoundPopupTabIds(targetWindowId, targetTabId);
    targetWindowId = boundIds.targetWindowId;
    targetTabId = boundIds.targetTabId;

    await loadPendingAiImageTasks();
    pendingAiImageTasks = [
        ...pendingAiImageTasks.filter((task) => task && (Date.now() - Number(task.createdAt || 0)) < AI_IMAGE_TASK_MAX_AGE_MS),
        {
            id: taskId,
            imageData: stableDataUrl,
            promptText: resolvedPromptText,
            createdAt: Date.now(),
            stage: 'prepared',
            nicheName: resolvedNicheName,
            originalBytes,
            optimizedBytes,
            targetTabId,
            targetWindowId,
            targetUrl: finalUrl,
            forceFreshChat,
            fastImageSend: true
        }
    ].slice(-AI_IMAGE_TASK_MAX_QUEUE);
    const saveResult = await savePendingAiImageTasks();
    if (!saveResult?.sessionSaved && !saveResult?.localSaved) {
        // Low-memory/low-quota fallback: use direct legacy bridge keys to avoid "silent no-send".
        await chrome.storage.local.set({
            gemini_pending_image: stableDataUrl,
            gemini_pending_prompt: resolvedPromptText,
            gemini_auto_trigger: Date.now()
        });
        console.warn('[NHP][AI Image Send] Queue persistence failed; using legacy direct payload fallback.');
    }

    // Do not broadcast gemini_auto_trigger to every open AI tab ÔÇö only nudge the bound popup tab/window.
    if (targetTabId || targetWindowId) {
        const nudgeDelays = forceFreshChat ? [0, 450, 1000, 2200, 4200, 7200, 11000, 16000] : [0, 500, 1400, 3000, 6000];
        const nudgeBoundTabOnly = async (delayMs = 0) => {
            if (delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
            const task = await findPendingAiImageTaskById(taskId);
            if (!task) return;
            const liveIds = await resolveBoundPopupTabIds(task.targetWindowId, task.targetTabId);
            if (liveIds.targetTabId) {
                await bindPendingAiImageTaskTarget(taskId, liveIds.targetWindowId, liveIds.targetTabId);
            }
            const taskPayload = serializeAiImageTaskForContent(
                await findPendingAiImageTaskById(taskId)
            );
            if (!taskPayload) return;
            const tabIds = new Set();
            if (liveIds.targetTabId) tabIds.add(liveIds.targetTabId);
            if (liveIds.targetWindowId) {
                const tabs = await chrome.tabs.query({ windowId: liveIds.targetWindowId }).catch(() => []);
                tabs.forEach((tab) => {
                    if (tab?.id) tabIds.add(tab.id);
                });
            }
            await deliverAiImageTaskToTabs(tabIds, taskId, taskPayload);
        };
        nudgeDelays.forEach((delayMs) => {
            void nudgeBoundTabOnly(delayMs);
        });
    }

    void ensureAiImageNudgeAlarm();
    void nudgeAllPreparedAiImageTasks();

    if ((!popup || typeof popup.id !== 'number') && !targetTabId) {
        throw new Error('AI popup was not created.');
    }

    return { taskId, targetTabId, targetWindowId, originalBytes, optimizedBytes };
}

function getAiImageProviderKey(url) {
    const value = String(url || '').toLowerCase();
    if (value.includes('chatgpt.com')) return 'gpt';
    return 'gemini';
}

async function getAiImageProviderMaxPages() {
    try {
        const stored = await getStorage(AI_IMAGE_PROVIDER_MAX_PAGES_KEY);
        const rawValue = stored?.[AI_IMAGE_PROVIDER_MAX_PAGES_KEY];
        if (rawValue === undefined || rawValue === null || rawValue === '') return AI_IMAGE_PROVIDER_MAX_PAGES_DEFAULT;
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        return Math.floor(parsed);
    } catch (_) {
        return AI_IMAGE_PROVIDER_MAX_PAGES_DEFAULT;
    }
}

async function getOrCreateAiImageTargetWindow(finalUrl) {
    const provider = getAiImageProviderKey(finalUrl);
    const chain = aiImageWindowAssignChains[provider] || Promise.resolve();
    const run = () => getOrCreateAiImageTargetWindowUnlocked(finalUrl, provider);
    const next = chain.then(run, run);
    aiImageWindowAssignChains[provider] = next.catch(() => null);
    return next;
}

async function getOrCreateAiImageTargetWindowUnlocked(finalUrl, provider = getAiImageProviderKey(finalUrl)) {
    const pool = aiImageProviderWindowPools[provider] || aiImageProviderWindowPools.gemini;
    const configuredMax = await getAiImageProviderMaxPages();
    const maxPages = configuredMax > 0 ? configuredMax : AI_IMAGE_PROVIDER_MAX_PAGES_DEFAULT;
    const aliveWindowIds = [];
    let lastAliveWindow = null;
    await loadPendingAiImageTasks();
    const busyWindowIds = new Set(
        pendingAiImageTasks
            .filter((task) => isActiveAiImageTaskForProvider(task, provider))
            .map((task) => task.targetWindowId)
            .filter((id) => Number.isFinite(id))
    );

    for (const windowId of pool.windowIds) {
        if (!windowId) continue;
        try {
            const existing = await chrome.windows.get(windowId, { populate: true });
            if (existing?.id) {
                aliveWindowIds.push(existing.id);
                lastAliveWindow = existing;
            }
        } catch (_) {
            // window closed by user; skip silently
        }
    }
    pool.windowIds = aliveWindowIds.slice(0, maxPages);
    if (pool.nextIndex >= pool.windowIds.length) pool.nextIndex = 0;

    const lowSpecMode = await isLowSpecModeEnabled();
    const popupWidth = lowSpecMode ? 760 : 860;
    const popupHeight = lowSpecMode ? 620 : 720;

    // Under the cap: open a NEW popup and keep existing ones open.
    if (pool.windowIds.length < maxPages) {
        const slot = pool.windowIds.length;
        const created = await chrome.windows.create({
            url: finalUrl,
            type: 'popup',
            focused: true,
            state: 'normal',
            width: popupWidth,
            height: popupHeight,
            left: 120 + (slot % 3) * 48,
            top: 72 + Math.floor(slot / 3) * 44
        });
        const createdWindowId = created?.id || null;
        if (createdWindowId) {
            pool.windowIds.push(createdWindowId);
            lastAliveWindow = created;
        }
    } else if (pool.windowIds.length > 0) {
        const idleWindowId = pool.windowIds.find((windowId) => !busyWindowIds.has(windowId));
        if (idleWindowId) {
            try {
                const targetWindow = await chrome.windows.get(idleWindowId, { populate: true });
                await chrome.windows.update(idleWindowId, {
                    focused: false,
                    state: 'normal',
                    width: popupWidth,
                    height: popupHeight
                }).catch(() => null);
                lastAliveWindow = targetWindow;
            } catch (_) {
            }
        } else {
            // All pooled windows are busy ÔÇö open a fresh popup instead of reloading a busy one.
            const slot = pool.windowIds.length;
            const created = await chrome.windows.create({
                url: finalUrl,
                type: 'popup',
                focused: false,
                state: 'normal',
                width: popupWidth,
                height: popupHeight,
                left: 120 + (slot % 3) * 48,
                top: 72 + Math.floor(slot / 3) * 44
            });
            const createdWindowId = created?.id || null;
            if (createdWindowId) {
                pool.windowIds.push(createdWindowId);
                if (maxPages > 0 && pool.windowIds.length > maxPages) {
                    pool.windowIds = pool.windowIds.slice(-maxPages);
                }
                lastAliveWindow = created;
            }
        }
    }

    const targetWindowId = lastAliveWindow?.id || null;
    let targetTabId = lastAliveWindow?.tabs?.[0]?.id || null;
    if (!targetTabId && targetWindowId) {
        const tabs = await chrome.tabs.query({ windowId: targetWindowId }).catch(() => []);
        targetTabId = tabs?.[0]?.id || null;
    }

    return { popup: lastAliveWindow, targetWindowId, targetTabId };
}

async function tryLocalAiImageBridge({ targetUrl, dataUrl, promptText }) {
    const now = Date.now();
    if ((now - aiImageLocalBridgeLastFailureAt) < AI_IMAGE_LOCAL_BRIDGE_RETRY_COOLDOWN_MS) {
        return null;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_IMAGE_LOCAL_BRIDGE_TIMEOUT_MS);
    try {
        const response = await fetch(`${getAiBridgeServerUrl()}/ai-image-bridge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUrl,
                dataUrl,
                promptText,
                headless: false
            }),
            signal: controller.signal
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Local bridge HTTP ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
        }
        const result = await response.json();
        if (!result?.success) {
            throw new Error(result?.error || 'Local bridge failed.');
        }
        aiImageLocalBridgeLastFailureAt = 0;
        return result;
    } catch (error) {
        aiImageLocalBridgeLastFailureAt = Date.now();
        console.warn('[NHP][AI Image Send] Local server bridge unavailable, falling back to extension injection.', error);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function normalizeAiImageDataUrl(dataUrl) {
    try {
        if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
            return dataUrl;
        }
        const lowSpecMode = await isLowSpecModeEnabled();
        const originalBytes = estimateDataUrlBytes(dataUrl);
        const bitmap = await screenDataUrlToImageBitmap(dataUrl);
        const longestSide = Math.max(bitmap.width, bitmap.height);
        const isVeryLargePayload = lowSpecMode && originalBytes > 2_500_000;
        // Favor low-memory devices: tighter constraints, especially for very large payloads.
        const maxSide = lowSpecMode ? (isVeryLargePayload ? 768 : 1024) : 1200;
        const skipCompressionUnderBytes = lowSpecMode ? 650_000 : 900_000;
        if (longestSide <= maxSide && originalBytes < skipCompressionUnderBytes) {
            return dataUrl;
        }

        const scale = Math.min(1, maxSide / longestSide);
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        const candidates = [];
        for (const option of [
            { type: 'image/webp', quality: lowSpecMode ? (isVeryLargePayload ? 0.68 : 0.78) : 0.82 },
            { type: 'image/jpeg', quality: lowSpecMode ? (isVeryLargePayload ? 0.62 : 0.76) : 0.82 },
            { type: 'image/jpeg', quality: lowSpecMode ? (isVeryLargePayload ? 0.54 : 0.68) : 0.72 },
            ...(lowSpecMode ? [{ type: 'image/jpeg', quality: isVeryLargePayload ? 0.48 : 0.58 }] : [])
        ]) {
            try {
                const blob = await canvas.convertToBlob(option);
                const candidate = await screenBlobToDataUrl(blob);
                candidates.push({ dataUrl: candidate, bytes: estimateDataUrlBytes(candidate) });
            } catch (_) {
            }
        }

        candidates.sort((left, right) => left.bytes - right.bytes);
        const best = candidates[0];
        if (best && best.bytes < originalBytes) {
            return best.dataUrl;
        }
        return dataUrl;
    } catch (error) {
        console.warn('[NHP][AI Image Send] Image normalization failed; using original image.', error);
        return dataUrl;
    }
}

function estimateDataUrlBytes(dataUrl) {
    const value = String(dataUrl || '');
    const commaIndex = value.indexOf(',');
    const payload = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
    return Math.ceil((payload.length * 3) / 4);
}

async function loadPendingAiImageTasks() {
    const mergedById = new Map();
    const absorbTasks = (tasks) => {
        if (!Array.isArray(tasks)) return;
        tasks.forEach((task) => {
            if (!task?.id) return;
            const existing = mergedById.get(task.id);
            if (!existing) {
                mergedById.set(task.id, task);
                return;
            }
            const existingHasImage = !!existing.imageData;
            const nextHasImage = !!task.imageData;
            const existingTime = Number(existing.updatedAt || existing.claimedAt || existing.createdAt || 0);
            const nextTime = Number(task.updatedAt || task.claimedAt || task.createdAt || 0);
            if ((nextHasImage && !existingHasImage) || nextTime >= existingTime) {
                mergedById.set(task.id, { ...existing, ...task });
            }
        });
    };

    try {
        const stored = await chrome.storage.session.get(AI_IMAGE_TASK_QUEUE_KEY);
        absorbTasks(stored?.[AI_IMAGE_TASK_QUEUE_KEY]);
    } catch (_) {
    }
    try {
        const stored = await chrome.storage.local.get(AI_IMAGE_TASK_SAFE_QUEUE_KEY);
        absorbTasks(stored?.[AI_IMAGE_TASK_SAFE_QUEUE_KEY]);
    } catch (_) {
    }
    const now = Date.now();
    pendingAiImageTasks = [...mergedById.values()]
        .filter((task) => task && (now - Number(task.createdAt || 0)) < AI_IMAGE_TASK_SAFE_MAX_AGE_MS)
        .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
    return pendingAiImageTasks;
}

async function savePendingAiImageTasks() {
    let sessionSaved = false;
    let localSaved = false;
    if (pendingAiImageTasks.length) {
        try {
            await chrome.storage.session.set({ [AI_IMAGE_TASK_QUEUE_KEY]: pendingAiImageTasks });
            sessionSaved = true;
        } catch (error) {
            console.warn('[NHP][AI Image Send] Session queue save failed; local safe queue will be used.', error);
        }
        try {
            await chrome.storage.local.set({ [AI_IMAGE_TASK_SAFE_QUEUE_KEY]: pendingAiImageTasks });
            localSaved = true;
        } catch (error) {
            console.warn('[NHP][AI Image Send] Local safe queue save failed.', error);
        }
        return { sessionSaved, localSaved };
    }

    try {
        await chrome.storage.session.remove(AI_IMAGE_TASK_QUEUE_KEY);
    } catch (error) {
        console.warn('[NHP][AI Image Send] Session queue cleanup failed.', error);
    }
    try {
        await chrome.storage.local.remove(AI_IMAGE_TASK_SAFE_QUEUE_KEY);
    } catch (error) {
        console.warn('[NHP][AI Image Send] Local safe queue cleanup failed.', error);
    }
    return { sessionSaved: true, localSaved: true };
}

/** Align chatgpt.com Ôåö www.chatgpt.com (and similar) for task claiming. */
function normalizeAiBridgeHostname(hostname) {
    const h = String(hostname || '').toLowerCase().trim();
    if (!h) return '';
    return h.startsWith('www.') ? h.slice(4) : h;
}

function aiBridgeHostsMatch(senderHostname, targetHostname) {
    const s = normalizeAiBridgeHostname(senderHostname);
    const t = normalizeAiBridgeHostname(targetHostname);
    return !!s && !!t && s === t;
}

function isPendingAiImageTaskClaimable(task, now = Date.now()) {
    if (!task) return false;
    if ((now - Number(task.createdAt || 0)) >= AI_IMAGE_TASK_MAX_AGE_MS) return false;
    const stage = String(task.stage || 'prepared');
    return !['image_attached', 'done', 'submitted', 'claimed', 'injecting'].includes(stage);
}

function isPendingAiImageTaskBoundToSender(task, senderTabId, senderWindowId, senderHost) {
    if (!isPendingAiImageTaskClaimable(task)) return false;
    let targetHost = '';
    try {
        targetHost = new URL(task.targetUrl || '').hostname;
    } catch (_) {
        return false;
    }
    if (!aiBridgeHostsMatch(senderHost, targetHost)) return false;

    // Each popup is tied to a specific window ÔÇö never let another window steal the task.
    if (Number.isFinite(task.targetWindowId)) {
        return Number.isFinite(senderWindowId) && task.targetWindowId === senderWindowId;
    }
    if (Number.isFinite(task.targetTabId)) {
        return Number.isFinite(senderTabId) && task.targetTabId === senderTabId;
    }
    return true;
}

function findClaimableAiImageTaskForSender(sender) {
    const senderTabId = sender?.tab?.id || null;
    const senderWindowId = sender?.tab?.windowId || null;
    const senderUrl = String(sender?.tab?.url || sender?.url || '');
    const senderHost = (() => {
        try {
            return new URL(senderUrl).hostname;
        } catch (_) {
            return '';
        }
    })();
    const now = Date.now();
    const matches = pendingAiImageTasks
        .filter((task) => isPendingAiImageTaskBoundToSender(task, senderTabId, senderWindowId, senderHost))
        .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
    return matches[0] || null;
}

async function resolveBoundPopupTabIds(targetWindowId, fallbackTabId = null) {
    if (!targetWindowId) {
        return { targetWindowId: null, targetTabId: fallbackTabId || null };
    }
    for (let attempt = 0; attempt < 24; attempt += 1) {
        try {
            const win = await chrome.windows.get(targetWindowId, { populate: true });
            const tabId = win?.tabs?.[0]?.id || null;
            if (tabId) {
                return { targetWindowId: win.id, targetTabId: tabId };
            }
        } catch (_) {
        }
        const tabs = await chrome.tabs.query({ windowId: targetWindowId }).catch(() => []);
        if (tabs[0]?.id) {
            return { targetWindowId, targetTabId: tabs[0].id };
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { targetWindowId, targetTabId: fallbackTabId || null };
}

async function bindPendingAiImageTaskTarget(taskId, targetWindowId, targetTabId) {
    if (!taskId) return null;
    await loadPendingAiImageTasks();
    let bound = null;
    pendingAiImageTasks = pendingAiImageTasks.map((task) => {
        if (!task || task.id !== taskId) return task;
        bound = {
            ...task,
            targetWindowId: targetWindowId ?? task.targetWindowId ?? null,
            targetTabId: targetTabId ?? task.targetTabId ?? null
        };
        return bound;
    });
    if (bound) {
        await savePendingAiImageTasks();
    }
    return bound;
}

async function takePendingAiImageTask(sender) {
    await loadPendingAiImageTasks();
    const now = Date.now();
    const task = findClaimableAiImageTaskForSender(sender);
    if (!task) {
        pendingAiImageTasks = pendingAiImageTasks.filter((item) => item && (now - Number(item.createdAt || 0)) < AI_IMAGE_TASK_SAFE_MAX_AGE_MS);
        await savePendingAiImageTasks();
        return null;
    }

    const senderTabId = sender?.tab?.id || null;
    const senderWindowId = sender?.tab?.windowId || null;
    const index = pendingAiImageTasks.findIndex((item) => item?.id === task.id);
    if (index < 0) return null;

    pendingAiImageTasks[index] = {
        ...task,
        stage: 'injecting',
        claimedAt: now,
        claimedByTabId: senderTabId || task.claimedByTabId || null,
        claimedByWindowId: senderWindowId || task.claimedByWindowId || null
    };
    await savePendingAiImageTasks();
    return { ...pendingAiImageTasks[index] };
}

async function markPendingAiImageTaskStage(taskId, stage, details = {}) {
    await loadPendingAiImageTasks();
    const now = Date.now();
    let matched = false;
    pendingAiImageTasks = pendingAiImageTasks.map((task) => {
        if (!task || task.id !== taskId) return task;
        matched = true;
        const nextTask = {
            ...task,
            ...details,
            stage,
            updatedAt: now,
            [`${stage}At`]: now
        };
        if (stage === 'image_attached' || stage === 'done') {
            delete nextTask.imageData;
        }
        return {
            ...nextTask
        };
    }).filter((task) => task && (now - Number(task.createdAt || 0)) < AI_IMAGE_TASK_SAFE_MAX_AGE_MS);
    await savePendingAiImageTasks();
    return matched;
}

async function findPendingAiImageTaskById(taskId) {
    if (!taskId) return null;
    await loadPendingAiImageTasks();
    return pendingAiImageTasks.find((task) => task?.id === taskId) || null;
}

function serializeAiImageTaskForContent(task) {
    if (!task || typeof task !== 'object') return null;
    const targetUrl = task.targetUrl || '';
    const forceFreshChat = task.forceFreshChat !== false;
    return {
        requestId: task.id || task.requestId || null,
        taskId: task.id || task.requestId || null,
        prompt: task.promptText || task.prompt || '',
        imageData: task.imageData || null,
        mode: task.mode || (task.imageData ? 'images' : 'text'),
        forceFreshChat,
        fastImageSend: task.fastImageSend === true,
        targetUrl,
        createdAt: task.createdAt || Date.now()
    };
}

async function waitForAiImageTabBridge(tabId, timeoutMs = 22000) {
    if (!Number.isFinite(tabId)) return false;
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < timeoutMs) {
        try {
            const pong = await chrome.tabs.sendMessage(tabId, { action: 'NHP_AI_BRIDGE_PING' });
            if (pong?.ready) return true;
        } catch (_) {
        }
        await new Promise((resolve) => setTimeout(resolve, 450));
    }
    return false;
}

async function deliverAiImageTaskToTabs(tabIds, taskId, taskPayload) {
    if (!taskId || !taskPayload || !tabIds?.size) return false;
    let delivered = false;
    for (const tabId of tabIds) {
        const ready = await waitForAiImageTabBridge(tabId, 18000);
        if (!ready) continue;
        try {
            const res = await chrome.tabs.sendMessage(tabId, {
                action: 'NHP_AI_TASK_READY',
                taskId,
                task: taskPayload
            });
            if (res?.success !== false) {
                delivered = true;
            }
        } catch (_) {
        }
    }
    return delivered;
}

async function ensureAiImageNudgeAlarm() {
    try {
        const existing = await chrome.alarms.get(NHP_AI_IMAGE_NUDGE_ALARM);
        if (!existing) {
            chrome.alarms.create(NHP_AI_IMAGE_NUDGE_ALARM, { periodInMinutes: 1 });
        }
    } catch (_) {
    }
}

async function nudgeAllPreparedAiImageTasks() {
    await loadPendingAiImageTasks();
    if (resetStuckAiImageTasksInQueue()) {
        await savePendingAiImageTasks();
    }
    const tasks = pendingAiImageTasks.filter((task) => {
        if (!task?.id) return false;
        const stage = String(task.stage || 'prepared');
        return stage === 'prepared' || stage === 'retargeted';
    });
    for (const task of tasks) {
        await nudgeAiImageTaskTarget(task.id);
    }
}

async function nudgeAiImageTaskTarget(taskId) {
    const task = await findPendingAiImageTaskById(taskId);
    if (!task) return false;
    if (task.stage === 'submitted' || task.stage === 'done' || task.stage === 'failed') {
        return false;
    }
    const taskPayload = serializeAiImageTaskForContent(task);
    const tabIds = new Set();
    if (Number.isFinite(task.targetTabId)) {
        tabIds.add(task.targetTabId);
    }
    if (Number.isFinite(task.targetWindowId)) {
        try {
            const tabs = await chrome.tabs.query({ windowId: task.targetWindowId });
            (tabs || []).forEach((tab) => {
                if (Number.isFinite(tab?.id)) {
                    tabIds.add(tab.id);
                }
            });
        } catch (_) {
        }
    }
    if (!tabIds.size) return false;
    return deliverAiImageTaskToTabs(tabIds, taskId, taskPayload);
}

async function waitForAiImageTaskDelivery(taskId, timeoutMs = AI_IMAGE_DELIVERY_WAIT_MS) {
    const startedAt = Date.now();
    let lastNudgeAt = 0;
    while ((Date.now() - startedAt) < timeoutMs) {
        const task = await findPendingAiImageTaskById(taskId);
        if (!task) {
            return { delivered: false, missing: true };
        }
        if (task.stage === 'failed') {
            return { delivered: false, failed: true, task };
        }
        if (task.stage === 'submitted' || task.stage === 'done' || task.stage === 'image_attached') {
            return { delivered: true, stage: task.stage, task };
        }
        if (task.stage === 'claimed' || task.stage === 'injecting') {
            return { delivered: false, inProgress: true, task };
        }
        // Do not treat early claim as delivered: inject may still be in progress.
        if ((Date.now() - lastNudgeAt) > 2200) {
            await nudgeAiImageTaskTarget(taskId);
            lastNudgeAt = Date.now();
        }
        await new Promise((resolve) => setTimeout(resolve, 650));
    }
    const task = await findPendingAiImageTaskById(taskId);
    return { delivered: false, timeout: true, task };
}

async function retargetAiImageTask(taskId) {
    await loadPendingAiImageTasks();
    const index = pendingAiImageTasks.findIndex((task) => task?.id === taskId);
    if (index < 0) return null;
    const task = pendingAiImageTasks[index];
    const targetUrl = task?.targetUrl || GEMINI_IMAGE_GEM_URL;
    const lowSpecMode = await isLowSpecModeEnabled();
    const popupWidth = lowSpecMode ? 760 : 860;
    const popupHeight = lowSpecMode ? 620 : 720;

    let targetTabId = null;
    let targetWindowId = null;

    const finishRetarget = async () => {
        const now = Date.now();
        const base = pendingAiImageTasks[index] || task;
        pendingAiImageTasks[index] = {
            ...base,
            targetTabId,
            targetWindowId,
            stage: 'retargeted',
            updatedAt: now,
            retargetedAt: now
        };
        await savePendingAiImageTasks();
        await nudgeAiImageTaskTarget(taskId);
        return pendingAiImageTasks[index];
    };

    // Prefer the existing AI popup window ÔÇö never open a normal browser tab here (duplicate UX vs floating popup).
    if (task.targetWindowId) {
        try {
            const win = await chrome.windows.get(task.targetWindowId, { populate: true });
            const firstTab = win?.tabs?.[0];
            if (win?.id && firstTab?.id) {
                await chrome.tabs.update(firstTab.id, { url: targetUrl, active: false }).catch(() => null);
                targetTabId = firstTab.id;
                targetWindowId = win.id;
                await chrome.windows.update(win.id, {
                    focused: false,
                    state: 'normal',
                    width: popupWidth,
                    height: popupHeight
                }).catch(() => null);
                return finishRetarget();
            }
        } catch (_) {
            // Popup was closed ÔÇö fall through and create a replacement popup window.
        }
    }

    try {
        const createdWin = await chrome.windows.create({
            url: targetUrl,
            type: 'popup',
            focused: false,
            state: 'normal',
            width: popupWidth,
            height: popupHeight,
            left: 180,
            top: 100
        });
        targetWindowId = createdWin?.id || null;
        targetTabId = createdWin?.tabs?.[0]?.id || null;
        if (!targetTabId && targetWindowId) {
            const tabs = await chrome.tabs.query({ windowId: targetWindowId }).catch(() => []);
            targetTabId = tabs?.[0]?.id || null;
        }
        if (!targetTabId && !targetWindowId) {
            throw new Error('Retarget popup missing tab.');
        }
        return finishRetarget();
    } catch (error) {
        console.warn('[NHP][AI Image Send] Failed to retarget AI image task.', error);
        return null;
    }
}

async function ensureAiImageTaskDelivery(taskId) {
    if (!taskId) return { delivered: false, missing: true };
    const firstPass = await waitForAiImageTaskDelivery(taskId, AI_IMAGE_DELIVERY_WAIT_MS);
    if (firstPass.delivered || firstPass.failed) {
        return firstPass;
    }
    const task = await findPendingAiImageTaskById(taskId);
    if (!task || task.stage === 'image_attached' || task.stage === 'done' || task.stage === 'submitted') {
        return firstPass;
    }
    const reopened = await retargetAiImageTask(taskId);
    if (!reopened) {
        return firstPass;
    }
    return waitForAiImageTaskDelivery(taskId, AI_IMAGE_DELIVERY_RETRY_WAIT_MS);
}

async function captureContextMenuSelectedRegion(tab) {
    const targetTab = tab?.id ? tab : await screenGetActiveTab();
    screenEnsureSupportedTab(targetTab);
    await screenFocusTab(targetTab);

    const visibleDataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId, { format: 'png' });

    await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: ['screeeeenvme/scripts/selection.js']
    });

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: (backgroundImage) => window.__screeeeenvmeStartSelection({ backgroundImage }),
        args: [visibleDataUrl]
    });

    if (!result || result.cancelled) {
        throw new Error('Selection was cancelled.');
    }

    return await screenCropVisibleCapture(visibleDataUrl, result);
}

async function beginContextMenuCropSelection(tab, request) {
    const targetTab = tab?.id ? tab : await screenGetActiveTab();
    screenEnsureSupportedTab(targetTab);
    await screenFocusTab(targetTab);

    const visibleDataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId, { format: 'png' });
    const requestId = `ctxcrop_${targetTab.id}_${Date.now()}`;
    await chrome.storage.session.set({
        [requestId]: {
            capturedImage: visibleDataUrl,
            nicheName: request?.nicheName || 'Trending Topic',
            targetUrl: request?.targetUrl || GEMINI_IMAGE_GEM_URL
        }
    });

    await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: ['screeeeenvme/scripts/selection.js']
    });

    await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: (backgroundImage, pendingRequestId) => window.__screeeeenvmeStartSelectionAndNotify(
            { backgroundImage },
            { requestId: pendingRequestId }
        ),
        args: [visibleDataUrl, requestId]
    });
}

async function handleContextMenuGeminiImageSend(info, tab, options = {}) {
    const { targetUrl = GEMINI_IMAGE_GEM_URL, cropMode = false } = options;
    if (!info?.srcUrl) {
        throw new Error('No image URL found in context menu click.');
    }

    const nicheName = await resolveNicheNameForImageSend('Trending Topic', { ignoreStoredNicheContext: true });
    if (cropMode) {
        await beginContextMenuCropSelection(tab, { nicheName, targetUrl });
        return;
    }

    const pageUrl = info.pageUrl || info.frameUrl || info.srcUrl;
    const fetchedImage = await fetchImageAsDataUrlFromCandidates([info.srcUrl], pageUrl);
    await launchAiImagePopupWithPayload({ dataUrl: fetchedImage.dataUrl, nicheName, targetUrl });
}

function normalizeChatGptGptBaseUrl(url = '') {
    const raw = String(url || '').trim();
    const match = raw.match(/^(https:\/\/chatgpt\.com\/g\/[^/?#]+)/i);
    return match ? match[1] : raw;
}

function normalizeGeminiTargetUrl(url, fallback = GEMINI_SEO_GEM_URL) {
    const raw = String(url || '').trim();
    if (/^https:\/\/gemini\.google\.com\/gem\//i.test(raw)) return raw;
    if (/^https:\/\/chatgpt\.com\/g\//i.test(raw)) return normalizeChatGptGptBaseUrl(raw);
    if (/^https:\/\/chatgpt\.com\//i.test(raw)) return normalizeChatGptGptBaseUrl(fallback) || CHATGPT_IMAGE_GPT_URL;
    return fallback || GEMINI_SEO_GEM_URL;
}

function isGeminiGemUrl(url) {
    return /^https:\/\/gemini\.google\.com\/gem\//i.test(String(url || ''));
}

async function ensureGeminiWindowOnUrl(windowId, url, { waitMs = 32000 } = {}) {
    const targetUrl = normalizeGeminiTargetUrl(url, GEMINI_SEO_GEM_URL);
    if (!windowId || typeof windowId !== 'number') return false;
    try {
        const tabs = await chrome.tabs.query({ windowId });
        const gemTab = (tabs || []).find((tab) => /gemini\.google\.com/i.test(String(tab?.url || '')))
            || tabs?.[0];
        if (!gemTab?.id) return false;
        const current = String(gemTab.url || '');
        const sameGem = isGeminiGemUrl(targetUrl) && isGeminiGemUrl(current)
            && current.replace(/\?.*$/, '') === targetUrl.replace(/\?.*$/, '');
        if (!sameGem) {
            await chrome.tabs.update(gemTab.id, { url: targetUrl, active: true });
            await waitForGeminiTabLoadComplete(gemTab.id, waitMs);
        }
        return true;
    } catch (error) {
        console.warn('[NHP][SEO Batch] ensureGeminiWindowOnUrl failed:', error?.message || error);
        return false;
    }
}

async function openGeminiPopupWindow(url = GEMINI_WEB_POPUP_URL, focused = true) {
    const targetUrl = normalizeGeminiTargetUrl(url, GEMINI_WEB_POPUP_URL);
    if (geminiWebWindowId) {
        try {
            const existing = await chrome.windows.get(geminiWebWindowId, { populate: true });
            if (existing?.id) {
                await ensureGeminiWindowOnUrl(existing.id, targetUrl, { waitMs: 28000 });
                await chrome.windows.update(existing.id, { focused: !!focused, state: 'normal' });
                return existing;
            }
        } catch (_) {
            geminiWebWindowId = null;
        }
    }

    const created = await chrome.windows.create({
        url: targetUrl,
        type: 'popup',
        focused,
        state: 'normal',
        width: 900,
        height: 800,
        left: 100,
        top: 100
    });
    geminiWebWindowId = created?.id || null;
    return created;
}

async function runGeminiWebTask({ prompt, base64 = null, mimeType = 'image/png', mode = 'text', url = GEMINI_WEB_POPUP_URL }) {
    const requestId = `gemweb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task = {
        requestId,
        prompt: String(prompt || ''),
        imageData: base64 || null,
        mimeType: mimeType || 'image/png',
        mode: mode || 'text',
        createdAt: Date.now()
    };

    return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(async () => {
            geminiWebTaskResolvers.delete(requestId);
            await chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
            reject(new Error('Gemini Web task timed out.'));
        }, 180000);

        geminiWebTaskResolvers.set(requestId, {
            resolve: async (payload) => {
                clearTimeout(timeoutId);
                geminiWebTaskResolvers.delete(requestId);
                await chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
                resolve(payload);
            },
            reject: async (errorMessage) => {
                clearTimeout(timeoutId);
                geminiWebTaskResolvers.delete(requestId);
                await chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
                reject(new Error(errorMessage || 'Gemini Web task failed.'));
            }
        });

        (async () => {
            try {
                await chrome.storage.local.set({ [GEMINI_WEB_TASK_STORAGE_KEY]: task });
                const popup = await openGeminiPopupWindow(url || GEMINI_WEB_POPUP_URL, true);
                if (!popup || typeof popup.id !== 'number') {
                    throw new Error('Gemini popup was not created.');
                }
                nudgeGeminiWebTabs(popup.id, requestId, task.mode || 'text');
            } catch (error) {
                clearTimeout(timeoutId);
                geminiWebTaskResolvers.delete(requestId);
                await chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
                reject(error);
            }
        })();
    });
}

/**
 * If gemini_web_task exists in storage but the service worker was restarted, the in-memory
 * geminiWebTaskResolvers map is empty while the task remains ÔÇö the content script would
 * re-inject the same image on every Gemini visit. Remove only when no bridge is active.
 */
const GEMINI_WEB_TASK_STORAGE_TTL_MS = 210000;

function extractGeminiWebBatchSessionId(task) {
    if (!task || typeof task !== 'object') return '';
    const explicit = String(task.sessionId || '').trim();
    if (explicit) return explicit;
    const rid = String(task.requestId || '').trim();
    const match = rid.match(/^(gwb_\d+_[a-z0-9]+)_\d+$/i);
    return match?.[1] || '';
}

async function isActiveGeminiWebTask(task) {
    if (!task || typeof task !== 'object') return false;

    const rid = task.requestId != null ? String(task.requestId) : '';
    if (rid && geminiWebTaskResolvers.has(rid)) {
        return true;
    }

    const sessionId = extractGeminiWebBatchSessionId(task);
    if (sessionId && geminiWebBatchSessions.has(sessionId)) {
        return true;
    }

    try {
        const batchData = await chrome.storage.local.get(GEMINI_WEB_BATCH_STORAGE_KEY);
        const batch = batchData?.[GEMINI_WEB_BATCH_STORAGE_KEY];
        if (sessionId && batch?.sessionId === sessionId) {
            return true;
        }
    } catch (_) {
    }

    return false;
}

async function sweepOrphanGeminiWebTaskStorage() {
    try {
        const data = await chrome.storage.local.get(GEMINI_WEB_TASK_STORAGE_KEY);
        const task = data[GEMINI_WEB_TASK_STORAGE_KEY];
        if (!task || typeof task !== 'object') {
            return { swept: false };
        }
        const rid = task.requestId != null ? String(task.requestId) : '';
        const createdAt = Number(task.createdAt || 0);
        if (createdAt && (Date.now() - createdAt) > GEMINI_WEB_TASK_STORAGE_TTL_MS) {
            await chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
            if (rid && geminiWebTaskResolvers.has(rid)) {
                const pending = geminiWebTaskResolvers.get(rid);
                geminiWebTaskResolvers.delete(rid);
                try {
                    pending?.reject?.(new Error('Gemini web task expired (TTL).'));
                } catch (_) {
                }
            }
            console.warn('[NHP] Removed expired gemini_web_task (TTL).');
            return { swept: true, reason: 'ttl' };
        }
        if (await isActiveGeminiWebTask(task)) {
            return { swept: false, reason: 'active_task' };
        }
        await chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
        console.warn('[NHP] Swept orphan gemini_web_task (no active Web bridge for this request).');
        return { swept: true, reason: 'orphan' };
    } catch (e) {
        console.warn('[NHP] sweepOrphanGeminiWebTaskStorage:', e?.message || e);
        return { swept: false, error: String(e?.message || e) };
    }
}

/**
 * When nothing is actively waiting in the service worker (no Web bridge, no AI image queue),
 * remove all inject-related local keys so Gemini/ChatGPT tabs never replay stale images.
 */
async function sweepIdleGeminiInjectStorage() {
    try {
        await loadPendingAiImageTasks();
        if (geminiWebBatchSessions.size > 0) {
            return { swept: false, reason: 'active_batch' };
        }
        const batchMeta = await chrome.storage.local.get(GEMINI_WEB_BATCH_STORAGE_KEY);
        if (batchMeta?.[GEMINI_WEB_BATCH_STORAGE_KEY]?.sessionId) {
            return { swept: false, reason: 'active_batch_storage' };
        }
        const pendingTaskData = await chrome.storage.local.get(GEMINI_WEB_TASK_STORAGE_KEY);
        const pendingTask = pendingTaskData?.[GEMINI_WEB_TASK_STORAGE_KEY];
        if (await isActiveGeminiWebTask(pendingTask)) {
            return { swept: false, reason: 'active_task' };
        }
        await sweepOrphanGeminiWebTaskStorage();
        if (geminiWebTaskResolvers.size > 0) {
            return { swept: false, reason: 'active_bridge' };
        }
        if (Array.isArray(pendingAiImageTasks) && pendingAiImageTasks.length > 0) {
            return { swept: false, reason: 'active_queue' };
        }
        // Protect freshly-set legacy payloads written by popup-driven Generate flows
        // (popup.js / studio modules). Without this guard, the sweep that runs as
        // soon as gemini-content.js loads would wipe the image + prompt before the
        // content script has a chance to consume them, silently breaking the send.
        const legacyData = await chrome.storage.local.get([
            'gemini_auto_trigger',
            'gemini_pending_image',
            'gemini_pending_prompt'
        ]);
        const triggerValue = legacyData?.gemini_auto_trigger;
        const triggerTimestamp = Number(triggerValue);
        const triggerHasTimestamp = Number.isFinite(triggerTimestamp) && triggerTimestamp > 1_000_000_000_000;
        const triggerAgeMs = triggerHasTimestamp ? (Date.now() - triggerTimestamp) : Number.POSITIVE_INFINITY;
        const isLegacyTriggerFresh = !!triggerValue && triggerAgeMs < AI_IMAGE_TASK_MAX_AGE_MS;
        const hasLegacyPayload = !!(
            (typeof legacyData?.gemini_pending_image === 'string' && legacyData.gemini_pending_image.length > 0)
            || (typeof legacyData?.gemini_pending_prompt === 'string' && String(legacyData.gemini_pending_prompt).trim().length > 0)
        );
        if (hasLegacyPayload && isLegacyTriggerFresh) {
            return { swept: false, reason: 'fresh_legacy_payload' };
        }
        await chrome.storage.local.remove([
            GEMINI_WEB_TASK_STORAGE_KEY,
            'gemini_auto_trigger',
            'gemini_pending_image',
            'gemini_pending_prompt'
        ]);
        console.warn('[NHP] Swept idle Gemini inject storage (no active bridge or image queue).');
        return { swept: true };
    } catch (e) {
        console.warn('[NHP] sweepIdleGeminiInjectStorage:', e?.message || e);
        return { swept: false, error: String(e?.message || e) };
    }
}

async function runGeminiWebTaskWithFallback({
    prompt,
    base64 = null,
    mimeType = 'image/png',
    mode = 'text',
    primaryUrl = GEMINI_SEO_GEM_URL,
    fallbackUrl = CHATGPT_SEO_GPT_URL
}) {
    try {
        const primaryResult = await runGeminiWebTask({ prompt, base64, mimeType, mode, url: primaryUrl });
        return { ...primaryResult, provider: 'gemini-primary' };
    } catch (primaryError) {
        console.warn('[AI Web Bridge] Primary provider failed, switching to fallback...', primaryError);
        if (!fallbackUrl || fallbackUrl === primaryUrl) {
            throw primaryError;
        }
        const fallbackResult = await runGeminiWebTask({ prompt, base64, mimeType, mode, url: fallbackUrl });
        return { ...fallbackResult, provider: 'chatgpt-fallback' };
    }
}

function serializeGeminiWebTaskForContent(task) {
    if (!task || typeof task !== 'object') return null;
    return {
        requestId: task.requestId || null,
        sessionId: task.sessionId || extractGeminiWebBatchSessionId(task) || null,
        batchIndex: task.batchIndex,
        batchTotal: task.batchTotal,
        itemId: task.itemId || null,
        prompt: task.prompt || '',
        imageData: task.imageData || null,
        mimeType: task.mimeType || 'image/png',
        mode: task.mode || 'text',
        chatRefreshEvery: task.chatRefreshEvery || SEO_GEMINI_CHAT_REFRESH_EVERY_DEFAULT,
        refreshChat: !!task.refreshChat,
        targetUrl: task.targetUrl || task.activeUrl || null,
        lowSpecMode: !!task.lowSpecMode,
        createdAt: task.createdAt || Date.now()
    };
}

function nudgeGeminiWebTabs(popupWindowId, requestId, taskMode = 'text', delays = [600, 2500, 6000, 10000, 16000]) {
    if (!popupWindowId || typeof popupWindowId !== 'number') return;
    delays.forEach((delayMs) => {
        setTimeout(async () => {
            try {
                const stored = await chrome.storage.local.get(GEMINI_WEB_TASK_STORAGE_KEY);
                const storedTask = stored?.[GEMINI_WEB_TASK_STORAGE_KEY];
                const taskPayload = (
                    storedTask
                    && String(storedTask.requestId || '') === String(requestId || '')
                )
                    ? serializeGeminiWebTaskForContent(storedTask)
                    : null;
                const tabs = await chrome.tabs.query({ windowId: popupWindowId }).catch(() => []);
                await Promise.all((tabs || []).map((tab) => tab?.id
                    ? chrome.tabs.sendMessage(tab.id, {
                        action: 'NHP_AI_TASK_READY',
                        requestId,
                        mode: taskMode || 'text',
                        task: taskPayload
                    }).catch(() => null)
                    : null));
            } catch (_) {
            }
        }, delayMs);
    });
}

function completeGeminiWebBatch(sessionId, provider = 'gemini-primary') {
    const session = geminiWebBatchSessions.get(sessionId);
    if (!session) return;
    clearTimeout(session.timeoutId);
    clearGeminiWebBatchItemWatchdog(session);
    geminiWebBatchSessions.delete(sessionId);
    chrome.storage.local.remove([
        GEMINI_WEB_BATCH_STORAGE_KEY,
        `${GEMINI_WEB_BATCH_PROGRESS_STORAGE_PREFIX}${sessionId}`
    ]).catch(() => {});
    session.resolve({
        success: true,
        results: session.results.slice(),
        provider: session.provider || provider
    });
}

function failGeminiWebBatch(sessionId, errorMessage) {
    const session = geminiWebBatchSessions.get(sessionId);
    if (!session) return;
    clearTimeout(session.timeoutId);
    clearGeminiWebBatchItemWatchdog(session);
    geminiWebBatchSessions.delete(sessionId);
    chrome.storage.local.remove([GEMINI_WEB_BATCH_STORAGE_KEY, GEMINI_WEB_TASK_STORAGE_KEY]).catch(() => {});
    session.reject(new Error(errorMessage || 'Gemini Web batch failed.'));
}

async function startGeminiWebBatchItem(sessionId, index) {
    const session = geminiWebBatchSessions.get(sessionId);
    if (!session) return;

    const item = session.items[index];
    if (!item) {
        completeGeminiWebBatch(sessionId);
        return;
    }

    const timingProfile = session.timingProfile || await getSeoBatchTimingProfile();
    session.timingProfile = timingProfile;

    session.pendingIndex = index;
    session.currentIndex = index;
    scheduleGeminiWebBatchItemWatchdog(sessionId, index, timingProfile);
    refreshGeminiWebBatchSessionTimeout(sessionId, timingProfile);

    const requestId = `${sessionId}_${index}`;
    const chatRefreshEvery = await getSeoGeminiChatRefreshEvery();
    const refreshChat = shouldRefreshSeoGeminiChat(index, chatRefreshEvery);
    const task = {
        requestId,
        sessionId,
        batchIndex: index,
        batchTotal: session.items.length,
        itemId: item.id || `item_${index}`,
        prompt: String(item.prompt || ''),
        imageData: item.base64 || item.imageData || null,
        mimeType: item.mimeType || 'image/png',
        mode: session.mode || 'text',
        chatRefreshEvery,
        refreshChat,
        targetUrl: session.activeUrl || GEMINI_SEO_GEM_URL,
        lowSpecMode: timingProfile.lowSpec,
        createdAt: Date.now(),
        reuseWindow: true
    };

    try {
        await chrome.storage.local.set({
            [GEMINI_WEB_TASK_STORAGE_KEY]: task,
            [GEMINI_WEB_BATCH_STORAGE_KEY]: {
                sessionId,
                currentIndex: index,
                total: session.items.length,
                activeUrl: session.activeUrl
            }
        });
    } catch (storageError) {
        throw new Error(`Failed to queue Gemini web task in storage: ${storageError?.message || storageError}`);
    }

    let targetWindowId = geminiWebWindowId;
    if (targetWindowId) {
        try {
            await chrome.windows.get(targetWindowId);
        } catch (_) {
            targetWindowId = null;
            geminiWebWindowId = null;
        }
    }

    if (!targetWindowId) {
        const popup = await openGeminiPopupWindow(session.activeUrl, index === 0);
        targetWindowId = popup?.id || null;
    } else {
        if (index > 0) {
            try {
                await chrome.windows.update(targetWindowId, { focused: false });
            } catch (_) {
            }
        }
        await ensureGeminiWindowOnUrl(targetWindowId, session.activeUrl, {
            waitMs: refreshChat ? timingProfile.tabLoadWaitMs : timingProfile.tabLoadWaitIdleMs
        });
    }

    if (!targetWindowId || typeof targetWindowId !== 'number') {
        throw new Error('Gemini popup was not created for batch item.');
    }

    if (refreshChat) {
        console.log(`[NHP][SEO Batch] Reloading SEO Gem at design ${index + 1} (every ${chatRefreshEvery}).`);
        await ensureGeminiWindowOnUrl(targetWindowId, session.activeUrl, { waitMs: timingProfile.tabLoadWaitMs });
    }

    let preInjectDelayMs = index > 0
        ? timingProfile.preInjectBaseMs + Math.min(index * timingProfile.preInjectExtraMs, timingProfile.preInjectCapMs)
        : timingProfile.preInjectFirstMs;
    if (refreshChat) {
        preInjectDelayMs += timingProfile.preInjectRefreshExtraMs;
    }
    await new Promise((resolve) => setTimeout(resolve, preInjectDelayMs));
    const nudgeDelays = timingProfile.lowSpec
        ? (index >= 8
            ? [1200, 4500, 10000, 18000, 28000, 42000, 60000, 85000, 115000]
            : [1200, 4000, 9000, 16000, 26000, 40000, 58000, 80000])
        : (index >= 10
            ? [600, 2000, 4500, 8000, 13000, 19000, 26000, 34000]
            : [600, 1800, 3500, 6000, 10000, 15000, 22000]);
    nudgeGeminiWebTabs(targetWindowId, requestId, task.mode || 'text', nudgeDelays);
}

async function advanceGeminiWebBatchAfterItem(req) {
    const sessionId = parseGeminiWebBatchSessionIdFromRequest(req.requestId, req.sessionId);
    let session = geminiWebBatchSessions.get(sessionId);
    if (!session) {
        session = await restoreGeminiWebBatchSession(sessionId);
    }
    if (!session) return false;

    if (!session.advanceChain) session.advanceChain = Promise.resolve();
    const runAdvance = async () => {
        clearGeminiWebBatchItemWatchdog(session);

        if (!session.processedIndices) session.processedIndices = {};
        if (!Number.isFinite(session.nextExpectedIndex)) {
            session.nextExpectedIndex = session.currentIndex || 0;
        }

        const parsedIndex = parseBatchIndexFromRequestId(req.requestId, sessionId);
        const index = Number.isFinite(parsedIndex)
            ? parsedIndex
            : (Number.isFinite(Number(req.batchIndex)) ? Number(req.batchIndex) : session.nextExpectedIndex);

        if (session.processedIndices[index]) {
            console.warn(`[NHP][SEO Batch] Duplicate result ignored for design ${index + 1}.`);
            return true;
        }

        const expected = session.nextExpectedIndex;
        if (index < expected) {
            console.warn(`[NHP][SEO Batch] Late capture for design ${index + 1} (queue at ${expected + 1}) ÔÇö saving to NHP.`);
            await recordGeminiWebBatchItemResult(session, sessionId, index, req);
            return true;
        }

        while (session.nextExpectedIndex < index) {
            const gapIndex = session.nextExpectedIndex;
            console.warn(`[NHP][SEO Batch] Filling gap for skipped design ${gapIndex + 1}.`);
            await recordGeminiWebBatchItemResult(session, sessionId, gapIndex, {
                success: false,
                text: '',
                error: 'Skipped ÔÇö previous design did not return a result in time.'
            });
            session.nextExpectedIndex = gapIndex + 1;
        }

        const itemResult = await recordGeminiWebBatchItemResult(session, sessionId, index, req);
        const nextIndex = index + 1;
        session.nextExpectedIndex = nextIndex;
        session.currentIndex = nextIndex;
        session.pendingIndex = null;

        try {
            await chrome.storage.local.set({
                [`${GEMINI_WEB_BATCH_PROGRESS_STORAGE_PREFIX}${sessionId}`]: {
                    sessionId,
                    currentIndex: nextIndex,
                    total: session.items.length,
                    results: session.results.slice(),
                    updatedAt: Date.now()
                }
            });
        } catch (_) {
        }

        const timingProfile = session.timingProfile || await getSeoBatchTimingProfile();
        session.timingProfile = timingProfile;
        refreshGeminiWebBatchSessionTimeout(sessionId, timingProfile);

        if (nextIndex >= session.items.length) {
            completeGeminiWebBatch(sessionId);
            return true;
        }

        if (!itemResult.success) {
            console.warn('[NHP] Batch item failed ÔÇö continuing with next design:', itemResult.error || 'unknown');
        }

        const gapMs = timingProfile.itemGapMs
            + Math.min(nextIndex * timingProfile.itemGapStepMs, timingProfile.lowSpec ? 10000 : 6000);
        await new Promise((resolve) => setTimeout(resolve, gapMs));
        await startGeminiWebBatchItem(sessionId, nextIndex);
        return true;
    };

    session.advanceChain = session.advanceChain.then(runAdvance, runAdvance);
    return session.advanceChain;
}

async function runGeminiWebBatchSession({
    items = [],
    primaryUrl = GEMINI_SEO_GEM_URL,
    fallbackUrl = CHATGPT_SEO_GPT_URL,
    mode = 'text'
}) {
    const normalizedItems = (Array.isArray(items) ? items : [])
        .map((item, index) => ({
            id: item?.id || `batch_${index}`,
            prompt: String(item?.prompt || ''),
            base64: item?.base64 || item?.imageData || null,
            mimeType: item?.mimeType || 'image/png'
        }))
        .filter((item) => item.prompt || item.base64);

    if (!normalizedItems.length) {
        throw new Error('Gemini Web batch has no valid items.');
    }

    const sessionId = `gwb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timingProfile = await getSeoBatchTimingProfile();
    const totalTimeoutMs = computeGeminiWebBatchTotalTimeoutMs(normalizedItems.length, timingProfile);

    return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            void handleGeminiWebBatchGlobalTimeout(sessionId);
        }, totalTimeoutMs);

        const sessionRecord = {
            items: normalizedItems,
            timingProfile,
            advanceChain: Promise.resolve(),
            currentIndex: 0,
            nextExpectedIndex: 0,
            pendingIndex: null,
            processedIndices: {},
            results: [],
            activeUrl: primaryUrl || GEMINI_SEO_GEM_URL,
            primaryUrl: primaryUrl || GEMINI_SEO_GEM_URL,
            fallbackUrl: fallbackUrl || CHATGPT_SEO_GPT_URL,
            mode: mode || 'text',
            provider: 'gemini-primary',
            triedFallback: false,
            resolve,
            reject,
            timeoutId
        };
        geminiWebBatchSessions.set(sessionId, sessionRecord);

        const persistBatchItems = chrome.storage.local.set({
            [`${GEMINI_WEB_BATCH_ITEMS_STORAGE_PREFIX}${sessionId}`]: normalizedItems.map((item) => ({
                id: item.id,
                prompt: item.prompt,
                mimeType: item.mimeType,
                base64: item.base64 || null,
                hasImage: !!item.base64
            }))
        }).catch(() => {});

        persistBatchItems.finally(() => {
        startGeminiWebBatchItem(sessionId, 0).catch((error) => {
            const session = geminiWebBatchSessions.get(sessionId);
            if (!session) {
                reject(error);
                return;
            }
            if (!session.triedFallback && session.fallbackUrl && session.fallbackUrl !== session.activeUrl) {
                session.triedFallback = true;
                session.activeUrl = session.fallbackUrl;
                session.provider = 'chatgpt-fallback';
                session.currentIndex = 0;
                session.results = [];
                startGeminiWebBatchItem(sessionId, 0).catch((fallbackError) => {
                    failGeminiWebBatch(sessionId, fallbackError?.message || error?.message || 'Gemini Web batch failed.');
                });
                return;
            }
            failGeminiWebBatch(sessionId, error?.message || 'Gemini Web batch failed.');
        });
        });
    });
}

async function startFullAutomationPipeline(providedNiches = []) {
    console.log("[Pipeline] Starting Full Automation...");
    const notifyTab = () => {};

    // Load Pipeline Toggles
    const settings = await getStorage(['pipeline-enable-analysis', 'pipeline-enable-tmhunt', 'pipeline-enable-uspto']);
    const enableTMH = settings['pipeline-enable-tmhunt'] !== false;
    const enableUSPTO = settings['pipeline-enable-uspto'] !== false;
    const enableTP = settings['pipeline-enable-analysis'] !== false;

    try {
        await importPersistentNicheMemory();
        await importPersistentNicheArchive();
        let niches = providedNiches;

        // 1. Fetch Trends (Only if not provided)
        if (!niches || niches.length === 0) {
            updatePipelineUI("fetching_trends", "Ï¼ÏºÏ▒┘è Ï¼┘äÏ¿ ÏúÏ¡Ï»Ï½ Ïº┘äÏ¬Ï▒┘åÏ»ÏºÏ¬ ┘à┘å ÏÁ┘üÏ¡Ï® TeePublic Ïº┘äÏ▒Ï│┘à┘èÏ®...");
            notifyTab('trend');
            let titles = [];
            try {
                titles = await fetchOfficialTrendTitlesBounded(3);
            } catch (error) {
                console.warn('[Pipeline] official trend fetch failed:', error.message);
            }
            if (!titles.length) {
                updatePipelineUI("error", "┘üÏ┤┘ä Ï¼┘äÏ¿ Ïº┘äÏ¬Ï▒┘åÏ»ÏºÏ¬ Ïú┘ê Ïº┘ä┘éÏºÏª┘àÏ® ┘üÏºÏ▒Ï║Ï®.");
                return;
            }
            niches = titles;
            await recordTrendSnapshot(niches, 'full_pipeline');
        } else {
            console.log(`[Pipeline] Using ${niches.length} niches provided by UI.`);
            updatePipelineUI("trend_ready", `Ï¬┘à ÏºÏ│Ï¬┘éÏ¿Ïº┘ä ${niches.length} ┘å┘èÏ┤ ┘à┘å Ïº┘ä┘êÏºÏ¼┘çÏ®...`);
        }

        let survivors = [...niches];

        // 2. TMHunt Analysis
        if (enableTMH) {
            updatePipelineUI("tmh_running", `Ï¼ÏºÏ▒┘è ┘üÏ¡ÏÁ ${survivors.length} ┘å┘èÏ┤ Ï╣Ï¿Ï▒ TMHunt...`);
            notifyTab('tmh');
            await setStorage({ tmh_searchStatus: 'RUNNING', tmh_safeNiches: [], tmh_restrictedNiches: [], tmh_processedCount: 0 });
            await startTMHSearchProcess(survivors);

            const tmhData = await getStorage(['tmh_safeNiches']);
            survivors = tmhData.tmh_safeNiches || [];

            if (survivors.length === 0) {
                updatePipelineUI("done", "Ïº┘âÏ¬┘à┘ä Ïº┘äÏ¿Ï¡Ï½: ┘äÏº Ï¬┘êÏ¼Ï» ┘å┘èÏ┤ÏºÏ¬ Ïó┘à┘åÏ® ┘ü┘è TMHunt.");
                return;
            }
        } else {
            console.log("[Pipeline] Skipping TMHunt Stage (Disabled in Admin)");
        }

        // 3. USPTO Analysis
        if (enableUSPTO) {
            const usptoSplit = await splitNichesWithTtlCache(survivors, {
                mode: 'uspto',
                allowedStatuses: ['safe', 'banned'],
            });
            if (usptoSplit.rememberedCount > 0) {
                updatePipelineUI("uspto_cache", `Recovered ${usptoSplit.rememberedCount} USPTO niches from local memory.`);
            }
            updatePipelineUI("uspto_running", `Running USPTO for ${usptoSplit.pending.length} new niches...`);
            notifyTab('uspto');
            await setStorage({
                uPending: usptoSplit.pending,
                uSafe: usptoSplit.buckets.safe || [],
                uBanned: usptoSplit.buckets.banned || [],
                uRunning: usptoSplit.pending.length > 0,
                uTotal: usptoSplit.totalUnique,
                uCurrent: null,
                [USPTO_IN_FLIGHT_KEY]: []
            });
            await persistUsptoBatchSnapshot('pipeline_uspto_start');
            if (usptoSplit.pending.length > 0) {
                uStopped = false;
                if (!isUSPTOProcessing) startUSPTOProcessing();
                else await ensureUSPTOFastWorkers();
                await waitForUsptoPipelineSettled();
            }

            const usptoData = await getStorage(['uSafe', 'uPending', 'uBanned', 'uErrors']);
            survivors = Array.isArray(usptoData.uSafe) ? usptoData.uSafe : [];
            updatePipelineUI(
                "uspto_done",
                `USPTO complete: ${survivors.length} safe, ${(usptoData.uBanned || []).length} banned, ${(usptoData.uErrors || []).length} errors.`
            );

            if (survivors.length === 0) {
                updatePipelineUI("done", "Ïº┘âÏ¬┘à┘ä Ïº┘äÏ¿Ï¡Ï½: ┘äÏº Ï¬┘êÏ¼Ï» ┘å┘èÏ┤ÏºÏ¬ Ïó┘à┘åÏ® ┘ü┘è USPTO.");
                return;
            }
        } else {
            console.log("[Pipeline] Skipping USPTO Stage (Disabled in Admin)");
        }

        // 4. TeePublic Competition Analysis
        if (enableTP) {
            const tpSplit = await splitNichesWithTtlCache(survivors, {
                mode: 'analysis',
                allowedStatuses: ['excel', 'med', 'sat'],
            });
            if (tpSplit.rememberedCount > 0) {
                updatePipelineUI("tp_cache", `Recovered ${tpSplit.rememberedCount} analysis niches from local memory.`);
            }
            updatePipelineUI("tp_running", `TeePublic Analysis received ${survivors.length} safe niches; ${tpSplit.pending.length} new, ${tpSplit.rememberedCount} cached.`);
            notifyTab('teepublic');
            await setStorage({
                tpPending: tpSplit.pending,
                tpExcel: tpSplit.buckets.excel || [],
                tpMed: tpSplit.buckets.med || [],
                tpSat: tpSplit.buckets.sat || [],
                tpEmp: tpSplit.buckets.emp || [],
                tpRunning: tpSplit.pending.length > 0,
                tpTotal: tpSplit.totalUnique,
                tpCurrent: null
            });
            if (tpSplit.pending.length > 0) {
                tpStopped = false;
                processTP();
                await waitForStatus('tpRunning', false);
            }

            const finalData = await getStorage(['tpExcel', 'tpMed']);
            const excel = finalData.tpExcel || [];
            const med = finalData.tpMed || [];

            // Transfer to Note Module
            updatePipelineUI("finalizing", "Ï¼ÏºÏ▒┘è ┘å┘é┘ä Ïº┘ä┘åÏ¬ÏºÏªÏ¼ Ïº┘ä┘à┘àÏ¬ÏºÏ▓Ï® ÏÑ┘ä┘ë Ïº┘ä┘à┘äÏºÏ¡Ï©ÏºÏ¬...");
            notifyTab('note');
            await transferResultsToNote(excel, med);
        } else {
            console.log("[Pipeline] Skipping TeePublic Stage (Disabled in Admin)");
            updatePipelineUI("finalizing", "Ï¼ÏºÏ▒┘è ┘å┘é┘ä Ï¼┘à┘èÏ╣ Ïº┘ä┘å┘èÏ┤ÏºÏ¬ Ïº┘äÏó┘à┘åÏ® ÏÑ┘ä┘ë Ïº┘ä┘à┘äÏºÏ¡Ï©ÏºÏ¬...");
            notifyTab('note');
            // If competition is skipped, assume all current survivors are targets
            await transferResultsToNote(survivors, []);
        }

        updatePipelineUI("done", "Ïº┘âÏ¬┘à┘äÏ¬ Ïº┘äÏúÏ¬┘àÏ¬Ï® Ïº┘äÏ┤Ïº┘à┘äÏ® Ï¿┘åÏ¼ÏºÏ¡! Ï▒ÏºÏ¼Ï╣ Ïº┘ä┘à┘äÏºÏ¡Ï©ÏºÏ¬.");
        chrome.runtime.sendMessage({ action: 'PIPELINE_COMPLETED_NOTIFY' }).catch(() => { });

    } catch (err) {
        console.error("[Pipeline] Error:", err);
        updatePipelineUI("error", "Ï¡Ï»Ï½ Ï«ÏÀÏú ┘ü┘è Ïº┘äÏúÏ¬┘àÏ¬Ï®: " + err.message);
    } finally {
        try {
            await flushDeferredRadarUnofficialPipelineItems();
        } catch (flushError) {
            console.warn('[RadarUnofficial] Deferred pipeline flush failed:', flushError.message);
        }
    }
}

async function transferResultsToNote(excelProvided = null, medProvided = null) {
    const data = await getStorage(['tpExcel', 'tpMed', 'teepublic_manager_data']);
    const excel = excelProvided || data.tpExcel || [];
    const med = medProvided || data.tpMed || [];
    const noteData = normalizeNoteDataPayload(data.teepublic_manager_data);

    const excelItems = excel.map(n => ({ id: 'nc_' + Math.random().toString(36).substr(2, 9), text: n, done: false, quality: 'excellent' }));
    const medItems = med.map(n => ({ id: 'nc_' + Math.random().toString(36).substr(2, 9), text: n, done: false, quality: 'average' }));

    const previousNiches = Array.isArray(noteData.niches) ? noteData.niches : [];
    const previousBatch = previousNiches
        .map(item => String(item?.text || '').trim())
        .filter(Boolean);
    if (previousBatch.length > 0) {
        const lastHistory = Array.isArray(noteData.history) && noteData.history.length > 0
            ? noteData.history[noteData.history.length - 1]
            : null;
        const previousKey = previousBatch.map(item => item.toLowerCase()).sort().join('|');
        const lastKey = Array.isArray(lastHistory?.niches)
            ? lastHistory.niches.map(item => String(item || '').trim().toLowerCase()).filter(Boolean).sort().join('|')
            : '';
        if (previousKey && previousKey !== lastKey) {
            noteData.history.push({
                timestamp: new Date().toLocaleString('ar-EG'),
                niches: previousBatch
            });
        }
    }

    const nextItems = [];
    const nextTexts = new Set();
    [...excelItems, ...medItems].forEach(item => {
        const key = item.text.toLowerCase();
        if (!nextTexts.has(key)) {
            nextItems.push(item);
            nextTexts.add(key);
        }
    });
    noteData.niches = nextItems;

    await setStorage({ teepublic_manager_data: noteData });
    const noteStageItems = [
        ...excel.map((text) => ({ text, status: 'queued', quality: 'excellent' })),
        ...med.map((text) => ({ text, status: 'queued', quality: 'average' }))
    ];
    if (noteStageItems.length > 0) {
        await recordArchiveStage(noteStageItems, 'note', 'note_transfer');
    }
}

function createRadarUnofficialIdleState() {
    return {
        status: 'idle',
        startedAt: null,
        finishedAt: null,
        currentLetter: null,
        currentSource: null,
        progress: { completed: 0, total: RADAR_UNOFFICIAL_LETTERS.length + RADAR_UNOFFICIAL_TREND_ENDPOINTS.length, percent: 0 },
        totalKeywords: 0,
        cleanKeywordCount: 0,
        failures: [],
        error: null,
        sourceSummary: { autocomplete: 0, htmlSources: 0 }
    };
}

function createRadarUnofficialAiIdleState() {
    return { status: 'idle', startedAt: null, finishedAt: null, error: null, usedSignals: 0 };
}

async function updateRadarUnofficialState(patch) {
    const data = await getStorage([RADAR_UNOFFICIAL_STORAGE_KEYS.state]);
    const current = data[RADAR_UNOFFICIAL_STORAGE_KEYS.state] || createRadarUnofficialIdleState();
    await setStorage({
        [RADAR_UNOFFICIAL_STORAGE_KEYS.state]: {
            ...createRadarUnofficialIdleState(),
            ...current,
            ...patch
        }
    });
}

async function getRadarUnofficialDashboardPayload() {
    const data = await getStorage(Object.values(RADAR_UNOFFICIAL_STORAGE_KEYS));
    return {
        state: data[RADAR_UNOFFICIAL_STORAGE_KEYS.state] || createRadarUnofficialIdleState(),
        aiState: data[RADAR_UNOFFICIAL_STORAGE_KEYS.aiState] || createRadarUnofficialAiIdleState(),
        results: data[RADAR_UNOFFICIAL_STORAGE_KEYS.results] || [],
        cleanResults: data[RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults] || [],
        aiIdeas: data[RADAR_UNOFFICIAL_STORAGE_KEYS.aiIdeas] || []
    };
}

async function radarUnofficialSaveToNote(req = {}) {
    const items = await radarUnofficialResolveSourceItems(req);
    if (!items.length) {
        throw new Error('No unofficial trend items are available to save.');
    }
    const result = await upsertRadarUnofficialNoteItems(items, {
        sourceType: req.sourceType || req.source || null,
        autoPipeline: false
    });
    return { count: result.updatedCount };
}

function isPipelineBusyStatus(status = '') {
    return Boolean(status) && !['idle', 'done', 'error'].includes(String(status).trim().toLowerCase());
}

async function enqueueDeferredRadarUnofficialPipelineItems(items = []) {
    const data = await getStorage([RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY]);
    const existing = Array.isArray(data[RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY]) ? data[RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY] : [];
    const merged = new Map();

    [...existing, ...items].forEach((item) => {
        const niche = String(item?.text || item?.keyword || item?.niche || '').trim();
        const nicheKey = normalizeNicheKey(niche);
        if (!nicheKey) return;
        merged.set(nicheKey, item);
    });

    const queue = Array.from(merged.values());
    await setStorage({ [RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY]: queue });
    return queue.length;
}

async function radarUnofficialQueueItemsToSharedPipeline(items = []) {
    if (!items.length) {
        return { sent: 0, pending: 0, alreadySafe: 0, alreadyBanned: 0, deferred: false };
    }

    await upsertRadarUnofficialNoteItems(items, {
        autoPipeline: true,
        usptoStatus: 'skipped',
        pipelineStage: 'analysis_queue'
    });

    const niches = items
        .map((item) => String(item.text || item.keyword || item.niche || '').trim())
        .filter(Boolean);
    const tpResult = await queueRadarUnofficialTpNiches(niches);

    return {
        sent: items.length,
        pending: tpResult.queued || 0,
        alreadySafe: 0,
        alreadyBanned: 0,
        deferred: false
    };
}

async function flushDeferredRadarUnofficialPipelineItems(force = false) {
    const data = await getStorage([RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY, 'pipeline_status']);
    const deferredItems = Array.isArray(data[RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY]) ? data[RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY] : [];
    if (!deferredItems.length) return { flushed: 0 };
    if (!force && isPipelineBusyStatus(data.pipeline_status)) return { flushed: 0, busy: true };

    await setStorage({ [RADAR_UNOFFICIAL_DEFERRED_PIPELINE_KEY]: [] });
    const result = await radarUnofficialQueueItemsToSharedPipeline(deferredItems);
    return { flushed: deferredItems.length, result };
}

async function radarUnofficialSendToPipeline(req = {}) {
    const items = await radarUnofficialResolveSourceItems(req);
    if (!items.length) {
        throw new Error('No unofficial trend items are available to send.');
    }

    const preparedItems = items.map((item) => ({
        ...item,
        sourceType: req.sourceType || req.source || item?.sourceType || null
    }));
    const pipelineState = await getStorage(['pipeline_status']);
    if (!req.skipDeferredCheck && isPipelineBusyStatus(pipelineState.pipeline_status)) {
        await upsertRadarUnofficialNoteItems(preparedItems, {
            sourceType: req.sourceType || req.source || null,
            autoPipeline: true,
            usptoStatus: 'queued',
            pipelineStage: 'pipeline_wait'
        });
        const deferredCount = await enqueueDeferredRadarUnofficialPipelineItems(preparedItems);
        return {
            sent: preparedItems.length,
            pending: 0,
            alreadySafe: 0,
            alreadyBanned: 0,
            deferred: true,
            deferredCount
        };
    }

    return radarUnofficialQueueItemsToSharedPipeline(preparedItems);
}

async function queueRadarUnofficialTpNiches(niches = []) {
    const cleanNiches = [...new Set((niches || []).map((item) => String(item || '').trim()).filter(Boolean))];
    if (!cleanNiches.length) {
        return { queued: 0, remembered: 0 };
    }

    const data = await getStorage(['tpPending', 'tpRunning', 'tpHistory']);
    const pending = Array.isArray(data.tpPending) ? [...data.tpPending] : [];
    const pendingKeys = new Set(pending.map(normalizeNicheKey));
    const history = data.tpHistory || {};
    const queued = [];
    const remembered = [];

    cleanNiches.forEach((niche) => {
        const nicheKey = normalizeNicheKey(niche);
        if (!nicheKey) return;
        if (history[nicheKey]) {
            remembered.push({ text: niche, analysisStatus: history[nicheKey], pipelineStage: 'analysis_done' });
            return;
        }
        if (!pendingKeys.has(nicheKey)) {
            pending.push(niche);
            pendingKeys.add(nicheKey);
            queued.push({ text: niche, analysisStatus: 'queued', pipelineStage: 'analysis_queue' });
        }
    });

    if (queued.length > 0) {
        await setStorage({ tpPending: pending, tpRunning: true, tpCurrent: null });
        tpStopped = false;
        if (!data.tpRunning) processTP();
    }

    if (queued.length > 0 || remembered.length > 0) {
        await upsertRadarUnofficialNoteItems([...queued, ...remembered], {
            autoPipeline: true,
            usptoStatus: 'safe'
        });
    }

    return { queued: queued.length, remembered: remembered.length };
}

async function upsertRadarUnofficialNoteItems(items = [], options = {}) {
    const data = await getStorage(['teepublic_manager_data']);
    const noteData = normalizeNoteDataPayload(data.teepublic_manager_data);
    const trendMap = new Map((noteData.unofficialTrends || []).map((item) => [normalizeNicheKey(item?.text), item]));
    let updatedCount = 0;

    items.forEach((rawItem) => {
        const prepared = radarUnofficialPrepareNoteItem(rawItem, options, trendMap.get(normalizeNicheKey(rawItem?.text || rawItem?.keyword || rawItem?.niche)));
        if (!prepared) return;
        trendMap.set(normalizeNicheKey(prepared.text), prepared);
        updatedCount += 1;
    });

    noteData.unofficialTrends = Array.from(trendMap.values()).sort((left, right) => {
        const leftScore = Number(left.todayScore || left.score || 0);
        const rightScore = Number(right.todayScore || right.score || 0);
        if (rightScore !== leftScore) return rightScore - leftScore;
        return String(left.text || '').localeCompare(String(right.text || ''));
    });
    await setStorage({ teepublic_manager_data: noteData });
    return { updatedCount, total: noteData.unofficialTrends.length };
}

function radarUnofficialPrepareNoteItem(rawItem, options = {}, existing = null) {
    const text = String(rawItem?.text || rawItem?.keyword || rawItem?.niche || '').trim();
    if (!text) return null;

    const now = new Date().toISOString();
    const sourceType = options.sourceType || rawItem?.sourceType || (rawItem?.niche ? 'ai_fusion' : rawItem?.todayScore ? 'today_signal' : 'raw_signal');
    const todayScore = Number.isFinite(rawItem?.todayScore) ? rawItem.todayScore : (Number.isFinite(existing?.todayScore) ? existing.todayScore : null);
    const score = Number.isFinite(rawItem?.score) ? rawItem.score : (Number.isFinite(existing?.score) ? existing.score : null);
    const blendFrom = Array.isArray(rawItem?.blendFrom) ? rawItem.blendFrom.filter(Boolean).slice(0, 4) : (Array.isArray(existing?.blendFrom) ? existing.blendFrom : []);
    const rawExamples = Array.isArray(rawItem?.rawExamples) ? rawItem.rawExamples.filter(Boolean).slice(0, 4) : (Array.isArray(existing?.rawExamples) ? existing.rawExamples : []);

    return {
        id: existing?.id || `ut_${Math.random().toString(36).slice(2, 11)}`,
        text,
        sourceType,
        label: rawItem?.label || existing?.label || null,
        score,
        todayScore,
        confidence: rawItem?.confidence || existing?.confidence || null,
        angle: rawItem?.angle || existing?.angle || null,
        whyNow: rawItem?.whyNow || existing?.whyNow || null,
        blendFrom,
        rawExamples,
        autoPipeline: options.autoPipeline ?? existing?.autoPipeline ?? false,
        usptoStatus: options.usptoStatus || rawItem?.usptoStatus || existing?.usptoStatus || null,
        analysisStatus: options.analysisStatus || rawItem?.analysisStatus || existing?.analysisStatus || null,
        pipelineStage: options.pipelineStage || rawItem?.pipelineStage || existing?.pipelineStage || 'saved',
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };
}

async function radarUnofficialResolveSourceItems(req = {}) {
    if (Array.isArray(req.items) && req.items.length > 0) {
        return req.items;
    }

    const sourceType = req.sourceType || req.source || 'clean';
    const data = await getStorage(Object.values(RADAR_UNOFFICIAL_STORAGE_KEYS));
    if (sourceType === 'ai') return Array.isArray(data[RADAR_UNOFFICIAL_STORAGE_KEYS.aiIdeas]) ? data[RADAR_UNOFFICIAL_STORAGE_KEYS.aiIdeas] : [];
    if (sourceType === 'raw') return Array.isArray(data[RADAR_UNOFFICIAL_STORAGE_KEYS.results]) ? data[RADAR_UNOFFICIAL_STORAGE_KEYS.results] : [];
    const clean = Array.isArray(data[RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults]) ? data[RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults] : [];
    if (clean.length > 0) return clean;
    return Array.isArray(data[RADAR_UNOFFICIAL_STORAGE_KEYS.results]) ? data[RADAR_UNOFFICIAL_STORAGE_KEYS.results] : [];
}

async function startRadarUnofficialScan() {
    const data = await getStorage([RADAR_UNOFFICIAL_STORAGE_KEYS.state]);
    const currentState = data[RADAR_UNOFFICIAL_STORAGE_KEYS.state] || createRadarUnofficialIdleState();
    if (currentState.status === 'running') {
        return { started: false, reason: 'already-running' };
    }

    const scoreMap = new Map();
    const failures = [];
    const sourceSummary = { autocomplete: 0, htmlSources: 0 };
    const totalSteps = RADAR_UNOFFICIAL_LETTERS.length + RADAR_UNOFFICIAL_TREND_ENDPOINTS.length;
    const startedAt = new Date().toISOString();
    let completedSteps = 0;

    await setStorage({
        [RADAR_UNOFFICIAL_STORAGE_KEYS.aiIdeas]: [],
        [RADAR_UNOFFICIAL_STORAGE_KEYS.aiState]: createRadarUnofficialAiIdleState(),
        [RADAR_UNOFFICIAL_STORAGE_KEYS.state]: {
            ...createRadarUnofficialIdleState(),
            status: 'running',
            startedAt,
            progress: radarUnofficialBuildProgress(0, totalSteps)
        }
    });

    try {
        for (const letter of RADAR_UNOFFICIAL_LETTERS) {
            await updateRadarUnofficialState({
                currentLetter: letter,
                currentSource: 'autocomplete',
                progress: radarUnofficialBuildProgress(completedSteps, totalSteps)
            });
            try {
                const suggestions = await radarUnofficialFetchAutocompleteSuggestions(letter);
                sourceSummary.autocomplete += radarUnofficialRegisterKeywords(scoreMap, suggestions, { source: 'autocomplete', weight: 5 });
                await updateRadarUnofficialState({ totalKeywords: scoreMap.size, sourceSummary: { ...sourceSummary } });
            } catch (error) {
                failures.push({ stage: 'autocomplete', token: letter, message: error.message || 'Autocomplete request failed.' });
                await updateRadarUnofficialState({ failures: failures.slice(-10) });
            }
            completedSteps += 1;
            await updateRadarUnofficialState({ progress: radarUnofficialBuildProgress(completedSteps, totalSteps) });
            if (completedSteps < totalSteps) {
                await radarUnofficialDelay(radarUnofficialRandomDelay(RADAR_UNOFFICIAL_MIN_DELAY_MS, RADAR_UNOFFICIAL_MAX_DELAY_MS));
            }
        }

        for (const endpoint of RADAR_UNOFFICIAL_TREND_ENDPOINTS) {
            await updateRadarUnofficialState({
                currentLetter: null,
                currentSource: endpoint.source,
                progress: radarUnofficialBuildProgress(completedSteps, totalSteps)
            });
            try {
                const html = await radarUnofficialFetchHtml(endpoint.url);
                const extracted = radarUnofficialExtractTrendHtmlKeywords(html);
                sourceSummary.htmlSources += radarUnofficialRegisterKeywords(scoreMap, extracted, endpoint);
                await updateRadarUnofficialState({ totalKeywords: scoreMap.size, sourceSummary: { ...sourceSummary } });
            } catch (error) {
                failures.push({ stage: endpoint.source, token: endpoint.url, message: error.message || 'HTML source failed.' });
                await updateRadarUnofficialState({ failures: failures.slice(-10) });
            }
            completedSteps += 1;
            await updateRadarUnofficialState({ progress: radarUnofficialBuildProgress(completedSteps, totalSteps) });
            if (completedSteps < totalSteps) {
                await radarUnofficialDelay(radarUnofficialRandomDelay(RADAR_UNOFFICIAL_MIN_DELAY_MS, RADAR_UNOFFICIAL_MAX_DELAY_MS));
            }
        }

        const results = radarUnofficialBuildSortedResults(scoreMap);
        const cleanResults = radarUnofficialBuildTodayLikelyResults(results);
        await setStorage({
            [RADAR_UNOFFICIAL_STORAGE_KEYS.results]: results,
            [RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults]: cleanResults,
            [RADAR_UNOFFICIAL_STORAGE_KEYS.state]: {
                status: 'completed',
                startedAt,
                finishedAt: new Date().toISOString(),
                currentLetter: null,
                currentSource: null,
                progress: radarUnofficialBuildProgress(totalSteps, totalSteps),
                totalKeywords: results.length,
                cleanKeywordCount: cleanResults.length,
                failures,
                error: null,
                sourceSummary
            }
        });
        return {
            started: true,
            totalKeywords: results.length,
            cleanKeywordCount: cleanResults.length,
            failures,
            sourceSummary
        };
    } catch (error) {
        await setStorage({
            [RADAR_UNOFFICIAL_STORAGE_KEYS.state]: {
                status: 'error',
                startedAt,
                finishedAt: new Date().toISOString(),
                currentLetter: null,
                currentSource: null,
                progress: radarUnofficialBuildProgress(completedSteps, totalSteps),
                totalKeywords: scoreMap.size,
                cleanKeywordCount: 0,
                failures,
                error: error.message || 'Unexpected scan failure.',
                sourceSummary
            }
        });
        throw error;
    }
}

async function generateRadarUnofficialAiIdeas() {
    const data = await getStorage([
        RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults,
        RADAR_UNOFFICIAL_STORAGE_KEYS.results,
        RADAR_UNOFFICIAL_STORAGE_KEYS.aiState
    ]);
    const currentState = data[RADAR_UNOFFICIAL_STORAGE_KEYS.aiState] || createRadarUnofficialAiIdleState();
    if (currentState.status === 'running') {
        return { started: false, reason: 'already-running' };
    }

    const cleanResults = Array.isArray(data[RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults]) ? data[RADAR_UNOFFICIAL_STORAGE_KEYS.cleanResults] : [];
    const rawResults = Array.isArray(data[RADAR_UNOFFICIAL_STORAGE_KEYS.results]) ? data[RADAR_UNOFFICIAL_STORAGE_KEYS.results] : [];
    const usableSignals = (cleanResults.length > 0 ? cleanResults : rawResults).slice(0, 18);
    if (!usableSignals.length) {
        throw new Error('Run the unofficial trend scan first so AI has live signals.');
    }

    const startedAt = new Date().toISOString();
    await setStorage({
        [RADAR_UNOFFICIAL_STORAGE_KEYS.aiState]: {
            status: 'running',
            startedAt,
            finishedAt: null,
            error: null,
            usedSignals: usableSignals.length
        }
    });

    try {
        const prompt = radarUnofficialBuildAiPrompt(usableSignals);
        const radarKey = await getInternalGeminiApiKey();
        if (!radarKey) {
            throw new Error('Gemini key is missing in local storage.');
        }
        const aiText = await radarUnofficialCallGeminiText(prompt, radarKey || RADAR_UNOFFICIAL_DEFAULT_GEMINI_API_KEY);
        const ideas = radarUnofficialNormalizeAiIdeas(aiText);
        if (!ideas.length) {
            throw new Error('AI returned no usable niche ideas.');
        }

        await setStorage({
            [RADAR_UNOFFICIAL_STORAGE_KEYS.aiIdeas]: ideas,
            [RADAR_UNOFFICIAL_STORAGE_KEYS.aiState]: {
                status: 'completed',
                startedAt,
                finishedAt: new Date().toISOString(),
                error: null,
                usedSignals: usableSignals.length
            }
        });
        return { started: true, count: ideas.length };
    } catch (error) {
        await setStorage({
            [RADAR_UNOFFICIAL_STORAGE_KEYS.aiState]: {
                status: 'error',
                startedAt,
                finishedAt: new Date().toISOString(),
                error: error.message || 'AI generation failed.',
                usedSignals: usableSignals.length
            }
        });
        throw error;
    }
}

async function queueRadarUnofficialScan() {
    const data = await getStorage([RADAR_UNOFFICIAL_STORAGE_KEYS.state]);
    const currentState = data[RADAR_UNOFFICIAL_STORAGE_KEYS.state] || createRadarUnofficialIdleState();
    if (currentState.status === 'running' || radarUnofficialScanPromise) {
        return { started: false, reason: 'already-running' };
    }

    radarUnofficialScanPromise = startRadarUnofficialScan()
        .catch((error) => {
            console.error('[Radar Unofficial] scan failed:', error);
            throw error;
        })
        .finally(() => {
            radarUnofficialScanPromise = null;
        });

    return { started: true };
}

async function queueRadarUnofficialAiGeneration() {
    const data = await getStorage([RADAR_UNOFFICIAL_STORAGE_KEYS.aiState]);
    const currentState = data[RADAR_UNOFFICIAL_STORAGE_KEYS.aiState] || createRadarUnofficialAiIdleState();
    if (currentState.status === 'running' || radarUnofficialAiPromise) {
        return { started: false, reason: 'already-running' };
    }

    radarUnofficialAiPromise = generateRadarUnofficialAiIdeas()
        .catch((error) => {
            console.error('[Radar Unofficial] AI generation failed:', error);
            throw error;
        })
        .finally(() => {
            radarUnofficialAiPromise = null;
        });

    return { started: true };
}

async function radarUnofficialFetchAutocompleteSuggestions(letter) {
    const response = await radarUnofficialFetchWithTimeout(
        `${RADAR_UNOFFICIAL_AUTOCOMPLETE_ENDPOINT}${encodeURIComponent(letter)}`,
        {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, text/html',
                'X-Requested-With': 'XMLHttpRequest'
            },
            cache: 'no-store',
            credentials: 'include',
            referrer: 'https://www.teepublic.com/'
        },
        RADAR_UNOFFICIAL_REQUEST_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching "${letter}"`);
    const bodyText = await response.text();
    if (!bodyText.trim()) return [];
    const parsed = radarUnofficialTryParseJson(bodyText);
    return parsed.parsed ? radarUnofficialExtractSuggestionsFromJsonPayload(parsed.value) : radarUnofficialExtractSuggestionsFromAutocompleteHtml(bodyText);
}

async function radarUnofficialFetchHtml(url) {
    const response = await radarUnofficialFetchWithTimeout(
        url,
        {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cache-Control': 'no-cache'
            },
            cache: 'no-store',
            credentials: 'include',
            referrer: 'https://www.teepublic.com/'
        },
        RADAR_UNOFFICIAL_REQUEST_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching HTML source`);
    return response.text();
}

async function radarUnofficialCallGeminiText(prompt, apiKey) {
    const response = await radarUnofficialFetchWithTimeout(
        `${RADAR_UNOFFICIAL_GEMINI_URL}?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        },
        30000
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) throw new Error('Gemini returned an empty response.');
    return aiText;
}

function radarUnofficialBuildAiPrompt(signals) {
    const signalLines = signals
        .map((item, index) => `${index + 1}. ${item.keyword || item.text || item.niche} | score=${item.todayScore || item.score || 0} | label=${item.label || 'live-signal'}`)
        .join('\n');
    return [
        'You are a senior Print on Demand niche strategist for TeePublic.',
        'Use the live TeePublic signals below to produce innovative niche ideas that feel timely right now.',
        'Blend compatible signals when useful, but do not copy the raw inputs as-is.',
        'Avoid direct copyrighted title reuse whenever possible. Turn raw signals into safer, broader niche directions.',
        'Return strict JSON only with this shape:',
        '{',
        '  "ideas": [',
        '    {"niche":"2 to 6 words","angle":"1 short sentence","whyNow":"1 short sentence","blendFrom":["signal one","signal two"],"confidence":"High or Medium"}',
        '  ]',
        '}',
        'Create 12 ideas.',
        'Live signals:',
        signalLines
    ].join('\n');
}

function radarUnofficialNormalizeAiIdeas(aiText) {
    const parsed = radarUnofficialExtractJsonFromText(aiText);
    const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
    return ideas
        .map((idea) => ({
            niche: radarUnofficialNormalizePhrase(idea?.niche),
            angle: radarUnofficialNormalizeSentence(idea?.angle),
            whyNow: radarUnofficialNormalizeSentence(idea?.whyNow),
            blendFrom: Array.isArray(idea?.blendFrom) ? idea.blendFrom.map(radarUnofficialNormalizePhrase).filter(Boolean).slice(0, 3) : [],
            confidence: String(idea?.confidence || '').toLowerCase() === 'high' ? 'High' : 'Medium'
        }))
        .filter((idea) => idea.niche && idea.angle && idea.whyNow)
        .slice(0, 12);
}

function radarUnofficialExtractJsonFromText(text) {
    const direct = radarUnofficialTryParseJson(text);
    if (direct.parsed) return direct.value;
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return {};
    const wrapped = radarUnofficialTryParseJson(match[0]);
    return wrapped.parsed ? wrapped.value : {};
}

function radarUnofficialTryParseJson(text) {
    try {
        return { parsed: true, value: JSON.parse(text) };
    } catch (_error) {
        return { parsed: false, value: null };
    }
}

function radarUnofficialExtractSuggestionsFromJsonPayload(payload) {
    const suggestions = [];
    if (Array.isArray(payload)) {
        payload.forEach((item) => radarUnofficialCollectSuggestionValues(item, suggestions));
        return suggestions;
    }
    if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.suggestions)) {
            payload.suggestions.forEach((item) => radarUnofficialCollectSuggestionValues(item, suggestions));
            return suggestions;
        }
        Object.values(payload).forEach((item) => radarUnofficialCollectSuggestionValues(item, suggestions));
    }
    return suggestions;
}

function radarUnofficialCollectSuggestionValues(value, bucket) {
    if (!value) return;
    if (typeof value === 'string') {
        const normalized = radarUnofficialNormalizeRawKeyword(value);
        if (normalized) bucket.push(normalized);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => radarUnofficialCollectSuggestionValues(item, bucket));
        return;
    }
    if (typeof value === 'object') {
        ['value', 'term', 'query', 'text', 'name', 'title'].forEach((key) => {
            if (typeof value[key] === 'string') {
                const normalized = radarUnofficialNormalizeRawKeyword(value[key]);
                if (normalized) bucket.push(normalized);
            }
        });
        Object.values(value).forEach((item) => radarUnofficialCollectSuggestionValues(item, bucket));
    }
}

function radarUnofficialExtractSuggestionsFromAutocompleteHtml(htmlText) {
    const documentRoot = radarUnofficialParseHtml(htmlText);
    const candidates = [];
    if (documentRoot) {
        documentRoot.querySelectorAll('li, a, span, div, option').forEach((node) => {
            const text = radarUnofficialNormalizeRawKeyword(node.textContent || '');
            if (text) candidates.push(text);
        });
    } else {
        htmlText
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, '\n')
            .split('\n')
            .map(radarUnofficialNormalizeRawKeyword)
            .filter(Boolean)
            .forEach((text) => candidates.push(text));
    }
    return candidates.filter((item) => !radarUnofficialLooksLikeJsonPayload(item));
}

function radarUnofficialExtractTrendHtmlKeywords(htmlText) {
    const keywords = [];
    const documentRoot = radarUnofficialParseHtml(htmlText);
    if (documentRoot) {
        documentRoot.querySelectorAll('.trending-tag a, .trending-tags a, .design-tile__tags a, .m-tile__tags a, a[href*="/t-shirt/"], img[alt*="T-Shirt"]').forEach((node) => {
            const altText = node.getAttribute?.('alt');
            const href = node.getAttribute?.('href');
            const text = radarUnofficialNormalizeRawKeyword(node.textContent || altText || '');
            if (text) keywords.push(text);
            const hrefKeyword = radarUnofficialNormalizeHrefKeyword(href);
            if (hrefKeyword) keywords.push(hrefKeyword);
        });
    }
    const tagRegex = /<a[^>]*href="\/t-shirt\/([^"]+)"[^>]*>([^<]+)<\/a>|class="trending-tag"[^>]*>([^<]+)<\/a>|alt="([^"]+) T-Shirt"/gi;
    let match;
    while ((match = tagRegex.exec(htmlText)) !== null) {
        const raw = match[1] || match[2] || match[3] || match[4] || '';
        const normalized = radarUnofficialNormalizeRawKeyword(raw.replace(/-/g, ' '));
        if (normalized) keywords.push(normalized);
    }
    return keywords;
}

function radarUnofficialParseHtml(htmlText) {
    if (typeof DOMParser === 'undefined') return null;
    try {
        return new DOMParser().parseFromString(htmlText, 'text/html');
    } catch (_error) {
        return null;
    }
}

function radarUnofficialNormalizeHrefKeyword(href) {
    if (!href || !href.includes('/t-shirt/')) return '';
    try {
        return radarUnofficialNormalizeRawKeyword((href.split('/t-shirt/')[1] || '').split('?')[0].split('/')[0].replace(/-/g, ' '));
    } catch (_error) {
        return '';
    }
}

function radarUnofficialRegisterKeywords(scoreMap, rawKeywords, sourceConfig) {
    const uniqueKeywords = [...new Set((rawKeywords || []).map(radarUnofficialNormalizeRawKeyword).filter(Boolean))];
    let accepted = 0;
    uniqueKeywords.forEach((keyword) => {
        const existing = scoreMap.get(keyword) || { keyword, score: 0, sources: new Set(), hits: 0 };
        existing.score += sourceConfig.weight;
        existing.sources.add(sourceConfig.source);
        existing.hits += 1;
        scoreMap.set(keyword, existing);
        accepted += 1;
    });
    return accepted;
}

function radarUnofficialBuildSortedResults(scoreMap) {
    return [...scoreMap.values()]
        .map((item) => ({ keyword: item.keyword, score: item.score, hits: item.hits, sources: [...item.sources].sort() }))
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            if (right.hits !== left.hits) return right.hits - left.hits;
            return left.keyword.localeCompare(right.keyword);
        });
}

function radarUnofficialBuildTodayLikelyResults(rawResults) {
    const grouped = new Map();
    (rawResults || []).forEach((item) => {
        const profile = radarUnofficialBuildCleanProfile(item);
        if (!profile.keep || !profile.canonical) return;
        const existing = grouped.get(profile.canonical) || {
            keyword: profile.canonical,
            score: 0,
            hits: 0,
            todayScore: 0,
            label: 'Watchlist',
            sources: new Set(),
            rawExamples: []
        };
        existing.score += item.score;
        existing.hits += item.hits;
        (item.sources || []).forEach((source) => existing.sources.add(source));
        if (!existing.rawExamples.includes(item.keyword) && existing.rawExamples.length < 3) {
            existing.rawExamples.push(item.keyword);
        }
        grouped.set(profile.canonical, existing);
    });
    return [...grouped.values()]
        .map((item) => radarUnofficialFinalizeCleanItem(item))
        .filter((item) => item.todayScore >= 45)
        .sort((left, right) => {
            if (right.todayScore !== left.todayScore) return right.todayScore - left.todayScore;
            if (right.score !== left.score) return right.score - left.score;
            return left.keyword.localeCompare(right.keyword);
        })
        .slice(0, 30);
}

function radarUnofficialBuildCleanProfile(item) {
    const raw = String(item.keyword || '').trim().toLowerCase();
    if (!raw || RADAR_UNOFFICIAL_HARD_NOISE_PHRASES.has(raw)) return { keep: false, canonical: '' };
    const normalized = raw.replace(/[\/|]/g, ' ').replace(/-/g, ' ').replace(/[^a-z0-9\s']/gi, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(Boolean);
    if (words.length < 2) return { keep: false, canonical: '' };
    const strongWords = words.filter((word) => !RADAR_UNOFFICIAL_CLEAN_STOP_WORDS.has(word) && !/^\d{4}$/.test(word));
    const canonicalWords = strongWords.filter((word) => !RADAR_UNOFFICIAL_VARIANT_TERMS.has(word));
    const finalWords = (canonicalWords.length >= 2 ? canonicalWords : strongWords).slice(0, 5);
    const canonical = finalWords.join(' ').trim();
    if (!canonical || canonical.length < 4) return { keep: false, canonical: '' };
    const tooGeneric = finalWords.length <= 2 && finalWords.some((word) => ['staff', 'picks', 'pick', 'theme', 'pattern', 'logo', 'decorations'].includes(word));
    return tooGeneric ? { keep: false, canonical: '' } : { keep: true, canonical };
}

function radarUnofficialFinalizeCleanItem(item) {
    const sourceCount = item.sources.size;
    const wordCount = item.keyword.split(' ').length;
    const hasAutocomplete = item.sources.has('autocomplete');
    const hasTrendPage = item.sources.has('trend-page') || item.sources.has('tag-directory');
    const hasLiveSort = item.sources.has('popular-page') || item.sources.has('newest-page');
    let todayScore = item.score * 8 + item.hits * 6 + sourceCount * 10;
    if (hasAutocomplete) todayScore += 14;
    if (hasTrendPage) todayScore += 10;
    if (hasLiveSort) todayScore += 8;
    if (wordCount >= 2 && wordCount <= 4) todayScore += 12;
    else if (wordCount === 5) todayScore += 5;
    else if (wordCount > 5) todayScore -= 8;
    if (item.rawExamples.some((example) => example.length > 55)) todayScore -= 6;
    if (RADAR_UNOFFICIAL_HARD_NOISE_PHRASES.has(item.keyword)) todayScore -= 50;
    const clamped = Math.max(0, Math.min(todayScore, 100));
    const label = clamped >= 72 ? 'Hot today likely' : clamped >= 55 ? 'Rising now' : 'Watchlist';
    return {
        keyword: item.keyword,
        score: item.score,
        hits: item.hits,
        todayScore: clamped,
        label,
        sourceCount,
        sources: [...item.sources].sort(),
        rawExamples: item.rawExamples
    };
}

function radarUnofficialNormalizeRawKeyword(value) {
    const clean = String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\bT-Shirt\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    if (
        !clean ||
        radarUnofficialLooksLikeJsonPayload(clean) ||
        clean.length < 2 ||
        clean.length > 80 ||
        /^[a-z]$/.test(clean) ||
        /^[\[{].*[\]}]$/.test(clean) ||
        /^(search|suggestions|autocomplete|all results|view all|shop now)$/i.test(clean) ||
        RADAR_UNOFFICIAL_RAW_IGNORE_TERMS.has(clean) ||
        !/[a-z0-9]/i.test(clean)
    ) {
        return '';
    }
    return clean;
}

function radarUnofficialNormalizePhrase(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function radarUnofficialNormalizeSentence(value) {
    return radarUnofficialNormalizePhrase(value).slice(0, 180);
}

function radarUnofficialLooksLikeJsonPayload(text) {
    return /"suggestions"\s*:|"explain"\s*:|^\{.*\}$|^\[.*\]$/.test(String(text || ''));
}

function radarUnofficialBuildProgress(completed, total) {
    const safeCompleted = Math.max(0, Math.min(completed, total));
    return { completed: safeCompleted, total, percent: total === 0 ? 0 : Math.round((safeCompleted / total) * 100) };
}

function radarUnofficialRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function radarUnofficialDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function radarUnofficialFetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') throw new Error(`Timed out after ${timeoutMs}ms`);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function waitForStatus(key, targetValue) {
    return new Promise(resolve => {
        const check = async () => {
            const data = await getStorage([key]);
            if (data[key] === targetValue) resolve();
            else setTimeout(check, 3000);
        };
        check();
    });
}

async function waitForUsptoPipelineSettled(timeoutMs = 20 * 60 * 1000) {
    const startedAt = Date.now();
    let lastSafeCount = -1;
    let stableReads = 0;

    while ((Date.now() - startedAt) < timeoutMs) {
        const data = await getStorage(['uRunning', 'uPending', 'uSafe', 'uBanned', 'uErrors', USPTO_FAST_WORKER_ACTIVE_KEY]);
        const pendingCount = Array.isArray(data.uPending) ? data.uPending.length : 0;
        const safeCount = Array.isArray(data.uSafe) ? data.uSafe.length : 0;
        const activeWorkers = Number(data[USPTO_FAST_WORKER_ACTIVE_KEY] || 0);
        const settled = data.uRunning === false && pendingCount === 0 && activeWorkers === 0;

        if (settled) {
            if (safeCount === lastSafeCount) stableReads += 1;
            else stableReads = 0;
            lastSafeCount = safeCount;
            if (stableReads >= 1) return data;
        }

        await delay(1200);
    }

    return await getStorage(['uRunning', 'uPending', 'uSafe', 'uBanned', 'uErrors', USPTO_FAST_WORKER_ACTIVE_KEY]);
}

function updatePipelineUI(status, log) {
    chrome.storage.local.set({ pipeline_status: status, pipeline_log: log, tmh_progressStatus: log });
}

// --- HEARTBEAT ENGINE (MV3 Anti-Sleep) ---
//  HEARTBEAT ENGINE (MV3 Anti-Sleep)

let _heartbeatTimer = null;
let _heartbeatPort = null;

async function startHeartbeat() {
    if (_heartbeatTimer) return;
    console.log('[Heartbeat] Started; service worker will stay alive.');
    // ├â╦£├é┬Â├âÔäó├óÔé¼┬ª├â╦£├é┬º├âÔäó├óÔé¼┬á ├âÔäó├é┬ü├â╦£├é┬¬├â╦£├é┬¡ ├â╦£├é┬º├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬á├â╦£├é┬º├âÔäó├é┬ü├â╦£├é┬░├â╦£├é┬® ├â╦£├é┬º├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬ª├â╦£├é┬«├âÔäó├é┬ü├âÔäó├à┬á├â╦£├é┬® ├âÔäó├óÔé¼┼¥├â╦£├é┬¬├â╦£├é┬╣├âÔäó├óÔé¼┬ª├âÔäó├óÔé¼┼¥ ├âÔäó├åÔÇÖ├â╦£├é┬»├â╦£├é┬▒├â╦£├é┬╣ ├âÔäó├ïÔÇá├â╦£├é┬º├âÔäó├óÔé¼┼í├âÔäó├à┬á ├âÔäó├óÔé¼┬ª├âÔäó├óÔé¼┬á ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬Ñ├â╦£├é┬║├âÔäó├óÔé¼┼¥├â╦£├é┬º├âÔäó├óÔé¼┼í
    await setupOffscreenDocument('offscreen.html').catch(() => {});
    
    _heartbeatTimer = setInterval(() => {
        if (!_heartbeatPort) {
            try {
                _heartbeatPort = chrome.runtime.connect({ name: NHP_BACKGROUND_PORTS.heartbeat });
                _heartbeatPort.onDisconnect.addListener(() => { _heartbeatPort = null; });
            } catch (e) {
                console.warn('[Heartbeat] port connect failed:', e?.message || e);
            }
        }
        if (_heartbeatPort) {
            try {
                _heartbeatPort.postMessage({ action: 'ping', service: 'nhp-emailcore-lite', ts: Date.now() });
            } catch (e) {
                console.warn('[Heartbeat] ping failed:', e?.message || e);
                _heartbeatPort = null;
            }
        }

        chrome.runtime.getPlatformInfo().then(() => {
            chrome.storage.local.set({ apHeartbeat: Date.now() });
        }).catch((error) => {
            console.warn('[Heartbeat] platform check failed:', error?.message || error);
        });
    }, 20000 + Math.floor(Math.random() * 750));
}

function stopHeartbeat() {
    if (_heartbeatTimer) {
        clearInterval(_heartbeatTimer);
        _heartbeatTimer = null;
        console.log('[Heartbeat] Stopped.');
    }
}

async function loadNhpStartupBatTemplateText() {
    const templateUrl = chrome.runtime.getURL('NHP_Start_All_Servers.bat.template');
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Bat template fetch failed (${response.status})`);
    return response.text();
}

async function buildNhpStartupScriptText(format) {
    const fmt = format === 'sh' ? 'sh' : 'bat';
    let templateError = null;
    const pathForShell = await ensureNhpProjectDirResolved();

    try {
        if (fmt === 'bat') {
            const raw = await loadNhpStartupBatTemplateText();
            return { text: raw.replace(/__NHP_ROOT__/g, pathForShell), source: 'extension' };
        }
        const templateUrl = chrome.runtime.getURL('startup-script-templates.json');
        const response = await fetch(templateUrl);
        if (!response.ok) {
            templateError = new Error(`Template fetch failed (${response.status}). Reload the extension from chrome://extensions`);
        } else {
            const templates = await response.json();
            const raw = templates.sh;
            if (!raw) throw new Error('Missing startup script template.');
            const shRoot = String(pathForShell || '').replace(/\\/g, '/');
            return { text: raw.replace(/__NHP_ROOT__/g, shRoot), source: 'extension' };
        }
    } catch (error) {
        templateError = error;
    }

    try {
        const bridgeUrl = `${getAiBridgeServerUrl()}/addon/nhp-start-all-servers.${fmt}`;
        const response = await fetch(bridgeUrl, { cache: 'no-store' });
        const contentType = String(response.headers.get('content-type') || '');
        if (response.ok && !contentType.includes('application/json')) {
            const text = await response.text();
            if (fmt === 'bat' && !text.includes('@echo off')) {
                throw new Error('Invalid startup script from AI Bridge.');
            }
            if (fmt === 'sh' && !text.includes('#!/')) {
                throw new Error('Invalid startup script from AI Bridge.');
            }
            return { text, source: 'bridge' };
        }
        if (!response.ok) {
            templateError = templateError || new Error(`AI Bridge error (${response.status}). Start port 3031 or reload the extension.`);
        }
    } catch (error) {
        templateError = templateError || error;
    }

    throw templateError || new Error('Unable to build startup script.');
}

function nhpStartupScriptFilename(format) {
    return format === 'sh' ? 'NHP_Start_All_Servers.sh' : 'NHP_Start_All_Servers.bat';
}

function chromeDownloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download({
            url,
            filename,
            saveAs: false,
            conflictAction: 'uniquify'
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(downloadId);
        });
    });
}

async function downloadNhpStartupScript(format) {
    const ext = format === 'sh' ? 'sh' : 'bat';
    const filename = nhpStartupScriptFilename(ext);

    if (ext === 'bat' || ext === 'sh') {
        try {
            const bridgeUrl = `${getAiBridgeServerUrl()}/addon/nhp-start-all-servers.${ext}`;
            const probe = await fetch(bridgeUrl, { cache: 'no-store' });
            const contentType = String(probe.headers.get('content-type') || '');
            if (probe.ok && !contentType.includes('application/json')) {
                const downloadId = await chromeDownloadFile(bridgeUrl, filename);
                return { success: true, downloadId, filename, source: 'bridge' };
            }
        } catch (_) { /* fallback below */ }
    }

    const { text, source } = await buildNhpStartupScriptText(format);
    const mime = ext === 'sh' ? 'application/x-sh' : 'application/x-msdownload';
    const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
    const downloadId = await chromeDownloadFile(dataUrl, filename);
    return { success: true, downloadId, filename, source };
}

// --- MESSAGE ROUTER (SINGLE LISTENER FOR MV3) ---
let creatingOffscreen;
async function setupOffscreenDocument(path) {
    if (await chrome.offscreen.hasDocument()) return;
    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_PARSER'],
            justification: 'Parse DOM for MerchGhost'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }
}

function backgroundArrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    try {
        if (!req || typeof req !== 'object') return false;
    } catch (error) {
        console.warn('[NHP] invalid runtime message recovered:', nhpSafeErrorMessage(error));
        try { sendResponse({ success: false, error: 'Invalid runtime message' }); } catch (_) { }
        return false;
    }

    if (req.action === 'PING') {
        const oracleInstance = (typeof NHP_ORACLE_INSTANCE !== 'undefined' && NHP_ORACLE_INSTANCE) ? NHP_ORACLE_INSTANCE : null;
        sendResponse({
            success: true,
            status: 'ok',
            service: 'background',
            ts: Date.now(),
            oracleProfile: oracleInstance?.profile || null,
            oracleLabel: oracleInstance?.label || null,
            multiInstance: oracleInstance?.multiInstance === true
        });
        return true;
    }

    if (req.action === 'get_nhp_runtime_config') {
        (async () => {
            if (typeof NhpRuntimeConfig !== 'undefined') {
                await NhpRuntimeConfig.loadFromStorage();
            }
            sendResponse({
                success: true,
                config: typeof NhpRuntimeConfig !== 'undefined' ? NhpRuntimeConfig.getCached() : null,
                urls: {
                    ghost: getGhostServerUrl(),
                    aiBridge: getAiBridgeServerUrl(),
                    cliproxy: getDefaultCliProxyBaseUrl(),
                    manager: nhpUrl(3009),
                    chromeDebug: nhpUrl(9331, '/json/version')
                }
            });
        })();
        return true;
    }

    if (req.action === 'set_nhp_runtime_config') {
        (async () => {
            if (typeof NhpRuntimeConfig === 'undefined') {
                sendResponse({ success: false, error: 'Runtime config module not loaded' });
                return;
            }
            const patch = req.config && typeof req.config === 'object' ? req.config : {};
            const next = await NhpRuntimeConfig.saveToStorage({
                backendMode: 'windows',
                localHost: patch.localHost,
                projectDir: patch.projectDir,
                proxyBaseUrl: patch.proxyBaseUrl
                    ? NhpRuntimeConfig.migrateProxyBaseUrlForHost(patch.proxyBaseUrl)
                    : undefined
            });
            sendResponse({ success: true, config: next });
        })();
        return true;
    }

    if (req.action === 'detect_nhp_wsl_host') {
        sendResponse({
            success: false,
            host: '127.0.0.1',
            hint: 'Ï¬┘à Ï¬Ï╣ÏÀ┘è┘ä Ïº┘âÏ¬Ï┤Ïº┘ü WSL. Ïº┘ä┘êÏÂÏ╣ Ïº┘ä┘àÏ╣Ï¬┘àÏ» ┘ç┘ê Windows Ïº┘ä┘àÏ¡┘ä┘è (127.0.0.1).'
        });
        return false;
    }

    if (req.action === 'fetch_json' || req.action === 'fetch_blob') {
        (async () => {
            try {
                const url = String(req.url || '');
                if (!/^https?:\/\//i.test(url)) {
                    throw new Error('Invalid fetch URL.');
                }

                const response = await fetch(url, {
                    method: req.method || 'GET',
                    headers: req.headers || {},
                    body: req.body ? JSON.stringify(req.body) : undefined
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    sendResponse({
                        success: false,
                        status: response.status,
                        error: errorText || response.statusText || 'Fetch failed.'
                    });
                    return;
                }

                if (req.action === 'fetch_blob') {
                    const buffer = await response.arrayBuffer();
                    sendResponse({
                        success: true,
                        status: response.status,
                        base64: backgroundArrayBufferToBase64(buffer),
                        contentType: response.headers.get('content-type') || ''
                    });
                    return;
                }

                sendResponse({
                    success: true,
                    status: response.status,
                    data: await response.json()
                });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Background fetch failed.' });
            }
        })();
        return true;
    }

    if (req.action === 'GET_NHP_DIAGNOSTIC_LOGS') {
        const recent = nhpDiagnosticLogs.slice(-120);
        if (req.clear === true) nhpDiagnosticLogs.length = 0;
        sendResponse({
            success: true,
            service: 'background',
            count: recent.length,
            logs: recent
        });
        return true;
    }

    if (req.action === 'NHP_CONTEXT_IMAGE_CROP_READY') {
        (async () => {
            const requestId = String(req.requestId || '');
            const storedCrop = requestId
                ? (await chrome.storage.session.get(requestId))[requestId]
                : null;

            if (!storedCrop) {
                sendResponse({ success: false, error: 'No stored crop request found.' });
                return;
            }

            await chrome.storage.session.remove(requestId);

            if (!req.selection || req.selection.cancelled) {
                sendResponse({ success: true, cancelled: true });
                return;
            }

            try {
                const croppedDataUrl = await screenCropVisibleCapture(storedCrop.capturedImage, req.selection);
                await launchAiImagePopupWithPayload({
                    dataUrl: croppedDataUrl,
                    nicheName: storedCrop.nicheName || 'Trending Topic',
                    targetUrl: storedCrop.targetUrl || GEMINI_IMAGE_GEM_URL
                });
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Failed to crop and send image.' });
            }
        })();
        return true;
    }

    if (req.action === 'CAN_CLAIM_AI_IMAGE_TASK') {
        (async () => {
            await loadPendingAiImageTasks();
            const task = findClaimableAiImageTaskForSender(sender);
            sendResponse({ success: true, canClaim: !!task, taskId: task?.id || null });
        })();
        return true;
    }

    if (req.action === 'CLAIM_PENDING_AI_IMAGE_TASK') {
        (async () => {
            const task = await takePendingAiImageTask(sender);
            // Do not clear gemini_auto_trigger here: popup / legacy flow stores payload in
            // gemini_pending_* without enqueueing; gemini-content clears keys after inject.

            sendResponse({ success: true, task });
        })();
        return true;
    }

    if (req.action === 'CLEAR_PENDING_AI_IMAGE_TASK') {
        (async () => {
            await loadPendingAiImageTasks();
            const taskId = String(req.taskId || '');
            if (taskId) {
                pendingAiImageTasks = pendingAiImageTasks.filter((task) => task?.id !== taskId);
            } else {
                pendingAiImageTasks = [];
            }
            await savePendingAiImageTasks();
            if (!pendingAiImageTasks.length) {
                try { chrome.storage.local.remove('gemini_auto_trigger'); } catch (_) {}
            }
            sendResponse({ success: true });
        })();
        return true;
    }

    if (req.action === 'MARK_PENDING_AI_IMAGE_TASK_STAGE') {
        (async () => {
            const taskId = String(req.taskId || '');
            const stage = String(req.stage || '');
            if (!taskId || !stage) {
                sendResponse({ success: false, error: 'Missing task id or stage.' });
                return;
            }
            const matched = await markPendingAiImageTaskStage(taskId, stage, {
                error: req.error || null
            });
            sendResponse({ success: true, matched });
        })();
        return true;
    }

    if (req.action === 'RETRY_LAST_AI_IMAGE_TASK') {
        (async () => {
            await loadPendingAiImageTasks();
            const task = [...pendingAiImageTasks]
                .filter((item) => item && item.imageData && item.stage !== 'image_attached' && item.stage !== 'done')
                .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
            if (!task) {
                sendResponse({ success: false, error: 'No recoverable AI image task found.' });
                return;
            }
            const result = await launchAiImagePopupWithPayload({
                dataUrl: task.imageData,
                nicheName: task.nicheName || 'Recovered AI Image',
                targetUrl: task.targetUrl || GEMINI_IMAGE_GEM_URL,
                promptText: task.promptText
            });
            sendResponse({ success: true, recoveredFrom: task.id, ...result });
        })();
        return true;
    }

    if (req.action === 'NHP_SWEEP_ORPHAN_GEMINI_TASK') {
        (async () => {
            const result = await sweepOrphanGeminiWebTaskStorage();
            sendResponse(result);
        })();
        return true;
    }

    if (req.action === 'NHP_SWEEP_IDLE_GEMINI_INJECT_STORAGE') {
        (async () => {
            const result = await sweepIdleGeminiInjectStorage();
            sendResponse(result);
        })();
        return true;
    }

    if (req.action === 'GEMINI_WEB_RESULT') {
        const requestId = req.requestId;
        const batchSessionId = parseGeminiWebBatchSessionIdFromRequest(requestId, req.sessionId);
        if (batchSessionId) {
            (async () => {
                try {
                    let session = geminiWebBatchSessions.get(batchSessionId);
                    if (!session) {
                        session = await restoreGeminiWebBatchSession(batchSessionId);
                    }
                    if (!session) {
                        sendResponse({ success: false, error: 'Gemini Web batch session was not found.' });
                        return;
                    }
                    await advanceGeminiWebBatchAfterItem(req);
                    sendResponse({ success: true, batch: true });
                } catch (error) {
                    failGeminiWebBatch(batchSessionId, error?.message || 'Gemini Web batch item failed.');
                    sendResponse({ success: false, error: error?.message || 'Gemini Web batch item failed.' });
                }
            })();
            return true;
        }
        const pending = requestId ? geminiWebTaskResolvers.get(requestId) : null;
        if (!pending) {
            try {
                chrome.storage.local.remove(GEMINI_WEB_TASK_STORAGE_KEY);
            } catch (_) {}
            sendResponse({ success: false, error: 'No pending Gemini Web task found.' });
            return true;
        }
        if (req.success === false) {
            pending.reject(req.error || 'Gemini Web task failed.');
        } else {
            pending.resolve(req);
        }
        sendResponse({ success: true });
        return true;
    }

    if (req.action === 'OPEN_GEMINI_POPUP') {
        openGeminiPopupWindow(req.url, req.focused === true).then((win) => {
            if (chrome.runtime.lastError) {
                console.error("[Background] Window creating error:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            if (!win || typeof win.id !== 'number') {
                sendResponse({ success: false, error: 'Gemini popup was not created.' });
                return;
            }
            sendResponse({ success: true, windowId: win.id });
        }).catch((error) => {
            sendResponse({ success: false, error: error.message || 'Gemini popup was not created.' });
        });
        return true;
    }

    if (req.action === 'close_gemini_web_window') {
        (async () => {
            const forceClose = req.force === true;
            if (!forceClose && geminiWebBatchSessions.size > 0) {
                sendResponse({ success: true, closed: false, reason: 'batch_active' });
                return;
            }
            if (!forceClose) {
                try {
                    const stored = await chrome.storage.local.get([
                        GEMINI_WEB_TASK_STORAGE_KEY,
                        GEMINI_WEB_BATCH_STORAGE_KEY
                    ]);
                    if (stored?.[GEMINI_WEB_TASK_STORAGE_KEY] || stored?.[GEMINI_WEB_BATCH_STORAGE_KEY]) {
                        sendResponse({ success: true, closed: false, reason: 'task_pending' });
                        return;
                    }
                } catch (_) {
                }
            }
            if (!geminiWebWindowId) {
                sendResponse({ success: true, closed: false });
                return;
            }
            try {
                await chrome.windows.remove(geminiWebWindowId);
            } catch (_) {
            }
            geminiWebWindowId = null;
            sendResponse({ success: true, closed: true });
        })();
        return true;
    }

    if (req.action === 'FETCH_IMAGE_AS_DATA_URL') {
        (async () => {
            try {
                const urls = Array.isArray(req.urls) ? req.urls : [req.url];
                const result = await fetchImageAsDataUrlFromCandidates(urls, req.pageUrl);
                sendResponse({ success: true, ...result });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to prepare image.' });
            }
        })();
        return true;
    }

    if (req.action === 'AI_IMAGE_BRIDGE_STATUS') {
        (async () => {
            try {
                await fetchJsonWithTimeout(`${getAiBridgeServerUrl()}/ping`, {}, 1500);
                sendResponse({
                    success: true,
                    online: true,
                    port: AI_BRIDGE_SERVER_PORT,
                    source: 'direct-ping',
                    cooldown: Math.max(0, AI_IMAGE_LOCAL_BRIDGE_RETRY_COOLDOWN_MS - (Date.now() - aiImageLocalBridgeLastFailureAt))
                });
            } catch (error) {
                sendResponse({
                    success: true,
                    online: false,
                    port: AI_BRIDGE_SERVER_PORT,
                    source: 'offline',
                    error: error.message || 'AI bridge is offline.',
                    cooldown: Math.max(0, AI_IMAGE_LOCAL_BRIDGE_RETRY_COOLDOWN_MS - (Date.now() - aiImageLocalBridgeLastFailureAt))
                });
            }
        })();
        return true;
    }

    if (req.action === 'STUDIO_LOCAL_AI_UPSCALE') {
        (async () => {
            try {
                if (!req.dataUrl) {
                    throw new Error('Missing image data.');
                }
                const response = await fetch(`${getAiBridgeServerUrl()}/studio-ai-upscale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dataUrl: req.dataUrl,
                        scale: req.scale || 2,
                        model: req.model || 'realesrgan-x4plus',
                        tile: req.tile || 128
                    }),
                    signal: AbortSignal.timeout(10 * 60 * 1000)
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.error || `Local upscaler HTTP ${response.status}`);
                }
                sendResponse({ success: true, ...payload });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Local AI upscale failed.' });
            }
        })();
        return true;
    }

    if (req.action === 'SEND_AI_IMAGE_TO_TARGET') {
        (async () => {
            try {
                let dataUrl = req.dataUrl;
                if (!dataUrl && (req.imageUrl || req.srcUrl || (Array.isArray(req.urls) && req.urls.length))) {
                    const urls = Array.isArray(req.urls) && req.urls.length
                        ? req.urls
                        : [req.imageUrl || req.srcUrl];
                    const fetched = await fetchImageAsDataUrlFromCandidates(urls, req.pageUrl);
                    dataUrl = fetched?.dataUrl;
                }
                if (!dataUrl) {
                    throw new Error('Missing image data.');
                }
                const result = await launchAiImagePopupWithPayload({
                    dataUrl,
                    nicheName: req.nicheName || 'Trending Topic',
                    targetUrl: req.targetUrl || GEMINI_IMAGE_GEM_URL,
                    promptText: typeof req.promptText === 'string' ? req.promptText : undefined,
                    requireLocalBridge: req.requireLocalBridge === true,
                    useLocalBridge: req.useLocalBridge !== false,
                    ignoreStoredNicheContext: req.ignoreStoredNicheContext === true,
                    pageNicheHint: req.pageNicheHint || req.nicheName || ''
                });
                if (result?.bridge !== 'local-server' && result?.taskId) {
                    void ensureAiImageTaskDelivery(result.taskId).catch((deliveryError) => {
                        console.warn('[NHP][AI Image Send] Background delivery:', deliveryError?.message || deliveryError);
                    });
                    const quickAck = await waitForAiImageTaskDelivery(result.taskId, AI_IMAGE_LAUNCH_ACK_WAIT_MS);
                    sendResponse({
                        success: true,
                        ...result,
                        queued: !quickAck?.delivered,
                        deliveryPending: !quickAck?.delivered && !quickAck?.failed
                    });
                    return;
                }
                sendResponse({ success: true, ...result });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Failed to send image to AI.' });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_GET') {
        (async () => {
            try {
                const noteData = await chrome.storage.local.get(['teepublic_manager_data']);
                const noteNiches = normalizeNoteDataPayload(noteData?.teepublic_manager_data).niches
                    .map((item) => ({
                        id: item?.id || `note_${normalizeNicheKey(item?.text || item?.niche || item?.keyword)}`,
                        text: String(item?.text || item?.niche || item?.keyword || '').trim(),
                        quality: item?.quality || '',
                        done: !!(item?.done || item?.isCompleted),
                        addedAt: item?.addedAt || item?.createdAt || null
                    }))
                    .filter((item) => item.text);
                sendResponse({
                    success: true,
                    prompts: await getPromptBagPrompts(),
                    images: await getPromptBagImages(),
                    noteNiches
                });
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error?.message || 'Ï¬Ï╣Ï░Ï▒ ┘éÏ▒ÏºÏíÏ® Ïº┘äÏ¡┘é┘èÏ¿Ï® ┘à┘å Ïº┘äÏ¬Ï«Ï▓┘è┘å Ïº┘ä┘àÏ¡┘ä┘è.'
                });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_SAVE_PROMPTS') {
        (async () => {
            try {
                sendResponse({ success: true, prompts: await setPromptBagPrompts(req.prompts || []) });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to save prompts.' });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_SAVE_IMAGES') {
        (async () => {
            try {
                sendResponse({ success: true, images: await setPromptBagImages(req.images || []) });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to save images.' });
            }
        })();
        return true;
    }

    if (req.action === 'ORACLE_DESIGN_GENERATE') {
        (async () => {
            try {
                sendResponse(await startOracleDesignGeneration(req));
            } catch (error) {
                sendResponse({
                    ok: false,
                    accepted: false,
                    success: false,
                    requestId: String(req.requestId || '').trim() || null,
                    status: 'failed',
                    errorCode: 'DESIGN_EXECUTOR_UNAVAILABLE',
                    error: error.message || 'Oracle design generate failed',
                });
            }
        })();
        return true;
    }

    if (req.action === 'ORACLE_DESIGN_STATUS') {
        (async () => {
            try {
                sendResponse(await pollOracleDesignJobStatus(req));
            } catch (error) {
                sendResponse({
                    success: false,
                    status: 'failed',
                    errorCode: 'DESIGN_EXECUTOR_UNAVAILABLE',
                    error: error.message || 'Oracle design status failed',
                });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_ADD_IMAGE') {
        (async () => {
            try {
                sendResponse({ success: true, images: await addPromptBagImage(req.image || {}) });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to add image.' });
            }
        })();
        return true;
    }

    if (req.action === 'generate_from_image') {
        (async () => {
            try {
                let dataUrl = String(req.dataUrl || '').trim();
                const imageUrl = String(req.imageUrl || req.srcUrl || '').trim();
                const pageUrl = String(req.pageUrl || '').trim();
                if (!dataUrl.startsWith('data:image/') && imageUrl) {
                    const fetched = await fetchImageAsDataUrlFromCandidates([imageUrl], pageUrl);
                    dataUrl = fetched?.dataUrl || '';
                }
                if (!dataUrl.startsWith('data:image/')) {
                    throw new Error('Missing image data.');
                }
                const payload = {
                    prompt: String(req.prompt || '').trim(),
                    imageDataUrl: dataUrl,
                    imageUrl,
                    name: String(req.name || 'floating-image.png').trim() || 'floating-image.png',
                    source: req.source || 'floating'
                };
                const pendingKey = 'nhpPendingGenerateFromImage';
                await chrome.storage.local.set({ [pendingKey]: { ...payload, queuedAt: Date.now() } });
                const popupUrlPrefix = chrome.runtime.getURL('popup.html');
                const targetUrl = chrome.runtime.getURL('popup.html?mode=tab&tab=generate');
                let tabs = [];
                try {
                    tabs = await chrome.tabs.query({ url: `${popupUrlPrefix}*` });
                } catch (_) {
                    tabs = [];
                }
                const existing = tabs.find((t) => String(t.url || '').startsWith(popupUrlPrefix));
                if (existing?.id) {
                    const needsTabUrl = !String(existing.url || '').includes('tab=generate');
                    await chrome.tabs.update(existing.id, {
                        active: true,
                        ...(needsTabUrl ? { url: targetUrl } : {})
                    });
                    if (existing.windowId) {
                        await chrome.windows.update(existing.windowId, { focused: true });
                    }
                } else {
                    await chrome.tabs.create({ url: targetUrl, active: true });
                }
                try {
                    chrome.runtime.sendMessage({ action: 'GENERATE_FROM_IMAGE', ...payload });
                } catch (_) {
                    /* popup may load after storage write */
                }
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to open Generate.' });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_PASTE_TEXT') {
        (async () => {
            try {
                const targetTabId = await getPromptBagTargetTabId();
                const result = await pastePromptBagTextIntoTab(targetTabId, req.text || '');
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to paste prompt.' });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_SEND_IMAGE') {
        (async () => {
            try {
                const bagTargetUrl = req.targetUrl || GEMINI_IMAGE_GEM_URL;
            const strictPromptText = (() => {
                const explicit = String(req.promptText || '').trim();
                if (!explicit || /redraw the design provided|artisan hand-drawn illustration|no mockups/i.test(explicit)) {
                    const fallback = 'Generate exactly 4 distinct print-ready apparel graphics based only on the printable design visible in the reference. If the reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel, extract only the printed logo/text/symbols/color mood from the garment and do not redraw the shirt, model, mannequin, fabric folds, product photo, watermark, or original background. Place the redesigned graphic only on a solid black background (#000000). Analyze the design subject and mood, then choose the best 4 matching apparel styles, one selected style per design variation. If the extracted printable graphic contains a person or character, create 4 different pose/action variations for that character only, one per design, such as standing, sitting, leaning, walking, jumping, crouching, dancing, running, or dynamic action. If the printable graphic has no person or character, do not invent a body pose. Preserve the core theme, keep high contrast, strong readable silhouette, and centered apparel composition. Output final designs only.';
                    return typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(fallback) : fallback;
                }
                return typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(explicit) : explicit;
            })();
                const result = await launchAiImagePopupWithPayload({
                    dataUrl: req.dataUrl,
                    nicheName: req.name || 'Prompt Bag Image',
                    targetUrl: bagTargetUrl,
                    useLocalBridge: false,
                    promptText: strictPromptText
                });
                if (result?.bridge !== 'local-server' && result?.taskId) {
                    void ensureAiImageTaskDelivery(result.taskId).catch((deliveryError) => {
                        console.warn('[NHP][Prompt Bag] Background delivery:', deliveryError?.message || deliveryError);
                    });
                    const quickAck = await waitForAiImageTaskDelivery(result.taskId, AI_IMAGE_LAUNCH_ACK_WAIT_MS);
                    sendResponse({
                        success: true,
                        ...result,
                        delivered: !!quickAck?.delivered,
                        queued: !quickAck?.delivered,
                        deliveryPending: !quickAck?.delivered && !quickAck?.failed
                    });
                    return;
                }
                sendResponse({ success: true, ...result, delivered: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to send image.' });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_OPEN_AI_POPUP') {
        (async () => {
            try {
                const url = String(req.url || '').trim();
                if (!/^https:\/\/(chatgpt\.com|gemini\.google\.com)\//i.test(url)) {
                    throw new Error('Unsupported AI popup URL.');
                }
                const width = Math.max(520, Math.min(1200, Number(req.width) || 920));
                const height = Math.max(520, Math.min(1000, Number(req.height) || 760));
                const popup = await chrome.windows.create({
                    url,
                    type: 'popup',
                    width,
                    height,
                    focused: true
                });
                sendResponse({ success: true, windowId: popup?.id || null });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to open AI popup.' });
            }
        })();
        return true;
    }

    if (req.action === 'PROMPT_BAG_GENERATE_IMAGE_PROMPT') {
        (async () => {
            try {
                const stored = await chrome.storage.local.get(['nhpAdminAiKeys', 'nhpProxyBaseUrl', 'nhpGptApiKey']);
                const adminKeys = stored?.nhpAdminAiKeys || {};
                const apiKey = String(req.apiKey || adminKeys.gpt || stored.nhpGptApiKey || '').trim();
                const baseUrl = normalizeCliProxyBaseUrl(req.baseUrl || adminKeys.baseUrl || stored.nhpProxyBaseUrl || CLI_PROXY_API_BASE_URL);
                if (!apiKey) {
                    throw new Error('┘à┘üÏ¬ÏºÏ¡ NHP API Ï║┘èÏ▒ ┘à┘ÅÏ╣Ï»┘æ. Ïº┘üÏ¬Ï¡ ┘ä┘êÏ¡Ï® Ïº┘äÏ¬Ï¡┘â┘à ÔåÆ ┘à┘üÏºÏ¬┘èÏ¡ AI ┘êÏúÏ»Ï«┘ä Ïº┘ä┘à┘üÏ¬ÏºÏ¡ (CLI Proxy).');
                }

                let dataUrl = String(req.dataUrl || '').trim();
                if (req.imageId) {
                    const bagImages = await getPromptBagImages();
                    const storedImage = bagImages.find((item) => item.id === req.imageId);
                    if (storedImage?.dataUrl) dataUrl = String(storedImage.dataUrl).trim();
                }
                if (!dataUrl.startsWith('data:image/')) throw new Error('Missing image data.');
                dataUrl = await normalizeAiImageDataUrl(dataUrl);

                const { cleanBase64, resolvedMimeType } = resolveSeoInlineImageParts(dataUrl, req.mimeType || 'image/png');
                const vision = await callPromptBagVisionAnalysisWithFallback({
                    prompt: buildPromptBagVisionAnalysisPrompt(),
                    cleanBase64,
                    resolvedMimeType,
                    apiKey,
                    baseUrl,
                    preferredModel: adminKeys.model || req.model || CLI_PROXY_API_DEFAULT_MODEL
                });
                if (!vision.analysis?.ok) {
                    throw new Error(vision.errors.slice(-3).join(' | ') || 'All CLI Proxy vision models failed.');
                }
                const generatedPrompt = buildPromptBagGeneratedPromptFromAnalysis(vision.analysis);
                sendResponse({
                    success: true,
                    prompt: generatedPrompt,
                    version: 7,
                    modelUsed: vision.modelUsed || '',
                    providerChain: PROMPT_BAG_VISION_MODEL_CHAIN
                });
            } catch (error) {
                const fallbackPrompt = buildPromptBagVisionFallbackPrompt(req.name);
                sendResponse({
                    success: true,
                    prompt: fallbackPrompt,
                    version: 7,
                    fallback: true,
                    warning: error?.message || 'Unable to generate image prompt.'
                });
            }
        })();
        return true;
    }

    if (req.action === 'NHP_PNGGEN_GENERATE') {
        (async () => {
            try {
                const taskId = createPngGenTaskId();
                // Ack immediately to avoid "message channel closed" timeouts.
                sendResponse({ success: true, taskId, queued: true });
                void runPngGenTask(taskId, req);
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to generate images with NHP.' });
            }
        })();
        return true;
    }

    // MerchGhost Storage Handlers
    if (req.action === 'save-sales-data') { chrome.storage.local.set({ localSalesData: req.data }); return false; }
    if (req.action === 'save-works-summary') { chrome.storage.local.set({ localWorksData: req.data }); return false; }
    if (req.action === 'save-artist-metrics') { chrome.storage.local.set({ artistMetrics: req.data }); return false; }
    if (req.action === 'save-account-tier') { chrome.storage.local.set({ accountTier: req.data }); return false; }
    if (req.action === 'setup-merchghost-offscreen') {
        setupOffscreenDocument('offscreen.html').then(() => sendResponse({ success: true }));
        return true;
    }

    // 1. Core Controls
    if (req.action === 'u_start') {
        // MV3: must return true and keep the SW alive until workers are spawned.
        // Returning false after void startUSPTOProcessing() left zombie uPending with 0 workers.
        uStopped = false;
        (async () => {
            try {
                if (!isUSPTOProcessing) {
                    await startUSPTOProcessing();
                } else {
                    await ensureUSPTOFastWorkers();
                }
                sendResponse({
                    success: true,
                    started: true,
                    active: usptoFastActiveWorkers.size,
                    processing: isUSPTOProcessing
                });
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error?.message || String(error),
                    active: usptoFastActiveWorkers.size
                });
            }
        })();
        return true;
    }
    if (req.action === 'u_stop') {
        uStopped = true;
        isUSPTOProcessing = false;
        setStorage({
            [USPTO_FAST_WORKER_ACTIVE_KEY]: usptoFastActiveWorkers.size,
            uPaused: false,
            [USPTO_IN_FLIGHT_KEY]: [],
            [USPTO_BATCH_SNAPSHOT_KEY]: null
        }).catch(() => { });
        closeLingeringUSPTOFastTabs().catch(() => { });
        return false;
    }
    if (req.action === 'u_pause') {
        uStopped = true;
        isUSPTOProcessing = false;
        (async () => {
            try {
                const idleDeadline = Date.now() + 5000;
                while (usptoFastActiveWorkers.size > 0 && Date.now() < idleDeadline) {
                    await delay(200);
                }
                const mergedPending = await requeueUsptoInFlightForPause();
                await setStorage({
                    uRunning: false,
                    uPaused: true,
                    [USPTO_FAST_WORKER_ACTIVE_KEY]: usptoFastActiveWorkers.size
                });
                await closeLingeringUSPTOFastTabs().catch(() => { });
                const data = await getStorage(['uPending', 'uSafe', 'uBanned', 'uTotal']);
                sendResponse({
                    success: true,
                    paused: true,
                    pending: Array.isArray(data.uPending) ? data.uPending.length : mergedPending.length,
                    safe: Array.isArray(data.uSafe) ? data.uSafe.length : 0,
                    banned: Array.isArray(data.uBanned) ? data.uBanned.length : 0,
                    total: Number(data.uTotal || 0),
                    active: usptoFastActiveWorkers.size
                });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || String(error) });
            }
        })();
        return true;
    }
    if (req.action === 'u_restore_batch') {
        restoreUsptoQueueFromSnapshot().then((result) => {
            sendResponse({ success: true, ...result });
        }).catch((error) => {
            sendResponse({ success: false, error: error?.message || String(error) });
        });
        return true;
    }
    if (req.action === 'u_persist_batch') {
        persistUsptoBatchSnapshot('ui_start').then((snapshot) => {
            sendResponse({ success: true, pending: snapshot?.pending?.length || 0 });
        }).catch((error) => {
            sendResponse({ success: false, error: error?.message || String(error) });
        });
        return true;
    }
    if (req.action === 'u_resume') {
        (async () => {
            try {
                await restoreUsptoQueueFromSnapshot();
                const data = await getStorage(['uPending', 'uPaused', USPTO_IN_FLIGHT_KEY]);
                const pending = Array.isArray(data.uPending) ? data.uPending : [];
                const inFlight = Array.isArray(data[USPTO_IN_FLIGHT_KEY]) ? data[USPTO_IN_FLIGHT_KEY] : [];
                const queueLen = pending.length + inFlight.length;
                if (!queueLen) {
                    sendResponse({ success: false, error: 'No pending USPTO niches to resume.' });
                    return;
                }
                if (inFlight.length) {
                    await requeueUsptoInFlightForPause();
                }
                uStopped = false;
                await setStorage({ uPaused: false, uRunning: true });
                if (!isUSPTOProcessing) {
                    await startUSPTOProcessing();
                } else {
                    await ensureUSPTOFastWorkers();
                }
                const after = await getStorage(['uPending']);
                sendResponse({
                    success: true,
                    resumed: true,
                    pending: Array.isArray(after.uPending) ? after.uPending.length : queueLen,
                    started: true,
                    active: usptoFastActiveWorkers.size,
                    processing: isUSPTOProcessing
                });
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error?.message || String(error),
                    active: usptoFastActiveWorkers.size
                });
            }
        })();
        return true;
    }
    if (req.action === 'u_set_workers') {
        const count = normalizeUSPTOFastWorkerTarget(req.count, 1);
        setStorage({ [USPTO_FAST_WORKER_TARGET_KEY]: count }, async () => {
            try {
                if (!uStopped) await ensureUSPTOFastWorkers();
                sendResponse({ success: true, count, active: usptoFastActiveWorkers.size, max: USPTO_FAST_WORKERS_MAX });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Unable to set USPTO workers.' });
            }
        });
        return true;
    }
    if (req.action === 'u_add_worker') {
        getUSPTOFastWorkerTarget().then(async (current) => {
            const count = normalizeUSPTOFastWorkerTarget(current + 1, current);
            await setStorage({ [USPTO_FAST_WORKER_TARGET_KEY]: count });
            if (!uStopped) await ensureUSPTOFastWorkers();
            sendResponse({ success: true, count, active: usptoFastActiveWorkers.size, max: USPTO_FAST_WORKERS_MAX });
        }).catch((error) => sendResponse({ success: false, error: error.message || 'Unable to add USPTO worker.' }));
        return true;
    }
    if (req.action === 'u_set_mode') {
        const mode = normalizeUSPTORunMode(req.mode);
        setStorage({ [USPTO_RUN_MODE_KEY]: mode }, () => {
            sendResponse({ success: true, mode });
        });
        return true;
    }
    if (req.action === 'u_get_mode') {
        getUSPTORunMode()
            .then((mode) => sendResponse({ success: true, mode }))
            .catch((error) => sendResponse({ success: false, error: error.message || 'Unable to read USPTO mode.' }));
        return true;
    }
    if (req.action === 'emergency_save_design_queue') {
        const queue = Array.isArray(req.queue) ? req.queue : [];
        chrome.storage.local.set({ savedDesignQueue: queue }, () => {
            sendResponse({ success: !chrome.runtime.lastError, error: chrome.runtime.lastError?.message || null });
        });
        return true;
    }
    if (req.action === 'tp_start') { tpStopped = false; processTP(); return false; }
    if (req.action === 'tp_stop') { tpStopped = true; return false; }
    if (req.action === 'tp_force_recheck') {
        tpForceRecheck(req.niches || [])
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
        return true;
    }
    if (req.action === 'ap_stop') {
        apStopped = true;
        apProcessRunning = false;
        stopHeartbeat();
        publishApQueueState({
            isRunning: false,
            stopped: true,
            overallStatus: 'stopped',
            stoppedAt: new Date().toISOString(),
            ...clearApCurrentAccountFields()
        }).catch(() => { });
        chrome.runtime.sendMessage({
            action: 'ap_update',
            log: '­ƒøæ Ï¬┘à ÏÀ┘äÏ¿ ÏÑ┘è┘éÏº┘ü Ïº┘äÏ▒┘üÏ╣ ÔÇö Ï¼ÏºÏ▒┘è ÏÑ┘è┘éÏº┘ü Ïº┘äÏ╣┘à┘ä┘èÏ®...',
            type: 'warning',
            toast: '­ƒøæ Ï¬┘à ÏÑ┘è┘éÏº┘ü Ïº┘äÏ▒┘üÏ╣'
        });
        return false;
    }

    if (req.action === 'TMH_START_PIPELINE' || req.action === 'START_FULL_PIPELINE') {
        const nichesToUse = req.niches || [];
        startFullAutomationPipeline(nichesToUse);
        sendResponse({ status: 'PIPELINE_STARTED' });
        return true;
    }
    if (req.action === 'NHP_ARCHIVE_REFRESH') {
        importPersistentNicheArchive(true)
            .then(({ archive }) => sendResponse({ success: true, index: archive }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (req.action === 'NHP_ARCHIVE_RECORD_TRENDS') {
        recordTrendSnapshot(req.trends || [], req.source || 'manual_fetch')
            .then((archive) => sendResponse({ success: true, index: archive }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (req.action === 'NHP_ARCHIVE_RECORD_NOTE') {
        recordArchiveStage(req.items || [], 'note', req.reason || 'note_update')
            .then((archive) => sendResponse({ success: true, index: archive }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (req.action === 'NHP_ARCHIVE_EXPORT_BUNDLE') {
        exportNicheArchiveBundle()
            .then((bundle) => sendResponse({ success: true, bundle }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (req.action === 'NHP_ARCHIVE_IMPORT_BUNDLE') {
        importNicheArchiveBundle(req.bundle || {}, req.mode || 'merge')
            .then((archive) => sendResponse({ success: true, index: archive }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (req.action === 'get_server_status') {
        const platform = req.platform || 'teepublic';
        (async () => {
            const status = await getPlatformServerStatus(platform);
            console.log('[Background][ServerStatus]', status);
            sendResponse(status);
        })();
        return true;
    }
    if (req.action === 'get_extension_servers_status') {
        (async () => {
            try {
                const snapshot = await getExtensionServersStatusSnapshot();
                sendResponse({ success: true, ...snapshot });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to read extension server statuses.' });
            }
        })();
        return true;
    }
    if (req.action === 'nhp_setup_api') {
        (async () => {
            try {
                if (typeof NhpSetupApi === 'undefined' || typeof NhpSetupApi.handleSetupApiRequest !== 'function') {
                    sendResponse({ success: false, error: 'NhpSetupApi unavailable' });
                    return;
                }
                const deps = {
                    ensureNhpProjectDirResolved,
                    getNhpLocalServersStatusSnapshot,
                    executeNhpLauncherScript,
                    joinProjectPath: (root, rel) => (typeof NhpLocalServers !== 'undefined' && NhpLocalServers.joinProjectPath
                        ? NhpLocalServers.joinProjectPath(root, rel)
                        : `${String(root || '').replace(/[/\\]+$/, '')}\\${String(rel || '').replace(/^[/\\]+/, '').replace(/\//g, '\\')}`)
                };
                const result = await NhpSetupApi.handleSetupApiRequest(req, deps);
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Setup API failed.' });
            }
        })();
        return true;
    }
    if (req.action === 'get_nhp_native_host_status') {
        (async () => {
            try {
                const forceRefresh = req.forceRefresh === true;
                if (forceRefresh && typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.invalidateCache) {
                    NhpPortablePaths.invalidateCache();
                }
                const projectDir = await ensureNhpProjectDirResolved(forceRefresh);
                const status = typeof NhpPortablePaths !== 'undefined'
                    ? (forceRefresh && NhpPortablePaths.verifyNativeHostConnection
                        ? await NhpPortablePaths.verifyNativeHostConnection({ silent: true })
                        : NhpPortablePaths.ensureNativeHostReady
                            ? await NhpPortablePaths.ensureNativeHostReady({ silent: true })
                            : { ok: false, error: 'NhpPortablePaths unavailable' })
                    : { ok: false, error: 'NhpPortablePaths unavailable' };
                const hint = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.buildNativeHostRegisterHint
                    ? NhpPortablePaths.buildNativeHostRegisterHint(projectDir)
                    : null;
                sendResponse({
                    success: true,
                    nativeHost: status,
                    projectDir: projectDir || status.projectDir || null,
                    registerScript: hint?.registerScript || '',
                    registerCommand: hint?.registerCommand || '',
                    extensionId: hint?.extensionId || chrome.runtime.id,
                    localBridgeOnline: await isLocalManagerBridgeOnline()
                });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to read native host status.' });
            }
        })();
        return true;
    }
    if (req.action === 'verify_nhp_native_host') {
        (async () => {
            try {
                if (typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.invalidateCache) {
                    NhpPortablePaths.invalidateCache();
                }
                const status = typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.verifyNativeHostConnection
                    ? await NhpPortablePaths.verifyNativeHostConnection({ silent: false })
                    : { ok: false, error: 'NhpPortablePaths unavailable' };
                sendResponse({ success: status.ok, nativeHost: status });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Native host verification failed.' });
            }
        })();
        return true;
    }
    if (req.action === 'get_nhp_local_servers_status') {
        (async () => {
            try {
                const snapshot = await getNhpLocalServersStatusSnapshot();
                sendResponse(snapshot);
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to read local server statuses.' });
            }
        })();
        return true;
    }
    if (req.action === 'control_nhp_local_server') {
        const serverId = String(req.serverId || '').trim();
        const command = ['stop', 'restart', 'terminal'].includes(req.command) ? req.command : 'start';
        const interactive = req.interactive === true || req.command === 'terminal';
        (async () => {
            try {
                const { disabledKey, map: disabledMap } = await readNhpLocalServersDisabledMap();
                if (req.toggleDisabled === true) {
                    const map = { ...disabledMap };
                    map[serverId] = !map[serverId];
                    await chrome.storage.local.set({ [disabledKey]: map });
                    sendResponse({ success: true, serverId, disabled: map[serverId] === true });
                    return;
                }
                const isDisabled = disabledMap[serverId] === true;
                let reEnabled = false;
                if (isDisabled && ['start', 'restart', 'terminal'].includes(command)) {
                    reEnabled = await clearNhpLocalServerDisabled(serverId);
                }
                const result = await controlNhpLocalServer(serverId, command, interactive);
                sendResponse(reEnabled ? { ...result, reEnabled: true } : result);
            } catch (error) {
                sendResponse({ success: false, serverId, command, error: error?.message || 'Unable to control local server.' });
            }
        })();
        return true;
    }
    if (req.action === 'control_nhp_local_servers_bulk') {
        const command = ['stop', 'restart'].includes(req.command) ? req.command : 'start';
        (async () => {
            try {
                const projectDir = await ensureNhpProjectDirResolved();
                const bulkScripts = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.BULK_SCRIPTS : null;
                if (command === 'start' || command === 'restart') {
                    await clearNhpLocalServerDisabled('', { clearAll: true });
                    const relScript = command === 'restart'
                        ? (bulkScripts?.restartAll || 'addon\\03_Restart_All\\NHP_Restart_All_Servers_SilentCore.bat')
                        : (bulkScripts?.startAll || 'addon\\01_Start_All\\NHP_Start_All_Servers_SilentCore.bat');
                    const scriptPath = NhpLocalServers?.joinProjectPath(projectDir, relScript)
                        || `${projectDir}\\${relScript}`;
                    const launchResult = await executeNhpLauncherScript(scriptPath, {
                        serverId: 'bulk',
                        command,
                        port: 0
                    });
                    if (!launchResult.success) {
                        sendResponse({ success: false, command, error: launchResult.error || 'Bulk start launcher failed.' });
                        return;
                    }
                } else {
                    const relScript = bulkScripts?.stopAll || 'addon\\02_Stop_All\\NHP_Stop_All_Servers_SilentCore.bat';
                    const scriptPath = NhpLocalServers?.joinProjectPath(projectDir, relScript)
                        || `${projectDir}\\${relScript}`;
                    const launchResult = await executeNhpLauncherScript(scriptPath, {
                        serverId: 'bulk',
                        command,
                        port: 0
                    });
                    if (!launchResult.success) {
                        sendResponse({ success: false, command, error: launchResult.error || 'Bulk stop launcher failed.' });
                        return;
                    }
                }
                await delay(command === 'stop' ? 1500 : 4000);
                const snapshot = await getNhpLocalServersStatusSnapshot();
                sendResponse({ success: true, command, ...snapshot });
            } catch (error) {
                sendResponse({ success: false, command, error: error?.message || 'Bulk local server control failed.' });
            }
        })();
        return true;
    }
    if (req.action === 'open_cliproxy_management') {
        (async () => {
            try {
                const mgmt = typeof NhpCliProxyManagement !== 'undefined' ? NhpCliProxyManagement : null;
                if (!mgmt) {
                    sendResponse({ success: false, error: 'NhpCliProxyManagement unavailable' });
                    return;
                }
                const tab = await mgmt.openManagementPanel(req.url || mgmt.LOCAL_MANAGEMENT_URL);
                sendResponse({ success: true, tabId: tab?.id || null });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to open CLIProxy management panel.' });
            }
        })();
        return true;
    }
    if (req.action === 'get_proxy_endpoints') {
        (async () => {
            try {
                if (typeof NhpProxyEndpoints === 'undefined') {
                    sendResponse({ success: false, error: 'NhpProxyEndpoints unavailable' });
                    return;
                }
                const data = await NhpProxyEndpoints.loadProxyEndpoints();
                sendResponse({ success: true, ...data });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to load proxy endpoints.' });
            }
        })();
        return true;
    }
    if (req.action === 'save_proxy_endpoints') {
        (async () => {
            try {
                if (typeof NhpProxyEndpoints === 'undefined') {
                    sendResponse({ success: false, error: 'NhpProxyEndpoints unavailable' });
                    return;
                }
                const endpoints = await NhpProxyEndpoints.saveProxyEndpoints(req.endpoints || [], { syncLegacy: req.syncLegacy !== false });
                sendResponse({ success: true, endpoints });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to save proxy endpoints.' });
            }
        })();
        return true;
    }
    if (req.action === 'get_proxy_routing_info') {
        (async () => {
            try {
                if (typeof NhpProxyEndpoints === 'undefined') {
                    sendResponse({ success: false, error: 'NhpProxyEndpoints unavailable' });
                    return;
                }
                const info = await NhpProxyEndpoints.getProxyRoutingInfo();
                sendResponse({ success: true, ...info });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to load proxy routing info.' });
            }
        })();
        return true;
    }
    if (req.action === 'save_proxy_routing_mode') {
        (async () => {
            try {
                if (typeof NhpProxyEndpoints === 'undefined') {
                    sendResponse({ success: false, error: 'NhpProxyEndpoints unavailable' });
                    return;
                }
                const routingMode = await NhpProxyEndpoints.saveRoutingMode(req.routingMode);
                sendResponse({ success: true, routingMode });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to save proxy routing mode.' });
            }
        })();
        return true;
    }
    if (req.action === 'get_startup_script_text') {
        const format = req.format === 'sh' ? 'sh' : 'bat';
        (async () => {
            try {
                const built = await buildNhpStartupScriptText(format);
                sendResponse({ success: true, text: built.text, format, source: built.source });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Unable to build startup script.' });
            }
        })();
        return true;
    }
    if (req.action === 'download_startup_script') {
        const format = req.format === 'sh' ? 'sh' : 'bat';
        (async () => {
            try {
                const result = await downloadNhpStartupScript(format);
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Ï¬Ï╣Ï░Ï▒ Ï¬┘åÏ▓┘è┘ä Ïº┘äÏ│┘âÏ▒Ï¿Ï¬' });
            }
        })();
        return true;
    }
    if (req.action === 'control_extension_server') {
        const serverId = String(req.serverId || '').trim();
        const command = req.command === 'stop' ? 'stop' : 'start';
        const interactive = req.interactive === true;
        (async () => {
            try {
                if (serverId === 'ai-bridge') {
                    const result = await controlNonAutopilotServers(command, interactive);
                    if (!result.success) {
                        sendResponse({ success: false, serverId, command, ...result });
                        return;
                    }
                    if (command === 'start') {
                        for (let attempt = 1; attempt <= 12; attempt += 1) {
                            await delay(1000);
                            try {
                                await fetchJsonWithTimeout(`${getAiBridgeServerUrl()}/ping`, {}, 1800);
                                sendResponse({ success: true, serverId, command, online: true, port: AI_BRIDGE_SERVER_PORT, ...result, attempt });
                                return;
                            } catch (_) { }
                        }
                    }
                    let online = false;
                    try {
                        await fetchJsonWithTimeout(`${getAiBridgeServerUrl()}/ping`, {}, 1300);
                        online = true;
                    } catch (_) { }
                    sendResponse({ success: true, serverId, command, online, port: AI_BRIDGE_SERVER_PORT, ...result });
                    return;
                }

                if (serverId === 'cliproxy-local') {
                    const result = await controlCliproxyLocalServer(command);
                    if (!result.success) {
                        sendResponse({ success: false, serverId, command, ...result });
                        return;
                    }
                    if (command === 'start') {
                        for (let attempt = 1; attempt <= 10; attempt += 1) {
                            await delay(1200);
                            if (await pingCliproxyLocalServer(2000)) {
                                sendResponse({ success: true, serverId, command, online: true, port: 8317, ...result, attempt });
                                return;
                            }
                        }
                    }
                    const online = await pingCliproxyLocalServer(1500);
                    sendResponse({ success: true, serverId, command, online, port: 8317, ...result });
                    return;
                }

                const platformDef = DASHBOARD_EXTENSION_SERVERS.find((item) => item.id === serverId && item.type === 'platform');
                if (!platformDef) {
                    sendResponse({ success: false, serverId, command, error: 'Unknown extension server id.' });
                    return;
                }

                const result = command === 'start'
                    ? await (async () => {
                        const launchResult = await controlGhostServerProcess('start', platformDef.platform, interactive);
                        if (!launchResult.success) return { success: false, ...launchResult };
                        for (let attempt = 1; attempt <= 4; attempt += 1) {
                            await delay(2500);
                            try {
                                await fetchJsonWithTimeout(nhpUrl(platformDef.port, '/ping'), {}, 2000);
                                return { success: true, attempt, source: launchResult.source, permissionRequired: !!launchResult.permissionRequired };
                            } catch (_) { }
                        }
                        return { success: false, source: 'bootstrap-failed', permissionRequired: !!launchResult.permissionRequired, error: 'Server did not become ready in time.' };
                    })()
                    : await (async () => {
                        await fetch(nhpUrl(platformDef.port, '/shutdown'), { method: 'GET', signal: AbortSignal.timeout(2500) }).catch(() => null);
                        await delay(1200);
                        try {
                            await fetchJsonWithTimeout(nhpUrl(platformDef.port, '/ping'), {}, 1400);
                        } catch (_) {
                            return { success: true, source: 'http-shutdown' };
                        }
                        const stopResult = await controlGhostServerProcess('stop', platformDef.platform, interactive);
                        if (!stopResult.success) return { success: false, ...stopResult };
                        await delay(1200);
                        try {
                            await fetchJsonWithTimeout(nhpUrl(platformDef.port, '/ping'), {}, 1400);
                            return { success: false, source: stopResult.source, error: 'Server is still responding after stop request.' };
                        } catch (_) {
                            return { success: true, source: stopResult.source };
                        }
                    })();

                sendResponse({ serverId, platform: platformDef.platform, command, port: platformDef.port, ...result });
            } catch (error) {
                sendResponse({ success: false, serverId, command, error: error?.message || 'Unable to control extension server.' });
            }
        })();
        return true;
    }
    if (req.action === 'CREATY_PING_GHOST') {
        const port = Number(req.port) || GHOST_SERVER_PORT || 3019;
        (async () => {
            const base = `http://127.0.0.1:${port}`;
            const paths = ['/ping', '/status'];
            for (const path of paths) {
                try {
                    const res = await fetch(`${base}${path}`, { method: 'GET', signal: AbortSignal.timeout(3500) });
                    if (!res.ok) continue;
                    let body = null;
                    try { body = await res.json(); } catch (_) { /* non-JSON ok */ }
                    if (body && typeof body === 'object' && body.ok === false) continue;
                    sendResponse({ success: true, ok: true, online: true, port, endpoint: path });
                    return;
                } catch (err) {
                    console.warn('[CREATY Ghost] background ping failed', { port, path, error: err?.message || err });
                }
            }
            sendResponse({ success: true, ok: false, online: false, port, error: 'ghost_offline' });
        })();
        return true;
    }
    if (req.action === 'wake_creaty_server') {
        (async () => {
            try {
                const pingRes = await fetch(nhpUrl(3020, '/ping'), { method: 'GET', signal: AbortSignal.timeout(2500) });
                if (pingRes.ok) {
                    sendResponse({ success: true, source: 'already-running', port: 3020 });
                    return;
                }
            } catch (_) { }
            const launchResult = await controlCreatyServerProcess('start');
            if (!launchResult.success) {
                sendResponse({ success: false, port: 3020, ...launchResult });
                return;
            }
            for (let attempt = 1; attempt <= 6; attempt += 1) {
                await delay(2000);
                try {
                    const pingRes = await fetch(nhpUrl(3020, '/ping'), { method: 'GET', signal: AbortSignal.timeout(2500) });
                    if (pingRes.ok) {
                        sendResponse({ success: true, source: launchResult.source, attempt, port: 3020 });
                        return;
                    }
                } catch (_) { }
            }
            sendResponse({ success: false, source: 'bootstrap-failed', port: 3020, error: 'Creaty did not respond to /ping in time.' });
        })();
        return true;
    }
    if (req.action === 'wake_server') {
        const platform = req.platform || 'teepublic';
        const targetPort = req.port || ({ teepublic: 3019, redbubble: 3021, amazon: 3022, pinterest: 3023 }[platform]) || 3019;
        if (wakeServerInFlight.has(platform)) {
            console.log('[Server Manager] Start already in progress:', { platform });
            sendResponse({ success: false, pending: true, source: 'already-starting', platform });
            return true;
        }

        const managerUrl = nhpUrl(3009, `/api/server/${platform}/start`);

        const startPlatformServer = async () => {
            const res = await fetch(managerUrl, { method: 'POST', signal: AbortSignal.timeout(4000) });
            if (!res.ok) throw new Error(`Manager API returned ${res.status}`);
            return res.json();
        };

        wakeServerInFlight.set(platform, true);
        (async () => {
            const pingPlatformPort = async () => {
                const res = await fetch(nhpUrl(targetPort, '/ping'), { method: 'GET', signal: AbortSignal.timeout(2500) });
                if (!res.ok) throw new Error(`Direct ping returned ${res.status}`);
                return { ok: true, port: targetPort };
            };

            try {
                try {
                    const data = await startPlatformServer();
                    console.log('[Server Manager] Started via API:', data);
                    sendResponse({ success: true, source: 'manager-api', data, platform, port: targetPort });
                    return;
                } catch (firstError) {
                    console.warn('[Server Manager] API unavailable, bootstrapping core server...', firstError);
                    let launchResult;
                    try {
                        launchResult = await controlGhostServerProcess('start', platform, req.interactive !== false);
                    } catch (launchErr) {
                        console.error('[Server Manager] controlGhostServerProcess threw', launchErr);
                        const mapped = mapGhostServerLaunchError(launchErr, { action: 'start', platform, port: targetPort });
                        sendResponse({
                            success: false,
                            ok: false,
                            source: mapped.source || 'spawn',
                            platform,
                            port: targetPort,
                            error: mapped.error,
                            message: mapped.message,
                            permissionRequired: false,
                        });
                        return;
                    }
                    if (!launchResult?.success) {
                        sendResponse({
                            success: false,
                            ok: false,
                            source: launchResult.source || 'unavailable',
                            platform,
                            port: targetPort,
                            error: launchResult.error || 'UNAVAILABLE',
                            message: launchResult.message || launchResult.error || 'Ï¬Ï╣Ï░Ï▒ Ï¬Ï┤Ï║┘è┘ä Ghost Server',
                            permissionRequired: !!launchResult.permissionRequired,
                        });
                        return;
                    }

                    for (let attempt = 1; attempt <= 6; attempt++) {
                        await delay(2500);
                        try {
                            const directState = await pingPlatformPort();
                            console.log(`[Server Manager] Direct platform ping succeeded after bootstrap (attempt ${attempt}):`, { platform, port: targetPort });
                            sendResponse({
                                success: true,
                                source: launchResult.source === 'custom_protocol' ? 'custom_protocol' : 'direct-ping',
                                attempt,
                                data: directState,
                                platform,
                                port: targetPort,
                                permissionRequired: !!launchResult.permissionRequired
                            });
                            return;
                        } catch (directPingError) {
                            console.warn(`[Server Manager] Direct ping ${attempt} failed`, directPingError);
                        }

                        try {
                            const data = await startPlatformServer();
                            console.log(`[Server Manager] Started via API after bootstrap (attempt ${attempt}):`, data);
                            sendResponse({ success: true, source: 'bootstrap-retry', attempt, data, platform, port: targetPort });
                            return;
                        } catch (retryError) {
                            console.warn(`[Server Manager] Retry ${attempt} failed`, retryError);
                        }
                    }

                    sendResponse({
                        success: false,
                        ok: false,
                        source: 'bootstrap-failed',
                        platform,
                        port: targetPort,
                        error: 'BOOTSTRAP_TIMEOUT',
                        message: 'Ïº┘åÏ¬┘çÏ¬ ┘à┘ç┘äÏ® Ïº┘åÏ¬Ï©ÏºÏ▒ Ghost Server ÔÇö Ï¬Ï¡┘é┘é ┘à┘å Ïº┘ä┘à┘å┘üÏ░ 3019',
                        permissionRequired: !!launchResult.permissionRequired
                    });
                }
            } catch (err) {
                console.error('[Server Manager] wake_server failed', err);
                const mapped = mapGhostServerLaunchError(err, { action: 'start', platform, port: targetPort });
                sendResponse({
                    success: false,
                    ok: false,
                    source: mapped.source || 'wake_server',
                    platform,
                    port: targetPort,
                    error: mapped.error,
                    message: mapped.message,
                });
            } finally {
                wakeServerInFlight.delete(platform);
            }
        })();

        return true;
    }

    if (req.action === 'stop_server') {
        const platform = req.platform || 'teepublic';
        const targetPort = req.port || ({ teepublic: 3019, redbubble: 3021, amazon: 3022, pinterest: 3023 }[platform]) || 3019;

        (async () => {
            try {
                await fetch(nhpUrl(targetPort, '/shutdown'), { method: 'GET', signal: AbortSignal.timeout(2500) }).catch(() => null);
                await delay(1200);
                try {
                    await fetchJsonWithTimeout(nhpUrl(targetPort, '/ping'), {}, 1500);
                } catch (_) {
                    sendResponse({ success: true, source: 'http-shutdown', platform, port: targetPort });
                    return;
                }
            } catch (_) { }

            const stopResult = await controlGhostServerProcess('stop', platform);
            if (!stopResult.success) {
                sendResponse({
                    success: false,
                    source: stopResult.source || 'unavailable',
                    platform,
                    port: targetPort,
                    error: stopResult.error || 'Unable to stop Ghost Server.'
                });
                return;
            }

            await delay(1200);
            try {
                await fetchJsonWithTimeout(nhpUrl(targetPort, '/ping'), {}, 1500);
                sendResponse({
                    success: false,
                    source: stopResult.source,
                    platform,
                    port: targetPort,
                    error: 'Server process is still responding after stop request.'
                });
            } catch (_) {
                sendResponse({ success: true, source: stopResult.source, platform, port: targetPort });
            }
        })();

        return true;
    }

    if (req.action === 'control_non_autopilot_servers') {
        const action = req.command === 'stop' ? 'stop' : 'start';
        const interactive = req.interactive === true;
        (async () => {
            const result = await controlNonAutopilotServers(action, interactive);
            if (result.success && action === 'start') {
                // Low-spec devices may need longer startup time for protocol-launched servers.
                for (let attempt = 1; attempt <= 15; attempt += 1) {
                    await delay(1000);
                    try {
                        const ping = await fetchJsonWithTimeout(`${getAiBridgeServerUrl()}/ping`, {}, 1800);
                        sendResponse({ ...result, online: true, ping, attempt, port: AI_BRIDGE_SERVER_PORT });
                        return;
                    } catch (_) { }
                }
                sendResponse({ ...result, online: false, port: AI_BRIDGE_SERVER_PORT });
                return;
            }
            sendResponse({ ...result, port: AI_BRIDGE_SERVER_PORT });
        })();
        return true;
    }

    if (req.action === 'control_ai_chrome_session') {
        const action = req.command === 'restart' ? 'restart' : 'start';
        const interactive = req.interactive === true;
        (async () => {
            const result = await controlAiChromeSession(action, interactive);
            if (result.success) {
                // Controlled Chrome may need extra warmup on older CPUs/disks.
                for (let attempt = 1; attempt <= 18; attempt += 1) {
                    await delay(1000);
                    try {
                        const response = await fetchJsonWithTimeout(nhpUrl(9331, '/json/version'), {}, 1800);
                        sendResponse({ ...result, online: true, attempt, browser: response });
                        return;
                    } catch (_) { }
                }
            }
            sendResponse({ ...result, online: false });
        })();
        return true;
    }

    if (req.action === 'control_ai_image_sender_stack') {
        const interactive = req.interactive === true;
        (async () => {
            const state = {
                success: false,
                bridge3031: { online: false },
                chrome9331: { online: false }
            };
            try {
                const bridgeStart = await controlNonAutopilotServers('start', interactive);
                state.bridge3031.start = bridgeStart;
                if (!bridgeStart?.success) {
                    sendResponse({ ...state, error: bridgeStart?.error || 'Unable to start AI Bridge 3031.' });
                    return;
                }
                for (let attempt = 1; attempt <= 15; attempt += 1) {
                    await delay(1000);
                    try {
                        const ping = await fetchJsonWithTimeout(`${getAiBridgeServerUrl()}/ping`, {}, 1800);
                        state.bridge3031 = { online: true, attempt, port: AI_BRIDGE_SERVER_PORT, ping };
                        break;
                    } catch (error) {
                        state.bridge3031 = { online: false, attempt, port: AI_BRIDGE_SERVER_PORT, error: error?.message || 'offline' };
                    }
                }
                if (!state.bridge3031.online) {
                    sendResponse({ ...state, error: 'AI Bridge 3031 did not become ready.' });
                    return;
                }

                const chromeStart = await controlAiChromeSession('restart', interactive);
                state.chrome9331.start = chromeStart;
                if (!chromeStart?.success) {
                    sendResponse({ ...state, error: chromeStart?.error || 'Unable to start controlled Chrome 9331.' });
                    return;
                }
                for (let attempt = 1; attempt <= 18; attempt += 1) {
                    await delay(1000);
                    try {
                        const browser = await fetchJsonWithTimeout(nhpUrl(9331, '/json/version'), {}, 1800);
                        state.chrome9331 = { online: true, attempt, port: 9331, browser };
                        break;
                    } catch (error) {
                        state.chrome9331 = { online: false, attempt, port: 9331, error: error?.message || 'offline' };
                    }
                }
                state.success = !!state.bridge3031.online && !!state.chrome9331.online;
                sendResponse(state.success ? state : { ...state, error: 'Controlled Chrome 9331 did not become ready.' });
            } catch (error) {
                sendResponse({ ...state, error: error?.message || 'Unable to start AI image sender stack.' });
            }
        })();
        return true;
    }

    if (req.action === 'open_account_browser') {
        (async () => {
            const result = await launchExternalAccountBrowser(req);
            if (!result.success) {
                console.warn('[Account Browser] External launch unavailable; refusing main-browser fallback', result);
            }
            sendResponse(result);
        })();
        return true;
    }

    if (req.action === 'pageReady') {
        getStorage(['uRunning']).then(data => { if (data.uRunning && !isUSPTOProcessing) setTimeout(() => { void startUSPTOProcessing(); }, 500); });
        return false;
    }

    if (req.action === 'fetch_trends' || req.type === 'FETCH_TRENDS') {
        if (req.action === 'fetch_trends') {
            (async () => {
                try {
                    const data = await fetchTrendsFromTeePublic();
                    sendResponse({ success: true, data });
                } catch (error) {
                    console.warn('[NHP][Trends] fetch_trends failed:', error?.message || error);
                    sendResponse({
                        success: false,
                        error: error?.message || '┘üÏ┤┘ä Ï¼┘äÏ¿ Ïº┘äÏ¬Ï▒┘åÏ»ÏºÏ¬ ┘à┘å Ïº┘äÏ«┘ä┘ü┘èÏ®'
                    });
                }
            })();
        } else {
            handleArtisanFetchTrends(req).then(res => sendResponse(res));
        }
        return true;
    }

    if (req.action === 'call_gemini' || req.type === 'CALL_GEMINI') {
        (async () => {
            const apiKey = req.apiKey || await getInternalGeminiApiKey();
            if (!apiKey) {
                sendResponse({ success: false, error: 'Gemini key is missing in local storage.' });
                return;
            }
            const prompt = req.prompt || req.payload;

            console.log(`[AI Pro] Routing Request: ${req.base64 ? 'Multimodal' : 'Text'}`);

            const processResult = (res) => {
                if (res && res.error) {
                    console.error('[AI Pro] API Error:', res.error);
                    return sendResponse({ success: false, error: res.error });
                }
                const data = res.data || res;
                sendResponse({ success: true, data: data });
            };

            const resolvedMimeType = (() => {
                const explicit = String(req.mimeType || '').trim();
                if (explicit) return explicit;
                const input = String(req.base64 || '');
                const dataUrlMatch = input.match(/^data:([^;,]+)[;,]/i);
                return dataUrlMatch?.[1] || 'image/png';
            })();
            const rawB64 = (req.base64 && req.base64.includes(',')) ? req.base64.split(',')[1] : req.base64;
            const cleanBase64 = String(rawB64 || '').replace(/\s/g, '');

            if (cleanBase64) {
                callGeminiWithImage(prompt, cleanBase64, resolvedMimeType, apiKey)
                    .then(processResult)
                    .catch(err => {
                        console.warn('[NHP-IMG] error', err?.message, err?.stack?.split('\n')[0]);
                        sendResponse({ success: false, error: err.message });
                    });
            } else {
                callGeminiArtisan(prompt, apiKey)
                    .then(res => {
                        if (res.error) return processResult(res);
                        const text = res.result || "";
                        const jsonMatch = text.match(/\{[\s\S]*\}/);
                        processResult(jsonMatch ? JSON.parse(jsonMatch[0]) : { result: text });
                    })
                    .catch(err => sendResponse({ success: false, error: err.message }));
            }
        })();
        return true;
    }

    if (req.action === 'call_gpt') {
        (async () => {
            try {
            const apiKey = req.apiKey || '';
            const explicitBaseUrl = String(req.baseUrl || '').trim();
            const baseUrl = explicitBaseUrl ? normalizeCliProxyBaseUrl(explicitBaseUrl) : '';
            const proxyRoutingMode = String(req.proxyRoutingMode || '').trim() || undefined;
            const batchIndex = Number.isFinite(Number(req.batchIndex)) ? Number(req.batchIndex) : undefined;
            const endpointId = String(req.endpointId || '').trim() || undefined;
            const prompt = req.prompt || req.payload || '';
            const { cleanBase64, resolvedMimeType } = resolveSeoInlineImageParts(req.base64, req.mimeType || 'image/png');
            const retryContext = String(req.retryContext || 'call_gpt').trim() || 'call_gpt';
            const model = String(req.model || CLI_PROXY_API_DEFAULT_MODEL).trim() || CLI_PROXY_API_DEFAULT_MODEL;
            const isStudioRename = retryContext === 'studio-rename';
            const isQueueRename = retryContext === 'queue-rename';
            const isSeoGpt = retryContext === 'seo-gpt';
            const usePersistentRetry = req.persistentRetry !== false
                && (!explicitBaseUrl || isCliProxyHostBaseUrl(baseUrl))
                && !isStudioRename
                && !isQueueRename;
            const requestedMaxAttempts = Math.max(0, Number(req.maxAttempts) || 0);
            const requestedFetchTimeoutMs = Math.max(0, Number(req.fetchTimeoutMs) || 0);
            const maxAttempts = (isStudioRename || isQueueRename)
                ? CLI_PROXY_STUDIO_RENAME_MAX_ATTEMPTS
                : (requestedMaxAttempts || (isSeoGpt ? CLI_PROXY_SEO_GPT_MAX_ATTEMPTS : 0));
            const fetchTimeoutMs = (isStudioRename || isQueueRename)
                ? CLI_PROXY_STUDIO_RENAME_TIMEOUT_MS
                : (requestedFetchTimeoutMs || (isSeoGpt ? CLI_PROXY_SEO_GPT_TIMEOUT_MS : undefined));
            const callFn = usePersistentRetry ? callOpenAiCompatibleSeoWithPersistentRetry : callOpenAiCompatibleSeo;
            const result = await callFn(prompt, cleanBase64 || null, resolvedMimeType, apiKey, {
                baseUrl: baseUrl || undefined,
                model,
                source: 'cliproxy-api',
                retryContext,
                persistentRetry: usePersistentRetry,
                proxyFailover: !explicitBaseUrl,
                proxyRoutingMode,
                batchIndex,
                endpointId,
                maxAttempts,
                fetchTimeoutMs
            });
            if (result?.error) {
                sendResponse({ success: false, error: result.error });
                return;
            }
            sendResponse({ success: true, data: result });
            } catch (error) {
                try {
                    sendResponse({ success: false, error: error?.message || String(error) });
                } catch (_) { /* channel may already be closed */ }
            }
        })();
        return true;
    }

    if (req.action === 'call_cursor_api') {
        (async () => {
            const apiKey = req.apiKey || '';
            const prompt = req.prompt || req.payload || '';
            const { cleanBase64, resolvedMimeType } = resolveSeoInlineImageParts(req.base64, req.mimeType || 'image/png');
            const result = cleanBase64
                ? await callOpenAiCompatibleSeo(prompt, cleanBase64, resolvedMimeType, apiKey, {
                    baseUrl: 'https://api.cursor.com/v1',
                    model: 'gpt-4o-mini',
                    source: 'cursor-api'
                })
                : await callCursorSeo(prompt, null, resolvedMimeType, apiKey);
            if (result?.error) {
                sendResponse({ success: false, error: result.error });
                return;
            }
            sendResponse({ success: true, data: result });
        })();
        return true;
    }

    if (req.action === 'call_gemini_web') {
        runGeminiWebTaskWithFallback({
            prompt: req.prompt || req.payload || '',
            base64: req.base64 || null,
            mimeType: req.mimeType || 'image/png',
            mode: req.taskMode || 'text',
            primaryUrl: req.url || GEMINI_SEO_GEM_URL,
            fallbackUrl: req.fallbackUrl || CHATGPT_SEO_GPT_URL
        })
            .then((result) => {
                sendResponse({
                    success: true,
                    data: result.text ? { result: result.text, source: result.provider || 'gemini-primary' } : result
                });
            })
            .catch((error) => sendResponse({ success: false, error: error.message || 'Gemini Web bridge failed.' }));
        return true;
    }

    if (req.action === 'call_gemini_web_batch') {
        const batchPrimaryUrl = normalizeGeminiTargetUrl(req.url, GEMINI_SEO_GEM_URL);
        runGeminiWebBatchSession({
            items: req.items || [],
            primaryUrl: batchPrimaryUrl,
            fallbackUrl: req.fallbackUrl || CHATGPT_SEO_GPT_URL,
            mode: req.taskMode || 'text'
        })
            .then((result) => {
                sendResponse({
                    success: true,
                    data: {
                        results: result.results || [],
                        provider: result.provider || 'gemini-primary'
                    }
                });
            })
            .catch((error) => sendResponse({ success: false, error: error.message || 'Gemini Web batch failed.' }));
        return true;
    }

    if (req.action === 'RADAR_UNOFFICIAL_GET_STATE') {
        getRadarUnofficialDashboardPayload()
            .then((payload) => sendResponse({ success: true, ...payload }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (req.action === 'RADAR_UNOFFICIAL_SCAN') {
        queueRadarUnofficialScan()
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (req.action === 'RADAR_UNOFFICIAL_GENERATE_AI') {
        queueRadarUnofficialAiGeneration()
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (req.action === 'RADAR_UNOFFICIAL_SAVE_TO_NOTE') {
        radarUnofficialSaveToNote(req)
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (req.action === 'RADAR_UNOFFICIAL_SEND_TO_PIPELINE') {
        radarUnofficialSendToPipeline(req)
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (req.action === 'ap_get_queue_state') {
        const live = apQueueStateCache || null;
        if (live?.isRunning && !apProcessRunning) {
            const cleared = sanitizeIdleApQueueState({
                ...live,
                isRunning: false,
                stopped: false,
                overallStatus: 'waiting',
                finishedAt: new Date().toISOString(),
                selectedAccountIds: [],
                selectedAccountCount: 0,
                completedAccountCount: 0,
                completedUploads: 0,
                totalPlannedUploads: 0,
                overallProgressPercent: 0,
                perAccount: [],
                perDesign: [],
                ...clearApCurrentAccountFields()
            }) || {
                isRunning: false,
                overallStatus: 'waiting',
                perAccount: [],
                perDesign: [],
                ...clearApCurrentAccountFields()
            };
            void publishApQueueState({ __replace: true, ...cleared }, { replace: true }).then((published) => {
                sendResponse({ success: true, data: published || cleared });
            });
            return true;
        }
        chrome.storage.local.get([AP_UPLOAD_QUEUE_STATE_KEY], (res) => {
            let stored = res?.[AP_UPLOAD_QUEUE_STATE_KEY] || live || null;
            if (stored?.isRunning && !apProcessRunning) {
                const cleared = sanitizeIdleApQueueState({
                    ...stored,
                    isRunning: false,
                    stopped: false,
                    overallStatus: 'waiting',
                    finishedAt: new Date().toISOString(),
                    ...clearApCurrentAccountFields()
                }) || { ...stored, isRunning: false, overallStatus: 'waiting', ...clearApCurrentAccountFields() };
                void publishApQueueState({ __replace: true, ...cleared }, { replace: true });
                sendResponse({ success: true, data: cleared });
                return;
            }
            const sanitized = sanitizeIdleApQueueState(stored) || stored;
            if (stored && sanitized !== stored && apQueueStateHasStaleUploadMarkers(stored)) {
                void publishApQueueState({ __replace: true, ...sanitized }, { replace: true });
            }
            sendResponse({ success: true, data: sanitized });
        });
        return true;
    }

    if (req.action === 'seq_upload_guard_unlock') {
        const guard = typeof NhpSeqUploadGuard !== 'undefined' ? NhpSeqUploadGuard : null;
        if (!guard) {
            sendResponse({ success: false, error: 'guard_unavailable' });
            return false;
        }
        guard.unlock(req.key).then(sendResponse).catch((e) => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (req.action === 'seq_upload_guard_lock') {
        const guard = typeof NhpSeqUploadGuard !== 'undefined' ? NhpSeqUploadGuard : null;
        if (!guard) {
            sendResponse({ success: false, error: 'guard_unavailable' });
            return false;
        }
        guard.lock().then(sendResponse).catch((e) => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (req.action === 'seq_upload_guard_status') {
        const guard = typeof NhpSeqUploadGuard !== 'undefined' ? NhpSeqUploadGuard : null;
        if (!guard) {
            sendResponse({ success: false, error: 'guard_unavailable' });
            return false;
        }
        guard.readUnlockState()
            .then((unlocked) => sendResponse({ success: true, unlocked, ttlMs: guard.UNLOCK_TTL_MS }))
            .catch((e) => sendResponse({ success: false, error: e.message }));
        return true;
    }

    if (req.action === 'ap_start') {
        console.warn('[AP] background ap_start received', {
            accountCount: Array.isArray(req.data?.accounts) ? req.data.accounts.length : 0,
            selectedAccountIds: req.data?.selectedAccountIds,
            isFairDistribution: req.data?.isFairDistribution,
            explicitFairDistributionOff: req.data?.explicitFairDistributionOff,
            seoReadyCount: req.data?.seoReadyCount,
            emails: (req.data?.accounts || []).map((a) => a?.email).filter(Boolean)
        });
        apStopped = false;
        startHeartbeat();
        sendResponse({ success: true, accepted: true });
        void (async () => {
            try {
                const res = await new Promise((resolve) => {
                    chrome.storage.local.get([
                        'ap_last_start_config',
                        AP_UPLOAD_QUEUE_STATE_KEY,
                        'selectedAdminNormalAccountIds',
                        'selectedAdminCreatyAccountIds',
                        AP_ADMIN_USER_SELECTION_SAVED_KEY
                    ], resolve);
                });
                if (apProcessRunning) {
                    const staleQueue = apQueueStateCache?.isRunning || res?.[AP_UPLOAD_QUEUE_STATE_KEY]?.isRunning;
                    if (!staleQueue) {
                        console.warn('[AP] Resetting stale apProcessRunning ÔÇö no active queue');
                        apProcessRunning = false;
                    } else {
                        logApProcessAbort('ap_start_duplicate_while_running', { path: 'ap_start_guard' });
                        chrome.runtime.sendMessage({
                            action: 'ap_update',
                            log: 'ÔÅ│ Ïº┘äÏ▒┘üÏ╣ ┘é┘èÏ» Ïº┘äÏ¬┘å┘ü┘èÏ░ Ï¿Ïº┘ä┘üÏ╣┘ä ÔÇö Ï¬┘à Ï¬Ï¼Ïº┘ç┘ä ÏÀ┘äÏ¿ Ï¿Ï»Ïí ┘à┘âÏ▒Ï▒ ┘ä┘à┘åÏ╣ ┘üÏ¬Ï¡ ┘å┘êÏº┘üÏ░ Ï¡Ï│ÏºÏ¿ÏºÏ¬ ┘àÏ¬Ï╣Ï»Ï»Ï®',
                            toast: 'ÔÅ│ Ïº┘äÏ▒┘üÏ╣ ┘é┘èÏ» Ïº┘äÏ¬┘å┘ü┘èÏ░ Ï¿Ïº┘ä┘üÏ╣┘ä ÔÇö Ïº┘åÏ¬Ï©Ï▒ Ïº┘âÏ¬┘àÏº┘ä Ïº┘äÏ╣┘à┘ä┘èÏ® Ïº┘äÏ¡Ïº┘ä┘èÏ® Ïú┘ê Ïú┘ê┘é┘ü┘çÏº',
                            done: true,
                            success: false,
                            type: 'warning'
                        });
                        stopHeartbeat();
                        return;
                    }
                }
                const storedQueue = res?.[AP_UPLOAD_QUEUE_STATE_KEY];
                if (apQueueStateCache?.isRunning || storedQueue?.isRunning) {
                    apQueueStateCache = null;
                    await publishApQueueState({
                        __replace: true,
                        isRunning: false,
                        stopped: false,
                        overallStatus: 'failed',
                        finishedAt: new Date().toISOString(),
                        selectedAccountIds: [],
                        perAccount: [],
                        perDesign: [],
                        ...clearApCurrentAccountFields()
                    }, { replace: true });
                    chrome.runtime.sendMessage({
                        action: 'ap_update',
                        log: 'ÔÖ╗´©Å Ï¬┘à ┘àÏ│Ï¡ Ï¡Ïº┘äÏ® Ï▒┘üÏ╣ Ï╣Ïº┘ä┘éÏ® ┘à┘å Ï¼┘äÏ│Ï® Ï│ÏºÏ¿┘éÏ®',
                        toast: 'ÔÖ╗´©Å Ï¬┘àÏ¬ ÏÑÏ╣ÏºÏ»Ï® Ï¬Ï╣┘è┘è┘å Ï¡Ïº┘äÏ® Ï▒┘üÏ╣ Ï╣Ïº┘ä┘éÏ® ÔÇö Ï¼ÏºÏ▒┘è Ïº┘äÏ¿Ï»Ïí',
                        type: 'warning'
                    });
                }
                const guard = typeof NhpSeqUploadGuard !== 'undefined' ? NhpSeqUploadGuard : null;
                if (guard) {
                    const check = await guard.assertSeqGuard({
                        enqueue: { fn: enqueueStartAPProcess, needles: guard.MARKERS.enqueue }
                    }, 'ap_start');
                    if (!check.ok) {
                        apProcessRunning = false;
                        logApProcessAbort('seq_upload_guard_blocked', { path: 'ap_start_seq_guard' });
                        chrome.runtime.sendMessage({
                            action: 'ap_update',
                            log: '­ƒöÆ Ï¡┘àÏº┘èÏ® Ïº┘äÏ▒┘üÏ╣ Ïº┘ä┘àÏ¬Ï│┘äÏ│┘ä: Ï¬Ï╣Ï»┘è┘ä Ï║┘èÏ▒ ┘àÏÁÏ▒┘æÏ¡ ÔÇö ÏúÏ»Ï«┘ä Ïº┘ä┘à┘üÏ¬ÏºÏ¡ 693400 Ï╣Ï¿Ï▒ seq_upload_guard_unlock',
                            toast: '­ƒöÆ ┘üÏ┤┘ä Ï¿Ï»Ïí Ïº┘äÏ▒┘üÏ╣ ÔÇö Ï¡┘àÏº┘èÏ® Ïº┘äÏ▒┘üÏ╣ Ïº┘ä┘àÏ¬Ï│┘äÏ│┘ä Ï║┘èÏ▒ ┘à┘üÏ╣┘æ┘äÏ®',
                            done: true,
                            success: false,
                            type: 'error'
                        });
                        stopHeartbeat();
                        return;
                    }
                }
                const persisted = res.ap_last_start_config || {};
                const mergedConfig = await buildApStartConfigFromRequest(req.data || {}, persisted, res);
                if (!mergedConfig) {
                    apProcessRunning = false;
                    console.warn('[Autopilot][Upload] ap_start aborted ÔÇö no resolved accounts', {
                        payloadIds: req.data?.selectedAccountIds,
                        payloadEmails: (req.data?.accounts || []).map((a) => a?.email).filter(Boolean),
                        userSaved: res?.[AP_ADMIN_USER_SELECTION_SAVED_KEY] === true
                    });
                    await abortApUploadEarly('ÔÜá´©Å ┘èÏ▒Ï¼┘ë ÏºÏ«Ï¬┘èÏºÏ▒ Ï¡Ï│ÏºÏ¿ ┘êÏºÏ¡Ï» Ï╣┘ä┘ë Ïº┘äÏú┘é┘ä ÔÇö Ï¬Ïú┘âÏ» ┘à┘å Ï¡┘üÏ© Ïº┘äÏºÏ«Ï¬┘èÏºÏ▒ Ï½┘à ÏúÏ╣Ï» Ïº┘ä┘àÏ¡Ïº┘ê┘äÏ®');
                    return;
                }
                const selectedIds = Array.isArray(mergedConfig.selectedAccountIds)
                    ? mergedConfig.selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
                    : [];
                const accountCount = Array.isArray(mergedConfig.accounts) ? mergedConfig.accounts.length : 0;
                const selectedEmails = (mergedConfig.accounts || []).map((acc) => acc?.email).filter(Boolean);
                console.log('[AP] ap_start selected emails:', selectedEmails, {
                    isFairDistribution: mergedConfig.isFairDistribution !== false,
                    accountCount
                });
                if (selectedIds.length === 0 || accountCount === 0) {
                    apProcessRunning = false;
                    await abortApUploadEarly('ÔÜá´©Å ┘èÏ▒Ï¼┘ë ÏºÏ«Ï¬┘èÏºÏ▒ Ï¡Ï│ÏºÏ¿ ┘êÏºÏ¡Ï» Ï╣┘ä┘ë Ïº┘äÏú┘é┘ä');
                    return;
                }
                const queueRes = await new Promise((resolve) => chrome.storage.local.get(['savedDesignQueue'], resolve));
                const rawQueue = Array.isArray(queueRes?.savedDesignQueue) ? queueRes.savedDesignQueue : [];
                const seoReadyCount = rawQueue.filter((d) => d?.meta).length;
                console.log('[AP] ap_start queue:', { total: rawQueue.length, seoReady: seoReadyCount });
                if (rawQueue.length === 0) {
                    apProcessRunning = false;
                    await abortApUploadEarly('ÔÜá´©Å Ïº┘ä┘éÏºÏª┘àÏ® ┘üÏºÏ▒Ï║Ï®! ÏúÏÂ┘ü Ï¬ÏÁÏº┘à┘è┘à Ïú┘ê┘äÏº┘ï');
                    return;
                }
                if (seoReadyCount === 0) {
                    apProcessRunning = false;
                    await abortApUploadEarly('ÔÜá´©Å ┘äÏº Ï¬┘êÏ¼Ï» Ï¬ÏÁÏº┘à┘è┘à Ï¼Ïº┘çÏ▓Ï® ÔÇö ┘å┘ü┘æÏ░ Ïº┘äÏ¬Ï¡┘ä┘è┘ä Ïº┘äÏ░┘â┘è (SEO) Ïú┘ê┘äÏº┘ï');
                    return;
                }
                const { perAccount: _dropPerAccount, perDesign: _dropPerDesign, ...cleanStartConfig } = mergedConfig;
                await setStorage({
                    ap_last_start_config: { ...cleanStartConfig, startedAt: new Date().toISOString() }
                });
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `­ƒº¥ Ï¿Ï»Ïí Ïº┘äÏÀ┘èÏºÏ▒ Ïº┘äÏó┘ä┘è | rawCountPer=${req.data?.countPer ?? 'null'} | countPer=${mergedConfig.countPer} | selected=${selectedIds.length} | accounts=${accountCount} | emails=${selectedEmails.join(', ')} | queueReady=${seoReadyCount}`,
                    toast: `­ƒÜÇ Ï¿Ï»Ïí Ïº┘äÏ▒┘üÏ╣ ÔÇö ${selectedEmails.join(', ')} | ${seoReadyCount} Ï¬ÏÁ┘à┘è┘à`,
                    type: 'info'
                });
                await enqueueStartAPProcess(mergedConfig);
            } catch (err) {
                console.error('[AP] ap_start failed:', err);
                logApProcessAbort(err?.message || 'ap_start_exception', { path: 'ap_start_catch' });
                apProcessRunning = false;
                stopHeartbeat();
                await abortApUploadEarly(`ÔÜá´©Å ┘üÏ┤┘ä Ï¿Ï»Ïí Ïº┘äÏ▒┘üÏ╣: ${err?.message || 'Ï«ÏÀÏú Ï║┘èÏ▒ ┘àÏ╣Ï▒┘ê┘ü'}`);
            }
        })();
        return true;
    }

    if (req.action === 'ap_retry_failed') {
        apStopped = false;
        startHeartbeat();
        chrome.storage.local.get(['ap_last_start_config', AP_UPLOAD_QUEUE_STATE_KEY, AP_UPLOAD_MONITOR_LOG_KEY], (res) => {
            const state = res?.[AP_UPLOAD_QUEUE_STATE_KEY] || apQueueStateCache || {};
            const retryConfig = buildApFailedRetryConfig(res?.ap_last_start_config || {}, state);
            if (!retryConfig) {
                sendResponse({ success: false, error: '┘äÏº Ï¬┘êÏ¼Ï» Ï╣┘åÏºÏÁÏ▒ ┘üÏºÏ┤┘äÏ® ┘ä┘äÏºÏ│Ï¬Ï»Ï▒Ïº┘â.' });
                stopHeartbeat();
                return;
            }
            const designCount = retryConfig.retryPlan.reduce((sum, item) => sum + item.queueItemIds.length, 0);
            chrome.storage.local.set({ ap_last_start_config: { ...retryConfig, startedAt: new Date().toISOString() } }, () => {
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `­ƒöü ÏºÏ│Ï¬Ï»Ï▒Ïº┘â Ïº┘äÏ▒┘üÏ╣ Ïº┘ä┘üÏºÏ┤┘ä | Ï¡Ï│ÏºÏ¿ÏºÏ¬=${retryConfig.accounts.length} | Ï¬ÏÁÏº┘à┘è┘à=${designCount}`,
                    toast: `­ƒöü ÏÑÏ╣ÏºÏ»Ï® Ï▒┘üÏ╣ ${designCount} Ï¬ÏÁ┘à┘è┘à ┘üÏºÏ┤┘ä ┘ü┘éÏÀ`,
                    type: 'info'
                });
                enqueueStartAPProcess(retryConfig).catch(console.error);
                sendResponse({ success: true, retryAccounts: retryConfig.accounts.length, retryDesigns: designCount });
            });
        });
        return true;
    }

    if (req.action === 'ap_get_upload_monitor') {
        chrome.storage.local.get([AP_UPLOAD_MONITOR_LOG_KEY], (res) => {
            sendResponse({ success: true, data: res?.[AP_UPLOAD_MONITOR_LOG_KEY] || apUploadMonitorRun || null });
        });
        return true;
    }

    if (req.action === 'TMH_START_SEARCH' || req.action === 'START_SEARCH') { startTMHSearchProcess(req.niches); sendResponse({ status: 'STARTED' }); return true; }
    if (req.action === 'TMH_TOGGLE_WINDOW' || req.action === 'TOGGLE_WINDOW') { toggleTMHPreviewWindow(); return true; }
    if (req.action === 'TMH_TOGGLE_PAUSE' || req.action === 'TOGGLE_PAUSE') { handleTMHTogglePause(); return true; }
    if (req.action === 'TMH_RESET_SEARCH' || req.action === 'RESET_SEARCH') { resetTMHSearchProcess(); return true; }

    if (req.action === 'BUILD_RADAR_APPAREL_PROMPT') {
        sendResponse({ success: true, prompt: buildRadarNicheApparelPrompt(req.niche || req.query || '') });
        return true;
    }

    if (req.action === 'BUILD_RADAR_MERGE_APPAREL_PROMPT') {
        sendResponse({ success: true, prompt: buildRadarNicheMergeApparelPrompt(req.niche || req.query || '') });
        return true;
    }

    if (req.action === 'BUILD_RADAR_CROSS_NICHE_MERGE_APPAREL_PROMPT') {
        const nicheA = String(req.nicheA || '').trim();
        const nicheB = String(req.nicheB || '').trim();
        const primaryNiche = String(req.primaryNiche || nicheA || '').trim();
        sendResponse({
            success: true,
            prompt: buildRadarCrossNicheMergeApparelPrompt({ nicheA, nicheB, primaryNiche }),
            libraryDisplayName: buildMergedNicheDisplayName(nicheA, nicheB),
            primaryNiche,
            nicheA,
            nicheB
        });
        return true;
    }

    if (req.action === 'BUILD_RADAR_CHARACTER_CROSSOVER_APPAREL_PROMPT') {
        const niche = String(req.niche || '').trim();
        const character = normalizePromptBagCharacterName(req.character)
            || resolvePromptBagCharacterCrossoverFallback(niche);
        sendResponse({
            success: true,
            prompt: buildRadarCharacterCrossoverApparelPrompt({ niche, character }),
            libraryDisplayName: buildCharacterCrossoverDisplayName(character, niche),
            character,
            niche
        });
        return true;
    }

    if (req.action === 'BUILD_PROMPT_BAG_CROSS_NICHE_MERGE') {
        (async () => {
            try {
                const pack = await buildPromptBagCrossNicheMergePack(req);
                sendResponse({ success: true, ...pack });
            } catch (error) {
                const nicheA = String(req.nicheA || '').trim();
                const nicheB = String(req.nicheB || '').trim();
                sendResponse({
                    success: true,
                    prompt: buildRadarCrossNicheMergeApparelPrompt({ nicheA, nicheB, primaryNiche: nicheA }),
                    libraryDisplayName: buildMergedNicheDisplayName(nicheA, nicheB),
                    primaryNiche: nicheA,
                    fallback: true,
                    warning: error?.message || 'Cross-niche merge analysis failed.'
                });
            }
        })();
        return true;
    }

    if (req.action === 'BUILD_PROMPT_BAG_CHARACTER_CROSSOVER') {
        (async () => {
            try {
                const pack = await buildPromptBagCharacterCrossoverPack(req);
                sendResponse({ success: true, ...pack });
            } catch (error) {
                const niche = String(req.niche || '').trim();
                const character = resolvePromptBagCharacterCrossoverFallback(niche);
                sendResponse({
                    success: true,
                    prompt: buildRadarCharacterCrossoverApparelPrompt({ niche, character }),
                    libraryDisplayName: buildCharacterCrossoverDisplayName(character, niche),
                    character,
                    fallback: true,
                    warning: error?.message || 'Character crossover analysis failed.'
                });
            }
        })();
        return true;
    }

    if (req.action === 'RADAR_CANCEL_IMAGE_HUNT') {
        const id = String(req.requestId ?? '').trim();
        if (id) radarImageHuntAbortIds.add(id);
        sendResponse({ success: true });
        return true;
    }

    if (req.action === 'RADAR_CLEAR_IMAGE_HUNT_ABORT') {
        clearRadarImageHuntAbort(req.requestId);
        sendResponse({ success: true });
        return true;
    }

    if (req.action === 'RADAR_FETCH_SOURCE_IMAGES') {
        (async () => {
            try {
                const skipOracle = req.__oracleInternal === true || req.skipOracle === true;
                const batchOpts = {
                    batchLimit: req.batchLimit,
                    seenUrls: req.seenUrls,
                    cursor: req.cursor,
                    requestId: req.requestId,
                    skipOracle,
                    urlOnly: req.urlOnly === true,
                    hydrateThumbs: req.hydrateThumbs
                };
                // Drop undefined batchLimit so non-batch Note hunts still work.
                if (batchOpts.batchLimit == null && !req.seenUrls && !req.cursor && req.urlOnly !== true && req.hydrateThumbs !== false) {
                    delete batchOpts.batchLimit;
                    delete batchOpts.seenUrls;
                    delete batchOpts.cursor;
                }
                const result = await radarFetchSourceImages(
                    req.niche || req.query,
                    req.mode || req.source || 'aggregator',
                    (req.batchLimit || req.seenUrls || req.cursor || req.urlOnly === true || req.hydrateThumbs === false)
                        ? batchOpts
                        : { skipOracle, urlOnly: req.urlOnly === true, hydrateThumbs: req.hydrateThumbs }
                );
                sendResponse({ success: true, ...result });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Radar image fetch failed.' });
            }
        })();
        return true;
    }

    if (req.action === 'NHP_BULK_UPLOAD_ENQUEUE' || req.action === 'NHP_BULK_UPLOAD_ENQUEUE_BATCH'
        || req.action === 'NHP_BULK_UPLOAD_STATUS' || req.action === 'NHP_BULK_UPLOAD_PUMP'
        || req.action === 'NHP_BULK_UPLOAD_CANCEL' || req.action === 'NHP_BULK_UPLOAD_CLEAR_COMPLETED') {
        (async () => {
            try {
                const handler = typeof handleNhpBulkUploadMessage === 'function' ? handleNhpBulkUploadMessage : null;
                if (!handler) throw new Error('Bulk upload handler unavailable');
                const result = await handler(req);
                sendResponse(result || { ok: false, error: 'Unknown bulk upload action' });
            } catch (error) {
                sendResponse({ ok: false, error: error?.message || 'Bulk upload failed' });
            }
        })();
        return true;
    }

    if (req.action === 'RADAR_SEND_TO_PROMPT_BAG' || req.action === 'NHP_SEND_TO_PROMPT_BAG') {
        (async () => {
            try {
                const items = Array.isArray(req.items) ? req.items : [];
                if (!items.length) throw new Error('┘äÏº Ï¬┘êÏ¼Ï» ÏÁ┘êÏ▒ ┘àÏ¡Ï»Ï»Ï®.');
                const bagNiche = String(req.niche || req.query || '').trim();
                const sourceTabId = Number.isFinite(sender?.tab?.id) ? sender.tab.id : null;
                let added = 0;
                let skipped = 0;
                let duplicates = 0;
                for (const item of items) {
                    const resolved = await resolveRadarImageHuntItemDataUrl(item, sourceTabId);
                    if (!resolved?.dataUrl?.startsWith('data:image/')) {
                        skipped += 1;
                        continue;
                    }
                    const niche = String(item.niche || item.nicheTitle || bagNiche).trim();
                    const saveResult = await addPromptBagImage({
                        dataUrl: resolved.dataUrl,
                        name: item.name || (niche ? `${niche}.png` : `${item.sourceLabel || 'Radar'}-${added + 1}.png`),
                        niche,
                        nicheTitle: niche,
                        sourceUrl: resolved.sourceUrl || item.url || ''
                    });
                    if (saveResult?.duplicate) {
                        duplicates += 1;
                        continue;
                    }
                    added += 1;
                }
                if (!added) {
                    throw new Error(skipped > 0 || duplicates > 0
                        ? 'Ï¬Ï╣Ï░┘æÏ▒ ÏÑÏÂÏº┘üÏ® Ïº┘äÏÁ┘êÏ▒ Ïº┘ä┘àÏ¡Ï»Ï»Ï® ÔÇö ┘éÏ» Ï¬┘â┘ê┘å ┘àÏ¡Ï¼┘êÏ¿Ï® Ïú┘ê Ï║┘èÏ▒ Ï¼Ïº┘çÏ▓Ï® Ï¿Ï╣Ï».'
                        : 'Ï¬Ï╣Ï░┘æÏ▒ Ï¬Ï¡┘ê┘è┘ä Ïº┘äÏÁ┘êÏ▒ Ïº┘ä┘àÏ¡Ï»Ï»Ï® ÏÑ┘ä┘ë Prompt Bag.');
                }
                sendResponse({ success: true, added, skipped, duplicates });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || '┘üÏ┤┘ä ÏÑÏ▒Ï│Ïº┘ä Prompt Bag.' });
            }
        })();
        return true;
    }

    if (req.action === 'RADAR_BATCH_PROXY_THUMBS') {
        (async () => {
            try {
                const items = (Array.isArray(req.items) ? req.items : []).slice(0, 48);
                const results = {};
                const concurrency = 3;
                let cursor = 0;
                const worker = async () => {
                    while (cursor < items.length) {
                        const row = items[cursor++];
                        const id = String(row?.id || '').trim();
                        const url = String(row?.url || '').trim();
                        const pageUrl = String(row?.pageUrl || url).trim();
                        if (!id || !url) continue;
                        if (url.startsWith('data:image/')) {
                            results[id] = { displayUrl: url, originalUrl: url };
                            continue;
                        }
                        try {
                            const fetched = await fetchImageAsDataUrlFromCandidates([url], pageUrl);
                            results[id] = {
                                displayUrl: fetched.dataUrl,
                                originalUrl: fetched.sourceUrl || url
                            };
                        } catch (error) {
                            results[id] = { error: error?.message || 'fetch failed', originalUrl: url };
                        }
                        await delay(35);
                    }
                };
                await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
                sendResponse({ success: true, results });
            } catch (error) {
                sendResponse({ success: false, error: error?.message || 'Radar thumb proxy failed.' });
            }
        })();
        return true;
    }

    if (req.action === 'RADAR_FETCH_FALLBACK_THUMBNAILS') {
        (async () => {
            const keywords = (Array.isArray(req.keywords) ? req.keywords : [])
                .map((item) => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 24);
            const thumbnails = {};
            const absolutizeRadarImageUrl = (src) => {
                const value = String(src || '').trim().replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
                if (!value || value.startsWith('data:') || value.startsWith('blob:')) return '';
                const first = value.split(/\s+/)[0];
                if (first.startsWith('//')) return `https:${first}`;
                if (first.startsWith('/')) return `https://www.teepublic.com${first}`;
                return /^https?:\/\//i.test(first) ? first : '';
            };
            const extractRadarThumbnailFromHtml = (html) => {
                const TP = getTeepublicExtractApi();
                if (TP) {
                    const designs = TP.extractTeepublicDesignsFromListingHtml(html, { maxDesigns: 8 });
                    const hit = designs.find((d) => d?.img && TP.isUsableTeepublicDesignImageUrl(d.img));
                    return hit?.img || '';
                }
                const text = String(html || '');
                for (const match of text.matchAll(/https?:\/\/images\.teepublic\.com\/derived\/production\/designs\/\d+[^"'<>\s]+/gi)) {
                    const src = absolutizeRadarImageUrl(match[0]);
                    if (src && !src.toLowerCase().includes('teepublicons')) return src;
                }
                return '';
            };

            const buildRadarImageQueries = (keyword) => {
                const clean = String(keyword || '').replace(/\s+/g, ' ').trim();
                const variants = [clean];
                if (!/\bshirt\b/i.test(clean)) variants.push(`${clean} shirt`);
                if (!/\bt-?shirt\b/i.test(clean)) variants.push(`${clean} t shirt`);
                return [...new Set(variants)].filter(Boolean).slice(0, 3);
            };

            for (const keyword of keywords) {
                try {
                    for (const query of buildRadarImageQueries(keyword)) {
                        const params = new URLSearchParams({ query, sort: 'newest' });
                        const response = await fetch(`https://www.teepublic.com/t-shirts?${params.toString()}`, {
                            headers: {
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Cache-Control': 'no-cache',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });
                        const html = await response.text();
                        const src = extractRadarThumbnailFromHtml(html);
                        if (src) {
                            try {
                                const fetched = await fetchImageAsDataUrlFromCandidates([src], 'https://www.teepublic.com/t-shirts');
                                thumbnails[keyword] = fetched?.dataUrl?.startsWith('data:image/') ? fetched.dataUrl : '';
                            } catch (_) {
                                thumbnails[keyword] = '';
                            }
                            if (thumbnails[keyword]) break;
                        }
                        await delay(80);
                    }
                    await delay(80);
                } catch (_) { }
            }
            sendResponse({ success: true, thumbnails });
        })();
        return true;
    }

    if (req.action === 'lab_perform_scan') {
        const q = req.query || "";
        const allowBrowserFallback = req.allowBrowserFallback === true;
        const buildScanUrl = (sort, page) => {
            const params = new URLSearchParams();
            if (q) params.set('query', q);
            params.set('sort', sort);
            if (page > 1) params.set('page', String(page));
            return `https://www.teepublic.com/t-shirts?${params.toString()}`;
        };
        const scanPageCount = RADAR_LAB_SCAN_PAGE_COUNT;

        const fetchOptions = {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        const looksLikeBlockedScanPage = (html) => {
            const text = String(html || '').toLowerCase();
            return text.includes('just a moment') ||
                text.includes('cf_chl_opt') ||
                text.includes('challenge-platform') ||
                text.includes('enable javascript and cookies to continue');
        };

        const countExtractableDesigns = (html) => {
            const text = String(html || '');
            const ids = new Set();
            const decoded = text
                .replace(/\\u002F/g, '/')
                .replace(/\\\//g, '/')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');
            for (const source of [text, decoded]) {
                for (const match of source.matchAll(/data-design-id=["']?(\d+)/gi)) ids.add(`id:${match[1]}`);
                for (const match of source.matchAll(/["']design_id["']\s*:\s*["']?(\d+)/gi)) ids.add(`id:${match[1]}`);
                for (const match of source.matchAll(/["']id["']\s*:\s*["']?(\d{4,})/gi)) ids.add(`id:${match[1]}`);
                for (const match of source.matchAll(/\/(?:t-shirt|tank-top|hoodie|sticker|poster|phone-case|kids-t-shirt)\/([^"'?#<\s]+)/gi)) ids.add(`path:${match[1]}`);
                for (const match of source.matchAll(/\/design\/(\d+)[^"'<\s]*/gi)) ids.add(`design:${match[1]}`);
                for (const match of source.matchAll(/\/designs\/(\d+)[^"'<\s]*/gi)) ids.add(`design:${match[1]}`);
                for (const match of source.matchAll(/teepublic\.com\/[^"'<\s]*\/design\/(\d+)/gi)) ids.add(`design:${match[1]}`);
                for (const match of source.matchAll(/(?:image|img|preview|front)[^"']*["']\s*:\s*["']([^"']*(?:teepublic|cloudfront|amazonaws)[^"']*)/gi)) ids.add(`img:${match[1].slice(0, 120)}`);
            }
            return ids.size;
        };

        const fetchScanPages = async (sort) => {
            const pages = [];
            const meta = [];
            for (let idx = 0; idx < scanPageCount; idx += 1) {
                const page = idx + 1;
                const url = buildScanUrl(sort, page);
                const response = await fetch(url, fetchOptions);
                const html = await response.text();
                const blocked = looksLikeBlockedScanPage(html);
                const extractableCount = countExtractableDesigns(html);
                pages.push(html);
                meta.push({
                    sort,
                    page,
                    url,
                    status: response.status,
                    ok: response.ok,
                    blocked,
                    extractableCount
                });
                await delay(250);
            }
            return { pages, meta };
        };

        const waitForTabLoadComplete = (tabId, timeoutMs = 18000) => new Promise((resolve) => {
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(false);
            }, timeoutMs);
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId !== tabId || changeInfo.status !== 'complete' || settled) return;
                settled = true;
                clearTimeout(timeoutId);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(true);
            };
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.get(tabId, (tab) => {
                if (!chrome.runtime.lastError && tab?.status === 'complete' && !settled) {
                    settled = true;
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve(true);
                }
            });
        });

        const fetchScanPagesViaBrowser = async (sort) => {
            return {
                pages: [],
                meta: Array.from({ length: scanPageCount }, (_, idx) => ({
                    sort,
                    page: idx + 1,
                    ok: false,
                    blocked: false,
                    extractableCount: 0,
                    browserFallback: false
                }))
            };
        };

        Promise.all([
            fetchScanPages('newest'),
            fetchScanPages('popular')
        ]).then(async ([newestResult, popularResult]) => {
            const scanMeta = {
                pageCount: scanPageCount,
                newest: newestResult.meta,
                popular: popularResult.meta
            };
            const isUsableScanPage = (item) => item?.ok && !item.blocked && item.extractableCount > 0;
            const countUsableScanPages = (items) => (Array.isArray(items) ? items : []).filter(isUsableScanPage).length;
            const mergeScanPageResults = (directResult, browserResult) => {
                const pages = [];
                const meta = [];
                for (let idx = 0; idx < scanPageCount; idx += 1) {
                    const directMeta = directResult?.meta?.[idx] || null;
                    const browserMeta = browserResult?.meta?.[idx] || null;
                    const useBrowser = !isUsableScanPage(directMeta) && isUsableScanPage(browserMeta);
                    pages.push(useBrowser ? (browserResult.pages[idx] || '') : (directResult.pages[idx] || ''));
                    meta.push(useBrowser ? browserMeta : (directMeta || browserMeta || {
                        page: idx + 1,
                        ok: false,
                        blocked: false,
                        extractableCount: 0
                    }));
                }
                return { pages, meta };
            };

            let finalNewestResult = newestResult;
            let finalPopularResult = popularResult;
            let finalScanMeta = scanMeta;
            const needsBrowserFill = false;

            if (needsBrowserFill && allowBrowserFallback) {
                try {
                    const [browserNewestResult, browserPopularResult] = await Promise.all([
                        fetchScanPagesViaBrowser('newest'),
                        fetchScanPagesViaBrowser('popular')
                    ]);
                    finalNewestResult = mergeScanPageResults(newestResult, browserNewestResult);
                    finalPopularResult = mergeScanPageResults(popularResult, browserPopularResult);
                    finalScanMeta = {
                        ...scanMeta,
                        browserFallback: true,
                        pageCount: scanPageCount,
                        newest: finalNewestResult.meta,
                        popular: finalPopularResult.meta,
                        browserRaw: {
                            newest: browserNewestResult.meta,
                            popular: browserPopularResult.meta
                        }
                    };
                } catch (fallbackError) {
                    finalScanMeta.browserFallbackError = fallbackError?.message || String(fallbackError || '');
                }
            }

            const compactUsableScanPages = (result) => {
                const pages = [];
                const meta = [];
                (result?.pages || []).forEach((html, idx) => {
                    const itemMeta = result?.meta?.[idx];
                    if (!html || !isUsableScanPage(itemMeta)) return;
                    pages.push(html);
                    meta.push(itemMeta);
                });
                return {
                    pages: pages.slice(0, RADAR_LAB_SCAN_PAGE_COUNT),
                    meta: meta.slice(0, RADAR_LAB_SCAN_PAGE_COUNT)
                };
            };

            const compactNewest = compactUsableScanPages(finalNewestResult);
            const compactPopular = compactUsableScanPages(finalPopularResult);
            finalScanMeta = {
                ...finalScanMeta,
                newest: compactNewest.meta,
                popular: compactPopular.meta,
                usableNewestPages: compactNewest.pages.length,
                usablePopularPages: compactPopular.pages.length
            };

            if (compactNewest.pages.length === 0 && compactPopular.pages.length === 0) {
                const allMeta = [...(scanMeta.newest || []), ...(scanMeta.popular || [])];
                const blockedCount = allMeta.filter((item) => item.blocked || item.status === 403).length;
                const reason = blockedCount > 0
                    ? 'TeePublic Ï¡Ï¼Ï¿ Ïº┘ä┘üÏ¡ÏÁ Ïº┘ä┘àÏ¿ÏºÏ┤Ï▒ Ï¡Ïº┘ä┘èÏº┘ï. ┘äÏº Ï¬┘êÏ¼Ï» Ï¿┘èÏº┘åÏºÏ¬ Ï»┘é┘è┘éÏ® ┘è┘à┘â┘å ÏºÏ╣Ï¬┘àÏºÏ»┘çÏº.'
                    : '┘ä┘à ┘èÏ¬┘à Ïº┘äÏ╣Ï½┘êÏ▒ Ï╣┘ä┘ë Ï¬ÏÁÏº┘à┘è┘à ┘éÏºÏ¿┘äÏ® ┘ä┘äÏºÏ│Ï¬Ï«Ï▒ÏºÏ¼ ┘à┘å TeePublic.';
                sendResponse({ success: false, error: reason, scanMeta: finalScanMeta });
                return;
            }
            sendResponse({
                success: true,
                newestPages: compactNewest.pages,
                popularPages: compactPopular.pages,
                scanMeta: finalScanMeta
            });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    if (req.action === 'fetch_bubblespider_style_tags' || req.action === 'generate_redbubble_tags') {
        const keyword = String(req.keyword || req.niche || '').trim();
        const tagCount = Number(req.tagCount) || 15;
        const resultsLimit = Number(req.resultsLimit) || 100;
        bgFetchBubbleSpiderStyleTags(keyword, tagCount, resultsLimit)
            .then((tags) => sendResponse({ success: true, tags }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
        return true;
    }

    if (req.action === 'TMH_VERIFY_TAGS') {
        const tagsToAnalyze = req.tags || [];
        (async () => {
            try {
                const tab = await chrome.tabs.create({ url: 'http://tmhunt.com/#ngrams', active: false });
                const tabId = tab?.id;
                if (!tabId) return sendResponse({ success: false, error: "TMHunt tab could not be created" });

                let ready = false;
                for (let j = 0; j < 5; j++) {
                    try { await chrome.tabs.sendMessage(tabId, { action: 'PING' }); ready = true; break; } catch (e) { await delay(1000); }
                }

                if (!ready) {
                    try { if (tabId) await chrome.tabs.remove(tabId); } catch (e) { }
                    return sendResponse({ success: false, error: "TMHunt script not ready" });
                }

                let safeTags = [];
                let restrictedTags = [];
                const chunks = [];
                for (let i = 0; i < tagsToAnalyze.length; i += 10) {
                    chunks.push(tagsToAnalyze.slice(i, i + 10));
                }
                for (let chunk of chunks) {
                    if (chunk.length === 0) continue;
                    try {
                        const res = await chrome.tabs.sendMessage(tabId, { action: 'PERFORM_SEARCH', niches: chunk });
                        if (res) {
                            if (res.safe) safeTags.push(...res.safe);
                            if (res.restricted) restrictedTags.push(...res.restricted);
                        }
                    } catch (e) { }
                }

                try { if (tabId) await chrome.tabs.remove(tabId); } catch (e) { }
                sendResponse({ success: true, safeTags, restrictedTags });
            } catch (err) { sendResponse({ success: false, error: err.message }); }
        })();
        return true;
    }

    // --- STUDIO DOWNLOAD INTERCEPTOR (Gemini Capture) ---
    //  FACEBOOK GRAPH API PUBLISHER
    // --- STUDIO DOWNLOAD INTERCEPTOR (Gemini Capture) ---
    if (req.action === 'publish_to_facebook') {
        (async () => {
            try {
                const { pageId, token, message, base64Image } = req.data;

                // ├â╦£├é┬¬├â╦£├é┬¡├âÔäó├ïÔÇá├âÔäó├à┬á├âÔäó├óÔé¼┼¥ Base64 ├â╦£├é┬Ñ├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬░ Blob ├âÔäó├óÔé¼┼¥├â╦£├é┬▒├âÔäó├é┬ü├â╦£├é┬╣├âÔäó├óÔé¼┬í ├âÔäó├åÔÇÖ├âÔäó├óÔé¼┬ª├âÔäó├óÔé¼┼¥├âÔäó├é┬ü ├âÔäó├à┬á├â╦£├é┬»├âÔäó├ïÔÇá├âÔäó├à┬á├â╦£├é┬º├âÔäó├óÔé¼┬╣ (├âÔäó├óÔé¼┼¥├â╦£├é┬ú├âÔäó├óÔé¼┬á fetch ├âÔäó├óÔé¼┼¥├â╦£├é┬º ├â╦£├é┬¬├â╦£├é┬»├â╦£├é┬╣├âÔäó├óÔé¼┬ª data URI ├âÔäó├é┬ü├âÔäó├à┬á MV3)
                const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
                const mimeType = base64Image.includes('data:') ? base64Image.match(/data:(.*?);/)[1] : 'image/png';

                const byteCharacters = atob(cleanBase64);
                const byteArray = new Uint8Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteArray[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([byteArray], { type: mimeType });

                let finalToken = token;
                // ├âÔäó├óÔé¼┬ª├â╦£├é┬¡├â╦£├é┬º├âÔäó├ïÔÇá├âÔäó├óÔé¼┼¥├â╦£├é┬® ├â╦£├é┬º├â╦£├é┬│├â╦£├é┬¬├â╦£├é┬«├â╦£├é┬▒├â╦£├é┬º├â╦£├é┬¼ Page Access Token ├â╦£├é┬Ñ├â╦£├é┬░├â╦£├é┬º ├âÔäó├åÔÇÖ├â╦£├é┬º├âÔäó├óÔé¼┬á ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¬├âÔäó├ïÔÇá├âÔäó├åÔÇÖ├âÔäó├óÔé¼┬á ├â╦£├é┬º├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬ª├â╦£├é┬»├â╦£├é┬«├âÔäó├óÔé¼┼¥ ├âÔäó├óÔé¼┬í├âÔäó├ïÔÇá User Token ├âÔäó├óÔé¼┼¥├â╦£├é┬¬├â╦£├é┬¼├âÔäó├óÔé¼┬á├â╦£├é┬¿ ├â╦£├é┬«├â╦£├é┬À├â╦£├é┬ú publish_actions
                try {
                    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${token}`);
                    const tokenData = await tokenRes.json();
                    if (tokenData && tokenData.access_token) {
                        finalToken = tokenData.access_token;
                    }
                } catch (e) { }

                const formData = new FormData();
                formData.append('source', blob, 'design.png');
                formData.append('message', message);
                formData.append('access_token', finalToken);

                const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
                    method: 'POST',
                    body: formData
                });
                const fbData = await fbRes.json();

                if (fbData.error) {
                    let errMsg = fbData.error.message;
                    if (errMsg.includes('publish_actions') || errMsg.includes('deprecated')) {
                        errMsg = 'Ï«ÏÀÏú Ïº┘äÏÁ┘äÏºÏ¡┘èÏºÏ¬: ┘äÏº ┘è┘à┘â┘å Ïº┘ä┘åÏ┤Ï▒ Ï╣┘ä┘ë Ï¡Ï│ÏºÏ¿ Ï┤Ï«ÏÁ┘è. Ï¬Ïú┘âÏ» Ïú┘å Page ID ┘èÏ╣┘êÏ» ┘äÏÁ┘üÏ¡Ï® Ï╣Ïº┘àÏ® (Page) ┘êÏú┘å Ïº┘äÏ¬┘ê┘â┘å ┘è┘àÏ¬┘ä┘â ÏÁ┘äÏºÏ¡┘èÏºÏ¬ Ïº┘ä┘åÏ┤Ï▒.';
                    }
                    sendResponse({ success: false, error: errMsg });
                }
                else sendResponse({ success: true, postId: fbData.post_id || fbData.id });
            } catch (err) { sendResponse({ success: false, error: err.message }); }
        })();
        return true;
    }

    // ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
    //  PINTEREST API PUBLISHER
    // ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
    if (req.action === 'publish_to_pinterest') {
        (async () => {
            try {
                const { boardId, token, title, description, link, base64Image } = req.data;
                const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
                const mimeType = base64Image.includes('data:') ? base64Image.match(/data:(.*?);/)[1] : 'image/png';

                const payload = {
                    board_id: boardId,
                    title: title ? title.substring(0, 100) : "Awesome Design",
                    description: description ? description.substring(0, 500) : "",
                    media_source: {
                        source_type: "image_base64",
                        content_type: mimeType,
                        data: cleanBase64
                    }
                };
                if (link) payload.link = link;

                const pinRes = await fetch(`https://api.pinterest.com/v5/pins`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const pinData = await pinRes.json();

                if (!pinRes.ok) {
                    sendResponse({ success: false, error: pinData.message || 'Error posting to Pinterest' });
                } else {
                    sendResponse({ success: true, pinId: pinData.id });
                }
            } catch (err) { sendResponse({ success: false, error: err.message }); }
        })();
        return true;
    }

    if (req.action === 'peel_banana') {
        if (typeof peelEngine === 'undefined') sendResponse({ success: false, error: "Engine Not Initialized" });
        else peelEngine.processPeel(req.dataURL).then(dataURL => sendResponse({ success: true, dataURL })).catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (req.action === 'generate_library_to_studio_peel') {
        (async () => {
            try {
                const routed = await routeGenerateLibraryToStudioPeel(req.data);
                sendResponse({ success: routed.ok, buffered: routed.buffered, error: routed.error || null });
            } catch (error) {
                sendResponse({ success: false, error: error.message || '┘üÏ┤┘ä Ï¬┘êÏ¼┘è┘ç Ïº┘äÏÁ┘êÏ▒Ï® ÏÑ┘ä┘ë Studio' });
            }
        })();
        return true;
    }

    if (req.action === 'generate_library_to_studio_teemaster') {
        (async () => {
            try {
                const routed = await routeGenerateLibraryToStudioTeeMaster(req.data);
                sendResponse({ success: routed.ok, buffered: routed.buffered, error: routed.error || null });
            } catch (error) {
                sendResponse({ success: false, error: error.message || '┘üÏ┤┘ä Ï¬┘êÏ¼┘è┘ç Ïº┘äÏÁ┘êÏ▒Ï® ÏÑ┘ä┘ë TeeMaster' });
            }
        })();
        return true;
    }

    if (req.action === 'call_gemini_studio_bridge') {
        (async () => {
            try {
                const sourceUrl = req.imageUrl || req.url || req.dataURL;
                if (!sourceUrl) throw new Error('Missing image URL.');
                const bridged = await processGeminiImageForStudio(sourceUrl, req.filename);
                sendResponse({ success: !!bridged });
            } catch (error) {
                sendResponse({ success: false, error: error.message || 'Failed to bridge image to Studio.' });
            }
        })();
        return true;
    }

    if (req.type === 'DOWNLOAD_IMAGE' || req.action === 'DOWNLOAD_IMAGE') {
        chrome.downloads.download({
            url: req.dataUrl,
            filename: req.filename,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) sendResponse({ success: false, error: chrome.runtime.lastError.message });
            else sendResponse({ success: true, downloadId });
        });
        return true;
    }

    if (req.action === 'GEMINI_IMAGES_GENERATED') {
        if (req.images && Array.isArray(req.images)) {
            req.images.forEach((url, i) => {
                processGeminiImageForStudio(url, `gemini_ai_${Date.now()}_${i}.png`);
            });
            sendResponse({ success: true });
        }
        return true;
    }

    if (
        req.action === 'capture-visible' ||
        req.action === 'capture-selected' ||
        req.action === 'capture-full-page' ||
        req.action === 'record-tab' ||
        req.action === 'record-desktop' ||
        req.action === 'open-annotator' ||
        req.action === 'add-recent-item' ||
        req.action === 'get-recent-items' ||
        req.action === 'clear-recent-items' ||
        req.action === 'get-editor-image' ||
        req.action === 'set-editor-image' ||
        req.action === 'get-editor-buffer' ||
        req.action === 'set-editor-buffer'
    ) {
        (async () => {
            try {
                let response;
                switch (req.action) {
                    case 'capture-visible':
                        response = await screenHandleCaptureVisible(req.settings);
                        break;
                    case 'capture-selected':
                        response = await screenHandleCaptureSelected(req.settings);
                        break;
                    case 'capture-full-page':
                        response = await screenHandleCaptureFullPage(req.settings);
                        break;
                    case 'record-tab':
                        response = await screenOpenRecorderWindow('tab');
                        break;
                    case 'record-desktop':
                        response = await screenOpenRecorderWindow('desktop');
                        break;
                    case 'open-annotator':
                        response = await screenOpenAnnotatorWindow(null);
                        break;
                    case 'add-recent-item':
                        await screenAddRecentItem(req.item);
                        response = { ok: true };
                        break;
                    case 'get-recent-items':
                        response = { ok: true, items: await screenGetRecentItems() };
                        break;
                    case 'clear-recent-items':
                        await chrome.storage.local.set({ [SCREEN_RECENT_ITEMS_KEY]: [] });
                        response = { ok: true };
                        break;
                    case 'get-editor-image':
                        response = { ok: true, image: await screenGetEditorImage() };
                        break;
                    case 'set-editor-image':
                        await screenSetEditorImage(req.image || null);
                        response = { ok: true };
                        break;
                    case 'get-editor-buffer':
                        response = { ok: true, items: await screenGetBufferedEditorImages() };
                        break;
                    case 'set-editor-buffer':
                        await screenSetBufferedEditorImages(Array.isArray(req.items) ? req.items : []);
                        response = { ok: true };
                        break;
                    default:
                        response = { ok: false, error: 'Unknown action.' };
                        break;
                }

                sendResponse(response);
            } catch (error) {
                console.error('[Background][Screen Toolkit] action failed:', error);
                sendResponse({ ok: false, error: error.message || 'Unexpected error.' });
            }
        })();

        return true;
    }

    return false;
});

//  STUDIO DOWNLOAD INTERCEPTOR (Gemini Capture)
//  Captures generated images and forwards them to Studio or a local buffer.
const STUDIO_PEEL_BANANA_BUFFER_KEY = 'studio_peel_banana_buffer';
const STUDIO_PEEL_BANANA_UI_ACTION = 'studio_peel_banana_teemaster';
const STUDIO_PEEL_BANANA_BUFFER_MAX = 80;
const STUDIO_TEEMASTER_BUFFER_KEY = 'studio_teemaster_buffer';
const STUDIO_TEEMASTER_UI_ACTION = 'studio_library_to_teemaster';
const STUDIO_TEEMASTER_BUFFER_MAX = 80;

function bufferStudioPeelBananaImage(imageData) {
    return new Promise((resolve) => {
        chrome.storage.local.get([STUDIO_PEEL_BANANA_BUFFER_KEY], (res) => {
            const buffer = res[STUDIO_PEEL_BANANA_BUFFER_KEY] || [];
            buffer.push(imageData);
            if (buffer.length > STUDIO_PEEL_BANANA_BUFFER_MAX) buffer.splice(0, buffer.length - STUDIO_PEEL_BANANA_BUFFER_MAX);
            chrome.storage.local.set({ [STUDIO_PEEL_BANANA_BUFFER_KEY]: buffer }, () => {
                console.log('[Background] GenerateÔåÆPeel buffered for next Studio open.');
                resolve();
            });
        });
    });
}

/** Generate Library ÔåÆ Peel Banana ÔåÆ TeeMaster Pro 5K (popup may be on Generate tab). */
async function routeGenerateLibraryToStudioPeel(imageData) {
    if (!imageData?.dataURL) {
        return { ok: false, buffered: false, error: 'Ï¿┘èÏº┘åÏºÏ¬ Ïº┘äÏÁ┘êÏ▒Ï® ┘åÏº┘éÏÁÏ® (dataURL)' };
    }
    try {
        await chrome.runtime.sendMessage({ action: STUDIO_PEEL_BANANA_UI_ACTION, data: imageData });
        console.log('[Background] GenerateÔåÆPeel sent to active Studio UI.');
        return { ok: true, buffered: false };
    } catch (err) {
        console.log('[Background] Studio UI inactive; buffering GenerateÔåÆPeel image.', err?.message || err);
        await bufferStudioPeelBananaImage(imageData);
        return { ok: true, buffered: true };
    }
}

function bufferStudioTeeMasterImage(imageData) {
    return new Promise((resolve) => {
        chrome.storage.local.get([STUDIO_TEEMASTER_BUFFER_KEY], (res) => {
            const buffer = res[STUDIO_TEEMASTER_BUFFER_KEY] || [];
            buffer.push(imageData);
            if (buffer.length > STUDIO_TEEMASTER_BUFFER_MAX) buffer.splice(0, buffer.length - STUDIO_TEEMASTER_BUFFER_MAX);
            chrome.storage.local.set({ [STUDIO_TEEMASTER_BUFFER_KEY]: buffer }, () => {
                console.log('[Background] GenerateÔåÆTeeMaster buffered for next Studio open.');
                resolve();
            });
        });
    });
}

/** Generate Library ÔåÆ TeeMaster Pro 5K direct (no Peel Banana). */
async function routeGenerateLibraryToStudioTeeMaster(imageData) {
    if (!imageData?.dataURL) {
        return { ok: false, buffered: false, error: 'Ï¿┘èÏº┘åÏºÏ¬ Ïº┘äÏÁ┘êÏ▒Ï® ┘åÏº┘éÏÁÏ® (dataURL)' };
    }
    try {
        await chrome.runtime.sendMessage({ action: STUDIO_TEEMASTER_UI_ACTION, data: imageData });
        console.log('[Background] GenerateÔåÆTeeMaster sent to active Studio UI.');
        return { ok: true, buffered: false };
    } catch (err) {
        console.log('[Background] Studio UI inactive; buffering GenerateÔåÆTeeMaster image.', err?.message || err);
        await bufferStudioTeeMasterImage(imageData);
        return { ok: true, buffered: true };
    }
}

async function processGeminiImageForStudio(url, filename) {
    console.log(`[Background] Starting capture for Gemini image: ${url}`);
    try {
        let dataURL = '';
        if (typeof url === 'string' && url.startsWith('data:image/')) {
            dataURL = url;
        } else if (typeof url === 'string' && url.startsWith('blob:')) {
            // Blob URLs are scoped to the page that created them and cannot be
            // fetched from the extension service worker context.
            console.warn('[Background] Skipping blob URL capture from service worker context.');
            return false;
        } else {
            const response = await fetch(url);
            const blob = await response.blob();

            // Ï¬Ï¡┘ê┘è┘ä Ïó┘à┘å Ï╣Ï¿Ï▒ FileReader Ï¿Ï»┘äÏº┘ï ┘à┘å Ïº┘äÏ¡┘ä┘éÏºÏ¬ Ïº┘ä┘èÏ»┘ê┘èÏ® Ïº┘äÏ½┘é┘è┘äÏ®.
            dataURL = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        const imageData = {
            name: filename || `gemini_${Date.now()}.png`,
            dataURL,
            timestamp: Date.now()
        };

        await screenBufferEditorImage({
            title: screenStripExtension(filename) || `gemini-${Date.now()}`,
            source: 'gemini',
            filename: filename || `gemini-${Date.now()}.png`,
            dataUrl: dataURL,
            createdAt: imageData.timestamp
        });

        // ÏÑÏ▒Ï│Ïº┘ä Ïº┘äÏÁ┘êÏ▒Ï® ┘ü┘êÏ▒Ïº┘ï ÏÑ┘ä┘ë Ïº┘ä┘êÏºÏ¼┘çÏ® ÏÑ┘å ┘âÏº┘åÏ¬ ┘à┘üÏ¬┘êÏ¡Ï®Ïî ┘êÏÑ┘äÏº Ï¬Ï«Ï▓┘è┘å┘çÏº ┘àÏñ┘éÏ¬Ïº┘ï.
        chrome.runtime.sendMessage({ action: 'studio_add_image', data: imageData }).then(() => {
            console.log("[Background] Image sent to active Studio UI.");
        }).catch(() => {
            console.log("[Background] UI closed; buffering image for next open.");
            chrome.storage.local.get(['studio_buffered_images'], (res) => {
                const buffer = res.studio_buffered_images || [];
                buffer.push(imageData);
                if (buffer.length > 20) buffer.shift();
                chrome.storage.local.set({ studio_buffered_images: buffer });
            });
        });
        return true;
    } catch (e) {
        console.error("[Background] Capture failed:", e);
        return false;
    }
}

chrome.downloads.onCreated.addListener((item) => {
    const url = item.url || "";
    const referrer = item.referrer || "";
    const isGeminiOrigin = url.includes('googleusercontent.com') ||
        url.startsWith('blob:') ||
        referrer.includes('gemini.google.com');

    if (isGeminiOrigin) {
        console.log(`[Background] Gemini download detected: ${url}`);
        processGeminiImageForStudio(url, item.filename);
    }
});

async function screenHandleCaptureVisible(settingsOverride) {
    const tab = await screenGetActiveTab();
    screenEnsureSupportedTab(tab);
    await screenFocusTab(tab);
    const settings = await screenGetEffectiveSettings(settingsOverride);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    if (settings.openEditorAfterCapture) {
        await screenOpenAnnotatorWindow({
            dataUrl,
            title: tab.title,
            source: 'visible'
        });
        return { ok: true, message: 'Ï¬┘à ┘üÏ¬Ï¡ Ïº┘ä┘ä┘éÏÀÏ® Ï»ÏºÏ«┘ä ÏúÏ»ÏºÏ® Ïº┘äÏ▒Ï│┘à.', closePopup: true };
    }

    const filename = screenBuildFilename('capture', tab.title, 'png');
    await screenDownloadDataUrl(dataUrl, `screeeeenvme/captures/${filename}`);
    await screenAddRecentItem({
        kind: 'image',
        mode: 'visible',
        title: tab.title,
        filename,
        createdAt: Date.now()
    });

    return { ok: true, message: 'Ï¬┘à Ï¡┘üÏ© ┘ä┘éÏÀÏ® Ïº┘äÏ┤ÏºÏ┤Ï® ┘àÏ¡┘ä┘èÏº┘ï.' };
}

async function screenHandleCaptureSelected(settingsOverride) {
    const tab = await screenGetActiveTab();
    screenEnsureSupportedTab(tab);
    await screenFocusTab(tab);
    const settings = await screenGetEffectiveSettings(settingsOverride);

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['screeeeenvme/scripts/selection.js']
    });

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__screeeeenvmeStartSelection()
    });

    if (!result || result.cancelled) {
        return { ok: true, message: 'Ï¬┘à ÏÑ┘äÏ║ÏºÏí Ïº┘äÏ¬Ï¡Ï»┘èÏ».' };
    }

    const visibleDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const croppedDataUrl = await screenCropVisibleCapture(visibleDataUrl, result);

    if (settings.openEditorAfterCapture) {
        await screenOpenAnnotatorWindow({
            dataUrl: croppedDataUrl,
            title: tab.title,
            source: 'selected'
        });
        return { ok: true, message: 'Ï¬┘à ┘üÏ¬Ï¡ Ïº┘äÏ¼Ï▓Ïí Ïº┘ä┘àÏ¡Ï»Ï» Ï»ÏºÏ«┘ä ÏúÏ»ÏºÏ® Ïº┘äÏ▒Ï│┘à.', closePopup: true };
    }

    const filename = screenBuildFilename('selection', tab.title, 'png');
    await screenDownloadDataUrl(croppedDataUrl, `screeeeenvme/captures/${filename}`);
    await screenAddRecentItem({
        kind: 'image',
        mode: 'selected',
        title: tab.title,
        filename,
        createdAt: Date.now()
    });

    return { ok: true, message: 'Ï¬┘à Ï¡┘üÏ© Ïº┘äÏ¼Ï▓Ïí Ïº┘ä┘àÏ¡Ï»Ï» ┘àÏ¡┘ä┘èÏº┘ï.' };
}

async function screenHandleCaptureFullPage(settingsOverride) {
    const tab = await screenGetActiveTab();
    screenEnsureSupportedTab(tab);
    await screenFocusTab(tab);
    const settings = await screenGetEffectiveSettings(settingsOverride);

    const [{ result: metrics }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            totalHeight: Math.max(
                document.documentElement.scrollHeight,
                document.body ? document.body.scrollHeight : 0
            ),
            originalX: window.scrollX,
            originalY: window.scrollY,
            title: document.title
        })
    });

    const positions = screenBuildScrollPositions(metrics.totalHeight, metrics.viewportHeight);
    const captures = [];

    for (const y of positions) {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (targetY) => {
                window.scrollTo(0, targetY);
                await new Promise((resolve) => setTimeout(resolve, 180));
            },
            args: [y]
        });

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        captures.push({ y, dataUrl });
    }

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (x, y) => window.scrollTo(x, y),
        args: [metrics.originalX, metrics.originalY]
    });

    const stitchedDataUrl = await screenStitchPageCaptures(captures, metrics);

    if (settings.openEditorAfterCapture) {
        await screenOpenAnnotatorWindow({
            dataUrl: stitchedDataUrl,
            title: metrics.title || tab.title,
            source: 'full-page'
        });
        return { ok: true, message: 'Ï¬┘à ┘üÏ¬Ï¡ ┘ä┘éÏÀÏ® Ïº┘äÏÁ┘üÏ¡Ï® Ïº┘ä┘âÏº┘à┘äÏ® Ï»ÏºÏ«┘ä ÏúÏ»ÏºÏ® Ïº┘äÏ▒Ï│┘à.', closePopup: true };
    }

    const filename = screenBuildFilename('full-page', metrics.title || tab.title, 'png');
    await screenDownloadDataUrl(stitchedDataUrl, `screeeeenvme/captures/${filename}`);
    await screenAddRecentItem({
        kind: 'image',
        mode: 'full-page',
        title: metrics.title || tab.title,
        filename,
        createdAt: Date.now()
    });

    return { ok: true, message: 'Ï¬┘à Ï¡┘üÏ© ┘ä┘éÏÀÏ® Ïº┘äÏÁ┘üÏ¡Ï® Ïº┘ä┘âÏº┘à┘äÏ® ┘àÏ¡┘ä┘èÏº┘ï.' };
}

async function screenOpenRecorderWindow(mode) {
    const settings = await screenGetSettings();
    const url = new URL(chrome.runtime.getURL('screeeeenvme/recorder.html'));
    url.searchParams.set('mode', mode);

    if (mode === 'tab') {
        const tab = await screenGetActiveTab();
        screenEnsureSupportedTab(tab);
        await screenFocusTab(tab);
        url.searchParams.set('tabId', String(tab.id));
        url.searchParams.set('title', tab.title || 'Recording');
    } else {
        url.searchParams.set('tabId', '0');
        url.searchParams.set('title', 'Desktop Recording');
    }

    url.searchParams.set('countdown', String(settings.countdown));

    await chrome.windows.create({
        url: url.toString(),
        type: 'popup',
        width: 430,
        height: 700
    });

    return { ok: true, message: 'Ï¬┘à ┘üÏ¬Ï¡ ┘åÏº┘üÏ░Ï® Ïº┘äÏ¬Ï│Ï¼┘è┘ä.', closePopup: true };
}

async function screenOpenAnnotatorWindow(image) {
    await screenSetEditorImage(image);
    await chrome.windows.create({
        url: chrome.runtime.getURL('screeeeenvme/annotator.html'),
        type: 'popup',
        width: 1380,
        height: 940
    });

    return { ok: true, message: 'Ï¬┘à ┘üÏ¬Ï¡ ÏúÏ»ÏºÏ® Ïº┘äÏ▒Ï│┘à.', closePopup: true };
}

async function screenGetActiveTab() {
    const rememberedTab = await screenGetRememberedUsableTab();
    if (rememberedTab) {
        return rememberedTab;
    }

    const isUnsupported = (tab) => {
        const url = tab?.url || '';
        return !tab?.id || ['chrome://', 'edge://', 'about:', 'chrome-extension://'].some((scheme) => url.startsWith(scheme));
    };

    const [lastFocusedTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!isUnsupported(lastFocusedTab)) {
        return lastFocusedTab;
    }

    const normalWindows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const focusedWindow = normalWindows.find((win) => win.focused) || normalWindows[0];
    const fallbackTab = focusedWindow?.tabs?.find((tab) => tab.active) || focusedWindow?.tabs?.[0];

    if (!isUnsupported(fallbackTab)) {
        return fallbackTab;
    }

    throw new Error('Ïº┘üÏ¬Ï¡ ÏÁ┘üÏ¡Ï® ┘ê┘èÏ¿ Ï╣ÏºÏ»┘èÏ® ┘àÏ▒Ï® ┘êÏºÏ¡Ï»Ï® Ï½┘à ÏºÏ▒Ï¼Ï╣ ┘ä┘äÏÑÏÂÏº┘üÏ®.');
}

function screenEnsureSupportedTab(tab) {
    const url = tab.url || '';
    const blockedSchemes = ['chrome://', 'edge://', 'about:', 'chrome-extension://'];
    if (blockedSchemes.some((scheme) => url.startsWith(scheme))) {
        throw new Error('┘äÏº ┘è┘à┘â┘å Ïº┘äÏ¬┘éÏºÏÀ ┘çÏ░┘ç Ïº┘äÏÁ┘üÏ¡Ï® ┘à┘å Ï»ÏºÏ«┘ä Ïº┘äÏÑÏÂÏº┘üÏ®.');
    }
}

function screenBuildFilename(prefix, title, extension) {
    const safeTitle = screenSanitizeFilename(title || 'untitled');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${safeTitle}-${stamp}.${extension}`;
}

function screenSanitizeFilename(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'item';
}

async function screenDownloadDataUrl(dataUrl, filename) {
    await chrome.downloads.download({
        url: dataUrl,
        filename,
        conflictAction: 'uniquify',
        saveAs: false
    });
}

function screenBuildScrollPositions(totalHeight, viewportHeight) {
    const positions = [];
    let current = 0;

    while (current < totalHeight) {
        positions.push(current);
        current += viewportHeight;
    }

    const last = Math.max(totalHeight - viewportHeight, 0);
    if (!positions.includes(last)) {
        positions.push(last);
    }

    return [...new Set(positions)];
}

async function screenCropVisibleCapture(dataUrl, selection) {
    const imageBitmap = await screenDataUrlToImageBitmap(dataUrl);
    const scaleX = imageBitmap.width / selection.viewportWidth;
    const scaleY = imageBitmap.height / selection.viewportHeight;
    const cropX = Math.max(0, Math.round(selection.x * scaleX));
    const cropY = Math.max(0, Math.round(selection.y * scaleY));
    const cropWidth = Math.max(1, Math.round(selection.width * scaleX));
    const cropHeight = Math.max(1, Math.round(selection.height * scaleY));
    const canvas = new OffscreenCanvas(cropWidth, cropHeight);
    const context = canvas.getContext('2d');

    context.drawImage(
        imageBitmap,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
    );

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return screenBlobToDataUrl(blob);
}

async function screenStitchPageCaptures(captures, metrics) {
    const bitmaps = await Promise.all(
        captures.map(async (capture) => ({
            ...capture,
            bitmap: await screenDataUrlToImageBitmap(capture.dataUrl)
        }))
    );

    const first = bitmaps[0]?.bitmap;
    if (!first) {
        throw new Error('Ï¬Ï╣Ï░Ï▒ Ïº┘äÏ¬┘éÏºÏÀ Ïº┘äÏÁ┘üÏ¡Ï® Ï¿Ïº┘ä┘âÏº┘à┘ä.');
    }

    const scale = first.width / metrics.viewportWidth;
    const canvasWidth = Math.round(metrics.viewportWidth * scale);
    const canvasHeight = Math.round(metrics.totalHeight * scale);
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    bitmaps.forEach(({ y, bitmap }) => {
        const destinationY = Math.round(y * scale);
        context.drawImage(bitmap, 0, destinationY, bitmap.width, bitmap.height);
    });

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return screenBlobToDataUrl(blob);
}

async function screenDataUrlToImageBitmap(dataUrl) {
    const value = String(dataUrl || '');
    if (!value.startsWith('data:')) {
        const response = await fetch(value);
        const blob = await response.blob();
        return createImageBitmap(blob);
    }

    const commaIndex = value.indexOf(',');
    if (commaIndex < 0) {
        throw new Error('Invalid data URL.');
    }

    const metadata = value.slice(5, commaIndex);
    const payload = value.slice(commaIndex + 1);
    const mimeType = (metadata.split(';')[0] || 'application/octet-stream').trim();
    const isBase64 = /;base64/i.test(metadata);
    const binaryString = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return createImageBitmap(blob);
}

async function screenBlobToDataUrl(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return `data:${blob.type};base64,${btoa(binary)}`;
}

async function screenAddRecentItem(item) {
    const current = await chrome.storage.local.get(SCREEN_RECENT_ITEMS_KEY);
    const items = Array.isArray(current[SCREEN_RECENT_ITEMS_KEY]) ? current[SCREEN_RECENT_ITEMS_KEY] : [];
    const next = [item, ...items].slice(0, 40);
    await chrome.storage.local.set({ [SCREEN_RECENT_ITEMS_KEY]: next });
}

async function screenGetRecentItems() {
    const current = await chrome.storage.local.get(SCREEN_RECENT_ITEMS_KEY);
    return Array.isArray(current[SCREEN_RECENT_ITEMS_KEY]) ? current[SCREEN_RECENT_ITEMS_KEY] : [];
}

async function screenGetSettings() {
    const current = await chrome.storage.local.get(SCREEN_SETTINGS_KEY);
    return { ...SCREEN_DEFAULT_SETTINGS, ...(current[SCREEN_SETTINGS_KEY] || {}) };
}

async function screenGetEffectiveSettings(settingsOverride) {
    return settingsOverride ? { ...SCREEN_DEFAULT_SETTINGS, ...settingsOverride } : screenGetSettings();
}

async function screenSetEditorImage(image) {
    await chrome.storage.local.set({ [SCREEN_EDITOR_IMAGE_KEY]: image });
}

async function screenGetEditorImage() {
    const current = await chrome.storage.local.get(SCREEN_EDITOR_IMAGE_KEY);
    return current[SCREEN_EDITOR_IMAGE_KEY] || null;
}

async function screenGetBufferedEditorImages() {
    const current = await chrome.storage.local.get(SCREEN_EDITOR_BUFFER_KEY);
    return Array.isArray(current[SCREEN_EDITOR_BUFFER_KEY]) ? current[SCREEN_EDITOR_BUFFER_KEY] : [];
}

async function screenSetBufferedEditorImages(items) {
    await chrome.storage.local.set({ [SCREEN_EDITOR_BUFFER_KEY]: items.slice(0, 30) });
}

async function screenRememberUsableTab(tab) {
    if (!tab?.id || !tab?.windowId) {
        return;
    }

    const url = tab.url || '';
    if (['chrome://', 'edge://', 'about:', 'chrome-extension://'].some((scheme) => url.startsWith(scheme))) {
        return;
    }

    await chrome.storage.local.set({
        [SCREEN_LAST_TARGET_TAB_KEY]: {
            tabId: tab.id,
            windowId: tab.windowId,
            title: tab.title || 'Page',
            url,
            updatedAt: Date.now()
        }
    });
}

async function screenGetRememberedUsableTab() {
    const current = await chrome.storage.local.get(SCREEN_LAST_TARGET_TAB_KEY);
    const target = current[SCREEN_LAST_TARGET_TAB_KEY];
    if (!target?.tabId) {
        return null;
    }

    try {
        const tab = await chrome.tabs.get(target.tabId);
        const url = tab?.url || '';
        if (!tab?.id || ['chrome://', 'edge://', 'about:', 'chrome-extension://'].some((scheme) => url.startsWith(scheme))) {
            return null;
        }
        return tab;
    } catch (error) {
        return null;
    }
}

async function screenFocusTab(tab) {
    if (!tab?.id || !tab?.windowId) {
        return;
    }

    await chrome.windows.update(tab.windowId, { focused: false });
    await chrome.tabs.update(tab.id, { active: false });
    await delay(180);
}

async function screenBufferEditorImage(imageData) {
    const buffer = await screenGetBufferedEditorImages();
    const nextBuffer = [imageData, ...buffer].slice(0, 30);
    await screenSetBufferedEditorImages(nextBuffer);

    try {
        await chrome.runtime.sendMessage({ action: 'editor-buffer-updated', image: imageData });
    } catch (error) {
        // No active annotator window is listening.
    }
}

function screenStripExtension(filename) {
    return String(filename || '').replace(/\.[^.]+$/, '');
}

// --- AUTOPILOT ENGINE LOGIC ---
//  AUTOPILOT ENGINE LOGIC
// --- IndexedDB Access for Background Worker ---
// IndexedDB Access for Background Worker
const NHPDatabase = {
    dbName: 'NHP_Designs_DB',
    storeName: 'images',
    dbPromise: null,
    init: function () {
        if (this.dbPromise) return this.dbPromise;
        this.dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = () => {
                    try { db.close(); } catch (_) { }
                    this.dbPromise = null;
                };
                resolve(db);
            };
            req.onerror = (e) => {
                this.dbPromise = null;
                reject(e);
            };
        });
        return this.dbPromise;
    },
    getImage: async function (id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const req = tx.objectStore(this.storeName).get(id);
            req.onsuccess = () => resolve(req.result ? req.result.data : null);
            req.onerror = (e) => reject(e);
        });
    }
};

async function blobToRawBase64(blob) {
    const buffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function resolveUploadLibraryImageUrl(design, port = GHOST_SERVER_PORT) {
    const libraryId = String(design?.meta?.libraryId || '').trim();
    if (libraryId) {
        return nhpUrl(port || GHOST_SERVER_PORT, `/api/library/${encodeURIComponent(libraryId)}/download`);
    }
    const raw = String(design?.meta?.libraryImageUrl || design?.libraryImageUrl || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return nhpUrl(port || GHOST_SERVER_PORT, raw.startsWith('/') ? raw : `/${raw}`);
}

async function fetchUploadLibraryImageBase64(design, port = GHOST_SERVER_PORT) {
    const url = resolveUploadLibraryImageUrl(design, port);
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn('[AP] library image fetch failed:', res.status, url);
            return null;
        }
        const blob = await res.blob();
        if (!blob || !blob.size || !String(blob.type || '').startsWith('image/')) return null;
        return {
            base64: await blobToRawBase64(blob),
            mimeType: blob.type || design?.file?.type || 'image/png',
            source: 'libraryImageUrl',
            url
        };
    } catch (error) {
        console.warn('[AP] library image fetch error:', error?.message || error, url);
        return null;
    }
}

async function resolveUploadDesignImagePayload(design, port = GHOST_SERVER_PORT) {
    const inline = String(design?.base64 || '').trim();
    if (inline) {
        return {
            base64: inline.replace(/^data:image\/[^;]+;base64,/i, ''),
            mimeType: design?.file?.type || (inline.match(/^data:(image\/[^;]+);/i) || [])[1] || 'image/png',
            source: 'inline'
        };
    }

    if (design?.id) {
        try {
            const stored = await NHPDatabase.getImage(design.id);
            if (stored) {
                const rawStored = String(stored || '').trim();
                return {
                    base64: rawStored.replace(/^data:image\/[^;]+;base64,/i, ''),
                    mimeType: design?.file?.type || (rawStored.match(/^data:(image\/[^;]+);/i) || [])[1] || 'image/png',
                    source: 'indexedDB'
                };
            }
        } catch (error) {
            console.warn('[AP] IndexedDB image lookup failed:', design.id, error?.message || error);
        }
    }

    const libraryPayload = await fetchUploadLibraryImageBase64(design, port);
    if (libraryPayload) return libraryPayload;

    const filename = design?.file?.name || design?.name || '';
    if (filename) {
        try {
            const res = await fetch(nhpUrl(port, '/api/library'));
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data?.items) ? data.items : [];
                const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
                const targetNorm = norm(filename.replace(/\.[^.]+$/, ''));
                const match = items.find((item) =>
                    norm(item.fileName?.replace(/\.[^.]+$/, '')) === targetNorm
                    || norm(item.displayName) === targetNorm
                    || norm(item.promptPreview) === targetNorm
                );
                if (match) {
                    const downloadUrl = nhpUrl(port, `/api/library/${encodeURIComponent(match.id)}/download`);
                    console.log(`[AP] Found missing design image by filename match: "${filename}" -> id: ${match.id}`);
                    const downloadRes = await fetch(downloadUrl);
                    if (downloadRes.ok) {
                        const blob = await downloadRes.blob();
                        if (blob && blob.size && String(blob.type || '').startsWith('image/')) {
                            return {
                                base64: await blobToRawBase64(blob),
                                mimeType: blob.type || design?.file?.type || 'image/png',
                                source: 'libraryFilenameMatch',
                                url: downloadUrl
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[AP] Filename match fallback failed:', e?.message || e);
        }
    }

    return null;
}

async function getImageDimensionsFromBase64(base64Data, mimeType = 'image/png') {
    const raw = String(base64Data || '').trim();
    if (!raw) return null;
    const dataUrl = raw.startsWith('data:')
        ? raw
        : `data:${mimeType || 'image/png'};base64,${raw}`;
    try {
        const blob = await fetch(dataUrl).then((res) => res.blob());
        const bitmap = await createImageBitmap(blob);
        const dimensions = { width: bitmap.width, height: bitmap.height, bytes: blob.size };
        if (typeof bitmap.close === 'function') bitmap.close();
        return dimensions;
    } catch (error) {
        console.warn('[AP] image dimension probe failed:', error?.message || error);
        return null;
    }
}

function formatApMissingImageLabel(design) {
    return design?.meta?.title || design?.file?.name || design?.id || 'Ï¬ÏÁ┘à┘è┘à';
}

function buildApMissingImageLog(design, port = GHOST_SERVER_PORT) {
    const label = formatApMissingImageLabel(design);
    const hasLibraryRef = !!(design?.meta?.libraryId || design?.meta?.libraryImageUrl);
    if (!hasLibraryRef) {
        return `ÔÜá´©Å Ï¬┘à Ï¬Ï«ÏÀ┘è "${label}" ÔÇö ┘äÏº ┘àÏ▒Ï¼Ï╣ ┘à┘âÏ¬Ï¿Ï® (ÏúÏ╣Ï» Ïº┘äÏÑÏ▒Ï│Ïº┘ä ┘à┘å TeeMaster Ïº┘ä┘àÏ¡Ï▒┘æÏ▒)`;
    }
    const libUrl = resolveUploadLibraryImageUrl(design, port);
    return `ÔÜá´©Å Ï¬┘à Ï¬Ï«ÏÀ┘è "${label}" ÔÇö ┘üÏ┤┘ä Ï¼┘äÏ¿ Ïº┘äÏÁ┘êÏ▒Ï® ┘à┘å Ïº┘ä┘à┘âÏ¬Ï¿Ï®${libUrl ? '' : ' (Ï▒ÏºÏ¿ÏÀ Ï║┘èÏ▒ ÏÁÏº┘äÏ¡)'} ÔÇö Ï¬Ï¡┘é┘é ┘à┘å Ghost Server`;
}

function toFiniteUploadLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function isApCountPerAuto(value) {
    if (value == null || value === '') return true;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'auto' || normalized === 'Ï¬┘ä┘éÏºÏª┘è';
}

function parseApCountPerFromConfig(value) {
    if (isApCountPerAuto(value)) return null;
    const parsed = parseInt(String(value).trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(50, Math.max(1, parsed));
    }
    return null;
}

function normalizeApConfirmedAssigned(raw, accountCount) {
    if (!Array.isArray(raw) || accountCount <= 0) return null;
    const assigned = raw.slice(0, accountCount).map((value) => {
        const count = Math.floor(Number(value));
        return Number.isFinite(count) && count > 0 ? count : 0;
    });
    while (assigned.length < accountCount) assigned.push(0);
    const total = assigned.reduce((sum, count) => sum + count, 0);
    return total > 0 ? assigned : null;
}

function resolveAccountDailyLimit(acc) {
    return toFiniteUploadLimit(acc?.dailyLimit) ?? toFiniteUploadLimit(acc?.quota) ?? null;
}

function computeAccountUploadLimit(acc, effectiveCountPer, todayDate) {
    if (acc.lastUploadDate !== todayDate) {
        acc.uploadedTodayCount = 0;
        acc.lastUploadDate = todayDate;
    }
    if (acc.dailyLimitReachedDate && acc.dailyLimitReachedDate !== todayDate) {
        delete acc.dailyLimitReachedDate;
    }
    const forcedStopForToday = acc.dailyLimitReachedDate === todayDate;
    const dailyCap = resolveAccountDailyLimit(acc);
    const batchCap = toFiniteUploadLimit(acc?.batchLimit);
    const uploadedToday = Math.max(0, Number(acc.uploadedTodayCount) || 0);
    const uploadedSession = Math.max(0, Number(acc.sessionUploadedCount) || 0);
    const remainingToday = forcedStopForToday
        ? 0
        : (dailyCap == null ? Infinity : Math.max(0, dailyCap - uploadedToday));
    const remainingBatch = batchCap == null ? Infinity : Math.max(0, batchCap - uploadedSession);
    const countPerAuto = effectiveCountPer == null;
    const caps = [remainingToday];
    // ┬½Ï¬┘ä┘éÏºÏª┘è┬╗ = daily shield only ÔÇö per-account batch limits must not skew fair split.
    if (!countPerAuto) {
        caps.push(remainingBatch);
        if (Number.isFinite(Number(effectiveCountPer)) && Number(effectiveCountPer) > 0) {
            caps.push(Number(effectiveCountPer));
        }
    }
    const finiteCaps = caps.filter((value) => Number.isFinite(value));
    if (!finiteCaps.length) {
        return countPerAuto ? Infinity : 0;
    }
    return Math.max(0, Math.min(...finiteCaps));
}

function mergeApConfigAccountsWithStorage(configAccounts, storageAccounts) {
    if (!Array.isArray(configAccounts) || configAccounts.length === 0) return configAccounts;
    const storageById = new Map();
    (Array.isArray(storageAccounts) ? storageAccounts : []).forEach((acc) => {
        const id = String(acc?.id || acc?.email || '').trim();
        if (id) storageById.set(id, acc);
    });
    return configAccounts.map((acc) => {
        const id = String(acc?.id || acc?.email || '').trim();
        const stored = storageById.get(id);
        if (!stored) return acc;
        const sessionUploadedCount = Number.isFinite(Number(acc?.sessionUploadedCount))
            ? Math.max(0, Number(acc.sessionUploadedCount))
            : Math.max(0, Number(stored.sessionUploadedCount) || 0);
        const uploadedTodayCount = Number.isFinite(Number(acc?.uploadedTodayCount))
            ? Math.max(0, Number(acc.uploadedTodayCount))
            : Math.max(0, Number(stored.uploadedTodayCount) || 0);
        const dailyLimitReachedDate = acc.dailyLimitReachedDate !== undefined
            ? acc.dailyLimitReachedDate
            : stored.dailyLimitReachedDate;
        return {
            ...stored,
            ...acc,
            sessionUploadedCount,
            uploadedTodayCount,
            dailyLimitReachedDate,
            dailyLimit: acc.dailyLimit ?? stored.dailyLimit ?? stored.quota,
            batchLimit: acc.batchLimit ?? stored.batchLimit,
            quota: acc.quota ?? stored.quota,
            lastUploadDate: stored.lastUploadDate ?? acc.lastUploadDate,
            pass: acc.pass || stored.pass,
            email: acc.email || stored.email
        };
    });
}

function getStorageSelectedAccountIds(storageRes = {}) {
    if (storageRes[AP_ADMIN_USER_SELECTION_SAVED_KEY] !== true) return [];
    return [
        ...(Array.isArray(storageRes.selectedAdminNormalAccountIds) ? storageRes.selectedAdminNormalAccountIds : []),
        ...(Array.isArray(storageRes.selectedAdminCreatyAccountIds) ? storageRes.selectedAdminCreatyAccountIds : [])
    ].map((id) => String(id || '').trim()).filter(Boolean);
}

/** Multi-account + multi-design runs must never sequential-fill-all-to-first. */
function shouldForceApFairDistribution(accountCount, designCount, config = {}) {
    const accounts = Math.max(0, Number(accountCount) || 0);
    const designs = Math.max(0, Number(designCount) || 0);
    if (accounts <= 1 || designs <= 1) return false;
    if (config?.isRetryFailedOnly || Array.isArray(config?.retryPlan) && config.retryPlan.length > 0) return false;
    return true;
}

/** Resolve upload account IDs ÔÇö never fall back to the full account list order. */
function resolveApAllowedAccountIds(config, storageRes = {}, options = {}) {
    const fromConfig = Array.isArray(config?.selectedAccountIds)
        ? config.selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const fromStorage = getStorageSelectedAccountIds(storageRes);
    if (options.trustConfigSelection && fromConfig.length) {
        console.log('[AP] resolveApAllowedAccountIds: trustConfigSelection', { count: fromConfig.length, ids: fromConfig });
        return fromConfig;
    }
    if (fromConfig.length && fromStorage.length) {
        const storageSet = new Set(fromStorage);
        const intersected = fromConfig.filter((id) => storageSet.has(id));
        if (intersected.length === fromConfig.length) {
            console.log('[AP] resolveApAllowedAccountIds: full intersection', { count: intersected.length });
            return intersected;
        }
        if (intersected.length > 0 && intersected.length < fromConfig.length) {
            console.warn('[AP] resolveApAllowedAccountIds: partial intersection IGNORED ÔÇö would drop accounts', {
                fromConfig,
                fromStorage,
                intersected
            });
            return fromConfig;
        }
    }
    if (fromConfig.length) {
        console.log('[AP] resolveApAllowedAccountIds: fromConfig', { count: fromConfig.length });
        return fromConfig;
    }
    console.log('[AP] resolveApAllowedAccountIds: fromStorage', { count: fromStorage.length });
    return fromStorage;
}

function resolveApAccountLookupKeys(acc) {
    const keys = [];
    const id = String(acc?.id || '').trim();
    const email = String(acc?.email || '').trim();
    if (id) keys.push(id);
    if (email) {
        keys.push(email);
        keys.push(email.toLowerCase());
    }
    return keys;
}

function expandApAllowedIdSet(allowedIds) {
    const allowed = new Set();
    (Array.isArray(allowedIds) ? allowedIds : []).forEach((raw) => {
        const id = String(raw || '').trim();
        if (!id) return;
        allowed.add(id);
        if (id.includes('@')) allowed.add(id.toLowerCase());
    });
    return allowed;
}

/** Resolve upload accounts ÔÇö fall back to UI payload when storage id/email keys diverge (creaty). */
function resolveApConfiguredAccounts(config, storageAccounts, selectedIds) {
    const allowedIds = Array.isArray(selectedIds)
        ? selectedIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const filtered = filterApConfigToSelectedAccounts(config, storageAccounts, allowedIds);
    let accounts = Array.isArray(filtered?.accounts) ? filtered.accounts : [];
    if (accounts.length > 0) {
        return { config: filtered, accounts, allowedIds };
    }
    const allowed = expandApAllowedIdSet(allowedIds);
    const payloadAccounts = Array.isArray(config?.accounts) ? config.accounts : [];
    const fallback = payloadAccounts.filter((acc) =>
        resolveApAccountLookupKeys(acc).some((key) => allowed.has(key))
    );
    if (fallback.length > 0) {
        const merged = mergeApConfigAccountsWithStorage(fallback, storageAccounts);
        return {
            config: { ...config, accounts: merged, selectedAccountIds: allowedIds },
            accounts: merged,
            allowedIds
        };
    }
    return { config: filtered, accounts: [], allowedIds };
}

function filterApConfigToSelectedAccounts(config, storageAccounts, allowedIdsOverride) {
    if (!config || typeof config !== 'object') return config;
    const allowedIds = Array.isArray(allowedIdsOverride)
        ? allowedIdsOverride.map((id) => String(id || '').trim()).filter(Boolean)
        : resolveApAllowedAccountIds(config);
    if (!allowedIds.length) {
        return { ...config, accounts: [], selectedAccountIds: [] };
    }

    const allowed = expandApAllowedIdSet(allowedIds);
    const byAllowedKey = new Map();
    const registerAccount = (acc) => {
        if (!acc || typeof acc !== 'object') return;
        resolveApAccountLookupKeys(acc).forEach((key) => {
            if (allowed.has(key) && !byAllowedKey.has(key)) byAllowedKey.set(key, acc);
        });
    };
    (Array.isArray(config.accounts) ? config.accounts : []).forEach(registerAccount);
    (Array.isArray(storageAccounts) ? storageAccounts : []).forEach(registerAccount);
    const accounts = [];
    const seenAccountIds = new Set();
    const payloadAccounts = Array.isArray(config.accounts) ? config.accounts : [];
    allowedIds.forEach((allowedKey) => {
        const key = String(allowedKey || '').trim();
        let acc = byAllowedKey.get(key) || (key.includes('@') ? byAllowedKey.get(key.toLowerCase()) : null);
        if (!acc && payloadAccounts.length) {
            acc = payloadAccounts.find((candidate) =>
                resolveApAccountLookupKeys(candidate).some((lookupKey) =>
                    lookupKey === key || (key.includes('@') && lookupKey.toLowerCase() === key.toLowerCase())
                )
            ) || null;
        }
        if (!acc) {
            console.warn('[AP] filterApConfigToSelectedAccounts: account not resolved', { allowedKey: key, allowedIds });
            return;
        }
        const stableId = String(acc?.id || acc?.email || allowedKey).trim();
        if (!stableId || seenAccountIds.has(stableId)) return;
        seenAccountIds.add(stableId);
        accounts.push(acc);
    });
    if (accounts.length < allowedIds.length) {
        console.warn('[AP] filterApConfigToSelectedAccounts: account count mismatch', {
            allowedIds,
            resolved: accounts.length,
            emails: accounts.map((a) => a?.email).filter(Boolean)
        });
        if (payloadAccounts.length === allowedIds.length) {
            const recovered = [];
            const recoveredSeen = new Set();
            allowedIds.forEach((allowedKey, index) => {
                const fromPayload = payloadAccounts[index];
                if (!fromPayload) return;
                const stableId = String(fromPayload?.id || fromPayload?.email || allowedKey).trim();
                if (!stableId || recoveredSeen.has(stableId)) return;
                recoveredSeen.add(stableId);
                recovered.push(fromPayload);
            });
            if (recovered.length > accounts.length) {
                console.warn('[AP] filterApConfigToSelectedAccounts: recovered from UI payload', {
                    recovered: recovered.length,
                    emails: recovered.map((a) => a?.email).filter(Boolean)
                });
                accounts.length = 0;
                recovered.forEach((acc) => accounts.push(acc));
            }
        }
    }
    return { ...config, accounts, selectedAccountIds: allowedIds };
}

/** Rebuild ap_start config from UI selection only ÔÇö ignore stale cached accounts. */
async function buildApStartConfigFromRequest(reqData = {}, persisted = {}, storageRes = {}) {
    const platform = reqData?.platform || persisted.platform || 'teepublic';
    const platformKey = `ap_accounts_${platform}`;
    const accRes = await new Promise((resolve) => {
        chrome.storage.local.get([platformKey, 'ap_accounts'], resolve);
    });
    const storageAccounts = accRes[platformKey] || accRes.ap_accounts || [];
    let freshSelectedIds = Array.isArray(reqData?.selectedAccountIds)
        ? reqData.selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const requestAccounts = Array.isArray(reqData?.accounts) ? reqData.accounts : [];
    if (!freshSelectedIds.length && requestAccounts.length) {
        freshSelectedIds = requestAccounts
            .map((acc) => String(acc?.id || acc?.email || '').trim())
            .filter(Boolean);
    }
    const trustRequestSelection = freshSelectedIds.length > 0 || requestAccounts.length > 0;
    const allowedIds = resolveApAllowedAccountIds(
        { selectedAccountIds: freshSelectedIds },
        storageRes,
        { trustConfigSelection: trustRequestSelection }
    );
    if (!allowedIds.length) {
        console.warn('[Autopilot][Upload] buildApStartConfigFromRequest: no allowed account IDs', {
            freshSelectedIds,
            requestAccountCount: requestAccounts.length,
            userSaved: storageRes?.[AP_ADMIN_USER_SELECTION_SAVED_KEY] === true
        });
        return null;
    }

    const persistedIds = Array.isArray(persisted?.selectedAccountIds)
        ? persisted.selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const selectionChanged = persistedIds.length > 0
        && (persistedIds.length !== allowedIds.length
            || persistedIds.some((id, index) => id !== allowedIds[index]));

    const parsedCountPer = parseApCountPerFromConfig(reqData?.countPer ?? persisted.countPer);
    const baseConfig = {
        platform,
        port: reqData?.port ?? persisted.port,
        countPer: parsedCountPer,
        countPerAuto: parsedCountPer == null,
        delaySec: Number.isFinite(Number(reqData?.delaySec)) ? Number(reqData.delaySec) : (Number(persisted.delaySec) || 30),
        isVisual: reqData?.isVisual ?? persisted.isVisual ?? false,
        actionType: reqData?.actionType ?? persisted.actionType ?? 'publish',
        defaultColor: reqData?.defaultColor ?? persisted.defaultColor ?? 'Black',
        isRandom: reqData?.isRandom ?? persisted.isRandom ?? false,
        isFairDistribution: reqData?.isFairDistribution !== undefined
            ? reqData.isFairDistribution !== false
            : persisted?.isFairDistribution !== false,
        explicitFairDistributionOff: reqData?.explicitFairDistributionOff === true,
        selectedAccountIds: allowedIds,
        totalPlannedUploads: Math.max(0, Number(reqData?.totalPlannedUploads ?? persisted?.totalPlannedUploads) || 0)
    };
    if (selectionChanged) {
        console.warn('[AP] ap_start selection changed ÔÇö ignoring stale ap_last_start_config accounts', {
            persisted: persistedIds,
            fresh: allowedIds
        });
    }
    const merged = filterApConfigToSelectedAccounts(
        { ...baseConfig, accounts: requestAccounts },
        storageAccounts,
        allowedIds
    );
    if (!Array.isArray(merged.accounts) || merged.accounts.length === 0) {
        console.warn('[Autopilot][Upload] buildApStartConfigFromRequest: account lookup failed', {
            allowedIds,
            requestEmails: requestAccounts.map((a) => a?.email).filter(Boolean),
            storageCount: storageAccounts.length
        });
        return null;
    }
    const confirmedSource = selectionChanged
        ? reqData?.confirmedAssigned
        : (reqData?.confirmedAssigned ?? persisted?.confirmedAssigned);
    const confirmedAssigned = normalizeApConfirmedAssigned(confirmedSource, merged.accounts.length);
    if (confirmedAssigned) {
        merged.confirmedAssigned = confirmedAssigned;
        const confirmedTotal = confirmedAssigned.reduce((sum, count) => sum + count, 0);
        merged.totalPlannedUploads = Math.max(confirmedTotal, merged.totalPlannedUploads || 0);
    }
    const accountCountForFair = Array.isArray(merged?.accounts) ? merged.accounts.length : 0;
    const seoReadyCount = Math.max(0, Number(reqData?.seoReadyCount) || 0);
    if (shouldForceApFairDistribution(accountCountForFair, seoReadyCount, merged)) {
        merged.isFairDistribution = true;
        merged.explicitFairDistributionOff = false;
    } else if (accountCountForFair > 1 && merged.explicitFairDistributionOff !== true) {
        merged.isFairDistribution = true;
    }
    console.log('[Autopilot][Upload] buildApStartConfigFromRequest OK', {
        emails: merged.accounts.map((a) => a?.email).filter(Boolean),
        allowedIds,
        selectedAccountIds: merged.selectedAccountIds,
        isFairDistribution: merged.isFairDistribution !== false,
        explicitFairDistributionOff: merged.explicitFairDistributionOff === true,
        forceFair: shouldForceApFairDistribution(accountCountForFair, seoReadyCount, merged),
        accountCount: accountCountForFair,
        seoReadyCount,
        uploadAccountsLength: requestAccounts.length,
        countPer: merged.countPer,
        countPerAuto: merged.countPerAuto === true,
        confirmedAssigned: merged.confirmedAssigned || null,
        totalPlannedUploads: merged.totalPlannedUploads || 0
    });
    return merged;
}

function fairDistributeDesignCounts(totalDesigns, limits) {
    const safeLimits = (Array.isArray(limits) ? limits : []).map((limit) => {
        const n = Number(limit);
        if (n === Infinity) return Infinity;
        return Number.isFinite(n) && n > 0 ? n : 0;
    });
    const assigned = safeLimits.map(() => 0);
    let remaining = Math.max(0, totalDesigns);
    while (remaining > 0) {
        const eligible = safeLimits.map((limit, index) => index).filter((index) => assigned[index] < safeLimits[index]);
        if (eligible.length === 0) break;
        let pick = eligible[0];
        for (const index of eligible) {
            if (assigned[index] < assigned[pick] || (assigned[index] === assigned[pick] && index < pick)) {
                pick = index;
            }
        }
        assigned[pick] += 1;
        remaining -= 1;
    }
    return { assigned, unassigned: remaining };
}

/** Reset per-session upload counters before planning distribution (non-retry runs). */
function resetApUploadSessionCounters(accounts, todayDate, options = {}) {
    const today = todayDate || new Date().toISOString().split('T')[0];
    const fairFresh = options.fairFresh === true;
    if (!Array.isArray(accounts)) return;
    accounts.forEach((acc) => {
        if (!acc || typeof acc !== 'object') return;
        acc.sessionUploadedCount = 0;
        if (fairFresh || acc.lastUploadDate !== today) {
            acc.uploadedTodayCount = 0;
            acc.lastUploadDate = today;
        }
        if (fairFresh && acc.dailyLimitReachedDate) {
            delete acc.dailyLimitReachedDate;
        }
    });
}

function buildFairDistributionPlan(totalDesigns, accounts, effectiveCountPer, todayDate) {
    const limits = (Array.isArray(accounts) ? accounts : []).map((acc) =>
        computeAccountUploadLimit(acc, effectiveCountPer, todayDate)
    );
    const plan = fairDistributeDesignCounts(totalDesigns, limits);
    return { limits, assigned: plan.assigned, unassigned: plan.unassigned };
}

function logApProcessAbort(reason, detail = null) {
    if (detail != null && typeof detail === 'object') {
        console.warn('[AP] startAPProcess abort:', reason, detail);
    } else {
        console.warn('[AP] startAPProcess abort:', reason);
    }
}

async function abortApUploadEarly(reason, partialState = {}) {
    logApProcessAbort(reason, partialState?.abortDetail ?? null);
    apProcessRunning = false;
    await publishApQueueState({
        isRunning: false,
        stopped: false,
        overallStatus: 'failed',
        finishedAt: new Date().toISOString(),
        ...clearApCurrentAccountFields(),
        ...partialState
    });
    chrome.runtime.sendMessage({
        action: 'ap_update',
        done: true,
        success: false,
        toast: reason,
        type: 'error'
    });
    stopHeartbeat();
}

function buildApGhostUploadAccountPayload(acc) {
    if (!acc || typeof acc !== 'object') return { email: '', pass: '' };
    return {
        id: acc.id || null,
        email: acc.email || '',
        pass: acc.pass || '',
        proxy: acc.proxy || null,
        storeProfile: acc.storeProfile || null,
        displayName: acc.displayName || null
    };
}

function isApGhostAuthFailure(errorText = '') {
    const normalized = String(errorText || '').toLowerCase();
    return normalized === 'auth'
        || normalized.includes('authentication failed')
        || normalized.includes('login required')
        || normalized.includes('tee public login')
        || normalized.includes('must be logged in');
}

async function startAPProcess(config) {
    const preAccounts = Array.isArray(config?.accounts) ? config.accounts : [];
    const preEmails = preAccounts.map((acc) => acc?.email).filter(Boolean);
    const preQueuePeek = await new Promise((resolve) => chrome.storage.local.get(['savedDesignQueue'], resolve));
    const preRawQueue = Array.isArray(preQueuePeek?.savedDesignQueue) ? preQueuePeek.savedDesignQueue : [];
    const preSeoReady = preRawQueue.filter((d) => d?.meta).length;
    console.log('[AP] startAPProcess begin:', { emails: preEmails, queueLength: preRawQueue.length, seoReady: preSeoReady });

    if (!config || typeof config !== 'object') {
        await abortApUploadEarly('ÔÜá´©Å ┘èÏ▒Ï¼┘ë ÏºÏ«Ï¬┘èÏºÏ▒ Ï¡Ï│ÏºÏ¿ ┘êÏºÏ¡Ï» Ï╣┘ä┘ë Ïº┘äÏú┘é┘ä', { abortDetail: { path: 'invalid_config' } });
        return;
    }
    if (preRawQueue.length === 0 || preSeoReady === 0) {
        await abortApUploadEarly(
            preRawQueue.length === 0
                ? 'ÔÜá´©Å Ïº┘ä┘éÏºÏª┘àÏ® ┘üÏºÏ▒Ï║Ï®! ÏúÏÂ┘ü Ï¬ÏÁÏº┘à┘è┘à Ïú┘ê┘äÏº┘ï'
                : 'ÔÜá´©Å ┘äÏº Ï¬┘êÏ¼Ï» Ï¬ÏÁÏº┘à┘è┘à Ï¼Ïº┘çÏ▓Ï® ÔÇö ┘å┘ü┘æÏ░ Ïº┘äÏ¬Ï¡┘ä┘è┘ä Ïº┘äÏ░┘â┘è (SEO) Ïú┘ê┘äÏº┘ï',
            { abortDetail: { path: 'queue_not_ready', queueLength: preRawQueue.length, seoReady: preSeoReady } }
        );
        return;
    }
    const uploadPort = Number(config.port) || GHOST_SERVER_PORT;
    const ghostReady = await ensureGhostServerReady({ port: uploadPort, forUpload: true });
    if (!ghostReady) {
        await abortApUploadEarly(
            'ÔÜá´©Å Ghost Server Ï║┘èÏ▒ ┘àÏ¬ÏÁ┘ä ÔÇö ÏºÏÂÏ║ÏÀ ┬½Ï¬Ï┤Ï║┘è┘ä Ïº┘äÏ│┘èÏ▒┘üÏ▒┬╗ Ïú┘ê┘äÏº┘ï Ï½┘à ÏúÏ╣Ï» Ïº┘äÏ▒┘üÏ╣',
            { abortDetail: { path: 'ghost_not_ready', port: uploadPort, forUpload: true } }
        );
        return;
    }
    console.log('[Autopilot][Upload] Ghost Server ready ÔÇö opening upload session for first account');
    const platformKey = `ap_accounts_${config.platform || 'teepublic'}`;
    const storageRes = await new Promise(r => chrome.storage.local.get(['savedDesignQueue', platformKey, 'ap_accounts'], r));
    const rawQueue = Array.isArray(storageRes.savedDesignQueue) ? storageRes.savedDesignQueue : [];
    let allDesigns = rawQueue.filter(d => d?.meta);
    console.log('[AP] startAPProcess queue:', { total: rawQueue.length, seoReady: allDesigns.length });
    // ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¬├âÔäó├ïÔÇá├â╦£├é┬º├âÔäó├é┬ü├âÔäó├óÔé¼┼í ├âÔäó├óÔé¼┬ª├â╦£├é┬╣ ├â╦£├é┬º├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬ª├âÔäó├é┬ü├â╦£├é┬¬├â╦£├é┬º├â╦£├é┬¡ ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¼├â╦£├é┬»├âÔäó├à┬á├â╦£├é┬» ├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬ª├âÔäó├óÔé¼┬á├â╦£├é┬Á├â╦£├é┬®
    let apAccounts = storageRes[platformKey] || storageRes.ap_accounts || [];
    const selectedIds = Array.isArray(config?.selectedAccountIds)
        ? config.selectedAccountIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
    const initialResolved = resolveApConfiguredAccounts(config, apAccounts, selectedIds);
    config = initialResolved.config;
    let configuredAccounts = initialResolved.accounts;
    if (configuredAccounts.length === 0) {
        await abortApUploadEarly('ÔÜá´©Å ┘èÏ▒Ï¼┘ë ÏºÏ«Ï¬┘èÏºÏ▒ Ï¡Ï│ÏºÏ¿ ┘êÏºÏ¡Ï» Ï╣┘ä┘ë Ïº┘äÏú┘é┘ä', {
            abortDetail: { path: 'accounts_empty_after_filter', selectedIds, storageCount: apAccounts.length }
        });
        return;
    }
    const retryPlan = Array.isArray(config.retryPlan) ? config.retryPlan : [];
    const retryPlanByAccountId = retryPlan.length > 0
        ? new Map(retryPlan.map((item) => [
            String(item?.accountId || ''),
            new Set((Array.isArray(item?.queueItemIds) ? item.queueItemIds : []).map((id) => String(id || '')).filter(Boolean))
        ]).filter(([accountId, ids]) => accountId && ids.size > 0))
        : null;

    if (retryPlanByAccountId?.size) {
        const retryDesignIds = new Set();
        retryPlanByAccountId.forEach((ids) => ids.forEach((id) => retryDesignIds.add(id)));
        allDesigns = allDesigns.filter((design) => retryDesignIds.has(String(design?.id || '')));
        configuredAccounts = configuredAccounts.filter((acc) => retryPlanByAccountId.has(String(acc?.id || acc?.email || '')));
    }
    configuredAccounts = mergeApConfigAccountsWithStorage(configuredAccounts, apAccounts);
    const refiltered = resolveApConfiguredAccounts(
        { ...config, accounts: configuredAccounts },
        apAccounts,
        selectedIds
    );
    configuredAccounts = refiltered.accounts;
    if (configuredAccounts.length === 0) {
        await abortApUploadEarly('ÔÜá´©Å ┘äÏº Ï¬┘êÏ¼Ï» Ï¡Ï│ÏºÏ¿ÏºÏ¬ ┘ä┘äÏ▒┘üÏ╣ ÔÇö ÏºÏ«Ï¬Ï▒ Ï¡Ï│ÏºÏ¿Ïº┘ï ┘êÏºÏ¡Ï»Ïº┘ï Ï╣┘ä┘ë Ïº┘äÏú┘é┘ä', {
            abortDetail: { path: 'accounts_empty_after_merge', selectedIds, emails: preEmails }
        });
        return;
    }

    if (allDesigns.length === 0) {
        await abortApUploadEarly(
            'ÔÜá´©Å ┘äÏº Ï¬┘êÏ¼Ï» Ï¬ÏÁÏº┘à┘è┘à Ï¼Ïº┘çÏ▓Ï® ┘ä┘äÏ▒┘üÏ╣ ÔÇö ┘å┘ü┘æÏ░ Ïº┘äÏ¬Ï¡┘ä┘è┘ä Ïº┘äÏ░┘â┘è (SEO) Ïú┘ê┘äÏº┘ï',
            {
                abortDetail: { path: 'designs_empty_after_retry_filter', rawQueue: rawQueue.length },
                platform: config.platform || 'teepublic',
                designsReadyForUpload: false,
                selectedAccountCount: configuredAccounts.length,
                totalQueueItems: rawQueue.length,
                totalPlannedUploads: 0,
                completedUploads: 0,
                perAccount: [],
                perDesign: []
            }
        );
        return;
    }
    const { countPer, delaySec, isVisual, actionType, defaultColor, isRandom } = config;
    const accounts = configuredAccounts;
    const effectiveCountPer = parseApCountPerFromConfig(countPer);
    const confirmedAssigned = normalizeApConfirmedAssigned(config.confirmedAssigned, accounts.length);
    const countPerForRuntimeCap = confirmedAssigned ? null : effectiveCountPer;
    let isFairDistribution = config.isFairDistribution !== false;
    if (shouldForceApFairDistribution(accounts.length, allDesigns.length, config)) {
        isFairDistribution = true;
        config.isFairDistribution = true;
        config.explicitFairDistributionOff = false;
    } else if (accounts.length > 1 && allDesigns.length > 1 && config.explicitFairDistributionOff !== true) {
        isFairDistribution = true;
        config.isFairDistribution = true;
    }
    console.log('[AP] startAPProcess distribution decision:', {
        accountsLength: accounts.length,
        accountEmails: accounts.map((a) => a?.email).filter(Boolean),
        designsLength: allDesigns.length,
        isFairDistribution,
        explicitFairDistributionOff: config.explicitFairDistributionOff === true,
        configIsFair: config.isFairDistribution !== false,
        selectedIds,
        countPerRaw: countPer,
        effectiveCountPer,
        confirmedAssigned
    });
    const todayDateForFair = new Date().toISOString().split('T')[0];
    if (!retryPlanByAccountId) {
        resetApUploadSessionCounters(accounts, todayDateForFair, { fairFresh: isFairDistribution && accounts.length > 1 });
        accounts.forEach((acc) => {
            const idx = apAccounts.findIndex((stored) =>
                String(stored?.id || stored?.email || '') === String(acc?.id || acc?.email || '')
            );
            if (idx !== -1) {
                apAccounts[idx].sessionUploadedCount = 0;
                apAccounts[idx].uploadedTodayCount = acc.uploadedTodayCount;
                apAccounts[idx].lastUploadDate = acc.lastUploadDate;
                if (isFairDistribution && accounts.length > 1 && apAccounts[idx].dailyLimitReachedDate) {
                    delete apAccounts[idx].dailyLimitReachedDate;
                }
            }
        });
        const sessionResetPayload = { [platformKey]: apAccounts };
        if (platformKey === 'ap_accounts_teepublic') sessionResetPayload.ap_accounts = apAccounts;
        await setStorage(sessionResetPayload);
    }
    const perAccountState = accounts.map((acc) => ({
        accountId: String(acc?.id || acc?.email || ''),
        accountLabel: acc?.displayName || acc?.email || 'Unknown',
        accountEmail: acc?.email || '',
        status: 'waiting',
        uploadedCount: 0,
        plannedCount: 0,
        startedAt: null,
        finishedAt: null
    }));
    const perDesignState = allDesigns.map((design) => ({
        queueItemId: String(design?.id || ''),
        accountId: null,
        accountLabel: null,
        status: normalizeApQueueStatus(design?.meta ? 'ready' : 'waiting'),
        title: design?.meta?.title || design?.file?.name || String(design?.id || 'Untitled')
    }));
    const baseQueueState = {
        platform: config.platform || 'teepublic',
        isRunning: true,
        stopped: false,
        stoppedAt: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        overallStatus: 'uploading',
        designsReadyForUpload: rawQueue.length > 0 && rawQueue.every((item) => !!item?.meta),
        selectedAccountIds: selectedIds,
        selectedAccountCount: accounts.length,
        completedAccountCount: 0,
        failedAccounts: 0,
        totalQueueItems: rawQueue.length,
        totalPlannedUploads: confirmedAssigned
            ? confirmedAssigned.reduce((sum, count) => sum + count, 0)
            : (Math.max(0, Number(config.totalPlannedUploads) || 0) || allDesigns.length),
        completedUploads: 0,
        overallProgressPercent: 0,
        perAccount: perAccountState,
        perDesign: perDesignState,
        ...(accounts[0] ? buildApCurrentAccountFields(accounts[0], perAccountState[0], 0, accounts.length) : {})
    };
    await publishApQueueState({ ...baseQueueState, __replace: true }, { replace: true });
    if (typeof NhpApUploadMonitor !== 'undefined') {
        apUploadMonitorRun = NhpApUploadMonitor.createRun({
            platform: config.platform || 'teepublic',
            isRetry: !!retryPlanByAccountId
        });
        apMonitorAppend(
            `┘àÏ▒Ïº┘éÏ¿Ï® Ï»┘üÏ╣Ï® AUT | Ï¡Ï│ÏºÏ¿ÏºÏ¬=${accounts.length} | Ï¬ÏÁÏº┘à┘è┘à=${allDesigns.length} | ÏºÏ│Ï¬┘àÏ▒ÏºÏ▒-Ï╣┘åÏ»-Ïº┘ä┘üÏ┤┘ä=┘åÏ╣┘à`,
            'monitor'
        );
        await persistApUploadMonitorRun(apUploadMonitorRun);
    } else {
        apUploadMonitorRun = null;
    }
    chrome.runtime.sendMessage({
        action: 'ap_update',
        log: `­ƒôÜ queueReady=${allDesigns.length} | countPer(raw)=${countPer ?? 'auto'} | countPer(effective)=${effectiveCountPer ?? 'auto'} | confirmed=${confirmedAssigned ? confirmedAssigned.join(',') : 'none'} | platform=${config.platform || 'teepublic'} | failSoft=on`,
        toast: `­ƒôÜ ${allDesigns.length} Ï¬ÏÁ┘à┘è┘à Ï¼Ïº┘çÏ▓ | Ïº┘äÏ¡Ï│ÏºÏ¿: ${accounts[0]?.email || 'ÔÇö'}`,
        type: 'info'
    });
    if (isRandom) allDesigns = [...allDesigns].sort(() => Math.random() - 0.5);

    let currentIndex = 0;
    let fairDesignOffset = 0;
    let fairAssignmentCounts = null;
    let fairDesignSlices = null;
    if (!retryPlanByAccountId && confirmedAssigned) {
        const confirmedLimits = accounts.map((acc) =>
            computeAccountUploadLimit(acc, countPerForRuntimeCap, todayDateForFair)
        );
        // Respect exactly what the user approved in ┬½Ï¬Ïú┘â┘èÏ» Ï¿Ï»Ïí Ïº┘äÏ▒┘üÏ╣┬╗ ÔÇö no re-clamp.
        fairAssignmentCounts = confirmedAssigned.map((count) => Math.max(0, Math.floor(Number(count) || 0)));
        let sliceOffset = 0;
        fairDesignSlices = accounts.map((acc, index) => {
            const planned = fairAssignmentCounts[index] || 0;
            const slice = allDesigns.slice(sliceOffset, sliceOffset + planned);
            sliceOffset += planned;
            return slice;
        });
        const confirmedTotal = fairAssignmentCounts.reduce((sum, count) => sum + count, 0);
        fairAssignmentCounts.forEach((count, index) => {
            if (perAccountState[index]) perAccountState[index].plannedCount = count;
        });
        await publishApQueueState({
            perAccount: perAccountState,
            totalPlannedUploads: confirmedTotal
        });
        const confirmedUnassigned = Math.max(0, allDesigns.length - confirmedTotal);
        console.log('[AP] confirmed upload plan:', {
            assigned: fairAssignmentCounts,
            limits: confirmedLimits,
            unassigned: confirmedUnassigned,
            perAccount: accounts.map((acc, index) => ({
                email: acc?.email || '',
                planned: fairAssignmentCounts[index] || 0,
                limit: confirmedLimits[index] || 0
            }))
        });
        if (confirmedUnassigned > 0) {
            chrome.runtime.sendMessage({
                action: 'ap_update',
                toast: `ÔÜá´©Å ${confirmedUnassigned} Ï¬ÏÁ┘à┘è┘à ┘ä┘å ┘è┘ÅÏ▒┘üÏ╣ ÔÇö Ïú┘é┘ä ┘à┘å Ïº┘ä┘àÏñ┘âÏ» ┘ü┘è Ï¿ÏÀÏº┘éÏ® Ïº┘äÏ¬Ïú┘â┘èÏ»`,
                type: 'warning'
            });
        }
        const confirmedSummary = accounts.map((acc, index) => {
            const alias = acc.displayName || acc.email?.split?.('@')?.[0] || acc.email || 'Ï¡Ï│ÏºÏ¿';
            return `${alias}:${fairAssignmentCounts[index]}`;
        }).join(' | ');
        chrome.runtime.sendMessage({
            action: 'ap_update',
            log: `Ô£à Ï«ÏÀÏ® ┘àÏñ┘âÏ»Ï® ┘à┘å Ï¿ÏÀÏº┘éÏ® Ïº┘äÏ¬Ïú┘â┘èÏ» | ${confirmedSummary}`,
            type: 'info'
        });
    } else if (isFairDistribution && !retryPlanByAccountId) {
        const fairDistribution = buildFairDistributionPlan(allDesigns.length, accounts, effectiveCountPer, todayDateForFair);
        const fairLimits = fairDistribution.limits;
        const fairPlan = { assigned: fairDistribution.assigned, unassigned: fairDistribution.unassigned };
        const totalFairAssigned = fairPlan.assigned.reduce((sum, value) => sum + (Number(value) || 0), 0);
        const fairLogPayload = {
            enabled: true,
            isFairDistribution,
            designs: allDesigns.length,
            accountCount: accounts.length,
            countPer: effectiveCountPer,
            limits: fairLimits,
            planned: fairPlan.assigned,
            perAccount: accounts.map((acc, index) => ({
                email: acc?.email || '',
                limit: fairLimits[index],
                planned: fairPlan.assigned[index] || 0
            })),
            unassigned: fairPlan.unassigned
        };
        console.log('[AP] fair distribution:', fairLogPayload);
        if (totalFairAssigned <= 0) {
            await abortApUploadEarly(
                'ÔÜá´©Å Ïº┘äÏ¬┘êÏ▓┘èÏ╣ Ïº┘äÏ╣ÏºÏ»┘ä: ┘äÏº Ï│Ï╣Ï® Ï▒┘üÏ╣ ┘ä┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ Ïº┘ä┘àÏ¡Ï»Ï»Ï® ÔÇö Ï▒ÏºÏ¼Ï╣ Ï¡Ï»┘êÏ» Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ (­ƒøí´©Å) Ïú┘ê Ïº┘äÏ¡Ï» Ïº┘ä┘è┘ê┘à┘è',
                {
                    abortDetail: { path: 'fair_distribution_zero', fairLimits, accountEmails: accounts.map((a) => a?.email) },
                    perAccount: perAccountState,
                    perDesign: perDesignState,
                    selectedAccountCount: accounts.length
                }
            );
            return;
        } else {
            fairAssignmentCounts = fairPlan.assigned;
            let sliceOffset = 0;
            fairDesignSlices = accounts.map((acc, index) => {
                const planned = fairAssignmentCounts[index] || 0;
                const slice = allDesigns.slice(sliceOffset, sliceOffset + planned);
                sliceOffset += planned;
                return slice;
            });
            console.log('[AP] fairDesignSlices precomputed:', fairDesignSlices.map((slice, index) => ({
                index,
                email: accounts[index]?.email || '',
                planned: fairAssignmentCounts[index] || 0,
                sliceLen: slice.length,
                designIds: slice.map((d) => d?.id)
            })));
            fairPlan.assigned.forEach((count, index) => {
                if (perAccountState[index]) perAccountState[index].plannedCount = count;
            });
            await publishApQueueState({ perAccount: perAccountState });
            if (fairPlan.unassigned > 0) {
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    toast: `ÔÜá´©Å Ï│Ï╣Ï® Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ Ïº┘ä┘àÏ¡Ï»Ï»Ï® ┘äÏº Ï¬┘â┘ü┘è ÔÇö ${fairPlan.unassigned} Ï¬ÏÁ┘à┘è┘à ┘ä┘å ┘è┘ÅÏ▒┘üÏ╣`,
                    type: 'warning'
                });
            }
            const fairSummary = accounts.map((acc, index) => {
                const alias = acc.displayName || acc.email?.split?.('@')?.[0] || acc.email || 'Ï¡Ï│ÏºÏ¿';
                return `${alias}:${fairAssignmentCounts[index]}/${fairLimits[index]}`;
            }).join(' | ');
            chrome.runtime.sendMessage({
                action: 'ap_update',
                log: `ÔÜû´©Å Ï¬┘êÏ▓┘èÏ╣ Ï╣ÏºÏ»┘ä | ${fairSummary}`,
                type: 'info'
            });
        }
    } else if (!retryPlanByAccountId) {
        if (shouldForceApFairDistribution(accounts.length, allDesigns.length, config)) {
            console.error('[AP] fair distribution: FORCED PLAN MISSING ÔÇö rebuilding safety plan');
            const fairDistribution = buildFairDistributionPlan(allDesigns.length, accounts, effectiveCountPer, todayDateForFair);
            fairAssignmentCounts = fairDistribution.assigned;
            isFairDistribution = true;
            let sliceOffset = 0;
            fairDesignSlices = accounts.map((acc, index) => {
                const planned = fairAssignmentCounts[index] || 0;
                const slice = allDesigns.slice(sliceOffset, sliceOffset + planned);
                sliceOffset += planned;
                return slice;
            });
            fairAssignmentCounts.forEach((count, index) => {
                if (perAccountState[index]) perAccountState[index].plannedCount = count;
            });
            await publishApQueueState({ perAccount: perAccountState });
        } else {
        console.log('[AP] fair distribution:', {
            enabled: false,
            mode: 'sequential-fill',
            note: 'Ïº┘äÏ¡Ï│ÏºÏ¿ Ïº┘äÏú┘ê┘ä ┘èÏúÏ«Ï░ Ï¡Ï¬┘ë countPer Ï¬ÏÁÏº┘à┘è┘àÏî Ï½┘à Ïº┘äÏ¬Ïº┘ä┘è ÔÇö ┘üÏ╣┘æ┘ä ┬½Ï¬┘êÏ▓┘èÏ╣ Ï╣ÏºÏ»┘ä┬╗ ┘äÏ¬┘éÏ│┘è┘à ┘àÏ¬┘êÏºÏ▓┘å',
            designs: allDesigns.length,
            accountCount: accounts.length,
            countPer: effectiveCountPer
        });
        }
    }

    const hasUploadCapacity = accounts.some((acc, index) => {
        const runtimeCap = computeAccountUploadLimit(acc, countPerForRuntimeCap, todayDateForFair);
        if (fairAssignmentCounts) {
            return Math.min(fairAssignmentCounts[index] || 0, runtimeCap) > 0;
        }
        return runtimeCap > 0;
    });
    if (!hasUploadCapacity) {
        await abortApUploadEarly(
            'ÔÜá´©Å ┘äÏº Ï¬┘êÏ¼Ï» Ï│Ï╣Ï® Ï▒┘üÏ╣ ┘ä┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ Ïº┘ä┘àÏ¡Ï»Ï»Ï® ÔÇö Ï▒ÏºÏ¼Ï╣ Ï¡Ï»┘êÏ» Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ (­ƒøí´©Å) Ïú┘ê Ïº┘äÏ¡Ï» Ïº┘ä┘è┘ê┘à┘è',
            {
                abortDetail: {
                    path: 'no_upload_capacity',
                    accountEmails: accounts.map((a) => a?.email),
                    fairAssignmentCounts
                },
                perAccount: perAccountState,
                perDesign: perDesignState,
                selectedAccountCount: accounts.length
            }
        );
        return;
    }

    let projectedPlannedUploads = 0;
    if (fairAssignmentCounts) {
        projectedPlannedUploads = fairAssignmentCounts.reduce((sum, count) => sum + (Number(count) || 0), 0);
    } else {
        let designOffset = 0;
        for (let planIndex = 0; planIndex < accounts.length; planIndex++) {
            const planCap = computeAccountUploadLimit(accounts[planIndex], countPerForRuntimeCap, todayDateForFair);
            if (planCap <= 0) continue;
            projectedPlannedUploads += Math.min(planCap, Math.max(0, allDesigns.length - designOffset));
            designOffset += Math.min(planCap, Math.max(0, allDesigns.length - designOffset));
            if (designOffset >= allDesigns.length) break;
        }
    }
    if (projectedPlannedUploads <= 0) {
        await abortApUploadEarly(
            'ÔÜá´©Å ┘äÏº Ï¬┘êÏ¼Ï» Ï¬ÏÁÏº┘à┘è┘à ┘àÏ«ÏÁÏÁÏ® ┘ä┘äÏ▒┘üÏ╣ ÔÇö Ï▒ÏºÏ¼Ï╣ Ï¡Ï»┘êÏ» Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ (­ƒøí´©Å) Ïú┘ê ÏºÏ«Ï¬┘èÏºÏ▒ Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬',
            {
                abortDetail: { path: 'projected_planned_zero', projectedPlannedUploads, accountEmails: accounts.map((a) => a?.email) },
                perAccount: perAccountState,
                perDesign: perDesignState,
                selectedAccountCount: accounts.length,
                totalPlannedUploads: 0
            }
        );
        return;
    }

    const totalAccounts = accounts.length;
    const MAX_UPLOAD_PAYLOAD_BYTES = 110 * 1024 * 1024; // allow normal 5-design batches while still staying under express 150mb
    const MAX_DESIGNS_PER_REQUEST = Math.max(1, Math.min(effectiveCountPer ?? 5, 5));
    const estimateDesignPayloadBytes = (design) => {
        const base64Len = (design.base64 || '').length;
        const metaLen = JSON.stringify(design.meta || {}).length;
        const fileLen = JSON.stringify(design.file || {}).length;
        return base64Len + metaLen + fileLen + 1024;
    };

    for (let i = 0; i < totalAccounts; i++) {
        if (apStopped) break;
        if (!retryPlanByAccountId) {
            const processedOffset = fairAssignmentCounts ? fairDesignOffset : currentIndex;
            if (processedOffset >= allDesigns.length) break;
        }

        const acc = accounts[i];
        const accountId = String(acc?.id || acc?.email || '');
        const accountState = perAccountState.find((item) => item.accountId === accountId);

        // v16.1 ├â┬ó├óÔÇÜ┬¼├óÔé¼┬Ø Check Limits Again in Background
        const todayDate = new Date().toISOString().split('T')[0];
        if (acc.lastUploadDate !== todayDate) {
            acc.uploadedTodayCount = 0;
            acc.lastUploadDate = todayDate;
        }

        if (acc.dailyLimitReachedDate && acc.dailyLimitReachedDate !== todayDate) {
            delete acc.dailyLimitReachedDate;
        }

        const runtimeCap = computeAccountUploadLimit(acc, countPerForRuntimeCap, todayDate);
        const rawLimit = fairAssignmentCounts
            ? Math.min(fairAssignmentCounts[i] || 0, runtimeCap)
            : runtimeCap;
        const limit = Number.isFinite(Number(rawLimit)) ? Math.max(0, Number(rawLimit)) : 0;
        const forcedStopForToday = acc.dailyLimitReachedDate === todayDate;
        const dailyCap = resolveAccountDailyLimit(acc);
        const batchCap = toFiniteUploadLimit(acc?.batchLimit);
        const remainingToday = forcedStopForToday
            ? 0
            : (dailyCap == null ? Infinity : Math.max(0, dailyCap - (Number(acc.uploadedTodayCount) || 0)));
        const remainingBatch = batchCap == null
            ? Infinity
            : Math.max(0, batchCap - (Number(acc.sessionUploadedCount) || 0));
        const queueRemaining = fairAssignmentCounts
            ? Math.max(0, allDesigns.length - fairDesignOffset)
            : Math.max(0, allDesigns.length - currentIndex);

        chrome.runtime.sendMessage({
            action: 'ap_update',
                log: `­ƒôÉ ${acc.displayName || acc.email?.split?.('@')?.[0] || acc.email || 'Ï¡Ï│ÏºÏ¿'} | remainingQueue=${queueRemaining} | daily=${remainingToday} | batch=${remainingBatch} | countPer=${effectiveCountPer} | limit=${limit}${forcedStopForToday ? ' | blocked=today' : ''}${isFairDistribution ? ' | fair=on' : ''}`,
                type: 'info'
            });

        if (limit <= 0) {
            if (!retryPlanByAccountId && fairAssignmentCounts && !fairDesignSlices && (fairAssignmentCounts[i] || 0) > 0) {
                fairDesignOffset += Math.min(
                    fairAssignmentCounts[i] || 0,
                    Math.max(0, allDesigns.length - fairDesignOffset)
                );
            }
            if (accountState) {
                accountState.status = 'skipped';
                accountState.finishedAt = new Date().toISOString();
            }
            await publishApQueueState({
                perAccount: perAccountState,
                failedAccounts: perAccountState.filter((item) => item.status === 'failed').length
            });
            chrome.runtime.sendMessage({
                action: 'ap_update',
                log: forcedStopForToday
                    ? `Ôøö Ï¬Ï«ÏÀ┘è Ïº┘äÏ¡Ï│ÏºÏ¿ ${acc.email} (Ï¬┘à Ïº┘âÏ¬Ï┤Ïº┘ü Ï¿┘ä┘êÏ║ Ïº┘äÏ¡Ï» Ïº┘ä┘è┘ê┘à┘è ┘ä┘çÏ░Ïº Ïº┘ä┘è┘ê┘à)`
                    : `ÔÜá´©Å Ï¬Ï«ÏÀ┘è Ïº┘äÏ¡Ï│ÏºÏ¿ ${acc.email} (Ï¬Ï¼Ïº┘êÏ▓ Ï¡Ï» Ïº┘äÏ▒┘üÏ╣)`,
                type: 'info'
            });
            continue;
        }

        const retryIdsForAccount = retryPlanByAccountId?.get(accountId) || null;
        const designsForAcc = retryIdsForAccount
            ? allDesigns.filter((design) => retryIdsForAccount.has(String(design?.id || '')))
            : fairDesignSlices
                ? fairDesignSlices[i].slice(0, limit)
                : fairAssignmentCounts
                    ? allDesigns.slice(fairDesignOffset, fairDesignOffset + limit)
                    : allDesigns.slice(currentIndex, currentIndex + limit);
        const assignedDesignIds = designsForAcc.map((design) => String(design?.id || '')).filter(Boolean);
        const plannedFairCount = fairAssignmentCounts ? (fairAssignmentCounts[i] || 0) : null;
        console.log('[AP] account loop:', {
            index: i,
            email: acc?.email || '',
            isFairDistribution,
            fairMode: fairDesignSlices ? 'pre-sliced' : (fairAssignmentCounts ? 'offset' : 'sequential'),
            fairDesignOffset: fairAssignmentCounts ? fairDesignOffset : currentIndex,
            plannedFairCount,
            runtimeCap,
            limit,
            actualCount: designsForAcc.length,
            designIds: assignedDesignIds
        });
        const actualCount = designsForAcc.length;
        if (actualCount <= 0) {
            if (!retryPlanByAccountId && fairAssignmentCounts && !fairDesignSlices && limit > 0) {
                fairDesignOffset += Math.min(limit, Math.max(0, allDesigns.length - fairDesignOffset));
            }
            continue;
        }
        if (!retryPlanByAccountId && !fairDesignSlices) {
            if (fairAssignmentCounts) fairDesignOffset += actualCount;
            else currentIndex += actualCount;
        }

        const startTime = Date.now();
        const alias = acc.displayName || acc.email?.split?.('@')?.[0] || acc.email || 'Ï¡Ï│ÏºÏ¿';
        if (accountState) {
            accountState.status = 'uploading';
            accountState.startedAt = new Date().toISOString();
            accountState.plannedCount = actualCount;
        }
        const plannedDesignIds = new Set(designsForAcc.map((design) => String(design?.id || '')).filter(Boolean));
        const claimedDesignStates = perDesignState.filter((item) => plannedDesignIds.has(String(item.queueItemId || '')) && item.status === 'ready').slice(0, actualCount);
        claimedDesignStates.forEach((item) => {
            item.accountId = accountId;
            item.accountLabel = alias;
            item.status = 'waiting';
        });
        await publishApQueueState({
            perAccount: perAccountState,
            perDesign: perDesignState,
            ...buildApCurrentAccountFields(acc, accountState, i, totalAccounts)
        });

        chrome.runtime.sendMessage({
            action: 'ap_update',
            log: `ÔÅ│ Ï¼ÏºÏ▒┘è Ïº┘äÏ¿Ï»Ïí ┘ü┘è Ïº┘äÏ¡Ï│ÏºÏ¿: ${alias} (${actualCount} Ï¬ÏÁÏº┘à┘è┘à)...`,
            current: i + 1,
            total: totalAccounts,
            accountEmail: acc.email,
            designUploaded: 0,
            designPlanned: actualCount,
            percent: Math.round(((i) / totalAccounts) * 100)
        });
        chrome.runtime.sendMessage({
            action: 'ap_update',
            log: `­ƒùé´©Å ${alias} | selectedDesigns=${actualCount} | titles=${designsForAcc.slice(0, 3).map(d => d.meta?.title || d.file?.name || d.id).join(' | ')}${actualCount > 3 ? ' | ...' : ''}`,
            type: 'info'
        });

        try {
            const DEFAULT_PORTS = { teepublic: 3019, redbubble: 3021, amazon: 3022, pinterest: 3023 };
            const targetPort = config.port || DEFAULT_PORTS[config.platform || 'teepublic'];
            const uploadChunks = [];
            let currentChunk = [];
            let currentChunkBytes = 0;
            let skippedMissingImages = 0;

            for (const design of designsForAcc) {
                const imagePayload = await resolveUploadDesignImagePayload(design, targetPort);
                const base64Data = imagePayload?.base64 || '';
                if (!base64Data || !String(base64Data).trim()) {
                    skippedMissingImages++;
                    const missingId = String(design?.id || '');
                    const missingState = perDesignState.find((item) => String(item.queueItemId || '') === missingId);
                    if (missingState) {
                        missingState.accountId = accountId;
                        missingState.accountLabel = alias;
                        missingState.status = 'failed';
                        missingState.error = 'missing_image';
                    }
                    apMonitorTrackDesign({
                        queueItemId: missingId,
                        accountId,
                        title: design?.meta?.title || design?.file?.name || missingId,
                        status: 'skipped_failed',
                        reason: 'missing_image',
                        phase: 'preflight'
                    });
                    apMonitorAppend(`Ï¬Ï«ÏÀ┘è Ï¬ÏÁ┘à┘è┘à (ÏÁ┘êÏ▒Ï® ┘à┘ü┘é┘êÏ»Ï®) Ï½┘à ┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ»┘üÏ╣Ï® | ${formatApMissingImageLabel(design)}`, 'monitor');
                    chrome.runtime.sendMessage({
                        action: 'ap_update',
                        log: `${alias} | ${buildApMissingImageLog(design, targetPort)} ÔÇö Ï¬Ï«ÏÀ┘è ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï®`,
                        type: 'warning'
                    });
                    continue;
                }
                const imageDimensions = await getImageDimensionsFromBase64(
                    base64Data,
                    imagePayload?.mimeType || design.file?.type || 'image/png'
                );
                const dimensionLabel = imageDimensions
                    ? `${imageDimensions.width}x${imageDimensions.height}px / ${Math.round(imageDimensions.bytes / 1024)}KB`
                    : 'ÏúÏ¿Ï╣ÏºÏ» Ï║┘èÏ▒ ┘àÏ¬ÏºÏ¡Ï®';
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `­ƒû╝´©Å ${alias} | ${formatApMissingImageLabel(design)} | ┘àÏÁÏ»Ï▒=${imagePayload?.source || 'Ï║┘èÏ▒ ┘àÏ╣Ï▒┘ê┘ü'} | ${dimensionLabel}`,
                    type: 'info'
                });

                const payloadDesign = {
                    queueItemId: String(design?.id || ''),
                    file: {
                        name: design.file?.name,
                        type: imagePayload?.mimeType || design.file?.type || 'image/png'
                    },
                    base64: base64Data,
                    meta: design.meta
                };
                const designBytes = estimateDesignPayloadBytes(payloadDesign);

                const shouldFlushChunk =
                    currentChunk.length > 0 &&
                    (currentChunk.length >= MAX_DESIGNS_PER_REQUEST || (currentChunkBytes + designBytes) > MAX_UPLOAD_PAYLOAD_BYTES);

                if (shouldFlushChunk) {
                    uploadChunks.push(currentChunk);
                    currentChunk = [];
                    currentChunkBytes = 0;
                }

                currentChunk.push(payloadDesign);
                currentChunkBytes += designBytes;
            }

            if (currentChunk.length > 0) uploadChunks.push(currentChunk);

            if (skippedMissingImages > 0) {
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `ÔÜá´©Å ${alias} | Ï¬┘à Ï¬Ï«ÏÀ┘è ${skippedMissingImages} Ï¬ÏÁ┘à┘è┘à ÔÇö Ïº┘äÏÁ┘êÏ▒Ï® Ï║┘èÏ▒ ┘à┘êÏ¼┘êÏ»Ï® ┘ü┘è IndexedDB ┘ê┘äÏº ┘ü┘è ┘à┘âÏ¬Ï¿Ï® Ghost (Ï¬Ï¡┘é┘é ┘à┘å Ï¬Ï┤Ï║┘è┘ä Ïº┘äÏ│┘èÏ▒┘üÏ▒)`,
                    type: 'warning'
                });
            }

            if (uploadChunks.length === 0) {
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `ÔÜá´©Å ${alias} | ┘äÏº Ï¬┘êÏ¼Ï» Ï¬ÏÁÏº┘à┘è┘à ÏÁÏº┘äÏ¡Ï® ┘ä┘äÏ▒┘üÏ╣ ÔÇö SEO Ï¼Ïº┘çÏ▓ ┘ä┘â┘å ┘à┘ä┘üÏºÏ¬ Ïº┘äÏÁ┘êÏ▒ ┘à┘ü┘é┘êÏ»Ï® Ïú┘ê Ï║┘èÏ▒ ┘éÏºÏ¿┘äÏ® ┘ä┘äÏ¼┘äÏ¿ ┘à┘å Ghost`,
                    toast: 'ÔÜá´©Å Ïº┘äÏ¬ÏÁÏº┘à┘è┘à ┘äÏ»┘è┘çÏº SEO ┘ä┘â┘å Ïº┘äÏÁ┘êÏ▒ ┘à┘ü┘é┘êÏ»Ï® ÔÇö Ï┤Ï║┘æ┘ä Ghost Server Ïú┘ê ÏúÏ╣Ï» ÏÑÏÂÏº┘üÏ® Ïº┘äÏ¬ÏÁÏº┘à┘è┘à',
                    type: 'warning'
                });
                continue;
            }

            let uploadedForAccount = 0;
            let accountFailed = false;

            chrome.runtime.sendMessage({
                action: 'ap_update',
                log: `­ƒº« ${alias} | Ïº┘ä┘àÏÀ┘ä┘êÏ¿ ${actualCount} Ï¬ÏÁ┘à┘è┘à | Ï│┘èÏ¬┘à Ïº┘äÏÑÏ▒Ï│Ïº┘ä Ï╣┘ä┘ë ${uploadChunks.length} Ï»┘üÏ╣Ï®`,
                type: 'info'
            });

            for (let chunkIndex = 0; chunkIndex < uploadChunks.length; chunkIndex++) {
                if (apStopped) break;

                const designPayload = uploadChunks[chunkIndex];
                const chunkIds = new Set(designPayload.map((d) => String(d?.queueItemId || '')).filter(Boolean));
                const chunkTitles = new Set(designPayload.map((d) => d?.meta?.title || d?.file?.name || ''));
                const chunkDesignStates = perDesignState.filter((item) => {
                    if (item.accountId !== accountId || item.status === 'uploaded') return false;
                    return chunkIds.size > 0 ? chunkIds.has(String(item.queueItemId || '')) : chunkTitles.has(item.title);
                }).slice(0, designPayload.length);
                chunkDesignStates.forEach((item) => { item.status = 'uploading'; });
                await publishApQueueState({
                    perDesign: perDesignState,
                    ...buildApCurrentAccountFields(acc, accountState, i, totalAccounts)
                });
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `­ƒôª ${alias} | Ï»┘üÏ╣Ï® ${chunkIndex + 1}/${uploadChunks.length} | ${designPayload.length} Ï¬ÏÁÏº┘à┘è┘à`,
                    type: 'info'
                });
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `­ƒÜÜ ${alias} | ÏÑÏ▒Ï│Ïº┘ä ┘üÏ╣┘ä┘è ÏÑ┘ä┘ë Ïº┘äÏ│┘èÏ▒┘üÏ▒ | chunkSize=${designPayload.length} | titles=${designPayload.slice(0, 3).map(d => d.meta?.title || d.file?.name || 'untitled').join(' | ')}${designPayload.length > 3 ? ' | ...' : ''}`,
                    type: 'info'
                });
                console.log('[Autopilot][Upload] Ghost /upload ÔåÆ opening TeePublic session', {
                    email: acc.email,
                    chunk: chunkIndex + 1,
                    designs: designPayload.length,
                    port: targetPort
                });

                // Ï¡Ï» Ïº┘åÏ¬Ï©ÏºÏ▒ ÏÀ┘ê┘è┘ä ┘ä┘â┘ä Ï»┘üÏ╣Ï® Ï¡Ï¬┘ë ┘äÏº ┘èÏ¬┘à ┘éÏÀÏ╣ Ïº┘äÏ▒┘üÏ╣ ÏÑÏ░Ïº ┘âÏº┘å Ïº┘äÏ│┘èÏ▒┘üÏ▒ Ïº┘ä┘àÏ¡┘ä┘è Ï¿ÏÀ┘èÏªÏº┘ï
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3600000); // 60 Ï»┘é┘è┘éÏ® ┘âÏ¡Ï» Ïú┘éÏÁ┘ë ┘ä┘äÏ»┘üÏ╣Ï®

                const uploadRes = await fetch(nhpUrl(targetPort, '/upload'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        account: buildApGhostUploadAccountPayload(acc),
                        designs: designPayload,
                        actionType: actionType || 'publish',
                        defaultColor: defaultColor || 'Black',
                        isVisual: !!isVisual,
                        platform: config.platform || 'teepublic'
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                let uploadResultData = null;
                try {
                    if (uploadRes.ok) {
                        uploadResultData = await uploadRes.json();
                    } else {
                        const errText = await uploadRes.text().catch(() => 'HTTP error');
                        uploadResultData = { success: false, error: errText };
                    }
                } catch (e) {
                    uploadResultData = { success: false, error: `JSON Parse Error: ${e.message}` };
                }

                if (uploadResultData && uploadResultData.success && Array.isArray(uploadResultData.results)) {
                    let chunkFailedCount = 0;
                    let chunkSuccessCount = 0;
                    let chunkCorrectedCount = 0;
                    
                    for (const resItem of uploadResultData.results) {
                        const matchedState = chunkDesignStates.find(item => String(item.queueItemId || '') === String(resItem.queueItemId));
                        if (matchedState) {
                            matchedState.status = resItem.status;
                            matchedState.colorsStatus = resItem.colorsStatus || null;
                            matchedState.corrected = !!resItem.corrected;
                            if (resItem.status === 'published' || resItem.status === 'uploaded') {
                                chunkSuccessCount++;
                                if (resItem.corrected || resItem.colorsStatus === 'corrected') chunkCorrectedCount++;
                                const bagsNote = (typeof NhpApUploadMonitor !== 'undefined'
                                    && NhpApUploadMonitor.isBagsPrimaryColorIssue
                                    && NhpApUploadMonitor.isBagsPrimaryColorIssue(resItem.error || resItem.reason || ''))
                                    ? ' (bags primary)'
                                    : ((resItem.corrected || resItem.colorsStatus === 'corrected') ? ' (color corrected)' : '');
                                apMonitorTrackDesign({
                                    queueItemId: matchedState.queueItemId,
                                    accountId,
                                    title: matchedState.title,
                                    status: 'upload_ok',
                                    colorsStatus: resItem.colorsStatus || 'ok',
                                    corrected: !!resItem.corrected,
                                    appliedColor: resItem.appliedColor || null,
                                    phase: 'done',
                                    reason: bagsNote ? `auto-corrected${bagsNote}` : undefined
                                });
                                if (resItem.corrected || resItem.colorsStatus === 'corrected') {
                                    apMonitorAppend(
                                        `Ô£Ä Ï¬ÏÁÏ¡┘èÏ¡ Ïú┘ä┘êÏº┘å/Ï¡┘éÏºÏªÏ¿ Ï½┘à ┘åÏ┤Ï▒ | ${matchedState.title || matchedState.queueItemId}`,
                                        'monitor'
                                    );
                                }
                            } else {
                                chunkFailedCount++;
                                matchedState.status = 'failed';
                                const failReason = resItem.error || 'upload_failed';
                                const bagsFail = (typeof NhpApUploadMonitor !== 'undefined'
                                    && NhpApUploadMonitor.isBagsPrimaryColorIssue
                                    && NhpApUploadMonitor.isBagsPrimaryColorIssue(failReason));
                                apMonitorTrackDesign({
                                    queueItemId: matchedState.queueItemId,
                                    accountId,
                                    title: matchedState.title,
                                    status: 'skipped_failed',
                                    reason: bagsFail ? 'primary color for bags (skipped, continue-on-error)' : failReason,
                                    colorsStatus: resItem.colorsStatus || (bagsFail ? 'failed' : null),
                                    phase: 'done'
                                });
                                apMonitorAppend(
                                    `┘üÏ┤┘ä Ï¬ÏÁ┘à┘è┘à Ï½┘à Ï¬Ï«ÏÀ┘è ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® | ${matchedState.title || matchedState.queueItemId} | ${failReason}`,
                                    'monitor'
                                );
                                chrome.runtime.sendMessage({
                                    action: 'ap_update',
                                    log: `ÔÅ¡ Ï¬Ï«ÏÀ┘è ┘üÏºÏ┤┘ä ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® | ${alias} | ${resItem.error || 'Ï«ÏÀÏú Ï║┘èÏ▒ ┘àÏ╣Ï▒┘ê┘ü'}`,
                                    type: 'error'
                                });
                            }
                        }
                    }
                    
                    uploadedForAccount += chunkSuccessCount;
                    if (chunkCorrectedCount > 0) {
                        chrome.runtime.sendMessage({
                            action: 'ap_update',
                            log: `Ô£Ä ┘àÏ▒Ïº┘éÏ¿ Ïº┘äÏú┘ä┘êÏº┘å ÏÁÏ¡┘æÏ¡ ${chunkCorrectedCount} Ï¬ÏÁ┘à┘è┘à ┘ü┘è ┘çÏ░┘ç Ïº┘äÏ»┘üÏ╣Ï®`,
                            type: 'info'
                        });
                    }
                    await persistApUploadMonitorRun(apUploadMonitorRun);
                    
                    const accIndex = apAccounts.findIndex(a => a.id === acc.id || a.email === acc.email);
                    if (accIndex !== -1 && chunkSuccessCount > 0) {
                        if (!apAccounts[accIndex].stats) apAccounts[accIndex].stats = { uploaded: 0, time: 0 };
                        apAccounts[accIndex].stats.uploaded += chunkSuccessCount;
                        apAccounts[accIndex].uploadedTodayCount = (apAccounts[accIndex].uploadedTodayCount || 0) + chunkSuccessCount;
                        apAccounts[accIndex].sessionUploadedCount = (apAccounts[accIndex].sessionUploadedCount || 0) + chunkSuccessCount;
                        apAccounts[accIndex].lastUploadDate = new Date().toISOString().split('T')[0];
                        await setStorage({ [platformKey]: apAccounts });
                    }
                    if (accountState) accountState.uploadedCount = uploadedForAccount;
                    await publishApQueueState({
                        perAccount: perAccountState,
                        perDesign: perDesignState,
                        completedUploads: perDesignState.filter((item) => item.status === 'uploaded' || item.status === 'published').length,
                        monitorCounts: apUploadMonitorRun?.counts || null,
                        ...buildApCurrentAccountFields(acc, accountState, i, totalAccounts)
                    });
                    chrome.runtime.sendMessage({
                        action: 'ap_update',
                        accountEmail: acc.email,
                        designUploaded: uploadedForAccount,
                        designPlanned: accountState?.plannedCount || actualCount,
                        monitorCounts: apUploadMonitorRun?.counts || null,
                        log: chunkFailedCount > 0
                            ? `­ƒôè ${alias} | ┘åÏ¼ÏºÏ¡=${chunkSuccessCount} | ┘àÏ¬Ï«ÏÀ┘ë=${chunkFailedCount} | ┘àÏÁÏ¡Ï¡=${chunkCorrectedCount} (Ïº┘äÏºÏ│Ï¬┘àÏ▒ÏºÏ▒ ┘à┘üÏ╣┘æ┘ä)`
                            : undefined,
                        type: chunkFailedCount > 0 ? 'warning' : undefined
                    });
                } else {
                    const errorMsg = uploadResultData?.error || uploadResultData?.message || 'Unknown server error';
                    const normalizedErrorBody = String(errorMsg).toLowerCase();
                    const ghostUnreachable = /econnrefused|failed to fetch|network|socket|connect/i.test(normalizedErrorBody);
                    const authFailure = isApGhostAuthFailure(normalizedErrorBody);
                    const hitDailyLimit =
                        normalizedErrorBody.includes('teepublic_daily_limit_reached') ||
                        normalizedErrorBody.includes('daily limit reached') ||
                        normalizedErrorBody.includes('upload blocked for today') ||
                        normalizedErrorBody.includes('come back tomorrow') ||
                        normalizedErrorBody.includes('try again tomorrow');

                    if (hitDailyLimit) {
                        const accIndex = apAccounts.findIndex(a => a.id === acc.id || a.email === acc.email);
                        if (accIndex !== -1) {
                            apAccounts[accIndex].dailyLimitReachedDate = todayDate;
                            apAccounts[accIndex].lastUploadDate = todayDate;
                            apAccounts[accIndex].uploadedTodayCount = Math.max(
                                apAccounts[accIndex].uploadedTodayCount || 0,
                                apAccounts[accIndex].dailyLimit || 0
                            );
                            await setStorage({ [platformKey]: apAccounts });
                        }

                        chrome.runtime.sendMessage({
                            action: 'ap_update',
                            log: `Ôøö Ïº┘äÏ¡Ï│ÏºÏ¿ ${alias} Ï¿┘äÏ║ Ïº┘äÏ¡Ï» Ïº┘ä┘è┘ê┘à┘è Ï╣┘ä┘ë TeePublic. Ï│┘èÏ¬┘à Ï¬Ï¼Ïº┘êÏ▓┘ç Ï¡Ï¬┘ë Ïº┘äÏ║Ï» ÔÇö ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® Ï¿┘é┘èÏ® Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬.`,
                            type: 'warning'
                        });
                    }

                    chrome.runtime.sendMessage({
                        action: 'ap_update',
                        log: authFailure
                            ? `ÔÅ¡ ┘üÏ┤┘ä Ï¬Ï│Ï¼┘è┘ä Ïº┘äÏ»Ï«┘ê┘ä ┘ä┘äÏ¡Ï│ÏºÏ¿ ${alias} ÔÇö Ï¬Ï«ÏÀ┘è Ïº┘äÏ¡Ï│ÏºÏ¿ ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ¿┘é┘èÏ®`
                            : `ÔÅ¡ ┘üÏ┤┘ä Ï»┘üÏ╣Ï® ${chunkIndex + 1} ┘ä┘äÏ¡Ï│ÏºÏ¿ ${alias} | ${errorMsg} ÔÇö Ï¬Ï«ÏÀ┘è ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï®`,
                        toast: authFailure
                            ? 'ÔÜá´©Å TeePublic Ï║┘èÏ▒ ┘àÏ│Ï¼┘æ┘ä ÔÇö Ï¬┘à Ï¬Ï«ÏÀ┘è Ïº┘äÏ¡Ï│ÏºÏ¿ ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ¿┘é┘èÏ®'
                            : (ghostUnreachable ? 'ÔÜá´©Å Ghost Server ┘ä┘à ┘èÏ│Ï¬Ï¼Ï¿ ÔÇö ┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ Ïº┘äÏ¬Ïº┘ä┘èÏ® ÏÑ┘å Ïú┘à┘â┘å' : undefined),
                        type: 'error'
                    });
                    
                    chunkDesignStates.forEach((item) => {
                        item.status = 'failed';
                        apMonitorTrackDesign({
                            queueItemId: item.queueItemId,
                            accountId,
                            title: item.title,
                            status: 'skipped_failed',
                            reason: errorMsg,
                            phase: 'chunk'
                        });
                    });
                    apMonitorAppend(
                        `Ï»┘üÏ╣Ï® ┘üÏºÏ┤┘äÏ® Ï½┘à Ï¬Ï«ÏÀ┘è | ${alias} | chunk=${chunkIndex + 1} | ${errorMsg}`,
                        'monitor'
                    );
                    await persistApUploadMonitorRun(apUploadMonitorRun);
                    // Fail-soft: do NOT abort remaining accounts. For auth/daily-limit/ghost-down,
                    // skip remaining chunks on THIS account only; otherwise continue next chunks.
                    const stopRemainingChunksForAccount = authFailure || hitDailyLimit || ghostUnreachable;
                    if (stopRemainingChunksForAccount) {
                        accountFailed = true;
                        if (accountState) accountState.status = 'failed';
                        await publishApQueueState({
                            perAccount: perAccountState,
                            perDesign: perDesignState,
                            failedAccounts: perAccountState.filter((item) => item.status === 'failed').length,
                            monitorCounts: apUploadMonitorRun?.counts || null
                        });
                        break;
                    }
                    accountFailed = uploadedForAccount <= 0;
                    if (accountState && accountFailed) accountState.status = 'failed';
                    await publishApQueueState({
                        perAccount: perAccountState,
                        perDesign: perDesignState,
                        failedAccounts: perAccountState.filter((item) => item.status === 'failed').length,
                        monitorCounts: apUploadMonitorRun?.counts || null
                    });
                    // continue to next chunk / designs
                }

                if (chunkIndex < uploadChunks.length - 1) {
                    chrome.runtime.sendMessage({
                        action: 'ap_update',
                        log: `ÔÅ│ ${alias} | Ïº┘åÏ¬Ï©ÏºÏ▒ ┘éÏÁ┘èÏ▒ ┘éÏ¿┘ä Ïº┘äÏ»┘üÏ╣Ï® Ïº┘äÏ¬Ïº┘ä┘èÏ® ┘äÏÂ┘àÏº┘å ÏÑÏ║┘äÏº┘é Ïº┘äÏ¼┘äÏ│Ï® Ïº┘äÏ│ÏºÏ¿┘éÏ®...`,
                        type: 'info'
                    });
                    await delay(12000);
                }
            }

            const durationSeconds = Math.round((Date.now() - startTime) / 1000);
            const accIndex = apAccounts.findIndex(a => a.id === acc.id || a.email === acc.email);
            if (accIndex !== -1) {
                if (!apAccounts[accIndex].stats) apAccounts[accIndex].stats = { uploaded: 0, time: 0 };
                apAccounts[accIndex].stats.time += durationSeconds;
                await setStorage({ [platformKey]: apAccounts });
            }

            if (!accountFailed) {
                if (accountState) {
                    accountState.status = 'uploaded';
                    accountState.finishedAt = new Date().toISOString();
                }
                await publishApQueueState({
                    perAccount: perAccountState,
                    completedAccountCount: perAccountState.filter((item) => item.status === 'uploaded').length,
                    monitorCounts: apUploadMonitorRun?.counts || null
                });
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `Ô£à Ïº┘âÏ¬┘à┘ä Ïº┘äÏ¡Ï│ÏºÏ¿: ${alias} | Ïº┘ä┘ê┘éÏ¬: ${durationSeconds}Ï½ | Ï¬┘à Ï▒┘üÏ╣: ${uploadedForAccount}`,
                    type: 'success'
                });
            } else if (uploadedForAccount > 0 && accountState) {
                // Partial success ÔÇö keep fail-soft recovery for remaining failed designs.
                accountState.status = 'uploaded';
                accountState.finishedAt = new Date().toISOString();
                accountState.partialFailures = true;
                await publishApQueueState({
                    perAccount: perAccountState,
                    completedAccountCount: perAccountState.filter((item) => item.status === 'uploaded').length,
                    monitorCounts: apUploadMonitorRun?.counts || null
                });
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    log: `ÔÜá´©Å Ïº┘âÏ¬┘à┘ä Ïº┘äÏ¡Ï│ÏºÏ¿ Ï¼Ï▓Ïª┘èÏº┘ï: ${alias} | Ï▒┘Å┘üÏ╣ ${uploadedForAccount} ┘àÏ╣ Ï¬Ï«ÏÀ┘è ┘üÏºÏ┤┘ä┘è┘å ÔÇö ┘àÏ¬ÏºÏ¿Ï╣Ï®`,
                    type: 'warning'
                });
            }
        } catch (e) {
            let errorMsg = e.message;
            let failureToast = '';
            if (e.name === 'AbortError') {
                errorMsg = 'Ïº┘åÏ¬┘ç┘ë ┘ê┘éÏ¬ Ïº┘äÏºÏ¬ÏÁÏº┘ä (Ïº┘äÏ│┘èÏ▒┘üÏ▒ Ïº┘ä┘àÏ¡┘ä┘è ┘ä┘à ┘èÏ│Ï¬Ï¼Ï¿ Ïú┘ê Ï¬Ï¼┘àÏ»). Ï¬┘à Ï¬Ï«ÏÀ┘è Ïº┘äÏ¡Ï│ÏºÏ¿ ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ¿┘é┘èÏ®.';
                failureToast = 'ÔÜá´©Å Ghost Server ┘ä┘à ┘èÏ│Ï¬Ï¼Ï¿ ÔÇö ┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ¡Ï│ÏºÏ¿ÏºÏ¬ Ïº┘äÏ¬Ïº┘ä┘èÏ®';
            } else if (/failed to fetch|networkerror|econnrefused|fetch/i.test(String(errorMsg || ''))) {
                failureToast = 'ÔÜá´©Å Ghost Server ┘ä┘à ┘èÏ│Ï¬Ï¼Ï¿ ÔÇö Ï¬Ï¡┘é┘é ┘à┘å Ïº┘ä┘à┘å┘üÏ░ 3019';
            }
            chrome.runtime.sendMessage({
                action: 'ap_update',
                log: `ÔÅ¡ Ï¬Ï«ÏÀ┘è Ï¡Ï│ÏºÏ¿ ┘ê┘àÏ¬ÏºÏ¿Ï╣Ï® Ïº┘äÏ¿┘é┘èÏ®: ${alias} | ${errorMsg}`,
                toast: failureToast || undefined,
                type: 'error'
            });
            apMonitorAppend(`Ï¬Ï«ÏÀ┘è Ï¡Ï│ÏºÏ¿ Ï½┘à ┘àÏ¬ÏºÏ¿Ï╣Ï® | ${alias} | ${errorMsg}`, 'monitor');
            if (accountState) {
                accountState.status = 'failed';
                accountState.finishedAt = new Date().toISOString();
            }
            const claimedForAccount = perDesignState.filter((item) =>
                item.accountId === accountId && (item.status === 'waiting' || item.status === 'uploading' || item.status === 'ready')
            );
            claimedForAccount.forEach((item) => {
                item.status = 'failed';
                apMonitorTrackDesign({
                    queueItemId: item.queueItemId,
                    accountId,
                    title: item.title,
                    status: 'skipped_failed',
                    reason: errorMsg,
                    phase: 'account_catch'
                });
            });
            await persistApUploadMonitorRun(apUploadMonitorRun);
            await publishApQueueState({
                perAccount: perAccountState,
                perDesign: perDesignState,
                failedAccounts: perAccountState.filter((item) => item.status === 'failed').length,
                monitorCounts: apUploadMonitorRun?.counts || null
            });
            // Intentionally no rethrow ÔÇö account loop continues to next account.
        }

        // Delay with Countdown ÔÇö advance to next account after current finishes or fails
        if (i < totalAccounts - 1 && !apStopped) {
            const nextAcc = accounts[i + 1];
            const nextAlias = nextAcc?.displayName || nextAcc?.email?.split?.('@')?.[0] || nextAcc?.email || 'Ïº┘äÏ¬Ïº┘ä┘è';
            chrome.runtime.sendMessage({
                action: 'ap_update',
                log: `ÔÅ¡´©Å Ïº┘äÏº┘åÏ¬┘éÏº┘ä ┘ä┘äÏ¡Ï│ÏºÏ¿ Ïº┘äÏ¬Ïº┘ä┘è: ${nextAlias}`,
                type: 'info'
            });
            let remaining = delaySec;
            while (remaining > 0 && !apStopped) {
                chrome.runtime.sendMessage({
                    action: 'ap_update',
                    countdown: remaining,
                    log: `ÔÅ▒´©Å Ïº┘åÏ¬Ï©ÏºÏ▒ ${remaining} Ï½Ïº┘å┘èÏ® ┘éÏ¿┘ä Ïº┘äÏ¡Ï│ÏºÏ¿ Ïº┘äÏ¬Ïº┘ä┘è...`
                });
                await delay(1000);
                remaining--;
            }
            chrome.runtime.sendMessage({ action: 'ap_update', countdown: 0 });
        }
    }

    if (apStopped) {
        perAccountState
            .filter((item) => item.status === 'waiting' || item.status === 'uploading')
            .forEach((item) => { item.status = 'stopped'; item.finishedAt = new Date().toISOString(); });
        perDesignState
            .filter((item) => item.status === 'waiting' || item.status === 'ready' || item.status === 'uploading')
            .forEach((item) => { item.status = 'stopped'; });
    }
    const finalState = await publishApQueueState({
        isRunning: false,
        stopped: !!apStopped,
        stoppedAt: apStopped ? new Date().toISOString() : null,
        finishedAt: new Date().toISOString(),
        perAccount: perAccountState,
        perDesign: perDesignState,
        completedUploads: perDesignState.filter((item) => item.status === 'uploaded' || item.status === 'published').length,
        completedAccountCount: perAccountState.filter((item) => item.status === 'uploaded').length,
        failedAccounts: perAccountState.filter((item) => item.status === 'failed').length,
        monitorCounts: apUploadMonitorRun?.counts || null,
        ...clearApCurrentAccountFields()
    });
    if (apUploadMonitorRun && typeof NhpApUploadMonitor !== 'undefined') {
        try {
            await apMonitorMaybeAiNote(apUploadMonitorRun);
        } catch (_) { /* never block finish */ }
        NhpApUploadMonitor.finalizeRun(
            apUploadMonitorRun,
            apStopped ? 'Ï¬┘à ÏÑ┘è┘éÏº┘ü Ïº┘äÏ¬Ï┤Ï║┘è┘ä ┘èÏ»┘ê┘èÏº┘ï.' : 'Ïº┘âÏ¬┘à┘äÏ¬ Ïº┘äÏ»┘üÏ╣Ï® ┘àÏ╣ ┘êÏÂÏ╣ Ïº┘äÏºÏ│Ï¬┘àÏ▒ÏºÏ▒ Ï╣┘åÏ» Ïº┘ä┘üÏ┤┘ä.'
        );
        await persistApUploadMonitorRun(apUploadMonitorRun);
    }
    const hasFailedDesigns = perDesignState.some((item) => normalizeApQueueStatus(item?.status) === 'failed');
    const hasFailedAccounts = perAccountState.some((item) => normalizeApQueueStatus(item?.status) === 'failed');
    const monitorCounts = apUploadMonitorRun?.counts || {};
    const uploadSucceeded = !apStopped
        && finalState.overallStatus === 'uploaded'
        && !hasFailedDesigns
        && !hasFailedAccounts;
    const zeroUploads = (finalState.completedUploads || 0) <= 0 && !apStopped;
    if (zeroUploads) {
        logApProcessAbort('completed_with_zero_uploads', {
            path: 'loop_finished_no_uploads',
            accountEmails: accounts.map((a) => a?.email),
            perAccount: perAccountState.map((item) => ({ email: item.accountEmail, status: item.status, planned: item.plannedCount }))
        });
        await publishApQueueState({ overallStatus: 'failed', monitorCounts });
    } else {
        console.log('[AP] startAPProcess complete:', {
            completedUploads: finalState.completedUploads,
            monitorCounts,
            accounts: accounts.map((a) => a?.email).filter(Boolean)
        });
    }
    const failedCount = Number(monitorCounts.skipped_failed) || perDesignState.filter((item) => normalizeApQueueStatus(item?.status) === 'failed').length;
    const okCount = Number(monitorCounts.ok) || (finalState.completedUploads || 0);
    const correctedCount = Number(monitorCounts.corrected) || 0;
    chrome.runtime.sendMessage({
        action: 'ap_update',
        done: true,
        percent: 100,
        success: zeroUploads ? false : uploadSucceeded,
        zeroUploads: !!zeroUploads,
        monitorCounts,
        toast: zeroUploads
            ? 'ÔØî ┘ä┘à ┘è┘ÅÏ▒┘üÏ╣ Ïú┘è Ï¬ÏÁ┘à┘è┘à ÔÇö Ïº┘äÏÁ┘êÏ▒ Ï║┘èÏ▒ ┘àÏ¬┘ê┘üÏ▒Ï®. Ï┤Ï║┘æ┘ä Ghost Server ┘êÏ¬Ïú┘âÏ» Ïú┘å Ïº┘äÏ¬ÏÁÏº┘à┘è┘à ┘ü┘è Ïº┘ä┘à┘âÏ¬Ï¿Ï®Ïî Ïú┘ê ÏúÏ╣Ï» ÏÑÏ▒Ï│Ïº┘ä┘çÏº ┘à┘å TeeMaster Ïº┘ä┘àÏ¡Ï▒┘æÏ▒'
            : (failedCount > 0
                ? `­ƒôè Ïº┘åÏ¬┘ç┘ë Ïº┘äÏ▒┘üÏ╣ | ┘åÏ¼ÏºÏ¡ ${okCount} | ┘àÏ¬Ï«ÏÀ┘ë ${failedCount} | ┘àÏÁÏ¡Ï¡ ${correctedCount} ÔÇö ÏºÏ│Ï¬Ï«Ï»┘à ┬½ÏºÏ│Ï¬Ï»Ï▒Ïº┘â Ïº┘äÏ▒┘üÏ╣ Ïº┘ä┘üÏºÏ┤┘ä┬╗`
                : undefined),
        type: zeroUploads ? 'error' : (failedCount > 0 ? 'warning' : 'success'),
        ...(zeroUploads ? { type: 'error' } : {})
    });
    stopHeartbeat();
}

// --- GEMINI & TRENDS & USPTO & TEEPUBLIC (Core Functions) ---
//  GEMINI & TRENDS & USPTO & TEEPUBLIC (Core Functions)

function isGeminiRateLimitResponse(data, status) {
    const message = String(data?.error?.message || '').toLowerCase();
    return status === 429
        || message.includes('resource exhausted')
        || message.includes('quota')
        || message.includes('rate limit')
        || message.includes('too many requests');
}

async function postGeminiGenerateContent(body, apiKey, attempt = 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const inlinePart = body?.contents?.[0]?.parts?.find((part) => part?.inlineData);
    const targetHost = (() => {
        try { return new URL(url).host; } catch (_) { return 'invalid-url'; }
    })();
    console.log('[NHP-IMG] sending', {
        host: targetHost,
        hasInlineData: !!inlinePart,
        mimeType: inlinePart?.inlineData?.mimeType || null,
        base64Length: inlinePart?.inlineData?.data?.length || 0,
        hasKey: !!apiKey
    });
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const rawText = await res.text();
    let data = null;
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
        data = { error: { message: rawText || `HTTP ${res.status}` } };
    }
    console.log('[NHP-IMG] response', res.status);
    if (!res.ok) {
        console.warn('[NHP-IMG] error body', rawText);
    }
    if (isGeminiRateLimitResponse(data, res.status) && attempt < 2) {
        await delay(8000);
        return postGeminiGenerateContent(body, apiKey, attempt + 1);
    }
    return { res, data };
}

async function callGeminiArtisan(prompt, apiKey) {
    try {
        const { data } = await postGeminiGenerateContent({ contents: [{ parts: [{ text: prompt }] }] }, apiKey);
        if (data.error) return { error: data.error.message };
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return { result: aiText, success: true };
    } catch (e) {
        return { error: e.message };
    }
}
async function callGeminiWithImage(prompt, base64, mimeType, apiKey) {
    try {
        const { data } = await postGeminiGenerateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64 } }] }]
        }, apiKey);
        if (data.error) return { error: data.error.message };
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiText) return { error: 'Empty response from AI' };
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { result: aiText };
    } catch (e) {
        return { error: e.message };
    }
}

function resolveSeoInlineImageParts(base64, mimeType) {
    const input = String(base64 || '');
    const hasPrefix = input.startsWith('data:');
    const resolvedMimeType = hasPrefix
        ? (input.match(/^data:([^;,]+)[;,]/i)?.[1] || mimeType || 'image/png')
        : (mimeType || 'image/png');
    const cleanBase64 = hasPrefix ? (input.split(',')[1] || '') : input.replace(/\s/g, '');
    return { cleanBase64, resolvedMimeType };
}

function parseOpenAiCompatibleSeoPayload(data, _debugMeta) {
    // ÔöÇÔöÇ Step 1: Extract text content from all known OpenAI-compatible shapes ÔöÇÔöÇÔöÇÔöÇ
    let aiText = null;

    // Priority 1: Standard OpenAI choices[0].message.content
    const choice0 = data?.choices?.[0];
    if (choice0) {
        const msgContent = choice0.message?.content;
        if (msgContent != null) {
            // content can be an array of parts (vision responses)
            if (Array.isArray(msgContent)) {
                aiText = msgContent
                    .map(p => (typeof p === 'string' ? p : (p?.text || p?.content || '')))
                    .filter(Boolean)
                    .join('');
            } else if (typeof msgContent === 'object') {
                aiText = msgContent.text || msgContent.content || msgContent.result || JSON.stringify(msgContent);
            } else {
                aiText = String(msgContent);
            }
        }

        // Priority 2: choices[0].text (legacy/non-chat completions)
        if (!aiText) {
            const legacyText = choice0.text;
            if (legacyText != null) aiText = String(legacyText);
        }

        // Priority 3: choices[0].delta.content (streaming chunk shape)
        if (!aiText) {
            const deltaContent = choice0.delta?.content;
            if (deltaContent != null) aiText = String(deltaContent);
        }
    }

    // Priority 4: Top-level output_text (some proxy wrappers)
    if (!aiText && data?.output_text != null) aiText = String(data.output_text);

    // Priority 5: Top-level content
    if (!aiText && data?.content != null) {
        const c = data.content;
        aiText = Array.isArray(c)
            ? c.map(p => (typeof p === 'string' ? p : (p?.text || p?.content || ''))).filter(Boolean).join('')
            : (typeof c === 'object' ? (c.text || c.result || JSON.stringify(c)) : String(c));
    }

    // Priority 6: Top-level text
    if (!aiText && data?.text != null) aiText = String(data.text);

    // Priority 7: Top-level result (used by legacy CLI Proxy wrappers)
    if (!aiText && data?.result != null) aiText = String(data.result);

    // Priority 8: Top-level response
    if (!aiText && data?.response != null) aiText = String(data.response);

    // Priority 9: Top-level message (some proxy shapes)
    if (!aiText && data?.message != null) {
        const m = data.message;
        aiText = typeof m === 'object' ? (m.content || m.text || m.result || JSON.stringify(m)) : String(m);
    }

    // ÔöÇÔöÇ Step 2: Debug log ÔÇö safe, no keys/prompts ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    const topLevelKeys = data && typeof data === 'object' ? Object.keys(data) : [];
    const choice0Keys  = choice0 && typeof choice0 === 'object' ? Object.keys(choice0) : [];
    const contentLen   = aiText ? aiText.length : 0;
    console.log('[BACKGROUND-API-DEBUG] parseOpenAiCompatibleSeoPayload:', {
        hasChoices: !!data?.choices?.length,
        topLevelKeys,
        choice0Keys,
        extractedContentLength: contentLen,
        model: _debugMeta?.model || 'unknown',
        status: _debugMeta?.status || 'unknown'
    });

    // ÔöÇÔöÇ Step 3: If still no content, return diagnostic error ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    if (!aiText) {
        const bodyPreview = JSON.stringify(data || {}).slice(0, 500);
        return {
            error: `Empty response from AI ÔÇö topLevelKeys: [${topLevelKeys.join(', ')}]` +
                   (choice0Keys.length ? `; choices[0] keys: [${choice0Keys.join(', ')}]` : '') +
                   `; body: ${bodyPreview}`
        };
    }

    // ÔöÇÔöÇ Step 4: Try to parse a JSON object from the text ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (_) { /* fall through to plain-text path */ }
    }

    // ÔöÇÔöÇ Step 5: Return raw text for marker-based parser in seo.js ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    return { result: aiText };
}

async function invokeCliProxyRouting(prompt, base64, mimeType, apiKey, options, invokeOnce) {
    const explicitBaseUrl = String(options.baseUrl || '').trim();
    const useRouting = options.proxyFailover !== false
        && !options._failoverAttempt
        && !explicitBaseUrl
        && typeof NhpProxyEndpoints !== 'undefined';
    if (!useRouting) {
        return invokeOnce(apiKey, options);
    }
    const routingFn = NhpProxyEndpoints.callWithProxyRouting || NhpProxyEndpoints.callWithProxyFailover;
    return routingFn(async (endpoint) => {
        const endpointKey = String(endpoint.apiKey || apiKey || '').trim();
        return invokeOnce(endpointKey, {
            ...options,
            baseUrl: endpoint.baseUrl,
            useEndpointBaseUrl: true,
            proxyFailover: false,
            _failoverAttempt: true
        });
    }, (result) => result && !result.error, {
        routingMode: options.proxyRoutingMode,
        batchIndex: options.batchIndex,
        endpointId: options.endpointId
    });
}

async function callOpenAiCompatibleSeo(prompt, base64, mimeType, apiKey, options = {}) {
    return invokeCliProxyRouting(prompt, base64, mimeType, apiKey, options, (nextKey, nextOptions) =>
        callOpenAiCompatibleSeoDirect(prompt, base64, mimeType, nextKey, nextOptions)
    );
}

async function callOpenAiCompatibleSeoDirect(prompt, base64, mimeType, apiKey, options = {}) {
    const baseUrl = options.useEndpointBaseUrl && typeof NhpProxyEndpoints !== 'undefined'
        ? NhpProxyEndpoints.normalizeBaseUrl(options.baseUrl || NhpProxyEndpoints.CLOUD_BASE_URL)
        : normalizeCliProxyBaseUrl(options.baseUrl || 'https://api.openai.com/v1');
    const model = String(options.model || 'gpt-4o-mini');
    const source = String(options.source || 'gpt-api');
    const key = String(apiKey || '').trim();

    const endpoint = `${baseUrl}/chat/completions`;
    const requestHeaders = {
        'Content-Type': 'application/json'
    };
    if (key) {
        requestHeaders['Authorization'] = `Bearer ${key}`;
    }

    const loggedHeaders = { ...requestHeaders };
    if (loggedHeaders['Authorization']) {
        loggedHeaders['Authorization'] = 'Bearer [REDACTED]';
    }

    console.log(`[BACKGROUND-API-DEBUG] Outgoing request: POST ${endpoint}`, {
        method: 'POST',
        headers: loggedHeaders,
        hasAuthHeader: !!key,
        keyLength: key.length,
        keyType: typeof apiKey,
        source
    });

    if (!key) {
        console.error('[BACKGROUND-API-DEBUG] Error: API key is missing, aborting fetch.');
        return { error: 'API key is missing.' };
    }

    const { cleanBase64, resolvedMimeType } = resolveSeoInlineImageParts(base64, mimeType);
    const userContent = cleanBase64
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${resolvedMimeType};base64,${cleanBase64}` } }
        ]
        : prompt;

    const timeoutMs = Math.max(0, Number(options.fetchTimeoutMs) || 0);
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: userContent }],
                temperature: 0.35
            }),
            signal: controller?.signal
        });
        const rawText = await res.text();
        console.log(`[BACKGROUND-API-DEBUG] Response status: ${res.status} for POST ${endpoint}. Body sample:`, rawText.slice(0, 500));

        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (_) {
            data = { error: { message: rawText || `HTTP ${res.status}` } };
        }
        if (!res.ok) {
            const message = data?.error?.message || rawText || `HTTP ${res.status}`;
            return { error: message, httpStatus: res.status };
        }
        const parsed = parseOpenAiCompatibleSeoPayload(data, { model, status: res.status });
        if (parsed?.error) return parsed;
        if (parsed && typeof parsed === 'object' && !parsed.source) parsed.source = source;
        return parsed;
    } catch (e) {
        const msg = String(e?.message || 'OpenAI-compatible request failed.');
        console.error(`[BACKGROUND-API-DEBUG] Request failed for POST ${endpoint}: ${msg}`);
        if (e?.name === 'AbortError') {
            return { error: 'Request timed out.' };
        }
        if (/failed to fetch|networkerror|fetch failed|ECONNREFUSED/i.test(msg)) {
            return { error: `CLI Proxy Ï║┘èÏ▒ ┘àÏ¬ÏºÏ¡. Ï┤Ï║┘æ┘ä CLI Proxy Ï╣┘ä┘ë ${nhpUrl(8317)}` };
        }
        return { error: msg };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function callOpenAiCompatibleSeoWithPersistentRetry(prompt, base64, mimeType, apiKey, options = {}) {
    return invokeCliProxyRouting(prompt, base64, mimeType, apiKey, options, (nextKey, nextOptions) =>
        callOpenAiCompatibleSeoWithPersistentRetryDirect(prompt, base64, mimeType, nextKey, nextOptions)
    );
}

async function callOpenAiCompatibleSeoWithPersistentRetryDirect(prompt, base64, mimeType, apiKey, options = {}) {
    const baseUrl = options.useEndpointBaseUrl && typeof NhpProxyEndpoints !== 'undefined'
        ? NhpProxyEndpoints.normalizeBaseUrl(options.baseUrl || NhpProxyEndpoints.CLOUD_BASE_URL)
        : normalizeCliProxyBaseUrl(options.baseUrl || CLI_PROXY_API_BASE_URL);
    const persistent = options.persistentRetry !== false && isCliProxyHostBaseUrl(baseUrl);
    if (!persistent) {
        return callOpenAiCompatibleSeo(prompt, base64, mimeType, apiKey, options);
    }

    const contextLabel = String(options.retryContext || 'cli-proxy');
    const maxAttempts = Math.max(0, Number(options.maxAttempts) || 0);
    if (_cliProxy?.runPersistentRetry) {
        return _cliProxy.runPersistentRetry({
            contextLabel,
            maxAttempts,
            runOnce: () => callOpenAiCompatibleSeo(prompt, base64, mimeType, apiKey, {
                ...options,
                baseUrl,
                fetchTimeoutMs: options.fetchTimeoutMs || CLI_PROXY_REQUEST_TIMEOUT_MS
            })
        });
    }

    return callOpenAiCompatibleSeo(prompt, base64, mimeType, apiKey, { ...options, baseUrl });
}

async function callGptSeo(prompt, base64, mimeType, apiKey) {
    return callOpenAiCompatibleSeo(prompt, base64, mimeType, apiKey, {
        baseUrl: CLI_PROXY_API_BASE_URL,
        model: resolveCliProxyVisionModel(CLI_PROXY_API_DEFAULT_MODEL),
        source: 'cliproxy-api'
    });
}

async function callCursorSeo(prompt, base64, mimeType, apiKey) {
    return callOpenAiCompatibleSeo(prompt, base64, mimeType, apiKey, {
        baseUrl: 'https://api.cursor.com/v1',
        model: 'gpt-4o-mini',
        source: 'cursor-api'
    });
}

const OFFICIAL_TREND_PAGE_START = 'The directory below has been automatically generated';
const OFFICIAL_TREND_PAGE_END = 'Subscribe to Our Newsletter';
const OFFICIAL_TREND_NOISE_TERMS = new Set([
    'design', 'designs', 'for men', 'for women', 'men', 'women', 'kids', 'system', 'systems',
    't shirt', 't shirts', 'tee', 'tees', 'shirt', 'shirts', 'gift', 'gifts', 'shop',
    'newest', 'popular', 'staff picks', 'tag directory', 'trending tags'
]);
const OFFICIAL_TREND_NOISE_REGEX = [
    /\b(t[\s-]?shirt|tee|hoodie|sweatshirt|tank top|sticker|poster|mug)\b/i,
    /\b(for men|for women|for kids)\b/i,
    /^(new|popular|trending|best|shop)$/i
];

function normalizeOfficialTrendTitle(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/^#+/, '')
        .replace(/[|ÔÇó┬À]+/g, ' ')
        .replace(/\s+t-?shirt$/i, '')
        .trim();
}

function isOfficialTrendTitleValid(text) {
    const t = normalizeOfficialTrendTitle(text);
    const key = t.toLowerCase();
    if (!t || t.length < 3 || t.length > 60) return false;
    if (OFFICIAL_TREND_NOISE_TERMS.has(key)) return false;
    if (OFFICIAL_TREND_NOISE_REGEX.some((pattern) => pattern.test(t))) return false;
    if (/^\d+$/.test(t)) return false;
    if (!/[a-z]/i.test(t)) return false;
    if (/^(for|and|the|with|from|shop)\b/i.test(t) && t.split(/\s+/).length <= 3) return false;
    return true;
}

function extractOfficialTrendTagsFromTrendingTagsHtml(htmlText) {
    if (!htmlText || typeof htmlText !== 'string') return [];
    const extracted = [];
    const seen = new Set();

    const pushIfValid = (raw) => {
        const text = normalizeOfficialTrendTitle(raw);
        if (!isOfficialTrendTitleValid(text)) return;
        const key = normalizeNicheKey(text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        extracted.push(text);
    };

    try {
        const doc = typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(htmlText, 'text/html') : null;
        if (doc?.body) {
            const bodyText = doc.body.innerText || '';
            const startIndex = bodyText.indexOf(OFFICIAL_TREND_PAGE_START);
            const endIndex = bodyText.indexOf(OFFICIAL_TREND_PAGE_END);
            let elements = doc.querySelectorAll('.trending-tag .link_content, .trending-tag a, .trending-tags a, a[href*="/trending-tags"]');
            if (elements.length === 0) elements = doc.querySelectorAll('a[href*="/t-shirt/"]');
            elements.forEach((el) => {
                const text = normalizeOfficialTrendTitle(el.innerText || el.textContent || '');
                if (!text || text.length < 2) return;
                const pos = startIndex !== -1 ? bodyText.indexOf(text, startIndex) : 0;
                if (pos !== -1 && (endIndex === -1 || pos < endIndex)) pushIfValid(text);
            });
            if (extracted.length >= 5) return extracted;
        }
    } catch (_e) { /* fall through to regex */ }

    const startIdx = htmlText.indexOf(OFFICIAL_TREND_PAGE_START);
    const endIdx = htmlText.indexOf(OFFICIAL_TREND_PAGE_END);
    const slice = startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
        ? htmlText.slice(startIdx, endIdx)
        : htmlText;
    const tagRegex = /<a[^>]*href="\/t-shirt\/([^"]+)"[^>]*>([^<]+)<\/a>|class="trending-tag"[^>]*>([^<]+)<\/a>|alt="([^"]+) T-Shirt"/gi;
    let match;
    while ((match = tagRegex.exec(slice)) !== null) {
        const raw = (match[2] || match[3] || match[4] || match[1] || '').trim()
            .replace(/ T-Shirt$/i, '')
            .replace(/-/g, ' ')
            .replace(/\?(.*)/, '');
        pushIfValid(raw);
    }

    return extracted;
}

function looksLikeCloudflareChallengeHtml(html) {
    const text = String(html || '').toLowerCase();
    return text.includes('just a moment') ||
        text.includes('cf_chl_opt') ||
        text.includes('challenge-platform') ||
        text.includes('enable javascript and cookies to continue') ||
        text.includes('cf-browser-verification');
}

async function fetchTrendingTagsHtmlFromNetwork(maxAttempts = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutMs = 18000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const r = await fetch('https://www.teepublic.com/trending-tags', {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal,
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            clearTimeout(timeoutId);
            if (!r.ok) throw new Error(`Trend fetch failed with HTTP ${r.status}`);
            const html = await r.text();
            if (looksLikeCloudflareChallengeHtml(html)) {
                throw new Error('TeePublic blocked by Cloudflare challenge');
            }
            return html;
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            if (attempt < maxAttempts) await delay(700 * attempt);
        }
    }
    if (lastError?.name === 'AbortError') {
        throw new Error('Ïº┘åÏ¬┘çÏ¬ ┘à┘ç┘äÏ® Ï¼┘äÏ¿ Ïº┘äÏ¬Ï▒┘åÏ» ┘à┘å TeePublic');
    }
    throw lastError || new Error('Trend fetch failed');
}

async function fetchOfficialTrendTitlesBounded(maxAttempts = 3) {
    const html = await fetchTrendingTagsHtmlFromNetwork(maxAttempts);
    const titles = extractOfficialTrendTagsFromTrendingTagsHtml(html);
    if (!titles.length) {
        throw new Error('TeePublic trend page returned no extractable tags');
    }
    return titles;
}

function chromeLocalGet(keys) {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(keys, (result) => resolve(result || {}));
        } catch (_) {
            resolve({});
        }
    });
}

function normalizeOracleBaseUrl(value) {
    return String(value || '')
        .trim()
        .replace(/\/+(health|api\/generic-task(?:\/.*)?|api\/tasks(?:\/.*)?)$/i, '')
        .replace(/\/+$/, '');
}

function getOracleBaseUrlCandidates(baseUrl) {
    const cleanBaseUrl = normalizeOracleBaseUrl(baseUrl);
    const localOracleTunnel = 'http://127.0.0.1:3041';
    const candidates = [];
    if (/^https?:\/\/(?:127\.0\.0\.1|localhost):(3031|3039|3041)$/i.test(cleanBaseUrl)) {
        candidates.push(localOracleTunnel);
    } else if (cleanBaseUrl) {
        candidates.push(cleanBaseUrl);
    }
    if (!candidates.includes('https://oracle-api.emailcore.app')) {
        candidates.push('https://oracle-api.emailcore.app');
    }
    return [...new Set(candidates.filter(Boolean))];
}

function buildTrendHtmlForLegacyParser(trends) {
    const safeTrends = (Array.isArray(trends) ? trends : [])
        .map((item) => String(item?.name || item?.title || item?.keyword || item || '').trim())
        .filter(Boolean);
    const links = safeTrends.map((trend) => {
        const slug = encodeURIComponent(trend.toLowerCase().replace(/\s+/g, '-'));
        return `<a class="trending-tag" href="/t-shirts/${slug}"><span class="link_content">${trend}</span></a>`;
    }).join('\n');
    return `
        <html>
            <body>
                The directory below has been automatically generated
                <section class="trending-tags">
                    ${links}
                </section>
                Subscribe to Our Newsletter
            </body>
        </html>
    `;
}

function extractOracleTaskResultData(task) {
    const result = task?.result || {};
    const candidates = [
        result?.data,
        result?.payload,
        result?.response?.data,
        result?.response,
        result?.result?.data,
        result?.result,
        result
    ];
    return candidates.find((candidate) => candidate && typeof candidate === 'object') || result;
}

function extractOracleTrendRecords(data) {
    const candidates = [
        data?.trends,
        data?.items,
        data?.results,
        data?.result?.trends,
        data?.result?.items,
        data?.result?.results,
        data?.result?.data?.trends,
        data?.result?.payload?.trends,
        data?.result?.response?.trends,
        data?.result?.response?.data?.trends,
        data?.data?.trends,
        data?.payload?.trends,
        data?.response?.trends,
        data?.response?.data?.trends,
        data?.completed?.result?.data?.trends
    ];
    const source = candidates.find(Array.isArray) || [];
    return source
        .map((item) => {
            const title = String(item?.name || item?.title || item?.keyword || item?.text || item || '').trim();
            return title ? { ...(typeof item === 'object' && item ? item : {}), title } : null;
        })
        .filter(Boolean);
}

async function fetchOracleJson(url, token, options = {}, timeoutMs = 10000) {
    const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    return fetchJsonWithTimeout(url, { ...options, headers }, timeoutMs);
}

const NHP_ORACLE_DESIGN_JOB_PREFIX = 'nhpOracleDesignJob:';

function oracleDesignJobStorageKey(jobId) {
    return `${NHP_ORACLE_DESIGN_JOB_PREFIX}${String(jobId || '').trim()}`;
}

async function readOracleDesignJobState(jobId) {
    const key = oracleDesignJobStorageKey(jobId);
    const stored = await chromeLocalGet([key]);
    return stored[key] || null;
}

async function writeOracleDesignJobState(jobId, patch = {}) {
    const key = oracleDesignJobStorageKey(jobId);
    const prev = (await readOracleDesignJobState(jobId)) || {};
    const next = {
        ...prev,
        ...patch,
        oracleJobId: String(jobId || prev.oracleJobId || '').trim(),
        updatedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [key]: next });
    return next;
}

async function oracleDesignDataUrlToBlob(dataUrl) {
    const text = String(dataUrl || '').trim();
    if (!text.startsWith('data:')) return null;
    const res = await fetch(text);
    return res.blob();
}

async function startOracleDesignGeneration(req = {}) {
    const requestId = String(req.requestId || '').trim()
        || `odg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const oracleJobId = String(req.oracleJobId || req.jobId || '').trim();
    const provider = String(req.provider || 'GPT').trim().toUpperCase();

    const rejectAck = (errorCode, error) => ({
        ok: false,
        accepted: false,
        success: false,
        requestId,
        status: 'failed',
        errorCode,
        error,
        oracleJobId: oracleJobId || null,
        provider,
        command: 'ORACLE_DESIGN_GENERATE',
    });

    if (!oracleJobId) {
        return rejectAck('EXTENSION_COMMAND_REJECTED', 'ORACLE_DESIGN_GENERATE requires oracleJobId');
    }

    const prompt = String(req.prompt || '').trim();
    const count = Math.max(1, Math.min(12, parseInt(req.count, 10) || 4));
    const aiProvider = provider === 'GEM' || provider === 'GEMINI' ? 'gemini' : 'chatgpt';
    const ghostPort = Number(req.ghostPort) || GHOST_SERVER_PORT;
    const attempt = Number(req.attempt) || 1;
    const referenceDataUrl = String(req.referenceDataUrl || '').trim();

    await writeOracleDesignJobState(oracleJobId, {
        status: 'starting',
        stage: 'opening_extension',
        attempt,
        expectedCount: count,
        completed: 0,
        requestId,
        startedAt: Date.now(),
    });

    const ready = await ensureGhostServerReady({ port: ghostPort, forceBootstrap: true });
    if (!ready) {
        await writeOracleDesignJobState(oracleJobId, {
            status: 'failed',
            stage: 'opening_extension',
            errorCode: 'DESIGN_EXECUTOR_UNAVAILABLE',
            error: 'Ghost generate server is not reachable',
            requestId,
        });
        return rejectAck('DESIGN_EXECUTOR_UNAVAILABLE', 'Ghost generate server is not reachable');
    }

    await writeOracleDesignJobState(oracleJobId, { status: 'generating', stage: 'submitting_prompt', requestId });

    const storedCreds = await chrome.storage.local.get(['nhpAdminAiKeys', 'nhpProxyBaseUrl', 'nhpGptApiKey']);
    const adminKeys = storedCreds.nhpAdminAiKeys || {};
    const apiKey = String(req.apiKey || adminKeys.gpt || storedCreds.nhpGptApiKey || '').trim();
    const proxyBaseUrl = String(req.proxyBaseUrl || adminKeys.proxyBaseUrl || storedCreds.nhpProxyBaseUrl || '').trim();

    const form = new FormData();
    if (prompt) form.append('prompt', prompt);
    form.append('count', String(count));
    form.append('aiProvider', aiProvider);
    form.append('mode', referenceDataUrl ? 'auto' : 'text');

    if (referenceDataUrl.startsWith('data:image/')) {
        const blob = await oracleDesignDataUrlToBlob(referenceDataUrl);
        if (blob) form.append('image', blob, 'reference.png');
    }

    const ghostUrl = `${getGhostServerUrl(ghostPort)}/api/generate`;
    const ghostHeaders = {};
    if (apiKey) ghostHeaders['X-NHP-Api-Key'] = apiKey;
    if (proxyBaseUrl) ghostHeaders['X-NHP-Proxy-Base-Url'] = proxyBaseUrl;
    const resp = await fetch(ghostUrl, { method: 'POST', body: form, headers: ghostHeaders });
    let data = null;
    try {
        data = await resp.json();
    } catch (_) {
        data = { success: false, error: `Ghost returned HTTP ${resp.status}` };
    }

    if (!resp.ok || !data?.success) {
        await writeOracleDesignJobState(oracleJobId, {
            status: 'failed',
            stage: 'submitting_prompt',
            errorCode: data?.code || 'GENERATION_SUBMIT_FAILED',
            error: data?.error || `Ghost HTTP ${resp.status}`,
            ghostJobId: data?.jobId || null,
            requestId,
        });
        return rejectAck(
            data?.code || 'GENERATION_SUBMIT_FAILED',
            data?.error || `Ghost HTTP ${resp.status}`
        );
    }

    const ghostJobId = String(data.jobId || '').trim();
    await writeOracleDesignJobState(oracleJobId, {
        status: 'generating',
        stage: 'generating',
        ghostJobId,
        extensionTaskId: ghostJobId,
        expectedCount: count,
        completed: 0,
        requestId,
    });

    return {
        ok: true,
        accepted: true,
        success: true,
        requestId,
        status: 'submitted',
        extensionTaskId: ghostJobId,
        ghostJobId,
        provider,
        oracleJobId,
        command: 'ORACLE_DESIGN_GENERATE',
    };
}

async function pollOracleDesignJobStatus(req = {}) {
    const oracleJobId = String(req.oracleJobId || req.jobId || '').trim();
    if (!oracleJobId) throw new Error('ORACLE_DESIGN_STATUS requires oracleJobId');

    const state = (await readOracleDesignJobState(oracleJobId)) || {};
    if (state.status === 'done' || state.status === 'partial' || state.status === 'failed') {
        return {
            success: true,
            command: 'ORACLE_DESIGN_STATUS',
            oracleJobId,
            ...state,
        };
    }

    const ghostJobId = String(state.ghostJobId || '').trim();
    const ghostPort = Number(req.ghostPort) || GHOST_SERVER_PORT;
    if (!ghostJobId) {
        return {
            success: true,
            command: 'ORACLE_DESIGN_STATUS',
            oracleJobId,
            status: state.status || 'starting',
            stage: state.stage || 'submitting_prompt',
            completed: 0,
            total: state.expectedCount || 0,
        };
    }

    const jobResp = await fetch(`${getGhostServerUrl(ghostPort)}/api/jobs/${encodeURIComponent(ghostJobId)}`);
    const jobData = await jobResp.json().catch(() => ({}));
    if (!jobResp.ok || !jobData?.success) {
        await writeOracleDesignJobState(oracleJobId, {
            status: 'failed',
            stage: 'generating',
            errorCode: 'GHOST_JOB_POLL_FAILED',
            error: jobData?.error || `Ghost job poll HTTP ${jobResp.status}`,
        });
        const failed = await readOracleDesignJobState(oracleJobId);
        return { success: true, command: 'ORACLE_DESIGN_STATUS', oracleJobId, ...failed };
    }

    const meta = jobData.job || {};
    const files = Array.isArray(jobData.files) ? jobData.files : [];
    const ghostStatus = String(meta.status || 'running').toLowerCase();

    if (ghostStatus === 'done' || (ghostStatus !== 'running' && files.length > 0)) {
        const images = [];
        for (const file of files) {
            const filename = String(file.filename || '').trim();
            if (!filename) continue;
            const fileUrl = String(file.url || `/api/generate/file/${ghostJobId}/${filename}`);
            try {
                const imgResp = await fetch(`${getGhostServerUrl(ghostPort)}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`);
                if (!imgResp.ok) continue;
                const buf = await imgResp.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
                images.push({
                    filename,
                    url: fileUrl,
                    dataUrl: `data:image/png;base64,${btoa(binary)}`,
                });
            } catch (_) {
                images.push({ filename, url: fileUrl });
            }
        }
        const expected = Number(state.expectedCount) || files.length || 0;
        const completed = images.length;
        const finalStatus = completed <= 0
            ? 'failed'
            : (expected > 0 && completed < expected ? 'partial' : 'done');
        await writeOracleDesignJobState(oracleJobId, {
            status: finalStatus,
            stage: 'collecting_results',
            completed,
            total: expected || completed,
            images,
            ghostJobId,
            error: completed <= 0 ? 'No PNG outputs from ghost job' : '',
            errorCode: completed <= 0 ? 'NO_RESULTS' : '',
        });
        const doneState = await readOracleDesignJobState(oracleJobId);
        return { success: true, command: 'ORACLE_DESIGN_STATUS', oracleJobId, ...doneState };
    }

    if (ghostStatus === 'error' || ghostStatus === 'cancelled') {
        await writeOracleDesignJobState(oracleJobId, {
            status: 'failed',
            stage: 'generating',
            errorCode: 'GENERATION_FAILED',
            error: meta.error || `Ghost job ${ghostStatus}`,
            ghostJobId,
        });
        const failed = await readOracleDesignJobState(oracleJobId);
        return { success: true, command: 'ORACLE_DESIGN_STATUS', oracleJobId, ...failed };
    }

    const batchesCompleted = Number(meta.batchesCompleted || jobData.batchesCompleted || 0);
    const totalBatches = Number(meta.totalBatches || jobData.totalBatches || 1);
    const completed = files.length;
    await writeOracleDesignJobState(oracleJobId, {
        status: 'generating',
        stage: meta.stage || 'generating',
        completed,
        total: Number(state.expectedCount) || completed,
        ghostJobId,
        batchesCompleted,
        totalBatches,
    });

    const running = await readOracleDesignJobState(oracleJobId);
    return { success: true, command: 'ORACLE_DESIGN_STATUS', oracleJobId, ...running };
}

async function waitForOracleTask(baseUrl, token, taskId, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const task = await fetchOracleJson(`${baseUrl}/api/generic-task/${encodeURIComponent(taskId)}`, token, {}, 10000);
        if (task?.status === 'completed') return task;
        if (task?.status === 'failed') {
            const error = task.error?.message || task.error || 'Oracle task failed';
            throw new Error(error);
        }
        await delay(1000);
    }
    throw new Error('Timed out waiting for Oracle trends task');
}

async function getOracleRuntimeConfig() {
    const config = await chromeLocalGet([
        'nhpOracleBaseUrl',
        'oracleBaseUrl',
        'oracleEngineBaseUrl',
        'NHP_ORACLE_BASE_URL',
        'nhpOracleToken',
        'oracleEngineToken',
        'NHP_ENGINE_TOKEN'
    ]);
    const token = String(config.nhpOracleToken || config.oracleEngineToken || config.NHP_ENGINE_TOKEN || '').trim();
    const baseUrl = normalizeOracleBaseUrl(
        config.nhpOracleBaseUrl ||
        config.oracleBaseUrl ||
        config.oracleEngineBaseUrl ||
        config.NHP_ORACLE_BASE_URL ||
        (token ? 'http://127.0.0.1:3041' : 'https://oracle-api.emailcore.app')
    );
    return { baseUrl, token };
}

/**
 * TeePublic image hunt via Oracle RADAR_CONTROL (VM extension CDP).
 * Used as parallel accelerator / backup when local TeePublic fetch is blocked.
 */
async function fetchTeePublicHuntImagesViaOracle(niche, options = {}) {
    const query = normalizeRadarNicheQuery(niche);
    if (!query) return { images: [], error: 'empty query', teepublicSearchUrl: '' };
    if (isRadarImageHuntAborted(options.requestId)) {
        return { images: [], error: 'aborted', teepublicSearchUrl: '' };
    }

    const { baseUrl, token } = await getOracleRuntimeConfig();
    if (!baseUrl) {
        return { images: [], error: 'Oracle not configured', teepublicSearchUrl: '' };
    }

    const batchLimit = Math.min(Math.max(1, Number(options.batchLimit) || 12), 40);
    const timeoutMs = Math.min(Math.max(8000, Number(options.timeoutMs) || 22000), 45000);
    let lastError = null;

    for (const candidateBaseUrl of getOracleBaseUrlCandidates(baseUrl)) {
        try {
            const created = await fetchOracleJson(`${candidateBaseUrl}/api/generic-task`, token, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskType: 'RADAR_CONTROL',
                    userId: 'nhp-extension',
                    sessionId: 'nhp-extension-image-hunt',
                    provider: 'oracle',
                    payload: {
                        operation: 'fetch_source_images',
                        payload: {
                            niche: query,
                            query,
                            mode: 'teepublic',
                            source: 'teepublic',
                            sort: 'popular',
                            prefer: 'popular',
                            popular: true,
                            urlOnly: true,
                            hydrateThumbs: false,
                            progressiveHunt: true,
                            batchLimit,
                            seenUrls: Array.isArray(options.seenUrls) ? options.seenUrls : [],
                            cursor: options.cursor || undefined,
                            requestId: String(options.requestId || `oracle-tp-hunt-${Date.now()}`),
                            __oracleInternal: true
                        }
                    }
                })
            }, 12000);

            const taskId = created?.taskId || created?.id;
            if (!taskId) throw new Error('Oracle did not return a task id');

            const completed = await waitForOracleTask(candidateBaseUrl, token, taskId, timeoutMs);
            const data = extractOracleTaskResultData(completed);
            const response = data?.response || data?.result?.response || data;
            const images = Array.isArray(response?.images)
                ? response.images
                : (Array.isArray(data?.images) ? data.images : []);
            const teepublicSearchUrl = String(
                response?.teepublicSearchUrl || data?.teepublicSearchUrl || buildRadarTeepublicSearchUrl(query, 1) || ''
            ).trim();

            if (!images.length) {
                throw new Error(response?.error || data?.error || 'Oracle returned no TeePublic hunt images');
            }

            return {
                images: images.map((item) => ({
                    ...item,
                    source: item?.source || 'teepublic',
                    sourceLabel: item?.sourceLabel || 'TeePublic'
                })),
                teepublicSearchUrl,
                error: null,
                via: 'oracle'
            };
        } catch (error) {
            lastError = error;
            console.warn('[NHP][Hunt] Oracle TeePublic fetch failed:', error?.message || error);
        }
    }

    return {
        images: [],
        error: lastError?.message || 'Oracle TeePublic hunt failed',
        teepublicSearchUrl: buildRadarTeepublicSearchUrl(query, 1)
    };
}

async function fetchTrendRecordsFromOracleRuntime() {
    const { baseUrl, token } = await getOracleRuntimeConfig();
    if (!baseUrl) {
        throw new Error('Oracle trends runtime is not configured');
    }

    let lastError = null;
    for (const candidateBaseUrl of getOracleBaseUrlCandidates(baseUrl)) {
        try {
            const created = await fetchOracleJson(`${candidateBaseUrl}/api/generic-task`, token, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskType: 'GET_TEEPUBLIC_TRENDS',
                    userId: 'nhp-extension',
                    sessionId: 'nhp-extension-trends',
                    provider: 'oracle',
                    payload: {
                        mode: 'auto-max',
                        strategy: 'max-results',
                        clean: false,
                        consumer: 'v30-extension-viewer'
                    },
                    timeoutMs: 90000,
                    contractVersion: '1.0'
                })
            }, 12000);

            const taskId = created?.taskId || created?.id;
            if (!taskId) throw new Error('Oracle did not return a task id');

            const completed = await waitForOracleTask(candidateBaseUrl, token, taskId, 90000);
            const data = extractOracleTaskResultData(completed);
            const trends = extractOracleTrendRecords(data).length
                ? extractOracleTrendRecords(data)
                : extractOracleTrendRecords(completed);
            if (!trends.length) throw new Error('Oracle returned no TeePublic trends');

            return trends;
        } catch (error) {
            lastError = error;
            if (!/HTTP 404|Failed to fetch|NetworkError|401|403|unauthorized/i.test(String(error?.message || error))) {
                break;
            }
        }
    }
    throw lastError || new Error('Oracle trends runtime failed');
}

async function fetchTrendsFromOracleRuntime() {
    const trends = await fetchTrendRecordsFromOracleRuntime();
    return buildTrendHtmlForLegacyParser(trends);
}

function extractTrendTagsFromDomInPage() {
    const elements = document.querySelectorAll(
        '.trending-tag .link_content, .trending-tag a, .trending-tags a, a[href*="/trending-tags"], a[href*="/t-shirt/"]'
    );
    const tags = [];
    const seen = new Set();
    elements.forEach((el) => {
        const text = String(el.innerText || el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
        const key = text.toLowerCase();
        if (!text || text.length < 2 || text.length > 60 || seen.has(key)) return;
        seen.add(key);
        tags.push(text);
    });
    return {
        tags,
        blocked: /just a moment|cf_chl_opt|challenge-platform|enable javascript and cookies/i.test(
            String(document.body?.innerText || document.title || '')
        ),
        title: document.title || '',
        href: location.href || ''
    };
}

async function scrapeTrendTagsFromTab(tabId, { attempts = 12, delayMs = 1200 } = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const [res] = await chrome.scripting.executeScript({
                target: { tabId },
                func: extractTrendTagsFromDomInPage
            });
            const payload = res?.result || {};
            if (Array.isArray(payload.tags) && payload.tags.length > 0 && !payload.blocked) {
                return payload.tags;
            }
            if (payload.blocked) {
                lastError = new Error('TeePublic tab still on Cloudflare challenge');
            } else {
                lastError = new Error('No trends found in TeePublic tab yet');
            }
        } catch (error) {
            lastError = error;
        }
        if (attempt < attempts) await delay(delayMs);
    }
    throw lastError || new Error('No trends found in TeePublic tab');
}

async function fetchTrendsViaExistingTeePublicTab() {
    const tabs = await chrome.tabs.query({ url: ['*://www.teepublic.com/*', '*://teepublic.com/*'] });
    const preferred = (tabs || [])
        .filter((tab) => tab?.id && /teepublic\.com\/(?:trending-tags|tag-directory)/i.test(String(tab.url || '')))
        .sort((a, b) => {
            const aScore = /trending-tags/i.test(String(a.url || '')) ? 2 : 1;
            const bScore = /trending-tags/i.test(String(b.url || '')) ? 2 : 1;
            return bScore - aScore;
        });

    if (!preferred.length) {
        throw new Error('No open TeePublic trending-tags tab');
    }

    let lastError = null;
    for (const tab of preferred) {
        try {
            return await scrapeTrendTagsFromTab(tab.id, { attempts: 10, delayMs: 900 });
        } catch (error) {
            lastError = error;
            console.warn('[NHP][Trends] Existing TeePublic tab scrape failed:', error?.message || error);
        }
    }
    throw lastError || new Error('No usable open TeePublic trending-tags tab');
}

async function fetchTrendsViaBackgroundTab() {
    let tab = null;
    let listener = null;
    let settled = false;

    const cleanup = async () => {
        if (listener) {
            chrome.tabs.onUpdated.removeListener(listener);
            listener = null;
        }
        if (tab?.id) {
            await chrome.tabs.remove(tab.id).catch(() => {});
            tab = null;
        }
    };

    try {
        tab = await chrome.tabs.create({
            url: 'https://www.teepublic.com/trending-tags',
            active: false
        });

        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Timeout loading TeePublic trends tab'));
                }
            }, 45000);

            listener = (tabId, changeInfo) => {
                if (tabId === tab.id && changeInfo.status === 'complete' && !settled) {
                    settled = true;
                    clearTimeout(timeoutId);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });

        await delay(1200);
        const tags = await scrapeTrendTagsFromTab(tab.id, { attempts: 20, delayMs: 1500 });
        await cleanup();
        return tags;
    } catch (error) {
        await cleanup();
        throw error;
    }
}

async function fetchTrendsFromTeePublic() {
    const errors = [];

    try {
        console.log('[NHP][Trends] Attempting direct network fetch from TeePublic...');
        const trends = await fetchOfficialTrendTitlesBounded(2);
        if (trends?.length) {
            console.log(`[NHP][Trends] Direct fetch succeeded (${trends.length}).`);
            return buildTrendHtmlForLegacyParser(trends);
        }
        errors.push('direct: empty');
    } catch (error) {
        errors.push(`direct: ${error?.message || error}`);
        console.warn('[NHP][Trends] Direct fetch failed:', error?.message || error);
    }

    try {
        console.log('[NHP][Trends] Trying existing TeePublic browser tab...');
        const trends = await fetchTrendsViaExistingTeePublicTab();
        if (trends?.length) {
            console.log(`[NHP][Trends] Existing tab scrape succeeded (${trends.length}).`);
            return buildTrendHtmlForLegacyParser(trends);
        }
        errors.push('existing-tab: empty');
    } catch (error) {
        errors.push(`existing-tab: ${error?.message || error}`);
        console.warn('[NHP][Trends] Existing tab scrape failed:', error?.message || error);
    }

    try {
        console.log('[NHP][Trends] Trying background TeePublic tab...');
        const trends = await fetchTrendsViaBackgroundTab();
        if (trends?.length) {
            console.log(`[NHP][Trends] Background tab scrape succeeded (${trends.length}).`);
            return buildTrendHtmlForLegacyParser(trends);
        }
        errors.push('bg-tab: empty');
    } catch (error) {
        errors.push(`bg-tab: ${error?.message || error}`);
        console.warn('[NHP][Trends] Background tab scrape failed:', error?.message || error);
    }

    try {
        console.log('[NHP][Trends] Falling back to Oracle GET_TEEPUBLIC_TRENDS...');
        return await fetchTrendsFromOracleRuntime();
    } catch (error) {
        errors.push(`oracle: ${error?.message || error}`);
        console.warn('[NHP][Trends] Oracle fallback failed:', error?.message || error);
        throw new Error(`┘üÏ┤┘ä Ïº┘äÏ¼┘äÏ¿ ┘à┘å Ïº┘äÏ«┘ä┘ü┘èÏ® ÔÇö ${errors.join(' | ')}`);
    }
}

async function handleArtisanFetchTrends(m) { return await fetchAllTrendsBackground(); }
async function fetchAllTrendsBackground() {
    try {
        const trends = await fetchTrendRecordsFromOracleRuntime();
        if (trends?.length) return { trends };
    } catch (_) { /* fall through to legacy blend */ }

    let allTrends = [];
    try {
        try {
            const official = await fetchOfficialTrendTitlesBounded(2);
            official.forEach((title) => allTrends.push({ title, source: 'TeePublic' }));
        } catch (_) { /* CF may block; keep other sources */ }

        const templates = [
            "t-shirt idea {word}", "funny shirt {word}", "vintage shirt {word}",
            "retro shirt {word}", "gift for {word}", "funny quote {word}",
            "sarcastic shirt {word}", "dad shirt {word}", "mom shirt {word}",
            "cool shirt {word}", "gamer shirt {word}", "teacher shirt {word}",
            "nurse shirt {word}", "cat shirt {word}", "dog shirt {word}",
            "hiking shirt {word}", "camping shirt {word}", "fishing shirt {word}",
            "yoga shirt {word}", "workout shirt {word}", "programming shirt {word}",
            "coffee shirt {word}", "wine shirt {word}", "beer shirt {word}",
            "book lover shirt {word}", "travel shirt {word}", "music shirt {word}"
        ];

        const chosenTemplates = templates.sort(() => 0.5 - Math.random()).slice(0, 15);

        for (let template of chosenTemplates) {
            try {
                const seed = template.replace('{word}', '');
                const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(seed)}`);
                const data = await res.json();
                if (data[1]) data[1].forEach(term => {
                    const cleanTerm = term.toLowerCase().replace(seed.toLowerCase(), '').trim();
                    if (cleanTerm.length > 2 && cleanTerm.length < 50) {
                        allTrends.push({ title: cleanTerm, source: 'Google' });
                    }
                });
            } catch (e) { }
        }

        const trendNoiseTerms = new Set(['design', 'designs', 'for men', 'for women', 'men', 'women', 'kids', 'system', 'systems', 't shirt', 't shirts', 'tee', 'tees', 'shirt', 'shirts', 'gift', 'gifts', 'shop', 'newest', 'popular', 'staff picks', 'tag directory', 'trending tags']);
        const unique = Array.from(new Set(allTrends.map(t => t.title.toLowerCase())))
            .map(title => allTrends.find(t => t.title.toLowerCase() === title))
            .filter(t => t.title && t.title.length > 2 && !trendNoiseTerms.has(String(t.title).trim().toLowerCase()))
            .slice(0, 500);

        return { trends: unique };
    } catch (e) { return { trends: [] }; }
}

async function waitForUSPTOFastTabReady(tabId, timeoutMs = USPTO_FAST_TAB_READY_TIMEOUT_MS) {
    const startedAt = Date.now();
    let reloadedBlankPage = false;
    while ((Date.now() - startedAt) < timeoutMs) {
        await delay(700);
        try {
            const [res] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const input = document.querySelector('#searchbar')
                        || document.querySelector('input[aria-label*="Search" i]')
                        || document.querySelector('input[formcontrolname="search"]');
                    return {
                        ready: !!input,
                        textLength: String(document.body?.innerText || '').trim().length,
                        title: document.title || '',
                        href: location.href || ''
                    };
                }
            });
            if (res?.result?.ready) return true;
            const elapsed = Date.now() - startedAt;
            const looksBlank = !res?.result?.textLength && elapsed > 6000;
            if (looksBlank && !reloadedBlankPage) {
                reloadedBlankPage = true;
                await chrome.tabs.reload(tabId).catch(() => {});
                await delay(2500);
            }
        } catch (_) { }
    }
    return false;
}

async function prepareUSPTOFastWorkerTab(workerIndex = 0) {
    return createUSPTOEngineTarget(workerIndex);
}

async function claimNextUSPTOFastNiche(workerIndex = 0) {
    let releaseLock = null;
    const previousLock = usptoFastClaimLock;
    usptoFastClaimLock = new Promise((resolve) => {
        releaseLock = resolve;
    });
    await previousLock.catch(() => { });

    try {
        const data = await getStorage(['uRunning', 'uPending']);
        const pending = Array.isArray(data.uPending) ? [...data.uPending] : [];
        if (!data.uRunning || uStopped || pending.length === 0) {
            return null;
        }
        const niche = String(pending.shift() || '').trim();
        if (niche) {
            await addUsptoInFlightNiche(niche);
            await persistUsptoBatchSnapshot('uspto_claim');
        }
        await setStorage({ uPending: pending, uCurrent: niche || null });
        return niche || null;
    } finally {
        releaseLock?.();
    }
}

async function ensureUSPTOFastWorkers() {
    if (uStopped) {
        isUSPTOProcessing = false;
        return;
    }

    const pendingData = await getStorage(['uRunning', 'uPending']);
    const pending = Array.isArray(pendingData.uPending) ? pendingData.uPending : [];
    if (!pendingData.uRunning || pending.length === 0) {
        if (usptoFastActiveWorkers.size === 0) {
            await setStorage({ uRunning: false, uCurrent: null });
            isUSPTOProcessing = false;
        }
        await updateUSPTOFastActiveCount();
        return;
    }

    const target = await getUSPTOFastWorkerTarget();
    const proxyPool = await getUSPTOFastProxyPool();

    while (!uStopped && usptoFastActiveWorkers.size < target) {
        const workerIndex = getNextUSPTOFastWorkerSlot();
        if (workerIndex < 0 || usptoFastActiveWorkers.has(workerIndex)) break;

        const proxyLabel = proxyPool.length ? proxyPool[workerIndex % proxyPool.length] : '';
        const workerPromise = (async () => {
            try {
                await runUSPTOFastWorker(workerIndex, proxyLabel);
            } finally {
                usptoFastActiveWorkers.delete(workerIndex);
                await updateUSPTOFastActiveCount();
                if (!uStopped) {
                    await ensureUSPTOFastWorkers();
                } else if (usptoFastActiveWorkers.size === 0) {
                    isUSPTOProcessing = false;
                }
            }
        })();

        usptoFastActiveWorkers.set(workerIndex, {
            startedAt: Date.now(),
            promise: workerPromise
        });
    }

    await updateUSPTOFastActiveCount();
}

async function runUSPTOFastWorker(workerIndex, proxyLabel) {
    const engineData = await prepareUSPTOFastWorkerTab(workerIndex);
    if (!engineData) return;
    const tabId = engineData.tabId;
    const windowId = engineData.windowId;
    const ready = await waitForUSPTOFastTabReady(tabId);
    if (!ready) {
        console.warn(`[USPTO FAST][W${workerIndex + 1}] tab did not become ready in time.`);
        await closeUSPTOEngineTarget(engineData);
        return;
    }

    while (true) {
        if (uStopped) break;
        const target = await getUSPTOFastWorkerTarget();
        if ((workerIndex + 1) > target) break;
        const niche = await claimNextUSPTOFastNiche(workerIndex);
        if (!niche) break;
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: usptoSearch,
                args: [niche]
            });
            const result = await pollUSPTOResult(tabId, 30);
            await finalizeUSPTOFastItem(niche, result);
        } catch (e) {
            console.error(`[USPTO FAST][W${workerIndex + 1}]`, e, proxyLabel ? `proxy=${proxyLabel}` : '');
            if (uStopped) await requeueUSPTOFastItem(niche);
            else await finalizeUSPTOFastItem(niche, 'error');
        }
        const humanDelay = Math.floor(Math.random() * 1500) + 700;
        await delay(humanDelay);
    }

    await closeUSPTOEngineTarget(engineData);
}

async function processUSPTOFast() {
    if (uStopped) { isUSPTOProcessing = false; return; }
    isUSPTOProcessing = true;
    await startHeartbeat().catch(() => { });
    try {
        const data = await getStorage(['uRunning', 'uPending']);
        const pending = Array.isArray(data.uPending) ? [...data.uPending] : [];
        if (!data.uRunning || pending.length === 0) {
            await setStorage({ uRunning: false, uCurrent: null });
            isUSPTOProcessing = false;
            return;
        }

        await closeLingeringUSPTOFastTabs();
        const hw = (typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency))
            ? navigator.hardwareConcurrency
            : 2;
        const defaultTarget = Math.max(1, Math.min(hw <= 4 ? 2 : 3, USPTO_FAST_WORKERS_MAX, pending.length || 1));
        const targetData = await getStorage([USPTO_FAST_WORKER_TARGET_KEY]);
        const existingTarget = targetData[USPTO_FAST_WORKER_TARGET_KEY];
        await setStorage({
            [USPTO_FAST_WORKER_TARGET_KEY]: normalizeUSPTOFastWorkerTarget(existingTarget || defaultTarget, defaultTarget),
            [USPTO_FAST_WORKER_ACTIVE_KEY]: 0
        });
        await ensureUSPTOFastWorkers();
    } catch (error) {
        console.error('[USPTO FAST] Fatal Loop Error:', error);
        isUSPTOProcessing = false;
    }
}

async function startUSPTOProcessing() {
    if (isUSPTOProcessing) return;
    await processUSPTOFast();
}

async function processUSPTO() {
    if (uStopped) { isUSPTOProcessing = false; return; }

    try {
        isUSPTOProcessing = true;
        const data = await getStorage(['uRunning', 'uPending', 'uSafe', 'uBanned', 'uTotal']);
        if (!data.uRunning || !data.uPending?.length) {
            await setStorage({ uRunning: false, uCurrent: null });
            isUSPTOProcessing = false;
            return;
        }

        const niche = data.uPending[0];
        await setStorage({ uCurrent: niche });

        // ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¬├â╦£├é┬¡├âÔäó├óÔé¼┼í├âÔäó├óÔé¼┼í ├âÔäó├óÔé¼┬ª├âÔäó├óÔé¼┬á ├âÔäó├ïÔÇá├â╦£├é┬¼├âÔäó├ïÔÇá├â╦£├é┬» ├â╦£├é┬º├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬á├â╦£├é┬º├âÔäó├é┬ü├â╦£├é┬░├â╦£├é┬® ├âÔäó├ïÔÇá├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¬├â╦£├é┬¿├âÔäó├ïÔÇá├âÔäó├à┬á├â╦£├é┬¿
        let tab = null;
        if (usptoTabId) {
            try {
                tab = await new Promise(r => chrome.tabs.get(usptoTabId, t => {
                    if (chrome.runtime.lastError) r(null);
                    else r(t);
                }));
            } catch (e) { tab = null; }
        }

        if (!tab) {
            console.log("[USPTO] No valid engine tab found, creating new one...");
            const engineData = await prepareUSPTOEngine();
            if (engineData) {
                usptoWindowId = engineData.windowId;
                usptoTabId = engineData.tabId;
                await delay(5000); // Wait for load
                tab = await new Promise(r => chrome.tabs.get(usptoTabId, r));
            }
        }

        if (!tab) {
            console.error("[USPTO] Fatal: Failed to create or find engine tab.");
            await setStorage({ uRunning: false });
            isUSPTOProcessing = false;
            return;
        }

        // ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¬├â╦£├é┬ú├âÔäó├åÔÇÖ├â╦£├é┬» ├âÔäó├óÔé¼┬ª├âÔäó├óÔé¼┬á ├â╦£├é┬ú├âÔäó├óÔé¼┬á├âÔäó├óÔé¼┬á├â╦£├é┬º ├â╦£├é┬╣├âÔäó├óÔé¼┼¥├âÔäó├óÔé¼┬░ ├â╦£├é┬Á├âÔäó├é┬ü├â╦£├é┬¡├â╦£├é┬® ├â╦£├é┬º├âÔäó├óÔé¼┼¥├â╦£├é┬¿├â╦£├é┬¡├â╦£├é┬½
        if (tab.url && !tab.url.includes('/search/search-information') && !tab.url.includes('/search/search-results')) {
            await chrome.tabs.update(tab.id, { url: 'https://tmsearch.uspto.gov/search/search-information' });
            await delay(3000);
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: usptoSearch,
                args: [niche]
            });
            const result = await pollUSPTOResult(tab.id, 30);
            await finalizeUSPTO(niche, result);
        } catch (e) {
            console.error('[USPTO] Execution Error:', e);
            await finalizeUSPTO(niche, 'error');
        }
    } catch (fatal) {
        console.error('[USPTO] Fatal Loop Error:', fatal);
        isUSPTOProcessing = false;
    }
}

async function prepareUSPTOEngine() {
    return createUSPTOEngineTarget(0);
}

async function pollUSPTOResult(tabId, maxSecs) {
    for (let i = 0; i < maxSecs * 2; i++) {
        await delay(500);
        try {
            const [res] = await chrome.scripting.executeScript({
                target: { tabId }, func: usptoReadResult
            });
            const status = res.result?.result;
            if (status === 'safe' || status === 'banned') return status;
        } catch (_) { }
    }
    return 'error';
}

function pushUsptoBucketItem(list, niche, nicheKey) {
    const key = nicheKey || normalizeNicheKey(niche);
    const value = String(niche || '').trim();
    if (!value) return;
    if (key && list.some((item) => normalizeNicheKey(item) === key)) return;
    list.push(value);
}

async function finalizeUSPTO(niche, status) {
    const data = await getStorage(['uPending', 'uSafe', 'uBanned', 'uErrors', 'uTotal', 'usptoHistory', NHP_NICHE_CACHE_STORAGE_KEY]);
    const pending = (data.uPending || []).slice(1);
    const safe = [...(data.uSafe || [])], banned = [...(data.uBanned || [])], errors = [...(data.uErrors || [])];
    const nicheKey = normalizeNicheKey(niche);
    let cache = sanitizeNicheCacheMap(data[NHP_NICHE_CACHE_STORAGE_KEY] || {});

    if (status === 'safe') {
        pushUsptoBucketItem(safe, niche, nicheKey);
        if (nicheKey) cache = upsertNicheCacheUspto(cache, nicheKey, 'safe');
    } else if (status === 'banned') {
        pushUsptoBucketItem(banned, niche, nicheKey);
        if (nicheKey) cache = upsertNicheCacheUspto(cache, nicheKey, 'banned');
    } else {
        pushUsptoBucketItem(errors, niche, nicheKey);
    }

    const derivedTotal = safe.length + banned.length + errors.length + pending.length;
    const uTotal = Math.max(Number(data.uTotal) || 0, derivedTotal);
    const legacy = syncNicheCacheToLegacyMaps(cache);

    await setStorage({
        uPending: pending,
        uSafe: safe,
        uBanned: banned,
        uErrors: errors,
        uCurrent: null,
        usptoHistory: legacy.usptoHistory,
        [NHP_NICHE_CACHE_STORAGE_KEY]: cache,
        uTotal
    });
    await persistPersistentNicheMemory('uspto');
    if (status === 'safe' || status === 'banned') {
        await recordArchiveStage([{ text: niche, status }], 'uspto', 'uspto_stage');
    }

    const unofficialNoteData = normalizeNoteDataPayload((await getStorage(['teepublic_manager_data'])).teepublic_manager_data);
    const unofficialEntry = unofficialNoteData.unofficialTrends.find((item) => normalizeNicheKey(item?.text) === nicheKey);
    if (unofficialEntry?.autoPipeline) {
        if (status === 'safe') {
            await upsertRadarUnofficialNoteItems([{ text: niche }], {
                autoPipeline: true,
                usptoStatus: 'safe',
                pipelineStage: 'analysis_queue'
            });
            await queueRadarUnofficialTpNiches([niche]);
        } else if (status === 'banned') {
            await upsertRadarUnofficialNoteItems([{ text: niche }], {
                autoPipeline: true,
                usptoStatus: 'banned',
                pipelineStage: 'blocked'
            });
        }
    }

    if (!pending.length) {
        await setStorage({ uRunning: false, uCurrent: null });
        isUSPTOProcessing = false;
        await closeUSPTOEngineTarget({ windowId: usptoWindowId, tabId: usptoTabId });
        usptoWindowId = null;
        usptoTabId = null;
        return;
    }

    const humanDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
    setTimeout(() => processUSPTO(), humanDelay);
}

function usptoSearch(niche) {
    return new Promise(async resolve => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const term = '"' + niche.trim() + '"';

        // 1. Wait for page stability
        await sleep(1000);

        // 2. Switch to General Search (dropdown)
        const dropdown = document.querySelector('mat-select[formcontrolname="searchType"]')
            || document.querySelector('#mat-select-0')
            || document.querySelector('mat-select');

        if (dropdown) {
            const valEl = dropdown.querySelector('.mat-mdc-select-value-text, .mat-select-value-text');
            if (valEl && !valEl.textContent.toLowerCase().includes('general')) {
                dropdown.click();
                await sleep(700);
                const opts = document.querySelectorAll('mat-option, .mat-option');
                for (const opt of opts) {
                    if (opt.textContent.toLowerCase().includes('general') || opt.textContent.toLowerCase().includes('basic')) {
                        opt.click(); await sleep(600); break;
                    }
                }
            }
        }

        // 3. Fill search bar (#searchbar)
        const input = document.querySelector('#searchbar')
            || document.querySelector('input[aria-label*="Search" i]')
            || document.querySelector('input[formcontrolname="search"]');

        if (!input) { resolve(false); return; }

        await sleep(200);
        input.value = term;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(400);

        // 4. Filters: Uncheck "Dead" 
        try {
            const deadCheckbox = document.getElementById('statusDead') || document.querySelector('input[id*="dead" i]');
            if (deadCheckbox && deadCheckbox.checked) {
                deadCheckbox.click();
                await sleep(300);
            }
        } catch (e) { }

        // 5. Click Search Button
        const btn = document.querySelector('.search-bar button.md-icon') ||
            document.querySelector('.search-bar button') ||
            document.querySelector('button[aria-label*="search" i]') ||
            document.querySelector('button.mdc-icon-button[type="submit"]');

        if (btn) {
            btn.click();
        } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
        resolve(true);
    });
}

function usptoReadResult() {
    const body = document.body.innerText.toLowerCase();

    // 1. No result phrases
    if (/\b0\s+result/i.test(body) ||
        body.includes('no records found') ||
        body.includes('no results found') ||
        body.includes('no matches') ||
        body.includes('yielded no results') ||
        body.includes('no trademarks found')) {
        return { result: 'safe' };
    }

    // 2. Result indicators
    const match = body.match(/([\d,]+)\s+(result|record|match|trademark)/i);
    if (match) {
        const num = parseInt(match[1].replace(/,/g, ''), 10);
        if (num > 0) return { result: 'banned' };
    }

    if (document.querySelector('mat-row') ||
        document.querySelector('table tr') ||
        document.querySelector('.tm-grid-result') ||
        document.querySelector('.search-results')) {
        return { result: 'banned' };
    }

    return { result: 'loading' };
}

const BUBBLE_SPIDER_EXTENSION_ID = 'adkappjdekgefnmlalhahdnnhiifkgof';
const RB_BUBBLESPIDER_GRAPHQL_URL = 'https://www.redbubble.com/boom/graphql';
const RB_BUBBLESPIDER_SEARCH_QUERY = `query withSearchResults($query: String!, $queryParams: QueryParams, $locale: String!, $country: String!, $currency: String!, $previewTypeIds: [String!], $experience: String) {
  searchResults(query: $query, queryParams: $queryParams, locale: $locale, country: $country, currency: $currency, previewTypeIds: $previewTypeIds, experience: $experience) {
    ...Results
  }
}
fragment Results on SearchResults {
  results {
    work(locale: $locale) {
      tags
    }
  }
}`;

function bgAggregateRedbubbleTagFrequency(tagMatrix, resultsLimit = 100) {
    const slice = (tagMatrix || []).slice(0, resultsLimit);
    const frequency = {};
    slice
        .map((arr) => [...new Set(Array.isArray(arr) ? arr : [])])
        .join(',')
        .split(',')
        .forEach((raw, index) => {
            const tag = String(raw || '').trim();
            if (!tag) return;
            if (frequency[tag]) frequency[tag][0] += 1;
            else frequency[tag] = [1, index];
        });
    return Object.entries(frequency)
        .sort((a, b) => {
            const countDiff = a[1][0] - b[1][0];
            return countDiff !== 0 ? countDiff : b[1][1] - a[1][1];
        })
        .reverse()
        .map(([tag]) => tag);
}

async function bgTryBubbleSpiderExtensionTags(keyword) {
    try {
        const res = await chrome.runtime.sendMessage(BUBBLE_SPIDER_EXTENSION_ID, {
            type: 'get-tags',
            keywords: String(keyword || '').trim()
        });
        if (!res?.tags || !Array.isArray(res.tags)) return null;
        return res.tags;
    } catch {
        return null;
    }
}

async function bgFetchRedbubbleGraphqlTagMatrix(keyword, locale = 'en') {
    const query = String(keyword || '').trim();
    if (!query) return [];
    const payload = {
        operationName: 'withSearchResults',
        variables: {
            query,
            queryParams: {
                pageSize: 100,
                queryParamItems: [{ name: 'query', values: query }],
                searchType: 'find'
            },
            locale,
            country: 'US',
            currency: 'USD',
            previewTypeIds: [],
            experience: 'srp'
        },
        query: RB_BUBBLESPIDER_SEARCH_QUERY
    };
    const res = await fetch(RB_BUBBLESPIDER_GRAPHQL_URL, {
        headers: {
            accept: '*/*',
            'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/json'
        },
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: JSON.stringify(payload),
        method: 'POST',
        mode: 'cors',
        credentials: 'include'
    });
    if (!res.ok) throw new Error(`Redbubble GraphQL HTTP ${res.status}`);
    const json = await res.json();
    const results = json?.data?.searchResults?.results;
    if (!Array.isArray(results)) throw new Error('Redbubble GraphQL invalid response');
    return results
        .map((item) => item?.work?.tags)
        .filter((tags) => Array.isArray(tags) && tags.length > 0);
}

async function bgFetchBubbleSpiderStyleTags(keyword, tagCount = 15, resultsLimit = 100) {
    const query = String(keyword || '').trim();
    if (!query) throw new Error('keyword_required');
    let matrix = await bgTryBubbleSpiderExtensionTags(query);
    if (!matrix?.length) {
        matrix = await bgFetchRedbubbleGraphqlTagMatrix(query);
    }
    if (!matrix?.length) throw new Error('no_redbubble_tags');
    const ranked = bgAggregateRedbubbleTagFrequency(matrix, resultsLimit);
    const limit = Math.max(1, Math.min(Number(tagCount) || 15, ranked.length));
    return ranked.slice(0, limit);
}

async function processTP() {
    if (tpStopped) return;
    const data = await getStorage(['tpRunning', 'tpPending', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpHistory', 'tpPageCounts', NHP_NICHE_CACHE_STORAGE_KEY]);
    if (!data.tpRunning || !data.tpPending?.length) { await setStorage({ tpRunning: false }); return; }
    const niche = data.tpPending[0];
    await setStorage({ tpCurrent: niche });
    const analysis = await fetchAndAnalyzeTeePublicDetailed(`https://www.teepublic.com/t-shirts?query=${encodeURIComponent(niche)}`);
    const status = analysis?.status || 'emp';
    const pending = (data.tpPending || []).slice(1);
    const updated = { ...data, tpPending: pending, tpCurrent: null };
    let cache = sanitizeNicheCacheMap(data[NHP_NICHE_CACHE_STORAGE_KEY] || {});
    const pageCounts = { ...(data.tpPageCounts || {}) };

    // Determine the storage key based on status
    let key = "tpExcel";
    if (status === "med") key = "tpMed";
    else if (status === "sat") key = "tpSat";
    else if (status === "emp") key = "tpEmp";

    if (!updated[key]) updated[key] = [];
    updated[key].push(niche);
    const nicheKey = normalizeNicheKey(niche);
    if (nicheKey) {
        if (status === 'excel' || status === 'med' || status === 'sat') {
            cache = upsertNicheCacheClassification(cache, nicheKey, status);
        }
        if (analysis?.pageCount != null && Number.isFinite(analysis.pageCount)) {
            pageCounts[nicheKey] = analysis.pageCount;
        } else {
            delete pageCounts[nicheKey];
        }
    }
    const legacy = syncNicheCacheToLegacyMaps(cache);
    updated.tpHistory = legacy.tpHistory;
    updated[NHP_NICHE_CACHE_STORAGE_KEY] = cache;
    updated.tpPageCounts = pageCounts;

    await setStorage(updated);
    await persistPersistentNicheMemory('analysis');
    await recordArchiveStage([{ text: niche, status }], 'analysis', 'analysis_stage');
    const unofficialNoteData = normalizeNoteDataPayload((await getStorage(['teepublic_manager_data'])).teepublic_manager_data);
    const unofficialEntry = unofficialNoteData.unofficialTrends.find((item) => normalizeNicheKey(item?.text) === nicheKey);
    if (unofficialEntry?.autoPipeline) {
        await upsertRadarUnofficialNoteItems([{ text: niche }], {
            autoPipeline: true,
            usptoStatus: unofficialEntry.usptoStatus || 'safe',
            analysisStatus: status,
            pipelineStage: 'analysis_done'
        });
    }
    if (!pending.length) { await setStorage({ tpRunning: false }); return; }
    await delay(2000); processTP();
}

function tpFilterOutNichesByKeys(list = [], keysSet) {
    return (list || []).filter((item) => !keysSet.has(normalizeNicheKey(item)));
}

/**
 * Force fresh TeePublic analysis: clear tpHistory entries, remove from result buckets, re-queue.
 */
async function tpForceRecheck(niches = []) {
    const recheckKeys = new Set();
    const recheckCanon = [];
    const seen = new Set();
    (niches || []).forEach((niche) => {
        const clean = String(niche || '').trim();
        const key = normalizeNicheKey(clean);
        if (!clean || seen.has(key)) return;
        seen.add(key);
        recheckKeys.add(key);
        recheckCanon.push(clean);
    });
    if (!recheckCanon.length) {
        return { success: false, queued: 0, error: 'no_niches' };
    }

    const data = await getStorage([
        'tpRunning', 'tpPending', 'tpExcel', 'tpMed', 'tpSat', 'tpEmp', 'tpHistory', 'tpCurrent', 'tpPageCounts',
        NHP_NICHE_CACHE_STORAGE_KEY
    ]);
    if (data.tpRunning) {
        return { success: false, queued: 0, error: 'already_running' };
    }

    let cache = sanitizeNicheCacheMap(data[NHP_NICHE_CACHE_STORAGE_KEY] || {});
    const pageCounts = { ...(data.tpPageCounts || {}) };
    recheckKeys.forEach((key) => {
        if (cache[key]) {
            const entry = sanitizeNicheCacheEntry(cache[key], key);
            entry.classification = null;
            entry.classification_checked_at = null;
            entry.classification_expires_at = null;
            if (!entry.uspto_status) {
                delete cache[key];
            } else {
                cache[key] = entry;
            }
        }
        delete pageCounts[key];
    });
    const legacy = syncNicheCacheToLegacyMaps(cache);
    const history = { ...legacy.tpHistory };

    const excel = tpFilterOutNichesByKeys(data.tpExcel, recheckKeys);
    const med = tpFilterOutNichesByKeys(data.tpMed, recheckKeys);
    const sat = tpFilterOutNichesByKeys(data.tpSat, recheckKeys);
    const emp = tpFilterOutNichesByKeys(data.tpEmp, recheckKeys);

    const pending = Array.isArray(data.tpPending) ? [...data.tpPending] : [];
    const pendingKeys = new Set(pending.map(normalizeNicheKey));
    recheckCanon.forEach((niche) => {
        const key = normalizeNicheKey(niche);
        if (!pendingKeys.has(key)) {
            pending.push(niche);
            pendingKeys.add(key);
        }
    });

    const tpTotal = excel.length + med.length + sat.length + emp.length + pending.length;
    await setStorage({
        tpHistory: history,
        tpPageCounts: pageCounts,
        [NHP_NICHE_CACHE_STORAGE_KEY]: cache,
        tpExcel: excel,
        tpMed: med,
        tpSat: sat,
        tpEmp: emp,
        tpPending: pending,
        tpTotal,
        tpRunning: pending.length > 0,
        tpCurrent: null,
        tpLastAutoImportSignature: null,
        tpPendingAutoImportSignature: null
    });
    await persistPersistentNicheMemory('tp_recheck');

    if (pending.length > 0) {
        tpStopped = false;
        processTP();
    }

    return { success: true, queued: recheckCanon.length, cleared: recheckCanon.length };
}

/** Fallback page size when TeePublic JSON omits results_per_page (live TP uses 36). */
const TP_DESIGNS_PER_PAGE = 36;
/** Sliding pagination often stops at digit 7 ÔÇö probe existence through this cap. */
const TP_PAGE_PROBE_START = 8;
const TP_PAGE_PROBE_MAX = 15;

function tpExtractTeePublicTotalResults(html) {
    const patterns = [
        // Embedded search JSON (current TeePublic) ÔÇö preferred over visible copy.
        /"total_results"\s*:\s*(\d+)/i,
        /"totalResults"\s*:\s*(\d+)/i,
        /"nbHits"\s*:\s*(\d+)/i,
        /"numResults"\s*:\s*(\d+)/i,
        /of\s*(\d[\d,]*)\s+results?\b/i,
        /(\d[\d,]*)\s+results?\s+for\b/i,
        /\b(\d[\d,]*)\s+designs?\s+found\b/i,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m) {
            const n = parseInt(String(m[1]).replace(/,/g, ''), 10);
            if (Number.isFinite(n) && n >= 0 && n < 5_000_000) return n;
        }
    }
    return null;
}

/** Live TeePublic search JSON includes results_per_page (commonly 36). */
function tpExtractTeePublicResultsPerPage(html) {
    const patterns = [
        /"results_per_page"\s*:\s*(\d+)/i,
        /"resultsPerPage"\s*:\s*(\d+)/i,
        /"hitsPerPage"\s*:\s*(\d+)/i,
        /"per_page"\s*:\s*(\d+)/i,
    ];
    for (const re of patterns) {
        const m = String(html || '').match(re);
        if (m) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n >= 1 && n <= 200) return n;
        }
    }
    return null;
}

/**
 * Prefer explicit pagination copy ("Page 1 of 2") over raw ?page= link scraping.
 */
function tpExtractTeePublicPageOfCount(html) {
    if (!html) return null;
    const patterns = [
        /page\s*[:#]?\s*(\d+)\s+of\s+(\d+)/gi,
        /\b(\d+)\s+of\s+(\d+)\s+pages?\b/gi,
        /aria-label=["'][^"']*page\s+\d+\s+of\s+(\d+)[^"']*["']/gi,
        /data-(?:total-?pages|page-?count)=["'](\d+)["']/gi,
    ];
    let best = null;
    for (const re of patterns) {
        for (const m of html.matchAll(re)) {
            const raw = m[2] != null ? m[2] : m[1];
            const n = parseInt(String(raw).replace(/,/g, ''), 10);
            if (Number.isFinite(n) && n > 0 && n < 10_000) {
                best = best == null ? n : Math.max(best, n);
            }
        }
    }
    return best;
}

/**
 * True when an anchor is a next/prev/arrow control (not a numbered page digit).
 * TeePublic often renders 1..6 plus a ÔÇ║ next whose href is ?page=7 even when the
 * visible max digit is 6 ÔÇö that alone must not invent page 7.
 */
function tpIsTeePublicPaginationNavControl(attrs = '', text = '') {
    const a = String(attrs || '');
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (/rel\s*=\s*["'](?:next|prev|previous)["']/i.test(a)) return true;
    if (/aria-label\s*=\s*["'][^"']*\b(?:next|prev|previous)\b[^"']*["']/i.test(a)) return true;
    if (/\b(?:class|id)\s*=\s*["'][^"']*\b(?:next|prev|previous|arrow)\b[^"']*["']/i.test(a)) return true;
    if (/^(?:ÔÇ║|┬╗|ÔÇ╣|┬½|>|<|ÔåÆ|ÔåÉ|ÔÇª|\.\.\.|next|prev|previous)$/i.test(t)) return true;
    if (!t) return true; // icon-only next/prev
    return false;
}

function tpStripTags(s) {
    return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Max page from pagination UI: prefer visible numbered digits (1..N), never inflate
 * from next/prev arrow hrefs alone. Only count ?page=N when the control itself is
 * a real numbered page link (digit label or "Page N" aria), not a nav arrow.
 */
function tpExtractTeePublicMaxPageFromLinks(html) {
    if (!html) return null;
    const navChunks = [];
    const navRe = /<(?:nav|div|ul|ol)[^>]*(?:class|id)=["'][^"']*(?:pagination|pager|page-nav|jsPagination|tp-pagination)[^"']*["'][^>]*>[\s\S]{0,4000}?<\/(?:nav|div|ul|ol)>/gi;
    for (const m of html.matchAll(navRe)) navChunks.push(m[0]);
    const scope = navChunks.length ? navChunks.join('\n') : html;

    const numbered = [];

    // Visible digit labels inside pagination (a/button/span/li).
    for (const m of scope.matchAll(/<(?:a|button|span|li)\b[^>]*>\s*(\d{1,4})\s*<\/(?:a|button|span|li)>/gi)) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > 0 && n < 10_000) numbered.push(n);
    }

    // aria-label="Page 6" / "Go to page 6" ÔÇö exclude next/prev.
    for (const m of scope.matchAll(/aria-label\s*=\s*["']([^"']+)["']/gi)) {
        const label = m[1] || '';
        if (/\b(?:next|prev|previous)\b/i.test(label)) continue;
        const pm = label.match(/\b(?:go\s+to\s+)?page\s+(\d+)\b/i);
        if (pm) {
            const n = parseInt(pm[1], 10);
            if (Number.isFinite(n) && n > 0 && n < 10_000) numbered.push(n);
        }
    }

    // Anchors with ?page=N: count only when the control is a numbered page, not next/prev.
    for (const m of scope.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attrs = m[1] || '';
        const text = tpStripTags(m[2]);
        const hrefPage = attrs.match(/[?&]page=(\d+)/i);
        if (!hrefPage) continue;
        const pageNum = parseInt(hrefPage[1], 10);
        if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum >= 10_000) continue;
        if (tpIsTeePublicPaginationNavControl(attrs, text)) continue;
        if (/^\d{1,4}$/.test(text)) {
            numbered.push(parseInt(text, 10));
            continue;
        }
        // Non-digit label but not a nav control (rare) ÔÇö trust href only if aria says Page N.
        if (/aria-label\s*=\s*["'][^"']*\bpage\s+\d+/i.test(attrs)) {
            numbered.push(pageNum);
        }
    }

    if (!numbered.length) return null;
    return Math.max(...numbered);
}

/**
 * Actual TeePublic result pagination max page when detectable.
 * Prefer "page X of Y" text; fall back to visible numbered pagination (not next-arrow href).
 */
function tpExtractTeePublicMaxPage(html) {
    const fromText = tpExtractTeePublicPageOfCount(html);
    if (fromText != null) return fromText;
    return tpExtractTeePublicMaxPageFromLinks(html);
}

/**
 * Canonical TeePublic saturation buckets (page-count SSOT ÔÇö matches EmailCore / UI legend):
 *   Ôëñ3 pages ÔåÆ excel, 4ÔÇô6 ÔåÆ med, ÔëÑ7 ÔåÆ sat. Null/unparseable ÔåÆ caller returns emp.
 */
function tpClassifyFromPageCount(pageCount) {
    if (pageCount == null || !Number.isFinite(pageCount) || pageCount < 0) return null;
    if (pageCount <= 3) return 'excel';
    if (pageCount <= 6) return 'med';
    return 'sat';
}

function tpClassifyFromResultCount(total) {
    if (total == null || !Number.isFinite(total) || total < 0) return null;
    if (total === 0) return 'excel';
    const approxPages = Math.max(1, Math.ceil(total / TP_DESIGNS_PER_PAGE));
    return tpClassifyFromPageCount(approxPages);
}

function tpClassifyFromMaxPage(maxPage) {
    if (maxPage == null || !Number.isFinite(maxPage) || maxPage < 1) return null;
    return tpClassifyFromPageCount(maxPage);
}

/**
 * Resolve TeePublic page count without undercounting a sliding digit window.
 * Callers should pass link-derived max only ÔÇö explicit "Page X of Y" is handled
 * upstream and must not be inflated by result-count math.
 * Never undercount: take the higher of UI max vs ceil(totalResults / perPage).
 */
function tpResolveTeePublicPageCount(maxPage, totalResults, perPage = TP_DESIGNS_PER_PAGE) {
    const fromUi = (maxPage != null && Number.isFinite(maxPage) && maxPage >= 0) ? maxPage : null;
    const pageSize = (Number.isFinite(perPage) && perPage > 0) ? perPage : TP_DESIGNS_PER_PAGE;
    let fromCount = null;
    if (totalResults != null && Number.isFinite(totalResults) && totalResults >= 0) {
        fromCount = totalResults === 0 ? 0 : Math.max(1, Math.ceil(totalResults / pageSize));
    }
    if (fromUi != null && fromCount != null) return Math.max(fromUi, fromCount);
    if (fromCount != null) return fromCount;
    if (fromUi != null) return fromUi;
    return null;
}

function tpEmptyTeePublicAnalysis(status = 'emp') {
    return {
        status,
        pageCount: status === 'excel' ? 0 : null,
        maxPage: status === 'excel' ? 0 : null,
        totalResults: status === 'excel' ? 0 : null,
        source: status === 'excel' ? 'empty' : 'none',
        signals: { fromCount: null, fromPage: null }
    };
}

function tpWithPageQuery(url, page) {
    try {
        const u = new URL(String(url || ''), 'https://www.teepublic.com');
        u.searchParams.set('page', String(page));
        return u.toString();
    } catch {
        const base = String(url || '').replace(/([?&])page=\d+/gi, '$1').replace(/[?&]$/, '');
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}page=${page}`;
    }
}

/** True when a TeePublic search page still has designs (not empty / CF / 404). */
function tpHtmlHasTeePublicResults(html) {
    const text = String(html || '');
    if (!text) return false;
    if (text.includes('id="cf-wrapper"') || text.includes('cf-browser-verification')) return false;
    const lower = text.toLowerCase();
    if (lower.includes('no results found') || text.includes('id="no-results"')) return false;
    if (/data-design-id=["']\d+["']/i.test(text)) return true;
    const total = tpExtractTeePublicTotalResults(text);
    if (total != null && total > 0) return true;
    return /href=["']\/[^"']*design[^"']*["']/i.test(text);
}

async function tpFetchTeePublicHtml(url) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    if (!response.ok) return { ok: false, status: response.status, html: '' };
    return { ok: true, status: response.status, html: await response.text() };
}

/**
 * When resolved page count is stuck at 7 (sliding digit window), probe ?page=8ÔÇª15
 * until empty/404; return last page that still has results (cap 15).
 */
async function tpProbeTeePublicPagesBeyond(baseUrl, confirmedPage = 7, maxPage = TP_PAGE_PROBE_MAX) {
    let lastGood = Number.isFinite(confirmedPage) ? confirmedPage : 7;
    const start = Math.max(TP_PAGE_PROBE_START, lastGood + 1);
    const cap = Math.min(TP_PAGE_PROBE_MAX, Number(maxPage) || TP_PAGE_PROBE_MAX);
    for (let page = start; page <= cap; page += 1) {
        try {
            const { ok, html } = await tpFetchTeePublicHtml(tpWithPageQuery(baseUrl, page));
            if (!ok || !tpHtmlHasTeePublicResults(html)) break;
            lastGood = page;
            await delay(100);
        } catch (_e) {
            break;
        }
    }
    return lastGood;
}

async function fetchAndAnalyzeTeePublicDetailed(url) {
    try {
        const { ok, html } = await tpFetchTeePublicHtml(url);
        if (!ok) return tpEmptyTeePublicAnalysis('emp');

        if (html.includes('id="cf-wrapper"') || html.includes('cf-browser-verification')) {
            return tpEmptyTeePublicAnalysis('emp');
        }
        if (html.toLowerCase().includes('no results found') || html.includes('id="no-results"')) {
            return tpEmptyTeePublicAnalysis('excel');
        }

        const totalResults = tpExtractTeePublicTotalResults(html);
        const resultsPerPage = tpExtractTeePublicResultsPerPage(html) || TP_DESIGNS_PER_PAGE;
        const fromText = tpExtractTeePublicPageOfCount(html);
        const fromLinks = fromText == null ? tpExtractTeePublicMaxPageFromLinks(html) : null;
        const uiMaxPage = fromText != null ? fromText : fromLinks;
        // Prefer max(UI, ceil(total/perPage)) ÔÇö never undercount sliding windows.
        let pageCount = tpResolveTeePublicPageCount(uiMaxPage, totalResults, resultsPerPage);
        let source = 'none';
        if (fromText != null && totalResults != null) source = 'pageOf+resultCount';
        else if (fromText != null) source = 'pageOf';
        else if (fromLinks != null && totalResults != null) source = 'maxPage+resultCount';
        else if (fromLinks != null) source = 'maxPage';
        else if (totalResults != null) source = 'resultCount';

        // Stuck-at-7: TeePublic digit window often ends at 7 ÔÇö probe 8ÔåÆ15.
        if (pageCount === 7) {
            const probed = await tpProbeTeePublicPagesBeyond(url, 7, TP_PAGE_PROBE_MAX);
            if (probed > 7) {
                pageCount = probed;
                source = `${source}+pageProbe`;
            }
        }

        const maxPage = pageCount;
        const fromCount = tpClassifyFromResultCount(totalResults);
        const fromPage = tpClassifyFromMaxPage(uiMaxPage);
        const status = tpClassifyFromPageCount(pageCount) || 'emp';
        return {
            status,
            pageCount,
            maxPage,
            uiMaxPage,
            totalResults,
            resultsPerPage,
            source,
            signals: { fromCount, fromPage }
        };
    } catch (e) {
        return tpEmptyTeePublicAnalysis('emp');
    }
}

async function fetchAndAnalyzeTeePublic(url) {
    return (await fetchAndAnalyzeTeePublicDetailed(url)).status;
}

function getStorage(k) { return new Promise(r => chrome.storage.local.get(k, r)); }
function setStorage(d) { return new Promise(r => chrome.storage.local.set(d, r)); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- TMHUNT PRO BATCH ENGINE (Stable Simplified Version) ---
//  TMHUNT PRO BATCH ENGINE (Stable Simplified Version)

async function resetTMHSearchProcess() {
    const data = await chrome.storage.local.get(['tmh_previewWindowId']);
    if (data.tmh_previewWindowId) chrome.tabs.remove(data.tmh_previewWindowId, () => chrome.runtime.lastError);
    await chrome.storage.local.set({ tmh_searchStatus: 'IDLE', tmh_safeNiches: [], tmh_restrictedNiches: [], tmh_processedCount: 0, tmh_totalNiches: 0, tmh_previewWindowId: null });
}
async function handleTMHTogglePause() {
    const data = await chrome.storage.local.get(['tmh_searchStatus']);
    const newStatus = data.tmh_searchStatus === 'PAUSED' ? 'RUNNING' : 'PAUSED';
    await chrome.storage.local.set({ tmh_searchStatus: newStatus });
}
async function toggleTMHPreviewWindow() {
    chrome.storage.local.get(['tmh_previewWindowId'], (data) => {
        if (!data.tmh_previewWindowId) return;
        chrome.tabs.update(data.tmh_previewWindowId, { active: false }, () => chrome.runtime.lastError);
    });
}
async function startTMHSearchProcess(niches) {
    const currentData = await chrome.storage.local.get(['tmh_searchStatus', 'tmh_previewWindowId']);
    if (currentData.tmh_searchStatus === 'RUNNING' && currentData.tmh_previewWindowId) { return; }

    const historyData = await chrome.storage.local.get([NHP_TMH_HISTORY_KEY]);
    const tmhHistory = sanitizeTmhHistory(historyData[NHP_TMH_HISTORY_KEY] || {});
    const split = splitNichesByHistory(niches, tmhHistory, ['safe', 'restricted']);
    const pendingNiches = split.pending;
    const rememberedSafe = split.buckets.safe || [];
    const rememberedRestricted = split.buckets.restricted || [];
    const totalNiches = split.totalUnique;

    await chrome.storage.local.set({
        tmh_searchStatus: pendingNiches.length > 0 ? 'RUNNING' : 'IDLE',
        tmh_totalNiches: totalNiches,
        tmh_processedCount: rememberedSafe.length + rememberedRestricted.length,
        tmh_safeNiches: rememberedSafe,
        tmh_restrictedNiches: rememberedRestricted,
        tmh_previewWindowId: null,
        [NHP_TMH_HISTORY_KEY]: tmhHistory
    });

    if (pendingNiches.length === 0) {
        await recordArchiveStage([
            ...rememberedSafe.map((text) => ({ text, status: 'safe' })),
            ...rememberedRestricted.map((text) => ({ text, status: 'restricted' }))
        ], 'tmhunt', 'tmhunt_cache');
        return;
    }

    const tab = await chrome.tabs.create({ url: 'http://tmhunt.com/#ngrams', active: false });
    const tabId = tab?.id;
    await chrome.storage.local.set({ tmh_previewWindowId: tabId || null });
    if (!tabId) {
        await chrome.storage.local.set({ tmh_searchStatus: 'IDLE' });
        return;
    }

    // 3. Wait for content script to be ready (Robust wait)
    let ready = false;
    for (let j = 0; j < 10; j++) {
        try {
            await chrome.tabs.sendMessage(tabId, { action: 'PING' });
            ready = true;
            break;
        } catch (e) { await delay(1000); }
    }

    if (!ready) {
        console.error("[TMH] Content script not responding.");
        await chrome.storage.local.set({ tmh_searchStatus: 'IDLE' });
        return;
    }

    // 4. Batch Loop
    const chunkSize = 10;
    let allSafe = [...rememberedSafe], allRestricted = [...rememberedRestricted];
    for (let i = 0; i < pendingNiches.length; i += chunkSize) {
        while (true) {
            const statusData = await chrome.storage.local.get(['tmh_searchStatus']);
            if (statusData.tmh_searchStatus === 'RUNNING') break;
            if (statusData.tmh_searchStatus === 'IDLE') return;
            await delay(1000);
        }
        const chunk = pendingNiches.slice(i, i + chunkSize);
        try {
            const results = await chrome.tabs.sendMessage(tabId, { action: 'PERFORM_SEARCH', niches: chunk });
            if (results && !results.error) {
                allSafe.push(...results.safe);
                allRestricted.push(...results.restricted);
                results.safe.forEach((niche) => {
                    const key = normalizeNicheKey(niche);
                    if (key) tmhHistory[key] = 'safe';
                });
                results.restricted.forEach((niche) => {
                    const key = normalizeNicheKey(niche);
                    if (key) tmhHistory[key] = 'restricted';
                });
                await chrome.storage.local.set({
                    tmh_processedCount: rememberedSafe.length + rememberedRestricted.length + i + chunk.length,
                    tmh_safeNiches: [...allSafe],
                    tmh_restrictedNiches: [...allRestricted],
                    [NHP_TMH_HISTORY_KEY]: tmhHistory
                });
            }
        } catch (e) { console.error("[TMH] Message failed", e); break; }
    }

    // Cleanup: Close the temporary TMH tab.
    try { if (tabId) await chrome.tabs.remove(tabId); } catch (e) { }

    await chrome.storage.local.set({ tmh_searchStatus: 'IDLE', [NHP_TMH_HISTORY_KEY]: tmhHistory });
    await recordArchiveStage([
        ...allSafe.map((text) => ({ text, status: 'safe' })),
        ...allRestricted.map((text) => ({ text, status: 'restricted' }))
    ], 'tmhunt', 'tmhunt_stage');
}

// --- ACTION CLICK HANDLER (For Window/Tab Launch Modes) ---
//  ACTION CLICK HANDLER (For Window/Tab Launch Modes)
// --- Apply launch mode whenever the service worker starts (not only on install/startup) ---
async function applyActionPopupForLaunchMode() {
    const res = await chrome.storage.local.get([
        'uiLaunchMode',
        'nhpDefaultTabModeApplied',
        'nhpTabDefaultRestoredV3',
        'nhpExpandedDefaultV301',
        'nhpExplicitPopupLaunchV301'
    ]);
    let mode = res.uiLaunchMode || 'tab';

    // v30.1: expanded tab is default; only keep small popup if user explicitly chose it in Admin
    if (!res.nhpExpandedDefaultV301) {
        mode = res.nhpExplicitPopupLaunchV301 && mode === 'popup' ? 'popup' : 'tab';
    } else if (!res.nhpDefaultTabModeApplied && mode === 'popup') {
        mode = 'tab';
    }
    if (!res.nhpTabDefaultRestoredV3 && mode !== 'popup') {
        mode = 'tab';
    }

    const patch = {
        uiLaunchMode: mode,
        nhpDefaultTabModeApplied: true,
        nhpTabDefaultRestoredV3: true,
        nhpExpandedDefaultV301: true
    };
    if (!res.uiLaunchMode || !res.nhpDefaultTabModeApplied || !res.nhpTabDefaultRestoredV3 || !res.nhpExpandedDefaultV301) {
        await chrome.storage.local.set(patch);
    }
    const popupPath = mode === 'popup' ? 'popup.html' : 'launcher.html';
    await chrome.action.setPopup({ popup: popupPath });
}

/** Open expanded UI (tab or app window). Used by launcher + onClicked fallback. */
async function openNhpExpandedUi(mode) {
  const targetUrl = chrome.runtime.getURL('popup.html?mode=tab');
  if (mode === 'window') {
    await chrome.windows.create({
      url: targetUrl,
      type: 'popup',
      width: 1280,
      height: 850,
      focused: true
    });
    return;
  }
  await chrome.tabs.create({ url: targetUrl, active: true });
}

chrome.runtime.onInstalled.addListener(() => {
    applyActionPopupForLaunchMode().catch((error) => {
        console.warn('[NHP] launch mode install recovery:', nhpSafeErrorMessage(error));
    });
});

chrome.runtime.onStartup.addListener(() => {
    applyActionPopupForLaunchMode().catch((error) => {
        console.warn('[NHP] launch mode startup recovery:', nhpSafeErrorMessage(error));
    });
});

chrome.action.onClicked.addListener(async () => {
    try {
        const res = await chrome.storage.local.get(['uiLaunchMode']);
        await openNhpExpandedUi(res.uiLaunchMode || 'tab');
    } catch (error) {
        console.warn('[NHP] action click recovered:', nhpSafeErrorMessage(error));
    }
});

// Apply launch mode whenever the service worker starts (not only on install/startup)
applyActionPopupForLaunchMode().catch(() => { });

try {
    importScripts('creaty-upload-scheduler.js');
} catch (e) {
    console.error('Failed to import creaty-upload-scheduler.js', e);
}

try {
    if (typeof NhpSeqUploadGuard !== 'undefined' && typeof startAPProcess === 'function') {
        const _startAPProcessCore = startAPProcess;
        startAPProcess = NhpSeqUploadGuard.wrapStartAPProcessDirect(_startAPProcessCore);
        NhpSeqUploadGuard.sealWhenLocked({
            enqueueStartAPProcess,
            startAPProcess
        }).catch((e) => console.warn('[NHP SeqGuard] seal skipped:', e?.message || e));
    }
} catch (e) {
    console.error('[NHP SeqGuard] init failed', e);
}

void ensureCliProxyLocalServerReady().catch((error) => {
    console.warn('[CLIProxy Local] service-worker auto-start skipped:', error?.message || error);
});
