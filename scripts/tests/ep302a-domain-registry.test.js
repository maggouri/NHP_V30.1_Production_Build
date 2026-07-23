const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    DOMAIN_REGISTRY_SCHEMA_VERSION,
    DOMAIN_REGISTRY_ERROR_CODES,
    createEmptyStore,
    buildStoreFromEnvDomains,
    readEnvAllowedDomains,
    validateDomainRegistryEntry,
    validateDomainRegistryStore,
    addDomain,
    updateDomain,
    setDomainVerified,
    enableDomain,
    disableDomain,
    deprecateDomain,
    buildMailboxDomainList,
    resolveAllowedDomainNames,
    registryHasDomains,
    loadRegistryStore,
    saveRegistryStore,
    validateDomainChoiceAgainstRegistry,
} = require('../../logic/domain-registry-model.js');

test('readEnvAllowedDomains falls back to default when env empty', () => {
    const names = readEnvAllowedDomains({});
    assert.deepEqual(names, ['emailcore.app']);
});

test('buildStoreFromEnvDomains creates enabled verified entries', () => {
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'alpha.test,beta.test' });
    assert.equal(store.schemaVersion, DOMAIN_REGISTRY_SCHEMA_VERSION);
    assert.equal(Object.keys(store.domains).length, 2);
    const rows = Object.values(store.domains);
    assert.ok(rows.every((row) => row.status === 'enabled' && row.isVerified === true));
});

test('validateDomainRegistryEntry rejects invalid domain names', () => {
    const result = validateDomainRegistryEntry({
        id: 'dom_bad',
        name: 'bad domain',
        status: 'disabled',
        isVerified: false,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((msg) => msg.includes('invalid characters')));
});

test('addDomain creates disabled unverified domain by default', () => {
    const store = createEmptyStore();
    const result = addDomain(store, { name: 'NewDomain.COM', notes: 'test' });
    assert.equal(result.ok, true);
    assert.equal(result.domain.name, 'newdomain.com');
    assert.equal(result.domain.status, 'disabled');
    assert.equal(result.domain.isVerified, false);
    assert.equal(result.domain.notes, 'test');
});

test('addDomain rejects duplicate domain names', () => {
    const store = createEmptyStore();
    addDomain(store, { name: 'dup.test' });
    const dup = addDomain(store, { name: 'DUP.test' });
    assert.equal(dup.ok, false);
    assert.equal(dup.code, DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_DUPLICATE);
});

test('enableDomain requires verification', () => {
    const store = createEmptyStore();
    addDomain(store, { name: 'pending.test' });
    const id = Object.keys(store.domains)[0];
    const blocked = enableDomain(store, id);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_NOT_VERIFIED);

    setDomainVerified(store, id, true);
    const enabled = enableDomain(store, id);
    assert.equal(enabled.ok, true);
    assert.equal(enabled.domain.status, 'enabled');
});

test('disableDomain blocks last active enabled domain', () => {
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'only.test' });
    const id = Object.keys(store.domains)[0];
    const blocked = disableDomain(store, id);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_LAST_ACTIVE);
});

test('buildMailboxDomainList uses env fallback when registry empty', () => {
    const store = createEmptyStore();
    const list = buildMailboxDomainList(store, { NHP_MAILBOX_ALLOWED_DOMAINS: 'fallback.test' });
    assert.deepEqual(list, [{ id: 'dom_fallback.test', name: 'fallback.test', isVerified: true }]);
});

test('buildMailboxDomainList returns enabled verified registry domains only', () => {
    const store = createEmptyStore();
    addDomain(store, { name: 'visible.test', isVerified: true, status: 'enabled' });
    addDomain(store, { name: 'hidden.test', isVerified: false, status: 'enabled' });
    addDomain(store, { name: 'off.test', isVerified: true, status: 'disabled' });

    const list = buildMailboxDomainList(store, {});
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'visible.test');
});

test('resolveAllowedDomainNames prefers registry over env when populated', () => {
    const store = createEmptyStore();
    addDomain(store, { name: 'registry.test', isVerified: true, status: 'enabled' });
    const allowed = resolveAllowedDomainNames(store, { NHP_MAILBOX_ALLOWED_DOMAINS: 'env.test' });
    assert.deepEqual(allowed, ['registry.test']);
});

test('validateDomainChoiceAgainstRegistry accepts enabled registry domain', () => {
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'pick.test' });
    const err = validateDomainChoiceAgainstRegistry(store, 'pick.test', {});
    assert.equal(err, null);
});

test('validateDomainChoiceAgainstRegistry rejects unknown domain', () => {
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'pick.test' });
    const err = validateDomainChoiceAgainstRegistry(store, 'other.test', {});
    assert.equal(err.ok, false);
    assert.equal(err.code, 'DOMAIN_NOT_ALLOWED');
});

test('registry persistence round-trip via load/save', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep302a-'));
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'persist.test' });
    saveRegistryStore(rootDir, store);
    const loaded = loadRegistryStore(rootDir);
    const check = validateDomainRegistryStore(loaded);
    assert.equal(check.ok, true);
    assert.ok(registryHasDomains(loaded));
    fs.rmSync(rootDir, { recursive: true, force: true });
});

test('updateDomain can rename domain when unique', () => {
    const store = createEmptyStore();
    addDomain(store, { name: 'old.test' });
    const id = Object.keys(store.domains)[0];
    const result = updateDomain(store, id, { name: 'new.test', notes: 'renamed' });
    assert.equal(result.ok, true);
    assert.equal(result.domain.name, 'new.test');
    assert.equal(result.domain.id, 'dom_new.test');
    assert.equal(store.domains['dom_new.test'].notes, 'renamed');
});

test('deprecateDomain blocks last enabled domain', () => {
    const store = buildStoreFromEnvDomains({ NHP_MAILBOX_ALLOWED_DOMAINS: 'solo.test' });
    const id = Object.keys(store.domains)[0];
    const blocked = deprecateDomain(store, id);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, DOMAIN_REGISTRY_ERROR_CODES.DOMAIN_LAST_ACTIVE);
});
