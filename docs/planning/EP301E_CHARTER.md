# EP-301E Charter — Quality & Release Readiness (Release Pack)

**Status:** `CLOSED` — **EP-301E Complete**  
**Date:** 2026-07-07  
**Author:** EP-301 Planning Pack  
**Baseline:** `0ceaee59` (EP-301D Complete)

---

## Objective

Validate the **complete Mailbox Lifecycle journey** (Login → Ready) across all EP-301A–301D deliverables, prove release readiness for **Mailbox Lifecycle v1.0**, and produce gate evidence that satisfies `RELEASE_GATES_FRAMEWORK.md` and `MVP_v1_0_IN_SCOPE.md`.

This is the **Release Pack** — not a generic test sprint. Success is declared only when the full journey is certified shippable:

```text
MAILBOX LIFECYCLE v1.0 — COMPLETE
```

## User Promise

> As an operator, I can complete the full mailbox onboarding journey with clear Arabic guidance, role-appropriate access, predictable errors, and confidence that my mailbox is ready — on hardware as modest as the project's low-spec target — without encountering half-finished steps or internal system jargon.

---

## Why Charter First — Release Pack Rationale

EP-301A–301D each delivered a **vertical slice** (model, API, UI, permissions). EP-301E is the **horizontal Release Pack** that answers one question only:

> *Is the entire journey ready to ship as a coherent product story (RV-01)?*

### Why not jump straight to tests?

| Risk without charter | Charter mitigation |
|---|---|
| Ad-hoc test additions without gate order | GE-01 → GE-04 chain with explicit pass criteria |
| Scope creep disguised as "quality fixes" | Non-goals + bugfix exception criteria |
| Incomplete documentation handoff | GE-03 documentation validation as a hard gate |
| Pack closure without journey-level sign-off | Final declaration: `MAILBOX_LIFECYCLE_COMPLETE` |
| One-off QA effort per epic | Reusable **Quality Template** for EP-302, EP-303 |

### Reusable Quality Template (future epics)

This charter defines a pattern future user journeys can copy. Full extract: `docs/planning/QUALITY_TEMPLATE_REUSABLE.md`.

| Template section | EP-301E instance | Future reuse (EP-302/303) |
|---|---|---|
| Release Pack objective | Mailbox Lifecycle v1.0 | Replace journey name + MVP scope ref |
| Baseline commit | `0ceaee59` | Prior pack closure commit |
| GE-01 E2E | 7-step Creaty journey | Journey-specific E2E script + PE-05 |
| GE-02 Regression | 301A–301D + 301E tests | Prior epic tests + new release tests |
| GE-03 Documentation | EP301* consistency | Epic-specific doc set |
| GE-04 Release Readiness | MVP v1.0 gates + CA sign-off | Version gate framework slice |
| PE-03 / PE-07 closure | `EP-301E Complete` commit | Pack closure commit + recovery chain |

**301E is the reference implementation of the Quality Template.** EP-302 and EP-303 should charter their own Release Packs by adapting this structure, not reinventing QA ad hoc.

#### Checklist

| # | Item | EP-301E instance |
|---|---|---|
| Q-1 | Charter approved | GR-02 PASS → authorized |
| Q-2 | Baseline commit | `0ceaee59` |
| Q-3 | GE-01 E2E tests | `ep301e-e2e-journey.test.js` |
| Q-4 | Permissions matrix | `ep301e-permissions-matrix.test.js` |
| Q-5 | Performance smoke | `ep301e-performance-smoke.test.js` |
| Q-6 | Messages/errors PE-04 | `ep301e-messages-errors.test.js` |
| Q-7 | Full regression | 301A–301E combined |
| Q-8 | Quality certification | `EP301E_QUALITY_CERTIFICATION.md` |
| Q-9 | Regression report | `EP301E_REGRESSION_REPORT.md` |
| Q-10 | Release report | `EP301E_RELEASE_REPORT.md` |
| Q-11 | Charter CLOSED | This document |
| Q-12 | PE-03 closure commit | `EP-301E Complete` |

#### Acceptance Criteria

