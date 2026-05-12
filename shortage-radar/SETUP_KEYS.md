# Shortage Radar — API 金鑰申請（一步一步）

管線**零付費**即可跑大部分欄位。下列為**選用或建議**申請項目，依序做完即可。

---

## 你已經有的：`FRED_API_KEY`（必備）

本專案**原本**就需要 FRED（巨集/IMF 金屬月頻、韓國出口 `XTEXVA01KRM667S` 等）。

1. 開啟： https://fred.stlouisfed.org/docs/api/api_key.html  
2. 註冊帳號 → 申請 **API Key**（免費）。  
3. 在專案根目錄 `.env` 新增一行：

```bash
FRED_API_KEY=你的金鑰
```

4. 存檔後，在 `shortage-radar` 執行：

```bash
cd shortage-radar
PYTHONPATH=. ../.venv/bin/python -m pipeline.main
```

---

## 建議新增：`EIA_API_KEY`（美國原油庫存）

對應欄位：**美國原油庫存**（EIA API **v2**，序列 `WCRSTUS1`，每週，千桶）。舊版 API v1 已於 2023 年停用。**完全免費**，但必須註冊取得 key。

1. 開啟： https://www.eia.gov/opendata/register.php  
2. 用 Email 註冊 → 信箱收 **API Key**。  
3. 在**同一個** repo 根目錄 `.env` 加上：

```bash
EIA_API_KEY=你的金鑰
```

4. 再跑一次 `python -m pipeline.main`。若成功，HTML 裡該列會有分數與最新庫存；若沒設定此 key，該列會顯示抓取失敗（不影響其他列）。

---

## 台灣外銷訂單 — **不需要申請**

資料來源：經濟部 **開放資料 CSV**（免 key）。

- 網址已寫在 `srpkg/settings.py` 的備註：`https://service.moea.gov.tw/EE520/opendata/b.csv`
- 只要你的網路能連政府站，管線會自動下載。

---

## 韓國出口 — **不需要韓國 data.go.kr**（本專案做法）

我們用 **FRED 上的韓國貨品出口序列**（`XTEXVA01KRM667S`），因此 **只要 FRED key** 即可，**不必**去 [공공데이터포털](https://www.data.go.kr) 申請服務키。

> 若你未來想改成「官網細項 HS 碼」再申請韓國 API 亦可，與目前管線無衝突。

---

## LME 銅庫存 — **不需要申請**

目前用 **Westmetall** 公開頁面表格（含 LME Copper stock 欄）。  
這是**第三方彙整**，非 LME 付費 API；若頁面改版導致抓不到，日後可再改 parser 或改用手動 CSV。

---

## 檢查清單（照做即可）

| 步驟 | 動作 | 費用 |
|------|------|------|
| 1 | `.env` 設定 `FRED_API_KEY` | 免費 |
| 2 | `.env` 設定 `EIA_API_KEY`（建議） | 免費 |
| 3 | 確認可連 MOEA CSV、Westmetall（無 key） | 免費 |
| 4 | `PYTHONPATH=. python -m pipeline.main` | — |

---

## 選用：`FINNHUB_API_KEY`

只影響你在 **Cursor MCP** 裡接 Finnhub，**不影響** shortage-radar 管線。若要申請： https://finnhub.io/register （有免費額度）。

---

## Daily Brief Email — SMTP 設定（每日早報推播用）

早報 workflow 會在每日 UTC 04:30（柏林夏令 06:30 / 冬令 05:30）跑完管線後，自動寄一封 Markdown 早報到你的信箱。需在 GitHub → repo → Settings → Secrets and variables → Actions 設定以下 6 個 secret：

| Secret 名稱 | 範例值 | 說明 |
|-------------|--------|------|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 伺服器 |
| `SMTP_PORT` | `587` | 通常 587 (STARTTLS) 或 465 (SSL) |
| `SMTP_USER` | `your@gmail.com` | 登入帳號 |
| `SMTP_PASS` | `abcd efgh ijkl mnop` | **Gmail App Password**（見下方步驟）|
| `BRIEF_TO`  | `your@gmail.com` | 收件人（多人用逗號分隔）|
| `DASHBOARD_URL` | `https://xxx.vercel.app/shortage-radar` | 早報 footer 連結（可留空）|

### Gmail App Password 取得步驟（2 分鐘）

1. Google 帳戶 → **安全性** → **兩步驟驗證** → 確認已開啟
2. 安全性 → 最下方 → **應用程式密碼**（App Passwords）
3. 選擇「郵件」＋「其他裝置名稱（shortage-radar）」→ 產生
4. 複製那 16 字元密碼（格式 `xxxx xxxx xxxx xxxx`）填入 `SMTP_PASS`

> 其他郵件服務（Outlook、Mailjet、SendGrid）亦可，改對應 host/port/user/pass 即可。

### 本機測試寄信

在 repo 根目錄 `.env` 加入以下鍵後，跑一次管線再跑 brief：

```bash
# Daily Brief Email（本機測試用，.env 已在 .gitignore）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=你的 App Password
BRIEF_TO=your@gmail.com
DASHBOARD_URL=https://your-vercel-app.vercel.app/shortage-radar
```

```bash
cd shortage-radar
PYTHONPATH=. python -m pipeline.main          # 先跑一次產生今日 JSON
PYTHONPATH=. python -m pipeline.daily_brief --send  # 產生早報並寄出
```

### 本機只看早報（不寄信）

```bash
cd shortage-radar
PYTHONPATH=. python -m pipeline.daily_brief   # 輸出到 terminal + 寫 data/output/daily_brief.md
```
