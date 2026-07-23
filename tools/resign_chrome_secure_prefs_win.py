# -*- coding: utf-8 -*-
"""
Re-sign Chrome Secure Preferences (Windows) and sync extensions.settings to Preferences.
Chrome must be fully closed before running.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from typing import Any

SEED = bytes.fromhex(
    "e748f336d85ea5f9dcdf25d8f347a65b4cdf667600f02df6724a2af18a212d26"
    "b788a25086910cf3a90313696871f3dc05823730c91df8ba5c4fd9c884b505a8"
)

PROFILE = os.path.join(
    os.environ.get("LOCALAPPDATA", ""),
    "Google",
    "Chrome",
    "User Data",
    "Default",
)
PREFERENCES = os.path.join(PROFILE, "Preferences")
SECURE_PREFERENCES = os.path.join(PROFILE, "Secure Preferences")


def get_windows_device_id() -> str:
    """Chrome on Windows uses the user SID without the final RID segment."""
    out = subprocess.check_output(["whoami", "/user"], text=True, errors="replace")
    sid = ""
    for line in out.splitlines():
        for token in line.split():
            if token.startswith("S-1-5-") and token.count("-") >= 3:
                sid = token
                break
        if sid:
            break
    if not sid:
        ps_cmd = (
            "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value"
        )
        sid = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            text=True,
            errors="replace",
        ).strip()
    if not sid.startswith("S-1-5-"):
        raise RuntimeError("Could not read Windows SID")
    parts = sid.rsplit("-", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return sid


def copy_without_empty_children(value: Any) -> Any:
    if isinstance(value, list):
        copy = []
        for child in value:
            child_copy = copy_without_empty_children(child)
            if child_copy is not None:
                copy.append(child_copy)
        return copy if copy else None
    if isinstance(value, dict):
        copy = {}
        for key, child in value.items():
            child_copy = copy_without_empty_children(child)
            if child_copy is not None:
                copy[key] = child_copy
        return copy if copy else None
    if isinstance(value, (type(None), bool, int, float, str)):
        return value
    raise TypeError(f"Unsupported value type: {type(value)!r}")


def chrome_json_ser(value: Any) -> bytes:
    if value is None:
        return b"null"
    if isinstance(value, bool):
        return b"true" if value else b"false"
    if isinstance(value, int):
        return str(value).encode()
    if isinstance(value, float):
        real = str(value)
        if "." not in real and "e" not in real and "E" not in real:
            real = real + ".0"
        elif real[0] == ".":
            real = "0" + real
        elif real[0] == "-" and real[1] == ".":
            real = "-0" + real[1:]
        return real.encode()
    if isinstance(value, str):
        out = bytearray(b'"')
        for char in value:
            special = {
                "\b": "\\b",
                "\f": "\\f",
                "\n": "\\n",
                "\r": "\\r",
                "\t": "\\t",
                "\\": "\\\\",
                '"': '\\"',
                "<": "\\u003C",
                "\u2028": "\\u2028",
                "\u2029": "\\u2029",
            }.get(char)
            if special is not None:
                out.extend(special.encode())
            elif ord(char) < 32:
                out.extend(f"\\u{ord(char):04x}".encode())
            else:
                out.extend(char.encode())
        out.append(ord('"'))
        return bytes(out)
    if isinstance(value, list):
        parts = [chrome_json_ser(item) for item in value]
        return b"[" + b",".join(parts) + b"]"
    if isinstance(value, dict):
        parts = []
        for key in sorted(value):
            parts.append(chrome_json_ser(key) + b":" + chrome_json_ser(value[key]))
        return b"{" + b",".join(parts) + b"}"
    raise TypeError(f"Unsupported value type: {type(value)!r}")


def value_as_string(value: Any) -> bytes:
    if isinstance(value, dict):
        value = copy_without_empty_children(value) or {}
        return chrome_json_ser(value)
    return chrome_json_ser(value)


def calculate_mac(device_id: str, path: str, value: Any) -> str:
    message = device_id.encode() + path.encode() + value_as_string(value)
    return hmac.new(SEED, message, hashlib.sha256).hexdigest().upper()


def recompute_mac_subtree(
    parent_keys: list[str],
    mac_subtree: dict,
    prefs_subtree: dict,
    device_id: str,
) -> None:
    for key in sorted(mac_subtree):
        if key not in prefs_subtree:
            continue
        path = ".".join(parent_keys + [key])
        mac_value = mac_subtree[key]
        pref_value = prefs_subtree[key]
        if isinstance(mac_value, dict):
            if isinstance(pref_value, dict):
                recompute_mac_subtree(parent_keys + [key], mac_value, pref_value, device_id)
        elif isinstance(mac_value, str):
            mac_subtree[key] = calculate_mac(device_id, path, pref_value)


def recompute_protection(data: dict, device_id: str) -> None:
    protection = data.get("protection")
    if not isinstance(protection, dict):
        return
    macs = protection.get("macs")
    if isinstance(macs, dict):
        recompute_mac_subtree([], macs, data, device_id)
        protection["super_mac"] = calculate_mac(device_id, "", macs)


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))


def backup_files(backup_dir: str) -> None:
    os.makedirs(backup_dir, exist_ok=True)
    for path in (PREFERENCES, SECURE_PREFERENCES):
        shutil.copy2(path, os.path.join(backup_dir, os.path.basename(path).replace(" ", "_")))


def sync_preferences_from_secure(secure: dict, prefs: dict) -> int:
    secure_ext = secure.get("extensions", {})
    secure_settings = secure_ext.get("settings") or {}
    normalized = {}
    for ext_id, info in secure_settings.items():
        if isinstance(info, dict):
            entry = dict(info)
            entry["state"] = 1
            if entry.get("disable_reasons"):
                entry["disable_reasons"] = []
            normalized[ext_id] = entry
        else:
            normalized[ext_id] = info
    prefs_ext = prefs.setdefault("extensions", {})
    prefs_ext["settings"] = normalized

    for key in ("ui", "install_signature", "last_chrome_version"):
        if key in secure_ext:
            prefs_ext[key] = secure_ext[key]

    secure_ui = secure_ext.get("ui")
    if isinstance(secure_ui, dict) and "developer_mode" in secure_ui:
        prefs_ext.setdefault("ui", {})["developer_mode"] = secure_ui["developer_mode"]

    return len(secure_settings)


def main() -> int:
    if not os.path.isdir(PROFILE):
        print("Chrome Default profile not found.", file=sys.stderr)
        return 1

    device_id = get_windows_device_id()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(PROFILE, f"ExtensionsResignBackup_{stamp}")

    print("Device ID (Windows):", device_id)
    print("Backing up preference files...")
    backup_files(backup_dir)
    print("Backup folder:", backup_dir)

    secure = load_json(SECURE_PREFERENCES)
    prefs = load_json(PREFERENCES)

    before_secure = len(secure.get("extensions", {}).get("settings") or {})
    before_prefs = len(prefs.get("extensions", {}).get("settings") or {})
    print(f"Before: Secure settings={before_secure}, Preferences settings={before_prefs}")

    recompute_protection(secure, device_id)
    save_json(SECURE_PREFERENCES, secure)

    after_count = sync_preferences_from_secure(secure, prefs)
    save_json(PREFERENCES, prefs)

    print(f"Re-signed Secure Preferences (super_mac updated).")
    print(f"Synced extensions.settings -> Preferences ({after_count} entries).")
    print("Start Chrome and open chrome://extensions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