1. All prior pack tests green (zero regression).
2. All new release tests pass.
3. GE-01..04 documented with PASS evidence.
4. MVP v1.0 in-scope items 1–6 satisfied.
5. PE-04 Arabic messaging validated.
6. No scope creep (tests/docs only unless BE-1..BE-5).
7. Recovery chain updated through closure commit.
8. Final declaration: `MAILBOX LIFECYCLE v1.0 — COMPLETE`.

#### Closure Steps

1. Run combined `node --test` suite (301A–301E).
2. Record results in regression report.
3. Complete quality certification and release report.
4. Update charter status to `CLOSED`.
5. Commit: **`EP-301E Complete`**.
6. Re-run suite post-commit.

#### Suggested Commit Name

```text
EP-301E Complete
```

#### Required Documents

| Document | Status |
|---|---|
| `EP301E_CHARTER.md` | CLOSED |
| `EP301E_QUALITY_CERTIFICATION.md` | ✅ |
| `EP301E_REGRESSION_REPORT.md` | ✅ |
| `EP301E_RELEASE_REPORT.md` | ✅ |
| `QUALITY_TEMPLATE_REUSABLE.md` | ✅ |
| `scripts/tests/ep301e-*.test.js` | ✅ (4 files) |

---

## PE Principles (Pack Execution Registry)

All EP-301E work must comply with PE-01 through PE-07. Prior packs established evidence; 301E **validates and closes** the chain.

| Principle | Definition | 301E application |
|---|---|---|
| **PE-01** Pack Isolation | Each pack reaches deployable state; additive changes only; no baseline breakage | 301E adds tests/docs/reports only; no feature expansion |
| **PE-02** Deploy Simplicity | No infra/Oracle/DB/Render redesign; reuse existing Creaty/EmailCore stack | E2E runs against local Creaty `:3020`; no new services |
| **PE-03** Pack Closure Commit | Formal closure commit with message `EP-301E Complete` | Issued only after GE-04 PASS + CA sign-off |
| **PE-04** User-Safe Messaging | Arabic user text; no Oracle/orchestrator/raw HTTP in UI copy | GE-01 validates error envelope + helper mapping across all 7 steps |
| **PE-05** Human Validation | Chief Architect manual UX sign-off where automation is insufficient | Full journey + role scenarios; extends 301C PE-05 evidence |
| **PE-06** Permissions Before Features | Role matrix enforced before capability expansion | GE-01 includes permissions matrix re-validation (301D baseline) |
| **PE-07** Pack Documentation Closure | Docs, tests, recovery chain updated on pack close | GE-03 + deliverables list; final regression report |

**Emphasis for 301E:** PE-03 (closure discipline), PE-05 (human journey sign-off), PE-07 (documentation completeness).

---

## Scope

### In scope

1. **End-to-End user journey validation**
   - Full 7-step path per `EP301_USER_JOURNEY.md`
   - Live API E2E (extend `ep301c-pe05-e2e-live.js` pattern)
   - UI journey walkthrough for User and Admin personas

2. **Permissions testing (User / Admin / Supervisor)**
   - Re-validate 301D matrix via automated + manual checklist
   - Confirm UI gating, API 403 envelopes, Supervisor recovery boundary

3. **Basic performance testing (low-spec suitable)**
   - Combined automated test suite duration baseline (target: ≤ 30s for 301A–301E on reference weak machine)
   - UI responsiveness: no unbounded polling; step transitions ≤ 500ms perceived (excluding network)
   - Optional: time-to-Ready observation (informational; targets from `EP301_EXECUTION_PLAN.md`: median ≤ 90s normal, ≤ 180s under queue)

4. **Messages and error handling validation**
   - Standard envelope: `ok/code/message/recoverable/retryable/nextAction`
   - Arabic mapping via `mapLifecycleError`; PE-04 compliance audit

5. **UX usability validation**
   - Stepper clarity, domain selection, ready-state signal
   - PE-05 human validation checklist (Chief Architect)
   - Low-spec UX spot-check (single-core / 4GB class device or documented equivalent)

6. **Final regression**
   - All EP-301A–301D tests green
   - New EP-301E release-pack tests

7. **Documentation review**
   - All `EP301*` planning docs complete, cross-linked, consistent with shipped behavior
   - Recovery chain commits documented through 301E closure

