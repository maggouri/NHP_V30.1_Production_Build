# MP-01 — تقرير الاكتشاف (Discovery)

**المسار:** `E:\NHP_V30.1_Production_Build`  
**تاريخ الجمع:** 2026-07-07 (قراءة فقط، بدون commits)

---

## 1) Git في الجذر (Production_Build)

| حقل | قيمة |
|-----|------|
| `git rev-parse --show-toplevel` | `E:/NHP_V30.1_Production_Build` |
| الفرع | `main` |
| remote | **لا يوجد** (`git remote -v` فارغ؛ `remote.origin.url` غير مضبوط) |
| آخر commit | `b69b5765b40bd7d67a93339f82295fa69c4086ab` — `2026-07-07 15:56:59 +0100` — `EP-302B Complete` |
| `git log -3 --oneline` | `b69b5765 EP-302B Complete` · `d0844f3a EP-302A Complete` · `a507d308 EP-301E Complete` |
| أسطر `git status --porcelain` | **298** |
| untracked (`??` في porcelain) | **295** |
| `git ls-files --others --exclude-standard` | **9667** ملف |

### عينة 30 سطراً من `git status --porcelain`

```
 M modules/creaty/creaty.css
 M modules/creaty/creaty.html
 M modules/creaty/creaty.js
?? .agents/
?? .cursor/
?? .cursorignore
?? .gitignore
?? .tmp/
?? CLIProxyAPI_render_fix/
?? Create_Portable_Backup.cmd
?? DaftarNosousChromeExtension/
?? Developer_Vault/
?? GHOST_SERVER_DIFF_ANALYSIS.md
?? GHOST_SERVER_STABILITY_REPORT.md
?? LAUNCH_READINESS.md
?? LOAD_EXTENSION.txt
?? LOAD_EXTENSION_FROM_EMAILCORE.txt
?? NHP_Check_Server_Ports.ps1
?? NHP_Ensure_Node_In_Path.cmd
?? NHP_PORTABLE_SETUP.md
?? NHP_Restart_All_Servers.bat
?? NHP_Restart_All_Servers_Hidden.vbs
?? NHP_Restart_All_Servers_SilentCore.bat
?? "NHP_Start_All_Servers (13).bat"
?? NHP_Start_All_Servers.bat
?? NHP_Start_All_Servers.bat.bak-wait-20260606-1019
?? NHP_Start_All_Servers.bat.template
?? NHP_Start_All_Servers.bat.template.backup_20260522_104525
?? NHP_Start_All_Servers.sh
?? NHP_Start_All_Servers_Hidden.vbs
```

---

## 2) فحص `.git` في المسارات المطلوبة

| المسار | `.git` | الفرع | remote | آخر commit | dirty (porcelain) |
|--------|--------|-------|--------|------------|-------------------|
| `E:\NHP_V30.1_Production_Build` | نعم | `main` | *(لا remote)* | `b69b5765…` EP-302B Complete | **298** |
| `.tmp\emailcore-ref` | نعم | `main` | `origin` → `https://github.com/maggouri/emailcore.git` | `c20e8008…` fix(chat-agent): harden session tools… | **10** |
| `.tmp\CLIProxyAPI-official` | **لا** | — | — | — | — |
| `DaftarNosousChromeExtension` | **لا** | — | — | — | — |
| `legacy-restored` | **لا** | — | — | — | — |
| `CLIProxyAPI_render_fix` | نعم | `main` | `origin` → `https://github.com/maggouri/CLIProxyAPI.git` | `94322b18…` fix(codex): strip image response_format… | **2** |

---

## 3) مسح `.tmp` (عمق 3) بحثاً عن `.git`

- النتيجة الوحيدة ضمن العمق 3:  
  `E:\NHP_V30.1_Production_Build\.tmp\emailcore-ref\.git`

---

## 4) تصنيف مجلدات/ملفات المستوى الأعلى (حقائق)

