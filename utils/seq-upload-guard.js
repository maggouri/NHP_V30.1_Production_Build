/**
 * Sequential account-upload guard — locks GHOST concurrency fix (v30.1).
 * Browser: importScripts in background.js | Node: require() in ghost-server.js
 */
(function initNhpSeqUploadGuard(global) {
    'use strict';

    const STORAGE_KEY = 'nhpSeqUploadGuard';
    const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;
    const NODE_UNLOCK_FILE = '.nhp_seq_guard_unlock';

    const MARKERS = Object.freeze({
        enqueue: ['apProcessChain', 'apProcessRunning', 'startAPProcess'],
        ghostMutex: ['globalUploadChain', 'withGlobalUploadMutex']
    });

    let memUnlockUntil = 0;

    function expectedKey() {
        const a = 0x2b5;
        const b = 0x190;
        return String(a * 1000 + b);
    }

    function verifyKey(input) {
        return String(input || '').trim() === expectedKey();
    }

    function tokenForSession() {
        let h = 5381;
        const seed = `nhp-seq-v1:${expectedKey()}`;
        for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36);
    }

    function fingerprintFn(fn, needles) {
        const src = String(fn || '');
        const ok = Array.isArray(needles) && needles.every((n) => src.includes(n));
        return ok;
    }

    function verifyIntegrity(checks) {
        const results = {};
        let allOk = true;
        for (const [name, spec] of Object.entries(checks || {})) {
            const ok = fingerprintFn(spec?.fn, spec?.needles);
            results[name] = ok;
            if (!ok) allOk = false;
        }
        return { ok: allOk, results };
    }

    function readNodeUnlockFile() {
        try {
            const fs = require('fs');
            const path = require('path');
            const file = path.join(__dirname, '..', 'server_logs', NODE_UNLOCK_FILE);
            if (!fs.existsSync(file)) return null;
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (_) {
            return null;
        }
    }

    function writeNodeUnlockFile(payload) {
        try {
            const fs = require('fs');
            const path = require('path');
            const dir = path.join(__dirname, '..', 'server_logs');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, NODE_UNLOCK_FILE), JSON.stringify(payload), 'utf8');
        } catch (_) { /* ignore */ }
    }

    async function readUnlockState() {
        if (memUnlockUntil && Date.now() < memUnlockUntil) return true;

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const res = await new Promise((resolve) => {
                try {
                    chrome.storage.local.get([STORAGE_KEY], resolve);
                } catch (_) {
                    resolve({});
                }
            });
            const st = res?.[STORAGE_KEY];
            if (st?.token === tokenForSession() && Date.now() < Number(st.until || 0)) {
                memUnlockUntil = Number(st.until);
                return true;
            }
        }

        const nodeSt = readNodeUnlockFile();
        if (nodeSt?.token === tokenForSession() && Date.now() < Number(nodeSt.until || 0)) {
            memUnlockUntil = Number(nodeSt.until);
            return true;
        }

        return false;
    }

    async function unlock(input) {
        if (!verifyKey(input)) {
            return { success: false, error: 'invalid_key' };
        }
        const until = Date.now() + UNLOCK_TTL_MS;
        const payload = { token: tokenForSession(), until, at: Date.now() };
        memUnlockUntil = until;

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await new Promise((resolve) => {
                try {
                    chrome.storage.local.set({ [STORAGE_KEY]: payload }, resolve);
                } catch (_) {
                    resolve();
                }
            });
        }
        writeNodeUnlockFile(payload);
        return { success: true, until };
    }

    async function lock() {
        memUnlockUntil = 0;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await new Promise((resolve) => {
                try {
                    chrome.storage.local.remove([STORAGE_KEY], resolve);
                } catch (_) {
                    resolve();
                }
            });
        }
        try {
            const fs = require('fs');
            const path = require('path');
            const file = path.join(__dirname, '..', 'server_logs', NODE_UNLOCK_FILE);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch (_) { /* ignore */ }
        return { success: true };
    }

    async function assertSeqGuard(checks, context) {
        const unlocked = await readUnlockState();
        if (unlocked) return { ok: true, unlocked: true };
        const integrity = verifyIntegrity(checks);
        if (!integrity.ok) {
            console.error(`[NHP SeqGuard] Integrity failed (${context}):`, integrity.results);
            return { ok: false, unlocked: false, integrity };
        }
        return { ok: true, unlocked: false, integrity };
    }

    function wrapStartAPProcessDirect(startFn) {
        const inner = startFn;
        return async function guardedStartAPProcess(config, opts) {
            if (opts?.__seqGuardBypass) {
                return inner.call(this, config);
            }
            const unlocked = await readUnlockState();
            if (!unlocked) {
                const err = new Error('SEQ_UPLOAD_GUARD: direct startAPProcess blocked — use enqueueStartAPProcess');
                console.warn('[NHP SeqGuard]', err.message);
                throw err;
            }
            return inner.call(this, config);
        };
    }

    function sealFn(name, fn) {
        try {
            Object.defineProperty(global, name, {
                value: fn,
                writable: false,
                configurable: false
            });
        } catch (_) { /* already sealed */ }
    }

    async function sealWhenLocked(names) {
        const unlocked = await readUnlockState();
        if (unlocked) return false;
        for (const [name, fn] of Object.entries(names || {})) {
            if (typeof fn === 'function') sealFn(name, fn);
        }
        return true;
    }

    const api = {
        STORAGE_KEY,
        UNLOCK_TTL_MS,
        MARKERS,
        expectedKey,
        verifyKey,
        unlock,
        lock,
        readUnlockState,
        assertSeqGuard,
        verifyIntegrity,
        wrapStartAPProcessDirect,
        sealFn,
        sealWhenLocked,
        tokenForSession
    };

    global.NhpSeqUploadGuard = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : global));
