/**
 * Generate API — T-shirt design image generation via CLIProxyAPI (OpenAI-compatible).
 * Mounted on ghost-server.js: POST /api/generate, GET /api/gallery, GET /api/jobs/:id
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const {
    APPAREL_DESIGN_SYSTEM_PROMPT,
    AUTO_IMAGE_PROMPT_TEMPLATE,
    TEXT_PRESERVATION_RULE,
    buildFinalGeneratePrompt,
    buildAutoImageGenerationPrompt,
    NO_PIXEL_COPY_RULE,
    chooseVisionModel,
    parseVisionAnalysis,
    VISION_ANALYSIS_SYSTEM_PROMPT,
    VISION_ANALYSIS_USER_TEXT,
    chooseModel,
    chooseImageModelCandidates,
    chooseImageSize,
    resolveGenerateEndpoint
} = require('./prompts/apparelDesignSystemPrompt');
const { createLibrarySmartRename, sanitizeLibraryFileName, safeLibraryFileSegment, sanitizeDisplayName } = require('./library-smart-rename');
const {
    removePathRobust,
    removeFileRobust,
    removeDirRobust,
    formatLibraryFsErrorAr,
    buildLibraryDeleteMessageAr,
    resolveNhpProjectRoot
} = require('./library-fs');
const {
    parseLibraryDesignId,
    splitCompositeBufferToPngs,
    ensureLibraryDesignSplitsOnDisk,
    resolveLibraryDesignFileOnDisk,
    resolveLibraryDesignFilePath,
    listSplitFilesFromMeta,
    libraryEntryHasImageFile,
    resolveLibraryFileOnDisk: resolveLibraryFileOnDiskShared
} = require('./library-design-files');
const {
    auditLibraryIntegrity,
    repairLibraryIndexFromDisk,
    ISSUE_LABEL_AR
} = require('./library-integrity-audit');
const {
    extractModelIdsFromListResponse,
    filterSupportedImageModels,
    pickDefaultImageModel,
    sanitizeImageModelChoice,
    NHP_DEFAULT_IMAGE_MODEL,
    imageModelsHintAr,
    geminiImageSetupHintAr,
    unsupportedImageModelErrorAr,
    isNhpMappedErrorAr,
    normalizeAiProvider,
    pickImageModelByProvider,
    findGeminiImageModel,
    findChatGptImageModel,
    resolveTestImageModelCandidates,
    collectGeminiImageModels,
    isChatGptLikeImageModel,
    isGeminiLikeImageModel,
    prefersGeminiChatImageRoute
} = require('./cliproxy-image-models');

/** Bump when library/generate routes change — clients use /ping to detect stale Ghost. */
const GENERATE_API_ROUTES_VERSION = 23;
const LIBRARY_RESERVED_SLUGS = new Set(['smart-rename', 'bulk', 'all', 'upload', 'audit', 'reconcile']);

function isLibraryReservedSlug(rawId) {
    return LIBRARY_RESERVED_SLUGS.has(String(rawId || '').trim().toLowerCase());
}

function respondLibraryReservedSlug(res, slug, method = 'GET') {
    if (slug === 'smart-rename') {
        return res.status(405).json({
            success: false,
            error: 'استخدم POST /api/library/smart-rename مع قائمة ids في الجسم',
            hint: method === 'GET'
                ? 'GET غير مدعوم — أرسل POST مع { "ids": ["..."] }'
                : 'مسار التسمية الذكية يقبل POST فقط'
        });
    }
    return res.status(404).json({ success: false, error: 'مسار غير موجود' });
}

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

/** Create .env from .env.example; force gpt-image-2 when Codex lists it (never leave dall-e-3 as default). */
function ensureGenerateEnvImageModel(rootDir, availableModels = [], log = () => {}) {
    const envPath = path.join(rootDir, '.env');
    const examplePath = path.join(rootDir, '.env.example');
    if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
        try {
            fs.copyFileSync(examplePath, envPath);
            log('Generate: created .env from .env.example');
        } catch (e) {
            log(`Generate: could not create .env — ${e.message}`, 'WARN');
        }
    }
    loadEnvFile(rootDir);
    const available = filterSupportedImageModels(availableModels);
    const current = String(process.env.CLIPROXY_IMAGE_MODEL || '').trim().toLowerCase();
    const shouldForceGpt = available.includes(NHP_DEFAULT_IMAGE_MODEL)
        && (!current || /^dall-e-/i.test(current));
    if (!shouldForceGpt) return;
    process.env.CLIPROXY_IMAGE_MODEL = NHP_DEFAULT_IMAGE_MODEL;
    if (!fs.existsSync(envPath)) return;
    try {
        let text = fs.readFileSync(envPath, 'utf8');
        if (/^CLIPROXY_IMAGE_MODEL=/m.test(text)) {
            text = text.replace(/^CLIPROXY_IMAGE_MODEL=.*$/m, `CLIPROXY_IMAGE_MODEL=${NHP_DEFAULT_IMAGE_MODEL}`);
        } else {
            text += `\nCLIPROXY_IMAGE_MODEL=${NHP_DEFAULT_IMAGE_MODEL}\n`;
        }
        fs.writeFileSync(envPath, text, 'utf8');
        log(`Generate: CLIPROXY_IMAGE_MODEL set to ${NHP_DEFAULT_IMAGE_MODEL} (Codex in /models)`);
    } catch (e) {
        log(`Generate: in-memory CLIPROXY_IMAGE_MODEL=${NHP_DEFAULT_IMAGE_MODEL}; .env not updated — ${e.message}`, 'WARN');
    }
}

/** Local CLIProxy — backup when cloud Render is down. */
const DEFAULT_LOCAL_CLIPROXY_BASE_URL = 'http://127.0.0.1:8317/v1';
/** Render-hosted CLIProxy — primary AI endpoint. */
const DEFAULT_RENDER_CLIPROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
const DEFAULT_CLIPROXY_BASE_URL = DEFAULT_RENDER_CLIPROXY_BASE_URL;
const LOCAL_CLIPROXY_DEFAULT_API_KEY = 'nhp-local-cliproxy-key';
const LOCAL_CLIPROXY_API_KEY_ALIASES = new Set([
    LOCAL_CLIPROXY_DEFAULT_API_KEY,
    'nhp-local-cli-proxy-key'
]);

function isLocalCliProxyGatewayKey(apiKey) {
    return LOCAL_CLIPROXY_API_KEY_ALIASES.has(String(apiKey || '').trim());
}

function isLocalCliProxyBaseUrl(value) {
    const v = String(value || '').trim().toLowerCase();
    return /:(8317)(\/|$)/.test(v) && /127\.0\.0\.1|localhost/.test(v);
}

/** Google AI Studio / Generative Language API keys — not valid as CLIProxy gateway Bearer. */
function isGoogleGeminiApiKey(key) {
    return /^AIza[0-9A-Za-z_\-]{10,}$/.test(String(key || '').trim());
}

function isDirectGoogleGeminiBaseUrl(value) {
    return /generativelanguage\.googleapis\.com/i.test(String(value || '').trim());
}

/**
 * CLIProxy api-keys (config.yaml) vs Google Gemini keys.
 * Local 8317 config only lists nhp-local-cliproxy-key — cloud/SEO keys always 401 there.
 */
function resolveCliProxyBearerKey(baseUrl, apiKey) {
    const base = String(baseUrl || '').trim();
    let key = String(apiKey || '').trim();
    if (isLocalCliProxyGatewayKey(key)) key = LOCAL_CLIPROXY_DEFAULT_API_KEY;
    if (isDirectGoogleGeminiBaseUrl(base)) return key;
    if (isLocalCliProxyBaseUrl(base)) {
        return LOCAL_CLIPROXY_DEFAULT_API_KEY;
    }
    // Remote CLIProxy: never forward Google AI Studio keys as gateway Bearer.
    if (isGoogleGeminiApiKey(key)) return '';
    // Never send the local gateway placeholder to Render.
    if (isLocalCliProxyGatewayKey(key)) return '';
    return key;
}

function normalizeCliProxyBaseUrl(value) {
    const fallback = DEFAULT_CLIPROXY_BASE_URL;
    const rawInput = String(value || '').trim()
        .replace(/cliproxy-api-ywrp\.onrender\.com/gi, 'cliproxyapi-ywrp.onrender.com');
    // Keep local 8317 — never remap to Render (that broke Codex gpt-image-2).
    const raw = rawInput || fallback;
    return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1') || fallback;
}

function normalizeGeminiBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/generativelanguage\.googleapis\.com/i.test(raw)) {
        return raw.replace(/\/+$/, '');
    }
    return normalizeCliProxyBaseUrl(raw);
}

function normalizeProviderBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/generativelanguage\.googleapis\.com/i.test(raw)) {
        return normalizeGeminiBaseUrl(raw);
    }
    return normalizeCliProxyBaseUrl(raw);
}

async function probeCliProxyOnline(baseUrl, apiKey = '', timeoutMs = 1800) {
    const base = normalizeCliProxyBaseUrl(baseUrl);
    if (!base) return false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const headers = {};
        const key = String(apiKey || '').trim()
            || (isLocalCliProxyBaseUrl(base) ? LOCAL_CLIPROXY_DEFAULT_API_KEY : '');
        if (key) headers.Authorization = `Bearer ${key}`;
        const res = await fetch(`${base}/models`, {
            method: 'GET',
            headers,
            signal: controller?.signal
        });
        // Only authenticated success counts — 401/403 must NOT mark local "online"
        // or cloud failover never runs when the extension sends a cloud NHP key.
        return !!res.ok;
    } catch (_) {
        return false;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Cloud Render primary; local 8317 backup when cloud is unreachable / auth fails.
 */
async function resolvePreferredCliProxyBaseUrl(requestedBase, apiKey = '', requestApiKey = '') {
    const requested = normalizeProviderBaseUrl(requestedBase) || '';
    const local = normalizeCliProxyBaseUrl(DEFAULT_LOCAL_CLIPROXY_BASE_URL);
    const render = normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL);
    const localKey = LOCAL_CLIPROXY_DEFAULT_API_KEY;
    const rawRequestKey = String(requestApiKey || apiKey || '').trim();
    const cloudKey = resolveCliProxyBearerKey(render, rawRequestKey);

    // 1) Cloud primary when SEO/NHP key authenticates on Render.
    const cloudOnline = !!(cloudKey && await probeCliProxyOnline(render, cloudKey));
    if (cloudOnline) return render;

    // 2) Local backup with gateway key.
    const localOnline = await probeCliProxyOnline(local, localKey);
    if (localOnline) return local;

    // 3) Prefer requested remote host; otherwise stay local-ready so Bearer resolves to gateway key
    //    (avoids hard "no cloud key" when storage has no SEO key but 8317 may come online).
    if (requested && !isLocalCliProxyBaseUrl(requested) && cloudKey) return requested;
    if (cloudKey) return render;
    return local;
}

/** Request creds → env; cloud Render primary (local via resolvePreferred failover). */
function getCliProxyConfig(rootDir, overrides = {}) {
    loadEnvFile(rootDir);
    const baseFromReq = String(overrides.baseUrl || overrides.proxyBaseUrl || '').trim();
    const keyFromReq = String(overrides.apiKey || '').trim();
    const cloudKeyFromReq = String(overrides.cloudApiKey || '').trim();
    const envBase = String(process.env.CLIPROXY_BASE_URL || '').trim();
    const base = baseFromReq
        ? normalizeProviderBaseUrl(baseFromReq)
        : normalizeCliProxyBaseUrl(envBase || DEFAULT_CLIPROXY_BASE_URL);
    const requestApiKey = (
        keyFromReq
        || String(process.env.NHP_GPT_API_KEY || '').trim()
        || String(process.env.CLIPROXY_API_KEY || '').trim()
    );
    // Distinct SEO/cloud key (header/body) — never confuse with local gateway placeholder.
    let requestCloudApiKey = cloudKeyFromReq;
    if (
        !requestCloudApiKey
        && requestApiKey
        && !isLocalCliProxyGatewayKey(requestApiKey)
        && !isGoogleGeminiApiKey(requestApiKey)
    ) {
        requestCloudApiKey = requestApiKey;
    }
    if (!requestCloudApiKey) {
        const envGpt = String(process.env.NHP_GPT_API_KEY || '').trim();
        if (
            envGpt
            && !isLocalCliProxyGatewayKey(envGpt)
            && !isGoogleGeminiApiKey(envGpt)
        ) {
            requestCloudApiKey = envGpt;
        }
    }
    const apiKey = resolveCliProxyBearerKey(base, requestApiKey);
    let keySource = 'none';
    if (!apiKey) keySource = 'none';
    else if (isLocalCliProxyBaseUrl(base) && apiKey === LOCAL_CLIPROXY_DEFAULT_API_KEY) keySource = 'local-default';
    else if (keyFromReq && apiKey === keyFromReq) keySource = 'request';
    else if (apiKey) keySource = keyFromReq ? 'request-sanitized' : 'env';
    return {
        baseUrl: base,
        apiKey,
        keySource,
        requestApiKey,
        requestCloudApiKey: String(requestCloudApiKey || '').trim()
    };
}

async function getCliProxyConfigPreferred(rootDir, overrides = {}) {
    const sync = getCliProxyConfig(rootDir, overrides);
    const preferredBase = await resolvePreferredCliProxyBaseUrl(
        sync.baseUrl,
        sync.apiKey,
        sync.requestCloudApiKey || sync.requestApiKey
    );
    const apiKey = resolveCliProxyBearerKey(
        preferredBase,
        isLocalCliProxyBaseUrl(preferredBase)
            ? LOCAL_CLIPROXY_DEFAULT_API_KEY
            : (sync.requestCloudApiKey || sync.requestApiKey || sync.apiKey)
    );
    const cloudApiKey = resolveCliProxyBearerKey(
        DEFAULT_RENDER_CLIPROXY_BASE_URL,
        sync.requestCloudApiKey || sync.requestApiKey || sync.apiKey
    );
    const syncWasCloud = !isLocalCliProxyBaseUrl(sync.baseUrl);
    const preferredLocal = isLocalCliProxyBaseUrl(preferredBase);
    const switchedToLocal = preferredLocal && syncWasCloud;
    const switchedToCloud = !preferredLocal && isLocalCliProxyBaseUrl(sync.baseUrl);
    let keySource = sync.keySource;
    if (preferredLocal) keySource = 'local-backup';
    else if (switchedToCloud) keySource = 'cloud-primary';
    else if (cloudApiKey) keySource = 'cloud-primary';
    return {
        ...sync,
        baseUrl: preferredBase,
        apiKey,
        cloudApiKey,
        preferredLocal,
        failoverFrom: switchedToLocal
            ? normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL)
            : (switchedToCloud ? normalizeCliProxyBaseUrl(DEFAULT_LOCAL_CLIPROXY_BASE_URL) : null),
        keySource
    };
}

function resolveRequestCliProxyCredentials(req) {
    const body = req?.body || {};
    const apiKey = String(
        body.apiKey
        || body.nhpGptApiKey
        || req?.headers?.['x-nhp-api-key']
        || req?.headers?.['x-nhp-gpt-api-key']
        || ''
    ).trim();
    const cloudApiKey = String(
        body.cloudApiKey
        || body.nhpCloudApiKey
        || req?.headers?.['x-nhp-cloud-api-key']
        || ''
    ).trim();
    const baseUrl = String(
        body.baseUrl
        || body.proxyBaseUrl
        || req?.headers?.['x-nhp-proxy-base-url']
        || ''
    ).trim();
    return { apiKey, cloudApiKey, baseUrl };
}

function resolveRequestGeminiCredentials(req) {
    const body = req?.body || {};
    const apiKey = String(
        body.geminiApiKey
        || req?.headers?.['x-nhp-gemini-api-key']
        || ''
    ).trim();
    const baseUrl = String(
        body.geminiBaseUrl
        || body.googleBaseUrl
        || req?.headers?.['x-nhp-gemini-base-url']
        || ''
    ).trim();
    return { apiKey, baseUrl };
}

/** Gemini mode: prefer generateGemini* from Generate settings when provided. */
function getProviderCliProxyConfig(rootDir, req, aiProvider) {
    const provider = normalizeAiProvider(aiProvider);
    const genericCreds = resolveRequestCliProxyCredentials(req);
    if (provider !== 'gemini') {
        return getCliProxyConfig(rootDir, genericCreds);
    }
    const geminiCreds = resolveRequestGeminiCredentials(req);
    if (!geminiCreds.apiKey && !geminiCreds.baseUrl) {
        return getCliProxyConfig(rootDir, genericCreds);
    }
    const baseUrl = geminiCreds.baseUrl || genericCreds.baseUrl;
    // Direct Google Generative Language API — use the Google key.
    if (isDirectGoogleGeminiBaseUrl(baseUrl)) {
        return getCliProxyConfig(rootDir, {
            apiKey: geminiCreds.apiKey || genericCreds.apiKey,
            cloudApiKey: genericCreds.cloudApiKey,
            baseUrl
        });
    }
    // CLIProxy path (local Antigravity / Google OAuth in auth-dir): gateway key only.
    // Never use an AIza… Studio key as CLIProxy Bearer (causes {"error":"Invalid API key"}).
    const gatewayKey = (
        (!isGoogleGeminiApiKey(genericCreds.apiKey) && genericCreds.apiKey)
        || (!isGoogleGeminiApiKey(geminiCreds.apiKey) && geminiCreds.apiKey)
        || ''
    );
    return getCliProxyConfig(rootDir, {
        apiKey: gatewayKey,
        cloudApiKey: genericCreds.cloudApiKey,
        baseUrl
    });
}

async function getProviderCliProxyConfigPreferred(rootDir, req, aiProvider) {
    const sync = getProviderCliProxyConfig(rootDir, req, aiProvider);
    return getCliProxyConfigPreferred(rootDir, sync);
}

const MISSING_API_KEY_ERROR_AR = 'مفتاح NHP API غير مُعدّ';
const MISSING_API_KEY_HINT_AR = 'أضف مفتاح NHP API من قسم SEO → إعدادات API (NHP API Key) أو من لوحة التحكم → مفاتيح AI. بديلاً: ضع CLIPROXY_API_KEY في ملف .env بجذر المشروع.';

const MAX_INPUT_PX_DEFAULT = 768;

function getMaxInputPxForQuality(quality) {
    const q = String(quality || 'balanced').toLowerCase();
    if (q === 'fast') return 640;
    if (q === 'premium') return 1024;
    return MAX_INPUT_PX_DEFAULT;
}

function getInputJpegQualityForQuality(quality) {
    const q = String(quality || 'balanced').toLowerCase();
    if (q === 'fast') return 75;
    if (q === 'premium') return 88;
    return 82;
}
const TIMEOUT_VISION_MS = 90000;
const TIMEOUT_IMAGE_MS_DEFAULT = 360000;
/** Per-provider attempt (esp. Gemini fallback) — fail fast; override via NHP_GENERATE_PROVIDER_TIMEOUT_MS */
const TIMEOUT_PROVIDER_ATTEMPT_MS_DEFAULT = 240000;
/** Gemini fallback / hung upstream — shorter default; NHP_GENERATE_GEMINI_TIMEOUT_MS */
const TIMEOUT_GEMINI_ATTEMPT_MS_DEFAULT = 90000;
/** Mark running jobs failed if stuck past this (updatedAt); NHP_GENERATE_JOB_STALE_MS */
const TIMEOUT_JOB_STALE_MS_DEFAULT = 960000;

/** مهلة توليد الصور — اختياري: NHP_GENERATE_IMAGE_TIMEOUT_MS في .env (60000–600000) */
function getGenerateImageTimeoutMs() {
    const raw = Number(process.env.NHP_GENERATE_IMAGE_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 60000) return Math.min(Math.round(raw), 600000);
    return TIMEOUT_IMAGE_MS_DEFAULT;
}

/** مهلة التوليد الكامل (رؤية + مرجع + شبكة) — NHP_GENERATE_FULL_TIMEOUT_MS (افتراضي 420 ث) */
function getGenerateFullImageTimeoutMs() {
    const raw = Number(process.env.NHP_GENERATE_FULL_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 60000) return Math.min(Math.round(raw), 600000);
    return Math.max(getGenerateImageTimeoutMs(), 420000);
}

/** مهلة أطول لاختبار /api/generate/test — NHP_GENERATE_TEST_TIMEOUT_MS (افتراضي 360 ث) */
function getGenerateTestImageTimeoutMs() {
    const raw = Number(process.env.NHP_GENERATE_TEST_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 60000) return Math.min(Math.round(raw), 600000);
    return Math.max(getGenerateImageTimeoutMs(), 360000);
}

/** Hard cap for a single GPT/CLIProxy image attempt (headers + body). */
function getProviderAttemptTimeoutMs() {
    const raw = Number(process.env.NHP_GENERATE_PROVIDER_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 30000) return Math.min(Math.round(raw), 600000);
    return Math.min(getGenerateImageTimeoutMs(), TIMEOUT_PROVIDER_ATTEMPT_MS_DEFAULT);
}

