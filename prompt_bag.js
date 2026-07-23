const GEMINI_IMAGE_GEM_URL = 'https://gemini.google.com/gem/6bc2d8e9f911';
const CHATGPT_IMAGE_GPT_URL = 'https://chatgpt.com/g/g-69db6eabc5e48191844d04a90423616c-artisan-teepublic';

let prompts = [];
let images = [];
let noteNiches = [];
let autoPromptQueueRunning = false;
const autoPromptInFlight = new Set();
const AUTO_PROMPT_VERSION = 7;
const GENERATE_INJECT_MSG_TYPE = 'nhp-generate-inject';
const PROMPTBAG_GENERATE_MSG = 'nhp-promptbag-generate';
const PROMPTBAG_GENERATE_DEBOUNCE_MS = 500;
const PB_GHOST_PORTS = [3019, 3012];
const PB_GHOST_PING_MS = 1500;
const PB_PROMPTS_KEY = 'nhpPromptBagPrompts';
const PB_IMAGES_KEY = 'nhpPromptBagImages';
const PB_NOTE_DATA_KEY = 'teepublic_manager_data';
const PB_COLLAPSE_KEY = 'nhpPromptBagNicheCollapseState';
let lastPromptBagDispatchKey = '';
let lastPromptBagDispatchAt = 0;
let pbGhostPort = 3019;
let pbGhostConnected = false;
let pbBagLoaded = false;
let pbBagLoadError = '';
let pbImageSearch = '';
let pbImageSort = 'name';
let pbNicheCollapseState = {};

const $ = (id) => document.getElementById(id);

function pbGhostBaseUrl(port = pbGhostPort) {
  if (typeof window !== 'undefined' && window.NhpRuntimeConfig?.localUrl) {
    return window.NhpRuntimeConfig.localUrl(port, '');
  }
  return `http://127.0.0.1:${port}`;
}

function pbGhostUrl(path, port = pbGhostPort) {
  const base = pbGhostBaseUrl(port).replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function pbRewriteGhostSrc(src) {
  const value = String(src || '').trim();
  const m = value.match(/^https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)(\/.*)$/i);
  if (!m) return value;
  return pbGhostUrl(m[2], pbGhostPort);
}

async function pbReadStoredGhostPort() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    const stored = await chrome.storage.local.get(['nhpGhostPort', 'nhpGhostTeepublicPort']);
    const p = Number(stored?.nhpGhostPort || stored?.nhpGhostTeepublicPort);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch (_) {
    return null;
  }
}

async function pbProbeGhostPort(port) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PB_GHOST_PING_MS);
    const res = await fetch(pbGhostUrl('/ping', port), { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function pbDetectGhostPort() {
  const stored = await pbReadStoredGhostPort();
  const ports = [...new Set([3019, ...PB_GHOST_PORTS, stored, pbGhostPort].filter((p) => Number(p) > 0))];
  for (const port of ports) {
    if (await pbProbeGhostPort(port)) {
      pbGhostPort = port;
      pbGhostConnected = true;
      return port;
    }
  }
  pbGhostConnected = false;
  return null;
}

function pbUpdateConnBadge() {
  const badge = $('pb-conn-badge');
  if (!badge) return;
  const ghostOnline = pbGhostConnected;
  const bagFailed = ghostOnline && !pbBagLoaded && !!pbBagLoadError;
  if (!ghostOnline) {
    badge.textContent = 'غير متصل ✗';
  } else if (bagFailed) {
    badge.textContent = `متصل — فشل التحميل (${pbGhostPort})`;
  } else {
    badge.textContent = `متصل ✓ ${pbGhostPort}`;
  }
  badge.classList.toggle('is-online', ghostOnline && (pbBagLoaded || !pbBagLoadError));
  badge.classList.toggle('is-offline', !ghostOnline || bagFailed);
  if (!ghostOnline) {
    badge.title = `Ghost غير متاح — جرّب المنافذ ${PB_GHOST_PORTS.join('، ')}`;
  } else if (bagFailed) {
    badge.title = `Ghost على ${pbGhostPort} — ${pbBagLoadError || 'تعذر تحميل بيانات الحقيبة'}`;
  } else {
    badge.title = pbBagLoaded
      ? `Ghost ${pbGhostPort} — تم تحميل الحقيبة`
      : `Ghost Server على المنفذ ${pbGhostPort}`;
  }
}

function setStatus(message, tone = 'muted') {
  const el = $('status');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error'
    ? '#f87171'
    : tone === 'ok'
      ? '#34d399'
      : tone === 'warn'
        ? '#fbbf24'
        : '#94a3b8';
}

function pbStorageGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'storage read failed'));
          return;
        }
        resolve(data || {});
      });
    } catch (err) {
      reject(err);
    }
  });
}

function pbNormalizeNoteNiches(noteData) {
  const niches = Array.isArray(noteData?.niches) ? noteData.niches : [];
  return niches
    .map((item) => ({
      id: item?.id || `note_${String(item?.text || item?.niche || item?.keyword || '').toLowerCase().replace(/\s+/g, '_')}`,
      text: String(item?.text || item?.niche || item?.keyword || '').trim(),
      quality: item?.quality || '',
      done: !!(item?.done || item?.isCompleted),
      addedAt: item?.addedAt || item?.createdAt || null
    }))
    .filter((item) => item.text);
}

async function pbLoadBagFromStorage() {
  const stored = await pbStorageGet([PB_PROMPTS_KEY, PB_IMAGES_KEY, PB_NOTE_DATA_KEY]);
  prompts = Array.isArray(stored?.[PB_PROMPTS_KEY]) ? stored[PB_PROMPTS_KEY] : [];
  images = Array.isArray(stored?.[PB_IMAGES_KEY]) ? stored[PB_IMAGES_KEY] : [];
  noteNiches = pbNormalizeNoteNiches(stored?.[PB_NOTE_DATA_KEY]);
}

function pbDescribeBagLoadError(raw = '') {
  const msg = String(raw || '').trim();
  if (!msg) return 'تعذر تحميل الحقيبة — لا استجابة من امتداد NHP';
  if (/receiving end|extension context|context invalidated/i.test(msg)) {
    return 'امتداد NHP غير جاهز — أعد فتح النافذة أو أعد تحميل الامتداد';
  }
  if (/quota|QUOTA_BYTES/i.test(msg)) {
    return 'التخزين المحلي ممتلئ — احذف بعض صور الحقيبة ثم أعد المحاولة';
  }
  if (/message length|longer than|too large/i.test(msg)) {
    return 'بيانات الحقيبة كبيرة جداً للرسالة — تمت محاولة التحميل المباشر من التخزين';
  }
  return msg;
}

