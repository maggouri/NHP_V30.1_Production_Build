# MP-01C — AI_AGENT_GUIDE.md Draft (for merge into NHP_PLATFORM)

**Task:** MP-01C (parallel documentation track)  
**Generated:** 2026-07-07 (UTC+1)  
**Status:** `DRAFT` — merge when migration agent completes  
**Target file:** `NHP_PLATFORM/AI_AGENT_GUIDE.md`  
**Inputs:** `MP01B_REPOSITORY_ARCHITECTURE.md`, AR-12, existing `NHP_PLATFORM/AI_AGENT_GUIDE.md`

---

> **Merge instruction:** Replace or reconcile with `NHP_PLATFORM/AI_AGENT_GUIDE.md` after MP-01C COMPLETE. This draft supersedes path references to `.tmp/emailcore-ref`.

---

## Document purpose

**Audience:** Cursor agents, automation scripts, and CI bots operating in the NHP workspace.

**Goal:** Prevent cross-repo git mistakes, accidental deploys, and path regressions after MP-01C migration.

---

## Section 1 — Non-negotiable rules

| # | Rule |
|---|------|
| 1 | **Do not delete** old folder copies after migration — stubs/READMEs mark moved paths |
| 2 | **Do not push** to remote unless user explicitly asks |
| 3 | **EP-302C is OPEN** — no commit/push EmailCore admin changes; no Render deploy |
| 4 | **Execution packs on HOLD** except authorized MP-01C migration work |
| 5 | **UTF-8** — preserve Arabic text in all files |
| 6 | **NHP_Runtime** — never commit; use `E:\NHP_Runtime` via `NHP_RUNTIME_DIR` |
| 7 | **No remote changes in MP-01C** — see `MP01C_REMOTE_POLICY.md` |
| 8 | **Minimal diff** — match existing code style; no drive-by refactors |

---

## Section 2 — Path constants (MP-01C)

```text
WORKSPACE_ROOT     = E:\NHP_V30.1_Production_Build
NHP_PLATFORM_ROOT  = WORKSPACE_ROOT\NHP_PLATFORM
EMAILCORE_DIR      = NHP_PLATFORM_ROOT\01_EmailCore
EXTENSION_SOURCE   = WORKSPACE_ROOT              # Phase 2 → 02_Chrome_Extension
RUNTIME_DIR        = E:\NHP_Runtime
VAULT_DIR          = NHP_PLATFORM_ROOT\05_Developer_Vault
PLANNING_DIR       = NHP_PLATFORM_ROOT\06_Documentation\planning
INFRA_DIR          = NHP_PLATFORM_ROOT\07_Infrastructure
ORACLE_DOCS        = NHP_PLATFORM_ROOT\03_Oracle   # docs-only
```

**Banned paths in new edits:**

```text
.tmp/emailcore-ref     ← retired; use 01_EmailCore
.tmp/                  ← not canonical
```

---

## Section 3 — Git boundaries (AR-12)

| Tree | `.git` location | Remote | MP-01C push |
|------|-----------------|--------|-------------|
| EmailCore | `01_EmailCore/.git` | `maggouri/emailcore` | ❌ HOLD |
| Chrome Extension | Workspace root `.git` | **None** | ❌ N/A |
| NHP_PLATFORM parent | **No git** | N/A | N/A |

### Agent git commands

```powershell
# EmailCore changes ONLY:
git -C NHP_PLATFORM\01_EmailCore status
git -C NHP_PLATFORM\01_EmailCore diff

# Extension changes ONLY:
git status    # at workspace root
```

**Never** assume workspace root commits affect EmailCore.

---

## Section 4 — Remote policy summary

| Repo | Remote | Agent action |
|------|--------|--------------|
| Production_Build | None | Do not `git remote add`; do not push |
| EmailCore | `maggouri/emailcore` | Do not push until user authorizes EP-302C sequence |

Full policy: `MP01C_REMOTE_POLICY.md`

---

## Section 5 — EP-302C sensitivity

| Item | Location |
|------|----------|
| Admin UI (10 porcelain files) | `01_EmailCore/public/admin/` |
| Creaty Quick Access | `modules/creaty/` at workspace root |
| Domain API | `creaty-server.js` :3020 |
| Persistence | `server_logs/mailbox-lifecycle-domains.json` |
| Test constant | `scripts/tests/ep302c-domain-admin-ui.test.js` → `01_EmailCore/public/admin` |

**AR-09:** EmailCore Web Admin = single full admin surface; extension = Quick Access client only.

**Sequence after MP-01C:** `MP01C_EP302C_POST_SEQUENCE.md`

