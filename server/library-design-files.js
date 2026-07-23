'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { safeLibraryFileSegment } = require('./library-smart-rename');

const DESIGN_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const COMPOSITE_GRID_SLOTS = 4;

function parseLibraryDesignId(rawId) {
    const id = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const match = id.match(/^(.+)__d(\d+)$/i) || id.match(/^(.+)_d(\d+)$/i);
    if (match) {
        const designIndex = parseInt(match[2], 10);
        return {
            id,
            storageId: match[1],
            designIndex,
            fileName: `design_${designIndex}.png`,
            isDesign: true
        };
    }
    return { id, storageId: id, designIndex: 0, fileName: 'composite.png', isDesign: false };
}

function pushLibraryFileCandidate(list, name) {
    const safe = safeLibraryFileSegment(name);
    if (safe && !list.includes(safe)) list.push(safe);
}

function pushUniqueFileName(list, name) {
    pushLibraryFileCandidate(list, name);
}

async function splitCompositeBufferToPngs(buffer) {
    const meta = await sharp(buffer).metadata();
    const w = meta.width || 1024;
    const h = meta.height || 1024;
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    const rects = [
        { left: 0, top: 0, width: halfW, height: halfH },
        { left: halfW, top: 0, width: halfW, height: halfH },
        { left: 0, top: halfH, width: halfW, height: halfH },
        { left: halfW, top: halfH, width: halfW, height: halfH }
    ];
    const splits = [];
    for (let i = 0; i < rects.length; i += 1) {
        const part = await sharp(buffer).extract(rects[i]).png().toBuffer();
        splits.push({ name: `design_${i + 1}.png`, buffer: part });
    }
    return splits;
}

function compositePathInLibDir(libDir) {
    const fp = path.join(libDir, 'composite.png');
    return fs.existsSync(fp) ? fp : null;
}

function designFileExists(libDir, designIndex) {
    const idx = designIndex || 1;
    for (const ext of DESIGN_IMAGE_EXTS) {
        const name = `design_${idx}${ext}`;
        const fp = path.join(libDir, name);
        try {
            if (fs.existsSync(fp) && fs.statSync(fp).isFile() && fs.statSync(fp).size > 0) {
                return name;
            }
        } catch (_) { /* ignore */ }
    }
    const splitName = `split_${idx}.png`;
    const splitPath = path.join(libDir, splitName);
    try {
        if (fs.existsSync(splitPath) && fs.statSync(splitPath).size > 0) {
            return splitName;
        }
    } catch (_) { /* ignore */ }
    return null;
}

/** Write design_1..4 from composite.png when individual splits are missing. */
async function ensureLibraryDesignSplitsOnDisk(libDir) {
    if (!libDir || !fs.existsSync(libDir)) return { ok: false, written: [] };
    const compositePath = compositePathInLibDir(libDir);
    if (!compositePath) return { ok: false, written: [] };

    const missing = [];
    for (let i = 1; i <= COMPOSITE_GRID_SLOTS; i += 1) {
        if (!designFileExists(libDir, i)) missing.push(i);
    }
    if (!missing.length) return { ok: true, written: [] };

    const compositeBuf = fs.readFileSync(compositePath);
    const splits = await splitCompositeBufferToPngs(compositeBuf);
    const written = [];
    for (const s of splits) {
        const fp = path.join(libDir, s.name);
        if (!fs.existsSync(fp)) {
            fs.writeFileSync(fp, s.buffer);
            written.push(s.name);
        }
    }
    return { ok: true, written };
}

function buildDesignFileCandidates(parsed, indexEntry, meta, fileNameHint = '') {
    const candidates = [];
    if (fileNameHint) pushUniqueFileName(candidates, fileNameHint);
    if (indexEntry?.fileName) pushUniqueFileName(candidates, indexEntry.fileName);
    pushUniqueFileName(candidates, parsed.fileName);

    const designIdx = parsed.designIndex || 1;
    if (parsed.isDesign) {
        for (const ext of DESIGN_IMAGE_EXTS) {
            pushUniqueFileName(candidates, `design_${designIdx}${ext}`);
            pushUniqueFileName(candidates, `split_${designIdx}${ext}`);
        }
        return candidates;
    }

    for (const ext of DESIGN_IMAGE_EXTS) {
        pushUniqueFileName(candidates, `composite${ext}`);
    }
    if (meta?.files) {
        for (const f of meta.files) {
            if (f?.name && /\.(png|jpe?g|webp)$/i.test(f.name)) {
                pushUniqueFileName(candidates, f.name);
            }
        }
    }
    return candidates;
}

function pickFirstExistingFile(libDir, candidates) {
    for (const name of candidates) {
        const filePath = path.join(libDir, name);
        try {
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                if (stat.isFile() && stat.size > 0) {
                    return { filePath, fileName: name };
                }
            }
        } catch (_) { /* ignore */ }
    }
    return { filePath: null, fileName: null };
}

function resolveLibraryDesignFileOnDisk(libDir, parsed, indexEntry = null, meta = null, fileNameHint = '') {
    const candidates = buildDesignFileCandidates(parsed, indexEntry, meta, fileNameHint);
    const hit = pickFirstExistingFile(libDir, candidates);
    if (hit.filePath) return hit;
    return { filePath: null, fileName: parsed.fileName };
}

