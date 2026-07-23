'use strict';

const fs = require('fs');
const path = require('path');

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_AUTH_BASE = 'https://www.canva.com/api/oauth';
const CANVA_TOKEN_URL = `${CANVA_API_BASE}/oauth/token`;

/** Default square canvas for Canva editor (Connect API custom design_type). */
const CANVA_DESIGN_WIDTH = 5000;
const CANVA_DESIGN_HEIGHT = 5000;
const CANVA_DESIGN_SIZE_MIN = 40;
const CANVA_DESIGN_SIZE_MAX = 8000;
const CANVA_DESIGN_AREA_MAX = 25_000_000;

function clampCanvaDesignDimension(value, fallback) {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(n) || n < CANVA_DESIGN_SIZE_MIN || n > CANVA_DESIGN_SIZE_MAX) {
        return fallback;
    }
    return n;
}

function getCanvaDesignDimensions(rootDir) {
    loadEnvFile(rootDir);
    const sizeOverride = String(process.env.CANVA_DESIGN_SIZE || '').trim();
    if (sizeOverride) {
        const size = clampCanvaDesignDimension(sizeOverride, CANVA_DESIGN_WIDTH);
        return { width: size, height: size };
    }
    const width = clampCanvaDesignDimension(process.env.CANVA_DESIGN_WIDTH, CANVA_DESIGN_WIDTH);
    const height = clampCanvaDesignDimension(process.env.CANVA_DESIGN_HEIGHT, CANVA_DESIGN_HEIGHT);
    if (width * height > CANVA_DESIGN_AREA_MAX) {
        const scale = Math.sqrt(CANVA_DESIGN_AREA_MAX / (width * height));
        return {
            width: Math.max(CANVA_DESIGN_SIZE_MIN, Math.floor(width * scale)),
            height: Math.max(CANVA_DESIGN_SIZE_MIN, Math.floor(height * scale))
        };
    }
    return { width, height };
}

/** Space-separated scopes — only what Canva Bridge needs; match Developer Portal Scopes tab. */
const CANVA_OAUTH_SCOPES = [
    'design:meta:read',
    'design:content:read',
    'design:content:write',
    'asset:read',
    'asset:write',
    'profile:read'
].join(' ');

const CANVA_TOKEN_ENV_KEYS = ['CANVA_ACCESS_TOKEN', 'CANVA_REFRESH_TOKEN'];

function loadEnvFile(rootDir) {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) return;
    try {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq < 1) continue;
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (process.env[key] === undefined || process.env[key] === '') {
                process.env[key] = val;
            }
        }
    } catch (_) { /* ignore */ }
}

function getTokenStorePath(rootDir) {
    const dir = path.join(rootDir, 'metadata_store');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'canva-tokens.json');
}

function readStoredTokens(rootDir) {
    const storePath = getTokenStorePath(rootDir);
    try {
        if (!fs.existsSync(storePath)) return {};
        return JSON.parse(fs.readFileSync(storePath, 'utf8')) || {};
    } catch (_) {
        return {};
    }
}

function writeStoredTokens(rootDir, tokens) {
    const storePath = getTokenStorePath(rootDir);
    fs.writeFileSync(storePath, JSON.stringify(tokens, null, 2), 'utf8');
}

function getCanvaConfig(rootDir) {
    loadEnvFile(rootDir);
    const clientId = String(process.env.CANVA_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.CANVA_CLIENT_SECRET || '').trim();
    const redirectUri = String(process.env.CANVA_REDIRECT_URI || '').trim()
        || `http://127.0.0.1:${Number(process.env.NHP_GHOST_PORT || process.env.PORT) || 3019}/api/canva/auth/callback`;
    const stored = readStoredTokens(rootDir);
    const accessToken = String(process.env.CANVA_ACCESS_TOKEN || stored.accessToken || '').trim();
    const refreshToken = String(process.env.CANVA_REFRESH_TOKEN || stored.refreshToken || '').trim();
    const mockMode = !clientId || !clientSecret;
    const connected = mockMode ? !!accessToken : !!(accessToken || refreshToken);
    return {
        clientId,
        clientSecret,
        redirectUri,
        accessToken,
        refreshToken,
        mockMode,
        connected,
        apiBase: CANVA_API_BASE,
        authBase: CANVA_AUTH_BASE,
        scopes: CANVA_OAUTH_SCOPES
    };
}

const CANVA_ENV_KEYS = ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI'];

function parseEnvLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const eq = trimmed.indexOf('=');
    if (eq < 1) return null;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    return { key, val };
}

function getDefaultCanvaRedirectUri() {
    const port = Number(process.env.NHP_GHOST_PORT || process.env.PORT) || 3019;
    return `http://127.0.0.1:${port}/api/canva/auth/callback`;
}

function isValidCanvaClientId(clientId) {
    return /^OC-[A-Za-z0-9_-]{4,}$/.test(String(clientId || '').trim());
}

function maskCanvaClientId(clientId) {
    const id = String(clientId || '').trim();
    if (!id) return '';
    if (id.length <= 8) return `${id.slice(0, 2)}••••`;
    return `${id.slice(0, 5)}••••${id.slice(-3)}`;
}

