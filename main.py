#!/usr/bin/env python3
"""CLI: fetch → score → backtest → report."""
from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict
from pathlib import Path

import click
import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Ensure repo root on path when run as script
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from config import (
    DB_PATH,
    DEFAULT_START,
    GROWTH_W,
    INFLATION_W,
    LIQUIDITY_W,
    OUTPUT_DIR,
    RISK_W,
    WEB_DIR,
)
from data.align import build_weekly_panel
from data.sources import fetch_all_raw
from data.store import connect
from features.build import build_feature_matrix
from scores.composite import compute_composite_scores
from scores.regime import add_regime
from scores.spy_fit import fit_spy_composite
from backtest.engine import event_backtest, regime_backtest
from output.charts import (
    plot_composite_scores,
    plot_macro_temperature,
    plot_regime_and_spy,
    plot_regime_heatmap,
    plot_rolling_ic,
    plot_spy_composite,
    plotly_regime_heatmap_html,
)
from output.summary import write_summary_report


PANEL_CSV = OUTPUT_DIR / "macro_panel.csv"

REGIME_SUMMARY_CSV = OUTPUT_DIR / "backtest_regime_summary.csv"
EVENT_SUMMARY_CSV = OUTPUT_DIR / "backtest_event_summary.csv"
SPLIT_INFO_CSV = OUTPUT_DIR / "backtest_split_info.csv"


def run_score(start: str | None, end: str | None) -> tuple[pd.DataFrame, dict]:
    conn = connect(DB_PATH)
    weekly = build_weekly_panel(conn, start=start, end=end)
    conn.close()
    if weekly.empty:
        raise SystemExit("No data: run `python main.py fetch` first.")
    feat = build_feature_matrix(weekly)
    scored = compute_composite_scores(feat)
    scored = add_regime(scored)
    scored, spy_stats = fit_spy_composite(scored)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    scored.to_csv(PANEL_CSV, encoding="utf-8")
    return scored, spy_stats


