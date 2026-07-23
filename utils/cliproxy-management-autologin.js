/**
 * Auto-fill CLIProxy management login when NHP has the key in chrome.storage.local.
 */
(function initCliProxyManagementAutologin() {
    'use strict';

    const STORAGE_KEY = 'nhpCliProxyManagementKey';
    const MAX_ATTEMPTS = 40;
    const RETRY_MS = 400;

    function isLoginRoute() {
        const hash = String(window.location.hash || '');
        return hash.includes('/login') || hash === '' || hash === '#/';
    }

    function setReactInputValue(input, value) {
        if (!input) return false;
        try {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, value);
            else input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch (_) {
            return false;
        }
    }

    function findPasswordInput() {
        const candidates = Array.from(document.querySelectorAll('input[type="password"]'));
        if (candidates.length === 1) return candidates[0];
        return candidates.find((el) => {
            const label = String(el.getAttribute('aria-label') || el.name || el.id || '').toLowerCase();
            return /key|password|secret|management/.test(label);
        }) || candidates[0] || null;
    }

    function findConnectButton() {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find((btn) => {
            const text = String(btn.textContent || '').trim().toLowerCase();
            return /connect|login|sign in|دخول|اتصال/.test(text);
        }) || buttons.find((btn) => btn.type === 'submit') || null;
    }

    function tryAutoLogin(key) {
        if (!key || !isLoginRoute()) return false;
        const passwordInput = findPasswordInput();
        if (!passwordInput) return false;
        if (String(passwordInput.value || '').trim() === key) {
            const btn = findConnectButton();
            if (btn && !btn.disabled) btn.click();
            return true;
        }
        setReactInputValue(passwordInput, key);
        const remember = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            .find((el) => /remember/i.test(String(el.name || el.id || '')));
        if (remember && !remember.checked) remember.click();
        const connectBtn = findConnectButton();
        if (connectBtn && !connectBtn.disabled) {
            connectBtn.click();
            return true;
        }
        return true;
    }

    function runAutoLogin(key) {
        if (!key) return;
        let attempts = 0;
        const tick = () => {
            attempts += 1;
            if (tryAutoLogin(key)) return;
            if (attempts < MAX_ATTEMPTS) window.setTimeout(tick, RETRY_MS);
        };
        tick();
    }

    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.get([STORAGE_KEY], (res) => {
        const key = String(res?.[STORAGE_KEY] || '').trim();
        if (!key) return;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => runAutoLogin(key), { once: true });
        } else {
            runAutoLogin(key);
        }
    });
})();
