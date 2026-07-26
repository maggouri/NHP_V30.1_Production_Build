/**
 * NHP Setup API — status, first-run, native registration, launcher helpers.
 * Loaded in service worker via importScripts; consumed by admin setup wizard + overview.
 */
(function (global) {
    'use strict';

    const NATIVE_HOST = 'com.nhp.server_launcher';
    const SETUP_COMPLETE_STORAGE_KEY = 'nhpSetupComplete';
    const REGISTRY_PS = "(Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.nhp.server_launcher' -ErrorAction SilentlyContinue).'(default)'";

    const LAUNCHER_FILE_DEFS = Object.freeze([
        { file: 'FIRST_RUN.cmd', labelAr: 'التشغيل الأول', labelEn: 'First Run' },
        { file: 'NHP_Start_All_Servers_SilentCore.cmd', labelAr: 'تشغيل الكل', labelEn: 'Start All' },
        { file: 'NHP_Stop_All_Servers_SilentCore.cmd', labelAr: 'إيقاف الكل', labelEn: 'Stop All' },
        { file: 'NHP_Restart_All_Servers_SilentCore.cmd', labelAr: 'إعادة التشغيل', labelEn: 'Restart All' },
        { file: 'NHP_Check_Server_Ports.cmd', labelAr: 'فحص المنافذ', labelEn: 'Check Ports' },
        { file: 'CHECK_PORTS.cmd', labelAr: 'فحص المنافذ (cmd)', labelEn: 'Check Ports (cmd)' }
    ]);

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

    function pathsEqual(a, b) {
        return normalizeWinPath(a).toLowerCase() === normalizeWinPath(b).toLowerCase();
    }

    async function runNativeCommand(command) {
        if (typeof chrome?.runtime?.sendNativeMessage !== 'function') {
            return { success: false, error: 'nativeMessaging unavailable' };
        }
        try {
            return await chrome.runtime.sendNativeMessage(NATIVE_HOST, {
                action: 'execute_command',
                command: String(command || '')
            });
        } catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }

    async function sendNativeHostAction(action, payload = {}) {
        if (typeof chrome?.runtime?.sendNativeMessage !== 'function') {
            return { success: false, error: 'nativeMessaging unavailable' };
        }
        try {
            return await chrome.runtime.sendNativeMessage(NATIVE_HOST, { action, ...payload });
        } catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }

    function detectChromeInExtensionContext() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                return {
                    found: true,
                    verified: true,
                    source: 'extension_runtime',
                    version: null
                };
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    const NODE_DETECT_PS = [
        '$candidates = @(',
        "(Join-Path $env:ProgramFiles 'nodejs\\node.exe'),",
        "(Join-Path ${env:ProgramFiles(x86)} 'nodejs\\node.exe'),",
        "(Join-Path $env:LOCALAPPDATA 'Programs\\nodejs\\node.exe'),",
        "(Join-Path $env:LOCALAPPDATA 'Programs\\node\\node.exe')",
        ');',
        'foreach ($candidate in $candidates) {',
        '  if (Test-Path -LiteralPath $candidate) {',
        '    & $candidate --version;',
        '    exit 0',
        '  }',
        '}',
        'try {',
        '  $whereOutput = & where.exe node 2>$null;',
        '  if ($whereOutput) {',
        '    foreach ($line in @($whereOutput)) {',
        '      $candidate = [string]$line;',
        '      if ([string]::IsNullOrWhiteSpace($candidate)) { continue }',
        '      if (Test-Path -LiteralPath $candidate) {',
        '        & $candidate --version;',
        '        exit 0',
        '      }',
        '    }',
        '  }',
        '} catch { }',
        '$cmd = Get-Command node -ErrorAction SilentlyContinue;',
        'if ($cmd -and $cmd.Source) {',
        '  & $cmd.Source --version;',
        '  exit 0',
        '}',
        "'missing'"
    ].join(' ');

    const CHROME_DETECT_PS = [
        '$paths = @(',
        "(Join-Path $env:ProgramFiles 'Google\\Chrome\\Application\\chrome.exe'),",
        "(Join-Path ${env:ProgramFiles(x86)} 'Google\\Chrome\\Application\\chrome.exe'),",
        "(Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe')",
        ');',
        'foreach ($p in $paths) {',
        '  if (Test-Path -LiteralPath $p) {',
        '    (Get-Item -LiteralPath $p).VersionInfo.ProductVersion;',
        '    exit 0',
        '  }',
        '}',
        "'missing'"
    ].join(' ');

    async function detectNodeViaNativeHost() {
        const result = await sendNativeHostAction('detect_prerequisites');
        if (result?.success === true && result?.node) {
            return {
                found: result.node.found === true,
                version: result.node.version || null,
                path: result.node.path || null,
                source: result.node.source || 'native_host',
                verified: true
            };
        }
        return null;
    }

    async function detectNodeAvailable() {
        const viaHost = await detectNodeViaNativeHost();
        if (viaHost) return viaHost;

        const result = await runNativeCommand(NODE_DETECT_PS);
        const stdout = String(result?.stdout || '').trim();
        if (result?.success && stdout && !/^missing$/i.test(stdout)) {
            return {
                found: true,
                version: stdout,
                source: 'powershell',
                verified: true
            };
        }
        return {
            found: false,
            version: null,
            source: null,
            verified: result?.success === true
        };
    }

    async function detectChromeAvailable() {
        const inExtension = detectChromeInExtensionContext();
        if (inExtension?.found) return inExtension;

        const viaHost = await sendNativeHostAction('detect_prerequisites');
        if (viaHost?.success === true && viaHost?.chrome?.found) {
            return {
                found: true,
                version: null,
                path: viaHost.chrome.path || null,
                source: viaHost.chrome.source || 'native_host',
                verified: true
            };
        }

        const result = await runNativeCommand(CHROME_DETECT_PS);
        const stdout = String(result?.stdout || '').trim();
        if (result?.success && stdout && !/^missing$/i.test(stdout)) {
            return {
                found: true,
                version: stdout,
                source: 'powershell',
                verified: true
            };
        }

        return {
            found: false,
            version: null,
            source: null,
            verified: result?.success === true
        };
    }

    function applyNodeOfflineFallback(node, nativeHost) {
        if (node?.found) return node;
        if (node?.verified === true) return node;

        const kind = nativeHost?.errorKind || null;
        const needsNativeRegister = kind === 'not_registered' || kind === 'permission_missing';
        const blockedByNative = needsNativeRegister || kind === 'host_error' || kind === 'host_outdated';

        if (!blockedByNative) return node;

        return {
            ...node,
            verified: false,
            pendingVerification: true,
            needsNativeRegister,
            hint: needsNativeRegister
                ? 'Node.js قد يكون مثبتاً — سجّل Native Messaging ثم حدّث الحالة.'
                : 'Node.js: أعد تسجيل Native Messaging ثم حدّث الحالة.'
        };
    }

    function isNodeRequirementMet(node) {
        if (node?.found === true) return true;
        if (node?.pendingVerification === true) return true;
        return false;
    }

    async function pingNativeHost() {
        if (typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.sendNativeHostMessage) {
            try {
                return await NhpPortablePaths.sendNativeHostMessage({ action: 'ping' });
            } catch (error) {
                return { success: false, error: error?.message || String(error) };
            }
        }
        return { success: false, error: 'NhpPortablePaths unavailable' };
    }

    async function testPathExists(targetPath) {
        const path = normalizeWinPath(targetPath);
        if (!path) return false;
        const escaped = path.replace(/'/g, "''");
        const result = await runNativeCommand(`if (Test-Path -LiteralPath '${escaped}') { '1' } else { '0' }`);
        return result?.success === true && String(result.stdout || '').trim() === '1';
    }

    async function inspectNativeRegistry(appRoot) {
        const manifestPath = '';
        const base = {
            registered: false,
            stale: false,
            manifestPath: '',
            error: null,
            registryPath: null
        };
        const result = await runNativeCommand(REGISTRY_PS);
        if (!result?.success) return base;
        const regManifest = String(result.stdout || '').trim();
        if (!regManifest) return base;
        base.registered = true;
        base.registryPath = regManifest;
        base.manifestPath = regManifest;
        if (appRoot) {
            const expectedLauncher = joinWinPath(appRoot, 'native-host', 'nhp_native_host.cmd');
            const expectedManifest = joinWinPath(appRoot, 'native-host', 'com.nhp.server_launcher.json');
            const matchesRoot = [regManifest, regManifest.replace(/com\.nhp\.server_launcher\.json$/i, 'nhp_native_host.cmd')]
                .some((candidate) => {
                    const dir = normalizeWinPath(candidate).replace(/\\[^\\]+$/, '');
                    return pathsEqual(dir, joinWinPath(appRoot, 'native-host')) || pathsEqual(candidate, expectedLauncher) || pathsEqual(candidate, expectedManifest);
                });
            base.stale = !matchesRoot;
            if (base.stale) {
                base.error = 'Native Messaging مسجّل لمسار قديم — أعد التسجيل من المجلد الحالي.';
            }
        }
        return base;
    }

    async function resolveNativeHostStatus(forceRefresh) {
        if (typeof NhpPortablePaths === 'undefined') {
            return { ok: false, error: 'NhpPortablePaths unavailable', errorKind: 'host_error', checkedAt: Date.now(), projectDir: null };
        }
        if (forceRefresh && NhpPortablePaths.invalidateCache) NhpPortablePaths.invalidateCache();
        if (forceRefresh && NhpPortablePaths.verifyNativeHostConnection) {
            return NhpPortablePaths.verifyNativeHostConnection({ silent: true });
        }
        if (NhpPortablePaths.ensureNativeHostReady) {
            return NhpPortablePaths.ensureNativeHostReady({ silent: true });
        }
        return { ok: false, error: 'Native host helper unavailable', errorKind: 'host_error', checkedAt: Date.now(), projectDir: null };
    }

    async function buildSetupStatusSnapshot(deps, options = {}) {
        const forceRefresh = options.forceRefresh === true;
        const checkedAt = new Date().toISOString();

        if (forceRefresh && typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.invalidateCache) {
            NhpPortablePaths.invalidateCache();
        }

        const nativeHost = await resolveNativeHostStatus(forceRefresh);
        const ping = nativeHost.ok ? await pingNativeHost() : null;

        let appRoot = normalizeWinPath(await deps.ensureNhpProjectDirResolved(forceRefresh));
        if (!appRoot && nativeHost.projectDir) appRoot = normalizeWinPath(nativeHost.projectDir);
        if (!appRoot && ping?.projectDir) appRoot = normalizeWinPath(ping.projectDir);

        let dataRoot = normalizeWinPath(ping?.dataRoot || '');
        if (!dataRoot && appRoot && typeof NhpRuntimeConfig !== 'undefined' && NhpRuntimeConfig.dataRootFromProjectDir) {
            dataRoot = normalizeWinPath(NhpRuntimeConfig.dataRootFromProjectDir(appRoot));
        }

        let dataRootExists = false;
        if (dataRoot && nativeHost.ok) {
            dataRootExists = await testPathExists(dataRoot);
        } else if (dataRoot && appRoot) {
            dataRootExists = await testPathExists(dataRoot);
        }

        let native = {
            registered: nativeHost.ok === true,
            stale: false,
            manifestPath: appRoot ? joinWinPath(appRoot, 'native-host', 'com.nhp.server_launcher.json') : '',
            error: nativeHost.error || null
        };

        if (nativeHost.ok && appRoot && nativeHost.projectDir && !pathsEqual(appRoot, nativeHost.projectDir)) {
            native.stale = true;
            native.error = 'Native Messaging يعمل من مسار مختلف — أعد التسجيل.';
        }

        if (!nativeHost.ok) {
            if (nativeHost.errorKind === 'forbidden') {
                native.registered = true;
                native.stale = false;
            } else if (nativeHost.errorKind === 'host_outdated') {
                native.registered = true;
                native.stale = true;
            } else if (nativeHost.errorKind !== 'not_registered' && nativeHost.errorKind !== 'permission_missing') {
                const registry = await inspectNativeRegistry(appRoot);
                native.registered = registry.registered;
                native.stale = registry.stale;
                native.manifestPath = registry.manifestPath || native.manifestPath;
                native.error = nativeHost.error || registry.error || null;
            }
        }

        const chrome = await detectChromeAvailable();
        let node = await detectNodeAvailable();
        node = applyNodeOfflineFallback(node, nativeHost);

        const serversSnapshot = await deps.getNhpLocalServersStatusSnapshot();
        const services = (serversSnapshot?.servers || []).map((svc) => ({
            id: svc.id,
            labelEn: svc.label,
            labelAr: svc.label,
            port: svc.port,
            online: svc.online === true,
            disabled: svc.disabled === true
        }));

        const activeServices = services.filter((svc) => !svc.disabled);
        const onlineServices = activeServices.filter((svc) => svc.online).length;

        let storedComplete = false;
        try {
            const stored = await chrome.storage.local.get([SETUP_COMPLETE_STORAGE_KEY]);
            storedComplete = stored?.[SETUP_COMPLETE_STORAGE_KEY] === true;
        } catch (_) { /* ignore */ }

        if (!dataRootExists && storedComplete && dataRoot) {
            dataRootExists = true;
        }

        const coreReady = chrome.found
            && isNodeRequirementMet(node)
            && node.found === true
            && dataRootExists
            && native.registered
            && !native.stale
            && nativeHost.ok === true;

        const overallState = coreReady ? 'ready' : 'pending';
        const deviceReady = coreReady || storedComplete;
        const firstRunComplete = storedComplete || coreReady;

        return {
            success: true,
            checkedAt,
            appRoot: appRoot || '',
            dataRoot: dataRoot || '',
            dataRootExists,
            chrome,
            node,
            native,
            nativeHost,
            deviceReady,
            firstRunComplete,
            overallState,
            services,
            servicesOnline: onlineServices,
            servicesTotal: activeServices.length,
            setupLogFile: appRoot ? resolveSetupLogFile(appRoot) : 'NHP_DATA\\logs\\setup\\setup.log',
            launcherDir: appRoot ? joinWinPath(appRoot, 'addon') : '',
            downloads: {
                chrome: 'https://www.google.com/chrome/',
                node: 'https://nodejs.org/'
            }
        };
    }

    async function listLauncherFiles(appRoot) {
        const root = normalizeWinPath(appRoot);
        const searchDirs = [
            root ? joinWinPath(root, 'addon') : '',
            root ? joinWinPath(root, 'addon', '01_Start_All') : '',
            root ? joinWinPath(root, 'addon', '_shared') : '',
            root || ''
        ].filter(Boolean);

        const files = [];
        for (const def of LAUNCHER_FILE_DEFS) {
            let resolvedPath = '';
            let exists = false;
            for (const dir of searchDirs) {
                const candidate = joinWinPath(dir, def.file);
                if (!resolvedPath) resolvedPath = candidate;
                if (root && await testPathExists(candidate)) {
                    resolvedPath = candidate;
                    exists = true;
                    break;
                }
            }
            files.push({
                file: def.file,
                labelAr: def.labelAr,
                labelEn: def.labelEn,
                path: resolvedPath,
                exists
            });
        }
        return files;
    }

    function resolveSetupLogFile(appRoot) {
        return typeof NhpRuntimeConfig !== 'undefined' && NhpRuntimeConfig.joinDataPath
            ? NhpRuntimeConfig.joinDataPath(appRoot, 'logs', 'setup', 'setup.log')
            : joinWinPath(appRoot, '..', 'NHP_DATA', 'logs', 'setup', 'setup.log');
    }

    async function appendSetupLog(appRoot, message) {
        const logFile = resolveSetupLogFile(appRoot);
        const escapedLog = logFile.replace(/'/g, "''");
        const line = `[${new Date().toISOString()}] ${String(message || '').replace(/'/g, "''")}`;
        await runNativeCommand(`New-Item -ItemType Directory -Force -Path (Split-Path -LiteralPath '${escapedLog}') | Out-Null; Add-Content -LiteralPath '${escapedLog}' -Value '${line}'`);
        return { success: true, logFile };
    }

    async function readSetupLog(appRoot, options = {}) {
        const maxLines = Math.min(Math.max(Number(options.maxLines) || 200, 1), 500);
        const logFile = resolveSetupLogFile(appRoot);
        if (!appRoot) {
            return { success: true, logFile, lines: [] };
        }
        const escapedLog = logFile.replace(/'/g, "''");
        const result = await runNativeCommand(
            `if (Test-Path -LiteralPath '${escapedLog}') { Get-Content -LiteralPath '${escapedLog}' -Tail ${maxLines} } else { @() }`
        );
        if (!result?.success) {
            return { success: false, logFile, lines: [], error: result?.error || 'Unable to read setup log.' };
        }
        const raw = String(result.stdout || '').replace(/\r/g, '');
        const lines = raw.split('\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);
        return { success: true, logFile, lines };
    }

    async function initDataRoot(appRoot, deps) {
        if (!appRoot) return { success: false, error: 'App root is not configured.' };
        const dataRoot = typeof NhpRuntimeConfig !== 'undefined' && NhpRuntimeConfig.dataRootFromProjectDir
            ? normalizeWinPath(NhpRuntimeConfig.dataRootFromProjectDir(appRoot))
            : normalizeWinPath(joinWinPath(appRoot, '..', 'NHP_DATA'));
        const escaped = dataRoot.replace(/'/g, "''");
        const result = await runNativeCommand(
            `$dirs = @('${escaped}','${escaped}\\logs','${escaped}\\logs\\setup','${escaped}\\server_logs','${escaped}\\.tmp'); foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }; 'ok'`
        );
        if (!result?.success) {
            return { success: false, error: result?.error || 'Unable to create NHP_DATA.' };
        }
        await appendSetupLog(appRoot, 'init-data OK');
        return { success: true, dataRoot };
    }

    async function registerNativeMessaging(appRoot, extensionId, deps) {
        const extId = String(extensionId || chrome.runtime.id || '').trim();
        const scriptRel = 'addon\\00_Register_Native_Messaging\\Register_NHP_Native_Messaging_User.cmd';
        const scriptPath = deps.joinProjectPath ? deps.joinProjectPath(appRoot, scriptRel) : joinWinPath(appRoot, scriptRel);
        const launch = await deps.executeNhpLauncherScript(scriptPath, { interactive: true, serverId: 'setup', command: 'register-native' });
        if (!launch?.success) {
            return { success: false, error: launch?.error || 'Native registration launcher failed.', registry: launch };
        }
        if (typeof NhpPortablePaths !== 'undefined' && NhpPortablePaths.invalidateCache) {
            NhpPortablePaths.invalidateCache();
        }
        const verified = await resolveNativeHostStatus(true);
        await appendSetupLog(appRoot, `register-native ${verified.ok ? 'OK' : 'FAIL'} ext=${extId}`);
        return { success: verified.ok === true, verified: verified.ok === true, nativeHost: verified, error: verified.error || null, registry: launch };
    }

    async function runFirstRun(appRoot, extensionId, deps) {
        const report = [];
        const push = (step, ok, detail) => report.push({ step, ok, detail });

        const snapshotBefore = await buildSetupStatusSnapshot(deps, { forceRefresh: true });
        if (!isNodeRequirementMet(snapshotBefore.node) || (snapshotBefore.node?.verified === true && !snapshotBefore.node?.found)) {
            push('node', false, snapshotBefore.node?.hint || 'Node.js missing');
            return { success: false, blocked: true, report };
        }

        const initRes = await initDataRoot(appRoot || snapshotBefore.appRoot, deps);
        push('init-data', initRes.success === true, initRes.dataRoot || initRes.error || '');

        const regRes = await registerNativeMessaging(appRoot || snapshotBefore.appRoot, extensionId, deps);
        push('register-native', regRes.verified === true, regRes.nativeHost?.error || 'registered');

        const portableInit = joinWinPath(appRoot || snapshotBefore.appRoot, 'addon', '_NHP_Portable_Init.cmd');
        const portableRes = await deps.executeNhpLauncherScript(portableInit, { serverId: 'setup', command: 'first-run' });
        push('portable-init', portableRes?.success === true, portableInit);

        try {
            await chrome.storage.local.set({ [SETUP_COMPLETE_STORAGE_KEY]: true });
        } catch (_) { /* ignore */ }

        await appendSetupLog(appRoot || snapshotBefore.appRoot, 'first-run complete');
        const snapshotAfter = await buildSetupStatusSnapshot(deps, { forceRefresh: true });
        return {
            success: snapshotAfter.deviceReady === true || initRes.success === true,
            report,
            snapshot: snapshotAfter
        };
    }

    async function runBulkLauncher(appRoot, relScript, deps, command) {
        if (!appRoot) return { success: false, error: 'App root is not configured.' };
        const scriptPath = deps.joinProjectPath ? deps.joinProjectPath(appRoot, relScript) : joinWinPath(appRoot, relScript);
        return deps.executeNhpLauncherScript(scriptPath, { serverId: 'setup', command });
    }

    async function handleSetupApiRequest(req, deps) {
        const endpoint = String(req.endpoint || 'status').trim();
        const forceRefresh = req.forceRefresh === true;
        let appRoot = normalizeWinPath(await deps.ensureNhpProjectDirResolved(forceRefresh));

        if (endpoint === 'status') {
            return buildSetupStatusSnapshot(deps, { forceRefresh });
        }

        if (endpoint === 'launcher-files') {
            if (!appRoot) {
                const snap = await buildSetupStatusSnapshot(deps, { forceRefresh: true });
                appRoot = snap.appRoot;
            }
            const files = await listLauncherFiles(appRoot);
            return { success: true, files, appRoot };
        }

        if (endpoint === 'append-log') {
            await appendSetupLog(appRoot, req.message || '');
            return { success: true };
        }

        if (endpoint === 'read-log') {
            if (!appRoot) {
                const snap = await buildSetupStatusSnapshot(deps, { forceRefresh: false });
                appRoot = snap.appRoot;
            }
            return readSetupLog(appRoot, { maxLines: req.maxLines });
        }

        if (endpoint === 'init-data') {
            if (!appRoot) return { success: false, error: 'App root is not configured.' };
            return initDataRoot(appRoot, deps);
        }

        if (endpoint === 'register-native') {
            if (!appRoot) return { success: false, error: 'App root is not configured.' };
            return registerNativeMessaging(appRoot, req.extensionId, deps);
        }

        if (endpoint === 'first-run') {
            return runFirstRun(appRoot, req.extensionId, deps);
        }

        if (endpoint === 'start-all') {
            const bulk = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.BULK_SCRIPTS?.startAll : null;
            return runBulkLauncher(appRoot, bulk || 'addon\\_shared\\NHP_Start_All_Servers_SilentCore.cmd', deps, 'start-all');
        }

        if (endpoint === 'stop-all') {
            const bulk = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.BULK_SCRIPTS?.stopAll : null;
            return runBulkLauncher(appRoot, bulk || 'addon\\_shared\\NHP_Stop_All_Servers_SilentCore.cmd', deps, 'stop-all');
        }

        if (endpoint === 'restart-all') {
            const bulk = typeof NhpLocalServers !== 'undefined' ? NhpLocalServers.BULK_SCRIPTS?.restartAll : null;
            return runBulkLauncher(appRoot, bulk || 'addon\\_shared\\NHP_Restart_All_Servers_SilentCore.cmd', deps, 'restart-all');
        }

        if (endpoint === 'run-launcher') {
            const launcher = String(req.launcher || '').trim();
            if (!launcher) return { success: false, error: 'Missing launcher file name.' };
            if (!appRoot) return { success: false, error: 'App root is not configured.' };
            const candidates = [
                joinWinPath(appRoot, 'addon', launcher),
                joinWinPath(appRoot, 'addon', '01_Start_All', launcher),
                joinWinPath(appRoot, 'addon', '_shared', launcher),
                joinWinPath(appRoot, launcher)
            ];
            for (const candidate of candidates) {
                if (await testPathExists(candidate)) {
                    return deps.executeNhpLauncherScript(candidate, { interactive: true, serverId: 'setup', command: 'run-launcher' });
                }
            }
            return { success: false, error: `Launcher not found: ${launcher}` };
        }

        return { success: false, error: `Unknown setup endpoint: ${endpoint}` };
    }

    global.NhpSetupApi = Object.freeze({
        SETUP_COMPLETE_STORAGE_KEY,
        buildSetupStatusSnapshot,
        handleSetupApiRequest
    });
})(typeof globalThis !== 'undefined' ? globalThis : self);