8. **Release readiness verification**
   - Map evidence to `RELEASE_GATES_FRAMEWORK.md` MVP v1.0 gates
   - Confirm `MVP_v1_0_IN_SCOPE.md` items 1–6 satisfied

### Non-goals

- **No new features** — journey behavior frozen at baseline `0ceaee59`
- **No DB/Oracle/infra/Render changes**
- **No UI feature additions** beyond validation fixes for **release blockers only** (see Bugfix Exception Criteria)
- No EP-302/303 planning or implementation
- No standalone `PERMISSIONS_MATRIX.md` creation (remains post-301D recommendation unless CA directs in 301E)
- No production deployment or Render config changes
- No broad UX rebrand (per `MVP_v1_0_OUT_OF_SCOPE.md`)

### Bugfix Exception Criteria (release blockers only)

A code change is permitted in 301E **only if** all conditions hold:

| # | Criterion |
|---|---|
| BE-1 | Issue reproduces on baseline `0ceaee59` and blocks GE-01 or GE-02 PASS |
| BE-2 | Issue is documented in `EP301E_RELEASE_BLOCKERS.md` before fix |
| BE-3 | Fix is minimal (single concern); no feature expansion |
| BE-4 | Fix includes regression test in `scripts/tests/ep301e-*` |
| BE-5 | Chief Architect approves exception in charter review or gate evidence |

All other changes → defer to EP-302+.

---

## User Journey — Release Validation Slice

EP-301E validates the **entire** journey end-to-end; it adds no new steps.

| Step | 301E validation focus |
|---|---|
| 1 Login | Session + role context; journey entry for User/Admin |
| 2 Choose Domain | Allowed list, policy errors, Arabic feedback |
| 3 Create Mailbox | Generate + manual paths; domain binding |
| 4 Validation | Envelope contract; retry/recoverable paths |
| 5 Mailbox Created | Summary metadata completeness |
| 6 Connection Settings | Verify flow; credential guidance (PE-04) |
| 7 Ready | Deterministic READY; downstream usability signal |
| Recovery (Supervisor) | `/recover` assist-only; no UI journey access |

Reference: `docs/planning/EP301_USER_JOURNEY.md`

---

## Dependencies

| Dependency | Commit / artifact | Required |
|---|---|---|
| EP-301A model contract | `f63a58f5` | ✅ CLOSED |
| EP-301B API + role baseline | `ec19e987` | ✅ CLOSED |
| EP-301C UI journey + PE-05 | `e23cded1` | ✅ CLOSED |
| EP-301D permissions hardening | `0ceaee59` | ✅ CLOSED |
| EP301_USER_JOURNEY.md | Approved | ✅ |
| EP301_EXECUTION_PLAN.md | GV gates → GE mapping | ✅ |
| MVP_v1_0_IN_SCOPE.md | v1.0 scope | ✅ |
| RELEASE_GATES_FRAMEWORK.md | MVP gate model | ✅ |
| Test accounts / local Creaty `:3020` | Controlled env | Required for E2E |

**301E baseline (implementation start point):** `0ceaee59` — **EP-301D Complete**

---

## Recovery Chain Reference

```text
f63a58f5 (301A) → ec19e987 (301B) → e23cded1 (301C) → 0ceaee59 (301D) → [301E closure]
```

| Pack | Closure commit | Tests (baseline) |
|---|---|---|
| EP-301A | `f63a58f5` | 3 (`ep301a-model-validation.test.js`) |
| EP-301B | `ec19e987` | 5 (`ep301b-mailbox-lifecycle-api.test.js`) |
| EP-301C | `e23cded1` | 6 (`ep301c-mailbox-lifecycle-ui.test.js`) |
| EP-301D | `0ceaee59` | 8 (`ep301d-permissions.test.js`) |
| **Combined 301A–301D** | — | **22 tests, 22 PASS** (301D regression) |
| **Combined 301A–301E** | — | **39 tests, 39 PASS** (301E closure) |

301E preserved 22/22 baseline and added 17 release tests without regression.

---

## Deliverables

### Documentation (expected on implementation)

