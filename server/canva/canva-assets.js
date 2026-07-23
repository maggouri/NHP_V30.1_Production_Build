'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getCanvaConfig } = require('./canva-config');
const { getValidAccessToken } = require('./canva-oauth');

const ASSET_UPLOAD_POLL_MS = 1500;
const ASSET_UPLOAD_MAX_WAIT_MS = 60000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeAssetName(name) {
    const base = path.basename(String(name || 'design.png'));
    return base.slice(0, 50) || 'design.png';
}

function encodeAssetUploadMetadata(name) {
    return JSON.stringify({
        name_base64: Buffer.from(sanitizeAssetName(name), 'utf8').toString('base64')
    });
}

async function canvaApiRequest(rootDir, token, method, apiPath, body, log) {
    const cfg = getCanvaConfig(rootDir);
    const url = `${cfg.apiBase}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
    };
    let payload;
    if (body && !(body instanceof Buffer)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    } else if (body instanceof Buffer) {
        headers['Content-Type'] = 'application/octet-stream';
        payload = body;
    }
    log(`Canva API ${method} ${apiPath}`, 'INFO');
    const res = await fetch(url, { method, headers, body: payload });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    if (!res.ok) {
        log(`Canva API error ${res.status}: ${text.slice(0, 400)}`, 'ERROR');
        throw new Error(data.message || data.error || `Canva API ${res.status}`);
    }
    return data;
}

async function canvaBinaryUploadRequest(rootDir, token, apiPath, buffer, extraHeaders, log) {
    const cfg = getCanvaConfig(rootDir);
    const url = `${cfg.apiBase}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/octet-stream',
        ...extraHeaders
    };
    log(`Canva API POST ${apiPath} (binary ${buffer.length} bytes)`, 'INFO');
    const res = await fetch(url, { method: 'POST', headers, body: buffer });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    if (!res.ok) {
        log(`Canva API error ${res.status}: ${text.slice(0, 400)}`, 'ERROR');
        throw new Error(data.message || data.error || `Canva API ${res.status}`);
    }
    return data;
}

function extractAssetIdFromJob(job) {
    return job?.asset?.id || job?.asset_id || null;
}

async function pollAssetUploadJob(rootDir, token, jobId, log) {
    const deadline = Date.now() + ASSET_UPLOAD_MAX_WAIT_MS;
    while (Date.now() < deadline) {
        const data = await canvaApiRequest(
            rootDir,
            token,
            'GET',
            `/asset-uploads/${encodeURIComponent(jobId)}`,
            null,
            log
        );
        const job = data?.job || data;
        const status = job?.status;
        if (status === 'success') {
            const assetId = extractAssetIdFromJob(job);
            if (!assetId) throw new Error('Canva asset upload succeeded but asset id missing');
            return assetId;
        }
        if (status === 'failed') {
            const code = job?.error?.code || 'import_failed';
            const message = job?.error?.message || 'Asset upload failed';
            throw new Error(`${code}: ${message}`);
        }
        await sleep(ASSET_UPLOAD_POLL_MS);
    }
    throw new Error('Canva asset upload timed out');
}

async function uploadAssetFromFile(rootDir, filePath, { name, log = () => {} } = {}) {
    const cfg = getCanvaConfig(rootDir);
    const fileName = name || path.basename(filePath);
    if (cfg.mockMode) {
        const assetId = `mock_asset_${crypto.randomBytes(6).toString('hex')}`;
        log(`Canva mock upload: ${fileName} → ${assetId}`, 'INFO');
        return { assetId, mockMode: true, fileName };
    }
    if (!fs.existsSync(filePath)) throw new Error('Design file not found on disk');
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) throw new Error('Design file is empty or unreadable');

    const token = await getValidAccessToken(rootDir, log);
    const buffer = fs.readFileSync(filePath);

    const init = await canvaBinaryUploadRequest(
        rootDir,
        token,
        '/asset-uploads',
        buffer,
        { 'Asset-Upload-Metadata': encodeAssetUploadMetadata(fileName) },
        log
    );

    const job = init?.job || init;
    const jobId = job?.id;
    let assetId = extractAssetIdFromJob(job);

    if (!assetId && jobId) {
        if (job?.status === 'in_progress' || !job?.status) {
            assetId = await pollAssetUploadJob(rootDir, token, jobId, log);
        } else if (job?.status === 'failed') {
            const code = job?.error?.code || 'import_failed';
            const message = job?.error?.message || 'Asset upload failed';
            throw new Error(`${code}: ${message}`);
        }
    }

    if (!assetId) throw new Error('Canva asset upload did not return asset id');
    log(`Canva asset uploaded: ${assetId}`, 'INFO');
    return { assetId, mockMode: false, fileName };
}

function formatCanvaUploadError(err) {
    const raw = String(err?.message || err || '');
    if (/unsupported content type/i.test(raw)) {
        return 'فشل رفع التصميم — Canva يتطلب رفع الملف كبيانات ثنائية (octet-stream). أعد تشغيل Ghost Server ثم أعد المحاولة.';
    }
    if (/file_too_big/i.test(raw)) {
        return 'حجم ملف التصميم كبير جداً لـ Canva — استخدم صورة أصغر.';
    }
    if (/import_failed/i.test(raw)) {
        return 'تعذّر استيراد الصورة إلى مكتبة Canva — تأكد أن الملف PNG أو JPEG صالح.';
    }
    if (/timed out/i.test(raw)) {
        return 'انتهت مهلة رفع التصميم إلى Canva — أعد المحاولة لاحقاً.';
    }
    if (/not found on disk|not found in library/i.test(raw)) {
        return 'ملف التصميم غير موجود على القرص — حدّث المكتبة ثم أعد المحاولة.';
    }
    if (/empty or unreadable/i.test(raw)) {
        return 'ملف التصميم فارغ أو تالف — اختر تصميماً آخر من المكتبة.';
    }
    return raw;
}

module.exports = {
    canvaApiRequest,
    uploadAssetFromFile,
    formatCanvaUploadError,
    encodeAssetUploadMetadata,
    sanitizeAssetName
};
