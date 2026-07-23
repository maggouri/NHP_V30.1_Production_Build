'use strict';

const fs = require('fs');
const path = require('path');
const { safeLibraryFileSegment } = require('./library-smart-rename');
const {
    parseLibraryDesignId,
    resolveLibraryDesignFileOnDisk,
    listSplitFilesFromMeta,
    libraryEntryHasImageFile
} = require('./library-design-files');

const ISSUE = {
    MISSING_FILE: 'MISSING_FILE',
    WRONG_FILENAME: 'WRONG_FILENAME',
    EMPTY_FILE: 'EMPTY_FILE',
    ORPHAN_INDEX: 'ORPHAN_INDEX',
    THUMB_MISMATCH: 'THUMB_MISMATCH',
    META_MISMATCH: 'META_MISMATCH'
};

const ISSUE_LABEL_AR = {
    MISSING_FILE: 'الملف مفقود على القرص',
    WRONG_FILENAME: 'اسم الملف في الفهرس لا يطابق القرص',
    EMPTY_FILE: 'ملف فارغ (0 بايت)',
    ORPHAN_INDEX: 'مجلد التخزين مفقود',
    THUMB_MISMATCH: 'رابط المصغّر يشير لملف غير موجود',
    META_MISMATCH: 'meta.json يشير لملف غير موجود'
};

function isLibraryStorageFolderName(name) {
    return /^(lib_|canva_)/i.test(String(name || ''));
}

function fileStatOnDisk(libDir, fileName) {
    const safe = safeLibraryFileSegment(fileName);
    if (!safe) return { exists: false, size: 0, safeName: '' };
    const fp = path.join(libDir, safe);
    try {
        if (!fs.existsSync(fp)) return { exists: false, size: 0, safeName: safe, filePath: fp };
        const st = fs.statSync(fp);
        if (!st.isFile()) return { exists: false, size: 0, safeName: safe, filePath: fp };
        return { exists: true, size: st.size, safeName: safe, filePath: fp };
    } catch (_) {
        return { exists: false, size: 0, safeName: safe, filePath: fp };
    }
}

