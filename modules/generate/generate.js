/**
 * Generate — ChatGPT-style Studio & AI section (T-shirt design via ghost-server + CLIProxyAPI).
 */

import { createLightboxZoom } from '../../utils/lightbox-zoom.js';
import { nicheTitleFromFileName, isPipelineTempFileStem, stripPipelineNameNoise } from '../../utils/library-naming.js';

const GENERATE_STORAGE_KEY = 'nhp_generate_gallery_local';
const GENERATE_HISTORY_MAX = 100;
const GENERATE_LIBRARY_INDEX_KEY = 'nhp_generate_library_index';
const GENERATE_CHAT_KEY = 'nhp_generate_chat_history';
const GENERATE_SESSIONS_KEY = 'nhp_generate_sessions';
const GENERATE_ACTIVE_TAB_KEY = 'nhp_generate_active_tab';
const GENERATE_CLOSED_TABS_KEY = 'nhp_generate_closed_tabs';
const GENERATE_LIBRARY_PAGE_SIZE = 24;
const GENERATE_LIB_DL_DELAY_MS = 220;
const GENERATE_LIBRARY_FETCH_RETRY_MS = 300;
const GENERATE_LIBRARY_FETCH_RETRY_MAX = 4;
const GENERATE_LIBRARY_RENAME_POLL_MS = 2500;
const GENERATE_LIBRARY_RENAME_POLL_MAX = 12;
let generateLibraryRenamePollTimer = null;
let generateLibraryRenameInFlight = false;
const GENERATE_LIBRARY_THUMB_RETRY_MS = 450;
const GENERATE_RAIN_MAX = 8;
const GHOST_PORT = 3019;
/** Primary Generate Ghost only — legacy 3012 probed only if 3019 is down (avoids console ERR_CONNECTION_REFUSED spam). */
const GHOST_PORT_CANDIDATES = [3019];
const GHOST_LEGACY_PORT_FALLBACKS = [3012];
const GHOST_RESTART_SCRIPT = 'Restart_Ghost_3019.cmd';
const GHOST_RESTART_POLL_MS = 2000;
const GHOST_RESTART_POLL_MAX_MS = 30000;
const GENERATE_LOCAL_CLIPROXY_API_KEY = 'nhp-local-cliproxy-key';
/** Legacy typo accepted as the same local gateway Bearer. */
const GENERATE_LOCAL_CLIPROXY_API_KEY_ALIASES = Object.freeze([
  GENERATE_LOCAL_CLIPROXY_API_KEY,
  'nhp-local-cli-proxy-key'
]);
const GENERATE_PROXY_ENDPOINTS_STORAGE_KEY = 'nhpProxyEndpoints';
let generateResolvedGhostPort = GHOST_PORT;
/** Tracks Ghost online state for reconnect-triggered library refresh. */
let generateGhostWasOnline = null;
let generateLibraryFilterPeriod = 'all';
let generateLibraryFilterQuery = '';
let generateLibraryFilterStudioOnly = false;
let generateHistoryFilterQuery = '';
let generateGalleryRaw = [];
let generateActiveSection = 'chat';
const GENERATE_ADMIN_AI_KEYS_STORAGE_KEY = 'nhpAdminAiKeys';
const GENERATE_GPT_API_KEY_STORAGE_KEY = 'nhpGptApiKey';
const GENERATE_PROXY_BASE_URL_STORAGE_KEY = 'nhpProxyBaseUrl';
const GENERATE_GEMINI_API_KEY_STORAGE_KEY = 'generateGeminiApiKey';
const GENERATE_GEMINI_BASE_URL_STORAGE_KEY = 'generateGeminiBaseUrl';
const GENERATE_DEFAULT_NHP_PROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
const GENERATE_RENDER_NHP_PROXY_BASE_URL = 'https://cliproxyapi-ywrp.onrender.com/v1';
const GENERATE_LOCAL_NHP_PROXY_BASE_URL = 'http://127.0.0.1:8317/v1';
/** أهداف ضغط الصور قبل POST /api/generate — مرتبطة بمُحدّد الجودة */
const GENERATE_IMAGE_MAX_BYTES_TARGET = 750 * 1024;
const GENERATE_IMAGE_MAX_BYTES_HARD = 1024 * 1024;
const GENERATE_QUALITY_COMPRESS_PRESETS = Object.freeze({
  fast: { maxPx: 640, jpegQuality: 0.75 },
  balanced: { maxPx: 768, jpegQuality: 0.82 },
  premium: { maxPx: 1024, jpegQuality: 0.88 }
});

function generateGetImageCompressLimits(quality = 'balanced') {
  const key = String(quality || 'balanced').toLowerCase();
  return GENERATE_QUALITY_COMPRESS_PRESETS[key] || GENERATE_QUALITY_COMPRESS_PRESETS.balanced;
}

function generateGetSelectedImageQuality() {
  return generateEls().quality?.value || 'balanced';
}

function generateNormalizeAiProvider(value) {
  const v = String(value || 'auto').trim().toLowerCase();
  if (v === 'gemini') return 'gemini';
  if (v === 'chatgpt' || v === 'gpt' || v === 'openai' || v === 'codex') return 'chatgpt';
  return 'auto';
}

function generateApplyAiProviderSetting(value) {
  const normalized = generateNormalizeAiProvider(value);
  const els = generateEls();
  if (els.mode) els.mode.value = normalized;
  generateUpdateAutoFallbackUiForMode(normalized);
  return normalized;
}

function generatePersistAiProviderSetting(value) {
  const normalized = generateNormalizeAiProvider(value);
  try {
    localStorage.setItem(GENERATE_AI_PROVIDER_KEY, normalized);
  } catch (_) { /* ignore */ }
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [GENERATE_AI_PROVIDER_KEY]: normalized });
    }
  } catch (_) { /* ignore */ }
  return normalized;
}

function generateLoadAiProviderSetting() {
  const apply = (raw) => {
    const normalized = generateApplyAiProviderSetting(raw || 'auto');
    generatePersistAiProviderSetting(normalized);
    return normalized;
  };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([GENERATE_AI_PROVIDER_KEY], (res) => {
        const stored = res?.[GENERATE_AI_PROVIDER_KEY];
        apply(stored != null ? stored : localStorage.getItem(GENERATE_AI_PROVIDER_KEY));
      });
      return apply(localStorage.getItem(GENERATE_AI_PROVIDER_KEY));
    }
  } catch (_) { /* ignore */ }
  return apply(localStorage.getItem(GENERATE_AI_PROVIDER_KEY));
}
const GENERATE_ATTACH_THUMB_PX = 36;
const GENERATE_MAX_PENDING_IMAGES = 8;
const GENERATE_INJECT_MSG_TYPE = 'nhp-generate-inject';
const GENERATE_PROMPTBAG_MSG_TYPE = 'nhp-promptbag-generate';
const GENERATE_PROMPTBAG_DEDUPE_MS = 500;
/** عرض الوصف التلقائي في الواجهة فقط — الطلب API يستخدم النص الكامل من الجلسة */
const GENERATE_AUTO_PROMPT_DISPLAY_MAX = 2800;
const GENERATE_AUTO_SEND_STUDIO_KEY = 'nhpGenerateAutoSendStudio';
/** تعليمات النظام الداخلية للتوليد (مثل ChatGPT GPT Instructions) */
const GENERATE_SYSTEM_PROMPT_KEY = 'nhp_generate_system_prompt';
const GENERATE_AUTO_IMAGE_TEMPLATE_KEY = 'nhp_generate_auto_image_template';
const GENERATE_CUSTOM_STYLES_KEY = 'nhp_generate_custom_styles';
const GENERATE_HIDDEN_STYLES_KEY = 'nhp_generate_hidden_styles';
const GENERATE_FAVORITE_STYLES_KEY = 'nhp_generate_favorite_styles';
const GENERATE_QUEUE_CONCURRENCY_KEY = 'nhp_generate_queue_concurrency';
const GENERATE_AI_PROVIDER_KEY = 'nhp_generate_ai_provider';
const GENERATE_AUTO_FALLBACK_GEMINI_KEY = 'nhp_generate_auto_fallback_gemini';
const GENERATE_AI_PROVIDER_OPTIONS = Object.freeze({
  auto: 'تلقائي',
  gemini: 'Gemini',
  chatgpt: 'ChatGPT'
});
/** حد POST /api/generate المتزامن — افتراضي آمن لـ Render */
const GENERATE_QUEUE_MAX_CONCURRENT_DEFAULT = 2;
const GENERATE_QUEUE_CONCURRENCY_DEFAULT = GENERATE_QUEUE_MAX_CONCURRENT_DEFAULT;
const GENERATE_QUEUE_TIMEOUT_FALLBACK_MS = 10 * 60 * 1000;
const GENERATE_QUEUE_TIMEOUT_FALLBACK_COUNT = 3;
/** Built-in style catalog (value → label); matches server STYLE_MODE_HINTS keys */
const GENERATE_BUILTIN_STYLES = Object.freeze([
  { value: 'vintage', label: 'Vintage', group: 'كلاسيكي' },
  { value: 'doodle', label: 'Doodle', group: 'كلاسيكي' },
  { value: 'retro', label: 'Retro', group: 'كلاسيكي' },
  { value: 'meme', label: 'Meme', group: 'كلاسيكي' },
  { value: 'minimal', label: 'Minimal', group: 'كلاسيكي' },
  { value: 'varsity', label: 'Varsity', group: 'كلاسيكي' },
  { value: 'cottagecore', label: 'Cottagecore', group: 'كلاسيكي' },
  { value: 'grunge', label: 'Grunge', group: 'كلاسيكي' },
  { value: 'kawaii', label: 'Kawaii', group: 'كلاسيكي' },
  { value: 'neon', label: 'Neon', group: 'كلاسيكي' },
  { value: 'gothic', label: 'Gothic', group: 'كلاسيكي' },
  { value: 'comic', label: 'Comic', group: 'كلاسيكي' },
  { value: 'pixel', label: 'Pixel', group: 'كلاسيكي' },
  { value: 'watercolor', label: 'Watercolor', group: 'كلاسيكي' },
  { value: 'embroidery', label: 'Embroidery', group: 'POD 2026' },
  { value: 'hand_drawn', label: 'Hand Drawn', group: 'POD 2026' },
  { value: 'naive_art', label: 'Naive Art', group: 'POD 2026' },
  { value: 'chaotic_meme', label: 'Chaotic Meme', group: 'POD 2026' },
  { value: 'bold_typography', label: 'Bold Typography', group: 'POD 2026' },
  { value: 'minimal_text', label: 'Minimal Text', group: 'POD 2026' },
  { value: 'cowboy_western', label: 'Cowboy Western', group: 'POD 2026' },
  { value: 'britpop', label: 'Britpop', group: 'POD 2026' },
  { value: 'food_art', label: 'Food Art', group: 'POD 2026' },
  { value: 'fishcore', label: 'Fishcore', group: 'POD 2026' },
  { value: 'tulip_floral', label: 'Tulip Floral', group: 'POD 2026' },
  { value: 'folk_art', label: 'Folk Art', group: 'POD 2026' },
  { value: 'patchwork', label: 'Patchwork', group: 'POD 2026' },
  { value: 'sticker_bomb', label: 'Sticker Bomb', group: 'POD 2026' },
  { value: 'mascot_cartoon', label: 'Mascot Cartoon', group: 'POD 2026' },
  { value: 'sport_varsity', label: 'Sport Varsity', group: 'POD 2026' },
  { value: 'faded_pastel', label: 'Faded Pastel', group: 'POD 2026' },
  { value: 'outdoor_nature', label: 'Outdoor Nature', group: 'POD 2026' },
  { value: 'ai_surreal', label: 'AI Surreal', group: 'POD 2026' },
  { value: 'retro_futurism', label: 'Retro Futurism', group: 'POD 2026' }
]);
/** Vision/server labels for built-in keys (subset of APPAREL_STYLE_LIST) */
const GENERATE_STYLE_VISION_LABELS = Object.freeze({
  vintage: 'Vintage Distressed',
  doodle: 'Hand Drawn',
  retro: '70s Retro Groovy',
  meme: 'Meme Graphic / Sarcastic',
  minimal: 'Line Art Minimalism',
  varsity: 'Bold Varsity / Collegiate',
  cottagecore: 'Cottagecore Aesthetic',
  grunge: '90s Grunge / Y2K',
  kawaii: 'Cute Kawaii Chibi',
  neon: '80s Neon Synthwave',
  gothic: 'Gothic / Witchy',
  comic: 'Comic / Pop Art',
  pixel: 'Pixel Art',
  watercolor: 'Watercolor Splatter',
  embroidery: 'Embroidery',
  hand_drawn: 'Hand Drawn',
  naive_art: 'Naive Art',
  chaotic_meme: 'Chaotic Meme',
  bold_typography: 'Bold Typography',
  minimal_text: 'Minimal Text',
  cowboy_western: 'Cowboy Western',
  britpop: 'Britpop',
  food_art: 'Food Art',
  fishcore: 'Fishcore',
  tulip_floral: 'Tulip Floral',
  folk_art: 'Folk Art',
  patchwork: 'Patchwork',
  sticker_bomb: 'Sticker Bomb',
  mascot_cartoon: 'Mascot Cartoon',
  sport_varsity: 'Sport Varsity',
  faded_pastel: 'Faded Pastel',
  outdoor_nature: 'Outdoor Nature',
  ai_surreal: 'AI Surreal',
  retro_futurism: 'Retro Futurism'
});
let generateSystemPromptSaveTimer = null;
/** @type {{ custom: string[], hidden: string[], favorites: string[] }} */
let generateStylePrefs = { custom: [], hidden: [], favorites: [] };
let generateStylePrefsLoaded = false;
let generateStyleSaveTimer = null;
/** Routed via background → Studio UI or studio_peel_banana_buffer */
const GENERATE_STUDIO_PEEL_DISPATCH_ACTION = 'generate_library_to_studio_peel';
const GENERATE_STUDIO_PEEL_BUFFER_KEY = 'studio_peel_banana_buffer';
const GENERATE_FULL_PIPELINE_STEP_LABELS = [
  'Peel Banana — إزالة العلامة',
  'TeeMaster Pro 5K — استقبال الصور',
  'السحر الشامل — تنظيف الخلفية',
  'معالجة + RENAME AI + SEO',
  'Autopilot — رفع الحسابات'
];
const GENERATE_PIPELINE_ITEM_DELAY_MS = 150;

let generateHelpers = { showToast: () => {}, showWarnToast: null };
let generateBound = false;
/** @type {{ id: string, file: File, previewUrl: string, name: string }[]} */
let generatePendingImages = [];
let generateAutoPromptVisible = false;
let generateLibraryItems = [];
let generateLibrarySelected = new Set();
let generateLibraryRendered = 0;
let generateLibraryBatchBusy = false;
let generateFullPipelineBusy = false;
let generateFullPipelineCancelled = false;
let generatePipelineHideTimer = null;
let generateRainActive = 0;
let generateLightboxBound = false;
let generateLightboxZoomCtrl = null;

function ensureGenerateLightboxZoom() {
  if (generateLightboxZoomCtrl) return generateLightboxZoomCtrl;
  const { lightboxImg } = generateEls();
  generateLightboxZoomCtrl = createLightboxZoom({
    viewport: document.getElementById('generate-lightbox-viewport'),
    img: lightboxImg,
    zoomInBtn: document.getElementById('generate-lightbox-zoom-in'),
    zoomOutBtn: document.getElementById('generate-lightbox-zoom-out'),
    zoomResetBtn: document.getElementById('generate-lightbox-zoom-reset'),
    zoomLevelEl: document.getElementById('generate-lightbox-zoom-level')
  });
  generateLightboxZoomCtrl.bind();
  return generateLightboxZoomCtrl;
}
/** @type {{ items: object[], index: number, context: string }} */
let generateLightboxState = { items: [], index: 0, context: 'single' };

/** Multi-tab session state */
/** @type {GenerateSession[]} */
let generateSessions = [];
let generateActiveTabId = null;
let generateTabCounter = 0;
/** @type {Map<string, HTMLElement>} */
const generateVirtualChats = new Map();
/** Tab executing generation (async context) */
let generateContextTabId = null;
/** @type {Map<string, HTMLElement>} */
const generateLoadingEls = new Map();
/** Per-tab abort state for cancel/stop generation */
/** @type {Map<string, { controller: AbortController, jobId: string|null, pollTimer: ReturnType<typeof setTimeout>|null }>} */
const generateTabAbortState = new Map();
/** Async job → tab that started POST /api/generate (poll must not use active tab) */
/** @type {Map<string, string>} */
const generateJobTabById = new Map();
let generateSaveSessionsTimer = null;

/** طابور توليد عالمي — حتى N طلبات POST /api/generate نشطة (إعداد المستخدم 2|3) */
/** @type {{ id: string, tabId: string, params: object, aborted: boolean }[]} */
let generateJobQueue = [];
/** @type {Set<string>} */
const generateQueueActiveJobIds = new Set();
/** تخفيض مؤقت إلى 1 بعد تكرار مهلات (جلسة الصفحة فقط) */
let generateQueueConcurrencyOverride = null;
/** @type {number[]} */
let generateQueueTimeoutTimestamps = [];

function generateRegisterJobTab(jobId, tabId) {
  if (jobId && tabId) generateJobTabById.set(String(jobId), tabId);
}

function generateUnregisterJobTab(jobId) {
  if (jobId) generateJobTabById.delete(String(jobId));
}

function generateResolveJobTabId(jobId, fallbackTabId) {
  const mapped = jobId ? generateJobTabById.get(String(jobId)) : null;
  return mapped || fallbackTabId || generateActiveTabId;
}

function generateSessionAutoPromptVisible(tabId = generateActiveTabId) {
  const session = generateGetSession(tabId);
  if (tabId === generateActiveTabId) {
    return !!generateAutoPromptVisible || !!session?.composer?.autoPromptVisible;
  }
  return !!session?.composer?.autoPromptVisible;
}

/**
 * @typedef {Object} GenerateSession
 * @property {string} id
 * @property {string} label
 * @property {string} chatHtml
 * @property {boolean} generationBusy
 * @property {boolean} generationQueued
 * @property {string|null} queueJobId
 * @property {{ msg: string, isError: boolean }} status
 * @property {Object} composer
 * @property {string} composer.prompt
 * @property {string} composer.autoPrompt
 * @property {boolean} composer.autoPromptVisible
 * @property {{ id: string, previewUrl: string, name: string }[]} composer.pendingImages
 * @property {Object} composer.settings
 * @property {string|null} composer.settings.mode
 * @property {string} composer.settings.count
 * @property {string} composer.settings.quality
 * @property {string} composer.settings.style
 */

function generateGhostUrl(path) {
  const port = generateResolvedGhostPort || GHOST_PORT;
  if (window.NhpRuntimeConfig?.localUrl) {
    return window.NhpRuntimeConfig.localUrl(port, path);
  }
  return `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`;
}

async function generateReadStoredGhostPort() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get(['nhpGhostPort', 'nhpGhostTeepublicPort'], (r) => resolve(r || {}));
    });
    const raw = Number(stored?.nhpGhostPort || stored?.nhpGhostTeepublicPort);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    if (typeof NhpStorageMigrate !== 'undefined' && NhpStorageMigrate.migrateGhostPort) {
      const migrated = NhpStorageMigrate.migrateGhostPort(raw);
      if (migrated === GHOST_PORT) return GHOST_PORT;
      if ([3010, 1010, 1019].includes(raw)) return null;
    } else if ([3010, 1010, 1019].includes(raw)) {
      return null;
    }
    return raw === GHOST_PORT ? GHOST_PORT : null;
  } catch (_) {
    return null;
  }
}

async function generateProbeGhostPortOnce(port) {
  try {
    const pingUrl = window.NhpRuntimeConfig?.localUrl
      ? window.NhpRuntimeConfig.localUrl(port, '/ping')
      : `http://127.0.0.1:${port}/ping`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(pingUrl, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { port, ok: false, generateApi: false };
    const data = await res.json().catch(() => ({}));
    return { port, ok: true, generateApi: data?.generateApi === true };
  } catch (_) {
    return { port, ok: false, generateApi: false };
  }
}

function generateGhostConnectHelper() {
  return typeof globalThis !== 'undefined' ? globalThis.NhpGhostConnect : null;
}

async function generateDetectGhostPortOnce() {
  const stored = await generateReadStoredGhostPort();
  /** Prefer 3019 only; legacy 3012 / stale stored port only if primary is down. */
  const primaryPorts = [...new Set([GHOST_PORT, ...GHOST_PORT_CANDIDATES].filter((p) => Number(p) > 0))];
  let fallbackPort = null;
  for (const port of primaryPorts) {
    const probed = await generateProbeGhostPortOnce(port);
    if (probed.generateApi) {
      generateResolvedGhostPort = port;
      return port;
    }
    if (probed.ok && !fallbackPort) fallbackPort = port;
  }
  const legacyPorts = [...new Set([
    ...(Number(stored) > 0 && !primaryPorts.includes(Number(stored)) ? [Number(stored)] : []),
    ...GHOST_LEGACY_PORT_FALLBACKS
  ].filter((p) => Number(p) > 0 && !primaryPorts.includes(Number(p))))];
  for (const port of legacyPorts) {
    const probed = await generateProbeGhostPortOnce(port);
    if (probed.generateApi) {
      generateResolvedGhostPort = port;
      return port;
    }
    if (probed.ok && !fallbackPort) fallbackPort = port;
  }
  if (fallbackPort) {
    generateResolvedGhostPort = fallbackPort;
    return fallbackPort;
  }
  return null;
}

async function generateDetectGhostPort(options = {}) {
  const gc = generateGhostConnectHelper();
  const onConnecting = typeof options.onConnecting === 'function' ? options.onConnecting : null;
  const detectOnce = () => generateDetectGhostPortOnce();
  if (!gc?.withRetry) return detectOnce();

  return gc.withRetry(detectOnce, {
    attempts: options.attempts ?? gc.RETRY?.ATTEMPTS ?? 3,
    delayMs: options.delayMs ?? gc.RETRY?.DELAY_MS ?? 2000,
    onRetry: (attempt, maxAttempts) => {
      onConnecting?.(attempt + 1, maxAttempts);
    }
  });
}

async function generateEnsureRuntimeConfig() {
  try {
    await window.NhpRuntimeConfig?.loadFromStorage?.();
  } catch (_) { /* ignore */ }
}

function generateIsNetworkFetchError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const cause = String(err?.cause?.message || err?.cause?.code || '').toLowerCase();
  const combined = `${msg} ${cause}`;
  return /fetch failed|failed to fetch|networkerror|network error|econnrefused|econnreset|enotfound|socket hang up|err_connection_refused|err_connection_reset|undici|connect/i.test(combined);
}

function generateHumanizeCliProxyError(message) {
  const msg = String(message || '').trim();
  if (!msg) return msg;
  if (/^(تعذّر|لا توجد|النموذج غير مدعوم|انتهت مهلة|تعذّر الاتصال|CLIProxy returned no images)/.test(msg)) {
    return msg;
  }
  const lower = msg.toLowerCase();
  const modelMatch = msg.match(/model=([^\s,)]+)/i);
  const modelName = modelMatch ? modelMatch[1] : '';
  const providersMatch = msg.match(/providers=([^\s)]+)/i);
  const providers = providersMatch ? providersMatch[1] : '';

  if (/invalid api key|api key not valid|api_key_invalid/i.test(lower)) {
    return [
      'مفتاح API غير صالح لهذا المسار.',
      'مفتاح Google (AIza…) لا يُستخدم كـ Bearer لـ CLIProxy — استخدم مفتاح NHP/SEO، أو اضبط Gemini في config.yaml.',
      'عند فشل المحلي (401/503) يُحوَّل التوليد تلقائياً إلى السحابة إن كان مفتاح SEO صالحاً.'
    ].join('\n');
  }

  // Legacy / mislabeled client errors — soft hint only (Generate must still try local backup).
  if (
    /cloud\s*api\s*key\s+is\s+not\s+defined|cloudapi\s*key\s+is\s+not\s+defined|cloud_api_key_missing/i.test(lower)
    || /مفتاح\s*nhp\/seo\s*السحابي\s*غير\s*(مُعدّ|معد|مقروء|متوفر)/i.test(msg)
  ) {
    return 'مفتاح NHP/SEO السحابي غير متوفر — سيُجرّب CLIProxy المحلي (nhp-local-cliproxy-key) تلقائياً إن كان يعمل.';
  }

  if (/api key is missing|api key is not defined|key is not defined/i.test(lower)) {
    return 'مفتاح NHP API غير مُعدّ — أضفه من SEO → إعدادات API أو لوحة التحكم → مفاتيح AI (أو nhp-local-cliproxy-key للمسار المحلي).';
  }

  if (/auth_unavailable|no auth available/i.test(lower)) {
    if (/gpt-image-2/i.test(`${lower} ${modelName}`) || providers === 'codex') {
      return [
        'تعذّر توليد الصور: نموذج gpt-image-2 يعمل عبر حساب Codex في CLIProxyAPI وليس عبر مفتاح NHP API (nhpGptApiKey) وحده.',
        'الحل 1 — Codex: شغّل CLIProxyAPI → لوحة الإدارة http://127.0.0.1:8317 → أضف مصادقة Codex (OAuth).',
        'الحل 2 — استخدم السحابة (Render) إن كانت مُعدّة — NHP يُحوّل تلقائياً عند فشل المحلي.',
        'الحل 3 — Grok: مصادقة xAI → grok-imagine-image (بدون Codex).',
        'الحل 4 — Gemini: gemini-3.1-flash-image في config.yaml (بديل اختياري).'
      ].join('\n');
    }
    return [
      'لا توجد مصادقة متاحة في CLIProxyAPI لهذا النموذج.',
      modelName ? `النموذج: ${modelName}` : '',
      providers ? `المزوّد: ${providers}` : '',
      'تحقق من CLIProxy: Codex (gpt-image-2) أو xAI (grok-imagine-image).'
    ].filter(Boolean).join('\n');
  }

  if (/stream disconnected|stream error|disconnected before completion/i.test(lower)) {
    return [
      'انقطع تدفق الاستجابة (stream) قبل اكتمال توليد الصورة.',
      'NHP 30.1.18+ يفرض non-stream مع إعادة محاولة تلقائية — إن تكرّر الخطأ:',
      'الحل 1 — Codex OAuth: http://127.0.0.1:8317 → أضف مصادقة Codex لـ gpt-image-2.',
      'الحل 2 — راجع سجلات CLIProxyAPI (نافذة الخادم) للخطأ التفصيلي.',
      'الحل 3 — تحقق من الشبكة أو جرّب CLIProxy محلياً بدلاً من Render.',
      'عيّن CLIPROXY_IMAGE_MODEL=gpt-image-2 في .env بجذر المشروع وأعد تشغيل ghost-server.js.'
    ].join('\n');
  }

  if (/is not supported on.*images\/(generations|edits)/i.test(lower)) {
    const isDalle = /dall-e/i.test(`${lower} ${modelName}`);
    const isGemini = /gemini|imagen/i.test(`${lower} ${modelName}`);
    const lines = [
      'النموذج غير مدعوم لمسار توليد الصور في CLIProxyAPI.',
      isDalle
        ? 'dall-e-3 قد يظهر في /models لكنه غير مدعوم على /v1/images/generations — استخدم gpt-image-2 مع Codex OAuth.'
        : 'استخدم gpt-image-2 (Codex OAuth) أو grok-imagine-image (xAI OAuth).'
    ];
    if (isGemini) {
      lines.push(
        'لتفعيل Gemini: أضف مصادقة Google في CLIProxy + نموذج gemini*image* في config.yaml.',
        'جرّب: gemini-3.1-flash-image أو gemini-2.0-flash-preview-image-generation أو imagen-3.'
      );
    }
    lines.push('عيّن CLIPROXY_IMAGE_MODEL=gpt-image-2 في .env بجذر المشروع وأعد تشغيل ghost-server.js.');
    return lines.join('\n');
  }

  return msg;
}

function generateFormatFetchError(err, { port = generateResolvedGhostPort || GHOST_PORT, proxyBaseUrl = '' } = {}) {
  const raw = generateHumanizeCliProxyError(String(err?.message || err || '').trim());
  if (generateIsTimeoutError(raw)) return raw;
  if (!generateIsNetworkFetchError(err)) return raw || 'فشل التوليد';

  if (/reset|aborted|body|payload|too large|entity too large/i.test(raw)) {
    return 'انقطع الاتصال أثناء رفع الصورة أو الوصف — جرّب صورة أصغر أو وصفاً أقصر، ثم أعد المحاولة.';
  }

  const proxyHint = proxyBaseUrl
    ? ` · CLIProxy: ${generateNormalizeProxyBaseUrl(proxyBaseUrl)}`
    : ' · CLIProxy: المنفذ 8317 أو Render';
  return `تعذّر الاتصال بـ Ghost Server (منفذ ${port}) — شغّل Start_Ghost_Server_On_Port.cmd أو ghost-server.js وتحقق من الجدار الناري${proxyHint}`;
}

function generateIsLocalProxyBaseUrl(baseUrl) {
  const base = generateNormalizeProxyBaseUrl(baseUrl);
  return /8317|127\.0\.0\.1|localhost/i.test(base);
}

function generateIsLocalCliProxyGatewayKey(apiKey) {
  const key = String(apiKey || '').trim();
  return GENERATE_LOCAL_CLIPROXY_API_KEY_ALIASES.includes(key);
}

/** Prefer local 8317 + gateway key when cloud SEO key is missing/unreadable. */
async function generateTryLocalCliProxyBackup(keys = {}) {
  const localOk = await generateProbeCliProxyDirect(
    GENERATE_LOCAL_NHP_PROXY_BASE_URL,
    GENERATE_LOCAL_CLIPROXY_API_KEY
  );
  if (!localOk) return null;
  const next = keys && typeof keys === 'object' ? keys : {};
  next.baseUrl = GENERATE_LOCAL_NHP_PROXY_BASE_URL;
  next.apiKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
  return next;
}

/** Remote Render proxy: warn-only preflight — still allow POST /api/generate */
function generatePreflightRemoteWarn(payload) {
  return {
    ok: true,
    warn: true,
    message: payload.message || '',
    code: payload.code,
    port: payload.port,
    keys: payload.keys,
    recommendedImageModel: payload.recommendedImageModel
  };
}

/**
 * Same check as SEO → إعدادات API (testSeoApiKeyConnection): GET /v1/models with Bearer key.
 * @returns {Promise<{ ok: boolean, serverOk: boolean, message: string, baseUrl: string }>}
 */
