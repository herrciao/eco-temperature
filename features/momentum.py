"""Momentum features: 1M / 3M / 6M as week-based percent changes."""
from __future__ import annotations

import pandas as pd

from config import MOM_WEEKS


def add_momentum(
    df: pd.DataFrame,
    col: str,
    prefix: str | None = None,
) -> pd.DataFrame:
    """Add {prefix}_mom_1m, _mom_3m, _mom_6m as percent change over N weeks."""
    p = prefix or col
    s = df[col]
    out = df.copy()
    for label, w in MOM_WEEKS.items():
        out[f"{p}_mom_{label}"] = (s / s.shift(w) - 1.0) * 100.0
    return out


def add_momentum_many(
    df: pd.DataFrame,
    columns: list[tuple[str, str]],
) -> pd.DataFrame:
    """columns: list of (column_name, prefix_for_features)."""
    out = df.copy()
    for col, prefix in columns:
        if col not in out.columns:
            continue
        out = add_momentum(out, col, prefix=prefix)
    return out
