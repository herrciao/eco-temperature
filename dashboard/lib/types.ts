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