async function generateVerifySeoApiKey(keys) {
  const baseUrl = generateNormalizeProxyBaseUrl(keys?.baseUrl);
  let apiKey = String(keys?.apiKey || '').trim();
  if (generateIsLocalProxyBaseUrl(baseUrl) && generateIsLocalCliProxyGatewayKey(apiKey)) {
    apiKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
  }
  if (!apiKey) {
    return { ok: false, serverOk: false, message: 'مفتاح NHP API غير مُعدّ', baseUrl };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const anonRes = await fetch(`${baseUrl}/models`, { method: 'GET', signal: ctrl.signal });
    const serverOk = anonRes.ok || anonRes.status === 401;
    const authRes = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal
    });
    if (authRes.ok) {
      return { ok: true, serverOk: true, message: 'مفتاح SEO ✓', baseUrl };
    }
    // Local rejected SEO/cloud key → verify against Render before failing Admin UX.
    if (
      (authRes.status === 401 || authRes.status === 403)
      && generateIsLocalProxyBaseUrl(baseUrl)
      && !generateIsLocalCliProxyGatewayKey(apiKey)
    ) {
      const cloudBase = GENERATE_RENDER_NHP_PROXY_BASE_URL;
      const cloudRes = await fetch(`${cloudBase}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: ctrl.signal
      });
      if (cloudRes.ok) {
        return {
          ok: true,
          serverOk: true,
          message: 'مفتاح SEO ✓ (سحابة Render — المحلي رفض المفتاح)',
          baseUrl: cloudBase,
          failoverFrom: baseUrl
        };
      }
    }
    // Cloud failed → try local backup with gateway key.
    if (
      !authRes.ok
      && !generateIsLocalProxyBaseUrl(baseUrl)
      && (authRes.status === 401 || authRes.status === 403 || authRes.status >= 500)
    ) {
      const localBase = GENERATE_LOCAL_NHP_PROXY_BASE_URL;
      const localRes = await fetch(`${localBase}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${GENERATE_LOCAL_CLIPROXY_API_KEY}` },
        signal: ctrl.signal
      });
      if (localRes.ok) {
        return {
          ok: true,
          serverOk: true,
          message: 'CLIProxy المحلي (احتياط) — السحابة فشلت',
          baseUrl: localBase,
          failoverFrom: baseUrl
        };
      }
    }
    if (authRes.status === 401 || authRes.status === 403) {
      return { ok: false, serverOk, message: `مفتاح SEO مرفوض (${authRes.status})`, baseUrl };
    }
    const errText = await authRes.text().catch(() => '');
    return {
      ok: false,
      serverOk,
      message: `فشل التحقق من مفتاح SEO: HTTP ${authRes.status}${errText ? ` — ${errText.slice(0, 80)}` : ''}`,
      baseUrl
    };
  } catch (err) {
    const errMsg = String(err?.message || err || '');
    return {
      ok: false,
      serverOk: false,
      message: /abort|timeout/i.test(errMsg)
        ? `CLIProxy غير متاح على ${baseUrl}`
        : `تعذّر الاتصال بـ CLIProxy: ${errMsg}`,
      baseUrl
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateProbeCliProxyDirect(baseUrl, apiKey) {
  const url = `${generateNormalizeProxyBaseUrl(baseUrl)}/models`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
    // 401 means wrong key — not "reachable enough" to skip cloud failover.
    return !!res.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pre-flight before POST /api/generate — Ghost route, API key, CLIProxy reachability.
 * @returns {Promise<{ ok: boolean, code?: string, message: string, port?: number|null, keys?: { apiKey: string, baseUrl: string } }>}
 */
async function generatePreflightBeforeGenerate(provider = null, options = {}) {
  await generateEnsureRuntimeConfig();
  const port = await generateDetectGhostPort({
    onConnecting: (attempt, maxAttempts) => {
      if (options.statusTabId != null) {
        generateSetStatus(`جاري الاتصال بـ Ghost (${attempt}/${maxAttempts})...`, false, options.statusTabId);
      }
    }
  });
  if (!port) {
    const ports = GHOST_PORT_CANDIDATES.join('، ');
    return {
      ok: false,
      code: 'ghost_down',
      message: `Ghost Server غير متصل — شغّل Start_Ghost_Server_On_Port.cmd أو ghost-server.js على المنفذ ${GHOST_PORT} (أو ${ports})`,
      port: null
    };
  }

  const hasGenerateRoute = await generateProbeGenerateApi();
  if (!hasGenerateRoute) {
    return {
      ok: false,
      code: 'generate_route',
      message: `Ghost يعمل على ${port} لكن مسار التوليد غير متاح — أعد تشغيل ghost-server.js لتفعيل /api/generate`,
      port
    };
  }

  const aiProvider = generateNormalizeAiProvider(provider ?? generateEls().mode?.value ?? 'auto');
  const keys = await generateGetCliProxyAiKeys(aiProvider);
  const isRemoteProxy = !generateIsLocalProxyBaseUrl(keys.baseUrl);
  // Cloud key missing must NOT hard-block — try local gateway backup first.
  if (!keys.apiKey && !keys.cloudApiKey) {
    const localKeys = await generateTryLocalCliProxyBackup(keys);
    if (localKeys) {
      return {
        ok: true,
        warn: true,
        code: 'cliproxy_cloud_failover_local',
        message: 'CLIProxy السحابي بلا مفتاح — التحويل إلى المحلي (احتياط)',
        port,
        keys: localKeys
      };
    }
    const noKeyMsg = aiProvider === 'gemini'
      ? 'مفتاح Gemini API غير مُعدّ — أضفه في إعدادات التوليد ⚙️ (مفتاح Gemini API) أو من SEO → إعدادات API (nhpGptApiKey)'
      : 'مفتاح NHP API غير مُعدّ — أضفه من SEO → إعدادات API (nhpGptApiKey) أو لوحة التحكم → مفاتيح AI';
    return {
      ok: false,
      code: 'no_api_key',
      message: noKeyMsg,
      port,
      keys
    };
  }
  if (!keys.apiKey && keys.cloudApiKey) {
    keys.apiKey = keys.cloudApiKey;
    keys.baseUrl = GENERATE_RENDER_NHP_PROXY_BASE_URL;
  }

  let cliproxyOk = false;
  let healthFailed = false;
  const headers = generateBuildApiCredentialHeaders(keys, aiProvider);
  const canCheckGhostHealth = !!(headers['X-NHP-Api-Key'] || headers['X-NHP-Cloud-Api-Key']);
  try {
    if (!canCheckGhostHealth) throw new Error('skip health without API key');
    const healthUrl = generateGhostUrl('/api/generate/health');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(healthUrl, { method: 'GET', headers, signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      cliproxyOk = data?.cliproxyOk === true || data?.success === true;
      if (data?.baseUrl) {
        keys.baseUrl = generateNormalizeProxyBaseUrl(data.baseUrl);
      }
      if (cliproxyOk && data?.isRenderProxy && data?.failoverFrom) {
        return generatePreflightRemoteWarn({
          code: 'cliproxy_local_failover',
          message: `CLIProxy المحلي فشل — التحويل إلى السحابة (${keys.baseUrl})`,
          port,
          keys,
          recommendedImageModel: data?.recommendedImageModel
        });
      }
      if (cliproxyOk && data?.hasImageModels === false) {
        const noModelsPayload = {
          code: 'no_image_models',
          message: data?.imageModelHintAr
            || 'لا يوجد نموذج صور في CLIProxy — أضف Codex OAuth (gpt-image-2) أو xAI (grok-imagine-image) في config.yaml',
          port,
          keys,
          recommendedImageModel: data?.recommendedImageModel || 'gpt-image-2'
        };
        if (isRemoteProxy || data?.isRenderProxy) {
          return generatePreflightRemoteWarn({
            ...noModelsPayload,
            message: `${noModelsPayload.message} — سيُتابع التوليد (Render)`
          });
        }
        return { ok: false, ...noModelsPayload };
      }
      if (!cliproxyOk) healthFailed = true;
    } else {
      healthFailed = true;
    }
  } catch (_) {
    healthFailed = true;
  }

  if (!cliproxyOk) {
    cliproxyOk = await generateProbeCliProxyDirect(keys.baseUrl, keys.apiKey);
  }

  if (!cliproxyOk) {
    const base = generateNormalizeProxyBaseUrl(keys.baseUrl);
    const isLocal = generateIsLocalProxyBaseUrl(base);
    // Cloud primary down/401 → try local backup before blocking generate.
    if (!isLocal) {
      const localOk = await generateProbeCliProxyDirect(
        GENERATE_LOCAL_NHP_PROXY_BASE_URL,
        GENERATE_LOCAL_CLIPROXY_API_KEY
      );
      if (localOk) {
        keys.baseUrl = GENERATE_LOCAL_NHP_PROXY_BASE_URL;
        keys.apiKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
        return {
          ok: true,
          warn: true,
          code: 'cliproxy_cloud_failover_local',
          message: 'CLIProxy السحابي فشل — التحويل إلى المحلي (احتياط)',
          port,
          keys
        };
      }
    }
    // Local 401/503/down → try Render cloud before blocking generate.
    if (isLocal) {
      const cloudBase = GENERATE_RENDER_NHP_PROXY_BASE_URL;
      const cloudKey = keys.cloudApiKey || (
        keys.apiKey && keys.apiKey !== GENERATE_LOCAL_CLIPROXY_API_KEY ? keys.apiKey : ''
      );
      const cloudOk = cloudKey && await generateProbeCliProxyDirect(cloudBase, cloudKey);
      if (cloudOk) {
        keys.baseUrl = cloudBase;
        keys.apiKey = cloudKey;
        return generatePreflightRemoteWarn({
          code: 'cliproxy_local_failover',
          message: 'CLIProxy المحلي فشل (401/غير متاح) — التحويل إلى السحابة (Render)',
          port,
          keys
        });
      }
      const localDefaultOk = await generateProbeCliProxyDirect(base, GENERATE_LOCAL_CLIPROXY_API_KEY);
      if (localDefaultOk) {
        keys.apiKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
        return {
          ok: true,
          warn: true,
          message: 'استخدام مفتاح CLIProxy المحلي (nhp-local-cliproxy-key)',
          code: 'cliproxy_local_key',
          port,
          keys
        };
      }
    }
    const cliproxyPayload = {
      code: 'cliproxy_down',
      message: isLocal
        ? 'CLIProxyAPI غير متاح — شغّل الخدمة على المنفذ 8317 (أو حدّث nhpProxyBaseUrl إلى Render)'
        : `CLIProxyAPI غير متاح على ${base} — تحقق من الاتصال بالإنترنت أو المفتاح`,
      port,
      keys
    };
    if (isRemoteProxy || !isLocal) {
      const hint = healthFailed
        ? 'فحص الصحة على Ghost فشل'
        : 'تعذّر الوصول إلى CLIProxy';
      return generatePreflightRemoteWarn({
        ...cliproxyPayload,
        message: `${hint} — ${cliproxyPayload.message} — سيُتابع التوليد`
      });
    }
    return { ok: false, ...cliproxyPayload };
  }

  return { ok: true, message: '', port, keys };
}

function generateIsTimeoutError(message) {
  const m = String(message || '');
  return /انتهت مهلة|timeout|120\s*ث|120000|aborted|تجربة Gemini|تجربة ChatGPT/i.test(m);
}

function generateIsStreamDisconnectError(message) {
  const m = String(message || '').toLowerCase();
  return /stream disconnected|stream error|disconnected before completion|انقطع تدفق الاستجابة/i.test(m);
}

function generateNormalizeProxyBaseUrl(value) {
  const fallback = GENERATE_DEFAULT_NHP_PROXY_BASE_URL;
  let rawInput = String(value || '').trim();
  if (typeof NhpStorageMigrate !== 'undefined' && NhpStorageMigrate.migratePortInUrl) {
    rawInput = NhpStorageMigrate.migratePortInUrl(rawInput);
  } else {
    rawInput = rawInput.replace(/:8517(\/|$)/g, ':8317$1');
  }
  const raw = rawInput || fallback;
  return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1') || fallback;
}

/** Prefer configured URL; default empty → cloud Render primary (local is backup). */
function generateResolveCliProxyBaseUrl(storedBaseUrl) {
  const raw = String(storedBaseUrl || '').trim();
  if (raw) {
    return generateNormalizeProxyBaseUrl(raw);
  }
  try {
    const cached = window.NhpRuntimeConfig?.getCached?.().proxyBaseUrl;
    if (cached) return generateNormalizeProxyBaseUrl(cached);
  } catch (_) { /* ignore */ }
  return generateNormalizeProxyBaseUrl(GENERATE_RENDER_NHP_PROXY_BASE_URL);
}

function generateReadLocalStorageKey(key) {
  try {
    return String(localStorage.getItem(key) || '').trim();
  } catch (_) {
    return '';
  }
}

function generateNormalizeGeminiBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/generativelanguage\.googleapis\.com/i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return generateNormalizeProxyBaseUrl(raw);
}

function generateReadGeminiSettingsFromForm() {
  const els = generateEls();
  return {
    apiKey: String(els.geminiApiKey?.value || '').trim(),
    baseUrl: generateNormalizeGeminiBaseUrl(els.geminiBaseUrl?.value || '')
  };
}

function generateApplyGeminiSettings({ apiKey = '', baseUrl = '' } = {}) {
  const els = generateEls();
  if (els.geminiApiKey) els.geminiApiKey.value = String(apiKey || '');
  if (els.geminiBaseUrl) {
    els.geminiBaseUrl.value = String(baseUrl || '');
  }
}

function generatePersistGeminiSettings({ apiKey, baseUrl } = {}) {
  const next = {
    apiKey: apiKey != null ? String(apiKey).trim() : generateReadGeminiSettingsFromForm().apiKey,
    baseUrl: baseUrl != null
      ? generateNormalizeGeminiBaseUrl(baseUrl)
      : generateReadGeminiSettingsFromForm().baseUrl
  };
  try {
    localStorage.setItem(GENERATE_GEMINI_API_KEY_STORAGE_KEY, next.apiKey);
    localStorage.setItem(GENERATE_GEMINI_BASE_URL_STORAGE_KEY, next.baseUrl);
  } catch (_) { /* ignore */ }
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        [GENERATE_GEMINI_API_KEY_STORAGE_KEY]: next.apiKey,
        [GENERATE_GEMINI_BASE_URL_STORAGE_KEY]: next.baseUrl
      });
    }
  } catch (_) { /* ignore */ }
  return next;
}

function generateLoadGeminiSettings() {
  const apply = (apiKey, baseUrl) => {
    const normalized = {
      apiKey: String(apiKey || '').trim(),
      baseUrl: generateNormalizeGeminiBaseUrl(baseUrl || '')
    };
    generateApplyGeminiSettings(normalized);
    generatePersistGeminiSettings(normalized);
    return normalized;
  };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([
        GENERATE_GEMINI_API_KEY_STORAGE_KEY,
        GENERATE_GEMINI_BASE_URL_STORAGE_KEY
      ], (res) => {
        const storedKey = res?.[GENERATE_GEMINI_API_KEY_STORAGE_KEY];
        const storedBase = res?.[GENERATE_GEMINI_BASE_URL_STORAGE_KEY];
        apply(
          storedKey != null ? storedKey : localStorage.getItem(GENERATE_GEMINI_API_KEY_STORAGE_KEY),
          storedBase != null ? storedBase : localStorage.getItem(GENERATE_GEMINI_BASE_URL_STORAGE_KEY)
        );
      });
      return apply(
        localStorage.getItem(GENERATE_GEMINI_API_KEY_STORAGE_KEY),
        localStorage.getItem(GENERATE_GEMINI_BASE_URL_STORAGE_KEY)
      );
    }
  } catch (_) { /* ignore */ }
  return apply(
    localStorage.getItem(GENERATE_GEMINI_API_KEY_STORAGE_KEY),
    localStorage.getItem(GENERATE_GEMINI_BASE_URL_STORAGE_KEY)
  );
}

/** @type {ReturnType<typeof setTimeout>|null} */
let generateGeminiSettingsSaveTimer = null;

function generateScheduleSaveGeminiSettings() {
  if (generateGeminiSettingsSaveTimer) clearTimeout(generateGeminiSettingsSaveTimer);
  generateGeminiSettingsSaveTimer = setTimeout(() => {
    generateGeminiSettingsSaveTimer = null;
    generatePersistGeminiSettings(generateReadGeminiSettingsFromForm());
  }, 350);
}

async function generateGetGenericCliProxyAiKeys() {
  await generateEnsureRuntimeConfig();
  const lsApiKey = generateReadLocalStorageKey(GENERATE_GPT_API_KEY_STORAGE_KEY);
  const lsBaseUrl = generateReadLocalStorageKey(GENERATE_PROXY_BASE_URL_STORAGE_KEY);

  return await new Promise((resolve) => {
    const finish = (apiKey, baseUrl, cloudApiKey = '') => {
      const resolvedBase = generateResolveCliProxyBaseUrl(baseUrl);
      const seoOrCloudKey = String(cloudApiKey || apiKey || '').trim();
      const looksLikeGoogleGeminiKey = /^AIza[0-9A-Za-z_\-]{10,}$/.test(seoOrCloudKey);
      const distinctCloudKey = (
        seoOrCloudKey
        && !generateIsLocalCliProxyGatewayKey(seoOrCloudKey)
        && !looksLikeGoogleGeminiKey
      ) ? seoOrCloudKey : '';

      let resolvedKey = String(apiKey || '').trim();
      if (generateIsLocalCliProxyGatewayKey(resolvedKey)) {
        resolvedKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
      }
      // Local CLIProxy gateway key — never send Google AIza… Studio keys as Bearer.
      if (generateIsLocalProxyBaseUrl(resolvedBase)) {
        resolvedKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
      } else if (!resolvedKey || /^AIza[0-9A-Za-z_\-]{10,}$/.test(resolvedKey)) {
        resolvedKey = distinctCloudKey || resolvedKey;
      }
      // Cloud primary with no SEO key — keep empty apiKey so preflight can auto-switch to local.
      resolve({
        apiKey: resolvedKey,
        cloudApiKey: distinctCloudKey,
        baseUrl: resolvedBase
      });
    };
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        finish(lsApiKey, lsBaseUrl, lsApiKey);
        return;
      }
      chrome.storage.local.get([
        GENERATE_ADMIN_AI_KEYS_STORAGE_KEY,
        GENERATE_GPT_API_KEY_STORAGE_KEY,
        GENERATE_PROXY_BASE_URL_STORAGE_KEY,
        GENERATE_PROXY_ENDPOINTS_STORAGE_KEY
      ], (res) => {
        const adminKeys = res?.[GENERATE_ADMIN_AI_KEYS_STORAGE_KEY] || {};
        const cloudFromStorage = generatePickStoredCloudApiKey(res, lsApiKey);
        const rawKey = cloudFromStorage
          || adminKeys.gpt
          || adminKeys.apiKey
          || adminKeys.cloud
          || adminKeys.cloudApiKey
          || adminKeys.nhp
          || res?.[GENERATE_GPT_API_KEY_STORAGE_KEY]
          || lsApiKey;
        finish(
          rawKey,
          adminKeys.baseUrl || res?.[GENERATE_PROXY_BASE_URL_STORAGE_KEY] || lsBaseUrl,
          cloudFromStorage || (
            generateIsLocalCliProxyGatewayKey(rawKey) ? '' : rawKey
          )
        );
      });
    } catch (_) {
      finish(lsApiKey, lsBaseUrl || GENERATE_DEFAULT_NHP_PROXY_BASE_URL, lsApiKey);
    }
  });
}

/**
 * SEO / Admin / multi-endpoint cloud key — never the local gateway placeholder.
 * Reads gpt, apiKey, cloud*, nhpGptApiKey, and nhpProxyEndpoints Render entries.
 */
function generatePickStoredCloudApiKey(storageRes, lsApiKey = '') {
  const adminKeys = storageRes?.[GENERATE_ADMIN_AI_KEYS_STORAGE_KEY] || {};
  const candidates = [];
  const endpoints = storageRes?.[GENERATE_PROXY_ENDPOINTS_STORAGE_KEY];
  if (Array.isArray(endpoints)) {
    for (const ep of endpoints) {
      const key = String(ep?.apiKey || '').trim();
      if (!key || generateIsLocalCliProxyGatewayKey(key)) continue;
      if (/^AIza[0-9A-Za-z_\-]{10,}$/.test(key)) continue;
      // Prefer keys attached to non-local (Render/cloud) endpoints.
      if (!generateIsLocalProxyBaseUrl(ep?.baseUrl)) candidates.push(key);
    }
  }
  candidates.push(
    adminKeys.gpt,
    adminKeys.apiKey,
    adminKeys.cloud,
    adminKeys.cloudApiKey,
    adminKeys.nhp,
    storageRes?.[GENERATE_GPT_API_KEY_STORAGE_KEY],
    lsApiKey
  );
  for (const raw of candidates) {
    const key = String(raw || '').trim();
    if (!key || generateIsLocalCliProxyGatewayKey(key)) continue;
    if (/^AIza[0-9A-Za-z_\-]{10,}$/.test(key)) continue;
    return key;
  }
  return '';
}

async function generateGetGeminiAiKeysFromStorage() {
  return await new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve({ apiKey: '', baseUrl: '' });
        return;
      }
      chrome.storage.local.get([
        GENERATE_GEMINI_API_KEY_STORAGE_KEY,
        GENERATE_GEMINI_BASE_URL_STORAGE_KEY
      ], (res) => {
        resolve({
          apiKey: String(res?.[GENERATE_GEMINI_API_KEY_STORAGE_KEY] || '').trim(),
          baseUrl: generateNormalizeGeminiBaseUrl(res?.[GENERATE_GEMINI_BASE_URL_STORAGE_KEY] || '')
        });
      });
    } catch (_) {
      resolve({ apiKey: '', baseUrl: '' });
    }
  });
}

/**
 * Resolve API credentials for Generate — Gemini mode uses generateGemini* when set.
 * @param {'auto'|'gemini'|'chatgpt'} [provider='auto']
 */
async function generateGetCliProxyAiKeys(provider = 'auto') {
  const normalized = generateNormalizeAiProvider(provider);
  const generic = await generateGetGenericCliProxyAiKeys();
  if (normalized === 'auto') {
    const gemini = await generateGetGeminiAiKeysFromStorage();
    return {
      ...generic,
      geminiApiKey: gemini.apiKey,
      geminiBaseUrl: gemini.baseUrl,
      source: gemini.apiKey || gemini.baseUrl ? 'generic+gemini' : 'generic'
    };
  }
  if (normalized !== 'gemini') {
    return { ...generic, geminiApiKey: '', geminiBaseUrl: '', source: 'generic' };
  }
  const gemini = await generateGetGeminiAiKeysFromStorage();
  const geminiBase = generateNormalizeGeminiBaseUrl(gemini.baseUrl || '') || generic.baseUrl;
  const isDirectGoogle = /generativelanguage\.googleapis\.com/i.test(String(geminiBase || ''));
  const looksLikeGoogleGeminiKey = /^AIza[0-9A-Za-z_\-]{10,}$/.test(String(gemini.apiKey || '').trim());
  // Local/remote CLIProxy: keep gateway key (nhp-local-cliproxy-key). AIza keys only for direct Google.
  let apiKey = generic.apiKey;
  let cloudApiKey = generic.cloudApiKey || '';
  if (isDirectGoogle) {
    apiKey = gemini.apiKey || generic.apiKey;
  } else if (gemini.apiKey && !looksLikeGoogleGeminiKey) {
    apiKey = gemini.apiKey;
    if (gemini.apiKey !== GENERATE_LOCAL_CLIPROXY_API_KEY && !generateIsLocalCliProxyGatewayKey(gemini.apiKey)) {
      cloudApiKey = gemini.apiKey;
    }
  } else if (generateIsLocalProxyBaseUrl(geminiBase || generic.baseUrl)) {
    apiKey = GENERATE_LOCAL_CLIPROXY_API_KEY;
  }
  return {
    apiKey,
    cloudApiKey,
    baseUrl: geminiBase || generic.baseUrl,
    geminiApiKey: gemini.apiKey,
    geminiBaseUrl: gemini.baseUrl,
    source: gemini.apiKey || gemini.baseUrl ? 'gemini' : 'generic'
  };
}

function generateBuildApiCredentialHeaders(keys, provider = 'auto') {
  const headers = {};
  const normalized = generateNormalizeAiProvider(provider);
  if (keys?.apiKey) headers['X-NHP-Api-Key'] = keys.apiKey;
  if (keys?.cloudApiKey) headers['X-NHP-Cloud-Api-Key'] = keys.cloudApiKey;
  if (keys?.baseUrl) headers['X-NHP-Proxy-Base-Url'] = keys.baseUrl;
  if (normalized) headers['X-NHP-Ai-Provider'] = normalized;
  if (normalized === 'gemini' || normalized === 'auto') {
    if (keys?.geminiApiKey) headers['X-NHP-Gemini-Api-Key'] = keys.geminiApiKey;
    if (keys?.geminiBaseUrl) headers['X-NHP-Gemini-Base-Url'] = keys.geminiBaseUrl;
  }
  return headers;
}

function generateFormatServerErrorPayload(data, res, { keys, label = '' } = {}) {
  const err = generateHumanizeCliProxyError(data?.error || `HTTP ${res?.status || 0}`);
  const statusLine = res?.status ? ` (HTTP ${res.status})` : '';
  const modelsLine = Array.isArray(data?.imageModels) && data.imageModels.length
    ? `\nنماذج CLIProxy: ${data.imageModels.join('، ')}`
    : '';
  const hint = data?.hint ? `\n${data.hint}` : '';
  const baseLine = data?.baseUrl
    ? `\nCLIProxy: ${data.baseUrl}`
    : (keys?.baseUrl ? `\nCLIProxy: ${keys.baseUrl}` : '');
  const codeLine = data?.code ? `\nرمز: ${data.code}` : '';
  const prefix = label ? `فشل اختبار ${label}${statusLine}: ` : '';
  return `${prefix}${err}${modelsLine}${hint}${baseLine}${codeLine}`.trim();
}

function generateAppendApiCredentialsToForm(form, keys, provider = 'auto') {
  const normalized = generateNormalizeAiProvider(provider);
  if (keys?.apiKey) form.append('apiKey', keys.apiKey);
  if (keys?.cloudApiKey) form.append('cloudApiKey', keys.cloudApiKey);
  if (keys?.baseUrl) form.append('baseUrl', keys.baseUrl);
  if (normalized === 'gemini' || normalized === 'auto') {
    if (keys?.geminiApiKey) form.append('geminiApiKey', keys.geminiApiKey);
    if (keys?.geminiBaseUrl) form.append('geminiBaseUrl', keys.geminiBaseUrl);
  }
}

function generateEls() {
  return {
    root: document.querySelector('.generate-root'),
    tabBar: document.getElementById('generate-tab-bar'),
    tabList: document.getElementById('generate-tab-list'),
    tabCloseAll: document.getElementById('generate-tab-close-all'),
    tabAdd: document.getElementById('generate-tab-add'),
    queueBadge: document.getElementById('generate-queue-badge'),
    chat: document.getElementById('generate-chat'),
    welcome: document.getElementById('generate-welcome'),
    prompt: document.getElementById('generate-prompt'),
    input: document.getElementById('generate-image-input'),
    attachRow: document.getElementById('generate-attach-row'),
    attachChips: document.getElementById('generate-attach-chips'),
    clearChat: document.getElementById('generate-clear-chat'),
    mode: document.getElementById('generate-mode'),
    count: document.getElementById('generate-count'),
    quality: document.getElementById('generate-quality'),
    style: document.getElementById('generate-style'),
    submit: document.getElementById('generate-submit'),
    status: document.getElementById('generate-status'),
    gallery: document.getElementById('generate-gallery'),
    historySearch: document.getElementById('generate-history-search'),
    refreshGallery: document.getElementById('generate-refresh-gallery'),
    clearGallery: document.getElementById('generate-clear-gallery'),
    libraryGrid: document.getElementById('generate-library-grid'),
    refreshLibrary: document.getElementById('generate-refresh-library'),
    libDownloadSelected: document.getElementById('generate-lib-download-selected'),
    libDownloadAll: document.getElementById('generate-lib-download-all'),
    libDeleteSelected: document.getElementById('generate-lib-delete-selected'),
    libDeleteAll: document.getElementById('generate-lib-delete-all'),
    libSelectAll: document.getElementById('generate-lib-select-all'),
    libSelectNone: document.getElementById('generate-lib-select-none'),
    libSelectVisible: document.getElementById('generate-lib-select-visible'),
    libSearch: document.getElementById('generate-lib-search'),
    libStudioFilter: document.getElementById('generate-lib-studio-filter'),
    libStudioFilterWrap: document.getElementById('generate-lib-studio-filter-wrap'),
    sectionTabs: document.getElementById('generate-section-tabs'),
    confirmModal: document.getElementById('generate-confirm-modal'),
    confirmText: document.getElementById('generate-confirm-text'),
    confirmOk: document.getElementById('generate-confirm-ok'),
    confirmCancel: document.getElementById('generate-confirm-cancel'),
    confirmBackdrop: document.getElementById('generate-confirm-backdrop'),
    confirmOpt: document.getElementById('generate-confirm-opt'),
    confirmOptCheck: document.getElementById('generate-confirm-opt-check'),
    confirmOptLabel: document.getElementById('generate-confirm-opt-label'),
    libSelectedCount: document.getElementById('generate-lib-selected-count'),
    libSelectCount: document.getElementById('generate-lib-select-count'),
    libSendStudio: document.getElementById('generate-lib-send-studio'),
    libSmartRename: document.getElementById('generate-lib-smart-rename'),
    libFullPipeline: document.getElementById('generate-lib-full-pipeline'),
    pipelineOverlay: document.getElementById('generate-pipeline-overlay'),
    pipelineText: document.getElementById('generate-pipeline-text'),
    pipelineFill: document.getElementById('generate-pipeline-fill'),
    pipelineCancel: document.getElementById('generate-pipeline-cancel'),
    pipelineDismiss: document.getElementById('generate-pipeline-dismiss'),
    libraryPreview: document.getElementById('generate-library-preview'),
    libraryPreviewImg: document.getElementById('generate-library-preview-img'),
    libraryPreviewTitle: document.getElementById('generate-library-preview-title'),
    libraryPreviewActions: document.getElementById('generate-library-preview-actions'),
    libraryPreviewClose: document.getElementById('generate-library-preview-close'),
    lightbox: document.getElementById('generate-lightbox'),
    lightboxImg: document.getElementById('generate-lightbox-img'),
    lightboxClose: document.getElementById('generate-lightbox-close'),
    lightboxBackdrop: document.getElementById('generate-lightbox-backdrop'),
    lightboxPrev: document.getElementById('generate-lightbox-prev'),
    lightboxNext: document.getElementById('generate-lightbox-next'),
    lightboxCounter: document.getElementById('generate-lightbox-counter'),
    lightboxDl: document.getElementById('generate-lightbox-dl'),
    lightboxDel: document.getElementById('generate-lightbox-del'),
    serverPill: document.getElementById('generate-server-pill'),
    autoPrompt: document.getElementById('generate-auto-prompt'),
    settingsBar: document.getElementById('generate-settings-bar'),
    settingsToggle: document.getElementById('generate-settings-toggle'),
    systemPrompt: document.getElementById('generate-system-prompt'),
    systemPromptReset: document.getElementById('generate-system-prompt-reset'),
    styleManageBtn: document.getElementById('generate-style-manage-btn'),
    styleManager: document.getElementById('generate-style-manager'),
    styleManagerList: document.getElementById('generate-style-manager-list'),
    styleAddInput: document.getElementById('generate-style-add-input'),
    styleAddBtn: document.getElementById('generate-style-add-btn'),
    queueConcurrency: document.getElementById('generate-queue-concurrency'),
    autoFallbackGemini: document.getElementById('generate-auto-fallback-gemini'),
    autoFallbackWrap: document.getElementById('generate-auto-fallback-wrap'),
    geminiApiKey: document.getElementById('generate-gemini-api-key'),
    geminiBaseUrl: document.getElementById('generate-gemini-base-url'),
    testGemini: document.getElementById('generate-test-gemini'),
    testChatgpt: document.getElementById('generate-test-chatgpt'),
    restartGhost: document.getElementById('generate-restart-ghost'),
    restartStatus: document.getElementById('generate-restart-status'),
    testStatus: document.getElementById('generate-test-status'),
    testPreview: document.getElementById('generate-test-preview'),
    composer: document.querySelector('.generate-composer')
  };
}

function generateNormalizeStyleName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function generateCustomStyleId(name) {
  const n = generateNormalizeStyleName(name);
  if (!n) return '';
  return `c:${encodeURIComponent(n)}`;
}

function generateDecodeCustomStyleId(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('c:')) return '';
  try {
    return generateNormalizeStyleName(decodeURIComponent(raw.slice(2)));
  } catch (_) {
    return generateNormalizeStyleName(raw.slice(2).replace(/_/g, ' '));
  }
}

function generateGetBuiltinStyle(value) {
  return GENERATE_BUILTIN_STYLES.find((s) => s.value === value) || null;
}

function generateGetStyleEntry(value) {
  const key = String(value || '').trim();
  if (!key || key === 'auto') return null;
  const builtin = generateGetBuiltinStyle(key);
  if (builtin) {
    return {
      value: builtin.value,
      label: builtin.label,
      group: builtin.group,
      builtin: true,
      visionLabel: GENERATE_STYLE_VISION_LABELS[builtin.value] || builtin.label
    };
  }
  if (key.startsWith('c:')) {
    const decoded = generateDecodeCustomStyleId(key);
    const customName = generateStylePrefs.custom.find(
      (n) => generateCustomStyleId(n) === key || generateNormalizeStyleName(n) === decoded
    ) || decoded;
    if (customName) {
      return {
        value: key,
        label: customName,
        group: 'أساليبي',
        builtin: false,
        visionLabel: customName
      };
    }
  }
  return null;
}

function generateListAllStyleEntries() {
  const entries = [];
  GENERATE_BUILTIN_STYLES.forEach((b) => {
    entries.push({
      value: b.value,
      label: b.label,
      group: b.group,
      builtin: true,
      visionLabel: GENERATE_STYLE_VISION_LABELS[b.value] || b.label
    });
  });
  const seen = new Set(entries.map((e) => e.value));
  generateStylePrefs.custom.forEach((name) => {
    const n = generateNormalizeStyleName(name);
    if (!n) return;
    const value = generateCustomStyleId(n);
    if (seen.has(value)) return;
    seen.add(value);
    entries.push({
      value,
      label: n,
      group: 'أساليبي',
      builtin: false,
      visionLabel: n
    });
  });
  return entries;
}

function generateGetVisibleStyleEntries() {
  const hidden = new Set(generateStylePrefs.hidden.map((v) => String(v)));
  return generateListAllStyleEntries().filter((e) => !hidden.has(e.value));
}

function generateGetEffectiveVisionStyleList() {
  return generateGetVisibleStyleEntries().map((e) => e.visionLabel);
}

function generateSanitizeStylePrefs(raw = {}) {
  const custom = Array.isArray(raw.custom)
    ? [...new Set(raw.custom.map(generateNormalizeStyleName).filter(Boolean))]
    : [];
  const hidden = Array.isArray(raw.hidden)
    ? [...new Set(raw.hidden.map((v) => String(v).trim()).filter(Boolean))]
    : [];
  const favorites = Array.isArray(raw.favorites)
    ? [...new Set(raw.favorites.map((v) => String(v).trim()).filter(Boolean))]
    : [];
  const validValues = new Set(GENERATE_BUILTIN_STYLES.map((b) => b.value));
  custom.forEach((name) => {
    const id = generateCustomStyleId(name);
    if (id) validValues.add(id);
  });
  return {
    custom,
    hidden: hidden.filter((v) => validValues.has(v)),
    favorites: favorites.filter((v) => v === 'auto' || validValues.has(v))
  };
}

async function generateLoadStylePrefs() {
  try {
    const data = await generateStorageGet([
      GENERATE_CUSTOM_STYLES_KEY,
      GENERATE_HIDDEN_STYLES_KEY,
      GENERATE_FAVORITE_STYLES_KEY
    ]);
    generateStylePrefs = generateSanitizeStylePrefs({
      custom: data[GENERATE_CUSTOM_STYLES_KEY],
      hidden: data[GENERATE_HIDDEN_STYLES_KEY],
      favorites: data[GENERATE_FAVORITE_STYLES_KEY]
    });
    generateStylePrefs = generateSanitizeStylePrefs(generateStylePrefs);
  } catch (err) {
    console.warn('[Generate] load style prefs failed', err);
    generateStylePrefs = { custom: [], hidden: [], favorites: [] };
  }
  generateStylePrefsLoaded = true;
}

function generateScheduleSaveStylePrefs() {
  if (generateStyleSaveTimer) clearTimeout(generateStyleSaveTimer);
  generateStyleSaveTimer = setTimeout(() => {
    generateStyleSaveTimer = null;
    void generatePersistStylePrefs();
  }, 280);
}

async function generatePersistStylePrefs() {
  generateStylePrefs = generateSanitizeStylePrefs(generateStylePrefs);
  try {
    await generateStorageSet({
      [GENERATE_CUSTOM_STYLES_KEY]: generateStylePrefs.custom,
      [GENERATE_HIDDEN_STYLES_KEY]: generateStylePrefs.hidden,
      [GENERATE_FAVORITE_STYLES_KEY]: generateStylePrefs.favorites
    });
  } catch (err) {
    console.warn('[Generate] save style prefs failed', err);
  }
}

function generateAppendStyleOptions(select, entries, groupLabel) {
  if (!entries.length) return;
  const og = document.createElement('optgroup');
  og.label = groupLabel;
  entries.forEach((e) => {
    const opt = document.createElement('option');
    opt.value = e.value;
    opt.textContent = e.label;
    og.appendChild(opt);
  });
  select.appendChild(og);
}

function generateRebuildStyleSelect(preserveValue) {
  const els = generateEls();
  const select = els.style;
  if (!select) return;
  const prev = preserveValue != null ? String(preserveValue) : select.value;
  const visible = generateGetVisibleStyleEntries();
  const favSet = new Set(generateStylePrefs.favorites.filter((v) => v !== 'auto'));
  const favEntries = [];
  const restByGroup = new Map();
  visible.forEach((e) => {
    if (favSet.has(e.value)) {
      favEntries.push(e);
      return;
    }
    const g = e.group || 'أخرى';
    if (!restByGroup.has(g)) restByGroup.set(g, []);
    restByGroup.get(g).push(e);
  });
  select.replaceChildren();
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = 'تلقائي';
  select.appendChild(autoOpt);
  if (favEntries.length) {
    generateAppendStyleOptions(select, favEntries, 'مفضلة');
  }
  ['كلاسيكي', 'POD 2026', 'أساليبي'].forEach((g) => {
    const list = restByGroup.get(g);
    if (list?.length) generateAppendStyleOptions(select, list, g);
  });
  const valid = new Set(['auto', ...visible.map((e) => e.value)]);
  select.value = valid.has(prev) ? prev : 'auto';
}

function generateRenderStyleManagerList() {
  const listEl = generateEls().styleManagerList;
  if (!listEl) return;
  listEl.replaceChildren();
  const all = generateListAllStyleEntries();
  const favSet = new Set(generateStylePrefs.favorites);
  const hiddenSet = new Set(generateStylePrefs.hidden);
  all.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'generate-style-manager-item';
    if (hiddenSet.has(entry.value)) li.classList.add('is-hidden');

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'generate-style-fav-btn';
    favBtn.title = 'مفضلة';
    favBtn.setAttribute('aria-label', 'مفضلة');
    favBtn.textContent = favSet.has(entry.value) ? '★' : '☆';
    if (favSet.has(entry.value)) favBtn.classList.add('is-fav');
    favBtn.addEventListener('click', () => {
      const set = new Set(generateStylePrefs.favorites);
      if (set.has(entry.value)) set.delete(entry.value);
      else set.add(entry.value);
      generateStylePrefs.favorites = [...set];
      generateScheduleSaveStylePrefs();
      generateRebuildStyleSelect();
      generateRenderStyleManagerList();
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'generate-style-manager-name';
    nameSpan.textContent = entry.builtin ? `${entry.label} (${entry.group})` : entry.label;

    li.appendChild(favBtn);
    li.appendChild(nameSpan);

    if (entry.builtin) {
      const hideBtn = document.createElement('button');
      hideBtn.type = 'button';
      hideBtn.className = 'generate-style-hide-btn';
      hideBtn.title = hiddenSet.has(entry.value) ? 'إظهار في القائمة' : 'إخفاء من القائمة';
      hideBtn.textContent = hiddenSet.has(entry.value) ? '👁' : '⊘';
      hideBtn.addEventListener('click', () => {
        const set = new Set(generateStylePrefs.hidden);
        if (set.has(entry.value)) set.delete(entry.value);
        else set.add(entry.value);
        generateStylePrefs.hidden = [...set];
        generateScheduleSaveStylePrefs();
        generateRebuildStyleSelect();
        generateRenderStyleManagerList();
      });
      li.appendChild(hideBtn);
    } else {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'generate-style-del-btn';
      delBtn.title = 'حذف أسلوب مخصص';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        generateStylePrefs.custom = generateStylePrefs.custom.filter(
          (n) => generateCustomStyleId(n) !== entry.value
        );
        generateStylePrefs.hidden = generateStylePrefs.hidden.filter((v) => v !== entry.value);
        generateStylePrefs.favorites = generateStylePrefs.favorites.filter((v) => v !== entry.value);
        generateScheduleSaveStylePrefs();
        const sel = generateEls().style;
        if (sel?.value === entry.value) sel.value = 'auto';
        generateRebuildStyleSelect();
        generateRenderStyleManagerList();
        generateHelpers.showToast?.('تم حذف الأسلوب المخصص');
      });
      li.appendChild(delBtn);
    }

    listEl.appendChild(li);
  });
}

function generateToggleStyleManager() {
  const { styleManager, styleManageBtn } = generateEls();
  if (!styleManager) return;
  const open = styleManager.hasAttribute('hidden');
  if (open) {
    styleManager.removeAttribute('hidden');
    styleManageBtn?.setAttribute('aria-expanded', 'true');
    generateRenderStyleManagerList();
  } else {
    styleManager.setAttribute('hidden', '');
    styleManageBtn?.setAttribute('aria-expanded', 'false');
  }
}

function generateAddCustomStyleFromInput() {
  const input = generateEls().styleAddInput;
  const name = generateNormalizeStyleName(input?.value || '');
  if (!name) {
    generateHelpers.showWarnToast?.('أدخل اسم أسلوب') || generateHelpers.showToast?.('أدخل اسم أسلوب');
    return;
  }
  const id = generateCustomStyleId(name);
  const builtinDup = GENERATE_BUILTIN_STYLES.find(
    (b) => b.label.toLowerCase() === name.toLowerCase() || b.value === id
  );
  if (builtinDup) {
    generateHelpers.showToast?.('هذا الاسم موجود ضمن الأساليب المدمجة');
    return;
  }
  const exists = generateStylePrefs.custom.some(
    (n) => generateCustomStyleId(n) === id || n.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    generateHelpers.showToast?.('الأسلوب موجود مسبقاً');
    return;
  }
  generateStylePrefs.custom.push(name);
  generateStylePrefs = generateSanitizeStylePrefs(generateStylePrefs);
  if (input) input.value = '';
  generateScheduleSaveStylePrefs();
  generateRebuildStyleSelect(id);
  generateRenderStyleManagerList();
  generateHelpers.showToast?.(`تمت إضافة: ${name}`);
}

async function generateInitStyleSettings() {
  await generateLoadStylePrefs();
  generateRebuildStyleSelect();
  generateRenderStyleManagerList();
}

function generateStorageGet(keys) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}));
  });
}

function generateStorageSet(payload) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    chrome.storage.local.set(payload, () => resolve());
  });
}

function generateGetCustomSystemPromptForApi() {
  const fromUi = String(generateEls().systemPrompt?.value || '').trim();
  return fromUi;
}

async function generateLoadSystemPromptSettings() {
  const els = generateEls();
  if (!els.systemPrompt) return;
  try {
    const data = await generateStorageGet([GENERATE_SYSTEM_PROMPT_KEY]);
    const saved = String(data[GENERATE_SYSTEM_PROMPT_KEY] || '').trim();
    if (saved) els.systemPrompt.value = saved;
  } catch (err) {
    console.warn('[Generate] load system prompt failed', err);
  }
}

function generateScheduleSaveSystemPrompt() {
  if (generateSystemPromptSaveTimer) clearTimeout(generateSystemPromptSaveTimer);
  generateSystemPromptSaveTimer = setTimeout(() => {
    generateSystemPromptSaveTimer = null;
    void generatePersistSystemPrompt();
  }, 400);
}

async function generatePersistSystemPrompt() {
  const els = generateEls();
  if (!els.systemPrompt) return;
  const value = String(els.systemPrompt.value || '').trimEnd();
  try {
    if (value) {
      await generateStorageSet({ [GENERATE_SYSTEM_PROMPT_KEY]: value });
    } else {
      await generateStorageSet({ [GENERATE_SYSTEM_PROMPT_KEY]: '' });
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.remove) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(GENERATE_SYSTEM_PROMPT_KEY, () => resolve());
        });
      }
    }
  } catch (err) {
    console.warn('[Generate] save system prompt failed', err);
  }
}

async function generateResetSystemPromptToDefault() {
  const els = generateEls();
  if (!els.systemPrompt) return;
  try {
    const res = await fetch(generateGhostUrl('/api/generate/prompt-defaults'));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data.systemPrompt) {
      els.systemPrompt.value = data.systemPrompt;
    } else {
      els.systemPrompt.value = '';
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.remove) {
      await new Promise((resolve) => {
        chrome.storage.local.remove(
          [GENERATE_SYSTEM_PROMPT_KEY, GENERATE_AUTO_IMAGE_TEMPLATE_KEY],
          () => resolve()
        );
      });
    }
    generateHelpers.showToast?.('تمت استعادة البرومبت الافتراضي');
  } catch (err) {
    els.systemPrompt.value = '';
    await generatePersistSystemPrompt();
    generateHelpers.showToast?.(`تعذّر جلب الافتراضي — تم التفريغ (${err.message || 'خطأ'})`);
  }
}

function generateMakeTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateDefaultWelcomeHtml() {
  return `<div class="generate-welcome" id="generate-welcome">
        <div class="generate-welcome-icon"><i class="fa-solid fa-shirt"></i></div>
        <p class="generate-welcome-title">مرحباً — صِف التصميم أو ارفع صورة</p>
        <p class="generate-welcome-hint">اكتب وصفاً، أو أرفق صوراً (مشبك / سحب / Ctrl+V) ثم اضغط إرسال — Enter للإرسال، Shift+Enter سطر جديد</p>
      </div>`;
}

function generateTruncateLabel(text, max = 18) {
  const t = String(text || '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function generateNextTabNumber() {
  generateTabCounter += 1;
  return generateTabCounter;
}

function generateCreateEmptySession({ label = '' } = {}) {
  const num = generateNextTabNumber();
  return {
    id: generateMakeTabId(),
    label: label || `توليد ${num}`,
    chatHtml: generateDefaultWelcomeHtml(),
    generationBusy: false,
    generationQueued: false,
    queueJobId: null,
    status: { msg: '', isError: false },
    composer: {
      prompt: '',
      autoPrompt: '',
      autoPromptVisible: false,
      pendingImages: [],
      settings: { mode: 'auto', count: '2', quality: 'balanced', style: 'auto' }
    }
  };
}

function generateGetSession(tabId) {
  return generateSessions.find((s) => s.id === tabId) || null;
}

function generateGetActiveSession() {
  return generateGetSession(generateActiveTabId) || generateSessions[0] || null;
}

function generateCurrentTabId() {
  return generateContextTabId || generateActiveTabId;
}

function generateIsSessionEmpty(session) {
  if (!session) return true;
  if (session.generationBusy || session.generationQueued) return false;
  if (String(session.composer?.prompt || '').trim()) return false;
  if (Array.isArray(session.composer?.pendingImages) && session.composer.pendingImages.length) return false;
  const temp = document.createElement('div');
  temp.innerHTML = session.chatHtml || '';
  return !temp.querySelector('.generate-msg');
}

function generateLoadClosedTabIds() {
  try {
    const raw = localStorage.getItem(GENERATE_CLOSED_TABS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? new Set(list.filter(Boolean)) : new Set();
  } catch (_) {
    return new Set();
  }
}

function generateSaveClosedTabIds(closedIds) {
  try {
    localStorage.setItem(GENERATE_CLOSED_TABS_KEY, JSON.stringify([...closedIds].slice(-200)));
  } catch (_) { /* ignore */ }
}

function generateMarkTabClosed(tabId) {
  if (!tabId) return;
  const closedIds = generateLoadClosedTabIds();
  closedIds.add(tabId);
  generateSaveClosedTabIds(closedIds);
}

function generateScheduleSaveSessions() {
  if (generateSaveSessionsTimer) clearTimeout(generateSaveSessionsTimer);
  generateSaveSessionsTimer = setTimeout(() => {
    generateSaveSessionsTimer = null;
    generateSaveSessions();
  }, 180);
}

function generateSaveSessions() {
  try {
    generatePersistComposerToSession(generateActiveTabId);
    generateSyncChatToSession(generateActiveTabId);
    const slim = generateSessions.map((s) => ({
      id: s.id,
      label: s.label,
      chatHtml: s.chatHtml,
      generationBusy: !!s.generationBusy,
      status: s.status || { msg: '', isError: false },
      composer: {
        prompt: s.composer?.prompt || '',
        autoPrompt: s.composer?.autoPrompt || '',
        autoPromptVisible: !!s.composer?.autoPromptVisible,
        pendingImages: (s.composer?.pendingImages || []).map((img) => ({
          id: img.id,
          previewUrl: img.previewUrl,
          name: img.name
        })),
        settings: { ...(s.composer?.settings || {}) }
      }
    }));
    localStorage.setItem(GENERATE_SESSIONS_KEY, JSON.stringify(slim));
    if (generateActiveTabId) {
      localStorage.setItem(GENERATE_ACTIVE_TAB_KEY, generateActiveTabId);
    }
  } catch (_) { /* ignore */ }
}

function generateMigrateLegacyChat() {
  try {
    if (localStorage.getItem(GENERATE_SESSIONS_KEY)) return false;
    const legacy = localStorage.getItem(GENERATE_CHAT_KEY);
    const session = generateCreateEmptySession({ label: 'توليد 1' });
    if (legacy) {
      session.chatHtml = legacy;
      session.label = 'توليد 1';
    }
    generateSessions = [session];
    generateActiveTabId = session.id;
    generateTabCounter = 1;
    generateSaveSessions();
    return true;
  } catch (_) {
    return false;
  }
}

function generateLoadSessions() {
  try {
    const raw = localStorage.getItem(GENERATE_SESSIONS_KEY);
    if (!raw) {
      if (!generateMigrateLegacyChat()) {
        const session = generateCreateEmptySession({ label: 'توليد 1' });
        generateSessions = [session];
        generateActiveTabId = session.id;
        generateTabCounter = 1;
      }
      return;
    }
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) {
      const session = generateCreateEmptySession({ label: 'توليد 1' });
      generateSessions = [session];
      generateActiveTabId = session.id;
      generateTabCounter = 1;
      return;
    }
    const closedTabIds = generateLoadClosedTabIds();
    const filtered = list.filter((item) => item?.id && !closedTabIds.has(item.id));
    if (!filtered.length) {
      const session = generateCreateEmptySession({ label: 'توليد 1' });
      generateSessions = [session];
      generateActiveTabId = session.id;
      generateTabCounter = 1;
      return;
    }
    generateSessions = filtered.map((item, index) => ({
      id: item.id || generateMakeTabId(),
      label: item.label || `توليد ${index + 1}`,
      chatHtml: item.chatHtml || generateDefaultWelcomeHtml(),
      generationBusy: false,
      generationQueued: false,
      queueJobId: null,
      status: item.status || { msg: '', isError: false },
      composer: {
        prompt: item.composer?.prompt || '',
        autoPrompt: item.composer?.autoPrompt || '',
        autoPromptVisible: !!item.composer?.autoPromptVisible,
        pendingImages: Array.isArray(item.composer?.pendingImages) ? item.composer.pendingImages : [],
        settings: {
          mode: item.composer?.settings?.mode || 'auto',
          count: item.composer?.settings?.count || '2',
          quality: item.composer?.settings?.quality || 'balanced',
          style: item.composer?.settings?.style || 'auto'
        }
      }
    }));
    generateTabCounter = generateSessions.length;
    const savedActive = localStorage.getItem(GENERATE_ACTIVE_TAB_KEY);
    generateActiveTabId = generateGetSession(savedActive)?.id || generateSessions[0].id;
  } catch (_) {
    const session = generateCreateEmptySession({ label: 'توليد 1' });
    generateSessions = [session];
    generateActiveTabId = session.id;
    generateTabCounter = 1;
  }
}

function generateGetChatEl(tabId) {
  const id = tabId || generateActiveTabId;
  if (id === generateActiveTabId) {
    return document.getElementById('generate-chat');
  }
  return generateEnsureVirtualChat(id);
}

function generateEnsureVirtualChat(tabId) {
  if (!generateVirtualChats.has(tabId)) {
    const session = generateGetSession(tabId);
    const el = document.createElement('div');
    el.className = 'generate-chat';
    el.innerHTML = session?.chatHtml || generateDefaultWelcomeHtml();
    generateVirtualChats.set(tabId, el);
  }
  return generateVirtualChats.get(tabId);
}

function generateSyncChatToSession(tabId) {
  const session = generateGetSession(tabId);
  if (!session) return;
  const el = generateGetChatEl(tabId);
  if (el) session.chatHtml = el.innerHTML;
}

function generateGetChat() {
  return generateGetChatEl(generateCurrentTabId());
}

function generatePersistComposerToSession(tabId = generateActiveTabId) {
  const session = generateGetSession(tabId);
  if (!session || tabId !== generateActiveTabId) return;
  const els = generateEls();
  session.composer.prompt = String(els.prompt?.value || '');
  session.composer.autoPrompt = String(els.autoPrompt?.value || '');
  session.composer.autoPromptVisible = generateAutoPromptVisible;
  session.composer.pendingImages = generatePendingImages.map((item) => ({
    id: item.id,
    previewUrl: item.previewUrl,
    name: item.name
  }));
  session.composer.settings = {
    mode: els.mode?.value || 'auto',
    count: els.count?.value || '2',
    quality: els.quality?.value || 'balanced',
    style: els.style?.value || 'auto'
  };
}

async function generateLoadComposerFromSession(session) {
  if (!session) return;
  const els = generateEls();
  if (els.prompt) {
    els.prompt.value = session.composer?.prompt || '';
    generateAutoResizeInput();
  }
  if (els.autoPrompt) {
    els.autoPrompt.value = session.composer?.autoPrompt || '';
    els.autoPrompt.readOnly = false;
  }
  generateAutoPromptVisible = !!session.composer?.autoPromptVisible;
  if (els.mode) els.mode.value = session.composer?.settings?.mode || 'auto';
  if (els.count) els.count.value = session.composer?.settings?.count || '2';
  if (els.quality) els.quality.value = session.composer?.settings?.quality || 'balanced';
  if (els.style) els.style.value = session.composer?.settings?.style || 'auto';

  generatePendingImages = [];
  const pending = Array.isArray(session.composer?.pendingImages) ? session.composer.pendingImages : [];
  for (const img of pending) {
    if (!img?.previewUrl) continue;
    try {
      const blob = await generateUrlToBlob(img.previewUrl);
      if (!blob?.size) continue;
      const ext = (blob.type || '').includes('jpeg') ? '.jpg' : '.png';
      const file = new File([blob], String(img.name || 'reference').replace(/\.[^.]+$/, '') + ext, {
        type: blob.type || 'image/png',
        lastModified: Date.now()
      });
      await generateAddImageFile(file, { previewUrl: img.previewUrl });
    } catch (_) { /* skip broken image */ }
  }

  const busy = !!session.generationBusy;
  const queued = !!session.generationQueued;
  if (els.root) {
    els.root.classList.toggle('is-loading', busy);
    els.root.classList.toggle('is-queued', queued && !busy);
  }
  generateUpdateSubmitButton(busy || queued);
  generateApplyStatusToDom(session.status?.msg || '', !!session.status?.isError);
}

function generateUpdateSubmitButton(isGenerating) {
  const { submit } = generateEls();
  if (!submit) return;
  if (isGenerating) {
    submit.disabled = false;
    submit.classList.add('is-stop');
    submit.title = 'إيقاف التوليد';
    submit.setAttribute('aria-label', 'إيقاف');
    submit.innerHTML = '<i class="fa-solid fa-stop" aria-hidden="true"></i>';
  } else {
    submit.classList.remove('is-stop');
    submit.disabled = false;
    submit.title = 'توليد';
    submit.setAttribute('aria-label', 'إرسال');
    submit.innerHTML = '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
  }
}

function generateApplyStatusToDom(msg, isError = false) {
  const { status } = generateEls();
  if (!status) return;
  const text = String(msg || '').trim();
  if (!text) {
    status.textContent = '';
    status.classList.add('is-hidden');
    status.classList.remove('is-error');
    return;
  }
  status.textContent = text;
  status.classList.remove('is-hidden');
  status.classList.toggle('is-error', !!isError);
}

function generateLoadChatToDom(session) {
  const { chat } = generateEls();
  if (!chat || !session) return;
  chat.innerHTML = session.chatHtml || generateDefaultWelcomeHtml();
  generateRebindResultTiles(chat);
  generateUpdateWelcome();
}

function generateRenderTabBar() {
  const { tabList } = generateEls();
  if (!tabList) return;
  tabList.innerHTML = '';
  generateSessions.forEach((session) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'generate-tab';
    btn.dataset.tabId = session.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', session.id === generateActiveTabId ? 'true' : 'false');
    if (session.id === generateActiveTabId) btn.classList.add('is-active');
    if (session.generationBusy) btn.classList.add('is-busy');
    if (session.generationQueued && !session.generationBusy) btn.classList.add('is-queued');

    if (session.generationQueued && !session.generationBusy) {
      const pos = session.queueJobId ? generateGetJobQueueWaitPosition(session.queueJobId) : 0;
      const badge = document.createElement('span');
      badge.className = 'generate-tab-badge generate-tab-badge-queue';
      badge.textContent = pos > 0 ? String(pos) : '·';
      badge.title = pos > 0 ? `في الطابور (${pos})` : 'في الطابور';
      btn.appendChild(badge);
    } else if (session.generationBusy) {
      const badge = document.createElement('span');
      badge.className = 'generate-tab-badge';
      badge.innerHTML = '<span class="generate-tab-spinner" aria-hidden="true"></span>';
      badge.title = 'جاري التوليد';
      btn.appendChild(badge);
    }

    const label = document.createElement('span');
    label.className = 'generate-tab-label';
    label.textContent = session.label || 'توليد';
    label.title = session.label || '';
    btn.appendChild(label);

    if (generateSessions.length > 1) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'generate-tab-close';
      closeBtn.setAttribute('aria-label', 'إغلاق التبويب');
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        generateCloseTab(session.id);
      });
      btn.appendChild(closeBtn);
    }

    btn.addEventListener('click', () => generateSwitchTab(session.id));
    tabList.appendChild(btn);
  });
}

function generateUpdateSessionLabel(tabId, text) {
  const session = generateGetSession(tabId);
  if (!session) return;
  const trimmed = generateTruncateLabel(text, 22);
  if (trimmed) session.label = trimmed;
  generateRenderTabBar();
  generateScheduleSaveSessions();
}

function generateCreateTab({ label = '', focus = true, switchTo = true } = {}) {
  generatePersistComposerToSession(generateActiveTabId);
  generateSyncChatToSession(generateActiveTabId);
  const session = generateCreateEmptySession({ label });
  generateSessions.push(session);
  if (switchTo && focus) {
    generateActiveTabId = session.id;
    generateLoadChatToDom(session);
    void generateLoadComposerFromSession(session);
  }
  generateRenderTabBar();
  generateSaveSessions();
  return session;
}

function generateSwitchTab(tabId) {
  if (!tabId || tabId === generateActiveTabId) return;
  const target = generateGetSession(tabId);
  if (!target) return;
  generatePersistComposerToSession(generateActiveTabId);
  generateSyncChatToSession(generateActiveTabId);
  generateActiveTabId = tabId;
  generateLoadChatToDom(target);
  void generateLoadComposerFromSession(target);
  generateRenderTabBar();
  generateScrollToBottom();
  generateSaveSessions();
}

function generateCloseAllTabs() {
  if (!window.confirm('إغلاق جميع التبويبات؟ سيتم إيقاف أي توليد جاري.')) return;

  const tabIds = generateSessions.map((s) => s.id);
  for (const session of generateSessions) {
    if (session.generationBusy || session.generationQueued) {
      generateCancelGeneration(session.id);
    }
  }

  const closedIds = generateLoadClosedTabIds();
  tabIds.forEach((id) => closedIds.add(id));
  generateSaveClosedTabIds(closedIds);

  if (generateSaveSessionsTimer) {
    clearTimeout(generateSaveSessionsTimer);
    generateSaveSessionsTimer = null;
  }
  generateVirtualChats.clear();
  generateLoadingEls.clear();
  generateTabAbortState.clear();
  generateJobQueue = [];
  generateQueueActiveJobIds.clear();
  generateRefreshQueueUi();

  const session = generateCreateEmptySession({ label: '' });
  generateSessions = [session];
  generateActiveTabId = session.id;
  generateLoadChatToDom(session);
  void generateLoadComposerFromSession(session);
  generateRenderTabBar();
  generateSaveSessions();
}

function generateCloseTab(tabId) {
  if (generateSessions.length <= 1) return;
  const index = generateSessions.findIndex((s) => s.id === tabId);
  if (index < 0) return;

  const closing = generateGetSession(tabId);
  if (closing?.generationBusy || closing?.generationQueued) {
    generateCancelGeneration(tabId);
  }

  generateMarkTabClosed(tabId);

  if (generateSaveSessionsTimer) {
    clearTimeout(generateSaveSessionsTimer);
    generateSaveSessionsTimer = null;
  }

  generateVirtualChats.delete(tabId);
  generateLoadingEls.delete(tabId);
  const closingAbort = generateTabAbortState.get(tabId);
  if (closingAbort?.jobId) generateUnregisterJobTab(closingAbort.jobId);
  generateTabAbortState.delete(tabId);
  for (const [jid, tid] of generateJobTabById.entries()) {
    if (tid === tabId) generateJobTabById.delete(jid);
  }
  generateSessions.splice(index, 1);

  if (generateActiveTabId === tabId) {
    const next = generateSessions[Math.max(0, index - 1)] || generateSessions[0];
    generateActiveTabId = next?.id || null;
    if (next) {
      generateLoadChatToDom(next);
      void generateLoadComposerFromSession(next);
    }
  }
  generateRenderTabBar();
  generateSaveSessions();
}

function generateNewTabFromHeader() {
  generateCreateTab({ focus: true, switchTo: true });
  const { prompt } = generateEls();
  prompt?.focus();
}

async function generateWithTabAsync(tabId, fn) {
  const prev = generateContextTabId;
  generateContextTabId = tabId;
  try {
    return await fn();
  } finally {
    generateContextTabId = prev;
  }
}

function generateSetStatus(msg, isError = false, tabId = generateCurrentTabId()) {
  const session = generateGetSession(tabId);
  const text = String(msg || '').trim();
  if (session) {
    session.status = { msg: text, isError: !!isError };
    generateScheduleSaveSessions();
  }
  if (tabId === generateActiveTabId) {
    generateApplyStatusToDom(text, isError);
  }
}

function generateSetLoading(on, tabId = generateCurrentTabId()) {
  const session = generateGetSession(tabId);
  if (session) {
    session.generationBusy = !!on;
    if (on) {
      session.generationQueued = false;
      session.queueJobId = null;
    }
    generateScheduleSaveSessions();
  }
  generateRenderTabBar();
  if (tabId === generateActiveTabId) {
    const { root } = generateEls();
    const queued = !!session?.generationQueued && !on;
    if (root) {
      root.classList.toggle('is-loading', !!on);
      root.classList.toggle('is-queued', queued);
    }
    generateUpdateSubmitButton(!!on || queued);
  }
  generateRefreshQueueUi();
}

function generateIsCancelledError(err) {
  return err?.name === 'AbortError' || err?.message === 'Cancelled' || err?.cancelled === true;
}

function generateAppendCancelledMessage(tabId = generateCurrentTabId()) {
  const chat = generateGetChatEl(tabId);
  if (!chat) return;
  const { wrap, bubble } = generateCreateMsgEl('assistant');
  const p = document.createElement('p');
  p.className = 'generate-bubble-text generate-cancelled-text';
  p.textContent = 'تم إيقاف التوليد';
  bubble.appendChild(p);
  chat.appendChild(wrap);
  generateUpdateWelcome();
  if (tabId === generateActiveTabId) generateScrollToBottom();
  generateSyncChatToSession(tabId);
}

function generateHandleCancelledGeneration(tabId = generateCurrentTabId()) {
  const session = generateGetSession(tabId);
  if (!session || session._cancelHandled) return;
  session._cancelHandled = true;
  generateRemoveTypingIndicator(tabId);
  generateAppendCancelledMessage(tabId);
  generateSetStatus('تم إيقاف التوليد', false, tabId);
  generateSetLoading(false, tabId);
  generateTabAbortState.delete(tabId);
  generateSaveChatSnapshot(tabId);
  if (tabId === generateActiveTabId) {
    generateHelpers.showToast?.('⏹ تم إيقاف التوليد');
  }
}

function generateCancelGeneration(tabId = generateActiveTabId) {
  if (generateCancelQueuedJob(tabId)) return;
  const session = generateGetSession(tabId);
  if (!session?.generationBusy) return;
  session.cancelled = true;
  const state = generateTabAbortState.get(tabId);
  if (state?.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  if (state?.controller) {
    try { state.controller.abort(); } catch (_) { /* ignore */ }
  }
  if (state?.jobId) {
    generateUnregisterJobTab(state.jobId);
    void fetch(generateGhostUrl(`/api/jobs/${encodeURIComponent(state.jobId)}/cancel`), {
      method: 'POST'
    }).catch(() => {});
  }
  generateHandleCancelledGeneration(tabId);
}

function generateIsTabBusy(tabId = generateActiveTabId) {
  const session = generateGetSession(tabId);
  return !!(session?.generationBusy || session?.generationQueued);
}

/** يحرّر قفل التبويب إذا بقي generationBusy دون مهمة نشطة (تعطّل سابق أو إعادة محاولة فاشلة) */
function generateClearStaleTabBusy(tabId = generateActiveTabId) {
  const session = generateGetSession(tabId);
  if (!session?.generationBusy) return false;
  const state = generateTabAbortState.get(tabId);
  if (state?.controller && !state.controller.signal.aborted) return false;
  generateSetLoading(false, tabId);
  session.cancelled = false;
  return true;
}

function generateUpdateWelcome(tabId = generateActiveTabId) {
  const chat = generateGetChatEl(tabId);
  const welcome = chat?.querySelector('#generate-welcome')
    || (tabId === generateActiveTabId ? document.getElementById('generate-welcome') : null);
  if (!welcome || !chat) return;
  const hasMessages = chat.querySelector('.generate-msg');
  welcome.classList.toggle('is-hidden', !!hasMessages);
}

function generateScrollToBottom() {
  const chat = generateCurrentTabId() === generateActiveTabId
    ? generateEls().chat
    : null;
  if (!chat) return;
  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}

function generateAutoResizeInput() {
  const { prompt } = generateEls();
  if (!prompt) return;
  prompt.style.height = 'auto';
  prompt.style.height = `${Math.min(prompt.scrollHeight, 128)}px`;
}

function generateMakeAttachId() {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateHasPendingImages() {
  return generatePendingImages.length > 0;
}

function generateGetPrimaryPendingImage() {
  return generatePendingImages[0] || null;
}

function generateRenderAttachChips() {
  const { attachRow, attachChips } = generateEls();
  if (!attachChips) return;
  attachChips.innerHTML = '';
  if (!generatePendingImages.length) {
    attachRow?.classList.add('is-hidden');
    return;
  }
  attachRow?.classList.remove('is-hidden');
  generatePendingImages.forEach((item) => {
    const chip = document.createElement('div');
    chip.className = 'generate-attach-chip';
    chip.dataset.attachId = item.id;
    const thumb = document.createElement('img');
    thumb.src = item.previewUrl;
    thumb.width = GENERATE_ATTACH_THUMB_PX;
    thumb.height = GENERATE_ATTACH_THUMB_PX;
    thumb.alt = item.name || 'صورة مرفقة';
    thumb.title = item.name || 'صورة مرفقة';
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      const items = generateBuildPendingLightboxItems();
      const idx = items.findIndex((it) => it.pendingId === item.id);
      generateOpenLightbox(item.previewUrl, thumb.alt, {
        items,
        index: idx >= 0 ? idx : 0,
        context: 'pending'
      });
    });
    const name = document.createElement('span');
    name.className = 'generate-attach-name';
    name.textContent = item.name || 'صورة';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'generate-attach-remove';
    removeBtn.setAttribute('aria-label', 'إزالة الصورة');
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      generateRemovePendingImage(item.id);
    });
    chip.appendChild(thumb);
    chip.appendChild(name);
    chip.appendChild(removeBtn);
    attachChips.appendChild(chip);
  });
}

async function generateCanvasToJpegBlob(canvas, jpegQuality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('فشل ضغط الصورة'))),
      'image/jpeg',
      Math.min(0.95, Math.max(0.5, Number(jpegQuality) || 0.82))
    );
  });
}

async function generateRenderCompressedBlob(img, { maxPx, jpegQuality }) {
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  const limit = Math.max(256, Number(maxPx) || 768);
  const scale = Math.min(1, limit / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas غير متاح');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, outW, outH);
  let q = Math.min(0.95, Math.max(0.5, Number(jpegQuality) || 0.82));
  let blob = await generateCanvasToJpegBlob(canvas, q);
  let pxLimit = limit;
  let attempts = 0;
  while (blob.size > GENERATE_IMAGE_MAX_BYTES_TARGET && q > 0.58 && attempts < 6) {
    q = Math.max(0.58, q - 0.07);
    blob = await generateCanvasToJpegBlob(canvas, q);
    attempts += 1;
  }
  while (blob.size > GENERATE_IMAGE_MAX_BYTES_HARD && pxLimit > 384 && attempts < 10) {
    pxLimit = Math.max(384, Math.round(pxLimit * 0.88));
    const scale2 = Math.min(1, pxLimit / Math.max(w, h));
    const w2 = Math.max(1, Math.round(w * scale2));
    const h2 = Math.max(1, Math.round(h * scale2));
    canvas.width = w2;
    canvas.height = h2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w2, h2);
    ctx.drawImage(img, 0, 0, w2, h2);
    blob = await generateCanvasToJpegBlob(canvas, q);
    attempts += 1;
  }
  const finalW = canvas.width;
  const finalH = canvas.height;
  return { blob, width: finalW, height: finalH, srcWidth: w, srcHeight: h, scale };
}

async function generateCompressImageFile(file, {
  quality = 'balanced',
  maxPx,
  jpegQuality,
  maxBytesTarget = GENERATE_IMAGE_MAX_BYTES_TARGET
} = {}) {
  const limits = generateGetImageCompressLimits(quality);
  const px = Number(maxPx) || limits.maxPx;
  const jq = Number(jpegQuality) || limits.jpegQuality;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
      el.src = objectUrl;
    });
    const rendered = await generateRenderCompressedBlob(img, { maxPx: px, jpegQuality: jq });
    const { blob, width, height, srcWidth, srcHeight, scale } = rendered;
    const baseName = stripPipelineNameNoise(file.name || 'reference') || 'reference';
    const outFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    const previewUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('read failed'));
      r.readAsDataURL(blob);
    });
    const dimensionChanged = scale < 1 || width !== srcWidth || height !== srcHeight;
    const sizeReduced = blob.size < (file.size || blob.size);
    const formatChanged = !/^image\/jpe?g$/i.test(file.type || '');
    return {
      file: outFile,
      previewUrl,
      width,
      height,
      srcWidth,
      srcHeight,
      resized: dimensionChanged || formatChanged || sizeReduced || blob.size > maxBytesTarget * 0.5,
      compressed: true,
      bytes: blob.size
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** @deprecated alias — use generateCompressImageFile */
async function generateResizeImageFile(file, opts = {}) {
  const quality = opts.quality || generateGetSelectedImageQuality();
  return generateCompressImageFile(file, { ...opts, quality });
}

async function generateCompressImageForSend(file, quality = 'balanced') {
  return generateCompressImageFile(file, { quality });
}

function generateFormatImageResizeStatus(result, { forSend = false } = {}) {
  if (!result?.width) return '';
  const sameDims = result.srcWidth === result.width && result.srcHeight === result.height;
  if (sameDims) {
    return forSend || result.resized
      ? `تم ضغط الصورة قبل الإرسال (${result.width}×${result.height})`
      : '';
  }
  return `تم تصغير الصورة قبل الإرسال (${result.srcWidth}×${result.srcHeight} → ${result.width}×${result.height})`;
}

async function generateAddImageFile(file, {
  previewUrl: presetPreview = '',
  quality: presetQuality = '',
  preserveAutoPrompt = false
} = {}) {
  if (!file) return false;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type || '')) {
    generateSetStatus('صيغة غير مدعومة — استخدم PNG أو JPG أو WebP', true);
    return false;
  }
  if (generatePendingImages.length >= GENERATE_MAX_PENDING_IMAGES) {
    generateSetStatus(`حد أقصى ${GENERATE_MAX_PENDING_IMAGES} صور في المُجمّع`, true);
    return false;
  }
  if (!preserveAutoPrompt && generateAutoPromptVisible) {
    generateShowAutoPrompt('');
  }
  try {
    const quality = presetQuality || generateGetSelectedImageQuality();
    generateSetStatus('تصغير الصورة قبل الإرسال...');
    const compressed = await generateCompressImageFile(file, { quality });
    const outFile = compressed.file;
    const previewUrl = compressed.previewUrl || presetPreview;
    generatePendingImages.push({
      id: generateMakeAttachId(),
      file: outFile,
      previewUrl,
      name: String(file.name || outFile.name || 'صورة').trim() || 'صورة',
      sourceName: String(file.name || '').trim()
    });
    generateRenderAttachChips();
    generateAutoResizeInput();
    const statusMsg = generateFormatImageResizeStatus(compressed);
    if (statusMsg) {
      generateSetStatus(statusMsg);
      generateHelpers.showToast?.(statusMsg);
    } else {
      generateSetStatus('');
    }
    return true;
  } catch (err) {
    generateSetStatus(err.message || 'فشل معالجة الصورة', true);
    return false;
  }
}

/** @deprecated alias — adds one image */
async function generateSetImageFile(file) {
  return generateAddImageFile(file);
}

function generateRemovePendingImage(attachId) {
  generatePendingImages = generatePendingImages.filter((item) => item.id !== attachId);
  generateRenderAttachChips();
  if (!generatePendingImages.length) {
    const { autoPrompt } = generateEls();
    if (autoPrompt) autoPrompt.value = '';
    generateAutoPromptVisible = false;
  }
}

function generateClearAllImages() {
  generatePendingImages = [];
  const { input, autoPrompt } = generateEls();
  if (input) input.value = '';
  if (autoPrompt) autoPrompt.value = '';
  generateAutoPromptVisible = false;
  generateRenderAttachChips();
}

function generateClearImage() {
  generateClearAllImages();
}

function generateTruncateForDisplay(text, maxLen = GENERATE_AUTO_PROMPT_DISPLAY_MAX) {
  const full = String(text || '').trim();
  if (!full || full.length <= maxLen) {
    return { display: full, full, truncated: false };
  }
  return {
    display: `${full.slice(0, maxLen)}\n… [الوصف الكامل (${full.length} حرف) — يُرسل للتوليد بالكامل]`,
    full,
    truncated: true
  };
}

/** نص الوصف التلقائي الكامل للـ API (قد يكون أطول من حقل العرض المختصر) */
function generateGetBuiltPromptForApi(tabId = generateActiveTabId) {
  const els = generateEls();
  const fromInput = String(els.autoPrompt?.value || '').trim();
  const session = generateGetSession(tabId);
  const fromSession = String(session?.composer?.autoPrompt || '').trim();
  return fromSession.length > fromInput.length ? fromSession : fromInput;
}

function generateShowAutoPrompt(text, { editable = true, tabId = generateCurrentTabId() } = {}) {
  const { autoPrompt } = generateEls();
  const session = generateGetSession(tabId);
  const { display, full, truncated } = generateTruncateForDisplay(text);
  if (!full) {
    if (tabId === generateActiveTabId && autoPrompt) {
      autoPrompt.value = '';
      autoPrompt.removeAttribute('title');
    }
    if (session) {
      session.composer.autoPrompt = '';
      session.composer.autoPromptVisible = false;
    }
    if (tabId === generateActiveTabId) generateAutoPromptVisible = false;
    return;
  }
  if (tabId === generateActiveTabId && autoPrompt) {
    autoPrompt.value = display;
    autoPrompt.readOnly = !editable;
    if (truncated) {
      autoPrompt.title = `الوصف الكامل (${full.length} حرف) — يُرسل للتوليد بالكامل`;
    } else {
      autoPrompt.removeAttribute('title');
    }
    generateAutoPromptVisible = true;
  }
  if (session) {
    session.composer.autoPrompt = full;
    session.composer.autoPromptVisible = true;
  }
}

function generateCreateMsgEl(role) {
  const wrap = document.createElement('div');
  wrap.className = `generate-msg generate-msg-${role}`;
  const label = document.createElement('span');
  label.className = 'generate-msg-label';
  label.textContent = role === 'user' ? 'أنت' : role === 'error' ? 'خطأ' : 'المساعد';
  wrap.appendChild(label);
  const bubble = document.createElement('div');
  bubble.className = 'generate-bubble';
  wrap.appendChild(bubble);
  return { wrap, bubble };
}

function generateAppendUserMessage({ text = '', imageUrl = '', imageUrls = [], tabId = generateActiveTabId } = {}) {
  const chat = generateGetChatEl(tabId);
  if (!chat) return null;
  const { wrap, bubble } = generateCreateMsgEl('user');
  const urls = Array.isArray(imageUrls) && imageUrls.length
    ? imageUrls.filter(Boolean)
    : (imageUrl ? [imageUrl] : []);
  const lbItems = urls.map((url, idx) => ({
    src: url,
    alt: urls.length > 1 ? `صورة مرجعية ${idx + 1}` : 'صورة مرجعية',
    downloadFilename: `nhp_ref_${idx + 1}.png`
  }));
  if (urls.length) {
    const imgsWrap = document.createElement('div');
    imgsWrap.className = urls.length > 1 ? 'generate-bubble-imgs' : '';
    urls.forEach((url, index) => {
      const img = document.createElement('img');
      img.className = 'generate-bubble-img gen-user-attach-thumb';
      img.src = url;
      img.alt = urls.length > 1 ? `صورة مرجعية ${index + 1}` : 'صورة مرجعية';
      img.title = 'انقر للمعاينة';
      img.addEventListener('click', () => {
        generateOpenLightbox(url, img.alt, {
          items: lbItems,
          index,
          context: 'chat-user'
        });
      });
      imgsWrap.appendChild(img);
    });
    bubble.appendChild(imgsWrap);
  }
  const trimmed = String(text || '').trim();
  if (trimmed) {
    const p = document.createElement('p');
    p.className = 'generate-bubble-text';
    p.textContent = trimmed;
    bubble.appendChild(p);
  }
  if (!bubble.childNodes.length) {
    const p = document.createElement('p');
    p.className = 'generate-bubble-text';
    p.textContent = '—';
    bubble.appendChild(p);
  }
  chat.appendChild(wrap);
  generateUpdateWelcome(tabId);
  if (tabId === generateActiveTabId) generateScrollToBottom();
  generateSyncChatToSession(tabId);
  return wrap;
}

function generateResolveImageSrc(item) {
  const src = item?.dataUrl || item?.url || '';
  if (!src) return '';
  return src.startsWith('http') ? src : (src.startsWith('/') ? generateGhostUrl(src) : src);
}

/** Absolute / data URLs for chat result thumbs (fetch → blob, same as library grid). */
function generateChatResultImageFallbackUrls(item) {
  const seen = new Set();
  const out = [];
  const push = (raw) => {
    const s = String(raw || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    if (s.startsWith('http') || s.startsWith('data:image/') || s.startsWith('blob:')) {
      out.push(s);
      return;
    }
    out.push(generateGhostUrl(s.startsWith('/') ? s : `/${s}`));
  };
  push(item?.dataUrl);
  push(item?.url);
  return out;
}

function generateRevokeChatThumbBlob(img) {
  generateRevokeLibraryThumbBlob(img);
}

async function generateIsAutoSendToStudioEnabled() {
  return false;
}

function generatePersistAutoSendStudio(_enabled) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [GENERATE_AUTO_SEND_STUDIO_KEY]: false });
    }
  } catch (_) { /* ignore */ }
}

async function generateLoadAutoSendStudioSetting() {
  generatePersistAutoSendStudio(false);
}

function generateNormalizeLibraryFileName(name, designIndex = 1) {
  const raw = String(name || '').trim();
  if (!raw) return `design_${designIndex}.png`;
  if (/^design_\d+\.json$/i.test(raw)) return raw.replace(/\.json$/i, '.png');
  if (/^split_(\d+)\.png$/i.test(raw)) return `design_${raw.match(/^split_(\d+)\.png$/i)[1]}.png`;
  if (/\.json$/i.test(raw) && !/\.png$/i.test(raw)) return raw.replace(/\.json$/i, '.png');
  return raw;
}

function generateParseLibraryItemId(item) {
  const id = String(item?.id || '');
  const storageId = item?.storageId || id.replace(/__d\d+$/, '') || id;
  let designIndex = item?.designIndex;
  if (!designIndex) {
    const match = id.match(/__d(\d+)$/);
    designIndex = match ? parseInt(match[1], 10) : 1;
  }
  let fileName = item?.fileName;
  const thumb = String(item?.thumbUrl || '');
  if (!fileName && /\/file\/([^/?#]+)/.test(thumb)) {
    fileName = decodeURIComponent(thumb.match(/\/file\/([^/?#]+)/)[1]);
  }
  if (!fileName || /^meta\.json$/i.test(fileName) || /^index\.json$/i.test(fileName)) {
    fileName = /\/thumb$/i.test(thumb) && !/__d\d+$/.test(id)
      ? 'composite.png'
      : `design_${designIndex}.png`;
  }
  fileName = generateNormalizeLibraryFileName(fileName, designIndex);
  return { id, storageId, designIndex, fileName };
}

/** Route id for /download — includes __dN suffix when item is a split design. */
function generateLibraryRouteId(item) {
  const id = String(item?.id || '');
  const { storageId, designIndex } = generateParseLibraryItemId(item);
  if (/__d\d+$/.test(id)) return id;
  if (item?.designTotal > 1 && designIndex > 0) return `${storageId}__d${designIndex}`;
  return id || storageId;
}

/**
 * Unified full-resolution PNG URL for library grid + lightbox (same source as history).
 * Thumbnails scale via CSS; lightbox uses the identical URL.
 */
function generateLibraryImageUrl(item, { fullSize = true } = {}) {
  void fullSize;
  const routeId = generateLibraryRouteId(item);
  if (!routeId) return '';
  return generateGhostUrl(`/api/library/${encodeURIComponent(routeId)}/download`);
}

function generateLibraryFileUrl(item) {
  const { storageId, fileName } = generateParseLibraryItemId(item);
  return generateGhostUrl(`/api/library/${encodeURIComponent(storageId)}/file/${encodeURIComponent(fileName)}`);
}

/** thumbUrl → download → /file/ — deduped absolute URLs for grid thumbs. */
function generateLibraryImageFallbackUrls(item) {
  const seen = new Set();
  const out = [];
  const push = (raw) => {
    const s = String(raw || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    if (s.startsWith('http') || s.startsWith('data:image/')) {
      out.push(s);
      return;
    }
    out.push(generateGhostUrl(s.startsWith('/') ? s : `/${s}`));
  };
  push(item?.thumbUrl);
  push(generateLibraryImageUrl(item));
  push(generateLibraryFileUrl(item));
  return out;
}

/** Strip stale host/port from library URLs — keep path-only for port-agnostic reload. */
function generateNormalizeLibraryThumbPath(url) {
  const s = String(url || '').trim();
  if (!s || s.startsWith('data:image/')) return s;
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      if (/^\/api\/library\//.test(u.pathname)) return u.pathname;
    }
  } catch (_) { /* ignore */ }
  return s.startsWith('/') ? s : `/${s.replace(/^\/+/, '')}`;
}

function generateSanitizeLibraryItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id || /^index\.json$/i.test(id)) return null;
  const item = { ...raw, id };
  if (item.storageId) item.storageId = String(item.storageId).trim();
  if (item.thumbUrl) item.thumbUrl = generateNormalizeLibraryThumbPath(item.thumbUrl);
  if (!generateLibraryItemIsRenderable(item)) return null;
  return item;
}

function generateDedupeLibraryItems(items) {
  const seen = new Set();
  const out = [];
  (Array.isArray(items) ? items : []).forEach((raw) => {
    const item = generateSanitizeLibraryItem(raw);
    if (!item) return;
    const key = String(item.id);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

/** Server items win on id conflict; secondary fills gaps from localStorage cache. */
function generateMergeLibraryItems(primary, secondary) {
  const map = new Map();
  (Array.isArray(secondary) ? secondary : []).forEach((raw) => {
    const item = generateSanitizeLibraryItem(raw);
    if (item) map.set(item.id, item);
  });
  (Array.isArray(primary) ? primary : []).forEach((raw) => {
    const item = generateSanitizeLibraryItem(raw);
    if (!item) return;
    const prev = map.get(item.id);
    map.set(item.id, prev ? { ...prev, ...item } : item);
  });
  return [...map.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/**
 * Hydrate library grid from persistent localStorage cache (sync, before server fetch).
 * @returns {object[]}
 */
function loadSavedLibraryDesigns({ render = false, mergeIntoMemory = true } = {}) {
  const local = generateDedupeLibraryItems(generateLoadLibraryIndexLocal());
  if (!local.length) {
    if (render) generateRenderLibraryGrid(true);
    return [];
  }
  if (mergeIntoMemory) {
    generateLibraryItems = generateMergeLibraryItems(generateLibraryItems, local);
  }
  if (render) generateRenderLibraryGrid(true);
  return local;
}

function generateLibraryItemIsRenderable(item) {
  if (!item || typeof item !== 'object') return false;
  const id = String(item.id || '').trim();
  if (!id || /^index\.json$/i.test(id)) return false;
  return generateLibraryImageFallbackUrls(item).length > 0;
}

function generateRevokeLibraryThumbBlob(img) {
  const blobUrl = img?.dataset?.blobUrl;
  if (!blobUrl) return;
  try {
    URL.revokeObjectURL(blobUrl);
  } catch (_) { /* ignore */ }
  delete img.dataset.blobUrl;
}

function generateRevokeLibraryGridBlobUrls(libraryGrid) {
  libraryGrid?.querySelectorAll('img.generate-library-thumb[data-blob-url]').forEach((img) => {
    generateRevokeLibraryThumbBlob(img);
  });
}

async function generateLoadMediaThumbIntoImg(img, item, card, opts = {}, attempt = 0) {
  const getUrls = opts.getUrls || generateLibraryImageFallbackUrls;
  const urls = getUrls(item);
  const lightboxSrc = urls[0] || '';
  if (!urls.length) {
    card?.classList.add('is-thumb-missing');
    return;
  }
  let loaded = false;
  for (const url of urls) {
    try {
      generateRevokeLibraryThumbBlob(img);
      if (url.startsWith('data:image/')) {
        img.src = url;
        loaded = true;
        card?.classList.remove('is-thumb-loading');
        if (typeof opts.onLoaded === 'function') opts.onLoaded(url, img);
        break;
      }
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!String(blob.type || '').toLowerCase().startsWith('image/')) continue;
      const blobUrl = URL.createObjectURL(blob);
      img.dataset.blobUrl = blobUrl;
      img.src = blobUrl;
      loaded = true;
      card?.classList.remove('is-thumb-loading');
      if (typeof opts.onLoaded === 'function') opts.onLoaded(blobUrl, img);
      break;
    } catch (_) { /* try next URL */ }
  }
  if (!loaded && attempt < 2) {
    await new Promise((r) => setTimeout(r, GENERATE_LIBRARY_THUMB_RETRY_MS * (attempt + 1)));
    return generateLoadMediaThumbIntoImg(img, item, card, opts, attempt + 1);
  }
  if (!loaded) {
    card?.classList.add('is-thumb-missing');
    img.alt = `${item.promptPreview || 'تصميم'} — معاينة غير متاحة`;
    if (card?.dataset?.pruneQueued !== '1') {
      card.dataset.pruneQueued = '1';
      void generatePruneUnrenderableLibraryItem(item);
    }
    return;
  }
  card?.classList.remove('is-thumb-missing');
  if (img.dataset.mediaThumbClickBound === '1') return;
  img.dataset.mediaThumbClickBound = '1';
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!lightboxSrc) return;
    if (typeof opts.onThumbClick === 'function') {
      opts.onThumbClick(item, lightboxSrc, img);
    }
  });
}

function generateBindLibraryThumbImg(img, item, card) {
  void generateLoadMediaThumbIntoImg(img, item, card, {
    getUrls: generateLibraryImageFallbackUrls,
    onThumbClick: (libItem, lightboxSrc, img) => {
      const items = generateBuildLibraryLightboxItems();
      const idx = items.findIndex((it) => it.libraryId === libItem.id);
      generateOpenLightbox(lightboxSrc, img.alt, {
        items,
        index: idx >= 0 ? idx : 0,
        context: 'library'
      });
    }
  });
}

function generateBindHistoryThumbImg(img, item, card) {
  const getUrls = item.libraryItem
    ? (it) => generateLibraryImageFallbackUrls(it.libraryItem || it)
    : generateHistoryImageFallbackUrls;
  void generateLoadMediaThumbIntoImg(img, item.libraryItem || item, card, {
    getUrls,
    onThumbClick: (histItem, lightboxSrc, imgEl) => {
      const items = generateBuildHistoryLightboxItems();
      const hid = item.historyId || item.id;
      const idx = items.findIndex((it) => it.historyId === hid);
      generateOpenLightbox(lightboxSrc, imgEl.alt, {
        items,
        index: idx >= 0 ? idx : 0,
        context: 'history'
      });
    }
  });
}

async function generateDownloadHistoryPng(item, { silent = false } = {}) {
  const url = item.fullUrl || item.thumbUrl;
  const outName = `nhp_history_${item.jobId || Date.now()}_${item.batchIndex || 1}.png`;
  if (!url) return false;
  try {
    if (String(url).startsWith('data:image/')) {
      generateTriggerDownload(url, outName);
      return true;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const type = String(blob.type || '').toLowerCase();
    if (type.includes('json') || type.includes('text')) {
      throw new Error('الخادم لم يُرجع PNG');
    }
    const objUrl = URL.createObjectURL(blob);
    generateTriggerDownload(objUrl, outName);
    setTimeout(() => URL.revokeObjectURL(objUrl), 8000);
    return true;
  } catch (err) {
    if (!silent) {
      generateHelpers.showToast?.(`❌ فشل التحميل: ${err.message || 'خطأ'}`);
    }
    return false;
  }
}

async function generateFetchImageAsDataUrl(src) {
  const resolved = generateResolveImageSrc({ url: src, dataUrl: src }) || src;
  if (!resolved) throw new Error('مصدر الصورة غير متاح');
  if (resolved.startsWith('data:image/')) return resolved;
  const res = await fetch(resolved);
  if (!res.ok) throw new Error(`تعذّر جلب الصورة (${res.status})`);
  const blob = await res.blob();
  const type = String(blob.type || '').toLowerCase();
  if (type.includes('json') || type.includes('text')) {
    throw new Error('الخادم أرجع بيانات وليس صورة PNG — تأكد من تشغيل Ghost Server');
  }
  if (type && !type.startsWith('image/')) {
    throw new Error('الملف ليس صورة PNG صالحة');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('تعذّر قراءة الصورة'));
    reader.readAsDataURL(blob);
  });
}

function generateBufferPeelStudioImage(imageData) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.get([GENERATE_STUDIO_PEEL_BUFFER_KEY], (res) => {
        const buffer = res[GENERATE_STUDIO_PEEL_BUFFER_KEY] || [];
        buffer.push(imageData);
        if (buffer.length > 40) buffer.splice(0, buffer.length - 40);
        chrome.storage.local.set({ [GENERATE_STUDIO_PEEL_BUFFER_KEY]: buffer }, resolve);
      });
    } catch (_) {
      resolve();
    }
  });
}

async function generateDispatchPeelStudioImage(imageData) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    await generateBufferPeelStudioImage(imageData);
    console.warn('[Generate→Peel] chrome.runtime غير متاح — تم التخزين المؤقت');
    return { delivered: false, buffered: true };
  }
  const response = await chrome.runtime.sendMessage({
    action: GENERATE_STUDIO_PEEL_DISPATCH_ACTION,
    data: imageData
  });
  if (!response?.success) {
    const errMsg = response?.error || 'فشل توجيه الصورة إلى Studio';
    console.warn('[Generate→Peel]', errMsg, imageData?.name);
    throw new Error(errMsg);
  }
  console.log('[Generate→Peel]', imageData?.name, response.buffered ? 'buffered' : 'live');
  return { delivered: !response.buffered, buffered: !!response.buffered };
}

async function generateEnsureStudioPeelReady() {
  if (typeof window.NHP_ensurePanelLoaded === 'function') {
    await window.NHP_ensurePanelLoaded('studio');
  }
  if (typeof window.NHP_activateStudioPanel === 'function') {
    window.NHP_activateStudioPanel();
  }
  if (typeof window.studioWaitPeelImportReady === 'function') {
    await window.studioWaitPeelImportReady(10000);
    return;
  }
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (document.getElementById('panel-studio') && window.STUDIO_TME) return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('تعذّر فتح TeeMaster Pro 5K — أعد المحاولة من تبويب Studio');
}

function generateGetStudioStep2Baseline() {
  if (typeof window.studioGetPipelineSnapshot === 'function') {
    return window.studioGetPipelineSnapshot()?.step2Count || 0;
  }
  return 0;
}

function generateClearPipelineBarTimer() {
  if (generatePipelineHideTimer) {
    clearTimeout(generatePipelineHideTimer);
    generatePipelineHideTimer = null;
  }
}

function generateShowPipelineOverlay(step, total, label) {
  generateClearPipelineBarTimer();
  const { pipelineOverlay, pipelineText, pipelineFill, pipelineCancel, pipelineDismiss } = generateEls();
  if (!pipelineOverlay) return;
  pipelineOverlay.classList.remove('is-hidden', 'is-success', 'is-error', 'is-fading');
  pipelineOverlay.setAttribute('aria-hidden', 'false');
  if (pipelineCancel) pipelineCancel.classList.remove('is-hidden');
  if (pipelineDismiss) pipelineDismiss.classList.add('is-hidden');
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;
  if (pipelineText) {
    const hint = label ? ` — ${label}` : '';
    pipelineText.textContent = `🚀 مسار الرفع الكامل — الخطوة ${step}/${total} — ${pct}%${hint}`;
  }
  if (pipelineFill) pipelineFill.style.width = `${Math.max(pct > 0 ? 4 : 0, pct)}%`;
}

function generateHidePipelineOverlayImmediate() {
  generateClearPipelineBarTimer();
  const { pipelineOverlay, pipelineFill } = generateEls();
  if (!pipelineOverlay) return;
  pipelineOverlay.classList.add('is-hidden');
  pipelineOverlay.classList.remove('is-success', 'is-error', 'is-fading');
  pipelineOverlay.setAttribute('aria-hidden', 'true');
  if (pipelineFill) pipelineFill.style.width = '0%';
}

function generateHidePipelineOverlaySuccess() {
  const { pipelineOverlay, pipelineText, pipelineFill, pipelineCancel } = generateEls();
  if (!pipelineOverlay) return;
  generateClearPipelineBarTimer();
  pipelineOverlay.classList.remove('is-error', 'is-fading');
  pipelineOverlay.classList.add('is-success');
  pipelineOverlay.classList.remove('is-hidden');
  pipelineOverlay.setAttribute('aria-hidden', 'false');
  if (pipelineText) pipelineText.textContent = '✅ اكتمل مسار الرفع الكامل';
  if (pipelineFill) pipelineFill.style.width = '100%';
  if (pipelineCancel) pipelineCancel.classList.add('is-hidden');
  generatePipelineHideTimer = setTimeout(() => {
    pipelineOverlay.classList.add('is-fading');
    generatePipelineHideTimer = setTimeout(generateHidePipelineOverlayImmediate, 450);
  }, 1600);
}

function generateHidePipelineOverlayError(message) {
  const { pipelineOverlay, pipelineText, pipelineFill, pipelineCancel, pipelineDismiss } = generateEls();
  if (!pipelineOverlay) return;
  generateClearPipelineBarTimer();
  pipelineOverlay.classList.remove('is-success', 'is-fading');
  pipelineOverlay.classList.add('is-error');
  pipelineOverlay.classList.remove('is-hidden');
  pipelineOverlay.setAttribute('aria-hidden', 'false');
  if (pipelineText) {
    pipelineText.textContent = message ? `❌ ${message}` : '❌ فشل مسار الرفع الكامل';
  }
  if (pipelineFill) pipelineFill.style.width = '100%';
  if (pipelineCancel) pipelineCancel.classList.add('is-hidden');
  if (pipelineDismiss) pipelineDismiss.classList.remove('is-hidden');
  generatePipelineHideTimer = setTimeout(generateHidePipelineOverlayImmediate, 8000);
}

function generateSetFullPipelineUiBusy(busy) {
  generateFullPipelineBusy = !!busy;
  const { libFullPipeline, libSendStudio } = generateEls();
  const n = generateLibrarySelected.size;
  if (libFullPipeline) {
    libFullPipeline.disabled = busy || n === 0;
    generateSetLibBtnLabel(libFullPipeline, busy ? 'المسار يعمل...' : 'مسار الرفع الكامل');
  }
  if (libSendStudio && !busy) libSendStudio.disabled = n === 0;
}

async function generateInvokeStudioFullPipeline(options) {
  if (typeof window.studioStartFullUploadPipeline === 'function') {
    return window.studioStartFullUploadPipeline(options);
  }
  throw new Error('وحدة Studio غير جاهزة — افتح تبويب Studio وأعد المحاولة');
}

/**
 * In-extension confirm modal (never window.confirm for library clear UX).
 * @param {string} message
 * @param {{ checkboxLabel?: string, checkboxDefault?: boolean, returnDetails?: boolean }} [opts]
 * @returns {Promise<boolean|{ok:boolean,checked:boolean}>}
 */
function generateShowConfirm(message, opts = {}) {
  const {
    confirmModal,
    confirmText,
    confirmOk,
    confirmCancel,
    confirmBackdrop,
    confirmOpt,
    confirmOptCheck,
    confirmOptLabel
  } = generateEls();
  const checkboxLabel = String(opts?.checkboxLabel || '').trim();
  const returnDetails = opts?.returnDetails === true || !!checkboxLabel;
  if (!confirmModal || !confirmText) {
    const ok = window.confirm(message);
    return Promise.resolve(returnDetails ? { ok, checked: false } : ok);
  }
  return new Promise((resolve) => {
    confirmText.textContent = message;
    if (confirmOpt && confirmOptCheck && confirmOptLabel && checkboxLabel) {
      confirmOptLabel.textContent = checkboxLabel;
      confirmOptCheck.checked = opts?.checkboxDefault === true;
      confirmOpt.classList.remove('is-hidden');
    } else if (confirmOpt) {
      confirmOpt.classList.add('is-hidden');
      if (confirmOptCheck) confirmOptCheck.checked = false;
    }
    confirmModal.classList.remove('is-hidden');
    confirmModal.setAttribute('aria-hidden', 'false');
    const done = (ok) => {
      const checked = !!(checkboxLabel && confirmOptCheck?.checked);
      confirmModal.classList.add('is-hidden');
      confirmModal.setAttribute('aria-hidden', 'true');
      confirmOpt?.classList.add('is-hidden');
      confirmOk?.removeEventListener('click', onOk);
      confirmCancel?.removeEventListener('click', onCancel);
      confirmBackdrop?.removeEventListener('click', onCancel);
      resolve(returnDetails ? { ok, checked } : ok);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    confirmOk?.addEventListener('click', onOk);
    confirmCancel?.addEventListener('click', onCancel);
    confirmBackdrop?.addEventListener('click', onCancel);
  });
}

window.generateShowConfirm = generateShowConfirm;

function generateSwitchSection(sectionId) {
  const id = String(sectionId || 'chat');
  generateActiveSection = id;
  document.querySelectorAll('.generate-section-tab').forEach((btn) => {
    const active = btn.dataset.generateSection === id;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.generate-section-panel').forEach((panel) => {
    const active = panel.dataset.generateSection === id;
    panel.classList.toggle('is-active', active);
    if (active) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
  });
  if (id === 'library') {
    loadSavedLibraryDesigns({ render: true, mergeIntoMemory: true });
    void generateFetchLibrary({ retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
  }
  if (id === 'history') void generateFetchGallery();
}

function generateLibraryItemHasStudioMeta(item) {
  return !!(item?.sentToStudio || item?.studioSentAt || item?.sentToStudioAt);
}

function generateLibraryDisplayLabel(item, { maxLen = 24, withHints = true } = {}) {
  const raw = String(item?.displayName || item?.title || '').trim();
  const fromMeta = raw && !isPipelineTempFileStem(raw) ? stripPipelineNameNoise(raw) || raw : '';
  const fromFile = (() => {
    const fn = String(item?.fileName || '').replace(/\.[^.]+$/, '').trim();
    if (!fn || isPipelineTempFileStem(fn)) return '';
    return stripPipelineNameNoise(fn) || fn;
  })();
  const fromPrompt = (() => {
    const p = String(item?.promptPreview || '').trim();
    if (!p || isPipelineTempFileStem(p)) return '';
    return p;
  })();
  const core = (fromMeta || fromFile || fromPrompt || 'توليد').trim();
  const slice = core.slice(0, maxLen);
  if (!withHints) return slice;
  const batchHint = item?.batchTotal > 1 ? ` · د${item.batchIndex}/${item.batchTotal}` : '';
  const designHint = item?.designTotal > 1 ? ` · #${item.designIndex || 1}` : '';
  return `${slice}${batchHint}${designHint}`;
}

function generateGetNoteRenameContext(limit = 60) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['teepublic_manager_data', 'nhp_current_niche_context'], (res) => {
        const data = res.teepublic_manager_data || {};
        const raw = data.niches || [];
        const history = Array.isArray(data.history) ? data.history : [];
        const unique = [];
        const seen = new Set();
        const pushEntry = (text, detail, source) => {
          const trimmed = String(text || '').trim();
          if (!trimmed) return;
          const key = trimmed.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          unique.push({ niche: trimmed, detail, source });
        };
        const currentCtx = String(res.nhp_current_niche_context || '').trim();
        if (currentCtx) pushEntry(currentCtx, '', 'current');
        raw.forEach((entry) => {
          const text = String(entry?.text || entry?.title || entry?.name || '').trim();
          const detail = String(entry?.noteBody || entry?.note || entry?.description || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);
          pushEntry(text, detail, 'current');
        });
        history.forEach((batch) => {
          const batchNiches = Array.isArray(batch?.niches) ? batch.niches : [];
          batchNiches.forEach((text) => pushEntry(text, '', 'memory'));
        });
        resolve(unique.slice(0, Math.max(1, Number(limit) || 60)));
      });
    } catch (_) {
      resolve([]);
    }
  });
}

