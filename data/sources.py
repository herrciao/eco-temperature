"""Download macro data from FRED and Yahoo Finance."""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf

from config import BACKTEST_ETFS, FRED_SERIES, YAHOO_TICKERS
from data.store import connect, init_schema, set_meta, upsert_series


def _fred_client():
    try:
        from fredapi import Fred
    except ImportError as e:
        raise RuntimeError("Install fredapi and set FRED_API_KEY in .env") from e
    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY not set in environment")
    return Fred(api_key=key)


def fetch_fred_series(
    series_id: str,
    start: str,
    end: Optional[str] = None,
) -> pd.Series:
    fred = _fred_client()
    kwargs = {"observation_start": start}
    if end:
        kwargs["observation_end"] = end
    data = fred.get_series(series_id, **kwargs)
    if isinstance(data, pd.DataFrame):
        data = data.iloc[:, 0]
    s = pd.Series(data, name=series_id)
    s.index = pd.to_datetime(s.index)
    return s.astype(float).sort_index()


def fetch_yahoo_history(
    ticker: str,
    start: str,
    end: Optional[str] = None,
) -> pd.Series:
    t = yf.Ticker(ticker)
    df = t.history(start=start, end=end, auto_adjust=True)
    if df.empty:
        return pd.Series(dtype=float, name=ticker)
    # Use Close (auto_adjust already applied)
    s = df["Close"].copy()
    s.index = pd.to_datetime(s.index).tz_localize(None)
    s.name = ticker
    return s.sort_index()


def fetch_all_raw(
    db_path: Path,
    start: str,
    end: Optional[str] = None,
) -> None:
    """Download all configured series and store in SQLite."""
    conn = connect(db_path)
    init_schema(conn)

    # FRED (WTI excluded — Yahoo CL=F used instead for better timeliness)
    logical_to_fred = {
        "payems": FRED_SERIES["payems"],
        "unrate": FRED_SERIES["unrate"],
        "dff": FRED_SERIES["dff"],
        "t10y2y": FRED_SERIES["t10y2y"],
        "dxy_broad": FRED_SERIES["dxy_broad"],
        "copper_spot_monthly": FRED_SERIES["copper_spot_monthly"],
        "durable_goods": FRED_SERIES["durable_goods"],
        "breakeven_10y": FRED_SERIES["breakeven_10y"],
        "hy_oas": FRED_SERIES["hy_oas"],
        "real_yield_10y": FRED_SERIES["real_yield_10y"],
    }
    for name, sid in logical_to_fred.items():
        s = fetch_fred_series(sid, start, end)
        upsert_series(conn, name, s, source="fred")

    # Yahoo: copper fut, BDRY, WTI (CL=F)
    for name, tkr in YAHOO_TICKERS.items():
        s = fetch_yahoo_history(tkr, start, end)
        upsert_series(conn, name, s, source="yahoo")

    # ETFs for backtest
    for sym in BACKTEST_ETFS:
        s = fetch_yahoo_history(sym, start, end)
        upsert_series(conn, f"etf_{sym.lower()}", s, source="yahoo")

    set_meta(conn, "last_fetch_start", start)
    set_meta(conn, "last_fetch_end", end or datetime.utcnow().strftime("%Y-%m-%d"))
    set_meta(conn, "last_fetch_utc", datetime.utcnow().isoformat() + "Z")
    conn.close()
