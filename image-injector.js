/**
 * Niche Hunter Pro - Image Injector
 * Adds floating send-to-Gemini/GPT buttons over large images on supported sites.
 */

(function () {
    console.log("NHP: Image Injector Loaded");

    let isActive = true;
    let currentImageElement = null;
    let pinterestPublishRunning = false;
    const PINTEREST_SELECTOR_MEMORY_KEY = 'nhp_pinterest_selector_memory_v1';
    const PINTEREST_AI_DIAG_KEY = 'nhp_pinterest_ai_diagnostics_v1';
    const PINTEREST_AI_MODEL_LABEL = 'Gemini Selector Healer';

    const GEMINI_POPUP_URL = 'https://gemini.google.com/gem/17JX6Wb5RhTO25MXBEEYdAJZ0agwbQ-Yg';
    const GPT_POPUP_URL = 'https://chatgpt.com/g/g-69db6eabc5e48191844d04a90423616c-artisan-teepublic';
    const GEMINI_BUTTON_LABEL = 'GMINI';
    const GPT_BUTTON_LABEL = 'GPT';
    const PROMPT_BAG_BUTTON_LABEL = 'SAK';
    const GENERATE_BUTTON_LABEL = 'GEN';
    const GENERATE_PREPARING_LABEL = '\u23F3 \u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0648\u064A\u0644...';
    const GENERATE_FETCH_ERROR_LABEL = '\u274C \u0641\u0634\u0644 \u0633\u062D\u0628 \u0627\u0644\u0635\u0648\u0631\u0629';
    const GENERATE_SUCCESS_LABEL = '\u2705 \u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644!';
    const GENERATE_ERROR_LABEL = '\u274C \u062E\u0637\u0623';
    const BRIDGE_ONLINE_TITLE = 'AI Bridge Server: connected';
    const BRIDGE_OFFLINE_TITLE = 'AI Bridge Server: disconnected';
    const BRIDGE_CHECKING_TITLE = 'AI Bridge Server: checking...';
    const BRIDGE_REQUIRED_LABEL = 'SERVER OFF';
    const PROMPT_BAG_SAVING_LABEL = '\u23F3 \u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638...';
    const PROMPT_BAG_SUCCESS_LABEL = '\u2705 \u062D\u064F\u0641\u0638\u062A';
    const PROMPT_BAG_ERROR_LABEL = '\u274C \u0641\u0634\u0644 \u0627\u0644\u062D\u0641\u0638';
    const GEMINI_PREPARING_LABEL = '\u23F3 \u062C\u0627\u0631\u064A \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0635\u0648\u0631\u0629...';
    const GPT_PREPARING_LABEL = '\u23F3 \u062C\u0627\u0631\u064A \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0635\u0648\u0631\u0629...';
    const GEMINI_FETCH_ERROR_LABEL = '\u274C \u0641\u0634\u0644 \u0633\u062D\u0628 \u0627\u0644\u0635\u0648\u0631\u0629';
    const GPT_FETCH_ERROR_LABEL = '\u274C \u0641\u0634\u0644 \u0633\u062D\u0628 \u0627\u0644\u0635\u0648\u0631\u0629';
    const GEMINI_SUCCESS_LABEL = '\u2705 \u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644!';
    const GPT_SUCCESS_LABEL = '\u2705 \u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644!';
    const GEMINI_ERROR_LABEL = '\u274C \u062E\u0637\u0623';
    const GPT_ERROR_LABEL = '\u274C \u062E\u0637\u0623';
    const GEMINI_OPEN_ERROR_LABEL = '\u274C \u0641\u0634\u0644 \u0641\u062A\u062D Gemini';
    const GPT_OPEN_ERROR_LABEL = '\u274C \u0641\u0634\u0644 \u0641\u062A\u062D GPT';
    const INJECTOR_DIAG_PREFIX = 'NHP Injector DIAG';
    const IMAGE_PREP_TIMEOUT_MS = 18000;
    const IMAGE_CANVAS_TIMEOUT_MS = 5000;
    const IMAGE_SEND_TIMEOUT_MS = 22000;
    const injectorDiag = {
        initAt: new Date().toISOString(),
        host: window.location.hostname,
        hoverCandidates: 0,
        hoverDetected: 0,
        shown: 0,
        bothShown: 0,
        bothHidden: 0,
        hiddenCapture: 0,
        hiddenOutside: 0,
        clicks: { gemini: 0, gpt: 0, generate: 0 },
        lastShow: null,
        lastError: null
    };
    window.__NHP_INJECTOR_DIAG = injectorDiag;

    function diagLog(level, message, payload) {
        const suffix = payload ? ` | ${JSON.stringify(payload)}` : '';
        console[level](`${INJECTOR_DIAG_PREFIX}: ${message}${suffix}`);
    }
    const HOVER_BUTTON_LAYOUT = {
        minWidth: 58,
        gap: 4,
        edgePadding: 8,
        topOffset: 10
    };
    const INJECTOR_PROMPT_ARABIC_GUIDANCE_ONE = '- \u0627\u062C\u0639\u0644 \u0623\u0648\u0644 \u062A\u0635\u0645\u064A\u0645 \u0628\u0646\u0641\u0633 \u0633\u062A\u0627\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0631\u0641\u0642\u0629 \u0648\u0644\u0643\u0646 \u0628\u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0623\u0639\u0644\u0649.';
    const INJECTOR_PROMPT_ARABIC_GUIDANCE_TWO = '- \u0642\u0645 \u0628\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0631\u0624\u0649 \u0627\u0644\u0630\u0643\u064A\u0629 (AI Insights) \u0627\u0644\u062A\u064A \u0627\u0633\u062A\u0646\u062A\u062C\u062A\u0647\u0627 \u0644\u0627\u0628\u062A\u0643\u0627\u0631 \u0623\u0641\u0643\u0627\u0631 \u062A\u0633\u062F \u0627\u0644\u062B\u063A\u0631\u0627\u062A \u0627\u0644\u062A\u0633\u0648\u064A\u0642\u064A\u0629 \u0648\u062A\u062A\u0641\u0648\u0642 \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u0627\u0641\u0633\u064A\u0646 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0646\u064A\u0634.';

    const sendRuntimeMessage = (payload) => new Promise((resolve) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(response || { success: false, error: 'No response from background.' });
        });
    });

    const storageGet = (keys) => new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result || {});
        });
    });

    const storageSet = (payload) => new Promise((resolve) => {
        chrome.storage.local.set(payload, () => resolve());
    });

    const extractSrcsetUrls = (srcset) => {
        if (!srcset) return [];
        return srcset
            .split(',')
            .map((part) => part.trim().split(/\s+/)[0])
            .filter(Boolean)
            .reverse();
    };

    const normalizePinterestUrl = (url) => url.includes('pinimg.com')
        ? url.replace(/pinimg\.com\/(?:\d+x|[\d]+x|236x|474x|564x)\//, 'pinimg.com/originals/')
        : url;

    const isVisibleElement = (el) => {
        if (!el || !(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && rect.width > 0
            && rect.height > 0;
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message || 'Operation timed out.')), timeoutMs);
        Promise.resolve(promise)
            .then(resolve, reject)
            .finally(() => clearTimeout(timer));
    });
    const EDITABLE_SELECTOR = 'input:not([type="file"]):not([type="hidden"]), textarea, [contenteditable="true"], [role="textbox"], [aria-multiline="true"]';

    const getElementTextFingerprint = (el) => {
        const nearbyLabel = el.closest?.('label')?.textContent;
        const previousText = el.previousElementSibling?.textContent;
        const nextText = el.nextElementSibling?.textContent;
        const parentText = el.parentElement?.textContent;
        const grandParentText = el.parentElement?.parentElement?.textContent;
        const attrs = [
            el.getAttribute?.('aria-label'),
            el.getAttribute?.('placeholder'),
            el.getAttribute?.('name'),
            el.getAttribute?.('id'),
            el.getAttribute?.('data-test-id'),
            el.textContent,
            nearbyLabel,
            previousText,
            nextText,
            parentText,
            grandParentText
        ];
        return attrs.filter(Boolean).join(' ').toLowerCase();
    };

    function getRectArea(el) {
        const rect = el?.getBoundingClientRect?.();
        if (!rect) return 0;
        return Math.max(0, rect.width) * Math.max(0, rect.height);
    }

    function isEditableField(el, purpose = 'generic') {
        if (!el || !isVisibleElement(el)) return false;
        if (el.hidden || el.disabled || el.getAttribute?.('aria-hidden') === 'true') return false;

        const tag = (el.tagName || '').toLowerCase();
        const type = (el.getAttribute?.('type') || '').toLowerCase();
        const role = (el.getAttribute?.('role') || '').toLowerCase();
        const rect = el.getBoundingClientRect();
        const isNative = !!el.matches?.('input:not([type="file"]):not([type="hidden"]), textarea');
        const isRich = !!(el.isContentEditable || el.getAttribute?.('contenteditable') === 'true' || role === 'textbox');

        if (!isNative && !isRich) return false;
        if (tag === 'input' && type === 'hidden') return false;
        if (purpose === 'description' && tag === 'input' && role !== 'textbox') return false;
        if (purpose === 'description' && rect.height < 24 && !isRich && tag !== 'textarea') return false;
        if (purpose !== 'link' && rect.width < 90 && !isNative) return false;

        return true;
    }

    function scoreEditableCandidate(el, purpose = 'generic', hints = []) {
        if (!isEditableField(el, purpose)) return Number.NEGATIVE_INFINITY;

        const rect = el.getBoundingClientRect();
        const tag = (el.tagName || '').toLowerCase();
        const type = (el.getAttribute?.('type') || '').toLowerCase();
        const role = (el.getAttribute?.('role') || '').toLowerCase();
        const fingerprint = getElementTextFingerprint(el);
        const isRich = el.isContentEditable || el.getAttribute?.('contenteditable') === 'true' || role === 'textbox';
        const isMultiLine = tag === 'textarea' || isRich || el.getAttribute?.('aria-multiline') === 'true';

        let score = Math.min(rect.width, 900) / 8;
        score += Math.min(rect.height, 240) / 4;
        score += Math.min(getRectArea(el), 180000) / 3500;

        if (isRich) score += 70;
        if (role === 'textbox') score += 25;
        if (tag === 'textarea') score += 35;
        if (tag === 'input') score += 30;

        if (purpose === 'title') {
            if (tag === 'input' && type !== 'url') score += 90;
            if (isMultiLine) score -= 45;
        }

        if (purpose === 'description') {
            if (isMultiLine) score += 110;
            if (rect.height >= 40) score += 35;
            if (tag === 'input' && role !== 'textbox') score -= 120;
        }

        if (purpose === 'link') {
            if (type === 'url') score += 120;
            if (tag === 'input') score += 45;
            if (isMultiLine) score -= 80;
        }

        if (hints.some((hint) => fingerprint.includes(hint))) score += 55;
        if (el === document.activeElement) score += 25;
        if (el.getAttribute?.('tabindex') === '-1') score -= 20;
        if (rect.width < 140) score -= 15;
        if (rect.height < 18) score -= 30;

        return score;
    }

    const setInputValue = (el, value) => {
        if (!el) return false;
        const normalized = String(value || '');
        el.focus();

        if (el.isContentEditable) {
            el.textContent = normalized;
            el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: normalized, inputType: 'insertText' }));
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: normalized, inputType: 'insertText' }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }

        const proto = el.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, normalized);
        else el.value = normalized;

        el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: normalized, inputType: 'insertText' }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        return true;
    };

    const setTextareaValueHard = (el, value) => {
        if (!el) return false;
        const normalized = String(value || '');
        try {
            el.focus();
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (setter) setter.call(el, normalized);
            else el.value = normalized;
            el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: normalized, inputType: 'insertText' }));
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: normalized, inputType: 'insertText' }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End', code: 'End' }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End', code: 'End' }));
            el.blur();
            return String(el.value || '').trim() === normalized.trim();
        } catch (error) {
            console.warn('NHP Pinterest hard textarea fill failed:', error);
            return false;
        }
    };

    function setFieldValueInMainWorld(selector, value) {
        void selector;
        void value;
        return Promise.resolve(false);
    }

    function typeFieldValueInMainWorld(selector, value) {
        void selector;
        void value;
        return Promise.resolve(false);
    }

    async function waitForCondition(checker, timeout = 20000, interval = 350) {
        const start = Date.now();
        while ((Date.now() - start) < timeout) {
            const result = checker();
            if (result) return result;
            await sleep(interval);
        }
        return null;
    }

    function isCaptureSelectionActive() {
        return window.__screeeeenvmeSelectionActive === true
            || !!document.getElementById('__screeeeenvme-selection-overlay');
    }

    function dataUrlToFile(dataUrl, fileName = 'pinterest-design.png') {
        const [meta, content] = String(dataUrl || '').split(',');
        const mime = meta?.match(/data:(.*?);base64/)?.[1] || 'image/png';
        const byteString = atob(content || '');
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
        return new File([bytes], fileName, { type: mime });
    }

    function clickElement(el) {
        if (!el) return false;
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((type) => {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
        if (typeof el.click === 'function') el.click();
        return true;
    }

    function findTextElementByHints(hints) {
        const candidates = Array.from(document.querySelectorAll('input, textarea, div, span, p, h1, h2, h3, label, button, [role="textbox"], [contenteditable="true"], [aria-label], [placeholder]'))
            .filter(isVisibleElement)
            .filter((el) => {
                const fingerprint = getElementTextFingerprint(el).trim();
                return fingerprint && fingerprint.length <= 260;
            });

        return candidates.find((el) => {
            const fingerprint = getElementTextFingerprint(el);
            return hints.some((hint) => fingerprint.includes(hint));
        }) || null;
    }

    function findPinterestFieldByHints(hints, excluded = new Set(), purpose = 'generic') {
        const fields = collectPinterestFormFields().filter(({ el }) => !excluded.has(el));
        return fields
            .filter(({ fingerprint }) => hints.some((hint) => fingerprint.includes(hint)))
            .sort((a, b) => scoreEditableCandidate(b.el, purpose, hints) - scoreEditableCandidate(a.el, purpose, hints))[0]?.el || null;
    }

    function collectNearbyEditableCandidates(seedEl) {
        const scopes = [];
        const seenScopes = new Set();

        let current = seedEl;
        for (let depth = 0; current && depth < 5; depth += 1) {
            if (!seenScopes.has(current)) {
                scopes.push(current);
                seenScopes.add(current);
            }
            current = current.parentElement;
        }

        [
            seedEl?.previousElementSibling,
            seedEl?.nextElementSibling,
            seedEl?.parentElement?.previousElementSibling,
            seedEl?.parentElement?.nextElementSibling,
            document.activeElement
        ].filter(Boolean).forEach((scope) => {
            if (!seenScopes.has(scope)) {
                scopes.push(scope);
                seenScopes.add(scope);
            }
        });

        const seen = new Set();
        const candidates = [];
        const push = (el) => {
            if (!el || seen.has(el)) return;
            seen.add(el);
            candidates.push(el);
        };

        scopes.forEach((scope) => {
            if (scope?.matches?.(EDITABLE_SELECTOR)) push(scope);
            scope?.querySelectorAll?.(EDITABLE_SELECTOR)?.forEach(push);
        });

        return candidates;
    }

    function resolveEditableTarget(seedEl, purpose = 'generic', hints = []) {
        return collectNearbyEditableCandidates(seedEl)
            .filter((el) => isEditableField(el, purpose) && !isFieldFingerprintExcludedForPurpose(getElementTextFingerprint(el), purpose))
            .sort((a, b) => scoreEditableCandidate(b, purpose, hints) - scoreEditableCandidate(a, purpose, hints))[0] || null;
    }

    async function activatePinterestFieldByText(hints, purpose = 'generic', timeout = 12000) {
        const trigger = await waitForCondition(() => findTextElementByHints(hints), timeout);
        if (!trigger) return null;
        clickElement(trigger);
        await sleep(250);
        const resolved = resolveEditableTarget(trigger, purpose, hints) || (isEditableField(trigger, purpose) ? trigger : null);
        if (!resolved) return null;
        return isFieldFingerprintExcludedForPurpose(getElementTextFingerprint(resolved), purpose) ? null : resolved;
    }

    async function openPinterestFieldActivator(hints = [], fieldSelectorCandidates = [], purpose = 'generic', timeout = 8000) {
        const trigger = await waitForCondition(() => findTextElementByHints(hints), timeout, 200);
        if (!trigger) return null;
        clickElement(trigger);
        await sleep(350);
        const directField = queryFirstVisible(fieldSelectorCandidates);
        if (directField && !isFieldFingerprintExcludedForPurpose(getElementTextFingerprint(directField), purpose)) {
            return directField;
        }
        const resolved = resolveEditableTarget(trigger, purpose, hints);
        if (resolved && !isFieldFingerprintExcludedForPurpose(getElementTextFingerprint(resolved), purpose)) {
            return resolved;
        }
        return null;
    }

    function setRichEditableValue(el, value) {
        const target = isEditableField(el) ? el : resolveEditableTarget(el);
        if (!target) return false;
        const normalized = String(value || '');
        target.focus();

        if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true' || target.getAttribute?.('role') === 'textbox') {
            try {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, normalized);
            } catch (_) {
                // Fallback below.
            }

            if ((target.innerText || target.textContent || '').trim() !== normalized) {
                target.textContent = normalized;
                target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: normalized, inputType: 'insertText' }));
                target.dispatchEvent(new InputEvent('input', { bubbles: true, data: normalized, inputType: 'insertText' }));
            }

            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }

        return setInputValue(target, normalized);
    }

    function getEditableValue(el) {
        if (!el) return '';
        if (el.matches?.('input, textarea')) return String(el.value || '').trim();
        return String(el.innerText || el.textContent || '').trim();
    }

    async function fillPinterestField(candidates, value, purpose = 'generic', hints = []) {
        const expected = String(value || '').trim();
        if (!expected) return null;

        for (const candidate of candidates.filter(Boolean)) {
            const target = isEditableField(candidate, purpose)
                ? candidate
                : resolveEditableTarget(candidate, purpose, hints);
            if (!target) continue;
            if (isFieldFingerprintExcludedForPurpose(getElementTextFingerprint(target), purpose)) continue;
            clickElement(target);
            await sleep(180);
            setRichEditableValue(target, expected);
            await sleep(220);

            const actual = getEditableValue(target);
            if (!actual) continue;

            const probe = expected.slice(0, Math.min(24, expected.length)).toLowerCase();
            if (!probe || actual.toLowerCase().includes(probe) || actual.length >= Math.max(6, Math.floor(expected.length * 0.6))) {
                return target;
            }
        }

        return null;
    }

    function collectPinterestFormFields() {
        return Array.from(document.querySelectorAll(EDITABLE_SELECTOR))
            .filter(isVisibleElement)
            .map((el) => ({
                el,
                tag: el.tagName.toLowerCase(),
                type: (el.getAttribute('type') || '').toLowerCase(),
                fingerprint: getElementTextFingerprint(el),
                maxLength: Number(el.getAttribute('maxlength') || 0),
                multiLine: el.tagName === 'TEXTAREA'
                    || el.isContentEditable
                    || el.getAttribute('role') === 'textbox'
                    || el.getAttribute('aria-multiline') === 'true'
            }));
    }

    function isFieldFingerprintExcludedForPurpose(fingerprint, purpose = 'generic') {
        const text = String(fingerprint || '').toLowerCase();
        if (!text) return false;

        if (purpose === 'description') {
            return ['add your title', 'pin title', 'pin-draft-title', 'destination link', 'pin-draft-link', 'add a destination link'].some((hint) => text.includes(hint));
        }

        if (purpose === 'link') {
            return ['add your title', 'pin title', 'pin-draft-title', 'alt text', 'alttext', 'explain what people can see in the pin', 'description'].some((hint) => text.includes(hint));
        }

        return false;
    }

    function buildPinterestFieldSnapshot() {
        return collectPinterestFormFields().map(({ el, tag, type, fingerprint, maxLength, multiLine }) => ({
            tag,
            type,
            maxLength,
            multiLine,
            fingerprint: fingerprint.slice(0, 220),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height)
        }));
    }

    function describePinterestField(el) {
        if (!el) return null;
        return {
            tag: (el.tagName || '').toLowerCase(),
            id: el.getAttribute?.('id') || '',
            name: el.getAttribute?.('name') || '',
            placeholder: el.getAttribute?.('placeholder') || '',
            aria: el.getAttribute?.('aria-label') || '',
            role: el.getAttribute?.('role') || '',
            type: el.getAttribute?.('type') || '',
            valuePreview: getEditableValue(el).slice(0, 80),
            fingerprint: getElementTextFingerprint(el).slice(0, 220)
        };
    }

    async function attemptRankedPinterestFill(value, purpose, hints, excluded = new Set()) {
        const candidates = collectPinterestFormFields()
            .filter(({ el }) => !excluded.has(el))
            .sort((a, b) => scoreEditableCandidate(b.el, purpose, hints) - scoreEditableCandidate(a.el, purpose, hints))
            .map(({ el }) => el)
            .slice(0, 10);

        return await fillPinterestField(candidates, value, purpose, hints);
    }

    function showPinterestDebugPanel(snapshot, missingPurposes = []) {
        let panel = document.getElementById('nhp-pinterest-debug-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'nhp-pinterest-debug-panel';
            panel.style.cssText = [
                'position:fixed',
                'top:16px',
                'left:16px',
                'z-index:2147483647',
                'max-width:420px',
                'max-height:70vh',
                'overflow:auto',
                'background:rgba(15,23,42,0.96)',
                'color:#e5e7eb',
                'border:1px solid rgba(244,63,94,0.35)',
                'border-radius:12px',
                'padding:12px',
                'font:12px/1.5 Consolas, monospace',
                'white-space:pre-wrap',
                'box-shadow:0 20px 50px rgba(0,0,0,0.45)'
            ].join(';');
            document.body.appendChild(panel);
        }

        panel.textContent = [
            `NHP Pinterest Debug`,
            `Missing: ${missingPurposes.join(', ') || 'none'}`,
            '',
            ...snapshot.slice(0, 12).map((item, index) =>
                `${index + 1}. [${item.tag}|${item.type || 'n/a'}|${item.multiLine ? 'multi' : 'single'}|${item.width}x${item.height}|max=${item.maxLength || 0}] ${item.fingerprint}`
            )
        ].join('\n');
    }

    function queryFirstVisible(selectors = []) {
        for (const selector of selectors) {
            const found = Array.from(document.querySelectorAll(selector)).find(isVisibleElement);
            if (found) return found;
        }
        return null;
    }

    function cssEscapeSafe(value) {
        const raw = String(value || '');
        if (!raw) return '';
        if (window.CSS?.escape) return window.CSS.escape(raw);
        return raw.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    function buildElementSelectorCandidates(el) {
        if (!el || !(el instanceof HTMLElement)) return [];
        const candidates = [];
        const push = (value) => {
            const selector = String(value || '').trim();
            if (!selector) return;
            if (!candidates.includes(selector)) candidates.push(selector);
        };

        const tag = (el.tagName || '').toLowerCase();
        const id = el.getAttribute('id');
        const name = el.getAttribute('name');
        const placeholder = el.getAttribute('placeholder');
        const aria = el.getAttribute('aria-label');
        const testId = el.getAttribute('data-test-id');
        const type = el.getAttribute('type');
        const role = el.getAttribute('role');

        if (id) {
            push(`#${cssEscapeSafe(id)}`);
            const draftMatch = id.match(/^(pin-draft-(?:title|link|alttext|description)-)/i);
            if (draftMatch) push(`${tag}[id^="${draftMatch[1]}"]`);
        }
        if (name) push(`${tag}[name="${name.replace(/"/g, '\\"')}"]`);
        if (placeholder) push(`${tag}[placeholder="${placeholder.replace(/"/g, '\\"')}"]`);
        if (aria) push(`${tag}[aria-label="${aria.replace(/"/g, '\\"')}"]`);
        if (testId) push(`${tag}[data-test-id="${testId.replace(/"/g, '\\"')}"]`);
        if (type) push(`${tag}[type="${type.replace(/"/g, '\\"')}"]`);
        if (role) push(`${tag}[role="${role.replace(/"/g, '\\"')}"]`);

        if (el.matches?.('textarea')) push('textarea');
        if (el.matches?.('input')) push('input');
        if (el.isContentEditable) push('[contenteditable="true"]');

        return candidates.slice(0, 8);
    }

    function buildPinterestButtonSnapshot() {
        return Array.from(document.querySelectorAll('button, [role="button"], [role="link"], div'))
            .filter(isVisibleElement)
            .map((el) => ({
                tag: (el.tagName || '').toLowerCase(),
                text: getElementTextFingerprint(el).slice(0, 180),
                width: Math.round(el.getBoundingClientRect().width),
                height: Math.round(el.getBoundingClientRect().height),
                selectors: buildElementSelectorCandidates(el)
            }))
            .filter((item) => item.text)
            .slice(0, 24);
    }

    function buildPinterestAiSnapshot() {
        const fields = collectPinterestFormFields()
            .map(({ el, tag, type, fingerprint, maxLength, multiLine }) => ({
                tag,
                type,
                maxLength,
                multiLine,
                fingerprint: fingerprint.slice(0, 220),
                width: Math.round(el.getBoundingClientRect().width),
                height: Math.round(el.getBoundingClientRect().height),
                selectors: buildElementSelectorCandidates(el)
            }))
            .slice(0, 24);

        return {
            url: window.location.href,
            title: document.title,
            fields,
            buttons: buildPinterestButtonSnapshot()
        };
    }

    function normalizeSelectorMemory(memory) {
        const source = memory && typeof memory === 'object' ? memory : {};
        const normalizeList = (value) => Array.isArray(value)
            ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
            : [];

        return {
            title: normalizeList(source.title),
            description: normalizeList(source.description),
            link: normalizeList(source.link),
            publish: normalizeList(source.publish),
            updatedAt: source.updatedAt || null,
            source: source.source || null
        };
    }

    async function getPinterestSelectorMemory() {
        const result = await storageGet([PINTEREST_SELECTOR_MEMORY_KEY]);
        return normalizeSelectorMemory(result[PINTEREST_SELECTOR_MEMORY_KEY]);
    }

    async function savePinterestSelectorMemory(nextMemory) {
        const normalized = normalizeSelectorMemory({
            ...nextMemory,
            updatedAt: new Date().toISOString()
        });
        await storageSet({ [PINTEREST_SELECTOR_MEMORY_KEY]: normalized });
        return normalized;
    }

    async function rememberPinterestElement(purpose, el, source = 'runtime') {
        if (!purpose || !el) return null;
        const selectors = buildElementSelectorCandidates(el);
        if (!selectors.length) return null;
        const current = await getPinterestSelectorMemory();
        const merged = Array.from(new Set([...(current[purpose] || []), ...selectors])).slice(0, 8);
        current[purpose] = merged;
        current.source = source;
        return savePinterestSelectorMemory(current);
    }

    async function fillPinterestFieldFromSelectors(selectors, value, purpose = 'generic') {
        const expected = String(value || '').trim();
        if (!expected || !Array.isArray(selectors) || !selectors.length) return null;

        for (const selector of selectors) {
            try {
                const target = await waitForCondition(() => {
                    const el = document.querySelector(selector);
                    return isEditableField(el, purpose) ? el : null;
                }, 1200, 150);
                if (!target) continue;
                clickElement(target);
                await sleep(120);
                const isTextarea = target.matches?.('textarea');
                const ok = isTextarea ? setTextareaValueHard(target, expected) : setRichEditableValue(target, expected);
                await sleep(220);
                const actual = getEditableValue(target);
                if (ok && actual && actual.toLowerCase().includes(expected.slice(0, Math.min(16, expected.length)).toLowerCase())) {
                    return target;
                }

                const mainWorldOk = await setFieldValueInMainWorld(selector, expected);
                await sleep(180);
                const actualAfterMainWorld = getEditableValue(target);
                if (mainWorldOk && actualAfterMainWorld && actualAfterMainWorld.toLowerCase().includes(expected.slice(0, Math.min(16, expected.length)).toLowerCase())) {
                    return target;
                }

                const typedOk = await typeFieldValueInMainWorld(selector, expected);
                await sleep(220);
                const actualAfterTyping = getEditableValue(target);
                if (typedOk && actualAfterTyping && actualAfterTyping.toLowerCase().includes(expected.slice(0, Math.min(16, expected.length)).toLowerCase())) {
                    return target;
                }
            } catch (error) {
                console.warn(`NHP selector memory fill failed for ${purpose}:`, selector, error);
            }
        }

        return null;
    }

    async function findPinterestPublishButtonFromSelectors(selectors) {
        if (!Array.isArray(selectors) || !selectors.length) return null;
        for (const selector of selectors) {
            try {
                const found = queryFirstVisible([selector]);
                if (found) return found;
            } catch (error) {
                console.warn('NHP publish selector failed:', selector, error);
            }
        }
        return null;
    }

    async function requestPinterestAiHealing(missingPurposes, snapshot) {
        const prompt = [
            'You are a CSS selector healing assistant for a Pinterest pin builder automation.',
            'Return JSON only with this exact shape:',
            '{"title":["selector"],"description":["selector"],"link":["selector"],"publish":["selector"],"notes":"short note"}',
            'Rules:',
            '- Choose selectors only from the provided candidate selectors when possible.',
            '- Prefer stable selectors using id prefixes, placeholders, aria-label, or data-test-id.',
            '- If a field looks like alt text and no normal description exists, description may point to that field.',
            '- Keep each array short. No explanations outside JSON.',
            `Missing purposes: ${missingPurposes.join(', ') || 'none'}`,
            `Snapshot JSON: ${JSON.stringify(snapshot)}`
        ].join('\n');

        const response = await sendRuntimeMessage({
            action: 'call_gemini',
            prompt
        });

        if (!response?.success) {
            throw new Error(response?.error || 'AI healing failed');
        }

        const raw = response.data?.result || response.data?.text || response.data || '';
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return normalizeSelectorMemory(parsed);
    }

    function findPinterestTitleField(excluded = new Set()) {
        const fields = collectPinterestFormFields().filter(({ el }) => !excluded.has(el));
        return (
            queryFirstVisible([
                'input[id="storyboard-selector-title"]',
                'textarea[placeholder*="Add a title"]',
                'input[placeholder*="Add a title"]',
                'textarea[placeholder*="Add your title"]',
                'input[placeholder*="Add your title"]',
                'textarea[id^="pin-draft-title-"]',
                'input[id^="pin-draft-title-"]',
                '[data-test-id="storyboard-selector-title"] input',
                '[data-test-id="storyboard-selector-title"] textarea',
                'div[contenteditable="true"][aria-label*="title"]',
                'div[role="textbox"][aria-label*="title"]',
                'input[aria-label*="title"]',
                'textarea[aria-label*="title"]',
                'div[data-test-id*="title"] input',
                'div[data-test-id*="title"] textarea'
            ])
            || fields.find(({ tag, type, fingerprint }) =>
                tag === 'textarea'
                && type !== 'url'
                && ['title', 'titre', 'pin title', 'add a title', 'add your title'].some((hint) => fingerprint.includes(hint))
            )?.el
            || fields.find(({ multiLine, fingerprint }) =>
                multiLine
                && ['title', 'titre', 'pin title', 'add a title', 'add your title'].some((hint) => fingerprint.includes(hint))
            )?.el
            ||
            fields.find(({ tag, type, fingerprint }) =>
                tag === 'input'
                && type !== 'url'
                && ['title', 'titre', 'pin title'].some((hint) => fingerprint.includes(hint))
            )?.el
            || fields.find(({ tag, type, maxLength }) =>
                tag === 'input'
                && type !== 'url'
                && maxLength > 0
                && maxLength <= 120
            )?.el
            || fields.find(({ tag, type }) => tag === 'input' && type !== 'url')?.el
            || null
        );
    }

    function findPinterestDescriptionField(excluded = new Set()) {
        const fields = collectPinterestFormFields().filter(({ el }) => !excluded.has(el));
        return (
            queryFirstVisible([
                '.public-DraftEditor-content[contenteditable="true"]',
                '[aria-label="Add a detailed description"][contenteditable="true"]',
                '#dweb-comment-editor-container [contenteditable="true"]',
                'textarea[id^="pin-draft-alttext-"]',
                'textarea[aria-label*="Pin is about"]',
                'div[aria-label*="Pin is about"][contenteditable="true"]',
                'div[role="combobox"][aria-label*="Pin is about"]',
                'div[data-test-id="storyboard-selector-description"] [contenteditable="true"]',
                'div[data-test-id="editor-with-mentions"] [contenteditable="true"]',
                'textarea[placeholder*="Tell everyone what your Pin is about"]',
                'textarea[placeholder*="Add a detailed description"]',
                'textarea[placeholder*="Explain what people can see in the Pin"]',
                'textarea[id^="pin-draft-description-"]',
                'div[contenteditable="true"][aria-label*="description"]',
                'div[role="textbox"][aria-label*="description"]',
                'textarea[aria-label*="description"]',
                'input[aria-label*="description"]',
                'div[data-test-id*="description"] [contenteditable="true"]'
            ])
            || fields.find(({ multiLine, fingerprint }) =>
                multiLine
                && !isFieldFingerprintExcludedForPurpose(fingerprint, 'description')
                && ['tell everyone what your pin is about', 'description', 'describe', 'descrivez', 'about', 'details', 'detailed description', 'explain what people can see in the pin', 'alttext', 'alt text'].some((hint) => fingerprint.includes(hint))
            )?.el
            ||
            fields.find(({ multiLine, fingerprint }) =>
                multiLine
                && !isFieldFingerprintExcludedForPurpose(fingerprint, 'description')
                && ['description', 'describe', 'descrivez', 'about', 'details', 'alttext', 'alt text'].some((hint) => fingerprint.includes(hint))
            )?.el
            || null
        );
    }

    function findPinterestLinkField(excluded = new Set()) {
        const fields = collectPinterestFormFields().filter(({ el }) => !excluded.has(el));
        return (
            queryFirstVisible([
                'input[id="WebsiteField"]',
                'input[id="storyboard-selector-link"]',
                '[data-test-id="storyboard-selector-link"] input',
                '[data-test-id="storyboard-selector-link"] textarea',
                'input[placeholder="Add a link"]',
                'input[placeholder*="Add a link"]',
                'input[placeholder*="Add a destination link"]',
                'input[placeholder*="Website"]',
                'textarea[placeholder*="Add a destination link"]',
                'textarea[aria-label*="destination link"]',
                'input[aria-label*="destination link"]',
                'div[aria-label*="destination link"][contenteditable="true"]',
                'input[id^="pin-draft-link-"]',
                'textarea[id^="pin-draft-link-"]',
                'input[type="url"]',
                'input[aria-label*="link"]',
                'textarea[aria-label*="link"]',
                'input[aria-label*="destination"]',
                'div[data-test-id*="link"] input'
            ])
            || fields.find(({ multiLine, fingerprint }) =>
                !multiLine
                && !isFieldFingerprintExcludedForPurpose(fingerprint, 'link')
                && ['destination link', 'add a destination link', 'website', 'site web', 'lien', 'link', 'url'].some((hint) => fingerprint.includes(hint))
            )?.el
            ||
            fields.find(({ type, fingerprint }) =>
                !isFieldFingerprintExcludedForPurpose(fingerprint, 'link')
                && (type === 'url' || ['link', 'lien', 'destination', 'website', 'site web', 'url'].some((hint) => fingerprint.includes(hint)))
            )?.el
            || null
        );
    }

    function findButtonByHints(hints) {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], [role="link"], div'))
            .filter(isVisibleElement);
        return candidates.find((el) => hints.some((hint) => getElementTextFingerprint(el).includes(hint))) || null;
    }

    async function forceFillPinterestDraftExact(payload) {
        const fillOne = async (selector, value) => {
            if (!String(value || '').trim()) return false;
            const field = await waitForCondition(() => {
                const el = document.querySelector(selector);
                return isVisibleElement(el) ? el : null;
            }, 12000);
            if (!field) return false;
            let ok = field.matches?.('textarea')
                ? setTextareaValueHard(field, value)
                : setInputValue(field, value);
            if (!ok) {
                ok = await setFieldValueInMainWorld(selector, value);
            }
            if (!ok) {
                ok = await typeFieldValueInMainWorld(selector, value);
            }
            await sleep(300);
            return ok;
        };

        const results = {
            title: await fillOne('textarea[id^="pin-draft-title-"]', payload.title),
            altText: await fillOne('textarea[id^="pin-draft-alttext-"]', payload.description),
            link: await fillOne('textarea[id^="pin-draft-link-"]', payload.link)
        };

        console.log('NHP Pinterest exact fill results:', JSON.stringify(results));
        return results;
    }

    async function forceFillPinterestPostTitleFields(payload) {
        await sleep(900);
        const results = {
            altText: false,
            link: false
        };

        if (String(payload.description || '').trim()) {
            const descriptionField = await waitForCondition(() => {
                const el = queryFirstVisible([
                    'textarea[id^="pin-draft-alttext-"]',
                    'textarea[id^="pin-draft-description-"]',
                    'textarea[placeholder*="Explain what people can see in the Pin"]',
                    'textarea[placeholder*="Tell everyone what your Pin is about"]'
                ]);
                return isVisibleElement(el) ? el : null;
            }, 5000, 200);
            if (descriptionField) {
                results.altText = setTextareaValueHard(descriptionField, payload.description);
                if (!results.altText) {
                    const descriptionSelector = buildElementSelectorCandidates(descriptionField)[0];
                    if (descriptionSelector) {
                        results.altText = await setFieldValueInMainWorld(descriptionSelector, payload.description);
                        if (!results.altText) {
                            results.altText = await typeFieldValueInMainWorld(descriptionSelector, payload.description);
                        }
                    }
                }
            }
        }

        if (String(payload.link || '').trim()) {
            const linkField = await waitForCondition(() => {
                const el = queryFirstVisible([
                    'textarea[id^="pin-draft-link-"]',
                    'input[id^="pin-draft-link-"]',
                    'textarea[placeholder*="Add a destination link"]',
                    'input[placeholder*="Add a destination link"]'
                ]);
                return isVisibleElement(el) ? el : null;
            }, 5000, 200);
            if (linkField) {
                results.link = linkField.matches?.('textarea')
                    ? setTextareaValueHard(linkField, payload.link)
                    : setInputValue(linkField, payload.link);
                if (!results.link) {
                    const linkSelector = buildElementSelectorCandidates(linkField)[0];
                    if (linkSelector) {
                        results.link = await setFieldValueInMainWorld(linkSelector, payload.link);
                        if (!results.link) {
                            results.link = await typeFieldValueInMainWorld(linkSelector, payload.link);
                        }
                    }
                }
            }
        }

        console.log('NHP Pinterest delayed exact fill results:', JSON.stringify(results));
        return results;
    }

    async function uploadPinterestFile(imageDataUrl) {
        const fileInput = await waitForCondition(() => {
            const exactInput = queryFirstVisible([
                'input[data-test-id="storyboard-upload-input"]',
                'input#storyboard-upload-input',
                'input[type="file"][accept*="image"]'
            ]);
            if (exactInput) return exactInput;
            const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(isVisibleElement);
            return inputs[0] || document.querySelector('input[type="file"]');
        }, 15000);

        if (!fileInput) throw new Error('PINTEREST_FILE_INPUT_NOT_FOUND');

        const file = dataUrlToFile(imageDataUrl);
        const dt = new DataTransfer();
        dt.items.add(file);

        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
        if (setter) setter.call(fileInput, dt.files);
        else fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(2000);
        await waitForPinterestDraftFields();
    }

    async function waitForPinterestDraftFields() {
        await waitForCondition(() => (
            queryFirstVisible([
                'input[id="storyboard-selector-title"]:not([disabled])',
                'textarea[id="storyboard-selector-title"]:not([disabled])',
                'input[id="storyboard-selector-title"]',
                'textarea[id="storyboard-selector-title"]'
            ])
            ||
            findTextElementByHints(['add your title', 'pin title', 'title'])
            || findPinterestTitleField()
        ), 20000);

        await sleep(450);
    }

    async function autofillPinterestDraft(payload) {
        const usedFields = new Set();
        const memory = await getPinterestSelectorMemory();
        const memoryTitleField = await fillPinterestFieldFromSelectors(memory.title, payload.title, 'title');
        if (memoryTitleField) usedFields.add(memoryTitleField);
        const memoryDescriptionField = await fillPinterestFieldFromSelectors(memory.description, payload.description, 'description');
        if (memoryDescriptionField) usedFields.add(memoryDescriptionField);
        const memoryLinkField = await fillPinterestFieldFromSelectors(memory.link, payload.link, 'link');
        if (memoryLinkField) usedFields.add(memoryLinkField);
        const exactResults = await forceFillPinterestDraftExact(payload);

        const titleHints = ['add your title', 'pin title', 'titre', 'title'];
        const descriptionHints = ['tell everyone what your pin is about', 'description', 'descrivez', 'about', 'pin is about', 'explain what people can see in the pin', 'alt text', 'alttext'];
        const linkHints = ['add a destination link', 'destination link', 'website', 'site web', 'lien', 'link', 'url'];

        const titleTrigger = (memoryTitleField || exactResults.title) ? null : await activatePinterestFieldByText(titleHints, 'title');
        const titleFallback = titleTrigger || ((memoryTitleField || exactResults.title) ? null : await waitForCondition(() => findPinterestFieldByHints(['add your title', 'pin title', 'title'], usedFields, 'title') || findPinterestTitleField(usedFields), 12000));
        const titleField = memoryTitleField || (exactResults.title ? true : await fillPinterestField([titleTrigger, titleFallback, findPinterestTitleField(usedFields)], payload.title, 'title', titleHints));
        console.log('NHP Pinterest title field:', !!titleField, titleField);
        if (titleField && titleField instanceof HTMLElement) usedFields.add(titleField);

        const delayedExactResults = (titleField && (payload.description || payload.link))
            ? await forceFillPinterestPostTitleFields(payload)
            : { altText: false, link: false };

        const descriptionActivator = (memoryDescriptionField || exactResults.altText || delayedExactResults.altText)
            ? null
            : await openPinterestFieldActivator(
                ['tell everyone what your pin is about', 'pin is about', 'description', 'explain what people can see in the pin'],
                [
                    'div[role="combobox"][aria-label*="Pin is about"]',
                    'div[aria-label*="Pin is about"][contenteditable="true"]',
                    'textarea[id^="pin-draft-alttext-"]',
                    'textarea[id^="pin-draft-description-"]'
                ],
                'description',
                6000
            );
        const descriptionTrigger = descriptionActivator || ((memoryDescriptionField || exactResults.altText || delayedExactResults.altText) ? null : await activatePinterestFieldByText(descriptionHints, 'description'));
        const descriptionFallback = descriptionTrigger || ((memoryDescriptionField || exactResults.altText || delayedExactResults.altText) ? null : await waitForCondition(() => findPinterestFieldByHints(['tell everyone what your pin is about', 'description', 'about'], usedFields, 'description') || findPinterestDescriptionField(usedFields), 12000));
        const descriptionField = memoryDescriptionField || (exactResults.altText || delayedExactResults.altText ? true : await fillPinterestField([descriptionTrigger, descriptionFallback, findPinterestDescriptionField(usedFields)], payload.description, 'description', descriptionHints));
        console.log('NHP Pinterest description field:', !!descriptionField, describePinterestField(descriptionField));
        if (descriptionField && descriptionField instanceof HTMLElement) usedFields.add(descriptionField);

        const linkActivator = (memoryLinkField || exactResults.link || delayedExactResults.link)
            ? null
            : await openPinterestFieldActivator(
                ['add a destination link', 'destination link', 'website', 'link', 'url'],
                [
                    'input[id="WebsiteField"]',
                    '[data-test-id="storyboard-selector-link"] input',
                    'textarea[id^="pin-draft-link-"]',
                    'input[id^="pin-draft-link-"]',
                    'input[placeholder="Add a link"]',
                    'textarea[placeholder*="Add a destination link"]',
                    'input[placeholder*="Add a destination link"]'
                ],
                'link',
                6000
            );
        const linkTrigger = linkActivator || ((memoryLinkField || exactResults.link || delayedExactResults.link) ? null : await activatePinterestFieldByText(linkHints, 'link'));
        const linkFallback = linkTrigger || ((memoryLinkField || exactResults.link || delayedExactResults.link) ? null : await waitForCondition(() => findPinterestFieldByHints(['add a destination link', 'destination link', 'website', 'link', 'url'], usedFields, 'link') || findPinterestLinkField(usedFields), 12000));
        const linkField = memoryLinkField || (exactResults.link || delayedExactResults.link ? true : await fillPinterestField([linkTrigger, linkFallback, findPinterestLinkField(usedFields)], payload.link, 'link', linkHints));
        console.log('NHP Pinterest link field:', !!linkField, describePinterestField(linkField));
        if (linkField && linkField instanceof HTMLElement) usedFields.add(linkField);

        const missingPurposes = [];

        let resolvedTitleField = titleField;
        if (!resolvedTitleField && payload.title) {
            resolvedTitleField = await attemptRankedPinterestFill(payload.title, 'title', titleHints, usedFields);
            console.log('NHP Pinterest title fallback field:', !!resolvedTitleField, resolvedTitleField);
            if (resolvedTitleField) usedFields.add(resolvedTitleField);
            else missingPurposes.push('title');
        }

        let resolvedDescriptionField = descriptionField;
        if (!resolvedDescriptionField && payload.description) {
            resolvedDescriptionField = await attemptRankedPinterestFill(payload.description, 'description', descriptionHints, usedFields);
            console.log('NHP Pinterest description fallback field:', !!resolvedDescriptionField, resolvedDescriptionField);
            if (resolvedDescriptionField) usedFields.add(resolvedDescriptionField);
            else missingPurposes.push('description');
        }

        let resolvedLinkField = linkField;
        if (!resolvedLinkField && payload.link) {
            resolvedLinkField = await attemptRankedPinterestFill(payload.link, 'link', linkHints, usedFields);
            console.log('NHP Pinterest link fallback field:', !!resolvedLinkField, resolvedLinkField);
            if (resolvedLinkField) usedFields.add(resolvedLinkField);
            else missingPurposes.push('link');
        }

        const snapshot = buildPinterestFieldSnapshot();
        window.__NHP_PINTEREST_DEBUG = {
            missingPurposes,
            snapshot,
            memory,
            at: new Date().toISOString()
        };
        console.log('NHP Pinterest field snapshot:', window.__NHP_PINTEREST_DEBUG);
        if (missingPurposes.length) {
            showPinterestDebugPanel(snapshot, missingPurposes);
            try {
                const healed = await requestPinterestAiHealing(missingPurposes, buildPinterestAiSnapshot());
                await storageSet({
                    [PINTEREST_AI_DIAG_KEY]: {
                        at: new Date().toISOString(),
                        missingPurposes,
                        healed
                    }
                });

                if (!resolvedTitleField && payload.title) {
                    resolvedTitleField = await fillPinterestFieldFromSelectors(healed.title, payload.title, 'title');
                    if (resolvedTitleField) {
                        usedFields.add(resolvedTitleField);
                        await rememberPinterestElement('title', resolvedTitleField, 'ai-healed');
                    }
                }

                if (!resolvedDescriptionField && payload.description) {
                    resolvedDescriptionField = await fillPinterestFieldFromSelectors(healed.description, payload.description, 'description');
                    if (resolvedDescriptionField) {
                        usedFields.add(resolvedDescriptionField);
                        await rememberPinterestElement('description', resolvedDescriptionField, 'ai-healed');
                    }
                }

                if (!resolvedLinkField && payload.link) {
                    resolvedLinkField = await fillPinterestFieldFromSelectors(healed.link, payload.link, 'link');
                    if (resolvedLinkField) {
                        usedFields.add(resolvedLinkField);
                        await rememberPinterestElement('link', resolvedLinkField, 'ai-healed');
                    }
                }
            } catch (error) {
                console.warn(`${PINTEREST_AI_MODEL_LABEL} failed:`, error);
            }
        }

        if (resolvedTitleField && resolvedTitleField instanceof HTMLElement) await rememberPinterestElement('title', resolvedTitleField, 'verified');
        if (resolvedDescriptionField && resolvedDescriptionField instanceof HTMLElement) await rememberPinterestElement('description', resolvedDescriptionField, 'verified');
        if (resolvedLinkField && resolvedLinkField instanceof HTMLElement) await rememberPinterestElement('link', resolvedLinkField, 'verified');
        await sleep(1500);
    }

    async function clickPinterestPublish() {
        const publishBtn = await waitForCondition(() => findButtonByHints(['publish', 'publier', 'create', 'créer', 'save pin']), 12000);
        if (!publishBtn) return;
        publishBtn.click();
    }

    async function clickPinterestPublishSmart() {
        const memory = await getPinterestSelectorMemory();
        let publishBtn = await findPinterestPublishButtonFromSelectors(memory.publish);
        if (!publishBtn) {
            publishBtn = findButtonByHints(['publish', 'publier', 'create', 'crÃ©er', 'save pin']);
            if (publishBtn) await rememberPinterestElement('publish', publishBtn, 'verified');
        }
        if (!publishBtn) {
            try {
                const healed = await requestPinterestAiHealing(['publish'], buildPinterestAiSnapshot());
                publishBtn = await findPinterestPublishButtonFromSelectors(healed.publish);
                if (publishBtn) await rememberPinterestElement('publish', publishBtn, 'ai-healed');
            } catch (error) {
                console.warn(`${PINTEREST_AI_MODEL_LABEL} publish healing failed:`, error);
            }
        }
        if (!publishBtn) {
            await clickPinterestPublish();
            publishBtn = findButtonByHints(['publish', 'publier', 'create', 'crÃ©er', 'save pin']);
        }
        if (!publishBtn) throw new Error('PINTEREST_PUBLISH_BUTTON_NOT_FOUND');
        publishBtn.click();
        await rememberPinterestElement('publish', publishBtn, 'verified');
    }

    async function processPendingPinterestPublish() {
        if (!window.location.hostname.includes('pinterest.com')) return;
        if (!['/pin-creation-tool', '/pin-builder', '/pin-creation'].some(hint => window.location.href.includes(hint))) return;
        if (pinterestPublishRunning) return;

        chrome.storage.local.get(['pt_pending_publish'], async (res) => {
            const payload = res.pt_pending_publish;
            if (!payload || !payload.imageDataUrl) return;

            pinterestPublishRunning = true;

            try {
                await uploadPinterestFile(payload.imageDataUrl);
                await autofillPinterestDraft(payload);
                await sleep(2500);
                await clickPinterestPublishSmart();
                chrome.storage.local.remove('pt_pending_publish');
                console.log('NHP Pinterest session publish flow executed.');
            } catch (error) {
                console.warn('NHP Pinterest publish automation failed:', error);
            } finally {
                pinterestPublishRunning = false;
            }
        });
    }

    function processPendingPinterestAlbumOrganizer() {
        // Guard against missing legacy Pinterest album organizer flow.
        // The current Pinterest publish path should continue even if that legacy
        // feature is not available in this build.
        return;
    }

    function collectImageCandidates(imgElement) {
        const candidates = [];
        const seen = new Set();

        const push = (value) => {
            if (typeof value !== 'string') return;
            const trimmed = normalizePinterestUrl(value.trim());
            if (!trimmed || seen.has(trimmed)) return;
            seen.add(trimmed);
            candidates.push(trimmed);
        };

        push(imgElement.currentSrc);
        push(imgElement.src);
        push(imgElement.getAttribute('src'));
        push(imgElement.getAttribute('data-src'));
        push(imgElement.getAttribute('data-iurl'));
        push(imgElement.getAttribute('data-pin-media'));
        push(imgElement.dataset?.src);
        push(imgElement.dataset?.iurl);
        push(imgElement.dataset?.pinMedia);
        extractSrcsetUrls(imgElement.getAttribute('srcset')).forEach(push);

        const linkedElements = [
            imgElement.closest('a[href]'),
            imgElement.parentElement?.closest('a[href]')
        ].filter(Boolean);

        linkedElements.forEach((anchor) => {
            const href = anchor.getAttribute('href');
            push(href);
            try {
                const parsed = new URL(href, window.location.href);
                push(parsed.searchParams.get('imgurl'));
            } catch (_) {
                // Ignore invalid URLs.
            }
        });

        return candidates;
    }

    async function readVisibleImageAsDataUrl(imgElement) {
        if (!imgElement) throw new Error('No image element available.');
        if (imgElement.currentSrc?.startsWith('data:image/')) return imgElement.currentSrc;
        if (imgElement.src?.startsWith('data:image/')) return imgElement.src;

        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || imgElement.width || 500;
        canvas.height = imgElement.naturalHeight || imgElement.height || 500;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/png');
    }

    async function resolveImageDataUrl(imgElement) {
        const candidates = collectImageCandidates(imgElement);
        try {
            const response = await withTimeout(sendRuntimeMessage({
                action: 'FETCH_IMAGE_AS_DATA_URL',
                urls: candidates,
                pageUrl: window.location.href
            }), IMAGE_PREP_TIMEOUT_MS, 'Image preparation timed out.');

            if (response.success && response.dataUrl) {
                return response.dataUrl;
            }
        } catch (error) {
            injectorDiag.lastError = { at: new Date().toISOString(), stage: 'prepare_background', error: String(error?.message || error) };
            diagLog('warn', 'background image preparation failed', injectorDiag.lastError);
        }

        return withTimeout(readVisibleImageAsDataUrl(imgElement), IMAGE_CANVAS_TIMEOUT_MS, 'Visible image read timed out.');
    }

    if (!document.getElementById('nhp-gemini-fab-styles')) {
        const fabStyleEl = document.createElement('style');
        fabStyleEl.id = 'nhp-gemini-fab-styles';
        fabStyleEl.textContent = `
.nhp-gemini-fab {
    position: fixed;
    bottom: 16px;
    left: 16px;
    z-index: 2147483600;
    height: 36px;
    width: 36px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    padding: 0;
    margin: 0;
    border-radius: 50px;
    background: rgba(15, 15, 20, 0.75);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.10);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    color: #f8fafc;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    overflow: hidden;
    transition: width .3s ease, padding .3s ease, gap .3s ease, background .2s ease;
    user-select: none;
    outline: none;
}
.nhp-gemini-fab:hover,
.nhp-gemini-fab.is-expanded {
    width: 168px;
    padding: 6px 10px;
    gap: 8px;
}
.nhp-gemini-fab:focus-visible {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(167, 139, 250, 0.6);
}
.nhp-gemini-fab .nhp-fab-icon {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    margin: 3px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    background: linear-gradient(135deg, #6366f1, #06b6d4);
    color: #fff;
}
.nhp-gemini-fab .nhp-fab-label {
    flex: 1 1 auto;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transform: translateX(-4px);
    transition: opacity .25s ease .05s, transform .25s ease .05s;
    pointer-events: none;
    color: #f8fafc;
}
.nhp-gemini-fab:hover .nhp-fab-label,
.nhp-gemini-fab.is-expanded .nhp-fab-label {
    opacity: 1;
    transform: none;
}
.nhp-fab-toggle {
    flex: 0 0 auto;
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.35);
    transition: background .2s ease;
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
}
.nhp-gemini-fab:hover .nhp-fab-toggle,
.nhp-gemini-fab.is-expanded .nhp-fab-toggle {
    opacity: 1;
    pointer-events: auto;
}
.nhp-fab-toggle::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #f8fafc;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    transition: left .2s ease, background .2s ease;
}
.nhp-fab-toggle.is-on {
    background: rgba(167, 139, 250, 0.9);
}
.nhp-fab-toggle.is-on::after {
    left: 14px;
    background: #ecfeff;
}
`;
        (document.head || document.documentElement).appendChild(fabStyleEl);
    }

    let toggleContainer = document.getElementById('nhp-gemini-toggle-container');
    if (!toggleContainer) {
        toggleContainer = document.createElement('div');
        toggleContainer.id = 'nhp-gemini-toggle-container';
        toggleContainer.innerHTML = `
        <button type="button" class="nhp-gemini-fab" id="nhp-gemini-fab" aria-label="\u0625\u0631\u0633\u0627\u0644 Gemini" title="\u0625\u0631\u0633\u0627\u0644 Gemini">
            <span class="nhp-fab-icon" aria-hidden="true">\uD83E\uDD16</span>
            <span class="nhp-fab-label">\u0625\u0631\u0633\u0627\u0644 Gemini</span>
            <span class="nhp-fab-toggle" id="nhp-fab-toggle" role="switch" aria-checked="false"></span>
        </button>
        <input type="checkbox" id="nhp-gemini-toggle" style="position:fixed; width:0; height:0; opacity:0; pointer-events:none; margin:0; padding:0; border:0;">
    `;
        document.body.appendChild(toggleContainer);
    }

    const toggleInput = document.getElementById('nhp-gemini-toggle');
    const fabToggle = document.getElementById('nhp-fab-toggle');
    const fabContainer = document.getElementById('nhp-gemini-fab');

    function getSingletonElementById(id) {
        const matches = Array.from(document.querySelectorAll(`#${cssEscapeSafe(id)}`));
        if (!matches.length) return null;
        if (matches.length > 1) {
            matches.slice(1).forEach((el) => el.remove());
            diagLog('warn', 'duplicate element id removed', { id, removed: matches.length - 1 });
        }
        return matches[0];
    }

    function createOrGetHoverButton({ id, styleCss, labelHtml }) {
        let button = getSingletonElementById(id);
        if (!button) {
            button = document.createElement('button');
            button.id = id;
            button.style.cssText = styleCss;
            button.innerHTML = labelHtml;
            document.body.appendChild(button);
        } else if (!document.body.contains(button)) {
            document.body.appendChild(button);
        }
        return button;
    }

    function setHoverButtonsVisible(visible, reason = 'unspecified') {
        const displayValue = visible ? 'block' : 'none';
        geminiBtn.style.display = displayValue;
        gptBtn.style.display = displayValue;
        promptBagBtn.style.display = displayValue;
        generateBtn.style.display = displayValue;
        bridgeStatusDot.style.display = 'none';
        if (visible) {
            injectorDiag.bothShown += 1;
            diagLog('info', 'both shown', { reason, bothShown: injectorDiag.bothShown });
        } else {
            injectorDiag.bothHidden += 1;
            diagLog('info', 'both hidden', { reason, bothHidden: injectorDiag.bothHidden });
        }
    }

    let geminiBtn = createOrGetHoverButton({
        id: 'nhp-gemini-hover-btn',
        styleCss: 'position:absolute; z-index:9999998; display:none; background:#4f46e5; color:white; border:none; min-width:58px; padding:6px 9px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; box-shadow:0 4px 10px rgba(0,0,0,0.5); font-family:sans-serif; direction:rtl; transition: background 0.2s;',
        labelHtml: GEMINI_BUTTON_LABEL
    });

    let gptBtn = createOrGetHoverButton({
        id: 'nhp-gpt-hover-btn',
        styleCss: 'position:absolute; z-index:9999998; display:none; background:#047857; color:white; border:none; min-width:58px; padding:6px 9px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; box-shadow:0 4px 10px rgba(0,0,0,0.5); font-family:sans-serif; direction:rtl; transition: background 0.2s;',
        labelHtml: GPT_BUTTON_LABEL
    });

    let promptBagBtn = createOrGetHoverButton({
        id: 'nhp-prompt-bag-hover-btn',
        styleCss: 'position:absolute; z-index:9999998; display:none; background:#7c3aed; color:white; border:none; min-width:58px; padding:6px 9px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; box-shadow:0 4px 10px rgba(0,0,0,0.5); font-family:sans-serif; direction:rtl; transition: background 0.2s;',
        labelHtml: PROMPT_BAG_BUTTON_LABEL
    });

    let generateBtn = createOrGetHoverButton({
        id: 'nhp-generate-hover-btn',
        styleCss: 'position:absolute; z-index:9999998; display:none; background:#ea580c; color:white; border:none; min-width:58px; padding:6px 9px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; box-shadow:0 4px 10px rgba(0,0,0,0.5); font-family:sans-serif; direction:rtl; transition: background 0.2s;',
        labelHtml: GENERATE_BUTTON_LABEL
    });
    generateBtn.title = '\u0625\u0631\u0633\u0627\u0644 \u0625\u0644\u0649 \u0627\u0644\u062A\u0648\u0644\u064A\u062F';

    let bridgeStatusDot = getSingletonElementById('nhp-ai-bridge-status-dot');
    if (!bridgeStatusDot) {
        bridgeStatusDot = document.createElement('div');
        bridgeStatusDot.id = 'nhp-ai-bridge-status-dot';
        bridgeStatusDot.style.cssText = 'position:absolute; z-index:9999999; display:none; width:10px; height:10px; border-radius:999px; background:#64748b; border:2px solid #020617; box-shadow:0 0 0 1px rgba(255,255,255,0.65), 0 0 10px rgba(100,116,139,0.75); pointer-events:auto;';
        bridgeStatusDot.title = BRIDGE_CHECKING_TITLE;
        document.body.appendChild(bridgeStatusDot);
    } else if (!document.body.contains(bridgeStatusDot)) {
        document.body.appendChild(bridgeStatusDot);
    }
    let bridgeStatusCache = { checkedAt: 0, online: false };

    function setBridgeStatusVisual(state) {
        const value = state === 'online' ? '#10b981' : state === 'offline' ? '#ef4444' : '#f59e0b';
        bridgeStatusDot.style.background = value;
        bridgeStatusDot.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.65), 0 0 10px ${value}`;
        bridgeStatusDot.title = state === 'online' ? BRIDGE_ONLINE_TITLE : state === 'offline' ? BRIDGE_OFFLINE_TITLE : BRIDGE_CHECKING_TITLE;
    }

    async function updateBridgeStatusIndicator(force = false) {
        const now = Date.now();
        if (!force && (now - bridgeStatusCache.checkedAt) < 6000) {
            setBridgeStatusVisual(bridgeStatusCache.online ? 'online' : 'offline');
            return bridgeStatusCache.online;
        }
        setBridgeStatusVisual('checking');
        const res = await sendRuntimeMessage({ action: 'AI_IMAGE_BRIDGE_STATUS' });
        const online = !!res?.online;
        bridgeStatusCache = { checkedAt: Date.now(), online };
        setBridgeStatusVisual(online ? 'online' : 'offline');
        return online;
    }
    diagLog('info', 'initialized', { host: injectorDiag.host, hasGemini: !!geminiBtn, hasGpt: !!gptBtn, hasPromptBag: !!promptBagBtn, hasGenerate: !!generateBtn });

    chrome.storage.local.get(['nhp_gemini_injector_active'], (data) => {
        isActive = data.nhp_gemini_injector_active !== false;
        updateToggleUI();
    });

    if (window.location.hostname.includes('pinterest.com')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(processPendingPinterestPublish, 1800);
                setTimeout(processPendingPinterestAlbumOrganizer, 2400);
            }, { once: true });
        } else {
            setTimeout(processPendingPinterestPublish, 1800);
            setTimeout(processPendingPinterestAlbumOrganizer, 2400);
        }

        let pinterestObserverTimer = null;
        const pinterestObserver = new MutationObserver(() => {
            if (pinterestObserverTimer) return;
            pinterestObserverTimer = setTimeout(() => {
                pinterestObserverTimer = null;
                chrome.storage.local.get(['pt_pending_publish'], (res) => {
                    if (!res.pt_pending_publish) return;
                    processPendingPinterestPublish();
                    processPendingPinterestAlbumOrganizer();
                });
            }, 900);
        });

        const startObserver = () => {
            if (document.body) {
                pinterestObserver.observe(document.body, { childList: true, subtree: true });
            }
        };

        if (document.body) startObserver();
        else window.addEventListener('DOMContentLoaded', startObserver, { once: true });
    }

    toggleInput.addEventListener('change', (e) => {
        isActive = e.target.checked;
        chrome.storage.local.set({ nhp_gemini_injector_active: isActive });
        updateToggleUI();
    });

    if (fabToggle) {
        fabToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleInput.checked = !toggleInput.checked;
            toggleInput.dispatchEvent(new Event('change'));
        });
    }

    if (fabContainer) {
        fabContainer.addEventListener('click', (e) => {
            if (e.target === fabToggle || (fabToggle && fabToggle.contains(e.target))) return;
            e.preventDefault();
        });
    }

    geminiBtn.addEventListener('mouseover', () => {
        geminiBtn.style.background = '#4338ca';
    });

    geminiBtn.addEventListener('mouseout', () => {
        geminiBtn.style.background = '#4f46e5';
    });

    promptBagBtn.addEventListener('mouseover', () => {
        promptBagBtn.style.background = '#6d28d9';
    });

    promptBagBtn.addEventListener('mouseout', () => {
        promptBagBtn.style.background = '#7c3aed';
    });

    generateBtn.addEventListener('mouseover', () => {
        generateBtn.style.background = '#c2410c';
    });

    generateBtn.addEventListener('mouseout', () => {
        generateBtn.style.background = '#ea580c';
    });

    function updateToggleUI() {
        toggleInput.checked = isActive;
        if (fabToggle) {
            fabToggle.classList.toggle('is-on', isActive);
            fabToggle.setAttribute('aria-checked', isActive ? 'true' : 'false');
        }
        if (!isActive) {
            setHoverButtonsVisible(false, 'toggle-disabled');
        }
    }

    document.addEventListener('mouseover', (e) => {
        if (!isActive) return;
        if (isCaptureSelectionActive()) {
            setHoverButtonsVisible(false, 'capture-selection-active');
            injectorDiag.hiddenCapture += 1;
            return;
        }

        let imgElement = null;
        const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);

        for (const el of elementsUnderCursor) {
            if (el.tagName === 'IMG' && el.width > 120 && el.height > 120) {
                imgElement = el;
                break;
            }
        }

        if (!imgElement) {
            return;
        }

        injectorDiag.hoverCandidates += 1;
        injectorDiag.hoverDetected += 1;
        diagLog('info', 'hover detected', { hoverDetected: injectorDiag.hoverDetected });
        currentImageElement = imgElement;
        const rect = currentImageElement.getBoundingClientRect();
        const topPx = window.scrollY + rect.top + HOVER_BUTTON_LAYOUT.topOffset;
        const rightEdgePx = window.scrollX + rect.right - HOVER_BUTTON_LAYOUT.topOffset;
        const gptWidth = HOVER_BUTTON_LAYOUT.minWidth;
        const geminiWidth = HOVER_BUTTON_LAYOUT.minWidth;
        const bagWidth = HOVER_BUTTON_LAYOUT.minWidth;
        const genWidth = HOVER_BUTTON_LAYOUT.minWidth;
        const gptLeft = Math.max(window.scrollX + HOVER_BUTTON_LAYOUT.edgePadding, rightEdgePx - gptWidth);
        const geminiLeft = Math.max(window.scrollX + HOVER_BUTTON_LAYOUT.edgePadding, gptLeft - HOVER_BUTTON_LAYOUT.gap - geminiWidth);
        const bagLeft = Math.max(window.scrollX + HOVER_BUTTON_LAYOUT.edgePadding, geminiLeft - HOVER_BUTTON_LAYOUT.gap - bagWidth);
        const genLeft = Math.max(window.scrollX + HOVER_BUTTON_LAYOUT.edgePadding, bagLeft - HOVER_BUTTON_LAYOUT.gap - genWidth);
        gptBtn.style.top = `${topPx}px`;
        gptBtn.style.left = `${gptLeft}px`;
        geminiBtn.style.top = `${topPx}px`;
        geminiBtn.style.left = `${geminiLeft}px`;
        promptBagBtn.style.top = `${topPx}px`;
        promptBagBtn.style.left = `${bagLeft}px`;
        generateBtn.style.top = `${topPx}px`;
        generateBtn.style.left = `${genLeft}px`;
        bridgeStatusDot.style.top = `${topPx - 6}px`;
        bridgeStatusDot.style.left = `${genLeft - 6}px`;
        setHoverButtonsVisible(true, 'eligible-image-hover');
        injectorDiag.shown += 1;
        injectorDiag.lastShow = {
            at: new Date().toISOString(),
            imageWidth: Math.round(rect.width),
            imageHeight: Math.round(rect.height),
            gptLeft: Math.round(gptLeft),
            geminiLeft: Math.round(geminiLeft),
            bagLeft: Math.round(bagLeft),
            genLeft: Math.round(genLeft)
        };
    });

    let mouseMoveThrottle = false;
    document.addEventListener('mousemove', (e) => {
        if (isCaptureSelectionActive()) {
            setHoverButtonsVisible(false, 'capture-selection-move');
            return;
        }
        if (mouseMoveThrottle) return;
        mouseMoveThrottle = true;
        setTimeout(() => {
            mouseMoveThrottle = false;
        }, 50);

        if (!isActive || !currentImageElement || geminiBtn.style.display === 'none') return;
        if (e.target === geminiBtn || e.target === gptBtn || e.target === promptBagBtn || e.target === generateBtn) return;

        const rect = currentImageElement.getBoundingClientRect();
        const buffer = 30;
        const isOutside = (
            e.clientX < rect.left - buffer ||
            e.clientX > rect.right + buffer ||
            e.clientY < rect.top - buffer ||
            e.clientY > rect.bottom + buffer
        );

        if (isOutside) {
            setHoverButtonsVisible(false, 'hover-left-image');
            injectorDiag.hiddenOutside += 1;
        }
    });

    function isArtisanStudioTargetUrl(url) {
        return /chatgpt\.com|gemini\.google\.com/i.test(String(url || ''));
    }

    /** Prefer live page context — never reuse stale nhp_current_niche_context (e.g. old "Usmnt Soccer"). */
    function deriveNicheHintFromPage(imgElement) {
        const candidates = [];
        const push = (value) => {
            const text = String(value || '').replace(/\s+/g, ' ').trim();
            if (!text || text.length < 3) return;
            if (/^(image|photo|img|pinterest|google|search|untitled|loading)$/i.test(text)) return;
            if (!candidates.some((c) => c.toLowerCase() === text.toLowerCase())) {
                candidates.push(text);
            }
        };

        push(imgElement?.alt);
        push(imgElement?.title);
        const fig = imgElement?.closest?.('figure');
        if (fig) {
            push(fig.querySelector('figcaption')?.textContent);
        }

        try {
            const url = new URL(window.location.href);
            push(url.searchParams.get('q'));
            push(url.searchParams.get('query'));
            push(url.searchParams.get('search_query'));
            push(url.searchParams.get('kw'));
        } catch (_) {
        }

        push(document.querySelector('meta[property="og:title"]')?.getAttribute?.('content'));
        push(document.querySelector('meta[name="twitter:title"]')?.getAttribute?.('content'));

        const titleHead = String(document.title || '')
            .replace(/\s*[-|–•]\s*.*$/u, '')
            .replace(/\s*\|\s*Pinterest.*$/i, '')
            .trim();
        push(titleHead);

        return candidates[0] || '';
    }

    const buildInjectorPrompt = (nicheName) => `Act as an expert Print-on-Demand (POD) market analyst and top-tier designer.
