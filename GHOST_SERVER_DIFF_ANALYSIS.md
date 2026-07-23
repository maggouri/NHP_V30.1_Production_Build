# Ghost Server — Full Diff Analysis (Phase 2)

**Date:** 2026-06-25  
**CURRENT:** `NHP_V30.1_Production_Build`  
**OLD stable backup:** `NHP_V30.1_Production_Build_BACKUP_2026-04-07`  
**Scope:** Ghost Server automation runtime only (server, orchestration, launchers)

---

## 1. Executive Summary

| Metric | OLD | CURRENT |
|--------|-----|---------|
| `ghost-server.js` size | 252 lines | 3,355 lines |
| `server/` modules | **None** | 8 Ghost-related modules |
| Ghost launcher scripts | **None** | 9 scripts (.cmd/.ps1/.vbs) |
| Orchestration (`background.js`) | ~1,290 lines, single-request upload | ~12,185 lines, chunking + queue state |
| Critical regression (browser teardown) | Stable `!keepAlive` close | **Fixed** in CURRENT (was inverted) |
| Secondary regression (`const page`) | N/A (no recovery) | **Fixed** (`let page`) |

**Verdict:** The only **critical** stability regression (inverted browser close) and the **`const page`** TypeError are already patched in CURRENT. Remaining differences are mostly **intentional feature expansion** (mutex, chunking, per-design retry, observation hooks). One **low-priority consistency gap** remains in `/apply-store-profile` teardown (no `releaseProfileLockForEmail`).

**Patches applied in this Phase 2 pass:** None (no new critical regressions found beyond Phase 1 fixes).

---

## 2. File Inventory

### 2.1 Ghost dependency graph (CURRENT)

```
ghost-server.js
├── server/profile-browser-lock.js      (per-email mutex, Chrome kill, lock files)
├── server/chrome-launch-shared.js      (launch fallback, stealth args, stable page)
├── server/browser-stealth-profile.js   (stealth helpers — indirect)
├── server/generate-api.js              (mounted routes on Ghost port)
├── server/library-smart-rename.js      (pre-mount for Generate API)
└── server/nhp-ai-supervisor.js       (upload supervision hooks)

background.js (extension orchestration)
├── startAPProcess() → fetch /upload (chunked)
├── ensureGhostServerReady() / wake_server
├── controlGhostServerProcess()
├── ap_retry_failed → buildApFailedRetryConfig
└── open_account_browser → /browse-account

modules/autopilot/autopilot.js (UI triggers only)
├── ap_start, ap_stop, ap_retry_failed
├── wake_server, queue monitor
└── open browser → /browse-account
```

### 2.2 Files only in OLD backup

| File | Lines | Role |
|------|-------|------|
| `ghost-server.js` | 252 | Monolithic: `/upload`, `/ping`, `/shutdown` |
| `background.js` | ~1,290 | Simple `startAPProcess` — one HTTP request per account |
| `modules/autopilot/autopilot.js` | ~1,100 | Basic start/stop/wake (no queue monitor, no retry) |
| `modules/autopilot/autopilot.html` | — | Simpler UI |
| `modules/autopilot/autopilot.css` | — | Styles |

> OLD has **no** `server/` directory, **no** Ghost launcher scripts, **no** profile mutex.

### 2.3 Files only in CURRENT

| File | Role | Stability relevance |
|------|------|---------------------|
| `server/profile-browser-lock.js` | Cross-process lock + Chrome kill | **High** — serializes per-email launches |
| `server/chrome-launch-shared.js` | `launchBrowserWithFallback`, `createStablePage` | **High** — launch + remote-debug fallback |
| `server/browser-stealth-profile.js` | Stealth profile helpers | Medium |
| `server/generate-api.js` | Generate API on Ghost port | Low (non-upload) |
| `server/library-smart-rename.js` | Smart rename pre-mount | Low |
| `server/nhp-ai-supervisor.js` | AI supervision during upload | Medium |
| `server/profile-clone.js` | Profile cloning | Low |
| `server/cliproxy-image-models.js` | Image models | Low |
| `Start_Ghost_Server_*.cmd/.ps1/.vbs` | Ghost process launchers | Medium — startup reliability |
| `Restart_Ghost_3019.cmd/.vbs` | Controlled restart | Medium |
| `Stop_Ghost_Server.cmd` | Graceful stop | Low |
| `NHP_Start_Ghost_On_Port.ps1` | Port-aware bootstrap | Medium |

