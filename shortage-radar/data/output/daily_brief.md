# Shortage Radar — Daily Brief

**產生時間（柏林）：** 2026/05/12 09:06 CEST
**資料快照時間（UTC）：** 2026-05-12T07:06:06Z

---

## 各分類緊張度概覽

- **能源**：中性 (53)
- **AI 電力 (北美)**：偏緊 (60)
- **半導體**：供給偏緊 (70)
- **工業金屬**：偏緊 (60)
- **電池/轉型金屬**：供給偏緊 (73)
- **農產品**：供給偏緊 (73)
- **領先/總經**：偏緊 (67)

---

## A. 緊張度分數變動（vs 前次快照）


**下降（偏鬆方向）：**
  - COMEX 銅期貨 [工業金屬] → -0.2 （現為 74）
  - 美國天然氣期貨 (NG) [能源] → -0.1 （現為 49）
  - 玉米期貨 [農產品] → -0.1 （現為 74）

---

## B. 價格漲跌幅（日頻/週頻，vs 前次快照）

**漲幅前 5：**
  - 黃豆期貨：+0.0%

**跌幅前 5：**
  - COMEX 銅期貨：-0.2%
  - 美國天然氣期貨 (NG)：-0.1%
  - 玉米期貨：-0.1%

---

## C. 本週/本月新公布資料

*本次無新公布的週頻或月頻資料。*

---

## D. 資料源取得失敗

  - 美國原油庫存（EIA 週）（eia_v2）: 若為 EIA：請在 repo 根 .env 設定 EIA_API_KEY（API v2，見 SETUP_KEYS.md）
  - 鋁 (IMF)（fred）: 請確認 repo 根 .env 的 FRED_API_KEY 在 fred.stlouisfed.org 帳號內為有效金鑰（API 回應 not registered 代表金鑰不被接受）。
  - 銅 (IMF 月均值)（fred）: 請確認 repo 根 .env 的 FRED_API_KEY 在 fred.stlouisfed.org 帳號內為有效金鑰（API 回應 not registered 代表金鑰不被接受）。
  - 全球食品價格指數（fred）: 請確認 repo 根 .env 的 FRED_API_KEY 在 fred.stlouisfed.org 帳號內為有效金鑰（API 回應 not registered 代表金鑰不被接受）。
  - 美國非農就業（水準，千人）（fred）: 請確認 repo 根 .env 的 FRED_API_KEY 在 fred.stlouisfed.org 帳號內為有效金鑰（API 回應 not registered 代表金鑰不被接受）。
  - 美國非農就業（月增減，千人）（computed）: 多為上游欄位缺失（例如 FRED 原油未取得時，WTI–Brent 價差無法計算）。

---

[Dashboard](https://eco-temperature.vercel.app/shortage-radar) | [Raw JSON](https://eco-temperature.vercel.app/api/shortage-signals)

*此報告由 GitHub Actions 自動產生。分數為價格/動能 proxy，非真實庫存模型。*