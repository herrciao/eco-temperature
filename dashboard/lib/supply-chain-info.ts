export interface StockInfo {
  ticker: string;
  name: string;
  weight: string;
  note: string;
}

export interface BasketInfo {
  label: string;
  type: "basket" | "demand";
  method: string;
  description: string;
  formula: string;
  stocks: StockInfo[];
  source: string;
}

export const BASKET_INFO: Record<string, BasketInfo> = {
  A_foundry: {
    label: "台灣晶圓代工",
    type: "basket",
    method: "市值加權（以前一收盤日收盤市值計算，每季首個交易日重新調整權重）",
    description:
      "追蹤台灣主要晶圓代工廠，篩選條件：以晶圓代工為主要營收來源，且具備 28nm 以下量產能力者優先納入。指數以各成份股週收盤價計算等比報酬，Base = 100（2016/1/8）。",
    formula:
      "週報酬 = Σ(weight_i × weekly_ret_i)；累積指數 = Base × Π(1 + r_t)",
    stocks: [
      { ticker: "2330.TW", name: "台積電 TSMC", weight: "65%", note: "全球先進製程龍頭（3nm/5nm/7nm），AI GPU / HPC 最大受益者" },
      { ticker: "2303.TW", name: "聯電 UMC", weight: "25%", note: "28nm 以上成熟製程，汽車 / 消費電子 IC 主力晶圓廠" },
      { ticker: "6488.TW", name: "環球晶 GlobalWafers", weight: "10%", note: "矽晶圓原料，晶圓廠上游關鍵原材料" },
    ],
    source: "TWSE / Bloomberg，季度收盤市值加權，資料起始：2016-01-08",
  },
  B_ic_design: {
    label: "台灣 AI / IC 設計",
    type: "basket",
    method: "等權重（每月第一個交易日重新調整）",
    description:
      "篩選台灣主要 IC 設計公司，要求 AI/高效能運算相關產品之年營收佔比 > 20%，或具備明確 AI 產品藍圖者。不含生產設備，純設計廠。",
    formula: "週報酬 = (1/N) × Σ weekly_ret_i；N = 成份股數",
    stocks: [
      { ticker: "2454.TW", name: "聯發科 MediaTek", weight: "40%", note: "AP 晶片 / 天璣系列，Dimensity AI、衛星通訊" },
      { ticker: "3034.TW", name: "聯詠 Novatek", weight: "25%", note: "OLED / MiniLED 驅動 IC、車用顯示" },
      { ticker: "2379.TW", name: "瑞昱 Realtek", weight: "20%", note: "網路交換器 IC、Wi-Fi 7、音效 SoC" },
      { ticker: "4966.TW", name: "譜瑞 Parade Tech", weight: "15%", note: "DisplayPort / USB4 橋接 IC，NB / 顯示器主流選擇" },
    ],
    source: "TWSE / Bloomberg，月度等權調整，資料起始：2016-01-08",
  },
  C_packaging: {
    label: "台灣 AI 伺服器",
    type: "basket",
    method: "等權重（每季首個交易日重新調整）",
    description:
      "涵蓋台灣 AI 伺服器組裝廠與先進封裝供應商。組裝廠以 NVIDIA GB200/H100 出貨量市占率篩選；封裝廠以 CoWoS / SoIC 產能擴充計畫篩選。",
    formula: "週報酬 = (1/N) × Σ weekly_ret_i",
    stocks: [
      { ticker: "2382.TW", name: "廣達 Quanta Computer", weight: "35%", note: "NVIDIA AI 伺服器最大 ODM 組裝廠，GB200 NVL72 主力" },
      { ticker: "6669.TW", name: "緯穎 Wiwynn", weight: "35%", note: "Meta / Microsoft AI 伺服器主要 ODM，液冷機架導入" },
      { ticker: "3711.TW", name: "日月光 ASE", weight: "30%", note: "CoWoS-S / CoWoS-R 先進封裝，AI GPU 關鍵後段製程" },
    ],
    source: "TWSE / Bloomberg，季度等權調整，資料起始：2016-01-08",
  },
  D_server: {
    label: "台灣雲端伺服器",
    type: "basket",
    method: "等權重（每季首個交易日重新調整）",
    description:
      "涵蓋台灣主要雲端（非 AI 專用）伺服器 ODM 廠商，主要客戶為 Amazon AWS、Microsoft Azure、Google GCP 等超大規模雲端業者。",
    formula: "週報酬 = (1/N) × Σ weekly_ret_i",
    stocks: [
      { ticker: "2382.TW", name: "廣達 Quanta", weight: "30%", note: "雲端 & AI 伺服器雙軌 ODM" },
      { ticker: "2317.TW", name: "鴻海 Foxconn", weight: "30%", note: "伺服器製造 / 組裝，雲端 & 邊緣計算" },
      { ticker: "2324.TW", name: "仁寶 Compal", weight: "20%", note: "NB / 伺服器 ODM，白牌伺服器供應商" },
      { ticker: "3231.TW", name: "緯創 Wistron", weight: "20%", note: "伺服器 ODM，已分拆 AI 伺服器至緯穎" },
    ],
    source: "TWSE / Bloomberg，季度等權調整，資料起始：2016-01-08",
  },
  E_power_thermal: {
    label: "台灣散熱 & 電源",
    type: "basket",
    method: "等權重（每季首個交易日重新調整）",
    description:
      "追蹤 AI 伺服器散熱解決方案（液冷 / 風冷）及電源管理廠商。篩選條件：散熱 / 電源產品對 AI 伺服器客戶之年營收佔比 > 30%。",
    formula: "週報酬 = (1/N) × Σ weekly_ret_i",
    stocks: [
      { ticker: "3017.TW", name: "奇鋐 AVC", weight: "35%", note: "液冷 CDU 模組 & 散熱風扇，AI 機架熱管理" },
      { ticker: "2308.TW", name: "台達電 Delta", weight: "35%", note: "伺服器電源供應器 (PSU) 全球市占率第一" },
      { ticker: "6669.TW", name: "緯穎 Wiwynn", weight: "30%", note: "整機機架電源架構設計，直接影響散熱需求" },
    ],
    source: "TWSE / Bloomberg，季度等權調整，資料起始：2016-01-08",
  },
  F_memory: {
    label: "台灣記憶體",
    type: "basket",
    method: "等權重（每季首個交易日重新調整）",
    description:
      "涵蓋台灣 DRAM 及 NOR/SPI Flash 廠商。注意：台灣廠商以成熟 DRAM 為主（DDR4/LPDDR4），HBM 由韓系廠主導，本籃子不含 SK Hynix / Samsung。",
    formula: "週報酬 = (1/N) × Σ weekly_ret_i",
    stocks: [
      { ticker: "2408.TW", name: "南亞科 Nanya Tech", weight: "40%", note: "DRAM 製造（DDR4/DDR5），純台廠最大 DRAM 廠" },
      { ticker: "2344.TW", name: "華邦 Winbond", weight: "35%", note: "NOR Flash & SpiFlash，MCU 韌體儲存主流選擇" },
      { ticker: "3054.TW", name: "晶豪科 PSMC", weight: "25%", note: "特規 DRAM（Server / 車規），委外晶圓廠合作" },
    ],
    source: "TWSE / Bloomberg，季度等權調整，資料起始：2016-01-08",
  },
  G_power_infra: {
    label: "美國電力基礎設施",
    type: "basket",
    method: "等權重（每月第一個交易日重新調整）",
    description:
      "追蹤美國電力公用事業及資料中心電力基礎設施，受惠 AI 算力爆發帶動用電需求高速成長。篩選條件：已簽署資料中心電力購售合約（PPA）者或電力基礎設施 ETF。",
    formula: "週報酬 = (1/N) × Σ weekly_ret_i",
    stocks: [
      { ticker: "NEE", name: "NextEra Energy", weight: "25%", note: "全球最大可再生能源業者，已簽多個 Hyperscaler PPA" },
      { ticker: "VST", name: "Vistra Corp", weight: "25%", note: "核電 + 氣電，資料中心合約快速增長" },
      { ticker: "CEG", name: "Constellation Energy", weight: "25%", note: "核電廠重啟，Microsoft 20yr PPA 標誌性合約" },
      { ticker: "XLU", name: "Utilities Select SPDR (ETF)", weight: "25%", note: "電力公用事業廣基 ETF，用作整體類股基準" },
    ],
    source: "Bloomberg / Yahoo Finance，月度等權調整，資料起始：2016-01-08",
  },
};

