#!/usr/bin/env python3
"""
Side-branch analysis: estimate "data-driven" weights vs config priors.

Does NOT modify main.py or config. Reads output/artifacts/macro_panel.csv
(produced by `python main.py score`).

Method: Ridge regression of SPY forward returns on each pillar's raw z-score
columns (same TRAIN_FRAC / RIDGE_ALPHA as scores/spy_fit.py). Reports raw
coefficients and a simple |beta|-normalized "relative importance" for comparison
to prior weights (which sum to 1 within each pillar).

Usage:
  cd /path/to/eco\\ temperature
  python research/analyze_learned_weights.py
  python research/analyze_learned_weights.py --panel path/to/macro_panel.csv
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import (  # noqa: E402
    GROWTH_W,
    INFLATION_W,
    LIQUIDITY_W,
    OUTPUT_DIR,
    RIDGE_ALPHA,
    RISK_W,
    TRAIN_FRAC,
)
from scores.spy_fit import (  # noqa: E402
    FACTOR_COLS,
    HORIZONS,
    _ridge_fit,
    _r2,
    _spearman_ic,
    compute_spy_forward_returns,
)

PANEL_DEFAULT = OUTPUT_DIR / "macro_panel.csv"
OUT_REPORT = Path(__file__).resolve().parent / "output" / "weight_analysis_report.md"

GROWTH_COLS = list(asdict(GROWTH_W).keys())
INFLATION_COLS = list(asdict(INFLATION_W).keys())
LIQUIDITY_COLS = list(asdict(LIQUIDITY_W).keys())
# Risk pillar uses macro scores + curve term; sub-linear part:
RISK_SCORE_KEYS = ["growth_score", "inflation_score", "liquidity_score"]


def _norm_abs(beta: np.ndarray) -> np.ndarray:
    """Normalize absolute values to sum to 1 (for side-by-side with priors)."""
    s = float(np.sum(np.abs(beta)))
    if s <= 0:
        return np.full_like(beta, np.nan)
    return np.abs(beta) / s


def _fit_block(
    df: pd.DataFrame,
    cols: list[str],
    fwd_col: str,
) -> tuple[np.ndarray, float, float, float, float, int, int] | None:
    """Ridge: y ~ X. Returns beta, ic_train, ic_test, r2_train, r2_test, n_train, n_test."""
    need = [c for c in cols if c in df.columns]
    if len(need) < 2:
        return None
    sub = df[need + [fwd_col]].dropna()
    if len(sub) < 30:
        return None
    X_all = sub[need].values.astype(float)
    y_all = sub[fwd_col].values.astype(float)
    finite = np.isfinite(X_all).all(axis=1) & np.isfinite(y_all)
    X_all, y_all = X_all[finite], y_all[finite]
    if len(X_all) < 30:
        return None
    n_train = max(15, int(len(sub) * TRAIN_FRAC))
    X_train, y_train = X_all[:n_train], y_all[:n_train]
    X_test, y_test = X_all[n_train:], y_all[n_train:]
    beta, intercept = _ridge_fit(X_train, y_train, RIDGE_ALPHA)
    with np.errstate(divide="ignore", over="ignore", under="ignore", invalid="ignore"):
        pred_train = X_train @ beta + intercept
        pred_test = X_test @ beta + intercept if len(y_test) > 0 else np.array([])
    r2_tr = _r2(y_train, pred_train)
    r2_te = _r2(y_test, pred_test) if len(pred_test) > 0 else float("nan")
    ic_tr = _spearman_ic(y_train, pred_train)
    ic_te = _spearman_ic(y_test, pred_test) if len(pred_test) > 4 else float("nan")
    return beta, ic_tr, ic_te, r2_tr, r2_te, n_train, len(y_test)


def _prior_vec(cols: list[str], priors: dict[str, float]) -> np.ndarray:
    return np.array([priors.get(c, 0.0) for c in cols], dtype=float)


def run_analysis(panel_path: Path) -> str:
    if not panel_path.exists():
        return (
            f"# 權重分析報告\n\n"
            f"**找不到面板檔**：`{panel_path}`\n\n"
            f"請先在本機執行：\n\n"
            f"```bash\npython main.py fetch   # 若尚無 macro.db\npython main.py score\n```\n\n"
            f"會產生 `{PANEL_DEFAULT}` 後再執行本腳本。\n"
        )

    df = pd.read_csv(panel_path, index_col=0, parse_dates=True)
    df = compute_spy_forward_returns(df)

    lines: list[str] = [
        "# 資料驅動權重 vs 先驗（研究用，未改主程式）",
        "",
        f"- **面板**：`{panel_path}`（{len(df)} 列）",
        f"- **方法**：與 `scores/spy_fit.py` 相同之 Ridge（`RIDGE_ALPHA={RIDGE_ALPHA}`, `TRAIN_FRAC={TRAIN_FRAC}`）",
        f"- **目標變數**：`spy_fwd_4w`、`spy_fwd_13w`（週報酬）",
        "- **說明**：下列「學習權重」為 **Ridge 係數**；另將 **|β| 正規化加總為 1** 僅供與先驗「同維度內佔比」直覺對照，**不**等於機率或最優保證。",
        "",
        "---",
        "",
    ]

    priors_g = asdict(GROWTH_W)
    priors_i = asdict(INFLATION_W)
    priors_l = asdict(LIQUIDITY_W)

    for label, weeks in HORIZONS.items():
        fwd = f"spy_fwd_{label}"
        if fwd not in df.columns or df[fwd].notna().sum() < 40:
            lines.append(f"## 前瞻 {label}\n\n資料不足，略過。\n\n---\n\n")
            continue

        lines.append(f"## 前瞻 {label}（約 {weeks} 週）\n")

        blocks = [
            ("Growth（子因子 z）", GROWTH_COLS, priors_g),
            ("Inflation（子因子 z）", INFLATION_COLS, priors_i),
            ("Liquidity（子因子 z）", LIQUIDITY_COLS, priors_l),
        ]

        for title, cols, priors in blocks:
            avail = [c for c in cols if c in df.columns]
            if len(avail) < 2:
                lines.append(f"### {title}\n\n欄位不足，略過。\n\n")
                continue
            res = _fit_block(df, avail, fwd)
            if res is None:
                lines.append(f"### {title}\n\n樣本不足，略過。\n\n")
                continue
            beta, ic_tr, ic_te, r2_tr, r2_te, n_tr, n_te = res
            prior_v = _prior_vec(avail, priors)
            learned_norm = _norm_abs(beta)

            lines.append(f"### {title}\n")
            lines.append(f"- Train/Test 列數：{n_tr} / {n_te}")
            lines.append(f"- R² train / test：{r2_tr:.4f} / {r2_te:.4f}")
            lines.append(f"- Spearman IC train / test：{ic_tr:.4f} / {ic_te:.4f}")
            lines.append("")
            lines.append("| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |")
            lines.append("|--------|----------|---------|----------|")
            for i, c in enumerate(avail):
                lines.append(
                    f"| {c} | {prior_v[i]:.4f} | {beta[i]:+.6f} | {learned_norm[i]:.4f} |"
                )
            lines.append("")

        # Risk: linear part uses 3 scores + optional curve boost in composite;
        # here we only fit the 3 score linear part + curve_mom_3m_abs if present
        risk_cols = [c for c in RISK_SCORE_KEYS if c in df.columns]
        if "curve_mom_3m_abs" in df.columns:
            risk_cols = risk_cols + ["curve_mom_3m_abs"]
        if len(risk_cols) >= 2:
            res_r = _fit_block(df, risk_cols, fwd)
            if res_r:
                beta, ic_tr, ic_te, r2_tr, r2_te, n_tr, n_te = res_r
                lines.append("### Risk（對 SPY：growth / inflation / liquidity 分數 + curve_mom_3m_abs）\n")
                lines.append(
                    f"- 先驗線性係數參考（config RiskWeights）："
                    f"growth={RISK_W.growth}, inflation_inv={RISK_W.inflation_inv}, liquidity={RISK_W.liquidity}"
                )
                lines.append(f"- Train/Test：{n_tr} / {n_te}；R²：{r2_tr:.4f} / {r2_te:.4f}；IC：{ic_tr:.4f} / {ic_te:.4f}")
                lines.append("")
                lines.append("| 欄位 | Ridge β |")
                lines.append("|------|---------|")
                for i, c in enumerate(risk_cols):
                    lines.append(f"| {c} | {beta[i]:+.6f} |")
                lines.append("")

        # Four macro scores → SPY (same as spy_fit)
        fac = [c for c in FACTOR_COLS if c in df.columns]
        if len(fac) == 4:
            res4 = _fit_block(df, fac, fwd)
            if res4:
                beta4, ic_tr, ic_te, r2_tr, r2_te, n_tr, n_te = res4
                lines.append("### 四維 macro 分數 → SPY（對照 `spy_fit` 係數尺度）\n")
                lines.append(f"- R² train/test：{r2_tr:.4f} / {r2_te:.4f}；IC train/test：{ic_tr:.4f} / {ic_te:.4f}")
                lines.append("")
                lines.append("| 因子 | Ridge β |")
                lines.append("|------|---------|")
                for i, c in enumerate(fac):
                    lines.append(f"| {c} | {beta4[i]:+.6f} |")
                lines.append("")

        lines.append("---\n")

    lines.extend(
        [
            "## 解讀備註",
            "",
            "1. **先驗權重**（20% 等）是敘事結構；**Ridge β** 在「預測 SPY 前瞻報酬」目標下由樣本估出，兩者目的不同。",
            "2. 子因子之間常有 **共線性**，Ridge 會縮小係數，|β| 歸一僅供「相對強弱」參考。",
            "3. **測試集**表現（R²、IC）若明顯弱於訓練集，代表不宜過度解讀「最優」權重。",
            "",
        ]
    )

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Learned weights vs priors (research)")
    parser.add_argument(
        "--panel",
        type=Path,
        default=PANEL_DEFAULT,
        help=f"Path to macro_panel.csv (default: {PANEL_DEFAULT})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=OUT_REPORT,
        help=f"Output markdown (default: {OUT_REPORT})",
    )
    args = parser.parse_args()

    text = run_analysis(args.panel)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding="utf-8")
    print(text)
    print(f"\n[written] {args.out}")


if __name__ == "__main__":
    main()
