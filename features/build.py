"""Build full feature matrix from weekly panel."""
from __future__ import annotations

import pandas as pd

from config import MOM_WEEKS, ZSCORE_WINDOW_WEEKS
from features.momentum import add_momentum, add_momentum_many
from features.trend import add_sma
from features.zscore import rolling_zscore


def build_feature_matrix(weekly: pd.DataFrame) -> pd.DataFrame:
    """Compute momentum, SMAs, z-scores needed for composite scores."""
    df = weekly.copy()

    mom_specs = [
        ("copper_fut", "copper"),
        ("bdry", "bdry"),
        ("wti", "wti"),
        ("dff", "dff"),
        ("t10y2y", "curve"),
        ("dxy_broad", "dxy"),
        ("unrate", "unrate"),
        ("nfp_change", "nfp"),
    ]
    df = add_momentum_many(df, mom_specs)

    for col, prefix in [
        ("copper_fut", "copper"),
        ("bdry", "bdry"),
        ("wti", "wti"),
        ("t10y2y", "curve"),
        ("dxy_broad", "dxy"),
    ]:
        if col in df.columns:
            df = add_sma(df, col, prefix=prefix)

    # Z-scores on key momentum and levels
    w3 = MOM_WEEKS["3m"]

    df["copper_mom3_z"] = rolling_zscore(df[f"copper_mom_3m"], ZSCORE_WINDOW_WEEKS)
    df["bdry_mom1_z"] = rolling_zscore(df[f"bdry_mom_1m"], ZSCORE_WINDOW_WEEKS)
    df["wti_mom3_z"] = rolling_zscore(df[f"wti_mom_3m"], ZSCORE_WINDOW_WEEKS)
    df["nfp_change_z"] = rolling_zscore(df["nfp_change"], ZSCORE_WINDOW_WEEKS)

    # Unemployment: lower is better -> invert level change (3m rise in unrate is bad)
    df["unrate_mom_3m"] = (df["unrate"] / df["unrate"].shift(w3) - 1.0) * 100.0
    df["unrate_trend_inv_z"] = -rolling_zscore(df["unrate_mom_3m"], ZSCORE_WINDOW_WEEKS)

    df["fed_level_z"] = rolling_zscore(df["dff"], ZSCORE_WINDOW_WEEKS)
    df["dff_change_4w"] = df["dff"] - df["dff"].shift(4)
    df["fed_change_inv_z"] = -rolling_zscore(df["dff_change_4w"], ZSCORE_WINDOW_WEEKS)

    df["curve_z"] = rolling_zscore(df["t10y2y"], ZSCORE_WINDOW_WEEKS)
    df["dxy_mom3"] = df["dxy_mom_3m"]
    df["dxy_mom_inv_z"] = -rolling_zscore(df["dxy_mom3"], ZSCORE_WINDOW_WEEKS)

    # Curve slope (steepening): 3m change in spread
    df["curve_mom_3m_abs"] = df["t10y2y"] - df["t10y2y"].shift(w3)

    # v2 Phase 1: Durable Goods New Orders MoM% — z-score
    if "durable_goods_mom" in df.columns:
        df["durable_goods_z"] = rolling_zscore(df["durable_goods_mom"], ZSCORE_WINDOW_WEEKS)

    # v2 Phase 1: Breakeven 10Y — 3M momentum z-score
    if "breakeven_10y" in df.columns:
        df = add_momentum(df, "breakeven_10y", prefix="bke")
        df["breakeven_z"] = rolling_zscore(df["bke_mom_3m"], ZSCORE_WINDOW_WEEKS)

    # v2 Phase 1: HY OAS — level z-score, inverted (wider spread = tighter liquidity)
    if "hy_oas" in df.columns:
        df["hy_oas_inv_z"] = -rolling_zscore(df["hy_oas"], ZSCORE_WINDOW_WEEKS)

    # v2 Phase 1: Real Yield 10Y — level z-score, inverted (higher = tighter)
    if "real_yield_10y" in df.columns:
        df["real_yield_inv_z"] = -rolling_zscore(df["real_yield_10y"], ZSCORE_WINDOW_WEEKS)

    return df
