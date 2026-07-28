# NHP Extension Size + Portable Path Audit — 2026-07-28

**Status:** Phase 1–3 COMPLETE (read-only). Phase 4–6 follow after this report.  
**Verdict (interim):** `AUDIT_COMPLETE_FIX_PENDING` → target `PORTABLE_EXTENSION_STORAGE_AUDITED_AND_FIXED`

---

## 0. Layout map (what exists vs target)

Target portable unit:

```text
NHP_PORTABLE_ROOT/
├── Extension/   ← Chrome runtime only
├── Data/        ← ALL mutable runtime data
└── Source/      ← Git, tests, build tools, docs
```

**Observed on this machine (not yet named Extension/Data/Source):**

| Role | Actual path | Notes |
|------|-------------|--------|
| **Extension (App Root)** | `C:\Users\MAGGOURIKHALID\Desktop\NHP_V30.1_Production_Build` | Flat unpacked Chrome extension; load this folder |
| **Data (adjacent)** | `C:\Users\MAGGOURIKHALID\Desktop\NHP_DATA` | Exists; ~28 GB; correct destination |
| **Source (partial)** | `C:\Users\MAGGOURIKHALID\Desktop\NHP_SOURCE` | Mostly git helpers (~190 MB); not full Source tree |
| **Backup Ext** | `...\NHP_Backups\...\NHP_PLATFORM\02_Chrome_Extension` | ~16.1 GB — still full of runtime data + `.git` |
| Marker | `portable.config.json` on Desktop Ext | `dataRoot: "../NHP_DATA"` (relative — good) |
| Missing markers | `.nhp-portable-root`, `nhp-portable.json` | Not present |

There is **no** single parent folder named `NHP_PORTABLE_ROOT` with three named children; Desktop uses sibling folders `NHP_V30.1_Production_Build` + `NHP_DATA` (+ optional `NHP_SOURCE`).

---

## 1. Phase 1 — Filesystem size audit

### 1.1 Desktop Extension (primary inflation target)

| Metric | Value |
|--------|-------|
| **Total size** | **~1.93 GB** (1,932 MB) |
| File count | ~24,000+ |
| Dir count | ~4,000+ |
| Expected clean (~code+deps) | **~198–492 MB** band (see §1.4) |

### 1.2 Top-level sizes (Desktop Ext)

| Path | Size (MB) | Class | Notes |
|------|-----------|-------|--------|
| `server_profiles/` | **~1,385** | **B Runtime Data / Browser Profiles** | **PRIMARY INFLATION** — Chrome user-data still under Ext |
| `CLIProxyAPI-main/` | **~284** | **F Source / Build / Git** | Nested `.git` + duplicate `.exe` + `.bak` |
| `node_modules/` | **~122** | **A Required Ext (runtime deps)** | Needed for Node servers |
| `addon/` | **~48** | **A Required Ext** | Includes `cliproxyapi-local\cli-proxy-api.exe` (~43 MB) |
| `temp_uploads/` | **~31** | **C Cache / Temp** | Should be under Data |
| `modules/` | **~19** | **A Required Ext** | |
| `CLIProxyAPI_render_fix/` | **~15** | **F Source / Build / Git** | Nested `.git` |
| `metadata_store/` | **~13** | **B Runtime Data / DBs** | Should be under Data |
| `screeeeenvme/` | **~2.4** | **G Unknown / Screenshots** | |
| nested `NHP_DATA/` | **~2.4** | **B / Duplicate stub** | Wrong location (inside Ext) |
| `server_logs/` | **~2** | **C Logs** | Should be under Data |
| Empty stubs | ~0 | **B placeholders** | `server_profiles_creaty*`, `profile_backups*`, `temp_uploads_*` |

### 1.3 Adjacent Data root (`Desktop\NHP_DATA`) — healthy location, huge

| Path | Size (MB) |
|------|-----------|
| `server_profiles` | ~9,366 |
| `profile_backups` | ~5,740 |
| `temp_uploads` | ~4,744 |
| `backups` | ~2,804 |
| `logs` | ~2,593 |
| `generated_designs` | ~971 |
| `archive` | ~784 |
| **Total Data** | **~28,081 MB (~28 GB)** |

Data layout already matches portable contract. Problem is **dual write / leftover copies inside Extension**.

### 1.4 Classification A–G (Desktop Ext)

