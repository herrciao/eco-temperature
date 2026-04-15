"""
Rolling cross-correlation lead-lag analysis for demand × supply chain pairs.

For each pair (demand_index, basket_index):
  - Rolling window Pearson cross-correlation at each lag in [-max_lag, +max_lag]
  - Positive lag = demand leads basket (US leads TW)
  - Negative lag = basket leads demand (TW leads US)
  - Segments continuous phases with narrative generation
"""
from __future__ import annotations

import numpy as np
import pandas as pd


# ─── Core cross-correlation ──────────────────────────────────────────────────

def _pearson(a: np.ndarray, b: np.ndarray) -> float:
    mask = ~(np.isnan(a) | np.isnan(b))
    n = mask.sum()
    if n < 8:
        return np.nan
    a, b = a[mask], b[mask]
    da, db = a - a.mean(), b - b.mean()
    denom = np.sqrt((da**2).sum() * (db**2).sum())
    if denom == 0:
        return np.nan
    return float(np.dot(da, db) / denom)


def _weekly_returns(prices: pd.Series) -> np.ndarray:
    p = prices.values.astype(float)
    ret = np.full(len(p), np.nan)
    with np.errstate(divide="ignore", invalid="ignore"):
        ret[1:] = np.where(p[:-1] > 0, p[1:] / p[:-1] - 1.0, np.nan)
    return ret


def rolling_best_lag(
    demand: pd.Series,
    basket: pd.Series,
    window: int = 26,
    max_lag: int = 12,
) -> pd.DataFrame:
    """
    For each week, find the lag in [-max_lag, +max_lag] that maximises the
    Pearson correlation between demand returns and basket returns within a
    rolling window.

    Returns a DataFrame with columns:
        best_lag  : int, positive = demand leads basket
        best_corr : float, correlation at best_lag
        type      : str, one of "us_lead", "tw_lead", "sync", "weak"
    """
    demand_ret = _weekly_returns(demand)
    basket_ret = _weekly_returns(basket)
    n = len(demand_ret)

    lags = range(-max_lag, max_lag + 1)
    best_lags = np.zeros(n, dtype=int)
    best_corrs = np.zeros(n, dtype=float)

    half = window // 2

    for center in range(n):
        w0 = max(0, center - half)
        w1 = min(n, center + half)

        best_lag = 0
        best_r = -2.0

        for lag in lags:
            # demand[i] vs basket[i + lag]  →  positive lag means demand leads
            i_start = max(w0, w0 - lag)
            i_end = min(w1, w1 - lag)
            if i_end - i_start < 8:
                continue
            a = demand_ret[i_start:i_end]
            j0, j1 = i_start + lag, i_end + lag
            if j0 < 0 or j1 > n:
                continue
            b = basket_ret[j0:j1]
            r = _pearson(a, b)
            if not np.isnan(r) and r > best_r:
                best_r = r
                best_lag = lag

        best_lags[center] = best_lag
        best_corrs[center] = best_r if best_r > -2.0 else 0.0

    type_labels = _classify(best_lags, best_corrs)

    return pd.DataFrame(
        {"best_lag": best_lags, "best_corr": best_corrs, "type": type_labels},
        index=demand.index,
    )


def _classify(lags: np.ndarray, corrs: np.ndarray) -> list[str]:
    types = []
    for lag, corr in zip(lags, corrs):
        if corr < 0.2:
            types.append("weak")
        elif abs(lag) <= 1:
            types.append("sync")
        elif lag > 0:
            types.append("us_lead")
        else:
            types.append("tw_lead")
    return types


# ─── Phase segmentation ──────────────────────────────────────────────────────

def segment_phases(
    result: pd.DataFrame,
    min_duration: int = 4,
) -> list[dict]:
    """
    Group consecutive weeks with the same type into phases.
    Short phases (< min_duration) are merged into their neighbor.
    """
    if result.empty:
        return []

    types = result["type"].tolist()
    lags = result["best_lag"].tolist()
    corrs = result["best_corr"].tolist()
    dates = result.index.strftime("%Y-%m-%d").tolist()

    phases = []
    cur = {
        "type": types[0], "start": 0, "end": 0,
        "lags": [lags[0]], "corrs": [corrs[0]]
    }
    for i in range(1, len(types)):
        if types[i] == cur["type"]:
            cur["end"] = i
            cur["lags"].append(lags[i])
            cur["corrs"].append(corrs[i])
        else:
            phases.append(cur)
            cur = {
                "type": types[i], "start": i, "end": i,
                "lags": [lags[i]], "corrs": [corrs[i]]
            }
    phases.append(cur)

    # Merge short phases into previous
    merged = []
    for p in phases:
        dur = p["end"] - p["start"] + 1
        if dur < min_duration and merged:
            prev = merged[-1]
            prev["end"] = p["end"]
            prev["lags"] += p["lags"]
            prev["corrs"] += p["corrs"]
        else:
            merged.append(p)

    result_phases = []
    for p in merged:
        avg_lag = float(np.mean(p["lags"]))
        avg_corr = float(np.mean(p["corrs"]))
        result_phases.append({
            "type": p["type"],
            "start_date": dates[p["start"]],
            "end_date": dates[p["end"]],
            "duration": p["end"] - p["start"] + 1,
            "avg_lag": round(avg_lag, 1),
            "avg_corr": round(avg_corr, 3),
            "max_corr": round(max(p["corrs"]), 3),
        })

    return result_phases


