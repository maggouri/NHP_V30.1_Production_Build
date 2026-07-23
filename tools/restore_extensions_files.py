# -*- coding: utf-8 -*-
"""
Restore Default\\Extensions files by copying from other Chrome profiles,
then rebuild + re-sign registry for khalid.maggouri.97@gmail.com (Default).
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

USER_DATA = os.path.join(
    os.environ.get("LOCALAPPDATA", ""),
    "Google",
    "Chrome",
    "User Data",
)
EXTENSIONS_DIR = os.path.join(PROFILE, "Extensions")
NHP_PATH = r"C:\Users\maggouri\Desktop\NHP_V30.1_Production_Build"
NHP_ID = "lnfplhpnfclldpofcclibhlfcgkhhhob"

SECURE_SOURCE = os.path.join(
    PROFILE, "Secure Preferences.backup_20260506_105809"
)
REINSTALL_LIST = os.path.join(_TOOLS, "extensions_a_reinstaller.html")


def find_extension_sources() -> dict[str, str]:
    """Map extension_id -> profile folder path that contains it."""
    found: dict[str, str] = {}
    for prof_name in os.listdir(USER_DATA):
        if prof_name == "Default":
            continue
        ext_root = os.path.join(USER_DATA, prof_name, "Extensions")
        if not os.path.isdir(ext_root):
            continue
        for ext_id in os.listdir(ext_root):
            full = os.path.join(ext_root, ext_id)
            if os.path.isdir(full) and ext_id not in found:
                found[ext_id] = ext_root
    return found


def copy_extension(ext_id: str, source_root: str, dest_root: str) -> bool:
    src = os.path.join(source_root, ext_id)
    dst = os.path.join(dest_root, ext_id)
    if os.path.normcase(src) == os.path.normcase(dst):
        return os.path.isdir(dst)
    if not os.path.isdir(src):
        return False
    if os.path.isdir(dst):
        shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst)
    return True


def filter_settings_for_disk(settings: dict) -> tuple[dict, list[str]]:
    kept: dict = {}
    missing_store: list[str] = []

    for ext_id, info in settings.items():
        if not isinstance(info, dict):
            continue
        location = info.get("location")

        if ext_id == NHP_ID or (location == 4 and NHP_PATH.lower() in str(info.get("path", "")).lower()):
            if os.path.isdir(NHP_PATH):
                entry = dict(info)
                entry["state"] = 1
                entry["path"] = NHP_PATH
                entry["location"] = 4
                entry["disable_reasons"] = []
                kept[ext_id] = entry
            continue

        if location in (None, 5, 6):
            entry = dict(info)
            entry["state"] = 1
            entry["disable_reasons"] = []
            kept[ext_id] = entry
            continue

        if location == 1:
            ext_dir = os.path.join(EXTENSIONS_DIR, ext_id)
            if os.path.isdir(ext_dir):
                versions = sorted(
                    name
                    for name in os.listdir(ext_dir)
                    if os.path.isdir(os.path.join(ext_dir, name))
                )
                if versions:
                    entry = dict(info)
                    entry["state"] = 1
                    entry["path"] = f"{ext_id}\\{versions[-1]}"
                    entry["disable_reasons"] = []
                    kept[ext_id] = entry
            else:
                name = str(info.get("manifest", {}).get("name", ext_id))
                missing_store.append(f"{name} ({ext_id})")

    return kept, missing_store


def register_disk_extensions(settings: dict, kept: dict) -> int:
    """Add registry entries for extension folders not in the backup list."""
    added = 0
    if not os.path.isdir(EXTENSIONS_DIR):
        return 0
    for ext_id in os.listdir(EXTENSIONS_DIR):
        if ext_id in kept:
            continue
        ext_dir = os.path.join(EXTENSIONS_DIR, ext_id)
        if not os.path.isdir(ext_dir):
            continue
        versions = sorted(
            name for name in os.listdir(ext_dir) if os.path.isdir(os.path.join(ext_dir, name))
        )
        if not versions:
            continue
        version = versions[-1]
        manifest_path = os.path.join(ext_dir, version, "manifest.json")
        if not os.path.isfile(manifest_path):
            continue
        manifest = load_json(manifest_path)
        if ext_id in settings:
            entry = dict(settings[ext_id])
        else:
            entry = {
                "from_webstore": True,
                "location": 1,
                "manifest": manifest,
                "path": f"{ext_id}\\{version}",
            }
        entry["state"] = 1
        entry["path"] = f"{ext_id}\\{version}"
        entry["location"] = 1
        entry["manifest"] = manifest
        entry["disable_reasons"] = []
        kept[ext_id] = entry
        added += 1
    return added


def write_reinstall_html(missing: list[str]) -> None:
    lines = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'>",
        "<title>Extensions a reinstaller - khalid.maggouri.97</title></head><body>",
        "<h1>Extensions a reinstaller depuis le Chrome Web Store</h1>",
        "<p>Compte: khalid.maggouri.97@gmail.com (profil Default)</p><ul>",
    ]
    for item in missing:
        eid = item.split("(")[-1].rstrip(")")
        url = f"https://chromewebstore.google.com/detail/{eid}"
        lines.append(f"<li><a href='{url}' target='_blank'>{item}</a></li>")
    lines.append("</ul></body></html>")
    with open(REINSTALL_LIST, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def enable_extension_sync(prefs: dict) -> None:
    sync = prefs.setdefault("sync", {})
    sync["requested"] = True
    if "extensions" not in sync:
        sync["extensions"] = True
    pref_sync = prefs.setdefault("sync_preferences", {})
    pref_sync["extensions"] = True


def main() -> int:
    if not os.path.isfile(SECURE_SOURCE):
        print("Backup Secure Preferences not found.", file=sys.stderr)
        return 1

    os.makedirs(EXTENSIONS_DIR, exist_ok=True)
    sources = find_extension_sources()
    secure = load_json(SECURE_SOURCE)
    settings = secure.get("extensions", {}).get("settings") or {}

    copied = 0
    for ext_id, info in settings.items():
        if info.get("location") != 1:
            continue
        if ext_id not in sources:
            continue
        if copy_extension(ext_id, sources[ext_id], EXTENSIONS_DIR):
            copied += 1

    on_disk = len(
        [x for x in os.listdir(EXTENSIONS_DIR) if os.path.isdir(os.path.join(EXTENSIONS_DIR, x))]
    )
    print(f"Copied {copied} extension folders. On disk now: {on_disk}")

    kept, missing = filter_settings_for_disk(settings)
    added = register_disk_extensions(settings, kept)
    if added:
        print(f"Registered {added} extra extensions found on disk.")
    secure.setdefault("extensions", {})["settings"] = kept
    secure.setdefault("extensions", {}).setdefault("ui", {})["developer_mode"] = True

    macs_ext = secure.get("protection", {}).get("macs", {}).get("extensions", {})
    if isinstance(macs_ext, dict) and "settings_encrypted_hash" in macs_ext:
        del macs_ext["settings_encrypted_hash"]

    device_id = get_windows_device_id()
    recompute_protection(secure, device_id)
    save_json(SECURE_PREFERENCES, secure)

    prefs = load_json(PREFERENCES)
    synced = sync_preferences_from_secure(secure, prefs)
    enable_extension_sync(prefs)
    save_json(PREFERENCES, prefs)

    if missing:
        write_reinstall_html(missing)
        print(f"Missing from disk ({len(missing)}) — list:", REINSTALL_LIST)

    print(f"Registry: {len(settings)} -> {len(kept)} (synced {synced})")
    print("Open Chrome profile 'khalid maggouri' then chrome://extensions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
