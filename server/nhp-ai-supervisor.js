/**
 * NHP AI Supervisor — Puppeteer field recovery via CLIProxy (auto model).
 * Journal: server_logs/ai-supervisor-journal.jsonl
 */
const fs = require('fs');
const path = require('path');

const { getCliProxyConfig, resolveRequestCliProxyCredentials } = require('./generate-api');

const JOURNAL_FILE = 'ai-supervisor-journal.jsonl';
const TEXT_MODEL_CHAIN = ['auto', 'gpt-5.4', 'gpt-5.3-codex', 'gemini-2.5-flash', 'claude-sonnet-4-20250514'];
const MAX_AI_RETRIES = 2;
const CHAT_TIMEOUT_MS = 45000;

const SIGNUP_FIELD_LABELS = {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
};

const STORE_NAME_SELECTORS = [
    '#design_store_name',
    '.jsStoreName',
    'input[name*="store_name"]',
    'input[name="store[name]"]',
    '#store_name',
    'input[name*="store"]',
    'input[placeholder*="Store Name" i]',
    'input[aria-label*="Store Name" i]',
];

const SET_NATIVE_VALUE_FN = `
function setNativeValue(input, value) {
    if (!input) return false;
    const prototype = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
        descriptor.set.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
}
`;

let currentStatus = {
    active: false,
    message: '',
    step: '',
    email: '',
    phase: '',
    updatedAt: '',
};

function getJournalPath(rootDir) {
    const logDir = path.join(rootDir, 'server_logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    return path.join(logDir, JOURNAL_FILE);
}

function appendJournal(rootDir, entry, logFn = () => {}) {
    const row = {
        ts: new Date().toISOString(),
        ...entry,
    };
    try {
        fs.appendFileSync(getJournalPath(rootDir), `${JSON.stringify(row)}\n`, 'utf8');
    } catch (err) {
        logFn(`[Supervisor] journal write failed: ${err.message}`, 'WARN');
    }
    return row;
}

function readJournalTail(rootDir, limit = 50) {
    const filePath = getJournalPath(rootDir);
    if (!fs.existsSync(filePath)) return [];
    try {
        const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
        return lines.slice(-Math.max(1, limit)).map((line) => {
            try { return JSON.parse(line); } catch (_) { return null; }
        }).filter(Boolean).reverse();
    } catch (_) {
        return [];
    }
}

function setSupervisorStatus(patch = {}) {
    currentStatus = {
        ...currentStatus,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    return currentStatus;
}

function getSupervisorStatus() {
    return { ...currentStatus };
}

async function fetchChatOnce(baseUrl, apiKey, model, prompt, timeoutMs = CHAT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = `${String(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'You are a browser automation supervisor. Reply with JSON only.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.2,
                max_tokens: 400,
            }),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, error: data?.error?.message || data?.message || `HTTP ${res.status}`, model };
        }
        const text = data?.choices?.[0]?.message?.content || '';
        if (!String(text).trim()) return { success: false, error: 'empty_response', model };
        return { success: true, text, model };
    } catch (err) {
        return { success: false, error: String(err?.message || err), model };
    } finally {
        clearTimeout(timer);
    }
}

async function callCliProxySupervisor(prompt, rootDir, req = null) {
    const creds = req ? resolveRequestCliProxyCredentials(req) : { apiKey: '', baseUrl: '' };
    const config = getCliProxyConfig(rootDir, creds);
    if (!config.apiKey) {
        return { success: false, error: 'no_api_key' };
    }
    let lastError = 'cliproxy_failed';
    for (const model of TEXT_MODEL_CHAIN) {
        const result = await fetchChatOnce(config.baseUrl, config.apiKey, model, prompt);
        if (result.success) return { ...result, baseUrl: config.baseUrl };
        lastError = result.error || lastError;
        if (/401|403|api key/i.test(lastError)) break;
    }
    return { success: false, error: lastError };
}

function parseSupervisorAction(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const action = String(parsed.action || '').toLowerCase();
            if (['fill', 'click', 'wait'].includes(action)) {
                return {
                    action,
                    selector: String(parsed.selector || '').trim(),
                    value: parsed.value != null ? String(parsed.value) : '',
                    waitMs: Math.max(0, Number(parsed.waitMs || parsed.ms || 0)),
                    notes: String(parsed.notes || '').trim(),
                };
            }
        }
    } catch (_) { /* ignore */ }
    return null;
}

async function capturePageFormState(page) {
    return page.evaluate((selectors) => {
        function norm(v) {
            return String(v || '').replace(/\s+/g, ' ').trim();
        }
        function isVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 8 && rect.height > 8 && style.visibility !== 'hidden' && style.display !== 'none';
        }
        const fields = [];
        const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
        inputs.forEach((el) => {
            if (!isVisible(el)) return;
            const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
            const parentLabel = el.closest('label');
            fields.push({
                tag: el.tagName.toLowerCase(),
                type: el.getAttribute('type') || '',
                id: el.id || '',
                name: el.getAttribute('name') || '',
                placeholder: el.getAttribute('placeholder') || '',
                label: norm(labelEl?.textContent || parentLabel?.textContent || el.getAttribute('aria-label') || ''),
                value: String(el.value || '').slice(0, 120),
                selector: el.id ? `#${el.id}` : (el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : ''),
            });
        });
        const storeNameEl = selectors.map((s) => document.querySelector(s)).find(Boolean);
        return {
            url: window.location.href,
            title: document.title || '',
            storeNamePresent: !!storeNameEl,
            storeNameValue: storeNameEl ? String(storeNameEl.value || '').trim() : '',
            fields: fields.slice(0, 30),
        };
    }, STORE_NAME_SELECTORS);
}

