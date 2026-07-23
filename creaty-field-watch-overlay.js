/**
 * AI CREATY Field Watch — TeePublic page overlay (extension content script).
 * Mirrors server-injected overlay; listens for supervisor storage updates.
 */
(function initCreatyFieldWatchOverlay() {
    'use strict';

    const ROOT_ID = 'nhp-creaty-field-watch-ext';
    const STATUS_KEY = 'creaty_supervisor_status';
    const JOURNAL_KEY = 'creaty_supervisor_journal';

    function ensureRoot() {
        let root = document.getElementById(ROOT_ID);
        if (root) return root;
        root = document.createElement('div');
        root.id = ROOT_ID;
        root.setAttribute('dir', 'rtl');
        root.style.cssText = [
            'position:fixed', 'top:12px', 'left:12px', 'z-index:2147483646',
            'max-width:380px', 'font:13px/1.45 "Segoe UI",Tahoma,sans-serif',
            'background:rgba(12,18,32,0.94)', 'color:#e8f0ff',
            'border:1px solid rgba(99,179,237,0.5)', 'border-radius:10px',
            'padding:10px 12px', 'box-shadow:0 8px 28px rgba(0,0,0,0.35)',
            'pointer-events:none',
        ].join(';');
        (document.documentElement || document.body).appendChild(root);
        return root;
    }

    function render(status, entries) {
        const root = ensureRoot();
        const msg = String(status?.message || 'مشرف AI: مراقبة الحقول...');
        const active = status?.active === true;
        const logLines = (entries || []).slice(0, 5).map((e) => {
            const ok = e.success ? '✓' : '✗';
            const step = String(e.step || e.action || '').slice(0, 42);
            return `<div style="opacity:0.88;margin-top:3px;font-size:11px">${ok} ${step}</div>`;
        }).join('');
        root.innerHTML = `
            <div style="font-weight:700;color:#7dd3fc;margin-bottom:5px">AI CREATY Field Watch</div>
            <div style="color:${active ? '#fbbf24' : '#86efac'}">${msg}</div>
            <div style="margin-top:6px">${logLines}</div>
        `;
    }

    function readAndRender() {
        try {
            chrome.storage.local.get([STATUS_KEY, JOURNAL_KEY], (data) => {
                render(data[STATUS_KEY] || {}, data[JOURNAL_KEY] || []);
            });
        } catch (_) { /* ignore */ }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (changes[STATUS_KEY] || changes[JOURNAL_KEY]) {
                render(
                    changes[STATUS_KEY]?.newValue || {},
                    changes[JOURNAL_KEY]?.newValue || []
                );
            }
        });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg?.type === 'creaty_supervisor_update') {
                render(msg.status || {}, msg.entries || []);
            }
        });
    }

    readAndRender();
})();
