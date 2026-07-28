# NHP mutable data lives next door

This folder is the **Chrome extension App Root** (load unpacked from here).

All heavy / mutable runtime data lives in the adjacent portable Data folder:

```text
..\NHP_DATA
```

Resolved at runtime from `portable.config.json` / `nhp-portable.json` / `NHP_DATA_ROOT` — never hardcode a drive letter or user profile path.

## Do not recreate these under App Root

`generated_designs`, `server_logs`, `server_profiles*`, `temp_uploads*`, `metadata_store`, `profile_backups*`, `profile_browser_locks`, `backups`, `.tmp`

Servers resolve Data Root via:

- Env: `NHP_DATA_ROOT` / `NHP_APP_ROOT`
- Config: `portable.config.json`, `nhp-portable.json`
- Helper: `utils/nhp-portable-paths.js`

## Start

Use `START_NHP_PORTABLE.cmd` (or existing `NHP_Start_All_Servers.cmd` after portable init).

## Chrome identity

Keep loading this same App Root path. Do **not** reload from `NHP_DATA` or any new extension folder — that would break storage/identity.
