/**
 * Auto account binding — SSOT AuthBridge + no admin fallback + unauth messaging.
 * Run: node scripts/tests/auto-account-binding.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`OK  ${name}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// --- Static guards ---
{
  const handlers = read('emailcore-handlers.js');
  assert.doesNotMatch(handlers, /DEFAULT_EMAILCORE_CREATY_USER_ID/, 'no hardcoded admin userId');
  assert.doesNotMatch(handlers, /DEFAULT_EMAILCORE_CREATY_TOKEN/, 'no hardcoded admin token');
  assert.doesNotMatch(handlers, /b39b3d326f5e7b4f9cfdaddea38b208bacafe27994470739/, 'admin HMAC token removed');
  assert.match(handlers, /EmailCoreAuthBridge|resolveExtensionBoundCreds/, 'handlers use AuthBridge path');
  ok('emailcore-handlers has no admin defaults');
}

{
  const notes = read('modules/note/note.js');
  assert.doesNotMatch(notes, /Access Token\) و User ID/, 'notes no Access Token+User ID toast');
  assert.match(notes, /سجّل الدخول بنفس الحساب في الموقع والإضافة/, 'notes unauth message');
  ok('notes unauth copy');
}

{
  const bridgeSrc = read('utils/emailcore-auth-bridge.js');
  assert.match(bridgeSrc, /getCurrentAuthenticatedAccount/, 'SSOT export present');
  assert.match(bridgeSrc, /MSG_NOT_AUTHENTICATED_AR/, 'AR unauth message');
  assert.doesNotMatch(bridgeSrc, /DEFAULT_EMAILCORE_CREATY/, 'bridge no admin defaults');
  ok('auth bridge SSOT surface');
}

{
  const extPublic = read(
    path.join(
      '..',
      'NHP_Backups',
      'NHP_V30.1_Production_Build',
      'NHP_PLATFORM',
      '01_EmailCore',
      'server',
      'routes',
      'extension-public.js'
    )
  );
  // Prefer workspace EmailCore path when Desktop Ext test runs from Desktop folder
}
{
  const candidates = [
    path.join(ROOT, '..', 'NHP_Backups', 'NHP_V30.1_Production_Build', 'NHP_PLATFORM', '01_EmailCore', 'server', 'routes', 'extension-public.js'),
    'C:/Users/MAGGOURIKHALID/Desktop/NHP_Backups/NHP_V30.1_Production_Build/NHP_PLATFORM/01_EmailCore/server/routes/extension-public.js',
  ];
  const extPublicPath = candidates.find((p) => fs.existsSync(p));
  assert.ok(extPublicPath, 'extension-public.js found');
  const extPublic = fs.readFileSync(extPublicPath, 'utf8');
  assert.match(extPublic, /x-extension-session/, 'extension-public accepts session');
  assert.match(extPublic, /validateExtensionSession/, 'session validator used');
  ok('EmailCore requireCreatyUser session-aware');
}

{
  const manifest = JSON.parse(read('manifest.json'));
  assert.strictEqual(manifest.version, '40.0.25');
  ok('manifest version 40.0.25');
}

// --- Runtime AuthBridge behavior (mocked chrome.storage) ---
{
  const storage = {};
  const chromeMock = {
    storage: {
      local: {
        get: (keys, cb) => {
          const out = {};
          const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
          for (const k of list) out[k] = storage[k];
          cb(out);
        },
        set: (patch, cb) => {
          Object.assign(storage, patch);
          if (cb) cb();
        },
      },
    },
  };
  const sandbox = { self: {}, chrome: chromeMock, console, setTimeout, clearTimeout };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('utils/emailcore-auth-bridge.js'), sandbox);
  const Bridge = sandbox.EmailCoreAuthBridge;
  assert.ok(Bridge, 'bridge global');

  (async () => {
    const empty = await Bridge.getCurrentAuthenticatedAccount({ service: 'test' });
    assert.strictEqual(empty.authenticated, false);
    assert.strictEqual(empty.connectionState, 'not_authenticated');
    assert.match(empty.messageAr, /سجّل الدخول بنفس الحساب/);
    assert.doesNotMatch(empty.messageAr, /Access Token/);
    ok('unauthenticated account state');

    storage.emailcore_session_token = 'sess.member.token';
    storage.emailcore_session_user_id = '42';
    storage.emailcore_session_role = 'member';
    storage.emailcore_session_username = 'member_a';
    storage.emailcore_creaty_api_base = 'https://emailcore.app';

    const member = await Bridge.getCurrentAuthenticatedAccount({ service: 'creaty' });
    assert.strictEqual(member.authenticated, true);
    assert.strictEqual(member.userId, '42');
    assert.strictEqual(member.accountId, '42');
    assert.strictEqual(member.role, 'member');
    assert.strictEqual(member.authSource, 'extension_session');
    assert.notStrictEqual(member.userId, '8');
    ok('member session binds own accountId (no admin fallback)');

    storage.emailcore_session_token = 'sess.admin.token';
    storage.emailcore_session_user_id = '8';
    storage.emailcore_session_role = 'admin';
    const admin = await Bridge.getCurrentAuthenticatedAccount({ service: 'notes' });
    assert.strictEqual(admin.role, 'admin');
    assert.strictEqual(admin.userId, '8');
    assert.strictEqual(admin.authSource, 'extension_session');
    ok('admin uses same bridge');

    const classified = Bridge.classifyHttpError(403, { error: 'admin permission required' });
    assert.strictEqual(classified.errorCode, 'permission_denied');
    assert.doesNotMatch(classified.error, /Access Token/i);
    ok('permission error distinct from missing token');

    const down = Bridge.classifyHttpError(503, {});
    assert.strictEqual(down.errorCode, 'server_unavailable');
    ok('server unavailable classified');

    console.log(`\n${passed} assertions passed — AUTO_ACCOUNT_BINDING tests OK`);
  })().catch((err) => {
    console.error('FAIL', err);
    process.exit(1);
  });
}
