# MP-01B — Decision Gates (MB Series)
# MP-01B — بوابات القرار (سلسلة MB)

**Task:** MP-01B  
**Generated:** 2026-07-07 (UTC+1)  
**Status:** `MP01B_READY_FOR_CA_REVIEW`  
**Companion:** `MP01B_REPOSITORY_ARCHITECTURE.md`  
**Audience:** CA (Change Authority) / migration lead before MP-01C execution

---

## نظرة عامة — Gate overview

| Gate | Name | Purpose | Blocks |
|------|------|---------|--------|
| **MB-01** | Structure | Approve platform workspace layout and mapping actions | MP-01C folder moves |
| **MB-02** | Git | Approve multi-repo topology, remotes, clone rename | MP-01C git operations |
| **MB-03** | EP Impact | Approve EP pack sequencing (especially EP-302C) | EP-302C commit/deploy |
| **MB-04** | Migration Readiness | Approve cutover checklist, rollback, env contracts | MP-01C execution start |

**Rule:** All four gates must be **PASS** (or **PASS WITH CONDITIONS** documented) before MP-01C migration begins.

---

## MB-01 — Structure Gate / بوابة الهيكل

**Question:** Is the proposed `NHP_PLATFORM/` numbered layout acceptable as the local development workspace?

### Criteria

| ID | Criterion | Evidence required | MP-01B default |
|----|-----------|-------------------|----------------|
| MB-01.1 | Numbered subtrees `01_`–`07_` + `_runtime/` approved | CA sign-off on architecture doc § PROPOSAL | PROPOSAL documented |
| MB-01.2 | Mapping table reviewed — every Current → Target has explicit MOVE\|STAY\|ARCHIVE\|EXTERNAL | `MP01B_REPOSITORY_ARCHITECTURE.md` mapping table | 15 rows defined |
| MB-01.3 | Servers stay with Chrome Extension (`02_Chrome_Extension`) | `sync-to-emailcore.js` rule cited | STAY per MP-01A |
| MB-01.4 | Runtime never committed — `_runtime/` gitignored pointer only | `.gitignore` plan for `_runtime/` | STAY external `E:\NHP_Runtime` |
| MB-01.5 | `.tmp/emailcore-ref` retired — not in canonical path | Target `01_EmailCore` or `repos/emailcore` | MOVE defined |
| MB-01.6 | Archive paths for no-git trees (`DaftarNosousChromeExtension`, `legacy-restored`, CLIProxy snapshot) | ARCHIVE rows in mapping table | ARCHIVE defined |

### CA decision

| Field | Value |
|-------|-------|
| Decision | ☐ PASS ☐ PASS WITH CONDITIONS ☐ FAIL |
| Conditions | |
| Approver | |
| Date | |

### Fail triggers

- Mandate mono-git merge of EmailCore + Extension into single remote.
- Require Oracle application source in repo without VM contract (when source unknown).
- Keep canonical EmailCore clone under `.tmp/`.

---

## MB-02 — Git Gate / بوابة Git

**Question:** Is multi-repo + optional platform workspace the approved git model, with correct remotes and rename plan?

### Criteria

| ID | Criterion | Evidence required | MP-01B default |
|----|-----------|-------------------|----------------|
| MB-02.1 | EmailCore remains independent repo `github.com/maggouri/emailcore` | Remote URL from MP-01A | `origin` confirmed in clone |
| MB-02.2 | Production_Build lineage remote recorded | `git remote -v` output | **OPEN** — MP-01A Q1 |
| MB-02.3 | Clone rename plan: `.tmp/emailcore-ref` → `01_EmailCore` preserves history | `git log -1` before/after move | HEAD `c20e800` at discovery |
| MB-02.4 | No forced mono-git — workspace may use multi-root IDE without single `.git` at umbrella | Architecture § Git topology | Multi-repo recommended |
| MB-02.5 | Dirty tree acknowledged — PB 298 porcelain lines; EmailCore 10 (EP-302C) | MP-01A inventory | Documented |
| MB-02.6 | Consolidation: single EmailCore working clone (resolve `NHP EMAILCORE` sibling if exists) | Post-rename only one `01_EmailCore` | **OPEN** — MP-01A Q2 |

### Pre-MP-01C checklist

