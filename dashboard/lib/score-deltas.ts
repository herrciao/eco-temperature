import type { PanelRow } from "./types";

const KEYS = [
  "growth_score",
  "inflation_score",
  "liquidity_score",
  "risk_score",
] as const;

export type ScoreDeltaKey = (typeof KEYS)[number];

export type ScoreDeltas = Record<ScoreDeltaKey, number | null>;

/** Approximate 4-week delta: last row minus row 5 weeks back (4 gaps). */
export function compute4WeekDeltas(panel: PanelRow[]): ScoreDeltas {
  const empty: ScoreDeltas = {
    growth_score: null,
    inflation_score: null,
    liquidity_score: null,
    risk_score: null,
  };
  if (panel.length < 5) return empty;

  const last = panel[panel.length - 1];
  const prev = panel[panel.length - 5];

  const out = { ...empty };
  for (const k of KEYS) {
    const a = last[k];
    const b = prev[k];
    if (a == null || b == null) continue;
    const na = typeof a === "number" ? a : Number(a);
    const nb = typeof b === "number" ? b : Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) continue;
    out[k] = na - nb;
  }
  return out;
}
