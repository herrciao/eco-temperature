"""Normalize API keys from environment (strip whitespace, optional quotes)."""
from __future__ import annotations

import os


def getenv_api_key(name: str) -> str | None:
    raw = os.environ.get(name)
    if raw is None:
        return None
    s = raw.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1].strip()
    return s or None
