const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  deriveDomainAvailability,
  isEligibleDomain,
} = require('../../logic/domain-source-service.js');

const EXT_ROOT = path.join(__dirname, '..', '..');

test('INT-003 — central availability filter keeps enabled+verified only', () => {
  const input = [
    { id: '1', name: 'emailcore.app', status: 'enabled', isVerified: true },
    { id: '2', name: 'nocochat.com', status: 'enabled', isVerified: true },
    { id: '3', name: 'draft.app', status: 'enabled', isVerified: false },
    { id: '4', name: 'legacy.app', status: 'deprecated', isVerified: true },
  ];
  const out = deriveDomainAvailability(input);
  assert.equal(out.summary.total, 4);
  assert.equal(out.summary.enabled, 3);
  assert.equal(out.summary.verified, 3);
  assert.equal(out.summary.eligible, 2);
  assert.deepEqual(out.eligibleDomains.map((row) => row.name), ['emailcore.app', 'nocochat.com']);
  assert.equal(isEligibleDomain(input[0]), true);
  assert.equal(isEligibleDomain(input[2]), false);
});

test('INT-003 — a.com deprecated explains total=3 vs eligible=2 shape', () => {
  const input = [
    { id: '1', name: 'a.com', status: 'deprecated', isVerified: true },
    { id: '2', name: 'emailcore.app', status: 'enabled', isVerified: true },
    { id: '3', name: 'nocochat.com', status: 'enabled', isVerified: true },
  ];
  const out = deriveDomainAvailability(input);
  assert.equal(out.summary.total, 3);
  assert.equal(out.summary.eligible, 2);
  assert.deepEqual(out.eligibleDomains.map((row) => row.name).sort(), ['emailcore.app', 'nocochat.com']);
  assert.equal(out.eligibleDomains.some((row) => row.name === 'a.com'), false);
});

test('INT-003 — Mail Setup consumes shared source service', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/mailbox-lifecycle-ui.js'), 'utf8');
  assert.match(ui, /fetchDomainRegistrySnapshot/);
  assert.doesNotMatch(ui, /lifecycleFetch\('\/api\/mailbox-lifecycle\/domains'\)/);
});

test('INT-003 — Quick Registry consumes shared source service', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/domain-registry-ui.js'), 'utf8');
  assert.match(ui, /fetchDomainRegistrySnapshot/);
  assert.match(ui, /summary\?\.eligible/);
});

test('INT-003 — Mail Setup hydrates domain picker on CHOOSE_DOMAIN without workflow', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/mailbox-lifecycle-ui.js'), 'utf8');
  assert.match(ui, /ensureDomainPickerHydrated/);
  assert.match(ui, /async function ensureDomainPickerHydrated/);
  assert.match(ui, /step === 'CHOOSE_DOMAIN' && !domains\.length/);
  assert.match(ui, /await ensureDomainPickerHydrated\(authReady\)/);
  // Regression gate: empty picker must not depend only on workflow-resume branch.
  assert.match(ui, /await ensureDomainPickerHydrated\(!!\(auth\?\.userId && auth\?\.token\)\)/);
  const refreshStart = ui.indexOf('export async function refreshMailboxLifecycleUi');
  assert.ok(refreshStart >= 0, 'refreshMailboxLifecycleUi missing');
  const refreshBody = ui.slice(refreshStart, refreshStart + 1800);
  assert.match(refreshBody, /ensureDomainPickerHydrated/);
  assert.doesNotMatch(
    refreshBody,
    /if \(workflowId \|\| \(await loadExistingWorkflow\(\)\)\) \{[\s\S]*await goToDomainStep\(\);\s*\} else \{\s*await renderAll\(auth\);\s*\}/,
  );
});

test('INT-003 — domain step binds select from eligibleDomains names', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/mailbox-lifecycle-ui.js'), 'utf8');
  assert.match(ui, /domains = Array\.isArray\(snapshot\.eligibleDomains\) \? snapshot\.eligibleDomains : \[\]/);
  assert.match(ui, /domains\.map\(\(d\) => `<option value="\$\{escapeHtml\(d\.name\)\}">/);
});
