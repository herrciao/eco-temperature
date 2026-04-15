"""Compute equal-weight basket indices for demand and supply chain groups."""
from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd

from config import DEMAND_TICKERS, SUPPLY_CHAIN_GROUPS
from supply_chain.fetch import load_ticker_weekly


def _equal_weight_index(price_df: pd.DataFrame) -> pd.Series:
    """
    Compute an equal-weight price index from a DataFrame of prices.

    Each column is normalized to 100 at its first non-NaN value, then averaged.
    Columns with all-NaN are excluded.
    """
    normed = pd.DataFrame(index=price_df.index)
    for col in price_df.columns:
        s = price_df[col].dropna()
        if s.empty:
            continue
        first_valid = s.iloc[0]
        if first_valid == 0 or np.isnan(first_valid):
            continue
        normed[col] = price_df[col] / first_valid * 100.0

    if normed.empty:
        return pd.Series(index=price_df.index, dtype=float)

    return normed.mean(axis=1)


def build_all_baskets(
    conn: sqlite3.Connection,
    weekly_index: pd.DatetimeIndex,
) -> dict[str, dict]:
    """
    Build all demand indices and supply chain basket indices.

    Returns:
        {
          "demand": {
            "consumer_electronics": pd.Series,
            "cloud_hyperscaler": pd.Series,
            "ai_compute": pd.Series,
          },
          "baskets": {
            "A_foundry": pd.Series,
            ...
          },
          "demand_members": { group_key: [(ticker, display_name), ...] },
          "basket_members": { group_key: [(ticker, display_name), ...] },
        }
    """
    demand_series: dict[str, pd.Series] = {}
    demand_members: dict[str, list] = {}

    for group_key, tickers in DEMAND_TICKERS.items():
        prices = pd.DataFrame(
            {t: load_ticker_weekly(conn, t, weekly_index) for t in tickers}
        )
        demand_series[group_key] = _equal_weight_index(prices)
        demand_series[group_key].name = group_key
        demand_members[group_key] = [(t, t) for t in tickers]

    basket_series: dict[str, pd.Series] = {}
    basket_members: dict[str, list] = {}

    for group_key, group_def in SUPPLY_CHAIN_GROUPS.items():
        members = group_def["members"]
        prices = pd.DataFrame(
            {ticker: load_ticker_weekly(conn, ticker, weekly_index)
             for ticker, _ in members}
        )
        basket_series[group_key] = _equal_weight_index(prices)
        basket_series[group_key].name = group_key
        basket_members[group_key] = members

    return {
        "demand": demand_series,
        "baskets": basket_series,
        "demand_members": demand_members,
        "basket_members": basket_members,
    }


def weekly_returns(prices: pd.Series) -> pd.Series:
    """Compute weekly percentage returns from a price series."""
    return prices.pct_change()


def rolling_momentum(prices: pd.Series, weeks: int) -> pd.Series:
    """N-week price momentum as a percentage."""
    shifted = prices.shift(weeks)
    return (prices / shifted - 1.0) * 100.0
