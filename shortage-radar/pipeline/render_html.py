"""Minimal static HTML report (no Next.js)."""
from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any, Dict, List


def _trail_cells(row: Dict[str, Any]) -> str:
    trail = row.get("quarter_trail")
    if not trail or not isinstance(trail, list):
        return "<td class='num'>—</td><td class='num'>—</td><td class='num'>—</td>"
    cells: List[str] = []
    for pt in trail[:3]:
        vf = pt.get("value_fmt")
        raw = pt.get("value")
        dt = pt.get("date")
        if vf is None and raw is None:
            cells.append("<td class='num'>—</td>")
            continue
        try:
            v = float(vf) if vf is not None else float(raw)
            vtxt = f"{v:g}"
        except (TypeError, ValueError):
            vtxt = str(vf if vf is not None else raw)
        dtxt = html.escape(str(dt or "—"))
        fb = pt.get("fallback")
        star = " <span class='sub' title='來源未涵蓋完整兩季曆程，此為可取得之最舊觀測'>*</span>" if fb == "oldest_in_series" else ""
        cells.append(
            f"<td class='num'><div>{html.escape(vtxt)}{star}</div><div class='sub'>{dtxt}</div></td>"
        )
    while len(cells) < 3:
        cells.append("<td class='num'>—</td>")
    return "".join(cells)


def _cell_color(score: Any) -> str:
    if score is None:
        return "#6b7280"
    try:
        s = float(score)
    except (TypeError, ValueError):
        return "#6b7280"
    if s >= 70:
        return "#b91c1c"
    if s >= 58:
        return "#ea580c"
    if s >= 45:
        return "#ca8a04"
    if s >= 35:
        return "#16a34a"
    return "#15803d"


def render(payload: Dict[str, Any], out_path: Path) -> None:
    signals: List[Dict[str, Any]] = payload.get("signals", [])
    rows_html = []
    for r in signals:
        score = r.get("score")
        c = _cell_color(score)
        score_txt = "—" if score is None else str(score)
        trail_html = _trail_cells(r)
        rows_html.append(
            "<tr>"
            f"<td>{html.escape(str(r.get('category_zh','')))}</td>"
            f"<td><strong>{html.escape(str(r.get('display_zh','')))}</strong><br/>"
            f"<span class='sub'>{html.escape(str(r.get('display_en','')))}</span></td>"
            f"<td class='num' style='color:{c};font-weight:700'>{html.escape(score_txt)}</td>"
            f"{trail_html}"
            f"<td class='small'>{html.escape(str(r.get('source','')))}</td>"
            f"<td class='small'>{html.escape(str(r.get('notes','')))}</td>"
            "</tr>"
        )

    meta = json.dumps(payload, ensure_ascii=False)
    doc = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Shortage Radar</title>
<style>
body {{ font-family: system-ui, -apple-system, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }}
h1 {{ font-size: 1.35rem; margin-bottom: 4px; }}
p.meta {{ color: #94a3b8; font-size: 0.85rem; margin-top: 0; }}
p.trail-note {{ font-size: 0.78rem; line-height: 1.45; max-width: 900px; }}
table {{ border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 0.88rem; }}
th, td {{ border-bottom: 1px solid #334155; padding: 10px 8px; vertical-align: top; }}
th {{ text-align: left; color: #94a3b8; font-weight: 600; }}
td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
td.small {{ font-size: 0.78rem; color: #94a3b8; max-width: 360px; }}
.sub {{ color: #64748b; font-size: 0.78rem; }}
.legend {{ margin-top: 16px; font-size: 0.8rem; color: #94a3b8; }}
code {{ background: #1e293b; padding: 2px 6px; border-radius: 4px; }}
</style>
</head>
<body>
<h1>Shortage Radar（免費資料 MVP）</h1>
<p class="meta">產生時間：{html.escape(str(payload.get('generated_at','')))}　｜　分數僅為價格/動能 proxy，非真實庫存模型；placeholder 列待接 API。</p>
<p class="meta trail-note">{html.escape(str(payload.get('trail_legend', '')))}</p>
<table>
<thead><tr><th>分類</th><th>項目</th><th>供需緊張度</th><th>本期</th><th>約1季前</th><th>約2季前</th><th>來源</th><th>備註</th></tr></thead>
<tbody>
{''.join(rows_html)}
</tbody>
</table>
<p class="legend">供需緊張度約 50 為中性；&gt;60 供給偏緊／價格動能偏強；&lt;40 供給偏鬆（或需求轉弱）。請搭配 <code>.cursor/rules/</code> 內 SOP 交叉驗證。</p>
<script type="application/json" id="payload">{meta}</script>
</body>
</html>"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(doc, encoding="utf-8")
