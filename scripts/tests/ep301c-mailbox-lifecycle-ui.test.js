const test = require('node:test');
const assert = require('node:assert/strict');

const {
  JOURNEY_STEPS,
  mapLifecycleError,
  validateManualMailboxInput,
  validateGenerateCount,
  resolveStepIndex,
  resolveVisibleStep,
} = require('../../logic/mailbox-lifecycle-client.js');

test('mapLifecycleError maps API codes to Arabic user text', () => {
  const mapped = mapLifecycleError({
    code: 'DOMAIN_NOT_ALLOWED',
    message: 'Domain "x.com" is not allowed',
    recoverable: true,
    retryable: false,
    nextAction: 'choose_allowed_domain',
  });
  assert.equal(mapped.code, 'DOMAIN_NOT_ALLOWED');
  assert.match(mapped.message, /غير مسموح/);
  assert.match(mapped.hint, /اختر نطاقاً/);
  assert.equal(mapped.recoverable, true);
  assert.equal(mapped.retryable, false);
});

test('mapLifecycleError falls back for unknown codes', () => {
  const mapped = mapLifecycleError({ code: 'CUSTOM', message: 'Something happened' });
  assert.equal(mapped.message, 'Something happened');
});

test('validateManualMailboxInput enforces domain suffix', () => {
  const bad = validateManualMailboxInput('user@other.com', 'emailcore.app');
  assert.equal(bad.ok, false);
  const good = validateManualMailboxInput('user@emailcore.app', 'emailcore.app');
  assert.equal(good.ok, true);
  assert.equal(good.email, 'user@emailcore.app');
});

test('validateGenerateCount bounds count between 1 and 10', () => {
  assert.equal(validateGenerateCount(0).ok, false);
  assert.equal(validateGenerateCount(11).ok, false);
  assert.equal(validateGenerateCount(3).ok, true);
  assert.equal(validateGenerateCount(3).count, 3);
});

test('resolveVisibleStep requires login before workflow steps', () => {
  assert.equal(resolveVisibleStep('CREATE_MAILBOX', false), 'LOGIN');
  assert.equal(resolveVisibleStep('CREATE_MAILBOX', true), 'CREATE_MAILBOX');
});

test('JOURNEY_STEPS defines seven ordered steps', () => {
  assert.equal(JOURNEY_STEPS.length, 7);
  assert.equal(JOURNEY_STEPS[0].id, 'LOGIN');
  assert.equal(JOURNEY_STEPS[6].id, 'READY');
  assert.equal(resolveStepIndex('READY'), 6);
});
