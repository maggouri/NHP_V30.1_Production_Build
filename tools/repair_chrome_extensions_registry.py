# -*- coding: utf-8 -*-
"""
Restore chrome://extensions list (Chrome must be closed).

1) Re-sign Secure Preferences MACs for this Windows user (required).
2) Copy extensions.settings into Preferences.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

PROFILE = os.path.join(
    os.environ.get("LOCALAPPDATA", ""),
    "Google",
    "Chrome",
    "User Data",
    "Default",
)
PREFERENCES = os.path.join(PROFILE, "Preferences")
SECURE_PREFERENCES = os.path.join(PROFILE, "Secure Preferences")


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def backup_file(path: str, backup_dir: str) -> str:
    os.makedirs(backup_dir, exist_ok=True)
    name = os.path.basename(path).replace(" ", "_")
    dest = os.path.join(backup_dir, name)
    shutil.copy2(path, dest)
    return dest


def merge_extensions_registry() -> dict:
    if not os.path.isfile(PREFERENCES):
        raise FileNotFoundError(f"Missing: {PREFERENCES}")
    if not os.path.isfile(SECURE_PREFERENCES):
        raise FileNotFoundError(f"Missing: {SECURE_PREFERENCES}")

    prefs = load_json(PREFERENCES)
    secure = load_json(SECURE_PREFERENCES)

    prefs_ext = prefs.setdefault("extensions", {})
    secure_ext = secure.get("extensions", {})
    secure_settings = secure_ext.get("settings") or {}

    if not secure_settings:
        raise RuntimeError("Secure Preferences has no extensions.settings to restore.")

    before_count = len(prefs_ext.get("settings") or {})
    prefs_ext["settings"] = secure_settings

    # Keep UI flags in sync when present in secure file
    for key in ("ui", "install_signature", "last_chrome_version"):
        if key in secure_ext and key not in prefs_ext:
            prefs_ext[key] = secure_ext[key]

    secure_ui = secure_ext.get("ui")
    if isinstance(secure_ui, dict):
        prefs_ui = prefs_ext.setdefault("ui", {})
        if "developer_mode" in secure_ui:
            prefs_ui["developer_mode"] = secure_ui["developer_mode"]

    save_json(PREFERENCES, prefs)

    return {
        "before_count": before_count,
        "after_count": len(secure_settings),
        "nhp_paths": [
            str(info.get("path", ""))
            for info in secure_settings.values()
            if "NHP_V30.1_Production_Build" in str(info.get("path", ""))
        ],
    }


def main() -> int:
    if not PROFILE or not os.path.isdir(PROFILE):
        print("Chrome Default profile not found.", file=sys.stderr)
        return 1

    resign_script = os.path.join(os.path.dirname(__file__), "resign_chrome_secure_prefs_win.py")
    if os.path.isfile(resign_script):
        print("Re-signing Secure Preferences for this PC...")
        result = subprocess.run([sys.executable, resign_script], check=False)
        if result.returncode == 0:
            return 0

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(PROFILE, f"ExtensionsRegistryBackup_{stamp}")

    print("Backing up Chrome preference files...")
    backup_file(PREFERENCES, backup_dir)
    backup_file(SECURE_PREFERENCES, backup_dir)
    print(f"Backup folder: {backup_dir}")

    result = merge_extensions_registry()
    print(f"extensions.settings: {result['before_count']} -> {result['after_count']}")
    if result["nhp_paths"]:
        print("NHP path restored:", result["nhp_paths"][0])
    else:
        print("Warning: NHP path not found in restored settings.")

    print("Done. Start Chrome and open chrome://extensions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
