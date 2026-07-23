/**
 * EmailCore Admin ↔ NHP Extension bridge (content script on admin pages).
 * Relays window.postMessage from nocochat.com / emailcore.app admin to background.
 */
(function initEmailcoreBridge() {
    if (window.__emailcoreBridgeActive) return;

    const ADMIN_SOURCE = 'emailcore-admin';
    const EXT_SOURCE = 'emailcore-extension';
    const BRIDGE_VERSION = '1.3.2';

    const ACTION_ALIASES = {
        NHP_SEND_TO_PROMPT_BAG: 'RADAR_SEND_TO_PROMPT_BAG',
    };

    /** Serialize Prompt Bag relays — parallel hydrations overwhelm the service worker. */
    let promptBagRelayQueue = Promise.resolve();

    function enqueuePromptBagRelay(task) {
        const run = promptBagRelayQueue.then(() => task());
        promptBagRelayQueue = run.catch(() => {});
        return run;
    }

    function isAdminHost() {
        const host = String(location.hostname || '').toLowerCase();
        return (
            host === 'emailcore.app' ||
            host.endsWith('.emailcore.app') ||
            host === 'nocochat.com' ||
            host.endsWith('.nocochat.com') ||
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host.endsWith('.onrender.com')
        );
    }

    function isAdminPath() {
        const path = String(location.pathname || '/');
        return path === '/admin' || path.startsWith('/admin/');
    }

    if (!isAdminHost() || !isAdminPath()) return;

    window.__emailcoreBridgeActive = true;
    window.__emailcoreBridgeReady = true;

    function markExtensionReady(extra = {}) {
        try {
            window.__emailcoreExtensionReady = true;
            window.__emailcoreBridgeVersion = BRIDGE_VERSION;
            if (extra.extensionId) {
                window.__emailcoreExtensionId = extra.extensionId;
            }
        } catch (_) { /* ignore */ }
    }

    function announceReady(extra = {}) {
        markExtensionReady(extra);
        window.postMessage(
            {
                source: EXT_SOURCE,
                type: 'EMAILCORE_BRIDGE_READY',
                payload: { version: BRIDGE_VERSION, ...extra },
            },
            '*'
        );
    }

    function reply(requestId, type, payload) {
        window.postMessage(
            { source: EXT_SOURCE, type, payload, requestId, bridgeVersion: BRIDGE_VERSION },
            '*'
        );
    }

    function isExtensionContextAlive() {
        try {
            return !!chrome.runtime?.id;
        } catch (_) {
            return false;
        }
    }

    function markExtensionStale(reason) {
        try {
            window.__emailcoreExtensionReady = false;
            window.__emailcoreBridgeReady = false;
            window.__emailcoreBridgeActive = false;
        } catch (_) { /* ignore */ }
        window.postMessage(
            {
                source: EXT_SOURCE,
                type: 'EMAILCORE_BRIDGE_STALE',
                payload: { reason: reason || 'context_invalidated' },
            },
            '*'
        );
    }

    function urlsMatchPromptBag(a, b) {
        return String(a || '').trim() === String(b || '').trim();
    }

    async function blobToDataUrl(blob) {
        if (!blob || !String(blob.type || '').startsWith('image/')) return '';
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    }

    async function canvasDataUrlFromImg(img) {
        if (!img?.naturalWidth || !img?.naturalHeight) return '';
        const maxSide = 1200;
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        return dataUrl.startsWith('data:image/') ? dataUrl : '';
    }

    async function fetchRemoteImageAsDataUrl(url) {
        const candidate = String(url || '').trim();
        if (!candidate || candidate.startsWith('data:image/') || candidate.startsWith('blob:')) return '';
        try {
            const resp = await fetch(candidate, {
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
            });
            if (!resp.ok) return '';
            const blob = await resp.blob();
            const dataUrl = await blobToDataUrl(blob);
            return dataUrl.startsWith('data:image/') ? dataUrl : '';
        } catch (_) {
            return '';
        }
    }

    async function hydratePromptBagItemFromPage(item) {
        if (!item || typeof item !== 'object') return item;
        const existing = String(item.dataUrl || '').trim();
        if (existing.startsWith('data:image/')) return item;
        const candidates = [item.thumbUrl, item.url, item.displayUrl]
            .map((value) => String(value || '').trim())
            .filter((value) => value && !value.startsWith('data:image/'));

        for (const card of document.querySelectorAll('[data-full], .nhp-dg-modal__card, .nhp-feed__card')) {
            const full = card.getAttribute('data-full') || '';
            const thumb = card.getAttribute('data-thumb') || '';
            if (!candidates.some((candidate) => urlsMatchPromptBag(candidate, full) || urlsMatchPromptBag(candidate, thumb))) {
                continue;
            }
            const img = card.querySelector('img');
            if (!img) continue;
            try {
                const dataUrl = await canvasDataUrlFromImg(img);
                if (dataUrl) return { ...item, dataUrl };
            } catch (_) { /* next card */ }
        }

        for (const candidate of candidates) {
            const fetched = await fetchRemoteImageAsDataUrl(candidate);
            if (fetched) return { ...item, dataUrl: fetched };
        }
        return item;
    }

    async function hydratePromptBagPayload(payload = {}) {
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) return payload;
        const needsHydration = items.some((item) => {
            const inline = String(item?.dataUrl || '').trim();
            return !inline.startsWith('data:image/');
        });
        if (!needsHydration) return payload;
        const hydrated = [];
        for (const item of items) {
            hydrated.push(await hydratePromptBagItemFromPage(item));
        }
        return { ...payload, items: hydrated };
    }

    function forwardToBackground(action, data) {
        return new Promise((resolve) => {
            if (!isExtensionContextAlive()) {
                markExtensionStale('context_invalidated');
                resolve({
                    success: false,
                    error: 'Extension context invalidated',
                    contextInvalidated: true,
                });
                return;
            }
            try {
                chrome.runtime.sendMessage({ action, ...data }, (response) => {
                    const err = chrome.runtime.lastError;
                    if (err) {
                        const msg = err.message || 'Extension unreachable';
                        if (/invalidated/i.test(msg)) {
                            markExtensionStale(msg);
                        }
                        resolve({
                            success: false,
                            error: msg,
                            contextInvalidated: /invalidated/i.test(msg),
                        });
                        return;
                    }
                    resolve(response ?? { success: false, error: 'no_response_from_extension' });
                });
            } catch (err) {
                const msg = err.message || 'Extension unreachable';
                if (/invalidated/i.test(msg)) {
                    markExtensionStale(msg);
                }
                resolve({
                    success: false,
                    error: msg,
                    contextInvalidated: /invalidated/i.test(msg),
                });
            }
        });
    }

    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== ADMIN_SOURCE) return;

        const { type, payload = {}, requestId } = data;
        if (!type || !requestId) return;

        if (type === 'EMAILCORE_BRIDGE_PROBE') {
            if (!isExtensionContextAlive()) {
                markExtensionStale('context_invalidated');
                reply(requestId, 'EMAILCORE_BRIDGE_PROBE_RESULT', {
                    success: false,
                    error: 'Extension context invalidated',
                    contextInvalidated: true,
                    bridgeVersion: BRIDGE_VERSION,
                });
                return;
            }
            announceReady({ extensionId: chrome.runtime.id });
            reply(requestId, 'EMAILCORE_BRIDGE_PROBE_RESULT', {
                success: true,
                bridgeVersion: BRIDGE_VERSION,
                extensionId: chrome.runtime.id,
                contextAlive: true,
            });
            return;
        }

        if (type === 'EMAILCORE_PING') {
            const result = await forwardToBackground('EMAILCORE_PING', {});
            markExtensionReady({ extensionId: result.extensionId || chrome.runtime.id });
            reply(requestId, 'EMAILCORE_PING_RESULT', result);
            return;
        }

        const action = ACTION_ALIASES[type] || type;
        if (type === 'NHP_SEND_TO_PROMPT_BAG') {
            const result = await enqueuePromptBagRelay(async () => {
                const items = Array.isArray(payload.items) ? payload.items : [];
                const allInline = items.length > 0 && items.every((item) => {
                    const inline = String(item?.dataUrl || '').trim();
                    return inline.startsWith('data:image/');
                });
                const forwardPayload = (payload.skipHydrate || allInline)
                    ? payload
                    : await hydratePromptBagPayload(payload);
                return forwardToBackground(action, forwardPayload);
            });
            if (result?.success !== false || result?.extensionId) {
                markExtensionReady({ extensionId: result.extensionId || chrome.runtime.id });
            }
            reply(requestId, `${type}_RESULT`, result);
            return;
        }
        const result = await forwardToBackground(action, payload);
        if (result?.success !== false || result?.extensionId) {
            markExtensionReady({ extensionId: result.extensionId || chrome.runtime.id });
        }
        reply(requestId, `${type}_RESULT`, result);
    });

    if (isExtensionContextAlive()) {
        announceReady({ extensionId: chrome.runtime.id });
    }

    let readyBroadcasts = 0;
    const readyInterval = setInterval(() => {
        readyBroadcasts += 1;
        if (isExtensionContextAlive()) {
            announceReady({ extensionId: chrome.runtime.id });
        } else {
            markExtensionStale('context_invalidated');
            clearInterval(readyInterval);
            return;
        }
        if (readyBroadcasts >= 30) clearInterval(readyInterval);
    }, 2000);
})();
