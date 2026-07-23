/**
 * EP-301E GE-01 — Permissions matrix re-validation (User / Admin / Supervisor)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    MAILBOX_LIFECYCLE_ACTIONS,
    canPerformAction,
    canUseMailboxLifecycleUi,
    getCapabilitiesForRole,
} = require('../../logic/mailbox-lifecycle-permissions.js');

const { registerMailboxLifecycleApi } = require('../../server/mailbox-lifecycle-api.js');

const { mapLifecycleError } = require('../../logic/mailbox-lifecycle-client.js');

function createTestServer() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep301e-pm-'));
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

test('PM-1..PM-5 — User and Admin mutate; Supervisor blocked from mutate', () => {
    for (const role of ['User', 'Admin']) {
        assert.equal(canPerformAction(role, MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX), true);
        assert.equal(canPerformAction(role, MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN), true);
        assert.equal(canPerformAction(role, MAILBOX_LIFECYCLE_ACTIONS.MARK_READY), true);
        assert.equal(canPerformAction(role, MAILBOX_LIFECYCLE_ACTIONS.RECOVER), false);
    }
    assert.equal(canPerformAction('Supervisor', MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX), false);
    assert.equal(canPerformAction('Supervisor', MAILBOX_LIFECYCLE_ACTIONS.MARK_READY), false);
    assert.equal(canPerformAction('Supervisor', MAILBOX_LIFECYCLE_ACTIONS.RECOVER), true);
});

test('PM-7 — Supervisor blocked from UI journey helpers', () => {
    assert.equal(canUseMailboxLifecycleUi('User'), true);
    assert.equal(canUseMailboxLifecycleUi('Admin'), true);
    assert.equal(canUseMailboxLifecycleUi('Supervisor'), false);
});

test('PM-8 — session endpoint exposes role and capabilities per persona', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    process.env.NHP_MAILBOX_SUPERVISOR_KEY = 'super-secret';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const userSession = await request(server, 'GET', '/api/mailbox-lifecycle/session', {
        headers: { 'x-creaty-token': 'tok_test' },
        query: { userId: 'plain-user' },
    });
    assert.equal(userSession.data.role, 'User');
    assert.equal(userSession.data.capabilities.canUseUi, true);
    assert.equal(userSession.data.capabilities.recover, false);

    const adminSession = await request(server, 'GET', '/api/mailbox-lifecycle/session', {
        headers: { 'x-creaty-token': 'tok_test' },
        query: { userId: 'admin-user' },
    });
    assert.equal(adminSession.data.role, 'Admin');
    assert.equal(adminSession.data.capabilities.canCrossWorkflowRead, true);

    const supervisorSession = await request(server, 'GET', '/api/mailbox-lifecycle/session', {
        headers: { 'x-creaty-token': 'tok_test', 'x-nhp-supervisor-key': 'super-secret' },
        query: { userId: 'plain-user' },
    });
    assert.equal(supervisorSession.data.role, 'Supervisor');
    assert.equal(supervisorSession.data.capabilities.canUseUi, false);
    assert.equal(supervisorSession.data.capabilities.recover, true);
});

test('PM-6 — Supervisor recover allowed; mutate endpoints return 403', async (t) => {
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
    const supHeaders = { 'x-creaty-token': 'tok_test', 'x-nhp-supervisor-key': 'super-secret' };

    const endpoints = [
        ['POST', `/api/mailbox-lifecycle/workflows/${workflowId}/mailbox/generate`, { userId: 'user_a', count: 1 }],
        ['POST', `/api/mailbox-lifecycle/workflows/${workflowId}/ready`, { userId: 'user_a' }],
    ];
    for (const [method, pathPart, body] of endpoints) {
        const denied = await request(server, method, pathPart, { headers: supHeaders, body });
        assert.equal(denied.status, 403, `${method} ${pathPart} should be 403 for Supervisor`);
        assert.equal(denied.data.code, 'FORBIDDEN');
    }

    const recover = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/recover`, {
        headers: supHeaders,
        body: { userId: 'user_a', action: 'retry_validation' },
    });
    assert.equal(recover.status, 200);
    assert.equal(recover.data.recovery.by, 'Supervisor');
});

test('PM-9 — User cannot read another users workflow', async (t) => {
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const created = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: { 'x-creaty-token': 'tok_test' },
        body: { userId: 'owner_user', domain: 'emailcore.app' },
    });
    const workflowId = created.data.workflow.id;

    const forbidden = await request(server, 'GET', `/api/mailbox-lifecycle/workflows/${workflowId}`, {
        headers: { 'x-creaty-token': 'tok_test' },
        query: { userId: 'other_user' },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.data.code, 'FORBIDDEN');
});

test('PM-10 — FORBIDDEN envelope maps to Arabic PE-04 text', () => {
    const mapped = mapLifecycleError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    assert.match(mapped.message, /صلاحية/);
    assert.equal(mapped.recoverable, true);
});

test('Admin capabilities include cross-workflow read', () => {
    const caps = getCapabilitiesForRole('Admin');
    assert.equal(caps.canCrossWorkflowRead, true);
    assert.equal(caps.create_mailbox, true);
});
