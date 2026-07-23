/**
 * SEO AI Module for Niche Hunter Pro
 * Modularized version of the SEO Engine
 */

import { generateBubbleSpiderStyleTags } from './redbubble-tag-generator.js';

let S = {};
let AP_SEO = {};
let isSeoProcessing = false;
let seoGenerationCancelled = false;
let seoGenBtnDefaultHtml = '';
let seoGenBtnDefaultTitle = '';
let seoGenBtnDefaultStyle = '';
let seoModuleInitialized = false;
let seoEventListenersBound = false;
const MAIN_TAG_MAX_LENGTH = 38;
const SEO_FIELD_SAVE_DEBOUNCE_MS = 220;
const GEMINI_RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000;
const NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY = 'nhpInternalGeminiKey';
const SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY = 'seoInternalGeminiKey';
const LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY = 'customGeminiKey';
const ADMIN_AI_KEYS_STORAGE_KEY = 'nhpAdminAiKeys';
const CURSOR_API_KEY_STORAGE_KEY = 'nhpCursorApiKey';
const GPT_API_KEY_STORAGE_KEY = 'nhpGptApiKey';
const NHP_PROXY_BASE_URL_STORAGE_KEY = 'nhpProxyBaseUrl';
const NHP_PROXY_ENDPOINTS_STORAGE_KEY = 'nhpProxyEndpoints';
const SEO_PROXY_ROUTING_MODE_KEY = 'nhpProxyRoutingMode';
const SEO_CLIPROXY_PANEL_OPEN_KEY = 'seo_cliproxy_panel_open';
const DEFAULT_INTERNAL_GEMINI_API_KEY = '';
const DEFAULT_CURSOR_API_KEY = '';
const SEO_RENDER_PROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
const SEO_LOCAL_CLI_PROXY_PORT = 8317;
const SEO_LOCAL_CLIPROXY_API_KEY = 'nhp-local-cliproxy-key';
const SEO_LOCAL_MANAGEMENT_URL = `http://127.0.0.1:${SEO_LOCAL_CLI_PROXY_PORT}/management.html#/login`;
const SEO_CLOUD_MANAGEMENT_URL = 'https://cliproxyapi-ywrp.onrender.com/management.html#/login';
const DEFAULT_NHP_PROXY_BASE_URL = SEO_RENDER_PROXY_BASE_URL;
const DEFAULT_NHP_API_KEY = '';
const SEO_GPT_PARSE_RETRY_INITIAL_DELAY_MS = 2500;
const SEO_GPT_PARSE_RETRY_MAX_DELAY_MS = 12000;
const SEO_GPT_PARSE_RETRY_BACKOFF_FACTOR = 1.45;
const SEO_GPT_PARSE_MAX_ATTEMPTS = 6;
const SEO_GPT_MODEL_CHAIN = Object.freeze([
    'auto',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'claude-sonnet-4-20250514'
]);
const SEO_GPT_MODEL_TIMEOUT_MS = 45000;
const SEO_BRIDGE_MESSAGE_TIMEOUT_MS = SEO_GPT_MODEL_TIMEOUT_MS + 17000;
const SEO_AUTH_CHECK_TIMEOUT_MS = 15000;
const SEO_TMH_VERIFY_TIMEOUT_MS = 30000;
const SEO_ITEM_GENERATION_TIMEOUT_MS = SEO_BRIDGE_MESSAGE_TIMEOUT_MS + SEO_TMH_VERIFY_TIMEOUT_MS + 10000;
const SEO_QUEUE_PERSIST_TIMEOUT_MS = 8000;
const SEO_GPT_IMAGE_MAX_WIDTH = 360;
const SEO_GENERATION_PROVIDER_STORAGE_KEY = 'seoGenerationProvider';
const SEO_PROVIDERS = {
    GEMINI_API: 'gemini-api',
    GPT_API: 'gpt-api',
    CURSOR_API: 'cursor-api',
    GEMINI_WEB: 'gemini-web',
    LOCAL_LIBRARY: 'local-library'
};
/** TeePublic tag slots — BubbleSpider copy uses same count (14 or 15). */
const SEO_LOCAL_LIBRARY_TAG_COUNT = 15;
const SEO_BUBBLESPIDER_RESULTS_LIMIT = 100;
const SEO_LOCAL_LIBRARY_AI_MAX_ATTEMPTS = 5;
const SEO_LOCAL_LIBRARY_AI_TAGS_MIN_VALID = 10;
const SEO_LOCAL_LIBRARY_AI_RETRY_INITIAL_DELAY_MS = 900;
const SEO_LOCAL_LIBRARY_AI_RETRY_MAX_DELAY_MS = 6000;
const SEO_LOCAL_LIBRARY_BANNED_PRODUCT_KEYWORDS = [
    'sock', 'sticker', 'poster', 'dress', 'shirt', 'hoodie', 'case', 'mug', 'print', 'art',
    'laptop', 'wall', 'tote', 'pillow', 'mask', 'skin'
];
const SEO_LOCAL_LIBRARY_GENERIC_TAG_BLOCKLIST = new Set([
    'design', 'artwork', 'cool', 'graphic', 'art', 'style', 'creative', 'aesthetic',
    'trendy', 'unique', 'awesome', 'idea', 'decor', 'fashion', 'vibe', 'mood', 'culture',
    'illustration', 'vintage', 'retro', 'modern', 'urban', 'classic', 'funny', 'cute',
    'minimal', 'bold', 'popular', 'gift', 'fan', 'favorite', 'statement', 'look', 'outfit',
    'stylish', 'daily', 'aesthetics', 'trend', 'pop art'
]);
const SEO_LOCAL_LIBRARY_GENERIC_PADDING_TAGS = [
    'design', 'graphic', 'illustration', 'style', 'creative', 'trendy', 'vintage', 'retro',
    'cool', 'aesthetic', 'awesome', 'idea', 'funny', 'cute', 'unique', 'art', 'decor',
    'fashion', 'urban', 'modern', 'pop art', 'classic', 'vibe', 'mood', 'culture'
];
const SEO_LOCAL_LIBRARY_TITLE_SUFFIXES = [
    'Design', 'Graphic', 'Illustration', 'Retro Design', 'Vintage Style',
    'Classic Graphic', 'Creative Design', 'Artistic Design', 'Print Design', 'Graphic Art'
];
const SEO_AI_WINDOW_MODE_STORAGE_KEY = 'seoAiWindowFallbackEnabled';
const SEO_AI_WINDOW_POOL_STORAGE_KEY = 'seoAiWindowPool';
const SEO_AI_WINDOW_POOL_INDEX_STORAGE_KEY = 'seoAiWindowPoolIndex';
const SEO_GOOGLE_AI_REVIEW_STORAGE_KEY = 'seoGoogleAiReviewEnabled';
// AUT now ships native SEO controls in autopilot.html.
// Keep this off to avoid injecting legacy duplicate controls at runtime.
const ENABLE_LEGACY_AUTOPILOT_SEO_INJECTIONS = false;
const GOOGLE_AI_MODE_URL = 'https://www.google.com/search?udm=50&q=pod%20seo%20review';
const SEO_DEFAULT_WINDOW_POOL = [
    'https://gemini.google.com/gem/1f29abb64533',
    'https://chatgpt.com/g/g-69ea5fffe8cc819197ca4381a199a21e-seo-exten-gpt-nhp'
];
let geminiRateLimitUntil = 0;
let seoFieldSaveTimer = null;
let apSyncTimer = null;
const isLowSpecModeEnabled = () => !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;

function getStoredStringValue(key) {
    return new Promise((resolve) => {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                resolve('');
                return;
            }
            chrome.storage.local.get([key], (res) => {
                const value = String(res?.[key] || '').trim();
                resolve(value);
            });
        } catch (_) {
            resolve('');
        }
    });
}

async function migrateLegacySeoGeminiKey() {
    const primaryInternalKey = await getStoredStringValue(NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY);
    if (primaryInternalKey) {
        try {
            await chrome.storage.local.set({ [SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]: primaryInternalKey });
        } catch (_) {}
        return primaryInternalKey;
    }

    const internalKey = await getStoredStringValue(SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY);
    if (internalKey) return internalKey;

    const legacyKey = await getStoredStringValue(LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY);
    if (!legacyKey) return '';

    try {
        await chrome.storage.local.set({ [SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]: legacyKey });
        return legacyKey;
    } catch (_) {
        return legacyKey;
    }
}

async function getSeoGeminiApiKey() {
    const migrated = await migrateLegacySeoGeminiKey();
    if (migrated) return migrated;
    const keys = await getStoredSeoAiKeys();
    return String(keys.gemini || '').trim();
}

function normalizeSeoAiKeys(input) {
    const source = input && typeof input === 'object' ? input : {};
    return {
        gemini: String(source.gemini || '').trim(),
        cursor: String(source.cursor || '').trim(),
        gpt: String(source.gpt || '').trim(),
        baseUrl: String(source.baseUrl || '').trim()
    };
}

async function getStoredSeoAiKeys() {
    return await new Promise((resolve) => {
        try {
            chrome.storage.local.get([
                ADMIN_AI_KEYS_STORAGE_KEY,
                NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY,
                LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY,
                CURSOR_API_KEY_STORAGE_KEY,
                GPT_API_KEY_STORAGE_KEY,
                NHP_PROXY_BASE_URL_STORAGE_KEY
            ], (res) => {
                const directAiKeys = normalizeSeoAiKeys(res?.[ADMIN_AI_KEYS_STORAGE_KEY]);
                const geminiFallback = String(
                    res?.[SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || res?.[NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]
                    || directAiKeys.gemini
                    || res?.[LEGACY_CUSTOM_GEMINI_KEY_STORAGE_KEY]
                    || DEFAULT_INTERNAL_GEMINI_API_KEY
                ).trim();
                resolve({
                    gemini: geminiFallback,
                    cursor: String(res?.[CURSOR_API_KEY_STORAGE_KEY] || directAiKeys.cursor || DEFAULT_CURSOR_API_KEY).trim(),
                    gpt: String(res?.[GPT_API_KEY_STORAGE_KEY] || directAiKeys.gpt || DEFAULT_NHP_API_KEY).trim(),
                    baseUrl: String(res?.[NHP_PROXY_BASE_URL_STORAGE_KEY] || directAiKeys.baseUrl || DEFAULT_NHP_PROXY_BASE_URL).trim()
                });
            });
        } catch (_) {
            resolve({ gemini: '', cursor: DEFAULT_CURSOR_API_KEY, gpt: DEFAULT_NHP_API_KEY, baseUrl: DEFAULT_NHP_PROXY_BASE_URL });
        }
    });
}

async function saveSeoAiKeys(aiKeys) {
    const cleanKeys = normalizeSeoAiKeys(aiKeys);
    return await new Promise((resolve) => {
        try {
            chrome.storage.local.set({
                [ADMIN_AI_KEYS_STORAGE_KEY]: cleanKeys,
                [SEO_INTERNAL_GEMINI_KEY_STORAGE_KEY]: cleanKeys.gemini,
                [NHP_INTERNAL_GEMINI_KEY_STORAGE_KEY]: cleanKeys.gemini,
                [CURSOR_API_KEY_STORAGE_KEY]: cleanKeys.cursor,
                [GPT_API_KEY_STORAGE_KEY]: cleanKeys.gpt,
                [NHP_PROXY_BASE_URL_STORAGE_KEY]: cleanKeys.baseUrl || DEFAULT_NHP_PROXY_BASE_URL
            }, () => resolve(cleanKeys));
        } catch (_) {
            resolve(cleanKeys);
        }
    });
}

function isSeoLocalProxyBaseUrl(baseUrl) {
    const value = String(baseUrl || '').toLowerCase();
    return /:(8317)(\/|$)/.test(value) && /127\.0\.0\.1|localhost/.test(value);
}

/** Cloud/SEO key only — never the local gateway placeholder or Google AIza keys. */
function pickSeoCloudApiKey(...candidates) {
    for (const raw of candidates) {
        const key = String(raw || '').trim();
        if (!key || key === SEO_LOCAL_CLIPROXY_API_KEY) continue;
        if (/^AIza[0-9A-Za-z_\-]{10,}$/.test(key)) continue;
        return key;
    }
    return '';
}

function resolveSeoEndpointBearerKey(endpoint, cloudApiKey = '', fallbackKey = '') {
    const baseUrl = endpoint?.baseUrl || '';
    if (isSeoLocalProxyBaseUrl(baseUrl)) return SEO_LOCAL_CLIPROXY_API_KEY;
    return pickSeoCloudApiKey(endpoint?.apiKey, cloudApiKey, fallbackKey);
}

function sanitizeSeoProxyEndpointsForLocal(endpoints = [], cloudApiKey = '') {
    const cloud = pickSeoCloudApiKey(cloudApiKey);
    const list = (Array.isArray(endpoints) ? endpoints : []).map((endpoint, index) => {
        const baseUrl = String(endpoint?.baseUrl || '').trim();
        const isLocal = isSeoLocalProxyBaseUrl(baseUrl);
        const priority = Number.isFinite(Number(endpoint?.priority))
            ? Number(endpoint.priority)
            : (isLocal ? 20 : 10);
        return {
            ...endpoint,
            id: endpoint?.id || `endpoint-${index + 1}`,
            baseUrl,
            priority,
            apiKey: isLocal
                ? SEO_LOCAL_CLIPROXY_API_KEY
                : pickSeoCloudApiKey(endpoint?.apiKey, cloud)
        };
    });
    // Cloud primary (lower priority number), local backup.
    const cloudEp = list.find((item) => /onrender\.com/i.test(String(item.baseUrl || '')));
    const localEp = list.find((item) => isSeoLocalProxyBaseUrl(item.baseUrl));
    if (cloudEp && localEp && (Number(localEp.priority) || 0) <= (Number(cloudEp.priority) || 0)) {
        cloudEp.priority = 10;
        localEp.priority = 20;
    }
    return list.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}

async function loadSeoProxyEndpointsFromStorage() {
    const stored = await getStoredSeoAiKeys();
    const cloudKey = pickSeoCloudApiKey(stored.gpt);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
            const res = await chrome.runtime.sendMessage({ action: 'get_proxy_endpoints' });
            if (res?.success && Array.isArray(res.endpoints)) {
                return sanitizeSeoProxyEndpointsForLocal(res.endpoints, cloudKey);
            }
        } catch (_) { /* fallback */ }
    }
    return [
        { id: 'cliproxy-render', label: 'CLIProxy Render', baseUrl: SEO_RENDER_PROXY_BASE_URL, apiKey: cloudKey, enabled: true, priority: 10 },
        { id: 'cliproxy-local', label: 'CLIProxy محلي', baseUrl: `http://127.0.0.1:${SEO_LOCAL_CLI_PROXY_PORT}/v1`, apiKey: SEO_LOCAL_CLIPROXY_API_KEY, enabled: true, priority: 20 }
    ];
}

function collectSeoProxyEndpointsFromDom() {
    const list = document.getElementById('seo-proxy-endpoints-list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.seo-proxy-endpoint-row')).map((row, index) => ({
        id: row.dataset.endpointId || `endpoint-${index + 1}`,
        label: row.querySelector('.seo-proxy-endpoint-label-input')?.value?.trim() || `Endpoint ${index + 1}`,
        baseUrl: row.querySelector('.seo-proxy-endpoint-url')?.value?.trim() || '',
        apiKey: row.querySelector('.seo-proxy-endpoint-key')?.value?.trim() || '',
        enabled: row.querySelector('.seo-proxy-endpoint-enabled')?.checked !== false,
        priority: (index + 1) * 10
    })).filter((item) => item.baseUrl);
}

function renderSeoProxyEndpoints(endpoints = []) {
    const list = document.getElementById('seo-proxy-endpoints-list');
    if (!list) return;
    const showSecrets = !!document.getElementById('seo-api-keys-show')?.checked;
    list.innerHTML = '';
    (Array.isArray(endpoints) ? endpoints : []).forEach((endpoint, index) => {
        const row = document.createElement('div');
        row.className = 'seo-proxy-endpoint-row';
        row.dataset.endpointId = endpoint.id || `endpoint-${index + 1}`;
        const esc = (value) => String(value || '').replace(/"/g, '&quot;');
        row.innerHTML = `
            <div class="seo-proxy-endpoint-label">
                <input type="text" class="modern-input seo-proxy-endpoint-label-input" value="${esc(endpoint.label)}" placeholder="Label" style="width:100%; min-height:1.5rem; height:1.5rem; font-size:0.625rem;">
            </div>
            <label style="display:inline-flex; align-items:center; gap:0.2rem; font-size:0.5625rem;">
                <input type="checkbox" class="seo-proxy-endpoint-enabled accent-primary" ${endpoint.enabled !== false ? 'checked' : ''}>
                مفعّل
            </label>
            <input type="text" class="modern-input seo-proxy-endpoint-url" dir="ltr" value="${esc(endpoint.baseUrl)}" placeholder="Base URL /v1" autocomplete="off">
            <input type="${showSecrets ? 'text' : 'password'}" class="modern-input seo-proxy-endpoint-key" value="${esc(endpoint.apiKey)}" placeholder="API Key" autocomplete="off">
            <button type="button" class="seo-mgmt-btn seo-proxy-endpoint-remove" title="حذف"><i class="fa-solid fa-trash"></i></button>
        `;
        row.querySelector('.seo-proxy-endpoint-remove')?.addEventListener('click', () => {
            row.remove();
            invalidateSeoAuthCache();
        });
        row.addEventListener('input', () => {
            invalidateSeoAuthCache();
            scheduleSeoKeyConnectionCheck(document.getElementById('seo-api-base-url'), document.getElementById('seo-api-key-gpt'));
        });
        list.appendChild(row);
    });
}

async function saveSeoProxyEndpointsFromDom(syncLegacy = true) {
    const stored = await getStoredSeoAiKeys();
    const endpoints = sanitizeSeoProxyEndpointsForLocal(
        collectSeoProxyEndpointsFromDom(),
        pickSeoCloudApiKey(stored.gpt, document.getElementById('seo-api-key-gpt')?.value)
    );
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await chrome.runtime.sendMessage({ action: 'save_proxy_endpoints', endpoints, syncLegacy });
        return sanitizeSeoProxyEndpointsForLocal(res?.endpoints || endpoints, stored.gpt);
    }
    return endpoints;
}

async function getSeoProxyRoutingMode() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
            const res = await chrome.runtime.sendMessage({ action: 'get_proxy_routing_info' });
            if (res?.success && res.routingMode) return res.routingMode;
        } catch (_) { /* fallback */ }
    }
    const stored = await getStoredStringValue(SEO_PROXY_ROUTING_MODE_KEY);
    return stored || 'distributed';
}

async function saveSeoProxyRoutingMode(mode) {
    const normalized = String(mode || 'distributed').trim().toLowerCase();
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
            const res = await chrome.runtime.sendMessage({ action: 'save_proxy_routing_mode', routingMode: normalized });
            if (res?.success) return res.routingMode || normalized;
        } catch (_) { /* fallback */ }
    }
    try {
        await chrome.storage.local.set({ [SEO_PROXY_ROUTING_MODE_KEY]: normalized });
    } catch (_) { /* ignore */ }
    return normalized;
}

function isSeoProxyDistributedMode(mode) {
    return String(mode || '').toLowerCase() === 'distributed';
}

async function getSeoDistributedConcurrency() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
            const res = await chrome.runtime.sendMessage({ action: 'get_proxy_routing_info' });
            const count = Number(res?.healthyCount) || 0;
            if (res?.success && count > 0) return Math.min(count, 4);
        } catch (_) { /* fallback */ }
    }
    return 2;
}

function fixSeoProxyHostnameTypo(value) {
    return String(value || '').replace(/cliproxy-api-ywrp\.onrender\.com/gi, 'cliproxyapi-ywrp.onrender.com');
}

function normalizeSeoProxyBaseUrl(value) {
    const raw = fixSeoProxyHostnameTypo(String(value || '').trim() || DEFAULT_NHP_PROXY_BASE_URL);
    return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1') || DEFAULT_NHP_PROXY_BASE_URL.replace(/\/+$/, '');
}

function buildSeoManagementUrl(baseUrl) {
    const normalized = normalizeSeoProxyBaseUrl(baseUrl || DEFAULT_NHP_PROXY_BASE_URL);
    const withoutApiPath = normalized.replace(/\/v1\/?$/i, '');
    if (!withoutApiPath) return SEO_CLOUD_MANAGEMENT_URL;
    return `${withoutApiPath.replace(/\/+$/, '')}/management.html#/login`;
}

function openSeoManagementUrl(url) {
    const target = String(url || '').trim();
    if (!target) return;
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'open_cliproxy_management', url: target }).catch(() => {
                if (chrome.tabs?.create) chrome.tabs.create({ url: target, active: true });
            });
            return;
        }
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            chrome.tabs.create({ url: target, active: true });
            return;
        }
    } catch (_) { /* fallback below */ }
    window.open(target, '_blank', 'noopener,noreferrer');
}

/** Match background.js normalizeCliProxyBaseUrl — health check and generation must hit the same host. */
function resolveSeoProxyBaseUrl(storedBaseUrl) {
    const fixed = fixSeoProxyHostnameTypo(String(storedBaseUrl || '').trim());
    // Keep explicit stored URL; default empty → cloud Render primary.
    if (fixed) {
        return normalizeSeoProxyBaseUrl(fixed);
    }
    try {
        const cached = window.NhpRuntimeConfig?.getCached?.().proxyBaseUrl;
        if (cached) return normalizeSeoProxyBaseUrl(cached);
    } catch (_) { /* ignore */ }
    return normalizeSeoProxyBaseUrl(SEO_RENDER_PROXY_BASE_URL);
}

async function resolveSeoActiveApiCredentials() {
    const stored = await getStoredSeoAiKeys();
    const domApiKey = document.getElementById('seo-api-key-gpt')?.value?.trim();
    const cloudApiKey = pickSeoCloudApiKey(
        ...collectSeoProxyEndpointsFromDom().map((ep) => (!isSeoLocalProxyBaseUrl(ep.baseUrl) ? ep.apiKey : '')),
        domApiKey,
        stored.gpt
    );
    const endpoints = sanitizeSeoProxyEndpointsForLocal(
        collectSeoProxyEndpointsFromDom(),
        cloudApiKey
    ).filter((item) => item.enabled !== false);
    const primary = endpoints[0] || null;
    const domBaseUrl = document.getElementById('seo-api-base-url')?.value?.trim();
    const baseUrl = resolveSeoProxyBaseUrl(primary?.baseUrl || domBaseUrl || stored.baseUrl);
    const apiKey = isSeoLocalProxyBaseUrl(baseUrl)
        ? SEO_LOCAL_CLIPROXY_API_KEY
        : pickSeoCloudApiKey(primary?.apiKey, cloudApiKey, domApiKey, stored.gpt);
    return {
        baseUrl,
        apiKey,
        gpt: apiKey,
        cloudApiKey,
        endpoints
    };
}

let _seoKeyMonitorTimer = null;
// In-flight deduplication: one active Promise per concurrent check.
let _seoKeyCheckInFlightPromise = null;
// Success cache: { fingerprint, result, expiresAt }
let _seoAuthCache = null;
const SEO_AUTH_CACHE_TTL_MS = 60000; // 60 seconds

/** Build a short non-secret fingerprint for cache keying. Never stores the full key. */
function _seoAuthFingerprint(baseUrl, apiKey) {
    const keyTag = apiKey ? `len${apiKey.length}:${apiKey.slice(0, 4)}` : 'nokey';
    return `${baseUrl}|${keyTag}`;
}

/** Invalidate the auth success cache (call whenever key/URL/provider changes). */
function invalidateSeoAuthCache() {
    _seoAuthCache = null;
}

function setSeoKeyServerStatus(isOnline, { checking = false } = {}) {
    const dot = document.getElementById('seo-api-key-dot');
    const text = document.getElementById('seo-api-key-status-text');
    const headerDot = document.getElementById('seo-api-key-dot-header');
    const headerText = document.getElementById('seo-api-key-status-text-header');
    const statusTitle = checking
        ? 'سيرفر مفتاح: جاري الفحص...'
        : (isOnline ? 'سيرفر مفتاح: متصل ✅' : 'سيرفر مفتاح: غير متصل ❌');
    const statusLabel = checking ? 'جاري الفحص...' : (isOnline ? 'متصل' : 'غير متصل');
    const statusColor = checking ? '#fbbf24' : (isOnline ? '#34d399' : '#f87171');

    [dot, headerDot].forEach((el) => {
        if (!el) return;
        el.classList.toggle('is-online', !!isOnline && !checking);
        el.classList.toggle('is-checking', !!checking);
        el.title = statusTitle;
    });
    [text, headerText].forEach((el) => {
        if (!el) return;
        el.textContent = statusLabel;
        el.style.color = statusColor;
    });
}

function initSeoCliproxyAccordion() {
    const accordion = document.getElementById('seo-cliproxy-accordion');
    const trigger = document.getElementById('seo-cliproxy-accordion-trigger');
    const showKeysLabel = document.getElementById('seo-api-keys-show-label');
    if (!accordion || !trigger) return;

    const setOpen = (isOpen, persist = true) => {
        accordion.classList.toggle('is-open', isOpen);
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (persist) {
            chrome.storage.local.set({ [SEO_CLIPROXY_PANEL_OPEN_KEY]: isOpen }).catch(() => {});
        }
    };

    if (!initSeoCliproxyAccordion._bound) {
        initSeoCliproxyAccordion._bound = true;
        trigger.addEventListener('click', () => {
            setOpen(!accordion.classList.contains('is-open'));
        });
        showKeysLabel?.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        chrome.storage.local.get([SEO_CLIPROXY_PANEL_OPEN_KEY], (result) => {
            setOpen(result[SEO_CLIPROXY_PANEL_OPEN_KEY] === true, false);
        });
    }
}

