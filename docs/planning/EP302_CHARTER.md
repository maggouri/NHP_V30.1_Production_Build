# EP-302 Charter — Domain Management (Planning Pack)

**Status:** `AUTHORIZED_FOR_PLANNING_REVIEW`  
**Date:** 2026-07-07  
**Author:** EP-302 Planning Pack  
**Baseline:** `a507d308` (Mailbox Lifecycle v1.0 — COMPLETE)  
**Prior epic:** EP-301 — CLOSED (`MAILBOX LIFECYCLE v1.0 — COMPLETE`)

---

## Executive Summary

EP-302 delivers **Domain Management** — the operator journey that owns the policy source behind MVP item 2 (Explicit Domain Selection). Today, allowed domains are static env configuration; EP-302 introduces a managed registry, admin controls, and downstream integration with the proven mailbox lifecycle wizard.

**This charter authorizes planning review only.** Implementation requires separate CA approval (`AUTHORIZED_FOR_IMPLEMENTATION`).

---

## Problem Statement

Mailbox Lifecycle v1.0 lets Users **choose** a domain, but Operators cannot **manage** the allow-list without editing environment variables and restarting services. The domain entity includes `isVerified`, but verification is not operational. This gap blocks self-serve domain onboarding and weakens policy traceability.

---

## User Promise

> As an **Admin**, I can register, verify, enable, and disable mailbox domains through a clear Arabic interface — and Users immediately see enabled domains in the mailbox setup wizard — without editing server environment files or breaking the EP-301 journey.

> As a **User**, I continue to select from allowed domains in «إعداد البريد» with the same predictable errors and Arabic guidance as Mailbox Lifecycle v1.0.

---

## Scope (Planning Approved)

| In scope | Out of scope |
|---|---|
| Domain registry (file store) | DNS/Caddy/Render changes |
| Admin CRUD + enable/disable | Automated DNS verification |
| Registry → `GET /domains` integration | DB/Oracle migration |
| Permissions extension (Admin mutate) | Mailbox stepper redesign |
| Arabic admin UI (low-spec) | Supervisor policy override |
| AR-08 quality closure (302E) | EP-303 features |

---

## Journey Reference

Full step specification: `docs/planning/EP302_USER_JOURNEY.md`

```text
Login → Domain Registry → Review → Add/Configure → Verify → Enable → Available in Mailbox Journey
```

---

## Planning Deliverables (this pack)

| # | Document | Status |
|---|---|---|
| 1 | `EP302_DISCOVERY_REPORT.md` | ✅ |
| 2 | `EP302_USER_JOURNEY.md` | ✅ |
| 3 | `EP302_EXECUTION_PLAN.md` | ✅ |
| 4 | `EP302_PACK_BREAKDOWN.md` | ✅ |
| 5 | `EP302_CHARTER.md` | ✅ (this document) |

---

## Architecture Decisions (planning — pending CA sign-off)

1. **Additive only** — extend Creaty server `3020`; no new ports (PE-02).
2. **File store** — `server_logs/mailbox-lifecycle-domains.json`; env as bootstrap fallback.
3. **Backward compatible** — `GET /api/mailbox-lifecycle/domains` response shape unchanged.
4. **Admin-only writes** — User/Supervisor cannot mutate registry (EP-301D precedent).
5. **AR-08 mandatory** — EP-302E closes via `QUALITY_TEMPLATE_REUSABLE.md`.

Reference: `Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-08.md`

---

## Pack Breakdown Summary

| Pack | Focus | Complexity |
|---|---|---|
| **302A** | Policy contract + schema freeze | Low |
| **302B** | Registry API + persistence | Medium |
| **302C** | Admin UI «إدارة النطاقات» | Medium |
| **302D** | Permissions + EP-301 integration | Medium-High |
| **302E** | Quality Release Pack (AR-08) | Medium |

Detail: `docs/planning/EP302_PACK_BREAKDOWN.md`

---

## MVP Alignment