**Do NOT start EP-302D** until EP-302C CLOSED.

---

## Section 6 — Sync script contract

`scripts/sync-to-emailcore.js`:

| Field | Value |
|-------|-------|
| Source | Workspace root (extension) |
| Target | `NHP_EMAILCORE_DIR` or default `NHP_PLATFORM/01_EmailCore` |
| Excluded | `creaty-server.js`, `ghost-server.js`, `ai-bridge-server.js` |

After editing sync COPY_LIST or paths → dry-run `sync-diff.js` before bulk sync.

---

## Section 7 — Oracle (EXTERNAL)

| Item | Detail |
|------|--------|
| Repo subtree | `03_Oracle/` — docs and contracts only |
| Runtime | External VM (`oracle-api.emailcore.app`) |
| Engine source | Not in workspace — contract-first until repo discovered |

See: `05_Developer_Vault/04_INFRASTRUCTURE/`

---

## Section 8 — Runtime and logs (never git)

| Artifact | Path |
|----------|------|
| NHP_Runtime | `E:\NHP_Runtime` via `NHP_RUNTIME_DIR` |
| Server logs | `server_logs/` at workspace root |
| Profiles | `_runtime/profiles/` contract (gitignored) |

---

## Section 9 — Backup reference

| Backup | Path |
|--------|------|
| Full | `E:\NHP_V30.1_Production_Build_MP01C_BACKUP` |
| In-repo | `backups/MP01C_pre_migration_20260707/` |

Before destructive edits: remind user to confirm backup exists.

---

## Section 10 — Key documents (agent navigation)

| Doc | Path |
|-----|------|
| Project map | `NHP_PLATFORM/PROJECT_MAP.md` |
| Setup | `NHP_PLATFORM/SETUP.md` |
| Migration report | `06_Documentation/planning/MP01C_MIGRATION_REPORT.md` |
| Remote policy | `06_Documentation/planning/MP01C_REMOTE_POLICY.md` |
| EP-302C sequence | `06_Documentation/planning/MP01C_EP302C_POST_SEQUENCE.md` |
| CA checklist | `06_Documentation/planning/MP01C_DELIVERABLES_CHECKLIST.md` |
| AR-12 | `05_Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-12.md` |
| AR-09 | `05_Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-09.md` |
| MP-01B architecture | `06_Documentation/planning/MP01B_REPOSITORY_ARCHITECTURE.md` |

---

## Section 11 — When editing (agent workflow)

1. Identify **which git repo** owns the file (EmailCore vs extension).
2. Use path constants from Section 2 — no `.tmp/` references.
3. Run relevant tests after path or admin UI changes.
4. Update `PROJECT_MAP.md` if numbered subtree paths change.
5. Log architecture decisions in Developer Vault changelog.
6. Do not commit unless user explicitly requests.
7. Do not create Production_Build remote without separate CA plan.

---

## Section 12 — Phase 2 awareness (Chrome Extension move)

When Phase 2 executes:

| Change | Agent update required |
|--------|----------------------|
| Extension → `02_Chrome_Extension/` | Update `EXTENSION_SOURCE`, SETUP load path |
| `.git` → `02_Chrome_Extension/.git` | Update git boundary table |
| Workspace root git-free | Extension git commands use `-C 02_Chrome_Extension` |

Until Phase 2: treat workspace root as extension source.

---

## Section 13 — Forbidden actions (quick reference)

```text
❌ git push (any repo) without user request
❌ git remote add/set-url on Production_Build during MP-01C
❌ Render deploy during EP-302C OPEN
❌ Commit EP-302C files from workspace root git
❌ Delete .tmp/emailcore-ref or Developer_Vault originals
❌ Commit NHP_Runtime or server_logs
❌ Start EP-302D before EP-302C CLOSED
❌ Mono-git merge of EmailCore + Extension
```

---

## Merge checklist (for migration agent)

- [ ] Path constants match live `PROJECT_MAP.md`
- [ ] EP-302C status reflects post-migration state
- [ ] Remote policy cross-linked
- [ ] Phase 2 deferral note accurate
- [ ] Remove duplicate rules after merge with existing guide
- [ ] UTF-8 verified for Arabic cross-references

---

## ملخص عربي — Arabic summary

**دليل الوكيل:** حدود git (EmailCore منفصل، الإضافة بدون remote)، ثوابت المسارات بعد MP-01C، EP-302C مفتوح (لا commit/push/deploy)، مزامنة sync، Oracle خارجي، وقائمة ممنوعات للوكلاء.

---

*Draft — merge into NHP_PLATFORM/AI_AGENT_GUIDE.md when migration completes.*
