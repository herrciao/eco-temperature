"""Rule-based macro regime from composite scores."""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import REGIME_THRESHOLDS, RegimeThresholds


REGIME_LABELS = [
    "expansion",
    "recovery",
    "overheating",
    "stagflation_risk",
    "contraction",
    "neutral",
]


def classify_regime_row(
    growth: float,
    inflation: float,
    liquidity: float,
    growth_delta_4w: float,
    thr: RegimeThresholds = REGIME_THRESHOLDS,
) -> str:
    g = growth
    inf = inflation
    liq = liquidity
    gd = growth_delta_4w

    if g > thr.growth_high and inf > thr.inflation_high:
        return "overheating"
    if g > thr.growth_high and inf <= thr.inflation_high:
        return "expansion"
    if g < 0 and inf > thr.inflation_high:
        return "stagflation_risk"
    if g < thr.growth_low and liq < thr.liquidity_low:
        return "contraction"
    if thr.recovery_growth_min < g <= thr.growth_high and gd > 0:
        return "recovery"
    return "neutral"


def classify_regime_series(df: pd.DataFrame) -> pd.Series:
    thr = REGIME_THRESHOLDS
    out = []
    for idx in df.index:
        g = float(df.loc[idx, "growth_score"])
        inf = float(df.loc[idx, "inflation_score"])
        liq = float(df.loc[idx, "liquidity_score"])
        gd = float(df.loc[idx, "growth_score_delta_4w"]) if "growth_score_delta_4w" in df.columns else 0.0
        if np.isnan(gd):
            gd = 0.0
        out.append(classify_regime_row(g, inf, liq, gd, thr))
    return pd.Series(out, index=df.index, name="regime")


def add_regime(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["regime"] = classify_regime_series(out)
    return out