async function resolveLibraryDesignFilePath(libDir, libraryId, {
    indexEntry = null,
    meta = null,
    fileNameHint = ''
} = {}) {
    const parsed = parseLibraryDesignId(libraryId);
    if (!fs.existsSync(libDir)) {
        throw new Error('Design file not found in library');
    }
    if (parsed.isDesign) {
        await ensureLibraryDesignSplitsOnDisk(libDir);
    }
    const hit = resolveLibraryDesignFileOnDisk(libDir, parsed, indexEntry, meta, fileNameHint);
    if (hit.filePath) {
        return { filePath: hit.filePath, fileName: hit.fileName, parsed: { ...parsed, fileName: hit.fileName } };
    }
    if (parsed.isDesign) {
        throw new Error(`تصميم ${parsed.designIndex} غير موجود — لا يمكن استخدام الصورة المركبة`);
    }
    const compositeHit = pickFirstExistingFile(libDir, ['composite.png']);
    if (compositeHit.filePath) {
        return { filePath: compositeHit.filePath, fileName: compositeHit.fileName, parsed };
    }
    throw new Error('Design file not found in library');
}

function listSplitFilesFromMeta(meta, libDir = null) {
    const fromMeta = (meta?.files || []).filter((f) =>
        f.role === 'split'
        || /^design_\d+\.png$/i.test(f.name)
        || /^split_\d+\.png$/i.test(f.name)
    );
    if (fromMeta.length) return fromMeta;
    if (!libDir || !fs.existsSync(libDir)) return [];
    try {
        const names = fs.readdirSync(libDir).filter((n) =>
            /\.(png|jpe?g|webp)$/i.test(n) && !/^thumb\./i.test(n)
        );
        const designs = names.filter((n) => /^design_\d+\.png$/i.test(n)).sort((a, b) => {
            const ai = parseInt(a.match(/\d+/)?.[0] || '0', 10);
            const bi = parseInt(b.match(/\d+/)?.[0] || '0', 10);
            return ai - bi;
        });
        if (designs.length) {
            return designs.map((name) => ({ name, role: 'split' }));
        }
        if (names.includes('composite.png')) {
            return Array.from({ length: COMPOSITE_GRID_SLOTS }, (_, i) => ({
                name: `design_${i + 1}.png`,
                role: 'split'
            }));
        }
        if (names.length === 1) {
            return [{ name: names[0], role: 'split' }];
        }
    } catch (_) { /* ignore */ }
    return [];
}

function libraryEntryHasImageFile(libraryDir, item) {
    if (!item?.id) return false;
    const storageId = item.storageId || String(item.id).replace(/__d\d+$/i, '') || item.id;
    const libDir = path.join(libraryDir, storageId);
    if (!fs.existsSync(libDir)) return false;
    let fileName = item.fileName;
    if (!fileName && item.designIndex) fileName = `design_${item.designIndex}.png`;
    if (!fileName) fileName = 'composite.png';
    const safe = safeLibraryFileSegment(fileName);
    const candidates = [safe];
    const splitMatch = safe.match(/^split_(\d+)\.png$/i);
    if (splitMatch) candidates.push(`design_${splitMatch[1]}.png`);
    const jsonMatch = safe.match(/^design_(\d+)\.json$/i);
    if (jsonMatch) candidates.push(`design_${jsonMatch[1]}.png`);
    const exists = () => candidates.some((name) => {
        try {
            return fs.existsSync(path.join(libDir, name));
        } catch (_) {
            return false;
        }
    });
    if (exists()) return true;
    if (item.designIndex && compositePathInLibDir(libDir)) return true;
    return exists();
}

function resolveLibraryFileOnDisk(libDir, requestedName, { designIndex = 0 } = {}) {
    const safeFile = safeLibraryFileSegment(requestedName);
    const candidates = [safeFile];
    const jsonMatch = safeFile.match(/^design_(\d+)\.json$/i);
    if (jsonMatch) candidates.push(`design_${jsonMatch[1]}.png`);
    const splitMatch = safeFile.match(/^split_(\d+)\.png$/i);
    if (splitMatch) candidates.push(`design_${splitMatch[1]}.png`);
    const designMatch = safeFile.match(/^design_(\d+)\.png$/i);
    if (designMatch) {
        candidates.push(`split_${designMatch[1]}.png`);
    }
    if (safeFile === 'composite.png') {
        candidates.push('design_1.png');
    }
    const hit = pickFirstExistingFile(libDir, candidates);
    if (hit.filePath) return hit;
    if (designIndex > 0 && compositePathInLibDir(libDir)) {
        return { filePath: null, fileName: safeFile, needsSplit: true };
    }
    return { filePath: null, fileName: safeFile };
}

module.exports = {
    DESIGN_IMAGE_EXTS,
    COMPOSITE_GRID_SLOTS,
    parseLibraryDesignId,
    splitCompositeBufferToPngs,
    ensureLibraryDesignSplitsOnDisk,
    buildDesignFileCandidates,
    resolveLibraryDesignFileOnDisk,
    resolveLibraryDesignFilePath,
    listSplitFilesFromMeta,
    libraryEntryHasImageFile,
    resolveLibraryFileOnDisk,
    pushLibraryFileCandidate,
    pushUniqueFileName
};
