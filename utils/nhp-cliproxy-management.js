/**
 * CLIProxy management panel helpers — storage + open with optional auto-login.
 * Loaded in service worker (importScripts) and extension UI pages (script tag).
 */
(function initNhpCliProxyManagement(global) {
    'use strict';

    if (global.NhpCliProxyManagement) return;

    const STORAGE_KEY = 'nhpCliProxyManagementKey';
    const LOCAL_MANAGEMENT_URL = 'http://127.0.0.1:8317/management.html#/login';
    const CLOUD_MANAGEMENT_URL = 'https://cliproxyapi-ywrp.onrender.com/management.html#/login';

    function normalizeManagementUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return LOCAL_MANAGEMENT_URL;
        if (/#/.test(raw)) return raw;
        return `${raw.replace(/\/+$/, '')}/management.html#/login`;
    }

    function getStoredManagementKey() {
        return new Promise((resolve) => {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                    resolve('');
                    return;
                }
                chrome.storage.local.get([STORAGE_KEY], (res) => {
                    resolve(String(res?.[STORAGE_KEY] || '').trim());
                });
            } catch (_) {
                resolve('');
            }
        });
    }

    function setStoredManagementKey(key) {
        const value = String(key || '').trim();
        return new Promise((resolve) => {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                    resolve(false);
                    return;
                }
                if (!value) {
                    chrome.storage.local.remove([STORAGE_KEY], () => resolve(true));
                    return;
                }
                chrome.storage.local.set({ [STORAGE_KEY]: value }, () => resolve(true));
            } catch (_) {
                resolve(false);
            }
        });
    }

    function seedManagementKeyIfEmpty(key) {
        const candidate = String(key || '').trim();
        if (!candidate) return Promise.resolve(false);
        return getStoredManagementKey().then((existing) => {
            if (existing) return false;
            return setStoredManagementKey(candidate).then(() => true);
        });
    }

    function openManagementPanel(url) {
        const target = normalizeManagementUrl(url);
        return new Promise((resolve) => {
            try {
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                    chrome.tabs.create({ url: target, active: true }, (tab) => resolve(tab || null));
                    return;
                }
            } catch (_) { /* fallback */ }
            try {
                window.open(target, '_blank', 'noopener,noreferrer');
            } catch (_) { /* ignore */ }
            resolve(null);
        });
    }

    global.NhpCliProxyManagement = Object.freeze({
        STORAGE_KEY,
        LOCAL_MANAGEMENT_URL,
        CLOUD_MANAGEMENT_URL,
        normalizeManagementUrl,
        getStoredManagementKey,
        setStoredManagementKey,
        seedManagementKeyIfEmpty,
        openManagementPanel
    });
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : window);