| # | Artifact | Purpose |
|---|---|---|
| D-1 | `EP301E_CHARTER_REVIEW.md` | GR-02 Chief Architect charter review (this document) |
| D-2 | `EP301E_E2E_REPORT.md` | GE-01 live journey evidence (API + UI) |
| D-3 | `EP301E_PERMISSIONS_VALIDATION.md` | Role matrix re-validation checklist |
| D-4 | `EP301E_PERFORMANCE_REPORT.md` | Lightweight perf baseline + low-spec notes |
| D-5 | `EP301E_UX_VALIDATION.md` | PE-05 human sign-off package |
| D-6 | `EP301E_DOCUMENTATION_REVIEW.md` | GE-03 EP301* consistency audit |
| D-7 | `EP301E_REGRESSION_REPORT.md` | Combined 301A–301E test results + gate table |
| D-8 | `EP301E_RELEASE_READINESS.md` | GE-04 MVP gate mapping + CA decision |
| D-9 | `EP301E_RELEASE_BLOCKERS.md` | Bugfix exceptions (if any; empty if none) |

### Tests (expected on implementation)

| # | Artifact | Purpose |
|---|---|---|
| T-1 | `scripts/tests/ep301e-release-regression.test.js` | Orchestrated 301A–301D smoke + 301E assertions |
| T-2 | `scripts/tests/ep301e-e2e-journey.test.js` | Extended live E2E (build on `ep301c-pe05-e2e-live.js`) |
| T-3 | `scripts/tests/ep301e-permissions-matrix.test.js` | Cross-role deny/allow integration (optional split from T-1) |
| T-4 | `scripts/tests/ep301e-error-envelope.test.js` | Message contract + PE-04 mapping coverage |

### Gate evidence bundle

- GE-01 through GE-04 pass/fail tables with links to D-2..D-8
- Chief Architect sign-off block in D-5 and D-8
- PE-03 closure commit: `EP-301E Complete`

---

## Gates (GE-01 .. GE-04 → MAILBOX_LIFECYCLE_COMPLETE)

```text
GE-01 End-to-End Validation
        ↓
GE-02 Regression Validation
        ↓
GE-03 Documentation Validation
        ↓
GE-04 Release Readiness
        ↓
MAILBOX_LIFECYCLE_COMPLETE
```

| Gate | Name | Pass criteria |
|---|---|---|
| **GE-01** | End-to-End Validation | (1) Full 7-step journey completes to `READY` for User and Admin via live Creaty server. (2) Supervisor `/recover` works; Supervisor blocked from UI journey and mutate endpoints. (3) Error scenarios produce standard envelope + Arabic PE-04 text. (4) PE-05 manual checklist signed PASS by Chief Architect. (5) Email Library + Inbox regression from 301C still PASS. |
| **GE-02** | Regression Validation | (1) All 301A–301D tests pass (22/22 minimum). (2) All new 301E tests pass. (3) Combined `node --test` run exit 0. (4) Signup queue, activation polling, admin/auth surfaces unchanged (spot-check + doc attestation). (5) No release blockers open without approved bugfix + test. |
| **GE-03** | Documentation Validation | (1) Every `EP301A`–`EP301E` charter/review/regression doc exists and cross-references baseline commits. (2) User journey doc matches observed step order and error model. (3) Recovery chain through 301E documented. (4) Known boundaries aligned with `MVP_v1_0_OUT_OF_SCOPE.md`. (5) No contradictory gate names or status labels across EP301* set. |
| **GE-04** | Release Readiness | (1) All five MVP gates from `RELEASE_GATES_FRAMEWORK.md` mapped to evidence (Functional, UX, Regression, Documentation, Product Acceptance). (2) `MVP_v1_0_IN_SCOPE.md` items 1–6 explicitly checked PASS. (3) Performance report shows no critical low-spec regression. (4) Chief Architect declares: **`MAILBOX LIFECYCLE v1.0 — COMPLETE`**. (5) PE-03 closure commit issued. |

### Mapping: Execution Plan GV → 301E GE

| EP301_EXECUTION_PLAN GV | EP-301E GE |
|---|---|
| GV-01 UX Gate | Subsumed by GE-01 (E2E + PE-05) |
| GV-02 Functional Gate | GE-01 happy path + GE-02 automated |
| GV-03 Regression Gate | GE-02 |
| GV-04 Product Acceptance | GE-04 |

---

## Success Criteria (measurable)