function generateScheduleLibraryNameRefresh() {
  if (generateLibraryRenamePollTimer) {
    clearTimeout(generateLibraryRenamePollTimer);
    generateLibraryRenamePollTimer = null;
  }
  let attempts = 0;
  const tick = async () => {
    attempts += 1;
    const sigBefore = generateLibraryItems.map((i) => i.displayName || i.title || '').join('\u0001');
    try {
      await generateFetchLibrary({ retries: 1, minCount: 0 });
    } catch (_) { /* ignore */ }
    const sigAfter = generateLibraryItems.map((i) => i.displayName || i.title || '').join('\u0001');
    const hasDisplayNames = generateLibraryItems.some((i) => String(i.displayName || i.title || '').trim());
    if (hasDisplayNames && sigBefore !== sigAfter) {
      generateRenderLibraryGrid(true, true);
      if (generateActiveSection === 'library') {
        generateHelpers.showToast?.('✅ تمت تسمية التصاميم في المكتبة');
      }
      return;
    }
    if (attempts < GENERATE_LIBRARY_RENAME_POLL_MAX) {
      generateLibraryRenamePollTimer = setTimeout(() => { void tick(); }, GENERATE_LIBRARY_RENAME_POLL_MS);
    }
  };
  generateLibraryRenamePollTimer = setTimeout(() => { void tick(); }, GENERATE_LIBRARY_RENAME_POLL_MS);
}