async function testSeoApiKeyConnection({ baseUrlInput, gptInput, silent = false, force = false } = {}) {
    // ── Resolve baseUrl and apiKey ──────────────────────────────────────
    let rawBaseUrl = baseUrlInput?.value;
    if (!rawBaseUrl) rawBaseUrl = document.getElementById('seo-api-base-url')?.value;
    let rawApiKey = gptInput?.value;
    if (!rawApiKey) rawApiKey = document.getElementById('seo-api-key-gpt')?.value;

    if (!rawBaseUrl || !rawApiKey) {
        const storedKeys = await getStoredSeoAiKeys();
        if (!rawBaseUrl) rawBaseUrl = storedKeys.baseUrl;
        if (!rawApiKey) rawApiKey = storedKeys.gpt;
    }

    const baseUrl = resolveSeoProxyBaseUrl(rawBaseUrl);
    let apiKey = String(rawApiKey || '').trim();
    if (isSeoLocalProxyBaseUrl(baseUrl)) {
        // Local 8317 always uses the gateway key; cloud SEO key is separate (Render).
        apiKey = SEO_LOCAL_CLIPROXY_API_KEY;
    } else if (!apiKey || apiKey === SEO_LOCAL_CLIPROXY_API_KEY || /^AIza[0-9A-Za-z_\-]{10,}$/.test(apiKey)) {
        const storedKeys = await getStoredSeoAiKeys();
        apiKey = pickSeoCloudApiKey(apiKey, storedKeys.gpt) || apiKey;
    }

    // ── Early return: missing key ───────────────────────────────────────
    const storedForCloud = await getStoredSeoAiKeys();
    const hasCloudKey = !!pickSeoCloudApiKey(apiKey, storedForCloud.gpt, document.getElementById('seo-api-key-gpt')?.value);
    if (!apiKey && !hasCloudKey) {
        setSeoKeyServerStatus(false);
        const message = '⚠️ أدخل مفتاح API أولاً';
        if (!silent && typeof showToast === 'function') showToast(message);
        return { serverOk: false, keyOk: false, message };
    }

    const fingerprint = _seoAuthFingerprint(baseUrl, apiKey || 'cloud-pending');

    // ── Cache hit: return cached result within TTL ──────────────────────
    if (!force && _seoAuthCache && _seoAuthCache.fingerprint === fingerprint && Date.now() < _seoAuthCache.expiresAt) {
        console.debug('[SEO-API-DEBUG] Auth cache hit — skipping /v1/models request.');
        setSeoKeyServerStatus(!!_seoAuthCache.result.keyOk);
        return _seoAuthCache.result;
    }

    // ── In-flight deduplication: share the same Promise ────────────────
    if (_seoKeyCheckInFlightPromise) {
        return _seoKeyCheckInFlightPromise;
    }

    setSeoKeyServerStatus(false, { checking: true });

    const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    const doCheck = async () => {
        let serverOk = false;
        let keyOk = false;
        let message = '';
        const storedKeys = await getStoredSeoAiKeys();
        const cloudApiKey = pickSeoCloudApiKey(
            ...collectSeoProxyEndpointsFromDom().map((ep) => (!isSeoLocalProxyBaseUrl(ep.baseUrl) ? ep.apiKey : '')),
            apiKey,
            storedKeys.gpt
        );
        const endpointCandidates = sanitizeSeoProxyEndpointsForLocal(
            collectSeoProxyEndpointsFromDom().filter((item) => item.enabled !== false),
            cloudApiKey
        );
        const chain = endpointCandidates.length
            ? endpointCandidates
            : [{
                baseUrl,
                apiKey: isSeoLocalProxyBaseUrl(baseUrl) ? SEO_LOCAL_CLIPROXY_API_KEY : cloudApiKey || apiKey,
                label: 'Primary'
            }];

        const probeModels = async (candidateUrl, candidateKey, label) => {
            const modelsUrl = `${candidateUrl}/models`;
            console.log(`[SEO-API-DEBUG] GET ${modelsUrl} | endpoint=${label || 'primary'}`);
            const authRes = await fetchWithTimeout(modelsUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${candidateKey}`
                }
            });
            const responseBodyText = await authRes.text().catch(() => '');
            console.log(`[SEO-API-DEBUG] Response: ${authRes.status} from GET ${modelsUrl} | Body sample:`, responseBodyText.slice(0, 200));
            return { authRes, responseBodyText, modelsUrl };
        };

        try {
            for (const endpoint of chain) {
                const candidateUrl = resolveSeoProxyBaseUrl(endpoint.baseUrl || baseUrl);
                const isLocal = isSeoLocalProxyBaseUrl(candidateUrl);
                const candidateKey = resolveSeoEndpointBearerKey(endpoint, cloudApiKey, apiKey);
                if (!candidateKey) continue;

                let { authRes, responseBodyText } = await probeModels(
                    candidateUrl,
                    candidateKey,
                    endpoint.label || 'primary'
                );

                // Cloud primary failed → try local backup with nhp-local-cliproxy-key (once).
                if (
                    !authRes.ok
                    && !isLocal
                    && (authRes.status === 401 || authRes.status === 403 || authRes.status >= 500)
                ) {
                    const localUrl = resolveSeoProxyBaseUrl(`http://127.0.0.1:${SEO_LOCAL_CLI_PROXY_PORT}/v1`);
                    const localProbe = await probeModels(
                        localUrl,
                        SEO_LOCAL_CLIPROXY_API_KEY,
                        'CLIProxy محلي (احتياط)'
                    );
                    if (localProbe.authRes.ok) {
                        serverOk = true;
                        keyOk = true;
                        message = '✅ CLIProxy المحلي (احتياط) — السحابة فشلت';
                        _seoAuthCache = {
                            fingerprint: _seoAuthFingerprint(localUrl, SEO_LOCAL_CLIPROXY_API_KEY),
                            result: { serverOk, keyOk, message, baseUrl: localUrl, failoverFrom: candidateUrl },
                            expiresAt: Date.now() + SEO_AUTH_CACHE_TTL_MS
                        };
                        break;
                    }
                }

                if (authRes.ok) {
                    serverOk = true;
                    keyOk = true;
                    message = `✅ ${endpoint.label || 'Endpoint'} يعمل`;
                    _seoAuthCache = {
                        fingerprint: _seoAuthFingerprint(candidateUrl, candidateKey),
                        result: { serverOk, keyOk, message, baseUrl: candidateUrl },
                        expiresAt: Date.now() + SEO_AUTH_CACHE_TTL_MS
                    };
                    break;
                }

                serverOk = authRes.status < 500;
                if (authRes.status === 401 || authRes.status === 403) {
                    message = isLocal
                        ? `❌ ${endpoint.label || 'Endpoint'} — استخدم ${SEO_LOCAL_CLIPROXY_API_KEY} محلياً`
                        : `❌ ${endpoint.label || 'Endpoint'} — مفتاح سحابي مرفوض (سيُجرّب المحلي)`;
                    continue;
                }
                message = `❌ ${endpoint.label || 'Endpoint'} — HTTP ${authRes.status}${responseBodyText ? ` — ${responseBodyText.slice(0, 80)}` : ''}`;
            }

            // Last resort: local backup if chain never included / never reached it.
            if (!keyOk) {
                const localUrl = resolveSeoProxyBaseUrl(`http://127.0.0.1:${SEO_LOCAL_CLI_PROXY_PORT}/v1`);
                const alreadyTriedLocal = chain.some((ep) => isSeoLocalProxyBaseUrl(resolveSeoProxyBaseUrl(ep.baseUrl || '')));
                if (!alreadyTriedLocal) {
                    const localProbe = await probeModels(localUrl, SEO_LOCAL_CLIPROXY_API_KEY, 'CLIProxy محلي (احتياط)');
                    if (localProbe.authRes.ok) {
                        serverOk = true;
                        keyOk = true;
                        message = '✅ CLIProxy المحلي (احتياط)';
                        _seoAuthCache = {
                            fingerprint: _seoAuthFingerprint(localUrl, SEO_LOCAL_CLIPROXY_API_KEY),
                            result: { serverOk, keyOk, message, baseUrl: localUrl },
                            expiresAt: Date.now() + SEO_AUTH_CACHE_TTL_MS
                        };
                    }
                }
            }

            if (!keyOk && !message) {
                message = '❌ لا يوجد endpoint متاح — تحقق من مفتاح السحابة أو شغّل CLIProxy المحلي على 8317';
            }
        } catch (error) {
            const errMsg = String(error?.message || error || '');
            console.error(`[SEO-API-DEBUG] Connection failed: ${errMsg}`);
            serverOk = false;
            keyOk = false;
            _seoAuthCache = null;
            if (/abort|timeout/i.test(errMsg)) {
                message = '❌ CLI Proxy غير متاح — شغّل السيرفر على المنفذ 8317 أو Render';
            } else {
                message = `❌ تعذر الاتصال: ${errMsg}`;
            }
        } finally {
            setSeoKeyServerStatus(!!keyOk);
            _seoKeyCheckInFlightPromise = null;
        }

        if (!silent && typeof showToast === 'function' && message) {
            showToast(message);
        }

        return { serverOk, keyOk, message };
    };

    _seoKeyCheckInFlightPromise = doCheck();
    return _seoKeyCheckInFlightPromise;
}

function scheduleSeoKeyConnectionCheck(baseUrlInput, gptInput, delayMs = 1200) {
    // Invalidate cache whenever the user types a new key or URL
    invalidateSeoAuthCache();
    if (scheduleSeoKeyConnectionCheck._timer) {
        clearTimeout(scheduleSeoKeyConnectionCheck._timer);
    }
    scheduleSeoKeyConnectionCheck._timer = setTimeout(() => {
        testSeoApiKeyConnection({ baseUrlInput, gptInput, silent: true, force: true }).catch(() => {});
    }, delayMs);
}

function startSeoKeyMonitor(baseUrlInput, gptInput) {
    if (_seoKeyMonitorTimer) return;
    // Initial check immediately; subsequent checks every 60s (cache handles dedup within TTL)
    testSeoApiKeyConnection({ baseUrlInput, gptInput, silent: true }).catch(() => {});
    _seoKeyMonitorTimer = setInterval(() => {
        testSeoApiKeyConnection({ baseUrlInput, gptInput, silent: true }).catch(() => {});
    }, SEO_AUTH_CACHE_TTL_MS);
}

function initSeoApiKeysPanel() {
    initSeoCliproxyAccordion();
    const geminiInput = document.getElementById('seo-api-key-gemini');
    const cursorInput = document.getElementById('seo-api-key-cursor');
    const gptInput = document.getElementById('seo-api-key-gpt');
    const baseUrlInput = document.getElementById('seo-api-base-url');
    const saveBtn = document.getElementById('seo-api-keys-save');
    const showToggle = document.getElementById('seo-api-keys-show');
    const mgmtLocalBtn = document.getElementById('seo-mgmt-local-btn');
    const mgmtCloudBtn = document.getElementById('seo-mgmt-cloud-btn');
    const mgmtCurrentBtn = document.getElementById('seo-mgmt-current-btn');
    const routingModeSelect = document.getElementById('seo-proxy-routing-mode');
    if (!geminiInput || !cursorInput || !gptInput) return;

    const setKeyFieldsVisibility = (isVisible) => {
        const targetType = isVisible ? 'text' : 'password';
        [geminiInput, cursorInput, gptInput].forEach((input) => {
            if (input) input.type = targetType;
        });
        document.querySelectorAll('.seo-proxy-endpoint-key').forEach((input) => {
            input.type = targetType;
        });
    };

    const loadSeoApiKeysIntoForm = async () => {
        const storedKeys = await getStoredSeoAiKeys();
        geminiInput.value = storedKeys.gemini || '';
        cursorInput.value = storedKeys.cursor || DEFAULT_CURSOR_API_KEY;
        gptInput.value = storedKeys.gpt || DEFAULT_NHP_API_KEY;
        if (baseUrlInput) {
            baseUrlInput.value = resolveSeoProxyBaseUrl(storedKeys.baseUrl || DEFAULT_NHP_PROXY_BASE_URL);
        }
        const endpoints = await loadSeoProxyEndpointsFromStorage();
        renderSeoProxyEndpoints(endpoints);
        if (routingModeSelect) {
            routingModeSelect.value = await getSeoProxyRoutingMode();
        }
    };

    if (!initSeoApiKeysPanel._bound) {
        initSeoApiKeysPanel._bound = true;
        if (showToggle) {
            showToggle.checked = false;
            showToggle.addEventListener('click', (event) => {
                event.stopPropagation();
            });
            showToggle.addEventListener('change', (e) => {
                setKeyFieldsVisibility(!!e.target.checked);
            });
        }
        document.getElementById('seo-proxy-endpoint-add')?.addEventListener('click', () => {
            const current = collectSeoProxyEndpointsFromDom();
            current.push({
                id: `endpoint-${Date.now()}`,
                label: 'CLIProxy إضافي',
                baseUrl: '',
                apiKey: gptInput?.value || '',
                enabled: true,
                priority: (current.length + 1) * 10
            });
            renderSeoProxyEndpoints(current);
        });
        setKeyFieldsVisibility(false);
        baseUrlInput?.addEventListener('input', () => scheduleSeoKeyConnectionCheck(baseUrlInput, gptInput));
        gptInput?.addEventListener('input', () => scheduleSeoKeyConnectionCheck(baseUrlInput, gptInput));
        mgmtLocalBtn?.addEventListener('click', () => {
            openSeoManagementUrl(SEO_LOCAL_MANAGEMENT_URL);
            if (typeof showToast === 'function') showToast('✅ فتح لوحة CLIProxy المحلية');
        });
        mgmtCloudBtn?.addEventListener('click', () => {
            openSeoManagementUrl(SEO_CLOUD_MANAGEMENT_URL);
            if (typeof showToast === 'function') showToast('✅ فتح لوحة CLIProxy السحابية');
        });
        mgmtCurrentBtn?.addEventListener('click', () => {
            const currentBaseUrl = baseUrlInput?.value?.trim() || DEFAULT_NHP_PROXY_BASE_URL;
            openSeoManagementUrl(buildSeoManagementUrl(currentBaseUrl));
            if (typeof showToast === 'function') showToast('✅ فتح لوحة الإدارة للـ Base URL الحالي');
        });
        routingModeSelect?.addEventListener('change', () => {
            saveSeoProxyRoutingMode(routingModeSelect.value).catch(() => {});
            invalidateSeoAuthCache();
        });
        saveBtn?.addEventListener('click', async () => {
            try {
                if (routingModeSelect) {
                    await saveSeoProxyRoutingMode(routingModeSelect.value);
                }
                const saved = await saveSeoAiKeys({
                    gemini: geminiInput.value || '',
                    cursor: cursorInput.value || DEFAULT_CURSOR_API_KEY,
                    gpt: gptInput.value || DEFAULT_NHP_API_KEY,
                    baseUrl: resolveSeoProxyBaseUrl(baseUrlInput?.value || DEFAULT_NHP_PROXY_BASE_URL)
                });
                await saveSeoProxyEndpointsFromDom(true);
                if (typeof showToast === 'function') {
                    showToast(`✅ تم حفظ إعدادات NHP API`);
                }
                // Invalidate auth cache so the new saved key is verified fresh
                invalidateSeoAuthCache();
                testSeoApiKeyConnection({ baseUrlInput, gptInput, silent: true, force: true }).catch(() => {});
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast(`❌ فشل حفظ مفاتيح SEO: ${error?.message || 'خطأ غير معروف'}`);
                }
            }
        });
        startSeoKeyMonitor(baseUrlInput, gptInput);
    }

    loadSeoApiKeysIntoForm()
        .then(() => testSeoApiKeyConnection({ baseUrlInput, gptInput, silent: true }))
        .catch(() => {});
}

async function getSeoGenerationProvider() {
    const stored = await getStoredStringValue(SEO_GENERATION_PROVIDER_STORAGE_KEY);
    if (stored === SEO_PROVIDERS.GEMINI_API || stored === SEO_PROVIDERS.CURSOR_API) {
        return SEO_PROVIDERS.GPT_API;
    }
    const allowed = Object.values(SEO_PROVIDERS);
    if (allowed.includes(stored)) return stored;
    return SEO_PROVIDERS.LOCAL_LIBRARY;
}

async function setSeoGenerationProvider(provider) {
    const next = Object.values(SEO_PROVIDERS).includes(provider)
        ? provider
        : SEO_PROVIDERS.GEMINI_API;
    try {
        await chrome.storage.local.set({ [SEO_GENERATION_PROVIDER_STORAGE_KEY]: next });
    } catch (_) {}
    return next;
}

function refreshSeoProviderButtons(activeProvider) {
    const scope = document.getElementById('panel-seo') || document;
    scope.querySelectorAll('.seo-provider-btn').forEach((btn) => {
        const provider = btn.getAttribute('data-provider');
        btn.classList.toggle('active', provider === activeProvider);
    });
}

async function refreshSeoProviderModeNote(provider) {
    const note = document.getElementById('seo-ai-window-mode-note');
    const windowToggle = document.getElementById('seo-ai-window-mode-toggle');
    if (!note) return;
    if (isLocalLibraryProvider(provider)) {
        note.textContent = 'المكتبة المحلية: 15 تاج BubbleSpider + عنوان/وصف عبر NHP API (نص فقط، بدون تحليل صورة) — فحص TMHunt إجباري.';
        if (windowToggle) windowToggle.disabled = false;
        refreshSeoTmhBypassUiForProvider(provider);
        return;
    }
    refreshSeoTmhBypassUiForProvider(provider);
    if (windowToggle) windowToggle.disabled = false;
    const enabled = await isSeoAiWindowModeEnabled();
    refreshSeoAiWindowModeButton(enabled !== false);
}

const SEO_PROVIDER_LABELS = {
    [SEO_PROVIDERS.GEMINI_API]: 'Gemini API',
    [SEO_PROVIDERS.GPT_API]: 'NHP API',
    [SEO_PROVIDERS.CURSOR_API]: 'Cursor API',
    [SEO_PROVIDERS.GEMINI_WEB]: 'Gemini Web (نافذة)',
    [SEO_PROVIDERS.LOCAL_LIBRARY]: 'مكتبة محلية — BubbleSpider + NHP API (نص)'
};

async function applySeoGenerationProvider(provider) {
    if (!provider || !Object.values(SEO_PROVIDERS).includes(provider)) return;
    const saved = await setSeoGenerationProvider(provider);
    // Provider changed — invalidate auth cache so next check uses correct credentials
    invalidateSeoAuthCache();
    refreshSeoProviderButtons(saved);
    await refreshSeoProviderModeNote(saved);
    if (typeof showToast === 'function') {
        showToast(`⚙️ طريقة SEO: ${SEO_PROVIDER_LABELS[saved] || saved}`);
    }
}

function ensureSeoProviderPanelDelegation() {
    try {
        const panel = document.getElementById('panel-seo');
        if (!panel || panel.dataset.seoProviderDelegation === '1') return;
        if (!panel.querySelector('#seo-provider-row')) return;
        panel.dataset.seoProviderDelegation = '1';

        panel.addEventListener('click', (event) => {
            const btn = event.target && event.target.closest
                ? event.target.closest('.seo-provider-btn')
                : null;
            if (!btn || !panel.contains(btn)) return;
            const provider = btn.getAttribute('data-provider');
            if (provider) void applySeoGenerationProvider(provider);
        });

        panel.addEventListener('change', (event) => {
            const toggle = event.target;
            if (!toggle || toggle.id !== 'seo-ai-window-mode-toggle') return;
            const enabled = toggle.checked !== false;
            try {
                chrome.storage.local.set({ [SEO_AI_WINDOW_MODE_STORAGE_KEY]: enabled }, () => {
                    refreshSeoAiWindowModeButton(enabled);
                    if (typeof showToast === 'function') {
                        showToast(enabled
                            ? '✅ عند فشل المفتاح/API سيتم فتح Gem أو ChatGPT'
                            : '⏸ لن تُفتح نوافذ احتياطية — API فقط');
                    }
                });
            } catch (_) {
                refreshSeoAiWindowModeButton(enabled);
            }
        });
    } catch (err) {
        console.warn('[NHP SEO] provider delegation bind skipped:', err);
    }
}

function initSeoProviderPanel() {
    ensureSeoProviderPanelDelegation();

    const windowToggle = document.getElementById('seo-ai-window-mode-toggle');
    if (windowToggle) {
        isSeoAiWindowModeEnabled().then((enabled) => {
            windowToggle.checked = enabled !== false;
            refreshSeoAiWindowModeButton(enabled !== false);
        }).catch(() => {});
    }

    getSeoGenerationProvider()
        .then(async (provider) => {
            refreshSeoProviderButtons(provider);
            await refreshSeoProviderModeNote(provider);
        })
        .catch(() => {
            refreshSeoProviderButtons(SEO_PROVIDERS.LOCAL_LIBRARY);
        });
}

async function shouldUseGeminiWebBatchFirst() {
    const provider = await getSeoGenerationProvider();
    return provider === SEO_PROVIDERS.GEMINI_WEB;
}

function isLocalLibraryProvider(provider) {
    return provider === SEO_PROVIDERS.LOCAL_LIBRARY;
}

async function resolveSeoActiveProvider(routingOptions = {}) {
    const override = routingOptions?.providerOverride;
    if (override && Object.values(SEO_PROVIDERS).includes(override)) {
        return override;
    }
    return getSeoGenerationProvider();
}

async function shouldBypassTmhVerification(explicitProvider = null) {
    const provider = explicitProvider || await getSeoGenerationProvider();
    if (isLocalLibraryProvider(provider)) return false;
    return document.getElementById('seo-bypass-tmh')?.checked
        || document.getElementById('ap-bypass-tmh')?.checked
        || false;
}

function refreshSeoTmhBypassUiForProvider(provider) {
    const mandatory = isLocalLibraryProvider(provider);
    const seoBypass = document.getElementById('seo-bypass-tmh');
    const apBypass = document.getElementById('ap-bypass-tmh');
    [seoBypass, apBypass].forEach((el) => {
        if (!el) return;
        el.disabled = mandatory;
        if (mandatory) el.checked = false;
    });
    const seoLabel = document.querySelector('label[for="seo-bypass-tmh"]');
    const apLabel = document.querySelector('label[for="ap-bypass-tmh"]');
    if (mandatory) {
        if (seoLabel) seoLabel.textContent = 'TMHunt إجباري';
        if (apLabel) apLabel.textContent = 'TMHunt إجباري';
    } else {
        if (seoLabel) seoLabel.textContent = 'تخطي TMHunt';
        if (apLabel) apLabel.textContent = '⚡ تخطي فحص TMHunt';
    }
}

function sendSeoApiBridgeMessage(payload, timeoutMs = SEO_BRIDGE_MESSAGE_TIMEOUT_MS) {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => {
            settle({
                success: false,
                error: `انتهت مهلة الاتصال بالخلفية (${Math.round(timeoutMs / 1000)}ث)`
            });
        }, Math.max(1000, Number(timeoutMs) || SEO_BRIDGE_MESSAGE_TIMEOUT_MS));
        try {
            chrome.runtime.sendMessage(payload, (res) => {
                if (chrome.runtime?.lastError) {
                    settle({
                        success: false,
                        error: chrome.runtime.lastError.message || 'Extension background is unavailable.'
                    });
                    return;
                }
                settle(res || { success: false, error: 'Empty response from background.' });
            });
        } catch (err) {
            settle({ success: false, error: err?.message || 'Failed to reach extension background.' });
        }
    });
}

function enterSeoBatchStopMode() {
    const btn = S.genAndUploadBtn;
    if (!btn) return;
    if (!seoGenBtnDefaultHtml) {
        seoGenBtnDefaultHtml = btn.innerHTML;
        seoGenBtnDefaultTitle = btn.title || '';
        seoGenBtnDefaultStyle = btn.style.cssText || '';
    }
    btn.dataset.seoStopMode = '1';
    btn.disabled = false;
    btn.title = 'إيقاف التوليد الجاري';
    btn.innerHTML = '<i class="fa-solid fa-stop"></i> إيقاف';
    btn.style.background = '#ef4444';
    btn.style.color = '#ffffff';
    btn.style.borderColor = '#dc2626';
    if (S.genBtn) S.genBtn.disabled = true;
    const retryBtn = document.getElementById('seo-retry-missing-btn');
    if (retryBtn) retryBtn.disabled = true;
}

function exitSeoBatchStopMode() {
    const btn = S.genAndUploadBtn;
    if (!btn || btn.dataset.seoStopMode !== '1') return;
    delete btn.dataset.seoStopMode;
    if (seoGenBtnDefaultHtml) btn.innerHTML = seoGenBtnDefaultHtml;
    btn.title = seoGenBtnDefaultTitle || 'توليد SEO فقط بدون رفع';
    if (seoGenBtnDefaultStyle) btn.style.cssText = seoGenBtnDefaultStyle;
    btn.disabled = false;
    const retryBtn = document.getElementById('seo-retry-missing-btn');
    if (retryBtn) retryBtn.disabled = false;
}

function requestStopSeoBatchGeneration() {
    if (!window.isSeoProcessing) return;
    seoGenerationCancelled = true;
    window.isSeoProcessing = false;
    try {
        const queue = typeof getDesignQueue === 'function' ? getDesignQueue() : [];
        for (const item of queue) {
            if (item.status === 'loading') item.status = 'pending';
        }
        if (typeof renderQueue === 'function') renderQueue();
    } catch (_) { /* non-critical */ }
    showToast('⏹ تم إيقاف توليد SEO');
    resetSeoGenerationUiState({ hideBatchProgress: false });
}

/** Always release SEO batch UI locks — safe to call multiple times. */
function resetSeoGenerationUiState({ hideBatchProgress = true, hideLoading = true } = {}) {
    window.isSeoProcessing = false;
    if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(false);
    else window.isBatchProcessing = false;
    exitSeoBatchStopMode();
    if (S.genBtn) S.genBtn.disabled = false;
    if (S.genAndUploadBtn && S.genAndUploadBtn.dataset.seoStopMode !== '1') S.genAndUploadBtn.disabled = false;
    if (hideLoading && S.loading) S.loading.classList.add('hidden');
    if (S.tpBtn) S.tpBtn.disabled = false;
    if (hideBatchProgress) {
        const wrap = document.getElementById('seo-batch-progress');
        if (wrap) wrap.classList.add('hidden');
    }
}

function seoSleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function seoQueuePersistOptionsForProvider(provider) {
    return isLocalLibraryProvider(provider) ? { metadataOnly: true } : {};
}

async function persistSeoQueueBounded(immediate = true, options = {}) {
    if (typeof saveQueueToStorage !== 'function') return false;
    try {
        return await Promise.race([
            saveQueueToStorage(immediate, options),
            seoSleepMs(SEO_QUEUE_PERSIST_TIMEOUT_MS).then(() => {
                console.warn('[SEO] Queue persist timed out — continuing without blocking UI');
                return false;
            })
        ]);
    } catch (err) {
        console.warn('[SEO] Queue persist failed:', err);
        return false;
    }
}

function updateSeoCliProxyRetryUi(msg = {}) {
    const attempt = Number(msg.attempt) || 1;
    const delaySec = Math.max(1, Math.round((Number(msg.delayMs) || SEO_GPT_PARSE_RETRY_INITIAL_DELAY_MS) / 1000));
    const statusText = msg.status === 'waiting'
        ? `⏳ CLI Proxy غير جاهز — إعادة ${attempt} بعد ${delaySec}ث...`
        : `⏳ CLI Proxy — محاولة ${attempt}...`;
    if (S.loading) {
        S.loading.innerHTML = `<div class="spinner-small" style="width:15px; height:15px; margin: 0 auto 5px;"></div> ${statusText}`;
        S.loading.classList.remove('hidden');
    }
}

function ensureSeoCliProxyRetryStatusListener() {
    if (ensureSeoCliProxyRetryStatusListener._bound) return;
    ensureSeoCliProxyRetryStatusListener._bound = true;
    try {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg?.action !== 'cli_proxy_retry_status') return;
            const context = String(msg.context || '');
            if (context !== 'call_gpt' && context !== 'seo-gpt') return;
            if (msg.status === 'success') return;
            updateSeoCliProxyRetryUi(msg);
        });
    } catch (_) { }
}

function isGptApiNonRetryableError(message = '') {
    const text = String(message || '').toLowerCase();
    return text.includes('api key is missing')
        || text.includes('invalid api key')
        || text.includes('incorrect api key')
        || text.includes('http 401')
        || text.includes('http 403')
        || text.includes('permission denied')
        || text.includes('unauthorized');
}

async function prepareSeoGptImagePayload(base64) {
    const raw = String(base64 || '').trim();
    if (!raw) return null;
    try {
        const clean = raw.startsWith('data:') ? (raw.split(',')[1] || '') : raw;
        return await createThumbnail(clean, SEO_GPT_IMAGE_MAX_WIDTH);
    } catch (_) {
        return raw;
    }
}

async function callGeminiApiCore(prompt, base64, niche, isImageOnly, primaryKeyword) {
    const finalKey = await getSeoGeminiApiKey();
    if (!finalKey) return { error: 'Gemini API key is missing.' };

    if (getGeminiCooldownRemainingMs() > 0) {
        return { error: formatGeminiCooldownMessage() };
    }

    const hasPrefix = typeof base64 === 'string' && base64.startsWith('data:');
    const mimeType = hasPrefix ? (base64.match(/^data:([^;,]+)[;,]/i)?.[1] || 'image/png') : 'image/png';

    const response = await sendSeoApiBridgeMessage({
        action: 'call_gemini',
        prompt,
        base64,
        mimeType,
        apiKey: finalKey
    });

    if (!response?.success || !response?.data) {
        const responseError = response?.error || 'Unknown Connection Error';
        if (isGeminiRateLimitError(responseError)) activateGeminiCooldown();
        return { error: responseError };
    }

    const parsed = parseGeminiSeoPayload(
        response.data,
        niche,
        isImageOnly,
        primaryKeyword,
        response.data?.source || 'gemini-primary'
    );
    if (!parsed) return { error: 'Gemini returned empty or invalid SEO payload.' };
    return { meta: parsed };
}

