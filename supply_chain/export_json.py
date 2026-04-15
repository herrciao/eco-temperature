"""
Export supply chain analysis results to JSON for the HTML visualization.

Output: research/output/supply_chain_data.json
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from config import (
    AI_AMPLIFIER_CHAIN,
    DB_PATH,
    DEMAND_TICKERS,
    SUPPLY_CHAIN_GROUPS,
    SUPPLY_CHAIN_START,
    WEEK_ANCHOR,
)
from data.align import _daily_to_weekly_last
from data.store import connect, load_series
from supply_chain.analysis import (
    compute_basket_momentum,
    compute_demand_pulse,
    rolling_best_lag,
    run_lead_lag_matrix,
    segment_phases,
    _summarize,
)
from supply_chain.basket import build_all_baskets
from supply_chain.fetch import _series_name


OUTPUT_DIR = Path(__file__).resolve().parent.parent / "research" / "output"


def _safe(v) -> object:
    """Convert numpy/pandas scalars to JSON-serializable."""
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, (np.floating, np.integer)):
        return v.item()
    if isinstance(v, pd.Timestamp):
        return v.strftime("%Y-%m-%d")
    return v


def _series_to_list(s: pd.Series) -> list:
    return [_safe(v) for v in s.values]


def build_supply_chain_json(
    db_path: Path | None = None,
    start: str = SUPPLY_CHAIN_START,
    end: Optional[str] = None,
    window: int = 26,
    max_lag: int = 12,
    output_path: Optional[Path] = None,
) -> Path:
    """
    Build and save supply_chain_data.json.

    Returns the path to the written file.
    """
    if db_path is None:
        db_path = DB_PATH
    if output_path is None:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_path = OUTPUT_DIR / "supply_chain_data.json"

    conn = connect(db_path)

    # ── Build weekly index ──
    # Use first available series to determine range
    sample_ticker = "2330.TW"
    sample_name = _series_name(sample_ticker)
    sample_s = load_series(conn, sample_name)
    if sample_s.empty:
        # Fallback: try SPY
        sample_s = load_series(conn, "etf_spy")
    if sample_s.empty:
        conn.close()
        raise RuntimeError("No supply chain data in DB. Run `python main.py supply-chain fetch` first.")

    t0 = max(pd.Timestamp(start), sample_s.index.min())
    t1 = sample_s.index.max() if end is None else pd.Timestamp(end)
    weekly_index = pd.date_range(start=t0, end=t1, freq=WEEK_ANCHOR)
    weeks_list = [w.strftime("%Y-%m-%d") for w in weekly_index]

    print(f"Building supply chain data: {weeks_list[0]} → {weeks_list[-1]} ({len(weeks_list)} weeks)")

    # ── Build baskets ──
    print("Computing demand indices and supply chain baskets...")
    all_baskets = build_all_baskets(conn, weekly_index)
    demand_dict = all_baskets["demand"]
    basket_dict = all_baskets["baskets"]
    basket_members = all_baskets["basket_members"]

    # ── Demand pulse scores ──
    print("Computing demand pulse scores...")
    pulses = compute_demand_pulse(demand_dict)

    # ── Basket momentum ──
    basket_mom = compute_basket_momentum(basket_dict)

    # ── Lead-lag matrix ──
    print("Running 21-pair rolling lead-lag analysis (this may take ~30s)...")
    matrix = run_lead_lag_matrix(demand_dict, basket_dict, window=window, max_lag=max_lag)

    # ── Amplifier chain ──
    print("Building AI amplifier chain data...")
    amplifier_data = _build_amplifier_chain(conn, weekly_index, demand_dict)

    conn.close()

    # ── Assemble output ──
    print("Assembling JSON output...")
    output = {
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "weeks": weeks_list,
        "window_weeks": window,
        "max_lag_weeks": max_lag,

        # Demand side
        "demand_groups": {
            k: {
                "label": _demand_label(k),
                "members": DEMAND_TICKERS[k],
                "index": _series_to_list(demand_dict[k].reindex(weekly_index)),
                "pulse": _series_to_list(pulses[k].reindex(weekly_index)),
                "pulse_latest": _safe(pulses[k].dropna().iloc[-1] if not pulses[k].dropna().empty else None),
            }
            for k in demand_dict
        },

        # Supply chain baskets
        "baskets": {
            k: {
                "label": SUPPLY_CHAIN_GROUPS[k]["label"],
                "members": basket_members[k],
                "index": _series_to_list(basket_dict[k].reindex(weekly_index)),
                "momentum_13w": _series_to_list(basket_mom[k].reindex(weekly_index)),
                "momentum_latest": _safe(basket_mom[k].dropna().iloc[-1] if not basket_mom[k].dropna().empty else None),
            }
            for k in basket_dict
        },

        # Lead-lag pairs
        "lead_lag": {
            pair_key: {
                "demand_key": pair_key.split("_vs_")[0],
                "basket_key": "_vs_".join(pair_key.split("_vs_")[1:]),
                "weekly_lag": [int(v) for v in pair_data["weekly"]["best_lag"].reindex(weekly_index).fillna(0).astype(int).tolist()],
                "weekly_corr": [_safe(v) for v in pair_data["weekly"]["best_corr"].reindex(weekly_index).tolist()],
                "weekly_type": pair_data["weekly"]["type"].reindex(weekly_index).fillna("weak").tolist(),
                "phases": pair_data["phases"],
                "summary": pair_data["summary"],
            }
            for pair_key, pair_data in matrix.items()
        },

        # AI amplifier chain
        "amplifier_chain": amplifier_data,

        # Summary stats for quick UI
        "latest_week": weeks_list[-1] if weeks_list else None,
        "total_pairs": len(matrix),
    }

    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=None),
        encoding="utf-8",
    )
    print(f"Written: {output_path} ({output_path.stat().st_size / 1024:.0f} KB)")
    return output_path


def _demand_label(key: str) -> str:
    labels = {
        "consumer_electronics": "消費電子 (AAPL)",
        "cloud_hyperscaler": "雲端超大規模 (MSFT/GOOGL/AMZN/META)",
        "ai_compute": "AI 算力 (NVDA/AMD)",
    }
    return labels.get(key, key)


def _build_amplifier_chain(
    conn,
    weekly_index: pd.DatetimeIndex,
    demand_dict: dict[str, pd.Series],
) -> list[dict]:
    """Build per-node data for the AI amplifier chain visualization."""
    ai_demand = demand_dict.get("ai_compute")
    nodes = []

    for node in AI_AMPLIFIER_CHAIN:
        tickers = node["tickers"]
        prices = {}
        for t in tickers:
            s = load_series(conn, _series_name(t))
            if not s.empty:
                prices[t] = _daily_to_weekly_last(s, weekly_index)

        if not prices:
            nodes.append({**node, "index": None, "lag_vs_nvda": None, "corr_vs_nvda": None})
            continue

        # Build equal-weight index
        df = pd.DataFrame(prices)
        normed = pd.DataFrame()
        for col in df.columns:
            s = df[col].dropna()
            if s.empty:
                continue
            first = s.iloc[0]
            if first > 0:
                normed[col] = df[col] / first * 100.0
        node_index = normed.mean(axis=1) if not normed.empty else pd.Series(index=weekly_index, dtype=float)

        # Lead-lag vs AI demand
        lag_vs_nvda = None
        corr_vs_nvda = None
        if ai_demand is not None and node["id"] != "nvda":
            try:
                lag_result = rolling_best_lag(ai_demand, node_index, window=26, max_lag=16)
                # Use recent 52-week average
                recent = lag_result.tail(52)
                valid = recent[recent["type"] != "weak"]
                if not valid.empty:
                    lag_vs_nvda = round(float(valid["best_lag"].mean()), 1)
                    corr_vs_nvda = round(float(valid["best_corr"].mean()), 3)
            except Exception:
                pass

        nodes.append({
            "id": node["id"],
            "label": node["label"],
            "tickers": tickers,
            "index": _series_to_list(node_index),
            "lag_vs_nvda": lag_vs_nvda,
            "corr_vs_nvda": corr_vs_nvda,
        })

    return nodes