function pbBuildLoadStatusMessage(source = 'background') {
  const imgN = images.length;
  const prN = prompts.length;
  if (!imgN && !prN) {
    return 'Ready';
  }
  const parts = [];
  if (imgN) parts.push(`${imgN} صورة`);
  else parts.push('0 صورة');
  if (prN) parts.push(`${prN} برومبت`);
  const base = `تم التحميل — ${parts.join('، ')}`;
  if (source === 'storage' && pbBagLoadError) {
    return `${base} (من التخزين المحلي: ${pbBagLoadError})`;
  }
  return base;
}

function isEmbeddedInGenerateSplit() {
  try {
    return window.parent && window.parent !== window && !!window.parent.document?.getElementById('panel-generate');
  } catch (_) {
    return false;
  }
}

function sendToGenerateComposer({ text = '', dataUrl = '', name = '', append = false, appendImages = true } = {}) {
  const images = dataUrl ? [{ dataUrl, name: name || 'Prompt Bag Image' }] : [];
  window.parent.postMessage({
    type: GENERATE_INJECT_MSG_TYPE,
    text,
    images,
    append,
    appendImages,
    focus: true
  }, window.location.origin);
  setStatus('تم الإرسال إلى التوليد', 'ok');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/** Resolve card image to data URL (stored data:, blob:, http:, ghost paths). */
async function fetchSrcAsDataUrl(src) {
  const value = String(src || '').trim();
  if (!value) return '';
  if (value.startsWith('data:image/')) return value;
  const fetchUrl = pbRewriteGhostSrc(value);
  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return blobToDataUrl(blob);
  } catch (err) {
    if (fetchUrl !== value) {
      const res2 = await fetch(value);
      if (!res2.ok) throw err;
      const blob2 = await res2.blob();
      return blobToDataUrl(blob2);
    }
    throw err;
  }
}

async function resolveImageCardDataUrl(image, imageCard) {
  const stored = String(image?.dataUrl || '').trim();
  if (stored.startsWith('data:image/')) return stored;
  const imgEl = imageCard?.querySelector('img');
  const src = String(imgEl?.currentSrc || imgEl?.src || stored || '').trim();
  if (!src) return '';
  try {
    return await fetchSrcAsDataUrl(src);
  } catch (_) {
    return stored.startsWith('data:image/') ? stored : '';
  }
}

async function sendImageCardToGenerate(image, imageCard, explicitPrompt = '', options = {}) {
  const promptText = await getGeneratedOrManualImagePrompt(image, explicitPrompt, { silent: options.silent !== false });
  const imageDataUrl = await resolveImageCardDataUrl(image, imageCard);
  if (!imageDataUrl) {
    throw new Error('تعذّر قراءة بيانات الصورة من البطاقة');
  }
  dispatchPromptBagGenerate({
    prompt: promptText,
    imageDataUrl,
    name: image?.name || 'prompt-bag.png',
    libraryDisplayName: pbLibraryDisplayNameFromImage(image)
  });
}

/** Inject image + prompt into Generate composer without auto-starting generation. */
async function injectImageCardToGenerate(image, imageCard, explicitPrompt = '', options = {}) {
  const promptText = await getGeneratedOrManualImagePrompt(image, explicitPrompt, { silent: options.silent !== false });
  const imageDataUrl = await resolveImageCardDataUrl(image, imageCard);
  if (!imageDataUrl) {
    throw new Error('تعذّر قراءة بيانات الصورة من البطاقة');
  }
  if (isEmbeddedInGenerateSplit()) {
    sendToGenerateComposer({
      text: promptText,
      dataUrl: imageDataUrl,
      name: image?.name || 'prompt-bag.png',
      append: false,
      appendImages: true
    });
    return;
  }
  await pasteImageWithPrompt(image, imageCard);
}

function promptBagDispatchKey({ prompt = '', imageDataUrl = '', imageUrl = '', name = '' } = {}) {
  const resolvedUrl = String(imageDataUrl || imageUrl || '').trim();
  const imgKey = resolvedUrl ? resolvedUrl.slice(0, 96) : '';
  return `${imgKey}|${String(prompt || '').trim().slice(0, 120)}|${name || ''}`;
}

/** Inject into Generate composer and auto-start generation (split view / popup). */
function dispatchPromptBagGenerate({
  prompt = '',
  builtPrompt = '',
  imageDataUrl = '',
  imageUrl = '',
  name = '',
  libraryDisplayName = '',
  openNewTab = true,
  mergeMode = false,
  useBuiltPrompt = false,
  count = '',
  images: payloadImages = null
} = {}) {
  const resolvedUrl = String(imageDataUrl || imageUrl || '').trim();
  const dedupeKey = promptBagDispatchKey({ prompt, imageDataUrl: resolvedUrl, name });
  const now = Date.now();
  if (dedupeKey && dedupeKey === lastPromptBagDispatchKey && now - lastPromptBagDispatchAt < PROMPTBAG_GENERATE_DEBOUNCE_MS) {
    return;
  }
  lastPromptBagDispatchKey = dedupeKey;
  lastPromptBagDispatchAt = now;
  const fileName = name || 'prompt-bag.png';
  const displayName = libraryDisplayName
    || (typeof NHP_nicheTitleFromFileName === 'function' ? NHP_nicheTitleFromFileName(fileName) : '');
  const payload = {
    type: PROMPTBAG_GENERATE_MSG,
    prompt: String(prompt || '').trim(),
    imageDataUrl: resolvedUrl,
    imageUrl: resolvedUrl,
    name: fileName,
    libraryDisplayName: displayName,
    builtPrompt: String(builtPrompt || '').trim(),
    mergeMode: !!mergeMode,
    useBuiltPrompt: !!useBuiltPrompt,
    count: String(count || '').trim(),
    images: Array.isArray(payloadImages)
      ? payloadImages
      : (resolvedUrl ? [{ dataUrl: resolvedUrl, name: fileName }] : []),
    openNewTab: openNewTab !== false
  };
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, window.location.origin);
      setStatus('جاري الإرسال إلى التوليد...', 'ok');
      return;
    }
  } catch (_) { /* ignore */ }
  window.dispatchEvent(new CustomEvent(PROMPTBAG_GENERATE_MSG, { detail: payload }));
  setStatus('جاري الإرسال إلى التوليد...', 'ok');
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || '';
          if (/receiving end|extension context/i.test(msg)) {
            resolve({ success: false, error: 'امتداد NHP غير جاهز — أعد فتح النافذة أو أعد تحميل الامتداد' });
            return;
          }
          resolve({ success: false, error: msg || 'runtime message failed' });
          return;
        }
        if (response === undefined) {
          resolve({
            success: false,
            error: 'لا استجابة من الخلفية — قد تكون بيانات الحقيبة كبيرة'
          });
          return;
        }
        resolve(response);
      });
    } catch (err) {
      const msg = err?.message || String(err);
      if (/receiving end|extension context/i.test(msg)) {
        reject(new Error('امتداد NHP غير جاهز — أعد فتح النافذة أو أعد تحميل الامتداد'));
        return;
      }
      if (msg === 'Failed to fetch') {
        reject(new Error('تعذّر الاتصال — تحقق من Ghost Server أو اضغط إعادة الاتصال'));
        return;
      }
      reject(err);
    }
  });
}

