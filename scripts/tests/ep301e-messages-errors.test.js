/**
 * EP-301E GE-01 — Error envelope contract + PE-04 Arabic message mapping
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildError } = require('../../server/mailbox-lifecycle-api.js');
const { mapLifecycleError } = require('../../logic/mailbox-lifecycle-client.js');

const KNOWN_ERROR_CODES = [
    'AUTH_REQUIRED', 'AUTH_INVALID', 'DOMAIN_REQUIRED', 'DOMAIN_NOT_ALLOWED',
    'DOMAIN_INVALID', 'DOMAIN_NOT_SET', 'MAILBOX_CREATE_FAILED', 'MAILBOX_DOMAIN_MISMATCH',
    'MAILBOX_VALIDATION_FAILED', 'MAILBOX_NOT_CREATED', 'MAILBOX_INVALID', 'MAILBOX_NOT_FOUND',
    'VALIDATION_REMOTE_ERROR', 'VALIDATION_REQUIRED', 'CONNECTION_VERIFY_FAILED',
    'CONNECTION_NOT_VERIFIED', 'WORKFLOW_NOT_FOUND', 'FORBIDDEN', 'ROLE_UI_BLOCKED', 'NETWORK',
];

const ENVELOPE_FIELDS = ['ok', 'code', 'message', 'recoverable', 'retryable', 'nextAction'];

test('buildError produces standard envelope fields', () => {
    const err = buildError('DOMAIN_NOT_ALLOWED', 'Domain "x.com" is not allowed', {
        recoverable: true,
        retryable: false,
        nextAction: 'choose_allowed_domain',
    });
    for (const field of ENVELOPE_FIELDS) {
        assert.ok(field in err, `Missing envelope field: ${field}`);
    }
    assert.equal(err.ok, false);
    assert.equal(err.code, 'DOMAIN_NOT_ALLOWED');
    assert.equal(err.recoverable, true);
    assert.equal(err.retryable, false);
    assert.equal(err.nextAction, 'choose_allowed_domain');
});

test('mapLifecycleError maps all known API codes to Arabic user text', () => {
    assert.ok(KNOWN_ERROR_CODES.length >= 15, 'Expected comprehensive Arabic error catalog');
    for (const code of KNOWN_ERROR_CODES) {
        const mapped = mapLifecycleError({ code, message: 'English fallback' });
        assert.equal(mapped.code, code);
        assert.notEqual(mapped.message, 'English fallback', `${code} should map to Arabic`);
        assert.ok(mapped.message.length > 0);
        assert.match(mapped.message, /[\u0600-\u06FF]/, `${code} should have Arabic text`);
    }
});

test('mapLifecycleError preserves recoverable and retryable flags', () => {
    const mapped = mapLifecycleError({
        code: 'VALIDATION_REMOTE_ERROR',
        recoverable: true,
        retryable: true,
        nextAction: 'retry_validation',
    });
    assert.equal(mapped.recoverable, true);
    assert.equal(mapped.retryable, true);
    assert.match(mapped.hint, /إعادة/);
});

test('mapLifecycleError falls back to server message for unknown codes', () => {
    const mapped = mapLifecycleError({ code: 'UNKNOWN_CODE', message: 'Custom server message' });
    assert.equal(mapped.message, 'Custom server message');
});

test('AUTH_REQUIRED and FORBIDDEN envelopes are PE-04 compliant', () => {
    for (const code of ['AUTH_REQUIRED', 'FORBIDDEN', 'WORKFLOW_NOT_FOUND']) {
        const apiErr = buildError(code, `Server: ${code}`, { recoverable: code !== 'FORBIDDEN', nextAction: 'provide_credentials' });
        const ui = mapLifecycleError(apiErr);
        assert.match(ui.message, /[\u0600-\u06FF]/);
        assert.doesNotMatch(ui.message, /Oracle|orchestrator|HTTP 502/i);
    }
});
