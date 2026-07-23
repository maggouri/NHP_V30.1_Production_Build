/**
 * NHP HuntPro — Save bar overlay on Canva editor pages opened by the extension.
 * Only injects when background confirms tab/design matches nhpCanvaBatchPopups or nhpCanvaPopupRef.
 */
(function initNhpCanvaEditorSaveBar() {
  'use strict';

  if (window.__nhpCanvaEditorSaveBarInit) return;
  window.__nhpCanvaEditorSaveBarInit = true;

  const BAR_ID = 'nhp-canva-editor-save-bar';
  const STYLE_ID = 'nhp-canva-editor-save-bar-style';
  const Z_INDEX = 2147483646;
  const CANVA_BAR_DEBUG = false;

  let injected = false;
  let busy = false;
  let lastUrl = '';
  let activeContext = null;
  let pendingSaveDesignId = '';
  let forceShownAt = 0;
  let forcedDesignId = '';

  function isPortClosedError(message) {
    const text = String(message || '').toLowerCase();
    return /message port closed|receiving end does not exist|could not establish connection/i.test(text);
  }

  function dbg(...args) {
    if (CANVA_BAR_DEBUG) console.log('[NHP Canva Bar]', ...args);
  }

  function extractDesignId(url = location.href) {
    try {
      const raw = String(url);
      if (/canva\.com\/api\/design\//i.test(raw)) return '';
      const m = raw.match(/canva\.com\/design\/([A-Za-z0-9_-]+)/i);
      return m ? m[1] : '';
    } catch (_) {
      return '';
    }
  }

  function isCanvaEditorUrl(url = location.href) {
    const raw = String(url || '').trim();
    if (!raw || !/canva\.com/i.test(raw)) return false;
    if (/canva\.com\/api\/design\//i.test(raw)) return true;
    return /canva\.com\/design\/[A-Za-z0-9_-]+/i.test(raw);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID} {
        all: initial;
        position: fixed !important;
        top: 10px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: ${Z_INDEX} !important;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(15, 11, 30, 0.96) 0%, rgba(30, 20, 55, 0.94) 100%);
        border: 1px solid rgba(139, 92, 246, 0.45);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(139, 92, 246, 0.12);
        font-family: 'Segoe UI', Tahoma, 'Tajawal', sans-serif;
        direction: rtl;
        pointer-events: auto;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        max-width: min(92vw, 520px);
        box-sizing: border-box;
      }
      #${BAR_ID} * { box-sizing: border-box; }
      #${BAR_ID} .nhp-canva-bar-brand {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #c4b5fd;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      #${BAR_ID} .nhp-canva-bar-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #8b5cf6;
        box-shadow: 0 0 10px rgba(139, 92, 246, 0.8);
        flex-shrink: 0;
      }
      #${BAR_ID} .nhp-canva-bar-btn {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 7px 16px;
        border-radius: 999px;
        background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.45);
        transition: opacity 0.15s, transform 0.15s, filter 0.15s;
      }
      #${BAR_ID} .nhp-canva-bar-btn:hover:not(:disabled) {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }
      #${BAR_ID} .nhp-canva-bar-btn:disabled {
        opacity: 0.72;
        cursor: wait;
      }
      #${BAR_ID} .nhp-canva-bar-toast {
        color: #86efac;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 220px;
      }
      #${BAR_ID} .nhp-canva-bar-toast.is-error { color: #fca5a5; }
      #${BAR_ID} .nhp-canva-bar-toast.is-loading { color: #ddd6fe; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeBar() {
    const bar = document.getElementById(BAR_ID);
    if (bar) bar.remove();
    injected = false;
    activeContext = null;
    forceShownAt = 0;
    forcedDesignId = '';
  }

  function showSaveSuccess(mockMode) {
    busy = false;
    pendingSaveDesignId = '';
    const btn = document.querySelector(`#${BAR_ID} .nhp-canva-bar-btn`);
    if (btn) btn.disabled = false;
    setToast(mockMode ? 'تم الحفظ (وضع تجريبي)' : '✅ تم الحفظ في NHP', '');
    window.setTimeout(() => removeBar(), 1800);
  }

  function explainSaveError(errorText) {
    const raw = String(errorText || '').trim();
    if (!raw) return 'فشل الحفظ — تحقق من Ghost Server (3019) وأعد تحميل الإضافة';
    if (/ghost server|غير مشغّل|3019/i.test(raw)) return raw;
    if (/لم تُفتح من nhp/i.test(raw)) return raw;
    if (/unknown endpoint/i.test(raw) && /export/i.test(raw)) {
      return 'مسار تصدير Canva غير صحيح — أعد تشغيل Ghost Server ثم أعد المحاولة، أو نزّل PNG من Canva مباشرة';
    }
    if (/export timed out/i.test(raw)) {
      return 'انتهت مهلة تصدير Canva — انتظر قليلاً أو نزّل PNG من زر التنزيل في Canva';
    }
    if (/license_required/i.test(raw)) {
      return 'التصميم يحتوي عناصر مدفوعة — اشترِها أو نزّل PNG يدوياً من Canva';
    }
    if (/فشل تصدير|export job failed|export download failed/i.test(raw)) {
      return `${raw} — جرّب التنزيل اليدوي من Canva (PNG شفاف 5000×5000)`;
    }
    if (/design id required|معرّف تصميم/i.test(raw)) {
      return 'معرّف التصميم غير متوفر — أغلق النافذة وافتح التصميم من NHP مرة أخرى';
    }
    return raw;
  }

  function showSaveFailure(errorText) {
    busy = false;
    pendingSaveDesignId = '';
    const btn = document.querySelector(`#${BAR_ID} .nhp-canva-bar-btn`);
    if (btn) btn.disabled = false;
    setToast(explainSaveError(errorText), 'error');
  }

  function showDownloadCapturedToast(message) {
    if (!injected) return;
    setToast(message || 'تم حفظ التنزيل في التصاميم المعدّلة', '');
    window.setTimeout(() => {
      const toast = document.querySelector(`#${BAR_ID} .nhp-canva-bar-toast`);
      if (toast && toast.textContent === (message || 'تم حفظ التنزيل في التصاميم المعدّلة')) {
        toast.textContent = '';
        toast.className = 'nhp-canva-bar-toast';
      }
    }, 4000);
  }

  function setToast(text, type = '') {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    const toast = bar.querySelector('.nhp-canva-bar-toast');
    const btn = bar.querySelector('.nhp-canva-bar-btn');
    if (toast) {
      toast.textContent = text || '';
      toast.className = 'nhp-canva-bar-toast' + (type ? ` is-${type}` : '');
    }
    if (btn) btn.disabled = busy;
  }

  function renderBar(ctx) {
    injectStyles();
    let bar = document.getElementById(BAR_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.setAttribute('dir', 'rtl');
      bar.setAttribute('lang', 'ar');
      bar.innerHTML = `
        <span class="nhp-canva-bar-brand"><span class="nhp-canva-bar-dot" aria-hidden="true"></span>NHP HuntPro</span>
        <button type="button" class="nhp-canva-bar-btn" id="nhp-canva-bar-save-btn" title="يصدّر PNG شفاف 5000×5000 عبر Canva API (مكافئ لتنزيل → PNG → خلفية شفافة)">حفظ في NHP</button>
        <span class="nhp-canva-bar-toast" aria-live="polite"></span>
      `;
      document.documentElement.appendChild(bar);
      bar.querySelector('#nhp-canva-bar-save-btn')?.addEventListener('click', onSaveClick);
    }
    bar.style.setProperty('display', 'flex', 'important');
    bar.style.setProperty('z-index', String(Z_INDEX), 'important');
    injected = true;
    activeContext = ctx;
    setToast('');
  }

  function sendMessage(payload) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve({ success: false, error: 'Extension unavailable' });
        return;
      }
      try {
        chrome.runtime.sendMessage(payload, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message || 'Message failed' });
            return;
          }
          resolve(res || { success: false });
        });
      } catch (err) {
        resolve({ success: false, error: err?.message || 'Message failed' });
      }
    });
  }

  async function requestInjectContext() {
    if (!isCanvaEditorUrl()) return null;
    const designId = extractDesignId();
    const res = await sendMessage({
      action: 'CANVA_EDITOR_INIT',
      ...(designId ? { designId } : {})
    });
    dbg('CANVA_EDITOR_INIT', { designId, res });
    if (!res?.success || !res.show) return null;
    return res;
  }

  function applyForcedContext(msg) {
    if (!msg || msg.show === false) {
      removeBar();
      return false;
    }
    const designId = String(msg.designId || forcedDesignId || extractDesignId() || '').trim();
    if (!designId) return false;
    if (!isCanvaEditorUrl() && !/\/design\//i.test(location.href) && !/canva\.com\/api\/design\//i.test(location.href)) {
      return false;
    }
    forcedDesignId = designId;
    forceShownAt = Date.now();
    renderBar({
      designId,
      libraryId: msg.libraryId || '',
      tabId: msg.tabId ?? null,
      windowId: msg.windowId ?? null,
      editUrl: msg.editUrl || location.href,
      blank: !!msg.blank || !String(msg.libraryId || '').trim(),
      title: msg.title || 'NHP Blank 5000×5000'
    });
    dbg('bar shown via FORCE_SHOW', designId);
    return true;
  }

  function shouldKeepBarWithoutInit() {
    if (!injected && !activeContext?.designId && !forcedDesignId) return false;
    if (forceShownAt && (Date.now() - forceShownAt) < 120000) return true;
    return !!(activeContext?.designId && injected);
  }

  async function onSaveClick() {
    if (busy || !activeContext) return;
    const designId = activeContext.designId || extractDesignId();
    if (!designId) {
      setToast('افتح تصميماً في Canva أولاً', 'error');
      return;
    }
    busy = true;
    pendingSaveDesignId = designId;
    setToast('جاري الاستيراد والحفظ...', 'loading');
    const btn = document.querySelector(`#${BAR_ID} .nhp-canva-bar-btn`);
    if (btn) btn.disabled = true;

    const isBlank = !!(activeContext.blank || !String(activeContext.libraryId || '').trim());
    const res = await sendMessage({
      action: 'CANVA_IMPORT_FROM_EDITOR',
      designId,
      canvaDesignId: designId,
      libraryId: activeContext.libraryId || '',
      tabId: activeContext.tabId ?? null,
      windowId: activeContext.windowId ?? null,
      blank: isBlank,
      title: activeContext.title || 'NHP Blank 5000×5000'
    });

    if (res?.success) {
      showSaveSuccess(res.mockMode);
      return;
    }

    if (isPortClosedError(res?.error)) {
      setToast('جاري التأكد من الحفظ...', 'loading');
      const confirmed = await waitForEditorImportSuccess(designId, 120000);
      if (confirmed) {
        showSaveSuccess(confirmed.mockMode);
        return;
      }
    }

    showSaveFailure(res?.error);
  }

  function waitForEditorImportSuccess(designId, timeoutMs = 8000) {
    return new Promise((resolve) => {
      const targetId = String(designId || '').trim();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage?.removeListener) {
          chrome.runtime.onMessage.removeListener(onImportEvent);
        }
        resolve(value);
      };

      const onImportEvent = (msg) => {
        if (msg?.action !== 'CANVA_IMPORTED_FROM_EDITOR') return;
        const msgDesignId = String(msg.canvaDesignId || msg.blankDesignId || '').trim();
        if (targetId && msgDesignId && msgDesignId !== targetId) return;
        if (!msg?.success && !msg?.libraryId) return;
        finish({ mockMode: !!msg.mockMode });
      };

      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage?.addListener) {
        chrome.runtime.onMessage.addListener(onImportEvent);
      }

      const timer = window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  async function evaluatePage() {
    if (!isCanvaEditorUrl()) {
      if (injected) removeBar();
      return;
    }
    const ctx = await requestInjectContext();
    if (!ctx) {
      if (shouldKeepBarWithoutInit()) {
        dbg('evaluatePage: keeping bar after init miss');
        return;
      }
      if (injected) removeBar();
      return;
    }
    const normalized = normalizeEditorContext(ctx);
    if (!normalized) {
      if (injected) removeBar();
      return;
    }
    renderBar(normalized);
    forcedDesignId = normalized.designId;
    forceShownAt = Date.now();
    dbg('bar shown via evaluatePage', ctx.designId);
  }

  function normalizeEditorContext(ctx) {
    if (!ctx) return null;
    const designId = String(ctx.designId || extractDesignId() || '').trim();
    if (!designId) return null;
    const libraryId = String(ctx.libraryId || '').trim();
    return {
      designId,
      libraryId,
      tabId: ctx.tabId ?? null,
      windowId: ctx.windowId ?? null,
      editUrl: ctx.editUrl || location.href,
      blank: !!(ctx.blank || (!libraryId && designId)),
      title: ctx.title || 'NHP Blank 5000×5000'
    };
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.action === 'CANVA_EDITOR_FORCE_SHOW') {
        try {
          const shown = applyForcedContext(msg);
          sendResponse({ success: true, shown });
        } catch (err) {
          sendResponse({ success: false, error: err?.message || 'Force show failed' });
        }
        return true;
      }
      if (msg?.action === 'CANVA_IMPORTED_FROM_EDITOR' && busy) {
        const msgDesignId = String(msg.canvaDesignId || msg.blankDesignId || '').trim();
        const pendingId = String(pendingSaveDesignId || activeContext?.designId || '').trim();
        if (!pendingId || !msgDesignId || msgDesignId === pendingId) {
          if (msg?.success || msg?.libraryId) {
            showSaveSuccess(!!msg.mockMode);
          }
        }
      }
      if (msg?.action === 'CANVA_DOWNLOAD_CAPTURED_TOAST') {
        showDownloadCapturedToast(msg.message);
      }
      return false;
    });
  }

  function onRouteChange() {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    void evaluatePage();
  }

  function boot() {
    lastUrl = location.href;
    void evaluatePage();

    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('hashchange', onRouteChange);

    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function nhpCanvaPushState() {
      const out = origPush.apply(this, arguments);
      onRouteChange();
      return out;
    };
    history.replaceState = function nhpCanvaReplaceState() {
      const out = origReplace.apply(this, arguments);
      onRouteChange();
      return out;
    };

    window.setInterval(onRouteChange, 1500);

    // Keep NHP session alive while the editor stays open (openedAt refresh in background).
    window.setInterval(() => {
      if (!injected || !activeContext) return;
      void sendMessage({
        action: 'CANVA_EDITOR_INIT',
        designId: activeContext.designId || extractDesignId()
      }).then((ctx) => {
        if (!ctx?.success || !ctx.show) return;
        const normalized = normalizeEditorContext(ctx);
        if (normalized) activeContext = normalized;
      });
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
