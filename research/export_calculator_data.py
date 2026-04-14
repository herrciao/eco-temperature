#!/usr/bin/env python3
"""
Export slim JSON for research/calculator.html (Growth weight playground).

Reads output/artifacts/macro_panel.csv (run `python main.py score` first).
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import GROWTH_W, OUTPUT_DIR, REGIME_THRESHOLDS, RISK_W  # noqa: E402

PANEL = OUTPUT_DIR / "macro_panel.csv"
OUT = Path(__file__).resolve().parent / "output" / "calculator_data.json"

Z_KEYS = [
    "copper_mom3_z",
    "bdry_mom1_z",
    "nfp_change_z",
    "unrate_trend_inv_z",
    "durable_goods_z",
]


def main() -> None:
    if not PANEL.exists():
        raise SystemExit(f"Missing {PANEL}; run: python main.py score")

    df = pd.read_csv(PANEL, index_col=0, parse_dates=True)
    missing = [c for c in Z_KEYS + ["inflation_score", "liquidity_score", "curve_mom_3m_abs", "etf_spy"] if c not in df.columns]
    if missing:
        raise SystemExit(f"macro_panel.csv missing columns: {missing}")

    rows = []
    for idx, row in df.iterrows():
        z = [float(row[k]) if pd.notna(row[k]) else 0.0 for k in Z_KEYS]
        g0 = float(row["growth_score"]) if "growth_score" in df.columns and pd.notna(row.get("growth_score")) else None
        rows.append(
            {
                "week": idx.strftime("%Y-%m-%d"),
                "z": z,
                "inf": float(row["inflation_score"]) if pd.notna(row["inflation_score"]) else 0.0,
                "liq": float(row["liquidity_score"]) if pd.notna(row["liquidity_score"]) else 0.0,
                "curve": float(row["curve_mom_3m_abs"]) if pd.notna(row["curve_mom_3m_abs"]) else 0.0,
                "spy": float(row["etf_spy"]) if pd.notna(row["etf_spy"]) else None,
                "g0": g0,
            }
        )

    thr = REGIME_THRESHOLDS
    payload = {
        "defaultWeights": asdict(GROWTH_W),
        "regimeThresholds": {
            "growth_high": thr.growth_high,
            "growth_low": thr.growth_low,
            "inflation_high": thr.inflation_high,
            "liquidity_low": thr.liquidity_low,
            "recovery_growth_min": thr.recovery_growth_min,
        },
        "riskWeights": {
            "growth": RISK_W.growth,
            "inflation_inv": RISK_W.inflation_inv,
            "liquidity": RISK_W.liquidity,
            "curve_boost": 0.1,
        },
        "macroTemperatureBlend": {"growth": 1.0, "inflation": -0.5, "liquidity": 0.5, "risk": 0.5},
        "rows": rows,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
