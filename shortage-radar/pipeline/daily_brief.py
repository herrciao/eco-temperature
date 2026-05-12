"""
Shortage Radar — Daily Brief Generator

Compares today's shortage_signals.json with the previous snapshot (.prev.json),
produces a standard-edition Markdown morning report, and optionally sends it
via email (--send flag, requires SMTP env vars).

Run (standalone):
    cd shortage-radar
    PYTHONPATH=. python -m pipeline.daily_brief
    PYTHONPATH=. python -m pipeline.daily_brief --send
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import click

from srpkg.settings import OUTPUT_DIR, category_label_zh

# ── helpers ──────────────────────────────────────────────────────────────────

SCORE_LABELS = [
    (70, "供給偏緊"),
    (58, "偏緊"),
    (45, "中性"),
    (35, "偏鬆"),
    (0,  "供給偏鬆"),
]


def _score_label(score: Optional[float]) -> str:
    if score is None:
        return "無資料"
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return f"{label} ({score:.0f})"
    return f"供給偏鬆 ({score:.0f})"


def _load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _signals_by_id(payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {s["id"]: s for s in payload.get("signals", [])}


def _pct(a: Optional[float], b: Optional[float]) -> Optional[float]:
    """Percentage change from a to b."""
    if a is None or b is None or a == 0:
        return None
    return (b / a - 1.0) * 100.0


def _fmt_delta_score(d: float) -> str:
    sign = "+" if d >= 0 else ""
    return f"{sign}{d:.1f}"


def _fmt_pct(p: float) -> str:
    sign = "+" if p >= 0 else ""
    return f"{sign}{p:.1f}%"


def _berlin_now() -> str:
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.now(ZoneInfo("Europe/Berlin"))
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y/%m/%d %H:%M %Z")


# ── core diff logic ───────────────────────────────────────────────────────────

def _build_diff(
    today_signals: Dict[str, Dict[str, Any]],
    prev_signals: Dict[str, Dict[str, Any]],
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Returns:
        score_movers  — list of {id, display_zh, category, delta_score, today_score}
        price_movers  — list of {id, display_zh, category, delta_pct, trail_mode}
        newly_published — list of {id, display_zh, category, latest_date, latest}
    """
    score_movers: List[Dict] = []
    price_movers: List[Dict] = []
    newly_published: List[Dict] = []

    for sid, today in today_signals.items():
        prev = prev_signals.get(sid)

        ts = today.get("score")
        ps = prev.get("score") if prev else None
        if ts is not None and ps is not None:
            delta_score = ts - ps
            if abs(delta_score) >= 0.05:
                score_movers.append({
                    "id": sid,
                    "display_zh": today.get("display_zh", sid),
                    "category": today.get("category", ""),
                    "delta_score": delta_score,
                    "today_score": ts,
                })

        tl = today.get("latest")
        pl = prev.get("latest") if prev else None
        trail_mode = today.get("trail_mode", "daily")
        if trail_mode in ("daily", "weekly") and tl is not None and pl is not None and pl != 0:
            dp = _pct(pl, tl)
            if dp is not None and abs(dp) >= 0.01:
                price_movers.append({
                    "id": sid,
                    "display_zh": today.get("display_zh", sid),
                    "category": today.get("category", ""),
                    "delta_pct": dp,
                    "trail_mode": trail_mode,
                })

        t_date = today.get("latest_date")
        p_date = prev.get("latest_date") if prev else None
        if t_date and t_date != p_date and trail_mode == "monthly":
            newly_published.append({
                "id": sid,
                "display_zh": today.get("display_zh", sid),
                "category": today.get("category", ""),
                "latest_date": t_date,
                "latest": tl,
            })
        elif t_date and t_date != p_date and trail_mode == "weekly":
            newly_published.append({
                "id": sid,
                "display_zh": today.get("display_zh", sid),
                "category": today.get("category", ""),
                "latest_date": t_date,
                "latest": tl,
                "weekly": True,
            })

    score_movers.sort(key=lambda x: x["delta_score"])
    price_movers.sort(key=lambda x: x["delta_pct"])
    return score_movers, price_movers, newly_published


# ── Markdown builder ──────────────────────────────────────────────────────────

CAT_ORDER = ["energy", "power", "semiconductor", "metals", "battery", "agriculture", "leading"]


