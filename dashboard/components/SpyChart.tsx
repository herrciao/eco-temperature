"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardEvent, PanelRow } from "@/lib/types";
import { REGIME_COLORS, regimeLabelZh } from "@/lib/regime";
import { EventMarkers } from "@/components/EventMarkers";
import { EventLegend } from "@/components/EventLegend";

function mergeRegimeSegments(
  panel: PanelRow[]
): { x1: string; x2: string; regime: string }[] {
  if (panel.length === 0) return [];
  const out: { x1: string; x2: string; regime: string }[] = [];
  let segStart = panel[0].week;
  let segRegime = panel[0].regime;
  for (let i = 1; i < panel.length; i++) {
    if (panel[i].regime !== segRegime) {
      out.push({ x1: segStart, x2: panel[i - 1].week, regime: segRegime });
      segStart = panel[i].week;
      segRegime = panel[i].regime;
    }
  }
  out.push({
    x1: segStart,
    x2: panel[panel.length - 1].week,
    regime: segRegime,
  });
  return out;
}

export function SpyChart({
  panel,
  events,
}: {
  panel: PanelRow[];
  events: DashboardEvent[];
}) {
  const data = panel.map((p) => ({
    week: p.week,
    etf_spy: p.etf_spy == null ? null : Number(p.etf_spy),
    regime: p.regime,
  }));
  const segments = mergeRegimeSegments(panel);

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-lg font-semibold text-slate-100">
        SPY 週線（調整後）+ Regime 色帶 + 事件線
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        白線為 SPY 週收盤；背景色帶為當週 Regime。虛線為手動事件；事件說明見圖下方列表（不疊字在圖上）。因子權重見頁面下方「因子拆解」。
      </p>
      <div className="h-[380px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="week"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => (typeof v === "string" ? v.slice(0, 7) : v)}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => Number(v).toFixed(0)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as {
                  etf_spy: number | null;
                  regime: string;
                };
                const spy = row.etf_spy;
                return (
                  <div className="rounded-lg border border-slate-600 bg-slate-900/95 p-3 text-xs shadow-xl">
                    <p className="font-medium text-slate-200">週 {label}</p>
                    <p className="mt-1 text-slate-100">
                      SPY{" "}
                      {spy == null || Number.isNaN(spy)
                        ? "—"
                        : spy.toFixed(2)}
                    </p>
                    <p className="mt-1 text-slate-400">
                      {regimeLabelZh(String(row.regime))}
                    </p>
                  </div>
                );
              }}
            />
            {segments.map((seg, i) => (
              <ReferenceArea
                key={`${seg.x1}-${seg.x2}-${seg.regime}-${i}`}
                x1={seg.x1}
                x2={seg.x2}
                strokeOpacity={0}
                fill={REGIME_COLORS[seg.regime] ?? "#64748b"}
                fillOpacity={0.25}
              />
            ))}
            <Line
              type="monotone"
              dataKey="etf_spy"
              stroke="#f8fafc"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
            <EventMarkers events={events} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <EventLegend events={events} />
    </section>
  );
}