async function loadBag() {
  pbBagLoaded = false;
  pbBagLoadError = '';
  await pbDetectGhostPort();
  let loadSource = 'background';
  let res;
  try {
    res = await sendMessage({ action: 'PROMPT_BAG_GET' });
  } catch (err) {
    res = { success: false, error: err?.message || String(err) };
  }
  if (res?.success) {
    prompts = Array.isArray(res.prompts) ? res.prompts : [];
    images = Array.isArray(res.images) ? res.images : [];
    noteNiches = Array.isArray(res.noteNiches) ? res.noteNiches : [];
    pbBagLoaded = true;
  } else {
    pbBagLoadError = pbDescribeBagLoadError(res?.error);
    try {
      await pbLoadBagFromStorage();
      loadSource = 'storage';
      pbBagLoaded = true;
    } catch (storageErr) {
      pbBagLoaded = false;
      pbBagLoadError = pbDescribeBagLoadError(storageErr?.message || pbBagLoadError);
      pbUpdateConnBadge();
      throw new Error(pbBagLoadError);
    }
  }
  renderPrompts();
  renderImages();
  renderNotes();
  void autoGenerateMissingImagePrompts();
  pbUpdateConnBadge();
  const tone = loadSource === 'storage' && res?.error ? 'warn' : 'ok';
  setStatus(pbBuildLoadStatusMessage(loadSource), tone);
}

async function savePrompts() {
  const res = await sendMessage({ action: 'PROMPT_BAG_SAVE_PROMPTS', prompts });
  if (!res?.success) throw new Error(res?.error || 'Unable to save prompts.');
  prompts = res.prompts || prompts;
  renderPrompts();
  refreshImagePromptSelectOptionsOnly();
}

async function saveImages(options = {}) {
  const silent = !!options.silent;
  const res = await sendMessage({ action: 'PROMPT_BAG_SAVE_IMAGES', images });
  if (!res?.success) throw new Error(res?.error || 'Unable to save images.');
  images = res.images || images;
  if (!silent) renderImages();
}

function imageNeedsAutoPrompt(image) {
  if (!image?.id || !image?.dataUrl) return false;
  const geminiPrompt = String(image.promptGemini || '').trim();
  const gptPrompt = String(image.promptGpt || '').trim();
  const isLegacyPrompt = (value) => /redraw the design provided|artisan hand-drawn illustration|no mockups|create 4 completely new|recreate the exact subject/i.test(String(value || ''));
  if (Number(image.autoPromptVersion || 0) !== AUTO_PROMPT_VERSION) return true;
  if ((geminiPrompt || gptPrompt) && !isLegacyPrompt(geminiPrompt) && !isLegacyPrompt(gptPrompt)) return false;
  if (image.autoPromptStatus === 'running') return false;
  return true;
}

async function generatePromptForImage(image, options = {}) {
  if (!image?.id || !image?.dataUrl) throw new Error('Image data is missing.');
  const silent = options.silent === true;
  if (autoPromptInFlight.has(image.id)) return String(image.promptGemini || image.promptGpt || '').trim();
  autoPromptInFlight.add(image.id);
  image.autoPromptStatus = 'running';
  const applyLocal = (generatedPrompt, meta = {}) => {
    image.promptGemini = generatedPrompt;
    image.promptGpt = generatedPrompt;
    image.autoPromptStatus = 'done';
    image.autoPromptFallback = !!meta.fallback;
    image.autoPromptError = meta.fallback ? String(meta.warning || '').trim() : '';
    image.autoPromptVersion = Number(meta.version || AUTO_PROMPT_VERSION);
  };
  try {
    if (!silent) setStatus('Analyzing image and generating prompt...');
    const res = await sendMessage({
      action: 'PROMPT_BAG_GENERATE_IMAGE_PROMPT',
      imageId: image.id,
      name: image.name || 'Prompt Bag Image'
    });
    if (res?.success && String(res.prompt || '').trim()) {
      const generatedPrompt = String(res.prompt || '').trim();
      applyLocal(generatedPrompt, { fallback: res.fallback, warning: res.warning, version: res.version });
      await saveImages({ silent: true });
      if (!silent) {
        renderImages();
        setStatus(
          res.fallback ? 'تم استخدام برومبت افتراضي (تحليل AI غير متاح)' : (res.modelUsed ? `AI prompt generated via ${res.modelUsed}` : 'AI prompt generated and linked to the image'),
          res.fallback ? 'warn' : 'ok'
        );
      }
      return generatedPrompt;
    }
    const fallbackPrompt = buildPromptBagStrictFallbackPrompt();
    applyLocal(fallbackPrompt, { fallback: true, warning: res?.error || 'AI prompt generation failed.' });
    await saveImages({ silent: true });
    if (!silent) {
      renderImages();
      setStatus('تم استخدام برومبت افتراضي', 'warn');
    }
    return fallbackPrompt;
  } catch (error) {
    const fallbackPrompt = buildPromptBagStrictFallbackPrompt();
    applyLocal(fallbackPrompt, { fallback: true, warning: error?.message || 'AI prompt generation failed.' });
    await saveImages({ silent: true });
    if (!silent) {
      renderImages();
      setStatus('تم استخدام برومبت افتراضي', 'warn');
    }
    return fallbackPrompt;
  } finally {
    autoPromptInFlight.delete(image.id);
  }
}

async function autoGenerateMissingImagePrompts() {
  if (autoPromptQueueRunning) return;
  autoPromptQueueRunning = true;
  try {
    const pending = images.filter(imageNeedsAutoPrompt);
    if (!pending.length) return;
    setStatus(`Analyzing ${pending.length} new image(s)...`);
    for (const image of pending) {
      await generatePromptForImage(image, { silent: true }).catch(() => {});
    }
    renderImages();
    setStatus('Automatic prompt generation completed', 'ok');
  } finally {
    autoPromptQueueRunning = false;
  }
}

async function copyText(text) {
  await navigator.clipboard.writeText(String(text || ''));
  setStatus('تم النسخ', 'ok');
}

async function pasteText(text) {
  const res = await sendMessage({ action: 'PROMPT_BAG_PASTE_TEXT', text });
  setStatus(res?.success ? 'تم اللصق في الصفحة النشطة' : (res?.error || 'تعذر اللصق'), res?.success ? 'ok' : 'error');
}

async function copyImage(dataUrl) {
  const src = pbRewriteGhostSrc(dataUrl);
  const blob = await (await fetch(src)).blob();
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type || 'image/png']: blob })
  ]);
  setStatus('تم نسخ الصورة', 'ok');
}

