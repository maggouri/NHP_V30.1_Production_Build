'use strict';

/**
 * Offline check: asset upload uses binary POST + Asset-Upload-Metadata header.
 * Run: node server/canva/canva-assets.mock-test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '../..');
const calls = [];
let pollCount = 0;

global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    const urlStr = String(url);

    if (urlStr.includes('/asset-uploads') && opts.method === 'POST') {
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                job: { id: 'job_test_123', status: 'in_progress' }
            })
        };
    }

    if (urlStr.includes('/asset-uploads/job_test_123') && opts.method === 'GET') {
        pollCount += 1;
        if (pollCount < 2) {
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    job: { id: 'job_test_123', status: 'in_progress' }
                })
            };
        }
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                job: {
                    id: 'job_test_123',
                    status: 'success',
                    asset: { id: 'asset_test_abc', type: 'image', name: 'design_1.png' }
                }
            })
        };
    }

    throw new Error(`Unexpected fetch: ${urlStr} ${opts.method}`);
};

const { encodeAssetUploadMetadata, sanitizeAssetName, uploadAssetFromFile } = require('./canva-assets');

(async () => {
    process.env.CANVA_CLIENT_ID = 'OC-TESTCLIENTID';
    process.env.CANVA_CLIENT_SECRET = 'cnvcaTESTSECRET';
    process.env.CANVA_REDIRECT_URI = 'http://127.0.0.1:3019/api/canva/auth/callback';

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canva-upload-test-'));
    const tmpFile = path.join(tmpDir, 'design_1.png');
    fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    const tokensPath = path.join(ROOT, 'temp_uploads', 'canva_tokens.json');
    fs.mkdirSync(path.dirname(tokensPath), { recursive: true });
    fs.writeFileSync(tokensPath, JSON.stringify({
        access_token: 'test_access_token',
        refresh_token: 'test_refresh',
        expires_at: Date.now() + 3600000
    }), 'utf8');

    const meta = JSON.parse(encodeAssetUploadMetadata('design_1.png'));
    assert.ok(meta.name_base64);
    assert.strictEqual(Buffer.from(meta.name_base64, 'base64').toString('utf8'), 'design_1.png');
    assert.strictEqual(sanitizeAssetName('a'.repeat(80) + '.png').length, 50);

    const result = await uploadAssetFromFile(ROOT, tmpFile, {
        name: 'design_1.png',
        log: () => {}
    });

    assert.strictEqual(result.assetId, 'asset_test_abc');
    assert.strictEqual(result.mockMode, false);

    const postCall = calls.find((c) => c.opts.method === 'POST');
    assert.ok(postCall, 'POST /asset-uploads expected');
    assert.strictEqual(postCall.opts.headers['Content-Type'], 'application/octet-stream');
    assert.ok(postCall.opts.headers['Asset-Upload-Metadata']);
    const headerMeta = JSON.parse(postCall.opts.headers['Asset-Upload-Metadata']);
    assert.ok(headerMeta.name_base64);
    assert.ok(Buffer.isBuffer(postCall.opts.body) || postCall.opts.body instanceof Uint8Array || typeof postCall.opts.body === 'object');

    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('canva-assets.mock-test: OK');
})().catch((err) => {
    console.error('canva-assets.mock-test: FAIL', err.message);
    process.exit(1);
});
