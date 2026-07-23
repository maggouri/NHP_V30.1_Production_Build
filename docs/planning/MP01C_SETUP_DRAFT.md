# MP-01C — SETUP.md Draft (for merge into NHP_PLATFORM)

**Task:** MP-01C (parallel documentation track)  
**Generated:** 2026-07-07 (UTC+1)  
**Status:** `DRAFT` — merge when migration agent completes  
**Target file:** `NHP_PLATFORM/SETUP.md`  
**Inputs:** `MP01B_REPOSITORY_ARCHITECTURE.md`, existing `NHP_PLATFORM/SETUP.md`, `MP01C_MIGRATION_REPORT.md`

---

> **Merge instruction:** Replace or reconcile with `NHP_PLATFORM/SETUP.md` after MP-01C COMPLETE and CA sign-off on `MP01C_DELIVERABLES_CHECKLIST.md`.

---

## Document purpose

**Goal:** New developer loads extension and reaches Creaty `:3020` in under one hour.

**Audience:** Human operators and onboarding agents.

---

## Section 1 — Prerequisites

| Requirement | Minimum |
|-------------|---------|
| OS | Windows 10+ |
| Node.js | 18+ |
| Browser | Chrome (unpacked extension) |
| Git | Required for EmailCore clone operations |
| Disk | Space for `E:\NHP_Runtime` (external, never in git) |

---

## Section 2 — Workspace entry point

### 2.1 Open folder

```text
E:\NHP_V30.1_Production_Build
```

**AR-12 rule:** Cursor/IDE workspace path stays at workspace root — **not** inside `NHP_PLATFORM/` alone.

### 2.2 Platform layout overview

```text
NHP_PLATFORM/
├── 01_EmailCore/          ← own git → maggouri/emailcore
├── 02_Chrome_Extension/   ← Phase 2: extension source target
├── 03_Oracle/             ← docs-only (EXTERNAL VM)
├── 04_NHP_Studio/         ← Phase 2: deferred split
├── 05_Developer_Vault/
├── 06_Documentation/
├── 07_Infrastructure/
└── _runtime/              ← gitignored pointer to NHP_Runtime
```

**MP-01C note:** Extension source may remain at workspace root until Phase 2 physical move.

---

## Section 3 — Environment variables

Copy `.env.example` → `.env` at workspace root.

```env
# EmailCore canonical path (MP-01C default)
NHP_EMAILCORE_DIR=E:/NHP_V30.1_Production_Build/NHP_PLATFORM/01_EmailCore

# Runtime data — NEVER commit
NHP_RUNTIME_DIR=E:/NHP_Runtime
```

| Variable | Purpose |
|----------|---------|
| `NHP_EMAILCORE_DIR` | Target for `sync-to-emailcore.js` |
| `NHP_RUNTIME_DIR` | Backups, cache, sessions — external to git |

**Secrets:** `.env` only — never commit tokens or certs.

---

## Section 4 — EmailCore (optional local run)

```powershell
cd NHP_PLATFORM\01_EmailCore
npm install
npm start
```

| Item | Value |
|------|-------|
| Git remote | `https://github.com/maggouri/emailcore.git` |
| Production URL | `https://emailcore.app` (Render) |
| Admin UI (EP-302C) | `01_EmailCore/public/admin/` — OPEN until deploy |

---

## Section 5 — Local servers (extension tree)

From **workspace root** (until Phase 2):

```powershell
node creaty-server.js      # :3020 — domain registry API
node ghost-server.js       # :3019
node ai-bridge-server.js   # :3031
```

Or: `NHP_Start_All_Servers.bat` if present.

**Rule (MP-01B):** Servers **stay** in extension tree — not copied to EmailCore.

---

## Section 6 — Load Chrome extension

1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select workspace root: `E:\NHP_V30.1_Production_Build`
4. See `LOAD_EXTENSION.txt` for Extension ID notes

**Phase 2 change:** Load path moves to `NHP_PLATFORM/02_Chrome_Extension/` — update this section when Phase 2 completes.

---

## Section 7 — Sync extension → EmailCore

```powershell
node scripts\sync-to-emailcore.js
```

| Item | Detail |
|------|--------|
| Source | Workspace root (extension) |
| Default target | `NHP_PLATFORM/01_EmailCore` |
| Override | `NHP_EMAILCORE_DIR` env var |
| Excluded | Local servers (`creaty-server.js`, etc.) |

Dry-run diff (optional):

```powershell
node scripts\sync-diff.js
```

---

## Section 8 — Verify tests

```powershell
node --test scripts\tests\ep302a-domain-registry.test.js
node --test scripts\tests\ep302b-domain-api.test.js
node --test scripts\tests\ep302c-domain-admin-ui.test.js
```

EP-301 suite: `scripts\tests\ep301*.test.js`

**Expected after MP-01C:** EP-302 → 42/42 PASS.

---

## Section 9 — Developer Vault

Canonical docs entry:

```text
NHP_PLATFORM/05_Developer_Vault/00_READ_FIRST.md
```

Architecture decisions: `05_Developer_Vault/03_ARCHITECTURE_DECISIONS/` (AR-09, AR-12).

---

## Section 10 — Troubleshooting

| Issue | Check |
|-------|-------|
| Wrong EmailCore path | `NHP_EMAILCORE_DIR`, `PROJECT_MAP.md` |
| Extension won't load | Load from workspace root (Phase 2: `02_Chrome_Extension/`) |
| Domain API 404 | Creaty on `:3020` running |
| EP-302C admin missing locally | `01_EmailCore/public/admin/` — pack OPEN |
| Hosted admin stale | EP-302C not deployed yet — see post-sequence doc |
| Dual EmailCore clones | Use **only** `01_EmailCore/` — retire `.tmp/emailcore-ref` |
| Arabic text corrupted | Save all files UTF-8 |

---

## Section 11 — Post-setup sequence (reference only)

After MP-01C CA sign-off, EP-302C follows:

`MP01C_EP302C_POST_SEQUENCE.md` — commit in emailcore → push → Render → PE-05.

**Do not execute during initial setup.**

---

## Section 12 — Backup and rollback

| Backup | Path |
|--------|------|
| Full pre-migration | `E:\NHP_V30.1_Production_Build_MP01C_BACKUP` |
| In-repo mirror | `backups/MP01C_pre_migration_20260707/` |

Rollback: see `MP01C_MIGRATION_REPORT.md` § Rollback steps.

---

## Merge checklist (for migration agent)

- [ ] Confirm workspace root vs Phase 2 extension path
- [ ] Verify `NHP_EMAILCORE_DIR` default matches live scripts
- [ ] Update extension load path if Phase 2 complete
- [ ] Cross-link `PROJECT_MAP.md` and `AI_AGENT_GUIDE.md`
- [ ] Remove duplicate content after merge
- [ ] Preserve UTF-8 for Arabic sections in Vault cross-links

---

## ملخص عربي — Arabic summary

**SETUP.md** يشرح: فتح مساحة العمل، متغيرات البيئة، تشغيل EmailCore اختيارياً، سيرفرات Creaty/Ghost محلياً، تحميل الإضافة، المزامنة مع EmailCore، والاختبارات. **الإضافة تُحمّل من جذر مساحة العمل** حتى Phase 2.

---

*Draft — merge into NHP_PLATFORM/SETUP.md when migration completes.*
