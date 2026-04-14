"""Generate weekly-style narrative summary in Traditional Chinese."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from config import OUTPUT_DIR


REGIME_CN = {
    "expansion": "擴張",
    "recovery": "復甦早期",
    "overheating": "過熱",
    "stagflation_risk": "滯脹風險",
    "contraction": "收縮",
    "neutral": "中性震盪",
}


def _last_valid(s: pd.Series) -> float | None:
    s = s.dropna()
    if s.empty:
        return None
    return float(s.iloc[-1])


def _fmt_coef(val: float) -> str:
    return f"{val:+.4f}"


def _how_to_read_intro() -> list[str]:
    """Short guide so the report reads like a person explaining the dashboard."""
    return [
        "【怎麼讀這份週報】",
        "  · 宏觀溫度（0–100）：把增長、通膨壓力、流動性、風險偏好四個維度加總後映射成分數；約 50 中性，越高代表模型彙總起來「環境對風險資產較友善」的訊號越多（仍是摘要指標，不是漲跌保證）。",
        "  · Regime（景氣階段）：用規則把同一週的增長／通膨／流動性組合分類，方便和圖表裡的背景色對照；名稱是標籤，不是預測。",
        "  · 四個分數（約 -1～+1，0 為中性）：數字越大，代表該維度的「訊號越強」——增長、通膨壓力、金融條件寬鬆度、風險偏好。正負要看欄位語意（例如通膨分數高＝通膨壓力訊號強）。",
        "  · 指標動能：多半是近幾個月的變化率或水準，用來描述「最近經濟與市場在往哪邊動」；對照分數可看出背後是哪些價格或數據在推。",
        "",
    ]


def _human_score_snapshot(last: pd.Series) -> str:
    """One paragraph tying the four scores to plain language."""

    def _sign_word(v: float, high: str, low: str) -> str:
        if v > 0.15:
            return high
        if v < -0.15:
            return low
        return "大致中性"

    g = float(last.get("growth_score", 0) or 0)
    inf = float(last.get("inflation_score", 0) or 0)
    liq = float(last.get("liquidity_score", 0) or 0)
    rk = float(last.get("risk_score", 0) or 0)

    parts = [
        f"增長面向{_sign_word(g, '偏強', '偏弱')}（{g:+.3f}）",
        f"通膨壓力訊號{_sign_word(inf, '偏強', '偏弱')}（{inf:+.3f}）",
        f"流動性／金融條件{_sign_word(liq, '偏寬鬆', '偏緊')}（{liq:+.3f}）",
        f"風險偏好{_sign_word(rk, '偏高', '偏低')}（{rk:+.3f}）",
    ]
    return "這週四個維度合起來：" + "；".join(parts) + "。可把這段當成「人話摘要」，再對照下方逐項數字與圖表。"


def _build_spy_fit_block(spy_stats: dict) -> list[str]:
    """Format the Ridge regression stats section for the report."""
    lines: list[str] = [
        "",
        "SPY 擬合統計（Ridge Regression，非投資建議）：",
        "  （白話）用歷史週資料估計：各宏觀因子對「之後幾週 SPY 報酬」大致有多強的線性關係。β 是權重；R² 是樣本內／外大致解釋力；IC 是因子與報酬的排序相關（越高代表方向越常同向，仍非保證）。",
    ]
    factor_labels = {
        "growth_score": "Growth",
        "inflation_score": "Inflation",
        "liquidity_score": "Liquidity",
        "risk_score": "Risk",
    }
    for label, weeks in [("4w", "4 週"), ("13w", "13 週")]:
        coef_key = f"coef_{label}"
        if coef_key not in spy_stats:
            continue
        r2_train = spy_stats.get(f"r2_train_{label}", float("nan"))
        r2_test = spy_stats.get(f"r2_test_{label}", float("nan"))
        ic_train = spy_stats.get(f"ic_train_{label}", float("nan"))
        ic_test = spy_stats.get(f"ic_test_{label}", float("nan"))
        n_train = spy_stats.get(f"n_train_{label}", "?")
        n_test = spy_stats.get(f"n_test_{label}", "?")

        lines.append(f"  [{weeks} 視野]")
        coefs = spy_stats[coef_key]
        for factor, cn in factor_labels.items():
            if factor in coefs:
                lines.append(f"    β_{cn}: {_fmt_coef(coefs[factor])}")

        def _pct(v: float) -> str:
            return f"{v * 100:.1f}%" if v == v else "N/A"

        lines.append(f"    R²  訓練({n_train}週)={_pct(r2_train)}  測試({n_test}週)={_pct(r2_test)}")
        lines.append(f"    IC  訓練={_pct(ic_train)}  測試={_pct(ic_test)}")
    return lines


def build_summary_text(df: pd.DataFrame, spy_stats: dict | None = None) -> str:
    """One-page narrative from the latest weekly row."""
    df = df.sort_index()
    last = df.iloc[-1]
    idx = df.index[-1]

    regime = str(last.get("regime", "neutral"))
    temp = last.get("macro_temperature", float("nan"))
    if pd.isna(temp):
        temp_str = "N/A"
    else:
        temp_str = f"{float(temp):.1f}"

    lines = [
        f"【宏觀週報】截至 {idx.strftime('%Y-%m-%d')}（週五收盤近似）",
        "",
    ]
    lines.extend(_how_to_read_intro())
    lines.extend(
        [
            f"今日宏觀溫度：{temp_str}/100，Regime：{REGIME_CN.get(regime, regime)}",
            "",
            _human_score_snapshot(last),
            "",
            "分數摘要（對照上面白話）：",
        ]
    )
    for k, label in [
        ("growth_score", "Growth（增長）"),
        ("inflation_score", "Inflation（通膨壓力）"),
        ("liquidity_score", "Liquidity（流動性／金融條件）"),
        ("risk_score", "Risk（風險偏好）"),
    ]:
        v = last.get(k)
        if pd.notna(v):
            lines.append(f"  - {label}: {float(v):+.3f}")

    lines.extend(
        [
            "",
            "指標動能（約 3 個月 % 變化，若可得；用來看「最近誰在推動訊號」）：",
        ]
    )
    for k, label, fmt in [
        ("copper_mom_3m", "銅", "+.2f"),
        ("bdry_mom_1m", "BDRY 代理（乾散貨）", "+.2f"),
        ("wti_mom_3m", "WTI 原油", "+.2f"),
        ("durable_goods_mom", "耐久財新訂單 MoM", "+.1f"),
        ("bke_mom_3m", "Breakeven 通膨預期 3M 動能", "+.2f"),
        ("hy_oas", "HY 信用利差 (OAS)", ".0f"),
        ("real_yield_10y", "10Y 實質殖利率", "+.2f"),
    ]:
        if k in last.index and pd.notna(last[k]):
            val = float(last[k])
            suffix = "%" if "mom" in k else (" bps" if k == "hy_oas" else ("%" if k == "real_yield_10y" else ""))
            lines.append(f"  - {label}: {val:{fmt}}{suffix}")

    if spy_stats:
        lines.extend(_build_spy_fit_block(spy_stats))

    lines.extend(
        [
            "",
            "解讀（規則式、非投資建議）：",
            _interpret_blurb(regime, last),
            "",
            "圖表怎麼一起看：",
            "  · regime_spy：背景色＝當週 Regime，黑線＝ SPY 週收盤；看「不同顏色區間裡價格大概怎麼走」當歷史對照。",
            "  · composite_scores：四條線是四個分數；橫線 0 是中性。",
            "  · macro_temperature：0–100 的綜合溫度曲線，與週報開頭數字同源。",
            "  · spy_composite：藍／紫線＝模型合成的 SPY 分數；紅橘虛線＝實際後續報酬（對照用）；直線＝訓練／測試切分。",
            "  · rolling_ic：各因子與 SPY 後續報酬的滾動相關，離 0 越遠代表那段期間「預測力」較明顯（仍會隨時間變）。",
            "  · heatmap：列＝Regime、欄＝各 ETF，顏色＝該組合下過去樣本的平均前瞻報酬（僅歷史統計）。",
            "",
            "免責：本輸出僅供研究，不構成投資建議。",
        ]
    )
    return "\n".join(lines)


def _interpret_blurb(regime: str, row: pd.Series) -> str:
    if regime == "expansion":
        return "多項增長訊號相對強、通膨壓力未失控，風險資產環境相對友善（仍須注意估值與事件風險）。"
    if regime == "recovery":
        return "增長動能改善中，可能對景氣循環與工業相關資產較有利。"
    if regime == "overheating":
        return "增長與通膨同強，需留意原物料與政策緊縮預期對資產評價的壓力。"
    if regime == "stagflation_risk":
        return "增長偏弱而通膨壓力偏高，傳統股債配置可能較為尷尬，宜保守與分散。"
    if regime == "contraction":
        return "增長偏弱且流動性偏緊，防禦與現金管理重要性上升。"
    return "訊號混雜，偏向區間震盪；宜降低槓桿、以流程與風控為主。"


def write_summary_report(
    df: pd.DataFrame,
    out_dir: Path | None = None,
    spy_stats: dict | None = None,
) -> Path:
    out_dir = out_dir or OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    text = build_summary_text(df, spy_stats=spy_stats)
    path = out_dir / "weekly_summary_zh-TW.txt"
    path.write_text(text, encoding="utf-8")
    return path
