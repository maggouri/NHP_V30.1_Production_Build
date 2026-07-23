# EP-301 User Journey

Journey target:
`Login -> Choose Domain -> Create Mailbox -> Validation -> Mailbox Created -> Connection Settings -> Ready`

## Step 1: Login
- **Goal**: Authenticate operator and load authorized capabilities.
- **Backend action**: Resolve current session/user identity via existing auth flow; attach role context.
- **Validation**:
  - Login input present (nickname/password rules as current flow).
  - Session token/user identity resolves successfully.
  - Role recognized (`User`/`Admin`).
- **Error handling**:
  - Missing credentials -> inline prompt.
  - Wrong credentials/password required -> guided retry.
  - auth service unavailable -> retry action + status banner.
- **Success state**:
  - Authenticated context established.
  - Mailbox workflow entry unlocked for allowed role.

## Step 2: Choose Domain
- **Goal**: Select mailbox domain policy before mailbox provisioning.
- **Backend action**:
  - Load allowed domain list (initially from configured policy/defaults).
  - Persist selected domain in workflow context.
- **Validation**:
  - Selected domain is in allowed list.
  - Domain not blocked/deprecated.
- **Error handling**:
  - Empty selection -> block next step with required-field message.
  - Domain not allowed -> policy error with alternate suggestions.
- **Success state**:
  - Domain locked in request context and shown in summary.

## Step 3: Create Mailbox
- **Goal**: Request mailbox creation using selected domain.
- **Backend action**:
  - For generated mailbox: call creation endpoint (mapped to existing generate flow).
  - For custom mailbox: call manual create endpoint.
  - Bind mailbox row/session id to workflow.
- **Validation**:
  - Required fields present (count or custom local-part).
  - Domain match between user choice and mailbox request.
  - Response includes mailbox identity (email, session id).
- **Error handling**:
  - Invalid input format -> reject with field-level feedback.
  - API auth/config error (`token/userId/base`) -> actionable credential fix message.
  - conflict/duplicate -> prompt user with retry or alternate local-part.
- **Success state**:
  - Mailbox record created and visible in session list.

## Step 4: Validation
- **Goal**: Prove mailbox is operational and workflow-safe.
- **Backend action**:
  - Refresh mailbox library/session state.
  - Optional send/receive check (or activation-message detect) based on current endpoint support.
  - Normalize validation result object.
- **Validation**:
  - Mailbox exists in authoritative session source.
  - Session id mapping is stable.
  - Mailbox status not terminal-failed.
- **Error handling**:
  - Not found after create -> bounded retries then fail as recoverable.
  - temporary server/network failure -> queued retry path.
  - queue/activation wait -> present waiting state instead of hard fail.
- **Success state**:
  - Validation object returns `ok=true` with mailbox/session reference.

## Step 5: Mailbox Created
- **Goal**: Confirm provisioning outcome with clear metadata.
- **Backend action**:
  - Persist final mailbox creation event to workflow log.
  - Expose mailbox summary for downstream usage.
- **Validation**:
  - Email address + session id + created timestamp present.
  - Domain in summary equals selected domain.
- **Error handling**:
  - Missing metadata -> mark incomplete and route back to validation.
- **Success state**:
  - User sees immutable creation summary card.

## Step 6: Connection Settings
- **Goal**: Provide ready-to-use connection/auth settings for operational use.
- **Backend action**:
  - Resolve connection tuple from existing saved settings:
    - API URL
    - User ID
    - Access Token
    - Session reference
- **Validation**:
  - Required settings non-empty and format-valid.
  - Connection check to endpoint succeeds.
- **Error handling**:
  - Missing values -> configuration wizard prompt.
  - unauthorized -> token refresh/sync guidance.
  - endpoint mismatch -> base URL correction guidance.
- **Success state**:
  - "Connection verified" status produced for this mailbox.

## Step 7: Ready
- **Goal**: Mark workflow complete and usable by automation/schedule features.
- **Backend action**:
  - Set workflow state to `READY`.
  - Publish completion event to UI and local log.
- **Validation**:
  - Prior steps all completed with no blocking errors.
  - Mailbox validation and connection checks are green.
- **Error handling**:
  - Any unresolved blocker returns to last failed step with context.
- **Success state**:
  - Mailbox is ready for immediate operational use (signup/activation/schedule flows).

## Cross-step error model (EP-301 standard)
- Error payload contract per step:
  - `code` (stable machine code)
  - `message` (user text)
  - `recoverable` (boolean)
  - `retryable` (boolean)
  - `nextAction` (suggested user/system action)
- Severity classes:
  - `INFO` (non-blocking)
  - `WARN` (degraded, continue possible)
  - `BLOCKER` (cannot proceed)
