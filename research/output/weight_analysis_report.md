# 資料驅動權重 vs 先驗（研究用，未改主程式）

- **面板**：`/Users/herrciao/Documents/herrciao cursor/cursor/eco temperature/output/artifacts/macro_panel.csv`（589 列）
- **方法**：與 `scores/spy_fit.py` 相同之 Ridge（`RIDGE_ALPHA=1.0`, `TRAIN_FRAC=0.7`）
- **目標變數**：`spy_fwd_4w`、`spy_fwd_13w`（週報酬）
- **說明**：下列「學習權重」為 **Ridge 係數**；另將 **|β| 正規化加總為 1** 僅供與先驗「同維度內佔比」直覺對照，**不**等於機率或最優保證。

---

## 前瞻 4w（約 4 週）

### Growth（子因子 z）

- Train/Test 列數：280 / 121
- R² train / test：0.0445 / -0.2062
- Spearman IC train / test：0.1723 / -0.0505

| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |
|--------|----------|---------|----------|
| copper_mom3_z | 0.2000 | -0.003238 | 0.1379 |
| bdry_mom1_z | 0.2000 | +0.009219 | 0.3927 |
| nfp_change_z | 0.2000 | +0.004714 | 0.2008 |
| unrate_trend_inv_z | 0.1500 | -0.004224 | 0.1799 |
| durable_goods_z | 0.2500 | -0.002080 | 0.0886 |

### Inflation（子因子 z）

- Train/Test 列數：392 / 168
- R² train / test：0.0860 / -0.2803
- Spearman IC train / test：0.2955 / -0.1065

| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |
|--------|----------|---------|----------|
| wti_mom3_z | 0.3500 | +0.014624 | 0.3677 |
| copper_mom3_z | 0.2500 | +0.006362 | 0.1600 |
| breakeven_z | 0.4000 | -0.018789 | 0.4724 |

### Liquidity（子因子 z）

- Train/Test 列數：388 / 167
- R² train / test：0.0939 / -0.0494
- Spearman IC train / test：0.2602 / 0.0096

| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |
|--------|----------|---------|----------|
| fed_change_inv_z | 0.2000 | +0.003558 | 0.1657 |
| curve_z | 0.2000 | +0.005869 | 0.2733 |
| dxy_mom_inv_z | 0.1500 | -0.005535 | 0.2577 |
| hy_oas_inv_z | 0.2500 | -0.002778 | 0.1294 |
| real_yield_inv_z | 0.2000 | +0.003737 | 0.1740 |

### Risk（對 SPY：growth / inflation / liquidity 分數 + curve_mom_3m_abs）

- 先驗線性係數參考（config RiskWeights）：growth=0.34, inflation_inv=0.33, liquidity=0.33
- Train/Test：400 / 172；R²：0.0405 / 0.0285；IC：0.1534 / 0.1635

| 欄位 | Ridge β |
|------|---------|
| growth_score | +0.002705 |
| inflation_score | -0.003038 |
| liquidity_score | +0.002678 |
| curve_mom_3m_abs | +0.033314 |

### 四維 macro 分數 → SPY（對照 `spy_fit` 係數尺度）

- R² train/test：0.0213 / 0.0011；IC train/test：0.1485 / 0.0952

| 因子 | Ridge β |
|------|---------|
| growth_score | -0.009483 |
| inflation_score | +0.010704 |
| liquidity_score | -0.000925 |
| risk_score | +0.045228 |

---

## 前瞻 13w（約 13 週）

### Growth（子因子 z）

- Train/Test 列數：274 / 118
- R² train / test：0.1207 / -0.1475
- Spearman IC train / test：0.3234 / 0.2818

| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |
|--------|----------|---------|----------|
| copper_mom3_z | 0.2000 | -0.003720 | 0.0703 |
| bdry_mom1_z | 0.2000 | +0.020721 | 0.3914 |
| nfp_change_z | 0.2000 | +0.008420 | 0.1590 |
| unrate_trend_inv_z | 0.1500 | -0.017154 | 0.3240 |
| durable_goods_z | 0.2500 | +0.002932 | 0.0554 |

### Inflation（子因子 z）

- Train/Test 列數：385 / 166
- R² train / test：0.0751 / -0.1176
- Spearman IC train / test：0.2571 / 0.1152

| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |
|--------|----------|---------|----------|
| wti_mom3_z | 0.3500 | -0.001291 | 0.0324 |
| copper_mom3_z | 0.2500 | +0.018856 | 0.4728 |
| breakeven_z | 0.4000 | -0.019732 | 0.4948 |

### Liquidity（子因子 z）

- Train/Test 列數：382 / 164
- R² train / test：0.2483 / -0.2648
- Spearman IC train / test：0.4199 / -0.0157

| 子因子 | 先驗權重 | Ridge β | |β| 歸一 |
|--------|----------|---------|----------|
| fed_change_inv_z | 0.2000 | +0.007945 | 0.1465 |
| curve_z | 0.2000 | +0.013902 | 0.2564 |
| dxy_mom_inv_z | 0.1500 | -0.012076 | 0.2227 |
| hy_oas_inv_z | 0.2500 | -0.009113 | 0.1681 |
| real_yield_inv_z | 0.2000 | +0.011185 | 0.2063 |

### Risk（對 SPY：growth / inflation / liquidity 分數 + curve_mom_3m_abs）

- 先驗線性係數參考（config RiskWeights）：growth=0.34, inflation_inv=0.33, liquidity=0.33
- Train/Test：394 / 169；R²：0.1234 / 0.0948；IC：0.2801 / 0.3588

| 欄位 | Ridge β |
|------|---------|
| growth_score | +0.033594 |
| inflation_score | -0.032986 |
| liquidity_score | +0.012816 |
| curve_mom_3m_abs | +0.077001 |

### 四維 macro 分數 → SPY（對照 `spy_fit` 係數尺度）

- R² train/test：0.0917 / -0.1089；IC train/test：0.2610 / 0.1066

| 因子 | Ridge β |
|------|---------|
| growth_score | -0.001989 |
| inflation_score | +0.005011 |
| liquidity_score | +0.001058 |
| risk_score | +0.124121 |

---

## 解讀備註

1. **先驗權重**（20% 等）是敘事結構；**Ridge β** 在「預測 SPY 前瞻報酬」目標下由樣本估出，兩者目的不同。
2. 子因子之間常有 **共線性**，Ridge 會縮小係數，|β| 歸一僅供「相對強弱」參考。
3. **測試集**表現（R²、IC）若明顯弱於訓練集，代表不宜過度解讀「最優」權重。