def build_markdown(today_payload: Dict[str, Any], prev_payload: Optional[Dict[str, Any]]) -> str:
    today_signals = _signals_by_id(today_payload)
    prev_signals = _signals_by_id(prev_payload) if prev_payload else {}

    generated_at = today_payload.get("generated_at", "")
    berlin_time = _berlin_now()

    lines: List[str] = []

    lines.append(f"# Shortage Radar — Daily Brief")
    lines.append(f"")
    lines.append(f"**產生時間（柏林）：** {berlin_time}")
    lines.append(f"**資料快照時間（UTC）：** {generated_at}")
    lines.append(f"")
    lines.append("---")
    lines.append("")

    # ── Section 0: 各分類緊張度概覽 ──
    lines.append("## 各分類緊張度概覽")
    lines.append("")

    cat_score: Dict[str, List[float]] = {}
    for sig in today_signals.values():
        cat = sig.get("category", "")
        s = sig.get("score")
        if s is not None:
            cat_score.setdefault(cat, []).append(s)

    for cat in CAT_ORDER:
        scores = cat_score.get(cat, [])
        if scores:
            avg = sum(scores) / len(scores)
        else:
            avg = None
        label = category_label_zh(cat)
        lines.append(f"- **{label}**：{_score_label(avg)}")
    lines.append("")
    lines.append("---")
    lines.append("")

    score_movers, price_movers, newly_published = _build_diff(today_signals, prev_signals)

    # ── Section A: Score 變動 top 5 上/下 ──
    lines.append("## A. 緊張度分數變動（vs 前次快照）")
    lines.append("")

    top_up = [x for x in score_movers if x["delta_score"] > 0][-5:][::-1]
    top_dn = [x for x in score_movers if x["delta_score"] < 0][:5]

    if not top_up and not top_dn:
        lines.append("*本次快照與前次相比，分數無顯著變動（可能為週末或無新資料）。*")
    else:
        if top_up:
            lines.append("**上升（偏緊方向）：**")
            for row in top_up:
                cat_zh = category_label_zh(row["category"])
                lines.append(
                    f"  - {row['display_zh']} [{cat_zh}] "
                    f"→ {_fmt_delta_score(row['delta_score'])} "
                    f"（現為 {row['today_score']:.0f}）"
                )
        if top_dn:
            lines.append("")
            lines.append("**下降（偏鬆方向）：**")
            for row in top_dn:
                cat_zh = category_label_zh(row["category"])
                lines.append(
                    f"  - {row['display_zh']} [{cat_zh}] "
                    f"→ {_fmt_delta_score(row['delta_score'])} "
                    f"（現為 {row['today_score']:.0f}）"
                )
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Section B: 價格日漲跌幅 top 5 上/下 ──
    lines.append("## B. 價格漲跌幅（日頻/週頻，vs 前次快照）")
    lines.append("")

    p_up = [x for x in price_movers if x["delta_pct"] > 0][-5:][::-1]
    p_dn = [x for x in price_movers if x["delta_pct"] < 0][:5]

    if not p_up and not p_dn:
        lines.append("*無日頻/週頻價格變動（可能為非交易日）。*")
    else:
        if p_up:
            lines.append("**漲幅前 5：**")
            for row in p_up:
                lines.append(f"  - {row['display_zh']}：{_fmt_pct(row['delta_pct'])}")
        if p_dn:
            lines.append("")
            lines.append("**跌幅前 5：**")
            for row in p_dn:
                lines.append(f"  - {row['display_zh']}：{_fmt_pct(row['delta_pct'])}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Section C: 新公布週/月資料 ──
    lines.append("## C. 本週/本月新公布資料")
    lines.append("")
    if not newly_published:
        lines.append("*本次無新公布的週頻或月頻資料。*")
    else:
        for row in newly_published:
            cat_zh = category_label_zh(row["category"])
            v = row.get("latest")
            v_str = f"{v:,.3f}".rstrip("0").rstrip(".") if v is not None else "—"
            freq_tag = "（週頻新值）" if row.get("weekly") else "（月頻新值）"
            lines.append(
                f"  - **{row['display_zh']}** [{cat_zh}]{freq_tag} "
                f"最新值 {v_str}，日期 {row['latest_date']}"
            )
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Section D: 資料源失敗清單 ──
    failed = [
        s for s in today_signals.values()
        if s.get("score") is None and s.get("source") != "placeholder"
    ]
    if failed:
        lines.append("## D. 資料源取得失敗")
        lines.append("")
        for s in failed:
            hint = (s.get("detail") or {}).get("hint", "")
            lines.append(f"  - {s.get('display_zh', s['id'])}（{s.get('source')}）{': ' + hint if hint else ''}")
        lines.append("")
        lines.append("---")
        lines.append("")

    # ── Footer ──
    dashboard_url = os.environ.get("DASHBOARD_URL", "https://your-vercel-app.vercel.app/shortage-radar")
    lines.append(f"[Dashboard]({dashboard_url}) | "
                 f"[Raw JSON]({dashboard_url.replace('/shortage-radar', '')}/api/shortage-signals)")
    lines.append("")
    lines.append("*此報告由 GitHub Actions 自動產生。分數為價格/動能 proxy，非真實庫存模型。*")

    return "\n".join(lines)


# ── CLI entry point ───────────────────────────────────────────────────────────

@click.command()
@click.option("--send/--no-send", default=False, help="透過 SMTP 寄出郵件")
@click.option(
    "--today-json",
    default=str(OUTPUT_DIR / "shortage_signals.json"),
    help="今日 JSON 路徑",
)
@click.option(
    "--prev-json",
    default=str(OUTPUT_DIR / "shortage_signals.prev.json"),
    help="前日快照 JSON 路徑",
)
def main(send: bool, today_json: str, prev_json: str) -> None:
    today_path = Path(today_json)
    prev_path = Path(prev_json)

    today_payload = _load_json(today_path)
    if today_payload is None:
        click.echo(f"ERROR: today JSON not found: {today_path}", err=True)
        raise SystemExit(1)

    prev_payload = _load_json(prev_path)
    if prev_payload is None:
        click.echo(f"WARN: no previous snapshot found at {prev_path}; diff sections will be empty.", err=True)

    md = build_markdown(today_payload, prev_payload)

    brief_path = OUTPUT_DIR / "daily_brief.md"
    brief_path.write_text(md, encoding="utf-8")
    click.echo(f"Wrote {brief_path}")
    click.echo(md)

    if send:
        from .email_send import send_brief
        subject = f"Shortage Radar Daily Brief — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        send_brief(subject=subject, markdown_body=md)


if __name__ == "__main__":
    main()
