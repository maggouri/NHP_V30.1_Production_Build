# Niche Hunter Pro — Portable Layout

## Folders

| Role | Path |
|------|------|
| **App Root** (Chrome load unpacked) | `...\Desktop\NHP_V30.1_Production_Build` |
| **Data Root** (mutable runtime) | `...\Desktop\NHP_DATA` |

Do **not** load Chrome from `NHP_DATA` or any new extension folder.

## Start

1. Double-click `START_NHP_PORTABLE.cmd (forwards to addon\01_Start_All)`
2. Or use `addon\01_Start_All\NHP_Start_All_Servers.cmd` (also initializes Data Root)

## Config

- `portable.config.json` — relative `dataRoot: ../NHP_DATA`
- Env override: `NHP_APP_ROOT`, `NHP_DATA_ROOT`
- Node helper: `utils/nhp-portable-paths.js`

## See also

`DATA_ROOT_README.md`