async function generateSmartRenameLibrarySelected() {
  if (generateLibraryRenameInFlight) {
    generateHelpers.showToast?.('⏳ تسمية ذكية قيد التنفيذ — انتظر قليلاً');
    return;
  }
  const ids = [...generateLibrarySelected];
  if (!ids.length) {
    generateHelpers.showToast?.('حدّد تصاميم من المكتبة أولاً');
    return;
  }
  generateLibraryRenameInFlight = true;
  try {
    const noteContext = await generateGetNoteRenameContext(60);
    const proxyKeys = await generateGetCliProxyAiKeys();
    const headers = { 'Content-Type': 'application/json' };
    if (proxyKeys.apiKey) headers['X-NHP-Api-Key'] = proxyKeys.apiKey;
    if (proxyKeys.baseUrl) headers['X-NHP-Proxy-Base-Url'] = proxyKeys.baseUrl;
    const res = await fetch(generateGhostUrl('/api/library/smart-rename'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids, renameNoteContext: noteContext })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      const base = data?.error || `HTTP ${res.status}`;
      const hint404 = res.status === 404
        ? ' — مسار التسمية الذكية غير مسجّل على Ghost؛ أوقف ghost-server.js ثم شغّله من جديد على المنفذ 3019'
        : '';
      const hint503 = res.status === 503 && data?.hint ? ` — ${data.hint}` : '';
      throw new Error(`${base}${hint404}${hint503}`);
    }
    generateHelpers.showToast?.(data.message || 'تمت جدولة التسمية الذكية');
    generateScheduleLibraryNameRefresh();
  } catch (err) {
    generateHelpers.showToast?.(`⚠️ ${err?.message || 'فشل التسمية الذكية'}`);
  } finally {
    generateLibraryRenameInFlight = false;
  }
}