/** Hard cap for Gemini chat-image / fallback attempt — fail fast on quota hang. */
function getGeminiAttemptTimeoutMs() {
    const raw = Number(process.env.NHP_GENERATE_GEMINI_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw >= 20000) return Math.min(Math.round(raw), 300000);
    return Math.min(getProviderAttemptTimeoutMs(), TIMEOUT_GEMINI_ATTEMPT_MS_DEFAULT);
}

/** Running job with no progress past this → mark failed on poll. */
function getJobStaleTimeoutMs() {
    const raw = Number(process.env.NHP_GENERATE_JOB_STALE_MS);
    if (Number.isFinite(raw) && raw >= 60000) return Math.min(Math.round(raw), 1200000);
    return Math.max(
        TIMEOUT_JOB_STALE_MS_DEFAULT,
        getGeminiAttemptTimeoutMs() + getProviderAttemptTimeoutMs() + 120000
    );
}

function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const STAGE_LABELS = Object.freeze({
    preparing: 'تحضير الصورة...',
    vision: 'تحليل الصورة...',
    generating: 'توليد 4 تصاميم في صورة واحدة...',
    saving: 'حفظ النتائج...',
    done: 'اكتمل التوليد'
});

const DESIGNS_PER_COMPOSITE = 4;

function normalizeDesignCount(raw) {
    const n = Number(raw) || 4;
    if (n >= 12) return 12;
    if (n >= 8) return 8;
    return 4;
}

function parseStyleListFromBody(raw) {
    if (Array.isArray(raw)) {
        return raw.map((s) => String(s || '').trim()).filter(Boolean);
    }
    const text = String(raw || '').trim();
    if (!text) return null;
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map((s) => String(s || '').trim()).filter(Boolean);
        }
    } catch (_) { /* ignore */ }
    return null;
}

function totalBatchesFromCount(designCount) {
    return normalizeDesignCount(designCount) / DESIGNS_PER_COMPOSITE;
}

function batchStageLabelAr(batchIndex, totalBatches) {
    return `الدفعة ${batchIndex}/${totalBatches} — توليد 4 تصاميم...`;
}

function newLibraryId() {
    return `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function timeoutErrorAr(kind, timeoutMs) {
    const labels = {
        vision: 'تحليل الصورة',
        image: 'توليد الصور',
        fetch: 'الاتصال بـ CLIProxy'
    };
    const sec = Math.round(timeoutMs / 1000);
    return `انتهت مهلة ${labels[kind] || 'العملية'} (${sec} ث). تحقق من CLIProxyAPI أو جرّب صورة أصغر.`;
}

let _imageModelsCache = { at: 0, available: [], recommended: '' };
const IMAGE_MODELS_CACHE_TTL_MS = 60000;

async function fetchCliProxyImageModels(baseUrl, apiKey) {
    const modelsUrl = `${baseUrl.replace(/\/+$/, '')}/models`;
    const probe = await fetchWithTimeout(modelsUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` }
    }, 10000, 'fetch', baseUrl);
    if (!probe.ok) {
        return { available: [], recommended: pickDefaultImageModel([]), fetchOk: false, status: probe.status };
    }
    const text = await probe.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = null;
    }
    const ids = extractModelIdsFromListResponse(data);
    const rawIds = [...ids];
    const available = filterSupportedImageModels(ids);
    return {
        available,
        rawIds,
        geminiImageModels: collectGeminiImageModels(rawIds),
        chatGptImageModels: rawIds.filter((m) => isChatGptLikeImageModel(m)),
        recommended: pickDefaultImageModel(available),
        fetchOk: true,
        status: probe.status
    };
}

async function getCliProxyImageModelsCached(baseUrl, apiKey, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _imageModelsCache.at && (now - _imageModelsCache.at) < IMAGE_MODELS_CACHE_TTL_MS) {
        return _imageModelsCache;
    }
    try {
        const probe = await fetchCliProxyImageModels(baseUrl, apiKey);
        _imageModelsCache = { at: now, ...probe };
    } catch (_) {
        _imageModelsCache = {
            at: now,
            available: [],
            recommended: pickDefaultImageModel([]),
            fetchOk: false,
            status: 0
        };
    }
    return _imageModelsCache;
}

/** Map CLIProxy upstream errors to actionable Arabic messages for Generate UI. */
function mapCliProxyErrorMessageAr(raw, ctx = {}) {
    const msg = String(raw || '').trim();
    if (!msg) return msg;
    if (isNhpMappedErrorAr(msg)) return msg;
    const lower = msg.toLowerCase();
    const modelMatch = msg.match(/model=([^\s,)]+)/i)
        || msg.match(/model ([^\s]+) is not supported/i);
    const modelName = modelMatch ? modelMatch[1] : '';
    const providersMatch = msg.match(/providers=([^\s)]+)/i);
    const providers = providersMatch ? providersMatch[1] : '';
    const available = Array.isArray(ctx.availableModels)
        ? ctx.availableModels
        : _imageModelsCache.available;

    if (/invalid api key|api key not valid|api_key_invalid/i.test(lower)) {
        if (ctx.aiProvider === 'gemini' || isGeminiLikeImageModel(modelName || ctx.requestedModel)) {
            return [
                'مفتاح Gemini غير صالح لهذا المسار.',
                'لا ترسل مفتاح Google AI Studio (AIza…) كـ Bearer لـ CLIProxy — استخدم مفتاح NHP/SEO، أو اضبط Gemini داخل config.yaml / لوحة CLIProxy.',
                'إن كان المحلي معطوباً سيُحوَّل الطلب تلقائياً إلى Render عند توفر مفتاح SEO صالح.',
                geminiImageSetupHintAr(available, ctx.rawModelIds || available)
            ].filter(Boolean).join('\n');
        }
        return [
            'مفتاح API غير صالح لـ CLIProxy.',
            isLocalCliProxyBaseUrl(ctx.baseUrl)
                ? 'المحلي يقبل فقط nhp-local-cliproxy-key — مفتاح SEO السحابي يُستخدم على Render.'
                : 'تحقق من مفتاح NHP API (SEO → إعدادات API) على cliproxyapi-ywrp.onrender.com.',
            'NHP يُفضّل السحابة تلقائياً عند فشل المحلي (401/503).'
        ].filter(Boolean).join('\n');
    }

    if (/auth_unavailable|no auth available/i.test(lower)) {
        if (ctx.aiProvider === 'gemini' || isGeminiLikeImageModel(modelName || ctx.requestedModel)) {
            const ep = cliproxyEndpointPath(ctx.endpoint) || '/v1/chat/completions';
            const renderNote = isRenderCliProxyBaseUrl(ctx.baseUrl)
                ? 'مصادقة Gemini غير مُعدّة على Render CLIProxy — أضف مفتاح Gemini API في config.yaml أو لوحة CLIProxy.'
                : 'أضف مصادقة Gemini API في CLIProxy (config.yaml أو لوحة الإدارة).';
            return [
                'تعذّر توليد الصور عبر Gemini — لا توجد مصادقة متاحة.',
                `المسار المُستخدَم: ${ep}`,
                renderNote,
                geminiImageSetupHintAr(available, ctx.rawModelIds || available)
            ].filter(Boolean).join('\n');
        }
        if (/gpt-image-2/i.test(`${lower} ${modelName}`) || providers === 'codex') {
            return [
                'تعذّر توليد الصور: gpt-image-2 يحتاج مصادقة Codex (OAuth) في CLIProxyAPI — مفتاح NHP API وحده لا يكفي.',
                'الحل 1 — Codex: http://127.0.0.1:8317 → إضافة مصادقة Codex في auth-dir.',
                'الحل 2 — Grok: مصادقة xAI → grok-imagine-image (بدون Codex).',
                'الحل 3 — Gemini: gemini-3.1-flash-image في config.yaml (بديل اختياري).'
            ].join('\n');
        }
        if (/grok-imagine/i.test(`${lower} ${modelName}`) || providers === 'xai') {
            return [
                'تعذّر توليد الصور: grok-imagine-image يحتاج مصادقة xAI (OAuth) في CLIProxyAPI.',
                'أضف مصادقة xAI من لوحة الإدارة، أو استخدم gpt-image-2 مع Codex OAuth.'
            ].join('\n');
        }
        return [
            'لا توجد مصادقة متاحة في CLIProxyAPI لهذا النموذج.',
            modelName ? `النموذج: ${modelName}` : '',
            providers ? `المزوّد: ${providers}` : '',
            imageModelsHintAr(available, pickDefaultImageModel(available))
        ].filter(Boolean).join('\n');
    }

    // Wrong Bearer against CLIProxy (often a Google AIza… key stored as NHP/Gemini API key).
    if (/invalid api key|incorrect api key|api key not valid|unauthorized/i.test(lower)
        || Number(ctx.httpStatus) === 401) {
        const local = isLocalCliProxyBaseUrl(ctx.baseUrl);
        if (ctx.aiProvider === 'gemini' || isGeminiLikeImageModel(ctx.requestedModel)) {
            return [
                'مفتاح API مرفوض من CLIProxy (Invalid API key).',
                local
                    ? 'للمسار المحلي: استخدم nhp-local-cliproxy-key كمفتاح NHP API — لا تضع مفتاح Google (AIza…) كـ Bearer لـ :8317.'
                    : 'تأكد أن المفتاح مطابق لـ api-keys في config.yaml على CLIProxy.',
                'Gemini عبر CLIProxy يعتمد OAuth (Antigravity/Google) في auth-dir — مفتاح Studio اختياري فقط لـ Google API المباشر.',
                'لوحة الإدارة: http://127.0.0.1:8317/management.html#/login'
            ].join('\n');
        }
        return [
            'مفتاح NHP API مرفوض من CLIProxy.',
            local
                ? 'ضع nhp-local-cliproxy-key في لوحة التحكم → مفاتيح AI (أو اتركه فارغاً ليُستخدم تلقائياً محلياً).'
                : 'طابق المفتاح مع api-keys في إعدادات CLIProxy.',
            'gpt-image-2 يحتاج أيضاً Codex OAuth في auth-dir بعد قبول المفتاح.'
        ].join('\n');
    }

    if (/stream disconnected|stream error|disconnected before completion/i.test(lower)) {
        const provider = normalizeAiProvider(ctx.aiProvider);
        const lines = [
            'انقطع تدفق الاستجابة (stream) قبل اكتمال توليد الصورة.',
            'NHP 30.1.18+ يفرض non-stream مع إعادة محاولة تلقائية — إن تكرّر الخطأ:',
            'الحل 1 — Codex OAuth: http://127.0.0.1:8317 → أضف مصادقة Codex لـ gpt-image-2.',
            'الحل 2 — راجع سجلات CLIProxyAPI (نافذة الخادم) للخطأ التفصيلي.',
            'الحل 3 — تحقق من الشبكة أو جرّب CLIProxy محلياً بدلاً من Render.',
            imageModelsHintAr(available, pickDefaultImageModel(available))
        ];
        if (provider === 'chatgpt') {
            lines.splice(2, 0, 'تأكد أن ghost-server.js محدّث (30.1.18+) — /images/edits و /images/generations كلاهما non-stream.');
        }
        return lines.filter(Boolean).join('\n');
    }

    if (/is not supported on.*images\/(generations|edits)/i.test(lower)) {
        return unsupportedImageModelErrorAr(modelName || ctx.requestedModel, available, {
            aiProvider: ctx.aiProvider,
            rawModelIds: ctx.rawModelIds || available
        });
    }

    if (/multi-modal output is not supported|modalities.*not supported/i.test(lower)) {
        return [
            'نموذج Gemini يتطلب /chat/completions مع modalities: ["image","text"].',
            modelName || ctx.requestedModel ? `النموذج: ${modelName || ctx.requestedModel}` : '',
            geminiImageSetupHintAr(available, ctx.rawModelIds || available)
        ].filter(Boolean).join('\n');
    }

    if (Number(ctx.httpStatus) === 400 && (isGeminiLikeImageModel(ctx.requestedModel) || ctx.aiProvider === 'gemini')) {
        const geminiListed = collectGeminiImageModels(ctx.rawModelIds || available).length > 0;
        if (geminiListed || isGeminiLikeImageModel(ctx.requestedModel)) {
            const ep = cliproxyEndpointPath(ctx.endpoint) || '/v1/chat/completions';
            if (isGeminiAuthMissingUpstream(msg, ctx)) {
                const renderNote = isRenderCliProxyBaseUrl(ctx.baseUrl)
                    ? 'مصادقة Gemini غير مُعدّة على Render CLIProxy — المفتاح في SEO يعمل لـ /models لكن توليد الصور يحتاج Gemini auth على الخادم.'
                    : 'أضف مفتاح Gemini API في إعدادات التوليد أو CLIProxy config.yaml.';
                return [
                    `طلب CLIProxy مرفوض (400) على ${ep} — مصادقة Gemini مفقودة.`,
                    `التفاصيل: ${msg}`,
                    renderNote,
                    geminiImageSetupHintAr(available, ctx.rawModelIds || available)
                ].join('\n');
            }
            return [
                `طلب CLIProxy مرفوض (400) على ${ep}.`,
                `التفاصيل: ${msg}`,
                'الحل: /v1/chat/completions مع modalities: ["image","text"] (مُطبَّق تلقائياً في NHP 30.1.19+).',
                geminiImageSetupHintAr(available, ctx.rawModelIds || available)
            ].join('\n');
        }
    }

    return msg;
}

function isRenderCliProxyBaseUrl(baseUrl = '') {
    return /onrender\.com/i.test(String(baseUrl || '').trim());
}

/** Normalize full CLIProxy URL or path to a debug-friendly path (e.g. /v1/chat/completions). */
function cliproxyEndpointPath(endpointOrUrl = '') {
    const s = String(endpointOrUrl || '').trim();
    if (!s) return '';
    try {
        if (/^https?:\/\//i.test(s)) {
            const u = new URL(s);
            return u.pathname.replace(/\/+$/, '') || s;
        }
    } catch (_) { /* ignore */ }
    return s.startsWith('/') ? s : `/${s}`;
}

function isGeminiChatEndpoint(endpointOrUrl = '') {
    return cliproxyEndpointPath(endpointOrUrl).toLowerCase().includes('/chat/completions');
}

function isGeminiAuthMissingUpstream(raw = '', ctx = {}) {
    const lower = String(raw || '').toLowerCase();
    const geminiCtx = ctx.aiProvider === 'gemini' || isGeminiLikeImageModel(ctx.requestedModel);
    if (!geminiCtx) return false;
    return /auth_unavailable|no auth available|missing.*auth|unauthorized|invalid.*api.*key|api key not valid|gemini.*auth|google.*auth|providers=google|provider.*google/i.test(lower);
}

function connectionErrorAr(kind = 'fetch', baseUrl = '') {
    const labels = {
        vision: 'CLIProxy (تحليل الصورة)',
        image: 'CLIProxy (توليد الصور)',
        fetch: 'CLIProxyAPI'
    };
    const target = labels[kind] || labels.fetch;
    const base = String(baseUrl || '').trim() || DEFAULT_CLIPROXY_BASE_URL;
    if (isLocalCliProxyBaseUrl(base)) {
        return `تعذّر الاتصال بـ ${target} — شغّل CLIProxyAPI على المنفذ 8317 (${base}) أو حدّث nhpProxyBaseUrl إلى Render (${DEFAULT_RENDER_CLIPROXY_BASE_URL})`;
    }
    if (isRenderCliProxyBaseUrl(base)) {
        return `تعذّر الاتصال بـ ${target} على Render (${base}) — تحقق من الإنترنت أو انتظر إقلاع الخدمة (cold start) ثم أعد المحاولة`;
    }
    return `تعذّر الاتصال بـ ${target} على ${base} — تحقق من الشبكة أو المفتاح`;
}

/** Combine mapped + raw CLIProxy error text for retry / classification. */
function cliProxyErrorCombinedText(err) {
    return `${String(err?.rawMessage || '')} ${String(err?.message || err || '')}`.trim();
}

function createCliProxyHttpError(rawMsg, ctx = {}) {
    const err = new Error(mapCliProxyErrorMessageAr(rawMsg, ctx));
    err.rawMessage = String(rawMsg || '').trim();
    err.httpStatus = Number(ctx.httpStatus) || 0;
    err.endpoint = String(ctx.endpoint || '').trim();
    return err;
}

function mapGenerateTestHttpStatus(err) {
    const upstream = Number(err?.httpStatus) || 0;
    if (upstream >= 400 && upstream < 500) return { status: 502, upstream };
    if (upstream >= 500) return { status: 502, upstream };
    return { status: 502, upstream: upstream || 0 };
}

function isCliProxyConnectionError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    const cause = String(err?.cause?.message || err?.cause?.code || '').toLowerCase();
    const combined = `${msg} ${cause}`;
    return /fetch failed|failed to fetch|econnrefused|econnreset|enotfound|socket hang up|undici|connect/i.test(combined);
}

/**
 * Fetch with AbortController. IMPORTANT: callers that read the body must use
 * fetchAndReadTextWithTimeout / readResponseBodyWithTimeout — otherwise the
 * abort timer is cleared after headers and response.text() can hang forever
 * (Gemini chat + hung CLIProxy body was leaving jobs in fallback_gemini/running).
 */
