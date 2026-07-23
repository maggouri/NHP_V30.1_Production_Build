/**
 * INT-007 W1+W2 wiring — dedicated SW listener for AI settings bridge.
 * Registered from background.js immediately after nhp-ai-settings-bridge.js import
 * so PUT /api/creaty/ai-settings fires even if emailcore-handlers.js fails to load.
 */
(function registerNhpAiSettingsBridgeMessageHandlers() {
    'use strict';
    if (self.__nhpAiSettingsBridgeMessageHandlersReady) return;
    self.__nhpAiSettingsBridgeMessageHandlersReady = true;

    const BRIDGE_ACTIONS = new Set([
        'NHP_AI_SETTINGS_BRIDGE_PULL',
        'NHP_AI_SETTINGS_BRIDGE_SAVE',
        'NHP_AI_SETTINGS_BRIDGE_RESOLVE_GEMINI',
    ]);

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        const action = request?.action;
        if (!BRIDGE_ACTIONS.has(action)) return false;

        (async () => {
            try {
                if (typeof NhpAiSettingsBridge === 'undefined') {
                    throw new Error('NhpAiSettingsBridge unavailable');
                }
                if (action === 'NHP_AI_SETTINGS_BRIDGE_PULL') {
                    const data = await NhpAiSettingsBridge.pullAiSettings({
                        force: !!request.force,
                    });
                    sendResponse({ ok: true, data });
                    return;
                }
                if (action === 'NHP_AI_SETTINGS_BRIDGE_RESOLVE_GEMINI') {
                    const resolved = await NhpAiSettingsBridge.resolveGeminiApiKey({
                        file: String(request.file || 'message-handler'),
                        includeGenerate: request.includeGenerate !== false,
                        includeGodMode: request.includeGodMode !== false,
                        pullIfStale: request.pullIfStale !== false,
                    });
                    sendResponse({ ok: true, ...resolved });
                    return;
                }
                const providerId = String(request.providerId || 'cliproxy').trim() || 'cliproxy';
                if (providerId === 'gemini') {
                    const gemini = await NhpAiSettingsBridge.saveGeminiSettings({
                        apiKey: request.apiKey,
                        model: request.model,
                        providerId: 'gemini',
                        migrateFromExtension: !!request.migrateFromExtension,
                    });
                    sendResponse({ ok: true, gemini, providerId: 'gemini' });
                    return;
                }
                const cliproxy = await NhpAiSettingsBridge.saveCliproxySettings({
                    baseUrl: request.baseUrl,
                    apiKey: request.apiKey,
                    model: request.model,
                    providerId: 'cliproxy',
                });
                sendResponse({ ok: true, cliproxy, providerId: 'cliproxy' });
            } catch (err) {
                sendResponse({ ok: false, error: err?.message || String(err) });
            }
        })();
        return true;
    });
})();
