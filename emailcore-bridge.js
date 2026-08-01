/**
 * EmailCore Admin ↔ NHP Extension bridge (content script on admin pages).
 * Relays window.postMessage from nocochat.com / emailcore.app admin to background.
 */
(function initEmailcoreBridge() {
    let runtimeId = null;
    try {
        runtimeId = chrome.runtime?.id || null;
    } catch (_) {
        runtimeId = null;
    }

    // Page-window flags survive Ext reload; old CS dies but __emailcoreBridgeActive
    // stays true → new CS must re-bind when runtime id changed / previous owner gone.
    const previousOwner = window.__emailcoreBridgeOwnerId || null;
    if (
        window.__emailcoreBridgeActive
        && previousOwner
        && runtimeId
        && previousOwner === runtimeId
    ) {
        return;
    }

    const ADMIN_SOURCE = 'emailcore-admin';
    const EXT_SOURCE = 'emailcore-extension';
    const BRIDGE_VERSION = '1.3.3';

    const ACTION_ALIASES = {
        NHP_SEND_TO_PROMPT_BAG: 'RADAR_SEND_TO_PROMPT_BAG',
    };

    /** SW asleep / reloaded / no onMessage listener — common MV3 transient (do NOT mark bridge stale). */
    function isReceivingEndError(msg) {
        return /Receiving end does not exist|Could not establish connection/i.test(String(msg || ''));
    }

    /** True only when the content-script extension context is dead (reload required). */
    function isContextInvalidatedError(msg) {
        return /Extension context invalidated/i.test(String(msg || ''));
    }

    function sleepMs(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * chrome.runtime.sendMessage(msg, cb) ALSO returns a Promise in modern Chrome.
     * When the SW has no listener that Promise rejects with "Receiving end does not exist"
     * even if the callback handled lastError — swallow it to stop admin console spam.
     */
    function observeSendMessagePromise(maybePromise) {
        if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(() => {}).catch(() => {});
        }
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

    window.__emailcoreBridgeOwnerId = runtimeId;
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
            window.__emailcoreBridgeOwnerId = null;
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
        const hydrated = await Promise.all(items.map((item) => hydratePromptBagItemFromPage(item)));
        return { ...payload, items: hydrated };
    }

    function sendRuntimeMessageOnce(action, data) {
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
                const maybePromise = chrome.runtime.sendMessage({ action, ...data }, (response) => {
                    const err = chrome.runtime.lastError;
                    if (err) {
                        const msg = err.message || 'Extension unreachable';
                        // Only invalidate on true context death — SW sleep is transient.
                        if (isContextInvalidatedError(msg)) {
                            markExtensionStale(msg);
                        }
                        resolve({
                            success: false,
                            error: msg,
                            contextInvalidated: isContextInvalidatedError(msg),
                            receivingEndMissing: isReceivingEndError(msg),
                        });
                        return;
                    }
                    resolve(response ?? { success: false, error: 'no_response_from_extension' });
                });
                observeSendMessagePromise(maybePromise);
            } catch (err) {
                const msg = err.message || 'Extension unreachable';
                if (isContextInvalidatedError(msg)) {
                    markExtensionStale(msg);
                }
                resolve({
                    success: false,
                    error: msg,
                    contextInvalidated: isContextInvalidatedError(msg),
                    receivingEndMissing: isReceivingEndError(msg),
                });
            }
        });
    }

    async function forwardToBackground(action, data) {
        let result = await sendRuntimeMessageOnce(action, data);
        // MV3 SW often wakes after 1–2 idle retries — do not mark bridge stale.
        for (let attempt = 0; attempt < 3; attempt += 1) {
            if (!(result?.success === false && isReceivingEndError(result.error) && isExtensionContextAlive())) {
                break;
            }
            await sleepMs(120 * (attempt + 1));
            result = await sendRuntimeMessageOnce(action, data);
        }
        return result;
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
            // Wake SW + attach role/services for Admin handshake (owner|admin|member).
            const ping = await forwardToBackground('EMAILCORE_PING', {});
            const swOk = ping?.success !== false && !ping?.receivingEndMissing;
            announceReady({
                extensionId: chrome.runtime.id,
                role: ping?.role || null,
                version: ping?.version || null,
            });
            reply(requestId, 'EMAILCORE_BRIDGE_PROBE_RESULT', {
                success: true,
                bridgeVersion: BRIDGE_VERSION,
                extensionId: chrome.runtime.id,
                contextAlive: true,
                swAlive: swOk,
                role: ping?.role || 'unknown',
                authenticated: ping?.authenticated === true,
                username: ping?.username || '',
                version: ping?.version || null,
                services: ping?.services || null,
                ghostReachable: ping?.ghostReachable === true,
                channel: 'chrome_bridge',
                error: swOk ? undefined : (ping?.error || 'service_worker_waking'),
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
        let forwardPayload = payload;
        if (type === 'NHP_SEND_TO_PROMPT_BAG') {
            forwardPayload = await hydratePromptBagPayload(payload);
        }
        const result = await forwardToBackground(action, forwardPayload);
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
