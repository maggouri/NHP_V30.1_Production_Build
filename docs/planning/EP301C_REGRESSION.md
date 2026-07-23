# EP301C Regression Report

## Test Evidence

### Automated — EP-301A (model)
```
node --test scripts/tests/ep301a-model-validation.test.js
```
| Test | Result |
|---|---|
| normalizes legacy session rows into mailbox lifecycle schema | PASS |
| accepts backward-compatible row missing explicit domainId | PASS |
| rejects relation mismatch between mailbox email and domain name | PASS |

### Automated — EP-301B (API)
```
node --test scripts/tests/ep301b-mailbox-lifecycle-api.test.js
```
| Test | Result |
|---|---|
| validateDomainChoice rejects unknown domain | PASS |
| resolveRole maps admin and supervisor credentials | PASS |
| mailbox lifecycle API auth and workflow create/read | PASS |
| supervisor recovery endpoint requires supervisor role | PASS |
| readAllowedDomains falls back to default list | PASS |

### Automated — EP-301C (UI helpers)
```
node --test scripts/tests/ep301c-mailbox-lifecycle-ui.test.js
```
| Test | Result |
|---|---|
| mapLifecycleError maps API codes to Arabic user text | PASS |
| mapLifecycleError falls back for unknown codes | PASS |
| validateManualMailboxInput enforces domain suffix | PASS |
| validateGenerateCount bounds count between 1 and 10 | PASS |
| resolveVisibleStep requires login before workflow steps | PASS |
| JOURNEY_STEPS defines seven ordered steps | PASS |

### Combined run — independent validation (2026-07-07)
```
node --test scripts/tests/ep301a-model-validation.test.js scripts/tests/ep301b-mailbox-lifecycle-api.test.js scripts/tests/ep301c-mailbox-lifecycle-ui.test.js
```
```
✔ normalizes legacy session rows into mailbox lifecycle schema (422.4666ms)
✔ accepts backward-compatible row missing explicit domainId (1.2936ms)
✔ rejects relation mismatch between mailbox email and domain name (1.4755ms)
✔ validateDomainChoice rejects unknown domain (9.2575ms)
✔ resolveRole maps admin and supervisor credentials (1.3067ms)
✔ mailbox lifecycle API auth and workflow create/read (1040.1323ms)
✔ supervisor recovery endpoint requires supervisor role (303.835ms)
✔ readAllowedDomains falls back to default list (5.6217ms)
✔ mapLifecycleError maps API codes to Arabic user text (61.9458ms)
✔ mapLifecycleError falls back for unknown codes (0.7064ms)
✔ validateManualMailboxInput enforces domain suffix (0.8969ms)
✔ validateGenerateCount bounds count between 1 and 10 (0.9057ms)
✔ resolveVisibleStep requires login before workflow steps (0.5873ms)
✔ JOURNEY_STEPS defines seven ordered steps (0.527ms)
ℹ tests 14
ℹ pass 14
ℹ fail 0
ℹ duration_ms 5929.4056
```
**14/14 PASS** — exit code 0

## Gate Certification

### GC-01 UX Consistency — PASS
التبويب «إعداد البريد» يتبع نمط col2 الموجود (schedule/dashboard/store) مع stepper من 7 خطوات عربية، ورسائل خطأ/تحميل/نجاح موثقة في `EP301C_UI_REVIEW.md`. نصوص المستخدم خالية من أسماء Oracle/orchestrator داخل مسار mailbox (PE-04).

### GC-02 Functional Validation — PASS
`mailbox-lifecycle-ui.js` يستدعي جميع نقاط `/api/mailbox-lifecycle/*` (domains، workflows، generate، manual، validate، connection، verify، ready) و`JOURNEY_STEPS` يطابق عقد EP301_USER_JOURNEY. **E2E حي (2026-07-07):** ping + auth + domains + workflow create نجحت على `localhost:3020`. **تحقق بشري Chief Architect (2026-07-07):** Email Library يفتح، تعديل سجل البريد يعمل، Inbox يفتح، لا أخطاء UI/routing — **PASS**.

### GC-03 Regression Review — PASS
EP-301A/301B tests unchanged and **14/14 PASS** في التشغيل المستقل. لا تغييرات على `logic/mailbox-lifecycle-model.js` أو `server/mailbox-lifecycle-api.js`. إصلاح `switchCol2Tab` يسمح بـ `design-library` و`mailbox-setup` دون تعديل منطق store/dashboard/schedule.

### GC-04 Product Acceptance Readiness — PASS
المخرجات الثلاثة (UI متصل، UI review، regression report) مكتملة، وخطوات ما بعد الإنشاء (validation → connection → ready) مُنفَّذة في الواجهة والكود. **PE-05 PASS (2026-07-07):** Chief Architect sign-off بعد تجربة يدوية — Email Library + edit + Inbox + regression. تفويض الأدوار مؤجل لـ EP-301D.

## PE-05 Execution Evidence (2026-07-07 — Chief Architect PASS)

**بيئة التنفيذ**
- Creaty Server: `node creaty-server.js` → `http://127.0.0.1:3020`
- سكربت E2E: `node scripts/tests/ep301c-pe05-e2e-live.js`
- اعتماديات الاختبار: `userId=user_a`, `x-creaty-token=tok_test` (Creaty API؛ EmailCore حي يتطلب credentials من Email Library)

