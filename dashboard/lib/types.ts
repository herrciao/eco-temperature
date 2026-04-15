export type Regime =
  | "expansion"
  | "recovery"
  | "overheating"
  | "stagflation_risk"
  | "contraction"
  | "neutral";

/** Manual market event or auto-detected regime switch */
export type DashboardEventType = "market" | "regime_change";

export interface DashboardEvent {
  id: string;
  /** Week label (YYYY-MM-DD), matches panel `week` */
  date: string;
  label: string;
  type: DashboardEventType;
  /** Present when type === "regime_change" */
  regime?: string;
  /** Stroke color override for charts */
  color?: string;
}

export interface FactorComponentDef {
  key: string;
  label: string;
  weight: number;
  color: string;
}

export interface PanelRow {
  week: string;
  regime: string;
  macro_temperature: number | null;
  growth_score: number | null;
  inflation_score: number | null;
  liquidity_score: number | null;
  risk_score: number | null;
  spy_composite_4w?: number | null;
  spy_composite_13w?: number | null;
  etf_spy: number | null;
}

/** Latest week snapshot (full CSV row + week). */
export type CurrentRecord = Record<string, unknown> & {
  week: string;
};

export interface DashboardData {
  current: CurrentRecord;
  panel: PanelRow[];
}

// ─── Supply Chain Types ────────────────────────────────────────────────────

export interface LeadLagSummary {
  us_lead_pct: number;
  tw_lead_pct: number;
  sync_pct: number;
  weak_pct: number;
  avg_lag: number;
  avg_corr: number;
}

export interface LeadLagPhase {
  type: "us_lead" | "tw_lead" | "sync" | "weak";
  start_date: string;
  end_date: string;
  duration: number;
  avg_lag: number;
  avg_corr: number;
  max_corr: number;
}

export interface LeadLagPair {
  demand_key: string;
  basket_key: string;
  weekly_lag: number[];
  weekly_corr: (number | null)[];
  weekly_type: string[];
  phases: LeadLagPhase[];
  summary: LeadLagSummary;
}

export interface DemandGroup {
  label: string;
  members: string[];
  index: (number | null)[];
  pulse: (number | null)[];
  pulse_latest: number | null;
}

export interface BasketGroup {
  label: string;
  members: [string, string][];
  index: (number | null)[];
  momentum_13w: (number | null)[];
  momentum_latest: number | null;
}

export interface AmplifierNode {
  id: string;
  label: string;
  tickers: string[];
  index: (number | null)[] | null;
  lag_vs_nvda: number | null;
  corr_vs_nvda: number | null;
}

export interface SupplyChainData {
  generated: string;
  weeks: string[];
  window_weeks: number;
  max_lag_weeks: number;
  demand_groups: Record<string, DemandGroup>;
  baskets: Record<string, BasketGroup>;
  lead_lag: Record<string, LeadLagPair>;
  amplifier_chain: AmplifierNode[];
  latest_week: string | null;
  total_pairs: number;
}
