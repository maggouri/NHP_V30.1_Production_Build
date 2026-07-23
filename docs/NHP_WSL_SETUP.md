# NHP — WSL backend setup (v30.1)

Chrome runs on **Windows**. Node servers (Ghost, AI Bridge, CLI Proxy, etc.) can run inside **WSL**. The extension connects to them using a configurable local host.

## Quick setup

1. Open **Admin** → **تخصيص خاص (AI + الإعدادات)** → section **بيئة التشغيل (WSL)**.
2. Set **وضع الخلفية** to `WSL`.
3. Leave **مضيف الخوادم المحلية** as `localhost` (default on WSL2) or click **اكتشاف المضيف** after servers are running.
4. Confirm **مجلد المشروع** (default: `/mnt/c/Users/.../NHP_V30.1_Production_Build`).
5. Save, then reload the extension at `chrome://extensions`.

## Start servers in WSL

```bash
cd /mnt/c/Users/maggouri/Desktop/NHP_V30.1_Production_Build
chmod +x NHP_Start_All_Servers.sh
./NHP_Start_All_Servers.sh
```

Or run in background:

```bash
nohup ./NHP_Start_All_Servers.sh >> server_logs/wsl-start.log 2>&1 &
```

## Host names

| Scenario | Recommended host |
|----------|------------------|
| WSL2 + mirrored localhost (Windows 11+) | `localhost` |
| WSL2 without port mirror | WSL VM IP from `wsl hostname -I` (first address) |
| Everything on Windows (default) | `127.0.0.1` |

CLI Proxy base URL in Admin follows the same host (port `8317`).

## Environment variables (Node in WSL)

| Variable | Purpose |
|----------|---------|
| `NHP_BACKEND_MODE=wsl` | Mark WSL runtime for listen/bind helpers |
| `NHP_LISTEN_HOST=0.0.0.0` | Bind servers on all interfaces (default in WSL) |
| `NHP_CHROME_PATH` | Override Chrome binary (Windows Chrome under `/mnt/c/...`) |
| `NHP_AI_CHROME_USER_DATA_DIR` | Chrome profile directory |
| `NHP_EXTRA_NODE_PATHS` | Extra `node_modules` paths (delimiter-separated) |

## Limitations

- **Native messaging** and `.cmd` launchers target Windows; in WSL mode start servers manually in WSL or use the `.sh` script.
- **Manager on port 3009** is optional and not started by `NHP_Start_All_Servers.sh`.
- **Puppeteer** uses Windows Chrome from WSL via `/mnt/c/Program Files/...` when available.
- Python tools under `tools/` that edit Chrome prefs still expect Windows `LOCALAPPDATA`.

## Reload after changes

1. `chrome://extensions` → Reload **Niche Hunter Pro**
2. Restart WSL servers if you changed ports or project path
