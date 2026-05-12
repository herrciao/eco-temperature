"""
SMTP email sender for Shortage Radar Daily Brief.

Required environment variables:
    SMTP_HOST   e.g. smtp.gmail.com
    SMTP_PORT   e.g. 587
    SMTP_USER   e.g. your@gmail.com
    SMTP_PASS   Gmail App Password (16 chars, no spaces) or service key
    BRIEF_TO    recipient address(es), comma-separated

Optional:
    BRIEF_FROM  sender display name + address; defaults to SMTP_USER
    DASHBOARD_URL  linked in email footer (default: env var or placeholder)

Gmail setup:
    1. Google Account → Security → 2-Step Verification → ON
    2. Security → App Passwords → create "Mail / Other (shortage-radar)"
    3. Use the generated 16-char password as SMTP_PASS
"""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _md_to_html(md: str) -> str:
    """Convert Markdown to HTML. Falls back to <pre> if `markdown` not installed."""
    try:
        import markdown as _md
        body_html = _md.markdown(md, extensions=["tables", "nl2br"])
    except ImportError:
        body_html = f"<pre style='font-family:monospace;white-space:pre-wrap'>{_escape(md)}</pre>"
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; background:#0f172a; color:#e2e8f0;
         margin:0; padding:24px; }}
  h1   {{ font-size:1.2rem; color:#f1f5f9; }}
  h2   {{ font-size:1rem; color:#94a3b8; border-bottom:1px solid #334155; padding-bottom:4px; }}
  ul   {{ padding-left:1.2em; }}
  li   {{ margin:3px 0; }}
  a    {{ color:#38bdf8; }}
  em   {{ color:#94a3b8; }}
  strong {{ color:#f1f5f9; }}
  hr   {{ border:none; border-top:1px solid #334155; }}
  pre  {{ background:#1e293b; padding:12px; border-radius:6px; overflow-x:auto; }}
</style>
</head>
<body>
{body_html}
</body>
</html>"""


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def send_brief(*, subject: str, markdown_body: str) -> None:
    # GitHub Actions 對「未新增的 secret」會傳空字串，不可用 int("")；
    host = _env("SMTP_HOST", "") or "smtp.gmail.com"
    port_raw = _env("SMTP_PORT", "") or "587"
    try:
        port = int(port_raw)
    except ValueError:
        port = 587
    user = _env("SMTP_USER")
    password = _env("SMTP_PASS")
    to_raw = _env("BRIEF_TO")
    sender = _env("BRIEF_FROM") or user

    if not user or not password or not to_raw:
        print("EMAIL SKIP: SMTP_USER / SMTP_PASS / BRIEF_TO not set. Set them in .env or GitHub Secrets.")
        return

    recipients = [r.strip() for r in to_raw.split(",") if r.strip()]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)

    msg.attach(MIMEText(markdown_body, "plain", "utf-8"))
    msg.attach(MIMEText(_md_to_html(markdown_body), "html", "utf-8"))

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(user, password)
            smtp.sendmail(sender, recipients, msg.as_string())
        print(f"Email sent → {', '.join(recipients)}")
    except Exception as exc:  # noqa: BLE001
        print(f"EMAIL ERROR (non-fatal): {exc}")