async function injectFieldWatchOverlay(page, statusText, logs = []) {
    await page.evaluate(({ statusText, logs }) => {
        const ID = 'nhp-creaty-field-watch';
        let root = document.getElementById(ID);
        if (!root) {
            root = document.createElement('div');
            root.id = ID;
            root.setAttribute('dir', 'rtl');
            root.style.cssText = [
                'position:fixed', 'top:12px', 'left:12px', 'z-index:2147483646',
                'max-width:360px', 'font:13px/1.45 "Segoe UI",Tahoma,sans-serif',
                'background:rgba(12,18,32,0.92)', 'color:#e8f0ff',
                'border:1px solid rgba(99,179,237,0.45)', 'border-radius:10px',
                'padding:10px 12px', 'box-shadow:0 8px 28px rgba(0,0,0,0.35)',
                'pointer-events:none',
            ].join(';');
            document.documentElement.appendChild(root);
        }
        const logLines = (logs || []).slice(0, 6).map((l) => {
            const ok = l.success ? '✓' : '✗';
            return `<div style="opacity:0.9;margin-top:4px">${ok} ${String(l.step || l.action || '').slice(0, 48)}</div>`;
        }).join('');
        root.innerHTML = `
            <div style="font-weight:700;color:#7dd3fc;margin-bottom:6px">AI CREATY Field Watch</div>
            <div style="color:#fbbf24">${String(statusText || '—')}</div>
            <div style="margin-top:8px;font-size:11px;opacity:0.85">${logLines || ''}</div>
        `;
    }, { statusText, logs }).catch(() => null);
}

async function findStoreNameInput(page) {
    return page.evaluate((selectors, helpers) => {
        // eslint-disable-next-line no-eval
        eval(helpers);
        function norm(v) {
            return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
        }
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return { found: true, selector: sel, value: String(el.value || '').trim() };
        }
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
            if (!norm(label.textContent).includes('store name')) continue;
            const nested = label.querySelector('input');
            if (nested) {
                const sel = nested.id ? `#${nested.id}` : (nested.getAttribute('name') ? `input[name="${nested.getAttribute('name')}"]` : '');
                return { found: true, selector: sel || 'input', value: String(nested.value || '').trim() };
            }
            const htmlFor = label.getAttribute('for');
            if (htmlFor) {
                const linked = document.getElementById(htmlFor);
                if (linked) return { found: true, selector: `#${htmlFor}`, value: String(linked.value || '').trim() };
            }
        }
        return { found: false, selector: '', value: '' };
    }, STORE_NAME_SELECTORS, SET_NATIVE_VALUE_FN);
}

