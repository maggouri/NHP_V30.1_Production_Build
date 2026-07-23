/**
 * Global HTTP proxy auth (MV3 webRequest.onAuthRequired) + Creaty window mutex.
 * Fixes HTTP 407 when extension tabs use a proxied Chrome profile / system proxy.
 */
(function initCreatyProxyAuth() {
    if (self.__creatyProxyAuthReady) return;
    self.__creatyProxyAuthReady = true;

    const STORAGE_KEY = 'creaty_proxy_auth';
    const BLANK_STUCK_MS = 3200;
    const DEFAULT_SIGNUP_URL = 'https://www.teepublic.com/users/sign_up';

    let proxyAuthCache = null;
    let isCreatingWindow = false;
    let authChallengeActive = false;
    let authChallengeSettledAt = 0;

    /** @type {Map<number, { sessionId: string, email: string, signupUrl: string, blankSince: number }>} */
    const creatyAutomationTabs = new Map();

    function delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function normalizeHost(host) {
        return String(host || '').trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    }

    function parseProxyCredentials(proxyStr) {
        const proxy = String(proxyStr || '').trim();
        if (!proxy || proxy.toUpperCase() === 'WIFI') {
            return { host: '', port: '', username: '', password: '', raw: proxy };
        }
        const parts = proxy.split(':');
        if (parts.length < 2) {
            return { host: '', port: '', username: '', password: '', raw: proxy };
        }
        const hasAuth = parts.length >= 4;
        return {
            host: parts[0],
            port: parts[1],
            username: hasAuth ? parts[2] : '',
            password: hasAuth ? parts.slice(3).join(':') : '',
            raw: proxy,
        };
    }

    function hostMatchesProxyChallenge(challengerHost, cachedHost) {
        const a = normalizeHost(challengerHost);
        const b = normalizeHost(cachedHost);
        if (!a || !b) return true;
        return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
    }

    function getCachedProxyCredentials() {
        if (proxyAuthCache?.username) return proxyAuthCache;
        return null;
    }

    async function hydrateProxyAuthFromSession() {
        try {
            const items = await chrome.storage.session.get(STORAGE_KEY);
            const stored = items?.[STORAGE_KEY];
            if (stored?.username) {
                proxyAuthCache = { ...stored };
            }
        } catch (err) {
            console.warn('[CREATY ProxyAuth] session hydrate failed:', err?.message || err);
        }
    }

    async function cacheProxyCredentials(proxyStr, meta = {}) {
        const parsed = parseProxyCredentials(proxyStr);
        if (!parsed.username) {
            return false;
        }
        proxyAuthCache = {
            username: parsed.username,
            password: parsed.password,
            host: parsed.host,
            port: parsed.port,
            raw: parsed.raw,
            email: String(meta.email || '').trim(),
            sessionId: String(meta.sessionId || '').trim(),
            cachedAt: Date.now(),
        };
        try {
            await chrome.storage.session.set({ [STORAGE_KEY]: proxyAuthCache });
        } catch (err) {
            console.warn('[CREATY ProxyAuth] session persist failed:', err?.message || err);
        }
        return true;
    }

    async function clearProxyCredentials() {
        proxyAuthCache = null;
        try {
            await chrome.storage.session.remove(STORAGE_KEY);
        } catch (_) { /* ignore */ }
    }

    function isWindowLockActive() {
        return isCreatingWindow;
    }

    async function acquireWindowLock(label = 'creaty') {
        if (isCreatingWindow) {
            throw new Error(`Creaty window lock active (${label}) — تجنّب فتح نافذة مكررة`);
        }
        isCreatingWindow = true;
    }

    function releaseWindowLock() {
        isCreatingWindow = false;
    }

    async function waitForAuthReady({ timeoutMs = 10000, pollMs = 120 } = {}) {
        const deadline = Date.now() + Math.max(500, timeoutMs);
        while (Date.now() < deadline) {
            if (!authChallengeActive) {
                const settledFor = Date.now() - authChallengeSettledAt;
                if (authChallengeSettledAt === 0 || settledFor >= 250) {
                    return true;
                }
            }
            await delay(pollMs);
        }
        return !authChallengeActive;
    }

    function tagCreatyAutomationTab(tabId, meta = {}) {
        if (!tabId) return;
        creatyAutomationTabs.set(tabId, {
            sessionId: String(meta.sessionId || '').trim(),
            email: String(meta.email || '').trim(),
            signupUrl: String(meta.signupUrl || DEFAULT_SIGNUP_URL).trim() || DEFAULT_SIGNUP_URL,
            blankSince: 0,
        });
    }

    function untagCreatyAutomationTab(tabId) {
        creatyAutomationTabs.delete(tabId);
    }

    async function guardedTabsCreate(createOptions, meta = {}) {
        await acquireWindowLock('tabs.create');
        try {
            await waitForAuthReady({ timeoutMs: 12000 });
            const tab = await chrome.tabs.create(createOptions);
            if (tab?.id) {
                tagCreatyAutomationTab(tab.id, meta);
            }
            return tab;
        } finally {
            releaseWindowLock();
        }
    }

    async function guardedWindowsCreate(createOptions, meta = {}) {
        await acquireWindowLock('windows.create');
        try {
            await waitForAuthReady({ timeoutMs: 12000 });
            const win = await nhpSafeWindowsCreate(createOptions);
            const tabId = win?.tabs?.[0]?.id;
            if (tabId) {
                tagCreatyAutomationTab(tabId, meta);
            }
            return win;
        } finally {
            releaseWindowLock();
        }
    }

    function handleAuthRequired(details, callback) {
        authChallengeActive = true;
        try {
            const creds = getCachedProxyCredentials();
            const challengerHost = details?.challenger?.host || '';
            const isProxyChallenge = details?.isProxy === true;
            const shouldSupply = !!(
                creds?.username
                && (isProxyChallenge || !creds.host || hostMatchesProxyChallenge(challengerHost, creds.host))
            );
            if (shouldSupply) {
                callback({
                    authCredentials: {
                        username: creds.username,
                        password: creds.password,
                    },
                });
            } else {
                callback({});
            }
        } catch (err) {
            console.warn('[CREATY ProxyAuth] onAuthRequired error:', err?.message || err);
            try { callback({}); } catch (_) { /* ignore */ }
        } finally {
            setTimeout(() => {
                authChallengeActive = false;
                authChallengeSettledAt = Date.now();
            }, 400);
        }
    }

    function registerAuthListener() {
        if (!chrome.webRequest?.onAuthRequired?.addListener) {
            console.warn('[CREATY ProxyAuth] webRequest.onAuthRequired unavailable — add webRequest + webRequestAuthProvider');
            return;
        }
        try {
            chrome.webRequest.onAuthRequired.addListener(
                handleAuthRequired,
                { urls: ['<all_urls>'] },
                ['asyncBlocking']
            );
        } catch (err) {
            console.error('[CREATY ProxyAuth] listener registration failed:', err?.message || err);
        }
    }

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        const tracked = creatyAutomationTabs.get(tabId);
        if (!tracked) return;

        const url = String(changeInfo.url || tab?.url || '').trim();
        if (url && url !== 'about:blank') {
            tracked.blankSince = 0;
            creatyAutomationTabs.set(tabId, tracked);
            return;
        }

        if (url === 'about:blank' || (!url && changeInfo.status === 'loading')) {
            if (!tracked.blankSince) {
                tracked.blankSince = Date.now();
                creatyAutomationTabs.set(tabId, tracked);
            }
            const stuckFor = Date.now() - tracked.blankSince;
            if (stuckFor >= BLANK_STUCK_MS) {
                const redirectUrl = tracked.signupUrl || DEFAULT_SIGNUP_URL;
                console.warn('[CREATY ProxyAuth] about:blank stuck — redirect', { tabId, redirectUrl });
                creatyAutomationTabs.delete(tabId);
                void chrome.tabs.update(tabId, { url: redirectUrl }).catch(() => {
                    void chrome.tabs.remove(tabId).catch(() => { /* ignore */ });
                });
            }
        }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        untagCreatyAutomationTab(tabId);
    });

    registerAuthListener();
    void hydrateProxyAuthFromSession();

    self.NhpCreatyProxyAuth = {
        STORAGE_KEY,
        parseProxyCredentials,
        getCachedProxyCredentials,
        cacheProxyCredentials,
        clearProxyCredentials,
        isWindowLockActive,
        acquireWindowLock,
        releaseWindowLock,
        waitForAuthReady,
        tagCreatyAutomationTab,
        untagCreatyAutomationTab,
        guardedTabsCreate,
        guardedWindowsCreate,
    };
})();
