'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { getCanvaConfig } = require('./canva-config');
const { getValidAccessToken } = require('./canva-oauth');
const { canvaApiRequest } = require('./canva-assets');

const PNG_COLOR_RGBA = 6;
const PNG_COLOR_GRAY_ALPHA = 4;
/** Near-black canvas / JPEG re-encode artifacts (was 12 — too strict for Canva exports). */
const EDGE_BLACK_THRESHOLD = 35;
const EDGE_WHITE_THRESHOLD = 248;
const EDGE_DOMINANCE_RATIO = 0.9;
/** 5000×5000 = 25M px; prior 20M cap skipped edge removal on standard Canva blanks. */
const MAX_EDGE_REMOVAL_PIXELS = 60_000_000;
const OPAQUE_ALPHA = 250;

function pngHasAlpha(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 26) return false;
    if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return false;
    const colorType = buf[25];
    if (colorType === PNG_COLOR_RGBA || colorType === PNG_COLOR_GRAY_ALPHA) return true;
    return buf.includes(Buffer.from('tRNS'));
}

function isPremiumExportError(err) {
    const text = String(err?.message || err || '').toLowerCase();
    return /license_required|premium|canva pro|transparent_background|export_quality|lossless|paid plan|subscription/i.test(text);
}

function isRetryableExportError(err) {
    const text = String(err?.message || err || '').toLowerCase();
    return isPremiumExportError(err) || /timed out|export job failed/i.test(text);
}

function buildTransparentPngFormat() {
    return {
        type: 'png',
        export_quality: 'pro',
        lossless: true,
        transparent_background: true
    };
}

function buildFallbackPngFormat() {
    return { type: 'png', lossless: true };
}

async function startExportJob(rootDir, designId, format, log) {
    const token = await getValidAccessToken(rootDir, log);
    const data = await canvaApiRequest(rootDir, token, 'POST', '/exports', {
        design_id: designId,
        format
    }, log);
    const exportId = data?.job?.id;
    if (!exportId) throw new Error('Canva export job id missing');
    log(`Canva export job started: ${exportId}`, 'INFO');
    return exportId;
}

async function exportDesignPng(rootDir, designId, { log = () => {} } = {}) {
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) {
        log(`Canva mock export design: ${designId}`, 'INFO');
        return { mockMode: true, exportId: `mock_export_${crypto.randomBytes(4).toString('hex')}` };
    }
    if (!designId) throw new Error('Canva design id required for export');

    try {
        const exportId = await startExportJob(rootDir, designId, buildTransparentPngFormat(), log);
        return { exportId, mockMode: false, exportMode: 'transparent_pro' };
    } catch (err) {
        if (!isPremiumExportError(err)) throw err;
        log(`Canva transparent Pro export unavailable (${err.message}) — retrying standard PNG`, 'INFO');
        const exportId = await startExportJob(rootDir, designId, buildFallbackPngFormat(), log);
        return { exportId, mockMode: false, exportMode: 'fallback_png' };
    }
}

function isEdgeBlackPixel(data, idx, threshold = EDGE_BLACK_THRESHOLD) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r <= threshold && g <= threshold && b <= threshold;
}

function isEdgeWhitePixel(data, idx, threshold = EDGE_WHITE_THRESHOLD) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r >= threshold && g >= threshold && b >= threshold;
}

