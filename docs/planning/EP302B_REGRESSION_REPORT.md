# EP302B Regression Report

**Pack:** EP-302B — Domain Registry API and Persistence  
**Baseline:** `d0844f3a` (EP-302A closed)  
**Date:** 2026-07-07  
**Status:** Implementation complete — pending CA review

---

## Scope Validated

- Service-layer domain registry REST APIs (no UI, DNS, infra, Oracle).
- Extended `server/mailbox-lifecycle-api.js` with Admin CRUD under `/api/mailbox-lifecycle/domain-registry`.
- Wired `GET /api/mailbox-lifecycle/domains` and workflow domain validation to registry with env fallback.
- Atomic UTF-8 writes to `server_logs/mailbox-lifecycle-domains.json`.

### Out of scope (confirmed untouched)

- Admin UI (302C)
- DNS/MX/SPF/DKIM verification
- Permission module extensions (`MANAGE_DOMAINS` — 302D)
- `creaty-server.js` route mount unchanged (uses existing lifecycle registration)

---

## Files Changed

- `logic/domain-registry-model.js` — atomic save (temp + rename)
- `server/mailbox-lifecycle-api.js` — registry read path + Admin CRUD endpoints
- `scripts/tests/ep302b-domain-api.test.js` (new)
- `docs/planning/EP302B_API_REVIEW.md` (new)
- `docs/planning/EP302B_API_DECISIONS.md` (new)
- `docs/planning/EP302B_REGRESSION_REPORT.md` (new)

---

## Validation Evidence

| Check | Command | Result |
|---|---|---|
| API syntax | `node --check server/mailbox-lifecycle-api.js` | PASS |
| Model syntax | `node --check logic/domain-registry-model.js` | PASS |
| EP-301 regression | `node --test scripts/tests/ep301*.test.js` | 39 pass / 0 fail |
| EP-302A regression | `node --test scripts/tests/ep302a-domain-registry.test.js` | 15 pass / 0 fail |
| EP-302B tests | `node --test scripts/tests/ep302b-domain-api.test.js` | 9 pass / 0 fail |
| Combined | EP-301 + EP-302A + EP-302B | **63 pass / 0 fail** |

---

## Gate Status

| Gate | Description | Status |
|---|---|---|
| GB-01 | API Design Review | PASS |
| GB-02 | Permissions Review | PASS |
| GB-03 | Validation Review | PASS |
| GB-04 | Regression Validation | PASS |

---

## Regression Notes

- Empty registry → env-only behavior identical to pre-302B (EP-301B tests green).
- Populated registry → authoritative for domain list and workflow domain choice.
- Admin-only mutations return 403 for User/Supervisor.
- Soft delete maps to `deprecated` status (no hard row removal).
- Workflow store and EmailCore integration unchanged.

---

## Restore Point

- EP-302A closure baseline: `d0844f3a`

---

## Final Decision

**READY_FOR_EP302C**

Domain registry API, persistence wiring, backward-compatible read path, and full regression evidence are complete. Next pack (302C) may implement Admin «إدارة النطاقات» UI against these endpoints.
