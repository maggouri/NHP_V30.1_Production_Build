/**
 * Shared CLIProxy / NHP AI helpers — same model resolution as SEO (auto + chain).
 * Loaded via importScripts in the service worker (before creaty modules).
 */
(function initNhpAiCliproxy(global) {
    'use strict';

    if (global.NhpAiCliproxy) return;

    const CLI_PROXY_DEFAULT_BASE = 'https://cliproxyapi-ywrp.onrender.com/v1';
    const DEFAULT_TEXT_MODEL = 'auto';
    const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
    const TEXT_MODEL_CHAIN = Object.freeze([
        'auto',
        'gpt-5.4',
        'gpt-5.3-codex',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'claude-sonnet-4-20250514',
    ]);
    const LEGACY_TEXT_MODEL_ALIASES = Object.freeze({
        'claude-sonnet-4-6': 'claude-sonnet-4-20250514',
        'claude-sonnet-4-latest': 'claude-sonnet-4-20250514',
    });
    const CHAT_TIMEOUT_MS = 45000;
    const IMAGE_TIMEOUT_MS = 300000;

    const _retry = typeof NhpCliProxyRetry !== 'undefined' ? NhpCliProxyRetry : null;

    function getDefaultBaseUrl() {
        if (typeof NhpRuntimeConfig !== 'undefined') {
            return NhpRuntimeConfig.defaultProxyBaseUrl();
        }
        return CLI_PROXY_DEFAULT_BASE;
    }

    function normalizeCliProxyBaseUrl(value) {
        if (_retry?.normalizeCliProxyBaseUrl) {
            return _retry.normalizeCliProxyBaseUrl(value, getDefaultBaseUrl);
        }
        const rawInput = String(value || '').trim();
        if (typeof NhpRuntimeConfig !== 'undefined' && NhpRuntimeConfig.isCliProxyLocalBaseUrl?.(rawInput)) {
            const migrated = NhpRuntimeConfig.getCached?.().proxyBaseUrl
                || NhpRuntimeConfig.DEFAULT_PROXY_BASE_URL
                || CLI_PROXY_DEFAULT_BASE;
            return String(migrated).replace(/\/+$/, '');
        }
        const raw = rawInput || getDefaultBaseUrl();
        return raw.replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1').replace(/([^:]\/)\/+/g, '$1') || getDefaultBaseUrl();
    }

    function resolveCliProxyTextModel(model) {
        const raw = String(model || '').trim() || DEFAULT_TEXT_MODEL;
        if (/^gpt-image/i.test(raw) || /^gpt-4o/i.test(raw)) return DEFAULT_TEXT_MODEL;
        const key = raw.toLowerCase();
        if (LEGACY_TEXT_MODEL_ALIASES[key] || LEGACY_TEXT_MODEL_ALIASES[raw]) {
            return LEGACY_TEXT_MODEL_ALIASES[key] || LEGACY_TEXT_MODEL_ALIASES[raw];
        }
        if (/^claude-sonnet-4-(?!20250514)/i.test(raw)) return 'claude-sonnet-4-20250514';
        return raw;
    }

    function resolveImageModel(requestedModel) {
        const raw = String(requestedModel || DEFAULT_TEXT_MODEL).trim() || DEFAULT_TEXT_MODEL;
        if (raw.toLowerCase() === 'auto') return DEFAULT_IMAGE_MODEL;
        return raw;
    }

    function normalizeApiImageSize(size, fallback = '1024x1024') {
        const raw = String(size || '').trim();
        if (/^\d{3,4}x\d{3,4}$/i.test(raw)) return raw.toLowerCase();
        return fallback;
    }

    function readStorage(keys) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(keys, (items) => resolve(items || {}));
            } catch (_) {
                resolve({});
            }
        });
    }

    async function getNhpAiCliproxySettings() {
        if (typeof NhpAiSettingsBridge !== 'undefined') {
            try {
                const bridged = await NhpAiSettingsBridge.getCachedCliproxySettings({ pullIfStale: true });
                if (bridged?.apiKey && bridged?.baseUrl) {
                    const stored = await readStorage(['nhpAdminAiKeys']);
                    const adminKeys = stored.nhpAdminAiKeys && typeof stored.nhpAdminAiKeys === 'object'
                        ? stored.nhpAdminAiKeys
                        : {};
                    const configuredText = adminKeys.model || adminKeys.textModel || DEFAULT_TEXT_MODEL;
                    const configuredImage = adminKeys.imageModel || adminKeys.image_model || 'auto';
                    return {
                        baseUrl: normalizeCliProxyBaseUrl(bridged.baseUrl),
                        apiKey: String(bridged.apiKey || '').trim(),
                        textModel: resolveCliProxyTextModel(configuredText),
                        imageModel: resolveImageModel(configuredImage),
                        requestedImageModel: String(configuredImage || 'auto').trim() || 'auto',
                        source: 'emailcore-bridge',
                        bridgeOwner: bridged.owner || 'emailcore',
                    };
                }
            } catch (_) {
                /* legacy fallback below */
            }
        }

        if (typeof NhpProxyEndpoints !== 'undefined') {
            const loaded = await NhpProxyEndpoints.loadProxyEndpoints();
            const primary = loaded.primary || NhpProxyEndpoints.getPrimaryEndpoint(loaded.endpoints);
            const stored = await readStorage(['nhpAdminAiKeys']);
            const adminKeys = stored.nhpAdminAiKeys && typeof stored.nhpAdminAiKeys === 'object'
                ? stored.nhpAdminAiKeys
                : {};
            const configuredText = adminKeys.model || adminKeys.textModel || DEFAULT_TEXT_MODEL;
            const configuredImage = adminKeys.imageModel || adminKeys.image_model || 'auto';
            return {
                baseUrl: NhpProxyEndpoints.normalizeBaseUrl(primary.baseUrl || ''),
                apiKey: String(primary.apiKey || loaded.legacyApiKey || '').trim(),
                endpoints: loaded.endpoints,
                textModel: resolveCliProxyTextModel(configuredText),
                imageModel: resolveImageModel(configuredImage),
                requestedImageModel: String(configuredImage || 'auto').trim() || 'auto',
            };
        }

        const stored = await readStorage(['nhpProxyBaseUrl', 'nhpGptApiKey', 'nhpAdminAiKeys']);
        const adminKeys = stored.nhpAdminAiKeys && typeof stored.nhpAdminAiKeys === 'object'
            ? stored.nhpAdminAiKeys
            : {};
        const configuredText = adminKeys.model || adminKeys.textModel || DEFAULT_TEXT_MODEL;
        const configuredImage = adminKeys.imageModel || adminKeys.image_model || 'auto';
        return {
            baseUrl: normalizeCliProxyBaseUrl(stored.nhpProxyBaseUrl || adminKeys.baseUrl || ''),
            apiKey: String(stored.nhpGptApiKey || adminKeys.gpt || '').trim(),
            textModel: resolveCliProxyTextModel(configuredText),
            imageModel: resolveImageModel(configuredImage),
            requestedImageModel: String(configuredImage || 'auto').trim() || 'auto',
        };
    }

    function isNonRetryableError(message = '') {
        const text = String(message || '').toLowerCase();
        return text.includes('api key is missing')
            || text.includes('invalid api key')
            || text.includes('incorrect api key')
            || text.includes('http 401')
            || text.includes('http 403')
            || text.includes('permission denied')
            || text.includes('unauthorized');
    }

    function buildModelChain(preferredModel) {
        const resolved = resolveCliProxyTextModel(preferredModel);
        const chain = [resolved];
        TEXT_MODEL_CHAIN.forEach((model) => {
            const normalized = resolveCliProxyTextModel(model);
            if (!chain.includes(normalized)) chain.push(normalized);
        });
        return chain;
    }

    function normalizeChatMessages(promptOrMessages) {
        if (Array.isArray(promptOrMessages)) {
            return promptOrMessages
                .map((entry) => ({
                    role: String(entry?.role || 'user'),
                    content: String(entry?.content ?? ''),
                }))
                .filter((entry) => entry.content.trim());
        }
        return [{ role: 'user', content: String(promptOrMessages || '') }];
    }

    function parseStructuredActionFromText(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidates = fenced ? [fenced[1].trim(), raw] : [raw];
        for (const candidate of candidates) {
            const jsonMatch = candidate.match(/\{[\s\S]*"action"\s*:\s*"[^"]+"[\s\S]*\}/);
            if (!jsonMatch) continue;
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                const action = String(parsed.action || '').trim();
                if (!action) continue;
                return {
                    name: action,
                    params: parsed.params && typeof parsed.params === 'object' ? parsed.params : {},
                    message: String(parsed.message || '').trim(),
                };
            } catch (_) { /* try next */ }
        }
        return null;
    }

    function resolveToolChoice(toolChoice) {
        if (!toolChoice) return 'auto';
        if (typeof toolChoice === 'string') {
            const normalized = toolChoice.trim().toLowerCase();
            if (normalized === 'auto' || normalized === 'none' || normalized === 'required') {
                return normalized;
            }
            return { type: 'function', function: { name: toolChoice.trim() } };
        }
        if (typeof toolChoice === 'object' && toolChoice.type) {
            return toolChoice;
        }
        return 'auto';
    }

    function normalizeToolCalls(toolCalls) {
        if (!Array.isArray(toolCalls)) return [];
        return toolCalls.map((call, index) => {
            const fn = call?.function || {};
            let params = {};
            try {
                params = fn.arguments ? JSON.parse(fn.arguments) : {};
            } catch (_) {
                params = {};
            }
            return {
                id: String(call?.id || `tool_${index}`),
                name: String(fn.name || '').trim(),
                params: params && typeof params === 'object' ? params : {},
            };
        }).filter((call) => call.name);
    }

    async function callNhpAiChatOnce(promptOrMessages, settings, model, options = {}) {
        const controller = new AbortController();
        const timeoutMs = Math.max(5000, Number(options.timeoutMs) || CHAT_TIMEOUT_MS);
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const base = String(settings.baseUrl || '').replace(/\/+$/, '');
            const messages = normalizeChatMessages(promptOrMessages);
            const payload = {
                model,
                messages,
                temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.35,
                max_tokens: Math.max(16, Number(options.maxTokens) || 900),
            };
            if (Array.isArray(options.tools) && options.tools.length) {
                payload.tools = options.tools;
                payload.tool_choice = resolveToolChoice(options.toolChoice);
            }
            const res = await fetch(`${base}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${settings.apiKey}`,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
                return { success: false, error: msg, httpStatus: res.status, model };
            }
            const message = data?.choices?.[0]?.message || {};
            const text = String(message.content || '').trim();
            const toolCalls = normalizeToolCalls(message.tool_calls);
            const structuredAction = toolCalls.length ? null : parseStructuredActionFromText(text);
            if (!text && !toolCalls.length && !structuredAction) {
                return { success: false, error: 'Empty response from AI', model };
            }
            return {
                success: true,
                text,
                toolCalls,
                structuredAction,
                rawMessage: message,
                source: 'cliproxyapi',
                model,
            };
        } catch (err) {
            const msg = String(err?.message || err || 'cliproxy_failed');
            if (err?.name === 'AbortError') {
                return { success: false, error: 'Request timed out.', model };
            }
            return { success: false, error: msg, model };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function callNhpAiChat(promptOrMessages, options = {}) {
        const settings = options.settings || await getNhpAiCliproxySettings();
        if (!settings.apiKey && !(Array.isArray(settings.endpoints) && settings.endpoints.some((item) => item.apiKey))) {
            return { success: false, error: 'no_api_key' };
        }

        const chain = options.modelChain || buildModelChain(options.textModel || settings.textModel);
        const maxModels = Math.max(1, Number(options.maxModels) || chain.length);

        const runWithEndpoint = async (endpoint) => {
            const endpointSettings = {
                ...settings,
                baseUrl: normalizeCliProxyBaseUrl(endpoint?.baseUrl || settings.baseUrl),
                apiKey: String(endpoint?.apiKey || settings.apiKey || '').trim(),
            };
            if (!endpointSettings.apiKey) {
                return { success: false, error: 'no_api_key' };
            }

            let lastError = '';
            for (let i = 0; i < Math.min(chain.length, maxModels); i += 1) {
                const model = resolveCliProxyTextModel(chain[i]);
                const result = await callNhpAiChatOnce(promptOrMessages, endpointSettings, model, options);
                if (result.success) {
                    const mergedToolCalls = result.toolCalls?.length
                        ? result.toolCalls
                        : (result.structuredAction
                            ? [{
                                id: 'structured_action',
                                name: result.structuredAction.name,
                                params: result.structuredAction.params || {},
                            }]
                            : []);
                    return {
                        ...result,
                        toolCalls: mergedToolCalls,
                        modelUsed: model,
                        source: 'cliproxyapi',
                        endpointId: endpoint?.id,
                        baseUrl: endpointSettings.baseUrl,
                    };
                }
                lastError = result.error || 'cliproxy_failed';
                if (isNonRetryableError(lastError)) break;
                if (/unknown provider/i.test(lastError)) continue;
            }
            return { success: false, error: lastError || 'cliproxy_failed', source: 'cliproxyapi', httpStatus: 0 };
        };

        if (typeof NhpProxyEndpoints !== 'undefined' && options.failover !== false) {
            const routingFn = NhpProxyEndpoints.callWithProxyRouting || NhpProxyEndpoints.callWithProxyFailover;
            return routingFn(
                (endpoint) => runWithEndpoint(endpoint),
                (result) => result?.success === true,
                { routingMode: options.routingMode, batchIndex: options.batchIndex, endpointId: options.endpointId }
            );
        }

        return runWithEndpoint(null);
    }

    async function callNhpAiImageGeneration(prompt, options = {}) {
        const settings = options.settings || await getNhpAiCliproxySettings();
        if (!settings.apiKey) {
            return { success: false, error: 'no_api_key' };
        }

        const controller = new AbortController();
        const timeoutMs = Math.max(10000, Number(options.timeoutMs) || IMAGE_TIMEOUT_MS);
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const safeSize = normalizeApiImageSize(options.size, '1024x1024');
        const imageModel = resolveImageModel(options.imageModel || settings.requestedImageModel);

        try {
            const base = String(settings.baseUrl || '').replace(/\/+$/, '');
            const res = await fetch(`${base}/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${settings.apiKey}`,
                },
                body: JSON.stringify({
                    model: imageModel,
                    prompt: String(prompt || '').trim(),
                    n: 1,
                    size: safeSize,
                }),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
                return { success: false, error: msg, model: imageModel, endpoint: '/images/generations' };
            }

            const images = Array.isArray(data?.data) ? data.data : [];
            const b64 = images[0]?.b64_json;
            if (b64) {
                return {
                    success: true,
                    dataUrl: `data:image/png;base64,${b64}`,
                    source: 'cliproxyapi',
                    endpoint: '/images/generations',
                    model: imageModel,
                    size: safeSize,
                };
            }

            const url = images[0]?.url;
            if (url) {
                const imgRes = await fetch(url, { signal: controller.signal });
                if (!imgRes.ok) return { success: false, error: `image_fetch_http_${imgRes.status}`, model: imageModel };
                const blob = await imgRes.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
                return {
                    success: true,
                    dataUrl,
                    source: 'cliproxyapi',
                    endpoint: '/images/generations',
                    model: imageModel,
                    size: safeSize,
                };
            }

            return { success: false, error: 'store_image_empty_response', model: imageModel };
        } catch (err) {
            return {
                success: false,
                error: String(err?.message || err || 'store_image_failed'),
                model: imageModel,
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    global.NhpAiCliproxy = {
        DEFAULT_TEXT_MODEL,
        DEFAULT_IMAGE_MODEL,
        TEXT_MODEL_CHAIN,
        normalizeCliProxyBaseUrl,
        resolveCliProxyTextModel,
        resolveImageModel,
        getNhpAiCliproxySettings,
        parseStructuredActionFromText,
        resolveToolChoice,
        normalizeToolCalls,
        callNhpAiChat,
        callNhpAiImageGeneration,
    };
})(typeof globalThis !== 'undefined' ? globalThis : self);
