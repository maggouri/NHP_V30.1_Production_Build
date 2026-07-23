/**
 * SEO / Gemini Web batch constants and pure helpers (background service worker).
 */
(function (global) {
    'use strict';

    global.GEMINI_WEB_TASK_STORAGE_KEY = 'gemini_web_task';
    global.GEMINI_WEB_BATCH_STORAGE_KEY = 'gemini_web_batch';
    global.GEMINI_WEB_BATCH_ITEM_GAP_MS = 5200;
    global.GEMINI_WEB_BATCH_ITEM_GAP_STEP_MS = 280;
    global.GEMINI_WEB_BATCH_PREINJECT_EXTRA_MS = 1600;
    global.GEMINI_WEB_BATCH_PER_ITEM_TIMEOUT_MS = 240000;
    global.GEMINI_WEB_BATCH_MAX_TOTAL_TIMEOUT_MS = 90 * 60 * 1000;
    global.SEO_GEMINI_CHAT_REFRESH_EVERY_DEFAULT = 1;
    global.SEO_GEMINI_CHAT_REFRESH_EVERY_KEY = 'seoGeminiChatRefreshEvery';
    global.GEMINI_WEB_BATCH_PROGRESS_STORAGE_PREFIX = 'gemini_web_batch_progress_';
    global.GEMINI_WEB_BATCH_ITEMS_STORAGE_PREFIX = 'gemini_web_batch_items_';
    global.GEMINI_WEB_POPUP_URL = 'https://gemini.google.com/app?hl=ar';
    global.GEMINI_SEO_GEM_URL = 'https://gemini.google.com/gem/1f29abb64533';
    global.GEMINI_IMAGE_GEM_URL = 'https://gemini.google.com/gem/6bc2d8e9f911';
    global.CHATGPT_SEO_GPT_URL = 'https://chatgpt.com/g/g-69ea5fffe8cc819197ca4381a199a21e-seo-exten-gpt-nhp';
    global.CHATGPT_IMAGE_GPT_URL = 'https://chatgpt.com/g/g-69db6eabc5e48191844d04a90423616c-artisan-teepublic';

    global.getSeoGeminiChatRefreshEvery = async function getSeoGeminiChatRefreshEvery() {
        try {
            const data = await chrome.storage.local.get([global.SEO_GEMINI_CHAT_REFRESH_EVERY_KEY]);
            const parsed = parseInt(data[global.SEO_GEMINI_CHAT_REFRESH_EVERY_KEY], 10);
            if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 24) {
                return parsed;
            }
        } catch (_) {
        }
        return global.SEO_GEMINI_CHAT_REFRESH_EVERY_DEFAULT;
    };

    global.shouldRefreshSeoGeminiChat = function shouldRefreshSeoGeminiChat(batchIndex, refreshEvery = global.SEO_GEMINI_CHAT_REFRESH_EVERY_DEFAULT) {
        const index = Number(batchIndex);
        const every = Math.max(1, Number(refreshEvery) || global.SEO_GEMINI_CHAT_REFRESH_EVERY_DEFAULT);
        if (!Number.isFinite(index) || index < 0) return false;
        if (every <= 1) return true;
        return index > 0 && (index % every === 0);
    };

    global.getSeoBatchTimingProfile = async function getSeoBatchTimingProfile() {
        const lowSpec = typeof global.isLowSpecModeEnabled === 'function'
            ? await global.isLowSpecModeEnabled()
            : false;
        return {
            lowSpec,
            itemTimeoutMs: lowSpec ? 420000 : global.GEMINI_WEB_BATCH_PER_ITEM_TIMEOUT_MS,
            itemWatchdogGraceMs: lowSpec ? 60000 : 15000,
            itemGapMs: lowSpec ? 9800 : global.GEMINI_WEB_BATCH_ITEM_GAP_MS,
            itemGapStepMs: lowSpec ? 420 : global.GEMINI_WEB_BATCH_ITEM_GAP_STEP_MS,
            preInjectBaseMs: lowSpec ? 4200 : 2800,
            preInjectFirstMs: lowSpec ? 1800 : 900,
            preInjectCapMs: lowSpec ? 18000 : 12000,
            preInjectExtraMs: lowSpec ? 2400 : global.GEMINI_WEB_BATCH_PREINJECT_EXTRA_MS,
            preInjectRefreshExtraMs: lowSpec ? 6500 : 3500,
            tabLoadWaitMs: lowSpec ? 50000 : 32000,
            tabLoadWaitIdleMs: lowSpec ? 38000 : 24000,
            maxTotalTimeoutMs: lowSpec ? (120 * 60 * 1000) : global.GEMINI_WEB_BATCH_MAX_TOTAL_TIMEOUT_MS
        };
    };

    global.waitForGeminiTabLoadComplete = function waitForGeminiTabLoadComplete(tabId, timeoutMs = 24000) {
        return new Promise((resolve) => {
            if (!tabId) {
                resolve(false);
                return;
            }
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(false);
            }, timeoutMs);
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId !== tabId || changeInfo.status !== 'complete' || settled) return;
                settled = true;
                clearTimeout(timeoutId);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(true);
            };
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.get(tabId, (tab) => {
                if (!chrome.runtime.lastError && tab?.status === 'complete' && !settled) {
                    settled = true;
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve(true);
                }
            });
        });
    };

    global.parseGeminiWebBatchSessionIdFromRequest = function parseGeminiWebBatchSessionIdFromRequest(requestId, sessionId = '') {
        const explicit = String(sessionId || '').trim();
        if (explicit) return explicit;
        const match = String(requestId || '').match(/^(gwb_\d+_[a-z0-9]+)_\d+$/i);
        return match?.[1] || '';
    };

    global.parseBatchIndexFromRequestId = function parseBatchIndexFromRequestId(requestId, sessionId = '') {
        const rid = String(requestId || '').trim();
        const sid = String(sessionId || '').trim();
        if (sid && rid.startsWith(`${sid}_`)) {
            const idx = parseInt(rid.slice(sid.length + 1), 10);
            if (Number.isFinite(idx) && idx >= 0) return idx;
        }
        const match = rid.match(/_(\d+)$/);
        if (!match) return null;
        const idx = parseInt(match[1], 10);
        return Number.isFinite(idx) && idx >= 0 ? idx : null;
    };

    global.computeGeminiWebBatchTotalTimeoutMs = function computeGeminiWebBatchTotalTimeoutMs(itemCount, profile = null) {
        const count = Math.max(1, Number(itemCount) || 1);
        const perItem = profile?.itemTimeoutMs || global.GEMINI_WEB_BATCH_PER_ITEM_TIMEOUT_MS;
        const cap = profile?.maxTotalTimeoutMs || global.GEMINI_WEB_BATCH_MAX_TOTAL_TIMEOUT_MS;
        const estimated = (perItem * count) + (profile?.lowSpec ? 180000 : 120000);
        return Math.min(estimated, cap);
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
