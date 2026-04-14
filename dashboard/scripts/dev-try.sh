#!/usr/bin/env bash
# 在 dashboard 目錄執行：bash scripts/dev-try.sh
# 可選第一個參數為埠號，預設 3456（避開 3000/3001 被占用或異常的情況）
set -e
cd "$(dirname "$0")/.."
PORT="${1:-3456}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "目錄: $(pwd)"
echo "若此路徑結尾不是 .../eco temperature/dashboard，請先 cd 到正確資料夾。"
echo "即將啟動: http://127.0.0.1:${PORT} 與 http://localhost:${PORT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exec npx next dev -H 0.0.0.0 -p "${PORT}"
