const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MAILBOX_SCHEMA_VERSION,
    normalizeLegacyMailboxRecord,
    validateMailboxLifecycleRecord,
} = require('../../logic/mailbox-lifecycle-model.js');

test('normalizes legacy session rows into mailbox lifecycle schema', () => {
    const normalized = normalizeLegacyMailboxRecord({
        id: 'sess_1001',
        email: 'demo@emailcore.app',
        creaty_phase: 'DONE',
        domain: 'emailcore.app',
        inboxToken: 'tok_1',
    });

    assert.equal(normalized.schemaVersion, MAILBOX_SCHEMA_VERSION);
    assert.equal(normalized.domain.name, 'emailcore.app');
    assert.equal(normalized.mailbox.address, 'demo@emailcore.app');
    assert.equal(normalized.mailbox.status, 'ACTIVE');
    assert.equal(normalized.mailbox.sessionId, 'sess_1001');
});

test('accepts backward-compatible row missing explicit domainId', () => {
    const normalized = normalizeLegacyMailboxRecord({
        sessionId: 'ec_42',
        display_email: 'alpha@mydomain.com',
        status: 'created',
    });
    const result = validateMailboxLifecycleRecord(normalized);
    assert.equal(result.ok, true);
    assert.equal(normalized.domain.id, 'dom_mydomain.com');
});

test('rejects relation mismatch between mailbox email and domain name', () => {
    const normalized = normalizeLegacyMailboxRecord({
        id: 'sess_9',
        email: 'owner@correct-domain.com',
        domain: 'wrong-domain.com',
    });
    const result = validateMailboxLifecycleRecord(normalized);
    assert.equal(result.ok, false);
    assert.ok(
        result.errors.includes('mailbox.address domain must match domain.name'),
        `Expected relation error, got: ${result.errors.join(', ')}`
    );
});