def run_backtest_from_panel(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    reg_sum, split_info = regime_backtest(df)
    ev_sum = event_backtest(df)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    reg_sum.to_csv(REGIME_SUMMARY_CSV, index=False, encoding="utf-8")
    split_info.to_csv(SPLIT_INFO_CSV, index=False, encoding="utf-8")
    ev_sum.to_csv(EVENT_SUMMARY_CSV, index=False, encoding="utf-8")
    return reg_sum, split_info, ev_sum


def _json_scalar(v: object) -> object:
    """Convert pandas/numpy scalars to JSON-serializable values."""
    if v is None:
        return None
    if isinstance(v, (pd.Timestamp,)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and np.isnan(v):
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(v, "item"):
        v = v.item()
    if isinstance(v, (np.integer, np.floating)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def run_export() -> None:
    """Write current.json + panel.json for the Next.js dashboard."""
    if not PANEL_CSV.exists():
        raise SystemExit(f"Missing {PANEL_CSV}; run `score` first.")
    df = pd.read_csv(PANEL_CSV, index_col=0, parse_dates=True)
    if df.empty:
        raise SystemExit("Panel CSV is empty.")

    last = df.iloc[-1]
    current: dict[str, object] = {"week": df.index[-1].strftime("%Y-%m-%d")}
    for col in df.columns:
        current[col] = _json_scalar(last[col])

    cols_panel = [
        "regime",
        "macro_temperature",
        "growth_score",
        "inflation_score",
        "liquidity_score",
        "risk_score",
        "spy_composite_4w",
        "spy_composite_13w",
        "etf_spy",
    ]
    panel: list[dict[str, object]] = []
    for idx, row in df.iterrows():
        rec: dict[str, object] = {"week": idx.strftime("%Y-%m-%d")}
        for c in cols_panel:
            if c in row.index:
                rec[c] = _json_scalar(row[c])
        panel.append(rec)

    WEB_DIR.mkdir(parents=True, exist_ok=True)
    (WEB_DIR / "current.json").write_text(
        json.dumps(current, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (WEB_DIR / "panel.json").write_text(
        json.dumps(panel, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 與 dashboard/lib/factors.ts 對照用；權重來自 config 內 dataclass
    factor_weights: dict[str, object] = {
        "growth": asdict(GROWTH_W),
        "inflation": asdict(INFLATION_W),
        "liquidity": asdict(LIQUIDITY_W),
        "risk_linear": asdict(RISK_W),
        "risk_curve_boost": 0.1,
        "macro_temperature_blend": {
            "growth": 1.0,
            "inflation": -0.5,
            "liquidity": 0.5,
            "risk": 0.5,
        },
        "_note": "risk_curve_boost 與 macro_temperature_blend 係數見 scores/composite.py；與 TS 文案一致。",
    }
    (WEB_DIR / "factor_weights.json").write_text(
        json.dumps(factor_weights, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run_report(df: pd.DataFrame, reg_sum: pd.DataFrame, spy_stats: dict | None = None) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_summary_report(df, OUTPUT_DIR, spy_stats=spy_stats)
    plot_regime_and_spy(df, OUTPUT_DIR)
    plot_composite_scores(df, OUTPUT_DIR)
    plot_macro_temperature(df, OUTPUT_DIR)
    plot_spy_composite(df, OUTPUT_DIR)
    plot_rolling_ic(df, OUTPUT_DIR)
    if not reg_sum.empty:
        plot_regime_heatmap(reg_sum, OUTPUT_DIR, metric="mean")
        plotly_regime_heatmap_html(reg_sum, OUTPUT_DIR)
    click.echo(f"Artifacts written to {OUTPUT_DIR}")


@click.group()
def cli() -> None:
    """Macro regime research tool."""


@cli.command()
@click.option("--start", default=DEFAULT_START, show_default=True)
@click.option("--end", default=None, help="End date YYYY-MM-DD (exclusive for Yahoo)")
def fetch(start: str, end: str | None) -> None:
    """Download FRED + Yahoo series into SQLite."""
    if not os.environ.get("FRED_API_KEY"):
        raise SystemExit("Set FRED_API_KEY in .env or environment.")
    fetch_all_raw(DB_PATH, start=start, end=end)
    click.echo(f"Saved raw series to {DB_PATH}")


@cli.command()
@click.option("--start", default=None, help="Optional panel start date")
@click.option("--end", default=None, help="Optional panel end date")
def score(start: str | None, end: str | None) -> None:
    """Build weekly panel, features, scores, regime → CSV."""
    df, _ = run_score(start, end)
    click.echo(f"Wrote panel ({len(df)} rows) to {PANEL_CSV}")


@cli.command()
def backtest() -> None:
    """Regime + event backtest from saved panel."""
    if not PANEL_CSV.exists():
        raise SystemExit(f"Missing {PANEL_CSV}; run `score` first.")
    df = pd.read_csv(PANEL_CSV, index_col=0, parse_dates=True)
    reg_sum, _, ev_sum = run_backtest_from_panel(df)
    click.echo(
        f"Wrote {REGIME_SUMMARY_CSV} ({len(reg_sum)} rows), "
        f"{EVENT_SUMMARY_CSV} ({len(ev_sum)} rows)"
    )


@cli.command()
def export() -> None:
    """Export JSON for the Next.js dashboard (output/web/)."""
    run_export()
    click.echo(
        f"Wrote {WEB_DIR / 'current.json'}, {WEB_DIR / 'panel.json'}, "
        f"and {WEB_DIR / 'factor_weights.json'}"
    )


@cli.command()
def report() -> None:
    """Charts + Chinese summary from saved panel and backtest CSVs."""
    if not PANEL_CSV.exists():
        raise SystemExit(f"Missing {PANEL_CSV}; run `score` first.")
    df = pd.read_csv(PANEL_CSV, index_col=0, parse_dates=True)
    reg_sum = pd.read_csv(REGIME_SUMMARY_CSV) if REGIME_SUMMARY_CSV.exists() else pd.DataFrame()
    run_report(df, reg_sum)
    click.echo("Report done.")



@cli.command()
@click.option("--start", default=DEFAULT_START, show_default=True)
@click.option("--end", default=None)
def all(start: str, end: str | None) -> None:
    """fetch → score → backtest → report."""
    if not os.environ.get("FRED_API_KEY"):
        raise SystemExit("Set FRED_API_KEY in .env or environment.")
    fetch_all_raw(DB_PATH, start=start, end=end)
    df, spy_stats = run_score(None, None)
    reg_sum, _, _ = run_backtest_from_panel(df)
    run_report(df, reg_sum, spy_stats=spy_stats)
    click.echo("Pipeline complete.")


if __name__ == "__main__":
    cli()
