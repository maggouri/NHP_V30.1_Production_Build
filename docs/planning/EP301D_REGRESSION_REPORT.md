# EP301D Regression Report

## Scope Validated
- EP-301D permissions hardening only (API consolidation + UI role gating).
- No Oracle/DB/infra/Render changes.
- No EP-301E implementation.

## PE-07 (Pack closure)
- Documentation, automated tests, and recovery chain updated for EP-301D closure.
- Commit message: **EP-301D Complete** (closure commit `9bfab85c`).

## Files Changed
- `logic/mailbox-lifecycle-permissions.js` (new — policy source)
- `server/mailbox-lifecycle-api.js` (consolidated authz + `/session` endpoint)
- `modules/creaty/mailbox-lifecycle-helpers.js` (client policy helpers)
- `logic/mailbox-lifecycle-client.js` (CJS test mirror)
- `modules/creaty/mailbox-lifecycle-ui.js` (UI gating + role banner)
- `modules/creaty/creaty.html` (role banner shell)
- `modules/creaty/creaty.css` (role banner styles)
- `scripts/tests/ep301d-permissions.test.js` (new)
- `docs/planning/EP301D_CHARTER.md` (updated)
- `docs/planning/EP301D_CHARTER_REVIEW.md` (new)
- `docs/planning/EP301D_PERMISSIONS_REVIEW.md` (new)
- `docs/planning/EP301D_REGRESSION_REPORT.md` (this file)

## Validation Evidence

### Syntax checks
- `node --check logic/mailbox-lifecycle-permissions.js` — PASS
- `node --check server/mailbox-lifecycle-api.js` — PASS
- `node --check logic/mailbox-lifecycle-client.js` — PASS

### Combined automated tests (301A → 301D)
```
node --test scripts/tests/ep301a-model-validation.test.js scripts/tests/ep301b-mailbox-lifecycle-api.test.js scripts/tests/ep301c-mailbox-lifecycle-ui.test.js scripts/tests/ep301d-permissions.test.js
```

| Pack | Tests | Pass | Fail |
|---|---|---|---|
| EP-301A (model) | 3 | 3 | 0 |
| EP-301B (API) | 5 | 5 | 0 |
| EP-301C (UI helpers) | 6 | 6 | 0 |
| EP-301D (permissions) | 8 | 8 | 0 |
| **Total** | **22** | **22** | **0** |

Duration: ~10.4s (final closure run)

### EP-301D test inventory
| Test | Result |
|---|---|
| permissions matrix — User can mutate but not recover | PASS |
| permissions matrix — Admin cross-read and mutate | PASS |
| permissions matrix — Supervisor recover-only, no UI | PASS |
| client helpers mirror server policy | PASS |
| resolveRoleFromRequest maps roles | PASS |
| session endpoint exposes role and capabilities | PASS |
| supervisor denied mutate, allowed recover | PASS |
| user cannot read another users workflow | PASS |

## Gate Status

| Gate | Name | Status | Evidence |
|---|---|---|---|
| GD-01 | Permission | PASS | `EP301D_PERMISSIONS_REVIEW.md` |
| GD-02 | Functional | PASS | Role deny/allow tests; 301B happy paths unchanged |
| GD-03 | Regression | PASS | 22/22 tests; 301A–301C counts unchanged |
| GD-04 | Product Acceptance | PASS | Role UX documented; supervisor UI blocked; ready for 301E |

## Regression Notes
- Existing Creaty signup/orchestration routes unchanged.
- EmailCore remote endpoints unchanged.
- EP-301C 7-step journey preserved for authorized User/Admin.
- Workflow store unchanged (`server_logs/mailbox-lifecycle-workflows.json`).

## Restore Point
- EP-301C committed before EP-301D implementation: `e23cded1` — `EP-301C Complete`
- EP-301D commit: `9bfab85c` — `EP-301D Complete`
- Full recovery chain: `f63a58f` (301A) → `ec19e98` (301B) → `e23cded1` (301C) → `9bfab85c` (301D)

## Final Decision
**EP301D_CLOSED_READY_FOR_EP301E**