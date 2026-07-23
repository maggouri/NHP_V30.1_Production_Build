/**
 * CLIProxy image model discovery — /v1/models + default picker for NHP Generate.
 * UTF-8 safe.
 */
'use strict';

/** Models CLIProxy may list on /v1/models (priority order for NHP defaults). */
const IMAGE_MODEL_PRIORITY = Object.freeze([
    'gpt-image-2',
    'gemini-3.1-flash-image',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-preview-image-generation',
    'imagen-3',
    'grok-imagine-image',
    'grok-imagine-image-quality',
    'dall-e-3',
    'dall-e-2'
]);

/** Gemini image fallbacks when exact id differs across CLIProxy builds. */
const GEMINI_IMAGE_FALLBACK_ORDER = Object.freeze([
    'gemini-3.1-flash-image',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
    'imagen-3',
    'imagen-3.0-generate-002'
]);

/** Never auto-select for Generate — often listed in /models but rejected on /images/generations. */
const NON_DEFAULT_IMAGE_MODELS = new Set(['dall-e-2', 'dall-e-3']);

const NHP_DEFAULT_IMAGE_MODEL = 'gpt-image-2';

const IMAGE_MODEL_PATTERNS = [
    /^gpt-image/i,
    /^gemini-.*image/i,
    /^gemini-.*image-generation/i,
    /^imagen-/i,
    /^grok-imagine/i,
    /^dall-e-/i
];

function normalizeModelId(id) {
    return String(id || '').trim().toLowerCase();
}

function isNonDefaultImageModel(id) {
    return NON_DEFAULT_IMAGE_MODELS.has(normalizeModelId(id));
}

function extractModelIdsFromListResponse(data) {
    const ids = new Set();
    const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    for (const item of list) {
        const raw = item?.id || item?.name || item;
        const norm = normalizeModelId(raw);
        if (norm) ids.add(norm);
    }
    return ids;
}

function isLikelyImageModelId(id) {
    const norm = normalizeModelId(id);
    if (!norm) return false;
    if (IMAGE_MODEL_PRIORITY.includes(norm)) return true;
    return IMAGE_MODEL_PATTERNS.some((re) => re.test(norm));
}

function isGeminiLikeImageModel(id) {
    const norm = normalizeModelId(id);
    if (!norm) return false;
    if (/^imagen-/i.test(norm)) return true;
    return /^gemini/i.test(norm) && /image|imagen/i.test(norm);
}

/** Gemini/Imagen image models use OpenRouter-style /chat/completions, not /images/generations. */
function prefersGeminiChatImageRoute(id) {
    return isGeminiLikeImageModel(id);
}

function isChatGptLikeImageModel(id) {
    const norm = normalizeModelId(id);
    return !!norm && /^gpt-image/i.test(norm);
}