function generateGetFilteredLibraryItems() {
  const q = String(generateLibraryFilterQuery || '').trim().toLowerCase();
  const base = generateLibraryItems.filter(generateLibraryItemIsRenderable);
  const now = Date.now();
  const dayMs = 86400000;
  const weekStart = now - 7 * dayMs;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const hasStudioMeta = base.some(generateLibraryItemHasStudioMeta);
  const { libStudioFilterWrap } = generateEls();
  if (libStudioFilterWrap) {
    libStudioFilterWrap.classList.toggle('is-hidden', !hasStudioMeta);
  }
  return base.filter((item) => {
    if (generateLibraryFilterStudioOnly && hasStudioMeta && !generateLibraryItemHasStudioMeta(item)) return false;
    if (generateLibraryFilterPeriod === 'today') {
      const t = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      if (!t || t < todayStart.getTime()) return false;
    } else if (generateLibraryFilterPeriod === 'week') {
      const t = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      if (!t || t < weekStart) return false;
    }
    if (!q) return true;
    const hay = `${item.displayName || ''} ${item.title || ''} ${item.promptPreview || ''} ${item.fileName || ''} ${item.prompt || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function generateSelectFilteredLibrary(selectAll) {
  const filtered = generateGetFilteredLibraryItems();
  if (selectAll) {
    filtered.forEach((item) => generateLibrarySelected.add(item.id));
  } else {
    filtered.forEach((item) => generateLibrarySelected.delete(item.id));
  }
  generateRenderLibraryGrid(true, true);
}

/** Full automation: Peel → TeeMaster → Magic → Rename/SEO → Autopilot */
async function startFullUploadPipeline() {
  if (generateFullPipelineBusy) {
    generateHelpers.showToast?.('⏳ مسار الرفع الكامل يعمل بالفعل');
    return;
  }
  const ids = [...generateLibrarySelected];
  if (!ids.length) {
    generateHelpers.showToast?.('⚠️ حدّد تصميماً واحداً على الأقل');
    return;
  }
  const n = ids.length;
  const ok = await generateShowConfirm(
    `سيتم إرسال ${n} تصاميم → Peel → TeeMaster → SEO → Autopilot`
  );
  if (!ok) return;
  const items = ids
    .map((id) => generateLibraryItems.find((it) => it.id === id))
    .filter(Boolean);
  if (!items.length) {
    generateHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }

  generateFullPipelineCancelled = false;
  generateSetFullPipelineUiBusy(true);
  generateHelpers.switchTab?.('studio');

  let pipelineOk = false;
  let pipelineErr = '';
  try {
    try {
      await generateEnsureStudioPeelReady();
    } catch (err) {
      generateHelpers.showToast?.(`⚠️ ${err?.message || 'تعذّر فتح Studio'}`);
      return;
    }

    const baselineStep2 = generateGetStudioStep2Baseline();
    const targetStep2Count = baselineStep2 + items.length;
    const totalSteps = GENERATE_FULL_PIPELINE_STEP_LABELS.length;
    generateShowPipelineOverlay(1, totalSteps, GENERATE_FULL_PIPELINE_STEP_LABELS[0]);

    let sent = 0;
    let lastErr = '';
    for (let i = 0; i < items.length; i++) {
      if (generateFullPipelineCancelled) break;
      generateShowPipelineOverlay(
        1,
        totalSteps,
        `${GENERATE_FULL_PIPELINE_STEP_LABELS[0]} (${i + 1}/${items.length})`
      );
      try {
        await generateSendOneDesignToStudioPeel(items[i]);
        sent += 1;
      } catch (err) {
        lastErr = err?.message || String(err);
        console.warn('[Generate→Full Pipeline Peel]', err);
      }
      await new Promise((r) => setTimeout(r, GENERATE_PIPELINE_ITEM_DELAY_MS));
    }

    if (generateFullPipelineCancelled) {
      generateHelpers.showToast?.('⏹️ تم إلغاء مسار الرفع الكامل');
      return;
    }
    if (sent === 0) {
      generateHelpers.showToast?.(
        lastErr
          ? `❌ فشل إرسال الصور: ${lastErr}`
          : '❌ لم تُرسل أي صورة — تحقق من Ghost Server والصور'
      );
      return;
    }

    const pipelineResult = await generateInvokeStudioFullPipeline({
      targetStep2Count,
      includeAutopilot: true,
      onProgress: ({ step, total, label }) => {
        generateShowPipelineOverlay(step || 2, total || totalSteps, label || '');
      },
      cancelCheck: () => {
        if (generateFullPipelineCancelled) {
          window.studioCancelFullUploadPipeline?.();
          throw new Error('تم إلغاء مسار الرفع الكامل');
        }
      }
    });

    if (pipelineResult?.success) {
      pipelineOk = true;
      /* toast shown by studioStartFullUploadPipeline */
    } else if (!generateFullPipelineCancelled) {
      pipelineErr = pipelineResult?.error || 'فشل مسار الرفع الكامل';
      generateHelpers.showToast?.(`❌ ${pipelineErr}`);
    }
  } finally {
    generateSetFullPipelineUiBusy(false);
    if (generateFullPipelineCancelled) {
      generateHidePipelineOverlayImmediate();
    } else if (pipelineOk) {
      generateHidePipelineOverlaySuccess();
    } else if (pipelineErr) {
      generateHidePipelineOverlayError(pipelineErr);
    } else {
      generateHidePipelineOverlayImmediate();
    }
  }
}

async function generateSendOneDesignToStudioPeel(item) {
  const { storageId, designIndex } = generateParseLibraryItemId(item);
  const src = generateLibraryImageUrl(item);
  const dataURL = await generateFetchImageAsDataUrl(src);
  if (!dataURL.startsWith('data:image/')) {
    throw new Error('تعذّر تحويل التصميم إلى PNG');
  }
  const nicheName = String(item?.nicheName || item?.niche || item?.displayName || item?.title || '').trim();
  const nicheId = String(item?.nicheId || '').trim();
  const imageData = {
    name: `gen_${storageId}_d${designIndex}.png`,
    dataURL,
    timestamp: Date.now(),
    source: 'generate_library',
    libraryId: item?.id || null,
    displayName: nicheName || String(item?.displayName || item?.title || '').trim(),
    nicheName: nicheName || undefined,
    niche: nicheName || undefined,
    nicheId: nicheId || undefined
  };
  return generateDispatchPeelStudioImage(imageData);
}

async function generateSendLibrarySelectedToStudio() {
  const ids = [...generateLibrarySelected];
  if (!ids.length) {
    generateHelpers.showToast?.('⚠️ حدّد تصميماً واحداً على الأقل');
    return;
  }
  const items = ids
    .map((id) => generateLibraryItems.find((it) => it.id === id))
    .filter(Boolean);
  if (!items.length) {
    generateHelpers.showToast?.('⚠️ لم يُعثر على التصاميم المحددة');
    return;
  }
  const { libSendStudio } = generateEls();
  if (libSendStudio) {
    libSendStudio.disabled = true;
    generateSetLibBtnLabel(libSendStudio, 'جاري الإرسال...');
  }
  generateHelpers.switchTab?.('studio');
  try {
    await generateEnsureStudioPeelReady();
  } catch (err) {
    generateHelpers.showToast?.(`⚠️ ${err?.message || 'تعذّر فتح Studio'}`);
    if (libSendStudio) {
      libSendStudio.disabled = generateLibrarySelected.size === 0;
      generateSetLibBtnLabel(libSendStudio, 'Peel Banana');
    }
    return;
  }
  let sent = 0;
  let buffered = 0;
  let lastErr = '';
  for (const item of items) {
    try {
      const route = await generateSendOneDesignToStudioPeel(item);
      if (route?.buffered) buffered += 1;
      else sent += 1;
    } catch (err) {
      lastErr = err?.message || String(err);
      console.warn('[Generate→Peel Banana]', err);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  if (libSendStudio) {
    libSendStudio.disabled = generateLibrarySelected.size === 0;
    generateSetLibBtnLabel(libSendStudio, 'Peel Banana');
  }
  if (sent > 0 || buffered > 0) {
    const parts = [];
    if (sent > 0) parts.push(`${sent} مباشرة`);
    if (buffered > 0) parts.push(`${buffered} في الانتظار`);
    generateHelpers.showToast?.(`✅ ${parts.join(' + ')} → Peel Banana → TeeMaster Pro 5K`);
  } else {
    generateHelpers.showToast?.(
      lastErr
        ? `⚠️ فشل الإرسال إلى Peel Banana: ${lastErr}`
        : '⚠️ تعذّر إرسال التصاميم — تأكد من Ghost Server والصور PNG'
    );
  }
}

async function generateLoadImageElement(src) {
  const resolved = String(src || '').trim();
  if (!resolved) throw new Error('مصدر الصورة غير متاح');
  let loadSrc = resolved;
  let revokeAfter = '';
  if (!resolved.startsWith('data:') && !resolved.startsWith('blob:')) {
    try {
      const res = await fetch(resolved);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const type = String(blob.type || '').toLowerCase();
      if (type.includes('json') || type.includes('text') || (type && !type.startsWith('image/'))) {
        throw new Error('الخادم لم يُرجع PNG');
      }
      loadSrc = URL.createObjectURL(blob);
      revokeAfter = loadSrc;
    } catch (_) { /* fall back to direct img src */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (revokeAfter) img.dataset.blobUrl = revokeAfter;
      resolve(img);
    };
    img.onerror = () => {
      if (revokeAfter) {
        try { URL.revokeObjectURL(revokeAfter); } catch (_) { /* ignore */ }
      }
      reject(new Error('تعذّر تحميل الصورة'));
    };
    img.src = loadSrc;
  });
}

async function generateSplitGridToBlobs(imageSrc) {
  const img = await generateLoadImageElement(imageSrc);
  const halfW = Math.floor(img.naturalWidth / 2);
  const halfH = Math.floor(img.naturalHeight / 2);
  const rects = [
    [0, 0, halfW, halfH],
    [halfW, 0, halfW, halfH],
    [0, halfH, halfW, halfH],
    [halfW, halfH, halfW, halfH]
  ];
  const blobs = [];
  for (const [sx, sy, sw, sh] of rects) {
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('split failed'))), 'image/png');
    });
    blobs.push(blob);
  }
  return blobs;
}

function generateTriggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function generateDownloadLibraryPng(item, { silent = false } = {}) {
  const { designIndex, storageId, fileName } = generateParseLibraryItemId(item);
  const url = generateLibraryImageUrl(item) || generateLibraryFileUrl(item);
  const outName = `nhp_d${designIndex}_${storageId}.png`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const type = String(blob.type || '').toLowerCase();
    if (type.includes('json') || type.includes('text')) {
      throw new Error('الخادم لم يُرجع PNG');
    }
    const objUrl = URL.createObjectURL(blob);
    generateTriggerDownload(objUrl, outName);
    setTimeout(() => URL.revokeObjectURL(objUrl), 8000);
    return true;
  } catch (err) {
    if (!silent) {
      generateHelpers.showToast?.(`❌ فشل تحميل ${fileName}: ${err.message || 'خطأ'}`);
    }
    return false;
  }
}

function generateEnsureRainLayer() {
  const panel = document.getElementById('generate-library-panel');
  if (!panel) return null;
  let layer = panel.querySelector('.gen-rain-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'gen-rain-layer';
    layer.setAttribute('aria-hidden', 'true');
    panel.appendChild(layer);
  }
  return layer;
}

function generateSpawnRainDrop(itemId) {
  if (generateRainActive >= GENERATE_RAIN_MAX || !itemId) return;
  const layer = generateEnsureRainLayer();
  if (!layer) return;
  const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(itemId) : itemId.replace(/["\\]/g, '\\$&');
  const card = document.querySelector(`.generate-library-card[data-lib-id="${safeId}"]`);
  const thumbSrc = card?.querySelector('.generate-library-thumb')?.src;
  if (!thumbSrc) return;

  const cardRect = card.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const drop = document.createElement('img');
  drop.className = 'gen-rain-drop';
  drop.src = thumbSrc;
  drop.alt = '';
  drop.draggable = false;
  drop.style.left = `${cardRect.left - layerRect.left + cardRect.width * 0.25}px`;
  drop.style.top = `${cardRect.top - layerRect.top}px`;
  layer.appendChild(drop);
  generateRainActive += 1;
  drop.addEventListener('animationend', () => {
    drop.remove();
    generateRainActive = Math.max(0, generateRainActive - 1);
  }, { once: true });
}

function generateSetLibraryDownloadBusy(busy) {
  generateLibraryBatchBusy = busy;
  const { libDownloadSelected, libDownloadAll } = generateEls();
  if (libDownloadSelected) libDownloadSelected.disabled = busy || generateLibrarySelected.size === 0;
  if (libDownloadAll) libDownloadAll.disabled = busy;
}

async function generateDownloadLibraryBatch(items) {
  if (!items.length || generateLibraryBatchBusy) return { ok: 0, fail: 0, total: 0 };
  generateSetLibraryDownloadBusy(true);
  let ok = 0;
  let fail = 0;
  const total = items.length;
  try {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      generateHelpers.showToast?.(`جاري تحميل الصور كالمطر... ${i + 1}/${total}`, 1400);
      generateSpawnRainDrop(item.id);
      if (await generateDownloadLibraryPng(item, { silent: true })) ok += 1;
      else fail += 1;
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, GENERATE_LIB_DL_DELAY_MS));
      }
    }
  } finally {
    generateSetLibraryDownloadBusy(false);
    generateUpdateLibraryToolbar();
  }
  return { ok, fail, total };
}

function generateSameLightboxSrc(a, b) {
  const norm = (v) => String(v || '').trim().split('?')[0].split('#')[0];
  return norm(a) === norm(b);
}

function generateBuildLibraryLightboxItems() {
  return generateLibraryItems.filter(generateLibraryItemIsRenderable).map((item) => {
    const src = generateLibraryImageUrl(item);
    const { designIndex, storageId } = generateParseLibraryItemId(item);
    return {
      src,
      alt: item.promptPreview || 'تصميم',
      libraryId: item.id,
      libraryItem: item,
      downloadFilename: `nhp_d${designIndex}_${storageId}.png`
    };
  }).filter((item) => item.src);
}

function generateBuildPendingLightboxItems() {
  return generatePendingImages.map((item) => ({
    src: item.previewUrl,
    alt: item.name || 'صورة مرفقة',
    pendingId: item.id,
    downloadFilename: item.name || `nhp_attach_${Date.now()}.png`
  }));
}

function generateExpandGalleryToMediaItems(entries = []) {
  const flat = [];
  const libByJob = new Map();
  (generateLibraryItems || []).forEach((li) => {
    if (!li?.jobId || !generateLibraryItemIsRenderable(li)) return;
    const arr = libByJob.get(li.jobId) || [];
    arr.push(li);
    libByJob.set(li.jobId, arr);
  });
  libByJob.forEach((arr, jobId) => {
    arr.sort((a, b) => {
      const ba = a.batchIndex || 0;
      const bb = b.batchIndex || 0;
      if (ba !== bb) return ba - bb;
      return (a.designIndex || 0) - (b.designIndex || 0);
    });
    libByJob.set(jobId, arr);
  });

  (Array.isArray(entries) ? entries : []).forEach((entry, entryIdx) => {
    const libDesigns = entry.jobId ? libByJob.get(entry.jobId) : null;
    if (libDesigns?.length) {
      libDesigns.forEach((libItem) => {
        flat.push({
          id: libItem.id,
          historyId: libItem.id,
          jobId: entry.jobId,
          createdAt: libItem.createdAt || entry.createdAt,
          promptPreview: libItem.promptPreview || entry.promptPreview || 'توليد سابق',
          thumbUrl: libItem.thumbUrl,
          fullUrl: generateLibraryImageUrl(libItem),
          libraryItem: libItem,
          batchIndex: libItem.batchIndex || 1,
          batchTotal: libItem.batchTotal || 1,
          designIndex: libItem.designIndex || 1,
          designTotal: libItem.designTotal || 1,
          sourceEntry: entry
        });
      });
      return;
    }
    const urls = entry.dataUrls?.length
      ? entry.dataUrls
      : (entry.thumbnails?.length ? entry.thumbnails : []);
    if (!urls.length) return;
    const entryKey = String(entry.jobId || entry.createdAt || `e${entryIdx}`);
    const batchTotal = entry.totalBatches || urls.length || 1;
    urls.forEach((url, ti) => {
      const resolved = String(url).startsWith('http') || String(url).startsWith('data:')
        ? url
        : generateGhostUrl(url);
      if (!resolved) return;
      flat.push({
        id: `${entryKey}__t${ti}`,
        historyId: `${entryKey}__t${ti}`,
        jobId: entry.jobId,
        createdAt: entry.createdAt,
        promptPreview: entry.promptPreview || 'توليد سابق',
        thumbUrl: resolved,
        fullUrl: resolved,
        batchIndex: urls.length > 1 ? ti + 1 : 1,
        batchTotal: urls.length > 1 ? urls.length : batchTotal,
        designIndex: 1,
        designTotal: 1,
        sourceEntry: entry
      });
    });
  });
  return flat;
}

function generateGetFilteredHistoryItems(raw = generateGalleryRaw) {
  const flat = generateExpandGalleryToMediaItems(raw);
  const q = String(generateHistoryFilterQuery || '').trim().toLowerCase();
  if (!q) return flat;
  return flat.filter((item) => {
    const hay = `${item.promptPreview || ''} ${item.jobId || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function generateHistoryImageFallbackUrls(item) {
  const seen = new Set();
  const out = [];
  const push = (raw) => {
    const s = String(raw || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    if (s.startsWith('http') || s.startsWith('data:image/')) {
      out.push(s);
      return;
    }
    out.push(generateGhostUrl(s.startsWith('/') ? s : `/${s}`));
  };
  push(item?.thumbUrl);
  push(item?.fullUrl);
  return out;
}

function generateBuildHistoryLightboxItems(mediaItems = null) {
  const flat = mediaItems || generateGetFilteredHistoryItems();
  return flat.map((item, i) => {
    const src = item.libraryItem
      ? generateLibraryImageUrl(item.libraryItem)
      : (item.fullUrl || item.thumbUrl);
    const { designIndex, storageId } = item.libraryItem
      ? generateParseLibraryItemId(item.libraryItem)
      : { designIndex: item.designIndex || 1, storageId: item.jobId || i };
    return {
      src,
      alt: item.promptPreview || 'توليد سابق',
      historyId: item.historyId || item.id,
      libraryItem: item.libraryItem,
      downloadFilename: item.libraryItem
        ? `nhp_d${designIndex}_${storageId}.png`
        : `nhp_history_${item.jobId || i}_${item.batchIndex || i + 1}.png`
    };
  }).filter((it) => it.src);
}

function generateCollectMsgLightboxItems(fromEl) {
  const msg = fromEl?.closest?.('.generate-msg');
  if (!msg) return [];
  return [...msg.querySelectorAll('.generate-thumb-img, .generate-bubble-img, .gen-user-attach-thumb, .gen-result-thumb, .gen-composite-thumb')]
    .map((img) => ({
      src: img.src || img.getAttribute('src') || '',
      alt: img.alt || 'معاينة',
      downloadFilename: `nhp_chat_${Date.now()}.png`
    }))
    .filter((item) => item.src);
}

function generateFindLightboxIndex(items, src) {
  const idx = items.findIndex((item) => generateSameLightboxSrc(item.src, src));
  return idx >= 0 ? idx : 0;
}

function generateLightboxCanDelete(context = '') {
  return context === 'library' || context === 'pending';
}

function generateLightboxUpdateChrome() {
  const {
    lightbox, lightboxImg, lightboxPrev, lightboxNext, lightboxCounter, lightboxDel
  } = generateEls();
  const { items, index, context } = generateLightboxState;
  const item = items[index];
  if (!lightbox || !lightboxImg || !item?.src) return;

  lightboxImg.src = item.src;
  lightboxImg.alt = item.alt || 'معاينة';

  const multi = items.length > 1;
  lightboxPrev?.classList.toggle('is-hidden', !multi);
  lightboxNext?.classList.toggle('is-hidden', !multi);
  if (lightboxPrev) lightboxPrev.disabled = !multi || index <= 0;
  if (lightboxNext) lightboxNext.disabled = !multi || index >= items.length - 1;

  if (lightboxCounter) {
    lightboxCounter.classList.toggle('is-hidden', !multi);
    lightboxCounter.textContent = multi ? `${index + 1} / ${items.length}` : '';
  }

  if (lightboxDel) {
    const showDel = generateLightboxCanDelete(context);
    lightboxDel.classList.toggle('is-hidden', !showDel);
    lightboxDel.disabled = !showDel;
  }
}

function generateOpenLightboxFromItems(items, index, context = 'single') {
  const list = Array.isArray(items) ? items.filter((item) => item?.src) : [];
  if (!list.length) return;
  const i = Math.max(0, Math.min(index, list.length - 1));
  generateLightboxState = { items: list, index: i, context };
  const { lightbox } = generateEls();
  if (!lightbox) return;
  generateLightboxUpdateChrome();
  lightbox.classList.remove('is-hidden');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function generateOpenLightbox(src, alt = '', opts = {}) {
  if (!src) return;
  if (opts.items?.length) {
    const idx = opts.index ?? generateFindLightboxIndex(opts.items, src);
    generateOpenLightboxFromItems(opts.items, idx, opts.context || 'single');
    return;
  }
  generateOpenLightboxFromItems([{
    src,
    alt: alt || 'معاينة',
    downloadFilename: opts.downloadFilename || `nhp_${Date.now()}.png`,
    ...(opts.meta || {})
  }], 0, opts.context || 'single');
}

function generateCloseLightbox() {
  const { lightbox, lightboxImg } = generateEls();
  if (!lightbox) return;
  generateLightboxZoomCtrl?.reset();
  lightbox.classList.add('is-hidden');
  lightbox.setAttribute('aria-hidden', 'true');
  if (lightboxImg) {
    lightboxImg.removeAttribute('src');
    lightboxImg.alt = '';
  }
  generateLightboxState = { items: [], index: 0, context: 'single' };
  document.body.style.overflow = '';
}

function generateLightboxGo(delta) {
  const { items, index } = generateLightboxState;
  if (items.length <= 1) return;
  const next = index + delta;
  if (next < 0 || next >= items.length) return;
  generateLightboxState.index = next;
  generateLightboxUpdateChrome();
}

async function generateLightboxDownloadCurrent() {
  const item = generateLightboxState.items[generateLightboxState.index];
  if (!item?.src) return;
  if (item.libraryItem) {
    await generateDownloadLibraryPng(item.libraryItem);
    return;
  }
  const filename = item.downloadFilename || `nhp_${Date.now()}.png`;
  try {
    if (String(item.src).startsWith('data:')) {
      generateTriggerDownload(item.src, filename);
      return;
    }
    const res = await fetch(item.src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    generateTriggerDownload(objUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objUrl), 8000);
  } catch (err) {
    generateHelpers.showToast?.(`❌ فشل التحميل: ${err.message || 'خطأ'}`);
  }
}

async function generateLightboxDeleteCurrent() {
  const { items, index, context } = generateLightboxState;
  const item = items[index];
  if (!item || !generateLightboxCanDelete(context)) return;

  if (context === 'library' && item.libraryId) {
    if (!confirm('حذف هذا التصميم من المكتبة؟')) return;
    try {
      const res = await fetch(generateGhostUrl(`/api/library/${encodeURIComponent(item.libraryId)}`), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'فشل الحذف');
      generateRemoveLibraryItemsLocal(item.libraryId);
      const previewTitle = generateEls().libraryPreviewTitle;
      if (previewTitle?.dataset?.libId === item.libraryId) generateCloseLibraryPreview();
      await generateFetchLibrary();
      const nextItems = generateBuildLibraryLightboxItems();
      if (!nextItems.length) {
        generateCloseLightbox();
        generateHelpers.showToast?.('تم حذف التصميم');
        return;
      }
      const nextIndex = Math.min(index, nextItems.length - 1);
      generateOpenLightboxFromItems(nextItems, nextIndex, 'library');
      generateHelpers.showToast?.('تم حذف التصميم');
    } catch (err) {
      generateHelpers.showToast?.(`❌ ${err.message || 'فشل الحذف'}`);
    }
    return;
  }

  if (context === 'pending' && item.pendingId) {
    if (!confirm('إزالة هذه الصورة من المُجمّع؟')) return;
    generateRemovePendingImage(item.pendingId);
    const nextItems = generateBuildPendingLightboxItems();
    if (!nextItems.length) {
      generateCloseLightbox();
      return;
    }
    const nextIndex = Math.min(index, nextItems.length - 1);
    generateOpenLightboxFromItems(nextItems, nextIndex, 'pending');
  }
}

function generateBindLightbox() {
  if (generateLightboxBound) return;
  generateLightboxBound = true;
  ensureGenerateLightboxZoom();
  const {
    lightboxClose, lightboxBackdrop, lightboxPrev, lightboxNext, lightboxDl, lightboxDel
  } = generateEls();
  lightboxClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    generateCloseLightbox();
  });
  lightboxBackdrop?.addEventListener('click', () => generateCloseLightbox());
  lightboxPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    generateLightboxGo(-1);
  });
  lightboxNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    generateLightboxGo(1);
  });
  lightboxDl?.addEventListener('click', (e) => {
    e.stopPropagation();
    void generateLightboxDownloadCurrent();
  });
  lightboxDel?.addEventListener('click', (e) => {
    e.stopPropagation();
    void generateLightboxDeleteCurrent();
  });
  document.addEventListener('keydown', (e) => {
    const { lightbox } = generateEls();
    if (!lightbox || lightbox.classList.contains('is-hidden')) return;
    if (e.key === 'Escape') {
      generateCloseLightbox();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      generateLightboxGo(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      generateLightboxGo(1);
    }
  });
}

function generateStampRetryContext(el, ctx) {
  if (!el || !ctx) return;
  try {
    el.dataset.retryCtx = encodeURIComponent(JSON.stringify(ctx));
  } catch (_) { /* ignore */ }
}

function generateReadRetryContext(el) {
  const raw = el?.dataset?.retryCtx;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (_) {
    return null;
  }
}

function generateRehydrateChatResultThumbs(scopeEl) {
  const scope = scopeEl?.querySelectorAll
    ? scopeEl
    : document.getElementById('generate-chat');
  if (!scope?.querySelectorAll) return;
  scope.querySelectorAll('.gen-result-thumb, .gen-composite-thumb').forEach((img) => {
    if (img.dataset.chatThumbHydrated === '1') return;
    const rawSrc = img.getAttribute('src') || img.src || '';
    if (!rawSrc || rawSrc.startsWith('blob:') || rawSrc.startsWith('data:image/')) return;
    const tile = img.closest('.generate-thumb-wrap');
    if (!tile) return;
    img.dataset.chatThumbHydrated = '1';
    const item = {
      url: rawSrc,
      filename: img.getAttribute('download') || 'nhp_result.png'
    };
    void generateLoadMediaThumbIntoImg(img, item, tile, {
      getUrls: generateChatResultImageFallbackUrls,
      onLoaded: (blobUrl) => {
        img.title = 'انقر للمعاينة';
        const dl = tile.querySelector('a.generate-dl-btn');
        if (dl) dl.href = blobUrl;
      }
    });
  });
}

function generateRebindResultTiles(scopeEl) {
  const scope = scopeEl?.querySelectorAll
    ? scopeEl
    : document.getElementById('generate-chat');
  if (!scope?.querySelectorAll) return;
  generateRehydrateChatResultThumbs(scope);
  scope.querySelectorAll('[data-retry-ctx]').forEach((block) => {
    const ctx = generateReadRetryContext(block);
    if (!ctx) return;
    block.querySelectorAll('.generate-thumb-wrap').forEach((tile) => {
      const img = tile.querySelector('.generate-thumb-img');
      const retryBtn = tile.querySelector('.generate-retry-btn');
      const dl = tile.querySelector('a.generate-dl-btn');
      const src = img?.src || img?.getAttribute('src') || '';
      if (img && src) {
        img.title = 'انقر للمعاينة';
        img.onclick = (e) => {
          e.stopPropagation();
          const items = generateCollectMsgLightboxItems(img);
          const idx = generateFindLightboxIndex(items, src);
          generateOpenLightbox(src, img.alt || '', {
            items: items.length ? items : [{ src, alt: img.alt || '' }],
            index: idx,
            context: 'chat-result'
          });
        };
        img.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            img.onclick(e);
          }
        };
      }
      if (retryBtn) {
        const slotRaw = tile.dataset.slotIndex;
        const slotIndex = slotRaw != null && slotRaw !== '' ? Number(slotRaw) : null;
        retryBtn.onclick = (e) => {
          e.stopPropagation();
          generateRetryFromContext(ctx, { slotIndex: Number.isFinite(slotIndex) ? slotIndex : null });
        };
        retryBtn.disabled = false;
      }
      if (dl && src) {
        dl.href = src;
        dl.onclick = (e) => e.stopPropagation();
      }
    });
  });
  scope.querySelectorAll('.generate-msg-error [data-retry-ctx]').forEach((bubble) => {
    const ctx = generateReadRetryContext(bubble);
    if (!ctx) return;
    bubble.querySelectorAll('.generate-error-retry-btn').forEach((btn) => {
      generateBindErrorRetryButton(btn, ctx);
    });
  });
  scope.querySelectorAll('.generate-bubble-img').forEach((img) => {
    const src = img.src || img.getAttribute('src') || '';
    if (src) {
      img.title = 'انقر للمعاينة';
      img.onclick = (e) => {
        e.stopPropagation();
        const items = generateCollectMsgLightboxItems(img);
        const idx = generateFindLightboxIndex(items, src);
        generateOpenLightbox(src, img.alt || '', {
          items: items.length ? items : [{ src, alt: img.alt || '' }],
          index: idx,
          context: 'chat-user'
        });
      };
    }
  });
}

function generateBuildRetryContextFromForm() {
  const els = generateEls();
  const prompt = String(els.prompt?.value || '').trim();
  const builtPrompt = generateGetBuiltPromptForApi();
  const primary = generateGetPrimaryPendingImage();
  const hasImage = !!primary;
  const libraryDisplayName = generateResolveLibraryDisplayName(
    { name: primary?.sourceName || primary?.name || primary?.file?.name || '' },
    primary
  );
  return {
    prompt,
    builtPrompt,
    useBuiltPrompt: !!(hasImage && generateSessionAutoPromptVisible(generateActiveTabId) && builtPrompt),
    referenceDataUrl: hasImage ? primary.previewUrl : '',
    pendingImageUrls: generatePendingImages.map((i) => i.previewUrl),
    libraryDisplayName,
    mode: els.mode?.value || 'auto',
    count: els.count?.value || '2',
    quality: els.quality?.value || 'balanced',
    style: els.style?.value || 'auto'
  };
}

async function generateReferenceDataUrlToFile(dataUrl, quality = '', preferredName = '') {
  if (!dataUrl) return null;
  try {
    const blob = await generateUrlToBlob(dataUrl);
    if (!blob?.size) return null;
    const ext = (blob.type || '').includes('jpeg') ? '.jpg' : '.png';
    const cleaned = stripPipelineNameNoise(preferredName) || '';
    const stem = (cleaned && !isPipelineTempFileStem(cleaned))
      ? cleaned
      : 'reference';
    const raw = new File([blob], `${stem}${ext}`, { type: blob.type || 'image/png', lastModified: Date.now() });
    const q = String(quality || generateGetSelectedImageQuality());
    const compressed = await generateCompressImageFile(raw, { quality: q });
    return compressed.file;
  } catch (_) {
    return null;
  }
}

async function generateApplyRetryContext(ctx = {}) {
  const els = generateEls();
  if (els.prompt) els.prompt.value = String(ctx.prompt || '');
  if (els.mode) els.mode.value = ctx.mode || 'auto';
  if (els.count) els.count.value = String(ctx.count || '2');
  if (els.quality) els.quality.value = ctx.quality || 'balanced';
  if (els.style) els.style.value = ctx.style || 'auto';
  generateAutoResizeInput();
  if (ctx.builtPrompt) {
    generateShowAutoPrompt(ctx.builtPrompt, { editable: true });
  } else if (els.autoPrompt) {
    els.autoPrompt.value = '';
    generateAutoPromptVisible = false;
  }
  generateClearAllImages();
  const urls = Array.isArray(ctx.pendingImageUrls) && ctx.pendingImageUrls.length
    ? ctx.pendingImageUrls
    : (ctx.referenceDataUrl ? [ctx.referenceDataUrl] : []);
  const preferredName = String(ctx.libraryDisplayName || '').trim();
  for (const dataUrl of urls) {
    const file = await generateReferenceDataUrlToFile(dataUrl, ctx.quality, preferredName);
    if (file) await generateAddImageFile(file, { previewUrl: dataUrl, quality: ctx.quality || 'balanced', preserveAutoPrompt: true });
  }
}

async function generateRetryFromContext(ctx, { slotIndex = null, tabId = generateActiveTabId } = {}) {
  if (!ctx) return;
  const originTabId = ctx.tabId || tabId;
  generateClearStaleTabBusy(originTabId);
  if (generateIsTabBusy(originTabId)) {
    generateHelpers.showToast?.('⚠️ انتظر انتهاء التوليد الحالي أو اضغط إيقاف');
    return;
  }
  const slotHint = slotIndex != null ? ` (التصميم ${slotIndex + 1})` : '';
  generateHelpers.showToast?.(`↻ إعادة التوليد بنفس المدخلات${slotHint}...`);
  if (originTabId !== generateActiveTabId) generateSwitchTab(originTabId);
  await generateApplyRetryContext(ctx);
  await generateExecuteGeneration({
    prompt: ctx.prompt,
    builtPrompt: ctx.builtPrompt,
    useBuiltPrompt: ctx.useBuiltPrompt,
    referenceFile: generateGetPrimaryPendingImage()?.file || null,
    referenceDataUrl: ctx.referenceDataUrl,
    mode: ctx.mode,
    count: ctx.count,
    quality: ctx.quality,
    style: ctx.style,
    appendUser: false,
    retryContext: ctx,
    libraryDisplayName: String(ctx.libraryDisplayName || '').trim(),
    name: String(ctx.libraryDisplayName || '').trim(),
    tabId: originTabId
  });
}

function generateCreateThumbTile({
  item = null,
  src = '',
  filename,
  alt,
  retryContext,
  slotIndex = null,
  thumbKind = 'result'
} = {}) {
  const imageItem = item || {
    dataUrl: String(src || '').startsWith('data:image/') ? src : '',
    url: String(src || '').startsWith('data:image/') ? '' : (src || ''),
    filename
  };
  const wrap = document.createElement('div');
  wrap.className = 'generate-thumb-wrap';
  if (slotIndex != null) {
    wrap.classList.add('generate-quadrant-tile');
    wrap.dataset.slotIndex = String(slotIndex);
  }

  const img = document.createElement('img');
  img.className = thumbKind === 'composite'
    ? 'generate-thumb-img gen-result-thumb gen-composite-thumb'
    : 'generate-thumb-img gen-result-thumb';
  img.alt = alt || 'تصميم';
  img.title = 'جاري تحميل المعاينة...';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  wrap.classList.add('is-thumb-loading');

  const openLightboxFromImg = () => {
    const liveSrc = img.src || generateResolveImageSrc(imageItem);
    if (!liveSrc) return;
    const items = generateCollectMsgLightboxItems(img);
    const idx = generateFindLightboxIndex(items, liveSrc);
    generateOpenLightbox(liveSrc, img.alt, {
      items: items.length ? items : [{ src: liveSrc, alt: img.alt || '', downloadFilename: filename }],
      index: idx,
      context: 'chat-result'
    });
  };
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    openLightboxFromImg();
  });
  img.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightboxFromImg();
    }
  });

  const actions = document.createElement('div');
  actions.className = 'generate-thumb-actions';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'generate-thumb-btn generate-retry-btn';
  retryBtn.textContent = 'إعادة المحاولة';
  if (retryContext) {
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      generateRetryFromContext(retryContext, { slotIndex });
    });
  } else {
    retryBtn.disabled = true;
    retryBtn.title = 'لا توجد بيانات إعادة';
  }

  const dl = document.createElement('a');
  dl.className = 'generate-thumb-btn generate-dl-btn';
  dl.href = '#';
  dl.download = filename || imageItem.filename || `nhp_${Date.now()}.png`;
  dl.textContent = 'تحميل';
  dl.addEventListener('click', (e) => {
    e.stopPropagation();
    const href = img.src || generateResolveImageSrc(imageItem);
    if (!href || href === '#') {
      e.preventDefault();
      generateHelpers.showToast?.('❌ الصورة غير جاهزة للتحميل بعد');
    }
  });

  actions.appendChild(retryBtn);
  actions.appendChild(dl);
  wrap.appendChild(img);
  wrap.appendChild(actions);

  void generateLoadMediaThumbIntoImg(img, imageItem, wrap, {
    getUrls: generateChatResultImageFallbackUrls,
    onLoaded: (blobUrl) => {
      img.title = 'انقر للمعاينة';
      dl.href = blobUrl;
    }
  });

  return wrap;
}

async function generatePopulateQuadrantGrid(container, imageSrc, item, retryContext) {
  if (!container || !imageSrc) return;
  try {
    const img = await generateLoadImageElement(imageSrc);
    const halfW = Math.floor(img.naturalWidth / 2);
    const halfH = Math.floor(img.naturalHeight / 2);
    const rects = [
      [0, 0, halfW, halfH],
      [halfW, 0, halfW, halfH],
      [0, halfH, halfW, halfH],
      [halfW, halfH, halfW, halfH]
    ];
    container.innerHTML = '';
    const label = document.createElement('p');
    label.className = 'generate-quadrants-label';
    label.textContent = 'الأرباع — معاينة منفصلة';
    container.appendChild(label);
    const stamp = Date.now();
    rects.forEach(([sx, sy, sw, sh], i) => {
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = canvas.toDataURL('image/png');
      const baseName = (item.filename || 'nhp_grid').replace(/\.[^.]+$/, '');
      container.appendChild(generateCreateThumbTile({
        src: dataUrl,
        filename: `${baseName}_q${i + 1}.png`,
        alt: `تصميم ${i + 1}`,
        retryContext,
        slotIndex: i
      }));
    });
  } catch (_) {
    container.remove();
  }
}

function generateBuildResultsView(images = [], retryContext = null, { batchTotal = 1 } = {}) {
  const wrap = document.createElement('div');
  const list = Array.isArray(images) ? images.filter((i) => generateResolveImageSrc(i)) : [];
  if (!list.length) {
    wrap.className = 'generate-results-empty';
    const empty = document.createElement('p');
    empty.className = 'generate-bubble-text';
    empty.textContent = 'لا توجد صور في النتيجة.';
    wrap.appendChild(empty);
    return wrap;
  }

  const isComposite = list.length === 1;
  if (isComposite) {
    wrap.className = 'generate-results-composite';
    const item = list[0];
    const imgSrc = generateResolveImageSrc(item);
    const card = document.createElement('article');
    card.className = batchTotal > 1 ? 'generate-composite-card generate-batch-card' : 'generate-composite-card';
    card.appendChild(generateCreateThumbTile({
      item,
      src: imgSrc,
      filename: item.filename || `nhp_grid_${Date.now()}.png`,
      alt: 'شبكة 4 تصاميم (2×2)',
      retryContext,
      thumbKind: 'composite'
    }));

    const extra = document.createElement('div');
    extra.className = 'generate-composite-extra';
    const splitBtn = document.createElement('button');
    splitBtn.type = 'button';
    splitBtn.className = 'generate-thumb-btn generate-split-btn';
    splitBtn.textContent = 'تقسيم إلى 4 PNG';
    splitBtn.addEventListener('click', async () => {
      splitBtn.disabled = true;
      splitBtn.textContent = 'جاري التقسيم...';
      try {
        const blobs = await generateSplitGridToBlobs(imgSrc);
        const stamp = Date.now();
        blobs.forEach((blob, i) => {
          const url = URL.createObjectURL(blob);
          generateTriggerDownload(url, `nhp_design_${stamp}_${i + 1}.png`);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        });
        generateHelpers.showToast?.('✅ تم تقسيم الشبكة إلى 4 ملفات');
      } catch (err) {
        generateHelpers.showToast?.(`❌ ${err.message || 'فشل التقسيم'}`);
      } finally {
        splitBtn.disabled = false;
        splitBtn.textContent = 'تقسيم إلى 4 PNG';
      }
    });
    extra.appendChild(splitBtn);
    card.appendChild(extra);

    const quadrants = document.createElement('div');
    quadrants.className = 'generate-quadrants-grid';
    card.appendChild(quadrants);
    generatePopulateQuadrantGrid(quadrants, imgSrc, item, retryContext);

    if (retryContext) generateStampRetryContext(card, retryContext);
    wrap.appendChild(card);
    return wrap;
  }

  wrap.className = 'generate-results-grid';
  if (retryContext) generateStampRetryContext(wrap, retryContext);
  list.forEach((item, index) => {
    const imgSrc = generateResolveImageSrc(item);
    const card = document.createElement('article');
    card.className = 'generate-result-card';
    card.appendChild(generateCreateThumbTile({
      item,
      src: imgSrc,
      filename: item.filename || `nhp_generate_${Date.now()}_${index + 1}.png`,
      alt: `تصميم ${index + 1}`,
      retryContext,
      slotIndex: index
    }));
    wrap.appendChild(card);
  });
  return wrap;
}

function generateAppendAssistantMessage({
  images = [],
  autoPrompt = '',
  meta = '',
  retryContext = null,
  batchTotal = 1,
  tabId = generateActiveTabId
} = {}) {
  const chat = generateGetChatEl(tabId);
  if (!chat) return null;
  const { wrap, bubble } = generateCreateMsgEl('assistant');

  const autoFull = String(autoPrompt || '').trim();
  if (autoFull) {
    const { display: autoText } = generateTruncateForDisplay(autoFull, 1200);
    const thinking = document.createElement('details');
    thinking.className = 'generate-thinking';
    const summary = document.createElement('summary');
    summary.innerHTML = '<i class="fa-solid fa-brain"></i> الوصف التلقائي';
    const body = document.createElement('div');
    body.className = 'generate-thinking-body';
    body.textContent = autoText;
    thinking.appendChild(summary);
    thinking.appendChild(body);
    bubble.appendChild(thinking);
  }

  const resultsEl = generateBuildResultsView(images, retryContext, { batchTotal });
  bubble.appendChild(resultsEl);
  if (retryContext && !resultsEl.dataset.retryCtx) {
    generateStampRetryContext(bubble, retryContext);
  }

  if (meta) {
    const metaEl = document.createElement('p');
    metaEl.className = 'generate-bubble-meta';
    metaEl.textContent = meta;
    bubble.appendChild(metaEl);
  }

  chat.appendChild(wrap);
  generateUpdateWelcome(tabId);
  if (tabId === generateActiveTabId) generateScrollToBottom();
  generateSyncChatToSession(tabId);
  return wrap;
}

function generateBindErrorRetryButton(btn, ctx) {
  if (!btn || !ctx) return;
  btn.disabled = false;
  btn.title = 'إعادة نفس الطلب (الوصف والصور والإعدادات)';
  btn.onclick = (e) => {
    e.stopPropagation();
    generateRetryFromContext(ctx);
  };
}

function generateAppendErrorMessage(message, retryContext = null, tabId = generateActiveTabId) {
  const chat = generateGetChatEl(tabId);
  if (!chat) return;
  const { wrap, bubble } = generateCreateMsgEl('error');
  wrap.classList.remove('generate-msg-assistant');
  wrap.classList.add('generate-msg-error');
  const p = document.createElement('p');
  p.className = 'generate-bubble-text';
  p.textContent = message || 'فشل التوليد';
  bubble.appendChild(p);
  if (retryContext) {
    generateStampRetryContext(bubble, retryContext);
    const actions = document.createElement('div');
    actions.className = 'generate-error-retry-wrap';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'generate-error-retry-btn';
    retryBtn.textContent = '↻ إعادة المحاولة';
    generateBindErrorRetryButton(retryBtn, retryContext);
    actions.appendChild(retryBtn);
    bubble.appendChild(actions);
  }
  chat.appendChild(wrap);
  generateUpdateWelcome(tabId);
  if (tabId === generateActiveTabId) generateScrollToBottom();
  generateSyncChatToSession(tabId);
}

function generateShowTypingIndicator(initialLabel = 'جاري التوليد', tabId = generateCurrentTabId()) {
  generateRemoveTypingIndicator(tabId);
  const chat = generateGetChatEl(tabId);
  if (!chat) return;
  const { wrap, bubble } = generateCreateMsgEl('assistant');
  wrap.dataset.loading = '1';
  generateLoadingEls.set(tabId, wrap);
  const typing = document.createElement('div');
  typing.className = 'generate-typing';
  typing.dataset.stageLabel = initialLabel;
  typing.innerHTML = `${initialLabel}<span class="generate-typing-dots"><span></span><span></span><span></span></span>`;
  bubble.appendChild(typing);
  chat.appendChild(wrap);
  generateUpdateWelcome();
  if (tabId === generateActiveTabId) generateScrollToBottom();
  generateSyncChatToSession(tabId);
}

function generateUpdateTypingStage(label, tabId = generateCurrentTabId()) {
  const text = String(label || '').trim();
  if (!text) return;
  const loadingEl = generateLoadingEls.get(tabId);
  const typing = loadingEl?.querySelector('.generate-typing');
  if (!typing) return;
  typing.dataset.stageLabel = text;
  typing.innerHTML = `${text}<span class="generate-typing-dots"><span></span><span></span><span></span></span>`;
  if (tabId === generateActiveTabId) generateScrollToBottom();
  generateSyncChatToSession(tabId);
}

