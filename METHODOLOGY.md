# 指數 ↔ 資產連動追蹤：建模與回測方法論

> 從「宏觀溫度」專案中提煉的可複用框架。  
> 適用於：任何「用 N 個指數/因子追蹤 M 支股票或 ETF 連動關係」的研究場景。

---

## 目錄

1. [核心思路](#1-核心思路)
2. [資料管線](#2-資料管線)
3. [特徵工程](#3-特徵工程)
4. [合成分數與權重設計](#4-合成分數與權重設計)
5. [Regime 分類](#5-regime-分類)
6. [擬合與驗證（Ridge 回歸）](#6-擬合與驗證ridge-回歸)
7. [回測設計](#7-回測設計)
8. [關鍵經驗教訓](#8-關鍵經驗教訓)
9. [可調參數清單](#9-可調參數清單)
10. [複用 Checklist](#10-複用-checklist)
11. [常見陷阱](#11-常見陷阱)
12. [技術架構完整記錄](#12-技術架構完整記錄)
13. [圖表閱讀指南（靜態報告）](#13-圖表閱讀指南靜態報告)
14. [Next.js 看板 UI 閱讀指南](#14-nextjs-看板-ui-閱讀指南)
15. [研究工具記錄](#15-研究工具記錄)
16. [擴展指南](#16-擴展指南)

---

## 1. 核心思路

```
指標群（指數、利率、商品…）
    ↓ 特徵化（動能、z-score、趨勢）
    ↓ 加權合成 → 分數/溫度
    ↓ 規則式分類 → Regime
    ↓ Ridge 擬合 → 對目標資產前瞻報酬的解釋力
    ↓ 前瞻回測 → 各 Regime / 事件下各資產的歷史表現統計
```

**一句話**：把你認為有領先性或連動性的指標，轉成標準化分數，組合成「環境溫度」，再用歷史前瞻報酬驗證這個溫度對目標資產是否有解釋力。

---

## 2. 資料管線

### 2.1 資料來源選擇原則

| 原則 | 說明 |
|------|------|
| **頻率統一** | 選定一個錨定頻率（本案為「週五收盤」週頻），所有資料對齊到同一時間軸 |
| **月頻資料需加發布延遲** | FRED 月頻指標（非農、耐久財等）通常滯後 2–5 週才公布，用 `merge_asof` + 延遲天數避免前視偏差 |
| **即時性優先** | 同一指標若有多個來源（如 WTI：FRED 日頻 vs Yahoo 期貨），優先選擇更即時的來源 |
| **缺值處理** | `fillna(0)` 或 `ffill` 依語意決定；z-score 視窗內若全為 NaN 則該週分數為 0 |

### 2.2 本案使用的資料架構

```
FRED (月/日頻)  ─┐
                  ├─ 週五對齊 → SQLite → macro_panel.csv
Yahoo (日頻)    ─┘
```

### 2.3 新場景套用

替換 `config.py` 中的 `FRED_SERIES` / `YAHOO_TICKERS` 即可。例如追蹤半導體：

```python
FRED_SERIES = {"ism_new_orders": "NEWORDER", ...}
YAHOO_TICKERS = {"sox": "^SOX", "tsm": "TSM", ...}
BACKTEST_ETFS = ["SMH", "SOXX", "QQQ", "SPY"]
```

---

## 3. 特徵工程

### 3.1 三類核心特徵

| 類型 | 公式 | 用途 |
|------|------|------|
| **動能 (Momentum)** | `(P_t / P_{t-n} - 1) × 100` | 捕捉方向與力度（1m/3m/6m 對應 4/13/26 週） |
| **Rolling Z-score** | `(x - rolling_mean) / rolling_std` | 標準化到可比尺度（預設 52 週窗口） |
| **趨勢/SMA** | `P / SMA_n - 1` 或 `SMA_short > SMA_long` | 判斷中長期方向 |

### 3.2 反轉欄位

部分指標語意需反轉（越高越不利）：
- 失業率 → `unrate_trend_inv_z`（反轉：失業率下降 = 利好）
- 美元指數 → `dxy_mom_inv_z`（反轉：美元走弱 = 流動性寬鬆）
- HY OAS → `hy_oas_inv_z`（反轉：利差收窄 = 風險偏好高）
- 實質殖利率 → `real_yield_inv_z`（反轉：實質利率走低 = 寬鬆）

**經驗**：先用散點圖或 Spearman 相關確認反轉方向是否正確，避免符號錯誤。

### 3.3 Z-score 窗口選擇

| 窗口 | 特性 |
|------|------|
| 26 週 | 更敏感、噪音多 |
| **52 週（建議起點）** | 平衡敏感度與穩定性 |
| 104 週 | 更平滑但反應遲鈍 |

**經驗**：52 週在本案表現最穩，但不同資產節奏不同，可做窗口敏感度測試。

---

## 4. 合成分數與權重設計

### 4.1 先驗權重（你的判斷）

用 dataclass 定義每個維度的子因子權重，加總為 1.0：

```python
@dataclass
class GrowthWeights:
    copper_mom3_z: float = 0.20
    bdry_mom1_z:   float = 0.20
    nfp_change_z:  float = 0.20
    unrate_inv_z:  float = 0.15
    durable_goods: float = 0.25
```

**原則**：
- 先驗權重反映「你認為哪個指標對這個維度更重要」的敘事邏輯
- 不需要「最優」——目的是建立一個可解釋的基線
- 之後用 Ridge 和 counterfactual 來檢驗這組權重的合理性

### 4.2 加權合成 → tanh 壓縮

```python
raw = w1 * z1 + w2 * z2 + ...
score = tanh(raw / 2.0)   # 映射到 [-1, 1]
```

`tanh` 的好處：
- 自然壓縮到 [-1, 1]，極端值不會主導
- 除以 2.0 控制壓縮的激進程度（可調）
- 比 min-max 正規化更穩健（不受歷史極值綁架）

### 4.3 宏觀溫度（多維度合成）

```python
blend = growth - 0.5 * inflation + 0.5 * liquidity + 0.5 * risk
temperature = (tanh(blend) + 1) / 2 × 100   # 映射到 [0, 100]
```

**經驗**：混合係數（1, -0.5, 0.5, 0.5）是敘事選擇而非最佳化結果。通膨用負號是因為高通膨壓力對風險資產通常不利。

---

## 5. Regime 分類

### 5.1 規則式分類（本案採用）

```
if growth > 高門檻 and inflation > 高門檻 → 過熱
if growth > 高門檻 and inflation ≤ 高門檻 → 擴張
if growth < 0 and inflation > 高門檻       → 滯脹風險
if growth < 低門檻 and liquidity < 低門檻  → 收縮
if growth 微正 且在上升                     → 復甦
else                                        → 中性
```

### 5.2 門檻校準

門檻不是隨意設定——用分數分布的分位數來校準：

```python
# growth_score 分布：mean=-0.05, std=0.25
# growth_high ≈ 75th percentile ≈ 0.20
# growth_low  ≈ 25th percentile ≈ -0.20
```

**經驗**：
- 先跑一次拿到分數分布，再設門檻
- 門檻太嚴 → 多數週歸為 neutral，失去區分度
- 門檻太鬆 → regime 切換過頻，噪音大
- 可用計算器（如 `calculator.html`）互動式調整

---

## 6. 擬合與驗證（Ridge 回歸）

### 6.1 為什麼用 Ridge

| 特性 | 說明 |
|------|------|
| 正則化 | 子因子間有共線性，OLS 係數不穩定；Ridge 的 L2 penalty 讓係數更穩 |
| 不需 scikit-learn | 閉合解 `β = (X'X + αI)⁻¹X'y`，純 numpy 實作即可 |
| `RIDGE_ALPHA=1.0` | 正則化強度。越大→係數越縮向 0→偏差↑方差↓ |

### 6.2 訓練/測試切分

```python
TRAIN_FRAC = 0.70   # 前 70% 做訓練，後 30% 做樣本外驗證
```

**關鍵**：時間序列不能隨機切分，必須按時間順序前段訓練、後段測試。

### 6.3 評估指標

| 指標 | 含義 | 本案經驗 |
|------|------|----------|
| **R²** | 解釋變異的比例 | 訓練集 0.02–0.12 已算有意義；測試集常接近 0 或為負 |
| **Spearman IC** | 預測排序與實際排序的相關性 | 比 R² 更實用；0.10+ 就有參考價值 |

### 6.4 本案實際結果（最重要的經驗）

**子因子層級 Ridge（z → SPY 前瞻報酬）**：
- 4w：R²_test 幾乎全為負，IC_test 接近 0
- 13w：R²_test 仍為負，但部分 IC_test 轉正（Growth IC_test=0.28）

**四維分數 → SPY（Ridge）**：
- 4w：R²_test=0.001，IC_test=0.095
- 13w：R²_test=-0.11，IC_test=0.107

**Risk 支柱（含 curve_mom）**：
- 13w：R²_test=0.095，IC_test=0.359 ← 測試集表現最好的一組

**結論**：短期（4 週）預測力弱；中期（13 週）稍好但仍有限。Ridge 學到的 β 不該直接當交易權重，但 Spearman IC 提供了「方向性參考」的信心。

---

## 7. 回測設計

### 7.1 Regime 回測

對每個 regime、每支 ETF，計算 **1m/3m/6m 前瞻報酬** 的：
- `n`：樣本數（太少則不可靠）
- `mean`、`median`：中心趨勢
- `win_rate`：正報酬比率
- `max_dd`：最大回撤（路徑風險）

分別報告 all / train / test，觀察是否有過擬合跡象。

### 7.2 事件回測

定義離散事件規則（例如：銅 3M 動能 > 8% 且 BDRY 1M > 10%），統計事件觸發後各資產表現。

```python
EVENT_RULES = [
    {
        "name": "copper_bdry_risk_on",
        "conditions": {"copper_mom_3m_pct": (">", 8.0), "bdry_mom_1m_pct": (">", 10.0)},
    },
]
```

**經驗**：事件回測比 regime 回測更直覺，但樣本數通常更少（本案 49–132 次），統計意義需謹慎解讀。

### 7.3 前瞻報酬的計算

```python
fwd_return = price[t + horizon] / price[t] - 1
```

注意：最後 `horizon` 週的資料無前瞻報酬（NaN），不要用來回測。

---

## 8. 關鍵經驗教訓

### 教訓 1：先驗權重與 Ridge 權重目的不同

| | 先驗權重 | Ridge β |
|---|---------|---------|
| 來源 | 你的經濟直覺 | 樣本資料擬合 |
| 目標 | 建立可解釋的「環境敘事」 | 最大化對目標報酬的解釋力 |
| 穩定性 | 不隨樣本改變 | 隨訓練窗口/正則化/目標變數改變 |

**不要用 Ridge β 直接替換先驗權重**。兩者互為參照：Ridge 告訴你「資料覺得誰重要」，先驗告訴你「你的邏輯覺得誰重要」。差異大的地方值得深入研究。

### 教訓 2：測試集表現才是真相

- 訓練集的 R² 和 IC 幾乎總是看起來不錯
- 測試集 R² 為負很常見——代表模型在樣本外還不如用平均值預測
- **Spearman IC** 比 R² 更寬容也更實用（只看排序，不看絕對值）
- IC_test > 0.10 已有方向性參考價值

### 教訓 3：共線性是真實問題

- 銅同時出現在 Growth 和 Inflation 支柱
- Ridge 會把共線因子的係數往零壓
- `|β| 歸一化` 僅供「相對強弱」直覺，不代表「最佳配比」

### 教訓 4：中期比短期更可靠

- 4 週前瞻：噪音主導，幾乎所有模型 test R² 為負
- 13 週前瞻：開始出現穩定的排序相關（IC）
- 26 週前瞻：方向性更強但樣本更少

### 教訓 5：權重小改動對結果影響有限

counterfactual 實驗顯示：
- Growth 權重微調（±5%）→ growth_score Pearson 相關 > 0.99
- Regime 不一致僅 10/156 週
- Spearman IC 變化小（0.10 → 0.09）

**啟示**：不要花太多時間微調權重，大方向對就好。把精力放在「選對指標」而非「調對權重」。

### 教訓 6：Regime 標籤是描述，不是預測

- Regime 是對當下環境的「分類標籤」
- 回測只能告訴你「歷史上這個標籤下資產通常怎麼走」
- 不等於「現在是這個 regime 所以未來一定會怎樣」

### 教訓 7：發布延遲會吃掉邊際

- 月頻數據（非農、耐久財）有 2–5 週發布延遲
- 若不加延遲處理，回測會有前視偏差，結果看起來偏好
- 加入延遲後，訊號的邊際預測力會顯著下降

---

## 9. 可調參數清單

以下是建立新追蹤場景時需要決定的參數：

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `WEEK_ANCHOR` | `"W-FRI"` | 週頻對齊的錨定日 |
| `MOM_WEEKS` | `{1m:4, 3m:13, 6m:26}` | 動能窗口 |
| `ZSCORE_WINDOW_WEEKS` | `52` | Z-score 滾動窗口 |
| `RIDGE_ALPHA` | `1.0` | 正則化強度 |
| `TRAIN_FRAC` | `0.70` | 訓練/測試比例 |
| 各支柱 Weights | 見 dataclass | 子因子權重（加總為 1） |
| `RegimeThresholds` | 見 dataclass | 分類門檻（應依分數分布校準） |
| `EVENT_RULES` | 見 config | 事件觸發條件 |
| `BACKTEST_ETFS` | `[SPY, QQQ, ...]` | 回測標的 |
| `FRED_SERIES` / `YAHOO_TICKERS` | 見 config | 資料來源對照 |
| `tanh` 分母 | `2.0` | 分數壓縮的激進程度 |
| 宏觀溫度混合係數 | `1, -0.5, 0.5, 0.5` | 各維度在溫度中的權重 |

---

## 10. 複用 Checklist

當你要對一組新的「指數 ↔ 資產」做同樣的追蹤流程時：

### Phase 1：定義問題
- [ ] 確認你想追蹤的 **目標資產**（股票 / ETF）
- [ ] 列出你認為有連動性的 **指標/指數**（3–8 個為佳）
- [ ] 初步分組（例如：基本面 / 價格面 / 流動性面）
- [ ] 決定追蹤頻率（週 / 日 / 月）

### Phase 2：資料管線
- [ ] 確認每個指標的資料來源（FRED / Yahoo / 其他 API）
- [ ] 確認頻率與發布延遲
- [ ] 寫入 `config.py` 的 `FRED_SERIES` / `YAHOO_TICKERS`
- [ ] 跑 `fetch` 確認資料完整性

### Phase 3：特徵與分數
- [ ] 為每個指標建立特徵（動能、z-score）
- [ ] 決定是否需要反轉
- [ ] 設定先驗權重（不需完美，合理即可）
- [ ] 用 `tanh` 壓縮成 [-1, 1] 分數
- [ ] 畫圖確認分數與目標資產大致同向

### Phase 4：驗證
- [ ] 跑 Ridge 擬合（分數 → 目標資產前瞻報酬）
- [ ] 檢查 train/test R² 和 Spearman IC
- [ ] 若 IC_test 為負或接近 0 → 重新審視指標選擇
- [ ] 比較 Ridge β 與先驗權重的差異，理解原因

### Phase 5：回測
- [ ] 設定 Regime 門檻（依分數分位數）
- [ ] 跑 regime 回測，看各環境下目標資產表現
- [ ] 設計事件規則（可選）
- [ ] 確認 train/test 表現一致性

### Phase 6：監控
- [ ] 定期更新資料、重跑分數
- [ ] 觀察 rolling IC 是否衰減
- [ ] 若 IC 持續走低 → 可能需要重新校準權重或更換指標

---

## 11. 常見陷阱

| 陷阱 | 後果 | 預防 |
|------|------|------|
| 未處理月頻發布延遲 | 前視偏差，回測虛好 | `merge_asof` + 延遲天數 |
| Z-score 窗口太短 | 高波動、假訊號 | ≥ 26 週，建議 52 週 |
| 把 Ridge β 當交易信號 | 樣本外失效 | β 僅供參照，不替換先驗 |
| 過度調參 | 過擬合訓練集 | 看 test 指標；權重小改影響有限 |
| Regime 門檻一刀切 | 分數分布會隨時間漂移 | 定期重新校準門檻 |
| 忽略樣本數 | 小樣本統計不可靠 | n < 20 的 regime/event 謹慎解讀 |
| 同一指標跨支柱共用 | 共線性讓 Ridge 係數不穩 | 知道即可，不必強制排除 |
| 用 R² 作唯一判斷 | 宏觀預測 R² 天生低 | 以 Spearman IC 為主要參考 |

---

## 12. 技術架構完整記錄

本節記錄整個程式的實作細節，讓未來任何頻道或工作區能直接讀懂、修改或延伸。

### 12.1 專案目錄結構

```
eco temperature/
├── main.py              # CLI 入口（Click）
├── config.py            # 所有可調參數的唯一真相來源
├── requirements.txt     # Python 依賴
├── .env                 # FRED_API_KEY（不進版控）
├── macro.db             # SQLite 原始序列
│
├── data/                # 資料層
│   ├── sources.py       # FRED + Yahoo 下載
│   ├── align.py         # 週五對齊、月頻延遲合併
│   └── store.py         # SQLite schema / CRUD
│
├── features/            # 特徵工程
│   ├── build.py         # 動能、SMA、z-score 矩陣組裝
│   ├── momentum.py      # pct_change 計算
│   ├── trend.py         # SMA
│   └── zscore.py        # rolling z-score
│
├── scores/              # 分數合成
│   ├── composite.py     # 四維分數 + 宏觀溫度
│   ├── regime.py        # 規則式 Regime 分類
│   └── spy_fit.py       # Ridge 擬合 SPY 前瞻報酬
│
├── backtest/            # 回測引擎
│   ├── engine.py        # Regime + 事件前瞻回測
│   └── metrics.py       # mean/median/win_rate/max_dd
│
├── output/              # 產出層
│   ├── charts.py        # matplotlib + plotly 圖表
│   ├── summary.py       # 繁中週報文字
│   ├── artifacts/       # CSV、PNG、TXT 產出
│   └── web/             # JSON 給 Next.js 看板
│
├── research/            # 研究工具（不影響主程式）
│   ├── calculator.html  # 瀏覽器互動式權重計算器
│   ├── export_calculator_data.py
│   ├── analyze_learned_weights.py
│   ├── counterfactual_interval_report.py
│   └── output/          # 研究報告
│
└── dashboard/           # Next.js 看板
    ├── app/             # 頁面路由
    ├── components/      # UI 元件
    ├── lib/             # 因子定義、Regime 顏色、解讀邏輯
    └── data/web/        # JSON 副本（可從 output/web 複製）
```

### 12.2 CLI 管線（main.py）

管線有 5 個獨立指令，可單獨或串聯執行：

```bash
python main.py fetch --start 2015-01-01   # 下載資料 → SQLite
python main.py score                       # 對齊 + 特徵 + 分數 + Regime → CSV
python main.py backtest                    # 前瞻回測 → CSV
python main.py report                      # 圖表 + 繁中週報 → artifacts/
python main.py export                      # JSON → output/web/（供看板）
python main.py all --start 2015-01-01      # 以上全部一次跑完
```

**管線資料流**：

```
fetch: FRED API / Yahoo API
         ↓ upsert
       macro.db (SQLite)
         ↓ load_series
score: build_weekly_panel → build_feature_matrix → compute_composite_scores
         → add_regime → fit_spy_composite
         ↓ to_csv
       output/artifacts/macro_panel.csv (589+ 列 × ~90 欄)
         ↓
backtest: regime_backtest + event_backtest
         ↓
       output/artifacts/backtest_*.csv
         ↓
report: write_summary_report + plot_* 函式
         ↓
       output/artifacts/*.png + weekly_summary_zh-TW.txt
         ↓
export: 讀 macro_panel.csv → 寫 current.json, panel.json, factor_weights.json
         ↓
       output/web/*.json → (複製到) dashboard/data/web/
```

### 12.3 SQLite Schema（data/store.py）

```sql
CREATE TABLE series_raw (
    series_name TEXT NOT NULL,
    obs_date    TEXT NOT NULL,   -- ISO 'YYYY-MM-DD'
    value       REAL,
    source      TEXT,            -- 'fred' | 'yahoo'
    PRIMARY KEY (series_name, obs_date)
);

CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
```

### 12.4 資料對齊機制（data/align.py）

**日頻 → 週頻**：`resample("W-FRI").last()` 取每週五的最後一筆觀測。

**月頻 → 週頻**（避免前視偏差）：
1. 每筆月度觀測計算「可用日期」= 月末 + 35 天（`MONTHLY_RELEASE_LAG_DAYS = 35`）
2. 用 `pd.merge_asof(direction="backward")` 把月度數據合併到週頻時間軸
3. 結果：某一週只能看到已發布的月度數據，不會提前使用

### 12.5 特徵工程實作（features/build.py）

**Z-score 欄位與反轉邏輯**：

| 輸出欄位 | 輸入 | 反轉？ | 公式 |
|----------|------|--------|------|
| `copper_mom3_z` | 銅期貨 3M 動能 | 否 | `rolling_zscore(copper_mom_3m, 52)` |
| `bdry_mom1_z` | BDRY 1M 動能 | 否 | `rolling_zscore(bdry_mom_1m, 52)` |
| `wti_mom3_z` | WTI 3M 動能 | 否 | `rolling_zscore(wti_mom_3m, 52)` |
| `nfp_change_z` | 非農月增 | 否 | `rolling_zscore(nfp_change, 52)` |
| `unrate_trend_inv_z` | 失業率 3M 變化 | **是** | `-rolling_zscore(unrate_mom_3m, 52)` |
| `durable_goods_z` | 耐久財 MoM% | 否 | `rolling_zscore(durable_goods_mom, 52)` |
| `breakeven_z` | Breakeven 3M 動能 | 否 | `rolling_zscore(bke_mom_3m, 52)` |
| `fed_change_inv_z` | DFF 4W 變化 | **是** | `-rolling_zscore(dff_change_4w, 52)` |
| `curve_z` | T10Y2Y 水準 | 否 | `rolling_zscore(t10y2y, 52)` |
| `dxy_mom_inv_z` | 美元 3M 動能 | **是** | `-rolling_zscore(dxy_mom3, 52)` |
| `hy_oas_inv_z` | HY OAS 水準 | **是** | `-rolling_zscore(hy_oas, 52)` |
| `real_yield_inv_z` | 10Y 實質殖利率 | **是** | `-rolling_zscore(real_yield_10y, 52)` |

**特殊欄位**：`curve_mom_3m_abs` = 殖利率曲線 3M 絕對變化；`durable_goods_mom` = 耐久財 MoM%。

### 12.6 分數合成公式（scores/composite.py）

Growth/Inflation/Liquidity 各自加權 z 後除 2 再 tanh 壓縮至 [-1,1]。Risk 為三分數線性組合 + 0.1 曲線加成再 tanh。宏觀溫度 = `(tanh(growth - 0.5*inf + 0.5*liq + 0.5*risk) + 1)/2 * 100`。

### 12.7 Regime 分類規則（scores/regime.py）

6 種：expansion(綠)、recovery(深綠)、overheating(紅)、stagflation_risk(橘)、contraction(暗紅)、neutral(灰)。按優先順序匹配 growth/inflation/liquidity 門檻。

### 12.8 Ridge 回歸（scores/spy_fit.py）

純 numpy 閉合解，無 scikit-learn。擬合 `spy_fwd_4w` 和 `spy_fwd_13w`。輸出 `spy_composite_*` = tanh(fitted/std)。

### 12.9 產出檔案清單

| 檔案 | 位置 | 用途 |
|------|------|------|
| `macro_panel.csv` | `output/artifacts/` | 主面板 |
| `weekly_summary_zh-TW.txt` | `output/artifacts/` | 繁中週報 |
| `backtest_regime_summary.csv` | `output/artifacts/` | Regime 回測 |
| `backtest_event_summary.csv` | `output/artifacts/` | 事件回測 |
| `regime_spy.png` | `output/artifacts/` | SPY + Regime 圖 |
| `composite_scores.png` | `output/artifacts/` | 四維分數圖 |
| `macro_temperature.png` | `output/artifacts/` | 溫度面積圖 |
| `spy_composite.png` | `output/artifacts/` | Ridge 合成圖 |
| `rolling_ic.png` | `output/artifacts/` | 滾動 IC 圖 |
| `heatmap_mean_3m.png` | `output/artifacts/` | 熱力圖 |
| `heatmap_3m_plotly.html` | `output/artifacts/` | 互動熱力圖 |
| `current.json` | `output/web/` | 最新一週全欄位 |
| `panel.json` | `output/web/` | 歷史面板 |
| `factor_weights.json` | `output/web/` | 所有權重 |

---

## 13. 圖表閱讀指南（靜態報告）

### 13.1 regime_spy.png

- **背景色塊** = 當週 Regime；**黑線** = SPY 週收盤
- 用途：對照不同景氣階段時股價走勢；色塊是標籤不是訊號

### 13.2 composite_scores.png

- **四條線** = growth/inflation/liquidity/risk score
- **橫線 0** = 中性；重點看是否穿越 0、趨勢方向
- 通膨線高 = 通膨壓力強（對風險資產不利）

### 13.3 macro_temperature.png

- 面積圖 0-100；**虛線 50** = 中性
- 越高 = 環境越友善；看長期趨勢

### 13.4 spy_composite.png

- **左軸實線** = Ridge 合成分數；**右軸虛線** = SPY 實際前瞻報酬
- **垂直虛線** = train/test 切分；測試期才是真正驗證

### 13.5 rolling_ic.png

- 各因子對 SPY 4W 的滾動 52 週 Spearman IC
- IC 會漂移；用來監控哪個因子近期有效/失靈

### 13.6 heatmap_mean_3m.png

- Regime x ETF 的歷史平均 3M 前瞻報酬
- 綠正紅負；是統計不是預測

---

## 14. Next.js 看板 UI 閱讀指南

### 14.1 環境與啟動

```bash
python main.py score && python main.py export
cd dashboard && npm install && npm run dev
# http://localhost:3000
```

依賴：`next@14.2.15`, `react@^18`, `recharts@^3.8.1`

### 14.2 資料流

`lib/server-data.ts` 的 `loadDashboardData()` 搜尋 `../output/web` > `./output/web` > `./data/web`，讀取 `current.json` + `panel.json`，傳入 Server Component `app/page.tsx`，分派給各元件。

### 14.3 看板區塊

#### RegimeHero（頂部摘要）

- 宏觀溫度數字 + 環形進度條
- Regime 名稱 + 中文 + 顏色徽章
- 四維分數條形圖（-1 到 +1）+ 4 週變化箭頭
- 白話摘要段落
- **讀法**：溫度 > 50 偏友善；條形圖看各維度位置和動向

#### FactorCards（四張因子卡）

- 每張卡：分數值 + 強弱判斷 + 子因子條形圖 + 可展開的公式和欄位提示
- **讀法**：子因子條形圖看「誰在拉/拖」；z-score 0 在中間
- Risk 卡特殊：子項是三個分數 + 曲線加成

#### PanelTimeRangeSection（時間軸）

- 時間範圍選擇器（1Y/3Y/5Y/全部）
- **TemperatureChart**：藍色面積圖 0-100，虛線 50
- **RegimeTimeline**：連續色條
- **SpyChart**：SPY + Regime 背景色
- **ScoresChart**：四維分數折線，可切換圖例

### 14.4 前端因子定義同步

`lib/factors.ts` 的 `GROWTH_COMPONENTS` / `INFLATION_COMPONENTS` / `LIQUIDITY_COMPONENTS` / `RISK_DRIVERS` **必須與 `config.py` 保持同步**。`factor_weights.json` 可作為校驗來源。

### 14.5 解讀邏輯（lib/interpretation.ts）

| 函式 | 用途 |
|------|------|
| `scoreVerdict(score)` | 分數 → 偏強/中性/偏弱 + 顏色 |
| `temperatureZoneLabel(temp)` | 溫度 → 極冷/偏冷/中性/偏暖/極暖 |
| `heroSummary()` | 頂部白話摘要 |
| `factorNarrative()` | 各因子卡敘述 |
| `percentileRank()` | 歷史百分位 |

門檻：> 0.30 偏強(emerald)、> 0.10 略偏強、[-0.10,0.10] 中性(slate)、< -0.10 略偏弱(orange)、< -0.30 偏弱(rose)

### 14.6 元件對照表

| 元件 | 檔案 | 類型 |
|------|------|------|
| `RegimeHero` | `components/RegimeHero.tsx` | Server |
| `FactorCards` | `components/FactorCards.tsx` | Server |
| `PanelTimeRangeSection` | `components/PanelTimeRangeSection.tsx` | Client |
| `TemperatureChart` | `components/TemperatureChart.tsx` | Client |
| `RegimeTimeline` | `components/RegimeTimeline.tsx` | Client |
| `SpyChart` | `components/SpyChart.tsx` | Client |
| `ScoresChart` | `components/ScoresChart.tsx` | Client |
| `ClientOnly` | `components/ClientOnly.tsx` | Client |

### 14.7 更新看板 SOP

```bash
python main.py fetch --start 2015-01-01 && python main.py score && python main.py export
# 重新整理頁面即可
```

---

## 15. 研究工具記錄

### 15.1 Growth 權重計算器（research/calculator.html）

瀏覽器互動調整 Growth 權重，看 growth_score 走勢、Spearman IC、Regime 分布、溫度統計。純 JavaScript 與 Python 邏輯一致。

```bash
python research/export_calculator_data.py
cd research && python -m http.server 8765
# http://localhost:8765/calculator.html
```

### 15.2 權重分析（research/analyze_learned_weights.py）

各支柱子因子 Ridge vs SPY，產生 `weight_analysis_report.md`。

### 15.3 Counterfactual（research/counterfactual_interval_report.py）

指定區間覆寫 Growth 權重，對比先驗差異。

---

## 16. 擴展指南

### 16.1 換標的

改 `config.py` 的 `YAHOO_TICKERS` / `BACKTEST_ETFS`，再於 `align.py` 和 `build.py` 加載新欄位。

### 16.2 加新支柱

config dataclass → composite.py → regime.py → factors.ts → FactorCards.tsx

### 16.3 換目標資產

改 `spy_fit.py` 的 `etf_spy` 欄位。

### 16.4 新資料來源

在 `sources.py` 加下載函式，回傳 `pd.Series(DatetimeIndex)`，在 `fetch_all_raw()` 呼叫 `upsert_series()`。

---

## 附錄 A：技術棧

| 層級 | 工具 | 備註 |
|------|------|------|
| 資料擷取 | `fredapi` + `yfinance` | 需 FRED_API_KEY |
| 儲存 | SQLite | 單檔 `macro.db` |
| 運算 | pandas + numpy | 核心計算 |
| 回歸 | 純 numpy 閉合解 | 無 scikit-learn |
| 靜態圖表 | matplotlib + plotly | Agg backend |
| 研究工具 | HTML + Chart.js | 純前端 |
| 看板 | Next.js 14 + Tailwind + Recharts | dashboard/ |
| CLI | Click | 5 指令 + all |

## 附錄 B：本案指標對照

### Growth
| 子因子 | 來源 | 先驗權重 | Ridge 歸一 (13w) |
|--------|------|----------|-----------------|
| 銅 3M z | Yahoo HG=F | 0.20 | 0.07 |
| BDRY 1M z | Yahoo BDRY | 0.20 | 0.39 |
| 非農 z | FRED PAYEMS | 0.20 | 0.16 |
| 失業率反轉 z | FRED UNRATE | 0.15 | 0.32 |
| 耐久財 z | FRED DGORDER | 0.25 | 0.06 |

### Inflation
| 子因子 | 來源 | 先驗權重 | Ridge 歸一 (13w) |
|--------|------|----------|-----------------|
| WTI 3M z | Yahoo CL=F | 0.35 | 0.03 |
| 銅 3M z | Yahoo HG=F | 0.25 | 0.47 |
| Breakeven z | FRED T10YIE | 0.40 | 0.49 |

### Liquidity
| 子因子 | 來源 | 先驗權重 | Ridge 歸一 (13w) |
|--------|------|----------|-----------------|
| Fed 反轉 z | FRED DFF | 0.20 | 0.15 |
| 曲線 z | FRED T10Y2Y | 0.20 | 0.26 |
| 美元反轉 z | FRED DTWEXBGS | 0.15 | 0.22 |
| HY OAS 反轉 z | FRED BAMLH0A0HYM2 | 0.25 | 0.17 |
| 實質利率反轉 z | FRED DFII10 | 0.20 | 0.21 |

### Risk
Growth x 0.34 - Inflation x 0.33 + Liquidity x 0.33 + 0.1 x tanh(curve_steepening)，線性混合後 tanh。

## 附錄 C：current.json 欄位

| 類別 | 欄位 | 說明 |
|------|------|------|
| 原始 | `copper_fut`, `bdry`, `wti`, `dff`, `t10y2y`, `dxy_broad`, `breakeven_10y`, `hy_oas`, `real_yield_10y`, `etf_*` | 價格/水準 |
| 動能 | `{indicator}_mom_{1m/3m/6m}` | 百分比變化 |
| Z-score | `{indicator}_z` / `{indicator}_inv_z` | 52 週滾動 z |
| 分數 | `growth_score`, `inflation_score`, `liquidity_score`, `risk_score` | [-1, 1] |
| 溫度 | `macro_temperature` | [0, 100] |
| Regime | `regime` | 6 種字串 |

## 附錄 D：週報段落結構

1. 標題（截至日期）
2. 怎麼讀這份週報（四段固定解說）
3. 宏觀溫度 + Regime
4. 白話摘要（自動生成）
5. 分數摘要（四維數值）
6. 指標動能
7. SPY 擬合統計（若有）
8. 解讀段落（依 Regime 切換）
9. 圖表閱讀指南
10. 免責聲明

---

*最後更新：2026-04-15*
*來源專案：eco temperature（宏觀 Regime 研究工具）*