### 2.4 Shared files (both builds)

| File | Status | Stability impact |
|------|--------|------------------|
| `ghost-server.js` | **Heavily modified** | **Critical** |
| `background.js` | **Heavily modified** | **High** |
| `modules/autopilot/autopilot.js` | **Modified** | Medium (triggers only) |
| `modules/autopilot/autopilot.html` | Modified | Low (UI) |
| `modules/autopilot/autopilot.css` | Modified | Low (UI) |
| `modules/merchghost/merchghost-dashboard-content.a1576c2c.js` | Same hash name | None for Ghost upload |

---

## 3. Category-by-Category Diff Analysis

### 3.1 Browser Lifecycle

| Aspect | OLD (stable) | CURRENT | Assessment |
|--------|--------------|---------|------------|
| Launch | Inline `puppeteer.launch` + `getChromePath()` | `launchBrowserWithFallback` + `buildGhostChromeLaunchArgs` + mutex | **Improvement** when teardown works |
| Headless | `isVisual ? false : 'new'` | `resolveGhostHeadless()` + env `NHP_HEADLESS` | Neutral |
| Page creation | `browser.pages()[0]` or `newPage()` | `createGhostPage` → `createStablePage` + webdriver patch | **Improvement** |
| Post-upload close | `finally: if (!keepAlive) { 6s; close() }` | `finally: if (!keepAlive) { 6s; if connected close; releaseProfileLock; 2.5s }` | **Fixed** (was inverted) |
| Auth failure | `keepAlive = true`, browser stays open | Same via `failAuth()` | **Parity** |
| Manual browse | N/A | `/browse-account` — browser **intentionally left open** | By design |
| Store profile | N/A | `/apply-store-profile` — 4s delay + `close()`, no lock release | **Minor gap** |
| Remote-debug reuse | N/A | `connectToExistingDebugBrowser` on deterministic port | **Watch** — stale session if prior close failed |
| Port binding | Fixed `3019` | `NHP_GHOST_PORT` env + EADDRINUSE retry | Neutral |
| Shutdown | `/shutdown` → `process.exit(0)` | Same + `/api/ghost/restart` spawns `Restart_Ghost_3019.cmd` | New feature |

**Remaining regression flag:** `/apply-store-profile` `finally` block closes browser but does **not** call `releaseProfileLockForEmail()`. Lower severity than `/upload` (infrequent path), but same zombie-Chrome risk if `close()` fails silently.

---

### 3.2 Queue Management

| Aspect | OLD | CURRENT | Assessment |
|--------|-----|---------|------------|
| Server-side queue | None — processes all designs in one `/upload` call | `activeUploadJobs` map + job IDs per design | New (in-process only) |
| Client-side queue | `startAPProcess` slices designs per account limit | Same + `publishApQueueState` + per-design/per-account state | New feature |
| Chunking | **None** — all designs in one request | Max 5 designs/chunk, 110 MB payload cap | **New** — requires browser close between chunks |
| Inter-chunk delay | N/A | **12 seconds** (`background.js` line ~10686) | Correct design **if** teardown works |
| Inter-account delay | `delaySec` countdown | Same preserved | **Parity** |
| Stop signal | `apStopped` flag | Same + queue state `stopped` | **Parity** |
| Daily/batch limits | Checked in background | Same + `dailyLimitReachedDate` persistence | Enhancement |

**Risk note:** Chunking multiplies browser open/close cycles. The Phase 1 `!keepAlive` fix is **essential** for chunked uploads to work without manual Ghost restart.

---

### 3.3 Upload Pipeline