async function callGptApiCore(prompt, base64, niche, isImageOnly, primaryKeyword, routingOptions = {}) {
    const keys = await resolveSeoActiveApiCredentials();
    const apiKey = String(keys.gpt || '').trim();
    if (!apiKey && !keys.endpoints?.some((item) => item.apiKey || /8317/.test(item.baseUrl || ''))) {
        return { error: 'GPT API key is missing.' };
    }

    const proxyRoutingMode = routingOptions.proxyRoutingMode || await getSeoProxyRoutingMode();

    const optimizedBase64 = await prepareSeoGptImagePayload(base64);
    const hasPrefix = typeof optimizedBase64 === 'string' && optimizedBase64.startsWith('data:');
    const mimeType = hasPrefix ? (optimizedBase64.match(/^data:([^;,]+)[;,]/i)?.[1] || 'image/jpeg') : 'image/jpeg';
    let parseAttempt = 0;
    let parseDelayMs = SEO_GPT_PARSE_RETRY_INITIAL_DELAY_MS;
    let modelIndex = 0;
    let lastError = '';

    while (modelIndex < SEO_GPT_MODEL_CHAIN.length) {
        const model = SEO_GPT_MODEL_CHAIN[modelIndex];
        parseAttempt += 1;
        if (parseAttempt > 1) {
            updateSeoCliProxyRetryUi({ context: 'seo-gpt', attempt: parseAttempt, delayMs: parseDelayMs, status: 'waiting' });
            await seoSleepMs(parseDelayMs);
            parseDelayMs = Math.min(
                SEO_GPT_PARSE_RETRY_MAX_DELAY_MS,
                Math.round(parseDelayMs * SEO_GPT_PARSE_RETRY_BACKOFF_FACTOR)
            );
        }

        const response = await sendSeoApiBridgeMessage({
            action: 'call_gpt',
            prompt,
            base64: optimizedBase64,
            mimeType,
            apiKey,
            proxyRoutingMode,
            batchIndex: routingOptions.batchIndex,
            endpointId: routingOptions.endpointId,
            model,
            retryContext: 'seo-gpt',
            persistentRetry: false,
            maxAttempts: 1,
            fetchTimeoutMs: SEO_GPT_MODEL_TIMEOUT_MS
        }, SEO_BRIDGE_MESSAGE_TIMEOUT_MS);

        if (!response?.success || !response?.data) {
            const err = response?.error || 'GPT API request failed.';
            if (isGptApiNonRetryableError(err)) return { error: err };
            lastError = `${model}: ${err}`;
            modelIndex += 1;
            if (modelIndex >= SEO_GPT_MODEL_CHAIN.length || parseAttempt >= SEO_GPT_PARSE_MAX_ATTEMPTS) {
                return { error: lastError };
            }
            updateSeoCliProxyRetryUi({ context: 'seo-gpt', attempt: parseAttempt, delayMs: parseDelayMs, status: 'retry', error: err });
            continue;
        }

        const parsed = parseGeminiSeoPayload(
            response.data,
            niche,
            isImageOnly,
            primaryKeyword,
            response.data?.source || `gpt-api:${model}`
        );
        if (parsed) return { meta: parsed };

        lastError = `${model}: GPT returned empty or invalid SEO payload.`;
        modelIndex += 1;
        if (modelIndex >= SEO_GPT_MODEL_CHAIN.length || parseAttempt >= SEO_GPT_PARSE_MAX_ATTEMPTS) {
            return { error: lastError };
        }

        updateSeoCliProxyRetryUi({
            context: 'seo-gpt',
            attempt: parseAttempt,
            delayMs: parseDelayMs,
            status: 'retry',
            error: 'GPT returned empty or invalid SEO payload.'
        });
    }

    return { error: lastError || 'All SEO GPT models failed.' };
}

async function callCursorApiCore(prompt, base64, niche, isImageOnly, primaryKeyword) {
    const keys = await getStoredSeoAiKeys();
    const apiKey = String(keys.cursor || DEFAULT_CURSOR_API_KEY).trim();
    if (!apiKey) return { error: 'Cursor API key is missing.' };

    const hasPrefix = typeof base64 === 'string' && base64.startsWith('data:');
    const mimeType = hasPrefix ? (base64.match(/^data:([^;,]+)[;,]/i)?.[1] || 'image/png') : 'image/png';

    const response = await sendSeoApiBridgeMessage({
        action: 'call_cursor_api',
        prompt,
        base64,
        mimeType,
        apiKey
    });

    if (!response?.success || !response?.data) {
        return { error: response?.error || 'Cursor API request failed.' };
    }

    const parsed = parseGeminiSeoPayload(
        response.data,
        niche,
        isImageOnly,
        primaryKeyword,
        response.data?.source || 'cursor-api'
    );
    if (!parsed) return { error: 'Cursor returned empty or invalid SEO payload.' };
    return { meta: parsed };
}

async function callSeoApiByProvider(provider, prompt, base64, niche, isImageOnly, primaryKeyword, routingOptions = {}) {
    if (provider === SEO_PROVIDERS.GPT_API) {
        return callGptApiCore(prompt, base64, niche, isImageOnly, primaryKeyword, routingOptions);
    }
    if (provider === SEO_PROVIDERS.CURSOR_API) {
        return callCursorApiCore(prompt, base64, niche, isImageOnly, primaryKeyword);
    }
    return callGeminiApiCore(prompt, base64, niche, isImageOnly, primaryKeyword);
}

function isApiProvider(provider) {
    return provider === SEO_PROVIDERS.GEMINI_API
        || provider === SEO_PROVIDERS.GPT_API
        || provider === SEO_PROVIDERS.CURSOR_API;
}

// Shared Utility: Niche Cleaning
function cleanNicheName(name) {
    if (!name) return "Design";
    return name
        .replace(/\.[^/.]+$/, "")             // Remove extension
        .replace(/[_-]/g, " ")                // Replace _ and - with space
        .replace(/\(\d+\)/g, "")              // Remove (1)
        .replace(/\[\d+\]/g, "")              // Remove [9]
        .replace(/\s+(copy|نسخة)\s*\d*$/ig, "") // Remove " copy 2"
        .replace(/(?:\s*\d+)+\s*$/, "")       // Aggressively remove ALL trailing numbers even if separated by spaces or followed by spaces
        .replace(/(?:\s*[\[\(]?\s*\d+\s*[\]\)]?\s*)+$/, "") // Aggressively remove ALL trailing numbers even if inside () or []
        .replace(/[\[\(]\s*\d+\s*[\]\)]/g, "") // Remove any remaining (1) or [1] anywhere in the text
        .replace(/\s+/g, " ")                 // Double spaces
        .trim();
}

function sanitizeMainTag(value) {
    return String(value || '').trim().slice(0, MAIN_TAG_MAX_LENGTH).trim();
}