async function fetchWithTimeout(url, options, timeoutMs, kind = 'fetch', baseUrlForErrors = '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error(timeoutErrorAr(kind, timeoutMs));
        }
        if (isCliProxyConnectionError(err)) {
            throw new Error(connectionErrorAr(kind, baseUrlForErrors));
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Race a promise against a hard wall-clock deadline.
 * Optionally aborts an AbortController so hung fetch bodies do not keep the job alive.
 * Orphan promise rejections are swallowed so timeout winners do not leave unhandled rejections.
 */
async function withHardTimeout(promise, timeoutMs, kind = 'fetch', abortController = null) {
    let timer = null;
    const guarded = Promise.resolve(promise);
    guarded.catch(() => {});
    try {
        return await Promise.race([
            guarded,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    try { abortController?.abort?.(); } catch (_) { /* ignore */ }
                    reject(new Error(timeoutErrorAr(kind, timeoutMs)));
                }, Math.max(1000, Number(timeoutMs) || 1000));
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function mergeAbortSignals(primary, secondary) {
    if (!primary) return secondary || undefined;
    if (!secondary) return primary;
    if (primary.aborted) return primary;
    if (secondary.aborted) return secondary;
    const merged = new AbortController();
    const onAbort = () => {
        try { merged.abort(); } catch (_) { /* ignore */ }
    };
    primary.addEventListener('abort', onAbort, { once: true });
    secondary.addEventListener('abort', onAbort, { once: true });
    return merged.signal;
}

/**
 * Fetch + read body under ONE abort deadline so hung upstream bodies cannot
 * leave Generate jobs stuck in running/fallback_gemini forever.
 */
async function fetchAndReadTextWithTimeout(url, options, timeoutMs, kind = 'fetch', baseUrlForErrors = '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = mergeAbortSignals(controller.signal, options?.signal);
    try {
        const { signal: _ignore, ...rest } = options || {};
        const response = await fetch(url, { ...rest, signal });
        const text = await response.text();
        return { response, text };
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error(timeoutErrorAr(kind, timeoutMs));
        }
        if (isCliProxyConnectionError(err)) {
            throw new Error(connectionErrorAr(kind, baseUrlForErrors));
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchAndReadArrayBufferWithTimeout(url, options, timeoutMs, kind = 'fetch', baseUrlForErrors = '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = mergeAbortSignals(controller.signal, options?.signal);
    try {
        const { signal: _ignore, ...rest } = options || {};
        const response = await fetch(url, { ...rest, signal });
        const buffer = Buffer.from(await response.arrayBuffer());
        return { response, buffer };
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error(timeoutErrorAr(kind, timeoutMs));
        }
        if (isCliProxyConnectionError(err)) {
            throw new Error(connectionErrorAr(kind, baseUrlForErrors));
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

function readJobMeta(metaPath) {
    try {
        if (!fs.existsSync(metaPath)) return {};
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (_) {
        return {};
    }
}

function writeJobMeta(metaPath, patch) {
    const prev = readJobMeta(metaPath);
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    fs.writeFileSync(metaPath, JSON.stringify(next, null, 2), 'utf8');
    return next;
}

function stageLabelForGenerating(batchIndex = 1, totalBatches = 1) {
    if (totalBatches > 1) return batchStageLabelAr(batchIndex, totalBatches);
    return 'توليد 4 تصاميم في صورة واحدة...';
}

async function resizeInputImage(inputPath, outputPath, log, { quality = 'balanced' } = {}) {
    const maxPx = getMaxInputPxForQuality(quality);
    const jpegQ = getInputJpegQualityForQuality(quality);
    const meta = await sharp(inputPath).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    let fileBytes = 0;
    try {
        fileBytes = fs.statSync(inputPath).size || 0;
    } catch (_) {
        fileBytes = 0;
    }
    const needsResize = w > maxPx || h > maxPx;
    const needsReencode = fileBytes > 750 * 1024;
    if (!needsResize && !needsReencode) {
        if (path.resolve(inputPath) !== path.resolve(outputPath)) {
            fs.copyFileSync(inputPath, outputPath);
        }
        const ext = path.extname(outputPath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return { path: outputPath, mimeType, resized: false, width: w, height: h };
    }
    await sharp(inputPath)
        .rotate()
        .resize({
            width: maxPx,
            height: maxPx,
            fit: 'inside',
            withoutEnlargement: true
        })
        .jpeg({ quality: jpegQ, mozjpeg: true })
        .toFile(outputPath);
    const outMeta = await sharp(outputPath).metadata();
    if (typeof log === 'function') {
        log(`Image optimized ${w}x${h} → ${outMeta.width}x${outMeta.height} (max ${maxPx}px, quality ${quality}) for faster upload`);
    }
    return {
        path: outputPath,
        mimeType: 'image/jpeg',
        resized: true,
        width: outMeta.width || w,
        height: outMeta.height || h
    };
}

function ensureDirs(...dirs) {
    dirs.forEach((d) => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
}

function readGalleryIndex(indexPath) {
    try {
        if (!fs.existsSync(indexPath)) return [];
        const raw = fs.readFileSync(indexPath, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

const GALLERY_MAX = 100;

function writeGalleryIndex(indexPath, entries) {
    fs.writeFileSync(indexPath, JSON.stringify(entries.slice(0, GALLERY_MAX), null, 2), 'utf8');
}

function deleteGalleryJobDir(jobsDir, jobId) {
    const safeJob = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeJob) return;
    const jobDir = path.join(jobsDir, safeJob);
    const resolved = path.resolve(jobDir);
    const jobsRoot = path.resolve(jobsDir);
    if (!resolved.startsWith(jobsRoot + path.sep) && resolved !== jobsRoot) return;
    if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true });
    }
}

function addGalleryEntry(indexPath, jobsDir, entry) {
    const gallery = readGalleryIndex(indexPath);
    gallery.unshift(entry);
    while (gallery.length > GALLERY_MAX) {
        const old = gallery.pop();
        if (old?.jobId) deleteGalleryJobDir(jobsDir, old.jobId);
    }
    writeGalleryIndex(indexPath, gallery);
}

function newJobId() {
    return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMode(raw, hasImage, hasPrompt) {
    const m = String(raw || '').trim().toLowerCase();
    if (m === 'auto' || m === 'automatic' || m === 'تلقائي' || m === 'gemini' || m === 'chatgpt' || m === 'gpt') {
        if (hasImage && hasPrompt) return 'image+prompt';
        if (hasImage) return 'image-to-image';
        return 'text-to-image';
    }
    if (m === 'text-to-image' || m === 'text_to_image') return 'text-to-image';
    if (m === 'image-to-image' || m === 'image_to_image') return 'image-to-image';
    if (m === 'image+prompt' || m === 'image_prompt' || m === 'image-and-prompt') return 'image+prompt';
    if (hasImage && hasPrompt) return 'image+prompt';
    if (hasImage) return 'image-to-image';
    return 'text-to-image';
}

function sha256Base64(b64) {
    return crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
}

function sha256File(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isDuplicateOfInput(imagePath, b64) {
    if (!imagePath || !fs.existsSync(imagePath) || !b64) return false;
    try {
        return sha256File(imagePath) === sha256Base64(b64);
    } catch (_) {
        return false;
    }
}

function logCliProxyImageResponse(log, label, { data, images, url, n }) {
    const items = Array.isArray(data?.data) ? data.data : [];
    const b64Count = items.filter((i) => i?.b64_json).length;
    const urlCount = items.filter((i) => i?.url).length;
    log(`${label}: HTTP OK | requested n=${n} | data[]=${items.length} (b64=${b64Count}, url=${urlCount}) | parsed images=${images.length} | endpoint=${url}`);
}

function isRetriableStreamDisconnect(err) {
    const msg = cliProxyErrorCombinedText(err).toLowerCase();
    const cause = String(err?.cause?.message || err?.cause?.code || '').toLowerCase();
    const combined = `${msg} ${cause}`;
    return /stream disconnected|stream error|disconnected before completion|socket hang up|econnreset/i.test(combined);
}

function extractCliProxyRawError(data, text, status) {
    const parts = [];
    const errObj = data?.error;
    if (errObj?.message) parts.push(String(errObj.message));
    if (errObj?.code) parts.push(`code=${errObj.code}`);
    if (errObj?.status) parts.push(String(errObj.status));
    if (data?.message && !parts.length) parts.push(String(data.message));
    if (!parts.length && text) parts.push(String(text).slice(0, 600));
    if (!parts.length) parts.push(`CLIProxy HTTP ${status}`);
    return parts.join(' | ');
}

function sizeToGeminiAspectRatio(size) {
    const s = String(size || '1024x1024').toLowerCase();
    const m = s.match(/^(\d+)x(\d+)$/);
    if (!m) return '1:1';
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (!w || !h) return '1:1';
    const r = w / h;
    if (r >= 1.6) return '16:9';
    if (r >= 1.2) return '4:3';
    if (r <= 0.625) return '9:16';
    if (r <= 0.85) return '3:4';
    return '1:1';
}

function parseChatCompletionImages(data) {
    const images = [];
    const message = data?.choices?.[0]?.message || {};

    if (Array.isArray(message.images)) {
        for (const img of message.images) {
            const url = img?.image_url?.url || img?.url || '';
            if (!url) continue;
            if (url.startsWith('data:')) {
                const b64 = url.replace(/^data:image\/\w+;base64,/, '');
                if (b64) images.push({ b64, revised_prompt: '', url });
            } else if (/^https?:\/\//i.test(url)) {
                images.push({ b64: '', revised_prompt: '', url });
            }
        }
    }

    const content = message.content;
    if (Array.isArray(content)) {
        for (const part of content) {
            const url = part?.image_url?.url || '';
            if (!url) continue;
            if (url.startsWith('data:')) {
                const b64 = url.replace(/^data:image\/\w+;base64,/, '');
                if (b64) images.push({ b64, revised_prompt: '', url });
            } else if (/^https?:\/\//i.test(url)) {
                images.push({ b64: '', revised_prompt: '', url });
            }
        }
    }

    return images;
}

async function resolveChatCompletionImageB64(images, timeoutMs = 30000) {
    const out = [];
    const perUrlMs = Math.max(5000, Math.min(Number(timeoutMs) || 30000, 60000));
    for (const img of images) {
        if (img?.b64) {
            out.push({ b64: img.b64, revised_prompt: img.revised_prompt || '' });
            continue;
        }
        const url = String(img?.url || '').trim();
        if (!url || !/^https?:\/\//i.test(url)) continue;
        const { response: imgRes, buffer: buf } = await fetchAndReadArrayBufferWithTimeout(
            url,
            { method: 'GET' },
            perUrlMs,
            'image'
        );
        if (!imgRes.ok) throw new Error(`Failed to fetch chat image URL HTTP ${imgRes.status}`);
        out.push({ b64: buf.toString('base64'), revised_prompt: img.revised_prompt || '' });
    }
    return out;
}

async function callCliProxyGeminiChatImages({
    baseUrl,
    apiKey,
    model,
    prompt,
    size,
    imagePath,
    mimeType,
    log,
    timeoutMs = null,
    aiProvider = 'gemini',
    signal = null
}) {
    const endpoint = '/chat/completions';
    const url = `${baseUrl.replace(/\/+$/, '')}${endpoint}`;
    const hasInputImage = !!(imagePath && fs.existsSync(imagePath));
    let userContent = prompt;
    if (hasInputImage) {
        const buffer = fs.readFileSync(imagePath);
        const b64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType || 'image/png'};base64,${b64}`;
        userContent = [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt }
        ];
    }

    const body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        modalities: ['image', 'text'],
        stream: false,
        image_config: {
            aspect_ratio: sizeToGeminiAspectRatio(size)
        }
    });
    const imageTimeout = timeoutMs || getGeminiAttemptTimeoutMs();
    const { response, text } = await fetchAndReadTextWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body,
        signal: signal || undefined
    }, imageTimeout, 'image', baseUrl);

    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = { raw: text };
    }

    if (!response.ok) {
        const rawMsg = extractCliProxyRawError(data, text, response.status);
        const err = new Error(mapCliProxyErrorMessageAr(rawMsg, {
            requestedModel: model,
            availableModels: _imageModelsCache.available,
            rawModelIds: _imageModelsCache.rawIds || _imageModelsCache.available,
            aiProvider,
            httpStatus: response.status,
            endpoint: url,
            baseUrl
        }));
        err.rawMessage = rawMsg;
        err.httpStatus = response.status;
        err.endpoint = url;
        err.endpointPath = cliproxyEndpointPath(url);
        err.model = model;
        throw err;
    }

    const parsed = parseChatCompletionImages(data);
    const images = await resolveChatCompletionImageB64(parsed, Math.min(30000, imageTimeout));

    if (typeof log === 'function') {
        log(`CLIProxy Gemini chat response: HTTP OK | message.images=${parsed.length} | parsed b64=${images.length} | endpoint=${url}`);
    }

    if (!images.length) {
        throw new Error('CLIProxy Gemini chat returned no images. تحقق من modalities ومصادقة Gemini في CLIProxy.');
    }

    return { images, endpoint: url, model, rawData: data, route: 'gemini-chat' };
}

/** Route Gemini/Imagen to /chat/completions; OpenAI-style models to /images/*. */
async function callCliProxyImageGeneration(opts) {
    const model = String(opts?.model || '').trim();
    if (prefersGeminiChatImageRoute(model)) {
        return callCliProxyGeminiChatImages(opts);
    }
    const endpoint = String(opts?.endpoint || '').trim();
    if (!endpoint || endpoint === 'undefined') {
        const err = new Error('مسار CLIProxy غير مُعرَّف — المتوقع /images/generations أو /images/edits');
        err.endpointPath = '/v1/images/generations';
        throw err;
    }
    return callCliProxyImages({ ...opts, endpoint });
}

async function callCliProxyImages({
    baseUrl,
    apiKey,
    endpoint,
    model,
    prompt,
    count,
    size,
    imagePath,
    mimeType,
    log,
    timeoutMs = null,
    stream = false,
    signal = null
}) {
    const ep = String(endpoint || '').trim();
    if (!ep || ep === 'undefined') {
        const err = new Error('مسار CLIProxy غير مُعرَّف (endpoint) — المتوقع /images/generations أو /images/edits');
        err.endpointPath = '/v1/images/generations';
        throw err;
    }
    const url = `${baseUrl.replace(/\/+$/, '')}${ep}`;
    const n = Math.max(1, Math.min(10, Number(count) || 4));
    const safeSize = String(size || '1024x1024');

    let response;
    let text;
    if (ep === '/images/edits' && imagePath && fs.existsSync(imagePath)) {
        const form = new FormData();
        form.append('model', model);
        form.append('prompt', prompt);
        form.append('n', String(n));
        form.append('size', safeSize);
        form.append('stream', 'false');
        const buffer = fs.readFileSync(imagePath);
        const blob = new Blob([buffer], { type: mimeType || 'image/png' });
        form.append('image', blob, path.basename(imagePath));

        const imageTimeout = timeoutMs || getProviderAttemptTimeoutMs();
        ({ response, text } = await fetchAndReadTextWithTimeout(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: signal || undefined
        }, imageTimeout, 'image', baseUrl));
    } else {
        const body = JSON.stringify({
            model,
            prompt,
            n,
            size: safeSize,
            stream: false
        });
        const imageTimeout = timeoutMs || getProviderAttemptTimeoutMs();
        ({ response, text } = await fetchAndReadTextWithTimeout(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body,
            signal: signal || undefined
        }, imageTimeout, 'image', baseUrl));
    }

    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = { raw: text };
    }

    if (!response.ok) {
        const rawMsg = extractCliProxyRawError(data, text, response.status);
        const err = new Error(mapCliProxyErrorMessageAr(rawMsg, {
            requestedModel: model,
            availableModels: _imageModelsCache.available,
            rawModelIds: _imageModelsCache.rawIds || _imageModelsCache.available,
            httpStatus: response.status,
            endpoint: url,
            baseUrl
        }));
        err.rawMessage = rawMsg;
        err.httpStatus = response.status;
        err.endpoint = url;
        err.endpointPath = cliproxyEndpointPath(url);
        err.model = model;
        throw err;
    }

    const images = [];
    for (const item of Array.isArray(data?.data) ? data.data : []) {
        if (item?.b64_json) {
            images.push({ b64: item.b64_json, revised_prompt: item.revised_prompt || '' });
        } else if (item?.url) {
            const { response: imgRes, buffer: buf } = await fetchAndReadArrayBufferWithTimeout(
                item.url,
                { method: 'GET' },
                30000,
                'image',
                baseUrl
            );
            if (!imgRes.ok) throw new Error(`Failed to fetch image URL HTTP ${imgRes.status}`);
            images.push({ b64: buf.toString('base64'), revised_prompt: item.revised_prompt || '' });
        }
    }

    if (typeof log === 'function') {
        logCliProxyImageResponse(log, 'CLIProxy response', { data, images, url, n });
    }

    if (!images.length) {
        throw new Error('CLIProxy returned no images. Check model supports images/generations or images/edits.');
    }

    return { images, endpoint: url, model, rawData: data };
}

/** Retry on stream disconnect / transient network errors — always non-stream (stream:false). */
async function callCliProxyImagesWithRetry(opts, { maxRetries = 3, log, label = 'CLIProxy image' } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            return await callCliProxyImageGeneration({ ...opts, stream: false });
        } catch (err) {
            lastErr = err;
            const retriable = isRetriableStreamDisconnect(err) || isCliProxyConnectionError(err);
            if (attempt < maxRetries && retriable) {
                const waitMs = 1500 * (attempt + 1);
                if (typeof log === 'function') {
                    log(`${label}: retry ${attempt + 1}/${maxRetries} non-stream after ${err.message} (wait ${waitMs}ms)`, 'WARN');
                }
                await sleepMs(waitMs);
                continue;
            }
            throw err;
        }
    }
    throw lastErr || new Error(`${label} failed`);
}

/**
 * Single API call (n=1): one composite image with 2x2 grid of variations.
 * Rejects output identical to uploaded reference (passthrough), retries up to 3 times.
 */
function isRetriableImageModelError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    return /auth_unavailable|no auth available|is not supported on.*images\/generations|model.*not supported/i.test(msg);
}

function parseAutoFallbackGeminiFlag(raw) {
    if (raw === undefined || raw === null || raw === '') return true;
    const v = String(raw).trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
    return true;
}

/** Gemini fallback after GPT failure — only in explicit auto mode, never when user chose ChatGPT/Gemini. */
function isGptProviderForGeminiFallback(aiProvider) {
    return normalizeAiProvider(aiProvider) === 'auto';
}

function resolveEffectiveAutoFallbackGemini(aiProvider, rawFlag) {
    if (!isGptProviderForGeminiFallback(aiProvider)) return false;
    return parseAutoFallbackGeminiFlag(rawFlag);
}

function enrichExplicitProviderImageError(err, aiProvider) {
    const p = normalizeAiProvider(aiProvider);
    if (p !== 'chatgpt' && p !== 'gemini') return err;
    const base = String(err?.message || err?.rawMessage || err || '').trim();
    const suffix = p === 'chatgpt'
        ? 'وضع ChatGPT: فشل gpt-image-2 فقط — لا تراجع تلقائي إلى Gemini.'
        : 'وضع Gemini: فشل توليد Gemini — لا تراجع تلقائي إلى ChatGPT.';
    if (base.includes('لا تراجع تلقائي')) return err;
    const wrapped = new Error(base ? `${base}\n\n${suffix}` : suffix);
    wrapped.httpStatus = err?.httpStatus;
    wrapped.endpoint = err?.endpoint;
    wrapped.rawMessage = err?.rawMessage || base;
    wrapped.code = err?.code;
    return wrapped;
}

function isGeminiQuotaExhaustedError(err) {
    const combined = cliProxyErrorCombinedText(err).toLowerCase();
    return /exhausted your (reporting|quota)|quota.*exhausted|rate.?limit|resource_exhausted|429|reset after/i.test(combined)
        || Number(err?.httpStatus) === 429;
}

function isGptFailureEligibleForGeminiFallback(err) {
    const combined = cliProxyErrorCombinedText(err).toLowerCase();
    const httpStatus = Number(err?.httpStatus) || 0;
    if ([400, 401, 403, 429, 502].includes(httpStatus) || httpStatus >= 500) return true;
    if (isRetriableStreamDisconnect(err) || isCliProxyConnectionError(err)) return true;
    if (/auth_unavailable|no auth available|codex|oauth|unauthorized|invalid.*api.*key|providers=codex/i.test(combined)) {
        return true;
    }
    if (isRetriableImageModelError(err)) return true;
    if (/is not supported on.*images/i.test(combined)) return true;
    return false;
}

function isGeminiFailureEligibleForGptFallback(err) {
    const combined = cliProxyErrorCombinedText(err).toLowerCase();
    const httpStatus = Number(err?.httpStatus) || 0;
    if (isGeminiQuotaExhaustedError(err)) return true;
    if ([400, 401, 403, 429, 502].includes(httpStatus) || httpStatus >= 500) return true;
    if (isRetriableStreamDisconnect(err) || isCliProxyConnectionError(err)) return true;
    if (/auth_unavailable|no auth available|unauthorized|invalid.*api.*key|model.*not/i.test(combined)) return true;
    return false;
}

function resolveGeminiFallbackModel(availableModels = [], rawModelIds = null) {
    return findGeminiImageModel(availableModels, rawModelIds) || 'gemini-3.1-flash-image';
}

function buildProviderFailureMessage({ gptErr = null, geminiErr = null, gptTried = false, geminiTried = false, baseUrl = '' } = {}) {
    const gptMsg = gptErr ? String(gptErr?.message || gptErr?.rawMessage || gptErr || '').trim() : '';
    const geminiMsg = geminiErr ? String(geminiErr?.message || geminiErr?.rawMessage || geminiErr || '').trim() : '';
    const proxyNote = baseUrl ? `\nCLIProxy: ${baseUrl}` : '';
    if (gptTried && geminiTried) {
        return [
            'فشل التوليد عبر ChatGPT/gpt-image-2، ثم فشل أيضاً Gemini:',
            `ChatGPT: ${gptMsg || '(بدون تفاصيل)'}`,
            `Gemini: ${geminiMsg || '(بدون تفاصيل)'}`,
            proxyNote.trim()
        ].filter(Boolean).join('\n');
    }
    if (gptTried && !geminiTried) {
        return [
            'فشل التوليد عبر ChatGPT/gpt-image-2 فقط — لم تُجرَّب Gemini بعد.',
            gptMsg,
            proxyNote.trim()
        ].filter(Boolean).join('\n');
    }
    if (geminiTried && !gptTried) {
        return [
            'فشل التوليد عبر Gemini فقط — لم يُجرَّب ChatGPT/gpt-image-2 بعد.',
            geminiMsg,
            isGeminiQuotaExhaustedError(geminiErr)
                ? 'حصة Gemini مستنفدة — جرّب وضع ChatGPT أو شغّل CLIProxy المحلي (8317) مع Codex.'
                : '',
            proxyNote.trim()
        ].filter(Boolean).join('\n');
    }
    return gptMsg || geminiMsg || 'فشل التوليد';
}

function buildCombinedGptGeminiErrorMessage(gptErr, geminiErr) {
    return buildProviderFailureMessage({
        gptErr,
        geminiErr,
        gptTried: true,
        geminiTried: true
    });
}

async function tryGeminiImageFallback({
    gptErr,
    baseUrl,
    apiKey,
    prompt,
    size,
    imagePath,
    mimeType,
    log,
    availableModels,
    rawModelIds,
    rootDir,
    req,
    timeoutMs,
    onFallbackStart
}) {
    if (typeof onFallbackStart === 'function') onFallbackStart();
    if (typeof log === 'function') {
        log('[INFO] GPT failed, trying Gemini fallback...', 'INFO');
    }
    const geminiModel = resolveGeminiFallbackModel(availableModels, rawModelIds);
    const geminiTimeout = timeoutMs || getGeminiAttemptTimeoutMs();
    const hardDeadlineMs = geminiTimeout + 10000;
    const hardAbort = new AbortController();
    // Prefer local CLIProxy when online (same path as GPT) — avoid hanging on dead remote.
    let geminiBase = baseUrl;
    try {
        const result = await withHardTimeout((async () => {
            const geminiCfg = await getProviderCliProxyConfigPreferred(rootDir, req, 'gemini');
            geminiBase = geminiCfg.baseUrl || baseUrl;
            const geminiKey = geminiCfg.apiKey || apiKey;
            return callCliProxyGeminiChatImages({
                baseUrl: geminiBase,
                apiKey: geminiKey,
                model: geminiModel,
                prompt,
                size,
                imagePath,
                mimeType,
                log,
                timeoutMs: geminiTimeout,
                aiProvider: 'gemini',
                signal: hardAbort.signal
            });
        })(), hardDeadlineMs, 'image', hardAbort);

        return {
            ...result,
            modelUsed: result.model,
            fallbackFrom: 'gpt-image-2',
            gptError: String(gptErr?.message || gptErr?.rawMessage || '').slice(0, 500)
        };
    } catch (geminiErr) {
        const err = new Error(buildProviderFailureMessage({
            gptErr,
            geminiErr,
            gptTried: true,
            geminiTried: true,
            baseUrl: geminiBase
        }));
        err.httpStatus = geminiErr?.httpStatus || gptErr?.httpStatus || 502;
        err.endpoint = geminiErr?.endpoint || gptErr?.endpoint || '';
        err.rawMessage = `${gptErr?.rawMessage || ''} | Gemini: ${geminiErr?.rawMessage || ''}`;
        err.gptError = gptErr;
        err.geminiError = geminiErr;
        err.fallbackAttempted = true;
        err.gptTried = true;
        err.geminiTried = true;
        throw err;
    }
}

async function tryChatGptImageFallback({
    geminiErr,
    baseUrl,
    apiKey,
    prompt,
    size,
    imagePath,
    mimeType,
    log,
    availableModels,
    endpoint,
    timeoutMs,
    onFallbackStart
}) {
    if (typeof onFallbackStart === 'function') onFallbackStart();
    if (typeof log === 'function') {
        log('[INFO] Gemini failed, trying ChatGPT/gpt-image-2 via CLIProxy...', 'INFO');
    }
    const gptModel = findChatGptImageModel(availableModels) || NHP_DEFAULT_IMAGE_MODEL;
    try {
        const result = await callCliProxyImagesWithRetry({
            baseUrl,
            apiKey,
            endpoint: endpoint || '/images/generations',
            model: gptModel,
            prompt,
            count: 1,
            size,
            imagePath,
            mimeType,
            log,
            aiProvider: 'chatgpt',
            stream: false,
            timeoutMs: timeoutMs || getProviderAttemptTimeoutMs()
        }, { maxRetries: 1, log, label: 'Generate GPT fallback' });
        return {
            ...result,
            modelUsed: result.model,
            fallbackFrom: 'gemini',
            geminiError: String(geminiErr?.message || geminiErr?.rawMessage || '').slice(0, 500)
        };
    } catch (gptErr) {
        const err = new Error(buildProviderFailureMessage({
            gptErr,
            geminiErr,
            gptTried: true,
            geminiTried: true,
            baseUrl
        }));
        err.httpStatus = gptErr?.httpStatus || geminiErr?.httpStatus || 502;
        err.endpoint = gptErr?.endpoint || geminiErr?.endpoint || '';
        err.rawMessage = `Gemini: ${geminiErr?.rawMessage || ''} | GPT: ${gptErr?.rawMessage || ''}`;
        err.gptError = gptErr;
        err.geminiError = geminiErr;
        err.fallbackAttempted = true;
        err.gptTried = true;
        err.geminiTried = true;
        throw err;
    }
}

/**
 * When primary base fails (connection OR auth/401), retry once on the alternate host.
 * Cloud primary → local backup (nhp-local-cliproxy-key). Local → cloud with SEO key.
 */
function isCliProxyAuthFailoverError(err) {
    const status = Number(err?.httpStatus) || 0;
    if (status === 401 || status === 403 || status === 503) return true;
    const combined = `${err?.message || ''} ${err?.rawMessage || ''} ${err?.code || ''}`.toLowerCase();
    return /unauthorized|invalid api key|auth_unavailable|no auth available|مفتاح api غير صالح|api key not valid/.test(combined);
}

async function withCliProxyBaseFailover(primaryBase, apiKey, runOnce, log, opts = {}) {
    const primary = normalizeCliProxyBaseUrl(primaryBase);
    const alternate = isLocalCliProxyBaseUrl(primary)
        ? DEFAULT_RENDER_CLIPROXY_BASE_URL
        : DEFAULT_LOCAL_CLIPROXY_BASE_URL;
    try {
        return await runOnce(primary, apiKey);
    } catch (firstErr) {
        const allowAuthFailover = isCliProxyAuthFailoverError(firstErr);
        if (!isCliProxyConnectionError(firstErr) && !allowAuthFailover) throw firstErr;
        let altKey;
        if (isLocalCliProxyBaseUrl(alternate)) {
            // Cloud primary failed → local backup always uses gateway key.
            altKey = LOCAL_CLIPROXY_DEFAULT_API_KEY;
        } else {
            altKey = resolveCliProxyBearerKey(
                alternate,
                String(opts.cloudApiKey || opts.requestCloudApiKey || opts.requestApiKey || apiKey || '').trim()
            );
            if (!altKey || isLocalCliProxyGatewayKey(altKey)) {
                // Local failed and no SEO/cloud key — keep original error (do not invent a hard block).
                throw firstErr;
            }
        }
        const altOnline = await probeCliProxyOnline(alternate, altKey);
        if (!altOnline) throw firstErr;
        if (typeof log === 'function') {
            const reason = allowAuthFailover ? 'auth/401' : 'connection';
            log(`[WARN] CLIProxy ${primary} failed (${reason}) — retrying on ${alternate}`, 'WARN');
        }
        try {
            const result = await runOnce(alternate, altKey);
            return { ...result, baseUrlUsed: alternate, failoverFrom: primary };
        } catch (secondErr) {
            secondErr.priorError = firstErr;
            secondErr.triedBases = [primary, alternate];
            throw secondErr;
        }
    }
}

async function generateCompositeGridImage({
    baseUrl,
    apiKey,
    cloudApiKey = '',
    requestApiKey = '',
    endpoint,
    model,
    prompt,
    size,
    imagePath,
    mimeType,
    log,
    onProgress,
    quality,
    mode,
    aiProvider = 'auto',
    availableModels = null,
    rawModelIds = null,
    autoFallbackGemini = true,
    rootDir = '',
    req = null,
    onFallbackStart = null,
    onGptFallbackStart = null
}) {
    const compositePrompt = `${prompt}\n\n${NO_PIXEL_COPY_RULE}`;
    const maxAttempts = 3;
    const provider = normalizeAiProvider(aiProvider);
    const safePrimary = sanitizeImageModelChoice(model, availableModels);
    let modelCandidates = chooseImageModelCandidates({ quality, mode, aiProvider, availableModels });
    if (safePrimary && !modelCandidates.includes(safePrimary)) modelCandidates.unshift(safePrimary);
    const useGptGeminiFallback = resolveEffectiveAutoFallbackGemini(aiProvider, autoFallbackGemini);
    const geminiPrimary = provider === 'gemini'
        || prefersGeminiChatImageRoute(safePrimary || modelCandidates[0] || '');
    if (useGptGeminiFallback && !geminiPrimary) {
        modelCandidates = modelCandidates.filter((m) => !prefersGeminiChatImageRoute(m));
        if (!modelCandidates.length) modelCandidates = [safePrimary || NHP_DEFAULT_IMAGE_MODEL];
    }
    let modelIndex = 0;
    let activeModel = modelCandidates[modelIndex] || safePrimary || NHP_DEFAULT_IMAGE_MODEL;

    if (typeof onProgress === 'function') {
        onProgress(0, 1, stageLabelForGenerating());
    }

    const runImageOnce = (activeBase, activeKey, modelId) => {
        const attemptTimeout = prefersGeminiChatImageRoute(modelId)
            ? getGeminiAttemptTimeoutMs()
            : getProviderAttemptTimeoutMs();
        const hardAbort = new AbortController();
        return withHardTimeout(
            callCliProxyImagesWithRetry({
                baseUrl: activeBase,
                apiKey: activeKey,
                endpoint: prefersGeminiChatImageRoute(modelId) ? null : endpoint,
                model: modelId,
                prompt: compositePrompt,
                count: 1,
                size,
                imagePath,
                mimeType,
                log,
                aiProvider,
                stream: false,
                timeoutMs: attemptTimeout,
                signal: hardAbort.signal
            }, { maxRetries: 1, log, label: 'Generate composite' }),
            attemptTimeout + 8000,
            'image',
            hardAbort
        );
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const attemptTimeoutLog = prefersGeminiChatImageRoute(activeModel)
            ? getGeminiAttemptTimeoutMs()
            : getProviderAttemptTimeoutMs();
        log(`Composite 2x2 grid: attempt ${attempt}/3 (n=1 single image) model=${activeModel} base=${baseUrl} non-stream timeout=${attemptTimeoutLog}ms`);
        let result;
        try {
            result = await withCliProxyBaseFailover(
                baseUrl,
                apiKey,
                (activeBase, activeKey) => runImageOnce(activeBase, activeKey, activeModel),
                log,
                { cloudApiKey, requestApiKey, requestCloudApiKey: cloudApiKey || requestApiKey }
            );
        } catch (imgErr) {
            const nextIdx = modelIndex + 1;
            if (isRetriableImageModelError(imgErr) && nextIdx < modelCandidates.length) {
                activeModel = modelCandidates[nextIdx];
                modelIndex = nextIdx;
                log(`Composite grid: retry with fallback model ${activeModel}`, 'WARN');
                attempt -= 1;
                continue;
            }
            // Auto: GPT → Gemini; or Gemini quota → GPT via CLIProxy
            if (useGptGeminiFallback && isGptFailureEligibleForGeminiFallback(imgErr) && !prefersGeminiChatImageRoute(activeModel)) {
                result = await tryGeminiImageFallback({
                    gptErr: imgErr,
                    baseUrl,
                    apiKey,
                    prompt: compositePrompt,
                    size,
                    imagePath,
                    mimeType,
                    log,
                    availableModels,
                    rawModelIds,
                    rootDir,
                    req,
                    timeoutMs: getGeminiAttemptTimeoutMs(),
                    onFallbackStart
                });
            } else if (
                (useGptGeminiFallback || provider === 'gemini')
                && isGeminiFailureEligibleForGptFallback(imgErr)
                && (provider === 'gemini' || prefersGeminiChatImageRoute(activeModel) || isGeminiQuotaExhaustedError(imgErr))
            ) {
                // Gemini exhausted/failed — still try GPT on CLIProxy (prefer local).
                const gptCfg = await getCliProxyConfigPreferred(rootDir, {
                    baseUrl,
                    apiKey
                });
                result = await tryChatGptImageFallback({
                    geminiErr: imgErr,
                    baseUrl: gptCfg.baseUrl || baseUrl,
                    apiKey: gptCfg.apiKey || apiKey,
                    prompt: compositePrompt,
                    size,
                    imagePath,
                    mimeType,
                    log,
                    availableModels,
                    endpoint: endpoint || '/images/generations',
                    timeoutMs: getProviderAttemptTimeoutMs(),
                    onFallbackStart: onGptFallbackStart || onFallbackStart
                });
            } else {
                throw enrichExplicitProviderImageError(imgErr, aiProvider);
            }
        }
        const img = result.images[0];
        if (!img?.b64) continue;

        if (imagePath && isDuplicateOfInput(imagePath, img.b64)) {
            log('Composite grid: rejected — identical to uploaded reference (passthrough)', 'WARN');
            continue;
        }

        if (typeof onProgress === 'function') {
            onProgress(1, 1, STAGE_LABELS.saving);
        }

        return {
            images: [img],
            endpoint: result.endpoint,
            model: result.model,
            modelUsed: result.modelUsed || result.model,
            fallbackFrom: result.fallbackFrom || null,
            baseUrlUsed: result.baseUrlUsed || baseUrl,
            strategy: 'composite-grid-2x2-single-call'
        };
    }

    throw new Error(
        'تعذّر توليد شبكة التصاميم — المخرج مطابق للصورة المرجعية. جرّب وصفاً إضافياً أو جودة أعلى.'
    );
}

async function callCliProxyVision({ baseUrl, apiKey, imagePath, mimeType, log }) {
    const model = chooseVisionModel();
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const buffer = fs.readFileSync(imagePath);
    const b64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType || 'image/png'};base64,${b64}`;

    const body = JSON.stringify({
        model,
        messages: [
            { role: 'system', content: VISION_ANALYSIS_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'text', text: VISION_ANALYSIS_USER_TEXT },
                    { type: 'image_url', image_url: { url: dataUrl } }
                ]
            }
        ],
        max_tokens: 1400,
        temperature: 0.25
    });

    const responsePayload = await fetchAndReadTextWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body
    }, TIMEOUT_VISION_MS, 'vision', baseUrl);
    const response = responsePayload.response;
    const text = responsePayload.text;

    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = null;
    }

    if (!response.ok) {
        const rawMsg = data?.error?.message || data?.message || text || `Vision HTTP ${response.status}`;
        throw new Error(mapCliProxyErrorMessageAr(rawMsg, { availableModels: _imageModelsCache.available }));
    }

    const content = data?.choices?.[0]?.message?.content;
    const raw = typeof content === 'string'
        ? content
        : Array.isArray(content)
            ? content.map((c) => c?.text || '').join('')
            : '';
    const vision = parseVisionAnalysis(raw);
    if (!vision) {
        throw new Error('Vision model returned unparseable analysis');
    }
    if (typeof log === 'function') {
        log(`Vision OK (${model}): ${vision.subject || 'reference'} | styles=${(vision.recommendedStyles || []).join(', ')}`);
    }
    return { vision, model, raw: raw.slice(0, 4000) };
}


function buildDesignRowsFromStorageMeta(storageId, meta, libDir) {
    if (!storageId || !meta) return [];
    const createdAt = meta.createdAt || new Date().toISOString();
    const splits = listSplitFilesFromMeta(meta, libDir);
    const base = {
        jobId: meta.jobId ?? null,
        createdAt,
        promptPreview: meta.promptPreview || String(meta.prompt || '').slice(0, 120),
        batchIndex: meta.batchIndex ?? 1,
        batchTotal: meta.batchTotal ?? 1
    };
    if (meta.source) base.source = meta.source;
    if (meta.originalDesignId) base.originalDesignId = meta.originalDesignId;
    if (meta.versionLabel) base.versionLabel = meta.versionLabel;

    if (splits.length) {
        return splits.map((f, i) => {
            const designId = `${storageId}__d${i + 1}`;
            const displayName = f.displayName
                || (Array.isArray(meta.displayNames) ? meta.displayNames[i] : '')
                || meta.displayName
                || '';
            const row = {
                ...base,
                id: designId,
                storageId,
                designIndex: i + 1,
                designTotal: splits.length,
                fileName: f.name,
                thumbUrl: `/api/library/${storageId}/file/${f.name}`,
                role: 'design',
                displayName
            };
            if (displayName) row.title = displayName;
            return row;
        });
    }
    const fileName = safeLibraryFileSegment(meta.compositeFilename) || 'composite.png';
    const displayName = sanitizeDisplayName(meta.displayName || meta.promptPreview || '');
    const designId = `${storageId}__d1`;
    const row = {
        ...base,
        id: designId,
        storageId,
        designIndex: 1,
        designTotal: 1,
        fileName,
        thumbUrl: `/api/library/${storageId}/file/${fileName}`,
        role: 'design',
        displayName
    };
    if (displayName) row.title = displayName;
    return [row];
}

function indexedLibraryStorageIds(index) {
    const out = new Set();
    for (const e of index) {
        if (e?.storageId) out.add(e.storageId);
        else if (e?.id) {
            const m = String(e.id).match(/^(.+)__d\d+$/i);
            out.add(m ? m[1] : e.id);
        }
    }
    return out;
}

/** lib_* = generated batches; canva_* = Canva/TeeMaster edited saves (must stay in index). */
function isLibraryStorageFolderName(name) {
    return /^(lib_|canva_)/i.test(String(name || ''));
}

function libraryIndexNeedsReconcile(libraryDir, index) {
    const indexedStorage = indexedLibraryStorageIds(index);
    if (!fs.existsSync(libraryDir)) return index.length > 0;
    try {
        for (const ent of fs.readdirSync(libraryDir, { withFileTypes: true })) {
            if (!ent.isDirectory() || !isLibraryStorageFolderName(ent.name)) continue;
            if (!indexedStorage.has(ent.name)) return true;
        }
    } catch (_) { /* ignore */ }
    for (const sid of indexedStorage) {
        if (!isLibraryStorageFolderName(sid)) continue;
        if (!fs.existsSync(path.join(libraryDir, sid))) return true;
    }
    return false;
}

/** Rebuild missing index rows from on-disk meta.json (recovers after index overwrite races). */
function reconcileLibraryIndexFromDisk(libraryDir, existingIndex, readMetaFn) {
    const byId = new Map();
    for (const entry of existingIndex) {
        if (entry?.id) byId.set(entry.id, { ...entry });
    }

    if (fs.existsSync(libraryDir)) {
        for (const ent of fs.readdirSync(libraryDir, { withFileTypes: true })) {
            if (!ent.isDirectory() || !isLibraryStorageFolderName(ent.name)) continue;
            const storageId = ent.name;
            const libDir = path.join(libraryDir, storageId);
            const meta = readMetaFn(libDir);
            if (!meta) continue;
            const rows = buildDesignRowsFromStorageMeta(storageId, meta, libDir);
            for (const row of rows) {
                if (!libraryEntryHasImageFile(libraryDir, row)) continue;
                const existing = byId.get(row.id);
                byId.set(row.id, existing
                    ? {
                        ...row,
                        ...existing,
                        storageId,
                        thumbUrl: existing.thumbUrl || row.thumbUrl
                    }
                    : row);
            }
        }
    }

    const out = [];
    for (const entry of byId.values()) {
        if (!libraryEntryHasImageFile(libraryDir, entry)) continue;
        const storageId = entry.storageId || String(entry.id).replace(/__d\d+$/i, '');
        if (!storageId || !isLibraryStorageFolderName(storageId)) continue;
        if (!fs.existsSync(path.join(libraryDir, storageId))) continue;
        out.push(entry);
    }
    out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return out.slice(0, 500);
}

function flattenLibraryIndexForDesigns(rawIndex, readMetaFn, libraryDir) {
    const seen = new Set();
    const out = [];
    for (const item of rawIndex) {
        if (item.role === 'design' || item.designIndex) {
            if (!seen.has(item.id) && libraryEntryHasImageFile(libraryDir, item)) {
                seen.add(item.id);
                out.push({
                    ...item,
                    displayName: item.displayName || item.title || ''
                });
            }
            continue;
        }
        const libDirForItem = path.join(libraryDir, item.id);
        const meta = readMetaFn(libDirForItem);
        let splits = (meta?.files || []).filter((f) =>
            f.role === 'split'
            || /^design_\d+\.png$/i.test(f.name)
            || /^split_\d+\.png$/i.test(f.name)
        );
        if (!splits.length) {
            splits = listSplitFilesFromMeta(meta, libDirForItem);
        }
        if (splits.length) {
            splits.forEach((f, i) => {
                const designId = `${item.id}__d${i + 1}`;
                if (seen.has(designId)) return;
                const row = {
                    id: designId,
                    storageId: item.id,
                    jobId: item.jobId,
                    createdAt: item.createdAt,
                    promptPreview: item.promptPreview,
                    displayName: f.displayName
                        || (Array.isArray(meta?.displayNames) ? meta.displayNames[i] : '')
                        || item.displayName
                        || item.title
                        || '',
                    batchIndex: item.batchIndex,
                    batchTotal: item.batchTotal,
                    designIndex: i + 1,
                    designTotal: splits.length,
                    fileName: f.name,
                    thumbUrl: `/api/library/${item.storageId || item.id.replace(/__d\d+$/i, '') || item.id}/file/${f.name}`,
                    role: 'design'
                };
                if (!libraryEntryHasImageFile(libraryDir, row)) return;
                seen.add(designId);
                out.push(row);
            });
        } else {
            if (!seen.has(item.id)) {
                const row = {
                    ...item,
                    storageId: item.id,
                    fileName: 'composite.png',
                    designIndex: 1,
                    designTotal: 1,
                    thumbUrl: item.thumbUrl || `/api/library/${item.storageId || item.id}/file/composite.png`,
                    role: 'design'
                };
                if (!libraryEntryHasImageFile(libraryDir, row)) continue;
                seen.add(item.id);
                out.push(row);
            }
        }
    }
    return out;
}

function registerGenerateApi(app, { rootDir: rootDirInput, logFn = console.log }) {
    const rootDir = resolveNhpProjectRoot(
        path.resolve(__dirname, '..'),
        rootDirInput,
        process.env.NHP_ROOT_DIR,
        process.env.NHP_ROOT,
        process.cwd()
    );
    const log = (msg, level = 'INFO') => {
        if (typeof logFn === 'function') logFn(msg, level);
        else console.log(`[${level}] ${msg}`);
    };
    if (path.resolve(String(rootDirInput || '')) !== rootDir) {
        log(`Library root corrected: ${rootDirInput || '(empty)'} → ${rootDir}`, 'WARN');
    }
    loadEnvFile(rootDir);
    const GENERATE_SERVER_MAX_CONCURRENT = Math.max(
        1,
        Math.min(5, Number(process.env.NHP_GENERATE_MAX_CONCURRENT) || 1)
    );
    let generateServerActiveJobs = 0;
    const GENERATED_DIR = path.join(rootDir, 'generated_designs');
    const JOBS_DIR = path.join(GENERATED_DIR, 'jobs');
    const LIBRARY_DIR = path.join(GENERATED_DIR, 'library');
    const LIBRARY_INDEX = path.join(LIBRARY_DIR, 'index.json');
    const GALLERY_INDEX = path.join(GENERATED_DIR, 'gallery-index.json');
    const INPUT_DIR = path.join(rootDir, 'temp_uploads', 'generate_inputs');

    ensureDirs(GENERATED_DIR, JOBS_DIR, LIBRARY_DIR, INPUT_DIR);
    log(`Library directory: ${LIBRARY_DIR}`);

    function readLibraryIndex() {
        try {
            if (!fs.existsSync(LIBRARY_INDEX)) return [];
            const parsed = JSON.parse(fs.readFileSync(LIBRARY_INDEX, 'utf8'));
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function writeLibraryIndex(entries) {
        fs.writeFileSync(LIBRARY_INDEX, JSON.stringify(entries.slice(0, 500), null, 2), 'utf8');
    }

    let libraryIndexMutex = Promise.resolve();
    function runLibraryIndexLocked(task) {
        const next = libraryIndexMutex.then(() => task());
        libraryIndexMutex = next.catch(() => {});
        return next;
    }

    function updateLibraryIndex(mutator) {
        return runLibraryIndexLocked(() => {
            const current = readLibraryIndex();
            const next = mutator(current);
            if (Array.isArray(next)) writeLibraryIndex(next);
            return next;
        });
    }

    function ensureLibraryIndexSynced() {
        const raw = readLibraryIndex();
        if (!libraryIndexNeedsReconcile(LIBRARY_DIR, raw)) return raw;
        const reconciled = reconcileLibraryIndexFromDisk(LIBRARY_DIR, raw, readLibraryMeta);
        if (reconciled.length !== raw.length
            || JSON.stringify(reconciled) !== JSON.stringify(raw)) {
            writeLibraryIndex(reconciled);
            log(`Library index reconciled from disk: ${raw.length} → ${reconciled.length} entries`, 'WARN');
        }
        return reconciled;
    }

    function readLibraryMeta(libDir) {
        const metaPath = path.join(libDir, 'meta.json');
        try {
            if (!fs.existsSync(metaPath)) return null;
            return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (_) {
            return null;
        }
    }

    async function saveBatchToLibrary({
        jobId,
        prompt,
        batchIndex,
        batchTotal,
        compositePath,
        compositeFilename,
        vision = null,
        noteContext = null
    }) {
        const libId = newLibraryId();
        const libDir = path.join(LIBRARY_DIR, libId);
        ensureDirs(libDir);
        const compositeBuf = fs.readFileSync(compositePath);
        const compositeName = 'composite.png';
        fs.writeFileSync(path.join(libDir, compositeName), compositeBuf);

        const files = [{ name: compositeName, role: 'composite', url: `/api/library/${libId}/file/${compositeName}` }];
        let splits = [];
        try {
            splits = await splitCompositeBufferToPngs(compositeBuf);
            for (const s of splits) {
                fs.writeFileSync(path.join(libDir, s.name), s.buffer);
                files.push({ name: s.name, role: 'split', url: `/api/library/${libId}/file/${s.name}` });
            }
        } catch (splitErr) {
            log(`Library ${libId}: split skipped — ${splitErr.message}`, 'WARN');
        }

        const thumbPath = path.join(libDir, 'thumb.webp');
        try {
            await sharp(compositeBuf)
                .resize(120, 120, { fit: 'cover', position: 'centre' })
                .webp({ quality: 72 })
                .toFile(thumbPath);
        } catch (_) {
            try {
                await sharp(compositeBuf).resize(120, 120, { fit: 'cover' }).jpeg({ quality: 75 }).toFile(path.join(libDir, 'thumb.jpg'));
            } catch (_) { /* ignore */ }
        }

        const createdAt = new Date().toISOString();
        const meta = {
            id: libId,
            jobId,
            createdAt,
            prompt: String(prompt || '').slice(0, 2000),
            promptPreview: String(prompt || '').slice(0, 120),
            batchIndex,
            batchTotal,
            compositeFilename,
            vision: vision || null,
            noteContext: Array.isArray(noteContext) ? noteContext.slice(0, 60) : null,
            files
        };
        fs.writeFileSync(path.join(libDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

        await updateLibraryIndex((entries) => {
            const next = entries.filter((e) => e.id !== libId && e.storageId !== libId);
            if (splits.length) {
                for (let i = 0; i < splits.length; i += 1) {
                    const designId = `${libId}__d${i + 1}`;
                    next.unshift({
                        id: designId,
                        storageId: libId,
                        jobId,
                        createdAt,
                        promptPreview: meta.promptPreview,
                        batchIndex,
                        batchTotal,
                        designIndex: i + 1,
                        designTotal: splits.length,
                        fileName: splits[i].name,
                        thumbUrl: `/api/library/${libId}/file/${splits[i].name}`,
                        role: 'design'
                    });
                }
            } else {
                next.unshift({
                    id: libId,
                    storageId: libId,
                    jobId,
                    createdAt,
                    promptPreview: meta.promptPreview,
                    batchIndex,
                    batchTotal,
                    designIndex: 1,
                    designTotal: 1,
                    fileName: compositeName,
                    thumbUrl: `/api/library/${libId}/file/${compositeName}`,
                    role: 'design'
                });
            }
            return next;
        });
        return meta;
    }

    async function saveUploadedImageToLibrary(imageBuffer, opts = {}) {
        const originalName = String(opts.originalName || '').trim();
        let displayName = String(opts.displayName || '').trim();
        if (!displayName && opts.originalDesignId) {
            displayName = librarySmartRename.resolveLibraryDisplayNameFromId(opts.originalDesignId);
        }
        if (!displayName) {
            displayName = originalName.replace(/\.[^.]+$/, '').slice(0, 80) || 'رفع يدوي';
        }
        const source = String(opts.source || 'upload').trim() || 'upload';
        const originalDesignId = String(opts.originalDesignId || '').trim();
        const versionLabel = String(opts.versionLabel || '').trim();
        const libId = newLibraryId();
        const libDir = path.join(LIBRARY_DIR, libId);
        ensureDirs(libDir);

        let pngBuf = imageBuffer;
        let imageWidth = 0;
        let imageHeight = 0;
        try {
            const sharpMeta = await sharp(imageBuffer).metadata();
            imageWidth = sharpMeta.width || 0;
            imageHeight = sharpMeta.height || 0;
            pngBuf = await sharp(imageBuffer).png().toBuffer();
        } catch (err) {
            throw new Error(`صيغة الصورة غير مدعومة: ${err.message}`);
        }

        const fileName = sanitizeLibraryFileName(displayName);
        fs.writeFileSync(path.join(libDir, fileName), pngBuf);

        const files = [{ name: fileName, role: 'split', url: `/api/library/${libId}/file/${fileName}` }];
        const thumbPath = path.join(libDir, 'thumb.webp');
        try {
            await sharp(pngBuf)
                .resize(120, 120, { fit: 'cover', position: 'centre' })
                .webp({ quality: 72 })
                .toFile(thumbPath);
        } catch (_) {
            try {
                await sharp(pngBuf).resize(120, 120, { fit: 'cover' }).jpeg({ quality: 75 })
                    .toFile(path.join(libDir, 'thumb.jpg'));
            } catch (_) { /* ignore */ }
        }

        const createdAt = new Date().toISOString();
        const promptPreview = displayName.slice(0, 120);
        const meta = {
            id: libId,
            jobId: null,
            createdAt,
            prompt: displayName.slice(0, 2000),
            promptPreview,
            displayName,
            batchIndex: 1,
            batchTotal: 1,
            compositeFilename: originalName || fileName,
            source,
            files
        };
        if (originalDesignId) meta.originalDesignId = originalDesignId;
        if (versionLabel) meta.versionLabel = versionLabel;
        if (imageWidth > 0 && imageHeight > 0) {
            meta.width = imageWidth;
            meta.height = imageHeight;
        }
        fs.writeFileSync(path.join(libDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

        const designId = `${libId}__d1`;
        const row = {
            id: designId,
            storageId: libId,
            jobId: null,
            createdAt,
            promptPreview,
            displayName,
            batchIndex: 1,
            batchTotal: 1,
            designIndex: 1,
            designTotal: 1,
            fileName,
            thumbUrl: `/api/library/${libId}/file/${fileName}`,
            role: 'design',
            source
        };
        if (originalDesignId) row.originalDesignId = originalDesignId;
        if (versionLabel) row.versionLabel = versionLabel;
        await updateLibraryIndex((entries) => {
            const next = entries.filter((e) => e.id !== libId && e.storageId !== libId);
            next.unshift({ ...row });
            return next;
        });
        return { meta, item: row };
    }

    const upload = multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => {
                ensureDirs(INPUT_DIR);
                cb(null, INPUT_DIR);
            },
            filename: (_req, file, cb) => {
                const ext = path.extname(file.originalname || '') || '.png';
                cb(null, `input_${Date.now()}${ext}`);
            }
        }),
        limits: { fileSize: 25 * 1024 * 1024 }
    });

    const libraryUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 40 * 1024 * 1024, files: 20 },
        fileFilter: (_req, file, cb) => {
            const ok = /^image\/(png|jpeg|jpg|webp)$/i.test(file.mimetype || '')
                || /\.(png|jpe?g|webp)$/i.test(file.originalname || '');
            cb(null, ok);
        }
    });

    const librarySmartRename = createLibrarySmartRename({
        fetchWithTimeout,
        mapCliProxyErrorMessageAr,
        logFn: log,
        readLibraryIndex,
        writeLibraryIndex,
        readLibraryMeta,
        libraryDir: LIBRARY_DIR
    });

    const cancelledJobs = new Set();

    function isJobCancelled(jobId) {
        if (cancelledJobs.has(jobId)) return true;
        const metaPath = path.join(JOBS_DIR, jobId, 'meta.json');
        const meta = readJobMeta(metaPath);
        return meta.status === 'cancelled';
    }

    function throwIfJobCancelled(jobId, metaPath) {
        if (isJobCancelled(jobId)) {
            writeJobMeta(metaPath, {
                status: 'cancelled',
                stage: 'cancelled',
                stageLabel: 'تم الإيقاف'
            });
            const err = new Error('تم إيقاف التوليد');
            err.cancelled = true;
            throw err;
        }
    }

    async function processGenerateJob(ctx) {
        const {
            jobId,
            jobDir,
            metaPath,
            prompt,
            hasFile,
            baseUrl,
            apiKey,
            cloudApiKey = '',
            requestApiKey = '',
            quality,
            count,
            styleMode,
            mode,
            aiProvider = 'auto',
            autoFallbackGemini = true,
            useBuiltPrompt,
            builtPrompt,
            systemPrompt,
            autoImageTemplate,
            styleList,
            savedInputPath: initialInputPath,
            inputMime: initialMime,
            renameNoteContext = [],
            libraryDisplayName: initialLibraryDisplayName = '',
            req = null,
            rootDir = ''
        } = ctx;

        const libraryDisplayName = (() => {
            let name = String(
                initialLibraryDisplayName
                || req?.body?.libraryDisplayName
                || ''
            ).trim();
            if (!name) {
                const rawFile = String(req?.file?.originalname || path.basename(initialInputPath || '')).trim();
                name = sanitizeDisplayName(rawFile.replace(/\.[^.]+$/, ''));
                if (/^(reference|prompt-bag|image|img|upload|input|composite)$/i.test(name)) {
                    name = '';
                }
            }
            return name;
        })();

        const customSystemPrompt = String(systemPrompt || '').trim();
        const customAutoImageTemplate = String(autoImageTemplate || '').trim();

        let savedInputPath = initialInputPath;
        let inputMime = initialMime;
        let visionResult = null;
        let visionModel = '';
        let visionError = '';
        let autoGeneratedPrompt = '';

        const imageProbe = await getCliProxyImageModelsCached(baseUrl, apiKey);
        const availableImageModels = imageProbe.available || [];
        const model = sanitizeImageModelChoice(
            chooseModel({ quality, mode, aiProvider, availableModels: availableImageModels }),
            availableImageModels
        );
        const size = chooseImageSize(quality);
        const endpoint = resolveGenerateEndpoint(mode, hasFile);

        if (!availableImageModels.length) {
            log(`Generate ${jobId}: no image models in CLIProxy /models — using ${model}. ${imageModelsHintAr([], model)}`, 'WARN');
        } else {
            log(`Generate ${jobId}: image models [${availableImageModels.join(', ')}] → ${model}`);
        }

        try {
            throwIfJobCancelled(jobId, metaPath);
            if (savedInputPath && fs.existsSync(savedInputPath)) {
                writeJobMeta(metaPath, {
                    stage: 'preparing',
                    stageLabel: STAGE_LABELS.preparing,
                    status: 'running'
                });
                const optimizedPath = path.join(jobDir, 'input_opt.jpg');
                const optimized = await resizeInputImage(savedInputPath, optimizedPath, (msg) => log(msg), { quality });
                savedInputPath = optimized.path;
                inputMime = optimized.mimeType;
                if (optimized.resized) {
                    writeJobMeta(metaPath, { inputOptimized: true, inputSize: `${optimized.width}x${optimized.height}` });
                }
            }

            if (hasFile && useBuiltPrompt && builtPrompt) {
                let clientBuilt = String(builtPrompt || '').trim();
                if (clientBuilt && !/TEXT \/ LETTERING \(mandatory/i.test(clientBuilt)) {
                    clientBuilt = `${clientBuilt}\n\n${TEXT_PRESERVATION_RULE}`;
                }
                autoGeneratedPrompt = customSystemPrompt
                    ? `${customSystemPrompt}\n\n---\n\n${clientBuilt}`
                    : clientBuilt;
                log(`Generate ${jobId}: using client-built prompt (skip vision)`);
            } else if (hasFile && savedInputPath) {
                writeJobMeta(metaPath, {
                    stage: 'vision',
                    stageLabel: STAGE_LABELS.vision,
                    status: 'running'
                });
                log(`Generate ${jobId}: vision analysis...`);
                try {
                    const v = await callCliProxyVision({
                        baseUrl,
                        apiKey,
                        imagePath: savedInputPath,
                        mimeType: inputMime,
                        log: (msg) => log(msg)
                    });
                    visionResult = v.vision;
                    visionModel = v.model;
                } catch (vErr) {
                    visionError = vErr.message || 'Vision failed';
                    log(`Generate ${jobId}: vision fallback — ${visionError}`, 'WARN');
                }
                autoGeneratedPrompt = buildAutoImageGenerationPrompt({
                    vision: visionResult,
                    userPrompt: prompt,
                    count,
                    styleMode,
                    systemPrompt: customSystemPrompt,
                    autoImageTemplate: customAutoImageTemplate,
                    styleList
                });
            } else {
                autoGeneratedPrompt = buildFinalGeneratePrompt(prompt, styleMode, count, {
                    systemPrompt: customSystemPrompt,
                    styleList
                });
            }

            const designCount = normalizeDesignCount(count);
            const totalBatches = totalBatchesFromCount(designCount);
            const finalPromptBase = autoGeneratedPrompt;

            writeJobMeta(metaPath, {
                mode,
                aiProvider,
                quality,
                count: designCount,
                designCount,
                totalBatches,
                styleMode,
                prompt: prompt.slice(0, 2000),
                autoGeneratedPrompt: autoGeneratedPrompt.slice(0, 8000),
                visionModel: visionModel || null,
                visionError: visionError || null,
                model,
                endpoint,
                stage: 'generating',
                stageLabel: stageLabelForGenerating(1, totalBatches),
                status: 'running',
                batches: [],
                batchesCompleted: 0
            });

            log(`Generate ${jobId}: mode=${mode} provider=${aiProvider} model=${model} endpoint=${endpoint} designs=${designCount} batches=${totalBatches} providerTimeout=${getProviderAttemptTimeoutMs()}ms geminiTimeout=${getGeminiAttemptTimeoutMs()}ms`);

            const allOutputs = [];
            const batchRecords = [];
            const libraryIds = [];
            let lastModel = model;
            let lastEndpoint = endpoint;
            let lastStrategy = 'composite-grid-2x2-single-call';
            let lastFallbackFrom = null;
            let lastModelUsed = model;

            for (let batchNum = 1; batchNum <= totalBatches; batchNum += 1) {
                throwIfJobCancelled(jobId, metaPath);
                const batchLabel = stageLabelForGenerating(batchNum, totalBatches);
                writeJobMeta(metaPath, {
                    stage: 'generating',
                    stageLabel: batchLabel,
                    currentBatch: batchNum,
                    totalBatches,
                    progress: { completed: batchNum - 1, total: totalBatches },
                    status: 'running'
                });

                const batchPromptSuffix = totalBatches > 1
                    ? `\n\nBatch ${batchNum} of ${totalBatches}: produce 4 clearly NEW variations — different composition and styling from any prior batch in this session.`
                    : '';
                const batchPrompt = `${finalPromptBase}${batchPromptSuffix}`;

                const onProgress = (_completed, _total, stageLabel) => {
                    writeJobMeta(metaPath, {
                        stage: 'generating',
                        stageLabel: stageLabel || batchLabel,
                        currentBatch: batchNum,
                        totalBatches,
                        progress: { completed: batchNum - 1, total: totalBatches },
                        status: 'running'
                    });
                };

                log(`Generate ${jobId}: batch ${batchNum}/${totalBatches} composite 2x2`);
                const varied = await generateCompositeGridImage({
                    baseUrl,
                    apiKey,
                    cloudApiKey,
                    requestApiKey,
                    endpoint,
                    model,
                    prompt: batchPrompt,
                    size,
                    imagePath: savedInputPath && fs.existsSync(savedInputPath) ? savedInputPath : null,
                    mimeType: inputMime,
                    log: (msg, level) => log(msg, level || 'INFO'),
                    onProgress,
                    quality,
                    mode,
                    aiProvider,
                    availableModels: availableImageModels,
                    rawModelIds: imageProbe.rawIds || availableImageModels,
                    autoFallbackGemini,
                    rootDir,
                    req,
                    onFallbackStart: () => {
                        writeJobMeta(metaPath, {
                            stage: 'fallback_gemini',
                            stageLabel: 'فشل ChatGPT — جاري تجربة Gemini...',
                            status: 'running'
                        });
                    },
                    onGptFallbackStart: () => {
                        writeJobMeta(metaPath, {
                            stage: 'fallback_gpt',
                            stageLabel: 'فشل Gemini — جاري تجربة ChatGPT عبر CLIProxy...',
                            status: 'running'
                        });
                    }
                });
                lastModel = varied.model;
                lastModelUsed = varied.modelUsed || varied.model;
                lastFallbackFrom = varied.fallbackFrom || lastFallbackFrom;
                lastEndpoint = varied.endpoint;
                lastStrategy = varied.strategy || lastStrategy;

                writeJobMeta(metaPath, {
                    stage: 'saving',
                    stageLabel: STAGE_LABELS.saving,
                    status: 'running'
                });

                const filename = totalBatches === 1
                    ? 'composite_grid.png'
                    : `composite_batch_${batchNum}.png`;
                const img = varied.images[0];
                if (!img?.b64) {
                    throw new Error(`الدفعة ${batchNum}: لم تُرجع الصورة`);
                }
                const outPath = path.join(jobDir, filename);
                fs.writeFileSync(outPath, Buffer.from(img.b64, 'base64'));
                const fileEntry = {
                    index: allOutputs.length + 1,
                    batchIndex: batchNum,
                    filename,
                    url: `/api/generate/file/${jobId}/${filename}`,
                    b64: img.b64
                };
                allOutputs.push(fileEntry);

                const libMeta = await saveBatchToLibrary({
                    jobId,
                    prompt: prompt || autoGeneratedPrompt.slice(0, 200),
                    batchIndex: batchNum,
                    batchTotal: totalBatches,
                    compositePath: outPath,
                    compositeFilename: filename,
                    vision: visionResult,
                    noteContext: renameNoteContext
                });
                if (libraryDisplayName) {
                    const splitCount = (libMeta.files || []).filter((f) =>
                        f.role === 'split'
                        || /^design_\d+\.png$/i.test(f.name)
                        || /^split_\d+\.png$/i.test(f.name)
                    ).length || 4;
                    const sourceNames = Array.from({ length: splitCount }, () => sanitizeDisplayName(libraryDisplayName));
                    librarySmartRename.applyDisplayNamesToStorageBatch(libMeta.id, sourceNames);
                }
                libraryIds.push(libMeta.id);

                const batchRecord = {
                    batchIndex: batchNum,
                    batchTotal: totalBatches,
                    filename,
                    url: fileEntry.url,
                    libraryId: libMeta.id,
                    files: libMeta.files
                };
                batchRecords.push(batchRecord);

                writeJobMeta(metaPath, {
                    batches: batchRecords.slice(),
                    batchesCompleted: batchNum,
                    thumbnails: allOutputs.map((o) => o.url),
                    libraryIds: libraryIds.slice(),
                    stage: batchNum < totalBatches ? 'generating' : 'saving',
                    stageLabel: batchNum < totalBatches
                        ? stageLabelForGenerating(batchNum + 1, totalBatches)
                        : STAGE_LABELS.saving,
                    progress: { completed: batchNum, total: totalBatches },
                    status: 'running'
                });

                log(`Generate ${jobId}: batch ${batchNum}/${totalBatches} saved → library ${libMeta.id}`);
            }

            log(`Generate ${jobId}: done strategy=${lastStrategy} batches=${totalBatches} outputs=${allOutputs.length}`);

            const jobRecord = {
                jobId,
                status: 'done',
                stage: 'done',
                stageLabel: STAGE_LABELS.done,
                createdAt: readJobMeta(metaPath).createdAt || new Date().toISOString(),
                mode,
                quality,
                styleMode,
                count: designCount,
                designCount,
                totalBatches,
                outputImages: allOutputs.length,
                compositeGrid: true,
                promptPreview: prompt.slice(0, 120),
                autoGeneratedPromptPreview: autoGeneratedPrompt.slice(0, 200),
                autoGeneratedPrompt: autoGeneratedPrompt.slice(0, 8000),
                visionModel: visionModel || null,
                visionUsed: !!visionResult,
                visionError: visionError || null,
                model: lastModel,
                modelUsed: lastModelUsed,
                fallbackFrom: lastFallbackFrom,
                endpoint: lastEndpoint,
                generationStrategy: lastStrategy,
                thumbnails: allOutputs.map((o) => o.url),
                batches: batchRecords,
                batchesCompleted: totalBatches,
                libraryIds,
                progress: { completed: totalBatches, total: totalBatches },
                vision: visionResult || null,
                libraryRenameStatus: 'queued'
            };

            fs.writeFileSync(metaPath, JSON.stringify(jobRecord, null, 2), 'utf8');

            librarySmartRename.enqueue({
                type: 'job-complete',
                jobId,
                libraryIds: libraryIds.slice(),
                vision: visionResult,
                noteContext: renameNoteContext,
                promptPreview: prompt.slice(0, 120),
                forcedDisplayName: libraryDisplayName || '',
                baseUrl,
                apiKey,
                metaPath
            });

            addGalleryEntry(GALLERY_INDEX, JOBS_DIR, {
                jobId,
                createdAt: jobRecord.createdAt,
                mode,
                quality,
                styleMode,
                count: designCount,
                totalBatches,
                outputImages: allOutputs.length,
                compositeGrid: true,
                promptPreview: jobRecord.promptPreview,
                thumbnails: jobRecord.thumbnails
            });
        } catch (err) {
            if (err?.cancelled) {
                log(`Generate ${jobId}: cancelled by client`);
                return;
            }
            log(`Generate error ${jobId}: ${err.message}`, 'ERROR');
            writeJobMeta(metaPath, {
                status: 'error',
                stage: 'error',
                stageLabel: 'فشل التوليد',
                error: err.message,
                httpStatus: err.httpStatus || 0,
                endpoint: err.endpoint || ''
            });
            throw err;
        }
    }

    app.get('/api/generate/prompt-defaults', (_req, res) => {
        res.json({
            success: true,
            systemPrompt: APPAREL_DESIGN_SYSTEM_PROMPT,
            autoImageTemplate: AUTO_IMAGE_PROMPT_TEMPLATE
        });
    });

    function testProviderModelErrorAr(provider, availableModels = [], rawModelIds = []) {
        const p = normalizeAiProvider(provider);
        const available = filterSupportedImageModels(availableModels);
        const raw = rawModelIds.length ? rawModelIds : availableModels;
        if (p === 'gemini' && !findGeminiImageModel(available, raw)) {
            return [
                'لا يوجد نموذج Gemini للصور في CLIProxy /v1/models.',
                geminiImageSetupHintAr(available, raw),
                imageModelsHintAr(available, pickDefaultImageModel(available))
            ].join('\n');
        }
        if (p === 'chatgpt' && !findChatGptImageModel(available, raw)) {
            return [
                'لا يوجد نموذج ChatGPT (gpt-image) في CLIProxy.',
                'أضف مصادقة Codex OAuth على http://127.0.0.1:8317 لتفعيل gpt-image-2.',
                'عيّن CLIPROXY_IMAGE_MODEL=gpt-image-2 في .env بجذر المشروع وأعد تشغيل ghost-server.js.',
                imageModelsHintAr(available, pickDefaultImageModel(available))
            ].join('\n');
        }
        return '';
    }

    app.post('/api/generate/test', async (req, res) => {
        try {
            const aiProvider = normalizeAiProvider(req.body?.aiProvider || req.body?.mode || 'auto');
            const autoFallbackGemini = resolveEffectiveAutoFallbackGemini(
                aiProvider,
                req.body?.autoFallbackGemini
            );
            const { baseUrl: preferredBase, apiKey: preferredKey, keySource: preferredKeySource, cloudApiKey } = await getProviderCliProxyConfigPreferred(rootDir, req, aiProvider);
            let keySource = preferredKeySource;
            let apiKey = preferredKey || cloudApiKey || '';
            let baseUrl = preferredKey
                ? preferredBase
                : (cloudApiKey ? normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL) : preferredBase);
            if (!apiKey) {
                if (await probeCliProxyOnline(DEFAULT_LOCAL_CLIPROXY_BASE_URL, LOCAL_CLIPROXY_DEFAULT_API_KEY)) {
                    baseUrl = normalizeCliProxyBaseUrl(DEFAULT_LOCAL_CLIPROXY_BASE_URL);
                    apiKey = LOCAL_CLIPROXY_DEFAULT_API_KEY;
                    keySource = 'local-backup';
                }
            }
            if (!apiKey) {
                const hint = aiProvider === 'gemini'
                    ? 'أضف مفتاح Gemini API من إعدادات التوليد ⚙️ (مفتاح Gemini API) أو من SEO → إعدادات API (NHP API Key).'
                    : `${MISSING_API_KEY_HINT_AR} (Ghost .env CLIPROXY_API_KEY فارغ — المفتاح يُرسل من الإضافة عبر X-NHP-Api-Key / X-NHP-Cloud-Api-Key)`;
                return res.status(503).json({
                    success: false,
                    code: 'no_api_key',
                    baseUrl,
                    keySource: keySource || 'none',
                    error: aiProvider === 'gemini' ? 'مفتاح Gemini API غير مُعدّ' : MISSING_API_KEY_ERROR_AR,
                    hint
                });
            }

            const defaultPrompt = aiProvider === 'gemini'
                ? 'simple red circle icon'
                : 'simple test icon, flat vector, single object on white';
            const prompt = String(req.body?.prompt || defaultPrompt).trim() || defaultPrompt;

            const imageProbe = await getCliProxyImageModelsCached(baseUrl, apiKey, true);
            const available = imageProbe.available || [];
            const rawModelIds = imageProbe.rawIds || available;

            if (!imageProbe.fetchOk) {
                return res.status(503).json({
                    success: false,
                    code: 'cliproxy_down',
                    ghostOk: true,
                    cliproxyOk: false,
                    error: connectionErrorAr('image', baseUrl),
                    baseUrl
                });
            }

            const providerModelErr = testProviderModelErrorAr(aiProvider, available, rawModelIds);
            if (providerModelErr) {
                return res.status(503).json({
                    success: false,
                    code: aiProvider === 'gemini' ? 'no_gemini_model' : 'no_chatgpt_model',
                    imagePathIssue: true,
                    aiProvider,
                    baseUrl,
                    error: providerModelErr,
                    imageModels: available,
                    geminiImageModels: imageProbe.geminiImageModels || collectGeminiImageModels(rawModelIds),
                    chatGptImageModels: imageProbe.chatGptImageModels || [],
                    recommendedImageModel: pickDefaultImageModel(available),
                    hint: 'مفتاح SEO يعمل لـ chat/completions — مسار الصور يحتاج نموذج gemini*image* أو gpt-image-2 (Codex OAuth)'
                });
            }

            let modelCandidates = resolveTestImageModelCandidates(aiProvider, available, rawModelIds);
            const fallbackRaw = String(process.env.CLIPROXY_IMAGE_FALLBACK || '').trim().toLowerCase();
            if (fallbackRaw && available.includes(fallbackRaw) && !modelCandidates.includes(fallbackRaw)) {
                modelCandidates = [...modelCandidates, fallbackRaw];
            }
            if (normalizeAiProvider(aiProvider) === 'auto') {
                const extended = chooseImageModelCandidates({
                    quality: 'balanced',
                    mode: 'text-to-image',
                    aiProvider: 'auto',
                    availableModels: available
                });
                if (extended.length > modelCandidates.length) {
                    modelCandidates = extended;
                }
            }
            if (!modelCandidates.length) {
                const noCandMsg = [
                    'لا يوجد نموذج صور مناسب لاختبار التوليد.',
                    imageModelsHintAr(available, pickDefaultImageModel(available)),
                    isLocalCliProxyBaseUrl(baseUrl)
                        ? `تحقق من CLIProxy المحلي (${baseUrl}) أو استخدم Render: ${DEFAULT_RENDER_CLIPROXY_BASE_URL}`
                        : `تحقق من Render (${baseUrl}) أو أضف Codex OAuth لـ gpt-image-2`
                ].join('\n');
                log(`Generate test: no model candidates provider=${aiProvider} baseUrl=${baseUrl}`, 'WARN');
                return res.status(503).json({
                    success: false,
                    code: 'no_model_candidates',
                    aiProvider,
                    baseUrl,
                    error: noCandMsg,
                    imageModels: available,
                    recommendedImageModel: pickDefaultImageModel(available),
                    hint: 'راجع .env: CLIPROXY_IMAGE_MODEL=gpt-image-2 أو CLIPROXY_IMAGE_FALLBACK=gemini-3.1-flash-image'
                });
            }
            const size = '1024x1024';
            const testTimeoutMs = getGenerateTestImageTimeoutMs();
            const testLog = (msg, level) => log(msg, level || 'INFO');
            const routeHint = aiProvider === 'gemini' || modelCandidates.some((m) => prefersGeminiChatImageRoute(m))
                ? '/v1/chat/completions (Gemini modalities)'
                : '/v1/images/generations';

            log(`Generate test: provider=${aiProvider} baseUrl=${baseUrl} keySource=${keySource || 'request'} candidates=${modelCandidates.join(' → ')} route=${routeHint} timeout=${testTimeoutMs}ms non-stream`);

            let result = null;
            let lastErr = null;
            const triedModels = [];
            const gptGeminiFallbackEligible = resolveEffectiveAutoFallbackGemini(aiProvider, autoFallbackGemini);
            const testModelCandidates = gptGeminiFallbackEligible
                ? modelCandidates.filter((m) => !prefersGeminiChatImageRoute(m))
                : modelCandidates;
            const candidatesToTry = testModelCandidates.length ? testModelCandidates : modelCandidates;

            for (const model of candidatesToTry) {
                triedModels.push(model);
                const modelRoute = prefersGeminiChatImageRoute(model)
                    ? '/v1/chat/completions'
                    : '/v1/images/generations';
                const imageEndpoint = prefersGeminiChatImageRoute(model)
                    ? null
                    : '/images/generations';
                try {
                    result = await callCliProxyImagesWithRetry({
                        baseUrl,
                        apiKey,
                        endpoint: imageEndpoint,
                        model,
                        prompt,
                        count: 1,
                        size,
                        imagePath: null,
                        mimeType: null,
                        stream: false,
                        timeoutMs: testTimeoutMs,
                        log: testLog,
                        aiProvider
                    }, { maxRetries: 2, log: testLog, label: `Generate test (${modelRoute})` });
                    break;
                } catch (modelErr) {
                    lastErr = modelErr;
                    const combined = cliProxyErrorCombinedText(modelErr);
                    const canTryNext = isRetriableImageModelError(modelErr)
                        || /is not supported on.*images/i.test(combined);
                    testLog(
                        `Generate test: model ${model} failed HTTP ${modelErr?.httpStatus || 0} — ${String(modelErr?.rawMessage || modelErr?.message || '').slice(0, 240)}`,
                        'WARN'
                    );
                    if (canTryNext && triedModels.length < candidatesToTry.length) {
                        testLog(`Generate test: model ${model} failed — trying next candidate`, 'WARN');
                        continue;
                    }
                    if (gptGeminiFallbackEligible && isGptFailureEligibleForGeminiFallback(modelErr)) {
                        result = await tryGeminiImageFallback({
                            gptErr: modelErr,
                            baseUrl,
                            apiKey,
                            prompt,
                            size,
                            imagePath: null,
                            mimeType: null,
                            log: testLog,
                            availableModels: available,
                            rawModelIds,
                            rootDir,
                            req,
                            timeoutMs: testTimeoutMs
                        });
                        triedModels.push(result.model);
                        lastErr = null;
                        break;
                    }
                    throw modelErr;
                }
            }

            if (!result) {
                const noResult = lastErr || new Error('فشل اختبار CLIProxy — لم تُرجع أي نموذج صورة');
                if (lastErr?.rawMessage) noResult.rawMessage = lastErr.rawMessage;
                if (lastErr?.httpStatus) noResult.httpStatus = lastErr.httpStatus;
                if (lastErr?.endpoint) noResult.endpoint = lastErr.endpoint;
                throw noResult;
            }

            const img = result.images[0];
            if (!img?.b64) {
                log(`Generate test: empty image payload model=${result.model} endpoint=${result.endpoint || routeHint}`, 'WARN');
                return res.status(502).json({
                    success: false,
                    code: 'empty_response',
                    error: 'CLIProxy لم يُرجع صورة — تحقق من المصادقة (Codex OAuth لـ gpt-image-2) أو جرّب نموذج Gemini',
                    model: result.model,
                    modelUsed: result.model,
                    triedModels,
                    aiProvider,
                    baseUrl,
                    endpoint: result.endpoint || routeHint,
                    imageModels: available,
                    hint: isLocalCliProxyBaseUrl(baseUrl)
                        ? 'أضف Codex OAuth على http://127.0.0.1:8317 أو غيّر nhpProxyBaseUrl إلى Render'
                        : 'راجع سجلات Render CLIProxy — قد يحتاج gpt-image-2 إلى Codex OAuth على الخادم'
                });
            }

            const endpointPath = cliproxyEndpointPath(result.endpoint) || routeHint.split(' ')[0];

            const fallbackFrom = result.fallbackFrom || null;
            const modelUsed = result.modelUsed || result.model;
            const successMessage = fallbackFrom
                ? `تم التوليد عبر Gemini (بعد فشل ChatGPT) — النموذج: ${modelUsed} — المسار: ${endpointPath}`
                : `نجح اختبار ${aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'chatgpt' ? 'ChatGPT' : 'التوليد'} — النموذج: ${modelUsed} — المسار: ${endpointPath}`;

            return res.json({
                success: true,
                test: true,
                aiProvider,
                model: result.model,
                modelUsed,
                fallbackFrom,
                triedModels,
                imageModels: available,
                geminiImageModels: imageProbe.geminiImageModels || [],
                chatGptImageModels: imageProbe.chatGptImageModels || [],
                recommendedImageModel: pickDefaultImageModel(available),
                endpoint: result.endpoint,
                endpointUsed: endpointPath,
                endpointPath,
                route: result.route || (isGeminiChatEndpoint(result.endpoint) ? 'gemini-chat' : 'images'),
                image: `data:image/png;base64,${img.b64}`,
                message: successMessage
            });
        } catch (err) {
            const aiProvider = normalizeAiProvider(req.body?.aiProvider || req.body?.mode || 'auto');
            const { baseUrl } = await getProviderCliProxyConfigPreferred(rootDir, req, aiProvider);
            const upstream = Number(err?.httpStatus) || 0;
            const { status: statusCode } = mapGenerateTestHttpStatus(err);
            const endpointPath = err.endpointPath || cliproxyEndpointPath(err.endpoint)
                || (aiProvider === 'gemini' ? '/v1/chat/completions' : '/v1/images/generations');
            const usedGeminiChat = isGeminiChatEndpoint(err.endpoint) || aiProvider === 'gemini';
            const mappedError = mapCliProxyErrorMessageAr(err.rawMessage || err.message, {
                availableModels: _imageModelsCache.available,
                rawModelIds: _imageModelsCache.rawIds || _imageModelsCache.available,
                aiProvider,
                requestedModel: err.model || '',
                httpStatus: upstream,
                endpoint: err.endpoint || endpointPath,
                baseUrl
            });
            log(
                `Generate test error: provider=${aiProvider} baseUrl=${baseUrl} upstreamHTTP=${upstream} ghostHTTP=${statusCode} endpoint=${endpointPath} full=${err.endpoint || 'n/a'} — ${String(err.rawMessage || err.message).slice(0, 320)}`,
                'ERROR'
            );
            const geminiListed = (_imageModelsCache.geminiImageModels || []).length > 0;
            const rawSlice = String(err.rawMessage || err.message).slice(0, 280);
            let hint;
            if (upstream === 400 && usedGeminiChat && isGeminiAuthMissingUpstream(err.rawMessage || err.message, { aiProvider, baseUrl })) {
                hint = isRenderCliProxyBaseUrl(baseUrl)
                    ? `مصادقة Gemini مفقودة على Render CLIProxy — المسار المُستخدَم: ${endpointPath}. التفاصيل: ${rawSlice}`
                    : `مصادقة Gemini مفقودة — المسار المُستخدَم: ${endpointPath}. التفاصيل: ${rawSlice}`;
            } else if (upstream === 400 && (aiProvider === 'gemini' || geminiListed)) {
                hint = `طلب CLIProxy مرفوض (400) على ${endpointPath} — التفاصيل: ${rawSlice}. نماذج Gemini تُولَّد عبر /v1/chat/completions (modalities) — ليس /images/generations.`;
            } else if (upstream === 400) {
                hint = `طلب CLIProxy مرفوض (400) على ${endpointPath} — التفاصيل: ${rawSlice}. تحقق من المصادقة (Codex OAuth لـ gpt-image-2).`;
            } else if (isLocalCliProxyBaseUrl(baseUrl)) {
                hint = `محلي: Codex OAuth على 8317 — المسار: ${endpointPath} — .env: CLIPROXY_IMAGE_MODEL=gpt-image-2`;
            } else {
                hint = `Render: تحقق من المفتاح — المسار: ${endpointPath} — gpt-image-2 يحتاج Codex OAuth على خادم CLIProxy`;
            }
            return res.status(statusCode).json({
                success: false,
                code: upstream === 400 && usedGeminiChat && isGeminiAuthMissingUpstream(err.rawMessage || err.message, { aiProvider, baseUrl })
                    ? 'gemini_auth_missing'
                    : (upstream === 400 ? 'cliproxy_bad_request' : 'test_failed'),
                imagePathIssue: !usedGeminiChat,
                fallbackAttempted: !!err.fallbackAttempted,
                error: mappedError,
                upstreamError: String(err.rawMessage || err.message || '').slice(0, 500) || null,
                upstreamHttpStatus: upstream || null,
                cliproxyStatus: upstream || null,
                baseUrl,
                endpoint: err.endpoint || '',
                endpointUsed: endpointPath,
                endpointPath,
                route: usedGeminiChat ? 'gemini-chat' : 'images',
                aiProvider,
                imageModels: _imageModelsCache.available || [],
                geminiImageModels: _imageModelsCache.geminiImageModels || [],
                chatGptImageModels: _imageModelsCache.chatGptImageModels || [],
                hint
            });
        }
    });

    app.get('/api/generate/health', async (req, res) => {
        try {
            const aiProvider = normalizeAiProvider(req.query?.aiProvider || req.headers?.['x-nhp-ai-provider'] || 'auto');
            let {
                baseUrl,
                apiKey,
                keySource,
                cloudApiKey,
                requestApiKey,
                failoverFrom
            } = await getProviderCliProxyConfigPreferred(rootDir, req, aiProvider);
            if (!apiKey) {
                // Last chance: cloud with request/cloud header key, else local gateway backup.
                const raw = String(
                    cloudApiKey
                    || requestApiKey
                    || resolveRequestCliProxyCredentials(req).cloudApiKey
                    || resolveRequestCliProxyCredentials(req).apiKey
                    || ''
                ).trim();
                const cloudKey = resolveCliProxyBearerKey(DEFAULT_RENDER_CLIPROXY_BASE_URL, raw);
                if (cloudKey && !isLocalCliProxyGatewayKey(cloudKey)
                    && await probeCliProxyOnline(DEFAULT_RENDER_CLIPROXY_BASE_URL, cloudKey)) {
                    baseUrl = normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL);
                    apiKey = cloudKey;
                    keySource = 'cloud-failover';
                    failoverFrom = DEFAULT_LOCAL_CLIPROXY_BASE_URL;
                } else if (await probeCliProxyOnline(DEFAULT_LOCAL_CLIPROXY_BASE_URL, LOCAL_CLIPROXY_DEFAULT_API_KEY)) {
                    baseUrl = normalizeCliProxyBaseUrl(DEFAULT_LOCAL_CLIPROXY_BASE_URL);
                    apiKey = LOCAL_CLIPROXY_DEFAULT_API_KEY;
                    keySource = 'local-backup';
                    failoverFrom = DEFAULT_RENDER_CLIPROXY_BASE_URL;
                } else {
                    return res.status(503).json({
                        success: false,
                        ghostOk: true,
                        cliproxyOk: false,
                        hasApiKey: false,
                        baseUrl,
                        keySource: 'none',
                        error: MISSING_API_KEY_ERROR_AR,
                        hint: `${MISSING_API_KEY_HINT_AR} (Ghost .env CLIPROXY_API_KEY فارغ — المفتاح يُرسل من الإضافة عبر X-NHP-Api-Key / X-NHP-Cloud-Api-Key)`
                    });
                }
            }
            let activeBase = baseUrl;
            let activeKey = apiKey;
            const modelsUrl = `${activeBase.replace(/\/+$/, '')}/models`;
            let cliproxyOk = false;
            let cliproxyStatus = 0;
            let cliproxyError = '';
            let imageModels = [];
            let recommendedImageModel = pickDefaultImageModel([]);
            let imageModelHintAr = '';
            try {
                let probe = await fetchWithTimeout(modelsUrl, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${activeKey}` }
                }, 10000, 'fetch', activeBase);
                cliproxyStatus = probe.status;
                cliproxyOk = probe.ok;
                // Local 401/503 → try Render with SEO/cloud key before failing health.
                if (!probe.ok && isLocalCliProxyBaseUrl(activeBase)) {
                    const cloudKey = resolveCliProxyBearerKey(
                        DEFAULT_RENDER_CLIPROXY_BASE_URL,
                        String(cloudApiKey || requestApiKey || '').trim()
                    );
                    if (cloudKey && !isLocalCliProxyGatewayKey(cloudKey)) {
                        const cloudBase = normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL);
                        const cloudProbe = await fetchWithTimeout(`${cloudBase}/models`, {
                            method: 'GET',
                            headers: { Authorization: `Bearer ${cloudKey}` }
                        }, 12000, 'fetch', cloudBase);
                        if (cloudProbe.ok) {
                            probe = cloudProbe;
                            activeBase = cloudBase;
                            activeKey = cloudKey;
                            cliproxyStatus = cloudProbe.status;
                            cliproxyOk = true;
                            keySource = 'cloud-failover';
                            failoverFrom = baseUrl;
                            cliproxyError = '';
                        }
                    }
                }
                if (probe.status === 401) {
                    cliproxyError = isLocalCliProxyBaseUrl(activeBase)
                        ? 'مفتاح API غير صالح لـ CLIProxy المحلي — جرّب السحابة أو nhp-local-cliproxy-key'
                        : 'مفتاح API غير صالح لـ CLIProxy السحابي';
                }
                if (probe.ok) {
                    const text = await probe.text();
                    let data = null;
                    try {
                        data = text ? JSON.parse(text) : null;
                    } catch (_) { /* ignore */ }
                    const ids = extractModelIdsFromListResponse(data);
                    const rawIds = [...ids];
                    imageModels = filterSupportedImageModels(ids);
                    recommendedImageModel = pickDefaultImageModel(imageModels);
                    imageModelHintAr = imageModelsHintAr(imageModels, recommendedImageModel);
                    _imageModelsCache = {
                        at: Date.now(),
                        available: imageModels,
                        rawIds,
                        geminiImageModels: collectGeminiImageModels(rawIds),
                        chatGptImageModels: rawIds.filter((m) => isChatGptLikeImageModel(m)),
                        recommended: recommendedImageModel,
                        fetchOk: true,
                        status: probe.status
                    };
                }
            } catch (probeErr) {
                cliproxyError = probeErr.message || 'CLIProxy unreachable';
                // Connection failure on local → try cloud once.
                if (isLocalCliProxyBaseUrl(activeBase)) {
                    try {
                        const cloudKey = resolveCliProxyBearerKey(
                            DEFAULT_RENDER_CLIPROXY_BASE_URL,
                            String(cloudApiKey || requestApiKey || '').trim()
                        );
                        if (cloudKey && !isLocalCliProxyGatewayKey(cloudKey)) {
                            const cloudBase = normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL);
                            const cloudProbe = await fetchWithTimeout(`${cloudBase}/models`, {
                                method: 'GET',
                                headers: { Authorization: `Bearer ${cloudKey}` }
                            }, 12000, 'fetch', cloudBase);
                            if (cloudProbe.ok) {
                                const text = await cloudProbe.text();
                                let data = null;
                                try { data = text ? JSON.parse(text) : null; } catch (_) { /* ignore */ }
                                const ids = extractModelIdsFromListResponse(data);
                                const rawIds = [...ids];
                                imageModels = filterSupportedImageModels(ids);
                                recommendedImageModel = pickDefaultImageModel(imageModels);
                                imageModelHintAr = imageModelsHintAr(imageModels, recommendedImageModel);
                                activeBase = cloudBase;
                                cliproxyOk = true;
                                cliproxyStatus = cloudProbe.status;
                                cliproxyError = '';
                                keySource = 'cloud-failover';
                                failoverFrom = baseUrl;
                                _imageModelsCache = {
                                    at: Date.now(),
                                    available: imageModels,
                                    rawIds,
                                    geminiImageModels: collectGeminiImageModels(rawIds),
                                    chatGptImageModels: rawIds.filter((m) => isChatGptLikeImageModel(m)),
                                    recommended: recommendedImageModel,
                                    fetchOk: true,
                                    status: cloudProbe.status
                                };
                            }
                        }
                    } catch (_) { /* keep original error */ }
                }
            }
            const geminiImageModels = _imageModelsCache.geminiImageModels || collectGeminiImageModels(imageModels);
            const chatGptImageModels = _imageModelsCache.chatGptImageModels || imageModels.filter((m) => isChatGptLikeImageModel(m));
            return res.status(cliproxyOk ? 200 : 503).json({
                success: cliproxyOk,
                ghostOk: true,
                cliproxyOk,
                hasApiKey: true,
                keySource,
                baseUrl: activeBase,
                failoverFrom: failoverFrom || null,
                isLocalProxy: isLocalCliProxyBaseUrl(activeBase),
                isRenderProxy: isRenderCliProxyBaseUrl(activeBase),
                aiProvider,
                cliproxyStatus,
                cliproxyError: cliproxyError || null,
                imageModels,
                geminiImageModels,
                chatGptImageModels,
                recommendedImageModel,
                imageModelHintAr: imageModelHintAr || imageModelsHintAr(imageModels, recommendedImageModel),
                hasImageModels: imageModels.length > 0,
                envHint: 'CLIPROXY_IMAGE_MODEL=gpt-image-2 في .env بجذر المشروع (أعد تشغيل ghost-server.js)'
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                ghostOk: true,
                cliproxyOk: false,
                error: err.message || 'health check failed'
            });
        }
    });

    function releaseGenerateServerSlot() {
        generateServerActiveJobs = Math.max(0, generateServerActiveJobs - 1);
    }

    app.post('/api/generate', upload.single('image'), async (req, res) => {
        const jobId = newJobId();
        const jobDir = path.join(JOBS_DIR, jobId);
        const metaPath = path.join(jobDir, 'meta.json');
        let savedInputPath = '';
        let generateSlotHeld = false;

        try {
            if (generateServerActiveJobs >= GENERATE_SERVER_MAX_CONCURRENT) {
                return res.status(429).json({
                    success: false,
                    code: 'SERVER_QUEUE_FULL',
                    error: `الخادم يعالج ${generateServerActiveJobs} توليدات — انتظر قليلاً وأعد المحاولة`,
                    jobId
                });
            }

            const prompt = String(req.body?.prompt || '').trim();
            const hasFile = !!(req.file && req.file.path);
            const hasPrompt = !!prompt;

            if (!hasFile && !hasPrompt) {
                return res.status(400).json({
                    success: false,
                    error: 'At least prompt OR image is required.',
                    jobId
                });
            }

            const rawMode = String(req.body?.mode || 'auto').trim();
            const aiProvider = normalizeAiProvider(req.body?.aiProvider || req.body?.mode || 'auto');
            let { baseUrl, apiKey, cloudApiKey, requestApiKey } = await getProviderCliProxyConfigPreferred(rootDir, req, aiProvider);
            if (!apiKey && cloudApiKey) {
                apiKey = cloudApiKey;
                baseUrl = normalizeCliProxyBaseUrl(DEFAULT_RENDER_CLIPROXY_BASE_URL);
            }
            if (!apiKey) {
                // Cloud SEO key missing → use local gateway backup when 8317 is up.
                if (await probeCliProxyOnline(DEFAULT_LOCAL_CLIPROXY_BASE_URL, LOCAL_CLIPROXY_DEFAULT_API_KEY)) {
                    baseUrl = normalizeCliProxyBaseUrl(DEFAULT_LOCAL_CLIPROXY_BASE_URL);
                    apiKey = LOCAL_CLIPROXY_DEFAULT_API_KEY;
                }
            }
            if (!apiKey) {
                const hint = aiProvider === 'gemini'
                    ? 'أضف مفتاح Gemini API من إعدادات التوليد ⚙️ (مفتاح Gemini API) أو من SEO → إعدادات API (NHP API Key).'
                    : MISSING_API_KEY_HINT_AR;
                return res.status(503).json({
                    success: false,
                    error: aiProvider === 'gemini'
                        ? 'مفتاح Gemini API غير مُعدّ'
                        : MISSING_API_KEY_ERROR_AR,
                    hint,
                    jobId
                });
            }

            ensureDirs(jobDir);

            const quality = String(req.body?.quality || 'balanced').trim();
            const count = normalizeDesignCount(req.body?.count);
            const styleMode = String(req.body?.styleMode || req.body?.style || 'auto').trim();
            const mode = normalizeMode(rawMode, hasFile, hasPrompt);
            const inputMime = req.file?.mimetype || 'image/png';
            const useBuiltPrompt = String(req.body?.useBuiltPrompt || '') === '1';
            const builtPrompt = String(req.body?.builtPrompt || '').trim();
            const systemPrompt = String(req.body?.systemPrompt || req.body?.customInstructions || '').trim();
            const autoImageTemplate = String(req.body?.autoImageTemplate || '').trim();
            const styleList = parseStyleListFromBody(req.body?.styleList);
            const renameNoteContext = librarySmartRename.parseRenameNoteContext(
                req.body?.renameNoteContext || req.body?.noteContext
            );
            const libraryDisplayName = String(req.body?.libraryDisplayName || '').trim();
            const syncMode = String(req.body?.sync || req.query?.sync || '') === '1';
            const autoFallbackGemini = resolveEffectiveAutoFallbackGemini(
                aiProvider,
                req.body?.autoFallbackGemini
            );

            if (req.file?.path) {
                savedInputPath = path.join(jobDir, `input${path.extname(req.file.path) || '.png'}`);
                fs.copyFileSync(req.file.path, savedInputPath);
                try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
            }

            writeJobMeta(metaPath, {
                jobId,
                status: 'running',
                stage: 'queued',
                stageLabel: hasFile && !useBuiltPrompt ? STAGE_LABELS.preparing : STAGE_LABELS.generating,
                createdAt: new Date().toISOString(),
                mode,
                aiProvider,
                quality,
                count,
                styleMode,
                promptPreview: prompt.slice(0, 120)
            });

            const jobCtx = {
                jobId,
                jobDir,
                metaPath,
                prompt,
                hasFile,
                baseUrl,
                apiKey,
                cloudApiKey,
                requestApiKey,
                quality,
                count,
                styleMode,
                mode,
                aiProvider,
                autoFallbackGemini,
                useBuiltPrompt,
                builtPrompt,
                systemPrompt,
                autoImageTemplate,
                styleList,
                savedInputPath,
                inputMime,
                renameNoteContext,
                libraryDisplayName,
                req,
                rootDir
            };

            generateServerActiveJobs += 1;
            generateSlotHeld = true;

            if (syncMode) {
                try {
                    await processGenerateJob(jobCtx);
                } finally {
                    releaseGenerateServerSlot();
                    generateSlotHeld = false;
                }
                const meta = readJobMeta(metaPath);
                const outputs = fs.readdirSync(jobDir)
                    .filter((f) => /^composite_grid\.png$/i.test(f) || /^composite_batch_\d+\.png$/i.test(f) || /^design_\d+\.png$/i.test(f))
                    .sort((a, b) => {
                        if (a === 'composite_grid.png') return -1;
                        if (b === 'composite_grid.png') return 1;
                        const ba = /^composite_batch_(\d+)/i.exec(a);
                        const bb = /^composite_batch_(\d+)/i.exec(b);
                        if (ba && bb) return Number(ba[1]) - Number(bb[1]);
                        return a.localeCompare(b);
                    })
                    .map((filename, index) => ({
                        index: index + 1,
                        filename,
                        url: `/api/generate/file/${jobId}/${filename}`
                    }));
                const imagesWithB64 = outputs.map((o) => {
                    const buf = fs.readFileSync(path.join(jobDir, o.filename));
                    return {
                        ...o,
                        dataUrl: `data:image/png;base64,${buf.toString('base64')}`
                    };
                });
                return res.json({
                    success: true,
                    jobId,
                    status: 'done',
                    mode: meta.mode,
                    model: meta.model,
                    modelUsed: meta.modelUsed || meta.model,
                    fallbackFrom: meta.fallbackFrom || null,
                    endpoint: meta.endpoint,
                    autoGeneratedPrompt: meta.autoGeneratedPrompt || '',
                    visionUsed: !!meta.visionUsed,
                    visionModel: meta.visionModel || null,
                    visionError: meta.visionError || null,
                    generationStrategy: meta.generationStrategy || null,
                    images: imagesWithB64
                });
            }

            res.json({
                success: true,
                jobId,
                status: 'running',
                async: true,
                stageLabel: readJobMeta(metaPath).stageLabel
            });

            processGenerateJob(jobCtx)
                .catch((err) => {
                    log(`Generate background error ${jobId}: ${err.message}`, 'ERROR');
                })
                .finally(() => {
                    releaseGenerateServerSlot();
                    generateSlotHeld = false;
                });
        } catch (err) {
            if (generateSlotHeld) releaseGenerateServerSlot();
            log(`Generate error ${jobId}: ${err.message}`, 'ERROR');
            try {
                ensureDirs(jobDir);
                writeJobMeta(metaPath, {
                    jobId,
                    status: 'error',
                    stage: 'error',
                    stageLabel: 'فشل التوليد',
                    error: err.message,
                    httpStatus: err.httpStatus || 0,
                    endpoint: err.endpoint || ''
                });
            } catch (_) { /* ignore */ }

            return res.status(err.httpStatus && err.httpStatus < 500 ? err.httpStatus : 502).json({
                success: false,
                jobId,
                error: err.message || 'Generation failed',
                endpoint: err.endpoint || '',
                hint: `${MISSING_API_KEY_HINT_AR} تأكد أيضاً أن CLIProxyAPI يعمل (افتراضي ${DEFAULT_CLIPROXY_BASE_URL}).`
            });
        }
    });

    app.get('/api/generate/file/:jobId/:filename', (req, res) => {
        const safeJob = String(req.params.jobId || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const safeFile = String(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '');
        const filePath = path.join(JOBS_DIR, safeJob, safeFile);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(filePath);
    });

    app.get('/api/gallery', (_req, res) => {
        const entries = readGalleryIndex(GALLERY_INDEX);
        res.json({ success: true, items: entries });
    });

    app.delete('/api/gallery/all', (_req, res) => {
        try {
            const entries = readGalleryIndex(GALLERY_INDEX);
            let deleted = 0;
            for (const ent of entries) {
                if (ent?.jobId) {
                    deleteGalleryJobDir(JOBS_DIR, ent.jobId);
                    deleted += 1;
                }
            }
            writeGalleryIndex(GALLERY_INDEX, []);
            return res.json({ success: true, cleared: true, deleted });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    function getFallbackStageStaleTimeoutMs() {
        return Math.min(
            getJobStaleTimeoutMs(),
            getGeminiAttemptTimeoutMs() + 15000
        );
    }

    function getStageStaleLimitMs(stage) {
        const stuckStage = String(stage || 'running');
        if (stuckStage === 'fallback_gemini' || stuckStage === 'fallback_gpt') {
            return getFallbackStageStaleTimeoutMs();
        }
        return getJobStaleTimeoutMs();
    }

    /**
     * Mark a running job as error if it has not progressed past the stage limit.
     * Used by GET /api/jobs/:id and a background sweeper so orphans never stay
     * running forever when the UI stops polling.
     */
    function markJobStaleIfNeeded(metaPath, meta, { logMark = true } = {}) {
        if (!meta || meta.status !== 'running') return meta;
        const touchedMs = Date.parse(meta.updatedAt || meta.createdAt || '') || 0;
        const ageMs = touchedMs ? (Date.now() - touchedMs) : Number.POSITIVE_INFINITY;
        const stuckStage = String(meta.stage || 'running');
        const limitMs = getStageStaleLimitMs(stuckStage);
        if (!(ageMs > limitMs)) return meta;
        const sec = Math.round(limitMs / 1000);
        const next = writeJobMeta(metaPath, {
            status: 'error',
            stage: 'error',
            stageLabel: 'فشل التوليد',
            error: `انتهت مهلة التوليد (${sec} ث) — المهمة عالقة في ${stuckStage}. أعد المحاولة أو تحقق من CLIProxy/Gemini.`,
            staleTimeout: true,
            stuckStage,
            httpStatus: 504
        });
        if (logMark) {
            const jobId = String(meta.jobId || path.basename(path.dirname(metaPath)) || '');
            log(`Generate ${jobId}: marked stale/error after ${Math.round(ageMs / 1000)}s in ${stuckStage}`, 'WARN');
        }
        return next;
    }

    function sweepStaleGenerateJobs() {
        try {
            if (!fs.existsSync(JOBS_DIR)) return;
            const dirs = fs.readdirSync(JOBS_DIR, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            for (const jobId of dirs) {
                const metaPath = path.join(JOBS_DIR, jobId, 'meta.json');
                if (!fs.existsSync(metaPath)) continue;
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    markJobStaleIfNeeded(metaPath, meta);
                } catch (_) { /* ignore corrupt meta */ }
            }
        } catch (err) {
            log(`Generate stale sweep failed: ${err.message}`, 'WARN');
        }
    }

    const staleSweepTimer = setInterval(sweepStaleGenerateJobs, 20000);
    if (typeof staleSweepTimer.unref === 'function') staleSweepTimer.unref();
    // Finalize orphans left from previous Ghost process immediately.
    setTimeout(sweepStaleGenerateJobs, 2500);

    app.get('/api/jobs/:id', (req, res) => {
        const safeJob = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const metaPath = path.join(JOBS_DIR, safeJob, 'meta.json');
        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        try {
            let meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            // Fail stuck running jobs (hung Gemini body / no timeout) so UI never spins forever.
            meta = markJobStaleIfNeeded(metaPath, meta);
            const files = fs.readdirSync(path.join(JOBS_DIR, safeJob))
                .filter((f) => /^composite_grid\.png$/i.test(f) || /^composite_batch_\d+\.png$/i.test(f) || /^design_\d+\.png$/i.test(f))
                .sort((a, b) => {
                    if (a === 'composite_grid.png') return -1;
                    if (b === 'composite_grid.png') return 1;
                    const ba = /^composite_batch_(\d+)/i.exec(a);
                    const bb = /^composite_batch_(\d+)/i.exec(b);
                    if (ba && bb) return Number(ba[1]) - Number(bb[1]);
                    return a.localeCompare(b);
                })
                .map((filename) => ({
                    filename,
                    url: `/api/generate/file/${safeJob}/${filename}`
                }));
            const batches = Array.isArray(meta.batches) ? meta.batches : [];
            return res.json({
                success: true,
                job: meta,
                files,
                batches,
                batchesCompleted: meta.batchesCompleted || batches.length,
                totalBatches: meta.totalBatches || batches.length || 1
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/jobs/:id/cancel', (req, res) => {
        const safeJob = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const metaPath = path.join(JOBS_DIR, safeJob, 'meta.json');
        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        try {
            cancelledJobs.add(safeJob);
            const meta = writeJobMeta(metaPath, {
                status: 'cancelled',
                stage: 'cancelled',
                stageLabel: 'تم الإيقاف',
                cancelledAt: new Date().toISOString()
            });
            return res.json({ success: true, jobId: safeJob, status: 'cancelled', job: meta });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    function safeLibraryId(raw) {
        return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '');
    }

    /** Folder on disk is always storageId (strip __dN design suffix from route param). */
    function libraryStorageIdFromParam(raw) {
        return parseLibraryDesignId(safeLibraryId(raw)).storageId;
    }

    function resolveLibraryFileOnDisk(libDir, requestedName) {
        const safeFile = safeLibraryFileSegment(requestedName);
        const designMatch = safeFile.match(/^design_(\d+)\.png$/i);
        const designIndex = designMatch ? parseInt(designMatch[1], 10) : 0;
        return resolveLibraryFileOnDiskShared(libDir, requestedName, { designIndex });
    }

    async function resolveLibraryFileForRequest(libDir, requestedName) {
        const safeFile = safeLibraryFileSegment(requestedName);
        const designMatch = safeFile.match(/^design_(\d+)\.png$/i);
        if (designMatch) {
            await ensureLibraryDesignSplitsOnDisk(libDir);
        }
        const hit = resolveLibraryFileOnDisk(libDir, requestedName);
        if (hit.filePath) return hit;
        if (hit.needsSplit) {
            await ensureLibraryDesignSplitsOnDisk(libDir);
            return resolveLibraryFileOnDisk(libDir, requestedName);
        }
        return hit;
    }

    function isPathInsideLibrary(targetPath) {
        const resolved = path.resolve(targetPath);
        const libResolved = path.resolve(LIBRARY_DIR);
        return resolved === libResolved || resolved.startsWith(`${libResolved}${path.sep}`);
    }

    async function deleteOneLibraryEntry(parsed, index) {
        const libDir = path.join(LIBRARY_DIR, parsed.storageId);
        if (!isPathInsideLibrary(libDir)) {
            return { ok: false, id: parsed.id, index, error: 'مسار غير آمن' };
        }
        const entry = index.find((e) => e.id === parsed.id);
        if (!entry && !fs.existsSync(libDir)) {
            return { ok: false, notFound: true, id: parsed.id, index };
        }
        if (parsed.isDesign) {
            const meta = readLibraryMeta(libDir);
            const { filePath } = resolveLibraryDesignFileOnDisk(libDir, parsed, entry, meta);
            if (filePath && isPathInsideLibrary(filePath) && fs.existsSync(filePath)) {
                const rmFile = await removeFileRobust(filePath);
                if (!rmFile.ok) {
                    return {
                        ok: false,
                        locked: !!rmFile.locked,
                        id: parsed.id,
                        index,
                        error: formatLibraryFsErrorAr(rmFile.error, filePath)
                    };
                }
            }
            const newIndex = index.filter((e) => e.id !== parsed.id);
            const remainingDesigns = newIndex.filter((e) => e.storageId === parsed.storageId);
            if (!remainingDesigns.length && fs.existsSync(libDir) && isPathInsideLibrary(libDir)) {
                const rmDir = await removeDirRobust(libDir);
                if (!rmDir.ok && !rmDir.missing) {
                    if (rmDir.locked) {
                        return { ok: true, id: parsed.id, index: newIndex, folderLocked: true };
                    }
                    return {
                        ok: false,
                        locked: false,
                        id: parsed.id,
                        index,
                        error: formatLibraryFsErrorAr(rmDir.error, libDir)
                    };
                }
            }
            return { ok: true, id: parsed.id, index: newIndex };
        }
        if (fs.existsSync(libDir) && isPathInsideLibrary(libDir)) {
            const rmDir = await removeDirRobust(libDir);
            if (!rmDir.ok && !rmDir.missing) {
                return {
                    ok: false,
                    locked: !!rmDir.locked,
                    id: parsed.id,
                    index,
                    error: formatLibraryFsErrorAr(rmDir.error, libDir)
                };
            }
        }
        const newIndex = index.filter((e) => e.id !== parsed.id && e.storageId !== parsed.storageId);
        return { ok: true, id: parsed.id, index: newIndex };
    }

    function buildLibraryBulkDeletePayload(deleted, notFound, locked) {
        const lockedIds = locked.map((row) => row.id);
        const message = buildLibraryDeleteMessageAr({
            deleted: deleted.length,
            locked: locked.length,
            notFound: notFound.length
        });
        const partial = locked.length > 0;
        const success = deleted.length > 0;
        return {
            success,
            partial,
            deleted,
            notFound,
            locked: lockedIds,
            lockedDetails: locked,
            count: deleted.length,
            message,
            error: partial ? message : undefined
        };
    }

    app.get('/api/library', (_req, res) => {
        runLibraryIndexLocked(() => {
            const raw = ensureLibraryIndexSynced();
            const items = flattenLibraryIndexForDesigns(raw, readLibraryMeta, LIBRARY_DIR);
            res.json({
                success: true,
                items,
                libraryRoot: LIBRARY_DIR,
                projectRoot: rootDir
            });
        }).catch((err) => {
            res.status(500).json({ success: false, error: err.message });
        });
    });

    app.get('/api/library/audit', (_req, res) => {
        runLibraryIndexLocked(() => {
            const raw = readLibraryIndex();
            const report = auditLibraryIntegrity(LIBRARY_DIR, {
                index: raw,
                readMetaFn: readLibraryMeta
            });
            res.json({
                success: true,
                ...report,
                summaryAr: report.brokenCount
                    ? `${report.brokenCount} تصاميم تالفة من ${report.totalDesigns}`
                    : `جميع التصاميم سليمة (${report.totalDesigns})`,
                issueLabelsAr: ISSUE_LABEL_AR
            });
        }).catch((err) => {
            res.status(500).json({ success: false, error: err.message });
        });
    });

    app.post('/api/library/reconcile', (_req, res) => {
        runLibraryIndexLocked(() => {
            const raw = readLibraryIndex();
            const reconciled = reconcileLibraryIndexFromDisk(LIBRARY_DIR, raw, readLibraryMeta);
            const { index: repaired, repaired: fixed, metaUpdated } = repairLibraryIndexFromDisk(
                LIBRARY_DIR,
                reconciled,
                readLibraryMeta
            );
            writeLibraryIndex(repaired);
            const report = auditLibraryIntegrity(LIBRARY_DIR, {
                index: repaired,
                readMetaFn: readLibraryMeta
            });
            return {
                success: true,
                repairedCount: fixed.length,
                repaired: fixed,
                metaUpdated,
                report,
                summaryAr: fixed.length
                    ? `تم إصلاح ${fixed.length} مدخل — متبقٍ ${report.brokenCount} تالف`
                    : (report.brokenCount
                        ? `لم يُصلَح شيء — ${report.brokenCount} تصاميم تالفة`
                        : 'الفهرس متزامن مع القرص')
            };
        }).then((payload) => {
            res.json(payload);
        }).catch((err) => {
            res.status(500).json({ success: false, error: err.message });
        });
    });

    app.post('/api/library/upload', libraryUpload.any(), async (req, res) => {
        const files = (Array.isArray(req.files) ? req.files : [])
            .filter((f) => f && f.buffer && f.buffer.length);
        if (!files.length) {
            return res.status(400).json({ success: false, error: 'لم يُرفع أي ملف صورة' });
        }
        try {
            const uploaded = [];
            for (const file of files) {
                const saved = await saveUploadedImageToLibrary(file.buffer, {
                    originalName: file.originalname || '',
                    displayName: req.body?.displayName || '',
                    source: req.body?.source || '',
                    originalDesignId: req.body?.originalDesignId || '',
                    versionLabel: req.body?.versionLabel || ''
                });
                uploaded.push(saved.item);
            }
            return res.json({
                success: true,
                count: uploaded.length,
                items: uploaded
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    // Static library routes MUST register before /api/library/:id (Express matches :id first on GET).
    app.post('/api/library/smart-rename', async (req, res) => {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        if (!ids.length) {
            return res.status(400).json({ success: false, error: 'حدّد تصاميم للتسمية' });
        }
        try {
            const reqCreds = resolveRequestCliProxyCredentials(req);
            const { baseUrl, apiKey } = getCliProxyConfig(rootDir, reqCreds);
            if (!apiKey) {
                return res.status(503).json({
                    success: false,
                    error: MISSING_API_KEY_ERROR_AR,
                    hint: MISSING_API_KEY_HINT_AR
                });
            }
            const noteContext = librarySmartRename.parseRenameNoteContext(
                req.body?.renameNoteContext || req.body?.noteContext
            );
            const storageIds = librarySmartRename.groupDesignIdsToStorageIds(ids);
            librarySmartRename.enqueue({
                type: 'storage-ids',
                storageIds,
                noteContext,
                baseUrl,
                apiKey
            });
            return res.json({
                success: true,
                queued: true,
                storageIds,
                message: 'تمت جدولة التسمية الذكية — ستظهر الأسماء بعد لحظات'
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.delete('/api/library/all', (_req, res) => {
        runLibraryIndexLocked(async () => {
            let removed = 0;
            let locked = 0;
            if (fs.existsSync(LIBRARY_DIR)) {
                for (const ent of fs.readdirSync(LIBRARY_DIR, { withFileTypes: true })) {
                    if (ent.name === 'index.json') continue;
                    const full = path.join(LIBRARY_DIR, ent.name);
                    if (!isPathInsideLibrary(full)) continue;
                    const rm = ent.isDirectory()
                        ? await removeDirRobust(full)
                        : await removeFileRobust(full);
                    if (rm.ok || rm.missing) {
                        removed += 1;
                    } else if (rm.locked) {
                        locked += 1;
                    }
                }
            }
            const reconciled = reconcileLibraryIndexFromDisk(LIBRARY_DIR, [], readLibraryMeta);
            writeLibraryIndex(reconciled);
            const message = buildLibraryDeleteMessageAr({ deleted: removed, locked });
            const partial = locked > 0;
            const success = removed > 0 || !partial;
            return {
                success,
                partial,
                deleted: removed,
                lockedCount: locked,
                cleared: !partial && reconciled.length === 0,
                count: removed,
                message,
                error: (!success && partial) ? message : undefined
            };
        }).then((payload) => {
            res.status(200).json(payload);
        }).catch((err) => {
            log(`Library delete all failed: ${err.message}`, 'ERROR');
            res.status(500).json({
                success: false,
                error: formatLibraryFsErrorAr(err, LIBRARY_DIR)
            });
        });
    });

    app.delete('/api/library/bulk', (req, res) => {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        if (!ids.length) {
            return res.status(400).json({ success: false, error: 'لا توجد عناصر للحذف' });
        }
        runLibraryIndexLocked(async () => {
            let index = readLibraryIndex();
            const deleted = [];
            const notFound = [];
            const locked = [];
            for (const rawId of ids) {
                try {
                    const parsed = parseLibraryDesignId(rawId);
                    const result = await deleteOneLibraryEntry(parsed, index);
                    if (result.ok) {
                        index = result.index;
                        deleted.push(result.id);
                    } else if (result.notFound) {
                        notFound.push(result.id);
                    } else if (result.locked || result.error) {
                        locked.push({
                            id: result.id || String(rawId),
                            error: result.error || formatLibraryFsErrorAr(null, rawId)
                        });
                    }
                } catch (err) {
                    locked.push({
                        id: String(rawId),
                        error: formatLibraryFsErrorAr(err, rawId)
                    });
                }
            }
            writeLibraryIndex(index);
            return buildLibraryBulkDeletePayload(deleted, notFound, locked);
        }).then((payload) => {
            res.status(200).json(payload);
        }).catch((err) => {
            log(`Library bulk delete failed: ${err.message}`, 'ERROR');
            res.status(500).json({
                success: false,
                error: formatLibraryFsErrorAr(err, LIBRARY_DIR)
            });
        });
    });

    app.get('/api/library/:id', (req, res) => {
        if (isLibraryReservedSlug(req.params.id)) {
            return respondLibraryReservedSlug(res, String(req.params.id).toLowerCase(), 'GET');
        }
        const parsed = parseLibraryDesignId(req.params.id);
        const libDir = path.join(LIBRARY_DIR, parsed.storageId);
        const meta = readLibraryMeta(libDir);
        if (!meta) {
            return res.status(404).json({ success: false, error: 'غير موجود في المكتبة' });
        }
        if (parsed.isDesign) {
            const designFile = (meta.files || []).find((f) => f.name === parsed.fileName)
                || { name: parsed.fileName, role: 'split', url: `/api/library/${parsed.storageId}/file/${parsed.fileName}` };
            return res.json({
                success: true,
                item: {
                    ...meta,
                    id: parsed.id,
                    storageId: parsed.storageId,
                    designIndex: parsed.designIndex,
                    designTotal: meta.files?.filter((f) => f.role === 'split').length || 4,
                    fileName: parsed.fileName,
                    thumbUrl: `/api/library/${parsed.storageId}/file/${parsed.fileName}`,
                    files: [designFile]
                }
            });
        }
        return res.json({ success: true, item: meta });
    });

    app.get('/api/library/:id/thumb', async (req, res) => {
        const parsed = parseLibraryDesignId(req.params.id);
        const libId = parsed.storageId;
        const libDir = path.join(LIBRARY_DIR, libId);
        const maxW = (() => {
            const w = parseInt(req.query?.w, 10);
            if (!Number.isFinite(w) || w < 48) return 256;
            return Math.min(512, w);
        })();

        const streamThumbWebp = async (filePath) => {
            const base = path.basename(filePath).toLowerCase();
            const isCachedThumb = base === 'thumb.webp' || base === 'thumb.jpg' || base === 'thumb.jpeg';
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            let pipeline = sharp(filePath);
            if (!isCachedThumb) {
                pipeline = pipeline.resize(maxW, maxW, { fit: 'inside', withoutEnlargement: true });
            }
            await pipeline.webp({ quality: 78 }).pipe(res);
        };

        const resolveSourcePath = async () => {
            // Split cards (__dN): individual design_N.png only — never folder thumb.webp or composite.
            if (parsed.isDesign) {
                try {
                    const index = readLibraryIndex();
                    const indexEntry = index.find((e) => e.id === parsed.id) || null;
                    const meta = readLibraryMeta(libDir);
                    await ensureLibraryDesignSplitsOnDisk(libDir);
                    const { filePath: designPath } = resolveLibraryDesignFileOnDisk(libDir, parsed, indexEntry, meta);
                    if (designPath) return designPath;
                } catch (_) { /* fall through */ }

                if (parsed.fileName) {
                    const hinted = path.join(libDir, safeLibraryFileSegment(parsed.fileName));
                    if (fs.existsSync(hinted)) return hinted;
                }

                const idx = parsed.designIndex || 1;
                for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
                    const splitPath = path.join(libDir, `design_${idx}${ext}`);
                    if (fs.existsSync(splitPath)) return splitPath;
                    const altPath = path.join(libDir, `split_${idx}${ext}`);
                    if (fs.existsSync(altPath)) return altPath;
                }
                return null;
            }

            const webp = path.join(libDir, 'thumb.webp');
            const jpg = path.join(libDir, 'thumb.jpg');
            if (fs.existsSync(webp)) return webp;
            if (fs.existsSync(jpg)) return jpg;

            const composite = path.join(libDir, 'composite.png');
            if (fs.existsSync(composite)) return composite;

            if (parsed.fileName) {
                const hinted = path.join(libDir, safeLibraryFileSegment(parsed.fileName));
                if (fs.existsSync(hinted)) return hinted;
            }

            try {
                const names = fs.readdirSync(libDir).filter((n) =>
                    /\.(png|jpe?g|webp)$/i.test(n) && !/^thumb\./i.test(n)
                );
                if (names.length === 1) return path.join(libDir, names[0]);
            } catch (_) { /* ignore */ }

            return null;
        };

        try {
            const sourcePath = await resolveSourcePath();
            if (!sourcePath) {
                return res.status(404).json({ success: false, error: 'لا توجد صورة مصغّرة' });
            }
            return await streamThumbWebp(sourcePath);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/library/:id/file/:filename', async (req, res) => {
        const libId = libraryStorageIdFromParam(req.params.id);
        const libDir = path.join(LIBRARY_DIR, libId);
        try {
            const { filePath, fileName } = await resolveLibraryFileForRequest(libDir, req.params.filename);
            if (!filePath || !isPathInsideLibrary(filePath)) {
                return res.status(404).json({ success: false, error: 'الملف غير موجود' });
            }
            const ext = path.extname(fileName).toLowerCase();
            const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
            const mime = types[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            const disposition = mime.startsWith('image/') ? 'inline' : 'attachment';
            res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
            return res.sendFile(filePath);
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.get('/api/library/:id/download', async (req, res) => {
        const parsed = parseLibraryDesignId(safeLibraryId(req.params.id));
        const libDir = path.join(LIBRARY_DIR, parsed.storageId);
        const index = readLibraryIndex();
        const indexEntry = index.find((e) => e.id === parsed.id) || null;
        const meta = readLibraryMeta(libDir);
        try {
            const { filePath, fileName } = await resolveLibraryDesignFilePath(libDir, parsed.id, {
                indexEntry,
                meta
            });
            if (!filePath || !isPathInsideLibrary(filePath)) {
                return res.status(404).json({ success: false, error: 'الملف غير موجود' });
            }
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', 'inline');
            return res.sendFile(filePath);
        } catch (err) {
            return res.status(404).json({ success: false, error: err.message });
        }
    });

    app.patch('/api/library/:id', (req, res) => {
        if (isLibraryReservedSlug(req.params.id)) {
            return respondLibraryReservedSlug(res, String(req.params.id).toLowerCase(), 'PATCH');
        }
        const parsed = parseLibraryDesignId(req.params.id);
        const displayName = req.body?.displayName ?? req.body?.title;
        try {
            const result = librarySmartRename.patchSingleDesignDisplayName(parsed, displayName);
            if (result.notFound) {
                return res.status(404).json({ success: false, error: 'غير موجود في المكتبة' });
            }
            if (!result.ok) {
                return res.status(400).json({ success: false, error: result.error || 'تعذّر التحديث' });
            }
            return res.json({
                success: true,
                id: result.id,
                displayName: result.displayName,
                fileName: result.fileName,
                thumbUrl: result.thumbUrl
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    app.delete('/api/library/:id', (req, res) => {
        if (isLibraryReservedSlug(req.params.id)) {
            return respondLibraryReservedSlug(res, String(req.params.id).toLowerCase(), 'DELETE');
        }
        const parsed = parseLibraryDesignId(req.params.id);
        runLibraryIndexLocked(async () => {
            const index = readLibraryIndex();
            const result = await deleteOneLibraryEntry(parsed, index);
            if (result.notFound) {
                return { ok: false, status: 404, body: { success: false, error: 'غير موجود في المكتبة' } };
            }
            if (!result.ok) {
                const message = result.error || buildLibraryDeleteMessageAr({ locked: 1 });
                return {
                    ok: false,
                    status: 200,
                    body: {
                        success: false,
                        partial: true,
                        locked: [result.id],
                        error: message,
                        message
                    }
                };
            }
            writeLibraryIndex(result.index);
            return { ok: true, body: { success: true, id: result.id } };
        }).then((payload) => {
            if (!payload.ok) return res.status(payload.status).json(payload.body);
            return res.json(payload.body);
        }).catch((err) => {
            res.status(500).json({ success: false, error: formatLibraryFsErrorAr(err, req.params.id) });
        });
    });

    log(`Generate API routes registered v${GENERATE_API_ROUTES_VERSION} (GET /api/generate/prompt-defaults, GET /api/generate/health, POST /api/generate/test, POST /api/generate, /api/gallery, DELETE /api/gallery/all, /api/jobs/:id, /api/jobs/:id/cancel, /api/library, GET /api/library/audit, POST /api/library/reconcile, POST /api/library/upload|smart-rename, PATCH /api/library/:id, GET /api/library/:id/file|download, DELETE /api/library/bulk|all|:id)`);

    runLibraryIndexLocked(() => {
        ensureLibraryIndexSynced();
    }).catch((err) => {
        log(`Library index startup reconcile failed: ${err.message}`, 'WARN');
    });

    (async () => {
        try {
            const { baseUrl, apiKey } = getCliProxyConfig(rootDir, {});
            if (!apiKey) return;
            const probe = await getCliProxyImageModelsCached(baseUrl, apiKey, true);
            ensureGenerateEnvImageModel(rootDir, probe.available || [], log);
            if (probe.available?.length) {
                log(`CLIProxy image models: ${probe.available.join(', ')} (default: ${pickDefaultImageModel(probe.available)})`);
            } else {
                log(`CLIProxy startup: no image models in /models — ${imageModelsHintAr([], probe.recommended)}`, 'WARN');
            }
        } catch (e) {
            log(`CLIProxy image model probe skipped: ${e.message}`, 'WARN');
        }
    })();
}

module.exports = {
    GENERATE_API_ROUTES_VERSION,
    registerGenerateApi,
    reconcileLibraryIndexFromDisk,
    libraryIndexNeedsReconcile,
    getCliProxyConfig,
    getCliProxyConfigPreferred,
    getProviderCliProxyConfig,
    getProviderCliProxyConfigPreferred,
    resolvePreferredCliProxyBaseUrl,
    resolveRequestCliProxyCredentials,
    resolveRequestGeminiCredentials,
    normalizeGeminiBaseUrl,
    normalizeCliProxyBaseUrl,
    isLocalCliProxyBaseUrl,
    mapCliProxyErrorMessageAr,
    fetchCliProxyImageModels,
    getCliProxyImageModelsCached,
    MISSING_API_KEY_ERROR_AR,
    MISSING_API_KEY_HINT_AR
};
