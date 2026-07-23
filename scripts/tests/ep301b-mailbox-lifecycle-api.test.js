const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    registerMailboxLifecycleApi,
    validateDomainChoice,
    resolveRole,
    readAllowedDomains,
} = require('../../server/mailbox-lifecycle-api.js');

function createTestServer() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep301b-'));
    const app = express();
    app.use(express.json());
    registerMailboxLifecycleApi(app, { rootDir, logFn: () => {} });
    const server = http.createServer(app);
    return { server, rootDir };
}

async function request(server, method, urlPath, { headers = {}, body } = {}) {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
}

test('validateDomainChoice rejects unknown domain', () => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    const err = validateDomainChoice('bad domain.com');
    assert.equal(err.ok, false);
    assert.equal(err.code, 'DOMAIN_NOT_ALLOWED');
});

test('resolveRole maps admin and supervisor credentials', () => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    process.env.NHP_MAILBOX_SUPERVISOR_KEY = 'super-secret';
    const adminReq = { auth: { userId: 'admin-user' }, headers: {} };
    assert.equal(resolveRole(adminReq), 'Admin');
    const supervisorReq = { auth: { userId: 'x' }, headers: { 'x-nhp-supervisor-key': 'super-secret' } };
    assert.equal(resolveRole(supervisorReq), 'Supervisor');
});

test('mailbox lifecycle API auth and workflow create/read', async (t) => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const authHeaders = { 'x-creaty-token': 'tok_test', userId: 'user_a' };

    const unauth = await request(server, 'GET', '/api/mailbox-lifecycle/domains');
    assert.equal(unauth.status, 401);
    assert.equal(unauth.data.code, 'AUTH_REQUIRED');

    const domains = await request(server, 'GET', '/api/mailbox-lifecycle/domains?userId=user_a', {
        headers: { 'x-creaty-token': 'tok_test' },
    });
    assert.equal(domains.status, 200);
    assert.ok(Array.isArray(domains.data.domains));
    assert.ok(domains.data.domains.some((d) => d.name === 'emailcore.app'));

    const badDomain = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: authHeaders,
        body: { userId: 'user_a', domain: 'not-allowed.test' },
    });
    assert.equal(badDomain.status, 400);
    assert.equal(badDomain.data.code, 'DOMAIN_NOT_ALLOWED');

    const created = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: authHeaders,
        body: { userId: 'user_a', domain: 'emailcore.app' },
    });
    assert.equal(created.status, 201);
    const workflowId = created.data.workflow.id;
    assert.equal(created.data.workflow.domain.name, 'emailcore.app');
    assert.equal(created.data.workflow.step, 'CREATE_MAILBOX');

    const forbidden = await request(server, 'GET', `/api/mailbox-lifecycle/workflows/${workflowId}?userId=other_user`, {
        headers: { 'x-creaty-token': 'tok_test' },
    });
    assert.equal(forbidden.status, 403);

    const read = await request(server, 'GET', `/api/mailbox-lifecycle/workflows/${workflowId}?userId=user_a`, {
        headers: { 'x-creaty-token': 'tok_test' },
    });
    assert.equal(read.status, 200);
    assert.equal(read.data.workflow.id, workflowId);
});

test('supervisor recovery endpoint requires supervisor role', async (t) => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    process.env.NHP_MAILBOX_SUPERVISOR_KEY = 'super-secret';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const created = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: { 'x-creaty-token': 'tok_test' },
        body: { userId: 'user_a', domain: 'emailcore.app' },
    });
    const workflowId = created.data.workflow.id;

    const denied = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/recover`, {
        headers: { 'x-creaty-token': 'tok_test' },
        body: { userId: 'user_a', action: 'retry_validation' },
    });
    assert.equal(denied.status, 403);

    const allowed = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/recover`, {
        headers: { 'x-creaty-token': 'tok_test', 'x-nhp-supervisor-key': 'super-secret' },
        body: { userId: 'user_a', action: 'retry_validation' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.data.recovery.by, 'Supervisor');
});

test('readAllowedDomains falls back to default list', () => {
    delete process.env.NHP_MAILBOX_ALLOWED_DOMAINS;
    const domains = readAllowedDomains();
    assert.deepEqual(domains, ['emailcore.app']);
});
