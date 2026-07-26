/**
 * Regression: TeeMaster / library upload must preserve niche identity.
 * Run: node scripts/test-teemaster-niche-preserve.js
 */
'use strict';

const path = require('path');
const assert = require('assert');

const {
  sanitizeLibraryTitleCandidate,
  isTechnicalLibraryTitle,
  resolveLibraryNicheFromId
} = require('../server/library-smart-rename');

function buildStudioPayload(item) {
  const nicheName = String(item.nicheName || item.niche || item.displayName || '').trim();
  const nicheId = String(item.nicheId || '').trim();
  const displayName = nicheName || String(item.displayName || '').trim();
  return {
    name: `canva_${item.storageId || 'lib'}_d${item.designIndex || 1}.png`,
    libraryId: item.id || null,
    displayName,
    nicheName: nicheName || displayName,
    niche: nicheName || displayName,
    nicheId: nicheId || undefined
  };
}

// Technical stems must never become niche titles
assert.strictEqual(isTechnicalLibraryTitle('canva_abc123_d1'), true);
assert.strictEqual(isTechnicalLibraryTitle('gen_abc_d2'), true);
assert.strictEqual(sanitizeLibraryTitleCandidate('canva_abc123_d1'), '');
assert.strictEqual(sanitizeLibraryTitleCandidate('Lebron James 76ers'), 'Lebron James 76ers');

// Send-only payload must carry niche even when technical file stem is used
const payload = buildStudioPayload({
  id: 'lib_x__d1',
  storageId: 'lib_x',
  designIndex: 1,
  nicheName: 'Lebron James 76ers',
  nicheId: 'niche_1',
  displayName: 'Lebron James 76ers'
});
assert.strictEqual(payload.name.startsWith('canva_'), true, 'link stem stays technical');
assert.strictEqual(payload.nicheName, 'Lebron James 76ers');
assert.strictEqual(payload.displayName, 'Lebron James 76ers');
assert.strictEqual(payload.nicheId, 'niche_1');

// Inherit niche from original when edited upload omits nicheName
const fakeIndex = [
  {
    id: 'lib_orig__d1',
    storageId: 'lib_orig',
    nicheName: 'Lebron James 76ers',
    nicheId: 'n76',
    displayName: 'Lebron James 76ers'
  }
];
const inherited = resolveLibraryNicheFromId('lib_orig__d1', {
  readLibraryIndex: () => fakeIndex,
  readLibraryMeta: () => null,
  libraryDir: path.join(__dirname, '_no_lib')
});
assert.strictEqual(inherited.nicheName, 'Lebron James 76ers');
assert.strictEqual(inherited.nicheId, 'n76');

console.log('✅ TeeMaster niche preserve regression OK');