| Step | OLD | CURRENT | Stability note |
|------|-----|---------|----------------|
| Temp file write | `up_${Date.now()}_${i}.png` | MIME-aware extension + buffer validation | **Improvement** |
| Pre-upload navigation | Implicit (already on quick_create) | `getOrRecoverTeePublicPage` + URL validation | **Improvement** |
| File input | `waitForSelector('input[type="file"]')` | `acquireTeePublicUploadInput` with retries | **Improvement** |
| Post-file wait | **6000 ms** fixed | `waitForTeePublicUploadCommit` + **2500 ms** | Compensated by smarter wait — not a clear regression |
| SEO DNA fill | Inline `page.evaluate` (Supreme DNA) | Same DNA logic preserved in evaluate | **Parity** |
| Publish | `waitForSelector` + click + `networkidle0` | `waitForFunction` + evaluate click + `Promise.race` confirmation + 8s settle | More robust, higher complexity |
| Per-design results | `{ success: true }` only | `{ success, results: [{ queueItemId, status, error }] }` | New — enables retry |
| Store setup | Random prefix + 7s stabilize | `maybeCompleteTeePublicStoreSetup` + **7s** stabilize preserved | **Parity** |
| Foundation entry | N/A | `foundationEntry` → Sell Your Art flow | New feature |

---

### 3.4 Retry Logic

| Layer | OLD | CURRENT | Assessment |
|-------|-----|---------|------------|
| Server per-design | None | `maxAttempts = 2` with `isRecoverableUploadNavigationError` | **New** — good |
| Page recovery | None | `getOrRecoverTeePublicPage` + re-goto quick_create | **New** — requires `let page` (**fixed**) |
| Client retry | None | `ap_retry_failed` + `retryPlan` in `startAPProcess` | **New** |
| Launch retry | None | `launchWithProfileLockRetry` (max 1) + Chrome kill | **New** |
| Upload input retry | None | `acquireTeePublicUploadInput` internal retries | **New** |
| Mutex timeout | N/A | 180s cross-process lock | Could fail under extreme load — acceptable |

---

### 3.5 Session / Profile Management

| Aspect | OLD | CURRENT | Assessment |
|--------|-----|---------|------------|
| Profile path | `PROFILES_DIR / safeEmail` | `getProfileDirForEmail()` — same logic | **Parity** |
| Profile lock | None | `withProfileBrowserMutex` + `profile_browser_locks/*.lock` | **New** — critical with chunking |
| Lock release after upload | N/A | `releaseProfileLockForEmail()` in `/upload` finally | **Fixed** |
| Lock release API | N/A | `POST /release-profile-lock` | New utility |
| Profile backup | N/A | `/profiles-backup/*` routes | New (non-upload) |
| Proxy / WiFi rotate | N/A | Proxy args + `rotateWifiIp()` via ADB | New |
| CORS | `app.use(cors())` | Restrictive origin allowlist + extension headers | Neutral for local upload |

---

## 4. Endpoint Comparison

| Endpoint | OLD | CURRENT |
|----------|-----|---------|
| `POST /upload` | ✅ | ✅ (expanded) |
| `GET /ping` | ✅ | ✅ (+ generate API version) |
| `POST /shutdown` | ✅ | ✅ |
| `POST /browse-account` | ❌ | ✅ |
| `POST /apply-store-profile` | ❌ | ✅ |
| `POST /release-profile-lock` | ❌ | ✅ |
| `POST /api/ghost/restart` | ❌ | ✅ |
| `GET /status` | ❌ | ✅ |
| `POST /rotate-ip` | ❌ | ✅ |
| Niche memory/archive routes | ❌ | ✅ |

---

## 5. Regression Flags (Remaining)

| # | Severity | Location | Issue | Status |
|---|----------|----------|-------|--------|
| 1 | ~~CRITICAL~~ | `ghost-server.js` `/upload` finally | Inverted `!browser.isConnected()` close | **FIXED** (Phase 1) |
| 2 | ~~HIGH~~ | `ghost-server.js` `/upload` | `const page` blocked recovery | **FIXED** (Phase 1) |
| 3 | **LOW** | `ghost-server.js` `/apply-store-profile` finally | No `releaseProfileLockForEmail` after close | **Open** — recommend patch |
| 4 | **LOW** | `chrome-launch-shared.js` | Reuses existing remote-debug browser on same port | **Watch** — edge case if prior session zombie |
| 5 | **INFO** | `background.js` | `ensureGhostServerReady()` not called at `ap_start` entry | Same as OLD UX — not a regression |

---

## 6. Recommended Patches (Not Applied)

### 6.1 `/apply-store-profile` teardown parity (optional, low risk)

Align with `/upload` finally block:

