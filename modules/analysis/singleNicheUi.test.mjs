import test from 'node:test';
import assert from 'node:assert/strict';
import { getSingleNicheLabel, buildSingleNicheSummaryText } from './singleNicheUi.mjs';

test('maps classifications to Arabic labels', () => {
  assert.equal(getSingleNicheLabel('excel'), 'ممتاز');
  assert.equal(getSingleNicheLabel('med'), 'متوسط');
  assert.equal(getSingleNicheLabel('sat'), 'مشبع');
  assert.equal(getSingleNicheLabel('emp'), 'غير معروف');
});

test('builds a compact summary from a canonical single-niche result', () => {
  const summary = buildSingleNicheSummaryText({
    niche: 'cats',
    classification: 'med',
    summary: { totalResults: 62, maxPage: 2, signals: { fromCount: 'med', fromPage: 'excel' } },
    warnings: []
  });
  assert.match(summary, /cats/);
  assert.match(summary, /متوسط/);
  assert.match(summary, /62/);
});
