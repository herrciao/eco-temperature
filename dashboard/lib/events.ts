import type { DashboardEvent, PanelRow } from "./types";
import { regimeColor, regimeLabelZh } from "./regime";

/** Curated market events (dates = week-end Friday approximations) */
export const MARKET_EVENTS: Omit<DashboardEvent, "id">[] = [
  { date: "2023-03-17", label: "SVB 倒閉", type: "market", color: "#f8fafc" },
  { date: "2023-07-28", label: "Fed 最後升息", type: "market", color: "#e2e8f0" },
  { date: "2023-10-20", label: "10Y 殖利率觸 5%", type: "market", color: "#cbd5e1" },
  { date: "2024-03-22", label: "日本結束負利率", type: "market", color: "#94a3b8" },
  { date: "2024-09-20", label: "Fed 開始降息", type: "market", color: "#64748b" },
  { date: "2025-04-04", label: "關稅衝擊", type: "market", color: "#f1f5f9" },
];

function panelWeekRange(panel: PanelRow[]): { min: string; max: string } | null {
  if (panel.length === 0) return null;
  const weeks = panel.map((p) => p.week).sort();
  return { min: weeks[0], max: weeks[weeks.length - 1] };
}

function inRange(date: string, min: string, max: string): boolean {
  return date >= min && date <= max;
}

/** First week where regime differs from previous week */
export function detectRegimeChanges(panel: PanelRow[]): DashboardEvent[] {
  const out: DashboardEvent[] = [];
  for (let i = 1; i < panel.length; i++) {
    const prev = panel[i - 1].regime;
    const cur = panel[i].regime;
    if (prev !== cur) {
      const r = String(cur);
      out.push({
        id: `regime-${panel[i].week}-${r}-${i}`,
        date: panel[i].week,
        label: `→ ${regimeLabelZh(r)}`,
        type: "regime_change",
        regime: r,
        color: regimeColor(r),
      });
    }
  }
  return out;
}

/** Market events in panel window + regime switches; sorted by date */
export function getVisibleEvents(
  panel: PanelRow[],
  marketEvents: Omit<DashboardEvent, "id">[] = MARKET_EVENTS
): DashboardEvent[] {
  const range = panelWeekRange(panel);
  if (!range) return [];

  const manual: DashboardEvent[] = marketEvents
    .filter((e) => inRange(e.date, range.min, range.max))
    .map((e, i) => ({
      ...e,
      id: `mkt-${e.date}-${i}`,
    }));

  const regimeEv = detectRegimeChanges(panel);

  const merged = [...manual, ...regimeEv].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  return merged;
}

/** Snap event dates to nearest panel week (>= event) so ReferenceLine matches X axis. */
export function alignEventsToPanelWeeks(
  panel: PanelRow[],
  events: DashboardEvent[]
): DashboardEvent[] {
  const weeks = panel.map((p) => p.week).sort();
  if (weeks.length === 0) return [];
  const set = new Set(weeks);
  return events.map((ev) => {
    if (set.has(ev.date)) return ev;
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    if (ev.date < first) return { ...ev, date: first, id: `${ev.id}-align` };
    if (ev.date > last) return { ...ev, date: last, id: `${ev.id}-align` };
    const next = weeks.find((w) => w >= ev.date) ?? last;
    return { ...ev, date: next, id: `${ev.id}-align` };
  });
}

/** Keep only events whose week falls within the visible panel slice (sorted by week). */
export function filterEventsToVisiblePanel(
  events: DashboardEvent[],
  visiblePanel: PanelRow[]
): DashboardEvent[] {
  if (visiblePanel.length === 0) return [];
  const min = visiblePanel[0].week;
  const max = visiblePanel[visiblePanel.length - 1].week;
  return events.filter((e) => e.date >= min && e.date <= max);
}

/** Merge multiple events that snap to the same week (single ReferenceLine). */
export function mergeEventsOnSameDate(
  events: DashboardEvent[]
): DashboardEvent[] {
  const byDate = new Map<string, DashboardEvent>();
  for (const e of events) {
    const prev = byDate.get(e.date);
    if (!prev) {
      byDate.set(e.date, { ...e });
      continue;
    }
    byDate.set(e.date, {
      ...prev,
      id: `${prev.id}+${e.id}`,
      label: `${prev.label} · ${e.label}`,
      type: prev.type === e.type ? prev.type : "market",
    });
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
