/**
 * EP-301E GE-01 — Full mailbox lifecycle API journey (Login → Ready)
 * Uses in-process test server with mocked EmailCore fetch.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { mock } = require('node:test');

const { registerMailboxLifecycleApi, WORKFLOW_STEPS } = require('../../server/mailbox-lifecycle-api.js');

function createTestServer() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep301e-e2e-'));
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
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
}

function mockEmailCore(sessionId, email) {
    const originalFetch = global.fetch;
    return mock.method(global, 'fetch', async (url, options = {}) => {
        const href = String(url);
        const method = (options.method || 'GET').toUpperCase();

        if (!href.includes('emailcore.app') && !href.includes('/api/creaty')) {
            return originalFetch(url, options);
        }

        if (href.includes('/library/sessions/generate') && method === 'POST') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    sessions: [{
                        id: sessionId,
                        sessionId,
                        display_email: email,
                        email,
                    }],
                }),
            };
        }

        if (href.includes('/library/sessions/manual') && method === 'POST') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    session: { id: sessionId, sessionId, display_email: email, email },
                }),
            };
        }

        if (href.includes('/library/sessions') && method === 'GET') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    sessions: [{ id: sessionId, sessionId, display_email: email, email }],
                }),
            };
        }

        return { ok: false, status: 404, json: async () => ({ error: 'unmocked EmailCore path' }) };
    });
}

test('GE-01 — User completes full 7-step journey to READY', async (t) => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    const sessionId = 'sess_e2e_001';
    const email = 'journey@emailcore.app';
    const fetchMock = mockEmailCore(sessionId, email);

    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        fetchMock.mock.restore();
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const authHeaders = { 'x-creaty-token': 'tok_test' };
    const userId = 'user_a';

    // Step 1: Login / session
    const session = await request(server, 'GET', '/api/mailbox-lifecycle/session', {
        headers: authHeaders,
        query: { userId },
    });
    assert.equal(session.status, 200);
    assert.equal(session.data.role, 'User');

    // Step 2: Choose domain
    const domains = await request(server, 'GET', '/api/mailbox-lifecycle/domains', {
        headers: authHeaders,
        query: { userId },
    });
    assert.equal(domains.status, 200);
    assert.ok(domains.data.domains.some((d) => d.name === 'emailcore.app'));

    const created = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: authHeaders,
        body: { userId, domain: 'emailcore.app' },
    });
    assert.equal(created.status, 201);
    const workflowId = created.data.workflow.id;
    assert.equal(created.data.workflow.step, 'CREATE_MAILBOX');

    // Step 3: Create mailbox
    const generate = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/mailbox/generate`, {
        headers: authHeaders,
        body: { userId, count: 1 },
    });
    assert.equal(generate.status, 200);
    assert.equal(generate.data.workflow.mailbox.address, email);
    assert.equal(generate.data.workflow.step, 'VALIDATION');

    // Step 4: Validation
    const validate = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/validate`, {
        headers: authHeaders,
        body: { userId },
    });
    assert.equal(validate.status, 200);
    assert.equal(validate.data.validation.ok, true);
    assert.equal(validate.data.workflow.step, 'CONNECTION_SETTINGS');

    // Step 5: Mailbox created (confirmed via validation)
    assert.equal(validate.data.workflow.mailbox.status, 'ACTIVE');

    // Step 6: Connection settings
    const conn = await request(server, 'GET', `/api/mailbox-lifecycle/workflows/${workflowId}/connection`, {
        headers: authHeaders,
        query: { userId },
    });
    assert.equal(conn.status, 200);
    assert.equal(conn.data.connection.mailboxAddress, email);

    const connVerify = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/connection/verify`, {
        headers: authHeaders,
        body: { userId },
    });
    assert.equal(connVerify.status, 200);
    assert.equal(connVerify.data.connection.verified, true);

    // Step 7: Ready
    const ready = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/ready`, {
        headers: authHeaders,
        body: { userId },
    });
    assert.equal(ready.status, 200);
    assert.equal(ready.data.workflow.ready, true);
    assert.equal(ready.data.workflow.status, 'READY');
    assert.equal(ready.data.workflow.step, 'READY');
});

test('GE-01 — Admin can cross-read user workflow on same journey path', async (t) => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    const sessionId = 'sess_e2e_admin';
    const email = 'adminpath@emailcore.app';
    const fetchMock = mockEmailCore(sessionId, email);

    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        fetchMock.mock.restore();
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const userHeaders = { 'x-creaty-token': 'tok_test' };
    const adminHeaders = { 'x-creaty-token': 'tok_test' };

    const created = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: userHeaders,
        body: { userId: 'owner_user', domain: 'emailcore.app' },
    });
    const workflowId = created.data.workflow.id;

    const adminRead = await request(server, 'GET', `/api/mailbox-lifecycle/workflows/${workflowId}`, {
        headers: adminHeaders,
        query: { userId: 'admin-user' },
    });
    assert.equal(adminRead.status, 200);
    assert.equal(adminRead.data.workflow.id, workflowId);
});

test('GE-01 — API exposes all seven workflow steps in ping', () => {
    assert.deepEqual(WORKFLOW_STEPS, [
        'LOGIN',
        'CHOOSE_DOMAIN',
        'CREATE_MAILBOX',
        'VALIDATION',
        'MAILBOX_CREATED',
        'CONNECTION_SETTINGS',
        'READY',
    ]);
});
