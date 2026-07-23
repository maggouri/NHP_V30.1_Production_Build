const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    registerMailboxLifecycleApi,
    buildDomainList,
    validateDomainChoice,
} = require('../../server/mailbox-lifecycle-api.js');
const {
    buildStoreFromEnvDomains,
    createEmptyStore,
    saveRegistryStore,
    addDomain,
} = require('../../logic/domain-registry-model.js');

function createTestServer() {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep302b-'));
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

function seedRegistry(rootDir, envValue) {
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: envValue });
    saveRegistryStore(rootDir, store);
    return store;
}

test('buildDomainList falls back to env when registry empty', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep302b-env-'));
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'fallback.test';
    const list = buildDomainList(rootDir);
    assert.deepEqual(list, [{ id: 'dom_fallback.test', name: 'fallback.test', isVerified: true }]);
    fs.rmSync(rootDir, { recursive: true, force: true });
});

test('buildDomainList reads enabled verified domains from registry', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep302b-reg-'));
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'alpha.test' });
    addDomain(store, { name: 'visible.test', status: 'enabled', isVerified: true });
    addDomain(store, { name: 'hidden.test', status: 'enabled', isVerified: false });
    saveRegistryStore(rootDir, store);

    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'ignored.test';
    const list = buildDomainList(rootDir);
    const names = list.map((row) => row.name).sort();
    assert.deepEqual(names, ['alpha.test', 'visible.test']);
    fs.rmSync(rootDir, { recursive: true, force: true });
});

test('validateDomainChoice uses registry allow-list when populated', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep302b-val-'));
    seedRegistry(rootDir, 'registry.test');
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'env.test';

    assert.equal(validateDomainChoice('registry.test', rootDir), null);
    const err = validateDomainChoice('env.test', rootDir);
    assert.equal(err.ok, false);
    assert.equal(err.code, 'DOMAIN_NOT_ALLOWED');
    fs.rmSync(rootDir, { recursive: true, force: true });
});

test('domain registry CRUD happy path for admin', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'emailcore.app';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const adminHeaders = { 'x-creaty-token': 'tok_admin', userId: 'admin-user' };

    const created = await request(server, 'POST', '/api/mailbox-lifecycle/domain-registry', {
        headers: adminHeaders,
        body: { userId: 'admin-user', name: 'NewDomain.COM', notes: 'note' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.domain.name, 'newdomain.com');
    assert.equal(created.data.domain.status, 'disabled');

    const domainId = created.data.domain.id;

    const verified = await request(server, 'PATCH', `/api/mailbox-lifecycle/domain-registry/${domainId}`, {
        headers: adminHeaders,
        body: { userId: 'admin-user', action: 'verify' },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.data.domain.isVerified, true);

    const enabled = await request(server, 'PATCH', `/api/mailbox-lifecycle/domain-registry/${domainId}`, {
        headers: adminHeaders,
        body: { userId: 'admin-user', action: 'enable' },
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.data.domain.status, 'enabled');

    const list = await request(server, 'GET', '/api/mailbox-lifecycle/domain-registry?userId=admin-user', {
        headers: { 'x-creaty-token': 'tok_admin' },
    });
    assert.equal(list.status, 200);
    assert.ok(list.data.domains.some((row) => row.name === 'newdomain.com'));

    const userDomains = await request(server, 'GET', '/api/mailbox-lifecycle/domains?userId=user_a', {
        headers: { 'x-creaty-token': 'tok_user' },
    });
    assert.equal(userDomains.status, 200);
    assert.equal(userDomains.data.source, 'registry');
    assert.ok(userDomains.data.domains.some((row) => row.name === 'newdomain.com'));
});

test('domain registry rejects duplicate domain', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const adminHeaders = { 'x-creaty-token': 'tok_admin', userId: 'admin-user' };
    await request(server, 'POST', '/api/mailbox-lifecycle/domain-registry', {
        headers: adminHeaders,
        body: { userId: 'admin-user', name: 'dup.test' },
    });
    const dup = await request(server, 'POST', '/api/mailbox-lifecycle/domain-registry', {
        headers: adminHeaders,
        body: { userId: 'admin-user', name: 'DUP.test' },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.data.code, 'DOMAIN_DUPLICATE');
});

test('domain registry mutations forbidden for non-admin', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    const { server, rootDir } = createTestServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const userHeaders = { 'x-creaty-token': 'tok_user', userId: 'user_a' };
    const denied = await request(server, 'POST', '/api/mailbox-lifecycle/domain-registry', {
        headers: userHeaders,
        body: { userId: 'user_a', name: 'blocked.test' },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.data.code, 'FORBIDDEN');
});

test('disable blocks last active enabled domain', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    const { server, rootDir } = createTestServer();
    seedRegistry(rootDir, 'only.test');
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const adminHeaders = { 'x-creaty-token': 'tok_admin', userId: 'admin-user' };
    const domainId = 'dom_only.test';
    const blocked = await request(server, 'PATCH', `/api/mailbox-lifecycle/domain-registry/${domainId}`, {
        headers: adminHeaders,
        body: { userId: 'admin-user', action: 'disable' },
    });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.code, 'DOMAIN_LAST_ACTIVE');
});

test('workflow create respects registry domain policy', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    process.env.NHP_MAILBOX_ALLOWED_DOMAINS = 'env-only.test';
    const { server, rootDir } = createTestServer();

    const store = createEmptyStore();
    addDomain(store, { name: 'allowed.test', status: 'enabled', isVerified: true });
    saveRegistryStore(rootDir, store);

    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const authHeaders = { 'x-creaty-token': 'tok_user', userId: 'user_a' };
    const bad = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: authHeaders,
        body: { userId: 'user_a', domain: 'env-only.test' },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.code, 'DOMAIN_NOT_ALLOWED');

    const ok = await request(server, 'POST', '/api/mailbox-lifecycle/workflows', {
        headers: authHeaders,
        body: { userId: 'user_a', domain: 'allowed.test' },
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.workflow.domain.name, 'allowed.test');
});

test('delete domain performs soft deprecate', async (t) => {
    process.env.NHP_MAILBOX_ADMIN_USER_IDS = 'admin-user';
    const { server, rootDir } = createTestServer();
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'keep.test,remove.test' });
    saveRegistryStore(rootDir, store);
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => {
        server.close();
        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    const adminHeaders = { 'x-creaty-token': 'tok_admin', userId: 'admin-user' };
    const deleted = await request(server, 'DELETE', '/api/mailbox-lifecycle/domain-registry/dom_remove.test', {
        headers: adminHeaders,
        body: { userId: 'admin-user' },
    });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.domain.status, 'deprecated');
    assert.equal(deleted.data.softDelete, true);
});
