/**
 * Human-readable interpretation helpers for dashboard scores and temperature.
 * All thresholds are heuristic labels for research UI, not trading signals.
 */

import type { PanelRow } from "./types";

export type ScoreLevel =
  | "strong"
  | "mild_strong"
  | "neutral"
  | "mild_weak"
  | "weak";

export interface ScoreVerdict {
  label: string;
  level: ScoreLevel;
  /** Tailwind-friendly semantic color class suffix or hex for inline style */
  textClass: string;
}

const THRESH = {
  strong: 0.3,
  mild: 0.1,
} as const;

/** Map composite score in ~[-1, 1] to Traditional Chinese verdict. */
export function scoreVerdict(score: number | null): ScoreVerdict {
  if (score == null || Number.isNaN(score)) {
    return { label: "—", level: "neutral", textClass: "text-slate-500" };
  }
  const s = score;
  if (s > THRESH.strong) {
    return { label: "偏強", level: "strong", textClass: "text-emerald-400" };
  }
  if (s > THRESH.mild) {
    return { label: "略偏強", level: "mild_strong", textClass: "text-emerald-300/90" };
  }
  if (s >= -THRESH.mild) {
    return { label: "大致中性", level: "neutral", textClass: "text-slate-300" };
  }
  if (s >= -THRESH.strong) {
    return { label: "略偏弱", level: "mild_weak", textClass: "text-orange-300" };
  }
  return { label: "偏弱", level: "weak", textClass: "text-rose-400" };
}

/** Verdict for inflation score: high = more pressure (often "bad" for risk assets). */
export function inflationVerdict(score: number | null): ScoreVerdict {
  const base = scoreVerdict(score);
  if (score == null || Number.isNaN(score)) return base;
  const s = score;
  if (s > THRESH.strong) {
    return { label: "壓力偏強", level: "strong", textClass: "text-orange-400" };
  }
  if (s > THRESH.mild) {
    return { label: "壓力略高", level: "mild_strong", textClass: "text-amber-300/90" };
  }
  if (s >= -THRESH.mild) {
    return { label: "壓力中性", level: "neutral", textClass: "text-slate-300" };
  }
  if (s >= -THRESH.strong) {
    return { label: "壓力略降", level: "mild_weak", textClass: "text-sky-300" };
  }
  return { label: "壓力偏弱", level: "weak", textClass: "text-sky-400" };
}

/** Liquidity: high = looser conditions. */
export function liquidityVerdict(score: number | null): ScoreVerdict {
  if (score == null || Number.isNaN(score)) {
    return { label: "—", level: "neutral", textClass: "text-slate-500" };
  }
  const s = score;
  if (s > THRESH.strong) {
    return { label: "偏寬鬆", level: "strong", textClass: "text-sky-400" };
  }
  if (s > THRESH.mild) {
    return { label: "略偏寬鬆", level: "mild_strong", textClass: "text-sky-300/90" };
  }
  if (s >= -THRESH.mild) {
    return { label: "大致中性", level: "neutral", textClass: "text-slate-300" };
  }
  if (s >= -THRESH.strong) {
    return { label: "略偏緊", level: "mild_weak", textClass: "text-amber-300" };
  }
  return { label: "偏緊", level: "weak", textClass: "text-rose-300" };
}

export function riskVerdict(score: number | null): ScoreVerdict {
  if (score == null || Number.isNaN(score)) {
    return { label: "—", level: "neutral", textClass: "text-slate-500" };
  }
  const s = score;
  if (s > THRESH.strong) {
    return { label: "風險偏好偏高", level: "strong", textClass: "text-violet-300" };
  }
  if (s > THRESH.mild) {
    return { label: "略偏多", level: "mild_strong", textClass: "text-violet-300/90" };
  }
  if (s >= -THRESH.mild) {
    return { label: "大致中性", level: "neutral", textClass: "text-slate-300" };
  }
  if (s >= -THRESH.strong) {
    return { label: "略偏防禦", level: "mild_weak", textClass: "text-violet-400/80" };
  }
  return { label: "偏防禦", level: "weak", textClass: "text-violet-500/90" };
}

