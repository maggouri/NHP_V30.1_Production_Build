# EP-302C — Scope Review Report

**Date:** 2026-07-07  
**Baseline:** `b69b5765` (EP-302B Complete)  
**Reviewer:** Investigation agent (EP-302C_REQUIRES_REVIEW)  
**Status:** **Option A APPROVED (AR-09)** — web admin implementation in progress; EP-302C OPEN until PE-05 on web admin

---

## الملخص التنفيذي (Executive Summary)

| البند | النتيجة |
|---|---|
| **هل وُجدت واجهة EP-302C؟** | نعم — مكتملة وظيفياً داخل **Creaty Column 2** (إضافة Chrome + سيرفر محلي `:3020`) |
| **هل ظهرت على EmailCore Web Admin (`emailcore.app` / `nocochat.com`)؟** | **لا** — لا أثر في `web-control.*`، `emailcore-handlers.js`، أو أي مسار admin مستضاف |
| **هل «إصلاح الوصول» حل PE-05؟** | **جزئياً فقط** — أضاف شريط Admin داخل Creaty؛ لم يربط المنصة المستضافة |
| **القرار النهائي** | **`EP302C_SCOPE_LEAK_CONFIRMED`** |

### للمهندس المعماري (Chief Architect)

EP-302C نُفّذ كـ **عميل رفيع** على API 302B داخل **`modules/creaty/*`** (واجهة Creaty المحلية داخل تبويب **CREATY** في إضافة Chrome). التحقق اليدوي PE-05 على **لوحة EmailCore المستضافة** (`emailcore.app`) لم يجد «إدارة النطاقات» — وهذا متوقع لأن الكود **لم يُضف أبداً** لتلك المنصة.

التخطيط (`EP302_PACK_BREAKDOWN.md`) سمح صراحةً بـ `modules/creaty/` **و/أو** `modules/admin/admin.js`، لكن رحلة PE-05 وMVP تشير إلى أن المشغّل يتوقع Admin sidebar موحّد (Email Library / Mail Monitor / Send Mail / **Domain Management**) على **سطح EmailCore web** — وليس فقط داخل Creaty المخفي في الإضافة.

**لا تُغلق EP-302C** و**لا تبدأ EP-302D** حتى يُحسم: هل Admin UI يجب أن يعيش على `emailcore.app`، أم Creaty-only مقبول رسمياً؟

---

## 1) File Inventory (git vs baseline `b69b5765`)

### Git diff (tracked changes only)

```text
git diff b69b5765 --name-only
→ modules/creaty/creaty.css
→ modules/creaty/creaty.html
→ modules/creaty/creaty.js
(+198 / −2 lines across 3 files)
```

**No commits** after `b69b5765` for EP-302C. Implementation exists as **working tree + untracked files** (not committed per PE-03).

### Full EP-302C file inventory

| Path | Bucket | EP-302C role | Git state |
|---|---|---|---|
| `modules/creaty/creaty.html` | **C — Creaty local UI** | Admin sidebar nav, col2 tab, panel shell `#creaty-col2-panel-domain-registry` | Modified (tracked) |
| `modules/creaty/creaty.css` | **C** | `.creaty-admin-sidebar*`, `.creaty-dreg-*` styles | Modified (tracked) |
| `modules/creaty/creaty.js` | **C** | Tab routing, `syncAdminSidebarNav`, deep link `?col2=domain-registry`, i18n | Modified (tracked) |
| `modules/creaty/domain-registry-ui.js` | **C** | Admin controller; API client → `127.0.0.1:3020` | Untracked (new) |
| `modules/creaty/domain-registry-helpers.js` | **C** | Validation, error mapping (ESM), PE-04 Arabic | Untracked (new) |
| `modules/creaty/emailcore-library.js` | **C** | `syncDomainRegistryAccess()` after credential save | Untracked (hook only) |
| `logic/domain-registry-client.js` | **D — Shared logic (test mirror)** | CJS mirror for `node --test` | Untracked (new) |
| `scripts/tests/ep302c-domain-admin-ui.test.js` | **D** | Static/DOM contract tests (14 cases) | Untracked (new) |
| `docs/planning/EP302C_UI_REVIEW.md` | Planning evidence | UX decisions | Untracked |
| `docs/planning/EP302C_ACCESS_FIX.md` | Planning evidence | Access gap + Creaty sidebar fix | Untracked |
| `docs/planning/EP302C_REGRESSION.md` | Planning evidence | 77/77 automated PASS claim | Untracked |

