const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  EMAILCORE_DOMAIN_REGISTRY_API,
  canManageDomainRegistry,
  mapDomainRegistryError,
} = require('../../logic/domain-registry-client.js');

const EXT_ROOT = path.join(__dirname, '..', '..');
const EMAILCORE_ROOT = path.join(EXT_ROOT, '..', '01_EmailCore');

test('INT-002 — canManageDomainRegistry allows Admin from EmailCore only', () => {
  assert.equal(canManageDomainRegistry('Admin'), true);
  assert.equal(canManageDomainRegistry('User'), false);
  assert.equal(canManageDomainRegistry('admin'), false);
  assert.equal(canManageDomainRegistry(''), false);
});

test('INT-002 — EMAILCORE_DOMAIN_REGISTRY_API uses creaty mailbox-lifecycle paths', () => {
  assert.equal(EMAILCORE_DOMAIN_REGISTRY_API.SESSION, '/mailbox-lifecycle/session');
  assert.equal(EMAILCORE_DOMAIN_REGISTRY_API.REGISTRY_LIST, '/mailbox-lifecycle/domain-registry');
  assert.match(EMAILCORE_DOMAIN_REGISTRY_API.REGISTRY_ITEM, /^\/mailbox-lifecycle\/domain-registry\//);
});

test('INT-002 — domain-registry-ui.js loads role via EmailCore source service (not Creaty :3020 session)', () => {
  const ui = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/domain-registry-ui.js'), 'utf8');
  assert.match(ui, /fetchDomainRegistrySnapshot/);
  assert.match(ui, /EMAILCORE_DOMAIN_REGISTRY_API/);
  assert.doesNotMatch(ui, /CREATY_SERVER_BASE/);
  assert.doesNotMatch(ui, /127\.0\.0\.1:3020.*session/);
});

test('INT-002 — missing credentials maps to AUTH_REQUIRED message', () => {
  const mapped = mapDomainRegistryError({ code: 'AUTH_REQUIRED', nextAction: 'provide_credentials' });
  assert.match(mapped.message, /User ID|رمز الوصول/);
  assert.match(mapped.hint, /Email Library|بيانات الاتصال/);
});

test('INT-002 — invalid token maps to AUTH_INVALID message', () => {
  const mapped = mapDomainRegistryError({ code: 'AUTH_INVALID' });
  assert.match(mapped.message, /غير صالحة|User ID/);
});

test('INT-002 — non-admin User gets FORBIDDEN Arabic message', () => {
  const mapped = mapDomainRegistryError({ code: 'FORBIDDEN' });
  assert.match(mapped.message, /صلاحية|مسؤول/);
});

test('INT-002 — creaty.js i18n defines domainRegistryQuickTitle and domainRegistryQuickDesc (AR + EN)', () => {
  const js = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/creaty.js'), 'utf8');
  assert.match(js, /domainRegistryQuickTitle:\s*'إدارة النطاقات — وصول سريع'/);
  assert.match(js, /domainRegistryQuickDesc:.*EmailCore Web Admin/);
  assert.match(js, /domainRegistryQuickTitle:\s*'Domain Management — Quick Access'/);
  assert.match(js, /domainRegistryQuickDesc:\s*'Full administration from EmailCore Web Admin/);
});

test('INT-002 — creaty.html uses domainRegistryQuick i18n keys (not raw fallback only)', () => {
  const html = fs.readFileSync(path.join(EXT_ROOT, 'modules/creaty/creaty.html'), 'utf8');
  assert.match(html, /data-creaty-i18n="domainRegistryQuickTitle"/);
  assert.match(html, /data-creaty-i18n="domainRegistryQuickDesc"/);
});

test('INT-002 — EmailCore exposes creaty-token session endpoint (SSOT role)', () => {
  const route = fs.readFileSync(
    path.join(EMAILCORE_ROOT, 'server/routes/creaty-mailbox-lifecycle.js'),
    'utf8',
  );
  assert.match(route, /publicRouter\.get\('\/mailbox-lifecycle\/session',\s*creatyTokenAuth/);
  assert.match(route, /mapCreatyRole\(req\.creatyUser\)/);
});

test('INT-002 — Creaty :3020 authMiddleware resolves role from EmailCore when SSOT enabled', () => {
  const api = fs.readFileSync(path.join(EXT_ROOT, 'server/mailbox-lifecycle-api.js'), 'utf8');
  assert.match(api, /createAuthMiddleware/);
  assert.match(api, /usesEmailCoreSsot\(deps\)/);
  assert.match(api, /path: '\/session'/);
});
