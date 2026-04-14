import type { CurrentRecord, FactorComponentDef } from "./types";

export type { FactorComponentDef };

/** Growth composite — matches config.GrowthWeights */
export const GROWTH_COMPONENTS: FactorComponentDef[] = [
  { key: "copper_mom3_z", label: "銅價動能", weight: 0.2, color: "#34d399" },
  { key: "bdry_mom1_z", label: "航運 BDRY", weight: 0.2, color: "#22c55e" },
  { key: "nfp_change_z", label: "非農變化", weight: 0.2, color: "#4ade80" },
  { key: "unrate_trend_inv_z", label: "失業率趨勢（反向）", weight: 0.15, color: "#86efac" },
  { key: "durable_goods_z", label: "耐久財新訂單", weight: 0.25, color: "#6ee7b7" },
];

/** Inflation composite — matches config.InflationWeights */
export const INFLATION_COMPONENTS: FactorComponentDef[] = [
  { key: "wti_mom3_z", label: "WTI 動能", weight: 0.35, color: "#fb923c" },
  { key: "copper_mom3_z", label: "銅價動能", weight: 0.25, color: "#fdba74" },
  { key: "breakeven_z", label: "10Y Breakeven", weight: 0.4, color: "#f97316" },
];

/** Liquidity composite — matches config.LiquidityWeights */
export const LIQUIDITY_COMPONENTS: FactorComponentDef[] = [
  { key: "fed_change_inv_z", label: "Fed 政策（反向）", weight: 0.2, color: "#38bdf8" },
  { key: "curve_z", label: "殖利率曲線 10Y-2Y", weight: 0.2, color: "#7dd3fc" },
  { key: "dxy_mom_inv_z", label: "美元動能（反向）", weight: 0.15, color: "#0ea5e9" },
  { key: "hy_oas_inv_z", label: "HY 利差（反向）", weight: 0.25, color: "#0284c7" },
  { key: "real_yield_inv_z", label: "實質利率（反向）", weight: 0.2, color: "#0369a1" },
];

/** Sum of risk linear weights + curve term scale (for display normalisation) */
export const RISK_WEIGHT_SUM =
  0.34 + 0.33 + 0.33 + 0.1;

/** Risk drivers — matches scores/composite.py (scores + curve boost) */
export const RISK_DRIVERS: {
  key: string;
  label: string;
  weight: number;
  color: string;
  kind: "score" | "negated_score" | "curve_tanh";
}[] = [
  { key: "growth_score", label: "成長貢獻", weight: 0.34, color: "#a78bfa", kind: "score" },
  {
    key: "inflation_score",
    label: "通膨壓力（反向）",
    weight: 0.33,
    color: "#c4b5fd",
    kind: "negated_score",
  },
  { key: "liquidity_score", label: "流動性", weight: 0.33, color: "#8b5cf6", kind: "score" },
  {
    key: "curve_mom_3m_abs",
    label: "曲線斜率加成",
    weight: 0.1,
    color: "#ddd6fe",
    kind: "curve_tanh",
  },
];

const Z_CLIP = 2;

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map z-score to [-2,2] bar position (center = 0) */
export function zToBarPct(z: number): number {
  const c = Math.max(-Z_CLIP, Math.min(Z_CLIP, z));
  return ((c + Z_CLIP) / (2 * Z_CLIP)) * 100;
}

/** Risk driver value in roughly [-1, 1] for bar */
export function riskDriverValue(
  row: { key: string; kind: "score" | "negated_score" | "curve_tanh" },
  current: CurrentRecord
): number | null {
  if (row.kind === "curve_tanh") {
    const raw = num(current.curve_mom_3m_abs);
    if (raw === null) return null;
    return Math.tanh(raw * 2);
  }
  const s = num(current[row.key as keyof CurrentRecord]);
  if (s === null) return null;
  if (row.kind === "negated_score") return -s;
  return s;
}

export function riskDriverBarPct(v: number): number {
  const c = Math.max(-1, Math.min(1, v));
  return ((c + 1) / 2) * 100;
}

export function componentValue(current: CurrentRecord, key: string): number | null {
  return num(current[key]);
}

/** 組成句：子項（權重%）以「+」連接，數字由權重自動格式化 */
export function formatCompositionSentence(components: FactorComponentDef[]): string {
  return components
    .map((c) => `${c.label}（${(c.weight * 100).toFixed(0)}%）`)
    .join(" + ");
}

/** 與 scores/composite.py 一致：加權 z 加總後 /2，再 tanh */
export const Z_COMPOSITE_FORMULA_ZH =
  "加權 z 加總後除以 2，再經 tanh 壓縮至約 ±1（對應後端 `scores/composite.py`）。";

export function zCompositeNarrativeParagraphs(components: FactorComponentDef[]): string[] {
  return [
    `組成：${formatCompositionSentence(components)}。`,
    `計算：${Z_COMPOSITE_FORMULA_ZH}`,
  ];
}

/** Risk 線性項 + 曲線加成，再 tanh — 對應 composite.py */
export const RISK_FORMULA_PARAGRAPHS: string[] = [
  `組合：成長分數 ×0.34 +（−通膨分數）×0.33 + 流動性分數 ×0.33，再加上殖利率曲線斜率相關項（係數 0.1，內含 tanh）。`,
  "最後整段再經 tanh 壓縮至約 ±1。",
];

/** 各欄位對應資料意義（摺疊區用） */
export const FIELD_HINTS_ZH: Record<string, string> = {
  copper_mom3_z: "銅相關價格動能的滾動 z-score（週頻對齊）。",
  bdry_mom1_z: "乾散貨航運代理（BDRY）約 1 個月動能的 z-score。",
  nfp_change_z: "非農就業變化相對歷史的 z-score。",
  unrate_trend_inv_z: "失業率趨勢取反向後的 z（惡化時對成長訊號不利）。",
  durable_goods_z: "耐久財新訂單的 z-score。",
  wti_mom3_z: "原油（WTI）約 3 個月動能的 z-score。",
  breakeven_z: "10 年期 Breakeven 通膨預期的 z-score。",
  fed_change_inv_z: "政策利率變化取反向（寬鬆傾向為正）的 z。",
  curve_z: "10Y−2Y 殖利率曲線水準的 z-score。",
  dxy_mom_inv_z: "美元指數動能取反向的 z。",
  hy_oas_inv_z: "高收益債 OAS 取反向（利差收斂傾向為正）的 z。",
  real_yield_inv_z: "10 年期實質殖利率取反向的 z。",
  growth_score: "成長合成得分（約 ±1）。",
  inflation_score: "通膨壓力合成得分（約 ±1）；風險式子中取負代表壓抑風險偏好。",
  liquidity_score: "流動性／金融條件合成得分（約 ±1）。",
  curve_mom_3m_abs: "殖利率曲線斜率 3 個月變化（絕對／模型內用於加成）。",
};

export function fieldHintsForKeys(keys: string[]): { key: string; hint: string }[] {
  return keys
    .map((key) => ({ key, hint: FIELD_HINTS_ZH[key] }))
    .filter((x): x is { key: string; hint: string } => Boolean(x.hint));
}

/** 宏觀溫度線性組合（tanh 前）— 對應 composite.py macro_temperature */
export const MACRO_TEMPERATURE_BLEND_ZH =
  "溫度 = 將「成長 − 0.5×通膨 + 0.5×流動性 + 0.5×風險」加總後經 tanh，再映射到 0–100；細部權重見下方「因子拆解」。";