- [ ] Record Production_Build official `git remote -v`
- [ ] Confirm whether `E:\NHP EMAILCORE` exists; if yes, diff against `emailcore-ref` and pick survivor → `01_EmailCore`
- [ ] Update `.gitignore` at workspace root for `_runtime/`
- [ ] Document which subtrees share Production_Build `.git` vs future split (Studio optional)

### CA decision

| Field | Value |
|-------|-------|
| Decision | ☐ PASS ☐ PASS WITH CONDITIONS ☐ FAIL |
| Conditions | |
| Approver | |
| Date | |

### Fail triggers

- Remote URL missing for Production_Build with no assigned action before MP-01C.
- Two divergent EmailCore clones left active without consolidation owner.

---

## MB-03 — EP Impact Gate / بوابة تأثير حزم التنفيذ

**Question:** Does the architecture preserve EP pack boundaries and correct sequencing for EP-302C and dependents?

### Criteria

| ID | Criterion | Evidence required | MP-01B default |
|----|-----------|-------------------|----------------|
| MB-03.1 | EP-302C changes remain in EmailCore repo — not committed to Extension repo | 10 files under `public/admin/` + server paths per MP-01A | PENDING commit |
| MB-03.2 | EP-302C sequence locked: MP-01C relocate → commit → Render deploy → PE-05 | Architecture § EP-302C sequencing | Order documented |
| MB-03.3 | Domain registry APIs stay on Creaty `:3020` (Extension tree) — not migrated to EmailCore DB | MP-01A sync model + EP-302A/B planning | STAY in `02_Chrome_Extension` |
| MB-03.4 | `scripts/sync-to-emailcore.js` COPY_LIST still valid after path moves | Post-move test run (MP-01C) | Deferred to MP-01C |
| MB-03.5 | `scripts/tests/ep302c-domain-admin-ui.test.js` path constant updated with relocate | `EMAILCORE_ADMIN` → `01_EmailCore/public/admin` | Deferred to MP-01C |
| MB-03.6 | Render deploy unchanged in intent — `render.yaml` stays in EmailCore root | File present in clone per MP-01A | STAY |

### EP-302C file manifest (commit scope reminder)

| State | Path |
|-------|------|
| M | `public/admin/index.html` |
| M | `public/admin/js/admin.js` |
| M | `public/admin/js/i18n.js` |
| M | `server/routes/creaty.js` |
| M | `server/services/ai-client.js` |
| M | `server/services/mail-classifier.js` |
| M | `server/services/session-classifier.js` |
| ?? | `public/admin/css/domain-registry.css` |
| ?? | `public/admin/js/domain-registry-helpers.js` |
| ?? | `public/admin/js/domain-registry.js` |

### CA decision

| Field | Value |
|-------|-------|
| Decision | ☐ PASS ☐ PASS WITH CONDITIONS ☐ FAIL |
| Conditions | |
| Approver | |
| Date | |

### Fail triggers

- EP-302C commit attempted before MP-01C path updates (broken tests/scripts).
- PE-05 started before Render deploy smoke confirms hosted admin.

---

## MB-04 — Migration Readiness Gate / بوابة جاهزية الهجرة

**Question:** Is MP-01C cutover safe to execute with rollback and env contracts defined?

### Criteria

| ID | Criterion | Evidence required | MP-01B default |
|----|-----------|-------------------|----------------|
| MB-04.1 | Backup / snapshot of Production_Build and emailcore-ref before any move | User backup or git stash/tag policy | **Required** — per safety protocol |
| MB-04.2 | Env contract documented: `NHP_EMAILCORE_DIR`, `NHP_RUNTIME_DIR` | SETUP.md deferred — interim env table below | Partial in architecture |
| MB-04.3 | Rollback plan: reverse folder move restores `.tmp/emailcore-ref` paths | Written rollback steps | See § Rollback |
| MB-04.4 | No production deploy during structural move unless explicitly scheduled | Change window | CA schedule |
| MB-04.5 | Deferred docs list accepted — README/PROJECT_MAP/SETUP/AI_AGENT_GUIDE after MP-01C | Architecture § Deferred | 4 files deferred |
| MB-04.6 | MB-01, MB-02, MB-03 all PASS or PASS WITH CONDITIONS | This document | Pending CA |

### Interim environment contract (until SETUP.md)