| Class | Meaning | Items | Approx MB | Action |
|-------|---------|-------|-----------|--------|
| **A** | Required Ext runtime | JS/HTML/CSS, `addon/`, `modules/`, `native-host/`, `server/`, `utils/`, `node_modules/`, manifest, icons | ~197 | Keep |
| **B** | Runtime Data (profiles/DB) | `server_profiles`, `metadata_store`, empty profile stubs, nested `NHP_DATA` | ~1,401 | **Move → Data** (merge-aware) |
| **C** | Cache / Logs / Temp | `server_logs`, `temp_uploads*` | ~34 | **Move → Data** |
| **D** | Images / Downloads / Screenshots | `screeeeenvme`, root `Screenshot_*.png`, large upload PNG | ~3+ | Move or delete-safe |
| **E** | Browser Profiles (Chrome UD) | Contents of `server_profiles/*` (Cache, Code Cache, LevelDB, WasmTts, component_crx_cache, BrowserMetrics) | (subset of B) | Under Data only |
| **F** | Source / Build / Git / Backups | `CLIProxyAPI-main` (+`.git`), `CLIProxyAPI_render_fix`, `.map` in node_modules, `.bak` exe | ~300+ | Out of Ext / exclude from package |
| **G** | Unknown / Duplicates | Nested empty stubs; Ext profiles that also exist in Data | — | Resolve via migration |

**Hypothetical after removing B+C+F candidates:** ~**198 MB** remaining (below the ~492 MB expectation).  
**492 MB band** ≈ current total minus `server_profiles` only (1,932 − 1,385 ≈ **547 MB**), or minus profiles + CLIProxy git trees ≈ **198–250 MB** + optional kept `node_modules` polish.

### 1.5 Critical overlap: Ext profiles vs Data profiles

All **10** Ext profile folders also exist under Data. **Ext copies are NEWER** (mtime Jul 26–28) than Data copies (Jul 23–24).

| Profile | Ext MB | Ext mtime | Data MB | Data mtime | Newer |
|---------|--------|-----------|---------|------------|-------|
| edmundberger059_gmail_com | 249 | 2026-07-28 | 426 | 2026-07-26* | **EXT** |
| teeswaggerss008_gmail_com | 237 | 2026-07-28 | 401 | 2026-07-24 | **EXT** |
| tee_kmaggouri_gmail_com | 240 | 2026-07-28 | 395 | 2026-07-24 | **EXT** |
| mila_fowler47_emailcore_app | 225 | 2026-07-28 | 849 | 2026-07-24 | **EXT** |
| khalidmaggouri391_gmail_com | 213 | 2026-07-28 | 255 | 2026-07-24 | **EXT** |
| (+5 smaller) | … | … | … | … | **EXT** |

\*Data overall still larger (more history/cache), but **session activity is writing into Extension**.

**Implication:** Safe fix must **merge Ext → Data (newer wins)** before removing Ext copies — do **not** delete Ext profiles blindly.

### 1.6 Top file types (Desktop Ext)

| Ext / kind | Count | MB |
|------------|-------|-----|
| (no ext / cache blobs) | ~9,889 | ~1,211 |
| `.exe` | 3 | ~130 |
| `.pma` (BrowserMetrics) | 41 | ~116 |
| `.wasm` | 5 | ~109 |
| `.png` | 705 | ~46 |
| `.js` | 3,437 | ~37 |
| `.map` (sourcemaps) | 2,440 | ~19 |

### 1.7 Backup Platform Ext (`02_Chrome_Extension`)

| Path | Size (MB) | Class |
|------|-----------|-------|
| `server_profiles` | ~8,756 | B/E |
| `profile_backups` | ~4,181 | B |
| `.git` | ~1,823 | F |
| `server_profiles_creaty` | ~703 | B |
| `generated_designs` | ~215 | B |
| `server_profiles_pinterest` | ~172 | B |
| `node_modules` | ~122 | A |
| **Total** | **~16,113** | Inflated archive, not the live Desktop load path |

### 1.8 Searches performed inside Extension

Found: `node_modules`, nested `.git` (CLIProxy trees), `server_profiles` (Chrome Cache/Code Cache/LevelDB patterns), `temp_uploads`, `metadata_store`, `server_logs`, `*.map`, `*.bak`/`*.bak-dev-*`, Wasm/component caches, empty profile stub dirs.  
Not a clean Ext-only tree.

---

## 2. Phase 2 — Path origin audit (writers)

### 2.1 Portable helper exists but servers mostly ignore Data root

`utils/nhp-portable-paths.js` → `getPortablePaths()` correctly resolves:

- App root via `NHP_APP_ROOT` / hints / `package.json`+`manifest.json`
- Data root via `NHP_DATA_ROOT` or `portable.config.json` → `../NHP_DATA`
- Subdirs: `server_profiles*`, `temp_uploads*`, `metadata_store`, `server_logs`, etc.

**Launchers** (`_NHP_Portable_Init.cmd`, `_NHP_Set_Data_Env.cmd`) set `NHP_DATA_ROOT` correctly from `%~dp0` chain — **good**.

