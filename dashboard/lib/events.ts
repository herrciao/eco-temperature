import type { DashboardEvent, PanelRow } from "./types";
import { regimeColor, regimeLabelZh } from "./regime";

/** Curated market events (dates ≈ week-end Friday; aligned to panel weeks at runtime) */
export const MARKET_EVENTS: Omit<DashboardEvent, "id">[] = [
  { date: "2016-12-16", label: "Fed 升息循環啟動", type: "market", color: "#94a3b8" },
  { date: "2017-01-20", label: "Trump 就任", type: "market", color: "#cbd5e1" },
  { date: "2017-12-22", label: "稅改法案通過", type: "market", color: "#94a3b8" },
  { date: "2018-02-09", label: "VIX 風暴", type: "market", color: "#f8fafc" },
  { date: "2018-10-12", label: "Fed 鷹派升息高峰", type: "market", color: "#e2e8f0" },
  { date: "2018-12-21", label: "聖誕前夕大跌", type: "market", color: "#f1f5f9" },
  { date: "2019-01-04", label: "Powell 轉鴿（暫停升息）", type: "market", color: "#cbd5e1" },
  { date: "2019-08-02", label: "中美貿易摩擦升溫", type: "market", color: "#94a3b8" },
  { date: "2019-07-31", label: "Fed 預防性降息", type: "market", color: "#64748b" },
  { date: "2020-02-28", label: "COVID 全球恐慌起", type: "market", color: "#f8fafc" },
  { date: "2020-03-20", label: "COVID 流動性危機週", type: "market", color: "#e2e8f0" },
  { date: "2020-04-09", label: "Fed 無限 QE", type: "market", color: "#cbd5e1" },
  { date: "2020-11-06", label: "疫苗消息／大選後", type: "market", color: "#94a3b8" },
  { date: "2021-11-05", label: "通膨升溫／Taper 預期", type: "market", color: "#64748b" },
  { date: "2022-03-18", label: "Fed 開始升息", type: "market", color: "#f1f5f9" },
  { date: "2022-06-17", label: "升息 75bp 步調", type: "market", color: "#e2e8f0" },
  { date: "2022-10-14", label: "英國養老金／殖利率震盪", type: "market", color: "#cbd5e1" },
  { date: "2023-03-17", label: "SVB 倒閉", type: "market", color: "#f8fafc" },
  { date: "2023-07-28", label: "Fed 最後升息", type: "market", color: "#e2e8f0" },
  { date: "2023-10-20", label: "10Y 殖利率觸 5%", type: "market", color: "#cbd5e1" },
  { date: "2024-03-22", label: "日本結束負利率", type: "market", color: "#94a3b8" },
  { date: "2024-09-20", label: "Fed 開始降息", type: "market", color: "#64748b" },
  { date: "2025-04-04", label: "關稅衝擊", type: "market", color: "#f1f5f9" },
];

/** Exact match to curated event week (panel weeks may differ until export align). */
export function marketEventLabelForWeek(week: string): string | null {
  const hit = MARKET_EVENTS.find((e) => e.date === week);
  return hit ? hit.label : null;
}

/** Nearest curated event label within ~21 days (for historical anchor weeks). */
export function nearestMarketEventLabel(week: string): string | null {
  const t = Date.parse(week);
  if (Number.isNaN(t)) return null;
  let best: { diff: number; label: string } | null = null;
  for (const e of MARKET_EVENTS) {
    const dt = Math.abs(Date.parse(e.date) - t);
    if (dt > 21 * 86400000) continue;
    if (!best || dt < best.diff) {
      best = { diff: dt, label: e.label };
    }
  }
  return best?.label ?? null;
}

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