### Files explicitly **NOT** touched by EP-302C

| Path | Bucket | Note |
|---|---|---|
| `web-control.html` / `web-control.js` | **A — EmailCore Web Platform** | NHP Web Control — no domain registry |
| `emailcore-handlers.js` | **A** | EmailCore admin bridge — no 302C references |
| `popup.html` / `popup.js` / `background.js` | **B — Chrome Extension shell** | CREATY tab loader unchanged for 302C |
| `manifest.json` | **B** | No 302C-specific changes |
| `modules/admin/admin.js` / `admin.html` | **B/A boundary** | Popup Admin Center — no domain UI |
| `server/mailbox-lifecycle-api.js` | **D (302B)** | API layer — 302B, not 302C |
| `logic/domain-registry-model.js` | **D (302B)** | Persistence model — 302B |
| `creaty-server.js` | **C server** | No 302C UI changes (API from 302B) |
| `DaftarNosousChromeExtension/` | **B (alternate copy)** | No 302C files found |

---

## 2) Architecture Diagram (text)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR SURFACES (where Admin looks)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [A] EmailCore Web (hosted)          [B] Chrome Extension (Production_Build)│
│      emailcore.app / nocochat.com         popup.html → tab CREATY           │
│      ┌──────────────────────┐             ┌──────────────────────────────┐  │
│      │ Hosted admin shell   │             │ iframe: modules/creaty/      │  │
│      │ Email Library        │             │   creaty.html                │  │
│      │ Mail Monitor         │             │   ├─ creaty-admin-sidebar ◄──┼──┼── EP-302C UI HERE
│      │ Send Mail            │             │   │     «إدارة النطاقات»     │  │
│      │ Domain Management ❌ │             │   └─ domain-registry-ui.js   │  │
│      └──────────┬───────────┘             └──────────────┬───────────────┘  │
│                 │ /api/creaty/*                           │ fetch           │
│                 ▼                                         ▼                 │
│      ┌──────────────────────┐             ┌──────────────────────────────┐  │
│      │ EmailCore Render     │             │ Creaty Server :3020            │  │
│      │ (hosted backend)     │             │ creaty-server.js               │  │
│      └──────────────────────┘             │ /api/mailbox-lifecycle/        │  │
│                                           │   domain-registry*  ◄──────────┼── 302B API
│  [A-alt] web-control.html                 └──────────────────────────────┘  │
│      NHP Web Control — Trend/Studio/etc.                                      │
│      Domain Management ❌                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Data flow for EP-302C:
  Extension Creaty panel → HTTP 127.0.0.1:3020 → domain-registry REST (302B)
  Email Library (same panel) → HTTPS emailcore.app/api/creaty/* (hosted)

PE-05 operator path (failed):
  emailcore.app admin → no Domain Management route

EP-302C actual path (works if extension + Creaty server + Admin role):
  Extension → CREATY tab → Admin sidebar → «إدارة النطاقات»
```

---

## 3) Answers to Chief Architect Questions

### Q1: Was UI implemented in the wrong place?

**Answer: YES — relative to PE-05 / EmailCore web admin expectation.**

- الواجهة موجودة في **Creaty Column 2 داخل الإضافة** (`modules/creaty/*`)، وليس في **EmailCore web platform** المستضاف.
- التخطيط (`EP302_PACK_BREAKDOWN.md` §302C) ذكر `modules/admin/admin.js` **and/or** `modules/creaty/` — أي Creaty **مسموح نصياً**، لكن PE-05 وMVP item 6 («low-spec admin list») ضمن سياق EmailCore Admin journey تشير إلى سطح web موحّد.
- «إصلاح الوصول» (EP302C_ACCESS_FIX) أضاف `#creaty-admin-sidebar` **داخل Creaty فقط** — لم ينقل UI إلى `emailcore.app`.

### Q2: Was it in platform but not wired?

**Answer: NO — never added to EmailCore web platform.**

| Surface | Domain Management present? |
|---|---|
| `emailcore.app` hosted admin | ❌ Not in repo deploy path |
| `web-control.html/js` | ❌ No routes, no nav, no imports |
| `emailcore-handlers.js` | ❌ No domain-registry handlers |
| `modules/admin/admin.js` (popup Admin tab) | ❌ No domain UI |
| `modules/creaty/creaty.html` (Creaty) | ✅ Full panel + sidebar (Admin-gated) |

الواجهة **مبنية وموصولة داخل Creaty** (tab + sidebar + API client)، لكن **غير موجودة أصلاً** على منصة EmailCore web التي فحصها CA.

### Q3: Was extension-only modified?

**Answer: YES — runtime surface is extension-embedded Creaty module; extension shell unchanged.**

- **Workspace = installed extension:** `LOAD_EXTENSION.txt` يؤكد أن `Production_Build` هو مجلد «Load unpacked» الرئيسي (`Niche Hunter Pro`).
- **302C touched:** `modules/creaty/*` (يُحمَّل داخل `#panel-creaty` في `popup.html`).
- **302C did NOT touch:** `manifest.json`, `popup.html`, `popup.js`, `background.js`, `content_script.js`.
- **Risk:** أي Reload للإضافة يطبّق تغييرات Creaty على التثبيت المحلي — **حساس** لكن محصور في submodule Creaty وليس core extension messaging.
- **`scripts/sync-to-emailcore.js`:** قائمة النسخ **لا تتضمن** `domain-registry-*.js` — نسخة `NHP EMAILCORE` البديلة **لن تحصل** على 302C تلقائياً.

---

## 4) Gap vs Charter / Planning

| Source | Where admin UI should live | EP-302C actual | Gap |
|---|---|---|---|
| `EP302_PACK_BREAKDOWN.md` §302C | `modules/admin/admin.js` **and/or** `modules/creaty/` | Creaty only | Partial — admin.js ignored |
| `EP302_CHARTER.md` | Arabic admin UI (low-spec); Creaty server `:3020` | Creaty client on `:3020` | API alignment OK; **hosting surface ambiguous** |
| `EP302_USER_JOURNEY.md` Step 1 | Login → Domain Registry | Requires Creaty credentials + Admin role + local server | Journey assumes Creaty auth path, not hosted web login |
| PE-05 operator expectation | EmailCore web admin sidebar | Creaty extension sidebar | **Primary gap — navigation surface mismatch** |
| `EP302C_ACCESS_FIX.md` | Acknowledges hosted admin unchanged | Defers bridge to future pack | Confirms scope leak vs web admin |

### Planning ambiguity (root cause)

التخطيط لم يحدّد صراحةً:

1. **Creaty-only** vs **emailcore.app native admin route**
2. **Extension popup Admin tab** (`modules/admin`) vs **Creaty col2**

302C اختار Creaty col2 (مسموح في «and/or») بينما PE-05 تحقق من **EmailCore web** — سطح غير مغطى.

---

## 5) EmailCore Web Admin Structure (findings)

| Component | Role | Domain registry? |
|---|---|---|
| `web-control.html` + `web-control.js` | NHP Web Control — Trend, TM Search, Note, Studio placeholders | ❌ |
| `modules/creaty/emailcore-library.js` | Email Library client → `https://emailcore.app/api/creaty/*` | ❌ (mail only) |
| `modules/creaty/creaty.html` `#creaty-admin-sidebar` | **Local** Admin nav inside Creaty (Email Library, إعداد البريد, إدارة النطاقات, قائمة الحسابات) | ✅ (302C) |
| Hosted reference (not in tracked tree) | `.tmp/emailcore-ref/public/admin/` per ACCESS_FIX note | ❌ unchanged |
| `creaty-server.js` `:3020` | Serves Creaty static + mailbox-lifecycle API | API ✅ (302B), UI served via extension load |

**Conclusion:** لا يوجد «admin shell» على نمط `emailcore.app/admin` داخل هذا المستودع لـ Domain Management. Admin shell الوحيد لـ 302C هو **`creaty-admin-sidebar`** داخل Creaty — يتطلب الإضافة + السيرفر المحلي.

---

## 6) Extension Modification Risk Assessment

| Risk | Severity | Detail |
|---|---|---|
| **Scope leak to extension** | **High** | UI lives in extension-loaded Creaty — not web platform PE-05 tested |
| **Installed extension contamination** | **Medium** | Root folder IS unpacked extension; Creaty changes apply on Reload |
| **Dual-copy drift** | **Medium** | `sync-to-emailcore.js` omits domain-registry files — EMAILCORE copy out of sync |
| **popup/background stability** | **Low** | 302C did not modify extension core scripts |
| **API coupling** | **Low** | Thin client; PE-11/PE-12 compliant — uses public REST only |
| **False closure risk** | **High** | EP302C_REGRESSION claims READY_FOR_PE05 but PE-05 web admin path still fails |

---

## 7) Recommendation Path Forward

### Option A — **EmailCore Web Admin (recommended if PE-05 is gate)**

1. Add Domain Management route to hosted admin shell (Render deploy) **or** minimal bridge page on `emailcore.app`.
2. Reuse `domain-registry-helpers.js` logic; proxy API calls to Creaty `:3020` or mount registry routes on EmailCore server (architectural decision).
3. Wire nav: Email Library | Mail Monitor | Send Mail | **إدارة النطاقات**.
4. Re-run PE-05 on **web admin** path.

### Option B — **Creaty-only (formal scope acceptance)**

1. CA explicitly amends charter: «Admin Domain UI = Creaty extension surface only».
2. Update PE-05 checklist to validate **Extension → CREATY → Admin sidebar** — not `emailcore.app`.
3. Document operator runbook; close 302C with commit after PE-05 PASS on Creaty path.

### Option C — **Dual surface**

1. Keep Creaty UI (done).
2. Add thin hosted admin embed/iframe or shared component — higher maintenance.

### Do NOT (per instructions)

- ❌ Start EP-302D
- ❌ Commit «EP-302C Complete»
- ❌ Implement fixes in this investigation task

### Revert extension changes?

**Not recommended without CA decision.** Creaty UI is functionally complete and regression-green; reverting loses working admin client. Prefer **add web surface** or **accept Creaty-only** over revert.

---

## 8) Automated Test Evidence (informational)

`EP302C_REGRESSION.md` reports **77/77 PASS** including `ep302c-domain-admin-ui.test.js` (14 tests). Tests validate **static wiring in Creaty files** — they do **not** assert presence on `emailcore.app` or `web-control.html`.

---

## Final Decision

```text
EP302C_SCOPE_LEAK_CONFIRMED → RESOLVED BY AR-09 OPTION A
```

**Rationale:** EP-302C UI existed only in Chrome Extension / Creaty local UI (`modules/creaty/*`). EmailCore web admin (`emailcore.app` / `nocochat.com`) had no Domain Management. PE-05 validation on web admin correctly failed.

### Chief Architect Resolution (2026-07-07)

| Decision | Value |
|---|---|
| **Approved option** | **Option A** — EmailCore Web Admin primary |
| **Architecture record** | `AR-09` — Single Source of Administration |
| **Creaty/Extension role** | Quick Access only — no duplicate full admin UI |
| **API contract** | Unchanged — EP-302B public REST on Creaty `:3020` |
| **EP-302C status** | **OPEN** until PE-05 passes on web admin |
| **EP-302D** | **DO NOT START** |

**Implementation:** Domain Management added to `.tmp/emailcore-ref/public/admin/` (`#domain-registry` route). Creaty panel converted to Quick Access with «فتح في لوحة الإدارة» link to `emailcore.app/admin#domain-registry`.

---

## Recovery / Next Actions for CA

1. **Choose surface:** Web admin (A) vs Creaty-only acceptance (B) vs dual (C).
2. If (A): authorize minimal web admin wiring pack before 302C closure.
3. If (B): amend PE-05 checklist + charter; retest Extension → CREATY path.
4. Hold EP-302D until 302C surface decision + PE-05 PASS.
5. No git commit until CA approves path and PE-05 passes on chosen surface.

---

*Generated: 2026-07-07 — investigation only, no code changes, no commit.*
