# EP301C UI Review

## Scope
Frontend mailbox lifecycle journey in Creaty Column 2 — tab **«إعداد البريد»** wired to EP-301B APIs on Creaty server (`3020`).

## Screen Flow

```
Login → Choose Domain → Create Mailbox → Validation → Mailbox Created → Connection Settings → Ready
```

| Step | UI surface | Primary action |
|---|---|---|
| 1 Login | `creaty-mbl-panel-login` | Verify stored EmailCore credentials; link to Email Library config |
| 2 Choose Domain | `creaty-mbl-panel-domain` | Load allowed domains; start workflow (`POST /workflows`) |
| 3 Create Mailbox | `creaty-mbl-panel-create` | Generate (1–10) or manual email on selected domain |
| 4 Validation | `creaty-mbl-panel-validation` | Confirm mailbox in library (`POST /validate`); auto-runs after create |
| 5 Mailbox Created | `creaty-mbl-panel-created` | Summary card (address, domain, session id, status) |
| 6 Connection Settings | `creaty-mbl-panel-connection` | Resolve + verify credentials (`GET/POST connection`) |
| 7 Ready | `creaty-mbl-panel-ready` | Final banner + next steps (library, signup, new setup) |

## UX Decisions

### Tab placement (Column 2)
- **Decision**: Dedicated tab «إعداد البريد» before Email Library.
- **Rationale**: Separates guided onboarding from power-user library management; keeps registration column untouched (frozen scope).

### Stepper (7 pills)
- **Decision**: Horizontal stepper with Arabic labels; compact on narrow screens (numbers only).
- **Rationale**: Matches EP-301 journey contract; progress visible without exposing internal service names (PE-04).

### Login = credential readiness
- **Decision**: Step 1 checks existing EmailCore User ID + token (DOM or `chrome.storage.local`); no duplicate login form.
- **Rationale**: Reuses established auth path; avoids parallel credential UX.

### Error envelope mapping
- **Decision**: API `code/message/recoverable/retryable/nextAction` mapped to Arabic product text + actionable hint.
- **Rationale**: EP-301 standard envelope consumed consistently; users see guidance, not raw HTTP/errors.

### Post-create auto-validation
- **Decision**: After generate/manual create, validation runs automatically; manual retry button on failure.
- **Rationale**: Reduces clicks; supports retryable `MAILBOX_NOT_FOUND` queue lag.

### Session resume
- **Decision**: Workflow id persisted in `creaty_mailbox_lifecycle_workflow_id`; restored on tab open.
- **Rationale**: Low-spec friendly; user can leave and return without losing progress.

### Loading & accessibility
- Loading banner (`aria-live="polite"`), errors (`role="alert"`), stepper `aria-current="step"`, labeled form fields, RTL-safe Arabic strings (UTF-8).

## State Descriptions

### Login — incomplete credentials
- Yellow pill «غير مكتمل», hint to open Email Library, button «فتح إعدادات البريد».

### Login — ready
- Green pill «متصل», button «متابعة — اختيار النطاق».

### Domain selection
- Dropdown of allowed domains from API; confirm starts workflow.

### Create — dual path
- Card A: numeric generate (client-validated 1–10).
- Card B: custom email with domain suffix validation before submit.

### Validation — pending
- Warning status if mailbox not yet in library; retry button when `retryable`.

### Connection — unverified / verified
- Settings summary (API URL, User ID, mailbox); verify then «إتمام الإعداد».

### Ready
- Green success banner, bullet next steps, shortcuts to library or new setup.

## Files Touched
- `modules/creaty/creaty.html` — tab + wizard shell
- `modules/creaty/creaty.css` — `.creaty-mbl-*` styles
- `modules/creaty/creaty.js` — tab wiring + init
- `modules/creaty/mailbox-lifecycle-ui.js` — journey controller + API client
- `modules/creaty/mailbox-lifecycle-helpers.js` — validation/error mapping (ESM)
- `logic/mailbox-lifecycle-client.js` — test mirror (CJS)

## PE-04 Compliance
User-facing copy references «البريد», «Creaty Server», «Email Library» — no Oracle/internal orchestrator names in UI strings.

## Decision
**READY_FOR_EP301D** — UI journey complete against 301B APIs; role gating deferred to 301D as planned.