async function pasteImage(dataUrl) {
  const target = document.activeElement || document.body;
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], `nhp-prompt-bag-${Date.now()}.png`, { type: blob.type || 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  target.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt
  }));
  const input = document.querySelector('input[type="file"]');
  if (input) {
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  setStatus('تمت محاولة لصق الصورة', 'ok');
}

function getCurrentAiTargetUrl() {
  const host = String(window.location.hostname || '').toLowerCase();
  if (host.includes('chatgpt.com')) return CHATGPT_IMAGE_GPT_URL;
  if (host.includes('gemini.google.com')) return GEMINI_IMAGE_GEM_URL;
  return '';
}

function buildPromptBagStrictFallbackPrompt() {
  const base = 'Generate exactly 4 distinct print-ready apparel graphics based only on the printable design visible in the reference. If the reference is a shirt mockup, flat garment photo, product photo, or model wearing apparel, extract only the printed logo/text/symbols/color mood from the garment and do not redraw the shirt, model, mannequin, fabric folds, product photo, watermark, or original background. Place the redesigned graphic only on a solid black background (#000000). Analyze the design subject and mood, then choose the best 4 matching styles from this list: Vintage Distressed, 70s Retro Groovy, Meme Graphic / Sarcastic, Line Art Minimalism, Bold Varsity / Collegiate, Cottagecore Aesthetic, 90s Grunge / Y2K, Cute Kawaii Chibi, 80s Neon Synthwave, Dark Academia, Watercolor Splatter, Ukiyo-e Japanese, Sumi-e Zen, Gothic / Witchy, Cartoon Tattoo Style, Comic / Pop Art, Psychedelic Trippy, Pixel Art, Glitch Art, Cyberpunk / Futuristic. Use one selected style per design variation. If the extracted printable graphic contains a person or character, create 4 different pose/action variations for that character only, one per design, such as standing, sitting, leaning, walking, jumping, crouching, dancing, running, or dynamic action. If the printable graphic has no person or character, do not invent a body pose. Preserve the core theme, keep high contrast, strong readable silhouette, and centered apparel composition. Output final designs only.';
  return typeof appendNhpTextPreservationRule === 'function' ? appendNhpTextPreservationRule(base) : base;
}

function resolvePromptBagStrictPrompt(value) {
  const explicit = String(value || '').trim();
  if (!explicit) return buildPromptBagStrictFallbackPrompt();
  if (/redraw the design provided|artisan hand-drawn illustration|no mockups/i.test(explicit)) {
    return buildPromptBagStrictFallbackPrompt();
  }
  return explicit;
}

async function getGeneratedOrManualImagePrompt(image, explicitPrompt, options = {}) {
  const explicit = String(explicitPrompt || '').trim();
  if (explicit) return resolvePromptBagStrictPrompt(explicit);
  const saved = String(image?.promptGpt || image?.promptGemini || '').trim();
  if (saved && image?.autoPromptStatus === 'done') return resolvePromptBagStrictPrompt(saved);
  const generated = await generatePromptForImage(image, { silent: options.silent === true });
  if (String(generated || '').trim()) return resolvePromptBagStrictPrompt(generated);
  return resolvePromptBagStrictPrompt(buildPromptBagStrictFallbackPrompt());
}

async function pasteImageWithPrompt(image, imageCard) {
  const targetUrl = getCurrentAiTargetUrl();
  if (!targetUrl) return;
  const explicit = targetUrl.includes('chatgpt.com')
    ? String(imageCard?.querySelector('[data-role="prompt-gpt"]')?.value || image.promptGpt || '').trim()
    : String(imageCard?.querySelector('[data-role="prompt-gemini"]')?.value || image.promptGemini || '').trim();
  const promptText = await getGeneratedOrManualImagePrompt(image, explicit);
  if (!String(promptText || '').trim()) return;
  await pasteImage(image.dataUrl);
  await pasteText(promptText);
}

async function sendImage(image, targetUrl, promptOverride = '') {
  const explicit = await getGeneratedOrManualImagePrompt(image, promptOverride);
  const payload = {
    action: 'PROMPT_BAG_SEND_IMAGE',
    dataUrl: image.dataUrl,
    name: image.name || 'Prompt Bag Image',
    targetUrl,
    promptText: explicit
  };
  const res = await sendMessage(payload);
  setStatus(res?.success ? 'تم إرسال الصورة' : (res?.error || 'فشل إرسال الصورة'), res?.success ? 'ok' : 'error');
}

function renderPromptsLegacyUnused() {
  const list = $('prompts-list');
  if (!list) return;
  if (!prompts.length) {
    list.innerHTML = '<div class="meta">لا توجد برومبتات بعد. حدّد نصاً في أي صفحة واضغط يمين ثم احفظه، أو أضف برومبت من هنا.</div>';
    return;
  }
  list.innerHTML = prompts.map((prompt) => `
    <article class="prompt-card" data-id="${prompt.id}">
      <div class="prompt-title">
        <span>${escapeHtml(prompt.favorite ? `★ ${prompt.title || 'Prompt'}` : (prompt.title || 'Prompt'))}</span>
        <span class="meta">${escapeHtml(prompt.tag || 'general')}</span>
      </div>
      <div class="prompt-text">${escapeHtml(prompt.text || '')}</div>
      <div class="btn-row">
        <button data-action="copy">نسخ</button>
        <button class="safe" data-action="paste">لصق</button>
        <button data-action="edit">تعديل</button>
        <button data-action="favorite">${prompt.favorite ? 'إلغاء التثبيت' : 'تثبيت'}</button>
        <button class="danger" data-action="delete">حذف</button>
      </div>
    </article>
  `).join('');
}

