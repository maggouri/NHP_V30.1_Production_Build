# MP-01C — Deliverables Checklist (CA Review)

**Task:** MP-01C  
**Generated:** 2026-07-07 (UTC+1)  
**Status:** `READY_FOR_CA_REVIEW`  
**Companion:** `MP01C_MIGRATION_REPORT.md`, `MP01C_REMOTE_POLICY.md`, `MP01C_EP302C_POST_SEQUENCE.md`

---

## Purpose

Four deliverable groups for Chief Architect sign-off before EP-302C post-sequence begins. Check each box after verification; do not mark complete without evidence.

---

## Deliverable 1 — Platform workspace shell

**Objective:** `NHP_PLATFORM/` umbrella exists with numbered subtrees and runtime contract.

| # | Criterion | Evidence | CA ☐ |
|---|-----------|----------|------|
| 1.1 | `NHP_PLATFORM/` folder present at workspace | Path exists | ☐ |
| 1.2 | Numbered folders `01_`–`07_` + `_runtime/` | Directory listing | ☐ |
| 1.3 | `03_Oracle/README.md` stub (docs-only, EXTERNAL) | File present | ☐ |
| 1.4 | `02_Chrome_Extension/README.md` — Phase 2 deferred documented | README status | ☐ |
| 1.5 | `04_NHP_Studio/README.md` — deferred split documented | README status | ☐ |
| 1.6 | `_runtime/` gitignore contract documented | `PROJECT_MAP.md` or platform README | ☐ |
| 1.7 | No mono-git at `NHP_PLATFORM/` parent | No `.git` inside umbrella only | ☐ |

**CA Deliverable 1:** ☐ **PASS** ☐ **PASS WITH CONDITIONS** ☐ **FAIL**

**Conditions / notes:**

```text

```

---

## Deliverable 2 — EmailCore canonical relocation

**Objective:** `.tmp/emailcore-ref` retired; single canonical clone at `01_EmailCore/` with git and EP-302C files intact.

| # | Criterion | Evidence | CA ☐ |
|---|-----------|----------|------|
| 2.1 | `NHP_PLATFORM/01_EmailCore/` exists | Path + `.git/` | ☐ |
| 2.2 | `origin` → `https://github.com/maggouri/emailcore.git` | `git remote -v` | ☐ |
| 2.3 | HEAD matches pre-migration (`c20e800` or documented) | `git log -1 --oneline` | ☐ |
| 2.4 | **10 EP-302C porcelain files** unchanged | `git status --short` | ☐ |
| 2.5 | `render.yaml` present in `01_EmailCore/` | File exists | ☐ |
| 2.6 | Old path stub: `.tmp/emailcore-ref/README_MIGRATED.md` | Stub present; originals not deleted | ☐ |
| 2.7 | Backup exists | `E:\NHP_V30.1_Production_Build_MP01C_BACKUP` | ☐ |
| 2.8 | **No commit/push/deploy** during MP-01C | Remote policy compliance | ☐ |

**CA Deliverable 2:** ☐ **PASS** ☐ **PASS WITH CONDITIONS** ☐ **FAIL**

**Conditions / notes:**

```text

```

---

## Deliverable 3 — Path contracts and verification

**Objective:** Scripts, tests, and env defaults point to canonical paths; smoke tests pass.

| # | Criterion | Evidence | CA ☐ |
|---|-----------|----------|------|
| 3.1 | `scripts/sync-to-emailcore.js` default → `NHP_PLATFORM/01_EmailCore` | Code review | ☐ |
| 3.2 | `scripts/sync-diff.js` updated | Code review | ☐ |
| 3.3 | `scripts/tests/ep302c-domain-admin-ui.test.js` → `01_EmailCore/public/admin` | Test constant | ☐ |
| 3.4 | `.env.example` documents `NHP_EMAILCORE_DIR`, `NHP_RUNTIME_DIR` | File review | ☐ |
| 3.5 | EP-302 tests PASS | `node --test scripts/tests/ep302*.test.js` → 42/42 | ☐ |
| 3.6 | EP-301 sample tests PASS | Migration report § Test results | ☐ |
| 3.7 | Creaty `:3020` domain API reachable (local) | Manual or test | ☐ |
| 3.8 | Extension load path documented (root until Phase 2) | `LOAD_EXTENSION.txt` / PROJECT_MAP | ☐ |
| 3.9 | Rollback steps documented | `MP01C_MIGRATION_REPORT.md` § Rollback | ☐ |

