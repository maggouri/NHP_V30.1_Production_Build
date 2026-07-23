# EP-302 Pack Breakdown — Domain Management

**Epic:** EP-302  
**Baseline:** `a507d308`  
**Dependency:** EP-301 (Mailbox Lifecycle v1.0 — COMPLETE)  
**Quality closure:** AR-08 → EP-302E uses `QUALITY_TEMPLATE_REUSABLE.md`

---

## 302A — Discovery Freeze and Domain Policy Contract

- **Objective:** Freeze EP-302 functional contract, domain entity states, and registry rules.
- **Dependencies:** EP-301 complete; `EP302_DISCOVERY_REPORT.md` baseline facts.
- **Files (planning / future touch):**
  - `docs/planning/EP302_DISCOVERY_REPORT.md`
  - `docs/planning/EP302_USER_JOURNEY.md`
  - `docs/planning/EP302_EXECUTION_PLAN.md`
  - `docs/planning/EP302_PACK_BREAKDOWN.md`
  - `docs/planning/EP302_CHARTER.md`
  - `logic/mailbox-lifecycle-model.js` (domain status fields — implementation)
- **Complexity:** Low.
- **Deliverables:**
  - Approved domain registry schema (entity + states).
  - Transition rules: disabled → verified → enabled → deprecated.
  - Error code taxonomy for domain admin actions.
  - Env fallback vs registry precedence documented.
- **Gate:** CA approves planning pack → `AUTHORIZED_FOR_IMPLEMENTATION` for 302B+.
- **Closure commit (future):** `EP-302A Complete`

---

## 302B — Domain Registry API and Persistence

- **Objective:** Implement registry storage and Admin CRUD API; wire read path for mailbox domain list.
- **Dependencies:**
  - 302A approved contracts.
  - Existing `/api/mailbox-lifecycle/domains` contract (EP-301B).
- **Files (expected implementation area):**
  - `server/mailbox-lifecycle-api.js`
  - `logic/mailbox-lifecycle-model.js`
  - `server_logs/mailbox-lifecycle-domains.json` (runtime artifact)
  - `scripts/tests/ep302b-domain-registry-api.test.js`
- **Complexity:** Medium.
- **Deliverables:**
  - Registry file store with atomic writes.
  - Admin endpoints: list (full), add, patch (verify/enable/disable).
  - `buildDomainList()` reads enabled+verified domains from registry.
  - Env bootstrap on empty registry.
  - API tests: happy path, duplicate, forbidden, last-active guardrail.
- **Closure commit (future):** `EP-302B Complete`

---

## 302C — Domain Management UI (Admin)

- **Objective:** Admin-facing «إدارة النطاقات» panel wired to 302B API.
- **Dependencies:**
  - 302B API stable.
  - Admin auth path from `modules/admin/admin.js` or Creaty admin surface.
- **Files (expected implementation area):**
  - `modules/admin/admin.js` and/or `modules/creaty/` admin extension
  - New: `modules/creaty/domain-registry-ui.js` (proposed)
  - `modules/creaty/creaty.html` (admin section mount)
  - `scripts/tests/ep302c-domain-ui.test.js` (logic/DOM contract tests)
- **Complexity:** Medium.
- **Deliverables:**
  - Registry list view with status badges.
  - Add/edit domain form (Arabic).
  - Verify + enable/disable actions with error feedback.
  - PE-05 human sign-off slot for admin UX review.
- **Closure commit (future):** `EP-302C Complete`

---

## 302D — Permissions and Mailbox Integration Hardening

- **Objective:** Enforce domain-admin authorization; prove EP-301 journey consumes registry correctly.
- **Dependencies:**
  - 302B API + 302C UI contract-stable.
  - EP-301D permissions baseline.
- **Files (expected implementation area):**
  - `logic/mailbox-lifecycle-permissions.js`
  - `server/mailbox-lifecycle-api.js`
  - `modules/creaty/mailbox-lifecycle-ui.js` (integration verification only)
  - `docs/planning/EP302D_PERMISSIONS_REVIEW.md` (future)
  - `scripts/tests/ep302d-permissions.test.js`
- **Complexity:** Medium-High.
- **Deliverables:**
  - New actions: `MANAGE_DOMAINS`, `VIEW_DOMAIN_REGISTRY`, `ENABLE_DOMAIN`, `DISABLE_DOMAIN`.
  - Admin-only mutation enforcement (403 on User/Supervisor writes).
  - Cross-journey test: enable domain → User selector updated.
  - Permissions matrix document + regression evidence.
- **Closure commit (future):** `EP-302D Complete`

---

## 302E — Quality, Regression, and Release (AR-08 Release Pack)

- **Objective:** Validate complete Domain Management journey; close epic per **AR-08 Quality Template**.
- **Dependencies:**
  - 302B–302D complete.
  - `QUALITY_TEMPLATE_REUSABLE.md` adapted for EP-302.
- **Files (expected):**
  - `docs/planning/EP302E_CHARTER.md`
  - `docs/planning/EP302E_QUALITY_CERTIFICATION.md`
  - `docs/planning/EP302E_REGRESSION_REPORT.md`
  - `docs/planning/EP302E_RELEASE_REPORT.md`
  - `scripts/tests/ep302e-e2e-journey.test.js`
  - `scripts/tests/ep302e-permissions-matrix.test.js`
  - `scripts/tests/ep302e-performance-smoke.test.js`
  - `scripts/tests/ep302e-messages-errors.test.js`
- **Complexity:** Medium.
- **Deliverables:**
  - GE-01: Admin domain journey + User downstream E2E.
  - GE-02: 302A–302D + 301A–301E combined regression green.
  - GE-03: EP302* documentation consistency.
  - GE-04: Release readiness + CA declaration.
  - Final status: **`DOMAIN MANAGEMENT v1.0 — COMPLETE`**
- **Closure commit (future):** `EP-302E Complete`

---

## Dependency Chain

```text
302A → 302B → 302C → 302D → 302E
```

### Parallelism allowance

- 302D permissions design can start after 302B API contract is stable (partial overlap).
- 302E test scaffolding may be drafted during 302C, but gate evidence requires 302D complete.
- 302C UI mock review (PE-05) can run in parallel with late 302B API hardening.

---

## Complexity Rationale

| Pack | Risk driver |
|---|---|
| 302A | Low — documentation and contract freeze |
| 302B | Medium — persistence correctness + backward compatible domain list |
| 302C | Medium — Arabic admin UX + error surfacing |
| 302D | High — cross-layer authz + EP-301 integration regression |
| 302E | Medium — full gate chain + AR-08 template compliance |

Highest risk sits in **302D** (registry ↔ mailbox journey sync) and **302E** (zero regression on 301A–301E).

---

## Recovery Chain (projected)

```text
a507d308 (301E baseline)
  → [302A closure]
  → [302B closure]
  → [302C closure]
  → [302D closure]
  → [302E closure] — DOMAIN MANAGEMENT v1.0 — COMPLETE
```

---

## Comparison to EP-301 Pack Pattern

| EP-301 | EP-302 | Theme |
|---|---|---|
| 301A Discovery/workflow contract | 302A Domain policy contract | Freeze |
| 301B Domain + mailbox API | 302B Domain registry API | Backend |
| 301C Validation/UI/Ready | 302C Admin domain UI | Frontend |
| 301D Permissions hardening | 302D Permissions + integration | Policy |
| 301E Quality Release Pack | 302E Quality Release Pack (AR-08) | Closure |
