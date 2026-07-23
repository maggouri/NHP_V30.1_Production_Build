# EP302A Regression Report

**Pack:** EP-302A — Domain Policy Contract + Registry Model  
**Baseline:** `a507d308`  
**Date:** 2026-07-07  
**Status:** Implementation complete — pending CA review

---

## Scope Validated

- Domain registry model and logic-layer CRUD only (no API/UI/infra/DNS changes).
- Added standalone registry contract and compatibility tooling:
  - `logic/domain-registry-model.js`
  - `scripts/migrations/ep302a-migrate-domain-registry.js`
  - `scripts/tests/ep302a-domain-registry.test.js`
- Planning deliverables:
  - `docs/planning/EP302A_MODEL_REVIEW.md`
  - `docs/planning/EP302A_DATABASE_DECISIONS.md`
  - `docs/planning/EP302A_REGRESSION_REPORT.md` (this document)

### Out of scope (confirmed untouched)

- `server/mailbox-lifecycle-api.js` — still reads env only (302B integration)
- DNS / MX / SPF / DKIM / HTTPS / Oracle
- Admin UI and permission extensions (302C / 302D)

---

## Validation Evidence

| Check | Command | Result |
|---|---|---|
| Model syntax | `node --check logic/domain-registry-model.js` | PASS |
| Migration syntax | `node --check scripts/migrations/ep302a-migrate-domain-registry.js` | PASS |
| 302A tests | `node --test scripts/tests/ep302a-domain-registry.test.js` | 15 pass / 0 fail |
| EP-301 regression | `node --test scripts/tests/ep301*.test.js` | 39 pass / 0 fail |
| Combined | All EP-301 + EP-302A | **54 pass / 0 fail** |
| Migration dry-run | `node scripts/migrations/ep302a-migrate-domain-registry.js --env "emailcore.app,alpha.test" --dry-run` | PASS |

---

## GA Gates (302A)

- **GA-01 Schema Review:** PASS  
  Current vs proposed registry schema, entity fields, state transitions, and error taxonomy documented in `EP302A_MODEL_REVIEW.md`.

- **GA-02 Migration Review:** PASS  
  Optional offline migration from `NHP_MAILBOX_ALLOWED_DOMAINS` → `server_logs/mailbox-lifecycle-domains.json`; backup on overwrite; env fallback when registry empty.

- **GA-03 Regression Validation:** PASS  
  Full EP-301 suite (39 tests) green alongside 15 new 302A tests — zero regression detected.

- **GA-04 Architecture Approval Readiness:** PASS  
  Storage decisions, precedence rules, rejected alternatives, and risks documented in `EP302A_DATABASE_DECISIONS.md`.

---

## Impact Notes

- **Backward compatibility:** Deployments without registry file behave identically to pre-302A (env-only allow-list).
- **PE-09 alignment:** Domain policy path defined as managed JSON registry; env remains bootstrap until migration + 302B wiring.
- **No runtime behavior change** until 302B connects registry to `GET /api/mailbox-lifecycle/domains`.
- Migration seeds env domains as `enabled + verified` to preserve current `isVerified: true` semantics.

---

## Final Decision

**READY_FOR_EP302B**

Registry model, storage contract, validation, CRUD logic, migration tooling, and regression evidence are complete. Next pack (302B) may wire registry read/write into the mailbox lifecycle API.
