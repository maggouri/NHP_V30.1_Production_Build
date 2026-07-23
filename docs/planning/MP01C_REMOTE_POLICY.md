# MP-01C — Remote Policy (Chief Architect Note)

**Task:** MP-01C (parallel documentation track)  
**Generated:** 2026-07-07 (UTC+1)  
**Status:** `FACTS_AND_POLICY` — no remote changes in MP-01C  
**Audience:** Chief Architect (CA) / migration lead  
**Inputs:** `MP01B_REPOSITORY_ARCHITECTURE.md`, `MP01C_MIGRATION_REPORT.md`, MB-02 gate

---

## Executive summary | ملخص تنفيذي

| Repository | Local path | Git remote | MP-01C policy |
|------------|------------|------------|---------------|
| **Production_Build** (Chrome Extension lineage) | Workspace root `E:\NHP_V30.1_Production_Build` | **None** | **No remote changes** |
| **EmailCore** | `NHP_PLATFORM/01_EmailCore/` | `https://github.com/maggouri/emailcore.git` | **No push in MP-01C** — EP-302C commit deferred |

---

## Fact — Production_Build has no git remote

**Verified fact (MP-01A / MP-01C):**

```text
git remote -v   # at workspace root → (empty — no remotes configured)
```

| Item | Value |
|------|-------|
| Repo root | `E:\NHP_V30.1_Production_Build` |
| HEAD at discovery | `b69b5765` — `EP-302B Complete` |
| Dirty porcelain | 298 lines (WIP) |
| `git remote -v` | **No output** — zero remotes |

This is **not** an interpretation. MB-02 open question #1 from MP-01B remains: official Production_Build remote URL was never recorded because none exists.

---

## Fact — EmailCore has remote maggouri/emailcore

**Verified fact:**

```text
git -C NHP_PLATFORM/01_EmailCore remote -v
origin  https://github.com/maggouri/emailcore.git (fetch)
origin  https://github.com/maggouri/emailcore.git (push)
```

| Item | Value |
|------|-------|
| Local path (post MP-01C) | `NHP_PLATFORM/01_EmailCore/` |
| Remote | `github.com/maggouri/emailcore` |
| HEAD at discovery | `c20e800` |
| EP-302C porcelain | **10 uncommitted files** in `public/admin/` (+ related server files) |
| Deploy binding | `render.yaml` in emailcore repo → Render |

---

## Two allowed interpretations — Production_Build remote absence

> **Label:** POLICY OPTIONS — CA chooses interpretation; **no action required in MP-01C**.

### Interpretation A — Intentional local-only private extension

| Aspect | Detail |
|--------|--------|
| Meaning | Chrome Extension + local servers (Creaty/Ghost/AI bridge) remain a **private, local-only** git tree |
| Rationale | Extension holds local secrets, WIP (298 lines), and unpackaged dev workflow; no public hosting requirement |
| MP-01C action | **None** — document fact; proceed with workspace restructure only |
| Future | Remote optional; never required for platform operation |

### Interpretation B — Future GitHub repo (separate plan)

| Aspect | Detail |
|--------|--------|
| Meaning | A dedicated GitHub remote for Production_Build / `02_Chrome_Extension` lineage **may** be created later |
| Rationale | Backup, multi-machine sync, CI for extension pack builds |
| MP-01C action | **None** — remote creation is **out of scope** for MP-01C |
| Future plan | Separate task after MP-01C COMPLETE + CA approval; requires MB-02 revisit, remote URL recording, and push authorization |

**CA rule:** Either interpretation is valid. MP-01C **must not** add, change, or remove remotes on either repository.

---

## MP-01C remote policy — binding rules

| # | Rule | Applies to |
|---|------|------------|
| R-01 | **Do not** `git remote add` / `remove` / `set-url` on workspace root | Production_Build |
| R-02 | **Do not** `git push` on workspace root | Production_Build |
| R-03 | **Do not** `git push` on `01_EmailCore` during MP-01C | EmailCore |
| R-04 | **Do not** trigger Render deploy during MP-01C | EmailCore |
| R-05 | **Preserve** existing `origin` on `01_EmailCore` when relocating clone | EmailCore |
| R-06 | **Record** `git remote -v` output in migration report (fact only) | Both |
| R-07 | EP-302C commit + push + deploy → **post MP-01C sequence** only | EmailCore |

---

## Relationship to MB-02 (Git Gate)

MP-01B MB-02 criterion MB-02.4 asked to "record Production_Build `git remote -v` before MP-01C."

| MB-02 item | MP-01C resolution |
|------------|-------------------|
| Record remote URL | **Recorded: none** — satisfies fact capture; does not block migration |
| EmailCore remote | **Confirmed:** `maggouri/emailcore` |
| Multi-repo model | **Unchanged** — AR-12 workspace ≠ mono-git |

MB-02 **does not require** creating a Production_Build remote. It required **recording** what exists.

---

## Phase 2 note (Chrome Extension physical move)

When `.git` moves to `02_Chrome_Extension/` (Phase 2, deferred):

- Remote policy **unchanged** — still no remote unless CA opens separate plan (Interpretation B).
- Any future remote attaches to `02_Chrome_Extension/.git`, not workspace umbrella.

---

## References

- MP-01B architecture: `MP01B_REPOSITORY_ARCHITECTURE.md` § Git topology, open question #1
- MB-02 gate: `MP01B_DECISION_GATES.md`
- Migration facts: `MP01C_MIGRATION_REPORT.md` § Git repositories after migration
- AR-12: `Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-12.md`

---

## ملخص للمهندس المعماري — Arabic summary

**الحقائق فقط:**

1. **Production_Build** (جذر مساحة العمل) — **لا يوجد git remote** (`git remote -v` فارغ).
2. **EmailCore** — remote موجود: `maggouri/emailcore`؛ المسار المحلي `NHP_PLATFORM/01_EmailCore/`.

**تفسيران مسموحان (بدون إجراء في MP-01C):**

- **(A)** الإضافة محلية وخاصة عن قصد — لا حاجة لـ remote.
- **(B)** repo على GitHub لاحقاً — خطة منفصلة **ليست** ضمن MP-01C.

**سياسة MP-01C:** لا تغييرات على remotes؛ لا push لأي مستودع؛ EP-302C commit/push/deploy بعد اكتمال MP-01C فقط.

---

*End of remote policy note.*
