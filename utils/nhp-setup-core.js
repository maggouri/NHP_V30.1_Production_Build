'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile, spawn } = require('child_process');
const { getPortablePaths } = require('./nhp-portable-paths');

const SETUP_CONFIG = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'nhp-setup-services.json'), 'utf8')
);

const WHITELIST_LAUNCHER_FILES = new Set(
    (SETUP_CONFIG.launcherFiles || []).map((item) => String(item.file || '').toLowerCase())
);
Object.values(SETUP_CONFIG.bulkScripts || {}).forEach((rel) => {
    const base = path.basename(String(rel || '')).toLowerCase();
    if (base) WHITELIST_LAUNCHER_FILES.add(base);
});

const DEFAULT_EXTENSION_ID = 'bhhahkcjolghbigcognobplmgdbkmekb';
const NATIVE_HOST_NAME = 'com.nhp.server_launcher';
const SETUP_LOG_SUBDIR = path.join('logs', 'setup');

function normalizeWinPath(value) {
    return String(value || '').trim().replace(/\//g, '\\').replace(/\\+$/, '');
}

function runProcess(command, args, options = {}) {
    return new Promise((resolve) => {
        execFile(command, args, {
            windowsHide: true,
            timeout: options.timeout || 120000,
            cwd: options.cwd,
            env: options.env || process.env
        }, (error, stdout, stderr) => {
            resolve({
                success: !error,
                code: error && typeof error.code === 'number' ? error.code : 0,
                stdout: String(stdout || ''),
                stderr: String(stderr || ''),
                error: error ? (error.message || String(error)) : null
            });
        });
    });
}

function runCmdScript(scriptPath, args = [], options = {}) {
    const fullPath = path.resolve(scriptPath);
    if (!fs.existsSync(fullPath)) {
        return Promise.resolve({
            success: false,
            code: 1,
            stdout: '',
            stderr: '',
            error: `Script not found: ${fullPath}`
        });
    }
    // Pass script path and args as separate argv entries — no extra quote wrapping
    // (wrapping caused cmd to see \"path\" and fail with "n'est pas reconnu").
    const cmdArgs = ['/d', '/c', fullPath, ...args.map(String)];
    return runProcess(process.env.ComSpec || 'cmd.exe', cmdArgs, options);
}

function findAppRootFromCandidate(candidate) {
    let dir = normalizeWinPath(candidate);
    if (!dir) return '';
    for (let depth = 0; depth < 8; depth += 1) {
        if (fs.existsSync(path.join(dir, 'manifest.json')) || fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return '';
}

function resolveSetupAppRoot(options = {}) {
    const override = normalizeWinPath(options.projectDir || options.appRoot || '');
    const hint = normalizeWinPath(options.appRootHint || override);
    const candidates = [override, hint].filter(Boolean);
    const seen = new Set();
    for (const candidate of candidates) {
        const key = candidate.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const resolved = findAppRootFromCandidate(candidate);
        if (resolved) return resolved;
    }
    const portable = getPortablePaths({ appRootHint: hint || override, skipEnsure: true });
    const portableRoot = findAppRootFromCandidate(portable.appRoot) || portable.appRoot;
    return portableRoot;
}

function getPaths(options = {}) {
    const appRoot = resolveSetupAppRoot(options);
    const portable = getPortablePaths({ appRootHint: appRoot, skipEnsure: options.skipEnsure === true });
    const launcherDir = path.join(portable.appRoot, ...SETUP_CONFIG.launcherDir.split('\\'));
    const setupLogDir = path.join(portable.dataRoot, SETUP_LOG_SUBDIR);
    const setupLogFile = path.join(setupLogDir, 'setup.log');
    return { portable, launcherDir, setupLogDir, setupLogFile };
}

function appendSetupLog(message, options = {}) {
    const { setupLogDir, setupLogFile } = getPaths({ skipEnsure: true, appRootHint: options.appRootHint });
    try {
        if (!fs.existsSync(setupLogDir)) fs.mkdirSync(setupLogDir, { recursive: true });
        const line = `[${new Date().toISOString()}] ${String(message || '').trim()}\n`;
        fs.appendFileSync(setupLogFile, line, 'utf8');
        return { success: true, logFile: setupLogFile };
    } catch (error) {
        return { success: false, error: error.message || String(error) };
    }
}

function detectNode(appRoot) {
    const candidates = [
        { id: 'path', path: 'node', label: 'PATH' },
        { id: 'programfiles', path: path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'), label: 'Program Files' },
        { id: 'programfiles-x86', path: path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'), label: 'Program Files (x86)' },
        { id: 'localappdata', path: path.join(process.env.LocalAppData || '', 'Programs', 'node', 'node.exe'), label: 'LocalAppData' },
        { id: 'portable-runtime', path: path.join(appRoot, 'runtime', 'node', 'node.exe'), label: 'runtime\\node portable' }
    ];
    for (const candidate of candidates) {
        if (candidate.id === 'path') {
            const which = runProcessSync('where', ['node']);
            if (which.success && which.stdout.trim()) {
                const first = which.stdout.split(/\r?\n/).find(Boolean);
                return {
                    found: true,
                    source: candidate.label,
                    path: normalizeWinPath(first),
                    version: readNodeVersion(first)
                };
            }
            continue;
        }
        if (fs.existsSync(candidate.path)) {
            return {
                found: true,
                source: candidate.label,
                path: normalizeWinPath(candidate.path),
                version: readNodeVersion(candidate.path)
            };
        }
    }
    return { found: false, source: null, path: null, version: null };
}

function runProcessSync(command, args) {
    const { execFileSync } = require('child_process');
    try {
        const stdout = execFileSync(command, args, { encoding: 'utf8', windowsHide: true });
        return { success: true, stdout: String(stdout || '') };
    } catch (error) {
        return { success: false, stdout: '', error: error.message || String(error) };
    }
}

function readNodeVersion(nodePath) {
    try {
        const out = runProcessSync(nodePath, ['--version']);
        return out.success ? out.stdout.trim() : null;
    } catch (_) {
        return null;
    }
}

function detectChrome() {
    const candidates = [
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LocalAppData || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return { found: true, path: normalizeWinPath(candidate) };
        }
    }
    return { found: false, path: null };
}

function parseRegistryDefaultValue(regOutput) {
    const lines = String(regOutput || '').split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/REG_SZ\s+(.+?)\s*$/i);
        if (match) return normalizeWinPath(match[1].trim());
    }
    return null;
}

function readNativeRegistryStatus(appRoot) {
    const registryKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
    const query = runProcessSync('reg', ['query', registryKey, '/ve']);
    if (!query.success) {
        return {
            registered: false,
            stale: false,
            manifestPath: null,
            hostPath: null,
            allowedOrigin: null,
            error: 'Registry key not found'
        };
    }
    const manifestPath = parseRegistryDefaultValue(query.stdout);
    if (!manifestPath || !fs.existsSync(manifestPath)) {
        return {
            registered: false,
            stale: true,
            manifestPath,
            hostPath: null,
            allowedOrigin: null,
            error: 'Registry points to missing manifest'
        };
    }
    let manifest = null;
    try {
        const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
        manifest = JSON.parse(raw);
    } catch (error) {
        return {
            registered: false,
            stale: true,
            manifestPath,
            hostPath: null,
            allowedOrigin: null,
            error: `Invalid manifest JSON: ${error.message}`
        };
    }
    const hostPath = normalizeWinPath(manifest.path || '');
    const registryAppRoot = hostPath
        ? normalizeWinPath(path.dirname(path.dirname(hostPath)))
        : '';
    const compareRoot = findAppRootFromCandidate(appRoot) || registryAppRoot || appRoot;
    const expectedHostScript = normalizeWinPath(path.join(compareRoot, 'native-host', 'nhp_native_host.js'));
    const expectedHostCmd = normalizeWinPath(path.join(compareRoot, 'native-host', 'nhp_native_host.cmd'));
    const hostScriptExists = fs.existsSync(expectedHostScript);
    const hostCmdExists = fs.existsSync(expectedHostCmd);
    const hostPathLower = hostPath.toLowerCase();
    const compareRootLower = normalizeWinPath(compareRoot).toLowerCase();
    const registryRootLower = normalizeWinPath(registryAppRoot).toLowerCase();
    const hostMatchesRoot = !!hostPathLower
        && (hostPathLower.includes(compareRootLower)
            || (!!registryRootLower && hostPathLower.includes(registryRootLower)));
    const stale = !hostPath
        || !hostMatchesRoot
        || (hostPathLower.endsWith('.cmd') && !fs.existsSync(hostPath))
        || (hostPathLower.endsWith('.js') && !fs.existsSync(hostPath));
    return {
        registered: true,
        stale,
        manifestPath,
        hostPath,
        hostScriptExists,
        hostCmdExists,
        allowedOrigins: Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [],
        error: stale ? 'Native host path is stale or points outside app root' : null
    };
}

function pingPort(port) {
    return new Promise((resolve) => {
        const numericPort = Number(port) || 0;
        if (!numericPort) {
            resolve(false);
            return;
        }
        if (numericPort === 8317) {
            const req = http.get({
                hostname: '127.0.0.1',
                port: numericPort,
                path: '/v1/models',
                headers: { Authorization: 'Bearer nhp-local-cliproxy-key' },
                timeout: 2500
            }, (res) => {
                res.resume();
                resolve(res.statusCode >= 200 && res.statusCode < 500);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            return;
        }
        const req = http.get({
            hostname: '127.0.0.1',
            port: numericPort,
            path: '/ping',
            timeout: 2500
        }, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 300);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function getServicesStatus(appRoot) {
    const services = [...(SETUP_CONFIG.services || [])].sort((a, b) => (a.startOrder || 0) - (b.startOrder || 0));
    const rows = [];
    for (const svc of services) {
        rows.push({
            ...svc,
            online: await pingPort(svc.port)
        });
    }
    return rows;
}

function resolveWhitelistedLauncher(appRoot, launcherName) {
    const base = path.basename(String(launcherName || '').trim());
    if (!base || !WHITELIST_LAUNCHER_FILES.has(base.toLowerCase())) {
        throw new Error(`Launcher not whitelisted: ${base || launcherName}`);
    }
    const launcherDir = path.join(appRoot, ...SETUP_CONFIG.launcherDir.split('\\'));
    const fullPath = path.join(launcherDir, base);
    const normalizedLauncherDir = normalizeWinPath(launcherDir).toLowerCase();
    const normalizedFull = normalizeWinPath(fullPath).toLowerCase();
    if (!normalizedFull.startsWith(normalizedLauncherDir)) {
        throw new Error('Resolved launcher path escapes launcher directory');
    }
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Launcher file missing: ${fullPath}`);
    }
    return fullPath;
}

async function runWhitelistedLauncher(appRoot, launcherName, args = [], options = {}) {
    const scriptPath = resolveWhitelistedLauncher(appRoot, launcherName);
    appendSetupLog(`RUN ${path.basename(scriptPath)} ${args.join(' ')}`.trim(), { appRootHint: appRoot });
    const result = await runCmdScript(scriptPath, args, {
        cwd: appRoot,
        timeout: options.timeout || 300000,
        env: {
            ...process.env,
            NHP_APP_ROOT: appRoot,
            NHP_ROOT: appRoot,
            NHP_ROOT_DIR: appRoot
        }
    });
    appendSetupLog(
        `RESULT ${path.basename(scriptPath)} success=${result.success} code=${result.code} ${result.error || ''}`.trim(),
        { appRootHint: appRoot }
    );
    return { ...result, scriptPath };
}

async function initNhpData(options = {}) {
    const { portable } = getPaths(options);
    const appRoot = portable.appRoot;
    appendSetupLog('INIT NHP_DATA via portable paths', { appRootHint: appRoot });

    const setEnvScript = path.join(appRoot, 'utils', '_NHP_Set_Data_Env.cmd');
    if (!fs.existsSync(setEnvScript)) {
        return { success: false, error: `Missing ${setEnvScript}` };
    }
    const envResult = await runCmdScript(setEnvScript, [appRoot], { cwd: appRoot, timeout: 120000 });
    if (!envResult.success) {
        return { success: false, error: envResult.error || envResult.stderr || 'NHP_DATA init failed', details: envResult };
    }

    const portableInit = path.join(appRoot, 'addon', '_shared', '_NHP_Portable_Init.cmd');
    if (fs.existsSync(portableInit)) {
        const initResult = await runCmdScript(portableInit, [], { cwd: appRoot, timeout: 600000 });
        if (!initResult.success) {
            return { success: false, error: initResult.error || initResult.stderr || 'Portable init failed', details: initResult };
        }
    } else {
        portable.ensureDataRoot();
    }

    const dataExists = fs.existsSync(portable.dataRoot);
    return {
        success: dataExists,
        appRoot,
        dataRoot: portable.dataRoot,
        created: dataExists,
        error: dataExists ? null : 'NHP_DATA folder still missing after init'
    };
}

async function registerNativeMessaging(extensionId, options = {}) {
    const { portable } = getPaths(options);
    const appRoot = portable.appRoot;
    const extId = String(extensionId || DEFAULT_EXTENSION_ID).trim() || DEFAULT_EXTENSION_ID;
    appendSetupLog(`REGISTER_NATIVE extensionId=${extId} appRoot=${appRoot}`, { appRootHint: appRoot });

    const ps1Script = path.join(appRoot, 'addon', 'launcher', 'internal', 'setup-native-messaging.ps1');
    let result;
    if (fs.existsSync(ps1Script)) {
        result = await runProcess('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            ps1Script,
            '-ProjectDir',
            appRoot,
            '-ExtensionId',
            extId
        ], { cwd: appRoot, timeout: 120000 });
    } else {
        result = await runWhitelistedLauncher(appRoot, 'REGISTER_NATIVE.cmd', [extId], { timeout: 120000 });
    }

    const registry = readNativeRegistryStatus(appRoot);
    const verified = registry.registered && !registry.stale;
    appendSetupLog(
        `REGISTER_NATIVE verified=${verified} manifest=${registry.manifestPath || 'none'} host=${registry.hostPath || 'none'}`,
        { appRootHint: appRoot }
    );
    return {
        ...result,
        success: result.success && verified,
        registry,
        verified,
        appRoot: normalizeWinPath(appRoot),
        error: verified ? null : (result.error || registry.error || 'Native registry still stale after registration'),
        uacNote: 'Registration writes HKCU registry — no UAC required for current user.'
    };
}

function getLauncherFilesMeta(appRoot) {
    const launcherDir = path.join(appRoot, ...SETUP_CONFIG.launcherDir.split('\\'));
    return (SETUP_CONFIG.launcherFiles || []).map((item) => {
        const fullPath = path.join(launcherDir, item.file);
        let exists = false;
        let mtime = null;
        try {
            if (fs.existsSync(fullPath)) {
                exists = true;
                mtime = fs.statSync(fullPath).mtime.toISOString();
            }
        } catch (_) { /* ignore */ }
        return {
            ...item,
            path: normalizeWinPath(fullPath),
            exists,
            mtime
        };
    });
}

function computeOverallState(snapshot) {
    if (!snapshot.node.found) return 'node_missing';
    if (!snapshot.dataRoot.exists) return 'nhp_data_missing';
    if (!snapshot.native.registered) return 'native_unregistered';
    if (snapshot.native.stale) return 'native_stale';
    const onlineCount = (snapshot.services || []).filter((s) => s.online).length;
    const total = (snapshot.services || []).length;
    if (onlineCount === 0) return 'services_down';
    if (onlineCount < total) return 'partial';
    return 'ready';
}

async function getSetupStatus(options = {}) {
    const { portable, setupLogFile, launcherDir } = getPaths({ appRootHint: options.appRootHint, skipEnsure: true });
    const appRoot = portable.appRoot;
    const dataRoot = portable.dataRoot;
    const dataExists = fs.existsSync(dataRoot);
    const node = detectNode(appRoot);
    const chrome = detectChrome();
    const native = readNativeRegistryStatus(appRoot);
    const services = await getServicesStatus(appRoot);
    const launcherFiles = getLauncherFilesMeta(appRoot);
    const snapshot = {
        success: true,
        timestamp: new Date().toISOString(),
        appRoot: normalizeWinPath(appRoot),
        dataRoot: normalizeWinPath(dataRoot),
        dataRootExists: dataExists,
        node,
        chrome,
        native,
        services,
        launcherDir: normalizeWinPath(launcherDir),
        launcherFiles,
        setupLogFile: normalizeWinPath(setupLogFile),
        bulkScripts: SETUP_CONFIG.bulkScripts,
        downloads: SETUP_CONFIG.downloads || {},
        extensionIdDefault: DEFAULT_EXTENSION_ID
    };
    snapshot.overallState = computeOverallState({
        node,
        dataRoot: { exists: dataExists },
        native,
        services
    });
    snapshot.overallStateLabel = {
        ready: { en: 'Ready', ar: 'جاهز' },
        needs_setup: { en: 'Needs setup', ar: 'يحتاج تهيئة' },
        node_missing: { en: 'Node.js missing', ar: 'Node.js غير موجود' },
        native_unregistered: { en: 'Native Messaging not registered', ar: 'Native Messaging غير مسجّل' },
        native_stale: { en: 'Native path stale', ar: 'مسار Native قديم' },
        services_down: { en: 'Services offline', ar: 'السيرفرات متوقفة' },
        nhp_data_missing: { en: 'NHP_DATA missing', ar: 'NHP_DATA غير موجود' },
        partial: { en: 'Partially ready', ar: 'جاهز جزئياً' }
    }[snapshot.overallState] || { en: snapshot.overallState, ar: snapshot.overallState };
    return snapshot;
}

async function firstRunBootstrap(extensionId, options = {}) {
    const report = [];
    const logStep = (step, ok, detail) => {
        report.push({ step, ok, detail, at: new Date().toISOString() });
        appendSetupLog(`${ok ? 'OK' : 'FAIL'} first-run:${step} — ${detail}`, { appRootHint: options.appRootHint });
    };

    const statusBefore = await getSetupStatus(options);
    if (!statusBefore.node.found) {
        logStep('node', false, 'Node.js required');
        return { success: false, blocked: true, reason: 'node_missing', report, status: statusBefore };
    }
    logStep('node', true, statusBefore.node.path || 'found');

    const initResult = await initNhpData(options);
    logStep('init-data', initResult.success, initResult.error || initResult.dataRoot || 'ok');
    if (!initResult.success) {
        return { success: false, report, status: await getSetupStatus(options), initResult };
    }

    const regResult = await registerNativeMessaging(extensionId, options);
    logStep('register-native', regResult.verified === true, regResult.error || regResult.registry?.error || 'ok');

    const startResult = await runWhitelistedLauncher(statusBefore.appRoot, 'START_ALL.cmd', [], { timeout: 300000 });
    logStep('start-all', startResult.success, startResult.error || 'launched');

    await new Promise((r) => setTimeout(r, 5000));
    const statusAfter = await getSetupStatus(options);
    const online = (statusAfter.services || []).filter((s) => s.online).length;
    logStep('port-check', online > 0, `${online}/${(statusAfter.services || []).length} online`);

    return {
        success: regResult.verified !== false && initResult.success,
        report,
        status: statusAfter,
        startResult,
        registerResult: regResult,
        initResult
    };
}

module.exports = {
    SETUP_CONFIG,
    WHITELIST_LAUNCHER_FILES,
    getSetupStatus,
    initNhpData,
    registerNativeMessaging,
    runWhitelistedLauncher,
    firstRunBootstrap,
    getLauncherFilesMeta,
    appendSetupLog,
    detectNode,
    readNativeRegistryStatus,
    getServicesStatus
};
