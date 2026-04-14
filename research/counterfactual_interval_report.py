#!/usr/bin/env python3
"""
區間對照報表：可覆寫 Growth 權重，不修改主程式與預設 config。

讀取 macro_panel.csv → 暫時套用自訂 GrowthWeights → 重算 composite / regime / spy_fit
→ 僅對 [start, end] 輸出 Markdown 至 research/output/。

主看板與 output/web 完全不會被寫入。

Usage:
  python research/counterfactual_interval_report.py --start 2018-01-01 --end 2020-12-31 \\
    --growth-json '{"bdry_mom1_z":0.25,"durable_goods_z":0.20}'

  python research/counterfactual_interval_report.py --start 2018-01-01 --end 2020-12-31 \\
    --compare-baseline --growth-json '{"bdry_mom1_z":0.25,"durable_goods_z":0.20}'
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import OUTPUT_DIR, GrowthWeights  # noqa: E402
import config as config_module  # noqa: E402
import scores.composite as composite_module  # noqa: E402
from scores.composite import compute_composite_scores  # noqa: E402
from scores.regime import add_regime  # noqa: E402
from scores.spy_fit import fit_spy_composite  # noqa: E402


def _apply_growth_weights(gw: GrowthWeights) -> None:
    """同步寫入 config 與 scores.composite（後者曾用 from-config 綁定，僅改 config 無效）。"""
    config_module.GROWTH_W = gw
    composite_module.GROWTH_W = gw
from backtest.metrics import summarize_forward_returns  # noqa: E402
from backtest.engine import forward_total_return, FORWARD_WEEKS  # noqa: E402

DEFAULT_PANEL = OUTPUT_DIR / "macro_panel.csv"
OUT_DIR = Path(__file__).resolve().parent / "output"


def _spearman_ic(a: pd.Series, b: pd.Series) -> float:
    a = a.astype(float)
    b = b.reindex(a.index).astype(float)
    m = a.notna() & b.notna()
    a, b = a[m], b[m]
    if len(a) < 10:
        return float("nan")
    return float(np.corrcoef(a.rank(), b.rank())[0, 1])


def _merge_growth_weights(overrides: dict[str, float]) -> GrowthWeights:
    base = asdict(config_module.GROWTH_W)
    base.update(overrides)
    w = GrowthWeights(**base)
    s = (
        w.copper_mom3_z
        + w.bdry_mom1_z
        + w.nfp_change_z
        + w.unrate_trend_inv_z
        + w.durable_goods_z
    )
    if abs(s - 1.0) > 1e-6:
        raise SystemExit(
            f"Growth 權重加總必須為 1.0，目前為 {s:.6f}。"
            "請在 --growth-json 補齊五個欄位或調整數字。"
        )
    return w


def _run_pipeline(df: pd.DataFrame) -> pd.DataFrame:
    out = compute_composite_scores(df)
    out = add_regime(out)
    out, _ = fit_spy_composite(out)
    return out


def _report_slice(
    label: str,
    df: pd.DataFrame,
    start: str,
    end: str,
    baseline_regime: pd.Series | None,
) -> list[str]:
    mask = (df.index >= pd.Timestamp(start)) & (df.index <= pd.Timestamp(end))
    sub = df.loc[mask]
    lines: list[str] = [f"## {label}", "", f"- **區間**：{start} ~ {end}（含）", f"- **週數**：{len(sub)}", ""]

    if sub.empty:
        lines.append("（此區間無資料）\n")
        return lines

    # 前瞻報酬必須用全樣本價格再 .loc 到區間，否則 shift 在切片上會錯
    px_full = df["etf_spy"] if "etf_spy" in df.columns else None
    px = sub["etf_spy"] if "etf_spy" in sub.columns else None
    spy4 = (px_full.shift(-4) / px_full - 1.0).loc[sub.index] if px_full is not None else None

    if spy4 is not None and "growth_score" in sub.columns:
        ic = _spearman_ic(sub["growth_score"], spy4)
        lines.append(f"- **Spearman IC**（growth_score vs SPY 前瞻 4w）：{ic:.4f}")
        lines.append("")

    if "regime" in sub.columns:
        vc = sub["regime"].value_counts().sort_index()
        lines.append("### Regime 筆數")
        lines.append("")
        lines.append("| regime | 週數 |")
        lines.append("|--------|------|")
        for k, v in vc.items():
            lines.append(f"| {k} | {int(v)} |")
        lines.append("")

    if baseline_regime is not None and "regime" in sub.columns:
        br = baseline_regime.reindex(sub.index)
        diff = (br != sub["regime"]).sum()
        lines.append(f"- **與先驗 Regime 不一致週數**：{int(diff)} / {len(sub)}")
        lines.append("")

    if px_full is not None and "regime" in sub.columns:
        lines.append("### 各 Regime 下 SPY 前瞻報酬（4w / 13w / 26w）")
        lines.append("")
        for hlabel, hw in FORWARD_WEEKS.items():
            fwd = forward_total_return(px_full, hw).loc[sub.index]
            lines.append(f"**{hlabel}**")
            lines.append("")
            lines.append("| regime | n | mean | median | win_rate | max_dd |")
            lines.append("|--------|---|------|--------|----------|--------|")
            for reg in sorted(sub["regime"].dropna().unique()):
                idx = sub.index[sub["regime"] == reg]
                r = fwd.reindex(idx).dropna()
                m = summarize_forward_returns(r)
                lines.append(
                    f"| {reg} | {m['n']} | {m['mean']:.4f} | {m['median']:.4f} | "
                    f"{m['win_rate']:.2f} | {m['max_dd']:.4f} |"
                )
            lines.append("")

    if "macro_temperature" in sub.columns:
        lines.append("### 宏觀溫度（區間內）")
        lines.append("")
        lines.append(
            f"- min / max / mean：{sub['macro_temperature'].min():.2f} / "
            f"{sub['macro_temperature'].max():.2f} / {sub['macro_temperature'].mean():.2f}"
        )
        lines.append("")

    lines.append("---\n")
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(
        description="自訂 Growth 權重，僅輸出區間報表（不寫入主看板）",
    )
    parser.add_argument("--panel", type=Path, default=DEFAULT_PANEL, help="macro_panel.csv")
    parser.add_argument("--start", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="YYYY-MM-DD")
    parser.add_argument(
        "--growth-json",
        default="{}",
        help='覆寫 Growth 欄位，JSON 物件，例如 \'{"bdry_mom1_z":0.25,"durable_goods_z":0.2}\'',
    )
    parser.add_argument(
        "--compare-baseline",
        action="store_true",
        help="同時計算「目前 config 先驗」與自訂權重並對照",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="輸出 Markdown 路徑（預設 research/output/counterfactual_<start>_<end>.md）",
    )
    args = parser.parse_args()

    try:
        overrides: dict[str, float] = json.loads(args.growth_json)
    except json.JSONDecodeError as e:
        raise SystemExit(f"無效的 --growth-json: {e}") from e

    if not isinstance(overrides, dict):
        raise SystemExit("--growth-json 必須是 JSON 物件")

    if not args.panel.exists():
        raise SystemExit(f"找不到面板：{args.panel}（請先執行 python main.py score）")

    df_raw = pd.read_csv(args.panel, index_col=0, parse_dates=True)

    saved_gw = config_module.GROWTH_W
    baseline_reg: pd.Series | None = None
    df_baseline: pd.DataFrame | None = None

    sections: list[str] = [
        "# 區間對照報表（研究用）",
        "",
        f"- **面板**：`{args.panel}`",
        f"- **自訂 Growth 覆寫**：`{args.growth_json}`",
        "- **說明**：僅暫時改 `config.GROWTH_W` 於此程序內，結束後還原；**不**寫入 `output/web` 與主程式。",
        "",
        "---",
        "",
    ]

    try:
        if args.compare_baseline:
            _apply_growth_weights(saved_gw)
            df_baseline = _run_pipeline(df_raw.copy())
            baseline_reg = df_baseline["regime"].copy()
            sections.extend(
                _report_slice("先驗權重（目前 config）", df_baseline, args.start, args.end, None)
            )

        custom_w = _merge_growth_weights(overrides)
        _apply_growth_weights(custom_w)
        sections.append("### 本次使用的完整 GrowthWeights")
        sections.append("")
        sections.append("```json")
        sections.append(json.dumps(asdict(custom_w), indent=2, ensure_ascii=False))
        sections.append("```")
        sections.append("")

        df_custom = _run_pipeline(df_raw.copy())
        sections.extend(
            _report_slice(
                "自訂權重結果",
                df_custom,
                args.start,
                args.end,
                baseline_reg if args.compare_baseline else None,
            )
        )

        if args.compare_baseline and df_baseline is not None:
            m = (df_baseline.index >= pd.Timestamp(args.start)) & (
                df_baseline.index <= pd.Timestamp(args.end)
            )
            g0 = df_baseline.loc[m, "growth_score"]
            g1 = df_custom.loc[m, "growth_score"]
            sections.append("## 先驗 vs 自訂（僅 growth_score）")
            sections.append("")
            sections.append(f"- Pearson 相關：{float(g0.corr(g1)):.4f}")
            sections.append(f"- 平均絕對差：{float((g1 - g0).abs().mean()):.4f}")
            sections.append("")
    finally:
        _apply_growth_weights(saved_gw)

    text = "\n".join(sections)
    out_path = args.out
    if out_path is None:
        safe_start = args.start.replace("-", "")
        safe_end = args.end.replace("-", "")
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUT_DIR / f"counterfactual_{safe_start}_{safe_end}.md"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")
    print(text)
    print(f"\n[written] {out_path}")


if __name__ == "__main__":
    main()