function sanitizeSeoTitle(value, fallbackKeyword = 'Design') {
    const keyword = cleanNicheName(fallbackKeyword || 'Design');
    let title = String(value || '').trim();
    title = title
        .replace(/\s*[-–—:|]\s*creative\s+vintage\s+graphic\s+design\s*$/ig, '')
        .replace(/\bcreative\s+vintage\s+graphic\s+design\b/ig, '')
        .replace(/\bcreative\s+print\s+design\b/ig, '')
        .replace(/\bgraphic\s+design\b/ig, '')
        .replace(/\s*[-–—:|]\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const isPlaceholder = !title
        || /^(seo title only|yourgeneratedtitle)$/i.test(title);
    if (isPlaceholder) title = `${keyword} Artwork`;
    return title.slice(0, 90).trim();
}

function ensureExactlyFifteenTags(tags, niche = '', title = '', mainTag = '') {
    const normalized = [];
    const seen = new Set();

    const pushTag = (value) => {
        const tag = String(value || '').trim().toLowerCase();
        if (!tag || tag.length < 2 || tag.length > 34 || seen.has(tag)) return;
        seen.add(tag);
        normalized.push(tag);
    };

    (Array.isArray(tags) ? tags : [])
        .map((tag) => String(tag || '').trim())
        .forEach(pushTag);

    const seed = `${niche} ${title} ${mainTag}`
        .split(/[\s,;|/\\\-_.]+/)
        .map((w) => String(w || '').trim().toLowerCase())
        .filter((w) => w.length > 2);
    seed.forEach(pushTag);

    [
        'graphic design',
        'creative style',
        'vintage aesthetic',
        'retro artwork',
        'trendy gift',
        'unique idea',
        'fan favorite',
        'minimal style',
        'bold statement',
        'classic vibe',
        'modern look',
        'cool artwork',
        'stylish design',
        'popular trend',
        'daily outfit'
    ].forEach(pushTag);

    return normalized.slice(0, 15);
}

function cleanImageTitleHint(name) {
    if (!name) return '';
    return String(name)
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractPrimaryKeywordFromFilename(filename) {
    const value = String(filename || '').trim();
    if (!value) return '';
    return value
        .replace(/\.[^.]+$/, '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s*[\(\[]\s*\d+\s*[\)\]]\s*$/g, '')
        .replace(/\s+\d+\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isGeminiRateLimitError(message) {
    const text = String(message || '').toLowerCase();
    return text.includes('resource exhausted')
        || text.includes('error-code-429')
        || text.includes('http 429')
        || text.includes('quota')
        || text.includes('rate limit')
        || text.includes('too many requests');
}

function isGeminiAuthOrKeyError(message) {
    const text = String(message || '').toLowerCase();
    return text.includes('api key')
        || text.includes('api_key')
        || text.includes('apikey')
        || text.includes('invalid key')
        || text.includes('key invalid')
        || text.includes('key is missing')
        || text.includes('permission denied')
        || text.includes('unauthenticated')
        || text.includes('not authorized')
        || text.includes('http 401')
        || text.includes('http 403')
        || text.includes('forbidden');
}

function parseGeminiSeoPayload(parsed, niche, isImageOnly, primaryKeyword, defaultSource = 'gemini-primary') {
    if (!parsed) return null;
    let data = parsed;

    if (data.result && typeof data.result === 'string') {
        const markerParsed = parseMarkedSeoResponse(data.result, niche, isImageOnly, data.source || defaultSource);
        if (markerParsed) return markerParsed;
        try {
            const innerJson = data.result.match(/\{[\s\S]*\}/);
            if (innerJson) data = JSON.parse(innerJson[0]);
        } catch (_) {}
    }

    if (!data.title && (data.result || typeof data === 'string')) {
        const rawText = data.result || data;
        const markerParsed = parseMarkedSeoResponse(rawText, niche, isImageOnly, data.source || defaultSource);
        if (markerParsed) return markerParsed;
        return null;
    }

    if (data && typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (data && Array.isArray(data.tags)) {
        const bannedKeywords = ['sock', 'sticker', 'poster', 'dress', 'shirt', 'hoodie', 'case', 'mug', 'print', 'art', 'laptop', 'wall', 'tote', 'pillow', 'mask', 'skin'];
        data.tags = data.tags
            .map((t) => t.trim())
            .filter((t) => t.length > 2)
            .filter((t) => !bannedKeywords.some((b) => t.toLowerCase().includes(b) && !niche.toLowerCase().includes(b)))
            .filter(Boolean);
    }
    if (data?.title && !data.main_tag) {
        data.main_tag = sanitizeMainTag(data.main_tag || data.title);
    }
    if (data && isPlaceholderSeoMeta({
        title: data.title || '',
        main_tag: data.main_tag || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        description: data.description || ''
    })) {
        return null;
    }
    if (data && !data.source) data.source = defaultSource;
    return data;
}

async function trySeoAiWindowFallback(prompt, base64, niche, isImageOnly, primaryKeyword, rotate = false) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return null;
    if (!(await isSeoAiWindowModeEnabled())) return null;

    if (typeof showToast !== 'undefined') {
        showToast('🪟 فشل مفتاح/API — جاري فتح نافذة Gemini أو ChatGPT...');
    }

    const webResponse = await callSeoWindowFallback(prompt, base64, rotate);
    if (!webResponse?.success || !webResponse?.data) {
        if (typeof showToast !== 'undefined' && webResponse?.error) {
            showToast(`⚠️ تعذّر فتح نافذة Gemini: ${webResponse.error}`);
        }
        return null;
    }

    const defaultSource = webResponse.data?.source || 'gemini-web';
    return parseGeminiSeoPayload(webResponse.data, niche, isImageOnly, primaryKeyword, defaultSource);
}

function getGeminiCooldownRemainingMs() {
    return Math.max(0, geminiRateLimitUntil - Date.now());
}

function activateGeminiCooldown() {
    geminiRateLimitUntil = Date.now() + GEMINI_RATE_LIMIT_COOLDOWN_MS;
}

function formatGeminiCooldownMessage() {
    const remainingMinutes = Math.max(1, Math.ceil(getGeminiCooldownRemainingMs() / 60000));
    return `⚠️ تم بلوغ حد Gemini مؤقتاً. سيتم التحويل إلى نوافذ SEO الاحتياطية إذا كانت مفعلة، أو المكتبة الاحتياطية. أعد المحاولة بعد ${remainingMinutes} دقيقة.`;
}

const NOTE_MANAGER_STORAGE_KEY = 'teepublic_manager_data';
const NOTE_NICHE_PROMPT_MAX = 100;

function normalizeForNicheMatch(value) {
    return cleanNicheName(String(value || '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeNicheMatch(value) {
    return normalizeForNicheMatch(value).split(/\s+/).filter((word) => word.length > 2);
}

function isGenericUnrelatedImageTitle(hint) {
    const raw = String(hint || '').trim();
    if (!raw || raw.length < 3) return true;
    const h = raw.toLowerCase();
    if (/^(?:img|image|photo|picture|design|artwork|chatgpt|dalle|midjourney|untitled|sans titre)[\s_\-\d.]*$/i.test(h)) return true;
    if (/\b(chatgpt|openai|gemini|copilot)\b/i.test(h) && /\b(image|photo|picture)\b/i.test(h)) return true;
    if (/\b\d{1,2}\s+(jan|feb|mar|avr|mai|jun|jul|aug|sep|oct|nov|dec)\b/i.test(h)) return true;
    if (/^\d{4}[-_./]\d{1,2}/.test(h)) return true;
    if (/^[\d\s\-_.()]+$/.test(h)) return true;
    const cleaned = normalizeForNicheMatch(raw);
    return !cleaned || cleaned.length < 3;
}

function findMatchingNoteNiche(imageTitleHint, noteNiches) {
    const hintNorm = normalizeForNicheMatch(imageTitleHint);
    if (!hintNorm || !Array.isArray(noteNiches) || !noteNiches.length) return null;

    for (const note of noteNiches) {
        const noteNorm = normalizeForNicheMatch(note);
        if (noteNorm && hintNorm === noteNorm) return note;
    }

    let best = null;
    let bestScore = 0;
    const hintTokens = tokenizeNicheMatch(imageTitleHint);

    for (const note of noteNiches) {
        const noteNorm = normalizeForNicheMatch(note);
        if (!noteNorm || noteNorm.length < 3) continue;

        if (hintNorm.includes(noteNorm) || noteNorm.includes(hintNorm)) {
            const score = noteNorm.length + 50;
            if (score > bestScore) {
                best = note;
                bestScore = score;
            }
            continue;
        }

        const noteTokens = tokenizeNicheMatch(note);
        let overlap = 0;
        for (const token of noteTokens) {
            if (hintTokens.includes(token)) overlap += 1;
        }
        const minOverlap = noteTokens.length <= 2 ? 1 : 2;
        if (overlap >= minOverlap) {
            const score = overlap * 12 + noteNorm.length;
            if (score > bestScore) {
                best = note;
                bestScore = score;
            }
        }
    }

    return best;
}

async function loadNoteNicheTextsForSeo() {
    return new Promise((resolve) => {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                resolve([]);
                return;
            }
            chrome.storage.local.get([NOTE_MANAGER_STORAGE_KEY], (res) => {
                const niches = res?.[NOTE_MANAGER_STORAGE_KEY]?.niches;
                if (!Array.isArray(niches)) {
                    resolve([]);
                    return;
                }
                const seen = new Set();
                const unique = [];
                for (const entry of niches) {
                    const text = String(entry?.text || '').trim();
                    const key = text.toLowerCase();
                    if (!text || seen.has(key)) continue;
                    seen.add(key);
                    unique.push(text);
                }
                resolve(unique.slice(0, NOTE_NICHE_PROMPT_MAX));
            });
        } catch (_) {
            resolve([]);
        }
    });
}

async function resolveSeoNicheContext(imageTitleHint = '', fallbackNiche = '') {
    const noteNiches = await loadNoteNicheTextsForSeo();
    const titleHint = cleanImageTitleHint(imageTitleHint) || extractPrimaryKeywordFromFilename(imageTitleHint);
    const fallbackClean = cleanNicheName(fallbackNiche || titleHint || 'Design');
    const matchedNoteNiche = findMatchingNoteNiche(titleHint, noteNiches);
    const titleLooksGeneric = isGenericUnrelatedImageTitle(titleHint);
    const titleMatchesNote = !!(matchedNoteNiche && !titleLooksGeneric);
    const effectiveNiche = titleMatchesNote ? matchedNoteNiche : fallbackClean;

    return {
        noteNiches,
        matchedNoteNiche,
        titleHint,
        titleLooksGeneric,
        titleMatchesNote,
        effectiveNiche
    };
}

function buildNoteNicheSeoGuidanceBlock(noteContext) {
    if (!noteContext?.noteNiches?.length) return '';

    const list = noteContext.noteNiches.map((name, index) => `${index + 1}. ${name}`).join('\n');
    const bindingLine = noteContext.titleMatchesNote && noteContext.matchedNoteNiche
        ? `Use this niche from the image title (it matches the Note list): "${noteContext.matchedNoteNiche}".`
        : (noteContext.titleLooksGeneric
            ? `The image file/title looks generic or unrelated ("${noteContext.titleHint || 'unknown'}"). Ignore the filename and analyze the attached image, then pick the single best niche from the Note list below.`
            : `The image title does not clearly match the Note list. Analyze the attached image first, then pick the single best niche from the Note list below (do not invent a random niche outside the list).`);

    return `

--- Additional image + Note-list binding (names only from Note tab, not long-form note bodies) ---
Note niche library:
${list}

Image binding rules:
- Build all SEO fields from visual analysis of the attached image.
- ${bindingLine}
- Every SEO field must reflect the chosen niche and what is visible in the artwork.
- Do not copy the file name literally unless it already matches a Note-list niche as instructed above.
`;
}

function buildStructuredSeoPrompt(niche, isImageOnly = false, hasImage = false, imageTitleHint = '', primaryKeyword = '', noteContext = null) {
    const cleanNiche = cleanNicheName(noteContext?.effectiveNiche || niche || 'Design');
    const cleanTitleHint = cleanImageTitleHint(imageTitleHint);
    const cleanPrimaryKeyword = extractPrimaryKeywordFromFilename(primaryKeyword) || cleanTitleHint || cleanNiche;
    const imageModeLine = isImageOnly
        ? 'Work from the attached image only.'
        : 'Use the attached image together with the niche/title hint below.';
    const noteGuidance = buildNoteNicheSeoGuidanceBlock(noteContext);

    return `Generate structured POD SEO from the attached input.

${imageModeLine}

Niche/title hint:
${cleanNiche}

Primary keyword (highest priority):
${cleanPrimaryKeyword}

Image title hint:
${cleanTitleHint || cleanNiche}
${noteGuidance}

Rules:
- English only
- Ignore duplicate trailing numbers
- Main tag max 38 characters
- Base the result on the actual image content
- Keep the same core concept across all fields
- Describe the visible artwork naturally
- Return exactly 15 comma-separated tags
- Do not add any text outside the exact marker format
- ${hasImage ? 'The image is attached.' : 'If no image is available, infer carefully from the niche only.'}
- Prioritize the primary keyword in title, main tag, and top tags naturally.
- Use the image title hint only as supporting context, not as literal keyword stuffing.

Fill these markers with real generated SEO (never leave placeholder words):
[SEO_TITLE][/SEO_TITLE]
[SEO_MAIN_TAG][/SEO_MAIN_TAG]
[SEO_TAGS][/SEO_TAGS]
[SEO_DESCRIPTION][/SEO_DESCRIPTION]`;
}

function buildGoogleAiSeoReviewPrompt(niche, meta = {}, primaryKeyword = '') {
    const tags = Array.isArray(meta.tags) ? meta.tags.join(', ') : String(meta.tags || '');
    return `Review and improve this POD SEO using the attached design image when available.

Niche:
${cleanNicheName(niche)}

Primary keyword:
${extractPrimaryKeywordFromFilename(primaryKeyword) || cleanNicheName(niche)}

Current SEO:
Title: ${String(meta.title || '').trim()}
Main tag: ${String(meta.main_tag || '').trim()}
Tags: ${tags}
Description: ${String(meta.description || '').trim()}

Rules:
- English only
- Keep the same visible design concept
- Improve clarity and buyer-friendly wording
- Return exactly 15 comma-separated tags
- Do not add product words like shirt, hoodie, mug, sticker, poster unless they are part of the design itself
- Do not include trademarked brand names unless visibly generic and safe
- Do not add any text outside the exact marker format

Fill these markers with improved real SEO only:
[SEO_TITLE][/SEO_TITLE]
[SEO_MAIN_TAG][/SEO_MAIN_TAG]
[SEO_TAGS][/SEO_TAGS]
[SEO_DESCRIPTION][/SEO_DESCRIPTION]`;
}

function isPlaceholderSeoMeta(meta) {
    if (!meta || typeof meta !== 'object') return true;
    const title = String(meta.title || '').trim().toLowerCase();
    const mainTag = String(meta.main_tag || '').trim().toLowerCase();
    const description = String(meta.description || '').trim().toLowerCase();
    if (title === 'seo title only' || title === 'yourgeneratedtitle') return true;
    if (mainTag === 'main tag only') return true;
    if (description === 'natural product description only') return true;
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const placeholderTags = tags.filter((tag) => /^tag\s*\d+$/i.test(String(tag || '').trim()));
    if (placeholderTags.length >= 5) return true;
    return false;
}

function buildSeoFallbackResult(niche, isImageOnly, payload = {}, fallbackReason = 'unknown') {
    return {
        ...payload,
        is_fallback: true,
        source: payload.source || 'fallback-library',
        fallback_reason: fallbackReason
    };
}

function extractMarkerValue(text, markerName) {
    const pattern = new RegExp(`\\[${markerName}\\]([\\s\\S]*?)\\[\\/${markerName}\\]`, 'i');
    const match = String(text || '').match(pattern);
    return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function extractMarkerValueOpen(text, markerName) {
    const closed = extractMarkerValue(text, markerName);
    if (closed) return closed;
    const pattern = new RegExp(
        `\\[${markerName}\\]\\s*([\\s\\S]*?)(?=\\[(?:\\/?SEO_[A-Z_]+|SEO_))`,
        'i'
    );
    const match = String(text || '').match(pattern);
    if (!match?.[1]) return '';
    return match[1]
        .replace(/\[\/?SEO_[A-Z_]+\]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanSeoFieldValue(raw, fieldKind = '') {
    let value = String(raw || '').trim();
    if (!value) return '';
    value = value
        .replace(/\[\/?SEO_[A-Z_]+\]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (/^(?:seo\s+)?title\s+only$/i.test(value)) return '';
    if (/^main\s+tag\s+only$/i.test(value)) return '';
    if (/^natural\s+product\s+description\s+only$/i.test(value)) return '';
    if (/^tag\s*\d+(\s*,\s*tag\s*\d+)*$/i.test(value)) return '';
    if (fieldKind === 'tags' && /^tags?\s*[:：-]/i.test(value)) {
        value = value.replace(/^tags?\s*[:：-]\s*/i, '').trim();
    }
    return value;
}

function extractLooseSeoField(rawText, fieldNames = []) {
    const text = String(rawText || '').replace(/\r/g, '\n').trim();
    if (!text) return '';

    for (const fieldName of fieldNames) {
        const escaped = String(fieldName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?(?:${escaped})\\s*[:：-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:[-*]\\s*)?(?:title|seo title|main tag|main_tag|tags|seo tags|description|seo description)\\s*[:：-]|$)`, 'i');
        const match = text.match(pattern);
        if (match?.[1]) return match[1].trim();
    }

    return '';
}

function cleanSeoDescriptionText(rawText, fallbackNiche = '') {
    let value = extractMarkerValue(rawText, 'SEO_DESCRIPTION')
        || extractLooseSeoField(rawText, ['SEO_DESCRIPTION', 'SEO Description', 'Description']);

    if (!value) value = String(rawText || '').trim();

    value = value
        .replace(/\[\/?SEO_(?:TITLE|MAIN_TAG|TAGS|DESCRIPTION)\]/gi, ' ')
        .split(/\n+/)
        .filter((line) => !/^\s*(?:[-*]\s*)?(?:title|seo title|main tag|main_tag|tags|seo tags)\s*[:：-]/i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (/^(?:description|seo description)\s*[:：-]/i.test(value)) {
        value = value.replace(/^(?:description|seo description)\s*[:：-]\s*/i, '').trim();
    }

    if (!value) value = `Exclusive ${cleanNicheName(fallbackNiche)} artwork for fans.`;
    return value.slice(0, 240).trim();
}

function parseMarkedSeoResponse(rawText, niche, isImageOnly = false, source = 'ai-web') {
    const text = String(rawText || '');
    if (!text.trim()) return null;

    const title = cleanSeoFieldValue(
        extractMarkerValueOpen(text, 'SEO_TITLE')
            || extractLooseSeoField(text, ['SEO_TITLE', 'SEO Title', 'Title']),
        'title'
    );
    const mainTagRaw = cleanSeoFieldValue(
        extractMarkerValueOpen(text, 'SEO_MAIN_TAG')
            || extractLooseSeoField(text, ['SEO_MAIN_TAG', 'SEO Main Tag', 'Main Tag', 'main_tag']),
        'main_tag'
    );
    const tagsRaw = cleanSeoFieldValue(
        extractMarkerValueOpen(text, 'SEO_TAGS')
            || extractLooseSeoField(text, ['SEO_TAGS', 'SEO Tags', 'Tags']),
        'tags'
    );
    const descriptionRaw = extractMarkerValueOpen(text, 'SEO_DESCRIPTION')
        || extractLooseSeoField(text, ['SEO_DESCRIPTION', 'SEO Description', 'Description']);
    const description = cleanSeoDescriptionText(descriptionRaw, niche);

    if (!title && !tagsRaw && !description) return null;
    if (!title) return null;

    const parsedTags = tagsRaw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 15);

    const draft = {
        title,
        main_tag: sanitizeMainTag(mainTagRaw || title),
        tags: parsedTags,
        description
    };
    if (isPlaceholderSeoMeta(draft)) return null;

    const resolvedTitle = sanitizeSeoTitle(title, niche);

    return {
        title: resolvedTitle,
        main_tag: sanitizeMainTag(mainTagRaw || resolvedTitle),
        tags: ensureExactlyFifteenTags(parsedTags, niche, resolvedTitle, mainTagRaw),
        description: description || cleanSeoDescriptionText('', niche),
        is_fallback: false,
        source
    };
}

function getSeoSourceMeta(source) {
    const normalized = String(source || '').toLowerCase();
    if (normalized.includes('cursor')) {
        return { label: 'Cursor API', accent: '#f472b6' };
    }
    if (normalized.includes('gpt') || normalized.includes('openai')) {
        return { label: 'NHP API', accent: '#10b981' };
    }
    if (normalized.includes('chatgpt')) {
        return { label: 'ChatGPT Fallback', accent: '#10b981' };
    }
    if (normalized.includes('google')) {
        return { label: 'Google AI', accent: '#38bdf8' };
    }
    if (normalized.includes('gemini')) {
        return { label: 'Gemini', accent: '#6c63ff' };
    }
    if (normalized.includes('local-library') || normalized.includes('fallback-library')) {
        return { label: 'مكتبة محلية', accent: '#f59e0b' };
    }
    if (normalized.includes('fallback')) {
        return { label: 'Fallback', accent: '#f59e0b' };
    }
    return { label: 'AI', accent: '#64748b' };
}

function ensureSeoSourceBadge() {
    let badge = document.getElementById('seo-source-badge');
    const host = document.getElementById('seo-source-badge-row');
    if (badge && host && badge.parentElement !== host) {
        host.appendChild(badge);
    }
    if (badge) return badge;
    if (!host) return null;

    badge = document.createElement('div');
    badge.id = 'seo-source-badge';
    badge.className = 'seo-source-badge';
    badge.textContent = 'AI';
    host.appendChild(badge);
    return badge;
}

function updateSeoSourceBadge(source) {
    const badge = ensureSeoSourceBadge();
    if (!badge) return;
    const meta = getSeoSourceMeta(source);
    badge.textContent = meta.label;
    badge.style.color = meta.accent;
    badge.style.borderColor = `${meta.accent}55`;
    badge.style.background = `${meta.accent}18`;
    badge.title = `SEO Source: ${meta.label}`;
}

// Helpers passed from popup.js
let showToast, switchTab, getDesignQueue, setDesignQueue, saveQueueToStorage, renderQueue, showDesignPreview, removeFromQueue;

async function closeGeminiSeoWindow(options = {}) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return { closed: false };
    const force = options.force === true;
    const keepOpenOnIncomplete = options.keepOpenOnIncomplete !== false;
    if (keepOpenOnIncomplete && !force) {
        return { closed: false, skipped: true };
    }
    return await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'close_gemini_web_window', force }, (res) => {
            resolve(res || { closed: false });
        });
    });
}

function getStoredBoolean(key, fallback = true) {
    return new Promise((resolve) => {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                resolve(fallback);
                return;
            }
            chrome.storage.local.get([key], (res) => {
                if (chrome.runtime?.lastError) {
                    resolve(fallback);
                    return;
                }
                resolve(res?.[key] === undefined ? fallback : res[key] !== false);
            });
        } catch (_) {
            resolve(fallback);
        }
    });
}

async function isSeoAiWindowModeEnabled() {
    return await getStoredBoolean(SEO_AI_WINDOW_MODE_STORAGE_KEY, true);
}

function refreshSeoAiWindowModeButton(enabled) {
    const toggle = document.getElementById('seo-ai-window-mode-toggle');
    const note = document.getElementById('seo-ai-window-mode-note');
    if (toggle && toggle.type === 'checkbox') {
        toggle.checked = enabled !== false;
    }
    if (note) {
        note.textContent = enabled
            ? 'الافتراضي: المفتاح/API أولاً. عند الفشل يُفتح Gem أو ChatGPT تلقائياً (ما عدا وضع Gemini Web).'
            : 'لن تُفتح نوافذ احتياطية — يُستخدم المفتاح/API المختار فقط.';
    }
}

function normalizeSeoWindowPool(pool) {
    const seen = new Set();
    return (Array.isArray(pool) ? pool : [])
        .map((url) => String(url || '').trim())
        .filter((url) => /^https:\/\/(gemini\.google\.com|chatgpt\.com)\//i.test(url))
        .filter((url) => {
            const key = url.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

async function getSeoWindowPool() {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get([SEO_AI_WINDOW_POOL_STORAGE_KEY], (res) => {
                const pool = normalizeSeoWindowPool(res?.[SEO_AI_WINDOW_POOL_STORAGE_KEY]);
                resolve(pool.length ? pool : SEO_DEFAULT_WINDOW_POOL.slice());
            });
        } catch (_) {
            resolve(SEO_DEFAULT_WINDOW_POOL.slice());
        }
    });
}

async function setSeoWindowPool(pool) {
    const normalized = normalizeSeoWindowPool(pool);
    await chrome.storage.local.set({ [SEO_AI_WINDOW_POOL_STORAGE_KEY]: normalized });
    return normalized;
}

async function getNextSeoWindowPair(markCurrentFailed = false) {
    const pool = await getSeoWindowPool();
    const data = await new Promise((resolve) => {
        chrome.storage.local.get([SEO_AI_WINDOW_POOL_INDEX_STORAGE_KEY], (res) => resolve(res || {}));
    });
    let index = Number(data?.[SEO_AI_WINDOW_POOL_INDEX_STORAGE_KEY] || 0);
    if (markCurrentFailed) index += 1;
    const primaryIndex = ((index % pool.length) + pool.length) % pool.length;
    const fallbackIndex = ((primaryIndex + 1) % pool.length);
    await chrome.storage.local.set({ [SEO_AI_WINDOW_POOL_INDEX_STORAGE_KEY]: primaryIndex });
    return {
        primaryUrl: pool[primaryIndex],
        fallbackUrl: pool[fallbackIndex] || pool[primaryIndex],
        pool,
        index: primaryIndex
    };
}

function sendGeminiWebBridgeMessage(payload) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(payload, (res) => {
                if (chrome.runtime?.lastError) {
                    resolve({
                        success: false,
                        error: chrome.runtime.lastError.message || 'Extension background is unavailable.'
                    });
                    return;
                }
                resolve(res || { success: false, error: 'Empty response from background.' });
            });
        } catch (err) {
            resolve({ success: false, error: err?.message || 'Failed to reach extension background.' });
        }
    });
}

async function callSeoWindowFallback(prompt, base64, rotate = false) {
    const { primaryUrl, fallbackUrl } = await getNextSeoWindowPair(rotate);
    const firstResponse = await sendGeminiWebBridgeMessage({
        action: 'call_gemini_web',
        prompt,
        base64,
        mimeType: 'image/png',
        taskMode: 'text',
        url: primaryUrl,
        fallbackUrl
    });
    if (firstResponse?.success) return firstResponse;

    const retryPair = await getNextSeoWindowPair(true);
    return await sendGeminiWebBridgeMessage({
        action: 'call_gemini_web',
        prompt,
        base64,
        mimeType: 'image/png',
        taskMode: 'text',
        url: retryPair.primaryUrl,
        fallbackUrl: retryPair.fallbackUrl
    });
}

async function callGeminiWebBatch(items, rotate = false) {
    const { primaryUrl, fallbackUrl } = await getNextSeoWindowPair(rotate);
    const pool = await getSeoWindowPool();
    const gemFromPool = pool.find((url) => /^https:\/\/gemini\.google\.com\/gem\//i.test(String(url || '')));
    const batchGemUrl = gemFromPool || SEO_DEFAULT_WINDOW_POOL[0];
    const resolvedPrimary = /^https:\/\/gemini\.google\.com\/gem\//i.test(String(primaryUrl || ''))
        ? primaryUrl
        : batchGemUrl;
    return await sendGeminiWebBridgeMessage({
        action: 'call_gemini_web_batch',
        items: Array.isArray(items) ? items : [],
        mimeType: 'image/png',
        taskMode: 'text',
        url: resolvedPrimary,
        fallbackUrl
    });
}

function metaFromWindowResponseText(rawText, niche, isImageOnly = false, source = 'gemini-web') {
    const text = String(rawText || '').trim();
    if (!text) return null;
    const markerParsed = parseMarkedSeoResponse(text, niche, isImageOnly, source);
    if (markerParsed) return markerParsed;
    const payloadParsed = parseGeminiSeoPayload({ result: text }, niche, isImageOnly, '', source);
    return payloadParsed?.title ? payloadParsed : null;
}

async function postProcessSeoMeta(finalMeta, niche, isImageOnly = false, primaryKeyword = '', providerOverride = null) {
    if (!finalMeta) return null;
    const resolvedPrimaryKeyword = extractPrimaryKeywordFromFilename(primaryKeyword) || cleanNicheName(niche);
    const tagsToVerify = [...(finalMeta.tags || [])].slice(0, 20);
    const forceNiche = document.getElementById('seo-force-niche')?.checked !== false;
    const bypassTmh = await shouldBypassTmhVerification(providerOverride);

    const finalizeMeta = (safeTags) => {
        let mergedTags = [...new Set(safeTags || [])];
        if (forceNiche) {
            const cleanNicheValue = niche.toLowerCase().trim();
            mergedTags = [cleanNicheValue, ...mergedTags.filter((tag) => tag !== cleanNicheValue)];
        }
        finalMeta.tags = ensureExactlyFifteenTags(
            mergedTags,
            niche,
            finalMeta.title || '',
            finalMeta.main_tag || ''
        );
        if (resolvedPrimaryKeyword) {
            const normalizedPrimary = resolvedPrimaryKeyword.toLowerCase();
            finalMeta.tags = [
                normalizedPrimary,
                ...finalMeta.tags.filter((tag) => String(tag || '').toLowerCase() !== normalizedPrimary)
            ].slice(0, 15);
        }
        finalMeta.score = (finalMeta.tags.length > 10) ? '100' : '85';
        if (forceNiche && !String(finalMeta.main_tag || '').trim()) {
            finalMeta.main_tag = (resolvedPrimaryKeyword || niche).toLowerCase();
        }
        finalMeta.primary_keyword = resolvedPrimaryKeyword;
        if (finalMeta.title) {
            finalMeta.title = sanitizeSeoTitle(finalMeta.title, resolvedPrimaryKeyword || niche);
        }
        if (!finalMeta.description) finalMeta.description = `Exclusive ${niche} artwork for fans.`;
        return finalMeta;
    };

    if (bypassTmh) return finalizeMeta(tagsToVerify);

    return await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'TMH_VERIFY_TAGS', tags: tagsToVerify }, (tmhRes) => {
            const finalSafeTags = (tmhRes && tmhRes.success) ? tmhRes.safeTags : tagsToVerify;
            resolve(finalizeMeta(finalSafeTags));
        });
    });
}

async function performBatchSEOViaSharedWebWindow(queue, isImageOnly = false, seoBatchUI = null) {
    const pending = queue.filter((item) => item.status !== 'done');
    if (!pending.length) {
        return {
            successCount: queue.filter((item) => item.status === 'done').length,
            failCount: 0
        };
    }

    try {
        await chrome.storage.local.set({ seoGeminiChatRefreshEvery: 1 });
    } catch (_) {
    }

    if (typeof showToast !== 'undefined') {
        const lowSpecNote = isLowSpecModeEnabled()
            ? ' — وضع الحاسوب الضعيف: انتظار أطول بين التصاميم'
            : '';
        showToast(`🪟 توليد SEO لـ ${pending.length} تصميم — نافذة واحدة، محادثة Gem جديدة لكل تصميم${lowSpecNote}`);
    }

    const batchPayload = [];
    for (const item of pending) {
        const rawName = (item.file && item.file.name) ? item.file.name : (item.name || '');
        const primaryKeyword = extractPrimaryKeywordFromFilename(rawName);
        const niche = cleanNicheName(rawName);
        const noteContext = await resolveSeoNicheContext(rawName, niche);
        const effectiveNiche = noteContext.effectiveNiche || niche;
        const itemBase64 = item.base64 || await window.NHPDatabase.getImage(item.id);
        const aiBase64 = itemBase64
            ? await createThumbnail(itemBase64, isLowSpecModeEnabled() ? 640 : 800)
            : null;
        const prompt = buildStructuredSeoPrompt(effectiveNiche, isImageOnly, !!aiBase64, rawName, primaryKeyword, noteContext);
        batchPayload.push({
            id: item.id,
            prompt,
            base64: aiBase64,
            niche: effectiveNiche,
            isImageOnly,
            primaryKeyword,
            noteContext,
            itemRef: item
        });
    }

    pending.forEach((item) => {
        item.status = 'loading';
    });
    renderQueue();

    const batchItemMap = new Map(batchPayload.map((entry) => [String(entry.id), entry]));
    const applyBatchItemResult = async (row, provider) => {
        if (!row) return false;
        const entry = batchItemMap.get(String(row.id)) || batchPayload[Number(row.index)];
        if (!entry?.itemRef) return false;
        const item = entry.itemRef;
        try {
            if (!row.success || !row.text) {
                throw new Error(row.error || 'Window SEO returned empty text.');
            }
            let meta = metaFromWindowResponseText(row.text, entry.niche, entry.isImageOnly, provider);
            if (!meta || isPlaceholderSeoMeta(meta)) {
                throw new Error('Gemini returned prompt placeholders — not real SEO yet.');
            }
            meta = await postProcessSeoMeta(meta, entry.niche, entry.isImageOnly, entry.primaryKeyword);
            if (!meta) throw new Error('SEO post-processing failed.');
            item.meta = mergeSeoMetaForItem(item, meta);
            item.status = 'done';
            const currentActiveId = S.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id');
            if (currentActiveId === item.id) updatePreviewFields(meta);
            renderQueue();
            saveQueueToStorage(true);
            return true;
        } catch (error) {
            console.error('Shared window SEO item failed:', entry.id, error);
            item.status = 'error';
            renderQueue();
            saveQueueToStorage(true);
            return false;
        }
    };

    const onBatchItemDone = (message) => {
        if (message?.action !== 'GEMINI_WEB_BATCH_ITEM_DONE' || !message?.item) return;
        void applyBatchItemResult(message.item, message.provider || 'gemini-web');
    };
    chrome.runtime.onMessage.addListener(onBatchItemDone);

    let batchResponse;
    try {
        batchResponse = await callGeminiWebBatch(
            batchPayload.map((entry) => ({
                id: entry.id,
                prompt: entry.prompt,
                base64: entry.base64
            }))
        );
    } finally {
        chrome.runtime.onMessage.removeListener(onBatchItemDone);
    }

    if (!batchResponse?.success) {
        pending.forEach((item) => {
            item.status = 'error';
        });
        renderQueue();
        if (typeof showToast !== 'undefined') {
            showToast(`❌ فشل توليد SEO عبر النافذة: ${batchResponse?.error || 'unknown error'}`);
        }
        return { successCount: 0, failCount: pending.length };
    }

    const provider = batchResponse.data?.provider || 'gemini-web';
    const results = Array.isArray(batchResponse.data?.results) ? batchResponse.data.results : [];
    const resultById = new Map(results.map((row) => [String(row.id), row]));

    let successCount = 0;
    let failCount = 0;
    let missingCount = 0;

    for (let index = 0; index < batchPayload.length; index++) {
        const entry = batchPayload[index];
        const row = resultById.get(String(entry.id)) || results.find((candidate) => Number(candidate.index) === index);
        if (entry.itemRef?.status === 'done') {
            successCount++;
        } else if (entry.itemRef?.status === 'error') {
            failCount++;
        } else if (!row) {
            entry.itemRef.status = 'error';
            missingCount++;
            failCount++;
            renderQueue();
            saveQueueToStorage(true);
        } else if (await applyBatchItemResult(row, provider)) {
            successCount++;
        } else {
            failCount++;
        }

        if (seoBatchUI?.fill) {
            const progressPercent = Math.min(((index + 1) / batchPayload.length) * 100, 100);
            seoBatchUI.fill.style.width = `${progressPercent}%`;
            if (seoBatchUI.status) seoBatchUI.status.textContent = `${index + 1} / ${batchPayload.length}`;
        }
    }

    return { successCount, failCount, missingCount, expectedCount: batchPayload.length };
}

async function isGoogleAiSeoReviewEnabled() {
    return await getStoredBoolean(SEO_GOOGLE_AI_REVIEW_STORAGE_KEY, false);
}

async function callGoogleAiSeoReview(niche, meta, base64 = null, primaryKeyword = '') {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return null;
    const prompt = buildGoogleAiSeoReviewPrompt(niche, meta, primaryKeyword);
    const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'call_gemini_web',
            prompt,
            base64,
            mimeType: 'image/png',
            taskMode: 'text',
            url: GOOGLE_AI_MODE_URL,
            fallbackUrl: GOOGLE_AI_MODE_URL
        }, (res) => resolve(res));
    });
    if (!response?.success || !response?.data) return null;
    const rawText = response.data?.result || response.data?.text || response.data;
    const parsed = parseMarkedSeoResponse(rawText, niche, false, 'google-ai-review');
    if (!parsed) return null;
    return {
        ...meta,
        ...parsed,
        source: 'google-ai-review',
        google_ai_reviewed: true
    };
}

function seoEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function renderSeoWindowPoolList() {
    const list = document.getElementById('seo-window-pool-list');
    if (!list) return;
    const pool = await getSeoWindowPool();
    list.innerHTML = pool.map((url, index) => `
        <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:7px; padding:6px;">
            <span style="font-size:10px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${index + 1}. ${seoEscapeHtml(url)}</span>
            <button type="button" data-seo-window-remove="${index}" aria-label="حذف نافذة SEO ${index + 1}" style="border:none; background:rgba(239,68,68,0.14); color:#fca5a5; border-radius:5px; padding:3px 6px; cursor:pointer; font-size:10px;">حذف</button>
        </div>
    `).join('');
    list.querySelectorAll('[data-seo-window-remove]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const removeIndex = Number(btn.getAttribute('data-seo-window-remove'));
            const nextPool = (await getSeoWindowPool()).filter((_url, index) => index !== removeIndex);
            await setSeoWindowPool(nextPool.length ? nextPool : SEO_DEFAULT_WINDOW_POOL.slice());
            await renderSeoWindowPoolList();
            showToast('🪟 تم تحديث مخزن نوافذ SEO');
        });
    });
}

/**
 * Initialize SEO Module
 */
export function initSeoModule(helpers) {
    if (seoModuleInitialized) return;
    seoModuleInitialized = true;

    showToast = helpers.showToast;
    switchTab = helpers.switchTab;
    getDesignQueue = helpers.getDesignQueue;
    setDesignQueue = helpers.setDesignQueue;
    saveQueueToStorage = helpers.saveQueueToStorage;
    renderQueue = helpers.renderQueue;
    showDesignPreview = helpers.showDesignPreview;
    removeFromQueue = helpers.removeFromQueue;
    const recoverDesignQueueFromIndexedDB = helpers.recoverDesignQueueFromIndexedDB;

    ensureSeoCliProxyRetryStatusListener();

    // Cross-module Bridge
    window.NHP_SEO_Update = updatePreviewFields;

    // Cross-section nav: SEO → Autopilot
    const gotoAutopilotBtn = document.getElementById('seo-goto-autopilot');
    if (gotoAutopilotBtn && !gotoAutopilotBtn.dataset.navBound) {
        gotoAutopilotBtn.dataset.navBound = 'true';
        gotoAutopilotBtn.addEventListener('click', () => {
            if (typeof switchTab === 'function') switchTab('autopilot');
        });
    }

    console.log('🧠 SEO Module: Initializing (with safety delay)...');

    setTimeout(() => {
        // Initialize Selectors
        S = {
            nicheSelect: document.getElementById('seo-niche-select'),
            imageInput: document.getElementById('seo-image-upload'),
            uploadTrigger: document.getElementById('seo-upload-trigger'),
            genBtn: document.getElementById('seo-genBtn'),
            titleEl: document.getElementById('seo-title'),
            tagsEl: document.getElementById('seo-tags'),
            descEl: document.getElementById('seo-desc'),
            tpBtn: document.getElementById('seo-teepublicBtn'),
            loading: document.getElementById('seo-loading'),
            scoreEl: document.getElementById('seo-score'),
            tagsCountEl: document.getElementById('seo-tags-count'),
            riskEl: document.getElementById('seo-risk'),
            alertEl: document.getElementById('seo-alert'),
            copyTitle: document.getElementById('seo-copy-title'),
            copyMainTag: document.getElementById('seo-copy-main-tag'),
            copyTags: document.getElementById('seo-copy-tags'),
            copyDesc: document.getElementById('seo-copy-desc'),
            mainTagEl: document.getElementById('seo-main-tag'),
            previewWrap: document.getElementById('seo-preview-wrap'),
            previewImg: document.getElementById('seo-img-preview'),
            previewFilename: document.getElementById('seo-current-filename'),
            queueList: document.getElementById('seo-queue'),
            queueContainer: document.getElementById('seo-queue-container'),
            cloudSyncToggleBtn: document.getElementById('seo-cloud-sync-toggle'),
            stopBtn: document.getElementById('seo-stop-btn'),
            aiAuditBtn: document.getElementById('seo-ai-audit'),
            aestheticReport: document.getElementById('seo-aesthetic-report'),
            aestheticText: document.getElementById('seo-aesthetic-text')
        };

        AP_SEO = {
            imageInput: document.getElementById('ap-image-upload'),
            uploadTrigger: document.getElementById('ap-upload-trigger'),
            queueList: document.getElementById('ap-queue'),
            queueCount: document.getElementById('ap-queue-count'),
            queueContainer: document.getElementById('ap-queue-container'),
            previewPanel: document.getElementById('ap-seo-preview'),
            previewImg: document.getElementById('ap-img-preview'),
            previewFilename: document.getElementById('ap-current-filename'),
            title: document.getElementById('ap-seo-title'),
            mainTag: document.getElementById('ap-seo-main-tag'),
            tags: document.getElementById('ap-seo-tags'),
            desc: document.getElementById('ap-seo-desc'),
            applyAll: document.getElementById('ap-seo-apply-all'),
            applyNicheOnly: document.getElementById('ap-seo-apply-niche-only'),
            genBtn: document.getElementById('ap-seo-gen-btn'),
            nicheManual: document.getElementById('ap-seo-niche-manual'),
            copyTitle: document.getElementById('ap-seo-copy-title'),
            copyMainTag: document.getElementById('ap-seo-copy-main-tag'),
            copyTags: document.getElementById('ap-seo-copy-tags'),
            copyDesc: document.getElementById('ap-seo-copy-desc')
        };

        const refreshSeoCloudSyncButton = (enabled) => {
            if (!S.cloudSyncToggleBtn) return;
            S.cloudSyncToggleBtn.textContent = enabled ? 'تعطيل السحابة' : 'تفعيل السحابة';
            S.cloudSyncToggleBtn.title = enabled
                ? 'إيقاف المزامنة السحابية العامة'
                : 'تفعيل المزامنة السحابية العامة';
            S.cloudSyncToggleBtn.style.background = enabled
                ? 'rgba(239, 68, 68, 0.14)'
                : 'rgba(16, 185, 129, 0.14)';
            S.cloudSyncToggleBtn.style.color = enabled ? '#fecaca' : '#bbf7d0';
            S.cloudSyncToggleBtn.style.borderColor = enabled
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(16, 185, 129, 0.25)';
        };

        if (S.cloudSyncToggleBtn && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['cloudSyncEnabled'], (res) => {
                refreshSeoCloudSyncButton(res.cloudSyncEnabled !== false);
            });

            S.cloudSyncToggleBtn.addEventListener('click', () => {
                chrome.storage.local.get(['cloudSyncEnabled'], (res) => {
                    const nextEnabled = res.cloudSyncEnabled === false;
                    chrome.storage.local.set({ cloudSyncEnabled: nextEnabled }, () => {
                        refreshSeoCloudSyncButton(nextEnabled);
                        showToast(nextEnabled
                            ? '✅ تم تفعيل المزامنة السحابية العامة'
                            : '⏸ تم إيقاف المزامنة السحابية العامة');
                    });
                });
            });
        }

        // Keep SEO option checkboxes in one compact row.
        if (S.genBtn && !document.getElementById('seo-image-only-wrap')) {
            const wrap = document.createElement('div');
            wrap.id = 'seo-image-only-wrap';
            wrap.style.cssText = 'display:inline-flex; align-items:center; gap:4px; margin:0;';
            wrap.innerHTML = `
                <input type="checkbox" id="seo-image-only" class="modern-checkbox" style="width:14px; height:14px; cursor:pointer; accent-color: var(--primary);">
                <label for="seo-image-only" style="font-size:11px; color:var(--text); cursor:pointer; font-weight:600;">SEO من الصورة</label>
            `;
            const optionsRow = document.getElementById('seo-option-row');
            if (optionsRow) optionsRow.appendChild(wrap);
            else S.genBtn.parentNode.insertBefore(wrap, S.genBtn);
            S.imageOnlyToggle = document.getElementById('seo-image-only');
        }

        if (S.genBtn && !document.getElementById('seo-tmh-bypass-wrap')) {
            const bypassWrap = document.createElement('div');
            bypassWrap.id = 'seo-tmh-bypass-wrap';
            bypassWrap.style.cssText = 'display:inline-flex; align-items:center; gap:4px; margin:0;';
            bypassWrap.innerHTML = `
                <input type="checkbox" id="seo-bypass-tmh" class="modern-checkbox" style="width:14px; height:14px; cursor:pointer; accent-color: #ef4444;" checked>
                <label for="seo-bypass-tmh" style="font-size:11px; color:var(--text); cursor:pointer; font-weight:600;">تخطي TMHunt</label>
            `;
            const optionsRow = document.getElementById('seo-option-row');
            if (optionsRow) optionsRow.appendChild(bypassWrap);
            else S.genBtn.parentNode.insertBefore(bypassWrap, S.genBtn);
        }

        if (S.genBtn && !document.getElementById('seo-google-ai-review-wrap')) {
            const googleAiWrap = document.createElement('div');
            googleAiWrap.id = 'seo-google-ai-review-wrap';
            googleAiWrap.style.cssText = 'display:inline-flex; align-items:center; gap:4px; margin:0;';
            googleAiWrap.innerHTML = `
                <input type="checkbox" id="seo-google-ai-review" class="modern-checkbox" style="width:14px; height:14px; cursor:pointer; accent-color: #38bdf8;">
                <label for="seo-google-ai-review" style="font-size:11px; color:var(--text); cursor:pointer; font-weight:600;">Google AI Review</label>
            `;
            const optionsRow = document.getElementById('seo-option-row');
            if (optionsRow) optionsRow.appendChild(googleAiWrap);
            else S.genBtn.parentNode.insertBefore(googleAiWrap, S.genBtn);
            const googleAiToggle = document.getElementById('seo-google-ai-review');
            isGoogleAiSeoReviewEnabled().then((enabled) => {
                if (googleAiToggle) googleAiToggle.checked = !!enabled;
            });
            googleAiToggle?.addEventListener('change', () => {
                chrome.storage.local.set({ [SEO_GOOGLE_AI_REVIEW_STORAGE_KEY]: googleAiToggle.checked !== false });
                showToast(googleAiToggle.checked ? 'تم تفعيل Google AI Review' : 'تم إيقاف Google AI Review');
            });
        }

        if (S.tpBtn && !document.getElementById('seo-gen-and-upload-btn')) {
            const genUploadBtn = document.createElement('button');
            genUploadBtn.id = 'seo-gen-and-upload-btn';
            genUploadBtn.className = S.tpBtn.className || '';
            genUploadBtn.style.cssText = 'height:30px; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:0 12px; background:#0ea5e9; color:white; border:1px solid rgba(148,163,184,0.15); border-radius:6px; font-size:12px; cursor:pointer; box-shadow:none;';
            genUploadBtn.innerHTML = 'توليد SEO';
            const actionRow = document.getElementById('seo-action-row');
            if (actionRow) actionRow.insertBefore(genUploadBtn, S.tpBtn);
            else S.tpBtn.parentNode.insertBefore(genUploadBtn, S.tpBtn);
            S.genAndUploadBtn = genUploadBtn;
        }

        if (ENABLE_LEGACY_AUTOPILOT_SEO_INJECTIONS && AP_SEO.genBtn && !document.getElementById('ap-image-only-wrap')) {
            const apWrap = document.createElement('div');
            apWrap.id = 'ap-image-only-wrap';
            apWrap.style.cssText = 'margin-bottom: 10px; display: flex; align-items: center; gap: 8px; justify-content: center; background: rgba(108, 99, 255, 0.1); padding: 8px; border-radius: 8px; border: 1px solid rgba(108, 99, 255, 0.3);';
            apWrap.innerHTML = `
                <input type="checkbox" id="ap-image-only" class="modern-checkbox" style="width:16px; height:16px; cursor:pointer; accent-color: var(--primary);">
                <label for="ap-image-only" style="font-size:11px; color:var(--text); cursor:pointer; font-weight: bold;">👁️ توليد من الصورة فقط (تجاهل الاسم)</label>
            `;
            AP_SEO.genBtn.parentNode.insertBefore(apWrap, AP_SEO.genBtn);
            AP_SEO.imageOnlyToggle = document.getElementById('ap-image-only');
        }
        
        if (ENABLE_LEGACY_AUTOPILOT_SEO_INJECTIONS && AP_SEO.genBtn && !document.getElementById('ap-tmh-bypass-wrap')) {
            const apBypassWrap = document.createElement('div');
            apBypassWrap.id = 'ap-tmh-bypass-wrap';
            apBypassWrap.style.cssText = 'margin-bottom: 10px; display: flex; align-items: center; gap: 8px; justify-content: center; background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);';
            apBypassWrap.innerHTML = `
                <input type="checkbox" id="ap-bypass-tmh" class="modern-checkbox" style="width:16px; height:16px; cursor:pointer; accent-color: #ef4444;" checked>
                <label for="ap-bypass-tmh" style="font-size:11px; color:var(--text); cursor:pointer; font-weight: bold;">⚡ تخطي فحص TMHunt</label>
            `;
            AP_SEO.genBtn.parentNode.insertBefore(apBypassWrap, AP_SEO.genBtn);
        }
        
        if (ENABLE_LEGACY_AUTOPILOT_SEO_INJECTIONS && AP_SEO.genBtn && !document.getElementById('ap-gen-and-upload-btn')) {
            const apGenUploadBtn = document.createElement('button');
            apGenUploadBtn.id = 'ap-gen-and-upload-btn';
            apGenUploadBtn.className = AP_SEO.genBtn.className || '';
            apGenUploadBtn.style.cssText = 'margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px; background: linear-gradient(135deg, #059669, #10b981); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;';
            apGenUploadBtn.innerHTML = '⚡ توليد السيو والرفع (Autopilot)';
            AP_SEO.genBtn.parentNode.insertBefore(apGenUploadBtn, AP_SEO.genBtn.nextSibling);
            AP_SEO.genAndUploadBtn = apGenUploadBtn;
        }

        if (S.genBtn) {
            console.log('🧠 SEO Module: Selectors linked successfully.');
        } else {
            console.error('❌ SEO Module: genBtn NOT FOUND in DOM during delayed init!');
        }

        setupEventListeners();
        initSeoApiKeysPanel();
        initSeoProviderPanel();
        restoreSeoFields();
        migrateLegacySeoGeminiKey().catch(() => {});
        
        // Touch the shared queue once so the module initializes against the latest popup state.
        if (getDesignQueue) getDesignQueue();

        // Global Aesthetic Auditor Logic
        if (S.aiAuditBtn) {
            S.aiAuditBtn.addEventListener('click', async () => {
                const meta = {
                    title: S.titleEl.value,
                    tags: S.tagsEl.value,
                    description: S.descEl.value,
                    niche: S.nicheSelect.value
                };
                if (!meta.title) return showToast('⚠️ يرجى توليد SEO أولاً لتحليله جمالياً');

                S.aiAuditBtn.disabled = true;
                S.aestheticReport.classList.remove('hidden');
                S.aestheticText.innerHTML = "⏳ جاري تحليل العبق الفني ومدى الجاذبية للسوق...";

                try {
                    if (window.AICentralBrain) {
                        const report = await window.AICentralBrain.auditDesign(meta);
                        if (report) {
                            S.aestheticText.textContent = report;
                            showToast('🎨 تم الانتهاء من التدقيق الجمالي!');
                        }
                    }
                } catch (err) {
                    S.aestheticText.textContent = "❌ خطأ في الاتصال بالمدقق الفني.";
                } finally {
                    S.aiAuditBtn.disabled = false;
                }
            });
        }
    }, 100);

    window.NHP_DEBUG_SEO = () => {
        console.log('--- NHP SEO DEBUG ---');
        console.log('S Object Target IDs:', S);
        console.log('Queue Length:', getDesignQueue?.().length);
        return "Check Console";
    };

    window.NHP_activateSeoPanel = function activateSeoPanel() {
        if (typeof renderQueue === 'function') renderQueue();
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        chrome.storage.local.get(['uSafe', 'tpExcel', 'tpMed'], (d) => {
            const fromTp = [...(d.tpExcel || []), ...(d.tpMed || [])];
            if (Array.isArray(d.uSafe) && d.uSafe.length) updateSeoNicheDropdown(d.uSafe);
            else if (fromTp.length) updateSeoNicheDropdown(fromTp);
        });
    };
}

/**
 * Event Listeners for SEO Panel
 */
function setupEventListeners() {
    if (seoEventListenersBound) return;
    seoEventListenersBound = true;

    const getActiveAutopilotQueueItem = () => {
        const queue = getDesignQueue();
        if (!queue.length) return null;
        const activeId = AP_SEO.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id') || queue[0]?.id;
        return queue.find((item) => item.id === activeId) || queue[0] || null;
    };

    const getColorNameArabic = (color) => ({
        Black: 'أسود',
        White: 'أبيض',
        Navy: 'كحلي',
        Red: 'أحمر'
    }[color] || color);

    const pickAutopilotDefaultColor = async () => {
        const item = getActiveAutopilotQueueItem();
        if (!item) {
            showToast('⚠️ أضف تصميماً واحداً على الأقل أولاً.');
            return;
        }

        const rawBase64 = item.base64 || await window.NHPDatabase.getImage(item.id);
        if (!rawBase64) {
            showToast('⚠️ تعذر قراءة صورة التصميم الحالي.');
            return;
        }

        const imageSrc = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
        const recommendedColor = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let brightnessSum = 0;
                let visiblePixels = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha < 10) continue;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    brightnessSum += 0.299 * r + 0.587 * g + 0.114 * b;
                    visiblePixels++;
                }

                if (!visiblePixels) {
                    resolve('Black');
                    return;
                }

                const avgBrightness = brightnessSum / visiblePixels;
                if (avgBrightness >= 170) resolve('Black');
                else if (avgBrightness <= 85) resolve('White');
                else resolve('Navy');
            };
            img.onerror = () => resolve('Black');
            img.src = imageSrc;
        });

        const radio = document.querySelector(`input[name="ap-default-color"][value="${recommendedColor}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        showToast(`🎨 تم اقتراح اللون الافتراضي: ${getColorNameArabic(recommendedColor)}`);
    };

    // Import Buttons
    document.getElementById('seo-import-uspto')?.addEventListener('click', () => {
        chrome.storage.local.get('uSafe', d => updateSeoNicheDropdown(d.uSafe));
    });
    document.getElementById('seo-import-tp')?.addEventListener('click', () => {
        chrome.storage.local.get(['tpExcel', 'tpMed'], d => {
            const niches = [...(d.tpExcel || []), ...(d.tpMed || [])];
            if (niches.length > 0) {
                updateSeoNicheDropdown(niches);
                showToast(`✅ تم استيراد ${niches.length} نيتش ناجح`);
            } else {
                showToast('⚠️ لا توجد نتائج TeePublic جاهزة للاستيراد');
            }
        });
    });

    // Queue Management
    S.uploadTrigger?.addEventListener('click', () => S.imageInput.click());
    S.imageInput?.addEventListener('change', (e) => {
        const picked = Array.from(e.target.files || []);
        if (picked[0]) {
            console.log('[NHP-IMG] picked', picked[0].name, picked[0].type || 'unknown', `${Math.round((picked[0].size || 0) / 1024)}KB`);
        }
        handleBulkUpload(Array.from(e.target.files));
        e.target.value = '';
    });

    if (S.queueList) {
        S.queueList.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.queue-item');
            const removeBtn = e.target.closest('.remove-btn');
            if (removeBtn) {
                e.stopPropagation();
                const removeId = removeBtn.getAttribute('data-remove-id');
                window.NHPDatabase.deleteImage(removeId); // حذف من IndexedDB
                removeFromQueue(removeId);
                return;
            }
            if (itemEl) {
                const id = itemEl.getAttribute('data-id');
                S.queueList.querySelectorAll('.queue-item').forEach(el => el.classList.remove('active'));
                itemEl.classList.add('active');
                showDesignPreview(id);
                const item = getDesignQueue().find(i => i.id === id);
                updatePreviewFields(item ? item.meta : null);
            }
        });
    }

    const recoverQueueBtn = document.getElementById('seo-recover-queue');
    if (recoverQueueBtn && !recoverQueueBtn.dataset.bound) {
        recoverQueueBtn.dataset.bound = 'true';
        recoverQueueBtn.addEventListener('click', async () => {
            if (typeof recoverDesignQueueFromIndexedDB !== 'function') {
                showToast('⚠️ أداة الاستعادة غير متاحة — أعد تحميل الإضافة');
                return;
            }
            const result = await recoverDesignQueueFromIndexedDB({ force: true, silent: false });
            if (!result?.recovered) {
                showToast(result?.orphans
                    ? `ℹ️ لا توجد تصاميم يتيمة للاستعادة (${result.orphans} في الذاكرة فقط)`
                    : 'ℹ️ لا توجد تصاميم محفوظة للاستعادة في الذاكرة المحلية');
            }
        });
    }

    const clearQueueBtn = document.getElementById('seo-clear-queue');
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من مسح جميع التصاميم من القائمة وحذف بيانات الـ SEO المحفوظة معها؟')) {
                const queue = getDesignQueue();
                await Promise.all(queue.map((item) => window.NHPDatabase.deleteImage(item.id))); // تنظيف قاعدة البيانات
                setDesignQueue([]);
                if (S.queueContainer) S.queueContainer.classList.add('hidden');
                if (S.previewWrap) S.previewWrap.classList.add('hidden');
                renderQueue();
                saveQueueToStorage();
            }
        });
    }

    const apClearQueueBtn = document.getElementById('ap-clear-queue-btn');
    if (apClearQueueBtn) {
        apClearQueueBtn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من مسح جميع التصاميم من قائمة Autopilot وحذف بيانات SEO المرتبطة بها؟')) {
                const queue = getDesignQueue();
                await Promise.all(queue.map((item) => window.NHPDatabase.deleteImage(item.id)));
                setDesignQueue([]);
                if (S.queueContainer) S.queueContainer.classList.add('hidden');
                if (S.previewWrap) S.previewWrap.classList.add('hidden');
                if (AP_SEO.queueContainer) AP_SEO.queueContainer.classList.add('hidden');
                if (AP_SEO.previewPanel) AP_SEO.previewPanel.classList.add('hidden');
                renderQueue();
                saveQueueToStorage(true);
                showToast('🗑️ تم مسح طابور Autopilot بالكامل');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    //  SEO QUEUE MANAGEMENT — Resilient, Resumable, Idempotent
    // ─────────────────────────────────────────────────────────────────
    const SEO_STATE_KEY = 'nhp_seo_queue_state_v1';
    const SEO_MAX_RETRIES = 3;
    const SEO_RETRY_DELAYS_MS = [2000, 5000, 10000];
    const SEO_COMPLETENESS_MIN_TAGS = 10;
    const SEO_COMPLETENESS_MIN_TITLE = 5;
    const SEO_COMPLETENESS_MIN_DESC = 20;

    /** Validates that a design's meta contains complete, usable SEO data. */
    function isSEOComplete(item) {
        const m = item?.meta;
        if (!m) return false;
        const title = String(m.title || '').trim();
        const mainTag = String(m.main_tag || '').trim();
        const desc = String(m.description || '').trim();
        const tags = Array.isArray(m.tags) ? m.tags : [];
        return (
            title.length > SEO_COMPLETENESS_MIN_TITLE &&
            mainTag.length > 0 &&
            tags.length >= SEO_COMPLETENESS_MIN_TAGS &&
            desc.length > SEO_COMPLETENESS_MIN_DESC
        );
    }

    /** Saves per-design SEO state map to chrome.storage.local. */
    async function saveSEOState(queue) {
        try {
            const stateMap = {};
            for (const item of queue) {
                stateMap[item.id] = {
                    status: item.status,
                    retryCount: item._seoRetryCount || 0,
                    lastError: item._seoLastError || null,
                    updatedAt: Date.now()
                };
            }
            await new Promise((res) => chrome.storage.local.set({ [SEO_STATE_KEY]: stateMap }, res));
        } catch (_) { /* non-critical */ }
    }

    /** Loads persisted per-design SEO state and reconciles with current queue. */
    async function loadSEOState(queue) {
        try {
            const stored = await new Promise((res) =>
                chrome.storage.local.get([SEO_STATE_KEY], (r) => res(r[SEO_STATE_KEY] || {}))
            );
            for (const item of queue) {
                const saved = stored[item.id];
                if (!saved) continue;
                // Always trust isSEOComplete as source of truth; use stored retryCount only
                item._seoRetryCount = saved.retryCount || 0;
                item._seoLastError = saved.lastError || null;
            }
        } catch (_) { /* non-critical */ }
    }

    /** Updates the 5-counter badge row in the UI. */
    function updateSEOCountersUI(queue) {
        const total   = queue.length;
        const done    = queue.filter(i => isSEOComplete(i)).length;
        const failed  = queue.filter(i => i.status === 'error').length;
        const retry   = queue.filter(i => (i._seoRetryCount || 0) > 0 && i.status !== 'done').length;
        const missing = total - done;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('seo-counter-total',   total);
        set('seo-counter-done',    done);
        set('seo-counter-missing', missing);
        set('seo-counter-failed',  failed);
        set('seo-counter-retry',   retry);
    }

    // AI Generation
    async function performBatchSEOGeneration() {
        seoGenerationCancelled = false;
        const batchProvider = await getSeoGenerationProvider();
        if ([SEO_PROVIDERS.GPT_API, SEO_PROVIDERS.CURSOR_API, SEO_PROVIDERS.GEMINI_API].includes(batchProvider)) {
            const keys = batchProvider === SEO_PROVIDERS.GPT_API
                ? await resolveSeoActiveApiCredentials()
                : await getStoredSeoAiKeys();
            let activeKey = '';
            let keyName = '';
            if (batchProvider === SEO_PROVIDERS.GPT_API) {
                activeKey = keys.gpt;
                keyName = 'NHP API Key';
            } else if (batchProvider === SEO_PROVIDERS.CURSOR_API) {
                activeKey = keys.cursor;
                keyName = 'Cursor API Key';
            } else if (batchProvider === SEO_PROVIDERS.GEMINI_API) {
                activeKey = keys.gemini;
                keyName = 'Gemini API Key';
            }

            if (!activeKey || !activeKey.trim()) {
                const missingError = "❌ Missing API Key";
                showToast(missingError);
                if (S.genBtn) S.genBtn.disabled = false;
                if (S.genAndUploadBtn) S.genAndUploadBtn.disabled = false;
                if (S.loading) S.loading.classList.add('hidden');
                window.isSeoProcessing = false;
                return false;
            }

            // Prevent automatic queue execution until API authentication succeeds
            if (batchProvider === SEO_PROVIDERS.GPT_API) {
                showToast("🔍 جاري التحقق من مفتاح NHP API...");
                const authCheck = await Promise.race([
                    testSeoApiKeyConnection({ silent: true, force: true }),
                    seoSleepMs(SEO_AUTH_CHECK_TIMEOUT_MS).then(() => ({
                        keyOk: false,
                        message: `انتهت مهلة التحقق من API (${SEO_AUTH_CHECK_TIMEOUT_MS / 1000}ث)`
                    }))
                ]);
                if (!authCheck.keyOk) {
                    const authError = `❌ فشل الاتصال/التحقق: ${authCheck.message || 'يرجى التحقق من المفتاح والاتصال'}`;
                    showToast(authError);
                    if (S.genBtn) S.genBtn.disabled = false;
                    if (S.genAndUploadBtn) S.genAndUploadBtn.disabled = false;
                    if (S.loading) S.loading.classList.add('hidden');
                    window.isSeoProcessing = false;
                    return false;
                }
            }
        }

        const queue = getDesignQueue();
        const toggleEl = document.getElementById('seo-image-only');
        const isImageOnly = toggleEl ? toggleEl.checked : false;

        if (queue.length === 0) {
            const niche = S.nicheSelect.value;
            if (!niche) { showToast('⚠️ أضف تصاميم أو اختر نيتش أولاً'); return false; }
            await processSingleNicheNoImage(niche);
            return true;
        }

        if (S.genBtn) S.genBtn.disabled = true;
        enterSeoBatchStopMode();
        S.loading.classList.remove('hidden');
        if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(true);
        else window.isBatchProcessing = true;

        let batchUiLocked = false;
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;
        let retriedCount = 0;
        let missingSEOQueue = [];

        const seoBatchUI = {
            wrap: document.getElementById('seo-batch-progress'),
            status: document.getElementById('seo-batch-status'),
            fill: document.getElementById('seo-batch-fill')
        };

        try {
        batchUiLocked = true;

        // Auth passed and queue exists — mark SEO generation as active.
        // processSingleItemWithRetry guards on this flag at every attempt; without it
        // every attempt exits immediately and no item is ever processed.
        window.isSeoProcessing = true;

        if (seoBatchUI.wrap) {
            seoBatchUI.wrap.classList.remove('hidden');
            seoBatchUI.fill.style.width = '0%';
            seoBatchUI.status.textContent = `0 / ${queue.length}`;
        }

        showToast(`🧠 بدء توليد الـ SEO لـ ${queue.length} تصميم...`);

        const useWebBatchFirst = await shouldUseGeminiWebBatchFirst();
        const pendingForWindow = queue.filter((item) => item.status !== 'done');
        if (useWebBatchFirst && pendingForWindow.length > 0) {
            const batchStats = await performBatchSEOViaSharedWebWindow(queue, isImageOnly, seoBatchUI);
            const { successCount, failCount, missingCount = 0, expectedCount = pendingForWindow.length } = batchStats;
            if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(false);
            else window.isBatchProcessing = false;
            renderQueue();
            saveQueueToStorage();
            if (S.genBtn) S.genBtn.disabled = false;
            exitSeoBatchStopMode();
            const partialBatch = failCount > 0 || missingCount > 0 || successCount < expectedCount;
            const closeResult = await closeGeminiSeoWindow({
                keepOpenOnIncomplete: partialBatch,
                force: !partialBatch && successCount > 0
            });
            S.loading.classList.add('hidden');
            if (S.tpBtn) S.tpBtn.disabled = false;
            if (seoBatchUI.wrap) setTimeout(() => seoBatchUI.wrap.classList.add('hidden'), 3000);
            if (partialBatch) {
                const missingNote = missingCount > 0 ? `، ${missingCount} لم يُعالج` : '';
                const keptOpen = closeResult?.skipped || closeResult?.closed === false;
                showToast(`⚠️ اكتمل جزئياً: ${successCount}/${expectedCount} ناجح، ${failCount} فاشل${missingNote}.${keptOpen ? ' نافذة Gemini بقيت مفتوحة.' : ''}`);
            } else if (successCount > 0) {
                showToast('🚀 اكتمل تحليل جميع الصور بنجاح (نافذة واحدة)');
            } else if (closeResult?.closed === false) {
                showToast('🪟 بقيت نافذة Gemini مفتوحة — راجع الرد أو أعد المحاولة');
            }
            if (queue.length > 0) showDesignPreview(queue[0].id);
            return successCount > 0;
        }

        // ── Pre-scan: load saved state, mark already-complete as done immediately
        await loadSEOState(queue);
        for (const item of queue) {
            if (isSEOComplete(item)) {
                item.status = 'done';
                skippedCount++;
            } else if (item.status === 'done') {
                // status was 'done' but meta is incomplete — reset to pending
                item.status = 'pending';
            } else if (item.status === 'loading') {
                // Stale 'loading' from a previous aborted run — must be retried
                item.status = 'pending';
            } else if (!item.status || item.status === 'error') {
                item.status = 'pending';
            }
        }
        renderQueue();
        updateSEOCountersUI(queue);
        const alreadyDone = queue.filter(i => i.status === 'done').length;
        if (alreadyDone > 0) showToast(`⚡ تم تخطي ${alreadyDone} تصميم مكتمل SEO — سيتم معالجة الباقي فقط`);

        // ── Helper: process a single item with retries & backoff
        const processSingleItemWithRetry = async (item, idx, routingOptions = {}) => {
            if (isSEOComplete(item)) { item.status = 'done'; successCount++; return; }

            const rawName = (item.file && item.file.name) ? item.file.name : (item.name || '');
            const primaryKeyword = extractPrimaryKeywordFromFilename(rawName);
            const niche = cleanNicheName(rawName);
            const maxAttempts = SEO_MAX_RETRIES;

            for (let attempt = 0; attempt <= maxAttempts; attempt++) {
                if (!window.isSeoProcessing) return; // user stopped

                // Backoff before retry
                if (attempt > 0) {
                    const delay = SEO_RETRY_DELAYS_MS[Math.min(attempt - 1, SEO_RETRY_DELAYS_MS.length - 1)];
                    showToast(`🔄 إعادة المحاولة ${attempt}/${maxAttempts} للتصميم: ${rawName || item.id} (${delay/1000}s)`);
                    await seoSleepMs(delay);
                    retriedCount++;
                }

                item.status = 'loading';
                item._seoRetryCount = item._seoRetryCount || 0;
                renderQueue();
                updateSEOCountersUI(queue);

                try {
                    // ── Stage tracking — updated before each risky step ──────────────────────
                    const activeProvider = await resolveSeoActiveProvider(routingOptions);
                    const skipSeoImage = isLocalLibraryProvider(activeProvider);
                    let aiBase64 = null;

                    if (!skipSeoImage) {
                        item.failedStage = 'IMAGE_RETRIEVAL';

                        // Use defensive helper — throws a descriptive error if NHPDatabase is
                        // unavailable, item.id is missing, or IndexedDB has no record for this item.
                        const itemBase64 = await resolveSeoItemBase64(item);

                        item.failedStage = 'THUMBNAIL_CREATION';
                        const rawForThumb = normalizeBase64DataUrl(itemBase64, 'image/png');
                        const cleanForThumb = rawForThumb.startsWith('data:')
                            ? (rawForThumb.split(',')[1] || '')
                            : rawForThumb;
                        aiBase64 = cleanForThumb
                            ? await createThumbnail(cleanForThumb, isLowSpecModeEnabled() ? 640 : 800)
                            : null;
                    }

                    item.failedStage = 'PROMPT_BUILD';
                    // (prompt is built inside performComprehensiveAnalysis / callGeminiSEO)

                    item.failedStage = 'AI_CALL';
                    const result = await Promise.race([
                        performComprehensiveAnalysis(niche, idx, aiBase64, isImageOnly, rawName, primaryKeyword, routingOptions),
                        seoSleepMs(SEO_ITEM_GENERATION_TIMEOUT_MS).then(() => {
                            throw new Error(`SEO generation timeout (${Math.round(SEO_ITEM_GENERATION_TIMEOUT_MS / 1000)}s)`);
                        })
                    ]);

                    item.failedStage = 'SEO_VALIDATION';
                    if (!result) throw new Error('AI returned empty result');

                    item.failedStage = null; // cleared on success
                    item.meta = mergeSeoMetaForItem(item, result);
                    item.status = 'done';
                    item._seoLastError = null;
                    item.lastError = null;
                    successCount++;
                    const currentActiveId = S.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id');
                    if (successCount === 1 || currentActiveId === item.id) updatePreviewFields(result);
                    const queueSaveOpts = seoQueuePersistOptionsForProvider(activeProvider);
                    await persistSeoQueueBounded(true, queueSaveOpts);
                    await saveSEOState(queue);
                    updateSEOCountersUI(queue);
                    return; // success — exit retry loop

                } catch (err) {
                    const errMsg = String(err?.message || err || 'unknown error');
                    item._seoRetryCount = (item._seoRetryCount || 0) + 1;
                    // Store error in both fields for maximum visibility
                    item._seoLastError = errMsg;
                    item.lastError = errMsg;
                    // failedStage already set before the throw
                    console.warn(`[SEO Queue] Attempt ${attempt + 1} failed for "${rawName}" [stage: ${item.failedStage || 'UNKNOWN'}]:`, errMsg);

                    // Persist failure state immediately
                    await saveSEOState(queue);

                    if (attempt >= maxAttempts) {
                        // Max retries reached — mark as hard fail
                        item.status = 'error';
                        failCount++;
                        renderQueue();
                        updateSEOCountersUI(queue);
                        console.error(`[SEO Queue] PERMANENT FAIL after ${maxAttempts + 1} attempts: "${rawName}" [stage: ${item.failedStage || 'UNKNOWN'}] — ${errMsg}`);
                        return;
                    }
                    item.status = 'pending';
                    // else continue loop for next retry attempt
                } finally {
                    if (item.status === 'loading') {
                        item.status = 'pending';
                    }
                }
            }
        };

        // ── Main sequential generation pass (only non-done items)
        const pending = queue.filter(i => i.status !== 'done');
        // batchProvider already resolved above (at function start); use a local alias here
        const _batchProviderLocal = await getSeoGenerationProvider();
        const batchRoutingMode = await getSeoProxyRoutingMode();
        const useDistributedBatch = _batchProviderLocal === SEO_PROVIDERS.GPT_API
            && isSeoProxyDistributedMode(batchRoutingMode)
            && pending.length > 1;

        const updateBatchProgress = (doneCount) => {
            const progressPercent = Math.min((doneCount / pending.length) * 100, 100);
            if (seoBatchUI.fill) {
                seoBatchUI.fill.style.width = `${progressPercent}%`;
                seoBatchUI.status.textContent = `${Math.min(doneCount, pending.length)} / ${pending.length}`;
            }
            renderQueue();
        };

        if (useDistributedBatch) {
            const concurrency = await getSeoDistributedConcurrency();
            let nextIndex = 0;
            let completedCount = 0;
            showToast(`⚡ توزيع SEO على ${concurrency} نقطة CLIProxy بالتوازي...`);
            const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
                while (window.isSeoProcessing) {
                    const i = nextIndex++;
                    if (i >= pending.length) break;
                    const item = pending[i];
                    const queueIdx = queue.indexOf(item);
                    const activeId = S.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id');
                    if (activeId === item.id) updatePreviewFields(null);
                    await processSingleItemWithRetry(item, queueIdx, {
                        batchIndex: i,
                        proxyRoutingMode: batchRoutingMode
                    });
                    completedCount += 1;
                    updateBatchProgress(completedCount);
                }
            });
            await Promise.all(workers);
        } else {
        for (let i = 0; i < pending.length; i++) {
            if (!window.isSeoProcessing) break;
            const item = pending[i];
            const queueIdx = queue.indexOf(item);

            const activeId = S.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id');
            if (activeId === item.id) updatePreviewFields(null);

            await processSingleItemWithRetry(item, queueIdx, {
                batchIndex: i,
                proxyRoutingMode: batchRoutingMode
            });

            // Human-like pacing between designs
            if (i + 1 < pending.length) {
                const baseGap = isLocalLibraryProvider(_batchProviderLocal) ? 350 : (isLowSpecModeEnabled() ? 7000 : 6000);
                const humanJitter = Math.floor(Math.random() * 1100) + 700; // 700–1800ms extra
                const gap = isLocalLibraryProvider(_batchProviderLocal) ? baseGap : Math.max(baseGap, humanJitter);
                await seoSleepMs(gap);
            }

            updateBatchProgress(i + 1);
        }
        }

        // ── Verification pass: find still-incomplete designs and retry them
        missingSEOQueue = queue.filter(item => !isSEOComplete(item) && item.status !== 'loading');
        if (missingSEOQueue.length > 0 && window.isSeoProcessing) {
            showToast(`🔍 فحص التحقق: ${missingSEOQueue.length} تصميم لا يزال يحتاج SEO — جاري إعادة المحاولة...`);
            for (let j = 0; j < missingSEOQueue.length; j++) {
                if (!window.isSeoProcessing) break;
                const item = missingSEOQueue[j];
                item.status = 'pending';
                const queueIdx = queue.indexOf(item);
                await seoSleepMs(1500);
                await processSingleItemWithRetry(item, queueIdx);
            }
        }

        // ── Finalize
        window.isSeoProcessing = false; // generation complete — clear processing flag
        if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(false);
        else window.isBatchProcessing = false;
        renderQueue();
        if (typeof window.NHP_hydrateMissingQueueThumbnails === 'function') {
            await window.NHP_hydrateMissingQueueThumbnails();
        }
        renderQueue();
        await saveQueueToStorage();
        await saveSEOState(queue);
        if (S.genBtn) S.genBtn.disabled = false;
        exitSeoBatchStopMode();
        await closeGeminiSeoWindow();
        S.loading.classList.add('hidden');
        if (S.tpBtn) S.tpBtn.disabled = false;
        if (seoBatchUI.wrap) setTimeout(() => seoBatchUI.wrap.classList.add('hidden'), 4000);
        updateSEOCountersUI(queue);

        // ── Window fallback for persistent failures (existing behavior)
        const windowFallbackEnabled = await isSeoAiWindowModeEnabled();
        const provider = await getSeoGenerationProvider();
        let retrySuccess = 0;
        if (windowFallbackEnabled
            && provider !== SEO_PROVIDERS.GEMINI_WEB
            && !isLocalLibraryProvider(provider)
            && failCount > 0) {
            const stillFailed = queue.filter((item) => item.status === 'error');
            if (stillFailed.length > 0) {
                showToast(`🪟 إعادة ${stillFailed.length} تصميم فاشل عبر نافذة Gem/ChatGPT...`);
                const retryStats = await performBatchSEOViaSharedWebWindow(queue, isImageOnly, seoBatchUI);
                retrySuccess = retryStats.successCount || 0;
                successCount += retrySuccess;
                failCount = Math.max(0, failCount - retrySuccess);
                renderQueue();
                await saveQueueToStorage();
                updateSEOCountersUI(queue);
            }
        }

        // ── Final Audit Log ────────────────────────────────────────────────────────
        const finalFailed = queue.filter(i => !isSEOComplete(i));
        const auditLines = [
            `📋 تقرير SEO النهائي:`,
            `✅ مكتمل مسبقاً: ${skippedCount}`,
            `✅ تم توليده الآن: ${successCount - skippedCount}`,
            `🔄 أُعيدت محاولته: ${retriedCount}`,
            `❌ فاشل نهائياً: ${failCount}`,
        ];
        if (finalFailed.length > 0) {
            // Safe per-item diagnostic table — no full base64, no keys, no prompts
            const hasNHPDb = typeof window !== 'undefined' && !!window.NHPDatabase;
            const failTable = finalFailed.map(i => ({
                filename:        i.file?.name || i.name || i.id || '(unknown)',
                id:              i.id || '(missing)',
                status:          i.status,
                retryCount:      i._seoRetryCount ?? 0,
                failedStage:     i.failedStage || '(not set)',
                _seoLastError:   i._seoLastError || '(none)',
                lastError:       i.lastError || '(none)',
                error:           i.error || '(none)',
                hasInlineBase64: !!i.base64,
                hasNHPDatabase:  hasNHPDb
            }));
            console.warn('[SEO Queue] ❌ Failed designs — diagnostic table:');
            console.table(failTable);
            // Also log first item's full error string plainly for easy copy-paste
            if (failTable[0]) {
                console.warn('[SEO Queue] First failure detail:',
                    `stage=${failTable[0].failedStage}`,
                    `| error=${failTable[0]._seoLastError}`);
            }
        }
        console.log(auditLines.join('\n'));

        // ── Completion condition: only "complete" if no missing or failed
        const isFullyComplete = missingSEOQueue.filter(i => !isSEOComplete(i)).length === 0 && failCount === 0;
        if (seoGenerationCancelled) {
            seoGenerationCancelled = false;
        } else if (isFullyComplete) {
            showToast('🚀 اكتمل توليد SEO لجميع التصاميم بنجاح');
        } else if (failCount > 0) {
            showToast(`⚠️ اكتمل التحليل: ${successCount} ناجح، ${failCount} فاشل — راجع القائمة الحمراء`);
        } else if (successCount > 0) {
            showToast(`✅ اكتمل SEO: ${successCount} تصميم`);
        }

        if (queue.length > 0) showDesignPreview(queue[0].id);
        return successCount > 0;
        } catch (batchError) {
            console.error('[SEO Batch] Unhandled error:', batchError);
            showToast(`❌ تعذر إكمال توليد SEO: ${batchError?.message || batchError}`);
            return false;
        } finally {
            if (batchUiLocked) {
                resetSeoGenerationUiState({ hideBatchProgress: false, hideLoading: true });
                if (seoBatchUI.wrap) setTimeout(() => seoBatchUI.wrap.classList.add('hidden'), 4000);
            }
        }
    }

    let seoActionInFlight = false;
    const runSeoActionSafely = async (actionRunner) => {
        if (seoActionInFlight) {
            showToast('⏳ يوجد إجراء قيد التنفيذ حالياً... يرجى الانتظار');
            return false;
        }
        seoActionInFlight = true;
        try {
            return await actionRunner();
        } catch (actionError) {
            console.error('[SEO Action] Unhandled error:', actionError);
            showToast(`❌ خطأ في إجراء SEO: ${actionError?.message || actionError}`);
            resetSeoGenerationUiState();
            return false;
        } finally {
            seoActionInFlight = false;
        }
    };

    const triggerAutopilotUpload = async () => {
        await saveQueueToStorage(true);
        setTimeout(() => {
            // Keep the user's current section; Autopilot can run without stealing focus.
            setTimeout(() => {
                const apStartBtn = document.getElementById('ap-start-btn');
                if (apStartBtn && !apStartBtn.disabled) {
                    apStartBtn.click();
                    showToast('🚀 بدء إجراء الرفع فقط عبر الأوتوبايلوت');
                } else {
                    showToast('⚠️ الرفع فقط: اضغط زر بدء الرفع في قسم Autopilot');
                }
            }, 500);
        }, 1500);
    };

    const handleCombinedSeoAndUploadAction = async () => {
        showToast('🚀 تم تشغيل: بدء التحليل (SEO + رفع تلقائي)');
        const success = await performBatchSEOGeneration();
        if (success) await triggerAutopilotUpload();
    };

    const handleSeoOnlyAction = async () => {
        showToast('🧠 تم تشغيل: توليد SEO فقط');
        return await performBatchSEOGeneration();
    };

    async function generateSeoForSingleQueueItem(queueId) {
        const queue = getDesignQueue();
        const item = queue.find((entry) => entry.id === queueId);
        if (!item) {
            showToast('⚠️ التصميم غير موجود في الطابور');
            return null;
        }

        if (window.isSeoProcessing || window.isBatchProcessing) {
            showToast('⏳ توليد SEO قيد التنفيذ — يرجى الانتظار');
            return null;
        }

        const rawName = (item.file && item.file.name) ? item.file.name : (item.name || '');
        const primaryKeyword = extractPrimaryKeywordFromFilename(rawName);
        const niche = cleanNicheName(rawName);
        const seoToggle = document.getElementById('seo-image-only');
        const apToggle = document.getElementById('ap-image-only');
        const isImageOnly = (seoToggle && seoToggle.checked) || (apToggle && apToggle.checked) || false;
        const itemIndex = Math.max(queue.findIndex((entry) => entry.id === queueId), 0);

        item.status = 'loading';
        renderQueue();
        updateSEOCountersUI(queue);

        try {
            const lightboxRoutingOptions = { providerOverride: SEO_PROVIDERS.LOCAL_LIBRARY };
            showToast('📚 توليد SEO عبر المكتبة المحلية (نص فقط)...');

            const result = await Promise.race([
                performComprehensiveAnalysis(
                    niche,
                    itemIndex,
                    null,
                    isImageOnly,
                    rawName,
                    primaryKeyword,
                    lightboxRoutingOptions
                ),
                seoSleepMs(SEO_ITEM_GENERATION_TIMEOUT_MS).then(() => {
                    throw new Error(`SEO generation timeout (${Math.round(SEO_ITEM_GENERATION_TIMEOUT_MS / 1000)}s)`);
                })
            ]);

            if (!result) throw new Error('SEO returned empty result');

            item.meta = mergeSeoMetaForItem(item, result);
            item.status = 'done';
            item._seoLastError = null;
            item.lastError = null;
            item.failedStage = null;

            await persistSeoQueueBounded(true, { metadataOnly: true });
            await saveSEOState(queue);
            updateSEOCountersUI(queue);
            renderQueue();

            const currentActiveId = S.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id')
                || document.querySelector('#ap-queue .queue-item.active')?.getAttribute('data-id');
            if (currentActiveId === item.id) {
                showDesignPreview(item.id);
                updatePreviewFields(result);
            }

            if (typeof window.NHP_refreshQueueLightbox === 'function') {
                window.NHP_refreshQueueLightbox(item.id);
            }

            showToast(`✨ تم توليد SEO (مكتبة محلية): ${primaryKeyword || niche}`);
            return result;
        } catch (err) {
            const errMsg = String(err?.message || err || 'unknown error');
            item._seoLastError = errMsg;
            item.lastError = errMsg;
            item.status = 'error';
            await saveQueueToStorage(true);
            await saveSEOState(queue);
            updateSEOCountersUI(queue);
            renderQueue();
            showToast(`❌ فشل توليد SEO (مكتبة محلية): ${errMsg}`);
            return null;
        }
    }

    window.NHP_SEO_GenerateForItem = (queueId) => runSeoActionSafely(() => generateSeoForSingleQueueItem(queueId));
    window.NHP_SEO_GenerateAll = () => runSeoActionSafely(handleSeoOnlyAction);

    // Expose helpers globally
    window.isSEOComplete = isSEOComplete;

    // Retry Missing SEO — pre-scans, skips done items, only regenerates incomplete ones
    const handleRetryMissingSEO = async () => {
        const queue = getDesignQueue();
        if (!queue || queue.length === 0) { showToast('⚠️ لا توجد تصاميم في القائمة'); return false; }
        const missing = queue.filter(item => !isSEOComplete(item));
        if (missing.length === 0) { showToast('✅ جميع التصاميم تحتوي على SEO مكتمل — لا يوجد شيء للإعادة'); return false; }
        showToast(`🔄 إعادة توليد SEO لـ ${missing.length} تصميم غير مكتمل...`);
        return await performBatchSEOGeneration();
    };
    window.NHP_SEO_RetryMissing = () => runSeoActionSafely(handleRetryMissingSEO);

    // Wire up "Retry Missing SEO" button
    const retryMissingBtn = document.getElementById('seo-retry-missing-btn');
    if (retryMissingBtn && !retryMissingBtn.dataset.bound) {
        retryMissingBtn.dataset.bound = 'true';
        retryMissingBtn.addEventListener('click', () => runSeoActionSafely(handleRetryMissingSEO));
    }

    const handleUploadOnlyAction = async () => {
        showToast('📤 تم تشغيل: رفع فقط');
        await startTeePublicAutomation();
    };

    // Button semantics:
    // - "بدء التحليل" => combined flow (SEO + auto upload)
    // - "توليد SEO" => SEO-only flow
    // - upload/automation button => upload-only flow
    if (S.genBtn) {
        S.genBtn.title = 'بدء التحليل الشامل (SEO + رفع تلقائي)';
        S.genBtn.addEventListener('click', () => runSeoActionSafely(handleCombinedSeoAndUploadAction));
    }

    if (S.genAndUploadBtn) {
        S.genAndUploadBtn.innerHTML = 'توليد SEO';
        S.genAndUploadBtn.title = 'توليد SEO فقط بدون رفع';
        S.genAndUploadBtn.addEventListener('click', () => {
            if (S.genAndUploadBtn?.dataset?.seoStopMode === '1') {
                requestStopSeoBatchGeneration();
                return;
            }
            runSeoActionSafely(handleSeoOnlyAction);
        });
    }

    // Upload-only trigger
    if (S.tpBtn) {
        S.tpBtn.innerHTML = '<i class="fa-solid fa-upload"></i> رفع فقط';
        S.tpBtn.title = 'رفع فقط بدون توليد SEO';
        S.tpBtn.addEventListener('click', () => runSeoActionSafely(handleUploadOnlyAction));
    }
    S.stopBtn?.addEventListener('click', () => {
        window.isSeoProcessing = false;
        resetSeoGenerationUiState({ hideBatchProgress: false });
        S.stopBtn.classList.add('hidden');
        showToast('⏳ جاري إيقاف الأتمتة... يرجى الانتظار لإغلاق النافذة الحالية');
    });

    // Copy Buttons
    S.copyTitle?.addEventListener('click', () => { navigator.clipboard.writeText(S.titleEl.value); showToast('📋 تم نسخ العنوان'); });
    S.copyMainTag?.addEventListener('click', () => { navigator.clipboard.writeText(S.mainTagEl.value); showToast('📋 تم نسخ الطاك الرئيسي'); });
    S.copyTags?.addEventListener('click', () => { navigator.clipboard.writeText(S.tagsEl.value); showToast('📋 تم نسخ التاجات'); });
    S.copyDesc?.addEventListener('click', () => { navigator.clipboard.writeText(S.descEl.value); showToast('📋 تم نسخ الوصف'); });

    // New SEO Features
    document.getElementById('seo-apply-all')?.addEventListener('click', applyToAll);

    // Field change listeners
    [S.titleEl, S.tagsEl, S.mainTagEl, S.descEl].forEach(el => {
        if (el) {
            ['input', 'change', 'blur'].forEach(evt => {
                el.addEventListener(evt, () => {
                    if (el === S.mainTagEl) {
                        const sanitized = sanitizeMainTag(el.value);
                        if (el.value !== sanitized) el.value = sanitized;
                    }
                    saveSeoFields(evt === 'blur' || evt === 'change');
                    if (S.titleEl.value && S.tagsEl.value && S.tpBtn) S.tpBtn.disabled = false;
                });
            });
        }
    });
    
    // Autopilot Bridge
    if (AP_SEO.uploadTrigger) {
        AP_SEO.uploadTrigger.onclick = () => AP_SEO.imageInput.click();
        AP_SEO.imageInput.onchange = (e) => {
            handleBulkUpload(Array.from(e.target.files));
            e.target.value = '';
        };
    }

    if (AP_SEO.applyAll) AP_SEO.applyAll.addEventListener('click', applyToAll);

    document.getElementById('ap-ask-ai-btn')?.addEventListener('click', async () => {
        const button = document.getElementById('ap-ask-ai-btn');
        const item = getActiveAutopilotQueueItem();
        if (!item) return showToast('⚠️ اختر تصميماً من طابور Autopilot أولاً.');

        const queue = getDesignQueue();
        const itemIndex = Math.max(queue.findIndex((entry) => entry.id === item.id), 0);
        const rawName = item.file?.name || item.name || 'design';
        const primaryKeyword = extractPrimaryKeywordFromFilename(rawName);
        const niche = cleanNicheName(rawName);
        const toggleEl = document.getElementById('ap-image-only');
        const isImageOnly = toggleEl ? toggleEl.checked : false;

        let originalHtml = '';
        if (button) {
            originalHtml = button.innerHTML;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            button.disabled = true;
        }

        try {
            const itemBase64 = item.base64 || await window.NHPDatabase.getImage(item.id);
            const aiBase64 = itemBase64 ? await createThumbnail(itemBase64, isLowSpecModeEnabled() ? 640 : 800) : null;
            const result = await performComprehensiveAnalysis(niche, itemIndex, aiBase64, isImageOnly, rawName, primaryKeyword);
            if (!result) throw new Error('No analysis result');

            item.meta = mergeSeoMetaForItem(item, result);
            item.status = 'done';
            renderQueue();
            saveQueueToStorage(true);
            showDesignPreview(item.id);
            updatePreviewFields(result);
            showToast('✨ تم تحديث SEO للتصميم المحدد في Autopilot');
        } catch (error) {
            console.error('Autopilot single SEO generation failed:', error);
            showToast('❌ فشل تحليل التصميم الحالي في Autopilot');
        } finally {
            if (button) {
                button.innerHTML = originalHtml || '<i class="fa-solid fa-wand-magic-sparkles"></i>';
                button.disabled = false;
            }
        }
    });

    document.getElementById('ap-test-colors-btn')?.addEventListener('click', async () => {
        await pickAutopilotDefaultColor();
    });

    async function performAutopilotBatchSEO() {
        const queue = getDesignQueue();
        const toggleEl = document.getElementById('ap-image-only');
        const isImageOnly = toggleEl ? toggleEl.checked : false;

        if (queue.length === 0) {
            showToast('⚠️ أضف تصاميم أولاً في قسم الأوتوبايلوت');
            return false;
        }

        if (AP_SEO.genBtn) AP_SEO.genBtn.disabled = true;
        if (AP_SEO.genAndUploadBtn) AP_SEO.genAndUploadBtn.disabled = true;
        if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(true);
        else window.isBatchProcessing = true;
        showToast('🚀 بدء استخلاص البيانات للـ Autopilot (إنتاج فريد لكل نيتش)...');

        let success = 0;
        const useWebBatchFirst = await shouldUseGeminiWebBatchFirst();
        const pendingForWindow = queue.filter((item) => item.status !== 'done');

        if (useWebBatchFirst && pendingForWindow.length > 0) {
            const stats = await performBatchSEOViaSharedWebWindow(queue, isImageOnly, null);
            success = stats.successCount;
            saveQueueToStorage();
            if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(false);
            else window.isBatchProcessing = false;
            if (AP_SEO.genBtn) AP_SEO.genBtn.disabled = false;
            if (AP_SEO.genAndUploadBtn) AP_SEO.genAndUploadBtn.disabled = false;
            await closeGeminiSeoWindow();
            const apExpected = stats.expectedCount || pendingForWindow.length;
            const apPartial = stats.failCount > 0 || stats.missingCount > 0 || stats.successCount < apExpected;
            if (apPartial) {
                const apMissing = stats.missingCount > 0 ? `، ${stats.missingCount} لم يُعالج` : '';
                showToast(`⚠️ Autopilot SEO جزئي: ${stats.successCount}/${apExpected} ناجح، ${stats.failCount} فاشل${apMissing}`);
            } else {
                showToast(`✅ اكتمل توليد الـ SEO لـ ${success} تصميم بنجاح في Autopilot (نافذة واحدة)`);
            }
            return success > 0;
        }

        let failCount = 0;
        const concurrency = 1;
        for (let i = 0; i < queue.length; i += concurrency) {
            const chunk = queue.slice(i, i + concurrency);
            await Promise.all(chunk.map(async (item) => {
                if (item.status === 'done') { success++; return; }
                try {
                    const rawName = (item.file && item.file.name) ? item.file.name : (item.name || "");
                    const primaryKeyword = extractPrimaryKeywordFromFilename(rawName);
                    const niche = cleanNicheName(rawName);
                    
                    item.status = 'loading';
                    renderQueue();

                    const itemBase64 = item.base64 || await window.NHPDatabase.getImage(item.id);
                    const aiBase64 = itemBase64 ? await createThumbnail(itemBase64, isLowSpecModeEnabled() ? 640 : 800) : null;

                    const result = await performComprehensiveAnalysis(niche, i, aiBase64, isImageOnly, rawName, primaryKeyword);
                    if (result) {
                        item.meta = mergeSeoMetaForItem(item, result);
                        item.status = 'done';
                        success++;
                        
                        const activeId = AP_SEO.queueList?.querySelector('.queue-item.active')?.getAttribute('data-id');
                        if (activeId === item.id) showDesignPreview(item.id);
                    }
                } catch (e) {
                    item.status = 'error';
                    failCount++;
                }
            }));
            
            if (i + concurrency < queue.length) await new Promise(r => setTimeout(r, isLowSpecModeEnabled() ? 7000 : 6000));
            renderQueue();
        }

        const windowFallbackEnabled = await isSeoAiWindowModeEnabled();
        const provider = await getSeoGenerationProvider();
        if (windowFallbackEnabled
            && provider !== SEO_PROVIDERS.GEMINI_WEB
            && !isLocalLibraryProvider(provider)
            && failCount > 0) {
            const stillFailed = queue.filter((item) => item.status === 'error');
            if (stillFailed.length > 0) {
                showToast(`🪟 Autopilot: إعادة ${stillFailed.length} تصميم عبر النافذة...`);
                const retryStats = await performBatchSEOViaSharedWebWindow(queue, isImageOnly, null);
                success += retryStats.successCount || 0;
                failCount = Math.max(0, failCount - (retryStats.successCount || 0));
                renderQueue();
            }
        }

        saveQueueToStorage();
        if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(false);
        else window.isBatchProcessing = false;
        if (AP_SEO.genBtn) AP_SEO.genBtn.disabled = false;
        if (AP_SEO.genAndUploadBtn) AP_SEO.genAndUploadBtn.disabled = false;
        await closeGeminiSeoWindow();
        if (failCount > 0) {
            showToast(`⚠️ Autopilot SEO: ${success} ناجح، ${failCount} فاشل`);
        } else {
            showToast(`✅ اكتمل توليد الـ SEO لـ ${success} تصميم بنجاح في Autopilot`);
        }
        return success > 0;
    }
    
    if (AP_SEO.genBtn) AP_SEO.genBtn.addEventListener('click', performAutopilotBatchSEO);

    if (AP_SEO.genAndUploadBtn) {
        AP_SEO.genAndUploadBtn.addEventListener('click', async () => {
            const success = await performAutopilotBatchSEO();
            if (success) {
                await saveQueueToStorage(true);
                await closeGeminiSeoWindow();
                setTimeout(() => {
                    const apStartBtn = document.getElementById('ap-start-btn');
                    if (apStartBtn && !apStartBtn.disabled) {
                        apStartBtn.click();
                        showToast('🚀 جاري بدء الرفع الشامل عبر الأوتوبايلوت...');
                    } else {
                        showToast('🚀 تم التوليد بنجاح! يرجى الضغط على زر بدء الرفع يدوياً.');
                    }
                }, 1500);
            }
        });
    }

    [AP_SEO.title, AP_SEO.mainTag, AP_SEO.tags, AP_SEO.desc].forEach(el => {
        if (el) el.addEventListener('input', () => {
            if (el === AP_SEO.mainTag) {
                const sanitized = sanitizeMainTag(el.value);
                if (el.value !== sanitized) el.value = sanitized;
            }
            syncAPtoGlobal();
        });
    });
    if (AP_SEO.copyTitle) AP_SEO.copyTitle.onclick = () => { navigator.clipboard.writeText(AP_SEO.title.value); showToast('📋 تم نسخ العنوان'); };
    if (AP_SEO.copyMainTag) AP_SEO.copyMainTag.onclick = () => { navigator.clipboard.writeText(AP_SEO.mainTag.value); showToast('📋 تم نسخ الطاك'); };
    if (AP_SEO.copyTags) AP_SEO.copyTags.onclick = () => { navigator.clipboard.writeText(AP_SEO.tags.value); showToast('📋 تم نسخ التاجات'); };
    if (AP_SEO.copyDesc) AP_SEO.copyDesc.onclick = () => { navigator.clipboard.writeText(AP_SEO.desc.value); showToast('📋 تم نسخ الوصف'); };

    if (AP_SEO.queueList) {
        AP_SEO.queueList.onclick = (e) => {
            const itemEl = e.target.closest('.queue-item');
            const removeBtn = e.target.closest('.remove-btn');
            if (removeBtn) {
                const removeId = removeBtn.getAttribute('data-remove-id');
                window.NHPDatabase.deleteImage(removeId); // حذف من IndexedDB
                removeFromQueue(removeId);
                return;
            }
            if (itemEl) {
                const id = itemEl.getAttribute('data-id');
                AP_SEO.queueList.querySelectorAll('.queue-item').forEach(el => el.classList.toggle('active', el.getAttribute('data-id') === id));
                showDesignPreview(id);
                
                // Force sync fields for this item
                const item = getDesignQueue().find(i => i.id === id);
                if (item && item.meta) {
                    if (AP_SEO.title) AP_SEO.title.value = item.meta.title || '';
                    if (AP_SEO.mainTag) AP_SEO.mainTag.value = sanitizeMainTag(item.meta.main_tag || '');
                    if (AP_SEO.tags) AP_SEO.tags.value = Array.isArray(item.meta.tags) ? item.meta.tags.join(', ') : (item.meta.tags || '');
                    if (AP_SEO.desc) AP_SEO.desc.value = item.meta.description || '';
                } else {
                    if (AP_SEO.title) AP_SEO.title.value = '';
                    if (AP_SEO.mainTag) AP_SEO.mainTag.value = '';
                    if (AP_SEO.tags) AP_SEO.tags.value = '';
                    if (AP_SEO.desc) AP_SEO.desc.value = '';
                }
            }
        };
    }
}

/**
 * Handle Bulk Upload
 */
async function handleBulkUpload(files) {
    if (!files || files.length === 0) return;
    if (S.queueContainer) S.queueContainer.classList.remove('hidden');
    if (AP_SEO.queueContainer) AP_SEO.queueContainer.classList.remove('hidden');

    showToast(`🚀 جاري معالجة ${files.length} تصميم... لا تغلق Chrome حتى يكتمل الرفع (يُحفظ تلقائياً كل بضع ملفات)`);
    if (typeof window.NHP_setBatchProcessing === 'function') {
        window.NHP_setBatchProcessing(true);
    } else {
        if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(true);
        else window.isBatchProcessing = true;
    }
    const queue = getDesignQueue();

    const cloudSyncStore = await new Promise(r => chrome.storage.local.get(['cloudSyncEnabled'], r));
    const syncActive = cloudSyncStore.cloudSyncEnabled !== false;
    const isCloudReady = syncActive && typeof window.GitHubSync !== 'undefined' && window.GitHubSync.config.token !== 'YOUR_GITHUB_TOKEN';

    const uploadPromises = []; // لتتبع عمليات الرفع السحابي وتجنب الحفظ المتكرر
    const maxCloudConcurrency = 2;
    let activeCloudUploads = 0;
    const waitingCloudUploads = [];
    const renderEvery = files.length >= 40 ? 6 : files.length >= 20 ? 4 : 2;
    const checkpointEvery = files.length >= 30 ? 3 : 5;
    let stagedItemsSinceRender = 0;

    const yieldToUI = () => new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => setTimeout(resolve, 0));
            return;
        }
        setTimeout(resolve, 0);
    });

    const acquireCloudSlot = async () => {
        if (activeCloudUploads < maxCloudConcurrency) {
            activeCloudUploads++;
            return;
        }
        await new Promise((resolve) => waitingCloudUploads.push(resolve));
        activeCloudUploads++;
    };

    const releaseCloudSlot = () => {
        activeCloudUploads = Math.max(0, activeCloudUploads - 1);
        const next = waitingCloudUploads.shift();
        if (next) next();
    };

    const queueCloudUpload = (base64, item) => (async () => {
        await acquireCloudSlot();
        try {
            const uploadRes = await window.GitHubSync.uploadImage(base64, item.file.name);
            const index = queue.findIndex(i => i.id === item.id);
            if (index !== -1) {
                queue[index].remoteUrl = uploadRes.success ? uploadRes.url : null;
                queue[index].status = uploadRes.success ? 'synced' : 'pending';
            }
        } catch (err) {
            console.error('BG upload fail:', item.file.name, err);
        } finally {
            releaseCloudSlot();
        }
    })();

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        try {
            const base64 = await fileToBase64(file);
            console.log('[NHP-IMG] base64 ready', base64.length, false);
            const thumbnailWidth = isLowSpecModeEnabled()
                ? (files.length >= 30 ? 80 : 96)
                : (files.length >= 30 ? 96 : 120);
            const thumbnail = await createThumbnail(base64, thumbnailWidth);
            console.log('[NHP-IMG] resized', `${Math.round((base64.length * 0.75) / 1024)}KB`, `${Math.round(((thumbnail?.split(',')[1]?.length || 0) * 0.75) / 1024)}KB`);
            const itemId = Math.random().toString(36).substr(2, 9);
            
            const imageDb = window.NHPDatabase;
            if (!imageDb?.saveImage) {
                throw new Error('NHPDatabase غير متاح — أعد تحميل الإضافة');
            }
            // حفظ الصورة الأصلية الضخمة في IndexedDB
            await imageDb.saveImage(itemId, base64);
            
            const newItem = {
                id: itemId,
                file: { name: file.name, type: file.type },
                base64: null, // الخدعة الهندسية: تفريغ الرام والستوريدج من العبء!
                thumbnail: thumbnail,
                remoteUrl: null,
                meta: null,
                status: 'pending'
            };
            queue.push(newItem);
            if (queue.length === 1) showDesignPreview(newItem.id);

            const fileSizeMB = (base64.length * 0.75) / (1024 * 1024); // استخدام المتغير المؤقت
            if (fileSizeMB > 2) {
                newItem.status = 'local-hybrid';
            } else if (isCloudReady) {
                uploadPromises.push(queueCloudUpload(base64, newItem));
            }
            
            stagedItemsSinceRender++;
            const shouldFlushUI =
                queue.length === 1 ||
                stagedItemsSinceRender >= renderEvery ||
                fileIndex === files.length - 1;

            // تحديث الواجهة على دفعات لتقليل التشنج عند رفع أعداد كبيرة
            if (shouldFlushUI) {
                stagedItemsSinceRender = 0;
                renderQueue();
                await yieldToUI();
            }

            const shouldCheckpoint =
                (fileIndex + 1) % checkpointEvery === 0 ||
                fileIndex === files.length - 1;
            if (shouldCheckpoint) {
                try {
                    await saveQueueToStorage(true, { metadataOnly: true });
                } catch (checkpointError) {
                    console.warn('Bulk upload checkpoint save failed:', checkpointError);
                }
            }
        } catch (error) { console.error('Processing error for', file.name, error); }
    }

    // الانتظار حتى تنتهي جميع عمليات الرفع السحابية قبل الحفظ النهائي
    if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
    }

    if (typeof window.NHP_setBatchProcessing === 'function') {
        window.NHP_setBatchProcessing(false);
    } else {
        if (typeof window.NHP_setBatchProcessing === 'function') window.NHP_setBatchProcessing(false);
        else window.isBatchProcessing = false;
    }
    if (typeof window.NHP_markStorageEchoSuppress === 'function') {
        window.NHP_markStorageEchoSuppress(1200);
    }
    renderQueue();
    await saveQueueToStorage(true);
    renderQueue();
    const uploadMsgEl = document.getElementById('seo-upload-msg');
    if (uploadMsgEl) uploadMsgEl.textContent = `تم إضافة ${queue.length} تصميم`;
}

