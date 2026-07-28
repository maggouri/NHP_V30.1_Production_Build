'use strict';

/**
 * Startup cleanup for portable Data root: temp TTL, log size cap, cache cap.
 * Safe no-op if paths missing. Never touches Extension/Source trees.
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
    tempTtlMs: 7 * 24 * 60 * 60 * 1000,
    logMaxBytes: 50 * 1024 * 1024,
    cacheMaxBytes: 2 * 1024 * 1024 * 1024,
    dryRun: false
});

function listFilesRecursive(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
        return out;
    }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) listFilesRecursive(full, out);
        else if (ent.isFile()) out.push(full);
    }
    return out;
}

function fileSize(p) {
    try {
        return fs.statSync(p).size;
    } catch (_) {
        return 0;
    }
}

function rotateLogIfHuge(logFile, maxBytes, dryRun) {
    if (!fs.existsSync(logFile)) return null;
    const size = fileSize(logFile);
    if (size <= maxBytes) return null;
    const rotated = `${logFile}.${Date.now()}.bak`;
    if (!dryRun) {
        try {
            fs.renameSync(logFile, rotated);
        } catch (_) {
            return { action: 'rotate-failed', logFile, size };
        }
    }
    return { action: 'rotate', logFile, rotated, size };
}

function purgeOldFiles(dir, ttlMs, dryRun) {
    const now = Date.now();
    const removed = [];
    for (const file of listFilesRecursive(dir)) {
        let st;
        try {
            st = fs.statSync(file);
        } catch (_) {
            continue;
        }
        if (now - st.mtimeMs <= ttlMs) continue;
        removed.push({ file, size: st.size, mtime: st.mtimeMs });
        if (!dryRun) {
            try {
                fs.unlinkSync(file);
            } catch (_) { /* ignore locked */ }
        }
    }
    return removed;
}

function enforceCacheBudget(cacheDir, maxBytes, dryRun) {
    const files = listFilesRecursive(cacheDir).map((file) => {
        try {
            const st = fs.statSync(file);
            return { file, size: st.size, mtime: st.mtimeMs };
        } catch (_) {
            return null;
        }
    }).filter(Boolean).sort((a, b) => a.mtime - b.mtime);

    let total = files.reduce((s, f) => s + f.size, 0);
    const removed = [];
    for (const f of files) {
        if (total <= maxBytes) break;
        removed.push(f);
        total -= f.size;
        if (!dryRun) {
            try {
                fs.unlinkSync(f.file);
            } catch (_) { /* ignore */ }
        }
    }
    return { beforeBytes: total + removed.reduce((s, f) => s + f.size, 0), afterBytes: total, removed };
}

function runDataCleanup(portable, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const report = { temp: [], logs: [], cache: null };

    for (const key of ['tmp', 'temp_uploads', 'temp_uploads_ai_bridge', 'temp_uploads_pinterest']) {
        try {
            const dir = portable.get(key === 'tmp' ? 'tmp' : key);
            portable.assertNotExtensionWrite(dir);
            report.temp.push({ dir, purged: purgeOldFiles(dir, opts.tempTtlMs, opts.dryRun) });
        } catch (_) { /* skip */ }
    }

    try {
        const logsDir = portable.getLogsDir();
        portable.assertNotExtensionWrite(logsDir);
        if (fs.existsSync(logsDir)) {
            for (const name of fs.readdirSync(logsDir)) {
                if (!/\.log$/i.test(name)) continue;
                const r = rotateLogIfHuge(path.join(logsDir, name), opts.logMaxBytes, opts.dryRun);
                if (r) report.logs.push(r);
            }
        }
    } catch (_) { /* skip */ }

    try {
        const cacheDir = portable.getCacheDir();
        portable.assertNotExtensionWrite(cacheDir);
        report.cache = enforceCacheBudget(cacheDir, opts.cacheMaxBytes, opts.dryRun);
    } catch (_) { /* skip */ }

    return report;
}

module.exports = {
    runDataCleanup,
    DEFAULTS
};
