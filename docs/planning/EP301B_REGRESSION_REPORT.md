# EP301B Regression Report

## Scope Validated
- Backend mailbox lifecycle REST APIs only (no UI, infra, Oracle, EP-301C/D/E).
- Additive Creaty server mount under `/api/mailbox-lifecycle/*`.
- Permissions matrix enforcement (User/Admin/Supervisor).
- Unified validation via `logic/mailbox-lifecycle-model.js`.

## Files Changed
- `server/mailbox-lifecycle-api.js` (new)
- `creaty-server.js` (mount + ping version field)
- `logic/mailbox-lifecycle-model.js` (export `normalizeDomainName`, `buildDomainId`)
- `scripts/tests/ep301b-mailbox-lifecycle-api.test.js` (new)
- `docs/planning/EP301B_API_REVIEW.md` (new)
- `docs/planning/EP301B_API_DECISIONS.md` (new)
- `docs/planning/EP301B_REGRESSION_REPORT.md` (new)

## Validation Evidence

### Syntax checks
- `node --check server/mailbox-lifecycle-api.js` — PASS
- `node --check creaty-server.js` — PASS
- `node --check logic/mailbox-lifecycle-model.js` — PASS

### Tests
- `node --test scripts/tests/ep301a-model-validation.test.js`
  - pass: 3, fail: 0
- `node --test scripts/tests/ep301b-mailbox-lifecycle-api.test.js`
  - pass: 5, fail: 0

## Gate Status

| Gate | Description | Status |
|---|---|---|
| GB-01 | API Design Review | PASS |
| GB-02 | Permissions Review | PASS |
| GB-03 | Validation Review | PASS |
| GB-04 | Regression Validation | PASS |

## Regression Notes
- Existing Creaty signup/orchestration routes unchanged.
- EmailCore remote endpoints remain authoritative for mailbox creation.
- EP-301A model tests remain green after additive export extension.
- Workflow store is isolated in `server_logs/mailbox-lifecycle-workflows.json`.

## Restore Point
- EP-301A committed before EP-301B implementation: `f63a58f` — `EP-301A Complete`

## Final Decision
READY_FOR_EP301C
