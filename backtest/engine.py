"""Regime and event backtests on ETF forward returns."""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

from config import BACKTEST_ETFS, EVENT_RULES, TRAIN_FRAC
from backtest.metrics import summarize_forward_returns


FORWARD_WEEKS = {"1m": 4, "3m": 13, "6m": 26}


def _etf_col(sym: str) -> str:
    return f"etf_{sym.lower()}"


def forward_total_return(
    price: pd.Series,
    horizon_weeks: int,
) -> pd.Series:
    """Simple forward return from week t to t+h (using last available price)."""
    fut = price.shift(-horizon_weeks)
    return (fut / price - 1.0).astype(float)


def regime_backtest(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Returns:
      summary: MultiIndex (regime, etf, horizon) -> metrics
      train_test_split row counts for sanity
    """
    rows = []
    n = len(df)
    split = int(n * TRAIN_FRAC)
    idx_train = df.index[:split]
    idx_test = df.index[split:]

    for regime_name in df["regime"].dropna().unique():
        sub = df[df["regime"] == regime_name]
        for sym in BACKTEST_ETFS:
            col = _etf_col(sym)
            if col not in df.columns:
                continue
            px = df[col]
            for hlabel, hw in FORWARD_WEEKS.items():
                fwd = forward_total_return(px, hw)
                r_all = fwd.loc[sub.index]
                r_train = fwd.loc[sub.index.intersection(idx_train)]
                r_test = fwd.loc[sub.index.intersection(idx_test)]

                for split_name, r in [("all", r_all), ("train", r_train), ("test", r_test)]:
                    m = summarize_forward_returns(r)
                    rows.append(
                        {
                            "regime": regime_name,
                            "etf": sym,
                            "horizon": hlabel,
                            "split": split_name,
                            **m,
                        }
                    )

    summary = pd.DataFrame(rows)
    split_info = pd.DataFrame(
        {
            "train_weeks": [len(idx_train)],
            "test_weeks": [len(idx_test)],
        }
    )
    return summary, split_info


def _eval_condition(series: pd.Series, op: str, thresh: float) -> pd.Series:
    s = series.astype(float)
    if op == ">":
        return s > thresh
    if op == "<":
        return s < thresh
    if op == ">=":
        return s >= thresh
    if op == "<=":
        return s <= thresh
    raise ValueError(op)


def event_backtest(df: pd.DataFrame) -> pd.DataFrame:
    """Evaluate EVENT_RULES on df (must have momentum columns)."""
    rows: List[Dict[str, Any]] = []
    col_map = {
        "copper_mom_3m_pct": "copper_mom_3m",
        "bdry_mom_1m_pct": "bdry_mom_1m",
        "t10y2y_mom_3m_abs": "curve_mom_3m_abs",
    }

    for rule in EVENT_RULES:
        name = rule["name"]
        conds = rule["conditions"]
        mask = pd.Series(True, index=df.index)
        for key, (op, thresh) in conds.items():
            cname = col_map.get(key, key)
            if cname not in df.columns:
                mask = pd.Series(False, index=df.index)
                break
            mask = mask & _eval_condition(df[cname], op, thresh)

        hits = df.loc[mask]
        for sym in BACKTEST_ETFS:
            col = _etf_col(sym)
            if col not in df.columns:
                continue
            px = df[col]
            for hlabel, hw in FORWARD_WEEKS.items():
                fwd = forward_total_return(px, hw)
                r = fwd.loc[hits.index]
                m = summarize_forward_returns(r)
                rows.append(
                    {
                        "event": name,
                        "etf": sym,
                        "horizon": hlabel,
                        "hits": int(mask.sum()),
                        **m,
                    }
                )

    return pd.DataFrame(rows)