async function generatePollJob(jobId, handlers = {}, maxWaitMs = 420000, tabId = generateActiveTabId, signal = null) {
  const ownerTabId = generateResolveJobTabId(jobId, tabId);
  const start = Date.now();
  const pollIntervalVisibleMs = 1100;
  const pollIntervalHiddenMs = 2800;
  const getPollIntervalMs = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return pollIntervalHiddenMs;
    }
    const generateActive = !!document.getElementById('panel-generate')?.classList.contains('active');
    return generateActive ? pollIntervalVisibleMs : Math.max(pollIntervalVisibleMs, 1800);
  };
  let seenBatches = 0;
  let fallbackToastShown = false;
  let fallbackStageStartedAt = 0;
  /** Client fail-safe: do not leave "trying Gemini…" forever if server stays running. */
  const FALLBACK_CLIENT_FAIL_MS = 110000;

  const sleepOrAbort = (ms) => new Promise((resolve, reject) => {
    if (signal?.aborted || generateGetSession(ownerTabId)?.cancelled) {
      reject(Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true }));
      return;
    }
    const timer = setTimeout(() => {
      const abortState = generateTabAbortState.get(ownerTabId);
      if (abortState) abortState.pollTimer = null;
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const abortState = generateTabAbortState.get(ownerTabId);
    if (abortState) abortState.pollTimer = timer;
    const onAbort = () => {
      clearTimeout(timer);
      const st = generateTabAbortState.get(ownerTabId);
      if (st) st.pollTimer = null;
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true }));
    };
    if (signal) signal.addEventListener('abort', onAbort);
  });

  while (Date.now() - start < maxWaitMs) {
    const session = generateGetSession(ownerTabId);
    if (session?.cancelled || signal?.aborted || (!session && !generateTabAbortState.has(ownerTabId))) {
      throw Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true });
    }
    await sleepOrAbort(getPollIntervalMs());
    if (generateGetSession(ownerTabId)?.cancelled || signal?.aborted) {
      throw Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true });
    }
    const res = await fetch(generateGhostUrl(`/api/jobs/${encodeURIComponent(jobId)}`), { signal: signal || undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(generateHumanizeCliProxyError(data?.error || `HTTP ${res.status}`));
    }
    const job = data.job || {};
    if (job.status === 'cancelled') {
      throw Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true });
    }
    const batches = Array.isArray(data.batches) ? data.batches : (Array.isArray(job.batches) ? job.batches : []);
    const totalBatches = data.totalBatches || job.totalBatches || batches.length || 1;
    const isFallbackStage = job.stage === 'fallback_gemini' || job.stage === 'fallback_gpt';

    if (isFallbackStage) {
      if (!fallbackStageStartedAt) fallbackStageStartedAt = Date.now();
      if ((Date.now() - fallbackStageStartedAt) > FALLBACK_CLIENT_FAIL_MS) {
        try {
          await fetch(generateGhostUrl(`/api/jobs/${encodeURIComponent(jobId)}/cancel`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (_) { /* ignore */ }
        const failMsg = job.stage === 'fallback_gpt'
          ? 'انتهت مهلة تجربة ChatGPT بعد فشل Gemini — تحقق من CLIProxy (8317) وCodex OAuth.'
          : 'انتهت مهلة تجربة Gemini بعد فشل ChatGPT — تحقق من CLIProxy (8317) ومصادقة Gemini.';
        throw new Error(failMsg);
      }
    } else {
      fallbackStageStartedAt = 0;
    }

    if (job.stage === 'fallback_gemini' && generateShouldAutoFallbackGemini(handlers.aiProvider) && !fallbackToastShown && !generateGetSession(ownerTabId)?.cancelled) {
      fallbackToastShown = true;
      generateSetStatus('فشل ChatGPT — جاري تجربة Gemini...', false, ownerTabId);
      generateUpdateTypingStage('فشل ChatGPT — جاري تجربة Gemini...', ownerTabId);
      if (ownerTabId === generateActiveTabId) {
        generateHelpers.showToast?.('↻ فشل ChatGPT — جاري تجربة Gemini...', 3500);
      }
    } else if (job.stageLabel && !generateGetSession(ownerTabId)?.cancelled) {
      generateSetStatus(job.stageLabel, false, ownerTabId);
      generateUpdateTypingStage(job.stageLabel, ownerTabId);
    }

    if (batches.length > seenBatches && !generateGetSession(ownerTabId)?.cancelled) {
      for (let i = seenBatches; i < batches.length; i += 1) {
        if (generateGetSession(ownerTabId)?.cancelled) {
          throw Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true });
        }
        const batch = batches[i];
        const batchImages = [{
          filename: batch.filename,
          url: batch.url
        }];
        handlers.onBatch?.({
          batch,
          batchIndex: batch.batchIndex || i + 1,
          totalBatches,
          images: batchImages,
          job
        });
      }
      seenBatches = batches.length;
    }

    if (job.status === 'done') {
      return {
        job,
        files: Array.isArray(data.files) ? data.files : [],
        batches
      };
    }
    if (job.status === 'error') {
      throw new Error(generateHumanizeCliProxyError(job.error || 'فشل التوليد'));
    }
  }
  // Client poll wall — cancel stuck server job so it does not stay running forever.
  try {
    await fetch(generateGhostUrl(`/api/jobs/${encodeURIComponent(jobId)}/cancel`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_) { /* ignore */ }
  throw new Error('انتهت مهلة انتظار التوليد — أعد المحاولة. تحقق من Ghost Server و CLIProxyAPI (8317).');
}

function generateRemoveTypingIndicator(tabId = generateCurrentTabId()) {
  const chat = generateGetChatEl(tabId);
  chat?.querySelectorAll('[data-loading="1"]').forEach((el) => el.remove());
  generateLoadingEls.delete(tabId);
  generateSyncChatToSession(tabId);
}

function generateClearConversation() {
  generateNewTabFromHeader();
}

function generateSaveChatSnapshot(tabId = generateCurrentTabId()) {
  generateSyncChatToSession(tabId);
  generateSaveSessions();
}

function generateRestoreChatSnapshot() {
  generateLoadSessions();
  const session = generateGetActiveSession();
  if (session) {
    generateLoadChatToDom(session);
    void generateLoadComposerFromSession(session);
  }
  generateRenderTabBar();
}

function generateSaveLocalGallery(entry) {
  try {
    const raw = localStorage.getItem(GENERATE_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    arr.unshift(entry);
    while (arr.length > GENERATE_HISTORY_MAX) {
      arr.pop();
    }
    localStorage.setItem(GENERATE_STORAGE_KEY, JSON.stringify(arr));
  } catch (_) { /* ignore */ }
}

function generateLoadLocalGallery() {
  try {
    const raw = localStorage.getItem(GENERATE_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function generateRenderGallery(items = generateGalleryRaw) {
  const { gallery } = generateEls();
  if (!gallery) return;
  generateGalleryRaw = Array.isArray(items) ? items : [];
  const mediaItems = generateGetFilteredHistoryItems(generateGalleryRaw);
  generateRevokeLibraryGridBlobUrls(gallery);
  if (!mediaItems.length) {
    const emptyMsg = generateGalleryRaw.length
      ? 'لا توجد نتائج لهذا البحث.'
      : 'السجل فارغ — سيظهر كل توليد هنا.';
    gallery.innerHTML = `<p class="generate-library-empty">${emptyMsg}</p>`;
    return;
  }
  gallery.innerHTML = '';
  const historyLb = generateBuildHistoryLightboxItems(mediaItems);
  mediaItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'generate-library-card';
    card.dataset.historyId = item.id;

    const thumb = document.createElement('img');
    thumb.className = 'generate-library-thumb';
    thumb.alt = item.promptPreview || 'توليد سابق';
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    generateBindHistoryThumbImg(thumb, item, card);

    const meta = document.createElement('div');
    meta.className = 'generate-library-meta';
    const title = document.createElement('p');
    title.className = 'generate-library-prompt';
    const batchHint = item.batchTotal > 1 ? ` · د${item.batchIndex}/${item.batchTotal}` : '';
    const designHint = item.designTotal > 1 ? ` · #${item.designIndex || 1}` : '';
    title.textContent = `${(item.promptPreview || 'توليد').slice(0, 24)}${batchHint}${designHint}`;
    const date = document.createElement('span');
    date.className = 'generate-library-date';
    date.textContent = generateFormatLibraryDate(item.createdAt);

    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'generate-library-dl';
    dl.title = 'تحميل PNG';
    dl.innerHTML = '<i class="fa-solid fa-download"></i>';
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.libraryItem) void generateDownloadLibraryPng(item.libraryItem);
      else void generateDownloadHistoryPng(item);
    });

    const footer = document.createElement('div');
    footer.className = 'generate-library-footer';
    footer.appendChild(date);
    footer.appendChild(dl);
    meta.appendChild(title);
    meta.appendChild(footer);

    card.appendChild(thumb);
    card.appendChild(meta);
    card.addEventListener('click', (e) => {
      if (e.target.closest('.generate-library-dl, .generate-library-thumb')) return;
      const entry = item.sourceEntry;
      if (Array.isArray(entry?.dataUrls) && entry.dataUrls.length) {
        generateAppendAssistantMessage({
          images: entry.dataUrls.map((dataUrl, i) => ({ dataUrl, filename: `gallery_${i + 1}.png` })),
          meta: entry.promptPreview || 'من السجل',
          tabId: generateActiveTabId
        });
        generateSaveChatSnapshot(generateActiveTabId);
        return;
      }
      const fullSrc = item.fullUrl || item.thumbUrl;
      if (fullSrc) {
        const idx = historyLb.findIndex((it) => it.historyId === item.id);
        generateOpenLightbox(fullSrc, item.promptPreview || 'توليد سابق', {
          items: historyLb,
          index: idx >= 0 ? idx : 0,
          context: 'history'
        });
      }
    });
    gallery.appendChild(card);
  });
}

async function generateProbeGenerateApi() {
  try {
    const pingRes = await fetch(generateGhostUrl('/ping'), { method: 'GET' });
    if (pingRes.ok) {
      const data = await pingRes.json().catch(() => ({}));
      if (data?.generateApi === true) return true;
    }
    const res = await fetch(generateGhostUrl('/api/gallery'), { method: 'GET' });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function generatePingServer() {
  const { serverPill } = generateEls();
  const showConnecting = (attempt, maxAttempts) => {
    if (serverPill) {
      serverPill.textContent = `Ghost … ${attempt}/${maxAttempts}`;
      serverPill.title = 'جاري الاتصال بـ Ghost Server...';
      serverPill.classList.remove('is-online', 'is-offline');
    }
  };
  await generateDetectGhostPort({ onConnecting: showConnecting });
  const port = generateResolvedGhostPort || GHOST_PORT;
  const pingUrl = generateGhostUrl('/ping');
  try {
    const res = await fetch(pingUrl, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    let hasGenerate = data?.generateApi === true;
    if (res.ok && !hasGenerate) {
      hasGenerate = await generateProbeGenerateApi();
    }
    const ok = res.ok && hasGenerate;
    const wasOnline = generateGhostWasOnline;
    generateGhostWasOnline = ok;
    if (serverPill) {
      if (res.ok && !hasGenerate) {
        serverPill.textContent = `Ghost ⚠ ${port}`;
        serverPill.title = `Ghost يعمل لكن /api/generate غير مسجّل — أعد تشغيل ghost-server.js على ${port}`;
      } else {
        serverPill.textContent = ok ? `Ghost ✓ ${port}` : `Ghost ✗ ${port}`;
        serverPill.title = ok ? pingUrl : `غير متصل — المنافذ: ${GHOST_PORT_CANDIDATES.join('، ')}`;
      }
      serverPill.classList.toggle('is-online', ok);
      serverPill.classList.toggle('is-offline', !res.ok);
    }
    if (ok && wasOnline === false) {
      loadSavedLibraryDesigns({ render: generateActiveSection === 'library', mergeIntoMemory: true });
      void generateFetchLibrary({ retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
    }
    return ok;
  } catch (_) {
    generateGhostWasOnline = false;
    if (serverPill) {
      serverPill.textContent = `Ghost ✗ ${port}`;
      serverPill.title = `غير متصل — جرّب ${GHOST_PORT_CANDIDATES.join(' أو ')}`;
      serverPill.classList.add('is-offline');
      serverPill.classList.remove('is-online');
    }
    return false;
  }
}

async function generateFetchGallery() {
  try {
    const res = await fetch(generateGhostUrl('/api/gallery'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    generateRenderGallery(items);
    return items;
  } catch (_) {
    generateRenderGallery(generateLoadLocalGallery());
    return [];
  }
}

async function generateClearGallery() {
  if (!confirm('هل تريد حذف كل السجل؟')) return;
  let msg = 'تم تفريغ السجل';
  try {
    const res = await fetch(generateGhostUrl('/api/gallery/all'), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'فشل التفريغ');
  } catch (_) {
    msg = 'تم تفريغ السجل المحلي';
  }
  try {
    localStorage.removeItem(GENERATE_STORAGE_KEY);
  } catch (_) { /* ignore */ }
  generateRenderGallery([]);
  generateHelpers.showToast?.(msg);
}

function generateSaveLibraryIndexLocal(items) {
  try {
    const slim = generateDedupeLibraryItems(items).map((it) => ({
      id: it.id,
      storageId: it.storageId,
      jobId: it.jobId,
      createdAt: it.createdAt,
      promptPreview: it.promptPreview,
      displayName: it.displayName,
      title: it.title,
      batchIndex: it.batchIndex,
      batchTotal: it.batchTotal,
      designIndex: it.designIndex,
      designTotal: it.designTotal,
      fileName: it.fileName,
      thumbUrl: it.thumbUrl ? generateNormalizeLibraryThumbPath(it.thumbUrl) : it.thumbUrl,
      role: it.role,
      sentToStudio: it.sentToStudio,
      studioSentAt: it.studioSentAt,
      sentToStudioAt: it.sentToStudioAt,
      status: it.status
    }));
    localStorage.setItem(GENERATE_LIBRARY_INDEX_KEY, JSON.stringify(slim.slice(0, 500)));
  } catch (_) { /* ignore */ }
}

function generateLoadLibraryIndexLocal() {
  try {
    const raw = localStorage.getItem(GENERATE_LIBRARY_INDEX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return generateDedupeLibraryItems(Array.isArray(list) ? list : []);
  } catch (_) {
    return [];
  }
}

/** Drop ids from in-memory library + localStorage cache (used after server delete). */
function generateRemoveLibraryItemsLocal(ids) {
  const drop = new Set(
    (Array.isArray(ids) ? ids : [ids]).map((id) => String(id || '').trim()).filter(Boolean)
  );
  if (!drop.size) return;
  const before = generateLibraryItems.length;
  generateLibraryItems = generateLibraryItems.filter((it) => !drop.has(String(it.id)));
  if (generateLibraryItems.length !== before) {
    generateSaveLibraryIndexLocal(generateLibraryItems);
  }
  drop.forEach((id) => generateLibrarySelected.delete(id));
}

/** Remove orphan grid entries whose image URLs all fail (stale localStorage ghosts). */
async function generatePruneUnrenderableLibraryItem(item) {
  const id = String(item?.id || '').trim();
  if (!id) return;
  const urls = generateLibraryImageFallbackUrls(item);
  if (!urls.length) {
    generateRemoveLibraryItemsLocal(id);
    generateRenderLibraryGrid(true, true);
    return;
  }
  let hasImage = false;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (String(blob.type || '').toLowerCase().startsWith('image/')) {
        hasImage = true;
        break;
      }
    } catch (_) { /* try next URL */ }
  }
  if (hasImage) return;
  generateRemoveLibraryItemsLocal(id);
  try {
    await fetch(generateGhostUrl(`/api/library/${encodeURIComponent(id)}`), { method: 'DELETE' });
  } catch (_) { /* ignore */ }
  generateRenderLibraryGrid(true, true);
}

function generateSetLibBtnLabel(btn, text) {
  if (!btn) return;
  const label = btn.querySelector('.gen-lib-btn-label');
  if (label) label.textContent = text;
  else btn.textContent = text;
}

function generateSetLibSelectedCount(n) {
  const { libSelectedCount } = generateEls();
  if (!libSelectedCount) return;
  const text = n ? `${n} محدد` : '0 محدد';
  const countText = libSelectedCount.querySelector('.gen-lib-count-text');
  if (countText) countText.textContent = text;
  else libSelectedCount.textContent = text;
}

function generateUpdateLibraryToolbar() {
  const {
    libDownloadSelected, libDeleteSelected, libDeleteAll, libSendStudio, libSmartRename, libFullPipeline
  } = generateEls();
  const n = generateLibrarySelected.size;
  const hasItems = generateLibraryItems.length > 0;
  if (libDownloadSelected) libDownloadSelected.disabled = n === 0;
  if (libDeleteSelected) libDeleteSelected.disabled = n === 0;
  if (libDeleteAll) libDeleteAll.disabled = !hasItems;
  if (libSmartRename) libSmartRename.disabled = n === 0 || generateLibraryRenameInFlight;
  if (libSendStudio) libSendStudio.disabled = n === 0 || generateFullPipelineBusy;
  if (libFullPipeline) libFullPipeline.disabled = n === 0 || generateFullPipelineBusy;
  generateSetLibSelectedCount(n);
}

function generateFormatLibraryDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
}

function generateRenderLibraryGrid(reset = true, preserveSelection = false) {
  const { libraryGrid } = generateEls();
  if (!libraryGrid) return;
  const items = generateGetFilteredLibraryItems();
  if (!items.length) {
    const emptyMsg = generateLibraryItems.some(generateLibraryItemIsRenderable)
      ? 'لا توجد نتائج لهذا الفلتر — غيّر البحث أو الفترة.'
      : 'المكتبة فارغة — سيُحفظ كل توليد تلقائياً.';
    libraryGrid.innerHTML = `<p class="generate-library-empty">${emptyMsg}</p>`;
    generateLibraryRendered = 0;
    generateLibrarySelected.clear();
    generateUpdateLibraryToolbar();
    return;
  }
  if (reset) {
    generateRevokeLibraryGridBlobUrls(libraryGrid);
    libraryGrid.innerHTML = '';
    generateLibraryRendered = 0;
    if (!preserveSelection) generateLibrarySelected.clear();
  }
  const slice = items.slice(generateLibraryRendered, generateLibraryRendered + GENERATE_LIBRARY_PAGE_SIZE);
  slice.forEach((item) => {
    if (!generateLibraryItemIsRenderable(item)) return;
    const card = document.createElement('article');
    card.className = 'generate-library-card';
    card.dataset.libId = item.id;
    if (generateLibrarySelected.has(item.id)) card.classList.add('is-selected');

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'generate-library-chk';
    chk.checked = generateLibrarySelected.has(item.id);
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      if (chk.checked) generateLibrarySelected.add(item.id);
      else generateLibrarySelected.delete(item.id);
      card.classList.toggle('is-selected', chk.checked);
      generateUpdateLibraryToolbar();
    });

    const thumb = document.createElement('img');
    thumb.className = 'generate-library-thumb';
    thumb.alt = generateLibraryDisplayLabel(item, { maxLen: 48, withHints: false }) || 'تصميم';
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    generateBindLibraryThumbImg(thumb, item, card);

    const delX = document.createElement('button');
    delX.type = 'button';
    delX.className = 'gen-lib-delete-x';
    delX.title = 'حذف';
    delX.setAttribute('aria-label', 'حذف التصميم');
    delX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    delX.addEventListener('click', (e) => {
      e.stopPropagation();
      void generateDeleteLibraryOne(item.id);
    });

    const meta = document.createElement('div');
    meta.className = 'generate-library-meta';
    const title = document.createElement('p');
    title.className = 'generate-library-prompt';
    title.textContent = generateLibraryDisplayLabel(item);
    const date = document.createElement('span');
    date.className = 'generate-library-date';
    date.textContent = generateFormatLibraryDate(item.createdAt);

    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'generate-library-dl';
    dl.title = 'تحميل PNG';
    dl.innerHTML = '<i class="fa-solid fa-download"></i>';
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      void generateDownloadLibraryPng(item);
    });

    const footer = document.createElement('div');
    footer.className = 'generate-library-footer';
    footer.appendChild(date);
    footer.appendChild(dl);

    meta.appendChild(title);
    meta.appendChild(footer);

    card.appendChild(chk);
    card.appendChild(thumb);
    card.appendChild(delX);
    card.appendChild(meta);
    card.addEventListener('click', (e) => {
      if (e.target.closest('.generate-library-chk, .gen-lib-delete-x, .generate-library-dl, .generate-library-thumb')) return;
      const fullSrc = generateLibraryImageUrl(item);
      if (fullSrc) {
        const items = generateBuildLibraryLightboxItems();
        const idx = items.findIndex((it) => it.libraryId === item.id);
        generateOpenLightbox(fullSrc, generateLibraryDisplayLabel(item, { maxLen: 80, withHints: false }) || 'تصميم', {
          items,
          index: idx >= 0 ? idx : 0,
          context: 'library'
        });
      }
    });
    libraryGrid.appendChild(card);
  });
  generateLibraryRendered += slice.length;

  let sentinel = libraryGrid.querySelector('.generate-library-sentinel');
  if (generateLibraryRendered < items.length) {
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.className = 'generate-library-sentinel';
      sentinel.textContent = 'تحميل المزيد...';
      libraryGrid.appendChild(sentinel);
      const obs = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          obs.disconnect();
          generateRenderLibraryGrid(false);
        }
      }, { root: libraryGrid, threshold: 0.1 });
      obs.observe(sentinel);
    }
  } else if (sentinel) {
    sentinel.remove();
  }
  generateUpdateLibraryToolbar();
}

function generateCloseLibraryPreview() {
  const { libraryPreview } = generateEls();
  if (libraryPreview) {
    libraryPreview.classList.add('is-hidden');
    libraryPreview.setAttribute('aria-hidden', 'true');
  }
}

async function generateOpenLibraryPreview(libId) {
  const { libraryPreview, libraryPreviewImg, libraryPreviewTitle, libraryPreviewActions } = generateEls();
  if (!libraryPreview || !libraryPreviewImg) return;
  try {
    const res = await fetch(generateGhostUrl(`/api/library/${encodeURIComponent(libId)}`));
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.item) throw new Error(data?.error || 'فشل التحميل');
    const item = data.item;
    const previewSrc = generateLibraryImageUrl({ ...item, id: libId });
    const designLabel = item.designTotal > 1 ? ` — تصميم ${item.designIndex}/${item.designTotal}` : '';
    libraryPreviewTitle.textContent = `${generateLibraryDisplayLabel(item, { maxLen: 80, withHints: false }) || 'تصميم'}${item.batchTotal > 1 ? ` — دفعة ${item.batchIndex}/${item.batchTotal}` : ''}${designLabel}`;
    libraryPreviewTitle.dataset.libId = libId;
    libraryPreviewImg.src = previewSrc;
    libraryPreviewImg.alt = item.promptPreview || '';
    libraryPreviewImg.onerror = () => {
      const fileSrc = generateLibraryFileUrl({ ...item, id: libId });
      if (fileSrc && libraryPreviewImg.src !== fileSrc) libraryPreviewImg.src = fileSrc;
    };
    libraryPreviewImg.onclick = () => {
      const items = generateBuildLibraryLightboxItems();
      const idx = items.findIndex((it) => it.libraryId === libId);
      generateOpenLightbox(previewSrc, libraryPreviewImg.alt, {
        items,
        index: idx >= 0 ? idx : 0,
        context: 'library'
      });
    };
    const libRetryCtx = {
      prompt: String(item.prompt || item.promptPreview || '').trim(),
      builtPrompt: '',
      useBuiltPrompt: false,
      referenceDataUrl: '',
      mode: 'auto',
      count: '4',
      quality: 'balanced',
      style: 'auto'
    };
    let previewThumbRow = libraryPreview.querySelector('.generate-library-preview-thumb-actions');
    if (!previewThumbRow) {
      previewThumbRow = document.createElement('div');
      previewThumbRow.className = 'generate-library-preview-thumb-actions';
      libraryPreviewImg.insertAdjacentElement('afterend', previewThumbRow);
    }
    previewThumbRow.innerHTML = '';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'generate-thumb-btn generate-retry-btn';
    retryBtn.textContent = 'إعادة المحاولة';
    retryBtn.addEventListener('click', () => generateRetryFromContext(libRetryCtx));
    const dlOne = document.createElement('button');
    dlOne.type = 'button';
    dlOne.className = 'generate-thumb-btn generate-dl-btn';
    dlOne.textContent = 'تحميل PNG';
    dlOne.addEventListener('click', () => {
      void generateDownloadLibraryPng({ ...item, id: libId, storageId: item.storageId || libId.replace(/__d\d+$/, '') });
    });
    previewThumbRow.appendChild(retryBtn);
    previewThumbRow.appendChild(dlOne);
    if (libraryPreviewActions) {
      libraryPreviewActions.innerHTML = '';
      const sendStudio = document.createElement('button');
      sendStudio.type = 'button';
      sendStudio.className = 'generate-dl-btn generate-lib-send-one-btn';
      sendStudio.textContent = '🍌 إرسال إلى Peel Banana → TeeMaster';
      sendStudio.addEventListener('click', async () => {
        sendStudio.disabled = true;
        try {
          generateLibrarySelected.clear();
          generateLibrarySelected.add(libId);
          await generateSendLibrarySelectedToStudio();
        } finally {
          sendStudio.disabled = false;
        }
      });
      libraryPreviewActions.appendChild(sendStudio);
      (item.files || []).forEach((f) => {
        const a = document.createElement('button');
        a.type = 'button';
        a.className = 'generate-dl-btn';
        a.textContent = generateNormalizeLibraryFileName(f.name, item.designIndex || 1);
        a.addEventListener('click', () => {
          void generateDownloadLibraryPng({
            ...item,
            id: libId,
            storageId: item.storageId || libId.replace(/__d\d+$/, ''),
            fileName: f.name
          });
        });
        libraryPreviewActions.appendChild(a);
      });
    }
    libraryPreview.classList.remove('is-hidden');
    libraryPreview.setAttribute('aria-hidden', 'false');
  } catch (err) {
    generateHelpers.showToast?.(`❌ ${err.message || 'فشل المعاينة'}`);
  }
}

async function generateFetchLibraryIndexFromServer() {
  const res = await fetch(generateGhostUrl('/api/library'));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.items) ? data.items : [])
    .filter(generateLibraryItemIsRenderable);
}

async function generateTryReconcileLibraryIndex() {
  try {
    const res = await fetch(generateGhostUrl('/api/library/reconcile'), { method: 'POST' });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch (_) {
    return null;
  }
}

function generatePreserveLibraryCacheOnEmptyServer() {
  const localItems = generateDedupeLibraryItems(generateLoadLibraryIndexLocal());
  const memoryItems = generateDedupeLibraryItems(generateLibraryItems);
  return memoryItems.length ? memoryItems : localItems;
}

async function generateFetchLibrary(options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 0;
  const minCount = Number.isFinite(options.minCount) ? options.minCount : 0;
  const force = options.force === true;
  const attempts = Math.max(1, retries + 1);
  const prevCount = generateLibraryItems.length;

  loadSavedLibraryDesigns({
    render: generateActiveSection === 'library',
    mergeIntoMemory: true
  });

  let items = [];
  let fetchFailed = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, GENERATE_LIBRARY_FETCH_RETRY_MS * attempt));
    }
    try {
      items = await generateFetchLibraryIndexFromServer();
      fetchFailed = false;
      if (items.length >= minCount || attempt === attempts - 1) break;
    } catch (_) {
      fetchFailed = true;
      items = [];
    }
  }

  if (fetchFailed && !items.length) {
    generateLibraryItems = generateDedupeLibraryItems(generateLoadLibraryIndexLocal());
    generateRenderLibraryGrid(true);
    if (generateActiveSection === 'history' && generateGalleryRaw.length) {
      generateRenderGallery(generateGalleryRaw);
    }
    return generateLibraryItems;
  }

  if (!items.length && (prevCount > 0 || generateLibraryItems.length > 0) && minCount > 0) {
    generateRenderLibraryGrid(true);
    return generateLibraryItems;
  }

  if (!items.length && !fetchFailed && !force) {
    const preserved = generatePreserveLibraryCacheOnEmptyServer();
    if (preserved.length > 0) {
      const reconciled = await generateTryReconcileLibraryIndex();
      if (reconciled?.report?.totalDesigns > 0) {
        try {
          items = await generateFetchLibraryIndexFromServer();
        } catch (_) { /* keep preserved */ }
      }
      if (!items.length) {
        generateLibraryItems = preserved;
        generateRenderLibraryGrid(true);
        const warn = generateHelpers.showWarnToast || generateHelpers.showToast;
        warn?.('⚠️ Ghost يعرض مكتبة فارغة — التصاميم محفوظة محلياً. أعد تشغيل Ghost من مجلد الإضافة الحالي (Generate → إعادة تشغيل Ghost Server).');
        return generateLibraryItems;
      }
    } else {
      generateLibraryItems = [];
      generateSaveLibraryIndexLocal([]);
      generateRenderLibraryGrid(true);
      if (generateActiveSection === 'history' && generateGalleryRaw.length) {
        generateRenderGallery(generateGalleryRaw);
      }
      return generateLibraryItems;
    }
  }

  if (items.length) {
    // Server index is authoritative — do not re-merge stale localStorage orphans after delete.
    generateLibraryItems = generateDedupeLibraryItems(items);
    generateSaveLibraryIndexLocal(generateLibraryItems);
  } else if (force) {
    const preserved = generatePreserveLibraryCacheOnEmptyServer();
    if (preserved.length) {
      generateLibraryItems = preserved;
    } else {
      generateLibraryItems = [];
      generateSaveLibraryIndexLocal([]);
    }
  }

  generateRenderLibraryGrid(true);
  if (generateActiveSection === 'history' && generateGalleryRaw.length) {
    generateRenderGallery(generateGalleryRaw);
  }
  return generateLibraryItems;
}

/**
 * Refresh library grid after generation (works even on chat tab).
 * @returns {Promise<{ ok: boolean, count: number, error?: string }>}
 */
async function generateRefreshLibraryAfterGeneration({ expectedMin = 4, tabId = null } = {}) {
  const beforeLen = generateLibraryItems.length;
  try {
    await generateFetchLibrary({
      retries: GENERATE_LIBRARY_FETCH_RETRY_MAX,
      minCount: 1
    });
    const delta = Math.max(0, generateLibraryItems.length - beforeLen);
    const count = delta > 0 ? delta : Math.max(expectedMin, generateLibraryItems.length - beforeLen);
    const showToast = tabId == null || tabId === generateActiveTabId;
    if (showToast && generateLibraryItems.length > 0) {
      generateHelpers.showToast?.(`تم الحفظ في المكتبة (${count > 0 ? count : generateLibraryItems.length})`);
    }
    return { ok: generateLibraryItems.length > 0, count: count > 0 ? count : generateLibraryItems.length };
  } catch (err) {
    return { ok: false, count: 0, error: err?.message || 'فشل تحميل المكتبة' };
  }
}

async function generateDownloadLibrarySelected() {
  const ids = [...generateLibrarySelected];
  if (!ids.length) return;
  const items = ids
    .map((id) => generateLibraryItems.find((it) => it.id === id))
    .filter(Boolean);
  const { ok, fail } = await generateDownloadLibraryBatch(items);
  if (ok > 0) {
    generateHelpers.showToast?.(
      fail > 0
        ? `✅ تم تحميل ${ok} PNG — فشل ${fail}`
        : `✅ تم تحميل ${ok} تصميم PNG`
    );
  } else {
    generateHelpers.showToast?.('⚠️ تعذّر تحميل التصاميم المحددة');
  }
}

function generateSelectLibraryFirstN(count) {
  const n = Math.max(0, Math.min(parseInt(String(count || '0'), 10) || 0, generateLibraryItems.length));
  generateLibrarySelected.clear();
  for (let i = 0; i < n; i += 1) {
    generateLibrarySelected.add(generateLibraryItems[i].id);
  }
  generateRenderLibraryGrid(true, true);
}

function generateSelectAllLibrary(selectAll) {
  generateLibrarySelected.clear();
  if (selectAll) {
    generateLibraryItems.forEach((item) => generateLibrarySelected.add(item.id));
  }
  generateRenderLibraryGrid(true, true);
}

async function generateDownloadLibraryAll() {
  const items = generateLibraryItems.length ? generateLibraryItems : await generateFetchLibrary();
  if (!items.length) {
    generateHelpers.showToast?.('المكتبة فارغة');
    return;
  }
  const { ok, fail, total } = await generateDownloadLibraryBatch(items);
  if (ok > 0) {
    generateHelpers.showToast?.(
      fail > 0
        ? `✅ تم تحميل ${ok}/${total} PNG — فشل ${fail}`
        : `✅ تم تحميل ${ok} تصميم PNG`
    );
  } else {
    generateHelpers.showToast?.('⚠️ تعذّر تحميل التصاميم');
  }
}

async function generateDeleteLibraryOne(id) {
  if (!id) return;
  if (!confirm('حذف هذا التصميم من المكتبة؟')) return;
  try {
    const res = await fetch(generateGhostUrl(`/api/library/${encodeURIComponent(id)}`), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'فشل الحذف');
    generateRemoveLibraryItemsLocal(id);
    const previewTitle = generateEls().libraryPreviewTitle;
    if (previewTitle?.dataset?.libId === id) generateCloseLibraryPreview();
    await generateFetchLibrary();
    generateHelpers.showToast?.('تم حذف التصميم');
  } catch (err) {
    generateHelpers.showToast?.(`❌ ${err.message || 'فشل الحذف'}`);
  }
}

async function generateDeleteLibrarySelected() {
  const ids = [...generateLibrarySelected];
  if (!ids.length) return;
  if (!confirm(`حذف ${ids.length} تصميم من المكتبة؟`)) return;
  try {
    const res = await fetch(generateGhostUrl('/api/library/bulk'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'فشل الحذف');
    generateRemoveLibraryItemsLocal(ids);
    generateCloseLibraryPreview();
    await generateFetchLibrary();
    generateHelpers.showToast?.(`تم حذف ${data.count || ids.length} تصميم`);
  } catch (err) {
    generateHelpers.showToast?.(`❌ ${err.message || 'فشل الحذف'}`);
  }
}

async function generateDeleteLibraryAll() {
  if (!generateLibraryItems.length) {
    generateHelpers.showToast?.('المكتبة فارغة');
    return;
  }
  const decision = await generateShowConfirm(
    `هل تريد تفريغ المكتبة المحلية (${generateLibraryItems.length} تصميم)؟\n\nالافتراضي: حذف محلي فقط — لن يُمس موقع EmailCore.`,
    {
      checkboxLabel: 'أيضاً احذف التصاميم من موقع EmailCore (اختياري — غير مفعّل افتراضياً)',
      checkboxDefault: false,
      returnDetails: true
    }
  );
  if (!decision?.ok) return;
  const siteIds = generateLibraryItems
    .map((it) => String(it.siteDesignId || (/^dsg_/i.test(String(it.originalDesignId || '')) ? it.originalDesignId : '') || '').trim())
    .filter(Boolean);
  try {
    const res = await fetch(generateGhostUrl('/api/library/all'), { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || 'فشل التفريغ');
    generateLibraryItems = [];
    generateLibrarySelected.clear();
    generateSaveLibraryIndexLocal([]);
    generateCloseLibraryPreview();
    await generateFetchLibrary({ force: true, retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
    if (decision.checked && siteIds.length) {
      try {
        await chrome.runtime.sendMessage({
          action: 'EMAILCORE_DELETE_SITE_DESIGNS',
          ids: siteIds
        });
        generateHelpers.showToast?.('تم تفريغ المكتبة المحلية + طلب حذف من الموقع');
      } catch (_) {
        generateHelpers.showToast?.('تم التفريغ محلياً — تعذّر حذف الموقع');
      }
    } else {
      if (siteIds.length) {
        try {
          await chrome.runtime.sendMessage({
            action: 'EMAILCORE_LIVE_SYNC_DISMISS',
            ids: siteIds
          });
        } catch (_) { /* ignore */ }
      }
      generateHelpers.showToast?.('تم تفريغ المكتبة المحلية فقط (الموقع لم يُمس)');
    }
  } catch (err) {
    generateHelpers.showToast?.(`❌ ${err.message || 'فشل التفريغ'}`);
  }
}

function generateNormalizeQueueConcurrency(raw) {
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return GENERATE_QUEUE_CONCURRENCY_DEFAULT;
}

function generateGetStoredQueueConcurrency() {
  const raw = localStorage.getItem(GENERATE_QUEUE_CONCURRENCY_KEY);
  return generateNormalizeQueueConcurrency(raw);
}

/** حد POST /api/generate المتزامن (افتراضي 2؛ إعداد المستخدم 2|3) */
function generateGetQueueConcurrency() {
  if (generateQueueConcurrencyOverride === 1) return 1;
  return generateGetStoredQueueConcurrency();
}

function generateApplyQueueConcurrencySetting(value) {
  const n = generateNormalizeQueueConcurrency(value);
  localStorage.setItem(GENERATE_QUEUE_CONCURRENCY_KEY, String(n));
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [GENERATE_QUEUE_CONCURRENCY_KEY]: n });
    }
  } catch (_) { /* ignore */ }
  generateQueueConcurrencyOverride = null;
  generateQueueTimeoutTimestamps = [];
  const { queueConcurrency } = generateEls();
  if (queueConcurrency) queueConcurrency.value = String(n);
  generateRefreshQueueUi();
  void generateProcessGenerateQueue();
}

function generateLoadQueueConcurrencySetting() {
  const apply = (raw) => {
    const n = generateNormalizeQueueConcurrency(raw);
    localStorage.setItem(GENERATE_QUEUE_CONCURRENCY_KEY, String(n));
    const { queueConcurrency } = generateEls();
    if (queueConcurrency) queueConcurrency.value = String(n);
  };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([GENERATE_QUEUE_CONCURRENCY_KEY], (res) => {
        const stored = res?.[GENERATE_QUEUE_CONCURRENCY_KEY];
        apply(stored != null ? stored : localStorage.getItem(GENERATE_QUEUE_CONCURRENCY_KEY));
      });
      return;
    }
  } catch (_) { /* ignore */ }
  apply(localStorage.getItem(GENERATE_QUEUE_CONCURRENCY_KEY));
}

function generateGetSelectedAiProvider() {
  return generateNormalizeAiProvider(generateEls().mode?.value || 'auto');
}

/** Gemini fallback applies only when mode=auto and the toggle is on. */
function generateShouldAutoFallbackGemini(provider) {
  const p = generateNormalizeAiProvider(provider ?? generateGetSelectedAiProvider());
  if (p !== 'auto') return false;
  return generateGetAutoFallbackGeminiEnabled();
}