async function fillFieldNative(page, selector, value) {
    const text = String(value || '').trim();
    if (!selector || !text) return { success: false, reason: 'missing_selector_or_value' };
    return page.evaluate(({ selector, value, helpers }) => {
        // eslint-disable-next-line no-eval
        eval(helpers);
        const el = document.querySelector(selector);
        if (!el) return { success: false, reason: 'element_not_found', actual: '' };
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        el.focus();
        setNativeValue(el, '');
        setNativeValue(el, value);
        const actual = String(el.value || '').trim();
        return {
            success: actual === value || actual.includes(value) || value.includes(actual),
            reason: actual ? 'partial_or_full' : 'empty_after_fill',
            actual,
            selector,
        };
    }, { selector, value: text, helpers: SET_NATIVE_VALUE_FN });
}

async function verifyFieldValue(page, expectedValue, selectorHint = '') {
    const expected = String(expectedValue || '').trim();
    const selector = String(selectorHint || '').trim();
    if (!selector) return { ok: false, actual: '', selector: '' };
    const result = await page.evaluate(({ selector, expected, helpers }) => {
        // eslint-disable-next-line no-eval
        eval(helpers);
        const el = document.querySelector(selector);
        if (!el) return { ok: false, actual: '' };
        const actual = String(el.value || '').trim();
        const ok = actual === expected || actual.includes(expected) || (expected && actual.length >= Math.min(expected.length, 3));
        return { ok, actual };
    }, { selector, expected, helpers: SET_NATIVE_VALUE_FN });
    return { ...result, selector };
}

async function verifyStoreName(page, expectedValue, selectorHint = '') {
    const expected = String(expectedValue || '').trim();
    const hit = await findStoreNameInput(page);
    const selector = selectorHint || hit.selector;
    if (!selector) return { ok: false, actual: hit.value || '', selector: '' };
    return verifyFieldValue(page, expected, selector);
}

async function executeSupervisorAction(page, action) {
    if (!action || !action.action) return { success: false, reason: 'no_action' };
    if (action.action === 'wait') {
        await new Promise((r) => setTimeout(r, Math.max(500, action.waitMs || 1500)));
        return { success: true, reason: 'waited' };
    }
    if (action.action === 'click' && action.selector) {
        const clicked = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            el.scrollIntoView({ block: 'center' });
            el.click();
            return true;
        }, action.selector).catch(() => false);
        return { success: clicked, reason: clicked ? 'clicked' : 'click_failed' };
    }
    if (action.action === 'fill' && action.selector) {
        return fillFieldNative(page, action.selector, action.value);
    }
    return { success: false, reason: 'unsupported_action' };
}

