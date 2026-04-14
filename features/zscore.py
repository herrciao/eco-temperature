"""Rolling z-scores for levels and for selected columns."""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import ZSCORE_WINDOW_WEEKS


def rolling_zscore(s: pd.Series, window: int = ZSCORE_WINDOW_WEEKS) -> pd.Series:
    m = s.rolling(window, min_periods=max(8, window // 4))
    mu = m.mean()
    sigma = m.std()
    z = (s - mu) / sigma.replace(0, np.nan)
    return z


def add_zscore(
    df: pd.DataFrame,
    col: str,
    out_name: str,
    window: int = ZSCORE_WINDOW_WEEKS,
) -> pd.DataFrame:
    out = df.copy()
    out[out_name] = rolling_zscore(df[col], window)
    return out
