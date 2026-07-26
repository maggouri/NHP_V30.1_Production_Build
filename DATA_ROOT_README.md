# NHP mutable data lives next door

This folder is the **Chrome extension App Root** (load unpacked from here).

All heavy / mutable runtime data was moved to:

```text
..\NHP_DATA
```

Full path on this machine:

```text
C:\Users\MAGGOURIKHALID\Desktop\NHP_DATA
```

## Do not recreate these under App Root

`generated_designs`, `server_logs`, `server_profiles*`, `temp_uploads*`, `metadata_store`, `profile_backups*`, `profile_browser_locks`, `backups`, `.tmp`

Servers resolve Data Root via:

- Env: `NHP_DATA_ROOT` / `NHP_APP_ROOT`
- Config: `portable.config.json`
- Helper: `utils/nhp-portable-paths.js`

## Start

Use `START_NHP_PORTABLE.cmd` (or existing `NHP_Start_All_Servers.cmd` after portable init).

## Chrome identity

Keep loading this same App Root path. Do **not** reload from `NHP_DATA` or any new extension folder — that would break storage/identity.