**CA Deliverable 3:** ☐ **PASS** ☐ **PASS WITH CONDITIONS** ☐ **FAIL**

**Conditions / notes:**

```text

```

---

## Deliverable 4 — Governance and onboarding documentation

**Objective:** Architecture decision, navigation map, and operator/agent guides published under `NHP_PLATFORM/`.

| # | Criterion | Evidence | CA ☐ |
|---|-----------|----------|------|
| 4.1 | `NHP_PLATFORM/PROJECT_MAP.md` — paths, git boundaries, env vars | File review | ☐ |
| 4.2 | `NHP_PLATFORM/README.md` — platform overview, multi-repo model | File review | ☐ |
| 4.3 | `NHP_PLATFORM/SETUP.md` — clone, env, servers, extension load | File review | ☐ |
| 4.4 | `NHP_PLATFORM/AI_AGENT_GUIDE.md` — agent rules, path constants, EP-302C HOLD | File review | ☐ |
| 4.5 | AR-12 recorded: Workspace ≠ Repository | `05_Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-12.md` | ☐ |
| 4.6 | Changelog updated | `05_Developer_Vault/09_CHANGELOG.md` | ☐ |
| 4.7 | Vault copied to `05_Developer_Vault/` with migration stub at old path | `README_MIGRATED.md` | ☐ |
| 4.8 | Planning copied to `06_Documentation/planning/` | Includes MP-01B/C docs | ☐ |
| 4.9 | `MP01C_MIGRATION_REPORT.md` complete | Status, backup, Phase 2 plan | ☐ |
| 4.10 | Remote policy documented (no remote changes) | `MP01C_REMOTE_POLICY.md` | ☐ |
| 4.11 | EP-302C post-sequence documented | `MP01C_EP302C_POST_SEQUENCE.md` | ☐ |

**CA Deliverable 4:** ☐ **PASS** ☐ **PASS WITH CONDITIONS** ☐ **FAIL**

**Conditions / notes:**

```text

```

---

## Overall CA sign-off

| Field | Value |
|-------|-------|
| MP-01C overall | ☐ **COMPLETE** ☐ **PARTIAL (Phase 2 deferred)** ☐ **FAIL** |
| Authorized to start EP-302C post-sequence | ☐ **YES** ☐ **NO** |
| Approver (CA) | |
| Date | |

---

## After sign-off — next action

When all four deliverables PASS (or PASS WITH CONDITIONS met):

1. Follow `MP01C_EP302C_POST_SEQUENCE.md` starting at **Review Workspace**.
2. Do **not** start EP-302D until EP-302C CLOSED.

---

## Known deferrals (do not block sign-off if documented)

| Item | Status | Target |
|------|--------|--------|
| Chrome Extension physical move | Phase 2 | `02_Chrome_Extension/` |
| Extension `.git` move | Phase 2 | `02_Chrome_Extension/.git` |
| Studio split | Phase 2 | `04_NHP_Studio/` |
| Production_Build git remote | Separate plan | Interpretation A or B per remote policy |

---

## References

- MP-01B: `MP01B_REPOSITORY_ARCHITECTURE.md`
- MB gates: `MP01B_DECISION_GATES.md`
- Migration report: `MP01C_MIGRATION_REPORT.md`
- Remote policy: `MP01C_REMOTE_POLICY.md`
- Post-sequence: `MP01C_EP302C_POST_SEQUENCE.md`

---

## ملخص عربي — Arabic summary

**أربعة مخرجات للمراجعة:**

1. **هيكل المنصة** — `NHP_PLATFORM/` والمجلدات المرقّمة.
2. **EmailCore** — `01_EmailCore/` مع git و10 ملفات EP-302C.
3. **عقود المسارات والاختبارات** — scripts، tests، env، 42/42 PASS.
4. **الحوكمة والتوثيق** — PROJECT_MAP، README، SETUP، AI_AGENT_GUIDE، AR-12، تقرير الهجرة.

**بعد PASS:** ابدأ تسلسل EP-302C من `MP01C_EP302C_POST_SEQUENCE.md`.

---

*End of deliverables checklist.*
