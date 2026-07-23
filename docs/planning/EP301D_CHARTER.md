# EP-301D Charter — Permissions and Operational Controls Hardening

**Status:** `AUTHORIZED_FOR_IMPLEMENTATION` (post GR-01 review 2026-07-07)  
**Date:** 2026-07-07  
**Author:** EP-301 Planning Pack

---

## Objective

Enforce clear **User / Admin / Supervisor** responsibilities for all EP-301 mailbox lifecycle actions across API, UI, and assistive recovery paths — closing the role-gating gap intentionally deferred from EP-301C.

## User Promise

> As an operator, I see only the mailbox actions my role allows; supervisors can assist recovery without overriding authz or completing workflows on my behalf.

---

## PE-06 — Permissions Before Features

Every EP-301D feature must first answer **"Who is allowed to use it?"** before **"How it is implemented?"**

| Question | 301D answer |
|---|---|
| Who can create/change domain? | User, Admin |
| Who can delete/reset workflow? | User (own), Admin |
| Who can recover stuck steps? | Supervisor only (service role) |
| Who can mark READY? | User, Admin |
| Who uses the Creaty UI journey? | User, Admin only |

Implementation order: policy module → API enforcement → UI gating → tests → gate evidence.

---

## Scope

### In scope
- Consolidated authorization checks for EP-301 actions (create, validate, connection, ready, recover).
- UI gating per role in Creaty mailbox journey and related surfaces.
- Supervisor constrained to **assistive recovery only** (`/recover`); no mailbox creation, no READY override, no authz bypass.
- End-to-end validation pack: role matrix tests + manual acceptance checklist per role.
- Alignment with EP-301A permissions matrix and EP-301B API role enforcement baseline.

### Non-goals
- No Oracle/DB/infra/Render changes.
- No redesign of unrelated modules (SEO, PNG generation, signup queue core).
- No replacement of Creaty/EmailCore server stack.
- No human "Supervisor login" — Supervisor remains a **system service role** (AI/operator bridge).
- No EP-301E gate certification (GV-01..GV-04) — deferred to 301E.
- No standalone `PERMISSIONS_MATRIX.md` in 301D — **post-301D recommendation** (see References).

---

## Permissions Matrix (EP-301 mailbox lifecycle)

Aligned with `EP301_DISCOVERY_REPORT.md` §2 and EP-301B endpoint decisions.

| Action | User | Admin | Supervisor |
|---|---|---|---|
| Create workflow / mailbox | Yes (own) | Yes | No |
| Change domain (start workflow) | Yes | Yes | No |
| Read workflow | Own only | Yes (cross-workflow) | Yes (read for assist) |
| Validate / connection / READY | Yes (own) | Yes | No |
| Reset workflow (local new setup) | Yes (own) | Yes | No |
| Recover (`/recover`) | No | No | Yes (service key) |
| Creaty UI journey | Yes | Yes | No (blocked in UI) |

Notes:
- "Supervisor" is a **system capability role**, not a human extension login.
- Admin detection uses `NHP_MAILBOX_ADMIN_USER_IDS` (server) — UI receives resolved role from API session.
- Delete = reset/new setup; no destructive server delete endpoint in EP-301 scope.

---

## User Journey Slice (what 301D adds)

EP-301C delivered the full 7-step UI journey without role-specific UI gating. **301D adds the authorization layer:**

| Step | 301D addition |
|---|---|
| Login | Role context surfaced via `/session`; block journey for Supervisor |
| Choose Domain | User/Admin only; Supervisor denied |
| Create Mailbox | User/Admin only; unauthorized buttons hidden |
| Validation | User/Admin; Supervisor cannot trigger |
| Mailbox Created | Read access per ownership; Admin cross-workflow read |
| Connection Settings | User/Admin verify; credential errors role-appropriate |
| Ready | User/Admin mark ready; Supervisor cannot |
| Recovery (assist) | Supervisor-only `/recover`; no UI path |

Reference journey: `docs/planning/EP301_USER_JOURNEY.md`  
Permissions baseline: `docs/planning/EP301_DISCOVERY_REPORT.md` §2, `EP301B_API_DECISIONS.md`

---

## Dependencies

| Dependency | Commit / artifact | Required |
|---|---|---|
| EP-301A model contract | `f63a58f` | ✅ |
| EP-301B API + role baseline | `ec19e98` | ✅ |
| EP-301C UI journey | `e23cded1` | ✅ |
| EP301_USER_JOURNEY.md | Approved | ✅ |
| EP301_EXECUTION_PLAN.md | Role-aware scope | ✅ |
| EP301B_API_REVIEW.md | Endpoint × role matrix | ✅ |