/** Percentile rank (0–100): fraction of historical values strictly below current. */
export function percentileRank(
  currentValue: number,
  historicalValues: number[]
): number | null {
  const vals = historicalValues.filter((x) => Number.isFinite(x));
  if (vals.length === 0) return null;
  const below = vals.filter((x) => x < currentValue).length;
  return (below / vals.length) * 100;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type ScoreKey =
  | "growth_score"
  | "inflation_score"
  | "liquidity_score"
  | "risk_score";

export function panelScoreSeries(panel: PanelRow[], key: ScoreKey): number[] {
  return panel
    .map((p) => num(p[key]))
    .filter((x): x is number => x != null);
}

/** Median of a numeric array (copy sorted). */
export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface SimilarWeekResult {
  week: string;
  distance: number;
}

/**
 * Find past weeks (excluding last `excludeLast`) where score is within tolerance of current,
 * returning the most recent match. If none, find closest by absolute distance.
 */
export function findSimilarHistoricalWeek(
  panel: PanelRow[],
  scoreKey: ScoreKey,
  currentValue: number,
  options?: { tolerance?: number; excludeLast?: number }
): SimilarWeekResult | null {
  const tol = options?.tolerance ?? 0.05;
  const excludeLast = options?.excludeLast ?? 1;
  if (panel.length <= excludeLast) return null;

  const slice = panel.slice(0, Math.max(0, panel.length - excludeLast));
  let bestInBand: { week: string; dist: number } | null = null;
  for (let i = slice.length - 1; i >= 0; i--) {
    const v = num(slice[i][scoreKey]);
    if (v == null) continue;
    const d = Math.abs(v - currentValue);
    if (d <= tol) {
      return { week: slice[i].week, distance: d };
    }
    if (bestInBand == null || d < bestInBand.dist) {
      bestInBand = { week: slice[i].week, dist: d };
    }
  }
  if (bestInBand && bestInBand.dist < 0.25) {
    return { week: bestInBand.week, distance: bestInBand.dist };
  }
  return null;
}

/** Semantic phrase for 4W delta direction. */
export function delta4wNarrative(delta: number | null): string | null {
  if (delta == null || Number.isNaN(delta)) return null;
  if (delta > 0.08) return "近 4 週明顯改善";
  if (delta > 0.02) return "近 4 週略為走強";
  if (delta < -0.08) return "近 4 週明顯走弱";
  if (delta < -0.02) return "近 4 週略為走弱";
  return "近 4 週大致持平";
}

export interface TemperatureZone {
  min: number;
  max: number;
  label: string;
  shortLabel: string;
  fill: string;
}

export const TEMPERATURE_ZONES: TemperatureZone[] = [
  { min: 0, max: 20, label: "極冷（恐慌／深度承壓）", shortLabel: "極冷", fill: "#1e3a5f" },
  { min: 20, max: 40, label: "偏冷（風險資產易承壓）", shortLabel: "偏冷", fill: "#1e40af" },
  { min: 40, max: 60, label: "中性（方向不明）", shortLabel: "中性", fill: "#475569" },
  { min: 60, max: 80, label: "偏暖（環境相對友善）", shortLabel: "偏暖", fill: "#9f1239" },
  { min: 80, max: 100, label: "極熱（可能過熱）", shortLabel: "極熱", fill: "#7f1d1d" },
];

export function temperatureZoneLabel(temp: number | null): {
  zone: TemperatureZone;
  label: string;
} | null {
  if (temp == null || Number.isNaN(temp)) return null;
  const t = Math.max(0, Math.min(100, temp));
  const last = TEMPERATURE_ZONES[TEMPERATURE_ZONES.length - 1];
  if (t >= last.min) {
    return { zone: last, label: last.label };
  }
  const zone =
    TEMPERATURE_ZONES.find((z) => t >= z.min && t < z.max) ?? last;
  return { zone, label: zone.label };
}

export function macroTemperatureSeries(panel: PanelRow[]): number[] {
  return panel
    .map((p) => num(p.macro_temperature))
    .filter((x): x is number => x != null);
}

/**
 * Find a past week whose macro_temperature is closest to current (exclude last row).
 */
export function temperatureHistoricalAnchor(
  panel: PanelRow[],
  currentTemp: number
): SimilarWeekResult | null {
  if (panel.length < 2) return null;
  let best: SimilarWeekResult | null = null;
  for (let i = 0; i < panel.length - 1; i++) {
    const t = num(panel[i].macro_temperature);
    if (t == null) continue;
    const d = Math.abs(t - currentTemp);
    if (best == null || d < best.distance) {
      best = { week: panel[i].week, distance: d };
    }
  }
  if (best && best.distance > 12) return null;
  return best;
}

function vec4(p: PanelRow): [number, number, number, number] | null {
  const g = num(p.growth_score);
  const inf = num(p.inflation_score);
  const liq = num(p.liquidity_score);
  const rk = num(p.risk_score);
  if (g == null || inf == null || liq == null || rk == null) return null;
  return [g, inf, liq, rk];
}

/** L2 distance between two 4D score vectors. */
function dist4(a: [number, number, number, number], b: [number, number, number, number]): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export interface Similar4DWeek {
  week: string;
  distance: number;
}

/**
 * Find up to `k` past weeks with smallest Euclidean distance in 4D score space.
 */
export function findSimilarWeeksBy4D(
  panel: PanelRow[],
  current: PanelRow,
  k = 3
): Similar4DWeek[] {
  const cur = vec4(current);
  if (!cur || panel.length < 2) return [];
  const lastWeek = panel[panel.length - 1]?.week;
  const scored: Similar4DWeek[] = [];
  for (const row of panel) {
    if (row.week === lastWeek) continue;
    const v = vec4(row);
    if (!v) continue;
    scored.push({ week: row.week, distance: dist4(cur, v) });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, k).filter((x) => x.distance < 0.85);
}

/** Approximate forward total return on etf_spy over `forwardWeeks` (if data available). */
export function forwardSpyReturnPct(
  panel: PanelRow[],
  fromWeekIndex: number,
  forwardWeeks: number
): number | null {
  const i0 = fromWeekIndex;
  const i1 = i0 + forwardWeeks;
  if (i1 >= panel.length) return null;
  const p0 = num(panel[i0]?.etf_spy);
  const p1 = num(panel[i1]?.etf_spy);
  if (p0 == null || p1 == null || p0 === 0) return null;
  return ((p1 / p0) - 1) * 100;
}

/**
 * Plain-language paragraph for the four dimensions (latest row).
 */
export function fourDimensionNarrative(
  g: number | null,
  inf: number | null,
  liq: number | null,
  rk: number | null
): string {
  const gv = scoreVerdict(g);
  const iv = inflationVerdict(inf);
  const lv = liquidityVerdict(liq);
  const rv = riskVerdict(rk);

  const parts: string[] = [];
  parts.push(
    `成長${gv.label}、通膨${iv.label}、流動性${lv.label}、風險偏好${rv.label}。`
  );

  const gN = g ?? 0;
  const infN = inf ?? 0;
  const liqN = liq ?? 0;

  if (gN < -THRESH.mild && liqN < -THRESH.mild) {
    parts.push("整體上成長與流動性同時偏弱，環境對風險資產通常較不友善；若通膨壓力同步回落，需觀察流動性能否先行改善。");
  } else if (gN > THRESH.mild && infN > THRESH.mild) {
    parts.push("成長與通膨訊號同偏強，接近「過熱」組合，需留意政策與估值修正風險。");
  } else if (gN < -THRESH.mild && infN > THRESH.mild) {
    parts.push("成長偏弱而通膨壓力偏高，接近滯脹型組合，股債配置可能較為尷尬。");
  } else if (gN > THRESH.mild && liqN > THRESH.mild && infN < THRESH.mild) {
    parts.push("成長與流動性同向偏正面，宏觀環境相對有利於風險偏好（仍非漲跌保證）。");
  } else {
    parts.push("各維度訊號略有分歧，宜降低單一解讀、搭配 Regime 與事件對照。");
  }

  return parts.join(" ");
}

export function scoresChartTooltipBlurb(
  growth: number | null,
  inflation: number | null,
  liquidity: number | null,
  risk: number | null
): string {
  return fourDimensionNarrative(growth, inflation, liquidity, risk).slice(0, 200);
}

export interface FactorNarrative {
  /** 一句話白話解讀，例如「經濟在降溫 — 工業需求轉弱、運輸下降」 */
  oneLiner: string;
  /** 延伸說明，一句較長的解釋 */
  detail: string;
}

/**
 * 根據因子種類、verdict level 與主要子項（z 值最極端的前 2 個）動態組句，
 * 產出一句給一般使用者看的白話解讀。
 */
export function factorNarrative(
  kind: "growth" | "inflation" | "liquidity" | "risk",
  score: number | null,
  topComponents: { label: string; z: number | null }[]
): FactorNarrative {
  const verdict =
    kind === "inflation"
      ? inflationVerdict(score)
      : kind === "liquidity"
      ? liquidityVerdict(score)
      : kind === "risk"
      ? riskVerdict(score)
      : scoreVerdict(score);

  const top2 = topComponents
    .filter((c) => c.z != null && Number.isFinite(c.z))
    .sort((a, b) => Math.abs(b.z!) - Math.abs(a.z!))
    .slice(0, 2)
    .map((c) => c.label);

  const signalStr = top2.length > 0 ? top2.join("、") : "";

  const kindMap: Record<string, { weakOneLiner: string; strongOneLiner: string; neutralOneLiner: string }> = {
    growth: {
      weakOneLiner: "經濟動能在降溫",
      strongOneLiner: "經濟動能偏強勁",
      neutralOneLiner: "經濟動能大致平穩",
    },
    inflation: {
      weakOneLiner: "通膨壓力在減退",
      strongOneLiner: "通膨壓力仍偏高",
      neutralOneLiner: "通膨壓力大致中性",
    },
    liquidity: {
      weakOneLiner: "市場資金偏緊縮",
      strongOneLiner: "市場資金環境寬鬆",
      neutralOneLiner: "市場資金環境中性",
    },
    risk: {
      weakOneLiner: "風險偏好偏向防禦",
      strongOneLiner: "風險偏好偏向進取",
      neutralOneLiner: "風險偏好大致中性",
    },
  };

  const map = kindMap[kind];
  let base: string;
  if (verdict.level === "strong" || verdict.level === "mild_strong") {
    base = map.strongOneLiner;
  } else if (verdict.level === "weak" || verdict.level === "mild_weak") {
    base = map.weakOneLiner;
  } else {
    base = map.neutralOneLiner;
  }

  const oneLiner = signalStr ? `${base} — ${signalStr}` : base;

  const detailMap: Record<string, Record<string, string>> = {
    growth: {
      weak: "成長指標偏弱，需觀察後續需求與就業數據是否出現回穩訊號。",
      strong: "多項成長指標偏強，支撐擴張預期。",
      neutral: "成長訊號方向尚不明確，維持觀望。",
    },
    inflation: {
      weak: "通膨降溫有利於流動性改善，對風險資產相對正面。",
      strong: "通膨壓力偏高，可能限制政策寬鬆空間，需留意利率風險。",
      neutral: "通膨溫和，對資產配置中性影響。",
    },
    liquidity: {
      weak: "金融條件偏緊，資金成本較高，對高估值資產有壓力。",
      strong: "金融條件寬鬆，流動性支撐市場。",
      neutral: "流動性條件尚無明顯偏向。",
    },
    risk: {
      weak: "市場情緒偏保守，投資人傾向防禦性配置。",
      strong: "市場情緒偏積極，風險偏好有利成長型資產。",
      neutral: "風險情緒方向不明，需結合其他維度判斷。",
    },
  };

  const sentimentKey =
    verdict.level === "strong" || verdict.level === "mild_strong"
      ? "strong"
      : verdict.level === "weak" || verdict.level === "mild_weak"
      ? "weak"
      : "neutral";

  const detail = detailMap[kind][sentimentKey];

  return { oneLiner, detail };
}

export interface HeroSummary {
  /** 一句話結論，例如「目前環境偏冷，成長偏弱而通膨壓力偏高，接近滯脹型組合」 */
  headline: string;
  /** 補充說明第二句 */
  detail: string;
  /** 溫度區間短標，例如「偏冷」「極熱」 */
  zoneShortLabel: string;
  /** 溫度區間的 tailwind bg 顏色（inline style 用 hex） */
  zoneBgHex: string;
  /** 是否為「不舒服」的環境（紅橙系） */
  isUncomfortable: boolean;
}

/**
 * 根據四維分數與溫度產出一段給一般使用者看的白話摘要。
 * 可直接放在 RegimeHero 標題下方。
 */
export function heroSummary(
  temp: number | null,
  g: number | null,
  inf: number | null,
  liq: number | null,
  rk: number | null,
  regimeLabelZh: string
): HeroSummary {
  const zoneInfo = temperatureZoneLabel(temp);
  const zoneShortLabel = zoneInfo?.zone.shortLabel ?? "—";
  const zoneBgHex = zoneInfo?.zone.fill ?? "#475569";
  const tempStr = temp != null && !Number.isNaN(temp) ? `${Math.round(temp)}` : "—";

  const gv = scoreVerdict(g);
  const iv = inflationVerdict(inf);
  const lv = liquidityVerdict(liq);
  const rv = riskVerdict(rk);

  const headline = `目前市場環境${zoneShortLabel}（溫度 ${tempStr}/100），處於「${regimeLabelZh}」階段。`;

  const parts: string[] = [];

  const gN = g ?? 0;
  const infN = inf ?? 0;
  const liqN = liq ?? 0;

  if (gN < -THRESH.mild && infN > THRESH.mild) {
    parts.push(`成長${gv.label}、通膨${iv.label}，接近滯脹型組合，股債配置偏向謹慎。`);
  } else if (gN > THRESH.mild && infN > THRESH.mild) {
    parts.push(`成長${gv.label}，但通膨${iv.label}，過熱訊號需留意政策風險。`);
  } else if (gN < -THRESH.mild && liqN < -THRESH.mild) {
    parts.push(`成長${gv.label}、流動性${lv.label}，風險資產環境偏不友善。`);
  } else if (gN > THRESH.mild && liqN > THRESH.mild) {
    parts.push(`成長${gv.label}、流動性${lv.label}，宏觀環境相對有利於風險偏好。`);
  } else {
    parts.push(`成長${gv.label}、通膨${iv.label}、流動性${lv.label}、風險偏好${rv.label}。`);
  }

  parts.push(rv.label.includes("防禦") ? "投資人情緒偏保守，需觀察後續變化。" : "");

  const detail = parts.filter(Boolean).join(" ");

  const isUncomfortable =
    (zoneInfo?.zone.min ?? 50) < 40 ||
    (gN < -THRESH.mild && infN > THRESH.mild);

  return { headline, detail, zoneShortLabel, zoneBgHex, isUncomfortable };
}