# ─── Full matrix analysis ─────────────────────────────────────────────────────

def run_lead_lag_matrix(
    demand_dict: dict[str, pd.Series],
    basket_dict: dict[str, pd.Series],
    window: int = 26,
    max_lag: int = 12,
) -> dict[str, dict]:
    """
    Run rolling lead-lag for all demand × basket combinations.

    Returns:
        {
          "consumer_electronics_vs_A_foundry": {
            "weekly": pd.DataFrame(best_lag, best_corr, type),
            "phases": [...],
            "summary": { us_lead_pct, tw_lead_pct, sync_pct, weak_pct, avg_lag, avg_corr }
          },
          ...
        }
    """
    results = {}
    demand_keys = list(demand_dict.keys())
    basket_keys = list(basket_dict.keys())
    total = len(demand_keys) * len(basket_keys)
    done = 0

    for dk in demand_keys:
        for bk in basket_keys:
            key = f"{dk}_vs_{bk}"
            print(f"  [{done+1}/{total}] {key}")
            demand_s = demand_dict[dk]
            basket_s = basket_dict[bk]

            # Align to common index (intersection)
            common = demand_s.index.intersection(basket_s.index)
            if len(common) < window + max_lag * 2:
                print(f"    -> Skipped (insufficient overlap: {len(common)} weeks)")
                done += 1
                continue

            d = demand_s.reindex(common)
            b = basket_s.reindex(common)

            weekly_df = rolling_best_lag(d, b, window=window, max_lag=max_lag)
            phases = segment_phases(weekly_df)
            summary = _summarize(weekly_df)

            results[key] = {
                "weekly": weekly_df,
                "phases": phases,
                "summary": summary,
            }
            done += 1

    return results


def _summarize(df: pd.DataFrame) -> dict:
    n = len(df)
    if n == 0:
        return {}
    counts = df["type"].value_counts()
    valid = df[df["type"] != "weak"]
    avg_lag = float(valid["best_lag"].mean()) if len(valid) else 0.0
    avg_corr = float(valid["best_corr"].mean()) if len(valid) else 0.0
    return {
        "us_lead_pct": round(counts.get("us_lead", 0) / n * 100, 1),
        "tw_lead_pct": round(counts.get("tw_lead", 0) / n * 100, 1),
        "sync_pct":    round(counts.get("sync", 0) / n * 100, 1),
        "weak_pct":    round(counts.get("weak", 0) / n * 100, 1),
        "avg_lag":     round(avg_lag, 1),
        "avg_corr":    round(avg_corr, 3),
    }


# ─── Theme pulse score (0-100) ────────────────────────────────────────────────

def compute_demand_pulse(
    demand_dict: dict[str, pd.Series],
    window_mom: int = 13,
    window_z: int = 52,
) -> dict[str, pd.Series]:
    """
    Compute a 0-100 pulse score for each demand theme.
    Based on: tanh-normalized z-score of 13-week momentum.
    """
    pulses: dict[str, pd.Series] = {}
    for key, s in demand_dict.items():
        mom = s.pct_change(window_mom) * 100.0
        rolling_mean = mom.rolling(window_z, min_periods=window_z // 2).mean()
        rolling_std = mom.rolling(window_z, min_periods=window_z // 2).std()
        z = (mom - rolling_mean) / rolling_std.replace(0, np.nan)
        pulse = (np.tanh(z / 2.0) + 1.0) / 2.0 * 100.0
        pulse.name = key
        pulses[key] = pulse
    return pulses


def compute_basket_momentum(
    basket_dict: dict[str, pd.Series],
    weeks: int = 13,
) -> dict[str, pd.Series]:
    """N-week percentage momentum for each basket."""
    return {
        k: (s.pct_change(weeks) * 100.0).rename(k)
        for k, s in basket_dict.items()
    }
