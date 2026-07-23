# NHP V30.1 — Launch Readiness Checklist

Use this after code changes and before sharing the extension folder.

## Before you start

1. **Backup** — Copy the whole `NHP_V30.1_Production_Build` folder (or zip it) before major edits.
2. **Smoke script** — From project root:
   ```bash
   node scripts/smoke-check.js
   ```
   Expect `0 failure(s)`. Fix any FAIL before continuing.
3. **Optional cleanup** — Move stray `.bak` files (does not delete):
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools/cleanup-production-bak.ps1
   ```

## Reload extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Reload** on *Niche Hunter Pro*
4. If behavior is odd: **Remove** → **Load unpacked** → select this folder again

## Manual Chrome tests (critical paths)

### Launcher & popup
- [ ] Click extension icon → launcher opens main UI (tab or window per your setting)
- [ ] Header nav: Home, Search Tools, Notes & Lab, Studio & AI, Automation, Admin — each opens without console errors
- [ ] Expand / App Window buttons work

### USPTO
- [ ] Open USPTO module, queue 2–3 test niches, run scan
- [ ] Results show safe/banned; stop button works

### TeePublic / Analysis
- [ ] Run a small TeePublic analysis batch (3–5 niches)
- [ ] Results classify without stuck spinner

### SEO
- [ ] Upload one design, generate SEO (API or Gemini Web per your config)
- [ ] Title/tags populate; no blank panel after completion

### Studio
- [ ] Upload image, run one AI/rename action
- [ ] CLI Proxy retry banner appears only on transient failures (if proxy down, graceful error)

### Prompt Bag
- [ ] Right-click → save selection to bag
- [ ] Open Prompt Bag manager from context menu
- [ ] Paste last prompt into a text field on teepublic.com or chatgpt.com

### Background / servers (if used)
- [ ] Ghost server (3019) and AI bridge (3031) start from dashboard if you rely on them
- [ ] Native messaging host still registered (do not remove without replacement)

### Security spot-check
- [ ] Admin → AI keys: keys come from storage, not hardcoded in source
- [ ] No unexpected broad site permission prompts beyond listed platforms

## UTF-8 / Arabic

- [ ] Arabic UI labels in popup and modules render correctly (no `ØªØ³...` mojibake)
- [ ] Arabic comments in `background.js` header and section dividers look normal in editor

## Known gap to literal 100/100

| Area | Remaining gap |
|------|----------------|
| Architecture | `background.js` still large (~9k lines); further module splits recommended |
| Security | `http://*/*` and `https://*/*` kept for Prompt Bag overlay on arbitrary sites |
| XSS | Some `innerHTML` paths in studio/note still use static or pre-escaped data only |
| Tests | Smoke script is static; no automated Chrome E2E |
| Store publish | Chrome Web Store review, privacy policy, and listing assets not in repo |

**Practical score after Phase 2:** ~88–92/100 automated readiness; **100** requires full manual checklist pass + your production server/native-host verification.

---

*Generated for NHP V30.1 Production Build — Phase 2 launch readiness.*
