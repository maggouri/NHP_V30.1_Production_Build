'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    getCanvaConfig,
    saveCanvaTokens,
    CANVA_AUTH_BASE,
    CANVA_TOKEN_URL,
    CANVA_OAUTH_SCOPES
} = require('./canva-config');

/** Alias — single source of truth is CANVA_OAUTH_SCOPES in canva-config.js */
const CANVA_BRIDGE_SCOPES = CANVA_OAUTH_SCOPES;

const STATE_TTL_MS = 10 * 60 * 1000;

function getPendingStorePath(rootDir) {
    const dir = path.join(rootDir, 'metadata_store');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'canva-oauth-pending.json');
}

function readPendingStore(rootDir) {
    const storePath = getPendingStorePath(rootDir);
    try {
        if (!fs.existsSync(storePath)) return {};
        const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function writePendingStore(rootDir, store) {
    const storePath = getPendingStorePath(rootDir);
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function cleanupStates(rootDir, log = () => {}) {
    const store = readPendingStore(rootDir);
    const now = Date.now();
    let changed = false;
    for (const [key, val] of Object.entries(store)) {
        if (!val || now - Number(val.createdAt || 0) > STATE_TTL_MS) {
            delete store[key];
            changed = true;
        }
    }
    if (changed) {
        writePendingStore(rootDir, store);
        log('Expired Canva OAuth pending states cleaned', 'INFO');
    }
    return store;
}

function setPendingState(rootDir, state, entry, log = () => {}) {
    const store = cleanupStates(rootDir, log);
    store[state] = entry;
    writePendingStore(rootDir, store);
    log(`Canva OAuth state persisted (${state.slice(0, 8)}…)`, 'INFO');
}

function deletePendingState(rootDir, state, log = () => {}) {
    const store = readPendingStore(rootDir);
    const key = String(state || '');
    if (!store[key]) return;
    delete store[key];
    writePendingStore(rootDir, store);
    log(`Canva OAuth state consumed (${key.slice(0, 8)}…)`, 'INFO');
}

function getPendingEntry(rootDir, state) {
    const store = cleanupStates(rootDir);
    return store[String(state || '')] || null;
}

function generatePkcePair() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    return { codeVerifier, codeChallenge };
}

function buildBasicAuthHeader(clientId, clientSecret) {
    const encoded = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    return `Basic ${encoded}`;
}

function buildOAuthStateErrorHtml(reason) {
    const messages = {
        expired: 'انتهت صلاحية جلسة الربط — ارجع إلى NHP واضغط Connect Canva مرة أخرى.',
        missing: 'رمز الحالة (state) مفقود — أعد فتح الربط من NHP HuntPro.'
    };
    const message = messages[reason] || messages.missing;
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Canva OAuth</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:36rem;line-height:1.6">
<h2>تعذّر إكمال ربط Canva</h2>
<p>${message}</p>
</body></html>`;
}

function buildOAuthCallbackErrorHtml({ title = 'فشل ربط Canva', message = '', code = '' } = {}) {
    const codeLine = code ? `<p style="color:#666;font-size:0.9rem">رمز الخطأ: ${String(code)}</p>` : '';
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:36rem;line-height:1.6">
<h2>${title}</h2>
<p>${message}</p>
${codeLine}
<p>أغلق هذه النافذة وجرّب Connect Canva من جديد.</p>
</body></html>`;
}

function buildOAuthCallbackAutoCloseScript() {
    return `<script>
(function () {
  function tryClose() { try { window.close(); } catch (_) {} }
  tryClose();
  setTimeout(tryClose, 400);
  setTimeout(tryClose, 1200);
  setTimeout(function () {
    if (!window.closed) {
      var el = document.getElementById('nhp-oauth-fallback');
      if (el) el.style.display = 'block';
    }
  }, 1800);
})();
</script>`;
}

function buildOAuthCallbackSuccessHtml({
    title = 'تم ربط Canva',
    message = 'يمكنك العودة إلى NHP HuntPro — ستُغلق هذه النافذة تلقائياً.'
} = {}) {
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;padding:2rem;max-width:36rem;line-height:1.6;text-align:center}
.ok{color:#0a7;font-size:2rem;margin-bottom:0.5rem}</style></head>
<body>
<p class="ok">✓</p>
<h2>${title}</h2>
<p>${message}</p>
<p id="nhp-oauth-fallback" style="display:none;color:#666;font-size:0.9rem">إذا لم تُغلق النافذة تلقائياً، أغلقها يدوياً.</p>
${buildOAuthCallbackAutoCloseScript()}
</body></html>`;
}

function buildAuthStartUrl(rootDir, log = () => {}) {
    cleanupStates(rootDir, log);
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) {
        const state = `mock_${crypto.randomBytes(8).toString('hex')}`;
        setPendingState(rootDir, state, { createdAt: Date.now(), mock: true }, log);
        return {
            mockMode: true,
            authUrl: null,
            state,
            scopes: CANVA_BRIDGE_SCOPES,
            message: 'Canva credentials not configured — mock connect available'
        };
    }
    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = generatePkcePair();
    setPendingState(rootDir, state, {
        createdAt: Date.now(),
        mock: false,
        codeVerifier
    }, log);
    const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_type: 'code',
        scope: CANVA_BRIDGE_SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });
    const authUrl = `${CANVA_AUTH_BASE}/authorize?${params.toString()}`;
    log(`Auth URL built with ${CANVA_BRIDGE_SCOPES.split(' ').length} scopes + PKCE S256`, 'INFO');
    return {
        mockMode: false,
        authUrl,
        state,
        scopes: CANVA_BRIDGE_SCOPES
    };
}

async function exchangeCodeForTokens(rootDir, code, log = () => {}, { codeVerifier } = {}) {
    const cfg = getCanvaConfig(rootDir);
    if (!codeVerifier) {
        const err = new Error('Missing PKCE code_verifier — restart Connect Canva flow');
        err.status = 400;
        throw err;
    }
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code || ''),
        redirect_uri: cfg.redirectUri,
        code_verifier: String(codeVerifier)
    });
    const res = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: buildBasicAuthHeader(cfg.clientId, cfg.clientSecret)
        },
        body
    });
    const raw = await res.text();
    let data = {};
    try {
        data = raw ? JSON.parse(raw) : {};
    } catch (_) {
        data = {};
    }
    if (!res.ok) {
        log(`Canva OAuth token exchange failed: ${data.error || res.status}`, 'ERROR');
        const err = new Error(data.error_description || data.error || `OAuth failed (${res.status})`);
        err.status = res.status;
        err.code = data.error || '';
        throw err;
    }
    const expiresAt = data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
        : null;
    saveCanvaTokens(rootDir, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        scopes: data.scope || CANVA_BRIDGE_SCOPES
    });
    log('Canva OAuth tokens saved', 'INFO');
    return data;
}

async function refreshAccessToken(rootDir, log = () => {}) {
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) return cfg.accessToken || 'mock_access_token';
    if (!cfg.refreshToken) throw new Error('Canva refresh token missing');
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.refreshToken
    });
    const res = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: buildBasicAuthHeader(cfg.clientId, cfg.clientSecret)
        },
        body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        log(`Canva token refresh failed: ${data.error || res.status}`, 'ERROR');
        throw new Error(data.error_description || data.error || `Refresh failed (${res.status})`);
    }
    const expiresAt = data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
        : null;
    saveCanvaTokens(rootDir, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cfg.refreshToken,
        expiresAt,
        scopes: data.scope
    });
    log('Canva access token refreshed', 'INFO');
    return data.access_token;
}

async function getValidAccessToken(rootDir, log = () => {}) {
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) return cfg.accessToken || 'mock_access_token';
    if (cfg.accessToken) return cfg.accessToken;
    return refreshAccessToken(rootDir, log);
}

function mockConnect(rootDir, state, log = () => {}) {
    cleanupStates(rootDir, log);
    const entry = getPendingEntry(rootDir, state);
    saveCanvaTokens(rootDir, {
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    deletePendingState(rootDir, state, log);
    log(`Canva mock connect completed (mock=${!!entry?.mock})`, 'INFO');
    return { connected: true, mockMode: true };
}

function peekOAuthState(rootDir, state, log = () => {}) {
    return getPendingEntry(rootDir, state);
}

function validateOAuthState(rootDir, state) {
    return !!getPendingEntry(rootDir, state);
}

function consumeOAuthState(rootDir, state) {
    const key = String(state || '');
    const entry = getPendingEntry(rootDir, key);
    if (!entry) return null;
    deletePendingState(rootDir, key);
    return entry;
}

module.exports = {
    CANVA_BRIDGE_SCOPES,
    getPendingStorePath,
    buildAuthStartUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getValidAccessToken,
    mockConnect,
    peekOAuthState,
    deletePendingState,
    validateOAuthState,
    consumeOAuthState,
    buildOAuthStateErrorHtml,
    buildOAuthCallbackErrorHtml,
    buildOAuthCallbackSuccessHtml
};
