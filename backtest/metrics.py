"""Performance metrics: mean, median, win rate, max drawdown."""
from __future__ import annotations

import numpy as np
import pandas as pd


def max_drawdown(returns: pd.Series) -> float:
    """Max drawdown on cumulative simple returns."""
    if returns.empty or returns.isna().all():
        return np.nan
    r = returns.fillna(0.0)
    cum = (1 + r).cumprod()
    peak = cum.cummax()
    dd = cum / peak - 1.0
    return float(dd.min())


def summarize_forward_returns(
    fwd: pd.Series,
) -> dict:
    r = fwd.dropna()
    if r.empty:
        return {
            "n": 0,
            "mean": np.nan,
            "median": np.nan,
            "win_rate": np.nan,
            "max_dd": np.nan,
        }
    pos = (r > 0).mean()
    return {
        "n": int(len(r)),
        "mean": float(r.mean()),
        "median": float(r.median()),
        "win_rate": float(pos),
        "max_dd": max_drawdown(r),
    }
