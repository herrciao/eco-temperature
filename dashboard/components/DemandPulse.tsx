"use client";

import type { DemandGroup } from "@/lib/types";
import { InfoButton } from "@/components/BasketInfoModal";

interface Props {
  demandGroups: Record<string, DemandGroup>;
  latestWeek: string | null;
  rangeEnd?: number;
}

const DEMAND_LABELS: Record<string, string> = {
  consumer_electronics: "消費電子 (AAPL)",
  cloud_hyperscaler: "雲端超大規模",
  ai_compute: "AI 算力 (NVDA/AMD)",
};

function pulseColor(pulse: number): string {
  if (pulse > 65) return "#4ade80";
  if (pulse > 50) return "#38bdf8";
  if (pulse > 35) return "#f59e0b";
  return "#f87171";
}

function pulseLabel(pulse: number): string {
  if (pulse > 65) return "強勢";
  if (pulse > 50) return "中性偏強";
  if (pulse > 35) return "中性偏弱";
  return "偏弱";
}

function detectTheme(
  groups: Record<string, DemandGroup>,
  rangeEnd?: number,
): { label: string; color: string } {
  function getPulse(key: string): number {
    const g = groups[key];
    if (!g) return 50;
    if (rangeEnd != null && g.pulse && rangeEnd < g.pulse.length) {
      return g.pulse[rangeEnd] ?? g.pulse_latest ?? 50;
    }
    return g.pulse_latest ?? 50;
  }
  const ai = getPulse("ai_compute");
  const cloud = getPulse("cloud_hyperscaler");
  const ce = getPulse("consumer_electronics");
  if (ai > 65) return { label: "AI 基礎設施擴張", color: "#4ade80" };
  if (cloud > 65) return { label: "雲端資本支出加速", color: "#f59e0b" };
  if (ce > 65) return { label: "消費電子復甦", color: "#38bdf8" };
  if (ai < 35 && cloud < 35) return { label: "需求收縮", color: "#f87171" };
  return { label: "需求中性觀察", color: "#8b9cb3" };
}

export function DemandPulse({ demandGroups, latestWeek, rangeEnd }: Props) {
  const theme = detectTheme(demandGroups, rangeEnd);

  function getPulse(key: string, group: DemandGroup): number {
    if (rangeEnd != null && group.pulse && rangeEnd < group.pulse.length) {
      return group.pulse[rangeEnd] ?? group.pulse_latest ?? 50;
    }
    return group.pulse_latest ?? 50;
  }

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">本週主題狀態</p>
          <span
            className="mt-1 inline-block rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: theme.color + "22", color: theme.color }}
          >
            {theme.label}
          </span>
        </div>
        {latestWeek && (
          <p className="text-xs text-slate-500">資料截止 {latestWeek}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Object.entries(demandGroups).map(([key, group]) => {
          const pulse = getPulse(key, group);
          const color = pulseColor(pulse);
          const label = pulseLabel(pulse);
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-4"
            >
              <div className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                <span>{DEMAND_LABELS[key] ?? group.label}</span>
                <InfoButton type="demand" basketKey={key} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color }}>
                  {pulse.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">{label}</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700">
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${pulse}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
