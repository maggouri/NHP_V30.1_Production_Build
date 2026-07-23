/**
 * EP-301E — Lightweight performance smoke (weak-machine friendly)
 * Measures in-process API round-trip latency; no load testing.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('node:child_process');

const { registerMailboxLifecycleApi } = require('../../server/mailbox-lifecycle-api.js');

function createTestServer() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep301e-perf-'));
    const app = express();
    app.use(express.json());
    registerMailboxLifecycleApi(app, { rootDir, logFn: () => {} });
    const server = http.createServer(app);
    return { server, rootDir };
}

async function request(server, method, urlPath, { headers = {}, body, query } = {}) {
    const port = server.address().port;
    let url = `http://127.0.0.1:${port}${urlPath}`;
    if (query) {
        const qs = new URLSearchParams(query).toString();
        if (qs) url += `?${qs}`;
    }
    const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    await response.json().catch(() => ({}));
    return response.status;
}

test('API session + domains round-trip completes under 500ms locally', async (t) => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const headers = { 'x-creaty-token': 'tok_test' };
    const start = Date.now();
    await request(server, 'GET', '/api/mailbox-lifecycle/session', { headers, query: { userId: 'user_a' } });
    await request(server, 'GET', '/api/mailbox-lifecycle/domains', { headers, query: { userId: 'user_a' } });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2000, `Expected <2000ms on weak machine, got ${elapsed}ms`);
});

test('combined 301A–301D suite completes under 30s (informational smoke)', () => {
    const scripts = [
        'scripts/tests/ep301a-model-validation.test.js',
        'scripts/tests/ep301b-mailbox-lifecycle-api.test.js',
        'scripts/tests/ep301c-mailbox-lifecycle-ui.test.js',
        'scripts/tests/ep301d-permissions.test.js',
    ];
    const start = Date.now();
    const result = spawnSync(process.execPath, ['--test', ...scripts], {
        cwd: path.join(__dirname, '..', '..'),
        encoding: 'utf8',
        timeout: 60000,
    });
    const elapsedMs = Date.now() - start;
    assert.equal(result.status, 0, `Baseline suite failed:\n${result.stderr || result.stdout}`);
    assert.ok(elapsedMs <= 30000, `Suite took ${elapsedMs}ms — exceeds 30s target`);
});
