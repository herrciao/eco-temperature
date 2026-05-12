"""
Shortage Radar — Daily Brief Generator (v2)

Produces a Markdown morning report with:
  - Category overview table (today / vs yesterday / vs 5d ago)
  - High-tension alerts (score >= 65)
  - Score movers vs yesterday (top 5 up/down)
  - Score movers vs 5 days ago (top 5 up/down) – when data available
  - 5-day trend sparkline table for notable instruments
  - Price changes today (daily/weekly)
  - Newly published weekly/monthly data
  - Failed data sources

Snapshots are stored in data/output/snapshots/shortage_signals.YYYY-MM-DD.json
(written by pipeline/main.py on every run).

Run:
    cd shortage-radar
    PYTHONPATH=. python -m pipeline.daily_brief
    PYTHONPATH=. python -m pipeline.daily_brief --send
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import click

from srpkg.settings import OUTPUT_DIR, category_label_zh

# ── constants ──────────────────────────────────────────────────────────────

SNAPSHOTS_DIR = OUTPUT_DIR / "snapshots"
HIGH_TENSION_THRESHOLD = 65.0
CAT_ORDER = ["energy", "power", "semiconductor", "metals", "battery", "agriculture", "leading"]

SCORE_LABELS = [
    (70, "供給偏緊"),
    (58, "偏緊"),
    (45, "中性"),
    (35, "偏鬆"),
    (0,  "供給偏鬆"),
]


# ── helpers ────────────────────────────────────────────────────────────────

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
    if a is None or b is None or a == 0:
        return None
    return (b / a - 1.0) * 100.0


def _fmt_score_delta(d: Optional[float], na: str = "—") -> str:
    if d is None:
        return na
    sign = "+" if d >= 0 else ""
    return f"{sign}{d:.1f}"


def _fmt_pct(p: Optional[float], na: str = "—") -> str:
    if p is None:
        return na
    sign = "+" if p >= 0 else ""
    return f"{sign}{p:.1f}%"


def _berlin_now() -> str:
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.now(ZoneInfo("Europe/Berlin"))
    except Exception:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y/%m/%d %H:%M %Z")


def _utc_date_str(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")


# ── snapshot loading ───────────────────────────────────────────────────────

def _load_all_snapshots() -> Dict[str, Dict[str, Any]]:
    """Load all dated snapshots → {date_str: payload}."""
    result: Dict[str, Dict[str, Any]] = {}
    if not SNAPSHOTS_DIR.exists():
        return result
    for f in SNAPSHOTS_DIR.glob("shortage_signals.*.json"):
        date_part = f.stem.split(".")[-1]
        data = _load_json(f)
        if data:
            result[date_part] = data
    return result


def _find_snapshot(snapshots: Dict[str, Any], days_ago: int) -> Optional[Dict[str, Any]]:
    """Find snapshot for exactly N days ago (±1 day tolerance)."""
    for delta in [0, 1, -1, 2]:
        d = _utc_date_str(days_ago + delta)
        if d in snapshots:
            return snapshots[d]
    return None


# ── trend calculation ──────────────────────────────────────────────────────

def _trend_sparkline(scores: List[Optional[float]]) -> str:
    """
    Given a list of scores (oldest → newest), return a 4-char trend string.
    ▲ = up ≥1, ▼ = down ≥1, — = flat (<1 change)
    """
    syms: List[str] = []
    for i in range(1, len(scores)):
        a, b = scores[i - 1], scores[i]
        if a is None or b is None:
            syms.append("?")
        elif b - a >= 1.0:
            syms.append("▲")
        elif b - a <= -1.0:
            syms.append("▼")
        else:
            syms.append("—")
    return "".join(syms) if syms else "?"


def _trend_label(sparkline: str) -> str:
    """Turn sparkline into a short human label."""
    up = sparkline.count("▲")
    dn = sparkline.count("▼")
    total = up + dn
    if total == 0:
        return "持平"
    ratio = up / total
    if ratio >= 0.8:
        return "持續上升"
    if ratio <= 0.2:
        return "持續下降"
    if sparkline and sparkline[-1] == "▲":
        return "近轉上升"
    if sparkline and sparkline[-1] == "▼":
        return "近轉下降"
    return "震盪"


# ── diff utilities ─────────────────────────────────────────────────────────

def _score_delta(today_sig: Dict, ref_sig: Optional[Dict]) -> Optional[float]:
    ts = today_sig.get("score")
    rs = ref_sig.get("score") if ref_sig else None
    if ts is None or rs is None:
        return None
    return ts - rs


def _price_delta_pct(today_sig: Dict, ref_sig: Optional[Dict]) -> Optional[float]:
    tl = today_sig.get("latest")
    rl = ref_sig.get("latest") if ref_sig else None
    return _pct(rl, tl)


def _collect_movers(
    today_sigs: Dict[str, Dict],
    ref_sigs: Dict[str, Dict],
    key: str = "score",
) -> List[Dict]:
    """Collect (id, display_zh, category, delta, today_val) sorted by delta."""
    rows: List[Dict] = []
    for sid, today in today_sigs.items():
        ref = ref_sigs.get(sid)
        if key == "score":
            delta = _score_delta(today, ref)
            today_val = today.get("score")
        else:
            delta = _price_delta_pct(today, ref)
            today_val = today.get("latest")
        if delta is None:
            continue
        rows.append({
            "id": sid,
            "display_zh": today.get("display_zh", sid),
            "category": today.get("category", ""),
            "trail_mode": today.get("trail_mode", "daily"),
            "delta": delta,
            "today_val": today_val,
        })
    rows.sort(key=lambda r: r["delta"])
    return rows


# ── section builders ───────────────────────────────────────────────────────

def _section_category_overview(
    today_sigs: Dict[str, Dict],
    prev_sigs: Dict[str, Dict],
    ago5_sigs: Dict[str, Dict],
    has_5d: bool,
) -> List[str]:
    lines: List[str] = ["## 各分類緊張度概覽", ""]

    header = "| 分類 | 今日均分 | vs 昨日 |"
    sep    = "|------|---------|---------|"
    if has_5d:
        header += " vs 5日前 |"
        sep    += "----------|"
    lines.append(header)
    lines.append(sep)

    for cat in CAT_ORDER:
        label = category_label_zh(cat)
        t_scores = [s.get("score") for s in today_sigs.values() if s.get("category") == cat and s.get("score") is not None]
        p_scores = [s.get("score") for s in prev_sigs.values() if s.get("category") == cat and s.get("score") is not None]
        a_scores = [s.get("score") for s in ago5_sigs.values() if s.get("category") == cat and s.get("score") is not None]

        t_avg = sum(t_scores) / len(t_scores) if t_scores else None
        p_avg = sum(p_scores) / len(p_scores) if p_scores else None
        a_avg = sum(a_scores) / len(a_scores) if a_scores else None

        t_str = f"{t_avg:.0f}" if t_avg is not None else "—"
        d1_str = _fmt_score_delta(t_avg - p_avg if t_avg is not None and p_avg is not None else None)

        row = f"| {label} | {t_str} | {d1_str} |"
        if has_5d:
            d5_str = _fmt_score_delta(t_avg - a_avg if t_avg is not None and a_avg is not None else None)
            row += f" {d5_str} |"
        lines.append(row)

    lines.append("")
    return lines


def _section_high_tension(
    today_sigs: Dict[str, Dict],
    prev_sigs: Dict[str, Dict],
    ago5_sigs: Dict[str, Dict],
    snapshot_series: Dict[str, List[Optional[float]]],
    has_5d: bool,
) -> List[str]:
    alerts = [s for s in today_sigs.values() if (s.get("score") or 0) >= HIGH_TENSION_THRESHOLD]
    if not alerts:
        return []

    alerts.sort(key=lambda s: s.get("score") or 0, reverse=True)

    lines = [f"## 高緊張警示（分數 ≥ {HIGH_TENSION_THRESHOLD:.0f}）", ""]

    header = "| 項目 | 分類 | 今日 | vs 昨日 |"
    sep    = "|------|------|------|---------|"
    if has_5d:
        header += " vs 5日前 | 5日趨勢 |"
        sep    += "----------|---------|"
    lines.append(header)
    lines.append(sep)

    for s in alerts:
        sid = s["id"]
        cat_zh = category_label_zh(s.get("category", ""))
        score = s.get("score")
        score_str = f"{score:.0f}" if score is not None else "—"
        d1 = _score_delta(s, prev_sigs.get(sid))
        d1_str = _fmt_score_delta(d1)

        row = f"| {s.get('display_zh', sid)} | {cat_zh} | {score_str} | {d1_str} |"
        if has_5d:
            d5 = _score_delta(s, ago5_sigs.get(sid))
            d5_str = _fmt_score_delta(d5)
            spark = _trend_sparkline(snapshot_series.get(sid, []))
            row += f" {d5_str} | {spark} |"
        lines.append(row)

    lines.append("")
    return lines


def _section_trend_table(
    today_sigs: Dict[str, Dict],
    snapshot_series: Dict[str, List[Optional[float]]],
) -> List[str]:
    """Show trend sparkline for all instruments with score ≥ 50 and enough history."""
    candidates = [
        s for s in today_sigs.values()
        if (s.get("score") or 0) >= 50 and s["id"] in snapshot_series
        and len([x for x in snapshot_series[s["id"]] if x is not None]) >= 3
    ]
    if not candidates:
        return []

    candidates.sort(key=lambda s: s.get("score") or 0, reverse=True)

    lines = ["## 5日趨勢一覽（分數 ≥ 50）", ""]
    lines.append("| 項目 | 今日 | 趨勢（舊→新）| 走向 |")
    lines.append("|------|------|-------------|------|")
    for s in candidates:
        sid = s["id"]
        score = s.get("score")
        score_str = f"{score:.0f}" if score is not None else "—"
        series = snapshot_series.get(sid, [])
        spark = _trend_sparkline(series)
        label = _trend_label(spark)
        lines.append(f"| {s.get('display_zh', sid)} | {score_str} | {spark} | {label} |")
    lines.append("")
    return lines


def _section_score_movers(movers: List[Dict], title: str) -> List[str]:
    top_up = [x for x in movers if x["delta"] > 0][-5:][::-1]
    top_dn = [x for x in movers if x["delta"] < 0][:5]

    lines = [f"## {title}", ""]
    if not top_up and not top_dn:
        lines.append("*無顯著分數變動（可能為週末或無新資料）。*")
        lines.append("")
        return lines

    if top_up:
        lines.append("**上升（偏緊方向）：**")
        for r in top_up:
            cat_zh = category_label_zh(r["category"])
            lines.append(
                f"  - {r['display_zh']} [{cat_zh}] "
                f"→ {_fmt_score_delta(r['delta'])}  (現 {r['today_val']:.0f})"
            )
    if top_dn:
        lines.append("")
        lines.append("**下降（偏鬆方向）：**")
        for r in top_dn:
            cat_zh = category_label_zh(r["category"])
            lines.append(
                f"  - {r['display_zh']} [{cat_zh}] "
                f"→ {_fmt_score_delta(r['delta'])}  (現 {r['today_val']:.0f})"
            )
    lines.append("")
    return lines


def _section_price_movers(today_sigs: Dict, prev_sigs: Dict) -> List[str]:
    rows = _collect_movers(today_sigs, prev_sigs, key="price")
    daily_rows = [r for r in rows if r["trail_mode"] in ("daily", "weekly")]

    top_up = [x for x in daily_rows if x["delta"] > 0][-5:][::-1]
    top_dn = [x for x in daily_rows if x["delta"] < 0][:5]

    lines = ["## 今日價格漲跌幅（日頻/週頻）", ""]
    if not top_up and not top_dn:
        lines.append("*無日頻/週頻價格變動（可能為非交易日）。*")
        lines.append("")
        return lines
    if top_up:
        lines.append("**漲幅前 5：**")
        for r in top_up:
            lines.append(f"  - {r['display_zh']}：{_fmt_pct(r['delta'])}")
    if top_dn:
        lines.append("")
        lines.append("**跌幅前 5：**")
        for r in top_dn:
            lines.append(f"  - {r['display_zh']}：{_fmt_pct(r['delta'])}")
    lines.append("")
    return lines


def _section_newly_published(today_sigs: Dict, prev_sigs: Dict) -> List[str]:
    newly: List[Dict] = []
    for sid, today in today_sigs.items():
        prev = prev_sigs.get(sid)
        t_date = today.get("latest_date")
        p_date = prev.get("latest_date") if prev else None
        mode = today.get("trail_mode", "daily")
        if t_date and t_date != p_date and mode in ("monthly", "weekly"):
            newly.append({
                "display_zh": today.get("display_zh", sid),
                "category": today.get("category", ""),
                "latest_date": t_date,
                "latest": today.get("latest"),
                "weekly": mode == "weekly",
            })

    lines = ["## 本週/本月新公布資料", ""]
    if not newly:
        lines.append("*本次無新公布的週頻或月頻資料。*")
    else:
        for r in newly:
            cat_zh = category_label_zh(r["category"])
            v = r.get("latest")
            v_str = f"{v:,.2f}" if v is not None else "—"
            tag = "（週頻）" if r.get("weekly") else "（月頻）"
            lines.append(
                f"  - **{r['display_zh']}** [{cat_zh}]{tag} "
                f"最新值 {v_str}，日期 {r['latest_date']}"
            )
    lines.append("")
    return lines


def _section_failures(today_sigs: Dict) -> List[str]:
    failed = [
        s for s in today_sigs.values()
        if s.get("score") is None and s.get("source") != "placeholder"
    ]
    if not failed:
        return []
    lines = ["## 資料源取得失敗", ""]
    for s in failed:
        hint = (s.get("detail") or {}).get("hint", "")
        lines.append(f"  - {s.get('display_zh', s['id'])}（{s.get('source')}）{': ' + hint if hint else ''}")
    lines.append("")
    return lines


# ── main builder ───────────────────────────────────────────────────────────

def build_markdown(
    today_payload: Dict[str, Any],
    prev_payload: Optional[Dict[str, Any]],
    snapshots: Dict[str, Dict[str, Any]],
) -> str:
    today_sigs = _signals_by_id(today_payload)
    prev_sigs  = _signals_by_id(prev_payload) if prev_payload else {}

    ago5_payload = _find_snapshot(snapshots, days_ago=5)
    ago5_sigs    = _signals_by_id(ago5_payload) if ago5_payload else {}
    has_5d       = bool(ago5_sigs)

    # Build per-instrument score series (oldest→newest) from all available snapshots
    sorted_dates = sorted(snapshots.keys())  # e.g. ["2026-05-08", ..., "2026-05-12"]
    snapshot_series: Dict[str, List[Optional[float]]] = {}
    for sid in today_sigs:
        series: List[Optional[float]] = []
        for d in sorted_dates:
            snap_sigs = _signals_by_id(snapshots[d])
            series.append(snap_sigs.get(sid, {}).get("score"))
        # append today (may or may not be in snapshots yet)
        today_score = today_sigs[sid].get("score")
        today_date = _utc_date_str(0)
        if sorted_dates and sorted_dates[-1] == today_date:
            pass  # today already included in sorted_dates
        else:
            series.append(today_score)
        snapshot_series[sid] = series

    generated_at = today_payload.get("generated_at", "")
    berlin_time  = _berlin_now()

    lines: List[str] = [
        "# Shortage Radar — Daily Brief",
        "",
        f"**產生時間（柏林）：** {berlin_time}",
        f"**資料快照時間（UTC）：** {generated_at}",
    ]
    if has_5d:
        lines.append(f"**5日對比基準：** {ago5_payload.get('generated_at','')[:10]}")  # type: ignore[union-attr]
    else:
        lines.append("**5日對比：** 快照資料不足，將在累積 5 日快照後自動啟用")
    lines += ["", "---", ""]

    lines += _section_category_overview(today_sigs, prev_sigs, ago5_sigs, has_5d)
    lines += ["---", ""]
    lines += _section_high_tension(today_sigs, prev_sigs, ago5_sigs, snapshot_series, has_5d)
    if (today_sigs):
        lines += ["---", ""]
    lines += _section_trend_table(today_sigs, snapshot_series)
    lines += ["---", ""]

    score_movers_1d = _collect_movers(today_sigs, prev_sigs, key="score")
    lines += _section_score_movers(score_movers_1d, "A. 緊張度分數變動（vs 昨日）")
    lines += ["---", ""]

    if has_5d:
        score_movers_5d = _collect_movers(today_sigs, ago5_sigs, key="score")
        lines += _section_score_movers(score_movers_5d, "B. 緊張度分數變動（vs 5日前）")
        lines += ["---", ""]
        section_c_label = "C."
    else:
        section_c_label = "B."

    lines += _section_price_movers(today_sigs, prev_sigs)
    lines += ["---", ""]

    lines += _section_newly_published(today_sigs, prev_sigs)
    lines += ["---", ""]

    failures = _section_failures(today_sigs)
    if failures:
        lines += failures
        lines += ["---", ""]

    dashboard_url = os.environ.get("DASHBOARD_URL", "https://your-vercel-app.vercel.app/shortage-radar")
    lines += [
        f"[Dashboard]({dashboard_url})",
        "",
        "*此報告由 GitHub Actions 自動產生。分數為價格/動能 proxy，非真實庫存模型。*",
    ]

    return "\n".join(lines)


# ── CLI ────────────────────────────────────────────────────────────────────

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
    prev_path  = Path(prev_json)

    today_payload = _load_json(today_path)
    if today_payload is None:
        click.echo(f"ERROR: today JSON not found: {today_path}", err=True)
        raise SystemExit(1)

    prev_payload = _load_json(prev_path)
    if prev_payload is None:
        click.echo(f"WARN: no previous snapshot; diff sections will be empty.", err=True)

    snapshots = _load_all_snapshots()
    click.echo(f"Loaded {len(snapshots)} dated snapshot(s) from {SNAPSHOTS_DIR}")

    md = build_markdown(today_payload, prev_payload, snapshots)

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
