"""Align mixed-frequency series to a common weekly (Friday) timeline.

Avoids look-ahead bias for monthly data by assigning each observation
an approximate availability date (month-end + lag) before merge_asof.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from config import WEEK_ANCHOR
from data.store import load_series


# Days after month-end before BLS-style data is assumed available (conservative)
MONTHLY_RELEASE_LAG_DAYS = 35


def _week_range(start: pd.Timestamp, end: pd.Timestamp) -> pd.DatetimeIndex:
    return pd.date_range(start=start, end=end, freq=WEEK_ANCHOR)


def _daily_to_weekly_last(s: pd.Series, weekly_index: pd.DatetimeIndex) -> pd.Series:
    """Resample daily to weekly (Friday), last observation; reindex to full weekly index."""
    if s.empty:
        return pd.Series(index=weekly_index, dtype=float)
    s = s.sort_index()
    w = s.resample(WEEK_ANCHOR).last()
    return w.reindex(weekly_index).ffill()


def _monthly_obs_to_avail_index(monthly: pd.Series) -> pd.DataFrame:
    """Map each monthly point to an availability timestamp."""
    monthly = monthly.dropna().sort_index()
    if monthly.empty:
        return pd.DataFrame(columns=["avail", "value"])
    month_end = monthly.index.to_period("M").to_timestamp(how="end")
    avail = month_end + pd.Timedelta(days=MONTHLY_RELEASE_LAG_DAYS)
    return pd.DataFrame({"avail": avail, "value": monthly.values}).sort_values(
        "avail"
    )


def _merge_monthly_to_weekly(
    monthly: pd.Series,
    weekly_index: pd.DatetimeIndex,
) -> pd.Series:
    r = _monthly_obs_to_avail_index(monthly)
    if r.empty:
        return pd.Series(index=weekly_index, dtype=float)
    w = pd.DataFrame({"week_end": weekly_index}).sort_values("week_end")
    merged = pd.merge_asof(
        w,
        r,
        left_on="week_end",
        right_on="avail",
        direction="backward",
    )
    return pd.Series(
        merged["value"].values,
        index=pd.to_datetime(merged["week_end"]),
        name=monthly.name,
    ).sort_index()


def build_weekly_panel(
    conn: sqlite3.Connection,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> pd.DataFrame:
    """
    Load raw series from DB and return a weekly DataFrame (Friday index).

    Columns:
      copper_fut, bdry, wti, dff, t10y2y, dxy_broad,
      payems, unrate, nfp_change (monthly diff of PAYEMS, thousands),
      copper_spot_monthly (optional backup)
    """
    def ld(name: str) -> pd.Series:
        return load_series(conn, name)

    copper = ld("copper_fut")
    bdry = ld("bdry")
    wti = ld("wti")
    dff = ld("dff")
    t10y2y = ld("t10y2y")
    dxy = ld("dxy_broad")
    payems = ld("payems")
    unrate = ld("unrate")
    cspot = ld("copper_spot_monthly")

    # Determine date bounds from available data
    all_idx = []
    for s in (copper, bdry, wti, dff, t10y2y, dxy, payems, unrate):
        if not s.empty:
            all_idx.extend([s.index.min(), s.index.max()])
    if not all_idx:
        return pd.DataFrame()

    t0 = max(pd.Timestamp(min(all_idx)), pd.Timestamp(start) if start else pd.Timestamp(min(all_idx)))
    t1 = min(pd.Timestamp(max(all_idx)), pd.Timestamp(end) if end else pd.Timestamp(max(all_idx)))
    weekly_index = _week_range(t0, t1)

    out = pd.DataFrame(index=weekly_index)
    out.index.name = "week_end"

    out["copper_fut"] = _daily_to_weekly_last(copper, weekly_index)
    out["bdry"] = _daily_to_weekly_last(bdry, weekly_index)
    out["wti"] = _daily_to_weekly_last(wti, weekly_index)
    out["dff"] = _daily_to_weekly_last(dff, weekly_index)
    out["t10y2y"] = _daily_to_weekly_last(t10y2y, weekly_index)
    out["dxy_broad"] = _daily_to_weekly_last(dxy, weekly_index)

    # Monthly with availability lag
    nfp_monthly = payems.diff()  # change in thousands
    nfp_monthly.name = "nfp_change"
    out["payems"] = _merge_monthly_to_weekly(payems, weekly_index)
    out["nfp_change"] = _merge_monthly_to_weekly(nfp_monthly, weekly_index)
    out["unrate"] = _merge_monthly_to_weekly(unrate, weekly_index)

    if not cspot.empty:
        out["copper_spot_monthly"] = _merge_monthly_to_weekly(cspot, weekly_index)

    # v2 Phase 1: new macro series
    dg = ld("durable_goods")
    bke = ld("breakeven_10y")
    hy = ld("hy_oas")
    ry = ld("real_yield_10y")

    out["breakeven_10y"] = _daily_to_weekly_last(bke, weekly_index)
    out["hy_oas"] = _daily_to_weekly_last(hy, weekly_index)
    out["real_yield_10y"] = _daily_to_weekly_last(ry, weekly_index)
    # Durable Goods: store MoM % change (level is in millions $, not comparable over time)
    dg_pct = dg.pct_change() * 100.0
    dg_pct.name = "durable_goods_mom"
    out["durable_goods_mom"] = _merge_monthly_to_weekly(dg_pct, weekly_index)

    # ETF columns
    for sym in ["spy", "qqq", "xli", "xle", "iwm", "tlt"]:
        etf = ld(f"etf_{sym}")
        out[f"etf_{sym}"] = _daily_to_weekly_last(etf, weekly_index)

    return out.sort_index()
