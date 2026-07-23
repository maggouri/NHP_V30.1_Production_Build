const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  DOMAIN_REGISTRY_API,
  DOMAIN_REGISTRY_ACTIONS,
  canManageDomainRegistry,
  mapDomainRegistryError,
  validateDomainNameInput,
  resolveDomainStatusLabelAr,
  resolveDomainVerifiedLabelAr,
  sortDomainsForDisplay,
} = require('../../logic/domain-registry-client.js');

const EXT_ROOT = path.join(__dirname, '..', '..');
const NHP_PLATFORM = path.join(EXT_ROOT, '..');
const EMAILCORE_ADMIN = path.join(NHP_PLATFORM, '01_EmailCore/public/admin');

test('mapDomainRegistryError maps domain codes to Arabic user text', () => {
  const mapped = mapDomainRegistryError({
    code: 'DOMAIN_NOT_VERIFIED',
    message: 'Domain not verified',
    recoverable: true,
    nextAction: 'complete_verification',
  });
  assert.equal(mapped.code, 'DOMAIN_NOT_VERIFIED');
  assert.match(mapped.message, /التحقق/);
  assert.match(mapped.hint, /تحقق/);
});

test('mapDomainRegistryError maps FORBIDDEN for non-admin', () => {
  const mapped = mapDomainRegistryError({ code: 'FORBIDDEN' });
  assert.match(mapped.message, /صلاحية/);
});

test('validateDomainNameInput accepts valid domain and normalizes case', () => {
  const good = validateDomainNameInput('Example.COM');
  assert.equal(good.ok, true);
  assert.equal(good.name, 'example.com');
});

test('validateDomainNameInput rejects empty and invalid formats', () => {
  assert.equal(validateDomainNameInput('').ok, false);
  assert.equal(validateDomainNameInput('not a domain').ok, false);
  assert.equal(validateDomainNameInput('-bad.com').ok, false);
});

test('canManageDomainRegistry allows Admin only', () => {
  assert.equal(canManageDomainRegistry('Admin'), true);
  assert.equal(canManageDomainRegistry('User'), false);
  assert.equal(canManageDomainRegistry('Supervisor'), false);
});

test('resolveDomainStatusLabelAr and verified labels', () => {
  assert.equal(resolveDomainStatusLabelAr('enabled'), 'مفعّل');
  assert.equal(resolveDomainStatusLabelAr('disabled'), 'معطّل');
  assert.equal(resolveDomainVerifiedLabelAr(true), 'مُتحقق');
  assert.equal(resolveDomainVerifiedLabelAr(false), 'غير مُتحقق');
});

test('sortDomainsForDisplay orders enabled before deprecated', () => {
  const sorted = sortDomainsForDisplay([
    { name: 'z.test', status: 'deprecated' },
    { name: 'a.test', status: 'enabled' },
    { name: 'b.test', status: 'disabled' },
  ]);
  assert.deepEqual(sorted.map((d) => d.name), ['a.test', 'b.test', 'z.test']);
});

test('DOMAIN_REGISTRY_API exposes public EP-302B paths only', () => {
  assert.equal(DOMAIN_REGISTRY_API.REGISTRY_LIST, '/api/mailbox-lifecycle/domain-registry');
  assert.match(DOMAIN_REGISTRY_API.REGISTRY_ITEM, /^\/api\/mailbox-lifecycle\/domain-registry\//);
  assert.equal(DOMAIN_REGISTRY_API.DOMAINS_READ, '/api/mailbox-lifecycle/domains');
});

test('DOMAIN_REGISTRY_ACTIONS matches PATCH action contract', () => {
  assert.deepEqual(Object.values(DOMAIN_REGISTRY_ACTIONS).sort(), ['deprecate', 'disable', 'enable', 'unverify', 'verify']);
});

test('creaty.html wires domain registry quick access panel shell', () => {
  const html = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/creaty.html'), 'utf8');
  assert.match(html, /data-creaty-col2-tab="domain-registry"/);
  assert.match(html, /id="creaty-col2-panel-domain-registry"/);
  assert.match(html, /وصول سريع|domainRegistryQuickTitle/);
  assert.match(html, /id="creaty-dreg-refresh"/);
  assert.match(html, /id="creaty-dreg-content"/);
});

test('domain-registry-ui.js is Quick Access only — EmailCore SSOT auth (INT-002/INT-003)', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/domain-registry-ui.js'), 'utf8');
  const helpers = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/domain-registry-helpers.js'), 'utf8');
  assert.match(ui, /Quick Access|quick access|openDomainRegistryInWebAdmin|creaty-dreg-open-admin/i);
  assert.match(ui, /فتح في لوحة الإدارة/);
  assert.match(ui, /fetchDomainRegistrySnapshot/);
  assert.match(ui, /EMAILCORE_DOMAIN_REGISTRY_API/);
  assert.match(helpers, /EMAILCORE_DOMAIN_REGISTRY_API/);
  assert.match(helpers, /\/mailbox-lifecycle\/domain-registry/);
  assert.doesNotMatch(ui, /renderAdminShell|creaty-dreg-form-panel|patchDomainAction|saveDomainEdit/);
  assert.doesNotMatch(ui, /server_logs|mailbox-lifecycle-domains\.json|domain-registry-model/);
});

