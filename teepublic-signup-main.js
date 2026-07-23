/**
 * TeePublic signup fill — CREATTY setNativeValue fallback (web_accessible, inject-only).
 * @FROZEN registration-activation — edits require unlock key 693400 (see REGISTRATION_ACTIVATION_FROZEN.manifest.json)
 * Primary fill path: teepublic-signup-inject.js (CREATTY content.js pattern).
 */
(function initTeePublicSignupMain() {
    if (window.__emailcoreTeePublicMainReady) return;
    window.__emailcoreTeePublicMainReady = true;

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

    function capitalize(word) {
        const s = String(word || '').trim();
        return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
    }

    function namesFromEmail(email) {
        const local = String(email || '').split('@')[0] || '';
        const cleaned = local.replace(/[._+\-0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
        const parts = cleaned.split(' ').filter(Boolean);
        if (parts.length >= 2) return { firstName: capitalize(parts[0]), lastName: capitalize(parts.slice(1).join(' ')) };
        if (parts.length === 1 && parts[0].length > 4) {
            const mid = Math.ceil(parts[0].length / 2);
            return { firstName: capitalize(parts[0].slice(0, mid)), lastName: capitalize(parts[0].slice(mid)) };
        }
        return { firstName: capitalize(parts[0] || 'User'), lastName: 'Account' };
    }

    function isUsableInput(el) {
        if (!el || el.disabled || el.readOnly) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 10 && rect.height > 8 && style.visibility !== 'hidden' && style.display !== 'none';
    }

    function findInput(selector, fallbackSelectors = []) {
        const selectors = [selector, ...fallbackSelectors].filter(Boolean);
        for (const sel of selectors) {
            const hit = Array.from(document.querySelectorAll(sel)).find(isUsableInput);
            if (hit) return hit;
        }
        return null;
    }

    async function typeStable(el, value) {
        const text = String(value || '').trim();
        if (!el || !text) return false;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.focus();
        el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 80));
        setNativeValue(el, text);
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        el.blur();
        return String(el.value || '').trim() === text;
    }

    window.addEventListener('EC_TEEPUBLIC_FILL', (event) => {
        const detail = event?.detail || {};
        const values = { ...(detail.values || {}) };
        if ((!values.firstName || !values.lastName) && values.email) {
            const derived = namesFromEmail(values.email);
            values.firstName = values.firstName || derived.firstName;
            values.lastName = values.lastName || derived.lastName;
        }
        const selectors = detail.selectors || {};
        const sequence = [
            {
                key: 'firstName',
                selector: selectors.firstName || '#user_first_name',
                fallback: ['input[name="firstname"]', 'input[name="firstName"]', 'input[name="user[first_name]"]', 'input[autocomplete="given-name"]', 'input[placeholder*="first" i]'],
            },
            {
                key: 'lastName',
                selector: selectors.lastName || '#user_last_name',
                fallback: ['input[name="lastname"]', 'input[name="lastName"]', 'input[name="user[last_name]"]', 'input[autocomplete="family-name"]', 'input[placeholder*="last" i]'],
            },
            { key: 'email', selector: selectors.email || '#user_email', fallback: ['input[type="email"]', 'input[name*="email" i]'] },
            { key: 'password', selector: selectors.password || '#user_password', fallback: ['input[type="password"]', 'input[name*="password" i]'] },
        ];

        let filled = 0;
        const run = async () => {
            const missing = [];
            for (const item of sequence) {
            const val = values[item.key];
                if (!val) {
                    missing.push(item.key);
                    continue;
                }
                try {
                    const el = findInput(item.selector, item.fallback);
                    if (!el) {
                        missing.push(item.key);
                        continue;
                    }
                    if (await typeStable(el, val)) filled += 1;
                    else missing.push(item.key);
                } catch (_) {
                    missing.push(item.key);
                }
            }

            window.dispatchEvent(new CustomEvent('EC_TEEPUBLIC_FILL_DONE', {
                detail: { ok: filled === 4, filled, missing },
            }));
        };

        run();
    });
})();
