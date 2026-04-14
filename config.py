"""
Global configuration: date ranges, weights, regime thresholds.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

# Paths (SQLite at repo root; package `data/` is code only)
PROJECT_ROOT = Path(__file__).resolve().parent
DB_PATH = PROJECT_ROOT / "macro.db"
OUTPUT_DIR = PROJECT_ROOT / "output" / "artifacts"
WEB_DIR = PROJECT_ROOT / "output" / "web"

# Default date range for fetch / backtest
DEFAULT_START = "2015-01-01"
DEFAULT_END = None  # None = today

# FRED series IDs
FRED_SERIES: Dict[str, str] = {
    "copper_spot_monthly": "PCOPPUSDM",
    "wti": "DCOILWTICO",
    "payems": "PAYEMS",
    "unrate": "UNRATE",
    "dff": "DFF",
    "t10y2y": "T10Y2Y",
    "dxy_broad": "DTWEXBGS",
    "durable_goods": "DGORDER",        # Durable Goods New Orders, SA (monthly, millions $)
    "breakeven_10y": "T10YIE",         # 10Y Breakeven Inflation (daily)
    "hy_oas": "BAMLH0A0HYM2",         # ICE BofA US HY OAS (daily)
    "real_yield_10y": "DFII10",        # 10Y TIPS Yield (daily)
}

# Yahoo Finance tickers
YAHOO_TICKERS: Dict[str, str] = {
    "copper_fut": "HG=F",
    "bdry": "BDRY",
    "wti": "CL=F",  # WTI crude futures; more timely than FRED DCOILWTICO
}

# ETFs for backtest
BACKTEST_ETFS: List[str] = ["SPY", "QQQ", "XLI", "XLE", "IWM", "TLT"]

# Weekly alignment: use Friday as week end
WEEK_ANCHOR = "W-FRI"

# Momentum windows in weeks (approx 1M / 3M / 6M)
MOM_WEEKS = {"1m": 4, "3m": 13, "6m": 26}

# SMA windows (weeks)
SMA_WEEKS = {"short": 4, "mid": 13, "long": 26}

# Z-score rolling window (weeks)
ZSCORE_WINDOW_WEEKS = 52

# Composite score weights (must sum to 1.0 per group)
@dataclass
class GrowthWeights:
    copper_mom3_z: float = 0.20
    bdry_mom1_z: float = 0.20
    nfp_change_z: float = 0.20
    unrate_trend_inv_z: float = 0.15
    durable_goods_z: float = 0.25


@dataclass
class InflationWeights:
    wti_mom3_z: float = 0.35
    copper_mom3_z: float = 0.25
    breakeven_z: float = 0.40


@dataclass
class LiquidityWeights:
    fed_change_inv_z: float = 0.20
    curve_z: float = 0.20  # T10Y2Y
    dxy_mom_inv_z: float = 0.15
    hy_oas_inv_z: float = 0.25
    real_yield_inv_z: float = 0.20


@dataclass
class RiskWeights:
    growth: float = 0.34
    inflation_inv: float = 0.33  # lower inflation often risk-on in simple blend
    liquidity: float = 0.33


GROWTH_W = GrowthWeights()
INFLATION_W = InflationWeights()
LIQUIDITY_W = LiquidityWeights()
RISK_W = RiskWeights()


@dataclass
class RegimeThresholds:
    # Calibrated to actual score distribution (tanh-normalized ~[-1, 1]):
    # growth_score: mean=-0.05, std=0.25 → high≈75th pct, low≈25th pct
    growth_high: float = 0.20
    growth_low: float = -0.20
    inflation_high: float = 0.20
    liquidity_low: float = -0.10
    recovery_growth_min: float = 0.0
    recovery_delta_weeks: int = 4  # growth score rising vs prior window


REGIME_THRESHOLDS = RegimeThresholds()

# Train/test split for reporting
TRAIN_FRAC = 0.70

# Ridge regression regularisation strength for SPY composite fitting
RIDGE_ALPHA: float = 1.0

# Event backtest example rules (percent thresholds on raw momentum)
EVENT_RULES = [
    {
        "name": "copper_bdry_risk_on",
        "description": "Copper 3M > 8% and BDRY 1M > 10%",
        "conditions": {"copper_mom_3m_pct": (">", 8.0), "bdry_mom_1m_pct": (">", 10.0)},
    },
    {
        "name": "curve_steepening",
        "description": "T10Y2Y 3M change > 0.15",
        "conditions": {"t10y2y_mom_3m_abs": (">", 0.15)},
    },
]