### نتائج الاختبارات الآلية (إعادة تشغيل)
```
node --test scripts/tests/ep301a-model-validation.test.js scripts/tests/ep301b-mailbox-lifecycle-api.test.js scripts/tests/ep301c-mailbox-lifecycle-ui.test.js
ℹ tests 14 | ℹ pass 14 | ℹ fail 0 | exit 0
```

### E2E API — خطوة بخطوة

| الخطوة | الطلب | HTTP | الحالة | حقول رئيسية |
|---|---|---|---|---|
| Health/Ping | `GET /ping` | 200 | **PASS** | `mailboxLifecycleApiVersion: 1`, `service: creaty`, `port: 3020` |
| MBL Ping | `GET /api/mailbox-lifecycle/ping` | 200 | **PASS** | `version: 1`, 7 steps |
| Login/Auth | `GET /api/mailbox-lifecycle/domains?userId=user_a` | 200 | **PASS** | `domains[0].name: emailcore.app` |
| Choose Domain | `POST /api/mailbox-lifecycle/workflows` `{domain: emailcore.app}` | 201 | **PASS** | `workflowId`, `step: CREATE_MAILBOX` |
| Create Mailbox | `POST .../mailbox/generate` `{count:1}` | 401 | **FAIL (agent env)** | `code: MAILBOX_CREATE_FAILED` — يتطلب EmailCore credentials حقيقية |
| Validation | `POST .../validate` | — | **BLOCKED (agent env)** | يتطلب mailbox مُنشأ |
| Connection | `GET/POST .../connection*` | — | **BLOCKED (agent env)** | يتطلب validation |
| Ready | `POST .../ready` | — | **BLOCKED (agent env)** | يتطلب connection verified |

### تحقق ثابت للواجهة

| الفحص | النتيجة |
|---|---|
| `creaty.html` تبويب «إعداد البريد» + panel `creaty-col2-panel-mailbox-setup` | **PASS** |
| `creaty.js` → `switchCol2Tab` يشمل `mailbox-setup` و`design-library` دون كسر schedule/store/dashboard | **PASS** |
| `mailbox-lifecycle-ui.js` يستدعي 10 نقاط API (ping، domains، workflows، generate، manual، validate، connection، verify، ready، read) | **PASS** |
| PE-04: لا Oracle/orchestrator/HTTP خام في `mailbox-lifecycle-helpers.js` أو نصوص UI | **PASS** |
| `mapLifecycleError` يترجم الأكواد إلى عربية | **PASS** (6/6 اختبارات 301C) |

### PE-05 Manual Test Checklist (Chief Architect — PASS 2026-07-07)

**المتطلبات المسبقة**
- [x] Creaty Server يعمل على المنفذ **3020**
- [x] بيانات EmailCore محفوظة في تبويب **Email Library**

**مسار الرحلة (تجربة بشرية)**
- [x] Email Library يفتح بشكل صحيح
- [x] تعديل سجل البريد (Edit email info) يعمل
- [x] Inbox يفتح بنجاح (فارغ — طبيعي)
- [x] لا أخطاء UI أو routing
- [x] Regression checks passed

**جودة الرسائل (PE-04)**
- [x] رسائل الخطأ بالعربية ومفهومة
- [x] لا تظهر أسماء داخلية Oracle/orchestrator

**توقيع Chief Architect**
```
PE-05 Manual UX: [x] PASS  [ ] FAIL
المُختبِر: Chief Architect
التاريخ: 2026-07-07
ملاحظات: راجع docs/planning/EP301C_PE05_EVIDENCE.md
```

## Recovery Chain Status

| Commit | Phase | Status |
|---|---|---|
| `f63a58f` | EP-301A Complete | ✅ committed |
| `ec19e98` | EP-301B Complete | ✅ committed |
| *(301C commit)* | EP-301C Complete | ✅ committed (PE-03) |

## Prior Journeys — Not Broken
| Journey | Status | Notes |
|---|---|---|
| Signup queue / runner | OK | No edits to col1 registration flow |
| Artisan schedule | OK | Schedule panel untouched |
| EmailCore library CRUD | OK | Store tab logic unchanged |
| Dashboard accounts | OK | Dashboard binding unchanged |
| Design library | OK | Tab routing fixed (was falling to dashboard) |
| AI supervisor panel | OK | Not modified |
| Ghost server heartbeat | OK | Not modified |

## Lint
`ReadLints` on edited Creaty/mailbox files — **no issues**.

## Closure Checklist (Chief Architect — EP-301C)

| الشرط | الحالة |
|---|---|
| 14/14 tests | ✅ PASS (2026-07-07) |
| GC-01..04 | ✅ PASS — Chief Architect sign-off 2026-07-07 |
| PE-05 manual test | ✅ PASS — Chief Architect 2026-07-07 |
| PE-03 commit | ✅ EP-301C Complete |

## Final Decision
**EP301C_CLOSED**

EP-301C مكتمل ومُغلَق. سلسلة الاسترداد: `f63a58f` (301A) → `ec19e98` (301B) → EP-301C commit. **READY_FOR_EP301D** — charter review only.
