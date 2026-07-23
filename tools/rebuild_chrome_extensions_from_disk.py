# -*- coding: utf-8 -*-
"""
Rebuild Chrome extension registry from installed folders + re-sign (Windows).
Use when chrome://extensions stays empty after resign-only repair.
Chrome must be fully closed.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from typing import Any

# Reuse signing helpers from resign script
_TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _TOOLS)

from resign_chrome_secure_prefs_win import (  # noqa: E402
    PREFERENCES,
    PROFILE,
    SECURE_PREFERENCES,
    backup_files,
    get_windows_device_id,
    load_json,
    recompute_protection,
    save_json,
    sync_preferences_from_secure,
)

EXTENSIONS_DIR = os.path.join(PROFILE, "Extensions")
NHP_PATH = r"C:\Users\maggouri\Desktop\NHP_V30.1_Production_Build"
NHP_ID = "lnfplhpnfclldpofcclibhlfcgkhhhob"

# Chrome component / built-in locations (keep if present in old registry)
KEEP_LOCATIONS = {None, 5, 6}


def list_version_dir(ext_id: str) -> str | None:
    root = os.path.join(EXTENSIONS_DIR, ext_id)
    if not os.path.isdir(root):
        return None
    versions = [
        name
        for name in os.listdir(root)
        if os.path.isdir(os.path.join(root, name))
    ]
    if not versions:
        return None
    versions.sort()
    return versions[-1]


def enable_entry(info: dict) -> dict:
    info = dict(info)
    info["state"] = 1
    if info.get("disable_reasons"):
        info["disable_reasons"] = []
    return info


def filter_settings(old_settings: dict) -> dict:
    kept: dict[str, Any] = {}
    for ext_id, info in old_settings.items():
        if not isinstance(info, dict):
            continue
        location = info.get("location")
        path = str(info.get("path", ""))

        # Unpacked NHP
        if ext_id == NHP_ID or (location == 4 and NHP_PATH.lower() in path.lower()):
            if os.path.isdir(NHP_PATH):
                kept[ext_id] = enable_entry(info)
            continue

        # Built-in / component extensions
        if location in KEEP_LOCATIONS:
            kept[ext_id] = enable_entry(info)
            continue

        # Normal installed extension (Web Store) — folder must exist
        if location == 1:
            version_dir = list_version_dir(ext_id)
            if version_dir:
                info = enable_entry(info)
                info["path"] = f"{ext_id}\\{version_dir}"
                kept[ext_id] = info
            continue

        # Other unpacked with valid path
        if location == 4 and path and os.path.isdir(path):
            kept[ext_id] = enable_entry(info)

    return kept


def strip_encrypted_hashes(secure: dict) -> None:
    macs_ext = secure.get("protection", {}).get("macs", {}).get("extensions", {})
    if isinstance(macs_ext, dict) and "settings_encrypted_hash" in macs_ext:
        del macs_ext["settings_encrypted_hash"]


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Chrome Default profile not found.", file=sys.stderr)
        return 1

    device_id = get_windows_device_id()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(PROFILE, f"ExtensionsRebuildBackup_{stamp}")

    print("Device ID:", device_id)
    print("Backing up...")
    backup_files(backup_dir)
    print("Backup:", backup_dir)

    secure = load_json(SECURE_PREFERENCES)
    prefs = load_json(PREFERENCES)

    old_settings = secure.get("extensions", {}).get("settings") or {}
    new_settings = filter_settings(old_settings)

    print(f"extensions.settings: {len(old_settings)} -> {len(new_settings)}")

    secure.setdefault("extensions", {})["settings"] = new_settings
    secure.setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = True

    strip_encrypted_hashes(secure)
    recompute_protection(secure, device_id)
    save_json(SECURE_PREFERENCES, secure)

    count = sync_preferences_from_secure(secure, prefs)
    save_json(PREFERENCES, prefs)

    print(f"Re-signed Secure Preferences ({count} extensions).")
    print("Synced to Preferences.")
    print("")
    print("1) Open Chrome (profile: Default)")
    print("2) Go to chrome://extensions")
    print("3) If still empty: run FIX_CHROME_EXTENSIONS.bat then try loading NHP unpacked manually")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
