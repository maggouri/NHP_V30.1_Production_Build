# -*- coding: utf-8 -*-
"""
Restore Chrome profile Default (khalid.maggouri.97@gmail.com) extensions + visibility.
Chrome must be fully closed.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
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

USER_DATA = os.path.join(
    os.environ.get("LOCALAPPDATA", ""),
    "Google",
    "Chrome",
    "User Data",
)
LOCAL_STATE = os.path.join(USER_DATA, "Local State")
TARGET_EMAIL = "khalid.maggouri.97@gmail.com"
PROFILE_FOLDER = "Default"

# Best backups for this account (newest with most extensions first)
SECURE_BACKUP_CANDIDATES = [
    os.path.join(PROFILE, "Secure Preferences.backup_20260506_105809"),
    os.path.join(PROFILE, "Secure Preferences.archived_20260517_212053"),
    os.path.join(
        PROFILE, "ExtensionsRegistryBackup_20260517_200541", "Secure_Preferences"
    ),
]


def pick_secure_backup() -> str:
    best_path = ""
    best_count = -1
    for path in SECURE_BACKUP_CANDIDATES:
        if not os.path.isfile(path):
            continue
        data = load_json(path)
        count = len(data.get("extensions", {}).get("settings") or {})
        if count > best_count:
            best_count = count
            best_path = path
    if not best_path:
        raise FileNotFoundError("No Secure Preferences backup found for Default profile.")
    return best_path


def fix_local_state_profile() -> None:
    state = load_json(LOCAL_STATE)
    profile = state.setdefault("profile", {})
    cache = profile.setdefault("info_cache", {})
    entry = cache.setdefault(PROFILE_FOLDER, {})
    entry["name"] = "khalid maggouri"
    entry["user_name"] = TARGET_EMAIL
    entry["gaia_name"] = entry.get("gaia_name") or "khalid maggouri"
    entry["is_using_default_name"] = False
    entry.pop("is_ephemeral", None)

    order = profile.get("profiles_order") or []
    if PROFILE_FOLDER in order:
        order = [PROFILE_FOLDER] + [p for p in order if p != PROFILE_FOLDER]
    else:
        order = [PROFILE_FOLDER] + order
    profile["profiles_order"] = order
    profile["last_used"] = PROFILE_FOLDER
    profile["last_active_profiles"] = [PROFILE_FOLDER]

    save_json(LOCAL_STATE, state)


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Default profile folder not found.", file=sys.stderr)
        return 1

    prefs = load_json(PREFERENCES)
    account = prefs.get("account_info") or []
    email = ""
    if account and isinstance(account[0], dict):
        email = str(account[0].get("email", ""))
    if email.lower() != TARGET_EMAIL.lower():
        print(f"Warning: Default account is {email!r}, expected {TARGET_EMAIL}")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(PROFILE, f"KhalidProfileRestore_{stamp}")
    os.makedirs(backup_dir, exist_ok=True)
    for name in ("Preferences", "Secure Preferences"):
        src = os.path.join(PROFILE, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(backup_dir, name.replace(" ", "_")))

    secure_src = pick_secure_backup()
    print("Restoring Secure Preferences from:", secure_src)
    shutil.copy2(secure_src, SECURE_PREFERENCES)

    device_id = get_windows_device_id()
    secure = load_json(SECURE_PREFERENCES)
    count_before = len(secure.get("extensions", {}).get("settings") or {})
    recompute_protection(secure, device_id)
    save_json(SECURE_PREFERENCES, secure)

    synced = sync_preferences_from_secure(secure, prefs)
    save_json(PREFERENCES, prefs)

    fix_local_state_profile()

    print(f"Profile folder: {PROFILE_FOLDER} ({TARGET_EMAIL})")
    print(f"Extensions restored: {count_before} (synced {synced})")
    print("Display name set to: khalid maggouri")
    print("Backup of current files:", backup_dir)
    print("")
    print("Open Chrome -> click profile icon -> choose 'khalid maggouri' (Default)")
    print("Then open: chrome://extensions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