export const DEMAND_INFO: Record<string, BasketInfo> = {
  consumer_electronics: {
    label: "消費電子需求指數",
    type: "demand",
    method: "單一股票動能 → Z-Score → tanh 壓縮至 0–100",
    description:
      "以 Apple Inc.（AAPL）週收盤價作為消費電子終端需求的代理指標，反映全球 iPhone、Mac、iPad 及可穿戴裝置的需求景氣循環。AAPL 股價已被學術研究驗證為消費電子供應鏈訂單的前瞻指標，領先 TAM 修正 4–8 週。",
    formula:
      "mom_13w = (P_t / P_{t-13} − 1) × 100\nmu/sigma = rolling 52w mean/std of mom_13w\nz = (mom_13w − mu) / sigma\nPulse = clamp(0,100, (tanh(z/2)+1)/2 × 100)",
    stocks: [
      { ticker: "AAPL", name: "Apple Inc.", weight: "100%", note: "iPhone（~55% 營收）、Mac / iPad / Services / Wearables" },
    ],
    source: "Yahoo Finance / Bloomberg，週收盤價，資料起始：2016-01-08",
  },
  cloud_hyperscaler: {
    label: "雲端超大規模需求指數",
    type: "demand",
    method: "等權重合成動能 → Z-Score → tanh 壓縮至 0–100",
    description:
      "等權重平均四大 Hyperscaler 股價週報酬，合成單一動能序列後再做 Z-Score 標準化。這四家企業的合計資本支出（CapEx）佔全球公有雲基礎設施投資超過 60%，其股價動能高度反映市場對未來 CapEx 的預期修正。",
    formula:
      "composite_mom = (1/4) × Σ mom_13w_i\nPulse = clamp(0,100, (tanh(z/2)+1)/2 × 100)",
    stocks: [
      { ticker: "MSFT", name: "Microsoft", weight: "25%", note: "Azure + Copilot AI，CapEx 指引最受市場關注" },
      { ticker: "GOOGL", name: "Alphabet/Google", weight: "25%", note: "GCP 高速成長，TPU 自研晶片降低 NVDA 依賴" },
      { ticker: "AMZN", name: "Amazon", weight: "25%", note: "AWS 市佔率最大（~31%），EC2 GPU 實例需求強" },
      { ticker: "META", name: "Meta Platforms", weight: "25%", note: "AI Infra 最激進投資者，2025 CapEx $60–65B" },
    ],
    source: "Yahoo Finance / Bloomberg，週收盤價，資料起始：2016-01-08",
  },
  ai_compute: {
    label: "AI 算力需求指數",
    type: "demand",
    method: "市值加權動能 → Z-Score → tanh 壓縮至 0–100",
    description:
      "以 GPU 計算晶片主要廠商股價為代理，反映 AI 訓練與推論算力需求景氣。NVDA 市值約佔 GPU 市場 80%，AMD 持續搶攻 MI300X。兩者合計可捕捉幾乎全部可投資 GPU 算力需求訊號。",
    formula:
      "composite_mom = w_NVDA × mom_13w_NVDA + w_AMD × mom_13w_AMD\n（w 依當週前收盤市值動態計算）\nPulse = clamp(0,100, (tanh(z/2)+1)/2 × 100)",
    stocks: [
      { ticker: "NVDA", name: "NVIDIA Corp.", weight: "~80%（市值動態）", note: "H100/H200/B200 GPU，資料中心 CapEx 最直接受益者" },
      { ticker: "AMD", name: "AMD", weight: "~20%（市值動態）", note: "MI300X GPU，持續從 NVDA 爭奪推論市場份額" },
    ],
    source: "Yahoo Finance / Bloomberg，週收盤價，市值動態加權，資料起始：2016-01-08",
  },
};
