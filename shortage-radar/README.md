# Shortage Radar（獨立產品 MVP）

免費資料（FRED + Yahoo Finance）監測多類原物料與總經 proxy 的「緊繃分數」，輸出 JSON + 靜態 HTML。**不修改**上層目錄的 `dashboard/`（宏觀 Regime）與供應鏈看板。

## 需求

- Python 3.11+
- **免費金鑰與申請步驟** → [SETUP_KEYS.md](SETUP_KEYS.md)  
  - 必備：`FRED_API_KEY`（repo 根目錄 `.env`）  
  - 建議：`EIA_API_KEY`（美國原油庫存）  
  - 台灣外銷訂單：免 key；韓國出口：走 FRED，免韓國 API。

## 安裝

```bash
cd shortage-radar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 執行

```bash
cd shortage-radar
source .venv/bin/activate   # 或使用 repo 根目錄既有 .venv
PYTHONPATH=. python -m pipeline.main
```

## 怎麼「看到畫面」（重要）

- **不要**只在 Cursor 裡打開 `.html` 當文字檔——那是原始碼，不是排版後的網頁。
- 請用 **系統瀏覽器** 開：

**macOS（終端機執行一行即可）：**

```bash
open "/Users/herrciao/Documents/herrciao cursor/cursor/eco temperature/shortage-radar/data/output/shortage_report.html"
```

或：Finder 進到 `shortage-radar/data/output/` → 雙擊 `shortage_report.html`。

畫面是**深色底**（#0f172a）+ 淺色字；若整片黑，試把視窗拉大或捲動，表格在標題下方。

**仍空白時：**改用本機小伺服器（避免部分瀏覽器對 `file://` 限制）：

```bash
cd "/Users/herrciao/Documents/herrciao cursor/cursor/eco temperature/shortage-radar/data/output"
python3 -m http.server 8765
```

瀏覽器開：http://127.0.0.1:8765/shortage_report.html

---
## 設計備註

- Python 套件目錄為 `srpkg/`（資料夾名 `shortage-radar` 含連字號，無法直接當模組名）。
- 台灣外銷訂單：MOEA 開放 CSV；韓國出口：FRED；美國原油庫存：EIA（需 `EIA_API_KEY`）；LME 銅庫存：Westmetall 公開表（第三方彙整）。
- 報表與 `shortage_signals.json` 含 **本期／約1季前／約2季前** 三點數值（依頻率：月頻往回第 3、6 筆；EIA 週頻往回第 13、26 筆；日頻約 91、182 日曆日前最近觀測）。詳見 JSON 的 `trail_legend`。
- 分數 = 價格水準與動能的 **heuristic**，庫存列另套 `orientation`；解讀請搭配 `.cursor/rules/` 內五份 SOP。

## 與 Cursor Skills

分析流程與交叉驗證步驟定義在倉庫根目錄 `.cursor/rules/*.mdc`，供本產品與其他研究共用。

## MCP（選用）

根目錄 `.cursor/mcp.json` 預設為空物件；若你註冊免費 Finnhub key，可自行在該檔加入 MCP server，**不影響**本管線（管線以 FRED、Yahoo、MOEA、EIA、Westmetall 為主）。
