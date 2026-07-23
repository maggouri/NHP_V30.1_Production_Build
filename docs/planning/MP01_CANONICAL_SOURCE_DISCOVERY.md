# MP-01 — Canonical Source Discovery (Phase 1)

**Task:** MP-01  
**Generated:** 2026-07-07 (UTC+1)  
**Scope:** Read-only discovery. Evidence from filesystem + git commands only.  
**Workspaces scanned:** `E:\NHP_V30.1_Production_Build`, `E:\NHP_Runtime`, `.tmp\emailcore-ref`

---

## 1. Executive summary (Arabic-friendly)

| # | Finding | Status |
|---|---------|--------|
| 1 | **إضافة Chrome + السيرفرات المحلية** — المصدر المعتمد هو مجلد `Production_Build` الجذري (`manifest.json`, `creaty-server.js`, `LOAD_EXTENSION.txt`). | مثبت |
| 2 | **EmailCore Web** — المصدر المعتمد في Git: `https://github.com/maggouri/emailcore.git` (فرع `main`). النسخة المحلية المرجعية: `.tmp\emailcore-ref`. النشر المستضاف: `emailcore.app` عبر Render (`render.yaml` في المستودع). | مثبت |
| 3 | **EP-302C (Domain Management — Option A)** — التغييرات موجودة في `.tmp\emailcore-ref` (**10** ملفات معدّلة/غير متعقّبة)، **بدون commit**. الحالة القانونية للمصدر: **PENDING / UNKNOWN** حتى push + deploy. **EP-302C OPEN.** | مثبت |
| 4 | **NHP_Runtime** — مجلد **Runtime فقط** (`E:\NHP_Runtime`): بيانات تشغيل + `runtime.manifest.json`. **لا `.git`، لا `manifest.json` إضافة Chrome.** | مثبت |
| 5 | **Oracle Engine** — لا شجرة كود engine في المسارات الممسوحة. المراجع في `Developer_Vault\04_INFRASTRUCTURE\` + سكربتات `tmp-caddy-*.sh` (إشارة إلى `engine.env` على VM). | جزئي — مصدر التطبيق غير مثبت |
| 6 | **NHP Studio** — ملفات داخل شجرة الإضافة (`studio_hub.html/js`, `modules/studio/`). ليست تطبيق ويب منفصل. | مثبت |
| 7 | **Developer Vault** — موجود تحت `Production_Build\Developer_Vault\`، **غير متعقّب** في git الرئيسي (`?? Developer_Vault/`). | مثبت |
| 8 | **Production_Build git** — فرع `main`، HEAD `b69b5765` (`EP-302B Complete`)، **298** سطر porcelain، **لا remote** في `.git\config`. | مثبت |

**Phase 2:** تأكيد promote/commit لـ EP-302C، remote لـ Production_Build، ومصدر Oracle Engine — مؤجل.

---

## 2. Platform layer diagram (text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CANONICAL SOURCE (edit here)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Chrome Extension + local servers  →  E:\NHP_V30.1_Production_Build\         │
│ EmailCore Web app                 →  github.com/maggouri/emailcore (main)   │
│ Developer Vault (docs)            →  Production_Build\Developer_Vault\    │
│ Infrastructure scripts (Caddy VM) →  Production_Build\tmp-caddy-*.sh      │
│ Oracle Engine app source          →  غير مثبت في هذا المسح                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BUILD OUTPUT                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ EmailCore Web  →  Render (`render.yaml`: npm install / npm start)           │
│ Chrome ext CRX/ZIP packaged release  →  غير مثبت                            │
│ sync-to-emailcore.js  →  copies to ../NHP EMAILCORE (or NHP_EMAILCORE_DIR)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RUNTIME (what runs)                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Chrome Extension  →  browser unpacked from Production_Build (LOAD_EXTENSION)  │
│ Local servers     →  creaty-server.js :3020, ghost :3019, ai-bridge :3031   │
│ EmailCore hosted  →  https://emailcore.app (Render; render.yaml EMAIL_DOMAIN)│
│ Oracle edge       →  oracle-api.emailcore.app + Caddy (Vault docs only)     │
│ Runtime data dirs →  E:\NHP_Runtime\ (uploads, profiles, cache, logs, …)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRODUCTION / OPERATOR COPIES                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Reference clone   →  .tmp\emailcore-ref (10 dirty EP-302C files)            │
│ Alt extension     →  NHP EMAILCORE (documented; E:\NHP EMAILCORE absent)    │
│ Snapshots         →  legacy-restored\, backups\, DaftarNosousChromeExtension│
│ CLIProxy refs     →  .tmp\CLIProxyAPI-official, CLIProxyAPI_render_fix\      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Master component table

| Component | Canonical Source | Build Output | Runtime | Temp Copies | Reference Copies | Evidence |
|-----------|------------------|--------------|---------|-------------|------------------|----------|
| **Chrome Extension** | `E:\NHP_V30.1_Production_Build\` — root `manifest.json` v30.1.23, `background.js`, `modules/*`, `popup.html` | غير مثبت (no CRX/ZIP path in scan) | Chrome unpacked load per `LOAD_EXTENSION.txt`; Extension ID expected `lnfplhpnfclldpofcclibhlfcgkhhhob` for this folder | `backups\` dated snapshots; modified `modules/creaty/*` (3 files M in git status) | `DaftarNosousChromeExtension\` (separate manifest, no git); `LOAD_EXTENSION_FROM_EMAILCORE.txt` marks NHP EMAILCORE as alternate; `legacy-restored\` studio snapshots | `LOAD_EXTENSION.txt` L6–15: load from Production_Build; `manifest.json` exists; `scripts/sync-to-emailcore.js` L2–4: PB is sync **source**; git: 298 dirty lines |
| **EmailCore Web** | `https://github.com/maggouri/emailcore.git` branch `main` | Render deploy: `render.yaml` `buildCommand: npm install`, `startCommand: npm start`, `repo: https://github.com/maggouri/emailcore` | Hosted `emailcore.app` / `nocochat.com` (`render.yaml` L47–53 `EMAIL_DOMAIN`, `EMAIL_DOMAINS`) | `.tmp\emailcore-ref\` — local clone, **10 dirty files** (EP-302C) | `scripts/sync-to-emailcore.js` default target `../NHP EMAILCORE` (sibling; **`E:\NHP EMAILCORE` not present** on scan machine) | Clone HEAD `c20e800` 2026-06-27; `package.json` `main: server/index.js`; `public/admin/` 60 files listed; `render.yaml` present |
| **Oracle Engine** | غير مثبت | غير مثبت | `oracle-api.emailcore.app` — edge API domain per `Developer_Vault\04_INFRASTRUCTURE\INFRA_BASELINE_PHASE2.md` L25; VM `/home/ubuntu/engine.env` referenced in `tmp-caddy-*.sh`, `tmp-find-env.sh` | — | — | No `oracle-engine` / `OracleEngine` folder under Production_Build; EP planning docs state no Oracle DB migration in EP-302 |
| **NHP Studio** | `E:\NHP_V30.1_Production_Build\` — `studio_hub.html`, `studio_hub.js`, `modules/studio/studio.js` (in sync COPY_LIST) | غير مثبت | Extension context: `studio_hub.js` in `manifest.json` `web_accessible_resources` L289; local Ghost `:3019`, AI Bridge `:3031` per `LOAD_EXTENSION.txt` L28–31 | — | `legacy-restored\StudioPipeline\` (9 files, no git) | `studio_hub.html` title "Multi-Session Hub \| Niche Hunter Pro"; `sync-to-emailcore.js` COPY_LIST includes `modules/studio/studio.js` |
| **Developer Vault** | `E:\NHP_V30.1_Production_Build\Developer_Vault\` | N/A (documentation) | N/A | — | — | `00_READ_FIRST.md` present (21 vault files); `git status --short Developer_Vault` → `?? Developer_Vault/` (untracked) |
| **Infrastructure (Caddy/proxy scripts)** | Split — see rows below | See Build Output column | See Runtime column | `.tmp\CLIProxyAPI-official\` (830 files, **no `.git`**) | `CLIProxyAPI_render_fix\` git clone `https://github.com/maggouri/CLIProxyAPI.git` | Multiple canonical loci; no single repo |

**Infrastructure sub-rows (evidence):**

| Sub-component | Canonical Source | Build Output | Runtime | Temp / Reference | Evidence |
|---------------|------------------|--------------|---------|------------------|----------|
| Caddy / Oracle edge | `tmp-caddy-06e.sh`, `tmp-caddy-06e-v2.sh`, `tmp-caddy-validate.sh`, `tmp-env-keys.sh`, `tmp-find-env.sh` at Production_Build root | غير مثبت (shell scripts for VM) | Oracle VM + Caddy per `INFRA_BASELINE_PHASE2.md` L9–19 | — | Scripts grep `/home/ubuntu/engine.env`; Vault L16–19 Caddy HTTPS path |
| EmailCore Render | `emailcore` repo `render.yaml` | Render web service `emailcore` | `emailcore.app` | `.tmp\emailcore-ref` | `render.yaml` L13–31 |
| Local Creaty/Ghost servers | `creaty-server.js`, `ghost-server.js`, `ai-bridge-server.js` in Production_Build | غير مثبت | Ports 3020/3019/3031; `NHP_Start_All_Servers.bat` (untracked) | — | `sync-to-emailcore.js` L3–4: servers **stay** in Production_Build |
| CLIProxy API | غير مثبت as single canonical tree | غير مثبت | Used by EmailCore AI settings per README | `.tmp\CLIProxyAPI-official\` snapshot | `CLIProxyAPI_render_fix\` branch `main`, HEAD `94322b1`, dirty 2 |

---

## 4. Git repository inventory

| Path | Branch | Remote URL | Last commit | Dirty count |
|------|--------|------------|-------------|-------------|
| `E:\NHP_V30.1_Production_Build` | `main` | **غير مثبت** — no `[remote]` in `.git\config` | `b69b5765b40bd7d67a93339f82295fa69c4086ab` \| 2026-07-07 15:56:59 +0100 \| EP-302B Complete | **298** |
| `E:\NHP_V30.1_Production_Build\.tmp\emailcore-ref` | `main` | `origin` → `https://github.com/maggouri/emailcore.git` | `c20e8008affe32eabf8b4c42e9b4bf36c32f6d09` \| 2026-06-27 00:17:03 +0200 \| fix(chat-agent): harden session tools per security review | **10** |
| `E:\NHP_V30.1_Production_Build\CLIProxyAPI_render_fix` | `main` | `origin` → `https://github.com/maggouri/CLIProxyAPI.git` | `94322b188b04279e1495f963b6fbab33d6bfb59d` \| 2026-06-20 20:07:03 +0100 \| fix(codex): strip image response_format upstream | **2** |
| `.tmp\CLIProxyAPI-official` | — | — | — | **NO `.git`** |
| `.tmp\CLIProxyAPI_7.2.27_windows_amd64` | — | — | — | **NO `.git`** (depth-3 scan) |
| `DaftarNosousChromeExtension` | — | — | — | **NO `.git`** |
| `legacy-restored` | — | — | — | **NO `.git`** |

**Depth-3 `.tmp` git scan:** only `.tmp\emailcore-ref` contains `.git`.

---

## 5. EP-302C sensitivity — canonical status **PENDING**

**Pack status:** **OPEN** — `EP302C_OPTION_A_IMPLEMENTATION.md` L6: "Commit: None (per instructions)".

**Where changes landed (`.tmp\emailcore-ref` `git status --short`):**

| State | Path | EP-302C role (from planning docs) |
|-------|------|-------------------------------------|
| M | `public/admin/index.html` | Sidebar nav Domain Management |
| M | `public/admin/js/admin.js` | `#domain-registry` route + gating |
| M | `public/admin/js/i18n.js` | EN/AR labels |
| M | `server/routes/creaty.js` | Server-side (not admin UI only) |
| M | `server/services/ai-client.js` | Server-side |
| M | `server/services/mail-classifier.js` | Server-side |
| M | `server/services/session-classifier.js` | Server-side |
| ?? | `public/admin/css/domain-registry.css` | Panel styles |
| ?? | `public/admin/js/domain-registry-helpers.js` | Validation helpers |
| ?? | `public/admin/js/domain-registry.js` | Full admin CRUD UI |

**Also changed in Production_Build (Creaty Quick Access — separate tree):** `modules/creaty/domain-registry-ui.js`, `creaty.html` per `EP302C_OPTION_A_IMPLEMENTATION.md` L57–59 — part of extension canonical source, not emailcore-ref.

**Canonical promotion:** **UNKNOWN / PENDING** — changes exist only in local `.tmp\emailcore-ref` clone; not committed to `maggouri/emailcore`; Render deploy pulls remote `main` (`render.yaml` L21–23). Production URL documented: `https://emailcore.app/admin#domain-registry` (`EP302C_OPTION_A_IMPLEMENTATION.md` L34).

**Test reference path:** `scripts/tests/ep302c-domain-admin-ui.test.js` L18 → `EMAILCORE_ADMIN = .tmp/emailcore-ref/public/admin`.

**Sync gap:** `scripts/sync-to-emailcore.js` COPY_LIST does **not** include `domain-registry-*.js` — extension→NHP EMAILCORE sync will not propagate EP-302C admin files (`EP302C_SCOPE_REVIEW.md` cited in prior planning).

---

## 6. NHP_Runtime classification — **Runtime, not source**

| Check | Result | Evidence |
|-------|--------|----------|
| Path | `E:\NHP_Runtime` | Exists |
| `.git` | **Absent** | `Test-Path` → `False` |
| Chrome `manifest.json` | **Absent** | `Test-Path` → `False` |
| `runtime.manifest.json` | **Present** | Declares `runtimeRoot: E:/NHP_Runtime`, dirs: uploads, temp, backups, logs, profiles, cache, sessions, locks, metadata |
| Directory structure | Runtime data only | Subdirs present (empty placeholders): `backups`, `cache`, `designs\jobs`, `designs\library`, `locks`, `logs`, `metadata`, `profiles`, `sessions`, `temp`, `uploads` |
| Source code | **None** in tree | Only manifest + empty runtime dirs |

**Classification:** **Runtime data directory** — not canonical source for any component.

---

## 7. Production_Build root — key files (scan)

| File | Present | Notes |
|------|---------|-------|
| `manifest.json` | Yes | MV3, v30.1.23 |
| `creaty-server.js` | Yes | Port 3020 server entry |
| `emailcore-handlers.js` | Yes | Extension bridge handlers (L1–4) |
| `sync-to-emailcore.js` | Yes | `scripts/` — PB → NHP EMAILCORE |
| `LOAD_EXTENSION.txt` | Yes | Primary load instructions |
| `studio_hub.html` | Yes | Extension studio hub page |

**Grep highlights (`docs/planning` + `scripts`):**

- `emailcore-ref`: EP302C_* docs, test path in `ep302c-domain-admin-ui.test.js`
- `emailcore.app`: render.yaml, EP301/302 tests, EP302C production URL
- `oracle`: `Developer_Vault\04_INFRASTRUCTURE\`, `tmp-*-env.sh`, `tmp-caddy-*.sh`
- `NHP_Runtime`: this report only (no prior doc hits in scripts)
- `Developer_Vault`: EP302_CHARTER, EP302C_OPTION_A, AR-08/AR-09 refs

---

## 8. Phase 2 deferred

Confirm EP-302C commit/push + Render deploy alignment; locate Production_Build git remote; locate Oracle Engine application source repository — **deferred to Phase 2**.

---

*End of MP-01 Phase 1 report. Facts only; no remediation executed.*