function generateUpdateAutoFallbackUiForMode(provider) {
  const p = generateNormalizeAiProvider(provider ?? generateGetSelectedAiProvider());
  const { autoFallbackGemini, autoFallbackWrap } = generateEls();
  const wrap = autoFallbackWrap || autoFallbackGemini?.closest('.generate-setting');
  if (wrap) wrap.hidden = p !== 'auto';
  if (autoFallbackGemini) autoFallbackGemini.disabled = p !== 'auto';
}

function generateGetAutoFallbackGeminiEnabled() {
  const raw = localStorage.getItem(GENERATE_AUTO_FALLBACK_GEMINI_KEY);
  if (raw === null || raw === undefined || raw === '') return true;
  const v = String(raw).trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
}

function generateApplyAutoFallbackGeminiSetting(enabled) {
  const on = enabled !== false;
  localStorage.setItem(GENERATE_AUTO_FALLBACK_GEMINI_KEY, on ? '1' : '0');
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [GENERATE_AUTO_FALLBACK_GEMINI_KEY]: on ? '1' : '0' });
    }
  } catch (_) { /* ignore */ }
  const { autoFallbackGemini } = generateEls();
  if (autoFallbackGemini) autoFallbackGemini.checked = on;
  return on;
}

function generateLoadAutoFallbackGeminiSetting() {
  const apply = (raw) => {
    if (raw === null || raw === undefined || raw === '') {
      generateApplyAutoFallbackGeminiSetting(true);
      return true;
    }
    const on = !(String(raw).trim().toLowerCase() === '0'
      || String(raw).trim().toLowerCase() === 'false'
      || String(raw).trim().toLowerCase() === 'off'
      || String(raw).trim().toLowerCase() === 'no');
    generateApplyAutoFallbackGeminiSetting(on);
    return on;
  };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([GENERATE_AUTO_FALLBACK_GEMINI_KEY], (res) => {
        const stored = res?.[GENERATE_AUTO_FALLBACK_GEMINI_KEY];
        apply(stored != null ? stored : localStorage.getItem(GENERATE_AUTO_FALLBACK_GEMINI_KEY));
      });
      return apply(localStorage.getItem(GENERATE_AUTO_FALLBACK_GEMINI_KEY));
    }
  } catch (_) { /* ignore */ }
  return apply(localStorage.getItem(GENERATE_AUTO_FALLBACK_GEMINI_KEY));
}

function generateRecordQueueTimeoutHit() {
  const now = Date.now();
  generateQueueTimeoutTimestamps = generateQueueTimeoutTimestamps.filter(
    (t) => now - t < GENERATE_QUEUE_TIMEOUT_FALLBACK_MS
  );
  generateQueueTimeoutTimestamps.push(now);
  if (
    generateQueueTimeoutTimestamps.length >= GENERATE_QUEUE_TIMEOUT_FALLBACK_COUNT
    && generateGetQueueConcurrency() > 1
  ) {
    generateQueueTimeoutTimestamps = [];
    generateQueueConcurrencyOverride = 1;
    const warn = generateHelpers.showWarnToast || generateHelpers.showToast;
    warn?.('⚠️ تخفيض تزامن الطابور إلى 1 بسبب تكرار المهلات');
    void generateProcessGenerateQueue();
  }
}

function generateGetJobQueueWaitPosition(jobId) {
  if (!jobId) return 0;
  if (generateQueueActiveJobIds.has(jobId)) return 0;
  const pending = generateJobQueue.filter((j) => !j.aborted);
  const waiters = pending.filter((j) => !generateQueueActiveJobIds.has(j.id));
  const idx = waiters.findIndex((j) => j.id === jobId);
  return idx >= 0 ? idx + 1 : 0;
}

function generateGetQueueWaiterCount() {
  return generateJobQueue.filter((j) => !j.aborted && !generateQueueActiveJobIds.has(j.id)).length;
}

function generateRefreshQueueUi() {
  for (const job of generateJobQueue) {
    if (job.aborted || generateQueueActiveJobIds.has(job.id)) continue;
    const session = generateGetSession(job.tabId);
    if (!session?.generationQueued) continue;
    const pos = generateGetJobQueueWaitPosition(job.id);
    generateSetStatus(pos > 0 ? `في الطابور (${pos})` : 'في الطابور', false, job.tabId);
  }
  const waiters = generateGetQueueWaiterCount();
  const active = generateQueueActiveJobIds.size;
  const max = generateGetQueueConcurrency();
  const badge = generateEls().queueBadge;
  if (badge) {
    if (waiters > 0 || active > 0) {
      const parts = [];
      if (waiters > 0) parts.push(`طابور: ${waiters}`);
      if (active > 0) parts.push(`نشط: ${active}/${max}`);
      badge.textContent = parts.join(' · ');
      badge.hidden = false;
    } else {
      badge.textContent = '';
      badge.hidden = true;
    }
  }
  generateRenderTabBar();
}

function generateCancelQueuedJob(tabId) {
  const session = generateGetSession(tabId);
  if (!session?.generationQueued || !session.queueJobId) return false;
  const jobId = session.queueJobId;
  const job = generateJobQueue.find((j) => j.id === jobId);
  if (job) job.aborted = true;
  generateJobQueue = generateJobQueue.filter((j) => j.id !== jobId);
  session.generationQueued = false;
  session.queueJobId = null;
  generateSetStatus('تم إلغاء الانتظار في الطابور', false, tabId);
  if (tabId === generateActiveTabId) {
    const { root } = generateEls();
    if (root) root.classList.remove('is-queued');
    generateUpdateSubmitButton(false);
  }
  generateRefreshQueueUi();
  if (tabId === generateActiveTabId) {
    generateHelpers.showToast?.('⏹ تم إلغاء الانتظار في الطابور');
  }
  return true;
}

/**
 * إدراج مهمة توليد في الطابور العالمي (FIFO) — حتى N طلبات POST نشطة.
 * @returns {string|null} معرّف المهمة أو null عند الرفض
 */
