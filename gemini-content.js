/**
 * Niche Hunter Pro - Gemini Automation Script
 * Keeps the image + prompt injection flow resilient against Gemini UI changes.
 */

(function () {
    const host = String(window.location.hostname || '');
    const isGeminiHost = host.includes('gemini.google.com');
    const isChatGptHost = host.includes('chatgpt.com');
    const isGoogleAiModeHost = /(^|\.)google\./i.test(host) && /(?:[?&]udm=50\b|[?&]aep=)/i.test(window.location.search || '');
    if (!isGeminiHost && !isChatGptHost && !isGoogleAiModeHost) {
        return;
    }

    console.log(`NHP: AI Auto-Injector Loaded for ${host}`);

    let lowSpecModeCache = { value: false, loadedAt: 0 };

    async function isLowSpecModeEnabledLocal() {
        const now = Date.now();
        if ((now - Number(lowSpecModeCache.loadedAt || 0)) < 8000) {
            return !!lowSpecModeCache.value;
        }
        try {
            const stored = await chrome.storage.local.get(['nhpLowSpecMode']);
            lowSpecModeCache = { value: stored?.nhpLowSpecMode === true, loadedAt: now };
        } catch (_) {
            lowSpecModeCache = { value: false, loadedAt: now };
        }
        return !!lowSpecModeCache.value;
    }

    function getSeoCapturePerfProfile(lowSpec = false) {
        return {
            freshModelGraceMs: lowSpec ? 55000 : 28000,
            maxWaitMs: lowSpec ? 360000 : 200000,
            completeBlockWaitMs: lowSpec ? 150000 : 75000,
            partialBlockWaitMs: lowSpec ? 200000 : 90000,
            generatingBlockWaitMs: lowSpec ? 130000 : 90000,
            pollMsGenerating: lowSpec ? 2800 : 1800,
            pollMsIdle: lowSpec ? 3600 : 2500,
            capturePendingMaxAgeMs: lowSpec ? 420000 : 200000,
            capturePollMs: lowSpec ? 3800 : 2200,
            geminiTaskMaxAgeMs: lowSpec ? 360000 : 210000,
            stablePassesNeeded: lowSpec ? 1 : 2
        };
    }

    function isInComposerZone(el) {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        return r.top > window.innerHeight * 0.42;
    }

    function rectVisibleInViewport(el) {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight + 80;
    }

    /**
     * After storage cleanup, Gemini may still show a blob thumbnail (site draft).
     * Remove chips in the composer and try chip-level close buttons.
     */
    function tryStripGeminiComposerAttachmentsPass() {
        if (!isGeminiHost) return false;
        const selectors = [
            'button[aria-label*="Remove" i]',
            'button[aria-label*="remove" i]',
            'button[aria-label*="إزالة"]',
            'button[aria-label*="حذف"]',
            'button[aria-label*="Clear" i]',
            '[data-testid*="remove" i]',
            'button[mattooltip*="Remove" i]',
            'div[role="button"][aria-label*="remove" i]',
            'file-upload-card button',
            'upload-file-card button',
            'button[aria-label*="Close" i]',
            'button[aria-label*="إغلاق"]'
        ];
        let clicked = false;
        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach((btn) => {
                if (clicked) return;
                if (!rectVisibleInViewport(btn)) return;
                if (!isInComposerZone(btn) && !sel.includes('file') && !sel.includes('upload') && !sel.includes('card')) {
                    return;
                }
                try {
                    btn.click();
                    clicked = true;
                } catch (_) {
                }
            });
            if (clicked) break;
        }
        return clicked;
    }

    function isOnGeminiGemPage() {
        return /gemini\.google\.com\/gem\//i.test(String(window.location?.href || ''));
    }

    function normalizeGeminiGemTargetUrl(url) {
        const raw = String(url || '').trim();
        if (/^https:\/\/gemini\.google\.com\/gem\//i.test(raw)) return raw;
        if (isOnGeminiGemPage()) return String(window.location.href || '').split('#')[0];
        return '';
    }

    async function reloadGeminiGemWorkspace(targetGemUrl = '') {
        const gemUrl = normalizeGeminiGemTargetUrl(targetGemUrl);
        if (!gemUrl) return false;
        const current = String(window.location.href || '').split('#')[0];
        const target = gemUrl.split('#')[0];
        console.log('NHP: Reloading SEO Gem workspace (stay on Gem, not /app).');
        if (current.replace(/\?.*$/, '') === target.replace(/\?.*$/, '')) {
            window.location.reload();
        } else {
            window.location.assign(target);
        }
        return true;
    }

    /**
     * Start a clean conversation. On Gem pages, reload the Gem URL — never jump to /app.
     */
    function tryStartFreshGeminiChat(options = {}) {
        if (!isGeminiHost) return false;
        const preserveGem = options.preserveGem !== false;
        const gemUrl = normalizeGeminiGemTargetUrl(options.gemUrl || options.targetUrl || '');
        if (preserveGem && (isOnGeminiGemPage() || gemUrl)) {
            void reloadGeminiGemWorkspace(gemUrl);
            return true;
        }
        const selectors = [
            'a[aria-label*="New chat" i]',
            'button[aria-label*="New chat" i]',
            'a[aria-label*="محادثة جديدة"]',
            'button[aria-label*="محادثة جديدة"]',
            '[data-testid*="new-chat" i]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && rectVisibleInViewport(el)) {
                try {
                    el.click();
                    console.log('NHP: Triggered Gemini new chat to clear draft UI.');
                    return true;
                } catch (_) {
                }
            }
        }
        return false;
    }

    /** Custom GPT root only — strips /c/{conversationId} so reload stays inside the same GPT. */
    function normalizeChatGptGptBaseUrl(urlOrHref = '') {
        const raw = String(urlOrHref || window.location.href || '').trim();
        const match = raw.match(/^(https:\/\/chatgpt\.com\/g\/[^/?#]+)/i);
        return match ? match[1] : '';
    }

    function isChatGptConversationUrl(url = '') {
        return /chatgpt\.com\/g\/[^/]+\/c\//i.test(String(url || ''));
    }

    /**
     * Fresh thread inside the SAME custom GPT — never click sidebar "New chat" (opens general ChatGPT).
     * @returns {'navigating'|true|false}
     */
    async function tryStartFreshChatGptConversation(targetGptUrl = '') {
        if (!isChatGptHost) return false;

        const gptBase = normalizeChatGptGptBaseUrl(targetGptUrl)
            || normalizeChatGptGptBaseUrl(window.location.href);
        if (!gptBase) {
            console.warn('NHP: ChatGPT — no custom GPT URL; skipping global new-chat click.');
            return false;
        }

        const currentHref = String(window.location.href || '').split('#')[0];
        const onGptRoot = currentHref.replace(/\?.*$/, '') === gptBase && !isChatGptConversationUrl(currentHref);

        if (onGptRoot) {
            const composer = await waitForComposer(12000);
            if (composer) {
                try {
                    await setComposerText(composer, '');
                } catch (_) {
                }
            }
            tryStripGeminiComposerAttachmentsPass();
            console.log('NHP: ChatGPT — already on custom GPT root, composer cleared.');
            return true;
        }

        const freshUrl = `${gptBase}?nhp_fresh=${Date.now()}`;
        console.log('NHP: ChatGPT — reloading custom GPT for new thread (not general chat):', gptBase);
        try {
            sessionStorage.setItem('nhp_fresh_chat_nav', String(Date.now()));
        } catch (_) {
        }
        window.location.assign(freshUrl);
        return 'navigating';
    }

    const SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT = 1;

    function shouldRefreshSeoChatForBatchIndex(batchIndex, refreshEvery = SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT) {
        const index = Number(batchIndex);
        const every = Math.max(1, Number(refreshEvery) || SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT);
        if (!Number.isFinite(index) || index < 0) return false;
        if (every <= 1) return true;
        return index > 0 && (index % every === 0);
    }

    async function resolveSeoGemTargetUrl(task = null) {
        const fromTask = normalizeGeminiGemTargetUrl(task?.targetUrl || task?.activeUrl || '');
        if (fromTask) return fromTask;
        try {
            const stored = await getLocalStorageSafe(['gemini_web_task', 'gemini_web_batch']);
            const batchUrl = stored?.gemini_web_batch?.activeUrl || '';
            const taskUrl = stored?.gemini_web_task?.targetUrl || '';
            return normalizeGeminiGemTargetUrl(taskUrl || batchUrl);
        } catch (_) {
            return isOnGeminiGemPage() ? normalizeGeminiGemTargetUrl(window.location.href) : '';
        }
    }

    async function refreshGeminiChatForSeoBatch(batchIndex, refreshEvery = SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT, task = null) {
        if (!isGeminiHost) return false;
        const every = Math.max(1, Number(refreshEvery) || SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT);
        const index = Number(batchIndex);
        if (!shouldRefreshSeoChatForBatchIndex(index, every)) {
            return false;
        }
        const refreshLabel = every <= 1 ? 'محادثة Gem جديدة لكل تصميم' : `محادثة Gem جديدة (كل ${every} تصاميم)`;
        updateProgress(`${refreshLabel} — ${index + 1}...`, 68);
        const gemUrl = await resolveSeoGemTargetUrl(task);
        if (gemUrl) {
            console.log(`NHP: SEO batch Gem reload at design ${index + 1}.`);
            await reloadGeminiGemWorkspace(gemUrl);
            for (let attempt = 0; attempt < 5; attempt += 1) {
                await sleep(attempt === 0 ? 2200 : 2800);
                if (await waitForComposer(12000)) {
                    const composer = getComposer();
                    if (composer) {
                        try {
                            await setComposerText(composer, '');
                        } catch (_) {
                        }
                    }
                    await sleep(1200);
                    return true;
                }
            }
            return true;
        }
        console.warn('NHP: No SEO Gem URL found — falling back to composer clear only.');
        const composer = getComposer();
        if (composer) {
            try {
                await setComposerText(composer, '');
            } catch (_) {
            }
        }
        return false;
    }

    function scheduleGeminiUiCleanupAfterIdleSweep(wasSwept) {
        if (!isGeminiHost || !wasSwept || isTaskRunning) return;
        const stripDelays = [380, 1600, 3400];
        stripDelays.forEach((ms) => {
            setTimeout(() => {
                if (isTaskRunning) return;
                tryStripGeminiComposerAttachmentsPass();
            }, ms);
        });
        if (isOnGeminiGemPage()) return;
        const newChatDelays = [720, 2800];
        newChatDelays.forEach((ms) => {
            setTimeout(() => {
                if (isTaskRunning || isOnGeminiGemPage()) return;
                tryStartFreshGeminiChat({ preserveGem: false });
            }, ms);
        });
    }

    let pendingTaskFromBridge = null;
    const AI_TASK_CONSUMED_PREFIX = 'nhp_ai_task_consumed_';
    const AI_INJECT_STARTED_PREFIX = 'nhp_ai_inject_started_';
    let activeInjectRetryGeneration = 0;
    let activeStandaloneInjectKey = null;

    function resolveAiTaskKey(task) {
        if (!task || typeof task !== 'object') return '';
        return String(task.taskId || task.requestId || task.id || '').trim();
    }

    function markAiTaskConsumed(taskKey) {
        const key = String(taskKey || '').trim();
        if (!key) return;
        try {
            sessionStorage.setItem(`${AI_TASK_CONSUMED_PREFIX}${key}`, String(Date.now()));
        } catch (_) {
        }
    }

    function isAiTaskConsumed(taskKey) {
        const key = String(taskKey || '').trim();
        if (!key) return false;
        try {
            return !!sessionStorage.getItem(`${AI_TASK_CONSUMED_PREFIX}${key}`);
        } catch (_) {
            return false;
        }
    }

    function tryMarkInjectStarted(taskKey) {
        const key = String(taskKey || 'standalone').trim();
        if (isAiTaskConsumed(key) || isInjectStarted(key)) return false;
        try {
            sessionStorage.setItem(`${AI_INJECT_STARTED_PREFIX}${key}`, String(Date.now()));
        } catch (_) {
        }
        activeStandaloneInjectKey = key;
        return true;
    }

    function clearInjectStarted(taskKey) {
        const key = String(taskKey || '').trim();
        try {
            if (key) sessionStorage.removeItem(`${AI_INJECT_STARTED_PREFIX}${key}`);
        } catch (_) {
        }
        if (!key || activeStandaloneInjectKey === key) {
            activeStandaloneInjectKey = null;
        }
    }

    function isInjectStarted(taskKey) {
        const key = String(taskKey || '').trim();
        if (!key) return activeStandaloneInjectKey !== null;
        try {
            return !!sessionStorage.getItem(`${AI_INJECT_STARTED_PREFIX}${key}`);
        } catch (_) {
            return false;
        }
    }

    /**
     * Never raw window.close() — pooled GPT/GEM popups get reused, and a deferred
     * close from a prior run would kill the next task (prompt/images never arrive).
     */
    function scheduleSafeAiPopupClose(delayMs = 8000) {
        const wait = Math.max(0, Number(delayMs) || 0);
        setTimeout(() => {
            try {
                chrome.runtime.sendMessage({
                    action: 'REQUEST_CLOSE_AI_IMAGE_POPUP',
                    reason: 'generation_complete'
                }, (res) => {
                    if (chrome.runtime.lastError) return;
                    if (res?.closed) {
                        console.log('NHP: AI popup closed after generation (background approved).');
                    } else {
                        console.log('NHP: AI popup kept open:', res?.reason || 'pool_or_busy');
                    }
                });
            } catch (_) {
            }
        }, wait);
    }

    function countComposerImageAttachments() {
        return collectImageAttachmentPreviewKeys().size;
    }

    function clearLegacyAutoInjectionKeys() {
        try {
            chrome.storage.local.remove([
                'gemini_auto_trigger',
                'gemini_pending_image',
                'gemini_pending_prompt'
            ]);
        } catch (_) {
        }
    }

    function finalizeAiImageTaskLocally(taskKey) {
        markAiTaskConsumed(taskKey);
        pendingTaskFromBridge = null;
        clearLegacyAutoInjectionKeys();
        activeInjectRetryGeneration += 1;
        stopMonitor();
    }

    function rememberBridgeTask(task) {
        if (!task || typeof task !== 'object') return;
        const taskKey = resolveAiTaskKey(task);
        if (taskKey && isAiTaskConsumed(taskKey)) {
            return;
        }
        const imageData = task.imageData || task.base64Image || null;
        pendingTaskFromBridge = {
            requestId: task.requestId || task.taskId || task.id || null,
            sessionId: task.sessionId || null,
            batchIndex: task.batchIndex,
            batchTotal: task.batchTotal,
            itemId: task.itemId || null,
            prompt: task.prompt || task.promptText || '',
            imageData,
            mode: task.mode || (imageData ? 'images' : 'text'),
            chatRefreshEvery: task.chatRefreshEvery,
            refreshChat: task.refreshChat,
            targetUrl: task.targetUrl || task.activeUrl || null,
            forceFreshChat: task.forceFreshChat === true,
            lowSpecMode: !!task.lowSpecMode,
            createdAt: task.createdAt || Date.now()
        };
    }

    function scheduleInjectRetries(taskKey = '') {
        const generation = activeInjectRetryGeneration;
        const key = String(taskKey || '').trim();
        if (key && (isAiTaskConsumed(key) || isInjectStarted(key))) return;
        if (isTaskRunning) return;
        ensureMonitorRunning();
        [2400, 5500].forEach((delayMs) => {
            setTimeout(() => {
                if (generation !== activeInjectRetryGeneration) return;
                if (isTaskRunning) return;
                if (key && (isAiTaskConsumed(key) || isInjectStarted(key))) return;
                void checkAndInject();
            }, delayMs);
        });
    }

    function sweepIdleThenMaybeInject() {
        (async () => {
            const pre = await getLocalStorageSafe([
                'gemini_web_task',
                'gemini_web_batch',
                'gemini_auto_trigger',
                'gemini_pending_image',
                'gemini_pending_prompt'
            ]);
            const legacyTriggerTs = Number(pre?.gemini_auto_trigger || 0);
            const legacyTriggerFresh = legacyTriggerTs > 1_000_000_000_000
                && (Date.now() - legacyTriggerTs) < AI_IMAGE_LEGACY_MAX_AGE_MS;
            const hasLegacyImagePayload = !!(
                typeof pre?.gemini_pending_image === 'string'
                && pre.gemini_pending_image.startsWith('data:image/')
            );
            const hasActiveBridgeTask = !!(
                pre?.gemini_web_task?.requestId
                || pre?.gemini_web_batch?.sessionId
                || pendingTaskFromBridge?.requestId
                || pendingTaskFromBridge?.imageData
                || (legacyTriggerFresh && hasLegacyImagePayload)
            );
            if (hasActiveBridgeTask) {
                const canClaim = await canThisTabClaimAiImageTask();
                if (!canClaim) {
                    return;
                }
                console.log('NHP: Active AI image task for this popup window.');
                scheduleInjectRetries();
                return;
            }
            try {
                chrome.runtime.sendMessage({ action: 'NHP_SWEEP_IDLE_GEMINI_INJECT_STORAGE' }, (res) => {
                    if (chrome.runtime?.lastError) {
                        void 0;
                    } else if (res?.swept) {
                        scheduleGeminiUiCleanupAfterIdleSweep(true);
                    }
                    void canThisTabClaimAiImageTask().then((canClaim) => {
                        if (!canClaim) return;
                        setTimeout(() => {
                            void checkAndInject();
                        }, 320);
                    });
                });
            } catch (_) {
                void canThisTabClaimAiImageTask().then((canClaim) => {
                    if (!canClaim) return;
                    setTimeout(() => {
                        void checkAndInject();
                    }, 400);
                });
            }
        })().catch(() => {
            void canThisTabClaimAiImageTask().then((canClaim) => {
                if (!canClaim) return;
                setTimeout(() => {
                    void checkAndInject();
                }, 500);
            });
        });
    }

    sweepIdleThenMaybeInject();

    let capturedWatchdogBusy = false;

    setInterval(async () => {
        if (capturedWatchdogBusy) return;
        const seoBlock = extractSeoMarkedBlockFromPage();
        if (!seoBlock) return;

        const pending = loadNewestPendingCaptureState();
        if (!pending) return;
        if (isPromptTemplateSeoBlock(seoBlock)) return;

        if (isTaskRunning) return;

        capturedWatchdogBusy = true;
        try {
            console.log('NHP: Watchdog auto-capture for pending SEO task.', pending.requestId);
            isTaskRunning = true;
            const resolvedBatchTask = pending.batchTask || parseBatchMetaFromRequestId(pending.requestId, null);
            await deliverCapturedSeoText(pending.requestId, resolvedBatchTask, seoBlock);
        } finally {
            isTaskRunning = false;
            capturedWatchdogBusy = false;
        }
    }, 3200);

    /* Drop stale bridge tasks so manual ChatGPT opens do not re-inject the last image */
    let GEMINI_WEB_TASK_MAX_AGE_MS = 210000;
    const AI_IMAGE_LEGACY_MAX_AGE_MS = 120000;
    let MONITOR_INTERVAL_MS = 2400;
    const MONITOR_IDLE_MS = 90000;
    let INPUT_READY_TIMEOUT_MS = 90000;
    const SEND_RETRY_LIMIT = 6;
    const SEND_RETRY_DELAY_MS = 1600;
    const CAPTURE_PENDING_PREFIX = 'nhp_gemini_capture_pending_';
    let CAPTURE_PENDING_MAX_AGE_MS = 200000;

    void isLowSpecModeEnabledLocal().then((lowSpec) => {
        const perf = getSeoCapturePerfProfile(lowSpec);
        GEMINI_WEB_TASK_MAX_AGE_MS = perf.geminiTaskMaxAgeMs;
        MONITOR_INTERVAL_MS = lowSpec ? 4200 : 2400;
        INPUT_READY_TIMEOUT_MS = lowSpec ? 120000 : 90000;
        CAPTURE_PENDING_MAX_AGE_MS = perf.capturePendingMaxAgeMs;
        if (lowSpec) {
            console.log('NHP: SEO capture — low-spec mode (extended waits, lighter polling).');
        }
    });
    let isTaskRunning = false;
    let activeGeminiWebRequestId = null;
    let monitorInterval = null;
    let monitorStopTimer = null;

    function stopMonitor() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }
        if (monitorStopTimer) {
            clearTimeout(monitorStopTimer);
            monitorStopTimer = null;
        }
    }

    function ensureMonitorRunning() {
        if (monitorInterval) {
            if (monitorStopTimer) {
                clearTimeout(monitorStopTimer);
            }
            monitorStopTimer = setTimeout(stopMonitor, MONITOR_IDLE_MS);
            return true;
        }
        monitorInterval = setInterval(checkAndInject, MONITOR_INTERVAL_MS);
        monitorStopTimer = setTimeout(stopMonitor, MONITOR_IDLE_MS);
    }

    function canThisTabClaimAiImageTask() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'CAN_CLAIM_AI_IMAGE_TASK' }, (res) => {
                if (chrome.runtime?.lastError) {
                    resolve(false);
                    return;
                }
                resolve(!!res?.canClaim);
            });
        });
    }

    function nudgeMonitor() {
        ensureMonitorRunning();
        void checkAndInject();
    }

    function nudgeMonitorIfClaimable() {
        void canThisTabClaimAiImageTask().then((canClaim) => {
            if (!canClaim) return;
            nudgeMonitor();
        });
    }

    /* لا نفعّل المؤقت الدائم عند التحميل — يُفعَّل فقط عند تغيّر التخزين أو NHP_AI_TASK_READY لتجنّب حقن متكرر */

    function updateProgress(text, percent) {
        chrome.runtime.sendMessage({ action: 'GEMINI_PROGRESS', text, percent });
    }

    function setAiInjectionStatus(status) {
        try {
            chrome.storage.local.set({
                nhp_ai_last_injection_status: {
                    host,
                    at: Date.now(),
                    ...status
                }
            });
        } catch (_) {
        }
    }

    function getLocalStorageSafe(keys) {
        return new Promise((resolve) => {
            try {
                if (!chrome?.storage?.local?.get) {
                    resolve({});
                    return;
                }
                chrome.storage.local.get(keys, (data) => {
                    if (chrome.runtime?.lastError) {
                        console.warn('NHP: Storage read skipped:', chrome.runtime.lastError.message);
                        resolve({});
                        return;
                    }
                    resolve(data || {});
                });
            } catch (error) {
                console.warn('NHP: Storage read failed:', error?.message || error);
                resolve({});
            }
        });
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isElementVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getElementLabel(element) {
        if (!element) return '';
        return [
            element.getAttribute?.('aria-label'),
            element.getAttribute?.('data-testid'),
            element.getAttribute?.('mattooltip'),
            element.getAttribute?.('title'),
            element.textContent
        ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function isElementDisabled(element) {
        if (!element) return true;
        if (element.disabled || element.getAttribute('disabled') !== null) return true;
        const ariaDisabled = String(element.getAttribute('aria-disabled') || '').toLowerCase();
        if (ariaDisabled === 'true' || ariaDisabled === 'disabled') return true;
        const style = window.getComputedStyle?.(element);
        if (style) {
            if (style.pointerEvents === 'none' || style.visibility === 'hidden' || style.display === 'none') {
                return true;
            }
            if (Number(style.opacity || 1) < 0.35) return true;
        }
        if (element.classList?.contains('disabled') || element.classList?.contains('Mui-disabled')) {
            return true;
        }
        return false;
    }

    function hasSeoMarkerBlock(text) {
        const value = String(text || '');
        return value.includes('[SEO_TITLE]')
            && value.includes('[SEO_MAIN_TAG]')
            && value.includes('[SEO_TAGS]');
    }

    function extractOpenMarkerValue(text, markerName) {
        const closed = (String(text || '').match(
            new RegExp(`\\[${markerName}\\]([\\s\\S]*?)\\[\\/${markerName}\\]`, 'i')
        ) || [])[1];
        if (closed) return closed.replace(/\s+/g, ' ').trim();
        const open = (String(text || '').match(
            new RegExp(`\\[${markerName}\\]\\s*([\\s\\S]*?)(?=\\[(?:\\/?SEO_[A-Z_]+|SEO_))`, 'i')
        ) || [])[1];
        if (!open) return '';
        return open
            .replace(/\[\/?SEO_[A-Z_]+\]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isCompleteSeoMarkerBlock(text) {
        const value = String(text || '');
        if (!hasSeoMarkerBlock(value) || isPromptTemplateSeoBlock(value)) return false;
        const title = extractOpenMarkerValue(value, 'SEO_TITLE');
        const mainTag = extractOpenMarkerValue(value, 'SEO_MAIN_TAG');
        const tags = extractOpenMarkerValue(value, 'SEO_TAGS');
        const description = extractOpenMarkerValue(value, 'SEO_DESCRIPTION');
        if (!title || !mainTag || !tags || !description) return false;
        if (/^seo title only$/i.test(title)) return false;
        if (/^main tag only$/i.test(mainTag)) return false;
        if (/^natural product description only$/i.test(description)) return false;
        if (/^tag\s*1,\s*tag\s*2/i.test(tags)) return false;
        return true;
    }

    function isPromptTemplateSeoBlock(text) {
        const value = String(text || '');
        if (!hasSeoMarkerBlock(value)) return false;
        if (/\[SEO_TITLE\]\s*SEO title only\s*\[\/SEO_TITLE\]/i.test(value)) return true;
        if (/\[SEO_MAIN_TAG\]\s*main tag only\s*\[\/SEO_MAIN_TAG\]/i.test(value)) return true;
        if (/\[SEO_DESCRIPTION\]\s*natural product description only\s*\[\/SEO_DESCRIPTION\]/i.test(value)) return true;
        if (/\[SEO_TAGS\]\s*tag\s*1,\s*tag\s*2,\s*tag\s*3/i.test(value)) return true;
        const titleVal = (value.match(/\[SEO_TITLE\]([\s\S]*?)\[\/SEO_TITLE\]/i) || [])[1] || '';
        if (!String(titleVal).trim() || /^seo title only$/i.test(titleVal.trim())) return true;
        return false;
    }

    function isModelResponseNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node;
        if (el.matches?.('[data-message-author-role="model"], [data-message-author-role="assistant"], model-response, message-content.model-response')) {
            return true;
        }
        return !!el.closest?.('[data-message-author-role="model"], [data-message-author-role="assistant"], model-response');
    }

    function extractSeoBlockFromText(bodyText) {
        if (!bodyText || !hasSeoMarkerBlock(bodyText) || isPromptTemplateSeoBlock(bodyText)) return '';
        const closed = bodyText.match(/\[SEO_TITLE\][\s\S]*?\[\/SEO_DESCRIPTION\]/i);
        if (closed) return closed[0].trim();
        const openEnded = bodyText.match(/\[SEO_TITLE\][\s\S]*?\[SEO_DESCRIPTION\][\s\S]*/i);
        if (openEnded) return openEnded[0].trim();
        const titleOnly = bodyText.match(/\[SEO_TITLE\][\s\S]*?\[SEO_TAGS\][\s\S]*/i);
        if (titleOnly) return titleOnly[0].trim();
        return '';
    }

    function collectAllVisibleTextDeep(root = document.body, parts = [], depth = 0) {
        if (!root || depth > 40 || parts.length > 800) return parts;
        try {
            if (root.nodeType === Node.TEXT_NODE) {
                const chunk = String(root.textContent || '').replace(/\s+/g, ' ').trim();
                if (chunk.length > 2) parts.push(chunk);
            } else if (root.nodeType === Node.ELEMENT_NODE) {
                const element = root;
                if (element.shadowRoot) {
                    collectAllVisibleTextDeep(element.shadowRoot, parts, depth + 1);
                }
                element.childNodes?.forEach((child) => collectAllVisibleTextDeep(child, parts, depth + 1));
            }
        } catch (_) {
        }
        return parts;
    }

    function extractSeoMarkedBlockFromPage() {
        const modelChunks = [];
        collectTextResponseCandidates().forEach((candidate) => {
            if (!hasSeoMarkerBlock(candidate.text) || isPromptTemplateSeoBlock(candidate.text)) return;
            if (candidate.score >= 2) {
                modelChunks.push(candidate.text);
            }
        });
        for (const text of modelChunks.sort((a, b) => b.length - a.length)) {
            const block = extractSeoBlockFromText(text);
            if (block) return block;
        }

        const modelSelectors = [
            '[data-message-author-role="model"]',
            '[data-message-author-role="assistant"]',
            'model-response',
            'message-content.model-response'
        ];
        for (const selector of modelSelectors) {
            const nodes = queryAllDeep(selector);
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                if (!isElementVisible(node)) continue;
                const text = normalizeVisibleText(node);
                const block = extractSeoBlockFromText(text);
                if (block) return block;
            }
        }

        return '';
    }

    function parseBatchMetaFromRequestId(requestId, batchTask = null) {
        const meta = {
            sessionId: batchTask?.sessionId || null,
            batchIndex: Number.isFinite(batchTask?.batchIndex) ? batchTask.batchIndex : null,
            batchTotal: Number.isFinite(batchTask?.batchTotal) ? batchTask.batchTotal : null,
            itemId: batchTask?.itemId || null
        };
        const rid = String(requestId || '');
        const match = rid.match(/^(gwb_\d+_[a-z0-9]+)_(\d+)$/i);
        if (match) {
            meta.sessionId = meta.sessionId || match[1];
            if (!Number.isFinite(meta.batchIndex)) meta.batchIndex = Number(match[2]);
        }
        return meta;
    }

    function savePendingCaptureState(requestId, promptText, baselineModelCount, batchTask) {
        if (!requestId) return;
        try {
            sessionStorage.setItem(`${CAPTURE_PENDING_PREFIX}${requestId}`, JSON.stringify({
                requestId,
                promptText: promptText || '',
                baselineModelCount: Number(baselineModelCount || 0),
                batchTask: batchTask || null,
                at: Date.now()
            }));
        } catch (_) {
        }
    }

    function clearPendingCaptureState(requestId) {
        if (!requestId) return;
        try {
            sessionStorage.removeItem(`${CAPTURE_PENDING_PREFIX}${requestId}`);
        } catch (_) {
        }
    }

    function loadNewestPendingCaptureState() {
        let newest = null;
        try {
            for (let index = 0; index < sessionStorage.length; index++) {
                const key = sessionStorage.key(index);
                if (!key || !key.startsWith(CAPTURE_PENDING_PREFIX)) continue;
                const payload = JSON.parse(sessionStorage.getItem(key) || 'null');
                if (!payload?.requestId) continue;
                if ((Date.now() - Number(payload.at || 0)) > CAPTURE_PENDING_MAX_AGE_MS) {
                    sessionStorage.removeItem(key);
                    continue;
                }
                if (!newest || Number(payload.at || 0) > Number(newest.at || 0)) {
                    newest = payload;
                }
            }
        } catch (_) {
        }
        return newest;
    }

    function postGeminiWebResultReliable(requestId, batchTask, extra = {}, onDelivered) {
        const payload = buildGeminiWebResultPayload(requestId, batchTask, extra);
        const attemptSend = (attempt = 0) => {
            chrome.runtime.sendMessage(payload, (response) => {
                if (chrome.runtime?.lastError && attempt < 8) {
                    setTimeout(() => attemptSend(attempt + 1), 400 * (attempt + 1));
                    return;
                }
                const delivered = !chrome.runtime?.lastError && response?.success !== false;
                if (delivered && extra.success !== false && requestId) {
                    try {
                        sessionStorage.setItem(`nhp_gemini_done_${requestId}`, String(Date.now()));
                    } catch (_) {
                    }
                }
                if (typeof onDelivered === 'function') {
                    onDelivered(delivered, response);
                }
            });
        };
        attemptSend();
    }

    async function resumePendingCaptureIfAny() {
        const pending = loadNewestPendingCaptureState();
        if (!pending) return false;
        console.log('NHP: Resuming pending SEO capture after page reload for', pending.requestId);
        isTaskRunning = true;
        await waitForGeneratedTextAndReturn(
            pending.requestId,
            pending.promptText || '',
            pending.baselineModelCount || 0,
            pending.batchTask || null
        );
        return true;
    }

    function listModelResponseNodes() {
        const selectors = [
            '[data-message-author-role="model"]',
            '[data-message-author-role="assistant"]',
            'model-response'
        ];
        const seen = new Set();
        const nodes = [];
        selectors.forEach((selector) => {
            queryAllDeep(selector).forEach((node) => {
                if (!node || seen.has(node) || !isElementVisible(node)) return;
                seen.add(node);
                nodes.push(node);
            });
        });
        const topLevel = nodes.filter((node, index) => (
            !nodes.some((other, otherIndex) => (
                otherIndex !== index && other !== node && other.contains(node)
            ))
        ));
        topLevel.sort((left, right) => {
            const pos = left.compareDocumentPosition(right);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
        return topLevel;
    }

    function countModelResponses() {
        return listModelResponseNodes().length;
    }

    function extractSeoFromResponsesAfterBaseline(baselineModelCount = 0) {
        const baseline = Math.max(0, Number(baselineModelCount || 0));
        const nodes = listModelResponseNodes();
        const freshNodes = nodes.slice(baseline);
        for (let index = freshNodes.length - 1; index >= 0; index -= 1) {
            const block = extractSeoBlockFromText(normalizeVisibleText(freshNodes[index]));
            if (block) return block;
        }
        return '';
    }

    function extractLatestSeoMarkedBlockFromPage(baselineModelCount = 0) {
        const scoped = extractSeoFromResponsesAfterBaseline(baselineModelCount);
        if (scoped) return scoped;
        return extractSeoMarkedBlockFromPage();
    }

    function queryAllDeep(selectors, root = document, out = []) {
        if (!root || out.length > 300) return out;
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];
        try {
            selectorList.forEach((selector) => {
                root.querySelectorAll?.(selector).forEach((element) => {
                    if (!out.includes(element)) out.push(element);
                });
            });
            root.querySelectorAll?.('*').forEach((element) => {
                if (element.shadowRoot) queryAllDeep(selectorList, element.shadowRoot, out);
            });
        } catch (_) {
        }
        return out;
    }

    function resolveComposerCandidate(element) {
        if (!element) return null;

        if (
            element.matches?.('textarea, div[contenteditable="true"], [role="textbox"], [contenteditable="true"]')
            && isElementVisible(element)
        ) {
            return element;
        }

        const nestedEditable = element.querySelector?.(
            'textarea, div[contenteditable="true"], [role="textbox"], [contenteditable="true"]'
        );
        if (nestedEditable && isElementVisible(nestedEditable)) {
            return nestedEditable;
        }

        const shadowEditable = element.shadowRoot?.querySelector?.(
            'textarea, div[contenteditable="true"], [role="textbox"], [contenteditable="true"]'
        );
        if (shadowEditable && isElementVisible(shadowEditable)) {
            return shadowEditable;
        }

        return null;
    }

    function getComposer() {
        const selectors = [
            'textarea[aria-label*="Ask" i]',
            'textarea[placeholder*="Ask" i]',
            'textarea[aria-label*="question" i]',
            'textarea[placeholder*="question" i]',
            'textarea[aria-label*="سؤال" i]',
            'textarea[placeholder*="سؤال" i]',
            'textarea[aria-label*="اسأل" i]',
            'textarea[placeholder*="اسأل" i]',
            'textarea[aria-label*="اطرح" i]',
            'textarea[placeholder*="اطرح" i]',
            'div[role="textbox"]',
            '[contenteditable="true"][role="textbox"]',
            'textarea#prompt-textarea',
            'textarea[data-testid="prompt-textarea"]',
            'textarea[placeholder]',
            'rich-textarea div[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"][aria-label]',
            'div[contenteditable="true"][data-placeholder]',
            'rich-textarea',
            'textarea'
        ];

        for (const selector of selectors) {
            const elements = queryAllDeep(selector);
            for (const element of elements) {
                const composer = resolveComposerCandidate(element);
                if (composer) {
                    return composer;
                }
            }
        }

        return null;
    }

    async function waitForComposer(timeoutMs = 20000) {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            const composer = getComposer();
            if (composer) return composer;
            await sleep(400);
        }
        return null;
    }

    function getFileInput() {
        const inputs = queryAllDeep('input[type="file"]');
        return inputs.find((input) => {
            const accept = (input.getAttribute('accept') || '').toLowerCase();
            return !input.disabled && (accept.includes('image') || accept === '' || accept.includes('*/*'));
        }) || null;
    }

    async function revealGoogleAiFileInput(timeoutMs = 5000) {
        if (!isGoogleAiModeHost) return null;
        let fileInput = getFileInput();
        if (fileInput) return fileInput;

        const optionButtons = queryAllDeep('button,[role="button"]')
            .filter((button) => isElementVisible(button) && !isElementDisabled(button));
        const opener = optionButtons.find((button) => {
            const label = getElementLabel(button);
            return label.includes('options de saisie')
                || label.includes('input options')
                || label.includes('more input')
                || label.includes('plus d')
                || label.includes('\u062e\u064a\u0627\u0631\u0627\u062a')
                || label.includes('\u0627\u0644\u0645\u0632\u064a\u062f');
        });
        if (opener) {
            triggerElementClick(opener);
            await sleep(450);
        }

        const uploadButton = queryAllDeep('button,[role="button"]')
            .filter((button) => isElementVisible(button) && !isElementDisabled(button))
            .find((button) => {
                const label = getElementLabel(button);
                return label.includes('importer une image')
                    || label.includes('upload image')
                    || label.includes('add image')
                    || label.includes('\u0631\u0641\u0639 \u0635\u0648\u0631\u0629')
                    || label.includes('\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0635\u0648\u0631\u0629');
            });
        if (uploadButton) {
            triggerElementClick(uploadButton);
            await sleep(450);
        }

        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            fileInput = getFileInput();
            if (fileInput) return fileInput;
            await sleep(250);
        }
        return null;
    }

    async function waitForInputSurface(timeoutMs = INPUT_READY_TIMEOUT_MS) {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            const editor = getComposer();
            const fileInput = getFileInput();
            if (editor || fileInput) {
                return { editor, fileInput };
            }
            await sleep(700);
        }
        return { editor: getComposer(), fileInput: getFileInput() };
    }

    function colorLooksLikeGoogleSendButton(element) {
        const style = window.getComputedStyle?.(element);
        const raw = style?.backgroundColor || '';
        const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!match) return false;
        const red = Number(match[1]);
        const green = Number(match[2]);
        const blue = Number(match[3]);
        return blue > 150 && blue > red + 60 && blue > green + 35;
    }

    function getGoogleAiModeSendButton() {
        if (!isGoogleAiModeHost) return null;

        const blockedLabels = [
            'download', 'voice', 'mic', 'microphone', 'upload', 'image', 'file',
            'attach', 'plus', 'add', 'close', 'cancel', 'stop', 'delete',
            'camera', 'record', 'settings'
        ];
        const positiveLabels = [
            'send', 'submit', 'ask', 'search', 'run', 'envoyer', 'rechercher',
            'demander', 'إرسال', 'ارسل', 'اسأل', 'ابحث'
        ];

        const candidates = queryAllDeep('button, [role="button"]')
            .filter((button) => {
                if (!button || isElementDisabled(button) || !isElementVisible(button) || !isInComposerZone(button)) {
                    return false;
                }
                const label = getElementLabel(button);
                if (blockedLabels.some((blocked) => label.includes(blocked))) {
                    return false;
                }
                const rect = button.getBoundingClientRect();
                const compactIcon = rect.width >= 28 && rect.width <= 72 && rect.height >= 28 && rect.height <= 72;
                const hasPositiveLabel = positiveLabels.some((term) => label.includes(term.toLowerCase()));
                return hasPositiveLabel || colorLooksLikeGoogleSendButton(button) || (compactIcon && button.querySelector?.('svg'));
            })
            .map((button) => {
                const label = getElementLabel(button);
                const rect = button.getBoundingClientRect();
                let score = 0;
                if (positiveLabels.some((term) => label.includes(term.toLowerCase()))) score += 40;
                if (colorLooksLikeGoogleSendButton(button)) score += 35;
                if (button.querySelector?.('svg')) score += 10;
                if (rect.top > window.innerHeight * 0.55) score += 8;
                if (rect.width <= 72 && rect.height <= 72) score += 6;
                return { button, score };
            })
            .sort((a, b) => b.score - a.score);

        return candidates[0]?.button || null;
    }

    function isBlockedSendLabel(label) {
        const value = String(label || '').toLowerCase();
        return value.includes('download')
            || value.includes('voice')
            || value.includes('mic')
            || value.includes('upload')
            || value.includes('attach')
            || value.includes('stop')
            || value.includes('cancel')
            || value.includes('abort')
            || value.includes('close')
            || value.includes('remove')
            || value.includes('\u0625\u064a\u0642\u0627\u0641')
            || value.includes('\u0625\u0644\u063a\u0627\u0621')
            || value.includes('\u0625\u0632\u0627\u0644\u0629')
            || value.includes('\u062d\u0630\u0641');
    }

    function isPositiveSendLabel(label) {
        const value = String(label || '').toLowerCase();
        return value.includes('send')
            || value.includes('submit')
            || value.includes('run')
            || value.includes('ask')
            || value.includes('search')
            || value.includes('envoyer')
            || value.includes('rechercher')
            || value.includes('demander')
            || value.includes('\u0625\u0631\u0633\u0627\u0644')
            || value.includes('\u0627\u0631\u0633\u0644')
            || value.includes('\u062a\u0634\u063a\u064a\u0644')
            || value.includes('\u0627\u0633\u0623\u0644')
            || value.includes('\u0627\u0628\u062d\u062b');
    }

    function scoreSendButtonCandidate(button, composer) {
        if (!button || isElementDisabled(button) || !isElementVisible(button)) return -1;
        const label = getElementLabel(button);
        if (isBlockedSendLabel(label)) return -1;

        let score = 0;
        if (isPositiveSendLabel(label)) score += 45;
        if (button.matches?.('.send-button, [data-testid="send-button"]')) score += 40;

        const rect = button.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.5) score += 12;
        if (rect.width >= 28 && rect.width <= 72 && rect.height >= 28 && rect.height <= 72 && button.querySelector?.('svg')) {
            score += 10;
        }

        if (composer?.getBoundingClientRect) {
            const composerRect = composer.getBoundingClientRect();
            const verticalGap = Math.abs(rect.top - composerRect.bottom);
            const horizontalOverlap = rect.left <= composerRect.right && rect.right >= composerRect.left;
            if (horizontalOverlap && verticalGap < 140) score += 28;
        }

        if (isChatGptHost && button.closest?.('[data-testid="composer"], form, footer')) score += 8;
        if (isGeminiHost && button.closest?.('rich-textarea, .input-area, footer, form, [role="form"]')) score += 8;

        return score;
    }

    function pickBestSendButton(composer) {
        const selectors = [
            'button[data-testid="send-button"]',
            '[data-testid="send-button"]',
            'button.send-button',
            'button[aria-label*="Send message" i]',
            'button[aria-label*="Send prompt" i]',
            'button[aria-label*="Send" i]',
            'button[aria-label*="Submit" i]',
            'button[aria-label*="Run" i]',
            'button[aria-label*="Ask" i]',
            'button[aria-label*="Search" i]',
            'button[aria-label*="Envoyer" i]',
            'button[aria-label*="Rechercher" i]',
            'button[aria-label*="Demander" i]',
            'button[aria-label*="\u0625\u0631\u0633\u0627\u0644" i]',
            'button[aria-label*="\u062a\u0634\u063a\u064a\u0644" i]',
            'button[mattooltip*="Send" i]',
            '[role="button"][aria-label*="Send" i]',
            '[role="button"][aria-label*="\u0625\u0631\u0633\u0627\u0644" i]',
            'button[type="submit"]'
        ];

        const candidates = [];
        const seen = new Set();
        selectors.forEach((selector) => {
            queryAllDeep(selector).forEach((element) => {
                if (seen.has(element)) return;
                seen.add(element);
                const score = scoreSendButtonCandidate(element, composer);
                if (score >= 0) candidates.push({ element, score });
            });
        });

        queryAllDeep('button, [role="button"]').forEach((button) => {
            if (seen.has(button)) return;
            seen.add(button);
            const label = getElementLabel(button);
            if (!isPositiveSendLabel(label)) return;
            const score = scoreSendButtonCandidate(button, composer);
            if (score >= 0) candidates.push({ element: button, score });
        });

        candidates.sort((left, right) => right.score - left.score);
        return candidates[0]?.element || null;
    }

    function getSendButton() {
        const googleAiSendButton = getGoogleAiModeSendButton();
        if (googleAiSendButton) return googleAiSendButton;
        return pickBestSendButton(getComposer());
    }

    async function acceptAiUploadDialogs(timeoutMs = 5000) {
        const positiveLabels = [
            'accept',
            'agree',
            'continue',
            'got it',
            'accepter',
            'continuer',
            'j\\u2019accepte',
            "j'accepte",
            '\\u0645\\u0648\\u0627\\u0641\\u0642',
            '\\u0642\\u0628\\u0648\\u0644',
            '\\u0627\\u0633\\u062A\\u0645\\u0631\\u0627\\u0631'
        ];
        const negativeLabels = ['cancel', 'annuler', 'close', 'dismiss', '\\u0625\\u0644\\u063A\\u0627\\u0621'];
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
                .filter((button) => isElementVisible(button) && !isElementDisabled(button));
            const acceptButton = candidates.find((button) => {
                const text = `${getElementLabel(button)} ${button.innerText || button.textContent || ''}`.toLowerCase();
                return positiveLabels.some((label) => text.includes(label))
                    && !negativeLabels.some((label) => text.includes(label));
            });
            if (acceptButton) {
                triggerElementClick(acceptButton);
                await sleep(900);
                return true;
            }
            await sleep(400);
        }
        return false;
    }

    function collectImageAttachmentPreviewKeys() {
        const selectors = [
            'img[src^="blob:"]',
            'img[src^="data:image/"]',
            '[data-testid*="attachment" i]',
            '[aria-label*="attachment" i]',
            '[aria-label*="image" i]',
            'button[aria-label*="Remove" i]'
        ];
        const keys = new Set();
        selectors.forEach((selector) => {
            try {
                Array.from(document.querySelectorAll(selector))
                    .filter(isElementVisible)
                    .forEach((element, index) => {
                        const rect = element.getBoundingClientRect();
                        const src = element.getAttribute?.('src') || '';
                        const label = getElementLabel(element);
                        keys.add(`${selector}:${src.slice(0, 80)}:${label.slice(0, 80)}:${Math.round(rect.left)}:${Math.round(rect.top)}:${index}`);
                    });
            } catch (_) {
            }
        });
        return keys;
    }

    function hasImageAttachmentPreview(previousKeys = null) {
        const currentKeys = collectImageAttachmentPreviewKeys();
        if (!previousKeys) return currentKeys.size > 0;
        for (const key of currentKeys) {
            if (!previousKeys.has(key)) return true;
        }
        return currentKeys.size > previousKeys.size;
    }

    async function waitForImageAttachment(timeoutMs = 6000, previousKeys = null) {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            if (hasImageAttachmentPreview(previousKeys)) return true;
            await sleep(400);
        }
        return hasImageAttachmentPreview(previousKeys);
    }

    async function waitForImageAttachmentSettled(previousKeys = null, timeoutMs = 12000) {
        const startedAt = Date.now();
        let lastSignature = '';
        let stablePasses = 0;
        while ((Date.now() - startedAt) < timeoutMs) {
            const keys = collectImageAttachmentPreviewKeys();
            const signature = Array.from(keys).sort().join('|');
            const hasNewPreview = previousKeys
                ? Array.from(keys).some((key) => !previousKeys.has(key)) || keys.size > previousKeys.size
                : keys.size > 0;
            const pageText = String(document.body?.innerText || '').toLowerCase();
            const looksBusy = /uploading|attaching|processing|preparing|تحميل|جار|معالجة/.test(pageText);
            if (hasNewPreview && signature && signature === lastSignature && !looksBusy) {
                stablePasses += 1;
                if (stablePasses >= 2) return true;
            } else {
                stablePasses = 0;
            }
            lastSignature = signature;
            await sleep(700);
        }
        return hasImageAttachmentPreview(previousKeys);
    }

    async function dispatchImageDrop(target, file, previousKeys = null) {
        const dropTarget = target || getComposer() || document.body;
        if (!dropTarget) return false;

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        ['dragenter', 'dragover', 'drop'].forEach((type) => {
            dropTarget.dispatchEvent(new DragEvent(type, {
                bubbles: true,
                cancelable: true,
                dataTransfer
            }));
        });
        return waitForImageAttachment(7000, previousKeys);
    }

    function triggerElementClick(element) {
        if (!element) return false;

        element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        element.focus?.({ preventScroll: true });

        const pointerEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const type of pointerEvents) {
            const EventCtor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
            try {
                element.dispatchEvent(new EventCtor(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window,
                    button: 0,
                    buttons: 1,
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true
                }));
            } catch (_) {
                element.dispatchEvent(new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window,
                    button: 0,
                    buttons: 1
                }));
            }
        }

        if (typeof element.click === 'function') {
            element.click();
        }

        return true;
    }

    function dispatchSubmitEnter(editor, options = {}) {
        if (!editor) return false;

        const ctrlKey = !!options.ctrlKey;
        const metaKey = !!options.metaKey;
        const shiftKey = !!options.shiftKey;

        editor.focus?.({ preventScroll: true });
        ['keydown', 'keypress', 'keyup'].forEach((type) => {
            editor.dispatchEvent(new KeyboardEvent(type, {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                ctrlKey,
                metaKey,
                shiftKey
            }));
        });

        return true;
    }

    function isGenerationInProgress() {
        const selectors = [
            'button[aria-label*="Stop generating" i]',
            'button[aria-label*="Stop streaming" i]',
            'button[aria-label*="Stop response" i]',
            'button[aria-label*="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u062a\u0648\u0644\u064a\u062f" i]',
            'button[aria-label*="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0625\u0631\u0633\u0627\u0644" i]',
            '.stop-button',
            '[data-testid*="stop" i]'
        ];
        for (const selector of selectors) {
            const match = queryAllDeep(selector).find((node) => {
                if (!isElementVisible(node) || isElementDisabled(node)) return false;
                const rect = node.getBoundingClientRect?.();
                if (!rect) return true;
                return rect.top > window.innerHeight * 0.2;
            });
            if (match) return true;
        }
        return false;
    }

    function composerHasContent(editor) {
        if (!editor) return false;
        if (editor.tagName?.toLowerCase() === 'textarea') {
            return String(editor.value || '').trim().length > 0;
        }
        return String(editor.innerText || editor.textContent || '').trim().length > 0;
    }

    function isComposerCleared(editor) {
        return !composerHasContent(editor);
    }

    async function waitForSendReady(timeoutMs = 12000, allowImageOnly = false) {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            const composer = getComposer();
            const sendButton = getSendButton();
            if ((allowImageOnly || composerHasContent(composer)) && sendButton && !isElementDisabled(sendButton)) {
                return { composer, sendButton };
            }
            await sleep(350);
        }
        return {
            composer: getComposer(),
            sendButton: getSendButton()
        };
    }

    async function waitForSubmissionState(editor, baselineModelCount = 0, timeoutMs = 12000) {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            if (isGenerationInProgress()) {
                console.log('NHP: Submission confirmed (generation in progress).');
                return true;
            }
            if (countModelResponses() > baselineModelCount) {
                console.log('NHP: Submission confirmed (new model response detected).');
                return true;
            }
            await sleep(400);
        }
        console.warn('NHP: Submission was not confirmed within timeout.');
        return false;
    }

    async function prepareComposerForFreshImageSend(options = {}) {
        if (!isGeminiHost && !isChatGptHost) return true;
        if (options.isBatchItem) return true;

        const isStandaloneImageSend = !options.isBatchItem;
        const fastImageSend = options.fastImageSend === true;

        if (isChatGptHost && isStandaloneImageSend) {
            updateProgress('محادثة ChatGPT جديدة...', 8);
            await waitForComposer(30000);
            const started = await tryStartFreshChatGptConversation(options.targetUrl || window.location.href);
            if (started === 'navigating') {
                console.log('NHP: ChatGPT fresh navigation — deferring inject until page reload.');
                return false;
            }
            if (started) {
                await sleep(fastImageSend ? 900 : 3200);
                for (let attempt = 0; attempt < (fastImageSend ? 4 : 8); attempt += 1) {
                    if (await waitForComposer(fastImageSend ? 7000 : 14000)) break;
                    await sleep(fastImageSend ? 650 : 1400);
                }
                try {
                    sessionStorage.removeItem('nhp_fresh_chat_nav');
                } catch (_) {
                }
            }
        } else if (isGeminiHost && isStandaloneImageSend) {
            const gemUrl = normalizeGeminiGemTargetUrl(options.targetUrl || window.location.href);
            if (gemUrl && (isOnGeminiGemPage() || gemUrl)) {
                updateProgress('جلسة Gem جديدة...', 8);
                await reloadGeminiGemWorkspace(gemUrl);
                for (let attempt = 0; attempt < (fastImageSend ? 3 : 5); attempt += 1) {
                    await sleep(attempt === 0 ? (fastImageSend ? 850 : 2200) : (fastImageSend ? 650 : 1600));
                    if (await waitForComposer(fastImageSend ? 7000 : 12000)) break;
                }
            } else {
                tryStartFreshGeminiChat({ preserveGem: false });
                await sleep(fastImageSend ? 650 : 1600);
            }
        }

        updateProgress('Clearing previous attachments...', 12);
        for (let pass = 0; pass < (fastImageSend ? 2 : 4); pass += 1) {
            tryStripGeminiComposerAttachmentsPass();
            await sleep(pass === 0 ? (fastImageSend ? 180 : 500) : (fastImageSend ? 260 : 700));
        }
        const composer = getComposer();
        if (composer) {
            try {
                await setComposerText(composer, '');
            } catch (_) {
            }
            composer.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(fastImageSend ? 180 : 600);
        tryStripGeminiComposerAttachmentsPass();
        return true;
    }

    async function prepareComposerForNextBatchItem() {
        if (!isGeminiHost && !isChatGptHost) return;
        updateProgress('Preparing next design in the same window...', 72);
        try {
            window.scrollTo?.(0, document.body?.scrollHeight || 0);
            const scrollables = queryAllDeep('[role="log"], main, [class*="conversation"], [class*="chat"]');
            scrollables.slice(-4).forEach((node) => {
                try {
                    node.scrollTop = node.scrollHeight;
                } catch (_) {
                }
            });
        } catch (_) {
        }
        tryStripGeminiComposerAttachmentsPass();
        await sleep(700);
        const composer = getComposer();
        if (composer) {
            try {
                await setComposerText(composer, '');
            } catch (_) {
            }
            composer.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(500);
        tryStripGeminiComposerAttachmentsPass();
    }

    async function deliverCapturedSeoText(requestId, batchTask, lastText) {
        if (isPromptTemplateSeoBlock(lastText)) {
            console.warn('NHP: Refusing to deliver prompt template as SEO result.');
            isTaskRunning = false;
            await new Promise((resolve) => {
                postGeminiWebResultReliable(requestId, batchTask || parseBatchMetaFromRequestId(requestId, null), {
                    success: false,
                    error: 'Captured prompt template instead of Gemini SEO response.'
                }, () => resolve());
            });
            return;
        }
        clearPendingCaptureState(requestId);
        const resolvedBatch = batchTask || parseBatchMetaFromRequestId(requestId, null);
        const hasNextBatchItem = resolvedBatch
            && Number.isFinite(resolvedBatch.batchIndex)
            && Number.isFinite(resolvedBatch.batchTotal)
            && (resolvedBatch.batchIndex + 1) < resolvedBatch.batchTotal;

        await new Promise((resolve) => {
            postGeminiWebResultReliable(requestId, resolvedBatch, { success: true, text: lastText }, (delivered) => {
                if (!delivered) {
                    console.warn('NHP: Failed to deliver SEO result to extension background.');
                }
                resolve();
            });
        });

        await sleep(hasNextBatchItem ? 600 : 300);
        if (hasNextBatchItem) {
            const refreshEvery = Number(resolvedBatch?.chatRefreshEvery) || SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT;
            const nextIndex = Number(resolvedBatch.batchIndex) + 1;
            const nextWillRefreshChat = shouldRefreshSeoChatForBatchIndex(nextIndex, refreshEvery);
            if (!nextWillRefreshChat) {
                await prepareComposerForNextBatchItem();
            } else {
                console.log(`NHP: Skipping composer prep — design ${nextIndex + 1} will open a fresh chat.`);
            }
            nudgeMonitor();
            scheduleInjectRetries();
        }
    }

    function buildGeminiWebResultPayload(requestId, batchTask, extra = {}) {
        const batchMeta = parseBatchMetaFromRequestId(requestId, batchTask);
        const payload = {
            action: 'GEMINI_WEB_RESULT',
            requestId,
            ...extra,
            success: extra.success !== false
        };
        if (batchMeta.sessionId) {
            payload.sessionId = batchMeta.sessionId;
            payload.batchIndex = batchMeta.batchIndex;
            payload.batchTotal = batchMeta.batchTotal;
            payload.itemId = batchMeta.itemId;
        }
        return payload;
    }

    function postGeminiWebResult(requestId, batchTask, extra = {}) {
        postGeminiWebResultReliable(requestId, batchTask, extra);
    }

    async function submitComposerMessage(editor, baselineModelCount = 0) {
        const liveComposer = getComposer() || editor;
        if (!liveComposer) return false;

        const sendBtn = getSendButton();
        if (sendBtn && !isGenerationInProgress()) {
            triggerElementClick(sendBtn);
            if (await waitForSubmissionState(liveComposer, baselineModelCount, isGoogleAiModeHost ? 5000 : 10000)) {
                return true;
            }
        }

        dispatchSubmitEnter(liveComposer, { ctrlKey: true, metaKey: true });
        if (await waitForSubmissionState(liveComposer, baselineModelCount, 7000)) {
            return true;
        }

        dispatchSubmitEnter(liveComposer, { ctrlKey: true });
        if (await waitForSubmissionState(liveComposer, baselineModelCount, 7000)) {
            return true;
        }

        dispatchSubmitEnter(liveComposer, {});
        if (await waitForSubmissionState(liveComposer, baselineModelCount, 6000)) {
            return true;
        }

        const retrySendBtn = getSendButton();
        if (retrySendBtn && !isGenerationInProgress()) {
            triggerElementClick(retrySendBtn);
            return waitForSubmissionState(liveComposer, baselineModelCount, 8000);
        }

        return false;
    }

    async function setComposerText(editor, promptText) {
        if (!editor) {
            throw new Error('Gemini composer is not available.');
        }

        editor.focus();
        editor.click();
        await sleep(250);

        if (editor.tagName && editor.tagName.toLowerCase() === 'textarea') {
            const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (valueSetter) valueSetter.call(editor, promptText);
            else editor.value = promptText;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        const clearComposer = () => {
            if (document.execCommand('selectAll', false, null)) {
                document.execCommand('delete', false, null);
            } else {
                editor.textContent = '';
            }
        };

        const applyContentEditableValue = (value) => {
            const safeValue = String(value || '');
            editor.focus();

            const selection = window.getSelection?.();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);

            try {
                editor.dispatchEvent(new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: safeValue
                }));
            } catch (_) {
            }

            const lines = safeValue.split(/\r?\n/);
            const fragment = document.createDocumentFragment();
            lines.forEach((line, index) => {
                fragment.appendChild(document.createTextNode(line));
                if (index < lines.length - 1) {
                    fragment.appendChild(document.createElement('br'));
                }
            });

            editor.innerHTML = '';
            editor.appendChild(fragment);

            const tailRange = document.createRange();
            tailRange.selectNodeContents(editor);
            tailRange.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(tailRange);

            editor.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: safeValue
            }));
            editor.dispatchEvent(new Event('change', { bubbles: true }));
        };

        clearComposer();

        try {
            const pasted = document.execCommand('insertText', false, promptText);
            const currentText = String(editor.innerText || editor.textContent || '').trim();
            const expectedHead = String(promptText || '').trim().slice(0, 80);
            if (!pasted || !currentText || !currentText.includes(expectedHead)) {
                applyContentEditableValue(promptText);
            }
        } catch (_) {
            applyContentEditableValue(promptText);
        }

        editor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    }

    function dataUrlToFile(dataUrl, fileName = 'design_reference.png') {
        const value = String(dataUrl || '');
        const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
        if (!match) {
            throw new Error('Invalid image data URL.');
        }
        const mimeType = match[1] || 'image/png';
        const isBase64 = !!match[2];
        const payload = match[3] || '';
        const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new File([bytes], fileName, { type: mimeType });
    }

    async function injectImage(base64Image, editor) {
        if (!base64Image || base64Image === 'null') {
            return true;
        }

        updateProgress("Injecting Reference Image...", 30);
        tryStripGeminiComposerAttachmentsPass();
        await sleep(500);

        const baselineKeys = collectImageAttachmentPreviewKeys();
        if (baselineKeys.size >= 1) {
            console.warn(`NHP: Composer already has ${baselineKeys.size} attachment(s) — clearing before single inject.`);
            for (let pass = 0; pass < 5; pass += 1) {
                tryStripGeminiComposerAttachmentsPass();
                await sleep(600);
                if (collectImageAttachmentPreviewKeys().size === 0) break;
            }
        }

        const previousAttachmentKeys = collectImageAttachmentPreviewKeys();
        const file = dataUrlToFile(base64Image, 'design_reference.png');

        const attachmentAddedSince = async (sinceKeys, waitMs = 10000) => {
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < waitMs) {
                const now = collectImageAttachmentPreviewKeys();
                for (const key of now) {
                    if (!sinceKeys.has(key)) return true;
                }
                if (now.size > sinceKeys.size) return true;
                await sleep(400);
            }
            return hasImageAttachmentPreview(sinceKeys);
        };

        let fileInput = getFileInput();
        if (!fileInput && isGoogleAiModeHost) {
            fileInput = await revealGoogleAiFileInput();
        }
        if (fileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            const filesSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
            if (filesSetter) filesSetter.call(fileInput, dt.files);
            else fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('NHP: Image uploaded via native file input (single attempt).');
            if (await attachmentAddedSince(previousAttachmentKeys, 12000)) {
                const total = countComposerImageAttachments();
                if (total > 1) {
                    console.warn(`NHP: Multiple attachments (${total}) after file input — stopping further inject methods.`);
                }
                return true;
            }
            console.warn('NHP: File input did not show preview; trying paste once.');
        }

        const afterFileKeys = collectImageAttachmentPreviewKeys();
        if (hasImageAttachmentPreview(previousAttachmentKeys) || afterFileKeys.size > previousAttachmentKeys.size) {
            return true;
        }

        editor = getComposer() || editor;
        if (!editor || typeof editor.focus !== 'function') {
            console.warn('NHP: Composer is not ready for paste image fallback.');
            return false;
        }

        editor.focus();
        editor.click();
        await sleep(300);

        const clipboardData = new DataTransfer();
        clipboardData.items.add(file);
        editor.dispatchEvent(new ClipboardEvent('paste', {
            clipboardData,
            bubbles: true,
            cancelable: true
        }));
        console.log('NHP: Image pasted (single fallback).');
        if (await attachmentAddedSince(previousAttachmentKeys, 10000)) {
            return true;
        }

        if (await acceptAiUploadDialogs(4000)) {
            await sleep(600);
            editor = getComposer() || editor;
            editor.focus?.();
            editor.dispatchEvent(new ClipboardEvent('paste', {
                clipboardData,
                bubbles: true,
                cancelable: true
            }));
            if (await attachmentAddedSince(previousAttachmentKeys, 8000)) {
                return true;
            }
        }

        const keysBeforeDrop = collectImageAttachmentPreviewKeys();
        if (keysBeforeDrop.size > previousAttachmentKeys.size) {
            return true;
        }

        console.warn('NHP: Trying drop fallback (last resort, once).');
        return dispatchImageDrop(getComposer() || editor, file, previousAttachmentKeys);
    }

    function collectDownloadButtons() {
        return Array.from(document.querySelectorAll(
            'button[aria-label*="Download" i], a[download], button:has([data-mat-icon-name="download"]), button:has(mat-icon[fonticon="download"])'
        ));
    }

    function normalizeVisibleText(node) {
        return String(node?.innerText || node?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function collectTextResponseCandidates() {
        const selectors = [
            '[data-message-author-role="model"] .markdown',
            '[data-message-author-role="model"]',
            '[data-message-author-role="assistant"] .markdown',
            '[data-message-author-role="assistant"]',
            'pre code',
            'pre',
            'code',
            '[role="article"]',
            '[data-attrid]',
            'model-response .markdown',
            'model-response',
            'message-content .markdown',
            'message-content',
            '.model-response-text',
            '.response-content',
            'article .markdown',
            'article [data-message-author-role="assistant"]',
            '.markdown',
            '[data-response-id]'
        ];

        const bucket = [];
        selectors.forEach((selector, selectorIndex) => {
            queryAllDeep(selector).forEach((node, nodeIndex) => {
                if (!isElementVisible(node)) return;
                const text = normalizeVisibleText(node);
                if (text.length < 20) return;
                const hasJson = !!extractJsonSnippet(text);
                const hasSeoMarkers = hasSeoMarkerBlock(text);
                if (!hasJson && !hasSeoMarkers && text.length < 80) return;
                bucket.push({
                    text,
                    selector,
                    selectorIndex,
                    nodeIndex,
                    score: selector.startsWith('[data-message-author-role="model"]') || selector.startsWith('model-response')
                        ? 3
                        : selector.includes('pre') || selector === 'code'
                            ? 4
                            : selector.includes('message-content')
                            ? 2
                            : 1
                });
            });
        });
        return bucket;
    }

    function extractJsonSnippet(text) {
        const fencedMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fencedMatch?.[1]) {
            const fencedJsonMatch = fencedMatch[1].match(/\{[\s\S]*\}/);
            if (fencedJsonMatch) return fencedJsonMatch[0];
        }
        const plainMatch = String(text || '').match(/\{[\s\S]*\}/);
        return plainMatch ? plainMatch[0] : '';
    }

    function extractLatestTextResponse(promptText = '', baselineModelCount = 0) {
        const scopedSeo = extractSeoFromResponsesAfterBaseline(baselineModelCount);
        if (scopedSeo) return scopedSeo;

        const promptHead = String(promptText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        const seen = new Set();
        const candidates = collectTextResponseCandidates()
            .filter((candidate) => {
                if (!candidate.text) return false;
                if (isPromptTemplateSeoBlock(candidate.text)) return false;
                if (promptHead && candidate.text.startsWith(promptHead)) return false;
                if (candidate.text.includes('Generate structured POD SEO from the attached input')) return false;
                if (candidate.text.includes('Exact marker format')) return false;
                if (candidate.text.includes('Fill these markers with real generated SEO')) return false;
                if (candidate.text.includes('Return only valid JSON with this exact shape')) return false;
                if (candidate.text.includes('You are naming a print-on-demand')) return false;
                if (candidate.text.includes('Preparing Gemini Workspace')) return false;
                const key = candidate.text.slice(0, 220);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

        if (!candidates.length) {
            return extractSeoMarkedBlockFromPage();
        }

        const candidateWithSeoMarkers = [...candidates].reverse().find((candidate) => hasSeoMarkerBlock(candidate.text));
        if (candidateWithSeoMarkers) {
            return candidateWithSeoMarkers.text;
        }

        const candidateWithJson = [...candidates].reverse().find((candidate) => extractJsonSnippet(candidate.text));
        if (candidateWithJson) {
            return extractJsonSnippet(candidateWithJson.text);
        }

        const sorted = [...candidates].sort((left, right) => {
            if (left.score !== right.score) return right.score - left.score;
            if (left.selectorIndex !== right.selectorIndex) return right.selectorIndex - left.selectorIndex;
            return right.nodeIndex - left.nodeIndex;
        });
        return sorted[0]?.text || extractSeoMarkedBlockFromPage();
    }

    function checkAndInject() {
        (async () => {
            const queuedEarly = await getLocalStorageSafe(['gemini_web_task']);
            const queuedRequestId = queuedEarly?.gemini_web_task?.requestId || null;
            if (
                isTaskRunning
                && queuedRequestId
                && activeGeminiWebRequestId
                && String(queuedRequestId) !== String(activeGeminiWebRequestId)
            ) {
                console.warn('NHP: New SEO batch item queued — taking over from previous capture.');
                isTaskRunning = false;
            }
            if (isTaskRunning) {
                return;
            }
            if (await resumePendingCaptureIfAny()) {
                return;
            }
            const data = await getLocalStorageSafe(['gemini_pending_image', 'gemini_pending_prompt', 'gemini_auto_trigger', 'gemini_web_task', 'gemini_web_batch']);
            let webTask = data.gemini_web_task || null;
            if (!webTask && pendingTaskFromBridge?.imageData) {
                const bridgeKey = resolveAiTaskKey(pendingTaskFromBridge);
                if (bridgeKey && isAiTaskConsumed(bridgeKey)) {
                    pendingTaskFromBridge = null;
                } else {
                webTask = {
                    requestId: pendingTaskFromBridge.requestId || null,
                    prompt: pendingTaskFromBridge.prompt || '',
                    imageData: pendingTaskFromBridge.imageData,
                    mode: pendingTaskFromBridge.mode || 'images',
                    createdAt: pendingTaskFromBridge.createdAt || Date.now(),
                    sessionId: pendingTaskFromBridge.sessionId || null,
                    batchIndex: pendingTaskFromBridge.batchIndex,
                    batchTotal: pendingTaskFromBridge.batchTotal,
                    itemId: pendingTaskFromBridge.itemId || null,
                    chatRefreshEvery: pendingTaskFromBridge.chatRefreshEvery,
                    refreshChat: pendingTaskFromBridge.refreshChat,
                    forceFreshChat: pendingTaskFromBridge.forceFreshChat === true,
                    targetUrl: pendingTaskFromBridge.targetUrl || null
                };
                console.log('NHP: Using bridge-delivered AI image task payload.');
                }
            } else if (!webTask && pendingTaskFromBridge) {
                const bridgeKey = resolveAiTaskKey(pendingTaskFromBridge);
                if (bridgeKey && isAiTaskConsumed(bridgeKey)) {
                    pendingTaskFromBridge = null;
                } else {
                webTask = { ...pendingTaskFromBridge };
                console.log('NHP: Using bridge-delivered gemini web task payload.');
                }
            }
            const hasLegacyTrigger = !!data.gemini_auto_trigger;
            if (webTask) {
                const createdAt = Number(webTask.createdAt || 0);
                const ageMs = createdAt ? (Date.now() - createdAt) : GEMINI_WEB_TASK_MAX_AGE_MS + 1;
                if (!createdAt || ageMs > GEMINI_WEB_TASK_MAX_AGE_MS) {
                    console.warn('NHP: Removing expired gemini_web_task (prevents stale auto-inject on ChatGPT).');
                    await chrome.storage.local.remove(['gemini_web_task']).catch(() => {});
                    webTask = null;
                }
            }
            if (webTask?.requestId) {
                const doneKey = `nhp_gemini_done_${webTask.requestId}`;
                const capturePendingKey = `${CAPTURE_PENDING_PREFIX}${webTask.requestId}`;
                try {
                    if (sessionStorage.getItem(capturePendingKey)) {
                        console.log('NHP: Capture still pending for active task — resuming monitor instead of re-inject.');
                        isTaskRunning = true;
                        const pendingPayload = JSON.parse(sessionStorage.getItem(capturePendingKey) || 'null');
                        await waitForGeneratedTextAndReturn(
                            webTask.requestId,
                            pendingPayload?.promptText || webTask.prompt || '',
                            pendingPayload?.baselineModelCount || 0,
                            {
                                sessionId: webTask.sessionId || null,
                                batchIndex: webTask.batchIndex,
                                batchTotal: webTask.batchTotal,
                                itemId: webTask.itemId || null
                            }
                        );
                        return;
                    }
                    if (sessionStorage.getItem(doneKey)) {
                        console.warn('NHP: Ignoring gemini_web_task — already completed in this tab session.');
                        await chrome.storage.local.remove(['gemini_web_task']).catch(() => {});
                        webTask = null;
                        scheduleGeminiUiCleanupAfterIdleSweep(true);
                    }
                } catch (_) {
                }
            }
            const legacyTaskResponse = (hasLegacyTrigger || pendingTaskFromBridge?.imageData)
                ? await chrome.runtime.sendMessage({ action: 'CLAIM_PENDING_AI_IMAGE_TASK' }).catch(() => null)
                : null;
            const legacyTask = legacyTaskResponse?.success ? legacyTaskResponse.task : null;

            let injectTask = null;
            if (legacyTask?.imageData) {
                injectTask = {
                    promptText: legacyTask.promptText || data.gemini_pending_prompt,
                    base64Image: legacyTask.imageData,
                    mode: 'images',
                    requestId: null,
                    taskId: legacyTask.id || null,
                    forceFreshChat: legacyTask.forceFreshChat !== false,
                    targetUrl: legacyTask.targetUrl || window.location.href
                };
            } else if (webTask?.imageData || webTask?.prompt) {
                injectTask = {
                    promptText: webTask.prompt,
                    base64Image: webTask.imageData,
                    mode: webTask.mode || (webTask.imageData ? 'images' : 'text'),
                    requestId: webTask.requestId || null,
                    sessionId: webTask.sessionId || null,
                    batchIndex: webTask.batchIndex,
                    batchTotal: webTask.batchTotal,
                    itemId: webTask.itemId || null,
                    chatRefreshEvery: webTask.chatRefreshEvery,
                    refreshChat: webTask.refreshChat,
                    lowSpecMode: webTask.lowSpecMode,
                    targetUrl: webTask.targetUrl,
                    forceFreshChat: webTask.forceFreshChat !== false
                };
            } else if (pendingTaskFromBridge?.imageData) {
                injectTask = { ...pendingTaskFromBridge, base64Image: pendingTaskFromBridge.imageData };
            } else if (hasLegacyTrigger && data.gemini_pending_image) {
                const canClaimLegacy = await canThisTabClaimAiImageTask();
                if (!canClaimLegacy) {
                    console.log('NHP: Shared legacy image payload ignored — task is bound to another popup window.');
                    return;
                }
                injectTask = {
                    promptText: data.gemini_pending_prompt,
                    base64Image: data.gemini_pending_image,
                    mode: 'images',
                    forceFreshChat: isChatGptHost,
                    targetUrl: window.location.href
                };
            }

            if (!injectTask?.base64Image && !injectTask?.promptText) {
                if (hasLegacyTrigger) clearLegacyAutoInjectionKeys();
                return;
            }

            const injectTaskKey = resolveAiTaskKey(injectTask);
            if (injectTaskKey && (isAiTaskConsumed(injectTaskKey) || isInjectStarted(injectTaskKey))) {
                clearLegacyAutoInjectionKeys();
                pendingTaskFromBridge = null;
                return;
            }

            clearLegacyAutoInjectionKeys();
            pendingTaskFromBridge = null;
            await chrome.storage.local.remove(['gemini_web_task']).catch(() => {});

            ensureMonitorRunning();

            isTaskRunning = true;
            await acceptAiUploadDialogs(2500);
            const { editor, fileInput } = await waitForInputSurface();
            if (!editor && !fileInput) {
                console.log("NHP: AI input surface not ready yet, keeping task queued.");
                setAiInjectionStatus({ stage: 'input_surface_missing' });
                isTaskRunning = false;
                return;
            }

            console.log('NHP: Found pending design task. Starting automation (single inject).');
            setAiInjectionStatus({ taskId: injectTask.taskId || injectTask.requestId || null, stage: 'task_claimed' });
            await executeGeminiInjection(editor || fileInput, injectTask);
        })().catch((error) => {
            isTaskRunning = false;
            console.warn('NHP: AI task check failed:', error?.message || error);
        });
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') {
            return;
        }
        if (
            changes.gemini_web_task
            || changes.gemini_web_batch
        ) {
            nudgeMonitorIfClaimable();
            return;
        }
        if (changes.gemini_auto_trigger || changes.gemini_pending_image || changes.gemini_pending_prompt) {
            nudgeMonitorIfClaimable();
        }
    });

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request?.action === 'NHP_AI_BRIDGE_PING') {
            sendResponse({ ready: true, host });
            return true;
        }
        if (request?.action !== 'NHP_AI_TASK_READY') {
            return;
        }
        if (request.task) {
            const taskKey = resolveAiTaskKey(request.task);
            if (taskKey && (isAiTaskConsumed(taskKey) || isInjectStarted(taskKey))) {
                sendResponse({ success: true, skipped: 'already_injected' });
                return true;
            }
            rememberBridgeTask(request.task);
            void checkAndInject();
            sendResponse({ success: true });
            return true;
        }
        if (request.taskId) {
            chrome.runtime.sendMessage({ action: 'CLAIM_PENDING_AI_IMAGE_TASK' }, (claimRes) => {
                const taskKey = request.taskId || resolveAiTaskKey(claimRes?.task);
                if (taskKey && (isAiTaskConsumed(taskKey) || isInjectStarted(taskKey))) {
                    sendResponse({ success: true, skipped: 'already_injected' });
                    return;
                }
                if (claimRes?.success && claimRes.task) {
                    rememberBridgeTask({
                        taskId: claimRes.task.id,
                        requestId: claimRes.task.id,
                        promptText: claimRes.task.promptText,
                        imageData: claimRes.task.imageData,
                        mode: 'images',
                        forceFreshChat: claimRes.task.forceFreshChat !== false,
                        targetUrl: claimRes.task.targetUrl
                    });
                }
                void checkAndInject();
                sendResponse({ success: true });
            });
            return true;
        }
        void checkAndInject();
        sendResponse({ success: true });
        return true;
    });

    window.addEventListener('focus', () => {
        nudgeMonitorIfClaimable();
        sweepIdleThenMaybeInject();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            nudgeMonitorIfClaimable();
            sweepIdleThenMaybeInject();
        }
    });

    async function executeGeminiInjection(editor, task) {
        let handedOffToAsyncMonitor = false;
        let batchTask = null;
        const injectTaskKey = resolveAiTaskKey(task);
        const isStandaloneImageTask = !!(task?.base64Image && task.base64Image !== 'null' && !task?.sessionId);
        const fastImageSend = task?.fastImageSend === true || isStandaloneImageTask;
        let markedInjectStarted = false;
        const chatRefreshEvery = Math.max(
            1,
            Number(task?.chatRefreshEvery || pendingTaskFromBridge?.chatRefreshEvery || SEO_BATCH_CHAT_REFRESH_EVERY_DEFAULT)
        );
        if (task?.sessionId) {
            batchTask = {
                sessionId: task.sessionId,
                batchIndex: task.batchIndex,
                batchTotal: task.batchTotal,
                itemId: task.itemId,
                chatRefreshEvery
            };
        } else if (task?.requestId) {
            const parsed = parseBatchMetaFromRequestId(task.requestId, null);
            if (parsed.sessionId) {
                batchTask = { ...parsed, chatRefreshEvery };
            }
        }
        try {
            activeGeminiWebRequestId = task.requestId || null;
            if (batchTask && Number.isFinite(batchTask.batchIndex) && Number.isFinite(batchTask.batchTotal)) {
                updateProgress(`SEO batch ${batchTask.batchIndex + 1}/${batchTask.batchTotal} — preparing...`, 15);
                const shouldRefreshChat = !!task?.refreshChat
                    || (batchTask.batchIndex > 0 && (batchTask.batchIndex % chatRefreshEvery === 0));
                if (shouldRefreshChat && task?.refreshChat) {
                    // Background already reloaded the Gem tab — wait for composer only.
                    updateProgress(`SEO Gem ready — design ${batchTask.batchIndex + 1}/${batchTask.batchTotal}`, 68);
                    await waitForComposer(18000);
                    await sleep(1400);
                    const composer = getComposer();
                    if (composer) {
                        try {
                            await setComposerText(composer, '');
                        } catch (_) {
                        }
                    }
                } else if (shouldRefreshChat) {
                    await refreshGeminiChatForSeoBatch(batchTask.batchIndex, chatRefreshEvery, task);
                    await sleep(1800);
                } else if (batchTask.batchIndex > 0) {
                    await prepareComposerForNextBatchItem();
                    await sleep(batchTask.batchIndex >= 8 ? 2200 : 1200);
                }
            } else {
                updateProgress("Preparing AI Workspace...", 15);
                const workspaceReady = await prepareComposerForFreshImageSend({
                    forceNewChat: true,
                    targetUrl: task?.targetUrl,
                    isBatchItem: false,
                    fastImageSend
                });
                if (!workspaceReady) {
                    // Fresh navigation reloads the tab — must NOT leave inject-started set,
                    // or the reloaded page skips prompt/image delivery forever.
                    console.log('NHP: Fresh chat navigation in progress — inject deferred.');
                    clearInjectStarted(injectTaskKey);
                    isTaskRunning = false;
                    return;
                }
            }
            if (isStandaloneImageTask) {
                if (!tryMarkInjectStarted(injectTaskKey)) {
                    console.warn('NHP: Blocked duplicate inject for task', injectTaskKey || '(legacy)');
                    isTaskRunning = false;
                    return;
                }
                markedInjectStarted = true;
                clearLegacyAutoInjectionKeys();
            }
            console.log("NHP: AI workspace is ready.");
            await acceptAiUploadDialogs(fastImageSend ? 1000 : 4000);

            const imageAttached = await injectImage(task.base64Image, editor);
            if (task.base64Image && task.base64Image !== 'null' && !imageAttached) {
                throw new Error('Image attachment was not accepted by the AI page.');
            }
            if (task.base64Image && task.base64Image !== 'null' && imageAttached) {
                await waitForImageAttachmentSettled(null, fastImageSend ? 3000 : 9000);
                await sleep(fastImageSend ? 250 : 1200);
                setAiInjectionStatus({
                    taskId: task.taskId || task.requestId || null,
                    stage: 'image_attached'
                });
                if (task.taskId) {
                    chrome.runtime.sendMessage({
                        action: 'MARK_PENDING_AI_IMAGE_TASK_STAGE',
                        taskId: task.taskId,
                        stage: 'image_attached'
                    }).catch(() => {});
                }
            }

            updateProgress("Applying TeeMaster POD Prompt...", 50);
            const composer = await waitForComposer();
            if (!composer) {
                throw new Error('Gemini composer did not become ready after image injection.');
            }
            const hasPromptText = String(task.promptText || '').trim().length > 0;
            if (hasPromptText) {
                await setComposerText(composer, task.promptText || '');
                await sleep(fastImageSend ? 250 : 900);
            }

            updateProgress("Authenticating with Google Engine...", 65);
            const readyState = await waitForSendReady(22000, !hasPromptText);
            const activeComposer = readyState.composer || composer;
            const baselineModelCount = countModelResponses();
            let attempts = 0;

            while (attempts < SEND_RETRY_LIMIT) {
                const liveComposer = getComposer() || activeComposer;
                if (!liveComposer) {
                    await sleep(SEND_RETRY_DELAY_MS);
                    attempts++;
                    continue;
                }

                if (!composerHasContent(liveComposer) && hasPromptText) {
                    await setComposerText(liveComposer, task.promptText || '');
                    await sleep(700);
                }

                liveComposer.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(900);

                const sendBtn = getSendButton();
                if (!sendBtn) {
                    console.warn(`NHP: Send button not found (attempt ${attempts + 1}/${SEND_RETRY_LIMIT}).`);
                } else if (isElementDisabled(sendBtn)) {
                    console.warn(`NHP: Send button is disabled (attempt ${attempts + 1}/${SEND_RETRY_LIMIT}).`);
                }

                const submitted = await submitComposerMessage(liveComposer, baselineModelCount);
                if (submitted) {
                    updateProgress("Generation started! Tracking designs...", 80);
                    console.log("NHP: Task submitted successfully.");
                    const taskKey = resolveAiTaskKey(task);
                    finalizeAiImageTaskLocally(taskKey);
                    clearLegacyAutoInjectionKeys();
                    if (task.taskId) {
                        chrome.runtime.sendMessage({
                            action: 'MARK_PENDING_AI_IMAGE_TASK_STAGE',
                            taskId: task.taskId,
                            stage: 'submitted'
                        }).catch(() => {});
                    }
                    if (task.requestId) {
                        savePendingCaptureState(task.requestId, task.promptText || '', baselineModelCount, batchTask);
                    }
                    if (task.mode === 'text') {
                        handedOffToAsyncMonitor = true;
                        waitForGeneratedTextAndReturn(task.requestId, task.promptText || '', baselineModelCount, batchTask);
                    } else {
                        handedOffToAsyncMonitor = true;
                        waitForGeneratedImageAndReturn(task);
                    }
                    return;
                }

                await sleep(SEND_RETRY_DELAY_MS);
                attempts++;
            }

            updateProgress("Failed to submit message to Gemini.", 0);
            console.error("NHP: Could not confirm Gemini submission (send click / Enter shortcuts).");
            throw new Error('Could not submit the prompt to Gemini (send button remained inactive).');
        } catch (error) {
            updateProgress("Automation Error! Check console.", 0);
            console.error("NHP: Automation failed -", error);
            if (markedInjectStarted) clearInjectStarted(injectTaskKey);
            setAiInjectionStatus({
                taskId: task?.taskId || task?.requestId || null,
                stage: 'injection_failed',
                error: error.message || 'Gemini automation failed.'
            });
            if (task?.taskId) {
                chrome.runtime.sendMessage({
                    action: 'MARK_PENDING_AI_IMAGE_TASK_STAGE',
                    taskId: task.taskId,
                    stage: 'failed',
                    error: error.message || 'Gemini automation failed.'
                }).catch(() => {});
            }
            if (task?.requestId) {
                postGeminiWebResult(task.requestId, batchTask, {
                    success: false,
                    error: error.message || 'Gemini automation failed.'
                });
            }
        } finally {
            if (!handedOffToAsyncMonitor) {
                isTaskRunning = false;
            }
        }
    }

    async function waitForGeneratedTextAndReturn(requestId, promptText = '', baselineModelCount = 0, batchTask = null) {
        console.log("NHP: Text monitoring started.");
        const batchLabel = batchTask && Number.isFinite(batchTask.batchIndex) && Number.isFinite(batchTask.batchTotal)
            ? ` (${batchTask.batchIndex + 1}/${batchTask.batchTotal})`
            : '';
        const lowSpec = await isLowSpecModeEnabledLocal();
        const perf = getSeoCapturePerfProfile(lowSpec);
        updateProgress(`Waiting for Gemini response${batchLabel}...`, 80);

        let lastText = '';
        let stablePasses = 0;
        let waitTime = 0;
        let sawFreshResponse = false;
        let captured = false;

        const isBatchSeoTask = !!(batchTask && Number.isFinite(batchTask.batchIndex));
        const freshModelGraceMs = isBatchSeoTask ? perf.freshModelGraceMs : (lowSpec ? 22000 : 12000);

        const tryCaptureNow = async (reason, options = {}) => {
            const scopedLatest = extractSeoFromResponsesAfterBaseline(baselineModelCount);
            if (scopedLatest && !isPromptTemplateSeoBlock(scopedLatest)) {
                lastText = scopedLatest;
            }
            if (captured || !lastText) return false;
            if (isPromptTemplateSeoBlock(lastText)) {
                console.warn('NHP: Ignoring prompt template markers — waiting for Gemini model response.');
                lastText = '';
                stablePasses = 0;
                return false;
            }
            const hasMarkers = hasSeoMarkerBlock(lastText);
            const force = options.force === true;
            const modelCount = countModelResponses();
            const hasFreshModel = modelCount > baselineModelCount;
            const markersComplete = hasMarkers && isCompleteSeoMarkerBlock(lastText);
            if (!hasMarkers && isGenerationInProgress()) return false;
            if (hasMarkers && !hasFreshModel && waitTime < freshModelGraceMs) return false;
            if (hasMarkers && !markersComplete && isGenerationInProgress() && waitTime < perf.generatingBlockWaitMs) return false;
            if (hasMarkers && !markersComplete && !force && waitTime < perf.completeBlockWaitMs) return false;
            if (hasMarkers && isGenerationInProgress() && !force && waitTime < (lowSpec ? 14000 : 8000)) return false;
            captured = true;
            console.log(`NHP: SEO text captured (${reason}).`);
            updateProgress("Gemini response captured.", 100);
            const resolvedBatchTask = batchTask || parseBatchMetaFromRequestId(requestId, null);
            await deliverCapturedSeoText(requestId, resolvedBatchTask, lastText);
            isTaskRunning = false;
            activeGeminiWebRequestId = null;
            return true;
        };

        const observer = new MutationObserver(() => {
            const seoBlock = extractLatestSeoMarkedBlockFromPage(baselineModelCount);
            if (!seoBlock || isPromptTemplateSeoBlock(seoBlock)) return;
            if (countModelResponses() <= baselineModelCount && waitTime < 10000) return;
            lastText = seoBlock;
            sawFreshResponse = true;
            stablePasses = 0;
            void tryCaptureNow('mutation', { force: true });
        });
        try {
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (_) {
        }

        try {
            while (waitTime < perf.maxWaitMs && !captured) {
                const pollMs = isGenerationInProgress() ? perf.pollMsGenerating : perf.pollMsIdle;
                await sleep(pollMs);
                waitTime += pollMs;

                const modelCount = countModelResponses();
                const hasFreshModel = modelCount > baselineModelCount;
                let currentText = extractLatestTextResponse(promptText, baselineModelCount);
                if (!currentText) currentText = extractLatestSeoMarkedBlockFromPage(baselineModelCount);

                if (hasFreshModel || isGenerationInProgress()) {
                    sawFreshResponse = true;
                }

                if (hasSeoMarkerBlock(currentText)) {
                    sawFreshResponse = true;
                    lastText = currentText;
                    stablePasses += 1;
                    updateProgress(`Reading Gemini SEO block (${Math.floor(waitTime / 1000)}s)...`, 90);
                    const blockReady = isCompleteSeoMarkerBlock(currentText);
                    const stableNeeded = perf.stablePassesNeeded;
                    if (blockReady && (!isGenerationInProgress() || stablePasses >= stableNeeded || waitTime >= 5000)) {
                        if (await tryCaptureNow('seo-markers', { force: true })) return;
                    } else if (!blockReady && waitTime >= perf.partialBlockWaitMs && !isGenerationInProgress()) {
                        if (await tryCaptureNow('seo-markers-partial', { force: true })) return;
                    }
                    continue;
                }

                if (currentText && currentText !== lastText) {
                    if (sawFreshResponse || hasFreshModel || isGenerationInProgress()) {
                        lastText = currentText;
                        stablePasses = 0;
                        updateProgress(`Reading Gemini response (${Math.floor(waitTime / 1000)}s)...`, 88);
                    }
                } else if (currentText && sawFreshResponse) {
                    stablePasses += 1;
                }

                if (sawFreshResponse && lastText && !isGenerationInProgress() && stablePasses >= 1) {
                    if (await tryCaptureNow('stable-text', { force: true })) return;
                }

                if (waitTime > (lowSpec ? 70000 : 45000) && lastText && hasSeoMarkerBlock(lastText) && !isGenerationInProgress()) {
                    if (await tryCaptureNow('marker-fallback', { force: true })) return;
                }

                if (waitTime > (lowSpec ? 200000 : 120000) && lastText && !isGenerationInProgress()) {
                    if (await tryCaptureNow('late-fallback', { force: true })) return;
                }
            }
        } finally {
            observer.disconnect();
        }

        if (!captured) {
            clearPendingCaptureState(requestId);
            const timeoutFallback = extractSeoFromResponsesAfterBaseline(baselineModelCount);
            if (timeoutFallback && !isPromptTemplateSeoBlock(timeoutFallback)) {
                captured = true;
                console.log('NHP: SEO text captured (timeout-fallback from latest model block).');
                await deliverCapturedSeoText(requestId, batchTask, timeoutFallback);
            } else {
                postGeminiWebResultReliable(requestId, batchTask, {
                    success: false,
                    error: sawFreshResponse
                        ? 'Timed out while waiting for Gemini text response.'
                        : 'Gemini did not start generating a new response after submit.'
                });
            }
            isTaskRunning = false;
            activeGeminiWebRequestId = null;
        }
    }

    async function waitForGeneratedImageAndReturn(task = null) {
        const taskKey = resolveAiTaskKey(task);
        console.log("NHP: Ultra monitoring started.");
        updateProgress("Waiting for designs to finish...", 80);

        const finishImageCapture = () => {
            finalizeAiImageTaskLocally(taskKey);
            if (taskKey) {
                chrome.runtime.sendMessage({
                    action: 'MARK_PENDING_AI_IMAGE_TASK_STAGE',
                    taskId: taskKey,
                    stage: 'done'
                }).catch(() => {});
                chrome.runtime.sendMessage({
                    action: 'CLEAR_PENDING_AI_IMAGE_TASK',
                    taskId: taskKey
                }).catch(() => {});
            }
        };

        const observer = new MutationObserver(() => {
            const downloadButtons = collectDownloadButtons();
            if (downloadButtons.length >= 4) {
                updateProgress("Capturing final 4 designs!", 95);
                console.log(`NHP: Found ${downloadButtons.length} download buttons.`);

                downloadButtons.forEach((btn, index) => {
                    setTimeout(() => {
                        btn.click();
                        console.log(`NHP: Clicked download button ${index + 1}`);
                    }, index * 2000);
                });

                observer.disconnect();
                isTaskRunning = false;
                finishImageCapture();
                updateProgress("Success! Designing sent to Studio.", 100);
                scheduleSafeAiPopupClose(15000);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        let waitTime = 0;
        while (waitTime < 180000) {
            await sleep(5000);
            waitTime += 5000;

            if (waitTime % 10000 === 0) {
                updateProgress(`Processing designs (${Math.floor(waitTime / 1000)}s)...`, 85);
            }

            const isGenerating = isGenerationInProgress();

            if (!isGenerating && waitTime > 40000) {
                const downloadButtons = collectDownloadButtons();
                if (downloadButtons.length > 0) {
                    downloadButtons.forEach((btn, index) => setTimeout(() => btn.click(), index * 1500));
                    observer.disconnect();
                    isTaskRunning = false;
                    finishImageCapture();
                    updateProgress("Capture Complete!", 100);
                    scheduleSafeAiPopupClose(10000);
                    return;
                }

                const allImages = Array.from(document.querySelectorAll('message-content img, extension-image img, img'));
                const imageUrls = allImages
                    .filter((img) => (img.width > 250 || img.naturalWidth > 250) && (img.src.includes('googleusercontent') || img.src.includes('blob:')))
                    .map((img) => img.src);

                if (imageUrls.length >= 4) {
                    updateProgress("Finalizing direct capture...", 95);
                    chrome.runtime.sendMessage({ action: 'GEMINI_IMAGES_GENERATED', images: imageUrls });
                    updateProgress("Complete!", 100);
                    observer.disconnect();
                    isTaskRunning = false;
                    finishImageCapture();
                    scheduleSafeAiPopupClose(5000);
                    return;
                }
            }
        }
        isTaskRunning = false;
        finishImageCapture();
    }
})();