async function fetchLocalLibraryTagsViaBackground(keyword) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'fetch_bubblespider_style_tags',
            keyword,
            tagCount: SEO_LOCAL_LIBRARY_TAG_COUNT,
            resultsLimit: SEO_BUBBLESPIDER_RESULTS_LIMIT
        }, (res) => {
            if (chrome.runtime.lastError || !res?.success || !Array.isArray(res.tags)) {
                resolve([]);
                return;
            }
            resolve(res.tags);
        });
    });
}

async function fetchBubbleSpiderLibraryTags(query) {
    try {
        const tags = await generateBubbleSpiderStyleTags(query, {
            tagCount: SEO_LOCAL_LIBRARY_TAG_COUNT,
            resultsLimit: SEO_BUBBLESPIDER_RESULTS_LIMIT
        });
        if (tags?.length) return tags;
    } catch (error) {
        console.warn('BubbleSpider tags (SEO module) failed:', error);
    }
    return fetchLocalLibraryTagsViaBackground(query);
}

async function fetchDatamuseBackupTags(query) {
    try {
        const datamuseUrl = `https://api.datamuse.com/words?ml=${encodeURIComponent(query)}&max=24`;
        const res = await fetch(datamuseUrl);
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((item) => item.word).filter(Boolean);
    } catch (error) {
        console.warn('Datamuse backup tags failed (offline/network):', error?.message || error);
        return [];
    }
}

