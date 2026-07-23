# -*- coding: utf-8 -*-
"""
Store extensions ONLY in Preferences with valid HMAC (disable Secure Preferences).
For Chrome installs where Secure prefs work but chrome://extensions stays empty.
Chrome must be fully closed.
"""
from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime

_TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _TOOLS)

from force_extensions_visible import (  # noqa: E402
    EXTENSIONS_DIR,
    PROFILE,
    build_settings_from_disk,
    clear_extension_state_cache,
)
from resign_chrome_secure_prefs_win import (  # noqa: E402
    PREFERENCES,
    SECURE_PREFERENCES,
    get_windows_device_id,
    load_json,
    recompute_protection,
    save_json,
)

NHP_PATH = r"C:\Users\maggouri\Desktop\NHP_V30.1_Production_Build"


def clear_parental_blocks(prefs: dict) -> None:
    profile = prefs.setdefault("profile", {})
    profile.pop("managed", None)
    profile["managed_user_id"] = ""


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Default profile not found.", file=sys.stderr)
        return 1

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = os.path.join(PROFILE, f"PrefsOnlyBackup_{stamp}")
    os.makedirs(backup, exist_ok=True)
    for name in ("Preferences", "Secure Preferences"):
        src = os.path.join(PROFILE, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(backup, name.replace(" ", "_")))

    settings = build_settings_from_disk()
    if not settings:
        print("No extensions on disk.", file=sys.stderr)
        return 1

    device_id = get_windows_device_id()
    prefs = load_json(PREFERENCES)
    clear_parental_blocks(prefs)

    prefs["extensions"] = {
        "settings": settings,
        "ui": {"developer_mode": True},
    }
    prefs["protection"] = {
        "macs": {
            "extensions": {
                "settings": {ext_id: "REHASH" for ext_id in settings},
                "ui": {"developer_mode": "REHASH"},
            }
        }
    }
    recompute_protection(prefs, device_id)
    save_json(PREFERENCES, prefs)

    if os.path.isfile(SECURE_PREFERENCES):
        archived = SECURE_PREFERENCES + f".disabled_{stamp}"
        shutil.move(SECURE_PREFERENCES, archived)
        print("Archived Secure Preferences:", archived)

    clear_extension_state_cache()
    disk = len([x for x in os.listdir(EXTENSIONS_DIR) if os.path.isdir(os.path.join(EXTENSIONS_DIR, x))])
    print(f"Preferences-only mode: {len(settings)} extensions registered, {disk} on disk.")
    print("Removed profile.managed (parental) if present.")
    print("Open chrome://policy — should show no blocking policies.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
