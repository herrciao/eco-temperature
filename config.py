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

# ─── Supply Chain Mapping System ──────────────────────────────────────────────

# Demand-side indices (US market)
DEMAND_TICKERS: Dict[str, List[str]] = {
    "consumer_electronics": ["AAPL"],
    "cloud_hyperscaler":    ["MSFT", "GOOGL", "AMZN", "META"],
    "ai_compute":           ["NVDA", "AMD"],
}

# Supply-side baskets (Taiwan + US infra ETFs)
# Format: { group_key: { label, members: [(yahoo_ticker, display_name), ...] } }
SUPPLY_CHAIN_GROUPS: Dict[str, Dict] = {
    "A_foundry": {
        "label": "台灣晶圓代工",
        "members": [
            ("2330.TW", "台積電"),
            ("2303.TW", "聯電"),
        ],
    },
    "B_ic_design": {
        "label": "台灣 AI / IC 設計",
        "members": [
            ("2454.TW", "聯發科"),
            ("3661.TW", "世芯"),
            ("3443.TW", "創意"),
            ("3035.TW", "智原"),
            ("6150.TW", "撼訊"),
        ],
    },
    "C_packaging": {
        "label": "台灣 AI 伺服器",
        "members": [
            ("3711.TW", "日月光投控"),
            ("2325.TW", "矽品"),
        ],
    },
    "D_server": {
        "label": "台灣散熱 & 電源",
        "members": [
            ("2382.TW", "廣達"),
            ("3231.TW", "緯創"),
            ("2356.TW", "英業達"),
            ("6669.TW", "緯穎"),
            ("2317.TW", "鴻海"),
            ("2376.TW", "技嘉"),
            ("2377.TW", "微星"),
        ],
    },
    "E_power_thermal": {
        "label": "台灣散熱 & 電源",
        "members": [
            ("2308.TW", "台達電"),
            ("2301.TW", "光寶科"),
            ("3017.TW", "奇鋐"),
            ("3563.TW", "雙鴻"),
            ("3653.TW", "健策"),
        ],
    },
    "F_memory": {
        "label": "台灣記憶體",
        "members": [
            ("2408.TW", "南亞科"),
            ("2344.TW", "華邦電"),
            ("2337.TW", "旺宏"),
        ],
    },
    "G_power_infra": {
        "label": "美國 AI 電力基礎設施",
        "members": [
            ("CEG", "Constellation Energy"),
            ("VST", "Vistra Corp"),
            ("GEV", "GE Vernova"),
            ("GRID", "Smart Grid Infra ETF"),
        ],
    },
}

# Flat list of all supply chain tickers (for fetching)
SUPPLY_CHAIN_ALL_TICKERS: List[str] = [
    t for g in SUPPLY_CHAIN_GROUPS.values()
    for t, _ in g["members"]
]

# Demand index tickers (for fetching)
DEMAND_ALL_TICKERS: List[str] = [
    t for tickers in DEMAND_TICKERS.values()
    for t in tickers
]

# AI amplifier chain definition (ordered DAG for visualization)
AI_AMPLIFIER_CHAIN = [
    {"id": "nvda",         "label": "AI 算力需求 (NVDA)",    "tickers": ["NVDA"]},
    {"id": "foundry",      "label": "先進製程 (TSMC)",        "tickers": ["2330.TW"]},
    {"id": "cowos",        "label": "先進封裝 CoWoS",          "tickers": ["3711.TW", "2325.TW"]},
    {"id": "hbm",          "label": "HBM 記憶體",              "tickers": ["2408.TW"]},
    {"id": "server",       "label": "伺服器組裝",              "tickers": ["2382.TW", "6669.TW"]},
    {"id": "thermal",      "label": "散熱 & 電源",             "tickers": ["3017.TW", "2308.TW"]},
    {"id": "datacenter",   "label": "資料中心 & 電力",         "tickers": ["CEG", "GEV"]},
]

# Supply chain data start date
SUPPLY_CHAIN_START = "2016-01-01"

# ─── Event backtest example rules (percent thresholds on raw momentum) ────────
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
