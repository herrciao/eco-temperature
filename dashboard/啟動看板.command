#!/bin/bash
# 雙擊此檔會開終端機並啟動看板。請保持視窗開著，再用瀏覽器開 http://127.0.0.1:3456
cd "$(dirname "$0")" || exit 1
echo "=========================================="
echo "目錄: $(pwd)"
echo "若路徑不是 .../eco temperature/dashboard 請關閉並手動 cd"
echo "=========================================="
if [ ! -f package.json ]; then
  echo "錯誤：找不到 package.json，請勿移動此檔案。"
  exit 1
fi
npm install
echo ""
echo "即將啟動，請勿關閉此視窗。"
echo "看到 Ready 後，瀏覽器開啟: http://127.0.0.1:3456"
echo ""
npm run dev:3456
