"""Charts: regime bands, composite scores, backtest heatmaps."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # 僅存檔、不需視窗；避免無 GUI 環境崩潰

from output.summary import REGIME_CN

matplotlib.rcParams["axes.unicode_minus"] = False
# 讓圖上中文標題／註解可顯示（依系統字型 fallback）
matplotlib.rcParams["font.sans-serif"] = [
    "PingFang TC",
    "Heiti TC",
    "STHeiti",
    "Microsoft JhengHei",
    "Noto Sans CJK TC",
    "Arial Unicode MS",
    "DejaVu Sans",
]
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd


REGIME_COLORS = {
    "expansion": "#2ecc71",
    "recovery": "#27ae60",
    "overheating": "#e74c3c",
    "stagflation_risk": "#e67e22",
    "contraction": "#c0392b",
    "neutral": "#95a5a6",
}


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _footnote(fig, lines: list[str]) -> None:
    """Reserve space and draw a short 'how to read' note under the chart."""
    fig.subplots_adjust(bottom=0.22)
    fig.text(0.5, 0.03, "\n".join(lines), ha="center", va="bottom", fontsize=8, linespacing=1.35)


SCORE_LABEL_ZH = {
    "growth_score": "增長",
    "inflation_score": "通膨壓力",
    "liquidity_score": "流動性",
    "risk_score": "風險偏好",
}


def plot_regime_and_spy(df: pd.DataFrame, out_dir: Path) -> Path:
    """Price of SPY with regime background bands."""
    _ensure_dir(out_dir)
    if "etf_spy" not in df.columns or "regime" not in df.columns:
        return out_dir / "skip_regime_spy.png"

    fig, ax = plt.subplots(figsize=(14, 6))
    idx = df.index

    # Background bands by regime
    regimes = df["regime"].fillna("neutral")
    for i in range(len(df) - 1):
        r = regimes.iloc[i]
        c = REGIME_COLORS.get(r, "#cccccc")
        ax.axvspan(idx[i], idx[i + 1], alpha=0.25, color=c, linewidth=0)

    ax.plot(idx, df["etf_spy"], color="black", linewidth=1.2, label="SPY（週收盤）")
    ax.set_title(
        "SPY 與宏觀景氣階段（背景色）\n"
        "背景色＝當週 Regime；黑線＝股價。用來對照「不同階段時價格大致怎麼走」。",
        fontsize=11,
    )
    ax.set_ylabel("還原後收盤")
    ax.legend(loc="upper left")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate()
    fig.tight_layout(rect=[0, 0.1, 1, 1])
    _footnote(
        fig,
        [
            "讀圖：色塊只標示模型分類的階段，不是買賣訊號；顏色對照週報中的 Regime 名稱。",
        ],
    )
    out = out_dir / "regime_spy.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    return out


def plot_composite_scores(df: pd.DataFrame, out_dir: Path) -> Path:
    _ensure_dir(out_dir)
    cols = [c for c in ["growth_score", "inflation_score", "liquidity_score", "risk_score"] if c in df.columns]
    if not cols:
        return out_dir / "skip_composites.png"

    fig, ax = plt.subplots(figsize=(14, 6))
    for c in cols:
        zh = SCORE_LABEL_ZH.get(c, c)
        ax.plot(df.index, df[c], label=f"{zh}（{c}）")
    ax.axhline(0, color="gray", linewidth=0.8)
    ax.set_title(
        "四維宏觀分數（週）\n"
        "橫線 0＝中性；線在上方代表該維度訊號偏強、下方偏弱（通膨維度＝通膨壓力訊號）。",
        fontsize=11,
    )
    ax.legend(loc="upper left", fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate()
    fig.tight_layout(rect=[0, 0.1, 1, 1])
    _footnote(
        fig,
        [
            "讀圖：分數經 tanh 壓在約 ±1；看「相對高低」與「是否穿越 0」比看絕對數字更重要。",
        ],
    )
    out = out_dir / "composite_scores.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    return out


def plot_macro_temperature(df: pd.DataFrame, out_dir: Path) -> Path:
    _ensure_dir(out_dir)
    if "macro_temperature" not in df.columns:
        return out_dir / "skip_temp.png"

    fig, ax = plt.subplots(figsize=(14, 4))
    ax.fill_between(df.index, 0, df["macro_temperature"], alpha=0.35)
    ax.plot(df.index, df["macro_temperature"], color="steelblue", linewidth=1)
    ax.set_ylim(0, 100)
    ax.axhline(50, color="gray", linewidth=0.6, linestyle="--", alpha=0.7)
    ax.set_title(
        "宏觀溫度（0–100）\n"
        "綜合增長、通膨、流動性、風險後的分數；約 50 中性，越高代表模型彙總越「偏友善」。虛線＝ 50。",
        fontsize=11,
    )
    ax.set_ylabel("溫度")
    fig.autofmt_xdate()
    fig.tight_layout(rect=[0, 0.1, 1, 1])
    _footnote(
        fig,
        [
            "讀圖：與週報開頭「宏觀溫度」同一條序列；看趨勢與是否長期高／低於 50。",
        ],
    )
    out = out_dir / "macro_temperature.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    return out


def plot_regime_heatmap(summary: pd.DataFrame, out_dir: Path, metric: str = "mean") -> Path:
    """summary columns: regime, etf, horizon, split, mean, ..."""
    _ensure_dir(out_dir)
    sub = summary[summary["split"] == "all"].copy()
    if sub.empty:
        return out_dir / "skip_heatmap.png"

    # Pivot: rows regime, columns etf for one horizon e.g. 3m
    h = "3m"
    sub = sub[sub["horizon"] == h]
    pivot = sub.pivot(index="regime", columns="etf", values=metric)
    pivot = pivot.reindex(sorted(pivot.index))

    vals = pivot.values.astype(float)
    lim = float(np.nanmax(np.abs(vals))) if np.isfinite(vals).any() else 0.2
    lim = max(lim, 1e-6)
    fig, ax = plt.subplots(figsize=(10, 6))
    im = ax.imshow(vals, aspect="auto", cmap="RdYlGn", vmin=-lim, vmax=lim)
    ax.set_xticks(np.arange(pivot.shape[1]))
    ax.set_xticklabels(pivot.columns)
    ax.set_yticks(np.arange(pivot.shape[0]))
    ax.set_yticklabels([REGIME_CN.get(str(x), str(x)) for x in pivot.index])
    ax.set_title(
        f"景氣階段 × ETF：平均前瞻報酬（{metric}，約 {h}）\n"
        "列＝Regime，欄＝各 ETF；顏色愈綠／紅代表歷史樣本裡平均報酬愈正／負（僅統計，非預測）。",
        fontsize=11,
    )
    plt.colorbar(im, ax=ax, label="平均報酬（樣本內）")
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    fig.tight_layout(rect=[0, 0.12, 1, 1])
    _footnote(
        fig,
        [
            "讀圖：這是「過去在該 Regime 持有該 ETF 約三個月的平均結果」的熱度圖；實際未來會不同。",
        ],
    )
    out = out_dir / f"heatmap_{metric}_{h}.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    return out


def plot_spy_composite(df: pd.DataFrame, out_dir: Path) -> Path:
    """Dual-axis chart: spy_composite scores (left) vs SPY actual forward returns (right).

    A vertical dashed line separates the train / test periods based on the
    number of non-NaN composite rows (70 / 30 split).
    """
    _ensure_dir(out_dir)
    composite_cols = [c for c in ["spy_composite_4w", "spy_composite_13w"] if c in df.columns]
    fwd_cols = [c for c in ["spy_fwd_4w", "spy_fwd_13w"] if c in df.columns]
    if not composite_cols:
        return out_dir / "skip_spy_composite.png"

    fig, ax1 = plt.subplots(figsize=(14, 6))
    colors_composite = {"spy_composite_4w": "#2980b9", "spy_composite_13w": "#8e44ad"}
    colors_fwd = {"spy_fwd_4w": "#e74c3c", "spy_fwd_13w": "#e67e22"}

    for col in composite_cols:
        valid = df[col].dropna()
        if valid.empty:
            continue
        ax1.plot(df.index, df[col], label=col.replace("_", " "), linewidth=1.2,
                 color=colors_composite.get(col, "steelblue"))

    ax1.axhline(0, color="gray", linewidth=0.6, linestyle="--")
    ax1.set_ylabel("合成得分（標準化／tanh）", fontsize=10)

    ax2 = ax1.twinx()
    for col in fwd_cols:
        if col not in df.columns:
            continue
        ax2.plot(
            df.index,
            df[col] * 100,
            label=col.replace("spy_fwd_", "SPY 實際前瞻 ") + " %",
            linewidth=0.8,
            alpha=0.55,
            linestyle=":",
            color=colors_fwd.get(col, "salmon"),
        )

    ax2.set_ylabel("SPY 前瞻報酬（%）", fontsize=10)

    # Train/test divider: first composite with data, split at 70%
    if composite_cols:
        valid_idx = df[composite_cols[0]].dropna().index
        if len(valid_idx) > 1:
            n_train = int(len(valid_idx) * 0.70)
            split_date = valid_idx[n_train]
            ax1.axvline(split_date, color="black", linewidth=1.0, linestyle="--", alpha=0.7)
            ax1.text(split_date, ax1.get_ylim()[1] * 0.95, " 訓練｜測試",
                     fontsize=8, color="black", va="top")

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=8)
    ax1.set_title(
        "SPY 合成得分（Ridge）與實際前瞻報酬\n"
        "左軸＝模型分數；右軸虛線＝之後實際報酬（對照用）；直線＝訓練／測試切分。",
        fontsize=11,
    )
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate()
    fig.tight_layout(rect=[0, 0.1, 1, 1])
    _footnote(
        fig,
        [
            "讀圖：藍／紫線是「因子合成」的歷史分數；點線是事後才能看到的報酬，用來檢查模型是否大致同向。",
        ],
    )
    out = out_dir / "spy_composite.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    return out


def plot_rolling_ic(df: pd.DataFrame, out_dir: Path, window: int = 52) -> Path:
    """Rolling Spearman IC between each factor and SPY 4W forward return.

    IC (Information Coefficient) shows how predictive each macro factor is
    for SPY returns over a rolling window.
    """
    _ensure_dir(out_dir)
    factor_cols = [c for c in ["growth_score", "inflation_score", "liquidity_score", "risk_score"]
                   if c in df.columns]
    fwd_col = "spy_fwd_4w"
    if not factor_cols or fwd_col not in df.columns:
        return out_dir / "skip_rolling_ic.png"

    factor_colors = {
        "growth_score": "#27ae60",
        "inflation_score": "#e74c3c",
        "liquidity_score": "#2980b9",
        "risk_score": "#8e44ad",
    }

    fig, ax = plt.subplots(figsize=(14, 5))
    rolling_ics: dict[str, pd.Series] = {}

    for col in factor_cols:
        combined = df[[col, fwd_col]].dropna()
        # Rolling Spearman IC = Pearson correlation of rolling ranks
        rank_factor = combined[col].rolling(window).rank(pct=True)
        rank_fwd = combined[fwd_col].rolling(window).rank(pct=True)
        ic_series = rank_factor.rolling(window).corr(rank_fwd)
        ic_aligned = ic_series.reindex(df.index)
        rolling_ics[col] = ic_aligned
        ax.plot(
            df.index,
            ic_aligned,
            label=SCORE_LABEL_ZH.get(col, col),
            linewidth=1.2,
            color=factor_colors.get(col, None),
        )

    ax.axhline(0, color="gray", linewidth=0.8, linestyle="--")
    ax.axhline(0.05, color="gray", linewidth=0.5, linestyle=":")
    ax.axhline(-0.05, color="gray", linewidth=0.5, linestyle=":")
    ax.set_ylabel(f"滾動 {window} 週 Spearman IC（對 SPY 4W 前瞻報酬）")
    ax.set_title(
        f"滾動 IC：各因子對 SPY 的「預測力」變化（{window} 週視窗）\n"
        "IC 接近 1/-1 代表因子與後續報酬排序越同向／反向；虛線 ±0.05 僅作參考刻度。",
        fontsize=11,
    )
    ax.legend(loc="upper left", fontsize=9)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate()
    fig.tight_layout(rect=[0, 0.12, 1, 1])
    _footnote(
        fig,
        [
            "讀圖：IC 會隨時間漂移；某段期間高，不代表未來也高。",
        ],
    )
    out = out_dir / "rolling_ic.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    return out


def plotly_regime_heatmap_html(summary: pd.DataFrame, out_dir: Path) -> Path | None:
    try:
        import plotly.express as px
    except ImportError:
        return None
    _ensure_dir(out_dir)
    sub = summary[(summary["split"] == "all") & (summary["horizon"] == "3m")]
    if sub.empty:
        return None
    pivot_df = sub.pivot(index="regime", columns="etf", values="mean")
    pivot_df.index = [REGIME_CN.get(str(i), str(i)) for i in pivot_df.index]
    fig = px.imshow(
        pivot_df,
        color_continuous_midpoint=0,
        title="景氣階段 × ETF：平均前瞻報酬（約 3 個月，歷史樣本）｜列＝Regime，欄＝ETF；綠／紅僅為統計平均",
    )
    out = out_dir / "heatmap_3m_plotly.html"
    fig.write_html(str(out))
    return out
