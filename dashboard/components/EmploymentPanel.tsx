"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmploymentRow } from "@/lib/types";

const RANGE_OPTIONS = [
  { label: "近 3 年", months: 36 },
  { label: "近 5 年", months: 60 },
  { label: "全期", months: 0 },
] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number]["months"];

function fmtMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmtNfp(v: number | null): string {
  if (v == null) return "—";
  const k = Math.round(v);
  return `${k >= 0 ? "+" : ""}${k.toLocaleString()}K`;
}

function fmtUnrate(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function employmentNarrative(
  latestNfp: number | null,
  latestUnrate: number | null,
  nfpTrend3m: number | null
): { oneLiner: string; detail: string } {
  if (latestNfp == null || latestUnrate == null) {
    return { oneLiner: "資料尚未載入", detail: "" };
  }

  let strength: string;
  if (latestNfp > 200) strength = "強勁";
  else if (latestNfp > 100) strength = "溫和";
  else if (latestNfp > 0) strength = "偏弱";
  else strength = "收縮（月減少）";

  const urLevel =
    latestUnrate < 4.0
      ? "低位（歷史相對健康）"
      : latestUnrate < 5.0
      ? "溫和"
      : "偏高";

  const trend =
    nfpTrend3m != null
      ? nfpTrend3m > 50
        ? "近 3 個月均值偏高，就業動能轉強。"
        : nfpTrend3m < 0
        ? "近 3 個月均值為負，就業趨勢轉弱。"
        : "近 3 個月均值持平。"
      : "";

  return {
    oneLiner: `非農新增 ${fmtNfp(latestNfp)}，失業率 ${fmtUnrate(latestUnrate)}（${urLevel}）`,
    detail: `就業新增${strength}。${trend}`,
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-300">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}：</span>
          <span className="font-mono text-slate-200">
            {p.name === "非農變化（千人）"
              ? fmtNfp(p.value)
              : p.name === "失業率（%）"
              ? fmtUnrate(p.value)
              : p.value?.toLocaleString() ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EmploymentPanel({ rows }: { rows: EmploymentRow[] }) {
  const [range, setRange] = useState<RangeOption>(36);

  const filtered = useMemo(() => {
    if (range === 0 || rows.length === 0) return rows;
    return rows.slice(-range);
  }, [rows, range]);

  const latest = rows[rows.length - 1] ?? null;
  const latestMonth = latest ? fmtMonth(latest.month) : "—";

  // 3-month average NFP for trend
  const nfpTrend3m = useMemo(() => {
    const recent = rows.slice(-3).map((r) => r.nfp_change).filter((v) => v != null) as number[];
    if (recent.length === 0) return null;
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }, [rows]);

  const narrative = employmentNarrative(
    latest?.nfp_change ?? null,
    latest?.unrate ?? null,
    nfpTrend3m
  );

  const chartData = filtered.map((r) => ({
    month: fmtMonth(r.month),
    nfp_change: r.nfp_change,
    unrate: r.unrate,
  }));

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 ring-1 ring-slate-800">
        <h2 className="text-sm font-semibold text-slate-300">美國就業面板</h2>
        <p className="mt-2 text-xs text-slate-500">
          資料尚未產生。請執行{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400">
            python main.py score &amp;&amp; python main.py export
          </code>
          。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 ring-1 ring-slate-800 border-l-4 border-l-teal-500/80">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-200">美國就業面板</h2>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">US Employment</span>
            <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[11px] font-medium text-slate-300 ring-1 ring-slate-600/60">
              FRED 原始月頻
            </span>
          </div>
          <p className="text-sm font-medium text-slate-200 leading-snug">{narrative.oneLiner}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{narrative.detail}</p>
        </div>

        {/* Latest value badges */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-[10px] text-slate-500">{latestMonth}</p>
          <div className="flex gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                (latest?.nfp_change ?? 0) >= 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-rose-900/60 text-rose-300"
              }`}
            >
              NFP {fmtNfp(latest?.nfp_change ?? null)}
            </span>
            <span className="rounded bg-sky-900/60 px-2 py-0.5 font-mono text-xs font-semibold text-sky-300">
              UR {fmtUnrate(latest?.unrate ?? null)}
            </span>
          </div>
        </div>
      </div>

      {/* Range selector */}
      <div className="mb-3 flex gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.months}
            onClick={() => setRange(opt.months)}
            className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
              range === opt.months
                ? "bg-teal-600/80 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          {/* Left axis: NFP change (thousands) */}
          <YAxis
            yAxisId="nfp"
            orientation="left"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}K`}
            width={52}
          />
          {/* Right axis: unemployment rate */}
          <YAxis
            yAxisId="ur"
            orientation="right"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            domain={["auto", "auto"]}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
            formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}
          />
          {/* Zero line */}
          <ReferenceLine yAxisId="nfp" y={0} stroke="#475569" strokeDasharray="2 2" />
          {/* +200K consensus threshold */}
          <ReferenceLine
            yAxisId="nfp"
            y={200}
            stroke="#2dd4bf"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: "+200K", position: "insideTopRight", fill: "#5eead4", fontSize: 9 }}
          />
          <Bar
            yAxisId="nfp"
            dataKey="nfp_change"
            name="非農變化（千人）"
            maxBarSize={14}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={(entry.nfp_change ?? 0) >= 0 ? "#10b981" : "#f43f5e"}
              />
            ))}
          </Bar>
          <Line
            yAxisId="ur"
            type="monotone"
            dataKey="unrate"
            name="失業率（%）"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="mt-2 text-[10px] leading-snug text-slate-600">
        來源：FRED PAYEMS（非農就業人數）、UNRATE（失業率）。月頻原始數值，非週頻對齊後的模型輸入。僅供研究參考，不構成投資建議。
      </p>
    </section>
  );
}
