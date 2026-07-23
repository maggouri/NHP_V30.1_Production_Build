# -*- coding: utf-8 -*-
"""
Last resort: archive Secure Preferences and let Chrome rebuild from Extensions folder.
Chrome must be fully closed.
"""
from __future__ import annotations

import json
import os
import shutil
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


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Profile not found.", file=sys.stderr)
        return 1

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(PROFILE, f"ExtensionsResetBackup_{stamp}")
    os.makedirs(backup_dir, exist_ok=True)

    for name in ("Preferences", "Secure Preferences"):
        src = os.path.join(PROFILE, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(backup_dir, name.replace(" ", "_")))

    archived = os.path.join(PROFILE, f"Secure Preferences.archived_{stamp}")
    if os.path.isfile(SECURE_PREFERENCES):
        shutil.move(SECURE_PREFERENCES, archived)
        print("Archived:", archived)

    prefs = json.load(open(PREFERENCES, encoding="utf-8"))
    ext = prefs.get("extensions")
    if isinstance(ext, dict):
        ext.pop("settings", None)
        ext.setdefault("ui", {})["developer_mode"] = True
    with open(PREFERENCES, "w", encoding="utf-8") as handle:
        json.dump(prefs, handle, ensure_ascii=False, separators=(",", ":"))

    print("Removed extensions.settings from Preferences.")
    print("Start Chrome — it should rediscover extensions from the Extensions folder.")
    print("Backup:", backup_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
