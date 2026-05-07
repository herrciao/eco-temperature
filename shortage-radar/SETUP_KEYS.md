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
