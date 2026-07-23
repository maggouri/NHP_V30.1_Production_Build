/**
 * TeePublic signup auto-fill — CREATTY content.js pattern + EmailCore payload keys.
 * @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
 * Reference: Desktop/CREATTY/content.js (label lookup, setNativeValue, document_idle timing)
 */
(function initTeePublicSignupInject() {
    if (window.__emailcoreTeePublicFillDone) return;
    if (window.__emailcoreTeePublicSignupReady) {
        if (typeof window.__emailcoreTeePublicRetryFill === 'function') {
            window.__emailcoreTeePublicRetryFill();
        }
        return;
    }
    window.__emailcoreTeePublicSignupReady = true;

    const STORAGE_KEY = 'emailcore_pending_signup';
    /** Mirrors CREATTY creattyPendingFill — set before tab opens, cleared after fill */
    const PENDING_FILL_KEY = 'emailcorePendingFill';
    const LOG_PREFIX = '[EmailCore TeePublic]';

    const FIELD_LABELS = {
        firstName: ['first name', 'first'],
        lastName: ['last name', 'last'],
        email: ['email address', 'email'],
        password: ['password'],
    };

    const utils = window.EmailCoreAccountUtils;
    const TEEPUBLIC_PASSWORD_MIN = 12;

    function sanitizeSignupData(account) {
        if (utils?.sanitizeSignupCredentials) {
            const clean = utils.sanitizeSignupCredentials(account);
            return {
                firstName: clean.firstName,
                lastName: clean.lastName,
                email: clean.email || account.email,
                password: clean.password,
            };
        }
        const names = utils?.resolveAccountNames?.(account) || {
            firstName: account.firstName || account.first_name,
            lastName: account.lastName || account.last_name,
        };
        let password = String(account.password || account.pass || '').trim();
        const suffix = 'Aa1!';
        while (password.length < TEEPUBLIC_PASSWORD_MIN) password += suffix;
        return {
            firstName: names.firstName,
            lastName: names.lastName || names.firstName,
            email: account.email,
            password,
        };
    }

    function pageHasSignupValidationErrors() {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const passwordTooShort = /compte actuellement\s*(?:1[01]|[0-9])\b|too short|trop court|at least 12|au moins 12/i.test(bodyText);
        const pw = document.querySelector('input[type="password"]');
        const pwLen = pw ? String(pw.value || '').length : 0;
        return passwordTooShort || pwLen < TEEPUBLIC_PASSWORD_MIN;
    }

    if (utils?.captureSignupPayloadFromUrl) {
        utils.captureSignupPayloadFromUrl(location);
    } else if (utils?.decodeSignupFromLocation) {
        const early = utils.decodeSignupFromLocation(location);
        if (early?.email) {
            try {
                sessionStorage.setItem('emailcore_signup_payload', JSON.stringify(early));
            } catch (_) { /* ignore */ }
        }
    }

    function log(msg, level) {
        console.log(`${LOG_PREFIX} ${msg}`);
        try {
            chrome.runtime.sendMessage({
                action: 'TEEPUBLIC_PIPELINE_LOG',
                message: msg,
                level: level || 'info',
            });
        } catch (_) { /* ignore */ }
    }

    function delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    /* ——— CREATTY content.js (copied structure) ——— */

    function normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function getInputByLabel(labelWords) {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
            const text = normalizeText(label.textContent);
            if (!labelWords.some((word) => text.includes(word))) continue;
            const nestedInput = label.querySelector('input');
            if (nestedInput) return nestedInput;
            const htmlFor = label.getAttribute('for');
            if (htmlFor) {
                const linkedInput = document.getElementById(htmlFor);
                if (linkedInput) return linkedInput;
            }
        }
        return null;
    }

    function getInputByFallback(name) {
        const selectors = {
            firstName: [
                'input[name="firstname"]',
                'input[name="firstName"]',
                'input[name="first_name"]',
                'input[name="user[first_name]"]',
                'input[name*="firstname" i]',
                'input[name*="first_name" i]',
                'input[id*="first" i]',
                'input[autocomplete="given-name"]',
                'input[placeholder*="first" i]',
            ].join(', '),
            lastName: [
                'input[name="lastname"]',
                'input[name="lastName"]',
                'input[name="last_name"]',
                'input[name="user[last_name]"]',
                'input[name*="lastname" i]',
                'input[name*="last_name" i]',
                'input[id*="last" i]',
                'input[autocomplete="family-name"]',
                'input[placeholder*="last" i]',
            ].join(', '),
            email: 'input[type="email"], input[name*="email" i], input[id*="email" i]',
            password: 'input[type="password"], input[name*="password" i], input[id*="password" i]',
        };
        return document.querySelector(selectors[name]);
    }

    function isVisibleInput(input) {
        if (!input || input.disabled || input.readOnly) return false;
        const type = String(input.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'checkbox', 'radio', 'submit', 'button'].includes(type)) return false;
        const rect = input.getBoundingClientRect();
        const style = window.getComputedStyle(input);
        return rect.width > 20 && rect.height > 10 && style.visibility !== 'hidden' && style.display !== 'none';
    }

    function getInputByVisualOrder(name) {
        const email = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
        const password = document.querySelector('input[type="password"], input[name*="password" i], input[id*="password" i]');
        const form = (email && email.closest('form')) || (password && password.closest('form')) || document;
        const inputs = Array.from(form.querySelectorAll('input')).filter(isVisibleInput);
        if (name === 'email') return email || null;
        if (name === 'password') return password || null;
        const emailIndex = email ? inputs.indexOf(email) : inputs.length;
        const beforeEmail = inputs.slice(0, emailIndex < 0 ? inputs.length : emailIndex).filter((input) => {
            const type = String(input.getAttribute('type') || 'text').toLowerCase();
            return ['text', 'search', ''].includes(type) || !input.getAttribute('type');
        });
        if (name === 'firstName') return beforeEmail[0] || null;
        if (name === 'lastName') return beforeEmail[1] || null;
        return null;
    }

    function setNativeValue(input, value) {
        const prototype = Object.getPrototypeOf(input);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) {
            descriptor.set.call(input, value);
        } else {
            input.value = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findCreateButton() {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        return buttons.find((button) => {
            return normalizeText(button.textContent || button.value).includes('create account');
        });
    }

    function findSignupFields() {
        const fields = {};
        for (const [name, labels] of Object.entries(FIELD_LABELS)) {
            fields[name] = getInputByLabel(labels) || getInputByFallback(name) || getInputByVisualOrder(name);
        }
        return fields;
    }

    function waitForFormFields(timeoutMs) {
        const timeout = timeoutMs || 15000;
        const start = Date.now();
        return new Promise((resolve) => {
            const tick = () => {
                const fields = findSignupFields();
                if (fields.firstName && fields.lastName && fields.email && fields.password) {
                    resolve(fields);
                    return;
                }
                if (Date.now() - start >= timeout) {
                    resolve(fields);
                    return;
                }
                setTimeout(tick, 250);
            };
            tick();
        });
    }

    function fieldDebugName(input) {
        if (!input) return 'missing';
        return [
            input.id ? `#${input.id}` : '',
            input.getAttribute('name') ? `[name="${input.getAttribute('name')}"]` : '',
            input.getAttribute('autocomplete') ? `[autocomplete="${input.getAttribute('autocomplete')}"]` : '',
            input.getAttribute('placeholder') ? `[placeholder="${input.getAttribute('placeholder')}"]` : '',
        ].filter(Boolean).join('') || input.tagName;
    }

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    async function typeLikeUser(input, value) {
        const text = String(value || '').trim();
        if (!input || !text) return false;
        input.scrollIntoView({ block: 'center', inline: 'center' });
        input.focus();
        input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        await delay(randomDelay(80, 180));
        setNativeValue(input, '');
        await delay(randomDelay(50, 120));
        for (const char of text) {
            input.focus();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
            setNativeValue(input, String(input.value || '') + char);
            input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
            await delay(randomDelay(40, 120));
        }
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        input.blur();
        return String(input.value || '').trim() === text;
    }

    /* ——— EmailCore payload (URL / storage / background) ——— */

    function readUrlPayload() {
        if (utils?.readCapturedSignupPayload) {
            const captured = utils.readCapturedSignupPayload();
            if (captured?.email) return captured;
        }
        if (utils?.decodeSignupFromLocation) {
            return utils.decodeSignupFromLocation(location);
        }
        return null;
    }

    function readStorageBundle() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([STORAGE_KEY, PENDING_FILL_KEY, 'autoFillTeePublic'], (items) => {
                    resolve({
                        account: items[STORAGE_KEY] || null,
                        pendingFill: items[PENDING_FILL_KEY] === true,
                        autoFill: items.autoFillTeePublic !== false,
                    });
                });
            } catch (_) {
                resolve({ account: null, pendingFill: false, autoFill: true });
            }
        });
    }

    async function readBackgroundPayload() {
        try {
            const urlPayload = readUrlPayload();
            const resp = await chrome.runtime.sendMessage({
                action: 'GET_TEEPUBLIC_PENDING_SIGNUP',
                email: urlPayload?.email || '',
            });
            if (resp?.account?.email) return resp.account;
        } catch (_) { /* ignore */ }
        return null;
    }

    async function resolveAccountPayload(maxAttempts) {
        const attempts = maxAttempts || 20;
        for (let i = 0; i < attempts; i += 1) {
            const urlHit = readUrlPayload();
            if (urlHit?.email && urlHit?.password) {
                if (i > 0) log('Payload loaded from URL (emailcore_ec)', 'info');
                return urlHit;
            }

            const bundle = await readStorageBundle();
            if (bundle.account?.email && bundle.account?.password) {
                if (i > 0) log('Payload loaded from extension storage', 'info');
                return bundle.account;
            }

            const fromBg = await readBackgroundPayload();
            if (fromBg?.email && fromBg?.password) {
                log('Payload loaded from profile JSON / background', 'info');
                return fromBg;
            }

            if (i < attempts - 1) await delay(400);
        }
        return null;
    }

    function watchFormSubmit(account) {
        let notified = false;
        const notifySubmit = () => {
            if (notified || !account?.email) return;
            if (pageHasSignupValidationErrors()) {
                log('Signup submit ignored — password/name validation visible on page', 'error');
                return;
            }
            notified = true;
            log(`Signup submitted: ${account.email}`, 'success');
            try {
                chrome.runtime.sendMessage({ action: 'SIGNUP_SUBMITTED', account });
            } catch (_) { /* ignore */ }
        };
        document.addEventListener('submit', (ev) => {
            if (ev.target?.querySelector('input[type="password"]')) notifySubmit();
        }, true);
        const createButton = findCreateButton();
        if (createButton) {
            createButton.addEventListener('click', () => setTimeout(notifySubmit, 900));
        }
    }

    function watchCaptcha() {
        setInterval(() => {
            const hasCaptcha = document.querySelector(
                'iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, #captcha'
            );
            if (hasCaptcha) {
                try {
                    chrome.runtime.sendMessage({ action: 'TEEPUBLIC_CAPTCHA_DETECTED' });
                } catch (_) { /* ignore */ }
            }
        }, 3000);
    }

    async function notifyFillComplete(account) {
        window.__emailcoreTeePublicFillDone = true;
        log(`CREATTY-style fill complete for ${account.email}`, 'success');
        log(`Fields filled for ${account.email}`, 'success');
        try {
            chrome.runtime.sendMessage({ action: 'TEEPUBLIC_PHASE', phase: 'FILLING', account });
            chrome.runtime.sendMessage({
                action: 'TEEPUBLIC_SIGNUP_FILLED',
                account,
                autoConfirm: account.autoConfirm !== false,
            });
        } catch (_) { /* ignore */ }
        watchFormSubmit(account);
        watchCaptcha();
        try {
            chrome.storage.local.remove(STORAGE_KEY);
            chrome.storage.local.set({ [PENDING_FILL_KEY]: false });
        } catch (_) { /* ignore */ }
    }

    /** Core fill — mirrors CREATTY fillSignupForm() */
    async function fillSignupForm() {
        const bundle = await readStorageBundle();
        if (!bundle.autoFill) {
            log('Auto-fill TeePublic disabled in settings', 'info');
            return false;
        }

        const urlPayload = readUrlPayload();
        const hasUrlEc = /emailcore_ec=|[?&]ec=|ec_hint=/i.test(location.href || '');
        const pendingFill = bundle.pendingFill || hasUrlEc;

        let account = bundle.account;
        if (!account?.email || !account?.password) {
            account = urlPayload || (await resolveAccountPayload(30));
        }

        if (!account?.email || !account?.password) {
            if (!pendingFill) {
                log('No emailcorePendingFill flag — waiting for CREATY Start to seed storage', 'info');
                return false;
            }
            log('Fill failed: no account payload (check emailcore_ec URL or profile JSON)', 'error');
            return false;
        }

        const data = sanitizeSignupData(account);
        account = { ...account, ...data, pass: data.password };

        try {
            chrome.runtime.sendMessage({
                action: 'CREATY_SIGNUP_TRACE',
                stage: 'inject.fillSignupForm',
                payload: {
                    ...account,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    password: data.password,
                },
            });
        } catch (_) { /* ignore */ }

        try {
            chrome.storage.local.set({
                [STORAGE_KEY]: account,
                [PENDING_FILL_KEY]: true,
            });
            chrome.runtime.sendMessage({ action: 'TEEPUBLIC_PHASE', phase: 'PENDING', account });
        } catch (_) { /* ignore */ }

        log(`Verified names for fill: ${data.firstName} / ${data.lastName}`, 'info');
        log(`Waiting for TeePublic form — ${account.email}`, 'info');
        const fields = await waitForFormFields(18000);

        const missingFields = ['firstName', 'lastName', 'email', 'password'].filter((name) => !fields[name]);
        if (missingFields.length) {
            log(`Fill failed: missing TeePublic fields: ${missingFields.join(', ')}`, 'error');
            return false;
        }

        let filled = 0;
        for (const [name, labels] of Object.entries(FIELD_LABELS)) {
            const input = fields[name] || getInputByLabel(labels) || getInputByFallback(name);
            if (input && data[name]) {
                const ok = await typeLikeUser(input, data[name]);
                if (ok) {
                    filled += 1;
                    log(`Field filled: ${name} via ${fieldDebugName(input)}`, 'info');
                } else {
                    log(`Field failed verification: ${name} via ${fieldDebugName(input)}`, 'error');
                }
            }
        }

        if (filled < 4) {
            log(`Fill failed: only ${filled}/4 fields set (CREATTY-style)`, 'error');
            return false;
        }

        if (pageHasSignupValidationErrors()) {
            log(`Fill verification failed: password must be ${TEEPUBLIC_PASSWORD_MIN}+ chars`, 'error');
            const fieldsRetry = findSignupFields();
            if (fieldsRetry.password && data.password) {
                await typeLikeUser(fieldsRetry.password, data.password);
            }
            if (pageHasSignupValidationErrors()) {
                return false;
            }
        }

        const createButton = findCreateButton();
        if (createButton) {
            createButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            createButton.style.outline = '3px solid #22c55e';
            createButton.style.outlineOffset = '3px';
            createButton.title = 'EmailCore filled the form. Review the data, then click Create Account + CAPTCHA.';
        }

        await notifyFillComplete(account);
        return true;
    }

    let fillRunning = false;

    async function runFill() {
        if (fillRunning || window.__emailcoreTeePublicFillDone) return;
        fillRunning = true;
        try {
            let ok = await fillSignupForm();
            if (!ok && !window.__emailcoreTeePublicFillDone) {
                await delay(800);
                ok = await fillSignupForm();
            }
            if (!ok && !window.__emailcoreTeePublicFillDone) {
                log('Fill retry exhausted — check F12 console on TeePublic tab', 'error');
            }
        } finally {
            fillRunning = false;
        }
    }

    window.__emailcoreTeePublicRetryFill = () => {
        if (window.__emailcoreTeePublicFillDone) return;
        fillRunning = false;
        runFill();
    };

    log('Signup inject loaded (CREATTY-style)', 'info');

    /* CREATTY timing: DOMContentLoaded, or immediate if DOM ready */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => runFill(), { once: true });
    } else {
        runFill();
    }

    /* Isolated profile cold-start: retry fill when background seeds storage / profile JSON */
    let retryTicks = 0;
    const retryTimer = setInterval(() => {
        if (window.__emailcoreTeePublicFillDone || retryTicks >= 40) {
            clearInterval(retryTimer);
            return;
        }
        retryTicks += 1;
        if (typeof window.__emailcoreTeePublicRetryFill === 'function') {
            window.__emailcoreTeePublicRetryFill();
        }
    }, 1500);
})();
