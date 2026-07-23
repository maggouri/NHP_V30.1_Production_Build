'use strict';

/**
 * Offline check: token exchange uses api.canva.com + Basic auth + PKCE fields.
 * Run: node server/canva/canva-oauth.mock-test.js
 */

const assert = require('assert');
const path = require('path');
const { CANVA_TOKEN_URL } = require('./canva-config');

const ROOT = path.resolve(__dirname, '../..');
const calls = [];

global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
            access_token: 'test_access',
            refresh_token: 'test_refresh',
            expires_in: 14400
        })
    };
};

const {
    buildAuthStartUrl,
    exchangeCodeForTokens,
    getPendingStorePath
} = require('./canva-oauth');

(async () => {
    process.env.CANVA_CLIENT_ID = 'OC-TESTCLIENTID';
    process.env.CANVA_CLIENT_SECRET = 'cnvcaTESTSECRET';
    process.env.CANVA_REDIRECT_URI = 'http://127.0.0.1:3019/api/canva/auth/callback';

    const start = buildAuthStartUrl(ROOT, () => {});
    assert.strictEqual(start.mockMode, false);
    assert.ok(start.authUrl.includes('www.canva.com/api/oauth/authorize'));
    assert.ok(start.authUrl.includes('code_challenge='));

    await exchangeCodeForTokens(ROOT, 'auth_code_xyz', () => {}, {
        codeVerifier: 'verifier_from_pending_store'
    });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, CANVA_TOKEN_URL);
    assert.strictEqual(calls[0].url, 'https://api.canva.com/rest/v1/oauth/token');
    assert.ok(calls[0].opts.headers.Authorization.startsWith('Basic '));
    assert.strictEqual(calls[0].opts.headers['Content-Type'], 'application/x-www-form-urlencoded');

    const body = calls[0].opts.body.toString();
    assert.ok(body.includes('grant_type=authorization_code'));
    assert.ok(body.includes('code=auth_code_xyz'));
    assert.ok(body.includes('code_verifier=verifier_from_pending_store'));
    assert.ok(body.includes('redirect_uri='));
    assert.ok(!body.includes('client_secret='), 'client_secret must not be in body when using Basic auth');

    console.log('canva-oauth.mock-test: OK');
    console.log('pending store:', getPendingStorePath(ROOT));
})().catch((err) => {
    console.error('canva-oauth.mock-test: FAIL', err.message);
    process.exit(1);
});
