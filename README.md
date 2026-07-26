# 02_Chrome_Extension — Chrome Extension + Local Servers

**Status:** MP-01C **Phase 2 COMPLETE** (2026-07-07)

## Canonical source

```
<NHP_PLATFORM>/02_Chrome_Extension/
├── manifest.json
├── background.js
├── modules/
├── creaty-server.js      (:3020)
├── ghost-server.js       (:3019)
├── ai-bridge-server.js   (:3031)
└── scripts/
```

مثال: `D:/Dev/NHP_PLATFORM/02_Chrome_Extension/`

## Git

- Repository: `02_Chrome_Extension/.git`
- Branch: `main`
- HEAD: `b69b5765` (EP-302B Complete)
- Remote: **not configured** (MB-02 open item)

## Load extension

Follow `LOAD_EXTENSION.txt` in this folder — load unpacked from:

```
<NHP_PLATFORM>/02_Chrome_Extension
```

Example: `D:/Dev/NHP_PLATFORM/02_Chrome_Extension`

Workspace root `LOAD_EXTENSION.txt` points here. Root `NHP_Start_All_Servers.cmd` delegates to this folder.

## Sync to EmailCore

```powershell
cd NHP_PLATFORM\02_Chrome_Extension
node scripts\sync-to-emailcore.js
```

Default target: `../01_EmailCore` (override with `NHP_EMAILCORE_DIR`).

## Verification

See `06_Documentation/planning/MP01C_VERIFICATION.md` — 81/81 tests PASS from this tree.
