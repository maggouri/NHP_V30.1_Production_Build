# EP-302 Discovery Report — Domain Management

**Epic:** EP-302 — Domain Management  
**Status:** Planning (AUTHORIZED FOR PLANNING REVIEW)  
**Baseline:** `a507d308` (Mailbox Lifecycle v1.0 — COMPLETE)  
**Date:** 2026-07-07  
**Methodology:** Planning → Review → Implementation → Quality → Release (per AR-08)

---

## 1) Current Architecture Analysis

### 1.1 Domain data flow today (post EP-301)

Mailbox Lifecycle v1.0 delivers **domain selection** as Step 2 of the mailbox journey. Domain **management** is not yet a first-class operator journey.

| Layer | Component | Domain behavior today |
|---|---|---|
| Config | `NHP_MAILBOX_ALLOWED_DOMAINS` env var | Static comma-separated allow-list; default `emailcore.app` |
| Model | `logic/mailbox-lifecycle-model.js` | `domain { id, name, isVerified }` entity + validation |
| API | `server/mailbox-lifecycle-api.js` | `GET /api/mailbox-lifecycle/domains` → `buildDomainList()` from env |
| API | `POST .../workflows` (domain bind) | `validateDomainChoice()` against env allow-list |
| Permissions | `logic/mailbox-lifecycle-permissions.js` | `LIST_DOMAINS`, `CHANGE_DOMAIN` — User/Admin only |
| UI | `modules/creaty/mailbox-lifecycle-ui.js` | Domain `<select>` in «إعداد البريد» wizard |
| Tests | `scripts/tests/ep301e-*.test.js` | Domain list + policy errors covered in E2E |

### 1.2 Relevant endpoint map (existing — read-only for EP-302 planning)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/mailbox-lifecycle/domains` | List allowed domains for mailbox journey |
| POST | `/api/mailbox-lifecycle/workflows` | Bind selected domain to workflow |
| GET | `/api/mailbox-lifecycle/session` | Role + capabilities (includes domain actions) |

**Not present:** domain CRUD, enable/disable, verification workflow, admin registry UI, audit trail for domain policy changes.

### 1.3 Frontend surfaces

- **Creaty mailbox wizard** (`mailbox-lifecycle-ui.js`) — consumes domain list; Arabic labels for step «اختيار النطاق».
- **Admin panel** (`modules/admin/admin.js`) — no domain management section today.
- **Auth** (`modules/auth.js`) — role resolution unchanged; Admin gating via `NHP_MAILBOX_ADMIN_USER_IDS`.

### 1.4 Persistence model observed

- Workflows: `server_logs/mailbox-lifecycle-workflows.json` (file store, EP-301B decision).
- Domains: **no persistent registry** — derived at runtime from environment only.
- `isVerified` field exists in model/API response but is **always `true`** (placeholder).

---

## 2) Permissions Matrix (Domain Management — proposed)

Extends EP-301D matrix with domain-administration actions. Supervisor remains non-authoritative for policy.

| Capability | User | Admin | Supervisor |
|---|---|---|---|
| List domains (mailbox journey) | Yes | Yes | Yes (read-only assist) |
| Choose domain in workflow | Yes | Yes | No |
| View domain registry (admin view) | No | Yes | No |
| Add domain to registry | No | Yes | No |
| Enable / disable domain | No | Yes | No |
| Mark domain verified / unverified | No | Yes | No |
| Delete domain (soft-disable preferred) | No | Yes | No |
| Override domain policy in workflow | No | No | No |
| Recover stuck domain-validation UI | No | No | Yes (assistive only) |

**Notes:**
- User sees only **enabled** domains in mailbox journey selector.
- Admin changes must propagate to mailbox lifecycle without server restart (gap vs current env-only model).
- Supervisor cannot add/remove domains or bypass allow-list (consistent with EP-301D).

---

## 3) Gaps, Risks, Opportunities

### 3.1 Gaps

| # | Gap | Impact |
|---|---|---|
| G-1 | No persistent domain registry | Requires env edit + restart to add domains |
| G-2 | No admin UI for domain policy | Operators cannot self-serve domain onboarding |
| G-3 | `isVerified` is cosmetic | No real verification gate before enable |
| G-4 | No domain lifecycle states | Cannot deprecate/block domains without env change |
| G-5 | No audit log for domain changes | Weak traceability for policy drift |
| G-6 | No dedicated Domain Management user journey | MVP item 2 satisfied for *selection* only, not *management* |
| G-7 | EXECUTION_PACK_MAPPING lists EP-302 as v1.1 TBD | CA has repositioned EP-302 as Domain Management epic — mapping update deferred to CA review |

