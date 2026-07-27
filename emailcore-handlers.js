/**
 * EmailCore admin bridge handlers — Native Messaging + isolated Chrome profiles.
 * Loaded by background.js via importScripts.
 */
(function initEmailCoreHandlers() {
    if (self.__emailCoreHandlersReady) return;
    self.__emailCoreHandlersReady = true;

    const DEFAULT_TEEPUBLIC_SIGNUP = 'https://www.teepublic.com/users/sign_up';
    const EMAILCORE_NATIVE_HOST = 'com.emailcore.server_launcher';
    const DEFAULT_EMAILCORE_EXTENSION_ID = 'dbogillpojmdiahjdambllmlalgjibho';
    const NATIVE_HOST_RECHECK_MS = 60000;
    const NATIVE_MESSAGING_SETUP_HINT =
        'شغّل EmailCore_OneClick_Setup.vbs مرة واحدة من مجلد emailcore على سطح المكتب، ثم أعد تحميل الإضافة.';
    const PROJECT_DIR_MISSING_HINT =
        'مسار المشروع غير مُعدّ. افتح الإعدادات ← Windows project path، أو شغّل الإعداد بنقرة واحدة.';
    const WRONG_PROJECT_PATH_HINT =
        'مسار خاطئ — استخدم مجلد مشروع emailcore (مثل Desktop\\emailcore) وليس مجلد الإضافة NHP EMAILCORE أو Downloads.';

    function fixUsernameTypoInPath(dir) {
        const raw = String(dir || '').trim();
        if (!raw) return raw;
        return raw
            .replace(/\\Users\\maggour\\(?!i)/i, '\\Users\\maggouri\\')
            .replace(/\\Users\\yougz\\/i, '\\Users\\maggouri\\');
    }

    function isExtensionFolderPath(dir) {
        const raw = String(dir || '').trim();
        if (!raw) return false;
        return (
            /\\NHP\s*EMAILCORE/i.test(raw) ||
            /\\NHP[_\s-]V\d/i.test(raw) ||
            /\\Niche\s*Hunter/i.test(raw) ||
            /\\outlook-automation/i.test(raw)
        );
    }

    let nativeHostStatus = { checked: false, ok: false, error: null, checkedAt: null };
    let emailcoreAutomationState = {
        active: false,
        sessionId: null,
        tabId: null,
        startedAt: null,
        platform: 'teepublic',
    };
    let teepublicPipeline = {
        phase: 'IDLE',
        account: null,
        apiBase: 'https://emailcore-6i3w.onrender.com',
        updatedAt: null,
    };

    const pipelineApi = () => self.EmailCoreTeePublicPipeline || null;

    function syncPipelineFromModule() {
        const mod = pipelineApi();
        if (!mod) return;
        teepublicPipeline = { ...teepublicPipeline, ...mod.getState() };
    }

    function appendAutomationLog(message, level = 'info') {
        console.log(`[EmailCore] ${message}`);
    }

    async function postPipelineEventToServer(message, level = 'info', phase = null) {
        const mod = pipelineApi();
        if (mod?.postPipelineEventToServer) {
            await mod.postPipelineEventToServer(message, level, phase);
        }
    }

    const EMAILCORE_SESSIONS_KEY = 'emailcore_sessions';
    const EMAILCORE_AUT_SYNC_KEY = 'emailcore_aut_last_sync';
    const CREATY_STORAGE_KEYS = {
        apiBase: 'emailcore_creaty_api_base',
        token: 'emailcore_creaty_token',
        userId: 'emailcore_creaty_user_id',
    };
    const EMAILCORE_LIVE_SYNC_ENABLED_KEY = 'emailcore_live_sync_enabled';
    const EMAILCORE_LIVE_SYNC_META_KEY = 'emailcore_live_sync_meta';
    const EMAILCORE_LIVE_SYNC_BUSY = 'emailcore_live_sync_busy';
    const EMAILCORE_LIVE_SYNC_DISMISSED_KEY = 'emailcore_live_sync_dismissed_ids';
    const EMAILCORE_GHOST_LIBRARY_URL = 'http://127.0.0.1:3019/api/library';
    const EMAILCORE_SESSION_KEYS = {
        sessionToken: 'emailcore_session_token',
        userId: 'emailcore_session_user_id',
        username: 'emailcore_session_username',
        role: 'emailcore_session_role',
        tier: 'emailcore_session_tier',
        expiresAt: 'emailcore_session_expires_at',
    };
    const DEFAULT_EMAILCORE_API_BASE = 'https://emailcore.app';

    function normalizeEmailCoreApiBase(value = DEFAULT_EMAILCORE_API_BASE) {
        let base = String(value || DEFAULT_EMAILCORE_API_BASE).trim().replace(/\/+$/, '');
        try {
            const url = new URL(base);
            if (url.hostname === 'www.emailcore.app') url.hostname = 'emailcore.app';
            base = url.origin;
        } catch (_) {
            /* keep raw */
        }
        return base;
    }

    function formatCreatyApiError(data = {}, status = 0) {
        const raw = String(data.error || data.message || '').trim();
        if (status === 401) {
            return raw || 'جلسة EmailCore غير صالحة — سجّل الدخول من مركز الإدارة → التكاملات';
        }
        if (status === 404) {
            if (/cannot post/i.test(raw)) {
                return 'مسار الإرسال غير متوفّر على الخادم — انشر آخر نسخة من EmailCore على emailcore.app';
            }
            return raw || 'المسار غير موجود على الخادم (404)';
        }
        if (status === 400) return raw || 'طلب غير صالح — تحقق من الحقول';
        if (status >= 500) return raw || `خطأ في الخادم (HTTP ${status})`;
        return raw || `خطأ EmailCore (HTTP ${status || 'unknown'})`;
    }
    const DEFAULT_EMAILCORE_CREATY_USER_ID = '8';
    const DEFAULT_EMAILCORE_CREATY_TOKEN = 'b39b3d326f5e7b4f9cfdaddea38b208bacafe27994470739';
    const EMAILCORE_GHOST_SERVERS_KEY = 'emailcore_ghost_servers';
    const EMAILCORE_GHOST_DEFAULTS_KEY = 'emailcore_ghost_defaults';

    const DEFAULT_GHOST_SERVERS = [
        { id: 'ghost-teepublic', name: 'TeePublic Ghost', host: '127.0.0.1', port: 3019, platform: 'teepublic', isDefault: true },
        { id: 'ghost-redbubble', name: 'Redbubble Ghost', host: '127.0.0.1', port: 3021, platform: 'redbubble', isDefault: true },
        { id: 'ghost-amazon', name: 'Amazon Ghost', host: '127.0.0.1', port: 3022, platform: 'amazon', isDefault: true },
        { id: 'ghost-pinterest', name: 'Pinterest Ghost', host: '127.0.0.1', port: 3023, platform: 'pinterest', isDefault: true },
        { id: 'ai-bridge', name: 'AI Bridge', host: '127.0.0.1', port: 3031, platform: 'ai_bridge', isDefault: true },
    ];

    const DEFAULT_GHOST_PORTS = {
        teepublic: 3019,
        redbubble: 3021,
        amazon: 3022,
        pinterest: 3023,
        ai_bridge: 3031,
    };

    function normalizeGhostHost(value) {
        return String(value || '')
            .trim()
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .split(':')[0] || '127.0.0.1';
    }

    function normalizeGhostPort(value, fallback = 3019) {
        const num = Number.parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(num) || num < 1 || num > 65535) return fallback;
        return num;
    }

    function normalizeGhostPlatform(value) {
        const p = String(value || 'custom').trim().toLowerCase();
        if (['teepublic', 'redbubble', 'amazon', 'pinterest', 'ai_bridge', 'custom'].includes(p)) return p;
        return 'custom';
    }

    function normalizeGhostServerEntry(raw = {}, index = 0) {
        const platform = normalizeGhostPlatform(raw.platform);
        const host = normalizeGhostHost(raw.host);
        const port = normalizeGhostPort(raw.port, DEFAULT_GHOST_PORTS[platform] || 3019);
        const id = String(raw.id || `${platform}-${port}-${index}`)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '') || `server-${index}`;
        return {
            id,
            name: String(raw.name || `${platform} @ ${host}:${port}`).trim(),
            host,
            port,
            platform,
            isDefault: raw.isDefault === true,
        };
    }

    function normalizeGhostDefaults(servers = [], defaults = {}) {
        const byPlatform = {};
        const byId = new Map(servers.map((s) => [s.id, s]));
        servers.forEach((server) => {
            if (server.isDefault && !byPlatform[server.platform]) {
                byPlatform[server.platform] = server.id;
            }
        });
        Object.entries(defaults || {}).forEach(([platform, serverId]) => {
            const p = normalizeGhostPlatform(platform);
            const id = String(serverId || '').trim();
            if (id && byId.has(id)) byPlatform[p] = id;
        });
        return byPlatform;
    }

    function normalizeGhostServersPayload(payload = {}) {
        const incoming = Array.isArray(payload.servers) ? payload.servers : [];
        const servers = incoming.length
            ? incoming.map((entry, index) => normalizeGhostServerEntry(entry, index))
            : DEFAULT_GHOST_SERVERS.map((entry) => ({ ...entry }));
        const seen = new Set();
        const unique = [];
        servers.forEach((server) => {
            let id = server.id;
            let suffix = 1;
            while (seen.has(id)) {
                id = `${server.id}-${suffix}`;
                suffix += 1;
            }
            seen.add(id);
            unique.push({ ...server, id });
        });
        return {
            servers: unique,
            defaults: normalizeGhostDefaults(unique, payload.defaults),
        };
    }

    async function loadGhostServersFromStorage() {
        const stored = await chrome.storage.local.get([
            EMAILCORE_GHOST_SERVERS_KEY,
            EMAILCORE_GHOST_DEFAULTS_KEY,
        ]);
        const servers = Array.isArray(stored[EMAILCORE_GHOST_SERVERS_KEY])
            ? stored[EMAILCORE_GHOST_SERVERS_KEY]
            : [];
        if (!servers.length) {
            return normalizeGhostServersPayload({ servers: DEFAULT_GHOST_SERVERS });
        }
        return normalizeGhostServersPayload({
            servers,
            defaults: stored[EMAILCORE_GHOST_DEFAULTS_KEY] || {},
        });
    }

    async function saveGhostServersToStorage(payload = {}) {
        const normalized = normalizeGhostServersPayload(payload);
        await chrome.storage.local.set({
            [EMAILCORE_GHOST_SERVERS_KEY]: normalized.servers,
            [EMAILCORE_GHOST_DEFAULTS_KEY]: normalized.defaults,
        });
        return normalized;
    }

    async function resolveGhostServerForPlatform(platform = 'teepublic') {
        const p = normalizeAutPlatform(platform);
        const config = await loadGhostServersFromStorage();
        const defaults = config.defaults || {};
        const defaultId = defaults[p];
        if (defaultId) {
            const match = config.servers.find((s) => s.id === defaultId);
            if (match) return { ...match, source: 'config-default' };
        }
        const platformDefault = config.servers.find((s) => s.platform === p && s.isDefault)
            || config.servers.find((s) => s.platform === p);
        if (platformDefault) return { ...platformDefault, source: 'config-platform' };
        return {
            id: `builtin-${p}`,
            name: `${p} builtin`,
            host: '127.0.0.1',
            port: DEFAULT_GHOST_PORTS[p] || 3019,
            platform: p,
            source: 'builtin',
        };
    }

    async function readProfileSignupFromDisk(email) {
        const emailHint = String(email || '').trim();
        if (!emailHint) return null;
        await ensureNativeHostReady({ silent: true });
        const projectDir = await resolveEmailcoreProjectDir();
        if (!projectDir) return null;
        try {
            const fileResult = await sendNativeHostMessage({
                action: 'read_profile_signup',
                projectDir,
                email: emailHint,
            });
            if (fileResult?.success && fileResult.account?.email) {
                return fileResult.account;
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    self.__emailCoreHandlersApi = {
        buildSignupPayload,
        launchEmailcoreAccountBrowser,
        startEmailcoreAccount,
        appendAutomationLog,
        postPipelineEventToServer,
        resolveGhostServerForPlatform,
        loadGhostServersFromStorage,
        readProfileSignupFromDisk,
    };

    function normalizeAutPlatform(platform) {
        const p = String(platform || 'teepublic').trim().toLowerCase();
        if (['teepublic', 'redbubble', 'amazon', 'pinterest'].includes(p)) return p;
        return 'teepublic';
    }

    function mergeAccountsByEmail(current = [], incoming = []) {
        const byEmail = new Map();
        [...current, ...incoming].forEach((acc) => {
            const emailKey = String(acc?.email || '').trim().toLowerCase();
            if (!emailKey) return;
            byEmail.set(emailKey, { ...(byEmail.get(emailKey) || {}), ...acc });
        });
        return Array.from(byEmail.values());
    }

    function mergeSessionsById(current = [], incoming = []) {
        const byKey = new Map();
        [...current, ...incoming].forEach((session) => {
            const key = String(session?.id ?? session?.sessionId ?? session?.email ?? '').trim();
            if (!key) return;
            byKey.set(key, { ...(byKey.get(key) || {}), ...session });
        });
        return Array.from(byKey.values());
    }

    async function removeAccountFromAutopilot(email, platform = 'teepublic') {
        const p = normalizeAutPlatform(platform);
        const storageKey = `ap_accounts_${p}`;
        const emailKey = String(email || '').trim().toLowerCase();
        if (!emailKey) return { success: false, error: 'email required' };

        const stored = await chrome.storage.local.get([storageKey, 'ap_accounts', EMAILCORE_SESSIONS_KEY]);
        const currentAccounts = Array.isArray(stored[storageKey]) ? stored[storageKey] : [];
        const filteredAccounts = currentAccounts.filter(
            (acc) => String(acc?.email || '').trim().toLowerCase() !== emailKey
        );
        const currentSessions = Array.isArray(stored[EMAILCORE_SESSIONS_KEY]) ? stored[EMAILCORE_SESSIONS_KEY] : [];
        const filteredSessions = currentSessions.filter((session) => {
            const key = String(session?.email || session?.display_email || '').trim().toLowerCase();
            return key !== emailKey;
        });

        const payload = {
            [storageKey]: filteredAccounts,
            [EMAILCORE_SESSIONS_KEY]: filteredSessions,
            [EMAILCORE_AUT_SYNC_KEY]: Date.now(),
        };
        if (p === 'teepublic') payload.ap_accounts = filteredAccounts;
        await chrome.storage.local.set(payload);
        return {
            success: true,
            removed: currentAccounts.length - filteredAccounts.length,
            total: filteredAccounts.length,
            platform: p,
        };
    }

    function resolveAutGroupId(session = {}) {
        if (session.artisan_detected_at || session.is_artisan || session.quality === 'good') {
            return 'g_artisan';
        }
        return 'g_new';
    }

    function resolveAutAccountCategory(session = {}) {
        const derive = globalThis.ApAccountActivation?.deriveAccountStatus;
        if (derive) return derive(session);
        if (session.artisan_detected_at || session.is_artisan || session.quality === 'good') {
            return 'artisan';
        }
        const status = String(session.teepublic_status || session.status || '').trim().toLowerCase();
        if (status === 'deactivated' || status === 'disabled') return 'inactive';
        if (status === 'artisan') return 'artisan';
        if (['active', 'registered', 'signup_complete'].includes(status)) return 'active';
        if (session.tpActivated === true || session.activated === true) return 'active';
        return 'inactive';
    }

    function sessionToAutopilotAccount(session = {}, platform = 'teepublic') {
        const email = String(
            session.display_email || session.email || session.account?.email || ''
        ).trim();
        if (!email) return null;

        const displayName = String(session.display_name || session.account?.display_name || '').trim();
        const storeName = displayName || `${email.split('@')[0] || 'account'}_Store`;
        const sessionId = session.id ?? session.sessionId ?? session.account?.sessionId ?? null;
        const utils = self.EmailCoreAccountUtils;
        const names = utils?.sanitizeSignupCredentials
            ? utils.sanitizeSignupCredentials({ ...session, email, display_name: displayName, storeName })
            : (utils?.resolveAccountNames
                ? utils.resolveAccountNames({ email, display_name: displayName, storeName })
                : { firstName: '', lastName: '' });

        return {
            id: String(sessionId || Math.random().toString(36).slice(2, 11)),
            email,
            pass: String(session.password || session.account?.password || '').trim(),
            proxy: '',
            quota: 50,
            dailyLimit: 50,
            nicheMapping: '',
            displayName,
            storeName,
            firstName: names.firstName || '',
            lastName: names.lastName || '',
            first_name: names.firstName || '',
            last_name: names.lastName || '',
            groupId: resolveAutGroupId(session),
            category: resolveAutAccountCategory(session),
            verified: true,
            selected: true,
            emailcoreSessionId: sessionId,
            emailcoreSource: true,
            emailcorePlatform: normalizeAutPlatform(platform),
            providerStyle: session.provider_style || session.account?.provider_style || '',
            addedAt: session.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    async function collectKnownAutEmails() {
        const stored = await chrome.storage.local.get([
            'ap_accounts_teepublic',
            'ap_accounts_redbubble',
            'ap_accounts_amazon',
            'ap_accounts_pinterest',
            'ap_accounts',
            EMAILCORE_SESSIONS_KEY,
        ]);
        const emails = new Set();
        const addFrom = (arr) => {
            (Array.isArray(arr) ? arr : []).forEach((item) => {
                const key = String(item?.email || item?.display_email || '').trim().toLowerCase();
                if (key) emails.add(key);
            });
        };
        addFrom(stored.ap_accounts_teepublic);
        addFrom(stored.ap_accounts);
        addFrom(stored.ap_accounts_redbubble);
        addFrom(stored.ap_accounts_amazon);
        addFrom(stored.ap_accounts_pinterest);
        addFrom(stored[EMAILCORE_SESSIONS_KEY]);
        return emails;
    }

    async function readEmailCoreAuth(options = {}) {
        const stored = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.token,
            CREATY_STORAGE_KEYS.userId,
            ...Object.values(EMAILCORE_SESSION_KEYS),
        ]);
        const apiBase = normalizeEmailCoreApiBase(
            options.apiBase
            || stored[CREATY_STORAGE_KEYS.apiBase]
            || DEFAULT_EMAILCORE_API_BASE
        );
        const sessionToken = String(stored[EMAILCORE_SESSION_KEYS.sessionToken] || '').trim();
        const sessionUserId = String(stored[EMAILCORE_SESSION_KEYS.userId] || '').trim();
        if (sessionToken && sessionUserId) {
            return {
                apiBase,
                userId: sessionUserId,
                sessionToken,
                role: String(stored[EMAILCORE_SESSION_KEYS.role] || 'member').trim(),
                tier: String(stored[EMAILCORE_SESSION_KEYS.tier] || 'bronze').trim(),
                username: String(stored[EMAILCORE_SESSION_KEYS.username] || '').trim(),
            };
        }
        const token = String(stored[CREATY_STORAGE_KEYS.token] || '').trim();
        const userId = String(stored[CREATY_STORAGE_KEYS.userId] || '').trim();
        if (userId && token) {
            return { apiBase, userId, token };
        }
        return { apiBase, userId: '', sessionToken: '', token: '' };
    }

    /** @deprecated use readEmailCoreAuth */
    async function readCreatyBridgeConfig(options = {}) {
        const auth = await readEmailCoreAuth(options);
        return {
            apiBase: auth.apiBase,
            token: auth.sessionToken || auth.token || '',
            userId: auth.userId || '',
        };
    }

    /**
     * POST /api/creaty/pull-emails — remote bridge: site → extension AUT accounts.
     * Body: { count, excludeEmails, token, userId }. See creaty-handlers.js header for full API list.
     */
    async function pullEmailsFromSite(options = {}) {
        const count = Math.min(100, Math.max(1, Number(options.count) || 10));
        const platform = normalizeAutPlatform(options.platform || 'teepublic');
        const cfg = await readEmailCoreAuth(options);
        const authToken = cfg.sessionToken || cfg.token;
        if (!authToken || !cfg.userId) {
            throw new Error('EmailCore session missing — Admin → Integrations login');
        }

        const excludeEmails = Array.from(await collectKnownAutEmails());
        const res = await fetch(`${cfg.apiBase}/api/creaty/pull-emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                count,
                excludeEmails,
                token: authToken,
                userId: cfg.userId,
                sessionToken: cfg.sessionToken || undefined,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }

        const incoming = Array.isArray(data.emails) ? data.emails : [];
        const known = await collectKnownAutEmails();
        let skipped = 0;
        const toAdd = [];
        incoming.forEach((item) => {
            const emailKey = String(item?.email || item?.display_email || '').trim().toLowerCase();
            if (!emailKey || known.has(emailKey)) {
                skipped += 1;
                return;
            }
            known.add(emailKey);
            toAdd.push(item);
        });

        const beforeTotal = excludeEmails.length;
        const pushResult = toAdd.length
            ? await pushSessionsToAutopilot(toAdd, { platform, merge: true })
            : { success: true, added: 0, total: beforeTotal, platform };

        return {
            success: true,
            pulled: toAdd.length,
            skipped,
            generated: Number(data.generated) || 0,
            fromServer: Number(data.pulled) || 0,
            total: pushResult.total,
            platform,
            apiBase: cfg.apiBase,
        };
    }

    async function pushSessionsToAutopilot(sessions = [], options = {}) {
        const platform = normalizeAutPlatform(options.platform);
        const storageKey = `ap_accounts_${platform}`;
        const merge = options.merge !== false;
        const incomingSessions = Array.isArray(sessions) ? sessions : [];
        const accounts = incomingSessions
            .map((session) => sessionToAutopilotAccount(session, platform))
            .filter(Boolean);

        if (!accounts.length && !incomingSessions.length) {
            return { success: true, added: 0, total: 0, platform };
        }

        const stored = await chrome.storage.local.get([
            storageKey,
            'ap_accounts',
            EMAILCORE_SESSIONS_KEY,
        ]);
        const currentAccounts = Array.isArray(stored[storageKey]) ? stored[storageKey] : [];
        const mergedAccounts = merge
            ? mergeAccountsByEmail(currentAccounts, accounts)
            : accounts;
        const mergedSessions = merge
            ? mergeSessionsById(stored[EMAILCORE_SESSIONS_KEY] || [], incomingSessions)
            : incomingSessions;

        const payload = {
            [storageKey]: mergedAccounts,
            [EMAILCORE_SESSIONS_KEY]: mergedSessions,
            [EMAILCORE_AUT_SYNC_KEY]: Date.now(),
        };
        if (platform === 'teepublic') {
            payload.ap_accounts = mergedAccounts;
        }

        await chrome.storage.local.set(payload);
        return {
            success: true,
            added: accounts.length,
            total: mergedAccounts.length,
            platform,
        };
    }

    function isLikelyWrongProjectPath(dir) {
        const raw = fixUsernameTypoInPath(dir);
        if (!raw) return false;
        return (
            isExtensionFolderPath(raw) ||
            /\\downloads[/\\]/i.test(raw) ||
            /one-click-setup/i.test(raw) ||
            /\\emailcore\s*\(\d+\)/i.test(raw) ||
            /\\emailcore-\d+/i.test(raw)
        );
    }

    function sanitizeAccountProfileName(email = '') {
        return String(email || '').replace(/[^a-zA-Z0-9]/g, '_');
    }

    function resolvePlatformTargetUrl(platform, targetUrl) {
        if (targetUrl) return String(targetUrl).trim();
        const p = String(platform || 'teepublic').toLowerCase();
        if (p === 'redbubble') return 'https://www.redbubble.com/auth/login';
        if (p === 'amazon') return 'https://merch.amazon.com/designs/new';
        if (p === 'pinterest') return 'https://www.pinterest.com/pin-creation-tool/';
        return DEFAULT_TEEPUBLIC_SIGNUP;
    }

    /** Legacy fallback — chrome-extension:// bootstrap is blocked (ERR_BLOCKED_BY_CLIENT). Not used for launch. */
    function buildIsolatedBootstrapLaunchUrl(payload) {
        const utils = self.EmailCoreAccountUtils;
        const b64 = utils?.signupPayloadToBase64 ? utils.signupPayloadToBase64(payload) : '';
        if (!b64) return null;
        const qs = new URLSearchParams();
        qs.set('ec', b64);
        if (payload?.email) qs.set('ec_hint', String(payload.email).trim());
        try {
            return chrome.runtime.getURL(`emailcore-signup-bootstrap.html?${qs.toString()}`);
        } catch (_) {
            const extId = chrome.runtime.id || DEFAULT_EMAILCORE_EXTENSION_ID;
            return `chrome-extension://${extId}/emailcore-signup-bootstrap.html?${qs.toString()}`;
        }
    }

    async function cacheEmailcoreProjectDir(projectDir) {
        const dir = String(projectDir || '').trim();
        if (!dir) return;
        try {
            await chrome.storage.local.set({ emailcoreProjectDir: dir });
        } catch (_) { /* ignore */ }
    }

    async function sendNativeHostMessage(message) {
        if (typeof chrome.runtime.sendNativeMessage !== 'function') {
            throw new Error('nativeMessaging API unavailable');
        }
        const result = await chrome.runtime.sendNativeMessage(EMAILCORE_NATIVE_HOST, message);
        if (!result) {
            throw new Error('Native host returned empty response');
        }
        return result;
    }

    async function verifyNativeHostConnection(options = {}) {
        const silent = options.silent === true;
        try {
            const result = await sendNativeHostMessage({ action: 'ping' });
            if (result.success) {
                nativeHostStatus = { checked: true, ok: true, error: null, checkedAt: Date.now() };
                if (result.projectDir) {
                    await cacheEmailcoreProjectDir(result.projectDir);
                }
                return nativeHostStatus;
            }
            throw new Error(result.error || 'Native host ping failed');
        } catch (e) {
            let errMsg = e.message || String(e);
            if (/forbidden/i.test(errMsg)) {
                const runtimeId = chrome.runtime.id || DEFAULT_EMAILCORE_EXTENSION_ID;
                errMsg =
                    `Native Messaging FORBIDDEN — معرّف الإضافة (${runtimeId}) لا يطابق allowed_origins. ` +
                    `شغّل EmailCore_OneClick_Setup.bat ${runtimeId} من مجلد emailcore ثم أعد تحميل الإضافة من chrome://extensions.`;
            }
            nativeHostStatus = { checked: true, ok: false, error: errMsg, checkedAt: Date.now() };
            if (!silent) {
                console.warn('[EmailCore] Native host:', errMsg);
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

    async function fetchProjectDirFromNativeHost() {
        try {
            const result = await sendNativeHostMessage({ action: 'ping' });
            const dir = String(result?.projectDir || '').trim();
            if (result?.success && dir) {
                await cacheEmailcoreProjectDir(dir);
                return dir;
            }
        } catch (_) { /* not registered */ }
        return '';
    }

    async function getEmailcoreProjectDir(explicitDir) {
        const fromArg = String(explicitDir || '').trim();
        if (fromArg && !isLikelyWrongProjectPath(fromArg)) return fromArg;

        try {
            const items = await chrome.storage.local.get(['emailcoreProjectDir']);
            const stored = String(items.emailcoreProjectDir || '').trim();
            if (stored && !isLikelyWrongProjectPath(stored)) return stored;
        } catch (_) { /* ignore */ }

        const fromNative = await fetchProjectDirFromNativeHost();
        if (fromNative) return fromNative;

        if (fromArg) return fromArg;
        return '';
    }

    async function resolveEmailcoreProjectDir(options = {}) {
        let projectDir = await getEmailcoreProjectDir(options.explicitDir);
        await ensureNativeHostReady({ silent: true });

        if ((!projectDir || isLikelyWrongProjectPath(projectDir)) && nativeHostStatus.ok) {
            try {
                const result = await sendNativeHostMessage({
                    action: 'ping',
                    projectDir: options.explicitDir || undefined,
                });
                const nativeDir = String(result?.projectDir || '').trim();
                if (nativeDir && !isLikelyWrongProjectPath(nativeDir)) {
                    projectDir = nativeDir;
                    await cacheEmailcoreProjectDir(projectDir);
                }
            } catch (_) { /* ignore */ }
        }

        if (projectDir && isLikelyWrongProjectPath(projectDir)) {
            return '';
        }
        return projectDir;
    }

    function buildShortSignupLaunchUrl(email, fullTargetUrl) {
        const raw = String(fullTargetUrl || DEFAULT_TEEPUBLIC_SIGNUP).trim();
        const withoutHash = raw.split('#')[0];
        const pathOnly = withoutHash.split('?')[0] || DEFAULT_TEEPUBLIC_SIGNUP;
        const hint = encodeURIComponent(String(email || '').trim());
        return hint ? `${pathOnly}?ec_hint=${hint}` : pathOnly;
    }

    function formatChromeLaunchError(errOrMessage, launchResult = null) {
        const raw = String(
            errOrMessage?.message || errOrMessage || launchResult?.error || 'unknown launch error'
        ).trim();
        let ar = 'فشل فتح Chrome المعزول';
        if (/forbidden/i.test(raw)) {
            ar = 'Native Messaging مرفوض — أعد تشغيل EmailCore_OneClick_Setup.bat بمعرّف الإضافة الصحيح';
        } else if (/did not start|لم يبدأ/i.test(raw)) {
            ar = 'Chrome لم يبدأ — قد يكون البروفايل مقفلاً أو التشغيل المزدوج متزامن. انتظر 30 ثانية ثم أعد المحاولة';
        } else if (/executable not found/i.test(raw)) {
            ar = 'لم يُعثر على chrome.exe — ثبّت Google Chrome';
        } else if (/timed out/i.test(raw)) {
            ar = 'انتهت مهلة تشغيل Chrome — الحاسوب بطيء أو البروفايل مشغول';
        } else if (/project dir|مسار/i.test(raw)) {
            ar = 'مسار مشروع emailcore غير صحيح — شغّل الإعداد بنقرة واحدة';
        } else if (/lock timeout/i.test(raw)) {
            ar = 'تشغيل سابق لنفس الحساب لا يزال قيد التنفيذ — انتظر ثم أعد المحاولة';
        }
        const detail = launchResult?.stderr
            ? `${raw} | stderr: ${String(launchResult.stderr).trim()}`
            : raw;
        return `${detail} | ${ar}`;
    }

    function buildAccountLaunchMessage(projectDir, email, targetUrl) {
        const emailStr = String(email || '').trim();
        const fullUrl = String(targetUrl || '').trim();
        return {
            action: 'launch_account',
            projectDir: String(projectDir || '').trim(),
            email: emailStr,
            targetUrl: buildShortSignupLaunchUrl(emailStr, fullUrl || DEFAULT_TEEPUBLIC_SIGNUP),
        };
    }

    async function launchSignupInMainChrome(account, targetUrl, options = {}) {
        const email = String(account?.email || account?.display_email || '').trim();
        const sessionId = String(account?.sessionId || account?.id || email);
        const fullUrl = String(targetUrl || DEFAULT_TEEPUBLIC_SIGNUP).trim();
        const apiBase = String(options.apiBase || DEFAULT_EMAILCORE_API_BASE).trim();
        const platform = String(options.platform || 'teepublic');

        const payload = await buildSignupPayload(
            { ...account, email, sessionId },
            { targetUrl: fullUrl.split('#')[0].split('?')[0], platform, apiBase, autoConfirm: options.fullAuto !== false }
        );

        const utils = self.EmailCoreAccountUtils;
        const teePublicUrl = utils ? utils.appendSignupHashToUrl(fullUrl.split('#')[0], payload) : fullUrl;

        const mod = pipelineApi();
        if (mod) {
            await mod.storePendingSignup(payload);
            await mod.initPipelineForAccount(payload, {
                fullAuto: options.fullAuto !== false,
                apiBase,
            });
            syncPipelineFromModule();
        } else {
            await chrome.storage.local.set({
                emailcore_pending_signup: payload,
                emailcorePendingFill: true,
            });
        }

        appendAutomationLog(
            `CREATTY fallback: opening TeePublic in main Chrome for ${email} | فتح TeePublic في Chrome الرئيسي`,
            'warning'
        );

        const proxyApi = self.NhpCreatyProxyAuth;
        if (proxyApi?.cacheProxyCredentials && String(account?.proxy || '').trim()) {
            await proxyApi.cacheProxyCredentials(account.proxy, { sessionId, email });
        }
        if (proxyApi?.isWindowLockActive?.()) {
            throw new Error('Creaty window creation already in progress — انتظر اكتمال فتح المتصفح السابق');
        }

        const tab = proxyApi?.guardedTabsCreate
            ? await proxyApi.guardedTabsCreate(
                { url: teePublicUrl, active: true },
                { sessionId, email, signupUrl: teePublicUrl }
            )
            : await chrome.tabs.create({ url: teePublicUrl, active: true });
        if (tab?.id) {
            teepublicPipeline.signupTabId = tab.id;
            await seedSignupStorageFromUrl(teePublicUrl);
            const scheduleFill = async (waitMs) => {
                if (proxyApi?.waitForAuthReady) {
                    await proxyApi.waitForAuthReady({ timeoutMs: Math.max(waitMs, 8000) });
                } else {
                    await new Promise((r) => setTimeout(r, waitMs));
                }
                void ensureSignupFillOnTab(tab.id, teePublicUrl);
            };
            void scheduleFill(1200);
            void scheduleFill(4500);
        }

        return {
            success: true,
            browserLaunched: true,
            chromeVerified: true,
            mode: 'main_chrome',
            targetUrl: teePublicUrl,
            tabId: tab?.id || null,
            profileDir: null,
            message: 'TeePublic opened in main Chrome (CREATTY-style fallback)',
        };
    }

    async function launchViaHiddenProtocol(email, targetUrl, platform) {
        const safeEmail = encodeURIComponent(String(email || '').trim());
        const safeTarget = encodeURIComponent(String(targetUrl || DEFAULT_TEEPUBLIC_SIGNUP).trim());
        const safePlatform = encodeURIComponent(String(platform || 'teepublic').trim());
        const protocolUrl =
            `emailcore-account://open?email=${safeEmail}&targetUrl=${safeTarget}&platform=${safePlatform}`;

        return new Promise((resolve) => {
            chrome.tabs.create({ url: protocolUrl, active: false }, (tab) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    resolve({ success: false, error: err.message || 'Protocol launch failed' });
                    return;
                }
                if (tab?.id) {
                    setTimeout(() => {
                        chrome.tabs.remove(tab.id, () => {});
                    }, 2500);
                }
                resolve({
                    success: true,
                    mode: 'protocol_fallback',
                    targetUrl: String(targetUrl || DEFAULT_TEEPUBLIC_SIGNUP).trim(),
                });
            });
        });
    }

    async function verifyChromeProcessForAccount(projectDir, email) {
        const safeEmail = sanitizeAccountProfileName(email);
        const profileDir = `${String(projectDir || '').trim()}\\profiles\\${safeEmail}`;
        try {
            const result = await sendNativeHostMessage({
                action: 'verify_chrome',
                projectDir: String(projectDir || '').trim(),
                email: String(email || '').trim(),
            });
            return !!(result && result.success && result.chromeVerified);
        } catch (_) {
            return false;
        }
    }

    async function launchEmailcoreAccountBrowser(req = {}) {
        const email = req.account?.email || req.account?.display_email || 'session_account';
        const targetUrl = resolvePlatformTargetUrl(req.platform, req.targetUrl);
        const projectDir = await resolveEmailcoreProjectDir({ explicitDir: req.projectDir });
        const safeEmail = sanitizeAccountProfileName(email);
        const userDataDir = projectDir ? `${projectDir}\\profiles\\${safeEmail}` : `profiles\\${safeEmail}`;

        if (!projectDir) {
            const err = `${PROJECT_DIR_MISSING_HINT} ${NATIVE_MESSAGING_SETUP_HINT}`;
            return { success: false, mode: 'unavailable', targetUrl, profileDir: userDataDir, error: err };
        }

        if (isLikelyWrongProjectPath(projectDir)) {
            return {
                success: false,
                mode: 'unavailable',
                targetUrl,
                profileDir: userDataDir,
                error: WRONG_PROJECT_PATH_HINT,
            };
        }

        await ensureNativeHostReady({ silent: true });

        if (nativeHostStatus.ok) {
            try {
                const result = await sendNativeHostMessage(
                    buildAccountLaunchMessage(projectDir, email, targetUrl)
                );
                const chromeVerified = !!(result && result.success && result.chromeVerified !== false);
                if (chromeVerified) {
                    return {
                        success: true,
                        browserLaunched: true,
                        chromeVerified: true,
                        mode: result.mode || 'native_messaging',
                        targetUrl,
                        profileDir: result.profileDir || userDataDir,
                        message: 'Chrome window opened with isolated profile',
                    };
                }
                if (result && result.success && !chromeVerified) {
                    const verified = await verifyChromeProcessForAccount(projectDir, email);
                    if (verified) {
                        return {
                            success: true,
                            browserLaunched: true,
                            chromeVerified: true,
                            mode: result.mode || 'native_messaging',
                            targetUrl,
                            profileDir: userDataDir,
                            message: 'Chrome verified after launch',
                        };
                    }
                }
                const launchErr = formatChromeLaunchError(
                    (result && result.error) || 'Chrome did not start — Native host reported failure',
                    result || null
                );
                return {
                    success: false,
                    browserLaunched: false,
                    chromeVerified: false,
                    mode: 'native_messaging',
                    targetUrl,
                    profileDir: userDataDir,
                    error: launchErr,
                    stderr: result?.stderr || '',
                };
            } catch (e) {
                console.warn('[EmailCore] Native launch failed', e);
            }
        }

        try {
            const fallback = await launchViaHiddenProtocol(email, targetUrl, req.platform);
            const protocolVerified = await verifyChromeProcessForAccount(projectDir, email);
            if (protocolVerified) {
                return {
                    ...fallback,
                    success: true,
                    browserLaunched: true,
                    chromeVerified: true,
                    profileDir: userDataDir,
                };
            }
            return {
                success: false,
                browserLaunched: false,
                chromeVerified: false,
                mode: 'protocol_fallback',
                targetUrl,
                profileDir: userDataDir,
                error:
                    (fallback.error || 'Protocol launch did not open Chrome') +
                    `. ${NATIVE_MESSAGING_SETUP_HINT}`,
            };
        } catch (e) {
            const errMsg = e.message || String(e);
            return {
                success: false,
                mode: 'unavailable',
                targetUrl,
                profileDir: userDataDir,
                error: `${errMsg}. ${NATIVE_MESSAGING_SETUP_HINT}`,
            };
        }
    }

    async function buildSignupPayload(account, options = {}) {
        const utils = self.EmailCoreAccountUtils;
        const email = String(account.email || account.display_email || '').trim();
        const sessionId = String(account.sessionId || account.id || email);
        const sanitized = utils?.sanitizeSignupCredentials
            ? utils.sanitizeSignupCredentials({ ...account, email, storeName: account.storeName || account.nickname })
            : null;
        const names = sanitized
            ? { firstName: sanitized.firstName, lastName: sanitized.lastName }
            : (utils ? utils.resolveAccountNames(account) : { firstName: 'User', lastName: 'Account' });

        let password = sanitized?.password || String(account.password || account.pass || '').trim();
        if (!password) {
            password = `Ec${Math.random().toString(36).slice(2)}!9A`;
        }

        const apiBase = String(options.apiBase || DEFAULT_EMAILCORE_API_BASE).replace(/\/+$/, '');
        const secret = 'emailcore-dev-secret-change-in-production';
        const inboxToken = utils ? await utils.deriveInboxToken(sessionId, email, secret) : '';
        const targetUrl = String(options.targetUrl || DEFAULT_TEEPUBLIC_SIGNUP).trim();

        return {
            email,
            password,
            firstName: names.firstName,
            lastName: names.lastName,
            first_name: names.firstName,
            last_name: names.lastName,
            sessionId,
            signupUrl: targetUrl,
            apiBase,
            inboxToken,
            platform: options.platform || 'teepublic',
            autoConfirm: options.autoConfirm !== false,
            storedAt: Date.now(),
        };
    }

    async function startEmailcoreAccount(account, options = {}) {
        const email = String(account.email || account.display_email || '').trim();
        if (!email) throw new Error('Account email is required');

        const baseTargetUrl = String(options.targetUrl || DEFAULT_TEEPUBLIC_SIGNUP).trim();
        const sessionId = String(account.sessionId || account.id || email);
        const platform = String(options.platform || 'teepublic');
        const apiBase = String(options.apiBase || DEFAULT_EMAILCORE_API_BASE).trim();

        const payload = await buildSignupPayload(
            { ...account, email, sessionId },
            { targetUrl: baseTargetUrl, platform, apiBase, autoConfirm: options.fullAuto !== false }
        );

        console.log('[EmailCore] TeePublic signup payload:', {
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            hasPassword: !!payload.password,
            sessionId: payload.sessionId,
        });

        const utils = self.EmailCoreAccountUtils;
        const teePublicUrl = utils ? utils.appendSignupHashToUrl(baseTargetUrl, payload) : baseTargetUrl;
        const targetUrl = teePublicUrl;

        const mod = pipelineApi();
        if (mod) {
            await mod.storePendingSignup(payload);
            await mod.initPipelineForAccount(payload, {
                fullAuto: options.fullAuto !== false,
                apiBase,
            });
            syncPipelineFromModule();
        } else {
            teepublicPipeline = {
                phase: 'PENDING',
                account: payload,
                apiBase,
                updatedAt: Date.now(),
            };
        }

        postPipelineEventToServer(`Starting TeePublic signup for ${email}`, 'info', 'PENDING');
        appendAutomationLog(
            `Phase 1: launching isolated Chrome for ${email} → TeePublic sign_up (URL + profile JSON) | المرحلة 1: Chrome المعزول`,
            'info'
        );

        await ensureNativeHostReady({ silent: true });
        const projectDir = await resolveEmailcoreProjectDir({ explicitDir: options.projectDir });
        if (projectDir && nativeHostStatus.ok) {
            try {
                const writeResult = await sendNativeHostMessage({
                    action: 'write_profile_signup',
                    projectDir,
                    email,
                    account: payload,
                });
                if (writeResult?.success) {
                    appendAutomationLog(
                        `Profile signup JSON written before Chrome launch (${email})`,
                        'info'
                    );
                } else {
                    console.warn('[EmailCore] write_profile_signup returned failure:', writeResult?.error);
                    appendAutomationLog(
                        `Profile JSON write failed — PS1 will seed from URL ec param | ${writeResult?.error || 'unknown'}`,
                        'warning'
                    );
                }
            } catch (writeErr) {
                console.warn('[EmailCore] write_profile_signup failed (PS1 URL fallback still used):', writeErr);
                appendAutomationLog(
                    'Profile JSON write failed — PS1 will seed signup payload from URL',
                    'warning'
                );
            }
        }

        const launchResult = await launchEmailcoreAccountBrowser({
            account: { ...account, email, sessionId },
            targetUrl,
            platform,
            projectDir: options.projectDir,
        });

        if (!launchResult.success || !launchResult.browserLaunched || launchResult.chromeVerified === false) {
            const isoErr = formatChromeLaunchError(launchResult.error, launchResult);
            appendAutomationLog(`Chrome launch failed: ${isoErr}`, 'error');
            if (options.allowMainChromeFallback !== false) {
                try {
                    const fallback = await launchSignupInMainChrome(account, targetUrl, options);
                    appendAutomationLog(
                        `Isolated Chrome failed — main Chrome fallback opened for ${email} | تم فتح Chrome الرئيسي كبديل`,
                        'warning'
                    );
                    emailcoreAutomationState = {
                        active: true,
                        sessionId,
                        tabId: fallback.tabId,
                        startedAt: Date.now(),
                        platform,
                        launchMode: fallback.mode,
                    };
                    return {
                        success: true,
                        browserLaunched: true,
                        chromeVerified: true,
                        sessionId,
                        targetUrl: fallback.targetUrl,
                        mode: fallback.mode,
                        profileDir: null,
                        signupPhase: 'PENDING',
                        fallbackFromIsolated: true,
                        isolatedError: isoErr,
                        message: fallback.message,
                    };
                } catch (fallbackErr) {
                    throw new Error(
                        `${isoErr} | فشل البديل (Chrome الرئيسي): ${fallbackErr.message || fallbackErr}`
                    );
                }
            }
            throw new Error(isoErr);
        }

        if (launchResult.mode === 'protocol_fallback') {
            appendAutomationLog(
                'Chrome opened via protocol fallback — verify signup window appeared | فُتح عبر البروتوكول — تحقق من النافذة',
                'warning'
            );
        } else {
            appendAutomationLog(
                `Chrome verified (${launchResult.mode}) → ${targetUrl} | Chrome مفتوح ومُتحقّق`,
                'success'
            );
        }

        emailcoreAutomationState = {
            active: true,
            sessionId,
            tabId: null,
            startedAt: Date.now(),
            platform,
            launchMode: launchResult.mode,
        };

        return {
            success: true,
            browserLaunched: true,
            chromeVerified: launchResult.chromeVerified !== false,
            sessionId,
            targetUrl: launchResult.targetUrl || targetUrl,
            mode: launchResult.mode,
            profileDir: launchResult.profileDir,
            signupPhase: 'PENDING',
            message: launchResult.message || 'Chrome window verified with isolated profile',
        };
    }

    void verifyNativeHostConnection({ silent: true });

    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'install' || details.reason === 'update') {
            verifyNativeHostConnection({ silent: true });
        }
    });

    async function seedSignupStorageFromUrl(url) {
        if (!url || !/\/users\/sign_up/i.test(url)) return false;
        const utils = self.EmailCoreAccountUtils;
        if (!utils?.decodeSignupFromLocation) return false;
        try {
            const parsed = utils.decodeSignupFromLocation(new URL(url));
            if (!parsed?.email || !parsed?.password) return false;
            const mod = pipelineApi();
            if (mod?.storePendingSignup) {
                await mod.storePendingSignup(parsed);
            } else {
                await chrome.storage.local.set({
                    emailcore_pending_signup: parsed,
                    emailcorePendingFill: true,
                });
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    async function ensureSignupFillOnTab(tabId, url) {
        if (!tabId || !url || !/\/users\/sign_up/i.test(url)) return;
        if (!/emailcore_ec=|[?&]ec=|ec_hint=/i.test(url)) return;

        const proxyApi = self.NhpCreatyProxyAuth;
        if (proxyApi?.waitForAuthReady) {
            await proxyApi.waitForAuthReady({ timeoutMs: 12000 });
        }

        await seedSignupStorageFromUrl(url);

        try {
            const [{ result: probe }] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const emailEl = document.querySelector('#user_email, input[type="email"], input[name*="email" i]');
                    const pwdEl = document.querySelector('#user_password, input[type="password"]');
                    return {
                        fillDone: !!window.__emailcoreTeePublicFillDone,
                        injectReady: !!window.__emailcoreTeePublicSignupReady,
                        emailFilled: !!(emailEl && String(emailEl.value || '').trim()),
                        passwordFilled: !!(pwdEl && String(pwdEl.value || '').trim()),
                    };
                },
            });

            if (probe?.fillDone || (probe?.emailFilled && probe?.passwordFilled)) return;

            if (!probe?.injectReady) {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['emailcore-account-utils.js', 'teepublic-signup-inject.js'],
                });
                appendAutomationLog('TeePublic: CREATTY-style inject after tab load (cold-start recovery)', 'info');
                return;
            }

            await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    if (typeof window.__emailcoreTeePublicRetryFill === 'function') {
                        window.__emailcoreTeePublicRetryFill();
                    }
                },
            });
        } catch (err) {
            console.warn('[EmailCore] ensureSignupFillOnTab failed', err);
        }
    }

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        const url = changeInfo.url || tab?.url || '';
        if (!url || !/\/users\/sign_up/i.test(url)) return;
        if (changeInfo.status === 'loading' || changeInfo.url) {
            void seedSignupStorageFromUrl(url);
        }
        if (changeInfo.url || changeInfo.status === 'loading' || changeInfo.status === 'complete') {
            const mod = pipelineApi();
            mod?.bootstrapPipelineFromTabUrl?.(tabId, url);
        }
        if (changeInfo.status === 'complete') {
            void ensureSignupFillOnTab(tabId, url);
        }
    });

    const TEEPUBLIC_PIPELINE_ACTIONS = new Set([
        'SIGNUP_SUBMITTED',
        'TEEPUBLIC_SIGNUP_FILLED',
        'TEEPUBLIC_PHASE',
        'TEEPUBLIC_PIPELINE_LOG',
        'TEEPUBLIC_CAPTCHA_DETECTED',
        'TEEPUBLIC_CAPTCHA_CLEARED',
        'GET_TEEPUBLIC_PENDING_SIGNUP',
        'CONFIRM_FOUND',
        'TEEPUBLIC_CONFIRM_FOUND',
        'TEEPUBLIC_CONFIRM_LINK',
    ]);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const action = request?.action;
        const isEmailcore = action && String(action).startsWith('EMAILCORE_');
        const isAutAction = action && String(action).startsWith('AUT_');
        const isCreatyAction = action && String(action).startsWith('CREATY_');
        const isTeePublicPipeline = action && TEEPUBLIC_PIPELINE_ACTIONS.has(action);
        if (!action || (!isEmailcore && !isAutAction && !isCreatyAction && !isTeePublicPipeline)) {
            return false;
        }

        if (isCreatyAction || action === 'EMAILCORE_SYNC_CREATY_CONFIG') {
            if (typeof self.__creatyHandleMessage === 'function') {
                return self.__creatyHandleMessage(request, sender, sendResponse);
            }
            sendResponse({
                success: false,
                error: 'CREATY handlers not loaded — reload extension from chrome://extensions',
            });
            return true;
        }

        if (action === 'EMAILCORE_PING') {
            chrome.storage.local.get(['emailcoreProjectDir'], (items) => {
                const stored = String(items?.emailcoreProjectDir || '').trim();
                const cachedDir =
                    stored && !isLikelyWrongProjectPath(stored) ? stored : null;
                sendResponse({
                    success: true,
                    extensionId: chrome.runtime.id,
                    version: chrome.runtime.getManifest().version,
                    automationActive: !!emailcoreAutomationState.active,
                    nativeHost: { ...nativeHostStatus },
                    projectDir: cachedDir,
                    handlersLoaded: true,
                });
            });
            void resolveEmailcoreProjectDir()
                .then((projectDir) => {
                    if (projectDir && !isLikelyWrongProjectPath(projectDir)) {
                        return cacheEmailcoreProjectDir(projectDir);
                    }
                    return null;
                })
                .catch(() => null);
            void ensureNativeHostReady({ silent: true });
            return true;
        }

        if (action === 'EMAILCORE_SET_PROJECT_DIR') {
            const dir = String(request.projectDir || '').trim();
            if (!dir) {
                sendResponse({ success: false, error: 'مسار المشروع فارغ' });
                return true;
            }
            if (isLikelyWrongProjectPath(dir)) {
                sendResponse({ success: false, error: WRONG_PROJECT_PATH_HINT, wrongPath: true });
                return true;
            }
            cacheEmailcoreProjectDir(dir)
                .then(() => sendResponse({ success: true, projectDir: dir }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_GET_PROJECT_DIR') {
            resolveEmailcoreProjectDir({ explicitDir: request.projectDir })
                .then((projectDir) =>
                    sendResponse({
                        success: true,
                        projectDir: projectDir || null,
                        nativeHost: { ...nativeHostStatus },
                    })
                )
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_VERIFY_NATIVE') {
            verifyNativeHostConnection({ silent: false })
                .then((status) => sendResponse({ success: status.ok, nativeHost: status }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_RUN_SETUP') {
            const projectDir = String(request.projectDir || '').trim();
            const extensionId = String(request.extensionId || DEFAULT_EMAILCORE_EXTENSION_ID).trim();
            if (!projectDir) {
                sendResponse({ success: false, launched: false, error: 'مسار المشروع فارغ' });
                return true;
            }

            const protocolUrl =
                `emailcore-account://register-native?projectDir=${encodeURIComponent(projectDir)}` +
                `&extensionId=${encodeURIComponent(extensionId)}`;

            chrome.tabs.create({ url: protocolUrl, active: false }, (tab) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    sendResponse({ success: false, launched: false, error: err.message });
                    return;
                }
                if (tab?.id) {
                    setTimeout(() => {
                        chrome.tabs.remove(tab.id, () => {});
                    }, 2500);
                }
                sendResponse({ success: true, launched: true, mode: 'protocol', protocolUrl });
            });
            return true;
        }

        if (action === 'EMAILCORE_GET_STATUS') {
            sendResponse({
                success: true,
                state: { ...emailcoreAutomationState },
                pipeline: { ...teepublicPipeline },
            });
            return true;
        }

        if (action === 'EMAILCORE_STOP_AUTOMATION') {
            emailcoreAutomationState = {
                active: false,
                sessionId: null,
                tabId: null,
                startedAt: null,
                platform: 'teepublic',
            };
            sendResponse({ success: true });
            return true;
        }

        if (action === 'EMAILCORE_GET_PIPELINE_STATUS') {
            syncPipelineFromModule();
            sendResponse({ success: true, pipeline: { ...teepublicPipeline } });
            return true;
        }

        if (action === 'GET_TEEPUBLIC_PENDING_SIGNUP') {
            const mod = pipelineApi();
            const finish = (account) => {
                sendResponse({ success: !!account?.email, account: account || null });
            };
            chrome.storage.local.get([mod?.PENDING_SIGNUP_KEY || 'emailcore_pending_signup', 'teepublicPipeline'], async (items) => {
                const key = mod?.PENDING_SIGNUP_KEY || 'emailcore_pending_signup';
                const stored =
                    items[key] ||
                    items.teepublicPipeline?.account ||
                    teepublicPipeline.account ||
                    null;
                if (stored?.email) {
                    finish(stored);
                    return;
                }

                let emailHint = String(request.email || stored?.email || teepublicPipeline.account?.email || '').trim();
                const tabUrl = String(sender?.tab?.url || '').trim();
                if (tabUrl && self.EmailCoreAccountUtils?.decodeSignupFromLocation) {
                    try {
                        const tabParsed = new URL(tabUrl);
                        if (!emailHint) {
                            emailHint = String(tabParsed.searchParams.get('ec_hint') || '').trim();
                        }
                        const parsed = self.EmailCoreAccountUtils.decodeSignupFromLocation(tabParsed);
                        if (parsed?.email) {
                            emailHint = String(parsed.email).trim();
                            await mod?.storePendingSignup?.(parsed);
                            finish(parsed);
                            return;
                        }
                    } catch (_) { /* ignore */ }
                }

                if (!emailHint && tabUrl.includes('teepublic.com') && /sign_up/i.test(tabUrl)) {
                    try {
                        const tabParsed = new URL(tabUrl);
                        emailHint = String(tabParsed.searchParams.get('ec_hint') || '').trim();
                    } catch (_) { /* ignore */ }
                }

                try {
                    await ensureNativeHostReady({ silent: true });
                    const projectDir = await resolveEmailcoreProjectDir();
                    if (projectDir) {
                        if (emailHint) {
                            const fileResult = await sendNativeHostMessage({
                                action: 'read_profile_signup',
                                projectDir,
                                email: emailHint,
                            });
                            if (fileResult?.success && fileResult.account?.email) {
                                await mod?.storePendingSignup?.(fileResult.account);
                                finish(fileResult.account);
                                return;
                            }
                        }
                        const latestResult = await sendNativeHostMessage({
                            action: 'read_latest_profile_signup',
                            projectDir,
                        });
                        if (latestResult?.success && latestResult.account?.email) {
                            await mod?.storePendingSignup?.(latestResult.account);
                            finish(latestResult.account);
                            return;
                        }
                    }
                } catch (_) { /* ignore */ }
                finish(stored);
            });
            return true;
        }

        if (action === 'SIGNUP_SUBMITTED') {
            const mod = pipelineApi();
            const handler = mod?.handleTeePublicSignupSubmitted;
            if (!handler) {
                sendResponse({ success: false, error: 'pipeline unavailable' });
                return true;
            }
            handler(request.account || teepublicPipeline.account || {}, sender, request.autoConfirm)
                .then(() => {
                    syncPipelineFromModule();
                    sendResponse({ success: true });
                })
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'TEEPUBLIC_SIGNUP_FILLED') {
            const mod = pipelineApi();
            mod?.handleTeePublicSignupFilled?.(request.account || {}, request.autoConfirm)
                .then((result) => {
                    syncPipelineFromModule();
                    sendResponse(result || { success: true });
                })
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'TEEPUBLIC_PHASE') {
            const mod = pipelineApi();
            mod?.setTeePublicPipelinePhase?.(request.phase || teepublicPipeline.phase, {
                account: request.account || teepublicPipeline.account,
            }).then(() => {
                syncPipelineFromModule();
                sendResponse({ ok: true });
            });
            return true;
        }

        if (action === 'TEEPUBLIC_PIPELINE_LOG') {
            appendAutomationLog(request.message, request.level || 'info');
            postPipelineEventToServer(request.message, request.level || 'info');
            try {
                chrome.runtime.sendMessage({
                    action: 'CREATY_PIPELINE_LOG',
                    message: request.message,
                    level: request.level || 'info',
                });
            } catch (_) { /* popup may be closed */ }
            sendResponse({ ok: true });
            return true;
        }

        if (action === 'TEEPUBLIC_CAPTCHA_DETECTED') {
            const mod = pipelineApi();
            mod?.setTeePublicPipelinePhase?.('CAPTCHA_PAUSED').then(() => {
                syncPipelineFromModule();
                sendResponse({ ok: true });
            });
            appendAutomationLog('CAPTCHA — manual intervention needed', 'warning');
            return true;
        }

        if (action === 'CONFIRM_FOUND' || action === 'TEEPUBLIC_CONFIRM_FOUND' || action === 'TEEPUBLIC_CONFIRM_LINK') {
            const mod = pipelineApi();
            const link = request.confirmUrl || request.link || request.url;
            console.log('[EmailCore][Handlers] 📩 CONFIRM_FOUND received:', {
                action,
                link,
                email: request.email,
                sessionId: request.sessionId,
                senderTabId: sender?.tab?.id,
                pipelineAvailable: !!mod,
            });
            if (!link) {
                console.warn('[EmailCore][Handlers] CONFIRM_FOUND: no link in payload — ignoring');
                sendResponse({ success: false, error: 'No confirm link provided' });
                return true;
            }
            if (!mod) {
                console.warn('[EmailCore][Handlers] CONFIRM_FOUND: pipeline module not loaded — direct tab navigation fallback');
                chrome.tabs.create({ url: link, active: true })
                    .then((tab) => {
                        console.log('[EmailCore][Handlers] Fallback tab created:', tab.id);
                        sendResponse({ success: true, fallback: true });
                    })
                    .catch((err) => {
                        console.error('[EmailCore][Handlers] Fallback tab creation failed:', err.message);
                        sendResponse({ success: false, error: err.message });
                    });
                return true;
            }
            mod.handleConfirmFound(link, sender)
                .then(() => {
                    syncPipelineFromModule();
                    console.log('[EmailCore][Handlers] ✅ handleConfirmFound completed successfully');
                    sendResponse({ success: true });
                })
                .catch((err) => {
                    console.error('[EmailCore][Handlers] ❌ handleConfirmFound threw error:', err.message, err);
                    sendResponse({ success: false, error: err.message });
                });
            return true;
        }

        if (action === 'EMAILCORE_START_SIGNUP') {
            const startOpts = {
                targetUrl: request.targetUrl,
                platform: request.platform || 'teepublic',
                fullAuto: request.fullAuto,
                apiBase: request.apiBase,
                projectDir: request.projectDir,
            };
            const begin = request.projectDir
                ? cacheEmailcoreProjectDir(String(request.projectDir).trim())
                : Promise.resolve();
            begin
                .then(() => startEmailcoreAccount(request.account || {}, startOpts))
                .then((result) => sendResponse(result))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        if (action === 'EMAILCORE_OPEN_SESSION') {
            const openOpts = {
                apiBase: request.apiBase,
                platform: request.platform || 'teepublic',
                projectDir: request.projectDir,
                targetUrl: request.targetUrl,
            };
            const account = request.account || {};
            const email = String(account.email || account.display_email || '').trim();
            const begin = request.projectDir
                ? cacheEmailcoreProjectDir(String(request.projectDir).trim())
                : Promise.resolve();
            begin
                .then(async () => {
                    if (openOpts.targetUrl) {
                        return launchEmailcoreAccountBrowser({
                            account,
                            targetUrl: openOpts.targetUrl,
                            platform: openOpts.platform,
                            projectDir: openOpts.projectDir,
                        });
                    }
                    const mod = pipelineApi();
                    if (mod?.openInboxConfirmFlow) {
                        return mod.openInboxConfirmFlow(account, openOpts);
                    }
                    return launchEmailcoreAccountBrowser({
                        account,
                        targetUrl: resolvePlatformTargetUrl(openOpts.platform, null),
                        platform: openOpts.platform,
                        projectDir: openOpts.projectDir,
                    });
                })
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_PUSH_ACTIVATION_LINK') {
            const mod = pipelineApi();
            const link = String(
                request.activationLink || request.confirmUrl || request.link || request.url || ''
            ).trim();
            const account = request.account || teepublicPipeline.account || {};
            const email = String(account.email || account.display_email || '').trim();
            if (!link) {
                sendResponse({ success: false, error: 'activation link required' });
                return true;
            }

            launchEmailcoreAccountBrowser({
                account: { ...account, email },
                targetUrl: link,
                platform: request.platform || 'teepublic',
                projectDir: request.projectDir,
            })
                .then(async (launchResult) => {
                    if (launchResult.success) {
                        teepublicPipeline.confirmUrl = link;
                        teepublicPipeline.account = account;
                        await mod?.setTeePublicPipelinePhase?.('CONFIRM_CLICKED', {
                            account,
                            confirmUrl: link,
                        });
                        syncPipelineFromModule();
                        appendAutomationLog(
                            `Activation link opened in isolated profile for ${email || 'account'}`,
                            'success'
                        );
                        sendResponse({
                            success: true,
                            link,
                            mode: launchResult.mode,
                            profileDir: launchResult.profileDir,
                        });
                        return;
                    }

                    return mod?.handleConfirmFound?.(link, sender).then(() => {
                        syncPipelineFromModule();
                        sendResponse({
                            success: true,
                            link,
                            mode: 'tab_fallback',
                            warning: launchResult.error || 'native launch failed',
                        });
                    });
                })
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_REMOVE_ACCOUNT') {
            const email = String(request.email || request.account?.email || request.account?.display_email || '').trim();
            removeAccountFromAutopilot(email, request.platform)
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_START_ACCOUNT') {
            const startOpts = {
                targetUrl: request.targetUrl,
                platform: request.platform || 'teepublic',
                fullAuto: request.fullAuto,
                apiBase: request.apiBase,
                projectDir: request.projectDir,
            };
            const begin = request.projectDir
                ? cacheEmailcoreProjectDir(String(request.projectDir).trim())
                : Promise.resolve();
            begin
                .then(() => startEmailcoreAccount(request.account || {}, startOpts))
                .then((result) => sendResponse(result))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        if (action === 'EMAILCORE_OPEN_INBOX_CONFIRM') {
            const openOpts = {
                apiBase: request.apiBase,
                platform: request.platform || 'teepublic',
                projectDir: request.projectDir,
            };
            const begin = request.projectDir
                ? cacheEmailcoreProjectDir(String(request.projectDir).trim())
                : Promise.resolve();
            begin
                .then(async () => {
                    const mod = pipelineApi();
                    if (mod?.openInboxConfirmFlow) {
                        return mod.openInboxConfirmFlow(request.account || {}, openOpts);
                    }
                    const email = String(request.account?.email || '').trim();
                    const targetUrl = resolvePlatformTargetUrl(openOpts.platform, null);
                    return launchEmailcoreAccountBrowser({
                        account: request.account || {},
                        targetUrl,
                        platform: openOpts.platform,
                        projectDir: openOpts.projectDir,
                    });
                })
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_DESIGN_READY') {
            const design = request.design || {};
            chrome.storage.local.set(
                {
                    emailcorePendingDesign: {
                        ...design,
                        accountId: request.accountId || null,
                        groupId: request.groupId || null,
                        receivedAt: Date.now(),
                    },
                },
                () => sendResponse({ success: true, designId: design.id || null })
            );
            return true;
        }

        if (action === 'EMAILCORE_DESIGN_GROUP_READY') {
            const designs = Array.isArray(request.designs) ? request.designs : [];
            chrome.storage.local.set(
                {
                    emailcorePendingDesignGroup: {
                        groupId: request.groupId || null,
                        accountId: request.accountId || null,
                        designs,
                        receivedAt: Date.now(),
                    },
                },
                () =>
                    sendResponse({
                        success: true,
                        groupId: request.groupId || null,
                        count: designs.length,
                    })
            );
            return true;
        }

        if (action === 'EMAILCORE_PUSH_ACCOUNT') {
            const account = request.account || {};
            pushSessionsToAutopilot([account], {
                platform: request.platform,
                merge: request.merge !== false,
            })
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_SYNC_SESSIONS') {
            const sessions = Array.isArray(request.sessions) ? request.sessions : [];
            pushSessionsToAutopilot(sessions, {
                platform: request.platform,
                merge: request.merge !== false,
            })
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'AUT_PULL_EMAILS') {
            pullEmailsFromSite({
                count: request.count,
                apiBase: request.apiBase,
                platform: request.platform,
            })
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_GET_ACCOUNTS') {
            chrome.storage.local.get(
                [
                    'ap_accounts_teepublic',
                    'ap_accounts_redbubble',
                    'ap_accounts_amazon',
                    'ap_accounts_pinterest',
                    'ap_accounts',
                    EMAILCORE_SESSIONS_KEY,
                    EMAILCORE_AUT_SYNC_KEY,
                ],
                (items) => {
                    sendResponse({
                        success: true,
                        sessions: items[EMAILCORE_SESSIONS_KEY] || [],
                        accounts: {
                            teepublic: items.ap_accounts_teepublic || items.ap_accounts || [],
                            redbubble: items.ap_accounts_redbubble || [],
                            amazon: items.ap_accounts_amazon || [],
                            pinterest: items.ap_accounts_pinterest || [],
                        },
                        lastSyncAt: items[EMAILCORE_AUT_SYNC_KEY] || null,
                    });
                }
            );
            return true;
        }

        if (action === 'EMAILCORE_SYNC_SERVERS') {
            saveGhostServersToStorage({
                servers: request.servers,
                defaults: request.defaults,
            })
                .then((result) => sendResponse({ success: true, ...result }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_GET_SERVERS') {
            loadGhostServersFromStorage()
                .then((result) => sendResponse({ success: true, ...result }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;
        }

        if (action === 'EMAILCORE_LIVE_SYNC_SET') {
            const enabled = request.enabled === true || request.enabled === '1' || request.enabled === 1;
            chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_ENABLED_KEY]: enabled }, () => {
                (async () => {
                    try {
                        const stored = await chrome.storage.local.get([
                            CREATY_STORAGE_KEYS.apiBase,
                            CREATY_STORAGE_KEYS.userId,
                            CREATY_STORAGE_KEYS.token,
                        ]);
                        const apiBase = normalizeEmailCoreApiBase(stored[CREATY_STORAGE_KEYS.apiBase]);
                        const userId = String(stored[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
                        const token = String(stored[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
                        if (userId && token) {
                            const url = new URL(`${apiBase}/api/extension/live-sync/settings`);
                            url.searchParams.set('userId', userId);
                            await fetch(url, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-creaty-token': token,
                                    'x-extension-id': chrome.runtime.id,
                                },
                                body: JSON.stringify({ enabled }),
                            }).catch(() => null);
                        }
                    } catch (err) {
                        console.warn('[EmailCore][LiveSync] server mirror failed', err?.message || err);
                    }
                    if (enabled) {
                        pollLiveSyncLibrary({ force: true }).catch((err) => {
                            console.warn('[EmailCore][LiveSync]', err?.message || err);
                        });
                    }
                })();
                sendResponse({ success: true, ok: true, enabled });
            });
            return true;
        }

        if (action === 'EMAILCORE_LIVE_SYNC_STATUS') {
            chrome.storage.local.get([EMAILCORE_LIVE_SYNC_ENABLED_KEY, EMAILCORE_LIVE_SYNC_META_KEY], (stored) => {
                sendResponse({
                    success: true,
                    ok: true,
                    enabled: stored[EMAILCORE_LIVE_SYNC_ENABLED_KEY] === true,
                    meta: stored[EMAILCORE_LIVE_SYNC_META_KEY] || {},
                });
            });
            return true;
        }

        if (action === 'EMAILCORE_LIVE_SYNC_DISMISS') {
            const ids = (Array.isArray(request.ids) ? request.ids : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            chrome.storage.local.get([EMAILCORE_LIVE_SYNC_DISMISSED_KEY], (stored) => {
                const prev = Array.isArray(stored[EMAILCORE_LIVE_SYNC_DISMISSED_KEY])
                    ? stored[EMAILCORE_LIVE_SYNC_DISMISSED_KEY]
                    : [];
                const next = [...new Set([...prev, ...ids])].slice(-2000);
                chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_DISMISSED_KEY]: next }, () => {
                    sendResponse({ success: true, ok: true, dismissed: next.length });
                });
            });
            return true;
        }

        if (action === 'EMAILCORE_NHP40_PUSH') {
            const designs = Array.isArray(request.designs) ? request.designs : [];
            (async () => {
                try {
                    const result = await pushNhp40Designs(designs);
                    sendResponse({ success: true, ok: true, ...result });
                } catch (err) {
                    sendResponse({
                        success: false,
                        ok: false,
                        error: err?.message || String(err),
                    });
                }
            })();
            return true;
        }

        if (
            action === 'EMAILCORE_DESIGN_LIBRARY_IMPORT_FINAL'
            || action === 'design_library.import_final'
        ) {
            (async () => {
                try {
                    const importer = self.NHP40_IMPORT_FINAL;
                    if (!importer?.importFinalContracts) {
                        sendResponse({
                            success: false,
                            ok: false,
                            status: 'failed',
                            error: 'import_final_receiver_not_loaded',
                        });
                        return;
                    }
                    const result = await importer.importFinalContracts(request || {});
                    sendResponse({
                        success: !!result?.ok,
                        ok: !!result?.ok,
                        ...result,
                    });
                } catch (err) {
                    sendResponse({
                        success: false,
                        ok: false,
                        status: 'failed',
                        error: err?.message || String(err),
                    });
                }
            })();
            return true;
        }

        if (action === 'EMAILCORE_DELETE_SITE_DESIGNS') {
            const ids = (Array.isArray(request.ids) ? request.ids : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);
            (async () => {
                try {
                    const stored = await chrome.storage.local.get([
                        CREATY_STORAGE_KEYS.apiBase,
                        CREATY_STORAGE_KEYS.userId,
                        CREATY_STORAGE_KEYS.token,
                    ]);
                    const apiBase = normalizeEmailCoreApiBase(stored[CREATY_STORAGE_KEYS.apiBase]);
                    const userId = String(stored[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
                    const token = String(stored[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
                    if (!userId || !token || !ids.length) {
                        sendResponse({ success: false, error: 'missing_creaty_or_ids' });
                        return;
                    }
                    const url = new URL(`${apiBase}/api/extension/designs/generated`);
                    url.searchParams.set('userId', userId);
                    const res = await fetch(url, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-creaty-token': token,
                            'x-extension-id': chrome.runtime.id,
                        },
                        body: JSON.stringify({ ids }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || data?.ok === false) {
                        sendResponse({ success: false, error: data?.error || `HTTP ${res.status}` });
                        return;
                    }
                    // Also dismiss so Live Sync won't re-pull before site propagates.
                    const prevStore = await chrome.storage.local.get([EMAILCORE_LIVE_SYNC_DISMISSED_KEY]);
                    const prev = Array.isArray(prevStore[EMAILCORE_LIVE_SYNC_DISMISSED_KEY])
                        ? prevStore[EMAILCORE_LIVE_SYNC_DISMISSED_KEY]
                        : [];
                    await chrome.storage.local.set({
                        [EMAILCORE_LIVE_SYNC_DISMISSED_KEY]: [...new Set([...prev, ...ids])].slice(-2000),
                    });
                    sendResponse({ success: true, ok: true, ...data });
                } catch (err) {
                    sendResponse({ success: false, error: err?.message || String(err) });
                }
            })();
            return true;
        }

        if (action === 'EMAILCORE_EXTENSION_LOGIN') {
            (async () => {
                try {
                    const apiBase = normalizeEmailCoreApiBase(request.apiBase);
                    const username = String(request.username || '').trim();
                    const password = String(request.password || '');
                    if (!username || !password) {
                        sendResponse({ ok: false, error: 'أدخل اسم المستخدم وكلمة المرور' });
                        return;
                    }
                    const res = await fetch(`${apiBase}/api/auth/extension-login`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ username, password }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.ok) {
                        sendResponse({
                            ok: false,
                            status: res.status,
                            error: data.error || formatCreatyApiError(data, res.status),
                        });
                        return;
                    }
                    const userId = String(data.userId || '').trim();
                    const sessionToken = String(data.sessionToken || '').trim();
                    // Issue per-user CREATY token so members match admin "connected" path
                    // (admin often gets token via website sync; members only use Integrations login).
                    let creatyToken = '';
                    if (sessionToken && userId) {
                        try {
                            const tokenRes = await fetch(`${apiBase}/api/creaty/extension-token`, {
                                method: 'POST',
                                headers: {
                                    'content-type': 'application/json',
                                    'x-extension-session': sessionToken,
                                },
                                body: JSON.stringify({ userId }),
                            });
                            const tokenData = await tokenRes.json().catch(() => ({}));
                            if (tokenRes.ok && tokenData?.token) {
                                creatyToken = String(tokenData.token).trim();
                            }
                        } catch (_) {
                            /* session alone remains valid for API calls */
                        }
                    }
                    await chrome.storage.local.set({
                        [CREATY_STORAGE_KEYS.apiBase]: apiBase,
                        [EMAILCORE_SESSION_KEYS.sessionToken]: sessionToken,
                        [EMAILCORE_SESSION_KEYS.userId]: userId,
                        [EMAILCORE_SESSION_KEYS.username]: String(data.username || username),
                        [EMAILCORE_SESSION_KEYS.role]: String(data.role || 'member'),
                        [EMAILCORE_SESSION_KEYS.tier]: String(data.tier || 'bronze'),
                        [EMAILCORE_SESSION_KEYS.expiresAt]: String(data.expiresAt || ''),
                        [CREATY_STORAGE_KEYS.userId]: userId,
                        ...(creatyToken ? { [CREATY_STORAGE_KEYS.token]: creatyToken } : {}),
                    });
                    sendResponse({
                        ok: true,
                        username: data.username,
                        role: data.role,
                        tier: data.tier || 'bronze',
                        userId: data.userId,
                        isAdmin: data.isAdmin === true || data.role === 'admin',
                        expiresAt: data.expiresAt,
                        creatyTokenSynced: !!creatyToken,
                    });
                } catch (err) {
                    sendResponse({ ok: false, error: err.message || String(err) });
                }
            })();
            return true;
        }

        if (action === 'EMAILCORE_EXTENSION_LOGOUT') {
            chrome.storage.local.remove([
                ...Object.values(EMAILCORE_SESSION_KEYS),
                CREATY_STORAGE_KEYS.token,
                CREATY_STORAGE_KEYS.userId,
            ], () => sendResponse({ ok: true }));
            return true;
        }

        if (action === 'EMAILCORE_EXTENSION_SESSION') {
            readEmailCoreAuth()
                .then(async (auth) => {
                    if (!auth.sessionToken) {
                        sendResponse({ ok: false, authenticated: false });
                        return;
                    }
                    try {
                        const res = await fetch(`${auth.apiBase}/api/auth/extension-session`, {
                            headers: { 'x-extension-session': auth.sessionToken },
                        });
                        const data = await res.json().catch(() => ({}));
                        sendResponse({
                            ok: res.ok && data.authenticated,
                            authenticated: !!(res.ok && data.authenticated),
                            username: data.username || auth.username,
                            role: data.role || auth.role,
                            userId: data.userId || auth.userId,
                            isAdmin: data.isAdmin === true || data.role === 'admin',
                        });
                    } catch (err) {
                        sendResponse({ ok: false, error: err.message || String(err) });
                    }
                })
                .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
            return true;
        }

        if (action === 'EMAILCORE_CREATY_API') {
            (async () => {
                try {
                    const apiBase = normalizeEmailCoreApiBase(request.apiBase);
                    const userId = String(request.userId || '').trim();
                    const sessionToken = String(request.sessionToken || request.token || '').trim();
                    const apiPath = String(request.path || '').startsWith('/')
                        ? request.path
                        : `/${request.path || ''}`;
                    const method = String(request.method || 'GET').toUpperCase();
                    if (!userId || !sessionToken) {
                        sendResponse({ ok: false, error: 'سجّل الدخول من مركز الإدارة → التكاملات' });
                        return;
                    }

                    const url = new URL(`${apiBase}/api/creaty${apiPath}`);
                    url.searchParams.set('userId', userId);
                    const fetchOpts = {
                        method,
                        headers: {
                            'content-type': 'application/json',
                        },
                    };
                    if (sessionToken.includes('.')) {
                        fetchOpts.headers['x-extension-session'] = sessionToken;
                    } else {
                        fetchOpts.headers['x-creaty-token'] = sessionToken;
                    }
                    if (method !== 'GET' && method !== 'HEAD') {
                        fetchOpts.body = JSON.stringify({ ...(request.body || {}), userId });
                    }

                    const response = await fetch(url.toString(), fetchOpts);
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        sendResponse({
                            ok: false,
                            status: response.status,
                            error: formatCreatyApiError(data, response.status),
                        });
                        return;
                    }
                    sendResponse({ ok: true, data });
                } catch (err) {
                    sendResponse({ ok: false, error: err.message || String(err) });
                }
            })();
            return true;
        }

        return false;
    });

    const EMAILCORE_MAIL_ALARM = 'emailcore-library-mail-poll';
    const EMAILCORE_LAST_POLL_KEY = 'emailcore_library_last_poll';
    const EMAILCORE_TP_ASSIST_ALARM = 'emailcore-early-radar-tp-assist';
    const EMAILCORE_TP_ASSIST_BUSY_KEY = 'emailcore_tp_assist_busy';

    async function ensureEmailCoreClipboardDocument() {
        if (!chrome.offscreen?.createDocument) return false;
        if (await chrome.offscreen.hasDocument?.()) return true;
        try {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['CLIPBOARD'],
                justification: 'Copy a newly received verification code at the user-enabled EmailCore integration.',
            });
            return true;
        } catch (error) {
            if (!/single offscreen|already exists/i.test(String(error?.message || error))) throw error;
            return true;
        }
    }

    async function pollEmailCoreMessages() {
        const stored = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
            EMAILCORE_LAST_POLL_KEY,
        ]);
        const apiBase = normalizeEmailCoreApiBase(stored[CREATY_STORAGE_KEYS.apiBase]);
        const userId = String(stored[CREATY_STORAGE_KEYS.userId] || '').trim();
        const token = String(stored[CREATY_STORAGE_KEYS.token] || '').trim();
        if (!userId || !token) return;
        const since = stored[EMAILCORE_LAST_POLL_KEY] || new Date(Date.now() - 65000).toISOString();
        const url = new URL(`${apiBase}/api/creaty/library/messages`);
        url.searchParams.set('userId', userId);
        url.searchParams.set('since', since);
        url.searchParams.set('limit', '25');
        const response = await fetch(url, { headers: { 'x-creaty-token': token } });
        if (!response.ok) throw new Error(`EmailCore mail poll HTTP ${response.status}`);
        const data = await response.json();
        await chrome.storage.local.set({ [EMAILCORE_LAST_POLL_KEY]: data.serverTime || new Date().toISOString() });
        const messages = Array.isArray(data.messages) ? data.messages : [];
        for (const message of messages.slice().reverse()) {
            const recipient = message.recipient_addr || message.session_email || '';
            chrome.notifications?.create(`emailcore-${message.id}`, {
                type: 'basic', iconUrl: 'icon.png',
                title: `EmailCore · ${message.category || 'Other'}`,
                message: `${message.subject || 'رسالة جديدة'}\n${recipient}`.slice(0, 240),
                priority: message.category === 'Activation' || message.category === 'Security' ? 2 : 0,
            });
        }
        const coded = messages.find((message) => message.verificationCode);
        if (coded) {
            await ensureEmailCoreClipboardDocument();
            await chrome.runtime.sendMessage({ target: 'offscreen', action: 'EMAILCORE_COPY_TEXT', text: coded.verificationCode });
        }
    }

    function classifyEarlyRadarCompetition(designCount, pageCount) {
        if (Number.isFinite(pageCount)) {
            if (pageCount <= 3) return 'low';
            if (pageCount <= 6) return 'medium';
            return 'high';
        }
        if (!Number.isFinite(designCount)) return 'unknown';
        if (designCount <= 144) return 'low';
        if (designCount <= 288) return 'medium';
        return 'high';
    }

    function extractListingStatsFromHtml(html) {
        const text = String(html || '');
        const blocked = /just a moment|cf_chl_opt|challenge-platform|cf-browser-verification|id=["']cf-wrapper["']/i.test(text);
        if (blocked) return { blocked: true, designCount: null, pageCount: null };

        let designCount = null;
        let pageCount = null;
        if (typeof globalThis.tpExtractTeePublicTotalResults === 'function') {
            designCount = globalThis.tpExtractTeePublicTotalResults(text);
        } else {
            const m = text.match(/of\s*(\d[\d,]*)\s+results?\b/i) || text.match(/(\d[\d,]*)\s+results?\s+for\b/i);
            if (m) designCount = parseInt(String(m[1]).replace(/,/g, ''), 10);
        }
        if (typeof globalThis.tpExtractTeePublicPageOfCount === 'function') {
            pageCount = globalThis.tpExtractTeePublicPageOfCount(text);
        } else if (typeof globalThis.tpExtractTeePublicMaxPage === 'function') {
            pageCount = globalThis.tpExtractTeePublicMaxPage(text);
        } else {
            const pm = text.match(/page\s*[:#]?\s*\d+\s+of\s+(\d+)/i);
            if (pm) pageCount = parseInt(pm[1], 10);
        }
        if (pageCount == null && Number.isFinite(designCount) && typeof globalThis.tpResolveTeePublicPageCount === 'function') {
            pageCount = globalThis.tpResolveTeePublicPageCount(null, designCount);
        } else if (pageCount == null && Number.isFinite(designCount) && designCount > 0) {
            pageCount = Math.max(1, Math.ceil(designCount / 48));
        }
        if (designCount == null && /no results found|id=["']no-results["']/i.test(text)) {
            designCount = 0;
            pageCount = 0;
        }
        return {
            blocked: false,
            designCount: Number.isFinite(designCount) ? designCount : null,
            pageCount: Number.isFinite(pageCount) ? pageCount : null,
        };
    }

    function extractListingStatsFromDomInPage() {
        const bodyText = String(document.body?.innerText || '');
        const title = String(document.title || '');
        const blocked = /just a moment|cf_chl_opt|challenge-platform|enable javascript and cookies/i.test(
            `${bodyText}\n${title}`
        );
        if (blocked) {
            return { blocked: true, designCount: null, pageCount: null, title, href: location.href || '' };
        }
        let designCount = null;
        const resultMatch =
            bodyText.match(/of\s*(\d[\d,]*)\s+results?\b/i) ||
            bodyText.match(/(\d[\d,]*)\s+results?\s+for\b/i) ||
            bodyText.match(/\b(\d[\d,]*)\s+designs?\s+found\b/i);
        if (resultMatch) {
            designCount = parseInt(String(resultMatch[1]).replace(/,/g, ''), 10);
        }
        let pageCount = null;
        const pageMatch =
            bodyText.match(/page\s*[:#]?\s*\d+\s+of\s+(\d+)/i) ||
            bodyText.match(/\b\d+\s+of\s+(\d+)\s+pages?\b/i);
        if (pageMatch) {
            pageCount = parseInt(String(pageMatch[1]).replace(/,/g, ''), 10);
        }
        if (designCount == null && /no results found/i.test(bodyText)) {
            designCount = 0;
            pageCount = 0;
        }
        if (designCount == null) {
            const cards = document.querySelectorAll('[data-design-id], a[href*="/design/"]');
            if (cards.length > 0 && pageCount == null) designCount = cards.length;
        }
        return {
            blocked: false,
            designCount: Number.isFinite(designCount) ? designCount : null,
            pageCount: Number.isFinite(pageCount) ? pageCount : null,
            title,
            href: location.href || '',
        };
    }

    async function scrapeListingStatsViaTab(searchUrl, { attempts = 16, delayMs = 1400 } = {}) {
        let tab = null;
        let listener = null;
        let settled = false;
        const delay = (ms) => new Promise((r) => setTimeout(r, ms));

        const cleanup = async () => {
            if (listener) {
                chrome.tabs.onUpdated.removeListener(listener);
                listener = null;
            }
            if (tab?.id) {
                try {
                    await chrome.tabs.remove(tab.id);
                } catch (_) { /* ignore */ }
                tab = null;
            }
        };

        try {
            tab = await chrome.tabs.create({ url: searchUrl, active: false });
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        reject(new Error('Timeout loading TeePublic search tab'));
                    }
                }, 50000);
                listener = (tabId, changeInfo) => {
                    if (tabId === tab.id && changeInfo.status === 'complete' && !settled) {
                        settled = true;
                        clearTimeout(timeoutId);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });

            let lastError = null;
            for (let attempt = 1; attempt <= attempts; attempt += 1) {
                try {
                    const [res] = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: extractListingStatsFromDomInPage,
                    });
                    const payload = res?.result || {};
                    if (payload.blocked) {
                        lastError = new Error('TeePublic tab still on Cloudflare challenge');
                    } else if (Number.isFinite(payload.designCount) || Number.isFinite(payload.pageCount)) {
                        await cleanup();
                        return {
                            ok: true,
                            designCount: payload.designCount,
                            pageCount: payload.pageCount,
                            strategy: 'extension_tab_scrape',
                        };
                    } else {
                        lastError = new Error('TeePublic listing stats not ready');
                    }
                } catch (error) {
                    lastError = error;
                }
                if (attempt < attempts) await delay(delayMs);
            }
            throw lastError || new Error('TeePublic tab scrape failed');
        } catch (error) {
            await cleanup();
            throw error;
        }
    }

    async function scrapeEarlyRadarKeywordStats(job) {
        const niche = String(job?.niche || '').trim();
        const searchUrl = String(job?.search_url || '').trim()
            || `https://www.teepublic.com/t-shirts?query=${encodeURIComponent(niche)}&sort=popular`;
        if (!niche) return { ok: false, keyword: niche, error: 'empty_niche' };

        try {
            if (typeof globalThis.fetchAndAnalyzeTeePublicDetailed === 'function') {
                const analysis = await globalThis.fetchAndAnalyzeTeePublicDetailed(searchUrl);
                if (Number.isFinite(analysis?.totalResults) || Number.isFinite(analysis?.pageCount)) {
                    const designCount = Number.isFinite(analysis.totalResults) ? analysis.totalResults : null;
                    const pageCount = Number.isFinite(analysis.pageCount) ? analysis.pageCount : null;
                    return {
                        ok: true,
                        keyword: niche,
                        niche_key: job.niche_key,
                        designCount,
                        pageCount,
                        competition: classifyEarlyRadarCompetition(designCount, pageCount),
                        strategy: 'extension_fetch',
                    };
                }
            } else {
                const response = await fetch(searchUrl, {
                    headers: {
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Cache-Control': 'no-cache',
                    },
                });
                if (response.ok) {
                    const html = await response.text();
                    const stats = extractListingStatsFromHtml(html);
                    if (!stats.blocked && (Number.isFinite(stats.designCount) || Number.isFinite(stats.pageCount))) {
                        return {
                            ok: true,
                            keyword: niche,
                            niche_key: job.niche_key,
                            designCount: stats.designCount,
                            pageCount: stats.pageCount,
                            competition: classifyEarlyRadarCompetition(stats.designCount, stats.pageCount),
                            strategy: 'extension_fetch',
                        };
                    }
                }
            }
        } catch (error) {
            console.warn('[EmailCore][TP-assist] fetch path failed:', error?.message || error);
        }

        try {
            const tabStats = await scrapeListingStatsViaTab(searchUrl);
            if (tabStats?.ok && (Number.isFinite(tabStats.designCount) || Number.isFinite(tabStats.pageCount))) {
                return {
                    ok: true,
                    keyword: niche,
                    niche_key: job.niche_key,
                    designCount: tabStats.designCount,
                    pageCount: tabStats.pageCount,
                    competition: classifyEarlyRadarCompetition(tabStats.designCount, tabStats.pageCount),
                    strategy: tabStats.strategy || 'extension_tab_scrape',
                };
            }
        } catch (error) {
            console.warn('[EmailCore][TP-assist] tab scrape failed:', error?.message || error);
            return {
                ok: false,
                keyword: niche,
                niche_key: job.niche_key,
                designCount: null,
                pageCount: null,
                competition: 'unknown',
                strategy: 'extension_failed',
                error: error?.message || String(error),
            };
        }

        return {
            ok: false,
            keyword: niche,
            niche_key: job.niche_key,
            designCount: null,
            pageCount: null,
            competition: 'unknown',
            strategy: 'extension_failed',
            error: 'no_usable_counts',
        };
    }

    async function pollEarlyRadarTpAssist() {
        const busy = await chrome.storage.local.get([EMAILCORE_TP_ASSIST_BUSY_KEY]);
        if (busy[EMAILCORE_TP_ASSIST_BUSY_KEY]) return;

        const stored = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
        ]);
        const apiBase = normalizeEmailCoreApiBase(stored[CREATY_STORAGE_KEYS.apiBase]);
        const userId = String(stored[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
        const token = String(stored[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
        if (!userId || !token) return;

        await chrome.storage.local.set({ [EMAILCORE_TP_ASSIST_BUSY_KEY]: true });
        try {
            const claimUrl = new URL(`${apiBase}/api/creaty/nhp/early-radar/tp-assist`);
            claimUrl.searchParams.set('userId', userId);
            claimUrl.searchParams.set('limit', '4');
            claimUrl.searchParams.set('claimer', `ext-${chrome.runtime.id || 'nhp'}`);
            const claimRes = await fetch(claimUrl, { headers: { 'x-creaty-token': token } });
            if (!claimRes.ok) {
                if (claimRes.status !== 401 && claimRes.status !== 404) {
                    console.warn('[EmailCore][TP-assist] claim HTTP', claimRes.status);
                }
                return;
            }
            const claimData = await claimRes.json().catch(() => ({}));
            const jobs = Array.isArray(claimData.jobs) ? claimData.jobs : [];
            if (!jobs.length) return;

            console.log(`[EmailCore][TP-assist] claimed ${jobs.length} job(s); pending=${claimData.pending ?? '?'}`);
            const results = [];
            for (const job of jobs) {
                const row = await scrapeEarlyRadarKeywordStats(job);
                if (row?.ok && (Number.isFinite(row.designCount) || Number.isFinite(row.pageCount))) {
                    results.push(row);
                }
                await new Promise((r) => setTimeout(r, 900 + Math.floor(Math.random() * 700)));
            }

            if (!results.length) {
                console.warn('[EmailCore][TP-assist] no successful scrapes this round');
                return;
            }

            const postRes = await fetch(`${apiBase}/api/creaty/nhp/early-radar/tp-assist?userId=${encodeURIComponent(userId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-creaty-token': token,
                },
                body: JSON.stringify({
                    source: 'extension',
                    results: results.map((r) => ({
                        keyword: r.keyword,
                        niche_key: r.niche_key,
                        designCount: r.designCount,
                        pageCount: r.pageCount,
                        competition: r.competition,
                        strategy: r.strategy,
                    })),
                }),
            });
            if (!postRes.ok) {
                console.warn('[EmailCore][TP-assist] report HTTP', postRes.status);
                return;
            }
            const postData = await postRes.json().catch(() => ({}));
            console.log('[EmailCore][TP-assist] reported', {
                updated: postData.updated,
                pending: postData.pending,
                rejected: postData.rejected,
            });
        } finally {
            await chrome.storage.local.set({ [EMAILCORE_TP_ASSIST_BUSY_KEY]: false });
        }
    }

    // ─── Search Tools CREATY auto-sync (Trends 15m / other feeds 6h) ───
    const EMAILCORE_ST_TRENDS_ALARM = 'emailcore-search-tools-trends';
    const EMAILCORE_ST_FEEDS_ALARM = 'emailcore-search-tools-feeds';
    const EMAILCORE_ST_TRENDS_BUSY = 'emailcore_st_trends_busy';
    const EMAILCORE_ST_FEEDS_BUSY = 'emailcore_st_feeds_busy';
    const EMAILCORE_ST_LOCAL_ENABLED = 'nhpEmailCoreSearchToolsSyncEnabled';
    const EMAILCORE_ST_META_KEY = 'nhpEmailCoreSearchToolsSyncMeta';
    const EMAILCORE_ST_DESIGN_KEY = 'nhpDesignImagesFeed';
    const EMAILCORE_ST_EARLY_KEY = 'nhpEarlyRadarFeed';
    const EMAILCORE_PIPELINE_ALERT_ALARM = 'emailcore-pipeline-alerts';
    const EMAILCORE_DESIGN_JOBS_ALARM = 'emailcore-design-jobs-bridge';
    const EMAILCORE_LIVE_SYNC_ALARM = 'emailcore-live-sync-library';
    const EMAILCORE_PIPELINE_ALERT_SEEN_KEY = 'emailcore_pipeline_alert_seen_id';
    const EMAILCORE_PIPELINE_ALERT_OPEN_KEY = 'emailcore_pipeline_alert_open';

    function normalizeLiveSyncNameKey(displayName, nicheId, nicheName) {
        const name = String(displayName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const niche = String(nicheId || nicheName || '').trim().toLowerCase();
        return name ? `${name}|${niche}` : '';
    }

    function isTechnicalLiveSyncTitle(value) {
        const s = String(value || '').trim();
        if (!s) return true;
        if (/^dsg_[a-z0-9]+(_\d+)?$/i.test(s)) return true;
        if (/^(lib_|canva_)[a-z0-9_]+/i.test(s)) return true;
        if (/^live\s*sync$/i.test(s)) return true;
        return false;
    }

    /** Product rule: every imported design keeps the niche name it was born from. */
    function resolveLiveSyncDisplayName(design) {
        const nicheName = String(design?.nicheName || design?.niche || '').trim();
        const title = String(design?.displayName || design?.title || '').trim();
        if (nicheName && !isTechnicalLiveSyncTitle(nicheName)) return nicheName;
        if (title && !isTechnicalLiveSyncTitle(title)) return title;
        if (nicheName) return nicheName;
        return 'Live Sync';
    }

    async function loadLocalLibraryDedupeIndex() {
        const ids = new Set();
        const oracleKeys = new Set();
        const nameKeys = new Set();
        const contentHashes = new Set();
        try {
            const res = await fetch(EMAILCORE_GHOST_LIBRARY_URL, { method: 'GET' });
            const data = await res.json().catch(() => ({}));
            const items = Array.isArray(data?.items) ? data.items : [];
            for (const item of items) {
                const storageId = String(item?.storageId || item?.id || '').replace(/__d\d+$/i, '').trim();
                const designId = String(item?.id || '').trim();
                if (storageId) ids.add(storageId);
                if (designId) ids.add(designId);
                const original = String(item?.originalDesignId || item?.metadata?.originalDesignId || '').trim();
                if (original) ids.add(original);
                const siteId = String(item?.siteDesignId || item?.metadata?.siteDesignId || '').trim();
                if (siteId) ids.add(siteId);
                const oracleKey = String(
                    item?.oracleObjectKey
                    || item?.metadata?.oracleObjectKey
                    || item?.objectKey
                    || ''
                ).trim();
                if (oracleKey) oracleKeys.add(oracleKey);
                const hash = String(item?.contentHash || item?.metadata?.contentHash || '').trim();
                if (hash) contentHashes.add(hash);
                const nk = normalizeLiveSyncNameKey(
                    item?.displayName || item?.fileName || item?.title,
                    item?.nicheId || item?.siteDesignId,
                    item?.nicheName || item?.niche
                );
                if (nk) nameKeys.add(nk);
            }
        } catch (err) {
            throw new Error(`Ghost library unreachable (127.0.0.1:3019): ${err?.message || err}`);
        }
        return { ids, oracleKeys, nameKeys, contentHashes };
    }

    function isLiveSyncDuplicate(design, index) {
        const siteId = String(design?.id || '').trim();
        const extId = String(design?.extensionLibraryId || '').trim();
        const oracleKey = String(design?.oracleObjectKey || '').trim();
        const displayName = resolveLiveSyncDisplayName(design);
        const nameKey = normalizeLiveSyncNameKey(displayName, design?.nicheId, design?.nicheName);
        if (siteId && index.ids.has(siteId)) return true;
        if (extId && index.ids.has(extId)) return true;
        if (oracleKey && index.oracleKeys.has(oracleKey)) return true;
        // Same niche title alone is NOT enough — multiple designs can share a niche.
        // Name-key dedupe only when combined with niche id and no oracle key (legacy).
        if (!oracleKey && !siteId && nameKey && index.nameKeys.has(nameKey)) return true;
        return false;
    }

    async function uploadSiteDesignToGhostLibrary(design, imageBlob, auth) {
        const form = new FormData();
        const displayName = resolveLiveSyncDisplayName(design);
        const nicheName = String(design.nicheName || design.niche || '').trim();
        const nicheId = String(design.nicheId || '').trim();
        const siteDesignId = String(design.id || '').trim();
        const fileName = `${displayName.replace(/[^\w\u0600-\u06FF.\s-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Live Sync'}.png`;
        form.append('file', imageBlob, fileName);
        form.append('displayName', displayName);
        form.append('source', 'emailcore_live_sync');
        // siteDesignId = site generated id; do NOT use originalDesignId (that marks Edited).
        if (siteDesignId) form.append('siteDesignId', siteDesignId);
        form.append('oracleObjectKey', String(design.oracleObjectKey || ''));
        if (nicheId) form.append('nicheId', nicheId);
        if (nicheName) form.append('nicheName', nicheName);
        if (nicheName) form.append('niche', nicheName);
        if (auth?.userId) form.append('siteUserId', String(auth.userId));

        const res = await fetch(`${EMAILCORE_GHOST_LIBRARY_URL}/upload`, {
            method: 'POST',
            body: form,
        });
        const data = await res.json().catch(() => ({}));
        // Ghost may return HTTP 200 + { success:true, skipped:true } for deduped Live Sync rows.
        if (data?.skipped) {
            return { skipped: true, reason: data?.reason || 'duplicate', data };
        }
        if (!res.ok || data?.success === false) {
            if (/duplicate|already exists|موجود/i.test(String(data?.error || ''))) {
                return { skipped: true, reason: data?.reason || 'duplicate', data };
            }
            throw new Error(data?.error || `library upload HTTP ${res.status}`);
        }
        return { ok: true, data };
    }

    async function fetchLiveSyncDesignBlob(design, auth) {
        const key = String(design?.oracleObjectKey || '').trim();
        const apiBase = auth?.apiBase || '';
        const userId = auth?.userId || '';
        const token = auth?.token || '';
        if (key && apiBase && userId && token) {
            const mediaUrl = new URL(
                design.mediaUrl && String(design.mediaUrl).includes('/api/extension/designs/media')
                    ? (String(design.mediaUrl).startsWith('http')
                        ? design.mediaUrl
                        : `${apiBase}${design.mediaUrl}`)
                    : `${apiBase}/api/extension/designs/media`
            );
            if (!mediaUrl.searchParams.get('key')) mediaUrl.searchParams.set('key', key);
            mediaUrl.searchParams.set('userId', userId);
            const mediaRes = await fetch(mediaUrl, {
                headers: {
                    'x-creaty-token': token,
                    'x-extension-id': chrome.runtime.id,
                },
            });
            if (mediaRes.ok) {
                const blob = await mediaRes.blob();
                if (blob && blob.size) return blob;
            }
        }
        const fallback = String(design?.mediaUrl || '').trim();
        if (fallback && /^https?:\/\//i.test(fallback)) {
            const res = await fetch(fallback);
            if (res.ok) {
                const blob = await res.blob();
                if (blob && blob.size) return blob;
            }
        }
        return null;
    }

    async function importDesignsToGhostLibrary(designs, auth, { dismissed = new Set() } = {}) {
        const index = await loadLocalLibraryDedupeIndex();
        let imported = 0;
        let skipped = 0;
        let failed = 0;
        for (const design of designs) {
            const siteId = String(design?.id || '').trim();
            if (siteId && dismissed.has(siteId)) {
                skipped += 1;
                continue;
            }
            if (isLiveSyncDuplicate(design, index)) {
                skipped += 1;
                continue;
            }
            const key = String(design?.oracleObjectKey || '').trim();
            const hasMedia = !!(key || String(design?.mediaUrl || '').trim());
            if (!hasMedia) {
                skipped += 1;
                continue;
            }
            try {
                const blob = await fetchLiveSyncDesignBlob(design, auth);
                if (!blob || !blob.size) {
                    failed += 1;
                    continue;
                }
                const result = await uploadSiteDesignToGhostLibrary(design, blob, auth);
                if (result?.skipped) {
                    skipped += 1;
                } else {
                    imported += 1;
                    const oracleKey = String(design.oracleObjectKey || '').trim();
                    const nameKey = normalizeLiveSyncNameKey(
                        resolveLiveSyncDisplayName(design),
                        design?.nicheId,
                        design?.nicheName
                    );
                    if (siteId) index.ids.add(siteId);
                    if (oracleKey) index.oracleKeys.add(oracleKey);
                    if (nameKey) index.nameKeys.add(nameKey);
                }
            } catch (err) {
                failed += 1;
                console.warn('[EmailCore][LiveSync] import failed', design?.id, err?.message || err);
            }
        }
        return { imported, skipped, failed, listed: designs.length };
    }

    async function pushNhp40Designs(designs) {
        const list = (Array.isArray(designs) ? designs : [])
            .map((d) => ({
                id: String(d?.id || '').trim(),
                oracleObjectKey: String(d?.oracleObjectKey || '').trim(),
                displayName: String(d?.displayName || '').trim(),
                nicheName: String(d?.nicheName || d?.niche || d?.displayName || '').trim(),
                nicheId: String(d?.nicheId || '').trim(),
                mediaUrl: String(d?.mediaUrl || '').trim(),
            }))
            .filter((d) => d.id && (d.oracleObjectKey || d.mediaUrl));
        if (!list.length) {
            return { imported: 0, skipped: 0, failed: 0, listed: 0, reason: 'no_designs' };
        }
        const flags = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
            EMAILCORE_LIVE_SYNC_BUSY,
        ]);
        if (flags[EMAILCORE_LIVE_SYNC_BUSY] === true) {
            // Allow NHP40 to wait briefly then proceed — user-initiated push.
            await new Promise((r) => setTimeout(r, 800));
        }
        const apiBase = normalizeEmailCoreApiBase(flags[CREATY_STORAGE_KEYS.apiBase]);
        const userId = String(flags[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
        const token = String(flags[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
        if (!userId || !token) {
            throw new Error('missing_creaty');
        }
        await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_BUSY]: true });
        try {
            const auth = { apiBase, userId, token };
            const stats = await importDesignsToGhostLibrary(list, auth);
            const meta = {
                lastRunAt: new Date().toISOString(),
                source: 'nhp40',
                ...stats,
            };
            await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_META_KEY]: meta });
            if (stats.imported > 0) {
                try {
                    chrome.runtime.sendMessage({ action: 'GENERATE_LIBRARY_REFRESH', source: 'nhp40' });
                } catch {
                    /* ignore */
                }
            }
            return stats;
        } finally {
            await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_BUSY]: false });
        }
    }

    async function pollLiveSyncLibrary({ force = false } = {}) {
        const flags = await chrome.storage.local.get([
            EMAILCORE_LIVE_SYNC_ENABLED_KEY,
            EMAILCORE_LIVE_SYNC_BUSY,
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
        ]);
        if (flags[EMAILCORE_LIVE_SYNC_BUSY] === true && !force) {
            return { skipped: true, reason: 'busy' };
        }

        const apiBase = normalizeEmailCoreApiBase(flags[CREATY_STORAGE_KEYS.apiBase]);
        const userId = String(flags[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
        const token = String(flags[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
        if (!userId || !token) {
            return { skipped: true, reason: 'missing_creaty' };
        }

        let localEnabled = flags[EMAILCORE_LIVE_SYNC_ENABLED_KEY] === true;
        // Always reconcile with site preference so Live Sync works without same-browser bridge.
        // force=true (bridge SET) still imports when local was just enabled even if server lags briefly.
        await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_BUSY]: true });
        const auth = { apiBase, userId, token };
        try {
            const listUrl = new URL(`${apiBase}/api/extension/designs/generated`);
            listUrl.searchParams.set('userId', userId);
            listUrl.searchParams.set('limit', '200');
            const listRes = await fetch(listUrl, {
                headers: {
                    'x-creaty-token': token,
                    'x-extension-id': chrome.runtime.id,
                },
            });
            const listData = await listRes.json().catch(() => ({}));
            if (!listRes.ok) {
                if (/404|not found/i.test(String(listData?.error || listRes.status))) {
                    return { skipped: true, reason: 'endpoint_missing' };
                }
                throw new Error(listData?.error || `live-sync list HTTP ${listRes.status}`);
            }

            const hasServerFlag = typeof listData?.live_sync_enabled === 'boolean';
            if (hasServerFlag) {
                const serverEnabled = listData.live_sync_enabled === true;
                if (serverEnabled !== localEnabled) {
                    await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_ENABLED_KEY]: serverEnabled });
                    localEnabled = serverEnabled;
                }
                if (!serverEnabled) {
                    return { skipped: true, reason: 'disabled', live_sync_enabled: false };
                }
            } else if (!localEnabled && !force) {
                return { skipped: true, reason: 'disabled' };
            }

            const designs = Array.isArray(listData?.designs) ? listData.designs : [];
            const dismissedStore = await chrome.storage.local.get([EMAILCORE_LIVE_SYNC_DISMISSED_KEY]);
            const dismissed = new Set(
                (Array.isArray(dismissedStore[EMAILCORE_LIVE_SYNC_DISMISSED_KEY])
                    ? dismissedStore[EMAILCORE_LIVE_SYNC_DISMISSED_KEY]
                    : []).map((id) => String(id || '').trim()).filter(Boolean)
            );

            const stats = await importDesignsToGhostLibrary(designs, auth, { dismissed });

            const meta = {
                lastRunAt: new Date().toISOString(),
                imported: stats.imported,
                skipped: stats.skipped,
                failed: stats.failed,
                listed: designs.length,
                live_sync_enabled: hasServerFlag ? listData.live_sync_enabled === true : localEnabled,
            };
            await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_META_KEY]: meta });
            if (stats.imported > 0) {
                try {
                    chrome.runtime.sendMessage({ action: 'GENERATE_LIBRARY_REFRESH', source: 'live-sync' });
                } catch {
                    /* ignore */
                }
            }
            return { ok: true, ...meta };
        } finally {
            await chrome.storage.local.set({ [EMAILCORE_LIVE_SYNC_BUSY]: false });
        }
    }

    async function pollPipelineAlerts() {
        const storedAuth = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
        ]);
        const apiBase = normalizeEmailCoreApiBase(storedAuth[CREATY_STORAGE_KEYS.apiBase]);
        const userId = String(storedAuth[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
        const token = String(storedAuth[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
        if (!userId || !token) return { skipped: true, reason: 'missing_creaty' };
        const auth = { apiBase, userId, token };

        const stored = await chrome.storage.local.get([EMAILCORE_PIPELINE_ALERT_SEEN_KEY]);
        const seenId = Number(stored[EMAILCORE_PIPELINE_ALERT_SEEN_KEY] || 0) || 0;

        let data;
        try {
            data = await creatyGetJson(auth, `/nhp/pipeline-alerts?since_id=${seenId}`);
        } catch (err) {
            // Older deploys may not have the endpoint yet.
            if (/404|not found/i.test(String(err?.message || err))) {
                return { skipped: true, reason: 'endpoint_missing' };
            }
            throw err;
        }

        const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
        const cascade = data?.cascade || {};
        await chrome.storage.local.set({
            [EMAILCORE_PIPELINE_ALERT_OPEN_KEY]: {
                cascade,
                alerts,
                polled_at: new Date().toISOString(),
            },
        });

        const needsAttention = cascade?.status === 'needs_attention' || alerts.length > 0;
        if (!needsAttention) {
            try {
                await chrome.action?.setBadgeText?.({ text: '' });
            } catch {
                /* ignore */
            }
            return { ok: true, alerts: 0 };
        }

        const newest = alerts[0] || cascade?.alert || null;
        const newestId = Number(newest?.id || cascade?.alert?.id || 0) || 0;
        const deepLink = newest?.deep_link
            || cascade?.alert?.deep_link
            || 'https://nocochat.com/admin#teepublic-trends';
        const title = newest?.title || 'Pipeline stopped after 3 retries';
        const message = (newest?.message || cascade?.last_error || 'Open Admin to fix')
            .toString()
            .slice(0, 180);

        try {
            await chrome.action?.setBadgeText?.({ text: '!' });
            await chrome.action?.setBadgeBackgroundColor?.({ color: '#dc2626' });
        } catch {
            /* ignore */
        }

        if (newestId && newestId > seenId) {
            chrome.notifications?.create(`nhp-pipeline-alert-${newestId}`, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: `EmailCore · ${title}`,
                message: `${message}\nOpen Admin`.slice(0, 240),
                priority: 2,
                buttons: [{ title: 'Open Admin' }],
            });
            await chrome.storage.local.set({
                emailcore_pipeline_alert_deeplink: deepLink,
                [EMAILCORE_PIPELINE_ALERT_SEEN_KEY]: newestId,
            });
        }

        return { ok: true, alerts: alerts.length, status: cascade?.status || null };
    }

    async function pollDesignJobsBridge() {
        const storedAuth = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
        ]);
        const apiBase = normalizeEmailCoreApiBase(storedAuth[CREATY_STORAGE_KEYS.apiBase]);
        const userId = String(storedAuth[CREATY_STORAGE_KEYS.userId] || DEFAULT_EMAILCORE_CREATY_USER_ID).trim();
        const token = String(storedAuth[CREATY_STORAGE_KEYS.token] || DEFAULT_EMAILCORE_CREATY_TOKEN).trim();
        if (!userId || !token) return { skipped: true, reason: 'missing_creaty' };

        const url = new URL(`${apiBase}/api/extension/design-jobs/pending`);
        url.searchParams.set('userId', userId);
        url.searchParams.set('limit', '3');
        const response = await fetch(url, {
            headers: {
                'x-creaty-token': token,
                'x-extension-id': chrome.runtime.id,
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (/404|not found/i.test(String(data?.error || response.status))) {
                return { skipped: true, reason: 'endpoint_missing' };
            }
            throw new Error(data?.error || `design-jobs poll HTTP ${response.status}`);
        }

        const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
        for (const job of jobs.slice(0, 1)) {
            const actionPeek = String(job.action || '').trim().toLowerCase();
            // PASTE_T / PASTE_Y desk pin: desktop Ext must NOT claim/stub TeeMaster jobs.
            // Only Oracle W3 Studio Light Ext (:9341) executes teemaster-magic / peel.
            if (
                actionPeek === 'teemaster-magic'
                || actionPeek === 'peel-banana'
                || actionPeek === 'studio.processing.peel'
                || actionPeek === 'studio.processing.remove_background'
                || actionPeek === 'studio.processing.teemaster_pipeline'
            ) {
                continue;
            }

            const claimUrl = `${apiBase}/api/extension/design-jobs/${job.id}/claim`;
            const claimRes = await fetch(claimUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-creaty-token': token,
                    'x-extension-id': chrome.runtime.id,
                },
                body: JSON.stringify({ userId, token, claimedBy: chrome.runtime.id }),
            });
            const claimData = await claimRes.json().catch(() => ({}));
            if (!claimRes.ok || !claimData?.job) continue;

            const claimed = claimData.job;
            const action = String(claimed.action || job.action || '').trim();
            const completeUrl = `${apiBase}/api/extension/design-jobs/${job.id}/complete`;
            const failUrl = `${apiBase}/api/extension/design-jobs/${job.id}/fail`;

            // Site Design Studio Library stage remote-control → Canva Bridge toolbar group.
            if (action === 'library-stage') {
                const stage = String(
                    claimed.payload?.stage
                    || claimed.payload?.ap_stage
                    || job.payload?.stage
                    || job.payload?.ap_stage
                    || ''
                ).trim().toLowerCase();
                const allowed = new Set(['selection', 'naming', 'library', 'processing', 'publishing']);
                try {
                    if (!allowed.has(stage)) {
                        await fetch(failUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-creaty-token': token,
                                'x-extension-id': chrome.runtime.id,
                            },
                            body: JSON.stringify({
                                userId,
                                token,
                                error: `unsupported library stage: ${stage || '(empty)'}`,
                            }),
                        }).catch(() => null);
                        continue;
                    }
                    await chrome.storage.local.set({
                        emailcore_library_stage_pending: {
                            stage,
                            ap_stage: stage,
                            protocol: 'EMAILCORE_LIBRARY_STAGE',
                            at: Date.now(),
                            jobId: claimed.id || job.id,
                        },
                    });
                    try {
                        chrome.runtime.sendMessage({
                            action: 'EMAILCORE_LIBRARY_STAGE',
                            stage,
                            ap_stage: stage,
                            source: 'design-jobs',
                            jobId: claimed.id || job.id,
                        });
                    } catch {
                        /* UI may be closed — storage pending still applies on Canva Bridge init */
                    }
                    await fetch(completeUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-creaty-token': token,
                            'x-extension-id': chrome.runtime.id,
                        },
                        body: JSON.stringify({
                            userId,
                            token,
                            result: {
                                applied: true,
                                stage,
                                ap_stage: stage,
                                protocol: 'EMAILCORE_LIBRARY_STAGE',
                                desk: 'studio',
                            },
                        }),
                    }).catch(() => null);
                } catch (err) {
                    await fetch(failUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-creaty-token': token,
                            'x-extension-id': chrome.runtime.id,
                        },
                        body: JSON.stringify({
                            userId,
                            token,
                            error: String(err?.message || err || 'library-stage failed').slice(0, 500),
                        }),
                    }).catch(() => null);
                }
                continue;
            }

            await fetch(completeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-creaty-token': token,
                    'x-extension-id': chrome.runtime.id,
                },
                body: JSON.stringify({
                    userId,
                    token,
                    result: {
                        stub: true,
                        message: 'Extension bridge connected — use local Ghost Generate for file-path actions (Peel/Path).',
                        action,
                    },
                }),
            }).catch(() => null);
        }

        return { ok: true, jobs: jobs.length, bridge: data?.bridge || null };
    }

    // Open Admin deep link when user clicks a pipeline-alert notification.
    if (!self.__nhpPipelineAlertNotifBound) {
        self.__nhpPipelineAlertNotifBound = true;
        chrome.notifications?.onClicked?.addListener?.(async (notificationId) => {
            if (!String(notificationId || '').startsWith('nhp-pipeline-alert-')) return;
            const stored = await chrome.storage.local.get(['emailcore_pipeline_alert_deeplink']);
            const url = stored.emailcore_pipeline_alert_deeplink
                || 'https://nocochat.com/admin#oracle-monitor';
            try {
                await chrome.tabs.create({ url });
            } catch (err) {
                console.warn('[EmailCore][PipelineAlert] open tab failed:', err?.message || err);
            }
            try {
                chrome.notifications.clear(notificationId);
            } catch {
                /* ignore */
            }
        });
        chrome.notifications?.onButtonClicked?.addListener?.(async (notificationId) => {
            if (!String(notificationId || '').startsWith('nhp-pipeline-alert-')) return;
            const stored = await chrome.storage.local.get(['emailcore_pipeline_alert_deeplink']);
            const url = stored.emailcore_pipeline_alert_deeplink
                || 'https://nocochat.com/admin#oracle-monitor';
            try {
                await chrome.tabs.create({ url });
            } catch {
                /* ignore */
            }
        });
    }

    /**
     * True when CREATY Search Tools sync is the active trends source (replaces old TeePublic/Oracle auto-fetch).
     * Matches sync gate: local toggle on + site not explicitly disabled (fail-open if site status unknown).
     */
    async function isEmailCoreSearchToolsSyncActive() {
        const stored = await chrome.storage.local.get([EMAILCORE_ST_LOCAL_ENABLED, EMAILCORE_ST_META_KEY]);
        if (stored[EMAILCORE_ST_LOCAL_ENABLED] === false) return false;
        const meta = (stored[EMAILCORE_ST_META_KEY] && typeof stored[EMAILCORE_ST_META_KEY] === 'object')
            ? stored[EMAILCORE_ST_META_KEY]
            : {};
        if (meta.siteEnabled === false) return false;
        if (meta.trendsSkip === 'site_disabled' || meta.feedsSkip === 'site_disabled') return false;
        return true;
    }
    self.isEmailCoreSearchToolsSyncActive = isEmailCoreSearchToolsSyncActive;

    function normalizeTrendName(item) {
        if (typeof item === 'string') return item.trim();
        return String(item?.text || item?.title || item?.niche || item?.niche_display || item?.name || '').trim();
    }

    function nicheNamesFromList(list) {
        const out = [];
        const seen = new Set();
        for (const item of Array.isArray(list) ? list : []) {
            const name = normalizeTrendName(item);
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(name);
        }
        return out;
    }

    async function resolveCreatyAuthForSync() {
        const stored = await chrome.storage.local.get([
            CREATY_STORAGE_KEYS.apiBase,
            CREATY_STORAGE_KEYS.userId,
            CREATY_STORAGE_KEYS.token,
            ...Object.values(EMAILCORE_SESSION_KEYS),
            EMAILCORE_ST_LOCAL_ENABLED,
        ]);
        if (stored[EMAILCORE_ST_LOCAL_ENABLED] === false) {
            return { skip: true, reason: 'local_disabled' };
        }
        const auth = await readEmailCoreAuth({ apiBase: stored[CREATY_STORAGE_KEYS.apiBase] });
        const sessionToken = auth.sessionToken || auth.token;
        if (!auth.userId || !sessionToken) return { skip: true, reason: 'missing_session' };
        return { ...auth, token: sessionToken };
    }

    async function creatyGetJson(auth, path) {
        const url = new URL(`${auth.apiBase}/api/creaty${path}`);
        if (auth.userId) url.searchParams.set('userId', auth.userId);
        const headers = { 'content-type': 'application/json' };
        const sessionToken = auth.sessionToken || auth.token;
        if (!sessionToken) {
            throw new Error('EmailCore session missing — Admin → Integrations login');
        }
        if (sessionToken.includes('.')) {
            headers['x-extension-session'] = sessionToken;
        } else {
            headers['x-creaty-token'] = sessionToken;
        }
        const response = await fetch(url, { headers });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(formatCreatyApiError(data, response.status));
        }
        return data;
    }

    async function patchSearchToolsSyncMeta(patch) {
        const cur = await chrome.storage.local.get([EMAILCORE_ST_META_KEY]);
        const prev = (cur[EMAILCORE_ST_META_KEY] && typeof cur[EMAILCORE_ST_META_KEY] === 'object')
            ? cur[EMAILCORE_ST_META_KEY]
            : {};
        const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
        await chrome.storage.local.set({ [EMAILCORE_ST_META_KEY]: next });
        return next;
    }

    async function isSiteAutoSyncEnabled(auth) {
        try {
            const settings = await creatyGetJson(auth, '/nhp/extension-sync/settings');
            const enabled = settings?.enabled !== false;
            await patchSearchToolsSyncMeta({
                siteEnabled: enabled,
                siteIntervals: settings?.intervals || null,
                siteSettingsError: null,
            });
            return enabled;
        } catch (err) {
            // Fail-open locally if settings endpoint missing (older deploy): allow sync.
            const msg = String(err?.message || err);
            await patchSearchToolsSyncMeta({ siteSettingsError: msg });
            if (/404|not found/i.test(msg)) return true;
            console.warn('[EmailCore][SearchToolsSync] settings check failed:', msg);
            return true;
        }
    }

    async function syncSearchToolsTrends({ force = false } = {}) {
        const busy = await chrome.storage.local.get([EMAILCORE_ST_TRENDS_BUSY]);
        if (busy[EMAILCORE_ST_TRENDS_BUSY] && !force) return { skipped: true, reason: 'busy' };

        const auth = await resolveCreatyAuthForSync();
        if (auth.skip) {
            await patchSearchToolsSyncMeta({ trendsSkip: auth.reason, trendsLastError: null });
            return { skipped: true, reason: auth.reason };
        }

        await chrome.storage.local.set({ [EMAILCORE_ST_TRENDS_BUSY]: true });
        try {
            if (!(await isSiteAutoSyncEnabled(auth))) {
                await patchSearchToolsSyncMeta({
                    trendsSkip: 'site_disabled',
                    trendsLastAttemptAt: new Date().toISOString(),
                });
                return { skipped: true, reason: 'site_disabled' };
            }

            const data = await creatyGetJson(auth, '/nhp/teepublic-trends');
            if (data?.extension_auto_sync_enabled === false) {
                await patchSearchToolsSyncMeta({ siteEnabled: false, trendsSkip: 'site_disabled' });
                return { skipped: true, reason: 'site_disabled' };
            }

            const names = nicheNamesFromList(data?.trends || data?.items || []);
            if (!names.length) {
                // Honest: keep previous dailyTrends; do not invent or wipe.
                await patchSearchToolsSyncMeta({
                    trendsLastAttemptAt: new Date().toISOString(),
                    trendsLastError: data?.error || 'empty_trends_snapshot',
                    trendsSource: data?.source || null,
                    trendsCount: 0,
                });
                return { ok: true, updated: false, count: 0, reason: 'empty' };
            }

            const now = new Date();
            const label = now.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
            await chrome.storage.local.set({
                dailyTrends: names,
                trendLastUpdate: label,
                trendLastFetchDate: now.toISOString().slice(0, 10),
                trendLastSource: 'emailcore',
            });
            await patchSearchToolsSyncMeta({
                trendsLastSuccessAt: now.toISOString(),
                trendsLastAttemptAt: now.toISOString(),
                trendsLastError: null,
                trendsSource: data?.source || 'emailcore-teepublic-trends',
                trendsCount: names.length,
                trendsSkip: null,
                trendsFetchedAt: data?.fetched_at || null,
            });
            return { ok: true, updated: true, count: names.length };
        } catch (err) {
            const msg = String(err?.message || err);
            await patchSearchToolsSyncMeta({
                trendsLastAttemptAt: new Date().toISOString(),
                trendsLastError: msg,
            });
            throw err;
        } finally {
            await chrome.storage.local.set({ [EMAILCORE_ST_TRENDS_BUSY]: false });
        }
    }

    async function syncSearchToolsOtherFeeds({ force = false } = {}) {
        const busy = await chrome.storage.local.get([EMAILCORE_ST_FEEDS_BUSY]);
        if (busy[EMAILCORE_ST_FEEDS_BUSY] && !force) return { skipped: true, reason: 'busy' };

        const auth = await resolveCreatyAuthForSync();
        if (auth.skip) {
            await patchSearchToolsSyncMeta({ feedsSkip: auth.reason });
            return { skipped: true, reason: auth.reason };
        }

        await chrome.storage.local.set({ [EMAILCORE_ST_FEEDS_BUSY]: true });
        const branchResults = {};
        try {
            if (!(await isSiteAutoSyncEnabled(auth))) {
                await patchSearchToolsSyncMeta({
                    feedsSkip: 'site_disabled',
                    feedsLastAttemptAt: new Date().toISOString(),
                });
                return { skipped: true, reason: 'site_disabled' };
            }

            const runState = await chrome.storage.local.get(['uRunning', 'tpRunning']);
            const nowIso = new Date().toISOString();

            // Safe niches → uSafe (skip while local USPTO run is active)
            try {
                const safeData = await creatyGetJson(auth, '/nhp/safe-niches');
                const niches = nicheNamesFromList(safeData?.niches || safeData?.items || []);
                if (runState.uRunning) {
                    branchResults.safe = { skipped: true, reason: 'uRunning' };
                } else if (niches.length) {
                    await chrome.storage.local.set({ uSafe: niches });
                    branchResults.safe = {
                        ok: true,
                        count: niches.length,
                        source: safeData?.source || null,
                        fetched_at: safeData?.fetched_at || null,
                    };
                } else {
                    branchResults.safe = {
                        ok: true,
                        updated: false,
                        reason: safeData?.error || 'empty',
                        source: safeData?.source || null,
                    };
                }
            } catch (err) {
                branchResults.safe = { ok: false, error: String(err?.message || err) };
            }

            // Classified → Analysis buckets (skip while local analysis run is active)
            try {
                const classified = await creatyGetJson(auth, '/nhp/classified-niches');
                const excellent = nicheNamesFromList(classified?.excellent || classified?.buckets?.excellent || []);
                const medium = nicheNamesFromList(classified?.medium || classified?.buckets?.medium || []);
                const saturated = nicheNamesFromList(classified?.saturated || classified?.buckets?.saturated || []);
                const empty = nicheNamesFromList(classified?.empty || classified?.buckets?.empty || []);
                const total = excellent.length + medium.length + saturated.length + empty.length;
                if (runState.tpRunning) {
                    branchResults.classified = { skipped: true, reason: 'tpRunning' };
                } else if (total > 0) {
                    await chrome.storage.local.set({
                        tpExcel: excellent,
                        tpMed: medium,
                        tpSat: saturated,
                        tpEmp: empty,
                    });
                    branchResults.classified = {
                        ok: true,
                        count: total,
                        source: classified?.source || null,
                        fetched_at: classified?.fetched_at || null,
                        buckets: {
                            excellent: excellent.length,
                            medium: medium.length,
                            saturated: saturated.length,
                            empty: empty.length,
                        },
                    };
                } else {
                    branchResults.classified = {
                        ok: true,
                        updated: false,
                        reason: classified?.error || 'empty',
                        source: classified?.source || null,
                    };
                }
            } catch (err) {
                branchResults.classified = { ok: false, error: String(err?.message || err) };
            }

            // Design images gallery cache (Search Tools adjacent / Notes image hunt context)
            try {
                const images = await creatyGetJson(auth, '/nhp/design-images');
                const groups = Array.isArray(images?.groups) ? images.groups : [];
                const eligible = Array.isArray(images?.eligible_niches) ? images.eligible_niches : [];
                if (groups.length || eligible.length) {
                    await chrome.storage.local.set({
                        [EMAILCORE_ST_DESIGN_KEY]: {
                            groups,
                            eligible_niches: eligible,
                            fetched_at: images?.fetched_at || null,
                            source: images?.source || null,
                            synced_at: nowIso,
                        },
                    });
                    branchResults.designImages = {
                        ok: true,
                        groups: groups.length,
                        eligible: eligible.length,
                        source: images?.source || null,
                    };
                } else {
                    branchResults.designImages = {
                        ok: true,
                        updated: false,
                        reason: images?.error || 'empty',
                    };
                }
            } catch (err) {
                branchResults.designImages = { ok: false, error: String(err?.message || err) };
            }

            // Early Radar (unofficial) — store feed + map into Notes unofficialTrends when present
            try {
                const radar = await creatyGetJson(auth, '/nhp/early-radar');
                const opportunities = Array.isArray(radar?.opportunities) ? radar.opportunities : [];
                await chrome.storage.local.set({
                    [EMAILCORE_ST_EARLY_KEY]: {
                        opportunities,
                        fetched_at: radar?.fetched_at || null,
                        source: radar?.source || 'early_radar',
                        synced_at: nowIso,
                        not_official_teepublic_trend: true,
                    },
                });
                if (opportunities.length) {
                    const unofficialTrends = opportunities.map((op) => {
                        const text = String(op?.niche || op?.text || op?.keyword || '').trim();
                        return {
                            text,
                            keyword: text,
                            niche: text,
                            label: 'الرادار',
                            sourceType: 'early_radar',
                            intake_source: 'early_radar',
                            from_early_radar: true,
                            analysisStatus: op?.analysis_status || op?.analysisStatus || '',
                            usptoStatus: op?.trademark_status || op?.uspto_status || op?.usptoStatus || '',
                            todayScore: Number.isFinite(op?.discovery_score) ? op.discovery_score : (Number.isFinite(op?.score) ? op.score : undefined),
                            discoveryRank: Number.isFinite(op?.rank) ? op.rank : undefined,
                            trendVelocity: op?.trend_velocity || '',
                            confidence: op?.confidence || '',
                            podSuitability: Number.isFinite(op?.pod_suitability) ? op.pod_suitability : undefined,
                            updatedAt: radar?.fetched_at || nowIso,
                        };
                    }).filter((x) => x.text);

                    const mgr = await chrome.storage.local.get(['teepublic_manager_data']);
                    const prev = (mgr.teepublic_manager_data && typeof mgr.teepublic_manager_data === 'object')
                        ? mgr.teepublic_manager_data
                        : {};
                    await chrome.storage.local.set({
                        teepublic_manager_data: {
                            ...prev,
                            unofficialTrends,
                        },
                    });
                }
                branchResults.earlyRadar = {
                    ok: true,
                    count: opportunities.length,
                    source: radar?.source || 'early_radar',
                    fetched_at: radar?.fetched_at || null,
                };
            } catch (err) {
                branchResults.earlyRadar = { ok: false, error: String(err?.message || err) };
            }

            // Final-clean (active Notes niches) — soft cache only; Notes UI also auto-pulls on open
            try {
                const clean = await creatyGetJson(auth, '/nhp/final-clean');
                const items = Array.isArray(clean?.items) ? clean.items : [];
                await chrome.storage.local.set({
                    nhpFinalCleanFeed: {
                        items,
                        count: items.length,
                        synced_at: nowIso,
                        generated_at: clean?.generated_at || null,
                    },
                });
                branchResults.finalClean = { ok: true, count: items.length };
            } catch (err) {
                branchResults.finalClean = { ok: false, error: String(err?.message || err) };
            }

            const errors = Object.entries(branchResults)
                .filter(([, v]) => v?.ok === false)
                .map(([k, v]) => `${k}: ${v.error}`);
            await patchSearchToolsSyncMeta({
                feedsLastAttemptAt: nowIso,
                feedsLastSuccessAt: errors.length === Object.keys(branchResults).length ? null : nowIso,
                feedsLastError: errors.length ? errors.join(' | ') : null,
                feedsSkip: null,
                branches: branchResults,
            });
            return { ok: true, branches: branchResults };
        } finally {
            await chrome.storage.local.set({ [EMAILCORE_ST_FEEDS_BUSY]: false });
        }
    }

    chrome.alarms.create(EMAILCORE_MAIL_ALARM, { periodInMinutes: 1 });
    chrome.alarms.create(EMAILCORE_TP_ASSIST_ALARM, { periodInMinutes: 2 });
    chrome.alarms.create(EMAILCORE_ST_TRENDS_ALARM, { periodInMinutes: 15 });
    chrome.alarms.create(EMAILCORE_ST_FEEDS_ALARM, { periodInMinutes: 6 * 60 });
    chrome.alarms.create(EMAILCORE_PIPELINE_ALERT_ALARM, { periodInMinutes: 1 });
    chrome.alarms.create(EMAILCORE_DESIGN_JOBS_ALARM, { periodInMinutes: 1 });
    chrome.alarms.create(EMAILCORE_LIVE_SYNC_ALARM, { periodInMinutes: 1 });
    // Faster pickup for UI remote-control (library-stage) while SW is awake.
    if (!self.__nhpDesignJobsFastPoll) {
        self.__nhpDesignJobsFastPoll = true;
        setInterval(() => {
            pollDesignJobsBridge().catch(() => {});
        }, 8000);
        pollDesignJobsBridge().catch(() => {});
    }
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === EMAILCORE_MAIL_ALARM) {
            pollEmailCoreMessages().catch((error) => {
                const msg = error?.message || String(error);
                if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch failed')) {
                    return;
                }
                console.warn('[EmailCore] mail poll:', msg);
            });
            return;
        }
        if (alarm.name === EMAILCORE_PIPELINE_ALERT_ALARM) {
            pollPipelineAlerts().catch((error) => {
                const msg = error?.message || String(error);
                if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return;
                console.warn('[EmailCore][PipelineAlert]', msg);
            });
            return;
        }
        if (alarm.name === EMAILCORE_DESIGN_JOBS_ALARM) {
            pollDesignJobsBridge().catch((error) => {
                const msg = error?.message || String(error);
                if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return;
                console.warn('[EmailCore][DesignJobsBridge]', msg);
            });
            return;
        }
        if (alarm.name === EMAILCORE_LIVE_SYNC_ALARM) {
            pollLiveSyncLibrary().catch((error) => {
                const msg = error?.message || String(error);
                if (/Failed to fetch|NetworkError|fetch failed|Ghost library unreachable/i.test(msg)) return;
                console.warn('[EmailCore][LiveSync]', msg);
            });
            return;
        }
        if (alarm.name === EMAILCORE_TP_ASSIST_ALARM) {
            pollEarlyRadarTpAssist().catch((error) => {
                const msg = error?.message || String(error);
                if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch failed')) {
                    return;
                }
                console.warn('[EmailCore][TP-assist]', msg);
            });
            return;
        }
        if (alarm.name === EMAILCORE_ST_TRENDS_ALARM) {
            syncSearchToolsTrends().catch((error) => {
                const msg = error?.message || String(error);
                if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return;
                console.warn('[EmailCore][SearchToolsSync][trends]', msg);
            });
            return;
        }
        if (alarm.name === EMAILCORE_ST_FEEDS_ALARM) {
            syncSearchToolsOtherFeeds().catch((error) => {
                const msg = error?.message || String(error);
                if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return;
                console.warn('[EmailCore][SearchToolsSync][feeds]', msg);
            });
        }
    });

    // Kick once shortly after SW wake (debounced by busy flags).
    setTimeout(() => {
        syncSearchToolsTrends().catch(() => {});
    }, 20_000);
    setTimeout(() => {
        syncSearchToolsOtherFeeds().catch(() => {});
    }, 45_000);
    setTimeout(() => {
        pollPipelineAlerts().catch(() => {});
    }, 25_000);
    setTimeout(() => {
        pollDesignJobsBridge().catch(() => {});
    }, 30_000);
    setTimeout(() => {
        pollLiveSyncLibrary().catch(() => {});
    }, 35_000);

    // Message hooks for Admin / popup manual sync + status
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        const action = request?.action;
        if (action === 'EMAILCORE_SEARCH_TOOLS_SYNC_TRENDS') {
            syncSearchToolsTrends({ force: !!request.force })
                .then((data) => sendResponse({ ok: true, data }))
                .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
            return true;
        }
        if (action === 'EMAILCORE_SEARCH_TOOLS_SYNC_FEEDS') {
            syncSearchToolsOtherFeeds({ force: !!request.force })
                .then((data) => sendResponse({ ok: true, data }))
                .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
            return true;
        }
        if (action === 'EMAILCORE_SEARCH_TOOLS_SYNC_STATUS') {
            chrome.storage.local.get([
                EMAILCORE_ST_META_KEY,
                EMAILCORE_ST_LOCAL_ENABLED,
            ], (stored) => {
                sendResponse({
                    ok: true,
                    localEnabled: stored[EMAILCORE_ST_LOCAL_ENABLED] !== false,
                    meta: stored[EMAILCORE_ST_META_KEY] || {},
                });
            });
            return true;
        }
        return false;
    });

    setTimeout(() => {
        pollEarlyRadarTpAssist().catch(() => {});
    }, 25_000);
})();
