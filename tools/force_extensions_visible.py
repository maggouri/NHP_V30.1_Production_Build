# -*- coding: utf-8 -*-
"""
Force Chrome Default profile to register ALL extensions found on disk.
Removes broken install_signature and Extension State cache.
Chrome must be fully closed.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime

_TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _TOOLS)

from resign_chrome_secure_prefs_win import (  # noqa: E402
    PREFERENCES,
    PROFILE,
    SECURE_PREFERENCES,
    get_windows_device_id,
    load_json,
    recompute_protection,
    save_json,
    sync_preferences_from_secure,
)

EXTENSIONS_DIR = os.path.join(PROFILE, "Extensions")
NHP_PATH = r"C:\Users\maggouri\Desktop\NHP_V30.1_Production_Build"
NHP_ID = "lnfplhpnfclldpofcclibhlfcgkhhhob"
EXTENSION_STATE_DIR = os.path.join(PROFILE, "Extension State")


def latest_version_dir(ext_id: str) -> tuple[str, str] | None:
    root = os.path.join(EXTENSIONS_DIR, ext_id)
    if not os.path.isdir(root):
        return None
    versions = sorted(
        name for name in os.listdir(root) if os.path.isdir(os.path.join(root, name))
    )
    if not versions:
        return None
    version = versions[-1]
    manifest_path = os.path.join(root, version, "manifest.json")
    if not os.path.isfile(manifest_path):
        return None
    return version, manifest_path


def build_settings_from_disk() -> dict:
    settings: dict = {}
    if not os.path.isdir(EXTENSIONS_DIR):
        return settings

    for ext_id in os.listdir(EXTENSIONS_DIR):
        found = latest_version_dir(ext_id)
        if not found:
            continue
        version, manifest_path = found
        manifest = load_json(manifest_path)
        settings[ext_id] = {
            "state": 1,
            "location": 1,
            "path": f"{ext_id}\\{version}",
            "from_webstore": True,
            "manifest": manifest,
            "disable_reasons": [],
            "granted_permissions": {
                "api": manifest.get("permissions", []),
                "explicit_host": manifest.get("host_permissions", []),
                "manifest_permissions": [],
                "scriptable_host": [],
            },
        }

    if os.path.isdir(NHP_PATH):
        manifest_path = os.path.join(NHP_PATH, "manifest.json")
        manifest = load_json(manifest_path) if os.path.isfile(manifest_path) else {"name": "NHP"}
        settings[NHP_ID] = {
            "state": 1,
            "location": 4,
            "path": NHP_PATH,
            "from_webstore": False,
            "manifest": manifest,
            "disable_reasons": [],
            "newAllowFileAccess": True,
        }

    return settings


def clean_extensions_metadata(prefs: dict, valid_ids: set[str]) -> None:
    ext = prefs.setdefault("extensions", {})
    ext.pop("install_signature", None)
    ext["settings"] = {k: v for k, v in (ext.get("settings") or {}).items() if k in valid_ids}

    pinned = ext.get("pinned_extensions")
    if isinstance(pinned, list):
        ext["pinned_extensions"] = [x for x in pinned if x in valid_ids]

    commands = ext.get("commands")
    if isinstance(commands, dict):
        ext["commands"] = {
            k: v
            for k, v in commands.items()
            if isinstance(v, dict) and v.get("extension") in valid_ids
        }

    ext.setdefault("ui", {})["developer_mode"] = True


def clear_extension_state_cache() -> None:
    if os.path.isdir(EXTENSION_STATE_DIR):
        shutil.rmtree(EXTENSION_STATE_DIR, ignore_errors=True)
    os.makedirs(EXTENSION_STATE_DIR, exist_ok=True)


def write_launch_bat(settings: dict) -> str:
    paths: list[str] = []
    if os.path.isdir(NHP_PATH):
        paths.append(NHP_PATH)
    for ext_id, info in settings.items():
        if info.get("location") == 4:
            path = str(info.get("path", ""))
            if path and path not in paths:
                paths.append(path)
        elif info.get("location") == 1:
            rel = str(info.get("path", "")).replace("/", "\\")
            full = os.path.join(EXTENSIONS_DIR, rel)
            if os.path.isdir(full) and full not in paths:
                paths.append(full)

    chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.isfile(chrome):
        chrome = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

    bat_path = os.path.join(_TOOLS, "OUVRIR_CHROME_AVEC_EXTENSIONS.bat")
    load_arg = ",".join(f'"{p}"' for p in paths)
    lines = [
        "@echo off",
        "chcp 65001 >nul",
        "echo Fermeture de Chrome...",
        "taskkill /IM chrome.exe /F >nul 2>&1",
        "timeout /t 2 /nobreak >nul",
        f'echo Chargement de {len(paths)} extensions (profil khalid maggouri)...',
        f'"{chrome}" --profile-directory=Default --load-extension={load_arg}',
    ]
    with open(bat_path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    return bat_path


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Default profile not found.", file=sys.stderr)
        return 1

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(PROFILE, f"ForceExtensionsBackup_{stamp}")
    os.makedirs(backup_dir, exist_ok=True)
    for name in ("Preferences", "Secure Preferences"):
        src = os.path.join(PROFILE, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(backup_dir, name.replace(" ", "_")))

    settings = build_settings_from_disk()
    if not settings:
        print("No extensions found on disk.", file=sys.stderr)
        return 1

    valid_ids = set(settings.keys())
    device_id = get_windows_device_id()

    secure = {
        "extensions": {"settings": settings, "ui": {"developer_mode": True}},
        "protection": {
            "macs": {
                "extensions": {
                    "settings": {ext_id: "REHASH" for ext_id in settings},
                    "ui": {"developer_mode": "REHASH"},
                }
            }
        },
    }
    recompute_protection(secure, device_id)
    save_json(SECURE_PREFERENCES, secure)

    prefs = load_json(PREFERENCES)
    clean_extensions_metadata(prefs, valid_ids)
    sync_preferences_from_secure(secure, prefs)
    clean_extensions_metadata(prefs, valid_ids)
    save_json(PREFERENCES, prefs)

    clear_extension_state_cache()
    bat = write_launch_bat(settings)

    print(f"Registered {len(settings)} extensions from disk (+ NHP).")
    print("Removed install_signature and Extension State cache.")
    print("Launch helper:", bat)
    print("")
    print("OPTION A: Double-click OUVRIR_CHROME_AVEC_EXTENSIONS.bat (loads extensions immediately)")
    print("OPTION B: Open Chrome normally -> chrome://extensions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
