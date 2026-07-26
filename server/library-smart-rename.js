'use strict';

const path = require('path');
const fs = require('fs');
const { chooseVisionModel } = require('./prompts/apparelDesignSystemPrompt');

const TIMEOUT_RENAME_MS = 22000;
const MAX_DISPLAY_NAME_LEN = 56;
const MAX_NOTE_ENTRIES = 60;

function extractJsonObject(text = '') {
    const value = String(text || '').trim();
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const source = fenced ? fenced[1] : value;
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch (_) {
        return null;
    }
}

function sanitizeDisplayName(value = '') {
    return String(value || '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_DISPLAY_NAME_LEN);
}

/** True for site/local technical ids that must never become niche display names. */
function isTechnicalLibraryTitle(value = '') {
    const s = String(value || '').trim();
    if (!s) return true;
    if (/^dsg_[a-z0-9]+(_\d+)?$/i.test(s)) return true;
    if (/^(lib_|canva_|gen_)[a-z0-9_]+(__d\d+|_d\d+)?$/i.test(s)) return true;
    if (/^(design|split|composite)(_\d+)?$/i.test(s)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
    if (/^live\s*sync$/i.test(s)) return true;
    return false;
}

/**
 * Human title for library rows — rejects raw site ids (dsg_…) / storage ids.
 * Prefer nicheName at the call site; this only cleans a candidate string.
 */
function sanitizeLibraryTitleCandidate(value = '') {
    const cleaned = sanitizeDisplayName(value);
    if (!cleaned || isTechnicalLibraryTitle(cleaned)) return '';
    return cleaned;
}

function parseRenameNoteContext(raw) {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed.slice(0, MAX_NOTE_ENTRIES).map((entry) => {
            if (typeof entry === 'string') {
                return { niche: entry.trim(), detail: '', source: 'current' };
            }
            const niche = String(entry?.niche || entry?.text || '').trim();
            const detail = String(entry?.detail || entry?.note || '').trim().slice(0, 180);
            const source = entry?.source === 'memory' ? 'memory' : 'current';
            return { niche, detail, source };
        }).filter((e) => e.niche);
    } catch (_) {
        return [];
    }
}

function noteContextPreferArabic(noteContext = []) {
    const texts = noteContext.map((n) => String(n?.niche || '').trim()).filter(Boolean);
    if (!texts.length) return false;
    const arabicCount = texts.filter((t) => /[\u0600-\u06FF]/.test(t)).length;
    return arabicCount >= Math.ceil(texts.length * 0.35);
}

function formatNoteContextBlock(noteContext = []) {
    if (!noteContext.length) return '(none)';
    const current = noteContext.filter((n) => n.source !== 'memory');
    const memory = noteContext.filter((n) => n.source === 'memory');
    const fmt = (items, label) => {
        if (!items.length) return '';
        const lines = items.map((item, i) => {
            const detail = item.detail ? `\n   note: ${item.detail}` : '';
            return `${i + 1}. ${label}: ${item.niche}${detail}`;
        }).join('\n');
        return lines;
    };
    const parts = [];
    const cur = fmt(current.length ? current : noteContext, 'niche');
    if (cur) parts.push(`PRIORITY 1 — Current Note niches:\n${cur}`);
    const mem = fmt(memory, 'niche');
    if (mem) parts.push(`PRIORITY 2 — Niche memory:\n${mem}`);
    return parts.join('\n\n') || '(none)';
}

function formatVisionBlock(vision) {
    if (!vision) return '(no vision analysis)';
    const lines = [
        `Subject: ${vision.subject || 'see reference'}`,
        `Mood: ${vision.mood || 'neutral'}`,
        vision.extractedText ? `Text on print: ${vision.extractedText}` : '',
        vision.colorMood ? `Color mood: ${vision.colorMood}` : '',
        vision.hasCharacter ? 'Character in print: yes' : 'Character in print: no'
    ].filter(Boolean);
    const styles = Array.isArray(vision.recommendedStyles) ? vision.recommendedStyles : [];
    if (styles.length) {
        lines.push(`Recommended styles (quadrants 1→4): ${styles.slice(0, 4).join(' | ')}`);
    }
    const poses = Array.isArray(vision.recommendedPoses) ? vision.recommendedPoses : [];
    if (poses.length) {
        lines.push(`Recommended poses (quadrants 1→4): ${poses.slice(0, 4).join(' | ')}`);
    }
    return lines.join('\n');
}

function buildLibraryBatchRenamePrompt({
    vision,
    noteContext = [],
    promptPreview = '',
    designCount = 4
}) {
    const preferAr = noteContextPreferArabic(noteContext);
    const lang = preferAr ? 'Arabic' : 'English';
    const notes = formatNoteContextBlock(noteContext);
    const visionBlock = formatVisionBlock(vision);
    return `You name print-on-demand t-shirt design thumbnails for a digital library (4 quadrants from one 2×2 grid).
Write short SEO-friendly display titles in ${lang} only.

Vision analysis (reuse — do not re-analyze images):
${visionBlock}

User generation prompt (preview):
${promptPreview || '(none)'}

Note section niches (if a niche clearly matches the design theme, weave its exact wording into the title):
${notes}

Return ONLY valid JSON:
{"names":["title for quadrant 1","title for quadrant 2","title for quadrant 3","title for quadrant 4"]}

Rules:
- Exactly ${designCount} strings in "names", one per quadrant (top-left → bottom-right).
- Each title max ${MAX_DISPLAY_NAME_LEN} characters, no file extension, no quotes inside titles.
- Unique within the batch; descriptive for POD/SEO (subject + style/mood).
- If Note niches fit, prefer matching niche text (character-for-character for the niche phrase when possible).
- No generic placeholders like "design 1" or "untitled".
- JSON only.`;
}

function parseLibraryRenameNamesPayload(raw, expectedCount) {
    const obj = extractJsonObject(raw);
    const names = Array.isArray(obj?.names) ? obj.names : [];
    return names
        .slice(0, expectedCount)
        .map((n) => sanitizeDisplayName(n))
        .filter(Boolean);
}

function buildFallbackLibraryNames(vision, count, preferAr) {
    const subject = sanitizeDisplayName(vision?.subject || 'Apparel Design') || 'Design';
    const textBit = vision?.extractedText
        ? sanitizeDisplayName(String(vision.extractedText).slice(0, 24))
        : '';
    const styles = Array.isArray(vision?.recommendedStyles) ? vision.recommendedStyles : [];
    const names = [];
    for (let i = 0; i < count; i += 1) {
        const style = sanitizeDisplayName(styles[i] || styles[0] || '');
        let base;
        if (preferAr) {
            base = textBit ? `${subject} ${textBit} ${i + 1}` : `${subject} ${i + 1}`;
        } else {
            base = style ? `${subject} ${style}` : `${subject} Variation ${i + 1}`;
        }
        names.push(sanitizeDisplayName(base) || `Design ${i + 1}`);
    }
    return names;
}

function ensureUniqueNames(names) {
    const seen = new Set();
    return names.map((name, i) => {
        let candidate = sanitizeDisplayName(name) || `Design ${i + 1}`;
        let suffix = 2;
        const base = candidate;
        while (seen.has(candidate.toLowerCase())) {
            candidate = sanitizeDisplayName(`${base} ${suffix}`);
            suffix += 1;
        }
        seen.add(candidate.toLowerCase());
        return candidate;
    });
}

/** Strip path separators / illegal Windows chars; keep Unicode letters (Arabic OK). */
function safeLibraryFileSegment(name) {
    return String(name || '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
        .replace(/\.\./g, '')
        .trim();
}

function sanitizeLibraryFileBase(displayName) {
    let base = sanitizeDisplayName(displayName)
        .replace(/\.+/g, '_')
        .slice(0, 80);
    return base || 'design';
}

function sanitizeLibraryFileName(displayName) {
    return `${sanitizeLibraryFileBase(displayName)}.png`;
}

function listSplitFileEntries(meta) {
    return (meta?.files || []).filter((f) =>
        f.role === 'split'
        || /^design_\d+\.png$/i.test(f.name)
        || /^split_\d+\.png$/i.test(f.name)
    );
}

function resolveDesignOldFileName(parsed, indexEntry, meta) {
    if (indexEntry?.fileName) return safeLibraryFileSegment(indexEntry.fileName);
    if (parsed.isDesign && parsed.designIndex) {
        const splits = listSplitFileEntries(meta);
        const entry = splits[parsed.designIndex - 1];
        if (entry?.name) return safeLibraryFileSegment(entry.name);
        return `design_${parsed.designIndex}.png`;
    }
    const composite = meta?.compositeFilename || parsed.fileName || 'composite.png';
    return safeLibraryFileSegment(composite) || 'composite.png';
}

function pickUniqueLibraryFileName(libDir, desiredFileName, excludeFilePath = null, usedNames = null) {
    const ext = path.extname(desiredFileName).toLowerCase() || '.png';
    let stem = path.basename(desiredFileName, path.extname(desiredFileName));
    let candidate = safeLibraryFileSegment(`${stem}${ext}`) || 'design.png';
    let suffix = 2;
    const excluded = excludeFilePath ? path.resolve(excludeFilePath) : null;
    while (true) {
        const fp = path.join(libDir, candidate);
        const takenByDisk = fs.existsSync(fp) && (!excluded || path.resolve(fp) !== excluded);
        const takenByBatch = usedNames && usedNames.has(candidate.toLowerCase());
        if (!takenByDisk && !takenByBatch) {
            usedNames?.add(candidate.toLowerCase());
            return candidate;
        }
        candidate = safeLibraryFileSegment(`${stem}_${suffix}${ext}`) || `design_${suffix}.png`;
        suffix += 1;
    }
}

function renameLibraryDesignFileOnDisk(libDir, oldFileName, displayName, usedNames = null) {
    const safeOld = safeLibraryFileSegment(oldFileName);
    if (!safeOld) return { renamed: false, fileName: oldFileName };
    const oldPath = path.join(libDir, safeOld);
    if (!fs.existsSync(oldPath)) {
        return { renamed: false, fileName: safeOld };
    }
    const desired = sanitizeLibraryFileName(displayName);
    const newName = pickUniqueLibraryFileName(libDir, desired, oldPath, usedNames);
    if (safeOld === newName) {
        return { renamed: false, fileName: newName };
    }
    fs.renameSync(oldPath, path.join(libDir, newName));
    return { renamed: true, fileName: newName, oldFileName: safeOld };
}

function libraryFileUrl(storageId, fileName) {
    return `/api/library/${storageId}/file/${encodeURIComponent(fileName)}`;
}

function parseDesignIdForResolve(rawId) {
    const id = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const match = id.match(/^(.+)__d(\d+)$/i);
    if (match) {
        return {
            id,
            storageId: match[1],
            designIndex: parseInt(match[2], 10),
            isDesign: true
        };
    }
    return { id, storageId: id, designIndex: 0, isDesign: false };
}

/** Resolve niche identity from library index/meta (follows originalDesignId one level). */
function resolveLibraryNicheFromId(rawId, { readLibraryIndex, readLibraryMeta, libraryDir } = {}) {
    const parsed = parseDesignIdForResolve(rawId);
    const id = String(rawId || '').trim();
    if (!id || typeof readLibraryIndex !== 'function') {
        return { nicheName: '', nicheId: '' };
    }

    const index = readLibraryIndex();
    const entry = index.find((e) => e.id === parsed.id || e.id === id);
    const libDir = path.join(libraryDir || '', parsed.storageId);
    const meta = typeof readLibraryMeta === 'function' ? readLibraryMeta(libDir) : null;

    const nicheName = sanitizeLibraryTitleCandidate(
        entry?.nicheName || entry?.niche || meta?.nicheName || meta?.niche || ''
    ) || sanitizeDisplayName(
        entry?.nicheName || entry?.niche || meta?.nicheName || meta?.niche || ''
    );
    const nicheId = String(entry?.nicheId || meta?.nicheId || '').trim();
    if (nicheName || nicheId) {
        return { nicheName: nicheName || '', nicheId };
    }

    // Fall back to human display title on the original (still better than canva_/timestamp stems).
    const displayFallback = sanitizeLibraryTitleCandidate(
        entry?.displayName || entry?.title || meta?.displayName || meta?.promptPreview || ''
    );
    if (displayFallback) {
        return { nicheName: displayFallback, nicheId: '' };
    }

    const origId = String(entry?.originalDesignId || meta?.originalDesignId || '').trim();
    if (origId && origId !== id && origId !== parsed.id) {
        return resolveLibraryNicheFromId(origId, { readLibraryIndex, readLibraryMeta, libraryDir });
    }
    return { nicheName: '', nicheId: '' };
}

/** Resolve displayName from library index/meta (follows originalDesignId chain one level). */
function resolveLibraryDisplayNameFromId(rawId, { readLibraryIndex, readLibraryMeta, libraryDir } = {}) {
    const niche = resolveLibraryNicheFromId(rawId, { readLibraryIndex, readLibraryMeta, libraryDir });
    if (niche.nicheName) return niche.nicheName;

    const parsed = parseDesignIdForResolve(rawId);
    const id = String(rawId || '').trim();
    if (!id || typeof readLibraryIndex !== 'function') return '';

    const index = readLibraryIndex();
    const entry = index.find((e) => e.id === parsed.id || e.id === id);
    if (entry?.displayName) {
        const dn = sanitizeLibraryTitleCandidate(entry.displayName) || sanitizeDisplayName(entry.displayName);
        if (dn) return dn;
    }
    if (entry?.title) {
        const t = sanitizeLibraryTitleCandidate(entry.title) || sanitizeDisplayName(entry.title);
        if (t) return t;
    }

    const libDir = path.join(libraryDir || '', parsed.storageId);
    const meta = typeof readLibraryMeta === 'function' ? readLibraryMeta(libDir) : null;
    if (meta?.displayName) {
        const dn = sanitizeLibraryTitleCandidate(meta.displayName) || sanitizeDisplayName(meta.displayName);
        if (dn) return dn;
    }
    if (parsed.isDesign && parsed.designIndex) {
        const di = parsed.designIndex - 1;
        if (Array.isArray(meta?.displayNames) && meta.displayNames[di]) {
            const dn = sanitizeLibraryTitleCandidate(meta.displayNames[di])
                || sanitizeDisplayName(meta.displayNames[di]);
            if (dn) return dn;
        }
        const splits = listSplitFileEntries(meta);
        if (splits[di]?.displayName) {
            const dn = sanitizeLibraryTitleCandidate(splits[di].displayName)
                || sanitizeDisplayName(splits[di].displayName);
            if (dn) return dn;
        }
    }
    if (meta?.promptPreview) {
        const p = sanitizeLibraryTitleCandidate(meta.promptPreview) || sanitizeDisplayName(meta.promptPreview);
        if (p) return p;
    }

    const origId = String(entry?.originalDesignId || meta?.originalDesignId || '').trim();
    if (origId && origId !== id && origId !== parsed.id) {
        const inherited = resolveLibraryDisplayNameFromId(origId, { readLibraryIndex, readLibraryMeta, libraryDir });
        if (inherited) return inherited;
    }
    return '';
}

/**
 * @param {object} deps
 */
function createLibrarySmartRename(deps) {
    const {
        fetchWithTimeout,
        mapCliProxyErrorMessageAr,
        logFn = () => {},
        readLibraryIndex,
        writeLibraryIndex,
        readLibraryMeta,
        libraryDir
    } = deps;

    const queue = [];
    let busy = false;
    let drainTimer = null;

    const log = (msg, level = 'INFO') => logFn(msg, level);

    async function callCliProxyTextRename({ baseUrl, apiKey, prompt }) {
        const model = chooseVisionModel();
        const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const body = JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'You output compact JSON only for library design titles.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 700,
            temperature: 0.35
        });
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body
        }, TIMEOUT_RENAME_MS, 'fetch', baseUrl);

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (_) {
            data = null;
        }
        if (!response.ok) {
            const rawMsg = data?.error?.message || data?.message || text || `Rename HTTP ${response.status}`;
            throw new Error(mapCliProxyErrorMessageAr(rawMsg, {}));
        }
        const content = data?.choices?.[0]?.message?.content;
        return typeof content === 'string'
            ? content
            : Array.isArray(content)
                ? content.map((c) => c?.text || '').join('')
                : '';
    }

    function applyDisplayNamesToStorageBatch(storageId, namesByIndex) {
        if (!storageId || !namesByIndex?.length) return 0;
        const libDir = path.join(libraryDir, storageId);
        const index = readLibraryIndex();
        const meta = readLibraryMeta(libDir);
        const splits = listSplitFileEntries(meta);
        const usedNames = new Set();
        let applied = 0;

        for (let i = 0; i < namesByIndex.length; i += 1) {
            const displayName = sanitizeDisplayName(namesByIndex[i]);
            if (!displayName) continue;
            const designId = `${storageId}__d${i + 1}`;
            const idx = index.findIndex((e) => e.id === designId);
            const parsed = {
                id: designId,
                storageId,
                designIndex: i + 1,
                isDesign: true
            };
            const oldFileName = resolveDesignOldFileName(parsed, idx >= 0 ? index[idx] : null, meta);
            const { fileName: newFileName } = renameLibraryDesignFileOnDisk(
                libDir,
                oldFileName,
                displayName,
                usedNames
            );
            if (idx >= 0) {
                index[idx].displayName = displayName;
                index[idx].title = displayName;
                index[idx].fileName = newFileName;
                index[idx].thumbUrl = libraryFileUrl(storageId, newFileName);
                applied += 1;
            }
            if (splits[i]) {
                splits[i].displayName = displayName;
                splits[i].name = newFileName;
                splits[i].url = libraryFileUrl(storageId, newFileName);
            }
        }

        if (applied > 0) writeLibraryIndex(index);

        if (meta) {
            meta.displayNames = namesByIndex.map((n) => sanitizeDisplayName(n)).filter(Boolean);
            meta.libraryRenameAt = new Date().toISOString();
            try {
                fs.writeFileSync(
                    path.join(libDir, 'meta.json'),
                    JSON.stringify(meta, null, 2),
                    'utf8'
                );
            } catch (err) {
                log(`Library rename meta write ${storageId}: ${err.message}`, 'WARN');
            }
        }
        return applied;
    }

    function patchSingleDesignDisplayName(parsed, displayName) {
        const safeName = sanitizeDisplayName(displayName);
        if (!safeName) return { ok: false, error: 'اسم غير صالح' };
        const index = readLibraryIndex();
        const idx = index.findIndex((e) => e.id === parsed.id);
        if (idx < 0) return { ok: false, notFound: true };

        const libDir = path.join(libraryDir, parsed.storageId);
        const meta = readLibraryMeta(libDir);
        const oldFileName = resolveDesignOldFileName(parsed, index[idx], meta);
        const { fileName: newFileName } = renameLibraryDesignFileOnDisk(
            libDir,
            oldFileName,
            safeName
        );

        index[idx].displayName = safeName;
        index[idx].title = safeName;
        index[idx].fileName = newFileName;
        index[idx].thumbUrl = libraryFileUrl(parsed.storageId, newFileName);
        writeLibraryIndex(index);

        if (meta) {
            meta.displayName = safeName;
            if (parsed.isDesign && parsed.designIndex) {
                const di = parsed.designIndex - 1;
                if (!Array.isArray(meta.displayNames)) meta.displayNames = [];
                meta.displayNames[di] = safeName;
                const splits = listSplitFileEntries(meta);
                if (splits[di]) {
                    splits[di].displayName = safeName;
                    splits[di].name = newFileName;
                    splits[di].url = libraryFileUrl(parsed.storageId, newFileName);
                }
            } else if (meta.files?.length) {
                const target = meta.files.find((f) => safeLibraryFileSegment(f.name) === safeLibraryFileSegment(oldFileName))
                    || meta.files.find((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
                if (target) {
                    target.name = newFileName;
                    target.url = libraryFileUrl(parsed.storageId, newFileName);
                }
                meta.displayName = safeName;
                meta.compositeFilename = newFileName;
            }
            try {
                fs.writeFileSync(path.join(libDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
            } catch (_) { /* ignore */ }
        }
        return {
            ok: true,
            id: parsed.id,
            displayName: safeName,
            fileName: newFileName,
            thumbUrl: libraryFileUrl(parsed.storageId, newFileName)
        };
    }

    async function renameStorageBatch(task) {
        const {
            storageId,
            vision,
            noteContext = [],
            promptPreview = '',
            forcedDisplayName = '',
            baseUrl,
            apiKey
        } = task;

        const libDir = path.join(libraryDir, storageId);
        const meta = readLibraryMeta(libDir);
        const splits = (meta?.files || []).filter((f) =>
            f.role === 'split'
            || /^design_\d+\.png$/i.test(f.name)
            || /^split_\d+\.png$/i.test(f.name)
        );
        const designCount = splits.length || 4;
        const forced = sanitizeDisplayName(forcedDisplayName);

        if (forced) {
            const index = readLibraryIndex();
            const splits = listSplitFileEntries(meta);
            const designCount = splits.length || 4;
            let applied = 0;
            for (let i = 0; i < designCount; i += 1) {
                const designId = `${storageId}__d${i + 1}`;
                const idx = index.findIndex((e) => e.id === designId);
                if (idx >= 0) {
                    index[idx].displayName = forced;
                    index[idx].title = forced;
                    applied += 1;
                }
                if (splits[i]) splits[i].displayName = forced;
            }
            if (applied > 0) writeLibraryIndex(index);
            if (meta) {
                meta.displayName = forced;
                meta.displayNames = Array.from({ length: designCount }, () => forced);
                meta.libraryRenameAt = new Date().toISOString();
                try {
                    fs.writeFileSync(
                        path.join(libDir, 'meta.json'),
                        JSON.stringify(meta, null, 2),
                        'utf8'
                    );
                } catch (_) { /* ignore */ }
            }
            log(`Library rename ${storageId}: forced niche title "${forced}" (${applied}/${designCount})`);
            return { storageId, applied, names: [forced] };
        }

        const storedVision = vision || meta?.vision || null;
        const storedNotes = noteContext.length ? noteContext : (meta?.noteContext || []);
        const preview = promptPreview || meta?.promptPreview || '';

        let names = [];
        try {
            const prompt = buildLibraryBatchRenamePrompt({
                vision: storedVision,
                noteContext: storedNotes,
                promptPreview: preview,
                designCount
            });
            const raw = await callCliProxyTextRename({ baseUrl, apiKey, prompt });
            names = parseLibraryRenameNamesPayload(raw, designCount);
        } catch (err) {
            log(`Library rename AI ${storageId}: ${err.message}`, 'WARN');
        }

        if (names.length < designCount) {
            const preferAr = noteContextPreferArabic(storedNotes);
            const fallback = buildFallbackLibraryNames(storedVision, designCount, preferAr);
            while (names.length < designCount) {
                names.push(fallback[names.length] || `Design ${names.length + 1}`);
            }
        }
        names = ensureUniqueNames(names.slice(0, designCount));
        const applied = applyDisplayNamesToStorageBatch(storageId, names);
        log(`Library rename ${storageId}: applied ${applied}/${designCount} titles`);
        return { storageId, applied, names };
    }

    async function drainQueue() {
        if (busy) return;
        busy = true;
        try {
            while (queue.length) {
                const task = queue.shift();
                try {
                    if (task.type === 'job-complete' && Array.isArray(task.libraryIds)) {
                        for (const storageId of task.libraryIds) {
                            await renameStorageBatch({
                                storageId,
                                vision: task.vision,
                                noteContext: task.noteContext || [],
                                promptPreview: task.promptPreview || '',
                                forcedDisplayName: task.forcedDisplayName || '',
                                baseUrl: task.baseUrl,
                                apiKey: task.apiKey
                            });
                        }
                        if (task.metaPath && fs.existsSync(task.metaPath)) {
                            try {
                                const meta = JSON.parse(fs.readFileSync(task.metaPath, 'utf8'));
                                meta.libraryRenameStatus = 'done';
                                meta.libraryRenameAt = new Date().toISOString();
                                fs.writeFileSync(task.metaPath, JSON.stringify(meta, null, 2), 'utf8');
                            } catch (_) { /* ignore */ }
                        }
                    } else if (task.type === 'storage-ids' && Array.isArray(task.storageIds)) {
                        for (const storageId of task.storageIds) {
                            await renameStorageBatch({
                                storageId,
                                vision: task.vision || null,
                                noteContext: task.noteContext || [],
                                promptPreview: task.promptPreview || '',
                                baseUrl: task.baseUrl,
                                apiKey: task.apiKey
                            });
                        }
                    } else if (task.type === 'storage-batch') {
                        await renameStorageBatch(task);
                    }
                } catch (err) {
                    log(`Library rename task failed: ${err.message}`, 'WARN');
                    if (task.metaPath && fs.existsSync(task.metaPath)) {
                        try {
                            const meta = JSON.parse(fs.readFileSync(task.metaPath, 'utf8'));
                            meta.libraryRenameStatus = 'failed';
                            meta.libraryRenameError = String(err.message || '').slice(0, 200);
                            fs.writeFileSync(task.metaPath, JSON.stringify(meta, null, 2), 'utf8');
                        } catch (_) { /* ignore */ }
                    }
                }
            }
        } finally {
            busy = false;
        }
    }

    function enqueue(task) {
        queue.push(task);
        if (drainTimer) return;
        drainTimer = setTimeout(() => {
            drainTimer = null;
            void drainQueue();
        }, 80);
    }

    function groupDesignIdsToStorageIds(designIds) {
        const storageIds = new Set();
        for (const rawId of designIds) {
            const id = String(rawId || '').trim();
            if (!id) continue;
            const m = id.match(/^(.+)__d\d+$/i);
            storageIds.add(m ? m[1] : id);
        }
        return [...storageIds];
    }

    return {
        enqueue,
        renameStorageBatch,
        applyDisplayNamesToStorageBatch,
        patchSingleDesignDisplayName,
        groupDesignIdsToStorageIds,
        parseRenameNoteContext,
        buildLibraryBatchRenamePrompt,
        sanitizeDisplayName,
        sanitizeLibraryFileName,
        resolveLibraryDisplayNameFromId: (rawId) => resolveLibraryDisplayNameFromId(rawId, {
            readLibraryIndex,
            readLibraryMeta,
            libraryDir
        }),
        resolveLibraryNicheFromId: (rawId) => resolveLibraryNicheFromId(rawId, {
            readLibraryIndex,
            readLibraryMeta,
            libraryDir
        })
    };
}

module.exports = {
    createLibrarySmartRename,
    parseRenameNoteContext,
    sanitizeDisplayName,
    sanitizeLibraryTitleCandidate,
    isTechnicalLibraryTitle,
    sanitizeLibraryFileName,
    safeLibraryFileSegment,
    resolveLibraryDisplayNameFromId,
    resolveLibraryNicheFromId
};