### 3.2 Risks

| # | Risk | Mitigation (planning) |
|---|---|---|
| R-1 | Breaking mailbox journey if registry out of sync with env | 302B: env as fallback seed; migration path documented |
| R-2 | Admin misconfiguration blocks all users | Require ≥1 enabled domain; block disable of last active domain |
| R-3 | File-store corruption (same pattern as workflows) | Atomic writes; backup on change; regression tests |
| R-4 | Scope creep into DNS/infra verification | Explicit non-goals; manual verified flag for MVP slice |
| R-5 | Permission drift across UI/API | Single policy module extension (302D) |
| R-6 | Low-spec regression from extra admin UI | Lazy load admin domain panel; bounded list rendering |

### 3.3 Opportunities

- Complete MVP narrative for **MVP item 2** (Explicit Domain Selection) by owning the **policy source** behind selection.
- Reuse EP-301 error envelope and domain entity model — additive only.
- Feed mailbox lifecycle `GET /domains` from managed registry (backward compatible response shape).
- Establish EP-302 as second reference journey for **AR-08 Quality Template** closure.
- Enable future v1.1 items (batch verification, operational insights) without redesigning registry.

---

## 4) Architectural Decisions for EP-302 (planning — pending CA approval)

1. **No infrastructure rework** — same Creaty server (`3020`), file-based persistence pattern as EP-301B (PE-02).
2. **Additive API namespace** — extend `/api/mailbox-lifecycle/domains` or add `/api/mailbox-lifecycle/domain-registry/*` (302B decision gate).
3. **Registry-backed allow-list** — runtime reads registry first; `NHP_MAILBOX_ALLOWED_DOMAINS` remains bootstrap/fallback.
4. **Domain entity states** — `enabled`, `disabled`, `deprecated` (minimum); `isVerified` operator-set in MVP slice.
5. **Admin-only mutations** — all registry writes require Admin role; standard error envelope.
6. **Mailbox journey unchanged in contract** — response shape `{ id, name, isVerified }` preserved for EP-301 consumers.
7. **Quality closure per AR-08** — EP-302E must use `QUALITY_TEMPLATE_REUSABLE.md`; closure commit `EP-302E Complete`.

---

## 5) Architecture Impact Summary

| Area | Impact |
|---|---|
| **API** | New registry CRUD endpoints; `GET /domains` reads from registry |
| **Persistence** | New `server_logs/mailbox-lifecycle-domains.json` (proposed) |
| **Model** | Extend domain entity with status, timestamps, optional notes |
| **Permissions** | New actions: `MANAGE_DOMAINS`, `ENABLE_DOMAIN`, `DISABLE_DOMAIN` |
| **UI** | Admin domain registry panel; mailbox wizard unchanged (data source only) |
| **Tests** | New pack scripts `ep302a-*` … `ep302e-*` per breakdown |
| **Docs** | EP302* planning pack + future pack charters |

---

## 6) PV-01 / PE Alignment (from EP-301 precedent)

| Principle | EP-302 application |
|---|---|
| **PE-01** Pack isolation | Each sub-pack (302A–302E) deployable; additive changes |
| **PE-02** Deploy simplicity | No new services/ports/DB; file store on Creaty server |
| **PE-03** Closure commits | `EP-302A Complete` … `EP-302E Complete` |
| **PE-04** Arabic UX | Admin + error messages in Arabic; no internal jargon |
| **AR-08** Quality Template | Mandatory EP-302E Release Pack using reusable template |
| **RV-01** | Domain Management must ship as complete journey, not admin CRUD alone |

---

## 7) Readiness Assessment

| Criterion | Status |
|---|---|
| Baseline stable (`a507d308`) | ✅ |
| EP-301 domain selection proven | ✅ |
| Domain entity model exists | ✅ |
| Registry/API/UI for management | ❌ Gap — EP-302 scope |
| Planning pack complete | 🔄 This document + companion files |
| CA implementation authorization | ❌ Not granted — planning review only |

**Conclusion:** Sufficient baseline to plan EP-302. Implementation must not start until CA approves `EP302_CHARTER.md` and pack breakdown.
