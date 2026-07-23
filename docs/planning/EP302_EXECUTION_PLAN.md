# EP-302 Execution Plan — Domain Management

**Epic:** EP-302 — Domain Management  
**Status:** Planning — AUTHORIZED FOR PLANNING REVIEW  
**Baseline:** `a507d308` (Mailbox Lifecycle v1.0 — COMPLETE)  
**Recovery chain:** `f63a58f` → `ec19e98` → `e23cded1` → `0ceaee59` → `a507d308`  
**Quality framework:** AR-08 → `QUALITY_TEMPLATE_REUSABLE.md`

---

## Objective

Deliver a complete **Domain Management** operator journey:

`Login → Domain Registry → Review → Add/Configure → Verify → Enable → Available in Mailbox Journey`

using the existing Creaty server architecture, extending EP-301 domain selection with a **managed registry** instead of env-only policy.

---

## Scope

- Domain registry persistence (file store, additive to EP-301B pattern).
- Admin API for list/add/update/enable/disable domain entries.
- Admin UI panel for domain registry operations (Arabic, low-spec friendly).
- Wire `GET /api/mailbox-lifecycle/domains` to registry (enabled domains only for User-facing list).
- Extend permissions module with domain-management actions.
- Automated tests per pack (302A–302E) and AR-08 Release Pack (302E).
- Documentation pack (EP302*) and gate evidence.

### MVP alignment

| MVP item | EP-302 contribution |
|---|---|
| **2 — Explicit Domain Selection** | Owns policy source behind Step 2; selection UX remains EP-301C |
| **3 — Validation envelope** | Reuse existing codes + additive domain-admin codes |
| **5 — Role guardrails** | Admin-only mutations; User read/select |
| **6 — Low-spec UX** | Lightweight admin list; no heavy polling |

---

## Non-goals

- No DNS/Caddy/Render platform changes (`MVP_v1_0_OUT_OF_SCOPE.md` §1–2).
- No Oracle/DB migration — file store only (PE-02).
- No automated external DNS verification in MVP slice.
- No redesign of mailbox lifecycle stepper UI (EP-301C frozen behavior).
- No Supervisor domain policy override.
- No EP-303 lifecycle/governance features.
- **No implementation in this planning phase.**

---

## Impact Analysis

### Architecture

- Add domain registry module alongside workflow store.
- Registry becomes read source for `buildDomainList()` with env fallback.
- Admin mutations isolated behind new permission actions.

### Database / persistence

- New logical file: `server_logs/mailbox-lifecycle-domains.json` (proposed).
- No breaking change to workflow store or account keys.
- Env `NHP_MAILBOX_ALLOWED_DOMAINS` retained as bootstrap/ disaster fallback.

### API

- Extend `/api/mailbox-lifecycle/*` namespace (additive).
- Proposed endpoints (302B — subject to CA review):

| Method | Route | Role | Purpose |
|---|---|---|---|
| GET | `/api/mailbox-lifecycle/domain-registry` | Admin | Full registry (all statuses) |
| POST | `/api/mailbox-lifecycle/domain-registry` | Admin | Add domain |
| PATCH | `/api/mailbox-lifecycle/domain-registry/:id` | Admin | Update metadata / verify / status |
| GET | `/api/mailbox-lifecycle/domains` | User/Admin | Enabled domains (existing contract) |

### UI

- New admin section: «إدارة النطاقات» in admin panel or Creaty admin tab.
- Mailbox wizard unchanged except data source.
- Arabic labels; PE-04 compliance.

### Oracle / AI impact

- None for authoritative state. Supervisor may assist UI recovery only (EP-301D precedent).

---

## Rollback Plan

- Feature flag: `NHP_DOMAIN_REGISTRY_ENABLED` (default off until 302C gate).
- On rollback:
  1. Disable registry reads; revert to env-only `readAllowedDomains()`.
  2. Hide admin domain panel.
  3. Preserve registry file (non-destructive).
- Mailbox journey continues with env allow-list — no data loss for workflows.

---

## Recovery Plan

- Registry write failure → fail closed; env fallback serves last-known-good allow-list.
- Corrupt registry file → restore from backup copy; seed from env if needed.
- Admin disables all domains → block with `DOMAIN_LAST_ACTIVE` guardrail.
- Mid-journey domain disable → User sees `DOMAIN_NOT_ALLOWED` on next step (existing handling).

---

## Success Criteria

| # | Criterion |
|---|---|
| SC-1 | Admin completes 7-step Domain Management journey end-to-end |
| SC-2 | Enabled domain appears in User mailbox selector without restart |
| SC-3 | Disabled/deprecated domains hidden from User list |
| SC-4 | Standard error envelope on all failure paths |
| SC-5 | Permissions matrix enforced (302D evidence) |
| SC-6 | Zero regression on EP-301E test suite (301A–301E green) |
| SC-7 | EP-302E Quality Template checklist complete (AR-08) |
| SC-8 | Final declaration: `DOMAIN MANAGEMENT v1.0 — COMPLETE` |

---

## Time-to-Policy-Active (Target)

- **Primary target:** ≤ 60 seconds from Admin login to enabled domain visible in User selector (local Creaty).
- **Acceptable with manual verification step:** ≤ 120 seconds including operator checklist.

---

## Execution Gates

### GV-01 UX Gate (EP-302)

- Admin registry understandable in Arabic.
- Enable/disable consequences clear.
- Empty registry shows guided first-domain path.

### GV-02 Functional Gate

- Full admin journey passes happy path.
- Downstream mailbox domain selection reflects registry.
- Guardrails (last domain, unverified enable) enforced.

### GV-03 Regression Gate

- EP-301E suite remains green.
- No critical low-spec regression (302E performance smoke).

### GV-04 Product Acceptance Gate

- CA sign-off on Domain Management as complete story (RV-01).
- Documentation cross-links consistent (GE-03).
- EP-302E closure commit issued.

---

## Pack Sequence

```text
302A → 302B → 302C → 302D → 302E
```

See `EP302_PACK_BREAKDOWN.md` for deliverables per pack.

---

## Planning → Implementation Gate (CA)

| Gate | Requirement |
|---|---|
| GR-02 Planning review | `EP302_CHARTER.md` approved |
| Baseline lock | `a507d308` confirmed |
| AR-08 acknowledged | 302E template mapped before 302A implementation |
| Implementation authorization | Explicit CA `AUTHORIZED_FOR_IMPLEMENTATION` — **not yet issued** |

---

## Implementation Readiness Notes

- Architecture baseline from EP-301 is sufficient for additive registry.
- Domain entity and validation exist in `mailbox-lifecycle-model.js`.
- Permissions module ready for extension.
- Required work: registry persistence, admin API/UI, integration, quality pack.
- **Current phase: planning only — await CA review.**