| # | Criterion | Verification |
|---|---|---|
| SC-1 | User completes Login → Ready with `workflow.state === READY` | GE-01 E2E report + live script output |
| SC-2 | Admin completes same journey with cross-workflow read | GE-01 role scenario |
| SC-3 | Supervisor cannot use Creaty UI journey or mutate endpoints | 301D tests + GE-01 manual deny check |
| SC-4 | Supervisor `/recover` succeeds on stuck workflow fixture | GE-01 API evidence |
| SC-5 | All error paths return envelope fields + Arabic user text (PE-04) | `ep301e-error-envelope.test.js` + UX review |
| SC-6 | Combined automated suite ≥ baseline 22/22 PASS + 301E tests PASS | GE-02 regression report |
| SC-7 | Combined test duration ≤ 30s on reference weak machine (informational if exceeded with justification) | Performance report |
| SC-8 | All EP301* docs consistent; recovery chain complete | GE-03 documentation review |
| SC-9 | MVP v1.0 release gates satisfied per framework | GE-04 release readiness doc |
| SC-10 | Chief Architect PE-05 sign-off recorded | `EP301E_UX_VALIDATION.md` |
| SC-11 | Final status: `MAILBOX LIFECYCLE v1.0 — COMPLETE` | GE-04 decision block |

---

## Permissions Matrix Validation Checklist

Re-validate 301D enforcement at journey level (GE-01). Source of truth: `logic/mailbox-lifecycle-permissions.js` + `EP301D_PERMISSIONS_REVIEW.md`.

| # | Check | User | Admin | Supervisor | Method |
|---|---|---|---|---|---|
| PM-1 | Create workflow / mailbox | ✅ own | ✅ | ❌ | API 403 + UI hidden |
| PM-2 | Change domain | ✅ | ✅ | ❌ | API + UI |
| PM-3 | Read workflow | ✅ own | ✅ cross | ✅ read | GET tests |
| PM-4 | Validate / connection / READY | ✅ own | ✅ | ❌ | POST deny tests |
| PM-5 | Reset workflow | ✅ own | ✅ | ❌ | API + UI |
| PM-6 | Recover (`/recover`) | ❌ | ❌ | ✅ | 301D + live fixture |
| PM-7 | Creaty UI journey | ✅ | ✅ | ❌ blocked panel | PE-05 manual |
| PM-8 | Session endpoint exposes role + capabilities | ✅ | ✅ | N/A (no UI) | GET `/session` |
| PM-9 | User cannot read another user's workflow | ❌ | — | — | 301D test + manual |
| PM-10 | Unauthorized actions show Arabic `FORBIDDEN` | ✅ | ✅ | ✅ | PE-04 spot-check |

**GE-01 PASS requires PM-1 through PM-10 documented PASS.**

---

## Test Inventory (baseline + planned)

### Existing (must remain green)

| Script | Pack | Tests |
|---|---|---|
| `scripts/tests/ep301a-model-validation.test.js` | 301A | 3 |
| `scripts/tests/ep301b-mailbox-lifecycle-api.test.js` | 301B | 5 |
| `scripts/tests/ep301c-mailbox-lifecycle-ui.test.js` | 301C | 6 |
| `scripts/tests/ep301d-permissions.test.js` | 301D | 8 |
| `scripts/tests/ep301c-pe05-e2e-live.js` | 301C PE-05 | Live E2E (manual/CI optional) |

### Implemented (301E — CLOSED)

| Script | Focus | Tests |
|---|---|---|
| `scripts/tests/ep301e-e2e-journey.test.js` | Full journey including Ready | 3 |
| `scripts/tests/ep301e-permissions-matrix.test.js` | Cross-role deny/allow integration | 7 |
| `scripts/tests/ep301e-performance-smoke.test.js` | Lightweight perf baseline | 2 |
| `scripts/tests/ep301e-messages-errors.test.js` | Message contract + PE-04 mapping | 5 |

**Combined run command:**

```bash
node --test scripts/tests/ep301a-model-validation.test.js \
  scripts/tests/ep301b-mailbox-lifecycle-api.test.js \
  scripts/tests/ep301c-mailbox-lifecycle-ui.test.js \
  scripts/tests/ep301d-permissions.test.js \
  scripts/tests/ep301e-e2e-journey.test.js \
  scripts/tests/ep301e-permissions-matrix.test.js \
  scripts/tests/ep301e-performance-smoke.test.js \
  scripts/tests/ep301e-messages-errors.test.js
```