function forEachEdgePixel(width, height, visit) {
    for (let x = 0; x < width; x += 1) {
        visit(x, 0);
        if (height > 1) visit(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
        visit(0, y);
        if (width > 1) visit(width - 1, y);
    }
}

function measureEdgeDominance(data, width, height, channels, isMatchPixel) {
    let match = 0;
    let total = 0;
    forEachEdgePixel(width, height, (x, y) => {
        total += 1;
        if (isMatchPixel(data, (y * width + x) * channels)) match += 1;
    });
    return { match, total, ratio: total ? match / total : 0 };
}

function pngBorderIsFullyOpaque(data, width, height, channels) {
    let found = false;
    forEachEdgePixel(width, height, (x, y) => {
        found = true;
        const a = data[(y * width + x) * channels + 3];
        if (a < OPAQUE_ALPHA) throw new Error('transparent_edge');
    });
    return found;
}

async function pngIsFullyOpaque(buf) {
    if (!pngHasAlpha(buf)) return true;
    try {
        const meta = await sharp(buf).metadata();
        const width = meta.width || 0;
        const height = meta.height || 0;
        if (!width || !height) return true;
        const { data, info } = await sharp(buf)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        return pngBorderIsFullyOpaque(data, info.width, info.height, info.channels);
    } catch (err) {
        if (err?.message === 'transparent_edge') return false;
        return true;
    }
}

function floodFillEdgeConnectedBackground(data, width, height, channels, isMatchPixel) {
    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;

    const trySeed = (x, y) => {
        const i = y * width + x;
        if (visited[i]) return;
        const idx = i * channels;
        if (!isMatchPixel(data, idx)) return;
        visited[i] = 1;
        queue[tail++] = i;
    };

    for (let x = 0; x < width; x += 1) {
        trySeed(x, 0);
        trySeed(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
        trySeed(0, y);
        trySeed(width - 1, y);
    }

    let removed = 0;
    while (head < tail) {
        const i = queue[head++];
        const idx = i * channels;
        data[idx + 3] = 0;
        removed += 1;

        const x = i % width;
        const y = (i / width) | 0;
        if (x > 0) {
            const ni = i - 1;
            if (!visited[ni] && isMatchPixel(data, ni * channels)) {
                visited[ni] = 1;
                queue[tail++] = ni;
            }
        }
        if (x < width - 1) {
            const ni = i + 1;
            if (!visited[ni] && isMatchPixel(data, ni * channels)) {
                visited[ni] = 1;
                queue[tail++] = ni;
            }
        }
        if (y > 0) {
            const ni = i - width;
            if (!visited[ni] && isMatchPixel(data, ni * channels)) {
                visited[ni] = 1;
                queue[tail++] = ni;
            }
        }
        if (y < height - 1) {
            const ni = i + width;
            if (!visited[ni] && isMatchPixel(data, ni * channels)) {
                visited[ni] = 1;
                queue[tail++] = ni;
            }
        }
    }

    return removed;
}

function runEdgeRemovalPasses(data, w, h, channels, { blackThreshold = EDGE_BLACK_THRESHOLD, log = () => {} } = {}) {
    const isBlack = (d, idx) => {
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];
        return r <= blackThreshold && g <= blackThreshold && b <= blackThreshold;
    };
    const blackDom = measureEdgeDominance(data, w, h, channels, isBlack);
    const whiteDom = measureEdgeDominance(data, w, h, channels, isEdgeWhitePixel);

    let blackRemoved = 0;
    let whiteRemoved = 0;
    if (blackDom.ratio >= EDGE_DOMINANCE_RATIO || blackDom.match > 0) {
        blackRemoved = floodFillEdgeConnectedBackground(data, w, h, channels, isBlack);
    }
    if (whiteDom.ratio >= EDGE_DOMINANCE_RATIO || whiteDom.match > 0) {
        whiteRemoved = floodFillEdgeConnectedBackground(data, w, h, channels, isEdgeWhitePixel);
    }

    if (blackDom.ratio >= EDGE_DOMINANCE_RATIO) {
        log(`Canva export: ${Math.round(blackDom.ratio * 100)}% edge pixels near-black`, 'INFO');
    }
    if (whiteDom.ratio >= EDGE_DOMINANCE_RATIO) {
        log(`Canva export: ${Math.round(whiteDom.ratio * 100)}% edge pixels near-white`, 'INFO');
    }

    return { blackRemoved, whiteRemoved, blackDom, whiteDom, blackThreshold };
}

async function removeEdgeConnectedBackground(inputBuf, { log = () => {} } = {}) {
    try {
        const meta = await sharp(inputBuf).metadata();
        const width = meta.width || 0;
        const height = meta.height || 0;
        const pixelCount = width * height;
        if (pixelCount > MAX_EDGE_REMOVAL_PIXELS) {
            log(`Canva export: skip edge removal for very large image (${width}×${height})`, 'INFO');
            return inputBuf;
        }

        const { data, info } = await sharp(inputBuf)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width: w, height: h, channels } = info;
        if (!w || !h || channels < 4) return inputBuf;

        let pass = runEdgeRemovalPasses(data, w, h, channels, { log });
        let { blackRemoved, whiteRemoved, blackDom } = pass;
        let removed = blackRemoved + whiteRemoved;

        if (removed === 0 && blackDom.ratio >= EDGE_DOMINANCE_RATIO) {
            log(`Canva export: retry edge removal with relaxed black threshold (${EDGE_BLACK_THRESHOLD + 15})`, 'INFO');
            pass = runEdgeRemovalPasses(data, w, h, channels, {
                blackThreshold: EDGE_BLACK_THRESHOLD + 15,
                log
            });
            blackRemoved = pass.blackRemoved;
            whiteRemoved = pass.whiteRemoved;
            removed = blackRemoved + whiteRemoved;
        }

        if (removed === 0) {
            log('Canva export: edge background removal found no pixels', 'INFO');
            return inputBuf;
        }

        const parts = [];
        if (blackRemoved > 0) parts.push(`${blackRemoved} black`);
        if (whiteRemoved > 0) parts.push(`${whiteRemoved} white`);
        log(`Canva export: removed ${removed} edge-connected background pixels (${parts.join(', ')})`, 'INFO');
        return sharp(data, { raw: { width: w, height: h, channels: 4 } })
            .png()
            .toBuffer();
    } catch (err) {
        log(`Canva export: edge background removal failed (${err.message}) — keeping original PNG`, 'WARN');
        return inputBuf;
    }
}

