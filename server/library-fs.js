'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const RM_OPTS = { recursive: true, force: true, maxRetries: 3 };

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLockedFsError(err) {
    if (!err) return false;
    const code = String(err.code || '').toUpperCase();
    return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
}

function countLibraryDesigns(rootDir) {
    const libraryDir = path.join(rootDir, 'generated_designs', 'library');
    if (!fs.existsSync(libraryDir)) return 0;
    let score = 0;
    try {
        const indexPath = path.join(libraryDir, 'index.json');
        if (fs.existsSync(indexPath)) {
            const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            if (Array.isArray(parsed)) score += parsed.length * 10;
        }
        for (const ent of fs.readdirSync(libraryDir, { withFileTypes: true })) {
            if (ent.isDirectory() && /^(lib_|canva_)/i.test(ent.name)) score += 1;
        }
    } catch (_) { /* ignore */ }
    return score;
}

function resolveNhpProjectRoot(...candidates) {
    const valid = [];
    const seen = new Set();
    for (const raw of candidates) {
        if (!raw) continue;
        const dir = path.resolve(String(raw).trim());
        if (seen.has(dir)) continue;
        seen.add(dir);
        try {
            if (fs.existsSync(path.join(dir, 'package.json'))
                && fs.existsSync(path.join(dir, 'ghost-server.js'))) {
                valid.push(dir);
            }
        } catch (_) { /* ignore */ }
    }
    if (!valid.length) {
        const fallback = candidates.find(Boolean);
        return path.resolve(String(fallback || process.cwd()).trim());
    }
    if (valid.length === 1) return valid[0];
    let best = valid[0];
    let bestScore = countLibraryDesigns(best);
    for (let i = 1; i < valid.length; i += 1) {
        const dir = valid[i];
        const score = countLibraryDesigns(dir);
        if (score > bestScore) {
            best = dir;
            bestScore = score;
        }
    }
    return best;
}

async function chmodWritable(targetPath) {
    try {
        await fsp.chmod(targetPath, 0o666);
    } catch (_) {
        try { await fsp.chmod(targetPath, 0o777); } catch (_2) { /* ignore */ }
    }
}

async function chmodTreeWritable(targetPath) {
    let st;
    try {
        st = await fsp.stat(targetPath);
    } catch (_) {
        return;
    }
    await chmodWritable(targetPath);
    if (!st.isDirectory()) return;
    let entries = [];
    try {
        entries = await fsp.readdir(targetPath, { withFileTypes: true });
    } catch (_) {
        return;
    }
    for (const ent of entries) {
        await chmodTreeWritable(path.join(targetPath, ent.name));
    }
}

async function removeFileRobust(filePath, { attempts = 4, delayMs = 120 } = {}) {
    for (let i = 0; i < attempts; i += 1) {
        try {
            await fsp.unlink(filePath);
            return { ok: true };
        } catch (err) {
            if (err.code === 'ENOENT') return { ok: true, missing: true };
            if (i < attempts - 1 && isLockedFsError(err)) {
                await chmodWritable(filePath);
                await sleep(delayMs * (i + 1));
                continue;
            }
            return { ok: false, locked: isLockedFsError(err), error: err };
        }
    }
    return { ok: false, locked: true, error: new Error('remove failed') };
}

async function removeDirRobust(dirPath, { attempts = 4, delayMs = 150 } = {}) {
    for (let i = 0; i < attempts; i += 1) {
        try {
            await fsp.rm(dirPath, RM_OPTS);
            return { ok: true };
        } catch (err) {
            if (err.code === 'ENOENT') return { ok: true, missing: true };
            if (i < attempts - 1 && isLockedFsError(err)) {
                await chmodTreeWritable(dirPath);
                try {
                    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
                    for (const ent of entries) {
                        const child = path.join(dirPath, ent.name);
                        if (ent.isDirectory()) {
                            await removeDirRobust(child, { attempts: 2, delayMs });
                        } else {
                            await removeFileRobust(child, { attempts: 2, delayMs });
                        }
                    }
                } catch (_) { /* ignore */ }
                await sleep(delayMs * (i + 1));
                continue;
            }
            return { ok: false, locked: isLockedFsError(err), error: err };
        }
    }
    return { ok: false, locked: true, error: new Error('remove failed') };
}

async function removePathRobust(targetPath, opts) {
    let st;
    try {
        st = await fsp.stat(targetPath);
    } catch (err) {
        if (err.code === 'ENOENT') return { ok: true, missing: true };
        return { ok: false, locked: isLockedFsError(err), error: err };
    }
    if (st.isDirectory()) return removeDirRobust(targetPath, opts);
    return removeFileRobust(targetPath, opts);
}

function formatLibraryFsErrorAr(err, targetPath) {
    const code = String(err?.code || '').toUpperCase();
    const base = path.basename(String(targetPath || ''));
    if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
        return `تعذّر حذف «${base}» — الملف قيد الاستخدام أو محمي. أغلق أي برنامج يعرض الصورة ثم أعد المحاولة.`;
    }
    if (code === 'ENOENT') {
        return `«${base}» غير موجود على القرص.`;
    }
    const raw = String(err?.message || 'خطأ غير معروف');
    if (/permission denied/i.test(raw) || /^eperm/i.test(raw)) {
        return `تعذّر حذف «${base}» — صلاحيات الوصول مرفوضة. أغلق البرامج التي تستخدم الملفات وأعد المحاولة.`;
    }
    return `تعذّر حذف «${base}» — ${raw}`;
}

function buildLibraryDeleteMessageAr({ deleted = 0, locked = 0, notFound = 0 } = {}) {
    if (locked > 0 && deleted > 0) {
        return `تم حذف ${deleted} تصميم — تعذّر حذف ${locked} (ملفات مقفلة أو قيد الاستخدام)`;
    }
    if (locked > 0 && deleted === 0) {
        return `تعذّر الحذف — ${locked} ملف/مجلد مقفل. أغلق معاينة الصور أو أي برنامج يعرض التصاميم ثم أعد المحاولة.`;
    }
    if (notFound > 0 && deleted > 0) {
        return `تم حذف ${deleted} تصميم (${notFound} غير موجود على القرص)`;
    }
    if (deleted > 0) {
        return `تم حذف ${deleted} تصميم`;
    }
    return 'لم يُحذف أي تصميم';
}

module.exports = {
    sleep,
    isLockedFsError,
    countLibraryDesigns,
    resolveNhpProjectRoot,
    removePathRobust,
    removeFileRobust,
    removeDirRobust,
    formatLibraryFsErrorAr,
    buildLibraryDeleteMessageAr
};
