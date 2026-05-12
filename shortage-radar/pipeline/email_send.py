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
    """
    Convert Markdown to an email-safe HTML document.
    Uses inline styles only (Gmail/Outlook strip <style> blocks).
    Light background + dark text for maximum readability in all clients.
    """
    try:
        import markdown as _md
        body_html = _md.markdown(md, extensions=["tables", "nl2br"])
    except ImportError:
        body_html = (
            f"<pre style='font-family:monospace;font-size:13px;white-space:pre-wrap;"
            f"color:#1e293b;background:#f8fafc;padding:16px;border-radius:6px'>"
            f"{_escape(md)}</pre>"
        )

    # Post-process: inject inline styles onto tags that markdown library emits
    replacements = [
        ("<h1>",  "<h1 style='font-size:1.25rem;font-weight:700;color:#0f172a;margin:0 0 4px'>"),
        ("<h2>",  "<h2 style='font-size:1rem;font-weight:600;color:#334155;border-bottom:2px solid #e2e8f0;"
                  "padding-bottom:4px;margin:20px 0 8px'>"),
        ("<h3>",  "<h3 style='font-size:0.95rem;font-weight:600;color:#475569;margin:14px 0 6px'>"),
        ("<ul>",  "<ul style='padding-left:1.4em;margin:6px 0'>"),
        ("<ol>",  "<ol style='padding-left:1.4em;margin:6px 0'>"),
        ("<li>",  "<li style='margin:4px 0;color:#1e293b;line-height:1.55'>"),
        ("<p>",   "<p style='margin:6px 0;color:#1e293b;line-height:1.6'>"),
        ("<hr>",  "<hr style='border:none;border-top:1px solid #e2e8f0;margin:16px 0'/>"),
        ("<hr/>", "<hr style='border:none;border-top:1px solid #e2e8f0;margin:16px 0'/>"),
        ("<strong>", "<strong style='color:#0f172a'>"),
        ("<em>",  "<em style='color:#64748b'>"),
        ("<a ",   "<a style='color:#0369a1;text-decoration:underline' "),
        ("<table>", "<table style='border-collapse:collapse;width:100%;font-size:0.88rem'>"),
        ("<th>",  "<th style='text-align:left;padding:6px 10px;background:#f1f5f9;color:#334155;"
                  "border:1px solid #e2e8f0'>"),
        ("<td>",  "<td style='padding:6px 10px;color:#1e293b;border:1px solid #e2e8f0'>"),
        ("<pre>", "<pre style='background:#f1f5f9;padding:12px;border-radius:6px;"
                  "font-size:0.85rem;color:#1e293b;overflow-x:auto'>"),
        ("<code>","<code style='background:#f1f5f9;padding:2px 5px;border-radius:3px;"
                  "font-size:0.85rem;color:#be123c'>"),
    ]
    for old, new in replacements:
        body_html = body_html.replace(old, new)

    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
             background:#ffffff;color:#1e293b;margin:0;padding:0">
  <div style="max-width:680px;margin:0 auto;padding:28px 24px;background:#ffffff">
    <div style="background:#0f172a;color:#f8fafc;padding:16px 20px;border-radius:8px;margin-bottom:20px">
      <span style="font-size:1rem;font-weight:700;letter-spacing:.5px">
        SHORTAGE RADAR — Daily Brief
      </span>
    </div>
    {body_html}
    <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;
                font-size:0.78rem;color:#94a3b8">
      此報告由 GitHub Actions 自動產生。分數為價格/動能 proxy，非真實庫存模型。
    </div>
  </div>
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
