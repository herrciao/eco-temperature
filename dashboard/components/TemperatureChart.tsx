"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardEvent, PanelRow } from "@/lib/types";
import { MACRO_TEMPERATURE_BLEND_ZH } from "@/lib/factors";
import {
  macroTemperatureSeries,
  median,
  temperatureZoneLabel,
  temperatureHistoricalAnchor,
  TEMPERATURE_ZONES,
} from "@/lib/interpretation";
import { EventMarkers } from "@/components/EventMarkers";
import { nearestMarketEventLabel } from "@/lib/events";

export function TemperatureChart({
  panel,
  fullPanel,
  events,
}: {
  panel: PanelRow[];
  /** Full history for median / anchor text (defaults to `panel`) */
  fullPanel?: PanelRow[];
  events: DashboardEvent[];
}) {
  const gid = useId().replace(/:/g, "");
  const gradId = `tempFill-${gid}`;
  const history = fullPanel ?? panel;

  const data = panel.map((p) => ({
    week: p.week,
    macro_temperature:
      p.macro_temperature == null ? null : Number(p.macro_temperature),
  }));

  const x0 = panel[0]?.week;
  const x1 = panel[panel.length - 1]?.week;

  const histTemps = macroTemperatureSeries(history);
  const histMedian = median(histTemps);

  const last = panel[panel.length - 1];
  const curTemp =
    last?.macro_temperature == null ? null : Number(last.macro_temperature);
  const zoneInfo = temperatureZoneLabel(curTemp);
  const anchor =
    curTemp != null && !Number.isNaN(curTemp)
      ? temperatureHistoricalAnchor(history, curTemp)
      : null;
  const anchorEvent = anchor ? nearestMarketEventLabel(anchor.week) : null;

  const headlineParts: string[] = [];
  if (curTemp != null && !Number.isNaN(curTemp)) {
    headlineParts.push(
      `目前約 ${curTemp.toFixed(1)}/100（${zoneInfo?.zone.shortLabel ?? "—"}：${zoneInfo?.label ?? ""}）`
    );
  }
  if (anchor) {
    headlineParts.push(
      `歷史上溫度接近的週期：${anchor.week.slice(0, 7)}${anchorEvent ? `（${anchorEvent}）` : ""}`
    );
  }
  if (histMedian != null) {
    headlineParts.push(
      `全樣本溫度中位數約 ${histMedian.toFixed(1)}（虛線）；50 為理論中性參考。`
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-lg font-semibold text-slate-100">
        宏觀溫度歷史（0–100）
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        藍端偏冷（偏空）、紅端偏熱（偏多）；背景色帶為解讀區間；50 為理論中性參考線。
      </p>
      <p className="mb-2 text-xs leading-relaxed text-slate-400">
        {headlineParts.join(" ")}
      </p>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        {MACRO_TEMPERATURE_BLEND_ZH}
      </p>
      <div className="mb-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
        {TEMPERATURE_ZONES.map((z) => (
          <span
            key={z.shortLabel}
            className="inline-flex items-center gap-1 rounded border border-slate-700/80 px-1.5 py-0.5"
          >
            <span
              className="inline-block h-2 w-2 rounded-sm opacity-80"
              style={{ backgroundColor: z.fill }}
            />
            {z.min}-{z.max === 100 ? "100" : z.max}：{z.shortLabel}
          </span>
        ))}
      </div>
      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.9} />
                <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            {x0 && x1 && (
              <>
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={0}
                  y2={20}
                  fill={TEMPERATURE_ZONES[0].fill}
                  fillOpacity={0.22}
                  strokeOpacity={0}
                />
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={20}
                  y2={40}
                  fill={TEMPERATURE_ZONES[1].fill}
                  fillOpacity={0.18}
                  strokeOpacity={0}
                />
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={40}
                  y2={60}
                  fill={TEMPERATURE_ZONES[2].fill}
                  fillOpacity={0.14}
                  strokeOpacity={0}
                />
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={60}
                  y2={80}
                  fill={TEMPERATURE_ZONES[3].fill}
                  fillOpacity={0.16}
                  strokeOpacity={0}
                />
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={80}
                  y2={100}
                  fill={TEMPERATURE_ZONES[4].fill}
                  fillOpacity={0.2}
                  strokeOpacity={0}
                />
              </>
            )}
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
              label={{
                value: "冷← →熱",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 10,
              }}
            />
            <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="4 4" />
            {histMedian != null && (
              <ReferenceLine
                y={histMedian}
                stroke="#fbbf24"
                strokeDasharray="6 4"
                label={{
                  value: `歷史中位 ${histMedian.toFixed(0)}`,
                  fill: "#fbbf24",
                  fontSize: 10,
                  position: "right",
                }}
              />
            )}
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
            <EventMarkers events={events} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