```javascript
} finally {
    if (browser && !keepAlive) {
        await new Promise((r) => setTimeout(r, 4000));
        if (browser.isConnected()) {
            await browser.close().catch(() => {});
        }
        await releaseProfileLockForEmail(account.email).catch(() => {});
        await new Promise((r) => setTimeout(r, 2500));
    }
}
```

**Why not auto-applied:** Infrequent path; not demonstrated as production blocker. Safe to apply in a follow-up.

### 6.2 `[UploadTeardown]` explicit log line (diagnostic only)

Add one log line when `/upload` browser close succeeds — aids log triage, zero behavior change.

### 6.3 Auto-wake at `startAPProcess` entry (UX, not stability)

Call `ensureGhostServerReady()` before first chunk — OLD required manual wake too.

---

## 7. Manual Stress Test Plan

Use after any Ghost Server change. Ghost must be woken (`#ap-wakeup-btn`) before tests unless testing wake flow explicitly.

### 7.1 Single Upload

- [ ] Wake Ghost → `/ping` returns `{ ok: true }` on port 3019
- [ ] Queue **1 design**, 1 account, publish mode
- [ ] Upload completes; design status `published` in queue monitor
- [ ] **Critical:** No leftover `chrome.exe` with `server_profiles\<email>` in command line (Task Manager)
- [ ] `server_logs/server.log` shows `[UploadBrowser]` and no `Profile browser lock timeout`

### 7.2 Sequential Upload (same account, multiple designs)

- [ ] Queue **3–6 designs**, 1 account, `countPer` ≥ 3
- [ ] If >5 designs or large images → verify **multiple chunks** in AUT log
- [ ] All chunks succeed without manual Ghost restart
- [ ] 12s inter-chunk pause visible in log between chunks
- [ ] Per-design results all `published` (or expected partial failures logged)

### 7.3 Restart Test

- [ ] Start upload, then `Restart_Ghost_3019.cmd` mid-run → graceful failure logged
- [ ] Wake Ghost again → next upload succeeds
- [ ] `POST /api/ghost/restart` from extension (if used) respawns process
- [ ] After restart, no stale `profile_browser_locks/*.lock` older than 30 min blocks launch

### 7.4 Queue Stress

- [ ] **2+ accounts**, 2+ designs each, minimum `delaySec` between accounts
- [ ] Second account launches without "browser already running" / mutex timeout
- [ ] Queue monitor shows per-account and per-design progress throughout
- [ ] Stop mid-queue (`ap_stop`) → no hung Chrome for completed accounts
- [ ] Resume with retry-failed only re-runs failed items

### 7.5 Failure Recovery

- [ ] **Auth failure:** wrong password → browser stays open (`keepAlive`), HTTP 401
- [ ] **Recoverable navigation error:** simulate slow network → per-design 2-attempt retry in log
- [ ] **Chunk failure:** stop Ghost during chunk 1 → chunk 2 fails cleanly; retry-failed works
- [ ] **Visual mode:** `isVisual=true` → headed browser, no auto-close after auth fail
- [ ] `POST /release-profile-lock` clears locks when manual intervention needed

---

## 8. Validation Performed (Phase 2)

| Check | Result |
|-------|--------|
| `node --check ghost-server.js` | ✅ Pass |
| `node --check server/profile-browser-lock.js` | ✅ Pass |
| `node --check server/chrome-launch-shared.js` | ✅ Pass |
| Line counts: OLD 252 / CURRENT 3355 | Confirmed |
| `!keepAlive` teardown in `/upload` | ✅ Present |
| `let page` in `/upload` handler | ✅ Present |
| Inverted `!browser.isConnected()` close | ❌ Not present (fixed) |

---

## 9. Conclusion

CURRENT Ghost Server is a **13× expansion** of OLD with substantial new stability infrastructure (mutex, launch fallback, per-design retry, chunking). The **one critical regression** that broke chunked/sequential uploads — **browser not closing on success** — is **already fixed**. No additional critical patches are required for Phase 2.

**Stress test readiness:** CURRENT is **ready for manual stress testing** per Section 7, with primary focus on Single Upload + Sequential Upload + Queue Stress to validate teardown under chunking.

---

*Generated: Phase 2 full Ghost Server diff analysis — 2026-06-25*
