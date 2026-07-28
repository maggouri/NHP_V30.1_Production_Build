/**
 * EmailCore Auth Bridge — SSOT for Ext ↔ EmailCore account binding.
 * No manual Access Token / User ID required. No admin fallback.
 *
 * Classic script (importScripts + optional window global for pages that load it).
 */
(function initEmailCoreAuthBridge(globalScope) {
    'use strict';

    if (globalScope.EmailCoreAuthBridge) return;

    const DEFAULT_API_BASE = 'https://emailcore.app';

    const STORAGE_KEYS = Object.freeze({
        apiBase: 'emailcore_creaty_api_base',
        creatyToken: 'emailcore_creaty_token',
        creatyUserId: 'emailcore_creaty_user_id',
        sessionToken: 'emailcore_session_token',
        sessionUserId: 'emailcore_session_user_id',
        sessionUsername: 'emailcore_session_username',
        sessionRole: 'emailcore_session_role',
        sessionTier: 'emailcore_session_tier',
        sessionExpiresAt: 'emailcore_session_expires_at',
        sessionEmail: 'emailcore_session_email',
    });

    const CONNECTION_STATES = Object.freeze({
        CONNECTED: 'connected',
        CONNECTING: 'connecting',
        NOT_AUTHENTICATED: 'not_authenticated',
        PERMISSION_DENIED: 'permission_denied',
        SERVER_UNAVAILABLE: 'server_unavailable',
    });

    const MSG_NOT_AUTHENTICATED_AR =
        'سجّل الدخول بنفس الحساب في الموقع والإضافة (مركز الإدارة → التكاملات)';
    const MSG_NOT_AUTHENTICATED_EN =
        'Sign in with the same account on the site and extension (Admin → Integrations)';

    function normalizeApiBase(value) {
        let base = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
        try {
            const url = new URL(base);
            if (url.hostname === 'www.emailcore.app') url.hostname = 'emailcore.app';
            base = url.origin;
        } catch (_) {
            /* keep raw */
        }
        return base || DEFAULT_API_BASE;
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
                chrome.storage.local.set(patch, () => resolve(true));
            } catch (_) {
                resolve(false);
            }
        });
    }

    function normalizeRole(role) {
        const r = String(role || '').trim().toLowerCase();
        if (r === 'admin' || r === 'owner') return 'admin';
        return 'member';
    }

    /**
     * Diagnostic log — never includes full access tokens / passwords.
     */
    function logBindingDiag(serviceName, account, extra = {}) {
        try {
            console.info('[EmailCoreAuthBridge]', {
                service: String(serviceName || 'unknown'),
                authenticated: !!account?.authenticated,
                userId: account?.userId ? String(account.userId) : '',
                accountId: account?.accountId ? String(account.accountId) : '',
                role: account?.role || '',
                authSource: account?.authSource || 'none',
                connectionState: account?.connectionState || '',
                hasSession: !!account?.sessionToken,
                hasCreatyToken: !!account?.accessToken,
                requestStatus: extra.requestStatus || null,
                errorCode: extra.errorCode || null,
            });
        } catch (_) {
            /* ignore */
        }
    }

    function unauthenticatedAccount(apiBase, reason = 'not_authenticated') {
        return {
            authenticated: false,
            userId: '',
            email: '',
            username: '',
            role: 'member',
            tier: '',
            accountId: '',
            accessToken: undefined,
            sessionToken: '',
            apiBase: normalizeApiBase(apiBase),
            authSource: 'none',
            connectionState: CONNECTION_STATES.NOT_AUTHENTICATED,
            reason,
            messageAr: MSG_NOT_AUTHENTICATED_AR,
            messageEn: MSG_NOT_AUTHENTICATED_EN,
        };
    }

    /**
     * SSOT: resolve current authenticated EmailCore account from chrome.storage.
     * Never falls back to a hardcoded admin userId/token.
     */
    async function getCurrentAuthenticatedAccount(options = {}) {
        const stored = await readStorage(Object.values(STORAGE_KEYS));
        const apiBase = normalizeApiBase(options.apiBase || stored[STORAGE_KEYS.apiBase]);

        const sessionToken = String(stored[STORAGE_KEYS.sessionToken] || '').trim();
        const sessionUserId = String(stored[STORAGE_KEYS.sessionUserId] || '').trim();
        const creatyToken = String(stored[STORAGE_KEYS.creatyToken] || '').trim();
        const creatyUserId = String(stored[STORAGE_KEYS.creatyUserId] || '').trim();

        if (sessionToken && sessionUserId) {
            const role = normalizeRole(stored[STORAGE_KEYS.sessionRole]);
            const account = {
                authenticated: true,
                userId: sessionUserId,
                email: String(stored[STORAGE_KEYS.sessionEmail] || '').trim(),
                username: String(stored[STORAGE_KEYS.sessionUsername] || '').trim(),
                role,
                tier: String(stored[STORAGE_KEYS.sessionTier] || 'bronze').trim(),
                accountId: sessionUserId,
                accessToken: creatyToken || undefined,
                sessionToken,
                apiBase,
                authSource: 'extension_session',
                connectionState: CONNECTION_STATES.CONNECTED,
                expiresAt: String(stored[STORAGE_KEYS.sessionExpiresAt] || '').trim(),
            };
            if (options.service) logBindingDiag(options.service, account);
            return account;
        }

        // Legacy creaty token only if explicitly stored for THIS user (never invent defaults).
        if (creatyUserId && creatyToken) {
            const account = {
                authenticated: true,
                userId: creatyUserId,
                email: '',
                username: '',
                role: 'member',
                tier: '',
                accountId: creatyUserId,
                accessToken: creatyToken,
                sessionToken: '',
                apiBase,
                authSource: 'creaty_token',
                connectionState: CONNECTION_STATES.CONNECTED,
            };
            if (options.service) logBindingDiag(options.service, account);
            return account;
        }

        const empty = unauthenticatedAccount(apiBase);
        if (options.service) logBindingDiag(options.service, empty);
        return empty;
    }

    /** @deprecated alias — prefer getCurrentAuthenticatedAccount */
    async function readEmailCoreAuth(options = {}) {
        const account = await getCurrentAuthenticatedAccount(options);
        if (!account.authenticated) {
            return {
                apiBase: account.apiBase,
                userId: '',
                sessionToken: '',
                token: '',
                role: 'member',
                tier: '',
                username: '',
            };
        }
        return {
            apiBase: account.apiBase,
            userId: account.userId,
            sessionToken: account.sessionToken || '',
            token: account.accessToken || '',
            role: account.role,
            tier: account.tier,
            username: account.username,
            email: account.email,
            authSource: account.authSource,
            accountId: account.accountId,
        };
    }

    function authCredential(accountOrAuth) {
        return String(
            accountOrAuth?.sessionToken
            || accountOrAuth?.accessToken
            || accountOrAuth?.token
            || ''
        ).trim();
    }

    function buildAuthHeaders(accountOrAuth, extra = {}) {
        const headers = { ...(extra || {}) };
        const sessionToken = String(accountOrAuth?.sessionToken || '').trim();
        const creatyToken = String(accountOrAuth?.accessToken || accountOrAuth?.token || '').trim();
        if (sessionToken) {
            headers['x-extension-session'] = sessionToken;
        } else if (creatyToken) {
            headers['x-creaty-token'] = creatyToken;
        }
        return headers;
    }

    /**
     * Mint/store per-user CREATY HMAC from extension session (members + admin).
     * Never required from manual UI.
     */
    async function ensureCreatyToken(options = {}) {
        const account = options.account || await getCurrentAuthenticatedAccount({ service: options.service || 'ensureCreatyToken' });
        if (!account.authenticated || !account.sessionToken || !account.userId) {
            return { ok: false, token: '', reason: 'not_authenticated', account };
        }
        if (account.accessToken && !options.force) {
            return { ok: true, token: account.accessToken, reason: 'cached', account };
        }
        try {
            const res = await fetch(`${account.apiBase}/api/creaty/extension-token`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-extension-session': account.sessionToken,
                },
                body: JSON.stringify({ userId: account.userId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.token) {
                logBindingDiag(options.service || 'ensureCreatyToken', account, {
                    requestStatus: res.status,
                    errorCode: 'token_mint_failed',
                });
                return { ok: false, token: '', reason: 'token_mint_failed', account, status: res.status };
            }
            const token = String(data.token).trim();
            await writeStorage({
                [STORAGE_KEYS.creatyToken]: token,
                [STORAGE_KEYS.creatyUserId]: account.userId,
                [STORAGE_KEYS.apiBase]: account.apiBase,
            });
            const next = { ...account, accessToken: token };
            logBindingDiag(options.service || 'ensureCreatyToken', next, { requestStatus: 200 });
            return { ok: true, token, reason: 'minted', account: next };
        } catch (err) {
            logBindingDiag(options.service || 'ensureCreatyToken', account, {
                requestStatus: 0,
                errorCode: 'server_unavailable',
            });
            return {
                ok: false,
                token: '',
                reason: 'server_unavailable',
                account,
                error: String(err?.message || err),
            };
        }
    }

    /**
     * Resolve auth for outbound EmailCore calls. Optionally ensures creaty token
     * for routes that still require HMAC (e.g. /api/extension/* after server fix prefers session).
     */
    async function resolveForService(serviceName, options = {}) {
        let account = await getCurrentAuthenticatedAccount({ service: serviceName });
        if (!account.authenticated) {
            return {
                ok: false,
                account,
                connectionState: CONNECTION_STATES.NOT_AUTHENTICATED,
                error: MSG_NOT_AUTHENTICATED_AR,
                errorEn: MSG_NOT_AUTHENTICATED_EN,
                errorCode: 'not_authenticated',
            };
        }
        if (options.ensureCreatyToken) {
            const minted = await ensureCreatyToken({ account, service: serviceName, force: options.forceToken });
            if (minted.account) account = minted.account;
            if (!account.accessToken && !account.sessionToken) {
                return {
                    ok: false,
                    account,
                    connectionState: CONNECTION_STATES.NOT_AUTHENTICATED,
                    error: MSG_NOT_AUTHENTICATED_AR,
                    errorCode: 'not_authenticated',
                };
            }
        }
        return {
            ok: true,
            account,
            connectionState: CONNECTION_STATES.CONNECTED,
            headers: buildAuthHeaders(account),
            userId: account.userId,
            accountId: account.accountId,
            apiBase: account.apiBase,
        };
    }

    function classifyHttpError(status, data = {}) {
        const code = Number(status) || 0;
        if (code === 401 || code === 403) {
            const msg = String(data.error || data.message || '');
            if (/permission|forbidden|admin|role/i.test(msg)) {
                return {
                    connectionState: CONNECTION_STATES.PERMISSION_DENIED,
                    errorCode: 'permission_denied',
                    error: msg || 'ليس لديك صلاحية لهذا الإجراء',
                };
            }
            return {
                connectionState: CONNECTION_STATES.NOT_AUTHENTICATED,
                errorCode: 'not_authenticated',
                error: MSG_NOT_AUTHENTICATED_AR,
            };
        }
        if (code >= 500 || code === 0) {
            return {
                connectionState: CONNECTION_STATES.SERVER_UNAVAILABLE,
                errorCode: 'server_unavailable',
                error: 'خادم EmailCore غير متاح حالياً',
            };
        }
        return {
            connectionState: CONNECTION_STATES.SERVER_UNAVAILABLE,
            errorCode: 'request_failed',
            error: String(data.error || data.message || `HTTP ${code}`),
        };
    }

    function notAuthenticatedMessage(lang = 'ar') {
        return lang === 'en' ? MSG_NOT_AUTHENTICATED_EN : MSG_NOT_AUTHENTICATED_AR;
    }

    const api = {
        STORAGE_KEYS,
        CONNECTION_STATES,
        DEFAULT_API_BASE,
        MSG_NOT_AUTHENTICATED_AR,
        MSG_NOT_AUTHENTICATED_EN,
        normalizeApiBase,
        getCurrentAuthenticatedAccount,
        readEmailCoreAuth,
        authCredential,
        buildAuthHeaders,
        ensureCreatyToken,
        resolveForService,
        classifyHttpError,
        notAuthenticatedMessage,
        logBindingDiag,
    };

    globalScope.EmailCoreAuthBridge = api;
    globalScope.getCurrentAuthenticatedAccount = getCurrentAuthenticatedAccount;
    globalScope.readEmailCoreAuth = readEmailCoreAuth;
    globalScope.normalizeEmailCoreApiBase = normalizeApiBase;
    globalScope.CREATY_STORAGE_KEYS = {
        apiBase: STORAGE_KEYS.apiBase,
        token: STORAGE_KEYS.creatyToken,
        userId: STORAGE_KEYS.creatyUserId,
    };
})(typeof self !== 'undefined' ? self : globalThis);
