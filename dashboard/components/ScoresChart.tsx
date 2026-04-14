"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardEvent, PanelRow } from "@/lib/types";
import { REGIME_COLORS, regimeLabelZh } from "@/lib/regime";
import { EventMarkers } from "@/components/EventMarkers";

const SERIES = [
  { key: "growth_score", name: "Growth", color: "#34d399" },
  { key: "inflation_score", name: "Inflation", color: "#fb923c" },
  { key: "liquidity_score", name: "Liquidity", color: "#38bdf8" },
  { key: "risk_score", name: "Risk", color: "#a78bfa" },
] as const;

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

export function ScoresChart({
  panel,
  events,
}: {
  panel: PanelRow[];
  events: DashboardEvent[];
}) {
  const data = panel.map((p) => ({
    week: p.week,
    regime: p.regime,
    growth_score: p.growth_score == null ? null : Number(p.growth_score),
    inflation_score:
      p.inflation_score == null ? null : Number(p.inflation_score),
    liquidity_score:
      p.liquidity_score == null ? null : Number(p.liquidity_score),
    risk_score: p.risk_score == null ? null : Number(p.risk_score),
  }));
  const segments = mergeRegimeSegments(panel);

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-lg font-semibold text-slate-100">
        四維合成得分（週）+ Regime 背景 + 事件線
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        Y 軸 -1～+1；四條線為合成得分；背景色為 Regime；虛線為手動事件。事件與 Regime
        切換文字請見上方「SPY 週線」下方；各維度如何加權見「因子拆解」。
      </p>
      <div className="h-[380px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
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
              domain={[-1, 1]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickCount={9}
            />
            {segments.map((seg, i) => (
              <ReferenceArea
                key={`${seg.x1}-${seg.x2}-${seg.regime}-sc-${i}`}
                x1={seg.x1}
                x2={seg.x2}
                strokeOpacity={0}
                fill={REGIME_COLORS[seg.regime] ?? "#64748b"}
                fillOpacity={0.18}
              />
            ))}
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as {
                  regime: string;
                  growth_score: number | null;
                  inflation_score: number | null;
                  liquidity_score: number | null;
                  risk_score: number | null;
                };
                return (
                  <div className="rounded-lg border border-slate-600 bg-slate-900/95 p-3 text-xs shadow-xl">
                    <p className="font-medium text-slate-200">週 {label}</p>
                    <p className="mt-1 text-slate-500">
                      {regimeLabelZh(String(row.regime))}
                    </p>
                    {SERIES.map((s) => {
                      const v = row[s.key as keyof typeof row];
                      const n =
                        typeof v === "number" ? v : v == null ? null : Number(v);
                      return (
                        <p
                          key={s.key}
                          className="mt-0.5 font-mono tabular-nums"
                          style={{ color: s.color }}
                        >
                          {s.name}{" "}
                          {n == null || Number.isNaN(n) ? "—" : n.toFixed(3)}
                        </p>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
            <EventMarkers events={events} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
