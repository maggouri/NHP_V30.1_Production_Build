const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    MAILBOX_LIFECYCLE_ACTIONS,
    resolveRoleFromRequest,
    canPerformAction,
    getCapabilitiesForRole,
    canUseMailboxLifecycleUi,
} = require('../../logic/mailbox-lifecycle-permissions.js');

const {
    registerMailboxLifecycleApi,
    resolveRole,
} = require('../../server/mailbox-lifecycle-api.js');

const {
    canPerformLifecycleAction,
    canUseMailboxLifecycleUi: clientCanUseUi,
    canMutateMailboxLifecycle,
    resolveRoleLabelAr,
} = require('../../logic/mailbox-lifecycle-client.js');

function createTestServer() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep301d-'));
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

test('permissions matrix — User can mutate mailbox lifecycle but not recover', () => {
    assert.equal(canPerformAction('User', MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX), true);
    assert.equal(canPerformAction('User', MAILBOX_LIFECYCLE_ACTIONS.MARK_READY), true);
    assert.equal(canPerformAction('User', MAILBOX_LIFECYCLE_ACTIONS.RECOVER), false);
    assert.equal(canUseMailboxLifecycleUi('User'), true);
});

test('permissions matrix — Admin can cross-read and mutate', () => {
    assert.equal(canPerformAction('Admin', MAILBOX_LIFECYCLE_ACTIONS.CHANGE_DOMAIN), true);
    assert.equal(canPerformAction('Admin', MAILBOX_LIFECYCLE_ACTIONS.RECOVER), false);
    const caps = getCapabilitiesForRole('Admin');
    assert.equal(caps.canCrossWorkflowRead, true);
    assert.equal(caps.create_mailbox, true);
});

test('permissions matrix — Supervisor recover-only, no UI journey', () => {
    assert.equal(canPerformAction('Supervisor', MAILBOX_LIFECYCLE_ACTIONS.RECOVER), true);
    assert.equal(canPerformAction('Supervisor', MAILBOX_LIFECYCLE_ACTIONS.CREATE_MAILBOX), false);
    assert.equal(canPerformAction('Supervisor', MAILBOX_LIFECYCLE_ACTIONS.MARK_READY), false);
    assert.equal(canUseMailboxLifecycleUi('Supervisor'), false);
});

test('client helpers mirror server policy decisions', () => {
    assert.equal(canPerformLifecycleAction('User', 'create_mailbox'), true);
    assert.equal(canPerformLifecycleAction('Supervisor', 'mark_ready'), false);
    assert.equal(clientCanUseUi('Supervisor'), false);
    assert.equal(canMutateMailboxLifecycle('Admin'), true);
    assert.match(resolveRoleLabelAr('Admin'), /مسؤول/);
});

test('resolveRoleFromRequest maps admin, user, and supervisor', () => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    process.env.NHP_MAILBOX_SUPERVISOR_KEY = 'super-secret';
    assert.equal(resolveRoleFromRequest({ auth: { userId: 'admin-user' }, headers: {} }), 'Admin');
    assert.equal(resolveRoleFromRequest({ auth: { userId: 'plain-user' }, headers: {} }), 'User');
    assert.equal(resolveRoleFromRequest({
        auth: { userId: 'plain-user' },
        headers: { 'x-nhp-supervisor-key': 'super-secret' },
    }), 'Supervisor');
    assert.equal(resolveRole({ auth: { userId: 'plain-user' }, headers: {} }), 'User');
});

test('session endpoint exposes role and capabilities', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const userSession = await request(server, 'GET', '/api/mailbox-lifecycle/session?userId=user_a', {
        headers: { 'x-creaty-token': 'tok_test' },
    });
    assert.equal(userSession.status, 200);
    assert.equal(userSession.data.role, 'User');
    assert.equal(userSession.data.capabilities.create_mailbox, true);
    assert.equal(userSession.data.capabilities.recover, false);
    assert.equal(userSession.data.capabilities.canUseUi, true);

    const adminSession = await request(server, 'GET', '/api/mailbox-lifecycle/session?userId=admin-user', {
        headers: { 'x-creaty-token': 'tok_test' },
    });
    assert.equal(adminSession.status, 200);
    assert.equal(adminSession.data.role, 'Admin');
    assert.equal(adminSession.data.capabilities.canCrossWorkflowRead, true);
});

test('supervisor denied on mutate endpoints but allowed recover', async (t) => {
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

    const supervisorHeaders = {
        'x-creaty-token': 'tok_test',
        'x-nhp-supervisor-key': 'super-secret',
    };

    const createDenied = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/mailbox/generate`, {
        headers: supervisorHeaders,
        body: { userId: 'user_a', count: 1 },
    });
    assert.equal(createDenied.status, 403);

    const readyDenied = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/ready`, {
        headers: supervisorHeaders,
        body: { userId: 'user_a' },
    });
    assert.equal(readyDenied.status, 403);

    const recoverAllowed = await request(server, 'POST', `/api/mailbox-lifecycle/workflows/${workflowId}/recover`, {
        headers: supervisorHeaders,
        body: { userId: 'user_a', action: 'retry_validation' },
    });
    assert.equal(recoverAllowed.status, 200);
});

test('user cannot read another users workflow', async (t) => {
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

    const forbidden = await request(server, 'GET', `/api/mailbox-lifecycle/workflows/${workflowId}?userId=other_user`, {
        headers: { 'x-creaty-token': 'tok_test' },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.data.code, 'FORBIDDEN');
});