function enqueueGenerateJob(opts = {}) {
  if (opts?.skipBusyGuard) {
    void generateExecuteGenerationNow(opts);
    return null;
  }
  const tabId = opts.tabId ?? generateActiveTabId;
  const session = generateGetSession(tabId);
  if (!session) return null;

  generateClearStaleTabBusy(tabId);
  if (session.generationBusy || session.generationQueued) {
    generateHelpers.showToast?.('⚠️ هذا التبويب يولّد أو في الطابور بالفعل');
    return null;
  }

  const job = {
    id: `gq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tabId,
    params: { ...opts, tabId },
    aborted: false
  };
  generateJobQueue.push(job);
  session.generationQueued = true;
  session.queueJobId = job.id;
  const pos = generateGetJobQueueWaitPosition(job.id);
  generateSetStatus(pos > 1 ? `في الطابور (${pos})` : 'في الطابور', false, tabId);
  if (tabId === generateActiveTabId) {
    const { root } = generateEls();
    if (root) root.classList.add('is-queued');
    generateUpdateSubmitButton(true);
  }
  generateRefreshQueueUi();
  void generateProcessGenerateQueue();
  return job.id;
}

function generateProcessGenerateQueue() {
  generateJobQueue = generateJobQueue.filter((j) => !j.aborted);
  const limit = generateGetQueueConcurrency();
  while (generateQueueActiveJobIds.size < limit) {
    const next = generateJobQueue.find(
      (j) => !j.aborted && !generateQueueActiveJobIds.has(j.id)
    );
    if (!next) break;
    generateQueueActiveJobIds.add(next.id);
    void generateRunQueuedJob(next);
  }
  generateRefreshQueueUi();
}

async function generateRunQueuedJob(next) {
  try {
    const session = generateGetSession(next.tabId);
    if (session) {
      session.generationQueued = false;
      session.queueJobId = null;
    }
    if (next.tabId === generateActiveTabId) {
      const { root } = generateEls();
      if (root) root.classList.remove('is-queued');
    }
    generateRefreshQueueUi();
    try {
      await generateExecuteGenerationNow(next.params);
    } catch (err) {
      const msg = err?.message || String(err || '');
      if (generateIsTimeoutError(msg)) generateRecordQueueTimeoutHit();
      console.warn('[Generate] queue job error', err);
    }
  } finally {
    generateQueueActiveJobIds.delete(next.id);
    generateJobQueue = generateJobQueue.filter((j) => j.id !== next.id);
    generateRefreshQueueUi();
    generateProcessGenerateQueue();
  }
}

async function generateExecuteGeneration(opts = {}) {
  if (opts?.skipBusyGuard) {
    return generateExecuteGenerationNow(opts);
  }
  enqueueGenerateJob(opts);
}

function generateResolveLibraryDisplayName(opts = {}, primary = null) {
  const pick = (raw) => {
    const cleaned = stripPipelineNameNoise(raw);
    if (!cleaned || isPipelineTempFileStem(cleaned)) return '';
    if (typeof globalThis.NHP_isLegacyRadarBagName === 'function' && globalThis.NHP_isLegacyRadarBagName(cleaned)) {
      return '';
    }
    return cleaned;
  };
  const explicit = pick(opts.libraryDisplayName);
  if (explicit) return explicit;
  const candidates = [
    opts.name,
    primary?.sourceName,
    primary?.name,
    opts.referenceFile?.name,
    primary?.file?.name
  ];
  for (const candidate of candidates) {
    const fromFile = pick(nicheTitleFromFileName(candidate) || candidate);
    if (fromFile) return fromFile;
  }
  return '';
}

async function generateExecuteGenerationNow({
  prompt = '',
  builtPrompt = '',
  useBuiltPrompt = false,
  referenceFile = null,
  referenceDataUrl = '',
  mode = 'auto',
  count = '2',
  quality = 'balanced',
  style = 'auto',
  appendUser = true,
  userImageUrl = '',
  retryContext = null,
  tabId = generateActiveTabId,
  libraryDisplayName: libraryDisplayNameOpt = '',
  name = '',
  /** إعادة محاولة داخلية (اتصال/مهلة) — لا ترفض لأن generationBusy ما زال true */
  skipBusyGuard = false
} = {}) {
  const session = generateGetSession(tabId);
  if (!session) return;
  generateClearStaleTabBusy(tabId);
  if (!skipBusyGuard && session.generationBusy) {
    generateHelpers.showToast?.('⚠️ هذا التبويب يولّد بالفعل');
    return;
  }

  const labelSource = String(prompt || '').trim()
    || (referenceFile?.name || '')
    || (userImageUrl || referenceDataUrl ? 'صورة' : '');
  if (labelSource) generateUpdateSessionLabel(tabId, labelSource);

  return generateWithTabAsync(tabId, async () => {
  const els = generateEls();
  const primary = referenceFile ? { file: referenceFile, previewUrl: referenceDataUrl || userImageUrl || '' } : generateGetPrimaryPendingImage();
  const hasImage = !!primary?.file;
  const pendingPreviewUrls = generatePendingImages.map((i) => i.previewUrl).filter(Boolean);
  const bubbleImageUrls = pendingPreviewUrls.length
    ? pendingPreviewUrls
    : (userImageUrl || referenceDataUrl ? [userImageUrl || referenceDataUrl] : []);
  const effectivePrompt = String(prompt || '').trim();
  const ctx = retryContext ? { ...retryContext } : {
    prompt: effectivePrompt,
    builtPrompt: String(builtPrompt || '').trim(),
    useBuiltPrompt: !!useBuiltPrompt,
    referenceDataUrl: referenceDataUrl || '',
    mode,
    count: String(count),
    quality,
    style
  };
  if (!Array.isArray(ctx.pendingImageUrls) || !ctx.pendingImageUrls.length) {
    ctx.pendingImageUrls = pendingPreviewUrls.length
      ? [...pendingPreviewUrls]
      : (ctx.referenceDataUrl ? [ctx.referenceDataUrl] : []);
  }
  if (hasImage && !ctx.referenceDataUrl) {
    ctx.referenceDataUrl = referenceDataUrl || primary?.previewUrl || userImageUrl || '';
  }
  ctx.tabId = tabId;

  if (!effectivePrompt && !hasImage && !ctx.useBuiltPrompt) {
    generateSetStatus('أدخل وصفاً أو ارفع صورة على الأقل', true, tabId);
    generateHelpers.showToast?.('⚠️ الوصف أو الصورة مطلوب');
    return;
  }

  const aiProvider = generateNormalizeAiProvider(mode || ctx.mode || generateEls().mode?.value || 'auto');
  const preflight = await generatePreflightBeforeGenerate(aiProvider, { statusTabId: tabId });
  if (!preflight.ok) {
    generateSetStatus(preflight.message, true, tabId);
    generateHelpers.showToast?.(`❌ ${preflight.message}`);
    generateAppendErrorMessage(preflight.message, ctx, tabId);
    generateSaveChatSnapshot(tabId);
    return;
  }
  if (preflight.warn && preflight.message) {
    generateSetStatus(preflight.message, false, tabId);
    if (tabId === generateActiveTabId) {
      generateHelpers.showWarnToast?.(`⚠️ ${preflight.message}`)
        || generateHelpers.showToast?.(`⚠️ ${preflight.message}`, 4000);
    }
  }

  if (appendUser) {
    generateAppendUserMessage({ text: effectivePrompt, imageUrls: bubbleImageUrls, tabId });
    if (tabId === generateActiveTabId && els.prompt) {
      els.prompt.value = '';
      generateAutoResizeInput();
      generatePersistComposerToSession(tabId);
    } else if (session) {
      session.composer.prompt = '';
    }
  }

  generateSetLoading(true, tabId);
  session.cancelled = false;
  session._cancelHandled = false;
  const abortController = new AbortController();
  generateTabAbortState.set(tabId, { controller: abortController, jobId: null, pollTimer: null });
  const abortSignal = abortController.signal;
  const editedAuto = String(builtPrompt || ctx.builtPrompt || '').trim();
  const skipVision = hasImage && (useBuiltPrompt || ctx.useBuiltPrompt) && editedAuto;
  const designCount = Number(count || ctx.count) || 2;
  const totalBatchesExpected = designCount >= 12 ? 3 : designCount >= 8 ? 2 : 1;
  const batchStageStart = totalBatchesExpected > 1
    ? `الدفعة 1/${totalBatchesExpected} — توليد...`
    : `توليد ${designCount} تصاميم في صورة واحدة...`;
  const initialStage = skipVision
    ? batchStageStart
    : (hasImage ? 'تحضير الصورة وتحليلها...' : batchStageStart);
  generateSetStatus(initialStage, false, tabId);
  generateShowTypingIndicator(initialStage, tabId);

  const form = new FormData();
  if (hasImage) {
    const sendQuality = quality || ctx.quality || 'balanced';
    let sendFile = primary.file;
    try {
      const recompressed = await generateCompressImageForSend(sendFile, sendQuality);
      sendFile = recompressed.file;
      const resizeMsg = generateFormatImageResizeStatus(recompressed, { forSend: true });
      if (resizeMsg) {
        generateSetStatus(resizeMsg, false, tabId);
        if (tabId === generateActiveTabId) {
          generateHelpers.showToast?.(resizeMsg);
        }
      }
    } catch (compressErr) {
      console.warn('[Generate] compression failed, sending original file', compressErr);
      sendFile = primary.file;
      const compressWarn = 'تعذّر ضغط الصورة — يُرسل الملف الأصلي';
      generateSetStatus(compressWarn, false, tabId);
      if (tabId === generateActiveTabId) {
        generateHelpers.showWarnToast?.(`⚠️ ${compressWarn}`)
          || generateHelpers.showToast?.(`⚠️ ${compressWarn}`, 3500);
      }
    }
    form.append('image', sendFile, sendFile.name || 'reference.jpg');
    if ((useBuiltPrompt || ctx.useBuiltPrompt) && editedAuto) {
      form.append('builtPrompt', editedAuto);
      form.append('useBuiltPrompt', '1');
    } else if (effectivePrompt) {
      form.append('prompt', effectivePrompt);
    }
  } else if (effectivePrompt) {
    form.append('prompt', effectivePrompt);
  }
  form.append('mode', aiProvider);
  form.append('aiProvider', aiProvider);
  form.append('count', String(count || ctx.count || '2'));
  form.append('quality', quality || ctx.quality || 'balanced');
  form.append('styleMode', style || ctx.style || 'auto');
  const visionStyleList = generateGetEffectiveVisionStyleList();
  if (visionStyleList.length) {
    form.append('styleList', JSON.stringify(visionStyleList));
  }
  const customSystemPrompt = generateGetCustomSystemPromptForApi();
  if (customSystemPrompt) {
    form.append('systemPrompt', customSystemPrompt);
    form.append('customInstructions', customSystemPrompt);
  }

  const proxyKeys = await generateGetCliProxyAiKeys(aiProvider);
  generateAppendApiCredentialsToForm(form, proxyKeys, aiProvider);
  const renameNoteContext = await generateGetNoteRenameContext(40);
  if (renameNoteContext.length) {
    form.append('renameNoteContext', JSON.stringify(renameNoteContext));
  }
  const libraryDisplayName = generateResolveLibraryDisplayName(
    { libraryDisplayName: libraryDisplayNameOpt, referenceFile, name },
    primary
  );
  if (libraryDisplayName) {
    form.append('libraryDisplayName', libraryDisplayName);
    ctx.libraryDisplayName = libraryDisplayName;
  } else if (ctx.libraryDisplayName && isPipelineTempFileStem(ctx.libraryDisplayName)) {
    ctx.libraryDisplayName = '';
  }
  form.append('autoFallbackGemini', generateShouldAutoFallbackGemini(aiProvider) ? '1' : '0');

  const generateEndpoint = generateGhostUrl('/api/generate');
  try {
    const fetchHeaders = generateBuildApiCredentialHeaders(proxyKeys, aiProvider);
    const res = await fetch(generateEndpoint, {
      method: 'POST',
      body: form,
      headers: fetchHeaders,
      signal: abortSignal
    });
    const data = await res.json().catch(() => ({}));
    if (session.cancelled || abortSignal.aborted) {
      throw Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true });
    }
    if (!res.ok || !data?.success) {
      const err = generateHumanizeCliProxyError(data?.error || `HTTP ${res.status}`);
      const hint = data?.hint ? ` — ${data.hint}` : '';
      const endpointHint = res.status === 404
        ? ' — المسار غير مسجّل؛ أعد تشغيل ghost-server.js على المنفذ 3019'
        : '';
      throw new Error(`${err}${hint}${endpointHint} @ ${generateEndpoint}`);
    }

    let resultData = data;
    let autoPromptShown = false;

    if (data.status === 'running' && data.jobId) {
      generateRegisterJobTab(data.jobId, tabId);
      const abortState = generateTabAbortState.get(tabId);
      if (abortState) abortState.jobId = data.jobId;
      let chatBatchesRendered = 0;
      const polled = await generatePollJob(data.jobId, {
        aiProvider,
        onBatch: ({ batchIndex, totalBatches, images: batchImages, job }) => {
          if (session.cancelled) return;
          const autoText = batchIndex === 1 && !autoPromptShown
            ? (job.autoGeneratedPrompt || job.autoGeneratedPromptPreview || '')
            : '';
          if (autoText) {
            generateShowAutoPrompt(autoText, { editable: true, tabId });
            ctx.builtPrompt = autoText;
            ctx.useBuiltPrompt = true;
            autoPromptShown = true;
          }
          const batchMeta = totalBatches > 1
            ? `الدفعة ${batchIndex}/${totalBatches} · شبكة 2×2 (4 تصاميم)`
            : 'شبكة 2×2 · 4 تصاميم';
          const batchRetryCtx = {
            ...ctx,
            count: '4',
            batchIndex,
            batchTotal: totalBatches
          };
          generateAppendAssistantMessage({
            images: batchImages,
            autoPrompt: batchIndex === 1 ? autoText : '',
            meta: batchMeta,
            retryContext: batchRetryCtx,
            batchTotal: totalBatches,
            tabId
          });
          chatBatchesRendered += 1;
          generateSaveChatSnapshot(tabId);
          if (tabId === generateActiveTabId) {
            generateHelpers.showToast?.(`✅ ${batchMeta}`);
          }
          void generateRefreshLibraryAfterGeneration({ expectedMin: 4, tabId });
        }
      }, 720000, tabId, abortSignal);
      if (session.cancelled) {
        throw Object.assign(new DOMException('Cancelled', 'AbortError'), { cancelled: true });
      }
      const job = polled.job || {};
      resultData = {
        success: true,
        jobId: data.jobId,
        visionUsed: !!job.visionUsed,
        fallbackFrom: job.fallbackFrom || null,
        modelUsed: job.modelUsed || job.model || null,
        images: (polled.files || []).map((f, i) => ({
          index: i + 1,
          filename: f.filename,
          url: f.url,
          dataUrl: f.dataUrl || ''
        })),
        totalBatches: job.totalBatches || totalBatchesExpected
      };
      if (job.fallbackFrom && generateShouldAutoFallbackGemini(aiProvider) && tabId === generateActiveTabId) {
        generateHelpers.showToast?.('✅ تم التوليد عبر Gemini (بعد فشل ChatGPT)');
      }
      if (!chatBatchesRendered && resultData.images.length) {
        const autoFromJob = String(job.autoGeneratedPrompt || job.autoGeneratedPromptPreview || '').trim();
        if (autoFromJob && !autoPromptShown) {
          generateShowAutoPrompt(autoFromJob, { editable: true, tabId });
          ctx.builtPrompt = autoFromJob;
          ctx.useBuiltPrompt = true;
        }
        const batchTotal = resultData.totalBatches || 1;
        generateAppendAssistantMessage({
          images: resultData.images,
          autoPrompt: autoFromJob,
          meta: batchTotal > 1
            ? `${batchTotal} دفعات · شبكة 2×2`
            : 'شبكة 2×2 · 4 تصاميم',
          retryContext: { ...ctx, count: '4' },
          batchTotal,
          tabId
        });
        chatBatchesRendered = resultData.images.length;
        generateSaveChatSnapshot(tabId);
      } else if (!chatBatchesRendered && (job.status === 'done' || polled.files?.length === 0)) {
        const noImgMsg = 'اكتمل التوليد لكن لم تظهر صور في المحادثة — تحقق من تبويب المكتبة، أو أعد تشغيل ghost-server.js على المنفذ 3019، ثم أعد المحاولة.';
        generateAppendErrorMessage(noImgMsg, ctx, tabId);
        generateSaveChatSnapshot(tabId);
      }
    } else {
      const images = Array.isArray(data.images) ? data.images : [];
      if (data.fallbackFrom && generateShouldAutoFallbackGemini(aiProvider) && tabId === generateActiveTabId) {
        generateHelpers.showToast?.('✅ تم التوليد عبر Gemini (بعد فشل ChatGPT)');
      }
      const autoFromSync = String(data.autoGeneratedPrompt || '').trim();
      if (autoFromSync) {
        ctx.builtPrompt = autoFromSync;
        ctx.useBuiltPrompt = true;
        generateShowAutoPrompt(autoFromSync, { editable: true, tabId });
      }
      if (images.length) {
        generateAppendAssistantMessage({
          images,
          autoPrompt: autoFromSync,
          meta: 'شبكة 2×2 · 4 تصاميم',
          retryContext: { ...ctx, count: '4' },
          tabId
        });
        generateSaveChatSnapshot(tabId);
        void generateRefreshLibraryAfterGeneration({ expectedMin: 4, tabId });
      } else if (data.status === 'done' || data.success) {
        const noImgMsg = 'اكتمل الطلب لكن الخادم لم يُرجع ملفات صور — تحقق من CLIProxyAPI (gpt-image-2 + Codex OAuth، أو CLIPROXY_IMAGE_MODEL في .env) ومن تشغيل Ghost.';
        generateAppendErrorMessage(noImgMsg, ctx, tabId);
        generateSaveChatSnapshot(tabId);
      }
    }

    generateRemoveTypingIndicator(tabId);
    const batchCount = resultData.totalBatches || totalBatchesExpected;
    const designTotal = batchCount * 4;
    let statusMsg = batchCount > 1
      ? `تم — ${batchCount} دفعات (${designTotal} تصميم)`
      : 'تم — شبكة 4 تصاميم في صورة واحدة';
    if (resultData.visionUsed) statusMsg += ' · تحليل بصري ✓';
    generateSetStatus(statusMsg, false, tabId);
    generateSaveLocalGallery({
      jobId: resultData.jobId,
      createdAt: new Date().toISOString(),
      promptPreview: (effectivePrompt || editedAuto || '').slice(0, 80),
      thumbnails: (resultData.images || []).map((i) => i.url).filter(Boolean)
    });
    if (tabId === generateActiveTabId) {
      generateHelpers.showToast?.(statusMsg);
    }
    await generateFetchGallery();
    const libRefresh = await generateRefreshLibraryAfterGeneration({
      expectedMin: designTotal,
      tabId
    });
    generateScheduleLibraryNameRefresh();
    if (!libRefresh.ok && (resultData.images?.length || batchCount > 0)) {
      const libErr = 'تم التوليد لكن تعذّر تحديث المكتبة من Ghost — اضغط «تحديث» في تبويب المكتبة أو أعد تشغيل ghost-server.js';
      generateAppendErrorMessage(libErr, ctx, tabId);
      generateSaveChatSnapshot(tabId);
      if (tabId === generateActiveTabId) {
        generateHelpers.showToast?.(`⚠️ ${libErr}`);
      }
    }
  } catch (err) {
    if (session.cancelled || generateIsCancelledError(err)) {
      if (!session._cancelHandled) generateHandleCancelledGeneration(tabId);
      return;
    }
    const proxyKeysForErr = await generateGetCliProxyAiKeys(aiProvider);
    let msg = generateFormatFetchError(err, {
      port: generateResolvedGhostPort || GHOST_PORT,
      proxyBaseUrl: proxyKeysForErr.baseUrl
    });

    if (!ctx._streamRetried && generateIsStreamDisconnectError(msg)) {
      ctx._streamRetried = true;
      generateRemoveTypingIndicator(tabId);
      generateSetStatus('إعادة المحاولة بدون stream...', false, tabId);
      generateHelpers.showToast?.('↻ إعادة المحاولة بعد انقطاع stream (non-stream)...');
      let refFile = referenceFile;
      if (!refFile && ctx.referenceDataUrl) {
        refFile = await generateReferenceDataUrlToFile(ctx.referenceDataUrl, quality || ctx.quality);
      }
      await generateExecuteGenerationNow({
        prompt: effectivePrompt,
        builtPrompt: editedAuto || ctx.builtPrompt,
        useBuiltPrompt: skipVision || ctx.useBuiltPrompt,
        referenceFile: refFile,
        referenceDataUrl: ctx.referenceDataUrl,
        mode: mode || ctx.mode,
        count: String(count || ctx.count),
        quality: quality || ctx.quality,
        style: style || ctx.style,
        appendUser: false,
        userImageUrl: ctx.referenceDataUrl,
        retryContext: ctx,
        tabId,
        skipBusyGuard: true
      });
      return;
    }

    if (!ctx._connectionRetried && generateIsNetworkFetchError(err)) {
      ctx._connectionRetried = true;
      generateRemoveTypingIndicator(tabId);
      generateSetStatus('إعادة فحص الاتصال بـ Ghost و CLIProxy...', false, tabId);
      generateHelpers.showToast?.('↻ إعادة فحص الاتصال ثم إعادة المحاولة...');
      await generateDetectGhostPort({ onConnecting: (attempt, maxAttempts) => {
        generateSetStatus(`جاري الاتصال بـ Ghost (${attempt}/${maxAttempts})...`, false, tabId);
      } });
      const retryPre = await generatePreflightBeforeGenerate(aiProvider, { statusTabId: tabId });
      if (!retryPre.ok) {
        msg = retryPre.message;
      } else {
        let refFile = referenceFile;
        if (!refFile && ctx.referenceDataUrl) {
          refFile = await generateReferenceDataUrlToFile(ctx.referenceDataUrl, quality || ctx.quality);
        }
        await generateExecuteGenerationNow({
          prompt: effectivePrompt,
          builtPrompt: editedAuto || ctx.builtPrompt,
          useBuiltPrompt: skipVision || ctx.useBuiltPrompt,
          referenceFile: refFile,
          referenceDataUrl: ctx.referenceDataUrl,
          mode: mode || ctx.mode,
          count: String(count || ctx.count),
          quality: quality || ctx.quality,
          style: style || ctx.style,
          appendUser: false,
          userImageUrl: ctx.referenceDataUrl,
          retryContext: ctx,
          tabId,
          skipBusyGuard: true
        });
        return;
      }
    }

    generateRemoveTypingIndicator(tabId);
    generateSetStatus(msg, true, tabId);
    if (tabId === generateActiveTabId) {
      generateHelpers.showToast?.(`❌ ${msg}`);
    }
    generateAppendErrorMessage(msg, ctx, tabId);
    generateSaveChatSnapshot(tabId);
    if (generateIsTimeoutError(msg)) generateRecordQueueTimeoutHit();
  } finally {
    const finishedJobId = generateTabAbortState.get(tabId)?.jobId;
    if (finishedJobId) generateUnregisterJobTab(finishedJobId);
    generateTabAbortState.delete(tabId);
    if (!session._cancelHandled) {
      generateSetLoading(false, tabId);
      session.cancelled = false;
    }
    if (appendUser && tabId === generateActiveTabId) {
      generateClearAllImages();
      generatePersistComposerToSession(tabId);
    }
    generateSaveSessions();
  }
  });
}

async function generateHandleSubmit() {
  const tabId = generateActiveTabId;
  generateClearStaleTabBusy(tabId);
  if (generateIsTabBusy(tabId)) {
    generateHelpers.showToast?.('⚠️ هذا التبويب يولّد بالفعل');
    return;
  }
  const els = generateEls();
  const prompt = String(els.prompt?.value || '').trim();
  const hasImage = generateHasPendingImages();
  if (!prompt && !hasImage) {
    generateSetStatus('أدخل وصفاً أو ارفع صورة على الأقل', true);
    generateHelpers.showToast?.('⚠️ الوصف أو الصورة مطلوب');
    return;
  }
  const builtPrompt = generateGetBuiltPromptForApi(tabId);
  const retryContext = generateBuildRetryContextFromForm();
  const primary = generateGetPrimaryPendingImage();
  retryContext.referenceDataUrl = primary?.previewUrl || '';
  const libraryDisplayName = generateResolveLibraryDisplayName(
    { name: primary?.sourceName || primary?.name || '' },
    primary
  );
  if (libraryDisplayName) retryContext.libraryDisplayName = libraryDisplayName;
  await generateExecuteGeneration({
    prompt,
    builtPrompt,
    useBuiltPrompt: !!(hasImage && generateSessionAutoPromptVisible(tabId) && builtPrompt),
    referenceFile: primary?.file || null,
    referenceDataUrl: retryContext.referenceDataUrl,
    mode: retryContext.mode,
    count: retryContext.count,
    quality: retryContext.quality,
    style: retryContext.style,
    appendUser: true,
    userImageUrl: primary?.previewUrl || '',
    libraryDisplayName,
    name: primary?.sourceName || primary?.name || '',
    retryContext,
    tabId
  });
}

function generateHandleComposerPaste(e) {
  const items = e.clipboardData?.items;
  if (!items?.length) return;
  const imageFiles = [];
  for (const item of items) {
    if (item.type?.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  if (!imageFiles.length) return;
  e.preventDefault();
  imageFiles.forEach((file) => { void generateAddImageFile(file); });
}

async function generateDataUrlToPendingImage(dataUrl, name = 'reference.png') {
  const raw = String(dataUrl || '').trim();
  if (!raw) return false;
  const resolved = raw.startsWith('http') || raw.startsWith('/')
    ? generateResolveImageSrc({ dataUrl: raw, url: raw })
    : raw;
  if (!resolved) return false;
  try {
    const blob = await generateUrlToBlob(resolved);
    if (!blob?.size) return false;
    const ext = (blob.type || '').includes('jpeg') ? '.jpg' : '.png';
    const file = new File([blob], String(name || 'reference').replace(/\.[^.]+$/, '') + ext, {
      type: blob.type || 'image/png',
      lastModified: Date.now()
    });
    const previewUrl = resolved.startsWith('data:') ? resolved : await blobToDataUrl(blob);
    return generateAddImageFile(file, { previewUrl: previewUrl || resolved });
  } catch (_) {
    if (resolved.startsWith('data:')) {
      const blob = generateParseDataUrlToBlob(resolved);
      if (!blob) return false;
      const ext = (blob.type || '').includes('jpeg') ? '.jpg' : '.png';
      const file = new File([blob], String(name || 'reference').replace(/\.[^.]+$/, '') + ext, {
        type: blob.type || 'image/png',
        lastModified: Date.now()
      });
      return generateAddImageFile(file, { previewUrl: resolved });
    }
    return false;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

async function generateUrlToBlob(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return generateParseDataUrlToBlob(raw);
  if (raw.startsWith('blob:') || /^https?:/i.test(raw) || raw.startsWith('/')) {
    try {
      const res = await fetch(raw);
      return await res.blob();
    } catch (_) {
      return null;
    }
  }
  return null;
}

function generateParseDataUrlToBlob(dataUrl) {
  const value = String(dataUrl || '');
  const match = value.match(/^data:([^;,]+)?(?:;([^;,]+))?,(.*)$/s);
  if (!match) return null;
  const mime = match[1] || 'image/png';
  const encoding = match[2] || '';
  const payload = match[3] || '';
  try {
    if (encoding.toLowerCase() === 'base64') {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch (_) {
    return null;
  }
}

async function generateLoadPayloadImages(payload = {}) {
  let loaded = false;
  const dataUrl = String(payload.imageDataUrl || payload.imageUrl || '').trim();
  const name = payload.name || payload.imageName || 'prompt-bag.png';
  if (dataUrl) {
    loaded = await generateDataUrlToPendingImage(dataUrl, name) || loaded;
  }
  if (payload.imageBase64) {
    const mime = payload.imageMime || 'image/png';
    loaded = await generateDataUrlToPendingImage(`data:${mime};base64,${payload.imageBase64}`, name) || loaded;
  }
  const list = Array.isArray(payload.images) ? payload.images : [];
  for (const img of list) {
    const imgDataUrl = String(img?.dataUrl || '').trim();
    if (dataUrl && imgDataUrl && imgDataUrl === dataUrl) continue;
    if (img?.dataUrl) {
      loaded = await generateDataUrlToPendingImage(img.dataUrl, img.name || img.filename || name) || loaded;
    } else if (img?.file instanceof File) {
      loaded = await generateAddImageFile(img.file) || loaded;
    }
  }
  return loaded;
}

/** Side-by-side composite so merge prompts can reference both niche images in one upload.
 *  pending[0] = LEFT (niche A), pending[1] = RIGHT (niche B) — must match cross-niche prompt labels. */
async function generateBuildMergeCompositeFromPending() {
  if (generatePendingImages.length < 2) return null;
  const [left, right] = generatePendingImages.slice(0, 2);
  if (!left?.previewUrl || !right?.previewUrl) return null;
  try {
    const [imgL, imgR] = await Promise.all([
      generateLoadImageElement(left.previewUrl),
      generateLoadImageElement(right.previewUrl)
    ]);
    const cellH = 512;
    const wL = Math.max(1, Math.round((imgL.naturalWidth || 1) * (cellH / (imgL.naturalHeight || 1))));
    const wR = Math.max(1, Math.round((imgR.naturalWidth || 1) * (cellH / (imgR.naturalHeight || 1))));
    const gap = 8;
    const canvas = document.createElement('canvas');
    canvas.width = wL + wR + gap;
    canvas.height = cellH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgL, 0, 0, wL, cellH);
    ctx.drawImage(imgR, wL + gap, 0, wR, cellH);
    const blob = await generateCanvasToJpegBlob(canvas, 0.86);
    const file = new File([blob], 'merge-reference.jpg', { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(blob);
    return { file, previewUrl };
  } catch (err) {
    console.warn('[Generate] merge composite failed', err);
    return null;
  }
}

/**
 * Inject text and/or images into the composer (Prompt Bag bridge, programmatic use).
 * MVP backend: only the first image is sent to /api/generate.
 */
export { enqueueGenerateJob };

export async function injectGenerateComposer({
  text = '',
  images = [],
  append = false,
  appendImages = true,
  focus = true,
  silent = false
} = {}) {
  const els = generateEls();
  const trimmed = String(text || '').trim();
  if (els.prompt) {
    if (trimmed) {
      const current = String(els.prompt.value || '').trim();
      if (append && current) {
        els.prompt.value = `${current}\n${trimmed}`;
      } else {
        els.prompt.value = trimmed;
      }
      generateAutoResizeInput();
    }
  }
  if (!appendImages) {
    generateClearAllImages();
  }
  const list = Array.isArray(images) ? images : [];
  for (const img of list) {
    if (img?.dataUrl) {
      await generateDataUrlToPendingImage(img.dataUrl, img.name || img.filename || 'reference.png');
    } else if (img?.file instanceof File) {
      await generateAddImageFile(img.file);
    }
  }
  if (focus) {
    els.prompt?.focus();
    const len = els.prompt?.value?.length || 0;
    try {
      els.prompt?.setSelectionRange(len, len);
    } catch (_) { /* ignore */ }
  }
  if (!silent) {
    generateHelpers.showToast?.('✅ تم حقن المحتوى في المُجمّع');
  }
  return { ok: true, imageCount: generatePendingImages.length };
}

/**
 * Prompt Bag → Generate: inject composer inputs and auto-run generation (chat bubble + loading + results).
 */
export async function handlePromptBagGenerate(payload = {}) {
  if (generateShouldSkipPromptBagGenerate(payload)) return;

  if (typeof generateHelpers.switchTab === 'function') {
    generateHelpers.switchTab('generate');
  }
  activateGeneratePanel();

  const prompt = String(payload.prompt || payload.text || '').trim();
  const hadImageIntent = !!(
    payload.imageDataUrl
    || payload.imageUrl
    || payload.imageBase64
    || (Array.isArray(payload.images) && payload.images.length)
  );
  const openNewTab = payload.openNewTab !== false;
  let tabId = generateActiveTabId;

  if (openNewTab) {
    const active = generateGetActiveSession();
    if (active && generateIsSessionEmpty(active) && !active.generationBusy && !active.generationQueued) {
      tabId = active.id;
    } else {
      const label = generateTruncateLabel(payload.name || prompt || '', 22) || `توليد ${generateSessions.length + 1}`;
      tabId = generateCreateTab({ label, focus: true, switchTo: true }).id;
    }
  }

  if (tabId !== generateActiveTabId) {
    generateSwitchTab(tabId);
  }

  generateClearStaleTabBusy(tabId);
  if (generateIsTabBusy(tabId)) {
    const label = generateTruncateLabel(payload.name || prompt || '', 22) || `توليد ${generateSessions.length + 1}`;
    tabId = generateCreateTab({ label, focus: true, switchTo: true }).id;
  }

  const els = generateEls();

  generateClearAllImages();
  if (els.prompt) {
    els.prompt.value = prompt;
    generateAutoResizeInput();
  }
  await generateLoadPayloadImages(payload);

  let primary = generateGetPrimaryPendingImage();
  if (payload.mergeMode && generatePendingImages.length >= 2) {
    const composite = await generateBuildMergeCompositeFromPending();
    if (composite?.file) {
      // Replace dual pending thumbs with ONE composite so chat + API are a single unified send.
      generateClearAllImages();
      generatePendingImages.push({
        id: generateMakeAttachId(),
        file: composite.file,
        previewUrl: composite.previewUrl,
        name: composite.file.name || 'merge-reference.jpg',
        sourceName: composite.file.name || 'merge-reference.jpg',
      });
      primary = generatePendingImages[0];
      generateRenderAttachChips();
      generateAutoResizeInput();
    }
  }

  if (hadImageIntent && !primary?.file) {
    generateSetStatus('تعذّر تحميل الصورة من الحقيبة', true, tabId);
    generateHelpers.showToast?.('⚠️ تعذّر تحميل الصورة — تحقق من مصدر الصورة');
    if (!prompt) return;
  }
  if (!prompt && !primary?.file) {
    generateSetStatus('أدخل وصفاً أو ارفع صورة على الأقل', true, tabId);
    generateHelpers.showToast?.('⚠️ الوصف أو الصورة مطلوب');
    return;
  }

  if (payload.name) {
    generateUpdateSessionLabel(tabId, payload.name);
  } else if (prompt) {
    generateUpdateSessionLabel(tabId, prompt);
  }

  const builtPrompt = String(payload.builtPrompt || '').trim();
  const useBuiltPrompt = !!(payload.useBuiltPrompt && builtPrompt);
  const promptCount = String(payload.count || '').trim() || (payload.mergeMode ? '4' : '');
  if (promptCount && els.count) els.count.value = promptCount;
  if (useBuiltPrompt && builtPrompt) {
    generateShowAutoPrompt(builtPrompt, { editable: true, tabId });
  }

  const retryContext = generateBuildRetryContextFromForm();
  generatePersistComposerToSession(tabId);
  generateScrollToBottom();
  const jobId = enqueueGenerateJob({
    prompt,
    builtPrompt: builtPrompt || prompt,
    useBuiltPrompt,
    referenceFile: primary?.file || null,
    referenceDataUrl: primary?.previewUrl || '',
    mode: retryContext.mode,
    count: promptCount || retryContext.count,
    quality: retryContext.quality,
    style: retryContext.style,
    appendUser: true,
    userImageUrl: primary?.previewUrl || '',
    libraryDisplayName: String(payload.libraryDisplayName || '').trim()
      || generateResolveLibraryDisplayName({ name: payload.name }, primary),
    name: payload.name || '',
    retryContext,
    tabId
  });
  const pos = jobId ? generateGetJobQueueWaitPosition(jobId) : 0;
  generateHelpers.showToast?.(
    pos > 1 ? `📋 في طابور التوليد (${pos})` : '⚡ أُضيف إلى طابور التوليد'
  );
}

function generateIsPromptBagFrame(source) {
  const frame = document.querySelector('#panel-generate .promptbag-frame');
  return !!(frame?.contentWindow && source === frame.contentWindow);
}

let generatePromptBagBridgeBound = false;
let lastPromptBagGenerateKey = '';
let lastPromptBagGenerateAt = 0;

function generatePromptBagPayloadKey(payload = {}) {
  const img = String(payload.imageDataUrl || payload.imageUrl || '').trim().slice(0, 96);
  const prompt = String(payload.prompt || payload.text || '').trim().slice(0, 120);
  const name = String(payload.name || '').trim();
  return `${img}|${prompt}|${name}`;
}

function generateShouldSkipPromptBagGenerate(payload = {}) {
  const key = generatePromptBagPayloadKey(payload);
  const now = Date.now();
  if (!key) return false;
  if (key === lastPromptBagGenerateKey && now - lastPromptBagGenerateAt < GENERATE_PROMPTBAG_DEDUPE_MS) {
    return true;
  }
  lastPromptBagGenerateKey = key;
  lastPromptBagGenerateAt = now;
  return false;
}

function generateBindPromptBagBridge() {
  if (generatePromptBagBridgeBound) return;
  generatePromptBagBridgeBound = true;

  window.addEventListener('message', (event) => {
    if (!generateIsPromptBagFrame(event.source)) return;
    const data = event?.data || {};
    if (data.type === GENERATE_INJECT_MSG_TYPE) {
      void injectGenerateComposer({
        text: data.text || '',
        images: Array.isArray(data.images) ? data.images : [],
        append: !!data.append,
        appendImages: data.appendImages !== false,
        focus: data.focus !== false,
        silent: true
      });
      return;
    }
    if (data.type === GENERATE_PROMPTBAG_MSG_TYPE) {
      void handlePromptBagGenerate(data);
      return;
    }
  });

  window.addEventListener(GENERATE_PROMPTBAG_MSG_TYPE, (event) => {
    void handlePromptBagGenerate(event.detail || {});
  });

  window.NHP_injectGenerateComposer = injectGenerateComposer;
  window.NHP_handlePromptBagGenerate = handlePromptBagGenerate;
  window.NHP_injectAndGenerate = handlePromptBagGenerate;
}

function generateToggleSettings() {
  const { settingsBar, settingsToggle } = generateEls();
  if (!settingsBar || !settingsToggle) return;
  const open = settingsBar.hasAttribute('hidden');
  if (open) {
    settingsBar.removeAttribute('hidden');
    settingsToggle.setAttribute('aria-expanded', 'true');
  } else {
    settingsBar.setAttribute('hidden', '');
    settingsToggle.setAttribute('aria-expanded', 'false');
  }
}

/** @type {AbortController|null} */
let generateTestAbortController = null;

function generateSetTestButtonsDisabled(disabled) {
  const { testGemini, testChatgpt, restartGhost } = generateEls();
  if (testGemini) testGemini.disabled = !!disabled;
  if (testChatgpt) testChatgpt.disabled = !!disabled;
  if (restartGhost) restartGhost.disabled = !!disabled;
}

function generateGetRestartScriptPath() {
  const cfg = window.NhpRuntimeConfig;
  const projectDir = cfg?.getCached?.()?.projectDir || '';
  return cfg?.joinPath ? cfg.joinPath(projectDir, GHOST_RESTART_SCRIPT) : `${projectDir}\\${GHOST_RESTART_SCRIPT}`;
}

async function generateCopyRestartScriptPath() {
  const scriptPath = generateGetRestartScriptPath();
  try {
    await navigator.clipboard.writeText(scriptPath);
    generateHelpers.showToast?.('📋 تم نسخ مسار Restart_Ghost_3019.cmd');
  } catch (_) {
    generateHelpers.showToast?.(`المسار: ${scriptPath}`);
  }
  return scriptPath;
}

function generateSetRestartStatus(text, isError = false) {
  const { restartStatus } = generateEls();
  if (!restartStatus) return;
  const msg = String(text || '').trim();
  restartStatus.hidden = !msg;
  restartStatus.textContent = msg;
  restartStatus.classList.toggle('is-error', !!isError);
  restartStatus.classList.toggle('is-success', !isError && /تم|✓|نجح/i.test(msg));
}

async function generatePollGhostOnline(maxMs = GHOST_RESTART_POLL_MAX_MS, intervalMs = GHOST_RESTART_POLL_MS) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const pingUrl = window.NhpRuntimeConfig?.localUrl
        ? window.NhpRuntimeConfig.localUrl(GHOST_PORT, '/ping')
        : `http://127.0.0.1:${GHOST_PORT}/ping`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(pingUrl, { method: 'GET', signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.ok) {
          generateResolvedGhostPort = GHOST_PORT;
          return true;
        }
      }
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function generateRestartGhostServer() {
  if (!confirm('هل تريد إعادة تشغيل Ghost Server على المنفذ 3019؟')) return;

  const { restartGhost } = generateEls();
  if (restartGhost) restartGhost.disabled = true;
  generateSetRestartStatus('جاري إعادة التشغيل...', false);

  try {
    await generateEnsureRuntimeConfig();
    let restartTriggered = false;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(generateGhostUrl('/api/ghost/restart'), {
        method: 'POST',
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        restartTriggered = true;
        const data = await res.json().catch(() => ({}));
        generateSetRestartStatus(data?.message || 'جاري إعادة التشغيل...', false);
      }
    } catch (_) {
      const scriptPath = await generateCopyRestartScriptPath();
      generateSetRestartStatus(
        `Ghost غير متصل — شغّل الملف يدوياً:\n${scriptPath}`,
        true
      );
      return;
    }

    if (!restartTriggered) {
      const scriptPath = await generateCopyRestartScriptPath();
      generateSetRestartStatus(
        `فشل — شغّل الملف يدوياً:\n${scriptPath}`,
        true
      );
      return;
    }

    const online = await generatePollGhostOnline();
    if (online) {
      generateSetRestartStatus('تم — Ghost Server يعمل على المنفذ 3019', false);
      generateHelpers.showToast?.('✅ تم إعادة تشغيل Ghost Server');
      await generatePingServer();
      loadSavedLibraryDesigns({ render: generateActiveSection === 'library', mergeIntoMemory: true });
      void generateFetchLibrary({ retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
    } else {
      const scriptPath = await generateCopyRestartScriptPath();
      generateSetRestartStatus(
        `فشل — شغّل الملف يدوياً:\n${scriptPath}`,
        true
      );
    }
  } finally {
    if (restartGhost) restartGhost.disabled = false;
  }
}

function generateResetTestPreview() {
  const { testPreview } = generateEls();
  if (!testPreview) return;
  testPreview.removeAttribute('src');
  testPreview.hidden = true;
  testPreview.classList.add('is-hidden');
}

function generateSetTestStatus(text, isError = false) {
  const { testStatus } = generateEls();
  if (!testStatus) return;
  testStatus.textContent = String(text || '').trim() || 'لم يُجرَ اختبار بعد';
  testStatus.classList.toggle('is-error', !!isError);
  testStatus.classList.toggle('is-success', !isError && /نجح|تم|✓/i.test(testStatus.textContent));
}

function generateFormatImageTestFailure(label, err, data = {}, res = null) {
  const statusNote = data?.cliproxyStatus
    ? ` (CLIProxy HTTP ${data.cliproxyStatus})`
    : (res?.status ? ` (Ghost HTTP ${res.status})` : '');
  const modelsLine = Array.isArray(data?.imageModels) && data.imageModels.length
    ? `\nنماذج CLIProxy: ${data.imageModels.join('، ')}`
    : '';
  const endpointLine = data?.endpointUsed || data?.endpointPath
    ? `\nالمسار المُستخدَم: ${data.endpointUsed || data.endpointPath}`
    : '';
  const hint = data?.hint ? `\n${data.hint}` : '';
  const codeLine = data?.code ? `\n[${data.code}]` : '';
  const usedGeminiChat = data?.route === 'gemini-chat'
    || data?.aiProvider === 'gemini'
    || String(data?.endpointUsed || data?.endpointPath || '').includes('chat/completions');
  let prefix = '';
  if (data?.imagePathIssue !== false) {
    prefix = usedGeminiChat
      ? 'مفتاح SEO ✓ — مشكلة توليد Gemini (chat/completions): '
      : 'مفتاح SEO ✓ — مشكلة مسار الصور: ';
  }
  if (data?.code === 'gemini_auth_missing') {
    prefix = 'مفتاح SEO ✓ — مصادقة Gemini مفقودة على CLIProxy: ';
  }
  return `${prefix}فشل اختبار ${label}${statusNote}: ${err}${endpointLine}${codeLine}${modelsLine}${hint}`;
}

/**
 * Inline test for Gemini or ChatGPT image provider — no production queue.
 * @param {'gemini'|'chatgpt'} provider
 */
async function generateTestImageProvider(provider) {
  const normalized = generateNormalizeAiProvider(provider);
  if (normalized !== 'gemini' && normalized !== 'chatgpt') return;

  if (generateTestAbortController) {
    try { generateTestAbortController.abort(); } catch (_) { /* ignore */ }
  }
  generateTestAbortController = new AbortController();
  const signal = generateTestAbortController.signal;

  const label = GENERATE_AI_PROVIDER_OPTIONS[normalized] || normalized;
  generateSetTestButtonsDisabled(true);
  generateResetTestPreview();
  generateSetTestStatus(`جاري الاتصال بـ Ghost و CLIProxy لاختبار ${label}...`, false);

  try {
    await generateEnsureRuntimeConfig();
    const port = await generateDetectGhostPort({
      onConnecting: (attempt, maxAttempts) => {
        generateSetTestStatus(`جاري الاتصال بـ Ghost (${attempt}/${maxAttempts})...`, false);
      }
    });
    if (!port) {
      const ports = GHOST_PORT_CANDIDATES.join('، ');
      generateSetTestStatus(
        `فشل: Ghost Server غير متصل — شغّل Start_Ghost_Server_On_Port.cmd على المنفذ ${GHOST_PORT} (أو ${ports})`,
        true
      );
      return;
    }

    const hasGenerateRoute = await generateProbeGenerateApi();
    if (!hasGenerateRoute) {
      generateSetTestStatus(
        `فشل: Ghost يعمل على ${port} لكن مسار التوليد غير متاح — أعد تشغيل ghost-server.js`,
        true
      );
      return;
    }

    const keys = await generateGetCliProxyAiKeys(normalized);
    if (!keys.apiKey && !keys.cloudApiKey) {
      const localKeys = await generateTryLocalCliProxyBackup(keys);
      if (localKeys) {
        Object.assign(keys, localKeys);
        generateSetTestStatus('CLIProxy السحابي بلا مفتاح — استخدام المحلي (احتياط)...', false);
      } else {
        const noKeyMsg = normalized === 'gemini'
          ? 'فشل: مفتاح Gemini API غير مُعدّ — أضفه في إعدادات التوليد ⚙️ أو من SEO → إعدادات API (nhpGptApiKey)'
          : 'فشل: مفتاح NHP API غير مُعدّ — أضفه من SEO → إعدادات API (nhpGptApiKey) أو لوحة التحكم → مفاتيح AI';
        generateSetTestStatus(noKeyMsg, true);
        return;
      }
    }
    if (!keys.apiKey && keys.cloudApiKey) {
      keys.apiKey = keys.cloudApiKey;
      keys.baseUrl = GENERATE_RENDER_NHP_PROXY_BASE_URL;
    }

    generateSetTestStatus(`جاري التحقق من مفتاح SEO (نفس مسار قسم SEO)...`, false);
    const seoKeyCheck = await generateVerifySeoApiKey(keys);
    if (!seoKeyCheck.ok) {
      generateSetTestStatus(`فشل مفتاح SEO: ${seoKeyCheck.message}`, true);
      generateHelpers.showToast?.('❌ مفتاح SEO غير صالح');
      return;
    }
    if (seoKeyCheck.baseUrl) {
      keys.baseUrl = generateNormalizeProxyBaseUrl(seoKeyCheck.baseUrl);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...generateBuildApiCredentialHeaders(keys, normalized)
    };

    let healthModelsHint = `${seoKeyCheck.message} — `;
    try {
      const healthUrl = `${generateGhostUrl('/api/generate/health')}?aiProvider=${encodeURIComponent(normalized)}`;
      const healthCtrl = new AbortController();
      const healthTimer = setTimeout(() => healthCtrl.abort(), 12000);
      const healthRes = await fetch(healthUrl, { method: 'GET', headers, signal: healthCtrl.signal });
      clearTimeout(healthTimer);
      const healthText = await healthRes.text().catch(() => '');
      let health = {};
      try { health = healthText ? JSON.parse(healthText) : {}; } catch (_) { /* ignore */ }

      if (health.cliproxyStatus === 401 || health.cliproxyStatus === 403) {
        // Health already tried local; if Ghost reports cloud failover success, continue.
        if (!(health.cliproxyOk && health.isRenderProxy)) {
          generateSetTestStatus(`فشل مفتاح SEO: مرفوض من CLIProxy (${health.cliproxyStatus})`, true);
          generateHelpers.showToast?.('❌ مفتاح SEO مرفوض');
          return;
        }
      }

      const proxyBase = generateNormalizeProxyBaseUrl(health.baseUrl || keys.baseUrl);
      if (health.baseUrl) keys.baseUrl = proxyBase;
      healthModelsHint += `CLIProxy: ${proxyBase}`;
      if (health.failoverFrom) healthModelsHint += ` (failover من ${health.failoverFrom})`;
      healthModelsHint += ' — ';

      const providerModels = normalized === 'gemini'
        ? (health.geminiImageModels || [])
        : (health.chatGptImageModels || health.imageModels || []);
      if (providerModels.length) {
        healthModelsHint += `نماذج ${label}: ${providerModels.join('، ')} — `;
      } else if (health.imageModelHintAr) {
        healthModelsHint += `${health.imageModelHintAr} — `;
      } else if (!health.cliproxyOk) {
        healthModelsHint += 'تعذّر فحص نماذج الصور — ';
      }
    } catch (healthErr) {
      if (healthErr?.name === 'AbortError') return;
      healthModelsHint += 'فحص الصور اختياري — ';
    }

    const fallbackNote = normalized === 'auto' && generateShouldAutoFallbackGemini('auto')
      ? ' (مع تراجع Gemini عند فشل ChatGPT)'
      : '';
    generateSetTestStatus(`${healthModelsHint}جاري توليد صورة اختبار ${label}${fallbackNote}...`, false);

    const testPrompt = normalized === 'gemini'
      ? 'simple red circle icon'
      : 'simple test icon, flat vector, single object on white background';
    const testBody = JSON.stringify({
      test: true,
      aiProvider: normalized,
      mode: normalized,
      prompt: testPrompt,
      autoFallbackGemini: generateShouldAutoFallbackGemini(normalized) ? '1' : '0',
      apiKey: keys.apiKey || undefined,
      baseUrl: keys.baseUrl || undefined,
      geminiApiKey: keys.geminiApiKey || undefined,
      geminiBaseUrl: keys.geminiBaseUrl || undefined
    });

    let data = {};
    let res = null;
    const maxClientRetries = 2;
    for (let attempt = 0; attempt <= maxClientRetries; attempt += 1) {
      const testCtrl = new AbortController();
      const testTimer = setTimeout(() => testCtrl.abort(), 390000);
      const linkedSignal = signal;
      if (linkedSignal?.aborted) {
        clearTimeout(testTimer);
        return;
      }
      const onParentAbort = () => testCtrl.abort();
      linkedSignal?.addEventListener?.('abort', onParentAbort, { once: true });
      try {
        res = await fetch(generateGhostUrl('/api/generate/test'), {
          method: 'POST',
          headers,
          signal: testCtrl.signal,
          body: testBody
        });
        const rawText = await res.text().catch(() => '');
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch (_) {
          data = {
            error: rawText?.slice(0, 300) || `HTTP ${res.status}`,
            code: 'invalid_response'
          };
        }
        if (res.ok && data?.success) break;
        const errText = String(data?.error || '');
        const retriable = /stream disconnected|stream error|disconnected before completion/i.test(errText)
          || res.status === 502
          || data?.code === 'test_failed';
        if (attempt < maxClientRetries && retriable && !data?.fallbackAttempted) {
          generateSetTestStatus(`إعادة محاولة ${attempt + 1}/${maxClientRetries} بعد انقطاع stream...`, false);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        break;
      } catch (fetchErr) {
        if (fetchErr?.name === 'AbortError') {
          if (linkedSignal?.aborted) return;
          data = { error: 'انتهت مهلة اختبار التوليد — جرّب NHP_GENERATE_TEST_TIMEOUT_MS في .env' };
          res = { ok: false, status: 504 };
          break;
        }
        if (attempt < maxClientRetries && generateIsNetworkFetchError(fetchErr)) {
          generateSetTestStatus(`إعادة محاولة ${attempt + 1}/${maxClientRetries} بعد خطأ شبكة...`, false);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw fetchErr;
      } finally {
        clearTimeout(testTimer);
        linkedSignal?.removeEventListener?.('abort', onParentAbort);
      }
    }

    if (!res?.ok || !data?.success) {
      const err = generateHumanizeCliProxyError(data?.error || `HTTP ${res?.status || 0}`);
      const failMsg = generateFormatImageTestFailure(label, err, data, res);
      generateSetTestStatus(failMsg, true);
      const toastPrefix = data?.code === 'gemini_auth_missing'
        ? '❌ مصادقة Gemini مفقودة'
        : (data?.route === 'gemini-chat' || data?.aiProvider === 'gemini'
          ? '❌ فشل Gemini (chat/completions)'
          : '❌ مشكلة مسار الصور');
      generateHelpers.showToast?.(`${toastPrefix} — ${label}`);
      return;
    }

    const { testPreview } = generateEls();
    if (testPreview && data.image) {
      testPreview.src = data.image;
      testPreview.hidden = false;
      testPreview.classList.remove('is-hidden');
    }
    const modelUsed = data.modelUsed || data.model;
    const model = modelUsed ? ` — النموذج: ${modelUsed}` : '';
    const okMsg = data.fallbackFrom && generateShouldAutoFallbackGemini(normalized)
      ? (data.message || `تم التوليد عبر Gemini (بعد فشل ChatGPT)${model}`)
      : (data.message || `نجح اختبار ${label}${model}`);
    generateSetTestStatus(okMsg, false);
    generateHelpers.showToast?.(data.fallbackFrom && generateShouldAutoFallbackGemini(normalized)
      ? `✅ تم التوليد عبر Gemini (بعد فشل ChatGPT)`
      : `✅ ${okMsg}`);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    const msg = generateFormatFetchError(err, {
      port: generateResolvedGhostPort || GHOST_PORT,
      proxyBaseUrl: (await generateGetCliProxyAiKeys(normalized)).baseUrl
    });
    generateSetTestStatus(`فشل اختبار ${label}: ${msg}`, true);
    generateHelpers.showToast?.(`❌ فشل اختبار ${label}`);
  } finally {
    generateTestAbortController = null;
    generateSetTestButtonsDisabled(false);
  }
}

function generateBindEvents() {
  if (generateBound) return;
  generateBound = true;
  const els = generateEls();

  els.submit?.addEventListener('click', () => {
    if (generateIsTabBusy(generateActiveTabId)) {
      generateCancelGeneration(generateActiveTabId);
      return;
    }
    generateHandleSubmit();
  });
  els.clearChat?.addEventListener('click', () => generateNewTabFromHeader());
  els.tabCloseAll?.addEventListener('click', () => generateCloseAllTabs());
  els.tabAdd?.addEventListener('click', () => generateNewTabFromHeader());
  els.historySearch?.addEventListener('input', () => {
    generateHistoryFilterQuery = String(els.historySearch?.value || '');
    generateRenderGallery(generateGalleryRaw);
  });
  els.refreshGallery?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    generateFetchGallery();
  });
  els.clearGallery?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void generateClearGallery();
  });
  els.refreshLibrary?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void (async () => {
      await generateTryReconcileLibraryIndex();
      generateFetchLibrary({ retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
    })();
  });
  els.libDownloadSelected?.addEventListener('click', () => generateDownloadLibrarySelected());
  els.libDownloadAll?.addEventListener('click', () => generateDownloadLibraryAll());
  els.libDeleteSelected?.addEventListener('click', () => generateDeleteLibrarySelected());
  els.libDeleteAll?.addEventListener('click', () => generateDeleteLibraryAll());
  els.libSendStudio?.addEventListener('click', () => { void generateSendLibrarySelectedToStudio(); });
  els.libSmartRename?.addEventListener('click', () => { void generateSmartRenameLibrarySelected(); });
  els.libFullPipeline?.addEventListener('click', () => { void startFullUploadPipeline(); });
  els.pipelineCancel?.addEventListener('click', () => {
    generateFullPipelineCancelled = true;
    window.studioCancelFullUploadPipeline?.();
    generateHelpers.showToast?.('⏹️ جاري إلغاء المسار...');
  });
  els.pipelineDismiss?.addEventListener('click', () => {
    generateHidePipelineOverlayImmediate();
  });
  els.sectionTabs?.querySelectorAll('.generate-section-tab').forEach((btn) => {
    btn.addEventListener('click', () => generateSwitchSection(btn.dataset.generateSection || 'chat'));
  });
  els.libSelectVisible?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const filtered = generateGetFilteredLibraryItems();
    const allSelected = filtered.length > 0 && filtered.every((it) => generateLibrarySelected.has(it.id));
    generateSelectFilteredLibrary(!allSelected);
  });
  els.libSelectAll?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    generateSelectAllLibrary(true);
  });
  els.libSelectNone?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    generateSelectAllLibrary(false);
  });
  const libMoreMenu = document.querySelector('.gen-lib-more-menu');
  if (libMoreMenu) {
    const drop = libMoreMenu.querySelector('.gen-lib-more-dropdown');
    const toggleBtn = document.getElementById('generate-lib-more') || libMoreMenu.querySelector('summary');
    const portalRoot = document.getElementById('panel-generate') || document.body;
    let dropAnchor = null;
    const scrollListeners = [];

    const clearScrollListeners = () => {
      scrollListeners.forEach(({ target, handler }) => {
        target.removeEventListener('scroll', handler, true);
      });
      scrollListeners.length = 0;
      window.removeEventListener('resize', onLibMoreLayout, true);
    };

    const restoreLibMoreDropdown = () => {
      if (!drop || !dropAnchor) return;
      drop.classList.remove('gen-lib-more-dropdown--portaled', 'is-open');
      drop.style.cssText = '';
      dropAnchor.parentNode?.insertBefore(drop, dropAnchor);
      dropAnchor.remove();
      dropAnchor = null;
    };

    const portalLibMoreDropdown = () => {
      if (!drop || drop.classList.contains('gen-lib-more-dropdown--portaled')) return;
      dropAnchor = document.createComment('gen-lib-more-dropdown-anchor');
      libMoreMenu.insertBefore(dropAnchor, drop);
      portalRoot.appendChild(drop);
      drop.classList.add('gen-lib-more-dropdown--portaled', 'is-open');
    };

    const positionLibMoreDropdown = () => {
      if (!drop || !toggleBtn || !libMoreMenu.open) return;
      const rect = toggleBtn.getBoundingClientRect();
      const gap = 2;
      const rtl = getComputedStyle(libMoreMenu).direction === 'rtl';
      drop.style.position = 'fixed';
      drop.style.top = `${Math.round(rect.bottom + gap)}px`;
      drop.style.insetInlineStart = '';
      drop.style.insetInlineEnd = '';
      if (rtl) {
        drop.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
        drop.style.left = '';
      } else {
        drop.style.left = `${Math.round(rect.left)}px`;
        drop.style.right = '';
      }
    };

    const bindScrollListeners = () => {
      clearScrollListeners();
      let node = libMoreMenu.parentElement;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        const scrollable = /(auto|scroll|overlay)/.test(style.overflow + style.overflowY + style.overflowX);
        if (scrollable) {
          const handler = () => {
            if (libMoreMenu.open) positionLibMoreDropdown();
          };
          node.addEventListener('scroll', handler, true);
          scrollListeners.push({ target: node, handler });
        }
        node = node.parentElement;
      }
      window.addEventListener('resize', onLibMoreLayout, true);
    };

    const onLibMoreLayout = () => {
      if (libMoreMenu.open) positionLibMoreDropdown();
    };

    const closeLibMoreOutside = (e) => {
      if (libMoreMenu.contains(e.target) || drop?.contains(e.target)) return;
      libMoreMenu.open = false;
      document.removeEventListener('click', closeLibMoreOutside, true);
    };

    libMoreMenu.addEventListener('toggle', () => {
      if (!libMoreMenu.open) {
        clearScrollListeners();
        restoreLibMoreDropdown();
        document.removeEventListener('click', closeLibMoreOutside, true);
        return;
      }
      portalLibMoreDropdown();
      positionLibMoreDropdown();
      bindScrollListeners();
      requestAnimationFrame(positionLibMoreDropdown);
      setTimeout(() => document.addEventListener('click', closeLibMoreOutside, true), 0);
    });
  }
  els.libSearch?.addEventListener('input', () => {
    generateLibraryFilterQuery = String(els.libSearch?.value || '');
    generateRenderLibraryGrid(true, true);
  });
  els.libStudioFilter?.addEventListener('change', () => {
    generateLibraryFilterStudioOnly = !!els.libStudioFilter?.checked;
    generateRenderLibraryGrid(true, true);
  });
  document.querySelectorAll('.generate-lib-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      generateLibraryFilterPeriod = btn.dataset.libPeriod || 'all';
      document.querySelectorAll('.generate-lib-filter-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      generateRenderLibraryGrid(true, true);
    });
  });
  els.libSelectCount?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    generateSelectLibraryFirstN(els.libSelectCount?.value);
  });
  els.libraryPreviewClose?.addEventListener('click', () => generateCloseLibraryPreview());
  els.settingsToggle?.addEventListener('click', () => generateToggleSettings());
  els.testGemini?.addEventListener('click', (e) => {
    e.preventDefault();
    void generateTestImageProvider('gemini');
  });
  els.testChatgpt?.addEventListener('click', (e) => {
    e.preventDefault();
    void generateTestImageProvider('chatgpt');
  });
  els.restartGhost?.addEventListener('click', (e) => {
    e.preventDefault();
    void generateRestartGhostServer();
  });
  els.queueConcurrency?.addEventListener('change', () => {
    generateApplyQueueConcurrencySetting(els.queueConcurrency?.value);
  });
  els.autoFallbackGemini?.addEventListener('change', () => {
    const on = generateApplyAutoFallbackGeminiSetting(!!els.autoFallbackGemini?.checked);
    generateHelpers.showToast?.(on ? '✅ تراجع Gemini تلقائي: مفعّل' : '⚠️ تراجع Gemini تلقائي: معطّل');
  });
  els.geminiApiKey?.addEventListener('input', () => generateScheduleSaveGeminiSettings());
  els.geminiApiKey?.addEventListener('blur', () => generatePersistGeminiSettings(generateReadGeminiSettingsFromForm()));
  els.geminiBaseUrl?.addEventListener('input', () => generateScheduleSaveGeminiSettings());
  els.geminiBaseUrl?.addEventListener('blur', () => generatePersistGeminiSettings(generateReadGeminiSettingsFromForm()));
  els.mode?.addEventListener('change', () => {
    const normalized = generatePersistAiProviderSetting(els.mode?.value);
    generateUpdateAutoFallbackUiForMode(normalized);
    generatePersistComposerToSession(generateActiveTabId);
    const label = GENERATE_AI_PROVIDER_OPTIONS[normalized] || GENERATE_AI_PROVIDER_OPTIONS.auto;
    generateHelpers.showToast?.(`✅ الوضع: ${label}`);
  });
  els.styleManageBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    generateToggleStyleManager();
  });
  els.styleAddBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    generateAddCustomStyleFromInput();
  });
  els.styleAddInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    generateAddCustomStyleFromInput();
  });
  els.systemPrompt?.addEventListener('input', () => generateScheduleSaveSystemPrompt());
  els.systemPrompt?.addEventListener('blur', () => { void generatePersistSystemPrompt(); });
  els.systemPromptReset?.addEventListener('click', (e) => {
    e.preventDefault();
    void generateResetSystemPromptToDefault();
  });

  els.prompt?.addEventListener('input', () => generateAutoResizeInput());
  els.prompt?.addEventListener('paste', generateHandleComposerPaste);
  els.prompt?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (generateIsTabBusy(generateActiveTabId)) {
        generateCancelGeneration(generateActiveTabId);
        return;
      }
      generateHandleSubmit();
    }
  });

  els.input?.addEventListener('change', () => {
    const files = [...(els.input?.files || [])];
    files.forEach((file) => { void generateAddImageFile(file); });
    if (els.input) els.input.value = '';
  });

  els.composer?.addEventListener('paste', generateHandleComposerPaste);

  const dropTargets = [els.root, els.composer, els.prompt].filter(Boolean);
  dropTargets.forEach((target) => {
    target.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.root?.classList.add('is-drag');
    });
    target.addEventListener('dragleave', (e) => {
      if (e.target === target) els.root?.classList.remove('is-drag');
    });
    target.addEventListener('drop', (e) => {
      e.preventDefault();
      els.root?.classList.remove('is-drag');
      const files = [...(e.dataTransfer?.files || [])].filter((f) => /^image\//i.test(f.type || ''));
      files.forEach((file) => { void generateAddImageFile(file); });
    });
  });
}

function ensureGenerateStyles() {
  const href = 'modules/generate/generate.css?v=lightbox_zoom_20260626';
  let link = document.getElementById('nhp-generate-css');
  if (link) {
    if (link.getAttribute('href') !== href) link.href = href;
    return;
  }
  link = document.createElement('link');
  link.id = 'nhp-generate-css';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export function initGenerateModule(helpers = {}) {
  generateHelpers = {
    showToast: helpers.showToast || (() => {}),
    showWarnToast: typeof helpers.showWarnToast === 'function' ? helpers.showWarnToast : null,
    switchTab: typeof helpers.switchTab === 'function' ? helpers.switchTab : null
  };
  ensureGenerateStyles();
  void generateEnsureRuntimeConfig().then(() => generatePingServer());
  generateBindEvents();
  generateBindLightbox();
  generateBindPromptBagBridge();
  generateLoadQueueConcurrencySetting();
  generateLoadAutoFallbackGeminiSetting();
  generateLoadAiProviderSetting();
  generateLoadGeminiSettings();
  void generateLoadSystemPromptSettings();
  void (async () => {
    await generateInitStyleSettings();
    generateRestoreChatSnapshot();
  })();
  generatePersistAutoSendStudio(false);
  loadSavedLibraryDesigns({ render: false, mergeIntoMemory: true });
  generateSwitchSection('chat');
  generateFetchGallery();
  generateFetchLibrary({ retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
  generateRenderAttachChips();
  generateAutoResizeInput();
  generateUpdateWelcome();
  if (!globalThis.__nhpLiveSyncLibraryRefreshBound) {
    globalThis.__nhpLiveSyncLibraryRefreshBound = true;
    try {
      chrome.runtime?.onMessage?.addListener?.((msg) => {
        if (msg?.action === 'GENERATE_LIBRARY_REFRESH') {
          void generateFetchLibrary({ force: true, retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
        }
      });
    } catch {
      /* ignore */
    }
  }
  console.log('✨ Generate Module: ready (chat UI)');
}

export function activateGeneratePanel() {
  if (!document.getElementById('panel-generate')) return;
  void generateEnsureRuntimeConfig().then(() => generatePingServer());
  if (generateStylePrefsLoaded) {
    generateRebuildStyleSelect();
    const session = generateGetSession(generateActiveTabId);
    if (session?.composer?.settings?.style) {
      const sel = generateEls().style;
      if (sel) sel.value = session.composer.settings.style;
    }
  } else {
    void generateInitStyleSettings();
  }
  loadSavedLibraryDesigns({ render: generateActiveSection === 'library', mergeIntoMemory: true });
  generateFetchGallery();
  generateFetchLibrary({ retries: GENERATE_LIBRARY_FETCH_RETRY_MAX });
  generateRenderTabBar();
  generateScrollToBottom();
}