function thumbUrlFileName(thumbUrl) {
    const raw = String(thumbUrl || '').trim();
    if (!raw) return '';
    const m = raw.match(/\/file\/([^/?#]+)/i);
    if (!m) return '';
    try {
        return decodeURIComponent(m[1]);
    } catch (_) {
        return m[1];
    }
}

function indexedStorageIds(index) {
    const out = new Set();
    for (const e of index || []) {
        if (e?.storageId) out.add(e.storageId);
        else if (e?.id) {
            const m = String(e.id).match(/^(.+)__d\d+$/i);
            out.add(m ? m[1] : e.id);
        }
    }
    return out;
}

function auditOneIndexEntry(libraryDir, entry, meta) {
    const issues = [];
    if (!entry?.id) return issues;

    const storageId = entry.storageId || String(entry.id).replace(/__d\d+$/i, '') || entry.id;
    const libDir = path.join(libraryDir, storageId);
    const parsed = parseLibraryDesignId(entry.id);

    if (!fs.existsSync(libDir)) {
        issues.push({
            type: ISSUE.ORPHAN_INDEX,
            id: entry.id,
            storageId,
            fileName: entry.fileName || '',
            messageAr: ISSUE_LABEL_AR.ORPHAN_INDEX,
            fixable: false
        });
        return issues;
    }

    const indexFile = entry.fileName || (parsed.designIndex ? `design_${parsed.designIndex}.png` : 'composite.png');
    const indexStat = fileStatOnDisk(libDir, indexFile);
    const resolved = resolveLibraryDesignFileOnDisk(libDir, parsed, entry, meta);
    const resolvedName = resolved.fileName;
    const resolvedStat = resolved.filePath ? fileStatOnDisk(libDir, resolvedName) : { exists: false, size: 0 };

    if (indexStat.exists && indexStat.size === 0) {
        issues.push({
            type: ISSUE.EMPTY_FILE,
            id: entry.id,
            storageId,
            fileName: indexStat.safeName,
            messageAr: ISSUE_LABEL_AR.EMPTY_FILE,
            fixable: false
        });
    } else if (!indexStat.exists) {
        if (resolvedStat.exists && resolvedStat.size > 0 && resolvedName && resolvedName !== indexStat.safeName) {
            issues.push({
                type: ISSUE.WRONG_FILENAME,
                id: entry.id,
                storageId,
                fileName: indexFile,
                actualFile: resolvedName,
                displayName: entry.displayName || entry.title || '',
                messageAr: ISSUE_LABEL_AR.WRONG_FILENAME,
                fixable: true,
                suggestedFileName: resolvedName
            });
        } else if (!resolvedStat.exists || resolvedStat.size === 0) {
            issues.push({
                type: ISSUE.MISSING_FILE,
                id: entry.id,
                storageId,
                fileName: indexFile,
                messageAr: ISSUE_LABEL_AR.MISSING_FILE,
                fixable: false
            });
        }
    }

    const thumbName = thumbUrlFileName(entry.thumbUrl);
    if (thumbName) {
        const thumbStat = fileStatOnDisk(libDir, thumbName);
        if (!thumbStat.exists || thumbStat.size === 0) {
            const fixName = resolvedStat.exists ? resolvedName : (indexStat.exists ? indexStat.safeName : '');
            issues.push({
                type: ISSUE.THUMB_MISMATCH,
                id: entry.id,
                storageId,
                fileName: thumbName,
                actualFile: fixName || null,
                messageAr: ISSUE_LABEL_AR.THUMB_MISMATCH,
                fixable: !!fixName,
                suggestedFileName: fixName || undefined
            });
        }
    }

    if (meta?.files && parsed.isDesign && parsed.designIndex) {
        const splitIdx = parsed.designIndex - 1;
        const metaSplits = (meta.files || []).filter((f) =>
            f.role === 'split'
            || /^design_\d+\.png$/i.test(f.name)
            || /^split_\d+\.png$/i.test(f.name)
        );
        const metaFile = metaSplits[splitIdx];
        if (metaFile?.name) {
            const metaStat = fileStatOnDisk(libDir, metaFile.name);
            if (!metaStat.exists || metaStat.size === 0) {
                const alt = resolvedStat.exists ? resolvedName : null;
                if (!issues.some((i) => i.type === ISSUE.WRONG_FILENAME && i.id === entry.id)) {
                    issues.push({
                        type: ISSUE.META_MISMATCH,
                        id: entry.id,
                        storageId,
                        fileName: metaFile.name,
                        actualFile: alt,
                        messageAr: ISSUE_LABEL_AR.META_MISMATCH,
                        fixable: !!alt,
                        suggestedFileName: alt || undefined
                    });
                }
            }
        }
    }

    if (!libraryEntryHasImageFile(libraryDir, entry) && !issues.length) {
        issues.push({
            type: ISSUE.MISSING_FILE,
            id: entry.id,
            storageId,
            fileName: indexFile,
            messageAr: ISSUE_LABEL_AR.MISSING_FILE,
            fixable: false
        });
    }

    return issues;
}

function auditLibraryIntegrity(libraryDir, {
    index = null,
    readMetaFn = null
} = {}) {
    const readMeta = typeof readMetaFn === 'function'
        ? readMetaFn
        : (libDir) => {
            const metaPath = path.join(libDir, 'meta.json');
            try {
                if (!fs.existsSync(metaPath)) return null;
                return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            } catch (_) {
                return null;
            }
        };

    let rawIndex = index;
    if (!Array.isArray(rawIndex)) {
        const indexPath = path.join(libraryDir, 'index.json');
        try {
            rawIndex = fs.existsSync(indexPath)
                ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
                : [];
        } catch (_) {
            rawIndex = [];
        }
    }
    if (!Array.isArray(rawIndex)) rawIndex = [];

    const issues = [];
    const brokenIds = new Set();
    const metaCache = new Map();

    for (const entry of rawIndex) {
        const storageId = entry?.storageId || String(entry?.id || '').replace(/__d\d+$/i, '');
        let meta = metaCache.get(storageId);
        if (meta === undefined && storageId) {
            const libDir = path.join(libraryDir, storageId);
            meta = fs.existsSync(libDir) ? readMeta(libDir) : null;
            metaCache.set(storageId, meta);
        }
        const entryIssues = auditOneIndexEntry(libraryDir, entry, meta);
        for (const issue of entryIssues) {
            issues.push(issue);
            brokenIds.add(issue.id);
        }
    }

    const orphanFolders = [];
    const indexed = indexedStorageIds(rawIndex);
    if (fs.existsSync(libraryDir)) {
        for (const ent of fs.readdirSync(libraryDir, { withFileTypes: true })) {
            if (!ent.isDirectory() || !isLibraryStorageFolderName(ent.name)) continue;
            if (!indexed.has(ent.name)) {
                orphanFolders.push({ storageId: ent.name, type: 'ORPHAN_DISK' });
            }
        }
    }

    const designEntries = rawIndex.filter((e) => e?.role === 'design' || e?.designIndex || /__d\d+$/i.test(String(e?.id || '')));
    const totalDesigns = designEntries.length || rawIndex.length;

    return {
        scannedAt: new Date().toISOString(),
        libraryDir,
        totalIndexEntries: rawIndex.length,
        totalDesigns,
        brokenCount: brokenIds.size,
        issueCount: issues.length,
        brokenIds: [...brokenIds],
        issues,
        orphanFolders,
        issueLabelsAr: ISSUE_LABEL_AR
    };
}

function repairLibraryIndexFromDisk(libraryDir, index, readMetaFn, { writeMeta = true } = {}) {
    if (!Array.isArray(index)) return { index: [], repaired: [], metaUpdated: [] };

    const readMeta = readMetaFn || ((libDir) => {
        const metaPath = path.join(libDir, 'meta.json');
        try {
            if (!fs.existsSync(metaPath)) return null;
            return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (_) {
            return null;
        }
    });

    const repaired = [];
    const metaUpdated = new Set();
    const byStorage = new Map();

    for (const entry of index) {
        const storageId = entry?.storageId || String(entry?.id || '').replace(/__d\d+$/i, '');
        if (!storageId) continue;
        if (!byStorage.has(storageId)) byStorage.set(storageId, []);
        byStorage.get(storageId).push(entry);
    }

    const nextIndex = index.map((entry) => ({ ...entry }));

    for (const [storageId, entries] of byStorage) {
        const libDir = path.join(libraryDir, storageId);
        if (!fs.existsSync(libDir)) continue;
        let meta = readMeta(libDir);
        let metaDirty = false;

        for (const entry of entries) {
            const idx = nextIndex.findIndex((e) => e.id === entry.id);
            if (idx < 0) continue;
            const row = nextIndex[idx];
            const parsed = parseLibraryDesignId(row.id);
            const resolved = resolveLibraryDesignFileOnDisk(libDir, parsed, row, meta);
            if (!resolved.filePath || !resolved.fileName) continue;

            const indexFile = row.fileName || '';
            const indexStat = fileStatOnDisk(libDir, indexFile);
            const needsFileFix = !indexStat.exists || indexStat.size === 0;
            const thumbName = thumbUrlFileName(row.thumbUrl);
            const thumbStat = thumbName ? fileStatOnDisk(libDir, thumbName) : { exists: true, size: 1 };
            const needsThumbFix = !thumbStat.exists || thumbStat.size === 0;

            if (!needsFileFix && !needsThumbFix) continue;

            row.fileName = resolved.fileName;
            row.thumbUrl = `/api/library/${storageId}/file/${encodeURIComponent(resolved.fileName)}`;
            nextIndex[idx] = row;
            repaired.push({
                id: row.id,
                storageId,
                fileName: resolved.fileName,
                displayName: row.displayName || row.title || ''
            });

            if (meta && parsed.designIndex) {
                const splits = (meta.files || []).filter((f) =>
                    f.role === 'split'
                    || /^design_\d+\.png$/i.test(f.name)
                    || /^split_\d+\.png$/i.test(f.name)
                );
                const splitIdx = parsed.designIndex - 1;
                if (splits[splitIdx]) {
                    const oldName = splits[splitIdx].name;
                    if (oldName !== resolved.fileName) {
                        splits[splitIdx].name = resolved.fileName;
                        splits[splitIdx].url = `/api/library/${storageId}/file/${encodeURIComponent(resolved.fileName)}`;
                        meta.files = (meta.files || []).map((f) => {
                            if (f === splits[splitIdx] || (f.role === 'split' && f.name === oldName)) {
                                return { ...f, name: resolved.fileName, url: splits[splitIdx].url };
                            }
                            return f;
                        });
                        if (Array.isArray(meta.displayNames) && meta.displayNames[splitIdx] === undefined) {
                            meta.displayNames[splitIdx] = row.displayName || '';
                        }
                        metaDirty = true;
                    }
                } else {
                    const diskSplits = listSplitFilesFromMeta(meta, libDir);
                    if (diskSplits[splitIdx]?.name !== resolved.fileName) {
                        if (!meta.files) meta.files = [];
                        meta.files.push({
                            name: resolved.fileName,
                            role: 'split',
                            url: `/api/library/${storageId}/file/${encodeURIComponent(resolved.fileName)}`,
                            displayName: row.displayName || ''
                        });
                        metaDirty = true;
                    }
                }
            }
        }

        if (metaDirty && writeMeta) {
            try {
                fs.writeFileSync(path.join(libDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
                metaUpdated.add(storageId);
            } catch (_) { /* ignore */ }
        }
    }

    return { index: nextIndex, repaired, metaUpdated: [...metaUpdated] };
}

function formatAuditTable(report) {
    const lines = [];
    lines.push('');
    lines.push('═'.repeat(72));
    lines.push(`  فحص سلامة مكتبة التصاميم — ${report.scannedAt}`);
    lines.push(`  ${report.brokenCount} تصاميم تالفة من ${report.totalDesigns} (مشاكل: ${report.issueCount})`);
    if (report.orphanFolders?.length) {
        lines.push(`  مجلدات يتيمة على القرص: ${report.orphanFolders.length}`);
    }
    lines.push('═'.repeat(72));
    if (!report.issues.length) {
        lines.push('  ✓ لا توجد مشاكل');
        lines.push('');
        return lines.join('\n');
    }
    const colId = 36;
    for (const issue of report.issues) {
        const idShort = String(issue.id).slice(0, colId).padEnd(colId);
        const detail = issue.actualFile
            ? `${issue.fileName} → ${issue.actualFile}`
            : (issue.fileName || '—');
        lines.push(`  ${idShort} ${issue.type.padEnd(16)} ${detail}`);
    }
    lines.push('');
    return lines.join('\n');
}

module.exports = {
    ISSUE,
    ISSUE_LABEL_AR,
    auditLibraryIntegrity,
    repairLibraryIndexFromDisk,
    formatAuditTable,
    isLibraryStorageFolderName
};
