# MP-01B — Repository Architecture Design

**Task:** MP-01B  
**Generated:** 2026-07-07 (UTC+1)  
**Status:** `MP01B_READY_FOR_CA_REVIEW`  
**Inputs:** MP-01A (`MP01_CANONICAL_SOURCE_DISCOVERY.md`) — facts only; no re-scan  
**Scope:** Architecture proposal + mapping table. Implementation deferred to MP-01C.

---

## Executive summary

| Decision | Recommendation |
|----------|----------------|
| Git model | **Multi-repo** — EmailCore keeps its own git (`maggouri/emailcore`); Chrome Extension / local servers stay in Production_Build lineage |
| Local layout | **Platform workspace** (folder umbrella) — optional mono-workspace for dev; **not** forced mono-git |
| EmailCore clone location | Rename `.tmp/emailcore-ref` → `01_EmailCore` (or `repos/emailcore`) — **never** under `.tmp` |
| Runtime data | `E:\NHP_Runtime` — gitignored pointer under `_runtime/` |
| Oracle | **EXTERNAL** — VM runtime; repo holds docs/contracts only |
| EP-302C | After MP-01C relocate → commit in emailcore repo → Render deploy → PE-05 |

---

## MP-01A facts (inherited — do not re-derive)

| Component | Canonical source (MP-01A) | Notes |
|-----------|---------------------------|-------|
| Chrome Extension | `E:\NHP_V30.1_Production_Build` | `manifest.json`, `creaty-server.js`, `modules/*`; HEAD `b69b5765` (`EP-302B Complete`); 298 dirty porcelain lines |
| EmailCore | `github.com/maggouri/emailcore` | Local clone: `.tmp/emailcore-ref`; HEAD `c20e800`; `render.yaml` present; **10 uncommitted** files in `public/admin/` (EP-302C) |
| NHP_Runtime | `E:\NHP_Runtime` | Runtime data only — **no `.git`** |
| Oracle | External VM | Docs in `Developer_Vault` only; no engine code tree in scan set |
| NHP Studio | `studio_hub.html` + `modules/studio/` in Production_Build | Synced via `scripts/sync-to-emailcore.js` COPY_LIST |
| Developer Vault | `Production_Build/Developer_Vault/` | `00_READ_FIRST.md` present; infra/oracle narrative in `04_INFRASTRUCTURE/` |
| Sync model | `scripts/sync-to-emailcore.js` | PB → `NHP_EMAILCORE_DIR` or sibling `../NHP EMAILCORE`; servers **stay** in Production_Build |

---

## PROPOSAL — Multi-repo platform umbrella
## PROPOSAL — مظلة المنصة متعددة المستودعات

> **Label:** PROPOSAL — subject to CA review via `MP01B_DECISION_GATES.md`. Not executed until MP-01C migration gates pass.

### Target workspace layout

```text
NHP_PLATFORM/                    # umbrella — optional mono workspace, NOT forced mono-git
├── 01_EmailCore/                # clone/link → github.com/maggouri/emailcore
├── 02_Chrome_Extension/         # extension + local servers (Creaty/Ghost/AI bridge)
├── 03_Oracle/                   # EXTERNAL (VM) + docs/contracts only in repo
├── 04_NHP_Studio/               # split from extension or modules/studio
├── 05_Developer_Vault/          # moved from Production_Build/Developer_Vault
├── 06_Documentation/            # planning, gates, EP packs
├── 07_Infrastructure/           # caddy scripts, deploy refs, Render pointers
└── _runtime/                    # gitignored — NHP_Runtime pointer, server_logs
```

### Design principles

