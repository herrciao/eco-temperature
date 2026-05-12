"""
Run: from repo root
  cd shortage-radar && PYTHONPATH=. python -m pipeline.main

Or:
  python -m pipeline.main  (if cwd is shortage-radar and PYTHONPATH set)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
import click

from srpkg.settings import OUTPUT_DIR, PACK_ROOT

from .fetch import collect_series_for_instruments
from .render_html import render as render_html
from .score import build_payload, build_signal_rows


@click.command()
@click.option("--write-json/--no-write-json", default=True)
@click.option("--write-html/--no-write-html", default=True)
def main(write_json: bool, write_html: bool) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 在跑新一輪 pipeline 前，先把上一份 JSON 備份為 .prev.json（供 daily_brief diff 使用）
    json_path = OUTPUT_DIR / "shortage_signals.json"
    prev_path = OUTPUT_DIR / "shortage_signals.prev.json"
    if json_path.exists():
        prev_path.write_text(json_path.read_text(encoding="utf-8"), encoding="utf-8")

    bundle, wide, monthly = collect_series_for_instruments()
    _ = bundle
    rows = build_signal_rows(wide, monthly)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = build_payload(rows, generated_at_iso=ts)
    html_path = OUTPUT_DIR / "shortage_report.html"
    json_content = json.dumps(payload, ensure_ascii=False, indent=2)
    if write_json:
        json_path.write_text(json_content, encoding="utf-8")
        click.echo(f"Wrote {json_path}")
        # 同步寫入 dashboard/data/web/ 供 Next.js 使用（Vercel 部署所需）
        dashboard_web = PACK_ROOT.parent / "dashboard" / "data" / "web"
        if dashboard_web.exists():
            dash_json = dashboard_web / "shortage_signals.json"
            dash_json.write_text(json_content, encoding="utf-8")
            click.echo(f"Synced  {dash_json}")
    if write_html:
        render_html(payload, html_path)
        click.echo(f"Wrote {html_path}")


if __name__ == "__main__":
    main()