**Recovery chain:** `f63a58f` (301A) → `ec19e98` (301B) → `e23cded1` (301C) → **301D**

---

## Deliverables

1. **Authorization consolidation**
   - Single policy source: `logic/mailbox-lifecycle-permissions.js`
   - API: `server/mailbox-lifecycle-api.js` (session endpoint + consolidated checks)
   - UI: `modules/creaty/mailbox-lifecycle-ui.js`, `mailbox-lifecycle-helpers.js`

2. **UI role gating**
   - Hide/disable actions per role with Arabic explanations (PE-04 compliant).
   - Role banner; Supervisor blocked from UI journey.

3. **Supervisor recovery boundary**
   - `/api/mailbox-lifecycle/workflows/:id/recover` remains Supervisor-only.
   - No UI path for Supervisor to create mailboxes or mark READY.

4. **Test pack**
   - `scripts/tests/ep301d-permissions.test.js`
   - Extend 301A–301C regression runs.

5. **Documentation**
   - `EP301D_CHARTER_REVIEW.md`
   - `EP301D_PERMISSIONS_REVIEW.md`
   - `EP301D_REGRESSION_REPORT.md`
   - Gate evidence for GD-01..GD-04

---

## Gates (GD-01 .. GD-04)

| Gate | Name | Pass criteria |
|---|---|---|
| **GD-01** | Permission | User/Admin/Supervisor matrix matches discovery + 301B; UI and API use same policy source |
| **GD-02** | Functional | Each action returns correct allow/deny (403 + envelope) per role; happy paths unchanged for User/Admin |
| **GD-03** | Regression | 301A/301B/301C/301D tests pass; no breakage in signup queue, Email Library, admin panel |
| **GD-04** | Product Acceptance | Role UX + supervisor boundary documented; ready for 301E stabilization |

---

## Success Criteria (measurable)

| # | Criterion | Verification |
|---|---|---|
| SC-1 | User cannot perform Admin-only cross-workflow access on others' workflows | API 403 test + manual User scenario |
| SC-2 | User cannot invoke Supervisor `/recover` | API 403 test |
| SC-3 | Supervisor cannot create mailbox or mark READY | API 403 tests |
| SC-4 | Unauthorized UI actions hidden/disabled with Arabic `FORBIDDEN` text | UI review + helper mapping |
| SC-5 | All EP-301A–301D automated tests pass | Combined `node --test` run |
| SC-6 | Zero regression in 301C 7-step journey for authorized User/Admin | GD-03 evidence |

---

## Risks

| Risk | Mitigation |
|---|---|
| Role enforcement drift (duplicated checks) | Single policy module; client mirror for tests |
| UI hides actions but API still allows | Pair UI gating with API tests per endpoint |
| Supervisor scope creep | Explicit deny list; code review against 301B rejected alternatives |
| Admin detection fragility | Document env-based gating; session endpoint exposes resolved role |
| Low-spec performance | Lightweight gating checks; no extra polling |

---

## Rollback Plan

1. **Recovery point:** git commit `e23cded1` (EP-301C Complete).
2. Revert 301D commits — API returns to 301B enforcement-only; UI returns to 301C ungated journey.
3. No data migration — workflow files and mailbox records untouched.
4. **Zero regression target:** 301A/301B/301C tests remain green after rollback.
5. Optional feature-flag: hide role banner / skip UI gating in `mailbox-lifecycle-ui.js` entry.

---

## Implementation Authorization

**AUTHORIZED FOR IMPLEMENTATION** — GR-01 verdict PASS (see `EP301D_CHARTER_REVIEW.md`).

---

## References

- `docs/planning/EP301_PACK_BREAKDOWN.md` — §301D
- `docs/planning/EP301_DISCOVERY_REPORT.md` — §2 Permissions Matrix
- `docs/planning/EP301B_API_DECISIONS.md` — Role enforcement baseline
- `docs/planning/EP301B_API_REVIEW.md` — Endpoint × role table
- `docs/planning/EP301C_UI_REVIEW.md` — Role gating deferred note
- `docs/planning/EP301C_REGRESSION.md` — EP-301C CLOSED
- `docs/planning/EP301_EXECUTION_PLAN.md` — GV gates (301E)
- **Post-301D recommendation:** standalone `PERMISSIONS_MATRIX.md` for cross-module authz (Chief Architect note — not in 301D scope)
