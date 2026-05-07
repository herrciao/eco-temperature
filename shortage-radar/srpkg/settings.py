"""
Paths and instrument registry for Shortage Radar (standalone product).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Literal

PACK_ROOT = Path(__file__).resolve().parent.parent
PIPELINE_ROOT = PACK_ROOT / "pipeline"
DATA_DIR = PACK_ROOT / "data"
OUTPUT_DIR = DATA_DIR / "output"
DB_PATH = DATA_DIR / "shortage.db"

SourceKind = Literal[
    "fred",
    "yahoo",
    "computed",
    "placeholder",
    "tw_moea_csv",
    "eia_v2",
    "westmetall_lme",
]

Orientation = Literal["high_is_tight", "low_is_tight"]


@dataclass
class Instrument:
    """One row on the radar; may combine multiple fetches ('computed')."""

    id: str
    category: str
    display_zh: str
    display_en: str
    source: SourceKind
    primary: str | None = None
    secondary: str | None = None
    fred_frequency: str = "monthly"
    notes: str = ""
    weight_price: float = 0.45
    weight_inventory: float = 0.0
    weight_spread: float = 0.35
    weight_curve: float = 0.20
    orientation: Orientation = "high_is_tight"


def default_instruments() -> List[Instrument]:
    """All categories per user scope; free sources only."""
    return [
        Instrument(
            id="energy_wti",
            category="energy",
            display_zh="WTI 原油（現貨）",
            display_en="WTI crude (spot proxy)",
            source="fred",
            primary="DCOILWTICO",
            fred_frequency="daily",
            notes="FRED WTI Cushing; 日頻。價格上行常反映供應緊張或地緣風險。",
        ),
        Instrument(
            id="energy_brent",
            category="energy",
            display_zh="Brent 原油（現貨）",
            display_en="Brent crude (spot)",
            source="fred",
            primary="DCOILBRENTEU",
            fred_frequency="daily",
            notes="FRED Brent 日頻；與 WTI 價差反映大西洋/中東运力與區域供需。",
        ),
        Instrument(
            id="energy_wti_brent_spread",
            category="energy",
            display_zh="WTI–Brent 價差",
            display_en="WTI minus Brent spread",
            source="computed",
            primary="spread_wti_brent",
            fred_frequency="daily",
            notes="區域割裂指標；絕對值擴大時中游/物流瓶頸或品質/关税因素。",
        ),
        Instrument(
            id="energy_henry_hub",
            category="energy",
            display_zh="Henry Hub 天然氣",
            display_en="Henry Hub natural gas",
            source="fred",
            primary="DHHNGSP",
            fred_frequency="daily",
            notes="美國氣價基準；亞洲 JKM 常更高——美國便宜代表液化出口套利空間。",
        ),
        Instrument(
            id="energy_ng_futures",
            category="energy",
            display_zh="美國天然氣期貨 (NG)",
            display_en="NYMEX natural gas front month",
            source="yahoo",
            primary="NG=F",
            fred_frequency="daily",
            notes="Yahoo NG=F；對沖/投機較多，現貨用 Henry Hub 交叉驗證。",
        ),
        Instrument(
            id="energy_eia_crude_inventory",
            category="energy",
            display_zh="美國原油庫存（EIA 週）",
            display_en="US crude oil ending stocks (EIA weekly, total)",
            source="eia_v2",
            primary="eia_crude_stocks_kbbl",
            secondary="WCRSTUS1",
            fred_frequency="daily",
            notes="EIA API v2：`WCRSTUS1`（美國原油總庫存，千桶）；需免費 EIA_API_KEY。庫存下降 → 市場偏緊。",
            orientation="low_is_tight",
        ),
        Instrument(
            id="semi_soxx",
            category="semiconductor",
            display_zh="費城半導體 ETF (SOXX)",
            display_en="SOXX ETF",
            source="yahoo",
            primary="SOXX",
            fred_frequency="daily",
            notes="板塊風險情緒；上行未必等於缺貨，需跟產能/庫存新聞交叉驗證。",
            weight_price=0.55,
            weight_spread=0.25,
            weight_curve=0.20,
        ),
        Instrument(
            id="semi_tsm_adr_tw_premium",
            category="semiconductor",
            display_zh="台積電 ADR–台股溢價 (normalized %)",
            display_en="TSM ADR vs 2330.TW normalized spread",
            source="computed",
            primary="tsm_adr_tw_premium",
            fred_frequency="daily",
            notes="同公司兩市場價差 proxy（未含 ADR 換股比/匯率）；需四視角 triangulate。",
        ),
        Instrument(
            id="metal_copper_fred",
            category="metals",
            display_zh="銅 (IMF 月均值)",
            display_en="Copper (IMF via FRED)",
            source="fred",
            primary="PCOPPUSDM",
            fred_frequency="monthly",
            notes="全球工業溫度計；中國需求敏感。",
        ),
        Instrument(
            id="metal_copper_futures",
            category="metals",
            display_zh="COMEX 銅期貨",
            display_en="HG=F copper futures",
            source="yahoo",
            primary="HG=F",
            fred_frequency="daily",
            notes="較 IMF 月頻更即時；可分鐘級情緒。",
        ),
        Instrument(
            id="metal_lme_cu_inventory",
            category="metals",
            display_zh="LME 銅倉庫庫存（Westmetall 表）",
            display_en="LME copper warehouse stocks (Westmetall mirror, tonnes)",
            source="westmetall_lme",
            primary="lme_copper_stock",
            fred_frequency="daily",
            notes="來源為 westmetall.com 匯總表（非 LME 官方 API）；庫存下降 → 偏緊。",
            orientation="low_is_tight",
        ),
        Instrument(
            id="metal_aluminum",
            category="metals",
            display_zh="鋁 (IMF)",
            display_en="Aluminum",
            source="fred",
            primary="PALUMUSDM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="metal_nickel",
            category="metals",
            display_zh="鎳 (IMF)",
            display_en="Nickel",
            source="fred",
            primary="PNICKUSDM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="metal_zinc",
            category="metals",
            display_zh="鋅 (IMF)",
            display_en="Zinc",
            source="fred",
            primary="PZINCUSDM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="metal_tin",
            category="metals",
            display_zh="錫 (IMF)",
            display_en="Tin",
            source="fred",
            primary="PTINUSDM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="metal_iron_ore",
            category="metals",
            display_zh="鐵礦砂 (IMF)",
            display_en="Iron ore",
            source="fred",
            primary="PIORECRUSDM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="battery_cobalt",
            category="battery",
            display_zh="全球電池金屬 ETF (BATT)",
            display_en="Global X Lithium & Battery Tech BATT",
            source="yahoo",
            primary="BATT",
            fred_frequency="daily",
            notes="FRED 無免費鈷現貨序列；用 BATT 作電池金屬一籃子 proxy。",
        ),
        Instrument(
            id="battery_alb_proxy",
            category="battery",
            display_zh="雅寶 ALB（鋰/化工股價 proxy）",
            display_en="Albemarle (lithium equity proxy)",
            source="yahoo",
            primary="ALB",
            fred_frequency="daily",
            notes="非現貨鋰價；免費權宜。真實鋰價需 SMM 等（可後續爬蟲）。",
        ),
        Instrument(
            id="battery_sqm_proxy",
            category="battery",
            display_zh="SQM（鋰 proxy）",
            display_en="SQM equity proxy",
            source="yahoo",
            primary="SQM",
            fred_frequency="daily",
        ),
        Instrument(
            id="agri_soy",
            category="agriculture",
            display_zh="黃豆期貨",
            display_en="Soybean futures",
            source="yahoo",
            primary="ZS=F",
            fred_frequency="daily",
        ),
        Instrument(
            id="agri_corn",
            category="agriculture",
            display_zh="玉米期貨",
            display_en="Corn futures",
            source="yahoo",
            primary="ZC=F",
            fred_frequency="daily",
        ),
        Instrument(
            id="agri_palm",
            category="agriculture",
            display_zh="棕櫚油 (IMF)",
            display_en="Palm oil",
            source="fred",
            primary="PPOILUSDM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="agri_food_index",
            category="agriculture",
            display_zh="全球食品價格指數",
            display_en="Global food price index (IMF)",
            source="fred",
            primary="PFOODINDEXM",
            fred_frequency="monthly",
        ),
        Instrument(
            id="lead_bdry",
            category="leading",
            display_zh="BDI 乾散貨 ETF (BDRY)",
            display_en="BDRY ETF (dry bulk proxy)",
            source="yahoo",
            primary="BDRY",
            fred_frequency="daily",
            notes="波羅的海乾散貨的 ETF 近似；領先全球貿易量。",
        ),
        Instrument(
            id="lead_ism_pmi",
            category="leading",
            display_zh="美國製造業工業生產 (IPMAN)",
            display_en="US Industrial Production: Manufacturing",
            source="fred",
            primary="IPMAN",
            fred_frequency="monthly",
            notes="FRED 上 ISM PMI 序列已不可取得；以 IPMAN 作製造業動能 proxy（非 PMI）。",
            weight_price=0.40,
            weight_spread=0.30,
            weight_curve=0.30,
        ),
        Instrument(
            id="lead_durable_goods",
            category="leading",
            display_zh="美國耐久財訂單",
            display_en="US durable goods orders",
            source="fred",
            primary="DGORDER",
            fred_frequency="monthly",
        ),
        Instrument(
            id="lead_tw_export_orders",
            category="leading",
            display_zh="台灣外銷訂單（經濟部 CSV）",
            display_en="Taiwan export orders (MOEA open data, USD millions)",
            source="tw_moea_csv",
            primary="tw_export_orders_usd_millions",
            fred_frequency="monthly",
            notes="https://service.moea.gov.tw/EE520/opendata/b.csv ；百萬美元；免 key。",
        ),
        Instrument(
            id="lead_kr_exports",
            category="leading",
            display_zh="韓國貨品出口（FRED）",
            display_en="Korea exports of goods (FRED IMF series)",
            source="fred",
            primary="XTEXVA01KRM667S",
            fred_frequency="monthly",
            notes="IMT 貨品出口；免費 FRED。不需韓國 data.go.kr key。",
        ),
        # ── AI 電力 (北美) ─────────────────────────────────────────────────────
        Instrument(
            id="power_ceg",
            category="power",
            display_zh="Constellation Energy (CEG)",
            display_en="Constellation Energy",
            source="yahoo",
            primary="CEG",
            fred_frequency="daily",
            notes="美最大核電業者，MSFT 三哩島重啟 20 年 PPA；AI 24/7 baseload 直接受惠。",
            weight_price=0.55,
            weight_spread=0.25,
            weight_curve=0.20,
        ),
        Instrument(
            id="power_vst",
            category="power",
            display_zh="Vistra Corp (VST)",
            display_en="Vistra Corp",
            source="yahoo",
            primary="VST",
            fred_frequency="daily",
            notes="核電 + 氣電混合 IPP；多家 hyperscaler 資料中心長約；AI 電力需求受惠。",
            weight_price=0.55,
            weight_spread=0.25,
            weight_curve=0.20,
        ),
        Instrument(
            id="power_gev",
            category="power",
            display_zh="GE Vernova (GEV)",
            display_en="GE Vernova",
            source="yahoo",
            primary="GEV",
            fred_frequency="daily",
            notes="氣渦輪製造龍頭，訂單能見度至 2028+；AI 數據中心新增容量的 capex 端代表。",
            weight_price=0.55,
            weight_spread=0.25,
            weight_curve=0.20,
        ),
        Instrument(
            id="power_grid",
            category="power",
            display_zh="Smart Grid Infra ETF (GRID)",
            display_en="First Trust NASDAQ Smart Grid Infra ETF",
            source="yahoo",
            primary="GRID",
            fred_frequency="daily",
            notes="變壓器、開關、輸配電升級一籃子 ETF；北美電網 capex 需求的廣基代理。",
            weight_price=0.55,
            weight_spread=0.25,
            weight_curve=0.20,
        ),
    ]


def instruments_by_category() -> Dict[str, List[Instrument]]:
    out: Dict[str, List[Instrument]] = {}
    for inst in default_instruments():
        out.setdefault(inst.category, []).append(inst)
    return out


def category_order() -> List[str]:
    return [
        "energy",
        "power",
        "semiconductor",
        "metals",
        "battery",
        "agriculture",
        "leading",
    ]


def category_label_zh(cat: str) -> str:
    return {
        "energy": "能源",
        "power": "AI 電力 (北美)",
        "semiconductor": "半導體",
        "metals": "工業金屬",
        "battery": "電池/轉型金屬",
        "agriculture": "農產品",
        "leading": "領先/總經",
    }.get(cat, cat)


def env_paths() -> Dict[str, Any]:
    return {
        "pack_root": str(PACK_ROOT),
        "output_dir": str(OUTPUT_DIR),
        "db_path": str(DB_PATH),
    }