async function shouldRunEdgeRemoval(buf, { forceEdgeRemoval = false, log = () => {} } = {}) {
    if (forceEdgeRemoval) return true;
    if (!pngHasAlpha(buf)) return true;
    const fullyOpaque = await pngIsFullyOpaque(buf);
    if (fullyOpaque) {
        log('Canva export: PNG has alpha channel but no transparent pixels — running edge removal', 'INFO');
        return true;
    }
    return false;
}

async function ensureTransparentPng(buf, { log = () => {}, forceEdgeRemoval = false } = {}) {
    const hadAlphaChannel = pngHasAlpha(buf);
    const runRemoval = await shouldRunEdgeRemoval(buf, { forceEdgeRemoval, log });
    if (!runRemoval) {
        return { buffer: buf, hadNativeAlpha: true, bgRemovedLocally: false };
    }
    const processed = await removeEdgeConnectedBackground(buf, { log });
    const bgRemovedLocally = !processed.equals(buf);
    return {
        buffer: processed,
        hadNativeAlpha: hadAlphaChannel && !bgRemovedLocally,
        bgRemovedLocally
    };
}

async function safeEnsureTransparentPng(buf, options = {}) {
    try {
        return await ensureTransparentPng(buf, options);
    } catch (err) {
        const log = options.log || (() => {});
        log(`Canva export: transparency processing failed (${err.message}) — saving original PNG`, 'WARN');
        return { buffer: buf, hadNativeAlpha: pngHasAlpha(buf), bgRemovedLocally: false };
    }
}

/** 5000×5000 PNG exports can take 60–90s; default ~2 min at 2s intervals. */
async function pollExportAndDownload(rootDir, exportId, destPath, { log = () => {}, maxAttempts = 60, exportMode = null } = {}) {
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) {
        log(`Canva mock poll export skipped: ${exportId}`, 'INFO');
        return { downloaded: false, mockMode: true };
    }
    const token = await getValidAccessToken(rootDir, log);
    for (let i = 0; i < maxAttempts; i += 1) {
        const data = await canvaApiRequest(rootDir, token, 'GET', `/exports/${encodeURIComponent(exportId)}`, null, log);
        const job = data?.job || data;
        const state = String(job?.status || '').toLowerCase();
        if (state === 'success') {
            const urls = job?.urls;
            const downloadUrl = Array.isArray(urls) ? urls[0] : null;
            if (!downloadUrl) throw new Error('Canva export completed but no download URL');
            const res = await fetch(downloadUrl);
            if (!res.ok) throw new Error(`Canva export download failed (${res.status})`);
            let buf = Buffer.from(await res.arrayBuffer());
            const transparency = await safeEnsureTransparentPng(buf, {
                log,
                forceEdgeRemoval: exportMode === 'fallback_png'
            });
            buf = transparency.buffer;
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, buf);
            log(`Canva export downloaded → ${destPath} (nativeAlpha=${transparency.hadNativeAlpha}, localBgRemoval=${transparency.bgRemovedLocally})`, 'INFO');
            return {
                downloaded: true,
                filePath: destPath,
                hadNativeAlpha: transparency.hadNativeAlpha,
                bgRemovedLocally: transparency.bgRemovedLocally
            };
        }
        if (state === 'failed') {
            const err = job?.error || {};
            const code = err.code ? String(err.code) : '';
            const detail = err.message || code || 'Canva export job failed';
            const message = code ? `${code}: ${detail}` : detail;
            throw new Error(message);
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Canva export timed out');
}

async function exportAndDownloadDesignPng(rootDir, designId, destPath, { log = () => {} } = {}) {
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) {
        log(`Canva mock export design: ${designId}`, 'INFO');
        return { mockMode: true, downloaded: false, exportId: `mock_export_${crypto.randomBytes(4).toString('hex')}` };
    }
    if (!designId) throw new Error('Canva design id required for export');

    const attempts = [
        { format: buildTransparentPngFormat(), exportMode: 'transparent_pro', label: 'transparent Pro PNG' },
        { format: buildFallbackPngFormat(), exportMode: 'fallback_png', label: 'standard PNG' }
    ];
    let lastErr;
    for (let i = 0; i < attempts.length; i += 1) {
        const { format, exportMode, label } = attempts[i];
        try {
            const exportId = await startExportJob(rootDir, designId, format, log);
            const dl = await pollExportAndDownload(rootDir, exportId, destPath, { log, exportMode });
            return { ...dl, exportId, exportMode, mockMode: false };
        } catch (err) {
            lastErr = err;
            const canRetry = i < attempts.length - 1;
            if (canRetry && isRetryableExportError(err)) {
                log(`Canva ${label} export failed (${err.message}) — retrying`, 'INFO');
                continue;
            }
            throw err;
        }
    }
    throw lastErr || new Error('Canva export failed');
}

module.exports = {
    exportDesignPng,
    exportAndDownloadDesignPng,
    pollExportAndDownload,
    pngHasAlpha,
    pngIsFullyOpaque,
    ensureTransparentPng,
    safeEnsureTransparentPng,
    removeEdgeConnectedBackground
};