| التصنيف | أمثلة مسارات |
|---------|----------------|
| **تحكم Git / IDE** | `.git`, `.cursor`, `.agents` |
| **مؤقت / مراجع** | `.tmp`, `temp_uploads*`, `cache` *(ضمن Runtime منفصل)* |
| **امتداد Chrome / addon** | `addon`, `background`, `DaftarNosousChromeExtension`, `native-host` |
| **خوادم / منطق** | `server`, `logic`, `modules`, `js`, `utils`, `tools` |
| **CLIProxy / proxy** | `CLIProxyAPI-main`, `CLIProxyAPI_render_fix`, `.tmp\CLIProxyAPI-official` |
| **توثيق / حوكمة** | `docs`, `Developer_Vault` |
| **تشغيل / سكربتات NHP** | `NHP_Start_All_Servers.bat`, `NHP_Restart_*.bat`, `scripts`, `STAR ALL SERVERS` |
| **بيانات تشغيل محلية** | `server_profiles*`, `server_logs`, `metadata_store`, `profile_backups*`, `generated_designs`, `backups` |
| **واجهة** | `ui`, `assets` |
| **استعادة / نسخ** | `legacy-restored`, `chrome_extension_fix_backup_*`, `shortcut_backups_*` |
| **تبعيات** | `node_modules` |
| **أخرى (مشاريع فرعية / أدوات)** | `Peel Banana`, `SEO Analyse Artisan`, `screeeeenvme`, `.review-al-mahir-platform` |

---

## 5) EP-302C — `.tmp/emailcore-ref/public/admin/` (حقائق ملفات)

**الجذر:** `E:\NHP_V30.1_Production_Build\.tmp\emailcore-ref\public\admin\`

### HTML (3)

- `index.html` (8723 bytes, 2026-07-07 17:50:19)
- `login.html` (3395 bytes, 2026-06-27)
- `register.html` (3843 bytes, 2026-06-27)

### CSS (12) — مجلد `css/`

`admin-mobile.css`, `admin.css`, `chat-agent-mobile-fix.css`, `chat-agent.css`, `dashboard-mobile.css`, `domain-registry.css`, `generate-clone.css`, `login.css`, `mail-monitor.css`, `session-inbox-delete.css`

### JS (47) — مجلد `js/`

`accounts.js`, `admin.js`, `ai-design-generator-route.js`, `ai-design-generator.js`, `ai-design-storage-guard-v2.js`, `ai-design-storage-guard.js`, `auto-refresh-draft-guard.js`, `automation-progress.js`, `automation-schedule.js`, `automation-workflow.js`, `chat-agent.js`, `console-panel.js`, `creaty-panel.js`, `creaty-schedule-panel.js`, `dashboard-classification-tools.js`, `dashboard.js`, `design-store.js`, `designs.js`, `domain-registry-helpers.js`, `domain-registry.js`, `download-zip.js`, `emailcore-extension-bridge.js`, `firebase-auth-client.js`, `github-backup-tools.js`, `i18n.js`, `inbox.js`, `local-store.js`, `login.js`, `mail-toast.js`, `mail.js`, `member-inbox.js`, `member-messages.js`, `mobile-sidebar-fix.js`, `outlook-extension.js`, `path-helpers.js`, `register.js`, `scheduler.js`, `send-mail.js`, `session-cache.js`, `session-edit-tools.js`, `session-inbox-delete.js`, `session-status.js`, `sessions.js`, `settings.js`, `storage-stats.js`, `unified-messages-nav.js`, `users-admin.js`

**المجموع:** 62 ملفاً (3 HTML + 12 CSS + 47 JS) + مجلدات `css/` و `js/`.

---

## 6) ملخص أرقام MP-01

| المقياس | العدد |
|---------|-------|
| مستودعات Git مؤكدة | **3** (الجذر + emailcore-ref + CLIProxyAPI_render_fix) |
| مسارات بدون `.git` من القائمة | **3** |
| `.git` إضافي تحت `.tmp` (عمق ≤3) | **0** (بعد emailcore-ref) |
| أسطر porcelain — الجذر | **298** |
| untracked — الجذر | **295** (`??`) / **9667** (`ls-files --others`) |
| ملفات admin (EP-302C) | **62** |
