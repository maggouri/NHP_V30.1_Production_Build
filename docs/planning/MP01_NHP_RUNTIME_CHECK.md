# MP-01 Appendix — NHP_Runtime Check

**Date:** 2026-07-07  
**Path:** `E:\NHP_Runtime`  
**Purpose:** Evidence appendix for MP-01 §6

---

## Classification

**Runtime data directory — not canonical source.**

---

## Checks performed

| Check | Command / method | Result |
|-------|------------------|--------|
| Git repository | `Test-Path E:\NHP_Runtime\.git` | `False` |
| Chrome extension manifest | `Test-Path E:\NHP_Runtime\manifest.json` | `False` |
| Runtime manifest | Read `runtime.manifest.json` | Present (470 bytes) |

---

## `runtime.manifest.json` contents

```json
{
    "uploadsDir":  "E:/NHP_Runtime/uploads",
    "tempDir":  "E:/NHP_Runtime/temp",
    "version":  "1.0.0",
    "backupsDir":  "E:/NHP_Runtime/backups",
    "runtimeRoot":  "E:/NHP_Runtime",
    "logsDir":  "E:/NHP_Runtime/logs",
    "profilesDir":  "E:/NHP_Runtime/profiles",
    "cacheDir":  "E:/NHP_Runtime/cache",
    "sessionsDir":  "E:/NHP_Runtime/sessions",
    "locksDir":  "E:/NHP_Runtime/locks",
    "metadataDir":  "E:/NHP_Runtime/metadata"
}
```

---

## Directory listing (2026-07-07 scan)

```
E:\NHP_Runtime\
├── backups\          (empty)
├── cache\            (empty)
├── designs\
│   ├── jobs\         (empty)
│   └── library\      (empty)
├── locks\            (empty)
├── logs\             (empty)
├── metadata\         (empty)
├── profiles\         (empty)
├── sessions\         (empty)
├── temp\             (empty)
├── uploads\          (empty)
└── runtime.manifest.json
```

No `.js`, `.html`, or application entrypoints found under this tree.

---

## Relation to Production_Build

`E:\NHP_V30.1_Production_Build\runtime.manifest.json` — **not found** (runtime manifest lives only under `NHP_Runtime`).

Production_Build servers (`creaty-server.js`, etc.) remain in the extension tree per `scripts/sync-to-emailcore.js` L3–4.

---

*Appendix only — see `MP01_CANONICAL_SOURCE_DISCOVERY.md` for full matrix.*