/** Build tag candidates from niche/keyword words when external APIs are unreachable. */
function buildOfflineKeywordTags(query) {
    const cleaned = String(query || '').trim().toLowerCase();
    if (!cleaned) return [];

    const words = cleaned
        .split(/[\s,;|/\\\-_.]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2);

    const tags = [];
    const seen = new Set();
    const push = (tag) => {
        const t = String(tag || '').trim().toLowerCase();
        if (!t || t.length < 3 || seen.has(t)) return;
        seen.add(t);
        tags.push(t);
    };

    push(cleaned);
    words.forEach(push);
    for (let i = 0; i < words.length - 1; i += 1) {
        push(`${words[i]} ${words[i + 1]}`);
    }
    return tags;
}

function nicheAppearsInText(text, nichePhrase) {
    const hay = String(text || '').toLowerCase();
    const needle = String(nichePhrase || '').toLowerCase().trim();
    if (!needle || !hay) return false;
    if (hay.includes(needle)) return true;
    const words = needle.split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) return hay.includes(needle);
    return words.every((w) => hay.includes(w));
}

function ensureNicheRepeatedInFourFields(meta, nichePhrase) {
    const niche = cleanNicheName(nichePhrase || meta.primary_keyword || 'Design');
    const nicheLower = niche.toLowerCase();
    const mainTag = sanitizeMainTag(nicheLower);

    let title = sanitizeSeoTitle(meta.title, niche);
    if (!nicheAppearsInText(title, niche)) {
        title = sanitizeSeoTitle(`${niche} — ${title}`, niche);
    }

    let description = String(meta.description || '').trim();
    if (!nicheAppearsInText(description, niche)) {
        description = `${niche} — ${description}`.replace(/\s+/g, ' ').trim();
    }
    description = description.slice(0, 240);

    let tags = Array.isArray(meta.tags) ? [...meta.tags] : [];
    tags = [nicheLower, ...tags.filter((t) => String(t).toLowerCase() !== nicheLower)];
    tags = ensureExactlyFifteenTags(tags, niche, title, mainTag);

    return {
        ...meta,
        title,
        main_tag: mainTag,
        description,
        tags,
        primary_keyword: niche
    };
}

