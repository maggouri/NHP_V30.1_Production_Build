# Reusable Quality Template — Release Pack Pattern

**Source:** EP-301E Charter (reference implementation)  
**Reuse:** EP-302, EP-303, and future user journeys

---

## Checklist

| # | Item | EP-301E instance |
|---|---|---|
| Q-1 | Charter approved (`AUTHORIZED_FOR_IMPLEMENTATION`) | EP301E_CHARTER.md |
| Q-2 | Baseline commit identified | `0ceaee59` (301D) |
| Q-3 | GE-01 E2E journey tests | `ep301e-e2e-journey.test.js` |
| Q-4 | GE-01 permissions matrix re-validation | `ep301e-permissions-matrix.test.js` |
| Q-5 | Performance smoke (low-spec) | `ep301e-performance-smoke.test.js` |
| Q-6 | Error envelope + PE-04 Arabic audit | `ep301e-messages-errors.test.js` |
| Q-7 | GE-02 full regression (prior packs + new) | 301A–301E combined run |
| Q-8 | GE-03 documentation consistency audit | EP301* cross-links |
| Q-9 | GE-04 release readiness mapping | MVP gates + scope items |
| Q-10 | Quality certification document | `EP301E_QUALITY_CERTIFICATION.md` |
| Q-11 | Regression report | `EP301E_REGRESSION_REPORT.md` |
| Q-12 | Release report + final declaration | `EP301E_RELEASE_REPORT.md` |
| Q-13 | Charter status → CLOSED | End of pack |
| Q-14 | PE-03 closure commit | `EP-301E Complete` |

---

## Acceptance Criteria

All must pass before pack closure:

1. **Zero regression** — all prior pack tests remain green (301A–301D baseline preserved).
2. **New release tests pass** — all `ep301e-*` scripts exit 0.
3. **GE-01..04 documented** — each gate has PASS/FAIL with evidence links.
4. **MVP scope satisfied** — `MVP_v1_0_IN_SCOPE.md` items 1–6 checked PASS.
5. **PE-04 compliance** — Arabic user messages; no internal jargon in UI copy.
6. **No scope creep** — tests/docs only unless approved release blocker (BE-1..BE-5).
7. **Recovery chain updated** — closure commit appended to chain.
8. **Final declaration issued** — journey complete + quality certified.

---

## Closure Steps

1. Run combined test suite (`node --test` all pack scripts).
2. Record results in regression report.
3. Complete quality certification (GE gates).
4. Complete release report with final declaration.
5. Update charter status to `CLOSED`.
6. Stage **only** pack files (tests, docs, charter).
7. Commit: **`EP-301E Complete`** (PE-03).
8. Re-run full suite post-commit to verify clean tree.

---

## Suggested Commit Name

```text
EP-301E Complete
```

Future packs: `EP-302E Complete`, `EP-303E Complete`, etc.

---

## Required Documents

| Document | Purpose |
|---|---|
| `{EP}E_CHARTER.md` | Pack scope, gates, non-goals |
| `{EP}E_QUALITY_CERTIFICATION.md` | GE-01..04 gate evidence |
| `{EP}E_REGRESSION_REPORT.md` | Combined test results |
| `{EP}E_RELEASE_REPORT.md` | Release readiness + final declaration |
| `scripts/tests/{ep}e-*.test.js` | Release pack automated tests |
| `QUALITY_TEMPLATE_REUSABLE.md` | This template (copy/adapt) |

---

## Gate Chain (standard)

```text
GE-01 End-to-End Validation
        ↓
GE-02 Regression Validation
        ↓
GE-03 Documentation Validation
        ↓
GE-04 Release Readiness
        ↓
{JOURNEY_NAME} — COMPLETE
```

---

## Adaptation Guide (EP-302+)

1. Copy charter Release Pack section; replace journey name and baseline commit.
2. Replace E2E script with journey-specific steps (keep PE-05 human sign-off slot).
3. Point regression at prior epic tests + new release tests.
4. Map GE-04 to current MVP gate framework slice.
5. Issue closure commit per PE-03 naming convention.