async function runSupervisorRecover(page, context = {}, rootDir, req = null, logFn = () => {}) {
    const {
        step = 'recover_field',
        expectedAction = '',
        expectedValue = '',
        email = '',
        phase = 'foundation',
        storeName = '',
        fieldLabel = '',
    } = context;

    setSupervisorStatus({
        active: true,
        message: `مشرف AI: يصلح حقل ${step}...`,
        step,
        email,
        phase,
    });
    await injectFieldWatchOverlay(page, `مشرف AI: يصلح ${step}...`, readJournalTail(rootDir, 5));

    const pageState = await capturePageFormState(page).catch(() => ({}));
    let lastFailure = 'native_fill_failed';

    for (let attempt = 1; attempt <= MAX_AI_RETRIES; attempt += 1) {
        const prompt = [
            'Browser automation supervisor — choose ONE recovery action.',
            'Reply JSON only: {"action":"fill|click|wait","selector":"CSS","value":"...","waitMs":1500,"notes":"..."}',
            `Phase: ${phase}`,
            fieldLabel ? `Field label: ${fieldLabel}` : '',
            `Expected: ${expectedAction}`,
            expectedValue ? `Target value: ${expectedValue}` : '',
            phase === 'signup'
                ? 'TeePublic signup hints: firstName=#user_first_name or input[name="user[first_name]"], lastName=#user_last_name, email=#user_email, password=#user_password'
                : '',
            `Page URL: ${pageState.url || ''}`,
            `Page title: ${pageState.title || ''}`,
            `Visible fields: ${JSON.stringify(pageState.fields || [])}`,
            phase !== 'signup' ? `Store name current: "${pageState.storeNameValue || ''}"` : '',
            `Attempt: ${attempt}/${MAX_AI_RETRIES}`,
        ].filter(Boolean).join('\n');

        const aiResult = await callCliProxySupervisor(prompt, rootDir, req);
        if (!aiResult.success) {
            lastFailure = aiResult.error || 'ai_failed';
            logFn(`[Supervisor] AI attempt ${attempt} failed: ${lastFailure}`, 'WARN');
            continue;
        }

        const action = parseSupervisorAction(aiResult.text);
        if (!action) {
            lastFailure = 'unparseable_ai_response';
            continue;
        }

        const execResult = await executeSupervisorAction(page, action);
        if (action.action === 'fill' && expectedValue) {
            const verify = phase === 'signup'
                ? await verifyFieldValue(page, expectedValue, action.selector)
                : await verifyStoreName(page, expectedValue, action.selector);
            execResult.verified = verify.ok;
            execResult.actual = verify.actual;
            if (!verify.ok) {
                lastFailure = `verify_failed:${verify.actual || 'empty'}`;
                appendJournal(rootDir, {
                    email, phase, url: pageState.url, step,
                    fieldLabel: fieldLabel || SIGNUP_FIELD_LABELS[step] || '',
                    action: action.action, selector: action.selector,
                    success: false, storeName: storeName || expectedValue,
                    notes: `AI attempt ${attempt}: ${lastFailure}`,
                }, logFn);
                continue;
            }
        }

        if (execResult.success || execResult.verified) {
            const entry = appendJournal(rootDir, {
                email, phase, url: pageState.url, step,
                fieldLabel: fieldLabel || SIGNUP_FIELD_LABELS[step] || '',
                action: action.action, selector: action.selector,
                success: true, storeName: storeName || expectedValue,
                notes: action.notes || `AI recovery attempt ${attempt}`,
            }, logFn);
            setSupervisorStatus({ active: false, message: `تم إصلاح ${step}`, step, email, phase });
            await injectFieldWatchOverlay(page, `مشرف AI: تم إصلاح ${step} ✓`, [entry]);
            return { success: true, action, entry };
        }
        lastFailure = execResult.reason || 'exec_failed';
    }

    const failEntry = appendJournal(rootDir, {
        email, phase, url: pageState.url, step,
        fieldLabel: fieldLabel || SIGNUP_FIELD_LABELS[step] || '',
        action: 'escalate', selector: '',
        success: false, storeName: storeName || expectedValue,
        notes: `فشل بعد ${MAX_AI_RETRIES} محاولات AI: ${lastFailure}`,
    }, logFn);
    setSupervisorStatus({
        active: false,
        message: `فشل إصلاح ${step} — يتطلب تدخل المستخدم`,
        step, email, phase,
    });
    await injectFieldWatchOverlay(page, `مشرف AI: فشل ${step} — تدخل يدوي`, [failEntry]);
    logFn(`[Supervisor] ESCALATE ${step} for ${email}: ${lastFailure}`, 'ERROR');
    return { success: false, error: lastFailure, entry: failEntry };
}