function isLocalLibraryGenericTag(tag, preferredKeyword = '') {
    const normalized = String(tag || '').trim().toLowerCase();
    if (!normalized) return false;
    const pk = String(preferredKeyword || '').trim().toLowerCase();
    if (pk && (normalized === pk || normalized.includes(pk))) return false;
    return SEO_LOCAL_LIBRARY_GENERIC_TAG_BLOCKLIST.has(normalized);
}

function filterLocalLibraryBannedProductTags(tags, preferredKeyword) {
    const pk = String(preferredKeyword || '').toLowerCase();
    return (Array.isArray(tags) ? tags : [])
        .map((t) => String(t || '').trim())
        .filter((t) => t.length > 2)
        .filter((t) => !SEO_LOCAL_LIBRARY_BANNED_PRODUCT_KEYWORDS.some(
            (b) => t.toLowerCase().includes(b) && !pk.includes(b)
        ));
}

function filterLocalLibraryGenericTags(tags, preferredKeyword, minCount = SEO_LOCAL_LIBRARY_TAG_COUNT) {
    const list = (Array.isArray(tags) ? tags : [])
        .map((t) => String(t || '').trim())
        .filter((t) => t.length > 2);
    const nicheTags = [];
    const genericTags = [];

    list.forEach((tag) => {
        if (isLocalLibraryGenericTag(tag, preferredKeyword)) {
            genericTags.push(tag);
        } else {
            nicheTags.push(tag);
        }
    });

    const result = [...nicheTags];
    const seen = new Set(result.map((t) => t.toLowerCase()));
    for (const tag of genericTags) {
        if (result.length >= minCount) break;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(tag);
    }
    return result;
}

function padLocalLibraryTagsToCount(tags, preferredKeyword, targetCount = SEO_LOCAL_LIBRARY_TAG_COUNT) {
    const result = [...tags];
    const seen = new Set(result.map((t) => t.toLowerCase()));
    const push = (tag) => {
        const value = String(tag || '').trim();
        const key = value.toLowerCase();
        if (!value || value.length <= 2 || seen.has(key)) return;
        seen.add(key);
        result.push(value);
    };

    buildOfflineKeywordTags(preferredKeyword).forEach(push);
    for (let i = 0; i < SEO_LOCAL_LIBRARY_GENERIC_PADDING_TAGS.length && result.length < targetCount; i += 1) {
        push(SEO_LOCAL_LIBRARY_GENERIC_PADDING_TAGS[i]);
    }
    return result;
}