---

## Rollback Plan

1. **Recovery point:** git commit `0ceaee59` (EP-301D Complete) — last authorized implementation baseline.
2. If 301E introduces regressions: revert 301E commits only; 301A–301D remain CLOSED.
3. 301E artifacts (docs/tests) are additive; rollback removes 301E deliverables without touching workflow data.
4. **Zero regression target:** 301A–301D tests (22/22) remain green after any 301E rollback.
5. Bugfix exceptions (BE-1..BE-5) must be revertible as isolated commits.
6. No data migration in 301E — workflow store and mailbox records untouched by QA pack.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| E2E flakiness (live server, EmailCore credentials) | False GE-01 FAIL | Document env prerequisites; retry caps; separate API vs UI evidence |
| Scope creep via "small fixes" | Delays release; violates PE-01 | Bugfix exception criteria; CA approval |
| Documentation drift across 17+ EP301 files | GE-03 FAIL | Structured doc review checklist (D-6) |
| Low-spec perf false positives | Noisy GE-04 | Informational thresholds; compare to 301D baseline (~10.4s / 22 tests) |
| PE-05 bottleneck (CA availability) | Gate blocked | Schedule PE-05 early; reuse 301C evidence where still valid |
| Test duplication across packs | Maintenance burden | `ep301e-release-regression.test.js` orchestrates, does not duplicate assertions |
| Permissions regression after 301D | Security gap | PM checklist + 301D tests in every GE-02 run |

---

## Estimated Complexity

| Dimension | Rating | Rationale |
|---|---|---|
| Overall | **Medium** | Validation-heavy; no feature architecture |
| E2E / live testing | Medium | Depends on Creaty + test credentials |
| Documentation audit | Medium-Low | Many files; checklist-driven |
| Performance | Low | Lightweight timings; no load testing |
| Permissions re-validation | Low | 301D tests + checklist |
| Bugfix risk | Low (if discipline held) | Exception criteria limit code touch |

**Effort shape:** ~60% evidence gathering and documentation, ~30% test authoring, ~10% PE-05 human validation.

---

## Implementation Authorization

**CLOSED — EP-301E Complete**

Chief Architect authorized implementation (GR-02 PASS). Pack closed with PE-03 commit `EP-301E Complete`.

Final declaration:

```text
MAILBOX LIFECYCLE v1.0 — COMPLETE
QUALITY: CERTIFIED
READY FOR EP-302
```

---

## References

- `docs/planning/EP301_PACK_BREAKDOWN.md` — §301E
- `docs/planning/EP301_EXECUTION_PLAN.md` — GV gates, time-to-Ready targets
- `docs/planning/EP301_USER_JOURNEY.md` — 7-step contract
- `docs/planning/MVP_v1_0_IN_SCOPE.md` — v1.0 scope
- `docs/planning/MVP_v1_0_OUT_OF_SCOPE.md` — deferrals
- `docs/planning/RELEASE_GATES_FRAMEWORK.md` — RV-01 + MVP gates
- `docs/planning/EP301D_CHARTER.md` — format reference; GD gates → GE chain
- `docs/planning/EP301D_REGRESSION_REPORT.md` — 301D CLOSED baseline
- `docs/planning/EP301D_PERMISSIONS_REVIEW.md` — permissions source
- `docs/planning/EP301C_PE05_EVIDENCE.md` — PE-05 precedent
- `docs/planning/EP301A_REGRESSION_REPORT.md` through `EP301C_REGRESSION.md` — prior gate evidence
- **Post-301D recommendation:** standalone `PERMISSIONS_MATRIX.md` (deferred unless CA directs in 301E)

---

## Status Summary

| Field | Value |
|---|---|
| Charter status | `CLOSED` |
| Implementation | **EP-301E Complete** |
| Baseline | `0ceaee59` |
| Prior pack | EP-301D ✅ CLOSED |
| Quality | **CERTIFIED** |
| Target completion declaration | `MAILBOX LIFECYCLE v1.0 — COMPLETE` ✅ |