| MVP v1.0 item | EP-302 role |
|---|---|
| 1 — Mailbox journey | Downstream consumer unchanged |
| 2 — Domain selection | **Policy owner** — registry feeds Step 2 |
| 3 — Error envelope | Reuse + extend domain-admin codes |
| 5 — Role guardrails | Admin/User/Supervisor matrix extended |
| 6 — Low-spec UX | Lightweight admin list |

Reference: `docs/planning/MVP_v1_0_IN_SCOPE.md`

---

## Governance and Quality

| Rule | Source |
|---|---|
| Every journey closes with Quality Template | AR-08 |
| Reusable template instance | `QUALITY_TEMPLATE_REUSABLE.md` |
| Release gate framework | `RELEASE_GATES_FRAMEWORK.md` (v1.0 gates apply) |
| No half-journey ship | RV-01 |
| Pack isolation | PE-01 |
| Closure commits | PE-03: `EP-302A Complete` … `EP-302E Complete` |

### EP-302E preview (not started)

| Template item | EP-302 instance (planned) |
|---|---|
| Q-2 Baseline | Prior pack closure (302D) |
| Q-3 GE-01 E2E | `ep302e-e2e-journey.test.js` |
| Q-10 Certification | `EP302E_QUALITY_CERTIFICATION.md` |
| Q-14 Closure commit | `EP-302E Complete` |
| Final declaration | `DOMAIN MANAGEMENT v1.0 — COMPLETE` |

---

## Baseline and Recovery Chain

**Mailbox Lifecycle baseline:**

```text
a507d308 — MAILBOX LIFECYCLE v1.0 — COMPLETE (QUALITY: CERTIFIED)
```

**Recovery chain (EP-301):**

```text
f63a58f → ec19e98 → e23cded1 → 0ceaee59 → a507d308
```

EP-302 will append pack closure commits after implementation authorization.

---

## Risks (top 5)

| # | Risk | Mitigation |
|---|---|---|
| 1 | Registry/EP-301 desync | 302D integration tests; single read path |
| 2 | Admin locks out all domains | Last-active guardrail |
| 3 | Scope creep into DNS infra | Explicit non-goals; manual verify flag |
| 4 | EP-301 regression | 302E runs full 301A–301E suite |
| 5 | Mapping doc drift (EXECUTION_PACK_MAPPING) | CA to reconcile EP-302 target milestone at review |

---

## Success Criteria (epic-level)

1. Planning pack approved by Chief Architect.
2. Implementation authorized per pack (302A gate first).
3. Admin journey complete end-to-end (7 steps).
4. User mailbox selector reflects registry without restart.
5. EP-302E Quality Template checklist PASS (AR-08).
6. Zero regression on Mailbox Lifecycle v1.0 tests.
7. Final declaration: **`DOMAIN MANAGEMENT v1.0 — COMPLETE`**.

---

## Non-goals (reaffirmed)

- No implementation code in planning phase.
- No git commits until CA authorizes implementation packs.
- No infrastructure or secret model changes.
- No EP-303 planning in this charter.

---

## CA Review Checklist

| # | Item | Ready |
|---|---|---|
| 1 | Discovery report complete | ✅ |
| 2 | User journey defined (7 steps) | ✅ |
| 3 | Execution plan with rollback/recovery | ✅ |
| 4 | Pack breakdown 302A–302E | ✅ |
| 5 | AR-08 quality path mapped | ✅ |
| 6 | MVP scope alignment documented | ✅ |
| 7 | Baseline `a507d308` referenced | ✅ |
| 8 | Implementation explicitly NOT authorized | ✅ |

---

## Decision Request

**Requested CA action:** Review EP-302 planning pack and either:

- **APPROVE PLANNING** → proceed to 302A implementation authorization, or  
- **REQUEST REVISION** → specify gaps in discovery/journey/pack breakdown.

---

## Status Declaration

```text
EP-302 — DOMAIN MANAGEMENT
PLANNING: COMPLETE
STATUS: AUTHORIZED_FOR_PLANNING_REVIEW
IMPLEMENTATION: NOT AUTHORIZED
NEXT: CA REVIEW → 302A AUTHORIZATION
QUALITY FRAMEWORK: AR-08 (QUALITY_TEMPLATE_REUSABLE.md)
```
