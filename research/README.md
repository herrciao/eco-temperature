# 研究用腳本（不影響主程式）

## Growth 權重計算器（靜態網頁）

瀏覽器內拖曳五個 Growth 子因子權重，按「計算」即重算 `growth_score`、Regime、宏觀溫度、Spearman IC（對 SPY 前瞻 4w），並顯示與面板 baseline 的差異與走勢圖。**不需** npm、**不**改主看板。

### 1. 匯出資料 JSON

需先有 `output/artifacts/macro_panel.csv`（`python main.py score`）。

```bash
python research/export_calculator_data.py
```

會產生 `research/output/calculator_data.json`。

### 2. 開啟網頁

**方式 A（建議）**：在 `research/` 目錄開本機伺服器，可自動載入 JSON：

```bash
cd research
python -m http.server 8765
```

瀏覽器開啟 `http://localhost:8765/calculator.html`。

**方式 B**：直接雙擊開 `research/calculator.html`，再用頁面上的「選擇檔案」載入 `research/output/calculator_data.json`（因瀏覽器安全限制，`file://` 無法自動讀同目錄 JSON）。

每次更新 `macro_panel.csv` 後，請重新執行 `export_calculator_data.py` 再重新整理網頁。

---

## `counterfactual_interval_report.py`

自訂 **Growth** 權重（JSON 覆寫）、指定 **日期區間**，重算 composite / regime / SPY 擬合，輸出 Markdown 至 `research/output/`。**不**寫入 `output/web`、不改主看板。

```bash
python research/counterfactual_interval_report.py --start 2018-01-01 --end 2020-12-31 \
  --growth-json '{"bdry_mom1_z":0.25,"durable_goods_z":0.20}'

# 同時輸出「目前 config 先驗」與自訂對照
python research/counterfactual_interval_report.py --start 2018-01-01 --end 2020-12-31 \
  --compare-baseline --growth-json '{"bdry_mom1_z":0.25,"durable_goods_z":0.20}'
```

技術備註：須同步更新 `scores.composite` 模組內的 `GROWTH_W` 參考（`from config import` 的綁定），腳本已處理；執行結束會還原 `config`。

---

## `analyze_learned_weights.py`

在 **不改 `main.py` / `config.py`** 的前提下，用與 `scores/spy_fit.py` 相同的 **Ridge** 設定（`TRAIN_FRAC`、`RIDGE_ALPHA`），以 **SPY 前瞻週報酬** 為目標，對各支柱的 **子因子 z-score** 估係數，並與 `config` 先驗權重比對。

**輸入**：`output/artifacts/macro_panel.csv`（先執行 `python main.py score` 產生）

**輸出**：`research/output/weight_analysis_report.md`

```bash
# 專案根目錄
python research/analyze_learned_weights.py
python research/analyze_learned_weights.py --panel /path/to/macro_panel.csv --out /path/to/report.md
```

解讀時請注意：報告中的「|β| 歸一」僅供與先驗「佔比」直覺對照；**Ridge 係數符號與尺度**取決於目標變數（SPY 報酬），與敘事型合成權重目的不同。
