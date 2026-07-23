/**
 * CREATY account classification via CLIProxyAPI (OpenAI-compatible).
 * Rules-only fallback when no API key is configured.
 */
(function initCreatyAiClassify(global) {
    'use strict';

    const Ai = () => (typeof NhpAiCliproxy !== 'undefined' ? NhpAiCliproxy : null);
    const CACHE_PREFIX = 'creaty_classify_cache_';
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const VALID = new Set(['NEW_SIGNUP', 'ALREADY_REGISTERED', 'ALREADY_ACTIVATED', 'NEEDS_ACTIVATION', 'UNKNOWN']);

    async function readStorage(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (items) => resolve(items || {}));
        });
    }

    async function getCliProxySettings() {
        const ai = Ai();
        if (ai?.getNhpAiCliproxySettings) {
            return ai.getNhpAiCliproxySettings();
        }
        return { baseUrl: '', apiKey: '', textModel: 'auto', imageModel: 'gpt-image-2', requestedImageModel: 'auto' };
    }

    function buildMetadataPayload(meta = {}) {
        return {
            email: String(meta.email || meta.display_email || '').trim(),
            teepublic_status: String(meta.teepublic_status || meta.tp_status || '').trim(),
            creaty_phase: String(meta.creaty_phase || '').trim(),
            tpActivated: meta.tpActivated === true,
            lastError: String(meta.lastError || meta.last_error || '').trim().slice(0, 200),
            notes: String(meta.notes || '').trim().slice(0, 200),
            signup_complete: meta.signup_complete === true || meta.signupComplete === true,
        };
    }

    /** AUT row never submitted to TeePublic — must run full sign_up, not activation-only. */
    function isFreshPendingSignup(meta = {}) {
        if (meta.tpActivated === true) return false;
        if (meta.signup_complete === true || meta.signupComplete === true) return false;
        const phase = String(meta.creaty_phase || '').toUpperCase();
        const status = String(meta.teepublic_status || meta.tp_status || 'pending').toLowerCase();
        if (!['PENDING', 'IDLE', ''].includes(phase)) return false;
        if (['registered', 'signup_complete', 'pending_activation', 'awaiting_activation', 'active', 'artisan', 'deactivated'].includes(status)) {
            return false;
        }
        return ['pending', '', 'new', 'created'].includes(status);
    }

    /**
     * Fast local rules — always run before cliproxyapi.
     * @returns {{ decision: string, source: string, skip?: boolean, reason?: string, needsActivation?: boolean }|null}
     */
    function evaluateLocalRules(meta = {}) {
        if (isFreshPendingSignup(meta)) return null;

        const status = String(meta.teepublic_status || meta.tp_status || '').toLowerCase();
        const phase = String(meta.creaty_phase || '').toUpperCase();

        if (meta.tpActivated === true || phase === 'DONE' || ['active', 'artisan'].includes(status)) {
            return {
                decision: 'ALREADY_ACTIVATED',
                source: 'rules',
                skip: true,
                reason: 'already_activated',
                activated: true,
            };
        }
        if (status === 'deactivated') {
            return { decision: 'ALREADY_REGISTERED', source: 'rules', skip: true, reason: 'already_registered' };
        }
        if (['registered', 'signup_complete'].includes(status) || meta.signup_complete || meta.signupComplete) {
            if (['WAIT_EMAIL', 'WAITING_EMAIL', 'ACTIVATING'].includes(phase) || status === 'pending_activation') {
                return {
                    decision: 'NEEDS_ACTIVATION',
                    source: 'rules',
                    skip: true,
                    reason: 'needs_activation',
                    needsActivation: true,
                };
            }
            return { decision: 'ALREADY_REGISTERED', source: 'rules', skip: true, reason: 'already_registered' };
        }
        if (phase === 'SKIPPED' && String(meta.skipReason || '').includes('already')) {
            return { decision: 'ALREADY_REGISTERED', source: 'rules', skip: true, reason: 'already_registered' };
        }
        if (['WAIT_EMAIL', 'WAITING_EMAIL', 'ACTIVATING'].includes(phase)
            || status === 'pending_activation' || status === 'awaiting_activation') {
            return {
                decision: 'NEEDS_ACTIVATION',
                source: 'rules',
                skip: true,
                reason: 'needs_activation',
                needsActivation: true,
            };
        }
        return null;
    }

    function parseClassificationText(text) {
        const raw = String(text || '').trim();
        if (!raw) return 'UNKNOWN';
        const upper = raw.toUpperCase();
        for (const label of VALID) {
            if (upper.includes(label)) return label;
        }
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const decision = String(parsed.decision || parsed.classification || parsed.result || '').toUpperCase();
                if (VALID.has(decision)) return decision;
            }
        } catch (_) { /* ignore */ }
        return 'UNKNOWN';
    }

    async function readCache(email) {
        const key = `${CACHE_PREFIX}${String(email || '').trim().toLowerCase()}`;
        const items = await readStorage([key]);
        const hit = items[key];
        if (!hit || typeof hit !== 'object') return null;
        if (Date.now() - Number(hit.ts || 0) > CACHE_TTL_MS) return null;
        if (!VALID.has(String(hit.decision || '').toUpperCase())) return null;
        return hit;
    }

    async function writeCache(email, decision, source) {
        const key = `${CACHE_PREFIX}${String(email || '').trim().toLowerCase()}`;
        await new Promise((resolve) => {
            chrome.storage.local.set({
                [key]: { decision, source, ts: Date.now() },
            }, () => resolve());
        });
    }

    async function classifyViaCliProxy(meta = {}) {
        const settings = await getCliProxySettings();
        if (!settings.apiKey) {
            return { decision: 'UNKNOWN', source: 'no_api_key', error: 'no_api_key' };
        }

        const payload = buildMetadataPayload(meta);
        const prompt = [
            'Classify this TeePublic seller account for signup automation.',
            'Reply with JSON only: {"decision":"NEW_SIGNUP|ALREADY_REGISTERED|NEEDS_ACTIVATION|UNKNOWN"}',
            'ALREADY_REGISTERED = account exists on TeePublic; skip new signup.',
            'NEEDS_ACTIVATION = signup done but email not confirmed; skip signup, need activation link.',
            'NEW_SIGNUP = safe to run full signup.',
            'UNKNOWN = insufficient data.',
            `Account: ${JSON.stringify(payload)}`,
        ].join('\n');

        const ai = Ai();
        if (!ai?.callNhpAiChat) {
            return { decision: 'UNKNOWN', source: 'cliproxyapi', error: 'nhp_ai_cliproxy_unavailable' };
        }
        const result = await ai.callNhpAiChat(prompt, {
            settings,
            textModel: settings.textModel,
            maxTokens: 64,
            temperature: 0.1,
            timeoutMs: 25000,
        });
        if (!result.success) {
            return { decision: 'UNKNOWN', source: 'cliproxyapi', error: result.error || 'cliproxy_failed' };
        }
        const text = result.text || '';
        const decision = parseClassificationText(text);
        return { decision, source: 'cliproxyapi', raw: text, modelUsed: result.modelUsed || result.model };
    }

    /**
     * Combined evaluation: rules first, then cliproxyapi for ambiguous cases.
     */
    async function evaluateAccount(meta = {}, options = {}) {
        if (isFreshPendingSignup(meta)) {
            return { decision: 'NEW_SIGNUP', source: 'fresh_pending', skip: false };
        }

        const local = evaluateLocalRules(meta);
        if (local) return local;

        const email = String(meta.email || meta.display_email || '').trim();
        if (options.useCache !== false && email) {
            const cached = await readCache(email);
            if (cached) {
                return {
                    decision: cached.decision,
                    source: `cache:${cached.source || 'cliproxyapi'}`,
                    skip: ['ALREADY_REGISTERED', 'ALREADY_ACTIVATED', 'NEEDS_ACTIVATION'].includes(cached.decision),
                    reason: cached.decision === 'NEEDS_ACTIVATION'
                        ? 'needs_activation'
                        : (cached.decision === 'ALREADY_ACTIVATED' ? 'already_activated' : 'already_registered'),
                    needsActivation: cached.decision === 'NEEDS_ACTIVATION',
                    activated: cached.decision === 'ALREADY_ACTIVATED',
                };
            }
        }

        if (options.aiEnabled === false) {
            return { decision: 'NEW_SIGNUP', source: 'rules_only', skip: false };
        }

        const ai = await classifyViaCliProxy(meta);
        if (ai.error === 'no_api_key') {
            return { decision: 'NEW_SIGNUP', source: 'rules_only', skip: false };
        }

        if (email && VALID.has(ai.decision)) {
            await writeCache(email, ai.decision, ai.source);
        }

        if (ai.decision === 'ALREADY_ACTIVATED') {
            return { decision: ai.decision, source: ai.source, skip: true, reason: 'already_activated', activated: true };
        }
        if (ai.decision === 'ALREADY_REGISTERED') {
            return { decision: ai.decision, source: ai.source, skip: true, reason: 'already_registered' };
        }
        if (ai.decision === 'NEEDS_ACTIVATION') {
            return {
                decision: ai.decision,
                source: ai.source,
                skip: true,
                reason: 'needs_activation',
                needsActivation: true,
            };
        }
        return { decision: ai.decision || 'NEW_SIGNUP', source: ai.source || 'cliproxyapi', skip: false };
    }

    global.CreatyAiClassify = {
        evaluateLocalRules,
        evaluateAccount,
        classifyViaCliProxy,
        getCliProxySettings,
        isFreshPendingSignup,
        VALID_DECISIONS: VALID,
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
