#!/usr/bin/env node
/**
 * USPTO pause/resume queue persistence — pure merge helpers.
 */
const assert = require('assert');
const path = require('path');
const vm = require('vm');

const sandbox = { globalThis: {} };
sandbox.global = sandbox.globalThis;
vm.createContext(sandbox);

vm.runInContext(`
  function normalizeNicheKey(value = '') {
    return String(value || '').toLowerCase().trim();
  }
  global.normalizeNicheKey = normalizeNicheKey;
`, sandbox);

vm.runInContext(
    require('fs').readFileSync(
        path.join(__dirname, '../../background/uspto-queue-persistence.js'),
        'utf8'
    ),
    sandbox
);

const { mergeUsptoRequeueNiches, snapshotPendingCount, buildUsptoBatchSnapshot } = sandbox.globalThis;

assert.strictEqual(
    mergeUsptoRequeueNiches({
        pending: ['beta'],
        inFlight: ['alpha'],
        current: 'gamma',
        safe: ['done']
    }).join('|'),
    'alpha|gamma|beta'
);

assert.strictEqual(
    mergeUsptoRequeueNiches({
        pending: ['alpha'],
        inFlight: ['alpha'],
        current: '',
        safe: [],
        banned: [],
        errors: []
    }).join('|'),
    'alpha'
);

const snapshot = buildUsptoBatchSnapshot({
    uPending: ['a', 'b'],
    uInFlight: ['c'],
    uSafe: ['s'],
    uTotal: 4
});
assert.strictEqual(snapshotPendingCount(snapshot), 3);
assert.strictEqual(snapshot.total, 4);

console.log('OK: uspto-queue-persistence.test.js');
