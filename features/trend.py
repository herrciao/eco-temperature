"""Trend direction: short vs long SMA cross."""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import SMA_WEEKS


def add_sma(
    df: pd.DataFrame,
    col: str,
    prefix: str | None = None,
) -> pd.DataFrame:
    p = prefix or col
    out = df.copy()
    s = out[col]
    for name, w in SMA_WEEKS.items():
        out[f"{p}_sma_{name}"] = s.rolling(w, min_periods=1).mean()
    return out


def golden_cross_signal(df: pd.DataFrame, short_col: str, long_col: str, out_col: str) -> pd.DataFrame:
    """1 when short > long, -1 when short < long."""
    out = df.copy()
    s = df[short_col]
    l = df[long_col]
    out[out_col] = np.sign(s - l)
    return out