async function fillStoreNameWithSupervisor(page, storeName, opts = {}) {
    const {
        rootDir = process.cwd(),
        req = null,
        logFn = () => {},
        email = '',
        phase = 'foundation',
    } = opts;
    const name = String(storeName || '').trim();
    if (!name) return { success: false, error: 'empty_store_name' };

    setSupervisorStatus({ active: true, message: 'مشرف AI: تعبئة Store Name...', step: 'store_name', email, phase });
    await injectFieldWatchOverlay(page, 'مشرف AI: تعبئة Store Name...', readJournalTail(rootDir, 4));

    const hit = await findStoreNameInput(page);
    if (!hit.found) {
        const recovered = await runSupervisorRecover(page, {
            step: 'store_name',
            expectedAction: `find and fill Store Name with "${name}"`,
            expectedValue: name,
            email, phase, storeName: name,
        }, rootDir, req, logFn);
        return recovered;
    }

    const fillResult = await fillFieldNative(page, hit.selector, name);
    const verify = await verifyStoreName(page, name, hit.selector);

    if (verify.ok) {
        const entry = appendJournal(rootDir, {
            email, phase,
            url: await page.url().catch(() => ''),
            step: 'store_name',
            action: 'fill',
            selector: hit.selector,
            success: true,
            storeName: name,
            notes: 'setNativeValue verified',
        }, logFn);
        setSupervisorStatus({ active: false, message: 'تم تعبئة Store Name ✓', step: 'store_name', email, phase });
        await injectFieldWatchOverlay(page, 'مشرف AI: Store Name ✓', [entry]);
        return { success: true, selector: hit.selector, method: 'setNativeValue', entry };
    }

    logFn(`[Supervisor] Store name verify failed (actual="${verify.actual || ''}") — invoking AI`, 'WARN');
    appendJournal(rootDir, {
        email, phase,
        url: await page.url().catch(() => ''),
        step: 'store_name',
        action: 'fill',
        selector: hit.selector,
        success: false,
        storeName: name,
        notes: `native fill failed: ${fillResult.reason || 'verify_failed'}`,
    }, logFn);

    return runSupervisorRecover(page, {
        step: 'store_name',
        expectedAction: `fill Store Name with "${name}"`,
        expectedValue: name,
        email, phase, storeName: name,
    }, rootDir, req, logFn);
}

/**
 * Signup / generic field recovery — max 2 AI retries per field.
 * @param {import('puppeteer').Page} page
 * @param {object} context — email, phase, step, expectedValue, fieldLabel, rootDir, req, logFn
 */
async function attemptFieldFix(page, context = {}) {
    const {
        step = 'field',
        expectedValue = '',
        fieldLabel = '',
        email = '',
        phase = 'signup',
        rootDir = process.cwd(),
        req = null,
        logFn = () => {},
    } = context;
    const label = fieldLabel || SIGNUP_FIELD_LABELS[step] || step;
    const value = String(expectedValue || '').trim();
    if (!value) {
        return { success: false, error: 'empty_expected_value' };
    }
    return runSupervisorRecover(page, {
        step,
        fieldLabel: label,
        expectedAction: `find and fill ${label} with "${value}"`,
        expectedValue: value,
        email,
        phase,
    }, rootDir, req, logFn);
}

function registerSupervisorApi(app, deps = {}) {
    const rootDir = deps.rootDir || process.cwd();
    const logFn = deps.logFn || (() => {});
    const journalPath = getJournalPath(rootDir);

    app.get('/api/supervisor/status', (req, res) => {
        const recentLimit = Math.min(40, Math.max(0, Number(req.query?.recent) || 10));
        res.json({
            ok: true,
            service: 'ai-supervisor',
            status: getSupervisorStatus(),
            journalPath,
            recent: recentLimit > 0 ? readJournalTail(rootDir, recentLimit) : [],
        });
    });

    app.get('/api/supervisor/journal', (req, res) => {
        const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
        res.json({
            ok: true,
            entries: readJournalTail(rootDir, limit),
            path: journalPath,
        });
    });

    logFn('AI Supervisor API mounted (/api/supervisor/status, /api/supervisor/journal)', 'INFO');
}

module.exports = {
    SIGNUP_FIELD_LABELS,
    STORE_NAME_SELECTORS,
    appendJournal,
    readJournalTail,
    getSupervisorStatus,
    setSupervisorStatus,
    capturePageFormState,
    injectFieldWatchOverlay,
    fillStoreNameWithSupervisor,
    runSupervisorRecover,
    attemptFieldFix,
    verifyFieldValue,
    registerSupervisorApi,
};