### 2.2 Writer table (high risk)

| Writer | Source file | Function / site | Current resolved path | Expected path | Type | Can grow | Risk | Recommended fix |
|--------|-------------|-----------------|----------------------|---------------|------|----------|------|-----------------|
| Ghost server dirs | `ghost-server.js` | module init `ROOT_DIR` + `path.join(ROOT_DIR,'server_profiles')` | **App Root** (`resolveNhpProjectRoot` = Ext) | `Data/server_profiles` | Profiles | Yes | **Critical** | Use `getPortablePaths().get('server_profiles')` |
| Ghost temp/logs/meta | `ghost-server.js` | same | App Root `temp_uploads`, `server_logs`, `metadata_store` | Data/* | Temp/Logs/DB | Yes | **Critical** | Same |
| Creaty server | `creaty-server.js` | `ROOT_DIR = __dirname` + mkdir profiles | **Ext**/`server_profiles_creaty*` | Data/* | Profiles | Yes | **Critical** | Portable data getters |
| AI Bridge | `ai-bridge-server.js` | `ROOT_DIR = __dirname` | **Ext**/`temp_uploads_ai_bridge`, logs | Data/* | Temp/Logs | Yes | **High** | Portable data getters |
| Pinterest | `pinterest-server.js` | `ROOT_DIR = __dirname` | **Ext**/`server_profiles_pinterest` | Data/* | Profiles | Yes | **High** | Portable data getters |
| Generate API | `server/generate-api.js` | `getPortablePaths` **with** fallback `path.join(rootDir,'generated_designs')` | Data if portable OK; else Ext | Data only | Generated | Yes | Medium | Remove Ext fallback |
| Library FS | `server/library-fs.js` | `resolveNhpProjectRoot` | Finds **App** root only | App vs Data split | — | — | Medium | Keep for App; pair with Data resolver |
| Native host | `native-host/nhp_native_host.js` | `getPortablePaths` | Data OK | Data | mkdir | Low | Low | Keep |
| Setup core | `utils/nhp-setup-core.js` | `getPortablePaths` | Data OK | Data | Logs | Low | Low | Keep |
| Hardcoded path | `creaty-server.js` | `extraNodePaths` includes `C:\Users\maggouri\Desktop\_ORGANIZED_NHP\...` | Fixed absolute (if exists) | Relative/portable only | Deps | No | **Portable break** | Remove absolute path |
| Docs smell | `DATA_ROOT_README.md` | absolute `C:\Users\...` | Docs only | Relative wording | Doc | No | Low | Soften wording |

### 2.3 Root cause of ~1 GB Ext inflation (Desktop)

1. **Active path bug:** Ghost / Creaty / AI Bridge / Pinterest resolve mutable dirs under **Extension App Root**, not `NHP_DATA`, so Chrome profiles (~1.38 GB) and related files keep growing inside Ext even after Data migration.
2. **Incomplete leftover migration:** Empty stubs + leftover `metadata_store` / `server_logs` / `temp_uploads` remain under Ext.
3. **Source trees inside Ext:** `CLIProxyAPI-main` (~284 MB with `.git` + bak exe) and `CLIProxyAPI_render_fix` — packaging pollution (not required next to `addon/cliproxyapi-local` binary).

**Expected ~492 MB** is consistent with “Ext without the leftover/active `server_profiles` blob” (or with deps + cliproxy binary kept). Goal is **correct distribution**, not forcing a number.

---

## 3. Phase 3 — Build / deploy audit

| Mechanism | Behavior | Issue |
|-----------|----------|--------|
| `package.json` / `npm install` | Installs into Ext `node_modules` (~122 MB) | Required for servers; OK. Sourcemaps inside deps optional to prune |
| `_NHP_Portable_Init.cmd` | `npm install --omit=dev` if missing `node_modules` | Writes into Ext (acceptable for deps) |
| `addon/cliproxyapi-local` | Ships `cli-proxy-api.exe` | Correct runtime location |
| `CLIProxyAPI-main/` | Full upstream clone + git + bak binaries | **Should not ship in Ext**; Source/whitelist exclude |
| Backup `02_Chrome_Extension/.git` | ~1.8 GB | Dev repo inside Ext tree — packaging anti-pattern |
| No whitelist packager found | Copy/rsync of whole tree likely | Recommend **whitelist packaging** |

### Recommended whitelist (Extension package)

Include:

- `manifest.json`, `package.json`, `package-lock.json`, `.env.example`
- `portable.config.json` / `nhp-portable.json`
- Root extension JS/HTML/CSS used by Chrome
- `addon/`, `background/`, `js/`, `logic/`, `modules/`, `native-host/`, `server/`, `utils/`, `ui/`, `icons/`, `_locales/`, `runtime/`
- `node_modules/` (or install-on-first-run)
- Launchers: `NHP_*.cmd`, `Start_*.cmd`, `STOP*`, `Register_*`, `START_NHP_PORTABLE.cmd`

Exclude:

- `server_profiles*`, `profile_backups*`, `temp_uploads*`, `metadata_store`, `server_logs`, `generated_designs`, `backups`, `.tmp`, `archive`
- `CLIProxyAPI-main/`, `CLIProxyAPI_render_fix/`, nested `.git`, `*.map` (optional), `*.bak*`, screenshots dumps
- Secrets: `.env` (ship example only)

---

## 4. Phase 4–6 plan (authorized after this report)

1. **Expand** `nhp-portable-paths.js` with explicit getters + `resolveWritableDataPath(rel)` (no `..`, assert under Data, outside Ext/Source).
2. **Add** `nhp-portable.json` marker (relative names only).
3. **Fix** `ghost-server.js`, `creaty-server.js`, `ai-bridge-server.js`, `pinterest-server.js` to use Data getters; remove hardcoded absolute node_modules path.
4. **Migration script** (dry-run first): merge Ext mutable dirs → Data (no overwrite of newer Data files; Ext-newer wins); list sizes; rollback manifest; then execute move.
5. **Guard:** throw/log if writable resolve lands inside Extension root.
6. **Cleanup rules:** log rotate, temp TTL, single profiles location under Data.
7. **Tests:** path regression (cwd independence, relative-only, no Ext writes).

---

## 5. Size snapshot (before fix)

| Tree | Before |
|------|--------|
| Desktop Extension | **~1,932 MB** |
| Desktop NHP_DATA | ~28,081 MB |
| After removing B+C+F from Ext (projected) | **~198 MB** |
| After removing only active profiles from Ext (projected) | **~547 MB** |

---

## 6. Non-negotiables respected

- No deletes/moves performed during Phase 1–3.
- DATA_ROOT remains adjacent portable Data (`../NHP_DATA`), not AppData / fixed `C:\NHP`.
- Chrome load path stays the same App Root.
- Force-push / secrets out of scope.

---

*Report generated 2026-07-28. Next: implement Phase 4–6 and append results + final verdict.*
## 7. Phase 4–6 results (2026-07-28)

### PortablePathResolver
- Expanded `utils/nhp-portable-paths.js` with: `getPortableRoot`, `getExtensionRoot`, `getDataRoot`, `getSourceRoot`, `getLogsDir`, `getCacheDir`, `getDownloadsDir`, `getProfilesDir`, `getDatabaseDir`, `getGeneratedDir`, `getTempDir`, `getBackupsDir`, `resolveWritableDataPath`, `assertNotExtensionWrite`.
- Markers added: `nhp-portable.json` (relative folders only) + `.nhp-portable-root`.
- Env trust: `NHP_DATA_ROOT` only honored when `NHP_APP_ROOT` matches the resolved app root.

### Path fixes (no Ext runtime writes)
- `ghost-server.js`, `creaty-server.js`, `ai-bridge-server.js`, `pinterest-server.js` → Data via `getPortablePaths`.
- Removed hardcoded absolute `node_modules` path from `creaty-server.js`.
- `server/profile-browser-lock.js`, `server/generate-api.js` → Data; removed Ext fallback + `process.cwd()` as primary.
- Startup cleanup: `utils/nhp-data-cleanup.js` (temp TTL, log rotate, cache budget).

### Migration
- Dry-run then execute: `node scripts/migrate-ext-mutable-to-data.js --execute --move-source-pollution`
- Manifest: `NHP_DATA/.migration/ext-mutable-migrate-2026-07-28T17-03-14-063Z.json`
- Moved/merged into Data: `server_profiles`, `metadata_store`, `server_logs`, `temp_uploads*`, stubs, nested `NHP_DATA`
- Relocated to Source: `CLIProxyAPI-main`, `CLIProxyAPI_render_fix`, `screeeeenvme`

### Size before / after (Desktop Extension)
| | MB |
|--|--|
| **Before** | **~1,941** |
| **After** | **~198** |
| Delta | **−1,743 MB** |

### Tests
`node scripts/tests/portable-paths-regression.test.js` → PASS (cwd independence, spaces, non-Latin, write-guard, live layout).

### Final verdict
**`PORTABLE_EXTENSION_STORAGE_AUDITED_AND_FIXED`**

Note: NHP node servers were stopped for migration; restart via `START_NHP_PORTABLE.cmd` / `NHP_Start_All_Servers.cmd`. Backup Platform Ext tree (~16 GB) was not bulk-cleaned (archive); code + report synced for source of truth.