/** Collect gemini/imagen ids from raw /v1/models list (fuzzy). */
function collectGeminiImageModels(modelIds = []) {
    const set = modelIds instanceof Set
        ? modelIds
        : new Set((Array.isArray(modelIds) ? modelIds : []).map(normalizeModelId));
    const out = [];
    const seen = new Set();
    for (const mid of GEMINI_IMAGE_FALLBACK_ORDER) {
        if (set.has(mid) && !seen.has(mid)) {
            seen.add(mid);
            out.push(mid);
        }
    }
    for (const id of set) {
        if (seen.has(id)) continue;
        if (isGeminiLikeImageModel(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}

/**
 * @param {Set<string>|string[]} modelIds - from CLIProxy GET /v1/models
 * @returns {string[]} supported image models in priority order
 */
function filterSupportedImageModels(modelIds) {
    const set = modelIds instanceof Set
        ? modelIds
        : new Set((Array.isArray(modelIds) ? modelIds : []).map(normalizeModelId));
    const out = [];
    const seen = new Set();
    for (const mid of IMAGE_MODEL_PRIORITY) {
        if (set.has(mid) && !seen.has(mid)) {
            seen.add(mid);
            out.push(mid);
        }
    }
    for (const id of set) {
        if (seen.has(id)) continue;
        if (isLikelyImageModelId(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}

/**
 * Prefer gpt-image-2 when CLIProxy lists it; skip dall-e-* unless it is the only option.
 */
function pickPreferredFromAvailable(available) {
    if (!available.length) return '';
    if (available.includes(NHP_DEFAULT_IMAGE_MODEL)) return NHP_DEFAULT_IMAGE_MODEL;
    const nonDalle = available.find((m) => !isNonDefaultImageModel(m));
    return nonDalle || available[0];
}

/**
 * Resolve env override — ignore dall-e-* when gpt-image-2 (or another non-dalle model) is available.
 */
function resolveEnvImageModel(envRaw, available) {
    const env = normalizeModelId(envRaw);
    if (!env) return '';
    if (available.length && !available.includes(env)) return '';
    if (isNonDefaultImageModel(env)) {
        const nonDalle = available.filter((m) => !isNonDefaultImageModel(m));
        if (nonDalle.length || !available.length) return '';
        return envRaw.trim();
    }
    return envRaw.trim();
}

/**
 * Pick default: validated CLIPROXY_IMAGE_MODEL → gpt-image-2 when listed → first non-dalle → gpt-image-2.
 */
function pickDefaultImageModel(availableModels = [], opts = {}) {
    const available = filterSupportedImageModels(availableModels);
    const envResolved = resolveEnvImageModel(
        String(opts.envOverride || process.env.CLIPROXY_IMAGE_MODEL || '').trim(),
        available
    );
    if (envResolved) return envResolved;
    const preferred = pickPreferredFromAvailable(available);
    if (preferred) return preferred;
    return NHP_DEFAULT_IMAGE_MODEL;
}

/** Drop dall-e from retry chain when Codex/xAI/Gemini options exist. */
function filterImageModelCandidates(candidates, availableModels = []) {
    const available = filterSupportedImageModels(availableModels);
    const list = (Array.isArray(candidates) ? candidates : [])
        .map((m) => normalizeModelId(m))
        .filter(Boolean);
    const hasNonDalle = list.some((m) => !isNonDefaultImageModel(m))
        || available.some((m) => !isNonDefaultImageModel(m));
    if (!hasNonDalle) return [...new Set(list)];
    const out = [];
    const seen = new Set();
    for (const mid of list) {
        if (isNonDefaultImageModel(mid)) continue;
        if (!seen.has(mid)) {
            seen.add(mid);
            out.push(mid);
        }
    }
    return out.length ? out : [...new Set(list)];
}

/** Map requested model to a safe choice (never dall-e when gpt-image-2 is available). */
function sanitizeImageModelChoice(model, availableModels = []) {
    const available = filterSupportedImageModels(availableModels);
    const norm = normalizeModelId(model);
    if (!norm) return pickDefaultImageModel(available);
    if (isNonDefaultImageModel(norm) && available.includes(NHP_DEFAULT_IMAGE_MODEL)) {
        return NHP_DEFAULT_IMAGE_MODEL;
    }
    if (available.length && !available.includes(norm)) {
        return pickDefaultImageModel(available);
    }
    if (isNonDefaultImageModel(norm) && available.some((m) => !isNonDefaultImageModel(m))) {
        return pickPreferredFromAvailable(available);
    }
    return norm;
}

function imageModelsHintAr(availableModels, recommendedModel) {
    const available = filterSupportedImageModels(availableModels);
    const rec = String(recommendedModel || '').trim() || pickDefaultImageModel(available);
    if (!available.length) {
        return [
            'لا يظهر أي نموذج صور في CLIProxy /v1/models.',
            'الحل 1 — Codex OAuth: http://127.0.0.1:8317 → gpt-image-2 (افتراضي NHP).',
            'الحل 2 — xAI OAuth: grok-imagine-image.',
            'الحل 3 — Gemini: gemini-3.1-flash-image في config.yaml.',
            `الافتراضي الحالي: ${rec} (قد يفشل حتى تُعدّ CLIProxy).`
        ].join('\n');
    }
    return `نماذج الصور المتاحة: ${available.join('، ')}. الافتراضي: ${rec}.`;
}

function unsupportedImageModelErrorAr(requestedModel, availableModels = [], opts = {}) {
    const available = filterSupportedImageModels(availableModels);
    const rawIds = opts.rawModelIds || availableModels;
    const geminiModels = collectGeminiImageModels(rawIds);
    const list = available.length
        ? available.filter((m) => !isNonDefaultImageModel(m)).join('، ') || available.join('، ')
        : 'gpt-image-2 (Codex)، grok-imagine-image (xAI)، gemini-3.1-flash-image';
    const req = String(requestedModel || '').trim();
    const reqNorm = normalizeModelId(req);
    const wasListed = !!(reqNorm && (
        available.includes(reqNorm)
        || geminiModels.includes(reqNorm)
        || (rawIds instanceof Set ? rawIds.has(reqNorm) : (Array.isArray(rawIds) && rawIds.map(normalizeModelId).includes(reqNorm)))
    ));
    const geminiRouteHint = wasListed && (isGeminiLikeImageModel(req) || opts.aiProvider === 'gemini')
        ? 'النموذج مُدرَج في /v1/models — نماذج Gemini تُولَّد عبر /chat/completions (modalities: image,text) وليس /images/generations.'
        : 'النموذج غير مدعوم لمسار /images/generations في CLIProxyAPI.';
    const lines = [
        geminiRouteHint,
        req ? `النموذج المطلوب: ${req}.` : '',
        `استخدم: ${list}.`,
        'عيّن CLIPROXY_IMAGE_MODEL=gpt-image-2 في .env بجذر المشروع عند توفر Codex.'
    ];
    if (isGeminiLikeImageModel(req) || opts.aiProvider === 'gemini') {
        lines.push(geminiImageSetupHintAr(available, rawIds));
        if (geminiModels.length) {
            lines.push(`جرّب أحد النماذج المكتشفة: ${geminiModels.join('، ')}.`);
        }
    }
    if (isChatGptLikeImageModel(req) || opts.aiProvider === 'chatgpt') {
        lines.push(
            'لتفعيل ChatGPT للصور: أضف مصادقة Codex OAuth في CLIProxy (http://127.0.0.1:8317) — gpt-image-2 لا يعمل بمفتاح API وحده.',
            'تحقق من سجلات CLIProxy عند خطأ stream disconnected.'
        );
    }
    if (isNonDefaultImageModel(req)) {
        lines.push('ملاحظة: dall-e-3 قد يظهر في /models لكنه غير مدعوم على /v1/images/generations — استخدم gpt-image-2.');
    }
    return lines.filter(Boolean).join('\n');
}

function isNhpMappedErrorAr(msg) {
    const m = String(msg || '').trim();
    if (!m) return false;
    return /^(تعذّر|لا توجد|النموذج غير مدعوم|انتهت مهلة|تعذّر الاتصال|CLIProxy returned no images)/.test(m);
}

/** UI mode: auto | gemini | chatgpt */
function normalizeAiProvider(raw) {
    const m = String(raw || '').trim().toLowerCase();
    if (m === 'gemini') return 'gemini';
    if (m === 'chatgpt' || m === 'gpt' || m === 'openai' || m === 'codex') return 'chatgpt';
    if (m === 'auto' || m === 'automatic' || m === 'تلقائي') return 'auto';
    return 'auto';
}

function findGeminiImageModel(availableModels = [], rawModelIds = null) {
    const available = filterSupportedImageModels(availableModels);
    const geminiPool = collectGeminiImageModels(
        rawModelIds && (rawModelIds.size || rawModelIds.length)
            ? rawModelIds
            : available
    );
    if (geminiPool.length) return geminiPool[0];
    return available.find((m) => isGeminiLikeImageModel(m)) || '';
}

function findChatGptImageModel(availableModels = [], rawModelIds = null) {
    const available = filterSupportedImageModels(availableModels);
    const raw = rawModelIds instanceof Set
        ? [...rawModelIds]
        : (Array.isArray(rawModelIds) ? rawModelIds : available);
    const gpt = raw.map(normalizeModelId).find((m) => isChatGptLikeImageModel(m));
    if (gpt) return gpt;
    return available.find((m) => isChatGptLikeImageModel(m)) || '';
}

/** Ordered candidates for /api/generate/test — tries fallbacks before hard-fail. */
function resolveTestImageModelCandidates(provider, availableModels = [], rawModelIds = null) {
    const p = normalizeAiProvider(provider);
    const available = filterSupportedImageModels(availableModels);
    const rawSet = rawModelIds instanceof Set
        ? rawModelIds
        : new Set((Array.isArray(rawModelIds) ? rawModelIds : available).map(normalizeModelId));
    if (p === 'gemini') {
        const pool = collectGeminiImageModels(rawSet.size ? rawSet : available);
        return pool.length ? pool : (findGeminiImageModel(available, rawSet) ? [findGeminiImageModel(available, rawSet)] : []);
    }
    if (p === 'chatgpt') {
        const pool = [];
        const seen = new Set();
        for (const id of rawSet) {
            if (isChatGptLikeImageModel(id) && !seen.has(id)) {
                seen.add(id);
                pool.push(id);
            }
        }
        for (const m of available) {
            if (isChatGptLikeImageModel(m) && !seen.has(m)) {
                seen.add(m);
                pool.push(m);
            }
        }
        if (!pool.length && findChatGptImageModel(available, rawSet)) pool.push(findChatGptImageModel(available, rawSet));
        for (const id of rawSet) {
            if (/^grok-imagine/i.test(id) && !seen.has(id)) {
                seen.add(id);
                pool.push(id);
            }
        }
        return pool;
    }
    const primary = pickImageModelByProvider(p, available, { rawModelIds: rawSet });
    const fallbackRaw = String(process.env.CLIPROXY_IMAGE_FALLBACK || '').trim();
    const fallback = resolveEnvImageModel(fallbackRaw, available) || fallbackRaw;
    const out = [];
    const seen = new Set();
    const push = (mid) => {
        const norm = normalizeModelId(mid);
        if (!norm || seen.has(norm)) return;
        seen.add(norm);
        out.push(norm);
    };
    push(primary);
    push(fallback);
    for (const mid of available) {
        if (!isNonDefaultImageModel(mid)) push(mid);
    }
    if (!out.length && primary) push(primary);
    return filterImageModelCandidates(out, available);
}

function geminiImageSetupHintAr(availableModels = [], rawModelIds = null) {
    const geminiModels = collectGeminiImageModels(
        rawModelIds || availableModels
    );
    const lines = [
        'لتفعيل Gemini للصور في CLIProxyAPI:',
        '1) افتح http://127.0.0.1:8317 → أضف مصادقة Google/Gemini في auth-dir.',
        '2) في config.yaml فعّل نموذج صور Gemini (مثل gemini-3.1-flash-image أو gemini-2.0-flash-preview-image-generation).',
        '3) أعد تشغيل CLIProxy ثم تحقق من GET /v1/models — يجب أن يظهر نموذج gemini*image*.',
        '4) اختياري: CLIPROXY_IMAGE_FALLBACK=gemini-3.1-flash-image في .env بجذر المشروع.'
    ];
    if (geminiModels.length) {
        lines.push(`نماذج Gemini المكتشفة: ${geminiModels.join('، ')}.`);
    } else {
        lines.push('لم يُكتشف أي نموذج gemini*image* في /v1/models حالياً.');
    }
    return lines.join('\n');
}

function pickImageModelByProvider(provider, availableModels = [], opts = {}) {
    const p = normalizeAiProvider(provider);
    const available = filterSupportedImageModels(availableModels);
    const rawIds = opts.rawModelIds || null;
    if (p === 'gemini') {
        const gem = findGeminiImageModel(available, rawIds);
        if (gem) return gem;
    }
    if (p === 'chatgpt') {
        const gpt = findChatGptImageModel(available, rawIds);
        if (gpt) return gpt;
    }
    return pickDefaultImageModel(available, opts);
}

function filterImageModelsByProvider(provider, candidates, availableModels = []) {
    const p = normalizeAiProvider(provider);
    const available = filterSupportedImageModels(availableModels);
    if (p === 'auto') return filterImageModelCandidates(candidates, available);
    const pool = p === 'gemini'
        ? available.filter((m) => /^gemini-/i.test(m))
        : available.filter((m) => /^gpt-image/i.test(m));
    if (!pool.length) return filterImageModelCandidates(candidates, available);
    const preferred = pickImageModelByProvider(p, available);
    const out = [];
    const seen = new Set();
    if (preferred) {
        seen.add(preferred);
        out.push(preferred);
    }
    pool.forEach((m) => {
        if (!seen.has(m)) {
            seen.add(m);
            out.push(m);
        }
    });
    (Array.isArray(candidates) ? candidates : []).forEach((m) => {
        const norm = normalizeModelId(m);
        if (norm && pool.includes(norm) && !seen.has(norm)) {
            seen.add(norm);
            out.push(norm);
        }
    });
    return out.length ? out : [preferred || pickImageModelByProvider(p, available)];
}

module.exports = {
    IMAGE_MODEL_PRIORITY,
    GEMINI_IMAGE_FALLBACK_ORDER,
    NHP_DEFAULT_IMAGE_MODEL,
    NON_DEFAULT_IMAGE_MODELS,
    normalizeModelId,
    extractModelIdsFromListResponse,
    filterSupportedImageModels,
    isLikelyImageModelId,
    isGeminiLikeImageModel,
    prefersGeminiChatImageRoute,
    isChatGptLikeImageModel,
    collectGeminiImageModels,
    isNonDefaultImageModel,
    pickDefaultImageModel,
    pickPreferredFromAvailable,
    resolveEnvImageModel,
    filterImageModelCandidates,
    sanitizeImageModelChoice,
    imageModelsHintAr,
    geminiImageSetupHintAr,
    unsupportedImageModelErrorAr,
    isNhpMappedErrorAr,
    normalizeAiProvider,
    findGeminiImageModel,
    findChatGptImageModel,
    resolveTestImageModelCandidates,
    pickImageModelByProvider,
    filterImageModelsByProvider
};
