"""
Fetch free-tier market series: FRED + Yahoo Finance + computed spreads.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from fredapi import Fred

from srpkg.envutil import getenv_api_key
from srpkg.settings import (
    PACK_ROOT,
    Instrument,
    default_instruments,
)

from .extra_fetch import (
    fetch_eia_weekly_stocks_v2,
    fetch_lme_copper_stock_westmetall,
    fetch_tw_export_orders_moea_csv,
)

REPO_ROOT = PACK_ROOT.parent
load_dotenv(REPO_ROOT / ".env")
load_dotenv()


@dataclass
class FetchBundle:
    fred_daily: Dict[str, pd.Series]
    fred_monthly: Dict[str, pd.Series]
    yahoo: Dict[str, pd.Series]


def _fred() -> Fred:
    key = getenv_api_key("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY missing in .env (free key from FRED)")
    return Fred(api_key=key)


def _trim_daily(s: pd.Series, max_days: int = 900) -> pd.Series:
    s = s.sort_index().astype(float)
    if len(s) == 0:
        return s
    end = s.index.max()
    start = end - pd.Timedelta(days=max_days)
    return s[s.index >= start]


def fetch_fred_series(
    series_ids: set[str],
    *,
    daily_ids: set[str],
    monthly_ids: set[str],
    lookback_monthly_start: str = "2000-01-01",
) -> Tuple[Dict[str, pd.Series], Dict[str, pd.Series]]:
    f = _fred()
    daily: Dict[str, pd.Series] = {}
    monthly: Dict[str, pd.Series] = {}
    warn: List[str] = []
    for sid in sorted(daily_ids & series_ids):
        try:
            s = f.get_series(sid)
            daily[sid] = _trim_daily(s)
        except Exception as e:  # noqa: BLE001
            warn.append(f"FRED daily {sid}: {e}")
    for sid in sorted(monthly_ids & series_ids):
        try:
            s = f.get_series(sid, observation_start=lookback_monthly_start)
            monthly[sid] = s.sort_index().astype(float)
        except Exception as e:  # noqa: BLE001
            warn.append(f"FRED monthly {sid}: {e}")
    for msg in warn:
        print(msg)
    return daily, monthly


def fetch_yahoo(tickers: set[str], period: str = "2y", interval: str = "1d") -> Dict[str, pd.Series]:
    out: Dict[str, pd.Series] = {}
    if not tickers:
        return out
    tick_list = sorted(tickers)
    data = yf.download(
        tick_list,
        period=period,
        interval=interval,
        group_by="ticker",
        auto_adjust=True,
        threads=True,
        progress=False,
    )
    if len(tick_list) == 1:
        t = tick_list[0]
        if isinstance(data.columns, pd.MultiIndex):
            ser = data[(t, "Close")].dropna().astype(float)
        else:
            ser = data["Close"].dropna().astype(float)
        out[t] = ser
        return out
    for t in tick_list:
        try:
            if isinstance(data.columns, pd.MultiIndex) and (t, "Close") in data.columns:
                ser = data[(t, "Close")].dropna().astype(float)
            else:
                continue
            out[t] = ser
        except (KeyError, TypeError, ValueError):
            continue
    return out


def collect_series_for_instruments(
    instruments: Optional[List[Instrument]] = None,
) -> Tuple[FetchBundle, pd.DataFrame, pd.DataFrame]:
    inst_list = instruments or default_instruments()
    fred_daily_ids: set[str] = set()
    fred_monthly_ids: set[str] = set()
    yahoo_tickers: set[str] = set()

    for inst in inst_list:
        if inst.source in ("placeholder", "tw_moea_csv", "eia_v2", "westmetall_lme"):
            continue
        if inst.source == "fred" and inst.primary:
            if inst.fred_frequency == "daily":
                fred_daily_ids.add(inst.primary)
            else:
                fred_monthly_ids.add(inst.primary)
        if inst.source == "yahoo" and inst.primary:
            yahoo_tickers.add(inst.primary)

    need_wti_brent = any(
        i.source == "computed" and i.primary == "spread_wti_brent" for i in inst_list
    )
    need_tsm = any(
        i.source == "computed" and i.primary == "tsm_adr_tw_premium" for i in inst_list
    )
    need_payems_mom = any(
        i.source == "computed" and i.primary == "payems_mom_diff" for i in inst_list
    )
    if need_wti_brent:
        fred_daily_ids.update({"DCOILWTICO", "DCOILBRENTEU"})
    if need_tsm:
        yahoo_tickers.update({"TSM", "2330.TW"})
    if need_payems_mom:
        fred_monthly_ids.add("PAYEMS")

    all_fred = fred_daily_ids | fred_monthly_ids
    fd, fm = fetch_fred_series(all_fred, daily_ids=fred_daily_ids, monthly_ids=fred_monthly_ids)
    yd = fetch_yahoo(set(yahoo_tickers))

    parts = []
    for name, ser in fd.items():
        parts.append(ser.rename(name).to_frame())
    for t, ser in yd.items():
        parts.append(ser.rename(t).to_frame())
    wide = pd.concat(parts, axis=1).sort_index() if parts else pd.DataFrame()

    if "DCOILWTICO" in wide.columns and "DCOILBRENTEU" in wide.columns:
        wide["spread_wti_brent"] = wide["DCOILWTICO"] - wide["DCOILBRENTEU"]

    if "TSM" in wide.columns and "2330.TW" in wide.columns:
        tsm = wide["TSM"].astype(float)
        tw = wide["2330.TW"].astype(float)
        n_tsm = tsm / tsm.rolling(60, min_periods=20).mean()
        n_tw = tw / tw.rolling(60, min_periods=20).mean()
        wide["tsm_adr_tw_premium"] = (n_tsm - n_tw) * 100.0

    monthly_parts = []
    for name, ser in fm.items():
        monthly_parts.append(ser.rename(name).to_frame())
    monthly_wide = (
        pd.concat(monthly_parts, axis=1).sort_index() if monthly_parts else pd.DataFrame()
    )

    try:
        tw = fetch_tw_export_orders_moea_csv()
        monthly_wide = monthly_wide.join(tw.to_frame(), how="outer")
    except Exception as e:  # noqa: BLE001
        print(f"MOEA Taiwan export orders: {e}")

    if need_payems_mom and "PAYEMS" in monthly_wide.columns:
        monthly_wide["payems_mom_diff"] = monthly_wide["PAYEMS"].diff()

    for inst in inst_list:
        if inst.source != "eia_v2" or not inst.secondary or not inst.primary:
            continue
        try:
            eia_ser = fetch_eia_weekly_stocks_v2(inst.secondary)
            if eia_ser.empty:
                continue
            col = inst.primary
            wide = wide.join(eia_ser.rename(col), how="outer")
        except Exception as e:  # noqa: BLE001
            print(f"EIA {inst.secondary}: {e}")

    try:
        lme = fetch_lme_copper_stock_westmetall()
        if not lme.empty:
            colname = "lme_copper_stock"
            wide = wide.join(lme.rename(colname), how="outer")
    except Exception as e:  # noqa: BLE001
        print(f"LME copper stocks (Westmetall): {e}")

    wide = wide.sort_index()
    monthly_wide = monthly_wide.sort_index()
    for c in wide.columns:
        if c.startswith("eia_"):
            wide[c] = wide[c].ffill()

    bundle = FetchBundle(fred_daily=fd, fred_monthly=fm, yahoo=yd)
    return bundle, wide, monthly_wide


def resolve_series_for_instrument(
    inst: Instrument,
    wide_daily: pd.DataFrame,
    monthly_wide: pd.DataFrame,
) -> Optional[pd.Series]:
    if inst.source == "placeholder":
        return None
    key = inst.primary
    if not key:
        return None
    if inst.source == "tw_moea_csv":
        if key in monthly_wide.columns:
            return monthly_wide[key].dropna()
        return None
    if inst.source == "eia_v2":
        if key in wide_daily.columns:
            return wide_daily[key].dropna()
        return None
    if inst.source == "westmetall_lme":
        if key in wide_daily.columns:
            return wide_daily[key].dropna()
        return None
    if inst.source == "computed" or inst.source == "yahoo":
        if key in wide_daily.columns:
            return wide_daily[key].dropna()
        if inst.source == "computed" and inst.fred_frequency == "monthly" and key in monthly_wide.columns:
            return monthly_wide[key].dropna()
    if inst.source == "fred":
        if inst.fred_frequency == "daily" and key in wide_daily.columns:
            return wide_daily[key].dropna()
        if inst.fred_frequency == "monthly" and key in monthly_wide.columns:
            return monthly_wide[key].dropna()
    return None
