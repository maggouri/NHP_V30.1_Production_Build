# -*- coding: utf-8 -*-
"""
Reset Preferences + Secure Preferences but KEEP Default\\Extensions folder.
Chrome recreates prefs and rescans installed extensions. Chrome must be closed.
"""
from __future__ import annotations

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
EXTENSIONS_DIR = os.path.join(PROFILE, "Extensions")


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Default profile not found.", file=sys.stderr)
        return 1

    disk = 0
    if os.path.isdir(EXTENSIONS_DIR):
        disk = len(
            [x for x in os.listdir(EXTENSIONS_DIR) if os.path.isdir(os.path.join(EXTENSIONS_DIR, x))]
        )
    print(f"Extensions on disk (kept): {disk}")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = os.path.join(PROFILE, f"PrefsFullReset_{stamp}")
    os.makedirs(backup, exist_ok=True)

    for name in ("Preferences", "Secure Preferences"):
        src = os.path.join(PROFILE, name)
        if os.path.isfile(src):
            shutil.move(src, os.path.join(backup, name.replace(" ", "_")))
            print("Archived:", name)

    ext_state = os.path.join(PROFILE, "Extension State")
    if os.path.isdir(ext_state):
        shutil.move(ext_state, os.path.join(backup, "Extension_State"))
        os.makedirs(ext_state, exist_ok=True)

    print("Backup:", backup)
    print("Start Chrome (profile: khalid maggouri) — wait 60s — open chrome://extensions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
