"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PanelRow } from "@/lib/types";
import { MACRO_TEMPERATURE_BLEND_ZH } from "@/lib/factors";

export function TemperatureChart({ panel }: { panel: PanelRow[] }) {
  const gid = useId().replace(/:/g, "");
  const gradId = `tempFill-${gid}`;

  const data = panel.map((p) => ({
    week: p.week,
    macro_temperature:
      p.macro_temperature == null ? null : Number(p.macro_temperature),
  }));

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-lg font-semibold text-slate-100">
        宏觀溫度歷史（0–100）
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        藍端偏冷（偏空）、紅端偏熱（偏多）；50 為中性參考線。
      </p>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        {MACRO_TEMPERATURE_BLEND_ZH}
      </p>
      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="week"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => (typeof v === "string" ? v.slice(0, 7) : v)}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickCount={6}
            />
            <ReferenceLine y={50} stroke="#64748b" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value);
                return Number.isNaN(n) ? "—" : n.toFixed(1);
              }}
              labelFormatter={(label) => `週 ${label}`}
            />
            <Area
              type="monotone"
              dataKey="macro_temperature"
              stroke="#94a3b8"
              strokeWidth={1.2}
              fill={`url(#${gradId})`}
              fillOpacity={0.85}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
