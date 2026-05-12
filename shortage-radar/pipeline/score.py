"""
Tightness / shortage score from price level & momentum (free-tier proxies).
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Literal, Optional

import numpy as np
import pandas as pd

from srpkg.settings import Instrument, category_label_zh, category_order, default_instruments

from .fetch import resolve_series_for_instrument

TrailMode = Literal["monthly", "weekly", "daily"]


def _format_trail_value(v: Optional[float]) -> Optional[float]:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if abs(v) >= 1e9:
        return round(float(v), 2)
    if abs(v) >= 1e6:
        return round(float(v), 3)
    if abs(v) >= 100:
        return round(float(v), 3)
    return round(float(v), 6)


def _z_score_last_vs_window(ser: pd.Series, window: int) -> Optional[float]:
    s = ser.dropna().astype(float)
    if len(s) < max(5, window // 3):
        return None
    win = s.iloc[-window:]
    if win.std() == 0 or math.isnan(win.std()):
        return 0.0
    last = win.iloc[-1]
    mu = win.mean()
    sigma = win.std()
    return float((last - mu) / sigma)


def _pct_change(ser: pd.Series, periods: int) -> Optional[float]:
    s = ser.dropna().astype(float)
    if len(s) <= periods:
        return None
    a, b = s.iloc[-1 - periods], s.iloc[-1]
    if a == 0:
        return None
    return float((b / a) - 1.0)


def _shortage_score_for_series(
    ser: pd.Series,
    inst: Instrument,
    *,
    is_monthly: bool,
) -> Dict[str, Any]:
    """Map z-long, z-short, momentum into 0-100 with weight redistribution."""
    daily_window = 60 if not is_monthly else 24
    long_window = 252 if not is_monthly else 36

    z_long = _z_score_last_vs_window(ser, long_window)
    z_short = _z_score_last_vs_window(ser, min(long_window, daily_window * 4 if not is_monthly else 12))
    mom30 = _pct_change(ser, 21 if not is_monthly else 3)
    if mom30 is None:
        z_mom = 0.0
    else:
        z_mom = float(np.tanh(mom30 * 8.0))

    # Components scaled like -3..3
    price_component = 0.0
    n_price = 0
    if z_long is not None:
        price_component += max(-3.0, min(3.0, z_long))
        n_price += 1
    if z_short is not None:
        price_component += max(-3.0, min(3.0, z_short))
        n_price += 1
    if n_price:
        price_component /= n_price
    else:
        price_component = 0.0

    spread_component = max(-3.0, min(3.0, z_mom))

    inv_component: Optional[float] = None

    w_p = inst.weight_price
    w_i = inst.weight_inventory
    w_s = inst.weight_spread
    w_c = inst.weight_curve
    w_p += w_c * 0.6
    w_s += w_c * 0.4

    if w_i <= 0:
        inv_component = None
    total = w_p + (w_i if inv_component is not None else 0) + w_s
    if total <= 0:
        total = 1.0
    norm = 1.0 / total
    w_p *= norm
    w_s *= norm
    if inv_component is not None:
        w_i *= norm

    combined = w_p * price_component + w_s * spread_component
    if inv_component is not None:
        combined += w_i * inv_component

    if inst.orientation == "low_is_tight":
        combined = -combined

    score = 50.0 + 16.0 * max(-3.0, min(3.0, combined))
    score = max(0.0, min(100.0, score))

    return {
        "score": round(score, 1),
        "z_long": None if z_long is None else round(z_long, 3),
        "z_short": None if z_short is None else round(z_short, 3),
        "mom_30d_approx": None if mom30 is None else round(mom30 * 100.0, 2),
        "latest": None if ser.empty else round(float(ser.dropna().iloc[-1]), 6),
        "latest_date": None if ser.empty else str(ser.dropna().index[-1].date()),
        "data_completeness": round(100.0 * (0.4 + 0.3 * (z_long is not None) + 0.3 * (mom30 is not None)), 0),
        "orientation": inst.orientation,
    }


def _inst_uses_monthly_window(inst: Instrument) -> bool:
    if inst.source == "tw_moea_csv":
        return True
    if inst.source == "fred" and inst.fred_frequency == "monthly":
        return True
    if inst.source == "computed" and inst.fred_frequency == "monthly":
        return True
    return False


def _trail_mode_for_instrument(inst: Instrument) -> TrailMode:
    if _inst_uses_monthly_window(inst):
        return "monthly"
    if inst.source == "eia_v2":
        return "weekly"
    return "daily"


def build_two_quarter_trail(ser: pd.Series, mode: TrailMode) -> List[Dict[str, Any]]:
    """
    三個時間點：本期、約一季前、約兩季前。
    - 月頻：索引往回 0 / 3 / 6 個月（約一季≈3個月）。
    - 週頻（EIA）：往回 0 / 13 / 26 週（約一季≈13週）。
    - 日頻：以最近交易日為準，取 ≤end、≤end-91天、≤end-182天 的最後觀測。
    """
    s = ser.dropna().astype(float).sort_index()
    out: List[Dict[str, Any]] = []
    labels = ("本期", "約1季前", "約2季前")

    if s.empty:
        return [
            {"label": lb, "date": None, "value": None, "value_fmt": None}
            for lb in labels
        ]

    if mode == "monthly":
        offsets = (0, 3, 6)
        for i, lb in enumerate(labels):
            off = offsets[i]
            if len(s) < off + 1:
                out.append({"label": lb, "date": None, "value": None, "value_fmt": None})
                continue
            row = s.iloc[-1 - off]
            dt = s.index[-1 - off]
            vf = _format_trail_value(float(row))
            out.append(
                {
                    "label": lb,
                    "date": str(dt.date()) if hasattr(dt, "date") else str(dt),
                    "value": float(row),
                    "value_fmt": vf,
                }
            )
        return out

    if mode == "weekly":
        offsets = (0, 13, 26)
        for i, lb in enumerate(labels):
            off = offsets[i]
            if len(s) < off + 1:
                out.append({"label": lb, "date": None, "value": None, "value_fmt": None})
                continue
            row = s.iloc[-1 - off]
            dt = s.index[-1 - off]
            vf = _format_trail_value(float(row))
            out.append(
                {
                    "label": lb,
                    "date": str(dt.date()) if hasattr(dt, "date") else str(dt),
                    "value": float(row),
                    "value_fmt": vf,
                }
            )
        return out

    # daily: calendar lookback (≈1季、2季)
    end = s.index.max()
    if not isinstance(end, pd.Timestamp):
        end = pd.Timestamp(end)
    targets = (0, 91, 182)
    for i, lb in enumerate(labels):
        if targets[i] == 0:
            row = s.iloc[-1]
            dt = s.index[-1]
            vf = _format_trail_value(float(row))
            out.append(
                {
                    "label": lb,
                    "date": str(dt.date()) if hasattr(dt, "date") else str(dt),
                    "value": float(row),
                    "value_fmt": vf,
                }
            )
            continue
        cut = end - pd.Timedelta(days=targets[i])
        sub = s[s.index <= cut]
        if sub.empty:
            out.append({"label": lb, "date": None, "value": None, "value_fmt": None})
        else:
            row = sub.iloc[-1]
            dt = sub.index[-1]
            vf = _format_trail_value(float(row))
            out.append(
                {
                    "label": lb,
                    "date": str(dt.date()) if hasattr(dt, "date") else str(dt),
                    "value": float(row),
                    "value_fmt": vf,
                }
            )
    # 曆日約2季前無觀測時：若序列仍有早於「約1季前」快照的資料，用最舊一筆（常見：第三方網頁表僅含滑動視窗）。
    if (
        mode == "daily"
        and len(out) == 3
        and out[2].get("value") is None
        and out[1].get("date")
        and len(s) >= 2
    ):
        first_dt = s.index[0]
        anchor1 = pd.Timestamp(out[1]["date"])
        if first_dt < anchor1:
            first_val = float(s.iloc[0])
            vf = _format_trail_value(first_val)
            out[2] = {
                "label": "約2季前",
                "date": str(first_dt.date()) if hasattr(first_dt, "date") else str(first_dt),
                "value": first_val,
                "value_fmt": vf,
                "fallback": "oldest_in_series",
            }
    return out


def build_signal_rows(
    wide_daily: pd.DataFrame,
    monthly_wide: pd.DataFrame,
    instruments: Optional[List[Instrument]] = None,
) -> List[Dict[str, Any]]:
    inst_list = instruments or default_instruments()
    rows: List[Dict[str, Any]] = []
    for inst in inst_list:
        if inst.source == "placeholder":
            rows.append(
                {
                    "id": inst.id,
                    "category": inst.category,
                    "category_zh": category_label_zh(inst.category),
                    "display_zh": inst.display_zh,
                    "display_en": inst.display_en,
                    "source": inst.source,
                    "score": None,
                    "latest": None,
                    "latest_date": None,
                    "quarter_trail": None,
                    "trail_mode": None,
                    "notes": inst.notes,
                    "detail": {"reason": "placeholder_no_free_source_yet"},
                }
            )
            continue

        ser = resolve_series_for_instrument(inst, wide_daily, monthly_wide)
        if ser is None or ser.dropna().empty:
            rows.append(
                {
                    "id": inst.id,
                    "category": inst.category,
                    "category_zh": category_label_zh(inst.category),
                    "display_zh": inst.display_zh,
                    "display_en": inst.display_en,
                    "source": inst.source,
                    "score": None,
                    "latest": None,
                    "latest_date": None,
                    "quarter_trail": None,
                    "trail_mode": None,
                    "notes": inst.notes,
                    "detail": {
                        "reason": "fetch_failed_or_empty",
                        "hint": (
                            "若為 EIA：請在 repo 根 .env 設定 EIA_API_KEY（API v2，見 SETUP_KEYS.md）"
                            if inst.source == "eia_v2"
                            else (
                                "請確認 repo 根 .env 的 FRED_API_KEY 在 fred.stlouisfed.org 帳號內為有效金鑰（API 回應 not registered 代表金鑰不被接受）。"
                                if inst.source == "fred"
                                else (
                                    "多為上游欄位缺失（例如 FRED 原油未取得時，WTI–Brent 價差無法計算）。"
                                    if inst.source == "computed"
                                    else None
                                )
                            )
                        ),
                    },
                }
            )
            continue

        is_monthly = _inst_uses_monthly_window(inst)
        detail = _shortage_score_for_series(ser, inst, is_monthly=is_monthly)
        trail_mode = _trail_mode_for_instrument(inst)
        quarter_trail = build_two_quarter_trail(ser, trail_mode)
        detail = {**detail, "trail_mode": trail_mode, "quarter_trail": quarter_trail}
        rows.append(
            {
                "id": inst.id,
                "category": inst.category,
                "category_zh": category_label_zh(inst.category),
                "display_zh": inst.display_zh,
                "display_en": inst.display_en,
                "source": inst.source,
                "score": detail["score"],
                "latest": detail["latest"],
                "latest_date": detail["latest_date"],
                "quarter_trail": quarter_trail,
                "trail_mode": trail_mode,
                "notes": inst.notes,
                "detail": detail,
            }
        )
    rows.sort(key=lambda r: (category_order().index(r["category"]), r["id"]))
    return rows


def build_payload(rows: List[Dict[str, Any]], *, generated_at_iso: str) -> Dict[str, Any]:
    return {
        "product": "shortage-radar",
        "version": 2,
        "generated_at": generated_at_iso,
        "trail_legend": (
            "月頻：本期與往回第3、6筆月資料（約各差一季）。"
            "週頻(EIA)：往回第0、13、26筆週資料。"
            "日頻：最近交易日與約91天、182天前的最近觀測；若來源僅提供短期滑動表（無法滿足182天），"
            "「約2季前」改為可取得之最舊觀測（畫面上標*）。"
        ),
        "categories": category_order(),
        "signals": rows,
    }
