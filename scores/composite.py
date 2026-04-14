"""Composite scores: Growth, Inflation, Liquidity, Risk."""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import (
    GROWTH_W,
    INFLATION_W,
    LIQUIDITY_W,
    RISK_W,
)


def _safe_series(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        return pd.Series(0.0, index=df.index)
    return df[col].fillna(0.0)


def compute_composite_scores(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    g = (
        GROWTH_W.copper_mom3_z * _safe_series(out, "copper_mom3_z")
        + GROWTH_W.bdry_mom1_z * _safe_series(out, "bdry_mom1_z")
        + GROWTH_W.nfp_change_z * _safe_series(out, "nfp_change_z")
        + GROWTH_W.unrate_trend_inv_z * _safe_series(out, "unrate_trend_inv_z")
        + GROWTH_W.durable_goods_z * _safe_series(out, "durable_goods_z")
    )
    # Normalize roughly to [-1, 1]
    out["growth_score"] = np.tanh(g / 2.0)
    out["growth_score_delta_4w"] = out["growth_score"] - out["growth_score"].shift(4)

    inf = (
        INFLATION_W.wti_mom3_z * _safe_series(out, "wti_mom3_z")
        + INFLATION_W.copper_mom3_z * _safe_series(out, "copper_mom3_z")
        + INFLATION_W.breakeven_z * _safe_series(out, "breakeven_z")
    )
    out["inflation_score"] = np.tanh(inf / 2.0)

    liq = (
        LIQUIDITY_W.fed_change_inv_z * _safe_series(out, "fed_change_inv_z")
        + LIQUIDITY_W.curve_z * _safe_series(out, "curve_z")
        + LIQUIDITY_W.dxy_mom_inv_z * _safe_series(out, "dxy_mom_inv_z")
        + LIQUIDITY_W.hy_oas_inv_z * _safe_series(out, "hy_oas_inv_z")
        + LIQUIDITY_W.real_yield_inv_z * _safe_series(out, "real_yield_inv_z")
    )
    out["liquidity_score"] = np.tanh(liq / 2.0)

    # Risk: tilt toward growth and liquidity, away from inflation pressure
    r = (
        RISK_W.growth * out["growth_score"]
        + RISK_W.inflation_inv * (-out["inflation_score"])
        + RISK_W.liquidity * out["liquidity_score"]
    )
    # small curve steepening boost
    curve_slope = np.tanh(_safe_series(out, "curve_mom_3m_abs") * 2.0)
    out["risk_score"] = np.tanh(r + 0.1 * curve_slope)

    # Macro temperature 0-100
    blend = (
        out["growth_score"]
        - 0.5 * out["inflation_score"]
        + 0.5 * out["liquidity_score"]
        + 0.5 * out["risk_score"]
    )
    out["macro_temperature"] = ((np.tanh(blend) + 1.0) / 2.0 * 100.0).clip(0, 100)

    return out
