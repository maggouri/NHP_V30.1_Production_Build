/**
 * Auto-click Allow (سماح) on official Canva OAuth consent page only.
 * Does not run inside the Canva editor — authorize URL path only.
 */
(function initCanvaOAuthAutoclick() {
  'use strict';

  const STORAGE_KEY = 'canvaAutoConnect';
  const CLICK_DELAY_MIN = 500;
  const CLICK_DELAY_MAX = 800;
  const OBSERVER_TIMEOUT_MS = 30000;

  function isCanvaOAuthAuthorizePage() {
    try {
      const u = new URL(window.location.href);
      return u.hostname === 'www.canva.com'
        && u.pathname.startsWith('/api/oauth/authorize');
    } catch (_) {
      return false;
    }
  }

  if (!isCanvaOAuthAuthorizePage()) return;

  let clicked = false;

  function normalizeLabel(el) {
    return String(
      el.textContent
      || el.value
      || el.getAttribute('aria-label')
      || el.getAttribute('title')
      || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function isAllowLabel(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (t === 'سماح') return true;
    if (/^allow$/i.test(t)) return true;
    if (/^authori[sz]e$/i.test(t)) return true;
    return false;
  }

  function findAllowButton() {
    const candidates = Array.from(document.querySelectorAll(
      'button, a[role="button"], input[type="submit"], [data-testid]'
    ));
    return candidates.find((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return isAllowLabel(normalizeLabel(el));
    }) || null;
  }

  function clickAllowButton(btn) {
    if (!btn || clicked) return true;
    clicked = true;
    try {
      btn.click();
    } catch (_) {
      try {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch (_) { /* ignore */ }
    }
    return true;
  }

  function scheduleClick(btn) {
    const delay = CLICK_DELAY_MIN + Math.floor(Math.random() * (CLICK_DELAY_MAX - CLICK_DELAY_MIN + 1));
    window.setTimeout(() => clickAllowButton(btn), delay);
    return true;
  }

  function tryClickAllow() {
    if (clicked) return true;
    const btn = findAllowButton();
    if (btn) return scheduleClick(btn);
    return false;
  }

  function startObserver() {
    if (tryClickAllow()) return;
    const observer = new MutationObserver(() => {
      if (tryClickAllow()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    window.setTimeout(() => observer.disconnect(), OBSERVER_TIMEOUT_MS);
  }

  function runWhenEnabled() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.setTimeout(startObserver, 120), { once: true });
    } else {
      window.setTimeout(startObserver, 120);
    }
  }

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    runWhenEnabled();
    return;
  }

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    if (res && res[STORAGE_KEY] === false) return;
    runWhenEnabled();
  });
})();