test('creaty.js switchCol2Tab includes domain-registry routing', () => {
  const js = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/creaty.js'), 'utf8');
  assert.match(js, /domain-registry/);
  assert.match(js, /initDomainRegistryUi/);
  assert.match(js, /refreshDomainRegistryUi/);
  assert.match(js, /syncAdminSidebarNav/);
});

test('creaty.html wires admin sidebar nav for domain registry quick access', () => {
  const html = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/creaty.html'), 'utf8');
  assert.match(html, /id="creaty-admin-sidebar"/);
  assert.match(html, /data-creaty-admin-nav="domain-registry"/);
  assert.match(html, /id="creaty-admin-nav-domain-registry"/);
  assert.match(html, /إدارة النطاقات/);
});

test('domain-registry-ui.js syncs admin sidebar nav visibility with Admin role', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/domain-registry-ui.js'), 'utf8');
  assert.match(ui, /creaty-admin-nav-domain-registry/);
  assert.match(ui, /syncDomainRegistryAccess/);
  assert.match(ui, /updateNavVisibility/);
});

test('EmailCore web admin index.html wires domain-registry nav (AR-09 Option A)', () => {
  const html = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'index.html'), 'utf8');
  assert.match(html, /data-route="domain-registry"/);
  assert.match(html, /id="domainRegistryNavLink"/);
  assert.match(html, /nav\.domainRegistry|Domain Management/);
  assert.match(html, /domain-registry\.css/);
});

test('EmailCore web admin admin.js registers domain-registry route with admin gating', () => {
  const js = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'js/admin.js'), 'utf8');
  assert.match(js, /domain-registry/);
  assert.match(js, /renderDomainRegistry/);
  assert.match(js, /domainRegistryNavLink/);
  assert.match(js, /route === 'domain-registry'/);
});

test('EmailCore web admin domain-registry.js uses public API paths only (PE-11/PE-12)', () => {
  const ui = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'js/domain-registry.js'), 'utf8');
  const helpers = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'js/domain-registry-helpers.js'), 'utf8');
  assert.match(ui, /DOMAIN_REGISTRY_API/);
  assert.match(ui, /registryFetch/);
  assert.match(ui, /fetchCreatyConnectionHealthOnline/);
  assert.match(ui, /CREATY_CONNECTION_HEALTH_ADMIN_PATH/);
  assert.doesNotMatch(ui, /\/creaty\/extension-token/);
  assert.match(helpers, /\/api\/mailbox-lifecycle\/domain-registry/);
  assert.doesNotMatch(ui, /server_logs|domain-registry-model/);
});

test('EmailCore web admin i18n includes domain registry nav labels (EN + AR)', () => {
  const i18n = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'js/i18n.js'), 'utf8');
  assert.match(i18n, /nav\.domainRegistry.*Domain Management/);
  assert.match(i18n, /nav\.domainRegistry.*إدارة النطاقات/);
  assert.match(i18n, /domainRegistry\.title/);
  assert.match(i18n, /domainRegistry\.restore.*Restore/);
  assert.match(i18n, /domainRegistry\.restore.*استعادة/);
});

test('EmailCore web admin domain-registry.js wires restore for deprecated domains (EP-302D)', () => {
  const ui = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'js/domain-registry.js'), 'utf8');
  const helpers = fs.readFileSync(path.join(EMAILCORE_ADMIN, 'js/domain-registry-helpers.js'), 'utf8');
  assert.match(ui, /dreg-restore/);
  assert.match(ui, /domainRegistryRestorePath/);
  assert.match(ui, /domain\.status === 'deprecated'/);
  assert.match(ui, /domainRegistry\.restore/);
  assert.match(helpers, /RESTORE:\s*'restore'/);
  assert.match(helpers, /domainRegistryRestorePath/);
  assert.match(helpers, /restore_existing_domain/);
});