function renderPrompts() {
  const list = $('prompts-list');
  if (!list) return;
  if (!prompts.length) {
    list.innerHTML = '<div class="meta image-empty">No saved prompts yet. Add one here or save selected text from the context menu.</div>';
    return;
  }
  list.innerHTML = prompts.map((prompt, index) => {
    const title = prompt.favorite ? `* ${prompt.title || 'Prompt'}` : (prompt.title || 'Prompt');
    return `
      <article class="prompt-settings-card" data-id="${escapeHtml(prompt.id)}">
        <div class="prompt-title">
          <span>${escapeHtml(title)}</span>
          <span class="meta">${escapeHtml(prompt.tag || 'general')}</span>
        </div>
        <div class="prompt-text">${escapeHtml(prompt.text || '')}</div>
        <div class="btn-row">
          <button class="generate-btn" data-action="generate" title="Send to Prompt Generator">Generate</button>
          <button data-action="copy">Copy</button>
          <button class="safe" data-action="paste">Paste</button>
          <button data-action="edit">Edit</button>
          <button data-action="move-up" ${index === 0 ? 'disabled' : ''}>Up</button>
          <button data-action="move-down" ${index === prompts.length - 1 ? 'disabled' : ''}>Down</button>
          <button data-action="favorite">${prompt.favorite ? 'Unpin' : 'Pin'}</button>
          <button class="danger" data-action="delete">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function pbImageNicheLabel(image) {
  const niche = String(image?.niche || '').trim();
  if (niche) return niche;
  const fromName = typeof NHP_nicheTitleFromFileName === 'function'
    ? NHP_nicheTitleFromFileName(image?.name || '')
    : String(image?.name || '').replace(/\.(png|jpe?g|webp)$/i, '').trim();
  if (fromName && typeof NHP_isLegacyRadarBagName === 'function' && NHP_isLegacyRadarBagName(fromName)) {
    return 'بدون نيتش';
  }
  return fromName || 'بدون نيتش';
}

function pbGroupImagesByNiche(list = []) {
  const groups = new Map();
  (Array.isArray(list) ? list : []).forEach((image) => {
    const label = pbImageNicheLabel(image);
    const key = label.toLowerCase();
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key).items.push(image);
  });
  return [...groups.values()];
}

function pbLibraryDisplayNameFromImage(image) {
  const label = pbImageNicheLabel(image);
  return label === 'بدون نيتش' ? '' : label;
}

function pbNicheKey(label = '') {
  return String(label || '').trim().toLowerCase();
}

function pbImageCreatedAt(image) {
  const raw = image?.createdAt || image?.addedAt || image?.savedAt || image?.updatedAt || image?.timestamp || 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const parsed = Date.parse(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pbLoadCollapseState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PB_COLLAPSE_KEY) || '{}');
    pbNicheCollapseState = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    pbNicheCollapseState = {};
  }
}

function pbSaveCollapseState() {
  try {
    localStorage.setItem(PB_COLLAPSE_KEY, JSON.stringify(pbNicheCollapseState || {}));
  } catch (_) { /* ignore */ }
}

function pbIsGroupOpen(group, index = 0) {
  const key = pbNicheKey(group?.label);
  if (Object.prototype.hasOwnProperty.call(pbNicheCollapseState, key)) {
    return pbNicheCollapseState[key] !== false;
  }
  return index === 0;
}

function pbSetGroupOpen(label, open) {
  const key = pbNicheKey(label);
  if (!key) return;
  pbNicheCollapseState[key] = !!open;
  pbSaveCollapseState();
}

function pbGetFilteredSortedImageGroups() {
  const query = pbImageSearch.trim().toLowerCase();
  let filtered = Array.isArray(images) ? images : [];
  if (query) {
    filtered = filtered.filter((image) => {
      const haystack = [
        pbImageNicheLabel(image),
        image?.name,
        image?.promptGemini,
        image?.promptGpt
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }
  const groups = pbGroupImagesByNiche(filtered).map((group) => ({
    ...group,
    newestAt: Math.max(0, ...group.items.map(pbImageCreatedAt))
  }));
  groups.sort((a, b) => {
    if (pbImageSort === 'count') return b.items.length - a.items.length || a.label.localeCompare(b.label);
    if (pbImageSort === 'date') return b.newestAt - a.newestAt || a.label.localeCompare(b.label);
    return a.label.localeCompare(b.label);
  });
  return groups;
}

function renderImageCardHtml(image) {
  return `
      <article class="image-card" data-id="${image.id}" data-action="paste-image-card" title="انقر للتعامل مع تصميمك">
        <button type="button" class="delete-image-corner-btn" data-action="delete-image" title="حذف التصميم">×</button>
        <img src="${image.dataUrl}" alt="" title="انقر لحقن الصورة والبرومبت في التوليد (وسط الصورة)">
        <div class="meta" title="${escapeHtml(image.name || '')}">${escapeHtml(image.name || 'image')}</div>
        <details class="image-prompt-expand">
          <summary>تعديل البرومبت المرافق (Gemini / ChatGPT)</summary>
          <label class="meta image-prompt-label">Gemini — من المحفوظ
            <select data-role="pick-prompt-gemini" class="image-prompt-select">${buildSavedPromptSelectOptionsHtml()}</select>
          </label>
          <label class="meta image-prompt-label">Gemini — اتركه فارغاً للبرومبت الافتراضي
            <textarea data-role="prompt-gemini" rows="2" spellcheck="true" placeholder="برومبت مخصص لإرسال هذه الصورة إلى Gemini…">${escapeHtml(image.promptGemini || '')}</textarea>
          </label>
          <label class="meta image-prompt-label">ChatGPT — من المحفوظ
            <select data-role="pick-prompt-gpt" class="image-prompt-select">${buildSavedPromptSelectOptionsHtml()}</select>
          </label>
          <label class="meta image-prompt-label">ChatGPT — اتركه فارغاً للبرومبت الافتراضي
            <textarea data-role="prompt-gpt" rows="2" spellcheck="true" placeholder="برومبت مخصص لإرسال هذه الصورة إلى ChatGPT…">${escapeHtml(image.promptGpt || '')}</textarea>
          </label>
        </details>
        <div class="image-card-actions">
          <button type="button" class="generate-btn" data-action="generate" title="توليد تلقائي">⚡</button>
          <button type="button" class="safe" data-action="gemini" title="إرسال إلى Gemini">♊</button>
          <button type="button" class="safe" data-action="gpt" title="إرسال إلى ChatGPT">💬</button>
        </div>
      </article>
    `;
}

async function pbBuildCurrentMergePrompt(label) {
  try {
    const res = await sendMessage({
      action: 'BUILD_RADAR_MERGE_APPAREL_PROMPT',
      niche: String(label || '').trim()
    });
    if (String(res?.prompt || '').trim()) return String(res.prompt).trim();
  } catch (_) { /* fallback below */ }
  return buildPromptBagStrictFallbackPrompt();
}

async function pbRandomMergeNiche(label) {
  const groupImages = (Array.isArray(images) ? images : []).filter((image) => pbNicheKey(pbImageNicheLabel(image)) === pbNicheKey(label));
  if (groupImages.length < 2) {
    setStatus('Random Merge needs at least 2 images in this niche.', 'warn');
    return;
  }
  const firstIndex = Math.floor(Math.random() * groupImages.length);
  let secondIndex = Math.floor(Math.random() * groupImages.length);
  if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % groupImages.length;
  const first = groupImages[firstIndex];
  const second = groupImages[secondIndex];
  const firstCard = document.querySelector(`.image-card[data-id="${CSS.escape(String(first.id || ''))}"]`);
  const secondCard = document.querySelector(`.image-card[data-id="${CSS.escape(String(second.id || ''))}"]`);
  const firstDataUrl = await resolveImageCardDataUrl(first, firstCard);
  const secondDataUrl = await resolveImageCardDataUrl(second, secondCard);
  if (!firstDataUrl || !secondDataUrl) {
    setStatus('Unable to read both images for Random Merge.', 'error');
    return;
  }
  const libraryDisplayName = String(label || '').trim();
  const mergePrompt = await pbBuildCurrentMergePrompt(libraryDisplayName);
  dispatchPromptBagGenerate({
    prompt: mergePrompt,
    builtPrompt: mergePrompt,
    imageDataUrl: firstDataUrl,
    name: `${libraryDisplayName || 'random-merge'}.png`,
    libraryDisplayName,
    mergeMode: true,
    useBuiltPrompt: true,
    count: '4',
    images: [
      { dataUrl: firstDataUrl, name: first.name || `${libraryDisplayName}-1.png` },
      { dataUrl: secondDataUrl, name: second.name || `${libraryDisplayName}-2.png` }
    ]
  });
  setStatus(`Random Merge sent: ${libraryDisplayName || 'niche'} (4 designs)`, 'ok');
}

function renderImages() {
  const list = $('images-list');
  const count = $('image-count');
  const nicheTotal = $('niche-total');
  const imageTotal = $('image-total');
  const allGroups = pbGroupImagesByNiche(images);
  const groups = pbGetFilteredSortedImageGroups();
  const filteredImageCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (count) count.textContent = `${allGroups.length} niches / ${images.length} images`;
  if (nicheTotal) nicheTotal.textContent = `${groups.length} niches`;
  if (imageTotal) imageTotal.textContent = `${filteredImageCount} images`;
  if (!list) return;
  if (!images.length) {
    list.innerHTML = '<div class="meta image-empty">No images</div>';
    return;
  }
  if (!groups.length) {
    list.innerHTML = '<div class="meta image-empty">No matches</div>';
    return;
  }
  list.innerHTML = `
    ${groups.map((group, index) => {
      const isOpen = pbIsGroupOpen(group, index);
      const key = pbNicheKey(group.label);
      return `
        <section class="image-niche-group ${isOpen ? '' : 'is-collapsed'}" data-niche-key="${escapeHtml(key)}" data-niche-label="${escapeHtml(group.label)}">
          <div class="image-niche-group-title" data-action="toggle-niche" role="button" tabindex="0" aria-expanded="${isOpen ? 'true' : 'false'}">
            <span class="chevron">${isOpen ? 'v' : '>'}</span>
            <span class="image-niche-group-name" title="${escapeHtml(group.label)}">${escapeHtml(group.label)} <span class="meta">(${group.items.length})</span></span>
            <span class="image-niche-group-actions">
              <button type="button" class="generate-btn" data-action="random-merge">Random Merge</button>
              <button type="button" class="danger" data-action="delete-group">حذف المجموعة</button>
            </span>
          </div>
          <div class="image-niche-group-grid">
            ${isOpen ? group.items.map((image) => renderImageCardHtml(image)).join('') : ''}
          </div>
        </section>
      `;
    }).join('')}
  `;
}

function renderNotes() {
  const list = $('notes-list');
  const count = $('note-count');
  if (count) count.textContent = `${noteNiches.length} notes`;
  if (!list) return;
  if (!noteNiches.length) {
    list.innerHTML = '<div class="meta">No note niches found yet.</div>';
    return;
  }
  list.innerHTML = `
    <div class="btn-row">
      <button data-action="copy-all-notes">Copy All Notes</button>
    </div>
    ${noteNiches.map((item) => `
      <article class="prompt-card note-card" data-note-text="${escapeHtml(item.text)}" data-action="paste-note" title="Click to paste this niche">
        <div class="prompt-title">
          <span>${escapeHtml(item.text)}</span>
          <span class="meta">${escapeHtml(item.done ? 'done' : (item.quality || 'note'))}</span>
        </div>
        <div class="btn-row">
          <button data-action="copy-note">Copy</button>
          <button class="safe" data-action="paste-note">Paste</button>
        </div>
      </article>
    `).join('')}
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildSavedPromptSelectOptionsHtml() {
  const head = '<option value="">— اختر من البرومبتات المحفوظة —</option>';
  if (!Array.isArray(prompts) || !prompts.length) {
    return '<option value="">— لا توجد برومبتات محفوظة —</option>';
  }
  const body = prompts
    .filter((p) => p && String(p.id || '').trim())
    .map((p) => {
      const label =
        String(p.title || '').trim()
        || String(p.text || '').trim().replace(/\s+/g, ' ').slice(0, 56)
        || 'Prompt';
      return `<option value="${escapeHtml(String(p.id))}">${escapeHtml(label)}</option>`;
    })
    .join('');
  return head + body;
}

function refreshImagePromptSelectOptionsOnly() {
  const html = buildSavedPromptSelectOptionsHtml();
  document.querySelectorAll('select[data-role="pick-prompt-gemini"], select[data-role="pick-prompt-gpt"]').forEach((sel) => {
    sel.innerHTML = html;
  });
}

function fillEditor(prompt) {
  $('prompt-title').value = prompt?.title || '';
  $('prompt-tag').value = prompt?.tag || '';
  $('prompt-text').value = prompt?.text || '';
  $('add-prompt-btn').dataset.editId = prompt?.id || '';
}

async function upsertPromptFromEditor() {
  const title = $('prompt-title').value.trim();
  const tag = $('prompt-tag').value.trim();
  const text = $('prompt-text').value.trim();
  const editId = $('add-prompt-btn').dataset.editId || '';
  if (!text) {
    setStatus('اكتب البرومبت أولاً', 'error');
    return;
  }
  const now = Date.now();
  if (editId) {
    prompts = prompts.map((prompt) => prompt.id === editId
      ? { ...prompt, title: title || text.slice(0, 60), tag, text, updatedAt: now }
      : prompt);
  } else {
    prompts = [{
      id: makeId('prompt'),
      title: title || text.split(/\s+/).slice(0, 8).join(' ').slice(0, 80),
      tag,
      text,
      favorite: false,
      createdAt: now,
      updatedAt: now
    }, ...prompts];
  }
  await savePrompts();
  fillEditor(null);
  setStatus('تم حفظ البرومبت', 'ok');
}

document.addEventListener('click', async (event) => {
  const promptPasteTarget = event.target.closest('.prompt-card[data-action="paste-prompt"]');
  if (promptPasteTarget && !event.target.closest('button')) {
    const prompt = prompts.find((item) => item.id === promptPasteTarget.dataset.id);
    if (!prompt) return;
    try {
      if (isEmbeddedInGenerateSplit()) {
        dispatchPromptBagGenerate({ prompt: prompt.text || '' });
      } else {
        await pasteText(prompt.text);
      }
    } catch (error) {
      setStatus(error?.message || 'تعذر إرسال البرومبت', 'error');
    }
    return;
  }

  const imageCardPasteTarget = event.target.closest('.image-card[data-action="paste-image-card"]');
  const imageClickTarget = event.target.closest('.image-card img');
  if (imageClickTarget) {
    event.preventDefault();
    event.stopPropagation();
    const imageCard = imageClickTarget.closest('.image-card');
    const image = images.find((item) => item.id === imageCard?.dataset.id);
    if (!image) return;
    try {
      const explicit = String(
        imageCard?.querySelector('[data-role="prompt-gemini"]')?.value
        || image.promptGemini
        || image.promptGpt
        || ''
      ).trim();
      setStatus('جاري تجهيز الصورة والبرومبت للصق...', 'ok');
      await injectImageCardToGenerate(image, imageCard, explicit, { silent: true });
    } catch (error) {
      setStatus(error?.message || 'تعذر إرسال الصورة', 'error');
    }
    return;
  }

  if (imageCardPasteTarget && !event.target.closest('button, details, summary, textarea, select, input, label, img, .image-card-menu-panel')) {
    const imageCard = imageCardPasteTarget.closest('.image-card') || imageCardPasteTarget;
    const image = images.find((item) => item.id === imageCard?.dataset.id);
    if (!image) return;
    try {
      if (isEmbeddedInGenerateSplit()) {
        const explicit = String(
          imageCard?.querySelector('[data-role="prompt-gemini"]')?.value
          || image.promptGemini
          || image.promptGpt
          || ''
        ).trim();
        setStatus('جاري تجهيز الصورة والبرومبت للتوليد...', 'ok');
        await sendImageCardToGenerate(image, imageCard, explicit, { silent: true });
      } else {
        await pasteImageWithPrompt(image, imageCard);
      }
    } catch (error) {
      setStatus(error?.message || 'تعذر إرسال الصورة', 'error');
    }
    return;
  }

  const notePasteTarget = event.target.closest('.note-card[data-action="paste-note"]');
  if (notePasteTarget && !event.target.closest('button')) {
    const text = notePasteTarget.dataset.noteText || '';
    if (!text) return;
    try {
      await pasteText(text);
    } catch (error) {
      setStatus(error?.message || 'Unable to paste note', 'error');
    }
    return;
  }

  const nicheToggle = event.target.closest('.image-niche-group-title[data-action="toggle-niche"]');
  if (nicheToggle && !event.target.closest('button')) {
    const groupEl = nicheToggle.closest('.image-niche-group');
    const label = groupEl?.dataset.nicheLabel || '';
    const nextOpen = groupEl?.classList.contains('is-collapsed');
    pbSetGroupOpen(label, nextOpen);
    renderImages();
    return;
  }

  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.id === 'reload-btn' || button.id === 'top-reload-btn') {
      await loadBag();
      return;
    }
    if (button.dataset.action === 'jump-images') {
      document.querySelector('.images-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (button.dataset.action === 'jump-prompts') {
      document.querySelector('.prompts-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (button.dataset.action === 'open-gem' || button.dataset.action === 'open-gpt') {
      const url = button.dataset.action === 'open-gem' ? GEMINI_IMAGE_GEM_URL : CHATGPT_IMAGE_GPT_URL;
      const opened = window.open(url, '_blank', 'popup=yes,width=980,height=760');
      if (!opened) setStatus('Unable to open AI popup', 'error');
      return;
    }
    if (button.dataset.action === 'open-settings') {
      const modal = $('settings-modal');
      if (modal) {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
      }
      return;
    }
    if (button.dataset.action === 'close-settings') {
      const modal = $('settings-modal');
      if (modal) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    if (button.id === 'add-prompt-btn') {
      await upsertPromptFromEditor();
      return;
    }
    if (button.id === 'clear-editor-btn') {
      fillEditor(null);
      return;
    }
    if (button.dataset.action === 'clear-images') {
      if (!confirm('Clear all Prompt Bag images?')) return;
      images = [];
      await saveImages();
      setStatus('Images cleared', 'ok');
      return;
    }
    if (button.dataset.action === 'clear-prompts') {
      if (!confirm('Clear all Prompt Bag prompts?')) return;
      prompts = [];
      await savePrompts();
      fillEditor(null);
      setStatus('Prompts cleared', 'ok');
      return;
    }
    if (button.dataset.action === 'copy-all-notes') {
      await copyText(noteNiches.map((item) => item.text).join('\n'));
      return;
    }
    if (button.dataset.action === 'copy-note' || button.dataset.action === 'paste-note') {
      const noteCard = button.closest('.note-card');
      const text = noteCard?.dataset.noteText || '';
      if (!text) return;
      if (button.dataset.action === 'copy-note') await copyText(text);
      if (button.dataset.action === 'paste-note') await pasteText(text);
      return;
    }

    if (button.dataset.action === 'random-merge') {
      event.stopPropagation();
      const groupEl = button.closest('.image-niche-group');
      const label = groupEl?.dataset.nicheLabel || '';
      await pbRandomMergeNiche(label);
      return;
    }

    if (button.dataset.action === 'delete-group') {
      event.stopPropagation();
      const groupEl = button.closest('.image-niche-group');
      const label = groupEl?.dataset.nicheLabel || '';
      if (!label) return;
      if (!confirm(`هل أنت متأكد من حذف جميع صور مجموعة "${label}"؟`)) return;
      images = images.filter((img) => pbImageNicheLabel(img) !== label);
      await saveImages();
      setStatus(`تم حذف مجموعة ${label}`, 'ok');
      return;
    }

    const promptCard = button.closest('.prompt-card, .prompt-settings-card');
    if (promptCard) {
      const prompt = prompts.find((item) => item.id === promptCard.dataset.id);
      if (!prompt) return;
      const action = button.dataset.action;
      if (action === 'copy') await copyText(prompt.text);
      if (action === 'paste') await pasteText(prompt.text);
      if (action === 'generate' || action === 'send-generate') {
        dispatchPromptBagGenerate({ prompt: prompt.text || '' });
        return;
      }
      if (action === 'edit') fillEditor(prompt);
      if (action === 'favorite') {
        prompts = prompts.map((item) => ({ ...item, favorite: item.id === prompt.id ? !item.favorite : false }));
        await savePrompts();
      }
      if (action === 'move-up' || action === 'move-down') {
        const index = prompts.findIndex((item) => item.id === prompt.id);
        const nextIndex = action === 'move-up' ? index - 1 : index + 1;
        if (index >= 0 && nextIndex >= 0 && nextIndex < prompts.length) {
          const reordered = [...prompts];
          const [item] = reordered.splice(index, 1);
          reordered.splice(nextIndex, 0, item);
          prompts = reordered;
          await savePrompts();
        }
      }
      if (action === 'delete') {
        prompts = prompts.filter((item) => item.id !== prompt.id);
        await savePrompts();
      }
      return;
    }

    const imageCard = button.closest('.image-card');
    if (imageCard) {
      const menu = button.closest('details.image-card-menu');
      if (menu?.open) menu.open = false;
      const image = images.find((item) => item.id === imageCard.dataset.id);
      if (!image) return;
      const action = button.dataset.action;
      if (action === 'copy-image') await copyImage(image.dataUrl);
      if (action === 'paste-image') {
        if (isEmbeddedInGenerateSplit()) {
          const pg = (imageCard.querySelector('[data-role="prompt-gemini"]')?.value ?? image.promptGemini ?? '').trim();
          setStatus('جاري تجهيز الصورة والبرومبت للتوليد...', 'ok');
          await sendImageCardToGenerate(image, imageCard, pg, { silent: true });
        } else {
          await pasteImageWithPrompt(image, imageCard);
        }
        return;
      }
      if (action === 'generate' || action === 'send-generate') {
        event.stopPropagation();
        const pg = (imageCard.querySelector('[data-role="prompt-gemini"]')?.value ?? image.promptGemini ?? '').trim();
        setStatus('جاري تجهيز البرومبت والصورة للتوليد...', 'ok');
        await sendImageCardToGenerate(image, imageCard, pg, { silent: true });
        return;
      }
      if (action === 'gemini') {
        const pg = (imageCard.querySelector('[data-role="prompt-gemini"]')?.value ?? '').trim();
        await sendImage(image, GEMINI_IMAGE_GEM_URL, pg);
      }
      if (action === 'gpt') {
        const pc = (imageCard.querySelector('[data-role="prompt-gpt"]')?.value ?? '').trim();
        await sendImage(image, CHATGPT_IMAGE_GPT_URL, pc);
      }
      if (action === 'delete-image') {
        event.stopPropagation();
        if (!confirm('هل تريد حذف هذا التصميم من الحقيبة؟')) return;
        images = images.filter((item) => item.id !== image.id);
        await saveImages();
      }
    }
  } catch (error) {
    setStatus(error?.message || 'حدث خطأ', 'error');
  }
});

document.addEventListener('change', async (event) => {
  const sel = event.target;
  if (!(sel instanceof HTMLSelectElement)) return;
  const pickRole = sel.getAttribute('data-role');
  if (pickRole !== 'pick-prompt-gemini' && pickRole !== 'pick-prompt-gpt') return;
  const pid = sel.value;
  if (!pid) return;
  const prompt = prompts.find((p) => String(p.id) === pid);
  if (!prompt || !String(prompt.text || '').trim()) {
    sel.selectedIndex = 0;
    return;
  }
  const card = sel.closest('.image-card');
  if (!card) return;
  const taRole = pickRole === 'pick-prompt-gemini' ? 'prompt-gemini' : 'prompt-gpt';
  const ta = card.querySelector(`textarea[data-role="${taRole}"]`);
  if (ta) ta.value = String(prompt.text || '');
  sel.selectedIndex = 0;
  const image = images.find((item) => item.id === card.dataset.id);
  if (image) {
    if (pickRole === 'pick-prompt-gemini') image.promptGemini = (ta?.value ?? '').trimEnd();
    else image.promptGpt = (ta?.value ?? '').trimEnd();
    try {
      await saveImages({ silent: true });
      setStatus('تم إدراج وحفظ البرومبت المحفوظ مع الصورة', 'ok');
    } catch (error) {
      setStatus(error?.message || 'تعذر الحفظ', 'error');
    }
  } else {
    setStatus('تم إدراج البرومبت — اضغط خارج الحقل لحفظه مع الصورة', 'ok');
  }
});

document.addEventListener('focusout', async (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'TEXTAREA') return;
  const role = target.getAttribute('data-role');
  if (role !== 'prompt-gemini' && role !== 'prompt-gpt') return;
  const imageCard = target.closest('.image-card');
  if (!imageCard) return;
  const image = images.find((item) => item.id === imageCard.dataset.id);
  if (!image) return;
  const nextGemini = (imageCard.querySelector('[data-role="prompt-gemini"]')?.value ?? '').trimEnd();
  const nextGpt = (imageCard.querySelector('[data-role="prompt-gpt"]')?.value ?? '').trimEnd();
  if ((image.promptGemini || '') === nextGemini && (image.promptGpt || '') === nextGpt) return;
  image.promptGemini = nextGemini;
  image.promptGpt = nextGpt;
  try {
    await saveImages({ silent: true });
    setStatus('تم حفظ البرومبت مع الصورة', 'ok');
  } catch (error) {
    setStatus(error?.message || 'تعذر حفظ البرومبت', 'error');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const modal = $('settings-modal');
    if (modal?.classList.contains('is-open')) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target?.matches?.('.image-niche-group-title[data-action="toggle-niche"]')) {
    event.preventDefault();
    const groupEl = event.target.closest('.image-niche-group');
    const label = groupEl?.dataset.nicheLabel || '';
    const nextOpen = groupEl?.classList.contains('is-collapsed');
    pbSetGroupOpen(label, nextOpen);
    renderImages();
  }
});

$('image-search')?.addEventListener('input', (event) => {
  pbImageSearch = String(event.target?.value || '');
  renderImages();
});

$('image-sort')?.addEventListener('change', (event) => {
  pbImageSort = String(event.target?.value || 'name');
  renderImages();
});

$('settings-modal')?.addEventListener('click', (event) => {
  if (event.target?.id !== 'settings-modal') return;
  event.currentTarget.classList.remove('is-open');
  event.currentTarget.setAttribute('aria-hidden', 'true');
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  let changed = false;
  if (changes.nhpPromptBagPrompts) {
    prompts = Array.isArray(changes.nhpPromptBagPrompts.newValue) ? changes.nhpPromptBagPrompts.newValue : [];
    changed = true;
  }
  if (changes.nhpPromptBagImages) {
    images = Array.isArray(changes.nhpPromptBagImages.newValue) ? changes.nhpPromptBagImages.newValue : [];
    changed = true;
  }
  if (changes.teepublic_manager_data) {
    noteNiches = Array.isArray(changes.teepublic_manager_data.newValue?.niches)
      ? noteNiches
      : noteNiches;
  }
  if (changed) {
    renderPrompts();
    renderImages();
    void autoGenerateMissingImagePrompts();
  }
});

async function pbReconnect() {
  setStatus('جاري فحص الاتصال وتحميل الحقيبة...', 'ok');
  try {
    await loadBag();
    if (!pbGhostConnected) {
      setStatus(pbBagLoaded ? 'غير متصل بـ Ghost — تم تحميل الحقيبة من التخزين المحلي' : pbBuildLoadStatusMessage('storage'), 'warn');
    }
  } catch (error) {
    pbUpdateConnBadge();
    setStatus(error?.message || 'تعذر إعادة الاتصال', 'error');
  }
}

$('pb-reconnect-btn')?.addEventListener('click', () => { void pbReconnect(); });

pbLoadCollapseState();

loadBag().catch((error) => {
  renderPrompts();
  renderImages();
  renderNotes();
  pbUpdateConnBadge();
  setStatus(error?.message || 'تعذر تحميل الحقيبة', 'error');
});