| Variable | Purpose | Example value (post MP-01C) |
|----------|---------|----------------------------|
| `NHP_PLATFORM_ROOT` | Workspace root | `E:\NHP_PLATFORM` or restructured Production_Build |
| `NHP_EMAILCORE_DIR` | EmailCore clone for sync/tests | `%NHP_PLATFORM_ROOT%\01_EmailCore` |
| `NHP_RUNTIME_DIR` | Runtime data | `E:\NHP_Runtime` |
| `NHP_EXTENSION_DIR` | Chrome extension + servers | `%NHP_PLATFORM_ROOT%\02_Chrome_Extension` |

### MP-01C execution checklist (gated)

- [ ] MB-01 … MB-04 PASS
- [ ] Backup confirmed
- [ ] Create/rename workspace folders per mapping table
- [ ] Move emailcore clone to `01_EmailCore`; verify `git status` clean except EP-302C 10 files
- [ ] Update script constants and run `ep302c-domain-admin-ui.test.js`
- [ ] Update sync target env; dry-run `sync-to-emailcore.js`
- [ ] Move Developer_Vault → `05_Developer_Vault`; planning → `06_Documentation`
- [ ] Add `_runtime/` pointer; verify gitignore
- [ ] Smoke: Creaty `:3020`, extension load, EmailCore local or staging

### Rollback (minimum)

1. Stop local servers.
2. Move `01_EmailCore` back to `.tmp/emailcore-ref` if needed.
3. Restore env vars to pre-migration values.
4. Revert script path edits via git checkout on Production_Build.
5. Document incident if partial migration occurred.

### CA decision

| Field | Value |
|-------|-------|
| Decision | ☐ PASS ☐ PASS WITH CONDITIONS ☐ FAIL |
| Conditions | |
| Approver | |
| Date | |

### Fail triggers

- No backup confirmation.
- MB-01/02/03 still FAIL.
- Rollback steps untested or unassigned owner.

---

## Gate dependency graph

```text
MB-01 Structure ──┐
MB-02 Git ────────┼──► MB-04 Migration Readiness ──► MP-01C EXECUTE
MB-03 EP Impact ──┘
                        │
                        └──► EP-302C commit → Render deploy → PE-05
```

---

## وثائق مؤجلة — Deferred documentation (do NOT create yet)

تُنشأ **بعد MP-01C** فقط — عندما يستقر الهيكل الفعلي:

| Document | Purpose | Blocked by |
|----------|---------|------------|
| `README.md` | Platform workspace overview | MP-01C completion |
| `PROJECT_MAP.md` | Navigable index of `01_`…`07_` subtrees | MP-01C completion |
| `SETUP.md` | Clone, env vars, first-run | MP-01C + env contract |
| `AI_AGENT_GUIDE.md` | Agent path constants and safety rules | MP-01C completion |

**Rule:** لا تُكتب هذه الملفات في MP-01B — تجنب churn أثناء عدم استقرار الهيكل (DV-02).

---

## Summary for CA review / ملخص مراجعة CA

| Item | Recommendation |
|------|----------------|
| Architecture | Multi-repo + `NHP_PLATFORM/` workspace (PROPOSAL) |
| EmailCore path | `01_EmailCore` — not `.tmp` |
| Oracle | EXTERNAL + docs in `03_Oracle` |
| Runtime | `_runtime/` gitignored → `E:\NHP_Runtime` |
| EP-302C | After MP-01C only |
| Next task | MP-01C migration (blocked on MB gates) |

**Document status:** `MP01B_READY_FOR_CA_REVIEW`

### ملخص عربي سريع للمهندس المعماري

| البند | التوصية |
|-------|---------|
| نموذج Git | **Multi-repo** + workspace `NHP_PLATFORM/` |
| مسار EmailCore | `01_EmailCore` — ليس `.tmp/emailcore-ref` |
| Oracle | EXTERNAL — وثائق في `03_Oracle/` فقط |
| Runtime | خارج Git — `E:\NHP_Runtime` عبر `_runtime/` |
| EP-302C | HOLD حتى MP-01C ثم commit → Render → PE-05 |
| البوابات المطلوبة | MB-01, MB-02, MB-03, MB-04 — كلها PASS قبل MP-01C |

---

## References

- `docs/planning/MP01_CANONICAL_SOURCE_DISCOVERY.md` (MP-01A)
- `docs/planning/MP01B_REPOSITORY_ARCHITECTURE.md` (MP-01B architecture)