function reloadCanvaEnv(rootDir) {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) {
        CANVA_ENV_KEYS.forEach((key) => { delete process.env[key]; });
        return;
    }
    try {
        const parsed = {};
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const entry = parseEnvLine(line);
            if (entry && CANVA_ENV_KEYS.includes(entry.key)) {
                parsed[entry.key] = entry.val;
            }
        }
        CANVA_ENV_KEYS.forEach((key) => {
            if (parsed[key] !== undefined) process.env[key] = parsed[key];
            else delete process.env[key];
        });
    } catch (_) { /* ignore */ }
}

function updateCanvaEnvFile(rootDir, { clientId, clientSecret, redirectUri } = {}) {
    const envPath = path.join(rootDir, '.env');
    const updates = {};
    if (clientId !== undefined) updates.CANVA_CLIENT_ID = String(clientId).trim();
    if (clientSecret !== undefined) updates.CANVA_CLIENT_SECRET = String(clientSecret).trim();
    if (redirectUri !== undefined) updates.CANVA_REDIRECT_URI = String(redirectUri).trim();

    let lines = [];
    if (fs.existsSync(envPath)) {
        lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    }

    const found = new Set();
    const nextLines = lines.map((line) => {
        const entry = parseEnvLine(line);
        if (!entry || updates[entry.key] === undefined) return line;
        found.add(entry.key);
        return `${entry.key}=${updates[entry.key]}`;
    });

    Object.keys(updates).forEach((key) => {
        if (!found.has(key)) nextLines.push(`${key}=${updates[key]}`);
    });

    let text = nextLines.join('\n');
    if (text.length && !text.endsWith('\n')) text += '\n';
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    fs.writeFileSync(envPath, text, 'utf8');
    reloadCanvaEnv(rootDir);
    return getCanvaConfig(rootDir);
}

function getCanvaSettingsPublic(rootDir) {
    const cfg = getCanvaConfig(rootDir);
    const hasClientId = !!cfg.clientId;
    return {
        clientId: hasClientId ? cfg.clientId : '',
        clientIdMasked: hasClientId ? maskCanvaClientId(cfg.clientId) : '',
        hasClientId,
        hasSecret: !!cfg.clientSecret,
        redirectUri: cfg.redirectUri || getDefaultCanvaRedirectUri(),
        mockMode: cfg.mockMode
    };
}

function removeKeysFromEnvFile(rootDir, keys) {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) return;
    try {
        const drop = new Set(keys);
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        const nextLines = lines.filter((line) => {
            const entry = parseEnvLine(line);
            return !(entry && drop.has(entry.key));
        });
        let text = nextLines.join('\n');
        if (text.length && !text.endsWith('\n')) text += '\n';
        fs.writeFileSync(envPath, text, 'utf8');
    } catch (_) { /* ignore */ }
}

function clearCanvaTokens(rootDir) {
    const storePath = getTokenStorePath(rootDir);
    try {
        if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
    } catch (_) { /* ignore */ }
    CANVA_TOKEN_ENV_KEYS.forEach((key) => { delete process.env[key]; });
    removeKeysFromEnvFile(rootDir, CANVA_TOKEN_ENV_KEYS);
    return { cleared: true };
}

function parseScopeList(raw) {
    if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
    return String(raw || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

function getRequiredScopesList() {
    return parseScopeList(CANVA_OAUTH_SCOPES);
}

function getStoredTokenScopes(rootDir) {
    const stored = readStoredTokens(rootDir);
    return parseScopeList(stored.scopes || stored.grantedScopes || '');
}

function tokenScopesAreStale(rootDir) {
    const stored = readStoredTokens(rootDir);
    const hasToken = !!(stored.accessToken || stored.refreshToken
        || process.env.CANVA_ACCESS_TOKEN || process.env.CANVA_REFRESH_TOKEN);
    if (!hasToken) return false;
    const granted = getStoredTokenScopes(rootDir);
    if (!granted.length) return true;
    const required = getRequiredScopesList();
    return required.some((scope) => !granted.includes(scope));
}

function saveCanvaTokens(rootDir, { accessToken, refreshToken, expiresAt, scopes } = {}) {
    const prev = readStoredTokens(rootDir);
    const next = {
        ...prev,
        ...(accessToken ? { accessToken } : {}),
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(scopes ? { scopes: parseScopeList(scopes).join(' ') } : {}),
        updatedAt: new Date().toISOString()
    };
    writeStoredTokens(rootDir, next);
    if (accessToken) process.env.CANVA_ACCESS_TOKEN = accessToken;
    if (refreshToken) process.env.CANVA_REFRESH_TOKEN = refreshToken;
    return next;
}

module.exports = {
    CANVA_API_BASE,
    CANVA_AUTH_BASE,
    CANVA_TOKEN_URL,
    CANVA_DESIGN_WIDTH,
    CANVA_DESIGN_HEIGHT,
    getCanvaDesignDimensions,
    CANVA_OAUTH_SCOPES,
    CANVA_TOKEN_ENV_KEYS,
    loadEnvFile,
    reloadCanvaEnv,
    updateCanvaEnvFile,
    getCanvaSettingsPublic,
    isValidCanvaClientId,
    getDefaultCanvaRedirectUri,
    getCanvaConfig,
    readStoredTokens,
    writeStoredTokens,
    saveCanvaTokens,
    clearCanvaTokens,
    getTokenStorePath,
    getRequiredScopesList,
    getStoredTokenScopes,
    tokenScopesAreStale,
    parseScopeList
};