function pickLocalLibraryClassicTitleSuffix(preferredKeyword) {
    const seed = `${preferredKeyword}|${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return SEO_LOCAL_LIBRARY_TITLE_SUFFIXES[Math.abs(hash) % SEO_LOCAL_LIBRARY_TITLE_SUFFIXES.length];
}

function buildLocalLibraryClassicCopy(preferredKeyword, finalTags, isImageOnly, titleSuffix = null) {
    const suffix = titleSuffix || pickLocalLibraryClassicTitleSuffix(preferredKeyword);
    const title = sanitizeSeoTitle(`${preferredKeyword} ${suffix}`, preferredKeyword);
    const description = isImageOnly
        ? `A design perfect for those who love unique and creative aesthetics. This high-quality graphic features elements related to ${finalTags.slice(0, 3).join(', ')}, making it an ideal choice to express your style.`
        : `${preferredKeyword} design perfect for those who love unique and creative aesthetics. This high-quality graphic features elements related to ${finalTags.slice(1, 4).join(', ')}, making it an ideal choice to express your style.`;
    return { title, description };
}

function buildLocalLibraryAiCopyPrompt(niche, primaryKeyword, finalTags, noteContext) {
    const cleanNiche = cleanNicheName(noteContext?.effectiveNiche || niche || 'Design');
    const cleanPrimary = extractPrimaryKeywordFromFilename(primaryKeyword) || cleanNiche;
    const tagHint = (finalTags || []).slice(0, 8).join(', ');
    const noteGuidance = buildNoteNicheSeoGuidanceBlock(noteContext);

    return `Generate a unique POD title, description, and 15 tags for TeePublic/Redbubble.

Text-only request — infer from the niche and keyword below (no image attached).

Niche (MUST appear naturally in title AND description; niche should be first tag):
${cleanNiche}

Primary keyword (highest priority — repeat in title and description):
${cleanPrimary}

Reference tags from local library (context only — generate fresh niche-specific tags):
${tagHint}
${noteGuidance}

Rules:
- English only
- Generate title, description, and exactly 15 comma-separated tags
- Title max 90 characters, buyer-friendly, varied and distinctive
- Description max 240 characters, natural prose for fans and collectors
- Tags: exactly 15, comma-separated, lowercase, niche-specific, no duplicates
- The niche phrase "${cleanPrimary}" MUST appear naturally in BOTH title and description
- Do not use product words: shirt, hoodie, mug, sticker, poster, case, print
- Do not add text outside the marker format

Fill these markers only:
[SEO_TITLE][/SEO_TITLE]
[SEO_DESCRIPTION][/SEO_DESCRIPTION]
[SEO_TAGS][/SEO_TAGS]`;
}

function sanitizeLocalLibraryAiTags(rawTags, preferredKeyword, niche, title, isImageOnly = false) {
    let tags = (Array.isArray(rawTags) ? rawTags : [])
        .map((tag) => String(tag || '').trim())
        .filter((tag) => tag.length > 2);

    tags = filterLocalLibraryBannedProductTags(tags, preferredKeyword);
    tags = filterLocalLibraryGenericTags(tags, preferredKeyword, SEO_LOCAL_LIBRARY_TAG_COUNT);

    if (!isImageOnly && preferredKeyword) {
        const pk = preferredKeyword.toLowerCase();
        tags = [preferredKeyword, ...tags.filter((t) => String(t).toLowerCase() !== pk)];
    }

    if (tags.length < SEO_LOCAL_LIBRARY_AI_TAGS_MIN_VALID) return null;

    if (tags.length < SEO_LOCAL_LIBRARY_TAG_COUNT) {
        tags = padLocalLibraryTagsToCount(tags, preferredKeyword, SEO_LOCAL_LIBRARY_TAG_COUNT);
    }

    const mainTag = sanitizeMainTag(preferredKeyword.toLowerCase());
    tags = ensureExactlyFifteenTags(tags, niche, title, mainTag);
    return tags.length >= SEO_LOCAL_LIBRARY_TAG_COUNT ? tags : null;
}

function parseLocalLibraryAiTagsFromResponse(rawText, preferredKeyword, niche = '', title = '', isImageOnly = false) {
    const text = String(rawText?.result || rawText || '').trim();
    if (!text) return null;

    const tagsRaw = cleanSeoFieldValue(
        extractMarkerValueOpen(text, 'SEO_TAGS')
            || extractLooseSeoField(text, ['SEO_TAGS', 'SEO Tags', 'Tags']),
        'tags'
    );
    if (!tagsRaw) return null;

    const rawTags = tagsRaw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

    return sanitizeLocalLibraryAiTags(rawTags, preferredKeyword, niche, title, isImageOnly);
}

function parseLocalLibraryAiCopyResponse(rawText, niche, primaryKeyword, options = {}) {
    const { isImageOnly = false } = options;
    const text = String(rawText?.result || rawText || '').trim();
    if (!text) return null;

    const title = cleanSeoFieldValue(
        extractMarkerValueOpen(text, 'SEO_TITLE')
            || extractLooseSeoField(text, ['SEO_TITLE', 'SEO Title', 'Title']),
        'title'
    );
    const descriptionRaw = extractMarkerValueOpen(text, 'SEO_DESCRIPTION')
        || extractLooseSeoField(text, ['SEO_DESCRIPTION', 'SEO Description', 'Description']);
    const description = cleanSeoDescriptionText(descriptionRaw, niche);

    if (!title) return null;
    if (isPlaceholderSeoMeta({ title, main_tag: 'ok', tags: ['a', 'b', 'c'], description })) return null;
    if (!description) return null;

    const resolvedTitle = sanitizeSeoTitle(title, primaryKeyword || niche);
    const tags = parseLocalLibraryAiTagsFromResponse(
        text,
        primaryKeyword,
        niche,
        resolvedTitle,
        isImageOnly
    );

    return {
        title: resolvedTitle,
        description,
        ...(tags ? { tags } : {})
    };
}

function parseLocalLibraryAiCopyFromApiResult(apiResult, niche, primaryKeyword, options = {}) {
    const { isImageOnly = false } = options;
    if (!apiResult || apiResult.error) return null;
    const meta = apiResult.meta;
    if (meta?.title && meta?.description) {
        const title = sanitizeSeoTitle(meta.title, primaryKeyword || niche);
        const description = String(meta.description || '').trim().slice(0, 240);
        if (title && description && !isPlaceholderSeoMeta({ title, main_tag: 'ok', tags: ['a', 'b', 'c'], description })) {
            const tags = Array.isArray(meta.tags) && meta.tags.length
                ? sanitizeLocalLibraryAiTags(meta.tags, primaryKeyword, niche, title, isImageOnly)
                : parseLocalLibraryAiTagsFromResponse(
                    meta.result || apiResult.data?.result || apiResult.data,
                    primaryKeyword,
                    niche,
                    title,
                    isImageOnly
                );
            return {
                title,
                description,
                ...(tags ? { tags } : {})
            };
        }
    }
    const raw = meta?.result || apiResult.data?.result || apiResult.data;
    if (raw) return parseLocalLibraryAiCopyResponse(raw, niche, primaryKeyword, { isImageOnly });
    return null;
}

async function isLocalLibraryAiCopyAvailable() {
    const keys = await getStoredSeoAiKeys();
    const creds = await resolveSeoActiveApiCredentials();
    return !!(creds.apiKey || creds.gpt || keys.gpt
        || creds.endpoints?.some((item) => item.apiKey || /8317/.test(item.baseUrl || '')));
}

async function requestSingleLocalLibraryAiCopyAttempt(prompt, niche, isImageOnly, primaryKeyword, routingOptions) {
    if (!(await isLocalLibraryAiCopyAvailable())) return null;

    const gptRes = await callGptApiCore(prompt, null, niche, isImageOnly, primaryKeyword, routingOptions);
    const copy = parseLocalLibraryAiCopyFromApiResult(gptRes, niche, primaryKeyword, { isImageOnly });
    if (copy) return { ...copy, aiSource: gptRes.meta?.source || 'local-library-gpt' };
    return null;
}

async function generateLocalLibraryAiCopyWithRetries(prompt, niche, isImageOnly, primaryKeyword, routingOptions = {}) {
    if (!(await isLocalLibraryAiCopyAvailable())) return null;

    let lastError = '';
    let delayMs = SEO_LOCAL_LIBRARY_AI_RETRY_INITIAL_DELAY_MS;

    for (let attempt = 1; attempt <= SEO_LOCAL_LIBRARY_AI_MAX_ATTEMPTS; attempt += 1) {
        if (attempt > 1) {
            await seoSleepMs(delayMs);
            delayMs = Math.min(
                SEO_LOCAL_LIBRARY_AI_RETRY_MAX_DELAY_MS,
                Math.round(delayMs * 1.45)
            );
        }
        try {
            const copy = await requestSingleLocalLibraryAiCopyAttempt(
                prompt,
                niche,
                isImageOnly,
                primaryKeyword,
                routingOptions
            );
            if (copy?.title && copy?.description) {
                return { ...copy, attempts: attempt };
            }
            lastError = 'empty_ai_copy';
        } catch (err) {
            lastError = err?.message || String(err);
            console.warn(`Local library AI copy attempt ${attempt}/${SEO_LOCAL_LIBRARY_AI_MAX_ATTEMPTS} failed:`, lastError);
        }
    }

    console.warn(
        `Local library AI copy failed after ${SEO_LOCAL_LIBRARY_AI_MAX_ATTEMPTS} attempts — using classic template.`,
        lastError
    );
    return null;
}

/**
 * Local library SEO: BubbleSpider / Redbubble tag generator (top 15), Datamuse as backup.
 * Title/description/tags: NHP API text-only (5 retries), then classic/library fallback per field.
 */
async function generateFallbackSEO(niche, isImageOnly = false, fallbackReason = 'unknown', primaryKeyword = '', options = {}) {
    const {
        noteContext = null,
        routingOptions = {},
        imageTitleHint = ''
    } = options;

    try {
        const preferredKeyword = extractPrimaryKeywordFromFilename(primaryKeyword) || cleanNicheName(niche);
        const query = isImageOnly ? (preferredKeyword || 'creative design') : preferredKeyword;
        console.log(`📚 Fetching BubbleSpider-style tags for: ${query}`);

        let tags = await fetchBubbleSpiderLibraryTags(query);
        let tagSource = 'local-library-redbubble';

        if (!tags.length) {
            console.warn('BubbleSpider/Redbubble tags empty — falling back to Datamuse');
            tags = await fetchDatamuseBackupTags(query);
            tagSource = tags.length ? 'local-library-datamuse' : tagSource;
        }

        if (!tags.length) {
            console.warn('External tag APIs unreachable — using offline keyword tags');
            tags = buildOfflineKeywordTags(query);
            tagSource = 'local-library-offline';
        }

        if (!isImageOnly && preferredKeyword) {
            const pk = preferredKeyword.toLowerCase();
            tags = [preferredKeyword, ...tags.filter((t) => String(t).toLowerCase() !== pk)];
        }

        tags = filterLocalLibraryBannedProductTags(tags, preferredKeyword);
        tags = filterLocalLibraryGenericTags(tags, preferredKeyword, SEO_LOCAL_LIBRARY_TAG_COUNT);

        if (tags.length < SEO_LOCAL_LIBRARY_TAG_COUNT) {
            tags = padLocalLibraryTagsToCount(tags, preferredKeyword, SEO_LOCAL_LIBRARY_TAG_COUNT);
        }

        const classicTitleSuffix = pickLocalLibraryClassicTitleSuffix(preferredKeyword);
        const placeholderTitle = sanitizeSeoTitle(`${preferredKeyword} ${classicTitleSuffix}`, preferredKeyword);
        const libraryTags = ensureExactlyFifteenTags(
            tags,
            niche,
            placeholderTitle,
            preferredKeyword.toLowerCase()
        );

        const resolvedClassicCopy = buildLocalLibraryClassicCopy(preferredKeyword, libraryTags, isImageOnly, classicTitleSuffix);
        let title = resolvedClassicCopy.title;
        let description = resolvedClassicCopy.description;
        let resolvedTags = libraryTags;
        let aiCopyUsed = false;
        let aiTagsUsed = false;
        let aiCopyAttempts = 0;

        const resolvedNoteContext = noteContext
            || await resolveSeoNicheContext(imageTitleHint || primaryKeyword, niche);
        const aiPrompt = buildLocalLibraryAiCopyPrompt(
            niche,
            preferredKeyword,
            libraryTags,
            resolvedNoteContext
        );
        const aiCopy = await generateLocalLibraryAiCopyWithRetries(
            aiPrompt,
            niche,
            isImageOnly,
            preferredKeyword,
            routingOptions
        );

        if (aiCopy?.title && aiCopy?.description) {
            title = aiCopy.title;
            description = aiCopy.description;
            aiCopyUsed = true;
            aiCopyAttempts = aiCopy.attempts || 0;
        } else if (await isLocalLibraryAiCopyAvailable()) {
            console.warn('Local library AI copy unavailable after retries — classic title/description applied.');
        }

        if (Array.isArray(aiCopy?.tags) && aiCopy.tags.length >= SEO_LOCAL_LIBRARY_TAG_COUNT) {
            resolvedTags = aiCopy.tags;
            aiTagsUsed = true;
        } else if (aiCopyUsed) {
            console.warn('Local library AI tags invalid or insufficient after filter — using library tags.');
        }

        const merged = ensureNicheRepeatedInFourFields({
            title,
            main_tag: sanitizeMainTag(preferredKeyword.toLowerCase()),
            tags: resolvedTags,
            description,
            primary_keyword: preferredKeyword
        }, preferredKeyword || niche);

        let resolvedSource = tagSource;
        if (aiTagsUsed) resolvedSource = `${tagSource}-ai-tags`;
        else if (aiCopyUsed) resolvedSource = `${tagSource}-ai`;

        const result = buildSeoFallbackResult(niche, isImageOnly, {
            ...merged,
            source: resolvedSource,
            ai_copy: aiCopyUsed,
            ai_tags: aiTagsUsed,
            ai_copy_attempts: aiCopyAttempts
        }, fallbackReason);

        if (tagSource === 'local-library-offline' && typeof showToast !== 'undefined') {
            showToast('📡 لا اتصال بـ Redbubble/Datamuse — تم توليد SEO محلياً');
        }

        return result;
    } catch (e) {
        console.error('❌ Local library SEO failed:', e);
        // Last-resort: never return null when local library is selected — keyword/generic tags still work offline.
        try {
            const preferredKeyword = extractPrimaryKeywordFromFilename(primaryKeyword) || cleanNicheName(niche);
            const recoverySuffix = pickLocalLibraryClassicTitleSuffix(preferredKeyword);
            const offlineTags = ensureExactlyFifteenTags(
                padLocalLibraryTagsToCount(
                    filterLocalLibraryGenericTags(buildOfflineKeywordTags(preferredKeyword), preferredKeyword),
                    preferredKeyword
                ),
                niche,
                sanitizeSeoTitle(`${preferredKeyword} ${recoverySuffix}`, preferredKeyword),
                preferredKeyword.toLowerCase()
            );
            const classicCopy = buildLocalLibraryClassicCopy(preferredKeyword, offlineTags, isImageOnly, recoverySuffix);
            const merged = ensureNicheRepeatedInFourFields({
                title: classicCopy.title,
                main_tag: sanitizeMainTag(preferredKeyword.toLowerCase()),
                tags: offlineTags,
                description: classicCopy.description,
                primary_keyword: preferredKeyword,
                source: 'local-library-offline'
            }, preferredKeyword || niche);
            return buildSeoFallbackResult(niche, isImageOnly, {
                ...merged,
                ai_copy: false,
                ai_copy_attempts: 0
            }, `${fallbackReason}_offline_recovery`);
        } catch {
            return null;
        }
    }
}

/**
 * Call Gemini API for SEO Generation (Multimodal)
 */
async function callGeminiSEO(niche, base64 = null, isImageOnly = false, imageTitleHint = '', primaryKeyword = '', routingOptions = {}) {
    const noteContext = await resolveSeoNicheContext(imageTitleHint || primaryKeyword, niche);
    const effectiveNiche = noteContext.effectiveNiche || niche;
    const prompt = buildStructuredSeoPrompt(effectiveNiche, isImageOnly, !!base64, imageTitleHint, primaryKeyword, noteContext);
    const provider = await resolveSeoActiveProvider(routingOptions);
    const windowFallbackEnabled = await isSeoAiWindowModeEnabled();

    if (isLocalLibraryProvider(provider)) {
        const libraryMeta = await generateFallbackSEO(
            effectiveNiche,
            isImageOnly,
            'local_library_selected',
            primaryKeyword,
            { noteContext, routingOptions, imageTitleHint }
        );
        if (libraryMeta && typeof showToast !== 'undefined') {
            const tagLabel = libraryMeta.ai_tags ? 'AI' : 'BubbleSpider';
            const aiNote = libraryMeta.ai_copy
                ? ` + NHP API (محاولة ${libraryMeta.ai_copy_attempts || 1})`
                : '';
            showToast(`📚 مكتبة محلية: 15 تاج ${tagLabel}${aiNote}`);
        }
        return libraryMeta;
    }

    if (provider === SEO_PROVIDERS.GEMINI_WEB) {
        const windowMeta = await trySeoAiWindowFallback(prompt, base64, effectiveNiche, isImageOnly, primaryKeyword, true);
        if (windowMeta) {
            if (typeof showToast !== 'undefined') {
                const sourceMeta = getSeoSourceMeta(windowMeta.source || 'gemini-web');
                showToast(`🤖 SEO provider: ${sourceMeta.label}`);
            }
            return windowMeta;
        }
        return await generateFallbackSEO(effectiveNiche, isImageOnly, 'gemini_web_failed', primaryKeyword);
    }

    if (!isApiProvider(provider)) {
        const windowMeta = await trySeoAiWindowFallback(prompt, base64, effectiveNiche, isImageOnly, primaryKeyword, true);
        if (windowMeta) return windowMeta;
        return await generateFallbackSEO(effectiveNiche, isImageOnly, 'unknown_provider', primaryKeyword);
    }

    if (provider === SEO_PROVIDERS.GPT_API) {
        const apiResult = await callSeoApiByProvider(provider, prompt, base64, effectiveNiche, isImageOnly, primaryKeyword, routingOptions);
        if (apiResult?.meta) {
            if (typeof showToast !== 'undefined') {
                const sourceMeta = getSeoSourceMeta(apiResult.meta.source || provider);
                showToast(`🤖 SEO provider: ${sourceMeta.label}`);
            }
            return apiResult.meta;
        }
        // Preserve the real error from the API/parser — throw so it reaches
        // processSingleItemWithRetry's catch and is stored in item._seoLastError.
        const responseError = apiResult?.error || 'NHP API request failed';
        console.error('[SEO-GPT-API] Generation failed:', responseError);
        throw new Error(responseError);
    }

    try {
        const apiResult = await callSeoApiByProvider(provider, prompt, base64, effectiveNiche, isImageOnly, primaryKeyword, routingOptions);
        if (apiResult?.meta) {
            if (typeof showToast !== 'undefined') {
                const sourceMeta = getSeoSourceMeta(apiResult.meta.source || provider);
                showToast(`🤖 SEO provider: ${sourceMeta.label}`);
            }
            return apiResult.meta;
        }

        const responseError = apiResult?.error || 'API request failed';
        console.error('SEO API error:', provider, responseError);

        if (provider === SEO_PROVIDERS.GEMINI_API) {
            if (isGeminiRateLimitError(responseError)) {
                activateGeminiCooldown();
                if (typeof showToast !== 'undefined') showToast(formatGeminiCooldownMessage());
            } else if (isGeminiAuthOrKeyError(responseError) && typeof showToast !== 'undefined') {
                showToast('⚠️ مفتاح Gemini غير صالح — محاولة النوافذ الاحتياطية...');
            }
        } else if (typeof showToast !== 'undefined') {
            const providerLabel = provider === SEO_PROVIDERS.GPT_API ? 'GPT' : 'Cursor';
            showToast(`⚠️ فشل ${providerLabel} API — محاولة النوافذ الاحتياطية...`);
        }

        if (windowFallbackEnabled) {
            const windowMeta = await trySeoAiWindowFallback(
                prompt,
                base64,
                effectiveNiche,
                isImageOnly,
                primaryKeyword,
                true
            );
            if (windowMeta) {
                if (typeof showToast !== 'undefined') {
                    const sourceMeta = getSeoSourceMeta(windowMeta.source || 'gemini-web');
                    showToast(`🤖 SEO provider: ${sourceMeta.label}`);
                }
                return windowMeta;
            }
        }

        const fallbackReason = provider === SEO_PROVIDERS.GEMINI_API && isGeminiRateLimitError(responseError)
            ? 'gemini_rate_limited'
            : `${provider.replace('-', '_')}_failed`;
        return await generateFallbackSEO(effectiveNiche, isImageOnly, fallbackReason, primaryKeyword);
    } catch (err) {
        console.error('AI Engine Error:', err);
        const errMessage = err?.message || '';
        if (provider === SEO_PROVIDERS.GEMINI_API && isGeminiRateLimitError(errMessage)) {
            activateGeminiCooldown();
            if (typeof showToast !== 'undefined') showToast(formatGeminiCooldownMessage());
        } else if (typeof showToast !== 'undefined') {
            showToast('خطأ في محرك AI — محاولة النوافذ الاحتياطية...');
        }

        if (windowFallbackEnabled) {
            const windowMeta = await trySeoAiWindowFallback(prompt, base64, effectiveNiche, isImageOnly, primaryKeyword, true);
            if (windowMeta) return windowMeta;
        }

        return await generateFallbackSEO(
            effectiveNiche,
            isImageOnly,
            isGeminiRateLimitError(errMessage) ? 'gemini_rate_limited' : 'seo_engine_error',
            primaryKeyword
        );
    }
}

/**
 * AI Logic
 */
async function performComprehensiveAnalysis(niche, seed = 0, base64 = null, isImageOnly = false, imageTitleHint = '', primaryKeyword = '', routingOptions = {}) {
    return new Promise(async (resolve, reject) => {
        const activeProvider = await resolveSeoActiveProvider(routingOptions);
        const engineLabel = isLocalLibraryProvider(activeProvider)
            ? 'المكتبة المحلية'
            : 'محرك (AI Pro)';
        if (S.loading) {
            S.loading.innerHTML = `<div class="spinner-small" style="width:15px; height:15px; margin: 0 auto 5px;"></div> جاري تحليل ${base64 ? 'الصورة والنيتش' : 'النيتش'} عبر ${engineLabel}...`;
            S.loading.classList.remove('hidden');
        }
        
        // 1. Generate SEO via selected provider
        const resolvedPrimaryKeyword = extractPrimaryKeywordFromFilename(primaryKeyword) || cleanNicheName(niche);

        let meta;
        try {
            meta = await callGeminiSEO(niche, base64, isImageOnly, imageTitleHint, resolvedPrimaryKeyword, routingOptions);
        } catch (genErr) {
            // Real API/parser error thrown by callGeminiSEO — reject so processSingleItemWithRetry
            // stores the actual message in item._seoLastError instead of a generic fallback.
            console.error('[SEO] callGeminiSEO threw:', genErr?.message || genErr);
            return reject(genErr); // rejects the outer Promise → caught by processSingleItemWithRetry
        }
        
        let finalMeta = meta;

        // STRICT AI RULE: No local generic fallback
        if (!finalMeta) {
            console.error('❌ AI Generation failed for niche:', niche);
            if (S.loading) {
                S.loading.innerHTML = '<span class="text-red-500 font-bold">❌ فشل محرك AI في الاستجابة</span>';
            }
            setTimeout(() => {
                if (S.loading) S.loading.classList.add('hidden');
                showToast(`❌ فشل التوليد! يرجى التحقق من المفتاح في الإعدادات أو قوة الاتصال.`);
            }, 3000);
            return resolve(null);
        }

        const googleAiReviewEnabled = document.getElementById('seo-google-ai-review')?.checked === true
            || document.getElementById('ap-google-ai-review')?.checked === true
            || await isGoogleAiSeoReviewEnabled();
        if (googleAiReviewEnabled) {
            try {
                if (S.loading) {
                    S.loading.innerHTML = '<div class="spinner-small" style="width:15px; height:15px; margin: 0 auto 5px;"></div> مراجعة اختيارية عبر Google AI Mode...';
                }
                const reviewedMeta = await callGoogleAiSeoReview(niche, finalMeta, base64, resolvedPrimaryKeyword);
                if (reviewedMeta) {
                    finalMeta = reviewedMeta;
                    if (typeof showToast !== 'undefined') showToast('Google AI Review حسّن نتيجة SEO');
                } else if (typeof showToast !== 'undefined') {
                    showToast('Google AI Review لم يرجع صيغة صالحة، تم إبقاء نتيجة Gemini');
                }
            } catch (reviewError) {
                console.warn('Google AI SEO review skipped:', reviewError?.message || reviewError);
                if (typeof showToast !== 'undefined') showToast('تعذر Google AI Review، تم إبقاء نتيجة Gemini');
            }
        }

        // 2. Intelligence Verification: Clean and prepare tags
        let combinedTags = [...(finalMeta.tags || [])];

        const forceNiche = document.getElementById('seo-force-niche')?.checked !== false;

        // 3. Prepare tags for TMH verification (Top 20 from AI)
        const tagsToVerify = combinedTags.slice(0, 20);

        const bypassTmh = await shouldBypassTmhVerification(activeProvider);

        const finalizeMeta = (safeTags) => {
            // 5. Final Merge & Priority
            if (forceNiche) {
                const cleanNiche = niche.toLowerCase().trim();
                safeTags = [cleanNiche, ...safeTags.filter(t => t !== cleanNiche)];
            }
            
            finalMeta.tags = ensureExactlyFifteenTags(
                [...new Set(safeTags || [])],
                niche,
                finalMeta.title || '',
                finalMeta.main_tag || ''
            );
            if (resolvedPrimaryKeyword) {
                const normalizedPrimary = resolvedPrimaryKeyword.toLowerCase();
                finalMeta.tags = [
                    normalizedPrimary,
                    ...finalMeta.tags.filter(tag => String(tag || '').toLowerCase() !== normalizedPrimary)
                ].slice(0, 15);
            }
            finalMeta.score = (finalMeta.tags.length > 10) ? "100" : "85";
            if (forceNiche && !String(finalMeta.main_tag || '').trim()) {
                finalMeta.main_tag = (resolvedPrimaryKeyword || niche).toLowerCase();
            }
            finalMeta.primary_keyword = resolvedPrimaryKeyword;

            if (finalMeta.title) {
                finalMeta.title = sanitizeSeoTitle(finalMeta.title, resolvedPrimaryKeyword || niche);
            }
            if (!finalMeta.description) finalMeta.description = `Exclusive ${niche} artwork for fans.`;

            if (S.loading) {
                S.loading.innerHTML = '<div class="spinner-small" style="width:15px; height:15px; margin: 0 auto 5px;"></div> جاري إنهاء المزامنة...';
            }
            
            if (resolvedPrimaryKeyword && typeof showToast !== 'undefined') {
                showToast(`🔑 الكلمة المفتاحية الأساسية: ${resolvedPrimaryKeyword}`);
            }
            setTimeout(() => resolve(finalMeta), 300);
        };

        if (bypassTmh) {
            finalizeMeta(tagsToVerify);
            return;
        }

        if (S.loading) {
            S.loading.innerHTML = '<div class="spinner-small" style="width:15px; height:15px; margin: 0 auto 5px;"></div> جاري فحص الملكية الفكرية (TMH)...';
        }

        const tmhRes = await sendSeoApiBridgeMessage(
            { action: 'TMH_VERIFY_TAGS', tags: tagsToVerify },
            SEO_TMH_VERIFY_TIMEOUT_MS
        );
        const finalSafeTags = (tmhRes && tmhRes.success && Array.isArray(tmhRes.safeTags))
            ? tmhRes.safeTags
            : tagsToVerify;
        finalizeMeta(finalSafeTags);
    });
}

function updatePreviewFields(meta) {
    if (!S.titleEl) return;
    
    // Explicit UI Reset: If no metadata exists, clear everything to avoid "sticking" data from previous designs
    if (!meta) {
        S.titleEl.value = "";
        S.mainTagEl.value = "";
        if (S.descEl) S.descEl.value = "";
        if (S.tagsEl) S.tagsEl.value = "";
        if (S.scoreEl) S.scoreEl.textContent = "0";
        if (S.riskEl) S.riskEl.textContent = "Low";
        if (S.tagsCountEl) S.tagsCountEl.textContent = "0";
        updateSeoSourceBadge('');
        return;
    }
    
    const title = meta.title || meta.Title || '';
    const mainTag = sanitizeMainTag(meta.main_tag || meta.mainTag || meta.MainTag || (Array.isArray(meta.tags) ? meta.tags[0] : ''));
    const description = meta.description || meta.Description || meta.desc || meta.Desc || '';
    const tagsArr = Array.isArray(meta.tags) ? meta.tags : (typeof meta.tags === 'string' ? meta.tags.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean) : []);
    const score = meta.score || meta.Score || meta.seo_score || '0';
    const risk = meta.risk || meta.Risk || 'Low';
    const suggestedNiche = meta.suggested_niche || meta.suggestedNiche || '';
    const source = meta.source || meta.Source || '';

    if (S.titleEl) S.titleEl.value = title;
    if (S.mainTagEl) S.mainTagEl.value = mainTag;
    if (S.descEl) S.descEl.value = description;
    if (S.tagsEl) S.tagsEl.value = tagsArr.join(', ');
    if (S.scoreEl) S.scoreEl.textContent = score || '0';
    if (S.riskEl) S.riskEl.textContent = risk || 'Low';
    
    const count = tagsArr.length;
    if (S.tagsCountEl) S.tagsCountEl.textContent = count;
    
    const labelCount = document.getElementById('seo-label-tags-count');
    if (labelCount) labelCount.textContent = count;
    updateSeoSourceBadge(meta.is_fallback ? 'local-library' : source);
    const badge = document.getElementById('seo-source-badge');
    if (badge) {
        badge.title = meta.is_fallback
            ? (meta.ai_copy
                ? 'مصدر: مكتبة محلية + AI — تاجات BubbleSpider وعنوان/وصف ذكي'
                : 'مصدر: مكتبة محلية (BubbleSpider / Redbubble) — عنوان/وصف بالقالب الأصلي')
            : `SEO Source: ${getSeoSourceMeta(source).label}`;
    }

    if (suggestedNiche && S.nicheSelect) {
        const hasOption = Array.from(S.nicheSelect.options || []).some((option) => option.value === suggestedNiche);
        if (!hasOption) {
            const option = document.createElement('option');
            option.value = suggestedNiche;
            option.textContent = `${suggestedNiche} (Suggested)`;
            S.nicheSelect.appendChild(option);
        }
        S.nicheSelect.value = suggestedNiche;
    }
    
    if (S.tpBtn) S.tpBtn.disabled = !title;
    saveSeoFields();
    const activeId = S.queueList?.querySelector('.queue-item.active')?.dataset?.id
        || document.querySelector('#ap-queue .queue-item.active')?.getAttribute('data-id');
    if (activeId && typeof window.NHP_refreshQueueLightbox === 'function') {
        window.NHP_refreshQueueLightbox(activeId);
    }
}

/**
 * Storage & Persistency
 */
function saveSeoFields(immediate = false) {
    clearTimeout(seoFieldSaveTimer);
    if (immediate) {
        persistSeoFieldsNow();
        return;
    }
    seoFieldSaveTimer = setTimeout(() => {
        persistSeoFieldsNow();
    }, SEO_FIELD_SAVE_DEBOUNCE_MS);
}

function persistSeoFieldsNow() {
    if (window.isBatchProcessing) return; // Prevent overwriting during bulk generation
    if (!S.titleEl || !S.mainTagEl || !S.tagsEl || !S.descEl) return;
    const activeEl = S.queueList?.querySelector('.queue-item.active');
    const queue = getDesignQueue();
    const currentId = activeEl ? activeEl.dataset.id : (queue[0]?.id);
    if (!currentId) return;
    const item = queue.find(i => i.id === currentId);
    if (!item) return;
    const fields = {
        title: S.titleEl.value,
        mainTag: sanitizeMainTag(S.mainTagEl.value),
        tags: S.tagsEl.value,
        desc: S.descEl.value,
        score: S.scoreEl?.textContent || '0',
        risk: S.riskEl?.textContent || 'Low',
        tagsCount: S.tagsCountEl?.textContent || '0'
    };
    if (S.mainTagEl && S.mainTagEl.value !== fields.mainTag) S.mainTagEl.value = fields.mainTag;
    chrome.storage.local.set({ savedSeoFields: fields });
    if (item) {
        item.meta = { ...item.meta, title: fields.title, main_tag: fields.mainTag, tags: fields.tags, description: fields.desc, score: fields.score, risk: fields.risk };
        saveQueueToStorage();
        if (typeof window.NHP_refreshQueueLightbox === 'function') {
            window.NHP_refreshQueueLightbox(currentId);
        }
    }
}

function restoreSeoFields() {
    chrome.storage.local.get(['savedSeoFields'], function (result) {
        if (result.savedSeoFields) {
            if (S.titleEl) S.titleEl.value = result.savedSeoFields.title || '';
            if (S.mainTagEl) S.mainTagEl.value = sanitizeMainTag(result.savedSeoFields.mainTag || '');
            if (S.tagsEl) S.tagsEl.value = result.savedSeoFields.tags || '';
            if (S.descEl) S.descEl.value = result.savedSeoFields.desc || '';
            if (S.scoreEl) S.scoreEl.textContent = result.savedSeoFields.score || '0';
            if (S.riskEl) S.riskEl.textContent = result.savedSeoFields.risk || 'Low';
            if (S.tagsCountEl) S.tagsCountEl.textContent = result.savedSeoFields.tagsCount || '0';
            const labelCount = document.getElementById('seo-label-tags-count');
            if (labelCount) labelCount.textContent = result.savedSeoFields.tagsCount || '0';
            if (S.titleEl?.value && S.tagsEl?.value && S.tpBtn) S.tpBtn.disabled = false;
        }
    });
}

/**
 * Actions
 */
function applyToAll(e) {
    const isAP = e?.target?.closest('#ap-seo-apply-all') || (document.querySelector('.tab-btn.active')?.id === 'tab-autopilot');
    const queue = getDesignQueue();
    if (queue.length === 0) return showToast('⚠️ القائمة فارغة! أضف تصاميم أولاً.');
    const meta = isAP ? {
        title: AP_SEO.title.value, main_tag: sanitizeMainTag(AP_SEO.mainTag.value),
        tags: AP_SEO.tags.value.split(',').map(t => t.trim()).filter(Boolean),
        description: AP_SEO.desc.value, score: '100', risk: 'Low'
    } : {
        title: S.titleEl.value, main_tag: sanitizeMainTag(S.mainTagEl.value),
        tags: S.tagsEl.value.split(',').map(t => t.trim()).filter(Boolean),
        description: S.descEl.value, score: S.scoreEl?.textContent || '0', risk: S.riskEl?.textContent || 'Low'
    };
    if (!meta.title) return showToast('⚠️ يرجى تعبئة البيانات أولاً قبل النسخ');
    queue.forEach(item => { item.meta = mergeSeoMetaForItem(item, meta); item.status = 'done'; });
    renderQueue(); saveQueueToStorage();
    showToast(isAP ? '✅ تم استنساخ البيانات لجميع التصاميم في Autopilot' : '✅ تم استنساخ البيانات لجميع التصاميم بنجاح');
}

// Manual focus removed to prioritize AI generation

/**
 * TeePublic Automation Logic
 */
function waitForMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendMessageToTab(tabId, payload) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, payload, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve({ ok: true, response });
        });
    });
}

function readLocalStorage(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function writeLocalStorage(values) {
    return new Promise(resolve => chrome.storage.local.set(values, resolve));
}

function buildTeePublicJobId(item, index) {
    const raw = String(item?.id || item?.file?.name || item?.meta?.title || `design-${index + 1}`);
    const safe = raw.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || `design-${index + 1}`;
    return `tp-${safe}-${Date.now()}-${index + 1}`;
}

async function waitForTeePublicFillAcceptance(tabId, data, timeoutMs = 45000) {
    const startedAt = Date.now();
    const acceptedStatuses = new Set(['started', 'in_progress', 'busy', 'already_completed']);
    let lastResponse = null;

    while ((Date.now() - startedAt) < timeoutMs) {
        const result = await sendMessageToTab(tabId, data);
        if (result.ok) {
            lastResponse = result.response || null;
            if (acceptedStatuses.has(lastResponse?.status)) {
                return { accepted: true, response: lastResponse };
            }
        }
        await waitForMs(2000);
    }

    return { accepted: false, response: lastResponse };
}

async function waitForTeePublicJobReady(tabId, jobId, timeoutMs = 180000) {
    const startedAt = Date.now();

    while ((Date.now() - startedAt) < timeoutMs) {
        const storageState = await readLocalStorage(['tpReadyForNext', 'tpLastUploadJobId', 'tpActiveUploadJobId']);
        if (storageState.tpReadyForNext === true && storageState.tpLastUploadJobId === jobId) {
            return { status: 'ready' };
        }

        if (storageState.tpReadyForNext === true && storageState.tpLastUploadJobId && storageState.tpLastUploadJobId !== jobId) {
            throw new Error(`Another TeePublic job completed instead of ${jobId} (${storageState.tpLastUploadJobId})`);
        }

        const statusResult = await sendMessageToTab(tabId, { action: 'tp_upload_status', jobId });
        if (statusResult.ok && statusResult.response?.status === 'failed') {
            throw new Error(statusResult.response.lastError || `TeePublic job failed (${jobId})`);
        }

        await waitForMs(2000);
    }

    return { status: 'timeout' };
}

async function startTeePublicAutomation() {
    if (window.isSeoProcessing) return;
    const queue = getDesignQueue();
    if (queue.length === 0) {
        const metaFallback = { title: S.titleEl.value, main_tag: sanitizeMainTag(S.mainTagEl.value), description: S.descEl.value, tags: S.tagsEl.value.split(',').map(t => t.trim()).filter(Boolean) };
        if (!metaFallback.title) return showToast('⚠️ يرجى توليد أو كتابة العنوان أولاً');
        showToast('🚀 جاري بدء الأتمتة لـ TeePublic (وضع النص)...');
        chrome.tabs.query({ url: '*://www.teepublic.com/*' }, (tabs) => {
            const existingTabs = tabs.filter(t => t.url.includes('/edit') || t.url.includes('/new') || t.url.includes('/upload') || t.url.includes('/quick_create'));
            if (existingTabs.length > 0) {
                chrome.tabs.sendMessage(existingTabs[0].id, { ...metaFallback, submit: document.getElementById('seo-auto-submit').checked, defaultColor: document.querySelector('input[name="seo-default-color"]:checked')?.value || 'Black', action: 'tp_fill_form', jobId: buildTeePublicJobId({ id: 'manual-existing-tab', meta: metaFallback }, 0) });
                showToast(`✅ تم إرسال البيانات للتبويب المفتوح`);
            } else showToast('⚠️ لم يتم العثور على صفحة رفع TeePublic مفتوحة');
        });
        return;
    }

    window.isSeoProcessing = true; S.tpBtn.disabled = true; S.stopBtn.classList.remove('hidden');
    showToast('🚀 جاري بدء الأتمتة الشاملة لـ TeePublic...');
    const seoReadyQueue = queue.filter(item => item.meta);
    if (seoReadyQueue.length === 0) {
        window.isSeoProcessing = false; S.tpBtn.disabled = false; S.stopBtn.classList.add('hidden');
        return showToast('⚠️ لم يتم العثور على بيانات SEO للتصاميم!');
    }
    const defaultColor = document.querySelector('input[name="seo-default-color"]:checked')?.value || 'Black';
    const autoSubmit = document.getElementById('seo-auto-submit').checked;

    for (let i = 0; i < seoReadyQueue.length; i++) {
        if (!window.isSeoProcessing) break;
        const item = seoReadyQueue[i];
        const itemBase64 = await window.NHPDatabase.getImage(item.id); // استدعاء الصورة من الـ IndexedDB
        const jobId = buildTeePublicJobId(item, i);
        const data = { ...item.meta, imageData: itemBase64, submit: autoSubmit, defaultColor: defaultColor, action: 'tp_fill_form', jobId };
        showToast(`🚀 جاري فتح تبويب للتصميم (${i + 1} من ${seoReadyQueue.length})...`);
        await writeLocalStorage({ tpReadyForNext: false, tpActiveUploadJobId: jobId, tpLastUploadJobId: null });
        const tabId = await new Promise(resolve => {
            chrome.tabs.create({ url: 'https://www.teepublic.com/design/quick_create', active: false }, (newTab) => {
                resolve(newTab.id);
            });
        });
        try {
            const acceptance = await waitForTeePublicFillAcceptance(tabId, data, 45000);
            if (!acceptance.accepted) {
                throw new Error(`TeePublic tab did not accept job ${jobId}`);
            }

            const readyState = await waitForTeePublicJobReady(tabId, jobId, 180000);
            if (readyState.status !== 'ready') {
                throw new Error(`TeePublic job timed out (${jobId})`);
            }
        } finally {
            chrome.tabs.remove(tabId).catch(() => { });
        }
        await waitForMs(3000);
    }
    window.isSeoProcessing = false; S.tpBtn.disabled = false; S.stopBtn.classList.add('hidden');
    showToast('✅ اكتملت جميع عمليات الرفع!');
}

async function processSingleNicheNoImage(niche) {
    if (!S.loading) return;
    S.loading.classList.remove('hidden');
    try {
            const meta = await performComprehensiveAnalysis(niche, 0, null, false, niche, extractPrimaryKeywordFromFilename(niche));
        if (meta) { updatePreviewFields(meta); return meta; }
        else throw new Error('Comprehensive SEO generation failed');
    } catch (e) {
        console.error(e);
        showToast('⚠️ حدث خطأ أثناء التوليد: ' + e.message);
    } finally {
        S.loading.classList.add('hidden');
        if (S.tpBtn) S.tpBtn.disabled = false;
    }
}

function syncAPtoGlobal() {
    clearTimeout(apSyncTimer);
    apSyncTimer = setTimeout(() => {
        persistAPtoGlobalNow();
    }, SEO_FIELD_SAVE_DEBOUNCE_MS);
}

function persistAPtoGlobalNow() {
    if (window.isBatchProcessing) return; // Prevent overwriting during bulk generation
    const currentItemEl = document.querySelector('#ap-queue .queue-item.active');
    const queue = getDesignQueue();
    const currentId = currentItemEl ? currentItemEl.dataset.id : (queue[0]?.id);
    if (!currentId) return;
    const item = queue.find(i => i.id === currentId);
    if (!item) return;
    item.meta = mergeSeoMetaForItem(item, {
        title: AP_SEO.title.value, main_tag: sanitizeMainTag(AP_SEO.mainTag.value),
        tags: AP_SEO.tags.value.split(',').map(t => t.trim()).filter(Boolean),
        description: AP_SEO.desc.value, score: '100', risk: 'Low'
    });
    item.status = 'done';
    saveQueueToStorage();
}

function updateSeoNicheDropdown(niches) {
    if (!S.nicheSelect) return;
    const current = S.nicheSelect.value;
    S.nicheSelect.innerHTML = '<option value="">-- اختر نيتش --</option>' +
        (niches || []).map(n => {
            const safe = seoEscapeHtml(n);
            return `<option value="${safe}" ${n === current ? 'selected' : ''}>${safe}</option>`;
        }).join('');
}

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

/**
 * Normalize a base64 value into a full data URL.
 * If input already starts with 'data:', it is returned as-is (prevents double-prefix).
 * Otherwise it is prefixed with the provided MIME type (default: image/png).
 */
function normalizeBase64DataUrl(base64, fallbackMime = 'image/png') {
    const raw = String(base64 || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:')) return raw;
    return `data:${fallbackMime};base64,${raw}`;
}

const SEO_LIBRARY_META_KEYS = [
    'libraryId', 'libraryImageUrl', 'libraryFileName',
    'source', 'displayName', 'versionLabel', 'originalDesignId'
];

function preserveSeoLibraryMeta(existingMeta = {}, nextMeta = {}) {
    const preserved = {};
    const existing = existingMeta && typeof existingMeta === 'object' ? existingMeta : {};
    for (const key of SEO_LIBRARY_META_KEYS) {
        if (existing[key] != null && existing[key] !== '') preserved[key] = existing[key];
    }
    return { ...preserved, ...(nextMeta && typeof nextMeta === 'object' ? nextMeta : {}) };
}

function mergeSeoMetaForItem(item, seoMeta) {
    return preserveSeoLibraryMeta(item?.meta, seoMeta);
}

function seoGhostUrl(path) {
    const p = String(path || '').trim();
    if (!p) return '';
    const normalized = p.startsWith('/') ? p : `/${p}`;
    if (window.NhpRuntimeConfig?.localUrl) {
        return window.NhpRuntimeConfig.localUrl(3019, normalized);
    }
    return `http://127.0.0.1:3019${normalized}`;
}

async function fetchSeoLibraryImageBase64(item) {
    const libraryId = String(item?.meta?.libraryId || '').trim();
    const rawPath = item?.meta?.libraryImageUrl;
    let url = '';
    if (libraryId) {
        url = seoGhostUrl(`/api/library/${encodeURIComponent(libraryId)}/download`);
    } else if (rawPath) {
        url = String(rawPath).startsWith('http') ? String(rawPath) : seoGhostUrl(rawPath);
    }
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('read_failed'));
            reader.readAsDataURL(blob);
        });
        const b64 = String(dataUrl || '').includes(',') ? String(dataUrl).split(',')[1] : '';
        return b64 || null;
    } catch (err) {
        console.warn('[SEO-IMG] library fetch failed:', err?.message || err);
        return null;
    }
}

/**
 * Defensive helper: retrieve a design's full base64 image string.
 * Priority: item.base64 → meta.libraryImageUrl / libraryId → IndexedDB.
 * Throws a descriptive Error if retrieval is impossible or fails.
 */
async function resolveSeoItemBase64(item) {
    const filename = (item?.file?.name || item?.name || item?.id || 'unknown');

    // Fast path: inline base64 already present
    if (item?.base64) {
        console.log('[SEO-IMG] Using inline base64 for:', filename,
            '| length:', item.base64.length);
        return item.base64;
    }

    const fromLibrary = await fetchSeoLibraryImageBase64(item);
    if (fromLibrary) {
        console.log('[SEO-IMG] Using library file for:', filename,
            '| libraryId:', item?.meta?.libraryId || '',
            '| path:', item?.meta?.libraryImageUrl || '',
            '| length:', fromLibrary.length);
        return fromLibrary;
    }

    // Guard: item must have an id
    if (!item?.id) {
        throw new Error(`Missing item id for IndexedDB image lookup (file: ${filename})`);
    }

    // Guard: NHPDatabase must be defined
    const hasNHPDatabase = typeof window !== 'undefined' && !!window.NHPDatabase;
    const getImageAvailable = hasNHPDatabase && typeof window.NHPDatabase.getImage === 'function';

    console.log('[SEO-IMG] Resolving base64 from IndexedDB:', {
        filename,
        itemId: item.id,
        hasInlineBase64: false,
        hasNHPDatabase,
        getImageAvailable
    });

    if (!hasNHPDatabase) {
        throw new Error(`NHPDatabase unavailable during SEO generation (file: ${filename})`);
    }
    if (!getImageAvailable) {
        throw new Error(`NHPDatabase.getImage is not a function (file: ${filename})`);
    }

    let retrieved;
    try {
        retrieved = await window.NHPDatabase.getImage(item.id);
    } catch (dbErr) {
        throw new Error(
            `IndexedDB read error for item "${filename}" (id: ${item.id}): ${dbErr?.message || dbErr}`
        );
    }

    if (!retrieved) {
        throw new Error(
            `Image data unavailable in IndexedDB for item: "${filename}" (id: ${item.id}). ` +
            'The design may have been cleared — please re-add the image.'
        );
    }

    console.log('[SEO-IMG] IndexedDB retrieval successful for:', filename,
        '| retrievedBase64Length:', retrieved.length);
    return retrieved;
}

async function createThumbnail(base64, maxWidth = 100) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / Math.max(1, img.width));
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(null);
        // Use normalizer to avoid double-prefix when base64 already contains a data URL
        img.src = normalizeBase64DataUrl(base64, 'image/png');
    });
}
