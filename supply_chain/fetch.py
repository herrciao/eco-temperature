"""Fetch supply chain and demand-side tickers from Yahoo Finance → SQLite."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import pandas as pd

from config import (
    DB_PATH,
    DEMAND_ALL_TICKERS,
    SUPPLY_CHAIN_ALL_TICKERS,
    SUPPLY_CHAIN_START,
)
from data.sources import fetch_yahoo_history
from data.store import connect, init_schema, upsert_series


def _series_name(ticker: str) -> str:
    """Normalize ticker to a SQLite-friendly series name."""
    return "sc_" + ticker.replace(".", "_").replace("=", "_").lower()


def fetch_supply_chain_raw(
    db_path: Path | None = None,
    start: str = SUPPLY_CHAIN_START,
    end: Optional[str] = None,
    throttle: float = 0.5,
) -> dict[str, bool]:
    """
    Fetch all demand + supply chain tickers and store in SQLite.

    Returns a dict of {ticker: success} to report any failures.
    """
    if db_path is None:
        db_path = DB_PATH

    conn = connect(db_path)
    init_schema(conn)

    all_tickers = list(dict.fromkeys(DEMAND_ALL_TICKERS + SUPPLY_CHAIN_ALL_TICKERS))
    results: dict[str, bool] = {}

    for i, ticker in enumerate(all_tickers):
        name = _series_name(ticker)
        try:
            s = fetch_yahoo_history(ticker, start=start, end=end)
            if s.empty:
                print(f"  [WARN] {ticker}: no data returned")
                results[ticker] = False
            else:
                upsert_series(conn, name, s, source="yahoo")
                results[ticker] = True
                print(f"  [{i+1}/{len(all_tickers)}] {ticker}: {len(s)} rows")
        except Exception as exc:
            print(f"  [ERROR] {ticker}: {exc}")
            results[ticker] = False

        if throttle > 0:
            time.sleep(throttle)

    conn.close()
    return results


def load_ticker_weekly(
    conn,
    ticker: str,
    weekly_index: pd.DatetimeIndex,
) -> pd.Series:
    """Load a supply chain ticker from SQLite and align to weekly index."""
    from data.store import load_series
    from data.align import _daily_to_weekly_last

    name = _series_name(ticker)
    s = load_series(conn, name)
    if s.empty:
        return pd.Series(index=weekly_index, dtype=float, name=ticker)
    return _daily_to_weekly_last(s, weekly_index)
