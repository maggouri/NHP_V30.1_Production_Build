/**
 * Shared account / inbox helpers — works in service worker, content scripts, and extension pages.
 * @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
 */
(function initEmailCoreAccountUtils(global) {
    if (global.EmailCoreAccountUtils) return;

    const INBOX_SCOPE = 'inbox';

    function capitalize(word) {
        const s = String(word || '').trim();
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    function splitNameFromEmail(email) {
        let local = String(email || '').split('@')[0] || '';
        local = local.replace(/_(store|shop|studio)$/i, '');
        const cleaned = local.replace(/[._+\-0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
        const parts = cleaned.split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return { firstName: capitalize(parts[0]), lastName: capitalize(parts.slice(1).join(' ')) };
        }
        if (parts.length === 1 && parts[0].length > 4) {
            const mid = Math.ceil(parts[0].length / 2);
            return {
                firstName: capitalize(parts[0].slice(0, mid)),
                lastName: capitalize(parts[0].slice(mid)),
            };
        }
        return { firstName: capitalize(parts[0] || 'User'), lastName: 'Account' };
    }

    const SIGNUP_PAYLOAD_SESSION_KEY = 'emailcore_signup_payload';

    const TEEPUBLIC_PASSWORD_MIN = 12;

    function looksLikeStoreHandle(value) {
        const s = String(value || '').trim();
        if (!s) return false;
        if (/_?(store|shop|studio)$/i.test(s)) return true;
        if (/_[a-z0-9]+$/i.test(s) && !/\s/.test(s)) return true;
        if (/[_]/.test(s) && !/\s/.test(s)) return true;
        return false;
    }

    function nameLooksLikeStoreAlias(name, storeName) {
        const value = String(name || '').trim();
        if (!value) return true;
        if (looksLikeStoreHandle(value)) return true;
        const store = String(storeName || '').trim();
        if (store && value.toLowerCase() === store.toLowerCase()) return true;
        if (/^[^@\s]+_(store|shop|studio)$/i.test(value)) return true;
        return false;
    }

    function ensureCompliantSignupPassword(password, seed) {
        let next = String(password || '').trim();
        if (!next) {
            const base = String(seed || Math.random()).replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'Ec9';
            next = `Ec${base}Aa1!`;
        }
        const suffix = 'Aa1!';
        while (next.length < TEEPUBLIC_PASSWORD_MIN) {
            next += suffix;
        }
        return next;
    }

    function resolveAccountNames(account) {
        const storeName = String(account?.storeName || account?.nickname || '').trim();
        const first = String(account?.firstName || account?.first_name || '').trim();
        const last = String(account?.lastName || account?.last_name || '').trim();
        if (first && last && !nameLooksLikeStoreAlias(first, storeName) && !nameLooksLikeStoreAlias(last, storeName)) {
            return { firstName: first, lastName: last };
        }
        if (first && !nameLooksLikeStoreAlias(first, storeName)) {
            return { firstName: first, lastName: last && !nameLooksLikeStoreAlias(last, storeName) ? last : first };
        }
        const display = String(account?.display_name || account?.displayName || account?.name || '').trim();
        const displayLooksLikePerson = display
            && !looksLikeStoreHandle(display)
            && display.toLowerCase() !== storeName.toLowerCase();
        if (displayLooksLikePerson) {
            const parts = display.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
                return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
            }
            if (parts.length === 1 && !looksLikeStoreHandle(parts[0])) {
                return { firstName: parts[0], lastName: parts[0] };
            }
        }

        return splitNameFromEmail(account?.email || account?.display_email || '');
    }

    function sanitizeSignupCredentials(account = {}) {
        const email = String(account.email || account.display_email || '').trim();
        const names = resolveAccountNames(account);
        const password = ensureCompliantSignupPassword(
            account.password || account.pass || account.secret || '',
            email
        );
        return {
            email,
            firstName: names.firstName,
            lastName: names.lastName,
            password,
        };
    }

    function encodeSignupHash(payload) {
        try {
            const json = JSON.stringify(payload);
            const b64 = btoa(unescape(encodeURIComponent(json)));
            return 'ec=' + encodeURIComponent(b64);
        } catch (_) {
            return '';
        }
    }

    function normalizeEncodedBase64(b64Raw) {
        let b64 = String(b64Raw || '').replace(/-/g, '+').replace(/_/g, '/');
        for (let i = 0; i < 3; i += 1) {
            try {
                const decoded = decodeURIComponent(b64);
                if (decoded === b64) break;
                b64 = decoded;
            } catch (_) {
                break;
            }
        }
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        return b64;
    }

    function parseSignupPayloadFromEncoded(b64Raw) {
        if (!b64Raw) return null;
        try {
            const b64 = normalizeEncodedBase64(b64Raw);
            const json = decodeURIComponent(escape(atob(b64)));
            return JSON.parse(json);
        } catch (_) {
            return null;
        }
    }

    function decodeSignupHash(hash) {
        const raw = String(hash || '').replace(/^#/, '');
        if (raw.startsWith('emailcore=')) {
            return parseSignupPayloadFromEncoded(raw.slice('emailcore='.length));
        }
        if (raw.startsWith('emailcore-signup=')) {
            return parseSignupPayloadFromEncoded(raw.slice('emailcore-signup='.length));
        }
        if (raw.startsWith('ec=')) {
            return parseSignupPayloadFromEncoded(raw.slice(3));
        }
        return null;
    }

    function decodeSignupFromLocation(loc) {
        const locationRef = loc || (typeof location !== 'undefined' ? location : null);
        if (!locationRef) return null;

        const hashPayload = decodeSignupHash(locationRef.hash || '');
        if (hashPayload?.email) return hashPayload;

        try {
            const params = new URLSearchParams(locationRef.search || '');
            const queryKeys = ['emailcore_ec', 'emailcore_oc', 'emailcore', 'ec'];
            for (const key of queryKeys) {
                const val = params.get(key);
                if (!val) continue;
                const parsed = parseSignupPayloadFromEncoded(val);
                if (parsed?.email) return parsed;
            }
        } catch (_) { /* ignore */ }

        return null;
    }

    function signupPayloadToBase64(payload) {
        try {
            const json = JSON.stringify(payload);
            return btoa(unescape(encodeURIComponent(json)));
        } catch (_) {
            return '';
        }
    }

    function appendSignupHashToUrl(url, payload) {
        const b64 = signupPayloadToBase64(payload);
        if (!b64) return url;
        const fragment = 'ec=' + encodeURIComponent(b64);
        const withoutHash = String(url || '').split('#')[0];
        const qIndex = withoutHash.indexOf('?');
        const path = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
        const params = new URLSearchParams(qIndex >= 0 ? withoutHash.slice(qIndex + 1) : '');
        params.set('emailcore_ec', b64);
        if (payload.email) {
            params.set('ec_hint', String(payload.email).trim());
        }
        const query = params.toString();
        return `${path}?${query}#${fragment}`;
    }

    function captureSignupPayloadFromUrl(loc) {
        const locationRef = loc || (typeof location !== 'undefined' ? location : null);
        if (!locationRef) return null;
        const payload = decodeSignupFromLocation(locationRef);
        if (!payload?.email) return null;
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(SIGNUP_PAYLOAD_SESSION_KEY, JSON.stringify(payload));
            }
        } catch (_) { /* ignore */ }
        return payload;
    }

    function readCapturedSignupPayload() {
        try {
            if (typeof sessionStorage === 'undefined') return null;
            const raw = sessionStorage.getItem(SIGNUP_PAYLOAD_SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.email ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    async function deriveInboxToken(sessionId, email, secret) {
        const sid = String(sessionId || '').trim();
        const em = String(email || '').trim().toLowerCase();
        const key = String(secret || 'emailcore-dev-secret-change-in-production');
        const enc = new TextEncoder();
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(key),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${sid}|${em}|${INBOX_SCOPE}`));
        return Array.from(new Uint8Array(sig))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, 48);
    }

    function stripHtml(html) {
        return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function isTeePublicConfirmMessage(msg) {
        const from = String(msg?.from_addr || msg?.from || '').toLowerCase();
        const subject = String(msg?.subject || '').toLowerCase();
        const body = `${msg?.body_text || ''} ${stripHtml(msg?.body_html || '')}`.toLowerCase();
        const hay = `${from} ${subject} ${body}`;
        if (!/teepublic/.test(hay)) return false;
        return /(confirm|verification|verify|activate|activation|email address)/i.test(hay);
    }

    function extractTeePublicConfirmLink(msg) {
        if (!msg) return null;
        const html = String(msg.body_html || msg.body_text || '');
        const text = String(msg.body_text || stripHtml(html));
        const patterns = [
            /href=["'](https?:\/\/[^"']*teepublic\.com[^"']*(?:confirm|verification|verify|activate)[^"']*)["']/gi,
            /href=["'](https?:\/\/[^"']*teepublic\.com[^"']*confirmation[^"']*)["']/gi,
            /(https?:\/\/[^\s<>"']*teepublic\.com[^\s<>"']*(?:confirm|verification|verify|activate)[^\s<>"']*)/gi,
        ];
        for (const re of patterns) {
            re.lastIndex = 0;
            const m = re.exec(html) || re.exec(text);
            if (m && m[1]) {
                return m[1].replace(/&amp;/g, '&').replace(/["']/g, '').trim();
            }
        }
        return null;
    }

    function findConfirmMessage(messages) {
        if (!Array.isArray(messages)) return null;
        for (const msg of messages) {
            if (!isTeePublicConfirmMessage(msg)) continue;
            const link = extractTeePublicConfirmLink(msg);
            if (link) return { message: msg, link };
        }
        for (const msg of messages) {
            const link = extractTeePublicConfirmLink(msg);
            if (link && /teepublic/i.test(link)) return { message: msg, link };
        }
        return null;
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function humanDelay(minMs, maxMs) {
        const min = minMs != null ? minMs : 200;
        const max = maxMs != null ? maxMs : minMs || 400;
        await sleep(min + Math.random() * (max - min));
    }

    const NATIVE_INPUT_VALUE_SETTER = Object.getOwnPropertyDescriptor(
        global.HTMLInputElement?.prototype || {},
        'value'
    )?.set;

    function setNativeInputValue(element, value) {
        const text = String(value ?? '');
        if (NATIVE_INPUT_VALUE_SETTER) {
            NATIVE_INPUT_VALUE_SETTER.call(element, text);
        } else {
            element.value = text;
        }
    }

    function dispatchInputEvents(element, data, options = {}) {
        const char = data != null ? String(data) : '';
        const isPassword = !!options.isPassword;

        try {
            element.dispatchEvent(new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: char,
            }));
        } catch (_) { /* ignore */ }

        try {
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: char,
            }));
        } catch (_) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));

        if (isPassword) {
            element.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: char || 'Unidentified',
            }));
            element.dispatchEvent(new KeyboardEvent('keyup', {
                bubbles: true,
                cancelable: true,
                key: char || 'Unidentified',
            }));
        }
    }

    async function humanTypeElement(element, value, options = {}) {
        if (!element || value == null) return false;
        const text = String(value);
        const minMs = options.minMs != null ? options.minMs : 35;
        const maxMs = options.maxMs != null ? options.maxMs : 95;
        const isPassword = !!options.isPassword;

        element.focus();
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        setNativeInputValue(element, '');
        dispatchInputEvents(element, '', { isPassword });

        for (let i = 0; i < text.length; i += 1) {
            setNativeInputValue(element, text.slice(0, i + 1));
            dispatchInputEvents(element, text[i], { isPassword });
            await humanDelay(minMs, maxMs);
        }

        if (isPassword) {
            element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        }
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    }

    async function fillFieldsSequence(fields, options = {}) {
        const humanLike = options.humanLike !== false;
        for (let i = 0; i < fields.length; i += 1) {
            const { element, value, isPassword } = fields[i];
            if (!element || value == null) continue;
            if (humanLike) {
                await humanTypeElement(element, value, { isPassword: !!isPassword });
            } else {
                element.focus();
                setNativeInputValue(element, value);
                dispatchInputEvents(element, value, { isPassword: !!isPassword });
            }
            if (i < fields.length - 1) await humanDelay(300, 800);
        }
        return true;
    }

    /** CREATTY-style label + fallback field lookup (fast direct fill). */
    const TEEPUBLIC_FIELD_LABELS = {
        firstName: ['first name', 'first'],
        lastName: ['last name', 'last'],
        email: ['email address', 'email'],
        password: ['password'],
    };

    const TEEPUBLIC_FIELD_FALLBACKS = {
        firstName: 'input[name*="first" i], input[id*="first" i], input[autocomplete="given-name"]',
        lastName: 'input[name*="last" i], input[id*="last" i], input[autocomplete="family-name"]',
        email: 'input[type="email"], input[name*="email" i], input[id*="email" i]',
        password: 'input[type="password"], input[name*="password" i], input[id*="password" i]',
    };

    function normalizeLabelText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function getInputByLabel(labelWords) {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
            const text = normalizeLabelText(label.textContent);
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
        const selector = TEEPUBLIC_FIELD_FALLBACKS[name];
        return selector ? document.querySelector(selector) : null;
    }

    function findTeePublicSignupFieldsByLabel() {
        const fields = {};
        for (const [name, labels] of Object.entries(TEEPUBLIC_FIELD_LABELS)) {
            fields[name] = getInputByLabel(labels) || getInputByFallback(name);
        }
        return fields;
    }

    function setFieldValueDirect(input, value) {
        if (!input) return false;
        setNativeInputValue(input, String(value ?? ''));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function findTeePublicCreateButton() {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        return buttons.find((button) => {
            const text = normalizeLabelText(button.textContent || button.value);
            return text.includes('create account') || text.includes('create');
        }) || document.querySelector('#create_account, button[type="submit"]');
    }

    function fillTeePublicSignupDirect(values) {
        const fields = findTeePublicSignupFieldsByLabel();
        let filled = 0;
        for (const [name, val] of Object.entries(values || {})) {
            if (!val || !fields[name]) continue;
            if (setFieldValueDirect(fields[name], val)) filled += 1;
        }
        return { ok: filled > 0, filled, fields };
    }

    global.EmailCoreAccountUtils = {
        TEEPUBLIC_PASSWORD_MIN,
        capitalize,
        splitNameFromEmail,
        looksLikeStoreHandle,
        nameLooksLikeStoreAlias,
        ensureCompliantSignupPassword,
        sanitizeSignupCredentials,
        resolveAccountNames,
        encodeSignupHash,
        signupPayloadToBase64,
        decodeSignupHash,
        decodeSignupFromLocation,
        parseSignupPayloadFromEncoded,
        normalizeEncodedBase64,
        appendSignupHashToUrl,
        captureSignupPayloadFromUrl,
        readCapturedSignupPayload,
        SIGNUP_PAYLOAD_SESSION_KEY,
        humanTypeElement,
        setNativeInputValue,
        dispatchInputEvents,
        deriveInboxToken,
        isTeePublicConfirmMessage,
        extractTeePublicConfirmLink,
        findConfirmMessage,
        humanDelay,
        fillFieldsSequence,
        stripHtml,
        normalizeLabelText,
        getInputByLabel,
        getInputByFallback,
        findTeePublicSignupFieldsByLabel,
        setFieldValueDirect,
        findTeePublicCreateButton,
        fillTeePublicSignupDirect,
        TEEPUBLIC_FIELD_LABELS,
    };
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : window);
