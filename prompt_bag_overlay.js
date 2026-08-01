(() => {
  const hostName = String(location?.hostname || '').toLowerCase();
  if (hostName === 'remotedesktop.google.com' || hostName.endsWith('.remotedesktop.google.com')) {
    return;
  }
  // EmailCore admin uses emailcore-bridge.js — skip Prompt Bag overlay so idle
  // chrome.runtime.sendMessage does not spam "Receiving end does not exist".
  {
    const path = String(location.pathname || '/');
    const isAdminHost =
      hostName === 'nocochat.com'
      || hostName.endsWith('.nocochat.com')
      || hostName === 'emailcore.app'
      || hostName.endsWith('.emailcore.app')
      || hostName.endsWith('.onrender.com')
      || hostName === 'localhost'
      || hostName === '127.0.0.1';
    if (isAdminHost && (path === '/admin' || path.startsWith('/admin/'))) {
      return;
    }
  }
  if (window.__NHP_PROMPT_BAG_OVERLAY__) return;
  window.__NHP_PROMPT_BAG_OVERLAY__ = true;

  const GEMINI_IMAGE_GEM_URL = 'https://gemini.google.com/gem/6bc2d8e9f911';
  const CHATGPT_IMAGE_GPT_URL = 'https://chatgpt.com/g/g-69db6eabc5e48191844d04a90423616c-artisan-teepublic';
  const PROMPTS_KEY = 'nhpPromptBagPrompts';
  const IMAGES_KEY = 'nhpPromptBagImages';
  const NOTE_DATA_KEY = 'teepublic_manager_data';
  const OVERLAY_ENABLED_KEY = 'nhpPromptBagOverlayEnabled';
  const MAX_PROMPTS = 120;
  const MAX_IMAGES = 80;

  let prompts = [];
  let images = [];
  let noteNiches = [];
  let isOpen = false;
  let lastEditable = null;
  let autoPromptQueueRunning = false;
  const autoPromptInFlight = new Set();
  const AUTO_PROMPT_VERSION = 7;

  const host = document.createElement('div');
  host.id = 'nhp-prompt-bag-overlay-host';
  const shadow = host.attachShadow({ mode: 'open' });
  // Mounted only when nhpPromptBagOverlayEnabled !== false (see applyOverlayEnabled).

  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: "Segoe UI", Tahoma, Arial, sans-serif; }
      .fab {
        position: fixed;
        right: 1.125rem;
        bottom: 1.125rem;
        z-index: 2147483646;
        width: 2.625rem;
        height: 2.625rem;
        border-radius: 999px;
        border: 1px solid rgba(129,140,248,.65);
        background: #111827;
        color: #fff;
        box-shadow: 0 10px 28px rgba(0,0,0,.35);
        cursor: pointer;
        display: grid;
        place-items: center;
        font: 700 1.125rem/1 "Segoe UI", Tahoma, Arial, sans-serif;
      }
      .fab:hover { background: #1f2937; border-color: #a5b4fc; }
      .panel {
        position: fixed;
        right: 1.125rem;
        bottom: 4.25rem;
        z-index: 2147483646;
        width: min(27.5rem, calc(100vw - 1.75rem));
        max-height: min(40rem, calc(100vh - 5.75rem));
        color: #e5e7eb;
        background: #0f131d;
        border: 1px solid rgba(148,163,184,.28);
        border-radius: 0.625rem;
        box-shadow: 0 18px 48px rgba(0,0,0,.48);
        overflow: hidden;
        display: none;
        direction: rtl;
      }
      .panel.open { display: flex; flex-direction: column; }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.5625rem 0.625rem;
        background: #151b29;
        border-bottom: 1px solid rgba(148,163,184,.22);
      }
      .title { font: 800 0.8125rem/1.2 "Segoe UI", Tahoma, Arial, sans-serif; color: #fff; }
      .head-links { display: flex; gap: 0.3125rem; flex: 0 0 auto; flex-wrap: nowrap; justify-content: flex-end; }
      .tabs { display: flex; gap: 0.3125rem; flex-wrap: nowrap; }
      button {
        border: 1px solid rgba(148,163,184,.25);
        border-radius: 0.4375rem;
        background: #111827;
        color: #e5e7eb;
        padding: 0.375rem 0.5rem;
        font: 700 0.6875rem/1 "Segoe UI", Tahoma, Arial, sans-serif;
        cursor: pointer;
      }
      button:hover { border-color: #818cf8; color: #fff; }
      button.active { background: rgba(129,140,248,.22); border-color: rgba(129,140,248,.58); }
      button.link-btn { background: rgba(129,140,248,.16); border-color: rgba(129,140,248,.44); }
      button.link-btn.gemini { background: rgba(16,185,129,.13); border-color: rgba(16,185,129,.4); }
      button.ai { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.55); color: #ff6b6b; min-width: 2.875rem; }
      button.ai:disabled { cursor: wait; opacity: .65; }
      button.safe { background: rgba(16,185,129,.13); border-color: rgba(16,185,129,.38); }
      button.danger { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.36); }
      .body { min-height: 0; overflow: auto; padding: 0.625rem; display: grid; gap: 0.5rem; }
      .status { color: #94a3b8; font: 600 0.6875rem/1.4 "Segoe UI", Tahoma, Arial, sans-serif; min-height: 1rem; }
      .card {
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 0.5rem;
        background: #101624;
        padding: 0.5rem;
        display: grid;
        gap: 0.4375rem;
      }
      .card-title { display:flex; justify-content:space-between; gap:0.5rem; color:#fff; font:800 0.75rem/1.35 "Segoe UI", Tahoma, Arial, sans-serif; }
      .muted { color:#94a3b8; font:600 0.625rem/1.35 "Segoe UI", Tahoma, Arial, sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .prompt-text {
        color:#cbd5e1;
        font:500 0.6875rem/1.45 "Segoe UI", Tahoma, Arial, sans-serif;
        direction:auto;
        white-space:pre-wrap;
        max-height:4.75rem;
        overflow:auto;
      }
      .prompt-paste-card { cursor:pointer; }
      .prompt-paste-card:hover { border-color:rgba(16,185,129,.72); }
      .row { display:flex; gap:0.3125rem; flex-wrap:wrap; align-items:center; }
      .images { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:0.5rem; }
      .image-card img {
        width:100%;
        aspect-ratio:1;
        object-fit:contain;
        background:#090d18;
        border:1px solid rgba(148,163,184,.16);
        border-radius:0.4375rem;
        cursor:pointer;
      }
      .image-card img:hover { border-color:rgba(16,185,129,.72); }
      details.image-prompt-expand {
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 0.4375rem;
        padding: 0.3125rem 0.375rem;
        background: #0a0e18;
      }
      details.image-prompt-expand summary {
        cursor: pointer;
        font: 700 0.625rem/1.35 "Segoe UI", Tahoma, Arial, sans-serif;
        color: #94a3b8;
        user-select: none;
      }
      label.image-prompt-label {
        display: grid;
        gap: 0.1875rem;
        margin-top: 0.375rem;
        font: 600 0.5625rem/1.35 "Segoe UI", Tahoma, Arial, sans-serif;
        color: #94a3b8;
      }
      label.image-prompt-label textarea {
        width: 100%;
        min-height: 2.75rem;
        resize: vertical;
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 0.375rem;
        background: #0f172a;
        color: #e5e7eb;
        padding: 0.3125rem;
        font: 500 0.625rem/1.4 "Segoe UI", Tahoma, Arial, sans-serif;
        outline: none;
      }
      label.image-prompt-label textarea:focus { border-color: rgba(129,140,248,.55); }
      select.image-prompt-select {
        width: 100%;
        margin-top: 0.125rem;
        padding: 0.3125rem 0.375rem;
        font: 600 0.625rem/1.3 "Segoe UI", Tahoma, Arial, sans-serif;
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 0.375rem;
        background: #0f172a;
        color: #e5e7eb;
        cursor: pointer;
      }
      select.image-prompt-select:focus { border-color: rgba(129,140,248,.55); outline: none; }
      .empty { color:#94a3b8; font:600 0.75rem/1.5 "Segoe UI", Tahoma, Arial, sans-serif; padding:0.625rem; }
      .hidden { display:none !important; }
      @media (max-width: 32.5rem) {
        .images { grid-template-columns: 1fr; }
        .head { align-items: flex-start; flex-direction: column; }
        .head-links, .tabs { flex-wrap: wrap; }
      }
    </style>
    <button class="fab" id="fab" title="NHP Prompt Bag">🎒</button>
    <section class="panel" id="panel" aria-label="NHP Prompt Bag">
      <div class="head">
        <div class="title">NHP Prompt Bag</div>
        <div class="head-links" aria-label="AI quick links">
          <button class="link-btn" id="open-chatgpt" title="Open Artisan TeePublic GPT popup">GPT</button>
          <button class="link-btn gemini" id="open-gemini" title="Open Gemini Gem popup">GEM</button>
        </div>
        <div class="tabs">
          <button id="tab-prompts" class="active">Prompts</button>
          <button id="tab-images">Images</button>
          <button id="tab-notes">Notes</button>
          <button id="refresh">تحديث</button>
        </div>
      </div>
      <div class="body">
        <div class="status" id="status">جاهز</div>
        <div id="prompts-view"></div>
        <div id="images-view" class="hidden"></div>
        <div id="notes-view" class="hidden"></div>
      </div>
    </section>
  `;

  const $ = (id) => shadow.getElementById(id);
  const fab = $('fab');
  const panel = $('panel');
  const statusEl = $('status');
  const promptsView = $('prompts-view');
  const imagesView = $('images-view');
  const notesView = $('notes-view');
  const tabPrompts = $('tab-prompts');
  const tabImages = $('tab-images');
  const tabNotes = $('tab-notes');

  function setStatus(message, ok = true) {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#94a3b8' : '#f87171';
  }

  async function openAiTool(url) {
    try {
      const res = await sendMessage({
        action: 'PROMPT_BAG_OPEN_AI_POPUP',
        url,
        width: url.includes('gemini.google.com') ? 900 : 980,
        height: 760
      });
      if (!res?.success) throw new Error(res?.error || 'Unable to open AI popup');
      setStatus('Opened AI popup');
    } catch (error) {
      setStatus(error?.message || 'Unable to open AI tool', false);
    }
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
    const head = '<option value="">— اختر من المحفوظ —</option>';
    if (!Array.isArray(prompts) || !prompts.length) {
      return '<option value="">— لا توجد برومبتات —</option>';
    }
    const body = prompts
      .filter((p) => p && String(p.id || '').trim())
      .map((p) => {
        const label =
          String(p.title || '').trim()
          || String(p.text || '').trim().replace(/\s+/g, ' ').slice(0, 48)
          || 'Prompt';
        return `<option value="${escapeHtml(String(p.id))}">${escapeHtml(label)}</option>`;
      })
      .join('');
    return head + body;
  }

  function refreshImagePromptSelectOptionsOnly() {
    const html = buildSavedPromptSelectOptionsHtml();
    shadow.querySelectorAll('select[data-role="pick-prompt-gemini"], select[data-role="pick-prompt-gpt"]').forEach((sel) => {
      sel.innerHTML = html;
    });
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        const maybePromise = chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response);
        });
        // MV3: sendMessage also returns a Promise that rejects with Receiving end — swallow it.
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(() => {}).catch(() => {});
        }
      } catch (error) {
        resolve({ success: false, error: error?.message || 'runtime message failed' });
      }
    });
  }

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(payload) {
    return new Promise((resolve) => chrome.storage.local.set(payload, resolve));
  }

  async function loadBag() {
    const res = await sendMessage({ action: 'PROMPT_BAG_GET' });
    if (res?.success) {
      prompts = Array.isArray(res.prompts) ? res.prompts : [];
      images = Array.isArray(res.images) ? res.images : [];
      noteNiches = Array.isArray(res.noteNiches) ? res.noteNiches : [];
    } else {
      const stored = await storageGet([PROMPTS_KEY, IMAGES_KEY, NOTE_DATA_KEY]);
      prompts = Array.isArray(stored?.[PROMPTS_KEY]) ? stored[PROMPTS_KEY] : [];
      images = Array.isArray(stored?.[IMAGES_KEY]) ? stored[IMAGES_KEY] : [];
      noteNiches = normalizeNoteNiches(stored?.[NOTE_DATA_KEY]);
      if (res?.error) setStatus(`تم التحميل محلياً: ${res.error}`);
    }
    render();
    void autoGenerateMissingImagePrompts();
    setStatus(`Prompts: ${prompts.length} | Images: ${images.length} | Notes: ${noteNiches.length}`);
  }

  async function savePrompts() {
    const res = await sendMessage({ action: 'PROMPT_BAG_SAVE_PROMPTS', prompts });
    if (res?.success) {
      prompts = Array.isArray(res.prompts) ? res.prompts : prompts;
    } else {
      prompts = prompts
        .filter((item) => item && String(item.text || '').trim())
        .slice(0, MAX_PROMPTS);
      await storageSet({ [PROMPTS_KEY]: prompts });
    }
    renderPrompts();
    refreshImagePromptSelectOptionsOnly();
  }

  async function saveImages(options = {}) {
    const silent = !!options.silent;
    const res = await sendMessage({ action: 'PROMPT_BAG_SAVE_IMAGES', images });
    if (res?.success) {
      images = Array.isArray(res.images) ? res.images : images;
    } else {
      images = images
        .filter((item) => item && String(item.dataUrl || '').startsWith('data:image/'))
        .slice(0, MAX_IMAGES);
      await storageSet({ [IMAGES_KEY]: images });
    }
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

  function applyPromptToImage(image, imageCard, generatedPrompt, options = {}) {
    image.promptGemini = generatedPrompt;
    image.promptGpt = generatedPrompt;
    image.autoPromptStatus = 'done';
    image.autoPromptFallback = !!options.fallback;
    image.autoPromptError = options.fallback ? String(options.warning || '').trim() : '';
    image.autoPromptVersion = Number(options.version || AUTO_PROMPT_VERSION);
    const geminiPrompt = imageCard?.querySelector('[data-role="prompt-gemini"]');
    const gptPrompt = imageCard?.querySelector('[data-role="prompt-gpt"]');
    if (geminiPrompt) geminiPrompt.value = generatedPrompt;
    if (gptPrompt) gptPrompt.value = generatedPrompt;
  }

  async function generatePromptForImage(image, imageCard, button) {
    if (!image?.dataUrl) throw new Error('Image data is missing.');
    if (image?.id && autoPromptInFlight.has(image.id)) {
      return String(image.promptGemini || image.promptGpt || '').trim();
    }
    if (image?.id) autoPromptInFlight.add(image.id);
    image.autoPromptStatus = 'running';
    if (button) {
      button.disabled = true;
      button.textContent = '...';
    }
    try {
      setStatus('Generating AI prompt...');
      const res = await sendMessage({
        action: 'PROMPT_BAG_GENERATE_IMAGE_PROMPT',
        imageId: image.id,
        name: image.name || 'Prompt Bag Image'
      });
      if (res?.success && String(res.prompt || '').trim()) {
        const generatedPrompt = String(res.prompt || '').trim();
        applyPromptToImage(image, imageCard, generatedPrompt, {
          fallback: res.fallback,
          warning: res.warning,
          version: res.version
        });
        await saveImages({ silent: true });
      setStatus(
        res.fallback
          ? 'تم استخدام برومبت افتراضي (تحليل AI غير متاح)'
          : (res.modelUsed ? `AI prompt saved via ${res.modelUsed}` : 'AI prompt saved for this image')
      );
        return generatedPrompt;
      }
      const fallbackPrompt = buildPromptBagStrictFallbackPrompt();
      applyPromptToImage(image, imageCard, fallbackPrompt, {
        fallback: true,
        warning: res?.error || 'AI prompt generation failed.',
        version: AUTO_PROMPT_VERSION
      });
      await saveImages({ silent: true });
      setStatus('تم استخدام برومبت افتراضي', false);
      return fallbackPrompt;
    } catch (error) {
      const fallbackPrompt = buildPromptBagStrictFallbackPrompt();
      applyPromptToImage(image, imageCard, fallbackPrompt, {
        fallback: true,
        warning: error?.message || 'AI prompt generation failed.',
        version: AUTO_PROMPT_VERSION
      });
      await saveImages({ silent: true });
      setStatus('تم استخدام برومبت افتراضي', false);
      return fallbackPrompt;
    } finally {
      if (image?.id) autoPromptInFlight.delete(image.id);
      if (button) {
        button.disabled = false;
        button.textContent = 'AI';
      }
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
        await generatePromptForImage(image, null, null).catch(() => {});
      }
      renderImages();
      setStatus('Automatic prompt generation completed', true);
    } finally {
      autoPromptQueueRunning = false;
    }
  }

  function render() {
    renderPrompts();
    renderImages();
    renderNotes();
  }

  function renderPromptsLegacyUnused() {
    if (!prompts.length) {
      promptsView.innerHTML = '<div class="empty">لا توجد برومبتات بعد. احفظ نصاً من قائمة الزر الأيمن أو من صفحة الإدارة.</div>';
      return;
    }
    promptsView.innerHTML = prompts.map((prompt) => `
      <article class="card" data-id="${prompt.id}">
        <div class="card-title">
          <span>${escapeHtml(prompt.favorite ? `★ ${prompt.title || 'Prompt'}` : (prompt.title || 'Prompt'))}</span>
          <span class="muted">${escapeHtml(prompt.tag || 'general')}</span>
        </div>
        <div class="prompt-text">${escapeHtml(prompt.text || '')}</div>
        <div class="row">
          <button data-action="copy-prompt">نسخ</button>
          <button class="safe" data-action="paste-prompt">لصق</button>
        </div>
      </article>
    `).join('');
  }

  function renderPrompts() {
    const addBtn = '<button class="safe" data-action="add-prompt">+</button>';
    const copyAllBtn = prompts.length ? '<button data-action="copy-all-prompts">Copy All</button>' : '';
    const clearBtn = prompts.length ? '<button class="danger" data-action="clear-prompts">Clear Prompts</button>' : '';
    if (!prompts.length) {
      promptsView.innerHTML = `<div class="row">${addBtn}</div><div class="empty">No saved prompts yet. Press + to add one or save selected text from the right-click menu.</div>`;
      return;
    }
    promptsView.innerHTML = `
      <div class="row">${addBtn}${copyAllBtn}${clearBtn}</div>
      ${prompts.map((prompt) => `
        <article class="card prompt-paste-card" data-id="${prompt.id}" data-action="paste-prompt" title="Click to paste this prompt">
          <div class="card-title">
            <span>${escapeHtml(prompt.favorite ? `* ${prompt.title || 'Prompt'}` : (prompt.title || 'Prompt'))}</span>
            <span class="muted">${escapeHtml(prompt.tag || 'general')}</span>
          </div>
          <div class="prompt-text">${escapeHtml(prompt.text || '')}</div>
          <div class="row">
            <button data-action="copy-prompt">Copy</button>
            <button class="safe" data-action="paste-prompt">Paste</button>
            <button data-action="edit-prompt">Edit</button>
            <button class="danger" data-action="delete-prompt">Delete</button>
          </div>
        </article>
      `).join('')}
    `;
  }

  function renderImagesLegacyUnused() {
    const importBtn = '<button class="safe" data-action="import-clipboard">استيراد صورة من الحافظة</button>';
    if (!images.length) {
      imagesView.innerHTML = `<div class="row">${importBtn}</div><div class="empty">لا توجد صور محفوظة. احفظ صورة من قائمة الزر الأيمن أو استورد من الحافظة.</div>`;
      return;
    }
    imagesView.innerHTML = `
      <div class="row">${importBtn}</div>
      <div class="images">
        ${images.map((image) => `
          <article class="card image-card" data-id="${image.id}">
            <img src="${image.dataUrl}" alt="" data-action="paste-image" title="Click to paste this image">
            <div class="muted" title="${escapeHtml(image.name || '')}">${escapeHtml(image.name || 'image')}</div>
            <div class="row">
              <button data-action="copy-image">نسخ</button>
              <button data-action="paste-image">لصق</button>
              <button class="safe" data-action="send-gemini">Gemini</button>
              <button class="safe" data-action="send-gpt">GPT</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderImages() {
    const importBtn = '<button class="safe" data-action="import-clipboard">Import Clipboard</button>';
    const clearBtn = images.length ? '<button class="danger" data-action="clear-images">Clear Images</button>' : '';
    if (!images.length) {
      imagesView.innerHTML = `<div class="row">${importBtn}</div><div class="empty">No saved images yet. Save an image from the right-click menu or import one from the clipboard.</div>`;
      return;
    }
    imagesView.innerHTML = `
      <div class="row">${importBtn}${clearBtn}</div>
      <div class="images">
        ${images.map((image) => `
          <article class="card image-card" data-id="${image.id}">
            <img src="${image.dataUrl}" alt="" data-action="paste-image" title="Click to paste this image">
            <div class="muted" title="${escapeHtml(image.name || '')}">${escapeHtml(image.name || 'image')}</div>
            <details class="image-prompt-expand">
              <summary>تعديل البرومبت المرافق</summary>
              <label class="image-prompt-label">Gemini — من المحفوظ
                <select data-role="pick-prompt-gemini" class="image-prompt-select">${buildSavedPromptSelectOptionsHtml()}</select>
              </label>
              <label class="image-prompt-label">Gemini — نص مخصص (فارغ = افتراضي)
                <textarea data-role="prompt-gemini" rows="2" spellcheck="true" placeholder="برومبت مخصص لـ Gemini…">${escapeHtml(image.promptGemini || '')}</textarea>
              </label>
              <label class="image-prompt-label">ChatGPT — من المحفوظ
                <select data-role="pick-prompt-gpt" class="image-prompt-select">${buildSavedPromptSelectOptionsHtml()}</select>
              </label>
              <label class="image-prompt-label">ChatGPT — نص مخصص (فارغ = افتراضي)
                <textarea data-role="prompt-gpt" rows="2" spellcheck="true" placeholder="برومبت مخصص لـ ChatGPT…">${escapeHtml(image.promptGpt || '')}</textarea>
              </label>
            </details>
            <div class="row">
              <button data-action="copy-image">Copy</button>
              <button data-action="paste-image">Paste</button>
              <button class="safe" data-action="send-gemini">Gemini</button>
              <button class="safe" data-action="send-gpt">GPT</button>
              <button class="ai" data-action="generate-ai-prompt" title="Generate companion prompt with AI">AI</button>
              <button class="danger" data-action="delete-image">Delete</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function normalizeNoteNiches(noteData) {
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

  function renderNotes() {
    if (!notesView) return;
    if (!noteNiches.length) {
      notesView.innerHTML = '<div class="empty">No note niches found yet.</div>';
      return;
    }
    notesView.innerHTML = `
      <div class="row">
        <button data-action="copy-all-notes">Copy All Notes</button>
      </div>
      ${noteNiches.map((item) => `
        <article class="card prompt-paste-card" data-note-text="${escapeHtml(item.text)}" data-action="paste-note" title="Click to paste this niche">
          <div class="card-title">
            <span>${escapeHtml(item.text)}</span>
            <span class="muted">${escapeHtml(item.done ? 'done' : (item.quality || 'note'))}</span>
          </div>
          <div class="row">
            <button data-action="copy-note">Copy</button>
            <button class="safe" data-action="paste-note">Paste</button>
          </div>
        </article>
      `).join('')}
    `;
  }

  function isEditableElement(el) {
    if (!el || el === host || !el.isConnected) return false;
    if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
    if (el instanceof HTMLInputElement) {
      const type = String(el.type || 'text').toLowerCase();
      return !el.disabled && !el.readOnly && ['text', 'search', 'url', 'email', 'tel', 'password'].includes(type);
    }
    return !!(el.isContentEditable || el.getAttribute?.('role') === 'textbox');
  }

  function isVisibleElement(el) {
    if (!el?.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function closestEditable(target) {
    const el = target?.nodeType === Node.TEXT_NODE ? target.parentElement : target;
    if (!el || el === host) return null;
    if (isEditableElement(el)) return el;
    return el.closest?.('textarea,input,[contenteditable="true"],[contenteditable=""],[role="textbox"]') || null;
  }

  function rememberEditable(target) {
    const editable = closestEditable(target);
    if (isEditableElement(editable)) lastEditable = editable;
  }

  function collectDeepEditables(root, out = []) {
    if (!root || out.length > 120) return out;
    const selectors = [
      'rich-textarea textarea',
      'rich-textarea [contenteditable="true"]',
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '.ql-editor',
      '[aria-label*="prompt" i]',
      '[aria-label*="message" i]',
      '[aria-label*="enter" i]'
    ];
    try {
      root.querySelectorAll?.(selectors.join(',')).forEach((el) => {
        if (isEditableElement(el) && !out.includes(el)) out.push(el);
      });
      root.querySelectorAll?.('*').forEach((el) => {
        if (el.shadowRoot) collectDeepEditables(el.shadowRoot, out);
      });
    } catch (_) {
    }
    return out;
  }

  function getFocusedEditable() {
    const activeEditable = closestEditable(document.activeElement);
    if (isEditableElement(activeEditable) && isVisibleElement(activeEditable)) return activeEditable;
    if (isEditableElement(lastEditable) && isVisibleElement(lastEditable)) return lastEditable;
    const candidates = collectDeepEditables(document)
      .filter((el) => isEditableElement(el) && isVisibleElement(el))
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return candidates[0] || null;
  }

  function collectDeepFileInputs(root, out = []) {
    if (!root || out.length > 80) return out;
    try {
      root.querySelectorAll?.('input[type="file"]').forEach((input) => {
        if (!input.disabled && !out.includes(input)) out.push(input);
      });
      root.querySelectorAll?.('*').forEach((el) => {
        if (el.shadowRoot) collectDeepFileInputs(el.shadowRoot, out);
      });
    } catch (_) {
    }
    return out;
  }

  function acceptsImageFile(input) {
    const accept = String(input?.accept || '').toLowerCase().trim();
    return !accept || accept.includes('image') || accept.includes('*/*') || accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg') || accept.includes('.webp');
  }

  function setInputFiles(input, files) {
    if (!input || !files?.length) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (setter) setter.call(input, files);
    else input.files = files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function dispatchFileEvent(target, type, dataTransfer) {
    if (!target) return false;
    const event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer
    });
    target.dispatchEvent(event);
    return true;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitForImageFileInputs(timeoutMs = 1200) {
    const startedAt = Date.now();
    do {
      const inputs = collectDeepFileInputs(document)
        .filter(acceptsImageFile)
        .sort((a, b) => Number(isVisibleElement(b)) - Number(isVisibleElement(a)));
      if (inputs.length) return inputs;
      await sleep(120);
    } while (Date.now() - startedAt < timeoutMs);
    return [];
  }

  function setNativeValue(target, value) {
    const proto = target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(target, value);
    else target.value = value;
  }

  function insertContentEditableText(target, text) {
    target.focus({ preventScroll: true });
    const selection = window.getSelection?.();
    if (selection && (!selection.rangeCount || !target.contains(selection.anchorNode))) {
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const before = target.textContent || '';
    const inserted = document.execCommand?.('insertText', false, text);
    target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    if (!inserted && (target.textContent || '') === before) {
      target.textContent = `${before}${text}`;
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    return true;
  }

  function insertText(text) {
    const target = getFocusedEditable();
    if (!target) return false;
    target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const start = Number.isFinite(target.selectionStart) ? target.selectionStart : target.value.length;
      const end = Number.isFinite(target.selectionEnd) ? target.selectionEnd : target.value.length;
      const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
      setNativeValue(target, nextValue);
      const cursor = start + text.length;
      target.setSelectionRange?.(cursor, cursor);
      target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return insertContentEditableText(target, text);
  }

  async function copyImage(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
  }

  async function pasteImage(dataUrl) {
    const target = getFocusedEditable() || document.activeElement || document.body;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `nhp-prompt-bag-${Date.now()}.png`, { type: blob.type || 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    target?.focus?.({ preventScroll: true });

    const fileInputs = await waitForImageFileInputs();
    for (const input of fileInputs) {
      if (setInputFiles(input, dt.files)) return true;
    }

    const pasteTargets = [target, document.activeElement, document.body, document].filter(Boolean);
    for (const pasteTarget of [...new Set(pasteTargets)]) {
      pasteTarget.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      }));
    }

    const dropTarget = target?.closest?.('form, main, [role="main"], [contenteditable="true"], [role="textbox"]') || target || document.body;
    dispatchFileEvent(dropTarget, 'dragenter', dt);
    dispatchFileEvent(dropTarget, 'dragover', dt);
    dispatchFileEvent(dropTarget, 'drop', dt);
    return true;
  }

  function getCurrentAiTargetUrl() {
    const href = String(window.location.href || '');
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

  async function getGeneratedOrManualImagePrompt(image, explicitPrompt) {
    const explicit = String(explicitPrompt || '').trim();
    if (explicit) return resolvePromptBagStrictPrompt(explicit);
    const saved = String(image?.promptGpt || image?.promptGemini || '').trim();
    if (saved && image?.autoPromptStatus === 'done') return resolvePromptBagStrictPrompt(saved);
    const generated = await generatePromptForImage(image, null, null);
    if (String(generated || '').trim()) return resolvePromptBagStrictPrompt(generated);
    return resolvePromptBagStrictPrompt(buildPromptBagStrictFallbackPrompt());
  }

  async function pasteImageWithPrompt(image, imageCard) {
    const targetUrl = getCurrentAiTargetUrl();
    if (!targetUrl) {
      return;
    }
    const explicit = targetUrl.includes('chatgpt.com')
      ? String(imageCard?.querySelector('[data-role="prompt-gpt"]')?.value || image.promptGpt || '').trim()
      : String(imageCard?.querySelector('[data-role="prompt-gemini"]')?.value || image.promptGemini || '').trim();
    const promptText = await getGeneratedOrManualImagePrompt(image, explicit);
    if (!String(promptText || '').trim()) {
      return;
    }
    await pasteImage(image.dataUrl);
    await sleep(900);
    const inserted = insertText(promptText);
    if (!inserted) {
      await sleep(1200);
      insertText(promptText);
    }
  }

  async function importClipboardImage() {
    if (!navigator.clipboard?.read) throw new Error('Clipboard image read is not available here.');
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((candidate) => candidate.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      images = [{
        id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `clipboard-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.png`,
        sourceUrl: 'clipboard',
        dataUrl,
        originalBytes: blob.size || 0,
        storedBytes: blob.size || 0,
        createdAt: Date.now()
      }, ...images].slice(0, MAX_IMAGES);
      await saveImages();
      setStatus('تم استيراد صورة من الحافظة');
      return;
    }
    throw new Error('لا توجد صورة في الحافظة.');
  }

  async function addPromptFromDialog() {
    const text = prompt('Prompt text');
    if (!text || !text.trim()) return;
    const title = prompt('Prompt title (optional)') || '';
    const tag = prompt('Prompt tag (optional)') || '';
    const now = Date.now();
    prompts = [{
      id: `prompt_${now}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim() || text.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 80),
      tag: tag.trim(),
      text: text.trim(),
      favorite: false,
      createdAt: now,
      updatedAt: now
    }, ...prompts].slice(0, MAX_PROMPTS);
    await savePrompts();
    setStatus('Prompt added');
  }

  async function editPromptFromDialog(promptItem) {
    if (!promptItem) return;
    const text = prompt('Prompt text', promptItem.text || '');
    if (text === null || !text.trim()) return;
    const title = prompt('Prompt title (optional)', promptItem.title || '') || '';
    const tag = prompt('Prompt tag (optional)', promptItem.tag || '') || '';
    const now = Date.now();
    prompts = prompts.map((item) => item.id === promptItem.id
      ? {
        ...item,
        title: title.trim() || text.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 80),
        tag: tag.trim(),
        text: text.trim(),
        updatedAt: now
      }
      : item);
    await savePrompts();
    setStatus('Prompt updated');
  }

  function setTab(name) {
    const showImages = name === 'images';
    const showNotes = name === 'notes';
    promptsView.classList.toggle('hidden', showImages || showNotes);
    imagesView.classList.toggle('hidden', !showImages);
    notesView.classList.toggle('hidden', !showNotes);
    tabPrompts.classList.toggle('active', !showImages && !showNotes);
    tabImages.classList.toggle('active', showImages);
    tabNotes.classList.toggle('active', showNotes);
  }

  fab.addEventListener('click', async () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      try { await loadBag(); } catch (error) { setStatus(error?.message || 'تعذر التحميل', false); }
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (Object.prototype.hasOwnProperty.call(changes, OVERLAY_ENABLED_KEY)) {
      applyOverlayEnabled(changes[OVERLAY_ENABLED_KEY].newValue);
    }
    let changed = false;
    if (changes[PROMPTS_KEY]) {
      prompts = Array.isArray(changes[PROMPTS_KEY].newValue) ? changes[PROMPTS_KEY].newValue : [];
      changed = true;
    }
    if (changes[IMAGES_KEY]) {
      images = Array.isArray(changes[IMAGES_KEY].newValue) ? changes[IMAGES_KEY].newValue : [];
      changed = true;
    }
    if (changes[NOTE_DATA_KEY]) {
      noteNiches = normalizeNoteNiches(changes[NOTE_DATA_KEY].newValue);
      changed = true;
    }
    if (changed && host.isConnected) {
      render();
      void autoGenerateMissingImagePrompts();
      setStatus(`Prompts: ${prompts.length} | Images: ${images.length} | Notes: ${noteNiches.length}`);
    }
  });

  function isOverlayEnabled(value) {
    return value !== false;
  }

  function applyOverlayEnabled(value) {
    const enabled = isOverlayEnabled(value);
    if (enabled) {
      if (!host.isConnected) {
        (document.documentElement || document.body)?.appendChild(host);
      }
      return;
    }
    isOpen = false;
    panel.classList.remove('open');
    if (host.isConnected) host.remove();
  }

  try {
    chrome.storage.local.get([OVERLAY_ENABLED_KEY], (res) => {
      applyOverlayEnabled(res?.[OVERLAY_ENABLED_KEY]);
    });
  } catch (_) {
    applyOverlayEnabled(true);
  }

  document.addEventListener('focusin', (event) => {
    rememberEditable(event.target);
  }, true);

  document.addEventListener('pointerdown', (event) => {
    rememberEditable(event.target);
  }, true);

  shadow.addEventListener('click', async (event) => {
    const promptPasteTarget = event.target.closest('[data-action="paste-prompt"][data-id]');
    if (promptPasteTarget && !event.target.closest('button')) {
      const prompt = prompts.find((item) => item.id === promptPasteTarget.dataset.id);
      if (!prompt) return;
      try {
        const ok = insertText(prompt.text || '');
        setStatus(ok ? 'تم لصق البرومبت' : 'ضع المؤشر داخل حقل كتابة أولاً', ok);
      } catch (error) {
        setStatus(error?.message || 'حدث خطأ', false);
      }
      return;
    }

    const notePasteTarget = event.target.closest('[data-action="paste-note"][data-note-text]');
    if (notePasteTarget && !event.target.closest('button')) {
      const text = notePasteTarget.dataset.noteText || '';
      if (!text) return;
      try {
        const ok = insertText(text);
        setStatus(ok ? 'Note pasted' : 'Focus an input field first', ok);
      } catch (error) {
        setStatus(error?.message || 'Paste failed', false);
      }
      return;
    }

    const imagePasteTarget = event.target.closest('img[data-action="paste-image"], .image-card img');
    if (imagePasteTarget) {
      const imageCard = imagePasteTarget.closest('[data-id]');
      const image = images.find((item) => item.id === imageCard?.dataset.id);
      if (!image) return;
      try {
        await pasteImageWithPrompt(image, imageCard);
        setStatus('تمت محاولة لصق الصورة');
      } catch (error) {
        setStatus(error?.message || 'حدث خطأ', false);
      }
      return;
    }

    const button = event.target.closest('button');
    if (!button) return;
    try {
      if (button.id === 'tab-prompts') return setTab('prompts');
      if (button.id === 'tab-images') return setTab('images');
      if (button.id === 'tab-notes') return setTab('notes');
      if (button.id === 'open-chatgpt') return openAiTool(CHATGPT_IMAGE_GPT_URL);
      if (button.id === 'open-gemini') return openAiTool(GEMINI_IMAGE_GEM_URL);
      if (button.id === 'refresh') {
        await loadBag();
        return;
      }
      const promptCard = button.closest('[data-id]');
      const action = button.dataset.action;
      if (action === 'add-prompt') {
        await addPromptFromDialog();
        return;
      }
      if (action === 'clear-prompts') {
        if (!confirm('Clear all Prompt Bag prompts?')) return;
        prompts = [];
        await savePrompts();
        setStatus('Prompts cleared');
        return;
      }
      if (action === 'copy-all-prompts') {
        const text = prompts
          .map((item, index) => `${index + 1}. ${item.title || 'Prompt'}\n${item.text || ''}`)
          .join('\n\n---\n\n');
        await navigator.clipboard.writeText(text);
        setStatus('All prompts copied');
        return;
      }
      if (action === 'delete-prompt') {
        const prompt = prompts.find((item) => item.id === promptCard?.dataset.id);
        if (!prompt) return;
        prompts = prompts.filter((item) => item.id !== prompt.id);
        await savePrompts();
        setStatus('Prompt deleted');
        return;
      }
      if (action === 'edit-prompt') {
        const prompt = prompts.find((item) => item.id === promptCard?.dataset.id);
        await editPromptFromDialog(prompt);
        return;
      }
      if (action === 'copy-prompt' || action === 'paste-prompt') {
        const prompt = prompts.find((item) => item.id === promptCard?.dataset.id);
        if (!prompt) return;
        if (action === 'copy-prompt') {
          await navigator.clipboard.writeText(prompt.text || '');
          setStatus('تم نسخ البرومبت');
        } else {
          const ok = insertText(prompt.text || '');
          setStatus(ok ? 'تم لصق البرومبت' : 'ضع المؤشر داخل حقل كتابة أولاً', ok);
        }
        return;
      }
      if (action === 'copy-all-notes') {
        await navigator.clipboard.writeText(noteNiches.map((item) => item.text).join('\n'));
        setStatus('All notes copied');
        return;
      }
      if (action === 'copy-note' || action === 'paste-note') {
        const noteCard = button.closest('[data-note-text]');
        const text = noteCard?.dataset.noteText || '';
        if (!text) return;
        if (action === 'copy-note') {
          await navigator.clipboard.writeText(text);
          setStatus('Note copied');
        } else {
          const ok = insertText(text);
          setStatus(ok ? 'Note pasted' : 'Focus an input field first', ok);
        }
        return;
      }
      if (action === 'import-clipboard') {
        await importClipboardImage();
        return;
      }
      if (action === 'clear-images') {
        if (!confirm('Clear all Prompt Bag images?')) return;
        images = [];
        await saveImages();
        setStatus('Images cleared');
        return;
      }
      const imageCard = button.closest('[data-id]');
      const image = images.find((item) => item.id === imageCard?.dataset.id);
      if (!image) return;
      if (action === 'copy-image') {
        await copyImage(image.dataUrl);
        setStatus('تم نسخ الصورة');
      } else if (action === 'paste-image') {
        await pasteImageWithPrompt(image, imageCard);
        setStatus('تمت محاولة لصق الصورة');
      } else if (action === 'delete-image') {
        images = images.filter((item) => item.id !== image.id);
        await saveImages();
        setStatus('Image deleted');
      } else if (action === 'generate-ai-prompt') {
        await generatePromptForImage(image, imageCard, button);
      } else if (action === 'send-gemini' || action === 'send-gpt') {
        const targetUrl = action === 'send-gemini' ? GEMINI_IMAGE_GEM_URL : CHATGPT_IMAGE_GPT_URL;
        const ta = action === 'send-gemini'
          ? imageCard.querySelector('[data-role="prompt-gemini"]')
          : imageCard.querySelector('[data-role="prompt-gpt"]');
        const explicit = String(ta?.value || '').trim();
        const payload = {
          action: 'PROMPT_BAG_SEND_IMAGE',
          dataUrl: image.dataUrl,
          name: image.name || 'Prompt Bag Image',
          targetUrl,
          promptText: await getGeneratedOrManualImagePrompt(image, explicit)
        };
        const res = await sendMessage(payload);
        setStatus(res?.success ? 'تم إرسال الصورة' : (res?.error || 'فشل الإرسال'), !!res?.success);
      }
    } catch (error) {
      setStatus(error?.message || 'حدث خطأ', false);
    }
  });

  shadow.addEventListener('change', async (event) => {
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
    const card = sel.closest('[data-id]');
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
        setStatus('تم إدراج وحفظ البرومبت مع الصورة', true);
      } catch (error) {
        setStatus(error?.message || 'تعذر الحفظ', false);
      }
    } else {
      setStatus('تم إدراج البرومبت', true);
    }
  });

  shadow.addEventListener('focusout', async (event) => {
    const target = event.target;
    if (!target || target.tagName !== 'TEXTAREA') return;
    const role = target.getAttribute('data-role');
    if (role !== 'prompt-gemini' && role !== 'prompt-gpt') return;
    const imageCard = target.closest('[data-id]');
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
      setStatus('تم حفظ البرومبت مع الصورة', true);
    } catch (error) {
      setStatus(error?.message || 'تعذر الحفظ', false);
    }
  });
})();
