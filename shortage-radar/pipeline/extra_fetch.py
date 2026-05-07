"""
Additional free sources: MOEA Taiwan export orders CSV, EIA v1, Westmetall LME copper stock table.
"""
from __future__ import annotations

from io import StringIO
from typing import Optional

import pandas as pd
import requests
from dotenv import load_dotenv

from srpkg.envutil import getenv_api_key
from srpkg.settings import PACK_ROOT

REPO_ROOT = PACK_ROOT.parent
load_dotenv(REPO_ROOT / ".env")
load_dotenv()

MOEA_EXPORT_CSV = "https://service.moea.gov.tw/EE520/opendata/b.csv"
WESTMETALL_LME_CU_TABLE = (
    "https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Cu_cash"
)
UA = {"User-Agent": "Mozilla/5.0 (compatible; shortage-radar/1.0; research)"}


def fetch_tw_export_orders_moea_csv(url: str = MOEA_EXPORT_CSV) -> pd.Series:
    """
    外銷訂單金額，單位：百萬美元（與 CSV 欄位一致）。
    資料期：民國 yyymm（3 碼年 + 2 碼月）。
    """
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    r.encoding = "utf-8"
    df = pd.read_csv(StringIO(r.text))
    col_item = "統計項目"
    col_period = "資料期(民國年)"
    col_usd = "統計值(美元)"
    if col_item not in df.columns:
        raise ValueError(f"Unexpected MOEA CSV columns: {df.columns.tolist()}")

    sub = df[df[col_item].astype(str).str.contains("外銷訂單金額", na=False)].copy()
    sub[col_period] = sub[col_period].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(5)

    def roc_to_ts(p: str) -> pd.Timestamp:
        p = str(p).zfill(5)
        if len(p) != 5:
            return pd.NaT
        roc_y = int(p[:3])
        month = int(p[3:])
        gy = roc_y + 1911
        if month < 1 or month > 12:
            return pd.NaT
        return pd.Timestamp(year=gy, month=month, day=1)

    sub["_ts"] = sub[col_period].map(roc_to_ts)
    sub["_v"] = pd.to_numeric(sub[col_usd], errors="coerce")
    ser = (
        sub.dropna(subset=["_ts", "_v"])
        .groupby("_ts", as_index=True)["_v"]
        .last()
        .sort_index()
        .astype(float)
    )
    ser.name = "tw_export_orders_usd_millions"
    return ser


def fetch_eia_weekly_stocks_v2(
    series_id: str,
    api_key: Optional[str] = None,
    *,
    route: str = "https://api.eia.gov/v2/petroleum/stoc/wstk/data/",
) -> pd.Series:
    """
    EIA API v2 週庫存（v1 已退役）。
    常用：`WCRSTUS1` = U.S. Ending Stocks of Crude Oil (Thousand Barrels)。
    """
    key = (api_key.strip() if isinstance(api_key, str) else None) or getenv_api_key(
        "EIA_API_KEY"
    )
    if not key:
        raise RuntimeError("EIA_API_KEY missing")

    offset = 0
    page = 5000
    pairs: list[tuple[pd.Timestamp, float]] = []
    while True:
        params = {
            "api_key": key,
            "frequency": "weekly",
            "data[0]": "value",
            "facets[series][]": series_id,
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "offset": offset,
            "length": page,
        }
        r = requests.get(route, params=params, timeout=120)
        r.raise_for_status()
        payload = r.json()
        if payload.get("error"):
            raise RuntimeError(str(payload["error"]))
        chunk = payload.get("response", {}).get("data", [])
        for row in chunk:
            try:
                ts = pd.Timestamp(row["period"])
                v = float(row["value"])
            except (KeyError, TypeError, ValueError):
                continue
            pairs.append((ts, v))
        if len(chunk) < page:
            break
        offset += page

    if not pairs:
        return pd.Series(dtype=float)
    ser = pd.Series(dict(pairs), name=series_id).sort_index()
    ser = ser[~ser.index.duplicated(keep="last")]
    return ser.astype(float)


def fetch_lme_copper_stock_westmetall(
    url: str = WESTMETALL_LME_CU_TABLE,
) -> pd.Series:
    """
    Westmetall 公開 LME Copper 表格頁（含 cash 與 warehouse stock 欄）。
    庫存：公噸（頁面標題為 LME Copper stock）。
    """
    r = requests.get(url, timeout=60, headers=UA)
    r.raise_for_status()
    dfs = pd.read_html(StringIO(r.text), thousands=",")
    if not dfs:
        return pd.Series(dtype=float)
    df = dfs[0]
    # find date column
    date_col = None
    stock_col = None
    for c in df.columns:
        cl = str(c).lower()
        if "date" in cl or "datum" in cl:
            date_col = c
        if "stock" in cl and "copper" in cl:
            stock_col = c
    if stock_col is None:
        for c in df.columns:
            if "stock" in str(c).lower():
                stock_col = c
                break
    if date_col is None:
        date_col = df.columns[0]

    out_dates = []
    out_vals = []
    for _, row in df.iterrows():
        d_raw = row[date_col]
        if str(d_raw).lower() == "date" or pd.isna(d_raw):
            continue
        try:
            ts = pd.to_datetime(d_raw, errors="coerce")
            if pd.isna(ts):
                continue
            v = pd.to_numeric(row[stock_col], errors="coerce")
            if pd.isna(v):
                continue
            out_dates.append(ts.normalize())
            out_vals.append(float(v))
        except (TypeError, ValueError, KeyError):
            continue
    if not out_dates:
        return pd.Series(dtype=float)
    ser = pd.Series(out_vals, index=pd.DatetimeIndex(out_dates), name="lme_copper_stock")
    ser = ser.sort_index()
    return ser[~ser.index.duplicated(keep="last")].astype(float)
