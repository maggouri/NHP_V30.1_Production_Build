# -*- coding: utf-8 -*-
"""Print whether Chrome is enterprise-managed (Windows)."""
from __future__ import annotations

import json
import os
import subprocess
import winreg

PROFILE = os.path.join(
    os.environ.get("LOCALAPPDATA", ""),
    "Google",
    "Chrome",
    "User Data",
    "Default",
)
USER_DATA = os.path.dirname(PROFILE)


def reg_has_policies() -> list[str]:
    paths = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\Google\Chrome"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Policies\Google\Chrome"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\Google\Policies"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Policies\Google\Policies"),
    ]
    found = []
    for hive, subkey in paths:
        try:
            with winreg.OpenKey(hive, subkey) as key:
                i = 0
                while True:
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                        found.append(f"{subkey}\\{name} = {value!r}")
                        i += 1
                    except OSError:
                        break
        except OSError:
            pass
    return found


def main() -> int:
    print("=== Chrome policy diagnostic ===\n")
    policies = reg_has_policies()
    if policies:
        print("REGISTRY POLICIES FOUND (enterprise control):")
        for line in policies:
            print(" ", line)
    else:
        print("Registry policies: NONE (not controlled by Windows GPO/ADMX)")

    pref_path = os.path.join(PROFILE, "Preferences")
    secure_path = os.path.join(PROFILE, "Secure Preferences")
    if os.path.isfile(pref_path):
        pref = json.load(open(pref_path, encoding="utf-8"))
        secure_n = 0
        if os.path.isfile(secure_path):
            secure_n = len(
                json.load(open(secure_path, encoding="utf-8"))
                .get("extensions", {})
                .get("settings", {})
                or {}
            )
        prefs_n = len(pref.get("extensions", {}).get("settings", {}) or {})
        print(f"\nExtensions in Secure Preferences: {secure_n}")
        print(f"Extensions in Preferences: {prefs_n}")
        if secure_n and not prefs_n:
            print(
                "\nLikely cause: Chrome stores extensions in Secure Preferences only;"
            )
            print("the extensions page may fail to list them (not corporate block).")
        managed = pref.get("profile", {}).get("managed", {})
        if managed:
            print("\nprofile.managed (parental / family controls):", managed)
    if os.path.isfile(os.path.join(USER_DATA, "Local State")):
        ls = json.load(open(os.path.join(USER_DATA, "Local State"), encoding="utf-8"))
        print("\nManagement metadata:", ls.get("management", {}))
        info = ls.get("profile", {}).get("info_cache", {}).get("Default", {})
        print("Default profile:", info.get("name"), "|", info.get("user_name", ""))

    print("\nOpen in Chrome to double-check:")
    print("  chrome://policy")
    print("  chrome://management")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