I am providing you with an ATTACHED reference design for the niche: "${nicheName}".

Task:
1. First, analyze the attached image and the niche to generate smart market insights (AI Insights) and identify design gaps.
2. Redraw the attached reference design. Improve its style and concept by applying your generated insights to make it highly sellable.
3. Present the results in four high-quality POD designs on a solid black background, then generate them.

Additional instructions:
- DO NOT start generating before analyzing the attached image.
${INJECTOR_PROMPT_ARABIC_GUIDANCE_ONE}
${INJECTOR_PROMPT_ARABIC_GUIDANCE_TWO}`;

    function getPromptBagImageName(imgElement) {
        const candidateUrl = collectImageCandidates(imgElement)[0] || imgElement?.src || '';
        try {
            const url = new URL(candidateUrl, window.location.href);
            const raw = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
            if (/\.(png|jpe?g|webp|gif|avif)$/i.test(raw)) return raw;
        } catch (_) {
        }
        const alt = String(imgElement?.alt || '').trim().replace(/\s+/g, '-').slice(0, 60);
        return `${alt || 'prompt-bag-image'}-${Date.now()}.png`;
    }

    async function saveHoverImageToPromptBag() {
        if (!currentImageElement) return;
        promptBagBtn.innerHTML = PROMPT_BAG_SAVING_LABEL;
        promptBagBtn.style.background = '#d97706';

        try {
            const dataUrl = await resolveImageDataUrl(currentImageElement);
            if (!dataUrl || dataUrl === 'data:,') throw new Error('Unable to read image data.');
            const sourceUrl = collectImageCandidates(currentImageElement)[0] || currentImageElement.currentSrc || currentImageElement.src || window.location.href;
            const item = {
                id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: getPromptBagImageName(currentImageElement),
                sourceUrl,
                dataUrl,
                originalBytes: Math.round((String(dataUrl).length * 3) / 4),
                storedBytes: Math.round((String(dataUrl).length * 3) / 4),
                createdAt: Date.now()
            };
            const saved = await sendRuntimeMessage({ action: 'PROMPT_BAG_ADD_IMAGE', image: item });
            if (!saved?.success) throw new Error(saved?.error || 'Unable to save image.');
            promptBagBtn.innerHTML = PROMPT_BAG_SUCCESS_LABEL;
            promptBagBtn.style.background = '#10b981';
            setTimeout(() => {
                promptBagBtn.innerHTML = PROMPT_BAG_BUTTON_LABEL;
                promptBagBtn.style.background = '#7c3aed';
                setHoverButtonsVisible(false, 'prompt-bag-save-success');
            }, 1800);
        } catch (error) {
            console.warn('NHP Prompt Bag save failed:', error);
            promptBagBtn.innerHTML = PROMPT_BAG_ERROR_LABEL;
            promptBagBtn.style.background = '#ef4444';
            setTimeout(() => {
                promptBagBtn.innerHTML = PROMPT_BAG_BUTTON_LABEL;
                promptBagBtn.style.background = '#7c3aed';
            }, 2200);
        }
    }

    async function sendHoverImageToProvider(provider) {
        const btn = provider === 'gemini' ? geminiBtn : gptBtn;
        injectorDiag.clicks[provider] = (injectorDiag.clicks[provider] || 0) + 1;
        const config = provider === 'gemini'
            ? {
                preparingLabel: GEMINI_PREPARING_LABEL,
                fetchErrorLabel: GEMINI_FETCH_ERROR_LABEL,
                successLabel: GEMINI_SUCCESS_LABEL,
                errorLabel: GEMINI_ERROR_LABEL,
                openErrorLabel: GEMINI_OPEN_ERROR_LABEL,
                idleLabel: GEMINI_BUTTON_LABEL,
                idleColor: '#4f46e5',
                preparingColor: '#d97706',
                successColor: '#10b981',
                errorColor: '#ef4444',
                targetUrl: GEMINI_POPUP_URL
            }
            : {
                preparingLabel: GPT_PREPARING_LABEL,
                fetchErrorLabel: GPT_FETCH_ERROR_LABEL,
                successLabel: GPT_SUCCESS_LABEL,
                errorLabel: GPT_ERROR_LABEL,
                openErrorLabel: GPT_OPEN_ERROR_LABEL,
                idleLabel: GPT_BUTTON_LABEL,
                idleColor: '#047857',
                preparingColor: '#d97706',
                successColor: '#10b981',
                errorColor: '#ef4444',
                targetUrl: GPT_POPUP_URL
            };

        if (!currentImageElement) return;
        btn.innerHTML = config.preparingLabel;
        btn.style.background = config.preparingColor;

        try {
            const base64Data = await resolveImageDataUrl(currentImageElement);
            if (!base64Data || base64Data === 'data:,') {
                btn.innerHTML = config.fetchErrorLabel;
                btn.style.background = config.errorColor;
                setTimeout(() => {
                    btn.innerHTML = config.idleLabel;
                    btn.style.background = config.idleColor;
                }, 3000);
                return;
            }

            const pageNiche = deriveNicheHintFromPage(currentImageElement);
            const nicheName = pageNiche || 'attached reference design';
            const isArtisanTarget = isArtisanStudioTargetUrl(config.targetUrl);

            const sendPayload = {
                action: 'SEND_AI_IMAGE_TO_TARGET',
                dataUrl: base64Data,
                imageUrl: collectImageCandidates(currentImageElement)[0] || '',
                pageUrl: window.location.href,
                nicheName,
                targetUrl: config.targetUrl,
                requireLocalBridge: false,
                useLocalBridge: false,
                ignoreStoredNicheContext: true
            };

            // Gemini/ChatGPT Artisan: prompt without hard-coded niche line (image defines the niche).
            if (!isArtisanTarget) {
                sendPayload.promptText = buildInjectorPrompt(nicheName);
            }

            const popupResult = await withTimeout(
                sendRuntimeMessage(sendPayload),
                IMAGE_SEND_TIMEOUT_MS,
                'AI image send timed out.'
            );

            if (!popupResult.success) {
                injectorDiag.lastError = { at: new Date().toISOString(), provider, stage: 'open_target', error: popupResult.error || 'open failed' };
                diagLog('warn', 'send failed at target open', injectorDiag.lastError);
                btn.innerHTML = config.openErrorLabel;
                btn.style.background = config.errorColor;
                setTimeout(() => {
                    btn.innerHTML = config.idleLabel;
                    btn.style.background = config.idleColor;
                }, 3000);
                return;
            }

            btn.innerHTML = config.successLabel;
            btn.style.background = config.successColor;
            setTimeout(() => {
                btn.innerHTML = config.idleLabel;
                btn.style.background = config.idleColor;
                setHoverButtonsVisible(false, 'post-send-success');
            }, 2000);
        } catch (error) {
            console.error("NHP Injector Error:", error);
            injectorDiag.lastError = { at: new Date().toISOString(), provider, stage: 'runtime', error: String(error?.message || error) };
            diagLog('warn', 'send failed at runtime', injectorDiag.lastError);
            btn.innerHTML = config.errorLabel;
            btn.style.background = config.errorColor;
            setTimeout(() => {
                btn.innerHTML = config.idleLabel;
                btn.style.background = config.idleColor;
            }, 2000);
        }
    }

    geminiBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await sendHoverImageToProvider('gemini');
    });

    gptBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await sendHoverImageToProvider('gpt');
    });

    promptBagBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await saveHoverImageToPromptBag();
    });

    async function sendHoverImageToGenerate() {
        if (!currentImageElement) return;
        injectorDiag.clicks.generate = (injectorDiag.clicks.generate || 0) + 1;
        const idleColor = '#ea580c';
        const preparingColor = '#d97706';
        const successColor = '#10b981';
        const errorColor = '#ef4444';

        generateBtn.innerHTML = GENERATE_PREPARING_LABEL;
        generateBtn.style.background = preparingColor;

        try {
            const dataUrl = await resolveImageDataUrl(currentImageElement);
            if (!dataUrl || dataUrl === 'data:,') {
                generateBtn.innerHTML = GENERATE_FETCH_ERROR_LABEL;
                generateBtn.style.background = errorColor;
                setTimeout(() => {
                    generateBtn.innerHTML = GENERATE_BUTTON_LABEL;
                    generateBtn.style.background = idleColor;
                }, 3000);
                return;
            }

            const pageNiche = deriveNicheHintFromPage(currentImageElement);
            const nicheName = pageNiche || 'attached reference design';
            const prompt = buildInjectorPrompt(nicheName);
            const imageUrl = collectImageCandidates(currentImageElement)[0] || currentImageElement.currentSrc || currentImageElement.src || '';

            const result = await withTimeout(
                sendRuntimeMessage({
                    action: 'generate_from_image',
                    dataUrl,
                    imageUrl,
                    prompt,
                    name: getPromptBagImageName(currentImageElement),
                    pageUrl: window.location.href,
                    source: 'floating'
                }),
                IMAGE_SEND_TIMEOUT_MS,
                'Generate send timed out.'
            );

            if (!result?.success) {
                generateBtn.innerHTML = GENERATE_ERROR_LABEL;
                generateBtn.style.background = errorColor;
                setTimeout(() => {
                    generateBtn.innerHTML = GENERATE_BUTTON_LABEL;
                    generateBtn.style.background = idleColor;
                }, 3000);
                return;
            }

            generateBtn.innerHTML = GENERATE_SUCCESS_LABEL;
            generateBtn.style.background = successColor;
            setTimeout(() => {
                generateBtn.innerHTML = GENERATE_BUTTON_LABEL;
                generateBtn.style.background = idleColor;
                setHoverButtonsVisible(false, 'post-generate-success');
            }, 2000);
        } catch (error) {
            console.warn('NHP Generate hover send failed:', error);
            generateBtn.innerHTML = GENERATE_ERROR_LABEL;
            generateBtn.style.background = errorColor;
            setTimeout(() => {
                generateBtn.innerHTML = GENERATE_BUTTON_LABEL;
                generateBtn.style.background = idleColor;
            }, 2200);
        }
    }

    generateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await sendHoverImageToGenerate();
    });
})();