1. **Separate deploy cycles** — EmailCore → Render (`render.yaml`); Chrome Extension → packed CRX/ZIP + local PM2/Creaty; Oracle → edge VM. Mono-git would couple unrelated release trains.
2. **Platform workspace ≠ mono-repo** — One parent folder for local dev ergonomics; each numbered subtree may retain its own `.git` root.
3. **No runtime in git** — `E:\NHP_Runtime` and `server_logs/` referenced via `_runtime/` (symlink or `NHP_RUNTIME_DIR` env); never committed.
4. **Oracle is contract-first** — Repo subtree holds API contracts, infra runbooks, and integration docs from Developer_Vault; application source lives on VM until a dedicated repo is discovered (MP-01A open question #4).
5. **Retire `.tmp` for canonical clones** — `.tmp/emailcore-ref` is a discovery artifact; canonical local path is `01_EmailCore` or `repos/emailcore`.

### Relationship to current tree

| Current path | Role today | Target under PROPOSAL |
|--------------|------------|------------------------|
| `E:\NHP_V30.1_Production_Build` | Extension + servers + vault + planning | Becomes workspace root **or** contents split into `02_*` … `07_*` |
| `.tmp\emailcore-ref` | EmailCore git clone | `01_EmailCore/` |
| `E:\NHP_Runtime` | Runtime data | `_runtime/` (gitignored pointer) |
| Oracle VM | Live edge API | `03_Oracle/` (docs only) |
| `DaftarNosousChromeExtension` | No git — reference | **ARCHIVE** or absorb into `02_Chrome_Extension` after diff |
| `legacy-restored` | No git — reference | **ARCHIVE** |
| `.tmp\CLIProxyAPI-official` | No git — snapshot | `07_Infrastructure/` reference or **ARCHIVE** |

---

## Mapping table — Current → Target → Action
## جدول التعيين — الحالي → المستهدف → الإجراء

| # | Current location | Target location | Action | Git | Rationale |
|---|------------------|-----------------|--------|-----|-----------|
| 1 | `E:\NHP_V30.1_Production_Build` (root) | `NHP_PLATFORM/` (workspace root) | **MOVE** (restructure) | STAY — extension lineage | Umbrella folder; may keep existing `main` history on `02_Chrome_Extension` |
| 2 | `manifest.json`, `modules/*`, packed assets | `02_Chrome_Extension/` | **MOVE** | STAY | Canonical extension per MP-01A |
| 3 | `creaty-server.js`, `ghost-server.js`, `ai-bridge-server.js` | `02_Chrome_Extension/` (servers subfolder or root) | **STAY** | STAY | `sync-to-emailcore.js` rule: servers remain with PB |
| 4 | `studio_hub.html`, `modules/studio/` | `04_NHP_Studio/` | **MOVE** (logical split) | STAY or submodule | Studio is distinct product surface; sync COPY_LIST already treats it separately |
| 5 | `Developer_Vault/` | `05_Developer_Vault/` | **MOVE** | STAY | Vault is cross-cutting docs; belongs in platform layout |
| 6 | `docs/planning/`, EP packs | `06_Documentation/planning/` | **MOVE** | STAY | Centralize planning artifacts |
| 7 | `scripts/sync-to-emailcore.js`, deploy/caddy refs | `07_Infrastructure/` + env in `02_*` | **MOVE** (scripts) / **STAY** (server entrypoints) | STAY | Infra scripts colocated; server binaries stay runnable from extension tree |
| 8 | `.tmp\emailcore-ref` | `01_EmailCore/` | **MOVE** | STAY — `maggouri/emailcore` | Remove `.tmp` stigma; update `NHP_EMAILCORE_DIR` |
| 9 | `render.yaml` (in emailcore clone) | `01_EmailCore/render.yaml` | **STAY** | STAY | Render deploy bound to emailcore repo |
| 10 | EP-302C `public/admin/*` (10 files) | `01_EmailCore/public/admin/` | **STAY** | STAY — commit pending | Canonical after commit/push in emailcore repo |
| 11 | `E:\NHP_Runtime` | `_runtime/` → pointer to `E:\NHP_Runtime` | **STAY** (external) | N/A — gitignored | Runtime data never in git |
| 12 | Oracle VM (`oracle-api.emailcore.app`) | `03_Oracle/` (docs/contracts) | **EXTERNAL** | N/A | No engine source in scan; VM is runtime |
| 13 | `DaftarNosousChromeExtension` | — | **ARCHIVE** | N/A | No git; reference only |
| 14 | `legacy-restored` | `06_Documentation/archive/legacy-restored/` | **ARCHIVE** | N/A | No git; historical reference |
| 15 | `.tmp\CLIProxyAPI-official` | `07_Infrastructure/vendor/cli-proxy/` | **ARCHIVE** or **STAY** as vendor snapshot | N/A | No git; optional vendor pin |

**Action legend**

| Action | Meaning |
|--------|---------|
| **MOVE** | Physical or logical relocation in workspace layout |
| **STAY** | Remains in same git repo / role; path may change |
| **ARCHIVE** | Read-only reference; not in active deploy path |
| **EXTERNAL** | Runtime or source outside platform git trees |

---

## Recommended model: Multi-repo + platform workspace
## النموذج الموصى به: Multi-repo + workspace موحّد

### Why multi-repo (not mono-git)

| Factor | Multi-repo + workspace | Mono-git |
|--------|------------------------|----------|
| EmailCore deploy | Render watches `emailcore` repo + `render.yaml` | Would require subtree split or dual remotes |
| Extension release | Independent pack/version from `manifest.json` | Coupled commits with unrelated EmailCore changes |
| Access control | EmailCore public/hosted vs extension local secrets | Single repo blurs boundaries |
| EP-302C | 10 files belong in emailcore `main` | Risk of committing to wrong root |
| Dirty tree | PB has 298 WIP lines — isolate from EmailCore | Mono-git amplifies merge noise |

### Why platform workspace (not scattered paths)

- Single `NHP_PLATFORM/` entry for IDE multi-root workspace.
- Numbered prefixes enforce stable sort order (`01_` … `07_`).
- `_runtime/` gives one env contract: `NHP_RUNTIME_DIR`, `NHP_EMAILCORE_DIR`.
- Developer onboarding: clone umbrella instructions without forcing one remote.

### Git topology (PROPOSAL)

```text
github.com/maggouri/emailcore          →  01_EmailCore/     (own .git)
Production_Build lineage (TBD remote)  →  02_Chrome_Extension/  (own .git)
                                       →  04_NHP_Studio/    (same repo or future split)
                                       →  05_Developer_Vault/ (same repo)
                                       →  06_Documentation/ (same repo)
                                       →  07_Infrastructure/ (same repo)
Oracle VM                              →  03_Oracle/        (docs only, no app .git)
```

**Note:** MP-01A open question #1 — Production_Build git remote URL not captured. MB-02 gate must record official remote before migration.

---

## ما يبقى خارج Git — خارج نطاق المستودعات

> **Label:** PROPOSAL — سياسة استبعاد؛ لا يُنفَّذ حتى MB-04.

| Artifact | Current path | Target contract | Reason |
|----------|--------------|-----------------|--------|
| **NHP_Runtime** | `E:\NHP_Runtime` | `_runtime/` pointer + `NHP_RUNTIME_DIR` | Runtime data: backups, cache, sessions, uploads — **no `.git`** (MP-01A + `MP01_NHP_RUNTIME_CHECK.md`) |
| **server_logs** | `Production_Build/server_logs/` | `02_Chrome_Extension/server_logs/` or `_runtime/logs/` | Mailbox lifecycle JSON, local logs — mutable runtime |
| **Secrets** | `.env`, tokens, certs | Secure vault only (DV-01) | Never committed; `.env.example` only in git |
| **Build outputs** | Packed CRX/ZIP, `node_modules/`, Render build | Per-repo `.gitignore` | Deploy artifacts generated in CI/local |
| **Temp / debug** | `tmp-*.png`, `temp_uploads*`, `.tmp/` vendor zips | Exclude or **ARCHIVE** | Not canonical source |
| **Profile / browser state** | `server_profiles*`, `profile_backups*` | `_runtime/profiles/` | Operator machine state |
| **CLIProxy binaries** | `.tmp/CLIProxyAPI_*` zip/exe | Vendor pin or download-on-setup | Large binaries; optional vendor snapshot |

**Gitignore contract (PROPOSAL):**

```text
_runtime/
server_logs/
.env
node_modules/
temp_uploads*/
*.png (debug captures at root)
```

---

## Rename: `.tmp/emailcore-ref` → `01_EmailCore`

| Item | Detail |
|------|--------|
| Current | `E:\NHP_V30.1_Production_Build\.tmp\emailcore-ref` |
| Target | `NHP_PLATFORM/01_EmailCore` **or** `NHP_PLATFORM/repos/emailcore` |
| Constraint | **NOT** `.tmp` — canonical clones must not live under temp paths |
| Git | Preserve `origin` → `https://github.com/maggouri/emailcore.git` |
| Env updates | `NHP_EMAILCORE_DIR`, `scripts/sync-to-emailcore.js` default, `scripts/tests/ep302c-domain-admin-ui.test.js` `EMAILCORE_ADMIN` constant |
| HEAD at discovery | `c20e800` — `fix(chat-agent): harden session tools per security review` |

---

## EP-302C — الآثار والمسار بعد إعادة الهيكلة

**الحالة الحالية (MP-01A):** OPEN — **HOLD** حتى اعتماد MP-01B + خطة MP-01C.

**قرار AR-09 (معتمد):** EmailCore Web Admin هو السطح الإداري الوحيد لإدارة النطاقات؛ Creaty Quick Access فقط في الإضافة.

| Topic | Current | After MP-01C (PROPOSAL) |
|-------|---------|-------------------------|
| Admin UI code | `.tmp/emailcore-ref/public/admin/` (10 uncommitted) | `01_EmailCore/public/admin/` |
| API backend | Creaty `:3020` in Production_Build | `02_Chrome_Extension/creaty-server.js` |
| Persistence | `server_logs/mailbox-lifecycle-domains.json` | STAY in extension tree / `_runtime` pointer |
| Tests | `scripts/tests/ep302c-domain-admin-ui.test.js` → `.tmp/...` | Update `EMAILCORE_ADMIN` → `01_EmailCore/public/admin` |
| Deploy | Render watches `maggouri/emailcore` | Unchanged — commit in emailcore repo after relocate |

**لا تُنفَّذ قبل MP-01C:** commit EP-302C، Render deploy، PE-05 retest على `emailcore.app/admin#domain-registry`.

---

## EP-302C — sequencing after architecture

**Current state (MP-01A):** OPEN — 10 uncommitted files in `public/admin/` (+ server routes/services). Canonical promotion **pending**.

**Ordered sequence (post MP-01C relocate):**

1. **MP-01C** — Relocate emailcore clone to `01_EmailCore`; update env/scripts/tests paths.
2. **Commit EP-302C** — In `maggouri/emailcore` repo (`01_EmailCore`); all 10 porcelain lines.
3. **Deploy Render** — Confirm branch + `render.yaml` service; smoke `emailcore.app` admin.
4. **PE-05** — Downstream pack per EP planning (depends on hosted admin canonical).

Domain registry **APIs** remain on Creaty `:3020` + `server_logs/mailbox-lifecycle-domains.json` (Production_Build / `02_Chrome_Extension`) — separate from EmailCore admin shell per MP-01A.

---

## Sync model (unchanged semantics)

From `scripts/sync-to-emailcore.js`:

- **Source:** Production_Build / `02_Chrome_Extension`.
- **Target:** `NHP_EMAILCORE_DIR` → after migration: `01_EmailCore`.
- **Rule:** Local servers (`creaty-server.js`, `ghost-server.js`, `ai-bridge-server.js`) **stay** in extension tree.
- **Studio modules:** Continue COPY_LIST sync to EmailCore public assets as today.

---

## Infrastructure split

| Layer | Owner subtree | Deploy target |
|-------|---------------|---------------|
| EmailCore web + admin | `01_EmailCore` | Render (`render.yaml`) |
| Creaty / Ghost / AI bridge | `02_Chrome_Extension` | Local PM2 / dev machine |
| Oracle edge | `03_Oracle` (docs) + VM | External VM |
| Caddy / reverse proxy | `07_Infrastructure` | Edge VM + local dev |
| Runtime logs & mailbox JSON | `_runtime` → `E:\NHP_Runtime` | Filesystem only |

---

## Deferred (after MP-01C)

Do **not** author until migration structure is executed and gates pass:

| Document | Purpose |
|----------|---------|
| `README.md` | Platform workspace overview |
| `PROJECT_MAP.md` | Navigable index of numbered subtrees |
| `SETUP.md` | Clone, env, first-run |
| `AI_AGENT_GUIDE.md` | Agent constraints and path constants |

---

## المخاطر والاعتماديات — Risks and dependencies

| ID | Risk | Impact | Mitigation | Owner gate |
|----|------|--------|------------|------------|
| R-01 | **298 dirty lines** in Production_Build | Migration noise; accidental loss of WIP | Stash/tag before MP-01C; document intentional WIP | MB-04 |
| R-02 | **Dual EmailCore clones** (`.tmp/emailcore-ref` vs `E:\NHP EMAILCORE`) | Wrong sync target; divergent admin UI | Consolidate to single `01_EmailCore` in MP-01C | MB-02 |
| R-03 | **Script path hard-coding** (`ep302c-domain-admin-ui.test.js`, sync defaults) | Broken tests/sync after move | Path update checklist in MP-01C; dry-run sync | MB-03 |
| R-04 | **EP-302C commit before relocate** | Files committed under wrong working tree perception | HOLD until MB-03 PASS + MP-01C relocate | MB-03 |
| R-05 | **Production_Build remote unknown** | No official backup/push target | Record `git remote -v` before MP-01C | MB-02 |
| R-06 | **Oracle source not in repo** | `03_Oracle/` docs-only may drift from VM | Contract-first docs; revisit if engine repo found | MB-01 |
| R-07 | **Render deploy during folder move** | Hosted admin downtime | Change window; deploy only after EP-302C commit post-relocate | MB-04 |
| R-08 | **Studio logical split** (`04_NHP_Studio`) | COPY_LIST / import paths break | Defer physical split to MP-01C phase 2 or keep modules in `02_*` | MB-01 |
| R-09 | **`.tmp` stigma in official docs** | CA concern — misleading canonical paths | Rename to `01_EmailCore`; ban `.tmp` in env defaults | MB-01 |
| R-10 | **Creaty `:3020` localhost bridge** | Web admin cannot reach API in production without proxy | AR-09 thin-client pattern; EmailCore proxy decision if friction | MB-03 |

### Dependencies

```text
MP-01A (facts) ──► MP-01B (this doc) ──► MB-01..MB-04 ──► MP-01C (migration)
                                                              │
                                                              ├──► EP-302C commit (emailcore)
                                                              ├──► Render deploy
                                                              └──► PE-05 (hosted admin)
```

**External dependencies:** Render service, Oracle VM + Caddy (`oracle-api.emailcore.app`), local PM2/Creaty on operator machine.

---

## معاينة MP-01C — Migration preview (no execution)

> **One-page preview only.** MP-01C is blocked until all MB gates PASS. **No file moves in MP-01B.**

### Objective

Physically reorganize the local workspace to match the PROPOSAL layout while preserving git history per repo and updating path constants.

### Phase 0 — Preconditions

- MB-01, MB-02, MB-03, MB-04 = PASS (or PASS WITH CONDITIONS documented).
- Full backup: Production_Build + emailcore-ref (git tag or folder copy).
- Record Production_Build `git remote -v`.

### Phase 1 — Workspace shell

1. Create `NHP_PLATFORM/` (or rename/restructure `Production_Build` as umbrella — CA choice in MB-01).
2. Add root `.gitignore` entries for `_runtime/`, `server_logs/`, `.env`.
3. Create `_runtime/` junction/symlink or document `NHP_RUNTIME_DIR=E:\NHP_Runtime`.

### Phase 2 — EmailCore relocate

1. Move `.tmp/emailcore-ref` → `01_EmailCore/` (preserve `.git`).
2. Set `NHP_EMAILCORE_DIR=%NHP_PLATFORM_ROOT%\01_EmailCore`.
3. Update `scripts/tests/ep302c-domain-admin-ui.test.js` `EMAILCORE_ADMIN` path.
4. Verify: `git -C 01_EmailCore status` — expect 10 EP-302C porcelain lines unchanged.

### Phase 3 — Extension tree

1. Move extension + servers into `02_Chrome_Extension/` (or keep root if MB-01 approves in-place renumbering only).
2. Confirm `creaty-server.js`, `ghost-server.js`, `ai-bridge-server.js` remain runnable.
3. Dry-run `node scripts/sync-to-emailcore.js` with new `NHP_EMAILCORE_DIR`.

### Phase 4 — Vault, docs, infra

1. Move `Developer_Vault/` → `05_Developer_Vault/`.
2. Move `docs/planning/` → `06_Documentation/planning/`.
3. Colocate infra scripts under `07_Infrastructure/`; archive `DaftarNosousChromeExtension`, `legacy-restored`, CLIProxy snapshot per mapping table.

### Phase 5 — Verification (smoke)

| Check | Expected |
|-------|----------|
| Extension loads from `02_Chrome_Extension` | manifest valid |
| Creaty `:3020` | domain-registry API responds |
| `node --test scripts/tests/ep302c-domain-admin-ui.test.js` | PASS |
| EmailCore local admin | `#domain-registry` route exists |
| `git status` per repo | No accidental commits |

### Phase 6 — Post-migration (not MP-01C day-1)

- Author deferred docs: `README.md`, `PROJECT_MAP.md`, `SETUP.md`, `AI_AGENT_GUIDE.md`.
- EP-302C commit in `01_EmailCore` → push → Render deploy → PE-05.

### Rollback trigger

Any FAIL in Phase 5 → execute MB-04 rollback: restore `.tmp/emailcore-ref`, revert env and script edits.

**Estimated touch surfaces:** ~15 mapping rows; primary risk = path constants + dual clone consolidation.

---

## Open questions (carry-forward from MP-01A)

1. Production_Build **git remote** URL — required for MB-02.
2. Sibling clone `E:\NHP EMAILCORE` vs `.tmp/emailcore-ref` — consolidate to single `01_EmailCore`.
3. Chrome extension **build artifact** path and release channel.
4. Oracle Engine **application source** repository — until found, `03_Oracle` remains docs/contracts only.

---

## ملخص للمهندس المعماري — Arabic summary for Chief Architect

**الحالة:** `MP01B_READY_FOR_CA_REVIEW`

### التوصية الرئيسية — Mono-repo أم Multi-repo؟

**التوصية: Multi-repo + workspace موحّد (`NHP_PLATFORM/`)** — وليس mono-git واحد.

| السبب | التفصيل |
|-------|---------|
| نشر مستقل | EmailCore على Render (`render.yaml`)؛ الإضافة + Creaty محلياً |
| حدود الثقة | أسرار الإضافة وملفات السيرفر المحلي منفصلة عن المستضاف |
| EP-302C | 10 ملفات تنتمي لـ `maggouri/emailcore` — mono-git يزيد خطأ الـ commit |
| شجرة العمل القذرة | 298 سطر WIP في Production_Build — العزل أفضل من الدمج |

**Workspace موحّد** يعني مجلد أب واحد للتطوير المحلي (`01_`…`07_`) **دون** دمج `.git` في جذر واحد.

### أهم 3 قرارات هيكلية تحتاج اعتماد CA

| # | القرار | التوصية | البوابة |
|---|--------|---------|---------|
| **1** | هيكل `NHP_PLATFORM/` المرقّم (`01_EmailCore` … `07_Infrastructure` + `_runtime/`) | **اعتماد** كمساحة عمل محلية | MB-01 |
| **2** | إعادة تسمية `.tmp/emailcore-ref` → `01_EmailCore` — **ممنوع** `.tmp` في المسارات الرسمية | **اعتماد** مع تحديث `NHP_EMAILCORE_DIR` | MB-02 |
| **3** | تسلسل EP-302C: **HOLD** → MP-01C نقل → commit في emailcore → Render → PE-05 | **اعتماد** — لا commit قبل النقل | MB-03 |

### قرارات ثانوية (مذكورة في البوابات)

- Oracle: **EXTERNAL** — `03_Oracle/` وثائق وعقود فقط حتى يُكتشف مصدر المحرك.
- NHP_Runtime: خارج Git دائماً — مؤشر `_runtime/` فقط.
- وثائق `README` / `PROJECT_MAP` / `SETUP` / `AI_AGENT_GUIDE`: **بعد MP-01C** فقط.

**الخطوة التالية:** مراجعة CA لـ `MP01B_DECISION_GATES.md` (MB-01 … MB-04) ثم فتح MP-01C عند PASS.

---

## References

- MP-01A: `docs/planning/MP01_CANONICAL_SOURCE_DISCOVERY.md`
- NHP_Runtime: `docs/planning/MP01_NHP_RUNTIME_CHECK.md`
- Decision gates: `docs/planning/MP01B_DECISION_GATES.md`
- AR-09: `Developer_Vault/03_ARCHITECTURE_DECISIONS/AR-09.md`
- EP-302C planning: `docs/planning/EP302C_*`
